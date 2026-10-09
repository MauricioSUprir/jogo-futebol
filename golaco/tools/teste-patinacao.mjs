// Pés desenhados (seção 4): o tornozelo da pose (anim.js) em TODOS os quadros, inclusive os da
// saída do chão, do pouso e dos toques na bola — nenhum quadro é descartado. Pelo caminho real
// da página (sessao.js: criarTreino + passoTreino), em 18 cenas: trote, corrida, arrancada,
// curvas, zigue-zague, giros (também em arrancada), corte em arrancada, para e sai, parado
// girando, máquina de passes (domínio parado e andando), marcador (proteção e corrida),
// pedaladas e a demo.
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
  // Etapa 2: o treino de ataque jogado pela IA (passes, chutes, recomeços), medindo os 10 jogadores
  ['treino de ataque (10 jogadores)', null, { ataque: true }],
];

const TORNOZELO = [J.tornozeloE, J.tornozeloD];
const limiteBalanco = v => 2.5 * v + 3;       // m/s
const limitePouso = v => 0.19 * v + 0.81;     // m/s
const linhas = [['cena', 'plantado: máx (m/s)', 'maior desloc. / limite', 'pouso: máx (m/s)', 'quadros']];
const geral = { plantado: 0, razao: 0, pouso: 0, quadros: 0, pior: null };
for (const [nome, rot, op = {}] of cenas) {
  const m = op.ataque ? criarTreino({ modo: 'ataque', semente: 2 })
    : op.demo ? criarTreino({ modo: 'conducao', semente: 1, ...DEMO.inicio })
      : criarTreino({ modo: 'conducao', semente: 3, x: -20, z: 0, rumo: 0, marcador: !!op.marcador });
  const medidos = op.ataque ? m.jogadores : [m.jogadores[0]];
  const out = new Float32Array(NJ * 3);
  const r = { plantado: 0, razao: 0, desloc: 0, pouso: 0, pousoRazao: 0, quadros: 0 };
  const antes = new Map();
  for (let i = 0; i < (op.ataque ? 30 : 10) * 60; i++) {
    const acoes = op.maquina && i > 0 && i % (op.maquina * 60) === 0 ? ['maquina'] : null;
    // recomeço do treino de ataque teletransporta todos: o quadro do recomeço não conta
    const evs = passoTreino(m, rot ? rot(i * PASSO) : entradaDemo(m), acoes);
    const recomecou = evs.some(e => e.tipo === 'recomeco');
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
  linhas.push([nome, fmt(r.plantado, 3), `${fmt(r.razao, 2)} (${fmt(r.desloc, 3)} m)`, `${fmt(r.pouso, 2)} (${fmt(r.pousoRazao, 2)}× o real)`, r.quadros]);
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
