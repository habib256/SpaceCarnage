class PowerUp {
    constructor(x, y, size, image) {
        this.x = x+32;
        this.y = y+32;
        this.size = size;
        this.image = image || null; // Utiliser null si l'image n'est pas définie
        this.type = this.getRandomType();
        this.duration = 5000; // Durée de 5 secondes pour les effets temporaires
    }

    getRandomType() {
        const types = ['doubleShot', 'speedBoost', 'shield', 'pointsMultiplier'];
        return random(types);
    }

    show() {
        push();
        translate(this.x, this.y);
        imageMode(CENTER);
        if (this.image && this.image.width > 0 && this.image.height > 0) {
            this.image.resize(this.size, 0);
            image(this.image, 0, 0);
        } else {
            // Dessinez un placeholder si l'image n'est pas chargée
            fill(255, 0, 255);
            noStroke();
            ellipse(0, 0, this.size, this.size);
        }
        pop();
    }


    offScreen() {
        return this.y > height; // Added this line
    }

    move() {
        this.y += 10; // Added this line
    }


    collidesWith(other) {
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, other.x + other.size / 2, other.y + this.size / 2);
        return (d < this.size / 2 + other.size / 2);
    }

    applyEffect(spaceship, gameManager) {
        switch(this.type) {
            case 'doubleShot':
                spaceship.enableDoubleShot(this.duration);
                break;
            case 'speedBoost':
                spaceship.boostSpeed(this.duration);
                break;
            case 'shield':
                spaceship.activateShield(this.duration);
                break;
            case 'pointsMultiplier':
                gameManager.activatePointsMultiplier(this.duration);
                break;
        }
    }
}