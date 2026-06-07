# Fayko — Cahier des charges réécrit

## 1. Vision produit

Fayko est le système de pilotage opérationnel de YaatalCo. Il s’inscrit dans une logique de clarification, de structuration et de pilotage, avec pour objectif de transformer chaque action en résultat mesurable, du sourcing prospect jusqu’à la livraison client.

Le produit est pensé comme un copilote quotidien admin-first. Il doit aider à capturer les idées, suivre les tâches, piloter les projets, gérer le pipeline commercial, cadrer les priorités hebdomadaires et prendre du recul en fin de semaine.

## 2. Objectifs stratégiques

L’objectif business principal reste celui défini dans le document d’origine : atteindre 5 000 € HT mensuels, avec 2 à 3 clients actifs simultanés, 2 appels découverte par semaine, et un taux de conversion appel → proposition de 40 %.

Le produit doit soutenir ces objectifs en apportant plus de clarté, de discipline et de fluidité dans le pilotage de l’activité.

## 3. Périmètre

### Inclus

- Usage admin personnel.
- Capture et qualification d’idées.
- Gestion de projets, étapes et tâches.
- Pipeline commercial.
- Gestion événementielle.
- Annuaire de contacts non commerciaux.
- Priorités hebdomadaires.
- Revue de fin de semaine.
- Devis libre côté admin.

### Hors périmètre actuel

- Espace client multi-utilisateurs.
- Refonte du contenu BtoC.
- Projet séparé YaatalCo Lab, qui pourra être connecté plus tard via API ou autre mécanisme.

## 4. Utilisateur cible

L’utilisateur principal est l’administratrice de Fayko. Elle a besoin d’un outil simple d’accès, rapide, mobile-friendly, capable de l’aider à gérer son activité sans dépendre d’un empilement d’outils dispersés.

Elle travaille avec beaucoup d’idées, plusieurs projets, du contenu, des événements, des prospects et des besoins de priorisation. Le système doit l’aider à avancer avec méthode sans rigidifier son fonctionnement.

## 5. Besoin utilisateur

L’utilisateur a besoin d’un outil centralisé qui lui permette de :

- capturer rapidement ses idées ;
- les challenger ;
- évaluer leur viabilité ;
- les relier à un projet existant ou à créer ;
- structurer ses projets en étapes et tâches ;
- suivre ses prospects et ses relances ;
- définir ses priorités de semaine ;
- faire une revue de fin de semaine ;
- avancer avec plus de recul et de sérénité.

## 6. Principes fonctionnels

### 6.1 Logique idée

Toute idée saisie doit pouvoir être conservée, challengée, évaluée et éventuellement transformée en action, tâche ou projet.

L’évaluation doit couvrir :

- la faisabilité financière ;
- la faisabilité humaine ;
- les ressources disponibles ;
- les parties prenantes ;
- le potentiel de retour sur investissement ;
- la pertinence stratégique.

Le système doit proposer automatiquement un rattachement à un projet existant si cela paraît pertinent.

### 6.2 Logique projet

Un projet est un cadre de pilotage composé de jalons, d’étapes et de tâches. Il doit permettre de découper l’avancement de manière simple et progressive.

Le fonctionnement peut s’inspirer d’une logique agile : point quotidien léger, priorités hebdomadaires, revue hebdo, ajustements réguliers.

### 6.3 Logique pipeline

Le pipeline commercial suit la séquence suivante :

**Source → Contacté → Appel découverte → Proposition → Client**

La source peut être LinkedIn, événement, réseau ou prospection directe.

L’étape “Contacté” doit conserver les moyens de contact utilisés et permettre d’enregistrer un message de relance ou un message type personnalisable.

### 6.4 Logique événement

Un contact issu d’un événement doit pouvoir être saisi rapidement avec :

- la source = Événement ;
- des notes ;
- des commentaires contextuels ;
- une carte de visite ;
- une photo si besoin.

## 7. Règles métier

### 7.1 Idées

Une idée peut être :

- conservée ;
- challengée ;
- évaluée ;
- liée à un projet existant ;
- transformée en tâche ;
- transformée en nouveau projet ;
- mise en attente.

### 7.2 Projet

Un projet doit contenir des étapes, des tâches et des jalons. Chaque tâche doit idéalement être reliée à un projet afin d’éviter les actions isolées sans contexte.

### 7.3 Priorités hebdomadaires

L’utilisateur doit pouvoir définir un petit nombre de priorités chaque semaine. Le système doit l’aider à éviter la dispersion et à rester focalisée sur ce qui compte vraiment.

### 7.4 Revue de fin de semaine

