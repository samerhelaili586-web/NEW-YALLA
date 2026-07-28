from datetime import datetime, timezone
from app import db

ANNOUNCEMENT_PRIORITIES = ("info", "important", "urgent")


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default="info")  # info | important | urgent

    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = db.relationship("User", foreign_keys=[author_id])
    read_receipts = db.relationship("AnnouncementRead", backref="announcement", cascade="all, delete-orphan")

    def to_dict(self, current_user_id=None):
        receipt_user_ids = [r.user_id for r in self.read_receipts]
        is_read_by_me = current_user_id in receipt_user_ids if current_user_id else False

        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "priority": self.priority,
            "author_id": self.author_id,
            "author_name": f"{self.author.first_name} {self.author.last_name}" if self.author else "Administration",
            "author_role": self.author.effective_role if self.author else "admin_sys",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_read_by_me": is_read_by_me,
            "read_count": len(self.read_receipts),
        }


class AnnouncementRead(db.Model):
    __tablename__ = "announcement_reads"

    id = db.Column(db.Integer, primary_key=True)
    announcement_id = db.Column(db.Integer, db.ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "announcement_id": self.announcement_id,
            "user_id": self.user_id,
            "user_name": f"{self.user.first_name} {self.user.last_name}" if self.user else "Collaborateur",
            "user_role": self.user.effective_role if self.user else "prod",
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }
