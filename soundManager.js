/**
 * SoundManager : moteur audio 100% procédural basé sur la Web Audio API.
 *
 * Aucun fichier son n'est nécessaire : tous les bruitages et la musique
 * chiptune sont synthétisés à la volée (oscillateurs, synthèse FM, bruit
 * filtré, distorsion et réverbération générée).
 *
 * Chaîne de mixage :
 *   voix --> [filtre] --> enveloppe --> panoramique --> bus (sfx | music)
 *                                              \--> départ réverbération
 *   bus --> master --> compresseur --> sortie
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
        this.reverbBus = null;
        this.noiseBuffer = null;
        this.gritCurve = null;
        this.ready = false;

        this.masterVolume = 0.8;
        this.sfxVolume = 0.9;
        this.musicVolume = 0.3;
        this.reverbVolume = 0.5;
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

        // Budget de voix : au-delà, les nouvelles voix sont abandonnées afin
        // de protéger le frame rate lorsque l'écran s'embrase.
        this.voices = 0;
        this.maxVoices = 80;

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
        this.gritCurve = SoundManager.createDistortionCurve(12);
        this.buildReverb();

        this.ready = true;
        return true;
    }

    /**
     * Réverbération « spatiale » : un convolueur alimenté par une réponse
     * impulsionnelle de bruit décroissant, générée à la volée. Elle donne aux
     * explosions et aux bonus la profondeur d'une salle d'arcade.
     */
    buildReverb() {
        const ctx = this.ctx;
        const duration = 1.8;
        const length = Math.floor(ctx.sampleRate * duration);
        const ir = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = ir.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2.6);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }

        const convolver = ctx.createConvolver();
        convolver.buffer = ir;

        // Un passe-bas adoucit la queue de réverbération : elle reste
        // présente sans encombrer le haut du spectre où vivent les tirs.
        const tame = ctx.createBiquadFilter();
        tame.type = 'lowpass';
        tame.frequency.value = 3200;

        this.reverbBus = ctx.createGain();
        this.reverbBus.gain.value = this.reverbVolume;
        this.reverbBus.connect(convolver);
        convolver.connect(tame);
        tame.connect(this.master);
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
        const length = Math.floor(this.ctx.sampleRate * 2);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /** Courbe de saturation douce, utilisée pour donner du grain aux voix. */
    static createDistortionCurve(amount) {
        const samples = 1024;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
        }
        return curve;
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
    /*  Utilitaires de synthèse                                            */
    /* ------------------------------------------------------------------ */

    /** Convertit un numéro de note MIDI en fréquence (La3 = 69 = 440 Hz). */
    static midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /** Variation aléatoire de hauteur en centièmes de demi-ton. */
    static vary(freq, cents) {
        if (!cents) return freq;
        return freq * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200);
    }

    /**
     * Convertit une abscisse écran en position stéréo (-1 à gauche, +1 à
     * droite). L'amplitude est volontairement limitée pour éviter les sons
     * entièrement collés à une oreille au casque.
     */
    panFor(x) {
        if (typeof width !== 'number' || !width) return 0;
        const p = (x / width) * 2 - 1;
        return Math.max(-1, Math.min(1, p)) * 0.7;
    }

    /** Une voix peut-elle encore être allouée ? */
    canPlay() {
        return this.ready && !this.muted && this.voices < this.maxVoices;
    }

    /** Comptabilise une voix et libère le compteur à la fin du son. */
    trackVoice(source) {
        this.voices++;
        source.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    }

    /**
     * Construit la fin de chaîne commune à toutes les voix :
     * enveloppe d'amplitude, panoramique, envoi vers la réverbération.
     * @returns {GainNode} le nœud d'entrée auquel connecter la source
     */
    buildOutput(o, start, duration) {
        const ctx = this.ctx;
        const peak = Math.max(0.0001, o.gain === undefined ? 0.3 : o.gain);
        const attack = Math.min(o.attack === undefined ? 0.004 : o.attack, duration * 0.5);
        const hold = Math.min(o.hold || 0, Math.max(0, duration - attack - 0.01));

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(peak, start + attack);
        if (hold > 0) {
            env.gain.setValueAtTime(peak, start + attack + hold);
        }
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        let tail = env;
        if (o.pan && typeof ctx.createStereoPanner === 'function') {
            const panner = ctx.createStereoPanner();
            panner.pan.setValueAtTime(Math.max(-1, Math.min(1, o.pan)), start);
            env.connect(panner);
            tail = panner;
        }

        tail.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
        if (o.send && this.reverbBus) {
            const send = ctx.createGain();
            send.gain.value = o.send;
            tail.connect(send);
            send.connect(this.reverbBus);
        }
        return env;
    }

    /**
     * Joue une note synthétisée.
     * @param {Object} o - freq, endFreq, type, duration, attack, hold, gain,
     *                     delay, detune, vibrato, vibratoDepth, grit, filter,
     *                     filterFreq, endFilterFreq, q, pan, send, bus
     */
    tone(o) {
        if (!this.canPlay()) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.15;

        const osc = ctx.createOscillator();
        osc.type = o.type || 'square';
        const freq = Math.max(20, o.freq);
        osc.frequency.setValueAtTime(freq, start);
        if (o.endFreq && o.endFreq !== o.freq) {
            const target = Math.max(20, o.endFreq);
            if (o.sweepType === 'linear') {
                osc.frequency.linearRampToValueAtTime(target, start + duration);
            } else {
                osc.frequency.exponentialRampToValueAtTime(target, start + duration);
            }
        }
        if (o.detune) osc.detune.setValueAtTime(o.detune, start);

        let node = osc;

        // Vibrato : un LFO module la hauteur pour animer les sons tenus.
        let lfo = null;
        if (o.vibrato) {
            lfo = ctx.createOscillator();
            lfo.frequency.value = o.vibrato;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = o.vibratoDepth || 12;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.detune);
            lfo.start(start);
            lfo.stop(start + duration + 0.02);
        }

        // Saturation douce : ajoute des harmoniques et de l'épaisseur.
        if (o.grit) {
            const shaper = ctx.createWaveShaper();
            shaper.curve = this.gritCurve;
            const drive = ctx.createGain();
            drive.gain.value = o.grit;
            node.connect(drive);
            drive.connect(shaper);
            node = shaper;
        }

        // Filtre optionnel, avec balayage possible.
        if (o.filter) {
            const filter = ctx.createBiquadFilter();
            filter.type = o.filter;
            filter.Q.value = o.q === undefined ? 1 : o.q;
            filter.frequency.setValueAtTime(Math.max(40, o.filterFreq || 2000), start);
            if (o.endFilterFreq) {
                filter.frequency.exponentialRampToValueAtTime(
                    Math.max(40, o.endFilterFreq), start + duration);
            }
            node.connect(filter);
            node = filter;
        }

        const env = this.buildOutput(o, start, duration);
        node.connect(env);
        this.trackVoice(osc);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    /**
     * Synthèse FM : un oscillateur modulateur module la fréquence de la
     * porteuse. Des rapports non entiers donnent des timbres métalliques
     * (lasers, ricochets, impacts) impossibles à obtenir en soustractif.
     * @param {Object} o - freq, endFreq, ratio, index, endIndex, duration,
     *                     gain, type, delay, pan, send, grit
     */
    fm(o) {
        if (!this.canPlay()) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.15;
        const freq = Math.max(20, o.freq);
        const endFreq = Math.max(20, o.endFreq || o.freq);
        const ratio = o.ratio || 2;

        const carrier = ctx.createOscillator();
        carrier.type = o.type || 'sine';
        carrier.frequency.setValueAtTime(freq, start);
        carrier.frequency.exponentialRampToValueAtTime(endFreq, start + duration);

        const modulator = ctx.createOscillator();
        modulator.type = o.modType || 'sine';
        modulator.frequency.setValueAtTime(freq * ratio, start);
        modulator.frequency.exponentialRampToValueAtTime(endFreq * ratio, start + duration);

        // L'indice de modulation décroît : le son démarre brillant et
        // métallique puis s'adoucit, comme une percussion réelle.
        const modGain = ctx.createGain();
        const index = Math.max(1, o.index === undefined ? freq : o.index);
        modGain.gain.setValueAtTime(index, start);
        modGain.gain.exponentialRampToValueAtTime(
            Math.max(1, o.endIndex === undefined ? index * 0.05 : o.endIndex), start + duration);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        let node = carrier;
        if (o.grit) {
            const shaper = ctx.createWaveShaper();
            shaper.curve = this.gritCurve;
            const drive = ctx.createGain();
            drive.gain.value = o.grit;
            node.connect(drive);
            drive.connect(shaper);
            node = shaper;
        }

        const env = this.buildOutput(o, start, duration);
        node.connect(env);
        this.trackVoice(carrier);
        carrier.start(start);
        carrier.stop(start + duration + 0.02);
        modulator.start(start);
        modulator.stop(start + duration + 0.02);
    }

    /**
     * Joue une salve de bruit filtré (explosions, percussions, impacts).
     * @param {Object} o - duration, gain, filterFreq, endFilterFreq, filterType,
     *                     delay, q, attack, hold, pan, send, grit, bus
     */
    noise(o) {
        if (!this.canPlay()) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.2;

        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        // Un point de départ aléatoire évite que deux salves sonnent identiques.
        const offset = Math.random() * this.noiseBuffer.duration;
        if (o.playbackRate) src.playbackRate.value = o.playbackRate;

        const filter = ctx.createBiquadFilter();
        filter.type = o.filterType || 'lowpass';
        filter.Q.value = o.q === undefined ? 1 : o.q;
        filter.frequency.setValueAtTime(Math.max(40, o.filterFreq || 2000), start);
        if (o.endFilterFreq) {
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(40, o.endFilterFreq), start + duration);
        }

        let node = filter;
        src.connect(filter);
        if (o.grit) {
            const shaper = ctx.createWaveShaper();
            shaper.curve = this.gritCurve;
            const drive = ctx.createGain();
            drive.gain.value = o.grit;
            node.connect(drive);
            drive.connect(shaper);
            node = shaper;
        }

        const env = this.buildOutput(o, start, duration);
        node.connect(env);
        this.trackVoice(src);
        src.start(start, offset);
        src.stop(start + duration + 0.02);
    }

    /**
     * Éclats de débris : une poignée de micro-salves de bruit dispersées dans
     * le temps, qui prolongent une explosion de façon crédible.
     */
    debris(o) {
        const count = o.count || 5;
        for (let i = 0; i < count; i++) {
            this.noise({
                duration: 0.03 + Math.random() * 0.05,
                gain: (o.gain || 0.1) * (0.4 + Math.random() * 0.6),
                filterFreq: 1200 + Math.random() * 3500,
                endFilterFreq: 300,
                filterType: 'bandpass',
                q: 2.5,
                delay: (o.delay || 0) + Math.random() * (o.spread || 0.4),
                pan: (o.pan || 0) + (Math.random() * 0.5 - 0.25),
                send: o.send === undefined ? 0.2 : o.send
            });
        }
    }

    /** Joue une petite mélodie : [{midi, dur, type, gain}] */
    jingle(notes, options = {}) {
        if (!this.ready || this.muted) return;
        let delay = options.delay || 0;
        notes.forEach(n => {
            if (n.midi !== null && n.midi !== undefined) {
                const freq = SoundManager.midiToFreq(n.midi);
                this.tone({
                    freq: freq,
                    type: n.type || options.type || 'square',
                    duration: (n.dur || 0.12) * (options.legato || 0.95),
                    gain: n.gain || options.gain || 0.25,
                    delay: delay,
                    pan: options.pan,
                    send: options.send,
                    vibrato: options.vibrato,
                    vibratoDepth: options.vibratoDepth
                });
                // Doublure à l'octave, très discrète : elle donne du brillant
                // sans épaissir la note.
                if (options.shimmer) {
                    this.tone({
                        freq: freq * 2,
                        type: 'triangle',
                        duration: (n.dur || 0.12) * 0.8,
                        gain: (n.gain || options.gain || 0.25) * options.shimmer,
                        delay: delay + 0.005,
                        pan: options.pan,
                        send: options.send
                    });
                }
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

    /**
     * Tir du joueur : transitoire de bruit (le « claquement »), corps FM
     * métallique et queue harmonique descendante. La hauteur varie légèrement
     * à chaque tir pour éviter l'effet mitraillette monotone.
     */
    playShoot(mode = 'single', pan = 0) {
        if (!this.throttle('shoot', 0.045)) return;
        const base = SoundManager.vary(
            mode === 'triple' ? 1500 : (mode === 'double' ? 1350 : 1250), 45);

        // Claquement initial
        this.noise({
            duration: 0.035, gain: 0.14, filterFreq: 5000, endFilterFreq: 1800,
            filterType: 'highpass', pan: pan
        });
        // Corps FM : rapport non entier pour le côté « laser »
        this.fm({
            freq: base, endFreq: base * 0.18, ratio: 2.7,
            index: base * 1.4, endIndex: base * 0.05,
            duration: 0.11, gain: 0.26, hold: 0.012, pan: pan, send: 0.08
        });
        // Queue harmonique
        this.tone({
            freq: base * 0.5, endFreq: base * 0.12, type: 'square',
            duration: 0.13, gain: 0.15, pan: pan,
            filter: 'lowpass', filterFreq: 6000, endFilterFreq: 1200
        });

        if (mode === 'double' || mode === 'triple') {
            // Léger décalage : les projectiles supplémentaires s'entendent.
            this.tone({
                freq: base * 0.75, endFreq: base * 0.14, type: 'sawtooth',
                duration: 0.11, gain: 0.11, delay: 0.018, pan: pan,
                filter: 'lowpass', filterFreq: 4500, endFilterFreq: 900
            });
        }
        if (mode === 'triple') {
            this.tone({
                freq: base * 1.25, endFreq: base * 0.2, type: 'square',
                duration: 0.1, gain: 0.1, delay: 0.036, pan: pan
            });
        }
    }

    /** Tir latéral : petit « twip » aérien, écarté dans le champ stéréo. */
    playLateralShoot(pan = 0) {
        if (!this.throttle('lateral', 0.07)) return;
        const freq = SoundManager.vary(950, 60);
        this.fm({
            freq: freq, endFreq: freq * 0.3, ratio: 1.5, index: freq,
            duration: 0.09, gain: 0.17, hold: 0.01, pan: pan - 0.25, send: 0.1
        });
        this.fm({
            freq: freq, endFreq: freq * 0.3, ratio: 1.5, index: freq,
            duration: 0.09, gain: 0.17, hold: 0.01, delay: 0.01, pan: pan + 0.25, send: 0.1
        });
    }

    /**
     * Tir ennemi : plus grave et plus sale que celui du joueur, avec un
     * filtre résonant qui plonge pour un caractère « organique ».
     */
    playEnemyShoot(pan = 0) {
        if (!this.throttle('enemyShoot', 0.06)) return;
        const freq = SoundManager.vary(430, 70);
        this.tone({
            freq: freq, endFreq: freq * 0.28, type: 'sawtooth',
            duration: 0.18, gain: 0.16, hold: 0.02, grit: 1.5, pan: pan, send: 0.12,
            filter: 'lowpass', filterFreq: 2600, endFilterFreq: 300, q: 7
        });
        this.tone({
            freq: freq * 0.5, endFreq: freq * 0.16, type: 'square',
            duration: 0.16, gain: 0.08, pan: pan
        });
    }

    /** Tir du boss : masse sourde, deux dents de scie désaccordées et souffle. */
    playBossShoot(pan = 0) {
        if (!this.throttle('bossShoot', 0.08)) return;
        const freq = SoundManager.vary(250, 50);
        this.tone({
            freq: freq, endFreq: freq * 0.3, type: 'sawtooth', detune: -12,
            duration: 0.26, gain: 0.16, hold: 0.03, grit: 3, pan: pan, send: 0.07,
            filter: 'lowpass', filterFreq: 1800, endFilterFreq: 220, q: 5
        });
        this.tone({
            freq: freq, endFreq: freq * 0.3, type: 'sawtooth', detune: 14,
            duration: 0.26, gain: 0.13, pan: pan,
            filter: 'lowpass', filterFreq: 1400, endFilterFreq: 180
        });
        this.noise({
            duration: 0.16, gain: 0.06, filterFreq: 1100, endFilterFreq: 200,
            filterType: 'bandpass', q: 1.2, pan: pan
        });
    }

    /** Impact d'une balle sur un ennemi qui survit : court, sec, métallique. */
    playHit(pan = 0) {
        if (!this.throttle('hit', 0.025)) return;
        this.noise({
            duration: 0.08, gain: 0.32, filterFreq: 4200, endFilterFreq: 1100,
            filterType: 'bandpass', q: 2, pan: pan
        });
        this.fm({
            freq: SoundManager.vary(880, 120), endFreq: 300, ratio: 3.7,
            index: 900, endIndex: 30, duration: 0.11, gain: 0.28, hold: 0.012,
            pan: pan, send: 0.1
        });
    }

    /**
     * Explosion d'un ennemi : souffle filtré, coup de sub, grain saturé et
     * pluie de débris. Chaque explosion est légèrement différente.
     */
    playExplosion(pan = 0) {
        if (!this.throttle('explosion', 0.035)) return;
        // Souffle principal
        this.noise({
            duration: 0.5, gain: 0.38, filterFreq: 2800, endFilterFreq: 110,
            q: 1.4, attack: 0.002, pan: pan, send: 0.28
        });
        // Corps saturé qui donne le « punch »
        this.noise({
            duration: 0.22, gain: 0.16, filterFreq: 900, endFilterFreq: 250,
            filterType: 'bandpass', q: 0.9, grit: 6, pan: pan
        });
        // Coup de sub
        this.tone({
            freq: SoundManager.vary(190, 60), endFreq: 38, type: 'triangle',
            duration: 0.42, gain: 0.27, attack: 0.002, pan: pan, send: 0.15
        });
        this.debris({ gain: 0.1, spread: 0.35, delay: 0.06, pan: pan, send: 0.25 });
    }

    /** Explosion d'un boss : détonation en trois temps, longue et caverneuse. */
    playBossExplosion(pan = 0) {
        // Détonation initiale
        this.noise({
            duration: 1.0, gain: 0.4, filterFreq: 2200, endFilterFreq: 60,
            q: 1.2, attack: 0.002, pan: pan, send: 0.45
        });
        this.tone({
            freq: 130, endFreq: 28, type: 'triangle',
            duration: 0.9, gain: 0.3, attack: 0.002, pan: pan, send: 0.2
        });
        // Grondement saturé
        this.noise({
            duration: 0.7, gain: 0.14, filterFreq: 420, endFilterFreq: 90,
            filterType: 'lowpass', q: 4, grit: 9, pan: pan
        });
        // Répliques
        this.noise({
            duration: 0.55, gain: 0.24, filterFreq: 1500, endFilterFreq: 80,
            delay: 0.3, pan: pan - 0.2, send: 0.4
        });
        this.tone({
            freq: 95, endFreq: 26, type: 'sine',
            duration: 0.7, gain: 0.22, delay: 0.32, pan: pan, send: 0.25
        });
        this.noise({
            duration: 0.45, gain: 0.16, filterFreq: 900, endFilterFreq: 60,
            delay: 0.62, pan: pan + 0.2, send: 0.5
        });
        this.debris({ count: 9, gain: 0.11, spread: 0.9, delay: 0.1, pan: pan, send: 0.4 });
    }

    /**
     * Le vaisseau du joueur est touché : explosion doublée d'une alarme qui
     * s'effondre, pour que la perte de vie s'entende immédiatement.
     */
    playPlayerHit(pan = 0) {
        this.noise({
            duration: 0.75, gain: 0.36, filterFreq: 2400, endFilterFreq: 80,
            attack: 0.002, pan: pan, send: 0.35
        });
        // Chute d'alimentation : vibrato de plus en plus lent sur une scie
        this.tone({
            freq: 520, endFreq: 42, type: 'sawtooth', duration: 0.8, gain: 0.24,
            grit: 4, vibrato: 11, vibratoDepth: 45, pan: pan, send: 0.2,
            filter: 'lowpass', filterFreq: 3000, endFilterFreq: 260
        });
        this.tone({
            freq: 260, endFreq: 30, type: 'square', duration: 0.6, gain: 0.14,
            delay: 0.04, pan: pan
        });
        this.debris({ count: 7, gain: 0.09, spread: 0.5, delay: 0.08, pan: pan, send: 0.3 });
    }

    /** Balle renvoyée par le bouclier : ricochet cristallin et résonant. */
    playShieldBounce(pan = 0) {
        if (!this.throttle('bounce', 0.035)) return;
        const freq = SoundManager.vary(1900, 80);
        // Rapport inharmonique : le timbre « cloche » d'un champ de force
        this.fm({
            freq: freq, endFreq: freq * 1.35, ratio: 1.41,
            index: 1400, endIndex: 20, duration: 0.18, gain: 0.24, hold: 0.01,
            pan: pan, send: 0.35
        });
        this.tone({
            freq: freq * 1.5, endFreq: freq * 0.75, type: 'sine',
            duration: 0.22, gain: 0.11, delay: 0.02, pan: pan, send: 0.3
        });
    }

    /** Un power-up vient d'apparaître à l'écran : appel discret avec écho. */
    playPowerUpDrop(pan = 0) {
        if (!this.throttle('drop', 0.09)) return;
        this.tone({
            freq: 760, endFreq: 1450, type: 'triangle', duration: 0.11,
            gain: 0.13, sweepType: 'linear', pan: pan, send: 0.25
        });
        this.tone({
            freq: 1140, endFreq: 2100, type: 'sine', duration: 0.09,
            gain: 0.06, delay: 0.11, sweepType: 'linear', pan: pan, send: 0.3
        });
    }

    /** Ramassage d'un power-up : chaque type a sa signature sonore. */
    playPowerUp(type, pan = 0) {
        switch (type) {
            case 'shield':
                // Montée filtrée : le champ de force qui se referme
                this.tone({
                    freq: 280, endFreq: 1000, type: 'sawtooth', duration: 0.45,
                    gain: 0.16, attack: 0.06, sweepType: 'linear', pan: pan, send: 0.3,
                    filter: 'lowpass', filterFreq: 500, endFilterFreq: 5000, q: 9
                });
                this.fm({
                    freq: 620, endFreq: 1240, ratio: 1.41, index: 400, endIndex: 40,
                    duration: 0.5, gain: 0.1, delay: 0.06, pan: pan, send: 0.4
                });
                break;
            case 'extraLife':
                // Fanfare ascendante brillante : la récompense suprême
                this.jingle([
                    { midi: 72, dur: 0.09 }, { midi: 76, dur: 0.09 },
                    { midi: 79, dur: 0.09 }, { midi: 84, dur: 0.3 }
                ], { type: 'square', gain: 0.2, pan: pan, send: 0.3, shimmer: 0.35 });
                break;
            case 'pointsMultiplier':
                this.jingle([
                    { midi: 79, dur: 0.07 }, { midi: 83, dur: 0.07 },
                    { midi: 86, dur: 0.07 }, { midi: 91, dur: 0.22 }
                ], { type: 'triangle', gain: 0.19, pan: pan, send: 0.3, shimmer: 0.4 });
                break;
            case 'doubleShot':
                this.jingle([{ midi: 71, dur: 0.08 }, { midi: 78, dur: 0.2 }],
                    { type: 'square', gain: 0.18, pan: pan, send: 0.2, shimmer: 0.25 });
                break;
            case 'tripleShot':
                this.jingle([
                    { midi: 71, dur: 0.06 }, { midi: 76, dur: 0.06 }, { midi: 80, dur: 0.22 }
                ], { type: 'square', gain: 0.18, pan: pan, send: 0.2, shimmer: 0.3 });
                break;
            case 'lateralShoot':
                this.jingle([{ midi: 74, dur: 0.07 }, { midi: 69, dur: 0.07 }, { midi: 81, dur: 0.22 }],
                    { type: 'square', gain: 0.18, pan: pan, send: 0.25, shimmer: 0.25 });
                break;
            case 'skull':
                // Bonus maléfique : accord dissonant qui s'effondre
                this.tone({
                    freq: 480, endFreq: 62, type: 'sawtooth', duration: 0.7,
                    gain: 0.2, grit: 8, vibrato: 6, vibratoDepth: 60, pan: pan, send: 0.35,
                    filter: 'lowpass', filterFreq: 2600, endFilterFreq: 180, q: 6
                });
                // Triton : l'intervalle du diable, une quarte augmentée au-dessus
                this.tone({
                    freq: 678, endFreq: 88, type: 'square', duration: 0.7,
                    gain: 0.12, delay: 0.02, pan: pan, send: 0.3
                });
                this.noise({
                    duration: 0.5, gain: 0.12, filterFreq: 1400, endFilterFreq: 90,
                    delay: 0.08, pan: pan, send: 0.35
                });
                break;
            default:
                this.tone({
                    freq: 660, endFreq: 990, type: 'square', duration: 0.18,
                    gain: 0.18, sweepType: 'linear', pan: pan, send: 0.2
                });
        }
    }

    /** Collision avec un astéroïde : impact rocheux, mat et graveleux. */
    playAsteroidCrash(pan = 0) {
        this.noise({
            duration: 0.45, gain: 0.36, filterFreq: 1100, endFilterFreq: 70,
            q: 2, attack: 0.002, pan: pan, send: 0.3
        });
        this.noise({
            duration: 0.18, gain: 0.14, filterFreq: 320, endFilterFreq: 120,
            filterType: 'bandpass', q: 3, grit: 10, pan: pan
        });
        this.tone({
            freq: SoundManager.vary(160, 80), endFreq: 34, type: 'square',
            duration: 0.4, gain: 0.18, attack: 0.002, pan: pan
        });
        this.debris({ count: 6, gain: 0.09, spread: 0.4, delay: 0.05, pan: pan, send: 0.25 });
    }

    /** Fanfare de fin de vague : arpège majeur harmonisé à la quinte. */
    playWaveClear() {
        const notes = [
            { midi: 67, dur: 0.1 }, { midi: 71, dur: 0.1 },
            { midi: 74, dur: 0.1 }, { midi: 79, dur: 0.34 }
        ];
        this.jingle(notes, { type: 'square', gain: 0.18, send: 0.3, shimmer: 0.3, pan: -0.15 });
        // Seconde voix une quarte plus bas, très légèrement retardée
        this.jingle(notes.map(n => ({ midi: n.midi - 5, dur: n.dur })),
            { type: 'triangle', gain: 0.1, send: 0.3, delay: 0.02, pan: 0.15 });
    }

    /** Un boss entre en scène : sirène d'alerte saturée. */
    playBossWarning() {
        // Deux tons alternés, façon alarme de vaisseau
        for (let i = 0; i < 3; i++) {
            this.tone({
                freq: i % 2 === 0 ? 330 : 392, type: 'sawtooth', duration: 0.19,
                gain: 0.13, grit: 5, delay: i * 0.22, send: 0.3,
                vibrato: 7, vibratoDepth: 25, pan: i % 2 === 0 ? -0.3 : 0.3,
                filter: 'lowpass', filterFreq: 2200, q: 4
            });
        }
        // Grondement final montant : le boss est là
        this.tone({
            freq: 55, endFreq: 110, type: 'sawtooth', duration: 0.9, gain: 0.15,
            grit: 6, attack: 0.15, delay: 0.6, send: 0.35,
            filter: 'lowpass', filterFreq: 300, endFilterFreq: 1400, q: 6
        });
        this.noise({
            duration: 0.9, gain: 0.08, filterFreq: 200, endFilterFreq: 1200,
            filterType: 'bandpass', q: 1.5, attack: 0.2, delay: 0.6, send: 0.3
        });
    }

    /** Thème de game over : descente chromatique et effondrement final. */
    playGameOver() {
        this.jingle([
            { midi: 64, dur: 0.22 }, { midi: 61, dur: 0.22 }, { midi: 57, dur: 0.22 }
        ], { type: 'triangle', gain: 0.2, send: 0.35, shimmer: 0.2 });
        // Dernier accord mineur tenu
        [52, 55, 59].forEach((midi, i) => {
            this.tone({
                freq: SoundManager.midiToFreq(midi), type: 'triangle',
                duration: 1.0, gain: 0.11, hold: 0.25, delay: 0.66 + i * 0.01,
                send: 0.4, pan: (i - 1) * 0.3
            });
        });
        // Effondrement : la bande magnétique qui s'arrête
        this.tone({
            freq: 200, endFreq: 28, type: 'sawtooth', duration: 1.3, gain: 0.14,
            grit: 3, delay: 0.7, send: 0.3,
            filter: 'lowpass', filterFreq: 1800, endFilterFreq: 120
        });
    }

    /** Démarrage d'une partie : arpège ascendant avec écho. */
    playStart() {
        this.jingle([
            { midi: 60, dur: 0.08 }, { midi: 67, dur: 0.08 },
            { midi: 72, dur: 0.08 }, { midi: 79, dur: 0.26 }
        ], { type: 'square', gain: 0.19, send: 0.3, shimmer: 0.3 });
        this.tone({
            freq: SoundManager.midiToFreq(48), endFreq: SoundManager.midiToFreq(60),
            type: 'sawtooth', duration: 0.4, gain: 0.12, sweepType: 'linear',
            filter: 'lowpass', filterFreq: 400, endFilterFreq: 3000, q: 5
        });
    }

    /** Entrée dans le mode bonus astéroïdes : arpège bondissant. */
    playBonusStart() {
        this.jingle([
            { midi: 65, dur: 0.07 }, { midi: 69, dur: 0.07 }, { midi: 72, dur: 0.07 },
            { midi: 77, dur: 0.07 }, { midi: 81, dur: 0.28 }
        ], { type: 'triangle', gain: 0.2, send: 0.3, shimmer: 0.35 });
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
