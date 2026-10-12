// teste-impedimento (Etapa 4): impedimento pela IFAB Regra 11 e acréscimos pela Regra 7.3.
//
// Metas:
//  A. Cenas montadas (impedimento.js regraImpedimento, a regra pura): posição de impedimento na jogada do
//     companheiro e infração quando o impedido toca a bola; NÃO é impedimento: na mesma linha (tolerância),
//     atrás da bola, no próprio campo, recebendo direto de lateral, escanteio ou tiro de meta; É impedimento no
//     rebote de uma DEFESA do goleiro e no desvio no corpo de um adversário; a jogada deliberada do adversário
//     (domínio) zera; o impedido que não toca a bola não é marcado (o companheiro em condição recebe).
//  B. Recomeço: o impedimento vira tiro livre INDIRETO do outro time no ponto do toque; os adversários ficam a
//     ≥ 9,15 m até a cobrança (com 0,3 m de folga para o corpo), a cobrança sai em ≤ 8 s e é um passe (nunca um
//     chute a gol).
//  C. Partidas inteiras IA × IA (6 sementes): um ÁRBITRO INDEPENDENTE, escrito aqui sem usar impedimento.js
//     (foto em cada passe/chute e enquanto alguém tem a bola; infração no toque), marca exatamente os mesmos
//     impedimentos que o jogo (mesmo tick e mesmo jogador); ≥ 1 impedimento na amostra.
//  D. Acréscimos: anunciados no fim do tempo regulamentar (1º tempo 1–5 min, 2º tempo 3–10 min), o tempo acaba
//     exatamente depois deles, o placar fica em 45/90 com "+N" (acrescimoDeJogo) e a mesma semente dá os mesmos
//     acréscimos.
//
//   node tools/teste-impedimento.mjs              (lógica do repositório)
//   node tools/teste-impedimento.mjs --js <pasta> (outra cópia da lógica; a publicada antes da Etapa 4 → REPROVA)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-impedimento: REPROVOU (${falhas})` : '\nteste-impedimento: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'impedimento.js')) || !fs.existsSync(path.join(JS, 'partida.js'))) {
  reg('a regra do impedimento existe (impedimento.js)', 'não existe nesta lógica', 'impedimento.js', false);
  fim();
}
const P = await imp('partida.js');
const I = await imp('impedimento.js');
const { PARTIDA, CAMPO } = await imp('config.js');
const PASSO = 1 / 60;

