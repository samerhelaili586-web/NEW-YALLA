from flask import Blueprint, request, jsonify
from app import db
from app.models.custom_role import CustomRole
from app.permissions import login_required, require_role, current_user

custom_roles_bp = Blueprint("custom_roles", __name__)

# Keys available for menu/action permissions (mirrors permissions.py)
AVAILABLE_MENU_KEYS = [
    "gestion_utilisateurs", "gestion_workflows", "consulter_workflows",
    "gestion_materiel", "projets_tous", "projets_affectes", "taches_associees",
    "taches_montage", "planification", "feuille_presence_perso",
    "feuille_presence_equipe", "shooting_calendrier", "conges_absences",
    "approbation_conges", "annuaire", "salaires_paie",
]

AVAILABLE_ACTION_KEYS = [
    "creer_projet", "modifier_projet", "on_hold_projet", "creer_tache",
    "changer_statut_standard", "forcer_statut", "changer_statut_planification",
    "reporter_temps", "ajouter_commentaire", "gerer_salaires",
]


@custom_roles_bp.get("")
@login_required
def list_custom_roles():
    """List all non-archived custom roles."""
    include_archived = request.args.get("include_archived", "0") == "1"
    q = CustomRole.query
    if not include_archived:
        q = q.filter_by(is_archived=False)
    roles = q.order_by(CustomRole.id).all()
    return jsonify([r.to_dict() for r in roles])


@custom_roles_bp.get("/meta")
@login_required
def get_meta():
    """Return available menu and action permission keys."""
    return jsonify({
        "menu_keys": AVAILABLE_MENU_KEYS,
        "action_keys": AVAILABLE_ACTION_KEYS,
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
