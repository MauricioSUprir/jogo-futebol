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
//  m.parada  = null | {tipo: 'saida'|'lateral'|'escanteio'|'tiroDeMeta'|'tiroLivre', time (quem cobra), x, z (ponto),
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
//  - lateral (Regra 15; lateral.js): o time que NÃO tocou por último; cobra o jogador de linha mais perto (o lateral/ala
//    com vantagem), com o pé sobre a linha e a bola nas duas mãos atrás da cabeça; 3 opções marcadas; adversários a 2 m;
//  - escanteio: bola na linha de fundo com o último toque de quem defende; cobra quem cruza melhor;
//    adversários a ≥ 9,15 m; a IA cruza (o lançamento vira cruzamento pela zona, acoes.js);
//  - tiro de meta (Regra 16): a bola no chão dentro da pequena área, o goleiro cobra com o pé (curto para um zagueiro
//    aberto ou longo); adversários fora da área até a bola rolar;
//  - tiro livre indireto (Etapa 4, impedimento — impedimento.js): do outro time no ponto em que o impedido
//    tocou a bola; o de linha mais perto cobra com passe (nunca para quem está impedido); adversários a 9,15 m.
// Acréscimos (Regra 7.3): anunciados no fim do tempo regulamentar (PARTIDA.acrescimos), o tempo acaba depois deles.
// Faltas (Etapa 4, faltas.js; Regra 12): vantagem clara, tiro livre DIRETO no ponto ou pênalti (Regra 14: todos fora da
// área e da meia-lua, o goleiro na linha escolhendo o lado antes do chute); cartões (2º amarelo = vermelho) e expulsão
// (o expulso sai do campo e fica na vaga como buraco).
// O cobrador é levado ao ponto na montagem e fica parado (papel 'parado': a simulação não o move)
// até cobrar; a cobrança é a ação de verdade (acoes.js executarAcao, a mesma do jogo). A IA cobra em
// 0,6–1,4 s depois de pronta; o humano tem até 6 s desde a bola morta, depois a IA cobra por ele.
// Quem está dentro do raio sai andando (até PARTIDA.empurrao m/s) e ninguém entra até a bola rolar:
// a parede (paredeParada, chamada pelo sim.js antes de passoCorpo) só muda o PEDIDO de movimento, pela
// locomoção, e nunca a posição do corpo (os pés seguem pela passada). Nenhuma parada passa de
// PARTIDA.paradaMax (8 s).

import { PARTIDA, PASSO, CAMPO, BOLA, PASSADA, JOGADOR, ACOES, BOTAO, GOLEIRO, FALTAS, LATERAL, TIRO_DE_META, ESCANTEIO, BARREIRA } from './config.js';
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
import { assumirControle, atualizarBotoesAcao, executarAcao, riscoLinha, ataca, arremessoLateral } from './acoes.js';
import { regraImpedimento, linhaImpedimento, emPosicaoDeImpedimento } from './impedimento.js';
import { naAreaDe } from './faltas.js';
import { segurarLateral, opcoesLateral, opcaoMirada, alvoLongoNaArea, vMaxArremesso } from './lateral.js';
import { alvoBolaParada, papeisEscanteio, pontoEscanteio, pontoMarcador, bolaParadaAtiva, barreiraDoTiroLivre } from './bolas-paradas.js';

export const ESTADOS = ['jogo', 'parada', 'gol', 'intervalo', 'fim'];
export const TIPOS_PARADA = ['saida', 'lateral', 'escanteio', 'tiroDeMeta', 'tiroLivre', 'penalti'];
const PAPEIS = ['ia', 'humano', 'parado', 'marcador'];
const PAPEIS_BP = ['atacaZona', 'segundaBola', 'fica', 'zona', 'marca', 'borda', 'frente'];
const seg = s => Math.round(s / PASSO);
const BOTAO_ACAO = { passe: BOTAO.PASSE, lancamento: BOTAO.LANCAMENTO, chute: BOTAO.CHUTE };
const LADO_CAMPO = { LD: 1, LE: 1, ADD: 1, ADE: 1 }; // laterais e alas (quem cobra o lateral)

/** Id do cobrador da saída de bola do time (estado m.times[t]): o ATA, senão o SA, senão a vaga mais adiantada. */
export function cobradorDaSaida(timeEstado) {
  const f = FORMACOES[timeEstado.formacao];
  const fora = timeEstado.expulsos ?? [];
  for (const pos of ['ATA', 'SA']) for (const v of f.vagas) if (v.pos === pos && !fora.includes(timeEstado.vagas[v.id])) return timeEstado.vagas[v.id];
  let mel = null;
  for (const v of f.vagas) if (v.pos !== 'GOL' && !fora.includes(timeEstado.vagas[v.id]) && (!mel || v.sem.x > mel.sem.x)) mel = v;
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
    // Etapa 4: impedimento (impedimento.js; a foto da última jogada e o último apito, para o desenho da linha) e
    // acréscimos (minutos anunciados no fim do tempo regulamentar; o que parou no tempo conta)
    imped: null, ultimoImped: null, acrescimo: null, contagem: { gols: 0, subs: 0, imped: 0, faltas: 0, cartoes: 0 },
    // faltas e cartões (faltas.js; Regra 12): vantagem em andamento, amarelos por id, cartões para a próxima parada,
    // expulsos (ids), a última falta e o último cartão (para o desenho), o pênalti em aberto (resultado)
    vantagem: null, cartoes: {}, cartoesPendentes: [], expulsos: [], ultimaFalta: null, ultimoCartao: null, penaltiAberto: null,
  };
  m.parada = null;
  m.golTick = null; m.foraDesde = null;
  m.faltaPendente = null; m.expulsos = [];
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
  if (m.partida) {
    m.partida.imped = null; // bola morta: nenhuma jogada vale para o impedimento
    // vantagem em andamento: a bola parou, vale como dada; os cartões guardados saem agora (Regra 12.3)
    if (m.partida.vantagem) { const v = m.partida.vantagem; m.partida.vantagem = null; if (v.cartaoDado) m.partida.cartoesPendentes.push(v.cartaoDado); }
    aplicarCartoesPendentes(m);
  }
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
  pr.papel = c.papel; c.papel = 'parado';
  // o humano do time que cobra controla o cobrador; o do outro time, o jogador de linha mais perto da bola
  for (const t of m.humanos) {
    if (t === pr.time) {
      if (m.controlado[t] !== c.id) { assumirControle(m, t, c); m.eventos.push({ tipo: 'troca', id: c.id, auto: true }); }
    } else if (pr.tipo === 'penalti' || (pr.barreira && pr.barreira.n > 0)) {
      // pênalti contra: o humano controla o goleiro (escolhe o lado com o analógico); tiro livre com barreira: também
      // (quem está na barreira fica parado até a cobrança)
      const g = m.jogadores.find(o => o.time === t && o.posicao === 'GOL');
      if (g && m.controlado[t] !== g.id) { assumirControle(m, t, g); m.eventos.push({ tipo: 'troca', id: g.id, auto: true }); }
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

/** Lateral, escanteio e tiro livre: o cobrador levado ao ponto, a bola no chão, os adversários saem do raio. */
function montarBolaParada(m) {
  const pr = m.parada;
  const t = pr.time, lado = m.ataca[t];
  let c = null;
  if (pr.tipo === 'lateral' || pr.tipo === 'tiroLivre') {
    // o jogador de linha mais perto do ponto (no lateral, o lateral/ala leva LATERAL.preferirLateral m de vantagem:
    // é quem cobra no jogo de verdade)
    let dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - pr.x, o.z - pr.z) - (pr.tipo === 'lateral' && LADO_CAMPO[o.posDetalhe] ? LATERAL.preferirLateral : 0);
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
  if (pr.tipo === 'lateral') { montarLateral(m, c); return; }
  if (pr.tipo === 'escanteio') { montarEscanteio(m, c); return; }
  Object.assign(m.bola, criarBola(pr.x, pr.z));
  const rumo = pr.tipo === 'lateral'
    ? MD.atan2(-Math.sign(pr.z), 0)                                        // de frente para o campo
    : pr.tipo === 'tiroLivre' && pr.direto
      ? MD.atan2(-pr.z, lado * CAMPO.meioX - pr.x)                          // de frente para o gol
      : pr.tipo === 'tiroLivre'
        ? MD.atan2(0, lado)                                                 // de frente para o ataque
        : MD.atan2(-pr.z, lado * (CAMPO.meioX - CAMPO.marcaPenalti) - pr.x); // para a marca do pênalti
  const levado = cobradorNoPonto(m, c, pr.x, pr.z, rumo);
  if (pr.tipo === 'tiroLivre' && pr.direto) montarBarreira(m, c);
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, c, levado);
  if (pr.tipo === 'lateral') m.eventos.push({ tipo: 'lateral', time: t, x: pr.x, z: pr.z, id: c.id, levado });
  else if (pr.tipo === 'tiroLivre') m.eventos.push({ tipo: 'tiroLivre', time: t, x: pr.x, z: pr.z, id: c.id, levado, indireto: !pr.direto });
  else m.eventos.push({ tipo: 'escanteio', time: t, lado: pr.z >= 0 ? 1 : -1, id: c.id, levado });
}

/**
 * Barreira (Regra 13) no tiro livre direto perto do gol: os de linha do time que defende mais perto dos pontos dela
 * (bolas-paradas.js barreiraDoTiroLivre), levados até eles — corte de câmera, como a TV — de frente para a bola e
 * parados até a cobrança; os atacantes ficam a ≥ 1 m dela (restricaoParada). Guarda pr.barreira.
 */
function montarBarreira(m, c) {
  const pr = m.parada;
  const br = barreiraDoTiroLivre(m, pr.time, pr.x, pr.z);
  if (!br) return;
  const ids = [], papeis = [];
  for (const p of br.pontos) {
    let mel = null, dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time === pr.time || o.posicao === 'GOL' || ids.includes(o.id)) continue;
      const d = MD.hypot(o.x - p.x, o.z - p.z);
      if (d < dm || (d === dm && o.id < mel.id)) { dm = d; mel = o; }
    }
    if (!mel) break;
    ids.push(mel.id); papeis.push(mel.papel);
    teleportar(mel, p.x, p.z, MD.atan2(pr.z - p.z, pr.x - p.x));
    mel.papel = 'parado';
  }
  pr.barreira = { ids, papeis, n: ids.length, cx: br.cx, cz: br.cz, ladoLongo: br.ladoLongo, dist: br.dist, pontos: br.pontos };
  m.eventos.push({ tipo: 'barreira', n: ids.length, ids: ids.slice() }, { tipo: 'corteBolaParada', parada: 'tiroLivre' });
}

/** Desfaz a barreira (a bola rolou): cada um volta ao papel; no chute, todos pulam (bolas-paradas.js alturaSalto). */
function desfazerBarreira(m, pr) {
  const br = pr.barreira;
  const chutou = !!(m.voo && (m.voo.tipo === 'chute' || m.voo.tipo === 'colocado'));
  br.ids.forEach((id, k) => {
    const j = jogadorPorId(m, id);
    if (!j) return;
    if (j.papel === 'parado') j.papel = br.papeis[k];
    if (chutou) j.salto = { tick: m.tick, h: BARREIRA.salto.altura * (0.8 + 0.4 * (j.par.attr.impulsao ?? 60) / 100) };
  });
  if (chutou) m.partida.barreira = { ids: br.ids.slice(), tick: m.tick, bateu: [] };
}

/**
 * Lateral (Regra 15): o cobrador com o pé da frente sobre a linha (o centro LATERAL.linha m fora dela), de frente para o
 * campo, a bola nas duas mãos atrás da cabeça (lateral.js segurarLateral a mantém lá); o ponto da parada é a linha
 * (adversários a 2 m dele). A IA sorteia na montagem para qual das 3 opções vai arremessar (LATERAL.pesos) e, perto
 * da área atacada, se vai no arremesso longo (LATERAL.longaNaArea).
 */
function montarLateral(m, c) {
  const pr = m.parada;
  const sz = pr.z >= 0 ? 1 : -1;
  pr.z = sz * CAMPO.meioZ;
  const rumo = MD.atan2(-sz, 0);
  const x = pr.x, z = sz * (CAMPO.meioZ + LATERAL.linha);
  const levado = MD.hypot(c.x - x, c.z - z);
  teleportar(c, x, z, rumo);
  Object.assign(m.bola, criarBola(x, z));
  m.posse = c.id; m.naMao = null; m.voo = null;
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, c, levado);
  segurarLateral(m);
  // a escolha da IA (sorteada uma vez: alvoCobranca é pura)
  const P = LATERAL.pesos;
  let r = uniforme(m.rng) * P.reduce((a, q) => a + q, 0);
  pr.opcaoIA = P.length - 1;
  for (let i = 0; i < P.length; i++) { if (r < P[i]) { pr.opcaoIA = i; break; } r -= P[i]; }
  const lado = m.ataca[pr.time];
  pr.longa = (CAMPO.meioX - x * lado) <= LATERAL.longaDist && uniforme(m.rng) < LATERAL.longaNaArea;
  pr.arremesso = null;
  m.eventos.push({ tipo: 'lateral', time: pr.time, x: pr.x, z: pr.z, id: c.id, levado });
}

/**
 * Escanteio (ESCANTEIO; bolas-paradas.js): o cobrador na bandeira, virado para a marca do pênalti; os papéis dos dois
 * times (ataque nas zonas, defesa mista) e cada um levado ao seu lugar — corte de câmera, como a TV faz depois do
 * replay; o goleiro de quem defende no gol. A IA sorteia a zona do cruzamento (ESCANTEIO.zonaIA).
 */
function montarEscanteio(m, c) {
  const pr = m.parada, t = pr.time, lado = m.ataca[t];
  const sz = pr.z >= 0 ? 1 : -1;
  const rumo = MD.atan2(-pr.z, lado * (CAMPO.meioX - CAMPO.marcaPenalti) - pr.x);
  const levado = cobradorNoPonto(m, c, pr.x, pr.z, rumo);
  pr.sz = sz;
  pr.papeis = papeisEscanteio(m, c);
  const usados = [];
  const livre = (x, z) => {
    for (let k = 0; k < 10; k++) {
      let perto = false;
      for (const q of usados) if (MD.hypot(q.x - x, q.z - z) < 1.1) { perto = true; break; }
      if (!perto) break;
      z += 1.2 * (k % 2 ? -1 : 1) * (k + 1);
    }
    usados.push({ x, z });
    return { x, z };
  };
  // primeiro os atacantes e quem não marca ninguém; depois os marcadores (do lado do gol de quem marcam)
  for (const fase of [0, 1]) {
    for (const q of pr.papeis) {
      const marcador = q.papel === 'marca' || (q.papel === 'borda' && q.marca >= 0);
      if ((fase === 1) !== marcador) continue;
      const j = jogadorPorId(m, q.id);
      if (!j) continue;
      if (marcador) {
        const a = jogadorPorId(m, q.marca);
        if (a) pontoMarcador(m, t, a, _pe); else pontoEscanteio(m, t, sz, q.u || ESCANTEIO.borda.u, q.w, _pe);
      } else if (q.papel === 'atacaZona') pontoEscanteio(m, t, sz, q.su, q.sw, _pe);
      else pontoEscanteio(m, t, sz, q.u, q.w, _pe);
      const p = livre(_pe.x, _pe.z);
      teleportar(j, p.x, p.z, MD.atan2(pr.z - p.z, pr.x - p.x));
    }
  }
  // goleiro de quem defende: no gol, um pouco para o 1º pau, de frente para a bola
  const gk = m.jogadores.find(o => o.time !== t && o.posicao === 'GOL');
  if (gk) { const gx = lado * (CAMPO.meioX - 0.6), gz = sz * 0.8; teleportar(gk, gx, gz, MD.atan2(pr.z - gz, pr.x - gx)); }
  const Z = ESCANTEIO.zonaIA;
  let r = uniforme(m.rng) * Z.reduce((a, q) => a + q, 0);
  pr.zonaIA = Z.length - 1;
  for (let i = 0; i < Z.length; i++) { if (r < Z[i]) { pr.zonaIA = i; break; } r -= Z[i]; }
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, c, levado);
  m.eventos.push({ tipo: 'escanteio', time: t, lado: sz, id: c.id, levado }, { tipo: 'corteBolaParada', parada: 'escanteio' });
}
const _pe = { x: 0, z: 0 };

