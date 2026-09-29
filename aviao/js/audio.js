// Som procedural: motor de 4 cilindros (frequência de explosão = RPM/60 × 2), hélice,
// vento que cresce com a velocidade, buzina de estol, rolagem no chão, pneus no toque e impacto.
export class FlightAudio {
  constructor() { this.ctx = null; this.volume = 0.8; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = noise;
    const loop = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    // motor: dente de serra + harmônico, filtrado
    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth';
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 600; ef.Q.value = 1.5; this.engF = ef;
    this.engG = ctx.createGain(); this.engG.gain.value = 0;
    const e2g = ctx.createGain(); e2g.gain.value = 0.35;
    this.eng.connect(ef); this.eng2.connect(e2g).connect(ef); ef.connect(this.engG).connect(this.master);
    this.eng.start(); this.eng2.start();
    // hélice
    const pf = ctx.createBiquadFilter(); pf.type = 'bandpass'; pf.Q.value = 0.8; this.propF = pf;
    this.propG = ctx.createGain(); this.propG.gain.value = 0;
    loop().connect(pf).connect(this.propG).connect(this.master);
    // vento
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.5; this.windF = wf;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    loop().connect(wf).connect(this.windG).connect(this.master);
    // buzina de estol (~1,6 kHz)
    this.horn = ctx.createOscillator(); this.horn.frequency.value = 1580; this.horn.type = 'triangle';
    this.hornG = ctx.createGain(); this.hornG.gain.value = 0;
    this.horn.connect(this.hornG).connect(this.master); this.horn.start();
    // rolagem no chão
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
    this.rollG = ctx.createGain(); this.rollG.gain.value = 0;
    loop().connect(rf).connect(this.rollG).connect(this.master);
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  update(o, inside, onGround, stallWarn) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, rpm = o.rpm || 0, v = o.tas || 0;
    const fire = rpm / 60 * 2;
    this.eng.frequency.setTargetAtTime(Math.max(fire, 5), t, 0.05);
    this.eng2.frequency.setTargetAtTime(Math.max(fire * 0.5, 3), t, 0.05);
    this.engF.frequency.setTargetAtTime(inside ? 350 + rpm * 0.15 : 700 + rpm * 0.4, t, 0.1);
    this.engG.gain.setTargetAtTime(rpm > 50 ? (0.05 + rpm / 2700 * 0.12) * (inside ? 1 : 0.8) : 0, t, 0.1);
    this.propF.frequency.setTargetAtTime(rpm / 60 * 2 * 6 + 200, t, 0.1);
    this.propG.gain.setTargetAtTime(rpm / 2700 * (inside ? 0.05 : 0.12), t, 0.1);
    this.windF.frequency.setTargetAtTime(300 + v * 12, t, 0.2);
    this.windG.gain.setTargetAtTime(Math.min(0.25, v * v * 0.00004) * (inside ? 0.6 : 1), t, 0.2);
    this.hornG.gain.setTargetAtTime(stallWarn ? 0.05 : 0, t, 0.03);
    this.rollG.gain.setTargetAtTime(onGround ? Math.min(0.3, v * 0.012) : 0, t, 0.05);
  }

  burst(kind, amount = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 'chirp') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2; g.gain.setValueAtTime(0.18 * amount, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); }
    else { f.type = 'lowpass'; f.frequency.value = 400; g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8); }
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 2);
  }

  beep(freq = 880, dur = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
}
