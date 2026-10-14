// Comemoração do gol em Node (pedido do dono de 11/10: "não tem cena de comemoração!!!"): js/comemoracao.js, a cena pura.
// Gols: 5 NATURAIS da partida IA × IA (o 1º gol de sementes conhecidas; se uma delas parar de ter gol, as próximas) e 3
// ROTEIRIZADOS (o roteiro de tools/lib/gol-roteirizado.mjs em Node: time 0, time 1 — cena curta, a IA contra o humano —
// e um gol contra). Em cada cena (até o fim, ≤ 8,5 s), por tick:
//   1) sem NaN; ossos (coxa, canela, braço, antebraço) com o comprimento certo a ±0,5 cm;
//   2) pé plantado ≤ 0,05 m/s e pé no ar ≤ 1,0·(2,5v + 3)·dt — a régua do teste-patinacao (o goleiro na defesa desenhada
//      com a mesma regra da rotação do corpo) —, fora dos golpes (deslize, pulo, giro, pulo do grupo);
//   3) o autor a ≤ 3 m do alvo em ≤ 4,5 s;
//   4) com ≥ 2 colegas a ≤ 45 m do alvo, ≥ 2 colegas a ≤ 1,2 m do autor até 6,5 s (cena normal; a curta não tem abraço);
//   5) pelves a ≥ 0,40 m uma da outra (ninguém dentro de ninguém);
//   6) golpes: de joelhos com os dois joelhos entre 0,02 e 0,12 m do chão (e nunca abaixo de 0,02 no deslize); pulo
//      com os dois pés ≥ 0,2 m do chão por ≥ 0,4 s; céu com as duas mãos ≥ 0,2 m acima da cabeça por ≥ 0,5 s;
//   7) mãos do autor acima da cabeça ≥ 1 s em toda cena;
//   8) time que sofreu: depois de 1,2 s, ≥ 70% com gesto de lamento (mãos na cintura ou na cabeça) e ninguém acima de
//      2,5 m/s;
//   9) duração: cena normal 6–8,5 s, curta ≤ 5,5 s; fases na ordem rede → corrida → final → (abraço) → reação → fim;
//  10) variedade: em 12 gols (os 8 + 4 roteirizados em outras sementes), ≥ 4 finalizações diferentes e nunca a mesma
//      duas vezes seguidas;
//  11) pureza: hashMundo antes = depois da cena (o mundo não é tocado); a pose no tick k é a mesma andando a cena tick a
//      tick ou em quadros de tamanhos variados (avancarCena); a mesma cena duas vezes = as mesmas poses;
//  12) custo ≤ 0,6 ms por tick (a melhor de 3 medidas de cada cena: a máquina é dividida);
//  14) (contraprova de 14/10) gol com quem cabeceou AINDA NO AR (o cabeceio de muito perto: ~1 em 100 gols de cabeça no
//      canhão da pequena área): a cena termina o pulo do cabeceio (cabeceio.js) — o tornozelo desenhado anda no máximo a
//      régua do pé no ar ((2,5·v + 3)·dt) e a pelve no máximo 0,06 m por tick (no pulo mais alto ela anda ~0,05). Antes a
//      cena andava o corpo pela locomoção e os pés pela passada no chão: o tornozelo saltava 0,2 m e a pelve 0,19 m num tick;
//  13) (contraprova) plano da reação: ninguém além de quem reage a < 2 m da lente dentro do quadro, no PC e no celular
//      (nas 8 cenas e em 2 gols naturais em que um defensor andando para a saída passava colado na câmera).
// "Antes" (informativo): o pós-gol da versão sem cena, medido na simulação (a IA leva o autor de volta; nenhuma mão acima
// da cabeça; colega mais perto a 16–24 m). Na versão sem js/comemoracao.js o teste REPROVA (o módulo não existe).
//   node tools/teste-comemoracao.mjs [--js <pasta js>] [--detalhe]
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { carregarNode, golRoteirizadoNode, golNaturalNode } from './lib/gol-node.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(AQUI, '../js');
const detalhe = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [];
let falhas = 0;
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const f3 = v => (Number.isFinite(v) ? v.toFixed(3) : String(v));
function reg(nome, medido, meta, ok, info = false) { linhas.push({ nome, medido, meta, ok: !!ok, info }); if (!ok && !info) falhas++; }
function imprimir() {
  const larg = Math.max(...linhas.map(l => l.nome.length));
  for (const l of linhas) console.log(`${l.info ? 'INFO    ' : l.ok ? 'PASSOU  ' : 'REPROVOU'}  ${l.nome.padEnd(larg)}  ${l.medido}   (meta: ${l.meta})`);
  console.log(falhas ? `\nteste-comemoracao: REPROVOU (${falhas})` : '\nteste-comemoracao: PASSOU');
}

