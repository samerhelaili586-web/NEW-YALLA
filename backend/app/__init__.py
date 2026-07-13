from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from flask_cors import CORS

db = SQLAlchemy()
sess = Session()


def create_app(config_object="config.DevConfig"):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    sess.init_app(app)
    CORS(app, supports_credentials=True, origins=[app.config.get("FRONTEND_ORIGIN", "http://localhost:5173")])

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

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    with app.app_context():
        db.create_all()
        from app.seed import run_seed
        run_seed()

    return app