from flask import Blueprint, request, jsonify
from app import db
from app.models.equipment import Equipment
from app.models.shoot import Shoot
from app.permissions import require_menu, login_required

equipment_bp = Blueprint("equipment", __name__)


# ---------- Read (any logged-in user: Chef Prod needs the active list when
# planning a shooting §5.1.1, and the Shooting calendar §5.4 is visible to all) ----------
@equipment_bp.get("")
@login_required
def list_equipment():
    active_only = request.args.get("active_only") == "1"
    q = Equipment.query
    if active_only:
        q = q.filter_by(is_active=True)
    return jsonify([e.to_dict() for e in q.order_by(Equipment.name).all()])


@equipment_bp.get("/<int:equipment_id>")
@login_required
def get_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    return jsonify(equipment.to_dict())


# ---------- Admin Sys: inventory management (spec §3.2) ----------
@equipment_bp.post("")
@require_menu("gestion_materiel")
def create_equipment():
    data = request.get_json(force=True) or {}
    if not data.get("name"):
        return jsonify({"error": "name_required"}), 400

    equipment = Equipment(
        name=data["name"],
        description=data.get("description"),
        image_url=data.get("image_url"),
    )
    db.session.add(equipment)
    db.session.commit()
    return jsonify(equipment.to_dict()), 201


@equipment_bp.patch("/<int:equipment_id>")
@require_menu("gestion_materiel")
def update_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    data = request.get_json(force=True) or {}

    for field in ("name", "description", "image_url"):
        if field in data:
            setattr(equipment, field, data[field])

    db.session.commit()
    return jsonify(equipment.to_dict())


@equipment_bp.post("/<int:equipment_id>/deactivate")
@require_menu("gestion_materiel")
def deactivate_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    equipment.is_active = False
    db.session.commit()
    return jsonify(equipment.to_dict())


@equipment_bp.post("/<int:equipment_id>/activate")
@require_menu("gestion_materiel")
def activate_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    equipment.is_active = True
    db.session.commit()
    return jsonify(equipment.to_dict())


@equipment_bp.delete("/<int:equipment_id>")
@require_menu("gestion_materiel")
def delete_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    # spec §3.2 / §9.2: hard delete is forbidden once used in a project (ever, past or future)
    in_use = Shoot.query.filter_by(equipment_id=equipment.id).first() is not None
    if in_use:
        return jsonify({"error": "equipment_in_use"}), 409
    db.session.delete(equipment)
    db.session.commit()
    return jsonify({"ok": True})


# ---------- Availability check, used by planification.py when the Chef Prod
# picks equipment for a shooting (spec §5.1.1: conflict warning must block validation) ----------
@equipment_bp.get("/<int:equipment_id>/availability")
@login_required
def check_availability(equipment_id):
    Equipment.query.get_or_404(equipment_id)
    start = request.args.get("start")
    end = request.args.get("end")
    exclude_shoot_id = request.args.get("exclude_shoot_id", type=int)

    if not start or not end:
        return jsonify({"error": "missing_fields", "fields": ["start", "end"]}), 400

    q = Shoot.query.filter(
        Shoot.equipment_id == equipment_id,
        Shoot.start_at < end,
        Shoot.end_at > start,
    )
    if exclude_shoot_id:
        q = q.filter(Shoot.id != exclude_shoot_id)

    conflicts = q.all()
    return jsonify({
        "available": len(conflicts) == 0,
        "conflicts": [s.to_dict() for s in conflicts],
    })