from functools import wraps
from flask import session, jsonify

# --- Menu access matrix (spec section 10.1) ---
MENU_ACCESS = {
    "gestion_utilisateurs": {"admin_sys"},
    "gestion_workflows": {"admin_sys"},
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
}

# --- Project/task action matrix (spec section 10.2) ---
ACTION_ACCESS = {
    "creer_projet": {"manager"},
    "modifier_projet": {"admin_sys", "manager"},
    "on_hold_projet": {"admin_sys", "manager"},
    "creer_tache": {"admin_sys", "manager", "cm"},
    "changer_statut_standard": {"admin_sys", "manager", "cm"},
    "forcer_statut": {"admin_sys", "manager"},
    "changer_statut_planification": {"admin_sys", "manager", "chef_prod"},
    "reporter_temps": {"cm", "prod", "chef_prod"},
    "ajouter_commentaire": {"admin_sys", "manager", "cm", "prod", "chef_prod"},
}


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


def require_menu(menu_key):
    """Decorator: 403 unless the current user's effective_role can see this menu."""
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = current_user()
            if user.effective_role not in MENU_ACCESS.get(menu_key, set()):
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_action(action_key):
    """Decorator: 403 unless the current user's effective_role can perform this action."""
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = current_user()
            if user.effective_role not in ACTION_ACCESS.get(action_key, set()):
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
            if user.effective_role not in roles:
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator