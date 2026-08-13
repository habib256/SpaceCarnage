# Documentation Technique de SpaceCarnage

## 1. Structure du Projet

```
SpaceCarnage/
├── doc/
│   └── architecture.md
├── images/
│   ├── Background*.png
│   ├── Enemy*.png
│   ├── Explosion.png
│   ├── PowerUp*.png
│   ├── SpaceShip*.png
│   └── Title.png
├── boss.js
├── bullet.js
├── asteroid.js
├── enemy.js
├── explosion.js
├── gameManager.js
├── index.html
├── powerup.js
├── sketch.js
├── soundManager.js
├── spaceship.js
└── style.css
```

## 2. Architecture du Code

### 2.1 Classes Principales

#### GameManager (gameManager.js)
- Cœur du jeu, gère l'état et la logique globale
- Gère les états du jeu (title, game, gameOver, transition, bonus)
- Coordonne les interactions entre les différentes entités
- Gère le système de score et de vies
- Contrôle le cycle de jeu et les transitions

#### Spaceship (spaceship.js)
- Vaisseau du joueur
- Gère les mouvements et les contrôles
- Système de tir et de power-ups
- Gestion des collisions et des dégâts
- Système de bouclier et de vies

#### Enemy (enemy.js)
- Classe de base pour les ennemis
- Gère les mouvements et les comportements de base
- Système de tir
- Détection des collisions

#### Boss (boss.js)
- Hérite de Enemy
- Comportements spécifiques aux boss
- Patterns d'attaque plus complexes
- Apparaît tous les 5 niveaux

#### Bullet (bullet.js)
- Projectiles de base
- Gestion des collisions
- Système de destruction

#### PowerUp (powerup.js)
- Bonus collectables
- Différents types de power-ups
- Effets temporaires sur le vaisseau

#### Explosion (explosion.js)
- Effets visuels d'explosion
- Animation de destruction

#### Asteroid (asteroid.js)
- Obstacle du mode bonus
- Se déplace verticalement pour créer un effet de champ d'astéroïdes

#### SoundManager (soundManager.js)
- Moteur audio 100% procédural (Web Audio API), sans aucun fichier son
- Graphe de mixage : voix → [filtre] → enveloppe → panoramique → bus
  (`sfxBus` / `musicBus`) → `master` → compresseur → sortie, avec un départ
  vers un bus de réverbération à convolution (réponse impulsionnelle générée)
- Briques de synthèse réutilisables :
  - `tone()` : oscillateur avec balayage, vibrato, filtre et saturation
  - `fm()` : synthèse par modulation de fréquence (timbres métalliques)
  - `noise()` : bruit blanc filtré, avec balayage de filtre
  - `debris()` : micro-salves dispersées, pour les queues d'explosion
  - `jingle()` : suite de notes MIDI avec doublure à l'octave optionnelle
  - `shapeVoice()` : mise en forme partagée du timbre — saturation (`grit`),
    quantification 8 bits (`crush`) et modulation en anneau (`ring`)
  - `duck()` : atténuation temporaire de la musique sous un événement marquant
  - `createPulseWave()` : ondes à rapport cyclique variable (12,5 % / 25 % / 33 %)
    construites par série de Fourier, absentes de la Web Audio API
- Bruitages construits en couches (transitoire, corps, queue) et légèrement
  randomisés en hauteur pour éviter la répétition mécanique
- Panoramique dérivé de la position à l'écran via `panFor()` / `GameManager.panOf()`
- Budget de voix (`maxVoices`) et anti-mitraillage (`throttle()`) pour préserver
  le frame rate ; la musique dispose d'une réserve supplémentaire afin de ne
  jamais perdre une basse au profit d'un débris d'explosion
- Séquenceur musical à planification anticipée (`lookAhead`), indépendant du
  frame rate de p5.js
- Gestion du déblocage audio, de la coupure du son et de la mise en veille

#### Séquenceur musical (dans soundManager.js)
- Partitions écrites en notation « tracker » : une chaîne par mesure, seize
  jetons pour seize doubles croches — `69` (note MIDI), `57+60+64` (accord),
  `-` (liaison, prolonge la note), `.` (silence)
- Chaîne de compilation : `notes()` / `hits()` analysent les chaînes, `fit()`
  vérifie la longueur des mesures, `events()` transforme les liaisons en durées
  et `compile()` déroule les sections en une boucle unique
- Structure par sections (intro, couplet, pont, refrain) avec `repeat` et
  `loopFrom` : ce qui précède le point de rebouclage ne s'entend qu'une fois
- Cinq voies : `bass`, `lead`, `arp`, `pad` et une batterie (`kick`, `snare`,
  `hat`, `open`, `tom`) dont les symboles portent une vélocité
