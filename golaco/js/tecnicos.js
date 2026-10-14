// Os dois TREINADORES (pedido do dono de 12/10: "quero a área técnica e o treinador"). PUROS: sem three.js nem DOM, sem
// rng fora do rng.js (os gestos saem de hash01(semente, id, bloco) — nunca Math.random) e sem escrever no mundo da partida:
// a página (main.js) dá um passo deles por passo da simulação, depois de LER o mundo (leituraDoMundo), e o hash não muda
// (tools/teste-tecnicos.mjs T10). Contrato em CONTRATOS.md ("Área técnica e treinadores"); constantes em config.js
// TECNICOS; pesquisa em PESQUISA-ESTADIO.md §11.
//
// Cada um anda SÓ pela locomoção do jogo num mundo à parte (como os árbitros do cortejo do pré-jogo: jogador.js
// passoCorpo, passoPassada e passoPeDesenhado; anim.js alturaQuadril e pose) — pé plantado não patina — dentro da ÁREA
// TÉCNICA dele (IFAB Regra 1; estadio-forma.js areaTecnica): o mandante no banco de x < 0, o visitante no de x > 0.
// Por cima da pose da locomoção (nesta ordem): o agachado (comemoracao.js poseAgachado), a TORÇÃO do tronco para o lado
// da bola (mola de TECNICOS.olhar.tronco s), a CABEÇA olhando a bola (até ±70° do tronco, com o comprimento do pescoço
// fixo) e os BRAÇOS por IK (os gestos da comemoração: maoEm; os ossos ficam com o comprimento certo), com a mão sempre
// fora da cabeça. Toda troca de gesto mistura os alvos das mãos em TECNICOS.mistura s (smoothstep).
//
// Onde ficam: em x, o centro do banco + 0,3·(bola.x − centro) (mola crítica de 1,5 s); em z, 36,2. RECUO (não tapar a TV):
// a bola prevista 1,5 s à frente perto da linha de cá, ou lateral/falta/escanteio do lado de cá perto dele → z 39,2 (de
// costas, ≤ 2 m/s). ESQUIVA: o caminho previsto da bola (rolagem exata de bola.js) a < 0,75 m no próximo 1 s → sai da
// linha dela (≤ 3 m/s); jogador previsto perto → afasta. Anda ≤ 1,4 m/s com ≤ 1,5 m/s².
//
// Estados (Smith & Cushion 2006: o silêncio é a maior categoria; Copa 2022: 2,03 gestos táticos/min × 0,73 emocionais):
// observa (posturas: braços cruzados, mãos na cintura, mão no queixo, mãos atrás das costas, agachado — raro), anda,
// instrui (na perda da posse, defendendo no próprio campo, bola parada a favor no ataque, lateral do lado dele; ≤ 1 a
// cada TECNICOS.instrui.intervalo s), aplaude, reclama, lamenta, COMEMORA (gol do time: a mão acima da cabeça em 0,25–
// 0,40 s), SOFREU (gol contra o time: mãos na cabeça em ≤ 0,6 s), intervalo e fim. Variantes sorteadas por hash, nunca o
// mesmo (gesto, variante) duas vezes seguidas.
//
// Contrato:
//   criarTecnicos(times, semente) → T;  criarLeitura() → L;  leituraDoMundo(m, eventos, L) (só lê);
//   passoTecnicos(T, L) (1 passo de 1/60 s);  poseTecnico(tec, out) (57 floats, o formato do anel);
//   afastarDeTecnicos(p, T|lista, dmin) (câmeras de cinema fora deles);  infoTecnicos(T) (testes);
//   treinadorDoTime(T, t) (o ator de cena do gancho das cenas) e kitTecnico(time).
import { PASSO, CAMPO, TECNICOS as TC } from './config.js';
import { criarJogador, passoCorpo, passoPassada, passoPeDesenhado } from './jogador.js';
import { pose, alturaQuadril, J, NJ, RAIO_CABECA, ikBraco } from './anim.js';
import { difAng, normAng } from './mat.js';
import { hash01 } from './rng.js';
import { maoEm, poseAgachado, G_SOCO, G_V, G_PUNHO, G_CINTURA, G_AVIAO } from './comemoracao.js';
import { areaTecnica } from './estadio-forma.js';
import { proxVelRolando, DT_BOLA } from './bola.js';

const MZ = CAMPO.meioZ, MX = CAMPO.meioX;
const s60 = s => Math.round(s / PASSO);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
const lerp = (a, b, t) => a + (b - a) * t;

export const IDS_TECNICOS = TC.ids;
export const ESTADOS = ['observa', 'instrui', 'aplaude', 'reclama', 'lamenta', 'comemora', 'sofreu', 'intervalo', 'fim', 'vamos'];
const PRIORIDADE = { observa: 0, instrui: 1, aplaude: 2, vamos: 2, reclama: 3, lamenta: 3, intervalo: 4, fim: 4, comemora: 5, sofreu: 5 };
// juntas do tronco para cima (giram com a torção em volta da pelve)
const TRONCO = [J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.cotoveloE, J.maoE, J.ombroD, J.cotoveloD, J.maoD];

// ------------------------------------------------------------------------------------------------ leitura do mundo
/** Objeto de leitura (um por página/teste, reaproveitado: nada é alocado por passo). */
export function criarLeitura() {
  const ev = [];
  for (let i = 0; i < 16; i++) ev.push({ tipo: '', time: -1, forca: 0 });
  return {
    tick: 0, estado: null, emJogo: false,
    bola: { x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0 },
    posseTime: null, ataca: [1, -1],
    parada: { ativa: false, tipo: '', time: -1, x: 0, z: 0 },
    placar: [0, 0],
    eventos: ev, nEventos: 0,
    perto: new Float64Array(4 * 30), nPerto: 0,     // jogadores perto das áreas técnicas: x, z, vx, vz
  };
}

function timeDeM(m, id) { if (id == null) return null; for (const j of m.jogadores) if (j.id === id) return j.time; return null; }

function evento(L, tipo, time, forca = 0) {
  if (L.nEventos >= L.eventos.length) return;
  const e = L.eventos[L.nEventos++];
  e.tipo = tipo; e.time = time; e.forca = forca;
}

/**
 * Lê o mundo da partida DEPOIS do passo (nada é escrito): a bola, a posse (em time), o lado que cada time ataca, a parada,
 * o placar, os eventos do passo que os treinadores olham (gol, chute/cabeceio, defesa, trave, fora, impedimento, falta,
 * cartão, pênalti marcado, roubada, intervalo, fim, saída) e os jogadores perto das áreas técnicas (z > 31).
 */
export function leituraDoMundo(m, eventos, L = criarLeitura()) {
  const p = m.partida;
  L.tick = m.tick;
  L.estado = p ? p.estado : null;
  L.emJogo = !!p && p.estado === 'jogo' && (!m.parada || !!m.parada.rolou);
  const b = m.bola;
  L.bola.x = b.p.x; L.bola.y = b.p.y; L.bola.z = b.p.z; L.bola.vx = b.v.x; L.bola.vy = b.v.y; L.bola.vz = b.v.z;
  const timeDe = id => timeDeM(m, id);
  L.posseTime = m.posse != null ? timeDe(m.posse) : m.naMao != null ? timeDe(m.naMao) : m.voo ? (m.voo.time ?? timeDe(m.voo.de)) : null;
  L.ataca[0] = m.ataca?.[0] ?? 1; L.ataca[1] = m.ataca?.[1] ?? -1;
  const pr = m.parada;
  L.parada.ativa = !!pr && !pr.rolou;
  if (pr) { L.parada.tipo = pr.tipo; L.parada.time = pr.time ?? -1; L.parada.x = pr.x ?? 0; L.parada.z = pr.z ?? 0; }
  L.placar[0] = m.placar?.[0] ?? 0; L.placar[1] = m.placar?.[1] ?? 0;
  L.nEventos = 0;
  for (const e of eventos ?? []) {
    const t = e.tipo;
    if (t === 'gol') evento(L, 'gol', e.time === 1 ? 1 : 0);
    else if (t === 'chute' || t === 'cabeceio') { const k = timeDe(e.id); if (k != null) evento(L, 'chute', k); }
    else if (t === 'passe') { const k = timeDe(e.id); if (k != null) evento(L, 'passe', k); }
    else if (t === 'defesa') { const k = timeDe(e.id); if (k != null) evento(L, 'defesa', k); }
    else if (t === 'trave') evento(L, 'trave', -1);
    else if (t === 'fora' || t === 'tiroDeMeta' || t === 'escanteio') evento(L, 'fora', -1);
    else if (t === 'impedimento') evento(L, 'reclama', e.time === 1 ? 1 : 0);              // bandeira contra o time do impedido
    else if (t === 'falta') evento(L, 'reclama', e.time === 1 ? 0 : 1);                    // e.time = quem SOFREU a falta
    else if (t === 'cartao') evento(L, 'reclama', e.time === 1 ? 1 : 0);
    else if (t === 'penaltiMarcado') evento(L, 'reclama', e.time === 1 ? 0 : 1);
    else if (t === 'roubada' || (t === 'dividida' && e.ganhou)) { const k = timeDe(e.id); if (k != null) evento(L, 'desarme', k); }
    else if (t === 'intervalo') evento(L, 'intervalo', -1);
    else if (t === 'fimDeJogo') evento(L, 'fim', -1);
    else if (t === 'saida') evento(L, 'saida', -1);
  }
  L.nPerto = 0;
  for (const j of m.jogadores) {
    if (j.z < MZ - 3 || Math.abs(j.x) > TC.xLim[1] + 4 || L.nPerto >= 30) continue;
    const o = L.nPerto * 4;
    L.perto[o] = j.x; L.perto[o + 1] = j.z; L.perto[o + 2] = j.vx; L.perto[o + 3] = j.vz;
    L.nPerto++;
  }
  return L;
}

