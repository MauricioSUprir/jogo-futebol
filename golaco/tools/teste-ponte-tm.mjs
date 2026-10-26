// teste-ponte-tm: a ponte com o Total Match em Node (contrato "Ponte com o Total Match" no CONTRATOS.md) — o pedido do
// TM vira elencos e times (tm-times.js), a partida com o humano no lado do usuário e a trava "só o meu jogador"
// (partida.js, acoes.js), a súmula e o resultado no formato do contrato (sumula.js). Os pedidos são montados aqui (o
// formato v2 do tm3d.js, com as vagas da prancheta do TM): o teste não depende do TM nem de arquivo de fora.
//
//  P1  sem recuo: a partida padrão (Golaço × Ventania) tem o MESMO hash a cada 300 passos com e sem as opções novas
//      (humano 0, sem trava) e antes/depois de registrar os elencos do TM; o treino não tem m.trava/m.timeHumano novos.
//  P2  tm-times: ids 1001–1018 e 2001–2018, o mapa id → tmId, a formação do TM → a do GOLAÇO (4-3-3, 4-2-3-1, 3-4-3 →
//      3-5-2, 4-1-2-1-2 → 4-4-2), o goleiro no GOL, 11 vagas distintas, a vaga da prancheta respeitada (o lateral-esquerdo
//      na esquerda, o zagueiro posto na lateral direita joga lá), o nível comprimido (overall 90 → 82, 60 → 67) e a nota
//      na posição = nível ± 1; atributosDe devolve uma CÓPIA do attr; registrar de novo o mesmo elenco substitui.
//  P3  humano no visitante: m.timeHumano 1, humanos [1], o controlado é do time 1 e a entrada vai para ele;
//      entradaDemoPartida joga pelo time 1.
//  P4  trava: o travado (pedido com ele no BANCO entra no lugar do titular mais parecido) é o controlado desde o começo e
//      NUNCA deixa de ser, numa partida inteira com TROCAR/GOLEIRO apertados o tempo todo pelo "humano" (humano 0 e 1);
//      a substituição do travado é recusada (código 4).
//  P5  resultado (§2) de 3 partidas curtas inteiras IA × IA: homeGoals/awayGoals = placar = soma dos gols por lado; posse
//      somando 100; chutes ≥ no alvo ≥ gols (sem contra) por lado; minuto inteiro 1–90; cor 'yellow'|'red'; o tmId de
//      cada gol é do lado certo (o do gol contra, do outro lado), a assistência do mesmo time do autor; `jogador` só com a
//      trava, com a nota em 4,5–10.
//  P6  súmula com eventos montados: assistência, gol contra (lado = beneficiado, autor do outro time, sem assistência),
//      pênalti (evento 'penalti' no mesmo passo), chute desviado (autor = quem chutou, assistência mantida), 2º amarelo =
//      amarelo + vermelho, minuto 46 no começo do 2º tempo, posse 50/50 sem bola rolando.
//  P7  as estatísticas das cenas: escanteios e faltas = contadores independentes, o porTempo no apito do 1º tempo, o
//      resultadoTM com as chaves de antes; P7b o chute aberto no apito do 1º tempo fecha no apito (fica no 1º tempo).
//
//  P7  as estatísticas das cenas (escanteios, faltas, porTempo) contra contadores independentes; o resultadoTM com as chaves
//      de antes.
//  P8  (o pós-jogo, PR 4) o campo OPCIONAL `melhor` do resultadoTM = o argmax independente da nota de quem jogou, com a nota
//      da mesma conta do `jogador` (o travado melhor em campo: as duas iguais); o resto do resultado igual campo a campo ao
//      da versão de antes (--base <pasta js da base>: a súmula da base lida nos mesmos passos; sem ele, ao montado de novo).
//
//   node tools/teste-ponte-tm.mjs [--js <pasta>] [--min 0.5] [--base <pasta js>]   (minutos por tempo: P3 com --min, P4 com
//      2×, P5-A com 4×)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const MIN = +arg('--min', 0.5);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-ponte-tm: REPROVOU (${falhas})` : '\nteste-ponte-tm: PASSOU');
  process.exit(falhas ? 1 : 0);
}

const t0 = Date.now();
const P = await imp('partida.js');
const SIM = await imp('sim.js');
const E = await imp('elenco.js');
const C = await imp('config.js');
let TT, SU;
try { TT = await imp('tm-times.js'); SU = await imp('sumula.js'); } catch (e) {
  reg('módulos da ponte', `faltam: ${e.message.slice(0, 80)}`, 'tm-times.js e sumula.js', false);
  fim();
}

// ------------------------------------------------------------------ pedidos (tools/lib/pedidos-tm.mjs)
const { AZUL, VERDE, ROXO, PED_A, PED_B, PED_C } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);

