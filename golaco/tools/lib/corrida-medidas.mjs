// A régua da corrida da IA (categoria D, item 67; dono, 24/10: "a IA correr, tanto pra marcar, tanto pra atacar, pq ela
// não corre"). Funções puras sobre o "filme" de uma partida (posição e velocidade de cada jogador a cada quadro), as
// MESMAS para o GOLAÇO (60 Hz, filmarPartida) e para o rastreamento real da Metrica (25 Hz; a análise do jogo real da
// pesquisa usou estas contas — PESQUISA-CATEGORIA-D.md). Quem usa: tools/teste-ia-corre.mjs.
//
// Definições (todas com a bola rolando e só jogadores de linha):
//  - faixas reais de velocidade: andar < 7 · trote 7–14 · corrida 14–19,8 · alta 19,8–25,2 · disparada > 25,2 km/h;
//  - FASES do time: 'sem' (o outro tem a bola), 'com' (o meu tem), 'perda' e 'ganho' (os 5 s depois de uma troca de posse
//    que dura ≥ 0,5 s); a posse de cada quadro é do dono da bola (bola livre/no ar = o último time com ela);
//  - distância à bola (≤ 10 · 10–25 · > 25 m) e "na tela": o quadro da câmera do celular deitado (CAMERA.celular: 39,6 m de
//    largura no foco, foco ≈ a bola);
//  - disparadas (> 25,2 km/h por ≥ 1 s), esforços de alta (> 19,8 km/h por ≥ 1 s), o pico de cada disparada ÷ a máxima;
//  - reação na perda (os 3 mais perto da bola até a velocidade útil — para a bola ou para o meu gol — passar de 14,4 km/h)
//    e no ganho (até ≥ 2 atacarem o espaço à frente da bola a ≥ 19,8 km/h);
//  - corridas sem a bola à frente dela (≥ 19,8 km/h para a frente por ≥ 1 s): por minuto de posse do time, quantas chegam à
//    área (até 1 s depois do fim) e quantas passam da linha da defesa;
//  - 1º homem sobre o condutor (distância, % a ≤ 2 / ≤ 5 m, aproximação por faixa de distância);
//  - CONDUTOR: velocidade (mediana, faixas), a duração de cada posse dele (do domínio até a bola sair do pé ou trocar de
//    dono) e as trocas de condutor por minuto de posse do time;
//  - APOIO PERTO: o time com a bola (fase 'com'), a ≤ 10 m dela, SEM o dono da bola (o "≤ 10 m" das faixas conta também o
//    condutor — revisão do D2: o apoio curto novo podia sair sem mudar a medida); e o mesmo só com o condutor CONDUZINDO
//    (bola no pé, ≥ 3 m/s: quem está perto anda enquanto ele leva a bola?);
//  - vai e volta: a direção inverte (> 135°) em 0,25–1 s, com ≥ 1,5 m/s nos dois instantes (1 por jogador por segundo).
// Grupos: contra o humano, 'adv' (a IA adversária, time 1), 'comp' (os companheiros do humano, time 0 sem o controlado) e
// 'hum' (o controlado); IA × IA, um grupo só ('ia').
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const KMH = 3.6;
export const BANDAS = [7 / KMH, 14 / KMH, 19.8 / KMH, 25.2 / KMH]; // m/s: 1,944 · 3,889 · 5,5 · 7,0
export const NOMES_BANDA = ['andar', 'trote', 'corrida', 'alta', 'disparada'];
const banda = v => (v < BANDAS[0] ? 0 : v < BANDAS[1] ? 1 : v < BANDAS[2] ? 2 : v < BANDAS[3] ? 3 : 4);
export const FASES = ['sem', 'com', 'perda', 'ganho']; // códigos 1..4 (0 = fora)
const NOMES_FASE = { sem: 'sem a bola (marcando)', com: 'com a bola (atacando)', perda: 'transição: 5 s depois de PERDER', ganho: 'transição: 5 s depois de GANHAR' };
const DBIN = d => (d <= 10 ? 0 : d <= 25 ? 1 : 2);
const NOMES_DBIN = ['≤ 10 m', '10–25 m', '> 25 m'];
const V_HSR = BANDAS[2], V_SPR = BANDAS[3], V_COR = 4.0; // 14,4 km/h
const V_SC = 15 / KMH; // SkillCorner: > 15 km/h por ≥ 0,7 s
const V_CONDUZ = 3; // m/s (10,8 km/h): o condutor levando a bola (o apoio curto do D2 se mexe com ele a ≥ 3 m/s)
export const MAXS = 44;
const BINS_1H = [2, 4, 7, 12, 20, Infinity];
const NOMES_1H = ['0–2', '2–4', '4–7', '7–12', '12–20', '> 20'];
// quadro do celular deitado (46 m do foco, 39,6 m de largura no foco; foco ≈ a bola): na tela se
// |x − bola| ≤ 19,8 × (46 + bola.z − z) / 46 e o jogador a menos de 25 m da bola para o lado da câmera (z +)
const naTela = (x, z, bx, bz) => z - bz <= 25 && Math.abs(x - bx) <= 19.8 * (46 + bz - z) / 46;

export function novoAcc() {
  return {
    tk: new Float64Array(4 * 3 * 5), mt: new Float64Array(4 * 3 * 5), // ticks e metros [fase][dbin][banda]
    tkT: new Float64Array(4 * 2 * 5), mtT: new Float64Array(4 * 2 * 5), // [fase][fora/na tela][banda]
    pt: 0, seg: 0, // jogador-quadros e jogador-segundos (com fase)
    spr: 0, hsr: 0, sprFase: [0, 0, 0, 0], hsrFase: [0, 0, 0, 0], sprRamo: {}, picos: [], sprDur: [], sprTela: 0,
    maxRel: [], maxAbs: [], vArr: [],
    perda: { n: 0, r4: [[], [], []], r55: [[], [], []], v1: [[], [], []], v2: [[], [], []], u1: [[], [], []], ini: [[], [], []],
      perdeu: { r4: [], v1: [], v2: [], ini: [] } },
    ganho: { n: 0, r: [], c1: [], c2: [], c3: [], cmax: [] },
    corr: { n: 0, area: 0, costas: 0, sc: 0, scArea: 0, posseT: 0, dur: [], ramo: {} },
    h1: { n: 0, d: 0, le2: 0, le5: 0, d1: [], vBin: BINS_1H.map(() => []), aBin: BINS_1H.map(() => []), cBin: BINS_1H.map(() => []), rBin: BINS_1H.map(() => ({})),
      fech: [], fechQq: [], v1ini: [], vMed: [], d0: [], chega: [], chegaN: 0, possesN: 0 },
    cond: { tk: [0, 0, 0, 0, 0], tkG: [0, 0, 0, 0, 0], v: [], posse: [] },
    apoio: { tk: [0, 0, 0, 0, 0], mt: [0, 0, 0, 0, 0] }, // fase 'com', a ≤ 10 m da bola, sem o dono: [banda]
    apoioCond: { tk: [0, 0, 0, 0, 0], mt: [0, 0, 0, 0, 0] }, // ...e com o dono conduzindo (no pé, ≥ V_CONDUZ): [banda]
    ramo: {},
    inv: 0, invRamo: {},
  };
}

