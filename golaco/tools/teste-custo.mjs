// Custo da partida 11×11 (Etapa 3, plano 4.1): a RAZÃO partida ÷ treino de ataque no mesmo processo
// (robusto à máquina do CI), com o JIT aquecido. Treino e partida rodam em blocos alternados de 300
// passos (a carga da máquina pesa igual nos dois), 3 sementes × 1 min cada.
// Metas: média ≤ 2,5× e p95 ≤ 2,5× a do treino; nenhum passo da partida > 50 ms.
// Informativo (sem meta no CI): tempo absoluto por passo (meta da máquina de dev: média ≤ 0,6 ms,
// p95 ≤ 1,5 ms) e a pose dos 22.
//   node tools/teste-custo.mjs              (lógica do repositório)
//   node tools/teste-custo.mjs --antes      (a partida com a IA clássica do treino: iaClassica)
//   node tools/teste-custo.mjs --js <pasta> (outra cópia da lógica; sem partida.js → REPROVA)
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const ij = args.indexOf('--js');
const JS = ij >= 0 ? path.resolve(args[ij + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const ANTES = args.includes('--antes');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-custo: REPROVOU (${falhas})` : '\nteste-custo: PASSOU');
  process.exit(falhas ? 1 : 0);
}

if (!fs.existsSync(path.join(JS, 'partida.js'))) {
  reg('a partida 11×11 existe (criarPartida)', 'partida.js não existe nesta lógica', 'criarPartida', false);
  fim();
}
const S = await imp('sessao.js');
const P = await imp('partida.js');
const { pose, NJ } = await imp('anim.js');

const SEMENTES = [1, 2, 3], MIN = 1, BLOCO = 300, AQUECE = 600;
const N = Math.round(MIN * 3600);
const tt = [], tp = [], tpose = [];
let maxP = 0, maxT = 0;
const POSE = new Float32Array(NJ * 3);
for (const sem of SEMENTES) {
  const t = S.criarTreino({ modo: 'ataque', semente: sem });
  const p = P.criarPartida({ semente: sem, iaClassica: ANTES });
  for (let i = 0; i < AQUECE; i++) { S.passoTreino(t, S.entradaDemo(t)); P.passoPartida(p, P.entradaDemoPartida(p)); }
  for (let feitos = 0; feitos < N; feitos += BLOCO) {
    for (let i = 0; i < BLOCO; i++) {
      const a = performance.now();
      S.passoTreino(t, S.entradaDemo(t));
      const d = performance.now() - a;
      tt.push(d); if (d > maxT) maxT = d;
    }
    for (let i = 0; i < BLOCO; i++) {
      const a = performance.now();
      P.passoPartida(p, P.entradaDemoPartida(p));
      const d = performance.now() - a;
      tp.push(d); if (d > maxP) maxP = d;
      if (i % 10 === 0) {
        const b = performance.now();
        for (const j of p.jogadores) pose(j, p, POSE);
        tpose.push(performance.now() - b);
      }
    }
  }
}
const media = a => a.reduce((s, v) => s + v, 0) / a.length;
const pct = (a, q) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.round((s.length - 1) * q))]; };
const mt = media(tt), mp = media(tp), p95t = pct(tt, 0.95), p95p = pct(tp, 0.95);
console.log(`lógica: ${JS}${ANTES ? ' (--antes: IA clássica na partida)' : ''}\n${SEMENTES.length} sementes × ${MIN} min, blocos alternados de ${BLOCO} passos`);
console.log(`treino de ataque (10): média ${fmt(mt, 3)} ms · p95 ${fmt(p95t, 3)} · p99 ${fmt(pct(tt, 0.99), 3)} · máx ${fmt(maxT, 1)}`);
console.log(`partida 11×11 (22):    média ${fmt(mp, 3)} ms · p95 ${fmt(p95p, 3)} · p99 ${fmt(pct(tp, 0.99), 3)} · máx ${fmt(maxP, 1)} (informativo na máquina de dev: média ≤ 0,6, p95 ≤ 1,5)`);
console.log(`pose dos 22 por passo: média ${fmt(media(tpose), 3)} ms`);
reg('razão da média (partida ÷ treino)', `${fmt(mp / mt)}×`, '≤ 2,5×', mp / mt <= 2.5);
reg('razão do p95 (partida ÷ treino)', `${fmt(p95p / p95t)}×`, '≤ 2,5×', p95p / p95t <= 2.5);
reg('passo mais lento da partida', `${fmt(maxP, 1)} ms`, '≤ 50 ms', maxP <= 50);
fim();
