class Spaceship {
    constructor(image, size) {
        this.image = image;
        this.size = size;
        this.x = 400;
        this.y = 530;
        this.speed = 10;
        this.xdir = 0;
        this.ydir = 0;
        this.lives = 3;
        this.activeShield = false;    // Indique si le bouclier est actif
        this.shieldResistance = 0;    // Nombre de coups que le bouclier peut absorber
        this.pointsMultiplier = 1;    // Valeur par défaut
        this.normalSpeed = this.speed; // Pour retrouver la vitesse normale après un boost
        // Ajout d'une propriété pour stocker le timer du bouclier
        this.shieldTimeout = null;
    }

    show() {
        image(this.image, this.x, this.y, this.size, this.size);
        if (this.activeShield) {
            noFill();
            stroke(0, 255, 255);
            strokeWeight(3);
            // Calcul du facteur de pulsation : il oscille entre 0.95 et 1.05, créant un effet subtil
            let pulse = map(sin(frameCount * 0.1), -1, 1, 0.95, 1.05);
            let shieldDiameter = this.size * 1.2 * pulse;
            ellipse(this.x + this.size / 2, this.y + this.size / 2, shieldDiameter, shieldDiameter);
        }
    }

    move() {
        this.x += this.xdir * this.speed;
        this.y += this.ydir * this.speed;

        this.x = constrain(this.x, 0, width-this.size);
        this.y = constrain(this.y, 0, height-this.size);
    }

    moveUp() {
        this.ydir = -1;
    }

    moveDown() {
        this.ydir = 1;
    }

    moveRight() {
        this.xdir = 1;
    }

    moveLeft() {
        this.xdir = -1;
    }

    stopVerticalMovement() {
        this.ydir = 0;
    }

    stopHorizontalMovement() {
        this.xdir = 0;
    }

    /**
     * Méthode de détection de collision.
     *
     * Pour les power-ups, on agrandit la zone de détection.
     * Pour les autres objets, si le bouclier est actif et que l'objet n'est pas une balle,
     * la collision est ignorée. Ainsi, la collision avec une balle est toujours vérifiée,
     * ce qui permet de la faire rebondir via reflectBullet().
     */
    collidesWith(other) {
        // Si l'objet est un power-up, la zone de détection est agrandie de 50%
        if (other instanceof PowerUp) {
            let amplification = 1.5;
            let d = dist(
                this.x + this.size / 2,
                this.y + this.size / 2,
                other.x + other.size / 2,
                other.y + other.size / 2
            );
            return (d < (this.size / 4 + other.size / 2) * amplification);
        }
        // Si l'objet est une balle et que le bouclier est actif,
        // la collision se fait avec le cercle associé au bouclier.
        else if (other instanceof Bullet && this.activeShield) {
            let shieldRadius = (this.size * 1.2) / 2; // Le rayon du bouclier tel qu'affiché
            let d = dist(
                this.x + this.size / 2,
                this.y + this.size / 2,
                other.x + other.size / 2,
                other.y + other.size / 2
            );
            return (d < shieldRadius + other.size / 2);
        }
        // Pour les autres objets, si le bouclier est actif, on ignore la collision.
        else {
            if (this.activeShield) return false;
            let d = dist(
                this.x + this.size / 2,
                this.y + this.size / 2,
                other.x + other.size / 2,
                other.y + other.size / 2
            );
            return (d < this.size / 4 + other.size / 2);
        }
    }

    stopFiring() {
        this.firing = false;
    }

    enableDoubleShot(duration) {
        this.doubleShotEnabled = true;
        setTimeout(() => this.doubleShotEnabled = false, duration);
    }

    boostSpeed(duration) {
        this.speed = this.normalSpeed * 1.5;
        setTimeout(() => this.speed = this.normalSpeed, duration);
    }

    collectPowerUp(powerUp) {
        // Si le power-up provient d'un boss, multiplier les effets par 2
        const multiplier = (powerUp.fromBoss === true) ? 2 : 1;
        switch (powerUp.type) {
            case 'shield':
                // Le bouclier sera actif pendant 5000 ms (ou 10000 ms si issu d'un boss)
                this.activateShield(5000 * multiplier);
                break;
            case 'extraLife':
                // Ajoute une ou deux vies en fonction du multiplicateur
                this.lives += 1 * multiplier;
                break;
            case 'pointsMultiplier':
                // Le multiplicateur passe à 2 (ou 4 si bonus de boss)
                this.pointsMultiplier = 2 * multiplier;
                break;
            case 'doubleShot':
                // Active le double tir pour 5 secondes (5000 ms)
                this.doubleShotActive = true;
                setTimeout(() => {
                    this.doubleShotActive = false;
                }, 5000 * multiplier);
                break;
            case 'speedBoost':
                this.activateSpeedBoost(6000 * multiplier);
                break;
            default:
                console.warn(`Power-up inconnu : ${powerUp.type}`);
        }
    }

