// teste-classico (item 35 da FILA; dono, 17/10: "clássico mais PEGADO: mais faltas pela AGRESSIVIDADE dos jogadores (bote mais
// forte, mais contato), não pelo árbitro"; contrato "Clássico pegado (item 35)" no CONTRATOS.md; pesquisa e calibração em
// PESQUISA-CLASSICO.md). Com m.classico (o pedido do TM, partida.classico; ?classico=1) a VONTADE dos jogadores guiados pela IA
// dos DOIS times sobe (config.js CLASSICO); o árbitro é o mesmo código e as mesmas constantes; sem a opção, o jogo de hoje bit a bit.
//
// Estruturais (reprovam na base: a lógica não existe):
//  K0 a tabela CLASSICO: só as chaves da lista, nos sentidos permitidos, nenhuma com o nome da constante que cobre; cfgBote({}, t)
//     é o MESMO objeto ACOES.boteIA; com m.classico cada nível (a vontade do jogo com a pessoa), os companheiros dela (idem) e a
//     IA × IA (a vontade própria) têm todas as chaves iguais (===) às do de origem menos chancePorPasso e descanso, que batem com
//     a fórmula; a ordem ESTRITA Fácil+C < Normal+C < Difícil+C < Lenda+C, cada nível+C acima do nível sem (o clássico mexe
//     também no Lenda), Fácil+C abaixo do Normal sem; o seguraClassico (1 sem a marca; o da IA × IA e o do jogo com a pessoa).
//  K1 a marca: {classico: true} → m.classico === true; sem o campo, false, 'sim', 1, 'true' → o campo AUSENTE; dois humanos →
//     true; o Livre e os Pênaltis nunca o recebem.
//  K2 o hash: sem × {classico: false} × {classico: 'sim'} → o MESMO hash a cada 300 passos (demo + 4 roteiros, 1 semente × 2
//     tempos de 2 min); {classico: true} → DIFERENTE na demo e em cada roteiro; com --base, o sem igual ao da base.
//  K3 os dois times, nunca o controlado: em toda tentativa de bote o cfg usado é o cfgBote(m, time) (o clássico e a dificuldade);
//     o controlado de um time humano com 0 oportunidades e 0 tentativas; na demo, as tentativas dos DOIS times sobem (nenhum
//     provado ≤ 1).
//  K4 o árbitro igual: uma grade de cenas montadas (chegada × velocidades × desarme × área × chance clara, os dois sentidos) em
//     que toda função do árbitro (faltas.js chanceFaltaBote, fatorForca/forcaContato, chanceFaltaDividida, chanceClara,
//     ataquePromissor, faltaNoBote, faltaNaCarga, faltaTatica (também com o mesmo segura), faltaNoCarrinho, montarFalta; partida.js regrasPartida com a falta
//     pendente; defesa.js chanceDividida e semAtropelar) dá o MESMO resultado e o MESMO estado do m.rng com e sem m.classico.
//  K5 o segura não vale na PRÓPRIA área (lá a falta tática com SPA é pênalti): numa cena montada com o batido colado atrás do
//     condutor num ataque promissor, faltaTatica com segura 2 e com 1 dá o MESMO resultado em 2000 estados do sorteio dentro
//     da área e resultados diferentes fora dela (a cena não é vazia: há faltas nos dois lugares).
//  KI a instrumentação só lê: a cópia com os ganchos ligados dá o mesmo hash da lógica original.
// Medidas (pareadas: as mesmas sementes com e sem o clássico; "PROVADO" = bootstrap pareado e estratificado por modo, 2000×,
// unilateral 95%; as metas reprovam só quando PROVAM, nunca pelo ponto — lição do D3/D8):
//  C1 botes (TENTATIVAS da IA: a demo os dois times, os roteiros o time da IA), POR MODO (revisão do item 35: juntas, a demo e os
//     roteiros escondiam a IA × IA acima da faixa): IA × IA +25–50% (reprova se provar < +20% ou > +60%); contra a pessoa
//     (META_C1.rot) +15–50% (reprova se provar < +10% ou > +60%: a vontade alta contra ela virava a dificuldade de cima).
//  C2 faltas da IA (não o controlado), POR MODO: as ESPERADAS pelo árbitro — Σ p·cuidado de cada bote avaliado + Σ p de cada
//     carga + Σ p de cada passo do batido que segura —; no --completo também as MARCADAS. +25–50% (reprova se provar < +20% ou >
//     +60%), nos dois modos.
//  C3b a chance por contato (Σ p ÷ N do árbitro nos botes e cargas avaliados): razão em [0,90; 1,10] (reprova se provar fora).
//  C3c a mesma só no bote (a carga junto diluía a alta do bote): em [0,90; 1,10] (reprova se provar fora).
//  C4 amarelos da IA: CI reprova se provar > +100% ou < 0%; --completo +20–60% (reprova se provar < +10% ou > +80%) e o amarelo
//     por falta sem provar acima de +40%.
//  C5 vermelhos da IA ≤ 0,2 por partida com o clássico (Normal+C e Lenda+C; Poisson: reprova se a contagem provar acima).
//  C6 gols: sem queda provada além de −25% nem alta provada além de +10%.   C7 chutes: sem queda provada além de −15%.
//  C6p/C7p o time da PESSOA (roteiros, time 0): gols sem queda provada além de −25%, chutes além de −15% (o clássico não vira a
//     dificuldade de cima; revisão do item 35: com a vontade 2,6 nos dois times, chutes 0,66 e gols 0,60 da pessoa).
//  C12 os cartões do time da pessoa ÷ os da IA (roteiros), com × sem: sem subida provada do lado da pessoa (binomial condicional;
//     revisão do item 35: 10 → 23 do lado da pessoa com os da IA iguais).
//  C8 bola rolando: informativa; reprova só se provar alta.
//  C9 intensidade dos guiados pela IA de linha: volume (m por minuto de bola rolando) sem alta provada além de +5%; disparada
//     (> 7 m/s) além de +10%; presença (um adversário a ≤ 5 m do condutor) além de +8%.
//  C10 a combinação com a dificuldade (contra os 4 roteiros): botes por minuto de posse da pessoa Fácil+C < Normal+C PROVADO;
//     Normal+C × Difícil+C, Difícil+C × Lenda+C e Fácil+C × Normal sem sem o lado errado provado (no --completo, 32 por nível,
//     esses degraus PROVADOS menos o Normal+C × Difícil+C, que o bote satura: ~1,07×; o K0 confere a ordem estrita nos
//     parâmetros); o Lenda+C sem MENOS botes PROVADOS que o Lenda sem; faltas da
//     IA Lenda+C ≤ 1,8 × Normal+C (reprova quando prova acima); vermelhos pelo C5 (Normal+C, Difícil+C e Lenda+C).
//  C11 os companheiros da pessoa (informativo): tentativas e faltas sem × com.
// Partidas de 2 × --min (4) min: 'demo' (IA × IA; a IA pelo controlado do time 0) e os 4 roteiros (tools/lib/humano-roteiro.mjs;
// o time 0 é a pessoa, o time 1 a IA). Lógica INSTRUMENTADA (tools/lib/classico-medidas.mjs: ganchos que só leem).
//
//   node tools/teste-classico.mjs                   (CI: demo 16 + 4 roteiros × 8 = 48 por braço; + Fácil+C, Difícil+C, Lenda+C e
//                                                    Lenda sem × 4 × 4)
//   node tools/teste-classico.mjs --completo        (a medida do dono, fora do CI: 96 por braço; + os 4 braços da dificuldade × 4 × 8)
//   node tools/teste-classico.mjs --so portao       (só K0–K4 e KI, rápido)
//   node tools/teste-classico.mjs --so medida --sementes 8 --demo 32 --sem0 1001 --set CLASSICO.vontade=1.8 --json t.json
//        --sem-de sem.json    (a triagem: o braço sem o clássico já jogado — guardado por --json — não roda de novo)
//   node tools/teste-classico.mjs --js <pasta>      (outra lógica: a base 29d67bad REPROVA)
//   node tools/teste-classico.mjs --base <pasta js> (K2 também contra a base)
// Sai com código 1 se alguma meta reprovar.
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copiaInstrumentadaClassico, carregarLogica, jogarMedida } from './lib/classico-medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const BASE_JS = arg('--base', null) ? path.resolve(arg('--base')) : null;
const COMPLETO = args.includes('--completo');
const NSEM = +arg('--sementes', COMPLETO ? 16 : 8);
const NDEMO = +arg('--demo', 2 * NSEM);
const NDIF = +arg('--sementes-dif', COMPLETO ? 8 : 4);
const SEM0 = +arg('--sem0', 1);
const ROTS = arg('--roteiros', 'agressivo,conduz,calmo,passivo').split(',').filter(Boolean);
const MIN = +arg('--min', 4);
const PAR = Math.max(1, Math.min(+arg('--par', 3), os.cpus().length || 1));
const SETS = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const JSON_OUT = arg('--json', null);
const SEM_DE = arg('--sem-de', null);
const DE = (arg('--de', '') || '').split(',').filter(Boolean);
const SO = arg('--so', null);
const SEM_DIF = args.includes('--sem-dif');
const BOOT = 2000;
const CADA = 300;
const MH = 2; // minutos por tempo nas cenas de hash (K2, KI)
const INSTR_ENV = 'GOLACO_CLASSICO_INSTR';
const ARMS_DIF = [['facil', true], ['dificil', true], ['lenda', true], ['lenda', false]];
// C1/C2 por modo (revisão do item 35: a demo junto dos roteiros escondia a IA × IA acima da faixa): [reprova se provar abaixo,
// reprova se provar acima] da razão com ÷ sem. A IA × IA: +25–50% (reprova < +20% ou > +60%). Contra a pessoa a vontade é menor
// (o jogo com a pessoa: CLASSICO.vontadePessoa — a alta virava a dificuldade de cima) e as faltas vêm também do `segura`
const META_C1 = { demo: [1.20, 1.60], rot: [1.10, 1.60] };
const META_C2 = { demo: [1.20, 1.60], rot: [1.20, 1.60] };

// ------------------------------------------------------------------------------------------- processo filho
const estadoRot = sem => ({ s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 });

/** Hashes a cada CADA passos (a lógica ORIGINAL): a demo ou um roteiro, com `classico` cru no criarPartida (undefined = sem o campo). */
function hashes(L, { cena, sem, min, classico }) {
  const { C, P, S, M, H } = L;
  const opc = { semente: sem, minutosPorTempo: min };
  if (classico !== undefined) opc.classico = classico;
  const m = P.criarPartida(opc);
  const st = estadoRot(sem);
  const out = { h: [], tem: 'classico' in m, val: m.classico };
  const N = Math.round(2 * min * 3600) + 9000;
  for (let i = 0; i < N; i++) {
    const e = cena === 'demo' ? P.entradaDemoPartida(m) : H.entradaRoteiro(m, M, C.BOTAO, st, cena);
    P.passoPartida(m, e);
    if (m.tick % CADA === 0) out.h.push(S.hashMundo(m));
    if (m.partida.estado === 'fim') break;
  }
  out.temDepois = 'classico' in m;
  return out;
}

if (args[0] === '--filho') {
  const LO = await carregarLogica(JS, SETS);
  const LI = await carregarLogica(process.env[INSTR_ENV], SETS);
  const LB = BASE_JS ? await carregarLogica(BASE_JS, []) : null;
  process.on('message', t => {
    let r;
    if (t.tipo === 'jogo') r = jogarMedida(LI, t);
    else if (t.tipo === 'ki') r = jogarMedida(LI, { sem: t.sem, modo: 'demo', min: t.min, cada: CADA });
    else r = hashes(t.base ? LB : LO, t);
    process.send({ id: t.id, r }, () => {});
  });
  process.send({ pronto: true });
} else {
  await principal();
}

