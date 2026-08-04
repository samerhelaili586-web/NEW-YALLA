"""
Car Rental ("Location de voitures") Demo Seed Script.
Populates a complete working demo of the YALLA platform operating as a Car Rental company
using ONLY generic admin configuration tables (CustomRole, CustomList, TaskType/Status/Transition, Project, Task).
"""

from datetime import date, datetime, timedelta, timezone
from app import db
from app.models.user import User
from app.models.custom_role import CustomRole
from app.models.custom_list import CustomList, CustomListField, CustomListItem
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project, ProjectMonthlyTarget
from app.models.project_permission import ProjectTaskPermission
from app.models.task import Task, TaskAssignee, TimeEntry, Comment

from app.models.shoot import Shoot, ShootCrew
from app.models.equipment import Equipment
from app.models.leave import LeaveRequest, SickAbsence, Holiday
from app.models.user import LoginHistory

DEMO_PASSWORD = "password123"


def clear_all_data():
    print("[+] Clearing all legacy database records...")
    Comment.query.delete()
    TimeEntry.query.delete()
    TaskAssignee.query.delete()
    Task.query.delete()
    ProjectTaskPermission.query.delete()
    ProjectMonthlyTarget.query.delete()
    Project.query.delete()
    Transition.query.delete()
    Status.query.delete()
    TaskType.query.delete()
    CustomListItem.query.delete()
    CustomListField.query.delete()
    CustomList.query.delete()
    CustomRole.query.delete()
    ShootCrew.query.delete()
    Shoot.query.delete()
    Equipment.query.delete()
    LeaveRequest.query.delete()
    SickAbsence.query.delete()
    Holiday.query.delete()
    LoginHistory.query.delete()
    User.query.delete()
    db.session.commit()
    print("  [OK] Legacy database records cleared.")


