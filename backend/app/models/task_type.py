from datetime import datetime, timezone
from app import db

FUNCTIONAL_TYPES = (
    "debut", "intermediaire", "planification_shooting",
    "planification_montage", "montage", "final_confirmation", "final_rejet",
)
TEMPORAL_TYPES = ("evolutif", "fige")

WORKFLOW_STATUSES = ("draft", "active", "disabled")

# Legacy fallback: roles allowed to move OUT of a status, per functional_type.
# Kept for backward-compat when a Transition has no explicit allowed_roles set.
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
    description = db.Column(db.String(255), nullable=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)

    # Workflow lifecycle status: draft | active | disabled
    workflow_status = db.Column(db.String(10), nullable=False, default="draft")

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    statuses = db.relationship("Status", backref="task_type", cascade="all, delete-orphan")

    def to_dict(self, include_statuses=True):
        step_count = len(self.statuses)
        transition_count = sum(len(s.outgoing_transitions) for s in self.statuses)
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_archived": self.is_archived,
            "workflow_status": self.workflow_status,
            "step_count": step_count,
            "transition_count": transition_count,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_statuses:
            d["statuses"] = [s.to_dict() for s in self.statuses]
        return d


class Status(db.Model):
    __tablename__ = "statuses"

    id = db.Column(db.Integer, primary_key=True)
    task_type_id = db.Column(db.Integer, db.ForeignKey("task_types.id"), nullable=False)

    title = db.Column(db.String(80), nullable=False)
    temporal_type = db.Column(db.String(10), nullable=False)  # evolutif | fige
    functional_type = db.Column(db.String(30), nullable=False)  # FUNCTIONAL_TYPES

    # "Roles participants" -- who can REPORT TIME while task is in this status.
    # Intentionally separate from transition.allowed_roles (who can TRIGGER a transition).
    allowed_roles = db.Column(db.JSON, nullable=False, default=list)

    # position on the visual builder canvas
    pos_x = db.Column(db.Float, default=100)
    pos_y = db.Column(db.Float, default=100)

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
            "outgoing_transitions": [t.to_dict() for t in self.outgoing_transitions],
        }


class Transition(db.Model):
    """Directed arrow: from_status -> to_status."""
    __tablename__ = "transitions"

    id = db.Column(db.Integer, primary_key=True)
    from_status_id = db.Column(db.Integer, db.ForeignKey("statuses.id"), nullable=False)
    to_status_id = db.Column(db.Integer, db.ForeignKey("statuses.id"), nullable=False)

    # Roles that can TRIGGER this specific transition.
    # Empty list [] = only Manager/Admin Sys can use it (their override always applies).
    allowed_roles = db.Column(db.JSON, nullable=False, default=list)

    # Optional per-transition form fields definition.
    # Each item: {"id": str, "type": "text"|"number"|"date"|"select", "label": str}
    form_fields = db.Column(db.JSON, nullable=False, default=list)

    from_status = db.relationship("Status", foreign_keys=[from_status_id])
    to_status = db.relationship("Status", foreign_keys=[to_status_id])

    def to_dict(self):
        return {
            "id": self.id,
            "from_status_id": self.from_status_id,
            "to_status_id": self.to_status_id,
            "from_status_title": self.from_status.title if self.from_status else None,
            "to_status_title": self.to_status.title if self.to_status else None,
            "allowed_roles": self.allowed_roles if self.allowed_roles is not None else [],
            "form_fields": self.form_fields if self.form_fields is not None else [],
        }