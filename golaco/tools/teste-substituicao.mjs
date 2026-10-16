// Cena de substituição em Node (pedido do dono de 12/10: "quando tiver substituição, quero que tenha a cena de
// substituição, só jogador saindo e entrando, e embaixo, no modelo, a informação de quem entra e quem sai"):
// js/substituicao.js, a cena pura. CANHÃO com estados do MEIO da partida (estados de saída são quase iguais e enganam):
// 8 sementes × 6 paradas (lateral, escanteio, tiro de meta, tiro livre, pênalti e gol) = 48 cenas, com 1, 2, 3 e 5 pares,
// do time 0, do time 1 e dos dois, saindo perto (lado de cá), longe (lado de lá), pela linha de fundo e o goleiro, mais
// uma de 5 + 5 pares (o teto). As trocas passam pelo aplicarPendentes de verdade (a edição do "Editar time" e a parada
// forçada como a página faz em bolaParadaDeTeste/faltaDeTeste). Em cada cena, tick a tick:
//   S1 duração: 1 par 5,0 ± 0,1 s; 2 pares ou mais ≤ 6,5 s; o último plano é o corte para a TV ('fim');
//   S2 Regra 3.3: quem sai cruza o contorno a ≤ 0,5 m do ponto mais perto, nunca com |x| > 52 e |z| < 4,6 (o gol), antes
//      do fim do plano SAI dele; no 1º quadro do plano ele já anda a 2,2 ± 0,2 m/s a 3,0–3,6 m da linha; quem entra
//      cruza z = 34 com |x| ≤ 1,0 m e só depois do tick em que o par dele cruzou;
//   S3 pé de apoio ≤ 0,05 m/s em todos os atores; pé no ar ≤ 1,0·(2,5v + 3)·dt; ossos ±0,5 cm; sem NaN;
//   S4 nenhum par de corpos a < 0,5 m (fora os que a simulação já deixou assim); 0 contatos com as placas (|z| ≤ 39,6 e
//      |x| ≤ 58,1); ninguém dentro do gol;
//   S5 hashMundo e o estado do m.rng iguais antes e depois da cena; a mesma entrada = a mesma cena (tick a tick e em
//      quadros variados); 0 uso de m.rng/Math.random no módulo (o código e uma armadilha no Math.random);
//   S6 custo médio ≤ 0,6 ms por tick da cena (tempo de CPU do processo; se reprovar, repete sozinha, até 4 vezes) e a
//      criação (com a pré-rolagem) ≤ 3 ms;
//   S7 lente ≥ 2,5 m de todo ator (PC e celular); câmera nunca dentro da arquibancada, das placas ou do gol; o ator
//      principal no quadro em ≥ 95% dos quadros de cada plano, com os pés acima dos 20% de baixo no celular;
//   S8 paresDaPlaca certo (verde = entra, vermelho = sai, o do humano primeiro); o quarto árbitro com o kit 'arbitro';
//   S9 (15/10, sem partida) quem corre para as placas na hora da troca nunca encosta nelas e para (ver o item).
// "Antes" (sem js/substituicao.js): o reserva SURGE no lugar de quem saiu no mesmo tick (0 s de cena) — o teste REPROVA.
// --estresse: mais 48 sementes (289 cenas; ~1 min) — a contraprova de 14/10 achou com elas defeitos que as 8 do CI não
// pegavam (e que a mudança de estados de uma mescla da main expôs: a câmera colada em quem parava de lado, quem sai rente
// ao gol trombando em quem parou na reta, o reserva correndo para a lente no ENTRA, dois com a vez um dentro do outro).
//   node tools/teste-substituicao.mjs [--js <pasta js>] [--detalhe] [--estresse]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

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
  console.log(falhas ? `\nteste-substituicao: REPROVOU (${falhas})` : '\nteste-substituicao: PASSOU');
}

const P = await imp('partida.js');
const S = await imp('sim.js');
const A = await imp('anim.js');
const C = await imp('config.js');
const F = await imp('faltas.js');
const E = await imp('elenco.js');
const { J, NJ } = A;
const { PASSO, JOGADOR, CAMPO, BOLA } = C;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;

// ------------------------------------------------------------------------------------------------ canhão
const SEMENTES = [3, 5, 7, 11, 13, 17, 19, 23];
if (args.includes('--estresse')) SEMENTES.push(31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113,
  127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271);
const N_CASOS = SEMENTES.length * 6 + 1;
const TIPOS = ['lateral', 'escanteio', 'tiroDeMeta', 'tiroLivre', 'penalti', 'gol'];
const NPARES = [1, 2, 3, 5];
const MODOS = ['0', '1', 'ambos'];
const CRITERIOS = ['perto', 'longe', 'fundo', 'goleiro', 'meio'];

const emJogo = m => m.partida.estado === 'jogo' && !m.parada && m.naMao == null && !m.voo;
const fotoPos = m => new Map(m.jogadores.map(j => [j.id, { x: j.x, z: j.z }]));

/** Edição do time t: n pares, quem sai pelo critério (posições de agora). */
function edicao(m, t, n, criterio) {
  const st = m.times[t], el = E.ELENCOS[st.elenco];
  const emCampo = new Set(Object.values(st.vagas));
  const porId = id => m.jogadores.find(j => j.id === id);
  const gk = st.vagas.GOL;
  const linha = [...emCampo].filter(id => id !== gk && porId(id) && !(st.expulsos ?? []).includes(id));
  const pos = id => porId(id);
  const chave = {
    perto: id => -pos(id).z, longe: id => pos(id).z, fundo: id => -Math.abs(pos(id).x),
    meio: id => Math.abs(pos(id).x) + Math.abs(pos(id).z) * 0.3, goleiro: id => -pos(id).z,
  }[criterio];
  linha.sort((a, b) => chave(a) - chave(b) || a - b);
  const reservasLinha = el.jogadores.filter(j => !emCampo.has(j.id) && !st.saiu.includes(j.id) && j.pos !== 'GOL').map(j => j.id);
  const reservasGol = el.jogadores.filter(j => !emCampo.has(j.id) && !st.saiu.includes(j.id) && j.pos === 'GOL').map(j => j.id);
  const subs = [];
  if (criterio === 'goleiro' && reservasGol.length) subs.push({ sai: gk, entra: reservasGol[0] });
  for (const id of linha) { if (subs.length >= n) break; subs.push({ sai: id, entra: reservasLinha.shift() }); }
  const vagas = { ...st.vagas };
  for (const p of subs) { const v = Object.keys(vagas).find(k => vagas[k] === p.sai); vagas[v] = p.entra; }
  return { tipo: 'editarTime', time: t, base: st.versao, formacao: st.formacao, vagas, substituicoes: subs, tatica: { ...st.tatica } };
}

function limpar(m) { m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; }