// ------------------------------------------------------------------ A. cenas montadas
// O time 0 ataca para +x. Defesa (time 1): goleiro em 50, o penúltimo em `linha`, o resto atrás dele (x menor).
// Ataque (time 0): o passador P, o atacante A, o companheiro B; o resto no próprio campo.
function cena({ linha = 30, p = 10, a = 35, b = 25, bola = null, adv = null } = {}) {
  const m = P.criarPartida({ semente: 1 });
  m.partida.estado = 'jogo'; m.parada = null; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
  const t0 = m.jogadores.filter(j => j.time === 0), t1 = m.jogadores.filter(j => j.time === 1);
  const gk1 = t1.find(j => j.posicao === 'GOL'), def = t1.filter(j => j !== gk1);
  const tp = (j, x, z) => P.teleportar(j, x, z, j.time === 0 ? 0 : Math.PI);
  tp(gk1, 50, 0);
  def.forEach((j, k) => tp(j, k === 0 ? linha : linha - 4 - k, -20 + k * 4));
  if (adv) adv(def);
  const linhaT0 = t0.filter(j => j.posicao !== 'GOL');
  const [JP, JA, JB, ...resto] = linhaT0;
  tp(JP, p, 0); tp(JA, a, 5); tp(JB, b, -5);
  resto.forEach((j, k) => tp(j, -20 - k, -15 + k * 3));
  tp(t0.find(j => j.posicao === 'GOL'), -50, 0);
  m.bola.p.x = bola ?? p; m.bola.p.z = 0;
  m.posse = JP.id; m.eventos = [];
  m.partida.imped = null;
  return { m, P: JP, A: JA, B: JB, D: def[0], G: gk1 };
}
/** Passo da regra pura com estes eventos e este dono. */
function regra(m, eventos, dono) {
  m.eventos = eventos; m.posse = dono ?? null; m.naMao = null;
  return I.regraImpedimento(m);
}
const casos = [];
const caso = (nome, ok, det = '') => casos.push({ nome, ok, det });
{ // impedido na jogada e infração no toque
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  const ids = c.m.partida.imped?.ids ?? [];
  caso('A em impedimento na jogada (35 m × linha 30)', ids.includes(c.A.id) && !ids.includes(c.B.id), `ids ${ids}`);
  const off = regra(c.m, [], c.A.id);
  caso('o impedido toca a bola → infração', off && off.id === c.A.id && off.time === 0, JSON.stringify(off));
}
{ // na mesma linha
  const c = cena({ a: 30.05 });
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  caso('na mesma linha (+5 cm) não é impedimento', !(c.m.partida.imped?.ids ?? []).includes(c.A.id));
}
{ // atrás da bola
  const c = cena({ p: 36, a: 35, bola: 36 });
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  caso('atrás da bola não é impedimento', !(c.m.partida.imped?.ids ?? []).includes(c.A.id));
}
{ // no próprio campo (a defesa adiantada no campo do atacante)
  const c = cena({ linha: -10, p: -20, a: -5, b: -25, bola: -20 });
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  caso('no próprio campo não é impedimento', !(c.m.partida.imped?.ids ?? []).includes(c.A.id));
}
for (const tipo of ['lateral', 'escanteio', 'tiroDeMeta']) {
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }, { tipo: 'cobranca', parada: tipo, id: c.P.id }], null);
  const off = regra(c.m, [], c.A.id);
  caso(`recebendo direto de ${tipo} não é impedimento`, !off);
}
{ // rebote da defesa do goleiro
  const c = cena();
  regra(c.m, [{ tipo: 'chute', id: c.P.id }], null);
  regra(c.m, [{ tipo: 'defesa', id: c.G.id, modo: 'espalmada' }], null);
  const off = regra(c.m, [], c.A.id);
  caso('rebote da defesa do goleiro → impedimento', off && off.id === c.A.id);
}
{ // desvio no corpo do adversário
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  regra(c.m, [{ tipo: 'bateuCorpo', id: c.D.id }], null);
  const off = regra(c.m, [], c.A.id);
  caso('desvio no corpo do adversário → impedimento', off && off.id === c.A.id);
}
{ // jogada deliberada do adversário zera
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  regra(c.m, [], c.D.id);              // o zagueiro domina
  regra(c.m, [{ tipo: 'passe', id: c.D.id }], null); // e erra o passe
  const off = regra(c.m, [], c.A.id);
  caso('jogada deliberada do adversário zera o impedimento', !off);
}
{ // impedido que não toca: o companheiro em condição recebe
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  const off = regra(c.m, [], c.B.id);
  caso('o impedido não toca, o companheiro em condição recebe → segue', !off);
}
{ // o goleiro conta como adversário: só ele atrás de A → A está impedido (penúltimo = zagueiro em 30)
  const c = cena({ linha: 30, a: 45 });
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  caso('o penúltimo adversário (o goleiro conta) faz a linha', (c.m.partida.imped?.ids ?? []).includes(c.A.id));
}
const okA = casos.filter(c => c.ok).length;
reg('A. cenas montadas da Regra 11', `${okA}/${casos.length}${casos.filter(c => !c.ok).map(c => ` · falhou: ${c.nome} ${c.det}`).join('')}`, 'todas', okA === casos.length);

