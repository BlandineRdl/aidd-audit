# Méthode de mesure

`aidd-audit` répond à une question volontairement étroite : **quel est le plus haut niveau de
maturité AIDD qu’un dépôt permet de prouver ?** Il ne note ni la qualité du code, ni la séniorité,
ni le volume d’utilisation de l’IA : la qualité est un prérequis, pas un axe.

## Le moteur, en quatre étapes

1. **Collecter des traces observables.** Dans l’arbre versionné, l’outil cherche le harness
   (prompts, contexte, règles, agents, hooks, boucles de validation) et lit l’historique Git. Dans
   un dépôt GitHub accessible avec `gh`, il lit aussi les pull requests fusionnées : taille,
   corrections après ouverture et branches actives, informations qu’un squash peut effacer de Git.

2. **Conserver la force de la preuve.** Une observation n’est `CONFIRMED` que lorsqu’elle est
   étayée par une trace observable ; une déclaration seule reste `CLAIMED`. Une source absente ou
   insuffisante reste `UNKNOWN`, et une contradiction reste `CONFLICTING` : jamais un mauvais
   résultat inventé.

3. **Comparer au modèle.** Le moteur charge [`aidd.yml`](aidd.yml), la seule forme exécutable du
   modèle, et compare chaque valeur à ses seuils. Un niveau n’est validé que si **tous** ses axes le
   sont ; les exigences des niveaux White à Gold sont cumulatives et exprimées comme des seuils
   minimaux. [`levels/aidd.md`](levels/aidd.md) est la grille humaine du hackathon, pas une règle
   exécutée.

4. **Rendre un verdict explicable.** Le rapport publie le plus haut niveau prouvé, les preuves et
   le niveau suivant. Il distingue un *écart de pratique* d’un *écart de preuve* : l’absence de
   donnée ne devient jamais une absence de maturité.

## Ce qui est mesuré — et pourquoi

| Axe | Mesure | Pourquoi |
| --- | --- | --- |
| Taille | Taille habituelle des changements livrés avec l’IA. | Périmètre réellement confié au modèle, plutôt qu’une exception. |
| Harness | Prompts, contexte projet, règles/garde-fous et boucles de validation. | Comportement de l’IA reproductible et vérifiable. |
| Intervention | Moment et fréquence des reprises en main humaines. | Autonomie observée, sans renoncer au contrôle qualité. |
| En parallèle | Médiane de chantiers actifs par jour. | Capacité à faire avancer plusieurs flux, pas un pic ponctuel. |

## Limites assumées

La mesure dépend des traces disponibles. Sans accès GitHub via `gh`, les mesures dépendant des pull
requests peuvent rester inconnues au lieu d’être estimées. Gold exige une preuve sur le cadrage de
la tâche que les collecteurs actuels ne savent pas encore établir. À modèle, dossier et état de
forge identiques, le rapport est identique.

## Piste V2 — de la mesure à la progression

> Ces pistes ne sont pas encore implémentées. Elles ne modifieront pas le niveau AIDD officiel :
> celui-ci restera uniquement une mesure de pratiques prouvées.

**AIDD Review** réunira `assess` et `harness` dans une revue orientée progression : niveau prouvé,
prochain niveau, bloqueur prioritaire, forces du harness et recommandations ordonnées. Une skill
pourra orchestrer les deux analyses sans fusionner leurs scores.

### Exemple de revue

```text
AIDD Review

Maturity
🟢 Green — CONFIRMED

Next level
🥉 Copper

Primary maturity blocker
Parallelism: 1 / required 3

Harness
Strong context engineering
Strong behavioural guardrails
Validation loops need improvement

Recommended progression
1. Add deterministic validation loops
2. Introduce isolated parallel workstreams
3. Start with 2 concurrent agents
4. Re-assess after several completed tasks
```