/** Leitura vazia (pré-jogo: nenhum jogo; a bola longe). */
export function leituraVazia(L = criarLeitura()) {
  L.estado = null; L.emJogo = false; L.posseTime = null; L.parada.ativa = false; L.nEventos = 0; L.nPerto = 0;
  L.bola.x = 0; L.bola.y = -10; L.bola.z = 0; L.bola.vx = 0; L.bola.vy = 0; L.bola.vz = 0;
  return L;
}

/** Acrescenta à leitura um pedido de aplauso dos dois (pré-jogo: os times saindo do túnel) por `s` s. */
export function pedirAplauso(L, s = 3) { evento(L, 'aplaudir', -1, s); }

// ------------------------------------------------------------------------------------------------ criação
function criarTecnico(t, mini) {
  const a = areaTecnica(t);
  const cx = a.lado * (TC.xLim[0] + TC.xLim[1]) / 2;
  const id = TC.ids[t];
  const j = criarJogador(id, cx, TC.zBase, -Math.PI / 2, {}, t);
  j.posicao = 'TEC';
  j.giroParado = 7;
  j.quadril = alturaQuadril(j, mini);
  const tec = {
    id, time: t, lado: a.lado, area: a, estatura: TC.estatura[t], j,
    centro: cx,
    alvoX: cx, vAlvoX: 0, cmdX: 0, cmdZ: 0, modo: 'base', recuoAte: -1, esquivaAte: -1, ex: cx, ez: TC.zBase,
    andaAte: -1, andaDx: 0, proxAnda: 0,
    estado: 'observa', variante: 0, desde: 0, ate: 1e9,
    postura: 0, posturaDesde: 0, posturaAte: 0,
    prev: { estado: 'observa', variante: 0, desde: 0, postura: 0 }, troca: -1e9,
    ultimo: { estado: '', variante: -1 }, ultimaPostura: -1,
    ultimoInstrui: -1e9, instruiEm: -1, ultimoAplauso: -1e9, defendeDesde: -1, ultimoChute: -1e9,
    pendente: null, pendenteEm: -1, pendenteV: 0, aponta: 1, possePrev: null, paradaVista: NaN, vamos: false, exG: cx, ezG: TC.zBase,
    passeNoAr: false, passes: 0, fimPendente: -1, construindoDesde: -1, mixMedido: -1e9,
    olhar: -Math.PI / 2, tronco: 0, vTronco: 0, cabecaPitch: 0,
    corre: { ate: -1, x: cx },
    noAr: false, rapido: false, modo: 'anda', mix: TC.mistura,
    // mistura: a FOTO do gesto que estava na tela no começo da troca (as mãos no referencial do ombro), a fase do gesto,
    // o rumo do tronco e o agachado/cabeça/pulo do último passo
    snap: novoParam(), faseG: -1, hUlt: -Math.PI / 2, ultP: { agacha: 0, pitch: 0, pulo: 0 },
    ant: new Float32Array(NJ * 3), atu: new Float32Array(NJ * 3),
    x0: cx, z0: TC.zBase, r0: -Math.PI / 2, x1: cx, z1: TC.zBase, r1: -Math.PI / 2,
    maoAnt: new Float64Array(6),
  };
  return tec;
}

/**
 * Os dois treinadores (time 0 e 1) em pé no centro da área técnica deles, de frente para o campo. times = m.times (só
 * para o contrato; nada é lido depois). semente: a dos gestos (hash01).
 */
export function criarTecnicos(times, semente = 1) {
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [] };
  const tecs = [criarTecnico(0, mini), criarTecnico(1, mini)];
  for (const tc of tecs) mini.jogadores.push(tc.j);
  const T = { k: 0, semente: (semente | 0) >>> 0, mini, tecs, golTick: -1, golTime: -1 };
  // comprimentos de referência dos ossos (pose parada): o pescoço–cabeça fica fixo neste valor
  const P = new Float32Array(NJ * 3);
  pose(tecs[0].j, mini, P);
  T.pescoco = Math.hypot(P[J.cabeca * 3] - P[J.pescoco * 3], P[J.cabeca * 3 + 1] - P[J.pescoco * 3 + 1], P[J.cabeca * 3 + 2] - P[J.pescoco * 3 + 2]);
  for (const tc of tecs) { sortearPostura(T, tc); poseTec(T, tc, null); tc.ant.set(tc.atu); }
  return T;
}

// ------------------------------------------------------------------------------------------------ sorteios (rng.js)
const rnd = (T, tc, sal) => hash01(T.semente, tc.id, T.k * 64 + sal);
const entre = (T, tc, sal, [a, b]) => a + (b - a) * rnd(T, tc, sal);
/** Variante de um gesto: sorteada entre as n, nunca a mesma (gesto, variante) da última vez. */
function sortearVariante(T, tc, estado, sal) {
  const n = TC.variantes[estado]?.length ?? 1;
  const ult = tc.ultimo.estado === estado ? tc.ultimo.variante : -1;
  let k = Math.floor(rnd(T, tc, sal) * (ult >= 0 ? n - 1 : n));
  if (ult >= 0 && k >= ult) k++;
  return Math.min(n - 1, k);
}
/** Postura do "observa": as 4 em pé sorteadas (nunca a mesma de antes); o agachado, raro. */
function sortearPostura(T, tc, emPe = false) {
  const ag = !emPe && rnd(T, tc, 1) < TC.chanceAgachado && tc.ultimaPostura !== 4;
  let k = 4;
  if (!ag) { k = Math.floor(rnd(T, tc, 2) * 3); if (k >= tc.ultimaPostura && tc.ultimaPostura >= 0 && tc.ultimaPostura < 4) k++; k = Math.min(3, k); }
  tc.postura = k; tc.ultimaPostura = k; tc.posturaDesde = T.k;
  tc.posturaAte = T.k + s60(k === 4 ? entre(T, tc, 3, TC.agachado) : entre(T, tc, 3, TC.postura));
}

/** Começa um estado (gesto) agora: o anterior fica para a mistura de TC.mistura s. */
function comecar(T, tc, estado, variante, dura) {
  tc.prev.estado = tc.estado; tc.prev.variante = tc.variante; tc.prev.desde = tc.desde; tc.prev.postura = tc.postura;
  tirarFoto(tc); tc.faseG = -1;
  tc.troca = T.k;
  // a reação ao gol é explosiva: a mistura com o gesto de antes é curta (o próprio gesto sobe com a rampa dele)
  tc.mix = estado === 'comemora' ? TC.comemora.sobe : estado === 'sofreu' ? TC.misturaGol : TC.mistura;
  tc.estado = estado; tc.variante = variante; tc.desde = T.k; tc.ate = T.k + Math.max(1, s60(dura));
  // apontando: o braço do lado da bola no começo (não troca de braço no meio do gesto)
  tc.aponta = difAng(tc.j.rumo + tc.tronco, tc.olhar) >= 0 ? 1 : -1;
  if (estado !== 'observa') { tc.ultimo.estado = estado; tc.ultimo.variante = variante; }
}
function voltarObserva(T, tc) {
  sortearPostura(T, tc);
  comecar(T, tc, 'observa', 0, 1e6);
}

// ------------------------------------------------------------------------------------------------ estados
function podeInterromper(tc, estado) { return PRIORIDADE[estado] >= PRIORIDADE[tc.estado] || tc.estado === 'observa'; }

function tentar(T, tc, estado, sal, dura) {
  if (!podeInterromper(tc, estado)) return false;
  // reclamar/lamentar não repete por cima de si mesmo (um lance, uma reação)
  if (tc.estado === estado && (estado === 'reclama' || estado === 'lamenta' || estado === 'aplaude')) return false;
  comecar(T, tc, estado, sortearVariante(T, tc, estado, sal), dura);
  return true;
}

/**
 * Lance de perigo do time: a bola dele (ou o chute dele de agora há pouco) a ≤ TC.tensao m do gol de lá. Ninguém aplaude
 * enquanto a chance acontece (o treinador olha, tenso); o gol pode sair a qualquer momento.
 */
function tensao(T, tc, L) {
  const t = tc.time, perto = L.bola.x * L.ataca[t] > MX - TC.tensao;
  return perto && (L.posseTime === t || L.posseTime == null || T.k - tc.ultimoChute < s60(1.5));
}

