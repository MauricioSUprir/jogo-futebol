// Partida 11×11 (Etapa 3): criação dos dois times pelo elenco e pela formação, relógio com 2
// tempos, saída de bola, lateral, escanteio e tiro de meta SIMPLIFICADOS (a regra IFAB completa é
// da Etapa 4), gol, intervalo com troca de lado, fim, substituição na parada e a edição do time como
// ENTRADA do passo. Puro: sem three.js nem DOM; só MD e m.rng. Plano 1.4.6, 3.1–3.4 e 3.6;
// constantes em config.js PARTIDA.
//
// Estado (só existe na partida; o treino não tem m.times nem m.partida):
//  m.partida = {estado: 'jogo'|'parada'|'gol'|'intervalo'|'fim', tempo: 1|2, tick0Tempo, ticksPorTempo,
//               saidaInicial: 0|1, iaClassica, desde (tick do estado), ultimoTime / ultimoId / ultimoTick
//               (último toque na bola: decide o recomeço), golTime (quem marcou o último gol)}
//  m.parada  = null | {tipo: 'saida'|'lateral'|'escanteio'|'tiroDeMeta', time (quem cobra), x, z (ponto),
//               cobrador: id | null (null = bola morta, antes da montagem: ninguém toca nela), inicio (tick
//               em que a bola morreu), desde (tick da montagem), pronta (tick em que pode cobrar), atraso
//               (ticks que a IA espera depois de pronta, sorteados pelo m.rng), rolou: bool, raio (m dos
//               adversários; 'area' = fora da área), papel (papel do cobrador antes da cobrança), levado (m
//               que o cobrador foi levado até o ponto)}
//  Enquanto m.parada existe e rolou === false, só o cobrador toca a bola (ganchos do sim.js).
//
// Recomeços (plano 3.3), todos com a bola morta 1 s (foraEspera) ou 2,5 s (gol) antes da montagem:
//  - saída: todos levados às posições de saída, cada um no seu campo, adversários fora do círculo
//    (corte de câmera); o cobrador (ATA/SA) toca curto para trás;
//  - lateral: o time que NÃO tocou por último; o jogador de linha mais perto cobra COM O PÉ (Etapa 4:
//    arremesso com as mãos); adversários a ≥ 2 m;
//  - escanteio: bola na linha de fundo com o último toque de quem defende; cobra quem cruza melhor;
//    adversários a ≥ 9,15 m; a IA cruza (o lançamento vira cruzamento pela zona, acoes.js);
//  - tiro de meta: o goleiro com a bola NAS MÃOS na linha da pequena área (Etapa 4: com o pé no
//    chão), adversários fora da área até a bola sair; a reposição é a que já existe (sim.js
//    goleiroComBola: IA em 1,5 s, humano em até 3 s).
// O cobrador é levado ao ponto na montagem e fica parado (papel 'parado': a simulação não o move)
// até cobrar; a cobrança é a ação de verdade (acoes.js executarAcao, a mesma do jogo). A IA cobra em
// 0,6–1,4 s depois de pronta; o humano tem até 6 s desde a bola morta, depois a IA cobra por ele.
// Quem está dentro do raio sai andando (até PARTIDA.empurrao m/s) e ninguém entra até a bola rolar:
// a parede (paredeParada, chamada pelo sim.js antes de passoCorpo) só muda o PEDIDO de movimento, pela
// locomoção, e nunca a posição do corpo (os pés seguem pela passada). Nenhuma parada passa de
// PARTIDA.paradaMax (8 s).

import { PARTIDA, PASSO, CAMPO, BOLA, PASSADA, JOGADOR, ACOES, BOTAO, GOLEIRO } from './config.js';
import { criarMundo, passo, jogadorPorId, misturarHash, aplicarEntrada } from './sim.js';
import { criarBola } from './bola.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { fichaDe, atributosDe, FUNCAO } from './elenco.js';
import { FORMACOES } from './formacoes.js';
import { posicaoTatica } from './tatica.js';
import { estadoInicialTime, vestirVaga, aplicarEdicao, aplicarPendentes } from './escalacao.js';
import { entradaIATatica } from './ia-tatica.js';
import { assumirControle, atualizarBotoesAcao, executarAcao, riscoLinha, ataca } from './acoes.js';

export const ESTADOS = ['jogo', 'parada', 'gol', 'intervalo', 'fim'];
export const TIPOS_PARADA = ['saida', 'lateral', 'escanteio', 'tiroDeMeta'];
const PAPEIS = ['ia', 'humano', 'parado', 'marcador'];
const seg = s => Math.round(s / PASSO);
const BOTAO_ACAO = { passe: BOTAO.PASSE, lancamento: BOTAO.LANCAMENTO };

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
 * iaClassica: true só para os testes medirem o "antes" (a IA do treino no 11×11).
 */
