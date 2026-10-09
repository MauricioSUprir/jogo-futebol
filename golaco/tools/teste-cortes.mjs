// Cortes e giros (seção 4):
//  - corte de 90°: a bola sai na direção nova (±25°) e o TRONCO aponta para ela (±30°) em ≤ 0,4 s,
//    em trote, corrida e arrancada, para os dois lados, varrendo a passada inteira (48 fases).
//    À parte (informação), o tempo até a VELOCIDADE do corpo entrar na direção nova (±30°) e o
//    número de apoios até completar a volta (±10°), comparado com a PESQUISA (Dos'Santos 2018:
//    "um 90° em plena corrida vira curva de 3–5 passos", pelo menos 3 apoios a ~7 m/s);
//  - giro de 180° a 6 m/s com gestos reais do analógico: virando pela borda em até 0,1 s (1–6
//    ticks, para os dois lados), passando pelo centro e 180° ± 5°, correndo a 0° e a 37°: deriva
//    do corpo para o lado da linha original ATÉ ele sair a 2 m/s no sentido novo ≤ 0,25 m.
//    Gestos pela borda mais lentos (0,13–0,2 s) pedem de verdade um pouco de lado: meta própria;
//  - puxada de sola (modificador + analógico para trás): um toque de SOLA, com o tronco ainda de
//    frente (±30°), bola a puxadaVel (±25%) voltando em ≤ 0,4 s, a ≤ 1,0 m do corpo, e o jogador
//    sai jogando no sentido novo. Controle: o mesmo comando SEM o modificador não faz puxada.
//   node tools/teste-cortes.mjs
import { criarMundo, passo, copiarMundo } from '../js/sim.js';
import { BOTAO, PASSO, CONDUCAO } from '../js/config.js';
import { difAng } from '../js/mat.js';
import { DEG, fmt, tabelaTexto, media } from './lib/medidas.mjs';

function mundo(semente, attr = {}) {
  return criarMundo({ semente, jogadores: [{ id: 0, x: -30, z: 0, rumo: 0, attr }], bola: { x: -29.6, z: 0 }, posse: 0, log: true });
}

const linhas = [['teste', 'medido', 'meta', 'resultado']];
const falhas = [];
function reg(nome, medido, meta, ok) {
  linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']);
  if (!ok) falhas.push(nome);
}

// ---------------- corte de 90°
const andares = [
  ['trote', { mag: 0.5, botoes: 0 }],
  ['corrida', { mag: 1, botoes: 0 }],
  ['arrancada', { mag: 1, botoes: BOTAO.CORRER }],
];
const FASES = 48;
for (const [nome, a] of andares) {
  const tempos = [], tVel = [], apoios = [];
  let perdas = 0, n = 0;
  for (let extra = 0; extra < FASES; extra++) {
    const m0 = mundo(11 + extra * 3);
    for (let i = 0; i < 180 + extra; i++) passo(m0, { 0: { x: a.mag, z: 0, botoes: a.botoes } });
    for (const lado of [1, -1]) {
      const m = copiarMundo(m0);
      const j = m.jogadores[0];
      const novo = (lado * Math.PI) / 2;
      const e = { x: Math.cos(novo) * a.mag, z: Math.sin(novo) * a.mag, botoes: a.botoes };
      const f0 = j.fase;
      let t = null, tv = null, ap = null;
      for (let i = 0; i < 120; i++) {
        passo(m, { 0: e });
        const b = m.bola;
        const sb = Math.hypot(b.v.x, b.v.z);
        const okBola = sb > 0.4 && Math.abs(difAng(Math.atan2(b.v.z, b.v.x), novo)) <= 25 / DEG;
        const okTronco = Math.abs(difAng(j.rumo, novo)) <= 30 / DEG;
        if (okBola && okTronco && t === null) t = (i + 1) * PASSO;
        const sv = Math.hypot(j.vx, j.vz), dv = Math.abs(difAng(Math.atan2(j.vz, j.vx), novo));
        if (okBola && sv > 0.5 && dv <= 30 / DEG && tv === null) tv = (i + 1) * PASSO;
        if (sv > 0.5 && dv <= 10 / DEG && ap === null) ap = Math.floor(j.fase) - Math.floor(f0);
      }
      // segue mais 2 s na direção nova: não pode perder a bola
      for (let i = 0; i < 120; i++) passo(m, { 0: e });
      if (m.stats.perdas > 0 || m.posse !== 0) perdas++;
      tempos.push(t ?? 9); tVel.push(tv ?? 9); apoios.push(ap ?? 99);
      n++;
    }
  }
  const pior = Math.max(...tempos);
  reg(`corte 90° (${nome}) — bola + TRONCO na direção nova, pior de ${n}`, `${fmt(pior)} s (méd ${fmt(media(tempos))})`, '≤ 0,40 s', pior <= 0.4 + 1e-9);
  reg(`corte 90° (${nome}) — bola com o jogador depois`, `${n - perdas}/${n}`, `${n}/${n}`, perdas === 0);
  linhas.push([`  (informação) corte 90° (${nome}) — VELOCIDADE do corpo a ±30° da direção nova`, `${fmt(Math.min(...tVel))}–${fmt(Math.max(...tVel))} s (méd ${fmt(media(tVel))})`, '—', '']);
  if (nome !== 'trote') {
    // a PESQUISA (Dos'Santos 2018, sem bola) pede ≥ 3 apoios (curva de 3–5 passos) a ~7 m/s.
    // Fica como informação: deixar o corpo mais lento para virar é decisão do dono (o
    // movimento foi aprovado como está) — ver o relatório.
    const minAp = Math.min(...apoios), maxAp = Math.max(...apoios);
    linhas.push([`  (informação) corte 90° (${nome}) — apoios até a velocidade completar a volta (±10°)`, `${minAp}–${maxAp} (méd ${fmt(media(apoios), 1)})`, 'PESQUISA: 3–5', minAp >= 3 ? 'dentro' : 'abaixo']);
  }
}

