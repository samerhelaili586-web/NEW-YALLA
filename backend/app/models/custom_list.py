from datetime import datetime
from app import db


class CustomList(db.Model):
    __tablename__ = "custom_lists"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(10), default="📦")
    description = db.Column(db.Text, nullable=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    fields = db.relationship(
        "CustomListField",
        backref="custom_list",
        cascade="all, delete-orphan",
        order_by="CustomListField.position",
    )
    items = db.relationship(
        "CustomListItem",
        backref="custom_list",
        cascade="all, delete-orphan",
        order_by="CustomListItem.id",
    )

    def to_dict(self, include_items=False):
        d = {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "description": self.description,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "fields": [f.to_dict() for f in self.fields],
            "item_count": len([i for i in self.items if not i.is_archived]),
        }
        if include_items:
            d["items"] = [i.to_dict() for i in self.items if not i.is_archived]
        return d


class CustomListField(db.Model):
    __tablename__ = "custom_list_fields"

    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey("custom_lists.id"), nullable=False)
    key = db.Column(db.String(50), nullable=False)       # internal key (snake_case)
    label = db.Column(db.String(80), nullable=False)     # human-readable label
    # text | number | date | select | image
    field_type = db.Column(db.String(20), nullable=False, default="text")
    # for field_type = "select": list of option strings
    options = db.Column(db.JSON, nullable=False, default=list)
    is_required = db.Column(db.Boolean, default=False, nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "list_id": self.list_id,
            "key": self.key,
            "label": self.label,
            "field_type": self.field_type,
            "options": self.options or [],
            "is_required": self.is_required,
            "position": self.position,
        }


class CustomListItem(db.Model):
    __tablename__ = "custom_list_items"

    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey("custom_lists.id"), nullable=False)
    # Dynamic data: {field_key: value}
    data = db.Column(db.JSON, nullable=False, default=dict)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "list_id": self.list_id,
            "data": self.data or {},
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
