// Referência GRAVADA do chute fora do canto (C2, item 13; revisão de 29/10; contrato "Chute com a barra cheia" no
// CONTRATOS.md). Decisão do dono (28/10): "só o chute mirado sobe — com o analógico apontado para um CANTO a barra cheia vai
// no ângulo; sem mirar o chute fica na altura de hoje". Fora do canto o chute tem de ser o da main 46dd59ab BIT A BIT: o
// árbitro independente do teste-chutes (a mira pelas constantes + o voo do chute forte) deixava passar o que não muda a
// mira (o efeito do colocado, o erro do sorteio, a elevação) e o que ele não cobria (o módulo do analógico, o time que
// ataca para −x, as direções entre ±17° e o canto). Aqui, um conjunto FIXO de chutes, cada um num mundo de treino novo com
// a semente dele (o rng recriado logo antes do toque: nada do resto do jogo pesa) e o toque chamado direto
// (`acoes.js executarAcao`, sem a locomoção: a passada e o pé do toque não mudam o caso). De cada um: a bola depois do toque
// (posição, v e w, COM o erro do rng), a mira do chute (`m.voo.mira`) e onde a bola cruza a linha do gol no voo só da bola
// (`bola.js passoBola`: sem goleiro e sem ninguém no caminho) — um hash dos bits dos float64 (12 hex do SHA-1) e, para o
// diagnóstico, o y e o z da linha arredondados (mm). O teste confere que o código reproduz a referência bit a bit.
//
// Os casos (as direções pela geometria DESTE arquivo, não pelo acoes.js/mira.js: o "fora do canto" é |z| < MEIO − 0,9 na
// régua do teste, com a margem de ≥ 4 cm):
//  r (bola rolando, chute do jogo): os dois sentidos de ataque (+x e −x), forte e colocado, as duas pernas, finalização
//    60–99, forças baixas e da barra cheia (0,3–1, a maioria 0,85–1), 7–31 m, até 42° da frente do gol, com e sem goleiro
//    (o do lado do solto), e o analógico SOLTO, PARA O GOL com o módulo 1, 0,6 e 0,35, a ±17° e a varredura fina de
//    ±0,5° a ±32° (|z| = sen(a) × MEIO × 1,4 < MEIO − 0,9 até ~32,6°; o módulo 1, 0,6 e 0,35); e o QUASE SOLTO (o módulo
//    0,21, 0,25 e 0,3: o jogo lê o analógico acima de 0,2, acoes.js mira, mas só mira acima de 0,3 — o chute é o solto) para
//    o gol, a ±17° e no canto (±33,5° … ±90°), quase todo com a barra cheia (revisão de 29/10: com o 'solto' zerando
//    j.imag/j.mira, nem esta lista nem o árbitro tinham módulo entre 0,2 e 0,3, e o erro do quase solto ×1,3 ou ele subindo
//    no canto passavam);
//  p (pênalti do humano): o analógico solto, para o gol, ±17°, no canto e de lado (a barra cheia não vale no pênalti);
//  b (tiro livre com barreira pelo chute do jogo — a IA e o humano sem a cobrança mirada): todas as direções;
//  c (cobrança mirada do tiro livre direto, `acoes.js cobrancaMirada` → `mira.js chuteMirado`): sem barreira (e com a
//    barreira de 0) a mira cruzando a linha do gol a |z| ≤ 2,7 m (passos de 0,15 m) e as miras que não vão para o gol;
//    com barreira, todas as direções (a barra cheia não vale com barreira); efeito de −1 a +1, 17–34,8 m; e a CURVA (Z/X
//    ±1 e ±0,5) com a reta da mira no meio, no canto (|z| 2,9–3,5) e fora do gol (4,2–9), quase toda com a barra cheia; e
//    a barra cheia com a reta logo abaixo do canto (|z| 2,3–2,65) e com barreira e a reta no canto.
//    Na cobrança o "fora do canto" é pela bola SUBIDA, com o efeito (classificarCobranca, o árbitro de baixo): a reta da
//    mira não diz onde a bola com curva cruza a linha (0,9–2,2 m de lá); o teste confere a main bit a bit só nas que a
//    bola subida cruza fora da faixa do canto, e nas da faixa a altura do ângulo.
// E os casos do CANTO (não gravados; o teste confere pela regra que a barra cheia vai ao ângulo, como hoje): rc (bola
// rolando, o analógico a ±33,5° … ±90°; a bola cruza a linha na mira julgada, também no colocado, a ≤ 1 cm) e cc
// (cobrança sem barreira, a mira a |z| 2,9–3,5 m, sem efeito), força 1, o erro zerado.
//
// Regravar (`node tools/teste-chutes.mjs --gravar-referencia <pasta js> [--origem "texto"]`) só com mudança DE
// PROPÓSITO no chute fora do canto (ou na física da bola, no toque ou no erro do chute), gerando contra a versão que
// passa a valer (ex.: `git archive <commit> golaco | tar -x -C /tmp/x` e a pasta /tmp/x/golaco/js) e dizendo no PR o
// porquê; mudar a lista dos casos aqui também pede regravar (o "conjunto" gravado é o hash dela).
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// a geometria do teste (conferida contra o config na carga: mudou o campo, regravar)
export const MX = 52.5, MEIO = 3.66, Z_CANTO = 0.9;
// a barra cheia da cobrança, do próprio teste (o ACOES.chute.cheia do C2 tem os mesmos de 0,9 e y 2,1; a main não tem
// cheia): acima da força DE a mira sobe de yAlvo (a curva de antes, na força DE) até Y m na linha do gol
export const CHEIA = { de: 0.9, y: 2.1 };
// a faixa do canto na linha do gol (|z| m do meio): ZC ≤ |z| ≤ MEIO; a BORDA, onde o árbitro não decide (±2 cm da borda de
// baixo; perto da trave, 3,50–3,90: a bola raspa nela e o voo com o gol do árbitro só extrapola onde cruzaria)
export const ZC = MEIO - Z_CANTO, BORDA = { zc: 0.02, trave: [MEIO - 0.16, MEIO + 0.24] };
const DEG = Math.PI / 180;
// o maior ângulo do analógico (da reta bola–gol) fora do canto: sen(a) × MEIO × 1,4 < MEIO − Z_CANTO
export const A_LIM = Math.asin((MEIO - Z_CANTO) / (1.4 * MEIO));
const GK_ATTR = { reflexo: 75, posicionamento: 74, mergulho: 75 };
const FORCAS = [1, 0.95, 0.92, 0.905, 0.85, 0.3, 0.98, 0.9, 0.6, 0.97, 0.88, 0.93, 1, 0.75, 0.99, 0.91];
const FORCAS_CHEIA = [1, 0.95, 0.92, 0.905, 0.98, 0.91, 0.97, 0.93];
const FIN = [60, 75, 90, 99];
const DISTS = [7, 9, 11, 13, 16, 18, 21, 24, 27, 31];
const POS = [-40, -25, -12, 0, 8, 18, 30, 42];
const CURVAS = [0, -1, 1, -0.5, 0.25, 0.75, -0.25, 0.5];

