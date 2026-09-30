// Som procedural do GOLAÇO (Web Audio). Nada de amostras gravadas: a torcida é
// feita de centenas de "vozes" sintetizadas (fonte glotal + formantes) pré-renderizadas
// em buffers que tocam em loop, somadas a faixas de ruído rosa, gritos e assobios
// esporádicos. A bateria de samba e o canto da torcida também são sintetizados.
//
// Cadeia: fontes → barramento torcida / efeitos → master → compressor → limitador
// → clipador suave → saída. Um reverb de convolução (resposta gerada) simula o estádio.
//
// Tudo é no-op antes de unlock(). Para testes, _attach(ctx) aceita um OfflineAudioContext
// e _clock fixa o relógio usado no agendamento.

const VOWELS = { a: [800, 1200], e: [450, 1900], i: [320, 2250], o: [480, 820], u: [330, 700] };
const VSR = 16000;                     // taxa das vozes pré-sintetizadas (formantes < 3 kHz)
const rand = (a, b) => a + Math.random() * (b - a);
// ruído rápido (xorshift) para os laços por amostra: -1..1
let _seed = (Math.random() * 0xffffffff) | 1;
const frnd = () => { _seed ^= _seed << 13; _seed ^= _seed >>> 17; _seed ^= _seed << 5; return (_seed | 0) / 2147483648; };
const pick = (s) => s[(Math.random() * s.length) | 0];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- DSP em JS para os buffers ----------

// passa-banda RBJ (pico 0 dB): [b0, a1, a2] já normalizados (b2 = -b0)
function bpCoef(f, q, sr) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  return [al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0];
}

// uma voz: serra com jitter/vibrato + sopro, dois formantes; soma em L/R
function renderVoice(L, R, sr, v) {
  const notes = v.notes; if (!notes.length) return;
  const n = L.length, pl = Math.cos((v.pan + 1) * Math.PI / 4), pr = Math.sin((v.pan + 1) * Math.PI / 4);
  const kA = 1 - Math.exp(-1 / (sr * (v.att || 0.035)));
  const kG = 1 - Math.exp(-1 / (sr * (v.glide || 0.05)));
  const kF = Math.min(1, 32 / (sr * 0.045));
  const vibP = Math.random() * 6.28, vibR = v.vibRate || rand(4.5, 6), vib = v.vib ?? 0.012, br = v.breath ?? 0.2;
  const sw = 1 - br, nw = br * 1.6, isr = 1 / sr;
  let ni = 0, ph = Math.random(), amp = 0, f = notes[0].f, jit = 0, mod = 1;
  const F = VOWELS[notes[0].vw].slice();
  let c1 = bpCoef(F[0], 5, sr), c2 = bpCoef(F[1], 9, sr);
  let a0 = c1[0], a1 = c1[1], a2 = c1[2], b0 = c2[0], b1 = c2[1], b2 = c2[2];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
  let nt = notes[0], tOn = nt.t, tOff = nt.t + nt.d;
  for (let i = 0; i < n; i++) {
    const t = i * isr;
    if (ni + 1 < notes.length && notes[ni + 1].t <= t) { nt = notes[++ni]; tOn = nt.t; tOff = nt.t + nt.d; }
    const on = t >= tOn && t < tOff;
    amp += ((on ? nt.a : 0) - amp) * kA;
    if (amp < 2e-4 && !on) continue;
    if (amp < 0.02) f = nt.f; else f += (nt.f - f) * kG;
    if ((i & 31) === 0) {                     // controle a cada 32 amostras: vibrato, jitter, formantes
      jit = jit * 0.97 + frnd() * 0.004;
      mod = 1 + vib * Math.sin(vibP + 6.2832 * vibR * t) + jit;
      const T = VOWELS[nt.vw];
      F[0] += (T[0] - F[0]) * kF; F[1] += (T[1] - F[1]) * kF;
      c1 = bpCoef(F[0], 5, sr); c2 = bpCoef(F[1], 9, sr);
      a0 = c1[0]; a1 = c1[1]; a2 = c1[2]; b0 = c2[0]; b1 = c2[1]; b2 = c2[2];
    }
    ph += f * mod * isr;
    if (ph >= 1) ph -= 1;
    const s = (2 * ph - 1) * sw + frnd() * nw, d = s - x2;
    const o1 = a0 * d - a1 * y1 - a2 * y2; y2 = y1; y1 = o1;
    const o2 = b0 * d - b1 * z1 - b2 * z2; z2 = z1; z1 = o2;
    x2 = x1; x1 = s;
    const o = (o1 + 0.65 * o2) * amp;
    L[i] += o * pl; R[i] += o * pr;
  }
}

function normalize(chs, peak) {
  let m = 1e-9;
  for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; }
  const k = peak / m;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= k;
}

// fecha o loop: cruza os últimos x amostras (além de n) com o começo
function loopify(c, n, x) {
  const o = c.slice(0, n);
  for (let i = 0; i < x; i++) { const a = i / x * Math.PI / 2; o[i] = c[i] * Math.sin(a) + c[n + i] * Math.cos(a); }
  return o;
}

function toBuffer(ctx, sr, L, R) {
  const b = ctx.createBuffer(2, L.length, sr);
  b.getChannelData(0).set(L); b.getChannelData(1).set(R);
  return b;
}

// frases faladas (murmúrio): sílabas curtas com entonação caindo e pausas
function talkNotes(dur, base) {
  const out = []; let t = Math.random() * 0.8;
  while (t < dur) {
    const k = 2 + ((Math.random() * 7) | 0); let fb = base * rand(0.95, 1.25);
    for (let j = 0; j < k && t < dur; j++) {
      const d = rand(0.09, 0.24);
      out.push({ t, d: d * 0.85, f: fb * rand(0.92, 1.08), vw: pick('aeiou'), a: rand(0.35, 1) });
      t += d; fb *= 0.97;
    }
    t += rand(0.15, 1.2);
  }
  return out;
}

// gritos sustentados ("aaaah", "ôôô")
function shoutNotes(dur, base) {
  const out = []; let t = Math.random() * 0.3;
  while (t < dur) {
    const d = rand(0.5, 1.8);
    out.push({ t, d, f: base * rand(0.9, 1.2), vw: pick('aaaooe'), a: rand(0.55, 1) });
    t += d + rand(0.03, 0.25);
  }
  return out;
}