/** A parada `tipo` (o time t recomeça), como a página faz nos testes (bolaParadaDeTeste/faltaDeTeste). */
function forcarParada(m, tipo, t) {
  const lado = m.ataca[t], ult = 1 - t;
  const b = m.bola;
  const ultimo = (x, z) => {
    const j = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
    limpar(m);
    Object.assign(b.p, { x, y: BOLA.raio, z }); Object.assign(b.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
  };
  if (tipo === 'lateral') { ultimo(Math.max(-44, Math.min(44, b.p.x)), (b.p.z >= 0 ? 1 : -1) * (MZ + 0.5)); return; }
  if (tipo === 'escanteio') { ultimo(lado * (MX + 0.6), (b.p.z >= 0 ? 1 : -1) * 10); return; }
  if (tipo === 'tiroDeMeta') { ultimo(-lado * (MX + 0.6), (b.p.z >= 0 ? 1 : -1) * 9); return; }
  if (tipo === 'gol') {
    const autor = m.jogadores.filter(j => j.time === t && j.posicao !== 'GOL').sort((a, c) => Math.abs(a.x - lado * MX) - Math.abs(c.x - lado * MX))[0];
    limpar(m);
    Object.assign(b.p, { x: lado * (MX - 0.5), y: 0.6, z: 0.5 }); Object.assign(b.v, { x: lado * 14, y: 0, z: 0 });
    b.rolando = false;
    m.ultimoToque = { id: autor.id, time: t, tick: m.tick };
    m.partida.ultimoTime = t; m.partida.ultimoId = autor.id; m.partida.ultimoTick = m.tick;
    // o goleiro deles fora do caminho (a bola já está a meio metro da linha)
    const gk = m.jogadores.find(j => j.time !== t && j.posicao === 'GOL');
    if (gk) P.teleportar(gk, lado * (MX - 3), 6, 0);
    return;
  }
  // falta (tiro livre: onde o condutor está; pênalti: dentro da área)
  const c = m.jogadores.filter(j => j.time === t && j.posicao !== 'GOL').sort((a, d) => a.id - d.id)[(m.tick % 7) + 1] ?? m.jogadores.find(j => j.time === t && j.posicao !== 'GOL');
  if (tipo === 'penalti') P.teleportar(c, lado * (MX - 9), 3, lado > 0 ? 0 : Math.PI);
  else P.teleportar(c, Math.max(-35, Math.min(35, c.x)), Math.max(-25, Math.min(25, c.z)), lado > 0 ? 0 : Math.PI);
  let d = null, dm = Infinity;
  for (const o of m.jogadores) { if (o.time === t || o.posicao === 'GOL') continue; const q = Math.hypot(o.x - c.x, o.z - c.z); if (q < dm) { dm = q; d = o; } }
  P.teleportar(d, c.x - lado * 1.1, c.z + 0.3, lado > 0 ? 0 : Math.PI);
  c.vx = 0; c.vz = 0;
  limpar(m);
  Object.assign(b.p, { x: c.x + lado * 0.4, y: BOLA.raio, z: c.z }); Object.assign(b.v, { x: 0, y: 0, z: 0 });
  m.posse = c.id;
  const f = F.montarFalta(m, d, c, 'bote', true);
  f.cartao = null;
  m.eventos = []; m.faltaPendente = f;
  P.regrasPartida(m);
}

/** Um caso: o mundo no passo das trocas, os eventos e as posições do passo anterior. */
function montarCaso(base, g) {
  const tipo = TIPOS[g % 6], n = NPARES[g % 4], modo = MODOS[Math.floor(g / 4) % 3], criterio = CRITERIOS[Math.floor(g / 2) % 5];
  const m = structuredClone(base);
  const tParada = modo === '1' ? 1 : 0;
  const eds = [];
  if (modo === '0' || modo === 'ambos') eds.push(edicao(m, 0, modo === 'ambos' ? Math.ceil(n / 2) : n, criterio));
  if (modo === '1' || modo === 'ambos') eds.push(edicao(m, 1, modo === 'ambos' ? Math.max(1, Math.floor(n / 2)) : n, criterio));
  P.passoPartida(m, P.entradaDemoPartida(m), eds);
  forcarParada(m, tipo, tParada);
  let antes = fotoPos(m);
  for (let i = 0; i < 700; i++) {
    antes = fotoPos(m);
    const ev = P.passoPartida(m, P.entradaDemoPartida(m), null);
    const subs = ev.filter(e => e.tipo === 'substituicao');
    if (subs.length) return { m, subs, antes, tipo, n: subs.length, modo, criterio, estado: m.partida.estado, eventos: ev.map(e => e.tipo) };
  }
  return { m: null, tipo, n, modo, criterio };
}

// ------------------------------------------------------------------------------------------------ antes (sem cena)
{
  const base = P.criarPartida({ semente: 7 });
  for (let i = 0; i < 1500 || !emJogo(base); i++) P.passoPartida(base, P.entradaDemoPartida(base), null);
  const caso = montarCaso(base, 0);
  if (caso.m) {
    const p = caso.subs[0], a = caso.antes.get(p.sai), novo = caso.m.jogadores.find(j => j.id === p.entra);
    reg('antes: a troca na simulação (sem cena)', `o ${p.entra} surge a ${f2(Math.hypot(novo.x - a.x, novo.z - a.z))} m de onde o ${p.sai} estava, no mesmo tick (${caso.m.tick}); cena 0 s; ninguém cruza a linha`, 'informativo', true, true);
  }
}

let SU = null;
try { SU = await imp('substituicao.js'); } catch (e) { SU = null; }
if (!SU) {
  reg('módulo js/substituicao.js (a cena de substituição)', 'não existe (o reserva surge no lugar do outro: 0 s de cena)', 'existe', false);
  imprimir();
  process.exit(1);
}

// os 48 casos (8 sementes × 6 paradas, do meio da partida) e o de 5 + 5
const casos = [];
{
  let g = 0;
  for (const s of SEMENTES) {
    const base = P.criarPartida({ semente: s });
    for (let i = 0; i < 1200; i++) P.passoPartida(base, P.entradaDemoPartida(base), null);
    for (let k = 0; k < 6; k++, g++) {
      for (let i = 0; i < 350 || !emJogo(base); i++) { P.passoPartida(base, P.entradaDemoPartida(base), null); if (i > 2000) break; }
      const caso = montarCaso(base, g);
      caso.semente = s; caso.g = g;
      casos.push(caso);
    }
  }
  // 5 + 5 (o teto): os dois times trocam 5 na mesma parada
  const base = P.criarPartida({ semente: 29 });
  for (let i = 0; i < 1800 || !emJogo(base); i++) P.passoPartida(base, P.entradaDemoPartida(base), null);
  const m = structuredClone(base);
  P.passoPartida(m, P.entradaDemoPartida(m), [edicao(m, 0, 5, 'meio'), edicao(m, 1, 5, 'fundo')]);
  forcarParada(m, 'lateral', 0);
  let antes = fotoPos(m), dez = null;
  for (let i = 0; i < 700 && !dez; i++) {
    antes = fotoPos(m);
    const ev = P.passoPartida(m, P.entradaDemoPartida(m), null);
    const subs = ev.filter(e => e.tipo === 'substituicao');
    if (subs.length) dez = { m, subs, antes, tipo: 'lateral', n: subs.length, modo: 'ambos', criterio: 'meio', semente: 29, g: 48, estado: m.partida.estado, eventos: ev.map(e => e.tipo) };
  }
  if (dez) casos.push(dez);
}
const validos = casos.filter(c => c.m);
reg('canhão: casos com a troca feita na parada', `${validos.length}/${casos.length} (${['lateral', 'escanteio', 'tiroDeMeta', 'tiroLivre', 'penalti', 'gol'].map(t => `${t} ${validos.filter(c => c.tipo === t).length}`).join(', ')}; pares ${[...new Set(validos.map(c => c.n))].sort((a, b) => a - b).join('/')})`, `${N_CASOS}/${N_CASOS} (${N_CASOS - 1} + o de 5 + 5)`, validos.length === N_CASOS && casos.length === N_CASOS);

// ------------------------------------------------------------------------------------------------ medidas de uma cena
const ossos = [[J.quadrilE, J.joelhoE, JOGADOR.coxa], [J.joelhoE, J.tornozeloE, JOGADOR.canela], [J.quadrilD, J.joelhoD, JOGADOR.coxa], [J.joelhoD, J.tornozeloD, JOGADOR.canela],
  [J.ombroE, J.cotoveloE, A.BRACO], [J.cotoveloE, J.maoE, A.ANTEBRACO], [J.ombroD, J.cotoveloD, A.BRACO], [J.cotoveloD, J.maoD, A.ANTEBRACO]];
const dist3 = (o, a, b) => Math.hypot(o[a * 3] - o[b * 3], o[a * 3 + 1] - o[b * 3 + 1], o[a * 3 + 2] - o[b * 3 + 2]);
const TORNS = [J.tornozeloE, J.tornozeloD];
const PCS = [['PC', false, 16 / 9], ['celular', true, 844 / 390]];
const PTS = [J.pelve, J.peito, J.cabeca, J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD, J.maoE, J.maoD];

/** Projeção (ndc) de p pela câmera {de, para, fov} com o aspecto a. */
function ndc(pc, a, x, y, z, out) {
  let fx = pc.para[0] - pc.de[0], fy = pc.para[1] - pc.de[1], fz = pc.para[2] - pc.de[2];
  const lf = Math.hypot(fx, fy, fz); fx /= lf; fy /= lf; fz /= lf;
  let rx = -fz, rz = fx; const lr = Math.hypot(rx, rz) || 1; rx /= lr; rz /= lr;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = x - pc.de[0], dy = y - pc.de[1], dz = z - pc.de[2];
  const zz = dx * fx + dy * fy + dz * fz, th = Math.tan((pc.fov * Math.PI) / 360);
  out.z = zz; out.x = (dx * rx + dz * rz) / (zz * th * a); out.y = (dx * ux + dy * uy + dz * uz) / (zz * th);
  return out;
}
const _n = { x: 0, y: 0, z: 0 };

function medirCena(caso) {
  const m = caso.m;
  const h0 = S.hashMundo(m), rng0 = JSON.stringify(m.rng);
  const plano = SU.planejarSubstituicao(m, caso.subs, { timeHumano: 0, posAntes: id => caso.antes.get(id) ?? null });
  const c = SU.criarCenaSubst(plano, m);
  const n = c.atores.length;
  const r = {
    plano, c, nan: 0, osso: 0, plantado: 0, razao: 0, piorPe: null, piorPlantado: null, corpo: Infinity, piorCorpo: null,
    placas: 0, gol: 0, golSai: 0, ticks: 0, lente: Infinity, piorLente: null, camSolido: 0, quadros: {}, inicioPlano: [],
    fimNome: null,
  };
  // corpos que a simulação já deixou a < 0,5 m (a barreira é ombro com ombro): não contam
  const juntos = new Set();
  for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
    const a = c.atores[p].j, b = c.atores[q].j;
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.5 + 1e-6) juntos.add(p * 1000 + q);
  }
  const ant = c.atores.map(() => ({ t: [new Float64Array(3), new Float64Array(3)], pes: [{}, {}], v: 0, noAr: true, ok: false }));
  const pc = SU.criarPlanoCameraSubst();
  let ipAnt = -1;
  while (!c.acabou && r.ticks < 9 * 60) {
    SU.passoCenaSubst(c); r.ticks++;
    for (let i = 0; i < n; i++) {
      const a = c.atores[i], o = a.atu, j = a.j;
      for (let q = 0; q < NJ * 3; q++) if (!Number.isFinite(o[q])) { r.nan++; break; }
      for (const [x, y, L0] of ossos) r.osso = Math.max(r.osso, Math.abs(dist3(o, x, y) - L0));
      const s0 = ant[i], v0 = Math.hypot(j.vx, j.vz);
      if (s0.ok) {
        const v = Math.max(v0, s0.v);
        for (let p = 0; p < 2; p++) {
          const it = TORNS[p];
          const d = Math.hypot(o[it * 3] - s0.t[p][0], o[it * 3 + 1] - s0.t[p][1], o[it * 3 + 2] - s0.t[p][2]);
          const vp = d / PASSO, pe = j.pes[p], pa = s0.pes[p];
          if (pa.apoio && pe.apoio && pa.x === pe.x && pa.z === pe.z && vp > r.plantado) { r.plantado = vp; r.piorPlantado = { id: a.id, tipo: SU.TIPOS[a.tipo], t: +(c.k / 60).toFixed(2), vp: +vp.toFixed(3) }; }
          const razao = vp / (2.5 * v + 3);
          if (razao > r.razao) { r.razao = razao; r.piorPe = { id: a.id, tipo: SU.TIPOS[a.tipo], t: +(c.k / 60).toFixed(2), vp: +vp.toFixed(2), v: +v.toFixed(2) }; }
        }
      }
      s0.ok = true; s0.v = v0;
      for (let p = 0; p < 2; p++) { const it = TORNS[p]; s0.t[p][0] = o[it * 3]; s0.t[p][1] = o[it * 3 + 1]; s0.t[p][2] = o[it * 3 + 2]; s0.pes[p] = { apoio: j.pes[p].apoio, x: j.pes[p].x, z: j.pes[p].z }; }
      // placas, gol
      if (Math.abs(j.z) > 39.6 || Math.abs(j.x) > 58.1) r.placas++;
      if (Math.abs(j.x) > MX && Math.abs(j.x) < MX + CAMPO.gol.profundidade + 0.3 && Math.abs(j.z) < CAMPO.gol.largura / 2 + 0.35) r.gol++;
      if (a.tipo === 1 && Math.abs(j.x) > 52 && Math.abs(j.z) < 4.6) { r.golSai++; r.piorGolSai ??= { s: caso.semente, tipo: caso.tipo, id: a.id, t: +(c.k / 60).toFixed(2), x: +j.x.toFixed(2), z: +j.z.toFixed(2) }; }
    }
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (juntos.has(p * 1000 + q)) continue;
      const a = c.atores[p].j, b = c.atores[q].j, d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < r.corpo) { r.corpo = d; r.piorCorpo = { a: c.atores[p].id, b: c.atores[q].id, t: +(c.k / 60).toFixed(2) }; }
    }
    // câmera: PC e celular (o estado desenhado no fim do tick: alfa = 1)
    c.alfa = 1;
    for (const [nomeT, pequena, aspecto] of PCS) {
      SU.planoCameraSubst(c, { pequena, aspecto }, pc);
      if (pc.nome === 'fim') continue;
      const chave = `${pc.nome}/${nomeT}`, qd = r.quadros[chave] ?? (r.quadros[chave] = { n: 0, dentro: 0, pes: 0 });
      qd.n++;
      // lente: nenhuma junta de nenhum ator a < 2,5 m
      for (const a of c.atores) for (const i of PTS) {
        const d = Math.hypot(a.atu[i * 3] - pc.de[0], a.atu[i * 3 + 1] - pc.de[1], a.atu[i * 3 + 2] - pc.de[2]);
        if (d < r.lente) { r.lente = d; r.piorLente = { id: a.id, tipo: SU.TIPOS[a.tipo], plano: pc.nome, t: +(c.k / 60).toFixed(2) }; }
      }
      if (Math.abs(pc.de[2]) > 39.5 || Math.abs(pc.de[0]) > 58 || (Math.abs(pc.de[0]) > MX - 0.5 && Math.abs(pc.de[2]) < 4.6) || caso.solido(pc.de[0], pc.de[1], pc.de[2])) r.camSolido++;
      // o ator principal: o que sai no plano dele; o 1º reserva no ENTRA
      const ip = SU.planoEm(c, SU.tempoCenaSubst(c));
      const pl = plano.planos[ip];
      const sujeito = pl.nome === 'entra' ? c.entra[0] : c.sai.find(a => a.par === pl.par);
      let dentro = true, peMin = Infinity;
      for (const i of PTS) {
        ndc(pc, aspecto, sujeito.atu[i * 3], sujeito.atu[i * 3 + 1], sujeito.atu[i * 3 + 2], _n);
        if (_n.z <= 0 || Math.abs(_n.x) > 1 || Math.abs(_n.y) > 1) dentro = false;
        if (i === J.tornozeloE || i === J.tornozeloD || i === J.pontaE || i === J.pontaD) peMin = Math.min(peMin, _n.y);
      }
      if (dentro) qd.dentro++;
      if (!pequena || peMin >= -0.6) qd.pes++;
      // 1º quadro do plano de quem sai: a velocidade e a distância da linha
      if (nomeT === 'PC' && ip !== ipAnt) {
        ipAnt = ip;
        if (pl.nome !== 'entra') {
          const sd = plano.pares[sujeito.par].saida, sj = sujeito.j;
          r.inicioPlano.push({ plano: pl.nome, v: Math.hypot(sj.vx, sj.vz), d: -((sj.x - sd.x) * sd.nx + (sj.z - sd.z) * sd.nz) });
        }
      }
    }
  }
  c.alfa = 1;
  SU.planoCameraSubst(c, { pequena: false, aspecto: 16 / 9 }, pc);
  r.fimNome = pc.nome;
  r.duracao = r.ticks * PASSO;
  r.hashIgual = h0 === S.hashMundo(m);
  r.rngIgual = rng0 === JSON.stringify(m.rng);
  // Regra 3.3
  r.sai = c.sai.map(a => {
    const p = plano.pares[a.par], pl = a.par === 0 ? plano.planos[0] : plano.planos[1];
    return { id: a.id, cruzou: a.cruzou, t: a.cruzou * PASSO, erro: a.cruzou >= 0 ? Math.hypot(a.cx - p.saida.x, a.cz - p.saida.z) : Infinity, fimPlano: pl.t1, linha: p.saida.linha, goleiro: p.goleiro };
  });
  r.entra = c.entra.map(a => {
    const par = c.sai.find(x => x.par === a.par);
    return { id: a.id, cruzou: a.cruzou, cx: a.cx, parCruzou: par ? par.cruzou : -1 };
  });
  return r;
}