/**
 * R = {N, fps, X, Z, VX, VZ, PRES (0 fora, 1 linha, 2 goleiro), RAMO, BX, BZ, DONO (slot ou −1), CTRL (slot do humano
 * ou −1), MAO, ROL, AT0 (rumo do ataque do time 0), meta [{time, vArr}], ramos, HUM, PT? (posse por quadro, opcional),
 * grupoReal? (nome do grupo sem humano)}.
 */
export function analisar(R) {
  const { N, X, Z, VX, VZ, PRES, RAMO, BX, BZ, DONO, CTRL, MAO, ROL, AT0, meta, ramos, HUM } = R;
  const F = R.fps ?? 60, DT = 1 / F, q = s => Math.max(1, Math.round(s * F));
  const Q1 = q(1), Q05 = q(0.5), Q5 = q(5), Q2 = q(2), Q3 = q(3), Q07 = q(0.7), Q6 = q(6), Q025 = q(0.25), PASSOQ = Math.max(1, Math.round(F / 12));
  const S = meta.length;
  const K = (t, s) => t * MAXS + s;
  const vel = (t, s) => Math.hypot(VX[K(t, s)], VZ[K(t, s)]);
  const lado = (T, t) => (T === 0 ? AT0[t] : -AT0[t]); // rumo do ataque do time T
  const GR = R.grupoReal ?? 'ia';
  const grupo = (t, s) => {
    if (PRES[K(t, s)] !== 1) return null;
    if (!HUM) return GR;
    if (meta[s].time === 1) return 'adv';
    return s === CTRL[t] ? 'hum' : 'comp';
  };
  const acc = HUM ? { adv: novoAcc(), comp: novoAcc(), hum: novoAcc() } : { [GR]: novoAcc() };
  // ---- posse (time) por quadro: do dono; bola livre/no ar = o último time com ela (ou a dada, no real: pelos eventos)
  let PT = R.PT;
  if (!PT) {
    PT = new Int8Array(N).fill(-1);
    for (let t = 0; t < N; t++) PT[t] = DONO[t] >= 0 ? meta[DONO[t]].time : t > 0 ? PT[t - 1] : -1;
  }
  // transições confirmadas (o novo time fica ≥ 0,5 s) em jogo corrido; `quem` = o último dono do time que perdeu
  const trans = [];
  let ultDono = [-1, -1];
  for (let t = 1; t < N; t++) {
    if (DONO[t - 1] >= 0) ultDono[meta[DONO[t - 1]].time] = DONO[t - 1];
    if (!ROL[t] || !ROL[t - 1] || PT[t] === PT[t - 1] || PT[t] < 0 || PT[t - 1] < 0) continue;
    let ok = true; for (let k = t; k < Math.min(N, t + Q05); k++) if (PT[k] !== PT[t]) { ok = false; break; }
    if (ok) trans.push({ t, g: PT[t], l: PT[t - 1], quem: ultDono[PT[t - 1]] });
  }
  const FASE = [new Uint8Array(N), new Uint8Array(N)];
  for (let t = 0; t < N; t++) for (const T of [0, 1]) FASE[T][t] = !ROL[t] || PT[t] < 0 ? 0 : PT[t] === T ? 2 : 1;
  for (let i = 0; i < trans.length; i++) {
    const { t, g, l } = trans[i], fim = Math.min(N, t + Q5, i + 1 < trans.length ? trans[i + 1].t : N);
    for (let k = t; k < fim; k++) if (ROL[k]) { FASE[g][k] = 4; FASE[l][k] = 3; }
  }
  let rolT = 0; for (let t = 0; t < N; t++) rolT += ROL[t];
  // ---- faixas, ramos, inversões
  const invUlt = new Int32Array(S).fill(-1e9);
  for (let t = 0; t < N; t++) {
    if (!ROL[t]) continue;
    for (let s = 0; s < S; s++) {
      const g = grupo(t, s); if (!g) continue;
      const T = meta[s].time, f = FASE[T][t]; if (!f) continue;
      const A = acc[g], k = K(t, s), v = Math.hypot(VX[k], VZ[k]);
      if (!Number.isFinite(v)) continue;
      const d = Math.hypot(X[k] - BX[t], Z[k] - BZ[t]);
      const b = banda(v);
      const idx = ((f - 1) * 3 + DBIN(d)) * 5 + b;
      A.tk[idx]++; A.mt[idx] += v * DT; A.pt++;
      if (f === 2 && d <= 10 && DONO[t] !== s) {
        A.apoio.tk[b]++; A.apoio.mt[b] += v * DT;
        if (DONO[t] >= 0 && !MAO[t] && meta[DONO[t]].time === T && vel(t, DONO[t]) >= V_CONDUZ) { A.apoioCond.tk[b]++; A.apoioCond.mt[b] += v * DT; }
      }
      const it = ((f - 1) * 2 + (naTela(X[k], Z[k], BX[t], BZ[t]) ? 1 : 0)) * 5 + b;
      A.tkT[it]++; A.mtT[it] += v * DT;
      const rn = ramos[RAMO[k]];
      const rr = A.ramo[rn] ??= { t: 0, m: 0, hsr: 0, andar: 0, perto: 0, fase: [0, 0, 0, 0] };
      rr.t++; rr.m += v * DT; if (v >= V_HSR) rr.hsr++; if (v < BANDAS[0]) rr.andar++; if (d <= 10) rr.perto++; rr.fase[f - 1]++;
      if (f === 2 || f === 4) { const db = DBIN(d); (rr.atq ??= [0, 0, 0, 0, 0, 0])[2 * db]++; rr.atq[2 * db + 1] += v * DT; }
      // condutor (com a bola no pé)
      if (DONO[t] === s && !MAO[t]) { (f === 4 ? A.cond.tkG : A.cond.tk)[b]++; if (t % PASSOQ === 0) A.cond.v.push(v); }
      // vai e volta: a direção inverte (> 135°) em 0,25–1 s, com ≥ 1,5 m/s nos dois instantes (1 por jogador por s)
      if (v >= 1.5 && t >= Q1 && t - invUlt[s] >= Q1) {
        for (let qq = Q025; qq <= Q1; qq += Math.max(1, Math.round(F / 12))) {
          const kq = K(t - qq, s); if (PRES[kq] !== 1 || !ROL[t - qq]) continue;
          const vq = Math.hypot(VX[kq], VZ[kq]); if (!(vq >= 1.5)) continue;
          if ((VX[k] * VX[kq] + VZ[k] * VZ[kq]) / (v * vq) < -0.7071) { A.inv++; A.invRamo[rn] = (A.invRamo[rn] ?? 0) + 1; invUlt[s] = t; break; }
        }
      }
    }
  }
  for (const A of Object.values(acc)) A.seg = A.pt / F;
  // ---- posse de cada condutor de linha: do domínio até a bola sair do pé (passe, chute, perda, bola parada) ou trocar de
  // dono; a duração vai para o grupo dele (o mesmo recorte das posses do 1º homem, abaixo)
  {
    let c = -1, t0 = 0;
    const fecha = t => { if (c >= 0) { const g = grupo(t0, c); if (g) acc[g].cond.posse.push((t - t0) / F); } c = -1; };
    for (let t = 0; t < N; t++) {
      const d = ROL[t] && !MAO[t] && DONO[t] >= 0 && PRES[K(t, DONO[t])] === 1 ? DONO[t] : -1;
      if (d !== c) { fecha(t); if (d >= 0) { c = d; t0 = t; } }
    }
    fecha(N);
  }
  // ---- disparadas e esforços de alta, máximo por jogador
  for (let s = 0; s < S; s++) {
    let vmax = 0, gMax = null;
    const T = meta[s].time;
    let spr = 0, pico = 0, t0 = -1, tela = false, hsrRun = 0, hsrT0 = -1, gAnt = null;
    const fechaSpr = A => {
      if (spr >= Q1 && A) {
        A.spr++; A.picos.push(pico / meta[s].vArr); A.sprDur.push(spr / F); if (tela) A.sprTela++;
        const f = FASE[T][t0]; if (f) A.sprFase[f - 1]++;
        const rn = ramos[RAMO[K(t0, s)]]; A.sprRamo[rn] = (A.sprRamo[rn] ?? 0) + 1;
      }
      spr = 0; pico = 0; tela = false;
    };
    const fechaHsr = A => { if (hsrRun >= Q1 && A) { A.hsr++; const f = FASE[T][hsrT0]; if (f) A.hsrFase[f - 1]++; } hsrRun = 0; };
    for (let t = 0; t < N; t++) {
      const g = ROL[t] && FASE[T][t] ? grupo(t, s) : null, A = g ? acc[g] : null;
      const v = g ? vel(t, s) : 0;
      if (g !== gAnt) { if (gAnt) { fechaSpr(acc[gAnt]); fechaHsr(acc[gAnt]); } spr = 0; pico = 0; hsrRun = 0; }
      gAnt = g;
      if (!g || !Number.isFinite(v)) continue;
      if (v > vmax) { vmax = v; gMax = g; }
      if (v > V_SPR) { if (!spr) t0 = t; spr++; pico = Math.max(pico, v); if (naTela(X[K(t, s)], Z[K(t, s)], BX[t], BZ[t])) tela = true; } else fechaSpr(A);
      if (v > V_HSR) { if (!hsrRun) hsrT0 = t; hsrRun++; } else fechaHsr(A);
    }
    if (gAnt) { fechaSpr(acc[gAnt]); fechaHsr(acc[gAnt]); }
    if (gMax && gMax !== 'hum') { acc[gMax].maxRel.push(vmax / meta[s].vArr); acc[gMax].maxAbs.push(vmax); acc[gMax].vArr.push(meta[s].vArr); }
  }
  // ---- reação na PERDA e no GANHO
  const reage = (s, t0, gx, P, r) => {
    let r4 = NaN, r55 = NaN, cens = false;
    for (let k = t0; k < Math.min(N, t0 + Q5); k++) {
      if (!ROL[k] || PRES[K(k, s)] !== 1) { cens = true; break; }
      const kk = K(k, s), px = X[kk], pz = Z[kk], vx = VX[kk], vz = VZ[kk];
      const db = Math.hypot(BX[k] - px, BZ[k] - pz) || 1, dg = Math.hypot(gx - px, pz) || 1;
      const u = Math.max((vx * (BX[k] - px) + vz * (BZ[k] - pz)) / db, (vx * (gx - px) + vz * (0 - pz)) / dg);
      if (Number.isNaN(r4) && u >= V_COR) r4 = (k - t0) / F;
      if (Number.isNaN(r55) && u >= V_HSR) r55 = (k - t0) / F;
      if (k === t0) (r == null ? P.ini : P.ini[r]).push(Math.hypot(vx, vz));
      if (k === t0 + Q1) { (r == null ? P.v1 : P.v1[r]).push(Math.hypot(vx, vz)); if (r != null) P.u1[r].push(u); }
      if (k === t0 + Q2) (r == null ? P.v2 : P.v2[r]).push(Math.hypot(vx, vz));
    }
    if (!cens || !Number.isNaN(r4)) (r == null ? P.r4 : P.r4[r]).push(Number.isNaN(r4) ? 5 : r4);
    if (r != null && (!cens || !Number.isNaN(r55))) P.r55[r].push(Number.isNaN(r55) ? 5 : r55);
  };
  for (const tr of trans) {
    const t0 = tr.t;
    // perda: os 3 mais perto da bola do time que perdeu, SEM quem perdeu a bola (este vai à parte)
    {
      const L = tr.l, cand = [];
      for (let s = 0; s < S; s++) {
        const g = grupo(t0, s); if (!g || g === 'hum' || meta[s].time !== L) continue;
        const d = Math.hypot(X[K(t0, s)] - BX[t0], Z[K(t0, s)] - BZ[t0]);
        if (!Number.isFinite(d)) continue;
        if (s === tr.quem) { reage(s, t0, -lado(L, t0) * 52.5, acc[g].perda.perdeu, null); continue; }
        cand.push({ s, g, d });
      }
      cand.sort((a, b) => a.d - b.d || a.s - b.s);
      const gx = -lado(L, t0) * 52.5;
      for (let r = 0; r < Math.min(3, cand.length); r++) {
        const { s, g } = cand[r];
        if (r === 0) acc[g].perda.n++;
        reage(s, t0, gx, acc[g].perda, r);
      }
    }
    // ganho: até ≥ 2 do time que ganhou atacarem o espaço à frente da bola a ≥ 19,8 km/h
    {
      const G = tr.g;
      const gs = HUM ? (G === 1 ? 'adv' : 'comp') : GR, A = acc[gs].ganho;
      A.n++;
      let rt = NaN, cmax = 0, cens = false;
      for (let k = t0; k < Math.min(N, t0 + Q5); k++) {
        if (!ROL[k]) { cens = true; break; }
        const ld = lado(G, k), ub = BX[k] * ld;
        let c = 0;
        for (let s = 0; s < S; s++) {
          const g = grupo(k, s); if (!g || g === 'hum' || meta[s].time !== G || DONO[k] === s) continue;
          const kk = K(k, s);
          if (VX[kk] * ld >= V_HSR && X[kk] * ld >= ub - 3) c++;
        }
        cmax = Math.max(cmax, c);
        if (Number.isNaN(rt) && c >= 2) rt = (k - t0) / F;
        if (k === t0 + Q1) A.c1.push(c); if (k === t0 + Q2) A.c2.push(c); if (k === t0 + Q3) A.c3.push(c);
      }
      if (!cens || !Number.isNaN(rt)) { A.r.push(Number.isNaN(rt) ? 5 : rt); A.cmax.push(cmax); }
    }
  }
  // ---- corridas sem a bola à frente da bola (time com a posse: fases com/ganho)
  for (const T of [0, 1]) {
    let posse = 0; for (let t = 0; t < N; t++) if (FASE[T][t] === 2 || FASE[T][t] === 4) posse++;
    const gT = HUM ? (T === 1 ? 'adv' : 'comp') : GR;
    acc[gT].corr.posseT += posse / F;
  }
  for (let s = 0; s < S; s++) {
    const T = meta[s].time;
    let run = 0, sc = 0, t0 = -1, t0s = -1;
    const fim = (t, A, tipo) => {
      const ini = tipo === 'hsr' ? t0 : t0s;
      let area = false, costas = false;
      for (let k = ini; k < Math.min(N, t + Q1); k++) {
        if (PRES[K(k, s)] !== 1) break;
        const ld = lado(T, k), u = X[K(k, s)] * ld, w = Math.abs(Z[K(k, s)]);
        if (u >= 36 && w <= 20.16) area = true;
        if (tipo === 'hsr' && !costas && k < t) {
          // linha = o 2º adversário mais recuado (com o goleiro)
          let a = -Infinity, b2 = -Infinity;
          for (let qq = 0; qq < S; qq++) if (PRES[K(k, qq)] && meta[qq].time !== T) { const uq = X[K(k, qq)] * ld; if (uq > a) { b2 = a; a = uq; } else if (uq > b2) b2 = uq; }
          if (Number.isFinite(b2) && u >= b2 - 1) costas = true;
        }
      }
      if (tipo === 'hsr') {
        A.corr.n++; if (area) A.corr.area++; if (costas) A.corr.costas++; A.corr.dur.push(run / F);
        // o ramo da IA no começo da corrida: [quantas, quantas chegaram à área]
        const rr = A.corr.ramo[ramos[RAMO[K(ini, s)]]] ??= [0, 0]; rr[0]++; if (area) rr[1]++;
      }
      else { A.corr.sc++; if (area) A.corr.scArea++; }
    };
    let gAnt = null;
    for (let t = 0; t < N; t++) {
      const g = grupo(t, s), f = g ? FASE[T][t] : 0;
      const ok = g && g !== 'hum' && (f === 2 || f === 4) && DONO[t] !== s;
      let cH = false, cS = false;
      if (ok) {
        const k = K(t, s), ld = lado(T, t), vf = VX[k] * ld, ahead = X[k] * ld > BX[t] * ld;
        cH = ahead && vf >= V_HSR; cS = ahead && vf > V_SC;
      }
      const A = g && g !== 'hum' ? acc[g] : gAnt ? acc[gAnt] : null;
      if (cH) { if (!run) t0 = t; run++; } else { if (run >= Q1 && A) fim(t, A, 'hsr'); run = 0; }
      if (cS) { if (!sc) t0s = t; sc++; } else { if (sc >= Q07 && A) fim(t, A, 'sc'); sc = 0; }
      if (g && g !== 'hum') gAnt = g;
    }
  }
  // ---- 1º homem sobre o condutor
  //  adv: o condutor é o HUMANO (controlado, bola no pé); os defensores, a IA adversária (time 1)
  //  comp: o condutor é o da IA adversária; os defensores, os companheiros do humano (sem o controlado)
  //  real/ia: qualquer condutor de linha; os defensores, o outro time
  const casos = HUM ? [['adv', t => (DONO[t] >= 0 && DONO[t] === CTRL[t] ? DONO[t] : -1), true], ['comp', t => (DONO[t] >= 0 && meta[DONO[t]].time === 1 ? DONO[t] : -1), true]]
    : [[GR, t => DONO[t], false]];
  for (const [g, condDe, filtra] of casos) {
    const A = acc[g].h1;
    let pos = null;
    const fechaPosse = t => {
      if (!pos) return;
      const dur = (t - pos.t0) / F;
      A.possesN++;
      if (pos.chega != null) { A.chega.push(pos.chega); A.chegaN++; }
      if (dur >= 0.5 && pos.i1 >= 0) {
        const tt = Math.min(t - 1, pos.t0 + Q2), du = (tt - pos.t0) / F;
        if (du > 0) {
          const kc = K(tt, pos.c), ki = K(tt, pos.i1);
          const dI = Math.hypot(X[ki] - X[kc], Z[ki] - Z[kc]);
          if (Number.isFinite(dI)) { A.fech.push((pos.d0 - dI) / du); A.fechQq.push((pos.d0 - pos.d1fim) / du); A.d0.push(pos.d0); }
          A.vMed.push(pos.vs.reduce((a, b) => a + b, 0) / Math.max(1, pos.vs.length));
        }
      }
      pos = null;
    };
    for (let t = 0; t < N; t++) {
      const c = ROL[t] && !MAO[t] ? condDe(t) : -1;
      if (c < 0 || PRES[K(t, c)] !== 1) { fechaPosse(t); continue; }
      const T = meta[c].time, kc = K(t, c), cx = X[kc], cz = Z[kc];
      let i1 = -1, d1 = Infinity;
      for (let s = 0; s < S; s++) {
        if (meta[s].time === T || PRES[K(t, s)] !== 1) continue;
        if (filtra && grupo(t, s) !== g) continue;
        const d = Math.hypot(X[K(t, s)] - cx, Z[K(t, s)] - cz);
        if (d < d1) { d1 = d; i1 = s; }
      }
      if (i1 < 0 || !Number.isFinite(d1)) { fechaPosse(t); continue; }
      if (pos && pos.c !== c) fechaPosse(t);
      if (!pos) { pos = { c, t0: t, i1, d0: d1, vs: [], chega: d1 <= 2 ? 0 : null, d1fim: d1 }; A.v1ini.push(vel(t, i1)); }
      if (t - pos.t0 <= Q2) { pos.vs.push(vel(t, pos.i1)); pos.d1fim = d1; }
      if (pos.chega == null && d1 <= 2 && t - pos.t0 <= Q6) pos.chega = (t - pos.t0) / F;
      A.n++; A.d += d1; if (d1 <= 2) A.le2++; if (d1 <= 5) A.le5++;
      if (t % 3 === 0) A.d1.push(d1);
      // velocidade e aproximação do 1º homem por faixa de distância (o mesmo jogador no quadro anterior); a do
      // condutor; o ramo do 1º homem
      if (t > 0 && ROL[t - 1] && PRES[K(t - 1, i1)] === 1 && PRES[K(t - 1, c)] === 1 && t % 2 === 0) {
        const dPrev = Math.hypot(X[K(t - 1, i1)] - X[K(t - 1, c)], Z[K(t - 1, i1)] - Z[K(t - 1, c)]);
        const b = BINS_1H.findIndex(x => d1 <= x);
        A.vBin[b].push(vel(t, i1)); A.aBin[b].push((dPrev - d1) / DT); A.cBin[b].push(vel(t, c));
        const rn = ramos[RAMO[K(t, i1)]]; A.rBin[b][rn] = (A.rBin[b][rn] ?? 0) + 1;
      }
    }
    fechaPosse(N);
  }
  return { acc, rolT: rolT / F, nTrans: trans.length };
}

// ------------------------------------------------------------------------------------------- junta e relatório
export function juntar(lista) {
  const J = novoAcc();
  for (const A of lista) {
    for (let i = 0; i < J.tk.length; i++) { J.tk[i] += A.tk[i]; J.mt[i] += A.mt[i]; }
    for (let i = 0; i < J.tkT.length; i++) { J.tkT[i] += A.tkT[i]; J.mtT[i] += A.mtT[i]; }
    J.pt += A.pt; J.seg += A.seg; J.spr += A.spr; J.hsr += A.hsr; J.inv += A.inv; J.sprTela += A.sprTela;
    for (const [r, n] of Object.entries(A.invRamo ?? {})) J.invRamo[r] = (J.invRamo[r] ?? 0) + n;
    for (let i = 0; i < 4; i++) { J.sprFase[i] += A.sprFase[i]; J.hsrFase[i] += A.hsrFase[i]; }
    for (const [r, n] of Object.entries(A.sprRamo)) J.sprRamo[r] = (J.sprRamo[r] ?? 0) + n;
    J.picos.push(...A.picos); J.sprDur.push(...A.sprDur); J.maxRel.push(...A.maxRel); J.maxAbs.push(...A.maxAbs); J.vArr.push(...A.vArr);
    J.perda.n += A.perda.n;
    for (const key of ['r4', 'r55', 'v1', 'v2', 'u1', 'ini']) for (let r = 0; r < 3; r++) J.perda[key][r].push(...A.perda[key][r]);
    for (const key of ['r4', 'v1', 'v2', 'ini']) J.perda.perdeu[key].push(...A.perda.perdeu[key]);
    J.ganho.n += A.ganho.n; for (const key of ['r', 'c1', 'c2', 'c3', 'cmax']) J.ganho[key].push(...A.ganho[key]);
    for (const key of ['n', 'area', 'costas', 'sc', 'scArea', 'posseT']) J.corr[key] += A.corr[key];
    J.corr.dur.push(...A.corr.dur);
    for (const [r, [n, a]] of Object.entries(A.corr.ramo ?? {})) { const qq = J.corr.ramo[r] ??= [0, 0]; qq[0] += n; qq[1] += a; }
    for (const key of ['n', 'd', 'le2', 'le5', 'chegaN', 'possesN']) J.h1[key] += A.h1[key];
    for (const key of ['d1', 'fech', 'fechQq', 'v1ini', 'vMed', 'chega', 'd0']) J.h1[key].push(...A.h1[key]);
    for (let b = 0; b < BINS_1H.length; b++) {
      J.h1.vBin[b].push(...A.h1.vBin[b]); J.h1.aBin[b].push(...A.h1.aBin[b]); J.h1.cBin[b].push(...A.h1.cBin[b]);
      for (const [r, n] of Object.entries(A.h1.rBin[b])) J.h1.rBin[b][r] = (J.h1.rBin[b][r] ?? 0) + n;
    }
    for (let b = 0; b < 5; b++) { J.cond.tk[b] += A.cond.tk[b]; J.cond.tkG[b] += A.cond.tkG[b]; J.apoio.tk[b] += A.apoio.tk[b]; J.apoio.mt[b] += A.apoio.mt[b];
      J.apoioCond.tk[b] += A.apoioCond.tk[b]; J.apoioCond.mt[b] += A.apoioCond.mt[b]; }
    J.cond.v.push(...A.cond.v); J.cond.posse.push(...(A.cond.posse ?? []));
    for (const [r, o] of Object.entries(A.ramo)) {
      const qq = J.ramo[r] ??= { t: 0, m: 0, hsr: 0, andar: 0, perto: 0, fase: [0, 0, 0, 0] };
      qq.t += o.t; qq.m += o.m; qq.hsr += o.hsr; qq.andar += o.andar; qq.perto += o.perto; for (let i = 0; i < 4; i++) qq.fase[i] += o.fase[i];
      if (o.atq) { qq.atq ??= [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6; i++) qq.atq[i] += o.atq[i]; }
    }
  }
  return J;
}
// (a ordenação numérica do Float64Array: a mesma mediana, várias vezes mais rápida — o bootstrap do teste-ia-corre refaz o
// resumo 200 vezes)
export const mediana = v => { if (!v.length) return NaN; const s = Float64Array.from(v).sort(); return s[s.length >> 1]; };
const media = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
export const f1 = (x, c = 1) => (Number.isFinite(x) ? x.toFixed(c).replace('.', ',') : '—');

