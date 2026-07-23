# Yalla Agency — Plateforme de Gestion Marketing Digital

Plateforme interne complète pour agence de marketing digital, développée avec **Flask (backend)** et **React (frontend)**.

Implémentation basée sur le cahier des charges fonctionnel rédigé par Ameur Stambouli (Neopolis Development) — voir [`NOTES.md`](./NOTES.md) pour la spec complète.

---

## 🚀 Stack Technologique

| Couche | Technologie |
|--------|-------------|
| Backend | Python 3, Flask 3, SQLAlchemy (Flask-SQLAlchemy), Flask-Session, Flask-Cors |
| Base de données | SQLite (dev) |
| Frontend | React 19, Vite, CSS custom (Dark Mode) |
| Auth | Session cookie côté serveur (Flask-Session, filesystem), auto-déconnexion après 1h d'inactivité |

---

## 📂 Structure du Projet

```
NEW-YALLA/
├── NOTES.md                 # Cahier des charges fonctionnel (spec de référence)
├── backend/
│   ├── run.py                # Point d'entrée Flask (port 5000)
│   ├── config.py              # Config (lit SECRET_KEY depuis l'env)
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py        # create_app(), enregistrement des blueprints
│       ├── permissions.py     # Matrice de droits (menus + actions) par rôle
│       ├── seed.py            # Données de démo (users, projets, tâches...)
│       ├── models/            # User, Project, Task, TaskType/Status/Transition,
│       │                      # Equipment, Shoot, Leave, Notification
│       └── routes/            # auth, users, projects, tasks, task_types,
│                              # equipment, planification, attendance, leave,
│                              # notifications, login_history
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── api/               # Client API (fetch/axios)
        ├── context/           # AuthContext, NotificationContext
        ├── components/        # Sidebar, AppShell, Modal, TaskDetailModal...
        ├── pages/
        │   ├── admin/          # Gestion utilisateurs, matériel
        │   ├── workflows/      # Constructeur visuel de workflows
        │   ├── projects/       # Liste + détail projet, KPIs
        │   ├── tasks/          # Tâches associées, tâches montage
        │   ├── planification/  # File d'attente shooting/montage (Chef Prod)
        │   ├── shooting/       # Calendrier de shooting partagé
        │   ├── attendance/     # Feuille de présence perso/équipe
        │   └── leave/          # Congés, absences maladie, jours fériés
        └── utils/
```

---

## ⚡ Installation & Démarrage

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # optionnel mais recommandé
pip install -r requirements.txt

# Variables d'environnement (recommandé avant tout déploiement)
export SECRET_KEY="change-me-in-prod"
export FLASK_DEBUG=0        # 1 en dev (défaut), 0 en prod

python run.py
```
> API disponible sur `http://localhost:5000`
> Les données de démo (`seed.py`) sont chargées automatiquement au démarrage si la base est vide.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
> Interface disponible sur `http://localhost:5173` (port par défaut de Vite)

---

## 🎭 Rôles Utilisateurs

| Rôle | Code | Accès |
|------|------|-------|
| Administrateur Système | `admin_sys` | Configuration globale : utilisateurs, workflows, matériel, historique de connexion |
| Manager | `manager` | Création/pilotage des projets, approbation des congés, dérogation de statut |
| Community Manager | `cm` | Gestion des projets affectés, création de tâches, reporting de temps |
| Production | `prod` | Exécution des tâches (shooting/montage), reporting de temps |
| Chef d'équipe Prod | `prod` + option `is_chef_prod` | Cumule les droits Prod + planification shooting/montage (un seul utilisateur actif à la fois) |

Comptes de démo (mot de passe : `password123`) : `admin@yalla.local`, `manager@yalla.local`, `cm@yalla.local`, `prod@yalla.local`, `chefprod@yalla.local`.

---

## 📋 Fonctionnalités Principales

- ✅ Authentification par session (cookie) & RBAC par rôle (matrice de menus/actions dans `permissions.py`)
- ✅ Gestion des utilisateurs (création, archivage/désactivation — jamais de suppression, §2.4)
- ✅ Constructeur visuel de workflows (statuts, transitions, rôles autorisés par transition)
- ✅ Gestion des projets (statuts Actif / On hold / Terminé) et des tâches avec cycle de vie piloté par workflow
- ✅ Planification shooting & montage (Chef Prod) avec contrôle de disponibilité matériel/utilisateurs
- ✅ Feuille de présence hebdomadaire + alerte de reporting (seuil 6h/jour, exemptions congé/maladie/weekend/férié)
- ✅ Congés & absences : demande avec délai de 6h, refus automatique, absence maladie (J/J-1/J-2) avec justificatif sous 48h
- ✅ Calendrier de shooting partagé
- ✅ Annuaire de l'agence
- ✅ Notifications in-app (polling)
- ✅ Historique de connexion/déconnexion (Admin Sys)
- ✅ Tableau de bord personnalisé par rôle

---

## 🔒 Notes de sécurité avant déploiement

- Toujours définir `SECRET_KEY` via variable d'environnement (jamais la valeur par défaut de `config.py`).
- Mettre `FLASK_DEBUG=0` en production (désactive le debugger Werkzeug).
- `SQLALCHEMY_DATABASE_URI` pointe sur SQLite en dev — prévoir Postgres/MySQL pour la prod.
- Le dossier `flask_session/` et le fichier `yalla.db` sont dans `.gitignore` : ne pas les committer.

---

## 🧪 État du projet

Backend testé : démarrage, seed, login, endpoints principaux (`/api/projects`, `/api/auth/me`, etc.) validés manuellement. Frontend : build de production (`npm run build`) validé sans erreur.