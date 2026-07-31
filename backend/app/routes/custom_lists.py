from flask import Blueprint, request, jsonify
from app import db
from app.models.custom_list import CustomList, CustomListField, CustomListItem
from app.permissions import login_required, require_role

custom_lists_bp = Blueprint("custom_lists", __name__)


# ─── Lists CRUD ────────────────────────────────────────────────────────────────

@custom_lists_bp.get("")
@login_required
def list_custom_lists():
    include_archived = request.args.get("include_archived", "0") == "1"
    q = CustomList.query
    if not include_archived:
        q = q.filter_by(is_archived=False)
    lists = q.order_by(CustomList.id).all()
    return jsonify([lst.to_dict() for lst in lists])


@custom_lists_bp.get("/<int:list_id>")
@login_required
def get_custom_list(list_id):
    include_items = request.args.get("include_items", "0") == "1"
    lst = CustomList.query.get_or_404(list_id)
    return jsonify(lst.to_dict(include_items=include_items))


@custom_lists_bp.post("")
@require_role("admin_sys")
def create_custom_list():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    lst = CustomList(
        name=name,
        icon=data.get("icon", "📦"),
        description=data.get("description", ""),
    )
    db.session.add(lst)
    db.session.flush()

    # Create fields if provided
    for pos, field_data in enumerate(data.get("fields", [])):
        field = CustomListField(
            list_id=lst.id,
            key=_make_key(field_data.get("label", f"field_{pos}")),
            label=field_data.get("label", f"Champ {pos+1}"),
            field_type=field_data.get("field_type", "text"),
            options=field_data.get("options", []),
            is_required=field_data.get("is_required", False),
            position=pos,
        )
        db.session.add(field)

    db.session.commit()
    return jsonify(lst.to_dict()), 201


@custom_lists_bp.patch("/<int:list_id>")
@require_role("admin_sys")
def update_custom_list(list_id):
    lst = CustomList.query.get_or_404(list_id)
    data = request.get_json(force=True) or {}

    if "name" in data:
        lst.name = data["name"].strip()
    if "icon" in data:
        lst.icon = data["icon"]
    if "description" in data:
        lst.description = data["description"]

    # Replace fields if provided
    if "fields" in data:
        # Remove old fields
        CustomListField.query.filter_by(list_id=list_id).delete()
        db.session.flush()
        for pos, field_data in enumerate(data["fields"]):
            field = CustomListField(
                list_id=lst.id,
                key=field_data.get("key") or _make_key(field_data.get("label", f"field_{pos}")),
                label=field_data.get("label", f"Champ {pos+1}"),
                field_type=field_data.get("field_type", "text"),
                options=field_data.get("options", []),
                is_required=field_data.get("is_required", False),
                position=pos,
            )
            db.session.add(field)

    db.session.commit()
    return jsonify(lst.to_dict())


@custom_lists_bp.post("/<int:list_id>/archive")
@require_role("admin_sys")
def archive_custom_list(list_id):
    lst = CustomList.query.get_or_404(list_id)
    lst.is_archived = True
    db.session.commit()
    return jsonify({"ok": True})


@custom_lists_bp.post("/<int:list_id>/restore")
@require_role("admin_sys")
def restore_custom_list(list_id):
    lst = CustomList.query.get_or_404(list_id)
    lst.is_archived = False
    db.session.commit()
    return jsonify(lst.to_dict())


# ─── Items CRUD ────────────────────────────────────────────────────────────────

@custom_lists_bp.get("/<int:list_id>/items")
@login_required
def list_items(list_id):
    include_archived = request.args.get("include_archived", "0") == "1"
    q = CustomListItem.query.filter_by(list_id=list_id)
    if not include_archived:
        q = q.filter_by(is_archived=False)
    items = q.order_by(CustomListItem.id).all()
    return jsonify([item.to_dict() for item in items])


@custom_lists_bp.post("/<int:list_id>/items")
@login_required
def create_item(list_id):
    CustomList.query.get_or_404(list_id)  # ensure list exists
    data = request.get_json(force=True) or {}
    item_data = data.get("data", {})
    if not isinstance(item_data, dict):
        return jsonify({"error": "data must be an object"}), 400

    item = CustomListItem(list_id=list_id, data=item_data)
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@custom_lists_bp.patch("/<int:list_id>/items/<int:item_id>")
@login_required
def update_item(list_id, item_id):
    item = CustomListItem.query.filter_by(id=item_id, list_id=list_id).first_or_404()
    data = request.get_json(force=True) or {}
    if "data" in data:
        item.data = data["data"]
    db.session.commit()
    return jsonify(item.to_dict())


@custom_lists_bp.post("/<int:list_id>/items/<int:item_id>/archive")
@login_required
def archive_item(list_id, item_id):
    item = CustomListItem.query.filter_by(id=item_id, list_id=list_id).first_or_404()
    item.is_archived = True
    db.session.commit()
    return jsonify({"ok": True})


@custom_lists_bp.post("/<int:list_id>/items/<int:item_id>/restore")
@login_required
def restore_item(list_id, item_id):
    item = CustomListItem.query.filter_by(id=item_id, list_id=list_id).first_or_404()
    item.is_archived = False
    db.session.commit()
    return jsonify(item.to_dict())


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _make_key(label: str) -> str:
    """Convert a label to a snake_case key."""
    import re
    key = label.lower().strip()
    key = re.sub(r"[^a-z0-9\s_]", "", key)
    key = re.sub(r"\s+", "_", key)
    return key[:50] or "field"
