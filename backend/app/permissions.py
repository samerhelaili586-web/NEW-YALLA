from functools import wraps
from flask import session, jsonify

# --- Menu access matrix (spec section 10.1) ---
MENU_ACCESS = {
    "gestion_utilisateurs": {"admin_sys"},
    "gestion_workflows": {"admin_sys", "manager"},
    "consulter_workflows": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "gestion_materiel": {"admin_sys"},
    "projets_tous": {"admin_sys", "manager", "chef_prod"},
    "projets_affectes": {"cm"},
    "taches_associees": {"cm", "prod", "chef_prod"},
    "taches_montage": {"prod", "chef_prod"},
    "planification": {"chef_prod", "admin_sys", "manager"},
    "feuille_presence_perso": {"cm", "prod", "chef_prod"},
    "feuille_presence_equipe": {"admin_sys", "manager"},
    "shooting_calendrier": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "conges_absences": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "approbation_conges": {"manager"},
    "annuaire": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "salaires_paie": {"admin_sys"},
}

# --- Project/task action matrix (spec section 10.2) ---
ACTION_ACCESS = {
    "creer_projet": {"manager"},
    "modifier_projet": {"admin_sys", "manager"},
    "on_hold_projet": {"admin_sys", "manager"},
    "creer_tache": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "changer_statut_standard": {"admin_sys", "manager", "cm"},
    "forcer_statut": {"admin_sys", "manager"},
    "changer_statut_planification": {"admin_sys", "manager", "chef_prod"},
    "reporter_temps": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "ajouter_commentaire": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
    "gerer_salaires": {"admin_sys"},
}


# Dynamic registries for permission keys (auto-discovered on decorator usage or matrix keys)
REGISTERED_MENU_KEYS = set(MENU_ACCESS.keys())
REGISTERED_ACTION_KEYS = set(ACTION_ACCESS.keys())


def get_available_menu_keys():
    """Return sorted list of all dynamically registered and matrix-defined menu permission keys."""
    return sorted(list(REGISTERED_MENU_KEYS | set(MENU_ACCESS.keys())))


def get_available_action_keys():
    """Return sorted list of all dynamically registered and matrix-defined action permission keys."""
    return sorted(list(REGISTERED_ACTION_KEYS | set(ACTION_ACCESS.keys())))


def current_user():
    from app.models.user import User
    uid = session.get("user_id")
    if not uid:
        return None
    return User.query.get(uid)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or not user.is_active or user.is_archived:
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


def user_has_menu(user, menu_key):
    if not user:
        return False
    if user.effective_role in ("admin_sys", "manager"):
        return True
    if user.effective_role in MENU_ACCESS.get(menu_key, set()):
        return True
    from app.models.custom_role import CustomRole
    crole = CustomRole.query.filter_by(key=user.effective_role, is_archived=False).first()
    if crole and menu_key in (crole.menu_permissions or []):
        return True
    return False


def user_has_action(user, action_key):
    if not user:
        return False
    if user.effective_role in ("admin_sys", "manager"):
        return True
    if user.effective_role in ACTION_ACCESS.get(action_key, set()):
        return True
    from app.models.custom_role import CustomRole
    crole = CustomRole.query.filter_by(key=user.effective_role, is_archived=False).first()
    if crole and action_key in (crole.action_permissions or []):
        return True
    return False


def require_menu(menu_key):
    """Decorator: 403 unless the current user's effective_role can see this menu. Auto-registers menu_key."""
    REGISTERED_MENU_KEYS.add(menu_key)
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user_has_menu(user, menu_key):
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_action(action_key):
    """Decorator: 403 unless the current user's effective_role can perform this action. Auto-registers action_key."""
    REGISTERED_ACTION_KEYS.add(action_key)
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user_has_action(user, action_key):
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_role(*roles):
    """Decorator for simple role gates not tied to a menu/action key."""
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = current_user()
            if user.effective_role in ("admin_sys", "manager"):
                return fn(*args, **kwargs)
            if user.effective_role not in roles:
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator