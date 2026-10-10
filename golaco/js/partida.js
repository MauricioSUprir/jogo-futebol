// Partida 11×11 (Etapa 3): criação dos dois times pelo elenco e pela formação, relógio com 2
// tempos, saída de bola, gol e bola fora, intervalo com troca de lado, fim, e a edição do time
// como ENTRADA do passo. Puro: sem three.js nem DOM; só MD e m.rng. Plano 1.4.6 e seção 3;
// constantes em config.js PARTIDA.
//
// ESQUELETO MÍNIMO (Parte 0) — a Parte 1 completa: hoje gol OU bola fora → nova saída de bola
// (sai quem sofreu o gol / quem não estava com a bola); lateral, escanteio e tiro de meta
// simplificados, a cobrança da IA com atraso pelo rng e a substituição na parada são da Parte 1.
//
// Estado (só existe na partida; o treino não tem m.times nem m.partida):
//  m.partida = {estado: 'jogo'|'parada'|'gol'|'intervalo'|'fim', tempo: 1|2, tick0Tempo, ticksPorTempo,
//               saidaInicial: 0|1, iaClassica, desde (tick do estado), ultimoTime (time que teve a
//               bola por último), golTime (quem marcou o último gol)}
//  m.parada  = null | {tipo: 'saida'|'lateral'|'escanteio'|'tiroDeMeta', time, x, z, cobrador: id,
//               desde: tick, pronta: tick (fim da montagem), rolou: bool, raio (m dos adversários;
//               'area' = fora da área)}
//  Enquanto m.parada existe e rolou === false, só o cobrador toca a bola (ganchos do sim.js).

import { PARTIDA, PASSO, CAMPO, BOLA, PASSADA, JOGADOR } from './config.js';
import { criarMundo, passo, jogadorPorId, misturarHash } from './sim.js';
import { criarBola } from './bola.js';
import { MD } from './matdet.js';
import { clamp } from './mat.js';
import { fichaDe, atributosDe, FUNCAO } from './elenco.js';
import { FORMACOES } from './formacoes.js';
import { posicaoTatica } from './tatica.js';
import { estadoInicialTime, vestirVaga, aplicarEdicao, aplicarPendentes } from './escalacao.js';
import { entradaIATatica } from './ia-tatica.js';
import { assumirControle } from './acoes.js';

export const ESTADOS = ['jogo', 'parada', 'gol', 'intervalo', 'fim'];
export const TIPOS_PARADA = ['saida', 'lateral', 'escanteio', 'tiroDeMeta'];
const seg = s => Math.round(s / PASSO);

/** Id do cobrador da saída de bola do time (estado m.times[t]): o ATA, senão o SA, senão a vaga mais adiantada. */
export function cobradorDaSaida(timeEstado) {
  const f = FORMACOES[timeEstado.formacao];
  for (const pos of ['ATA', 'SA']) for (const v of f.vagas) if (v.pos === pos) return timeEstado.vagas[v.id];
  let mel = null;
  for (const v of f.vagas) if (v.pos !== 'GOL' && (!mel || v.sem.x > mel.sem.x)) mel = v;
  return timeEstado.vagas[mel.id];
}

/** Vaga (id) em que o jogador `id` está no time. */
export function vagaDoJogador(timeEstado, id) {
  for (const k in timeEstado.vagas) if (timeEstado.vagas[k] === id) return k;
  return null;
}

/**
 * Cria a partida. opc: {semente, minutosPorTempo = PARTIDA.minutosPorTempo, iaClassica = false,
 * elencos = ['golaco', 'ventania'], times?: {0: {formacao, vagas, tatica}, 1: {...}}, saida = 0
 * (quem dá a saída do 1º tempo), log}. O time 0 é o do humano: o controlado começa no cobrador.
 * iaClassica: true só para os testes medirem o "antes" (sim.js usa a IA do treino).
 */
