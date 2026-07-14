from datetime import datetime
from app import db

LEAVE_STATUSES = ("pending", "approved", "rejected", "auto_rejected")
SICK_JUSTIFICATION_STATUSES = ("pending", "justified", "unjustified")


class LeaveRequest(db.Model):
    __tablename__ = "leave_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text)

    status = db.Column(db.String(20), nullable=False, default="pending")  # LEAVE_STATUSES
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    decided_at = db.Column(db.DateTime)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": f"{self.user.first_name} {self.user.last_name}" if self.user else None,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "reason": self.reason,
            "status": self.status,
            "submitted_at": self.submitted_at.isoformat(),
        }


class SickAbsence(db.Model):
    __tablename__ = "sick_absences"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    absence_date = db.Column(db.Date, nullable=False)  # J, J-1, or J-2 only, enforced in route
    declared_at = db.Column(db.DateTime, default=datetime.utcnow)

    certificate_url = db.Column(db.String(255))
    certificate_uploaded_at = db.Column(db.DateTime)
    justification_status = db.Column(db.String(20), default="pending")  # SICK_JUSTIFICATION_STATUSES

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "absence_date": self.absence_date.isoformat(),
            "declared_at": self.declared_at.isoformat(),
            "certificate_url": self.certificate_url,
            "justification_status": self.justification_status,
        }


class Holiday(db.Model):
    __tablename__ = "holidays"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    label = db.Column(db.String(100), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    def to_dict(self):
        return {"id": self.id, "date": self.date.isoformat(), "label": self.label}
        