// ------------------------------------------------------------------ P1 sem recuo (ANTES de registrar qualquer elenco)
function hashes(opc, n = 1500) {
  const m = P.criarPartida({ semente: 7, minutosPorTempo: 2, ...opc });
  const hs = [];
  for (let i = 0; i < n; i++) { P.passoPartida(m, P.entradaDemoPartida(m)); if (i % 300 === 299) hs.push(SIM.hashMundo(m).toString(16)); }
  return { hs, m };
}
const antes = hashes({});
const comOpcoes = hashes({ humano: 0, trava: null });
{
  const Ttmp = TT.timesDoPedido(PED_A);
  for (const el of Ttmp.elencos) E.registrarElenco(el);
}
const depois = hashes({});
const igual = (a, b) => a.hs.length === b.hs.length && a.hs.every((h, i) => h === b.hs[i]);
reg('P1 partida padrão: mesmo hash com humano 0 / sem trava e depois de registrar os elencos do TM',
  `${antes.hs.length} hashes: ${igual(antes, comOpcoes) ? 'iguais' : 'DIFERENTES'} (opções) · ${igual(antes, depois) ? 'iguais' : 'DIFERENTES'} (registro)`,
  'iguais', igual(antes, comOpcoes) && igual(antes, depois));
reg('P1 padrão: timeHumano 0, sem trava, controlado só do time 0', `timeHumano ${antes.m.timeHumano} · trava ${antes.m.trava ?? 'nenhuma'} · humanos [${antes.m.humanos}]`,
  '0 · nenhuma · [0]', antes.m.timeHumano === 0 && antes.m.trava == null && antes.m.humanos.length === 1 && antes.m.humanos[0] === 0);

// ------------------------------------------------------------------ P2 tm-times
const TA = TT.timesDoPedido(PED_A), TB = TT.timesDoPedido(PED_B), TC = TT.timesDoPedido(PED_C);
{
  const ids0 = TA.elencos[0].jogadores.map(j => j.id), ids1 = TA.elencos[1].jogadores.map(j => j.id);
  const okIds = ids0.join() === Array.from({ length: 18 }, (_, i) => 1001 + i).join() && ids1.join() === Array.from({ length: 18 }, (_, i) => 2001 + i).join();
  const okMapa = ids0.every((id, i) => TA.mapa[id]?.tmId === AZUL.players[i].tmId && TA.mapa[id].lado === 0 && TA.mapa[id].nome === AZUL.players[i].name)
    && ids1.every((id, i) => TA.mapa[id]?.tmId === VERDE.players[i].tmId && TA.mapa[id].lado === 1);
  reg('P2 ids 1001–1018 / 2001–2018 e o mapa id → {tmId, nome, lado}', `${okIds ? 'ids ok' : 'ids errados'} · ${okMapa ? 'mapa ok' : 'mapa errado'}`, 'ok · ok', okIds && okMapa);
  const forms = [TA.times[0].formacao, TA.times[1].formacao, TC.times[0].formacao, TC.times[1].formacao];
  reg('P2 formação do TM → GOLAÇO (4-3-3, 4-2-3-1, 3-4-3, 4-1-2-1-2)', forms.join(', '), '4-3-3, 4-2-3-1, 3-5-2, 4-4-2', forms.join() === '4-3-3,4-2-3-1,3-5-2,4-4-2');
  let okVagas = true, det = '';
  for (const T of [TA, TB, TC]) for (const t of [0, 1]) {
    const v = T.times[t].vagas, ids = Object.values(v);
    const el = T.elencos[t];
    const ficha = id => el.jogadores.find(j => j.id === id);
    if (ids.length !== 11 || new Set(ids).size !== 11 || ids.some(id => !ficha(id))) { okVagas = false; det = `${el.sigla}: vagas ${ids.length}`; }
    if (ficha(v.GOL)?.pos !== 'GOL') { okVagas = false; det = `${el.sigla}: GOL = ${ficha(v.GOL)?.pos}`; }
  }
  reg('P2 11 vagas distintas e o goleiro no GOL (6 times)', det || 'ok', 'ok', okVagas);
  // a vaga da prancheta: o LE (slot x 16) na esquerda; no Verde o ZAGUEIRO posto na lateral direita (slot 84) joga de LD
  const vA = TA.times[0].vagas, vV = TA.times[1].vagas;
  const leA = 1002, zagLd = 2005;
  reg('P2 a vaga da prancheta manda (LE na LE; o zagueiro da lateral direita na LD)', `Azul LE = ${vA.LE === leA ? 'o LE' : vA.LE} · Verde LD = ${vV.LD === zagLd ? 'o ZAG da direita' : vV.LD}`,
    'o LE · o ZAG da direita', vA.LE === leA && vV.LD === zagLd);
  const n90 = TT.nivelDoOverall(90), n60 = TT.nivelDoOverall(60), n74 = TT.nivelDoOverall(74);
  reg('P2 nível comprimido (overall 90, 74, 60)', `${n90}, ${n74}, ${n60}`, '82, 74, 67', n90 === 82 && n74 === 74 && n60 === 67);
  let pior = 0;
  for (const el of [...TA.elencos, ...TC.elencos]) for (const j of el.jogadores) pior = Math.max(pior, Math.abs(E.notaNaPosicao(j.attr, j.pos) - j.nivel));
  reg('P2 nota na posição = nível ± 1 (72 jogadores)', `pior ${pior}`, '≤ 1', pior <= 1);
  const j0 = TA.elencos[0].jogadores[9];
  const c1 = E.atributosDe(j0); c1.velocidade = -1;
  const c2 = E.atributosDe(j0);
  reg('P2 atributosDe da ficha com attr: cópia (mexer nela não muda a ficha)', `${c2.velocidade === j0.attr.velocidade && c2.velocidade !== -1 ? 'cópia' : 'mesma referência'}`, 'cópia', c2.velocidade === j0.attr.velocidade && c2.velocidade !== -1);
  // registrar de novo o mesmo id substitui (as fichas antigas saem)
  E.registrarElenco({ ...TA.elencos[0], jogadores: TA.elencos[0].jogadores.slice(0, 5) });
  const sumiu = E.fichaDe(1010) == null && E.fichaDe(1003) != null && E.ELENCOS.tmcasa.jogadores.length === 5;
  E.registrarElenco(TA.elencos[0]);
  reg('P2 registrar de novo o mesmo elenco substitui', sumiu && E.fichaDe(1010) ? 'substituiu' : 'não substituiu', 'substituiu', sumiu && !!E.fichaDe(1010));
}

