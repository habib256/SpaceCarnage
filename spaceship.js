class Spaceship {
    constructor(image, size) {
        this.image = image;
        this.size = size;
        this.x = 400;
        this.y = 530;
        this.speed = 10;
        this.xdir = 0;
        this.ydir = 0;
    }

    show() {
        image(this.image, this.x, this.y, this.size, this.size);
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

    collidesWith(other) {
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, other.x + other.size / 2, other.y + other.size / 2);
        return (d < this.size / 4 + other.size / 2);
    }
    stopFiring() {
        this.firing = false;
    }
}