**Knowledge Assessment** sera un QCM AIDD de 20 questions chronométrées, fondé sur des scénarios.
Son résultat restera indépendant de la pratique : *maturity ≠ knowledge*. Une personne peut avoir
une pratique Copper et 45 % de théorie, ou une pratique Red et 95 % de théorie. Cette lecture donne
une matrice utile :

|  | Théorie faible | Théorie forte |
| --- | --- | --- |
| Pratique faible | Beginner | Ready to apply |
| Pratique forte | Practitioner | Mastery |

### Exemples de résultats indépendants

```text
AIDD maturity: 🥉 Copper
Theory: 45%

→ Les pratiques sont démontrées, mais la théorie reste à consolider.
```

```text
AIDD maturity: 🔺 Red
Theory: 95%

→ La théorie est maîtrisée, mais elle n’est pas encore matérialisée dans le workflow.
```

**Next Challenge** proposera une mission concrète qui cible le bloqueur du niveau suivant, avec sa
configuration suggérée, les preuves attendues et la commande pour réévaluer. Par exemple, le
*Copper Challenge* demandera de terminer trois chantiers indépendants en parallèle, dans des
worktrees isolés, avec critères d’acceptation et validation automatisée.

### Exemple de challenge

```text
🥉 Copper Challenge

Goal
Complete 3 independent workstreams concurrently.

Suggested setup
- 3 isolated worktrees
- explicit acceptance criteria
- automated validation
- no shared mutable workspace

Success evidence
AIDD will look for:
✓ concurrent work
✓ completed changes
✓ limited corrective intervention

Run afterward:
aidd assess .
```

**Progress History** enregistrera, localement et sur consentement, des snapshots successifs et un
diff : ce qui s’est amélioré, ce qui manque encore. Il ne s’agira ni d’un SaaS ni de télémétrie.

### Exemple d’historique local

```text
Aug 31   🔹 Blue
Sep 08   🔹 Blue   Harness improved
Sep 21   🟢 Green
Oct 12   🥉 Copper

What changed since last assessment?

+ behavior harness confirmed
+ intervention improved
+ validation loop detected
- parallelism still below Copper
```

Enfin, **Explain / What-if** rendra la provenance actionnable : `aidd explain harness`,
`aidd explain --level silver` et `aidd next` expliqueront une exigence `MET`, `NOT_MET` ou
`UNPROVEN`, puis indiqueront le plus court chemin *projeté* vers le niveau suivant. Une projection
ne sera jamais un verdict : seul `aidd assess` pourra confirmer un niveau.

### Exemples d’explication et de projection

```text
Why am I not Silver?

Harness
MET
Evidence:
  .claude/rules/*
  AGENTS.md
  validation loop

Size
MET

Parallelism
MET

Intervention
UNPROVEN

Why?
The available repository evidence does not establish
that tasks complete without human intervention.

This does NOT mean the requirement is NOT_MET.

How to resolve:
...
```

```text
Current: Green

Shortest evidence-backed path to Copper:

Parallelism
1 → 3

Everything else already satisfies Copper.

If parallelism ≥ 3 were CONFIRMED:
Projected level → Copper
```

À terme, le profil pourra donc distinguer trois diagnostics complémentaires : **Practice** (niveau
prouvé), **Harness** (qualité de l’environnement) et **Knowledge** (théorie). Un score chiffré de
harness ne sera ajouté que si sa sémantique est suffisamment défendable ; aucune de ces dimensions
ne contaminera le niveau AIDD.

L’exemple ci-dessous est une cible de présentation, non un score déjà calculé : en particulier,
`82/100` et la couverture de preuve exigent une définition et une méthode de calcul avant d’exister.

### Exemple de profil AIDD

```text
AIDD PROFILE
────────────────────────

Practice
🥉 Copper
Evidence coverage: 91%

Harness
82/100
Strong

Knowledge
17/20
Advanced

────────────────────────
Next objective
🥈 Silver

Primary blocker
Autonomous validation loops
```