/**
 * Pênalti (Regra 14): a bola na marca; cobra a melhor finalização do time (fora o goleiro); o goleiro de quem defende
 * na linha do gol, no meio; todos os outros fora da área e da meia-lua (a 9,15 m da marca), atrás da bola —
 * levados à beira da área (corte de câmera, como a TV faz). O goleiro de quem cobra fica onde está.
 */
function montarPenalti(m) {
  const pr = m.parada;
  const t = pr.time, lado = m.ataca[t];
  let c = null, mel = -Infinity;
  for (const o of m.jogadores) {
    if (o.time !== t || o.posicao === 'GOL') continue;
    const v = o.par.attr.finalizacao * 100 - (o.vagaIdx ?? 0);
    if (v > mel) { mel = v; c = o; }
  }
  if (!c) { montarBolaParada(m); return; }
  limparAcoes(m);
  const gx = lado * CAMPO.meioX;
  // goleiro de quem defende: na linha, no meio, de frente para a bola
  const gk = m.jogadores.find(o => o.time !== t && o.posicao === 'GOL');
  if (gk) teleportar(gk, gx - lado * 0.3, 0, lado > 0 ? Math.PI : 0);
  // os outros (fora o goleiro de quem cobra): na beira da área (meia-lua no meio), alternando os times
  const outros = m.jogadores.filter(o => o !== c && o !== gk && !(o.time === t && o.posicao === 'GOL'));
  const porVaga = (a, b) => (a.vagaIdx ?? 0) - (b.vagaIdx ?? 0);
  const ataque = outros.filter(o => o.time === t).sort(porVaga), defesa = outros.filter(o => o.time !== t).sort(porVaga);
  const fila = [];
  while (ataque.length || defesa.length) { if (defesa.length) fila.push(defesa.shift()); if (ataque.length) fila.push(ataque.shift()); }
  fila.forEach((o, i) => {
    const k = i - (fila.length - 1) / 2;
    const z = clamp(k * 2.2, -CAMPO.meioZ + 2, CAMPO.meioZ - 2);
    const recuo = Math.abs(z) < 8 ? CAMPO.marcaPenalti + PARTIDA.raio.penalti + 1.2 : CAMPO.area.profundidade + 1.2 + (Math.abs(k) % 2) * 1.6;
    teleportar(o, gx - lado * recuo, z, lado > 0 ? 0 : Math.PI);
  });
  const levado = cobradorNoPonto(m, c, pr.x, pr.z, lado > 0 ? 0 : Math.PI);
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, c, levado);
  // a escolha da IA (canto e força), sorteada uma vez na montagem (alvoCobranca é pura)
  const W = PARTIDA.penaltiIA;
  let r = uniforme(m.rng) * W.mira.reduce((a, q) => a + q[1], 0);
  pr.miraZ = W.mira[W.mira.length - 1][0];
  for (const [z, w] of W.mira) { if (r < w) { pr.miraZ = z; break; } r -= w; }
  pr.forca = lerp(W.forca[0], W.forca[1], uniforme(m.rng));
  // o goleiro escolhe o lado antes do chute (o humano troca pelo analógico na hora da cobrança: rolou)
  if (gk) {
    const G = GOLEIRO.penalti.palpite;
    let q = uniforme(m.rng) * G.reduce((a, x) => a + x[1], 0);
    gk.palpite = G[G.length - 1][0];
    for (const [z, w] of G) { if (q < w) { gk.palpite = z; break; } q -= w; }
    pr.palpite = gk.palpite;
  }
  m.eventos.push({ tipo: 'cobrancaPenalti', time: t, id: c.id, levado });
}

/**
 * Tiro de meta (IFAB Regra 16): a bola parada no chão dentro da pequena área (do lado em que saiu, a até
 * TIRO_DE_META.z m do meio), o goleiro cobra com o pé como qualquer bola parada; adversários fora da área até a bola
 * rolar, companheiros podem receber dentro dela. A IA sorteia na montagem se vai sair curto (TIRO_DE_META.curta, para
 * um zagueiro aberto e livre) ou longo.
 */
function montarTiroDeMeta(m) {
  const pr = m.parada;
  const t = pr.time;
  let g = null;
  for (const o of m.jogadores) if (o.time === t && o.posicao === 'GOL') { g = o; break; }
  if (!g) { montarBolaParada(m); return; }
  limparAcoes(m);
  const s = -m.ataca[t];                    // lado do gol do time (x = s · 52,5)
  const x = s * (CAMPO.meioX - CAMPO.pequenaArea.profundidade + TIRO_DE_META.dentro);
  const z = (pr.z >= 0 ? 1 : -1) * Math.min(Math.abs(pr.z), TIRO_DE_META.z);
  pr.x = x; pr.z = z;
  const levado = cobradorNoPonto(m, g, x, z, MD.atan2(-z * 0.3, -s));
  // Regra 16: só o time que cobra fica na área. Quem é do outro time e está dentro vai para fora já na montagem (com
  // corte de câmera, como no escanteio) — antes eles saíam andando pela parede e o humano cobrava com eles na área
  let tirou = false;
  for (const o of m.jogadores) {
    if (o.time === t) continue;
    restricaoParada(m, o, o.x, o.z, _r);
    if (MD.hypot(_r.x - o.x, _r.z - o.z) <= 0.05) continue;
    teleportar(o, _r.x, _r.z, MD.atan2(z - _r.z, x - _r.x));
    tirou = true;
  }
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  fecharMontagem(m, g, levado);
  pr.curta = uniforme(m.rng) < TIRO_DE_META.curta;
  m.eventos.push({ tipo: 'tiroDeMeta', time: t, id: g.id, levado });
  if (tirou) m.eventos.push({ tipo: 'corteBolaParada', parada: 'tiroDeMeta' });
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
  if (p.tipo === 'penalti') return restricaoPenalti(m, p, j, out);
  if (p.tipo === 'saida') {
    const lado = m.ataca[j.time];
    if (out.x * lado > -0.3) out.x = -0.3 * lado;   // cada um no seu campo
    if (j.time === p.time) return out;
  } else if (j.time === p.time) return p.barreira && p.barreira.n >= 3 ? foraDaBarreira(p.barreira, out) : out;
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

/** Atacante a ≥ BARREIRA.ataque m do corpo de cada um da barreira (Regra 13): sai pelo lado mais perto. */
function foraDaBarreira(br, out) {
  const r = BARREIRA.ataque + 2 * BARREIRA.corpo + PARTIDA.folgaRaio * 0.4;
  for (let it = 0; it < 2; it++) {
    for (const q of br.pontos) {
      const dx = out.x - q.x, dz = out.z - q.z, d = MD.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-6) { out.x = q.x - r; continue; }
      out.x = q.x + dx * r / d; out.z = q.z + dz * r / d;
    }
  }
  return out;
}

/**
 * Pênalti (Regra 14.1): todos — dos dois times — fora da área, a ≥ 9,15 m da marca (a meia-lua) e atrás da linha da
 * bola, menos o cobrador e o goleiro de quem defende (este na linha do gol, entre as traves).
 */
function restricaoPenalti(m, p, j, out) {
  const lado = m.ataca[p.time], gx = lado * CAMPO.meioX;
  if (j.time !== p.time && j.posicao === 'GOL') {
    out.x = gx - lado * clamp((gx - out.x) * lado, 0, 0.6);
    out.z = clamp(out.z, -CAMPO.gol.largura / 2 + 0.3, CAMPO.gol.largura / 2 - 0.3);
    return out;
  }
  const folga = PARTIDA.folgaRaio;
  const prof = CAMPO.area.profundidade + folga, larg = CAMPO.area.largura / 2 + folga;
  const dx = (gx - out.x) * lado, dz = Math.abs(out.z);
  if (dx < prof && dz < larg) {
    if (prof - dx <= larg - dz) out.x = gx - lado * prof;
    else out.z = (out.z >= 0 ? 1 : -1) * larg;
  }
  const cx = out.x - p.x, cz = out.z - p.z, d = MD.hypot(cx, cz), r = PARTIDA.raio.penalti + folga;
  if (d < r) {
    if (d < 1e-6) { out.x = p.x - lado * r; } else { out.x = p.x + cx * r / d; out.z = p.z + cz * r / d; }
    if ((out.x - p.x) * lado > -0.3) { out.x = p.x - lado * r; out.z = p.z; } // atrás da linha da bola
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
  // pênalti: a área atacada (k = 1) e a meia-lua (k = 2) para todos, menos o goleiro de quem defende (o da linha)
  if (p.tipo === 'penalti') {
    if (j.time !== p.time && j.posicao === 'GOL') return false;
    if (k === 1) return bordaArea(m.ataca[p.time], x, z);
    const dx = x - p.x, dz = z - p.z, dd = MD.hypot(dx, dz);
    _b.d = dd - (PARTIDA.raio.penalti + folga);
    if (dd < 1e-6) { _b.nx = -m.ataca[p.time]; _b.nz = 0; } else { _b.nx = dx / dd; _b.nz = dz / dd; }
    return true;
  }
  if (k === 2) return false;
  if (j.time === p.time) return false;
  if (p.raio === 'area') return bordaArea(-m.ataca[p.time], x, z);
  const dx = x - p.x, dz = z - p.z, dd = MD.hypot(dx, dz);
  _b.d = dd - (p.raio + folga);
  if (dd < 1e-6) { _b.nx = -m.ataca[p.time]; _b.nz = 0; } else { _b.nx = dx / dd; _b.nz = dz / dd; }
  return true;
}

/** Borda da área do gol em x = s · 52,5 vista de (x, z) (escreve em _b; como bordaParada). */
function bordaArea(s, x, z) {
  const folga = PARTIDA.folgaRaio;
  {
    const gx = s * CAMPO.meioX;
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
 *    antes dela com PARTIDA.freioParede m/s²): ninguém entra, e quem corre para a borda freia;
 *  - o CORPO indo para dentro (trombada perto da borda, ou chegando embalado quando a bola morre) — fora,
 *    mais depressa do que nem a freada normal (JOGADOR.freio) para antes da borda; dentro, ainda entrando:
 *    o pedido vira a velocidade do CORPO refletida na borda (a componente para dentro vira para fora, a de
 *    lado fica; dentro, para fora pelo menos a velocidade de saída). A locomoção então freia a entrada pela
 *    aceleração lateral (até JOGADOR.latCorte) e pela freada. Antes a parede só limitava o PEDIDO: o corpo
 *    correndo de lado com a velocidade para dentro da trombada a perdia só pela aceleração lateral (e a
 *    aceleração ao longo do pedido de lado ainda a aumentava); já dentro, o "sai pelo caminho mais curto"
 *    virava inversão (freia tudo na linha, a componente para dentro quase inteira) — passava a folga e o
 *    raio (teste-partida C e F: o lateral empurrado por um companheiro a 0,4 m da meia-lua do pênalti; o
 *    ponta embalado no ponto do lateral).
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
    const nx = ox / od, nz = oz / od, vN = j.vx * nx + j.vz * nz; // vN < 0: o corpo ainda está entrando
    if (vN >= 0) return { dx: nx, dz: nz, vel, rumoAlvo: mv.rumoAlvo };
    // ainda entrando: a velocidade do corpo refletida (a de lado fica; para fora, pelo menos `vel`)
    const sai = Math.max(vel, -vN) - vN;
    const wx = j.vx + sai * nx, wz = j.vz + sai * nz, w = MD.hypot(wx, wz);
    return { dx: wx / w, dz: wz / w, vel: w, rumoAlvo: mv.rumoAlvo };
  }
  // fora: tira do pedido a velocidade para dentro que não daria para frear antes da borda
  let wx = mv.dx * mv.vel, wz = mv.dz * mv.vel, mudou = false;
  for (let k = 0; k < 3; k++) {
    if (!bordaParada(m, p, j, j.x, j.z, k)) continue;
    // o CORPO (não o pedido) vem para dentro mais depressa do que a freada normal para antes da borda:
    // o pedido é a velocidade dele refletida na borda (freada de emergência pela locomoção)
    const vCorpo = -(j.vx * _b.nx + j.vz * _b.nz);
    if (vCorpo > Math.sqrt(2 * JOGADOR.freio * Math.max(0, _b.d))) {
      wx = j.vx + 2 * vCorpo * _b.nx; wz = j.vz + 2 * vCorpo * _b.nz; mudou = true;
      continue;
    }
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
  // saída curta do tiro de meta: o goleiro espera os zagueiros abrirem (até TIRO_DE_META.esperaMax s da bola morta)
  if (pr.tipo === 'tiroDeMeta' && pr.curta && m.tick - pr.inicio < seg(TIRO_DE_META.esperaMax) && !zagueirosAbertos(m, pr.time)) return false;
  return zonaLivre(m) || m.tick - pr.inicio >= seg(PARTIDA.paradaMax - PARTIDA.livreAte);
}

const _za = { x: 0, z: 0, correr: false };
/** Os zagueiros do time `t` já estão nos lugares da saída curta (a ≤ TIRO_DE_META.chegou m)? */
function zagueirosAbertos(m, t) {
  for (const o of m.jogadores) {
    if (o.time !== t || o.posDetalhe !== 'ZAG') continue;
    const a = alvoBolaParada(m, o, _za);
    if (a && MD.hypot(a.x - o.x, a.z - o.z) > TIRO_DE_META.chegou) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------- cobrança

/**
 * Alvo da cobrança para a IA (pura): {dx, dz (direção, unitária), tipo, forca, para (id | null)}.
 *  saída: o companheiro mais perto atrás da bola (toque curto para trás);
 *  lateral: o companheiro de linha a 6–30 m com a linha de passe mais livre (riscoLinha), um pouco à
 *    frente de preferência; sem ninguém livre, lançamento ao longo da linha;
 *  escanteio: cruzamento (lançamento; acoes.js escolhe a zona pelo companheiro mais perto dela);
 *  tiro livre (indireto, do impedimento): como o lateral, sem passar para quem está impedido; sem ninguém livre,
 *    lançamento para a frente.
 */
const _li = { u: 0, x: 0, defensor: null };
const _al = { x: 0, z: 0 }, _ops = [];
const COS_LONGO = MD.cos(35 * Math.PI / 180);
/**
 * Direção (dx, dz) que, pela conta da mira do chute do acoes.js (lat × meio gol × 1,4), põe a bola em z = zm (m do
 * meio do gol, no referencial de quem ataca: + = à direita de quem chuta para o gol).
 */
function dirParaZ(b, lado, zm) {
  const gx = lado * CAMPO.meioX;
  const a = MD.atan2(-b.z, gx - b.x) + MD.asin(clamp(zm / (CAMPO.gol.largura / 2 * 1.4), -0.99, 0.99));
  return { dx: MD.cos(a), dz: MD.sin(a) };
}
export function alvoCobranca(m, j, tipo = m.parada?.tipo) {
  const b = m.bola.p;
  const lado = ataca(m, j.time);
  const F = PARTIDA.forcaCobranca;
  if (tipo === 'escanteio') {
    // a zona sorteada na montagem pelo setor do analógico do cruzamento (acoes.js: + = para a linha de fundo = 1º pau;
    // 0 = atravessado = 2º pau; − = para trás = marca do pênalti)
    const zi = m.parada?.zonaIA;
    if (zi != null) {
      const phi = [0.8, 0, -0.8][zi] ?? 0, sz = b.z >= 0 ? 1 : -1;
      return { dx: MD.sin(phi) * lado, dz: -MD.cos(phi) * sz, tipo: 'lancamento', forca: F.escanteio, para: null };
    }
    const tx = lado * (CAMPO.meioX - CAMPO.marcaPenalti) - b.x, tz = -b.z, l = MD.hypot(tx, tz) || 1;
    return { dx: tx / l, dz: tz / l, tipo: 'lancamento', forca: F.escanteio, para: null };
  }
  const pr = m.parada;
  // lateral (Regra 15): a opção sorteada na montagem (lateral.js opcoesLateral) ou o arremesso longo na área
  if (tipo === 'lateral' && pr) {
    if (pr.longa) {
      alvoLongoNaArea(m, j, _al);
      let para = null, dm = Infinity;
      for (const o of m.jogadores) {
        if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
        const d = MD.hypot(o.x - _al.x, o.z - _al.z);
        if (d < dm) { dm = d; para = o; }
      }
      const tx = _al.x - b.x, tz = _al.z - b.z, l = MD.hypot(tx, tz) || 1;
      return { dx: tx / l, dz: tz / l, tipo: 'lancamento', forca: 1, para: para ? para.id : null, longo: { x: _al.x, z: _al.z } };
    }
    const ops = opcoesLateral(m, j, _ops);
    if (ops.length) {
      const o = ops[Math.min(pr.opcaoIA ?? 0, ops.length - 1)];
      const ox = o.x - b.x, oz = o.z - b.z, l = MD.hypot(ox, oz) || 1;
      return { dx: ox / l, dz: oz / l, tipo: 'passe', forca: F.lateral, para: o.id };
    }
  }
  // tiro de meta (Regra 16): curto para o zagueiro aberto e livre (sorteado na montagem: pr.curta), senão longo para o
  // companheiro mais adiantado (no tiro de meta não há impedimento)
  if (tipo === 'tiroDeMeta') {
    if (pr && pr.curta) {
      let mel = null, ms = Infinity;
      for (const o of m.jogadores) {
        if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL' || o.papel === 'parado') continue;
        const d = MD.hypot(o.x - b.x, o.z - b.z);
        if (d < 6 || d > 32) continue;
        let dAdv = Infinity;
        for (const q of m.jogadores) if (q.time !== j.time) dAdv = Math.min(dAdv, MD.hypot(q.x - o.x, q.z - o.z));
        if (dAdv < TIRO_DE_META.curtoLivre) continue;
        const sc = 20 * riscoLinha(m, j, b.x, b.z, o.x, o.z, 12) + 0.2 * d - (o.posDetalhe === 'ZAG' ? 3 : 0);
        if (sc < ms || (sc === ms && o.id < mel.id)) { ms = sc; mel = o; }
      }
      if (mel && ms < 8) {
        const ox = mel.x - b.x, oz = mel.z - b.z, l = MD.hypot(ox, oz) || 1;
        return { dx: ox / l, dz: oz / l, tipo: 'passe', forca: F.saida, para: mel.id };
      }
    }
    let mel = null, mu = -Infinity;
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
      const u = o.x * lado;
      if (u > mu || (u === mu && o.id < mel.id)) { mu = u; mel = o; }
    }
    if (mel) {
      const ox = mel.x - b.x, oz = mel.z - b.z, l = MD.hypot(ox, oz) || 1;
      return { dx: ox / l, dz: oz / l, tipo: 'lancamento', forca: F.tiroDeMetaLongo, para: mel.id };
    }
    return { dx: lado, dz: 0, tipo: 'lancamento', forca: F.tiroDeMetaLongo, para: null };
  }
  // pênalti: o canto sorteado na montagem (pr.miraZ, m do meio do gol) e a força
  if (tipo === 'penalti' && pr) return { ...dirParaZ(b, lado, pr.miraZ ?? 2.75), tipo: 'chute', forca: pr.forca ?? 0.8, para: null };
  // tiro livre DIRETO perto do gol: chute no canto longe do goleiro
  if (tipo === 'tiroLivre' && pr && pr.direto) {
    const gx = lado * CAMPO.meioX, dGol = MD.hypot(gx - b.x, b.z);
    if (dGol <= PARTIDA.tiroLivreDireto.chuteMax && Math.abs(b.z) < CAMPO.area.largura / 2) {
      let gz = 0;
      for (const o of m.jogadores) if (o.time !== j.time && o.posicao === 'GOL') { gz = o.z * lado; break; }
      const T = PARTIDA.tiroLivreDireto;
      return { ...dirParaZ(b, lado, gz > 0 ? -2.6 : 2.6), tipo: 'chute', forca: lerp(T.forca[0], T.forca[1], clamp((dGol - 16) / 14, 0, 1)), para: null };
    }
  }
  let mel = null, ms = Infinity;
  if (tipo === 'tiroLivre') linhaImpedimento(m, j.time, _li);
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL' || o.papel === 'parado') continue;
    if (tipo === 'tiroLivre' && emPosicaoDeImpedimento(m, o, _li.u)) continue;
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
    return { dx: ox / l, dz: oz / l, tipo: 'passe', forca: tipo === 'saida' ? F.saida : tipo === 'tiroLivre' ? F.tiroLivre : F.lateral, para: mel.id };
  }
  if (tipo === 'saida') return { dx: -lado, dz: 0, tipo: 'passe', forca: F.saida, para: null };
  // tiro livre (indireto) sem ninguém livre: lançamento para a frente, para o meio do campo
  if (tipo === 'tiroLivre') {
    const dz = clamp(-b.z / 30, -0.4, 0.4), l = MD.hypot(1, dz);
    return { dx: lado / l, dz: dz / l, tipo: 'lancamento', forca: F.tiroLivreLongo, para: null };
  }
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
  if (!pr || pr.rolou || pr.cobrador !== j.id) return { x: 0, z: 0, botoes: 0 };
  const a = alvoCobranca(m, j, pr.tipo);
  const t0 = pr.pronta + pr.atraso;
  if (!iaPodeCobrar(m)) return { x: a.dx, z: a.dz, botoes: 0 };
  const k = Math.max(2, Math.round(a.forca * ACOES.cargaCheia / PASSO));
  const fase = (m.tick - t0) % seg(PARTIDA.repeteCobranca);
  return { x: a.dx, z: a.dz, botoes: fase < k ? BOTAO_ACAO[a.tipo] : 0 };
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
  const c = jogadorPorId(m, pr.cobrador);
  if (!c || c.papel !== 'parado') return false;
  // parado com a bola no pé: a condução não "ajeita" a bola (ela fica no ponto até a cobrança)
  if (c.cond) { c.cond.toque = null; c.cond.busca = false; }
  // lateral: no meio do arco do arremesso, a bola sai das mãos na hora da soltura
  if (pr.tipo === 'lateral' && pr.arremesso) {
    if (m.tick < pr.arremesso.solta) return false;
    return soltarLateral(m, c);
  }
  const humano = m.humanos.includes(c.time) && m.controlado[c.time] === c.id;
  const iaAssume = !humano || m.tick - pr.inicio >= seg(PARTIDA.cobrancaHumanoMax);
  if (iaAssume) {
    if (!iaPodeCobrar(m)) { c.pedido = null; c.carga = null; return false; }
    const a = alvoCobranca(m, c, pr.tipo);
    c.carga = null;
    c.pedido = { tipo: a.tipo, forca: a.forca, mod: a.tipo === 'chute' && !!pr.direto, tick: m.tick, dir: { x: a.dx, z: a.dz } };
  } else {
    const e = m.tick >= pr.pronta ? entrada : { x: entrada?.x ?? 0, z: entrada?.z ?? 0, botoes: 0 };
    aplicarEntrada(c, e, m.tick);
    c.pedidoPedalada = false; // parado não pedala (o pedido ficaria para depois da cobrança)
    atualizarBotoesAcao(m, c);
    // bola parada não é chutada a gol — menos o pênalti e o tiro livre direto
    if (c.pedido && c.pedido.tipo === 'chute' && pr.tipo !== 'penalti' && !(pr.tipo === 'tiroLivre' && pr.direto)) c.pedido = null;
    // tiro de meta (Regra 16): o humano só cobra com a área livre de adversários (o pedido espera)
    if (c.pedido && pr.tipo === 'tiroDeMeta' && !zonaLivre(m)) return false;
  }
  if (!c.pedido) return false;
  if (pr.tipo === 'lateral') return comecarArremesso(m, c, iaAssume);
  if (pr.tipo === 'penalti') c.pedido.penalti = true; // a pressão da cobrança (acoes.js: erro do chute)
  // tiro livre com barreira: o chute (da IA e do humano) busca passar por cima dela (acoes.js chute)
  if (pr.barreira && pr.barreira.n > 0 && c.pedido.tipo === 'chute') c.pedido.barreira = { dist: pr.barreira.dist, altura: BARREIRA.alturaPassar };
  const ok = executarAcao(m, c, c.par.attr.pePreferido ?? 1, false);
  c.miraAuto = null; // a direção da cobrança não vale para o próximo passe dele
  if (!ok) return false;
  rolou(m);
  return true;
}

/**
 * Lateral: o pedido do cobrador (PASSE, ENFIADA ou LANÇAMENTO) começa o arco do arremesso (LATERAL.tempo s; a bola
 * anda nas mãos por lateral.js segurarLateral). O alvo é a opção da IA (alvoCobranca) ou a mirada pelo analógico do
 * humano (lateral.js opcaoMirada); o LANÇAMENTO do humano sem opção vai na direção do analógico, no máximo.
 */
function comecarArremesso(m, c, ia) {
  const pr = m.parada, p = c.pedido;
  c.pedido = null; c.carga = null;
  if (p.tipo === 'chute') return false; // lateral não é chutado
  let para = null, longo = null;
  if (ia) {
    const a = alvoCobranca(m, c, 'lateral');
    para = a.para; longo = a.longo ?? null;
  } else {
    // LANÇAMENTO com o analógico longe de todas as opções (> 35°): o arremesso longo vai na direção dele
    const ops = opcoesLateral(m, c, _ops);
    const k = opcaoMirada(m, c, ops, p.tipo === 'lancamento' ? COS_LONGO : -2);
    if (k >= 0) para = ops[k].id;
  }
  const dir = p.dir ?? (c.imag > 0.3 ? { x: c.ix, z: c.iz } : { x: MD.cos(c.rumo), z: MD.sin(c.rumo) });
  pr.arremesso = { tick0: m.tick, solta: m.tick + seg(LATERAL.tempo), tipo: p.tipo, forca: p.forca, para, longo, dx: dir.x, dz: dir.z };
  m.eventos.push({ tipo: 'arremesso', id: c.id, para });
  return false;
}

/** Fim do arco do arremesso: a bola sai das mãos (acoes.js arremessoLateral) e a parada acaba. */
function soltarLateral(m, c) {
  const pr = m.parada, a = pr.arremesso;
  segurarLateral(m); // a bola no ponto da soltura
  const r = a.para != null ? jogadorPorId(m, a.para) : null;
  const ok = arremessoLateral(m, c, { tipo: a.tipo, forca: a.forca, dir: { x: a.dx, z: a.dz } }, r, r ? null : a.longo, vMaxArremesso(c));
  c.arremesso = { tick: m.tick, rumo: c.rumo }; // os braços seguem o arremesso (só desenho: anim.js)
  if (!ok) return false;
  rolou(m);
  return true;
}

/** A bola rolou: fim da parada (o cobrador volta a se mexer), evento `cobranca`. */
function rolou(m) {
  const pr = m.parada;
  pr.rolou = true;
  if (m.voo) m.voo.bolaParada = pr.tipo; // a bola que sai da cobrança (a disputa pelo alto vale nela: sim.js)
  m.eventos.push({ tipo: 'cobranca', parada: pr.tipo, id: pr.cobrador });
  if (pr.barreira) desfazerBarreira(m, pr);
  if (pr.tipo === 'escanteio' && pr.papeis) m.partida.bp = { tipo: 'escanteio', time: pr.time, sz: pr.sz, papeis: pr.papeis, tick: m.tick };
  if (pr.tipo === 'penalti') {
    m.partida.penaltiAberto = { tick: m.tick, time: pr.time, id: pr.cobrador };
    // goleiro do humano: o lado é o do analógico na hora do chute (solto: fica no meio)
    const gk = m.jogadores.find(o => o.time !== pr.time && o.posicao === 'GOL');
    if (gk && m.humanos.includes(gk.time) && m.controlado[gk.time] === gk.id) {
      gk.palpite = gk.imag > 0.3 ? (gk.iz >= 0 ? 1 : -1) * GOLEIRO.penalti.palpite[GOLEIRO.penalti.palpite.length - 1][0] : 0;
    }
  }
  encerrarParada(m);
  m.golTick = null; m.foraDesde = null;
  m.partida.estado = 'jogo'; m.partida.desde = m.tick;
}

// ----------------------------------------------------------------------------- relógio e regras

/** Minuto mostrado no placar (0–90): tempo real × 45 / minutosPorTempo, por tempo (nos acréscimos fica em 45/90). */
export function minutoDeJogo(m) {
  const p = m.partida;
  if (!p) return 0;
  if (p.estado === 'fim') return 90;
  if (p.estado === 'intervalo') return 45;
  const f = Math.min(1, (m.tick - p.tick0Tempo) / p.ticksPorTempo);
  return (p.tempo - 1) * 45 + Math.floor(f * 45);
}

/** Ticks de acréscimo do tempo atual (0 antes do anúncio). */
function ticksAcrescimo(p) {
  return p.acrescimo ? Math.round(p.acrescimo * p.ticksPorTempo / 45) : 0;
}

/**
 * Acréscimos no placar: {anunciado (min), decorrido (min inteiros já jogados nele)} depois do anúncio, com a bola
 * rolando ou parada no tempo; null antes dele, no intervalo e no fim.
 */
export function acrescimoDeJogo(m) {
  const p = m.partida;
  if (!p || p.acrescimo == null || p.estado === 'intervalo' || p.estado === 'fim') return null;
  const alem = m.tick - p.tick0Tempo - p.ticksPorTempo;
  if (alem < 0) return null;
  return { anunciado: p.acrescimo, decorrido: Math.min(p.acrescimo, Math.floor(alem * 45 / p.ticksPorTempo)) };
}

/** Fim do tempo regulamentar: anuncia os acréscimos (IFAB Regra 7.3; PARTIDA.acrescimos), evento 'acrescimo'. */
function anunciarAcrescimo(m) {
  const p = m.partida, A = PARTIDA.acrescimos, t = p.tempo, c = p.contagem;
  const [b0, b1] = A.base[t] ?? A.base[2];
  const total = lerp(b0, b1, uniforme(m.rng)) + A.porGol * c.gols + A.porSubstituicao * c.subs + A.porImpedimento * c.imped;
  p.acrescimo = clamp(Math.round(total), 1, A.max[t] ?? A.max[2]);
  m.eventos.push({ tipo: 'acrescimo', tempo: t, minutos: p.acrescimo });
}

function fimDoTempo(m) {
  const p = m.partida;
  encerrarParada(m);
  m.golTick = null; m.foraDesde = null;
  p.imped = null;
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

/**
 * Impedimento marcado (Regra 11.4): evento 'impedimento', a linha do lance guardada para o desenho e tiro livre
 * INDIRETO do outro time no ponto em que o impedido tocou a bola (dentro do campo).
 */
function marcarImpedimento(m, off) {
  const p = m.partida;
  // tickFoto: o passo da jogada do companheiro (a foto da Regra 11) — o quadro que o replay congela com a linha;
  // defensor: o id de quem fazia a linha nesse passo (null: a bola ou o meio) — a parede da cena semiautomática (o
  // hash não lê os eventos)
  m.eventos.push({ tipo: 'impedimento', id: off.id, time: off.time, x: off.x, z: off.z, linhaX: off.linhaX, por: off.por, tickFoto: off.tick, defensor: off.defensor ?? null });
  p.ultimoImped = { tick: m.tick, linhaX: off.linhaX, id: off.id, time: off.time, x: off.x, z: off.z };
  p.contagem.imped++;
  const x = clamp(off.x, -CAMPO.meioX + 1, CAMPO.meioX - 1), z = clamp(off.z, -CAMPO.meioZ + 1, CAMPO.meioZ - 1);
  bolaMorta(m, 'tiroLivre', 1 - off.time, x, z);
  p.estado = 'parada'; p.desde = m.tick;
}

// ------------------------------------------------------------------------- faltas e cartões (Regra 12)

/**
 * Cartão para `id` (agora): evento `cartao {id, time, cor, motivo, segundo}`; o 2º amarelo vira vermelho; vermelho =
 * expulsão. Guarda o último cartão (para o ícone do desenho).
 */
function aplicarCartao(m, id, cor, motivo) {
  const p = m.partida;
  const j = jogadorPorId(m, id);
  if (!j || p.expulsos.includes(id)) return;
  p.contagem.cartoes++;
  if (cor === 'amarelo') {
    p.cartoes[id] = (p.cartoes[id] ?? 0) + 1;
    const segundo = p.cartoes[id] >= 2;
    m.eventos.push({ tipo: 'cartao', id, time: j.time, cor: 'amarelo', motivo, segundo });
    p.ultimoCartao = { tick: m.tick, id, cor: segundo ? 'vermelho' : 'amarelo', x: j.x, z: j.z };
    if (segundo) { m.eventos.push({ tipo: 'cartao', id, time: j.time, cor: 'vermelho', motivo: 'segundoAmarelo', segundo: true }); expulsar(m, j); }
    return;
  }
  m.eventos.push({ tipo: 'cartao', id, time: j.time, cor: 'vermelho', motivo, segundo: false });
  p.ultimoCartao = { tick: m.tick, id, cor: 'vermelho', x: j.x, z: j.z };
  expulsar(m, j);
}

/** Os cartões guardados (vantagem, recomeço) saem na parada. */
function aplicarCartoesPendentes(m) {
  const p = m.partida;
  if (!p || !p.cartoesPendentes.length) return;
  const lista = p.cartoesPendentes.splice(0);
  for (const c of lista) aplicarCartao(m, c.id, c.cor, c.motivo);
}

/**
 * Expulsão (Regra 12.4): o jogador sai de m.jogadores (vai para m.expulsos) e fica na vaga dele como um "buraco"
 * (m.times[t].expulsos; o time joga com um a menos e ele não pode ser substituído — Regra 3). Goleiro expulso: o de
 * linha mais perto do próprio gol vai para o gol (o buraco fica na vaga dele). Substituição pendente em que ele sai
 * é desfeita. A posse, a mão, o controle e a cobrança que eram dele passam adiante.
 */
function expulsar(m, j) {
  const p = m.partida, t = j.time, s = m.times[t];
  if (p.expulsos.includes(j.id)) return;
  p.expulsos.push(j.id);
  (s.expulsos ??= []).push(j.id);
  if (!s.saiu.includes(j.id)) s.saiu.push(j.id);
  const idx = m.jogadores.indexOf(j);
  if (idx >= 0) m.jogadores.splice(idx, 1);
  m.expulsos.push(j);
  if (m.posse === j.id) m.posse = null;
  if (m.naMao === j.id) { m.naMao = null; m.posse = null; }
  if (m.voo && m.voo.para === j.id) m.voo.para = null;
  if (m.parada && m.parada.cobrador === j.id) m.parada.cobrador = null;
  // a substituição pendente em que ele sai não acontece mais (a vaga volta a ser dele: o buraco)
  if (s.pendente) {
    const par = s.pendente.substituicoes.find(q => q.sai === j.id);
    if (par) {
      s.pendente.substituicoes = s.pendente.substituicoes.filter(q => q !== par);
      for (const k in s.pendente.vagas) if (s.pendente.vagas[k] === par.entra) s.pendente.vagas[k] = j.id;
      if (!s.pendente.substituicoes.length && Object.keys(s.vagas).every(k => s.vagas[k] === s.pendente.vagas[k])) s.pendente = null;
    }
  }
  // goleiro expulso: o de linha mais perto do próprio gol vai para o gol
  if (j.posicao === 'GOL') {
    const gx = -m.ataca[t] * CAMPO.meioX;
    let mel = null, dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t) continue;
      const d = MD.hypot(o.x - gx, o.z);
      if (d < dm) { dm = d; mel = o; }
    }
    if (mel) {
      const vGol = vagaDoJogador(s, j.id), vMel = vagaDoJogador(s, mel.id);
      if (vGol != null && vMel != null) { s.vagas[vGol] = mel.id; s.vagas[vMel] = j.id; vestirVaga(m, mel, vGol); }
    }
  }
  s.versao++;
  if (m.controlado[t] === j.id) {
    let mel = null, dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z);
      if (d < dm) { dm = d; mel = o; }
    }
    if (mel) { if (m.humanos.includes(t)) assumirControle(m, t, mel); else m.controlado[t] = mel.id; }
  }
}