def seed_car_rental():
    clear_all_data()
    print("[+] Seeding Car Rental ('Location de voitures') Demo Data...")

    # ── 1. CUSTOM ROLES ────────────────────────────────────────────────────────
    custom_roles_data = [
        {
            "key": "agent_accueil",
            "label": "Agent d'accueil",
            "color": "#3b82f6",  # blue
            "participates_in_workflow": True,
            "visibility_mode": "all",
            "menu_permissions": ["annuaire", "projets_tous", "taches_associees", "feuille_presence_perso", "conges_absences"],
            "action_permissions": ["creer_tache", "changer_statut_standard", "ajouter_commentaire"],
        },
        {
            "key": "chauffeur",
            "label": "Chauffeur",
            "color": "#eab308",  # yellow/amber
            "participates_in_workflow": True,
            "visibility_mode": "actionable",  # Chauffeur sees ONLY actionable tasks!
            "menu_permissions": ["taches_associees", "feuille_presence_perso", "conges_absences"],
            "action_permissions": ["changer_statut_standard", "reporter_temps", "ajouter_commentaire"],
        },
        {
            "key": "resp_flotte",
            "label": "Responsable flotte",
            "color": "#ec4899",  # pink
            "participates_in_workflow": True,
            "visibility_mode": "all",
            "menu_permissions": ["annuaire", "projets_tous", "taches_associees", "gestion_workflows", "feuille_presence_perso", "conges_absences"],
            "action_permissions": ["creer_tache", "changer_statut_standard", "changer_statut_planification", "forcer_statut", "ajouter_commentaire"],
        },
        {
            "key": "comptable",
            "label": "Comptable",
            "color": "#10b981",  # emerald green
            "participates_in_workflow": True,
            "visibility_mode": "all",  # narrow read-only / billing focus
            "menu_permissions": ["annuaire", "projets_tous", "salaires_paie", "feuille_presence_perso", "conges_absences"],
            "action_permissions": ["ajouter_commentaire"],
        },
    ]

    roles_map = {}
    for r_data in custom_roles_data:
        role = CustomRole.query.filter_by(key=r_data["key"]).first()
        if not role:
            role = CustomRole(
                key=r_data["key"],
                label=r_data["label"],
                color=r_data["color"],
                is_builtin=False,
                participates_in_workflow=r_data["participates_in_workflow"],
                visibility_mode=r_data["visibility_mode"],
                menu_permissions=r_data["menu_permissions"],
                action_permissions=r_data["action_permissions"],
            )
            db.session.add(role)
            db.session.flush()
        else:
            role.label = r_data["label"]
            role.color = r_data["color"]
            role.visibility_mode = r_data["visibility_mode"]
            role.menu_permissions = r_data["menu_permissions"]
            role.action_permissions = r_data["action_permissions"]
        roles_map[r_data["key"]] = role
    db.session.commit()
    print("  [OK] 4 Custom Roles seeded/updated.")

    # ── 2. USERS ───────────────────────────────────────────────────────────────
    rental_users_spec = [
        ("Admin", "Sys", "admin@yalla.local", "admin_sys", "+216 20 100 001", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"),
        ("Amira", "Ben Salem", "agent.tunis@location.local", "agent_accueil", "+216 22 111 001", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"),
        ("Sonia", "Gharbi", "agent.sousse@location.local", "agent_accueil", "+216 22 111 002", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"),
        ("Khalil", "Jlassi", "chauffeur.khalil@location.local", "chauffeur", "+216 22 222 001", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"),
        ("Karim", "Trabelsi", "flotte.karim@location.local", "resp_flotte", "+216 22 333 001", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"),
        ("Sami", "Ayari", "comptable.sami@location.local", "comptable", "+216 22 444 001", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150"),
    ]

    users_map = {}
    for first, last, email, role_key, phone, photo in rental_users_spec:
        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(
                first_name=first,
                last_name=last,
                email=email,
                role=role_key,
                phone=phone,
                photo_url=photo,
                hourly_rate=15.0,
                monthly_hours_goal=180,
            )
            u.set_password(DEMO_PASSWORD)
            db.session.add(u)
            db.session.flush()
        else:
            u.first_name = first
            u.last_name = last
            u.role = role_key
            u.phone = phone
            u.photo_url = photo
        users_map[email] = u
    db.session.commit()
    print("  [OK] 5 Demo Users seeded.")

    # ── 3. CUSTOM LIST: "Voitures" ──────────────────────────────────────────────
    c_list = CustomList.query.filter_by(name="Voitures").first()
    if not c_list:
        c_list = CustomList(
            name="Voitures",
            icon="🚗",
            description="Flotte de véhicules disponibles à la location.",
        )
        db.session.add(c_list)
        db.session.flush()

        fields_spec = [
            ("plaque", "Plaque d'immatriculation", "text", [], True),
            ("modele", "Modèle & Marque", "text", [], True),
            ("kilometrage", "Kilométrage actuel (km)", "number", [], True),
            ("prime", "Tarif / Valeur assurance", "text", [], True),
            ("categorie", "Catégorie", "select", ["Économique", "Berline", "SUV", "Luxe"], True),
        ]
        for pos, (key, label, ftype, opts, req) in enumerate(fields_spec):
            f = CustomListField(
                list_id=c_list.id,
                key=key,
                label=label,
                field_type=ftype,
                options=opts,
                is_required=req,
                position=pos,
            )
            db.session.add(f)
        db.session.flush()

    # Seed 9 sample cars into CustomListItem table
    cars_sample = [
        {"plaque": "210 TUN 1234", "modele": "Volkswagen Golf 8", "kilometrage": 35000, "prime": "120 TND/jour", "categorie": "Berline"},
        {"plaque": "215 TUN 5678", "modele": "Renault Clio 5", "kilometrage": 18000, "prime": "85 TND/jour", "categorie": "Économique"},
        {"plaque": "220 TUN 9012", "modele": "Peugeot 208", "kilometrage": 24000, "prime": "90 TND/jour", "categorie": "Économique"},
        {"plaque": "225 TUN 3456", "modele": "Hyundai Tucson", "kilometrage": 42000, "prime": "180 TND/jour", "categorie": "SUV"},
        {"plaque": "230 TUN 7890", "modele": "Toyota RAV4 Hybrid", "kilometrage": 15000, "prime": "200 TND/jour", "categorie": "SUV"},
        {"plaque": "235 TUN 2345", "modele": "Mercedes-Benz Classe C", "kilometrage": 12000, "prime": "350 TND/jour", "categorie": "Luxe"},
        {"plaque": "240 TUN 6789", "modele": "BMW Série 3 M-Sport", "kilometrage": 9500, "prime": "380 TND/jour", "categorie": "Luxe"},
        {"plaque": "245 TUN 1122", "modele": "Kia Picanto GT-Line", "kilometrage": 28000, "prime": "75 TND/jour", "categorie": "Économique"},
        {"plaque": "250 TUN 3344", "modele": "Audi Q5 Quattro", "kilometrage": 19000, "prime": "320 TND/jour", "categorie": "SUV"},
    ]

    all_existing = CustomListItem.query.filter_by(list_id=c_list.id).all()
    existing_plaques = {item.data.get("plaque") for item in all_existing}
    for car_data in cars_sample:
        if car_data["plaque"] not in existing_plaques:
            item = CustomListItem(list_id=c_list.id, data=car_data)
            db.session.add(item)
    db.session.commit()
    print("  [OK] Custom List 'Voitures' seeded with 9 vehicles.")

    # ── 3B. EQUIPMENT / MATÉRIEL (Rental Options & Accessories) ────────────────
    equipments_data = [
        ("Siège Auto Bébé ISOFIX (0-4 ans)", "Siège de sécurité enfant universel norme i-Size", "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=200"),
        ("GPS Navigateur Garmin DrivePro 6.5\"", "Navigateur satellite tactile avec cartes Tunisie & Europe", "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200"),
        ("Chaînes à Neige & Pneus Hiver", "Kit complet 2 chaînes acier renforcé + housse de rangement", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=200"),
        ("Coffre de Toit Thule Motion 450L", "Coffre de toit aérodynamique grand volume avec serrures à clé", "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200"),
        ("Porte-Vélos d'attelage (3 Vélos)", "Support vélos basculant universel avec verrouillage sécurisé", "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=200"),
        ("Dashcam 4K HD Front & Rear", "Caméra de sécurité embarquée double objectif avec carte 128Go", "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200"),
        ("Kit de Secours & Trousse Médicale", "Extincteur 1kg + triangle + gilet + trousse soins d'urgence", "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=200"),
        ("Éthylotest Électronique Pro", "Appareil de mesure numérique à capteur électrochimique de précision", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200"),
    ]
    for eq_name, eq_desc, eq_img in equipments_data:
        if not Equipment.query.filter_by(name=eq_name).first():
            db.session.add(Equipment(name=eq_name, description=eq_desc, image_url=eq_img, is_active=True))
    db.session.commit()
    print("  [OK] 8 Rental Equipment items seeded.")

    # ── 4. WORKFLOW: "Location de véhicules" ───────────────────────────────────
    workflow = TaskType.query.filter_by(name="Location de véhicules").first()
    if not workflow:
        workflow = TaskType(
            name="Location de véhicules",
            description="Processus complet de réservation, mise à disposition, restitution et facturation de véhicule.",
            workflow_status="active",
        )
        db.session.add(workflow)
        db.session.flush()

    status_specs = [
        # (title, functional_type, temporal_type, allowed_roles, pos_x, pos_y)
        ("Demande reçue", "debut", "evolutif", ["agent_accueil", "admin_sys", "manager"], 120, 160),
        ("Vérification disponibilité", "intermediaire", "fige", ["resp_flotte", "admin_sys", "manager"], 440, 160),
        ("Remise du véhicule", "planification_shooting", "fige", ["chauffeur", "admin_sys", "manager"], 760, 160),
        ("En location", "montage", "evolutif", ["chauffeur", "agent_accueil", "admin_sys", "manager"], 1080, 160),
        ("Retour du véhicule", "intermediaire", "fige", ["chauffeur", "admin_sys", "manager"], 1400, 160),
        ("Facturation", "intermediaire", "fige", ["comptable", "agent_accueil", "admin_sys", "manager"], 1720, 160),
        ("Terminé", "final_confirmation", "fige", [], 2040, 160),
    ]

    status_map = {}
    for title, ftype, ttype, roles, px, py in status_specs:
        s = Status.query.filter_by(task_type_id=workflow.id, title=title).first()
        if not s:
            s = Status(
                task_type_id=workflow.id,
                title=title,
                functional_type=ftype,
                temporal_type=ttype,
                allowed_roles=roles,
                pos_x=px,
                pos_y=py,
            )
            db.session.add(s)
            db.session.flush()
        else:
            s.functional_type = ftype
            s.temporal_type = ttype
            s.allowed_roles = roles
            s.pos_x = px
            s.pos_y = py
        status_map[title] = s
    db.session.commit()

    # Transitions with strict per-transition allowed_roles and list_select form fields!
    transitions_spec = [
        {
            "from": "Demande reçue",
            "to": "Vérification disponibilité",
            "roles": ["agent_accueil", "resp_flotte", "admin_sys", "manager"],
            "form_fields": [],
        },
        {
            "from": "Vérification disponibilité",
            "to": "Remise du véhicule",
            "roles": ["resp_flotte", "admin_sys", "manager"],
            "form_fields": [],
        },
        {
            "from": "Remise du véhicule",
            "to": "En location",
            "roles": ["chauffeur"],  # STRICTLY CHAUFFEUR!
            "form_fields": [
                {
                    "id": "vehicule_attribue",
                    "name": "vehicule_attribue",
                    "label": "Véhicule attribué",
                    "type": "list_select",
                    "list_id": c_list.id,
                    "capture_fields": ["plaque", "modele", "prime"],
                    "required": True,
                }
            ],
        },
        {
            "from": "En location",
            "to": "Retour du véhicule",
            "roles": ["chauffeur"],  # STRICTLY CHAUFFEUR!
            "form_fields": [
                {
                    "id": "etat_restitution",
                    "name": "etat_restitution",
                    "label": "État du véhicule à la restitution",
                    "type": "text",
                    "required": True,
                },
                {
                    "id": "nouveau_km",
                    "name": "nouveau_km",
                    "label": "Nouveau kilométrage",
                    "type": "number",
                    "required": True,
                },
            ],
        },
        {
            "from": "Retour du véhicule",
            "to": "Facturation",
            "roles": ["chauffeur", "agent_accueil", "admin_sys", "manager"],
            "form_fields": [],
        },
        {
            "from": "Facturation",
            "to": "Terminé",
            "roles": ["comptable", "admin_sys", "manager"],
            "form_fields": [],
        },
    ]

    for t_spec in transitions_spec:
        s_from = status_map[t_spec["from"]]
        s_to = status_map[t_spec["to"]]
        trans = Transition.query.filter_by(from_status_id=s_from.id, to_status_id=s_to.id).first()
        if not trans:
            trans = Transition(
                from_status_id=s_from.id,
                to_status_id=s_to.id,
                allowed_roles=t_spec["roles"],
                form_fields=t_spec["form_fields"],
            )
            db.session.add(trans)
        else:
            trans.allowed_roles = t_spec["roles"]
            trans.form_fields = t_spec["form_fields"]
    db.session.commit()
    print("  [OK] Workflow 'Location de véhicules' seeded with 7 statuses & 6 transitions.")

    # ── 5. PROJECTS (Rental Agencies / Branches) ──────────────────────────────
    branches = [
        {
            "title": "Agence Tunis Carthage",
            "remarks": "Succursale principale - Aéroport Tunis Carthage",
            "agent_email": "agent.tunis@location.local",
        },
        {
            "title": "Agence Sousse Ville",
            "remarks": "Succursale Sahel - Boulevard Kantaoui",
            "agent_email": "agent.sousse@location.local",
        },
    ]

    projects_map = {}
    for b in branches:
        agent_user = users_map[b["agent_email"]]
        p = Project.query.filter_by(title=b["title"]).first()
        if not p:
            p = Project(
                title=b["title"],
                start_date=date.today(),
                remarks=b["remarks"],
                cm_id=agent_user.id,
                status="actif"
            )
            db.session.add(p)
            db.session.flush()
        projects_map[b["title"]] = p

        # Configure task creation rule: only assigned Agent d'accueil can create tasks in their branch
        agent_user = users_map[b["agent_email"]]
        perm = ProjectTaskPermission.query.filter_by(project_id=p.id, user_id=agent_user.id).first()
        if not perm:
            db.session.add(ProjectTaskPermission(
                project_id=p.id,
                user_id=agent_user.id,
                can_create=True,
            ))
    db.session.commit()
    print("  [OK] 2 Agency Projects seeded with per-project creation permissions.")

    # ── 6. SEED DEMO TASKS (Rental Requests moving through workflow) ───────────
    tunis_proj = projects_map["Agence Tunis Carthage"]
    sousse_proj = projects_map["Agence Sousse Ville"]

    demo_rentals = [
        {
            "project": tunis_proj,
            "title": "Location - M. Youssef Chahed (Golf 8)",
            "description": "Client VIP - Réservation 5 jours du 10 au 15 Août.",
            "status_title": "Demande reçue",
            "due": date.today() + timedelta(days=5),
        },
        {
            "project": tunis_proj,
            "title": "Location - Mme. Ines Mansour (Tucson)",
            "description": "Réservation SUV famille 7 jours.",
            "status_title": "Remise du véhicule",
            "due": date.today() + timedelta(days=2),
        },
        {
            "project": sousse_proj,
            "title": "Location - M. Mehdi Ben Ammar (Mercedes C)",
            "description": "Véhicule de luxe pour événement diplomatique.",
            "status_title": "En location",
            "due": date.today() + timedelta(days=3),
        },
        {
            "project": sousse_proj,
            "title": "Location - Mme. Olfa Saidi (Clio 5)",
            "description": "Location 3 jours terminée - En attente retour.",
            "status_title": "Retour du véhicule",
            "due": date.today() + timedelta(days=1),
        },
    ]

    for rental in demo_rentals:
        t = Task.query.filter_by(title=rental["title"]).first()
        st = status_map[rental["status_title"]]
        if not t:
            t = Task(
                project_id=rental["project"].id,
                task_type_id=workflow.id,
                status_id=st.id,
                title=rental["title"],
                description=rental["description"],
                planned_publish_date=rental["due"],
            )
            db.session.add(t)
            db.session.flush()

            # Assign Chauffeur & Agent to task
            khalil = users_map["chauffeur.khalil@location.local"]
            agent = users_map[rental["project"].title == "Agence Tunis Carthage" and "agent.tunis@location.local" or "agent.sousse@location.local"]
            db.session.add(TaskAssignee(task_id=t.id, user_id=khalil.id))
            db.session.add(TaskAssignee(task_id=t.id, user_id=agent.id))

    db.session.commit()
    print("  [OK] Demo Rental Tasks seeded across workflow statuses.")

    # ── 7. SEED TIME ENTRIES FOR ATTENDANCE SHEET ────────────────────────────
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sample_task = Task.query.first()

    if sample_task:
        for u_email, user_obj in users_map.items():
            if user_obj.role == "admin_sys":
                continue
            for day_offset in range(5):  # Mon-Fri
                entry_d = monday + timedelta(days=day_offset)
                if entry_d <= today:
                    exists_te = TimeEntry.query.filter_by(user_id=user_obj.id, entry_date=entry_d).first()
                    if not exists_te:
                        te = TimeEntry(
                            task_id=sample_task.id,
                            user_id=user_obj.id,
                            entry_date=entry_d,
                            hours=7,
                            minutes=30,
                            status_id_at_entry=sample_task.status_id,
                        )
                        db.session.add(te)
        db.session.commit()
        print("  [OK] Attendance Time Entries seeded for current week.")

    print("[SUCCESS] Car Rental Demo Seeding Complete!")


if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        seed_car_rental()
