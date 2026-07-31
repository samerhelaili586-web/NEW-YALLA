from flask import Blueprint, request, jsonify
from app import db
from app.models.project_permission import ProjectTaskPermission
from app.models.project import Project
from app.models.user import User
from app.permissions import login_required, require_role, current_user

project_permissions_bp = Blueprint("project_permissions", __name__)


@project_permissions_bp.get("/<int:project_id>/task-permissions")
@login_required
def get_project_permissions(project_id):
    """Get all task creation permission rules for a project."""
    Project.query.get_or_404(project_id)
    perms = ProjectTaskPermission.query.filter_by(project_id=project_id).all()
    return jsonify([p.to_dict() for p in perms])


@project_permissions_bp.put("/<int:project_id>/task-permissions")
@require_role("admin_sys", "manager")
def set_project_permissions(project_id):
    """
    Replace all task-creation permission rules for a project.
    Body: { "rules": [ { "role_key": "cm" | null, "user_id": 5 | null, "can_create": true } ] }
    """
    Project.query.get_or_404(project_id)
    data = request.get_json(force=True) or {}
    rules = data.get("rules", [])

    # Delete existing rules
    ProjectTaskPermission.query.filter_by(project_id=project_id).delete()
    db.session.flush()

    for rule in rules:
        role_key = rule.get("role_key")
        user_id = rule.get("user_id")
        can_create = bool(rule.get("can_create", True))

        # Validate: must have exactly one of role_key or user_id
        if not role_key and not user_id:
            continue
        if user_id and not User.query.get(user_id):
            continue

        perm = ProjectTaskPermission(
            project_id=project_id,
            role_key=role_key or None,
            user_id=user_id or None,
            can_create=can_create,
        )
        db.session.add(perm)

    db.session.commit()
    perms = ProjectTaskPermission.query.filter_by(project_id=project_id).all()
    return jsonify([p.to_dict() for p in perms])


@project_permissions_bp.get("/<int:project_id>/task-permissions/check")
@login_required
def check_can_create(project_id):
    """
    Check if the current user can create a task in this project.
    Returns { "can_create": true/false, "reason": "..." }
    """
    user = current_user()
    Project.query.get_or_404(project_id)

    perms = ProjectTaskPermission.query.filter_by(project_id=project_id).all()

    # No rules set → use global default (any role in creer_tache can create)
    if not perms:
        return jsonify({"can_create": True, "reason": "global_default"})

    # Check user-specific rules first (higher priority)
    for p in perms:
        if p.user_id == user.id:
            return jsonify({
                "can_create": p.can_create,
                "reason": "user_specific_rule",
            })

    # Check role-based rules
    for p in perms:
        if p.role_key and p.role_key == user.effective_role:
            return jsonify({
                "can_create": p.can_create,
                "reason": "role_rule",
            })

    # admin_sys and manager always bypass
    if user.effective_role in ("admin_sys", "manager"):
        return jsonify({"can_create": True, "reason": "admin_bypass"})

    # Rules exist but none match current user → deny
    return jsonify({"can_create": False, "reason": "no_matching_rule"})
