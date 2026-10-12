// Roteiros e relógio do REPLAY. Puro (sem three.js nem DOM): roda nos testes em Node (tools/teste-replay-anel.mjs).
//
// Um roteiro é uma lista de PLANOS {de, ate (ticks do anel), vel (fração da velocidade real), cam ('tv' | 'atras' |
// 'lateral' | 'linha'), congela?: {tick, s, velDepois}} mais o que a câmera e a linha precisam. Os roteiros nunca
// atravessam um corte do anel (montagem de recomeço, saída de bola: replay-anel.js ultimoCorte) — antes do corte o
// mundo desenhado era outro. O relógio do replay anda em ticks fracionários (lerQuadro interpola).
//
// Transmissão (PESQUISA-ESTADIO.md §Replay): o gol tem 2 planos — a jogada na câmera de TV na velocidade real e o chute
// de trás do gol em câmera lenta —, mais a lateral baixa bem lenta no golaço (EA FC 25: replays com câmeras próprias,
// "3 ângulos"); o impedimento é o do VAR: câmera alinhada com a linha, o quadro do passe CONGELADO com a linha, sem
// texto (Premier League, "How offsides are determined by VAR").
import { REPLAY, CAMPO } from '../config.js';
import { bolaNoTick } from './replay-anel.js';

const s60 = s => Math.round(s * 60);
const _b = { x: 0, y: 0, z: 0 };

/** Duração (s reais) de um roteiro: soma dos planos na velocidade de cada um, mais os congelamentos. */
export function duracao(r) {
  if (!r) return 0;
  let s = 0;
  for (const p of r.planos) {
    if (p.congela) {
      const c = Math.min(Math.max(p.congela.tick, p.de), p.ate);
      s += (c - p.de) / 60 / p.vel + p.congela.s + (p.ate - c) / 60 / (p.congela.velDepois ?? p.vel);
    } else s += (p.ate - p.de) / 60 / p.vel;
  }
  return s;
}

/** Golaço: a bola estava a ≥ REPLAY.gol.golaco m do centro do gol atacado (lado ±1) no tick do chute. */
export function ehGolaco(anel, chuteTick, lado) {
  if (chuteTick == null) return false;
  const b = bolaNoTick(anel, chuteTick, _b);
  if (!b) return false;
  return Math.hypot(b.x - lado * CAMPO.meioX, b.z) >= REPLAY.gol.golaco;
}

/**
 * Roteiro do gol: g = {golTick, chuteTick (tick do último chute/cabeceio que vale o gol; null = sem chute), lado (±1:
 * o gol em que a bola entrou), golaco?}. Sem golaco definido, decide pela distância do chute (ehGolaco). Devolve null
 * se o gol já saiu do anel.
 */
