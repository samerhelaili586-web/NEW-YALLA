from datetime import datetime, date
from app import db

TASK_TITLE_MAX_LEN = 100


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    task_type_id = db.Column(db.Integer, db.ForeignKey("task_types.id"), nullable=False)
    status_id = db.Column(db.Integer, db.ForeignKey("statuses.id"), nullable=False)

    title = db.Column(db.String(TASK_TITLE_MAX_LEN), nullable=False)
    description = db.Column(db.Text)
    planned_publish_date = db.Column(db.Date, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    task_type = db.relationship("TaskType")
    status = db.relationship("Status")
    comments = db.relationship("Comment", backref="task", cascade="all, delete-orphan")
    time_entries = db.relationship("TimeEntry", backref="task", cascade="all, delete-orphan")
    # users invited/assigned via a status change (shooting crew, editor, etc.)
    assignees = db.relationship("TaskAssignee", backref="task", cascade="all, delete-orphan")

    @property
    def is_late(self):
        if self.status and self.status.functional_type in ("final_confirmation", "final_rejet"):
            return False
        return date.today() > self.planned_publish_date

    @property
    def total_time_minutes(self):
        return sum(te.hours * 60 + te.minutes for te in self.time_entries)

    @property
    def prod_time_minutes(self):
        total = 0
        for te in self.time_entries:
            if not te.user:
                continue
            is_prod_user = te.user.role == "prod" or te.user.effective_role in ("prod", "chef_prod")
            is_prod_status = te.status_at_entry and te.status_at_entry.functional_type in ("planification_shooting", "planification_montage", "montage")
            if is_prod_user or is_prod_status:
                total += te.hours * 60 + te.minutes
        return total

    def to_dict(self, user_id=None):
        my_mins = 0
        if user_id:
            my_mins = sum(te.hours * 60 + te.minutes for te in self.time_entries if te.user_id == user_id)
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_title": self.project.title if self.project else None,
            "is_personal": self.project_id is None,
            "task_type_id": self.task_type_id,
            "task_type_name": self.task_type.name if self.task_type else None,
            "status_id": self.status_id,
            "status_title": self.status.title if self.status else None,
            "status_functional_type": self.status.functional_type if self.status else None,
            "title": self.title,
            "description": self.description,
            "planned_publish_date": self.planned_publish_date.isoformat(),
            "created_at": self.created_at.isoformat(),
            "is_late": self.is_late,
            "total_time_minutes": self.total_time_minutes,
            "prod_time_minutes": self.prod_time_minutes,
            "my_time_minutes": my_mins,
            "status_allowed_roles": self.status.allowed_roles if self.status else [],
            "task_type_statuses": [s.to_dict() for s in sorted(self.task_type.statuses, key=lambda x: x.id)] if self.task_type else [],
        }


class TaskAssignee(db.Model):
    """Users invited to / assigned on a task (drives 'Tâches associées' visibility)."""
    __tablename__ = "task_assignees"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role_on_task = db.Column(db.String(30))  # e.g. 'shooting_crew', 'editor', 'invited'

    user = db.relationship("User")


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship("User")
    mentions = db.relationship("CommentMention", backref="comment", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "author_id": self.author_id,
            "author_name": f"{self.author.first_name} {self.author.last_name}" if self.author else None,
            "body": self.body,
            "created_at": self.created_at.isoformat(),
            "mentioned_user_ids": [m.user_id for m in self.mentions],
        }


class CommentMention(db.Model):
    __tablename__ = "comment_mentions"

    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)


class TimeEntry(db.Model):
    """Manual time reporting: hours/minutes by a user, on a task, for a given date."""
    __tablename__ = "time_entries"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    entry_date = db.Column(db.Date, nullable=False)
    hours = db.Column(db.Integer, nullable=False, default=0)
    minutes = db.Column(db.Integer, nullable=False, default=0)
    # status the task was in when time was logged, for the "Historique" tab breakdown
    status_id_at_entry = db.Column(db.Integer, db.ForeignKey("statuses.id"))

    user = db.relationship("User")
    status_at_entry = db.relationship("Status", foreign_keys=[status_id_at_entry])

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "task_title": self.task.title if self.task else None,
            "project_id": self.task.project_id if self.task else None,
            "user_id": self.user_id,
            "user_name": f"{self.user.first_name} {self.user.last_name}" if self.user else None,
            "entry_date": self.entry_date.isoformat(),
            "hours": self.hours,
            "minutes": self.minutes,
            "status_id_at_entry": self.status_id_at_entry,
            "status_title_at_entry": self.status_at_entry.title if self.status_at_entry else None,
        }
    