export function criarPartida(opc = {}) {
  const elencos = opc.elencos ?? ['golaco', 'ventania'];
  const saida = opc.saida ?? 0;
  const times = { 0: estadoInicialTime(elencos[0], opc.times?.[0]), 1: estadoInicialTime(elencos[1], opc.times?.[1]) };
  const ataca = { 0: 1, 1: -1 };
  const ctrl0 = cobradorDaSaida(times[0]);
  const desc = [];
  for (const t of [0, 1]) {
    for (const v of FORMACOES[times[t].formacao].vagas) {
      const id = times[t].vagas[v.id];
      desc.push({
        id, x: 0, z: 0, rumo: ataca[t] > 0 ? 0 : Math.PI, attr: atributosDe(fichaDe(id)), time: t,
        papel: t === 0 && id === ctrl0 ? 'humano' : 'ia', posicao: FUNCAO[v.pos],
      });
    }
  }
  const m = criarMundo({ semente: opc.semente ?? 1, jogadores: desc, bola: { x: 0, z: 0 }, posse: null, ataca, log: opc.log, controlado: { 0: ctrl0 } });
  m.modo = 'partida';
  m.times = times;
  for (const j of m.jogadores) { vestirVaga(m, j, vagaDoJogador(times[j.time], j.id)); j.iaT = null; }
  const min = opc.minutosPorTempo ?? PARTIDA.minutosPorTempo;
  m.partida = {
    estado: 'jogo', tempo: 1, tick0Tempo: 0, ticksPorTempo: Math.max(1, Math.round(min * 60 / PASSO)),
    saidaInicial: saida, iaClassica: !!opc.iaClassica, desde: 0, ultimoTime: saida, golTime: null,
  };
  m.parada = null;
  montarSaida(m, saida);
  return m;
}

/** Leva o jogador a (x, z) parado, virado para `rumo`, com os pés plantados e sem estado de ação. */
export function teleportar(j, x, z, rumo) {
  j.x = x; j.z = z; j.vx = 0; j.vz = 0; j.ax = 0; j.az = 0; j.rumo = rumo; j.giro = 0; j.inv = false;
  j.ix = MD.cos(rumo); j.iz = MD.sin(rumo); j.imag = 0; j.intRumo = rumo; j.intW = 0;
  // pés como os de um jogador recém-criado (jogador.js criarPe), com a passada recomeçando
  const rx = -MD.sin(rumo), rz = MD.cos(rumo);
  j.fase = 0;
  for (let k = 0; k < 2; k++) {
    const p = j.pes[k], s = (k === 0 ? -1 : 1) * PASSADA.afastamentoLateral;
    const px = x + rx * s, pz = z + rz * s;
    p.apoio = true; p.x = px; p.z = pz; p.rumo = rumo;
    p.faseApoio = k === 0 ? 0 : -1; p.faseSaida = 0; p.fasePouso = 0;
    p.lx = px; p.lz = pz; p.lrumo = rumo; p.puxa = 0; p.gx = px; p.gz = pz;
    p.tx = px; p.ty = JOGADOR.alturaTornozelo; p.tz = pz; p.bx = px; p.bz = pz; p.k = 0; p.chegou = false; p.pendente = false;
  }
  j.travaApoio = null;
  j.recebe = null; j.corrida = null; j.pedido = null; j.carga = null; j.mira = null; j.iaAcao = null; j.intercepta = null;
  j.defesa = null; j.mergulho = null; j.segura = null; j.saindo = null; j.ia = null;
  const c = j.cond;
  if (c) { c.toque = null; c.busca = false; c.ref = null; c.longeDesde = -1; c.ult = null; c.pedalada = null; c.cortePendente = null; c.corteRumo = null; c.puxada = null; }
}

const _p = { x: 0, z: 0 };
/**
 * Monta a saída de bola do time `time` (início de tempo e depois do gol): todos nas posições de
 * saída (posicaoTatica sem a bola, bola no centro, cada um no seu campo; adversários fora do
 * círculo), o cobrador no centro com a bola, m.parada = saída. Teleporte (corte de câmera).
 */
export function montarSaida(m, time) {
  const cobrador = cobradorDaSaida(m.times[time]);
  for (const t of [0, 1]) {
    const lado = m.ataca[t], s = m.times[t];
    const pos = [];
    for (const j of m.jogadores) {
      if (j.time !== t) continue;
      let x, z;
      if (j.id === cobrador) { x = -0.4; z = 0; }
      else {
        posicaoTatica(s.formacao, j.vagaId, s.tatica, { x: 0, z: 0 }, 'sem', lado, _p);
        x = Math.min(_p.x * lado, -1); z = _p.z * lado;
        if (t !== time && j.posicao !== 'GOL') {
          const r = PARTIDA.raio.saida + 0.85, d = MD.hypot(x, z);
          if (d < r) { if (d < 1e-6) { x = -r; z = 0; } else { x *= r / d; z *= r / d; } }
        }
        // ninguém em cima de ninguém (a colisão não separa corpos coincidentes)
        for (let k = 0; k < 8; k++) {
          let perto = false;
          for (const q of pos) if (MD.hypot(q.x - x, q.z - z) < 1.2) { perto = true; break; }
          if (!perto) break;
          z += z >= 0 ? 1.5 : -1.5;
        }
      }
      pos.push({ x, z });
      teleportar(j, clamp(x, -CAMPO.meioX + 0.5, CAMPO.meioX - 0.5) * lado, clamp(z, -CAMPO.meioZ + 0.5, CAMPO.meioZ - 0.5) * lado, lado > 0 ? 0 : Math.PI);
    }
  }
  Object.assign(m.bola, criarBola(0, 0));
  m.posse = cobrador; m.naMao = null; m.voo = null; m.golTick = null; m.foraDesde = null;
  m.parada = { tipo: 'saida', time, x: 0, z: 0, cobrador, desde: m.tick, pronta: m.tick, rolou: false, raio: PARTIDA.raio.saida };
  if (time === 0 && m.humanos.includes(0) && m.controlado[0] !== cobrador) {
    const c = jogadorPorId(m, cobrador);
    if (c) assumirControle(m, 0, c);
  }
  m.partida.ultimoTime = time;
  m.eventos.push({ tipo: 'saida', time });
}