export async function carregar(pastaJs) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const [sim, acoes, config, rng, bola] = await Promise.all(['sim.js', 'acoes.js', 'config.js', 'rng.js', 'bola.js'].map(imp));
  return { sim, acoes, config, rng, bola };
}

/** A posição da bola a d m do meio do gol atacado (lado ±1), pa graus da frente. */
const posBola = (lado, d, pa) => ({ bx: lado * (MX - d * Math.cos(pa * DEG)), bz: d * Math.sin(pa * DEG) });

/** A lista fixa dos casos (descritores puros; a ordem é a da referência). */
export function casosReferencia() {
  const casos = [];
  let s = 0;
  const novo = o => { casos.push({ ...o, sem: 60000 + s }); s++; };
  // r: bola rolando
  const opcR = [{ an: null }, { an: { a: 0, mag: 1 } }, { an: { a: 0, mag: 0.6 } }, { an: { a: 0, mag: 0.35 } }, { an: { a: 17 * DEG, mag: 1 } }, { an: { a: -17 * DEG, mag: 1 } }];
  opcR.forEach((o, i) => {
    for (let k = 0; k < 64; k++) {
      const lado = k % 2 ? -1 : 1, pp = Math.floor(k / 4) % 2;
      novo({ k: 'r', lado, ...posBola(lado, DISTS[(k * 3 + i) % 10], POS[(k * 5 + i) % 8]), an: o.an, forca: FORCAS[(Math.floor(k / 2) * 7 + i) % 16], mod: Math.floor(k / 2) % 2 === 1,
        attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: Math.floor(k / 8) % 2 ? 1 - pp : pp, gk: [null, -1, 1.3][(k + 2 * i) % 3] });
    }
  });
  // a varredura fina abaixo do canto: ±0,5° a ±32°
  let o = 0;
  for (let a10 = 5; a10 * 0.1 * DEG < A_LIM - 0.5 * DEG; a10 += 5) for (const sg of [1, -1]) {
    const a = sg * a10 * 0.1 * DEG;
    for (let k = 0; k < 4; k++) {
      const lado = (k + o) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'r', lado, ...posBola(lado, DISTS[(k * 3 + o) % 10], POS[(k * 5 + o) % 8]), an: { a, mag: [1, 0.6, 0.35][(k + o) % 3] },
        forca: k === 3 ? [0.85, 0.6, 0.3, 0.88][o % 4] : FORCAS_CHEIA[(k + o) % 8], mod: (k + (o >> 1)) % 2 === 1,
        attr: { finalizacao: FIN[(k + o) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + o) % 3 === 0 ? 1 - pp : pp, gk: [null, -1, 1.3][(k + o) % 3] });
    }
    o++;
  }
  // p: pênalti do humano (a barra cheia não vale: todas as direções na conta de antes)
  const opcP = [{ an: null }, { an: { a: 0, mag: 1 } }, { an: { a: 0, mag: 0.6 } }, { an: { a: 0, mag: 0.35 } }];
  for (const a of [17, -17, 43, -43, 69, -69, 90, -90, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25, 30, -30]) opcP.push({ an: { a: a * DEG, mag: 1 } });
  opcP.forEach((op, i) => {
    for (let k = 0; k < 8; k++) {
      const lado = k % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'p', lado, bx: lado * (MX - 11), bz: 0, an: op.an, forca: FORCAS[(k * 5 + i) % 16], mod: (k >> 2) % 2 === 1, penalti: true,
        attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: [0, -0.4, 0.5][(k + i) % 3] });
    }
  });
  // b: tiro livre com barreira pelo chute do jogo
  const opcB = [{ an: null }, { an: { a: 0, mag: 1 } }];
  for (const a of [17, -17, 43, -43, 90, -90, 10, -10, 25, -25, 32, -32]) opcB.push({ an: { a: a * DEG, mag: 1 } });
  opcB.forEach((op, i) => {
    for (let k = 0; k < 8; k++) {
      const lado = k % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'b', lado, ...posBola(lado, [18, 20, 22, 25, 28][(k + i) % 5], [-30, -15, 0, 12, 28][(k * 3 + i) % 5]), an: op.an, forca: FORCAS[(k * 3 + i) % 16], mod: (k >> 2) % 2 === 1,
        humano: (k + i) % 2 === 0, barreiraChute: true, attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: [null, -1, 1.3][(k + i) % 3] });
    }
  });
  // c: cobrança mirada do tiro livre direto
  const opcC = [];
  for (let z100 = -270; z100 <= 270; z100 += 15) opcC.push({ zLinha: z100 / 100, barreira: null });
  for (const da of [95, -95, 180]) opcC.push({ fora: da * DEG, barreira: null });
  for (const zL of [-3.4, -3.0, -2.0, 0, 1.0, 2.9, 3.3]) opcC.push({ zLinha: zL, barreira: 'n' });
  for (const da of [17, -17]) opcC.push({ fora: da * DEG, barreira: 'n', relativo: true });
  opcC.forEach((op, i) => {
    for (let k = 0; k < 8; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      const d = [17, 19, 21, 23, 25, 28, 31, 33.5, 34.8][(k * 2 + i) % 9], pa = [-30, -18, -8, 0, 6, 15, 26][(k * 3 + i) % 7];
      // sem barreira: null ou a barreira de 0 (a falta de longe); com: 2–5 a 9,15 m
      const barreira = op.barreira === 'n' ? { n: 2 + ((k + i) % 4), dist: 9.15 } : (k + i) % 3 === 0 ? { n: 0, dist: 9.15 } : null;
      novo({ k: 'c', lado, ...posBola(lado, d, pa), zLinha: op.zLinha ?? null, fora: op.fora ?? null, relativo: !!op.relativo, barreira,
        forca: FORCAS[(k * 7 + i) % 16], curva: CURVAS[(k * 3 + i) % 8], attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: null });
    }
  });
  // (os casos de 29/10 no fim da lista: as sementes dos de antes não mudam)
  // o quase solto (módulo 0,21–0,3): para o gol, ±17° e no canto; a barra cheia (e 0,85)
  [0, 17, -17, 33.5, -33.5, 45, -45, 60, -60, 90, -90].forEach((a, i) => {
    for (let k = 0; k < 8; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'r', lado, ...posBola(lado, DISTS[(k * 3 + i) % 10], POS[(k * 5 + i) % 8]), an: { a: a * DEG, mag: [0.21, 0.25, 0.3][(k + i) % 3] },
        forca: k === 7 ? 0.85 : FORCAS_CHEIA[(k + i) % 8], mod: (k >> 2) % 2 === 1,
        attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: [null, -1, 1.3][(k + i) % 3] });
    }
  });
  // a curva (Z/X ±1 e ±0,5): a reta no meio, no canto e fora do gol; a barra cheia (e 0,85), sem barreira e com a de 0
  const opcC2 = [];
  for (const zL of [-9, -6, -4.2, -3.5, -3.2, -2.9, -1.5, 0, 1.5, 2.9, 3.2, 3.5, 4.2, 6, 9]) for (const curva of [1, -1, 0.5, -0.5]) opcC2.push({ zLinha: zL, curva });
  opcC2.forEach((op, i) => {
    for (let k = 0; k < 6; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      const d = [17, 19, 21, 23, 25, 28, 31, 33.5, 34.8][(k * 2 + i) % 9], pa = [-30, -18, -8, 0, 6, 15, 26][(k * 3 + i) % 7];
      novo({ k: 'c', lado, ...posBola(lado, d, pa), zLinha: op.zLinha, fora: null, relativo: false, barreira: (k + i) % 3 === 0 ? { n: 0, dist: 9.15 } : null,
        forca: k === 5 ? 0.85 : FORCAS_CHEIA[(k * 3 + i) % 8], curva: op.curva, attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: null });
    }
  });
  // a reta logo abaixo do canto (|z| 2,3–2,65; o limiar da cobrança descendo) e a barreira (2–5) com a reta no canto: a
  // barra cheia, sem efeito e com pouco
  const opcC3 = [];
  for (const zL of [-2.65, -2.5, -2.3, 2.3, 2.5, 2.65]) for (const curva of [0, 0.25, -0.25]) opcC3.push({ zLinha: zL, curva, barreira: null });
  for (const zL of [-3.5, -3.2, -2.9, 2.9, 3.2, 3.5]) for (const curva of [0, 0.5, -0.5]) opcC3.push({ zLinha: zL, curva, barreira: 'n' });
  opcC3.forEach((op, i) => {
    for (let k = 0; k < 6; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      const d = [17, 19, 21, 23, 25, 28, 31, 33.5, 34.8][(k * 2 + i) % 9], pa = [-30, -18, -8, 0, 6, 15, 26][(k * 3 + i) % 7];
      const barreira = op.barreira === 'n' ? { n: 2 + ((k + i) % 4), dist: 9.15 } : (k + i) % 3 === 0 ? { n: 0, dist: 9.15 } : null;
      novo({ k: 'c', lado, ...posBola(lado, d, pa), zLinha: op.zLinha, fora: null, relativo: false, barreira,
        forca: FORCAS_CHEIA[(k * 5 + i) % 8], curva: op.curva, attr: { finalizacao: FIN[(k + i) % 4], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: null });
    }
  });
  return casos;
}

