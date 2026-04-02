# RTK — Rust Token Killer

## Le problème des tokens

Quand tu travailles avec Claude Code, chaque échange consomme des **tokens** : les données envoyées (code, sorties de commandes, historique) et les données reçues (réponse de Claude) sont toutes comptabilisées.

Claude Code fonctionne avec deux quotas :
- **Tokens par session** (fenêtre de 5h)
- **Tokens par semaine**

Le problème : les sorties de commandes comme `cargo build`, `tsc`, `npm install` ou `git diff` peuvent être **très verbeuses**. Une sortie de build peut faire des milliers de lignes, dont 90% sont du bruit inutile pour Claude.

## La solution : RTK

**RTK (Rust Token Killer)** est un outil installé directement sur le système qui s'intercale entre tes commandes et Claude Code. Il **filtre et compresse** les sorties avant qu'elles n'entrent dans le contexte.

> **Repository GitHub :** [lafllamme/rtk](https://github.com/lafllamme/rtk)

Le principe est simple : préfixer tes commandes avec `rtk` au lieu de les lancer directement.

```bash
# Sans RTK — sortie complète dans le contexte
cargo build

# Avec RTK — sortie compressée, erreurs seulement
rtk cargo build
```

---

## Économies par catégorie

| Catégorie | Commandes | Économie typique |
|---|---|---|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package managers | pnpm, npm, npx | 70-90% |
| Fichiers | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Réseau | curl, wget | 65-70% |

**Moyenne générale : 60-90% de réduction** sur les opérations courantes.

En pratique, ça permet de travailler **deux fois plus longtemps** sur une même session sans dépasser les quotas.

---

## Commandes principales

### Build & Compilation
```bash
rtk cargo build         # Filtre la sortie Cargo
rtk cargo check         # Cargo check compressé
rtk cargo clippy        # Warnings groupés par fichier
rtk tsc                 # Erreurs TypeScript groupées par fichier
rtk lint                # Violations ESLint/Biome groupées
rtk next build          # Build Next.js avec métriques par route
```

### Tests
```bash
rtk cargo test          # Uniquement les échecs
rtk vitest run          # Uniquement les échecs (99.5% d'économie !)
rtk playwright test     # Uniquement les échecs
rtk test <cmd>          # Wrapper générique — échecs uniquement
```

### Git
```bash
rtk git status          # Statut compact
rtk git log             # Log compact (fonctionne avec tous les flags)
rtk git diff            # Diff compact
rtk git add             # Confirmations ultra-compactes
rtk git commit          # Confirmations ultra-compactes
rtk git push            # Confirmations ultra-compactes
```

### GitHub CLI
```bash
rtk gh pr view <num>    # Vue PR compacte
rtk gh pr checks        # Checks PR compacts
rtk gh run list         # Workflows compacts
rtk gh issue list       # Issues compactes
```

### Package managers
```bash
rtk pnpm install        # Sortie d'install compressée
rtk pnpm list           # Arbre de dépendances compact
rtk npm run <script>    # Sortie de script compact
rtk npx <cmd>           # Commande npx compacte
```

### Analyse & Debug
```bash
rtk err <cmd>           # Filtre uniquement les erreurs
rtk log <file>          # Logs dédupliqués avec compteurs
rtk summary <cmd>       # Résumé intelligent d'une commande
rtk diff                # Diffs ultra-compacts
```

### Meta-commandes RTK
```bash
rtk gain                # Statistiques d'économies de tokens
rtk gain --history      # Historique avec économies par commande
rtk discover            # Analyse les sessions Claude Code pour les usages RTK manqués
rtk init                # Ajouter les instructions RTK au CLAUDE.md du projet
rtk init --global       # Ajouter RTK au CLAUDE.md global (~/.claude/CLAUDE.md)
```

---

## Règle d'or

**Toujours préfixer avec `rtk`**, même dans les chaînes de commandes :

```bash
# Mauvais
git add . && git commit -m "msg" && git push

# Bon
rtk git add . && rtk git commit -m "msg" && rtk git push
```

RTK est conçu pour être un pass-through sûr : si la commande n'a pas de filtre dédié, elle passe telle quelle. Il n'y a donc aucun risque à l'utiliser systématiquement.

---

## Installation

Voir le [README officiel de RTK](https://github.com/lafllamme/rtk) pour les instructions d'installation selon ton système.

Une fois installé, lance `rtk init --global` pour ajouter automatiquement les instructions RTK à ton `~/.claude/CLAUDE.md`, afin que Claude sache toujours les utiliser.
