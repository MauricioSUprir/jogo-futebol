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
//  - (condução curta, 12/10: com o toque mais frequente o gesto do polegar cai mais vezes no tick do toque) o mesmo
//    giro com o gesto começando EXATAMENTE no tick do toque marcado (+0 e +1 tick): 8 gestos pela borda × 2 rumos ×
//    8 sementes × 2 = 256 casos, deriva ≤ 0,25 m e a bola com o jogador; o giro de 180° a 5 e 6 m/s pedido em cada
//    um dos 20 ticks depois de um toque (2 lados × 2 rumos): deriva ≤ 0,25 m e o maior trecho com a bola a mais de
//    1,2 m ≤ 0,6 s; e o corte embalado de 95–115° a 4,5–5,2 m/s em cada fase do ciclo: maior trecho ≤ 0,6 s, 0 perdas;
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

// ---------------- giro de 180° com o gesto no tick do toque marcado (condução curta, 12/10)
/**
 * Corre a 6 m/s até o toque marcado cair no tick +1+ad e faz o giro com o gesto. `por` = passos por quadro: o main.js
 * lê o analógico UMA vez por quadro, e a 30 qps (celular na Média) os 2 passos do quadro usam a mesma leitura — o 2º
 * vai marcado `repete` (como o main.js manda); `fq` = em que passo do quadro o gesto começa.
 */
