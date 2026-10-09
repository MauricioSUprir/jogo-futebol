// Resposta (seção 4): o corpo começa a mudar o MOVIMENTO em até 0,1 s depois do comando.
// Situações: parado, trote, corrida e arrancada, com e sem bola; pedidos de 45°, 90° e 150° para
// os dois lados; 24 fases da passada (0 a 46 ticks a mais de embalo). Pior caso de todos.
// Critério pelo movimento (não pelo tronco, que vira no 1º tick por construção):
//  - partindo do parado: velocidade na direção pedida ≥ 0,3 m/s;
//  - 45° e 90° em movimento: a direção da VELOCIDADE gira ≥ 2° para o lado pedido;
//  - 150° (inversão: freia na linha antes de virar): a velocidade na linha antiga cai ≥ 0,15 m/s
//    (ou, com a bola longe à frente sendo alcançada, a velocidade já gira para o lado pedido).
// O tempo até o tronco virar 2° aparece só como informação.
//   node tools/teste-resposta.mjs
import { criarMundo, passo, copiarMundo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { difAng } from '../js/mat.js';
import { tabelaTexto, fmt, DEG } from './lib/medidas.mjs';

const andares = [['parado', 0, 0], ['trote', 0.5, 0], ['corrida', 1, 0], ['arrancada', 1, BOTAO.CORRER]];
const angulos = [45, 90, 150];
const FASES = 24;
const linhas = [['situação', ...angulos.map(a => `${a}° com bola`), ...angulos.map(a => `${a}° sem bola`)]];
let pior = 0, piorTronco = 0, acima = 0, total = 0;
const casoPior = [];

/** Tempo (s) até o movimento responder ao pedido `alvo` (rad), a partir do mundo m. */
function medir(m, alvo, mag, bot, parado) {
  const j = m.jogadores[0];
  const s0 = Math.hypot(j.vx, j.vz);
  const v0x = j.vx, v0z = j.vz;
  const rv0 = Math.atan2(j.vz, j.vx), r0 = j.rumo;
  const mm = parado ? 0.6 : mag;
  const e = { x: Math.cos(alvo) * mm, z: Math.sin(alvo) * mm, botoes: bot };
  const inversao = Math.abs(alvo) > 2;
  let t = null, tt = null;
  for (let i = 0; i < 30 && (t === null || tt === null); i++) {
    passo(m, { 0: e });
    const ti = (i + 1) * PASSO;
    if (tt === null) { const d = difAng(r0, j.rumo); if (Math.sign(d) === Math.sign(alvo) && Math.abs(d) >= 2 / DEG) tt = ti; }
    if (t !== null) continue;
    if (parado) {
      if (j.vx * Math.cos(alvo) + j.vz * Math.sin(alvo) >= 0.3) t = ti;
    } else {
      // inversão: freou na linha; ou (qualquer pedido) a velocidade girou para o lado pedido
      if (inversao && (j.vx * v0x + j.vz * v0z) / s0 <= s0 - 0.15) t = ti;
      else if (Math.hypot(j.vx, j.vz) > 0.5) {
        const d = difAng(rv0, Math.atan2(j.vz, j.vx));
        if (Math.sign(d) === Math.sign(alvo) && Math.abs(d) >= 2 / DEG) t = ti;
      }
    }
  }
  return { t: t ?? 9, tt: tt ?? 9 };
}

for (const [nome, mag, bot] of andares) {
  const lin = [nome];
  const res = {};
  for (const comBola of [true, false]) {
    const piores = Object.fromEntries(angulos.map(a => [a, 0]));
    for (let f = 0; f < FASES; f++) {
      const m0 = criarMundo({ semente: 1 + f, jogadores: [{ id: 0, x: -20, z: 0, rumo: 0 }], bola: comBola ? { x: -19.6, z: 0 } : { x: 30, z: 30 }, posse: comBola ? 0 : null });
      for (let i = 0; i < 150 + f * 2; i++) passo(m0, { 0: mag > 0 ? { x: mag, z: 0, botoes: bot } : { x: 0, z: 0, botoes: 0 } });
      for (const a of angulos) {
        for (const lado of [1, -1]) {
          const m = copiarMundo(m0);
          const r = medir(m, (a / DEG) * lado, mag, bot, mag === 0);
          total++;
          if (r.t > 0.1 + 1e-9) { acima++; if (casoPior.length < 6) casoPior.push(`${nome} ${comBola ? 'com' : 'sem'} bola ${a}° lado ${lado} fase ${f}: ${fmt(r.t, 3)} s`); }
          piores[a] = Math.max(piores[a], r.t);
          piorTronco = Math.max(piorTronco, r.tt);
        }
      }
    }
    res[comBola] = piores;
    for (const a of angulos) pior = Math.max(pior, piores[a]);
  }
  for (const comBola of [true, false]) for (const a of angulos) lin.push(fmt(res[comBola][a], 3) + ' s');
  linhas.push(lin);
}
console.log('Pior tempo até o MOVIMENTO responder (24 fases da passada × 2 lados):');
console.log(tabelaTexto(linhas));
for (const c of casoPior) console.log('  - ' + c);
const ok = pior <= 0.1 + 1e-9;
console.log(`\nTronco começa a virar (informação): pior ${fmt(piorTronco, 3)} s`);
console.log(`Pior tempo até o movimento responder: ${fmt(pior, 3)} s em ${total} casos, ${acima} acima de 0,1 s (meta ≤ 0,1 s) → ${ok ? 'PASSOU' : 'REPROVOU'}`);
process.exit(ok ? 0 : 1);
