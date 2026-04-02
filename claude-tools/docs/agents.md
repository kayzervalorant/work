# Agents — Sous-instances Claude spécialisées

## Qu'est-ce qu'un agent ?

Dans Claude Code, un **agent** est une sous-instance de Claude lancée avec :
- Un **rôle précis** (défini dans un prompt système)
- Des **outils restreints** (il ne peut utiliser que ce qu'on lui autorise)
- Un **contexte isolé** (sa conversation ne pollue pas la conversation principale)

Concrètement, quand Claude Code a besoin de faire une code review, il peut invoquer un agent `tech-lead` dédié plutôt que de tout faire dans le même contexte. Ça rend le système plus fiable, plus lisible, et ça préserve les tokens de la conversation principale.

Pour créer un agent, il suffit de déposer un fichier `.md` dans `~/.claude/agents/`. Claude Code les découvre automatiquement.

> **Source officielle :** [Sub-agents — Claude Code docs](https://docs.anthropic.com/fr/docs/claude-code/sub-agents)

---

## Structure d'un fichier agent

```markdown
---
name: mon-agent
description: Description courte — quand Claude doit l'invoquer
tools: Read, Write, Edit, Bash, Glob, Grep
---

Prompt système complet de l'agent...
```

- `name` : identifiant de l'agent (utilisé pour l'invoquer explicitement)
- `description` : phrase qui aide Claude à décider **quand** invoquer cet agent automatiquement
- `tools` : liste des outils autorisés (principe du moindre privilège)

---

## Les agents de ce projet

Ces agents forment une équipe de développement virtuelle. Ils se réveillent les uns les autres selon le cycle de vie des tâches.

### PO — Product Owner (`po.md`)

**Rôle :** Point d'entrée de toute l'équipe. Gère les projets et les tâches dans Notion.

**Responsabilités :**
- Créer et maintenir les projets dans Notion
- Créer, prioriser et enrichir les tâches
- Orchestrer le flux de travail : décider quelle tâche démarrer, réveiller le DEV, réveiller le Tech Lead si besoin

**Outils :** MCP Notion uniquement (pas d'accès au code)

**Cycle de vie des tâches :**
```
Backlog → To do → In progress → [Code review →] Functional review → Done
```

---

### DEV — Développeur (`dev.md`)

**Rôle :** Implémente les tâches techniques. Invoqué par le PO quand une tâche est confirmée.

**Responsabilités :**
- Lire la tâche Notion avant de coder (brief + critères d'acceptation)
- Mettre la tâche en `In progress`
- Implémenter en respectant l'architecture DDD et TypeScript strict
- Créer un commit git conventionnel (`feat(scope): description`)
- Ajouter un commentaire Notion résumant le travail
- Passer la tâche en `Functional review` (ou `Code review` si demandé)

**Convention de commit :**
```
type(scope): description
```
Types : `feat`, `fix`, `refactor`, `chore`, `style`, `docs`, `test`

**Outils :** Read, Write, Edit, Bash, Glob, Grep, MCP Notion

---

### QA — Quality Assurance (`qa.md`)

**Rôle :** Valide la qualité via les tests. Peut être invoqué après le DEV.

**Responsabilités :**
- Écrire les tests unitaires (Vitest + React Testing Library)
- Écrire les tests e2e (Playwright)
- Passer la tâche en `Done` si tout passe, `KO` sinon

**Règles :**
- Ne jamais modifier le code source pour faire passer un test — signaler le bug
- Fichiers de test unitaire colocalisés (`*.test.ts`)
- Fichiers e2e dans `e2e/`

**Outils :** Read, Write, Edit, Bash, Glob, Grep, MCP Notion

---

### Tech Lead (`tech-lead.md`)

**Rôle :** Code review. Intervient **uniquement si explicitement demandé** par le PO.

**Critères de review :**
- Architecture DDD respectée (pas de `fetch` dans les composants, logique métier dans `domain/`)
- TypeScript strict (pas de `any`)
- Tous les critères d'acceptation couverts
- Pas de secrets hardcodés

**Décision :**
- ✅ Tout est bon → `git push` + tâche en `Functional review`
- ❌ Points bloquants → commentaire précis dans Notion + tâche en `In progress`

**Outils :** Read, Glob, Grep, Bash, MCP Notion

---

## Flux complet

```
/start-task
    │
    ▼
PO trouve la tâche "To do" dans Notion
    │
    ▼
PO demande confirmation à l'utilisateur
    │
    ▼
PO réveille DEV (avec l'ID Notion de la tâche)
    │
    ▼
DEV lit la tâche → code → commit → Functional review
    │                                      │
    │ (si code review demandée)            │
    ▼                                      ▼
PO réveille Tech Lead              Utilisateur teste
    │
    ▼
Tech Lead review → push ou renvoi au DEV
```

---

## Installation

```bash
# Copier les agents dans le dossier global Claude Code
cp agents/*.md ~/.claude/agents/
```

Claude Code détecte automatiquement les nouveaux agents au prochain démarrage.