    takeDamage() {
        if (this.activeShield) {
            this.shieldResistance--;
            if (this.shieldResistance <= 0) {
                this.deactivateShield();
            }
        } else {
            this.lives--;
            // Ajouter ici la gestion de la défaite si nécessaire
        }
    }

    activateShield(duration) {
        if (this.activeShield) {
            // Si le bouclier est déjà actif, on réinitialise la résistance
            this.shieldResistance = 3;
            // On efface l'ancien timer
            clearTimeout(this.shieldTimeout);
        } else {
            this.activeShield = true;
            this.shieldResistance = 3; // Le bouclier absorbe 3 coups
        }
        // Lancer un nouveau timer pour désactiver le bouclier après 'duration' millisecondes
        this.shieldTimeout = setTimeout(() => {
            this.deactivateShield();
        }, duration);
    }

    deactivateShield() {
        this.activeShield = false;
        this.shieldResistance = 0;
        this.shieldTimeout = null;
    }

    activateSpeedBoost(duration) {
        this.speed = this.normalSpeed * 2;
        setTimeout(() => {
            this.speed = this.normalSpeed;
        }, duration);
    }

    activateDoubleShot(duration) {
        this.doubleShotActive = true;
        setTimeout(() => {
            this.doubleShotActive = false;
        }, duration);
    }

    /**
     * Méthode pour refléter une balle lorsque celle-ci entre en collision avec le bouclier.
     * La direction de la balle est inversée en fonction de sa position relative au vaisseau.
     */
    reflectBullet(bullet) {
        if (this.activeShield) {
            // Calcul du centre du bouclier (supposé centré sur le vaisseau)
            let centerX = this.x + this.size / 2;
            let centerY = this.y + this.size / 2;
            
            // Vecteur de collision : du centre du vaisseau vers la balle
            let vX = bullet.x - centerX;
            let vY = bullet.y - centerY;
            
            // Normalisation du vecteur (pour obtenir la normale n)
            let magnitude = Math.sqrt(vX * vX + vY * vY);
            if (magnitude === 0) {
                magnitude = 1; // éviter la division par zéro
            }
            let normalX = vX / magnitude;
            let normalY = vY / magnitude;
            
            // Calcul du produit scalaire entre la vitesse de la balle et le vecteur normal
            let dot = bullet.dx * normalX + bullet.dy * normalY;
            
            // Appliquer la formule de réflexion : v' = v - 2 * (v · n) * n
            bullet.dx = bullet.dx - 2 * dot * normalX;
            bullet.dy = bullet.dy - 2 * dot * normalY;
            
            // Ajuster la position de la balle pour la placer juste à l'extérieur du bouclier
            // On considère ici que le bouclier a un rayon approximatif de this.size * 1.2 / 2
            let shieldRadius = (this.size * 1.2) / 2;
            bullet.x = centerX + normalX * (shieldRadius + bullet.size);
            bullet.y = centerY + normalY * (shieldRadius + bullet.size);
            
            return true;
        }
        return false;
    }

    /**
     * Méthode pour tirer des balles.
     * Si le mode double tir est actif, deux balles sont créées avec un léger décalage horizontal.
     * Sinon, une seule balle est tirée normalement.
     */
    shoot() {
        const bullets = [];
        const centerX = this.x + this.size / 2;
        const centerY = this.y; // On tire depuis le haut du vaisseau
        if (this.doubleShotActive) {
            // Utilisez un offset plus grand pour que le décalage soit visible
            const offset = 15;
            const bulletLeft = new Bullet(centerX - offset, centerY, 0, -1);
            const bulletRight = new Bullet(centerX + offset, centerY, 0, -1);
            bullets.push(bulletLeft, bulletRight);
        } else {
            const bullet = new Bullet(centerX, centerY, 0, -1);
            bullets.push(bullet);
        }
        return bullets;
    }
}