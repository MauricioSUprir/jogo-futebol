// Olhos do REPLAY do gol (pedidos do dono de 12/10: "uma 3ª e uma 4ª câmera de replay, onde uma é a visão em 1ª pessoa
// do jogador fazendo o gol" e "a 4ª pode ser a visão do treinador"). PURO (sem three.js nem DOM), no molde do
// replay-saot.js: lê o anel (render/replay-anel.js), que já tem todos os passos do plano — por isso suaviza SEM atraso
// (filtros de fase zero, centrados no passo) — e devolve, por passo do plano, onde fica o olho e para onde ele olha. O
// diretor (render/replay.js) só interpola entre dois passos. Testado em Node (tools/teste-replay-anel.mjs G6–G10).
//
// 1ª PESSOA (cam 'primeira'; REPLAY.primeira; PESQUISA-ESTADIO.md §12):
//  - olho = a cabeça gravada + frente·0,10 + cima·0,03 (frente = horizontal, da linha dos ombros, como jogador3d frente());
//  - x/z por gaussiana σ 0,08 s; y por média móvel de 0,33 s (um passo: a cabeça sobe e desce 2–9 cm correndo e o cérebro
//    estabiliza o olhar — Pozzo & Berthoz 1991); rolagem sempre 0; nada de balançar no ritmo da passada (Nesky, GDC 2014
//    #44; Oculus: "do not use head bobbing"); sem tremor;
//  - olhar: a bola (sem descer mais que 30° até chute − 0,25 s: a boca do gol fica no quadro), de chute − 0,25 s a chute +
//    0,1 s para baixo, na bola e no pé, depois a bola puxada 35% para o centro da boca do gol; gaussiana σ 0,10 s (0,14 no
//    cabeceio: o olhar fica na bola até 0,15 s antes do contato e depois vai para o gol); arfagem em [−60°, +15°]; giros
//    rápidos e curtos (arXiv 1611.06292: incomoda a duração da mudança, não o tamanho);
//  - campo de visão HORIZONTAL de 90° fixo no plano (Nesky #41/#42; a faixa de conforto é dada em graus horizontais);
//    plano de recorte próximo de 0,10 m; a bola some a < 0,35 m do olho; outro corpo a < 0,3 m da lente no quadro corta o
//    plano antes (fica se sobrar ≥ 1,2 s reais; senão o plano sai).
// TREINADOR (cam 'treinador'; REPLAY.treinador): um plano com um CORTE no meio:
//  - parte 1 (o que ele vê): o olho na cabeça gravada do treinador (gaussiana σ 0,1 s), o olhar a meio caminho da bola e do
//    centro da boca do gol (a bola sempre a ≤ 0,8 da meia largura do quadro), σ 0,12 s; teleobjetiva FIXA no plano (o quadro
//    com 30 m de largura na distância do gol, como a câmera 3 baixa da UEFA), sem zoom dentro do plano (Nesky #42); ele sai
//    da lista de desenho;
//  - parte 2 (ele reagindo): corte seco para uma câmera parada no gramado (z = meioZ − 0,7, 1,5 m de altura), que só gira
//    (gaussiana σ 0,25 s) para mantê-lo no terço esquerdo, inteiro no quadro, com a área técnica, o banco e a torcida de cá
//    atrás; o lugar dela é o de menos gente na frente dele no anel (como escolherGiroReacao da comemoração), fora dos
//    sólidos (estadio-forma.js solidoEm) e a ≥ 0,6 m de qualquer corpo.
import { REPLAY, CAMPO, PASSO } from '../config.js';
import { J, RAIO_CABECA, SEGMENTOS } from '../anim.js';
import { juntaNoTick, bolaNoTick, jogadorNoTick, poseNoTick } from './replay-anel.js';
import { solidoEm } from '../estadio-forma.js';
import { afastarDeTecnicos } from '../tecnicos.js';

const GRAU = Math.PI / 180;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const s60 = s => Math.round(s * 60);
const ALTURA_GOL = CAMPO.gol.altura;