/** A defesa do goleiro deles com a bola ainda perto do gol de lá (o rebote): sem palmas. */
function tensaoRebote(tc, L) { return L.bola.x * L.ataca[tc.time] > MX - TC.tensao; }

function atualizarEstado(T, tc, L) {
  const t = tc.time, k = T.k;
  // eventos do passo
  for (let i = 0; i < L.nEventos; i++) {
    const e = L.eventos[i];
    switch (e.tipo) {
      case 'gol':
        T.golTick = k; T.golTime = e.time;
        tc.pendente = e.time === t ? 'comemora' : 'sofreu';
        tc.pendenteEm = k + s60(entre(T, tc, 5, e.time === t ? TC.comemora.comeca : TC.sofreu.comeca));
        break;
      case 'chute': if (e.time === t) tc.ultimoChute = k; break;
      case 'defesa':
        // a defesa do goleiro do time ou o chute do time no alvo (o goleiro deles defendeu): palmas
        if ((e.time === t || k - tc.ultimoChute < s60(TC.lamenta.janela)) && k - tc.ultimoAplauso > s60(TC.aplaude.intervalo * 0.5) && !(e.time !== t && tensaoRebote(tc, L))) {
          if (tentar(T, tc, 'aplaude', 6, entre(T, tc, 7, TC.aplaude.dura))) tc.ultimoAplauso = k;
        }
        if (e.time !== t) tc.ultimoChute = -1e9;
        break;
      case 'trave': case 'fora':
        if (k - tc.ultimoChute < s60(TC.lamenta.janela) && Math.abs(L.bola.x) > MX - 4) { tentar(T, tc, 'lamenta', 8, entre(T, tc, 9, TC.lamenta.dura)); tc.ultimoChute = -1e9; }
        break;
      case 'reclama': if (e.time === t) tentar(T, tc, 'reclama', 10, entre(T, tc, 11, TC.reclama.dura)); break;
      case 'desarme':
        if (e.time === t && k - tc.ultimoAplauso > s60(TC.aplaude.intervalo) && rnd(T, tc, 12) < TC.aplaude.chance && !tensao(T, tc, L)) {
          if (tentar(T, tc, 'aplaude', 13, entre(T, tc, 14, TC.aplaude.dura))) tc.ultimoAplauso = k;
        }
        break;
      case 'intervalo': tentar(T, tc, 'intervalo', 15, entre(T, tc, 16, TC.intervalo.dura)); break;
      case 'fim': {
        // no meio da reação a um gol (o apito final logo depois dele), o fim espera ela acabar
        const g = L.placar[t] - L.placar[1 - t], v = g > 0 ? 0 : g < 0 ? 1 : 2;
        if (tc.estado === 'comemora' || tc.estado === 'sofreu' || tc.pendente) tc.fimPendente = v;
        else comecar(T, tc, 'fim', v, entre(T, tc, 17, TC.intervalo.dura) + 1);
        break;
      }
      case 'passe': if (e.time === t) tc.passeNoAr = true; break;
      case 'saida':
        // palmas de "vamos" na saída de quem sofreu o gol (o "sofreu" ainda no começo encurta e as palmas vêm depois)
        if (T.golTime >= 0 && T.golTime !== t && k - T.golTick < s60(30)) {
          if (tc.estado === 'sofreu') { tc.vamos = true; tc.ate = Math.min(tc.ate, Math.max(k, tc.desde + s60(TC.sofreu.cabeca[0])) + s60(0.8)); }
          else comecar(T, tc, 'vamos', 0, TC.sofreu.vamos);
        }
        break;
      case 'aplaudir': comecar(T, tc, 'aplaude', 0, e.forca || 3); tc.ultimoAplauso = k; break;
      default: break;
    }
  }
  // lance de perigo do time: as palmas param (e nenhuma começa abaixo)
  const tenso = (L.emJogo || L.estado === 'gol') && tensao(T, tc, L);
  if (tenso && tc.estado === 'aplaude' && !tc.pendente) voltarObserva(T, tc);
  // perigo de qualquer lado (a chance do time ou a bola do adversário perto do gol de cá): agachado, ele levanta
  const perigo = tenso || (L.emJogo && L.posseTime !== t && L.bola.x * L.ataca[t] < -(MX - TC.tensao));
  if (perigo && tc.estado === 'observa' && tc.postura === 4) { sortearPostura(T, tc, true); tirarFoto(tc); tc.troca = k; tc.mix = TC.mistura; }
  // gol: a reação começa no tempo dela (o comemora/sofreu interrompe qualquer gesto)
  if (tc.pendente && k >= tc.pendenteEm) {
    const est = tc.pendente;
    tc.pendente = null;
    const v = sortearVariante(T, tc, est, 18);
    if (est === 'comemora') {
      comecar(T, tc, 'comemora', v, entre(T, tc, 19, TC.comemora.dura));
      // corre pela linha (dentro da área) para o lado com mais espaço
      const dist = entre(T, tc, 21, TC.comemora.corre), a = tc.area, m = TC.margemX;
      const espacoMais = a.x1 - m - tc.j.x, espacoMenos = tc.j.x - (a.x0 + m);
      const dir = espacoMais >= espacoMenos ? 1 : -1;
      tc.corre.x = clamp(tc.j.x + dir * dist, a.x0 + m, a.x1 - m);
      tc.corre.ate = v === 0 ? tc.desde + s60(2.2) : -1;
    } else comecar(T, tc, 'sofreu', v, entre(T, tc, 22, TC.sofreu.cabeca) + TC.sofreu.depois + 2.5);
  }
  // instrui: na perda da posse (com atraso de reação), defendendo no próprio campo, bola parada a favor no ataque,
  // lateral do lado dele
  if (L.emJogo || L.parada.ativa) {
    const I = TC.instrui;
    const livre = k - tc.ultimoInstrui >= s60(I.intervalo);
    if (L.posseTime != null) {
      if (tc.possePrev === t && L.posseTime !== t && tc.instruiEm < 0 && livre && rnd(T, tc, 23) < I.chancePerda) tc.instruiEm = k + s60(entre(T, tc, 24, I.reage));
      tc.possePrev = L.posseTime;
    }
    // incentivo (Smith & Cushion 2006: elogio e incentivo intercalados com a instrução; o pedido de jogadores do FC 27:
    // "aplaudir após desarme ou sequência de passes"): a bola recuperada pelo time e a sequência de passes certos
    if (L.posseTime === t) {
      if (tc.passeNoAr) { tc.passeNoAr = false; tc.passes++; }
    } else if (L.posseTime === 1 - t) { tc.passeNoAr = false; tc.passes = 0; }
    const A = TC.aplaude, livreAp = k - tc.ultimoAplauso >= s60(A.intervalo);
    if (L.emJogo && livreAp && tc.estado === 'observa' && !tenso) {
      let quer = false;
      if (L.posseTime === t && tc.possePrev === 1 - t && rnd(T, tc, 40) < A.chanceRecupera) quer = true;
      if (tc.passes >= A.passes) { tc.passes = 0; if (rnd(T, tc, 41) < A.chancePasses) quer = true; }
      if (quer && tentar(T, tc, 'aplaude', 42, entre(T, tc, 43, A.dura))) tc.ultimoAplauso = k;
    }
    const noProprio = (L.bola.x * L.ataca[t]) < 0;
    if (L.emJogo && L.posseTime === 1 - t && noProprio) { if (tc.defendeDesde < 0) tc.defendeDesde = k; } else tc.defendeDesde = -1;
    if (L.emJogo && L.posseTime === t && noProprio) { if (tc.construindoDesde < 0) tc.construindoDesde = k; } else tc.construindoDesde = -1;
    if (livre && tc.instruiEm < 0) {
      if (tc.defendeDesde >= 0 && k - tc.defendeDesde > s60(I.defendendo)) { tc.instruiEm = k + s60(0.4); tc.defendeDesde = k; }
      // o time construindo no próprio campo há um tempo: "sobe!" (a linha, o apoio)
      if (tc.construindoDesde >= 0 && k - tc.construindoDesde > s60(I.construindo)) { tc.instruiEm = k + s60(0.4); tc.construindoDesde = k; }
      // o time com a bola no terço final: "vai!" (de vez em quando)
      if (L.emJogo && L.posseTime === t && L.bola.x * L.ataca[t] > I.terco && rnd(T, tc, 27) < I.chanceTerco * PASSO) tc.instruiEm = k + s60(0.3);
      const pr = L.parada;
      if (pr.ativa && pr.time === t && tc.paradaVista !== pr.x + pr.z * 1000) {
        tc.paradaVista = pr.x + pr.z * 1000;
        const ataque = pr.x * L.ataca[t] > 10, ladoDele = pr.tipo === 'lateral' && pr.z > 0 && Math.abs(pr.x - tc.j.x) < 25;
        if (ataque || ladoDele) tc.instruiEm = k + s60(0.5);
      }
    }
    if (tc.instruiEm >= 0 && k >= tc.instruiEm) {
      tc.instruiEm = -1;
      if (livre && tentar(T, tc, 'instrui', 25, entre(T, tc, 26, I.dura))) tc.ultimoInstrui = k;
    }
  } else { tc.instruiEm = -1; tc.defendeDesde = -1; }
  // fim do estado
  if (k >= tc.ate) {
    // (as palmas depois da comemoração: a próxima vez que ele aplaudir é com outra variante)
    if (tc.estado === 'comemora') comecar(T, tc, 'aplaude', 0, TC.comemora.palmas);
    else if (tc.estado === 'sofreu' && tc.vamos) { tc.vamos = false; comecar(T, tc, 'vamos', 0, TC.sofreu.vamos); tc.ultimo.estado = 'sofreu'; tc.ultimo.variante = tc.prev.variante; }
    else if (tc.estado === 'fim') comecar(T, tc, 'fim', tc.variante, 1e6);
    else if (tc.fimPendente >= 0) { comecar(T, tc, 'fim', tc.fimPendente, 1e6); tc.fimPendente = -1; }
    else voltarObserva(T, tc);
  }
  // postura do observa (troca a cada 6–15 s; o agachado, 2–4 s)
  if (tc.estado === 'observa' && k >= tc.posturaAte) { const pv = tc.postura; sortearPostura(T, tc); if (tc.postura !== pv) { tirarFoto(tc); tc.troca = k; tc.mix = TC.mistura; } }
}

