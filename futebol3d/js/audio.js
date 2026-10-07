// Som procedural do GOLAÇO (Web Audio). Nada de amostras gravadas: a torcida é
// feita de centenas de "vozes" sintetizadas (fonte glotal + formantes) pré-renderizadas
// em buffers que tocam em loop, somadas a faixas de ruído rosa, gritos, assobios,
// rojões e sinalizadores. A bateria (surdo, caixa, repique, tamborim, ganzá, bumbo) e
// os cantos da torcida (samba, "olê", palmas com "uh!", hino) também são sintetizados.
//
// Cadeia: fontes → barramento torcida (compressor próprio) / efeitos → master
// → compressor → limitador → clipador suave → saída. Um reverb de convolução
// (resposta gerada) e dois ecos (arquibancadas opostas) simulam o estádio.
//
// Camadas contínuas: ruído rosa em 3 faixas, murmúrio em 2 cópias (esquerda/direita),
// rugido em 2 cópias + uma camada "distante", aplauso e vaia (humor da casa).
// Um único "tocador de canto" (_song) faz crossfade entre os cantos longos: hino >
// festa do gol > pré-jogo > diretor de cantos da partida. O canto do jogo (chant())
// tem fonte própria e é abafado quando outro canto está tocando.
//
// Tudo é no-op antes de unlock(). Para testes, _attach(ctx) aceita um OfflineAudioContext
// (constrói tudo de forma síncrona) e _clock fixa o relógio usado no agendamento.

const VOWELS = { a: [800, 1200], e: [450, 1900], i: [320, 2250], o: [480, 820], u: [330, 700] };
const VSR = 16000;                     // taxa das vozes pré-sintetizadas (formantes < 3 kHz)
const CSR = 24000;                     // taxa dos cantos com bateria (economiza memória no celular)
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

// vaia: "uuuuu" grave e longo, cada torcedor no seu fôlego
function booNotes(dur, base) {
  const out = []; let t = Math.random() * 0.4;
  while (t < dur) {
    const d = rand(1.2, 2.8);
    out.push({ t, d, f: base * rand(0.95, 1.06), vw: pick('uuuo'), a: rand(0.6, 1) });
    t += d + rand(0.05, 0.4);
  }
  return out;
}

// "uhhhh" de chance perdida: sobe junto com a bola e cai em lamento
function oohNotes(base) {
  const j = rand(0, 0.15);
  return [
    { t: j, d: 0.5, f: base * 0.85, vw: 'o', a: 0.5 },
    { t: j + 0.5, d: 0.75, f: base * 1.3, vw: 'o', a: 1 },
    { t: j + 1.25, d: rand(1.2, 1.8), f: base * 0.68, vw: 'u', a: 0.6 },
  ];
}

// "GOOOOOL" coletivo: arranca de baixo, sobe e sustenta o "ô" até perder o fôlego,
// respira e emenda um "ÉÉÉ" mais agudo (cada torcedor no seu tempo)
function golNotes(base) {
  const j = rand(0, 0.25), d = rand(3, 4.6), r = j + 0.35 + d + rand(0.15, 0.5);
  return [
    { t: j, d: 0.38, f: base * 0.8, vw: 'o', a: 0.7 },
    { t: j + 0.36, d, f: base * rand(1.12, 1.22), vw: 'o', a: 1 },
    { t: r, d: rand(1.2, 2.2), f: base * rand(1.25, 1.4), vw: pick('eea'), a: rand(0.6, 0.9) },
  ];
}

// os construtores pesados são geradores: cada yield é uma fatia de ~10-30 ms
function* crowdVoices(ctx, dur, count, gen, lo, hi, opts) {
  const x = Math.round(0.5 * VSR), n = Math.round(dur * VSR);
  const L = new Float32Array(n + x), R = new Float32Array(n + x);
  for (let k = 0; k < count; k++) {
    const base = rand(lo, hi);
    renderVoice(L, R, VSR, { notes: gen(dur + 0.5, base), pan: rand(-0.95, 0.95), ...opts });
    if (k & 1) yield;
  }
  const l = loopify(L, n, x), r = loopify(R, n, x);
  normalize([l, r], 0.9);
  return toBuffer(ctx, VSR, l, r);
}

// evento único (sem loop) cantado por 'count' vozes
function* renderShot(ctx, dur, count, gen, lo, hi, opts) {
  const n = Math.round(dur * VSR), L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    renderVoice(L, R, VSR, { notes: gen(rand(lo, hi)), pan: rand(-0.95, 0.95), ...opts });
    if (k & 1) yield;
  }
  normalize([L, R], 0.9);
  return toBuffer(ctx, VSR, L, R);
}

