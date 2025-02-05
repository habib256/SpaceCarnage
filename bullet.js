class Bullet {
    constructor(x, y, dx, dy) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 20;
        this.size = 8; // Change this.r to this.size
        this.toDelete = false;
    }

    show() {
        stroke(255); // Set stroke color to white
        strokeWeight(2); // Set stroke weight to 2
        fill(128, 0, 255);
        ellipse(this.x + this.size / 2, this.y + this.size / 2, this.size, this.size); // Adjust this line
    }

    move() {
        this.x += this.speed * this.dx;
        this.y += this.speed * this.dy;
    }

    hits(enemy) {
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
        if (d < this.size / 2 + enemy.size / 2) { // Adjust this line
            return true;
        } else {
            return false; 
        }
    }

    destroy() {
        this.toDelete = true;
    }

    offScreen() {
        return (this.y < 0 || this.y > height);
    }
}