// ------------------------------------------------------------------------------------------------ as cenas
const EF = await imp('estadio-forma.js');
for (const caso of validos) caso.solido = (x, y, z) => EF.solidoEm(x, y, z, 0.3, false);
// armadilha: Math.random proibido durante as cenas (S5)
const mathRandom = Math.random;
let usouRandom = 0;
Math.random = () => { usouRandom++; return mathRandom(); };
const res = validos.map(caso => ({ caso, r: medirCena(caso) }));
Math.random = mathRandom;
const todos = res.map(x => x.r);
if (detalhe) for (const { caso, r } of res) console.log(`s${caso.semente} ${caso.tipo} ${caso.n} pares (${caso.modo}, ${caso.criterio}) estado ${caso.estado}: ${f2(r.duracao)} s; sai ${r.sai.map(s => `${s.id}@${f2(s.t)}s ${s.linha}${s.goleiro ? ' (gol.)' : ''} erro ${f2(s.erro)}`).join(', ')}; entra ${r.entra.map(e => `${e.id}@${e.cruzou} x ${f2(e.cx)}`).join(', ')}`);
{
  const porN = {};
  for (const r of todos) (porN[r.plano.pares.length] ??= []).push(r.duracao);
  reg('cenas', Object.entries(porN).map(([k, v]) => `${k} par(es): ${v.length} cenas, ${f2(Math.min(...v))}–${f2(Math.max(...v))} s`).join('; '), 'informativo', true, true);
  const um = todos.filter(r => r.plano.pares.length === 1), mais = todos.filter(r => r.plano.pares.length > 1);
  reg('S1 duração: 1 par', `${um.length} cenas: ${f2(Math.min(...um.map(r => r.duracao)))}–${f2(Math.max(...um.map(r => r.duracao)))} s`, '5,0 ± 0,1 s', um.length > 0 && um.every(r => Math.abs(r.duracao - 5) <= 0.1));
  reg('S1 duração: 2 pares ou mais (até 5 + 5)', `${mais.length} cenas: máx ${f2(Math.max(...mais.map(r => r.duracao)))} s (${Math.max(...mais.map(r => r.plano.pares.length))} pares)`, '≤ 6,5 s', mais.length > 0 && mais.every(r => r.duracao <= 6.5 + 1e-9));
  reg('S1 o último plano é o corte para a TV', `${todos.filter(r => r.fimNome === 'fim').length}/${todos.length}`, 'todas', todos.every(r => r.fimNome === 'fim'));
}
{
  const sais = todos.flatMap(r => r.sai);
  const naoCruzou = sais.filter(s => s.cruzou < 0).length;
  const pior = sais.reduce((a, s) => (s.erro > a.erro ? s : a), { erro: -1 });
  reg('S2 quem sai cruza a ≤ 0,5 m do ponto mais perto do contorno (Regra 3.3)', `${sais.length} saídas (${sais.filter(s => s.linha === 'fundo').length} pela linha de fundo, ${sais.filter(s => s.goleiro).length} de goleiro); não cruzou ${naoCruzou}; erro máx ${f2(pior.erro)} m`, '≤ 0,5 m, todas', naoCruzou === 0 && pior.erro <= 0.5);
  const golSai = todos.reduce((s, r) => s + r.golSai, 0);
  reg('S2 quem sai nunca pela boca do gol (|x| > 52 e |z| < 4,6)', `${golSai} ticks${golSai ? ' ' + todos.filter(r => r.piorGolSai).map(r => JSON.stringify(r.piorGolSai)).join(' ') : ''}`, '0', golSai === 0);
  const tarde = sais.filter(s => s.cruzou >= 0 && s.t > s.fimPlano + 1e-9);
  reg('S2 quem sai cruza antes do fim do plano SAI dele', `${tarde.length} tarde; cruzamento ${f2(Math.min(...sais.map(s => s.t)))}–${f2(Math.max(...sais.filter(s => s.cruzou >= 0).map(s => s.t)))} s`, '0', tarde.length === 0);
  const ini = todos.flatMap(r => r.inicioPlano);
  const ruins = ini.filter(x => Math.abs(x.v - 2.2) > 0.2 || x.d < 3.0 - 1e-6 || x.d > 3.6 + 1e-6);
  reg('S2 1º quadro do plano: quem sai já anda a 2,2 ± 0,2 m/s, a 3,0–3,6 m da linha', `${ini.length} planos: v ${f2(Math.min(...ini.map(x => x.v)))}–${f2(Math.max(...ini.map(x => x.v)))} m/s, d ${f2(Math.min(...ini.map(x => x.d)))}–${f2(Math.max(...ini.map(x => x.d)))} m; fora ${ruins.length}`, 'todos', ini.length > 0 && ruins.length === 0);
  const ents = todos.flatMap(r => r.entra), cruz = ents.filter(e => e.cruzou >= 0);
  const xMal = cruz.filter(e => Math.abs(e.cx) > 1.0), antesDoPar = ents.filter(e => e.cruzou >= 0 && !(e.parCruzou >= 0 && e.cruzou > e.parCruzou));
  const primeiro = todos.filter(r => r.entra[0].cruzou < 0).length;
  reg('S2 quem entra cruza a lateral pelo meio-campo (|x| ≤ 1 m) só depois do par dele; o 1º cruza em toda cena', `${cruz.length}/${ents.length} cruzaram (os outros: depois do corte); |x| máx ${f2(Math.max(...cruz.map(e => Math.abs(e.cx))))} m; antes do par ${antesDoPar.length}; cenas sem o 1º cruzar ${primeiro}`, '|x| ≤ 1; 0; 0', xMal.length === 0 && antesDoPar.length === 0 && primeiro === 0);
}
{
  reg('S3 sem NaN nas poses', `${todos.reduce((s, r) => s + r.nan, 0)}`, '0', todos.every(r => r.nan === 0));
  reg('S3 ossos (coxa, canela, braço, antebraço)', `erro máx ${f2(Math.max(...todos.map(r => r.osso)) * 1000)} mm`, '≤ 5 mm', todos.every(r => r.osso <= 0.005));
  const pp = todos.reduce((a, r) => (r.plantado > a.plantado ? r : a));
  reg('S3 pé de apoio (todos os atores)', `${f3(pp.plantado)} m/s${pp.piorPlantado ? ' ' + JSON.stringify(pp.piorPlantado) : ''}`, '≤ 0,05 m/s', pp.plantado <= 0.05);
  const pr = todos.reduce((a, r) => (r.razao > a.razao ? r : a));
  reg('S3 pé no ar: desloc. / (2,5v + 3)·dt', `${f2(pr.razao)} ${JSON.stringify(pr.piorPe)}`, '≤ 1,0', pr.razao <= 1);
}
{
  const pc = todos.reduce((a, r) => (r.corpo < a.corpo ? r : a));
  reg('S4 nenhum par de corpos a < 0,5 m', `mín ${f3(pc.corpo)} m ${JSON.stringify(pc.piorCorpo)}`, '≥ 0,5 m', pc.corpo >= 0.5 - 1e-6);
  reg('S4 placas e gol: ninguém nas placas nem dentro do gol', `placas ${todos.reduce((s, r) => s + r.placas, 0)} ticks; gol ${todos.reduce((s, r) => s + r.gol, 0)} ticks`, '0 e 0', todos.every(r => r.placas === 0 && r.gol === 0));
}
// S5 pureza
{
  reg('S5 hashMundo e m.rng iguais antes e depois da cena', `hash ${todos.filter(r => r.hashIgual).length}/${todos.length}, rng ${todos.filter(r => r.rngIgual).length}/${todos.length}`, 'todas', todos.every(r => r.hashIgual && r.rngIgual));
  const fonte = fs.readFileSync(path.join(pastaJs, 'substituicao.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const usa = /Math\.random|\brng\b|proximoU32|uniforme\(/.test(fonte);
  reg('S5 sem m.rng nem Math.random (o código e uma armadilha durante as 49 cenas)', `no código: ${usa ? 'USA' : 'não'}; chamadas ao Math.random nas cenas: ${usouRandom}`, 'não; 0', !usa && usouRandom === 0);
  // a mesma entrada = a mesma cena: tick a tick (duas vezes) e em quadros variados (avancarCenaSubst)
  const caso = validos.find(x => x.n >= 3) ?? validos[0];
  const pl = () => SU.planejarSubstituicao(caso.m, caso.subs, { timeHumano: 0, posAntes: id => caso.antes.get(id) ?? null });
  const a1 = SU.criarCenaSubst(pl(), caso.m), a2 = SU.criarCenaSubst(pl(), caso.m), a3 = SU.criarCenaSubst(pl(), caso.m);
  const N = 8 * 60, na = a1.atores.length, guarda = new Float32Array(N * na * NJ * 3);
  let n1 = 0;
  while (!a1.acabou && n1 < N) { SU.passoCenaSubst(a1); for (let i = 0; i < na; i++) guarda.set(a1.atores[i].atu, ((a1.k - 1) * na + i) * NJ * 3); n1++; }
  let dif2 = 0;
  for (let k = 0; k < n1; k++) { SU.passoCenaSubst(a2); for (let i = 0; i < na; i++) { const o = a2.atores[i].atu, b0 = (k * na + i) * NJ * 3; for (let q = 0; q < NJ * 3; q++) if (o[q] !== guarda[b0 + q]) dif2++; } }
  let dif3 = 0, comparados = 0, sem = 12345;
  const rnd = () => { sem = (Math.imul(sem, 1103515245) + 12345) >>> 0; return sem / 4294967296; };
  while (!a3.acabou) {
    SU.avancarCenaSubst(a3, 0.002 + rnd() * 0.06);
    if (a3.ticksUltimo > 0) {
      for (let i = 0; i < na; i++) { const o = a3.atores[i].atu, b0 = ((a3.k - 1) * na + i) * NJ * 3; for (let q = 0; q < NJ * 3; q++) if (o[q] !== guarda[b0 + q]) dif3++; }
      comparados++;
    }
  }
  reg('S5 a mesma entrada = a mesma cena (duas vezes; e em quadros variados)', `${n1} ticks: ${dif2} números diferentes; ${comparados} quadros variados: ${dif3} diferentes; ticks ${n1} / ${a3.k}`, '0, 0, mesmo nº de ticks', dif2 === 0 && dif3 === 0 && comparados > 50 && n1 === a3.k);
}
// S6 custo (tempo de CPU do processo: a máquina dividida não conta a fila do escalonador)
{
  let melhor = Infinity, tentativas = 0, criarMax = Infinity;
  // (a 1ª passada aquece o JIT; as medidas valem da 2ª em diante; repete sozinha se reprovar, até 4 vezes)
  for (; tentativas < 5 && (melhor > 0.6 || criarMax > 3); tentativas++) {
    let cpu = 0, ticks = 0, criar = 0;
    for (const caso of validos) {
      const plano = SU.planejarSubstituicao(caso.m, caso.subs, { timeHumano: 0, posAntes: id => caso.antes.get(id) ?? null });
      // a criação (uma vez por cena, ~0,3 ms): a melhor de 3 no relógio de parede (o tempo de CPU do processo soma as
      // linhas do coletor de lixo de outras horas)
      let c = null, melhorCriar = Infinity;
      for (let r = 0; r < 3; r++) { const t0 = performance.now(); c = SU.criarCenaSubst(plano, caso.m); melhorCriar = Math.min(melhorCriar, performance.now() - t0); }
      criar = Math.max(criar, melhorCriar);
      const u2 = process.cpuUsage();
      while (!c.acabou) { SU.passoCenaSubst(c); ticks++; }
      const u3 = process.cpuUsage(u2);
      cpu += (u3.user + u3.system) / 1000;
    }
    if (tentativas === 0) { melhor = Infinity; continue; }
    melhor = Math.min(melhor, cpu / ticks);
    criarMax = Math.min(criarMax, criar);
  }
  reg('S6 custo médio da cena por tick (CPU; 49 cenas)', `${f3(melhor)} ms (${tentativas - 1} medida${tentativas > 2 ? 's' : ''} depois de aquecer)`, '≤ 0,6 ms', melhor <= 0.6);
  reg('S6 criação da cena com a pré-rolagem de quem sai (a pior das 49)', `${f2(criarMax)} ms`, '≤ 3 ms', criarMax <= 3);
}
// S7 câmera
{
  const pl = todos.reduce((a, r) => (r.lente < a.lente ? r : a));
  reg('S7 lente ≥ 2,5 m de todo ator (PC e celular)', `mín ${f2(pl.lente)} m ${JSON.stringify(pl.piorLente)}`, '≥ 2,5 m', pl.lente >= 2.5);
  reg('S7 câmera nunca dentro da arquibancada, das placas, dos bancos ou do gol', `${todos.reduce((s, r) => s + r.camSolido, 0)} quadros`, '0', todos.every(r => r.camSolido === 0));
  const piores = [];
  let ok = true, okPes = true;
  for (const { caso, r } of res) {
    for (const [k, q] of Object.entries(r.quadros)) {
      const fr = q.dentro / q.n, fp = q.pes / q.n;
      if (fr < 0.95) { ok = false; piores.push(`s${caso.semente} ${caso.tipo} ${k}: ${Math.round(fr * 100)}%`); }
      if (fp < 0.95) { okPes = false; piores.push(`s${caso.semente} ${caso.tipo} ${k} pés: ${Math.round(fp * 100)}%`); }
    }
  }
  const min = (f) => Math.min(...res.flatMap(({ r }) => Object.values(r.quadros).map(f)));
  reg('S7 o ator principal no quadro em ≥ 95% dos quadros de cada plano (PC e celular)', `pior ${Math.round(min(q => q.dentro / q.n) * 100)}%${piores.length ? ' — ' + piores.slice(0, 4).join('; ') : ''}`, '≥ 95%', ok);
  reg('S7 celular: os pés do ator principal acima dos 20% de baixo (a faixa)', `pior ${Math.round(min(q => q.pes / q.n) * 100)}% dos quadros`, '≥ 95%', okPes);
}
// S8 a placa e o quarto árbitro
{
  const r = todos.find(x => new Set(x.plano.pares.map(p => p.time)).size === 2 && x.plano.pares.length >= 3) ?? todos[0];
  const c = r.c, seq = [];
  for (let t = 0; t < c.plano.duracao; t += 0.4) { const p = SU.paresDaPlaca(c, t); if (!seq.length || seq[seq.length - 1].indice !== p.indice) seq.push({ ...p }); }
  const ordem = c.plano.pares.map(p => p.time);
  const humanoPrimeiro = ordem.every((t, i) => i === 0 || !(t === 0 && ordem[i - 1] === 1)) && ordem[0] === 0;
  const certos = seq.every(p => {
    const par = c.plano.pares[p.indice];
    return p.entra === E.fichaDe(par.entra).num && p.sai === E.fichaDe(par.sai).num && p.corEntra === 'verde' && p.corSai === 'vermelho';
  });
  const troca = seq.length >= 2 && seq[0].indice === 0 && seq[1].indice === 1;
  reg('S8 placa: os números certos (verde entra, vermelho sai), o do humano primeiro, par a par', `${seq.map(p => `[▲${p.entra} ▼${p.sai} t${p.time}]`).join(' ')}; ordem dos times ${ordem.join(',')}`, 'certos; humano primeiro; passa de par em par', certos && humanoPrimeiro && troca);
  const q = SU.infoAtoresSubst(c).find(a => a.tipo === 'quarto');
  reg('S8 o quarto árbitro com o kit dos árbitros', q ? `id ${q.id}, kit ${q.kit}, time ${q.time}` : 'não existe', "id 203, kit 'arbitro'", !!q && q.id === 203 && q.kit === 'arbitro');
}
// S9 (15/10, frente "cenas robustas") quem corre para as placas na hora da troca, SEM partida nova (determinístico): numa
// cena do canhão, um jogador que não troca é posto correndo para as placas (as 4: a lateral de lá e a de cá, as 2 linhas de
// fundo, longe do gol) a 2, 3 e 4 m delas, a 3–8,5 m/s, de 15° a 75° da reta para fora (dos dois lados), nos casos em que o
// corpo consegue parar antes (a velocidade para fora vn ≤ √(2·11·(d − 0,4)): 11 m/s² ~ 87% da freada mais forte do corpo,
// √(freio² + latCorte²) ≈ 12,6 — a −freio na linha e latCorte de lado juntos): ele nunca encosta nelas (|z| ≤ 39,6,
// |x| ≤ 58,1) e para (≤ 0,3 m/s no fim da cena).
// (Na lógica do domínio-sem-passar, semente 3, tiro de meta: um jogador a 7,7 m/s na diagonal para a lateral de lá, a 2 m das
// placas, encostou nelas e correu 25 m ao longo delas a 5 m/s a cena inteira — o pedido sem a velocidade para fora se
// repetia sem frear; S4, 335 ticks.)
{
  const base = validos.find(c => c.tipo === 'lateral' && c.n === 1) ?? validos[0];
  const trocam = new Set(base.subs.flatMap(p => [p.sai, p.entra]));
  const PZ = MZ + CAMPO.entorno, PX = MX + CAMPO.entorno;
  let n = 0, placas = 0, naoParou = 0, pior = null, piorFolga = Infinity;
  for (const [eixo, s] of [['z', -1], ['z', 1], ['x', -1], ['x', 1]]) for (const d of [2, 3, 4]) for (const v of [3, 5, 7.7, 8.5]) for (const ag of [15, 30, 45, 60, 75]) for (const lado of [-1, 1]) {
    const vn = v * Math.cos(ag * Math.PI / 180);
    if (vn > Math.sqrt(2 * 11 * (d - 0.4))) continue;
    const m = structuredClone(base.m);
    const j = m.jogadores.find(o => !trocam.has(o.id) && o.posicao !== 'GOL');
    // a reta para fora (nx, nz) e a de lado (tx, tz)
    const nx = eixo === 'x' ? s : 0, nz = eixo === 'z' ? s : 0, tx = eixo === 'z' ? 1 : 0, tz = eixo === 'x' ? 1 : 0;
    const x = eixo === 'x' ? s * (PX - d) : 25 * lado, z = eixo === 'z' ? s * (PZ - d) : 15 * lado;
    const ux = nx * Math.cos(ag * Math.PI / 180) + tx * lado * Math.sin(ag * Math.PI / 180), uz = nz * Math.cos(ag * Math.PI / 180) + tz * lado * Math.sin(ag * Math.PI / 180);
    P.teleportar(j, x, z, Math.atan2(uz, ux));
    j.vx = ux * v; j.vz = uz * v;
    const plano = SU.planejarSubstituicao(m, base.subs, { timeHumano: 0, posAntes: id => base.antes.get(id) ?? null });
    const c = SU.criarCenaSubst(plano, m);
    const a = c.atores.find(o => o.id === j.id);
    let fora = 0, folga = Infinity;
    while (!c.acabou) {
      SU.passoCenaSubst(c);
      const q = a.j;
      folga = Math.min(folga, 39.6 - Math.abs(q.z), 58.1 - Math.abs(q.x));
      if (Math.abs(q.z) > 39.6 || Math.abs(q.x) > 58.1) fora++;
    }
    n++;
    if (fora) { placas++; if (!pior) pior = `${eixo}${s > 0 ? '+' : '−'} a ${d} m, ${v} m/s a ${ag}° (${lado > 0 ? '+' : '−'}): ${fora} ticks, folga ${f2(folga)} m`; }
    if (Math.hypot(a.j.vx, a.j.vz) > 0.3) naoParou++;
    piorFolga = Math.min(piorFolga, folga);
  }
  reg('S9 quem corre para as placas na hora da troca (sem partida): nunca encosta nelas e para', `${n} corridas: ${placas} encostam${pior ? ' (1ª: ' + pior + ')' : ''}; ${naoParou} sem parar no fim; a menor folga até as placas ${f2(piorFolga)} m`, '0; 0', n > 0 && placas === 0 && naoParou === 0);
}
imprimir();
process.exit(falhas ? 1 : 0);
