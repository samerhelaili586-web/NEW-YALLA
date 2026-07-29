from datetime import datetime, timezone
from app import db


class ErrorLog(db.Model):
    __tablename__ = "error_logs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    user_email = db.Column(db.String(255), nullable=True)
    user_role = db.Column(db.String(50), nullable=True)
    endpoint = db.Column(db.String(255), nullable=True)
    method = db.Column(db.String(10), nullable=True)
    status_code = db.Column(db.Integer, default=500)
    error_message = db.Column(db.Text, nullable=True)
    stack_trace = db.Column(db.Text, nullable=True)
    source = db.Column(db.String(20), default="backend")  # 'backend' or 'frontend'

    user = db.relationship("User", backref=db.backref("error_logs", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_id": self.user_id,
            "user_email": self.user_email or (self.user.email if self.user else "Anonyme"),
            "user_role": self.user_role or (self.user.role if self.user else "N/A"),
            "endpoint": self.endpoint or "N/A",
            "method": self.method or "GET",
            "status_code": self.status_code or 500,
            "error_message": self.error_message or "Aucun message",
            "stack_trace": self.stack_trace or "",
            "source": self.source or "backend",
        }
