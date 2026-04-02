# Modifier une tâche existante

L'utilisateur veut modifier une tâche dans le projet Mealix. Il peut vouloir ajouter du contexte, changer le statut, la priorité, la complexité, ou compléter les notes.

## Ce que tu dois faire

### 1. Identifier la tâche

L'utilisateur peut fournir :
- Un nom exact ou approximatif de la tâche
- Une description de ce qu'elle concerne

Utilise `notion-search` pour trouver la tâche dans le projet. Si plusieurs résultats correspondent, liste-les et demande à l'utilisateur laquelle modifier.

**⚠️ Toujours utiliser `notion-fetch` sur l'ID de la tâche trouvée pour lire ses propriétés réelles avant de modifier** — les résultats de `notion-search` ne reflètent pas nécessairement l'état actuel.

### 2. Afficher l'état actuel

Avant de modifier, montre brièvement l'état actuel de la tâche (lu depuis `notion-fetch`, pas depuis le search) :
- Titre, Status, Priorité, Complexité
- Notes existantes (résumé si longues)

### 3. Appliquer les modifications

Selon ce que l'utilisateur demande, mets à jour les propriétés concernées via `notion-update-page` :

- `Tâche` : nouveau titre si demandé
- `Status` : parmi `Backlog`, `To do`, `In progress`, `Code review`, `Functional review`, `OK`, `KO`, `Done`
- `Priorité` : parmi `🔴 Haute`, `🟡 Moyenne`, `🟢 Basse`
- `Complexité` : parmi `XS`, `S`, `M`, `L`, `XL`
- `Notes` : si l'utilisateur ajoute du contexte, **complète** les notes existantes plutôt que de les remplacer (sauf si remplacement explicitement demandé). Formate proprement avec séparation entre le contenu original et le nouvel ajout.

### 4. Confirmer

Résume les changements effectués de façon compacte.

## Identifier le projet actif

Les IDs ne sont pas hardcodés ici — ils dépendent du projet actif.
- Lis les fichiers mémoire dans `~/.claude/projects/*/memory/` pour trouver le projet correspondant au contexte de la conversation
- Le `data_source_id` de la base Tasks est indiqué dans le fichier mémoire du projet
- Si ce n'est pas clair, demande à l'utilisateur lequel cibler