/** Marca da cal do pênalti contra o time `t` (que defende): {x, z}. */
function marcaPenalti(m, t) {
  return { x: -m.ataca[t] * (CAMPO.meioX - CAMPO.marcaPenalti), z: 0 };
}

/**
 * A falta do passo (faltas.js; Regra 12): na área de quem fez → pênalti; o time que sofreu segue com a bola no ataque
 * → vantagem (FALTAS.vantagem s; o cartão sai na próxima parada — o de SPA some, o de DOGSO vira amarelo); senão apito:
 * tiro livre DIRETO de quem sofreu no ponto da falta, com o cartão. Devolve true se a bola parou.
 */
function decidirFalta(m, f) {
  const p = m.partida;
  p.contagem.faltas++;
  p.ultimaFalta = { tick: m.tick, x: f.x, z: f.z, time: f.time, cartao: f.cartao };
  const cartao = f.cartao ? { id: f.def, cor: f.cartao, motivo: f.motivo } : null;
  if (f.area) {
    if (cartao) p.cartoesPendentes.push(cartao);
    const mk = marcaPenalti(m, 1 - f.time);
    m.eventos.push({ tipo: 'apito', motivo: 'penalti' }, { tipo: 'penaltiMarcado', time: f.time, def: f.def, id: f.cond });
    bolaMorta(m, 'penalti', f.time, mk.x, mk.z);
    p.estado = 'parada'; p.desde = m.tick;
    return true;
  }
  // vantagem (Regra 12): só se ela é clara — quem sofreu segue com a bola no campo de ataque, indo para a frente; nunca
  // na falta tática (ela parou o ataque) nem na força excessiva
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
  const lado = m.ataca[f.time];
  if (dono && dono.time === f.time && m.bola.p.x * lado > 0 && dono.vx * lado >= FALTAS.vantagemVel && f.origem !== 'tatica' && f.grau !== 'excessivo') {
    const dado = cartao && f.motivo === 'spa' ? null : cartao && f.motivo === 'dogso' ? { ...cartao, cor: 'amarelo', motivo: 'dogsoVantagem' } : cartao;
    p.vantagem = { f, ate: m.tick + seg(FALTAS.vantagem), cartao, cartaoDado: dado };
    m.eventos.push({ tipo: 'vantagem', time: f.time, def: f.def, id: f.cond });
    return false;
  }
  apitarFalta(m, f, cartao);
  return true;
}

/** Apito da falta: tiro livre direto de quem sofreu no ponto (dentro do campo), com o cartão. */
function apitarFalta(m, f, cartao) {
  const p = m.partida;
  m.eventos.push({ tipo: 'apito', motivo: 'falta' });
  if (cartao) p.cartoesPendentes.push(cartao);
  const x = clamp(f.x, -CAMPO.meioX + 1, CAMPO.meioX - 1), z = clamp(f.z, -CAMPO.meioZ + 1, CAMPO.meioZ - 1);
  bolaMorta(m, 'tiroLivre', f.time, x, z);
  m.parada.direto = true;
  p.estado = 'parada'; p.desde = m.tick;
}

/**
 * Vantagem em andamento: o time que fez a falta pegou a bola dentro do prazo → volta à falta (apito, tiro livre e o
 * cartão original); passou o prazo → a vantagem valeu (o cartão dela fica para a próxima parada). True se parou.
 */
function resolverVantagem(m) {
  const p = m.partida, v = p.vantagem;
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : (m.naMao != null ? jogadorPorId(m, m.naMao) : null);
  if (dono && dono.time !== v.f.time && m.tick <= v.ate) {
    p.vantagem = null;
    m.eventos.push({ tipo: 'vantagemVolta', time: v.f.time });
    apitarFalta(m, v.f, v.cartao);
    return true;
  }
  if (m.tick > v.ate) {
    p.vantagem = null;
    if (v.cartaoDado) p.cartoesPendentes.push(v.cartaoDado);
  }
  return false;
}

