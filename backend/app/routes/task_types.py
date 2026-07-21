from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db
from app.models.task_type import TaskType, Status, Transition, FUNCTIONAL_TYPES, TEMPORAL_TYPES, WORKFLOW_STATUSES, DEFAULT_ALLOWED_ROLES
from app.models.task import Task
from app.permissions import require_menu, login_required

task_types_bp = Blueprint("task_types", __name__)

FINAL_TYPES = ("final_confirmation", "final_rejet")


# ---------- Read (any logged-in user can see workflow list/detail) ----------
@task_types_bp.get("")
@login_required
def list_task_types():
    include_archived = request.args.get("include_archived") == "1"
    q = TaskType.query
    if not include_archived:
        q = q.filter_by(is_archived=False)
    return jsonify([tt.to_dict(include_statuses=False) for tt in q.all()])


@task_types_bp.get("/<int:task_type_id>")
@login_required
def get_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    return jsonify(tt.to_dict())


# ---------- Admin Sys: workflow CRUD ----------
@task_types_bp.post("")
@require_menu("gestion_workflows")
def create_task_type():
    data = request.get_json(force=True) or {}
    if not data.get("name"):
        return jsonify({"error": "name_required"}), 400
    tt = TaskType(
        name=data["name"],
        description=data.get("description"),
        workflow_status=data.get("workflow_status", "draft"),
        updated_at=datetime.now(timezone.utc),
    )
    db.session.add(tt)
    db.session.commit()
    return jsonify(tt.to_dict()), 201


@task_types_bp.patch("/<int:task_type_id>")
@require_menu("gestion_workflows")
def update_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    data = request.get_json(force=True) or {}
    if "name" in data:
        tt.name = data["name"]
    if "description" in data:
        tt.description = data["description"]
    if "workflow_status" in data:
        if data["workflow_status"] not in WORKFLOW_STATUSES:
            return jsonify({"error": "invalid_workflow_status"}), 400
        tt.workflow_status = data["workflow_status"]
    tt.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(tt.to_dict())


@task_types_bp.post("/<int:task_type_id>/archive")
@require_menu("gestion_workflows")
def archive_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    tt.is_archived = True
    tt.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(tt.to_dict())


@task_types_bp.post("/<int:task_type_id>/toggle-status")
@require_menu("gestion_workflows")
def toggle_workflow_status(task_type_id):
    """Cycle: draft -> active -> disabled -> draft (or set explicitly via body)."""
    tt = TaskType.query.get_or_404(task_type_id)
    data = request.get_json(force=True) or {}
    if "workflow_status" in data:
        if data["workflow_status"] not in WORKFLOW_STATUSES:
            return jsonify({"error": "invalid_workflow_status"}), 400
        tt.workflow_status = data["workflow_status"]
    else:
        cycle = {"draft": "active", "active": "disabled", "disabled": "draft"}
        tt.workflow_status = cycle.get(tt.workflow_status, "draft")
    tt.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(tt.to_dict())


@task_types_bp.post("/<int:task_type_id>/duplicate")
@require_menu("gestion_workflows")
def duplicate_task_type(task_type_id):
    """Deep-copy a workflow: TaskType + all Statuses + all Transitions."""
    original = TaskType.query.get_or_404(task_type_id)

    copy = TaskType(
        name=f"{original.name} (copie)",
        description=original.description,
        workflow_status="draft",
        updated_at=datetime.now(timezone.utc),
    )
    db.session.add(copy)
    db.session.flush()  # get copy.id

    # Map old status id -> new status id
    status_id_map = {}
    for s in original.statuses:
        new_s = Status(
            task_type_id=copy.id,
            title=s.title,
            temporal_type=s.temporal_type,
            functional_type=s.functional_type,
            allowed_roles=list(s.allowed_roles or []),
            pos_x=s.pos_x,
            pos_y=s.pos_y,
        )
        db.session.add(new_s)
        db.session.flush()
        status_id_map[s.id] = new_s.id

    # Duplicate transitions using the new status ids
    for s in original.statuses:
        for t in s.outgoing_transitions:
            new_t = Transition(
                from_status_id=status_id_map[t.from_status_id],
                to_status_id=status_id_map[t.to_status_id],
                allowed_roles=list(t.allowed_roles or []),
                form_fields=list(t.form_fields or []),
            )
            db.session.add(new_t)

    db.session.commit()
    # Reload copy with relationships
    copy = TaskType.query.get(copy.id)
    return jsonify(copy.to_dict()), 201


@task_types_bp.delete("/<int:task_type_id>")
@require_menu("gestion_workflows")
def delete_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    in_use = Task.query.filter_by(task_type_id=tt.id).first() is not None
    if in_use:
        return jsonify({"error": "task_type_in_use"}), 409
    db.session.delete(tt)
    db.session.commit()
    return jsonify({"ok": True})


