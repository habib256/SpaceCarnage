# Changelog

Toutes les modifications notables à ce projet seront documentées dans ce fichier.

## [0.7.1] - 2026-08-13 - Dynamic Music Edition

La musique passe au niveau supérieur avec le joueur : les thèmes de combat
montent en intensité à chaque vague au lieu de tourner à l'identique du début
du cycle jusqu'au boss.

- **Intensité dramatique** (`SoundManager.setIntensity()`, 0 à 1) appliquée aux
  pistes marquées `dynamic` (`game`, `gameAlt`, `boss`). Les thèmes hors combat
  (titre, bonus, défaite, victoire) ne bougent pas.
- **Quatre leviers, tous progressifs** :
  - le tempo se resserre jusqu'à +10 %, l'accélération des bornes d'arcade
    quand la partie se corse ;
  - la batterie et la basse frappent jusqu'à 25 % plus fort ;
  - les pas de charleston vides se remplissent de frappes fantômes : la
    pulsation double sans réécrire les grilles ;
  - la mélodie gagne une discrète doublure à l'octave au plus fort de la
    tension.
- **Pilotage par la vague** (`GameManager.currentMusicIntensity()`) : la
  tension repart de zéro au début de chaque cycle de cinq vagues, monte d'un
  cran par vague et culmine sur le boss. Le cycle suivant redémarre plus bas,
  avec l'autre thème de combat : la partie respire au lieu de saturer.
- Le changement passe par le scheduler : aucune coupure ni relance de piste,
  l'écho synchronisé suit le nouveau tempo (`syncEcho()`).

## [0.7.0] - 2026-08-10 - Music Edition

Le séquenceur musical est entièrement reconstruit. La première version bouclait
seize pas — une basse, une mélodie, une grosse caisse et un charleston — soit
quatre secondes qui revenaient à l'identique pendant toute la partie. Les
morceaux ont désormais une forme, des instruments et une place dans le mix.

- **Sept thèmes composés** au lieu de quatre boucles :
  - `title` : planant, la nappe et l'arpège s'installent en introduction avant
    l'entrée du thème, qui seul reboucle ;
  - `game` et **`gameAlt`, un second thème de combat** (ré mineur, plus rapide)
    qui prend le relais d'un groupe de vagues à l'autre, pour qu'une longue
    partie ne tourne pas sur la même boucle du début à la fin ;
  - `boss` : mode phrygien, montée chromatique et refrain en demi-tempo ;
  - `bonus` : fa majeur bondissant, avec swing ;
  - **`gameOver`** : marche funèbre jouée sous l'écran de score ;
  - **`victory`** : fanfare en do majeur quand le record tombe.
- **Notation « tracker »** pour écrire les partitions : une chaîne par mesure,
  seize jetons pour seize doubles croches, avec accords (`57+60+64`), silences
  (`.`) et surtout **liaisons** (`-`) — sans elles, tout était haché en doubles
  croches, ce qui était le défaut majeur de l'ancien séquenceur.
- **Structure par sections** (intro, couplet, pont, refrain) enchaînées par
  `compile()`, avec répétitions et point de rebouclage (`loopFrom`).
- **Cinq voies** au lieu de trois : basse, mélodie, arpège, nappe d'accords et
  batterie (grosse caisse, caisse claire, charlestons fermé et ouvert, tom),
  avec une **vélocité par frappe** (`X` accent, `x` normal, `o` étouffé).
- **Instruments dédiés** : basse à filtre résonant doublée d'un triangle,
  mélodie en deux impulsions désaccordées et écartées en stéréo, vibrato
  réservé aux notes tenues, nappes filtrées et arpèges renvoyés dans l'écho.
- **Ondes à rapport cyclique variable** (12,5 %, 25 %, 33 %) fabriquées par
  série de Fourier : la Web Audio API n'offre qu'un carré 50 %, alors que le
  timbre des puces d'époque tient justement aux impulsions étroites.
- **Écho musical synchronisé au tempo** (croche pointée), recalé à chaque
  changement de piste : la ligne de retard qui fait sonner une seule voix
  comme deux.
- **Swing** optionnel par piste : les pas pairs s'allongent, les impairs se
  raccourcissent, le tempo moyen ne bouge pas mais la rythmique cesse d'être
  mécanique.
- **Fondu d'entrée** sur les changements de piste, et **démarrage différé** des
  thèmes de fin de partie (`setMusicLater()`) pour qu'ils ne surgissent pas
  sous la fanfare qui les annonce.
- **Réserve de voix pour la musique** : sous une charge extrême, ce sont les
  bruitages qui sont écrêtés, jamais la basse au milieu d'une mesure.
