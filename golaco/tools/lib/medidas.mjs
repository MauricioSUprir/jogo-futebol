// Funções de medida compartilhadas pelos testes (Node).
import { criarMundo, passo } from '../../js/sim.js';
import { BOTAO, PASSO, BOLA } from '../../js/config.js';
import { difAng } from '../../js/mat.js';
import { pose, J, NJ, SEGMENTOS } from '../../js/anim.js';

export const DEG = 180 / Math.PI;

export function percentil(arr, p) {
  if (!arr.length) return NaN;
  const a = Float64Array.from(arr).sort();
  const i = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)));
  return a[i];
}
export function media(arr) {
  if (!arr.length) return NaN;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

export const ANDARES = {
  trote: { mag: 0.5, botoes: 0 },
  corrida: { mag: 1, botoes: 0 },
  arrancada: { mag: 1, botoes: BOTAO.CORRER },
  curta: { mag: 0.6, botoes: BOTAO.MOD },
};

/**
 * Roda uma cena de condução com o jogador sozinho.
 * c = {andar, caminho:'reta'|'curva', partida:'parado'|'embalado', sentido:±1, semente, attr,
 *      duracao (s medidos), x0, z0, rumo0, roteiro?(t, j) → {x,z,botoes} (substitui o padrão)}
 * Devolve séries por tick e o log de toques.
 */
export function rodarCena(c) {
  const andar = ANDARES[c.andar] ?? ANDARES.trote;
  const aquec = c.partida === 'embalado' ? 3 : 0;
  const total = aquec + (c.duracao ?? 10);
  const rumo0 = c.rumo0 ?? 0;
  const m = criarMundo({
    semente: c.semente ?? 1,
    jogadores: [{ id: 0, x: c.x0 ?? 0, z: c.z0 ?? 0, rumo: rumo0, attr: c.attr ?? {} }],
    bola: { x: (c.x0 ?? 0) + Math.cos(rumo0) * 0.4, z: (c.z0 ?? 0) + Math.sin(rumo0) * 0.4 },
    posse: 0,
    log: true,
  });
  const j = m.jogadores[0];
  const w = (c.curvaGrausS ?? 30) / DEG * (c.sentido ?? 1);
  const N = Math.round(total / PASSO);
  const iIni = Math.round((aquec + (c.partida === 'embalado' ? 0 : 1.5)) / PASSO);
  const S = { x: [], z: [], vx: [], vz: [], rumo: [], bx: [], bz: [], by: [], s: [], ir: [], busca: [], posse: [], tick: [], pes: [], fase: [],
    pe: [], peMaisPerto: [], janela: [], dentro: [], toques: [] };
  const P = new Float32Array(NJ * 3);
  let peMarcado = null, nLog = 0;
  for (let i = 0; i < N; i++) {
    const t = i * PASSO;
    let e;
    if (c.roteiro) e = c.roteiro(t, j, m);
    else {
      let r = rumo0;
      if (c.caminho === 'curva' && t >= aquec) r = rumo0 + w * (t - aquec);
      e = { x: Math.cos(r) * andar.mag, z: Math.sin(r) * andar.mag, botoes: andar.botoes };
    }
    // pose ANTES do passo (o que está desenhado quando o toque acontece) e o pé marcado
    if (c.pose) { pose(j, m, P); peMarcado = j.cond.toque ? j.cond.toque.pe : null; }
    passo(m, { 0: e });
    if (c.pose) {
      // toques deste passo: o pé que tocou estava no balanço? trocou de pé na hora? pé–bola na pose
      for (; nLog < m.log.length; nLog++) {
        const l = m.log[nLog];
        const iT = l.pe ? J.tornozeloD : J.tornozeloE;
        S.toques.push({ t: l.t, i, balanco: !j.pes[l.pe].apoio, trocou: peMarcado != null && peMarcado !== l.pe, dPe: Math.hypot(P[iT * 3] - l.bx, P[iT * 3 + 2] - l.bz), tipo: l.tipo, apoio: l.apoio });
      }
      // bola–pé na pose depois do passo: pé do próximo toque e pé mais perto (segmento tornozelo–ponta)
      pose(j, m, P);
      const bx = m.bola.p.x, by = m.bola.p.y, bz = m.bola.p.z;
      const dSeg = (pp, d3) => {
        const a = pp ? J.tornozeloD : J.tornozeloE, b = pp ? J.pontaD : J.pontaE;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
        const ux = P[b * 3] - ax, uy = d3 ? P[b * 3 + 1] - ay : 0, uz = P[b * 3 + 2] - az;
        const l2 = ux * ux + uy * uy + uz * uz;
        let k = l2 > 1e-12 ? ((bx - ax) * ux + (d3 ? (by - ay) * uy : 0) + (bz - az) * uz) / l2 : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const qx = ax + ux * k - bx, qy = d3 ? ay + uy * k - by : 0, qz = az + uz * k - bz;
        return Math.sqrt(qx * qx + qy * qy + qz * qz);
      };
      const ct = j.cond.toque, cu = j.cond.ult;
      const mais = Math.min(dSeg(0, false), dSeg(1, false));
      S.peMaisPerto.push(mais);
      S.pe.push(ct ? dSeg(ct.pe, false) : mais);
      S.janela.push(!!((ct && (ct.tick - m.tick) * PASSO >= 0 && (ct.tick - m.tick) * PASSO < 0.16) || (cu && (m.tick - cu.tick) * PASSO >= 0 && (m.tick - cu.tick) * PASSO < 0.12)));
      // chuteira (raio da cápsula tornozelo–ponta) dentro da bola
      const rCh = SEGMENTOS.find(sg => sg[0] === J.tornozeloE && sg[1] === J.pontaE)[2];
      S.dentro.push(Math.min(dSeg(0, true), dSeg(1, true)) < BOLA.raio + rCh);
    }
    S.x.push(j.x); S.z.push(j.z); S.vx.push(j.vx); S.vz.push(j.vz); S.rumo.push(j.rumo);
    S.bx.push(m.bola.p.x); S.bz.push(m.bola.p.z); S.by.push(m.bola.p.y);
    S.s.push(Math.hypot(j.vx, j.vz)); S.ir.push(j.intRumo); S.busca.push(j.cond.busca);
    S.posse.push(m.posse); S.tick.push(m.tick); S.fase.push(j.fase);
    S.pes.push([j.pes[0].apoio, j.pes[1].apoio]);
  }
  return { m, j, S, iIni, N, log: m.log, stats: m.stats };
}

/** Taxas angulares (°/s) do rumo do tronco e da direção da velocidade na janela. */
export function taxasRumo(S, i0, i1) {
  const tf = [], tv = [];
  for (let i = Math.max(1, i0); i < i1; i++) {
    tf.push(Math.abs(difAng(S.rumo[i - 1], S.rumo[i])) / PASSO * DEG);
    if (S.s[i] > 1 && S.s[i - 1] > 1) {
      const a0 = Math.atan2(S.vz[i - 1], S.vx[i - 1]), a1 = Math.atan2(S.vz[i], S.vx[i]);
      tv.push(Math.abs(difAng(a0, a1)) / PASSO * DEG);
    }
  }
  return { tf, tv };
}

/** Distância da bola ao caminho do corpo (polilinha das posições do corpo, ±janela). */
export function bolaForaDoCaminho(S, i0, i1, janela = 150) {
  const out = [];
  const n = S.x.length;
  for (let i = i0; i < i1; i++) {
    const bx = S.bx[i], bz = S.bz[i];
    let dm = Infinity;
    const a = Math.max(1, i - 30), b = Math.min(n - 1, i + janela);
    for (let k = a; k <= b; k++) {
      const ax = S.x[k - 1], az = S.z[k - 1], cx = S.x[k], cz = S.z[k];
      const dx = cx - ax, dz = cz - az;
      const l2 = dx * dx + dz * dz;
      let t = l2 > 1e-12 ? ((bx - ax) * dx + (bz - az) * dz) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t - bx, qz = az + dz * t - bz;
      const d = Math.sqrt(qx * qx + qz * qz);
      if (d < dm) dm = d;
    }
    out.push(dm);
  }
  return out;
}

/** Toques com corte que o analógico não pediu (mudança da bola − mudança do pedido > lim). */
export function cortesNaoPedidos(log, limGraus = 30) {
  let n = 0, total = 0;
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i];
    if (a.id !== b.id) continue;
    if (a.v < 0.5 || b.v < 0.5) continue;
    total++;
    const db = Math.abs(difAng(Math.atan2(a.dz, a.dx), Math.atan2(b.dz, b.dx))) * DEG;
    const di = Math.abs(difAng(a.ir, b.ir)) * DEG;
    if (db - di > limGraus) n++;
  }
  return { n, total };
}

export function tabelaTexto(linhas) {
  const larg = [];
  for (const l of linhas) l.forEach((c, i) => { larg[i] = Math.max(larg[i] ?? 0, String(c).length); });
  return linhas.map(l => l.map((c, i) => String(c).padEnd(larg[i])).join('  ')).join('\n');
}

export function fmt(v, d = 2) {
  return Number.isFinite(v) ? v.toFixed(d) : String(v);
}
