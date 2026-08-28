# Ce que dit la personne de sa pratique

> Réponses libres à un questionnaire interne. Non vérifiées.

**Comment utilises-tu l'IA au quotidien ?**

J'ai un assistant intégré à l'éditeur, et un fichier d'instructions à la racine du projet que je maintiens. Je commence rarement une feature sans lui avoir donné le contexte : les conventions, les fichiers concernés, ce qu'il ne doit pas toucher. Ça a changé beaucoup de choses par rapport à l'époque où je copiais-collais dans un chat.

**Quel est ton niveau selon toi ?**

Difficile à dire. Je sais que je fais mieux qu'il y a six mois, mais je vois aussi tout ce que je ne fais pas encore. Je dirais milieu de tableau.

**Utilises-tu des fichiers de contexte, des règles, des instructions projet ?**

Oui, un `AGENTS.md` à la racine et quelques règles dans un dossier dédié. Je les mets à jour quand je vois l'assistant se tromper deux fois sur la même chose. C'est devenu un réflexe : si je corrige la même erreur deux fois, c'est que le contexte est incomplet, pas que le modèle est bête.

**Comment tu t'y prends pour une feature un peu grosse ?**

J'écris d'abord ce que je veux, en clair, avec les cas limites. Ensuite je laisse générer une première passe complète. Puis je relis en entier et je reprends la main sur ce qui touche au métier, parce que c'est là qu'il se plante le plus. Les parties techniques standard, je les garde presque telles quelles.

**Et les tests ?**

Systématiques sur ce qui compte. Je fais générer les tests en même temps que le code, et je vérifie qu'ils échouent bien avant de les valider. Un test généré qui passe du premier coup, je m'en méfie.

**Un truc qui te frustre ?**

Le moment où je dois choisir entre corriger ce qu'il a fait et tout refaire moi-même. Je coupe trop tard, en général.