// ------------------------------------------------------------------ P3 humano no visitante (B sem a trava)
function registrar(T) { for (const el of T.elencos) E.registrarElenco(el); }
function partidaDo(T, opc = {}) {
  registrar(T);
  return P.criarPartida({ semente: opc.semente ?? 3, minutosPorTempo: opc.min ?? MIN, elencos: TT.ELENCOS_TM, times: T.times, humano: T.humano, trava: opc.semTrava ? null : T.trava });
}
{
  const m = partidaDo(TB, { semTrava: true });
  const c1 = m.controlado[1], c0 = m.controlado[0];
  const jc = SIM.jogadorPorId(m, c1);
  // a entrada da pessoa vai para o controlado do time 1: depois da saída, o analógico para +z move ele para +z
  let i = 0;
  while (m.partida.estado !== 'jogo' && i++ < 600) P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
  const id1 = m.controlado[1], j1 = SIM.jogadorPorId(m, id1), z0 = j1.z;
  for (let k = 0; k < 60; k++) P.passoPartida(m, { x: 0, z: 1, botoes: 0 });
  const andou = SIM.jogadorPorId(m, id1).z - z0;
  const demo = P.entradaDemoPartida(m);
  reg('P3 humano no visitante: timeHumano 1, humanos [1], controlado do time 1', `timeHumano ${m.timeHumano} · humanos [${m.humanos}] · controlado[1] ${c1} (time ${jc?.time}) · controlado[0] ${c0 ?? 'nenhum'}`,
    '1 · [1] · do time 1 · nenhum', m.timeHumano === 1 && m.humanos.join() === '1' && jc?.time === 1 && c0 == null);
  reg('P3 a entrada da pessoa move o controlado do time 1; a demo joga por ele', `${andou.toFixed(1).replace('.', ',')} m para +z em 1 s · demo ${demo.ia ? 'ia' : demo.iaCobra ? 'cobra' : 'neutra'}`,
    '> 2 m · ia', andou > 2 && !!(demo.ia || demo.iaCobra));
}

// ------------------------------------------------------------------ P4 trava (B: humano 1, travado do banco; C: humano 0)
const res = [];
function partidaInteira(T, opc) {
  const m = partidaDo(T, opc);
  const s = SU.criarSumula();
  let soltou = 0, passos = 0, sem = 99;
  const r = () => { sem ^= sem << 13; sem >>>= 0; sem ^= sem >>> 17; sem ^= sem << 5; sem >>>= 0; return sem / 4294967296; };
  const B = C.BOTAO;
  while (m.partida.estado !== 'fim' && passos < 200000) {
    let e = P.entradaDemoPartida(m);
    // "humano" apertando TROCAR/GOLEIRO o tempo todo (sem a marca `ia`: são os botões da pessoa)
    if (opc.apertos) e = { x: e.x, z: e.z, botoes: (e.botoes | (r() < 0.3 ? B.TROCAR : 0) | (r() < 0.1 ? B.GOLEIRO : 0)) };
    const ev = P.passoPartida(m, e);
    SU.sumulaPasso(s, m, ev);
    passos++;
    if (m.trava) {
      const h = m.timeHumano, tv = m.trava[h];
      if (m.controlado[h] !== tv && !m.partida.expulsos.includes(tv)) soltou++;
    }
  }
  return { m, s, soltou, passos, r: SU.resultadoTM(s, m, T.mapa), T };
}
{
  const tvB = TB.trava, fB = TB.elencos[1].jogadores.find(j => j.id === tvB);
  reg('P4 B: o travado do banco vira titular (no lugar do CA) e o humano é o visitante',
    `trava ${tvB} (${fB?.tmId}, ${fB?.pos}) em campo: ${Object.values(TB.times[1].vagas).includes(tvB)} · humano ${TB.humano}`,
    `${VERDE.players[17].tmId}, em campo, 1`, fB?.tmId === VERDE.players[17].tmId && Object.values(TB.times[1].vagas).includes(tvB) && TB.humano === 1);
  for (const [nome, T, sem] of [['B', TB, 5], ['C', TC, 9]]) {
    const x = partidaInteira(T, { semente: sem, apertos: true, min: 2 * MIN });
    res.push([nome, x]);
    const ini = x.m.trava?.[x.m.timeHumano];
    reg(`P4 ${nome}: a trava nunca solta (partida inteira com TROCAR/GOLEIRO apertados)`, `${x.passos} passos · trocas ${x.soltou} · travado ${ini === T.trava ? 'o do pedido' : ini}`,
      '0 trocas · o do pedido', x.soltou === 0 && ini === T.trava && x.m.partida.estado === 'fim');
  }
  // a substituição do travado é recusada
  const m = partidaDo(TC, { semente: 2 });
  const t = m.timesHumano ?? m.timeHumano, s = m.times[t], tv = m.trava[t];
  const res0 = s.saiu.length;
  const entra = TC.elencos[t].jogadores[16].id;
  const vagas = { ...s.vagas };
  for (const k in vagas) if (vagas[k] === tv) vagas[k] = entra;
  const ev = P.passoPartida(m, { x: 0, z: 0, botoes: 0 }, [{ tipo: 'editarTime', time: t, base: s.versao, formacao: s.formacao, vagas, substituicoes: [{ sai: tv, entra }], tatica: { ...s.tatica } }]);
  const rec = ev.find(e => e.tipo === 'edicaoRecusada');
  reg('P4 a substituição do travado é recusada', rec ? `recusada (código ${rec.codigo}: ${rec.motivo})` : 'aceita', 'recusada (código 4)', !!rec && rec.codigo === 4 && m.times[t].saiu.length === res0);
}