/** Os casos do canto (não gravados; a regra: a barra cheia no ângulo, o erro zerado). */
export function casosCanto() {
  const casos = [];
  let s = 0;
  const novo = o => { casos.push({ ...o, sem: 90000 + s }); s++; };
  [33.5, -33.5, 36, -36, 45, -45, 60, -60, 90, -90].forEach((a, i) => {
    for (let k = 0; k < 16; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'rc', lado, ...posBola(lado, [9, 12, 15, 18, 21, 25][(k + i) % 6], [-30, -15, 0, 10, 22, 30][(k * 5 + i) % 6]), an: { a: a * DEG, mag: [1, 0.6][(k >> 2) % 2] }, forca: 1, mod: (k >> 3) % 2 === 1,
        attr: { finalizacao: [60, 80, 99][(k + i) % 3], pePreferido: pp, peFraco: 50 }, pe: (k + i) % 3 === 0 ? 1 - pp : pp, gk: null });
    }
  });
  [2.9, -2.9, 3.2, -3.2, 3.5, -3.5].forEach((zL, i) => {
    for (let k = 0; k < 12; k++) {
      const lado = (k + i) % 2 ? -1 : 1, pp = (k >> 1) % 2;
      novo({ k: 'cc', lado, ...posBola(lado, [18, 21, 24, 27, 31, 34.8][(k + i) % 6], [-25, -10, 0, 10, 25][(k * 3 + i) % 5]), zLinha: zL, fora: null, relativo: false, barreira: k % 3 === 0 ? { n: 0, dist: 9.15 } : null,
        forca: 1, curva: 0, attr: { finalizacao: [60, 80, 99][(k + i) % 3], pePreferido: pp, peFraco: 50 }, pe: pp, gk: null });
    }
  });
  return casos;
}

