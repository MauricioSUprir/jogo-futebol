// Forma do estádio para o PRÉ-JOGO (pura: sem three.js nem DOM): os sólidos onde a câmera de cinema nunca pode
// entrar (arquibancadas, túnel, paredes, coberturas, fachada, placas, bancos, refletores, gols, prédios, árvores) e o
// lado de FORA (fachada, cobertura em anel, cantos do lado de cá, esplanada, prédios, árvores, carros e torcedores
// chegando), que render/estadio-fora.js desenha e tools/teste-prejogo-roteiro.mjs usa para conferir os trilhos.
//
// As medidas das arquibancadas são as de campo.js / torcida-dados.js (ARQUIBANCADA) e o túnel o de config.js
// (ESTADIO.tunel). O lado de fora só existe no pré-jogo (o estádio do jogo continua o de sempre: a câmera de TV
// fica dentro da arquibancada do lado de cá e a cobertura entraria no quadro dela).
//
// Lado de fora (PESQUISA-PREJOGO.md §3): a fachada é um retângulo de cantos arredondados em volta de tudo (|x| = 89,5,
// |z| = 75,5, raio 24 m, 27 m de altura — passa um pouco das paredes de trás das arquibancadas, 25 m); a cobertura é um
// anel do topo da fachada (27,6 m) até a borda de dentro (|x| = 70,5, |z| = 57, raio 14 m, 30 m: sobe para o campo,
// como as coberturas em balanço); os cantos do lado de cá (abertos no jogo) ganham um degrau de concreto e cadeiras
// vazias; a esplanada (piso de concreto) vai da fachada a ±215 m, com dois estacionamentos; depois o bairro.
import { ESTADIO, CAMPO } from './config.js';
import { ARQUIBANCADA as A } from './render/torcida-dados.js';

