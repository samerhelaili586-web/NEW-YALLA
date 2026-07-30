from app import db

class SystemSetting(db.Model):
    __tablename__ = "system_settings"

    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(255), nullable=True)

    @classmethod
    def get_val(cls, key, default=None):
        try:
            setting = cls.query.get(key)
            return setting.value if setting else default
        except Exception:
            return default

    @classmethod
    def set_val(cls, key, value, description=None):
        setting = cls.query.get(key)
        if not setting:
            setting = cls(key=key, value=str(value), description=description)
            db.session.add(setting)
        else:
            setting.value = str(value)
            if description:
                setting.description = description
        db.session.commit()
        return setting

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description
        }