/** O ângulo da mira de uma cobrança (c/cc): a reta pela linha do gol em zLinha, ou de lado/para trás (o do rodarCaso). */
function angCobranca(cs) {
  const gx = cs.lado * MX, dirGol = Math.atan2(-cs.bz, gx - cs.bx);
  return cs.zLinha != null ? Math.atan2(cs.zLinha - cs.bz, gx - cs.bx) : (cs.relativo ? dirGol : (cs.lado > 0 ? 0 : Math.PI)) + cs.fora;
}

/** Roda fn com o erro do chute e o do cobrador zerados (a mira, separada do sorteio). */
export function semErro(M, fn) {
  const C = M.config, e0 = [C.ACOES.chute.erroBom, C.ACOES.chute.erroRuim, C.MIRA.erro];
  C.ACOES.chute.erroBom = 0; C.ACOES.chute.erroRuim = 0; C.MIRA.erro = 0;
  try { return fn(); } finally { [C.ACOES.chute.erroBom, C.ACOES.chute.erroRuim, C.MIRA.erro] = e0; }
}

/** A altura da barra cheia na linha do gol pela força (CHEIA e o yAlvo do config: a curva de antes na força DE). */
export function yCheia(M, f) {
  const c = M.config.ACOES.chute, y0 = c.yAlvo[0] + (c.yAlvo[1] - c.yAlvo[0]) * CHEIA.de * CHEIA.de;
  return y0 + (CHEIA.y - y0) * Math.min(1, Math.max(0, (f - CHEIA.de) / (1 - CHEIA.de)));
}

