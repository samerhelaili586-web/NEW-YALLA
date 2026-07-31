from app import db


class ProjectTaskPermission(db.Model):
    """
    Per-project task creation permission overrides.
    Supports both role-based and user-specific controls.
    If no rows exist for a project, the global ACTION_ACCESS["creer_tache"] applies.
    """
    __tablename__ = "project_task_permissions"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)

    # Either role-based OR user-based (one must be set, not both):
    role_key = db.Column(db.String(50), nullable=True)                              # e.g. "cm"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    can_create = db.Column(db.Boolean, default=True, nullable=False)

    # Relationships
    project = db.relationship("Project", backref=db.backref("task_permissions", lazy="dynamic"))
    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "role_key": self.role_key,
            "user_id": self.user_id,
            "user_name": (
                f"{self.user.first_name} {self.user.last_name}" if self.user else None
            ),
            "can_create": self.can_create,
        }
