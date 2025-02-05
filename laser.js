class Laser extends Bullet {
    constructor(x, y, dx, dy) {
        super(x, y, dx, dy);
        // Définir une vitesse supérieure pour le laser
        this.speed = 30;
        // Le laser est plus fin pour rappeler un trait lumineux
        this.size = 4;
    }

    move() {
        // Le laser se déplace plus rapidement que la balle classique
        this.x += this.speed * this.dx;
        this.y += this.speed * this.dy;
    }

    show() {
        // Représentation du laser : un trait lumineux vert
        stroke(0, 255, 0);
        strokeWeight(4);
        // Dessiner une ligne indiquant la trajectoire du laser
        line(this.x, this.y, this.x - this.dx * 20, this.y - this.dy * 20);
    }
} 