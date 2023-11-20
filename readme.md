# Projet de jeu de tir spatial

Ce projet est un jeu de tir spatial simple écrit en JavaScript en utilisant la bibliothèque p5.js.

## Comment jouer

Déplacez votre vaisseau spatial avec la souris. Cliquez avec le bouton gauche de la souris pour tirer. Chaque ennemi que vous détruisez vous rapporte un point.

## Structure du code

Le code est divisé en plusieurs fichiers :

- sketch.js : C'est le fichier principal qui gère la logique du jeu.
- spaceship.js : Ce fichier contient la classe Spaceship qui gère le vaisseau spatial du joueur.
- enemy.js : Ce fichier contient la classe Enemy qui gère les ennemis.
- bullet.js : Ce fichier contient la classe Bullet qui gère les balles tirées par le vaisseau spatial et les ennemis.
- gameManager.js : Ce fichier contient la classe GameManager qui gère l'état du jeu, les collisions, le score, etc.

## Auteur

VERHILLE Arnaud GPL2

## Mises à jour

- Le vaisseau spatial est maintenant contrôlé par la souris.
- Les ennemis peuvent maintenant tirer des balles.
- Le score est maintenant affiché à l'écran.
- Un écran de fin de partie a été ajouté.
- Le jeu peut être réinitialisé en appuyant sur une touche après la fin de la partie.
- Les images des ennemis sont maintenant choisies aléatoirement à partir d'un ensemble d'images.
- Les balles ont maintenant une taille et une couleur définies.
- Les balles sont maintenant détruites lorsqu'elles sortent de l'écran ou lorsqu'elles entrent en collision avec un ennemi.
- Les ennemis sont maintenant détruits lorsqu'ils entrent en collision avec une balle ou le vaisseau spatial.
- Le jeu se termine maintenant lorsque le vaisseau spatial entre en collision avec un ennemi ou une balle ennemie.
- Le score le plus élevé est maintenant enregistré et affiché à l'écran.
- Les balles ennemies sont maintenant réinitialisées lors d'un game over.
- Les explosions sont maintenant affichées lorsqu'un vaisseau spatial entre en collision avec un ennemi ou une balle ennemie.
- Les explosions continuent maintenant à être affichées après un game over.