export function resumo(J) {
  const med = mediana;
  const out = {};
  const linhaDe = (TK, MT, nb, fs, bs) => {
    let tk = 0, mt = 0; const ft = [0, 0, 0, 0, 0], fm = [0, 0, 0, 0, 0];
    for (const f of fs) for (const b of bs) for (let k = 0; k < 5; k++) { const i = (f * nb + b) * 5 + k; tk += TK[i]; mt += MT[i]; ft[k] += TK[i]; fm[k] += MT[i]; }
    // minutos de jogador: o quadro vale 1/fps s; tk/pt × seg dá os segundos
    const seg = J.pt ? tk / J.pt * J.seg : 0, min = seg / 60;
    return { min, mpm: mt / Math.max(1e-9, min), tempoPct: ft.map(x => 100 * x / Math.max(1, tk)), distPct: fm.map(x => 100 * x / Math.max(1e-9, mt)),
      hsrMpm: (fm[3] + fm[4]) / Math.max(1e-9, min), hsrDistPct: 100 * (fm[3] + fm[4]) / Math.max(1e-9, mt), sprMpm: fm[4] / Math.max(1e-9, min), vMed: mt / Math.max(1e-9, seg) };
  };
  const linha = (fs, bs) => linhaDe(J.tk, J.mt, 3, fs, bs);
  out.total = linha([0, 1, 2, 3], [0, 1, 2]);
  // atacando = o meu time com a bola (fases 'com' e 'ganho'); defendendo = 'sem' e 'perda'
  out.atacando = linha([1, 3], [0, 1, 2]);
  out.defendendo = linha([0, 2], [0, 1, 2]);
  out.fase = {}; FASES.forEach((f, i) => { out.fase[f] = linha([i], [0, 1, 2]); out.fase[f].dist = [0, 1, 2].map(b => linha([i], [b])); out.fase[f].tela = [0, 1].map(b => linhaDe(J.tkT, J.mtT, 2, [i], [b])); });
  out.dist = [0, 1, 2].map(b => linha([0, 1, 2, 3], [b]));
  out.tela = [0, 1].map(b => linhaDe(J.tkT, J.mtT, 2, [0, 1, 2, 3], [b]));
  const minJ = J.seg / 60;
  out.sprPorMin = J.spr / minJ; out.hsrPorMin = J.hsr / minJ; out.sprTela = J.sprTela / Math.max(1, J.spr);
  out.sprFase = J.sprFase; out.hsrFase = J.hsrFase;
  out.picoMed = med(J.picos); out.pico90 = J.picos.filter(x => x >= 0.9).length / Math.max(1, J.picos.length); out.pico95 = J.picos.filter(x => x >= 0.95).length / Math.max(1, J.picos.length);
  out.sprDurMed = med(J.sprDur);
  out.maxRelMed = med(J.maxRel); out.maxAbsMed = med(J.maxAbs); out.vArrMed = med(J.vArr);
  out.max95 = J.maxRel.filter(x => x >= 0.95).length / Math.max(1, J.maxRel.length); out.max90 = J.maxRel.filter(x => x >= 0.9).length / Math.max(1, J.maxRel.length);
  out.sprRamo = Object.entries(J.sprRamo).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const P = J.perda;
  out.perda = { n: P.n, r4: P.r4.map(med), r55: P.r55.map(med), r4em1: P.r4.map(v => v.filter(x => x <= 1).length / Math.max(1, v.length)), r55em2: P.r55.map(v => v.filter(x => x <= 2).length / Math.max(1, v.length)),
    nunca55: P.r55.map(v => v.filter(x => x >= 5).length / Math.max(1, v.length)), v1: P.v1.map(med), v2: P.v2.map(med), u1: P.u1.map(med), ini: P.ini.map(med),
    perdeu: { n: P.perdeu.r4.length, r4: med(P.perdeu.r4), ini: med(P.perdeu.ini), v1: med(P.perdeu.v1), v2: med(P.perdeu.v2) } };
  const G = J.ganho;
  out.ganho = { n: G.n, r: med(G.r), em2: G.r.filter(x => x <= 2).length / Math.max(1, G.r.length), nunca: G.r.filter(x => x >= 5).length / Math.max(1, G.r.length), c1: media(G.c1), c2: media(G.c2), c3: media(G.c3), cmax: media(G.cmax) };
  const Cr = J.corr, posseMin = Cr.posseT / 60;
  out.corr = { ramo: Object.entries(Cr.ramo).sort((a, b) => b[1][0] - a[1][0]).slice(0, 8), porMinPosse: Cr.n / Math.max(1e-9, posseMin), area: Cr.area / Math.max(1, Cr.n), costas: Cr.costas / Math.max(1, Cr.n), scPorMinPosse: Cr.sc / Math.max(1e-9, posseMin), scArea: Cr.scArea / Math.max(1, Cr.sc), durMed: med(Cr.dur), n: Cr.n, posseMin };
  const H = J.h1;
  const topo = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, n]) => [r, n / Math.max(1, Object.values(o).reduce((a, b) => a + b, 0))]);
  out.h1 = { dMed: H.d / Math.max(1, H.n), dMediana: med(H.d1), le2: H.le2 / Math.max(1, H.n), le5: H.le5 / Math.max(1, H.n), vBin: H.vBin.map(med), aBin: H.aBin.map(med), cBin: H.cBin.map(med), nBin: H.vBin.map(v => v.length),
    rBin: H.rBin.map(topo), fech: med(H.fech), fechQq: med(H.fechQq), vMed2s: med(H.vMed), v1ini: med(H.v1ini), d0: med(H.d0), chega: med(H.chega), chegaFrac: H.chegaN / Math.max(1, H.possesN), posses: H.possesN };
  const ct = J.cond.tk.reduce((a, b) => a + b, 0), cg = J.cond.tkG.reduce((a, b) => a + b, 0);
  out.cond = { faixas: J.cond.tk.map(x => 100 * x / Math.max(1, ct)), faixasGanho: J.cond.tkG.map(x => 100 * x / Math.max(1, cg)), vMed: med(J.cond.v),
    // a posse de cada condutor (mediana) e as trocas de condutor por minuto de posse do time
    posseMed: med(J.cond.posse), trocasPorMin: J.cond.posse.length / Math.max(1e-9, posseMin), posses: J.cond.posse.length };
  // o apoio perto da bola sem o dono (fase 'com', ≤ 10 m) e, dele, com o dono conduzindo: a mesma conta das faixas (minutos
  // de jogador pelo pt/seg)
  const apoioDe = Q => {
    const tk = Q.tk.reduce((a, b) => a + b, 0), mt = Q.mt.reduce((a, b) => a + b, 0), min = (J.pt ? tk / J.pt * J.seg : 0) / 60;
    return { min, tempoPct: Q.tk.map(x => 100 * x / Math.max(1, tk)), mpm: mt / Math.max(1e-9, min), hsrMpm: (Q.mt[3] + Q.mt[4]) / Math.max(1e-9, min) };
  };
  out.apoioPerto = apoioDe(J.apoio);
  out.apoioConduz = apoioDe(J.apoioCond);
  out.ramos = Object.entries(J.ramo).filter(([r, o]) => o.t > 0.01 * J.pt || r.startsWith('comBola')).sort((a, b) => b[1].t - a[1].t)
    .map(([r, o]) => ({ r, tempo: 100 * o.t / J.pt, mpm: o.m / (o.t / J.pt * J.seg / 60), hsr: 100 * o.hsr / o.t, andar: 100 * o.andar / o.t, perto: 100 * o.perto / o.t, fase: o.fase.map(x => 100 * x / o.t),
      // atacando (com + ganho), por distância à bola: [% do tempo de jogador atacando, m/min] em ≤ 10, 10–25 e > 25 m
      atq: o.atq ? [0, 1, 2].map(b => [100 * o.atq[2 * b] / J.pt, o.atq[2 * b + 1] / Math.max(1e-9, o.atq[2 * b] / J.pt * J.seg / 60)]) : null }));
  out.invPorMin = J.inv / minJ;
  // o vai e volta por ramo (no instante da inversão): a parte de cada ramo no total, por jogador-min
  out.invRamo = Object.entries(J.invRamo).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => [r, n / minJ]);
  out.minJogador = minJ;
  return out;
}

