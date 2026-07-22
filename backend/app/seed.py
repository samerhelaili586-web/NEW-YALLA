from datetime import date, timedelta
from app import db
from app.models.user import User
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project, ProjectMonthlyTarget
from app.models.task import Task, TaskAssignee
from app.models.equipment import Equipment

DEMO_PASSWORD = "password123"


def run_seed():
    # Seed users if not present
    if not User.query.first():
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
        db.session.commit()

    admin_user = User.query.filter_by(role="admin_sys").first()
    cm_user = User.query.filter_by(role="cm").first() or admin_user
    prod_user = User.query.filter_by(role="prod", is_chef_prod=False).first() or admin_user

    # Seed TaskTypes if only default 1 task type exists or none
    tt = TaskType.query.filter_by(name="Publication réseaux sociaux").first()
    if not tt or len(tt.statuses) <= 3:
        if not tt:
            tt = TaskType(name="Publication réseaux sociaux", description="Workflow complet de publication digitale", workflow_status="active")
            db.session.add(tt)
            db.session.flush()
        else:
            tt.description = "Workflow complet de publication digitale"
            tt.workflow_status = "active"

        # Ensure all standard statuses exist
        status_specs = [
            ("debut", "debut", "evolutif", ["cm", "admin_sys", "manager"], 160, 160),
            ("Statut intermédiaire", "intermediaire", "fige", ["cm", "admin_sys", "manager"], 480, 160),
            ("ok", "planification_shooting", "fige", ["chef_prod", "admin_sys", "manager"], 800, 80),
            ("plan mon", "planification_montage", "fige", ["chef_prod", "admin_sys", "manager"], 800, 260),
            ("mon", "montage", "evolutif", ["prod", "admin_sys", "manager"], 1120, 160),
            ("fin", "final_confirmation", "fige", [], 1440, 80),
            ("rejet", "final_rejet", "fige", [], 1440, 260),
        ]

        status_map = {}
        for title, ftype, ttype, roles, px, py in status_specs:
            s = Status.query.filter_by(task_type_id=tt.id, title=title).first()
            if not s:
                s = Status(
                    task_type_id=tt.id,
                    title=title,
                    functional_type=ftype,
                    temporal_type=ttype,
                    allowed_roles=roles,
                    pos_x=px,
                    pos_y=py
                )
                db.session.add(s)
                db.session.flush()
            status_map[title] = s

        # Ensure transitions exist
        transition_pairs = [
            ("debut", "Statut intermédiaire"),
            ("Statut intermédiaire", "ok"),
            ("Statut intermédiaire", "plan mon"),
            ("ok", "fin"),
            ("plan mon", "mon"),
            ("mon", "fin"),
            ("mon", "rejet"),
        ]

        for from_t, to_t in transition_pairs:
            s_from = status_map[from_t]
            s_to = status_map[to_t]
            exists = Transition.query.filter_by(from_status_id=s_from.id, to_status_id=s_to.id).first()
            if not exists:
                db.session.add(Transition(from_status_id=s_from.id, to_status_id=s_to.id, allowed_roles=["cm", "admin_sys", "manager"]))

        db.session.commit()

    # Seed Projects if none exist
    if not Project.query.first():
        p1 = Project(
            title="Brand Campaign Summer 2026",
            start_date=date.today() - timedelta(days=15),
            remarks="Lancement officiel de la campagne estivale",
            cm_id=cm_user.id,
            status="actif"
        )
        p2 = Project(
            title="Lancement Produit YALLA App",
            start_date=date.today() - timedelta(days=5),
            remarks="Production vidéo teaser et démo interactive",
            cm_id=cm_user.id,
            status="actif"
        )
        db.session.add_all([p1, p2])
        db.session.flush()

        db.session.add(ProjectMonthlyTarget(project_id=p1.id, task_type_id=tt.id, monthly_count=8))
        db.session.add(ProjectMonthlyTarget(project_id=p2.id, task_type_id=tt.id, monthly_count=4))
        db.session.commit()

    # Seed Tasks if none exist
    if not Task.query.first():
        p1 = Project.query.first()
        statuses = tt.statuses
        s_debut = next((s for s in statuses if s.functional_type == "debut"), statuses[0])
        s_inter = next((s for s in statuses if s.functional_type == "intermediaire"), statuses[0])
        s_montage = next((s for s in statuses if s.functional_type == "montage"), statuses[0])

        t1 = Task(
            project_id=p1.id,
            task_type_id=tt.id,
            status_id=s_debut.id,
            title="Teaser Vidéo Instagram",
            description="Création du script et storyboard pour la vidéo teaser 30s.",
            planned_publish_date=date.today() + timedelta(days=7),
        )
        t2 = Task(
            project_id=p1.id,
            task_type_id=tt.id,
            status_id=s_inter.id,
            title="Reel Montage - Épisode 1",
            description="Dérushage et premier cut vidéo.",
            planned_publish_date=date.today() + timedelta(days=3),
        )
        t3 = Task(
            project_id=p1.id,
            task_type_id=tt.id,
            status_id=s_montage.id,
            title="Post LinkedIn - Article Stratégie",
            description="Rédaction et visuel d'accompagnement.",
            planned_publish_date=date.today() + timedelta(days=12),
        )

        db.session.add_all([t1, t2, t3])
        db.session.flush()

        # Add assignees
        db.session.add(TaskAssignee(task_id=t1.id, user_id=cm_user.id, role_on_task="cm"))
        db.session.add(TaskAssignee(task_id=t2.id, user_id=prod_user.id, role_on_task="monteur"))
        db.session.add(TaskAssignee(task_id=t3.id, user_id=cm_user.id, role_on_task="cm"))
        db.session.commit()

    # Seed Equipment if none exist
    if not Equipment.query.first():
        e1 = Equipment(name="Caméra Sony FX3", description="Caméra cinéma plein format 4K", is_active=True)
        e2 = Equipment(name="Kit Micro HF Rode", description="Double transmetteur sans fil + récepteur", is_active=True)
        e3 = Equipment(name="Éclairage LED Aputure 300d", description="Projecteur COB 300W Daylight", is_active=True)
        db.session.add_all([e1, e2, e3])
        db.session.commit()

    print("Seed complete: users, task types, statuses, transitions, projects, tasks, equipment ready.")