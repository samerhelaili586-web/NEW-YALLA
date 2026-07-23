from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from flask_cors import CORS

db = SQLAlchemy()
sess = Session()


def _run_migrations(db):
    """Safely add new columns to existing SQLite tables (no Alembic)."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE task_types ADD COLUMN description VARCHAR(255)",
        "ALTER TABLE task_types ADD COLUMN workflow_status VARCHAR(10) NOT NULL DEFAULT 'draft'",
        "ALTER TABLE task_types ADD COLUMN updated_at DATETIME",
        "ALTER TABLE transitions ADD COLUMN allowed_roles JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE transitions ADD COLUMN form_fields JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE users ADD COLUMN hourly_rate FLOAT NOT NULL DEFAULT 25.0",
        "ALTER TABLE users ADD COLUMN monthly_hours_goal INTEGER NOT NULL DEFAULT 160",
    ]
    with db.engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                # Column already exists or other benign error — skip
                pass



def create_app(config_object="config.DevConfig"):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    sess.init_app(app)
    import re
    allowed_origin_patterns = [
        r"^http://localhost(:\d+)?$",
        r"^http://127\.0\.0\.1(:\d+)?$",
    ]
    CORS(
        app,
        supports_credentials=True,
        origins=allowed_origin_patterns,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin:
            for pattern in allowed_origin_patterns:
                if re.match(pattern, origin):
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
                    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                    break
        return response

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({"error": "internal_server_error", "detail": str(e)}), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        app.logger.error(f"Unhandled exception: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "internal_server_error", "detail": str(e)}), 500

    from app.models import (  # noqa: F401  (register models with SQLAlchemy)
        user, task_type, project, task, equipment, shoot,
        leave, notification,
    )

    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from app.routes.users import users_bp
    app.register_blueprint(users_bp, url_prefix="/api/users")

    from app.routes.task_types import task_types_bp
    app.register_blueprint(task_types_bp, url_prefix="/api/task-types")

    from app.routes.equipment import equipment_bp
    app.register_blueprint(equipment_bp, url_prefix="/api/equipment")

    from app.routes.projects import projects_bp
    app.register_blueprint(projects_bp, url_prefix="/api/projects")

    from app.routes.tasks import tasks_bp
    app.register_blueprint(tasks_bp, url_prefix="/api/tasks")

    from app.routes.attendance import attendance_bp
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")

    from app.routes.leave import leave_bp
    app.register_blueprint(leave_bp, url_prefix="/api/leave")

    from app.routes.notifications import notifications_bp
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

    from app.routes.planification import planification_bp
    app.register_blueprint(planification_bp, url_prefix="/api/planification")

    from app.routes.login_history import login_history_bp
    app.register_blueprint(login_history_bp, url_prefix="/api/login-history")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    with app.app_context():
        _run_migrations(db)
        db.create_all()
        from app.seed import run_seed
        run_seed()

    return app