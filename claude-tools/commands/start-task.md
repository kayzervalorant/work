# Démarrer la prochaine tâche

Ce skill est exécuté par le **PO**. Il trouve la prochaine tâche `To do`, demande confirmation, puis réveille le dev.

## ⚠️ Règle absolue — Toujours rafraîchir depuis Notion

**Ne jamais se fier à un état mémorisé ou précédemment observé des tâches.**
L'utilisateur peut modifier les statuts à la main dans Notion entre deux interactions. Le référentiel Notion fait toujours foi.

**Avant toute action, obligatoirement :**
1. Récupérer la liste fraîche de toutes les tâches depuis Notion
2. Lire les propriétés réelles de chaque tâche (notamment `Status`)
3. Ne jamais supposer qu'une tâche est encore en `Backlog` si l'utilisateur demande de commencer — elle a peut-être été passée en `To do` manuellement

## Étape 1 — Rafraîchir et trouver la prochaine tâche

**⚠️ Important** : `notion-search` fait une recherche sémantique et **ne filtre pas par valeur de propriété**. Il ne faut pas l'utiliser seul pour trouver les tâches "To do".

Procédure correcte (obligatoire à chaque exécution, sans exception) :
1. Lis les fichiers mémoire dans `~/.claude/projects/*/memory/` pour identifier le `data_source_id` de la base Tasks du projet
2. Utilise `notion-search` sur ce `data_source_id` pour obtenir la liste de toutes les tâches
3. Pour **chaque tâche retournée**, utilise `notion-fetch` sur son ID pour lire ses propriétés réelles (notamment `Status`) — les résultats de search ne contiennent pas les propriétés à jour
4. Garde uniquement celles dont `Status = "To do"`, triées par date de création (la plus ancienne en premier)

Pour identifier le bon `data_source_id` : lis les fichiers mémoire dans `~/.claude/projects/*/memory/` pour trouver le projet correspondant au contexte de la conversation.

## Étape 2 — Demander confirmation

Affiche le nom de la tâche à l'utilisateur et demande confirmation **avant de faire quoi que ce soit** :

> "La prochaine tâche est : **[nom de la tâche]**. On y va ?"

Attends un "oui" explicite. Si l'utilisateur dit non ou veut une autre tâche, propose les suivantes.

Note également si l'utilisateur demande une **code review** pour cette tâche (ex: "oui, avec code review"). Par défaut : **pas de code review**.

## Étape 3 — Réveiller le dev

Dès confirmation, invoque l'agent `dev` en lui transmettant :
- L'ID Notion de la tâche (page_id)
- Le nom de la tâche
- Si une code review est demandée (oui/non)

Le dev s'occupera de :
- Passer la tâche en `In progress`
- Réaliser le travail
- Passer en `Functional review` (défaut) ou `Code review` (si demandé)

## Étape 4 — Si code review demandée

Si le dev passe la tâche en `Code review`, c'est le PO qui réveille le tech-lead en invoquant l'agent `tech-lead` avec l'ID de la tâche.

## Règles importantes

- Ne jamais démarrer une tâche sans confirmation du PO
- Ne jamais prendre une tâche en `Backlog` — uniquement `To do`
- Par défaut : pas de code review (Functional review directement)
- C'est toujours le PO qui initie, jamais le dev ou le tech-lead de leur propre chef
