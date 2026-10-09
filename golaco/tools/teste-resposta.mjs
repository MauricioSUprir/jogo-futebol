// Resposta (seção 4): o corpo começa a virar em até 0,1 s depois do comando.
// Mede o tempo até o rumo do tronco mudar ≥ 2° na direção pedida, a partir de: parado, trote,
// corrida e arrancada, com pedidos de 45°, 90° e 150°, com e sem bola.
//   node tools/teste-resposta.mjs
import { criarMundo, passo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { difAng } from '../js/mat.js';
import { tabelaTexto, fmt, DEG } from './lib/medidas.mjs';

const andares = [['parado', 0, 0], ['trote', 0.5, 0], ['corrida', 1, 0], ['arrancada', 1, BOTAO.CORRER]];
const angulos = [45, 90, 150];
const linhas = [['situação', ...angulos.map(a => `${a}° com bola`), ...angulos.map(a => `${a}° sem bola`)]];
let pior = 0;
for (const [nome, mag, bot] of andares) {
  const lin = [nome];
  for (const comBola of [true, false]) {
    for (const a of angulos) {
      let piorCaso = 0;
      for (let sem = 1; sem <= 4; sem++) {
        const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: -20, z: 0, rumo: 0 }], bola: comBola ? { x: -19.6, z: 0 } : { x: 30, z: 30 }, posse: comBola ? 0 : null });
        const j = m.jogadores[0];
        for (let i = 0; i < 150 + sem * 7; i++) passo(m, { 0: mag > 0 ? { x: mag, z: 0, botoes: bot } : { x: 0, z: 0, botoes: 0 } });
        const r0 = j.rumo;
        const alvo = (a / DEG) * (sem % 2 ? 1 : -1);
        const mm = mag > 0 ? mag : 0.6;
        let t = null;
        for (let i = 0; i < 30; i++) {
          passo(m, { 0: { x: Math.cos(alvo) * mm, z: Math.sin(alvo) * mm, botoes: bot } });
          const d = difAng(r0, j.rumo);
          if (t === null && Math.sign(d) === Math.sign(alvo) && Math.abs(d) >= 2 / DEG) t = (i + 1) * PASSO;
        }
        piorCaso = Math.max(piorCaso, t ?? 9);
      }
      pior = Math.max(pior, piorCaso);
      lin.push(fmt(piorCaso, 3) + ' s');
    }
  }
  linhas.push(lin);
}
console.log(tabelaTexto(linhas));
const ok = pior <= 0.1;
console.log(`\nPior tempo até o tronco começar a virar: ${fmt(pior, 3)} s (meta ≤ 0,1 s) → ${ok ? 'PASSOU' : 'REPROVOU'}`);
process.exit(ok ? 0 : 1);
