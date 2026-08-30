# aidd-audit

Évaluation de maturité AIDD fondée sur des preuves. On lui donne le dossier d'un développeur, il
rend le plus haut niveau que ce dossier peut **prouver**, les preuves derrière le verdict, et ce qui
bloque le niveau suivant.

Déterministe, sans modèle de langage dans la décision. Les collecteurs locaux fonctionnent hors
ligne ; un dépôt GitHub peut aussi interroger la forge pour les axes que Git seul ne peut pas voir.
Le même dossier, le même modèle et le même état de forge produisent toujours le même rapport ;
sur un pipe, une redirection ou une capture, ses octets sont identiques. Un terminal peut ajouter
de la couleur, sans changer son contenu.

> **Le principe qui gouverne tout :** ne demande pas ce que tu peux observer, et ne prétends pas
> savoir ce que tu ne peux pas prouver.

## Prérequis

| | |
| --- | --- |
| Node.js | >= 24 |
| pnpm | 11 (épinglé par `packageManager`) |
| Réseau | nécessaire à l'installation ; optionnel à l'exécution, mais requis par le collecteur de forge |

## Installation

```bash
pnpm install
pnpm build      # produit dist/cli.js
```

## Utilisation

```bash
node dist/cli.js assess profiles/bohort
```

Le CLI attend toujours le dossier à évaluer. Pour évaluer le projet courant :

```bash
node dist/cli.js assess .
```

| Option | Effet |
| --- | --- |
| `--json` | publie le contrat de rapport versionné au lieu de l'explication en prose |
| `--model <chemin>` | évalue contre un modèle de maturité personnalisé au lieu de l'`aidd.yml` fourni |

## Audit du harness Claude

`harness` audite le contexte Claude chargé autour d'un projet ; il ne modifie jamais le niveau de
maturité rendu par `assess`.

```bash
node dist/cli.js harness .
node dist/cli.js harness . --details
node dist/cli.js harness . --json
```

Le rapport sépare les fichiers toujours chargés des fichiers conditionnels, distingue le projet de
la configuration personnelle de la machine, et estime leurs tokens. Sa section **Findings** compare
chaque mesure à une guideline nommée, puis propose une action précise. Lorsqu'une réduction est
possible, `potentialTokensRemoved` est une borne haute de tokens potentiellement retirés par cette
action — ce n'est pas une économie mesurée.

Un import ou une déclaration illisible est publié comme `unread`, jamais silencieusement interprété
comme une absence. L'audit couvre actuellement la configuration Claude et reste intentionnellement
séparé du contrat de maturité `assess`.

La sortie par défaut commence par les totaux et les actions. `--details` ajoute l'inventaire de
chaque fichier, sa forme prose/liste et les passages répétés ; `--json` publie toujours l'inventaire
complet pour les outils.

## Plugin Claude Code

Le plugin audite toujours le projet ouvert dans Claude Code : l'utilisateur ne fournit aucun
chemin. La skill lance son binaire embarqué comme ceci :

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/cli.js" assess . --json
```

Elle lit exclusivement le contrat JSON puis le raconte en français ; elle ne calcule ni ne
modifie jamais le verdict. Le bundle du plugin est construit séparément afin de garder le build
local léger :

```bash
pnpm build:standalone
```

Cette commande produit `plugins/aidd-evaluation/bin/cli.js` et place `aidd.yml` à côté. Les deux
fichiers font partie du plugin et doivent être publiés ensemble.

Ce dépôt est aussi son propre marketplace. Une fois les fichiers poussés sur GitHub, et le dépôt
rendu public ou accessible aux participants, ils installent le plugin sans cloner ni construire le
dépôt :

```text
/plugin marketplace add BlandineRdl/aidd-audit
/plugin install aidd-evaluation@aidd-evaluation
```

Ils lancent ensuite l'une des deux skills dans Claude Code ; elles travaillent toujours sur le
projet ouvert :

```text
/aidd-evaluation:aidd-evaluation  # évalue la maturité AIDD
/aidd-evaluation:aidd-harness     # audite le coût et la forme du contexte Claude
```

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
Maturité AIDD · profiles/perceval
Modèle aidd (schéma v1) · collecteurs : live-repository, fixture-bundle

Niveau prouvé : Red (rang 1)
  ✓ Taille
      requis atteint : changement petit ou trivial (S) (CONFIRMED)
  ✓ Harness
      requis atteint : usage de l'IA piloté par prompt (CONFIRMED)
  ✓ Intervention
      requis atteint : après coup, sur la majorité des livraisons (after-the-fact-most) (CONFIRMED)
  ✓ En parallèle
      requis atteint : 1 médiane de chantiers actifs par jour (minimum 1) (CONFIRMED)

Pour atteindre Blue (rang 2) :
  ✗ Taille
      [écart de pratique] aujourd’hui : changement petit ou trivial (S) (CONFIRMED)
          pour Blue : changement de complexité moyenne (M).
  ✗ Harness
      [écart de pratique] manque : mémoire, architecture et conventions du projet (context-engineering) (CONFIRMED)
  ✗ Intervention
      [écart de pratique] aujourd’hui : après coup, sur la majorité des livraisons (after-the-fact-most) (CONFIRMED)
          pour Blue : après coup, sur une partie des livraisons (after-the-fact-some).
  Déjà au niveau requis pour Blue : En parallèle.
```