- Les partitions sont **vérifiées à la compilation** : une mesure mal comptée
  est signalée dans la console au lieu de décaler silencieusement la boucle.

## [0.6.2] - 2026-08-04 - Sound Design Edition

- **Ducking musical** : la musique s'efface brièvement sous les explosions, la perte de vie et le game over, comme un compresseur à chaîne latérale. Les impacts gagnent en poids sans monter le volume.
- **Six nouveaux repères sonores** pour des événements jusque-là muets :
  - chute du bouclier (la montée du ramassage jouée à l'envers),
  - expiration d'un bonus de tir,
  - alarme de dernière vie, calée juste après l'explosion pour rester lisible,
  - **fanfare de record battu**, qui remplace le thème de défaite quand le meilleur score tombe,
  - cadence de fin du mode bonus,
  - souffle des astéroïdes qui entrent dans le champ, dont la hauteur suit la taille du rocher.
- **Quantification 8 bits** (`crush`) : le craquement des convertisseurs d'époque, sur les impacts, le grondement des boss et l'alarme de dernière vie.
- **Modulation en anneau** (`ring`) : partiels inharmoniques pour le crâne, qui sonne enfin aussi faux qu'il est maléfique.
- **Largeur stéréo** : les explosions sont désormais composées de deux souffles décorrélés panoramiqués à gauche et à droite.
- **Rotation de timbres sur le tir du joueur** : trois rapports de modulation alternent, la mitraille ne se répète plus mécaniquement.
- Panoramique corrigé pour les astéroïdes, dessinés centrés et non depuis leur coin.
- Factorisation de la mise en forme du timbre dans `shapeVoice()`, partagée par `tone()`, `fm()` et `noise()`.
- Nouveau rééquilibrage après mesure : compensation des 3 dB perdus par la décorrélation stéréo des explosions.

## [0.6.1] - 2026-08-04 - Better Sound Effects Edition

- **Bruitages entièrement retravaillés**, désormais construits en plusieurs couches (transitoire, corps, queue) au lieu de simples balayages de fréquence.
- Ajout de la **synthèse FM** (`SoundManager.fm()`) : les tirs, impacts et ricochets de bouclier gagnent un timbre métallique impossible à obtenir en synthèse soustractive.
- Ajout d'une **réverbération spatiale** générée à la volée (convolueur alimenté par une réponse impulsionnelle de bruit décroissant) : explosions et bonus gagnent en profondeur.
- Ajout du **panoramique stéréo** : un ennemi qui explose à gauche de l'écran s'entend à gauche. Chaque bruitage suit la position de l'entité concernée.
- Ajout de la **saturation** (`WaveShaper`) pour donner du grain aux tirs ennemis, aux explosions et à l'alarme des boss, et du **vibrato** (LFO) pour les sons tenus.
- Les explosions projettent maintenant une **pluie de débris** (micro-salves de bruit dispersées et pannées aléatoirement) et les explosions de boss détonnent en trois temps.
- Légère **variation aléatoire de hauteur** sur les sons répétitifs pour supprimer l'effet mitraillette.
- Enveloppes enrichies d'un palier de maintien (`hold`) pour des sons plus francs.
- **Rééquilibrage complet du mixage** : les sons fréquents (tirs, impacts) ont été remontés et les sons rares (game over, alerte de boss) adoucis, après mesure du pic et du niveau efficace de chaque effet.
- Ajout d'un **budget de voix** (80 maximum) qui protège le frame rate lorsque l'écran s'embrase.

## [0.6.0] - 2026-08-04 - Sound Edition

- Ajout de **soundManager.js**, un moteur audio 100% procédural basé sur la Web Audio API : aucun fichier son n'est nécessaire, tout est synthétisé en temps réel.
- **Musique chiptune dynamique** avec quatre thèmes bouclés (titre, combat, boss, mode bonus) qui suivent automatiquement l'état du jeu.
- **Bruitages complets** : tirs du joueur (simple, double, triple, latéral), tirs ennemis et de boss, impacts, explosions, destruction de boss, perte de vie, ricochet sur le bouclier, apparition et ramassage des power-ups (une signature sonore par type), collision d'astéroïde, fin de vague, arrivée d'un boss, game over et démarrage de partie.
- Le contexte audio est débloqué au premier geste de l'utilisateur, conformément aux politiques d'autoplay des navigateurs.
- La touche **M** coupe ou rétablit le son ; le choix est mémorisé dans le localStorage et rappelé sur l'écran titre.
- Le son est automatiquement suspendu lors de la mise en pause du jeu (onglet caché) et repris ensuite.
- Un compresseur en sortie évite la saturation lorsque plusieurs effets se superposent.

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