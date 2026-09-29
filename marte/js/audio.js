// Som procedural (Web Audio). Em Marte a pressão é ~0,7% da Terra: o vento lá fora
// chega muito abafado. Quase tudo que se ouve vem de dentro do traje: respiração,
// ventoinha e os passos conduzidos pelo corpo.
export class SuitAudio {
  constructor() { this.ctx = null; this.volume = 0.8; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; }   // ruído marrom
    this.noiseBuf = noiseBuf;
    const white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const wd = white.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.whiteBuf = white;

    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

    // vento externo: grave e abafado
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 220; wf.Q.value = 0.4;
    loop(noiseBuf).connect(wf).connect(this.windGain).connect(this.master);
    this.windFilter = wf;

    // ventoinha do sistema de suporte de vida
    this.fanGain = ctx.createGain(); this.fanGain.gain.value = 0.035;
    const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.7;
    loop(white).connect(ff).connect(this.fanGain).connect(this.master);
    const hum = ctx.createOscillator(); hum.frequency.value = 118; const hg = ctx.createGain(); hg.gain.value = 0.012;
    hum.connect(hg).connect(this.master); hum.start();

    // respiração: ruído filtrado com envelope cíclico
    this.breathGain = ctx.createGain(); this.breathGain.gain.value = 0;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1400; bf.Q.value = 0.9;
    loop(white).connect(bf).connect(this.breathGain).connect(this.master);
    this.breathFilter = bf;
    this.breathPhase = 0;
    this.effort = 0;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  // passo: batida grave conduzida pela bota e pelo traje
  step(strength = 0.5) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140 + strength * 120;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 * (0.4 + strength), t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + 0.3);
    // chiado de areia (bem abafado)
    const s2 = ctx.createBufferSource(); s2.buffer = this.whiteBuf;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 500; f2.Q.value = 1.2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.03 * (0.5 + strength), t + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s2.connect(f2).connect(g2).connect(this.master); s2.start(t, Math.random()); s2.stop(t + 0.25);
  }

  beep(freq = 880, dur = 0.08) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  update(dt, windSpeed, effort) {
    if (!this.ctx) return;
    this.effort += (effort - this.effort) * Math.min(1, dt * 0.5);
    // vento: intensidade cresce com o quadrado da velocidade, mas o ar rarefeito corta quase tudo
    const wv = Math.min(0.12, 0.0016 * windSpeed * windSpeed);
    this.windGain.gain.setTargetAtTime(wv, this.ctx.currentTime, 0.5);
    this.windFilter.frequency.setTargetAtTime(160 + windSpeed * 12, this.ctx.currentTime, 0.5);
    // respiração: 14 a 30 ciclos por minuto conforme o esforço
    const rate = (14 + 16 * this.effort) / 60;
    this.breathPhase += dt * rate;
    const p = this.breathPhase % 1;
    const inhale = p < 0.4 ? Math.sin(p / 0.4 * Math.PI) : 0;
    const exhale = p > 0.5 && p < 0.95 ? Math.sin((p - 0.5) / 0.45 * Math.PI) * 0.7 : 0;
    const amp = (inhale + exhale) * (0.02 + 0.05 * this.effort);
    this.breathGain.gain.setTargetAtTime(amp, this.ctx.currentTime, 0.05);
    this.breathFilter.frequency.setTargetAtTime(p < 0.45 ? 1600 : 1100, this.ctx.currentTime, 0.1);
  }
}
