# MCP — Model Context Protocol

## Qu'est-ce que le MCP ?

**MCP (Model Context Protocol)** est un standard ouvert créé par **Anthropic** (la société derrière Claude) qui permet de connecter des outils et services externes aux modèles d'IA.

En clair : c'est ce qui permet à Claude de lire et écrire dans Notion, accéder à Gmail, contrôler Home Assistant, ou interagir avec n'importe quel service externe — sans que tu aies à copier-coller les données manuellement.

Le protocole est maintenant **open source** et adopté par de nombreux éditeurs.

> **Documentation officielle :** [Model Context Protocol](https://modelcontextprotocol.io/)
> **Source Anthropic :** [MCP dans Claude Code](https://docs.anthropic.com/fr/docs/claude-code/mcp)

---

## Comment ça fonctionne ?

Un serveur MCP expose des **outils** que Claude peut appeler, exactement comme il appelle ses outils natifs (`Read`, `Write`, `Bash`…). La différence : ces outils communiquent avec des services externes via une API standardisée.

```
Claude Code
    │
    ▼
MCP Client (intégré dans Claude Code)
    │
    ▼
Serveur MCP (ex: notion-mcp-server)
    │
    ▼
API externe (ex: API Notion)
```

Du point de vue de Claude, appeler `mcp__notion__notion-fetch` pour lire une page Notion est aussi simple qu'appeler `Read` pour lire un fichier local.

---

## MCP Notion

Le MCP Notion permet à Claude de lire et modifier directement tes pages et bases de données Notion.

> **Repository GitHub :** [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server)

### Outils disponibles

| Outil | Description |
|---|---|
| `notion-search` | Recherche sémantique dans Notion |
| `notion-fetch` | Lit une page ou base de données par son ID |
| `notion-create-pages` | Crée une nouvelle page ou entrée de base de données |
| `notion-create-database` | Crée une base de données inline |
| `notion-create-view` | Crée une vue (Kanban, table, etc.) |
| `notion-update-page` | Met à jour les propriétés d'une page |
| `notion-update-data-source` | Met à jour une source de données |
| `notion-get-comments` | Lit les commentaires d'une page |
| `notion-create-comment` | Ajoute un commentaire à une page |
| `notion-duplicate-page` | Duplique une page |
| `notion-move-pages` | Déplace des pages |

### Installation

```bash
claude mcp add notion-mcp -- npx -y @notionhq/notion-mcp-server
```

C'est tout. Claude Code te guidera pour te connecter à ton compte Notion au premier usage.

### Pourquoi Notion ?

Notion est utilisé comme **outil central de gestion de projet** dans ce workflow. C'est lui qui fait office de :
- Backlog et kanban de tâches
- Documentation de projet
- Journal des décisions techniques (via commentaires)
- Communication entre les agents (PO → DEV → Tech Lead)

Les agents lisent et écrivent dans Notion à chaque étape du cycle de vie d'une tâche, ce qui te donne une traçabilité complète sans effort manuel.

---

## Autres MCPs intéressants

### Home Assistant

Si tu utilises Home Assistant pour domotique, il existe un MCP qui permet à Claude de lire l'état de tes appareils et d'en contrôler certains.

> **Repository :** [votre-hub/home-assistant-mcp](https://github.com/joaompinto/homeassistant-mcp) *(exemple — plusieurs implémentations existent)*

Cas d'usage possibles :
- "Allume les lumières du bureau"
- "Quel est la température dans le salon ?"
- Automatiser des routines via des commandes en langage naturel

### GitHub

```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

Permet à Claude de lire les issues, PRs, commits et de créer des PRs directement.

### Filesystem

MCP officiel pour donner à Claude un accès contrôlé à des dossiers spécifiques de ton système de fichiers.

---

## Lister les MCPs configurés

```bash
claude mcp list
```

---

## Bonnes pratiques

- **Principe du moindre privilège** : dans les fichiers agents, ne liste que les outils MCP dont l'agent a réellement besoin
- **Vérifier les permissions Notion** : l'intégration Notion doit avoir accès aux pages que tu veux que Claude puisse lire
- **Ne pas hardcoder les IDs** : stocker les IDs Notion dans les fichiers mémoire (`~/.claude/projects/.../memory/`) plutôt que dans les agents
