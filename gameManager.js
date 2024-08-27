class GameManager {
    constructor(spaceshipImages, enemyImages, bgImages, explosionImages, powerupImages, titleImage) {
        this.spaceshipImages = spaceshipImages;
        this.enemyImages = enemyImages;
        this.bgImages = bgImages;
        this.bgImageIndex = 0; 
        this.bg = bgImages[this.bgImageIndex];
        this.explosionImages = explosionImages; // Changed from this.ExplosionsImages
        this.gameState = "title"; // can be "title", "game", "gameOver", "transition"
        this.enemyBullets = [];
        this.explosions = [];
        this.gameOver = false;
        this.pauseGame = true;
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
        this.resetGame();
    };

    resetGame() {
        this.bullets = [];
        this.enemyBullets = []; // Added this line
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
        this.enemiesCreated = false; // Added this line
    };

    drawTitle() {
        background(0);
        fill(255);
        textSize(40);
        let titleText = "Spaceship Carnage";
        let pressKeyText = "Click to start";
        text(titleText, (width - textWidth(titleText)) / 2, 50);
        text(pressKeyText, (width - textWidth(pressKeyText)) / 2, 90);
        
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
            text("Ship: " + this.spaceship.lives, 5, 50); // Ajoutez cette ligne
    };

    manageGame() {
        const gameStateHandlers = {
            title: this.drawTitle,
            game: this.handleGameLogic,
            transition: this.handleTransitionState,
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
        // Check if the spaceship has no more lives
        if (this.spaceship.lives <= 0) {
            this.gameOver = true;
            this.gameState = "gameOver";
            // Record the time when the game ends
            this.gameOverTime = millis();
             // Si la vague est la première, réinitialise l'index de l'image de fond
            this.bgImageIndex = 0; 

        }   
        // Move to game state after a certain delay
        if (millis() - this.transitionTime >= 2000) { // Changed from this.gameOverTime
            this.gameState = "game";
            // Si la vague est un multiple de 5, change l'image de fond
            if (this.wave % 5 === 0) { 
            // Incrementer l'index de l'image de fond et mettre à jour l'image de fond

             this.bgImageIndex ++;
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
        // Si le bouton de la souris est pressé et que le temps écoulé depuis le dernier tir est supérieur au taux de tir, tire une balle
        let currentTime = millis();
        if (mouseIsPressed && mouseButton === LEFT && currentTime - this.lastFireTime >= this.fireRate) {
            let bullet = new Bullet(this.spaceship.x + this.spaceship.size / 2, this.spaceship.y + this.spaceship.size / 2, 0, -1);
            this.bullets.push(bullet);
            this.lastFireTime = currentTime;
        }
    }

    handleEnemyBullets(){
        for (let i = 0; i < this.enemies.length; i++) {
            let enemyBullet = this.enemies[i].shoot();
            if (enemyBullet !== null) {
                this.enemyBullets.push(enemyBullet);
            }
        }
    };

    handleAllEnemiesDestroyed() {
        // Si tous les ennemis sont détruits, passe à l'état de transition et prépare la prochaine vague
        if (this.enemies.length === 0) {
            this.gameState = "transition";
            this.transitionTime = millis(); 
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
                if (!this.spaceship.shieldActive) {
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

    checkBulletsCollisions() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                if (this.bullets[i].hits(this.enemies[j])) {
                    this.enemies[j].health--;
                    if (this.enemies[j] instanceof Boss) {
                        this.enemies[j].flashing = true;
                    }
                    if (this.enemies[j].health <= 0) {
                        let explosion = new Explosion(this.enemies[j].x, this.enemies[j].y, this.enemies[j].size, this.explosionImages);
                        this.explosions.push(explosion);
                        
                        // Supprimez la vérification du bouclier ici
                        let powerUp;
                        if (this.enemies[j] instanceof Boss) {
                            this.score += 25;
                            powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, 32, this.powerupImages);
                            this.powerUps.push(powerUp);
                        } else {
                            this.score += 5;
                            if (Math.random() < 0.4) {
                                powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, 16, this.powerupImages);
                                this.powerUps.push(powerUp);
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
            // Si le vaisseau spatial entre en collision avec un power-up
            if (this.spaceship.collidesWith(this.powerUps[i])) {
                // Appliquer l'effet du power-up
                this.applyPowerUpEffect(this.powerUps[i]);
                // Supprimer le power-up
                this.powerUps.splice(i, 1);
            }
        }
    };

    applyPowerUpEffect(powerUp) {
        console.log(`Power-up récupéré : ${powerUp.type}`);
        
        switch(powerUp.type) {
            case 'shield':
                this.spaceship.activateShield(5000);
                break;
            case 'extraLife':
                this.spaceship.lives++;
                break;
            case 'pointsMultiplier':
                this.activatePointsMultiplier(10000);
                break;
            case 'doubleShot':
                this.spaceship.activateDoubleShot(7000);
                break;
            case 'speedBoost':
                this.spaceship.activateSpeedBoost(6000);
                break;
            default:
                console.log(`Type de power-up inconnu : ${powerUp.type}`);
        }
    }

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
        if (mouseButton === LEFT) {
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
    }


    handleTouchReleased() {
        if (this.gameState === "game") {
            this.spaceship.stopFiring();
        }
    }

    handleKeyPressed() {
        if ((this.gameState === "title" || this.gameState === "gameOver") && millis() - this.gameOverTime > 1000) { // Added this line
            this.resetGame();
        }
    }

    pauseGame() {
        // Code to pause the game
        this.gameState = "paused";
    }

    resumeGame() {
        // Code to resume the game
        this.gameState = "game";
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


