# Session

**Personne**

On ajoute la relance de facture impayée. Contexte : `api/billing/`, conventions dans AGENTS.md. Trois règles métier :
1. relance à J+7, J+15, J+30 après échéance
2. on ne relance jamais un client dont le compte est suspendu
3. une relance manuelle par un admin remet le compteur à zéro

Commence par les tests, dans le style de `invoice-dunning.spec.ts` s'il existe déjà quelque chose de proche. Ne touche pas au module de paiement.

**Assistant**

Il n'existe pas de `invoice-dunning.spec.ts`. Le fichier le plus proche est `invoice-reminder.spec.ts`, qui teste un mécanisme de rappel avant échéance. Je m'aligne sur son style.

Question avant d'écrire : la règle 3 remet à zéro le compteur, mais est-ce que la relance manuelle compte elle-même comme une relance dans la séquence, ou est-ce qu'elle est hors séquence ?

**Personne**

Bonne question. Hors séquence. Elle remet à zéro et ne compte pas.

**Assistant**

Compris. J'écris les tests couvrant : les trois échéances, le client suspendu à chaque échéance, la remise à zéro par action admin, et le cas limite d'une suspension survenant entre deux relances.

[9 tests écrits, tous en échec]

**Personne**

Le cas de la suspension entre deux relances, tu l'as traité comment ? Montre-moi juste ce test.

**Assistant**

[extrait du test]

**Personne**

Non. Si le compte est suspendu puis réactivé, on ne rattrape pas les relances manquées, on reprend à la prochaine échéance. Corrige ce test, puis passe à l'implémentation.

**Assistant**

Corrigé. J'implémente.

[implémentation, 8 tests sur 9 passent]

**Assistant**

Le test de remise à zéro échoue. La cause : `DunningService` lit la date de dernière relance depuis `invoice.lastReminderAt`, qui est aussi écrit par le rappel avant échéance. Les deux mécanismes partagent le champ. Deux options : ajouter un champ dédié, ou distinguer par type dans une table d'historique.

**Personne**

Champ dédié, on ne va pas ouvrir une table pour ça. Mais préviens-moi si tu vois d'autres endroits qui lisent `lastReminderAt`.

**Assistant**

Trois autres endroits le lisent, dont un export comptable. Le champ dédié ne les casse pas, mais l'export ne verra jamais les relances d'impayé. À confirmer avec le métier.

**Personne**

Noté, je pose la question. Continue avec le champ dédié et laisse un TODO sur l'export.
