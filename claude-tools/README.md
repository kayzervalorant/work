# claude-tools

Configurations personnelles pour **Claude Code** : agents IA spécialisés et commandes slash réutilisables.

> Retrouve la documentation détaillée dans le dossier [`docs/`](./docs/README.md).

---

## Structure

```
claude-tools/
├── agents/          # Sous-agents Claude spécialisés
│   ├── po.md        # Product Owner — gestion Notion
│   ├── dev.md       # Développeur — implémentation
│   ├── qa.md        # QA — tests et validation
│   └── tech-lead.md # Tech Lead — code review
├── commands/        # Skills / commandes slash réutilisables
│   ├── add-task.md      # Ajouter une tâche en Backlog
│   ├── new-project.md   # Créer un nouveau projet
│   ├── start-task.md    # Démarrer la prochaine tâche
│   └── update-task.md   # Modifier une tâche existante
└── docs/            # Documentation approfondie
```

---

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/AyLabsCode/claude-tools.git
```

### 2. Copier les agents

Les agents doivent être placés dans `~/.claude/agents/` :

```bash
cp claude-tools/agents/*.md ~/.claude/agents/
```

Claude Code les détecte automatiquement. Aucune configuration supplémentaire n'est nécessaire.

### 3. Copier les commands (skills)

Les skills doivent être placés dans `~/.claude/commands/` :

```bash
cp claude-tools/commands/*.md ~/.claude/commands/
```

Ils sont ensuite accessibles via `/nom-du-fichier` dans n'importe quelle conversation Claude Code.

---

## Le dossier `agents/`

Les agents sont des **sous-instances de Claude** avec un rôle et des outils précis. Claude Code les invoque automatiquement selon le contexte, ou tu peux les appeler explicitement.

| Agent | Rôle | Outils principaux |
|---|---|---|
| `po` | Gérer les tâches et projets dans Notion | MCP Notion |
| `dev` | Implémenter les tâches techniques | Read, Write, Edit, Bash, MCP Notion |
| `qa` | Écrire et jouer les tests | Vitest, Playwright, MCP Notion |
| `tech-lead` | Faire la code review | Read, Grep, Glob, MCP Notion |

**Comment ça marche :** Chaque fichier `.md` dans `~/.claude/agents/` définit un agent avec :
- Un `name` et une `description` (utilisés par Claude pour décider quand l'invoquer)
- Une liste de `tools` autorisés
- Un prompt système complet

---

## Le dossier `commands/`

Les commands sont des **prompts réutilisables** déclenchés par une commande slash. Ils encapsulent des workflows complexes en une seule instruction.

| Command | Déclencheur | Action |
|---|---|---|
| `add-task` | `/add-task` | Créer une tâche en Backlog dans Notion |
| `new-project` | `/new-project` | Initialiser un projet complet dans Notion |
| `start-task` | `/start-task` | Trouver la prochaine tâche et réveiller le dev |
| `update-task` | `/update-task` | Modifier une tâche existante dans Notion |

**Comment ça marche :** Quand tu tapes `/start-task`, Claude charge le contenu de `start-task.md` comme instruction et l'exécute. Les commands peuvent invoquer des agents, appeler des MCPs, lire des fichiers — tout ce que Claude Code peut faire.

---

## Prérequis

Ces outils supposent que tu as :

- [Claude Code](https://claude.ai/code) installé
- Le [MCP Notion](./docs/mcp.md) configuré (`claude mcp add notion-mcp`)
- Une base Notion avec la structure de projets attendue (voir [`docs/agents.md`](./docs/agents.md))

---

## Documentation

| Sujet | Fichier |
|---|---|
| Vue d'ensemble | [`docs/README.md`](./docs/README.md) |
| Agents | [`docs/agents.md`](./docs/agents.md) |
| Skills / Commands | [`docs/skills.md`](./docs/skills.md) |
| RTK (optimisation tokens) | [`docs/rtk.md`](./docs/rtk.md) |
| MCP Notion | [`docs/mcp.md`](./docs/mcp.md) |