/** z na faixa do canto (a régua do teste: ZC ≤ |z| ≤ MEIO) e na borda dela (BORDA: o árbitro não decide). */
export const naFaixa = z => Math.abs(z) >= ZC && Math.abs(z) <= MEIO;
export const naBorda = z => { const a = Math.abs(z); return Math.abs(a - ZC) < BORDA.zc || (a > BORDA.trave[0] && a < BORDA.trave[1]); };

/**
 * Onde a bola, de p com {v, w}, cruza a linha do gol x = gx (bola.js passoBola, o voo do jogo): {y, z} ou null (quicou ou
 * rolou antes). Batendo na trave ou no travessão antes de o centro cruzar, onde cruzaria pela reta do passo de antes (a
 * ≤ 0,5 m da linha a ~25–30 m/s a gravidade quase não pesa).
 */
function cruzaLinha(M, p, v, w, gx, lado) {
  const b = M.bola.criarBola(p.x, p.z);
  b.p.y = p.y; M.bola.chutar(b, v, w);
  const ev = [];
  let ax = b.p.x, ay = b.p.y, az = b.p.z, vx = b.v.x, vy = b.v.y, vz = b.v.z;
  for (let t = 1; t <= 400; t++) {
    ev.length = 0; M.bola.passoBola(b, ev);
    if (ev.some(e => e.tipo === 'trave') && (ax - gx) * lado < 0) { const tt = (gx - ax) / vx; return { y: ay + vy * tt - 4.905 * tt * tt, z: az + vz * tt }; }
    if ((b.p.x - gx) * lado >= 0 && (ax - gx) * lado < 0) { const f = (gx - ax) / (b.p.x - ax); return { y: ay + (b.p.y - ay) * f, z: az + (b.p.z - az) * f }; }
    if (b.rolando || ev.some(e => e.tipo === 'quique')) return null;
    ax = b.p.x; ay = b.p.y; az = b.p.z; vx = b.v.x; vy = b.v.y; vz = b.v.z;
  }
  return null;
}

