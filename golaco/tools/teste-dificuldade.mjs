// teste-dificuldade (item 33 da FILA; dono, 17/10: "editar o TEMPO de jogo e a DIFICULDADE"; contrato "Tempo de jogo e
// dificuldade" no CONTRATOS.md; pesquisa em PESQUISA-DIFICULDADE.md). A dificuldade mexe SÓ na IA contra a pessoa (tatica.js
// nivelContra) e o Normal é o jogo de hoje, bit a bit.
//
// Metas:
//  D0 a tabela (config.js DIFICULDADE): os 4 níveis; o Normal vazio; toda chave de um nível na lista branca, existindo no
//     objeto que ela cobre com o mesmo significado, e os sentidos permitidos (le ≥ IA_DEFESA.livre.le, erro ≥ 1, reacaoGoleiro
//     ≥ GOLEIRO.reacao, engaja inteiro em [−10, +6]).
//  D1 o portão: com {dificuldade: 'lenda'}, nivelContra não-nulo em 0 passos na demo do Node (2 sementes × 2 tempos de 1 min,
//     com as cobranças), com dois humanos (o criarPartida não escreve o campo) e com o travado do Total Match expulso; contra o
//     roteiro, nivelContra(m, 0) sempre null e nivelContra(m, 1) não-nulo em ≥ 95% dos passos.
//  D2 o Normal = hoje: sem o campo × {dificuldade: 'normal'} × definirDificuldade(m, 'normal') no passo 900 — o MESMO hash a
//     cada 300 passos nos 4 roteiros e na demo (1 semente × 2 tempos de 1 min); 'dificuldade' in m falso; com --base <pasta
//     js>, igual à base também.
//  D3 a opção muda só contra a pessoa: cada nível fora do Normal dá na demo o MESMO hash do Normal a cada 300 passos (2
//     sementes × 2 tempos de 1 min) e, contra o roteiro, um hash DIFERENTE (4 roteiros × 1 semente); definirDificuldade(m,
//     'lenda') no passo 1800: o hash igual até ali e diferente depois.
//  D4 a ordem nos BOTES da IA por minuto de POSSE DA PESSOA (bola rolando com o time da pessoa): no ponto, Fácil ≤ 0,70× o
//     Normal, Difícil ≥ 1,15×, Lenda ≥ 1,30×; Fácil < Normal e Normal < Lenda PROVADOS; os degraus vizinhos na ordem e sem
//     provar o lado errado.
//  D5 a ordem nos CHUTES da IA por partida: Fácil ≤ 0,75×, Difícil ≥ 1,10× (≥ 1,15× no --completo), Lenda ≥ 1,25×; Fácil <
//     Normal e Normal < Lenda PROVADOS; os vizinhos na ordem e sem provar o lado errado.
//  D6 o inverso na pessoa: os chutes do time da pessoa, Fácil > Lenda PROVADO; os vizinhos sem provar o lado errado.
//  D7 (só --completo: 16 sementes × 4 roteiros = 64 partidas por nível; antes do merge) TODOS os degraus vizinhos PROVADOS nos
//     botes (D4) e nos chutes da IA (D5).
//  D8 guardas: as faltas da IA no Lenda ≤ 1,8× as do Normal (reprova quando PROVA acima); informativos por nível: pênaltis da
//     IA, gols IA × pessoa, posse da IA e o vai e volta do condutor da IA (a definição do lib/corrida-medidas.mjs: a direção
//     inverte > 135° em 0,25–1 s com ≥ 1,5 m/s nos dois instantes; 1 por jogador por segundo).
// "PROVADO": o bootstrap PAREADO e estratificado por roteiro (as mesmas sementes nos dois níveis comparados, reamostradas
// juntas, 2000×; unilateral 95%) — a razão A/B com o percentil 95 abaixo de 1 (A < B) ou o 5 acima de 1 (A > B). As partidas
// são de 2 × --min minutos (padrão 4), o time 0 = a pessoa roteirizada (tools/lib/humano-roteiro.mjs), o time 1 = a IA.
//
//   node tools/teste-dificuldade.mjs                       (CI: 4 níveis × 4 roteiros × 8 sementes = 128 partidas)
//   node tools/teste-dificuldade.mjs --completo            (16 sementes: 256 partidas; antes do merge)
//   node tools/teste-dificuldade.mjs --niveis normal,lenda --sementes 4 --sem0 1001 --par 2
//   node tools/teste-dificuldade.mjs --so portao           (só D0–D3, rápido; --so medida: só D0 e D4–D8, a triagem)
//   node tools/teste-dificuldade.mjs --set DIFICULDADE.lenda.boteIA.chancePorPasso=0.2   (triagem; antes de carregar a lógica)
//   node tools/teste-dificuldade.mjs --json saida.json [--normal-de outra.json]   (guarda as partidas; reaproveita as do Normal)
//   node tools/teste-dificuldade.mjs --completo --de s1-8.json,s9-16.json --so medida   (o D7 com partidas já jogadas)
//   node tools/teste-dificuldade.mjs --js <pasta>          (outra lógica: a base 8871b09d REPROVA)
//   node tools/teste-dificuldade.mjs --base <pasta js>     (D2 também contra a base)
// Sai com código 1 se alguma meta reprovar.
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const BASE_JS = arg('--base', null) ? path.resolve(arg('--base')) : null;
const COMPLETO = args.includes('--completo');
const NSEM = +arg('--sementes', COMPLETO ? 16 : 8);
const SEM0 = +arg('--sem0', 1);
const ROTS = arg('--roteiros', 'agressivo,conduz,calmo,passivo').split(',').filter(Boolean);
const NIVEIS = arg('--niveis', 'facil,normal,dificil,lenda').split(',').filter(Boolean);
const MIN = +arg('--min', 4);
const PAR = Math.max(1, Math.min(+arg('--par', 3), os.cpus().length || 1));
const SETS = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const JSON_OUT = arg('--json', null);
const NORMAL_DE = arg('--normal-de', null);
// (--de a.json,b.json: as partidas já jogadas — de qualquer nível — guardadas por --json; as que estão lá não rodam de novo)
const DE = (arg('--de', '') || '').split(',').filter(Boolean);
const SO = arg('--so', null);
const BOOT = 2000;
const CADA = 300;
const ORDEM = ['facil', 'normal', 'dificil', 'lenda'];
const NOME = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', lenda: 'Lenda' };