// ------------------------------------------------------------------------------------------------ utilidades
/** Suaviza `dim` componentes de n amostras (src) por gaussiana de σ `sig` passos, de fase zero (bordas repetidas). */
const _pesos = new Map();
function pesosGauss(sig) {
  let w = _pesos.get(sig);
  if (!w) {
    const R = Math.max(1, Math.ceil(3 * sig));
    w = new Float64Array(2 * R + 1);
    let s = 0;
    for (let k = -R; k <= R; k++) { w[k + R] = Math.exp(-(k * k) / (2 * sig * sig)); s += w[k + R]; }
    for (let k = 0; k < w.length; k++) w[k] /= s;
    _pesos.set(sig, w);
  }
  return w;
}
function gaussiana(src, n, dim, sig, out) {
  const w = pesosGauss(sig), R = (w.length - 1) >> 1;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < dim; c++) {
      let s = 0;
      for (let k = -R; k <= R; k++) { const j = i + k < 0 ? 0 : i + k > n - 1 ? n - 1 : i + k; s += src[j * dim + c] * w[k + R]; }
      out[i * dim + c] = s;
    }
  }
  return out;
}
/** Média móvel centrada de `janela` passos da componente c (bordas repetidas). */
function mediaMovel(src, n, dim, c, janela, out) {
  const R = Math.max(0, Math.floor(janela / 2));
  for (let i = 0; i < n; i++) {
    let s = 0, w = 0;
    for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1); s += src[j * dim + c]; w++; }
    out[i * dim + c] = s / w;
  }
  return out;
}

/** fov vertical (graus) de um campo de visão horizontal fovH (graus) numa tela de aspecto a. */
export function fovVerticalDe(fovH, a) { return 2 * Math.atan(Math.tan((fovH * GRAU) / 2) / a) / GRAU; }

/**
 * Projeção (a mesma conta da three.js PerspectiveCamera + lookAt com "cima" = y): ponto (px, py, pz) visto da câmera em
 * (cx, cy, cz) olhando (lx, ly, lz), fov vertical `fov`° e aspecto a. out = {x, y (NDC: −1 a 1 dentro do quadro), z
 * (profundidade ao longo do olhar, m)}.
 */
export function projetar(cx, cy, cz, lx, ly, lz, fov, a, px, py, pz, out = { x: 0, y: 0, z: 0 }) {
  let fx = lx - cx, fy = ly - cy, fz = lz - cz;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // direita da câmera = cima × (−frente) = (−fz, 0, fx); cima da câmera = (−frente) × direita
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -fy * rz, uy = -(fz * rx - fx * rz), uz = fy * rx;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  const zf = dx * fx + dy * fy + dz * fz, xr = dx * rx + dz * rz, yu = dx * ux + dy * uy + dz * uz;
  const t = Math.tan((fov * GRAU) / 2);
  out.z = zf; out.x = zf > 1e-6 ? xr / (zf * t * a) : Infinity; out.y = zf > 1e-6 ? yu / (zf * t) : Infinity;
  return out;
}
const dentroQuadro = (p, m = 1) => p.z > 0.05 && Math.abs(p.x) <= m && Math.abs(p.y) <= m;

// cabeça e ombros do jogador `id` no passo (null se não está no anel)
const _c = { x: 0, y: 0, z: 0 }, _oe = { x: 0, y: 0, z: 0 }, _od = { x: 0, y: 0, z: 0 };
/** Olho bruto (a cabeça gravada + frente·`frente` + cima·`cima`) em out; null se o jogador não está no passo. */
function olhoBruto(anel, tick, id, frente, cima, out) {
  if (!juntaNoTick(anel, tick, id, J.cabeca, _c) || !juntaNoTick(anel, tick, id, J.ombroE, _oe) || !juntaNoTick(anel, tick, id, J.ombroD, _od)) return null;
  const rx = _od.x - _oe.x, rz = _od.z - _oe.z, l = Math.hypot(rx, rz) || 1;
  const fx = rz / l, fz = -rx / l;
  out.x = _c.x + fx * frente; out.y = _c.y + cima; out.z = _c.z + fz * frente; out.cx = _c.x; out.cy = _c.y; out.cz = _c.z;
  return out;
}

/** O intervalo [de, ate] de passos do anel em volta de [a, b] (± margem) sem atravessar corte. */
function janelaValida(anel, a, b, margem) {
  let de = Math.max(anel.primeiro, a - margem), ate = Math.min(anel.ultimo, b + margem);
  const c0 = anel.ultimoCorte(de + 1, a); if (c0 != null) de = c0;
  const c1 = anel.primeiroCorte(b + 1, ate); if (c1 != null) ate = c1 - 1;
  return [de, ate];
}

const _o = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 }, _p = { x: 0, y: 0, z: 0 };