const L = await carregarNode(pastaJs);
const { P, C } = L;
const S = await imp('sim.js');
const A = await imp('anim.js');
const G = await imp('goleiro.js');
const { J, NJ } = A;
const { PASSO, JOGADOR } = C;
const TORN = JOGADOR.alturaTornozelo;

// ------------------------------------------------------------------------------------------------ antes (sem cena)
{
  // o pós-gol da simulação (o que a página mostrava: a IA leva cada um para a posição, nada de pose de comemoração)
  const g = golRoteirizadoNode(L, { semente: 5, time: 0 });
  if (g) {
    const m = g.m, autor = m.jogadores.find(j => j.id === g.gol.id), out = new Float32Array(NJ * 3);
    let mao = 0, colegaMin = Infinity, saida = null;
    for (let i = 0; i < 200 && saida == null; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m), null);
      if (ev.some(e => e.tipo === 'saida')) { saida = m.tick - g.golTick; break; }
      A.pose(autor, m, out);
      if (out[J.maoE * 3 + 1] > out[J.cabeca * 3 + 1] || out[J.maoD * 3 + 1] > out[J.cabeca * 3 + 1]) mao++;
      for (const c of m.jogadores) if (c.time === autor.time && c !== autor && c.posicao !== 'GOL') colegaMin = Math.min(colegaMin, Math.hypot(c.x - autor.x, c.z - autor.z));
    }
    reg('antes: o pós-gol da simulação (sem cena)', `saída ${saida} ticks depois do gol; mão acima da cabeça ${mao} ticks; colega mais perto ${f2(colegaMin)} m`, 'informativo', true, true);
  }
}

let CM = null;
try { CM = await imp('comemoracao.js'); } catch (e) { CM = null; }
if (!CM) {
  reg('módulo js/comemoracao.js (a cena de comemoração)', 'não existe (sem cena: o pós-gol é só a câmera do gol)', 'existe', false);
  imprimir();
  process.exit(1);
}

// ------------------------------------------------------------------------------------------------ gols
const CONHECIDAS = [3, 35, 19, 22, 21, 40];
const gols = [];
{
  const usadas = new Set();
  const tentar = s => { if (usadas.has(s)) return; usadas.add(s); const g = golNaturalNode(L, s, 4000); if (g) gols.push({ ...g, nome: `natural (semente ${s})` }); };
  for (const s of CONHECIDAS) { if (gols.length >= 5) break; tentar(s); }
  for (let s = 1; s <= 80 && gols.length < 5; s++) tentar(s);
  reg('gols naturais (IA × IA) achados', gols.map(g => `s${g.semente}@${g.golTick} t${g.gol.time}`).join(', '), '5', gols.length === 5);
  const r0 = golRoteirizadoNode(L, { semente: 5, time: 0 });
  if (r0) gols.push({ ...r0, nome: 'roteirizado time 0' });
  const r1 = golRoteirizadoNode(L, { semente: 5, time: 1 });
  if (r1) gols.push({ ...r1, nome: 'roteirizado time 1 (curta)' });
  // gol contra: o mesmo lance, mas a bola entrou de um zagueiro do time 1 (o autor de verdade é dele)
  const rc = golRoteirizadoNode(L, { semente: 7, time: 0, dist: 8, z0: -2 });
  if (rc) {
    const b = rc.m.bola.p;
    let z = null, dm = Infinity;
    for (const j of rc.m.jogadores) { if (j.time === 0 || j.posicao === 'GOL') continue; const d = Math.hypot(j.x - b.x, j.z - b.z); if (d < dm) { dm = d; z = j; } }
    gols.push({ ...rc, gol: { ...rc.gol, id: z.id, contra: true }, nome: `roteirizado gol contra (do ${z.id})` });
  }
  reg('gols roteirizados (time 0, time 1, contra)', `${gols.length - 5 < 0 ? 0 : gols.length - Math.min(5, gols.length)}`, '3', gols.length >= 8);
}

// ------------------------------------------------------------------------------------------------ medidas de uma cena
const ossos = [[J.quadrilE, J.joelhoE, JOGADOR.coxa], [J.joelhoE, J.tornozeloE, JOGADOR.canela], [J.quadrilD, J.joelhoD, JOGADOR.coxa], [J.joelhoD, J.tornozeloD, JOGADOR.canela],
  [J.ombroE, J.cotoveloE, A.BRACO], [J.cotoveloE, J.maoE, A.ANTEBRACO], [J.ombroD, J.cotoveloD, A.BRACO], [J.cotoveloD, J.maoD, A.ANTEBRACO]];