// ------------------------------------------------------------------------------------------------ posição
const _amostra = new Float64Array(3 * 12);
/**
 * Caminho previsto da bola no próximo `janela` s (12 amostras): rolando, pela MESMA conta da integração (bola.js
 * proxVelRolando, subpasso a subpasso) e batendo nas placas (z = meioZ + entorno); no ar, balístico. Devolve quantas.
 */
function preverBola(L) {
  const b = L.bola, E = TC.esquiva;
  const n = 12, passos = s60(E.janela), cada = Math.max(1, Math.round(passos / n));
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  const noChao = y < 0.3 && Math.abs(vy) < 1.5;
  const PZ = MZ + CAMPO.entorno - 0.11;
  let k = 0;
  if (noChao) {
    let s = Math.hypot(vx, vz);
    const ux = s > 1e-6 ? vx / s : 0; let uz = s > 1e-6 ? vz / s : 0;
    for (let t = 1; t <= passos && k < n; t++) {
      for (let q = 0; q < 2; q++) { s = proxVelRolando(s, DT_BOLA); x += ux * s * DT_BOLA; z += uz * s * DT_BOLA; }
      if (z > PZ && uz > 0) { z = PZ; uz = -uz * 0.3; }
      if (t % cada === 0) { _amostra[k * 3] = x; _amostra[k * 3 + 1] = 0.11; _amostra[k * 3 + 2] = z; k++; }
      if (s === 0) { while (k < n) { _amostra[k * 3] = x; _amostra[k * 3 + 1] = 0.11; _amostra[k * 3 + 2] = z; k++; } break; }
    }
  } else {
    for (let t = 1; t <= passos && k < n; t++) {
      vy -= 9.81 * PASSO; x += vx * PASSO; y = Math.max(0.11, y + vy * PASSO); z += vz * PASSO;
      if (z > PZ && vz > 0 && y < 1) { z = PZ; vz = -vz * 0.3; }
      if (t % cada === 0) { _amostra[k * 3] = x; _amostra[k * 3 + 1] = y; _amostra[k * 3 + 2] = z; k++; }
    }
  }
  return k;
}

/** Alvo de esquiva (sai da linha da bola) em tc.ex/ez, ou false. */
function esquivaBola(tc, L) {
  const b = L.bola, j = tc.j, E = TC.esquiva;
  if (L.estado == null) return false;
  const d0 = Math.hypot(b.x - j.x, b.z - j.z), v = Math.hypot(b.vx, b.vz);
  if (d0 > E.janela * Math.max(v, 1) + 3 || b.z < MZ - 12) return false;
  const n = preverBola(L);
  let dm = Infinity, im = -1;
  // a primeira amostra é o agora (a bola parada perto dele também conta)
  for (let i = -1; i < n; i++) {
    const x = i < 0 ? b.x : _amostra[i * 3], y = i < 0 ? b.y : _amostra[i * 3 + 1], z = i < 0 ? b.z : _amostra[i * 3 + 2];
    if (y > E.alturaMax) continue;
    const d = Math.hypot(x - j.x, z - j.z);
    if (d < dm) { dm = d; im = i; }
  }
  if (dm >= E.raio) return false;
  // direção da bola perto dele: sai na perpendicular, do lado em que ele já está (o mais livre dentro da área)
  let dx = b.vx, dz = b.vz;
  const dl = Math.hypot(dx, dz);
  if (dl < 0.3) { dx = j.x - b.x; dz = j.z - b.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; tc.ex = j.x + dx * E.sai; tc.ez = j.z + dz * E.sai; return true; }
  dx /= dl; dz /= dl;
  const px = im < 0 ? b.x : _amostra[im * 3], pz = im < 0 ? b.z : _amostra[im * 3 + 2];
  let nx = -dz, nz = dx;
  if ((j.x - px) * nx + (j.z - pz) * nz < 0) { nx = -nx; nz = -nz; }
  const a = tc.area, m = TC.margem;
  let ex = px + nx * E.sai, ez = pz + nz * E.sai;
  if (ex < a.x0 + TC.margemX || ex > a.x1 - TC.margemX || ez < a.z0 + m || ez > a.z1 - m) { ex = px - nx * E.sai; ez = pz - nz * E.sai; }
  tc.ex = ex; tc.ez = ez;
  return true;
}

/**
 * Afasta de jogador previsto perto (a < TC.esquiva.jogador m agora ou em até prevJogador s, em linha reta): alvo em
 * tc.ex/ez, ou false. Ele vai para TRÁS (as placas: nenhum jogador passa de z ~37 — o corpo do jogador fica no campo ou
 * na faixa de fora) e um pouco para o lado contrário ao do jogador; quem corre pela linha passa na frente dele.
 */
function esquivaJogador(tc, L) {
  const j = tc.j, E = TC.esquiva;
  let fx = 0, achou = false;
  for (let i = 0; i < L.nPerto; i++) {
    const o = i * 4;
    for (let q = 0; q <= 4; q++) {
      const t = E.prevJogador * q / 4;
      const x = L.perto[o] + L.perto[o + 2] * t, z = L.perto[o + 1] + L.perto[o + 3] * t;
      const dx = j.x - x, dz = j.z - z, d = Math.hypot(dx, dz);
      if (d < E.jogador) { fx += (dx >= 0 ? 1 : -1) * (E.jogador - d); achou = true; }
    }
  }
  if (!achou) return false;
  tc.ex = j.x + clamp(fx, -1, 1) * 0.6; tc.ez = TC.recuo.z;
  return true;
}

function recuoPedido(tc, L, k) {
  const R = TC.recuo, b = L.bola;
  if (L.estado == null) return false;
  if (L.emJogo) {
    const px = b.x + b.vx * R.previsao, pz = b.z + b.vz * R.previsao;
    if ((pz >= R.zBola && Math.abs(px - tc.j.x) <= R.dx) || (b.z >= R.zBola && Math.abs(b.x - tc.j.x) <= R.dx)) return true;
  }
  const pr = L.parada;
  if (pr.ativa && pr.z > MZ - 6 && Math.abs(pr.x - tc.j.x) <= R.parada && (pr.tipo === 'lateral' || pr.tipo === 'escanteio' || pr.tipo === 'tiroLivre' || pr.tipo === 'penalti')) return true;
  // a bola fora do campo do lado de cá (rolando até as placas, a montagem do lateral)
  if (b.z > MZ - 1 && Math.abs(b.x - tc.j.x) <= R.dx) return true;
  return false;
}

