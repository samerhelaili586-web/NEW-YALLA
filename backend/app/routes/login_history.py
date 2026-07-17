from flask import Blueprint, jsonify
from app.models.user import LoginHistory, User
from app.routes.auth import require_role

login_history_bp = Blueprint("login_history", __name__)

@login_history_bp.route("", methods=["GET"])
@require_role("admin_sys")
def get_login_history():
    """Get the login history of all users."""
    history = LoginHistory.query.order_by(LoginHistory.timestamp.desc()).limit(200).all()
    
    result = []
    for h in history:
        user = User.query.get(h.user_id)
        result.append({
            "id": h.id,
            "user_id": h.user_id,
            "user_name": f"{user.first_name} {user.last_name}" if user else "Unknown",
            "event": h.event,
            "timestamp": h.timestamp.isoformat()
        })
        
    return jsonify(result)