export function criarPartida(opc = {}) {
  const elencos = opc.elencos ?? ['golaco', 'ventania'];
  const saida = opc.saida ?? 0;
  const times = { 0: estadoInicialTime(elencos[0], opc.times?.[0]), 1: estadoInicialTime(elencos[1], opc.times?.[1]) };
  const ataca0 = { 0: 1, 1: -1 };
  const ctrl0 = cobradorDaSaida(times[0]);
  const desc = [];
  for (const t of [0, 1]) {
    for (const v of FORMACOES[times[t].formacao].vagas) {
      const id = times[t].vagas[v.id];
      desc.push({
        id, x: 0, z: 0, rumo: ataca0[t] > 0 ? 0 : Math.PI, attr: atributosDe(fichaDe(id)), time: t,
        papel: t === 0 && id === ctrl0 ? 'humano' : 'ia', posicao: FUNCAO[v.pos],
      });
    }
  }
  const m = criarMundo({ semente: opc.semente ?? 1, jogadores: desc, bola: { x: 0, z: 0 }, posse: null, ataca: ataca0, log: opc.log, controlado: { 0: ctrl0 } });
  m.modo = 'partida';
  m.times = times;
  for (const j of m.jogadores) { vestirVaga(m, j, vagaDoJogador(times[j.time], j.id)); j.iaT = null; }
  const min = opc.minutosPorTempo ?? PARTIDA.minutosPorTempo;
  m.partida = {
    estado: 'parada', tempo: 1, tick0Tempo: 0, ticksPorTempo: Math.max(1, Math.round(min * 60 / PASSO)),
    saidaInicial: saida, iaClassica: !!opc.iaClassica, desde: 0, ultimoTime: saida, ultimoId: null, ultimoTick: -1, golTime: null,
  };
  m.parada = null;
  m.golTick = null; m.foraDesde = null;
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

// ------------------------------------------------------------------------------------ paradas

// m.golTick com a bola morta: o sim.js (verificarGol) não conta gol enquanto m.golTick != null — a
// bola que sai pela linha de fundo e rola por fora para dentro do gol não vale. Volta a null quando
// a bola rola (cobrança).
const MORTA = -2;

/** Bola morta (fora, gol ou começo do tempo): a parada começa SEM cobrador (ninguém toca a bola). */
function bolaMorta(m, tipo, time, x, z) {
  encerrarParada(m);
  if (m.golTick == null) m.golTick = MORTA;
  m.parada = {
    tipo, time, x, z, cobrador: null, inicio: m.tick, desde: m.tick, pronta: -1, atraso: 0, rolou: false,
    raio: PARTIDA.raio[tipo], papel: null, levado: 0,
  };
  // ninguém segue disputando a bola morta: sem posse, sem passe no ar, sem recepção marcada
  if (m.posse != null) { const d = jogadorPorId(m, m.posse); if (d && d.cond) { d.cond.toque = null; d.cond.busca = false; } }
  // o goleiro que entrou com a bola nas mãos no gol (gol contra) também a larga
  if (m.naMao != null) { const g = jogadorPorId(m, m.naMao); if (g) { g.segura = null; g.pedido = null; } m.naMao = null; }
  m.posse = null;
  m.voo = null;
  for (const j of m.jogadores) { j.recebe = null; j.corrida = null; j.intercepta = null; }
}

/** Desfaz a parada (cobrança feita, fim do tempo): o cobrador volta a se mexer. */
function encerrarParada(m) {
  const pr = m.parada;
  if (!pr) return;
  if (pr.cobrador != null && pr.papel != null) {
    const c = jogadorPorId(m, pr.cobrador);
    if (c && c.papel === 'parado') c.papel = pr.papel;
  }
  m.parada = null;
}

/** Limpa cargas, pedidos e miras (a bola morreu: nada do lance anterior vale na cobrança). */
function limparAcoes(m) {
  for (const j of m.jogadores) {
    j.carga = null; j.pedido = null; j.mira = null; j.miraAuto = null; j.iaAcao = null;
    if (j.cond) j.cond.toque = null;
  }
}

/** Fim da montagem: prazo para cobrar, atraso da IA (rng) e o controle do humano. */
function fecharMontagem(m, c, levado) {
  const pr = m.parada;
  pr.cobrador = c.id;
  pr.desde = m.tick;
  pr.pronta = m.tick + seg(PARTIDA.montagemPor[pr.tipo]);
  const [a0, a1] = PARTIDA.cobrancaIA;
  pr.atraso = seg(lerp(a0, a1, uniforme(m.rng)));
  pr.levado = levado;
  if (pr.tipo !== 'tiroDeMeta') { pr.papel = c.papel; c.papel = 'parado'; }
  // o humano do time que cobra controla o cobrador; o do outro time, o jogador de linha mais perto da bola
  for (const t of m.humanos) {
    if (t === pr.time) {
      if (m.controlado[t] !== c.id) { assumirControle(m, t, c); m.eventos.push({ tipo: 'troca', id: c.id, auto: true }); }
    } else {
      let mel = null, dm = Infinity;
      for (const o of m.jogadores) {
        if (o.time !== t || o.posicao === 'GOL') continue;
        const d = MD.hypot(o.x - pr.x, o.z - pr.z);
        if (d < dm) { dm = d; mel = o; }
      }
      if (mel && m.controlado[t] !== mel.id) { assumirControle(m, t, mel); m.eventos.push({ tipo: 'troca', id: mel.id, auto: true }); }
    }
  }
}

/** Põe o cobrador atrás da bola (a 0,4 m), virado para `rumo`, com a posse; devolve a distância andada. */
function cobradorNoPonto(m, c, bx, bz, rumo) {
  const x = bx - MD.cos(rumo) * 0.4, z = bz - MD.sin(rumo) * 0.4;
  const levado = MD.hypot(c.x - x, c.z - z);
  teleportar(c, x, z, rumo);
  Object.assign(m.bola, criarBola(bx, bz));
  m.posse = c.id; m.naMao = null; m.voo = null;
  return levado;
}

const _p = { x: 0, z: 0 };
/**
 * Monta a saída de bola do time `time` (início de tempo e depois do gol): todos nas posições de
 * saída (posicaoTatica sem a bola, bola no centro, cada um no seu campo; adversários fora do
 * círculo), o cobrador no centro com a bola, m.parada = saída. Teleporte (corte de câmera).
 */
export function montarSaida(m, time) {
  const cobrador = cobradorDaSaida(m.times[time]);
  if (!m.parada || m.parada.tipo !== 'saida' || m.parada.cobrador != null) bolaMorta(m, 'saida', time, 0, 0);
  m.parada.time = time; m.parada.x = 0; m.parada.z = 0;
  limparAcoes(m);
  for (const t of [0, 1]) {
    const lado = m.ataca[t], s = m.times[t];
    const pos = [];
    for (const j of m.jogadores) {
      if (j.time !== t || j.id === cobrador) continue;
      posicaoTatica(s.formacao, j.vagaId, s.tatica, { x: 0, z: 0 }, 'sem', lado, _p);
      let x = Math.min(_p.x * lado, -1), z = _p.z * lado;
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
      pos.push({ x, z });
      teleportar(j, clamp(x, -CAMPO.meioX + 0.5, CAMPO.meioX - 0.5) * lado, clamp(z, -CAMPO.meioZ + 0.5, CAMPO.meioZ - 0.5) * lado, lado > 0 ? 0 : Math.PI);
    }
  }
  const c = jogadorPorId(m, cobrador);
  // o cobrador fica atrás da bola na direção do toque (curto para trás, para o companheiro escolhido)
  Object.assign(m.bola, criarBola(0, 0));
  const alvo = alvoCobranca(m, c, 'saida');
  const levado = cobradorNoPonto(m, c, 0, 0, MD.atan2(alvo.dz, alvo.dx));
  m.golTick = MORTA; m.foraDesde = null;
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  m.partida.ultimoTime = time;
  fecharMontagem(m, c, levado);
  m.eventos.push({ tipo: 'saida', time });
}

/** Lateral e escanteio: o cobrador levado ao ponto, a bola no chão, os adversários saem do raio. */
function montarBolaParada(m) {
  const pr = m.parada;
  const t = pr.time, lado = m.ataca[t];
  let c = null;
  if (pr.tipo === 'lateral') {
    // o jogador de linha mais perto do ponto
    let dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - pr.x, o.z - pr.z);
      if (d < dm) { dm = d; c = o; }
    }
  } else {
    // quem cruza melhor (passe longo), fora o goleiro, os zagueiros e os atacantes (que vão para a área)
    let mel = -Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL' || o.posicao === 'ZAG' || o.posicao === 'ATA') continue;
      const v = o.par.attr.passeLongo * 100 - (o.vagaIdx ?? 0);
      if (v > mel) { mel = v; c = o; }
    }
    if (!c) for (const o of m.jogadores) if (o.time === t && o.posicao !== 'GOL') { c = o; break; }
  }
  limparAcoes(m);
  Object.assign(m.bola, criarBola(pr.x, pr.z));
  const rumo = pr.tipo === 'lateral'
    ? MD.atan2(-Math.sign(pr.z), 0)                                        // de frente para o campo
    : MD.atan2(-pr.z, lado * (CAMPO.meioX - CAMPO.marcaPenalti) - pr.x);   // para a marca do pênalti
  const levado = cobradorNoPonto(m, c, pr.x, pr.z, rumo);
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, c, levado);
  if (pr.tipo === 'lateral') m.eventos.push({ tipo: 'lateral', time: t, x: pr.x, z: pr.z, id: c.id, levado });
  else m.eventos.push({ tipo: 'escanteio', time: t, lado: pr.z >= 0 ? 1 : -1, id: c.id, levado });
}

