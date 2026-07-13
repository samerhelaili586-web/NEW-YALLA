from app import db
from app.models.user import User
from app.models.task_type import TaskType, Status, Transition

DEMO_PASSWORD = "password123"


def run_seed():
    if User.query.first():
        return  # already seeded

    demo_users = [
        ("Amine", "Sys", "admin@yalla.local", "admin_sys", False),
        ("Sara", "Manager", "manager@yalla.local", "manager", False),
        ("Yassine", "CM", "cm@yalla.local", "cm", False),
        ("Karim", "Prod", "prod@yalla.local", "prod", False),
        ("Nour", "ChefProd", "chefprod@yalla.local", "prod", True),
    ]

    for first, last, email, role, is_chef in demo_users:
        u = User(first_name=first, last_name=last, email=email, role=role, is_chef_prod=is_chef)
        u.set_password(DEMO_PASSWORD)
        db.session.add(u)

    tt = TaskType(name="Publication réseaux sociaux")
    db.session.add(tt)
    db.session.flush()

    s1 = Status(task_type_id=tt.id, title="À faire", temporal_type="evolutif",
                functional_type="debut", allowed_roles=["cm", "admin_sys", "manager"])
    s2 = Status(task_type_id=tt.id, title="En cours", temporal_type="evolutif",
                functional_type="intermediaire", allowed_roles=["cm", "admin_sys", "manager"])
    s3 = Status(task_type_id=tt.id, title="Validé", temporal_type="evolutif",
                functional_type="final_confirmation", allowed_roles=[])
    db.session.add_all([s1, s2, s3])
    db.session.flush()

    db.session.add(Transition(from_status_id=s1.id, to_status_id=s2.id))
    db.session.add(Transition(from_status_id=s2.id, to_status_id=s3.id))

    db.session.commit()
    print(f"Seeded {len(demo_users)} demo users (password: {DEMO_PASSWORD})")