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
        this.wave = 0;
        this.fireRate = 150; // 150 milliseconds = 0.1 seconds
        this.lastFireTime = 0;
        this.gameOverTime = 0; // Added this line
        this.transitionTime = 0; // Added this line
        this.enemiesCreated = false; // Added this line
        this.powerUps = []; // Added this line
        this.resetGame();
    }

    resetGame() {
        this.bullets = [];
        this.enemyBullets = []; // Added this line
        let spaceshipImage = random(this.spaceshipImages);
        this.spaceship = new Spaceship(spaceshipImage, 64);
        this.enemies = [];
        this.score = 0;
        this.keys = {};
        this.bg = random(this.bgImages);
        this.wave = 0;
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
            powerUp.rotate();
        });
    }

    drawGameOver() {
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

    checkCollisions() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.spaceship.collidesWith(this.enemies[i])) {
                this.gameOver = true;
                this.gameState = "gameOver";
                this.gameOverTime = millis(); // Added this line
                let explosion = new Explosion(this.spaceship.x, this.spaceship.y, this.explosionImages);
                this.explosions.push(explosion);
                break;
            }
        }
        for (let i = this.bullets.length - 1; i >= 0; i--) { 
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                if (this.bullets[i].hits(this.enemies[j])) {
                    this.bullets[i].destroy();
                    this.enemies[j].destroy();
                    // Create explosion
                    let explosion = new Explosion(this.enemies[j].x, this.enemies[j].y, this.explosionImages);
                    this.explosions.push(explosion);
                    // Create power-up
                    let powerUp = new PowerUp(this.enemies[j].x, this.enemies[j].y, "type", powerupImages[0]); // Added this line
                    this.powerUps.push(powerUp); // Added this line
                    // Increase score
                    this.score += 5; // Added score increment
                }
            }

            if (this.bullets[i].y < 0 || this.bullets[i].toDelete) {
                this.bullets.splice(i, 1);
            }
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {

            if (this.spaceship.collidesWith(this.enemies[i])) {
                this.gameOver = true;
                break;
            }

            if (this.enemies[i].toDelete) {
                this.enemies.splice(i, 1);
            }
        }
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {

            if (this.spaceship.collidesWith(this.enemyBullets[i])) {
                this.gameOver = true;
                this.gameState = "gameOver";
                this.gameOverTime = millis(); // Added this line
                let explosion = new Explosion(this.spaceship.x, this.spaceship.y, this.explosionImages);
                this.explosions.push(explosion);
                break;
            }

            if (this.enemyBullets[i].offScreen()) {
                this.enemyBullets.splice(i, 1);
            }
        }
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            if (this.spaceship.collidesWith(this.powerUps[i])) {
                // Apply power-up effect
               this.score += 20;

                // Remove power-up
                this.powerUps.splice(i, 1);
            }
        }
    }

    manageGame() {
        if (this.gameState === "title") {
            this.drawTitle();
        } else if (this.gameState === "game") {
            if (!this.enemiesCreated) { // Added this condition
                for (let i = 0; i < this.wave; i++) {
                    this.enemies.push(new Enemy(this.enemyImages, 64));
                }
                this.enemiesCreated = true; // Added this line
            }
            this.drawGame();
            this.drawScore();
            this.checkCollisions();
            let currentTime = millis();
            if (mouseIsPressed && mouseButton === LEFT && currentTime - this.lastFireTime >= this.fireRate) {
                let bullet = new Bullet(this.spaceship.x + this.spaceship.size / 2, this.spaceship.y + this.spaceship.size / 2, 0, -1);
                this.bullets.push(bullet);
                this.lastFireTime = currentTime;
            }
            if (this.enemies.length === 0) {
                this.gameState = "transition";
                this.transitionTime = millis(); 
                this.wave++;
                this.enemiesCreated = false; // Added this line
                this.powerUps = []; // Added this line
                if (this.wave % 5 === 0) { // Added this condition
                    this.bg = random(this.bgImages);
                }
            }
        } else if (this.gameState === "transition") {
            this.drawTransition();
            // Move to game state after a certain delay
            if (millis() - this.transitionTime >= 2000) { // Changed from this.gameOverTime
                this.gameState = "game";
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
            if (frameCount % floor(random(180, 500)) === 0) {
                let enemyBullet = new Bullet(this.enemies[i].x + this.enemies[i].size / 2, this.enemies[i].y + this.enemies[i].size / 2, 0, 1);
                this.enemyBullets.push(enemyBullet);
            }
        }
    }

    handleMousePressed() {
        if (mouseButton === LEFT) {
            if (this.gameState === "gameOver" && millis() - this.gameOverTime > 1000) { // Added this line
                this.resetGame();
                this.gameState = "game";
            }
            if (this.gameState === "title") {
                this.gameState = "game";
                } else if (this.gameState === "gameOver" && millis() - this.gameOverTime > 2000) {
                this.resetGame();
                this.gameState = "game";
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
            this.gameState = "game";  
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
