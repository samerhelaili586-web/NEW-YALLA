from app import db


class Shoot(db.Model):
    __tablename__ = "shoots"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, unique=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey("equipment.id"), nullable=False)

    start_at = db.Column(db.DateTime, nullable=False)
    end_at = db.Column(db.DateTime, nullable=False)

    task = db.relationship("Task")
    equipment = db.relationship("Equipment")
    crew = db.relationship("ShootCrew", backref="shoot", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment.name if self.equipment else None,
            "start_at": self.start_at.isoformat(),
            "end_at": self.end_at.isoformat(),
            "crew": [c.user_id for c in self.crew],
        }


class ShootCrew(db.Model):
    """Prod users assigned to a shoot (used for the availability conflict check)."""
    __tablename__ = "shoot_crew"

    id = db.Column(db.Integer, primary_key=True)
    shoot_id = db.Column(db.Integer, db.ForeignKey("shoots.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    is_invited_only = db.Column(db.Boolean, default=False)  # CM/Manager invited, not crew

    user = db.relationship("User")