export const FORA = {
  fachada: { hx: 89.5, hz: 75.5, raio: 24, altura: 27, esp: 1.0 },
  cobertura: { hx: 70.5, hz: 57, raio: 14, yDentro: 30, yFora: 27.6, esp: 0.6 },
  // cantos do lado de cá (z +): degrau inclinado de (|x| 62,5, y 1,4, z 44,5) até (88,5, 21, 74,5)
  canto: { x: [A.fundoX0, A.fundoX0 + A.profFundo], z: [A.frenteZ, A.frenteZ + A.profLado], y: [A.yBase, A.yTopoFundo, A.yTopoLado, 21] },
  esplanada: { meia: 215, y: 0.06 },
  bairro: { meia: 1300, y: -0.3 },
  // praça da entrada principal (z +): nada de prédio, árvore ou carro (a câmera da grua passa aqui)
  praca: { x: [-70, 70], z: [78, 175] },
  estacionamentos: [{ x: [100, 190], z: [-160, -95] }, { x: [-190, -100], z: [-160, -95] }, { x: [110, 195], z: [70, 150] }, { x: [-195, -110], z: [70, 150] }],
  placa: { texto: 'ESTÁDIO GOLAÇO', y: [17.5, 23.5], largura: 46 },
  semente: 20261012,
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/** Distância com sinal ao retângulo de cantos arredondados (meias medidas hx, hz; raio r): < 0 dentro. */
export function sdRetArredondado(x, z, hx, hz, r) {
  const qx = Math.abs(x) - (hx - r), qz = Math.abs(z) - (hz - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

/** Altura da cobertura em (x, z) — null fora do anel. */
export function alturaCobertura(x, z) {
  const F = FORA.fachada, C = FORA.cobertura;
  const dIn = sdRetArredondado(x, z, C.hx, C.hz, C.raio), dOut = sdRetArredondado(x, z, F.hx, F.hz, F.raio);
  if (dIn < 0 || dOut > 0) return null;
  const u = dIn / Math.max(1e-6, dIn - dOut);   // 0 na borda de dentro, 1 na fachada
  return C.yDentro + (C.yFora - C.yDentro) * u;
}

/** Altura do degrau do canto do lado de cá em (|x|, z) (bilinear) — null fora dele. */
export function alturaCanto(x, z) {
  const K = FORA.canto, ax = Math.abs(x);
  if (z < K.z[0] || z > K.z[1] || ax < K.x[0] || ax > K.x[1]) return null;
  const u = (ax - K.x[0]) / (K.x[1] - K.x[0]), v = (z - K.z[0]) / (K.z[1] - K.z[0]);
  const [y00, y10, y01, y11] = K.y;
  return (y00 * (1 - u) + y10 * u) * (1 - v) + (y01 * (1 - u) + y11 * u) * v;
}

// assento das arquibancadas (o degrau): lado (pela distância |z| da frente) e fundos (pela |x|)
const seatLado = zz => (zz < A.frenteZ ? A.yBase : A.yBase + (A.yTopoLado - A.yBase) * clamp((zz - A.frenteZ) / A.profLado, 0, 1));
const seatFundo = xx => A.yBase + (A.yTopoFundo - A.yBase) * clamp((xx - A.fundoX0) / A.profFundo, 0, 1);

// ------------------------------------------------------------------ lado de fora (posições puras, com semente)
function gerador(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const naPraca = (x, z, m = 0) => x > FORA.praca.x[0] - m && x < FORA.praca.x[1] + m && z > FORA.praca.z[0] - m && z < FORA.praca.z[1] + m;
const noEstac = (x, z, m = 0) => FORA.estacionamentos.some(e => x > e.x[0] - m && x < e.x[1] + m && z > e.z[0] - m && z < e.z[1] + m);

let _predios = null;
/** Prédios do bairro: [{x, z, lx, lz, h, rumo}] (caixas; de 245 m a ~1,1 km do centro, mais altos longe). */
export function predios() {
  if (_predios) return _predios;
  const r = gerador(FORA.semente), lista = [];
  const Q = 64; // quadra
  for (let i = -18; i <= 18; i++) for (let k = -18; k <= 18; k++) {
    const cx = i * Q + 8, cz = k * Q - 6;
    const d = Math.hypot(cx, cz);
    if (d < 250 || d > 1150) continue;
    if (r() < 0.22) continue; // praças e terrenos
    const n = 1 + (r() < 0.45 ? 1 : 0);
    for (let m = 0; m < n; m++) {
      const lx = 16 + r() * 22, lz = 16 + r() * 22;
      const longe = clamp((d - 250) / 700, 0, 1);
      const h = 7 + r() * (14 + 46 * longe) + (r() < 0.06 ? 40 : 0);
      const ox = (n === 2 ? (m ? 1 : -1) * 13 : 0) + (r() - 0.5) * 6, oz = (r() - 0.5) * 6;
      lista.push({ x: cx + ox, z: cz + oz, lx: n === 2 ? Math.min(lx, 24) : lx, lz, h, rumo: (r() - 0.5) * 0.12 });
    }
  }
  _predios = lista;
  return lista;
}

let _arvores = null;
/** Árvores: [{x, z, h, raio}] — em volta da esplanada e nas calçadas da praça (fora da praça e dos estacionamentos). */
export function arvores() {
  if (_arvores) return _arvores;
  const r = gerador(FORA.semente + 1), lista = [];
  const E = FORA.esplanada.meia;
  // anel de árvores na borda da esplanada (lado de dentro), a cada ~11 m
  for (let s = 0; s < 4; s++) {
    for (let p = -E + 8; p <= E - 8; p += 11 + r() * 3) {
      const borda = E - 6 - r() * 4;
      const x = s < 2 ? p : (s === 2 ? borda : -borda), z = s < 2 ? (s === 0 ? borda : -borda) : p;
      if (naPraca(x, z, 6) || noEstac(x, z, 4)) continue;
      lista.push({ x, z, h: 7 + r() * 5, raio: 2.6 + r() * 1.4 });
    }
  }
  // duas fileiras de árvores ladeando a praça
  for (let z = FORA.praca.z[0] + 8; z < FORA.praca.z[1]; z += 13) {
    for (const x of [FORA.praca.x[0] - 5, FORA.praca.x[1] + 5]) lista.push({ x: x + (r() - 0.5), z: z + (r() - 0.5) * 2, h: 8 + r() * 4, raio: 3 + r() });
  }
  _arvores = lista;
  return lista;
}

let _carros = null;
/** Carros nos estacionamentos: [{x, z, rumo, cor: 0–7}] (vagas em fileiras, nem todas ocupadas). */
export function carros() {
  if (_carros) return _carros;
  const r = gerador(FORA.semente + 2), lista = [];
  for (const e of FORA.estacionamentos) {
    for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) {
      for (let x = e.x[0] + 2; x < e.x[1] - 2; x += 2.7) {
        if (r() < 0.25) continue;
        lista.push({ x, z: z + (r() - 0.5) * 0.3, rumo: Math.PI / 2 + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.08, cor: Math.floor(r() * 8) });
      }
    }
  }
  _carros = lista;
  return lista;
}

let _torcedores = null;
/** Torcedores chegando (na esplanada, sobretudo na praça da entrada principal): [{x, z, time: 0|1}]. */
export function torcedoresFora() {
  if (_torcedores) return _torcedores;
  const r = gerador(FORA.semente + 3), lista = [];
  const F = FORA.fachada;
  // a praça: mais gente perto dos portões (z ≈ 80) e um caminho até o fim dela
  for (let i = 0; i < 760; i++) {
    const t = Math.pow(r(), 1.8);
    const z = F.hz + 3 + t * (FORA.praca.z[1] - F.hz - 10);
    const x = (r() - 0.5) * (30 + 70 * t) + (r() - 0.5) * 8;
    lista.push({ x, z, time: r() < 0.08 ? 1 : 0 });
  }
  // em volta da fachada (os outros portões) e nas calçadas
  for (let i = 0; i < 460; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 26;
    const hx = F.hx + d, hz = F.hz + d;
    const x = Math.cos(a) * hx * 1.05, z = Math.sin(a) * hz * 1.05;
    if (z > F.hz && Math.abs(x) < 75) continue;
    if (noEstac(x, z, 2)) continue;
    lista.push({ x, z, time: x < -60 ? (r() < 0.6 ? 1 : 0) : (r() < 0.05 ? 1 : 0) });
  }
  _torcedores = lista;
  return lista;
}

// ------------------------------------------------------------------ sólidos (a câmera de cinema fica fora deles)
const T = ESTADIO.tunel;
const BANCOS = ESTADIO.bancos;
/**
 * O ponto (x, y, z) está dentro (ou a menos de `folga` m) de algo sólido? Devolve o nome ou null. `fora`: conta
 * também o lado de fora (fachada, cobertura, cantos, prédios, árvores) — o pré-jogo.
 */
export function solidoEm(x, y, z, folga = 0.3, fora = true) {
  const f = folga;
  if (y <= 0.3 + f * 0.5) return 'chão';
  const ax = Math.abs(x), az = Math.abs(z);
  // túnel do lado de cá: o corredor por dentro é livre (e a boca)
  const noTunel = z > 0 && ax < T.largura / 2 - f && y < T.altura - f && z > T.z - 2 && z < T.z + T.profundidade - f;
  // arquibancadas dos lados (lá: z −; cá: z +)
  if (ax <= A.meioComprimento + f && az >= A.frenteZ - f && az <= A.frenteZ + A.profLado + f) {
    if (!noTunel) {
      if (y <= seatLado(az) + f) return z < 0 ? 'arquibancada de lá' : (ax < T.largura / 2 + 0.4 + f && y < T.altura + T.laje + f ? 'túnel (paredes)' : 'arquibancada de cá');
      if (az >= A.frenteZ + A.profLado - f && y <= A.yTopoLado + 5 + f) return z < 0 ? 'parede de lá' : 'parede de cá';
    }
    // marquise de lá (z −74,5 → −58,5, y 25 → 26,5) e o teto curto de cá (z 74,5 → 70, y 25 → 25,6)
    if (z < 0 && az >= A.frenteZ + A.profLado - 16 - f) {
      const yr = A.yTopoLado + 5 + 1.5 * (A.frenteZ + A.profLado - az) / 16;
      if (Math.abs(y - yr) <= 0.3 + f) return 'marquise de lá';
    }
    if (z > 0 && az >= A.frenteZ + A.profLado - 4.5 - f) {
      const yr = A.yTopoLado + 5 + 0.6 * (A.frenteZ + A.profLado - az) / 4.5;
      if (Math.abs(y - yr) <= 0.3 + f) return 'teto de cá';
    }
  }
  // fundos (atrás dos gols): de z −74,5 a +44,5
  if (ax >= A.fundoX0 - f && ax <= A.fundoX0 + A.profFundo + f && z >= -(A.frenteZ + A.profLado) - f && z <= A.frenteZ + f) {
    if (y <= seatFundo(ax) + f) return x > 0 ? 'fundo +x' : 'fundo −x';
    if (ax >= A.fundoX0 + A.profFundo - f && y <= A.yTopoFundo + 5 + f) return 'parede do fundo';
  }
  // placas de publicidade (0,9 m) em volta do campo
  const PX = CAMPO.meioX + CAMPO.entorno, PZ = CAMPO.meioZ + CAMPO.entorno;
  if (y <= 0.96 + f && ((ax >= PX - f && ax <= PX + 0.14 + f && az <= PZ + 0.14) || (az >= PZ - f && az <= PZ + 0.14 + f && ax <= PX + 0.14))) return 'placas';
  // gols (a estrutura de 2 m de fundo)
  if (ax >= CAMPO.meioX - 0.15 - f && ax <= CAMPO.meioX + CAMPO.gol.profundidade + f && az <= CAMPO.gol.largura / 2 + 0.2 + f && y <= CAMPO.gol.altura + 0.2 + f) return 'gol';
  // bancos de reservas (lado de cá)
  if (z > 0 && ax >= BANCOS.x[0] - 0.3 - f && ax <= BANCOS.x[1] + 0.3 + f && z >= BANCOS.z[0] - 0.6 - f && z <= BANCOS.z[1] + f && y <= BANCOS.altura + 0.15 + f) return 'banco';
  // torres dos refletores (±72, ±56) e o painel no alto
  {
    const d = Math.hypot(ax - 72, az - 56);
    if (d <= 0.45 + f && y <= 38 + f) return 'refletor';
    if (d <= 3.6 + f && y >= 37.9 - f && y <= 41.1 + f) return 'refletor';
  }
  if (!fora) return null;
  // cantos do lado de cá (degrau de concreto e cadeiras)
  if (z > 0) {
    const yc = alturaCanto(x, z);
    if (yc != null && y <= yc + f) return 'canto de cá';
  }
  // fachada (parede fina de 27 m) e cobertura (anel)
  const Fa = FORA.fachada;
  const sd = sdRetArredondado(x, z, Fa.hx, Fa.hz, Fa.raio);
  if (Math.abs(sd) <= Fa.esp / 2 + f && y <= Fa.altura + f) return 'fachada';
  const yc = alturaCobertura(x, z);
  if (yc != null && Math.abs(y - yc) <= FORA.cobertura.esp / 2 + f) return 'cobertura';
  // depois da fachada: árvores e prédios (o bairro)
  if (sd > 0) {
    for (const a of arvores()) {
      const d = Math.hypot(x - a.x, z - a.z);
      if (d <= 0.3 + f && y <= a.h) return 'árvore';
      if (d <= a.raio + f && y >= a.h * 0.4 - f && y <= a.h + a.raio * 0.4 + f) return 'árvore';
    }
    if (Math.hypot(x, z) > 230) {
      for (const p of predios()) {
        const c = Math.cos(-p.rumo), s = Math.sin(-p.rumo);
        const lx = (x - p.x) * c - (z - p.z) * s, lz = (x - p.x) * s + (z - p.z) * c;
        if (Math.abs(lx) <= p.lx / 2 + f && Math.abs(lz) <= p.lz / 2 + f && y <= p.h + f) return 'prédio';
      }
    }
  }
  return null;
}

/** A câmera está no corredor do túnel? (o plano do túnel; a arquibancada de cá tem que ser desenhada) */
export function noCorredorDoTunel(x, y, z) {
  return z > T.z - 0.5 && z < T.z + T.profundidade && Math.abs(x) < T.largura / 2 && y < T.altura;
}
