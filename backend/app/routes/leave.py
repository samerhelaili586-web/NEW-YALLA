from datetime import date, datetime, timedelta
from flask import Blueprint, request, jsonify
from app import db
from app.models.leave import LeaveRequest, SickAbsence, Holiday
from app.models.notification import Notification
from app.models.user import User
from app.permissions import require_menu, require_role, login_required, current_user

leave_bp = Blueprint("leave", __name__)


def _notify_managers(message, link_url=None):
    managers = User.query.filter_by(role="manager", is_archived=False, is_active=True).all()
    for m in managers:
        db.session.add(Notification(user_id=m.id, type="leave_new", message=message, link_url=link_url))


# ---------- Leave requests ----------
@leave_bp.get("/requests")
@require_menu("conges_absences")
def list_my_requests():
    user = current_user()
    requests_q = LeaveRequest.query
    if user.effective_role not in ("admin_sys", "manager"):
        requests_q = requests_q.filter_by(user_id=user.id)
    requests_q = requests_q.order_by(LeaveRequest.submitted_at.desc())
    return jsonify([r.to_dict() for r in requests_q.all()])


@leave_bp.post("/requests")
@require_menu("conges_absences")
def create_request():
    data = request.get_json(force=True) or {}
    required = ["start_date", "end_date"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    try:
        start_date = date.fromisoformat(data["start_date"])
        end_date = date.fromisoformat(data["end_date"])
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    if end_date < start_date:
        return jsonify({"error": "end_before_start"}), 400

    user = current_user()
    leave = LeaveRequest(
        user_id=user.id, start_date=start_date, end_date=end_date, reason=data.get("reason"),
    )
    db.session.add(leave)
    db.session.flush()

    _notify_managers(f"{user.first_name} {user.last_name} a soumis une demande de congé.")
    db.session.commit()
    return jsonify(leave.to_dict()), 201


@leave_bp.post("/requests/<int:request_id>/approve")
@require_role("manager")
def approve_request(request_id):
    leave = LeaveRequest.query.get_or_404(request_id)
    if leave.status != "pending":
        return jsonify({"error": "already_decided"}), 409
    leave.status = "approved"
    leave.decided_at = datetime.utcnow()
    db.session.commit()
    return jsonify(leave.to_dict())


@leave_bp.post("/requests/<int:request_id>/reject")
@require_role("manager")
def reject_request(request_id):
    leave = LeaveRequest.query.get_or_404(request_id)
    if leave.status != "pending":
        return jsonify({"error": "already_decided"}), 409
    leave.status = "rejected"
    leave.decided_at = datetime.utcnow()
    db.session.commit()
    return jsonify(leave.to_dict())


# ---------- Auto-rejection: run periodically (or on-demand) for stale pending requests ----------
def auto_reject_stale_requests(days_threshold=3):
    """spec: leave requests left un-decided for too long before their start date are auto-rejected."""
    cutoff = date.today() + timedelta(days=days_threshold)
    stale = LeaveRequest.query.filter(
        LeaveRequest.status == "pending", LeaveRequest.start_date <= cutoff,
    ).all()
    for leave in stale:
        leave.status = "auto_rejected"
        leave.decided_at = datetime.utcnow()
        db.session.add(Notification(
            user_id=leave.user_id, type="leave_auto_rejected",
            message="Votre demande de congé a été automatiquement rejetée (non traitée à temps).",
        ))
    db.session.commit()
    return len(stale)


@leave_bp.post("/requests/run-auto-reject")
@require_role("admin_sys")
def trigger_auto_reject():
    count = auto_reject_stale_requests()
    return jsonify({"auto_rejected_count": count})


# ---------- Sick absences ----------
@leave_bp.get("/sick-absences")
@require_menu("conges_absences")
def list_sick_absences():
    user = current_user()
    q = SickAbsence.query
    if user.effective_role not in ("admin_sys", "manager"):
        q = q.filter_by(user_id=user.id)
    return jsonify([s.to_dict() for s in q.order_by(SickAbsence.declared_at.desc()).all()])


@leave_bp.post("/sick-absences")
@require_menu("conges_absences")
def declare_sick_absence():
    data = request.get_json(force=True) or {}
    if not data.get("absence_date"):
        return jsonify({"error": "missing_fields", "fields": ["absence_date"]}), 400

    try:
        absence_date = date.fromisoformat(data["absence_date"])
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    # spec: sick absence can only be declared for J, J-1, or J-2
    delta = (date.today() - absence_date).days
    if delta < 0 or delta > 2:
        return jsonify({"error": "absence_date_out_of_range"}), 400

    user = current_user()
    absence = SickAbsence(user_id=user.id, absence_date=absence_date)
    db.session.add(absence)
    db.session.flush()

    _notify_managers(f"{user.first_name} {user.last_name} a déclaré une absence maladie.")
    db.session.commit()
    return jsonify(absence.to_dict()), 201


@leave_bp.post("/sick-absences/<int:absence_id>/certificate")
@login_required
def upload_certificate(absence_id):
    absence = SickAbsence.query.get_or_404(absence_id)
    user = current_user()
    if absence.user_id != user.id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(force=True) or {}
    if not data.get("certificate_url"):
        return jsonify({"error": "missing_fields", "fields": ["certificate_url"]}), 400

    absence.certificate_url = data["certificate_url"]
    absence.certificate_uploaded_at = datetime.utcnow()
    absence.justification_status = "pending"
    db.session.flush()

    _notify_managers(f"Certificat médical déposé par {user.first_name} {user.last_name}.")
    db.session.commit()
    return jsonify(absence.to_dict())


@leave_bp.post("/sick-absences/<int:absence_id>/justify")
@require_role("manager")
def justify_absence(absence_id):
    absence = SickAbsence.query.get_or_404(absence_id)
    data = request.get_json(force=True) or {}
    decision = data.get("justification_status")
    if decision not in ("justified", "unjustified"):
        return jsonify({"error": "invalid_status"}), 400
    absence.justification_status = decision
    db.session.commit()
    return jsonify(absence.to_dict())


# ---------- Holidays (company-wide) ----------
@leave_bp.get("/holidays")
@login_required
def list_holidays():
    return jsonify([h.to_dict() for h in Holiday.query.order_by(Holiday.date).all()])


@leave_bp.post("/holidays")
@require_role("admin_sys")
def add_holiday():
    data = request.get_json(force=True) or {}
    if not data.get("date") or not data.get("label"):
        return jsonify({"error": "missing_fields"}), 400
    try:
        d = date.fromisoformat(data["date"])
    except ValueError:
        return jsonify({"error": "invalid_date"}), 400

    if Holiday.query.filter_by(date=d).first():
        return jsonify({"error": "holiday_already_exists"}), 409

    user = current_user()
    holiday = Holiday(date=d, label=data["label"], created_by_id=user.id)
    db.session.add(holiday)

    all_users = User.query.filter_by(is_archived=False, is_active=True).all()
    for u in all_users:
        db.session.add(Notification(
            user_id=u.id, type="holiday_added", message=f"Nouveau jour férié ajouté : {data['label']}",
        ))

    db.session.commit()
    return jsonify(holiday.to_dict()), 201