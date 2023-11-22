class GameManager {
    constructor(spaceshipImages, enemyImages, bgImages, explosionImages, powerupImages) {
        this.spaceshipImages = spaceshipImages;
        this.enemyImages = enemyImages;
        this.bgImages = bgImages;
        this.explosionImages = explosionImages; // Changed from this.ExplosionsImages
        this.gameState = "title"; // can be "title", "game", "gameOver", "transition"
        this.enemyBullets = [];
        this.explosions = [];
        this.gameOver = false;
        this.pauseGame = true;
        this.fireRate = 150; // 150 milliseconds = 0.1 seconds
        this.lastFireTime = 0;
        this.gameOverTime = 0; 
        this.transitionTime = 0; 
        this.enemiesCreated = false; 
        this.powerUps = []; 
        this.bossCreated = false; 
        this.resetGame();
    }

    resetGame() {
        this.bullets = [];
        this.enemyBullets = []; // Added this line
        let spaceshipImage = random(this.spaceshipImages);
        this.spaceship = new Spaceship(spaceshipImage, 64);
        this.enemies = [];
        this.explosions = [];
        this.score = 0;
        this.keys = {};
        this.bg = random(this.bgImages);
        this.powerUps = [];
        this.wave = 1; 
        this.transitionTime = millis();
        this.enemiesCreated = false; // Added this line
    }

    drawTitle() {
        background(0);
        fill(255);
        textSize(40);
        text("Spaceship Carnage",0, 50);
        text("Press any key to start", 0, 90);
    }

    drawTransition() {
        image(this.bg, 0, 0);
        this.spaceship.show(); 
        this.bullets.forEach(bullet => {
            bullet.show();
            bullet.move();
        });
        this.enemyBullets.forEach(enemyBullet => {
            enemyBullet.show();
            enemyBullet.move();
        });
        this.powerUps.forEach(powerUp => {
            powerUp.show();
            powerUp.move();
        });
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            if (this.explosions[i].show()) {
                this.explosions.splice(i, 1);
            }
        }
        this.drawScore();
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(48);
        let waveText = "Vague " + this.wave;
        text(waveText, (width - textWidth(waveText)) / 2, height / 8);
    }

    drawGame() {
        image(this.bg, 0, 0);
        this.spaceship.show(); 
        this.bullets.forEach(bullet => {
            bullet.show();
            bullet.move();
        });
        this.enemies.forEach(enemy => {
            enemy.show();
            enemy.move();
        });
        this.enemyBullets.forEach(enemyBullet => {
            enemyBullet.show();
            enemyBullet.move();
        });
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            if (this.explosions[i].show()) {
                this.explosions.splice(i, 1);
            }
        }
        this.powerUps.forEach(powerUp => {
            powerUp.show();
            powerUp.move();
        });
    }

    drawGameOver() {
        image(this.bg, 0, 0);
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
        // Dessiner seulement les explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            if (this.explosions[i].show()) {
                this.explosions.splice(i, 1);
            }
        }
    }

    drawScore() {
        stroke(0);
        strokeWeight(5);
        fill(255);
        textSize(24);
        text("Score: " + this.score, width - 150, 25);
        let highScore = localStorage.getItem('highScore') || 0;
        text("Best: " + highScore, 5, 25);
    }


    checkSpaceshipCollisions() {
        // Check for collisions between the spaceship and all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            // If the spaceship collides with an enemy
            if (this.spaceship.collidesWith(this.enemies[i])) {
                // End the game and change the game state to "gameOver"
                this.gameOver = true;
                this.gameState = "gameOver";
                // Record the time when the game ends
                this.gameOverTime = millis();
                // Create a new explosion at the spaceship's position
                let explosion = new Explosion(this.spaceship.x, this.spaceship.y,this.spaceship.size, this.explosionImages);
                // Add the explosion to the list of explosions
                this.explosions.push(explosion);
                // Stop checking for collisions because the game is over
                break;
            }

            // If an enemy is marked for deletion, remove it from the list of enemies
            if (this.enemies[i].toDelete) {
                this.enemies.splice(i, 1);
            }
        }

        // Check for collisions between the spaceship and all enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {

            // Si le vaisseau spatial entre en collision avec une balle ennemie
            if (this.spaceship.collidesWith(this.enemyBullets[i])) {
                // End the game and change the game state to "gameOver"
                this.gameOver = true;
                this.gameState = "gameOver";
                // Record the time when the game ends
                this.gameOverTime = millis();
                // Create a new explosion at the spaceship's position
                let explosion = new Explosion(this.spaceship.x, this.spaceship.y, this.spaceship.size, this.explosionImages);
                // Add the explosion to the list of explosions
                this.explosions.push(explosion);
                break;
            }

            // Si la balle ennemie est hors de l'écran
            if (this.enemyBullets[i].offScreen()) {
                this.enemyBullets.splice(i, 1);
            }
        }
    };
    checkBulletsCollisions() {
        // Check for collisions between all spaceship bullets and all enemies
        for (let i = this.bullets.length - 1; i >= 0; i--) { 
            // Parcourir tous les ennemis
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                // Si une balle touche un ennemi
                if (this.bullets[i].hits(this.enemies[j])) {
                    // Décrémenter la santé de l'ennemi
                    this.enemies[j].health--;
                    // Si l'ennemi est un boss, le faire clignoter
                    if (this.enemies[j] instanceof Boss) {
                        this.enemies[j].flashing = true;
                    }
                    // Si la santé de l'ennemi atteint 0, le détruire
                    if (this.enemies[j].health <= 0) {
                        this.enemies[j].destroy();
                        // Créer une explosion à la position de l'ennemi
                        let explosion = new Explosion(this.enemies[j].x, this.enemies[j].y, this.enemies[j].size, this.explosionImages);
                        // Ajouter l'explosion à la liste des explosions
                        this.explosions.push(explosion);
                        // Créer un power-up à la position de l'ennemi
                        let powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, "type", powerupImages[0]); 
                        // Ajouter le power-up à la liste des power-ups
                        this.powerUps.push(powerUp); 
                        // Augmenter le score
                        this.score += 5; 
                    }
                    // Détruire la balle
                    this.bullets[i].destroy();
                }
            }

            // Si la balle est hors de l'écran ou marquée pour suppression
            if (this.bullets[i].y < 0 || this.bullets[i].toDelete) {
                this.bullets.splice(i, 1);
            }
        }
    };

    checkPowerUpsCollisions() {
        // Parcourir tous les power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            // Si le vaisseau spatial entre en collision avec un power-up
            if (this.spaceship.collidesWith(this.powerUps[i])) {
                // Appliquer l'effet du power-up
               this.score += 20;

                // Supprimer le power-up
                this.powerUps.splice(i, 1);
            }
        }
    };

    checkCollisions() {
        this.checkSpaceshipCollisions();
        this.checkBulletsCollisions();
        this.checkPowerUpsCollisions();
    };

    manageGame() {
        // Si l'état du jeu est "title", dessine l'écran du titre
    if (this.gameState === "title") {
            this.drawTitle();
        }
        // Si l'état du jeu est "game", gère la logique du jeu
        else if (this.gameState === "game") {
            // Si les ennemis n'ont pas encore été créés pour cette vague, crée les ennemis
            if (!this.enemiesCreated) { 
                for (let i = 0; i < this.wave; i++) {
                    this.enemies.push(new Enemy(this.enemyImages, 64));
                }
                this.enemiesCreated = true; 
            }
            if (this.wave % 5 === 0) { 
                if (!this.bossCreated) {
                    let boss = new Boss(this.enemyImages, 64); // 64 est la taille de base d'un ennemi
                    boss.x = width / 2 - boss.size / 2; // Centrer le boss horizontalement
                    boss.y = height / 8; // Positionner le boss à un quart de la hauteur de l'écran
                    this.enemies.push(boss);
                    this.bossCreated = true; // Assurez-vous de ne créer le boss qu'une seule fois
                }
            }
            // Dessine le jeu, le score et vérifie les collisions
            this.drawGame();
            this.drawScore();
            this.checkCollisions();

            // Si le bouton de la souris est pressé et que le temps écoulé depuis le dernier tir est supérieur au taux de tir, tire une balle
            let currentTime = millis();
            if (mouseIsPressed && mouseButton === LEFT && currentTime - this.lastFireTime >= this.fireRate) {
                let bullet = new Bullet(this.spaceship.x + this.spaceship.size / 2, this.spaceship.y + this.spaceship.size / 2, 0, -1);
                this.bullets.push(bullet);
                this.lastFireTime = currentTime;
            }
            // Si tous les ennemis sont détruits, passe à l'état de transition et prépare la prochaine vague
            if (this.enemies.length === 0) {
                this.gameState = "transition";
                this.transitionTime = millis(); 
                this.wave++;
                this.enemiesCreated = false; 
                this.bossCreated = false; // Réinitialisez this.bossCreated à false ici
            }
        } else if (this.gameState === "transition") {
            this.drawTransition();
            this.checkSpaceshipCollisions();
            this.checkPowerUpsCollisions();
            // Move to game state after a certain delay
            if (millis() - this.transitionTime >= 2000) { // Changed from this.gameOverTime
                this.gameState = "game";
                // Si la vague est un multiple de 5, change l'image de fond
                if (this.wave % 5 === 0) { 
                    this.bg = random(this.bgImages);
                }  
            }
        } else if (this.gameState === "gameOver") {
            this.drawGameOver();
            // Dessiner seulement les explosions
            for (let i = this.explosions.length - 1; i >= 0; i--) {
                if (this.explosions[i].show()) {
                    this.explosions.splice(i, 1);
                }
            }
        }

        this.spaceship.x = constrain(mouseX - this.spaceship.size / 2, 0, width - this.spaceship.size);
        this.spaceship.y = constrain(mouseY - this.spaceship.size / 2, 0, height - this.spaceship.size);

        for (let i = 0; i < this.enemies.length; i++) {
            let enemyBullet = this.enemies[i].shoot();
            if (enemyBullet !== null) {
                this.enemyBullets.push(enemyBullet);
            }
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
            }
    
        }
    }

    handleMouseReleased() {
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
}
