class BlobOrchestra {
    constructor() {
        this.audioCtx = null;
        this.isPlaying = false;
        this.blobs = [];
        this.tempo = 120;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.nextNoteTime = 0.0;
        this.current16thNote = 0;
        this.timerID = null;

        this.initUI();
    }

    initUI() {
        this.startBtn = document.getElementById('start-btn');
        this.blobElements = document.querySelectorAll('.blob');

        this.startBtn.addEventListener('click', () => {
            this.initAudio();
            this.startBtn.classList.add('hidden');
        });

        this.blobElements.forEach((el, index) => {
            el.addEventListener('click', () => this.toggleBlob(index));
            // Add keyboard accessibility
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    this.toggleBlob(index);
                }
            });
        });

        // Eye Tracking
        document.addEventListener('mousemove', (e) => {
            this.blobElements.forEach(blob => {
                if (!blob.classList.contains('active')) return;

                const rect = blob.getBoundingClientRect();
                const blobX = rect.left + rect.width / 2;
                const blobY = rect.top + rect.height / 2;

                const angle = Math.atan2(e.clientY - blobY, e.clientX - blobX);
                const distance = Math.min(5, Math.hypot(e.clientX - blobX, e.clientY - blobY) / 20);

                const pupilX = Math.cos(angle) * distance;
                const pupilY = Math.sin(angle) * distance;

                const pupils = blob.querySelectorAll('.pupil');
                pupils.forEach(pupil => {
                    pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
                });
            });
        });
    }

    initAudio() {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.nextNoteTime = this.audioCtx.currentTime;

        // Master Gain
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.audioCtx.destination);

        // Initialize Blobs with callbacks
        this.blobs = [
            new BassBlob(this.audioCtx, this.masterGain, (t) => this.onBeat(0, t)),
            new SnareBlob(this.audioCtx, this.masterGain, (t) => this.onBeat(1, t)),
            new MelodyBlob(this.audioCtx, this.masterGain, (t) => this.onBeat(2, t)),
            new DroneBlob(this.audioCtx, this.masterGain, (t) => this.onBeat(3, t))
        ];

        this.isPlaying = true;
        this.scheduler();
    }

    onBeat(index, time) {
        // Visual sync needs to happen on main thread, scheduled slightly in future?
        // Web Audio is precise, visual is RAF. We'll just trigger animation immediately 
        // but since lookahead is small (0.1s), it should feel snappy.
        // Actually, for perfect sync, we should use setTimeout based on time difference,
        // but for this toy, immediate trigger is often "good enough" or we calculate delay.

        const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
        setTimeout(() => {
            const blob = this.blobElements[index];
            if (!blob.classList.contains('active')) return;

            // Mouth Animation
            const mouth = blob.querySelector('.mouth');
            mouth.classList.add('singing');
            setTimeout(() => mouth.classList.remove('singing'), 100);

            // Particles (only on strong beats or specific instruments)
            // Bass: always, Snare: always, Melody: sometimes
            this.spawnParticles(blob);
        }, delay);
    }

    spawnParticles(blobElement) {
        const particleCount = 4;
        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');

            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 30;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            // Center spawn
            p.style.left = '50%';
            p.style.top = '50%';

            blobElement.appendChild(p);

            // Cleanup
            setTimeout(() => p.remove(), 600);
        }
    }

    toggleBlob(index) {
        if (!this.audioCtx) return; // Must start audio first

        const blob = this.blobs[index];
        const el = this.blobElements[index];

        blob.active = !blob.active;

        if (blob.active) {
            el.classList.add('active');
            // For drone, we need to explicitly start/unmute
            if (blob instanceof DroneBlob) blob.start();
        } else {
            el.classList.remove('active');
            // Reset eyes
            const pupils = el.querySelectorAll('.pupil');
            pupils.forEach(p => p.style.transform = 'translate(0,0)');

            // For drone, we need to stop/mute
            if (blob instanceof DroneBlob) blob.stop();
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat; // Advance by 16th note
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        this.blobs.forEach(blob => {
            if (blob.active && !(blob instanceof DroneBlob)) {
                blob.play(time, beatNumber);
            }
        });
    }

    scheduler() {
        while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
}

// Base Blob Class
class BlobInstrument {
    constructor(ctx, destination, onBeatCallback) {
        this.ctx = ctx;
        this.destination = destination;
        this.onBeatCallback = onBeatCallback || (() => { });
        this.active = false;
    }
    play(time, step) { }
}

// Blob 1: Bass (Sine Wave, Kick-like)
class BassBlob extends BlobInstrument {
    play(time, step) {
        // Play on beats 0, 4, 8, 12 (Quarter notes)
        if (step % 4 !== 0) return;

        this.onBeatCallback(time);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.destination);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }
}

