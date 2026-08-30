# Session

**Personne**

Ajoute la pagination sur l'endpoint `/invoices`. Curseur opaque, pas d'offset.

**Assistant**

Sur quel champ ordonner le curseur ? `created_at` n'est pas unique dans la table.

**Personne**

`created_at` c'est bien

**Assistant**

[implémente la pagination par curseur sur `created_at`]

**Personne**

ok

**Personne**

la pagination saute des lignes en prod

**Assistant**

C'est le cas que je signalais : deux factures créées à la même seconde partagent le même curseur, et la page suivante en écrase une. Il faut un curseur composite `(created_at, id)`.

**Personne**

ah oui. fais le

**Assistant**

[reprend l'implémentation avec un curseur composite]

**Personne**

il faut aussi que ça marche sur `/credit-notes` c'est le même besoin

**Assistant**

Les deux endpoints partagent-ils un module de pagination, ou faut-il dupliquer ?

**Personne**

duplique pour l'instant on factorisera plus tard

**Assistant**

[duplique la logique dans `credit_notes.go`]
