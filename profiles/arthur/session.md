# Session

**Personne**

Fil 3. Migration du connecteur Stripe vers l'API v2. Spec dans `docs/specs/stripe-v2.md`, procédure de migration dans `.claude/skills/migrate-external-api/SKILL.md`. Applique la procédure, ne dévie pas. Tu me pings quand la phase 2 est verte.

**Assistant**

Spec et procédure lues. Quatre phases, chacune livrable et réversible seule : client v2 à côté du v1 et inutilisé, lectures sur v2 pendant que les écritures restent en v1, écritures sur v2, retrait du v1.

Inventaire : 34 appels répartis sur 6 fichiers, dont 4 dans `billing/` et 2 dans un script de reprise annuelle qui n'est pas couvert par les tests.

Le script de reprise n'est pas dans le périmètre décrit par la spec. Je le migre aussi, je le laisse en v1, ou je m'arrête et tu tranches ?

**Personne**

Laisse en v1, ouvre un TODO avec la date de fin de support v1. Continue.

**Assistant**

[phases 1 et 2 exécutées]

Phase 2 posée : les lectures passent par le client v2, les écritures restent en v1. `pytest tests/payments -q` au vert, 61 tests. La métrique de désaccord tourne depuis ce matin — la phase n'est pas verte tant qu'elle n'est pas plate à zéro pendant une semaine, c'est ce que dit la spec.

Un point non prévu par la procédure : la v2 numérote les pages par curseur, la v1 par offset. Le job de relance nocturne pagine à la main sur l'offset, avec un `while` qui s'arrête quand la page revient vide. Sous curseur, la dernière page n'est jamais vide, elle est sans curseur suivant. Le job tournerait indéfiniment.

**Personne**

Bien vu. Ne touche pas au job de relance dans ce fil, il est en cours de refonte sur le fil 1 et on va se marcher dessus. Note-le dans la spec comme dépendance croisée entre les deux fils, et arrête-toi là. Je te reprends après le merge du fil 1.

**Assistant**

Noté dans `docs/specs/stripe-v2.md`, section dépendances. Fil en pause, branche poussée, PR ouverte en brouillon avec la phase 3 non démarrée.