/** Alvo e velocidade do passo; devolve {dx, dz, vel, rumo} em _cmd. */
const _cmd = { dx: 0, dz: 0, vel: 0, rumo: -Math.PI / 2 };
function mover(T, tc, L) {
  const k = T.k, a = tc.area, m = TC.margem, mx = TC.margemX, j = tc.j;
  // x de base: o centro do banco + segue·(bola − centro), com a mola crítica de TC.tau s
  let bx = tc.centro;
  if (L.estado != null) bx = tc.centro + TC.segue * (L.bola.x - tc.centro);
  bx = tc.lado * clamp(bx * tc.lado, TC.xLim[0], TC.xLim[1]);
  // anda: de vez em quando dá uns passos (2–5 m) dentro da área
  if (k >= tc.proxAnda) {
    tc.proxAnda = k + s60(entre(T, tc, 30, TC.anda.cada));
    if (k > 0) { tc.andaDx = (rnd(T, tc, 31) < 0.5 ? -1 : 1) * entre(T, tc, 32, TC.anda.dist); tc.andaAte = k + s60(8); }
  }
  if (k < tc.andaAte) bx += tc.andaDx;
  bx = clamp(bx, a.x0 + mx, a.x1 - mx);
  const w = 1 / TC.tau;
  const y = tc.alvoX - bx, j1 = tc.vAlvoX + y * w, e = Math.exp(-w * PASSO);
  tc.alvoX = bx + (y + j1 * PASSO) * e; tc.vAlvoX = (tc.vAlvoX - j1 * w * PASSO) * e;
  let tx = tc.alvoX, tz = TC.zBase, vmax = TC.vel.anda, acel = TC.vel.acel;
  // recuo: a bola perto da linha de cá na frente dele (segura TC.recuo.segura s depois)
  if (recuoPedido(tc, L, k)) tc.recuoAte = k + s60(TC.recuo.segura);
  if (k < tc.recuoAte) { tz = TC.recuo.z; vmax = TC.vel.recua; acel = TC.vel.acelRapida; }
  // comemoração: corre pela linha e para
  let rapido = false;
  if (tc.estado === 'comemora' && k < tc.corre.ate) { tx = tc.corre.x; vmax = TC.vel.rapido; acel = TC.vel.acelRapida; rapido = true; }
  else if (tc.estado === 'comemora' || tc.estado === 'sofreu') { tx = j.x; tz = clamp(j.z, a.z0 + m, a.z1 - m); if (k < tc.recuoAte) tz = TC.recuo.z; }
  // esquiva (a bola, um jogador): sai já, mais depressa
  if (esquivaBola(tc, L) || esquivaJogador(tc, L)) { tc.esquivaAte = k + s60(0.6); tc.exG = tc.ex; tc.ezG = tc.ez; }
  if (k < tc.esquivaAte) { tx = tc.exG; tz = tc.ezG; vmax = TC.vel.rapido; acel = TC.vel.acelRapida; rapido = true; }
  tx = clamp(tx, a.x0 + mx, a.x1 - mx); tz = clamp(tz, a.z0 + m, a.z1 - m);
  // modo do movimento: rápido (recuo, esquiva, corrida da comemoração) até o corpo voltar ao passo de andar
  const vAgora = Math.hypot(j.vx, j.vz);
  if (rapido || k < tc.recuoAte) tc.modo = 'rapido';
  else if (tc.modo === 'rapido' && vAgora <= TC.vel.anda + 0.02 && Math.hypot(tc.cmdX, tc.cmdZ) <= TC.vel.anda + 0.02) tc.modo = 'anda';
  tc.rapido = tc.modo === 'rapido';
  if (tc.rapido) acel = TC.vel.acelRapida;
  // velocidade pedida: proporcional à distância, com teto e rampa de aceleração (o corpo segue pela locomoção)
  let dx = tx - j.x, dz = tz - j.z;
  const d = Math.hypot(dx, dz);
  let vx = 0, vz = 0;
  if (d > 0.03) { const v = Math.min(vmax, d * TC.vel.ganho); vx = dx / d * v; vz = dz / d * v; }
  // freia antes das bordas da área (o corpo e os pés nunca passam delas): a velocidade para fora ≤ √(2·a·distância)
  const af = TC.vel.freiaBorda;
  const lim = (dist) => Math.sqrt(2 * af * Math.max(0, dist));
  vx = clamp(vx, -lim(j.x - (a.x0 + mx)), lim(a.x1 - mx - j.x)); vz = clamp(vz, -lim(j.z - (a.z0 + m)), lim(a.z1 - m - j.z));
  const ax = vx - tc.cmdX, az = vz - tc.cmdZ, am = Math.hypot(ax, az), la = acel * PASSO;
  if (am > la) { tc.cmdX += ax / am * la; tc.cmdZ += az / am * la; } else { tc.cmdX = vx; tc.cmdZ = vz; }
  // e a rampa nunca leva o pedido para fora da borda
  tc.cmdX = clamp(tc.cmdX, -lim(j.x - (a.x0 + mx)), lim(a.x1 - mx - j.x)); tc.cmdZ = clamp(tc.cmdZ, -lim(j.z - (a.z0 + m)), lim(a.z1 - m - j.z));
  const vel = Math.hypot(tc.cmdX, tc.cmdZ);
  _cmd.vel = vel < 0.02 ? 0 : vel;
  _cmd.dx = vel > 1e-6 ? tc.cmdX / vel : Math.cos(j.rumo); _cmd.dz = vel > 1e-6 ? tc.cmdZ / vel : Math.sin(j.rumo);
  // rumo do corpo: de frente para o campo, virando para o lado da bola (até corpoMax); comemorando e "de costas" para o
  // banco; correndo na comemoração, para onde corre
  let rumo = -Math.PI / 2 + clamp(difAng(-Math.PI / 2, tc.olhar), -TC.olhar.corpoMax, TC.olhar.corpoMax);
  // andando de lado (ao longo da linha), o corpo vira para onde anda — sem andar de costas na diagonal (a passada para trás
  // levaria o pé de trás para as placas); a cabeça e o tronco seguem a bola (cabecaMax + troncoMax)
  if (vel > TC.olhar.virarAnda && Math.abs(tc.cmdX) > 1.5 * Math.abs(tc.cmdZ)) {
    const s = clamp((vel - TC.olhar.virarAnda) / 0.5, 0, 1);
    rumo = normAng(rumo + difAng(rumo, Math.atan2(tc.cmdZ, tc.cmdX)) * s);
  }
  if (tc.estado === 'comemora') {
    if (k < tc.corre.ate && vel > 1) rumo = Math.atan2(tc.cmdZ, tc.cmdX);
    else if (tc.variante === 2 || (tc.variante === 0 && k >= tc.corre.ate)) rumo = Math.PI / 2;   // vira para o banco
  }
  if (tc.estado === 'sofreu' && tc.variante === 0 && k - tc.desde > s60(2.2)) rumo = Math.PI / 2;
  _cmd.rumo = rumo;
  return _cmd;
}

// ------------------------------------------------------------------------------------------------ passo
/** Um passo (1/60 s) dos dois: estado, posição (locomoção do jogo), olhar e pose. */
export function passoTecnicos(T, L) {
  const tecs = T.tecs, mini = T.mini;
  for (const tc of tecs) atualizarEstado(T, tc, L);
  for (const tc of tecs) {
    // olhar: a bola (sem bola em jogo: o campo à frente); devagar (τ TC.olhar.tau)
    const j = tc.j;
    let alvo = -Math.PI / 2;
    if (L.estado != null && L.bola.y > -1) alvo = Math.atan2(L.bola.z - j.z, L.bola.x - j.x);
    const kk = 1 - Math.exp(-PASSO / TC.olhar.tau);
    tc.olhar = normAng(tc.olhar + difAng(tc.olhar, alvo) * kk);
    const c = mover(T, tc, L);
    passoCorpo(j, c.dx, c.dz, c.vel, c.rumo, j.par, PASSO, false);
  }
  for (const tc of tecs) passoPassada(tc.j, false, PASSO, null, null);
  for (const tc of tecs) passoPeDesenhado(tc.j, mini, PASSO);
  mini.tick++;
  T.k++;
  for (const tc of tecs) tc.j.quadril = alturaQuadril(tc.j, mini);
  for (const tc of tecs) {
    tc.ant.set(tc.atu); tc.x0 = tc.x1; tc.z0 = tc.z1; tc.r0 = tc.r1;
    poseTec(T, tc, L);
    tc.x1 = tc.j.x; tc.z1 = tc.j.z; tc.r1 = tc.j.rumo;
  }
}

/** Pose atual do treinador (57 floats no mundo: o formato do anel e do desenho) em out. */
export function poseTecnico(tc, out) { out.set(tc.atu); return out; }

// ------------------------------------------------------------------------------------------------ gestos
// Alvo de cada mão: {m: 'o' (do OMBRO, no referencial do tronco: f, r para fora, y) | 'c' (da CABEÇA: f, r para fora, y)
// | 'n' (nada: a mão da locomoção), f, r, y, polo [pf, pr, py]}; peso w. O agachado (0–1), a inclinação da cabeça
// (rad: + para baixo) e o pulo (m) vão junto.
function novoParam() { return { e: { m: 'n', f: 0, r: 0, y: 0, pf: 0, pr: 1, py: 0, w: 0 }, d: { m: 'n', f: 0, r: 0, y: 0, pf: 0, pr: 1, py: 0, w: 0 }, agacha: 0, pitch: 0, pulo: 0 }; }
const _pa = novoParam(), _pb = novoParam(), _pm = novoParam();
function mao(o, modo, f, r, y, pf, pr, py, w) { o.m = modo; o.f = f; o.r = r; o.y = y; o.pf = pf; o.pr = pr; o.py = py; o.w = w; }
function maoG(o, g, w, dy = 0) { mao(o, 'o', g[0], g[1], g[2] + dy, g[3], g[4], g[5], w); }
function maoMix(o, a, b, m, w) { mao(o, 'o', lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m), lerp(a[3], b[3], m), lerp(a[4], b[4], m), lerp(a[5], b[5], m), w); }
function zerar(p) { p.e.w = 0; p.e.m = 'n'; p.d.w = 0; p.d.m = 'n'; p.agacha = 0; p.pitch = 0; p.pulo = 0; p.fase = 0; }