// ---------------- giro de 180° a 6 m/s
function giro(rumo, gesto, sem) {
  const hx = Math.cos(rumo), hz = Math.sin(rumo);
  const m = criarMundo({ semente: 100 + sem, jogadores: [{ id: 0, x: -30, z: 0, rumo }], bola: { x: -30 + hx * 0.4, z: hz * 0.4 }, posse: 0 });
  const j = m.jogadores[0];
  let i = 0;
  while (Math.hypot(j.vx, j.vz) < 6 && i < 600) { passo(m, { 0: { x: hx, z: hz, botoes: BOTAO.CORRER } }); i++; }
  for (let k = 0; k < (sem * 5) % 17; k++) passo(m, { 0: { x: hx, z: hz, botoes: BOTAO.CORRER } });
  const v0 = Math.hypot(j.vx, j.vz);
  const x0 = j.x, z0 = j.z;
  let d = 0, virou = false, bmax = 0;
  for (let k = 0; k < 150; k++) {
    passo(m, { 0: gesto(k, rumo) });
    const ex = j.x - x0, ez = j.z - z0;
    if (!virou) d = Math.max(d, Math.abs(-ex * hz + ez * hx));
    if (-(j.vx * hx + j.vz * hz) >= 2) virou = true;
    bmax = Math.max(bmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
  }
  return { d, virou, ok: virou && m.stats.perdas === 0 && m.posse === 0, bmax, v0 };
}
const borda = (n, lado) => (k, r) => { const a = r + lado * Math.PI * Math.min(1, (k + 1) / n); return { x: Math.cos(a), z: Math.sin(a), botoes: 0 }; };
const centro = n => (k, r) => (k < n ? { x: 0, z: 0, botoes: 0 } : { x: Math.cos(r + Math.PI), z: Math.sin(r + Math.PI), botoes: 0 });
const erro = e => (k, r) => ({ x: Math.cos(r + Math.PI + e), z: Math.sin(r + Math.PI + e), botoes: 0 });
function bateriaGiro(gestos) {
  let pior = 0, piorNome = '', casos = 0, ruins = 0, bmax = 0;
  const vs = [];
  for (const [nome, g] of gestos) for (const rumo of [0, 37 / DEG]) for (let s = 1; s <= 8; s++) {
    const r = giro(rumo, g, s);
    casos++; vs.push(r.v0); bmax = Math.max(bmax, r.bmax);
    if (!r.ok) ruins++;
    if (r.d > pior) { pior = r.d; piorNome = `${nome}, rumo ${fmt(rumo * DEG, 0)}°`; }
  }
  return { pior, piorNome, casos, ruins, bmax, v: media(vs) };
}
{
  const rapidos = [];
  for (const n of [1, 2, 4, 6]) for (const l of [1, -1]) rapidos.push([`borda em ${n} tick(s) ${l > 0 ? '+' : '−'}`, borda(n, l)]);
  for (const n of [1, 3, 6]) rapidos.push([`centro por ${n} tick(s)`, centro(n)]);
  for (const e of [5, -5]) rapidos.push([`180° ${e > 0 ? '+' : '−'}5°`, erro(e / DEG)]);
  const r = bateriaGiro(rapidos);
  reg(`giro 180° a 6 m/s — deriva até sair no sentido novo (gesto ≤ 0,1 s, ${r.casos} casos)`, `${fmt(r.pior, 3)} m (${r.piorNome}; vel. ${fmt(r.v)} m/s)`, '≤ 0,25 m', r.pior <= 0.25);
  reg('giro 180° — bola com o jogador e saindo no sentido novo', `${r.casos - r.ruins}/${r.casos} (bola até ${fmt(r.bmax)} m)`, `${r.casos}/${r.casos}`, r.ruins === 0);
  const lentos = [];
  for (const n of [8, 12]) for (const l of [1, -1]) lentos.push([`borda em ${n} ticks ${l > 0 ? '+' : '−'}`, borda(n, l)]);
  const rl = bateriaGiro(lentos);
  // o analógico ficou ~0,05–0,1 s apontando para o lado: parte da deriva foi pedida
  reg(`giro 180° — gesto pela borda em 0,13–0,2 s (pede um pouco de lado; ${rl.casos} casos)`, `${fmt(rl.pior, 3)} m (${rl.piorNome})`, '≤ 0,50 m', rl.pior <= 0.5);
}

// ---------------- puxada de sola
function puxada(sem, mod) {
  const m = mundo(200 + sem);
  const j = m.jogadores[0];
  const bot = mod ? BOTAO.MOD : 0;
  for (let i = 0; i < (2.5 + sem / 60) * 60; i++) passo(m, { 0: { x: 0.6, z: 0, botoes: bot } });
  const r0 = j.rumo, n0 = m.log.length;
  let t = null, dmax = 0;
  for (let k = 0; k < 120; k++) {
    passo(m, { 0: { x: -0.6, z: 0, botoes: bot } });
    dmax = Math.max(dmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
    if (t === null && m.bola.v.x < -0.3) t = (k + 1) * PASSO;
  }
  const sola = m.log.slice(n0).find(l => l.tipo === 'sola');
  return {
    sola: !!sola,
    tronco: sola ? Math.abs(difAng(r0, sola.rumo)) * DEG : NaN,
    vOk: sola ? Math.abs(sola.v - CONDUCAO.puxadaVel) <= 0.25 * CONDUCAO.puxadaVel : false,
    voltou: t !== null && t <= 0.4,
    t: t ?? 9,
    dmax,
    saiu: dmax <= 1.0 && m.posse === 0 && j.vx < -0.5,
  };
}
{
  const com = [], sem = [];
  for (let s = 1; s <= 8; s++) { com.push(puxada(s, true)); sem.push(puxada(s, false)); }
  const nSola = com.filter(r => r.sola).length;
  const nTronco = com.filter(r => r.sola && r.tronco < 30).length;
  const nVel = com.filter(r => r.vOk).length;
  reg('puxada de sola — toque de SOLA com o tronco ainda de frente (±30°)', `${nTronco}/8 (sola em ${nSola}/8; tronco até ${fmt(Math.max(...com.map(r => r.tronco)), 0)}°)`, '8/8', nTronco === 8);
  reg(`puxada de sola — bola a ${fmt(CONDUCAO.puxadaVel, 1)} m/s ±25% voltando em ≤ 0,4 s`, `${Math.min(nVel, com.filter(r => r.voltou).length)}/8 (pior ${fmt(Math.max(...com.map(r => r.t)))} s)`, '8/8', nVel === 8 && com.every(r => r.voltou));
  reg('puxada de sola — bola a ≤ 1,0 m e sai jogando para trás', `${com.filter(r => r.saiu).length}/8 (bola até ${fmt(Math.max(...com.map(r => r.dmax)))} m)`, '8/8', com.every(r => r.saiu));
  const semSola = sem.filter(r => r.sola).length;
  reg('controle: o mesmo comando SEM o modificador não faz puxada', `${semSola}/8 com toque de sola`, '0/8', semSola === 0);
}

console.log(tabelaTexto(linhas));
console.log(falhas.length ? `\nteste-cortes: REPROVOU (${falhas.length})` : '\nteste-cortes: PASSOU');
process.exit(falhas.length ? 1 : 0);
