class Boss extends Enemy {
    constructor(images, size) {
        super(images, size *2); // Le boss est deux fois plus grand
        this.angle = 0; // Angle initial pour le tir rotatif
        this.fireRate = 300;
    }

    shoot() {
        let currentTime = millis();
        if (currentTime - this.lastFireTime >= this.fireRate) {
           // Calculer la position de la balle en fonction de l'angle
            let bulletX = this.x + this.size / 2 + Math.cos(this.angle) * this.size / 2;
            let bulletY = this.y + this.size / 2 + Math.sin(this.angle) * this.size / 2;
            // Calculer la direction de la balle en fonction de l'angle
            let dx = Math.cos(this.angle);
            let dy = Math.sin(this.angle);
            let bullet = new Bullet(bulletX, bulletY, dx, dy);
            this.angle += Math.PI / 8;
            this.lastFireTime = millis();
            return bullet;
        }
        return null;
    }
}
