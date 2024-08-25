class Spaceship {
    constructor(image, size) {
        this.image = image;
        this.size = size;
        this.x = 400;
        this.y = 530;
        this.speed = 10;
        this.xdir = 0;
        this.ydir = 0;
        this.lives = 3; // Added this line
    }

    show() {
        image(this.image, this.x, this.y, this.size, this.size);
        if (this.shieldActive) {
            noFill();
            stroke(0, 255, 255);
            ellipse(this.x + this.size/2, this.y + this.size/2, this.size * 1.2);
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

    collidesWith(other) {
        if (this.shieldActive) return false;
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, other.x + other.size / 2, other.y + other.size / 2);
        return (d < this.size / 4 + other.size / 2);
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

    activateShield(duration) {
        this.shieldActive = true;
        setTimeout(() => this.shieldActive = false, duration);
    }
}