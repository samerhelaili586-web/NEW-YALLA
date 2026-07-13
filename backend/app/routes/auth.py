from datetime import datetime
from flask import Blueprint, request, session, jsonify
from app import db
from app.models.user import User, LoginHistory
from app.permissions import login_required, current_user, require_role

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    data = request.get_json(force=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "invalid_credentials"}), 401
    if user.is_archived or not user.is_active:
        return jsonify({"error": "account_disabled"}), 403

    session.permanent = True
    session["user_id"] = user.id

    db.session.add(LoginHistory(user_id=user.id, event="login"))
    db.session.commit()

    return jsonify({"user": user.to_dict()})


@auth_bp.post("/logout")
@login_required
def logout():
    user = current_user()
    db.session.add(LoginHistory(user_id=user.id, event="logout"))
    db.session.commit()
    session.clear()
    return jsonify({"ok": True})


@auth_bp.get("/me")
@login_required
def me():
    return jsonify({"user": current_user().to_dict()})


@auth_bp.get("/login-history")
@require_role("admin_sys")
def login_history():
    events = LoginHistory.query.order_by(LoginHistory.timestamp.desc()).limit(500).all()
    return jsonify([
        {
            "id": e.id,
            "user_id": e.user_id,
            "user_name": f"{e.user.first_name} {e.user.last_name}" if e.user else None,
            "event": e.event,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events
    ])