/**
 * O ÁRBITRO da cobrança mirada (revisão de 29/10; nada do mira.js): a bola SUBIDA = a velocidade e o giro da cobrança pelas
 * constantes do config (ACOES.chute.v × a finalização; o giroFalta e a curva × MIRA.giro × giroAtrib), na direção da mira,
 * com a elevação — busca própria: de −0,12 rad em passos de 0,02 até a 1ª que cruza a linha do gol na altura da barra cheia
 * (yCheia) e a bissecção entre ela e a de antes — e onde ela cruza a linha. {cls, sub: {y, z} | null, s, w, y}: cls 'fora' =
 * sem a barra cheia (força ≤ DE), com barreira, a mira que não vai para o gol ou a bola subida cruzando fora da faixa do
 * canto (a main bit a bit); 'faixa' = dentro dela (sobe ao ângulo); 'borda' = perto das bordas, ou sem chegar à altura. el =
 * a elevação da bola subida (rad), ang = a direção da mira.
 */
export function classificarCobranca(M, cs) {
  if ((cs.k !== 'c' && cs.k !== 'cc') || (cs.barreira && cs.barreira.n > 0) || !(cs.forca > CHEIA.de)) return { cls: 'fora', sub: null };
  const lado = cs.lado, gx = lado * MX, ang = angCobranca(cs), ux = Math.cos(ang), uz = Math.sin(ang);
  if (ux * lado <= 0.05) return { cls: 'fora', sub: null };
  const { ACOES, MIRA } = M.config, fin = cs.attr.finalizacao, cv = ACOES.chute.v, ga = MIRA.giroAtrib, g = ACOES.chute.giroFalta;
  const s = (cv[0] + (cv[1] - cv[0]) * cs.forca) * (0.86 + (1.08 - 0.86) * fin / 100);
  const w = { x: uz * g, y: -Math.max(-1, Math.min(1, cs.curva)) * MIRA.giro * (ga[0] + (ga[1] - ga[0]) * Math.max(0, Math.min(1, fin / 100))), z: -ux * g };
  const y = yCheia(M, cs.forca), p = { x: cs.bx, y: M.config.BOLA.raio, z: cs.bz };
  const em = el => { const ce = Math.cos(el); return cruzaLinha(M, p, { x: ux * s * ce, y: s * Math.sin(el), z: uz * s * ce }, w, gx, lado); };
  let lo = -0.14, sub = null, elSub = null;
  for (let el = lo + 0.02; el <= 0.9 && !sub; el += 0.02) {
    const r = em(el);
    if (r && r.y >= y) {
      let hi = el;
      for (let i = 0; i < 30; i++) { const mm = (lo + hi) / 2, q = em(mm); if (!q || q.y < y) lo = mm; else hi = mm; }
      sub = em(hi); elSub = hi;
    } else lo = el;
  }
  const cls = !sub ? 'borda' : naBorda(sub.z) ? 'borda' : naFaixa(sub.z) ? 'faixa' : 'fora';
  return { cls, sub, el: elSub, ang, s, w, y };
}