// ------------------------------------------------------------------ P4b travado expulso (a falta montada como a do
// __golaco.faltaDeTeste: o travado faz a falta, vermelho direto)
{
  const F = await imp('faltas.js');
  const m = partidaDo(TC, { semente: 6 });
  const h = m.timeHumano, tv = m.trava[h];
  for (let i = 0; i < 400; i++) P.passoPartida(m, P.entradaDemoPartida(m));
  const c = SIM.jogadorPorId(m, tv);
  let d = null, dm = Infinity;
  for (const o of m.jogadores) { if (o.time === h || o.posicao === 'GOL') continue; const q = Math.hypot(o.x - c.x, o.z - c.z); if (q < dm) { dm = q; d = o; } }
  const lado = m.ataca[d.time];
  P.teleportar(c, d.x - lado * 1.1, d.z + 0.3, lado > 0 ? 0 : Math.PI);
  m.bola.p.x = d.x + lado * 0.4; m.bola.p.z = d.z; m.bola.p.y = C.BOLA.raio;
  m.posse = d.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
  const f = F.montarFalta(m, c, d, 'bote', true);
  f.cartao = 'vermelho'; f.motivo = 'forcaExcessiva';
  const s = SU.criarSumula();
  m.eventos = []; m.faltaPendente = f;
  P.regrasPartida(m);
  SU.sumulaPasso(s, m, m.eventos);
  const expulso = m.partida.expulsos.includes(tv) && !m.jogadores.some(j => j.id === tv);
  let erro = null, controlados = 0;
  try {
    for (let i = 0; i < 1200 && m.partida.estado !== 'fim'; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      SU.sumulaPasso(s, m, ev);
      controlados += m.jogadores.filter(j => SIM.ehControlado(m, j)).length;
    }
  } catch (e) { erro = e.message; }
  const r = SU.resultadoTM(s, m, TC.mapa);
  const verm = r.cartoes.filter(q => q.tmId === TC.mapa[tv].tmId && q.cor === 'red').length;
  reg('P4b travado expulso: sai do campo, ninguém mais é controlado (o time joga com a IA), a partida segue, súmula com o vermelho e a nota',
    `${expulso ? 'expulso' : 'NÃO expulso'} · controlado[${h}] ${m.controlado[h] === tv ? 'ainda o travado (fora do campo)' : m.controlado[h]} · ${controlados} passos com alguém controlado · ${erro ? 'ERRO ' + erro : '1200 passos sem erro'} · vermelhos dele ${verm} · nota ${r.jogador?.nota}`,
    'expulso · 0 · sem erro · 1 · nota', expulso && m.controlado[h] === tv && controlados === 0 && !erro && verm === 1 && r.jogador && r.jogador.nota >= 4.5 && r.jogador.nota <= 10);
}