// ------------------------------------------------------------------------------------------------ 1ª pessoa
/**
 * Enquadramento da 1ª pessoa do plano p = {de, ate, autor, chuteTick, golTick, lado, tipoChute}: para cada passo de de a
 * ate, o olho (suavizado), o olhar (um ponto para onde olhar), a bola escondida (perto da lente) e o olho bruto e a cabeça
 * (testes). Null se o autor não está no anel no plano.
 */
export function enquadrarPrimeira(anel, p) {
  const F = REPLAY.primeira, cab = p.tipoChute === 'cabeceio';
  const sigO = (cab ? F.sigmaCabeceio : F.sigmaOlhar) * 60;
  const M = Math.ceil(3 * Math.max(F.sigmaXZ * 60, sigO)) + Math.ceil(F.mediaY * 30) + 2;
  const [w0, w1] = janelaValida(anel, p.de, p.ate, M);
  const n = w1 - w0 + 1;
  if (n <= 0) return null;
  const bruto = new Float64Array(n * 3), cabeca = new Float64Array(n * 3), alvo = new Float64Array(n * 3);
  const gx = (p.lado >= 0 ? 1 : -1) * MX, gy = ALTURA_GOL / 2;
  let ultimo = -1;
  for (let i = 0; i < n; i++) {
    const t = w0 + i;
    const o = olhoBruto(anel, t, p.autor, F.frente, F.cima, _o);
    if (!o) { if (ultimo < 0) continue; for (let c = 0; c < 3; c++) { bruto[i * 3 + c] = bruto[ultimo * 3 + c]; cabeca[i * 3 + c] = cabeca[ultimo * 3 + c]; } }
    else { bruto[i * 3] = o.x; bruto[i * 3 + 1] = o.y; bruto[i * 3 + 2] = o.z; cabeca[i * 3] = o.cx; cabeca[i * 3 + 1] = o.cy; cabeca[i * 3 + 2] = o.cz; if (ultimo < 0) for (let k = 0; k < i; k++) for (let c = 0; c < 3; c++) { bruto[k * 3 + c] = o[c === 0 ? 'x' : c === 1 ? 'y' : 'z']; cabeca[k * 3 + c] = c === 0 ? o.cx : c === 1 ? o.cy : o.cz; } ultimo = i; }
  }
  if (ultimo < 0) return null;
  // olho: x/z gaussiana, y média móvel (um passo)
  const olho = new Float64Array(n * 3);
  gaussiana(bruto, n, 3, F.sigmaXZ * 60, olho);
  mediaMovel(bruto, n, 3, 1, Math.round(F.mediaY * 60), olho);
  // olhar bruto por passo (antes da suavização)
  const ch = p.chuteTick;
  for (let i = 0; i < n; i++) {
    const t = w0 + i, b = bolaNoTick(anel, t, _b) ?? _b;
    let x = b.x, y = b.y, z = b.z;
    if (cab) {
      // cabeceio: na bola até 0,15 s antes do contato; depois o gol
      if (t >= ch - s60(F.cabeceioOlhaGol)) { x = gx; y = gy; z = 0; }
    } else if (t > ch + s60(F.baixaDepois)) {
      x += (gx - x) * F.puxaGol; y += (gy - y) * F.puxaGol; z += (0 - z) * F.puxaGol;
    } else if (t < ch - s60(F.baixaAntes)) {
      // antes: sem descer mais que arfagemAntes (a boca do gol no alto do quadro)
      const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2], dh = Math.max(0.5, Math.hypot(x - ox, z - oz));
      const yMin = oy + dh * Math.tan(F.arfagemAntes * GRAU);
      if (y < yMin) y = yMin;
    }
    alvo[i * 3] = x; alvo[i * 3 + 1] = y; alvo[i * 3 + 2] = z;
  }
  const alvoS = gaussiana(alvo, n, 3, sigO, new Float64Array(n * 3));
  // arfagem presa em [arfagem]: o ponto do olhar é refeito a 10 m na direção presa
  const dir = new Float64Array(n * 3), bolaSome = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2];
    let dx = alvoS[i * 3] - ox, dy = alvoS[i * 3 + 1] - oy, dz = alvoS[i * 3 + 2] - oz;
    const dh = Math.hypot(dx, dz) || 1e-6;
    const arf = clamp(Math.atan2(dy, dh), F.arfagem[0] * GRAU, F.arfagem[1] * GRAU);
    dx /= dh; dz /= dh;
    dir[i * 3] = dx * Math.cos(arf); dir[i * 3 + 1] = Math.sin(arf); dir[i * 3 + 2] = dz * Math.cos(arf);
    const b = bolaNoTick(anel, w0 + i, _b);
    if (b && Math.hypot(b.x - ox, b.y - oy, b.z - oz) < F.bolaSome) bolaSome[i] = 1;
  }
  return { tipo: 'primeira', de: p.de, ate: p.ate, w0, n, olho, dir, bruto, cabeca, bolaSome, fovH: F.fovH, perto: F.perto, autor: p.autor };
}