/**
 * Ponto (x, z) que o jogador j pode ocupar durante a parada (adversário do cobrador fora do raio,
 * ou fora da área no tiro de meta). Escreve em `out` e devolve `out`. Sem parada: o próprio ponto.
 */
export function restricaoParada(m, j, x, z, out = { x: 0, z: 0 }) {
  out.x = x; out.z = z;
  const p = m.parada;
  if (!p || p.rolou || j.time === p.time || j.id === p.cobrador) return out;
  if (p.raio === 'area') {
    const gx = -m.ataca[p.time] * CAMPO.meioX, dentro = Math.abs(x - gx) < CAMPO.area.profundidade + 0.5 && Math.abs(z) < CAMPO.area.largura / 2 + 0.5;
    if (dentro) out.x = gx + Math.sign(-gx) * (CAMPO.area.profundidade + 0.5);
    return out;
  }
  const dx = x - p.x, dz = z - p.z, d = MD.hypot(dx, dz), r = p.raio + 0.5;
  if (d < r) {
    if (d < 1e-6) { out.x = p.x - m.ataca[p.time] * r; out.z = p.z; } else { out.x = p.x + dx * r / d; out.z = p.z + dz * r / d; }
  }
  return out;
}

/** Minuto mostrado no placar (0–90): tempo real × 45 / minutosPorTempo, por tempo. */
export function minutoDeJogo(m) {
  const p = m.partida;
  if (!p) return 0;
  if (p.estado === 'fim') return 90;
  if (p.estado === 'intervalo') return 45;
  const f = Math.min(1, (m.tick - p.tick0Tempo) / p.ticksPorTempo);
  return (p.tempo - 1) * 45 + Math.floor(f * 45);
}

function fimDoTempo(m) {
  const p = m.partida;
  if (p.tempo === 1) {
    p.estado = 'intervalo'; p.desde = m.tick;
    m.parada = null;
    m.eventos.push({ tipo: 'intervalo' });
    aplicarPendentes(m, 0, { intervalo: true });
    aplicarPendentes(m, 1, { intervalo: true });
  } else {
    p.estado = 'fim'; p.desde = m.tick;
    m.parada = null;
    m.eventos.push({ tipo: 'fimDeJogo', placar: { 0: m.placar[0], 1: m.placar[1] } });
  }
}

