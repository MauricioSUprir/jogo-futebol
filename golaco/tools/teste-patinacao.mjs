// Pés desenhados (seção 4): o tornozelo da pose (anim.js) em TODOS os quadros, inclusive os da
// saída do chão, do pouso e dos toques na bola — nenhum quadro é descartado. Pelo caminho real
// da página (sessao.js: criarTreino + passoTreino), em 18 cenas: trote, corrida, arrancada,
// curvas, zigue-zague, giros (também em arrancada), corte em arrancada, para e sai, parado
// girando, máquina de passes (domínio parado e andando), marcador (proteção e corrida),
// pedaladas e a demo — e o treino de ataque jogado pela IA (10 jogadores, três sementes) e a
// partida 11×11 IA × IA (Etapa 3: os 22, duas sementes; sem a IA com a bola da Parte 3, quem está
// com a bola no pé é o ataque substituto dos testes, tools/lib/partida-tatica.mjs), mais uma partida
// com bolas paradas forçadas a cada ~7 s (tiro de meta com atacantes na área, escanteio e lateral com
// adversários no raio: todos têm de SAIR andando, pela locomoção). Os quadros que teletransportam
// (saída de bola, lateral, escanteio, tiro de meta, intervalo e o quadro em que a cena força a
// parada) não contam.
//
// Metas (todas pelo MÁXIMO, não pela média):
//  1. Pé plantado não anda: com o pé apoiado no MESMO ponto na simulação nos dois quadros, o
//     tornozelo desenhado anda ≤ 0,05 m/s.
//  2. Pé nenhum salta: em todo quadro, deslocamento do tornozelo ≤ (2,5·v + 3 m/s)·dt, com v a
//     velocidade do corpo. Correndo, o pico do pé no balanço é 2,00 ± 0,15 × v (Clark et al. 2023,
//     J Hum Kinet) — 2,5·v fica 3 desvios acima; andando, o pé passa a ~4,6 m/s a ~1,3 m/s
//     (van der Straaten et al. 2020) e o piso de 3 m/s cobre um passo saindo do parado.
//  3. Pouso suave: no quadro em que a simulação planta o pé, o tornozelo anda no máximo a
//     velocidade de um pé real tocando o chão: 0,19·v + 0,81 m/s (Clark et al. 2023, "GSD").
//   node tools/teste-patinacao.mjs [--detalhe]
import { criarTreino, passoTreino, entradaDemo, DEMO } from '../js/sessao.js';
import { pose, J, NJ } from '../js/anim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { fmt, tabelaTexto } from './lib/medidas.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as PT from './lib/partida-tatica.mjs';

