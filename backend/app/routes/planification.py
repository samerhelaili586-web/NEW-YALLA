from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.task import Task, TaskAssignee
from app.models.task_type import Status
from app.models.equipment import Equipment
from app.models.shoot import Shoot, ShootCrew
from app.models.user import User
from app.models.leave import LeaveRequest, SickAbsence
from app.permissions import require_menu, require_action, login_required, current_user

planification_bp = Blueprint("planification", __name__)


def _user_conflicts(user_id, start_at, end_at, exclude_shoot_id=None):
    """spec §5.1.1: a Prod user conflicts if already on another shoot in this window,
    or on approved leave / a declared sick absence covering these dates."""
    conflicts = []

    crew_q = (
        ShootCrew.query.join(Shoot)
        .filter(ShootCrew.user_id == user_id, Shoot.start_at < end_at, Shoot.end_at > start_at)
    )
    if exclude_shoot_id:
        crew_q = crew_q.filter(Shoot.id != exclude_shoot_id)
    for crew in crew_q.all():
        conflicts.append({"type": "shoot", "shoot_id": crew.shoot_id})

    start_date, end_date = start_at.date() if hasattr(start_at, "date") else start_at, \
                            end_at.date() if hasattr(end_at, "date") else end_at

    leaves = LeaveRequest.query.filter(
        LeaveRequest.user_id == user_id,
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= end_date,
        LeaveRequest.end_date >= start_date,
    ).all()
    for lv in leaves:
        conflicts.append({"type": "leave", "leave_id": lv.id})

    sick = SickAbsence.query.filter(
        SickAbsence.user_id == user_id,
        SickAbsence.absence_date >= start_date,
        SickAbsence.absence_date <= end_date,
    ).all()
    for s in sick:
        conflicts.append({"type": "sick_absence", "sick_absence_id": s.id})

    return conflicts


def _equipment_conflicts(equipment_id, start_at, end_at, exclude_shoot_id=None):
    q = Shoot.query.filter(
        Shoot.equipment_id == equipment_id, Shoot.start_at < end_at, Shoot.end_at > start_at,
    )
    if exclude_shoot_id:
        q = q.filter(Shoot.id != exclude_shoot_id)
    return q.all()


# ---------- Pending queue: tasks stuck on a figé planning status (spec §5.1) ----------
@planification_bp.get("/pending")
@require_menu("planification")
def list_pending():
    tasks = (
        Task.query.join(Status)
        .filter(Status.temporal_type == "fige", Status.functional_type.in_(
            ("planification_shooting", "planification_montage")
        ))
        .order_by(Task.created_at.asc())
        .all()
    )
    return jsonify([
        {**t.to_dict(), "planning_type": t.status.functional_type}
        for t in tasks
    ])


# ---------- Badge count: number of tasks pending Chef Prod action (spec §5.1) ----------
@planification_bp.get("/pending-count")
@require_menu("planification")
def pending_count():
    count = (
        Task.query.join(Status)
        .filter(Status.temporal_type == "fige", Status.functional_type.in_(
            ("planification_shooting", "planification_montage")
        ))
        .count()
    )
    return jsonify({"count": count})


# ---------- Shooting planning (spec §5.1.1) ----------
@planification_bp.get("/shoots/<int:task_id>")
@require_menu("planification")
def get_shoot_for_task(task_id):
    Task.query.get_or_404(task_id)
    shoot = Shoot.query.filter_by(task_id=task_id).first()
    if not shoot:
        return jsonify(None)
    return jsonify(shoot.to_dict())