# ---------- Statuses ----------
@task_types_bp.post("/<int:task_type_id>/statuses")
@require_menu("gestion_workflows")
def create_status(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    data = request.get_json(force=True) or {}

    required = ["title", "temporal_type", "functional_type"]
    missing = [f for f in required if data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    if data["temporal_type"] not in TEMPORAL_TYPES:
        return jsonify({"error": "invalid_temporal_type"}), 400
    if data["functional_type"] not in FUNCTIONAL_TYPES:
        return jsonify({"error": "invalid_functional_type"}), 400

    status = Status(
        task_type_id=tt.id,
        title=data["title"],
        temporal_type=data["temporal_type"],
        functional_type=data["functional_type"],
        allowed_roles=data.get("allowed_roles", []),
        pos_x=data.get("pos_x", 100),
        pos_y=data.get("pos_y", 100),
    )
    db.session.add(status)
    tt.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(status.to_dict()), 201


@task_types_bp.patch("/statuses/<int:status_id>")
@require_menu("gestion_workflows")
def update_status(status_id):
    status = Status.query.get_or_404(status_id)
    data = request.get_json(force=True) or {}

    for field in ("title", "pos_x", "pos_y", "allowed_roles"):
        if field in data:
            setattr(status, field, data[field])

    if "temporal_type" in data:
        if data["temporal_type"] not in TEMPORAL_TYPES:
            return jsonify({"error": "invalid_temporal_type"}), 400
        status.temporal_type = data["temporal_type"]

    if "functional_type" in data:
        if data["functional_type"] not in FUNCTIONAL_TYPES:
            return jsonify({"error": "invalid_functional_type"}), 400
        status.functional_type = data["functional_type"]

    # Update parent workflow's updated_at
    tt = TaskType.query.get(status.task_type_id)
    if tt:
        tt.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(status.to_dict())


@task_types_bp.delete("/statuses/<int:status_id>")
@require_menu("gestion_workflows")
def delete_status(status_id):
    status = Status.query.get_or_404(status_id)
    in_use = Task.query.filter_by(status_id=status.id).first() is not None
    if in_use:
        return jsonify({"error": "status_in_use"}), 409
    db.session.delete(status)
    db.session.commit()
    return jsonify({"ok": True})


# ---------- Transitions (the arrows) ----------
@task_types_bp.post("/transitions")
@require_menu("gestion_workflows")
def create_transition():
    data = request.get_json(force=True) or {}
    from_id = data.get("from_status_id")
    to_id = data.get("to_status_id")
    if not from_id or not to_id:
        return jsonify({"error": "missing_fields"}), 400

    from_status = Status.query.get_or_404(from_id)
    Status.query.get_or_404(to_id)  # validate to_status exists

    # spec §3.1.3: final statuses have zero outgoing transitions
    if from_status.functional_type in FINAL_TYPES:
        return jsonify({"error": "final_status_no_outgoing_transition"}), 400

    exists = Transition.query.filter_by(from_status_id=from_id, to_status_id=to_id).first()
    if exists:
        return jsonify({"error": "transition_already_exists"}), 409

    transition = Transition(
        from_status_id=from_id,
        to_status_id=to_id,
        allowed_roles=data.get("allowed_roles", []),
        form_fields=data.get("form_fields", []),
    )
    db.session.add(transition)

    # Update parent workflow's updated_at
    tt = TaskType.query.get(from_status.task_type_id)
    if tt:
        tt.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(transition.to_dict()), 201


@task_types_bp.patch("/transitions/<int:transition_id>")
@require_menu("gestion_workflows")
def update_transition(transition_id):
    """Update allowed_roles and/or form_fields on a transition."""
    transition = Transition.query.get_or_404(transition_id)
    data = request.get_json(force=True) or {}

    if "allowed_roles" in data:
        transition.allowed_roles = data["allowed_roles"]
    if "form_fields" in data:
        transition.form_fields = data["form_fields"]

    # Update parent workflow's updated_at
    from_status = Status.query.get(transition.from_status_id)
    if from_status:
        tt = TaskType.query.get(from_status.task_type_id)
        if tt:
            tt.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(transition.to_dict())


@task_types_bp.delete("/transitions/<int:transition_id>")
@require_menu("gestion_workflows")
def delete_transition(transition_id):
    transition = Transition.query.get_or_404(transition_id)
    db.session.delete(transition)
    db.session.commit()
    return jsonify({"ok": True})


# ---------- Helper used by tasks.py: what statuses can this task move to? ----------
def get_available_next_statuses(current_status: Status, effective_role: str):
    """
    Spec §3.1.3: normally only statuses reachable via a configured outgoing
    transition are offered. Manager/Admin Sys get a derogation — the FULL
    status list for the task type, ignoring the transition graph.

    For each transition: if transition.allowed_roles is non-empty, check
    the user's role against it. If empty, use DEFAULT_ALLOWED_ROLES as fallback.
    """
    if effective_role in ("manager", "admin_sys"):
        return Status.query.filter_by(task_type_id=current_status.task_type_id).all()

    result = []
    for t in current_status.outgoing_transitions:
        transition_roles = t.allowed_roles if t.allowed_roles else DEFAULT_ALLOWED_ROLES.get(
            current_status.functional_type, []
        )
        if effective_role in transition_roles:
            result.append(t.to_status)

    return result