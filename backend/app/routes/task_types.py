from flask import Blueprint, request, jsonify
from app import db
from app.models.task_type import TaskType, Status, Transition, FUNCTIONAL_TYPES, TEMPORAL_TYPES
from app.models.task import Task
from app.permissions import require_menu, login_required

task_types_bp = Blueprint("task_types", __name__)

FINAL_TYPES = ("final_confirmation", "final_rejet")


# ---------- Read (any logged-in user needs this to see task type options) ----------
@task_types_bp.get("")
@login_required
def list_task_types():
    include_archived = request.args.get("include_archived") == "1"
    q = TaskType.query
    if not include_archived:
        q = q.filter_by(is_archived=False)
    return jsonify([tt.to_dict() for tt in q.all()])


@task_types_bp.get("/<int:task_type_id>")
@login_required
def get_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    return jsonify(tt.to_dict())


# ---------- Admin Sys: workflow builder CRUD ----------
@task_types_bp.post("")
@require_menu("gestion_workflows")
def create_task_type():
    data = request.get_json(force=True) or {}
    if not data.get("name"):
        return jsonify({"error": "name_required"}), 400
    tt = TaskType(name=data["name"])
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
    db.session.commit()
    return jsonify(tt.to_dict())


@task_types_bp.post("/<int:task_type_id>/archive")
@require_menu("gestion_workflows")
def archive_task_type(task_type_id):
    tt = TaskType.query.get_or_404(task_type_id)
    tt.is_archived = True
    db.session.commit()
    return jsonify(tt.to_dict())


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

    required = ["title", "temporal_type", "functional_type", "allowed_roles"]
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
        allowed_roles=data["allowed_roles"],
        pos_x=data.get("pos_x", 0),
        pos_y=data.get("pos_y", 0),
    )
    db.session.add(status)
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

    transition = Transition(from_status_id=from_id, to_status_id=to_id)
    db.session.add(transition)
    db.session.commit()
    return jsonify(transition.to_dict()), 201


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
    transition are offered. Manager/Admin Sys get a dérogation — the FULL
    status list for the task type, ignoring the transition graph.
    """
    if effective_role in ("manager", "admin_sys"):
        return Status.query.filter_by(task_type_id=current_status.task_type_id).all()

    return [t.to_status for t in current_status.outgoing_transitions]