/** Tiro de meta (simplificado): o goleiro com a bola nas mãos na linha da pequena área. */
function montarTiroDeMeta(m) {
  const pr = m.parada;
  const t = pr.time;
  let g = null;
  for (const o of m.jogadores) if (o.time === t && o.posicao === 'GOL') { g = o; break; }
  if (!g) { montarBolaParada(m); return; }
  limparAcoes(m);
  const s = -m.ataca[t];                    // lado do gol do time (x = s · 52,5)
  const x = s * (CAMPO.meioX - CAMPO.pequenaArea.profundidade), z = clamp(pr.z, -8, 8);
  const levado = MD.hypot(g.x - x, g.z - z);
  teleportar(g, x, z, MD.atan2(0, -s));
  pr.x = x; pr.z = z;
  Object.assign(m.bola, criarBola(x, z));
  m.posse = g.id; m.naMao = g.id; m.voo = null;
  g.segura = { desde: m.tick };
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, g, levado);
  m.eventos.push({ tipo: 'tiroDeMeta', time: t, id: g.id, levado });
}

/**
 * Ponto (x, z) que o jogador j pode ocupar durante a parada (a IA mira nele; a parede segura nele):
 * saída — todos no próprio campo e os adversários fora do círculo; lateral e escanteio — adversários
 * a ≥ raio da bola; tiro de meta — adversários fora da área. Escreve em `out` e devolve `out`. Sem
 * parada (ou já cobrada), e para o cobrador: o próprio ponto.
 */
