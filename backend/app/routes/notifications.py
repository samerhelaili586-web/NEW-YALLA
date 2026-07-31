from flask import Blueprint, jsonify
from app import db
from app.models.notification import Notification
from app.permissions import login_required, current_user

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("")
@login_required
def list_notifications():
    user = current_user()
    notifs = Notification.query.filter_by(user_id=user.id).order_by(
        Notification.created_at.desc()
    ).limit(100).all()
    return jsonify([n.to_dict() for n in notifs])


@notifications_bp.get("/unread-count")
@login_required
def unread_count():
    user = current_user()
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({"count": count})


@notifications_bp.post("/<int:notification_id>/read")
@login_required
def mark_read(notification_id):
    user = current_user()
    notif = Notification.query.filter_by(id=notification_id, user_id=user.id).first_or_404()
    notif.is_read = True
    db.session.commit()
    return jsonify(notif.to_dict())


@notifications_bp.post("/mark-all-read")
@login_required
def mark_all_read():
    user = current_user()
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


@notifications_bp.post("/<int:notification_id>/toggle-lock")
@login_required
def toggle_lock(notification_id):
    user = current_user()
    notif = Notification.query.filter_by(id=notification_id, user_id=user.id).first_or_404()
    notif.is_locked = not getattr(notif, "is_locked", False)
    db.session.commit()
    return jsonify(notif.to_dict())


@notifications_bp.delete("/clear-all")
@login_required
def clear_all_notifications():
    """Delete all non-locked notifications for the current user."""
    user = current_user()
    Notification.query.filter(
        Notification.user_id == user.id,
        Notification.is_locked.is_(False)
    ).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"ok": True})


DEFAULT_NOTIFICATION_SETTINGS = {
    "notif_status_transition_enabled": "true",
    "notif_project_assigned_enabled": "true",
    "notif_shooting_planned_enabled": "true",
    "notif_attendance_reminder_enabled": "true",
    "notif_leave_requests_enabled": "true",
    "notif_announcements_enabled": "true",
    "notif_retention_days": "14",
}


@notifications_bp.get("/settings")
@login_required
def get_notification_settings():
    from app.models.system_setting import SystemSetting
    settings = {}
    for key, default in DEFAULT_NOTIFICATION_SETTINGS.items():
        settings[key] = SystemSetting.get_val(key, default)
    return jsonify(settings)


@notifications_bp.put("/settings")
@login_required
def update_notification_settings():
    from flask import request
    from app.models.system_setting import SystemSetting
    user = current_user()
    if user.effective_role not in ("admin_sys", "manager"):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(force=True) or {}

    for key in DEFAULT_NOTIFICATION_SETTINGS.keys():
        if key in data:
            val = data[key]
            if isinstance(val, bool):
                val = "true" if val else "false"
            SystemSetting.set_val(key, str(val))

    db.session.commit()
    settings = {}
    for key, default in DEFAULT_NOTIFICATION_SETTINGS.items():
        settings[key] = SystemSetting.get_val(key, default)
    return jsonify(settings)