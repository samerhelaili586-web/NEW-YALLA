from datetime import datetime
from app import db


class CustomRole(db.Model):
    __tablename__ = "custom_roles"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)    # "cm", "chauffeur", etc.
    label = db.Column(db.String(80), nullable=False)               # "Community Manager"
    color = db.Column(db.String(7), default="#6366f1")             # hex color for UI badge
    is_builtin = db.Column(db.Boolean, default=False, nullable=False)  # builtins cannot be deleted
    participates_in_workflow = db.Column(db.Boolean, default=True, nullable=False)
    # "all" | "actionable" | "upcoming"
    visibility_mode = db.Column(db.String(20), nullable=False, default="all")
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # JSON list of MENU_ACCESS keys granted to this role
    menu_permissions = db.Column(db.JSON, nullable=False, default=list)
    # JSON list of ACTION_ACCESS keys granted to this role
    action_permissions = db.Column(db.JSON, nullable=False, default=list)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "label": self.label,
            "color": self.color,
            "is_builtin": self.is_builtin,
            "participates_in_workflow": self.participates_in_workflow,
            "visibility_mode": self.visibility_mode,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "menu_permissions": self.menu_permissions or [],
            "action_permissions": self.action_permissions or [],
        }
