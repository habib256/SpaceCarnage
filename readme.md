# 🚀 Space Carnage : L'Épopée Spatiale Ultime !

Bienvenue dans l'univers électrisant de Space Carnage, le jeu de tir spatial qui fait vibrer les étoiles et vous propulse vers des aventures interstellaires inoubliables !

## 🎮 Préparez-vous à une expérience cosmique !

[Plongez dans la bataille spatiale et sauvez la galaxie dès maintenant !](https://habib256.github.io/SpaceCarnage/)

## ⚙️ Installation / Exécution

1. Clonez ce dépôt ou téléchargez ses sources.
2. Depuis le dossier du projet, lancez un petit serveur local (par exemple `python3 -m http.server`).
3. Ouvrez ensuite votre navigateur sur l'adresse affichée (généralement http://localhost:8000) et chargez `index.html`.

Un serveur local est requis afin que p5.js puisse charger correctement les images du jeu.

### 🎯 Votre mission, si vous l'acceptez :

- 🕹️ Maniez votre vaisseau avec virtuosité grâce à la souris.
- 🔫 Déchaînez un torrent de projectiles d'un simple clic.
- 🔊 Laissez-vous porter par la bande-son chiptune (touche **M** pour couper le son).
- 💥 Détruisez vos ennemis et cumulez des points pour atteindre la gloire.
- 🛡️ Esquivez habilement tirs ennemis et collisions dans une danse céleste.
- 🏆 Gravissez les sommets du classement et devenez la légende interstellaire que la galaxie attend !

### Rencontres interstellaires :

- 👽 **Ennemis standards** : 5 points – Des adversaires rapides et imprévisibles pour tester votre réactivité !
- 🦹 **Boss épiques** : 20 points – De redoutables titans spatiaux qui exigent le meilleur de votre stratégie !
- 🎁 **Power-ups mystiques** : Des bonus temporaires qui métamorphosent votre vaisseau en véritable machine de guerre !

## ⚡ Les secrets des Power-ups

Dans Space Carnage, chaque power-up est une clé magique qui peut renverser le cours de la bataille. Découvrez comment leurs pouvoirs extraordinaires peuvent transformer la donne :

### Types de Power-ups :

- **🛡️ Bouclier (shield)**
  - **Effet** : Déployez un champ de force étincelant qui vous rend temporairement invulnérable. Vos ennemis verront leurs tirs rebondir dans un spectacle lumineux !
  - **Durée** : 5 secondes de protection divine, doublées à 10 secondes si le bonus provient d'un boss !

- **❤️ Vie Supplémentaire (extraLife)**
  - **Effet** : Recevez une chance supplémentaire pour poursuivre votre odyssée spatiale – un véritable cadeau des astres !
  - **Particularité** : Ce bonus est unique et reste inégalé, même face aux plus féroces adversaires.

- **✨ Multiplicateur de Points (pointsMultiplier)**
  - **Effet** : Transformez chaque victoire en un festival de points ! Doublez vos gains normalement, et quadruplez-les en mode boss !
  - **Durée** : 5 secondes de gloire intense, ou 10 secondes d'extase interstellaire !

- **🔫 Double Tir (doubleShot)**
  - **Effet** : Libérez une puissance de feu dévastatrice avec un double rayon laser qui annihile tout sur son passage !
  - **Durée** : 5 secondes de chaos explosif, prolongées à 10 secondes en mode boss !

- **⚡ Triple Tir (tripleShot)** *(nouveau)*
  - **Effet** : Déchaînez un déluge de projectiles avec trois rayons simultanés pour une destruction maximale !
  - **Durée** : 6 secondes d'attaque dévastatrice, prolongées à 12 secondes en mode boss !

### 🎲 Mécanique de Drop :

- **👑 Boss**  
  La défaite d'un boss est synonyme de récompense inestimable : une chance de 40% d'obtenir un extraLife, sinon un bonus phénoménal vous attend !

- **👾 Ennemis Standards**  
  En détruisant ces adversaires, vous bénéficiez de 40% de chances de récupérer un power-up – (note : extraLife n'est pas disponible ici).

Maîtrisez ces pouvoirs légendaires pour transformer chaque combat en triomphe intersidéral !

## 🌠 Mode Bonus Astéroïdes

Envie d'une pause explosive ? Appuyez sur **B** à tout moment (ou depuis
l'écran titre) pour affronter un champ d'astéroïdes en défilement continu.
Évitez les rochers spatiaux et tenez bon jusqu'à la fin du chrono pour
revenir glorieux au jeu principal !

## 🔊 Une bande-son forgée dans le silicium

Space Carnage sonne comme une borne d'arcade, sans le moindre fichier audio à
télécharger : **tout est synthétisé en temps réel** par la Web Audio API.

- 🎵 **Musique chiptune dynamique** : un thème pour l'écran titre, un thème
  nerveux en combat, un thème menaçant lors des vagues de boss et une ritournelle
  bondissante pour le mode astéroïdes. La bascule est automatique.
- 💥 **Bruitages multi-couches** : chaque son est bâti comme en studio —
  transitoire claquant, corps métallique en synthèse FM, queue harmonique et
  pluie de débris. Tirs (simple, double, triple, latéral), tirs ennemis et de
  boss, impacts, explosions, ricochets sur le bouclier, crashs d'astéroïdes…
  chaque power-up possède même sa propre signature sonore, du carillon de la vie
  supplémentaire au triton maléfique du crâne.
- 🎧 **Panoramique stéréo** : un ennemi qui explose à gauche de l'écran
  s'entend à gauche. Mettez un casque, la bataille se déploie autour de vous.
- 🌌 **Réverbération spatiale** générée à la volée : les explosions résonnent
  comme dans le vide interstellaire (bon, le vide ne résonne pas, mais l'arcade
  n'a jamais eu ce genre de scrupule).
- 🎚️ **Mixage maîtrisé** : chaque effet a été mesuré puis calibré, un budget de
  voix protège la fluidité et un compresseur en sortie empêche la saturation
  quand l'écran s'embrase.
- 🔇 **Touche M** : coupe ou rétablit le son à tout moment ; votre choix est
  mémorisé pour vos prochaines sessions.

> Le son démarre à votre première interaction (clic, toucher ou touche), comme
> l'exigent les navigateurs modernes.

## 🌌 L'intelligence derrière ce chaos spatial

L'univers de Space Carnage est méticuleusement orchestré :

- **sketch.js** : Le cerveau derrière l'opération spatiale.
- **spaceship.js** : Votre vaisseau – votre fidèle allié dans l'infini cosmos.
- **enemy.js** & **boss.js** : Les menaces venues des confins de l'espace.
- **bullet.js** : L'essence même du combat interstellaire.
- **gameManager.js** : L'arbitre impartial de vos exploits galactiques.
- **powerUp.js** : La touche magique qui sublime chaque bataille.
- **soundManager.js** : Le compositeur synthétique de l'épopée sonore.

# 🚀 Prêt à repousser les limites de l'univers ?

Lancez le jeu, entrez dans l'arène cosmique et faites de chaque seconde une aventure épique ! La galaxie a besoin de vous – devenez le héros légendaire que l'espace attend !

## 🌟 Le créateur de cet univers

VERHILLE Arnaud, artisan du code et rêveur intergalactique (GPL2)

Alors, qu'attendez-vous ? Embarquez, affrontez les ténèbres cosmiques et que la force du code soit avec vous !

[Plongez dans la bataille spatiale et sauvez la galaxie dès maintenant !](https://habib256.github.io/SpaceCarnage/)