// partida 11×11 (Etapa 3): pela lib dos testes da partida, com a lógica do repositório
const LP = await PT.carregar(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js'));
const ATAQUE_PARTIDA = PT.parte3Presente(LP) ? 'jogo' : 'substituto';
const SALTA = new Set(['recomeco', 'saida', 'lateral', 'escanteio', 'tiroDeMeta', 'intervalo']);

const detalhe = process.argv.includes('--detalhe');
const { MOD, CORRER } = BOTAO;
const cenas = [
  ['trote reta', t => ({ x: 0.5, z: 0, botoes: 0 })],
  ['corrida curva', t => ({ x: Math.cos(t * 0.52), z: Math.sin(t * 0.52), botoes: 0 })],
  ['arrancada reta', t => ({ x: 1, z: 0, botoes: CORRER })],
  ['arrancada curva', t => ({ x: Math.cos(t * 0.52), z: Math.sin(t * 0.52), botoes: CORRER })],
  ['zigue-zague', t => { const a = Math.floor(t / 1.2) % 2 ? 0.9 : -0.9; return { x: Math.cos(a), z: Math.sin(a), botoes: 0 }; }],
  ['giro 180°', t => ({ x: t < 3 ? 1 : -1, z: 0, botoes: 0 })],
  ['giro 180° em arrancada', t => ({ x: Math.floor(t / 2.5) % 2 ? -1 : 1, z: 0, botoes: CORRER })],
  ['corte 90° em arrancada', t => { const a = Math.floor(t / 1.5) % 2 ? Math.PI / 2 : 0; return { x: Math.cos(a), z: Math.sin(a), botoes: CORRER }; }],
  ['para e sai', t => (Math.floor(t / 2) % 2 ? { x: 0, z: 0, botoes: 0 } : { x: 0.8, z: 0.3, botoes: 0 })],
  ['parado → anda', t => (t < 1 ? { x: 0, z: 0, botoes: 0 } : { x: 0.7, z: 0, botoes: 0 })],
  ['parado girando', t => ({ x: Math.cos(t * 3) * 0.12, z: Math.sin(t * 3) * 0.12, botoes: 0 })],
  ['condução curta', t => ({ x: Math.cos(t * 0.8) * 0.6, z: Math.sin(t * 0.8) * 0.6, botoes: MOD })],
  ['pedaladas', t => { const k = Math.floor(t * 60) % 90; return { x: 0.5, z: 0, botoes: (k < 4 || (k > 8 && k < 12)) ? MOD : 0 }; }],
  ['máquina de passes parado', t => ({ x: 0, z: 0, botoes: 0 }), { maquina: 3 }],
  ['máquina de passes andando', t => ({ x: Math.cos(t * 0.7) * 0.6, z: Math.sin(t * 0.7) * 0.6, botoes: 0 }), { maquina: 3 }],
  ['marcador: proteção', t => ({ x: Math.cos(t * 0.5) * 0.5, z: Math.sin(t * 0.5) * 0.5, botoes: MOD }), { marcador: true }],
  ['marcador: corrida', t => ({ x: Math.cos(t * 0.6), z: Math.sin(t * 0.6), botoes: Math.floor(t / 2) % 2 ? CORRER : 0 }), { marcador: true }],
  ['demo', null, { demo: true }],
  // Etapa 2: o treino de ataque jogado pela IA (passes, chutes, recomeços, trombadas, inversões),
  // medindo os 10 jogadores, em duas sementes
  ['treino de ataque (10 jogadores)', null, { ataque: true, semente: 2 }],
  ['treino de ataque (semente 7)', null, { ataque: true, semente: 7 }],
  // marcador girando rápido andando de lado (o passo lateral jogava o pé longe do corpo)
  ['treino de ataque (semente 29)', null, { ataque: true, semente: 29 }],
  // Etapa 3: a partida 11×11 IA × IA (os 22: bloco, pressão, recuo, bola livre, goleiros)
  ['partida 11×11 (22 jogadores)', null, { partida: true, semente: 3 }],
  ['partida 11×11 (semente 11)', null, { partida: true, semente: 11 }],
  // a parede da bola parada: quem está no raio sai andando (antes era empurrado com os pés no chão)
  ['partida: bolas paradas com gente no raio', null, { partida: true, semente: 5, paradas: true }],
];

/**
 * Força uma bola parada na partida rolando (cena 'paradas'): a bola sai pela linha com o último toque
 * do time `toque`, e 4 jogadores desse time (os que vão ter de sair do raio) são postos dentro dele —
 * na área no tiro de meta, perto da bandeira no escanteio, a ≤ 1,5 m da bola no lateral.
 */
function forcarParada(m, k) {
  const MX = 52.5, MZ = 34;
  const tipo = ['tiroDeMeta', 'escanteio', 'lateral'][k % 3];
  const sx = k % 2 ? 1 : -1, sz = (k >> 1) % 2 ? 1 : -1;
  const A = m.ataca[0] === sx ? 0 : 1;            // quem ataca o gol do lado sx
  const toque = tipo === 'escanteio' ? 1 - A : A;  // o último toque decide o recomeço
  let bx, bz, cx, cz;
  if (tipo === 'tiroDeMeta') { bx = sx * (MX + 1); bz = sz * 6; cx = sx * (MX - 9); cz = sz * 2; }
  else if (tipo === 'escanteio') { bx = sx * (MX + 1); bz = sz * (MZ - 3); cx = sx * (MX - 4); cz = sz * (MZ - 4); }
  else { bx = sx * 20; bz = sz * (MZ + 1); cx = bx - sx * 0.5; cz = sz * (MZ - 1.6); }
  const passo = tipo === 'lateral' ? 0.7 : 1.4;
  const quem = m.jogadores.filter(j => j.time === toque && j.posicao !== 'GOL').slice(0, 4);
  quem.forEach((j, n) => LP.P.teleportar(j, cx + ((n & 1) - 0.5) * passo, cz - sz * (n >> 1) * passo, Math.PI * (sx > 0 ? 0 : 1)));
  for (const j of m.jogadores) { j.recebe = null; j.corrida = null; if (j.cond) { j.cond.toque = null; j.cond.busca = false; } }
  Object.assign(m.bola, LP.Bo.criarBola(bx, bz));
  m.posse = null; m.naMao = null; m.voo = null;
  for (const j of m.jogadores) if (j.segura) j.segura = null;
  m.ultimoToque = { id: quem[0].id, time: toque, tick: m.tick };
}

const TORNOZELO = [J.tornozeloE, J.tornozeloD];
const limiteBalanco = v => 2.5 * v + 3;       // m/s
const limitePouso = v => 0.19 * v + 0.81;     // m/s
const linhas = [['cena', 'plantado: máx (m/s)', 'maior desloc. / limite', 'pouso: máx (m/s)', 'quadros']];
const geral = { plantado: 0, razao: 0, pouso: 0, quadros: 0, pior: null };
for (const [nome, rot, op = {}] of cenas) {
  const m = op.partida ? PT.criarJogo(LP, op.semente, { minutos: 60, ataque: ATAQUE_PARTIDA })
    : op.ataque ? criarTreino({ modo: 'ataque', semente: op.semente })
      : op.demo ? criarTreino({ modo: 'conducao', semente: 1, ...DEMO.inicio })
        : criarTreino({ modo: 'conducao', semente: 3, x: -20, z: 0, rumo: 0, marcador: !!op.marcador });
  const medidos = op.ataque || op.partida ? m.jogadores : [m.jogadores[0]];
  const out = new Float32Array(NJ * 3);
  const r = { plantado: 0, razao: 0, desloc: 0, pouso: 0, pousoRazao: 0, quadros: 0 };
  const antes = new Map();
  let proxParada = 240, nParada = 0;
  for (let i = 0; i < (op.partida ? 60 : op.ataque ? 30 : 10) * 60; i++) {
    const acoes = op.maquina && i > 0 && i % (op.maquina * 60) === 0 ? ['maquina'] : null;
    // cena das bolas paradas: força uma (com gente no raio) a cada ~7 s de bola rolando
    let forcou = false;
    if (op.paradas && i >= proxParada && m.partida.estado === 'jogo') { forcarParada(m, nParada++); proxParada = i + 420; forcou = true; }
    // recomeço do treino de ataque (e saída, lateral, escanteio, tiro de meta e intervalo da
    // partida) teletransporta: o quadro não conta
    const evs = op.partida ? PT.passoJogo(LP, m) : passoTreino(m, rot ? rot(i * PASSO) : entradaDemo(m), acoes);
    const recomecou = forcou || evs.some(e => SALTA.has(e.tipo));
    for (const j of medidos) {
    pose(j, m, out);
    const atu = {
      t: TORNOZELO.map(k => [out[k * 3], out[k * 3 + 1], out[k * 3 + 2]]),
      sim: j.pes.map(p => ({ apoio: p.apoio, x: p.x, z: p.z })),
      v: Math.hypot(j.vx, j.vz),
    };
    const ant = recomecou ? null : antes.get(j.id);
    antes.set(j.id, atu);
    if (ant) {
      const v = Math.max(atu.v, ant.v);
      for (let p = 0; p < 2; p++) {
        const d = Math.hypot(atu.t[p][0] - ant.t[p][0], atu.t[p][1] - ant.t[p][1], atu.t[p][2] - ant.t[p][2]);
        const vp = d / PASSO;
        r.quadros++;
        const s0 = ant.sim[p], s1 = atu.sim[p];
        if (s0.apoio && s1.apoio && s0.x === s1.x && s0.z === s1.z) r.plantado = Math.max(r.plantado, vp);
        if (!s0.apoio && s1.apoio) {
          r.pouso = Math.max(r.pouso, vp);
          r.pousoRazao = Math.max(r.pousoRazao, vp / limitePouso(v));
        }
        const razao = vp / limiteBalanco(v);
        if (razao > r.razao) { r.razao = razao; r.desloc = d; }
        if (detalhe && (razao > 1 || (s0.apoio && s1.apoio && s0.x === s1.x && vp > 0.05))) {
          console.log(`  ${nome} tick ${m.tick} jogador ${j.id} pé ${p}: ${fmt(d, 3)} m (${fmt(vp, 2)} m/s; limite ${fmt(limiteBalanco(v), 2)} m/s) apoio ${s0.apoio}→${s1.apoio}`);
        }
      }
    }
    }
  }
  geral.plantado = Math.max(geral.plantado, r.plantado);
  geral.pouso = Math.max(geral.pouso, r.pousoRazao);
  geral.quadros += r.quadros;
  if (r.razao > geral.razao) { geral.razao = r.razao; geral.pior = `${nome}: ${fmt(r.desloc, 3)} m num quadro`; }
  if (op.paradas && nParada < 6) { geral.plantado = Infinity; console.log(`${nome}: só ${nParada} paradas forçadas (a cena precisa de ≥ 6)`); }
  linhas.push([nome + (op.paradas ? ` (${nParada} paradas)` : ''), fmt(r.plantado, 3), `${fmt(r.razao, 2)} (${fmt(r.desloc, 3)} m)`, `${fmt(r.pouso, 2)} (${fmt(r.pousoRazao, 2)}× o real)`, r.quadros]);
}
console.log(tabelaTexto(linhas));
const metas = [
  ['pé plantado não anda (máx. em todos os quadros)', `${fmt(geral.plantado, 3)} m/s`, '≤ 0,05 m/s', geral.plantado <= 0.05],
  ['pé nenhum salta: desloc. por quadro / (2,5·v + 3 m/s)·dt', `${fmt(geral.razao, 2)} (${geral.pior})`, '≤ 1', geral.razao <= 1],
  ['pouso: velocidade do pé / (0,19·v + 0,81 m/s)', fmt(geral.pouso, 2), '≤ 1', geral.pouso <= 1],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[1], x[2], x[3] ? 'PASSOU' : 'REPROVOU'])]));
console.log(`(${geral.quadros} quadros de pé medidos, nenhum descartado)`);
const ok = metas.every(x => x[3]);
console.log(ok ? '\nteste-patinacao: PASSOU' : '\nteste-patinacao: REPROVOU');
process.exit(ok ? 0 : 1);