/** O hash da lista (o "conjunto" gravado: mudou a lista, regravar). */
export const hashConjunto = casos => crypto.createHash('sha1').update(JSON.stringify(casos)).digest('hex').slice(0, 12);

/**
 * Roda um caso com os módulos M (carregar): o mundo de treino novo, o toque direto e o voo só da bola até a linha do gol.
 * {h, linha: {y, z, t} | null, mira, v, w, p, tipo}.
 */
export function rodarCaso(M, cs) {
  const { CAMPO, BARREIRA } = M.config;
  const lado = cs.lado, gx = lado * MX;
  const dirGol = Math.atan2(-cs.bz, gx - cs.bx);
  const jog = [{ id: 0, x: cs.bx - Math.cos(dirGol) * 0.4, z: cs.bz - Math.sin(dirGol) * 0.4, rumo: dirGol, time: 0, papel: 'humano', posicao: 'ATA', attr: cs.attr }];
  if (cs.gk != null) jog.push({ id: 20, x: lado * (MX - 1.2), z: cs.gk, rumo: lado > 0 ? Math.PI : 0, time: 1, papel: 'ia', posicao: 'GOL', attr: GK_ATTR });
  const m = M.sim.criarMundo({ semente: cs.sem, jogadores: jog, bola: { x: cs.bx, z: cs.bz }, posse: 0, ataca: { 0: lado, 1: -lado } });
  m.rng = M.rng.criarRng(cs.sem);
  const j = m.jogadores[0];
  const p = { tipo: 'chute', forca: cs.forca, mod: !!cs.mod, tick: m.tick, humano: cs.humano !== false };
  if (cs.k === 'c' || cs.k === 'cc') {
    // a cobrança mirada: a mira (a reta pela linha do gol em zLinha, ou de lado/para trás) e a parada do tiro livre direto
    const ang = cs.zLinha != null ? Math.atan2(cs.zLinha - cs.bz, gx - cs.bx) : (cs.relativo ? dirGol : (lado > 0 ? 0 : Math.PI)) + cs.fora;
    m.parada = { tipo: 'tiroLivre', direto: true, time: 0, x: cs.bx, z: cs.bz, cobrador: 0, barreira: cs.barreira ? { ...cs.barreira } : null, mira: { ang0: ang, ang, curva: cs.curva, cone: 1.2, rep: [-1, -1] } };
    p.mirada = { tipo: 'chute' }; p.mod = false; p.dir = { x: Math.cos(ang), z: Math.sin(ang) };
    if (cs.barreira && cs.barreira.n > 0) p.barreira = { dist: cs.barreira.dist, altura: BARREIRA.alturaPassar };
  } else {
    if (cs.an) { const a = dirGol + cs.an.a; j.ix = Math.cos(a); j.iz = Math.sin(a); j.imag = cs.an.mag; } else { j.imag = 0; j.mira = null; }
    if (cs.penalti) p.penalti = true;
    if (cs.barreiraChute) p.barreira = { dist: 9.15, altura: BARREIRA.alturaPassar };
  }
  j.pedido = p;
  const ok = M.acoes.executarAcao(m, j, cs.pe, false);
  const b = m.bola;
  const mira = m.voo?.mira ?? null;
  const vals = [ok ? 1 : 0, b.p.x, b.p.y, b.p.z, b.v.x, b.v.y, b.v.z, b.w.x, b.w.y, b.w.z, mira ? mira.y : NaN, mira ? mira.z : NaN];
  const v = { ...b.v }, w = { ...b.w }, p0 = { ...b.p };
  // o voo só da bola até a linha do gol (sem goleiro: nada além do gol no caminho)
  const ev = [];
  let linha = null, ax = b.p.x, ay = b.p.y, az = b.p.z, t = 0;
  for (t = 1; t <= 300 && !linha; t++) {
    ev.length = 0; M.bola.passoBola(b, ev);
    if ((b.p.x - gx) * lado >= 0 && (ax - gx) * lado < 0) { const f = (gx - ax) / (b.p.x - ax); linha = { y: ay + (b.p.y - ay) * f, z: az + (b.p.z - az) * f, t }; }
    ax = b.p.x; ay = b.p.y; az = b.p.z;
    if (b.rolando && Math.hypot(b.v.x, b.v.z) < 0.3) break;
  }
  vals.push(linha ? linha.y : NaN, linha ? linha.z : NaN, linha ? linha.t : -t, b.p.x, b.p.y, b.p.z);
  const h = crypto.createHash('sha1').update(Buffer.from(new Float64Array(vals).buffer)).digest('hex').slice(0, 12);
  if (CAMPO.meioX !== MX || CAMPO.gol.largura / 2 !== MEIO) throw new Error('chutes-ref: a geometria do campo mudou (regravar a referência)');
  return { h, linha, mira, v, w, p: p0, tipo: m.voo?.tipo ?? null, ok };
}

