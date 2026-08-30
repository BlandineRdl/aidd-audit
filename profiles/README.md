# 👥 Les profils

Des profils de développeur fictifs

Leur niveau est donné par rapport à la grille.

**C'est une base de travail pour éprouver ton outil.**

---

## Qui ils sont

Un dossier reçoit un niveau seulement lorsque ses preuves couvrent les quatre axes. Lorsqu'une
distribution est disponible, le niveau qu'il a démontré assez souvent pour que ça compte est aussi
épinglé par `tests/cli/reference-profiles.test.ts`.

| Dossier | Tenu | Démontré | Ce qui rend le dossier particulier |
| :--- | :--- | :--- | :--- |
| `perceval` | 🔺 **Red** | 🔺 Red | Se décrit « plutôt avancé ». Ses chiffres disent autre chose |
| `bohort` | 🔹 **Blue** | 🔹 Blue | Le dossier le plus complet |
| `leodagan` | 🟢 **Green** | 🥉 **Copper** | Pas de session de travail. Le seul dont les deux lectures diffèrent |
| `arthur` | 🥉 **Copper** | 🥉 Copper | Ne dit rien de lui-même. Tout est dans ce qu'il a mis en place |
| `lancelot` | 🔺 **Red** | — | Un dossier très fourni, mais des reprises humaines après coup sur la majorité des changements |
| `venec` | — | — | Une seule session : le harness de prompts est visible, mais les trois autres axes restent inconnus |

**L'écart de `leodagan` n'est pas une coquille, c'est son second rôle.** Ses journées enregistrées
portent trois chantiers assez souvent pour atteindre Copper sur l'axe que sa médiane laisse à un.
C'est la seule fixture qui exerce la lecture « démontré » depuis un bundle jusqu'au contrat publié ;
sans elle ce chemin partirait sans preuve.

**L'absence de niveau de `venec` n'est pas White.** Une preuve absente n'est pas une pratique
absente : sans taille livrée, intervention ni parallélisme observés, aucun niveau ne peut être
attribué. `lancelot`, à l'inverse, atteint Red sur les quatre axes ; ses nombreux fichiers ne
compensent ni les corrections tardives ni son parallélisme médian d'un chantier.

---

## Ce que chacun contient

| Pièce | `perceval` | `bohort` | `leodagan` | `arthur` |
| :--- | :-: | :-: | :-: | :-: |
| `profile.json` — qui c'est, sa stack | ✅ | ✅ | ✅ | ✅ |
| `git-activity.json` — ce qu'il livre, à quel rythme | ✅ | ✅ | ✅ | ✅ |
| `pull-requests.json` — sa dernière page de PR, telle que GitHub la rend | — | ✅ | ✅ | — |
| `code/` — des fichiers de son dépôt | ✅ | ✅ | ✅ | ✅ |
| `sonar-measures.json` — l'analyse statique de son dépôt | ✅ | ✅ | ✅ | ✅ |
| `repo-context/` — ce qu'il a mis en place autour de l'IA | — | ✅ | ✅ | ✅ |
| `declaratif.md` — ce qu'il dit de sa pratique | ✅ | ✅ | ✅ | — |
| `session.md` — une session de travail, du prompt au commit | — | ✅ | — | ✅ |

Les autres profils n'auront pas les mêmes trous.

Les outils non plus. Chacun travaille avec le sien, et son dépôt en porte la
trace là où l'outil la range — pas au même endroit d'un profil à l'autre. Ce qui
compte, c'est ce qui est en place, jamais la marque.

---

## 🎣 Les pièges

**Croire le déclaratif.** C'est ce que la personne pense d'elle-même. Les faits disent parfois le contraire.

**S'arrêter aux métriques.** Une couverture de tests élevée ne dit pas grand-chose toute seule.

**Confondre richesse et niveau.** Le dossier le plus fourni n'est pas le mieux classé.
