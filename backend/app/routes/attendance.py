from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from app.models.task import TimeEntry, Task
from app.models.user import User
from app.models.leave import LeaveRequest, SickAbsence, Holiday
from app.permissions import require_menu, login_required, current_user

attendance_bp = Blueprint("attendance", __name__)

# Spec §6.2: minimum 6 hours (360 minutes) per working day
MIN_DAILY_MINUTES = 360


def _week_bounds(ref_date: date):
    monday = ref_date - timedelta(days=ref_date.weekday())
    return monday, monday + timedelta(days=6)


def _is_day_off(d: date, user_id: int):
    # weekday(): 0=Mon ... 5=Sat, 6=Sun — this company works Saturdays, only Sunday is off
    if d.weekday() == 6:  # Sunday only
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


from app import db
from app.models.notification import Notification

def check_and_notify_penalties():
    """
    Checks past workdays where grace period expired (today >= d + grace_days + 1).
    Sends high-priority penalty notifications to employee, managers, and admin sys.
    """
    from app.models.system_setting import SystemSetting
    try:
        grace_days = int(SystemSetting.get_val("grace_period_days", "1"))
    except ValueError:
        grace_days = 1

    today = date.today()
    users = User.query.filter_by(is_archived=False, is_active=True).filter(
        User.role.in_(["cm", "prod"])
    ).all()
    managers_and_admins = User.query.filter_by(is_archived=False, is_active=True).filter(
        User.role.in_(["admin_sys", "manager"])
    ).all()

    for delta in range(grace_days + 1, 30):
        past_date = today - timedelta(days=delta)
        d_str = past_date.strftime("%d/%m/%Y")

        for u in users:
            if _is_day_off(past_date, u.id):
                continue

            min_req = 240 if past_date.weekday() == 5 else MIN_DAILY_MINUTES
            entries = TimeEntry.query.filter_by(user_id=u.id, entry_date=past_date).all()
            total_mins = sum(e.hours * 60 + e.minutes for e in entries)

            if total_mins < min_req:
                # Check if notification already sent for this user + date
                msg_employee = f"⚠️ Pénalité : Votre feuille de présence du {d_str} n'a pas été soumise avant la limite (J+{grace_days} à 23h59). Journée marquée pénalisée et non payée."
                exists = Notification.query.filter(
                    Notification.user_id == u.id,
                    Notification.message == msg_employee,
                ).first()

                if not exists:
                    # Notify Employee
                    db.session.add(Notification(
                        user_id=u.id,
                        type="penalty_alert",
                        message=msg_employee,
                        link_url=f"/attendance?date={past_date.isoformat()}",
                    ))
                    # Notify Managers and Admins
                    for m in managers_and_admins:
                        db.session.add(Notification(
                            user_id=m.id,
                            type="penalty_alert",
                            message=f"⚠️ Alerte Pénalité : {u.first_name} {u.last_name} n'a pas soumis son temps du {d_str} avant la limite. Journée marquée pénalisée.",
                            link_url=f"/attendance?date={past_date.isoformat()}&search={u.first_name} {u.last_name}",
                        ))
                    db.session.commit()


def _build_week(user_id: int, week_start: date):
    from app.models.system_setting import SystemSetting
    try:
        grace_days = int(SystemSetting.get_val("grace_period_days", "1"))
    except ValueError:
        grace_days = 1

    today = date.today()
    days = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        entries = TimeEntry.query.filter_by(user_id=user_id, entry_date=d).all()
        total_minutes = sum(e.hours * 60 + e.minutes for e in entries)
        day_off = _is_day_off(d, user_id)
        min_req = 240 if d.weekday() == 5 else MIN_DAILY_MINUTES

        # Grace period logic:
        # If d is in the past and today >= d + grace_days + 1 days (grace period expired),
        # and total_minutes < min_req and day_off is None, day_off becomes 'penalized'!
        if day_off is None and today >= d + timedelta(days=grace_days + 1) and total_minutes < min_req:
            day_off = "penalized"

        is_grace_period = (d < today and today <= d + timedelta(days=grace_days) and total_minutes < min_req and day_off is None)

        days.append({
            "date": d.isoformat(),
            "day_off_reason": day_off,
            "total_minutes": 0 if day_off == "penalized" else total_minutes,
            "entries": [e.to_dict() for e in entries],
            "missing_report": day_off is None and (d == today or is_grace_period) and total_minutes < min_req,
            "is_grace_period": is_grace_period,
        })
    return days


# ---------- Personal weekly timesheet (CM, Prod, Chef Prod) ----------
@attendance_bp.get("/me")
@require_menu("feuille_presence_perso")
def my_week():
    check_and_notify_penalties()
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
    check_and_notify_penalties()
    ref = request.args.get("ref_date")
    ref_date = date.fromisoformat(ref) if ref else date.today()
    week_start, _ = _week_bounds(ref_date)

    users = User.query.filter_by(is_archived=False, is_active=True).filter(
        User.role.in_(["cm", "prod"])
    ).all()
    return jsonify([
        {
            "user_id": u.id,
            "user_name": f"{u.first_name} {u.last_name}",
            "role": u.effective_role,
            "days": _build_week(u.id, week_start),
        }
        for u in users
    ])


# ---------- Alerts: users with missing reports today ----------
@attendance_bp.get("/alerts/missing-today")
@require_menu("feuille_presence_equipe")
def missing_today():
    today = date.today()
    users = User.query.filter_by(is_archived=False, is_active=True).filter(
        User.role.in_(["cm", "prod"])
    ).all()

    flagged = []
    min_req = 240 if today.weekday() == 5 else MIN_DAILY_MINUTES
    for u in users:
        if _is_day_off(today, u.id):
            continue
        total = sum(
            e.hours * 60 + e.minutes
            for e in TimeEntry.query.filter_by(user_id=u.id, entry_date=today).all()
        )
        if total < min_req:
            flagged.append({
                "user_id": u.id,
                "user_name": f"{u.first_name} {u.last_name}",
                "total_minutes": total,
            })

    return jsonify(flagged)


# ---------- Personal alert: check yesterday's reporting for the logged-in user ----------
@attendance_bp.get("/alerts/me-yesterday")
@login_required
def my_yesterday_alert():

    user = current_user()
    yesterday = date.today() - timedelta(days=1)

    # Skip if yesterday was a day off
    if _is_day_off(yesterday, user.id):
        return jsonify({"missing": False})

    total = sum(
        e.hours * 60 + e.minutes
        for e in TimeEntry.query.filter_by(user_id=user.id, entry_date=yesterday).all()
    )
    min_req = 240 if yesterday.weekday() == 5 else MIN_DAILY_MINUTES
    return jsonify({
        "missing": total < min_req,
        "date": yesterday.isoformat(),
        "total_minutes": total,
    })