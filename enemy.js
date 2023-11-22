let enemyBullets = []; // Added enemy bullets list

class Enemy {
    constructor(images, size) {
        this.image = random(images); // Choose a random image from the array
        this.size = size;
        this.speed = 4;
        this.toDelete = false;
        this.xoff = random(1000);  // For Perlin noise
        this.yoff = random(1000);  // For Perlin noise
        this.x = map(noise(this.xoff), 0, 1, 0, width);
        this.y = map(noise(this.yoff), 0, 1, 0, 300); 
        this.fireRate = random(1500, 4000); // The fire rate will be a random number between 1500 and 4000 milliseconds
        this.lastFireTime = millis() - random(0, this.fireRate); // Ajoutez un décalage aléatoire à lastFireTime
    }

    show() {
        image(this.image, this.x, this.y, this.size, this.size);
    }

    move() {
        // Use Perlin noise to get new x and y coordinates
        this.x = map(noise(this.xoff), 0, 1, 0, width);
        this.y = map(noise(this.yoff), 0, 1, 0, 300); 

        // Constrain y value
        this.y = constrain(this.y, 0, height - 150); 

        // Increment xoff and yoff
        this.xoff += 0.01;
        this.yoff += 0.01;
    } 

    hits(spaceship) {
        let d = dist(this.x, this.y, spaceship.x, spaceship.y);
        if (d < this.size / 2 + spaceship.size / 2) {
            return true;
        } else {
            return false;
        }
    }

    collidesWith(other) {
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, other.x + other.size / 2, other.y + other.size / 2);
        return (d < this.size / 2 + other.size / 2);
    }

    destroy() {
        this.toDelete = true;
    }

    shoot() {
        let currentTime = millis();
        if (currentTime - this.lastFireTime >= this.fireRate) {
            let bullet = new Bullet(this.x + this.size / 2, this.y + this.size / 2, 0, 1);
            this.lastFireTime = currentTime;
            this.fireRate = random(1500, 4000); // Reset fireRate to a new random value
            return bullet;
        }
        return null;
    }
}
