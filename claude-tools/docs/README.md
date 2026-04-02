# Documentation — claude-tools

Bienvenue dans la documentation de mes outils Claude Code. Ce dossier couvre les quatre piliers qui rendent mon workflow avec Claude Code efficace et économique.

---

## Sommaire

| Section | Description |
|---|---|
| [Agents](./agents.md) | Sous-agents spécialisés : PO, DEV, QA, Tech Lead |
| [Skills](./skills.md) | Commandes slash réutilisables pour les workflows Notion |
| [RTK](./rtk.md) | Outil d'optimisation des tokens (−60 à −90%) |
| [MCP](./mcp.md) | Model Context Protocol : connecter Notion et d'autres outils à Claude |

---

## Pourquoi ces outils ?

Claude Code fonctionne avec un système de **tokens par session (5h) et par semaine**. Sans optimisation, une journée de développement intensif peut épuiser son quota rapidement. Ces quatre outils répondent chacun à un problème précis :

- **MCP** : donne à Claude accès à des données externes (Notion, Home Assistant…) sans copier-coller
- **RTK** : compresse les sorties de commandes pour réduire la taille du contexte de 60 à 90%
- **Agents** : délègue les tâches répétitives à des sous-instances spécialisées, chacune avec son propre contexte
- **Skills** : encapsule les workflows complexes en une seule commande, pour ne pas réexpliquer à chaque fois

Ensemble, ils permettent de travailler **deux fois plus longtemps** sur une même session sans dépasser les quotas.

---

## Architecture globale

```
Toi (utilisateur)
    │
    ▼
Claude Code (orchestrateur)
    ├── MCP Notion ──────────────────► Base Notion (projets, tâches)
    ├── Skills (/start-task, etc.) ─► Workflows encapsulés
    ├── RTK ────────────────────────► Compression des outputs
    └── Agents
            ├── PO  ──────────────► Gestion Notion
            ├── DEV ──────────────► Implémentation code
            ├── QA  ──────────────► Tests
            └── Tech Lead ────────► Code review
```

---

## Liens utiles

- [Claude Code — Documentation officielle](https://docs.anthropic.com/fr/docs/claude-code)
- [MCP — Model Context Protocol](https://modelcontextprotocol.io/)
- [RTK sur GitHub](https://github.com/lafllamme/rtk)
- [Notion MCP sur GitHub](https://github.com/makenotion/notion-mcp-server)
