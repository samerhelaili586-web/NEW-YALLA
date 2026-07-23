from datetime import date, datetime, timedelta, timezone
from app import db
from app.models.user import User, LoginHistory
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project, ProjectMonthlyTarget
from app.models.task import Task, TaskAssignee, TimeEntry, Comment
from app.models.equipment import Equipment
from app.models.shoot import Shoot, ShootCrew
from app.models.leave import LeaveRequest, SickAbsence, Holiday

DEMO_PASSWORD = "password123"


def run_seed():
    # ── 1. USERS ─────────────────────────────────────────────────────────────
    # Standard company roster across all departments
    demo_users = [
        # (first_name, last_name, email, role, is_chef_prod, phone, photo)
        ("Amine", "Sys", "admin@yalla.local", "admin_sys", False, "+216 20 100 001", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"),
        ("Sara", "Manager", "manager@yalla.local", "manager", False, "+216 20 100 002", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"),
        ("Tariq", "Benali", "tariq.manager@yalla.local", "manager", False, "+216 20 100 003", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"),
        ("Nour", "ChefProd", "chefprod@yalla.local", "prod", True, "+216 20 200 001", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"),
        ("Sofiane", "Baccouche", "sofiane.chefprod@yalla.local", "prod", True, "+216 20 200 002", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"),
        ("Yassine", "CM", "cm@yalla.local", "cm", False, "+216 20 300 001", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150"),
        ("Ines", "Mansour", "ines.cm@yalla.local", "cm", False, "+216 20 300 002", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150"),
        ("Lina", "Trabelsi", "lina.cm@yalla.local", "cm", False, "+216 20 300 003", "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150"),
        ("Karim", "Prod", "prod@yalla.local", "prod", False, "+216 20 400 001", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150"),
        ("Mehdi", "Gharbi", "mehdi.prod@yalla.local", "prod", False, "+216 20 400 002", "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150"),
        ("Cyrine", "Saidi", "cyrine.prod@yalla.local", "prod", False, "+216 20 400 003", "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150"),
        ("Bilel", "Zorgati", "bilel.prod@yalla.local", "prod", False, "+216 20 400 004", "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150"),
    ]

    rate_map = {
        "admin_sys": 25.0,  # 25.00 TND/h -> 4 500 TND/mois (Admin Système IT Senior)
        "manager": 20.0,    # 20.00 TND/h -> 3 600 TND/mois (Manager / Chef de Projet Digital)
        "cm": 11.0,         # 11.00 TND/h -> 1 980 TND/mois (Community Manager Confirmé)
        "prod": 12.5,       # 12.50 TND/h -> 2 250 TND/mois (Monteur / Cadreur / Prod Confirmé)
    }

    user_map = {}
    for first, last, email, role, is_chef, phone, photo in demo_users:
        u = User.query.filter_by(email=email).first()
        h_rate = 18.0 if is_chef else rate_map.get(role, 12.5)  # 18.00 TND/h -> 3 240 TND/mois for Chef Prod
        if not u:
            u = User(
                first_name=first,
                last_name=last,
                email=email,
                role=role,
                is_chef_prod=is_chef,
                phone=phone,
                photo_url=photo,
                hourly_rate=h_rate,
                monthly_hours_goal=180,
            )
            u.set_password(DEMO_PASSWORD)
            db.session.add(u)
            db.session.flush()
        else:
            u.first_name = first
            u.last_name = last
            u.phone = phone
            u.photo_url = photo
            u.is_chef_prod = is_chef
            u.hourly_rate = h_rate
            u.monthly_hours_goal = 180
        user_map[email] = u
    db.session.commit()

    admin_user = user_map["admin@yalla.local"]
    sara_manager = user_map["manager@yalla.local"]
    yassine_cm = user_map["cm@yalla.local"]
    ines_cm = user_map["ines.cm@yalla.local"]
    lina_cm = user_map["lina.cm@yalla.local"]
    nour_chef = user_map["chefprod@yalla.local"]
    sofiane_chef = user_map["sofiane.chefprod@yalla.local"]
    karim_prod = user_map["prod@yalla.local"]
    mehdi_prod = user_map["mehdi.prod@yalla.local"]
    cyrine_prod = user_map["cyrine.prod@yalla.local"]

    # ── 2. WORKFLOWS, STATUSES & TRANSITIONS ─────────────────────────────────
    tt = TaskType.query.filter_by(name="Publication réseaux sociaux").first()
    if not tt:
        tt = TaskType(
            name="Publication réseaux sociaux",
            description="Workflow complet de création vidéo et contenu digital pour les marques clients.",
            workflow_status="active",
        )
        db.session.add(tt)
        db.session.flush()
    else:
        tt.description = "Workflow complet de création vidéo et contenu digital pour les marques clients."
        tt.workflow_status = "active"

    # Statuses adhering 100% to all 7 validation rules (no consecutive evolutif statuses)
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
                pos_y=py,
            )
            db.session.add(s)
            db.session.flush()
        else:
            s.temporal_type = ttype
            s.functional_type = ftype
            s.allowed_roles = roles
            s.pos_x = px
            s.pos_y = py
        status_map[title] = s

    transition_pairs = [
        ("debut", "Statut intermédiaire", ["cm", "admin_sys", "manager"]),
        ("Statut intermédiaire", "ok", ["cm", "admin_sys", "manager"]),
        ("Statut intermédiaire", "plan mon", ["cm", "admin_sys", "manager"]),
        ("ok", "fin", ["chef_prod", "admin_sys", "manager"]),
        ("plan mon", "mon", ["chef_prod", "admin_sys", "manager"]),
        ("mon", "fin", ["prod", "admin_sys", "manager"]),
        ("mon", "rejet", ["prod", "admin_sys", "manager"]),
    ]

    for from_t, to_t, roles in transition_pairs:
        s_from = status_map[from_t]
        s_to = status_map[to_t]
        exists = Transition.query.filter_by(from_status_id=s_from.id, to_status_id=s_to.id).first()
        if not exists:
            db.session.add(Transition(from_status_id=s_from.id, to_status_id=s_to.id, allowed_roles=roles))
        else:
            exists.allowed_roles = roles

    db.session.commit()

    # ── 3. EQUIPMENT INVENTORY ───────────────────────────────────────────────
    equipment_items = [
        ("Caméra Cinema Sony FX3", "Caméra cinéma plein format 4K FX3 avec poignée XLR et rig complet", "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300"),
        ("Caméra RED Komodo 6K", "Système de prise de vue Super 35 6K Global Shutter", "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300"),
        ("Kit Micro HF Rode Wireless GO II", "Double transmetteur sans fil + récepteur avec lavaliers omnidirectionnels", "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300"),
        ("Éclairage LED Aputure 600d Pro", "Projecteur COB 600W Daylight haute intensité avec softbox octogonale 150cm", "https://images.unsplash.com/photo-1527049979667-990f1d0d8e7f?w=300"),
        ("Stabilisateur DJI Ronin RS 3 Pro", "Gimbal 3 axes en fibre de carbone avec moteur Focus LiDAR", "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300"),
        ("Drone DJI Mavic 3 Pro Cine", "Drone triple caméra Hasselblad Apple ProRes 422 HQ", "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=300"),
        ("Objectif Canon RF 24-70mm f/2.8 L", "Zoom standard professionnel série L avec stabilisation d'image IS", "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=300"),
        ("Micro Canon Shotgun Sennheiser MKH416", "Microphone canon de référence pour les voix off et extérieurs", "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300"),
    ]

    equip_map = {}
    for name, desc, img in equipment_items:
        eq = Equipment.query.filter_by(name=name).first()
        if not eq:
            eq = Equipment(name=name, description=desc, image_url=img, is_active=True)
            db.session.add(eq)
            db.session.flush()
        equip_map[name] = eq
    db.session.commit()

    # ── 4. PROJECTS & TARGETS ────────────────────────────────────────────────
    project_data = [
        ("Ooredoo Summer Campaign 2026", date.today() - timedelta(days=30), "Campagne estivale 360° vidéo & réseaux sociaux", yassine_cm.id, "actif", 12),
        ("Darty Brand Refresh & TikTok Series", date.today() - timedelta(days=20), "Série de vidéos TikTok démo produits et tutos", ines_cm.id, "actif", 8),
        ("Tunisie Telecom Ramadan Reels", date.today() - timedelta(days=15), "Capsules vidéos quotidiennes pour les réseaux sociaux", lina_cm.id, "actif", 16),
        ("Carrefour Digital Back-to-School", date.today() - timedelta(days=10), "Promotions rentrée scolaire et jeux concours", yassine_cm.id, "actif", 6),
        ("Yalla Agency Motion Showcase", date.today() - timedelta(days=45), "Showreel interne de l'agence et études de cas", ines_cm.id, "actif", 4),
    ]

    project_map = {}
    for title, sdate, remarks, cm_id, pstatus, mcount in project_data:
        p = Project.query.filter_by(title=title).first()
        if not p:
            p = Project(
                title=title,
                start_date=sdate,
                remarks=remarks,
                cm_id=cm_id,
                status=pstatus,
            )
            db.session.add(p)
            db.session.flush()

            # Target
            target = ProjectMonthlyTarget(project_id=p.id, task_type_id=tt.id, monthly_count=mcount)
            db.session.add(target)
        project_map[title] = p
    db.session.commit()

    p_ooredoo = project_map["Ooredoo Summer Campaign 2026"]
    p_darty = project_map["Darty Brand Refresh & TikTok Series"]
    p_tt = project_map["Tunisie Telecom Ramadan Reels"]
    p_carrefour = project_map["Carrefour Digital Back-to-School"]
    p_showcase = project_map["Yalla Agency Motion Showcase"]

    # ── 5. RICH TASKS ACROSS WORKFLOW STAGES ──────────────────────────────────
    # Clean up existing task-dependent records to establish a cohesive agency board
    ShootCrew.query.delete()
    Shoot.query.delete()
    TimeEntry.query.delete()
    Comment.query.delete()
    TaskAssignee.query.delete()
    Task.query.delete()
    LeaveRequest.query.delete()
    SickAbsence.query.delete()
    Holiday.query.delete()
    LoginHistory.query.delete()
    db.session.commit()

    today = date.today()

    task_definitions = [
        # (project, status_key, title, desc, due_offset_days, cm, monteur)
        (p_ooredoo, "debut", "Teaser Vidéo 4K Offre Internet 5G", "Scripting et moodboard visuel pour la campagne 5G Ooredoo.", 5, yassine_cm, karim_prod),
        (p_ooredoo, "Statut intermédiaire", "Story Series - Offres Roaming", "Visuels Instagram Stories & carrousels d'été.", 2, yassine_cm, mehdi_prod),
        (p_ooredoo, "ok", "Shooting Extérieur Hammamet - Spot Vague", "Tournage de la scène de plage avec modèle et drone.", 1, yassine_cm, karim_prod),
        (p_ooredoo, "plan mon", "Montage Reel 60s - Plage & Soleil", "Planification de la session de montage avec colorimétrie teal & orange.", 4, yassine_cm, karim_prod),
        (p_ooredoo, "mon", "Montage Final Spot TV & Web 30s", "Dérushage, étalonnage DaVinci et habillage sonore.", -1, yassine_cm, karim_prod),
        (p_ooredoo, "fin", "Publication Capsule TikTok 5G Speed Test", "Vidéo validée par la direction et publiée sur TikTok.", -5, yassine_cm, mehdi_prod),

        (p_darty, "debut", "Concept TikTok - Tuto Air Fryer", "Rédaction du script comique 'Astuces Cuisine'.", 7, ines_cm, cyrine_prod),
        (p_darty, "Statut intermédiaire", "Carrousel Produit High-Tech 2026", "Design des templates visuels 1080x1350 sur Figma.", 3, ines_cm, mehdi_prod),
        (p_darty, "ok", "Tournage In-Store Magasin Darty Lac", "Tournage démonstration produit en magasin avec Nour.", 0, ines_cm, karim_prod),
        (p_darty, "mon", "Montage Tuto Machine à Café Express", "Cut dynamique 15s avec musique tendance et sous-titres animés.", 2, ines_cm, cyrine_prod),
        (p_darty, "fin", "Vidéo Review Smartphone Flagship", "Contenu approuvé et en ligne.", -2, ines_cm, karim_prod),

        (p_tt, "debut", "Script Capsule Humoristique Ramadan", "Écriture des dialogues pour l'épisode 3.", 8, lina_cm, karim_prod),
        (p_tt, "plan mon", "Planification Montage Épisode 2 - Iftar", "Préparation des effets spéciaux et titrage arabe.", 3, lina_cm, mehdi_prod),
        (p_tt, "mon", "Montage Épisode 1 - Ambiance Famille", "Montage principal avec voix off et enregistrement d'ambiance.", 1, lina_cm, cyrine_prod),
        (p_tt, "fin", "Teaser Ramadan Karim 2026", "Diffusion réussie sur Instagram et Facebook.", -4, lina_cm, karim_prod),
        (p_tt, "rejet", "Spot Radio & Capsule Story #1", "À refaire : ajuster le niveau sonore de la musique de fond.", -1, lina_cm, cyrine_prod),

        (p_carrefour, "debut", "Brief Rentrée Scolaire - Promo Fournitures", "Cadrage des offres promotionnelles avec l'équipe marketing.", 6, yassine_cm, karim_prod),
        (p_carrefour, "ok", "Tournage Rayon Papeterie & Cartables", "Prises de vue dynamiques au gimbal.", 2, yassine_cm, karim_prod),
        (p_showcase, "fin", "Showreel Vidéo Agence Yalla 2026", "Compilations des plus beaux projets de l'année.", -10, ines_cm, mehdi_prod),
    ]

    created_tasks = []
    for proj, skey, title, desc, due_days, cm, monteur in task_definitions:
        status_obj = status_map[skey]
        t = Task(
            project_id=proj.id,
            task_type_id=tt.id,
            status_id=status_obj.id,
            title=title,
            description=desc,
            planned_publish_date=today + timedelta(days=due_days),
        )
        db.session.add(t)
        db.session.flush()

        # Assignees
        db.session.add(TaskAssignee(task_id=t.id, user_id=cm.id, role_on_task="cm"))
        if monteur:
            db.session.add(TaskAssignee(task_id=t.id, user_id=monteur.id, role_on_task="monteur"))

        # Activity comments
        c1 = Comment(
            task_id=t.id,
            author_id=cm.id,
            body=f"📌 **Tâche initialisée** pour le projet *{proj.title}*. Échéance fixée au {t.planned_publish_date.strftime('%d/%m/%Y')}.",
            created_at=datetime.now(timezone.utc) - timedelta(days=3),
        )
        db.session.add(c1)

        if skey in ("ok", "plan mon", "mon", "fin"):
            c2 = Comment(
                task_id=t.id,
                author_id=nour_chef.id,
                body=f"🎬 Validé en revue de production par @{nour_chef.first_name}. Passage à l'étape suivante.",
                created_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            db.session.add(c2)

        created_tasks.append(t)

    db.session.commit()

    # ── 6. SHOOTS & EQUIPMENT RESERVATIONS ──────────────────────────────────
    # Create realistic shooting events
    shoot_tasks = [t for t in created_tasks if t.status.functional_type in ("planification_shooting", "ok")]
    fx3_cam = equip_map["Caméra Cinema Sony FX3"]
    red_cam = equip_map["Caméra RED Komodo 6K"]

    if shoot_tasks:
        # Shoot 1: Today
        t_shoot1 = shoot_tasks[0]
        s1 = Shoot(
            task_id=t_shoot1.id,
            equipment_id=fx3_cam.id,
            start_at=datetime.now(timezone.utc).replace(hour=9, minute=0, second=0),
            end_at=datetime.now(timezone.utc).replace(hour=13, minute=0, second=0),
        )
        db.session.add(s1)
        db.session.flush()
        db.session.add(ShootCrew(shoot_id=s1.id, user_id=nour_chef.id, is_invited_only=False))
        db.session.add(ShootCrew(shoot_id=s1.id, user_id=karim_prod.id, is_invited_only=False))
        db.session.add(ShootCrew(shoot_id=s1.id, user_id=yassine_cm.id, is_invited_only=True))

        if len(shoot_tasks) > 1:
            # Shoot 2: Tomorrow
            t_shoot2 = shoot_tasks[1]
            s2 = Shoot(
                task_id=t_shoot2.id,
                equipment_id=red_cam.id,
                start_at=datetime.now(timezone.utc).replace(hour=14, minute=0, second=0) + timedelta(days=1),
                end_at=datetime.now(timezone.utc).replace(hour=18, minute=0, second=0) + timedelta(days=1),
            )
            db.session.add(s2)
            db.session.flush()
            db.session.add(ShootCrew(shoot_id=s2.id, user_id=sofiane_chef.id, is_invited_only=False))
            db.session.add(ShootCrew(shoot_id=s2.id, user_id=karim_prod.id, is_invited_only=False))

    # ── 7. TIME ENTRIES (FOR TIMESHEET / ATTENDANCE & PAYROLL) ─────────────
    # Realistic 45h/week schedule for July 2026 (8h Mon-Fri + 5h Sat):
    all_users_list = list(user_map.values())
    july_start = date(2026, 7, 1)
    july_end = min(date(2026, 7, 31), date.today())

    current_d = july_start
    while current_d <= july_end:
        w = current_d.weekday()
        if w < 5:  # Mon - Fri (8 hours)
            h, m = 8, 0
        elif w == 5:  # Saturday (5 hours)
            h, m = 5, 0
        else:  # Sunday (Off)
            current_d += timedelta(days=1)
            continue

        for idx, user_obj in enumerate(all_users_list):
            user_tasks = [
                t for t in created_tasks
                if any(a.user_id == user_obj.id for a in t.assignees)
            ]
            target_task = user_tasks[(current_d.day + idx) % len(user_tasks)] if user_tasks else created_tasks[0]
            te = TimeEntry(
                task_id=target_task.id,
                user_id=user_obj.id,
                entry_date=current_d,
                hours=h,
                minutes=m,
            )
            db.session.add(te)

        current_d += timedelta(days=1)

    db.session.commit()

    # ── 8. LEAVE REQUESTS & ABSENCES ──────────────────────────────────────────
    # Sample leave requests
    l1 = LeaveRequest(
        user_id=mehdi_prod.id,
        start_date=today + timedelta(days=10),
        end_date=today + timedelta(days=14),
        reason="Congés annuels payés - Vacances d'été",
        status="approved",
        submitted_at=datetime.now(timezone.utc) - timedelta(days=5),
        decided_at=datetime.now(timezone.utc) - timedelta(days=4),
    )
    l2 = LeaveRequest(
        user_id=lina_cm.id,
        start_date=today + timedelta(days=3),
        end_date=today + timedelta(days=4),
        reason="Formation Certifiante TikTok Ads & Meta Blueprint",
        status="pending",
        submitted_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.session.add_all([l1, l2])

    # Sample sick absence
    sick1 = SickAbsence(
        user_id=cyrine_prod.id,
        absence_date=today - timedelta(days=2),
        declared_at=datetime.now(timezone.utc) - timedelta(days=2),
        justification_status="justified",
        certificate_url="/uploads/medical_cert_cyrine.pdf",
    )
    db.session.add(sick1)

    # Sample holiday
    h1 = Holiday(
        date=date(today.year, 8, 13),
        label="Fête Nationale de la Femme",
        created_by_id=admin_user.id,
    )
    db.session.add(h1)

    # ── 9. LOGIN HISTORY ──────────────────────────────────────────────────────
    for u_obj in [admin_user, sara_manager, yassine_cm, nour_chef, karim_prod]:
        db.session.add(LoginHistory(user_id=u_obj.id, event="login", timestamp=datetime.now(timezone.utc) - timedelta(hours=2)))

    db.session.commit()
    print("Seed complete: 12 Users, 1 TaskType with 7 Statuses, 8 Equipment, 5 Projects, 19 Tasks, Shoots, Time Entries, and Leave Requests populated successfully.")