// Blob 2: Snare (Noise/Triangle, Percussive)
class SnareBlob extends BlobInstrument {
    constructor(ctx, destination, onBeatCallback) {
        super(ctx, destination, onBeatCallback);
        this.noiseBuffer = this.createNoiseBuffer();
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    play(time, step) {
        // Play on beats 4 and 12 (Backbeat)
        if (step % 8 !== 4) return;

        this.onBeatCallback(time);

        // Noise burst
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.destination);
        noise.start(time);

        // Triangle 'pop'
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const oscGain = this.ctx.createGain();

        osc.connect(oscGain);
        oscGain.connect(this.destination);

        osc.frequency.setValueAtTime(200, time);
        oscGain.gain.setValueAtTime(0.3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    }
}

// Blob 3: Melody (Square, Arpeggio)
class MelodyBlob extends BlobInstrument {
    constructor(ctx, destination, onBeatCallback) {
        super(ctx, destination, onBeatCallback);
        // Pentatonic scale: C4, D4, E4, G4, A4
        this.scale = [261.63, 293.66, 329.63, 392.00, 440.00];
        this.pattern = [0, 2, 4, 2, 1, 3, 0, 4, 1, 0, 3, 2, 4, 1, 0, 2]; // Indices
    }

    play(time, step) {
        // Play every 8th note (every 2 steps)
        if (step % 2 !== 0) return;

        this.onBeatCallback(time);

        const noteIndex = this.pattern[step % 16];
        const freq = this.scale[noteIndex % this.scale.length];

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 800;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.destination);

        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.05, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        osc.start(time);
        osc.stop(time + 0.2);
    }
}

// Blob 4: Drone (Sawtooth, Sustained)
class DroneBlob extends BlobInstrument {
    constructor(ctx, destination, onBeatCallback) {
        super(ctx, destination, onBeatCallback);
        this.osc = null;
        this.gainNode = null;
        this.filter = null;
        this.lfo = null;
        this.isStopping = false;
        this.lastBeatTime = 0;
    }

    start() {
        // If stopping, cancel the stop
        this.isStopping = false;

        if (!this.osc) {
            this.osc = this.ctx.createOscillator();
            this.osc.type = 'sawtooth';
            this.osc.frequency.value = 65.41; // C2

            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = 0;

            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = 400;

            // LFO for filter
            this.lfo = this.ctx.createOscillator();
            this.lfo.type = 'sine';
            this.lfo.frequency.value = 0.2;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 200;
            this.lfo.connect(lfoGain);
            lfoGain.connect(this.filter.frequency);
            this.lfo.start();

            this.osc.connect(this.filter);
            this.filter.connect(this.gainNode);
            this.gainNode.connect(this.destination);

            this.osc.start();
        }

        // Fade in
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.5);
    }

    stop() {
        if (this.gainNode) {
            this.isStopping = true;
            // Fade out
            this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);

            // Cleanup after fade
            setTimeout(() => {
                if (this.isStopping && this.osc && this.gainNode.gain.value < 0.01) {
                    this.osc.stop();
                    this.lfo.stop();
                    this.osc = null;
                    this.lfo = null;
                    this.gainNode = null;
                    this.filter = null;
                }
            }, 2000);
        }
    }

    play(time, step) {
        // Drone is continuous, but let's trigger visual pulse on beat 0
        if (step % 16 === 0) {
            this.onBeatCallback(time);
        }
    }
}

// Initialize
const app = new BlobOrchestra();
