from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app import db

ROLES = ("admin_sys", "manager", "cm", "prod")


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30))
    photo_url = db.Column(db.String(255))
    password_hash = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(20), nullable=False)  # one of ROLES
    is_chef_prod = db.Column(db.Boolean, default=False, nullable=False)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    @property
    def effective_role(self):
        """Role string used for permission checks — 'chef_prod' if the flag is set."""
        if self.role == "prod" and self.is_chef_prod:
            return "chef_prod"
        return self.role

    def to_dict(self, minimal=False):
        base = {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "phone": self.phone,
            "photo_url": self.photo_url,
            "role": self.role,
            "is_chef_prod": self.is_chef_prod,
            "effective_role": self.effective_role,
        }
        if not minimal:
            base.update({
                "is_active": self.is_active,
                "is_archived": self.is_archived,
                "created_at": self.created_at.isoformat(),
            })
        return base


class LoginHistory(db.Model):
    __tablename__ = "login_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    event = db.Column(db.String(10), nullable=False)  # 'login' | 'logout'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")