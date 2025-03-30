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
├── enemy.js
├── explosion.js
├── gameManager.js
├── index.html
├── laser.js
├── powerup.js
├── sketch.js
├── spaceship.js
└── style.css
```

## 2. Architecture du Code

### 2.1 Classes Principales

#### GameManager (gameManager.js)
- Cœur du jeu, gère l'état et la logique globale
- Gère les états du jeu (title, game, gameOver, transition)
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

### 2.2 Point d'Entrée (sketch.js)
- Initialisation du jeu
- Chargement des ressources
- Configuration du canvas
- Gestion des événements utilisateur

## 3. Systèmes de Jeu

### 3.1 Système de Combat
- Tir simple et double
- Triple tir (power-up)
- Système de bouclier
- Système de vies
- Dégâts et destruction

### 3.2 Système de Power-Ups
Types disponibles :
- Bouclier
- Vie supplémentaire
- Multiplicateur de points
- Double tir
- Triple tir

### 3.3 Système de Score
- Points basés sur la destruction d'ennemis
- Multiplicateur de points
- High score persistant (localStorage)

### 3.4 Système de Vagues
- Progression de difficulté
- Apparition de boss tous les 5 niveaux
- Changement de fond tous les 5 niveaux
- Génération d'ennemis adaptative

## 4. Contrôles
- Support tactile (mobile)
- Support souris (desktop)
- Contrôles clavier pour actions spéciales
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

### 7.2 Fichiers d'Entités
- `enemy.js` : Base des ennemis
- `boss.js` : Ennemis spéciaux
- `bullet.js` : Système de projectiles
- `laser.js` : Projectiles spéciaux
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