// ------------------------------------------------------------------ B. recomeço: tiro livre indireto
{
  const c = cena();
  regra(c.m, [{ tipo: 'passe', id: c.P.id }], null);
  c.m.eventos = []; c.m.posse = c.A.id; c.A.x = 36; c.m.bola.p.x = 36.3; c.m.bola.p.z = 5;
  P.regrasPartida(c.m);
  const m = c.m, pr = m.parada;
  const evImp = m.eventos.find(e => e.tipo === 'impedimento');
  const okMarca = !!evImp && pr && pr.tipo === 'tiroLivre' && pr.time === 1 && Math.abs(pr.x - 36.3) < 0.01 && Math.abs(pr.z - 5) < 0.01;
  let cobrou = null, raioMin = Infinity, montado = false, chuteDireto = false, gol = false;
  const t0 = m.tick;
  for (let i = 0; i < 60 * 12 && !cobrou; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    for (const e of ev) {
      if (e.tipo === 'tiroLivre') montado = true;
      if (e.tipo === 'cobranca' && e.parada === 'tiroLivre') cobrou = { tick: m.tick, ev };
      if (e.tipo === 'chute' && !cobrou) chuteDireto = true;
    }
    // a regra vale no toque da cobrança (Regra 13: a 9,15 m até a bola rolar)
    if (cobrou && cobrou.tick === m.tick) {
      for (const j of m.jogadores) if (j.time !== 1) raioMin = Math.min(raioMin, Math.hypot(j.x - 36.3, j.z - 5));
    }
  }
  if (cobrou) {
    for (let i = 0; i < 180; i++) { const ev = P.passoPartida(m, P.entradaDemoPartida(m)); if (ev.some(e => e.tipo === 'gol')) gol = true; }
  }
  const passeNaCobranca = cobrou && cobrou.ev.some(e => e.tipo === 'passe') && !cobrou.ev.some(e => e.tipo === 'chute');
  reg('B. impedimento → tiro livre indireto do outro time no ponto do toque', okMarca ? `tiroLivre do time ${pr.time} em (${pr.x.toFixed(1)}, ${pr.z.toFixed(1)})` : `parada ${pr?.tipo} time ${pr?.time}`, 'tiroLivre do time 1 em (36,3, 5)', okMarca);
  const seg = cobrou ? (cobrou.tick - t0) * PASSO : Infinity;
  reg('B. cobrança: adversários a ≥ 9,15 m, sai em ≤ 8 s, é passe', `montado ${montado ? 'sim' : 'não'} · ${seg.toFixed(1)} s · adversário mais perto ${raioMin.toFixed(2)} m · ${passeNaCobranca ? 'passe' : 'NÃO é passe'}${chuteDireto ? ' · chute direto!' : ''}${gol ? ' · gol direto' : ''}`,
    '≥ 8,85 m, ≤ 8 s, passe', montado && seg <= PARTIDA.paradaMax + 1.0 && raioMin >= 9.15 - 0.3 && passeNaCobranca && !chuteDireto);
}

