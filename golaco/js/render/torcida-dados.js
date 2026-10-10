// Torcida (dados): conta PURA (sem three.js nem DOM) de onde senta cada torcedor, com que roupa, pele e
// cabelo, e o atlas das figuras desenhado por código (8 poses). torcida.js monta o InstancedMesh com
// isto; tools/teste-torcida.mjs confere em Node.
//
// Arquibancadas (as mesmas de campo.js, constantes em ARQUIBANCADA): o lado de lá (z −, de frente para
// a câmera de TV) e os dois fundos (atrás dos gols). Cada cadeira da textura (ARQ: 36 fileiras, 0,5 m
// por cadeira, corredor a cada 26) pode ter um torcedor, pela ocupação da qualidade. Setores (dono:
// mandante maioria): o Golaço FC (time 0) em quase tudo, a ORGANIZADA dele no fundo +x (sempre em pé,
// pulando no ritmo), o setor VISITANTE (Ventania FC, time 1) no fundo −x, separado por cadeiras vazias,
// e o mosaico "GOLAÇO" das cadeiras do lado de lá vira um mosaico de camisas verdes.
//
// Atlas: cada pose numa célula de 64 × 128 px (1,1 × 2,2 m). Os canais NÃO são cor: R = peso da
// camisa, G = peso da pele, B = peso do cabelo/calça, A = cobertura; o que sobra (A − R − G − B) é o
// acento (cachecol, na cor do time). Os pesos já vêm multiplicados pela cobertura: os mipmaps (média)
// continuam certos e o shader troca as cores por torcedor sem textura nova.

export const ARQUIBANCADA = {
  frenteZ: 44.5,          // z da frente do lado de lá (CAMPO.meioZ + entorno + 4,5)
  profLado: 30, yBase: 1.4, yTopoLado: 20,
  meioComprimento: 62.5,  // ±x do lado de lá
  fundoX0: 62.5,          // x da frente dos fundos (CAMPO.meioX + entorno + 4)
  profFundo: 26, yTopoFundo: 17,
  fileiras: 36, assento: 0.5, comprimento: 125, corredor: 26,
  vMax: 1 - 24 / 512,     // v do topo da textura (a faixa de cima é a parede)
  vFundo: 0.82,           // os fundos usam até 82% da altura da textura
};

export const TORCIDA = {
  ocupacao: { baixa: 0.38, media: 0.62, alta: 0.9 },
  animada: { baixa: false, media: true, alta: true },
  atlasCelula: { baixa: [32, 64], media: [64, 128], alta: [64, 128] },
  largura: 1.1, altura: 2.2,  // m do quadro de cada torcedor (cabe os braços para cima)
  visitante: { x: -1, z: [-22, 18], vazio: 4 },   // fundo −x; 4 m de cadeiras vazias de cada lado
  organizada: { x: 1, z: [-18, 18] },              // fundo +x
  quadros: 8,
};

// poses (índice da célula no atlas)
export const POSE = { SENTADO: 0, SENTADO_PALMAS: 1, EM_PE: 2, EM_PE_PALMAS: 3, BRACOS_V: 4, UM_BRACO: 5, CACHECOL: 6, MAOS_CABECA: 7 };

// cores (sRGB) — tudo fictício: o Golaço FC de preto e verde, o Ventania FC de branco e cinza
const CASA_CAMISA = [['#15191b', 50], ['#19e07a', 17], ['#10b862', 8], ['#f2f4f3', 6], ['#2b3238', 7], ['#20304a', 5], ['#7a1f24', 3], ['#c9a227', 2], ['#3a5e8c', 2]];
const FORA_CAMISA = [['#e9ecee', 58], ['#b9bfc4', 20], ['#f7f8f8', 10], ['#2b3238', 6], ['#20304a', 6]];
const PELE = [['#f1c7a5', 10], ['#e3b08a', 14], ['#c99069', 16], ['#a8714d', 16], ['#8d5636', 14], ['#6b3e25', 12], ['#4b2b1b', 8], ['#d9a27b', 10]];
const CABELO = [['#16110d', 36], ['#2b1d14', 22], ['#4a3222', 14], ['#7a5a3a', 6], ['#b8935a', 4], ['#8c8c88', 6], ['#26303a', 12]];
export const VERDE_MOSAICO = '#19e07a';

function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function sorteia(lista, r) {
  let tot = 0;
  for (const [, p] of lista) tot += p;
  let x = r * tot;
  for (const [c, p] of lista) { x -= p; if (x <= 0) return hex(c); }
  return hex(lista[lista.length - 1][0]);
}

