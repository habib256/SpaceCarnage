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
        let bullet = new Bullet(this.x + this.size / 2, this.y + this.size / 2, 1); // 1 makes the bullet go down
        return bullet;
    }
}