export function restricaoParada(m, j, x, z, out = { x: 0, z: 0 }) {
  out.x = x; out.z = z;
  const p = m.parada;
  if (!p || p.rolou || j.id === p.cobrador) return out;
  const folga = PARTIDA.folgaRaio;
  if (p.tipo === 'saida') {
    const lado = m.ataca[j.time];
    if (out.x * lado > -0.3) out.x = -0.3 * lado;   // cada um no seu campo
    if (j.time === p.time) return out;
  } else if (j.time === p.time) return out;
  if (p.raio === 'area') {
    const s = -m.ataca[p.time], gx = s * CAMPO.meioX;
    const prof = CAMPO.area.profundidade + folga, larg = CAMPO.area.largura / 2 + folga;
    const dx = Math.abs(out.x - gx), dz = Math.abs(out.z);
    if (dx < prof && dz < larg) {
      // sai pelo lado mais perto (frente ou lado da área)
      if (prof - dx <= larg - dz) out.x = gx - s * prof;
      else out.z = (out.z >= 0 ? 1 : -1) * larg;
    }
    return out;
  }
  const dx = out.x - p.x, dz = out.z - p.z, d = MD.hypot(dx, dz), r = p.raio + folga;
  if (d < r) {
    if (d < 1e-6) { out.x = p.x - m.ataca[p.time] * r; out.z = p.z; } else { out.x = p.x + dx * r / d; out.z = p.z + dz * r / d; }
  }
  return out;
}

const _r = { x: 0, z: 0 };
const _b = { d: 0, nx: 0, nz: 0 };

/**
 * Borda de uma restrição da parada vista do ponto (x, z): `d` = distância com sinal até a borda
 * (> 0 do lado permitido; < 0 dentro da zona proibida) e (nx, nz) = normal unitária que aponta para
 * o lado permitido. k: 0 = o próprio campo (saída), 1 = o raio / a área. Devolve false se a
 * restrição não vale para j (escreve em _b).
 */
function bordaParada(m, p, j, x, z, k) {
  const folga = PARTIDA.folgaRaio;
  if (k === 0) {
    if (p.tipo !== 'saida') return false;
    const lado = m.ataca[j.time];
    _b.d = -0.3 - x * lado; _b.nx = -lado; _b.nz = 0;
    return true;
  }
  if (j.time === p.time) return false;
  if (p.raio === 'area') {
    const s = -m.ataca[p.time], gx = s * CAMPO.meioX;
    const prof = CAMPO.area.profundidade + folga, larg = CAMPO.area.largura / 2 + folga;
    const ax = Math.abs(x - gx), az = Math.abs(z);
    const sx = x - gx >= 0 ? 1 : -1, sz = z >= 0 ? 1 : -1;
    const ex = ax - prof, ez = az - larg;   // > 0: fora por aquele lado
    if (ex > 0 && ez > 0) {
      const d = MD.hypot(ex, ez);
      _b.d = d; _b.nx = sx * ex / d; _b.nz = sz * ez / d;
    } else if (ex > 0 || ez > 0) {
      if (ex >= ez) { _b.d = ex; _b.nx = sx; _b.nz = 0; } else { _b.d = ez; _b.nx = 0; _b.nz = sz; }
    } else if (-ex <= -ez) {
      // dentro: sai pelo lado mais perto (frente da área), como restricaoParada
      _b.d = ex; _b.nx = -s; _b.nz = 0;
    } else { _b.d = ez; _b.nx = 0; _b.nz = sz; }
    return true;
  }
  const dx = x - p.x, dz = z - p.z, dd = MD.hypot(dx, dz);
  _b.d = dd - (p.raio + folga);
  if (dd < 1e-6) { _b.nx = -m.ataca[p.time]; _b.nz = 0; } else { _b.nx = dx / dd; _b.nz = dz / dd; }
  return true;
}

/**
 * Parede da parada PELA LOCOMOÇÃO (sim.js chama no passo 2, antes de passoCorpo): muda só o pedido
 * de movimento `mv` = {dx, dz, vel, rumoAlvo} de quem tem restrição (restricaoParada), nunca a posição
 * do corpo — os pés seguem pela passada, sem pé plantado arrastado (antes a parede empurrava o corpo
 * até 7 m/s com os pés no chão: teste-patinacao). Vale da bola morta (lateral, escanteio e tiro de
 * meta; a saída é montada por teleporte) até a bola rolar; o cobrador fica de fora.
 *  - dentro da zona: sai andando pelo caminho mais curto (o ponto de restricaoParada), mais depressa
 *    quanto mais fundo (até PARTIDA.empurrao m/s);
 *  - fora: a componente do pedido para dentro fica limitada pela distância até a borda (dá para frear
 *    antes dela com PARTIDA.freioParede m/s²): ninguém entra, e quem corre para a borda freia.
 * Devolve `mv` (sem mudança) ou um pedido novo. Pura.
 */