// ------------------------------------------------------------------ C e D. partidas inteiras com o árbitro independente
const SEMS = [1001, 1002, 1003, 1004, 1005, 1006];
let jogoMarcou = [], arbitroMarcou = [], acrOk = true, fimOk = true, placarOk = true;
const acrs = { 1: [], 2: [] }, detalhe = [];
const SEM_IMPED = new Set(['lateral', 'escanteio', 'tiroDeMeta']);
function penultimo(m, t) {
  const lado = m.ataca[t];
  const us = m.jogadores.filter(o => o.time !== t).map(o => o.x * lado).sort((a, b) => b - a);
  return us[1];
}
for (const sem of SEMS) {
  const m = P.criarPartida({ semente: sem });
  let foto = null; // {time, ids: Set}
  let anunciado = null, t0Tempo = 0, tempoAtual = 1, golTick = null;
  for (let i = 0; i < 2 * 4 * 3600 + 4000; i++) {
    const tempoAntes = m.partida.tempo, t0Antes = m.partida.tick0Tempo;
    const estAntes = m.partida.estado;
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    // árbitro independente (no intervalo e no fim o jogo está parado: nada vale)
    if (estAntes === 'intervalo' || estAntes === 'fim' || m.partida.estado === 'intervalo' || m.partida.estado === 'fim') foto = null;
    const dono = m.naMao ?? m.posse;
    const toques = [];
    if (dono != null) toques.push([dono, 'd']);
    let direto = false, morta = false;
    for (const e of ev) {
      if (e.tipo === 'passe' || e.tipo === 'chute' || e.tipo === 'roubada') toques.push([e.id, 'd']);
      if (e.tipo === 'bateuCorpo') toques.push([e.id, 'c']);
      if (e.tipo === 'defesa') toques.push([e.id, 's']);
      if (e.tipo === 'cobranca' && SEM_IMPED.has(e.parada)) direto = true;
      if (e.tipo === 'fora' || e.tipo === 'gol' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo') morta = true;
      // o jogo marca no MESMO passo do toque e a bola morta já tirou a posse dele: o toque vem do evento (quem
      // tocou); se ele estava impedido quem decide é a foto do árbitro, não a do jogo
      if (e.tipo === 'impedimento') { jogoMarcou.push(`${sem}:${m.tick}:${e.id}`); toques.push([e.id, 'd']); }
    }
    const parado = estAntes === 'intervalo' || estAntes === 'fim' || m.partida.estado === 'intervalo' || m.partida.estado === 'fim';
    if (foto && !parado) {
      const jogador = id => m.jogadores.find(o => o.id === id);
      let marcou = false;
      for (const [id] of toques) if (foto.ids.has(id) && jogador(id)?.time === foto.time) { arbitroMarcou.push(`${sem}:${m.tick}:${id}`); marcou = true; break; }
      if (marcou) { foto = null; continue; }
      if (toques.some(([id, k]) => k === 'd' && jogador(id)?.time !== foto.time)) foto = null;
    }
    if (parado || morta || direto || ev.some(e => e.tipo === 'impedimento')) { foto = null; }
    else {
      const ult = [...toques].reverse().find(([, k]) => k === 'd');
      const parada = m.parada && !m.parada.rolou;
      if (ult && !parada) {
        const j = m.jogadores.find(o => o.id === ult[0]);
        const lado = m.ataca[j.time];
        const lim = Math.max(penultimo(m, j.time), m.bola.p.x * lado, 0);
        foto = { time: j.time, ids: new Set(m.jogadores.filter(o => o.time === j.time && o.id !== j.id && o.x * lado > lim + 0.1).map(o => o.id)) };
      }
    }
    if (m.partida.estado === 'parada' && m.parada && !m.parada.rolou) foto = null;
    // acréscimos
    for (const e of ev) if (e.tipo === 'acrescimo') {
      anunciado = e.minutos; acrs[e.tempo].push(e.minutos);
      if (m.tick - m.partida.tick0Tempo !== m.partida.ticksPorTempo) acrOk = false;
    }
    const a = P.acrescimoDeJogo ? P.acrescimoDeJogo(m) : null;
    if (a && (P.minutoDeJogo(m) !== 45 * m.partida.tempo || a.decorrido > a.anunciado || a.anunciado !== anunciado)) placarOk = false;
    for (const e of ev) if (e.tipo === 'gol') golTick = m.tick;
    if (ev.some(e => e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) {
      const dur = m.tick - t0Antes;
      let esperado = m.partida.ticksPorTempo + Math.round((anunciado ?? 0) * m.partida.ticksPorTempo / 45);
      // gol nos últimos PARTIDA.golPausa s: o tempo acaba depois da pausa do gol (a comemoração não é cortada)
      if (golTick != null && golTick - t0Antes + Math.round(PARTIDA.golPausa * 60) > esperado) esperado = golTick - t0Antes + Math.round(PARTIDA.golPausa * 60);
      if (Math.abs(dur - esperado) > 1) { fimOk = false; detalhe.push(`${sem} t${tempoAntes}: ${dur} × ${esperado}`); }
      anunciado = null;
    }
    if (m.partida.estado === 'fim') break;
  }
}
const so = (a, b) => a.filter(x => !b.includes(x));
const faltouArb = so(jogoMarcou, arbitroMarcou), faltouJogo = so(arbitroMarcou, jogoMarcou);
reg('C. árbitro independente × jogo (6 partidas IA × IA)', `jogo ${jogoMarcou.length} · árbitro ${arbitroMarcou.length} · só o jogo ${faltouArb.length} · só o árbitro ${faltouJogo.length}${faltouArb.length + faltouJogo.length ? ` (${[...faltouArb, ...faltouJogo].slice(0, 4).join(', ')})` : ''}`,
  'iguais, ≥ 1', jogoMarcou.length >= 1 && faltouArb.length === 0 && faltouJogo.length === 0);
const fx = v => v.join('/');
reg('D. acréscimos anunciados no fim do tempo regulamentar', `1º T ${fx(acrs[1])} · 2º T ${fx(acrs[2])} min`, '1º 1–5, 2º 3–10, no tick do fim',
  acrOk && acrs[1].length === SEMS.length && acrs[2].length === SEMS.length && acrs[1].every(v => v >= 1 && v <= 5) && acrs[2].every(v => v >= 3 && v <= 10));
reg('D. o tempo acaba exatamente depois dos acréscimos; placar 45/90 "+N"', `${fimOk ? 'duração certa' : detalhe.join('; ')} · placar ${placarOk ? 'ok' : 'errado'}`, 'certo', fimOk && placarOk);
{
  const um = () => { const m = P.criarPartida({ semente: 1001 }); const v = []; for (let i = 0; i < 4 * 3600 + 600 && v.length < 1; i++) for (const e of P.passoPartida(m, P.entradaDemoPartida(m))) if (e.tipo === 'acrescimo') v.push(e.minutos); return v[0]; };
  const a = um(), b = um();
  reg('D. mesma semente, mesmos acréscimos', `${a} e ${b}`, 'iguais', a === b && a != null);
}
fim();