/**
 * Foto do gesto na tela agora (a pose do último passo): as duas mãos no referencial do ombro e do tronco (modo 'o', peso
 * 1), o polo de cada cotovelo pela posição dele e o agachado, a cabeça e o pulo. A troca de gesto mistura DESTA foto para
 * o gesto novo: nada salta, nem com uma troca no meio de outra.
 */
function tirarFoto(tc) {
  const o = tc.atu, h = tc.hUlt, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx, sp = tc.snap;
  for (const lado of [-1, 1]) {
    const iO = (lado < 0 ? J.ombroE : J.ombroD) * 3, iC = (lado < 0 ? J.cotoveloE : J.cotoveloD) * 3, iM = (lado < 0 ? J.maoE : J.maoD) * 3;
    const dx = o[iM] - o[iO], dy = o[iM + 1] - o[iO + 1], dz = o[iM + 2] - o[iO + 2];
    const vx = o[iC] - (o[iO] + o[iM]) / 2, vy = o[iC + 1] - (o[iO + 1] + o[iM + 1]) / 2, vz = o[iC + 2] - (o[iO + 2] + o[iM + 2]) / 2;
    mao(lado < 0 ? sp.e : sp.d, 'o', dx * fx + dz * fz, (dx * rx + dz * rz) * lado, dy, vx * fx + vz * fz, (vx * rx + vz * rz) * lado, vy, 1);
  }
  sp.agacha = tc.ultP.agacha; sp.pitch = tc.ultP.pitch; sp.pulo = tc.ultP.pulo;
}
const osc = (t, f) => 0.5 - 0.5 * Math.cos(2 * Math.PI * f * t); // 0 → 1 → 0, começa em 0

/** Palmas: as duas mãos se encontram no meio (lateral da mão até o meio do corpo: 0,02 → 0,16 m). */
function palmas(p, t, f, y, frente) {
  const l = 0.03 + 0.13 * (1 - osc(t, f));
  mao(p.e, 'o', frente, l - 0.19, y, 0.2, 1, -0.5, 1);
  mao(p.d, 'o', frente, l - 0.19, y, 0.2, 1, -0.5, 1);
}
/** As duas mãos em cima da cabeça (dos lados, por cima): fora dela. */
function maosNaCabeca(p, w) {
  mao(p.e, 'c', 0.02, 0.11, 0.095, 0.1, 1, 0.6, w);
  mao(p.d, 'c', 0.02, 0.11, 0.095, 0.1, 1, 0.6, w);
}
function bracosCruzados(p, w) {
  mao(p.e, 'o', 0.22, -0.31, -0.17, 0.25, 1, -0.6, w);
  mao(p.d, 'o', 0.17, -0.3, -0.22, 0.25, 1, -0.6, w);
}

/** Parâmetros do gesto (estado, variante, postura) no tempo t (s) desde o começo dele. */
function gestoEm(T, tc, estado, v, postura, t, out) {
  zerar(out);
  switch (estado) {
    case 'observa':
      if (postura === 0) bracosCruzados(out, 1);
      else if (postura === 1) { maoG(out.e, G_CINTURA, 1); maoG(out.d, G_CINTURA, 1); }
      else if (postura === 2) { mao(out.d, 'c', 0.12, 0.0, -0.09, 0.4, 0.4, -1, 1); mao(out.e, 'o', 0.2, -0.27, -0.25, 0.25, 1, -0.6, 1); }
      else if (postura === 3) { mao(out.e, 'o', -0.2, 0.03, -0.52, -0.6, 1, -0.2, 1); mao(out.d, 'o', -0.2, 0.03, -0.52, -0.6, 1, -0.2, 1); }
      else { out.agacha = 1; mao(out.e, 'o', 0.32, 0.05, -0.62, 0.2, 1, -0.4, 0.9); mao(out.d, 'o', 0.32, 0.05, -0.62, 0.2, 1, -0.4, 0.9); }
      break;
    case 'instrui': {
      if (v === 0) { // aponta para a zona (a direção da bola, no alto do ombro)
        const lado = tc.aponta ?? 1, s = suave(t / 0.3);
        const ang = lado * clamp(lado * difAng(tc.j.rumo + tc.tronco, tc.olhar), 0.05, 0.9);
        // o braço do lado da bola estendido para ela
        const f = 0.5 * Math.cos(ang), r = 0.5 * Math.abs(Math.sin(ang)) + 0.05;
        mao(lado > 0 ? out.d : out.e, 'o', f, r, 0.05, 0, 1, -0.3, s);
        maoG(lado > 0 ? out.e : out.d, G_CINTURA, 0.6 * s);
      } else if (v === 1) { // mãos em concha na boca (~1 s), depois baixam
        const w = 1 - suave((t - TC.instrui.conchaDura) / TC.mistura);
        mao(out.e, 'c', 0.13, 0.07, -0.05, 0.3, 1, -0.5, w); mao(out.d, 'c', 0.13, 0.07, -0.05, 0.3, 1, -0.5, w);
      } else if (v === 2) { // "sobe": palmas para cima, 2×
        const y = -0.3 + 0.32 * osc(t, 1.2);
        mao(out.e, 'o', 0.3, 0.12, y, 0.2, 1, -0.5, 1); mao(out.d, 'o', 0.3, 0.12, y, 0.2, 1, -0.5, 1);
      } else if (v === 3) { // "calma": palmas para baixo, 2×
        const y = -0.25 - 0.16 * osc(t, 1.2);
        mao(out.e, 'o', 0.36, 0.14, y, 0.2, 1, -0.5, 1); mao(out.d, 'o', 0.36, 0.14, y, 0.2, 1, -0.5, 1);
      } else { // gira os braços (um em volta do outro, à frente do peito)
        const a = 2 * Math.PI * 1.4 * t;
        mao(out.e, 'o', 0.3 + 0.07 * Math.cos(a), -0.1, -0.12 + 0.07 * Math.sin(a), 0.2, 1, -0.5, 1);
        mao(out.d, 'o', 0.3 - 0.07 * Math.cos(a), -0.1, -0.12 - 0.07 * Math.sin(a), 0.2, 1, -0.5, 1);
      }
      break;
    }
    case 'aplaude': case 'vamos':
      if (estado === 'vamos' || v === 0) palmas(out, t, TC.aplaude.freq, -0.12, 0.3);
      else if (v === 1) palmas(out, t, TC.aplaude.freq, 0.42, 0.12);
      else { mao(out.d, 'o', 0.42, 0.06, -0.08, 0, 1, -0.6, 1); maoG(out.e, G_CINTURA, 0.7); }
      break;
    case 'reclama':
      if (v === 0 || (v === 1 && t > 0.9)) { // braços abertos, palmas para cima
        mao(out.e, 'o', 0.22, 0.42, -0.28, -0.2, 1, -0.5, 1); mao(out.d, 'o', 0.22, 0.42, -0.28, -0.2, 1, -0.5, 1);
        out.fase = v === 1 ? 1 : 0;
      } else if (v === 1) maosNaCabeca(out, 1);
      else { // aponta o pulso ("o tempo!"): a mão esquerda à frente; a direita aponta o pulso dela (reescrita no IK)
        mao(out.e, 'o', 0.32, -0.08, -0.14, 0.2, 1, -0.6, 1); mao(out.d, 'p', 0, 0, 0, 0.3, 1, -0.6, 1);
      }
      break;
    case 'lamenta':
      if (v === 0) { maosNaCabeca(out, 1); out.pitch = -0.25; }
      else if (v === 1) { out.agacha = 1; mao(out.e, 'c', 0.135, 0.06, -0.02, 0.3, 1, -0.6, 1); mao(out.d, 'c', 0.135, 0.06, -0.02, 0.3, 1, -0.6, 1); out.pitch = 0.35; }
      else { mao(out.d, 'c', -0.135, 0.06, 0.02, 0, 1, 0.5, 1); maoG(out.e, G_CINTURA, 0.8); out.pitch = 0.3; }
      break;
    case 'comemora': {
      // a explosão (os primeiros 0,6 s): o punho no ar em TC.comemora.sobe s; depois a variante
      // (a subida é a própria mistura da foto para o gesto: TC.comemora.sobe s, smoothstep — a mão sobe de uma vez, sem
      // passar pela mão da locomoção)
      if (t < 0.6) { maoG(out.d, G_SOCO, 1, 0.04); maoG(out.e, v === 1 ? G_V : G_PUNHO, 1); break; }
      const u = t - 0.6;
      out.fase = 1;
      if (v === 0) { // socos no ar a ~2 Hz (o direito), o esquerdo em punho
        maoG(out.d, G_SOCO, 1, -0.22 * osc(u, TC.comemora.socos)); maoG(out.e, G_PUNHO, 1);
      } else if (v === 1) { // braços em V com pulinhos
        maoG(out.e, G_V, 1); maoG(out.d, G_V, 1);
        out.pulo = TC.comemora.pulo * Math.max(0, Math.sin(2 * Math.PI * 2 * u));
      } else { // punho cerrado e depois os braços abertos para o banco
        const m = suave((u - 0.8) / 0.4);
        maoMix(out.d, G_PUNHO, G_AVIAO, m, 1); maoMix(out.e, G_PUNHO, G_AVIAO, m, 1);
      }
      break;
    }
    case 'sofreu': {
      const tc0 = TC.sofreu.cabeca[0];
      // (as mãos vão para a cabeça pela própria mistura da foto: TC.misturaGol s, smoothstep)
      if (t < tc0 + 0.4 || v === 2 && t < tc0 + 0.8) { maosNaCabeca(out, 1); out.pitch = 0.2; }
      else if (v === 1 && t < tc0 + TC.sofreu.depois + 0.4) { out.agacha = 1; maosNaCabeca(out, 1); out.pitch = 0.45; out.fase = 1; }
      else { bracosCruzados(out, 1); out.pitch = 0.25; out.fase = 2; }
      break;
    }
    case 'intervalo': palmas(out, t, 2, -0.12, 0.3); break;
    case 'fim':
      if (v === 0) { maoG(out.e, G_V, 1); maoG(out.d, G_V, 1); }
      else if (v === 1) { maoG(out.e, G_CINTURA, 1); maoG(out.d, G_CINTURA, 1); out.pitch = 0.3; }
      else palmas(out, t, 2, -0.12, 0.3);
      break;
    default: break;
  }
  return out;
}

