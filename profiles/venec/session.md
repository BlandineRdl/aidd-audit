# Session

**Personne**

Chantier `billing`. Contexte : `AGENTS.md` à jour, la règle `no-float-money` s'applique. Objectif : migrer la table `subscriptions` vers le nouveau modèle de proration, sans downtime. Contrainte : la migration doit être réversible jusqu'au déploiement suivant.

Propose-moi le découpage avant d'écrire quoi que ce soit.

**Assistant**

[propose un découpage en quatre étapes : colonne ajoutée nullable, double écriture, backfill par lots, bascule de lecture]

**Personne**

L'étape 3 me gêne. Le backfill par lots sur cette table prend six heures en prod, et l'étape 4 ne peut pas partir avant la fin. Ça bloque la fenêtre de déploiement d'une journée entière.

Alternative : bascule de lecture par feature flag, avec repli sur l'ancienne colonne si la nouvelle est nulle. Le backfill devient asynchrone et non bloquant. Qu'est-ce que ça casse ?

**Assistant**

Cela rend la lecture dépendante de l'état du backfill, donc deux requêtes identiques peuvent rendre des résultats différents pendant la fenêtre. Acceptable si la proration n'est pas lue dans un calcul agrégé.

**Personne**

Elle l'est, dans le rapport mensuel. Mais le rapport tourne le 1er et le backfill sera fini avant. Je prends le risque, tracé dans la PR.

Écris les étapes 1 et 2. Tests d'abord.

**Assistant**

[écrit les tests puis l'implémentation des deux étapes]

**Personne**

Deux minutes, l'extraction du service de notifications vient de finir sur l'autre client, je vais relire le diff avant qu'il refroidisse.

**Personne**

Bon, c'est mergé. Où on en est ici ?

**Assistant**

Étapes 1 et 2 écrites, 14 tests au vert.

**Personne**

L'étape 2 écrit dans les deux colonnes mais ne vérifie pas qu'elles convergent. Ajoute une assertion en écriture, derrière le même flag, qui logue l'écart sans lever.

Après ça je bascule sur le troisième terminal, le `terraform plan` du chantier infra doit avoir fini de tourner.
