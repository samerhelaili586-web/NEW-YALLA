import os
import sys
import pytest

# Ensure app package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app, db
from app.models.user import User
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project
from app.models.task import Task


@pytest.fixture
def app():
    """Create application configured for testing with in-memory SQLite database."""
    app = create_app("config.DevConfig")
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test_secret_key",
        "WTF_CSRF_ENABLED": False,
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def admin_user(app):
    """Fixture providing an admin user."""
    user = User(
        email="admin@test.com",
        first_name="Admin",
        last_name="System",
        role="admin_sys",
    )
    user.set_password("password123")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def cm_user(app):
    """Fixture providing a CM user."""
    user = User(
        email="cm@test.com",
        first_name="CM",
        last_name="User",
        role="cm",
    )
    user.set_password("password123")
    db.session.add(user)
    db.session.commit()
    return user
