import traceback
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session
from app import db
from app.models.error_log import ErrorLog
from app.models.user import User
from app.permissions import require_menu

monitoring_bp = Blueprint("monitoring", __name__)


def log_backend_error(app, exception, status_code=500):
    """Helper to log backend exception to database."""
    try:
        user_id = session.get("user_id")
        user = User.query.get(user_id) if user_id else None

        err_msg = str(exception)
        st = traceback.format_exc()

        log = ErrorLog(
            user_id=user.id if user else None,
            user_email=user.email if user else "Anonyme",
            user_role=user.role if user else "N/A",
            endpoint=request.path if request else "System",
            method=request.method if request else "N/A",
            status_code=status_code,
            error_message=err_msg[:1000],
            stack_trace=st[:5000],
            source="backend",
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Failed to log error to DB: {e}")


@monitoring_bp.get("/logs")
@require_menu("gestion_workflows")
def get_logs():
    query = ErrorLog.query.order_by(ErrorLog.timestamp.desc())

    source = request.args.get("source")
    if source:
        query = query.filter_by(source=source)

    status_code = request.args.get("status_code")
    if status_code and status_code.isdigit():
        query = query.filter_by(status_code=int(status_code))

    search = request.args.get("q")
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ErrorLog.error_message.ilike(pattern))
            | (ErrorLog.endpoint.ilike(pattern))
            | (ErrorLog.user_email.ilike(pattern))
        )

    logs = query.limit(300).all()
    return jsonify([l.to_dict() for l in logs])


@monitoring_bp.get("/stats")
@require_menu("gestion_workflows")
def get_stats():
    total = ErrorLog.query.count()
    server_errors = ErrorLog.query.filter_by(status_code=500).count()
    backend_count = ErrorLog.query.filter_by(source="backend").count()
    frontend_count = ErrorLog.query.filter_by(source="frontend").count()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = ErrorLog.query.filter(ErrorLog.timestamp >= today_start).count()

    return jsonify({
        "total_errors": total,
        "critical_500_errors": server_errors,
        "today_errors": today_count,
        "backend_errors": backend_count,
        "frontend_errors": frontend_count,
    })


@monitoring_bp.post("/client-error")
def log_client_error():
    data = request.get_json(silent=True) or {}
    user_id = session.get("user_id")
    user = User.query.get(user_id) if user_id else None

    try:
        log = ErrorLog(
            user_id=user.id if user else None,
            user_email=user.email if user else (data.get("user_email") or "Anonyme"),
            user_role=user.role if user else "N/A",
            endpoint=data.get("url") or data.get("endpoint") or request.referrer or "Frontend",
            method=data.get("method") or "CLIENT",
            status_code=int(data.get("status_code") or 400),
            error_message=str(data.get("message") or "Erreur JavaScript client")[:1000],
            stack_trace=str(data.get("stack") or data.get("detail") or "")[:5000],
            source="frontend",
        )
        db.session.add(log)
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@monitoring_bp.delete("/logs")
@require_menu("gestion_workflows")
def clear_logs():
    try:
        db.session.query(ErrorLog).delete()
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
