class PowerUp {
    constructor(x, y, size, image) {
        this.x = x+32;
        this.y = y+32;
        this.size = size;
        this.image = image;
        this.rotation = 0;
    }

    show() {
        push();
        translate(this.x, this.y);
        //rotate(this.rotation);
        imageMode(CENTER);
        if (this.image.width > 0 && this.image.height > 0) {
            this.image.resize(this.size, 0);
            image(this.image, 0, 0);
        } else {
            console.log('Image not loaded');
        }
        pop();
        //this.rotation += 0.5; // Adjust this value to change the speed of rotation
    }


    offScreen() {
        return this.y > height; // Added this line
    }

    move() {
        this.y += 10; // Added this line
    }


    collidesWith(other) {
        let d = dist(this.x + this.size / 2, this.y + this.size / 2, other.x + other.size / 2, other.y + other.size / 2);
        return (d < this.size / 2 + other.size / 2);
    }
}