export function paredeParada(m, j, mv) {
  const p = m.parada;
  if (!p || p.rolou || j.id === p.cobrador || j.papel === 'parado') return mv;
  if (p.cobrador == null && p.tipo === 'saida') return mv;
  // dentro de alguma restrição: sai pelo ponto mais perto
  restricaoParada(m, j, j.x, j.z, _r);
  const ox = _r.x - j.x, oz = _r.z - j.z, od = MD.hypot(ox, oz);
  if (od > PARTIDA.dentroParede) {
    const vel = clamp(Math.sqrt(2 * PARTIDA.freioParede * (od + PARTIDA.margemParede)), PARTIDA.saiParede, PARTIDA.empurrao);
    return { dx: ox / od, dz: oz / od, vel, rumoAlvo: mv.rumoAlvo };
  }
  // fora: tira do pedido a velocidade para dentro que não daria para frear antes da borda
  let wx = mv.dx * mv.vel, wz = mv.dz * mv.vel, mudou = false;
  for (let k = 0; k < 2; k++) {
    if (!bordaParada(m, p, j, j.x, j.z, k)) continue;
    const vMax = Math.sqrt(2 * PARTIDA.freioParede * Math.max(0, _b.d - PARTIDA.margemParede));
    const vIn = -(wx * _b.nx + wz * _b.nz);
    if (vIn > vMax) { const c = vIn - vMax; wx += c * _b.nx; wz += c * _b.nz; mudou = true; }
  }
  if (!mudou) return mv;
  const vel = MD.hypot(wx, wz);
  if (vel < 1e-6) return { dx: mv.dx, dz: mv.dz, vel: 0, rumoAlvo: mv.rumoAlvo };
  return { dx: wx / vel, dz: wz / vel, vel, rumoAlvo: mv.rumoAlvo };
}

/**
 * Ninguém (fora o cobrador) está dentro da restrição da parada (mais de 5 cm para dentro da borda
 * com a folga)? A IA só cobra com a zona livre — ou, sem ela, PARTIDA.livreAte s antes do limite
 * da parada (trava proibida).
 */
export function zonaLivre(m) {
  const pr = m.parada;
  if (!pr || pr.cobrador == null) return false;
  for (const j of m.jogadores) {
    if (j.id === pr.cobrador || j.papel === 'parado') continue;
    restricaoParada(m, j, j.x, j.z, _r);
    if (MD.hypot(_r.x - j.x, _r.z - j.z) > 0.05) return false;
  }
  return true;
}

/** A IA pode cobrar agora: depois de pronta + atraso, com a zona livre (ou perto do limite). */
function iaPodeCobrar(m) {
  const pr = m.parada;
  if (m.tick < pr.pronta + pr.atraso) return false;
  return zonaLivre(m) || m.tick - pr.inicio >= seg(PARTIDA.paradaMax - PARTIDA.livreAte);
}

// ------------------------------------------------------------------------------- cobrança

/**
 * Alvo da cobrança para a IA (pura): {dx, dz (direção, unitária), tipo, forca, para (id | null)}.
 *  saída: o companheiro mais perto atrás da bola (toque curto para trás);
 *  lateral: o companheiro de linha a 6–30 m com a linha de passe mais livre (riscoLinha), um pouco à
 *    frente de preferência; sem ninguém livre, lançamento ao longo da linha;
 *  escanteio: cruzamento (lançamento; acoes.js escolhe a zona pelo companheiro mais perto dela).
 */
export function alvoCobranca(m, j, tipo = m.parada?.tipo) {
  const b = m.bola.p;
  const lado = ataca(m, j.time);
  const F = PARTIDA.forcaCobranca;
  if (tipo === 'escanteio') {
    const tx = lado * (CAMPO.meioX - CAMPO.marcaPenalti) - b.x, tz = -b.z, l = MD.hypot(tx, tz) || 1;
    return { dx: tx / l, dz: tz / l, tipo: 'lancamento', forca: F.escanteio, para: null };
  }
  let mel = null, ms = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL' || o.papel === 'parado') continue;
    const ox = o.x - b.x, oz = o.z - b.z, d = MD.hypot(ox, oz);
    const u = ox * lado; // à frente (+) ou atrás (−) da bola
    let s;
    if (tipo === 'saida') {
      if (u > -1.5 || d > 25) continue;
      s = d + 15 * riscoLinha(m, j, b.x, b.z, o.x, o.z, 10);
    } else {
      if (d < 6 || d > 30) continue;
      s = 20 * riscoLinha(m, j, b.x, b.z, o.x, o.z, 12) + 0.3 * Math.abs(d - 14) - 0.1 * clamp(u, -10, 15);
    }
    if (s < ms || (s === ms && o.id < mel.id)) { ms = s; mel = o; }
  }
  if (mel && (tipo === 'saida' || ms < 12)) {
    const ox = mel.x - b.x, oz = mel.z - b.z, l = MD.hypot(ox, oz) || 1;
    return { dx: ox / l, dz: oz / l, tipo: 'passe', forca: tipo === 'saida' ? F.saida : F.lateral, para: mel.id };
  }
  if (tipo === 'saida') return { dx: -lado, dz: 0, tipo: 'passe', forca: F.saida, para: null };
  // lateral sem ninguém livre: lançamento para a frente, ao longo da linha (um pouco para dentro)
  const dz = -Math.sign(b.z) * 0.35, l = MD.hypot(1, dz);
  return { dx: lado / l, dz: dz / l, tipo: 'lancamento', forca: F.lateralLonga, para: null };
}