function misturarMao(a, b, s, o) {
  // as duas no mesmo modo: mistura os números; modos diferentes: cada uma com o seu peso (a soma volta a 1)
  if (a.m === b.m || a.w === 0 || b.w === 0) {
    const m = b.w === 0 ? a.m : b.m;
    o.m = m; o.f = lerp(a.w ? a.f : b.f, b.w ? b.f : a.f, s); o.r = lerp(a.w ? a.r : b.r, b.w ? b.r : a.r, s); o.y = lerp(a.w ? a.y : b.y, b.w ? b.y : a.y, s);
    o.pf = lerp(a.pf, b.pf, s); o.pr = lerp(a.pr, b.pr, s); o.py = lerp(a.py, b.py, s);
    o.w = lerp(a.w, b.w, s);
    o.m2 = null;
  } else { o.m = b.m; o.f = b.f; o.r = b.r; o.y = b.y; o.pf = lerp(a.pf, b.pf, s); o.pr = lerp(a.pr, b.pr, s); o.py = lerp(a.py, b.py, s); o.w = b.w; o.m2 = a; o.s = s; }
}

const _al = { x: 0, y: 0, z: 0 }, _al2 = { x: 0, y: 0, z: 0 }, _g = [0, 0, 0, 0, 0, 0];
const _modoN = { m: 'n' };   // a mão onde está (o 'p', o pulso apontado, mede a troca pela mão atual)
/** Ponto-alvo da mão (lado −1/+1) da especificação o, no mundo, em out. */
function alvoMao(o, P, h, lado, sp, out) {
  const fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  if (sp.m === 'p') {
    // aponta o pulso esquerdo (a mão esquerda já está no lugar: ela é feita antes)
    const i = J.maoE * 3;
    out.x = P[i] + fx * 0.02; out.y = P[i + 1] + 0.07; out.z = P[i + 2] + fz * 0.02;
  } else if (sp.m === 'c') {
    const i = J.cabeca * 3;
    out.x = P[i] + fx * sp.f + rx * lado * sp.r; out.y = P[i + 1] + sp.y; out.z = P[i + 2] + fz * sp.f + rz * lado * sp.r;
  } else if (sp.m === 'n') {
    const i = (lado < 0 ? J.maoE : J.maoD) * 3;
    out.x = P[i]; out.y = P[i + 1]; out.z = P[i + 2];
  } else {
    const i = (lado < 0 ? J.ombroE : J.ombroD) * 3;
    out.x = P[i] + fx * sp.f + rx * lado * sp.r; out.y = P[i + 1] + sp.y; out.z = P[i + 2] + fz * sp.f + rz * lado * sp.r;
  }
  return out;
}

const RMIN = RAIO_CABECA + 0.03;
/** Uma mão para o alvo (peso w), com o cotovelo pelo polo; nunca dentro da cabeça. */
function aplicarMao(o, h, lado, sp) {
  if (sp.w <= 0 && !sp.m2) return;
  let t = alvoMao(sp, o, h, lado, sp, _al);
  if (sp.m2 && sp.m2.w > 0) { const t2 = alvoMao(sp.m2, o, h, lado, sp.m2, _al2); _al.x = lerp(t2.x, t.x, sp.s); _al.y = lerp(t2.y, t.y, sp.s); _al.z = lerp(t2.z, t.z, sp.s); t = _al; }
  if (sp.arco) { if (t !== _al) { _al.x = t.x; _al.y = t.y; _al.z = t.z; t = _al; } _al.x += Math.cos(h) * sp.arco; _al.z += Math.sin(h) * sp.arco; }
  const w = sp.m2 ? lerp(sp.m2.w, sp.w, sp.s) : sp.w;
  _g[3] = sp.pf; _g[4] = sp.pr; _g[5] = sp.py;
  maoEm(o, h, lado, t.x, t.y, t.z, w, _g);
}

/** Nenhuma mão dentro da cabeça: se chegou a menos de RMIN do centro, o alvo vai para fora e o braço refaz o IK. */
function maoForaDaCabeca(o, h, lado) {
  const iM = (lado < 0 ? J.maoE : J.maoD) * 3, ic = J.cabeca * 3;
  const dx = o[iM] - o[ic], dy = o[iM + 1] - o[ic + 1], dz = o[iM + 2] - o[ic + 2], d = Math.hypot(dx, dy, dz);
  if (d >= RMIN) return;
  const k = d > 1e-6 ? RMIN / d : 0;
  const tx = o[ic] + (d > 1e-6 ? dx * k : RMIN), ty = o[ic + 1] + (d > 1e-6 ? dy * k : 0), tz = o[ic + 2] + (d > 1e-6 ? dz * k : 0);
  const iO = (lado < 0 ? J.ombroE : J.ombroD) * 3, iC = lado < 0 ? J.cotoveloE : J.cotoveloD;
  const fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  ikBraco(o[iO], o[iO + 1], o[iO + 2], tx, ty, tz, fx * 0.1 + rx * lado, 0.5, fz * 0.1 + rz * lado, o, iC, lado < 0 ? J.maoE : J.maoD);
}

/** Gira as juntas do tronco (e braços) em volta do eixo vertical da pelve (a torção para o lado da bola). */
function torcer(o, ang) {
  if (ang === 0) return;
  const px = o[J.pelve * 3], pz = o[J.pelve * 3 + 2], ca = Math.cos(ang), sa = Math.sin(ang);
  for (let k = 0; k < TRONCO.length; k++) {
    const i = TRONCO[k] * 3, vx = o[i] - px, vz = o[i + 2] - pz;
    o[i] = px + vx * ca - vz * sa; o[i + 2] = pz + vx * sa + vz * ca;
  }
}

/** Cabeça olhando o rumo `yaw`, inclinada `pitch` (rad: + para baixo), com o pescoço–cabeça do comprimento de referência. */
function cabecaOlhando(o, yaw, pitch, Lp) {
  const ic = J.cabeca * 3, in_ = J.pescoco * 3;
  const vx = o[ic] - o[in_], vy = o[ic + 1] - o[in_ + 1], vz = o[ic + 2] - o[in_ + 2];
  // a inclinação da cabeça para a frente da pose (o tronco inclinado) + a do gesto, no rumo do olhar
  const fi0 = Math.atan2(Math.hypot(vx, vz), Math.max(1e-6, vy));
  const fi = clamp(fi0 + pitch, -0.45, 0.95);
  const s = Math.sin(fi) * Lp, c = Math.cos(fi) * Lp;
  o[ic] = o[in_] + Math.cos(yaw) * s; o[ic + 1] = o[in_ + 1] + c; o[ic + 2] = o[in_ + 2] + Math.sin(yaw) * s;
}

