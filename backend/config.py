import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

is_serverless = os.getenv("VERCEL") == "1" or os.getenv("SERVERLESS") == "1" or not os.access(BASE_DIR, os.W_OK)
tmp_dir = "/tmp" if is_serverless else BASE_DIR


class DevConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    db_path = os.getenv("DATABASE_URL")
    if not db_path:
        db_file = os.path.join(tmp_dir, "yalla.db")
        db_path = f"sqlite:///{db_file}"

    SQLALCHEMY_DATABASE_URI = db_path
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_TYPE = "filesystem"
    SESSION_FILE_DIR = os.path.join(tmp_dir, "flask_session")
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 60 * 60  # 1h inactivity auto-logout

    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "None")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "True").lower() in ("true", "1")
    SESSION_COOKIE_HTTPONLY = True

    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    UPLOAD_FOLDER = os.path.join(tmp_dir, "uploads")


class TestConfig(DevConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"