/** Regras da partida (depois do passo): relógio, gol, bola fora → saída, intervalo e fim. */
export function regrasPartida(m) {
  const p = m.partida;
  const idB = m.naMao ?? m.posse;
  if (idB != null) { const j = jogadorPorId(m, idB); if (j) p.ultimoTime = j.time; }
  else if (m.voo && m.voo.time != null) p.ultimoTime = m.voo.time;
  if (p.estado === 'fim') return;
  if (p.estado === 'intervalo') {
    if (m.tick - p.desde < seg(PARTIDA.intervalo)) return;
    // 2º tempo: troca de lado e a saída é de quem não começou
    m.ataca = { 0: -m.ataca[0], 1: -m.ataca[1] };
    for (const j of m.jogadores) vestirVaga(m, j, j.vagaId);
    p.tempo = 2; p.tick0Tempo = m.tick; p.estado = 'jogo'; p.desde = m.tick;
    montarSaida(m, 1 - p.saidaInicial);
    return;
  }
  // a bola rolou (o cobrador tocou nela ou ela saiu do ponto)? Nenhuma parada passa de paradaMax.
  const pr = m.parada;
  if (pr && !pr.rolou) {
    const b = m.bola.p;
    if (m.posse !== pr.cobrador || m.voo || MD.hypot(b.x - pr.x, b.z - pr.z) > 0.5 || m.tick - pr.desde > seg(PARTIDA.paradaMax)) {
      pr.rolou = true;
      m.eventos.push({ tipo: 'cobranca', parada: pr.tipo, id: pr.cobrador });
    }
  }
  if (p.estado === 'gol') {
    if (m.tick - p.desde < seg(PARTIDA.golPausa)) return;
    if (m.tick - p.tick0Tempo >= p.ticksPorTempo) { m.golTick = null; fimDoTempo(m); return; }
    aplicarPendentes(m, 0); aplicarPendentes(m, 1);
    p.estado = 'jogo'; p.desde = m.tick;
    montarSaida(m, 1 - (p.golTime ?? 0));
    return;
  }
  // estado 'jogo'
  if (m.golTick != null) {
    const ev = m.eventos.find(e => e.tipo === 'gol');
    p.golTime = ev ? ev.time : (m.bola.p.x * m.ataca[0] > 0 ? 0 : 1);
    p.estado = 'gol'; p.desde = m.golTick;
    return;
  }
  if (m.tick - p.tick0Tempo >= p.ticksPorTempo) { fimDoTempo(m); return; }
  const b = m.bola.p;
  const fora = Math.abs(b.x) > CAMPO.meioX + BOLA.raio || Math.abs(b.z) > CAMPO.meioZ + BOLA.raio;
  if (!fora) { m.foraDesde = null; return; }
  if (m.foraDesde == null) { m.foraDesde = m.tick; m.eventos.push({ tipo: 'fora' }); return; }
  if (m.tick - m.foraDesde < seg(PARTIDA.foraEspera)) return;
  aplicarPendentes(m, 0); aplicarPendentes(m, 1);
  montarSaida(m, 1 - p.ultimoTime);
}

/**
 * Um passo da partida (1/60 s). entrada = {x, z, botoes} do humano (time 0). acoes: lista com
 * ações-objeto (a edição {tipo: 'editarTime', ...}, aplicada ANTES do passo e gravada em m.log) e
 * ações-texto (depois do passo). Intervalo e fim: o mundo fica parado (só o relógio do tick anda).
 * Devolve os eventos do passo.
 */
export function passoPartida(m, entrada, acoes) {
  const depois = [];
  if (acoes) {
    for (const a of acoes) {
      if (!a || typeof a !== 'object') continue;
      if (a.tipo === 'editarTime') {
        const r = aplicarEdicao(m, a);
        m.log?.push({ tick: m.tick, acao: a });
        depois.push(r.ok ? { tipo: 'timeEditado', time: a.time, pendente: !!r.pendente } : { tipo: 'edicaoRecusada', time: a.time, motivo: r.motivo });
      }
    }
  }
  const est = m.partida.estado;
  if (est === 'intervalo' || est === 'fim') { m.eventos = []; m.tick++; }
  else passo(m, { 0: entrada });
  regrasPartida(m);
  for (const e of depois) m.eventos.push(e);
  // ações-texto da partida (Parte 1: 'reiniciar' fica com a página, que cria outra partida)
  return m.eventos;
}

/** Demonstração/testes: a IA joga pelo controlado do time 0 (como o ?demo=1 do treino). */
export function entradaDemoPartida(m) {
  const j = jogadorPorId(m, m.controlado[0]);
  return j ? entradaIATatica(m, j) : { x: 0, z: 0, botoes: 0 };
}

/** Mistura no hash o estado da partida (relógio, estado, parada). Só com m.times. */
export function misturarPartida(h, m) {
  const p = m.partida;
  if (!p) return h;
  for (const v of [ESTADOS.indexOf(p.estado), p.tempo, p.tick0Tempo, p.ticksPorTempo, p.saidaInicial, p.iaClassica ? 1 : 0, p.desde, p.ultimoTime ?? -1, p.golTime ?? -1, m.golTick ?? -1, m.foraDesde ?? -1]) h = misturarHash(h, v);
  const pr = m.parada;
  if (!pr) return misturarHash(h, -1);
  for (const v of [TIPOS_PARADA.indexOf(pr.tipo), pr.time, pr.x, pr.z, pr.cobrador, pr.desde, pr.pronta, pr.rolou ? 1 : 0, pr.raio === 'area' ? -2 : pr.raio]) h = misturarHash(h, v);
  return h;
}
