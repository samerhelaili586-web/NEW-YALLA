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


def _notify_admin_sys(message, notif_type="certificate_uploaded", link_url=None):
    """spec §7.1.2: Admin Sys is notified on certificate upload and justification events."""
    admins = User.query.filter_by(role="admin_sys", is_archived=False, is_active=True).all()
    for a in admins:
        db.session.add(Notification(user_id=a.id, type=notif_type, message=message, link_url=link_url))


# ---------- Leave requests ----------
@leave_bp.get("/requests")
@require_menu("conges_absences")
def list_my_requests():
    # Trigger auto-rejection logic on list load
    auto_reject_stale_requests()
    
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

    # spec §7.1.1: must be submitted at least 6h before the start date (start assumed at 00:00)
    start_datetime = datetime(start_date.year, start_date.month, start_date.day)
    if (start_datetime - datetime.utcnow()) < timedelta(hours=6):
        return jsonify({"error": "start_date_too_soon",
                        "detail": "La demande doit être soumise au moins 6h avant la date de début."}), 400

    # block if overlapping with a holiday
    overlapping_holidays = Holiday.query.filter(Holiday.date >= start_date, Holiday.date <= end_date).count()
    if overlapping_holidays > 0:
        return jsonify({"error": "holiday_overlap", "detail": "La période demandée inclut un ou plusieurs jours fériés."}), 400

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


# ---------- Auto-rejection: spec §7.1.1 — 6h before start date ----------
def auto_reject_stale_requests():
    """Reject pending leave requests where the start is within 6h and no decision was made."""
    # cutoff: any leave starting within the next 6 hours should already be decided
    cutoff_date = (datetime.utcnow() + timedelta(hours=6)).date()
    stale = LeaveRequest.query.filter(
        LeaveRequest.status == "pending",
        LeaveRequest.start_date <= cutoff_date,
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

    # spec §7.1.2: sick absence can only be declared for J, J-1, or J-2
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

    # spec §7.1.2: 48h window from the absence date
    deadline = datetime(
        absence.absence_date.year, absence.absence_date.month, absence.absence_date.day
    ) + timedelta(hours=48)
    if datetime.utcnow() > deadline:
        return jsonify({"error": "certificate_deadline_passed",
                        "detail": "Le délai de 48h pour déposer le justificatif est dépassé."}), 400

    data = request.get_json(force=True) or {}
    if not data.get("certificate_url"):
        return jsonify({"error": "missing_fields", "fields": ["certificate_url"]}), 400

    absence.certificate_url = data["certificate_url"]
    absence.certificate_uploaded_at = datetime.utcnow()
    absence.justification_status = "pending"
    db.session.flush()

    # spec §7.1.2: Admin Sys is notified (not Manager)
    _notify_admin_sys(
        f"Certificat médical déposé par {user.first_name} {user.last_name}.",
        notif_type="certificate_uploaded",
    )
    db.session.commit()
    return jsonify(absence.to_dict())


@leave_bp.post("/sick-absences/<int:absence_id>/justify")
@require_role("admin_sys")  # spec §7.1.2: Admin Sys validates the certificate
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
@require_role("admin_sys", "manager")  # spec §6.2: Manager adds holidays (Admin Sys also allowed)
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


# ---------- Homepage widget: who's unavailable today ----------
@leave_bp.get("/unavailable-today")
@login_required
def unavailable_today():
    today = date.today()

    on_leave = LeaveRequest.query.filter(
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today,
    ).all()
    sick = SickAbsence.query.filter_by(absence_date=today).all()

    result = [
        {
            "user_id": lv.user_id,
            "user_name": f"{lv.user.first_name} {lv.user.last_name}" if lv.user else None,
            "reason": "conge",
            "until": lv.end_date.isoformat(),
        }
        for lv in on_leave
    ] + [
        {
            "user_id": s.user_id,
            "user_name": f"{s.user.first_name} {s.user.last_name}" if s.user else None,
            "reason": "maladie",
            "until": s.absence_date.isoformat(),
        }
        for s in sick
    ]
    return jsonify(result)


# ---------- Upcoming unavailabilities widget (spec §7.2) ----------
# Returns present + future unavailabilities (excluding the past)
@leave_bp.get("/unavailable-upcoming")
@login_required
def unavailable_upcoming():
    today = date.today()

    on_leave = LeaveRequest.query.filter(
        LeaveRequest.status == "approved",
        LeaveRequest.end_date >= today,  # excludes past leaves
    ).order_by(LeaveRequest.start_date).all()

    sick = SickAbsence.query.filter(
        SickAbsence.absence_date >= today,
    ).order_by(SickAbsence.absence_date).all()

    result = [
        {
            "user_id": lv.user_id,
            "user_name": f"{lv.user.first_name} {lv.user.last_name}" if lv.user else None,
            "reason": "conge",
            "start": lv.start_date.isoformat(),
            "end": lv.end_date.isoformat(),
        }
        for lv in on_leave
    ] + [
        {
            "user_id": s.user_id,
            "user_name": f"{s.user.first_name} {s.user.last_name}" if s.user else None,
            "reason": "maladie",
            "start": s.absence_date.isoformat(),
            "end": s.absence_date.isoformat(),
        }
        for s in sick
    ]

    # Sort by start date ascending
    result.sort(key=lambda x: x["start"])
    return jsonify(result)