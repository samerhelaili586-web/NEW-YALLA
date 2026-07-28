from datetime import datetime
from app import db

DEFAULT_GUIDE_CONTENT = """# 📘 Guide d'utilisation & Workflow d'équipe YALLA

Bienvenue dans le guide officiel de l'équipe **YALLA**. Ce document présente les étapes du flux de travail, la répartition des rôles et les règles opérationnelles de l'entreprise.

---

## 🔄 Circuit de Production Étape par Étape

```
[0. Config Workflows] ➔ [1. Création Projet] ➔ [2. Création Tâches] ➔ [3. Shooting & Matériel] ➔ [4. Production & Saisie J+1] ➔ [5. Validation & Clôture]
```

### 0️⃣ Étape 0 : Création & Configuration des Workflows (Admin & Manager)
- L'**Admin Sys** et le **Manager** définissent les modèles de processus dans **Workflows (Types de tâches)**.
- Chaque workflow contient la séquence des statuts (*ex: Début ➔ Shooting ➔ Montage ➔ Validation CM ➔ Final*), les rôles autorisés et les champs obligatoires à la validation (*ex: Lien de la vidéo*).

### 1️⃣ Étape 1 : Création du Projet Client (Admin & Manager)
- Le projet client est créé sous **Direction Générale ➔ Projets**.
- Il rassemble les objectifs, l'équipe responsable et l'historique des tâches.

### 2️⃣ Étape 2 : Création des Tâches & Attribution (CM & Manager)
- Le **Community Manager (CM)** ou le **Manager** ajoute les tâches nécessaires au projet.
- La tâche démarrée adopte automatiquement le schéma d'avancement du Workflow associé.

### 3️⃣ Étape 3 : Planification des Shootings & Réservation du Matériel (Chef Prod & Manager)
- Pour les contenus nécessitant des prises de vue, le **Chef Prod** ou le **Manager** planifie la session dans **Planification** :
  - **Matériel réservé** (Caméra Sony FX3, RED Komodo, Trépied, Micro, Ring light...).
  - **Créneau horaire** (Début et Fin).
  - **Équipe Prod assignée** sur le tournage.
- Le système bloque automatiquement les conflits de matériel ou de planning.

### 4️⃣ Étape 4 : Déroulement, Production & Saisie du Temps J+1 (Prod, CM, Chef Prod)
- Les collaborateurs réalisent leurs travaux (tournage, montage, création visuelle).
- **Règle stricte de la Feuille de Présence** :
  - La déclaration du temps quotidien se fait via `+ Saisir mon temps`.
  - **Délai de grâce J+1 (23h59)** : Vous avez jusqu'à **demain 23h59** pour déclarer vos heures travaillées. Passé ce délai, la journée est marquée comme **Pénalisée**.
  - **Seuil minimal quotidien** : 6 heures (360 min).

### 5️⃣ Étape 5 : Progression Dynamique & Validation des Livrables
- Le collaborateur fait progresser la tâche d'état en état.
- Si le workflow exige la validation d'un livrable (*ex: Lien de la vidéo*), la fenêtre de transition s'affiche obligatoirement.
- La tâche passe aux étapes de validation finale par le CM/Manager jusqu'au statut **FIN**.

---

## 👥 Matrice des Rôles & Responsabilités

| Rôle | Droits & Accès Principaux |
| :--- | :--- |
| **Admin Système** | Contrôle total, modification des Workflows, Gestion des utilisateurs & tarifs, Communiqués, Visibilité du Guide. |
| **Manager** | Gestion des Projets, Planification, Approbation des Congés, Communiqués d'équipe, Suivi des Présences. |
| **Chef Prod** | Droits Prod + Planification des Shootings & Réservation du Matériel, Validation technique Prod. |
| **Community Manager (CM)** | Création des Tâches, Suivi des Workflows, Validation des Livrables clients. |
| **Prod (Monteur / Cadrage / Graphiste)** | Exécution des tâches, Saisie quotidienne du temps de travail J+1. |

---

## 📅 Demandes de Congés & Indisponibilités
- Toute absence (Congé payé, Maladie, Récupération) doit être soumise dans **Mes Congés & Demandes**.
- L'approbation par le Manager/Admin met à jour l'**Annuaire** avec le badge **Absent**.
"""

DEFAULT_STEPS = [
    {
        "id": 0,
        "title": "0. Préalable : Configuration des Workflows",
        "role": "Admin / Manager",
        "desc": "Configuration des statuts, rôles autorisés et champs obligatoires à la validation."
    },
    {
        "id": 1,
        "title": "1. Création du Projet Client",
        "role": "Admin / Manager",
        "desc": "Création du projet et définition des paramètres dans la section Projets."
    },
    {
        "id": 2,
        "title": "2. Création des Tâches à partir d'un Workflow",
        "role": "CM / Manager",
        "desc": "Ajout des tâches et association au Workflow correspondant."
    },
    {
        "id": 3,
        "title": "3. Planification Shooting & Matériel",
        "role": "Chef Prod / Manager",
        "desc": "Réservation du matériel (caméras, micros...) et heures d'équipe dans Planification."
    },
    {
        "id": 4,
        "title": "4. Réalisation & Saisie du Temps J+1",
        "role": "Prod / CM / Chef Prod",
        "desc": "Production et déclaration d'heures obligatoire sous J+1 (23h59)."
    },
    {
        "id": 5,
        "title": "5. Progression des Statuts & Validation",
        "role": "Parcours dynamique du Workflow",
        "desc": "Passage des étapes et validation des livrables (liens vidéo...)."
    },
    {
        "id": 6,
        "title": "6. Publication & Clôture de la Tâche",
        "role": "CM / Manager",
        "desc": "Vérification finale du projet et passage au statut FIN."
    }
]

class GuidePage(db.Model):
    __tablename__ = "guide_pages"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, default="Guide & Workflow d'équipe")
    content = db.Column(db.Text, nullable=False, default=DEFAULT_GUIDE_CONTENT)
    steps = db.Column(db.JSON, nullable=False, default=DEFAULT_STEPS)
    is_visible = db.Column(db.Boolean, default=True, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "steps": self.steps if self.steps is not None else DEFAULT_STEPS,
            "is_visible": self.is_visible,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