const dist3 = (o, a, b) => Math.hypot(o[a * 3] - o[b * 3], o[a * 3 + 1] - o[b * 3 + 1], o[a * 3 + 2] - o[b * 3 + 2]);
const TORNS = [J.tornozeloE, J.tornozeloD];
const PERNA = 0.9;

function medirCena(g, opcPlano = {}) {
  const m = g.m;
  const h0 = S.hashMundo(m);
  const plano = CM.planejarComemoracao(m, g.gol, { timeHumano: 0, ...opcPlano });
  const c = CM.criarCena(plano, m);
  const n = c.atores.length;
  const r = {
    plano, nan: 0, osso: 0, plantado: 0, razao: 0, piorPe: null, chegou: null, dois: null, pelve: Infinity, piorPelve: null,
    joelhoDeslize: Infinity, joelhoMin: Infinity, joelhoMax: -Infinity, ticksJoelho: 0, puloTicks: 0, ceuTicks: 0, maoAcima: 0,
    sofreuGesto: 0, sofreuN: 0, sofreuVel: 0, fases: [], ticks: 0,
  };
  const ant = c.atores.map(() => ({ t: [new Float64Array(3), new Float64Array(3)], pes: [{}, {}], v: 0, noAr: true, merg: false, tronco: [0, 0, 0], pel: [0, 0, 0], ok: false }));
  while (!c.acabou && r.ticks < 9 * 60) {
    CM.passoCena(c); r.ticks++;
    const t = c.k * PASSO;
    const fase = CM.faseEm(c, c.k);
    if (r.fases[r.fases.length - 1] !== fase) r.fases.push(fase);
    const au = c.autor;
    for (let i = 0; i < n; i++) {
      const a = c.atores[i], o = a.atu, j = a.j;
      for (let q = 0; q < NJ * 3; q++) if (!Number.isFinite(o[q])) { r.nan++; break; }
      for (const [x, y, L0] of ossos) r.osso = Math.max(r.osso, Math.abs(dist3(o, x, y) - L0));
      // pés (a régua do teste-patinacao)
      const s0 = ant[i];
      const merg = a.goleiro && j.mergulho && G.mergulhoAtivo(j, c.mF.tick);
      const v0 = Math.hypot(j.vx, j.vz);
      const tronco = [o[J.peito * 3] - o[J.pelve * 3], o[J.peito * 3 + 1] - o[J.pelve * 3 + 1], o[J.peito * 3 + 2] - o[J.pelve * 3 + 2]];
      const pel = [o[J.pelve * 3], o[J.pelve * 3 + 1], o[J.pelve * 3 + 2]];
      if (s0.ok && !a.noAr && !s0.noAr) {
        let v = Math.max(v0, s0.v);
        if (merg || s0.merg) {
          const A1 = s0.tronco, B1 = tronco, la = Math.hypot(...A1) || 1, lb = Math.hypot(...B1) || 1;
          const giro = Math.acos(Math.max(-1, Math.min(1, (A1[0] * B1[0] + A1[1] * B1[1] + A1[2] * B1[2]) / (la * lb)))) / PASSO;
          v = Math.min(6, Math.max(v, Math.hypot(pel[0] - s0.pel[0], pel[1] - s0.pel[1], pel[2] - s0.pel[2]) / PASSO, giro * PERNA));
        }
        for (let p = 0; p < 2; p++) {
          const it = TORNS[p];
          const d = Math.hypot(o[it * 3] - s0.t[p][0], o[it * 3 + 1] - s0.t[p][1], o[it * 3 + 2] - s0.t[p][2]);
          const vp = d / PASSO, pe = j.pes[p], pa = s0.pes[p];
          if (pa.apoio && pe.apoio && pa.x === pe.x && pa.z === pe.z && vp > r.plantado) { r.plantado = vp; if (vp > 0.05) r.piorPlantado = { id: a.id, papel: CM.PAPEIS[a.papel], t: +t.toFixed(2), vp: +vp.toFixed(3) }; }
          const razao = vp / (2.5 * v + 3);
          if (razao > r.razao) { r.razao = razao; r.piorPe = { id: a.id, papel: CM.PAPEIS[a.papel], t: +t.toFixed(2), vp: +vp.toFixed(2), v: +v.toFixed(2), merg }; }
        }
      }
      s0.ok = true; s0.noAr = a.noAr; s0.v = v0; s0.merg = merg; s0.tronco = tronco; s0.pel = pel;
      for (let p = 0; p < 2; p++) { const it = TORNS[p]; s0.t[p][0] = o[it * 3]; s0.t[p][1] = o[it * 3 + 1]; s0.t[p][2] = o[it * 3 + 2]; s0.pes[p] = { apoio: j.pes[p].apoio, x: j.pes[p].x, z: j.pes[p].z }; }
      // time que sofreu: depois de 1,2 s
      if (a.time !== plano.time && t > 1.2) {
        r.sofreuN++;
        if (v0 > r.sofreuVel) { r.sofreuVel = v0; r.piorSofreu = { id: a.id, t: +t.toFixed(2), v: +v0.toFixed(2), merg }; }
        const ombro = Math.max(o[J.ombroE * 3 + 1], o[J.ombroD * 3 + 1]), pelveY = o[J.pelve * 3 + 1];
        const cabeca = o[J.maoE * 3 + 1] > ombro + 0.05 && o[J.maoD * 3 + 1] > ombro + 0.05;
        const cintura = Math.abs(o[J.maoE * 3 + 1] - pelveY) < 0.18 && Math.abs(o[J.maoD * 3 + 1] - pelveY) < 0.18;
        if (cabeca || cintura) r.sofreuGesto++;
      }
    }
    // pelves
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const oa = c.atores[p].atu, ob = c.atores[q].atu;
      const d = Math.hypot(oa[J.pelve * 3] - ob[J.pelve * 3], oa[J.pelve * 3 + 2] - ob[J.pelve * 3 + 2]);
      if (d < r.pelve) { r.pelve = d; r.piorPelve = { a: c.atores[p].id, b: c.atores[q].id, t: +t.toFixed(2) }; }
    }
    // autor: alvo, colegas, mãos, golpes
    const oa = au.atu;
    if (r.chegou == null && Math.hypot(au.j.x - c.alvo.x, au.j.z - c.alvo.z) <= 3) r.chegou = t;
    let perto = 0;
    for (const a of c.atores) if (a.papel === 1 && Math.hypot(a.j.x - au.j.x, a.j.z - au.j.z) <= 1.2) perto++;
    if (r.dois == null && perto >= 2) r.dois = t;
    const cab = oa[J.cabeca * 3 + 1];
    if (oa[J.maoE * 3 + 1] > cab || oa[J.maoD * 3 + 1] > cab) r.maoAcima++;
    if (oa[J.maoE * 3 + 1] >= cab + 0.2 && oa[J.maoD * 3 + 1] >= cab + 0.2) r.ceuTicks++;
    if (c.variante === 'joelhos' && c.kFinal >= 0) {
      const ky = Math.min(oa[J.joelhoE * 3 + 1], oa[J.joelhoD * 3 + 1]), kY = Math.max(oa[J.joelhoE * 3 + 1], oa[J.joelhoD * 3 + 1]);
      if (au.desliza || au.ajoelhado) r.joelhoDeslize = Math.min(r.joelhoDeslize, ky);
      if (au.ajoelhado && !au.noAr) { r.joelhoMin = Math.min(r.joelhoMin, ky); r.joelhoMax = Math.max(r.joelhoMax, kY); r.ticksJoelho++; }
    }
    if (Math.min(oa[J.tornozeloE * 3 + 1], oa[J.tornozeloD * 3 + 1]) >= TORN + 0.2) r.puloTicks++;
  }
  r.duracao = r.ticks * PASSO;
  r.hashIgual = h0 === S.hashMundo(m);
  r.c = c;
  return r;
}