// ------------------------------------------------------------------ P5 resultado de partidas inteiras
{
  const x = partidaInteira(TA, { semente: +arg('--sem-a', 2), min: 4 * MIN });
  res.unshift(['A', x]);
  for (const [nome, { m, r, T }] of res) {
    const erros = [];
    const chaves = ['homeGoals', 'awayGoals', 'gols', 'cartoes', 'stats'];
    for (const k of chaves) if (!(k in r)) erros.push(`sem ${k}`);
    const pl = [m.placar[0], m.placar[1]];
    if (r.homeGoals !== pl[0] || r.awayGoals !== pl[1]) erros.push('placar ≠ mundo');
    for (const l of [0, 1]) if (r.gols.filter(g => g.lado === l).length !== pl[l]) erros.push(`gols do lado ${l} ≠ placar`);
    const st = r.stats;
    if (st.possession[0] + st.possession[1] !== 100) erros.push('posse ≠ 100');
    for (const l of [0, 1]) {
      const g = r.gols.filter(q => q.lado === l && !q.contra).length;
      if (!(st.shots[l] >= st.onTarget[l] && st.onTarget[l] >= g)) erros.push(`chutes/no alvo/gols do lado ${l}`);
    }
    const ladoDo = tmId => { for (const id in T.mapa) if (T.mapa[id].tmId === tmId) return T.mapa[id].lado; return null; };
    for (const g of r.gols) {
      if (!Number.isInteger(g.minuto) || g.minuto < 1 || g.minuto > 90) erros.push(`minuto ${g.minuto}`);
      const la = ladoDo(g.tmId);
      if (g.contra ? la !== 1 - g.lado : la !== g.lado) erros.push(`autor do lado errado (${g.tmId})`);
      if (g.assist && ladoDo(g.assist.tmId) !== g.lado) erros.push('assistência de outro time');
      if (typeof g.penalti !== 'boolean' || typeof g.contra !== 'boolean') erros.push('penalti/contra');
    }
    for (const c of r.cartoes) {
      if (c.cor !== 'yellow' && c.cor !== 'red') erros.push(`cor ${c.cor}`);
      if (ladoDo(c.tmId) !== c.lado) erros.push('cartão do lado errado');
      if (!Number.isInteger(c.minuto) || c.minuto < 1 || c.minuto > 90) erros.push(`minuto do cartão ${c.minuto}`);
    }
    const temTrava = T.trava != null;
    if (temTrava !== !!r.jogador) erros.push(temTrava ? 'sem jogador' : 'jogador sem trava');
    if (r.jogador) {
      const pj = temTrava ? T.mapa[T.trava].tmId : null;
      if (r.jogador.tmId !== pj) erros.push('jogador.tmId');
      if (!(r.jogador.nota >= 4.5 && r.jogador.nota <= 10)) erros.push(`nota ${r.jogador.nota}`);
      for (const k of ['gols', 'assist', 'toques', 'passes']) if (!Number.isInteger(r.jogador[k])) erros.push(`jogador.${k}`);
    }
    reg(`P5 ${nome}: resultado no formato do contrato`,
      `${pl[0]} × ${pl[1]} · ${r.gols.length} gols (${r.gols.filter(g => g.assist).length} assist.) · ${r.cartoes.length} cartões · posse ${st.possession.join('/')} · chutes ${st.shots.join('/')} · no alvo ${st.onTarget.join('/')}${r.jogador ? ` · nota ${String(r.jogador.nota).replace('.', ',')}` : ''}${erros.length ? ' · ' + [...new Set(erros)].join('; ') : ''}`,
      'coerente', erros.length === 0);
  }
}

// ------------------------------------------------------------------ P6 súmula com eventos montados
{
  const T = TA;
  registrar(T);
  const js = [];
  for (const t of [0, 1]) for (const id of Object.values(T.times[t].vagas)) js.push({ id, time: t, posicao: id === T.times[t].vagas.GOL ? 'GOL' : 'MEI' });
  const m = {
    tick: 0, jogadores: js, expulsos: [], voo: null, posse: null, naMao: null, parada: null, foraDesde: null, golTick: null,
    placar: { 0: 0, 1: 0 }, timeHumano: 0, partida: { estado: 'parada', tempo: 1, tick0Tempo: 0, ticksPorTempo: 14400 },
  };
  const s = SU.criarSumula();
  const passo = (tick, evs) => { m.tick = tick; for (const e of evs) if (e.tipo === 'gol') m.placar[e.time]++; SU.sumulaPasso(s, m, evs); };
  const v0 = T.times[0].vagas, v1 = T.times[1].vagas;
  const A1 = v0.MCE, A2 = v0.ATA, A3 = v0.MCD, A4 = v0.PE, B1 = v1.ZE, B2 = v1.ATA, B3 = v1.VOLE;
  const posse0 = SU.posseEmPct(s).join('/');
  // 1) assistência: A1 passa, A2 domina e chuta, gol
  passo(100, [{ tipo: 'passe', id: A1, modo: 'rasteiro' }]);
  passo(130, [{ tipo: 'toque', id: A2, modo: 'dominio' }]);
  passo(150, [{ tipo: 'chute', id: A2 }]);
  passo(170, [{ tipo: 'gol', time: 0, autor: A2 }]);
  // 2) gol contra: o zagueiro do time 1 toca por último, gol para o time 0
  passo(400, [{ tipo: 'toque', id: B1 }]);
  passo(410, [{ tipo: 'gol', time: 0, autor: B1 }]);
  // 3) pênalti do time 1 (o 'penalti' no mesmo passo do gol)
  passo(700, [{ tipo: 'cobranca', parada: 'penalti', id: B2 }, { tipo: 'chute', id: B2 }]);
  passo(720, [{ tipo: 'penalti', time: 1, id: B2, resultado: 'gol' }, { tipo: 'gol', time: 1, autor: B2 }]);
  // 4) chute desviado: A3 passa, A4 chuta, bate no corpo de B3, gol de A4 com a assistência de A3
  passo(900, [{ tipo: 'passe', id: A3, modo: 'rasteiro' }]);
  passo(920, [{ tipo: 'toque', id: A4 }]);
  passo(930, [{ tipo: 'chute', id: A4 }]);
  passo(935, [{ tipo: 'bateuCorpo', id: B3 }]);
  passo(940, [{ tipo: 'gol', time: 0, autor: B3 }]);
  // 5) 2º amarelo no começo do 2º tempo
  passo(1000, [{ tipo: 'cartao', id: B3, time: 1, cor: 'amarelo', motivo: 'imprudente', segundo: false }]);
  m.partida.tempo = 2; m.partida.tick0Tempo = 1100;
  passo(1110, [{ tipo: 'cartao', id: B3, time: 1, cor: 'amarelo', motivo: 'imprudente', segundo: true }, { tipo: 'cartao', id: B3, time: 1, cor: 'vermelho', motivo: 'segundoAmarelo', segundo: true }]);
  const r = SU.resultadoTM(s, m, T.mapa);
  const tm = id => T.mapa[id].tmId;
  const [g1, g2, g3, g4] = r.gols;
  const ok1 = g1 && g1.lado === 0 && g1.tmId === tm(A2) && g1.assist?.tmId === tm(A1) && !g1.contra && !g1.penalti;
  const ok2 = g2 && g2.lado === 0 && g2.tmId === tm(B1) && g2.contra && g2.assist === null;
  const ok3 = g3 && g3.lado === 1 && g3.tmId === tm(B2) && g3.penalti && !g3.contra;
  const ok4 = g4 && g4.lado === 0 && g4.tmId === tm(A4) && !g4.contra && g4.assist?.tmId === tm(A3);
  const cs = r.cartoes.map(c => `${c.cor}@${c.minuto}`).join(' ');
  const ok5 = cs === 'yellow@3 yellow@46 red@46' && r.cartoes.every(c => c.tmId === tm(B3) && c.lado === 1);
  reg('P6 assistência (passe que chegou → gol)', ok1 ? 'ok' : JSON.stringify(g1), 'autor A2, assist A1', !!ok1);
  reg('P6 gol contra: lado = beneficiado, autor do outro time, sem assistência', ok2 ? 'ok' : JSON.stringify(g2), 'lado 0, autor B1, contra', !!ok2);
  reg('P6 pênalti pelo evento do mesmo passo', ok3 ? 'ok' : JSON.stringify(g3), 'lado 1, pênalti', !!ok3);
  reg('P6 chute desviado: o gol é de quem chutou, com a assistência', ok4 ? 'ok' : JSON.stringify(g4), 'autor A4, assist A3', !!ok4);
  reg('P6 2º amarelo = amarelo + vermelho; minuto 46 no começo do 2º tempo', cs, 'yellow@3 yellow@46 red@46', ok5);
  const st = r.stats;
  reg('P6 placar, chutes e no alvo coerentes; posse 50/50 sem bola rolando', `${r.homeGoals} × ${r.awayGoals} · chutes ${st.shots.join('/')} · no alvo ${st.onTarget.join('/')} · posse ${posse0}`,
    '3 × 1 · 2/1 · 2/1 · 50/50', r.homeGoals === 3 && r.awayGoals === 1 && st.shots.join() === '2,1' && st.onTarget.join() === '2,1' && posse0 === '50/50');
}

