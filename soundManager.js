/**
 * SoundManager : moteur audio 100% procédural basé sur la Web Audio API.
 *
 * Aucun fichier son n'est nécessaire : tous les bruitages et la musique
 * chiptune sont synthétisés à la volée (oscillateurs + bruit filtré).
 *
 * Le contexte audio est créé puis débloqué au premier geste de l'utilisateur
 * (clic, toucher ou touche) pour respecter les politiques d'autoplay des
 * navigateurs. La touche M coupe/rétablit le son, le choix est mémorisé
 * dans le localStorage.
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.sfxBus = null;
        this.musicBus = null;
        this.noiseBuffer = null;
        this.ready = false;

        this.masterVolume = 0.8;
        this.sfxVolume = 0.9;
        this.musicVolume = 0.3;
        this.muted = (localStorage.getItem('soundMuted') === 'true');

        // Séquenceur musical
        this.currentTrack = null;
        this.musicTimer = null;
        this.nextStepTime = 0;
        this.step = 0;
        this.lookAhead = 0.15;      // secondes planifiées à l'avance
        this.schedulerDelay = 30;   // période du scheduler en ms

        // Limitation du nombre de sons identiques joués coup sur coup
        this.lastPlayed = {};

        this.tracks = SoundManager.buildTracks();
    }

    /* ------------------------------------------------------------------ */
    /*  Initialisation / déblocage                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Crée le contexte audio et le graphe de mixage.
     * Appelée paresseusement : rien n'est instancié tant que le joueur
     * n'a pas interagi avec la page.
     */
    init() {
        if (this.ctx) return true;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            console.warn('Web Audio API indisponible : le jeu sera muet.');
            return false;
        }
        this.ctx = new AudioCtx();

        // Un compresseur en sortie évite la saturation quand plusieurs
        // explosions se déclenchent en même temps.
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 12;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;
        limiter.connect(this.ctx.destination);

        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.masterVolume;
        this.master.connect(limiter);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.master);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.master);

        this.noiseBuffer = this.createNoiseBuffer();
        this.ready = true;
        return true;
    }

    /**
     * À appeler depuis un gestionnaire d'événement utilisateur (clic, touche,
     * toucher) : crée le contexte si besoin et le réveille.
     */
    unlock() {
        if (!this.init()) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { /* ignoré : le navigateur réessaiera */ });
        }
        // Une piste demandée avant le déblocage démarre maintenant.
        if (this.currentTrack && !this.musicTimer) {
            this.startScheduler();
        }
    }

    createNoiseBuffer() {
        const length = Math.floor(this.ctx.sampleRate * 1.5);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /* ------------------------------------------------------------------ */
    /*  Réglages globaux                                                   */
    /* ------------------------------------------------------------------ */

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('soundMuted', this.muted);
        if (this.master) {
            const now = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(now);
            this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, now, 0.02);
        }
        if (!this.muted) this.unlock();
        return this.muted;
    }

    /** Met le moteur audio en veille (onglet caché, pause du jeu). */
    suspend() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
        }
    }

    /** Réveille le moteur audio après une pause. */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Briques de synthèse                                                */
    /* ------------------------------------------------------------------ */

    /** Convertit un numéro de note MIDI en fréquence (La3 = 69 = 440 Hz). */
    static midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Joue une note synthétisée.
     * @param {Object} o - freq, endFreq, type, duration, attack, gain, delay,
     *                     detune, bus (sfx|music), sweepType
     */
    tone(o) {
        if (!this.ready || this.muted) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.15;
        const peak = Math.max(0.0001, o.gain === undefined ? 0.3 : o.gain);
        const attack = Math.min(o.attack === undefined ? 0.005 : o.attack, duration * 0.5);

        const osc = ctx.createOscillator();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(Math.max(20, o.freq), start);
        if (o.endFreq && o.endFreq !== o.freq) {
            const target = Math.max(20, o.endFreq);
            if (o.sweepType === 'linear') {
                osc.frequency.linearRampToValueAtTime(target, start + duration);
            } else {
                osc.frequency.exponentialRampToValueAtTime(target, start + duration);
            }
        }
        if (o.detune) osc.detune.setValueAtTime(o.detune, start);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(peak, start + attack);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(env);
        env.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    /**
     * Joue une salve de bruit filtré (explosions, percussions, impacts).
     * @param {Object} o - duration, gain, filterFreq, endFilterFreq, filterType,
     *                     delay, q, bus
     */
    noise(o) {
        if (!this.ready || this.muted) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.2;
        const peak = Math.max(0.0001, o.gain === undefined ? 0.3 : o.gain);

        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        // Un point de départ aléatoire évite que deux salves sonnent identiques.
        const offset = Math.random() * (this.noiseBuffer.duration - duration - 0.01);

        const filter = ctx.createBiquadFilter();
        filter.type = o.filterType || 'lowpass';
        filter.Q.value = o.q === undefined ? 1 : o.q;
        filter.frequency.setValueAtTime(o.filterFreq || 2000, start);
        if (o.endFilterFreq) {
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(40, o.endFilterFreq), start + duration);
        }

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(peak, start + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        src.connect(filter);
        filter.connect(env);
        env.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
        src.start(start, Math.max(0, offset));
        src.stop(start + duration + 0.02);
    }

    /** Joue une petite mélodie : [{midi, dur, type, gain}] */
    jingle(notes, options = {}) {
        if (!this.ready || this.muted) return;
        let delay = options.delay || 0;
        notes.forEach(n => {
            if (n.midi !== null && n.midi !== undefined) {
                this.tone({
                    freq: SoundManager.midiToFreq(n.midi),
                    type: n.type || options.type || 'square',
                    duration: (n.dur || 0.12) * 0.95,
                    gain: n.gain || options.gain || 0.25,
                    delay: delay
                });
            }
            delay += (n.dur || 0.12);
        });
    }

    /** Évite qu'un même effet ne se déclenche trop souvent (anti-mitraillage). */
    throttle(key, minInterval) {
        if (!this.ready) return false;
        const now = this.ctx.currentTime;
        if (this.lastPlayed[key] !== undefined && now - this.lastPlayed[key] < minInterval) {
            return false;
        }
        this.lastPlayed[key] = now;
        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  Bruitages du jeu                                                   */
    /* ------------------------------------------------------------------ */

    /** Tir du joueur : "pew" descendant, plus riche en tir multiple. */
    playShoot(mode = 'single') {
        if (!this.throttle('shoot', 0.05)) return;
        const base = mode === 'triple' ? 1500 : (mode === 'double' ? 1300 : 1200);
        this.tone({ freq: base, endFreq: base / 5, type: 'square', duration: 0.11, gain: 0.16 });
        this.tone({ freq: base * 1.5, endFreq: base / 4, type: 'sawtooth', duration: 0.07, gain: 0.07 });
        if (mode !== 'single') {
            this.tone({ freq: base * 0.75, endFreq: base / 6, type: 'square', duration: 0.12, gain: 0.09, delay: 0.02 });
        }
    }

    /** Tir latéral : petit "twip" complémentaire. */
    playLateralShoot() {
        if (!this.throttle('lateral', 0.08)) return;
        this.tone({ freq: 900, endFreq: 300, type: 'triangle', duration: 0.09, gain: 0.1 });
    }

    /** Tir ennemi : plus grave et plus sourd que celui du joueur. */
    playEnemyShoot() {
        if (!this.throttle('enemyShoot', 0.07)) return;
        this.tone({ freq: 420, endFreq: 130, type: 'sawtooth', duration: 0.16, gain: 0.11 });
    }

    /** Tir du boss : version menaçante du tir ennemi. */
    playBossShoot() {
        if (!this.throttle('bossShoot', 0.09)) return;
        this.tone({ freq: 260, endFreq: 80, type: 'sawtooth', duration: 0.22, gain: 0.13 });
        this.noise({ duration: 0.12, gain: 0.06, filterFreq: 900, endFilterFreq: 200 });
    }

    /** Impact d'une balle sur un ennemi qui survit. */
    playHit() {
        if (!this.throttle('hit', 0.03)) return;
        this.noise({ duration: 0.07, gain: 0.16, filterFreq: 3500, endFilterFreq: 900, filterType: 'bandpass', q: 1.5 });
        this.tone({ freq: 320, endFreq: 160, type: 'square', duration: 0.06, gain: 0.08 });
    }

    /** Explosion d'un ennemi standard. */
    playExplosion() {
        if (!this.throttle('explosion', 0.04)) return;
        this.noise({ duration: 0.45, gain: 0.35, filterFreq: 2400, endFilterFreq: 120 });
        this.tone({ freq: 180, endFreq: 40, type: 'triangle', duration: 0.4, gain: 0.22 });
    }

    /** Explosion d'un boss : plus longue, plus lourde, avec une réplique. */
    playBossExplosion() {
        this.noise({ duration: 0.9, gain: 0.42, filterFreq: 1800, endFilterFreq: 60 });
        this.tone({ freq: 120, endFreq: 30, type: 'triangle', duration: 0.85, gain: 0.3 });
        this.noise({ duration: 0.5, gain: 0.25, filterFreq: 1200, endFilterFreq: 80, delay: 0.28 });
        this.tone({ freq: 90, endFreq: 28, type: 'sine', duration: 0.6, gain: 0.22, delay: 0.32 });
    }

    /** Le vaisseau du joueur est touché : explosion + descente dramatique. */
    playPlayerHit() {
        this.noise({ duration: 0.7, gain: 0.4, filterFreq: 2000, endFilterFreq: 80 });
        this.tone({ freq: 400, endFreq: 45, type: 'sawtooth', duration: 0.7, gain: 0.28 });
        this.tone({ freq: 200, endFreq: 30, type: 'square', duration: 0.5, gain: 0.16, delay: 0.05 });
    }

    /** Balle renvoyée par le bouclier : ricochet métallique. */
    playShieldBounce() {
        if (!this.throttle('bounce', 0.04)) return;
        this.tone({ freq: 1800, endFreq: 2600, type: 'sine', duration: 0.09, gain: 0.16, sweepType: 'linear' });
        this.tone({ freq: 2700, endFreq: 1400, type: 'triangle', duration: 0.14, gain: 0.1, delay: 0.02 });
    }

    /** Un power-up vient d'apparaître à l'écran. */
    playPowerUpDrop() {
        if (!this.throttle('drop', 0.1)) return;
        this.tone({ freq: 700, endFreq: 1400, type: 'triangle', duration: 0.12, gain: 0.1, sweepType: 'linear' });
    }

    /** Ramassage d'un power-up : chaque type a sa signature sonore. */
    playPowerUp(type) {
        switch (type) {
            case 'shield':
                this.tone({ freq: 300, endFreq: 900, type: 'sine', duration: 0.35, gain: 0.22, attack: 0.05, sweepType: 'linear' });
                this.tone({ freq: 600, endFreq: 1200, type: 'triangle', duration: 0.4, gain: 0.12, delay: 0.05 });
                break;
            case 'extraLife':
                this.jingle([
                    { midi: 72, dur: 0.1 }, { midi: 76, dur: 0.1 },
                    { midi: 79, dur: 0.1 }, { midi: 84, dur: 0.26 }
                ], { type: 'square', gain: 0.24 });
                break;
            case 'pointsMultiplier':
                this.jingle([
                    { midi: 79, dur: 0.08 }, { midi: 83, dur: 0.08 }, { midi: 86, dur: 0.2 }
                ], { type: 'triangle', gain: 0.22 });
                break;
            case 'doubleShot':
                this.jingle([{ midi: 71, dur: 0.09 }, { midi: 78, dur: 0.18 }], { type: 'square', gain: 0.2 });
                break;
            case 'tripleShot':
                this.jingle([
                    { midi: 71, dur: 0.07 }, { midi: 76, dur: 0.07 }, { midi: 80, dur: 0.2 }
                ], { type: 'square', gain: 0.2 });
                break;
            case 'lateralShoot':
                this.jingle([{ midi: 74, dur: 0.08 }, { midi: 69, dur: 0.08 }, { midi: 81, dur: 0.2 }], { type: 'square', gain: 0.2 });
                break;
            case 'skull':
                // Bonus maléfique : glissando descendant dissonant.
                this.tone({ freq: 500, endFreq: 70, type: 'sawtooth', duration: 0.6, gain: 0.26 });
                this.tone({ freq: 353, endFreq: 50, type: 'square', duration: 0.6, gain: 0.18, delay: 0.03 });
                this.noise({ duration: 0.4, gain: 0.14, filterFreq: 1200, endFilterFreq: 100, delay: 0.1 });
                break;
            default:
                this.tone({ freq: 660, endFreq: 990, type: 'square', duration: 0.18, gain: 0.2, sweepType: 'linear' });
        }
    }

    /** Collision avec un astéroïde du mode bonus. */
    playAsteroidCrash() {
        this.noise({ duration: 0.5, gain: 0.35, filterFreq: 1200, endFilterFreq: 70 });
        this.tone({ freq: 150, endFreq: 35, type: 'square', duration: 0.45, gain: 0.2 });
    }

    /** Fanfare de fin de vague. */
    playWaveClear() {
        this.jingle([
            { midi: 67, dur: 0.11 }, { midi: 71, dur: 0.11 },
            { midi: 74, dur: 0.11 }, { midi: 79, dur: 0.3 }
        ], { type: 'square', gain: 0.22 });
    }

    /** Un boss entre en scène. */
    playBossWarning() {
        this.jingle([
            { midi: 41, dur: 0.22, type: 'sawtooth' }, { midi: 42, dur: 0.22, type: 'sawtooth' },
            { midi: 41, dur: 0.22, type: 'sawtooth' }, { midi: 47, dur: 0.45, type: 'sawtooth' }
        ], { gain: 0.26 });
    }

    /** Thème de game over. */
    playGameOver() {
        this.jingle([
            { midi: 64, dur: 0.2 }, { midi: 61, dur: 0.2 },
            { midi: 57, dur: 0.2 }, { midi: 52, dur: 0.75 }
        ], { type: 'triangle', gain: 0.3 });
        this.tone({ freq: 120, endFreq: 40, type: 'sawtooth', duration: 1.2, gain: 0.16, delay: 0.6 });
    }

    /** Démarrage d'une partie. */
    playStart() {
        this.jingle([
            { midi: 60, dur: 0.09 }, { midi: 67, dur: 0.09 },
            { midi: 72, dur: 0.09 }, { midi: 79, dur: 0.22 }
        ], { type: 'square', gain: 0.22 });
    }

    /** Entrée dans le mode bonus astéroïdes. */
    playBonusStart() {
        this.jingle([
            { midi: 65, dur: 0.08 }, { midi: 69, dur: 0.08 }, { midi: 72, dur: 0.08 },
            { midi: 77, dur: 0.08 }, { midi: 81, dur: 0.25 }
        ], { type: 'triangle', gain: 0.24 });
    }

    /* ------------------------------------------------------------------ */
    /*  Musique chiptune séquencée                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Définition des pistes. Chaque piste est une boucle de 16 pas contenant
     * une ligne de basse, une ligne mélodique et une trame rythmique.
     * Les valeurs sont des numéros de note MIDI (null = silence).
     */
    static buildTracks() {
        return {
            title: {
                bpm: 88,
                bass: [45, null, null, null, 43, null, null, null,
                       41, null, null, null, 40, null, null, null],
                lead: [69, null, 72, null, 76, null, 72, null,
                       71, null, 74, null, 76, null, null, null],
                leadType: 'triangle',
                kick: [], hat: []
            },
            game: {
                bpm: 132,
                bass: [33, 33, 45, 33, 36, 36, 48, 36,
                       31, 31, 43, 31, 38, 38, 50, 45],
                lead: [69, 72, 76, 72, 74, 77, 81, 77,
                       67, 71, 74, 71, 69, 74, 81, 76],
                leadType: 'square',
                kick: [0, 4, 8, 12],
                hat: [2, 6, 10, 14]
            },
            boss: {
                bpm: 148,
                bass: [29, 29, 30, 29, 29, 35, 34, 29,
                       29, 29, 30, 29, 36, 35, 34, 33],
                lead: [65, null, 66, null, 65, null, 71, 70,
                       65, null, 66, null, 72, 71, 70, 69],
                leadType: 'sawtooth',
                kick: [0, 3, 6, 8, 11, 14],
                hat: [2, 4, 10, 12]
            },
            bonus: {
                bpm: 120,
                bass: [36, 36, 43, 36, 41, 41, 48, 41,
                       38, 38, 45, 38, 43, 43, 50, 43],
                lead: [72, 76, 79, 76, 77, 81, 84, 81,
                       74, 77, 81, 77, 79, 83, 86, 83],
                leadType: 'triangle',
                kick: [0, 4, 8, 12],
                hat: [2, 6, 10, 14]
            }
        };
    }

    /**
     * Change la piste jouée en boucle. `null` coupe la musique.
     * Appelable avant le déblocage audio : la piste démarrera alors toute
     * seule au premier geste de l'utilisateur.
     */
    setMusic(name) {
        if (name === this.currentTrack) return;
        this.currentTrack = name && this.tracks[name] ? name : null;
        this.step = 0;
        this.stopScheduler();
        if (this.currentTrack && this.ready) {
            this.startScheduler();
        }
    }

    startScheduler() {
        if (!this.ready || !this.currentTrack || this.musicTimer) return;
        this.nextStepTime = this.ctx.currentTime + 0.06;
        this.musicTimer = setInterval(() => this.scheduleMusic(), this.schedulerDelay);
    }

    stopScheduler() {
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }

    /** Planifie à l'avance les pas de la boucle musicale. */
    scheduleMusic() {
        if (!this.ready || !this.currentTrack) return;
        if (this.ctx.state !== 'running') return;
        const track = this.tracks[this.currentTrack];
        const stepDuration = 60 / track.bpm / 2; // double croches

        // Après une suspension (onglet caché, pause), l'horloge a pris de
        // l'avance : on se recale au lieu de rattraper tous les pas manqués.
        if (this.nextStepTime < this.ctx.currentTime) {
            this.nextStepTime = this.ctx.currentTime;
        }

        while (this.nextStepTime < this.ctx.currentTime + this.lookAhead) {
            this.playMusicStep(track, this.step, this.nextStepTime - this.ctx.currentTime);
            this.nextStepTime += stepDuration;
            this.step = (this.step + 1) % track.bass.length;
        }
    }

    playMusicStep(track, step, delay) {
        const stepDuration = 60 / track.bpm / 2;

        const bassNote = track.bass[step];
        if (bassNote !== null && bassNote !== undefined) {
            this.tone({
                freq: SoundManager.midiToFreq(bassNote),
                type: 'square',
                duration: stepDuration * 0.85,
                gain: 0.3,
                delay: delay,
                bus: 'music'
            });
        }

        const leadNote = track.lead[step];
        if (leadNote !== null && leadNote !== undefined) {
            this.tone({
                freq: SoundManager.midiToFreq(leadNote),
                type: track.leadType || 'square',
                duration: stepDuration * 0.7,
                gain: 0.16,
                delay: delay,
                bus: 'music'
            });
        }

        if (track.kick && track.kick.includes(step)) {
            this.tone({
                freq: 150, endFreq: 45, type: 'sine',
                duration: 0.14, gain: 0.5, delay: delay, bus: 'music'
            });
        }
        if (track.hat && track.hat.includes(step)) {
            this.noise({
                duration: 0.05, gain: 0.1, filterFreq: 7000,
                filterType: 'highpass', delay: delay, bus: 'music'
            });
        }
    }
}
