# aidd-audit

Évaluation de maturité AIDD fondée sur des preuves. On lui donne le dossier d'un développeur, il
rend le plus haut niveau que ce dossier peut **prouver**, les preuves derrière le verdict, et ce qui
bloque le niveau suivant.

Déterministe, entièrement hors ligne, aucun modèle de langage dans la décision. Le même dossier et
le même modèle produisent toujours les mêmes octets sur la sortie standard.

> **Le principe qui gouverne tout :** ne demande pas ce que tu peux observer, et ne prétends pas
> savoir ce que tu ne peux pas prouver.

## Prérequis

| | |
| --- | --- |
| Node.js | >= 24 |
| pnpm | 11 (épinglé par `packageManager`) |
| Réseau | nécessaire à l'installation, jamais à l'exécution |

## Installation

```bash
pnpm install
pnpm build      # produit dist/cli.js
```

## Utilisation

```bash
node dist/cli.js assess profiles/bohort
```

| Option | Effet |
| --- | --- |
| `--json` | publie le contrat de rapport versionné au lieu de l'explication en prose |
| `--model <chemin>` | évalue contre un modèle de maturité personnalisé au lieu de l'`aidd.yml` fourni |

Les quatre profils de référence sont livrés avec le dépôt :

```bash
node dist/cli.js assess profiles/perceval    # Red
node dist/cli.js assess profiles/bohort      # Blue
node dist/cli.js assess profiles/leodagan    # Green
node dist/cli.js assess profiles/arthur      # Copper
```

## Lire la sortie

`perceval` se décrit comme « plutôt avancé ». L'outil lit ce qu'il a fait, pas ce qu'il en dit.

```
AIDD maturity assessment for profiles/perceval
Model: aidd (schema v1)

Proven level: Red (rank 1)
  Taille: MET
    required: S · observed: S (CONFIRMED)
  Harness: MET
    required: prompts · observed: prompts (CONFIRMED)
  ...

Next level: Blue (rank 2)
  Harness: NOT_MET (practice gap)
    required: prompts, context-engineering · observed: prompts (CONFIRMED)
  ...

Blocking requirements:
  [practice gap] Harness at Blue: observed prompts does not reach the required prompts, context-engineering.
```

Trois choses figurent sur chaque ligne, et aucune n'est une opinion :

* **`required`** : ce que le modèle exige à ce niveau, tel quel depuis `aidd.yml`.
* **`observed`** : ce qui a réellement été lu dans le dossier.
* **le statut de preuve** : `CONFIRMED` signifie observé, pas déclaré. Ce qu'un développeur dit de
  lui-même n'atteint jamais cette colonne.

### Un écart de pratique n'est pas un écart de preuve

Cette distinction est tout le produit, et la sortie la garde visible.

| | Signification | Ce qui peut être recommandé |
| --- | --- | --- |
| `NOT_MET`, écart de pratique | la pratique a été observée et n'atteint pas le seuil | améliorer la pratique |
| `UNPROVEN`, écart de preuve | rien n'a pu être observé, ni dans un sens ni dans l'autre | fournir la preuve manquante, rien d'autre |

Un niveau se gagne par la preuve, il ne se déduit jamais d'une information absente. Évaluer ce
dépôt lui-même donne le second cas :

```
Proven level: could not be established. No level's requirements were fully proven.

Evidence coverage: 2 of 4 axes confirmed (2 observed).

  Intervention: UNPROVEN (evidence gap)
    no observation was made (UNKNOWN) — the requirement was never tested

Blocking requirements:
  [evidence gap] Intervention at White: asked live-repository, fixture-bundle, and no value was observed.
```

`could not be established` ne veut **pas** dire « sous le niveau le plus bas ». Cela veut dire que
la preuve manquait pour trancher, et que l'outil le dit au lieu de deviner. La section **Limites**
explique pourquoi un dépôt Git vivant tombe ici.

## Ce qui est mesuré

Sept niveaux cumulatifs, White, Red, Blue, Green, Copper, Silver, Gold, sur quatre axes :

| Axe | Question |
| --- | --- |
| Taille | quelle taille de changement est déléguée à l'IA |
| Harness | ce qui est installé autour de l'IA : `prompts`, `context-engineering`, `behavior`, `loops` |
| Intervention | à quel point le développeur reprend la main tôt et souvent |
| En parallèle | combien de flux de travail avancent en même temps |

Un niveau est satisfait quand **tous** ses axes atteignent leur seuil. Les seuils sont des minimums
et ils cumulent : un niveau supérieur n'exige jamais moins que celui du dessous, sur aucun axe.
C'est vérifié au chargement du modèle, pas supposé.

* `aidd.yml` est la seule forme du modèle que le programme lit. `--model` la remplace.
* `levels/aidd.md` documente la même grille pour un lecteur humain, et n'est jamais chargé.

## Limites, annoncées d'emblée

* **Un dépôt Git vivant ne peut pas être classé.** L'axe `Intervention` compte le travail correctif
  qui arrive *après* l'ouverture d'un changement à la revue. Ouvrir un changement est une notion de
  forge, et aucun historique Git local ne la porte, les commits de merge compris. Un seul axe
  inobservable suffit à laisser tous les niveaux non prouvés : `assess <un dépôt>` ne rend donc
  aucun niveau. C'est la règle conservatrice qui fait son travail, pas un défaut. Un collecteur de
  forge lèvera ce plafond, derrière la même interface.
* **Ce sont les dossiers de profil enregistrés qui sont classés**, parce qu'eux portent cette trace.
* **Ce qu'un développeur déclare n'est recevable pour rien.** `declaratif.md` et ce que le manifeste
  affirme de lui-même sont lus comme des déclarations, et une déclaration n'atteint jamais
  `CONFIRMED`.

## Codes de sortie

Le code de sortie répond à *l'évaluation a-t-elle tourné*, jamais à *quelle est la maturité de ce
développeur*.

| Code | Signification |
| --- | --- |
| `0` | un rapport a été publié, y compris « aucun niveau n'a pu être établi » |
| `2` | la faute de l'appelant : invocation malformée, chemin qui ne désigne rien, modèle illisible |
| `1` | la nôtre : l'outil a cassé |

La sortie standard porte le rapport et rien d'autre. Tout le reste part sur la sortie d'erreur, en
prose, y compris sous `--json`.

## Développement

```bash
pnpm check      # typage, tests, frontières d'architecture, règle de commentaires — au premier échec, stop
pnpm format     # Biome
pnpm mutation   # sweep de mutation sur la logique de décision — des minutes, pas des secondes
```

`pnpm architecture` lance les règles de frontières dependency-cruiser **puis prouve que chaque règle
mord encore**, en écrivant une violation délibérée par règle et en échouant si l'une d'elles passe
inaperçue. Sans cela, une règle qui ne correspond à rien rend un succès, indiscernable d'un mur qui
tient.

`pnpm mutation` reste **hors de `pnpm check`**, délibérément : treize minutes, c'est un rapport à
lire, pas une porte à passer. Il répond à la question qu'une suite verte ne pose jamais — est-ce que
ces tests tomberaient si le code changeait de sens ? Ici la réponse a déplacé le travail : le
chargement du modèle tenait, et 83 % des mutants survivants étaient dans le lexer shell, sous 1588
lignes de suite qui ne l'atteignaient presque jamais.

L'architecture, la stratégie de test et les décisions derrière les deux sont documentées dans
[`aidd_docs/memory/`](aidd_docs/memory/).

## Licence

MIT. Voir [LICENSE](LICENSE).
