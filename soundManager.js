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
        this.crushCurve = null;
        this.ready = false;

        // Rotation de timbres sur le tir du joueur : trois variantes qui
        // alternent pour que la mitraille ne sonne jamais deux fois pareil.
        this.shotVariant = 0;

        this.masterVolume = 0.8;
        this.sfxVolume = 0.9;
        this.musicVolume = 0.3;
        this.reverbVolume = 0.5;
        this.muted = (localStorage.getItem('soundMuted') === 'true');

        // Séquenceur musical
        this.currentTrack = null;
        this.musicTimer = null;
        this.pendingMusic = null;   // changement de piste différé
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
        this.crushCurve = SoundManager.createCrushCurve(9);
        this.buildReverb();
        this.buildMusicEcho();
        this.buildPulseWaves();

        this.ready = true;
        return true;
    }

    /**
     * Écho musical synchronisé au tempo : la ligne de retard emblématique des
     * musiques de consoles 8 bits, où une seule voix de mélodie semble en
     * devenir deux. Il ne reçoit que la musique et repart dans le bus musical,
     * de sorte qu'il s'efface lui aussi sous le ducking des explosions.
     */
    buildMusicEcho() {
        const ctx = this.ctx;
        this.musicDelay = ctx.createDelay(1.5);
        this.musicDelay.delayTime.value = 0.24;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.34;

        // Chaque répétition est plus sourde que la précédente : les échos
        // s'éloignent au lieu de s'empiler dans les aigus.
        const damp = ctx.createBiquadFilter();
        damp.type = 'lowpass';
        damp.frequency.value = 2400;

        this.musicEchoBus = ctx.createGain();
        this.musicEchoBus.gain.value = 0.5;
        this.musicEchoBus.connect(this.musicDelay);
        this.musicDelay.connect(damp);
        damp.connect(feedback);
        feedback.connect(this.musicDelay);
        damp.connect(this.musicBus);
    }

    /**
     * Ondes carrées à rapport cyclique variable. La Web Audio API n'offre
     * qu'un carré 50 %, alors que le son des puces d'époque tient largement
     * aux impulsions étroites (12,5 % : nasillard et perçant ; 25 % : le
     * timbre de lead classique). On les fabrique par leur série de Fourier.
     */
    buildPulseWaves() {
        this.pulse12 = this.createPulseWave(0.125);
        this.pulse25 = this.createPulseWave(0.25);
        this.pulse33 = this.createPulseWave(0.33);
    }

    createPulseWave(duty, harmonics = 40) {
        const real = new Float32Array(harmonics + 1);
        const imag = new Float32Array(harmonics + 1);
        for (let n = 1; n <= harmonics; n++) {
            // Coefficient de Fourier d'une impulsion de rapport cyclique `duty`
            imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
        }
        return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
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

    /**
     * Courbe de quantification : elle réduit le signal à un nombre fixe de
     * paliers d'amplitude, exactement comme un convertisseur 8 bits. C'est le
     * craquement typique des bornes d'arcade.
     */
    static createCrushCurve(levels) {
        const samples = 2048;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = Math.round(x * levels) / levels;
        }
        return curve;
    }

    /**
     * Applique la mise en forme optionnelle du timbre à une voix :
     * saturation (`grit`), quantification 8 bits (`crush`) et modulation en
     * anneau (`ring`). Renvoie le dernier nœud de la chaîne.
     */
    shapeVoice(node, o, start, duration) {
        const ctx = this.ctx;
        if (o.grit) {
            const shaper = ctx.createWaveShaper();
            shaper.curve = this.gritCurve;
            const drive = ctx.createGain();
            drive.gain.value = o.grit;
            node.connect(drive);
            drive.connect(shaper);
            node = shaper;
        }
        if (o.crush) {
            const crusher = ctx.createWaveShaper();
            crusher.curve = this.crushCurve;
            crusher.oversample = 'none'; // l'aliasing fait partie du charme
            const drive = ctx.createGain();
            drive.gain.value = o.crush;
            node.connect(drive);
            drive.connect(crusher);
            node = crusher;
        }
        if (o.ring) {
            // Modulation en anneau : le signal est multiplié par une sinusoïde,
            // ce qui crée des partiels inharmoniques (timbres « extraterrestres »).
            const ringOsc = ctx.createOscillator();
            ringOsc.frequency.setValueAtTime(o.ring, start);
            if (o.endRing) {
                ringOsc.frequency.exponentialRampToValueAtTime(
                    Math.max(1, o.endRing), start + duration);
            }
            const ringGain = ctx.createGain();
            ringGain.gain.value = 0;
            node.connect(ringGain);
            ringOsc.connect(ringGain.gain);
            ringOsc.start(start);
            ringOsc.stop(start + duration + 0.02);
            node = ringGain;
        }
        return node;
    }

    /**
     * Abaisse brièvement la musique sous un événement marquant, comme le fait
     * un compresseur à chaîne latérale en production musicale. L'explosion
     * gagne la place qu'il lui faut sans qu'on touche à son volume.
     */
    duck(amount = 0.35, duration = 0.5) {
        if (!this.ready || this.muted || !this.musicBus) return;
        const now = this.ctx.currentTime;
        const gain = this.musicBus.gain;
        const floor = this.musicVolume * (1 - Math.max(0, Math.min(0.9, amount)));
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(floor, now + 0.025);
        gain.linearRampToValueAtTime(this.musicVolume, now + duration);
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

    /**
     * Une voix peut-elle encore être allouée ?
     * La musique dispose d'une réserve supplémentaire : une basse qui
     * disparaît au milieu d'une mesure s'entend bien plus qu'un débris
     * d'explosion en moins.
     * @param {boolean} isMusic - la voix appartient-elle au bus musical ?
     */
    canPlay(isMusic) {
        if (!this.ready || this.muted) return false;
        return this.voices < (isMusic ? this.maxVoices + 32 : this.maxVoices);
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
        if (o.echo && this.musicEchoBus) {
            const send = ctx.createGain();
            send.gain.value = o.echo;
            tail.connect(send);
            send.connect(this.musicEchoBus);
        }
        return env;
    }

    /**
     * Joue une note synthétisée.
     * @param {Object} o - freq, endFreq, type, wave, duration, attack, hold,
     *                     gain, delay, detune, vibrato, vibratoDepth, grit,
     *                     filter, filterFreq, endFilterFreq, q, pan, send,
     *                     echo, bus
     */
    tone(o) {
        if (!this.canPlay(o.bus === 'music')) return;
        const ctx = this.ctx;
        const start = ctx.currentTime + (o.delay || 0);
        const duration = o.duration || 0.15;

        const osc = ctx.createOscillator();
        // Une onde personnalisée (impulsion 12,5 % / 25 %) l'emporte sur le
        // type standard : c'est elle qui donne le timbre « puce sonore ».
        if (o.wave) {
            osc.setPeriodicWave(o.wave);
        } else {
            osc.type = o.type || 'square';
        }
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

        // Saturation, quantification 8 bits et modulation en anneau.
        node = this.shapeVoice(node, o, start, duration);

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
        if (!this.canPlay(o.bus === 'music')) return;
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

        const node = this.shapeVoice(carrier, o, start, duration);

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
        if (!this.canPlay(o.bus === 'music')) return;
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

        src.connect(filter);
        const node = this.shapeVoice(filter, o, start, duration);

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

        // Trois rapports de modulation qui alternent : le canon respire au
        // lieu de répéter mécaniquement le même timbre.
        const ratios = [2.7, 3.4, 1.9];
        const ratio = ratios[this.shotVariant % ratios.length];
        this.shotVariant++;

        // Claquement initial
        this.noise({
            duration: 0.035, gain: 0.14, filterFreq: 5000, endFilterFreq: 1800,
            filterType: 'highpass', pan: pan
        });
        // Corps FM : rapport non entier pour le côté « laser »
        this.fm({
            freq: base, endFreq: base * 0.18, ratio: ratio,
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
            filterType: 'bandpass', q: 2, crush: 1.4, pan: pan
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
        // La musique s'efface un instant pour laisser passer la détonation
        this.duck(0.3, 0.45);
        // Souffle principal, décorrélé à gauche et à droite pour l'ampleur
        this.noise({
            duration: 0.5, gain: 0.3, filterFreq: 2800, endFilterFreq: 110,
            q: 1.4, attack: 0.002, pan: pan - 0.3, send: 0.28
        });
        this.noise({
            duration: 0.46, gain: 0.3, filterFreq: 2500, endFilterFreq: 130,
            q: 1.4, attack: 0.002, pan: pan + 0.3, send: 0.28
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
        // Le thème du boss s'écrase sous la détonation, puis revient
        this.duck(0.6, 1.1);
        // Détonation initiale, élargie sur les deux canaux
        this.noise({
            duration: 1.0, gain: 0.32, filterFreq: 2200, endFilterFreq: 60,
            q: 1.2, attack: 0.002, pan: pan - 0.35, send: 0.45
        });
        this.noise({
            duration: 0.92, gain: 0.32, filterFreq: 1900, endFilterFreq: 70,
            q: 1.2, attack: 0.002, pan: pan + 0.35, send: 0.45
        });
        this.tone({
            freq: 130, endFreq: 28, type: 'triangle',
            duration: 0.9, gain: 0.3, attack: 0.002, pan: pan, send: 0.2
        });
        // Grondement saturé
        this.noise({
            duration: 0.7, gain: 0.14, filterFreq: 420, endFilterFreq: 90,
            filterType: 'lowpass', q: 4, grit: 9, crush: 1.2, pan: pan
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
        this.duck(0.65, 0.9);
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
                    ring: 190, endRing: 40, crush: 1.3,
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
        this.duck(0.4, 0.6);
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
        this.duck(0.7, 1.5);
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

    /**
     * Le bouclier se dissipe : la montée du ramassage jouée à l'envers, pour
     * que l'oreille comprenne immédiatement que la protection est tombée.
     */
    playShieldDown() {
        this.tone({
            freq: 900, endFreq: 260, type: 'sawtooth', duration: 0.4,
            gain: 0.17, send: 0.25,
            filter: 'lowpass', filterFreq: 4500, endFilterFreq: 400, q: 8
        });
        this.fm({
            freq: 1100, endFreq: 420, ratio: 1.41, index: 300, endIndex: 20,
            duration: 0.35, gain: 0.08, delay: 0.03, send: 0.3
        });
    }

    /** Un bonus de tir arrive à expiration : brève descente résignée. */
    playPowerDown() {
        this.tone({
            freq: 660, endFreq: 330, type: 'square', duration: 0.16,
            gain: 0.1, crush: 1.2, send: 0.15
        });
        this.tone({
            freq: 495, endFreq: 247, type: 'square', duration: 0.18,
            gain: 0.08, delay: 0.09, crush: 1.2, send: 0.15
        });
    }

    /**
     * Il ne reste qu'une vie : alarme de coque à deux tons, plus tendue que
     * l'alerte des boss et volontairement sèche pour ne pas gêner le jeu.
     */
    playLastLifeWarning() {
        if (!this.throttle('lastLife', 3)) return;
        for (let i = 0; i < 2; i++) {
            this.tone({
                freq: 880, endFreq: 660, type: 'square', duration: 0.16,
                gain: 0.15, delay: 0.5 + i * 0.24, send: 0.3, crush: 1.3,
                pan: i === 0 ? -0.4 : 0.4, sweepType: 'linear'
            });
            this.tone({
                freq: 440, endFreq: 330, type: 'sawtooth', duration: 0.16,
                gain: 0.08, delay: 0.5 + i * 0.24, grit: 4, sweepType: 'linear'
            });
        }
    }

    /** Record battu : la fanfare que l'on vient chercher dans une salle d'arcade. */
    playHighScore() {
        this.duck(0.5, 2.2);
        const melody = [
            { midi: 72, dur: 0.12 }, { midi: 76, dur: 0.12 }, { midi: 79, dur: 0.12 },
            { midi: 84, dur: 0.12 }, { midi: 81, dur: 0.12 }, { midi: 84, dur: 0.5 }
        ];
        this.jingle(melody, { type: 'square', gain: 0.27, send: 0.35, shimmer: 0.4, pan: -0.2 });
        // Contrechant à la tierce, légèrement décalé : l'effet « deux voix »
        this.jingle(melody.map(n => ({ midi: n.midi - 4, dur: n.dur })),
            { type: 'triangle', gain: 0.16, send: 0.35, delay: 0.03, pan: 0.2 });
        // Scintillement final
        for (let i = 0; i < 6; i++) {
            this.tone({
                freq: SoundManager.midiToFreq(88 + (i % 3) * 4), type: 'sine',
                duration: 0.12, gain: 0.09, delay: 0.7 + i * 0.07,
                send: 0.5, pan: (i % 2 === 0 ? -0.5 : 0.5)
            });
        }
    }

    /** Fin du mode bonus : petite cadence de retour au calme. */
    playBonusEnd() {
        this.jingle([
            { midi: 81, dur: 0.1 }, { midi: 77, dur: 0.1 },
            { midi: 74, dur: 0.1 }, { midi: 69, dur: 0.3 }
        ], { type: 'triangle', gain: 0.17, send: 0.3, shimmer: 0.25 });
    }

    /**
     * Passage d'un astéroïde : souffle filtré qui traverse le champ stéréo.
     * Il donne au mode bonus une texture continue plutôt qu'un silence.
     */
    playAsteroidWhoosh(pan = 0, size = 1) {
        if (!this.throttle('whoosh', 0.25)) return;
        // Les gros rochers grondent plus bas et plus longtemps
        const scale = Math.max(0.5, Math.min(1.6, size));
        this.noise({
            duration: 0.45 * scale, gain: 0.14,
            filterFreq: 900 / scale, endFilterFreq: 220 / scale,
            filterType: 'bandpass', q: 1.2, attack: 0.12,
            pan: pan, send: 0.25
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
     * Les partitions sont écrites en notation « tracker » : une chaîne par
     * mesure, seize jetons pour seize doubles croches.
     *
     *   "69"        note MIDI attaquée sur ce pas
     *   "57+60+64"  accord (une voix par note)
     *   "-"         liaison : prolonge la note précédente d'un pas
     *   "."         silence
     *
     * C'est la forme la plus lisible pour relire une mélodie d'un coup d'œil,
     * et surtout la seule qui permette d'écrire des notes tenues : sans les
     * liaisons, tout serait haché en doubles croches, ce qui était le défaut
     * majeur de la première version du séquenceur.
     */
    static notes(pattern) {
        const tokens = (Array.isArray(pattern) ? pattern.join(' ') : pattern)
            .trim().split(/\s+/);
        return tokens.map(t => {
            if (t === '.') return null;
            if (t === '-') return SoundManager.TIE;
            if (t.indexOf('+') !== -1) return t.split('+').map(Number);
            return Number(t);
        });
    }

    /**
     * Grille rythmique : "X" accent, "x" frappe normale, "o" frappe étouffée,
     * "." silence. La valeur renvoyée est une vélocité, pas un booléen : c'est
     * elle qui donne le relief d'un vrai batteur plutôt qu'une machine.
     */
    static hits(pattern) {
        const tokens = (Array.isArray(pattern) ? pattern.join(' ') : pattern)
            .trim().split(/\s+/);
        return tokens.map(t => {
            if (t === 'X') return 1.3;
            if (t === 'x') return 1;
            if (t === 'o') return 0.55;
            return 0;
        });
    }

    /** Ajuste une ligne à la longueur d'une section et signale les erreurs de saisie. */
    static fit(line, length, filler, label) {
        if (line.length && line.length !== length) {
            console.warn(`Piste musicale : ${label} contient ${line.length} pas au lieu de ${length}.`);
        }
        const out = new Array(length);
        for (let i = 0; i < length; i++) {
            out[i] = i < line.length ? line[i] : filler;
        }
        return out;
    }

    /**
     * Convertit une ligne de notes en table d'événements indexée par pas :
     * chaque attaque connaît sa durée en pas, liaisons comprises. Le
     * séquenceur n'a plus qu'à lire `voie[pas]`.
     */
    static events(line) {
        const at = new Array(line.length).fill(null);
        for (let i = 0; i < line.length; i++) {
            const value = line[i];
            if (value === null || value === SoundManager.TIE) continue;
            let len = 1;
            while (i + len < line.length && line[i + len] === SoundManager.TIE) len++;
            at[i] = { note: value, len: len };
        }
        return at;
    }

    /**
     * Compile une partition en une boucle unique.
     *
     * Une piste est une suite de sections (chacune de deux mesures) que l'on
     * enchaîne : intro, couplet, pont, refrain. C'est ce qui distingue une
     * musique d'une boucle — l'oreille attend la suite au lieu de reconnaître
     * les mêmes seize pas toutes les quatre secondes. `loopFrom` désigne la
     * section sur laquelle la piste reboucle : ce qui précède ne s'entend
     * qu'une fois, comme une introduction.
     */
    static compile(def) {
        const length = def.steps || 32;
        const melodic = ['bass', 'lead', 'arp', 'pad'];
        const rhythmic = ['kick', 'snare', 'hat', 'open', 'tom'];
        const track = {
            bpm: def.bpm,
            swing: def.swing || 0,
            leadWave: def.leadWave || null,
            loopStart: 0,
            length: 0
        };
        melodic.concat(rhythmic).forEach(name => { track[name] = []; });

        const loopFrom = def.loopFrom || 0;
        def.sections.forEach((section, index) => {
            const repeat = section.repeat || 1;
            for (let r = 0; r < repeat; r++) {
                if (index === loopFrom && r === 0) track.loopStart = track.bass.length;
                melodic.forEach(name => {
                    const line = section[name] ? SoundManager.notes(section[name]) : [];
                    track[name] = track[name].concat(
                        SoundManager.fit(line, length, null, `${def.name}/${index}/${name}`));
                });
                rhythmic.forEach(name => {
                    const line = section[name] ? SoundManager.hits(section[name]) : [];
                    track[name] = track[name].concat(
                        SoundManager.fit(line, length, 0, `${def.name}/${index}/${name}`));
                });
            }
        });

        track.length = track.bass.length;
        melodic.forEach(name => { track[name] = SoundManager.events(track[name]); });
        return track;
    }

    /**
     * Partitions du jeu. Sept thèmes qui suivent l'action : l'écran titre, deux
     * thèmes de combat qui alternent au fil des vagues, le boss, le mode bonus,
     * la défaite et le record battu.
     */
    static buildTracks() {
        // Trames rythmiques réutilisées d'une piste à l'autre.
        const kickRock   = 'X . . . . . x . x . . . . . . .';
        const snareBack  = '. . . . X . . . . . . . X . . .';
        const hat8       = 'X . o . x . o . X . o . x . o .';
        const hat16      = 'X o x o X o x o X o x o X o x o';
        const silence16  = '. . . . . . . . . . . . . . . .';

        return {
            /* ---------------------------------------------------------- */
            /*  Écran titre : lent, spatial, une nappe et un arpège avant   */
            /*  l'entrée du thème. Il doit tourner longtemps sans lasser.   */
            /* ---------------------------------------------------------- */
            title: SoundManager.compile({
                name: 'title', bpm: 86, swing: 0, leadWave: 'pulse25', loopFrom: 2,
                sections: [
                    {   // Intro : la nappe s'installe, l'arpège scintille (La m, Fa)
                        pad: ['57+60+64 - - - - - - - - - - - - - - -',
                              '53+57+60 - - - - - - - - - - - - - - -'],
                        arp: ['69 . 72 . 76 . 81 . 76 . 72 . 69 . 72 .',
                              '65 . 69 . 72 . 77 . 72 . 69 . 65 . 69 .']
                    },
                    {   // Suite de l'intro (Do, Sol), le charleston annonce le tempo
                        pad: ['60+64+67 - - - - - - - - - - - - - - -',
                              '55+59+62 - - - - - - - - - - - - - - -'],
                        arp: ['72 . 76 . 79 . 84 . 79 . 76 . 72 . 76 .',
                              '67 . 71 . 74 . 79 . 74 . 71 . 67 . 71 .'],
                        hat: ['. . o . . . o . . . o . . . o .',
                              '. . o . . . o . . . o . . . o .']
                    },
                    {   // Thème principal (La m, Fa) : c'est ici que la boucle revient
                        bass: ['45 . 45 . 45 . 45 . 45 . 45 . 45 . 47 .',
                               '41 . 41 . 41 . 41 . 41 . 41 . 41 . 43 .'],
                        lead: ['. . 76 - 74 - 72 - - - . . 69 - - -',
                               '. . 72 - 74 - 76 - - - . . 77 - - -'],
                        pad:  ['57+60+64 - - - - - - - - - - - - - - -',
                               '53+57+60 - - - - - - - - - - - - - - -'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . . . . .'],
                        snare: [snareBack, snareBack],
                        hat: ['. . o . . . o . . . o . . . o .',
                              '. . o . . . o . . . o . . . o .']
                    },
                    {   // Réponse (Do, Sol) : la mélodie monte puis retombe
                        bass: ['48 . 48 . 48 . 48 . 48 . 48 . 48 . 50 .',
                               '43 . 43 . 43 . 43 . 43 . 43 . 43 . 45 .'],
                        lead: ['. . 79 - 76 - 72 - - - . . 74 - - -',
                               '. . 71 - 74 - 79 - - - - - - - . .'],
                        pad:  ['60+64+67 - - - - - - - - - - - - - - -',
                               '55+59+62 - - - - - - - - - - - - - - -'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . o . o .'],
                        snare: [snareBack, snareBack],
                        hat: ['. . o . . . o . . . o . . . o .',
                              '. . o . . . o . . . o . . . . .'],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Combat A (La mineur) : riff de basse en doubles croches,    */
            /*  pont tendu, refrain qui s'ouvre.                            */
            /* ---------------------------------------------------------- */
            game: SoundManager.compile({
                name: 'game', bpm: 138, swing: 0.06, leadWave: 'pulse12',
                sections: [
                    {   // Couplet (La m, Sol), joué deux fois
                        repeat: 2,
                        bass: ['33 . 33 33 . 33 . 33 45 . 33 . 40 . 43 .',
                               '31 . 31 31 . 31 . 31 43 . 31 . 38 . 41 .'],
                        lead: ['69 . 76 - 74 . 72 - 69 . 67 . 69 - - .',
                               '67 . 74 - 72 . 71 - 67 . 65 . 67 - - .'],
                        kick: [kickRock, kickRock],
                        snare: [snareBack, snareBack],
                        hat: [hat8, hat8]
                    },
                    {   // Variation : la mélodie passe à l'octave, l'arpège entre
                        bass: ['33 . 33 33 . 33 . 33 45 . 33 . 40 . 43 .',
                               '31 . 31 31 . 31 . 31 43 . 31 . 38 . 41 .'],
                        lead: ['81 . 88 - 86 . 84 - 81 . 79 . 81 - - .',
                               '79 . 86 - 84 . 83 - 79 . 77 . 79 - - .'],
                        arp: ['57 . 60 . 64 . 60 . 55 . 59 . 62 . 59 .',
                              '55 . 59 . 62 . 59 . 53 . 57 . 60 . 57 .'],
                        kick: [kickRock, kickRock],
                        snare: [snareBack, '. . . . X . . . . . . . X . x . '],
                        hat: [hat16, hat16]
                    },
                    {   // Pont (Fa, Mi) : le Mi majeur ramène vers La mineur
                        bass: ['29 . 29 29 . 29 . 29 41 . 29 . 36 . 39 .',
                               '28 . 28 28 . 28 . 28 40 . 28 . 35 . 38 .'],
                        lead: ['77 - 76 - 74 - 72 - 74 - - . 72 . 69 .',
                               '76 - 75 - 74 - 72 - 71 - - - 68 - - -'],
                        pad:  ['53+57+60 - - - - - - - - - - - - - - -',
                               '52+56+59 - - - - - - - - - - - - - - -'],
                        kick: ['x . . . . . x . x . . . . . x .',
                               'x . . . . . x . x . . x . . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat8, hat8]
                    },
                    {   // Refrain : deux accords par mesure, mélodie tenue
                        bass: ['33 . 33 . 33 . 33 . 29 . 29 . 29 . 29 .',
                               '36 . 36 . 36 . 36 . 31 . 31 . 31 . 31 .'],
                        lead: ['81 - - . 79 - 77 - 76 - - . 74 - 72 -',
                               '76 - - . 79 - 81 - 79 - - - - - . .'],
                        arp: ['88 . 84 . 81 . 84 . 89 . 84 . 81 . 84 .',
                              '84 . 79 . 76 . 79 . 86 . 83 . 79 . 83 .'],
                        pad:  ['57+60+64 - - - - - - - 53+57+60 - - - - - - -',
                               '48+52+55 - - - - - - - 50+55+59 - - - - - - -'],
                        kick: [kickRock, 'X . . . . . x . x . . . x . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat16, hat16],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Combat B (Ré mineur) : le thème qui prend le relais toutes   */
            /*  les cinq vagues, plus rapide et plus tendu que le premier.   */
            /* ---------------------------------------------------------- */
            gameAlt: SoundManager.compile({
                name: 'gameAlt', bpm: 146, swing: 0.05, leadWave: 'pulse25',
                sections: [
                    {   // Couplet (Ré m, Do)
                        repeat: 2,
                        bass: ['38 . 38 38 . 38 . 38 50 . 38 . 45 . 48 .',
                               '36 . 36 36 . 36 . 36 48 . 36 . 43 . 46 .'],
                        lead: ['74 . 81 - 79 . 77 - 74 . 72 . 74 - - .',
                               '72 . 79 - 77 . 76 - 72 . 70 . 72 - - .'],
                        kick: ['X . . x . . X . x . . . . . x .',
                               'X . . x . . X . x . . . . . x .'],
                        snare: [snareBack, snareBack],
                        hat: [hat16, hat16]
                    },
                    {   // Pont (Si b, La) : la sensible do dièse serre l'harmonie
                        bass: ['34 . 34 34 . 34 . 34 46 . 34 . 41 . 44 .',
                               '33 . 33 33 . 33 . 33 45 . 33 . 40 . 45 .'],
                        lead: ['82 - 81 - 79 - 77 - 79 - - . 77 . 74 .',
                               '81 - 80 - 79 - 77 - 76 - - - 73 - - -'],
                        pad:  ['46+50+53 - - - - - - - - - - - - - - -',
                               '45+49+52 - - - - - - - - - - - - - - -'],
                        kick: ['X . . x . . X . x . . . . . x .',
                               'X . . x . . X . x . . x . . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat8, hat8]
                    },
                    {   // Refrain
                        bass: ['38 . 38 . 38 . 38 . 34 . 34 . 34 . 34 .',
                               '41 . 41 . 41 . 41 . 33 . 33 . 33 . 33 .'],
                        lead: ['86 - - . 84 - 82 - 81 - - . 79 - 77 -',
                               '81 - - . 84 - 86 - 85 - - - - - . .'],
                        arp: ['89 . 86 . 81 . 86 . 89 . 86 . 82 . 86 .',
                              '89 . 84 . 81 . 84 . 88 . 85 . 81 . 85 .'],
                        pad:  ['50+53+57 - - - - - - - 46+50+53 - - - - - - -',
                               '53+57+60 - - - - - - - 49+52+57 - - - - - - -'],
                        kick: ['X . . x . . X . x . . . . . x .',
                               'X . . x . . X . x . . . x . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat16, hat16],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Boss : mode phrygien (seconde mineure), grosse caisse       */
            /*  serrée, puis un refrain en demi-tempo qui écrase tout.      */
            /* ---------------------------------------------------------- */
            boss: SoundManager.compile({
                name: 'boss', bpm: 152, swing: 0, leadWave: 'pulse12',
                sections: [
                    {   // Riff : Mi et Fa se frottent, c'est la menace
                        repeat: 2,
                        bass: ['28 28 . 28 29 . 28 . 28 28 . 28 . 29 . 28',
                               '28 28 . 28 29 . 28 . 35 . 34 . 33 . 32 .'],
                        lead: ['64 . 65 . 64 . 71 - 70 - . . 64 . 65 .',
                               '64 . 65 . 64 . 72 - 71 - 70 - 69 - - .'],
                        kick: ['X . . x . . X . x . . x . . X .',
                               'X . . x . . X . x . . x . . X .'],
                        snare: ['. . . . X . . . . . . . X . . x',
                                '. . . . X . . . . . . . X . x x'],
                        hat: [hat16, hat16]
                    },
                    {   // Montée chromatique : le boss charge
                        bass: ['28 28 . 28 29 . 28 . 30 30 . 30 31 . 30 .',
                               '32 . 32 . 33 . 33 . 34 . 34 . 35 . 35 35'],
                        lead: ['76 - 75 - 76 - 75 - 77 - 76 - 77 - 76 -',
                               '79 - - . 78 - - . 80 - - . 83 - - -'],
                        kick: ['X . . x . . X . x . . x . . X .',
                               'X . x . X . x . X . x . X x X x'],
                        snare: ['. . . . X . . . . . . . X . . x',
                                '. . . . X . . x . . . . X . x x'],
                        hat: [hat16, hat16],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    },
                    {   // Refrain en demi-tempo : accords tenus, coups espacés
                        bass: ['28 - - - - - - - 31 - - - - - - -',
                               '33 - - - - - - - 29 - - - - - - -'],
                        lead: ['76 - - - - - 75 - - - . . 71 - - -',
                               '74 - - - - - 73 - - - - - 76 - - -'],
                        pad:  ['52+59+64 - - - - - - - - - - - - - - -',
                               '57+64+69 - - - - - - - - - - - - - - -'],
                        kick: ['X . . . . . . . . . . . x . . .',
                               'X . . . . . . . . . . . x . x .'],
                        snare: ['. . . . . . . . X . . . . . . .',
                                '. . . . . . . . X . . . . . x x'],
                        tom: ['. . . . . . . . . . . . . . . .',
                              '. . . . . . . . . . . . o . o .'],
                        hat: [hat8, hat8]
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Mode bonus : Fa majeur bondissant, basse en octaves.        */
            /* ---------------------------------------------------------- */
            bonus: SoundManager.compile({
                name: 'bonus', bpm: 128, swing: 0.14, leadWave: 'pulse33',
                sections: [
                    {   // Fa, puis Sol / La
                        bass: ['41 . 53 . 41 . 53 . 41 . 53 . 41 . 53 .',
                               '43 . 55 . 43 . 55 . 45 . 57 . 45 . 57 .'],
                        lead: ['77 . 81 . 84 . 81 . 77 . 81 . 84 . 89 .',
                               '79 . 83 . 86 . 83 . 81 . 84 . 88 . 84 .'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . . . . .'],
                        snare: [snareBack, snareBack],
                        hat: [hat8, hat8]
                    },
                    {   // Si bémol, Do : la phrase se répond à elle-même
                        bass: ['46 . 58 . 46 . 58 . 46 . 58 . 46 . 58 .',
                               '48 . 60 . 48 . 60 . 43 . 55 . 43 . 55 .'],
                        lead: ['82 - 81 - 79 . 77 . 79 - 81 - 84 - - .',
                               '84 - 83 - 81 . 79 . 77 - - - - - . .'],
                        arp: ['89 . 86 . 82 . 86 . 89 . 86 . 82 . 86 .',
                              '88 . 84 . 79 . 84 . 86 . 83 . 79 . 83 .'],
                        pad:  ['46+50+53 - - - - - - - - - - - - - - -',
                               '48+52+55 - - - - - - - 43+47+50 - - - - - - -'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . x . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat8, hat8],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Défaite : marche funèbre à peine rythmée, jouée sous        */
            /*  l'écran de score. Elle doit peser sans agacer.              */
            /* ---------------------------------------------------------- */
            gameOver: SoundManager.compile({
                name: 'gameOver', bpm: 64, swing: 0, leadWave: 'pulse33',
                sections: [
                    {   // La mineur, puis Mi majeur : la chute
                        bass: ['45 - - - - - - - - - - - - - - -',
                               '40 - - - - - - - - - - - - - - -'],
                        lead: ['69 - - - 67 - - - 65 - - - - - . .',
                               '64 - - - - - - - 63 - - - - - - -'],
                        pad:  ['57+60+64 - - - - - - - - - - - - - - -',
                               '52+56+59 - - - - - - - - - - - - - - -'],
                        tom: ['o . . . . . . . . . . . . . . .',
                              'o . . . . . . . . . . . . . . .']
                    },
                    {   // Fa, Mi : la mélodie tente de remonter et retombe
                        bass: ['41 - - - - - - - - - - - - - - -',
                               '40 - - - - - - - - - - - - - - -'],
                        lead: ['72 - - - 71 - - - 69 - - - - - . .',
                               '68 - - - - - - - 69 - - - - - - -'],
                        pad:  ['53+57+60 - - - - - - - - - - - - - - -',
                               '52+56+59 - - - - - - - - - - - - - - -'],
                        tom: ['o . . . . . . . . . . . . . . .',
                              'o . . . . . . . . . . . o . . .']
                    }
                ]
            }),

            /* ---------------------------------------------------------- */
            /*  Record battu : fanfare en Do majeur, la piste que l'on       */
            /*  vient chercher dans une salle d'arcade.                     */
            /* ---------------------------------------------------------- */
            victory: SoundManager.compile({
                name: 'victory', bpm: 116, swing: 0, leadWave: 'pulse25',
                sections: [
                    {   // Do, Mi m puis Fa, Sol
                        bass: ['36 . 48 . 36 . 48 . 40 . 52 . 40 . 52 .',
                               '41 . 53 . 41 . 53 . 43 . 55 . 43 . 55 .'],
                        lead: ['72 . 76 . 79 . 84 - - . 83 . 79 . 76 .',
                               '77 . 81 . 84 . 89 - - - 88 - 86 - 84 -'],
                        pad:  ['48+52+55 - - - - - - - 52+55+59 - - - - - - -',
                               '53+57+60 - - - - - - - 55+59+62 - - - - - - -'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . . . x .'],
                        snare: [snareBack, snareBack],
                        hat: [hat8, hat8]
                    },
                    {   // La m, Fa puis Sol, Do : la cadence conclut
                        bass: ['45 . 57 . 45 . 57 . 41 . 53 . 41 . 53 .',
                               '43 . 55 . 43 . 55 . 36 . 48 . 36 . 48 .'],
                        lead: ['81 - - . 79 . 77 . 76 - - . 74 . 72 .',
                               '74 . 76 . 79 - 81 - 84 - - - - - . .'],
                        arp: ['93 . 88 . 84 . 88 . 89 . 84 . 81 . 84 .',
                              '91 . 86 . 83 . 86 . 96 . 91 . 88 . 84 .'],
                        pad:  ['45+52+57 - - - - - - - 41+48+53 - - - - - - -',
                               '43+50+55 - - - - - - - 48+55+60 - - - - - - -'],
                        kick: ['x . . . . . . . x . . . . . . .',
                               'x . . . . . . . x . . . x . x .'],
                        snare: [snareBack, '. . . . X . . . . . . . X . x x'],
                        hat: [hat8, hat8],
                        open: [silence16, '. . . . . . . . . . . . . . x .']
                    }
                ]
            })
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Instruments musicaux                                               */
    /* ------------------------------------------------------------------ */

    /** Onde de lead d'une piste, résolue après l'initialisation du contexte. */
    leadWaveOf(track) {
        return this[track.leadWave] || this.pulse25;
    }

    /**
     * Basse : une impulsion 25 % passée dans un filtre qui se referme, doublée
     * d'un triangle à la même hauteur. Le filtre donne l'attaque, le triangle
     * donne le fondamental que les petits haut-parleurs restituent mal.
     */
    musicBass(midi, duration, delay, vel = 1) {
        const freq = SoundManager.midiToFreq(midi);
        const dur = Math.max(0.05, duration * 0.9);
        this.tone({
            freq: freq, wave: this.pulse25, duration: dur, gain: 0.24 * vel,
            delay: delay, attack: 0.005, hold: dur * 0.45, bus: 'music',
            filter: 'lowpass', filterFreq: 2800, endFilterFreq: 620, q: 3
        });
        this.tone({
            freq: freq, type: 'triangle', duration: dur * 0.9, gain: 0.2 * vel,
            delay: delay, attack: 0.004, hold: dur * 0.35, bus: 'music'
        });
    }

    /**
     * Mélodie : deux impulsions désaccordées de quelques centièmes et écartées
     * dans le champ stéréo. Le vibrato ne se déclenche que sur les notes
     * tenues, et l'écho rythmé leur répond une croche pointée plus loin.
     */
    musicLead(midi, duration, delay, wave, vel = 1) {
        const freq = SoundManager.midiToFreq(midi);
        const dur = Math.max(0.05, duration * 0.94);
        const sustained = duration > 0.3;
        this.tone({
            freq: freq, wave: wave, duration: dur, gain: 0.15 * vel,
            delay: delay, detune: -7, attack: 0.006, hold: dur * 0.55,
            bus: 'music', echo: 0.3, send: 0.08, pan: -0.18,
            vibrato: sustained ? 5.5 : 0, vibratoDepth: 16,
            filter: 'lowpass', filterFreq: 5200, q: 0.8
        });
        this.tone({
            freq: freq, wave: wave, duration: dur * 0.96, gain: 0.09 * vel,
            delay: delay + 0.008, detune: 8, attack: 0.006, hold: dur * 0.5,
            bus: 'music', pan: 0.18,
            filter: 'lowpass', filterFreq: 4200
        });
    }

    /** Arpège : brefs éclats de triangle largement renvoyés dans l'écho. */
    musicArp(midi, duration, delay, vel = 1) {
        this.tone({
            freq: SoundManager.midiToFreq(midi), type: 'triangle',
            duration: Math.min(0.17, duration * 0.8), gain: 0.085 * vel,
            delay: delay, bus: 'music', echo: 0.4, pan: 0.3
        });
    }

    /**
     * Nappe : les notes de l'accord sont étalées dans le champ stéréo et
     * attaquées à quelques millisecondes d'écart. Le filtre s'ouvre puis se
     * referme sur la durée de l'accord, ce qui l'empêche de rester figé.
     */
    musicPad(midis, duration, delay, vel = 1) {
        const list = [].concat(midis);
        const spread = list.length > 1 ? 0.7 / (list.length - 1) : 0;
        list.forEach((midi, i) => {
            this.tone({
                freq: SoundManager.midiToFreq(midi), type: 'sawtooth',
                duration: duration * 0.98, gain: 0.05 * vel,
                delay: delay + i * 0.012,
                attack: Math.min(0.18, duration * 0.3), hold: duration * 0.35,
                bus: 'music', send: 0.25,
                pan: list.length > 1 ? -0.35 + i * spread : 0,
                filter: 'lowpass', filterFreq: 1500, endFilterFreq: 700, q: 1.2
            });
        });
    }

    /** Grosse caisse : balayage sinusoïdal court avec un claquement de bruit. */
    musicKick(delay, vel = 1) {
        this.tone({
            freq: 172, endFreq: 44, type: 'sine', duration: 0.17,
            gain: 0.46 * vel, delay: delay, attack: 0.002, bus: 'music'
        });
        this.noise({
            duration: 0.02, gain: 0.1 * vel, filterFreq: 3200,
            filterType: 'highpass', delay: delay, bus: 'music'
        });
    }

    /** Caisse claire : bruit filtré en cloche plus un corps accordé. */
    musicSnare(delay, vel = 1) {
        this.noise({
            duration: 0.15, gain: 0.22 * vel, filterFreq: 2400,
            endFilterFreq: 900, filterType: 'bandpass', q: 0.8,
            delay: delay, bus: 'music', send: 0.12
        });
        this.tone({
            freq: 195, endFreq: 150, type: 'triangle', duration: 0.09,
            gain: 0.14 * vel, delay: delay, bus: 'music'
        });
    }

    /** Charleston : salve de bruit aigu, fermée ou ouverte. */
    musicHat(delay, vel = 1, open = false) {
        this.noise({
            duration: open ? 0.17 : 0.04,
            gain: (open ? 0.08 : 0.1) * vel,
            filterFreq: open ? 7000 : 8500, filterType: 'highpass',
            delay: delay, bus: 'music', pan: 0.22
        });
    }

    /** Tom grave : le battement de cœur des passages lents. */
    musicTom(delay, vel = 1) {
        this.tone({
            freq: 125, endFreq: 68, type: 'sine', duration: 0.3,
            gain: 0.3 * vel, delay: delay, attack: 0.003,
            bus: 'music', send: 0.25
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Séquenceur                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Change la piste jouée en boucle. `null` coupe la musique.
     * Appelable avant le déblocage audio : la piste démarrera alors toute
     * seule au premier geste de l'utilisateur.
     */
    setMusic(name) {
        this.clearPendingMusic();
        const next = (name && this.tracks[name]) ? name : null;
        if (next === this.currentTrack) return;
        this.currentTrack = next;
        this.step = 0;
        this.stopScheduler();
        if (this.currentTrack && this.ready) {
            this.syncEcho();
            this.fadeMusicIn();
            this.startScheduler();
        }
    }

    /**
     * Programme un changement de piste différé. Les thèmes de fin de partie
     * ne doivent pas démarrer sous la fanfare qui les annonce : on leur laisse
     * le temps de retomber. Tout appel direct à `setMusic()` annule l'attente,
     * pour qu'une partie relancée entre-temps ne voie pas surgir la marche
     * funèbre au milieu de la première vague.
     */
    setMusicLater(name, seconds) {
        this.clearPendingMusic();
        this.pendingMusic = setTimeout(() => {
            this.pendingMusic = null;
            this.setMusic(name);
        }, seconds * 1000);
    }

    clearPendingMusic() {
        if (this.pendingMusic) {
            clearTimeout(this.pendingMusic);
            this.pendingMusic = null;
        }
    }

    /** Cale le retard de l'écho sur une croche pointée du tempo courant. */
    syncEcho() {
        if (!this.musicDelay) return;
        const track = this.tracks[this.currentTrack];
        const now = this.ctx.currentTime;
        this.musicDelay.delayTime.setTargetAtTime(
            Math.min(1.4, this.stepDuration(track) * 3), now, 0.05);
    }

    /**
     * Fondu d'entrée : une piste qui démarre en pleine puissance sur un
     * changement d'état claque désagréablement, surtout entre deux vagues.
     */
    fadeMusicIn() {
        const gain = this.musicBus.gain;
        const now = this.ctx.currentTime;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0.0001, now);
        gain.linearRampToValueAtTime(this.musicVolume, now + 0.35);
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

    /** Durée d'une double croche au tempo de la piste. */
    stepDuration(track) {
        return 60 / track.bpm / 4;
    }

    /**
     * Durée réelle d'un pas, swing compris : les pas pairs sont allongés et
     * les impairs raccourcis d'autant. Le tempo moyen ne bouge pas, mais la
     * rythmique cesse d'être mécanique.
     */
    stepLength(track, step) {
        const base = this.stepDuration(track);
        if (!track.swing) return base;
        return step % 2 === 0 ? base * (1 + track.swing) : base * (1 - track.swing);
    }

    /** Planifie à l'avance les pas de la boucle musicale. */
    scheduleMusic() {
        if (!this.ready || !this.currentTrack) return;
        if (this.ctx.state !== 'running') return;
        const track = this.tracks[this.currentTrack];

        // Après une suspension (onglet caché, pause), l'horloge a pris de
        // l'avance : on se recale au lieu de rattraper tous les pas manqués.
        if (this.nextStepTime < this.ctx.currentTime) {
            this.nextStepTime = this.ctx.currentTime;
        }

        while (this.nextStepTime < this.ctx.currentTime + this.lookAhead) {
            this.playMusicStep(track, this.step, this.nextStepTime - this.ctx.currentTime);
            this.nextStepTime += this.stepLength(track, this.step);
            this.step++;
            // L'introduction ne s'entend qu'une fois : la boucle repart au
            // point de rebouclage, pas au début de la piste.
            if (this.step >= track.length) this.step = track.loopStart;
        }
    }

    playMusicStep(track, step, delay) {
        const base = this.stepDuration(track);

        const bass = track.bass[step];
        if (bass) this.musicBass([].concat(bass.note)[0], base * bass.len, delay);

        const lead = track.lead[step];
        if (lead) {
            this.musicLead([].concat(lead.note)[0], base * lead.len, delay,
                this.leadWaveOf(track));
        }

        const arp = track.arp[step];
        if (arp) this.musicArp([].concat(arp.note)[0], base * arp.len, delay);

        const pad = track.pad[step];
        if (pad) this.musicPad(pad.note, base * pad.len, delay);

        if (track.kick[step]) this.musicKick(delay, track.kick[step]);
        if (track.snare[step]) this.musicSnare(delay, track.snare[step]);
        if (track.hat[step]) this.musicHat(delay, track.hat[step], false);
        if (track.open[step]) this.musicHat(delay, track.open[step], true);
        if (track.tom[step]) this.musicTom(delay, track.tom[step]);
    }
}

/** Marqueur de liaison dans les partitions (voir `SoundManager.notes`). */
SoundManager.TIE = -1;