/** A pose do treinador neste passo (em tc.atu). */
function poseTec(T, tc, L) {
  const o = tc.atu, j = tc.j, mini = T.mini;
  const k = T.k;
  // gesto atual (antes da pose nova: uma troca de FASE dentro do gesto também tira a foto da pose de antes)
  const tA = (k - tc.desde) * PASSO;
  gestoEm(T, tc, tc.estado, tc.variante, tc.postura, tA, _pb);
  if (_pb.fase !== tc.faseG) {
    if (tc.faseG !== -1) { tirarFoto(tc); tc.troca = k - 1; tc.mix = TC.mistura; }
    tc.faseG = _pb.fase;
  }
  pose(j, mini, o);
  // agachar ou levantar devagar (o corpo inteiro desce 0,3 m; as mãos vão junto)
  // (comemorando, ele levanta mais depressa: TC.comemora.levanta s)
  const durMix = Math.abs(tc.snap.agacha - _pb.agacha) > 0.3 ? Math.max(tc.mix, tc.estado === 'comemora' ? TC.comemora.levanta : TC.misturaAgacha) : tc.mix;
  const sMix = suave((k - tc.troca) * PASSO / durMix);
  const p = sMix < 1 ? _pm : _pb;
  if (sMix < 1) {
    const a = tc.snap;
    misturarMao(a.e, _pb.e, sMix, _pm.e); misturarMao(a.d, _pb.d, sMix, _pm.d);
    _pm.agacha = lerp(a.agacha, _pb.agacha, sMix); _pm.pitch = lerp(a.pitch, _pb.pitch, sMix); _pm.pulo = lerp(a.pulo, _pb.pulo, sMix);
    // o arco da troca (medido no 1º passo dela): a mão que iria em linha reta pela cabeça passa pela FRENTE do corpo
    _pm.e.arco = _pm.d.arco = (tc.arcoMix || 0) * Math.sin(Math.PI * sMix);
  } else { _pb.e.m2 = null; _pb.d.m2 = null; }
  _pb.e.arco = _pb.d.arco = 0;
  tc.ultP.agacha = p.agacha; tc.ultP.pitch = p.pitch; tc.ultP.pulo = p.pulo;
  // agachado (os pés ficam; joelhos para a frente)
  if (p.agacha > 0) poseAgachado(o, j, suave(p.agacha));
  // torção do tronco para o lado do olhar (mola crítica de TC.olhar.tronco s, até troncoMax do quadril)
  const alvoT = clamp(difAng(j.rumo, tc.olhar), -TC.olhar.troncoMax, TC.olhar.troncoMax);
  const w = 2 / TC.olhar.tronco;
  tc.vTronco += (w * w * (alvoT - tc.tronco) - 2 * w * tc.vTronco) * PASSO;
  tc.tronco += tc.vTronco * PASSO;
  torcer(o, tc.tronco);
  const h = j.rumo + tc.tronco;
  tc.hUlt = h;
  // cabeça: no olhar, até cabecaMax do tronco (o comprimento do pescoço fixo)
  const yaw = h + clamp(difAng(h, tc.olhar), -TC.olhar.cabecaMax, TC.olhar.cabecaMax);
  cabecaOlhando(o, yaw, p.pitch, T.pescoco);
  // troca de gesto comum (TC.mistura) com a mão longe do alvo novo (das costas para cima da cabeça): a mistura dura o
  // bastante para o pico do smoothstep (1,5 × a velocidade média) ficar em TC.maoPico m/s — medido UMA vez, no 1º passo da
  // troca, com as duas mãos (a foto e o alvo no mundo, pelos ombros e pela cabeça desta pose); as reações ao gol ficam
  // explosivas (TC.comemora.sobe, TC.misturaGol)
  // (e a linha reta da mão passando a < RMIN + 5 cm do centro da cabeça — das costas para cima dela — ganha um ARCO pela
  // frente, TC.arcoMao m no meio: sem ele a mão empurrada para fora da cabeça dava a volta nela de uma vez)
  if (tc.mixMedido !== tc.troca) {
    tc.mixMedido = tc.troca; tc.arcoMix = 0;
    if (tc.mix === TC.mistura && sMix < 1) {
      let d = 0, perto = Infinity;
      const ic = J.cabeca * 3;
      for (const [lado, a, b] of [[-1, tc.snap.e, _pb.e], [1, tc.snap.d, _pb.d]]) {
        const pa = alvoMao(a, o, h, lado, a.m === 'p' || a.w <= 0 ? _modoN : a, _al), xa = pa.x, ya = pa.y, za = pa.z;
        const pb = alvoMao(b, o, h, lado, b.m === 'p' || b.w <= 0 ? _modoN : b, _al2);
        d = Math.max(d, Math.hypot(pb.x - xa, pb.y - ya, pb.z - za));
        for (let u = 0.1; u < 0.95; u += 0.1) perto = Math.min(perto, Math.hypot(xa + (pb.x - xa) * u - o[ic], ya + (pb.y - ya) * u - o[ic + 1], za + (pb.z - za) * u - o[ic + 2]));
      }
      if (perto < RMIN + 0.05) { tc.arcoMix = TC.arcoMao; d += TC.arcoMao; }
      tc.mix = Math.max(TC.mistura, 1.5 * d / TC.maoPico);
    }
  }
  // braços (alvos do ombro/cabeça desta pose; a esquerda antes: a direita pode apontar o pulso dela) e a mão fora da cabeça
  aplicarMao(o, h, -1, p.e);
  aplicarMao(o, h, 1, p.d);
  maoForaDaCabeca(o, h, -1); maoForaDaCabeca(o, h, 1);
  // pulinho (o corpo inteiro sobe: os pés saem do chão)
  tc.noAr = p.pulo > 0;
  if (p.pulo > 0) for (let i = 1; i < o.length; i += 3) o[i] += p.pulo;
}

// ------------------------------------------------------------------------------------------------ câmeras de cinema
const CAP = { y0: 0.3, y1: 1.55, r: 0.3 };
/** Distância do ponto (x, y, z) à cápsula do treinador em (cx, cz) (r 0,30 m, de 0 a 1,85 m de altura). */
export function distanciaTecnico(x, y, z, cx, cz) {
  const dy = y < CAP.y0 ? CAP.y0 - y : y > CAP.y1 ? y - CAP.y1 : 0;
  return Math.hypot(Math.hypot(x - cx, z - cz), dy) - CAP.r;
}
/**
 * Câmera de cinema fora dos treinadores: empurra o ponto p ({x, y, z} ou [x, y, z]) na horizontal até ficar a ≥ dmin m
 * da cápsula de cada um (sem entrar nas placas: z ≤ meioZ + entorno − 0,6). tecs = T, T.tecs ou [{x, z}]. Devolve p.
 */
export function afastarDeTecnicos(p, tecs, dmin = 0.6) {
  const lista = tecs?.tecs ?? tecs;
  if (!lista) return p;
  const arr = Array.isArray(p);
  let x = arr ? p[0] : p.x, y = arr ? p[1] : p.y, z = arr ? p[2] : p.z;
  const zMax = MZ + CAMPO.entorno - 0.6;
  for (let it = 0; it < 3; it++) {
    for (const tc of lista) {
      const cx = tc.j ? tc.j.x : tc.x, cz = tc.j ? tc.j.z : tc.z;
      const d = distanciaTecnico(x, y, z, cx, cz);
      if (d >= dmin) continue;
      const dy = y < CAP.y0 ? CAP.y0 - y : y > CAP.y1 ? y - CAP.y1 : 0;
      const hNec = Math.sqrt(Math.max(0, (dmin + CAP.r) ** 2 - dy * dy)) + 1e-3;
      let ux = x - cx, uz = z - cz;
      const l = Math.hypot(ux, uz);
      if (l < 1e-6) { ux = 0; uz = -1; } else { ux /= l; uz /= l; }
      let nx = cx + ux * hNec, nz = cz + uz * hNec;
      if (nz > zMax) {
        // não entra nas placas: vai pelo lado (ao longo da linha)
        nz = zMax;
        const sx = Math.sqrt(Math.max(0, hNec * hNec - (nz - cz) ** 2));
        nx = cx + (ux >= 0 ? 1 : -1) * sx;
      }
      x = nx; z = nz;
    }
  }
  if (arr) { p[0] = x; p[2] = z; } else { p.x = x; p.z = z; }
  return p;
}

/**
 * O treinador do time `t` como ATOR de cena — o GANCHO da frente das cenas (comemoracao.js `opc.treinador`, cena-fim.js
 * `treinadores`; main.js `treinadorDoTime(t)`): {id (TECNICOS.ids: 210 | 211; não cruza com os jogadores 1–123 nem com os
 * árbitros 200–203), time, x, z, rumo, kit ('tecnico0' | 'tecnico1')} onde ele está AGORA (dentro da área técnica dele,
 * Regra 1), ou null sem treinadores. Só lê.
 */
export function treinadorDoTime(T, t) {
  const tc = T?.tecs?.find(q => q.time === t);
  return tc ? { id: tc.id, time: tc.time, x: tc.j.x, z: tc.j.z, rumo: tc.j.rumo, kit: kitTecnico(tc.time) } : null;
}
/** O uniforme do treinador do time (jogador3d.js: o terno do mandante, o agasalho do visitante). */
export function kitTecnico(time) { return time === 1 ? 'tecnico1' : 'tecnico0'; }

/** Informação para testes e API: por treinador {id, time, x, z, rumo, v, estado, variante, postura, olhar, noAr, rapido}. */
export function infoTecnicos(T) {
  return T.tecs.map(tc => ({
    id: tc.id, time: tc.time, x: tc.j.x, z: tc.j.z, rumo: tc.j.rumo, v: Math.hypot(tc.j.vx, tc.j.vz), estado: tc.estado,
    variante: tc.variante, varianteNome: TC.variantes[tc.estado]?.[tc.variante] ?? null, postura: tc.postura,
    olhar: tc.olhar, noAr: tc.noAr, rapido: tc.rapido, recuo: T.k < tc.recuoAte, esquiva: T.k < tc.esquivaAte,
  }));
}
