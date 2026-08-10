class GameManager {
    constructor(spaceshipImages, enemyImages, bgImages, explosionImages, powerupImages, titleImage) {
        this.spaceshipImages = spaceshipImages;
        this.enemyImages = enemyImages;
        this.bgImages = bgImages;
        this.bgImageIndex = 0; 
        this.bg = bgImages[this.bgImageIndex];
        this.explosionImages = explosionImages; // Changed from this.ExplosionsImages
        this.gameState = "title"; // can be "title", "game", "gameOver", "transition", "bonus"
        this.enemyBullets = [];
        this.explosions = [];
        this.gameOver = false;
        // indicates whether the main loop should run
        this.isRunning = true;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.fireRate = 150; // 150 milliseconds = 0.1 seconds
        this.lastFireTime = 0;
        this.gameOverTime = 0; 
        this.transitionTime = 0; 
        this.enemiesCreated = false; 
        this.powerUps = []; 
        this.bossCreated = false; 
        this.titleImage = titleImage;
        this.powerupImages = powerupImages; // Added this line
        this.asteroids = [];
        this.bonusStartTime = 0;
        this.bonusDuration = 10000; // duration of bonus mode in ms
        this.asteroidSpawnRate = 800;
        this.lastAsteroidTime = 0;
        this.scrollY = 0;
        this.lastAudioState = null; // dernier état sonorisé, pour piloter la musique
        this.resetGame();
    };

    /**
     * Appel sécurisé au moteur audio : le jeu reste jouable même si le
     * SoundManager n'a pas pu s'initialiser (Web Audio indisponible).
     */
    playSound(method, ...args) {
        if (typeof soundManager !== 'undefined' && soundManager && typeof soundManager[method] === 'function') {
            soundManager[method](...args);
        }
    };

    /**
     * Position stéréo d'une entité : un ennemi qui explose à gauche de l'écran
     * s'entend à gauche.
     */
    panOf(entity) {
        if (!entity || typeof soundManager === 'undefined' || !soundManager) return 0;
        // Les astéroïdes sont dessinés centrés sur (x, y), les autres entités
        // depuis leur coin supérieur gauche.
        const centered = (typeof Asteroid !== 'undefined' && entity instanceof Asteroid);
        const centerX = centered ? entity.x : entity.x + (entity.size || 0) / 2;
        return soundManager.panFor(centerX);
    };

    /**
     * Nom de la piste musicale correspondant à la vague en cours.
     * Les vagues de boss ont leur thème ; entre elles, deux thèmes de combat
     * se relaient d'un groupe de vagues à l'autre pour qu'une longue partie
     * ne tourne pas sur la même boucle du début à la fin.
     */
    currentMusicTrack() {
        if (this.wave % 5 === 0) return 'boss';
        return (Math.floor(this.wave / 5) % 2 === 0) ? 'game' : 'gameAlt';
    };

    /**
     * Synchronise la musique et les jingles avec l'état du jeu.
     * Appelée à chaque frame : les changements de piste sont ignorés
     * lorsque la piste demandée est déjà en cours de lecture.
     */
    updateAudioState() {
        const stateChanged = (this.gameState !== this.lastAudioState);
        if (stateChanged) {
            switch (this.gameState) {
                case "title":
                    this.playSound('setMusic', 'title');
                    break;
                case "transition":
                    if (this.lastAudioState === "title" || this.lastAudioState === "gameOver") {
                        this.playSound('playStart');
                    }
                    this.playSound('setMusic', this.currentMusicTrack());
                    if (this.wave % 5 === 0) {
                        this.playSound('playBossWarning');
                    }
                    break;
                case "game":
                    this.playSound('setMusic', this.currentMusicTrack());
                    break;
                case "bonus":
                    this.playSound('setMusic', 'bonus');
                    break;
                case "gameOver": {
                    this.playSound('setMusic', null);
                    // Le nouveau record n'est écrit qu'ensuite par drawGameOver :
                    // on peut donc encore le comparer au précédent.
                    const best = parseInt(localStorage.getItem('highScore'), 10);
                    const record = (this.score > 0 && (isNaN(best) || this.score > best));
                    if (record) {
                        this.playSound('playHighScore');
                    } else {
                        this.playSound('playGameOver');
                    }
                    // La fanfare (ou la chute) doit retomber avant que le thème
                    // de fin de partie ne s'installe sous l'écran de score.
                    this.playSound('setMusicLater', record ? 'victory' : 'gameOver',
                        record ? 2.6 : 2.4);
                    break;
                }
            }
            this.lastAudioState = this.gameState;
        } else if (this.gameState === "game") {
            // Une vague de boss commence : bascule sur le thème adéquat.
            this.playSound('setMusic', this.currentMusicTrack());
        }
    };

    resetGame() {
        this.bullets = [];
        this.enemyBullets = []; // Réinitialise les balles ennemies
        let spaceshipImage = random(this.spaceshipImages);
        this.spaceship = new Spaceship(spaceshipImage, 64);
        this.enemies = [];
        this.explosions = [];
        this.score = 0;
        this.keys = {};
        this.bg = this.bgImages[0];
        this.powerUps = [];
        this.wave = 1; 
        this.transitionTime = millis();
        this.enemiesCreated = false; // Réinitialise l'état de création des ennemis
        this.bossCreated = false;    // Ajouté pour réinitialiser l'état des boss
        this.pointsMultiplier = 1;   // Ajouté pour initialiser le multiplicateur de score
        this.asteroids = [];
        this.scrollY = 0;
        this.lastAsteroidTime = millis();
    };

    drawTitle() {
        background(0);
        fill(255);
        textSize(40);
        let titleText = "Spaceship Carnage";
        let pressKeyText = "Click to start";
        text(titleText, (width - textWidth(titleText)) / 2, 50);
        text(pressKeyText, (width - textWidth(pressKeyText)) / 2, 90);
        let bonusText = "Press B for Asteroid Bonus";
        textSize(24);
        text(bonusText, (width - textWidth(bonusText)) / 2, 130);

        // Rappel du raccourci audio en bas de l'écran titre
        let soundText = "Press M for Sound " + (this.isMuted() ? "ON" : "OFF");
        textSize(20);
        text(soundText, (width - textWidth(soundText)) / 2, height - 20);

        // Vérifiez si titleImage est défini avant de l'utiliser
        if (this.titleImage && this.titleImage.width) {
            image(this.titleImage, (width - this.titleImage.width) / 2, 100);
            
            let tapText = "Tap for Fullscreen";
            text(tapText, (width - textWidth(tapText)) / 2, 140 + this.titleImage.height);
        } else {
            console.warn("L'image du titre n'est pas chargée ou n'a pas de largeur définie.");
        }
    };

    drawUI() {
        this.drawLives();
        this.drawScore();
        this.drawSoundStatus();
    };

    /** Indique que le son est coupé (rien n'est affiché quand il est actif). */
    isMuted() {
        return (typeof soundManager !== 'undefined' && soundManager) ? soundManager.muted : true;
    };

    drawSoundStatus() {
        if (!this.isMuted()) return;
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(18);
        text("Sound OFF (M)", 5, 75);
    };

    drawElements(elements) {
        elements.forEach(element => {
            element.show();
            element.move();
        });
    };

    drawExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            if (this.explosions[i].show()) {
                this.explosions.splice(i, 1);
            }
        }
    };

    drawTransition() {
        image(this.bg, 0, 0);
        this.spaceship.show(); 
        this.drawElements(this.bullets);
        this.drawElements(this.enemyBullets);
        this.drawElements(this.powerUps);
        this.drawExplosions();
        this.drawScore();
        this.drawLives();
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(48);
        let waveText = "Wave " + this.wave;
        text(waveText, (width - textWidth(waveText)) / 2, height / 8);
    };

    drawGameOver() {
        image(this.bg, 0, 0);
        this.drawExplosions();
        textSize(64);
        strokeWeight(5);
        stroke(0);
        fill(255);
        let gameOverText = "Game Over";
        text(gameOverText, (width - textWidth(gameOverText)) / 2, height / 8);
        let highScore = localStorage.getItem('highScore');
        if (highScore === null || this.score > highScore) {
            localStorage.setItem('highScore', this.score);
        }
        
    };

    drawGame() {
        image(this.bg, 0, 0);
        this.spaceship.show(); 
        this.drawElements(this.bullets);
        this.drawElements(this.enemies);
        this.drawElements(this.enemyBullets);
        this.drawElements(this.powerUps);
        this.drawExplosions();
    };


    drawScore() {
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(24);
        text("Score: " + this.score, width - 150, 25);
        let highScore = localStorage.getItem('highScore') || 0;
        text("Best: " + highScore, 5, 25);   
    };

    drawLives() {
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(24);
        text("Ship: " + this.spaceship.lives, 5, 50);
    };

    manageGame() {
        this.updateAudioState();
        const gameStateHandlers = {
            title: this.drawTitle,
            game: this.handleGameLogic,
            transition: this.handleTransitionState,
            bonus: this.handleBonusMode,
            gameOver: this.handleGameOverState
        };

        const handler = gameStateHandlers[this.gameState];
        if (handler) {
            handler.call(this);
        }
        this.updateSpaceshipPosition();
        this.handleEnemyBullets();
    };

    handleGameLogic() {
        this.createEnemiesIfNeeded();
        this.createBossIfNeeded();
        this.drawGame();
        this.drawUI();
        this.handleCollisions();
        this.fireBulletIfNeeded();
        this.handleAllEnemiesDestroyed();
    };

    handleTransitionState() {
        this.drawTransition();
        this.checkSpaceshipCollisions();
        this.checkPowerUpsCollisions();
        this.handleGameOver();
        this.moveToNextGameStateIfNeeded();
    };

    handleBonusMode() {
        this.drawBonusBackground();
        this.spaceship.show();
        this.drawElements(this.asteroids);
        this.checkAsteroidCollisions();
        this.spawnAsteroidsIfNeeded();
        if (millis() - this.bonusStartTime > this.bonusDuration) {
            this.playSound('playBonusEnd');
            this.gameState = "title";
        }
    };

    handleGameOver() {
        if (this.spaceship.lives <= 0) {
            this.gameOver = true;
            this.gameState = "gameOver";
            this.gameOverTime = millis();
        }
    };

    handleGameOverState() {
        this.drawGameOver();
        this.drawScore();
    };

    moveToNextGameStateIfNeeded() {
        // Vérifier d'abord si le vaisseau n'a plus de vies
        if (this.spaceship.lives <= 0) {
            this.gameOver = true;
            this.gameState = "gameOver";
            this.gameOverTime = millis();
            // Si c'est la première vague, réinitialiser l'image de fond
            this.bgImageIndex = 0;
            return; // Empêcher la transition vers l'état de jeu
        }
        // Passer à l'état de jeu après un délai donné
        if (millis() - this.transitionTime >= 2000) {
            this.gameState = "game";
            // Pour les vagues multiples de 5, changer l'image de fond
            if (this.wave % 5 === 0) { 
                 // Incrémente l'index de l'image de fond en s'assurant de rester dans la taille du tableau
                 this.bgImageIndex = (this.bgImageIndex + 1) % this.bgImages.length;
                 this.bg = this.bgImages[this.bgImageIndex];
            }  
            // Réinitialiser les variables pour la prochaine vague
            this.enemiesCreated = false;
            this.bossCreated = false;
        }
    };

    updateSpaceshipPosition() {
        // Si l'utilisateur utilise un smartphone, restez à la dernière position du toucher
        if (touches.length > 0 && touches[0] !== undefined ) {
            this.spaceship.x = touches[0].x - this.spaceship.size / 2;
            this.spaceship.y = touches[0].y - 60 - this.spaceship.size / 2;
            // Mettez à jour lastTouchX et lastTouchY chaque fois que vous touchez l'écran
        } else {
            // Si l'utilisateur utilise un PC, suivez la position de la souris
            this.spaceship.x = mouseX - this.spaceship.size / 2 ;
            this.spaceship.y = mouseY - this.spaceship.size / 2 ;
        }
        this.spaceship.x = constrain(this.spaceship.x, 0, width - this.spaceship.size);
        this.spaceship.y = constrain(this.spaceship.y, 0, height - this.spaceship.size);
    };

    updateSpaceshipLives() {
        // Decrement spaceship's lives
        this.spaceship.lives--;
        this.playSound('playPlayerHit', this.panOf(this.spaceship));
        if (this.spaceship.lives === 1) {
            this.playSound('playLastLifeWarning');
        }
        // If spaceship has no more lives, end the game
        if (this.spaceship.lives <= 0) {
            this.gameOver = true;
            this.gameState = "gameOver";
            // Record the time when the game ends
            this.gameOverTime = millis();
        }
        // Create a new explosion at the spaceship's position
        let explosion = new Explosion(this.spaceship.x, this.spaceship.y, this.spaceship.size, this.explosionImages);
        // Add the explosion to the list of explosions
        this.explosions.push(explosion);
    };

    fireBulletIfNeeded() {
        let currentTime = millis();
        // Si le double tir est actif, tire plus vite (par exemple 1.5 fois plus rapidement)
        let fireInterval = this.fireRate;
        if (this.spaceship.doubleShotActive) {
            fireInterval = this.fireRate / 1.5;
        }
        if (mouseIsPressed && mouseButton === LEFT && currentTime - this.lastFireTime >= fireInterval) {
            // Utiliser la méthode shoot() du vaisseau qui renvoie un tableau de balles
            let newBullets = this.spaceship.shoot();
            this.bullets.push(...newBullets);
            this.lastFireTime = currentTime;
            let shootMode = 'single';
            if (this.spaceship.tripleShotActive) {
                shootMode = 'triple';
            } else if (this.spaceship.doubleShotActive) {
                shootMode = 'double';
            }
            const shipPan = this.panOf(this.spaceship);
            this.playSound('playShoot', shootMode, shipPan);
            if (this.spaceship.lateralShootActive) {
                this.playSound('playLateralShoot', shipPan);
            }
        }
    }

    handleEnemyBullets(){
        for (let i = 0; i < this.enemies.length; i++) {
            let enemyBullet = this.enemies[i].shoot();
            if (enemyBullet !== null) {
                this.enemyBullets.push(enemyBullet);
                this.playSound(this.enemies[i] instanceof Boss ? 'playBossShoot' : 'playEnemyShoot',
                    this.panOf(this.enemies[i]));
            }
        }
    };

    spawnAsteroidsIfNeeded() {
        if (millis() - this.lastAsteroidTime > this.asteroidSpawnRate) {
            const asteroid = new Asteroid();
            this.asteroids.push(asteroid);
            // Le souffle suit la taille du rocher : les gros grondent plus bas
            this.playSound('playAsteroidWhoosh', this.panOf(asteroid), asteroid.size / 50);
            this.lastAsteroidTime = millis();
        }
        this.asteroids = this.asteroids.filter(a => !a.offScreen());
    }

    drawBonusBackground() {
        this.scrollY += 2;
        let y = this.scrollY % height;
        image(this.bg, 0, y - height);
        image(this.bg, 0, y);
    }

    checkAsteroidCollisions() {
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            if (this.spaceship.collidesWith(this.asteroids[i])) {
                this.playSound('playAsteroidCrash', this.panOf(this.asteroids[i]));
                this.updateSpaceshipLives();
                this.asteroids.splice(i, 1);
            }
        }
    }

    handleAllEnemiesDestroyed() {
        // Si tous les ennemis sont détruits, passe à l'état de transition et prépare la prochaine vague
        if (this.enemies.length === 0) {
            this.gameState = "transition";
            this.transitionTime = millis();
            this.playSound('playWaveClear');
            this.wave++;
            this.enemiesCreated = false; 
            this.bossCreated = false; // Réinitialisez this.bossCreated à false ici
        }
    }

    createEnemiesIfNeeded() {
        // Si les ennemis n'ont pas encore été créés pour cette vague, crée les ennemis
        if (!this.enemiesCreated) { 
            for (let i = 0; i < this.wave; i++) {
                this.enemies.push(new Enemy(this.enemyImages, 64));
            }
            this.enemiesCreated = true; 
        }
    }

    createBossIfNeeded () {
        if (this.wave % 5 === 0) { 
            if (!this.bossCreated) {
                let numberOfBosses = this.wave / 5;
                for (let i = 0; i < numberOfBosses; i++) {
                    let boss = new Boss(this.enemyImages, 64); // 64 est la taille de base d'un ennemi
                    boss.x = width / 2 - boss.size / 2; // Centrer le boss horizontalement
                    boss.y = height / 8; // Positionner le boss à un quart de la hauteur de l'écran
                    this.enemies.push(boss);
                }
                this.bossCreated = true; // Assurez-vous de ne créer le boss qu'une seule fois
            }
        }
    }

    handleCollisions() {
        this.checkSpaceshipCollisions();
        this.checkBulletsCollisions();
        this.checkPowerUpsCollisions();
    };

    checkSpaceshipCollisions() {
        // Vérification des collisions avec les ennemis
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.spaceship.collidesWith(this.enemies[i])) {
                if (!this.spaceship.activeShield) {
                    this.updateSpaceshipLives();
                    this.enemies.splice(i, 1);
                }
                break;
            }
        }

        // Vérification des collisions avec les balles ennemies
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            if (this.spaceship.collidesWith(this.enemyBullets[i])) {
                if (this.spaceship.reflectBullet(this.enemyBullets[i])) {
                    // La balle a été réfléchie, on la transforme en balle du joueur
                    this.playSound('playShieldBounce', this.panOf(this.enemyBullets[i]));
                    this.bullets.push(this.enemyBullets[i]);
                    this.enemyBullets.splice(i, 1);
                } else {
                    this.updateSpaceshipLives();
                    this.enemyBullets.splice(i, 1);
                }
                break;
            }
        }

        // Supprimer les balles ennemies hors de l'écran
        this.enemyBullets = this.enemyBullets.filter(bullet => !bullet.offScreen());
    };

    // Cette méthode ajuste le pourcentage de drop en fonction du nombre d'ennemis présents à l'écran.
    getAdjustedDropChance(baseChance) {
        return baseChance / (1 + this.enemies.length);
    }

    checkBulletsCollisions() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                if (this.bullets[i].hits(this.enemies[j])) {
                    this.enemies[j].health--;
                    if (this.enemies[j] instanceof Boss) {
                        this.enemies[j].flashing = true;
                    }
                    const enemyPan = this.panOf(this.enemies[j]);
                    if (this.enemies[j].health > 0) {
                        // L'ennemi encaisse : simple impact
                        this.playSound('playHit', enemyPan);
                    }
                    if (this.enemies[j].health <= 0) {
                        let explosion = new Explosion(this.enemies[j].x, this.enemies[j].y, this.enemies[j].size, this.explosionImages);
                        this.explosions.push(explosion);
                        this.playSound(this.enemies[j] instanceof Boss ? 'playBossExplosion' : 'playExplosion', enemyPan);

                        // Supprimez la vérification du bouclier ici
                        let powerUp;
                        if (this.enemies[j] instanceof Boss) {
                            this.score += 25;
                            // Pour chaque boss vaincu, générer un power-up à 100% du temps
                            let powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, 32, this.powerupImages);
                            powerUp.fromBoss = true;  // Marquer que ce power-up provient d'un boss
                            if (Math.random() < 0.4) {  // 40% de chances pour une extra life
                                powerUp.type = 'extraLife';
                            } else {
                                let allowedTypes = ['shield', 'pointsMultiplier', 'doubleShot', 'lateralShoot', 'tripleShot', 'skull'];
                                powerUp.type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
                            }
                            powerUp.image = powerUp.getImageForType(powerUp.type);
                            this.powerUps.push(powerUp);
                            this.playSound('playPowerUpDrop', this.panOf(powerUp));
                        } else {
                            this.score += 5;
                            // Pour les ennemis normaux, on exclut l'extraLife et on ne droppe le power-up qu'avec une probabilité de 40%
                            if (Math.random() < this.getAdjustedDropChance(0.4)) {
                                let allowedTypes = ['shield', 'pointsMultiplier', 'doubleShot', 'lateralShoot', 'tripleShot', 'skull'];
                                let chosenType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
                                
                                let powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, 16, this.powerupImages);
                                powerUp.type = chosenType;
                                powerUp.image = powerUp.getImageForType(chosenType);
                                this.powerUps.push(powerUp);
                                this.playSound('playPowerUpDrop', this.panOf(powerUp));
                            }
                        }
                        this.enemies.splice(j, 1);
                    }
                    this.bullets[i].destroy();
                }
            }

            if (this.bullets[i].y < 0 || this.bullets[i].y > height || this.bullets[i].toDelete) {
                this.bullets.splice(i, 1);
            }
        }
    }

    checkPowerUpsCollisions() {
        // Parcourir tous les power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            // Si le vaisseau entre en collision avec le power-up
            if (this.spaceship.collidesWith(this.powerUps[i])) {
                // Jouer la signature sonore du bonus avant de l'appliquer
                this.playSound('playPowerUp', this.powerUps[i].type, this.panOf(this.powerUps[i]));
                // Appliquer l'effet du power-up directement via collectPowerUp()
                this.spaceship.collectPowerUp(this.powerUps[i]);
                // Supprimer le power-up après récupération
                this.powerUps.splice(i, 1);
            }
        }
    };

    handleMousePressed() {
        
        if (mouseButton === LEFT) {
            if (this.gameState === "gameOver" && millis() - this.gameOverTime > 1000) { // Added this line
                this.resetGame();
                this.gameState = "transition";
                this.transitionTime = millis();
            }
            if (this.gameState === "title") {
                this.gameState = "transition";
                this.transitionTime = millis();
                this.mouseUsed = true;
            }
    
        }
    }
    
    handleTouchPressed() {
        if (this.gameState === "gameOver" && millis() - this.gameOverTime > 1000) { // Added this line
            this.resetGame();
            this.gameState = "transition";
            this.transitionTime = millis();
        }
        if (this.gameState === "title") {
            this.gameState = "transition";
            this.transitionTime = millis();
        }
    }


    handleTouchReleased() {
        if (this.gameState === "game") {
            this.spaceship.stopFiring();
        }
    }

    handleKeyPressed() {
        if (key === 'm' || key === 'M') {
            // Coupe / rétablit le son sans perturber la partie en cours
            this.playSound('toggleMute');
            return;
        }
        if (key === 'b' || key === 'B') {
            // Le mode bonus peut être lancé à tout moment
            this.startBonusMode();
            return;
        }
        if ((this.gameState === "title" || this.gameState === "gameOver") && millis() - this.gameOverTime > 1000) {
            this.resetGame();
        }
    }

    startBonusMode() {
        this.resetGame();
        this.playSound('playBonusStart');
        this.gameState = "bonus";
        this.bonusStartTime = millis();
        this.asteroids = [];
        this.scrollY = 0;
        this.lastAsteroidTime = millis();
    }

    pauseGame() {
        // Code pour mettre le jeu en pause
        this.gameState = "paused";
        this.isRunning = false;
        this.playSound('suspend');
        console.log("Jeu en pause");
    }

    resumeGame() {
        // Code pour reprendre le jeu
        this.gameState = "game";
        this.isRunning = true;
        this.playSound('resume');
        console.log("Jeu repris");
    }

    activatePointsMultiplier(duration) {
        this.pointsMultiplier = 2;
        setTimeout(() => {
            this.pointsMultiplier = 1;
        }, duration);
    }

    updateScore(points) {
        this.score += points * this.pointsMultiplier;
    }
}


