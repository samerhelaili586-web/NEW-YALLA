from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, ROLES
from app.permissions import require_menu, require_role, login_required

users_bp = Blueprint("users", __name__)


# ---------- Company directory (all active users, all roles can view) ----------
@users_bp.get("/directory")
@login_required
def directory():
    users = User.query.filter_by(is_archived=False, is_active=True).all()
    return jsonify([u.to_dict(minimal=True) for u in users])


# ---------- Admin Sys: full user management ----------
@users_bp.get("")
@require_menu("gestion_utilisateurs")
def list_users():
    users = User.query.order_by(User.last_name).all()
    return jsonify([u.to_dict() for u in users])


@users_bp.post("")
@require_menu("gestion_utilisateurs")
def create_user():
    data = request.get_json(force=True) or {}
    required = ["first_name", "last_name", "email", "role", "password"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    if data["role"] not in ROLES:
        return jsonify({"error": "invalid_role"}), 400

    if User.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"error": "email_taken"}), 409

    user = User(
        first_name=data["first_name"],
        last_name=data["last_name"],
        email=data["email"].strip().lower(),
        phone=data.get("phone"),
        photo_url=data.get("photo_url"),
        role=data["role"],
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    if data.get("is_chef_prod") and user.role == "prod":
        _set_chef_prod(user.id)

    return jsonify({"user": user.to_dict()}), 201


@users_bp.patch("/<int:user_id>")
@require_menu("gestion_utilisateurs")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(force=True) or {}

    for field in ("first_name", "last_name", "phone", "photo_url"):
        if field in data:
            setattr(user, field, data[field])

    if "email" in data:
        new_email = data["email"].strip().lower()
        existing = User.query.filter_by(email=new_email).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "email_taken"}), 409
        user.email = new_email

    if "role" in data:
        if data["role"] not in ROLES:
            return jsonify({"error": "invalid_role"}), 400
        user.role = data["role"]
        if user.role != "prod":
            user.is_chef_prod = False  # can't hold the flag if no longer Prod

    if "password" in data and data["password"]:
        user.set_password(data["password"])

    # Validate is_chef_prod BEFORE committing, so role change + chef flag are atomic
    if "is_chef_prod" in data:
        if data["is_chef_prod"]:
            if user.role != "prod":
                return jsonify({"error": "chef_prod_requires_prod_role"}), 400
            # Unset any previous holder without committing yet
            User.query.filter(User.id != user.id, User.is_chef_prod.is_(True)).update(
                {"is_chef_prod": False}
            )
            user.is_chef_prod = True
        else:
            user.is_chef_prod = False

    # Single commit for all changes
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/archive")
@require_menu("gestion_utilisateurs")
def archive_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_archived = True
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/deactivate")
@require_menu("gestion_utilisateurs")
def deactivate_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/activate")
@require_menu("gestion_utilisateurs")
def activate_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict()})


# NOTE: no delete endpoint — spec §2.4 forbids hard-deleting user accounts, ever.


def _set_chef_prod(user_id):
    """Enforce: exactly one Prod user can hold the Chef Prod flag at a time.
    Setting it on user_id automatically unsets it from any previous holder."""
    User.query.filter(User.id != user_id, User.is_chef_prod.is_(True)).update(
        {"is_chef_prod": False}
    )
    target = User.query.get(user_id)
    target.is_chef_prod = True
    db.session.commit()