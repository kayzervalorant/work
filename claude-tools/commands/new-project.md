# Créer un nouveau Side Project

Tu vas créer un nouveau side project dans Notion avec sa propre base de données de tâches. Suis ces étapes dans l'ordre.

## Informations à collecter

Si l'utilisateur n'a pas fourni toutes ces infos, demande-les avant de commencer :
- **Nom du projet** (obligatoire)
- **Description courte** (1-2 phrases, obligatoire)
- **Tags** (optionnel, parmi : IA, Web, Mobile, CLI, API, Home Lab)
- **URL GitHub** (optionnel)
- **Tâches initiales** (optionnel, liste de premières tâches à ajouter en Backlog)

---

## Étape 1 — Créer la page projet dans Side Projects

Crée une page dans la base de données Side Projects avec le MCP Notion :
- **data_source_id** : `32312bcc-f9bc-80ae-a870-000b74d0e0d6`
- **Propriétés** :
  - `Nom` : le nom du projet
  - `Status` : `Active`
  - `Description` : la description courte
  - `Tags` : les tags (JSON array, ex: `["IA", "Web"]`)
  - `GitHub` : l'URL GitHub si fournie
- **Icône** : un emoji pertinent selon le projet (ex: 🍕 pour une app food, 🤖 pour de l'IA...)
- **Contenu** : utilise exactement ce Markdown (remplace les placeholders entre crochets) :

```markdown
## 🎯 Vision Globale

> [Description courte du projet — reprend la description fournie]

**Problème :** [Quel problème ça résout ?]

**Solution :** [Comment ça le résout ?]

**Cible :** [Pour qui ?]

---

## 📚 Documentation

<details>
<summary>Architecture & Stack technique</summary>

- **Frontend :** …
- **Backend :** …
- **BDD :** …
- **Infra :** …

</details>

<details>
<summary>Setup & Installation</summary>

```bash
# Cloner le repo
git clone <url>

# Installer les dépendances
npm install

# Lancer en dev
npm run dev
```

</details>

<details>
<summary>Variables d'environnement</summary>

| Variable | Description | Exemple |
|---|---|---|
| `API_KEY` | … | `sk-...` |

</details>

<details>
<summary>Décisions techniques (ADR)</summary>

Aucune décision documentée pour le moment.

</details>

---

## ✅ Tâches

*(La base de données des tâches sera créée juste en dessous)*

---

## 📝 Notes & Idées

- …
```

**Récupère l'ID de la page créée** — tu en auras besoin pour les étapes suivantes.

---

## Étape 2 — Créer la base de données Tasks inline dans le projet

Crée une base de données avec le MCP Notion, en utilisant la page projet comme parent :
- **parent** : `{ "type": "page_id", "page_id": "<ID de la page créée à l'étape 1>" }`
- **title** : `Tasks`
- **schema** :

```sql
CREATE TABLE (
  "Tâche" TITLE,
  "Status" SELECT('Backlog':gray, 'To do':blue, 'In progress':yellow, 'Code review':orange, 'Functional review':purple, 'OK':green, 'KO':red, 'Done':default),
  "Priorité" SELECT('🔴 Haute':red, '🟡 Moyenne':yellow, '🟢 Basse':green),
  "Notes" RICH_TEXT
)
```

**Récupère le `database_id` et le `data_source_id`** de la base créée.

---

## Étape 3 — Créer la vue Kanban sur la base Tasks

Crée une vue board sur la base Tasks :
- **database_id** : l'ID de la base Tasks créée à l'étape 2
- **data_source_id** : le data_source_id de la base Tasks créée à l'étape 2
- **name** : `Kanban`
- **type** : `board`
- **configure** : `GROUP BY "Status"; SHOW "Priorité"`

---

## Étape 4 — Créer les tâches initiales

Si l'utilisateur a fourni des tâches initiales, crée-les dans la base Tasks du projet :
- **data_source_id** : le data_source_id de la base Tasks créée à l'étape 2
- **Propriétés par tâche** :
  - `Tâche` : nom de la tâche
  - `Status` : `Backlog`
  - `Priorité` : `🟡 Moyenne` par défaut (ajuste si précisé par l'utilisateur)

---

## Étape 5 — Sauvegarder en mémoire

Crée ou mets à jour le fichier mémoire du projet dans `~/.claude/projects/<projet-actif>/memory/project_<nom>.md` avec ce format :

```markdown
---
name: Projet <Nom>
description: <Description courte>
type: project
---

Projet <Nom> — <description courte>.

**Why:** <problème résolu>

**How to apply:** Toujours utiliser les IDs Notion ci-dessous pour les opérations de tâches.

## Références Notion

| Ressource | ID |
|---|---|
| Page projet | `<page_id de l'étape 1>` |
| Tasks data_source_id | `<data_source_id de l'étape 2>` |
| Tasks database_id | `<database_id de l'étape 2>` |

## Stack

Voir `user_web_architecture.md` pour la stack de base.
Design system : **<design system choisi>**.
```

Puis ajoute un pointeur vers ce fichier dans `MEMORY.md` :
```
- [<Nom>](./project_<nom>.md) — <description courte>
```

## Étape 6 — Confirmer à l'utilisateur

Communique :
- Le lien vers la page projet Notion
- Le nombre de tâches créées en Backlog
- Un rappel du flow de travail : "Dis-moi de prendre la prochaine tâche quand tu veux commencer !"

---

## Références Notion

| Ressource | ID |
|---|---|
| Side Projects DB | `32312bcc-f9bc-8049-9624-e065859ceb86` |
| Side Projects data source | `32312bcc-f9bc-80ae-a870-000b74d0e0d6` |
