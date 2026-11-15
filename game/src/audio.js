// All of EMBERFALL's sound is synthesised with WebAudio: no audio files, nothing to
// load. Short oscillator and noise blips make the effects; a slow two-oscillator pad
// and a quiet bass arp make the music bed. The context is created lazily on the first
// user gesture, as browsers require, and M mutes the master gain.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.arpTimer = null;
    this.arpStep = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone({ freq = 440, end = null, type = 'square', dur = 0.12, vol = 0.2, when = 0, music = false }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(music ? this.musicGain : this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.25, freq = 1200, when = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  shoot() {
    this.tone({ freq: 880, end: 320, type: 'square', dur: 0.07, vol: 0.07 });
  }

  enemyHit() {
    this.tone({ freq: 300, end: 200, type: 'triangle', dur: 0.05, vol: 0.08 });
  }

  enemyDown(big) {
    this.noise({ dur: big ? 0.4 : 0.22, vol: big ? 0.4 : 0.25, freq: big ? 900 : 1400 });
    this.tone({ freq: big ? 160 : 220, end: 40, type: 'sawtooth', dur: big ? 0.35 : 0.2, vol: 0.18 });
  }

  shard() {
    this.tone({ freq: 1320, type: 'sine', dur: 0.09, vol: 0.12 });
    this.tone({ freq: 1760, type: 'sine', dur: 0.12, vol: 0.1, when: 0.05 });
  }

  powerup() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', dur: 0.12, vol: 0.14, when: i * 0.06 });
    });
  }

  playerHit() {
    this.noise({ dur: 0.35, vol: 0.4, freq: 700 });
    this.tone({ freq: 320, end: 55, type: 'sawtooth', dur: 0.4, vol: 0.3 });
  }

  dash() {
    this.noise({ dur: 0.16, vol: 0.12, freq: 2600 });
  }

  overdrive() {
    [392, 523, 659, 784, 1046, 1318].forEach((freq, i) => {
      this.tone({ freq, type: 'square', dur: 0.1, vol: 0.09, when: i * 0.045 });
    });
  }

  waveHorn() {
    this.tone({ freq: 196, type: 'sawtooth', dur: 0.28, vol: 0.12 });
    this.tone({ freq: 294, type: 'sawtooth', dur: 0.34, vol: 0.12, when: 0.16 });
  }

  victory() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', dur: 0.22, vol: 0.16, when: i * 0.13 });
    });
  }

  gameOver() {
    [392, 330, 262, 196].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.16, when: i * 0.17 });
    });
  }

  // A slow A-minor arp under a soft detuned pad. Kept very quiet: it is a bed,
  // not a melody, and it stops mattering the moment the action starts.
  startMusic() {
    if (!this.ctx || this.arpTimer !== null) return;
    const bassline = [110, 110, 131, 98, 110, 110, 165, 147];
    const padNotes = [220, 262, 330];
    padNotes.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
    });
    this.arpTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const freq = bassline[this.arpStep % bassline.length];
      this.arpStep += 1;
      this.tone({ freq, type: 'triangle', dur: 0.24, vol: 0.1, music: true });
    }, 260);
  }
}
