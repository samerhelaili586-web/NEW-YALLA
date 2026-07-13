from datetime import datetime
from app import db

NOTIFICATION_TYPES = (
    "project_assigned", "leave_new", "certificate_uploaded",
    "leave_auto_rejected", "mention", "holiday_added",
)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(30), nullable=False)  # NOTIFICATION_TYPES
    message = db.Column(db.String(255), nullable=False)
    link_url = db.Column(db.String(255))  # e.g. deep link to a task's comment thread
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "message": self.message,
            "link_url": self.link_url,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }