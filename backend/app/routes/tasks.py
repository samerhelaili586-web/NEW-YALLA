from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.task import Task, TaskAssignee, Comment, CommentMention, TimeEntry, TASK_TITLE_MAX_LEN
from app.models.task_type import Status
from app.models.project import Project
from app.permissions import require_action, login_required, current_user
from app.routes.task_types import get_available_next_statuses

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.get("")
@login_required
def list_tasks():
    project_id = request.args.get("project_id", type=int)
    q = Task.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    tasks = q.order_by(Task.planned_publish_date).all()
    return jsonify([t.to_dict() for t in tasks])


@tasks_bp.get("/<int:task_id>")
@login_required
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = task.to_dict()
    data["comments"] = [c.to_dict() for c in task.comments]
    data["time_entries"] = [te.to_dict() for te in task.time_entries]
    data["assignee_ids"] = [a.user_id for a in task.assignees]
    return jsonify(data)


@tasks_bp.get("/<int:task_id>/next-statuses")
@login_required
def next_statuses(task_id):
    task = Task.query.get_or_404(task_id)
    user = current_user()
    options = get_available_next_statuses(task.status, user.effective_role)
    return jsonify([s.to_dict() for s in options])


@tasks_bp.post("")
@require_action("creer_tache")
def create_task():
    data = request.get_json(force=True) or {}
    required = ["project_id", "task_type_id", "status_id", "title", "planned_publish_date"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    Project.query.get_or_404(data["project_id"])
    Status.query.get_or_404(data["status_id"])

    if len(data["title"]) > TASK_TITLE_MAX_LEN:
        return jsonify({"error": "title_too_long", "max": TASK_TITLE_MAX_LEN}), 400

    try:
        publish_date = datetime.strptime(data["planned_publish_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    task = Task(
        project_id=data["project_id"],
        task_type_id=data["task_type_id"],
        status_id=data["status_id"],
        title=data["title"],
        description=data.get("description"),
        planned_publish_date=publish_date,
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@tasks_bp.patch("/<int:task_id>")
@login_required
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}

    if "title" in data:
        if len(data["title"]) > TASK_TITLE_MAX_LEN:
            return jsonify({"error": "title_too_long", "max": TASK_TITLE_MAX_LEN}), 400
        task.title = data["title"]

    if "description" in data:
        task.description = data["description"]

    if "planned_publish_date" in data:
        try:
            task.planned_publish_date = datetime.strptime(data["planned_publish_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "invalid_date"}), 400

    db.session.commit()
    return jsonify(task.to_dict())


@tasks_bp.post("/<int:task_id>/change-status")
@login_required
def change_status(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}
    new_status_id = data.get("status_id")
    if not new_status_id:
        return jsonify({"error": "status_id_required"}), 400

    user = current_user()
    new_status = Status.query.get_or_404(new_status_id)

    if user.effective_role not in ("manager", "admin_sys"):
        allowed = get_available_next_statuses(task.status, user.effective_role)
        if new_status not in allowed:
            return jsonify({"error": "transition_not_allowed"}), 403
        if user.effective_role not in (task.status.allowed_roles or []):
            return jsonify({"error": "role_not_allowed_for_status"}), 403

    task.status_id = new_status.id
    db.session.commit()
    return jsonify(task.to_dict())


@tasks_bp.post("/<int:task_id>/assignees")
@login_required
def add_assignee(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id_required"}), 400

    exists = TaskAssignee.query.filter_by(task_id=task.id, user_id=user_id).first()
    if exists:
        return jsonify({"error": "already_assigned"}), 409

    assignee = TaskAssignee(task_id=task.id, user_id=user_id, role_on_task=data.get("role_on_task"))
    db.session.add(assignee)
    db.session.commit()
    return jsonify({"ok": True}), 201


@tasks_bp.delete("/<int:task_id>/assignees/<int:user_id>")
@login_required
def remove_assignee(task_id, user_id):
    assignee = TaskAssignee.query.filter_by(task_id=task_id, user_id=user_id).first_or_404()
    db.session.delete(assignee)
    db.session.commit()
    return jsonify({"ok": True})


@tasks_bp.get("/<int:task_id>/comments")
@login_required
def list_comments(task_id):
    Task.query.get_or_404(task_id)
    comments = Comment.query.filter_by(task_id=task_id).order_by(Comment.created_at).all()
    return jsonify([c.to_dict() for c in comments])


@tasks_bp.post("/<int:task_id>/comments")
@require_action("ajouter_commentaire")
def add_comment(task_id):
    Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}
    if not data.get("body"):
        return jsonify({"error": "body_required"}), 400

    user = current_user()
    comment = Comment(task_id=task_id, author_id=user.id, body=data["body"])
    db.session.add(comment)
    db.session.flush()

    for uid in data.get("mentioned_user_ids", []):
        db.session.add(CommentMention(comment_id=comment.id, user_id=uid))

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@tasks_bp.get("/<int:task_id>/time-entries")
@login_required
def list_time_entries(task_id):
    Task.query.get_or_404(task_id)
    entries = TimeEntry.query.filter_by(task_id=task_id).order_by(TimeEntry.entry_date).all()
    return jsonify([e.to_dict() for e in entries])


@tasks_bp.post("/<int:task_id>/time-entries")
@require_action("reporter_temps")
def add_time_entry(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}

    required = ["entry_date", "hours", "minutes"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    try:
        entry_date = datetime.strptime(data["entry_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    user = current_user()
    entry = TimeEntry(
        task_id=task.id,
        user_id=user.id,
        entry_date=entry_date,
        hours=data["hours"],
        minutes=data["minutes"],
        status_id_at_entry=task.status_id,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201