// Cortes e giros (seção 4):
//  - corte de 90°: a bola sai na direção nova (±25°) e o tronco aponta para ela (±30°) em ≤ 0,4 s
//    (trote, corrida e arrancada; para os dois lados);
//  - giro de 180° a 6 m/s: deriva lateral do corpo ≤ 0,25 m (e a bola continua com o jogador);
//  - puxada de sola (modificador + analógico para trás): a bola volta, fica a ≤ 1,0 m e o
//    jogador sai jogando no sentido novo.
//   node tools/teste-cortes.mjs
import { criarMundo, passo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { difAng } from '../js/mat.js';
import { DEG, fmt, tabelaTexto, media } from './lib/medidas.mjs';

function mundo(semente, attr = {}) {
  return criarMundo({ semente, jogadores: [{ id: 0, x: -30, z: 0, rumo: 0, attr }], bola: { x: -29.6, z: 0 }, posse: 0, log: true });
}

function embalar(m, e, segundos, alvoVel) {
  const j = m.jogadores[0];
  for (let i = 0; i < segundos * 60; i++) {
    passo(m, { 0: e });
    if (alvoVel && Math.hypot(j.vx, j.vz) >= alvoVel && i > 60) {
      // espera estar estável na velocidade
    }
  }
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
for (const [nome, a] of andares) {
  const tempos = [];
  let perdas = 0;
  for (const lado of [1, -1]) {
    for (let sem = 1; sem <= 6; sem++) {
      const m = mundo(sem * 11 + (lado > 0 ? 0 : 5));
      const j = m.jogadores[0];
      // embala em linha reta; o corte acontece num instante sorteado da passada
      const extra = (sem * 7) % 23;
      embalar(m, { x: a.mag, z: 0, botoes: a.botoes }, 3 + extra / 60);
      const novo = (lado * Math.PI) / 2;
      const e = { x: Math.cos(novo) * a.mag, z: Math.sin(novo) * a.mag, botoes: a.botoes };
      let t = null;
      for (let i = 0; i < 90; i++) {
        passo(m, { 0: e });
        const b = m.bola;
        const sb = Math.hypot(b.v.x, b.v.z);
        const ab = Math.atan2(b.v.z, b.v.x);
        const okBola = sb > 0.4 && Math.abs(difAng(ab, novo)) <= 25 / DEG;
        const okCorpo = Math.abs(difAng(j.rumo, novo)) <= 30 / DEG;
        if (okBola && okCorpo && t === null) t = (i + 1) * PASSO;
      }
      // segue mais 2 s na direção nova: não pode perder a bola
      for (let i = 0; i < 120; i++) passo(m, { 0: e });
      if (m.stats.perdas > 0 || m.posse !== 0) perdas++;
      tempos.push(t ?? 9);
    }
  }
  const pior = Math.max(...tempos);
  reg(`corte 90° (${nome}) — pior caso de 12`, `${fmt(pior)} s (méd ${fmt(media(tempos))})`, '≤ 0,40 s', pior <= 0.4);
  reg(`corte 90° (${nome}) — bola com o jogador depois`, `${12 - perdas}/12`, '12/12', perdas === 0);
}

// ---------------- giro de 180° a 6 m/s
{
  const derivas = [], dist = [];
  let perdas = 0, vel0 = [];
  for (let sem = 1; sem <= 8; sem++) {
    const m = mundo(100 + sem);
    const j = m.jogadores[0];
    // corrida (sem arrancada) chega a ~5,6 m/s; com arrancada leve passa de 6: usa arrancada e corta no instante em que passa de 6
    let i = 0;
    while (Math.hypot(j.vx, j.vz) < 6 && i < 600) { passo(m, { 0: { x: 1, z: 0, botoes: BOTAO.CORRER } }); i++; }
    for (let k = 0; k < (sem * 5) % 17; k++) passo(m, { 0: { x: 1, z: 0, botoes: BOTAO.CORRER } });
    vel0.push(Math.hypot(j.vx, j.vz));
    const z0 = j.z;
    let dmax = 0, bmax = 0;
    for (let k = 0; k < 150; k++) {
      passo(m, { 0: { x: -1, z: 0, botoes: 0 } });
      dmax = Math.max(dmax, Math.abs(j.z - z0));
      bmax = Math.max(bmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
    }
    derivas.push(dmax); dist.push(bmax);
    if (m.stats.perdas > 0 || m.posse !== 0 || j.vx > -2) perdas++;
  }
  const pior = Math.max(...derivas);
  reg('giro 180° a 6 m/s — deriva lateral do corpo (pior de 8)', `${fmt(pior, 3)} m (vel. inicial ${fmt(media(vel0))} m/s)`, '≤ 0,25 m', pior <= 0.25);
  reg('giro 180° — bola com o jogador e saindo no sentido novo', `${8 - perdas}/8 (bola até ${fmt(Math.max(...dist))} m)`, '8/8', perdas === 0);
}

// ---------------- puxada de sola
{
  let ok = 0, voltou = 0;
  const maxd = [], tv = [];
  for (let sem = 1; sem <= 8; sem++) {
    const m = mundo(200 + sem);
    const j = m.jogadores[0];
    embalar(m, { x: 0.6, z: 0, botoes: BOTAO.MOD }, 2.5 + sem / 60);
    let t = null, dmax = 0;
    for (let k = 0; k < 120; k++) {
      passo(m, { 0: { x: -0.6, z: 0, botoes: BOTAO.MOD } });
      dmax = Math.max(dmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
      if (t === null && m.bola.v.x < -0.3) t = (k + 1) * PASSO;
    }
    maxd.push(dmax); tv.push(t ?? 9);
    if (t !== null && t <= 0.4) voltou++;
    if (dmax <= 1.0 && m.posse === 0 && j.vx < -0.5) ok++;
  }
  reg('puxada de sola — bola volta em ≤ 0,4 s', `${voltou}/8 (pior ${fmt(Math.max(...tv))} s)`, '8/8', voltou === 8);
  reg('puxada de sola — bola a ≤ 1,0 m e sai jogando para trás', `${ok}/8 (bola até ${fmt(Math.max(...maxd))} m)`, '8/8', ok === 8);
}

console.log(tabelaTexto(linhas));
console.log(falhas.length ? `\nteste-cortes: REPROVOU (${falhas.length})` : '\nteste-cortes: PASSOU');
process.exit(falhas.length ? 1 : 0);