@planification_bp.post("/shoots")
@require_action("changer_statut_planification")
def create_or_update_shoot():
    """Creates the shoot if none exists for the task, or updates it — spec §5.1.1 explicitly
    allows the Chef Prod to modify the planning at any time, even after the task has moved on."""
    data = request.get_json(force=True) or {}

    required = ["task_id", "equipment_id", "prod_user_ids", "start_at", "end_at"]
    missing = [f for f in required if data.get(f) in (None, "", [])]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    task = Task.query.get_or_404(data["task_id"])
    equipment = Equipment.query.get_or_404(data["equipment_id"])
    if not equipment.is_active:
        return jsonify({"error": "equipment_inactive"}), 400

    try:
        start_at = datetime.fromisoformat(data["start_at"])
        end_at = datetime.fromisoformat(data["end_at"])
    except ValueError:
        return jsonify({"error": "invalid_datetime"}), 400
    if end_at <= start_at:
        return jsonify({"error": "end_before_start"}), 400

    prod_user_ids = data["prod_user_ids"]
    for uid in prod_user_ids:
        u = User.query.get(uid)
        if not u or u.role != "prod":
            return jsonify({"error": "invalid_prod_user", "user_id": uid}), 400

    existing_shoot = Shoot.query.filter_by(task_id=task.id).first()
    exclude_id = existing_shoot.id if existing_shoot else None

    # spec §5.1.1: block validation on any conflict — equipment or Prod crew
    equipment_conflicts = _equipment_conflicts(equipment.id, start_at, end_at, exclude_id)
    if equipment_conflicts:
        return jsonify({
            "error": "equipment_conflict",
            "conflicts": [s.to_dict() for s in equipment_conflicts],
        }), 409

    user_conflicts = {}
    for uid in prod_user_ids:
        c = _user_conflicts(uid, start_at, end_at, exclude_id)
        if c:
            user_conflicts[uid] = c
    if user_conflicts:
        return jsonify({"error": "user_conflict", "conflicts": user_conflicts}), 409

    if existing_shoot:
        shoot = existing_shoot
        shoot.equipment_id = equipment.id
        shoot.start_at = start_at
        shoot.end_at = end_at
        ShootCrew.query.filter_by(shoot_id=shoot.id).delete()
    else:
        shoot = Shoot(task_id=task.id, equipment_id=equipment.id, start_at=start_at, end_at=end_at)
        db.session.add(shoot)
        db.session.flush()

    for uid in prod_user_ids:
        db.session.add(ShootCrew(shoot_id=shoot.id, user_id=uid, is_invited_only=False))

    # spec §5.1.1: optional invites (CM, Manager, or the Chef Prod themself) — visible but not "crew"
    invited_ids = data.get("invited_user_ids") or []
    for uid in invited_ids:
        db.session.add(ShootCrew(shoot_id=shoot.id, user_id=uid, is_invited_only=True))

    db.session.commit()

    # spec: once planning is done, the task leaves the "Planification" menu — advance its status
    # if it's still sitting on the same "planification_shooting" status that triggered this action.
    if not existing_shoot and task.status and task.status.functional_type == "planification_shooting":
        from app.routes.task_types import get_available_next_statuses
        next_statuses = get_available_next_statuses(task.status, "chef_prod")
        if len(next_statuses) == 1:
            task.status_id = next_statuses[0].id
            db.session.commit()

    return jsonify(shoot.to_dict()), 201


@planification_bp.get("/equipment/<int:equipment_id>/availability")
@login_required
def check_equipment_availability(equipment_id):
    Equipment.query.get_or_404(equipment_id)
    start = request.args.get("start")
    end = request.args.get("end")
    if not start or not end:
        return jsonify({"error": "missing_fields", "fields": ["start", "end"]}), 400
    conflicts = _equipment_conflicts(equipment_id, start, end)
    return jsonify({"available": len(conflicts) == 0, "conflicts": [s.to_dict() for s in conflicts]})


@planification_bp.get("/users/<int:user_id>/availability")
@login_required
def check_user_availability(user_id):
    User.query.get_or_404(user_id)
    start = request.args.get("start")
    end = request.args.get("end")
    if not start or not end:
        return jsonify({"error": "missing_fields", "fields": ["start", "end"]}), 400
    conflicts = _user_conflicts(user_id, start, end)
    return jsonify({"available": len(conflicts) == 0, "conflicts": conflicts})


# ---------- Montage planning (spec §5.1.2) ----------
@planification_bp.post("/montage/<int:task_id>/assign")
@require_action("changer_statut_planification")
def assign_montage(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}

    prod_user_id = data.get("prod_user_id")
    if not prod_user_id:
        return jsonify({"error": "missing_fields", "fields": ["prod_user_id"]}), 400

    prod_user = User.query.get(prod_user_id)
    if not prod_user or prod_user.role != "prod":
        return jsonify({"error": "invalid_prod_user"}), 400

    if not TaskAssignee.query.filter_by(task_id=task.id, user_id=prod_user.id).first():
        db.session.add(TaskAssignee(task_id=task.id, user_id=prod_user.id, role_on_task="monteur"))

    if task.status and task.status.functional_type == "planification_montage":
        from app.routes.task_types import get_available_next_statuses
        next_statuses = get_available_next_statuses(task.status, "chef_prod")
        if len(next_statuses) == 1:
            task.status_id = next_statuses[0].id

    db.session.commit()
    return jsonify(task.to_dict())


# ---------- Shooting calendar (spec §5.4 — visible to all users) ----------
@planification_bp.get("/calendar")
@login_required
def shooting_calendar():
    start = request.args.get("start")
    end = request.args.get("end")

    q = Shoot.query
    if start:
        q = q.filter(Shoot.end_at >= start)
    if end:
        q = q.filter(Shoot.start_at <= end)

    return jsonify([s.to_dict() for s in q.order_by(Shoot.start_at).all()])