linhas.push(['tempo', `${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`, '< 60 s', '']);
// ------------------------------------------------------------------ P7 as estatísticas das cenas (escanteios, faltas, porTempo)
// (PLANO-CENAS.md §4.2, R17) contadores INDEPENDENTES contra a súmula numa partida inteira IA × IA: o escanteio pela troca do
// OBJETO m.parada (nova, de tipo 'escanteio', para o time de quem cobra) e as faltas cometidas pelo lado do `def` no mapa do
// TM; o porTempo aparece no apito do 1º tempo com os números até ali; o resultadoTM continua só com as chaves de antes.
if (typeof SU.estatisticas === 'function') {
  const m = partidaDo(TA, { semente: +arg('--sem-p7', 5), min: Math.max(4, 4 * MIN) });
  const s = SU.criarSumula();
  const esc = [0, 0], fal = [0, 0];
  let prAnt = null, escNoApito = null, passos = 0;
  while (m.partida.estado !== 'fim' && passos < 200000) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    SU.sumulaPasso(s, m, ev);
    passos++;
    const pr = m.parada;
    if (pr && pr !== prAnt && pr.tipo === 'escanteio' && (pr.time === 0 || pr.time === 1)) esc[pr.time]++;
    prAnt = pr;
    for (const e of ev) if (e.tipo === 'falta' && e.def != null && TA.mapa[e.def]) fal[TA.mapa[e.def].lado]++;
    if (ev.some(e => e.tipo === 'intervalo')) escNoApito = [...esc];
  }
  const pt = s.porTempo?.[1];
  const r = SU.resultadoTM(s, m, TA.mapa);
  // (o pós-jogo, PR 4: o campo OPCIONAL `melhor` — conferido no P8; o resto com as chaves de antes)
  const chaves = Object.keys(r).filter(k => k !== 'jogador' && k !== 'melhor').sort().join(',');
  const chavesSt = Object.keys(r.stats).sort().join(',');
  reg('P7 escanteios e faltas por time = contadores independentes (partida inteira)',
    `escanteios ${s.escanteios.join('/')} × ${esc.join('/')} · faltas ${s.faltas.join('/')} × ${fal.join('/')}`, 'iguais',
    s.escanteios[0] === esc[0] && s.escanteios[1] === esc[1] && s.faltas[0] === fal[0] && s.faltas[1] === fal[1] && esc[0] + esc[1] + fal[0] + fal[1] > 0);
  reg('P7 porTempo no apito do 1º tempo (os escanteios até ali)', pt ? `escanteios ${pt.escanteios?.join('/')} × ${escNoApito?.join('/')}` : 'sem porTempo',
    'iguais', !!pt && !!escNoApito && pt.escanteios?.[0] === escNoApito[0] && pt.escanteios?.[1] === escNoApito[1]);
  reg('P7 o resultadoTM com as chaves de antes (além do `melhor` opcional do P8)', `${chaves} · stats ${chavesSt}`, 'awayGoals,cartoes,gols,homeGoals,stats · stats onTarget,possession,shots',
    chaves === 'awayGoals,cartoes,gols,homeGoals,stats' && chavesSt === 'onTarget,possession,shots');
} else reg('P7 as estatísticas das cenas na súmula', 'sumula.js sem estatisticas (versão de antes)', 'existe', false);
// P7b o chute ainda aberto no apito do 1º tempo fica no 1º tempo: o apito o fecha (no alvo se o goleiro já tocou) ANTES da
// cópia do porTempo — antes ele fechava no 2º tempo pela JANELA_CHUTE e o "No alvo" dele saía do painel do intervalo e
// contava no 2º tempo. Procura a 1ª semente (a partir de --sem-p7b, 123) com um chute aberto no passo do apito.
if (typeof SU.estatisticas === 'function') {
  let achou = null;
  // (até 120 sementes, D5: o chute no ar no passo do apito é raro — na partida do D5 nenhuma das 24 primeiras tinha; a busca
  // para na 1ª que tiver)
  for (let k = 0; k < 120 && !achou; k++) {
    const sem = +arg('--sem-p7b', 123) + k;
    const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
    const s = SU.criarSumula();
    let passos = 0;
    while (m.partida.tempo === 1 && m.partida.estado !== 'fim' && passos < 60000) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      passos++;
      const apito = ev.some(e => e.tipo === 'intervalo');
      const aberto = apito && s.aberto ? { ...s.aberto } : null, alvoAntes = [...s.noAlvo];
      SU.sumulaPasso(s, m, ev);
      if (!apito) continue;
      if (aberto) achou = { sem, aberto, alvoAntes, depois: s.aberto, t1: SU.estatisticas(s, 1).noAlvo };
      break;
    }
  }
  const a = achou;
  const esperado = a ? a.alvoAntes.map((v, t) => v + (t === a.aberto.time && a.aberto.defendido != null ? 1 : 0)) : null;
  reg('P7b o chute aberto no apito do 1º tempo fecha no apito (o "No alvo" dele no painel do intervalo)',
    a ? `semente ${a.sem}: chute do time ${a.aberto.time} (tick ${a.aberto.tick}, goleiro ${a.aberto.defendido ?? '-'}); depois do apito ${a.depois ? 'AINDA ABERTO' : 'fechado'}; no alvo 1º T ${a.t1.join('/')} × ${esperado.join('/')}` : 'nenhuma semente com chute aberto no apito',
    'fechado; iguais', !!a && !a.depois && a.t1[0] === esperado[0] && a.t1[1] === esperado[1]);
}

