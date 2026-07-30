from flask import Blueprint, request, jsonify
from app.models.system_setting import SystemSetting
from app.permissions import require_role, login_required
from app import db

settings_bp = Blueprint("settings", __name__)

@settings_bp.get("")
@login_required
@require_role("admin_sys")
def list_settings():
    settings = SystemSetting.query.all()
    return jsonify([s.to_dict() for s in settings])

@settings_bp.put("/<string:key>")
@login_required
@require_role("admin_sys")
def update_setting(key):
    data = request.get_json(force=True) or {}
    val = data.get("value")
    if val is None:
        return jsonify({"error": "value_required"}), 400

    setting = SystemSetting.query.get(key)
    if not setting:
        return jsonify({"error": "setting_not_found"}), 404

    setting.value = str(val)
    db.session.commit()
    return jsonify(setting.to_dict())