// os construtores pesados são geradores: cada yield é uma fatia de ~10-30 ms
function* crowdVoices(ctx, dur, count, gen, lo, hi, opts) {
  const x = Math.round(0.5 * VSR), n = Math.round(dur * VSR);
  const L = new Float32Array(n + x), R = new Float32Array(n + x);
  for (let k = 0; k < count; k++) {
    const base = rand(lo, hi);
    renderVoice(L, R, VSR, { notes: gen(dur + 0.5, base), pan: rand(-0.95, 0.95), ...opts });
    if (k % 4 === 3) yield;
  }
  const l = loopify(L, n, x), r = loopify(R, n, x);
  normalize([l, r], 0.9);
  return toBuffer(ctx, VSR, l, r);
}

// aplauso: centenas de palmas (ruído em passa-banda com decaimento rápido)
function* renderApplause(ctx, dur, density) {
  const sr = ctx.sampleRate, x = Math.round(0.3 * sr), n = Math.round(dur * sr);
  const chs = [new Float32Array(n + x), new Float32Array(n + x)];
  for (const c of chs) {
    const total = Math.round((dur + 0.3) * density);
    for (let k = 0; k < total; k++) {
      const t0 = Math.floor(Math.random() * (n + x)), dec = rand(0.005, 0.016), a = rand(0.25, 1);
      const [b0, a1, a2] = bpCoef(rand(900, 2700), rand(1, 2.4), sr);
      const len = Math.min(n + x - t0, Math.round(dec * 6 * sr));
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, e = 1;
      const de = Math.exp(-1 / (dec * sr)), att = 0.0008 * sr;
      for (let i = 0; i < len; i++) {
        const s = frnd() * e * (i < att ? i / att : 1); e *= de;
        const y = b0 * (s - x2) - a1 * y1 - a2 * y2; y2 = y1; y1 = y; x2 = x1; x1 = s;
        c[t0 + i] += y * a;
      }
    }
    yield;
  }
  const l = loopify(chs[0], n, x), r = loopify(chs[1], n, x);
  normalize([l, r], 0.9);
  return toBuffer(ctx, sr, l, r);
}

// bateria de samba + torcida cantando, 8 compassos a 130 bpm, loop perfeito
function* renderChant(ctx) {
  const sr = Math.min(ctx.sampleRate, 48000);
  const beat = 60 / 130, bar = beat * 4, bars = 8, dur = bar * bars, s16 = beat / 4;
  const n = Math.round(dur * sr), tail = Math.round(0.8 * sr);
  const L = new Float32Array(n + tail), R = new Float32Array(n + tail);
  const TAU = Math.PI * 2;
  // cada instrumento: 3 variações pré-renderizadas; as batidas só somam cópias com ganho
  const inst = (len, fn) => {
    const m = Math.round(len * sr);
    return [0, 1, 2].map(() => {
      const o = new Float32Array(m); let p = 0;
      for (let i = 0; i < m; i++) { const w = frnd(), nz = (w - p) * 0.5; p = w; o[i] = fn(i / sr, nz); }
      return o;
    });
  };
  const hit = (t, smp, a, pan) => {
    const s = smp[(Math.random() * 3) | 0], i0 = Math.round(t * sr), pl = Math.cos((pan + 1) * Math.PI / 4) * a, pr = Math.sin((pan + 1) * Math.PI / 4) * a;
    for (let i = 0; i < s.length && i0 + i < L.length; i++) { L[i0 + i] += s[i] * pl; R[i0 + i] += s[i] * pr; }
  };
  const surdoS = (f, dec) => inst(dec * 4.5, (tt, nz) =>
    Math.sin(TAU * (f * tt + f * 0.6 * 0.03 * (1 - Math.exp(-tt / 0.03)))) * Math.exp(-tt / dec) + nz * 0.5 * Math.exp(-tt / 0.004));
  const SEG = surdoS(76, 0.14), TER = surdoS(64, 0.2); yield;
  const PRI = surdoS(55, 0.5); yield;
  const CX = inst(0.16, (tt, nz) => nz * 1.6 * Math.exp(-tt / 0.045) + Math.sin(TAU * 205 * tt) * 0.35 * Math.exp(-tt / 0.02));
  const TB = inst(0.12, (tt, nz) => Math.sin(TAU * 910 * tt) * 0.6 * Math.exp(-tt / 0.03) + Math.sin(TAU * 1370 * tt) * 0.25 * Math.exp(-tt / 0.018) + nz * Math.exp(-tt / 0.006));
  const RP = inst(0.4, (tt, nz) => Math.sin(TAU * 470 * tt) * Math.exp(-tt / 0.09) + Math.sin(TAU * 760 * tt) * 0.4 * Math.exp(-tt / 0.05) + nz * 0.7 * Math.exp(-tt / 0.005));
  const GZ = inst(0.09, (tt, nz) => nz * Math.min(1, tt / 0.012) * Math.exp(-tt / 0.03));
  yield;
  const surdo = (t, which, a, pan) => hit(t, which, a, pan);
  const caixa = (t, a, pan) => hit(t, CX, a, pan);
  const tamborim = (t, a, pan) => hit(t, TB, a, pan);
  const repique = (t, a, pan) => hit(t, RP, a, pan);
  const ganza = (t, a, pan) => hit(t, GZ, a, pan);
  const tel = [0, 2, 4, 5, 7, 9, 11, 12, 14];            // teleco-teco do tamborim
  const call = [0, 3, 6, 8, 10, 12, 13, 14];              // chamada do repique
  for (let b = 0; b < bars; b++) for (let s = 0; s < 16; s++) {
    const t = b * bar + s * s16 + (s & 1 ? s16 * 0.1 : 0) + rand(-0.004, 0.004);   // leve "ginga"
    if (s === 0 || s === 8) surdo(t, SEG, 0.55, -0.3);               // segunda (abafado)
    if (s === 4 || s === 12) surdo(t, PRI, 1.0, 0.25);               // primeira (aberto)
    if ((s === 6 || s === 14) && b % 2) surdo(t, TER, 0.5, 0.05);    // terceira
    const roll = (b === 3 || b === 7) && s >= 12;
    caixa(t, [3, 6, 11, 14].includes(s) ? 0.34 : 0.13, 0.35);
    if (roll) caixa(t + s16 / 2, 0.2, 0.35);
    if (tel.includes(s)) tamborim(t, s === 0 || s === 7 ? 0.32 : 0.22, -0.55);
    ganza(t, s % 4 === 2 ? 0.2 : 0.1, 0.6);
    if (b === 0 ? call.includes(s) : s === 7 || s === 15) repique(t, 0.36, -0.1);
    if (s === 15 && b % 3 === 2) yield;
  }
  yield;
  const drums = [L.slice(), R.slice()];
  normalize(drums, 0.8);
  // melodia (em batidas): [início, duração, midi, vogal]
  const A = [[0, 1, 62, 'o'], [1, 1, 66, 'e'], [2, 0.5, 69, 'o'], [2.5, 0.5, 69, 'e'], [3, 1, 66, 'o']];
  const B = [[0, 1, 64, 'o'], [1, 1, 67, 'e'], [2, 2, 64, 'o']];
  const C = [[0, 1, 64, 'o'], [1, 0.5, 62, 'e'], [1.5, 0.5, 62, 'o'], [2, 1.9, 62, 'a']];
  const tune = [A, B, A, C, A, B, A, C];
  const vn = Math.round(dur * VSR), vt = Math.round(0.8 * VSR);
  const vL = new Float32Array(vn + vt), vR = new Float32Array(vn + vt);
  for (let k = 0; k < 10; k++) {
    const oct = k < 7 ? -12 : 0, det = rand(-0.25, 0.25), notes = [];
    tune.forEach((ph, b) => ph.forEach(([st, d, m, vw]) => notes.push({
      t: b * bar + st * beat + rand(-0.02, 0.035), d: d * beat * 0.9, f: midiHz(m + oct + det), vw, a: rand(0.7, 1) })));
    renderVoice(vL, vR, VSR, { notes, pan: rand(-0.9, 0.9), att: 0.03, glide: 0.035, vib: 0.01, breath: 0.3 });
    yield;
  }
  normalize([vL, vR], 0.8);
  // junta, reamostrando as vozes (interpolação linear) e dobrando a cauda no começo (periodicidade)
  const oL = new Float32Array(n), oR = new Float32Array(n), q = VSR / sr;
  for (let i = 0; i < n + tail; i++) {
    const p = i * q, j = p | 0, fr = p - j;
    const vl = j + 1 < vL.length ? vL[j] + (vL[j + 1] - vL[j]) * fr : 0, vr = j + 1 < vR.length ? vR[j] + (vR[j + 1] - vR[j]) * fr : 0;
    const k = i % n;
    oL[k] += drums[0][i] * 0.62 + vl * 0.55; oR[k] += drums[1][i] * 0.62 + vr * 0.55;
  }
  normalize([oL, oR], 0.9);
  return toBuffer(ctx, sr, oL, oR);
}

