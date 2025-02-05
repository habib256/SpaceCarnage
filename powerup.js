class PowerUp {
    constructor(x, y, size, images) {
        this.x = x+32;
        this.y = y+32;
        this.size = size*2;
        this.images = images;
        this.type = this.getRandomType();
        console.log("Power-up créé de type :", this.type);
        this.image = this.getImageForType(this.type);
        this.duration = 5000; // Durée de 5 secondes pour les effets temporaires
    }

    getRandomType() {
        const types = ['shield', 'extraLife', 'pointsMultiplier', 'doubleShot', 'lateralShoot'];
        return types[Math.floor(Math.random() * types.length)];
    }

    getImageForType(type) {
        if (type === 'shield') {
            return this.images['shield'];  // Correction : utilisation de l'image associée au bouclier
        }
        if (this.images && this.images[type]) {
            console.log(`Image chargée pour ${type}`);
            return this.images[type];
        }
        console.warn(`Image non trouvée pour le power-up de type : ${type}`);
        return null;
    }

    show() {
        push();
        translate(this.x, this.y);
        imageMode(CENTER);
        let scaleFactor = (this.type === 'lateralShoot') ? 1.5 : 1;
        if (this.image) {
            image(this.image, 0, 0, this.size * scaleFactor, this.size * scaleFactor);
        } else {
            fill(255, 0, 255);
            noStroke();
            ellipse(0, 0, this.size * scaleFactor, this.size * scaleFactor);
            fill(0);
            textAlign(CENTER, CENTER);
            textSize(12);
            text(this.type, 0, 0);
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
        let d = dist(
            this.x + this.size / 2,
            this.y + this.size / 2,
            other.x + other.size / 2,
            other.y + other.size / 2
        );
        return (d < this.size / 2 + other.size / 2);
    }
}