/** Câmera da 1ª pessoa no passo fracionário t: out {x, y, z, lx, ly, lz (ponto do olhar), fovH, bolaSome}. */
export function cameraPrimeira(e, t, out = {}) {
  const u = clamp(t - e.w0, 0, e.n - 1), i0 = Math.floor(u), i1 = Math.min(e.n - 1, i0 + 1), f = u - i0;
  const L = (a, c) => a[i0 * 3 + c] + (a[i1 * 3 + c] - a[i0 * 3 + c]) * f;
  out.x = L(e.olho, 0); out.y = L(e.olho, 1); out.z = L(e.olho, 2);
  let dx = L(e.dir, 0), dy = L(e.dir, 1), dz = L(e.dir, 2);
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  out.lx = out.x + dx * 10; out.ly = out.y + dy * 10; out.lz = out.z + dz * 10;
  out.fovH = e.fovH; out.bolaSome = !!e.bolaSome[Math.round(u)];
  return out;
}

// corpos (cápsulas) de um jogador gravado: distância do ponto à superfície mais perto (e o ponto dela)
const _pose = new Float32Array(57), _xz = { x: 0, z: 0 };
function distCorpo(pose, px, py, pz, perto) {
  let dm = Infinity;
  for (const [a, b, ra, rb] of SEGMENTOS) {
    const ax = pose[a * 3], ay = pose[a * 3 + 1], az = pose[a * 3 + 2], bx = pose[b * 3], by = pose[b * 3 + 1], bz = pose[b * 3 + 2];
    const vx = bx - ax, vy = by - ay, vz = bz - az, l2 = vx * vx + vy * vy + vz * vz || 1e-9;
    const t = clamp(((px - ax) * vx + (py - ay) * vy + (pz - az) * vz) / l2, 0, 1);
    const qx = ax + vx * t, qy = ay + vy * t, qz = az + vz * t;
    const d = Math.hypot(px - qx, py - qy, pz - qz) - (ra + (rb - ra) * t);
    if (d < dm) { dm = d; if (perto) { perto.x = qx; perto.y = qy; perto.z = qz; } }
  }
  const ic = J.cabeca * 3, d = Math.hypot(px - pose[ic], py - pose[ic + 1], pz - pose[ic + 2]) - RAIO_CABECA;
  if (d < dm) { dm = d; if (perto) { perto.x = pose[ic]; perto.y = pose[ic + 1]; perto.z = pose[ic + 2]; } }
  return dm;
}

/**
 * Primeiro passo do plano em que outro corpo fica a < `dmin` m da lente dentro do quadro (1ª pessoa; aspecto mais largo
 * que vai à tela: 16:9 e o celular), ou −1. sem = ids que não contam (o próprio autor).
 */
export function corpoNaLente(anel, e, dmin, sem) {
  const _cam = {}, perto = { x: 0, y: 0, z: 0 }, pr = { x: 0, y: 0, z: 0 };
  for (let t = e.de; t <= e.ate; t++) {
    cameraPrimeira(e, t, _cam);
    const s = anel.slot(t);
    if (s < 0) continue;
    for (let v = 0; v < anel.nVagas[s]; v++) {
      const i = s * anel.vagas + v, id = anel.ids[i];
      if (id < 0 || id === sem) continue;
      const cx = anel.dados[i * anel.K + anel.P], cz = anel.dados[i * anel.K + anel.P + 1];
      if (Math.hypot(cx - _cam.x, cz - _cam.z) > 2.2) continue;
      poseNoTick(anel, t, id, _pose);
      const d = distCorpo(_pose, _cam.x, _cam.y, _cam.z, perto);
      if (d >= dmin) continue;
      // no quadro (o ponto do corpo mais perto, com a folga do raio)
      for (const a of [16 / 9, 844 / 390]) {
        projetar(_cam.x, _cam.y, _cam.z, _cam.lx, _cam.ly, _cam.lz, fovVerticalDe(e.fovH, a), a, perto.x, perto.y, perto.z, pr);
        if (pr.z > -0.3 && Math.abs(pr.x) <= 1.3 && Math.abs(pr.y) <= 1.3) return t;
      }
    }
  }
  return -1;
}