/**
 * Entrada do humano jogada pela IA na cobrança (a demonstração e quem não mexe no controle):
 * aponta o analógico para o alvo e aperta o botão pelo tempo da força a partir de pronta + atraso
 * (e de novo a cada PARTIDA.repeteCobranca s, se a cobrança não saiu). Pura (função do estado).
 */
export function entradaCobranca(m, j) {
  const pr = m.parada;
  if (!pr || pr.rolou || pr.cobrador !== j.id || pr.tipo === 'tiroDeMeta') return { x: 0, z: 0, botoes: 0 };
  const a = alvoCobranca(m, j, pr.tipo);
  const t0 = pr.pronta + pr.atraso;
  if (!iaPodeCobrar(m)) return { x: a.dx, z: a.dz, botoes: 0 };
  const k = Math.max(2, Math.round(a.forca * ACOES.cargaCheia / PASSO));
  const fase = (m.tick - t0) % seg(PARTIDA.repeteCobranca);
  // escanteio: o analógico solto deixa o acoes.js escolher a zona pelo companheiro mais perto dela
  const solto = pr.tipo === 'escanteio';
  return { x: solto ? 0 : a.dx, z: solto ? 0 : a.dz, botoes: fase < k ? BOTAO_ACAO[a.tipo] : 0 };
}

/**
 * Antes do passo, com a parada montada e ainda não cobrada: o cobrador (parado: a simulação não lê a
 * entrada dele) recebe a entrada do humano — ou a da IA, se ele não é do humano ou se o humano passou
 * de PARTIDA.cobrancaHumanoMax s — e, com o pedido feito (botão solto), a cobrança sai já, pela mesma
 * ação do jogo (executarAcao). Devolve true se a bola rolou.
 */
function cobrar(m, entrada) {
  const pr = m.parada;
  if (!pr || pr.rolou || pr.cobrador == null) return false;
  if (pr.tipo === 'tiroDeMeta') {
    // o goleiro repõe pela reposição que já existe (sim.js goleiroComBola, que conta o tempo desde
    // g.segura.desde): com adversário na área, o relógio dele não anda (até perto do limite)
    const g = jogadorPorId(m, pr.cobrador);
    if (g && g.segura && m.naMao === g.id && !zonaLivre(m) && m.tick - pr.inicio < seg(PARTIDA.paradaMax - PARTIDA.livreAte - GOLEIRO.esperaHumano)) {
      g.segura.desde = m.tick; g.pedido = null; g.carga = null;
    }
    return false;
  }
  const c = jogadorPorId(m, pr.cobrador);
  if (!c || c.papel !== 'parado') return false;
  // parado com a bola no pé: a condução não "ajeita" a bola (ela fica no ponto até a cobrança)
  if (c.cond) { c.cond.toque = null; c.cond.busca = false; }
  const humano = m.humanos.includes(c.time) && m.controlado[c.time] === c.id;
  const iaAssume = !humano || m.tick - pr.inicio >= seg(PARTIDA.cobrancaHumanoMax);
  if (iaAssume) {
    if (!iaPodeCobrar(m)) { c.pedido = null; c.carga = null; return false; }
    const a = alvoCobranca(m, c, pr.tipo);
    c.carga = null;
    c.pedido = { tipo: a.tipo, forca: a.forca, mod: false, tick: m.tick, dir: pr.tipo === 'escanteio' ? null : { x: a.dx, z: a.dz } };
  } else {
    const e = m.tick >= pr.pronta ? entrada : { x: entrada?.x ?? 0, z: entrada?.z ?? 0, botoes: 0 };
    aplicarEntrada(c, e, m.tick);
    c.pedidoPedalada = false; // parado não pedala (o pedido ficaria para depois da cobrança)
    atualizarBotoesAcao(m, c);
    if (c.pedido && c.pedido.tipo === 'chute') c.pedido = null;  // bola parada não é chutada a gol (Etapa 4)
  }
  if (!c.pedido) return false;
  const ok = executarAcao(m, c, c.par.attr.pePreferido ?? 1, false);
  c.miraAuto = null; // a direção da cobrança não vale para o próximo passe dele
  if (!ok) return false;
  rolou(m);
  return true;
}

/** A bola rolou: fim da parada (o cobrador volta a se mexer), evento `cobranca`. */
function rolou(m) {
  const pr = m.parada;
  pr.rolou = true;
  m.eventos.push({ tipo: 'cobranca', parada: pr.tipo, id: pr.cobrador });
  encerrarParada(m);
  m.golTick = null; m.foraDesde = null;
  m.partida.estado = 'jogo'; m.partida.desde = m.tick;
}

// ----------------------------------------------------------------------------- relógio e regras

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
  encerrarParada(m);
  m.golTick = null; m.foraDesde = null;
  if (p.tempo === 1) {
    p.estado = 'intervalo'; p.desde = m.tick;
    m.eventos.push({ tipo: 'intervalo' });
    aplicarPendentes(m, 0, { intervalo: true });
    aplicarPendentes(m, 1, { intervalo: true });
  } else {
    p.estado = 'fim'; p.desde = m.tick;
    m.eventos.push({ tipo: 'fimDeJogo', placar: { 0: m.placar[0], 1: m.placar[1] } });
  }
}