/** Pênalti em aberto (depois da cobrança): gol, defesa ou fora — evento `penalti {time, id, resultado}`. */
function resolverPenalti(m) {
  const p = m.partida, a = p.penaltiAberto;
  if (!a) return;
  let res = null;
  for (const e of m.eventos) {
    if (e.tipo === 'gol') { res = e.time === a.time ? 'gol' : 'fora'; break; }
    if (e.tipo === 'defesa') { const g = jogadorPorId(m, e.id); if (g && g.time !== a.time) { res = 'defesa'; break; } }
    if (e.tipo === 'fora') { res = 'fora'; break; }
    if (e.tipo === 'bateuCorpo' && e.id !== a.id) { res = 'fora'; break; }
  }
  if (!res && m.tick - a.tick > seg(3)) res = 'fora';
  if (res) {
    m.eventos.push({ tipo: 'penalti', time: a.time, id: a.id, resultado: res });
    p.penaltiAberto = null;
    for (const o of m.jogadores) if (o.palpite != null) o.palpite = null;
  }
}

/** Regras da partida (depois do passo): relógio, gol, bola fora → recomeço, cobrança, intervalo e fim. */
export function regrasPartida(m) {
  const p = m.partida;
  atualizarUltimoToque(m);
  if (p.bp && !bolaParadaAtiva(m) && !(m.parada && !m.parada.rolou)) p.bp = null;
  if (p.penaltiAberto) resolverPenalti(m);
  if (p.estado === 'fim') return;
  if (p.estado === 'intervalo') {
    if (m.tick - p.desde < seg(PARTIDA.intervalo)) return;
    // 2º tempo: troca de lado e a saída é de quem não começou (substituição feita no intervalo vale já)
    m.ataca = { 0: -m.ataca[0], 1: -m.ataca[1] };
    aplicarPendentes(m, 0, { intervalo: true });
    aplicarPendentes(m, 1, { intervalo: true });
    for (const j of m.jogadores) vestirVaga(m, j, j.vagaId);
    p.tempo = 2; p.tick0Tempo = m.tick;
    p.acrescimo = null; p.contagem = { gols: 0, subs: 0, imped: 0, faltas: 0, cartoes: 0 };
    bolaMorta(m, 'saida', 1 - p.saidaInicial, 0, 0);
    montarSaida(m, 1 - p.saidaInicial);
    return;
  }
  // fim do tempo regulamentar: os acréscimos são anunciados; o tempo acaba depois deles
  const regular = m.tick - p.tick0Tempo >= p.ticksPorTempo;
  if (regular && p.acrescimo == null) anunciarAcrescimo(m);
  const acabou = regular && m.tick - p.tick0Tempo >= p.ticksPorTempo + ticksAcrescimo(p);
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
    p.contagem.gols++;
    p.estado = 'gol'; p.desde = m.golTick;
    bolaMorta(m, 'saida', 1 - p.golTime, 0, 0);
    m.parada.inicio = m.golTick;
    return;
  }
  // o relógio não para nas bolas paradas: acabou o tempo (com os acréscimos), acabou
  if (acabou) { fimDoTempo(m); return; }
  const pr = m.parada;
  if (p.estado === 'parada' && pr) {
    if (pr.cobrador == null) {
      // bola morta esperando a montagem
      if (m.tick - pr.inicio < seg(PARTIDA.foraEspera)) return;
      aplicarPendentes(m, 0); aplicarPendentes(m, 1);
      if (pr.tipo === 'tiroDeMeta') montarTiroDeMeta(m);
      else if (pr.tipo === 'penalti') montarPenalti(m);
      else montarBolaParada(m);
      return;
    }
    // montada: a bola rolou? (a cobrança sai em cobrar(), antes do passo; no lateral a bola está nas mãos do
    // cobrador e não "sai do ponto"). Trava proibida: passou de paradaMax, rola do jeito que está.
    const saiuDoPonto = pr.tipo !== 'lateral' && MD.hypot(m.bola.p.x - pr.x, m.bola.p.z - pr.z) > 0.6;
    if (m.posse !== pr.cobrador || m.voo || saiuDoPonto || m.tick - pr.inicio > seg(PARTIDA.paradaMax)) {
      rolou(m);
      regraImpedimento(m); // a foto da cobrança (do tiro de meta não há impedimento: zera)
      return;
    }
    // a bola fica no ponto até a cobrança (no lateral, nas mãos do cobrador)
    if (pr.tipo !== 'lateral') {
      const b = m.bola;
      b.p.x = pr.x; b.p.z = pr.z; b.p.y = BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
    }
    // a parede (ninguém entra no raio) é pela locomoção: paredeParada, no passo 2 do sim.js
    return;
  }
  // faltas (Regra 12): a do passo (vantagem, tiro livre direto ou pênalti) e a vantagem em andamento
  if (m.faltaPendente) { const f = m.faltaPendente; m.faltaPendente = null; if (decidirFalta(m, f)) return; }
  if (p.vantagem && resolverVantagem(m)) return;
  // impedimento (Regra 11): quem estava impedido na última jogada do companheiro tocou a bola
  const off = regraImpedimento(m);
  if (off) { marcarImpedimento(m, off); return; }
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
  m.faltaPendente = null;
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
  // substituições do tempo (contam nos acréscimos; as do intervalo não)
  if (m.partida.estado !== 'intervalo') for (const e of m.eventos) if (e.tipo === 'substituicao') m.partida.contagem.subs++;
  for (const e of depois) m.eventos.push(e);
  return m.eventos;
}

