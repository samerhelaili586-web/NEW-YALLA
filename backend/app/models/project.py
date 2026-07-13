from datetime import datetime
from app import db

PROJECT_STATUSES = ("actif", "on_hold", "termine")


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    start_date = db.Column(db.Date, nullable=False)  # can be in the past
    remarks = db.Column(db.Text)

    cm_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="actif")  # PROJECT_STATUSES

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    cm = db.relationship("User", foreign_keys=[cm_id])
    monthly_targets = db.relationship(
        "ProjectMonthlyTarget", backref="project", cascade="all, delete-orphan"
    )
    tasks = db.relationship("Task", backref="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "start_date": self.start_date.isoformat(),
            "remarks": self.remarks,
            "cm_id": self.cm_id,
            "cm_name": f"{self.cm.first_name} {self.cm.last_name}" if self.cm else None,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "monthly_targets": [t.to_dict() for t in self.monthly_targets],
        }


class ProjectMonthlyTarget(db.Model):
    """Fréquence mensuelle par type de tâche — one row per task type on a project."""
    __tablename__ = "project_monthly_targets"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    task_type_id = db.Column(db.Integer, db.ForeignKey("task_types.id"), nullable=False)
    monthly_count = db.Column(db.Integer, nullable=False, default=0)

    task_type = db.relationship("TaskType")

    def to_dict(self):
        return {
            "task_type_id": self.task_type_id,
            "task_type_name": self.task_type.name if self.task_type else None,
            "monthly_count": self.monthly_count,
        }