// resposta ao impulso de um estádio: reflexões iniciais + cauda que escurece (RT60 ~2,4 s)
function stadiumIR(ctx) {
  const sr = ctx.sampleRate, len = Math.round(2.6 * sr), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    const pre = Math.round(0.018 * sr), att = 0.04 * sr;
    const dAmp = Math.exp(-6.9 / (2.4 * sr)), dK = Math.exp(-1 / (0.35 * sr));
    let amp = 1, kk = 0.55;
    for (let i = pre; i < len; i++) {
      lp += (frnd() - lp) * (kk + 0.08);                     // fica mais escuro com o tempo
      const j = i - pre;
      d[i] = lp * amp * (j < att ? j / att : 1);
      amp *= dAmp; kk *= dK;
    }
    for (let r = 0; r < 7; r++) {                                   // ecos das arquibancadas
      const i = pre + Math.round(rand(0.01, 0.12) * sr); d[i] += rand(-0.6, 0.6);
    }
  }
  return b;
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.9, crowd: 0.8, sfx: 0.9 };
    this.ex = 0.3; this.threat = 0; this.boost = 0;
    this._clock = null;          // relógio fixo (render offline); null = ctx.currentTime
    this._ends = [];             // fim das vozes ativas (limite de polifonia)
    this.maxVoices = 42;
    this._chantOn = false; this._chantOffAt = 0;
    this._last = {};
    this._paused = false;
    this._acc = 0;
    this._next = { shout: 1, whistle: 3, swell: 0 };
    this._sw = [1, 1, 1, 1, 1, 1];
    this._jobs = {}; this._queue = [];
  }

  // ---------- ciclo de vida ----------

  unlock() {
    try {
      if (this.ctx) { if (!this._paused) this._resumeCtx(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      let ctx; try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      this._attach(ctx, true);
      // iOS: tocar algo dentro do gesto destrava a saída
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
      this._resumeCtx();
      // buffers pesados em etapas, fora do gesto
      this._queue = ['ir', 'babble', 'applause', 'roar', 'chant'];
      setTimeout(() => this._tick(), 30);
    } catch (e) { console.warn('GameAudio.unlock', e); }
  }

  _resumeCtx() {
    const c = this.ctx; if (!c || c.state === 'running' || !c.resume) return;
    try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignora */ }
  }

  suspend() {
    this._paused = true;
    const c = this.ctx; if (!c || !c.suspend) return;
    try { const p = c.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignora */ }
  }

  resume() { this._paused = false; this._resumeCtx(); }

  setVolumes(v = {}) {
    if (!v) return;
    for (const k of ['master', 'crowd', 'sfx']) if (typeof v[k] === 'number') this.vol[k] = clamp01(v[k]);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterG.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.crowdG.gain.setTargetAtTime(this.vol.crowd, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  // monta o grafo num contexto (real ou offline)
  _attach(ctx, lazyIR = false) {
    this.ctx = ctx;
    const sr = ctx.sampleRate, g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    // ruídos reaproveitados
    const white = ctx.createBuffer(1, sr * 2, sr), wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = frnd();
    const pink = ctx.createBuffer(2, sr * 3, sr);
    for (let c = 0; c < 2; c++) {
      const d = pink.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = frnd();
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
      }
    }
    const brown = ctx.createBuffer(1, sr * 2, sr), bd = brown.getChannelData(0);
    { let b = 0; for (let i = 0; i < bd.length; i++) { b = (b + 0.02 * frnd()) / 1.02; bd[i] = b * 3.5; } }
    this.bufs = { white, pink, brown };

    // saída: master → compressor (cola) → limitador → clipador suave
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
    const trim = g(0.8);
    const clip = ctx.createWaveShaper(), N = 2048, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1) * 2 - 1, a = Math.abs(x);
      curve[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.26 * Math.tanh((a - 0.7) / 0.26));
    }
    clip.curve = curve; clip.oversample = '2x';
    this.masterG = g(this.vol.master);
    this.masterG.connect(comp); comp.connect(lim); lim.connect(trim); trim.connect(clip); clip.connect(ctx.destination);

    // reverb do estádio
    const conv = ctx.createConvolver(); if (!lazyIR) conv.buffer = stadiumIR(ctx);
    const ret = g(0.7); conv.connect(ret); ret.connect(this.masterG);

    // barramentos
    this.crowdIn = g(1); this.crowdG = g(this.vol.crowd);
    this.crowdIn.connect(this.crowdG); this.crowdG.connect(this.masterG);
    const cs = g(0.4); this.crowdG.connect(cs); cs.connect(conv);
    this.sfxIn = g(1); this.sfxG = g(this.vol.sfx);
    this.sfxIn.connect(this.sfxG); this.sfxG.connect(this.masterG);
    this.hitIn = g(4.5); this.hitIn.connect(this.sfxIn);                 // impactos (bola, corpos)
    const ss = g(0.12); this.sfxG.connect(ss); ss.connect(conv);
    this.whIn = g(1); this.whIn.connect(this.sfxG);                      // apito: mais reverb
    const ws = g(0.35); this.whIn.connect(ws); ws.connect(conv);
    this.conv = conv;

    // cama da torcida: faixas de ruído rosa (massa de gente ao longe)
    this.bed = {};
    const band = (type, f, q, off, v) => {
      const s = ctx.createBufferSource(); s.buffer = pink; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = g(v); s.connect(fl); fl.connect(gg); gg.connect(this.crowdIn); s.start(0, off);
      return { g: gg, f: fl };
    };
    this.bed.rumble = band('lowpass', 260, 0.5, 0, 0.12);
    this.bed.mid = band('bandpass', 750, 0.7, 1.3, 0.1);
    this.bed.hi = band('bandpass', 2300, 0.9, 2.7, 0.03);
    // canto (volume próprio)
    this.chantG = g(0); this.chantG.connect(this.crowdIn);
    this.chantSrc = null;
    this.setVolumes({});
  }

  // gerador que constrói o recurso 'key'
  _gen(key) {
    const c = this.ctx;
    if (key === 'babble') return crowdVoices(c, 6, 18, talkNotes, 95, 230, { breath: 0.25, vib: 0.01 });
    if (key === 'roar') return crowdVoices(c, 6, 22, shoutNotes, 170, 400, { breath: 0.4, vib: 0.02, att: 0.08, glide: 0.12 });
    if (key === 'applause') return renderApplause(c, 4, 90);
    if (key === 'chant') return renderChant(c);
    return (function* () { return stadiumIR(c); })();
  }

  _has(key) { return key === 'ir' ? !!this.conv.buffer : !!this.bufs[key]; }

  // recurso pronto: guarda e liga as camadas contínuas da torcida
  _install(key, buf) {
    const ctx = this.ctx;
    if (key === 'ir') { this.conv.buffer = buf; return; }
    this.bufs[key] = buf;
    if (key === 'chant' && this._chantOn) this.chant(true);
    const L = { babble: ['murmur', 0.22, 2200], applause: ['claps', 0, 5000], roar: ['roar', 0.05, 1500] }[key];
    if (!L) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = L[2]; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = L[1];
    s.connect(f); f.connect(g); g.connect(this.crowdIn);
    s.start(this._t(), Math.random() * buf.duration);
    this.bed[L[0]] = { g, f };
  }

  // termina já (síncrono) o que faltar de 'key'
  _need(key) {
    if (!this.ctx || this._has(key)) return;
    const g = this._jobs[key] || this._gen(key); delete this._jobs[key];
    let r; while (!(r = g.next()).done);
    this._install(key, r.value);
  }

  // uma fatia da fila de construção por vez (não trava o quadro)
  _tick() {
    while (this._queue.length && this._has(this._queue[0])) this._queue.shift();
    const key = this._queue[0]; if (!key) return;
    try {
      const g = this._jobs[key] || (this._jobs[key] = this._gen(key)), r = g.next();
      if (r.done) { delete this._jobs[key]; this._queue.shift(); this._install(key, r.value); }
    } catch (e) { console.warn('GameAudio', e); this._queue.shift(); }
    setTimeout(() => this._tick(), 20);
  }

  _ensureBuffers(which) { for (const k of which ? [which] : ['babble', 'applause', 'roar']) this._need(k); }
  _ensureChant() { this._need('chant'); }

  // ---------- utilitários ----------

  _t() { return this.ctx ? (this._clock ?? this.ctx.currentTime) + 0.005 : null; }

  // reserva uma voz até 'end'; false se a polifonia estourou (prio alta passa com folga)
  _voice(end, prio = 1) {
    const now = this._clock ?? this.ctx.currentTime;
    if (this._ends.length > 16) this._ends = this._ends.filter((e) => e > now);
    const lim = prio > 1 ? this.maxVoices + 24 : prio < 1 ? this.maxVoices * 0.6 : this.maxVoices;
    if (this._ends.length >= lim) return false;
    this._ends.push(end); return true;
  }

  _throttle(key, gap) {
    const now = this._clock ?? this.ctx.currentTime;
    if (now - (this._last[key] ?? -1) < gap) return true;
    this._last[key] = now; return false;
  }

  _pan(p) {
    if (!this.ctx.createStereoPanner) return null;
    const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); return n;
  }

  _chain(...nodes) {
    const a = nodes.filter(Boolean);
    for (let i = 0; i < a.length - 1; i++) a[i].connect(a[i + 1]);
    return a[0];
  }

  // envelope: sobe em 'a' até 'peak', cai exponencial por 'd'
  _env(param, t, peak, a, d) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    param.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  // rajada de ruído filtrado
  _noise(t, o) {
    const ctx = this.ctx, dur = o.a + o.d;
    if (!this._voice(t + dur, o.prio ?? 1)) return null;
    const s = ctx.createBufferSource(); s.buffer = this.bufs[o.buf || 'white'];
    if (o.rate) s.playbackRate.value = o.rate;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q ?? 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ctx.createGain(); this._env(g.gain, t, o.peak, o.a, o.d);
    this._chain(s, f, g, o.pan != null ? this._pan(o.pan) : null, o.out || this.hitIn);
    s.start(t, Math.random() * (s.buffer.duration - dur - 0.1 > 0 ? s.buffer.duration - dur - 0.1 : 0)); s.stop(t + dur + 0.05);
    return g;
  }

  // tom com varredura de frequência (baque grave da bola, etc.)
  _tone(t, o) {
    const ctx = this.ctx, dur = o.a + o.d;
    if (!this._voice(t + dur, o.prio ?? 1)) return null;
    const s = ctx.createOscillator(); s.type = o.type || 'sine';
    s.frequency.setValueAtTime(o.f0, t);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || dur));
    const g = ctx.createGain(); this._env(g.gain, t, o.peak, o.a, o.d);
    this._chain(s, g, o.out || this.hitIn);
    s.start(t); s.stop(t + dur + 0.05);
    return g;
  }

  // trecho de um buffer em loop com envelope por pontos [[t, v], ...] e passa-baixa automatizado
  _bufEvent(t, buf, pts, lpPts, o = {}) {
    const ctx = this.ctx, end = t + pts[pts.length - 1][0];
    if (!buf || !this._voice(end, 2)) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    if (o.rate) s.playbackRate.value = o.rate;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(lpPts[0][1], t);
    for (const [dt, v] of lpPts) f.frequency.linearRampToValueAtTime(v, t + dt);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (const [dt, v] of pts) g.gain.linearRampToValueAtTime(v, t + dt);
    this._chain(s, f, g, this.crowdIn);
    s.start(t, Math.random() * buf.duration); s.stop(end + 0.05);
  }

  // coro de vozes com osciladores (uuuh, ôôô): pitch e vogal automatizados
  // pitch: [[dt, fatorDaFreq]], env: [[dt, ganho]], vowels: [[dt, 'o']]
  _choir(t, n, f0, pitch, env, vowels) {
    const ctx = this.ctx, end = t + env[env.length - 1][0];
    if (!this._voice(end, 2)) return;
    const mix = ctx.createGain(); mix.gain.value = 1 / Math.sqrt(n);
    const lfo = ctx.createOscillator(); lfo.frequency.value = rand(4.5, 6);
    const lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg);
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const base = f0 * rand(0.8, 1.25), dt0 = rand(0, 0.12);
      o.frequency.setValueAtTime(base * pitch[0][1], t);
      for (const [dt, v] of pitch) o.frequency.linearRampToValueAtTime(base * v * rand(0.97, 1.03), t + dt + dt0);
      lg.connect(o.detune);
      const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(rand(0.6, 1), t + 0.05 + dt0);
      o.connect(og); og.connect(mix); o.start(t); o.stop(end + 0.1);
    }
    const nz = ctx.createBufferSource(); nz.buffer = this.bufs.white; const ng = ctx.createGain(); ng.gain.value = 0.35;
    nz.connect(ng); ng.connect(mix); nz.start(t, Math.random()); nz.stop(end + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (const [dt, v] of env) g.gain.linearRampToValueAtTime(v, t + dt);
    const w = [0.9, 0.6, 0.12];
    for (let j = 0; j < 3; j++) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = j ? 9 : 5;
      const fv = (vw) => (j < 2 ? VOWELS[vw][j] : 2600);
      f.frequency.setValueAtTime(fv(vowels[0][1]), t);
      for (const [dt, vw] of vowels) f.frequency.linearRampToValueAtTime(fv(vw), t + dt);
      const fg = ctx.createGain(); fg.gain.value = w[j] * 2.2;
      mix.connect(f); f.connect(fg); fg.connect(g);
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this._chain(g, lp, this.crowdIn);
    lfo.start(t); lfo.stop(end + 0.1);
  }

  // grito isolado de um torcedor: vogal com glissando
  _shout(t, a, hiPitch) {
    const ctx = this.ctx, d = rand(0.35, 1.1), end = t + d + 0.2;
    if (!this._voice(end, 0)) return;
    const vw = pick(hiPitch ? 'aaei' : 'aoeuo'), f0 = hiPitch ? rand(380, 620) : rand(140, 340);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.88, t);
    o.frequency.linearRampToValueAtTime(f0 * rand(1.05, 1.25), t + d * 0.4);
    o.frequency.linearRampToValueAtTime(f0 * rand(0.75, 0.95), t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.06); g.gain.setTargetAtTime(0, t + d * 0.7, d * 0.15);
    const pan = this._pan(rand(-0.9, 0.9));
    for (let j = 0; j < 2; j++) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = VOWELS[vw][j] * rand(0.95, 1.1); f.Q.value = j ? 10 : 6;
      o.connect(f); f.connect(g);
    }
    this._chain(g, pan, this.crowdIn);
    o.start(t); o.stop(end);
  }

  // assobio de torcedor (dedos na boca): fiu-fiu ou longo com vibrato
  _fanWhistle(t, a, long) {
    const ctx = this.ctx, d = long ? rand(0.8, 1.8) : rand(0.25, 0.5), end = t + d + 0.1;
    if (!this._voice(end, 0)) return;
    const o = ctx.createOscillator(), f = rand(1900, 3300);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    if (long) {
      o.frequency.setValueAtTime(f * 0.9, t); o.frequency.linearRampToValueAtTime(f, t + 0.1);
      o.frequency.setValueAtTime(f, t + d - 0.15); o.frequency.linearRampToValueAtTime(f * 0.85, t + d);
      g.gain.linearRampToValueAtTime(a, t + 0.05); g.gain.setValueAtTime(a, t + d - 0.1); g.gain.linearRampToValueAtTime(0, t + d);
    } else {                                                     // subida rápida, pausa, descida (fiu-fiu)
      o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * 1.1, t + d * 0.4);
      o.frequency.exponentialRampToValueAtTime(f * 0.75, t + d);
      g.gain.linearRampToValueAtTime(a, t + 0.03); g.gain.linearRampToValueAtTime(a * 0.2, t + d * 0.45);
      g.gain.linearRampToValueAtTime(a, t + d * 0.55); g.gain.linearRampToValueAtTime(0, t + d);
    }
    const vib = ctx.createOscillator(); vib.frequency.value = rand(5, 7); const vg = ctx.createGain(); vg.gain.value = f * 0.012;
    vib.connect(vg); vg.connect(o.frequency);
    this._chain(o, g, this._pan(rand(-1, 1)), this.crowdIn);
    o.start(t); o.stop(end); vib.start(t); vib.stop(end);
  }

  // ---------- torcida ----------

  update(dt, s = {}) {
    const ctx = this.ctx; if (!ctx || this._paused) return;
    try {
      dt = Math.max(0, Math.min(0.25, num(dt, 0)));
      const ex = clamp01(num(s && s.excitement, this.ex)), th = clamp01(num(s && s.attackThreat, 0));
      this.ex += (ex - this.ex) * (1 - Math.exp(-dt / 0.9));
      this.threat += (th - this.threat) * (1 - Math.exp(-dt / (th > this.threat ? 0.5 : 1.4)));
      this.boost *= Math.exp(-dt / 5);
      const I = clamp01(0.15 + 0.5 * this.ex + 0.4 * this.threat * (0.6 + 0.4 * this.ex) + 0.3 * this.boost);
      this._I = I;
      const now = this._clock ?? ctx.currentTime, t = now + 0.005;
      // oscilações lentas e aleatórias de cada camada
      if ((this._next.swell -= dt) <= 0) {
        this._next.swell = rand(0.8, 2.2);
        this._sw[(Math.random() * this._sw.length) | 0] = rand(0.7, 1.3);
      }
      // parâmetros: ~10 vezes por segundo basta
      this._acc += dt;
      if (this._acc >= 0.1) {
        this._acc = 0;
        const b = this.bed, sw = this._sw, set = (p, v, tc = 0.6) => p.setTargetAtTime(v, t, tc);
        set(b.rumble.g.gain, (0.07 + 0.18 * I) * sw[0]);
        set(b.mid.g.gain, (0.04 + 0.14 * I) * sw[1]);
        set(b.hi.g.gain, (0.015 + 0.08 * I * I) * sw[2]);
        set(b.hi.f.frequency, 1900 + 1200 * I);
        const chant = this._chantOn ? 0.5 : 1;
        if (b.murmur) { set(b.murmur.g.gain, (0.19 - 0.06 * I) * sw[3] * chant); set(b.murmur.f.frequency, 1600 + 1400 * I); }
        if (b.roar) { set(b.roar.g.gain, (0.02 + 0.55 * I * I * I) * sw[4], 0.5); set(b.roar.f.frequency, 800 + 3600 * I, 0.5); }
        if (b.claps) set(b.claps.g.gain, (0.015 + 0.05 * this.ex) * sw[5] * (this._chantOn ? 0.4 : 1), 1);
        if (this.chantSrc) set(this.chantG.gain, this._chantOn ? 0.35 + 0.25 * I : 0, this._chantOn ? 1.2 : 1.5);
      }
      // gritos e assobios esporádicos (processo de Poisson)
      if ((this._next.shout -= dt) <= 0) {
        this._next.shout = -Math.log(1 - Math.random()) / (0.4 + 2.6 * I);
        this._shout(t + Math.random() * 0.05, rand(0.02, 0.06) * (0.6 + I), Math.random() < 0.25 * I);
      }
      if ((this._next.whistle -= dt) <= 0) {
        this._next.whistle = -Math.log(1 - Math.random()) / (0.06 + 0.7 * this.threat * this.threat + 0.2 * this.boost);
        this._fanWhistle(t, rand(0.012, 0.03) * (0.6 + I), Math.random() < 0.3);
      }
      // canto desligado há um tempo: libera a fonte
      if (!this._chantOn && this.chantSrc && now - this._chantOffAt > 8) {
        try { this.chantSrc.stop(t); } catch (e) { /* já parou */ }
        this.chantSrc = null;
      }
    } catch (e) { console.warn('GameAudio.update', e); }
  }

  crowd(kind, strength = 1) {
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t(), s = 0.3 + 0.7 * clamp01(num(strength, 1));
      if (kind === 'goal' || kind === 'cheer' || kind === 'save') this._ensureBuffers();
      const b = this.bufs;
      if (kind === 'goal') {
        this.boost = 1;
        const P = [[0, 0], [0.35, 0.95 * s], [1.2, 1.0 * s], [4, 0.8 * s], [6.5, 0.6 * s], [8.5, 0]];
        this._bufEvent(t, b.roar, P, [[0, 1500], [0.4, 5200], [6, 3800], [8.5, 1800]]);
        this._bufEvent(t + 0.05, b.roar, P.map(([a, v]) => [a, v * 0.7]), [[0, 1200], [0.5, 4500], [8.5, 1500]], { rate: 1.07 });
        this._bufEvent(t, b.babble, [[0, 0], [0.5, 0.5 * s], [5, 0.4 * s], [8, 0]], [[0, 3000], [8, 2000]], { rate: 1.3 });
        this._bufEvent(t + 1.2, b.applause, [[0, 0], [0.8, 0.35 * s], [5, 0.3 * s], [7.5, 0]], [[0, 6000], [7.5, 5000]]);
        // pisadas/estrondo grave na arquibancada
        this._noise(t, { buf: 'brown', type: 'lowpass', f: 160, q: 0.6, peak: 0.7 * s, a: 0.3, d: 4, out: this.crowdIn, prio: 2 });
        for (let k = 0; k < 12; k++) this._fanWhistle(t + rand(0.3, 6.5), rand(0.02, 0.05) * s, Math.random() < 0.4);
        for (let k = 0; k < 10; k++) this._shout(t + rand(0.1, 6), rand(0.05, 0.1) * s, Math.random() < 0.7);
        return;
      }
      if (kind === 'ooh') {
        const d = 2.3;
        this._choir(t, 8, rand(150, 200), [[0, 0.85], [0.5, 1.3], [d, 0.72]], [[0, 0], [0.45, 0.5 * s], [1.1, 0.35 * s], [d, 0]], [[0, 'o'], [0.6, 'o'], [d, 'u']]);
        this._bufEvent(t, b.roar, [[0, 0], [0.45, 0.35 * s], [d, 0]], [[0, 600], [0.5, 1500], [d, 500]], { rate: 0.95 });
        return;
      }
      if (kind === 'groan') {
        const d = 2;
        this._choir(t, 8, rand(200, 250), [[0, 1], [0.2, 1.05], [d, 0.6]], [[0, 0], [0.15, 0.45 * s], [0.8, 0.25 * s], [d, 0]], [[0, 'a'], [0.5, 'o'], [d, 'u']]);
        this._bufEvent(t, b.roar, [[0, 0], [0.12, 0.28 * s], [d, 0]], [[0, 1400], [d, 400]], { rate: 0.9 });
        return;
      }
      if (kind === 'boo') {
        const d = 3.2;
        this._choir(t, 10, rand(110, 150), [[0, 0.95], [1, 1.05], [2, 0.95], [d, 0.85]], [[0, 0], [0.4, 0.45 * s], [2.6, 0.4 * s], [d, 0]], [[0, 'u'], [d, 'u']]);
        for (let k = 0; k < 10; k++) this._fanWhistle(t + rand(0, 2), rand(0.03, 0.055) * s, true);
        return;
      }
      if (kind === 'save') {
        this._bufEvent(t, b.applause, [[0, 0], [0.25, 0.55 * s], [2, 0.45 * s], [3.5, 0]], [[0, 7000], [3.5, 5000]]);
        this._bufEvent(t, b.roar, [[0, 0], [0.3, 0.3 * s], [1.6, 0]], [[0, 1200], [1.6, 800]]);
        for (let k = 0; k < 3; k++) this._fanWhistle(t + rand(0.1, 1.5), 0.03 * s, false);
        return;
      }
      if (kind === 'cheer') {
        this.boost = Math.max(this.boost, 0.4);
        this._bufEvent(t, b.roar, [[0, 0], [0.25, 0.6 * s], [1, 0.5 * s], [2.2, 0]], [[0, 1500], [0.3, 4200], [2.2, 1500]]);
        this._bufEvent(t + 0.2, b.applause, [[0, 0], [0.4, 0.3 * s], [2.5, 0]], [[0, 6000], [2.5, 5000]]);
        for (let k = 0; k < 3; k++) this._shout(t + rand(0, 1), 0.07 * s, true);
      }
    } catch (e) { console.warn('GameAudio.crowd', e); }
  }

  chant(on) {
    this._chantOn = !!on;
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t();
      if (on) {
        if (!this.bufs.chant && this._queue.includes('chant')) {   // ainda construindo: adianta na fila
          this._queue = ['chant', ...this._queue.filter((k) => k !== 'chant')];
          return;                                                  // _install liga quando ficar pronto
        }
        this._ensureChant();
        if (!this.chantSrc) {
          const s = ctx.createBufferSource(); s.buffer = this.bufs.chant; s.loop = true;
          s.connect(this.chantG); s.start(t); this.chantSrc = s;
        }
        this.chantG.gain.cancelScheduledValues(t);
        this.chantG.gain.setTargetAtTime(0.35 + 0.25 * (this._I || 0.3), t, 1.2);
      } else {
        this._chantOffAt = t;
        this.chantG.gain.cancelScheduledValues(t);
        this.chantG.gain.setTargetAtTime(0, t, 1.5);
      }
    } catch (e) { console.warn('GameAudio.chant', e); }
  }

  // ---------- bola e contato ----------

  kick(power = 0.5, kind = 'pass') {
    if (!this.ctx) return;
    try {
      const t = this._t(), p = clamp01(num(power, 0.5));
      if (this._throttle('kick', 0.03)) return;
      if (kind === 'throw') {                     // mãos soltando a bola: quase nada
        this._noise(t, { f: 1200, q: 1.2, peak: 0.05 + 0.05 * p, a: 0.004, d: 0.05 });
        return;
      }
      const P = {
        header: { f0: 150, f1: 70, d: 0.1, peak: 0.3 + 0.25 * p, sf: 900, sq: 0.8, sp: 0.08 + 0.1 * p, sd: 0.03, type: 'lowpass' },
        gk: { f0: 160, f1: 48, d: 0.2, peak: 0.85, sf: 1700, sq: 0.9, sp: 0.35, sd: 0.035 },
        chip: { f0: 190, f1: 80, d: 0.07, peak: 0.25 + 0.2 * p, sf: 2800, sq: 1, sp: 0.2 + 0.2 * p, sd: 0.02 },
        pass: { f0: 170 + 30 * p, f1: 62, d: 0.07 + 0.05 * p, peak: 0.3 + 0.35 * p, sf: 1300 + 1500 * p, sq: 0.9, sp: 0.12 + 0.25 * p, sd: 0.022 },
      }[kind] || {                                  // shot, long, volley
        f0: 180 + 70 * p, f1: 55, d: 0.09 + 0.08 * p, peak: 0.45 + 0.5 * p, sf: 1500 + 2400 * p, sq: 0.8, sp: 0.2 + 0.5 * p, sd: 0.02 + 0.02 * p,
      };
      const pan = rand(-0.1, 0.1);
      this._tone(t, { f0: P.f0, f1: P.f1, sweep: P.d * 0.7, peak: P.peak, a: 0.002, d: P.d, prio: 2 });
      this._noise(t, { type: P.type || 'bandpass', f: P.sf, q: P.sq, peak: P.sp, a: 0.001, d: P.sd, pan, prio: 2 });
      // "clack" do couro: clique curto e agudo
      if (kind !== 'header') this._noise(t, { type: 'highpass', f: 3500, q: 0.7, peak: 0.08 + 0.2 * p, a: 0.0005, d: 0.008, pan });
      // bola cortando o ar num chute forte
      if (p > 0.65 && kind !== 'header') this._noise(t + 0.03, { f: 900, f2: 280, q: 1.2, peak: 0.05 * p, a: 0.05, d: 0.35, prio: 0 });
    } catch (e) { console.warn('GameAudio.kick', e); }
  }

  bounce(strength = 0.5) {
    if (!this.ctx) return;
    try {
      const t = this._t(), s = clamp01(num(strength, 0.5));
      if (s < 0.02 || this._throttle('bounce', 0.04)) return;
      this._tone(t, { f0: 95 + 30 * s, f1: 45, sweep: 0.06, peak: 0.12 + 0.3 * s, a: 0.002, d: 0.08 + 0.05 * s });
      this._noise(t, { type: 'lowpass', f: 500 + 700 * s, q: 0.7, peak: 0.05 + 0.12 * s, a: 0.002, d: 0.05, prio: 0 });
    } catch (e) { console.warn('GameAudio.bounce', e); }
  }

  post(strength = 0.8) {
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t(), s = clamp01(num(strength, 0.8));
      if (this._throttle('post', 0.08)) return;
      // trave de alumínio: parciais inarmônicos com decaimentos diferentes
      const f = rand(420, 480), R = [1, 2.32, 4.25, 6.63, 9.38, 13.1], A = [1, 0.75, 0.5, 0.35, 0.2, 0.1], D = [1.7, 1.3, 0.9, 0.6, 0.35, 0.2];
      if (!this._voice(t + 2, 2)) return;
      const out = ctx.createGain(); out.gain.value = 0.22 * (0.3 + 0.7 * s);
      this._chain(out, this._pan(rand(-0.3, 0.3)), this.sfxIn);
      R.forEach((r, i) => {
        for (const det of i === 0 ? [0, 1.3] : [0]) {                 // batimento na fundamental
          const o = ctx.createOscillator(); o.frequency.value = f * r + det;
          const g = ctx.createGain(); this._env(g.gain, t, A[i] * (det ? 0.5 : 1), 0.001, D[i] * (0.6 + 0.4 * s));
          o.connect(g); g.connect(out); o.start(t); o.stop(t + D[i] + 0.1);
        }
      });
      this._noise(t, { type: 'highpass', f: 2500, q: 0.7, peak: 0.08 * s + 0.02, a: 0.0005, d: 0.02, prio: 2 });
      this._tone(t, { f0: 160, f1: 60, sweep: 0.05, peak: 0.12 * s, a: 0.001, d: 0.08, prio: 2 });
    } catch (e) { console.warn('GameAudio.post', e); }
  }

  net(strength = 0.7) {
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t(), s = clamp01(num(strength, 0.7));
      if (this._throttle('net', 0.1)) return;
      const g = this._noise(t, { f: 4200, f2: 1600, q: 0.6, peak: 0.05 + 0.08 * s, a: 0.015, d: 0.5 + 0.2 * s, prio: 2 });
      if (g) {                                                       // tremulação da rede
        const l = ctx.createOscillator(); l.frequency.value = rand(14, 22);
        const lg = ctx.createGain(); lg.gain.value = 0.35 * (0.05 + 0.08 * s);
        l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + 0.8);
      }
      this._noise(t, { buf: 'brown', type: 'lowpass', f: 600, q: 0.5, peak: 0.08 + 0.08 * s, a: 0.01, d: 0.35 });
      this._tone(t, { f0: 120, f1: 60, sweep: 0.08, peak: 0.06 * s, a: 0.003, d: 0.12 });
    } catch (e) { console.warn('GameAudio.net', e); }
  }

  tackle(strength = 0.6) {
    if (!this.ctx) return;
    try {
      const t = this._t(), s = clamp01(num(strength, 0.6));
      if (this._throttle('tackle', 0.06)) return;
      this._noise(t, { buf: 'brown', type: 'lowpass', f: 320, q: 0.7, peak: 0.3 + 0.35 * s, a: 0.004, d: 0.15 });
      this._tone(t, { f0: 85, f1: 45, sweep: 0.1, peak: 0.2 + 0.25 * s, a: 0.003, d: 0.12 });
      // chuteira raspando na grama
      this._noise(t + 0.01, { f: 2600, f2: 1500, q: 0.7, peak: 0.06 + 0.12 * s, a: 0.03, d: 0.28 + 0.15 * s, pan: rand(-0.3, 0.3) });
    } catch (e) { console.warn('GameAudio.tackle', e); }
  }

  bodyHit(strength = 0.5) {
    if (!this.ctx) return;
    try {
      const t = this._t(), s = clamp01(num(strength, 0.5));
      if (this._throttle('body', 0.06)) return;
      this._noise(t, { buf: 'brown', type: 'lowpass', f: 260, q: 0.8, peak: 0.25 + 0.35 * s, a: 0.003, d: 0.12 });
      this._tone(t, { f0: 115, f1: 60, sweep: 0.06, peak: 0.15 + 0.2 * s, a: 0.002, d: 0.09 });
      this._noise(t, { type: 'highpass', f: 3000, q: 0.5, peak: 0.03 + 0.04 * s, a: 0.01, d: 0.08, prio: 0 });   // tecido
    } catch (e) { console.warn('GameAudio.bodyHit', e); }
  }

  catchBall() {
    if (!this.ctx) return;
    try {
      const t = this._t();
      if (this._throttle('catch', 0.08)) return;
      this._noise(t, { f: 1100, q: 1.2, peak: 0.35, a: 0.001, d: 0.05, prio: 2 });          // luva
      this._noise(t, { type: 'highpass', f: 2800, q: 0.7, peak: 0.1, a: 0.0005, d: 0.012 });
      this._tone(t, { f0: 140, f1: 70, sweep: 0.05, peak: 0.28, a: 0.002, d: 0.08 });
    } catch (e) { console.warn('GameAudio.catchBall', e); }
  }

  // ---------- apito do árbitro ----------

  // um sopro: portadora ~3 kHz modulada pela bolinha (~30 Hz) + sopro
  _blow(t, dur, k = 1) {
    const ctx = this.ctx, end = t + dur + 0.1;
    if (!this._voice(end, 2)) return;
    const f = rand(2950, 3250) * (k > 1 ? 1.04 : 1), rate = rand(26, 33);
    const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
    const fm = ctx.createGain(); fm.gain.value = 170 * k; lfo.connect(fm);
    const car = ctx.createOscillator(); car.frequency.setValueAtTime(f * 0.9, t);
    car.frequency.linearRampToValueAtTime(f, t + 0.04);
    car.frequency.setValueAtTime(f, t + dur - 0.05); car.frequency.linearRampToValueAtTime(f * 0.93, t + dur);
    fm.connect(car.frequency);
    const h = ctx.createOscillator(); h.type = 'triangle'; h.frequency.value = f * 2;
    const fm2 = ctx.createGain(); fm2.gain.value = 340 * k; lfo.connect(fm2); fm2.connect(h.frequency);
    const hg = ctx.createGain(); hg.gain.value = 0.1;
    const am = ctx.createGain(); am.gain.value = 0.6;                   // AM do trinado
    const amd = ctx.createGain(); amd.gain.value = 0.4; lfo.connect(amd); amd.connect(am.gain);
    car.connect(am); h.connect(hg); hg.connect(am);
    const nz = ctx.createBufferSource(); nz.buffer = this.bufs.white;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f; nf.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.value = 0.35; nz.connect(nf); nf.connect(ng); ng.connect(am);
    const env = ctx.createGain(), pk = 0.16 * k;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(pk, t + 0.02);
    env.gain.setValueAtTime(pk * 0.92, t + dur - 0.06); env.gain.linearRampToValueAtTime(0, t + dur);
    this._chain(am, env, this.whIn);
    for (const o of [lfo, car, h]) { o.start(t); o.stop(end); }
    nz.start(t, Math.random()); nz.stop(end);
  }

  whistle(kind = 'short') {
    if (!this.ctx) return;
    try {
      const t = this._t();
      if (this._throttle('whistle', 0.15)) return;
      if (kind === 'foul') this._blow(t, 0.5, 1.25);
      else if (kind === 'long') this._blow(t, 1.25, 1.05);
      else if (kind === 'half') { this._blow(t, 0.9, 1.05); this._blow(t + 1.15, 0.95, 1.05); }
      else if (kind === 'end') { this._blow(t, 0.24, 1); this._blow(t + 0.38, 0.24, 1); this._blow(t + 0.76, 1.6, 1.1); }
      else this._blow(t, 0.28, 1);
    } catch (e) { console.warn('GameAudio.whistle', e); }
  }
}
