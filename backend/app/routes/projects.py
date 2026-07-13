from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.project import Project, ProjectMonthlyTarget, PROJECT_STATUSES
from app.models.task_type import TaskType
from app.models.user import User
from app.permissions import require_action, login_required, current_user

projects_bp = Blueprint("projects", __name__)


# ---------- List (visibility varies by role, spec §4.2) ----------
@projects_bp.get("")
@login_required
def list_projects():
    user = current_user()

    q = Project.query
    if user.effective_role == "cm":
        # CM only sees projects they're assigned to
        q = q.filter_by(cm_id=user.id)
    # admin_sys, manager, chef_prod see all projects — no filter

    search = request.args.get("search")
    if search:
        q = q.filter(Project.title.ilike(f"%{search}%"))

    created_after = request.args.get("created_after")
    if created_after:
        q = q.filter(Project.created_at >= created_after)

    return jsonify([p.to_dict() for p in q.order_by(Project.created_at.desc()).all()])


@projects_bp.get("/<int:project_id>")
@login_required
def get_project(project_id):
    project = Project.query.get_or_404(project_id)
    user = current_user()

    if user.effective_role == "cm" and project.cm_id != user.id:
        return jsonify({"error": "forbidden"}), 403

    return jsonify(project.to_dict())


# ---------- Create (Manager only, spec §4.1) ----------
@projects_bp.post("")
@require_action("creer_projet")
def create_project():
    data = request.get_json(force=True) or {}

    required = ["title", "start_date", "cm_id", "monthly_targets"]
    missing = [f for f in required if data.get(f) in (None, "", {})]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    cm = User.query.get(data["cm_id"])
    if not cm or cm.role != "cm":
        return jsonify({"error": "invalid_cm"}), 400

    try:
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid_start_date"}), 400

    # spec §4.1: monthly_targets is {task_type_id: count} covering configured task types
    targets = data["monthly_targets"]
    if not isinstance(targets, dict):
        return jsonify({"error": "invalid_monthly_targets"}), 400

    for tt_id in targets:
        if not TaskType.query.get(int(tt_id)):
            return jsonify({"error": "invalid_task_type", "task_type_id": tt_id}), 400

    project = Project(
        title=data["title"],
        start_date=start_date,
        remarks=data.get("remarks"),
        cm_id=cm.id,
        status="actif",
    )
    db.session.add(project)
    db.session.flush()  # get project.id before adding targets

    for tt_id, count in targets.items():
        db.session.add(ProjectMonthlyTarget(
            project_id=project.id,
            task_type_id=int(tt_id),
            monthly_count=int(count),
        ))

    db.session.commit()

    # TODO(notifications.py): notify the assigned CM per spec §4.1
    return jsonify(project.to_dict()), 201


# ---------- Update: notes, CM, status, monthly targets — one general PATCH
# (Manager, Admin Sys — spec §4.3) ----------
@projects_bp.patch("/<int:project_id>")
@require_action("modifier_projet")
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json(force=True) or {}

    if "title" in data:
        project.title = data["title"]

    if "remarks" in data:
        project.remarks = data["remarks"]

    if "cm_id" in data:
        cm = User.query.get(data["cm_id"])
        if not cm or cm.role != "cm":
            return jsonify({"error": "invalid_cm"}), 400
        reassigned = cm.id != project.cm_id
        project.cm_id = cm.id
        # TODO(notifications.py): notify newly assigned CM if reassigned

    if "status" in data:
        if data["status"] not in PROJECT_STATUSES:
            return jsonify({"error": "invalid_status"}), 400
        project.status = data["status"]

    if "monthly_targets" in data:
        targets = data["monthly_targets"]
        if not isinstance(targets, dict):
            return jsonify({"error": "invalid_monthly_targets"}), 400

        for tt_id in targets:
            if not TaskType.query.get(int(tt_id)):
                return jsonify({"error": "invalid_task_type", "task_type_id": tt_id}), 400

        existing = {t.task_type_id: t for t in project.monthly_targets}
        for tt_id, count in targets.items():
            tt_id = int(tt_id)
            if tt_id in existing:
                existing[tt_id].monthly_count = int(count)
            else:
                db.session.add(ProjectMonthlyTarget(
                    project_id=project.id, task_type_id=tt_id, monthly_count=int(count),
                ))

    db.session.commit()
    return jsonify(project.to_dict())


# ---------- On hold shortcut (spec §4.3 — explicit action in the matrix) ----------
@projects_bp.post("/<int:project_id>/on-hold")
@require_action("on_hold_projet")
def put_project_on_hold(project_id):
    project = Project.query.get_or_404(project_id)
    project.status = "on_hold"
    db.session.commit()
    return jsonify(project.to_dict())


# NOTE: no delete endpoint — spec §9.2 forbids deleting elements referenced in a project,
# and a project itself is never deletable once created (only actif / on_hold / termine).