export function roteiroGol(anel, g) {
  const G = REPLAY.gol;
  const { golTick, lado } = g;
  if (anel.slot(golTick) < 0) return null;
  const chute = g.chuteTick != null && anel.slot(g.chuteTick) >= 0 ? g.chuteTick : Math.max(anel.primeiro, golTick - 45);
  // fim: nunca no corte depois do gol (montagem da saída ou do intervalo: o mundo desenhado já é outro)
  const cDepois = anel.primeiroCorte(golTick + 1, Math.min(anel.ultimo, golTick + s60(Math.max(G.depois, G.lentoDepois))));
  const fimMax = cDepois != null ? cDepois - 1 : anel.ultimo;
  const fimTV = Math.min(fimMax, golTick + s60(G.depois));
  // começo: chute − antes, ou depois do último corte (a jogada desenhada antes dele era outra)
  let ini = Math.max(anel.primeiro, chute - s60(G.antes));
  const c = anel.ultimoCorte(ini, golTick);
  if (c != null) ini = c;
  const fimA = Math.min(fimMax, golTick + s60(G.lentoDepois));
  // golaço: o 3º plano (lateral baixa) em volta do chute
  const golaco = g.golaco ?? ehGolaco(anel, g.chuteTick, lado);
  const lat = golaco ? { de: Math.max(ini, chute - s60(G.lateralAntes)), ate: Math.min(fimMax, chute + s60(G.lateralDepois)), vel: G.vel[2], cam: 'lateral' } : null;
  const orcamento = golaco ? G.maximoGolaco - Math.max(0, lat.ate - lat.de) / 60 / G.vel[2] : G.maximo;
  // TV + atrás ≤ orçamento: o começo do plano de TV encolhe (até antesMin antes do chute); se ainda passar, o começo do
  // plano de trás do gol (até 0,3 s antes do chute)
  let iniA = Math.max(ini, chute - s60(G.lentoAntes));
  const total = () => (fimTV - ini) / 60 / G.vel[0] + (fimA - iniA) / 60 / G.vel[1];
  let excesso = total() - orcamento;
  if (excesso > 0) ini = Math.max(ini, Math.min(ini + s60(excesso * G.vel[0]), chute - s60(G.antesMin)));
  excesso = total() - orcamento;
  if (excesso > 0) iniA = Math.max(iniA, Math.min(iniA + Math.ceil(excesso * 60 * G.vel[1]), chute - 18));
  const planos = [
    { de: ini, ate: fimTV, vel: G.vel[0], cam: 'tv' },
    { de: iniA, ate: fimA, vel: G.vel[1], cam: 'atras' },
  ];
  if (lat) { lat.de = Math.max(lat.de, ini); planos.push(lat); }
  const validos = planos.filter(p => p.ate > p.de);
  if (!validos.length) return null;
  return { tipo: 'gol', planos: validos, lado: lado >= 0 ? 1 : -1, golTick, chuteTick: chute, golaco };
}

/**
 * Roteiro do impedimento: i = {fotoTick (o passe: a foto da Regra 11), apitoTick, linhaX, idImpedido, time (do
 * impedido), lado (±1: para onde o time do impedido ataca)}. A câmera alinhada com a linha; congela no passe. Null se
 * o passe já saiu do anel.
 */
export function roteiroImpedimento(anel, i) {
  const I = REPLAY.impedimento;
  const { fotoTick, apitoTick } = i;
  if (fotoTick == null || anel.slot(fotoTick) < 0) return null;
  let ini = Math.max(anel.primeiro, fotoTick - s60(I.antes));
  const c = anel.ultimoCorte(ini, fotoTick);
  if (c != null) ini = c;
  // depois do congelamento: do passe até o apito (o toque do impedido) em no máximo `depoisMax` s REAIS — o trecho longo
  // (passe longo, o impedido corre antes de tocar) anda mais depressa, até `velDepoisMax`; passou disso, para antes do
  // toque. Nunca atravessa um corte.
  let apito = Math.max(fotoTick, Math.min(anel.ultimo, apitoTick));
  const cd = anel.primeiroCorte(fotoTick + 1, apito);
  if (cd != null) apito = cd - 1;
  const velDepois = Math.min(I.velDepoisMax, Math.max(I.velDepois, (apito - fotoTick) / 60 / I.depoisMax));
  const fim = Math.min(apito, fotoTick + Math.floor(I.depoisMax * velDepois * 60 + 1e-9));
  return {
    tipo: 'impedimento',
    planos: [{ de: ini, ate: fim, vel: I.vel, cam: 'linha', congela: { tick: fotoTick, s: I.congela, velDepois } }],
    linhaX: i.linhaX, fotoTick, apitoTick, idImpedido: i.idImpedido, time: i.time, lado: i.lado >= 0 ? 1 : -1,
  };
}

/**
 * Roteiro do "Replay" da pausa: os últimos `s` segundos (sem atravessar o último corte), na câmera de TV. Pausa logo
 * depois de uma montagem (falta, lateral, escanteio: menos de `menu.minDepoisCorte` s desde o corte), o que vale rever é
 * o lance ANTES dela — o que parou o jogo —, até o corte (sem atravessar o corte anterior).
 */
