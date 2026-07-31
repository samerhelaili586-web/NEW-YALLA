from flask import Blueprint, request, jsonify
from app import db
from app.models.custom_role import CustomRole
from app.permissions import login_required, require_role, current_user, get_available_menu_keys, get_available_action_keys

custom_roles_bp = Blueprint("custom_roles", __name__)


@custom_roles_bp.get("")
@login_required
def list_custom_roles():
    """List custom roles with active user count per role."""
    include_archived = request.args.get("include_archived", "0") == "1"
    q = CustomRole.query
    if not include_archived:
        q = q.filter_by(is_archived=False)
    roles = q.order_by(CustomRole.id).all()

    from app.models.user import User
    users = User.query.filter_by(is_archived=False).all()
    role_user_counts = {}
    for u in users:
        eff = u.effective_role
        role_user_counts[eff] = role_user_counts.get(eff, 0) + 1

    res = []
    for r in roles:
        d = r.to_dict()
        d["user_count"] = role_user_counts.get(r.key, 0)
        res.append(d)

    return jsonify(res)


@custom_roles_bp.get("/meta")
@login_required
def get_meta():
    """Return available menu and action permission keys dynamically generated from app.permissions."""
    return jsonify({
        "menu_keys": get_available_menu_keys(),
        "action_keys": get_available_action_keys(),
    })


@custom_roles_bp.post("")
@require_role("admin_sys")
def create_custom_role():
    """Create a new custom role."""
    data = request.get_json(force=True) or {}
    key = (data.get("key") or "").strip().lower().replace(" ", "_")
    label = (data.get("label") or "").strip()

    if not key or not label:
        return jsonify({"error": "key and label are required"}), 400

    # key must be unique and not clash with builtins
    if CustomRole.query.filter_by(key=key).first():
        return jsonify({"error": f"Role key '{key}' already exists"}), 409

    role = CustomRole(
        key=key,
        label=label,
        color=data.get("color", "#6366f1"),
        is_builtin=False,
        participates_in_workflow=data.get("participates_in_workflow", True),
        visibility_mode=data.get("visibility_mode", "all"),
        menu_permissions=data.get("menu_permissions", []),
        action_permissions=data.get("action_permissions", []),
    )
    db.session.add(role)
    db.session.commit()
    return jsonify(role.to_dict()), 201


@custom_roles_bp.patch("/<int:role_id>")
@require_role("admin_sys")
def update_custom_role(role_id):
    """Update a custom role (label, color, permissions, visibility_mode)."""
    role = CustomRole.query.get_or_404(role_id)
    data = request.get_json(force=True) or {}

    if "label" in data:
        role.label = data["label"].strip()
    if "color" in data:
        role.color = data["color"]
    if "visibility_mode" in data:
        if data["visibility_mode"] not in ("all", "actionable", "upcoming"):
            return jsonify({"error": "Invalid visibility_mode"}), 400
        role.visibility_mode = data["visibility_mode"]
    if "participates_in_workflow" in data:
        role.participates_in_workflow = bool(data["participates_in_workflow"])
    if "menu_permissions" in data:
        role.menu_permissions = data["menu_permissions"]
    if "action_permissions" in data:
        role.action_permissions = data["action_permissions"]

    db.session.commit()
    return jsonify(role.to_dict())


@custom_roles_bp.post("/<int:role_id>/archive")
@require_role("admin_sys")
def archive_custom_role(role_id):
    """Archive a role (never delete — soft delete only)."""
    role = CustomRole.query.get_or_404(role_id)
    if role.is_builtin:
        return jsonify({"error": "Built-in roles cannot be archived"}), 403
    role.is_archived = True
    db.session.commit()
    return jsonify({"ok": True})


@custom_roles_bp.post("/<int:role_id>/restore")
@require_role("admin_sys")
def restore_custom_role(role_id):
    """Restore an archived custom role."""
    role = CustomRole.query.get_or_404(role_id)
    role.is_archived = False
    db.session.commit()
    return jsonify(role.to_dict())