// ------------------------------------------------------------------------------------------------ as 8 cenas
const res = [];
for (const g of gols) res.push({ g, r: medirCena(g) });
const resumo = [];
for (const { g, r } of res) {
  const p = r.plano;
  resumo.push(`${g.nome}: ${p.curta ? 'curta' : 'normal'}, ${p.variante}/${p.corrida}, alvo ${p.alvo.nome} a ${f2(p.alvo.d0)} m, ${p.colegas.length} colegas (${p.colegasPerto} a ≤ 45 m), ${f2(r.duracao)} s, fases ${r.fases.join('→')}`);
}
reg('cenas (8 gols)', `\n      ${resumo.join('\n      ')}`, 'informativo', true, true);
const todos = res.map(x => x.r);
const max = (f) => Math.max(...todos.map(f));
reg('1 sem NaN nas poses', `${todos.reduce((s, r) => s + r.nan, 0)}`, '0', todos.every(r => r.nan === 0));
reg('1 ossos (coxa, canela, braço, antebraço)', `erro máx ${f2(max(r => r.osso) * 1000)} mm`, '≤ 5 mm', max(r => r.osso) <= 0.005);
{
  const pp = todos.reduce((a, r) => (r.plantado > a.plantado ? r : a));
  reg('2 pé plantado (fora dos golpes)', `${f3(pp.plantado)} m/s${pp.piorPlantado ? ' ' + JSON.stringify(pp.piorPlantado) : ''}`, '≤ 0,05 m/s', max(r => r.plantado) <= 0.05);
  const pr = todos.reduce((a, r) => (r.razao > a.razao ? r : a));
  reg('2 pé no ar: desloc. / (2,5v + 3)·dt (fora dos golpes)', `${f2(pr.razao)} ${JSON.stringify(pr.piorPe)}`, '≤ 1,0', max(r => r.razao) <= 1);
}
reg('3 o autor a ≤ 3 m do alvo', todos.map(r => (r.chegou == null ? 'nunca' : f2(r.chegou))).join(' / ') + ' s', '≤ 4,5 s', todos.every(r => r.chegou != null && r.chegou <= 4.5));
{
  const com = todos.filter(r => !r.plano.curta && r.plano.colegasPerto >= 2);
  reg('4 abraço: ≥ 2 colegas a ≤ 1,2 m do autor (cena normal com ≥ 2 colegas a ≤ 45 m)', com.map(r => (r.dois == null ? 'nunca' : f2(r.dois))).join(' / ') + ` s (${com.length} cenas)`, '≤ 6,5 s', com.length > 0 && com.every(r => r.dois != null && r.dois <= 6.5));
  const curtas = todos.filter(r => r.plano.curta);
  reg('4 cena curta (gol da IA contra o humano): os colegas chegam (informativo)', curtas.map(r => (r.dois == null ? 'não' : f2(r.dois) + ' s')).join(' / ') || '-', 'informativo', true, true);
}
{
  const pv = todos.reduce((a, r) => (r.pelve < a.pelve ? r : a));
  reg('5 pelves a ≥ 0,40 m uma da outra', `${f3(pv.pelve)} m ${JSON.stringify(pv.piorPelve)}`, '≥ 0,40 m', min(todos, r => r.pelve) >= 0.4);
}
function min(arr, f) { return Math.min(...arr.map(f)); }

