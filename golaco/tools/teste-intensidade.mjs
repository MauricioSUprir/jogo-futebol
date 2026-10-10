// teste-intensidade (Etapa 3, Parte 3): intensidade e sanidade da partida 11×11, IA × IA (a IA joga
// também pelo controlado do time 0: entradaDemoPartida), partidas inteiras (2 tempos de 4 min reais).
//  - metros por minuto por jogador de linha com a bola rolando (Jerome 2024, 1083 partidas):
//      jogo organizado 120–160 · lances rápidos 180–220 (ataque rápido 196, defesa rápida 208).
//    Lance rápido = depois de o time recuperar a bola em jogo corrido, a bola avança ≥ 15 m para o
//    gol adversário em até 6 s: conta dos 0 s da recuperação até 1 s depois de a bola parar de avançar
//    (no máximo 10 s), para os 20 de linha (o ataque rápido de um é a defesa rápida do outro).
//    A contrapressão é medida pela Parte 2 (teste-pressao).
//  - tempo por faixa de velocidade com a bola rolando, ± 8 pontos da real (Metrica): parado 0,9 ·
//    andando 48,5 · trotando 37,8 · correndo 9,6 · alta 2,7 · sprint 0,6 (limites 0,2/2/4/5,5/7 m/s).
//  - sanidade por partida (faixas do plano 5.1; a calibração fina é da Etapa 4, com 144+ partidas):
//      chutes 10–35 · gols 1,5–4,5 (média) · conversão 6–20% · ≥ 55% dos chutes de dentro da área ·
//      passe certo 70–90% (o próximo a ter a bola é do time de quem passou; bola fora = errado) ·
//      posse 35–65% para cada time (soma das partidas).
//   node tools/teste-intensidade.mjs              (lógica do repositório; 8 partidas)
//   node tools/teste-intensidade.mjs --antes      (a mesma partida com a IA de hoje: criarPartida({iaClassica: true}))
//   node tools/teste-intensidade.mjs --js <pasta> (outra cópia da lógica; sem partida.js → REPROVA)
//   SEMENTES=20 node tools/teste-intensidade.mjs  · --sem0 101 (primeira semente)
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
const MIN_TEMPO = 4; // minutos reais por tempo (o padrão da partida)
const REAL = [0.9, 48.5, 37.8, 9.6, 2.7, 0.6];
const NOMES = ['parado', 'andando', 'trotando', 'correndo', 'alta', 'sprint'];

