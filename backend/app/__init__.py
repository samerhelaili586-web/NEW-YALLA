import os
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
        "ALTER TABLE guide_pages ADD COLUMN steps JSON NOT NULL DEFAULT '[]'",
        # Feature 4: per-transition person-specific trigger
        "ALTER TABLE transitions ADD COLUMN allowed_user_id INTEGER REFERENCES users(id)",
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
    session_dir = app.config.get("SESSION_FILE_DIR", "/tmp/flask_session")
    upload_dir = app.config.get("UPLOAD_FOLDER", "/tmp/uploads")
    os.makedirs(session_dir, exist_ok=True)
    os.makedirs(upload_dir, exist_ok=True)
    sess.init_app(app)
    import re
    allowed_origin_regexes = [
        re.compile(r"^http://localhost(:\d+)?$"),
        re.compile(r"^http://127\.0\.0\.1(:\d+)?$"),
        re.compile(r"^https://.*\.vercel\.app$"),
        re.compile(r"^https://.*\.onrender\.com$"),
    ]

    def is_origin_allowed(origin):
        if not origin:
            return False
        return any(pattern.match(origin) for pattern in allowed_origin_regexes)

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin")
            response = app.make_default_options_response()
            if is_origin_allowed(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            return response

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    CORS(
        app,
        supports_credentials=True,
        origins=allowed_origin_regexes,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    @app.errorhandler(500)
    def internal_server_error(e):
        from app.routes.monitoring import log_backend_error
        log_backend_error(app, e, 500)
        return jsonify({"error": "internal_server_error", "detail": str(e)}), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        app.logger.error(f"Unhandled exception: {e}\n{traceback.format_exc()}")
        from app.routes.monitoring import log_backend_error
        log_backend_error(app, e, 500)
        return jsonify({"error": "internal_server_error", "detail": str(e)}), 500

    from app.models import (  # noqa: F401  (register models with SQLAlchemy)
        user, task_type, project, task, equipment, shoot,
        leave, notification, announcement, guide_page, error_log,
        system_setting, custom_role, custom_list, project_permission,
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

    from app.routes.announcements import announcements_bp
    app.register_blueprint(announcements_bp, url_prefix="/api/announcements")

    from app.routes.guide import guide_bp
    app.register_blueprint(guide_bp, url_prefix="/api/guide")

    from app.routes.monitoring import monitoring_bp
    app.register_blueprint(monitoring_bp, url_prefix="/api/monitoring")

    from app.routes.settings import settings_bp
    app.register_blueprint(settings_bp, url_prefix="/api/settings")

    from app.routes.custom_roles import custom_roles_bp
    app.register_blueprint(custom_roles_bp, url_prefix="/api/custom-roles")

    from app.routes.custom_lists import custom_lists_bp
    app.register_blueprint(custom_lists_bp, url_prefix="/api/custom-lists")

    from app.routes.project_permissions import project_permissions_bp
    app.register_blueprint(project_permissions_bp, url_prefix="/api/projects")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    dist_dir = os.path.abspath(os.path.join(app.root_path, "../../frontend/dist"))

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return jsonify({"error": "not_found"}), 404
        file_path = os.path.join(dist_dir, path)
        if path != "" and os.path.exists(file_path):
            from flask import send_from_directory
            return send_from_directory(dist_dir, path)
        else:
            from flask import send_from_directory
            if os.path.exists(os.path.join(dist_dir, "index.html")):
                return send_from_directory(dist_dir, "index.html")
            return jsonify({"status": "ok", "message": "Backend API running"}), 200

    with app.app_context():
        _run_migrations(db)
        db.create_all()
        from app.models.user import User
        if not User.query.first():
            from app.seed import run_seed
            run_seed()

        from app.models.system_setting import SystemSetting
        if not SystemSetting.query.get("grace_period_days"):
            SystemSetting.set_val("grace_period_days", "1", "Délai de grâce en jours pour déclarer son temps (ex: 1 pour J+1, 2 pour J+2, etc.)")

        # Seed built-in roles if not already present
        from app.models.custom_role import CustomRole
        if not CustomRole.query.first():
            _seed_builtin_roles()

    return app


def _seed_builtin_roles():
    """Create the 5 built-in roles in the custom_roles table on first startup."""
    from app.models.custom_role import CustomRole
    from app.permissions import MENU_ACCESS, ACTION_ACCESS

    BUILTINS = [
        {
            "key": "admin_sys",
            "label": "Admin Système",
            "color": "#dc2626",
            "visibility_mode": "all",
            "participates_in_workflow": True,
            "menu_permissions": [k for k, v in MENU_ACCESS.items() if "admin_sys" in v],
            "action_permissions": [k for k, v in ACTION_ACCESS.items() if "admin_sys" in v],
        },
        {
            "key": "manager",
            "label": "Manager",
            "color": "#2563eb",
            "visibility_mode": "all",
            "participates_in_workflow": True,
            "menu_permissions": [k for k, v in MENU_ACCESS.items() if "manager" in v],
            "action_permissions": [k for k, v in ACTION_ACCESS.items() if "manager" in v],
        },
        {
            "key": "cm",
            "label": "Community Manager",
            "color": "#7c3aed",
            "visibility_mode": "actionable",
            "participates_in_workflow": True,
            "menu_permissions": [k for k, v in MENU_ACCESS.items() if "cm" in v],
            "action_permissions": [k for k, v in ACTION_ACCESS.items() if "cm" in v],
        },
        {
            "key": "prod",
            "label": "Prod / Monteur",
            "color": "#059669",
            "visibility_mode": "actionable",
            "participates_in_workflow": True,
            "menu_permissions": [k for k, v in MENU_ACCESS.items() if "prod" in v],
            "action_permissions": [k for k, v in ACTION_ACCESS.items() if "prod" in v],
        },
        {
            "key": "chef_prod",
            "label": "Chef de Production",
            "color": "#d97706",
            "visibility_mode": "actionable",
            "participates_in_workflow": True,
            "menu_permissions": [k for k, v in MENU_ACCESS.items() if "chef_prod" in v],
            "action_permissions": [k for k, v in ACTION_ACCESS.items() if "chef_prod" in v],
        },
    ]

    for b in BUILTINS:
        role = CustomRole(
            key=b["key"],
            label=b["label"],
            color=b["color"],
            is_builtin=True,
            participates_in_workflow=b["participates_in_workflow"],
            visibility_mode=b["visibility_mode"],
            menu_permissions=b["menu_permissions"],
            action_permissions=b["action_permissions"],
        )
        db.session.add(role)
    db.session.commit()
    print("Seeded 5 built-in roles in custom_roles table.")