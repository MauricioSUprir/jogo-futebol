// medir-corrida (informativo; pedido do dono de 17/10: "A IA NÃO CORRE, NEM PRA DEFENDER, NEM PRA ATACAR"): quanto a IA
// corre em cada fase, com a bola rolando, IA × IA e contra o humano ROTEIRIZADO (tools/lib/humano-roteiro.mjs, time 0).
// Por time medido (jogadores de linha, sem o controlado do humano):
//   - faixas de velocidade (parado-andando < 2 · trote 2–4 · corrida 4–5,5 · alta 5,5–7 · sprint ≥ 7 m/s) e m/min,
//     DEFENDENDO (o adversário com a bola no pé) e ATACANDO (o meu time com a bola no pé);
//   - defendendo: distância do 1º defensor ao condutor (mediana), quantos a ≤ 5 m dele (média), a velocidade do 1º
//     defensor (mediana) e o tempo do domínio do condutor até alguém chegar a ≤ 2 m dele (mediana, teto 6 s);
//   - atacando: velocidade do condutor (mediana · % ≥ 5,5 m/s) e quantos companheiros à frente da bola correm para o
//     gol a ≥ 5,5 m/s (média por instante: as corridas sem a bola).
//   node tools/medir-corrida.mjs [--sementes 8] [--js <pasta>] [--so ia|humano] [--roteiro agressivo|conduz] [--set X.y=v]
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { entradaRoteiro } from './lib/humano-roteiro.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 8);
const SO = arg('--so', null);
const ROTEIRO = arg('--roteiro', 'agressivo');
const FAIXAS = [2, 4, 5.5, 7];
const faixa = v => { let k = 0; while (k < FAIXAS.length && v >= FAIXAS[k]) k++; return k; };

function novoT() {
  return { def: { f: [0, 0, 0, 0, 0], d: 0, n: 0 }, ata: { f: [0, 0, 0, 0, 0], d: 0, n: 0 },
    d1: [], n5: 0, n5N: 0, v1: [], chega: [], vc: [], corr: 0, corrN: 0,
    botes: 0, roubadas: 0, posseH: [], minRol: 0 };
}

async function partida(sem, modo) {
  const C = await import(pathToFileURL(path.join(JS, 'config.js')).href);
  // --set CONST.caminho=valor (repetível, valor em JSON; o mesmo do painel-equilibrio): triagem de calibração
  for (const s of args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []))) {
    const chave = s.slice(0, s.indexOf('=')), partes = chave.split('.');
    let o = C[partes[0]];
    for (const p of partes.slice(1, -1)) o = o[p];
    if (!o || !(partes[partes.length - 1] in o)) throw new Error(`--set: ${chave} não existe`);
    o[partes[partes.length - 1]] = JSON.parse(s.slice(s.indexOf('=') + 1));
  }
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  const HUM = modo === 'humano';
  if (!HUM) m.humanos = [];
  const R = { 0: novoT(), 1: novoT() };
  const st = { s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 };
  const DT = 1 / 60;
  let cond = null; // {id, tick}
  const N = Math.round(8 * 3600 + 1200);
  for (let i = 0; i < N; i++) {
    const ent = HUM ? entradaRoteiro(m, M, C.BOTAO, st, ROTEIRO) : { x: 0, z: 0, botoes: 0 };
    const ev = P.passoPartida(m, ent) ?? m.eventos ?? [];
    if (m.partida.estado === 'fim') break;
    // botes e roubadas da IA contra quem tem a bola (por time que defende); com o humano, a posse do controlado
    for (const e of ev) {
      const q = e.id != null ? m.jogadores.find(o => o.id === e.id) : null;
      if (!q) continue;
      if (e.tipo === 'roubada') { R[q.time].roubadas++; R[q.time].botes++; }
      else if (e.tipo === 'boteErrado') R[q.time].botes++;
    }
    if (HUM) {
      const c = m.controlado[0];
      if (m.posse === c && m.partida.estado === 'jogo') { if (!st.pH) st.pH = m.tick; }
      else if (st.pH) { R[1].posseH.push((m.tick - st.pH) / 60); st.pH = 0; }
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (rolando) { R[0].minRol += 1 / 3600; R[1].minRol += 1 / 3600; }
    if (!rolando || m.naMao != null) { cond = null; continue; }
    const dono = m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
    if (!dono) { cond = null; continue; }
    if (!cond || cond.id !== dono.id) cond = { id: dono.id, tick: m.tick, chegou: false };
    const ctrl = HUM ? m.controlado[0] : -1;
    for (const t of [0, 1]) {
      const A = R[t], fase = dono.time === t ? A.ata : A.def, lado = m.ataca[t];
      let d1 = Infinity, v1 = 0, n5 = 0, corr = 0;
      for (const o of m.jogadores) {
        if (o.time !== t || o.posicao === 'GOL' || o.id === ctrl) continue;
        const v = Math.hypot(o.vx, o.vz);
        fase.f[faixa(v)]++; fase.d += v * DT; fase.n++;
        if (dono.time !== t) {
          const d = Math.hypot(o.x - dono.x, o.z - dono.z);
          if (d < d1) { d1 = d; v1 = v; }
          if (d <= 5) n5++;
        } else if (o !== dono && (o.x - m.bola.p.x) * lado > 0 && o.vx * lado >= 5.5) corr++;
      }
      if (dono.time !== t) {
        A.d1.push(d1); A.v1.push(v1); A.n5 += n5; A.n5N++;
        if (!cond.chegou && d1 <= 2) { cond.chegou = true; A.chega.push((m.tick - cond.tick) / 60); }
        else if (!cond.chegou && m.tick - cond.tick === 360) { cond.chegou = true; A.chega.push(6); }
      } else {
        A.vc.push(Math.hypot(dono.vx, dono.vz)); A.corr += corr; A.corrN++;
      }
    }
  }
  return R;
}