/** Aplica os --set no config.js (antes de importar o resto da lógica: os módulos juntam as tabelas na carga). */
async function carregar(js) {
  const imp = f => import(pathToFileURL(path.join(js, f)).href);
  const C = await imp('config.js');
  for (const s of SETS) {
    const chave = s.slice(0, s.indexOf('=')), partes = chave.split('.');
    let o = C[partes[0]];
    for (const q of partes.slice(1, -1)) { if (o && !(q in o) && partes[0] === 'DIFICULDADE') o[q] = {}; o = o?.[q]; }
    const ult = partes[partes.length - 1];
    if (!o || (!(ult in o) && partes[0] !== 'DIFICULDADE')) throw new Error(`--set: ${chave} não existe`);
    o[ult] = JSON.parse(s.slice(s.indexOf('=') + 1));
  }
  const P = await imp('partida.js'), S = await imp('sim.js'), T = await imp('tatica.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const H = await import(pathToFileURL(path.join(AQUI, 'lib/humano-roteiro.mjs')).href);
  return { C, P, S, T, M, H };
}

// --------------------------------------------------------------------------------------- tarefas (processo filho)
const estadoRot = sem => ({ s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 });

/** Uma partida de 2 × MIN min contra o roteiro `rot`, com o nível `nivel` (o Normal: sem a opção). */
function jogo(L, sem, rot, nivel, min) {
  const { C, P, M, H } = L;
  const m = P.criarPartida({ semente: sem, minutosPorTempo: min, ...(nivel !== 'normal' ? { dificuldade: nivel } : {}) });
  const st = estadoRot(sem);
  const R = { sem, rot, nivel, botes: 0, roubadas: 0, posseP: 0, posseIA: 0, rol: 0, chutesIA: 0, chutesP: 0, faltasIA: 0, penIA: 0,
    gols: [0, 0], vv: 0, condIA: 0, estado: '' };
  const N = Math.round(2 * min * 3600) + 9000;
  const porId = new Map(m.jogadores.map(j => [j.id, j]));
  // vai e volta do condutor da IA (a definição do corrida-medidas): o rumo da velocidade a cada 5 ticks, por condutor
  let hist = [], idH = -1, bloqueado = -1;
  for (let i = 0; i < N; i++) {
    const ent = H.entradaRoteiro(m, M, C.BOTAO, st, rot);
    const ev = P.passoPartida(m, ent) ?? [];
    for (const e of ev) {
      const q = e.id != null ? (porId.get(e.id) ?? m.jogadores.find(o => o.id === e.id)) : null;
      if (e.tipo === 'roubada' && e.ia && q && q.time === 1) { R.botes++; R.roubadas++; }
      else if (e.tipo === 'boteErrado' && q && q.time === 1) R.botes++;
      else if (e.tipo === 'falta') { const d = m.jogadores.find(o => o.id === e.def); if (d ? d.time === 1 : e.time === 0) R.faltasIA++; }
      else if (e.tipo === 'penalti' && e.time === 0) R.penIA++;
      if (q && M.ehChute(m, e)) { if (q.time === 1) R.chutesIA++; else R.chutesP++; }
    }
    if (m.partida.estado === 'fim') break;
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (!rolando) { idH = -1; continue; }
    R.rol++;
    const tb = M.timeComBola(m);
    if (tb === 0) R.posseP++; else if (tb === 1) R.posseIA++;
    const c = m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
    if (c && c.time === 1 && m.naMao == null) {
      R.condIA++;
      if (c.id !== idH) { idH = c.id; hist = []; bloqueado = -1; }
      if (m.tick % 5 === 0) {
        const v = Math.hypot(c.vx, c.vz);
        hist.push({ t: m.tick, vx: c.vx, vz: c.vz, v });
        if (hist.length > 13) hist.shift();
        if (v >= 1.5 && m.tick >= bloqueado) {
          for (const h of hist) {
            const dt = m.tick - h.t;
            if (dt < 15 || dt > 60 || h.v < 1.5) continue;
            if ((h.vx * c.vx + h.vz * c.vz) / (h.v * v) < Math.cos(135 * Math.PI / 180)) { R.vv++; bloqueado = m.tick + 60; break; }
          }
        }
      }
    } else idH = -1;
  }
  R.gols = [m.placar[0], m.placar[1]];
  R.estado = m.partida.estado;
  return R;
}

/** Hashes a cada CADA passos de uma partida (cena 'demo' ou um roteiro), com o nível na criação e/ou no meio. */
function hashes(L, { cena, sem, min, nivel, meio }) {
  const { C, P, S, T, M, H } = L;
  const opc = { semente: sem, minutosPorTempo: min };
  if (nivel != null) opc.dificuldade = nivel;
  const m = P.criarPartida(opc);
  const st = estadoRot(sem);
  const out = { h: [], liga: [0, 0], n: 0, tem: 'dificuldade' in m, temDepois: null };
  const N = Math.round(2 * min * 3600) + 3000;
  for (let i = 0; i < N && m.partida.estado !== 'fim'; i++) {
    if (meio && i === meio.passo) out.ok = P.definirDificuldade ? P.definirDificuldade(m, meio.nivel) : false;
    const e = cena === 'demo' ? P.entradaDemoPartida(m) : H.entradaRoteiro(m, M, C.BOTAO, st, cena);
    P.passoPartida(m, e);
    out.n++;
    if (T.nivelContra) { if (T.nivelContra(m, 0)) out.liga[0]++; if (T.nivelContra(m, 1)) out.liga[1]++; }
    if (m.tick % CADA === 0) out.h.push(S.hashMundo(m));
  }
  out.temDepois = 'dificuldade' in m;
  return out;
}

if (args[0] === '--filho') {
  const L = await carregar(JS);
  const LB = BASE_JS ? await (async () => { const imp = f => import(pathToFileURL(path.join(BASE_JS, f)).href); return { C: await imp('config.js'), P: await imp('partida.js'), S: await imp('sim.js'), T: await imp('tatica.js'), M: L.M, H: L.H }; })() : null;
  process.on('message', t => {
    let r;
    if (t.tipo === 'jogo') r = jogo(L, t.sem, t.rot, t.nivel, t.min);
    else r = hashes(t.base ? LB : L, t);
    process.send({ id: t.id, r }, () => {});
  });
  process.send({ pronto: true });
} else {
  await principal();
}

// --------------------------------------------------------------------------------------- principal
async function rodarTarefas(tarefas) {
  const res = new Array(tarefas.length);
  if (!tarefas.length) return res;
  let prox = 0, feitas = 0;
  tarefas.forEach((t, k) => { t.id = k; });
  await new Promise((fim, falha) => {
    const filhos = [];
    const manda = f => {
      if (prox >= tarefas.length) { f.kill(); return; }
      f.send(tarefas[prox++]);
    };
    for (let k = 0; k < Math.min(PAR, tarefas.length); k++) {
      const f = fork(fileURLToPath(import.meta.url), ['--filho', ...args], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      filhos.push(f);
      f.on('message', msg => {
        if (msg.pronto) { manda(f); return; }
        res[msg.id] = msg.r; feitas++;
        if (feitas === tarefas.length) { for (const g of filhos) g.kill(); fim(); return; }
        manda(f);
      });
      f.on('exit', c => { if (c && feitas < tarefas.length) falha(new Error(`filho saiu com ${c}`)); });
    }
  });
  return res;
}

async function principal() {
  const t0 = Date.now();
  const linhas = [['meta', 'medido', 'alvo', 'resultado']];
  let falhas = 0;
  const reg = (nome, medido, alvo, ok, info = false) => { linhas.push([nome, medido, alvo, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };
  const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : String(v));
  console.log(`teste-dificuldade: lógica ${JS}${SETS.length ? ` · --set ${SETS.join(' ')}` : ''}`);
  const L = await carregar(JS);
  const { C, P, T } = L;

  // ----------------------------------------------------------------------------------------------- D0 a tabela
  {
    const D = C.DIFICULDADE;
    const BRANCA = {
      'boteIA.chancePorPasso': () => C.ACOES.boteIA.chancePorPasso, 'boteIA.descanso': () => C.ACOES.boteIA.descanso,
      engaja: () => C.IA_PESSOA.engaja, encurta: () => C.IA_PESSOA.encurta?.[2], 'utilidade.chute': () => C.IA_ATAQUE.utilidade.chute,
      'utilidade.passeAntecipa': () => C.IA_PESSOA.utilidade?.passeAntecipa,
      'utilidade.chuteLonge': () => C.IA_ATAQUE.utilidade.chuteLonge, 'utilidade.chutePosse': () => C.IA_ATAQUE.utilidade.chutePosse, avaliaTicks: () => C.IA_ATAQUE.condutor.avaliaTicks,
      le: () => C.IA_DEFESA.livre.le, erro: () => 1, reacaoGoleiro: () => C.GOLEIRO.reacao,
      'contrapressao.s': () => C.IA_DEFESA.contrapressao?.s, 'contrapressao.max': () => C.IA_DEFESA.contrapressao?.max,
    };
    const prob = [];
    if (!D) prob.push('sem config.js DIFICULDADE');
    else {
      if ((D.niveis ?? []).join(',') !== ORDEM.join(',')) prob.push(`niveis ${JSON.stringify(D.niveis)}`);
      if (!D.normal || Object.keys(D.normal).length) prob.push('o Normal não é vazio');
      for (const n of ['facil', 'dificil', 'lenda']) {
        const N = D[n];
        if (!N) { prob.push(`sem ${n}`); continue; }
        const folhas = [];
        for (const [k, v] of Object.entries(N)) {
          if (v && typeof v === 'object' && !Array.isArray(v)) for (const k2 of Object.keys(v)) folhas.push([`${k}.${k2}`, v[k2]]);
          else folhas.push([k, v]);
        }
        for (const [k, v] of folhas) {
          if (!(k in BRANCA)) { prob.push(`${n}.${k} fora da lista branca`); continue; }
          const base = BRANCA[k]();
          if (base === undefined) prob.push(`${n}.${k}: a constante coberta não existe`);
          if (k === 'le' && !(v >= C.IA_DEFESA.livre.le)) prob.push(`${n}.le ${v} < ${C.IA_DEFESA.livre.le} (só mais lento)`);
          if (k === 'erro' && !(v >= 1)) prob.push(`${n}.erro ${v} < 1`);
          if (k === 'reacaoGoleiro' && !(Array.isArray(v) && v.length === 2 && v[0] >= C.GOLEIRO.reacao[0] && v[1] >= C.GOLEIRO.reacao[1])) prob.push(`${n}.reacaoGoleiro ${JSON.stringify(v)} mais rápido que ${JSON.stringify(C.GOLEIRO.reacao)}`);
          if (k === 'engaja' && !(Number.isInteger(v) && v >= -10 && v <= 6)) prob.push(`${n}.engaja ${v} fora de [−10, +6]`);
          if (['boteIA.chancePorPasso', 'encurta', 'utilidade.chute', 'utilidade.passeAntecipa', 'utilidade.chuteLonge', 'utilidade.chutePosse'].includes(k) && !(typeof v === 'number' && v >= 0)) prob.push(`${n}.${k} ${v} inválido`);
          if (['boteIA.descanso', 'avaliaTicks'].includes(k) && !(Number.isInteger(v) && v >= 1)) prob.push(`${n}.${k} ${v} inválido`);
        }
      }
    }
    reg('D0. a tabela DIFICULDADE: 4 níveis, o Normal vazio, chaves na lista branca e nos sentidos permitidos', prob.length ? prob.slice(0, 4).join('; ') : 'ok', 'ok', !prob.length);
  }
  const temOpcao = typeof T.nivelContra === 'function' && typeof P.definirDificuldade === 'function' && !!C.DIFICULDADE;

  // ------------------------------------------------------------------------- D1–D3 (as tarefas de hash, em paralelo)
  const MH = 1; // minutos por tempo nas cenas de hash
  const tarefasH = [];
  const add = (chave, t) => { tarefasH.push({ tipo: 'hash', chave, min: MH, ...t }); };
  if (SO !== 'medida') {
    for (const sem of [1, 2]) {
      add(`demo-normal-${sem}`, { cena: 'demo', sem });
      for (const n of ['facil', 'dificil', 'lenda']) add(`demo-${n}-${sem}`, { cena: 'demo', sem, nivel: n });
    }
    add('demo-normalExpl-1', { cena: 'demo', sem: 1, nivel: 'normal' });
    add('demo-normalMeio-1', { cena: 'demo', sem: 1, nivel: 'lenda', meio: { passo: 900, nivel: 'normal' } });
    for (const rot of ['agressivo', 'conduz', 'calmo', 'passivo']) {
      add(`${rot}-normal`, { cena: rot, sem: 1 });
      add(`${rot}-normalExpl`, { cena: rot, sem: 1, nivel: 'normal' });
      add(`${rot}-normalMeio`, { cena: rot, sem: 1, meio: { passo: 900, nivel: 'normal' } });
      for (const n of ['facil', 'dificil', 'lenda']) add(`${rot}-${n}`, { cena: rot, sem: 1, nivel: n });
      if (BASE_JS) add(`${rot}-base`, { cena: rot, sem: 1, base: true });
    }
    add('agressivo-lendaMeio', { cena: 'agressivo', sem: 1, meio: { passo: 1800, nivel: 'lenda' } });
    if (BASE_JS) add('demo-base-1', { cena: 'demo', sem: 1, base: true });
  }
  // ------------------------------------------------------------------------- D4–D8 (as partidas)
  const tarefasJ = [];
  let normalDe = null;
  if (NORMAL_DE && fs.existsSync(NORMAL_DE)) normalDe = JSON.parse(fs.readFileSync(NORMAL_DE, 'utf8')).filter(r => r.nivel === 'normal' && r.min === MIN);
  for (const f of DE) {
    const l = JSON.parse(fs.readFileSync(f, 'utf8')).filter(r => r.min === MIN && NIVEIS.includes(r.nivel));
    normalDe = [...(normalDe ?? []), ...l.filter(r => !(normalDe ?? []).some(o => o.nivel === r.nivel && o.rot === r.rot && o.sem === r.sem))];
  }
  if (SO !== 'portao') {
    for (const nivel of NIVEIS) for (const rot of ROTS) for (let s = SEM0; s < SEM0 + NSEM; s++) {
      if (normalDe && normalDe.some(r => r.nivel === nivel && r.rot === rot && r.sem === s)) continue;
      tarefasJ.push({ tipo: 'jogo', nivel, rot, sem: s, min: MIN });
    }
  }
  const todas = [...tarefasH, ...tarefasJ];
  const res = await rodarTarefas(todas);
  const H = {};
  tarefasH.forEach((t, k) => { H[t.chave] = res[k]; });
  const jogos = tarefasJ.map((t, k) => ({ ...res[tarefasH.length + k], min: MIN }));
  if (normalDe) for (const r of normalDe) if (ROTS.includes(r.rot) && r.sem >= SEM0 && r.sem < SEM0 + NSEM) jogos.push(r);
  const tJogos = (Date.now() - t0) / 1000;

  // D1: o portão
  if (SO !== 'medida') {
    let demoLiga = 0, demoN = 0;
    for (const sem of [1, 2]) { const h = H[`demo-lenda-${sem}`]; demoLiga += h.liga[0] + h.liga[1]; demoN += h.n; }
    // dois humanos: o criarPartida não escreve o campo; o portão nunca liga
    let dois = 'sem a opção';
    let okDois = false;
    if (temOpcao) {
      const m = P.criarPartida({ semente: 3, humanos: [0, 1], dificuldade: 'lenda' });
      let liga = 0;
      const NEUTRA = { x: 0, z: 0, botoes: 0 };
      for (let i = 0; i < 600; i++) { P.passoPartida(m, { 0: NEUTRA, 1: NEUTRA }); if (T.nivelContra(m, 0) || T.nivelContra(m, 1)) liga++; }
      const rec = P.definirDificuldade(m, 'lenda');
      okDois = !('dificuldade' in m) && liga === 0 && rec === false;
      dois = `campo ${'dificuldade' in m ? 'ESCRITO' : 'ausente'}, ${liga}/600 ligados, definirDificuldade ${rec}`;
    }
    // o travado expulso (o cenário P2 do teste-ia-corre)
    let trav = 'sem a opção', okTrav = false;
    if (temOpcao) {
      const NEUTRA = { x: 0, z: 0, botoes: 0 };
      const m0 = P.criarPartida({ semente: 7, humano: 0 });
      const trava = Object.values(m0.times[0].vagas).find(id => m0.jogadores.find(j => j.id === id)?.posicao !== 'GOL');
      const m = P.criarPartida({ semente: 7, humano: 0, trava, dificuldade: 'lenda' });
      let antes = 0;
      for (let i = 0; i < 600; i++) { P.passoPartida(m, NEUTRA); if (T.nivelContra(m, 1)) antes++; }
      m.partida.cartoesPendentes.push({ id: trava, cor: 'vermelho', motivo: 'teste' });
      P.bolaMorta(m, 'lateral', 1, 0, C.CAMPO.meioZ);
      let depois = 0;
      for (let i = 0; i < 1200 && m.partida.estado !== 'fim'; i++) { P.passoPartida(m, NEUTRA); if (T.nivelContra(m, 0) || T.nivelContra(m, 1)) depois++; }
      for (let i = 0; i < 1200 && m.partida.estado !== 'fim'; i++) { P.passoPartida(m, P.entradaDemoPartida(m)); if (T.nivelContra(m, 0) || T.nivelContra(m, 1)) depois++; }
      okTrav = antes === 600 && depois === 0 && m.partida.expulsos.includes(trava);
      trav = `com ele em campo ${antes}/600 ligados; expulso ${depois}/2400`;
    }
    let r0 = 0, r1 = 0, rn = 0;
    for (const rot of ['agressivo', 'conduz', 'calmo', 'passivo']) { const h = H[`${rot}-lenda`]; r0 += h.liga[0]; r1 += h.liga[1]; rn += h.n; }
    const ok = temOpcao && demoLiga === 0 && okDois && okTrav && r0 === 0 && r1 >= 0.95 * rn;
    reg('D1. o portão (nivelContra com {dificuldade: "lenda"})',
      `demo ${demoLiga}/${demoN} ligados; dois humanos: ${dois}; travado: ${trav}; contra o roteiro: time da pessoa ${r0}, da IA ${(100 * r1 / Math.max(1, rn)).toFixed(1)}% de ${rn}`,
      'demo 0; dois humanos 0; expulso 0; pessoa 0, IA ≥ 95%', ok);
  }
  // D2: o Normal = hoje
  if (SO !== 'medida') {
    const iguais = (a, b) => a && b && a.h.length === b.h.length && a.h.every((x, k) => x === b.h[k]);
    const dif = [], comCampo = [];
    let nH = 0;
    const variantes = ['normalExpl', 'normalMeio', ...(BASE_JS ? ['base'] : [])];
    for (const cena of ['agressivo', 'conduz', 'calmo', 'passivo']) {
      const ref = H[`${cena}-normal`];
      nH += ref.h.length;
      if (ref.tem || ref.temDepois) comCampo.push(`${cena} sem a opção`);
      for (const v of variantes) {
        const o = H[`${cena}-${v}`];
        if (v !== 'base' && (o.tem || o.temDepois)) comCampo.push(`${cena} ${v}`);
        if (!iguais(ref, o)) dif.push(`${cena} ${v}`);
      }
    }
    const dref = H['demo-normal-1'];
    for (const v of variantes) {
      const o = H[`demo-${v}-1`];
      // (na demo o normalMeio começa no Lenda: o campo existe no começo e sai no passo 900)
      if (v === 'normalExpl' && (o.tem || o.temDepois)) comCampo.push(`demo ${v}`);
      if (v === 'normalMeio' && o.temDepois) comCampo.push(`demo ${v} depois`);
      if (!iguais(dref, o)) dif.push(`demo ${v}`);
    }
    const meioOk = temOpcao && H['demo-normalMeio-1'].ok === true && ['agressivo', 'conduz', 'calmo', 'passivo'].every(c => H[`${c}-normalMeio`].ok === true);
    reg(`D2. o Normal = hoje: sem o campo × {dificuldade: "normal"} × definirDificuldade(m, "normal") no meio${BASE_JS ? ' × a base' : ''} (4 roteiros + demo, hash a cada ${CADA} passos)`,
      `${dif.length ? `DIFERENTE em ${dif.join(', ')}` : `iguais (${nH} hashes por variante nos roteiros)`}; campo no mundo ${comCampo.length ? `em ${comCampo.join(', ')}` : 'nunca'}; definirDificuldade ${meioOk ? 'aceitou' : 'NÃO aceitou'}`,
      'iguais; nunca; aceitou', temOpcao && !dif.length && !comCampo.length && meioOk);
  }
  // D3: a opção muda só contra a pessoa
  if (SO !== 'medida') {
    const iguais = (a, b) => a.h.length === b.h.length && a.h.every((x, k) => x === b.h[k]);
    const demoDif = [], rotIg = [];
    for (const n of ['facil', 'dificil', 'lenda']) {
      for (const sem of [1, 2]) if (!iguais(H[`demo-normal-${sem}`], H[`demo-${n}-${sem}`])) demoDif.push(`${n} s${sem}`);
      for (const rot of ['agressivo', 'conduz', 'calmo', 'passivo']) if (iguais(H[`${rot}-normal`], H[`${rot}-${n}`])) rotIg.push(`${n} ${rot}`);
    }
    const a = H['agressivo-normal'], b = H['agressivo-lendaMeio'];
    const kMeio = Math.floor(1800 / CADA); // hashes até o passo 1800 (inclusive)
    const antesIg = a.h.slice(0, kMeio).every((x, k) => x === b.h[k]);
    const depoisDif = a.h.slice(kMeio).some((x, k) => x !== b.h[kMeio + k]);
    reg('D3. a opção muda só contra a pessoa: demo IGUAL ao Normal; contra o roteiro DIFERENTE; no meio (passo 1800) igual antes e diferente depois',
      `demo ${demoDif.length ? `DIFERENTE em ${demoDif.join(', ')}` : 'igual nos 3 níveis × 2 sementes'}; roteiro ${rotIg.length ? `IGUAL em ${rotIg.join(', ')}` : 'diferente nos 3 × 4'}; no meio: antes ${antesIg ? 'igual' : 'DIFERENTE'}, depois ${depoisDif ? 'diferente' : 'IGUAL'}`,
      'igual; diferente; igual/diferente', temOpcao && !demoDif.length && !rotIg.length && antesIg && depoisDif && b.ok === true);
  }

  if (SO === 'portao') return fechar();

  // ------------------------------------------------------------------------------------------- D4–D8
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(jogos));
  const porNivel = n => jogos.filter(r => r.nivel === n);
  const semPar = jogos.filter(r => r.estado !== 'fim').length;
  // medidas (razão das somas): por nível
  const MED = {
    botes: L2 => soma(L2, 'botes') / Math.max(1e-9, soma(L2, 'posseP') / 3600),
    chutesIA: L2 => soma(L2, 'chutesIA') / L2.length,
    chutesP: L2 => soma(L2, 'chutesP') / L2.length,
    faltasIA: L2 => soma(L2, 'faltasIA') / L2.length,
  };
  function soma(L2, k) { let s = 0; for (const r of L2) s += r[k]; return s; }
  /** Bootstrap pareado e estratificado por roteiro da razão MED(A)/MED(B): {r, p5, p95}. */
  function razao(med, A, B) {
    const chave = r => `${r.rot}|${r.sem}`;
    const mA = new Map(porNivel(A).map(r => [chave(r), r])), mB = new Map(porNivel(B).map(r => [chave(r), r]));
    const estratos = ROTS.map(rot => [...mA.keys()].filter(k => k.startsWith(rot + '|') && mB.has(k))).filter(e => e.length);
    const lA = estratos.flat().map(k => mA.get(k)), lB = estratos.flat().map(k => mB.get(k));
    if (!lA.length) return null;
    const r = MED[med](lA) / MED[med](lB);
    let st = 0x9e3779b9;
    const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
    const rs = [];
    for (let b = 0; b < BOOT; b++) {
      const ks = estratos.flatMap(E => E.map(() => E[Math.floor(rnd() * E.length)]));
      const a = ks.map(k => mA.get(k)), bb = ks.map(k => mB.get(k));
      rs.push(MED[med](a) / MED[med](bb));
    }
    rs.sort((x, y) => x - y);
    return { r, p5: rs[Math.floor(0.05 * BOOT)], p95: rs[Math.floor(0.95 * BOOT) - 1], n: lA.length };
  }
  const tem = n => NIVEIS.includes(n) && porNivel(n).length > 0;
  const fr = x => x ? `${f2(x.r)} [${f2(x.p5)}–${f2(x.p95)}]` : '—';
  // a tabela por nível (informativa)
  const tab = [['nível', 'partidas', 'botes IA /min posse pessoa', 'roubadas IA /min', 'chutes IA /p', 'chutes pessoa /p', 'faltas IA /p', 'pênaltis IA /p', 'gols IA × pessoa /p', 'posse IA', 'vai e volta cond. IA /min']];
  for (const n of ORDEM) {
    if (!tem(n)) continue;
    const L2 = porNivel(n), k = L2.length;
    tab.push([NOME[n], k, f2(MED.botes(L2)), f2(soma(L2, 'roubadas') / Math.max(1e-9, soma(L2, 'posseP') / 3600)), f2(MED.chutesIA(L2)), f2(MED.chutesP(L2)),
      f2(MED.faltasIA(L2)), f2(soma(L2, 'penIA') / k), `${f2(L2.reduce((s, r) => s + r.gols[1], 0) / k)} × ${f2(L2.reduce((s, r) => s + r.gols[0], 0) / k)}`,
      `${(100 * soma(L2, 'posseIA') / Math.max(1, soma(L2, 'posseIA') + soma(L2, 'posseP'))).toFixed(1).replace('.', ',')}%`,
      f2(soma(L2, 'vv') / Math.max(1e-9, soma(L2, 'condIA') / 3600))]);
  }
  // por roteiro (informativo): botes e chutes da IA
  const tabR = [['roteiro', ...ORDEM.filter(tem).map(n => `${NOME[n]}: botes /min · chutes IA · chutes pessoa`)]];
  for (const rot of ROTS) tabR.push([rot, ...ORDEM.filter(tem).map(n => { const L2 = porNivel(n).filter(r => r.rot === rot); return `${f2(MED.botes(L2))} · ${f2(MED.chutesIA(L2))} · ${f2(MED.chutesP(L2))}`; })]);

  const ordem = (med, alvoPonto, provar, vizinhosProvar, sentido) => {
    // sentido +1: o nível mais difícil tem MAIS (botes, chutes da IA); −1: MENOS (chutes da pessoa)
    const partes = [], fal = [];
    for (const [n, alvo] of Object.entries(alvoPonto)) {
      if (!tem(n) || !tem('normal')) continue;
      const x = razao(med, n, 'normal');
      partes.push(`${NOME[n]}/Normal ${fr(x)}`);
      if (alvo.max != null && !(x.r <= alvo.max)) fal.push(`${NOME[n]} ${f2(x.r)} > ${f2(alvo.max)}`);
      if (alvo.min != null && !(x.r >= alvo.min)) fal.push(`${NOME[n]} ${f2(x.r)} < ${f2(alvo.min)}`);
    }
    for (const [a, b] of provar) {
      if (!tem(a) || !tem(b)) continue;
      const x = razao(med, a, b);
      // a < b provado (sentido +): p95 < 1; com sentido −, a > b provado: p5 > 1
      const ok = sentido > 0 ? x.p95 < 1 : x.p5 > 1;
      if (!ok) fal.push(`${NOME[a]} ${sentido > 0 ? '<' : '>'} ${NOME[b]} não provado (${fr(x)})`);
    }
    for (let k = 0; k + 1 < ORDEM.length; k++) {
      const a = ORDEM[k], b = ORDEM[k + 1];
      if (!tem(a) || !tem(b)) continue;
      const x = razao(med, a, b);
      if (sentido > 0 && x.p5 > 1) fal.push(`${NOME[a]} > ${NOME[b]} PROVADO (lado errado; ${fr(x)})`);
      if (sentido < 0 && x.p95 < 1) fal.push(`${NOME[a]} < ${NOME[b]} PROVADO (lado errado; ${fr(x)})`);
      if (vizinhosProvar && (sentido > 0 ? !(x.r < 1) : !(x.r > 1))) fal.push(`${NOME[a]}/${NOME[b]} fora da ordem (${f2(x.r)})`);
      if (vizinhosProvar === 'provar' && (sentido > 0 ? !(x.p95 < 1) : !(x.p5 > 1))) fal.push(`${NOME[a]} ${sentido > 0 ? '<' : '>'} ${NOME[b]} não provado (${fr(x)})`);
    }
    return { partes, fal };
  };
  const quais = ORDEM.filter(tem).length;
  {
    const o = ordem('botes', { facil: { max: 0.70 }, dificil: { min: 1.15 }, lenda: { min: 1.30 } }, [['facil', 'normal'], ['normal', 'lenda']], true, +1);
    reg('D4. botes da IA por minuto de posse da pessoa (pareado; razão [p5–p95])', `${o.partes.join(' · ')}${o.fal.length ? ` — ${o.fal.join('; ')}` : ''}`,
      'Fácil ≤ 0,70 · Difícil ≥ 1,15 · Lenda ≥ 1,30; Fácil < Normal < Lenda provados; vizinhos na ordem', temOpcao && quais >= 2 && !o.fal.length);
  }
  {
    const o = ordem('chutesIA', { facil: { max: 0.75 }, dificil: { min: COMPLETO ? 1.15 : 1.10 }, lenda: { min: 1.25 } }, [['facil', 'normal'], ['normal', 'lenda']], true, +1);
    reg('D5. chutes da IA por partida (pareado)', `${o.partes.join(' · ')}${o.fal.length ? ` — ${o.fal.join('; ')}` : ''}`,
      `Fácil ≤ 0,75 · Difícil ≥ ${COMPLETO ? '1,15' : '1,10'} · Lenda ≥ 1,25; Fácil < Normal < Lenda provados; vizinhos na ordem`, temOpcao && quais >= 2 && !o.fal.length);
  }
  {
    const o = ordem('chutesP', {}, [['facil', 'lenda']], false, -1);
    const partes = ORDEM.filter(n => n !== 'normal' && tem(n) && tem('normal')).map(n => `${NOME[n]}/Normal ${fr(razao('chutesP', n, 'normal'))}`);
    reg('D6. o inverso: chutes do time da pessoa (Fácil > Lenda provado; vizinhos sem o lado errado provado)', `${partes.join(' · ')}${o.fal.length ? ` — ${o.fal.join('; ')}` : ''}`,
      'Fácil > Lenda provado', temOpcao && quais >= 2 && !o.fal.length);
  }
  if (COMPLETO) {
    const a = ordem('botes', {}, [], 'provar', +1), b = ordem('chutesIA', {}, [], 'provar', +1);
    const fal = [...a.fal.map(x => `botes: ${x}`), ...b.fal.map(x => `chutes: ${x}`)];
    reg('D7. --completo: todos os degraus vizinhos provados (botes e chutes da IA)', fal.length ? fal.join('; ') : 'todos provados', 'todos provados', temOpcao && !fal.length);
  }
  {
    let txt = '—', ok = true;
    if (tem('lenda') && tem('normal')) {
      const x = razao('faltasIA', 'lenda', 'normal');
      ok = !(x.p5 > 1.8);
      txt = `Lenda/Normal ${fr(x)}`;
    }
    reg('D8. faltas da IA no Lenda ≤ 1,8× o Normal (reprova quando prova acima)', txt, '≤ 1,8 (p5)', ok);
  }
  if (semPar) reg('as partidas chegam ao fim', `${semPar} não chegaram`, 'todas', false);
  console.log(tab.map(l => l.join(' | ')).join('\n'));
  console.log('\npor roteiro:\n' + tabR.map(l => l.join(' | ')).join('\n'));
  console.log(`\n${jogos.length} partidas de 2 × ${MIN} min (${ROTS.join(', ')} × ${NSEM} sementes desde ${SEM0} × ${NIVEIS.join(', ')}${normalDe ? `; ${jogos.length - tarefasJ.length} reaproveitadas (--normal-de/--de)` : ''}) · ${tJogos.toFixed(0)} s`);
  return fechar();

  function fechar() {
    const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
    console.log('\n' + linhas.map(l => l.map((x, c) => String(x).padEnd(Math.min(larg[c], 160))).join(' | ')).join('\n'));
    console.log(falhas ? `\nteste-dificuldade: REPROVOU (${falhas})` : '\nteste-dificuldade: PASSOU');
    process.exit(falhas ? 1 : 0);
  }
}
