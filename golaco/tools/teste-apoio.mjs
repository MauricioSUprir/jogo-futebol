// teste-apoio (Etapa 3, Parte 3): o time com a bola na partida 11×11, IA × IA (a IA joga também
// pelo controlado do time 0: entradaDemoPartida). Mede com as MESMAS definições da análise da
// Metrica (tools/pesquisa/analise_metrica.py e tatica_metrica.py; PESQUISA-ETAPA3.md §5):
//  - companheiro mais perto do portador (mediana, m)                       8–12      (real 10,2)
//  - ≥ 2 linhas de passe livres (≤ 30 m, nenhum adversário a < 12° da linha) ≥ 75% do tempo (Steiner 2018)
//  - companheiros a ≤ 30 m à frente (< 60°) / de lado / atrás (> 120°)      30–45 / 30–45 / 20–35% (37/36/27)
//  - terço final (bola em u ≥ 17,5 com o time): de linha no campo adversário por corredor, média
//    lateral 0,7–1,5 cada · meio-espaço 1–2 cada · centro 3–5            (1,0 / 1,5 / 3,9 / 1,5 / 1,1)
//  - corridas que terminam nas costas da defesa (≥ 5,5 m/s por ≥ 1 s, começando com o time com a
//    bola, para a frente (< 45°), terminando além do último defensor de linha − 1 m e no campo
//    adversário), por time, normalizadas para uma partida de bola rolando (90' do relógio = 2 ×
//    PARTIDA.minutosPorTempo min reais)                                   15–40     (Metrica ~27; Ju 2023)
//  - alguém em posição de impedimento (% do tempo com a bola no pé)       8–25%     (Metrica 16%)
//  - no cruzamento de jogo corrido: de linha do time na área adversária   mediana 2–4, p90 ≤ 6 (Metrica 3, p90 5)
// Amostras a cada 0,1 s de bola rolando (sem parada por cobrar, sem bola fora, sem gol).
//   node tools/teste-apoio.mjs              (lógica do repositório; 8 partidas de 2 × 4 min)
//   node tools/teste-apoio.mjs --antes      (a mesma partida com a IA de hoje: criarPartida({iaClassica: true}))
//   node tools/teste-apoio.mjs --js <pasta> (outra cópia da lógica; sem partida.js → REPROVA)
//   SEMENTES=20 node tools/teste-apoio.mjs  · --sem0 101 (primeira semente; rodadas com outro conjunto)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const ANTES = args.includes('--antes');
const MIN_TEMPO = 4; // partida inteira: 2 tempos de 4 min reais (o padrão)

// ------------------------------------------------------------------ coleta de uma semente (processo filho)
async function coletar(sem) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const R = {
    perto: [], livres2: 0, livresN: 0, frente: 0, lado: 0, atras: 0, corr: [0, 0, 0, 0, 0], corrN: 0,
    imp: 0, impN: 0, cruz: [], corridas: [0, 0], rolando: 0,
  };
  const m = P.criarPartida({ semente: sem, iaClassica: ANTES, minutosPorTempo: MIN_TEMPO });
  const corre = new Map(); // id → {t, x0, z0, lado}
  const N = Math.round(2 * MIN_TEMPO * 3600 + 1200);
  for (let i = 0; i < N; i++) {
    const parada = m.parada && !m.parada.rolou;
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    for (const e of ev) {
      if (e.tipo !== 'passe' || e.modo !== 'cruzamento' || parada) continue; // escanteio não conta
      const j = m.jogadores.find(o => o.id === e.id);
      if (j) R.cruz.push(M.naAreaAdversaria(m, j.time));
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (!rolando) { corre.clear(); continue; }
    R.rolando++;
    const tc = M.timeComBola(m);
    // corridas fortes (Metrica): ≥ 5,5 m/s por ≥ 1 s, começando com o time com a bola
    for (const j of m.jogadores) {
      if (j.posicao === 'GOL') continue;
      const v = Math.hypot(j.vx, j.vz);
      let c = corre.get(j.id);
      if (v >= 5.5) {
        if (!c) corre.set(j.id, { t: 1, x0: j.x, z0: j.z, com: tc === j.time, lado: m.ataca[j.time] });
        else c.t++;
        continue;
      }
      if (!c) continue;
      corre.delete(j.id);
      if (c.t < 60 || !c.com) continue;
      const du = (j.x - c.x0) * c.lado, dw = Math.abs(j.z - c.z0);
      if (Math.atan2(dw, du) >= Math.PI / 4) continue; // para a frente (< 45°)
      let ult = -Infinity;
      for (const o of m.jogadores) if (o.time !== j.time && o.posicao !== 'GOL') ult = Math.max(ult, o.x * c.lado);
      const uf = j.x * c.lado;
      if (uf > ult - 1 && uf > 0) R.corridas[j.time]++;
    }
    if (i % 6) continue;
    // terço final: de linha no campo adversário por corredor
    if (tc != null && M.tercoDaBola(m, tc) === 3) {
      R.corrN++;
      for (const o of M.deLinha(m, tc)) if (M.uDe(m, tc, o.x) > 0) R.corr[M.corredor(M.wDe(m, tc, o.z))]++;
    }
    const dono = M.donoDaBola(m);
    if (!dono || dono.posicao === 'GOL' || m.naMao != null) continue;
    const im = M.impedimento(m, dono.time); R.impN++; if (im.alguem) R.imp++;
    const p = M.portador(m);
    if (!p) continue;
    R.perto.push(M.companheiroMaisPerto(m, p));
    R.livresN++; if (M.linhasLivres(m, p) >= 2) R.livres2++;
    const st = M.setoresApoio(m, p); R.frente += st.frente; R.lado += st.lado; R.atras += st.atras;
  }
  return R;
}