// ------------------------------------------------------------------------------------------- principal
async function rodarTarefas(tarefas, instr) {
  const res = new Array(tarefas.length);
  if (!tarefas.length) return res;
  let prox = 0, feitas = 0;
  tarefas.forEach((t, k) => { t.id = k; });
  const t0 = Date.now();
  await new Promise((fim, falha) => {
    const filhos = [];
    const manda = f => { if (prox >= tarefas.length) { f.kill(); return; } f.send(tarefas[prox++]); };
    for (let k = 0; k < Math.min(PAR, tarefas.length); k++) {
      const f = fork(fileURLToPath(import.meta.url), ['--filho', ...args], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'], env: { ...process.env, [INSTR_ENV]: instr } });
      filhos.push(f);
      f.on('message', msg => {
        if (msg.pronto) { manda(f); return; }
        res[msg.id] = msg.r; feitas++;
        if (feitas % 16 === 0 || feitas === tarefas.length) process.stderr.write(`  ${feitas}/${tarefas.length} tarefas · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
        if (feitas === tarefas.length) { for (const g of filhos) g.kill(); fim(); return; }
        manda(f);
      });
      f.on('exit', c => { if (c && feitas < tarefas.length) falha(new Error(`filho saiu com ${c}`)); });
    }
  });
  return res;
}

/** C(n, k) em ponto flutuante. */
function binom(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}

/** P(X ≥ k) para X ~ Poisson(λ). */
function caudaPoisson(k, lam) {
  let termo = Math.exp(-lam), acum = 0;
  for (let i = 0; i < k; i++) { acum += termo; termo *= lam / (i + 1); }
  return Math.max(0, 1 - acum);
}

async function principal() {
  const t0 = Date.now();
  const linhas = [['meta', 'medido', 'alvo', 'resultado']];
  let falhas = 0;
  const reg = (nome, medido, alvo, ok, info = false) => { linhas.push([nome, medido, alvo, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };
  const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : String(v));
  const f3 = v => (Number.isFinite(v) ? v.toFixed(3).replace('.', ',') : String(v));
  const pc = v => (Number.isFinite(v) ? `${v >= 1 ? '+' : '−'}${Math.abs(100 * (v - 1)).toFixed(0)}%` : String(v));
  console.log(`teste-classico: lógica ${JS}${SETS.length ? ` · --set ${SETS.join(' ')}` : ''}`);
  const L = await carregarLogica(JS, SETS);
  const { C, P, S, LV, DP } = L;
  const temOpcao = !!C.CLASSICO && typeof S.cfgBote === 'function';
  const instr = copiaInstrumentadaClassico(JS);

  // ----------------------------------------------------------------------------------------------- K0 a tabela
  {
    const prob = [];
    const K = C.CLASSICO;
    // (a contenção e o aperto do 1º homem mais perto e a bola encostada — contencaoMenos/apertoMenos/encostadaVrelMais da
    // especificação — saíram na triagem, PESQUISA-CLASSICO.md §6; voltando, entram aqui com as faixas e os pisos conferidos)
    const FAIXA = { vontade: [1, 3], vontadePessoa: [1, 3], descansoMin: [12, 45], boteTeto: [0.22, 0.30], segura: [1, 2], seguraPessoa: [1, 2] };
    const COBERTAS = ['chancePorPasso', 'descanso', 'contencao', 'aperto', 'encostadaVrel', 'encostada', 'alcance', 'colada', 'vParado', 'boteIA', 'engaja', 'encurta', 'tatica', 'semSPA'];
    if (!K) prob.push('sem config.js CLASSICO');
    else {
      for (const [k, v] of Object.entries(K)) {
        if (COBERTAS.includes(k)) prob.push(`${k} repete o nome de uma constante coberta`);
        if (!(k in FAIXA)) { prob.push(`${k} fora da lista`); continue; }
        const [a, b] = FAIXA[k];
        if (!(typeof v === 'number' && v >= a && v <= b)) prob.push(`${k} ${v} fora de [${a}; ${b}]`);
        if (k === 'descansoMin' && !Number.isInteger(v)) prob.push('descansoMin não é inteiro');
      }
      for (const k of ['vontade', 'vontadePessoa', 'descansoMin', 'boteTeto', 'segura', 'seguraPessoa']) if (!(k in K)) prob.push(`sem ${k}`);
    }
    if (typeof S.cfgBote !== 'function' || !K) prob.push('sem sim.js cfgBote');
    else {
      for (const t of [0, 1]) if (S.cfgBote({}, t) !== C.ACOES.boteIA) prob.push(`cfgBote({}, ${t}) não é o ACOES.boteIA`);
      // (o jogo com a pessoa: o time 0 dela, sem marca da IA na entrada; a IA × IA: a entrada do time 0 com a marca)
      const fake = (n, cl, ia = false) => ({ humanos: [0], iaNaEntrada: ia ? { 0: true } : {}, ...(n !== 'normal' ? { dificuldade: n } : {}), ...(cl ? { classico: true } : {}) });
      const confere = (nome, o, c, V) => {
        if (o === c) { prob.push(`${nome}: o objeto do clássico é o mesmo do de origem`); return; }
        // (só a chance e o descanso mudam; o resto — alcance, colada, encostada, vParado (o árbitro lê o ACOES.boteIA) — igual)
        const ko = Object.keys(o).sort().join(','), kc = Object.keys(c).sort().join(',');
        if (ko !== kc) prob.push(`${nome}: chaves diferentes (${kc})`);
        for (const k of Object.keys(o)) {
          if (['chancePorPasso', 'descanso'].includes(k)) continue;
          if (o[k] !== c[k]) prob.push(`${nome}.${k} ${c[k]} ≠ ${o[k]} (o árbitro e o alcance leem o de origem)`);
        }
        const pe = Math.max(o.chancePorPasso, Math.min(K.boteTeto, 1 - Math.pow(1 - o.chancePorPasso, V)));
        const de = Math.min(o.descanso, Math.max(K.descansoMin, Math.round(o.descanso / V)));
        if (Math.abs(c.chancePorPasso - pe) > 1e-12) prob.push(`${nome}.chancePorPasso ${c.chancePorPasso} ≠ ${pe}`);
        if (c.descanso !== de) prob.push(`${nome}.descanso ${c.descanso} ≠ ${de}`);
      };
      const ch = {}, ds = {}, orig = {};
      for (const n of C.DIFICULDADE.niveis) {
        const o = S.cfgBote(fake(n, false), 1), c = S.cfgBote(fake(n, true), 1);
        confere(n, o, c, K.vontadePessoa);
        ch[n] = c.chancePorPasso; ds[n] = c.descanso; orig[n] = o;
      }
      // os companheiros da pessoa (o time 0, guiados pela IA) com a vontade do jogo com a pessoa, por cima do Normal
      confere('companheiros', S.cfgBote(fake('normal', false), 0), S.cfgBote(fake('normal', true), 0), K.vontadePessoa);
      // a IA × IA (a demo, o Simular o resto): a vontade própria, nos dois times
      for (const t of [0, 1]) confere(`IA × IA time ${t}`, S.cfgBote(fake('normal', false, true), t), S.cfgBote(fake('normal', true, true), t), K.vontade);
      const N = C.DIFICULDADE.niveis;
      // a ordem ESTRITA dos níveis com o clássico (revisão do item 35: com a vontade 2,6 o Difícil+C e o Lenda+C batiam no mesmo
      // teto, 0,26/16, e o Lenda deixava de apertar mais que o Difícil no clássico) e o clássico mexendo também no Lenda
      if (!(ch.facil < ch.normal && ch.normal < ch.dificil && ch.dificil < ch.lenda)) prob.push(`ordem estrita da chance ${N.map(n => f3(ch[n])).join(' · ')}`);
      if (!(ds.facil >= ds.normal && ds.normal >= ds.dificil && ds.dificil >= ds.lenda)) prob.push(`descanso crescente ${N.map(n => ds[n]).join(' · ')}`);
      if (!(ch.facil < C.ACOES.boteIA.chancePorPasso)) prob.push(`Fácil+C ${f3(ch.facil)} ≥ Normal sem ${C.ACOES.boteIA.chancePorPasso}`);
      for (const n of N) if (!(ch[n] > orig[n].chancePorPasso)) prob.push(`${n}+C ${f3(ch[n])} não passa o ${n} sem (${f3(orig[n].chancePorPasso)})`);
      // o segura: o da IA × IA e o do jogo com a pessoa; sem o clássico, 1
      if (typeof S.seguraClassico !== 'function') prob.push('sem sim.js seguraClassico');
      else {
        // (sem a marca 1; no jogo com a pessoa, a IA contra ela com o seguraPessoa e os companheiros dela com 1; a IA × IA com o segura)
        const sg = [S.seguraClassico(fake('normal', false), 1), S.seguraClassico(fake('normal', true), 1), S.seguraClassico(fake('normal', true), 0),
          S.seguraClassico(fake('normal', true, true), 0), S.seguraClassico(fake('normal', true, true), 1)];
        const esp = [1, K.seguraPessoa, 1, K.segura, K.segura];
        if (sg.some((v, i) => v !== esp[i])) prob.push(`seguraClassico ${sg.join(' · ')} (esperado ${esp.join(' · ')})`);
      }
    }
    reg('K0. a tabela CLASSICO: chaves e sentidos; cfgBote sem a marca = ACOES.boteIA; com ela só a chance e o descanso mudam, pela fórmula; ordem dos níveis',
      prob.length ? prob.slice(0, 5).join('; ') : `ok (${Object.entries(C.CLASSICO).map(([k, v]) => `${k} ${v}`).join(', ')})`, 'ok', !prob.length);
  }

  // ----------------------------------------------------------------------------------------------- K1 a marca
  {
    const prob = [];
    const tem = o => { const m = P.criarPartida({ semente: 3, ...o }); return { tem: 'classico' in m, v: m.classico }; };
    const a = tem({ classico: true });
    if (!(a.tem && a.v === true)) prob.push(`{classico: true} → ${a.tem ? a.v : 'ausente'}`);
    for (const [nome, o] of [['sem o campo', {}], ['false', { classico: false }], ["'sim'", { classico: 'sim' }], ['1', { classico: 1 }], ["'true'", { classico: 'true' }]]) {
      const r = tem(o);
      if (r.tem) prob.push(`${nome} → campo escrito (${r.v})`);
    }
    const d = tem({ humanos: [0, 1], classico: true });
    if (!(d.tem && d.v === true)) prob.push(`dois humanos → ${d.tem ? d.v : 'ausente'}`);
    const lv = LV.criarLivre({ semente: 3, classico: true }), dp = DP.criarDisputa({ semente: 3, classico: true });
    if ('classico' in lv) prob.push('o Livre recebeu o campo');
    if ('classico' in dp) prob.push('os Pênaltis receberam o campo');
    reg('K1. a marca m.classico: só {classico: true} (=== true; também com dois humanos); ausente no resto, no Livre e nos Pênaltis',
      prob.length ? prob.join('; ') : 'ok', 'ok', !prob.length);
  }

  // ----------------------------------------------------------------------------------------------- K4 o árbitro igual
  const k4 = arbitroIgual(L);
  reg('K4. o árbitro igual: a grade de cenas com o MESMO resultado e o MESMO m.rng com e sem m.classico (faltas.js, regrasPartida, chanceDividida, semAtropelar)',
    k4.dif.length ? `DIFERENTE em ${k4.dif.length} de ${k4.n} chamadas: ${k4.dif.slice(0, 3).join('; ')}` : `iguais em ${k4.n} chamadas (${k4.cenas} cenas; ${k4.faltas} faltas, ${k4.rngGasto} com sorteio)`,
    'iguais', !k4.dif.length && k4.faltas > 0);

  // ----------------------------------------------------------------------------------------------- K5 o segura fora da área
  {
    const k5 = seguraNaArea(L);
    reg('K5. o segura do clássico não vale na própria área: faltaTatica com segura 2 = com 1 dentro dela (2000 sorteios); fora dela, mais faltas',
      `dentro: ${k5.area.dif} diferentes (${k5.area.f1} → ${k5.area.f2} faltas); fora: ${k5.fora.dif} diferentes (${k5.fora.f1} → ${k5.fora.f2})`,
      'dentro 0 diferentes (com faltas); fora > 0', k5.area.dif === 0 && k5.area.f1 > 0 && k5.fora.dif > 0 && k5.fora.f2 > k5.fora.f1);
  }

  // ----------------------------------------------------------------------------------------------- tarefas
  const cenas = ['demo', ...ROTS];
  const tarefasH = [];
  if (SO !== 'medida') {
    for (const cena of cenas) {
      tarefasH.push({ tipo: 'hash', chave: `${cena}-sem`, cena, sem: 1, min: MH });
      tarefasH.push({ tipo: 'hash', chave: `${cena}-false`, cena, sem: 1, min: MH, classico: false });
      tarefasH.push({ tipo: 'hash', chave: `${cena}-sim`, cena, sem: 1, min: MH, classico: 'sim' });
      tarefasH.push({ tipo: 'hash', chave: `${cena}-true`, cena, sem: 1, min: MH, classico: true });
      if (BASE_JS) tarefasH.push({ tipo: 'hash', chave: `${cena}-base`, cena, sem: 1, min: MH, base: true });
    }
    tarefasH.push({ tipo: 'ki', chave: 'ki', sem: 1, min: MH });
  }
  const chave = r => `${r.modo}|${r.sem}|${r.classico ? 1 : 0}|${r.dif}`;
  const prontas = new Map();
  for (const f of [...DE, ...(SEM_DE ? [SEM_DE] : [])]) {
    if (!fs.existsSync(f)) continue;
    for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      if (r.min !== MIN) continue;
      if (f === SEM_DE && r.classico) continue;
      prontas.set(chave(r), r);
    }
  }
  const tarefasJ = [];
  const quer = [];
  const pede = (modo, sem, classico, dif) => {
    const o = { modo, sem, classico, dif, min: MIN };
    quer.push(chave(o));
    if (!prontas.has(chave(o))) tarefasJ.push({ tipo: 'jogo', ...o, dificuldade: dif });
  };
  if (SO !== 'portao') {
    for (const cl of [false, true]) {
      for (let s = SEM0; s < SEM0 + NDEMO; s++) pede('demo', s, cl, 'normal');
      for (const rot of ROTS) for (let s = SEM0; s < SEM0 + NSEM; s++) pede(rot, s, cl, 'normal');
    }
    // a combinação com a dificuldade (C10): Fácil+C, Difícil+C e Lenda+C, e o Lenda sem (o clássico não pode tirar botes do Lenda)
    if (!SEM_DIF) for (const [dif, cl] of ARMS_DIF) for (const rot of ROTS) for (let s = SEM0; s < SEM0 + NDIF; s++) pede(rot, s, cl, dif);
  }
  const todas = [...tarefasH, ...tarefasJ];
  console.log(`  ${tarefasH.length} cenas de hash + ${tarefasJ.length} partidas (${quer.length - tarefasJ.length} reaproveitadas) em ${PAR} processos`);
  const res = await rodarTarefas(todas, instr);
  fs.rmSync(instr, { recursive: true, force: true });
  const H = {};
  tarefasH.forEach((t, k) => { H[t.chave] = res[k]; });
  tarefasJ.forEach((t, k) => { const r = res[tarefasH.length + k]; r.min = MIN; prontas.set(chave(r), r); });
  const jogos = quer.map(k => prontas.get(k)).filter(Boolean);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(jogos));

  // ----------------------------------------------------------------------------------------------- K2 e KI
  if (SO !== 'medida') {
    const iguais = (a, b) => a && b && a.h.length === b.h.length && a.h.every((x, k) => x === b.h[k]);
    const dif = [], campo = [], igTrue = [];
    let nH = 0;
    for (const cena of cenas) {
      const ref = H[`${cena}-sem`];
      nH += ref.h.length;
      if (ref.tem || ref.temDepois) campo.push(`${cena} sem`);
      for (const v of ['false', 'sim', ...(BASE_JS ? ['base'] : [])]) {
        const o = H[`${cena}-${v}`];
        if (v !== 'base' && (o.tem || o.temDepois)) campo.push(`${cena} ${v}`);
        if (!iguais(ref, o)) dif.push(`${cena} ${v}`);
      }
      const t = H[`${cena}-true`];
      if (iguais(ref, t)) igTrue.push(cena);
      else {
        const k = t.h.findIndex((x, i) => x !== ref.h[i]);
        if (k >= 0) H[`${cena}-1dif`] = (k + 1) * CADA;
      }
    }
    const pri = cenas.filter(c => H[`${c}-1dif`]).map(c => `${c} ≤ ${H[`${c}-1dif`]}`).join(', ');
    reg(`K2. o hash: sem × {classico: false} × {classico: "sim"}${BASE_JS ? ' × a base' : ''} IGUAIS; {classico: true} DIFERENTE (demo + 4 roteiros, 2 × ${MH} min, a cada ${CADA} passos)`,
      `${dif.length ? `DIFERENTE em ${dif.join(', ')}` : `iguais (${nH} hashes)`}; campo ${campo.length ? `em ${campo.join(', ')}` : 'nunca'}; com o clássico ${igTrue.length ? `IGUAL em ${igTrue.join(', ')}` : `diferente em todas (1º passo diferente: ${pri})`}`,
      'iguais; nunca; diferente em todas', !dif.length && !campo.length && !igTrue.length);
    const ki = H.ki, ref = H['demo-sem'];
    reg('KI. a instrumentação só lê: a cópia com os ganchos ligados = a lógica original (demo, semente 1, 2 × 2 min)',
      iguais(ki, ref) ? `iguais (${ref.h.length} hashes)` : 'DIFERENTE', 'iguais', iguais(ki, ref));
  }
  if (SO === 'portao') return fechar();

  // ----------------------------------------------------------------------------------------------- as medidas
  const semPar = jogos.filter(r => !r.fim).length;
  const arm = (cl, dif = 'normal') => jogos.filter(r => r.classico === cl && r.dif === dif);
  const COM = arm(true), SEM = arm(false);
  // os times "da IA": a demo os dois; os roteiros o time 1 (o time 0 é a pessoa e os companheiros: C11)
  const timesIA = r => (r.modo === 'demo' ? [0, 1] : [1]);
  const somaIA = (Ls, f) => { let s = 0; for (const r of Ls) for (const t of timesIA(r)) s += f(r.t[t]); return s; };
  const somaTodos = (Ls, f) => { let s = 0; for (const r of Ls) for (const t of [0, 1]) s += f(r.t[t]); return s; };
  const somaR = (Ls, f) => { let s = 0; for (const r of Ls) s += f(r); return s; };
  const esp = t => t.bEsp + t.cSomaP + t.tSomaP;
  const MED = {
    botes: Ls => somaIA(Ls, t => t.tenta) / Ls.length,
    faltasEsp: Ls => somaIA(Ls, esp) / Ls.length,
    faltas: Ls => somaIA(Ls, t => t.faltas) / Ls.length,
    chance: Ls => somaIA(Ls, t => t.bSomaP + t.cSomaP) / Math.max(1e-9, somaIA(Ls, t => t.bAval + t.cAval)),
    chanceBote: Ls => somaIA(Ls, t => t.bSomaP) / Math.max(1e-9, somaIA(Ls, t => t.bAval)),
    amarelos: Ls => somaIA(Ls, t => t.amarelos) / Ls.length,
    amPorFalta: Ls => somaIA(Ls, t => t.amarelos) / Math.max(1e-9, somaIA(Ls, t => t.faltas)),
    vermelhos: Ls => somaIA(Ls, t => t.vermelhos) / Ls.length,
    gols: Ls => somaTodos(Ls, t => t.gols) / Ls.length,
    chutes: Ls => somaTodos(Ls, t => t.chutes) / Ls.length,
    rol: Ls => somaR(Ls, r => r.rolTk) / 3600 / Ls.length,
    volume: Ls => 3600 * somaTodos(Ls, t => t.vol) / Math.max(1e-9, somaTodos(Ls, t => t.volTk)),
    disparada: Ls => somaTodos(Ls, t => t.disp) / Math.max(1e-9, somaTodos(Ls, t => t.volTk)),
    presenca: Ls => somaIA(Ls, t => t.pres) / Math.max(1e-9, somaIA(Ls, t => t.presN)),
    // a combinação (roteiros): botes da IA por minuto de posse da pessoa
    botesPosse: Ls => somaR(Ls, r => r.t[1].tenta) / Math.max(1e-9, somaR(Ls, r => r.t[0].posse) / 3600),
    faltasIA1: Ls => somaR(Ls, r => r.t[1].faltas) / Ls.length,
    // os companheiros da pessoa (roteiros, time 0 sem o controlado)
    botesComp: Ls => somaR(Ls, r => r.t[0].tenta) / Ls.length,
    faltasComp: Ls => somaR(Ls, r => r.t[0].faltas) / Ls.length,
    botesT0: Ls => somaR(Ls, r => r.t[0].tenta) / Ls.length,
    // o time da pessoa (roteiros, time 0: ela e os companheiros) — o clássico não pode virar a dificuldade de cima (C6p/C7p)
    golsP: Ls => somaR(Ls, r => r.t[0].gols) / Ls.length,
    chutesP: Ls => somaR(Ls, r => r.t[0].chutes) / Ls.length,
    posseP: Ls => somaR(Ls, r => r.t[0].posse) / 60 / Ls.length,
    golsIA1: Ls => somaR(Ls, r => r.t[1].gols) / Ls.length,
    chutesIA1: Ls => somaR(Ls, r => r.t[1].chutes) / Ls.length,
    botesT1: Ls => somaR(Ls, r => r.t[1].tenta) / Ls.length,
    contatos: Ls => somaR(Ls, r => r.contatos) / Ls.length,
  };
  const kp = r => `${r.modo}|${r.sem}`;
  /** Bootstrap pareado e estratificado por modo de f(lista A, lista B): {r, p5, p95, n}. */
  function boot(A, B, f) {
    const mA = new Map(A.map(r => [kp(r), r])), mB = new Map(B.map(r => [kp(r), r]));
    const modos = [...new Set(A.map(r => r.modo))];
    const estratos = modos.map(md => [...mA.keys()].filter(k => k.startsWith(md + '|') && mB.has(k))).filter(e => e.length);
    const lA = estratos.flat().map(k => mA.get(k)), lB = estratos.flat().map(k => mB.get(k));
    if (!lA.length) return null;
    const r = f(lA, lB);
    let st = 0x9e3779b9;
    const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
    const rs = [];
    for (let b = 0; b < BOOT; b++) {
      const ks = estratos.flatMap(E => E.map(() => E[Math.floor(rnd() * E.length)]));
      rs.push(f(ks.map(k => mA.get(k)), ks.map(k => mB.get(k))));
    }
    rs.sort((x, y) => x - y);
    return { r, p5: rs[Math.floor(0.05 * BOOT)], p95: rs[Math.floor(0.95 * BOOT) - 1], n: lA.length };
  }
  const razao = (med, A, B) => boot(A, B, (a, b) => MED[med](a) / MED[med](b));
  const fr = x => (x ? `${f2(x.r)} [${f2(x.p5)}–${f2(x.p95)}]` : '—');
  const so = (Ls, md) => Ls.filter(r => (md === 'rot' ? r.modo !== 'demo' : r.modo === md));
  const temMed = COM.length && SEM.length;
  const faixa = (x, lo, hi) => {
    if (!x) return { ok: false, txt: 'sem amostra' };
    const fal = [];
    if (lo != null && x.p95 < lo) fal.push(`PROVADO abaixo de ${f2(lo)}`);
    if (hi != null && x.p5 > hi) fal.push(`PROVADO acima de ${f2(hi)}`);
    return { ok: !fal.length, txt: `${fr(x)}${fal.length ? ` — ${fal.join(', ')}` : ''}` };
  };
  const grupos = x => `demo ${fr(razao(x, so(COM, 'demo'), so(SEM, 'demo')))} · roteiros ${fr(razao(x, so(COM, 'rot'), so(SEM, 'rot')))}`;

  if (temMed) {
    // K3
    {
      const err = somaR(jogos, r => r.t[0].cfgErr + r.t[1].cfgErr), ok = somaR(jogos, r => r.t[0].cfgOk + r.t[1].cfgOk);
      const ex = jogos.find(r => r.t[0].cfgErrEx || r.t[1].cfgErrEx);
      const ctrl = somaR(jogos, r => r.t[0].oportCtrl + r.t[0].tentaCtrl + r.t[1].oportCtrl + r.t[1].tentaCtrl);
      const d0 = razao('botesT0', so(COM, 'demo'), so(SEM, 'demo')), d1 = razao('botesT1', so(COM, 'demo'), so(SEM, 'demo'));
      const subOk = d0 && d1 && !(d0.p95 <= 1) && !(d1.p95 <= 1);
      reg('K3. os dois times, nunca o controlado: o cfg de cada tentativa = cfgBote(m, time); o controlado com 0 oportunidades e 0 tentativas; na demo as tentativas dos DOIS times sobem (nenhum provado ≤ 1)',
        `cfg certo ${ok}, errado ${err}${ex ? ` (${ex.modo} s${ex.sem} ${ex.t[0].cfgErrEx || ex.t[1].cfgErrEx})` : ''}; controlado ${ctrl}; demo time 0 ${fr(d0)}, time 1 ${fr(d1)}`,
        'errado 0; controlado 0; nenhum provado ≤ 1', err === 0 && ok > 0 && ctrl === 0 && subOk);
    }
    // C1 e C2: POR MODO (a IA × IA e contra a pessoa têm vontades próprias; juntas, uma escondia a outra)
    const pct = v => `${v >= 1 ? '+' : '−'}${Math.abs(100 * (v - 1)).toFixed(0)}%`;
    const porModo = (nome, med, META, alvoTxt, info = false) => {
      for (const md of ['demo', 'rot']) {
        const A = so(COM, md), B = so(SEM, md);
        if (!A.length || !B.length) continue;
        const [lo, hi] = META[md], a = faixa(razao(med, A, B), lo, hi);
        reg(`${nome} — ${md === 'demo' ? 'IA × IA (demo)' : 'contra a pessoa (roteiros)'}`, `${a.txt} (${f2(MED[med](B))} → ${f2(MED[med](A))} por partida)`,
          info ? 'informativo no CI (a meta no --completo)' : `${alvoTxt(lo, hi)} (reprova se provar < ${pct(lo)} ou > ${pct(hi)})`, a.ok, info);
      }
    };
    porModo('C1. botes da IA (tentativas; demo os dois times, roteiros o time da IA), com ÷ sem', 'botes', META_C1, (lo, hi) => (lo >= 1.2 ? '+25–50%' : '+15–50%'));
    porModo('C2. faltas ESPERADAS da IA (Σ p do árbitro: bote · cuidado, carga, batido que segura), com ÷ sem', 'faltasEsp', META_C2, () => '+25–50%');
    porModo('C2m. faltas MARCADAS da IA, com ÷ sem', 'faltas', META_C2, () => '+25–50%', !COMPLETO);
    // C3b (também só o bote: a carga junto diluía a alta do bote — revisão do item 35)
    {
      const x = razao('chance', COM, SEM), a = faixa(x, 0.90, 1.10);
      const b = faixa(razao('chanceBote', COM, SEM), 0.90, 1.10);
      reg('C3b. a chance de falta por contato (Σ p ÷ N do árbitro nos botes e cargas avaliados), com ÷ sem', `${a.txt} (${f3(MED.chance(SEM))} → ${f3(MED.chance(COM))})`,
        'em [0,90; 1,10] (reprova se provar fora)', a.ok);
      reg('C3c. a chance de falta por contato SÓ no bote, com ÷ sem', `${b.txt} (${f3(MED.chanceBote(SEM))} → ${f3(MED.chanceBote(COM))}; demo ${fr(razao('chanceBote', so(COM, 'demo'), so(SEM, 'demo')))} · roteiros ${fr(razao('chanceBote', so(COM, 'rot'), so(SEM, 'rot')))})`,
        'em [0,90; 1,10] (reprova se provar fora)', b.ok);
    }
    // C4
    {
      const x = razao('amarelos', COM, SEM);
      const a = COMPLETO ? faixa(x, 1.10, 1.80) : faixa(x, 1.0, 2.0);
      const y = razao('amPorFalta', COM, SEM), b = faixa(y, null, 1.40);
      reg('C4. amarelos da IA, com ÷ sem', `${a.txt} (${f2(MED.amarelos(SEM))} → ${f2(MED.amarelos(COM))} por partida); amarelo por falta ${b.txt}`,
        COMPLETO ? '+20–60% (reprova se provar < +10% ou > +80%); por falta sem provar > +40%' : 'reprova se provar > +100% ou < 0%; por falta sem provar > +40%', a.ok && (!COMPLETO || b.ok));
    }
    // C5
    {
      const parte = [];
      let ok = true;
      for (const [nome, Ls] of [['Normal+C', COM], ['Difícil+C', arm(true, 'dificil')], ['Lenda+C', arm(true, 'lenda')]]) {
        if (!Ls.length) continue;
        const k = somaIA(Ls, t => t.vermelhos), n = Ls.length, pv = caudaPoisson(k, 0.2 * n);
        if (pv < 0.05) ok = false;
        parte.push(`${nome} ${k} em ${n} (${f2(k / n)}/partida; P(≥ ${k} | 0,2) = ${f3(pv)})`);
      }
      const ks = somaIA(SEM, t => t.vermelhos);
      reg('C5. vermelhos da IA com o clássico ≤ 0,2 por partida (Poisson)', `${parte.join(' · ')}; sem o clássico ${ks} em ${SEM.length}`, '≤ 0,2 (reprova se P < 0,05)', ok);
    }
    // C6–C8
    {
      const g = faixa(razao('gols', COM, SEM), 0.75, 1.10);
      reg('C6. gols (os dois times), com ÷ sem', `${g.txt} (${f2(MED.gols(SEM))} → ${f2(MED.gols(COM))})`, 'sem queda provada > 25% nem alta provada > 10%', g.ok);
      const c = faixa(razao('chutes', COM, SEM), 0.85, null);
      reg('C7. chutes (os dois times), com ÷ sem', `${c.txt} (${f2(MED.chutes(SEM))} → ${f2(MED.chutes(COM))})`, 'sem queda provada > 15%', c.ok);
      const b = faixa(razao('rol', COM, SEM), null, 1.0);
      reg('C8. bola rolando (min por partida), com ÷ sem', `${b.txt} (${f2(MED.rol(SEM))} → ${f2(MED.rol(COM))})`, 'informativo; reprova se provar alta', b.ok);
    }
    // C6p e C7p: o time da PESSOA (roteiros, time 0) — o clássico não vira a dificuldade de cima (revisão do item 35: com a vontade
    // 2,6 nos dois times a pessoa chutava 34% menos e fazia 40% menos gols, e os números da IA não mudavam)
    {
      const A = so(COM, 'rot'), B = so(SEM, 'rot');
      if (A.length && B.length) {
        const g = faixa(razao('golsP', A, B), 0.75, null), c = faixa(razao('chutesP', A, B), 0.85, null);
        const ps = razao('posseP', A, B), gi = razao('golsIA1', A, B), ci = razao('chutesIA1', A, B);
        reg('C6p. gols do time da pessoa (roteiros), com ÷ sem', `${g.txt} (${f2(MED.golsP(B))} → ${f2(MED.golsP(A))}; da IA ${fr(gi)})`, 'sem queda provada > 25%', g.ok);
        reg('C7p. chutes do time da pessoa (roteiros), com ÷ sem', `${c.txt} (${f2(MED.chutesP(B))} → ${f2(MED.chutesP(A))}; da IA ${fr(ci)}; a posse da pessoa ${fr(ps)})`, 'sem queda provada > 15%', c.ok);
        // C12: os cartões do time da pessoa (ela e os companheiros) ÷ os da IA, com × sem. Teste condicional: dados os cartões do
        // time da pessoa nos dois braços, a parte do braço com o clássico segue a binomial com a parte dos cartões da IA (a razão
        // igual); reprova se a subida do lado da pessoa for PROVADA (P < 0,05). Revisão do item 35: 10 → 23 do lado da pessoa com
        // os da IA iguais (a subida dos cartões ia toda para o lado errado)
        const cart = (Ls, t) => somaR(Ls, r => r.t[t].amarelos + r.t[t].vermelhos);
        const pC = cart(A, 0), pS = cart(B, 0), iC = cart(A, 1), iS = cart(B, 1);
        const q = iC + iS > 0 ? iC / (iC + iS) : 0.5, n = pC + pS;
        let pv = 0;
        for (let k = pC; k <= n; k++) pv += binom(n, k) * q ** k * (1 - q) ** (n - k);
        if (!n) pv = 1;
        reg('C12. cartões do time da pessoa ÷ cartões da IA (roteiros), com × sem', `pessoa ${pS} → ${pC}, IA ${iS} → ${iC} (P(≥ ${pC} de ${n} | ${f3(q)}) = ${f3(pv)})`,
          'sem subida provada do lado da pessoa (reprova se P < 0,05)', pv >= 0.05);
      }
    }
    // C9
    {
      const v = faixa(razao('volume', COM, SEM), null, 1.05), d = faixa(razao('disparada', COM, SEM), null, 1.10), p = faixa(razao('presenca', COM, SEM), null, 1.08);
      reg('C9. intensidade (guiados pela IA de linha): volume (m/min de bola rolando), disparada (> 7 m/s), presença (adversário a ≤ 5 m do condutor)',
        `volume ${v.txt} (${f2(MED.volume(SEM))} → ${f2(MED.volume(COM))} m/min); disparada ${d.txt}; presença ${p.txt} (${f3(MED.presenca(SEM))} → ${f3(MED.presenca(COM))})`,
        'volume ≤ +5%, disparada ≤ +10%, presença ≤ +8% (reprova se provar acima)', v.ok && d.ok && p.ok);
    }
    // C10
    if (!SEM_DIF) {
      const FC = arm(true, 'facil'), DC = arm(true, 'dificil'), LC = arm(true, 'lenda'), LS = arm(false, 'lenda'), NC = so(COM, 'rot'), NS = so(SEM, 'rot');
      const fal = [], partes = [];
      if (FC.length && DC.length && LC.length && LS.length) {
        const a = razao('botesPosse', FC, NC), b = razao('botesPosse', NC, DC), e = razao('botesPosse', DC, LC), c = razao('botesPosse', FC, NS);
        const g = razao('botesPosse', LS, LC), d = razao('faltasIA1', LC, NC);
        partes.push(`Fácil+C/Normal+C ${fr(a)}`, `Normal+C/Difícil+C ${fr(b)}`, `Difícil+C/Lenda+C ${fr(e)}`, `Fácil+C/Normal sem ${fr(c)}`,
          `Lenda sem/Lenda+C ${fr(g)}`, `faltas Lenda+C/Normal+C ${fr(d)}`);
        // (os degraus vizinhos de ~10–20% não se provam com 16 partidas por nível: no CI só o lado errado provado reprova, e o K0
        // confere a ordem ESTRITA nos parâmetros; no --completo, 32 por nível, os degraus PROVADOS. O Lenda+C nunca com MENOS botes
        // que o Lenda sem — revisão do item 35: com o teto comum o clássico chegava a tirar botes do Lenda. O Normal+C × Difícil+C
        // só pelo lado errado também no --completo: os parâmetros guardam a razão de sem o clássico — chance × 1,48, descanso ÷ 1,33
        // — mas o bote SATURA no jogo (mais chance por passo fecha a janela antes) e o degrau de 1,25× sem o clássico vira ~1,07×:
        // 0,93 [0,85–1,02] em 32 pares, a revisão; "Depende do dono" 23)
        const viz = (x, nome, sempreLado = false) => {
          if (COMPLETO && !sempreLado ? !(x.p95 < 1) : x.p5 > 1) fal.push(COMPLETO && !sempreLado ? `${nome} não provado` : `${nome} com o lado errado PROVADO`);
        };
        if (!(a.p95 < 1)) fal.push('Fácil+C < Normal+C não provado');
        viz(b, 'Normal+C < Difícil+C', true);
        viz(e, 'Difícil+C < Lenda+C');
        viz(c, 'Fácil+C < Normal sem');
        if (g.p5 > 1) fal.push('Lenda+C com MENOS botes que o Lenda sem PROVADO');
        if (d.p5 > 1.8) fal.push('faltas Lenda+C > 1,8× Normal+C PROVADO');
      } else fal.push('sem as partidas da dificuldade');
      reg('C10. clássico × dificuldade (roteiros): botes da IA por minuto de posse da pessoa e faltas da IA', `${partes.join(' · ')}${fal.length ? ` — ${fal.join('; ')}` : ''}`,
        COMPLETO ? 'Fácil+C < Normal+C, Difícil+C < Lenda+C e Fácil+C < Normal sem provados; Normal+C × Difícil+C sem o lado errado provado; Lenda+C não abaixo do Lenda; faltas Lenda+C ≤ 1,8× (p5)'
          : 'Fácil+C < Normal+C provado; os outros degraus sem o lado errado provado; Lenda+C não abaixo do Lenda; faltas Lenda+C ≤ 1,8× (p5)', !fal.length);
    }
    // C11
    {
      const a = razao('botesComp', so(COM, 'rot'), so(SEM, 'rot')), b = razao('faltasComp', so(COM, 'rot'), so(SEM, 'rot'));
      reg('C11. companheiros da pessoa (roteiros): tentativas e faltas, com ÷ sem', `tentativas ${fr(a)} (${f2(MED.botesComp(so(SEM, 'rot')))} → ${f2(MED.botesComp(so(COM, 'rot')))}); faltas ${fr(b)}`, '—', true, true);
    }
    // a tabela (informativa)
    const tab = [['', 'partidas', 'botes', 'oport./tent.', 'faltas esp.', 'faltas', 'bote/carga/tática/segurar', 'falta/semGanhar/limpo/evitado %', 'chance/contato', 'amarelos', 'vermelhos', 'pênaltis', 'roubadas', 'boteErrado', 'gols', 'chutes', 'rolando', 'm/min', 'presença', 'contatos']];
    const linha = (nome, Ls) => {
      const o = k => somaIA(Ls, t => t.origem[k] ?? 0) / Ls.length;
      const des = ['rFalta', 'rSemGanhar', 'rLimpo', 'rEvitado'].map(k => somaIA(Ls, t => t[k])), td = des.reduce((a, b) => a + b, 0) || 1;
      tab.push([nome, Ls.length, f2(MED.botes(Ls)), f2(somaIA(Ls, t => t.oport) / Math.max(1, somaIA(Ls, t => t.tenta))), f2(MED.faltasEsp(Ls)), f2(MED.faltas(Ls)),
        ['bote', 'carga', 'tatica', 'segurar'].map(k => f2(o(k))).join('/'), des.map(x => (100 * x / td).toFixed(0)).join('/'), f3(MED.chance(Ls)),
        f2(MED.amarelos(Ls)), f2(MED.vermelhos(Ls)), f2(somaIA(Ls, t => t.penaltis) / Ls.length), f2(somaIA(Ls, t => t.roubadas) / Ls.length),
        f2(somaIA(Ls, t => t.boteErrado) / Ls.length), f2(MED.gols(Ls)), f2(MED.chutes(Ls)), f2(MED.rol(Ls)), f2(MED.volume(Ls)), f3(MED.presenca(Ls)), f2(MED.contatos(Ls))]);
    };
    for (const md of ['demo', ...ROTS]) {
      const a = so(SEM, md), b = so(COM, md);
      if (a.length) linha(`${md} sem`, a);
      if (b.length) linha(`${md} com`, b);
    }
    linha('roteiros sem', so(SEM, 'rot')); linha('roteiros com', so(COM, 'rot'));
    for (const [d, cl] of ARMS_DIF) { const Ls = arm(cl, d); if (Ls.length) linha(`roteiros ${d}${cl ? '+C' : ' sem'}`, Ls); }
    console.log(tab.map(l => l.join(' | ')).join('\n'));
    console.log(`\n${jogos.length} partidas de 2 × ${MIN} min (demo ${NDEMO} + ${ROTS.join(', ')} × ${NSEM} desde ${SEM0}, por braço${SEM_DIF ? '' : `; Fácil+C, Difícil+C, Lenda+C e Lenda sem × ${NDIF}`}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else reg('as partidas existem', 'sem partidas', '—', false);
  if (semPar) reg('as partidas chegam ao fim', `${semPar} não chegaram`, 'todas', false);
  return fechar();

  function fechar() {
    const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
    console.log('\n' + linhas.map(l => l.map((x, c) => String(x).padEnd(Math.min(larg[c], 160))).join(' | ')).join('\n'));
    console.log(falhas ? `\nteste-classico: REPROVOU (${falhas})` : '\nteste-classico: PASSOU');
    process.exit(falhas ? 1 : 0);
  }
}

// ------------------------------------------------------------------------------------------- K5 o segura fora da área
/**
 * A cena do batido que segura: o condutor A (time 0) com a bola indo para o gol a 5 m/s, o defensor D (time 1) colado atrás
 * (0,9 m), um defensor do time 1 no caminho (não é chance clara) e o resto atrás da bola (≤ 2 à frente: ataque promissor). Dentro
 * da área do time 1 (x = 44) e fora dela (x = 25). Para cada estado do sorteio, faltaTatica com segura 1 e 2 a partir do MESMO
 * estado: dentro da área o resultado tem de ser o mesmo; fora, o segura 2 dá mais faltas.
 */
function seguraNaArea(L) {
  const { P, F, R } = L;
  const out = {};
  for (const [nome, u] of [['area', 44], ['fora', 25]]) {
    const m = P.criarPartida({ semente: 3 });
    m.partida.estado = 'jogo'; m.parada = null; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
    const s = m.ataca[0];
    const A = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
    const lin = m.jogadores.filter(j => j.time === 1 && j.posicao !== 'GOL');
    const D = lin[0], B = lin[1];
    for (const j of m.jogadores) {
      if (j === A || j === D || j === B) continue;
      if (j.posicao === 'GOL') P.teleportar(j, s * 51 * (j.time === 1 ? 1 : -1), 0, 0);
      else P.teleportar(j, -s * (20 + (j.vagaIdx ?? 0)), ((j.vagaIdx ?? 0) - 5) * 3, 0);
    }
    P.teleportar(A, s * u, 2, s > 0 ? 0 : Math.PI); A.vx = s * 5; A.vz = 0;
    P.teleportar(D, s * (u - 0.9), 2, s > 0 ? 0 : Math.PI); D.vx = s * 5; D.vz = 0;
    P.teleportar(B, s * (u + 4), 2, s > 0 ? Math.PI : 0); B.vx = 0; B.vz = 0;
    m.bola.p.x = s * (u + 0.35); m.bola.p.z = 2; m.bola.p.y = 0.11; m.posse = A.id; m.eventos = []; m.faltaPendente = null;
    if (F.chanceClara(m, A, D) || !F.ataquePromissor(m, A)) throw new Error(`K5: a cena ${nome} não é ataque promissor sem chance clara`);
    const r = { dif: 0, f1: 0, f2: 0 };
    for (let k = 1; k <= 2000; k++) {
      const st = R.criarRng(k);
      m.rng = structuredClone(st); const a = F.faltaTatica(m, D, A, 1);
      m.rng = structuredClone(st); const b = F.faltaTatica(m, D, A, 2);
      if (a) r.f1++;
      if (b) r.f2++;
      if (!!a !== !!b) r.dif++;
    }
    out[nome] = r;
  }
  return out;
}

// ------------------------------------------------------------------------------------------- K4 o árbitro igual
/**
 * A grade de cenas montadas: o condutor A (time 0, atacando +x) com a bola e o defensor D (time 1) chegando de frente, de lado
 * ou por trás, com velocidades, desarme, fora/dentro da área e com/sem chance clara; e o espelho (o condutor do time 1 e o
 * defensor do time 0 — o time da pessoa — para o semAtropelar). Cada cena é montada uma vez e clonada nos dois mundos (sem e com
 * m.classico); as funções do árbitro são chamadas na mesma ordem nos dois e o resultado e o m.rng comparados a cada chamada.
 */
function arbitroIgual(L) {
  const { P, F } = L;
  const base = [1, 2, 3].map(sem => {
    const m = P.criarPartida({ semente: sem });
    m.partida.estado = 'jogo'; m.parada = null; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
    return m;
  });
  const out = { n: 0, cenas: 0, faltas: 0, rngGasto: 0, dif: [] };
  const sj = v => JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
  let k = 0;
  for (const cheg of ['frente', 'lado', 'tras']) for (const vd of [1, 3, 5, 7, 8.5]) for (const vc of [0, 2, 4, 6]) for (const des of [40, 65, 90])
    for (const area of [false, true]) for (const clara of [false, true]) {
      k++;
      const mb = base[k % 3];
      const montar = espelho => {
        const m = structuredClone(mb);
        const ta = espelho ? 1 : 0, td = 1 - ta, s = m.ataca[ta];
        const A = m.jogadores.find(j => j.time === ta && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === ta && j.posicao !== 'GOL');
        const D = m.jogadores.find(j => j.time === td && j.posicao === 'ZAG' && j.id !== m.controlado[td]) ?? m.jogadores.find(j => j.time === td && j.posicao !== 'GOL' && j.id !== m.controlado[td]);
        const ax = s * (area ? 42 : 18), az = 2;
        for (const j of m.jogadores) {
          if (j === A || j === D) continue;
          if (j.posicao === 'GOL') P.teleportar(j, -s * 51 * (j.time === ta ? 1 : -1), 0, 0);
          else if (j.time === td && !clara && (j.vagaIdx ?? 0) < 4) P.teleportar(j, ax + s * (5 + (j.vagaIdx ?? 0)), az + ((j.vagaIdx ?? 0) - 1.5) * 2, 0);
          else P.teleportar(j, -s * (25 + (j.vagaIdx ?? 0)), ((j.vagaIdx ?? 0) - 5) * 3, 0);
        }
        P.teleportar(A, ax, az, s > 0 ? 0 : Math.PI); A.vx = s * vc; A.vz = 0;
        const off = cheg === 'frente' ? [s * 0.9, 0] : cheg === 'tras' ? [-s * 0.9, 0] : [0, 0.9];
        P.teleportar(D, ax + off[0], az + off[1], 0);
        const l = Math.hypot(off[0], off[1]);
        D.vx = -off[0] / l * vd; D.vz = -off[1] / l * vd; D.rumo = Math.atan2(D.vz, D.vx);
        D.par.attr.desarme = des;
        m.bola.p.x = ax + s * 0.35; m.bola.p.z = az; m.bola.p.y = 0.11; m.posse = A.id;
        m.eventos = []; m.faltaPendente = null;
        return { m, A, D };
      };
      for (const esp of [false, true]) {
        out.cenas++;
        const W0 = montar(esp), W1 = montar(esp);
        W1.m.classico = true;
        const chamadas = [
          ['chanceFaltaBote', w => F.chanceFaltaBote(w.D, w.A)],
          ['fatorForca', w => F.fatorForca(F.forcaContato(w.m, w.D, w.A))],
          ['chanceFaltaDividida perdeu', w => F.chanceFaltaDividida(w.m, w.D, w.A, 'perdeu')],
          ['chanceFaltaDividida tocou', w => F.chanceFaltaDividida(w.m, w.D, w.A, 'tocou')],
          ['chanceClara', w => F.chanceClara(w.m, w.A, w.D)],
          ['ataquePromissor', w => F.ataquePromissor(w.m, w.A)],
          ['faltaNoBote', w => F.faltaNoBote(w.m, w.D, w.A, false)],
          ['faltaNoBote lento', w => F.faltaNoBote(w.m, w.D, w.A, true)],
          ['faltaNaCarga', w => F.faltaNaCarga(w.m, w.A, w.D, vd)],
          ['faltaTatica', w => F.faltaTatica(w.m, w.D, w.A)],
          // (o mesmo `segura` nos dois mundos: o árbitro não lê a marca — quem passa o segura do clássico é o sim.js boteIA)
          ['faltaTatica segura 2', w => F.faltaTatica(w.m, w.D, w.A, 2)],
          ['faltaNoCarrinho antes', w => F.faltaNoCarrinho(w.m, w.D, w.A, { depois: false, f: vd, fExc: vd, v: vd, tentouBola: true })],
          ['faltaNoCarrinho depois', w => F.faltaNoCarrinho(w.m, w.D, w.A, { depois: true, f: vd, fExc: vd, v: vd, tentouBola: true })],
          ['montarFalta bote', w => F.montarFalta(w.m, w.D, w.A, 'bote', true)],
          ['montarFalta carga', w => F.montarFalta(w.m, w.D, w.A, 'carga', false)],
          ['chanceDividida', w => L.DF.chanceDividida(w.D, w.A, w.m.bola.p.x, w.m.bola.p.z)],
          ['semAtropelar', w => L.DF.semAtropelar(w.m, w.D, { dx: Math.sign(w.A.x - w.D.x) || 1, dz: 0, vel: vd, x: 0, z: 0, botoes: 0 })],
          ['regrasPartida (falta pendente)', w => { w.m.eventos = []; w.m.faltaPendente = F.montarFalta(w.m, w.D, w.A, 'bote', true); P.regrasPartida(w.m); return { ev: w.m.eventos, pr: w.m.parada, v: w.m.partida.vantagem, c: w.m.partida.cartoesPendentes }; }],
        ];
        for (const [nome, fn] of chamadas) {
          out.n++;
          const r0 = sj(W0.m.rng), a = sj(fn(W0)), b = sj(fn(W1));
          const g0 = sj(W0.m.rng), g1 = sj(W1.m.rng);
          if (g0 !== r0) out.rngGasto++;
          if (a !== b || g0 !== g1) out.dif.push(`${nome} (${cheg}, vd ${vd}, vc ${vc}, des ${des}${area ? ', área' : ''}${clara ? ', clara' : ''}${esp ? ', espelho' : ''})`);
          if (nome.startsWith('faltaNo') || nome === 'faltaNaCarga' || nome === 'faltaTatica') { const x = JSON.parse(a); if (x && x.def != null) out.faltas++; }
        }
      }
    }
  return out;
}
