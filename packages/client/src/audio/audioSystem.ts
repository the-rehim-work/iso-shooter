export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _volume = 0.8;
  sfxEnabled = true;

  private getCtx(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._volume;
    this.masterGain.connect(this.ctx.destination);
  }

  get volume(): number { return this._volume; }
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._volume;
  }

  playGunshot(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;

    const rate = ctx.sampleRate;
    const crackLen = Math.floor(rate * 0.055);
    const crackBuf = ctx.createBuffer(1, crackLen, rate);
    const cd = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.8);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1200;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.4, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    crack.connect(hpf); hpf.connect(crackGain); crackGain.connect(this.masterGain);
    crack.start(now); crack.stop(now + 0.06);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.14);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(1.0, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(oscGain); oscGain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  playHit(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.07);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    src.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + 0.08);
  }

  playReload(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    for (const t of [0, 0.19] as const) {
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * 0.018);
      const buf = ctx.createBuffer(1, len, rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 2200; bpf.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, now + t);
      src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
      src.start(now + t); src.stop(now + t + 0.025);
    }
  }

  playDeath(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.6);
  }
}