// ------------------------------------------------------------------ P8 o melhor em campo no resultado (o pós-jogo, PR 4)
// (PLANO-CENAS.md §5.2, R18) o resultadoTM ganha SÓ o campo opcional `melhor: {lado, tmId, nome, nota}`: o de maior nota entre
// quem jogou (os de agora e os substituídos, sem os expulsos) — conferido contra um argmax INDEPENDENTE (a nota de cada um
// pela fórmula do notaDoJogador, escrita de novo aqui) —, o tmId e o nome do mapa do TM, e a nota pela MESMA conta do
// `jogador` (com o travado melhor em campo, as duas notas iguais). O resto do resultado igual campo a campo ao de antes (o
// resultado sem o `melhor` = o de uma súmula idêntica sem a função nova).
if (typeof SU.melhorEmCampo === 'function') {
  const zero = { toques: 0, passes: 0, passesCertos: 0, chutes: 0, noAlvo: 0, gols: 0, assist: 0, roubadas: 0, desarmes: 0, perdas: 0, defesas: 0, faltas: 0, amarelos: 0, vermelhos: 0, contra: 0 };
  const nota = (n, pos, sof, sal) => {
    const e = Math.max(0, n.passes - n.passesCertos);
    let v = 6 + n.gols + 0.6 * n.assist + 0.15 * Math.max(0, n.noAlvo - n.gols) - 0.05 * Math.max(0, n.chutes - n.noAlvo)
      + Math.min(0.6, 0.025 * n.passesCertos) - 0.08 * e + Math.min(0.6, 0.12 * (n.roubadas + n.desarmes)) - 0.12 * n.perdas
      + 0.3 * n.defesas - 0.3 * n.amarelos - 1.5 * n.vermelhos - 0.1 * n.faltas - 0.8 * n.contra;
    if (pos === 'GOL') v -= 0.3 * sof; else if (pos === 'ZAG' || pos === 'LAT') v -= 0.15 * sof;
    if (sal > 0) v += 0.3; else if (sal < 0) v -= 0.3;
    return Math.round(Math.min(10, Math.max(4.5, v)) * 10) / 10;
  };
  const indep = (s, m) => {
    const exp = new Set((m.expulsos ?? []).map(j => j.id)), lista = [];
    for (const j of m.jogadores) if (!exp.has(j.id)) lista.push({ id: j.id, time: j.time, pos: j.posicao });
    for (const t of [0, 1]) for (const id of m.times[t].saiu) if (!exp.has(id) && !lista.some(q => q.id === id)) lista.push({ id, time: t, pos: null });
    let b = null;
    for (const q of lista) {
      const n = s.jog[q.id] ?? zero, x = { id: q.id, time: q.time, nota: nota(n, q.pos, m.placar[1 - q.time], m.placar[q.time] - m.placar[1 - q.time]), gols: n.gols, assist: n.assist };
      if (!b || x.nota > b.nota || (x.nota === b.nota && (x.gols > b.gols || (x.gols === b.gols && (x.assist > b.assist || (x.assist === b.assist && x.id < b.id)))))) b = x;
    }
    return b;
  };
  const casos = [];
  // (--base: a súmula da versão de antes lida nos MESMOS passos — o resto do resultado comparado campo a campo com ela)
  const BASE = arg('--base', null);
  const SB = BASE ? await import(pathToFileURL(path.join(path.resolve(BASE), 'sumula.js')).href) : null;
  // 3 partidas IA × IA do pedido A (o mapa do TM)
  for (const [ped, sem] of [[TA, 21], [TA, 22], [TA, 23]]) {
    const m = partidaDo(ped, { semente: sem, min: Math.max(1, MIN) });
    const s = SU.criarSumula(), sb = SB ? SB.criarSumula() : null;
    let n = 0;
    while (m.partida.estado !== 'fim' && n < 200000) { const ev = P.passoPartida(m, P.entradaDemoPartida(m)); SU.sumulaPasso(s, m, ev); if (sb) SB.sumulaPasso(sb, m, ev); n++; }
    casos.push({ m, s, sb, mapa: ped.mapa });
  }
  let ok = 0, okNota = 0, okMapa = 0, okResto = 0;
  const ex = [];
  for (const { m, s, sb, mapa } of casos) {
    const r = SU.resultadoTM(s, m, mapa), b = indep(s, m), mc = SU.melhorEmCampo(s, m);
    const certo = r.melhor && b && r.melhor.lado === b.time && r.melhor.nota === b.nota && mc.id === b.id;
    if (certo) ok++; else ex.push(`${JSON.stringify(r.melhor)} × ${JSON.stringify(b)}`);
    if (r.melhor && r.melhor.nota === SU.notaDe(s, m, mc.id, mc.time)) okNota++;
    if (r.melhor && mapa[mc.id] && r.melhor.tmId === mapa[mc.id].tmId && r.melhor.nome === mapa[mc.id].nome) okMapa++;
    // o resto: o resultado sem o `melhor` = o mesmo objeto montado de novo campo a campo (nenhum campo de antes mudou)
    const { melhor, ...resto } = r;
    const r2 = sb ? SB.resultadoTM(sb, m, mapa) : SU.resultadoTM(structuredClone(s), m, mapa);
    delete r2.melhor;
    if (JSON.stringify(resto) === JSON.stringify(r2) && Object.keys(resto).filter(k => k !== 'jogador').sort().join(',') === 'awayGoals,cartoes,gols,homeGoals,stats') okResto++;
    void melhor;
  }
  reg('P8 resultadoTM.melhor = o argmax independente (quem jogou, sem expulsos; desempate gols → assistências → menor id)', `${ok}/${casos.length}${ex.length ? ` (ex.: ${ex[0]})` : ''}`, `todos (${casos.length})`, ok === casos.length);
  reg('P8 a nota do melhor = notaDe (a conta do `jogador`); tmId e nome do mapa do TM', `nota ${okNota}/${casos.length} · mapa ${okMapa}/${casos.length}`, 'todos · todos', okNota === casos.length && okMapa === casos.length);
  reg(`P8 o resto do resultado igual (as chaves de antes, campo a campo${SB ? ' com a versão de antes: --base' : ''})`, `${okResto}/${casos.length}`, 'todos', okResto === casos.length);
  // o travado melhor em campo: as duas notas iguais (a da tarja = a do TM)
  {
    const m = partidaDo(TB, { semente: 31, min: Math.max(1, MIN) });
    const s = SU.criarSumula();
    let n = 0;
    while (m.partida.estado !== 'fim' && n < 200000) { const ev = P.passoPartida(m, P.entradaDemoPartida(m)); SU.sumulaPasso(s, m, ev); n++; }
    const h = m.timeHumano ?? 0, tv = m.trava?.[h];
    // (força o travado a ser o melhor: muitos gols na súmula dele — só a súmula do teste)
    const nt = s.jog[tv] ?? (s.jog[tv] = { ...zero });
    nt.gols += 5;
    const r = SU.resultadoTM(s, m, TB.mapa);
    reg('P8 o travado melhor em campo: melhor.nota = jogador.nota (a tarja = o TM)', `travado ${tv} · melhor ${JSON.stringify(r.melhor)} · jogador.nota ${r.jogador?.nota}`, 'o travado; notas iguais',
      !!r.melhor && !!r.jogador && r.melhor.tmId === r.jogador.tmId && r.melhor.nota === r.jogador.nota);
  }
} else reg('P8 o melhor em campo no resultado (o pós-jogo)', 'sumula.js sem melhorEmCampo (versão de antes)', 'existe', false);

fim();
