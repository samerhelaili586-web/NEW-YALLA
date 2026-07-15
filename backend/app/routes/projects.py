from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.project import Project, ProjectMonthlyTarget, PROJECT_STATUSES
from app.models.task_type import TaskType
from app.models.user import User
from app.models.notification import Notification
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

    # spec §4.1 + §8: notify the assigned CM on project creation
    db.session.add(Notification(
        user_id=cm.id,
        type="project_assigned",
        message=f"Vous avez été affecté(e) au projet « {project.title} ».",
        link_url=f"/projects/{project.id}",
    ))
    db.session.commit()
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
        if reassigned:
            # spec §8: notify the newly assigned CM
            db.session.add(Notification(
                user_id=cm.id,
                type="project_assigned",
                message=f"Vous avez été affecté(e) au projet « {project.title} ».",
                link_url=f"/projects/{project.id}",
            ))

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


# ---------- KPIs: planned vs confirmed tasks per month (spec §4.4.3) ----------
@projects_bp.get("/<int:project_id>/kpis")
@login_required
def project_kpis(project_id):
    from collections import defaultdict
    from app.models.task import Task
    from app.models.task_type import Status as StatusModel

    project = Project.query.get_or_404(project_id)
    user = current_user()
    if user.effective_role == "cm" and project.cm_id != user.id:
        return jsonify({"error": "forbidden"}), 403

    # Planned: monthly_count per task_type (same every month — the agreed frequency)
    targets = {
        str(t.task_type_id): {"count": t.monthly_count, "name": t.task_type.name if t.task_type else ""}
        for t in project.monthly_targets
    }

    # Actual: tasks that reached a final_confirmation status, grouped by month of planned_publish_date
    confirmed = (
        Task.query.join(StatusModel)
        .filter(Task.project_id == project_id, StatusModel.functional_type == "final_confirmation")
        .all()
    )

    actual_by_month = defaultdict(lambda: defaultdict(int))  # month → task_type_id → count
    for task in confirmed:
        month = task.planned_publish_date.strftime("%Y-%m")
        actual_by_month[month][str(task.task_type_id)] += 1

    return jsonify({
        "targets": targets,
        "actual_by_month": {m: dict(v) for m, v in sorted(actual_by_month.items())},
    })


# ---------- Time per user: aggregated by month (spec §4.4.4) ----------
@projects_bp.get("/<int:project_id>/time-summary")
@login_required
def project_time_summary(project_id):
    from collections import defaultdict
    from app.models.task import Task, TimeEntry

    project = Project.query.get_or_404(project_id)
    user = current_user()
    if user.effective_role == "cm" and project.cm_id != user.id:
        return jsonify({"error": "forbidden"}), 403

    entries = (
        TimeEntry.query
        .join(Task)
        .filter(Task.project_id == project_id)
        .all()
    )

    # Aggregate: user_id → month → total minutes
    agg = defaultdict(lambda: defaultdict(int))
    user_names = {}
    for e in entries:
        month = e.entry_date.strftime("%Y-%m")
        agg[e.user_id][month] += e.hours * 60 + e.minutes
        if e.user:
            user_names[e.user_id] = f"{e.user.first_name} {e.user.last_name}"

    result = []
    for uid, months in agg.items():
        month_data = []
        total_minutes = 0
        for month in sorted(months):
            mins = months[month]
            total_minutes += mins
            month_data.append({
                "month": month,
                "hours": mins // 60,
                "minutes": mins % 60,
                "total_minutes": mins,
            })
        result.append({
            "user_id": uid,
            "user_name": user_names.get(uid, ""),
            "months": month_data,
            "total_hours": total_minutes // 60,
            "total_minutes": total_minutes % 60,
        })

    # Sort by user name
    result.sort(key=lambda x: x["user_name"])
    return jsonify(result)


# NOTE: no delete endpoint — spec §9.2 forbids deleting elements referenced in a project,
# and a project itself is never deletable once created (only actif / on_hold / termine).