// ------------------------------------------------------------------------------------------------ treinador
/**
 * Enquadramento da visão do treinador do plano p = {de, corte, ate, tecnico (id), golTick, chuteTick, lado}: a parte 1 (o
 * olho na cabeça dele e o olhar entre a bola e o gol; o campo de visão horizontal FIXO pela distância ao gol) e a parte 2
 * (a câmera parada no gramado escolhida aqui, girando para mantê-lo no terço esquerdo). Null sem o treinador no anel. Sem
 * lugar para a câmera da parte 2, devolve só a parte 1 (e2.ok = false).
 */
export function enquadrarTreinador(anel, p, opc = {}) {
  const Tr = REPLAY.treinador;
  const id = p.tecnico, gx = (p.lado >= 0 ? 1 : -1) * MX, gy = ALTURA_GOL / 2;
  const fim1 = p.corte ?? p.ate;
  const M = Math.ceil(3 * Math.max(Tr.sigmaOlho, Tr.sigmaOlhar, Tr.sigmaGiro) * 60) + 2;
  const [w0, w1] = janelaValida(anel, p.de, p.ate, M);
  const n = w1 - w0 + 1;
  if (n <= 0 || !jogadorNoTick(anel, p.golTick, id)) return null;
  // parte 1: olho e olhar
  const bruto = new Float64Array(n * 3), cabeca = new Float64Array(n * 3), bola = new Float64Array(n * 3);
  let ultimo = -1;
  for (let i = 0; i < n; i++) {
    const t = w0 + i, o = olhoBruto(anel, t, id, Tr.frente, Tr.cima, _o);
    if (o) { bruto[i * 3] = o.x; bruto[i * 3 + 1] = o.y; bruto[i * 3 + 2] = o.z; cabeca[i * 3] = o.cx; cabeca[i * 3 + 1] = o.cy; cabeca[i * 3 + 2] = o.cz; if (ultimo < 0) for (let k = 0; k < i; k++) for (let c = 0; c < 3; c++) { bruto[k * 3 + c] = bruto[i * 3 + c]; cabeca[k * 3 + c] = cabeca[i * 3 + c]; } ultimo = i; }
    else if (ultimo >= 0) for (let c = 0; c < 3; c++) { bruto[i * 3 + c] = bruto[ultimo * 3 + c]; cabeca[i * 3 + c] = cabeca[ultimo * 3 + c]; }
    const b = bolaNoTick(anel, t, _b);
    if (b) { bola[i * 3] = b.x; bola[i * 3 + 1] = b.y; bola[i * 3 + 2] = b.z; } else if (i > 0) for (let c = 0; c < 3; c++) bola[i * 3 + c] = bola[(i - 1) * 3 + c];
  }
  if (ultimo < 0) return null;
  const olho = gaussiana(bruto, n, 3, Tr.sigmaOlho * 60, new Float64Array(n * 3));
  // lente: o quadro com `largura` m na distância do gol (no passo do gol), fixa no plano
  const ig = clamp(p.golTick - w0, 0, n - 1);
  const dGol = Math.hypot(gx - olho[ig * 3], 0 - olho[ig * 3 + 2]);
  const fovH = 2 * Math.atan(Tr.largura / 2 / Math.max(5, dGol)) / GRAU;
  const meiaT = Math.tan((fovH * GRAU) / 2) * Tr.bolaNdc;
  // olhar: a meio caminho da bola (suavizada) e do gol, em ângulo; a bola nunca além de bolaNdc da meia largura
  const bolaS = gaussiana(bola, n, 3, Tr.sigmaOlhar * 60, new Float64Array(n * 3));
  const yaw = new Float64Array(n), arf = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2];
    const yb = Math.atan2(bolaS[i * 3 + 2] - oz, bolaS[i * 3] - ox), yg = Math.atan2(0 - oz, gx - ox);
    let d = yg - yb; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    let y = yb + d * Tr.puxaGol;
    const lim = Math.atan(meiaT);
    if (Math.abs(y - yb) > lim) y = yb + Math.sign(y - yb) * lim;
    yaw[i] = y;
    const db = Math.hypot(bolaS[i * 3] - ox, bolaS[i * 3 + 2] - oz), dg = Math.hypot(gx - ox, oz);
    const ab = Math.atan2(bolaS[i * 3 + 1] - oy, db), ag = Math.atan2(gy - oy, dg);
    arf[i] = ab + (ag - ab) * Tr.puxaGol;
  }
  // gaussiana nos ângulos (yaw desenrolado)
  for (let i = 1; i < n; i++) { while (yaw[i] - yaw[i - 1] > Math.PI) yaw[i] -= 2 * Math.PI; while (yaw[i] - yaw[i - 1] < -Math.PI) yaw[i] += 2 * Math.PI; }
  const yawS = gaussiana(yaw, n, 1, Tr.sigmaOlhar * 60, new Float64Array(n)), arfS = gaussiana(arf, n, 1, Tr.sigmaOlhar * 60, new Float64Array(n));
  const dir = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { dir[i * 3] = Math.cos(yawS[i]) * Math.cos(arfS[i]); dir[i * 3 + 1] = Math.sin(arfS[i]); dir[i * 3 + 2] = Math.sin(yawS[i]) * Math.cos(arfS[i]); }
  const e = { tipo: 'treinador', de: p.de, ate: p.ate, corte: p.corte, w0, n, olho, dir, bruto, cabeca, fovH, tecnico: id, dGol, parte2: null };
  if (p.corte != null && p.ate > p.corte) e.parte2 = parte2Treinador(anel, p, opc);
  return e;
}

