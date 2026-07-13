from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from app.models.task import TimeEntry, Task
from app.models.user import User
from app.models.leave import LeaveRequest, SickAbsence, Holiday
from app.permissions import require_menu, login_required, current_user

attendance_bp = Blueprint("attendance", __name__)


def _week_bounds(ref_date: date):
    monday = ref_date - timedelta(days=ref_date.weekday())
    return monday, monday + timedelta(days=6)


def _is_day_off(d: date, user_id: int):
    if d.weekday() >= 5:  # Sat/Sun
        return "weekend"
    if Holiday.query.filter_by(date=d).first():
        return "holiday"
    if LeaveRequest.query.filter(
        LeaveRequest.user_id == user_id, LeaveRequest.status == "approved",
        LeaveRequest.start_date <= d, LeaveRequest.end_date >= d,
    ).first():
        return "leave"
    if SickAbsence.query.filter_by(user_id=user_id, absence_date=d).first():
        return "sick"
    return None


def _build_week(user_id: int, week_start: date):
    days = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        entries = TimeEntry.query.filter_by(user_id=user_id, entry_date=d).all()
        total_minutes = sum(e.hours * 60 + e.minutes for e in entries)
        day_off = _is_day_off(d, user_id)
        days.append({
            "date": d.isoformat(),
            "day_off_reason": day_off,
            "total_minutes": total_minutes,
            "entries": [e.to_dict() for e in entries],
            # spec: flag as missing report only for a past/today workday with zero time logged
            "missing_report": day_off is None and d <= date.today() and total_minutes == 0,
        })
    return days


# ---------- Personal weekly timesheet (CM, Prod, Chef Prod) ----------
@attendance_bp.get("/me")
@require_menu("feuille_presence_perso")
def my_week():
    user = current_user()
    ref = request.args.get("ref_date")
    ref_date = date.fromisoformat(ref) if ref else date.today()
    week_start, week_end = _week_bounds(ref_date)
    return jsonify({
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "days": _build_week(user.id, week_start),
    })


# ---------- Team weekly timesheet (Admin Sys, Manager) ----------
@attendance_bp.get("/team")
@require_menu("feuille_presence_equipe")
def team_week():
    ref = request.args.get("ref_date")
    ref_date = date.fromisoformat(ref) if ref else date.today()
    week_start, _ = _week_bounds(ref_date)

    users = User.query.filter_by(is_archived=False, is_active=True).all()
    return jsonify([
        {
            "user_id": u.id,
            "user_name": f"{u.first_name} {u.last_name}",
            "role": u.effective_role,
            "days": _build_week(u.id, week_start),
        }
        for u in users
    ])


# ---------- Alerts: users with missing reports today (for dashboard/notifications) ----------
@attendance_bp.get("/alerts/missing-today")
@require_menu("feuille_presence_equipe")
def missing_today():
    today = date.today()
    users = User.query.filter_by(is_archived=False, is_active=True).filter(
        User.role.in_(["cm", "prod"])
    ).all()

    flagged = []
    for u in users:
        if _is_day_off(today, u.id):
            continue
        total = sum(
            e.hours * 60 + e.minutes
            for e in TimeEntry.query.filter_by(user_id=u.id, entry_date=today).all()
        )
        if total == 0:
            flagged.append({"user_id": u.id, "user_name": f"{u.first_name} {u.last_name}"})

    return jsonify(flagged)