export function imprimir(nome, r) {
  const L = [];
  const fx = a => a.map(x => f1(x)).join(' / ');
  L.push(`\n=== ${nome} ===  (${f1(r.minJogador, 0)} jogador-min com a bola rolando)`);
  L.push(`  TOTAL: ${f1(r.total.mpm, 0)} m/min · atacando ${f1(r.atacando.mpm, 0)} · defendendo ${f1(r.defendendo.mpm, 0)} · v média ${f1(r.total.vMed * 3.6)} km/h · tempo andar/trote/corrida/alta/disparada ${fx(r.total.tempoPct)} %`);
  L.push(`         alta+disparada: ${f1(r.total.hsrMpm)} m/min (${f1(r.total.hsrDistPct)}% da distância) · disparada ${f1(r.total.sprMpm)} m/min`);
  L.push(`  NA TELA do celular (${f1(100 * r.tela[1].min / r.total.min, 0)}% do tempo de jogador): ${f1(r.tela[1].mpm, 0)} m/min · tempo ${fx(r.tela[1].tempoPct)} % · alta+disp ${f1(r.tela[1].hsrMpm)} m/min`);
  for (const f of FASES) {
    const qq = r.fase[f];
    L.push(`  ${NOMES_FASE[f]} (${f1(100 * qq.min / r.total.min, 0)}% do tempo): ${f1(qq.mpm, 0)} m/min · tempo ${fx(qq.tempoPct)} % · alta+disp ${f1(qq.hsrMpm)} m/min (${f1(qq.hsrDistPct)}%)`);
    L.push(`      por distância à bola ${NOMES_DBIN.map((n, b) => `${n}: ${f1(qq.dist[b].mpm, 0)} m/min, andar ${f1(qq.dist[b].tempoPct[0], 0)}%, alta+disp ${f1(qq.dist[b].hsrMpm)}`).join(' · ')} · NA TELA: ${f1(qq.tela[1].mpm, 0)} m/min, andar ${f1(qq.tela[1].tempoPct[0], 0)}%, alta+disp ${f1(qq.tela[1].hsrMpm)}`);
  }
  L.push(`  disparadas (> 25,2 km/h ≥ 1 s): ${f1(r.sprPorMin, 2)}/min · na tela ${f1(100 * r.sprTela, 0)}% · por fase sem/com/perda/ganho ${r.sprFase.join('/')} · duração mediana ${f1(r.sprDurMed, 2)} s`);
  L.push(`  esforços de alta (> 19,8 km/h ≥ 1 s): ${f1(r.hsrPorMin, 2)}/min · por fase ${r.hsrFase.join('/')}`);
  L.push(`  pico de cada disparada / máxima: mediana ${f1(100 * r.picoMed, 0)}% · ≥ 90%: ${f1(100 * r.pico90, 0)}% · ≥ 95%: ${f1(100 * r.pico95, 0)}% das disparadas`);
  L.push(`  disparadas por ramo ao começar: ${r.sprRamo.map(([a, b]) => `${a} ${b}`).join(', ')}`);
  const P = r.perda;
  L.push(`  PERDA (${P.n}): os 3 mais perto da bola — útil ≥ 14,4 km/h em ${fx(P.r4)} s · ≥ 19,8 km/h em ${fx(P.r55)} s (nunca em 5 s: ${P.nunca55.map(x => f1(100 * x, 0)).join('/')}%)`);
  const G = r.ganho;
  L.push(`  GANHO (${G.n}): ≥ 2 atacando o espaço a ≥ 19,8 km/h em ${f1(G.r, 2)} s (mediana; nunca em 5 s: ${f1(100 * G.nunca, 0)}%)`);
  const C = r.corr;
  L.push(`  CORRIDAS sem a bola à frente dela (≥ 19,8 km/h para a frente ≥ 1 s): ${f1(C.porMinPosse, 2)} por min de posse do time (${C.n} em ${f1(C.posseMin, 1)} min) · à área ${f1(100 * C.area, 0)}% · além da linha ${f1(100 * C.costas, 0)}% · duração ${f1(C.durMed, 2)} s`);
  L.push(`     por ramo no começo (quantas · % à área): ${C.ramo.map(([a, [n, ar]]) => `${a} ${n} · ${f1(100 * ar / Math.max(1, n), 0)}%`).join(', ')}`);
  const H = r.h1;
  L.push(`  1º HOMEM sobre o condutor: mediana ${f1(H.dMediana)} m · ≤ 2 m ${f1(100 * H.le2, 0)}% · ≤ 5 m ${f1(100 * H.le5, 0)}% · no domínio a ${f1(H.d0)} m, fecha ${f1(H.fech, 2)} m/s em 2 s`);
  L.push(`     aproximação por distância ${NOMES_1H.map((n, b) => `${n} m (${H.nBin[b]}): ${f1(H.aBin[b] * 3.6)} km/h [${H.rBin[b].map(([a, x]) => `${a} ${f1(100 * x, 0)}%`).join(', ')}]`).join(' · ')}`);
  L.push(`  APOIO PERTO (com a bola, ≤ 10 m dela, sem o dono): ${f1(r.apoioPerto.mpm, 0)} m/min · tempo ${fx(r.apoioPerto.tempoPct)} % · alta+disp ${f1(r.apoioPerto.hsrMpm)} m/min`);
  L.push(`     ...com o dono conduzindo (≥ 10,8 km/h; ${f1(100 * r.apoioConduz.min / Math.max(1e-9, r.apoioPerto.min), 0)}% desse tempo): ${f1(r.apoioConduz.mpm, 0)} m/min · tempo ${fx(r.apoioConduz.tempoPct)} % · alta+disp ${f1(r.apoioConduz.hsrMpm)} m/min`);
  L.push(`  CONDUTOR: ${f1(r.cond.vMed * 3.6)} km/h (mediana) · faixas ${fx(r.cond.faixas)} % · posse ${f1(r.cond.posseMed, 2)} s (mediana de ${r.cond.posses}) · ${f1(r.cond.trocasPorMin, 1)} trocas por min de posse`);
  L.push(`  vai e volta: ${f1(r.invPorMin, 2)} inversões (> 135° em 0,25–1 s) por jogador-min · por ramo ${r.invRamo.map(([a, x]) => `${a} ${f1(x, 2)}`).join(', ')}`);
  L.push(`  ramos (≥ 1%): ${r.ramos.map(o => `${o.r} ${f1(o.tempo, 0)}% (${f1(o.mpm, 0)} m/min, andando ${f1(o.andar, 0)}%, ≤ 10 m ${f1(o.perto, 0)}%)`).join(' · ')}`);
  L.push(`  atacando por ramo e distância (% do tempo de jogador · m/min em ≤ 10 / 10–25 / > 25 m): ${r.ramos.filter(o => o.atq && o.atq.some(x => x[0] >= 0.5)).map(o => `${o.r} ${o.atq.map(([p, v]) => `${f1(p, 1)}·${f1(v, 0)}`).join(' / ')}`).join(' · ')}`);
  return L.join('\n');
}

