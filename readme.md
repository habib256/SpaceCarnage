# 🚀 Space Carnage : L'Épopée Spatiale Ultime !

Bienvenue dans l'univers palpitant de Space Carnage, un jeu de tir spatial captivant créé avec passion en JavaScript et p5.js !

## 🎮 Embarquez pour l'aventure !

[Lancez-vous dans la bataille spatiale ici !](https://habib256.github.io/SpaceCarnage/)

### Votre mission, si vous l'acceptez :

1. 🕹️ Pilotez votre vaisseau avec la souris.  
2. 🔫 Tirez sur les ennemis d'un clic gauche.  
3. 💥 Exterminez les adversaires pour accumuler des points.  
4. 🛡️ Évitez les tirs ennemis et les collisions pour préserver votre vaisseau.  
5. 🏆 Visez le meilleur score !

### Rencontres galactiques :

- 👽 Ennemis standards : 5 points.
- 🦹 Boss coriaces : 20 points (attention, ils sont robustes !).
- 🎁 Power-ups mystérieux : bonus temporaires qui dynamisent le combat.

## ⚡ Règles et Fonctionnement des Power-ups

Dans Space Carnage, divers power-ups apparaissent pour renforcer votre vaisseau et influencer la dynamique du combat. Chaque bonus possède un effet unique et une durée d'activation spécifique.

### Types de Power-ups :

- **Bouclier (shield)**
  - **Effet** : Active un champ protecteur autour du vaisseau, bloquant les dégâts en cas de collision ou de tir ennemi.
  - **Durée** : 5 secondes en mode standard, 10 secondes lorsque le bonus provient d'un boss.
  - **Icône** : `PowerUp02.png` – un effet visuel pulsant pour renforcer l'immersion.

- **Vie Supplémentaire (extraLife)**
  - **Effet** : Ajoute une vie au vaisseau.
  - **Particularité** : Ce bonus reste unique et ne peut pas être doublé, même s'il provient d'un boss.
  - **Activation** : Immédiate.
  - **Icône** : `Powerup05.png`.

- **Multiplicateur de Points (pointsMultiplier)**
  - **Effet** : Multiplie les points gagnés par 2 en mode standard et par 4 si le bonus est obtenu via un boss.
  - **Durée** : 5 secondes (10 secondes pour un bonus de boss).
  - **Icône** : `PowerUp00.png`.

- **Double Tir (doubleShot)**
  - **Effet** : Permet de tirer deux projectiles simultanément, augmentant ainsi la cadence de tir.
  - **Durée** : 5 secondes normalement, 10 secondes en cas de bonus issu d'un boss.
  - **Icône** : `PowerUp03.png`.

- **Boost de Vitesse (speedBoost)**
  - **Effet** : Augmente temporairement la vitesse du vaisseau de 1.5 fois, facilitant esquives et manœuvres.
  - **Durée** : 6 secondes en mode normal, 12 secondes si obtenu via un boss.
  - **Icône** : `PowerUp04.png`.

### Mécanique de Drop :

- **Boss**  
  Chaque boss vaincu garantit le drop d'un power-up. Lorsqu'un boss est défait, une chance de 40 % permet d'obtenir **une vie supplémentaire** (extraLife) ; pour les 60 % restants, le bonus sera choisi aléatoirement parmi les autres types.

- **Ennemis Standards**  
  Un ennemi standard a 40 % de chance de laisser tomber un power-up. Dans ce cas, le bonus extraLife n'est pas disponible ; le type est alors sélectionné aléatoirement parmi shield, pointsMultiplier, doubleShot et speedBoost.

Ces power-ups sont essentiels pour survivre plus longtemps et optimiser votre score en vous offrant protection, puissance de feu ou rapidité accrue. Choisissez le bon moment pour les utiliser et adaptez votre stratégie aux situations de combat !

## 🧠 L'intelligence derrière le chaos spatial

Notre univers est orchestré par ces fichiers cosmiques :

- `sketch.js` : Le cerveau de l'opération.
- `spaceship.js` : Votre fidèle destrier des étoiles.
- `enemy.js` & `boss.js` : Les menaces extraterrestres.
- `bullet.js` : L'essence même du combat.
- `gameManager.js` : L'arbitre impartial de vos exploits.
- `powerUp.js` : La cerise sur le gâteau spatial.

# 🚀 Prêt à embarquer ?

Lancez le jeu et plongez dans une aventure intersidérale où chaque power-up peut faire pencher la balance entre la victoire et la défaite !

## 🌟 Le créateur de cet univers

VERHILLE Arnaud, explorateur des codes et rêveur intergalactique (GPL2)

Alors, prêt à devenir le héros dont la galaxie a besoin ? Que la force du code soit avec vous !