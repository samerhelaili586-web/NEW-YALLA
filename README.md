# Yalla Agency — Plateforme de Gestion Marketing Digital

Plateforme interne complète pour agence de marketing digital, développée avec **Flask (backend)** et **React (frontend)**.

---

## 🚀 Stack Technologique

| Couche | Technologie |
|--------|-------------|
| Backend | Python Flask, SQLAlchemy, Flask-JWT-Extended, APScheduler |
| Base de données | SQLite (dev) |
| Frontend | React 18, Vite, Vanilla CSS (Dark Mode) |
| Auth | JWT avec auto-déconnexion après 1h d'inactivité |

---

## 📂 Structure du Projet

```
NEW YALLA/
├── backend/
│   ├── run.py              # Point d'entrée Flask (port 5000)
│   ├── seed.py             # Données de test
│   ├── requirements.txt
│   └── app/
│       ├── models/         # User, Project, Task, Workflow, Leave...
│       ├── routes/         # auth, users, projects, tasks, leaves...
│       └── utils/          # decorators, helpers
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── api/            # Clients API (axios)
        ├── context/        # AuthContext, NotificationContext
        ├── components/     # Sidebar, Navbar, Modal, Table, Avatar...
        └── pages/          # Dashboard, Projects, Users, Leaves...
```

---

## ⚡ Installation & Démarrage

### Backend
```bash
cd backend
pip install -r requirements.txt
python seed.py    # (optionnel) données de test
python run.py
```
> API disponible sur `http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
> Interface disponible sur `http://localhost:3000`

---

## 🎭 Rôles Utilisateurs

| Rôle | Accès |
|------|-------|
| `admin_sys` | Configuration globale (workflows, matériel, utilisateurs) |
| `manager` | Approbation des congés, vision globale |
| `cm` | Gestion des projets et tâches assignés |
| `prod` | Tâches de production et montage |
| `chef_prod` | File de planification (shooting/montage) |

---

## 📋 Fonctionnalités Principales

- ✅ Authentification JWT & RBAC par rôle
- ✅ Gestion des projets et tâches avec workflow dynamique
- ✅ Feuille de présence hebdomadaire (objectif 40h)
- ✅ Congés & absences avec approbation/rejet automatique (6h)
- ✅ Calendrier de shooting partagé
- ✅ Annuaire de l'agence
- ✅ Notifications temps réel (polling)
- ✅ Tableau de bord personnalisé par rôle
