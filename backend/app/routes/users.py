from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, ROLES
from app.permissions import require_menu, require_role, login_required

users_bp = Blueprint("users", __name__)


# ---------- Company directory (all active users, all roles can view) ----------
@users_bp.get("/directory")
@login_required
def directory():
    users = User.query.filter_by(is_archived=False, is_active=True).all()
    return jsonify([u.to_dict(minimal=True) for u in users])


# ---------- Admin Sys: full user management ----------
@users_bp.get("")
@require_menu("gestion_utilisateurs")
def list_users():
    users = User.query.order_by(User.last_name).all()
    return jsonify([u.to_dict() for u in users])


@users_bp.post("")
@require_menu("gestion_utilisateurs")
def create_user():
    data = request.get_json(force=True) or {}
    required = ["first_name", "last_name", "email", "role", "password"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    if data["role"] not in ROLES:
        return jsonify({"error": "invalid_role"}), 400

    if User.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"error": "email_taken"}), 409

    user = User(
        first_name=data["first_name"],
        last_name=data["last_name"],
        email=data["email"].strip().lower(),
        phone=data.get("phone"),
        photo_url=data.get("photo_url"),
        role=data["role"],
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    if data.get("is_chef_prod") and user.role == "prod":
        _set_chef_prod(user.id)

    return jsonify({"user": user.to_dict()}), 201


@users_bp.patch("/<int:user_id>")
@require_menu("gestion_utilisateurs")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(force=True) or {}

    for field in ("first_name", "last_name", "phone", "photo_url"):
        if field in data:
            setattr(user, field, data[field])

    if "email" in data:
        new_email = data["email"].strip().lower()
        existing = User.query.filter_by(email=new_email).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "email_taken"}), 409
        user.email = new_email

    if "role" in data:
        if data["role"] not in ROLES:
            return jsonify({"error": "invalid_role"}), 400
        user.role = data["role"]
        if user.role != "prod":
            user.is_chef_prod = False  # can't hold the flag if no longer Prod

    if "password" in data and data["password"]:
        user.set_password(data["password"])

    # Validate is_chef_prod BEFORE committing, so role change + chef flag are atomic
    if "is_chef_prod" in data:
        if data["is_chef_prod"]:
            if user.role != "prod":
                return jsonify({"error": "chef_prod_requires_prod_role"}), 400
            # Unset any previous holder without committing yet
            User.query.filter(User.id != user.id, User.is_chef_prod.is_(True)).update(
                {"is_chef_prod": False}
            )
            user.is_chef_prod = True
        else:
            user.is_chef_prod = False

    # Single commit for all changes
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/archive")
@require_menu("gestion_utilisateurs")
def archive_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_archived = True
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/restore")
@require_menu("gestion_utilisateurs")
def restore_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_archived = False
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/deactivate")
@require_menu("gestion_utilisateurs")
def deactivate_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@users_bp.post("/<int:user_id>/activate")
@require_menu("gestion_utilisateurs")
def activate_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict()})


# NOTE: no delete endpoint — spec §2.4 forbids hard-deleting user accounts, ever.


# ---------- Admin Sys: Salaires et Paie ----------
@users_bp.get("/payroll")
@require_menu("salaires_paie")
def get_payroll_summary():
    from calendar import monthrange
    from app.models.task import TimeEntry

    month_str = request.args.get("month")  # YYYY-MM
    if not month_str:
        month_str = datetime.utcnow().strftime("%Y-%m")

    try:
        year, month = map(int, month_str.split("-"))
        _, last_day = monthrange(year, month)
        start_date = datetime(year, month, 1).date()
        end_date = datetime(year, month, last_day).date()
    except ValueError:
        return jsonify({"error": "invalid_month_format", "detail": "Utilisez le format YYYY-MM"}), 400

    users = User.query.filter_by(is_archived=False).order_by(User.last_name).all()

    # Query time entries for the specified month
    time_entries = TimeEntry.query.filter(
        TimeEntry.entry_date >= start_date,
        TimeEntry.entry_date <= end_date
    ).all()

    # Map time entries per user
    user_minutes = {}
    for te in time_entries:
        user_minutes[te.user_id] = user_minutes.get(te.user_id, 0) + (te.hours * 60 + te.minutes)

    payroll_rows = []
    total_payroll = 0.0
    total_hours_worked = 0.0
    total_hours_goal = 0

    for u in users:
        rate = u.hourly_rate if u.hourly_rate is not None else 25.0
        goal = u.monthly_hours_goal if u.monthly_hours_goal is not None else 160
        base_salary = round(rate * goal, 2)

        mins = user_minutes.get(u.id, 0)
        hours_worked = round(mins / 60.0, 2)
        calculated_pay = round(hours_worked * rate, 2)
        completion_pct = round((hours_worked / goal) * 100, 1) if goal > 0 else 0.0

        total_payroll += calculated_pay
        total_hours_worked += hours_worked
        total_hours_goal += goal

        payroll_rows.append({
            "user_id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "user_name": f"{u.first_name} {u.last_name}",
            "email": u.email,
            "role": u.role,
            "effective_role": u.effective_role,
            "photo_url": u.photo_url,
            "is_active": u.is_active,
            "hourly_rate": rate,
            "monthly_hours_goal": goal,
            "monthly_base_salary": base_salary,
            "hours_worked": hours_worked,
            "calculated_pay": calculated_pay,
            "completion_pct": completion_pct,
        })

    avg_completion = round((total_hours_worked / total_hours_goal * 100), 1) if total_hours_goal > 0 else 0.0

    return jsonify({
        "month": month_str,
        "summary": {
            "total_payroll": round(total_payroll, 2),
            "total_hours_worked": round(total_hours_worked, 2),
            "total_hours_goal": total_hours_goal,
            "avg_completion_pct": avg_completion,
            "active_users_count": len(users),
        },
        "users": payroll_rows,
    })


@users_bp.patch("/<int:user_id>/salary")
@require_menu("salaires_paie")
def update_user_salary(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(force=True) or {}

    if "hourly_rate" in data:
        try:
            rate = float(data["hourly_rate"])
            if rate < 0:
                return jsonify({"error": "invalid_rate"}), 400
            user.hourly_rate = rate
        except ValueError:
            return jsonify({"error": "invalid_rate"}), 400

    if "monthly_hours_goal" in data:
        try:
            goal = int(data["monthly_hours_goal"])
            if goal < 0:
                return jsonify({"error": "invalid_goal"}), 400
            user.monthly_hours_goal = goal
        except ValueError:
            return jsonify({"error": "invalid_goal"}), 400

    db.session.commit()
    return jsonify({"user": user.to_dict()})


def _set_chef_prod(user_id):
    """Enforce: exactly one Prod user can hold the Chef Prod flag at a time.
    Setting it on user_id automatically unsets it from any previous holder."""
    User.query.filter(User.id != user_id, User.is_chef_prod.is_(True)).update(
        {"is_chef_prod": False}
    )
    target = User.query.get(user_id)
    target.is_chef_prod = True
    db.session.commit()