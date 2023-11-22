# Projet de jeu de tir spatial

Ce projet est un jeu de tir spatial écrit en JavaScript utilisant la bibliothèque p5.js.

## Comment jouer

[Pour jouer au jeu, Clique ICI](https://habib256.github.io/SpaceCarnage/)

Vous contrôler un vaisseau spatial et tirer sur les ennemis qui apparaissent à l'écran. Vous pouvez déplacer votre vaisseau en déplaçant la souris. Le vaisseau suivra le mouvement de votre souris. Pour tirer, vous devez cliquer avec le bouton gauche de la souris. Chaque fois que vous cliquez, le vaisseau spatial tirera une balle.

Les ennemis apparaissent en haut de l'écran. Ils peuvent également tirer des balles en direction de votre vaisseau spatial.

Chaque ennemi que vous détruisez vous rapporte cinq points. Le score est affiché en haut à droite de l'écran. Si vous détruisez un ennemi, une explosion apparaît à l'endroit où l'ennemi a été détruit.

De temps en temps, un boss apparaît. Les boss sont plus grands que les ennemis normaux et ont plus de points de vie. Lorsqu'un boss perd une vie, il clignote pour indiquer qu'il a été touché. Si vous parvenez à détruire un boss, vous gagnez 20 points.

Lorsqu'un ennemi est touché un power-up apparait à l'écran. Les power-ups sont des objets qui peuvent être collectés par le vaisseau spatial pour obtenir des points au score ou des bonus temporaires. Pour collecter un power-up, il suffit de déplacer le vaisseau spatial sur le power-up.

Le jeu se termine lorsque votre vaisseau spatial est touché par une balle ennemie ou entre en collision avec un ennemi. À la fin du jeu, votre score est enregistré et le score le plus élevé est affiché à l'écran.

## Structure du code

Le code est divisé en plusieurs fichiers :

- sketch.js : C'est le fichier principal qui gère la logique du jeu.
- spaceship.js : Ce fichier contient la classe Spaceship qui gère le vaisseau spatial du joueur.
- enemy.js : Ce fichier contient la classe Enemy qui gère les ennemis.
- bullet.js : Ce fichier contient la classe Bullet qui gère les balles tirées par le vaisseau spatial et les ennemis.
- gameManager.js : Ce fichier contient la classe GameManager qui gère l'état du jeu, les collisions, le score, etc.
- boss.js : Ce fichier contient la classe Boss qui gère les boss du jeu.
- powerUp.js : Ce fichier contient la classe PowerUp qui gère les power-ups du jeu.

## Auteur

VERHILLE Arnaud GPL2
