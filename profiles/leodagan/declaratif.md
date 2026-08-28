# Ce que dit la personne de sa pratique

> Réponses libres à un questionnaire interne. Non vérifiées.

**Comment utilises-tu l'IA au quotidien ?**

C'est devenu la façon par défaut de travailler. Je ne code presque plus à la main, sauf sur les parties où je sais que le contexte est trop implicite pour être transmis. Le travail s'est déplacé : je passe beaucoup plus de temps à cadrer et à relire qu'à écrire.

**Quel est ton niveau selon toi ?**

Je livre des grosses features de bout en bout sans reprendre la main en cours de route. En parallèle, non : un fil à la fois. L'équipe tourne à huit, et si je lance trois chantiers je ne relis plus rien correctement.

**Utilises-tu des fichiers de contexte, des règles, des instructions projet ?**

Oui, et c'est le gros du travail. Instructions à la racine, règles par domaine, et quelques procédures réutilisables pour les tâches qui reviennent, genre l'ajout d'un endpoint ou la migration d'un schéma. Je considère que c'est du code : ça se relit, ça se refactorise, ça se supprime quand ça ne sert plus.

**Comment tu t'y prends pour une feature un peu grosse ?**

Je pars d'une spécification écrite avec les cas limites et les critères d'acceptation. Je fais valider la compréhension avant que la moindre ligne soit écrite : je demande de reformuler ce qui va être fait, et je corrige à ce stade. C'est là que ça se joue. Ensuite le code arrive en une passe, les tests avec, et je relis en diff. Si je dois corriger plus de deux fois la même chose, je remonte le problème dans les règles plutôt que dans le code.

**Et les tests ?**

Écrits avant, systématiquement, et ils doivent échouer pour la bonne raison avant d'implémenter. Je vérifie ça explicitement.

**Un truc qui te frustre ?**

Que ça ne tienne pas encore tout seul sur plusieurs jours. Dès que le chantier dépasse une session, je dois reconstruire une partie du contexte. C'est la limite que je bute dessus en ce moment.