/** Último toque na bola (decide lateral × escanteio × tiro de meta): quem está com ela, senão o último
 * chute/passe/bote/defesa (m.ultimoToque), senão quem ela acertou (evento bateuCorpo, que vem depois). */
function atualizarUltimoToque(m) {
  const p = m.partida;
  const idB = m.naMao ?? m.posse;
  const marca = (id, tick) => {
    const j = jogadorPorId(m, id);
    if (j) { p.ultimoTime = j.time; p.ultimoId = id; p.ultimoTick = tick; }
  };
  if (idB != null) { marca(idB, m.tick - 1); return; }
  const u = m.ultimoToque;
  if (u && u.tick >= p.ultimoTick) marca(u.id, u.tick);
  for (const e of m.eventos) if (e.tipo === 'bateuCorpo') marca(e.id, m.tick - 1);
}

/** Bola saiu: tipo do recomeço, time que cobra e ponto (plano 3.3). Grava a parada (bola morta). */
function bolaFora(m) {
  const p = m.partida, b = m.bola;
  const R = BOLA.raio;
  const foraX = Math.abs(b.p.x) > CAMPO.meioX + R, foraZ = Math.abs(b.p.z) > CAMPO.meioZ + R;
  // passou pelas duas linhas (perto da bandeira): vale a que ela cruzou primeiro
  let lateral = foraZ && !foraX;
  if (foraX && foraZ) {
    const tx = (Math.abs(b.p.x) - CAMPO.meioX - R) / Math.max(Math.abs(b.v.x), 1e-6);
    const tz = (Math.abs(b.p.z) - CAMPO.meioZ - R) / Math.max(Math.abs(b.v.z), 1e-6);
    lateral = tz > tx;
  }
  const ult = p.ultimoTime ?? 0;
  m.eventos.push({ tipo: 'fora' });
  if (lateral) {
    // ponto onde ela cruzou a linha lateral, 0,3 m para dentro
    const sz = b.p.z >= 0 ? 1 : -1;
    const atras = Math.abs(b.v.z) > 1e-6 ? (Math.abs(b.p.z) - CAMPO.meioZ) / Math.abs(b.v.z) : 0;
    const xc = clamp(b.p.x - b.v.x * atras, -CAMPO.meioX + 1, CAMPO.meioX - 1);
    bolaMorta(m, 'lateral', 1 - ult, xc, sz * (CAMPO.meioZ - 0.3));
    return;
  }
  const s = b.p.x >= 0 ? 1 : -1;
  const defende = m.ataca[0] === -s ? 0 : 1;   // time cujo gol fica nesta linha de fundo
  const sz = b.p.z >= 0 ? 1 : -1;
  if (ult === defende) bolaMorta(m, 'escanteio', 1 - defende, s * (CAMPO.meioX - 0.4), sz * (CAMPO.meioZ - 0.4));
  else bolaMorta(m, 'tiroDeMeta', defende, s * (CAMPO.meioX - CAMPO.pequenaArea.profundidade), b.p.z);
}

