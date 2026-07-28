from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db
from app.models.announcement import Announcement, AnnouncementRead
from app.models.user import User
from app.models.notification import Notification
from app.permissions import login_required, current_user

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.get("")
@login_required
def list_announcements():
    user = current_user()
    items = Announcement.query.order_by(Announcement.created_at.desc()).all()
    active_users_count = User.query.filter_by(is_archived=False, is_active=True).count()

    result = []
    for item in items:
        d = item.to_dict(current_user_id=user.id)
        d["total_users_count"] = active_users_count
        result.append(d)

    return jsonify(result)


@announcements_bp.get("/<int:id>")
@login_required
def get_announcement_detail(id):
    user = current_user()
    announcement = Announcement.query.get_or_404(id)

    # Auto-mark as read if not already read by current user
    existing = AnnouncementRead.query.filter_by(announcement_id=id, user_id=user.id).first()
    if not existing:
        receipt = AnnouncementRead(announcement_id=id, user_id=user.id, read_at=datetime.now(timezone.utc))
        db.session.add(receipt)
        db.session.commit()

    all_users = User.query.filter_by(is_archived=False, is_active=True).all()
    read_receipts = AnnouncementRead.query.filter_by(announcement_id=id).all()
    read_map = {r.user_id: r.read_at for r in read_receipts}

    reads = []
    unread_users = []

    for u in all_users:
        if u.id in read_map:
            reads.append({
                "user_id": u.id,
                "user_name": f"{u.first_name} {u.last_name}",
                "role": u.effective_role,
                "read_at": read_map[u.id].isoformat() if read_map[u.id] else None,
            })
        else:
            unread_users.append({
                "user_id": u.id,
                "user_name": f"{u.first_name} {u.last_name}",
                "role": u.effective_role,
            })

    d = announcement.to_dict(current_user_id=user.id)
    d["reads"] = sorted(reads, key=lambda x: x["read_at"] or "", reverse=True)
    d["unread_users"] = unread_users
    d["total_users_count"] = len(all_users)

    return jsonify(d)


@announcements_bp.post("")
@login_required
def create_announcement():
    user = current_user()
    if user.effective_role not in ("admin_sys", "manager"):
        return jsonify({"error": "forbidden", "detail": "Seuls les administrateurs et managers peuvent créer un communiqué."}), 403

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    priority = (data.get("priority") or "info").strip()

    if not title or not content:
        return jsonify({"error": "missing_fields", "detail": "Le titre et le contenu sont obligatoires."}), 400

    announcement = Announcement(
        title=title,
        content=content,
        priority=priority if priority in ("info", "important", "urgent") else "info",
        author_id=user.id,
    )
    db.session.add(announcement)
    db.session.flush()

    # Automatically mark as read by author
    author_read = AnnouncementRead(announcement_id=announcement.id, user_id=user.id)
    db.session.add(author_read)

    # Broadcast notification to ALL active users
    active_users = User.query.filter_by(is_archived=False, is_active=True).all()
    priority_icon = "🚨" if priority == "urgent" else "⚠️" if priority == "important" else "📢"

    for u in active_users:
        if u.id != user.id:
            db.session.add(Notification(
                user_id=u.id,
                type="announcement",
                message=f"{priority_icon} Communiqué Officiel : {title}",
                link_url="/announcements",
            ))

    db.session.commit()
    return jsonify(announcement.to_dict(current_user_id=user.id)), 201


@announcements_bp.post("/<int:id>/read")
@login_required
def mark_as_read(id):
    user = current_user()
    announcement = Announcement.query.get_or_404(id)

    existing = AnnouncementRead.query.filter_by(announcement_id=id, user_id=user.id).first()
    if not existing:
        receipt = AnnouncementRead(announcement_id=id, user_id=user.id, read_at=datetime.now(timezone.utc))
        db.session.add(receipt)
        db.session.commit()

    return jsonify({"ok": True, "read_at": datetime.now(timezone.utc).isoformat()})


@announcements_bp.put("/<int:id>")
@login_required
def update_announcement(id):
    user = current_user()
    if user.effective_role not in ("admin_sys", "manager"):
        return jsonify({"error": "forbidden"}), 403

    announcement = Announcement.query.get_or_404(id)
    data = request.get_json(force=True) or {}

    if "title" in data:
        announcement.title = data["title"].strip()
    if "content" in data:
        announcement.content = data["content"].strip()
    if "priority" in data:
        announcement.priority = data["priority"]

    db.session.commit()
    return jsonify(announcement.to_dict(current_user_id=user.id))


@announcements_bp.delete("/<int:id>")
@login_required
def delete_announcement(id):
    user = current_user()
    if user.effective_role not in ("admin_sys", "manager"):
        return jsonify({"error": "forbidden"}), 403

    announcement = Announcement.query.get_or_404(id)
    db.session.delete(announcement)
    db.session.commit()

    return jsonify({"ok": True})
