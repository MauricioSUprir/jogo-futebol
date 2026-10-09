// Patinação dos pés (seção 4): o tornozelo de um pé APOIADO não pode andar no mundo.
// Mede a velocidade média do tornozelo animado (anim.js, função pura) enquanto o pé está no
// apoio, em cenas de trote, corrida, arrancada, curva, corte e giro. Meta < 0,05 m/s.
//   node tools/teste-patinacao.mjs
import { criarMundo, passo } from '../js/sim.js';
import { pose, J, NJ } from '../js/anim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { media, percentil, fmt, tabelaTexto } from './lib/medidas.mjs';

function roteiros() {
  const r = [];
  r.push(['trote reta', t => ({ x: 0.5, z: 0, botoes: 0 })]);
  r.push(['corrida curva', t => ({ x: Math.cos(t * 0.52), z: Math.sin(t * 0.52), botoes: 0 })]);
  r.push(['arrancada reta', t => ({ x: 1, z: 0, botoes: BOTAO.CORRER })]);
  r.push(['arrancada curva', t => ({ x: Math.cos(t * 0.52), z: Math.sin(t * 0.52), botoes: BOTAO.CORRER })]);
  r.push(['zigue-zague', t => { const a = Math.floor(t / 1.2) % 2 ? 0.9 : -0.9; return { x: Math.cos(a), z: Math.sin(a), botoes: 0 }; }]);
  r.push(['giro 180°', t => ({ x: t < 3 ? 1 : -1, z: 0, botoes: 0 })]);
  r.push(['para e sai', t => (Math.floor(t / 2) % 2 ? { x: 0, z: 0, botoes: 0 } : { x: 0.8, z: 0.3, botoes: 0 })]);
  r.push(['condução curta', t => ({ x: Math.cos(t * 0.8) * 0.6, z: Math.sin(t * 0.8) * 0.6, botoes: BOTAO.MOD })]);
  return r;
}

const linhas = [['cena', 'vel. média no apoio (m/s)', 'p95', 'amostras']];
const todas = [];
for (const [nome, rot] of roteiros()) {
  const m = criarMundo({ semente: 3, jogadores: [{ id: 0, x: -20, z: 0, rumo: 0 }], bola: { x: -19.6, z: 0 }, posse: 0 });
  const j = m.jogadores[0];
  const info = {}; const out = new Float32Array(NJ * 3);
  let ant = null;
  const vs = [];
  for (let i = 0; i < 8 * 60; i++) {
    passo(m, { 0: rot(i * PASSO) });
    pose(j, m, out, info);
    const atual = info.pes.map(p => ({ ...p }));
    if (ant) {
      for (let p = 0; p < 2; p++) {
        if (atual[p].apoio && ant[p].apoio) {
          vs.push(Math.hypot(atual[p].x - ant[p].x, atual[p].z - ant[p].z) / PASSO);
        }
      }
    }
    ant = atual;
  }
  todas.push(...vs);
  linhas.push([nome, fmt(media(vs), 4), fmt(percentil(vs, 0.95), 4), vs.length]);
}
console.log(tabelaTexto(linhas));
const mt = media(todas);
const ok = mt < 0.05;
console.log(`\nPatinação média dos pés no apoio: ${fmt(mt, 4)} m/s (meta < 0,05) → ${ok ? 'PASSOU' : 'REPROVOU'}`);
process.exit(ok ? 0 : 1);