/** Regras da partida (depois do passo): relógio, gol, bola fora → recomeço, cobrança, intervalo e fim. */
export function regrasPartida(m) {
  const p = m.partida;
  atualizarUltimoToque(m);
  if (p.estado === 'fim') return;
  if (p.estado === 'intervalo') {
    if (m.tick - p.desde < seg(PARTIDA.intervalo)) return;
    // 2º tempo: troca de lado e a saída é de quem não começou (substituição feita no intervalo vale já)
    m.ataca = { 0: -m.ataca[0], 1: -m.ataca[1] };
    aplicarPendentes(m, 0, { intervalo: true });
    aplicarPendentes(m, 1, { intervalo: true });
    for (const j of m.jogadores) vestirVaga(m, j, j.vagaId);
    p.tempo = 2; p.tick0Tempo = m.tick;
    bolaMorta(m, 'saida', 1 - p.saidaInicial, 0, 0);
    montarSaida(m, 1 - p.saidaInicial);
    return;
  }
  const acabou = m.tick - p.tick0Tempo >= p.ticksPorTempo;
  if (p.estado === 'gol') {
    if (m.tick - p.desde < seg(PARTIDA.golPausa)) return;
    if (acabou) { fimDoTempo(m); return; }
    aplicarPendentes(m, 0); aplicarPendentes(m, 1);
    montarSaida(m, 1 - (p.golTime ?? 0));
    return;
  }
  // gol (estado 'jogo'; com a bola morta m.golTick = MORTA e o sim.js não conta gol)
  if (m.golTick != null && m.golTick >= 0 && p.estado === 'jogo') {
    const ev = m.eventos.find(e => e.tipo === 'gol');
    p.golTime = ev ? ev.time : (m.bola.p.x * m.ataca[0] > 0 ? 0 : 1);
    p.estado = 'gol'; p.desde = m.golTick;
    bolaMorta(m, 'saida', 1 - p.golTime, 0, 0);
    m.parada.inicio = m.golTick;
    return;
  }
  // o relógio não para nas bolas paradas: acabou o tempo, acabou (sem acréscimos: Etapa 4)
  if (acabou) { fimDoTempo(m); return; }
  const pr = m.parada;
  if (p.estado === 'parada' && pr) {
    if (pr.cobrador == null) {
      // bola morta esperando a montagem
      if (m.tick - pr.inicio < seg(PARTIDA.foraEspera)) return;
      aplicarPendentes(m, 0); aplicarPendentes(m, 1);
      if (pr.tipo === 'tiroDeMeta') montarTiroDeMeta(m);
      else montarBolaParada(m);
      return;
    }
    // montada: a bola rolou? (o tiro de meta sai pela reposição do goleiro; a cobrança com o pé sai
    // em cobrar(), antes do passo). Trava proibida: passou de paradaMax, rola do jeito que está.
    // (no tiro de meta a bola anda com o goleiro, nas mãos: só vale a reposição)
    const saiuDoPonto = pr.tipo !== 'tiroDeMeta' && MD.hypot(m.bola.p.x - pr.x, m.bola.p.z - pr.z) > 0.6;
    if (m.posse !== pr.cobrador || m.voo || saiuDoPonto || m.tick - pr.inicio > seg(PARTIDA.paradaMax)) {
      rolou(m);
      return;
    }
    // a bola fica no ponto até a cobrança (o tiro de meta está nas mãos do goleiro)
    if (pr.tipo !== 'tiroDeMeta') {
      const b = m.bola;
      b.p.x = pr.x; b.p.z = pr.z; b.p.y = BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
    }
    // a parede (ninguém entra no raio) é pela locomoção: paredeParada, no passo 2 do sim.js
    return;
  }
  // estado 'jogo': bola fora?
  const b = m.bola;
  const fora = Math.abs(b.p.x) > CAMPO.meioX + BOLA.raio || Math.abs(b.p.z) > CAMPO.meioZ + BOLA.raio;
  if (!fora) return;
  m.foraDesde = m.tick;
  bolaFora(m);
  p.estado = 'parada'; p.desde = m.tick;
}

/**
 * Um passo da partida (1/60 s). entrada = {x, z, botoes} do humano (time 0). acoes: lista com
 * ações-objeto (a edição {tipo: 'editarTime', ...}, aplicada ANTES do passo e gravada em m.log) e
 * ações-texto (a página cuida de 'reiniciar', criando outra partida). Intervalo e fim: o mundo fica
 * parado (só o relógio do tick anda). Devolve os eventos do passo.
 */
export function passoPartida(m, entrada, acoes) {
  const depois = [];
  if (acoes) {
    for (const a of acoes) {
      if (!a || typeof a !== 'object') continue;
      if (a.tipo === 'editarTime') {
        const r = aplicarEdicao(m, a);
        m.log?.push({ tick: m.tick, acao: a });
        depois.push(r.ok ? { tipo: 'timeEditado', time: a.time, pendente: !!r.pendente } : { tipo: 'edicaoRecusada', time: a.time, motivo: r.motivo, codigo: r.codigo });
      }
    }
  }
  const est = m.partida.estado;
  if (est === 'intervalo' || est === 'fim') { m.eventos = []; m.tick++; }
  else {
    // a cobrança sai antes do passo (os eventos dela entram de novo depois: o passo zera m.eventos)
    m.eventos = [];
    cobrar(m, entrada);
    const evCobranca = m.eventos;
    passo(m, { 0: entrada });
    if (evCobranca.length) m.eventos = evCobranca.concat(m.eventos);
  }
  regrasPartida(m);
  for (const e of depois) m.eventos.push(e);
  return m.eventos;
}

/** Demonstração/testes: a IA joga pelo controlado do time 0 (como o ?demo=1 do treino). */
export function entradaDemoPartida(m) {
  const j = jogadorPorId(m, m.controlado[0]);
  if (!j) return { x: 0, z: 0, botoes: 0 };
  const pr = m.parada;
  if (pr && !pr.rolou && pr.cobrador === j.id && pr.tipo !== 'tiroDeMeta') return entradaCobranca(m, j);
  return entradaIATatica(m, j);
}

/** Mistura no hash o estado da partida (relógio, estado, último toque, parada). Só com m.times. */
export function misturarPartida(h, m) {
  const p = m.partida;
  if (!p) return h;
  for (const v of [ESTADOS.indexOf(p.estado), p.tempo, p.tick0Tempo, p.ticksPorTempo, p.saidaInicial, p.iaClassica ? 1 : 0, p.desde, p.ultimoTime ?? -1, p.ultimoId ?? -1, p.ultimoTick ?? -1, p.golTime ?? -1, m.golTick ?? -1, m.foraDesde ?? -1]) h = misturarHash(h, v);
  const pr = m.parada;
  if (!pr) return misturarHash(h, -1);
  for (const v of [TIPOS_PARADA.indexOf(pr.tipo), pr.time, pr.x, pr.z, pr.cobrador ?? -1, pr.inicio, pr.desde, pr.pronta, pr.atraso, pr.rolou ? 1 : 0, pr.raio === 'area' ? -2 : pr.raio, PAPEIS.indexOf(pr.papel), pr.levado]) h = misturarHash(h, v);
  return h;
}