La prose résume les exigences déjà satisfaites une seule fois. Pour un écart, elle expose ce qui
manque ; les identifiants techniques restent entre parenthèses et le JSON conserve les valeurs
brutes.

* **`requis atteint`** : ce que le modèle exige et que le dossier a démontré.
* **`manque`** ou **`requis` / `observé`** : l'écart de pratique concret à combler.
* **le statut de preuve** : `CONFIRMED` signifie observé, pas déclaré. Ce qu'un développeur dit de
  lui-même n'atteint jamais cette colonne.

### Un écart de pratique n'est pas un écart de preuve

Cette distinction est tout le produit, et la sortie la garde visible.

| | Signification | Ce qui peut être recommandé |
| --- | --- | --- |
| `✗`, écart de pratique | la pratique a été observée et n'atteint pas le seuil | améliorer la pratique |
| `?`, écart de preuve | rien n'a pu être observé, ni dans un sens ni dans l'autre | fournir la preuve manquante, rien d'autre |

Un niveau se gagne par la preuve, il ne se déduit jamais d'une information absente. Quand un axe
ne peut pas être observé, la sortie garde explicitement cet écart de preuve :

```
Niveau prouvé : aucun. Aucun niveau n'a pu être entièrement prouvé.

Pour atteindre White (rang 0) :
  ? <axe>
      [écart de preuve] échantillon insuffisant : 3 jours actifs de PR observés, minimum 5 requis
```

« Aucun niveau n'a pu être entièrement prouvé » ne veut **pas** dire « sous le niveau le plus
bas ». Cela veut dire que la preuve manquait pour trancher, et que l'outil le dit au lieu de
deviner. La section **Limites** explique quelles sources peuvent manquer.

Quand le rapport publie un diagnostic structuré, comme un échantillon de PR trop court, il explique
la mesure manquante. Sans diagnostic, il conserve l'explication générale : le collecteur interrogé
n'a produit aucune valeur. Ces deux cas restent des écarts de preuve, jamais des écarts de pratique.

## Ce qui est mesuré

Sept niveaux cumulatifs, White, Red, Blue, Green, Copper, Silver, Gold, sur quatre axes :

| Axe | Question |
| --- | --- |
| Taille | quelle taille de changement est déléguée à l'IA |
| Harness | ce qui est installé autour de l'IA : `prompts`, contexte du projet, règles et garde-fous (`behavior`), boucles de validation (`loops`) |
| Intervention | à quel point le développeur reprend la main tôt et souvent |
| En parallèle | combien de flux de travail avancent en même temps |

Un niveau est satisfait quand **tous** ses axes atteignent leur seuil. Les seuils sont des minimums
et ils cumulent : un niveau supérieur n'exige jamais moins que celui du dessous, sur aucun axe.
C'est vérifié au chargement du modèle, pas supposé.

* `aidd.yml` est la seule forme du modèle que le programme lit. `--model` la remplace.
* `levels/aidd.md` documente la même grille pour un lecteur humain, et n'est jamais chargé.
* Chaque valeur ordinale ou membre d'ensemble porte aussi sa description dans `aidd.yml`. Le
  rapport JSON publie cette vocabulaire par axe et la prose conserve le token brut en l'expliquant,
  par exemple `key-steps (intervention humaine aux étapes clés)` ou
  `behavior : règles, agents, hooks et garde-fous`. Un modèle passé avec `--model` apporte ses
  propres descriptions ; le renderer n'en invente aucune.

## Limites, annoncées d'emblée

* **Un dépôt Git vivant n'est classable que sur ce que ses sources rendent observable.** Avec une
  origine GitHub, le collecteur de forge lit les pull requests pour `Taille`, `Intervention` et
  `En parallèle`. Sans accès à la forge, ces axes restent `UNKNOWN` au lieu d'être devinés ; le
  rapport sort tout de même avec le code `0`, mais peut ne prouver aucun niveau. Git local seul ne
  porte pas toutes les informations temporelles de revue.
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
