class Asteroid {
    constructor() {
        this.size = random(30, 80);
        this.x = random(this.size, width - this.size);
        this.y = -this.size;
        this.speed = random(3, 8);
    }

    show() {
        push();
        fill(120);
        noStroke();
        ellipse(this.x, this.y, this.size, this.size);
        pop();
    }

    move() {
        this.y += this.speed;
    }

    offScreen() {
        return this.y > height + this.size;
    }
}
