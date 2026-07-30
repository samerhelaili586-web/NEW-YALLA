from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from app import db
from app.models.task import Task, TaskAssignee, Comment, CommentMention, TimeEntry, TASK_TITLE_MAX_LEN
from app.models.task_type import Status, Transition, DEFAULT_ALLOWED_ROLES
from app.models.project import Project
from app.models.notification import Notification
from app.models.user import User
from app.permissions import require_action, login_required, current_user, require_menu
from app.routes.task_types import get_available_next_statuses

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.get("")
@login_required
def list_tasks():
    project_id = request.args.get("project_id", type=int)
    assigned_to_me = request.args.get("assigned_to_me", type=int)
    montage_only = request.args.get("montage_only", type=int)
    personal_only = request.args.get("personal_only", type=int)

    user = current_user()
    q = Task.query
    if project_id:
        q = q.filter_by(project_id=project_id)

    if assigned_to_me:
        assigned_ids = [
            a.task_id for a in TaskAssignee.query.filter_by(user_id=user.id).all()
        ]
        # Also include personal tasks owned by this user (no project)
        from sqlalchemy import or_
        personal_task_ids = [
            t.id for t in Task.query.filter_by(project_id=None)
            .filter(Task.id.in_([a.task_id for a in TaskAssignee.query.filter_by(user_id=user.id).all()]))
            .all()
        ]
        q = q.filter(Task.id.in_(set(assigned_ids) | set(personal_task_ids)))

        # spec §5.2: CM must not see their own projects' tasks in this view
        if user.effective_role == "cm":
            from app.models.project import Project as Proj
            own_project_ids = [
                p.id for p in Proj.query.filter_by(cm_id=user.id).all()
            ]
            if own_project_ids:
                q = q.filter(~Task.project_id.in_(own_project_ids))

    if montage_only:
        q = q.join(Status).filter(Status.functional_type.in_(["montage", "planification_montage"]))

    if personal_only:
        q = q.filter_by(project_id=None)
        # Only show personal tasks assigned to the current user
        assigned_ids = [a.task_id for a in TaskAssignee.query.filter_by(user_id=user.id).all()]
        q = q.filter(Task.id.in_(assigned_ids))

    tasks = q.order_by(Task.planned_publish_date).all()
    return jsonify([t.to_dict(user_id=user.id if user else None) for t in tasks])