/**
 * Parte 2 da visão do treinador: a câmera parada no gramado que o mostra reagindo. Candidatos em z = meioZ − recuoZ (e um
 * pouco mais para dentro) e x dos dois lados dele; vale o que o mantém INTEIRO no quadro no terço esquerdo em todos os
 * passos, fora dos sólidos, a ≥ 0,6 m de qualquer corpo, sem nada a < 2 m da lente no quadro, com o menos tempo de gente
 * na frente da cabeça e do peito dele. Null se nenhum serve.
 */
export function parte2Treinador(anel, p, opc = {}) {
  const Tr = REPLAY.treinador, id = p.tecnico;
  const de = p.corte, ate = p.ate, n = ate - de + 1;
  if (n < 2) return null;
  // o treinador (centro) por passo, suavizado (σ sigmaGiro)
  const cx = new Float64Array(n * 3);
  const _j = { x: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    const j = jogadorNoTick(anel, de + i, id, _j);
    if (j) { cx[i * 3] = j.x; cx[i * 3 + 2] = j.z; } else if (i) { cx[i * 3] = cx[(i - 1) * 3]; cx[i * 3 + 2] = cx[(i - 1) * 3 + 2]; } else return null;
    cx[i * 3 + 1] = 0.92;
  }
  const alvo = gaussiana(cx, n, 3, Tr.sigmaGiro * 60, new Float64Array(n * 3));
  let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += cx[i * 3]; mz += cx[i * 3 + 2]; }
  mx /= n; mz /= n;
  // amostras (a cada `cada` passos e o último) com os outros corpos de cada uma (x, z), lidos do anel uma vez
  const cada = 2, ns = Math.floor((n - 1) / cada) + 1 + ((n - 1) % cada ? 1 : 0);
  const amostra = new Int32Array(ns), nCorpos = new Uint8Array(ns), corpos = new Float64Array(ns * anel.vagas * 2);
  for (let a = 0; a < ns; a++) {
    const i = Math.min(n - 1, a * cada); amostra[a] = i;
    const s = anel.slot(de + i);
    if (s < 0) continue;
    for (let v = 0; v < anel.nVagas[s]; v++) {
      const k = s * anel.vagas + v;
      if (anel.ids[k] < 0 || anel.ids[k] === id) continue;
      const o = (a * anel.vagas + nCorpos[a]) * 2;
      corpos[o] = anel.dados[k * anel.K + anel.P]; corpos[o + 1] = anel.dados[k * anel.K + anel.P + 1];
      nCorpos[a]++;
    }
  }
  // telas que o quadro tem de servir: PC 16:9 e os celulares deitados (fov × 0,88); por tela, o fov e o desvio do olhar
  const telas = opc.telas ?? [[16 / 9, false], [844 / 390, true], [568 / 320, true]];
  const T = telas.map(([a, peq]) => {
    let f = Tr.fov * (peq ? 0.88 : 1);
    if (a < 16 / 9) f = 2 * Math.atan(Math.tan((f * GRAU) / 2) * (16 / 9) / a) / GRAU;
    return { a, f, desv: Math.atan(Math.tan((f * GRAU) / 2) * a * (1 - 2 * Tr.terco)) };
  });
  const pr = { x: 0, y: 0, z: 0 };
  let melhor = null;
  // candidatos na ordem de preferência (a ~4,5 m dele, dos dois lados; depois mais longe ou mais para dentro do campo)
  const cands = [];
  for (const zc of [MZ - Tr.recuoZ, MZ - Tr.recuoZ - 1.2, MZ - Tr.recuoZ - 2.4]) for (const ox of [3.5, -3.5, 2.5, -2.5, 4.5, -4.5, 5.5, -5.5, 1.5, -1.5, 6.5, -6.5]) cands.push([mx + ox, zc]);
  for (const [camX, camZ] of cands) {
    const cam = { x: camX, y: Tr.altura, z: camZ };
    const dist0 = Math.hypot(cam.x - mx, cam.z - mz);
    if (dist0 < Tr.dist[0] - 0.01 || dist0 > Tr.dist[1]) continue;
    if (solidoEm(cam.x, cam.y, cam.z, 0.3, false)) continue;
    let ok = true, ocl = 0;
    for (let a = 0; a < ns && ok; a++) {
      const i = amostra[a], ax = alvo[i * 3], az = alvo[i * 3 + 2], d = Math.hypot(ax - cam.x, az - cam.z);
      if (d < Tr.dist[0] - 0.3) { ok = false; break; }
      const yc = Math.atan2(az - cam.z, ax - cam.x);
      // o corpo inteiro (os pés e o alto da cabeça) no quadro em cada tela (em x ele fica no terço esquerdo por construção)
      let lx0 = 0, lz0 = 0;
      for (let q = 0; q < T.length && ok; q++) {
        const ya = yc + T[q].desv, lx = cam.x + Math.cos(ya) * d, lz = cam.z + Math.sin(ya) * d;
        if (q === 0) { lx0 = lx; lz0 = lz; }
        for (const py of [0.03, 1.82]) {
          projetar(cam.x, cam.y, cam.z, lx, 0.92, lz, T[q].f, T[q].a, cx[i * 3], py, cx[i * 3 + 2], pr);
          if (!(pr.z > 0.1 && Math.abs(pr.y) <= 0.97 && Math.abs(pr.x) <= 0.97)) { ok = false; break; }
        }
      }
      if (!ok) break;
      // os outros corpos: a ≥ corpoMin da câmera, nada a < 2 m dela no quadro, gente na frente da cabeça e do peito dele
      const tx = cx[i * 3] - cam.x, tz = cx[i * 3 + 2] - cam.z, tl2 = tx * tx + tz * tz;
      for (let c = 0; c < nCorpos[a]; c++) {
        const o = (a * anel.vagas + c) * 2, bx = corpos[o], bz = corpos[o + 1];
        const dc = Math.hypot(bx - cam.x, bz - cam.z);
        if (dc < Tr.corpoMin + 0.35) { ok = false; break; }
        if (dc < 2.4) {
          projetar(cam.x, cam.y, cam.z, lx0, 0.92, lz0, T[0].f, T[0].a, bx, 1.0, bz, pr);
          if (pr.z > 0 && Math.abs(pr.x) < 1.3) { ok = false; break; }
        }
        const u = ((bx - cam.x) * tx + (bz - cam.z) * tz) / tl2;
        if (u > 0.02 && u < 0.98 && Math.hypot(bx - cam.x - tx * u, bz - cam.z - tz * u) < 0.45) ocl++;
      }
    }
    if (!ok) continue;
    const custo = ocl / ns;
    if (!melhor || custo < melhor.custo - 1e-9) melhor = { custo, cam };
    if (custo === 0) break;  // ninguém na frente: o de preferência fica
  }
  if (!melhor) return null;
  return { de, ate, n, cam: melhor.cam, alvo, ocl: melhor.custo, fov: Tr.fov, terco: Tr.terco };
}

