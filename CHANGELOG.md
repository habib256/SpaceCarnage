# Changelog

Toutes les modifications notables à ce projet seront documentées dans ce fichier.

## [0.5.0] - 2025-06-07 - Asteroid Bonus Edition

 - Ajout d'un **mode bonus** accessible à tout moment en appuyant sur la touche **B**.
- Dans ce mode, le vaisseau doit survivre à un champ d'astéroïdes en scrolling.
- Mise à jour du titre pour informer de cette nouvelle fonctionnalité.
=======
## [0.4.5] - 2025-04-30 - Triple Shot Edition

- Ajout du power-up **Triple Tir** offrant trois projectiles simultanés.
- Mise à jour de la génération et de la collecte des power-ups pour prendre en charge ce nouveau bonus.

## [0.4.4] - 2025-03-30 - Power-Up Graphics Edition

- Mise à jour complète des graphismes des power-ups (PowerUp00 à PowerUp05)
- Optimisation de l'affichage des power-ups avec de meilleures images
- Amélioration de la cohérence visuelle des power-ups dans le jeu

## [0.4.3] - 2025-02-05 - Power-Up Extended Edition

- Correction du comportement de rebond des balles sur le bouclier grâce à l'utilisation du calcul du vecteur normal, assurant ainsi un rebond réaliste quels que soient l'angle et la position d'impact.
- La zone de détection du bouclier a été ajustée pour correspondre exactement à son affichage (un cercle) au lieu de la zone de détection classique du vaisseau.
- Les effets des power-ups issus des boss sont désormais multipliés par 2 (durée du bouclier, points de vie supplémentaires, multiplicateur de points, double tir et boost de vitesse).
- Optimisation globale de la gestion des timers et des collisions pour offrir une expérience de gameplay plus fluide.

## [0.4.2] - 2023-11-23 - Power-Up Edition

- Ajout de power-ups avec différents effets (bouclier, vie supplémentaire, multiplicateur de points, double tir, boost de vitesse).
- Implémentation d'un système de pause du jeu.
- Ajout d'un écran titre avec une image.
- Amélioration du système de tir des boss avec un tir rotatif.
- Optimisation des performances pour les appareils mobiles.
- Ajout de la prise en charge du plein écran pour les appareils mobiles.

## [0.4.1] - 2023-11-22 - Factorisation Edition

- Le code de gameManager.js a été totalement refactorisé pour augmenter la lisibilité.
- Les graphismes ont été redimensionnés pour augmenter la vitesse de téléchargement.

## [0.4.0] - 2023-11-22 - Boss Edition

- Les boss apparaissent maintenant à chaque vagues multiple de 5.
- Les boss ont 5 points de vie, contrairement aux ennemis qui n'en ont qu'un.
- Lorsqu'un boss perd une vie, il clignote pour indiquer qu'il a été touché.
- Le changement de fond se produit maintenant à la fin de l'état de transition, et non au début.
- Les ennemis ne tirent plus tous en même temps au début d'une vague. Leur temps de tir initial est maintenant décalé aléatoirement pour plus de variété.
- Correction d'un bug où le boss n'apparaissait pas à la vague 5.
- Correction d'un bug où le boss ne clignotait pas lorsqu'il perdait une vie.


## [0.3.0] - 2023-11-20 - Third Version

- Les ennemis sont maintenant créés une seule fois lorsque vous entrez dans l'état de jeu, ce qui empêche la création d'ennemis en quantité infinie.
- Les ennemis sont maintenant initialisés à une position fixe, puis déplacés à partir de cette position en utilisant le bruit de Perlin, ce qui empêche les ennemis de "sauter" de position à l'initialisation.

## [0.2.0] - 2023-11-19 - Explosion Edition

- Les balles ennemies sont maintenant réinitialisées lors d'un game over.
- Les explosions sont maintenant affichées lorsqu'un vaisseau spatial entre en collision avec un ennemi ou une balle ennemie.
- Les explosions continuent maintenant à être affichées après un game over.

## [0.1.0] - 2023-11-18 - First Version

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