export function roteiroMenu(anel, s = REPLAY.segundos) {
  if (anel.ultimo < 0) return null;
  const N = s60(s);
  let de = Math.max(anel.primeiro, anel.ultimo - N + 1), ate = anel.ultimo;
  const c = anel.ultimoCorte(de + 1, anel.ultimo);
  if (c != null) {
    de = c;
    if (ate - c < s60(REPLAY.menu.minDepoisCorte)) {
      let de2 = Math.max(anel.primeiro, c - N);
      const c2 = anel.ultimoCorte(de2 + 1, c - 1);
      if (c2 != null) de2 = c2;
      if (c - 1 - de2 >= 30) { de = de2; ate = c - 1; }
    }
  }
  if (ate - de < 30) return null; // menos de 0,5 s de jogada: nada para rever
  return { tipo: 'menu', planos: [{ de, ate, vel: REPLAY.menu.vel, cam: 'tv' }], lado: 1 };
}

// ------------------------------------------------------------------------------------------------ relógio
/** Estado do relógio do replay (reaproveitado: nada é alocado por quadro). */
export function criarRelogio() {
  return { ativo: false, roteiro: null, i: 0, t: 0, congelado: 0, congelou: false, linhaT: 0, quadros: 0, novoPlano: false };
}

function comecarPlano(r, i) {
  r.i = i; const p = r.roteiro.planos[i];
  r.t = p.de; r.congelou = false; r.congelado = 0; r.novoPlano = true;
}

/** Começa um roteiro. Devolve false se ele é vazio. */
export function iniciarRelogio(r, roteiro) {
  if (!roteiro || !roteiro.planos.length || !(roteiro.planos[0].ate > roteiro.planos[0].de)) return false;
  r.roteiro = roteiro; r.ativo = true; r.quadros = 0; r.linhaT = 0;
  comecarPlano(r, 0);
  return true;
}

export function pararRelogio(r) { r.ativo = false; r.roteiro = null; }

/** Plano atual (ou null). */
export function planoAtual(r) { return r.ativo && r.roteiro ? r.roteiro.planos[r.i] : null; }

/** Velocidade agora (0 com o quadro congelado). */
export function velocidadeAgora(r) {
  const p = planoAtual(r);
  if (!p) return 0;
  if (p.congela && !r.congelou && r.t >= p.congela.tick) return 0;
  if (p.congela && r.congelou) return p.congela.velDepois ?? p.vel;
  return p.vel;
}

/**
 * Avança dt s reais. O tick do replay anda dt × 60 × vel; no tick do congelamento fica parado `congela.s` s (depois
 * segue a velDepois). No fim de um plano começa o próximo; no fim do último, desliga. Devolve false quando acabou.
 */
export function avancarRelogio(r, dt) {
  if (!r.ativo) return false;
  const p = planoAtual(r);
  r.quadros++;
  r.novoPlano = false;
  if (p.congela && !r.congelou && r.t >= p.congela.tick) {
    r.t = p.congela.tick; r.congelado += dt;
    if (r.congelado >= p.congela.s) { r.congelou = true; r.congelado = 0; }
    return true;
  }
  const vel = p.congela && r.congelou ? (p.congela.velDepois ?? p.vel) : p.vel;
  r.t += dt * 60 * vel;
  if (p.congela && !r.congelou && r.t > p.congela.tick) r.t = p.congela.tick;
  if (r.t >= p.ate) {
    if (r.i + 1 < r.roteiro.planos.length) comecarPlano(r, r.i + 1);
    else { r.t = p.ate; pararRelogio(r); return false; }
  }
  return true;
}

/**
 * Linha de impedimento no quadro do replay: só no replay do impedimento, do quadro do passe em diante (entra em
 * `linhaEntra` s; não apaga até o fim). Escreve em out {visivel, x, opacidade}.
 */
export function linhaDoReplay(r, dt, out) {
  const ro = r.roteiro;
  if (!r.ativo || !ro || ro.tipo !== 'impedimento' || r.t < ro.fotoTick - 1e-6) { out.visivel = false; out.opacidade = 0; r.linhaT = 0; return out; }
  r.linhaT += dt;
  out.visivel = true; out.x = ro.linhaX;
  out.opacidade = Math.min(1, Math.max(0, r.linhaT / REPLAY.impedimento.linhaEntra)) * 0.95;
  return out;
}