La revue hebdo doit permettre de :

- valider les priorités ;
- observer ce qui a été réalisé ;
- comprendre ce qui n’a pas avancé ;
- identifier ce qui fonctionne ;
- célébrer les réussites ;
- ajuster la semaine suivante.

### 7.5 Qualification des contacts événementiels

Lorsqu’un contact est créé depuis un événement, il doit pouvoir être qualifié immédiatement.

Statuts initiaux :

- Prospect.
- Prestataire.
- Partenaire.
- À qualifier.

Règles :

- si le contact est un prospect, il intègre le pipeline commercial ;
- si le contact est un prestataire, il va dans l’annuaire prestataires ;
- si le contact est un partenaire, il va dans l’annuaire réseau/partenaires ;
- si la qualification reste incertaine, il reste en zone intermédiaire.

## 8. Fonctionnalités prioritaires

| Fonctionnalité | Rôle | Priorité |
|---|---|---|
| Capture et challenge d’idées | Ne pas perdre les idées et les évaluer | Critique |
| Suggestion automatique idée → projet | Relier réflexion et exécution | Critique |
| Projets + étapes + tâches | Structurer le pilotage | Critique |
| Pipeline commercial | Suivre les opportunités | Critique |
| Qualification événementielle | Trier prospects, prestataires et partenaires | Critique |
| Priorités hebdomadaires | Cadrer la semaine | Important |
| Revue de fin de semaine | Prendre du recul et ajuster | Important |
| Next step automatique | Fluidifier l’exécution | Important |
| Annuaire prestataires / partenaires | Capitaliser le réseau | Important |
| Devis libre admin | Conserver le besoin de devis | Important |
| Agent coach / streak | Renforcer l’engagement | Bonus |
| YaatalCo Lab | Montée en compétences séparée | Projet à part |

## 9. Parcours clés

### 9.1 Parcours idée

1. L’utilisateur saisit une idée.
2. Le système challenge l’idée sur sa viabilité.
3. Le système propose un rattachement à un projet existant ou la création d’un nouveau projet.
4. L’idée devient action, tâche ou projet.

### 9.2 Parcours événement

1. L’utilisateur rencontre une personne lors d’un événement.
2. Elle saisit le contact avec la source “Événement”.
3. Elle ajoute des notes et une carte de visite.
4. Elle qualifie le contact : prospect, prestataire, partenaire ou à qualifier.
5. Le système oriente automatiquement le contact vers le pipeline ou l’annuaire.

### 9.3 Parcours hebdomadaire

1. L’utilisateur choisit ses priorités de semaine.
2. Le système relie les priorités aux projets et tâches.
3. La semaine avance avec une logique de pilotage légère.
4. En fin de semaine, une revue permet de valider, ajuster et célébrer.

## 10. Positionnement du brief quotidien

Le brief quotidien peut rester dans le système, mais il ne doit pas être la fonction centrale du produit. Son rôle est secondaire : rappeler les priorités du moment à partir d’un état réel à jour.

La valeur principale du produit se situe dans la capture d’idées, le pilotage des projets, le suivi du pipeline, la discipline hebdomadaire et la prise de recul.

## 11. Annuaire réseau

Fayko doit permettre de conserver des contacts utiles qui ne sont pas des prospects commerciaux : prestataires, partenaires, experts, ressources de confiance.

Cet annuaire doit être distinct du pipeline commercial, tout en partageant la même logique de capture et de qualification.

## 12. Philosophie produit

Fayko ne sert pas seulement à produire plus vite. Il sert à mieux décider, mieux prioriser et mieux piloter.

La promesse du produit est de permettre à l’utilisatrice de travailler avec plus de clarté, de méthode et de sérénité, tout en gardant une logique business et orientée chiffre d’affaires.

## 13. Roadmap de principe

### Phase 1 — Socle

- Capture d’idées.
- Projets.
- Étapes.
- Tâches.
- Pipeline commercial.
- Qualification événementielle.
- Priorités hebdo.
- Revue de fin de semaine.

### Phase 2 — Optimisation

- Suggestion automatique idée → projet.
- Next step automatique.
- Annuaire réseau.
- Devis admin.
- Dashboard de pilotage plus complet.

### Phase 3 — Extension

- Agent coach.
- Gamification.
- YaatalCo Lab via intégration externe.

## 14. Synthèse finale

Fayko est un copilote quotidien admin-first de pilotage, de capture d’idées et d’aide à la décision business. Il relie les idées, les projets, les tâches, le pipeline commercial, les priorités de la semaine et la prise de recul afin de transformer une activité fragmentée en système clair, structuré, mesurable et serein.