if (args.includes('--filho')) {
  process.send(await coletar(+arg('--s', 1)));
  process.exit(0);
}

// ------------------------------------------------------------------ processo principal
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-apoio: REPROVOU (${falhas})` : '\nteste-apoio: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'partida.js'))) {
  reg('a partida 11×11 existe (criarPartida)', 'partida.js não existe nesta lógica', 'criarPartida', false);
  fim();
}
const NS = +(process.env.SEMENTES ?? 8), S0 = +arg('--sem0', 1);
const SEMENTES = Array.from({ length: NS }, (_, k) => S0 + k);
const t0 = Date.now();
const res = [];
let prox = 0;
const nPar = Math.max(1, Math.min(SEMENTES.length, os.availableParallelism?.() ?? os.cpus().length, 4));
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--s', String(s)]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
const soma = k => res.reduce((a, r) => a + r[k], 0);
const junta = k => res.flatMap(r => r[k]);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] : NaN; };
const pct = (a, b) => (b ? 100 * a / b : NaN);

console.log(`lógica: ${JS}${ANTES ? ' (--antes: IA clássica na partida)' : ''}\n${NS} partidas (sementes ${S0}–${S0 + NS - 1}) de 2 × ${MIN_TEMPO} min, ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const perto = med(junta('perto'));
reg('companheiro mais perto do portador (mediana)', `${fmt(perto)} m`, '8–12 m (real 10,2)', perto >= 8 && perto <= 12);
const liv = pct(soma('livres2'), soma('livresN'));
reg('≥ 2 linhas de passe livres (Steiner 2018)', `${fmt(liv)}% do tempo com portador`, '≥ 75%', liv >= 75);
const tot = soma('frente') + soma('lado') + soma('atras');
const fr = pct(soma('frente'), tot), la = pct(soma('lado'), tot), at = pct(soma('atras'), tot);
reg('companheiros a ≤ 30 m à frente / de lado / atrás', `${fmt(fr)} / ${fmt(la)} / ${fmt(at)}%`, '30–45 / 30–45 / 20–35% (real 37/36/27)',
  fr >= 30 && fr <= 45 && la >= 30 && la <= 45 && at >= 20 && at <= 35);
const cN = soma('corrN'), corr = [0, 1, 2, 3, 4].map(k => res.reduce((a, r) => a + r.corr[k], 0) / Math.max(1, cN));
const corrOk = corr[0] >= 0.7 && corr[0] <= 1.5 && corr[4] >= 0.7 && corr[4] <= 1.5 && corr[1] >= 1 && corr[1] <= 2 && corr[3] >= 1 && corr[3] <= 2 && corr[2] >= 3 && corr[2] <= 5;
reg('terço final: de linha no campo adversário por corredor (lat/meio/centro/meio/lat)', `${corr.map(v => fmt(v, 2)).join(' / ')} (${cN} amostras)`, '0,7–1,5 / 1–2 / 3–5 / 1–2 / 0,7–1,5', cN > 0 && corrOk);
const minRol = soma('rolando') / 3600, corridas = res.reduce((a, r) => a + r.corridas[0] + r.corridas[1], 0);
const porPartida = corridas / 2 / Math.max(minRol, 1e-9) * (2 * MIN_TEMPO);
reg('corridas nas costas da defesa, por time por partida de bola rolando', `${fmt(porPartida)} (${corridas} em ${fmt(minRol)} min rolando)`, '15–40 (Metrica ~27)', porPartida >= 15 && porPartida <= 40);
const imp = pct(soma('imp'), soma('impN'));
reg('alguém em posição de impedimento', `${fmt(imp)}% do tempo com a bola`, '8–25% (Metrica 16%)', imp >= 8 && imp <= 25);
const cz = junta('cruz'), czMed = med(cz), cz90 = quant(cz, 0.9);
reg('de linha na área adversária no cruzamento (jogo corrido)', `mediana ${fmt(czMed, 0)}, p90 ${fmt(cz90, 0)} (${cz.length} cruzamentos)`, 'mediana 2–4, p90 ≤ 6, ≥ 8 cruzamentos', cz.length >= 8 && czMed >= 2 && czMed <= 4 && cz90 <= 6);
fim();
