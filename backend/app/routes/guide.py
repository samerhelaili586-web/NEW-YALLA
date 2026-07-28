from flask import Blueprint, jsonify, request
from app import db
from app.models.guide_page import GuidePage, DEFAULT_GUIDE_CONTENT
from app.permissions import login_required, current_user

guide_bp = Blueprint("guide", __name__)


def _get_or_create_guide():
    try:
        guide = GuidePage.query.first()
    except Exception:
        db.session.rollback()
        db.create_all()
        guide = GuidePage.query.first()

    if not guide:
        guide = GuidePage(
            title="Guide & Workflow d'équipe",
            content=DEFAULT_GUIDE_CONTENT,
            is_visible=True,
        )
        db.session.add(guide)
        db.session.commit()
    return guide


@guide_bp.get("")
@login_required
def get_guide():
    guide = _get_or_create_guide()
    user = current_user()
    is_admin = user.effective_role == "admin_sys"

    # Non-admins cannot view if guide is hidden by admin
    if not guide.is_visible and not is_admin:
        return jsonify({"error": "guide_hidden", "is_visible": False}), 403

    return jsonify(guide.to_dict())


@guide_bp.put("")
@login_required
def update_guide():
    user = current_user()
    if user.effective_role != "admin_sys":
        return jsonify({"error": "forbidden"}), 403

    guide = _get_or_create_guide()
    data = request.get_json(force=True) or {}

    if "title" in data and isinstance(data["title"], str) and data["title"].strip():
        guide.title = data["title"].strip()
    if "content" in data and isinstance(data["content"], str):
        guide.content = data["content"]
    if "steps" in data and isinstance(data["steps"], list):
        guide.steps = data["steps"]
    if "is_visible" in data:
        guide.is_visible = bool(data["is_visible"])

    db.session.commit()
    return jsonify(guide.to_dict())
