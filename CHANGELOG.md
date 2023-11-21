# Changelog

Toutes les modifications notables à ce projet seront documentées dans ce fichier.

## [Unreleased]

## [0.3.0] - 2023-11-20

### Added - Third Version

- Les ennemis sont maintenant créés une seule fois lorsque vous entrez dans l'état de jeu, ce qui empêche la création d'ennemis en quantité infinie.
- Les ennemis sont maintenant initialisés à une position fixe, puis déplacés à partir de cette position en utilisant le bruit de Perlin, ce qui empêche les ennemis de "sauter" de position à l'initialisation.

## [0.2.0] - 2023-11-19

### Added - Explosion Edition

- Les balles ennemies sont maintenant réinitialisées lors d'un game over.
- Les explosions sont maintenant affichées lorsqu'un vaisseau spatial entre en collision avec un ennemi ou une balle ennemie.
- Les explosions continuent maintenant à être affichées après un game over.

## [0.1.0] - 2023-11-18

### Added - First Version

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