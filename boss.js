class Boss extends Enemy {
    constructor(images, size) {
        super(images, size *2); // Le boss est deux fois plus grand
        this.health = 5; // Les boss ont 5 points de vie
        this.flashing = false;
        this.flashDuration = 6; // Durée du clignotement en frames
        this.flashCounter = 0;
        this.angle = 0; // Angle initial pour le tir rotatif
        this.fireRate = 400;
    }

    shoot() {
        const currentTime = millis();
        if (currentTime - this.lastFireTime >= this.fireRate) {
            // Calculer la position de départ de la balle en fonction de l'angle du tir
            const bulletX = this.x + this.size / 2 + Math.cos(this.angle) * this.size / 2;
            const bulletY = this.y + this.size / 2 + Math.sin(this.angle) * this.size / 2;
            // Calculer la direction de la balle en fonction de l'angle
            const dx = Math.cos(this.angle);
            const dy = Math.sin(this.angle);
            const bullet = new Bullet(bulletX, bulletY, dx, dy);
            
            // Ralentir la vitesse de déplacement de la balle (divise par 8 au lieu de 4)
            bullet.speed = bullet.speed ? bullet.speed / 8 : 4;
            
            this.angle += Math.PI / 8;
            this.lastFireTime = millis();
            return bullet;
        }
        return null;
    }

    move() {
        // Enregistrer la position initiale
        const previousX = this.x;
        const previousY = this.y;

        // Appeler la méthode move() de la classe parente pour appliquer la logique de déplacement standard
        if (typeof super.move === "function") {
            super.move();
        }

        // Ajuster le déplacement en ramenant la variation de position à la moitié
        this.x = previousX + (this.x - previousX) * 0.5;
        this.y = previousY + (this.y - previousY) * 0.5;
    }

    show() {
        if (!this.flashing || this.flashCounter % 2 === 0) {
            // Afficher le boss seulement si il ne clignote pas ou si le compteur de clignotement est pair
            super.show();
        }
        if (this.flashing) {
            this.flashCounter++;
            if (this.flashCounter > this.flashDuration) {
                // Arrêter le clignotement après flashDuration frames
                this.flashing = false;
                this.flashCounter = 0;
            }
        }
    }
}

// Exemple de fonction appelée quand un ennemi est détruit
function enemyDestroyed(enemy) {
    // Probabilité de 20% pour déposer un power-up au lieu de 40%
    if (random(1) < 0.2) {
        // Créer un power-up à la position de l'ennemi
        let powerUp = new PowerUp(enemy.x, enemy.y, enemy.size, powerupImages);
        gameManager.powerUps.push(powerUp);
    }
    
    // Autres traitements lors de la destruction de l'ennemi...
}