/** Demonstração/testes: a IA joga pelo controlado do time 0 (como o ?demo=1 do treino). */
export function entradaDemoPartida(m) {
  const j = jogadorPorId(m, m.controlado[0]);
  if (!j) return { x: 0, z: 0, botoes: 0 };
  const pr = m.parada;
  if (pr && !pr.rolou && pr.cobrador === j.id) return entradaCobranca(m, j);
  // ia: a IA joga pelo humano — recebe como a IA (sem a recepção assistida do controle humano, recepcao.js)
  const e = entradaIATatica(m, j);
  return { x: e.x, z: e.z, botoes: e.botoes, ia: true };
}

/** Mistura no hash o estado da partida (relógio, estado, último toque, parada). Só com m.times. */
export function misturarPartida(h, m) {
  const p = m.partida;
  if (!p) return h;
  for (const v of [ESTADOS.indexOf(p.estado), p.tempo, p.tick0Tempo, p.ticksPorTempo, p.saidaInicial, p.iaClassica ? 1 : 0, p.desde, p.ultimoTime ?? -1, p.ultimoId ?? -1, p.ultimoTick ?? -1, p.golTime ?? -1, m.golTick ?? -1, m.foraDesde ?? -1]) h = misturarHash(h, v);
  // Etapa 4: acréscimos e impedimento
  for (const v of [p.acrescimo ?? -1, p.contagem.gols, p.contagem.subs, p.contagem.imped, p.ultimoImped ? p.ultimoImped.tick : -1]) h = misturarHash(h, v);
  const im = p.imped;
  if (im) { h = misturarHash(h, im.time); h = misturarHash(h, im.tick); h = misturarHash(h, im.linhaX); for (const id of im.ids) h = misturarHash(h, id); }
  else h = misturarHash(h, -1);
  // faltas e cartões
  for (const v of [p.contagem.faltas, p.contagem.cartoes, p.vantagem ? p.vantagem.ate : -1, p.penaltiAberto ? p.penaltiAberto.tick : -1, p.cartoesPendentes.length]) h = misturarHash(h, v);
  h = misturarHash(h, p.bp ? p.bp.tick : -1);
  if (p.barreira) { h = misturarHash(h, p.barreira.tick); for (const id of p.barreira.bateu) h = misturarHash(h, id); } else h = misturarHash(h, -1);
  for (const id of Object.keys(p.cartoes).map(Number).sort((a, b) => a - b)) { h = misturarHash(h, id); h = misturarHash(h, p.cartoes[id]); }
  for (const id of p.expulsos) h = misturarHash(h, id);
  const pr = m.parada;
  if (!pr) return misturarHash(h, -1);
  for (const v of [TIPOS_PARADA.indexOf(pr.tipo), pr.time, pr.x, pr.z, pr.cobrador ?? -1, pr.inicio, pr.desde, pr.pronta, pr.atraso, pr.rolou ? 1 : 0, pr.raio === 'area' ? -2 : pr.raio, PAPEIS.indexOf(pr.papel), pr.levado]) h = misturarHash(h, v);
  for (const v of [pr.direto ? 1 : 0, pr.miraZ ?? -9, pr.forca ?? -1, pr.palpite ?? -9]) h = misturarHash(h, v);
  // lateral: a escolha da IA e o arremesso em andamento
  for (const v of [pr.opcaoIA ?? -1, pr.longa ? 1 : 0, pr.curta ? 1 : 0, pr.zonaIA ?? -1, pr.sz ?? 0]) h = misturarHash(h, v);
  if (pr.barreira) for (const id of pr.barreira.ids) h = misturarHash(h, id);
  if (pr.papeis) for (const q of pr.papeis) { h = misturarHash(h, q.id); h = misturarHash(h, PAPEIS_BP.indexOf(q.papel)); h = misturarHash(h, q.marca); }
  const ar = pr.arremesso;
  if (ar) for (const v of [ar.tick0, ar.solta, ar.para ?? -1, ar.forca, ar.dx, ar.dz]) h = misturarHash(h, v);
  return h;
}
