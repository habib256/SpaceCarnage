class Explosion {
    constructor(x, y, explosionImages) {
        this.x = x;
        this.y = y;
        this.explosionImages = explosionImages;
        this.currentImageIndex = 0;
        this.frameCount = 0; // Added a frame counter
        this.frameRate = 3; // Change image every 5 frames
    }

    show() {
        if (this.currentImageIndex < this.explosionImages.length && this.explosionImages[this.currentImageIndex] instanceof p5.Image) {
            let img = this.explosionImages[this.currentImageIndex];
            image(img, this.x, this.y, img.width , img.height);
            this.frameCount++;
            if (this.frameCount >= this.frameRate) {
                this.currentImageIndex++;
                this.frameCount = 0;
            }
        } else {
            console.error('Image not loaded or not a p5.Image');
        }

        if (this.currentImageIndex >= this.explosionImages.length) {
            // The explosion animation is over
            return true;
        }
    }
}