/**
 * Câmera da visão do treinador no passo fracionário t (aspecto a, `pequena` = celular): out {parte (1 | 2), x, y, z, lx, ly,
 * lz, fov (vertical, graus)}.
 */
export function cameraTreinador(e, t, a, pequena, out = {}) {
  const Tr = REPLAY.treinador;
  if (e.parte2 && e.corte != null && t >= e.corte) {
    const q = e.parte2, u = clamp(t - q.de, 0, q.n - 1), i0 = Math.floor(u), i1 = Math.min(q.n - 1, i0 + 1), f = u - i0;
    const ax = q.alvo[i0 * 3] + (q.alvo[i1 * 3] - q.alvo[i0 * 3]) * f, az = q.alvo[i0 * 3 + 2] + (q.alvo[i1 * 3 + 2] - q.alvo[i0 * 3 + 2]) * f;
    let fv = Tr.fov * (pequena ? 0.88 : 1);
    if (a < 16 / 9) fv = 2 * Math.atan(Math.tan((fv * GRAU) / 2) * (16 / 9) / a) / GRAU;
    const th = Math.tan((fv * GRAU) / 2) * a, desv = Math.atan(th * (1 - 2 * q.terco));
    const yc = Math.atan2(az - q.cam.z, ax - q.cam.x), d = Math.hypot(ax - q.cam.x, az - q.cam.z), ya = yc + desv;
    out.parte = 2; out.x = q.cam.x; out.y = q.cam.y; out.z = q.cam.z;
    out.lx = q.cam.x + Math.cos(ya) * d; out.ly = 0.92; out.lz = q.cam.z + Math.sin(ya) * d; out.fov = fv;
    return out;
  }
  const u = clamp(t - e.w0, 0, e.n - 1), i0 = Math.floor(u), i1 = Math.min(e.n - 1, i0 + 1), f = u - i0;
  const L = (arr, c) => arr[i0 * 3 + c] + (arr[i1 * 3 + c] - arr[i0 * 3 + c]) * f;
  out.parte = 1; out.x = L(e.olho, 0); out.y = L(e.olho, 1); out.z = L(e.olho, 2);
  let dx = L(e.dir, 0), dy = L(e.dir, 1), dz = L(e.dir, 2);
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  out.lx = out.x + dx * 40; out.ly = out.y + dy * 40; out.lz = out.z + dz * 40;
  out.fov = clamp(fovVerticalDe(e.fovH, a), Tr.fovMin, Tr.fovMax);
  return out;
}