if (process.argv[2] === '--filho') {
  process.on('message', async ({ sem, modo }) => { process.send(await partida(sem, modo), () => process.exit(0)); });
} else {
  const modos = SO ? [SO] : ['ia', 'humano'];
  const tarefas = [];
  for (const modo of modos) for (let s = 1; s <= NSEM; s++) tarefas.push({ sem: s, modo });
  const res = { ia: [], humano: [] };
  const t0 = Date.now();
  const par = Math.max(1, Math.min(os.cpus().length, 4));
  let prox = 0;
  await new Promise(fim => {
    let vivos = 0;
    const lanca = () => {
      if (prox >= tarefas.length) { if (!vivos) fim(); return; }
      const tf = tarefas[prox++]; vivos++;
      const f = fork(fileURLToPath(import.meta.url), ['--filho', ...args]);
      f.on('message', r => res[tf.modo].push(r));
      f.on('exit', () => { vivos--; lanca(); });
      f.send(tf);
    };
    for (let k = 0; k < par; k++) lanca();
  });
  const med = v => { if (!v.length) return NaN; const s = v.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  const junta = (lista, t) => {
    const J = novoT();
    for (const R of lista) for (const tt of t) {
      const A = R[tt];
      for (const ph of ['def', 'ata']) { for (let k = 0; k < 5; k++) J[ph].f[k] += A[ph].f[k]; J[ph].d += A[ph].d; J[ph].n += A[ph].n; }
      J.d1.push(...A.d1); J.v1.push(...A.v1); J.chega.push(...A.chega); J.vc.push(...A.vc);
      J.n5 += A.n5; J.n5N += A.n5N; J.corr += A.corr; J.corrN += A.corrN;
      J.botes += A.botes; J.roubadas += A.roubadas; J.posseH.push(...A.posseH); J.minRol += A.minRol;
    }
    return J;
  };
  const linha = (nome, J) => {
    const pf = ph => J[ph].f.map(x => (100 * x / Math.max(1, J[ph].n)).toFixed(1)).join(' / ');
    const mm = ph => (J[ph].d / Math.max(1e-9, J[ph].n / 60) * 60).toFixed(0);
    const vcA = J.vc.length ? (100 * J.vc.filter(v => v >= 5.5).length / J.vc.length).toFixed(0) : '—';
    console.log(`\n${nome}`);
    console.log(`  defendendo: faixas ${pf('def')} % · ${mm('def')} m/min`);
    console.log(`  atacando:   faixas ${pf('ata')} % · ${mm('ata')} m/min`);
    console.log(`  defendendo: 1º defensor a ${med(J.d1).toFixed(1)} m do condutor (a ${med(J.v1).toFixed(1)} m/s) · ${(J.n5 / Math.max(1, J.n5N)).toFixed(2)} a ≤ 5 m · chega a ≤ 2 m em ${med(J.chega).toFixed(2)} s (mediana; ${J.chega.length} posses)`);
    console.log(`  defendendo: ${(J.botes / Math.max(1e-9, J.minRol)).toFixed(2)} botes e ${(J.roubadas / Math.max(1e-9, J.minRol)).toFixed(2)} roubadas por minuto de bola rolando${J.posseH.length ? ` · o humano fica com a bola ${med(J.posseH).toFixed(2)} s (mediana de ${J.posseH.length} posses)` : ''}`);
    console.log(`  atacando:   condutor a ${med(J.vc).toFixed(1)} m/s (≥ 5,5: ${vcA}%) · corridas sem a bola à frente dela ≥ 5,5 m/s: ${(J.corr / Math.max(1, J.corrN)).toFixed(2)} por instante`);
  };
  console.log(`lógica: ${JS} · ${NSEM} sementes por modo · roteiro ${ROTEIRO} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('faixas: < 2 · 2–4 · 4–5,5 · 5,5–7 · ≥ 7 m/s');
  if (res.ia.length) linha('IA × IA (os dois times)', junta(res.ia, [0, 1]));
  if (res.humano.length) { linha('contra o humano: a IA adversária (time 1)', junta(res.humano, [1])); linha('contra o humano: os companheiros do humano (time 0)', junta(res.humano, [0])); }
}