// ------------------------------------------------------------------ uma partida (processo filho)
async function coletar(sem) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const R = {
    chutes: 0, chutesArea: 0, gols: 0, passes: 0, passesOk: 0, posse: [0, 0], faixas: [0, 0, 0, 0, 0, 0], tJog: 0,
    dOrg: 0, tOrg: 0, dRap: 0, tRap: 0,
  };
  const m = P.criarPartida({ semente: sem, iaClassica: ANTES, minutosPorTempo: MIN_TEMPO });
  const N = Math.round(2 * MIN_TEMPO * 3600 + 1200);
  let passe = null;                         // {time} — passe em aberto (quem é o próximo dono?)
  let tAnt = null, rec = null, rapAte = -1; // posse: time anterior, recuperação {tick, u0, uMax, tMax}
  for (let i = 0; i < N; i++) {
    const parada = m.parada && !m.parada.rolou;
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    for (const e of ev) {
      if (e.tipo === 'gol') R.gols++;
      if (e.tipo === 'chute') {
        R.chutes++; passe = null;
        const j = m.jogadores.find(o => o.id === e.id);
        if (j && M.uDe(m, j.time, m.bola.p.x) > 52.5 - 16.5 && Math.abs(M.wDe(m, j.time, m.bola.p.z)) < 20.16) R.chutesArea++;
      } else if (e.tipo === 'passe') {
        const j = m.jogadores.find(o => o.id === e.id);
        if (j && j.posicao !== 'GOL') { R.passes++; passe = { time: j.time }; } else passe = null;
      }
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (!rolando) {
      if (m.foraDesde != null || m.golTick != null || m.partida.estado !== 'jogo') passe = null; // bola fora/gol: passe errado se ninguém recebeu
      rec = null; rapAte = -1;
      continue;
    }
    const dono = M.donoDaBola(m);
    if (dono && passe) { if (dono.time === passe.time) R.passesOk++; passe = null; }
    const tc = M.timeComBola(m);
    if (tc != null) R.posse[tc]++;
    // lance rápido: recuperação em jogo corrido (não na cobrança) e a bola avança ≥ 15 m em ≤ 6 s
    if (tc != null && tc !== tAnt) {
      rec = tAnt != null && !parada ? { tick: i, time: tc, u0: M.uDe(m, tc, m.bola.p.x), uMax: -Infinity, tMax: i } : null;
      tAnt = tc;
    }
    if (rec && tc === rec.time) {
      const u = M.uDe(m, tc, m.bola.p.x);
      if (u > rec.uMax + 0.5) { rec.uMax = u; rec.tMax = i; }
      if (rec.uMax - rec.u0 >= 15 && rec.tMax - rec.tick <= 360) rapAte = Math.min(rec.tMax + 60, rec.tick + 600);
    }
    const rap = rec && i >= rec.tick && i <= rapAte;
    for (const j of m.jogadores) {
      if (j.posicao === 'GOL') continue;
      const v = Math.hypot(j.vx, j.vz);
      R.faixas[M.faixaVel(v)]++; R.tJog++;
      if (rap) { R.dRap += v / 60; R.tRap++; } else { R.dOrg += v / 60; R.tOrg++; }
    }
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
  console.log(falhas ? `\nteste-intensidade: REPROVOU (${falhas})` : '\nteste-intensidade: PASSOU');
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
const pct = (a, b) => (b ? 100 * a / b : NaN);
console.log(`lógica: ${JS}${ANTES ? ' (--antes: IA clássica na partida)' : ''}\n${NS} partidas (sementes ${S0}–${S0 + NS - 1}) de 2 × ${MIN_TEMPO} min, ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const mOrg = soma('dOrg') / (soma('tOrg') / 3600), mRap = soma('dRap') / (soma('tRap') / 3600);
reg('m/min por jogador de linha, jogo organizado (Jerome 2024)', `${fmt(mOrg)}`, '120–160', mOrg >= 120 && mOrg <= 160);
reg('m/min por jogador de linha, lances rápidos', `${fmt(mRap)} (${fmt(pct(soma('tRap'), soma('tRap') + soma('tOrg')))}% do tempo)`, '180–220', mRap >= 180 && mRap <= 220);
const tJ = soma('tJog'), fx = NOMES.map((_, k) => pct(res.reduce((a, r) => a + r.faixas[k], 0), tJ));
const fxOk = fx.every((v, k) => Math.abs(v - REAL[k]) <= 8);
reg('tempo por faixa de velocidade (parado/andando/trotando/correndo/alta/sprint)', fx.map(v => fmt(v)).join(' / ') + '%', '± 8 pontos de 0,9/48,5/37,8/9,6/2,7/0,6', fxOk);
const ch = soma('chutes') / NS, gl = soma('gols') / NS, conv = pct(soma('gols'), soma('chutes')), area = pct(soma('chutesArea'), soma('chutes'));
reg('chutes por partida', `${fmt(ch)}`, '10–35', ch >= 10 && ch <= 35);
reg('gols por partida (média)', `${fmt(gl, 2)}`, '1,5–4,5', gl >= 1.5 && gl <= 4.5);
reg('conversão (gols ÷ chutes)', `${fmt(conv)}%`, '6–20%', conv >= 6 && conv <= 20);
reg('chutes de dentro da área', `${fmt(area)}%`, '≥ 55%', area >= 55);
const pc = pct(soma('passesOk'), soma('passes'));
reg('passe certo', `${fmt(pc)}% (${fmt(soma('passes') / NS, 0)} por partida)`, '70–90%', pc >= 70 && pc <= 90);
const p0 = res.reduce((a, r) => a + r.posse[0], 0), p1 = res.reduce((a, r) => a + r.posse[1], 0), po = pct(p0, p0 + p1);
reg('posse de cada time (soma das partidas)', `${fmt(po)}% × ${fmt(100 - po)}%`, '35–65%', po >= 35 && po <= 65);
fim();