// golpes: cada finalização forçada nos 2 primeiros gols normais (todas as variantes medidas, inclusive as que o hash não sorteou)
{
  const normais = res.filter(x => !x.r.plano.curta).slice(0, 2);
  const porVar = {};
  for (const v of CM.FINAIS) {
    porVar[v] = normais.map(x => medirCena(x.g, { variante: v }));
  }
  const J1 = porVar.joelhos;
  reg('6 de joelhos: joelhos no deslize nunca abaixo de 0,02 m', J1.map(r => f3(r.joelhoDeslize)).join(' / ') + ' m', '≥ 0,02 m', J1.every(r => r.joelhoDeslize >= 0.02));
  reg('6 de joelhos: parado, os dois joelhos entre 0,02 e 0,12 m do chão', J1.map(r => `${f3(r.joelhoMin)}–${f3(r.joelhoMax)} m (${r.ticksJoelho} ticks)`).join(' / '), '0,02–0,12 m', J1.every(r => r.ticksJoelho > 30 && r.joelhoMin >= 0.02 && r.joelhoMax <= 0.12));
  const P1 = porVar.pulo, G1 = porVar.giro;
  reg('6 pulo e giro: os dois pés ≥ 0,2 m do chão', [...P1, ...G1].map(r => f2(r.puloTicks / 60)).join(' / ') + ' s', '≥ 0,4 s', [...P1, ...G1].every(r => r.puloTicks >= 24));
  const C1 = porVar.ceu;
  reg('6 céu: as duas mãos ≥ 0,2 m acima da cabeça', C1.map(r => f2(r.ceuTicks / 60)).join(' / ') + ' s', '≥ 0,5 s', C1.every(r => r.ceuTicks >= 30));
  const tudo = Object.values(porVar).flat();
  reg('6 golpes forçados: sem NaN, ossos, pés e pelves', `NaN ${tudo.reduce((s, r) => s + r.nan, 0)}, osso ${f2(Math.max(...tudo.map(r => r.osso)) * 1000)} mm, plantado ${f3(Math.max(...tudo.map(r => r.plantado)))} m/s, ar ${f2(Math.max(...tudo.map(r => r.razao)))}, pelve ${f3(min(tudo, r => r.pelve))} m`,
    '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40', tudo.every(r => r.nan === 0 && r.osso <= 0.005 && r.plantado <= 0.05 && r.razao <= 1 && r.pelve >= 0.4));
  if (detalhe) for (const [v, rs] of Object.entries(porVar)) for (const r of rs) console.log(v, JSON.stringify({ plantado: r.piorPlantado, pe: r.piorPe, razao: r.razao, pelve: r.pelve, piorPelve: r.piorPelve, mao: r.maoAcima, dois: r.dois, chegou: r.chegou }));
  reg('7 mãos do autor acima da cabeça (todas as cenas, todas as finalizações)', `mín ${f2(min([...todos, ...tudo], r => r.maoAcima) / 60)} s`, '≥ 1 s', [...todos, ...tudo].every(r => r.maoAcima >= 60));
}
{
  const fr = todos.map(r => r.sofreuGesto / Math.max(1, r.sofreuN));
  reg('8 time que sofreu: com gesto de lamento depois de 1,2 s', fr.map(v => `${Math.round(v * 100)}%`).join(' / '), '≥ 70%', fr.every(v => v >= 0.7));
  const pv = todos.reduce((a, r) => (r.sofreuVel > a.sofreuVel ? r : a));
  reg('8 time que sofreu: velocidade depois de 1,2 s', `máx ${f2(pv.sofreuVel)} m/s ${JSON.stringify(pv.piorSofreu)}`, '≤ 2,5 m/s', max(r => r.sofreuVel) <= 2.5);
}
{
  const ok = todos.every(r => (r.plano.curta ? r.duracao <= 5.5 && r.duracao >= 3.5 : r.duracao >= 6 && r.duracao <= 8.5));
  reg('9 duração (normal / curta)', todos.map(r => `${f2(r.duracao)}${r.plano.curta ? 'c' : ''}`).join(' / ') + ' s', 'normal 6–8,5 s; curta 3,5–5,5 s', ok);
  const ordem = CM.FASES;
  const okF = todos.every(r => r.fases.every((f, i) => i === 0 || ordem.indexOf(f) > ordem.indexOf(r.fases[i - 1])) && r.fases[0] === 'rede' && r.fases.includes('reacao') && r.fases.includes('final'));
  reg('9 fases na ordem', [...new Set(todos.map(r => r.fases.join('→')))].join(' | '), 'rede → corrida → final → (abraço) → reação → fim', okF);
}
// variedade: 12 gols (os 8 + 4 roteirizados em outras sementes), na ordem, com a última finalização de cada um
{
  const mais = [];
  for (const [s, t] of [[6, 0], [8, 0], [9, 0], [11, 0], [12, 0], [13, 0]]) { if (mais.length >= 4) break; const r = golRoteirizadoNode(L, { semente: s, time: t }); if (r) mais.push(r); }
  const seq = [...gols, ...mais].slice(0, 12);
  let ultima = null;
  const escolhas = [];
  for (const g of seq) {
    const p = CM.planejarComemoracao(g.m, g.gol, { ultima });
    escolhas.push(p.variante); ultima = p.variante;
  }
  const dif = new Set(escolhas).size, repete = escolhas.some((v, i) => i > 0 && v === escolhas[i - 1]);
  reg('10 variedade: 12 gols seguidos', `${escolhas.join(', ')} (${dif} diferentes; repete em seguida: ${repete})`, '≥ 4 diferentes, nunca 2 seguidas', seq.length === 12 && dif >= 4 && !repete);
  // e em 2000 sequências sintéticas de 12 (tick, autor): nunca repete; quantas ficam com < 4 diferentes
  let ruins = 0, rep = 0;
  for (let k = 0; k < 2000; k++) {
    let u = null; const vs = new Set();
    for (let i = 0; i < 12; i++) { const v = CM.escolherFinal(1000 + k * 977 + i * 4111, (k * 7 + i * 3) % 23 + 1, u); if (v === u) rep++; u = v; vs.add(v); }
    if (vs.size < 4) ruins++;
  }
  reg('10 variedade em 2000 sequências sintéticas de 12 gols', `repetidas em seguida ${rep}; com < 4 diferentes ${ruins} (${f2(ruins / 20)}%)`, '0 repetidas; < 4 diferentes ≤ 1%', rep === 0 && ruins <= 20);
}
// pureza
{
  reg('11 o mundo não é tocado (hashMundo antes = depois)', todos.map(r => r.hashIgual).join(' '), 'todos true', todos.every(r => r.hashIgual));
  const g = res.find(x => !x.r.plano.curta)?.g ?? res[0].g;
  const pl = CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 });
  const a1 = CM.criarCena(pl, g.m), a2 = CM.criarCena(CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 }), g.m);
  const N = 9 * 60, guarda = new Float32Array(N * a1.atores.length * NJ * 3);
  let n1 = 0;
  while (!a1.acabou && n1 < N) { CM.passoCena(a1); for (let i = 0; i < a1.atores.length; i++) guarda.set(a1.atores[i].atu, ((a1.k - 1) * a1.atores.length + i) * NJ * 3); n1++; }
  let dif = 0, comparados = 0, sem = 12345;
  const rnd = () => { sem = (Math.imul(sem, 1103515245) + 12345) >>> 0; return sem / 4294967296; };
  while (!a2.acabou) {
    const dt = 0.002 + rnd() * 0.06;
    if (CM.avancarCena(a2, dt) > 0) {
      for (let i = 0; i < a2.atores.length; i++) {
        const o = a2.atores[i].atu, base = ((a2.k - 1) * a2.atores.length + i) * NJ * 3;
        for (let q = 0; q < NJ * 3; q++) if (o[q] !== guarda[base + q]) dif++;
      }
      comparados++;
    }
  }
  reg('11 a pose no tick k: tick a tick = em quadros variados (avancarCena)', `${comparados} quadros comparados, ${dif} números diferentes; ticks ${n1} / ${a2.k}`, '0 diferentes, mesmo nº de ticks', dif === 0 && comparados > 50 && n1 === a2.k);
}
// custo: a melhor de 3 medidas por cena
{
  const ms = [];
  for (const g of gols) {
    let melhor = Infinity;
    for (let rep = 0; rep < 3; rep++) {
      const c = CM.criarCena(CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 }), g.m);
      const t0 = performance.now(); let n = 0;
      while (!c.acabou) { CM.passoCena(c); n++; }
      melhor = Math.min(melhor, (performance.now() - t0) / n);
    }
    ms.push(melhor);
  }
  reg('12 custo da cena por tick (22 atores; a melhor de 3)', `${ms.map(f3).join(' / ')} ms`, '≤ 0,6 ms', Math.max(...ms) <= 0.6);
}
// 13 (contraprova) a lente do plano da REAÇÃO livre: ninguém além de quem reage a < 2 m da câmera dentro do quadro (um corpo
// a 2 m já enche a altura do quadro com fov 30), no PC (16:9) e no celular (844×390). Nas 8 cenas e nelas mesmas com um
// BLOQUEIO de propósito: no tick antes da reação, o jogador em pé mais devagar (quem não é o autor nem quem reage) parado
// 1,2 m na frente da lente do plano de sempre — o defeito da contraprova (um jogador do time que sofreu, andando para a
// saída, passava colado na lente em ~15% das cenas curtas). Antes, com 2 gols naturais de sementes fixas (1º gol das
// sementes 2 e 15); a rede véu mudou a física do gol e esses lances deixaram de existir, então o bloqueio não depende
// de semente. A versão sem a escolha do giro (51c1bbb7) reprova no bloqueio: 5–10 quadros por cena no PC, 2–7 no celular.
{
  const PTS = [J.pelve, J.peito, J.cabeca, J.joelhoE, J.joelhoD, J.ombroE, J.ombroD];
  const colados = (c, pc, aspecto) => {
    const f = [pc.para[0] - pc.de[0], pc.para[1] - pc.de[1], pc.para[2] - pc.de[2]];
    const lf = Math.hypot(...f); f[0] /= lf; f[1] /= lf; f[2] /= lf;
    const lr = Math.hypot(f[2], f[0]) || 1, r = [-f[2] / lr, 0, f[0] / lr];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const tv = Math.tan((pc.fov * Math.PI) / 360), th = tv * aspecto;
    const sujeito = c.reacao ?? c.autor;
    let n = 0;
    for (const a of c.atores) {
      if (a === sujeito) continue;
      let zmin = Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const i of PTS) {
        const d = [a.atu[i * 3] - pc.de[0], a.atu[i * 3 + 1] - pc.de[1], a.atu[i * 3 + 2] - pc.de[2]];
        const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
        if (z <= 0.05) continue;
        const nx = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * th), ny = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * tv);
        zmin = Math.min(zmin, z); x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
      }
      if (zmin < 2 && x1 > -1.1 && x0 < 1.1 && y1 > -1.1 && y0 < 1.1) n++;
    }
    return n;
  };
  const R = C.COMEMORACAO.camera.reacao;
  // bloqueio: põe um jogador em pé parado 1,2 m na frente da lente do plano de sempre (giro 0), no tick antes da reação
  const bloquear = c => {
    while (!c.acabou && !(c.kFimAbraco > 0 && c.k === c.kFimAbraco - 1)) CM.passoCena(c);
    const r = c.reacao ?? c.autor, rj = r.j, P = J.peito * 3 + 1;
    let vx = Math.cos(rj.rumo), vz = Math.sin(rj.rumo) + R.ladoTV;
    const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    const bl = c.atores.filter(a => a !== r && a !== c.autor && a.atu[P] > 1.2).sort((a, b) => Math.hypot(a.j.vx, a.j.vz) - Math.hypot(b.j.vx, b.j.vz))[0];
    if (!bl) return false;
    bl.j.x = rj.x + vx * (R.dist - 1.2); bl.j.z = rj.z + vz * (R.dist - 1.2); bl.j.vx = 0; bl.j.vz = 0;
    return true;
  };
  const linhas13 = [];
  let pior = 0, bloqueios = 0;
  for (const g of gols) {
    for (const bloqueio of [false, true]) {
      for (const [nomeT, pequena, aspecto] of [['PC', false, 16 / 9], ['celular', true, 844 / 390]]) {
        const c = CM.criarCena(CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 }), g.m);
        if (bloqueio && bloquear(c)) bloqueios++;
        const pc = CM.criarPlanoCamera();
        let ruins = 0, total = 0;
        while (!c.acabou) {
          CM.passoCena(c);
          c.alfa = 1; CM.planoCamera(c, { pequena, aspecto }, pc); c.alfa = 0;
          if (pc.nome !== 'reacao') continue;
          total++;
          if (colados(c, pc, aspecto) > 0) ruins++;
        }
        pior = Math.max(pior, ruins);
        if (ruins) linhas13.push(`${g.nome}${bloqueio ? ' com bloqueio' : ''} ${nomeT}: ${ruins}/${total}`);
      }
    }
  }
  const nb = gols.length * 2;
  reg('13 plano da reação: ninguém a < 2 m da lente dentro do quadro (PC e celular; também com um jogador parado na frente da lente)', `${linhas13.join('; ') || 'nenhum quadro'} (${gols.length} cenas; bloqueios ${bloqueios}/${nb})`, '0 quadros', bloqueios === nb && pior === 0);
}