/** O resumo gravado de um resultado: [hash, y, z] da linha (mm; null sem cruzar). */
export const resumo = r => [r.h, r.linha ? Math.round(r.linha.y * 1000) / 1000 : null, r.linha ? Math.round(r.linha.z * 1000) / 1000 : null];

/** O texto de um caso (para o diagnóstico). */
export function textoCaso(cs) {
  const d = Math.hypot(cs.lado * MX - cs.bx, cs.bz).toFixed(1);
  const an = cs.k === 'c' || cs.k === 'cc' ? (cs.zLinha != null ? `mira na linha z ${cs.zLinha}` : `mira ${Math.round(cs.fora / DEG)}°${cs.relativo ? ' do gol' : ''}`) + ` efeito ${cs.curva}${cs.barreira ? ` barreira ${cs.barreira.n}` : ''}`
    : cs.an ? `analógico ${(cs.an.a / DEG).toFixed(1)}° módulo ${cs.an.mag}` : 'analógico solto';
  return `${cs.k} ${cs.lado > 0 ? '+x' : '−x'} ${d} m (${cs.bx.toFixed(1)}, ${cs.bz.toFixed(1)}) ${an} força ${cs.forca}${cs.mod ? ' colocado' : ''} pe ${cs.pe}/${cs.attr.pePreferido} fin ${cs.attr.finalizacao}${cs.gk != null ? ` goleiro z ${cs.gk}` : ''}`;
}
