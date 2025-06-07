// Spaceship Carnage by gist974
let spaceshipImages = [];
let enemyImages = [];
let bgImages = [];
let explosionImages = [];
let powerupImages = [];
let gameManager;
let coinImage;
let dollarImage;
let titleImage; // Added this line

function preload() {
    loadSpaceShipImages();
    loadBackgroundImages();
    loadEnemyImages();
    loadExplosionImage();
    loadPowerupImage();
    titleImage = loadImage('images/Title.png'); // Load title image
}

function setup() {
    createCanvas(min(windowWidth-25, 1024), min(windowHeight-25, 1024));
    gameManager = new GameManager(spaceshipImages, enemyImages, bgImages, explosionImages, powerupImages, titleImage); // Added titleImage as an argument
    noCursor();
    frameRate(30); // Définit la vitesse d'affichage à 30 fps
    if (isMobileDevice()) {
        // Ajoutez un écouteur d'événements pour le toucher ou le clic pour passer en plein écran
        document.body.addEventListener('touchstart', goFullScreen);
        document.body.addEventListener('click', goFullScreen);
    }
}

function draw() {
    if (gameManager.isRunning)
        gameManager.manageGame();
}

function touchStarted() {
    gameManager.handleTouchPressed();
}

function touchEnded() {
    gameManager.handleTouchReleased();
}

function mousePressed() {
    gameManager.handleMousePressed();
}

function keyPressed() {
    if (gameManager) {
        gameManager.handleKeyPressed();
    }
}

function windowResized() {
    resizeCanvas(min(windowWidth-25, 1024), min(windowHeight-25, 1024));
}
function loadSpaceShipImages() {
    for (let i = 0; i <= 2; i++) {
        let spaceshipImage = loadImage(`images/SpaceShip${String(i).padStart(2, '0')}.png`);
        spaceshipImages.push(spaceshipImage);
    }
}
function loadBackgroundImages() {
    for (let i = 0; i <= 7; i++) {
        let bgImage = loadImage(`images/Background${String(i).padStart(2, '0')}.png`);
        bgImages.push(bgImage);
    }
}

function loadEnemyImages() {
    for (let i = 0; i <= 9; i++) {
        let enemyImage = loadImage(`images/Enemy${String(i).padStart(2, '0')}.png`);
        enemyImages.push(enemyImage);
    }
}
function loadExplosionImage() {
    loadImage('images/Explosion.png', (spriteSheet) => {
       let spriteWidth = spriteSheet.width / 4;
        let spriteHeight = spriteSheet.height/ 4;

        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                let img = spriteSheet.get(x * spriteWidth, y * spriteHeight, spriteWidth, spriteHeight);
                explosionImages.push(img);
            }
        }
    });
}

function loadPowerupImage() {
    powerupImages = {};
    powerupImages.shield = loadImage(
        'images/PowerUp02.png', 
        () => { console.log('Image shield chargée avec succès'); }, 
        () => { console.error('Erreur lors du chargement de l\'image shield'); }
    );
    powerupImages.extraLife = loadImage(
        'images/PowerUp05.png', 
        () => { console.log('Image extraLife chargée avec succès'); },
        () => { console.error('Erreur lors du chargement de l\'image extraLife'); }
    );
    powerupImages.pointsMultiplier = loadImage(
        'images/PowerUp00.png', 
        () => { console.log('Image pointsMultiplier chargée avec succès'); },
        () => { console.error('Erreur lors du chargement de l\'image pointsMultiplier'); }
    );
    powerupImages.doubleShot = loadImage(
        'images/PowerUp03.png', 
        () => { console.log('Image doubleShot chargée avec succès'); },
        () => { console.error('Erreur lors du chargement de l\'image doubleShot'); }
    );
    powerupImages.lateralShoot = loadImage(
        'images/PowerUp04.png', 
        () => { console.log('Image lateralShoot chargée avec succès'); },
        () => { console.error('Erreur lors du chargement de l\'image lateralShoot'); }
    );
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function goFullScreen() {
    let doc = window.document;
    let docEl = doc.documentElement;

    let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    }
}

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Mettre le jeu en pause
        gameManager.pauseGame();
    } else {
        // Reprendre le jeu
        gameManager.resumeGame();
        // Repasser en plein écran si on est sur mobile
        if (isMobileDevice()) {
            goFullScreen();
        }
    }
});