- Instruments dédiés (`musicBass()`, `musicLead()`, `musicArp()`, `musicPad()`,
  `musicKick()`, `musicSnare()`, `musicHat()`, `musicTom()`) ; les arpèges
  alternent gauche/droite en ping-pong stéréo
- Bus d'écho musical (`buildMusicEcho()`) recalé sur le tempo à chaque
  changement de piste par `syncEcho()`, et swing optionnel via `stepLength()`
- `setMusic()` avec fondu d'entrée, et `setMusicLater()` pour les thèmes de fin
  de partie qui ne doivent pas démarrer sous la fanfare qui les annonce
- Intensité dramatique (`setIntensity()`, 0 à 1) sur les pistes marquées
  `dynamic` : tempo resserré jusqu'à +10 %, batterie et basse plus appuyées,
  frappes fantômes de charleston et doublure de la mélodie à l'octave

### 2.2 Point d'Entrée (sketch.js)
- Initialisation du jeu
- Chargement des ressources
- Configuration du canvas
- Gestion des événements utilisateur

## 3. Systèmes de Jeu

### 3.1 Système de Combat
- Tir simple et double
- Triple tir (power-up, nouveau)
- Système de bouclier
- Système de vies
- Dégâts et destruction

### 3.2 Système de Power-Ups
Types disponibles :
- Bouclier
- Vie supplémentaire
- Multiplicateur de points
- Double tir
- Triple tir (nouveau)

### 3.3 Système de Score
- Points basés sur la destruction d'ennemis
- Multiplicateur de points
- High score persistant (localStorage)

### 3.4 Système Audio
- Sept thèmes chiptune pilotés par `GameManager.updateAudioState()` :
  `title`, `game` et `gameAlt` (thèmes de combat alternés par
  `currentMusicTrack()` d'un groupe de vagues à l'autre), `boss`, `bonus`,
  `gameOver` et `victory` (record battu)
- Progression dramatique : `currentMusicIntensity()` fait monter la musique
  d'un cran à chaque vague du cycle de cinq (tempo, batterie, doublures) et
  culmine sur le boss ; le cycle suivant repart plus bas avec l'autre thème
- Bruitages déclenchés depuis les points de gameplay via `GameManager.playSound()`,
  un appel sécurisé qui laisse le jeu fonctionner si l'audio est indisponible
- Spatialisation stéréo : chaque bruitage reçoit la position de l'entité
  concernée, calculée par `GameManager.panOf()`
- Le contexte audio est créé puis réveillé au premier geste utilisateur
  (`SoundManager.unlock()` appelé depuis `sketch.js`)
- Repères sonores d'état : chute du bouclier et expiration des bonus depuis
  `Spaceship`, alarme de dernière vie, fanfare de record battu au game over
- Coupure du son avec la touche M, persistée dans le localStorage
- Suspension/reprise du contexte lorsque le jeu est mis en pause

### 3.5 Système de Vagues
- Progression de difficulté
- Apparition de boss tous les 5 niveaux
- Changement de fond tous les 5 niveaux
- Génération d'ennemis adaptative

## 4. Contrôles
- Support tactile (mobile)
- Support souris (desktop)
- Contrôles clavier pour actions spéciales (B : mode bonus, M : son on/off)
- Gestion du plein écran

## 5. Optimisations
- Gestion de la mémoire (destruction des objets hors écran)
- Frame rate limité à 30 FPS
- Support responsive
- Gestion du plein écran sur mobile

## 6. Points d'Extension
Le code est modulaire et permet d'ajouter facilement :
- Nouveaux types d'ennemis
- Nouveaux power-ups
- Nouvelles mécaniques de tir
- Nouveaux effets visuels

## 7. Fichiers Clés et Leurs Rôles

### 7.1 Fichiers Principaux
- `sketch.js` : Point d'entrée et configuration
- `gameManager.js` : Logique principale du jeu
- `spaceship.js` : Contrôle du vaisseau du joueur
- `soundManager.js` : Synthèse de la musique et des bruitages

### 7.2 Fichiers d'Entités
- `enemy.js` : Base des ennemis
- `boss.js` : Ennemis spéciaux
- `bullet.js` : Système de projectiles
- `powerup.js` : Système de bonus
- `explosion.js` : Effets visuels

### 7.3 Fichiers d'Interface
- `index.html` : Structure de la page
- `style.css` : Style et mise en page

## 8. Points d'Attention pour l'IA
Pour une intervention efficace, l'IA doit :
1. Comprendre la hiérarchie des classes et leurs relations
2. Identifier les points d'extension appropriés
3. Respecter les systèmes de jeu existants
4. Maintenir la cohérence avec le style de code existant
5. Tester les modifications dans le contexte du jeu complet