// ------------------------------------------------------------------------------------------- o filme do GOLAÇO

/**
 * Uma partida de 2 × `min` min (física em tempo real) na lógica da pasta `js`: contra o humano ROTEIRIZADO
 * (tools/lib/humano-roteiro.mjs, time 0, `perfil` agressivo/conduz/calmo/passivo) ou a IA × IA da demo (modo 'demo': a
 * entrada da IA pelo humano, `entradaDemoPartida`, com a marca `ia`). `sets` = ['CONST.caminho=valorJSON', ...] trocados
 * no config.js antes de carregar a lógica (triagem de calibração). Devolve a análise (por grupo) + os chutes (bola parada
 * fora; o pênalti à parte), os gols de cada time e as ROUBADAS sofridas por time (evento 'roubada' de um adversário com a
 * bola no pé do time — bote, dividida —, por minuto de bola rolando no pé dele: `roubadas`, `peMin`). A partida tem de
 * chegar ao apito final (erro se não chegar: o filme cortado mediria a partida pela metade sem aviso).
 */
export async function filmarPartida({ js, semente, modo = 'humano', perfil = 'agressivo', min = 4, sets = [] }) {
  const imp = f => import(pathToFileURL(path.join(js, f)).href);
  const C = await imp('config.js');
  for (const s of sets) {
    const chave = s.slice(0, s.indexOf('=')), partes = chave.split('.');
    let o = C[partes[0]];
    for (const p of partes.slice(1, -1)) o = o?.[p];
    if (!o || !(partes[partes.length - 1] in o)) throw new Error(`--set: ${chave} não existe`);
    o[partes[partes.length - 1]] = JSON.parse(s.slice(s.indexOf('=') + 1));
  }
  const P = await imp('partida.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'partida-medidas.mjs')).href);
  const H = await import(pathToFileURL(path.join(AQUI, 'humano-roteiro.mjs')).href);
  const HUM = modo === 'humano';
  const m = P.criarPartida({ semente, minutosPorTempo: min });
  const st = { s: (semente * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 };
  // (folga de 100 s além dos 2 tempos: os acréscimos, os replays nunca — a simulação não para; 3000 já cortou 60 passos do
  // fim no roteiro passivo)
  const NMAX = Math.round(2 * min * 3600 + 6000);
  const X = new Float32Array(NMAX * MAXS), Z = new Float32Array(NMAX * MAXS), VX = new Float32Array(NMAX * MAXS), VZ = new Float32Array(NMAX * MAXS);
  const PRES = new Uint8Array(NMAX * MAXS), RAMO = new Uint8Array(NMAX * MAXS);
  const BX = new Float32Array(NMAX), BZ = new Float32Array(NMAX), DONO = new Int16Array(NMAX), CTRL = new Int16Array(NMAX);
  const MAO = new Uint8Array(NMAX), ROL = new Uint8Array(NMAX), AT0 = new Int8Array(NMAX);
  const slotDe = new Map(), meta = [], ramos = ['—'], ramoCod = new Map([['—', 0]]);
  const chutes = [{ n: 0, dentro: 0, gols: 0 }, { n: 0, dentro: 0, gols: 0 }], gols = [0, 0], penaltis = [0, 0];
  let aberto = null; // o último chute (time, dentro) até o gol / a defesa / a bola fora
  // roubadas sofridas por time e passos com a bola rolando no pé de cada time; o time com a bola no pé (fica com a bola
  // solta enquanto ela rola, como o detector da revisão do D2)
  const roubadas = [0, 0], peTk = [0, 0];
  let donoAnt = -1;
  let N = 0;
  for (let i = 0; i < NMAX; i++) {
    const ent = HUM ? H.entradaRoteiro(m, M, C.BOTAO, st, perfil) : P.entradaDemoPartida(m);
    const ev = P.passoPartida(m, ent) ?? m.eventos ?? [];
    for (const e of ev) {
      if (e.tipo === 'roubada') {
        const rj = m.jogadores.find(o => o.id === e.id);
        if (rj && donoAnt >= 0 && rj.time !== donoAnt) roubadas[donoAnt]++;
        continue;
      }
      if (e.tipo === 'gol') {
        gols[e.time]++;
        if (aberto && aberto.time === e.time) chutes[e.time].gols++;
        aberto = null;
        continue;
      }
      if (e.tipo === 'fora' || e.tipo === 'defesa') { aberto = null; continue; }
      const j = e.id != null ? m.jogadores.find(o => o.id === e.id) : null;
      if (!j || !M.ehChute(m, e)) continue;
      // (a cobrança de pênalti fica de fora: a pergunta é de onde a IA chuta com a bola rolando)
      if (ev.some(x => x.tipo === 'cobranca' && x.parada === 'penalti')) { penaltis[j.time]++; aberto = null; continue; }
      const u = M.uDe(m, j.time, m.bola.p.x), w = M.wDe(m, j.time, m.bola.p.z);
      const dentro = u > M.MEIO_X - 16.5 && Math.abs(w) < M.AREA.w;
      chutes[j.time].n++; if (dentro) chutes[j.time].dentro++;
      aberto = { time: j.time };
    }
    if (m.partida.estado === 'fim') break;
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    {
      const pe = rolando && m.posse != null && m.naMao == null ? m.jogadores.find(o => o.id === m.posse) : null;
      if (pe) peTk[pe.time]++;
      donoAnt = pe ? pe.time : rolando ? donoAnt : -1;
    }
    ROL[N] = rolando ? 1 : 0;
    BX[N] = m.bola.p.x; BZ[N] = m.bola.p.z; AT0[N] = m.ataca[0];
    const idD = m.naMao ?? m.posse; MAO[N] = m.naMao != null ? 1 : 0;
    DONO[N] = -1; CTRL[N] = -1;
    for (const j of m.jogadores) {
      let s = slotDe.get(j.id);
      if (s === undefined) {
        s = meta.length; if (s >= MAXS) continue;
        slotDe.set(j.id, s); meta.push({ id: j.id, time: j.time, vArr: j.par.vArrancada, vTeto: j.par.vTeto, pos: j.posDetalhe });
      }
      const k = N * MAXS + s;
      X[k] = j.x; Z[k] = j.z; VX[k] = j.vx; VZ[k] = j.vz;
      PRES[k] = j.posicao === 'GOL' ? 2 : 1;
      // (o ramo da IA; com a bola, a opção do condutor; no apoio, os submodos do ia-ataque.js: a subida com o ataque e o
      // apoio curto em corrida firme)
      const ia = j.iaA, sub = ia && j.ia?.ramo?.startsWith('apoio') ? (ia.subindo && ia.subTick >= m.tick - 1 ? ':sobe' : ia.apoia && ia.apoiaTick >= m.tick - 1 ? ':apoia' : '') : '';
      const r = (j.id === idD && m.naMao == null && ia?.op && !(HUM && j.id === m.controlado[0]) ? 'comBola:' + ia.op + (ia.op === 'conduz' ? (ia.correr ? '+correr' : ia.curta ? '+curta' : '') : '') : j.ia?.ramo ? j.ia.ramo + sub : null) ?? '—';
      let c = ramoCod.get(r); if (c === undefined) { c = ramos.length; ramos.push(r); ramoCod.set(r, c); }
      RAMO[k] = c;
      if (j.id === idD) DONO[N] = s;
      if (HUM && j.id === m.controlado[0]) CTRL[N] = s;
    }
    N++;
  }
  if (m.partida.estado !== 'fim') throw new Error(`filmarPartida: a partida (semente ${semente}, ${perfil}) não chegou ao fim em ${NMAX} passos (estado ${m.partida.estado}, tick ${m.tick})`);
  const r = analisar({ N, fps: 60, X, Z, VX, VZ, PRES, RAMO, BX, BZ, DONO, CTRL, MAO, ROL, AT0, meta, ramos, HUM });
  return { ...r, HUM, perfil, semente, chutes, gols, penaltis, roubadas, peMin: peTk.map(x => x / 3600) };
}