# spec §5.3 — Montage menu: tasks assigned as monteur persist after status changes
@tasks_bp.get("/montage")
@require_menu("taches_montage")
def list_montage_tasks():
    from sqlalchemy import or_

    user = current_user()

    monteur_q = db.session.query(TaskAssignee.task_id).filter(
        TaskAssignee.role_on_task == "monteur"
    )
    if user.effective_role == "prod":
        monteur_q = monteur_q.filter(TaskAssignee.user_id == user.id)
    monteur_ids = {row[0] for row in monteur_q.distinct().all()}

    if user.effective_role == "prod":
        if not monteur_ids:
            return jsonify([])
        q = Task.query.filter(Task.id.in_(monteur_ids))
    else:
        conditions = [Status.functional_type.in_(["montage", "planification_montage"])]
        if monteur_ids:
            conditions.append(Task.id.in_(monteur_ids))
        q = Task.query.join(Status).filter(or_(*conditions))

    tasks = q.order_by(Task.planned_publish_date.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@tasks_bp.get("/<int:task_id>")
@login_required
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = task.to_dict()
    data["comments"] = [c.to_dict() for c in task.comments]
    data["time_entries"] = [te.to_dict() for te in task.time_entries]
    data["assignees"] = [
        {"id": a.user_id, "name": f"{a.user.first_name} {a.user.last_name}", "role_on_task": a.role_on_task}
        for a in task.assignees
    ]
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

    # Personal task: project_id is optional. If not provided, task is personal (no project).
    is_personal = not data.get("project_id")

    if is_personal:
        # Personal task: only requires title, planned_publish_date; task_type_id optional
        required = ["title", "planned_publish_date"]
    else:
        required = ["project_id", "task_type_id", "title", "planned_publish_date"]

    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    if not is_personal:
        project = Project.query.get_or_404(data["project_id"])

        # spec §4.3: no task creation on on_hold or termine projects
        if project.status in ("on_hold", "termine"):
            return jsonify({
                "error": "project_not_active",
                "detail": f"Ce projet est '{project.status}' — aucune tâche ne peut être ajoutée.",
            }), 409

    from app.models.task_type import TaskType

    # For personal tasks, use a generic task type if none provided
    task_type_id = data.get("task_type_id")
    if task_type_id:
        tt = TaskType.query.get_or_404(task_type_id)
        if not is_personal and (tt.is_archived or tt.workflow_status != "active"):
            return jsonify({
                "error": "workflow_not_active",
                "detail": "Ce workflow n'est pas actif (statut 'brouillon' ou 'désactivé').",
            }), 400

    status_id = data.get("status_id")
    if task_type_id and not status_id:
        start_status = Status.query.filter_by(task_type_id=task_type_id, functional_type="debut").first()
        if not start_status:
            start_status = Status.query.filter_by(task_type_id=task_type_id).first()
        if start_status:
            status_id = start_status.id
    elif not task_type_id and not status_id:
        # Personal task with no type: use first available status from any active task type
        any_status = Status.query.first()
        if any_status:
            status_id = any_status.id
            task_type_id = any_status.task_type_id
    elif status_id:
        Status.query.get_or_404(status_id)

    if not status_id or not task_type_id:
        return jsonify({"error": "no_start_status", "detail": "Impossible de trouver un statut de départ."}), 400

    if len(data["title"]) > TASK_TITLE_MAX_LEN:
        return jsonify({"error": "title_too_long", "max": TASK_TITLE_MAX_LEN}), 400

    try:
        publish_date = datetime.strptime(data["planned_publish_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    user = current_user()
    task = Task(
        project_id=data.get("project_id") or None,
        task_type_id=task_type_id,
        status_id=status_id,
        title=data["title"],
        description=data.get("description"),
        planned_publish_date=publish_date,
    )
    db.session.add(task)
    db.session.flush()  # get task.id

    # Auto-assign the creator to their own personal/created task
    from app.models.task import TaskAssignee
    assignee = TaskAssignee(task_id=task.id, user_id=user.id, role_on_task="owner")
    db.session.add(assignee)

    db.session.commit()
    return jsonify(task.to_dict()), 201


@tasks_bp.patch("/<int:task_id>")
@login_required
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    user = current_user()
    is_assignee = TaskAssignee.query.filter_by(task_id=task.id, user_id=user.id).first() is not None
    is_manager_or_admin = user.effective_role in ("admin_sys", "manager")

    if not is_manager_or_admin and not is_assignee and task.project_id is not None:
        return jsonify({"error": "forbidden", "detail": "Vous n'avez pas les droits pour modifier cette tâche."}), 403

    data = request.get_json(force=True) or {}

    if "title" in data:
        if len(data["title"]) > TASK_TITLE_MAX_LEN:
            return jsonify({"error": "title_too_long", "max": TASK_TITLE_MAX_LEN}), 400
        task.title = data["title"]

    if "description" in data:
        task.description = data["description"]

    if "status_id" in data:
        from app.models.task_type import Status
        Status.query.get_or_404(data["status_id"])
        task.status_id = data["status_id"]

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

    # Find the explicit Transition row between current and target status
    transition = Transition.query.filter_by(
        from_status_id=task.status_id,
        to_status_id=new_status.id,
    ).first()

    if user.effective_role not in ("manager", "admin_sys"):
        if not transition:
            return jsonify({"error": "transition_not_allowed"}), 403

        # Check per-transition allowed_roles; fall back to DEFAULT_ALLOWED_ROLES if empty
        transition_roles = transition.allowed_roles if transition.allowed_roles else DEFAULT_ALLOWED_ROLES.get(
            task.status.functional_type, []
        )
        if user.effective_role not in transition_roles:
            return jsonify({"error": "role_not_allowed_for_transition"}), 403

    # Validate required transition form fields if configured
    form_values = data.get("form_values") or {}
    if transition and transition.form_fields:
        required_fields = [f for f in transition.form_fields if f.get("required") or f.get("is_required")]
        missing_fields = []
        for rf in required_fields:
            field_key = rf.get("name") or rf.get("id") or rf.get("label")
            if not form_values.get(field_key):
                missing_fields.append(rf.get("label") or field_key)
        if missing_fields:
            return jsonify({"error": "missing_required_form_fields", "fields": missing_fields}), 400

    task.status_id = new_status.id

    # If form_values were provided, log them as a comment
    if form_values and isinstance(form_values, dict):
        formatted_fields = "\n".join([f"• **{k}**: {v}" for k, v in form_values.items() if v])
        if formatted_fields:
            body = f"📌 **Passage au statut '{new_status.title}'** :\n{formatted_fields}"
            comment = Comment(task_id=task.id, author_id=user.id, body=body)
            db.session.add(comment)

    db.session.commit()
    return jsonify(task.to_dict())


@tasks_bp.post("/<int:task_id>/assignees")
@login_required
def add_assignee(task_id):
    user = current_user()
    if user.effective_role not in ("cm", "chef_prod", "manager", "admin_sys") and not getattr(user, "is_chef_prod", False):
        return jsonify({"error": "forbidden", "detail": "Seuls les CM, Chef Prod, Manager et Admin Sys peuvent modifier les assignations."}), 403

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
    user = current_user()
    if user.effective_role not in ("cm", "chef_prod", "manager", "admin_sys") and not getattr(user, "is_chef_prod", False):
        return jsonify({"error": "forbidden", "detail": "Seuls les CM, Chef Prod, Manager et Admin Sys peuvent modifier les assignations."}), 403

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
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}
    if not data.get("body"):
        return jsonify({"error": "body_required"}), 400

    user = current_user()
    comment = Comment(task_id=task_id, author_id=user.id, body=data["body"])
    db.session.add(comment)
    db.session.flush()

    mentioned_ids = data.get("mentioned_user_ids", []) or []
    for uid in mentioned_ids:
        # Verify user exists before creating mention
        if not User.query.get(uid):
            continue
        db.session.add(CommentMention(comment_id=comment.id, user_id=uid))
        # spec §4.4.2 + §8: mentioned users receive a clickable notification
        db.session.add(Notification(
            user_id=uid,
            type="mention",
            message=f"{user.first_name} {user.last_name} vous a mentionné dans un commentaire sur « {task.title} ».",
            link_url=f"/projects/{task.project_id}?task={task.id}&tab=comments",
        ))

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@tasks_bp.get("/<int:task_id>/time-entries")
@login_required
def list_time_entries(task_id):
    Task.query.get_or_404(task_id)
    entries = TimeEntry.query.filter_by(task_id=task_id).order_by(TimeEntry.entry_date).all()
    return jsonify([e.to_dict() for e in entries])



def get_max_elapsed_minutes(target_date, now_dt=None):
    """
    Work Schedule and Overtime:
    - Allow up to 16 hours (960 minutes) maximum per day including overtime.
    """
    return 16 * 60


@tasks_bp.post("/<int:task_id>/time-entries")
@require_action("reporter_temps")
def create_time_entry(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True) or {}

    if not data.get("entry_date"):
        return jsonify({"error": "entry_date_required"}), 400

    try:
        entry_date = datetime.strptime(data["entry_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    try:
        hours = int(data.get("hours", 0))
        minutes = int(data.get("minutes", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid_time_values"}), 400

    if hours < 0 or minutes < 0:
        return jsonify({"error": "negative_time_values", "detail": "Les heures et minutes doivent être positives."}), 400
    if minutes > 59:
        return jsonify({"error": "invalid_minutes", "detail": "Les minutes doivent être comprises entre 0 et 59."}), 400
    if hours > 24:
        return jsonify({"error": "invalid_hours", "detail": "Les heures ne peuvent pas dépasser 24."}), 400

    user = current_user()

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)

    if entry_date > today:
        return jsonify({
            "error": "future_date_not_allowed",
            "detail": "Impossible de déclarer du temps pour une date future."
        }), 400

    if entry_date < yesterday:
        return jsonify({
            "error": "date_too_old",
            "detail": "La saisie de temps n'est autorisée que pour aujourd'hui (J) ou hier (J-1)."
        }), 400

    max_mins = get_max_elapsed_minutes(entry_date)
    requested_mins = hours * 60 + minutes

    existing_entries = TimeEntry.query.filter_by(user_id=user.id, entry_date=entry_date).all()
    existing_mins = sum(e.hours * 60 + e.minutes for e in existing_entries)

    if existing_mins + requested_mins > max_mins:
        rem_mins = max(0, max_mins - existing_mins)
        rem_h, rem_m = rem_mins // 60, rem_mins % 60
        elapsed_h, elapsed_m = max_mins // 60, max_mins % 60
        if entry_date == datetime.now().date():
            detail_msg = f"Seules {elapsed_h}h{elapsed_m:02d} min se sont écoulées aujourd'hui (début à 08h30, pause 13h-14h non comptée). Temps restant déclarable pour aujourd'hui : {rem_h}h{rem_m:02d} min."
        else:
            detail_msg = f"Le temps déclaré dépasse le maximum autorisé pour cette journée ({elapsed_h}h{elapsed_m:02d} min). Temps restant déclarable : {rem_h}h{rem_m:02d} min."
        return jsonify({"error": "exceeds_max_workable_hours", "detail": detail_msg}), 400

    entry = TimeEntry(
        task_id=task.id,
        user_id=user.id,
        entry_date=entry_date,
        hours=hours,
        minutes=minutes,
        status_id_at_entry=task.status_id,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@tasks_bp.patch("/<int:task_id>/time-entries/<int:entry_id>")
@require_action("reporter_temps")
def update_time_entry(task_id, entry_id):
    Task.query.get_or_404(task_id)
    entry = TimeEntry.query.get_or_404(entry_id)
    user = current_user()

    if entry.user_id != user.id:
        return jsonify({"error": "forbidden", "detail": "Vous ne pouvez modifier que vos propres saisies."}), 403

    data = request.get_json(force=True) or {}
    t_date = entry.entry_date
    if "entry_date" in data:
        try:
            t_date = datetime.strptime(data["entry_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "invalid_date"}), 400

    if t_date > datetime.now().date():
        return jsonify({
            "error": "future_date_not_allowed",
            "detail": "Impossible de déclarer du temps pour une date future."
        }), 400

    new_h = int(data.get("hours", entry.hours))
    new_m = int(data.get("minutes", entry.minutes))

    max_mins = get_max_elapsed_minutes(t_date)
    requested_mins = new_h * 60 + new_m

    other_entries = TimeEntry.query.filter(
        TimeEntry.user_id == user.id,
        TimeEntry.entry_date == t_date,
        TimeEntry.id != entry.id,
    ).all()
    existing_mins = sum(e.hours * 60 + e.minutes for e in other_entries)

    if existing_mins + requested_mins > max_mins:
        rem_mins = max(0, max_mins - existing_mins)
        rem_h, rem_m = rem_mins // 60, rem_mins % 60
        elapsed_h, elapsed_m = max_mins // 60, max_mins % 60
        if t_date == datetime.now().date():
            detail_msg = f"Seules {elapsed_h}h{elapsed_m:02d} min se sont écoulées aujourd'hui (début à 08h30, pause 13h-14h non comptée). Temps restant déclarable : {rem_h}h{rem_m:02d} min."
        else:
            detail_msg = f"Le temps déclaré dépasse le maximum autorisé pour cette journée ({elapsed_h}h{elapsed_m:02d} min). Temps restant déclarable : {rem_h}h{rem_m:02d} min."
        return jsonify({"error": "exceeds_max_workable_hours", "detail": detail_msg}), 400

    entry.entry_date = t_date
    entry.hours = new_h
    entry.minutes = new_m
    db.session.commit()
    return jsonify(entry.to_dict())


@tasks_bp.delete("/<int:task_id>/time-entries/<int:entry_id>")
@require_action("reporter_temps")
def delete_time_entry(task_id, entry_id):
    Task.query.get_or_404(task_id)
    entry = TimeEntry.query.get_or_404(entry_id)
    user = current_user()
    # Only the owner of the time entry can delete
    if entry.user_id != user.id:
        return jsonify({"error": "forbidden", "detail": "Vous ne pouvez supprimer que vos propres saisies."}), 403
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True})