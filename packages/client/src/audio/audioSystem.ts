import type { WeaponId } from '@iso/shared';

interface ShotProfile {
  crackLen: number;
  crackHpf: number;
  crackGain: number;
  bodyFrom: number;
  bodyTo: number;
  bodyGain: number;
  bodyLen: number;
  tailLen: number;
  tailLpf: number;
  tailGain: number;
}

const SHOT_PROFILES: Record<WeaponId, ShotProfile> = {
  pistol: { crackLen: 0.045, crackHpf: 2100, crackGain: 1.1, bodyFrom: 175, bodyTo: 55, bodyGain: 0.7, bodyLen: 0.1, tailLen: 0.08, tailLpf: 1200, tailGain: 0.28 },
  smg: { crackLen: 0.032, crackHpf: 2400, crackGain: 0.95, bodyFrom: 200, bodyTo: 70, bodyGain: 0.5, bodyLen: 0.07, tailLen: 0.06, tailLpf: 1500, tailGain: 0.22 },
  rifle: { crackLen: 0.05, crackHpf: 1350, crackGain: 1.5, bodyFrom: 105, bodyTo: 27, bodyGain: 1.0, bodyLen: 0.15, tailLen: 0.14, tailLpf: 820, tailGain: 0.45 },
  shotgun: { crackLen: 0.11, crackHpf: 480, crackGain: 2.0, bodyFrom: 60, bodyTo: 15, bodyGain: 1.5, bodyLen: 0.26, tailLen: 0.34, tailLpf: 420, tailGain: 0.78 },
  sniper: { crackLen: 0.085, crackHpf: 700, crackGain: 2.3, bodyFrom: 68, bodyTo: 11, bodyGain: 1.6, bodyLen: 0.36, tailLen: 0.5, tailLpf: 380, tailGain: 0.9 },
  lmg: { crackLen: 0.062, crackHpf: 900, crackGain: 1.7, bodyFrom: 82, bodyTo: 18, bodyGain: 1.25, bodyLen: 0.2, tailLen: 0.24, tailLpf: 620, tailGain: 0.62 },
  dmr: { crackLen: 0.055, crackHpf: 1650, crackGain: 1.8, bodyFrom: 122, bodyTo: 30, bodyGain: 1.2, bodyLen: 0.18, tailLen: 0.2, tailLpf: 720, tailGain: 0.5 },
  knife: { crackLen: 0.02, crackHpf: 2500, crackGain: 0.4, bodyFrom: 200, bodyTo: 120, bodyGain: 0.2, bodyLen: 0.05, tailLen: 0.03, tailLpf: 1500, tailGain: 0.1 },
  revolver: { crackLen: 0.07, crackHpf: 900, crackGain: 2.0, bodyFrom: 95, bodyTo: 22, bodyGain: 1.35, bodyLen: 0.22, tailLen: 0.28, tailLpf: 520, tailGain: 0.7 },
  carbine: { crackLen: 0.045, crackHpf: 1550, crackGain: 1.35, bodyFrom: 115, bodyTo: 32, bodyGain: 0.9, bodyLen: 0.13, tailLen: 0.12, tailLpf: 900, tailGain: 0.38 },
  mp: { crackLen: 0.026, crackHpf: 2700, crackGain: 0.85, bodyFrom: 210, bodyTo: 85, bodyGain: 0.42, bodyLen: 0.055, tailLen: 0.05, tailLpf: 1700, tailGain: 0.18 },
};

function midiHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// 16-bar dark orchestral piece in D minor, ~66bpm, with sectional dynamics so
// it breathes instead of droning: sparse open, building middle, full climax,
// receding close.
const BAR_SEC = (60 / 66) * 4;
const MUSIC_BARS = 16;
const INTENSITY = [0.4, 0.4, 0.5, 0.55, 0.75, 0.8, 0.85, 0.9, 1, 1, 1, 0.95, 0.7, 0.6, 0.5, 0.45];
const OSTINATO: number[][] = [
  [38, 38, 41, 38, 34, 34, 36, 36],
  [38, 38, 41, 38, 34, 34, 33, 33],
  [38, 38, 41, 43, 41, 38, 36, 36],
  [38, 41, 45, 41, 34, 38, 36, 33],
];
// one chord per two bars across 16 bars: Dm Dm Bb Gm | Dm C Bb A
const PAD_CHORDS: number[][] = [
  [50, 53, 57], [50, 53, 57], [46, 50, 53], [43, 46, 50],
  [50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52],
];
// two alternating 8-bar phrases (0 = rest)
const MELODY_A: number[] = [62, 0, 60, 0, 58, 57, 0, 0];
const MELODY_B: number[] = [65, 0, 62, 0, 61, 0, 57, 0];

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _volume = 0.8;
  sfxEnabled = true;

  private musicGain: GainNode | null = null;
  private _musicVolume = 0.5;
  private musicTimer: number | null = null;
  private nextBarTime = 0;
  private barIndex = 0;

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

  setMusicVolume(v: number): void {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVolume * 0.5;
  }

  // ── procedural score: dark orchestral instrumental, composed in-code ──

  startMusic(): void {
    const ctx = this.getCtx();
    if (!ctx || this.musicTimer !== null) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this._musicVolume * 0.5;

    // hall reverb from a generated impulse response — this is what keeps the
    // synthesized orchestra from sounding like raw oscillators
    const irLen = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.4);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = ir;
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.musicGain.connect(dry);
    this.musicGain.connect(convolver);
    convolver.connect(wet);
    dry.connect(ctx.destination);
    wet.connect(ctx.destination);

    this.nextBarTime = ctx.currentTime + 0.1;
    this.barIndex = 0;
    this.musicTimer = window.setInterval(() => this.pumpMusic(), 300);
    this.pumpMusic();
  }

  private pumpMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    while (this.nextBarTime < ctx.currentTime + 1.2) {
      this.scheduleBar(this.barIndex % MUSIC_BARS, this.nextBarTime);
      this.barIndex++;
      this.nextBarTime += BAR_SEC;
    }
  }

  // ensemble string voice: three detuned oscillators with slow vibrato through
  // a lowpass — much closer to bowed strings than a bare sawtooth
  private strings(t: number, freq: number, dur: number, gain: number, attack: number, lpfHz: number): void {
    const ctx = this.ctx!;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(lpfHz * 0.7, t);
    lpf.frequency.linearRampToValueAtTime(lpfHz, t + attack + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur * 0.65));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lpf.connect(g); g.connect(this.musicGain!);

    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6 + Math.random() * 0.8;
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(7, t + attack + 0.4);
    vib.connect(vibGain);

    for (const [type, det, mul] of [['sawtooth', -8, 0.5], ['sawtooth', 7, 0.5], ['triangle', 0, 0.9]] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      vibGain.connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = mul;
      o.connect(og); og.connect(lpf);
      o.start(t); o.stop(t + dur + 0.05);
    }
    vib.start(t); vib.stop(t + dur + 0.05);
  }

  // dark "ah" choir: sawtooth pushed through two vowel formant bands
  private choir(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [f, q, m] of [[620, 9, 1.0], [1040, 11, 0.55]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f!;
      bp.Q.value = q!;
      const bg = ctx.createGain();
      bg.gain.value = m!;
      o.connect(bp); bp.connect(bg); bg.connect(g);
    }
    g.connect(this.musicGain!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private timpani(t: number, freq: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.1, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(this.musicGain!);
    o.start(t); o.stop(t + 1.2);
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.06);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 380;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.7, t);
    src.connect(lpf); lpf.connect(ng); ng.connect(this.musicGain!);
    src.start(t); src.stop(t + 0.08);
  }

  private scheduleBar(bar: number, t: number): void {
    const eighth = BAR_SEC / 8;
    const heat = INTENSITY[bar]!;

    // sub drone, always present, swells with intensity
    const ctx = this.ctx!;
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = midiHz(26);
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.10 + heat * 0.07, t);
    dg.gain.linearRampToValueAtTime(0.0001, t + BAR_SEC + 0.3);
    drone.connect(dg); dg.connect(this.musicGain!);
    drone.start(t); drone.stop(t + BAR_SEC + 0.35);

    // low-string ostinato: full 8ths at high intensity, halved pulse mid,
    // silent in the quiet sections — this is what kills the monotony
    if (heat >= 0.7) {
      const pattern = OSTINATO[bar % 4]!;
      for (let i = 0; i < 8; i++) {
        this.strings(t + i * eighth, midiHz(pattern[i]!), eighth * 1.25, 0.11 * heat, 0.02, 560);
      }
    } else if (heat >= 0.5) {
      const pattern = OSTINATO[0]!;
      for (let i = 0; i < 8; i += 2) {
        this.strings(t + i * eighth, midiHz(pattern[i]!), eighth * 2.3, 0.09, 0.05, 480);
      }
    }

    // sustained chord, one per two bars
    if (bar % 2 === 0) {
      const chord = PAD_CHORDS[(bar / 2) % 8]!;
      for (const m of chord) {
        this.strings(t, midiHz(m), BAR_SEC * 2.1, 0.028 + heat * 0.016, 1.6, 800);
      }
      // low choir doubles the root in the quiet and climax sections
      if (heat <= 0.5 || heat >= 1) {
        this.choir(t, midiHz(chord[0]! - 12), BAR_SEC * 2.1, 0.16);
      }
    }

    // percussion: sparse when quiet, driving pattern at the climax
    if (heat >= 1) {
      this.timpani(t, midiHz(26), 0.5);
      this.timpani(t + 4 * eighth, midiHz(26), 0.3);
      if (bar % 2 === 1) this.timpani(t + 6 * eighth, midiHz(31), 0.34);
    } else if (heat >= 0.7 && bar % 2 === 0) {
      this.timpani(t, midiHz(26), 0.45);
    } else if (bar % 4 === 0) {
      this.timpani(t, midiHz(26), 0.35);
    }

    // melody: two alternating phrases, an octave up at the climax
    const phrase = bar < 8 ? MELODY_A : MELODY_B;
    const mel = phrase[bar % 8]!;
    if (mel !== 0) {
      const lift = heat >= 1 ? 12 : 0;
      this.strings(t + eighth, midiHz(mel + lift), BAR_SEC * 1.7, 0.035 + heat * 0.02, 0.8, 1500);
    }
  }

  playGunshot(): void {
    this.playShot('rifle');
  }

  playShot(weapon: WeaponId): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const p = SHOT_PROFILES[weapon] ?? SHOT_PROFILES.rifle;

    const rate = ctx.sampleRate;
    const crackLen = Math.floor(rate * p.crackLen);
    const crackBuf = ctx.createBuffer(1, crackLen, rate);
    const cd = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.8);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = p.crackHpf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(p.crackGain, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + p.crackLen + 0.005);
    crack.connect(hpf); hpf.connect(crackGain); crackGain.connect(this.masterGain);
    crack.start(now); crack.stop(now + p.crackLen + 0.01);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const jitter = 1 + (Math.random() - 0.5) * 0.06;
    osc.frequency.setValueAtTime(p.bodyFrom * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(p.bodyTo, now + p.bodyLen * 0.8);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(p.bodyGain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + p.bodyLen);
    osc.connect(oscGain); oscGain.connect(this.masterGain);
    osc.start(now); osc.stop(now + p.bodyLen + 0.02);

    const tailLen = Math.floor(rate * p.tailLen);
    const tailBuf = ctx.createBuffer(1, tailLen, rate);
    const td = tailBuf.getChannelData(0);
    for (let i = 0; i < tailLen; i++) td[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tailLen, 1.5);
    const tail = ctx.createBufferSource();
    tail.buffer = tailBuf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = p.tailLpf;
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(p.tailGain, now + 0.008);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + p.tailLen);
    tail.connect(lpf); lpf.connect(tailGain); tailGain.connect(this.masterGain);
    tail.start(now); tail.stop(now + p.tailLen + 0.02);
  }

  playThrow(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.22);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(500, now); bpf.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
    bpf.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + 0.24);
  }

  playMelee(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.13);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(1200, now); bpf.frequency.exponentialRampToValueAtTime(3600, now + 0.11);
    bpf.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + 0.14);
  }

  playSwitch(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(420, now);
    o.frequency.exponentialRampToValueAtTime(760, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 0.08);
  }

  playDoor(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.2);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4) * 0.5;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 300; bpf.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + 0.22);
  }

  playExplosion(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 0.6);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(1400, now); lpf.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.6, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + 0.62);

    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now); sub.frequency.exponentialRampToValueAtTime(28, now + 0.4);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(1.3, now); sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    sub.connect(sg); sg.connect(this.masterGain);
    sub.start(now); sub.stop(now + 0.5);
  }

  playBeep(high: boolean): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = high ? 1200 : 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 0.13);
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

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(180, now);
    thump.frequency.exponentialRampToValueAtTime(60, now + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.5, now); tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    thump.connect(tg); tg.connect(this.masterGain);
    thump.start(now); thump.stop(now + 0.11);
  }

  private click(atOffset: number, freq: number, q: number, gain: number, lenSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime + atOffset;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * lenSec);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = freq; bpf.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
    src.start(now); src.stop(now + lenSec + 0.02);
  }

  playReload(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || !this.sfxEnabled) return;
    this.click(0.0, 1500, 3, 0.5, 0.03);
    this.click(0.18, 1900, 2.5, 0.45, 0.028);
    this.click(0.34, 2600, 4, 0.4, 0.02);
    this.click(0.5, 900, 1.6, 0.55, 0.04);
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