// ------------------------------------------------------------------------------------------------ lateral do golaço
/**
 * Câmera lateral baixa do golaço (REPLAY.lateral) com o x dela (`cx`) e os treinadores gravados no quadro [{x, z}]: com um
 * deles a < 2 m, ela desce para z = meioZ + 1 (na frente da área técnica, que é só desenho: o roteiro não muda); e sempre a
 * ≥ 0,6 m de qualquer um (tecnicos.js afastarDeTecnicos). out {x, y, z}.
 */
export function cameraLateral(cx, tecnicos, out = { x: 0, y: 0, z: 0 }) {
  const Lt = REPLAY.lateral;
  out.x = typeof cx === 'number' ? cx : cx.x; out.y = Lt.altura; out.z = MZ + Lt.fora;
  if (tecnicos) for (const tc of tecnicos) if (Math.hypot(tc.x - out.x, tc.z - out.z) < 2) { out.z = MZ + 1; break; }
  if (tecnicos) afastarDeTecnicos(out, tecnicos, 0.6);
  return out;
}

/** Os treinadores gravados no passo (ids e x/z) em out [{id, x, z}] (lista reaproveitada). */
export function tecnicosNoTick(anel, tick, out = []) {
  out.length = 0;
  const s = anel.slot(tick);
  if (s < 0) return out;
  for (let v = 0; v < anel.nVagas[s]; v++) {
    const i = s * anel.vagas + v;
    if (!(anel.info[i] & 4)) continue;
    out.push({ id: anel.ids[i], x: anel.dados[i * anel.K + anel.P], z: anel.dados[i * anel.K + anel.P + 1] });
  }
  return out;
}

/**
 * Reação do treinador para outros planos (a comemoração ao vivo, a fila de cenas #104): a mesma escolha da parte 2 para um
 * caminho dele dado por passo ([{x, z}]) e os outros corpos por passo (opcional). Devolve {cam, alvo} ou null.
 */
export function planoReacaoTreinador(anel, p, opc) { return parte2Treinador(anel, p, opc); }