// 14 (contraprova de 14/10) o gol sai com quem cabeceou ainda no ar: a cena termina o pulo (mundo do treino: o lançamento
// do teste-cabeceio E3, a cena criada a 2–10 ticks do pouso)
if (CM) {
  const { alturaNaDistancia } = await imp('bola.js');
  let cenas = 0, piorPe = 0, piorPelve = 0, passou = 0;
  for (let s = 1; s <= 12; s++) {
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'ATA', attr: { impulsao: 70 } }];
    const m = S.criarMundo({ semente: 800 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    const p0 = { x: 18, y: 0.11, z: (s % 3) - 1 }, h = 2.1 + 0.02 * s, v0 = 17;
    const D = Math.hypot(p0.x, p0.z), ux = -p0.x / D, uz = -p0.z / D;
    let lo = -0.1, hi = 1.0;
    for (let k = 0; k < 30; k++) { const el = (lo + hi) / 2; if (alturaNaDistancia(p0, ux, uz, D, v0, el).y < h) lo = el; else hi = el; }
    const el = (lo + hi) / 2, b = m.bola;
    Object.assign(b.p, p0);
    b.v.x = ux * v0 * Math.cos(el); b.v.y = v0 * Math.sin(el); b.v.z = uz * v0 * Math.cos(el);
    b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false; m.posse = null;
    m.voo = { tipo: 'lancamento', de: 9, time: 0, para: 0, tick0: m.tick, tickChave: m.tick, alto: true };
    const j = m.jogadores[0], falta = 2 + (s % 9);
    for (let i = 0; i < 150; i++) {
      S.passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      const c = j.cab;
      if (!(c && c.saiu && m.tick > c.td && c.tp - m.tick === falta)) continue;
      const cena = CM.criarCena(CM.planejarComemoracao(m, { tick: m.tick, time: 0, id: 0 }), m);
      const a = cena.atores.find(q => q.id === 0);
      let ant = a.atu.slice();
      for (let t = 0; t < 45; t++) {
        CM.passoCena(cena);
        const n = a.atu, regua = (2.5 * Math.hypot(a.j.vx, a.j.vz) + 3) * PASSO + 1e-6;
        for (const k of [J.tornozeloE, J.tornozeloD]) {
          const d = Math.hypot(n[k * 3] - ant[k * 3], n[k * 3 + 1] - ant[k * 3 + 1], n[k * 3 + 2] - ant[k * 3 + 2]);
          piorPe = Math.max(piorPe, d / regua);
          if (d > regua) passou++;
        }
        piorPelve = Math.max(piorPelve, Math.abs(n[J.pelve * 3 + 1] - ant[J.pelve * 3 + 1]));
        ant = n.slice();
      }
      cenas++;
      break;
    }
  }
  reg('14 gol com quem cabeceou no ar: a cena termina o pulo (passos do tornozelo além da régua · maior passo da pelve)',
    `${passou} (pior ${f2(piorPe)}× a régua) · ${f3(piorPelve)} m (${cenas} cenas)`, '0 · ≤ 0,06 m (≥ 10 cenas)', cenas >= 10 && passou === 0 && piorPelve <= 0.06);
}

imprimir();
process.exit(falhas ? 1 : 0);
