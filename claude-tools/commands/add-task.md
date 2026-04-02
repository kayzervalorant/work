# Ajouter une tâche en Backlog

L'utilisateur veut ajouter une tâche dans le projet Mealix. À partir de sa description, tu dois inférer toutes les infos utiles et créer la tâche dans Notion.

## Ce que tu dois faire

1. **Analyser la description** fournie par l'utilisateur (arguments du slash command ou message suivant)
2. **Inférer les propriétés** suivantes :
   - `Tâche` : titre court et actionnable (commence par un verbe : "Créer", "Implémenter", "Corriger"...)
   - `Status` : toujours `Backlog`
   - `Priorité` : estime parmi `🔴 Haute`, `🟡 Moyenne`, `🟢 Basse` selon l'impact fonctionnel
   - `Complexité` : estime la complexité technique en T-shirt size parmi `XS`, `S`, `M`, `L`, `XL`
     - XS = < 30 min, trivial
     - S = 1-2h, simple
     - M = demi-journée, quelques composants
     - L = 1-2 jours, plusieurs couches impactées
     - XL = > 2 jours, refonte ou incertitude forte
   - `Notes` : rédige un mini brief avec :
     - Ce qu'il faut faire (1-3 bullet points)
     - Critères d'acceptation (ce qui valide que c'est "Done")
     - Éventuelles dépendances ou points d'attention

3. **Identifier le projet actif** et récupérer le bon `data_source_id` pour sa base Tasks :
   - Lis les fichiers mémoire dans `~/.claude/projects/*/memory/` pour trouver le projet correspondant au contexte de la conversation
   - Le `data_source_id` de la base Tasks est indiqué dans le fichier mémoire du projet (ex: `project_mealix.md`)
   - Si plusieurs projets existent et que ce n'est pas clair, demande à l'utilisateur lequel cibler

4. **Créer la tâche** dans la base Tasks du projet identifié via `notion-create-pages`

5. **Confirmer** à l'utilisateur avec un résumé compact :
   - Titre de la tâche
   - Priorité + Complexité
   - Un extrait des notes
