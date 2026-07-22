# Cahier des Charges Fonctionnel

## Plateforme de Gestion d'Agence de Marketing Digital



| Information | Détail |
| --- | --- |
| **Auteur** | Ameur Stambouli |
| **Entreprise** | Neopolis Development |
| **Version** | 1.0 |
| **Date** | Juillet 2026 |
| **Type de document** | Cahier des Charges Fonctionnel |

---

## Table des Matières

1. [Présentation du Projet](#1-pr%C3%A9sentation-du-projet)

1. [Gestion des Rôles et Utilisateurs](#2-gestion-des-r%C3%B4les-et-utilisateurs)

1. [Paramétrage Global (Admin Sys)](#3-param%C3%A9trage-global-admin-sys)

1. [Gestion des Projets](#4-gestion-des-projets)

1. [Gestion Opérationnelle des Tâches](#5-gestion-op%C3%A9rationnelle-des-t%C3%A2ches)

1. [Suivi du Temps et Présences](#6-suivi-du-temps-et-pr%C3%A9sences)

1. [Gestion des Congés et Absences](#7-gestion-des-cong%C3%A9s-et-absences)

1. [Notifications](#8-notifications)

1. [Règles de Sécurité et Contraintes](#9-r%C3%A8gles-de-s%C3%A9curit%C3%A9-et-contraintes)

1. [Matrice des Droits d'Accès](#10-matrice-des-droits-dacc%C3%A8s)

1. [Annexes - Diagrammes](#11-annexes---diagrammes)

---

## 1. Présentation du Projet

### 1.1 Contexte et Objectif

Le présent document décrit les spécifications fonctionnelles d'une plateforme web destinée à la gestion des opérations internes d'une agence de marketing digital. L'objectif principal de cette solution est de centraliser la gestion des projets, le suivi des tâches, l'affectation des ressources matérielles et humaines, ainsi que la gestion des présences et des congés. Cette plateforme vise à améliorer la productivité, la traçabilité et la coordination entre les différents métiers de l'agence.

### 1.2 Périmètre Fonctionnel

L'application couvre l'ensemble des besoins opérationnels de l'agence, répartis en modules cohérents. Le premier module concerne la gestion des utilisateurs, des rôles et des droits d'accès. Le deuxième module traite de la configuration des workflows dynamiques via un constructeur visuel. Le troisième module gère l'inventaire du matériel de l'agence. Le quatrième module, central dans la plateforme, couvre la gestion des projets et des tâches avec leurs cycles de vie complets. Le cinquième module assure le suivi du temps et le reporting des collaborateurs. Le sixième module prend en charge la planification des shootings et des montages. Enfin, le septième module gère les congés, les absences et le tableau des indisponibilités.

### 1.3 Utilisateurs Cibles

La plateforme s'adresse à l'ensemble des collaborateurs de l'agence, chacun disposant d'un niveau d'accès adapté à son rôle. Les administrateurs système configurent et maintiennent la plateforme. Les managers pilotent les projets et supervisent les équipes. Les Community Managers gèrent les contenus et les publications. Les équipes de production réalisent les shootings et les montages.

---

## 2. Gestion des Rôles et Utilisateurs

La plateforme repose sur une architecture multi-rôles permettant de segmenter les accès et les actions possibles pour chaque collaborateur de l'agence.

### 2.1 Définition des Rôles

Le système identifie quatre rôles principaux, avec une option spécifique activable pour un seul utilisateur du rôle "Prod".

| Rôle | Code | Description | Particularité |
| --- | --- | --- | --- |
| **Administrateur Système** | Admin Sys | Accès total à la configuration de la plateforme, gestion des utilisateurs, des workflows et du matériel. | Rôle de supervision technique et fonctionnelle. |
| **Manager** | Manager | Responsable de la création et du suivi des projets, de l'affectation des CM, et de l'approbation des congés. | Rôle de pilotage stratégique. |
| **Community Manager** | CM | Utilisateur en charge de la gestion opérationnelle des projets qui lui sont affectés et de la création des tâches. | Rôle opérationnel orienté contenu. |
| **Production** | Prod | Utilisateur technique (photographe, vidéaste, monteur) en charge de la réalisation des tâches de production. | Rôle d'exécution technique. |
| **Chef d'équipe Production** | Prod + Option | Option activable pour **un seul** utilisateur "Prod". Cumule les accès "Prod" et des droits de planification et d'affectation spécifiques. | Rôle de coordination de production. |

> **Règle importante :** L'option "Chef d'équipe Prod" ne peut être activée que pour un seul utilisateur à la fois. Ce dernier voit l'ensemble des menus du rôle "Prod" ainsi que les menus supplémentaires liés à son option.

### 2.2 Profil Utilisateur

Chaque utilisateur dispose d'un profil contenant ses informations personnelles et professionnelles. Ce profil est renseigné par l'administrateur système lors de la création du compte.

| Champ | Description | Modifiable par |
| --- | --- | --- |
| Photo | Photo de profil du collaborateur | Admin Sys |
| Nom | Nom de famille | Admin Sys |
| Prénom | Prénom | Admin Sys |
| Numéro de téléphone | Numéro professionnel | Admin Sys |
| Adresse email | Email professionnel | Admin Sys |
| Type de rôle | Rôle attribué dans la plateforme | Admin Sys |

### 2.3 Annuaire des Collaborateurs

Un sous-menu accessible à tous les utilisateurs permet de consulter l'annuaire de l'entreprise. Cet annuaire liste exclusivement les collaborateurs actifs avec leurs coordonnées et leurs rôles. Les comptes archivés ou désactivés n'apparaissent pas dans l'annuaire.

| Information affichée | Visible par |
| --- | --- |
| Nom et Prénom | Tous les utilisateurs |
| Rôle | Tous les utilisateurs |
| Email | Tous les utilisateurs |
| Numéro de téléphone | Tous les utilisateurs |

### 2.4 Gestion des Comptes (Admin Sys)

L'administrateur système est responsable de la création des comptes et de l'affectation des rôles. La politique de gestion des comptes repose sur un principe fondamental de conservation de l'historique : aucun élément déjà utilisé dans un projet ne peut être supprimé. L'administrateur peut uniquement archiver un compte, le désactiver ou le modifier. Cette règle garantit l'intégrité des données historiques de l'agence.

| Action | Autorisée | Condition |
| --- | --- | --- |
| Créer un compte | Oui | Aucune |
| Modifier un compte | Oui | Aucune |
| Archiver un compte | Oui | Aucune |
| Désactiver un compte | Oui | Aucune |
| Supprimer un compte | **Non** | Jamais autorisé |
| Supprimer un élément utilisé | **Non** | Si l'élément est référencé dans un projet |

---

## 3. Paramétrage Global (Admin Sys)

### 3.1 Workflow Visual Builder

L'administrateur système a la charge de créer les types de tâches et de définir leurs workflows de validation. Ce paramétrage s'effectue via un constructeur visuel de workflows. L'administrateur ajoute des cases représentant des statuts et les relie par des flèches pour définir le sens de passage d'un statut vers un autre. Le système interprète ces liaisons pour contrôler les transitions autorisées lors de l'utilisation opérationnelle.

#### 3.1.1 Création d'un Statut

Pour chaque statut ajouté au workflow, l'administrateur doit renseigner les informations suivantes :

| Paramètre | Description | Obligatoire |
| --- | --- | --- |
| Titre | Nom du statut affiché dans l'interface | Oui |
| Type temporel | Évolutif dans le temps ou figé | Oui |
| Type fonctionnel | Début, Intermédiaire, Planification shooting, Planification montage, Montage, Final confirmation, Final rejet | Oui |
| Rôles participants | Rôles autorisés à reporter du temps dans ce statut | Oui |

#### 3.1.2 Types de Statuts

Le système reconnaît les types fonctionnels suivants, chacun ayant un comportement spécifique dans le workflow :

| Type de Statut | Comportement | Qui peut changer le statut |
| --- | --- | --- |
| **Statut de début** | Point d'entrée du workflow, attribué automatiquement à la création de la tâche. | CM, Admin Sys, Manager |
| **Statut intermédiaire** | Étape de travail classique, évolutive dans le temps. | CM, Admin Sys, Manager |
| **Planification shooting** | Statut figé. Le système force le passage par le Chef d'équipe Prod pour planifier le shooting. | Chef d'équipe Prod, Admin Sys, Manager |
| **Planification de montage** | Statut figé. Le système force le passage par le Chef d'équipe Prod pour affecter un monteur. | Chef d'équipe Prod, Admin Sys, Manager |
| **Montage** | Étape de réalisation du montage par l'utilisateur Prod affecté. | CM, Admin Sys, Manager |
| **Final de confirmation** | Statut terminal indiquant que la tâche est terminée avec succès. | Aucun (statut final) |
| **Final de rejet** | Statut terminal indiquant que la tâche est rejetée. | Aucun (statut final) |

#### 3.1.3 Règles de Transition

Les flèches entre les statuts définissent les transitions possibles. Lorsqu'un utilisateur souhaite changer le statut d'une tâche, le système n'affiche dans la liste déroulante que les statuts accessibles à l'étape suivante selon le workflow configuré. Aucun statut non prévu par les transitions ne sera proposé à l'utilisateur. Les statuts finaux (confirmation et rejet) ne possèdent aucune transition sortante.

> **Exception Manager / Admin Sys :** Le Manager et l'Administrateur Système disposent d'un droit de dérogation leur permettant de forcer un changement vers n'importe quel statut du workflow, sans respecter l'ordre des étapes définies. Dans ce cas, la liste déroulante leur affiche l'ensemble des statuts disponibles du workflow, et non uniquement les statuts suivants.

#### 3.1.4 Interface du Constructeur Visuel

Le constructeur de workflows se présente sous la forme d'une interface graphique dédiée, distincte du reste de la configuration, organisée en deux écrans principaux.

**Écran "Gestion des workflows" (liste) :**

Cet écran liste l'ensemble des workflows créés par l'agence, sous forme de tableau. Chaque ligne affiche le nom du workflow, sa description courte, son statut (Actif, Brouillon ou Désactivé), le nombre d'étapes, le nombre de transitions, la date de dernière mise à jour, ainsi que des actions rapides (activer/mettre en pause, dupliquer, modifier, supprimer/archiver selon la règle de non-suppression définie en §2.4 et §9.2). En haut de l'écran, des indicateurs chiffrés résument le nombre total de workflows, ainsi que la répartition par statut (Actifs, Brouillons, Désactivés). Un système d'onglets permet de filtrer la liste par statut, complété par une recherche par nom. Un bouton "Créer un workflow" permet d'initier un nouveau workflow depuis cet écran.

**Écran "Éditeur de workflow" (canevas) :**

Au clic sur un workflow, l'administrateur accède à un éditeur graphique en plein écran, structuré en trois zones :

| Zone | Contenu |
| --- | --- |
| Palette d'étapes (gauche) | Bibliothèque des types de statuts disponibles (cf. §3.1.2), organisée par catégorie : démarrage, étapes intermédiaires/de production, statuts finaux. Chaque élément de la palette s'ajoute au canevas par un simple clic. |
| Canevas (centre) | Zone de travail où les statuts apparaissent sous forme de blocs déplaçables, codés par couleur selon leur type fonctionnel. Chaque bloc affiche son type, son titre, son type temporel (évolutif ou figé) et le nombre de rôles participants configurés. Les transitions se créent en reliant deux blocs par une flèche. |
| Propriétés (droite) | Panneau contextuel affichant les paramètres du statut sélectionné (§3.1.1). Reste vide tant qu'aucun statut n'est sélectionné. |

La barre supérieure de l'éditeur permet de renommer le workflow, de modifier son statut (Actif, Brouillon, Désactivé), de vérifier la validité de la configuration, d'ajuster le zoom, de prévisualiser le workflow et d'enregistrer les modifications.

**Configuration d'une transition :**

Au clic sur une flèche reliant deux statuts, une fenêtre modale dédiée à cette transition s'ouvre et permet de configurer :

| Paramètre | Description |
| --- | --- |
| Rôles autorisés à déclencher la transition | Sélection des rôles (parmi Admin Sys, Manager, CM, Prod, Chef Prod) habilités à faire passer une tâche d'un statut au statut suivant via cette transition précise. Ce paramètre est propre à chaque transition et distinct des "Rôles participants" définis au niveau du statut (§3.1.1), qui régissent uniquement le droit de reporter du temps. |
| Formulaire de transition | Ensemble optionnel de champs supplémentaires que l'utilisateur doit renseigner au moment d'emprunter cette transition. Si aucun champ n'est défini, la transition s'effectue sans formulaire. |

### 3.2 Gestion du Matériel

L'administrateur système gère l'inventaire matériel de l'agence. Ce matériel est utilisé lors de la planification des shootings par le Chef d'équipe Prod.

| Action | Description |
| --- | --- |
| Ajouter un matériel | Renseigner le nom, la description et uploader une image. |
| Modifier un matériel | Modifier les informations ou l'image associée. |
| Désactiver un matériel | Rendre le matériel indisponible sans le supprimer. |
| Supprimer un matériel | **Interdit** si le matériel est déjà utilisé dans un projet. |

### 3.3 Historique de Connexion

L'administrateur système peut consulter l'historique de connexion et de déconnexion de chaque utilisateur. Le système comporte une déconnexion automatique en cas d'inactivité supérieure à une heure.

---

## 4. Gestion des Projets

### 4.1 Création d'un Projet (Manager)

Le Manager initie un projet via un bouton "Créer un projet" dans le menu Projets. Un formulaire modal s'affiche et comporte les champs suivants :

| Champ | Type | Description | Obligatoire |
| --- | --- | --- | --- |
| Titre du projet | Texte | Nom identifiant le projet | Oui |
| Date de début effectif | Date | Date de démarrage réel du projet (peut être dans le passé) | Oui |
| Fréquence mensuelle par type de tâche | Tableau numérique | Nombre de tâches prévues par mois pour chaque type de tâche | Oui |
| CM affecté | Liste déroulante | Sélection d'un utilisateur ayant le rôle "CM" | Oui |
| Remarques | Texte libre | Notes client, charte graphique, consignes spécifiques, préférences et interdits | Non |

> **Comportement :** Le tableau de fréquence mensuelle affiche par défaut tous les types de tâches configurés par l'Admin Sys. Le Manager renseigne le nombre prévu pour chaque type. Une notification est envoyée au CM lors de son affectation au projet.

### 4.2 Visibilité des Projets

La visibilité des projets varie selon les rôles, garantissant que chaque utilisateur accède uniquement aux informations pertinentes pour son travail.

| Rôle | Projets visibles |
| --- | --- |
| Admin Sys | Tous les projets |
| Manager | Tous les projets |
| Chef d'équipe Prod | Tous les projets |
| CM | Uniquement les projets qui lui sont affectés |

### 4.3 Affichage et Navigation

Les projets s'affichent sous forme de cartes présentant le titre du projet et le nom du CM affecté. L'interface propose un filtre par date de création et une recherche par nom pour faciliter la navigation. Les Managers et l'administrateur système peuvent modifier les projets en ajoutant des notes, en changeant le CM affecté ou en changeant le statut du projet. Les statuts possibles d'un projet sont les suivants :

| Statut du projet | Description | Effet |
| --- | --- | --- |
| **Actif** | Statut par défaut à la création | Fonctionnement normal, ajout de tâches autorisé |
| **On hold** | Projet temporairement gelé | Aucun ajout de tâche possible, les tâches existantes restent consultables |
| **Terminé** | Projet clôturé définitivement | Aucun ajout ni modification de tâche, consultation seule |

### 4.4 Détail d'un Projet

Au clic sur la carte d'un projet, l'interface affiche trois sous-sections détaillées accessibles par le CM affecté, le Chef d'équipe Prod, le Manager et l'Admin Sys.

#### 4.4.1 Tableau des Tâches (Section principale)

Le tableau principal constitue la vue par défaut du projet. Il liste les tâches avec un bouton "Créer une tâche" en haut. Un filtre de recherche dans l'en-tête permet de rechercher et filtrer par colonne.

**Création d'une tâche :**

Lors de la création d'une tâche, l'utilisateur doit obligatoirement sélectionner le type de tâche parmi les types configurés par l'Admin Sys. Ce choix détermine le workflow applicable à la tâche (enchaînement des statuts, rôles autorisés, etc.). Le formulaire de création comprend également le titre, la description et la date de publication prévue.

| Colonne | Description |
| --- | --- |
| Date et heure de création | Horodatage de la création de la tâche |
| ID tâche | Identifiant unique généré automatiquement par le système |
| Titre de la tâche | Titre limité en nombre de caractères |
| Statut actuel | Statut courant dans le workflow |
| Date de publication prévue | Date cible de publication |
| En retard | Indicateur visuel de retard par rapport à la date prévue |

#### 4.4.2 Modal de Détail d'une Tâche

Chaque ligne du tableau est cliquable et ouvre un modal présentant deux onglets.

**Onglet "Détail" :**

Le premier onglet affiche le titre de la tâche, son statut actuel, sa date de création, la date prévue de publication, l'indicateur de retard, la description complète de la tâche, ainsi que l'historique des commentaires. Chaque commentaire est accompagné du nom de l'utilisateur et de la date et heure de son ajout.

**Système de commentaires avec mentions :**

Lors de la rédaction d'un commentaire, l'utilisateur a la possibilité de mentionner d'autres utilisateurs associés à la tâche (via un mécanisme de type "@nom"). Les utilisateurs mentionnés reçoivent une notification cliquable qui les redirige directement vers l'espace commentaires de la tâche concernée. Ce mécanisme permet notamment au Prod de notifier le CM lorsqu'il a terminé son travail, afin que ce dernier procède à la validation et au changement de statut.

**Reporting du temps depuis le modal :**

Le CM peut reporter son temps directement depuis le modal de détail d'une tâche de son propre projet. Il accède à cette fonctionnalité en cliquant sur une tâche dans le tableau des tâches du projet. Cette méthode constitue le moyen principal pour le CM de saisir son temps de travail sur ses propres projets.

**Onglet "Historique" :**

Le second onglet présente le temps passé par chaque utilisateur sur cette tâche, reporté manuellement. Il inclut un récapitulatif par statut pour tous les utilisateurs et le total d'heures et minutes de la tâche.

**Bouton de changement de statut :**

Un bouton en haut du modal permet de changer le statut de la tâche. Lorsque l'utilisateur clique sur ce bouton, une liste déroulante affiche uniquement les statuts accessibles à l'étape suivante selon le workflow configuré. Ce bouton est grisé dans les cas suivants : la tâche a atteint un statut final, ou l'utilisateur n'a pas le droit de changer le statut. Les CM peuvent effectuer les changements de statut standards en suivant l'ordre du workflow. Le Manager et l'Admin Sys disposent d'un droit de dérogation leur permettant de forcer un changement vers n'importe quel statut du workflow, sans respecter l'ordre des étapes. Seuls le Chef d'équipe Prod, l'Admin Sys et le Manager peuvent modifier les statuts de type "Planification shooting" ou "Planification de montage" qui sont figés dans le temps.

#### 4.4.3 KPI's du Projet

Cette section affiche une comparaison entre le nombre de tâches prévues selon la fréquence mensuelle définie à la création du projet et les tâches réellement réalisées, c'est-à-dire celles ayant atteint un statut final de confirmation.

#### 4.4.4 Temps Passé par Utilisateur

Cette section présente un récapitulatif du temps passé par chaque utilisateur sur le projet, agrégé par mois.

---

## 5. Gestion Opérationnelle des Tâches

### 5.1 Menu "Planification" (Chef d'équipe Prod)

Le Chef d'équipe Prod dispose d'un menu dédié à la planification, visible dans sa barre latérale avec un indicateur numérique des tâches en attente de son action. Ces tâches correspondent à deux cas précis : les tâches dans un statut de type "Planification de shooting" figé, et les tâches dans un statut de type "Planification de montage" figé.

#### 5.1.1 Planification d'un Shooting

Lorsqu'une tâche atteint le statut "Planification Shooting" (figé dans le temps), le Chef d'équipe Prod doit effectuer les actions suivantes pour permettre le passage au statut suivant :

| Action | Description | Obligatoire |
| --- | --- | --- |
| Associer un matériel | Sélection dans la liste du matériel actif de l'agence | Oui |
| Sélectionner des utilisateurs Prod | Choix des membres de l'équipe de production pour le shooting | Oui |
| Date/Heure de début | Planification du début du shooting | Oui |
| Date/Heure de fin | Planification de la fin du shooting | Oui |
| Inviter d'autres utilisateurs | Possibilité d'inviter des CM, le Manager ou lui-même au shooting | Non |

> **Règle :** Cette planification peut être modifiée à tout moment par le Chef d'équipe Prod, même après le passage au statut suivant. Une fois l'action effectuée, la tâche disparaît du menu "Planification".

> **Contrôle de disponibilité :** Le système vérifie automatiquement la disponibilité du matériel et des utilisateurs Prod sélectionnés sur le créneau demandé. Si le matériel est déjà réservé pour un autre shooting au même moment, ou si un utilisateur Prod est déjà affecté à un autre shooting, en congé ou en absence maladie sur cette période, le système affiche un avertissement et empêche la validation tant que le conflit n'est pas résolu.

#### 5.1.2 Planification d'un Montage

Lorsqu'une tâche atteint le statut "Planification de Montage", seul le Chef d'équipe Prod peut changer le statut. Il doit sélectionner un utilisateur ayant le rôle "Prod" pour l'affecter à l'étape de montage suivante.

### 5.2 Menu "Tâches Associées" (CM et Prod)

Un menu "Tâches associées" est accessible aux utilisateurs CM et Prod. Il liste les tâches auxquelles l'utilisateur a été invité, c'est-à-dire celles où son nom a été spécifié lors d'un changement de statut.

| Fonctionnalité | Description |
| --- | --- |
| Consultation | Visualisation des tâches auxquelles l'utilisateur est associé |
| Commentaires | Ajout de commentaires sur les tâches |
| Reporting temps | Saisie manuelle du nombre d'heures et minutes passées, avec spécification de la date |
| Modification reporting | Possibilité de modifier un reporting déjà saisi |

> **Règle spécifique CM :** Les Community Managers ne voient pas dans ce menu les tâches de leurs propres projets. Ce menu affiche uniquement les tâches d'autres projets auxquelles ils ont été invités. Pour les tâches de ses propres projets (y compris celles où il est invité à un shooting), le CM y accède directement depuis le tableau des tâches du projet.

### 5.3 Menu "Tâches Montage" (Prod)

Un menu spécifique est affiché aux utilisateurs de type "Prod". Il présente les tâches qui leur ont été affectées et dont le statut actuel est de type "Montage". Ces tâches sont en consultation seule et ne disparaissent pas de ce menu après un changement de statut.

### 5.4 Calendrier "Shooting" (Tous les utilisateurs)

Un menu "Shooting" est accessible à tous les utilisateurs de la plateforme. Il affiche un calendrier hebdomadaire des shootings planifiés. Pour chaque shooting, les utilisateurs peuvent consulter le matériel associé et les utilisateurs affectés au montage.

---

## 6. Suivi du Temps et Présences

### 6.1 Feuille de Présence

La feuille de présence se présente sous la forme d'un tableau hebdomadaire couvrant du lundi au dimanche.

| Élément | Description |
| --- | --- |
| Lignes | Jours de la semaine (Lundi à Dimanche) |
| Colonnes | Titres des tâches (cliquables pour consultation) |
| Valeurs | Nombre d'heures/minutes passées par tâche et par jour |
| Total | Total d'heures par jour affiché en bas du tableau |

La visibilité de la feuille de présence varie selon les rôles :

| Rôle | Vue |
| --- | --- |
| CM | Sa propre feuille de présence uniquement |
| Prod | Sa propre feuille de présence uniquement |
| Manager | Feuille de présence de toute l'équipe |
| Admin Sys | Feuille de présence de toute l'équipe |

### 6.2 Alerte de Reporting

Le système contrôle quotidiennement la saisie du temps pour les utilisateurs CM et Prod. Le seuil minimum de reporting journalier est fixé à six heures. Si le reporting de la veille est inférieur à ce seuil, le système déclenche les actions suivantes :

| Moment | Action du système |
| --- | --- |
| À la connexion de l'utilisateur | Affichage d'une alerte indiquant que la journée sera marquée comme "absence de reporting" |
| Le lendemain à 8h00 | La journée s'affiche en rouge dans la feuille de présence |
| Après marquage en rouge | L'utilisateur conserve la possibilité de compléter son reporting |

> **Exemption congé / maladie :** La sanction automatique du système (alerte et marquage en rouge) ne s'applique pas aux journées couvertes par un congé approuvé ou une absence maladie déclarée (qu'elle soit justifiée ou non). Le système vérifie automatiquement si la journée concernée est couverte par une période de congé ou d'absence maladie avant de déclencher l'alerte ou le marquage. Les jours couverts sont considérés comme valides sans exigence de reporting.

> **Exemption weekends et jours fériés :** Le contrôle automatique de reporting est désactivé les samedis et dimanches, ainsi que les jours fériés définis par le Manager. Le Manager dispose d'une fonctionnalité dans le menu "Gestion des congés" lui permettant d'ajouter des jours fériés au calendrier de l'agence. Lorsqu'un jour férié est ajouté, une notification est envoyée à l'ensemble des collaborateurs pour les informer.

---

## 7. Gestion des Congés et Absences

### 7.1 Menu "Demandes de Congés" (Tous les utilisateurs)

Tous les collaborateurs peuvent soumettre des demandes de congés et d'absences via un menu dédié.

#### 7.1.1 Demande de Congé

Les collaborateurs soumettent des demandes de congés pour une date future. Le processus suit les règles suivantes :

| Règle | Description |
| --- | --- |
| Délai minimum | La demande doit être soumise au moins 6 heures avant la date de début |
| Rejet automatique | Si le délai de 6h est atteint sans approbation du Manager, la demande est automatiquement rejetée |
| Notification | Un email est envoyé au Manager pour toute nouvelle demande |
| Approbation | Le Manager valide ou refuse la demande depuis son menu d'approbation |

#### 7.1.2 Absence Maladie

Les utilisateurs peuvent déclarer une absence maladie selon les contraintes suivantes :

| Paramètre | Règle |
| --- | --- |
| Période déclarable | Jour même (J), veille (J-1) ou avant-veille (J-2) maximum |
| Délai justificatif | 48 heures depuis le début de l'absence pour uploader un certificat médical |
| Notification | L'Admin Sys est notifié lors de l'upload du justificatif |
| Validation | L'Admin Sys approuve ou refuse le justificatif |
| Défaut | Sans justificatif dans les 48h ou en cas de refus, l'absence est marquée "non justifiée" |

#### 7.1.3 Menu d'Approbation (Manager)

Le Manager dispose d'un menu d'approbation centralisé pour traiter les demandes de congés. Il peut consulter la liste des demandes avec leurs statuts et extraire cette liste.

### 7.2 Tableau des Indisponibilités (Accueil)

Un tableau des indisponibilités est affiché sur la page d'accueil pour tous les utilisateurs. Il indique les collaborateurs indisponibles pour la journée en cours, quelle que soit la raison (maladie approuvée ou non, congé approuvé). Au clic sur le détail, un tableau complet s'affiche avec les indisponibilités présentes et futures, excluant le passé.

| Colonne | Contenu |
| --- | --- |
| Nom du collaborateur | Prénom et nom de l'utilisateur indisponible |
| Statut | "Indisponible" |
| Période | Du [Date début] au [Date fin] |

---

## 8. Notifications

Le système de notifications assure la communication entre les utilisateurs pour les événements importants.

| Événement déclencheur | Destinataire | Canal |
| --- | --- | --- |
| Affectation d'un CM à un projet | CM concerné | Notification plateforme |
| Nouvelle demande de congé | Manager | Email |
| Upload d'un justificatif médical | Admin Sys | Notification plateforme |
| Rejet automatique d'un congé | Collaborateur concerné | Notification plateforme |
| Mention dans un commentaire | Utilisateur mentionné | Notification plateforme (cliquable, redirige vers la tâche) |
| Ajout d'un jour férié | Tous les collaborateurs | Notification plateforme |

---

## 9. Règles de Sécurité et Contraintes

### 9.1 Sécurité des Sessions

Le système impose une déconnexion automatique après une heure d'inactivité. L'historique complet des connexions et déconnexions est conservé et consultable par l'administrateur système.

### 9.2 Intégrité des Données

Le principe fondamental est la non-suppression des données référencées. Aucun élément déjà utilisé dans un projet ne peut être supprimé. Les actions possibles se limitent à la désactivation, l'archivage ou la modification. Cette règle s'applique aux comptes utilisateurs, au matériel, aux types de tâches et aux workflows.

### 9.3 Contraintes de Saisie

Le titre des tâches est limité en nombre de caractères pour garantir un affichage cohérent dans les tableaux et les cartes.

---

## 10. Matrice des Droits d'Accès

### 10.1 Accès aux Menus

| Menu | Admin Sys | Manager | CM | Prod | Chef Prod |
| --- | --- | --- | --- | --- | --- |
| Gestion Utilisateurs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestion Workflows | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestion Matériel | ✅ | ❌ | ❌ | ❌ | ❌ |
| Projets (tous) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Projets (affectés) | — | — | ✅ | ❌ | — |
| Tâches associées | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tâches Montage | ❌ | ❌ | ❌ | ✅ | ✅ |
| Planification | ❌ | ❌ | ❌ | ❌ | ✅ |
| Feuille Présence (perso) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Feuille Présence (équipe) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Shooting (calendrier) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Congés & Absences | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approbation Congés | ❌ | ✅ | ❌ | ❌ | ❌ |
| Annuaire | ✅ | ✅ | ✅ | ✅ | ✅ |

### 10.2 Actions sur les Projets

| Action | Admin Sys | Manager | CM | Prod | Chef Prod |
| --- | --- | --- | --- | --- | --- |
| Créer un projet | ❌ | ✅ | ❌ | ❌ | ❌ |
| Modifier un projet | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mettre en "On hold" | ✅ | ✅ | ❌ | ❌ | ❌ |
| Créer une tâche | ✅ | ✅ | ✅ | ❌ | ❌ |
| Changer statut (standard, selon workflow) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Forcer un statut (hors workflow) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Changer statut (planification) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Reporter du temps | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ajouter un commentaire | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 11. Annexes - Diagrammes

### 11.1 Hiérarchie des Rôles et Permissions

Le diagramme ci-dessous illustre la répartition des responsabilités entre les différents rôles de la plateforme.

![Hiérarchie des Rôles](https://private-us-east-1.manuscdn.com/sessionFile/tgSjHWhtPni6SImvxukDFy/sandbox/MexySrc8n3LHMfpytm79r6-images_1783690113144_na1fn_L2hvbWUvdWJ1bnR1L3JvbGVzX2hpZXJhcmNoeQ.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdGdTakhXaHRQbmk2U0ltdnh1a0RGeS9zYW5kYm94L01leHlTcmM4bjNMSE1mcHl0bTc5cjYtaW1hZ2VzXzE3ODM2OTAxMTMxNDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzSnZiR1Z6WDJocFpYSmhjbU5vZVEucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg1NTQyNDAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=O1ZJdTW3QrjMSqB79nRneInS8UFzu1beSm-pQhD7KA6cIyx61qWx~VMzRKpE9FQZ-y4~obAy6b2LucTb1vugeTmVaZUS~iUFAhr-XwRyKNhXr2rRFP4kOeQPOdxNsjY7bg9IuhLw52txJ1Cnd2hDDpoG8OJjLjgIN6pm0vFWu8QiOA6WU8C4YPyyfK7~brZBW3hqZJUPbPEIwZ1xYZpdkewv32PER8pWykn--UyTjXZx5443hhToxlzyMpazeJmViYdIlwzLvzOK4OMMkKbTIWxuDWGWbzAXzZWHt~-hzGA2xYCqZDxWTKDDAMtIKWNv6lrm0L6~dXFjVSeuS0ImzQ__)

### 11.2 Workflow Type d'une Tâche

Le diagramme suivant présente un exemple de workflow complet pour une tâche de production, depuis sa création jusqu'à sa confirmation ou son rejet.

![Workflow d'une Tâche](https://private-us-east-1.manuscdn.com/sessionFile/tgSjHWhtPni6SImvxukDFy/sandbox/MexySrc8n3LHMfpytm79r6-images_1783690113144_na1fn_L2hvbWUvdWJ1bnR1L3dvcmtmbG93X3RhY2hl.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdGdTakhXaHRQbmk2U0ltdnh1a0RGeS9zYW5kYm94L01leHlTcmM4bjNMSE1mcHl0bTc5cjYtaW1hZ2VzXzE3ODM2OTAxMTMxNDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHZjbXRtYkc5M1gzUmhZMmhsLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc4NTU0MjQwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=K0ju39ruLxWo5cJH6rPO2EXHCVtPzA-C7VL2Lxlh6zAdbY6Mbgp43m2ok715yQ9gIeqp5jnUNM9TxLsvot9iVQ-plu~MlgmF9oidv-P7P-~3dLRNVw3l6n4S6Gx~btkcyTQTwsGQ2Be-p41Rekv~tOdtkP6sHcXFJgEiQHTmXdSdClJMw0afe1BN7nRhh3VfWk0TItGHKfHw-AhRikRFhb67NLJ0VXCglav0idwiK9St1aATnP5VH2TvrTEpbUBMXYJcUy0jbpDJFedUjutxKTMnj6d07GuKYOVE9ZPxpZmdRaoE3kMWr8ZO1tqM4OtMaZ3qIsMMAhmW3j5XfOQv4g__)

### 11.3 Processus de Gestion des Congés et Absences

Ce diagramme détaille le processus complet de gestion des demandes de congés et des absences maladie, incluant les règles de rejet automatique et de validation.

![Processus Congés et Absences](https://private-us-east-1.manuscdn.com/sessionFile/tgSjHWhtPni6SImvxukDFy/sandbox/MexySrc8n3LHMfpytm79r6-images_1783690113144_na1fn_L2hvbWUvdWJ1bnR1L2Nvbmdlc19hYnNlbmNlcw.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdGdTakhXaHRQbmk2U0ltdnh1a0RGeS9zYW5kYm94L01leHlTcmM4bjNMSE1mcHl0bTc5cjYtaW1hZ2VzXzE3ODM2OTAxMTMxNDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyTnZibWRsYzE5aFluTmxibU5sY3cucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg1NTQyNDAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Q2KlMHShJV-gW2hLOY8n6CX7wZ1cRfbej2vnBflgooIKaDI2eAIGcXoUIWjiiK78HOsOI~1ZID1oQx~UoBqESvKN3qNwJ5vDDIF5Be3igukScVXTK2ce15UmX9U4LSjH-rLyzV3A4oojFUzHaaG~HBZCIpgKwEbHu3IT7KVzOOhswJS8aFGhEAo~7JT88lRrsH6CWy~Lz3IDTHwlp73syA0T3I5ZNkb7s-pnd4DBWOLovyNr2Zsl-zckwWpuBOzui-OMJpwWx4~-9akFUkVuH28v1SRDQILAFrfP20o1r~G~6OMXb12qkMuG5TIeL~EdNtbpy3KwdEzWhsBIV2kdVQ__)

### 11.4 Visibilité des Menus par Rôle

Ce schéma synthétise les menus accessibles à chaque rôle de la plateforme.

![Menus par Rôle](https://private-us-east-1.manuscdn.com/sessionFile/tgSjHWhtPni6SImvxukDFy/sandbox/MexySrc8n3LHMfpytm79r6-images_1783690113144_na1fn_L2hvbWUvdWJ1bnR1L21lbnVzX3Zpc2liaWxpdGU.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdGdTakhXaHRQbmk2U0ltdnh1a0RGeS9zYW5kYm94L01leHlTcmM4bjNMSE1mcHl0bTc5cjYtaW1hZ2VzXzE3ODM2OTAxMTMxNDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyMWxiblZ6WDNacGMybGlhV3hwZEdVLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc4NTU0MjQwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Was-avttYQBvpLYVFAPEsPz9aV0xNclDr1OpfdO5IyYUnSVaVBGyxf9YEh9N1HXBIlshsHwm6xcwtSkFt3NVTjn12Wwf0953HUNQy4HytXr-kKbrTcLjxcUQ8GKH4wHZzOYo5rSGWwW6m5eEgsmU3cOB4J1wfSe1ur7e2rKGkC-shFUI5l7xq7i8qfDK6Ru2H4U52kqyf-GoXSNbrp3VrjCpmjQ5BiEBpsxId7i1axWlxIoeBJirqaCgCj9G0HvO4CSYfPJ3oSBI2BlYOr3ueyal4h98mOxgtWSNqqz3tOy5YaCQKntYwddHBMicT5qxh1P2z4ppxrEy~h~BKa9BYw__)

---

## 12. Glossaire

| Terme | Définition |
| --- | --- |
| **Workflow** | Enchaînement de statuts définissant le cycle de vie d'un type de tâche. |
| **Statut figé** | Statut dont le passage est contrôlé exclusivement par le Chef d'équipe Prod (ou Admin/Manager). |
| **Statut évolutif** | Statut dont le passage peut être effectué par les rôles autorisés sans contrainte de planification. |
| **Reporting** | Saisie manuelle du temps passé par un utilisateur sur une tâche. |
| **On hold** | Statut de projet gelé empêchant l'ajout de nouvelles tâches. |
| **KPI** | Indicateur clé de performance, ici le ratio tâches prévues vs réalisées. |
| **Feuille de présence** | Tableau hebdomadaire récapitulant le temps reporté par un collaborateur. |
| **Mention** | Fonctionnalité permettant de taguer un utilisateur dans un commentaire via "@nom", déclenchant une notification. |
| **Jour férié** | Jour non ouvré défini par le Manager, exempté du contrôle de reporting. |

---

*Document rédigé par Ameur Stambouli - Neopolis Development - Juillet 2026*