function giroNoToque(rumo, gesto, sem, ad, por = 1, fq = 0) {
  const hx = Math.cos(rumo), hz = Math.sin(rumo);
  const m = criarMundo({ semente: 100 + sem, jogadores: [{ id: 0, x: -30, z: 0, rumo }], bola: { x: -30 + hx * 0.4, z: hz * 0.4 }, posse: 0 });
  const j = m.jogadores[0];
  let i = 0;
  while (Math.hypot(j.vx, j.vz) < 6 && i < 600) { passo(m, { 0: { x: hx, z: hz, botoes: BOTAO.CORRER } }); i++; }
  let g = 0;
  while (g++ < 120 && !(j.cond.toque && j.cond.toque.tick === m.tick + 1 + ad)) passo(m, { 0: { x: hx, z: hz, botoes: BOTAO.CORRER } });
  const x0 = j.x, z0 = j.z;
  let d = 0, virou = false, bmax = 0;
  for (let k = 0; k < 150; k++) {
    const q = (k + fq) % por; // passo dentro do quadro: 0 = leitura nova do analógico
    passo(m, { 0: q === 0 ? gesto(k, rumo) : { ...gesto(k - q, rumo), repete: true } });
    if (!virou) d = Math.max(d, Math.abs(-(j.x - x0) * hz + (j.z - z0) * hx));
    if (-(j.vx * hx + j.vz * hz) >= 2) virou = true;
    bmax = Math.max(bmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
  }
  return { d, ok: virou && m.stats.perdas === 0 && m.posse === 0, bmax };
}
{
  let pior = 0, piorNome = '', casos = 0, ruins = 0, bmax = 0;
  for (const n of [1, 2, 4, 6]) for (const l of [1, -1]) for (const rg of [0, 37]) for (let sem = 1; sem <= 8; sem++) for (const ad of [0, 1]) {
    const r = giroNoToque(rg / DEG, borda(n, l), sem, ad);
    casos++; bmax = Math.max(bmax, r.bmax);
    if (!r.ok) ruins++;
    if (r.d > pior) { pior = r.d; piorNome = `borda em ${n} ${l > 0 ? '+' : '−'}, rumo ${rg}°, semente ${sem}, toque +${ad}`; }
  }
  reg(`giro 180° a 6 m/s com o gesto no tick do toque marcado — deriva (${casos} casos)`, `${fmt(pior, 3)} m (${piorNome})`, '≤ 0,25 m', pior <= 0.25);
  reg('giro 180° com o gesto no tick do toque — bola com o jogador e saindo no sentido novo', `${casos - ruins}/${casos} (bola até ${fmt(bmax)} m)`, `${casos}/${casos}`, ruins === 0);
}
{
  // o mesmo com a entrada lida a 30 qps (contraprova da condução curta, 13/10): o celular na Média roda a 30–48 qps e o
  // main.js lê o analógico uma vez por quadro — o 2º passo do quadro repete a leitura do meio do gesto. Sem saber que é
  // a MESMA leitura, o toque que esperou 1 tick saía na direção do meio do gesto (4,2 m de deriva, como antes da
  // espera; a main dava 4,09 m)
  let pior = 0, piorNome = '', casos = 0, ruins = 0, bmax = 0;
  for (const n of [1, 2, 4, 6]) for (const l of [1, -1]) for (const rg of [0, 37]) for (let sem = 1; sem <= 4; sem++) for (const ad of [0, 1]) for (let fq = 0; fq < 2; fq++) {
    const r = giroNoToque(rg / DEG, borda(n, l), sem, ad, 2, fq);
    casos++; bmax = Math.max(bmax, r.bmax);
    if (!r.ok) ruins++;
    if (r.d > pior) { pior = r.d; piorNome = `borda em ${n} ${l > 0 ? '+' : '−'}, rumo ${rg}°, semente ${sem}, toque +${ad}, passo ${fq} do quadro`; }
  }
  reg(`giro 180° a 6 m/s com o gesto no tick do toque, entrada a 30 qps — deriva (${casos} casos)`, `${fmt(pior, 3)} m (${piorNome})`, '≤ 0,25 m', pior <= 0.25);
  reg('giro 180° com o gesto no tick do toque, entrada a 30 qps — bola com o jogador', `${casos - ruins}/${casos} (bola até ${fmt(bmax)} m)`, `${casos}/${casos}`, ruins === 0);
}

/**
 * Embalado (CORRER até 6 m/s, ou o analógico `mag` até `v` m/s), espera um toque e mais `fase` ticks e pede o gesto:
 * mede a deriva (até sair a 2 m/s no sentido novo), o maior trecho com a bola a mais de 1,2 m e a perda.
 */
function depoisDoToque({ rumo, v, mag, correr, fase, gesto, sem, ticks = 150 }) {
  const hx = Math.cos(rumo), hz = Math.sin(rumo);
  const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: -30, z: 0, rumo }], bola: { x: -30 + hx * 0.4, z: hz * 0.4 }, posse: 0 });
  const j = m.jogadores[0];
  const e0 = { x: hx * mag, z: hz * mag, botoes: correr ? BOTAO.CORRER : 0 };
  let i = 0;
  while (Math.hypot(j.vx, j.vz) < v && i < 600) { passo(m, { 0: e0 }); i++; }
  let g = 0;
  do { passo(m, { 0: e0 }); g++; } while (g < 120 && !m.eventos.some(e => e.tipo === 'toque'));
  for (let k = 0; k < fase; k++) passo(m, { 0: e0 });
  const x0 = j.x, z0 = j.z;
  let d = 0, virou = false, trecho = 0, pior = 0;
  for (let k = 0; k < ticks; k++) {
    passo(m, { 0: gesto(k, rumo) });
    if (!virou) d = Math.max(d, Math.abs(-(j.x - x0) * hz + (j.z - z0) * hx));
    if (-(j.vx * hx + j.vz * hz) >= 2) virou = true;
    trecho = Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z) > 1.2 ? trecho + PASSO : 0;
    if (trecho > pior) pior = trecho;
  }
  return { d, virou, pior, perdeu: m.stats.perdas > 0 || m.posse !== 0 };
}
{
  // giro de 180° pedido em cada um dos 20 ticks depois de um toque (gesto pela borda em 2 ticks)
  let pior = 0, piorNome = '', piorT = 0, piorTNome = '', casos = 0, ruins = 0;
  for (const [vv, mag, correr] of [[5, 0.9, false], [6, 1, true]]) for (const l of [1, -1]) for (const rg of [0, 37]) for (let fase = 0; fase < 20; fase++) {
    const r = depoisDoToque({ rumo: rg / DEG, v: vv, mag, correr, fase, gesto: borda(2, l), sem: 300 + fase });
    casos++;
    if (!r.virou || r.perdeu) ruins++;
    const nome = `${vv} m/s, ${l > 0 ? '+' : '−'}, rumo ${rg}°, ${fase} tick(s) depois do toque`;
    if (r.d > pior) { pior = r.d; piorNome = nome; }
    if (r.pior > piorT) { piorT = r.pior; piorTNome = nome; }
  }
  reg(`giro 180° em cada fase do ciclo (5 e 6 m/s, ${casos} casos) — deriva`, `${fmt(pior, 3)} m (${piorNome})`, '≤ 0,25 m', pior <= 0.25);
  reg('giro 180° em cada fase do ciclo — maior trecho com a bola a mais de 1,2 m · casos ruins', `${fmt(piorT)} s (${piorTNome || '—'}) · ${ruins}`, '≤ 0,6 s · 0', piorT <= 0.6 && ruins === 0);
}
{
  // corte embalado de 95–115° a 4,5–5,2 m/s em cada fase do ciclo
  let piorT = 0, piorNome = '', casos = 0, perdas = 0;
  for (const [vv, mag] of [[4.5, 0.8], [5.2, 0.92]]) for (const ang of [95, 105, 115]) for (const l of [1, -1]) for (let fase = 0; fase < 20; fase++) {
    const a = l * ang / DEG;
    const r = depoisDoToque({ rumo: 0, v: vv, mag, correr: false, fase, sem: 500 + fase, ticks: 180,
      gesto: (k, r0) => ({ x: Math.cos(r0 + a) * mag, z: Math.sin(r0 + a) * mag, botoes: 0 }) });
    casos++;
    if (r.perdeu) perdas++;
    if (r.pior > piorT) { piorT = r.pior; piorNome = `${vv} m/s, ${l > 0 ? '+' : '−'}${ang}°, ${fase} tick(s) depois do toque`; }
  }
  reg(`corte embalado de 95–115° a 4,5–5,2 m/s em cada fase (${casos} casos) — maior trecho com a bola a mais de 1,2 m · perdas`, `${fmt(piorT)} s (${piorNome || '—'}) · ${perdas}`, '≤ 0,6 s · 0', piorT <= 0.6 && perdas === 0);
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
