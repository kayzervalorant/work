# Skills — Commandes slash réutilisables

## Qu'est-ce qu'un skill ?

Un **skill** (aussi appelé "command" dans Claude Code) est un morceau de prompt encapsulé dans un fichier `.md`, accessible via une commande slash (`/nom-du-fichier`).

L'idée : plutôt que de réexpliquer à Claude comment démarrer une tâche à chaque fois, on écrit une fois le workflow complet dans un fichier, et on l'invoque en une seule commande.

Un skill peut :
- Appeler des MCPs (Notion, GitHub…)
- Invoquer des agents
- Lire des fichiers locaux
- Exécuter n'importe quelle action que Claude Code peut faire

> **Source officielle :** [Slash commands — Claude Code docs](https://docs.anthropic.com/fr/docs/claude-code/slash-commands)

---

## Structure d'un fichier skill

```markdown
# Titre du skill

Description de ce que fait le skill.

## Étape 1 — ...

Instructions détaillées pour Claude...

## Étape 2 — ...

...
```

Pas de frontmatter obligatoire pour les skills (contrairement aux agents). Le nom du fichier détermine la commande slash : `start-task.md` → `/start-task`.

---

## Les skills de ce projet

Tous ces skills sont construits autour de **Notion** comme outil de gestion de projet. Ils supposent que le MCP Notion est configuré et qu'une base de données de tâches existe pour le projet actif.

### `/add-task` — Ajouter une tâche en Backlog

**Usage :** `/add-task Créer la page d'accueil avec la liste des recettes`

**Ce que ça fait :**
1. Analyse la description fournie
2. Infère automatiquement : titre actionnable, priorité, complexité (T-shirt size), critères d'acceptation
3. Identifie le projet actif en lisant les fichiers mémoire `~/.claude/projects/*/memory/`
4. Crée la tâche dans Notion avec toutes les propriétés renseignées
5. Confirme avec un résumé compact

**Complexité inférée automatiquement :**
| Taille | Durée estimée |
|---|---|
| XS | < 30 min |
| S | 1-2h |
| M | Demi-journée |
| L | 1-2 jours |
| XL | > 2 jours |

---

### `/new-project` — Créer un nouveau projet

**Usage :** `/new-project`

**Ce que ça fait :**
1. Collecte les infos du projet (nom, description, tags, GitHub, tâches initiales)
2. Crée la page projet dans la base Notion "Side Projects"
3. Crée une base de données Tasks inline avec le schéma standard
4. Crée une vue Kanban sur cette base
5. Ajoute les tâches initiales en Backlog
6. Sauvegarde les IDs Notion en mémoire locale (`~/.claude/projects/.../memory/`)

**Structure Notion créée :**
```
Side Projects/
└── Nom du projet/
    ├── Vision, Architecture, Setup...  (contenu de la page)
    └── Tasks (base de données inline)
            ├── Vue Kanban
            └── Colonnes : Tâche, Status, Priorité, Complexité, Notes
```

---

### `/start-task` — Démarrer la prochaine tâche

**Usage :** `/start-task` ou `/start-task` puis "oui, avec code review"

**Ce que ça fait :**
1. Lit **toujours** l'état frais depuis Notion (pas de cache)
2. Trouve la prochaine tâche en statut `To do`
3. Demande confirmation avant de faire quoi que ce soit
4. Réveille l'agent `dev` avec l'ID de la tâche et l'info sur la code review

**Règle importante :** Ce skill ne prend jamais une tâche en `Backlog` — uniquement `To do`. C'est à toi de passer les tâches en `To do` quand elles sont prêtes.

---

### `/update-task` — Modifier une tâche existante

**Usage :** `/update-task` puis description de ce qu'on veut changer

**Ce que ça fait :**
1. Trouve la tâche par nom (recherche sémantique dans Notion)
2. Affiche l'état actuel avant de modifier
3. Applique les modifications : titre, status, priorité, complexité, notes
4. Complète les notes existantes plutôt que de les remplacer (sauf demande explicite)

---

## Installation

```bash
# Copier les skills dans le dossier global Claude Code
cp commands/*.md ~/.claude/commands/
```

Les skills sont disponibles immédiatement après la copie, dans toutes les conversations Claude Code.

---

## Créer son propre skill

1. Créer un fichier `mon-workflow.md` dans `~/.claude/commands/`
2. Écrire les instructions en markdown (pas de frontmatter requis)
3. Utiliser `/mon-workflow` dans Claude Code

**Conseils :**
- Être très précis sur l'ordre des étapes
- Préciser les outils à utiliser (ex: "utilise `notion-search` pour trouver...")
- Anticiper les cas d'ambiguïté et indiquer quoi faire (ex: "si plusieurs résultats, demander à l'utilisateur")
- Documenter les dépendances (MCPs requis, fichiers mémoire attendus...)