/** Gerador com semente (mulberry32) — só para o desenho, nunca o gerador do mundo. */
export function geradorTorcida(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cadeiras de cada arquibancada: lista de {setor: 0 lado | 1 fundo +x | 2 fundo −x, f (fileira, 0 = a
 * de cima), a (cadeira), x, y, z (base, sobre o degrau)}.
 */
export function cadeiras() {
  const A = ARQUIBANCADA, lista = [];
  const nA = Math.round(A.comprimento / A.assento);
  for (let f = 0; f < A.fileiras; f++) {
    const sLado = 1 - (f + 0.5) / A.fileiras;            // 0 = frente, 1 = topo (v / vMax)
    const sFundo = sLado / A.vFundo;
    for (let a = 0; a < nA; a++) {
      if (a % A.corredor < 2) continue;
      const u = (a + 0.5) / nA;
      lista.push({ setor: 0, f, a, x: -A.meioComprimento + A.comprimento * u, y: A.yBase + (A.yTopoLado - A.yBase) * sLado, z: -A.frenteZ - A.profLado * sLado });
      if (sFundo <= 1) {
        const u1 = (A.frenteZ + A.frenteZ + A.profLado) / A.comprimento; // 119/125
        if (u > u1) continue;
        for (const s of [1, -1]) {
          const za = s > 0 ? A.frenteZ : -(A.frenteZ + A.profLado), zb = s > 0 ? -(A.frenteZ + A.profLado) : A.frenteZ;
          lista.push({ setor: s > 0 ? 1 : 2, f, a, x: s * (A.fundoX0 + A.profFundo * sFundo), y: A.yBase + (A.yTopoFundo - A.yBase) * sFundo, z: za + (zb - za) * (u / u1) });
        }
      }
    }
  }
  return lista;
}

/**
 * Torcedores de uma qualidade. mascara: Uint8Array(nA × fileiras) com 1 nas cadeiras do mosaico "GOLAÇO"
 * do lado de lá (ou null). Devolve {n, pos: Float32Array(4n) [x, y, z, escala], camisa, pele, cabelo,
 * info: Uint8Array(4n)} — info = [time·255, setor·85, organizada·255, semente2]; pele[3] = semente.
 */
export function gerarTorcida(qualidade = 'media', mascara = null) {
  const T = TORCIDA, A = ARQUIBANCADA;
  const ocup = T.ocupacao[qualidade] ?? T.ocupacao.media;
  const rnd = geradorTorcida(20261010);
  const nA = Math.round(A.comprimento / A.assento);
  const sel = [];
  for (const c of cadeiras()) {
    const r = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd(), r6 = rnd(), r7 = rnd();
    let time = 0, org = 0, mosaico = false;
    let p = ocup * (c.setor === 0 ? 1 : 0.95) * (1 - 0.18 * (1 - (c.f + 0.5) / A.fileiras) * (c.setor === 0 ? 1 : 0)); // topo um pouco mais vazio
    if (c.setor === 0 && mascara && mascara[c.a + c.f * nA]) { mosaico = true; p = qualidade === 'baixa' ? 0.8 : 1; }
    if (c.setor === 2) {
      const [z0, z1] = T.visitante.z;
      if (c.z >= z0 && c.z <= z1) { time = 1; p = Math.min(1, ocup * 1.05); }
      else if (c.z >= z0 - T.visitante.vazio && c.z <= z1 + T.visitante.vazio) p = 0; // separação
    }
    if (c.setor === 1 && c.z >= T.organizada.z[0] && c.z <= T.organizada.z[1]) { org = 1; p = Math.min(1, ocup * 1.15 + 0.08); }
    // alguns visitantes espalhados pelo lado de lá
    if (c.setor === 0 && !mosaico && r7 < 0.03) time = 1;
    if (r >= p) continue;
    const camisa = mosaico ? hex(VERDE_MOSAICO) : sorteia(time === 1 ? FORA_CAMISA : CASA_CAMISA, r2);
    const pele = sorteia(PELE, r3);
    const careca = r5 < 0.08;
    const cabelo = careca ? pele : sorteia(CABELO, r4);
    sel.push({
      x: c.x + (r6 - 0.5) * 0.12, y: c.y, z: c.z, esc: 0.92 + 0.16 * r5,
      camisa, pele, cabelo, time, setor: c.setor, org, s1: Math.floor(r6 * 255.99), s2: Math.floor(r2 * 255.99),
    });
  }
  const n = sel.length;
  const pos = new Float32Array(4 * n), camisa = new Uint8Array(4 * n), pele = new Uint8Array(4 * n), cabelo = new Uint8Array(4 * n), info = new Uint8Array(4 * n);
  sel.forEach((t, i) => {
    pos[4 * i] = t.x; pos[4 * i + 1] = t.y; pos[4 * i + 2] = t.z; pos[4 * i + 3] = t.esc;
    camisa.set([...t.camisa, 255], 4 * i);
    pele.set([...t.pele, t.s1], 4 * i);
    cabelo.set([...t.cabelo, 255], 4 * i);
    info.set([t.time * 255, t.setor * 85, t.org * 255, t.s2], 4 * i);
  });
  return { n, pos, camisa, pele, cabelo, info };
}

// ------------------------------------------------------------------ atlas das figuras (SDF)

function dSeg(px, py, ax, ay, bx, by, r) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(wx - vx * t, wy - vy * t) - r;
}
function dCaixa(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function dCirc(px, py, cx, cy, r) { return Math.hypot(px - cx, py - cy) - r; }

/** Formas de uma pose: lista em ordem de pintura de [região 0 camisa | 1 pele | 2 cabelo | 3 acento, sdf(x, y)]. */
function formas(pose) {
  const sent = pose === POSE.SENTADO || pose === POSE.SENTADO_PALMAS;
  const dy = sent ? -0.4 : 0;
  const ombroY = 1.38 + dy, quadrilY = 0.95 + dy, cabecaY = 1.6 + dy;
  const L = [];
  // pernas (calça, na cor do cabelo/calça)
  if (sent) {
    for (const s of [-1, 1]) {
      L.push([2, (x, y) => dSeg(x, y, s * 0.09, quadrilY, s * 0.13, quadrilY - 0.06, 0.08)]);
      L.push([2, (x, y) => dSeg(x, y, s * 0.13, quadrilY - 0.06, s * 0.13, 0.1, 0.07)]);
    }
  } else {
    for (const s of [-1, 1]) L.push([2, (x, y) => dSeg(x, y, s * 0.09, quadrilY, s * 0.105, 0.1, 0.075)]);
  }
  // tronco, pescoço, cabeça, cabelo
  L.push([0, (x, y) => dCaixa(x, y, 0, (ombroY + quadrilY) / 2 + 0.02, 0.18, (ombroY - quadrilY) / 2 + 0.05, 0.07)]);
  L.push([1, (x, y) => dSeg(x, y, 0, ombroY + 0.02, 0, cabecaY - 0.08, 0.05)]);
  L.push([1, (x, y) => dCirc(x, y, 0, cabecaY, 0.105)]);
  L.push([2, (x, y) => Math.max(dCirc(x, y, 0, cabecaY + 0.025, 0.11), cabecaY + 0.01 - y)]);
  // braços: [cotovelo, mão] de cada lado (−1 = esquerda na tela, +1 = direita)
  const baixo = s => [[s * 0.25, ombroY - 0.26], [s * 0.26, ombroY - 0.48]];
  const palmas = s => [[s * 0.27, ombroY - 0.2], [s * 0.04, ombroY - 0.08]];
  const V = s => [[s * 0.33, ombroY + 0.27], [s * 0.45, ombroY + 0.54]];
  const cima = s => [[s * 0.27, ombroY + 0.3], [s * 0.31, ombroY + 0.6]];
  const cachecol = s => [[s * 0.3, ombroY + 0.28], [s * 0.36, ombroY + 0.57]];
  const cabeca = s => [[s * 0.36, ombroY + 0.2], [s * 0.11, cabecaY + 0.1]];
  let bracos;
  switch (pose) {
    case POSE.SENTADO: case POSE.EM_PE: bracos = [baixo(-1), baixo(1)]; break;
    case POSE.SENTADO_PALMAS: case POSE.EM_PE_PALMAS: bracos = [palmas(-1), palmas(1)]; break;
    case POSE.BRACOS_V: bracos = [V(-1), V(1)]; break;
    case POSE.UM_BRACO: bracos = [baixo(-1), cima(1)]; break;
    case POSE.CACHECOL: bracos = [cachecol(-1), cachecol(1)]; break;
    default: bracos = [cabeca(-1), cabeca(1)];
  }
  bracos.forEach(([cot, mao], i) => {
    const s = i === 0 ? -1 : 1, ox = s * 0.2, oy = ombroY - 0.02;
    L.push([0, (x, y) => dSeg(x, y, ox, oy, cot[0], cot[1], 0.058)]);   // manga
    L.push([1, (x, y) => dSeg(x, y, cot[0], cot[1], mao[0], mao[1], 0.048)]); // antebraço
    L.push([1, (x, y) => dCirc(x, y, mao[0], mao[1], 0.052)]);              // mão
  });
  if (pose === POSE.CACHECOL) {
    const yc = ombroY + 0.55;
    L.push([3, (x, y) => dCaixa(x, y, 0, yc, 0.42, 0.05, 0.02)]);
    for (const s of [-1, 1]) L.push([3, (x, y) => dCaixa(x, y, s * 0.39, yc - 0.13, 0.04, 0.13, 0.02)]);
  }
  return L;
}

/**
 * Atlas das 8 poses: Uint8Array RGBA (largura = 8·cw, altura = ch), linha 0 = EMBAIXO (y = 0, como o
 * DataTexture sem flipY). R/G/B = pesos de camisa/pele/cabelo já vezes a cobertura; A = cobertura.
 */
export function atlasTorcida(cw = 64, ch = 128) {
  const T = TORCIDA, W = cw * T.quadros, H = ch;
  const dados = new Uint8Array(W * H * 4);
  const px = T.largura / cw;
  for (let pose = 0; pose < T.quadros; pose++) {
    const L = formas(pose);
    for (let r = 0; r < H; r++) {
      const y = (r + 0.5) / H * T.altura;
      for (let c = 0; c < cw; c++) {
        const x = (c + 0.5) / cw * T.largura - T.largura / 2;
        // pinta de trás para frente: (pesos, cobertura) sobre o que já tem
        let wr = 0, wg = 0, wb = 0, wa = 0, a = 0;
        for (const [reg, f] of L) {
          const cob = Math.max(0, Math.min(1, 0.5 - f(x, y) / px));
          if (cob <= 0) continue;
          wr *= 1 - cob; wg *= 1 - cob; wb *= 1 - cob; wa *= 1 - cob; a = a * (1 - cob) + cob;
          if (reg === 0) wr += cob; else if (reg === 1) wg += cob; else if (reg === 2) wb += cob; else wa += cob;
        }
        const k = (r * W + pose * cw + c) * 4;
        dados[k] = Math.round(wr * 255); dados[k + 1] = Math.round(wg * 255); dados[k + 2] = Math.round(wb * 255); dados[k + 3] = Math.round(a * 255);
      }
    }
  }
  return { dados, largura: W, altura: H };
}

/**
 * Pose e pulo de um torcedor (a MESMA regra do vertex shader de torcida.js, para os testes):
 * niveis = {excita, tensao, lamento, palmas} do time dele; h = semente 0–1; org = organizada; t = s.
 */
export function poseDoTorcedor(niveis, h, h2, org, t, animada = true) {
  const { excita, tensao, lamento, palmas } = niveis;
  const emPe = org || tensao > 0.25 + 0.7 * h || excita > 0.08 + 0.5 * h;
  const bate = animada && (Math.sin(t * Math.PI * 2 * 2.3 + h2 * 6.283) > 0) ? 1 : 0;
  let pose;
  if (excita > 0.2 + 0.55 * h) pose = h2 < 0.45 ? POSE.BRACOS_V : h2 < 0.75 ? POSE.UM_BRACO : POSE.CACHECOL;
  else if (lamento > 0.3 + 0.5 * h) pose = POSE.MAOS_CABECA;
  else if (palmas > 0.2 + 0.6 * h) pose = emPe ? (bate ? POSE.EM_PE_PALMAS : POSE.EM_PE) : (bate ? POSE.SENTADO_PALMAS : POSE.SENTADO);
  else if (org) pose = h2 < 0.15 ? POSE.CACHECOL : h2 < 0.3 ? POSE.UM_BRACO : (bate && h2 < 0.6 ? POSE.EM_PE_PALMAS : POSE.EM_PE);
  else pose = emPe ? POSE.EM_PE : POSE.SENTADO;
  let pulo = 0;
  if (animada) {
    const fase = Math.sin(t * Math.PI * 2 * 1.9 + h * 6.283);
    if (excita > 0.2 + 0.55 * h) pulo = Math.max(0, fase) * 0.32 * Math.min(1, excita * 1.4);
    else if (org) pulo = Math.max(0, Math.sin(t * Math.PI * 2 * 1.6 + h * 0.6)) * 0.11;
  }
  return { pose, emPe, pulo };
}
