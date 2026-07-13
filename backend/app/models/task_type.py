from app import db

FUNCTIONAL_TYPES = (
    "debut", "intermediaire", "planification_shooting",
    "planification_montage", "montage", "final_confirmation", "final_rejet",
)
TEMPORAL_TYPES = ("evolutif", "fige")

# roles allowed to move OUT of a status, per functional_type default —
# actual allowed_roles is stored per-status but this documents the spec defaults
DEFAULT_ALLOWED_ROLES = {
    "debut": ["cm", "admin_sys", "manager"],
    "intermediaire": ["cm", "admin_sys", "manager"],
    "planification_shooting": ["chef_prod", "admin_sys", "manager"],
    "planification_montage": ["chef_prod", "admin_sys", "manager"],
    "montage": ["cm", "admin_sys", "manager"],
    "final_confirmation": [],
    "final_rejet": [],
}


class TaskType(db.Model):
    __tablename__ = "task_types"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)

    statuses = db.relationship("Status", backref="task_type", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_archived": self.is_archived,
            "statuses": [s.to_dict() for s in self.statuses],
        }


class Status(db.Model):
    __tablename__ = "statuses"

    id = db.Column(db.Integer, primary_key=True)
    task_type_id = db.Column(db.Integer, db.ForeignKey("task_types.id"), nullable=False)

    title = db.Column(db.String(80), nullable=False)
    temporal_type = db.Column(db.String(10), nullable=False)  # evolutif | fige
    functional_type = db.Column(db.String(30), nullable=False)  # FUNCTIONAL_TYPES
    allowed_roles = db.Column(db.JSON, nullable=False, default=list)  # e.g. ["cm","manager"]

    # position on the visual builder canvas (for react-flow)
    pos_x = db.Column(db.Float, default=0)
    pos_y = db.Column(db.Float, default=0)

    outgoing_transitions = db.relationship(
        "Transition",
        primaryjoin="Status.id == Transition.from_status_id",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "task_type_id": self.task_type_id,
            "title": self.title,
            "temporal_type": self.temporal_type,
            "functional_type": self.functional_type,
            "allowed_roles": self.allowed_roles,
            "pos_x": self.pos_x,
            "pos_y": self.pos_y,
        }


class Transition(db.Model):
    """Directed arrow: from_status -> to_status."""
    __tablename__ = "transitions"

    id = db.Column(db.Integer, primary_key=True)
    from_status_id = db.Column(db.Integer, db.ForeignKey("statuses.id"), nullable=False)
    to_status_id = db.Column(db.Integer, db.ForeignKey("statuses.id"), nullable=False)

    from_status = db.relationship("Status", foreign_keys=[from_status_id])
    to_status = db.relationship("Status", foreign_keys=[to_status_id])

    def to_dict(self):
        return {"id": self.id, "from_status_id": self.from_status_id, "to_status_id": self.to_status_id}