// aplauso: centenas de palmas (ruído em passa-banda com decaimento rápido)
function* renderApplause(ctx, dur, density) {
  const sr = Math.min(ctx.sampleRate, 32000), x = Math.round(0.3 * sr), n = Math.round(dur * sr);
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

// ---------- bateria da torcida (um kit, reaproveitado por todos os cantos) ----------

function* makeKit(sr) {
  const TAU = Math.PI * 2;
  // 3 variações de cada instrumento, normalizadas para pico 1
  const inst = (len, fn) => {
    const m = Math.round(len * sr);
    const v = [0, 1, 2].map(() => {
      const o = new Float32Array(m); let p = 0;
      for (let i = 0; i < m; i++) { const w = frnd(), nz = (w - p) * 0.5; p = w; o[i] = fn(i / sr, nz); }
      return o;
    });
    normalize(v, 1); return v;
  };
  // surdo: pele grave com queda de afinação no ataque
  const surdoS = (f, dec) => inst(dec * 4.5, (tt, nz) =>
    Math.sin(TAU * (f * tt + f * 0.6 * 0.03 * (1 - Math.exp(-tt / 0.03)))) * Math.exp(-tt / dec) + nz * 0.5 * Math.exp(-tt / 0.004));
  const K = { sr };
  K.SEG = surdoS(76, 0.14); K.TER = surdoS(64, 0.2); yield;
  K.PRI = surdoS(55, 0.5); yield;
  K.BUMBO = inst(0.5, (tt, nz) => Math.sin(TAU * (48 * tt + 48 * 1.5 * 0.02 * (1 - Math.exp(-tt / 0.02)))) * Math.exp(-tt / 0.16) + nz * 0.8 * Math.exp(-tt / 0.003));
  K.CX = inst(0.18, (tt, nz) => nz * 1.8 * Math.exp(-tt / 0.05) + Math.sin(TAU * 205 * tt) * 0.4 * Math.exp(-tt / 0.02));
  K.TB = inst(0.12, (tt, nz) => Math.sin(TAU * 910 * tt) * 0.6 * Math.exp(-tt / 0.03) + Math.sin(TAU * 1370 * tt) * 0.25 * Math.exp(-tt / 0.018) + nz * Math.exp(-tt / 0.006));
  K.RP = inst(0.4, (tt, nz) => Math.sin(TAU * 470 * tt) * Math.exp(-tt / 0.09) + Math.sin(TAU * 760 * tt) * 0.45 * Math.exp(-tt / 0.05) + nz * 1.1 * Math.exp(-tt / 0.006));
  K.GZ = inst(0.09, (tt, nz) => nz * Math.min(1, tt / 0.012) * Math.exp(-tt / 0.03));
  yield;
  // palma coletiva: dezenas de palmas quase juntas (a arquibancada inteira batendo junto)
  K.CLAP = [0, 1, 2].map(() => {
    const m = Math.round(0.22 * sr), o = new Float32Array(m);
    for (let c = 0; c < 70; c++) {
      const t0 = Math.round(Math.pow(Math.random(), 1.6) * 0.045 * sr), dec = rand(0.004, 0.011), a = rand(0.3, 1);
      const [b0, a1, a2] = bpCoef(rand(800, 2600), rand(1, 2.2), sr);
      const de = Math.exp(-1 / (dec * sr)), len = Math.min(m - t0, Math.round(dec * 6 * sr));
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, e = 1;
      for (let i = 0; i < len; i++) {
        const s = frnd() * e; e *= de;
        const y = b0 * (s - x2) - a1 * y1 - a2 * y2; y2 = y1; y1 = y; x2 = x1; x1 = s;
        o[t0 + i] += y * a;
      }
    }
    return o;
  });
  normalize(K.CLAP, 1);
  yield;
  return K;
}

// soma uma batida (variação aleatória) em L/R com pan de potência constante
function mixer(L, R, sr) {
  return (t, smp, a, pan) => {
    const s = smp[(Math.random() * smp.length) | 0], i0 = Math.round(t * sr); if (i0 < 0) return;
    const pl = Math.cos((pan + 1) * Math.PI / 4) * a, pr = Math.sin((pan + 1) * Math.PI / 4) * a;
    const m = Math.min(s.length, L.length - i0);
    for (let i = 0; i < m; i++) { L[i0 + i] += s[i] * pl; R[i0 + i] += s[i] * pr; }
  };
}

// ---------- cantos (melodias originais) ----------
// tune: um array por compasso com [início (batidas), duração (batidas), midi, vogal]
const TEL = [0, 2, 4, 5, 7, 9, 11, 12, 14];             // teleco-teco do tamborim
const CALL = [0, 3, 6, 8, 10, 12, 13, 14];               // chamada do repique
const SAMBA_A = [[0, 1, 62, 'o'], [1, 1, 66, 'e'], [2, 0.5, 69, 'o'], [2.5, 0.5, 69, 'e'], [3, 1, 66, 'o']];
const SAMBA_B = [[0, 1, 64, 'o'], [1, 1, 67, 'e'], [2, 2, 64, 'o']];
const SAMBA_C = [[0, 1, 64, 'o'], [1, 0.5, 62, 'e'], [1.5, 0.5, 62, 'o'], [2, 1.9, 62, 'a']];
const OLE = [
  [[0, 0.5, 69, 'o'], [0.5, 1.5, 71, 'e'], [2, 0.5, 69, 'o'], [2.5, 1.5, 71, 'e']],
  [[0, 0.5, 69, 'o'], [0.5, 0.5, 71, 'e'], [1, 0.5, 73, 'e'], [1.5, 0.5, 71, 'e'], [2, 2, 69, 'a']],
  [[0, 1, 66, 'o'], [1, 1, 69, 'e'], [2, 1, 71, 'o'], [3, 1, 69, 'e']],
  [[0, 0.5, 66, 'o'], [0.5, 0.5, 64, 'e'], [1, 2.5, 62, 'a']],
];
const HINO = [
  [[0, 1, 57, 'o'], [1, 1, 60, 'o'], [2, 1.5, 64, 'e'], [3.5, 0.5, 62, 'e']],
  [[0, 1, 60, 'a'], [1, 1, 59, 'o'], [2, 1.8, 57, 'o']],
  [[0, 1, 60, 'e'], [1, 1, 64, 'o'], [2, 1.5, 67, 'a'], [3.5, 0.5, 65, 'e']],
  [[0, 1, 64, 'o'], [1, 1, 62, 'e'], [2, 1.8, 64, 'o']],
  [[0, 1, 65, 'a'], [1, 1, 64, 'o'], [2, 1, 62, 'e'], [3, 1, 60, 'o']],
  [[0, 1, 62, 'e'], [1, 1, 64, 'o'], [2, 1.8, 67, 'a']],
  [[0, 1.5, 69, 'o'], [1.5, 0.5, 67, 'e'], [2, 1, 64, 'o'], [3, 1, 62, 'e']],
  [[0, 1, 60, 'a'], [1, 1, 59, 'e'], [2, 1.8, 57, 'o']],
];
const UH = [[3, 0.4, 50, 'u']];                           // "UH!" coletivo no 4º tempo
// festa (melodia original, pergunta e resposta "ê-ô")
const FESTA_A = [[0, 1, 64, 'e'], [1, 1, 67, 'o'], [2, 1, 64, 'e'], [3, 1, 67, 'o']];
const FESTA_B = [[0, 0.5, 69, 'o'], [0.5, 0.5, 67, 'o'], [1, 0.5, 64, 'o'], [1.5, 0.5, 62, 'e'], [2, 1.8, 64, 'o']];
const FESTA_C = [[0, 1, 67, 'e'], [1, 1, 69, 'o'], [2, 1, 71, 'e'], [3, 1, 69, 'o']];
const FESTA_D = [[0, 0.5, 67, 'o'], [0.5, 0.5, 64, 'e'], [1, 2.6, 62, 'a']];

const SONGS = {
  // samba da torcida organizada: bateria cheia + canto
  chant: {
    bpm: 130, bars: 8, swing: 0.1, voices: 22, oct: (k) => (k < 14 ? -12 : 0), dg: 0.8, vg: 0.6,
    voice: { att: 0.03, glide: 0.035, vib: 0.01, breath: 0.3 },
    tune: [SAMBA_A, SAMBA_B, SAMBA_A, SAMBA_C, SAMBA_A, SAMBA_B, SAMBA_A, SAMBA_C],
    drums(hit, K, b, s, t, s16) {
      if (s === 0 || s === 8) hit(t, K.SEG, 0.6, -0.3, true);              // segunda (abafado)
      if (s === 4 || s === 12) hit(t, K.PRI, 1.0, 0.25, true);             // primeira (aberto)
      if ((s === 6 || s === 14) && b % 2) hit(t, K.TER, 0.55, 0.05);       // terceira
      const roll = (b === 3 || b === 7) && s >= 12;
      hit(t, K.CX, [3, 6, 11, 14].includes(s) ? 0.42 : 0.15, 0.35, true);
      if (roll) hit(t + s16 / 2, K.CX, 0.26, 0.35);
      if (TEL.includes(s)) hit(t, K.TB, s === 0 || s === 7 ? 0.36 : 0.25, -0.6);
      hit(t, K.GZ, s % 4 === 2 ? 0.2 : 0.1, 0.65);
      if ((b === 0 || b === 4) ? CALL.includes(s) : (s === 7 || s === 10 || s === 15)) hit(t, K.RP, 0.5, -0.15);
      if (b >= 2 && (s === 4 || s === 12)) hit(t, K.CLAP, 0.7, 0, true);   // arquibancada batendo palma junto
    },
  },
  // festa da arquibancada: "ê-ô" de pergunta e resposta, batucada cheia e palma em todo tempo
  festa: {
    bpm: 138, bars: 8, swing: 0.08, voices: 26, oct: (k) => (k < 16 ? -12 : 0), dg: 0.85, vg: 0.62, spread: 0.3,
    voice: { att: 0.025, glide: 0.03, vib: 0.012, breath: 0.34 },
    tune: [FESTA_A, FESTA_B, FESTA_A, FESTA_B, FESTA_C, FESTA_D, FESTA_C, FESTA_D],
    drums(hit, K, b, s, t, s16) {
      if (s === 0) hit(t, K.BUMBO, 0.85, 0, true);
      if (s === 0 || s === 8) hit(t, K.SEG, 0.6, -0.3, true);
      if (s === 4 || s === 12) hit(t, K.PRI, 1.0, 0.25, true);
      if ([6, 10, 14].includes(s) && b % 2) hit(t, K.TER, 0.5, 0.05);
      hit(t, K.CX, s % 4 === 2 ? 0.4 : s % 2 ? 0.14 : 0.22, 0.35, s % 4 === 2);
      if ((b & 3) === 3 && s >= 8) hit(t + s16 / 2, K.CX, 0.28, 0.35);   // virada
      if (TEL.includes(s)) hit(t, K.TB, 0.3, -0.6);
      if ((b & 3) === 0 ? CALL.includes(s) : s === 7 || s === 15) hit(t, K.RP, 0.5, -0.15);
      if (s % 4 === 0) hit(t, K.CLAP, 0.9, 0, true);                   // palma em todo tempo
      hit(t, K.GZ, s % 2 ? 0.08 : 0.14, 0.65);
    },
  },
  // "olê, olê": palmas sincronizadas em todo tempo
  ole: {
    bpm: 112, bars: 8, swing: 0, voices: 24, oct: (k) => (k < 16 ? -12 : 0), dg: 0.75, vg: 0.65,
    voice: { att: 0.03, glide: 0.04, vib: 0.012, breath: 0.32 },
    tune: [...OLE, ...OLE],
    drums(hit, K, b, s, t) {
      if (s === 0 || s === 8) hit(t, K.PRI, 0.9, 0.2, true);
      if (s === 4 || s === 12) hit(t, K.SEG, 0.55, -0.25, true);
      hit(t, K.CX, s % 4 === 0 ? 0.3 : s % 2 ? 0.07 : 0.13, 0.3);
      const fim = b % 4 === 3;                                            // virada de palmas no 4º compasso
      if (fim ? [0, 2, 4, 8, 10, 12].includes(s) : s % 4 === 0) hit(t, K.CLAP, 0.95, 0, true);
      if (s % 2 === 0) hit(t, K.GZ, 0.1, 0.6);
    },
  },
  // palmas ritmadas "pá pá pápápá" + "UH!" coletivo com bumbo
  palmas: {
    bpm: 104, bars: 4, swing: 0, voices: 28, oct: (k) => (k < 20 ? 0 : 12), spread: 2, loose: 0.03, legato: 1,
    dg: 0.85, vg: 0.6, voice: { att: 0.012, glide: 0.02, vib: 0.02, breath: 0.5 },
    tune: [[], UH, [], UH],
    drums(hit, K, b, s, t) {
      if (s === 0) hit(t, K.PRI, 1, 0.2, true);
      if (s === 8) hit(t, K.SEG, 0.6, -0.2, true);
      if ((b % 2 ? [0, 4, 8] : [0, 4, 8, 10, 12]).includes(s)) hit(t, K.CLAP, 1, 0, true);
      if (b % 2 && s === 12) { hit(t, K.BUMBO, 1, 0, true); hit(t, K.PRI, 0.8, 0, true); }
      hit(t, K.CX, s % 4 === 0 ? 0.18 : 0.06, 0.3);
    },
  },
  // hino da torcida: lento, épico, milhares de vozes e marcha de surdos
  anthem: {
    bpm: 92, bars: 8, swing: 0, voices: 36, oct: (k) => (k < 24 ? -12 : 0), spread: 0.35, loose: 0.05, legato: 0.94,
    dg: 0.6, vg: 0.8, voice: { att: 0.05, glide: 0.06, vib: 0.015, breath: 0.3 },
    tune: HINO,
    drums(hit, K, b, s, t, s16) {
      if (s === 0) { hit(t, K.BUMBO, 0.9, 0, true); hit(t, K.PRI, 0.9, 0.2, true); }
      if (s === 8) hit(t, K.PRI, 0.75, -0.2, true);
      if (s === 4 || s === 12) hit(t, K.SEG, 0.6, 0.1, true);
      if (s === 14 && b % 2) hit(t, K.TER, 0.5, 0);
      hit(t, K.CX, s % 4 === 0 ? 0.32 : 0.1, 0.35, s % 4 === 0);
      if ((b === 3 || b === 7) && s >= 8) hit(t + s16 / 2, K.CX, 0.2, 0.35);
      if (b >= 4 && (s === 4 || s === 12)) hit(t, K.CLAP, 0.75, 0, true);
    },
  },
};

// canto completo em loop perfeito: bateria + coro, mixados num buffer estéreo a CSR
function* renderSong(ctx, K, sp) {
  const sr = K.sr, beat = 60 / sp.bpm, bar = beat * 4, dur = bar * sp.bars, s16 = beat / 4;
  const n = Math.round(dur * sr), tail = Math.round(1.2 * sr);
  const L = new Float32Array(n + tail), R = new Float32Array(n + tail), h = mixer(L, R, sr);
  // 'dbl': dois instrumentistas (pan aberto, levemente fora de tempo) = bateria larga
  const hit = (t, smp, a, pan, dbl) => {
    if (dbl) { h(t, smp, a * 0.62, pan - 0.35); h(t + rand(0.004, 0.014), smp, a * 0.55, pan + 0.35); } else h(t, smp, a, pan);
  };
  for (let b = 0; b < sp.bars; b++) {
    for (let s = 0; s < 16; s++) {
      const t = b * bar + s * s16 + (s & 1 ? s16 * sp.swing : 0) + rand(-0.004, 0.004);   // leve "ginga"
      sp.drums(hit, K, b, s, t, s16);
    }
    if (b & 1) yield;
  }
  normalize([L, R], 0.8);
  const vn = Math.round(dur * VSR), vt = Math.round(1.2 * VSR);
  const vL = new Float32Array(vn + vt), vR = new Float32Array(vn + vt), lo = sp.loose ?? 0.03, sp2 = sp.spread ?? 0.25;
  for (let k = 0; k < sp.voices; k++) {
    const oct = sp.oct(k), det = rand(-sp2, sp2), ak = rand(0.6, 1), notes = [];
    sp.tune.forEach((ph, b) => ph.forEach(([st, d, m, vw]) => notes.push({
      t: Math.max(0, b * bar + st * beat + rand(-lo * 0.6, lo)), d: d * beat * (sp.legato ?? 0.9), f: midiHz(m + oct + det), vw, a: ak * rand(0.8, 1) })));
    notes.sort((x, y) => x.t - y.t);
    renderVoice(vL, vR, VSR, { notes, pan: rand(-0.95, 0.95), ...sp.voice });
    yield;
  }
  normalize([vL, vR], 0.8);
  // junta, reamostrando as vozes (interpolação linear) e dobrando a cauda no começo (periodicidade)
  const oL = new Float32Array(n), oR = new Float32Array(n), q = VSR / sr;
  for (let i = 0; i < n + tail; i++) {
    const p = i * q, j = p | 0, fr = p - j;
    const vl = j + 1 < vL.length ? vL[j] + (vL[j + 1] - vL[j]) * fr : 0, vr = j + 1 < vR.length ? vR[j] + (vR[j + 1] - vR[j]) * fr : 0;
    const k = i % n;
    oL[k] += L[i] * sp.dg + vl * sp.vg; oR[k] += R[i] * sp.dg + vr * sp.vg;
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

// ordem de construção depois do unlock (o hino só quando pedido)
const BASE_QUEUE = ['ir', 'babble', 'roar', 'applause', 'chant', 'ooh', 'gol', 'boo', 'festa', 'palmas', 'ole'];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.9, crowd: 0.8, sfx: 0.9 };
    this.ex = 0.3; this.threat = 0; this.boost = 0; this._I = 0.3;
    this.duck = 0;               // abafamento dos cantos durante reações (uhhh, vaia, defesa)
    this.mood = 0; this._moodT = 0;           // humor interno da casa (-1 vaia .. 1 em festa); setHomeMood(0..1) → 2v-1
    this._clock = null;          // relógio fixo (render offline); null = ctx.currentTime
    this._sync = false;          // true: constrói buffers na hora (offline)
    this._ends = [];             // fim das vozes ativas (limite de polifonia)
    this.maxVoices = 48;
    this._chantOn = false; this._chantOffAt = 0;
    this._pre = null;            // pré-jogo: { t0 }
    this._anthemOn = false;
    this._partyA = -1; this._partyB = -1;   // festa do gol: canto entre A e B
    this._song = null;           // tocador de cantos longos { key, src, g }
    this._dir = { key: null, until: 0, next: 6 };   // diretor de cantos da partida
    this._last = {};
    this._paused = false;
    this._acc = 0;
    this._next = { shout: 1, whistle: 3, swell: 0, rojao: 5, flare: 8, clap: 4, section: 3 };
    this._sw = [1, 1, 1, 1, 1, 1, 1, 1];      // oscilação lenta de cada camada (variação "viva")
    this._jobs = {}; this._queue = []; this._ticking = false;
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
      this._queue = BASE_QUEUE.slice();
      if (this._anthemOn) this._want('anthem');
      this._startTick();
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
    this._sync = !lazyIR;
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
    comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.3;
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

    // barramento da torcida: compressor próprio (segura o gol sem esmagar os efeitos).
    // Limiar mais alto e razão menor que antes: o ambiente calmo fica abaixo do limiar e
    // sobra contraste (calmo ~-19 dB RMS, ataque ~-15, gol ~-10) em vez de tudo "chapado".
    this.crowdIn = g(1);
    const cc = ctx.createDynamicsCompressor();
    cc.threshold.value = -13; cc.knee.value = 12; cc.ratio.value = 2.2; cc.attack.value = 0.03; cc.release.value = 0.5;
    const cmk = g(1.1);
    this.crowdG = g(this.vol.crowd);
    this.crowdIn.connect(cc); cc.connect(cmk); cmk.connect(this.crowdG); this.crowdG.connect(this.masterG);
    const cs = g(0.4); this.crowdG.connect(cs); cs.connect(conv);
    // eco das arquibancadas opostas (sem realimentação: estável)
    const eIn = g(0.13), elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 2200;
    const d1 = ctx.createDelay(1.5), d2 = ctx.createDelay(1.5); d1.delayTime.value = 0.31; d2.delayTime.value = 0.53;
    const x12 = g(0.3);
    this.crowdG.connect(eIn); eIn.connect(elp); elp.connect(d1); elp.connect(d2); d1.connect(x12); x12.connect(d2);
    this._chain(d1, this._pan(-0.75), g(1), this.masterG);
    this._chain(d2, this._pan(0.75), g(0.7), this.masterG);

    this.sfxIn = g(1); this.sfxG = g(this.vol.sfx);
    this.sfxIn.connect(this.sfxG); this.sfxG.connect(this.masterG);
    this.hitIn = g(4.5); this.hitIn.connect(this.sfxIn);                 // impactos (bola, corpos)
    const ss = g(0.12); this.sfxG.connect(ss); ss.connect(conv);
    this.whIn = g(1); this.whIn.connect(this.sfxG);                      // apito: mais reverb
    const ws = g(0.35); this.whIn.connect(ws); ws.connect(conv);
    this.conv = conv;

    // ambiente contínuo (cama, murmúrio, rugido, palmas soltas, vaia, crescendo) passa por um
    // ganho único que acompanha a intensidade: é ele que dá o "respiro" entre calmaria e pressão
    this.ambG = g(0.6); this.ambG.connect(this.crowdIn);
    // cama da torcida: faixas de ruído rosa (massa de gente ao longe)
    this.bed = {};
    const band = (type, f, q, off, v) => {
      const s = ctx.createBufferSource(); s.buffer = pink; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = g(v); s.connect(fl); fl.connect(gg); gg.connect(this.ambG); s.start(0, off);
      return { g: gg, f: fl };
    };
    this.bed.rumble = band('lowpass', 260, 0.5, 0, 0.12);
    this.bed.mid = band('bandpass', 750, 0.7, 1.3, 0.1);
    this.bed.hi = band('bandpass', 2300, 0.9, 2.7, 0.03);
    // canto do jogo (volume próprio) e tocador dos cantos longos
    this.chantG = g(0); this.chantG.connect(this.crowdIn);
    this.chantSrc = null;
    this.songIn = g(1); this.songIn.connect(this.crowdIn);
    // ---- áudio espacial (§32): 4 setores da arquibancada posicionados no estádio e os
    // impactos da bola saindo de onde a bola está; o ouvinte acompanha a câmera.
    const mkPan = (x, y, z) => {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 25; p.rolloffFactor = 0.6; p.maxDistance = 400;
      if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
      return p;
    };
    this.secPos = [[-62, 9, 0], [0, 11, 47], [62, 9, 0], [0, 11, -47]];
    this.secG = this.secPos.map(([x, y, z]) => { const gg = g(0), pn = mkPan(x, y, z); gg.connect(pn); pn.connect(this.crowdIn); return gg; });
    this.secSrc = null; this._secSong = null;
    this.sfxPan = mkPan(0, 0, 0); this.sfxPan.refDistance = 18; this.sfxPan.rolloffFactor = 0.35;
    this.hitIn.disconnect(); this.hitIn.connect(this.sfxPan); this.sfxPan.connect(this.sfxIn);
    this._dir.next = (this._clock ?? ctx.currentTime) + rand(4, 8);
    this.setVolumes({});
    if (this._rainLvl) setTimeout(() => this.setRain(this._rainLvl), 0);
  }

  // gerador que constrói o recurso 'key'
  _gen(key) {
    const c = this.ctx;
    if (key === 'babble') return crowdVoices(c, 6, 28, talkNotes, 95, 230, { breath: 0.25, vib: 0.01 });
    if (key === 'roar') return crowdVoices(c, 6, 30, shoutNotes, 170, 400, { breath: 0.4, vib: 0.02, att: 0.08, glide: 0.12 });
    if (key === 'boo') return crowdVoices(c, 5, 28, booNotes, 100, 175, { breath: 0.4, vib: 0.025, att: 0.18, glide: 0.4 });
    if (key === 'ooh') return renderShot(c, 3.8, 28, oohNotes, 150, 300, { breath: 0.35, vib: 0.02, att: 0.22, glide: 0.3 });
    if (key === 'gol') return renderShot(c, 7.5, 34, golNotes, 165, 390, { breath: 0.42, vib: 0.022, att: 0.06, glide: 0.18 });
    if (key === 'applause') return renderApplause(c, 4, 110);
    if (SONGS[key]) {
      const self = this;
      return (function* () {
        if (!self._kit) self._kit = yield* makeKit(Math.min(c.sampleRate, CSR));
        return yield* renderSong(c, self._kit, SONGS[key]);
      })();
    }
    return (function* () { return stadiumIR(c); })();
  }

  _has(key) { return key === 'ir' ? !!this.conv.buffer : !!this.bufs[key]; }

  // camada contínua em loop (buffer da torcida) ligada ao barramento
  _loop(name, buf, gain, lp, pan, rate) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    if (rate) s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = gain;
    this._chain(s, f, g, pan != null ? this._pan(pan) : null, this.ambG);
    s.start(this._t(), Math.random() * buf.duration);
    this.bed[name] = { g, f, s };
  }

  // recurso pronto: guarda e liga as camadas contínuas da torcida
  _install(key, buf) {
    if (key === 'ir') { this.conv.buffer = buf; return; }
    this.bufs[key] = buf;
    if (key === 'chant' && this._chantOn) this.chant(true);
    if (key === 'babble') {                     // duas cópias defasadas, abertas no estéreo
      this._loop('murmur', buf, 0.16, 2200, -0.55);
      this._loop('murmur2', buf, 0.16, 2200, 0.55, 0.96);
      this._loop('murmur3', buf, 0.1, 1100, 0, 1.05);   // arquibancada do fundo (mais escura)
    } else if (key === 'roar') {
      this._loop('roar', buf, 0.04, 1500, -0.45);
      this._loop('roar2', buf, 0.03, 1500, 0.45, 1.04);
      this._loop('far', buf, 0.06, 700, null, 0.82);   // o estádio inteiro, ao longe
      // crescendo de ataque perigoso: o "ôôôô" que sobe de volume E de altura com a ameaça
      this._loop('rise', buf, 0, 900, null, 0.92);
    } else if (key === 'applause') this._loop('claps', buf, 0, 5000);
    else if (key === 'boo') this._loop('boo', buf, 0, 2400);
  }

  // termina já (síncrono) o que faltar de 'key'
  _need(key) {
    if (!this.ctx || this._has(key)) return;
    const g = this._jobs[key] || this._gen(key); delete this._jobs[key];
    let r; while (!(r = g.next()).done);
    this._install(key, r.value);
  }

  // pede um recurso: offline constrói na hora; ao vivo passa na frente da fila
  _want(...keys) {
    if (!this.ctx) return;
    for (const k of keys) {
      if (this._has(k)) continue;
      if (this._sync) { this._need(k); continue; }
      const i = this._queue.indexOf(k);
      if (i === 0) continue;
      if (i > 0) this._queue.splice(i, 1);
      this._queue.splice(Math.min(1, this._queue.length), 0, k);
    }
    this._startTick();
  }

  _startTick() {
    if (this._ticking || this._sync || !this._queue.length) return;
    this._ticking = true;
    setTimeout(() => this._tick(), 30);
  }

  // uma fatia da fila de construção por vez (não trava o quadro)
  _tick() {
    while (this._queue.length && this._has(this._queue[0])) this._queue.shift();
    const key = this._queue[0];
    if (!key) { this._ticking = false; return; }
    try {
      const g = this._jobs[key] || (this._jobs[key] = this._gen(key)), r = g.next();
      if (r.done) { delete this._jobs[key]; this._queue.shift(); this._install(key, r.value); }
    } catch (e) { console.warn('GameAudio', e); delete this._jobs[key]; this._queue.shift(); }
    setTimeout(() => this._tick(), 20);
  }

  // offline: constrói na hora; ao vivo só pede (fatias em segundo plano) — construir
  // de uma vez congelava o jogo na primeira chance/defesa/gol
  _ensureBuffers(which) { const ks = which ? [which] : ['babble', 'applause', 'roar']; if (this._sync) for (const k of ks) this._need(k); else this._want(...ks); }
  _ensureChant() { this._need('chant'); }
  _ensureAll() { for (const k of [...BASE_QUEUE, 'anthem']) this._need(k); }

  // ---------- utilitários ----------

  _now() { return this._clock ?? this.ctx.currentTime; }
  _t() { return this.ctx ? (this._clock ?? this.ctx.currentTime) + 0.005 : null; }

  // reserva uma voz até 'end'; false se a polifonia estourou (prio alta passa com folga)
  _voice(end, prio = 1) {
    const now = this._now();
    if (this._ends.length > 16) this._ends = this._ends.filter((e) => e > now);
    const lim = prio > 1 ? this.maxVoices + 24 : prio < 1 ? this.maxVoices * 0.6 : this.maxVoices;
    if (this._ends.length >= lim) return false;
    this._ends.push(end); return true;
  }

  _throttle(key, gap) {
    const now = this._now();
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

  // processo de Poisson: true quando o próximo evento de 'key' chegou (taxa em eventos/s)
  _poisson(key, rate, dt) {
    if ((this._next[key] -= dt) > 0) return false;
    this._next[key] = -Math.log(1 - Math.random()) / Math.max(0.05, rate);
    return rate >= 0.05 || Math.random() < rate / 0.05;
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

  // trecho de um buffer com envelope por pontos [[t, v], ...] e passa-baixa automatizado
  // o.loop=false + o.offset: evento único tocado do começo (ooh, vaia)
  _bufEvent(t, buf, pts, lpPts, o = {}) {
    const ctx = this.ctx, end = t + pts[pts.length - 1][0];
    if (!buf || !this._voice(end, 2)) return false;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = o.loop !== false;
    if (o.rate) s.playbackRate.value = o.rate;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(lpPts[0][1], t);
    for (const [dt, v] of lpPts) f.frequency.linearRampToValueAtTime(v, t + dt);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (const [dt, v] of pts) g.gain.linearRampToValueAtTime(v, t + dt);
    this._chain(s, f, g, o.pan != null ? this._pan(o.pan) : null, this.crowdIn);
    s.start(t, o.offset ?? Math.random() * buf.duration); s.stop(end + 0.05);
    return true;
  }

  // coro de vozes com osciladores (reserva enquanto os buffers não ficam prontos)
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

  // rojão: (assobio subindo) + estouro grave + eco da arquibancada do outro lado
  _rojao(t, a, whoosh) {
    const pan = rand(-0.9, 0.9);
    if (whoosh && this._voice(t + 0.8, 0)) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(rand(600, 900), t); o.frequency.exponentialRampToValueAtTime(rand(2200, 3000), t + 0.7);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.05, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.72);
      this._chain(o, g, this._pan(pan), this.crowdIn); o.start(t); o.stop(t + 0.75);
      t += 0.75;
    }
    this._noise(t, { buf: 'brown', type: 'lowpass', f: 1100, q: 0.5, peak: a, a: 0.002, d: 0.35, pan, out: this.crowdIn, prio: 0 });
    this._noise(t, { f: 1800, q: 0.5, peak: a * 0.45, a: 0.001, d: 0.07, pan, out: this.crowdIn, prio: 0 });
    this._tone(t, { f0: 95, f1: 38, sweep: 0.15, peak: a * 0.7, a: 0.002, d: 0.3, out: this.crowdIn, prio: 0 });
    this._noise(t + rand(0.3, 0.45), { buf: 'brown', type: 'lowpass', f: 600, q: 0.5, peak: a * 0.3, a: 0.01, d: 0.5, pan: -pan, out: this.crowdIn, prio: 0 });
  }

  // sinalizador aceso: chiado com estalos
  _flare(t, a, d) {
    const ctx = this.ctx, end = t + d + 0.3;
    if (!this._voice(end, 0)) return;
    const s = ctx.createBufferSource(); s.buffer = this.bufs.white; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(2500, 4200); f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.15);
    for (let tt = t + 0.15; tt < t + d; tt += rand(0.03, 0.09)) g.gain.setValueAtTime(a * rand(0.35, 1.3), tt);
    g.gain.linearRampToValueAtTime(0, end);
    this._chain(s, f, g, this._pan(rand(-0.9, 0.9)), this.crowdIn);
    s.start(t, Math.random()); s.stop(end + 0.05);
  }

  // ---------- tocador dos cantos longos (um por vez, com crossfade) ----------

  _songTo(key, gain, t) {
    const S = this._song;
    if (S && S.key === key) { S.g.gain.setTargetAtTime(gain, t, 0.4); return; }
    if (S) {
      S.g.gain.cancelScheduledValues(t); S.g.gain.setTargetAtTime(0, t, 0.6);
      try { S.src.stop(t + 4); } catch (e) { /* já parou */ }
      this._song = null;
    }
    if (!key) return;
    const buf = this.bufs[key];
    if (!buf) { this._want(key); return; }
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(gain, t, 0.35);
    src.connect(g); g.connect(this.songIn); src.start(t);
    this._song = { key, src, g };
  }

  // qual canto longo deve tocar agora: [chave, ganho]
  _pickSong(now) {
    const md = this.mood, mk = md < 0 ? Math.max(0.2, 1 + 0.8 * md) : 1 + 0.3 * md, I = this._I;
    if (this._anthemOn) return ['anthem', 1.15];
    if (now < this._partyB) {                                         // festa do gol
      if (now < this._partyA) return [null, 0];
      if (!this.bufs.festa) { this._want('festa'); return ['chant', 1.05]; }
      return ['festa', 1.05];
    }
    if (this._pre) {                                                  // pré-jogo: a torcida canta alto, um canto atrás do outro
      const e = now - this._pre.t0, k = ['chant', 'festa', 'ole'][Math.floor(e / 16) % 3];
      return [this.bufs[k] ? k : 'chant', (0.75 + 0.35 * clamp01(e / 20)) * mk];
    }
    const d = this._dir;
    if (this._chantOn || this._engineOn) { d.key = null; return [null, 0]; }   // o canto do jogo / motor de cantos manda
    // pausas curtas entre cantos: a arquibancada canta o jogo todo (torcida irritada canta menos)
    if (d.key && now >= d.until) { d.key = null; d.next = now + rand(2, 5) / (1 + Math.max(0, md)) + 6 * Math.max(0, -md); }
    if (!d.key && now >= d.next) {
      if (md < -0.35) d.next = now + rand(4, 8);                      // torcida irritada: sem canto
      else {
        const r = Math.random();
        const key = this.threat > 0.55 ? 'palmas' : r < 0.2 + 0.3 * Math.max(0, md) ? 'festa' : r < 0.6 ? 'palmas' : 'ole', b = this.bufs[key];
        if (!b) { this._want(key); d.next = now + 2; } else { d.key = key; d.until = now + b.duration * (key === 'palmas' ? 2 : 1) - 0.3; }
      }
    }
    return [d.key, (0.35 + 0.4 * I + 0.25 * this.threat) * mk * (1 - 0.65 * this.duck)];
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
      this.duck *= Math.exp(-dt / 1.6);
      this.mood += (this._moodT - this.mood) * (1 - Math.exp(-dt / 2));
      const now = this._now(), t = now + 0.005, md = this.mood, mp = Math.max(0, md), mn = Math.max(0, -md);
      if (this._pre && this._pre.t0 == null) this._pre.t0 = now;
      const preK = this._pre ? clamp01((now - this._pre.t0) / 30) : 0;
      const party = now >= this._partyA - 2.4 && now < this._partyB;
      let I = clamp01(0.15 + 0.5 * this.ex + 0.4 * this.threat * (0.6 + 0.4 * this.ex) + 0.3 * this.boost + 0.08 * mp);
      if (this._pre) I = Math.max(I, clamp01(0.3 + 0.45 * preK + 0.25 * this.boost));   // rumor crescente
      if (this._anthemOn) I = Math.max(I, 0.55);
      this._I = I;
      // oscilações lentas e aleatórias de cada camada
      if ((this._next.swell -= dt) <= 0) {
        this._next.swell = rand(0.8, 2.2);
        this._sw[(Math.random() * this._sw.length) | 0] = rand(0.7, 1.3);
      }
      // parâmetros: ~10 vezes por segundo basta
      this._acc += dt;
      if (this._acc >= 0.1) {
        this._acc = 0;
        const [sk, sg] = this._pickSong(now);
        this._songTo(sk, sg, t);
        const sing = this._song || (this._chantOn && this.chantSrc) ? 1 : 0;
        const b = this.bed, sw = this._sw, set = (p, v, tc = 0.6) => p.setTargetAtTime(v, t, tc), th = this.threat;
        // volume geral do ambiente acompanha a intensidade (curva convexa: a calmaria é calma)
        set(this.ambG.gain, (0.55 + 0.9 * Math.pow(I, 1.8)) * (this._anthemOn ? 0.75 : 1), 0.5);
        set(b.rumble.g.gain, (0.08 + 0.2 * I) * sw[0]);
        set(b.mid.g.gain, (0.05 + 0.15 * I) * sw[1]);
        set(b.hi.g.gain, (0.015 + 0.09 * I * I) * sw[2]);
        set(b.hi.f.frequency, 1900 + 1300 * I);
        const mur = (0.17 - 0.05 * I) * (sing ? 0.6 : 1) * (this._anthemOn ? 0.5 : 1);
        if (b.murmur) {
          set(b.murmur.g.gain, mur * sw[3]); set(b.murmur2.g.gain, mur * sw[5]);
          set(b.murmur.f.frequency, 1600 + 1400 * I); set(b.murmur2.f.frequency, 1500 + 1500 * I);
          set(b.murmur3.g.gain, mur * 0.7 * sw[6]); set(b.murmur3.f.frequency, 900 + 900 * I);
        }
        if (b.roar) {
          const r = 0.02 + 0.6 * I * I * I;
          set(b.roar.g.gain, r * sw[4], 0.5); set(b.roar2.g.gain, r * 0.8 * sw[1], 0.5);
          set(b.roar.f.frequency, 800 + 3600 * I, 0.5); set(b.roar2.f.frequency, 900 + 3400 * I, 0.5);
          set(b.far.g.gain, (this._anthemOn ? 0.24 : 0.05 + 0.12 * I) * sw[7], 1);
          // crescendo: ganho e altura sobem com a ameaça (a torcida "puxa" o ataque)
          const rg = 0.45 * Math.pow(th, 1.5) * (0.7 + 0.3 * this.ex) * (1 + 0.3 * mp);
          set(b.rise.g.gain, rg, th > 0.2 ? 0.35 : 0.9);
          set(b.rise.f.frequency, 900 + 4200 * th, 0.4);
          set(b.rise.s.playbackRate, 0.9 + 0.26 * th, 0.6);
        }
        if (b.claps) set(b.claps.g.gain, (0.012 + 0.045 * this.ex + 0.06 * preK * (this._pre ? 1 : 0)) * (sing ? 0.4 : 1), 1);
        // vaia contínua só com a torcida bem irritada (setHomeMood < ~0,3)
        if (b.boo) set(b.boo.g.gain, 0.5 * Math.pow(clamp01((mn - 0.35) / 0.65), 1.3) * (0.6 + 0.4 * I), 1);
        if (this.chantSrc) {
          const mk = md < 0 ? Math.max(0.2, 1 + 0.8 * md) : 1 + 0.3 * md;
          set(this.chantG.gain, this._chantOn && !this._song ? (0.45 + 0.3 * I + 0.15 * th) * mk * (1 - 0.65 * this.duck) : 0, this._chantOn && !this._song ? 1.2 : 0.8);
        }
      }
      // ondas de um setor: um lado da arquibancada levanta um "ôôô" e o outro responde
      if (this._poisson('section', this._anthemOn ? 0 : (0.05 + 0.25 * I + 0.3 * this.threat) * (1 + 0.5 * mp), dt) && this.bufs.roar) {
        const d = rand(1.6, 3.2), a = rand(0.12, 0.28) * (0.5 + I), pan = (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.9);
        this._bufEvent(t, this.bufs.roar, [[0, 0], [d * 0.45, a], [d, 0]], [[0, 900], [d * 0.45, 2200 + 1600 * I], [d, 900]], { pan, rate: rand(0.92, 1.1) });
        if (Math.random() < 0.35) this._bufEvent(t + d * 0.7, this.bufs.roar, [[0, 0], [d * 0.4, a * 0.8], [d, 0]], [[0, 900], [d * 0.4, 2000], [d, 800]], { pan: -pan, rate: rand(0.92, 1.1) });
      }
      // gritos, assobios, rojões e sinalizadores esporádicos (processos de Poisson)
      if (this._poisson('shout', 0.5 + 3.2 * I + (this._pre ? 1 : 0), dt)) {
        const hi = Math.random() < 0.25 * I + 0.1 * mp, a = rand(0.02, 0.06) * (0.6 + I);
        this._shout(t + Math.random() * 0.05, a, hi);
        if (Math.random() < 0.3) this._shout(t + rand(0.25, 0.4), a * 0.9, hi);   // "vai! vai!"
      }
      const whRate = 0.06 + 0.7 * this.threat * this.threat + 0.2 * this.boost + 1.3 * mn + (this._pre ? 0.6 : 0) + (party ? 0.6 : 0);
      if (this._poisson('whistle', whRate, dt)) this._fanWhistle(t, rand(0.012, 0.03) * (0.6 + I + mn), Math.random() < 0.3 + 0.5 * mn);
      if (this._poisson('rojao', this._pre ? 0.08 + 0.15 * preK : party ? 0.35 : 0, dt)) this._rojao(t, rand(0.15, 0.4), Math.random() < 0.35);
      if (this._poisson('flare', this._pre ? 0.05 : party ? 0.08 : 0, dt)) this._flare(t, rand(0.012, 0.03), rand(2.5, 5));
      if (this._poisson('clap', this._pre ? 0.12 : 0, dt) && this.bufs.applause) {   // ondas de aplauso no pré-jogo
        this._bufEvent(t, this.bufs.applause, [[0, 0], [0.6, 0.35], [2.2, 0.3], [3.5, 0]], [[0, 6000], [3.5, 5000]]);
      }
      // canto desligado há um tempo: libera a fonte
      if (!this._chantOn && this.chantSrc && now - this._chantOffAt > 8) {
        try { this.chantSrc.stop(t); } catch (e) { /* já parou */ }
        this.chantSrc = null;
      }
    } catch (e) { console.warn('GameAudio.update', e); }
  }

  // side (opcional): 0 = casa, 1 = visitante (gol do visitante: festa pequena e lamento da casa)
  crowd(kind, strength = 1, side) {
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t(); let s = 0.3 + 0.7 * clamp01(num(strength, 1));
      if (kind === 'goal' || kind === 'cheer' || kind === 'save') this._ensureBuffers();
      if (kind === 'goal') this._want('gol', 'festa');
      const fv = 0.85 + 0.3 * Math.max(0, this.mood);                  // torcida empolgada reage mais forte
      // hierarquia da mixagem (como no FIFA): a reação abafa o canto, o canto abafa a cama
      if (kind !== 'goal') this.duck = Math.max(this.duck, kind === 'cheer' ? 0.5 : 0.9);
      const b = this.bufs;
      if (kind === 'goal' && side === 1) {
        this.boost = Math.max(this.boost, 0.3);
        this._bufEvent(t, b.roar, [[0, 0], [0.3, 0.45 * s], [3, 0.35 * s], [5, 0]], [[0, 900], [0.4, 2200], [5, 900]], { pan: 0.7 });
        this._bufEvent(t + 0.4, b.ooh, [[0, 0.8 * s], [3.4, 0.8 * s]], [[0, 2600], [3.4, 1800]], { loop: false, offset: 0, rate: 0.9 });
        for (let k = 0; k < 2; k++) this._rojao(t + rand(0.3, 2), 0.15 * s, false);
        return;
      }
      if (kind === 'goal') {
        // explosão longa (~16 s): estouro → "GOOOOL" coletivo sustentado → segunda onda
        // (o replay/comemoração) → a festa com batucada e palmas emenda até ~26 s
        const S = s * fv;
        this.boost = 1;
        this._partyA = t + 7; this._partyB = t + 26;
        const P = [[0, 0], [0.25, 1.0 * S], [1.5, 1.05 * S], [5, 0.9 * S], [8, 0.75 * S], [11, 0.55 * S], [16, 0]];
        this._bufEvent(t, b.roar, P, [[0, 1800], [0.3, 5800], [6, 4200], [11, 3000], [16, 1500]]);
        this._bufEvent(t + 0.05, b.roar, P.map(([a, v]) => [a, v * 0.75]), [[0, 1400], [0.4, 5000], [16, 1400]], { rate: 1.07, pan: -0.4 });
        this._bufEvent(t + 0.1, b.roar, P.map(([a, v]) => [a, v * 0.7]), [[0, 1400], [0.4, 4600], [16, 1300]], { rate: 0.95, pan: 0.4 });
        this._bufEvent(t + 0.1, b.roar, P.map(([a, v]) => [a, v * 0.5]), [[0, 900], [0.5, 2400], [16, 900]], { rate: 0.82 });
        this._bufEvent(t, b.babble, [[0, 0], [0.5, 0.5 * S], [8, 0.4 * S], [12, 0]], [[0, 3000], [12, 2000]], { rate: 1.3 });
        // "GOOOOL" de milhares de vozes (buffer próprio) e um eco dele do outro lado do estádio
        this._bufEvent(t + 0.3, b.gol, [[0, 0], [0.4, 1.0 * S], [5.5, 0.9 * S], [7.5, 0]], [[0, 1600], [0.6, 4200], [7.5, 2400]], { loop: false, offset: 0 });
        this._bufEvent(t + 0.62, b.gol, [[0, 0], [0.6, 0.35 * S], [7, 0]], [[0, 1200], [7, 900]], { loop: false, offset: 0, rate: 0.94, pan: 0.6 });
        // segunda onda: quem viu o replay grita de novo
        this._bufEvent(t + 6.5, b.roar, [[0, 0], [0.6, 0.55 * S], [3, 0.4 * S], [5.5, 0]], [[0, 1500], [0.7, 4400], [5.5, 1600]], { rate: 1.02 });
        this._bufEvent(t + 1.2, b.applause, [[0, 0], [0.8, 0.45 * S], [10, 0.35 * S], [14, 0]], [[0, 6000], [14, 5000]]);
        // estrondo: a arquibancada inteira pulando (e de novo na segunda onda)
        this._noise(t, { buf: 'brown', type: 'lowpass', f: 160, q: 0.6, peak: 0.85 * S, a: 0.25, d: 6, out: this.crowdIn, prio: 2 });
        this._noise(t + 6.5, { buf: 'brown', type: 'lowpass', f: 150, q: 0.6, peak: 0.45 * S, a: 0.3, d: 3.5, out: this.crowdIn, prio: 2 });
        this._noise(t, { buf: 'pink', type: 'bandpass', f: 1200, q: 0.4, peak: 0.28 * S, a: 0.15, d: 3, out: this.crowdIn, prio: 2 });
        for (let k = 0; k < 9; k++) this._rojao(t + rand(0.4, 14), rand(0.2, 0.4) * s, Math.random() < 0.4);
        for (let k = 0; k < 3; k++) this._flare(t + rand(0.5, 6), rand(0.015, 0.03), rand(3, 6));
        for (let k = 0; k < 18; k++) this._fanWhistle(t + rand(0.3, 12), rand(0.02, 0.05) * s, Math.random() < 0.4);
        for (let k = 0; k < 16; k++) this._shout(t + rand(0.1, 11), rand(0.05, 0.1) * s, Math.random() < 0.7);
        return;
      }
      if (kind === 'ooh') {                                             // "uhhhh" longo da chance perdida
        if (!this._bufEvent(t, b.ooh, [[0, 0.95 * s], [3.8, 0.95 * s]], [[0, 2600], [0.6, 3800], [3.8, 2000]], { loop: false, offset: 0, rate: rand(0.95, 1.05) })) {
          const d = 2.3;
          this._choir(t, 8, rand(150, 200), [[0, 0.85], [0.5, 1.3], [d, 0.72]], [[0, 0], [0.45, 0.5 * s], [1.1, 0.35 * s], [d, 0]], [[0, 'o'], [0.6, 'o'], [d, 'u']]);
        }
        this._bufEvent(t, b.roar, [[0, 0], [0.5, 0.4 * s], [2.6, 0]], [[0, 600], [0.6, 1800], [2.6, 500]], { rate: 0.95 });
        // mãos na cabeça e depois aplauso de incentivo pela tentativa
        this._bufEvent(t + 2.3, b.applause, [[0, 0], [0.5, 0.3 * s * fv], [1.8, 0.22 * s], [3, 0]], [[0, 5500], [3, 4500]]);
        for (let k = 0; k < 3; k++) this._shout(t + rand(0.8, 2), rand(0.03, 0.06) * s, false);
        for (let k = 0; k < 3; k++) this._shout(t + rand(2.4, 3.6), rand(0.04, 0.07) * s, true);   // "vamo!"
        return;
      }
      if (kind === 'groan') {                                           // lamento curto
        if (!this._bufEvent(t, b.ooh, [[0, 0], [0.05, 0.7 * s], [1.8, 0.5 * s], [2.6, 0]], [[0, 2000], [2.6, 900]], { loop: false, offset: 1.0, rate: 1.1 })) {
          const d = 2;
          this._choir(t, 8, rand(200, 250), [[0, 1], [0.2, 1.05], [d, 0.6]], [[0, 0], [0.15, 0.45 * s], [0.8, 0.25 * s], [d, 0]], [[0, 'a'], [0.5, 'o'], [d, 'u']]);
        }
        this._bufEvent(t, b.roar, [[0, 0], [0.12, 0.28 * s], [2, 0]], [[0, 1400], [2, 400]], { rate: 0.9 });
        return;
      }
      if (kind === 'card') { this.crowd('boo', Math.max(0.85, num(strength, 1))); return; }   // cartão: vaia cheia
      if (kind === 'boo') {                                             // vaia forte (falta contra a casa)
        s = Math.min(1.2, s * fv);
        if (!this._bufEvent(t, b.boo, [[0, 0], [0.35, 1.0 * s], [3, 0.9 * s], [4.4, 0]], [[0, 1200], [0.4, 2800], [4.4, 1400]])) {
          const d = 3.2;
          this._choir(t, 10, rand(110, 150), [[0, 0.95], [1, 1.05], [2, 0.95], [d, 0.85]], [[0, 0], [0.4, 0.45 * s], [2.6, 0.4 * s], [d, 0]], [[0, 'u'], [d, 'u']]);
        }
        this._bufEvent(t, b.roar, [[0, 0], [0.3, 0.3 * s], [2.5, 0]], [[0, 900], [2.5, 600]], { rate: 0.8 });
        for (let k = 0; k < 14; k++) this._fanWhistle(t + rand(0, 2.5), rand(0.03, 0.06) * s, Math.random() < 0.75);
        for (let k = 0; k < 4; k++) this._shout(t + rand(0.2, 2), rand(0.05, 0.08) * s, false);
        return;
      }
      if (kind === 'save') {
        this._bufEvent(t, b.applause, [[0, 0], [0.25, 0.6 * s], [2, 0.5 * s], [3.5, 0]], [[0, 7000], [3.5, 5000]]);
        this._bufEvent(t, b.roar, [[0, 0], [0.3, 0.35 * s], [1.6, 0]], [[0, 1200], [1.6, 800]]);
        for (let k = 0; k < 4; k++) this._fanWhistle(t + rand(0.1, 1.5), 0.03 * s, false);
        return;
      }
      if (kind === 'cheer') {
        this.boost = Math.max(this.boost, 0.4);
        this._bufEvent(t, b.roar, [[0, 0], [0.25, 0.65 * s], [1, 0.55 * s], [2.4, 0]], [[0, 1500], [0.3, 4400], [2.4, 1500]]);
        this._bufEvent(t + 0.2, b.applause, [[0, 0], [0.4, 0.35 * s], [2.5, 0]], [[0, 6000], [2.5, 5000]]);
        for (let k = 0; k < 4; k++) this._shout(t + rand(0, 1), 0.07 * s, true);
      }
    } catch (e) { console.warn('GameAudio.crowd', e); }
  }

  // Motor de cantos (chants.js): o: { song, rate, sectors[4], state } ou null para desligar.
  chantSectors(o) {
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t();
      this._engineOn = !!o;
      const party = this._now() < this._partyB;          // a festa do gol tem tocador próprio
      const song = o && !party ? o.song : null;
      if (song !== this._secSong || (o && this.secSrc && Math.abs(o.rate - this._secRate) > 1e-3)) {
        if (this.secSrc) { const old = this.secSrc; for (const gg of this.secG) { gg.gain.cancelScheduledValues(t); gg.gain.setTargetAtTime(0, t, 0.4); } setTimeout(() => old.forEach(x => { try { x.stop(); } catch (e) { /* já parou */ } }), 1600); }
        this.secSrc = null; this._secSong = song;
        if (song) {
          if (!this.bufs[song]) this._want(song);                 // offline gera na hora; online chega depois
          if (!this.bufs[song]) { this._secSong = null; return; }
          // as 4 cópias começam juntas (mesmo canto), cada uma no seu setor
          this.secSrc = this.secG.map((gg) => { const x = ctx.createBufferSource(); x.buffer = this.bufs[song]; x.loop = true; x.playbackRate.value = o.rate || 1; x.connect(gg); x.start(t + 0.05); return x; });
          this._secRate = o.rate || 1;
        }
      }
      if (!this.secSrc) return;
      const md = this.mood, mk = md < 0 ? Math.max(0.25, 1 + 0.8 * md) : 1 + 0.3 * md;
      const vol = (0.42 + 0.3 * (this._I || 0.3)) * mk * (1 - 0.6 * this.duck);
      o.sectors.forEach((v, i) => this.secG[i].gain.setTargetAtTime(v * vol, t, o.state === 'interrompido' ? 0.25 : 0.9));
    } catch (e) { console.warn('GameAudio.chantSectors', e); }
  }

  // chuva (§33): chiado agudo das gotas + grave do aguaceiro, volume pelo nível 0..1
  setRain(level = 0) {
    const ctx = this.ctx; if (!ctx) { this._rainLvl = level; return; }
    try {
      const t = this._t();
      if (!this._rain && level > 0 && this.bufs.pink) {
        const mk = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = this.bufs.pink; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.masterG); s.start(t, Math.random() * 2); return g; };
        this._rain = { hi: mk('highpass', 3800, 0.4), lo: mk('bandpass', 900, 0.5) };
      }
      if (this._rain) {
        this._rain.hi.gain.setTargetAtTime(0.05 * level, t, 1.5);
        this._rain.lo.gain.setTargetAtTime(0.035 * level * level, t, 1.5);
      }
    } catch (e) { console.warn('GameAudio.setRain', e); }
  }

  // ouvinte = câmera (posição, frente, cima)
  setListener(px, py, pz, fx, fy, fz) {
    const L = this.ctx && this.ctx.listener; if (!L) return;
    try {
      if (L.positionX) {
        const t = this._t();
        L.positionX.setTargetAtTime(px, t, 0.05); L.positionY.setTargetAtTime(py, t, 0.05); L.positionZ.setTargetAtTime(pz, t, 0.05);
        L.forwardX.setTargetAtTime(fx, t, 0.05); L.forwardY.setTargetAtTime(fy, t, 0.05); L.forwardZ.setTargetAtTime(fz, t, 0.05);
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(px, py, pz); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    } catch (e) { /* navegador sem ouvinte 3D */ }
  }

  // de onde saem os impactos (chute, quique, corpos): a posição da bola
  setSfxPos(x, y, z) {
    const p = this.sfxPan; if (!p) return;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }

  chant(on) {
    this._chantOn = !!on;
    const ctx = this.ctx; if (!ctx) return;
    try {
      const t = this._t();
      if (on) {
        if (!this.bufs.chant && !this._sync) { this._want('chant'); return; }   // _install liga quando ficar pronto
        this._ensureChant();
        if (!this.chantSrc) {
          const s = ctx.createBufferSource(); s.buffer = this.bufs.chant; s.loop = true;
          s.connect(this.chantG); s.start(t); this.chantSrc = s;
        }
        this.chantG.gain.cancelScheduledValues(t);
        this.chantG.gain.setTargetAtTime(this._song ? 0 : 0.45 + 0.3 * (this._I || 0.3), t, 1.2);
      } else {
        this._chantOffAt = t;
        this.chantG.gain.cancelScheduledValues(t);
        this.chantG.gain.setTargetAtTime(0, t, 1.5);
      }
    } catch (e) { console.warn('GameAudio.chant', e); }
  }

  // clima de entrada em campo: rumor crescente, cantos fortes, apitos, rojões, sinalizadores
  prematch(on) {
    try {
      if (on) {
        if (!this._pre) this._pre = { t0: this.ctx ? this._now() : null };
        if (this.ctx) this._want('chant', 'ole');
      } else this._pre = null;
    } catch (e) { console.warn('GameAudio.prematch', e); }
  }

  // os times saem do túnel: explosão de festa
  teamsEnter() {
    const ctx = this.ctx; if (!ctx) return;
    try {
      this._ensureBuffers(); this._want('gol', 'festa');
      const t = this._t(), b = this.bufs;
      this.boost = 1;
      // o pré-jogo pula direto para o rumor máximo e para o canto de festa (ciclo chant/festa/ole)
      if (this._pre && this._pre.t0 != null) this._pre.t0 = Math.min(this._pre.t0, this._now() - 64);
      const P = [[0, 0], [0.5, 1.0], [3, 0.95], [7, 0.75], [12, 0]];
      this._bufEvent(t, b.roar, P, [[0, 1500], [0.6, 5400], [12, 2500]]);
      this._bufEvent(t + 0.08, b.roar, P.map(([a, v]) => [a, v * 0.75]), [[0, 1200], [0.6, 4600], [12, 2000]], { rate: 1.06, pan: -0.4 });
      this._bufEvent(t + 0.12, b.roar, P.map(([a, v]) => [a, v * 0.65]), [[0, 1200], [0.6, 4200], [12, 1800]], { rate: 0.96, pan: 0.4 });
      // "ÊÊÊÊ" coletivo (o mesmo coro do gol, mais agudo)
      this._bufEvent(t + 0.2, b.gol, [[0, 0], [0.5, 0.75], [5.5, 0.6], [7.5, 0]], [[0, 1800], [0.6, 4400], [7.5, 2400]], { loop: false, offset: 0, rate: 1.1 });
      this._bufEvent(t + 0.3, b.applause, [[0, 0], [0.6, 0.75], [8, 0.55], [12, 0]], [[0, 7000], [12, 5000]]);
      this._noise(t, { buf: 'brown', type: 'lowpass', f: 170, q: 0.6, peak: 0.6, a: 0.4, d: 5, out: this.crowdIn, prio: 2 });
      for (let k = 0; k < 10; k++) this._rojao(t + rand(0, 7), rand(0.25, 0.45), Math.random() < 0.4);
      for (let k = 0; k < 3; k++) this._flare(t + rand(0, 2), rand(0.015, 0.03), rand(3, 6));
      for (let k = 0; k < 18; k++) this._fanWhistle(t + rand(0.2, 8), rand(0.02, 0.05), Math.random() < 0.4);
      for (let k = 0; k < 14; k++) this._shout(t + rand(0.1, 8), rand(0.05, 0.1), Math.random() < 0.7);
    } catch (e) { console.warn('GameAudio.teamsEnter', e); }
  }

  // hino da torcida (melodia original, coro sustentado + marcha de surdos). Ao ligar, a
  // arquibancada aplaude e "abre" o coro; o murmúrio baixa para o canto aparecer.
  anthem(on) {
    try {
      const was = this._anthemOn;
      this._anthemOn = !!on;
      if (!on || !this.ctx) return;
      this._want('anthem');
      if (!was && this.bufs.applause) {
        const t = this._t();
        this._bufEvent(t, this.bufs.applause, [[0, 0], [0.8, 0.45], [3, 0.3], [5, 0]], [[0, 6000], [5, 4500]]);
      }
    } catch (e) { console.warn('GameAudio.anthem', e); }
  }

  // empolgação da torcida da casa: 0 (frustrada, vaia contínua leve abaixo de ~0,3)
  // .. 0,5 (neutra, padrão) .. 1 (em festa: canta mais, mais alto e reage mais forte).
  setHomeMood(v) {
    const x = clamp01(num(v, 0.5));
    this._moodT = 2 * x - 1;
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
