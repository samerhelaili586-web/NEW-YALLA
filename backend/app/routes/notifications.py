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