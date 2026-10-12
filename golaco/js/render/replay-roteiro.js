// Roteiros e relógio do REPLAY. Puro (sem three.js nem DOM): roda nos testes em Node (tools/teste-replay-anel.mjs).
//
// Um roteiro é uma lista de PLANOS {de, ate (ticks do anel), vel (fração da velocidade real), cam ('tv' | 'atras' |
// 'lateral' | 'linha'), congela?: {tick, s, velDepois}} mais o que a câmera e a linha precisam. Os roteiros nunca
// atravessam um corte do anel (montagem de recomeço, saída de bola: replay-anel.js ultimoCorte) — antes do corte o
// mundo desenhado era outro. O relógio do replay anda em ticks fracionários (lerQuadro interpola).
//
// Transmissão (PESQUISA-ESTADIO.md §Replay): o gol tem 2 planos — a jogada na câmera de TV na velocidade real e o chute
// de trás do gol em câmera lenta —, mais a lateral baixa bem lenta no golaço (EA FC 25: replays com câmeras próprias,
// "3 ângulos"); o impedimento é o do VAR: câmera alinhada com a linha até o toque (P1 'linha') e a ANÁLISE
// semiautomática congelada no passe (P2 'saot': render/replay-saot.js; Premier League/FA 2025, FIFA 2022). A checagem de
// POSIÇÃO LEGAL (a mesma análise, verde) entra no fim do replay do gol e do "Replay" da pausa quando o lance foi
// apertado (replay-saot.js checagemLegal). Um plano 'saot' é SÓ congelado (de = ate = o passe; congela.s = a análise).
import { REPLAY, CAMPO } from '../config.js';
import { bolaNoTick } from './replay-anel.js';
import { cenaImpedimento, checagemLegal, faseSaot, duracaoSaot } from './replay-saot.js';

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
 * o gol em que a bola entrou), time? (quem fez o gol: com ele entra a checagem de posição legal), golaco?}. Sem golaco
 * definido, decide pela distância do chute (ehGolaco). Devolve null se o gol já saiu do anel.
 * Com a checagem (checagemLegal achou um passe apertado em posição legal no lance): o replay ganha a análise verde no
 * fim (REPLAY.saot.legal.dura s) e o orçamento cresce REPLAY.saot.extraGol s (12 → 13 s; golaço 14 → 15): primeiro
 * encolhe o plano de TV (nunca começando depois de 0,5 s antes do passe checado), depois o de trás do gol; se ainda não
 * couber, sai sem checagem. Sem checagem o roteiro é exatamente o de antes.
 */
export function roteiroGol(anel, g) {
  const base = montarGol(anel, g, null);
  if (!base || g.time == null || g.checagem === false) return base;
  // o passe checado tem de caber no plano de TV com 0,5 s antes dele: a partir do começo mais cedo possível da TV
  const cena = checagemLegal(anel, { golTick: g.golTick, time: g.time, lado: g.lado, de: base.iniTV + 30 });
  if (!cena) return base;
  return montarGol(anel, g, cena) ?? base;
}

/** Os planos do gol; `chk` = a cena de posição legal (null: o roteiro de sempre). Null se não couber. */
function montarGol(anel, g, chk) {
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
  const iniTV = ini;
  const fimA = Math.min(fimMax, golTick + s60(G.lentoDepois));
  // golaço: o 3º plano (lateral baixa) em volta do chute
  const golaco = g.golaco ?? ehGolaco(anel, g.chuteTick, lado);
  const lat = golaco ? { de: Math.max(ini, chute - s60(G.lateralAntes)), ate: Math.min(fimMax, chute + s60(G.lateralDepois)), vel: G.vel[2], cam: 'lateral' } : null;
  // com a checagem: + extraGol no orçamento, − a análise (que entra no fim)
  const extra = chk ? REPLAY.saot.extraGol : 0, analise = chk ? duracaoSaot('legal') : 0;
  const orcamento = (golaco ? G.maximoGolaco + extra - Math.max(0, lat.ate - lat.de) / 60 / G.vel[2] : G.maximo + extra) - analise;
  // TV + atrás ≤ orçamento: o começo do plano de TV encolhe (até antesMin antes do chute — com a checagem, até 0,5 s antes
  // do passe checado, se for antes); se ainda passar, o começo do plano de trás do gol (até 0,3 s antes do chute)
  let iniA = Math.max(ini, chute - s60(G.lentoAntes));
  const total = () => (fimTV - ini) / 60 / G.vel[0] + (fimA - iniA) / 60 / G.vel[1];
  const pisoTV = chk ? Math.min(chute - s60(G.antesMin), chk.fotoTick - 30) : chute - s60(G.antesMin);
  let excesso = total() - orcamento;
  if (excesso > 0) ini = Math.max(ini, Math.min(ini + s60(excesso * G.vel[0]), pisoTV));
  excesso = total() - orcamento;
  if (excesso > 0) iniA = Math.max(iniA, Math.min(iniA + Math.ceil(excesso * 60 * G.vel[1]), chute - 18));
  if (chk && (total() > orcamento + 1e-9 || ini > chk.fotoTick - 30)) return null;
  const planos = [
    { de: ini, ate: fimTV, vel: G.vel[0], cam: 'tv' },
    { de: iniA, ate: fimA, vel: G.vel[1], cam: 'atras' },
  ];
  if (lat) { lat.de = Math.max(lat.de, ini); planos.push(lat); }
  const validos = planos.filter(p => p.ate > p.de);
  if (!validos.length) return null;
  const r = { tipo: 'gol', planos: validos, lado: lado >= 0 ? 1 : -1, golTick, chuteTick: chute, golaco };
  // (fora da enumeração: o roteiro sem checagem fica igual ao de antes, campo a campo)
  Object.defineProperty(r, 'iniTV', { value: iniTV, enumerable: false });
  if (chk) { r.planos.push(planoSaot(chk)); r.checagem = true; }
  return r;
}

/** O plano da análise semiautomática: só congelado no passe (de = ate), a câmera 'saot', `cena` de replay-saot.js. */
function planoSaot(cena) {
  const t = cena.fotoTick;
  return { de: t, ate: t, vel: 1, cam: 'saot', congela: { tick: t, s: duracaoSaot(cena.tipo), velDepois: 1 }, saot: cena };
}

/**
 * Roteiro do impedimento: i = {fotoTick (o passe: a foto da Regra 11), apitoTick, linhaX, idImpedido, time (do
 * impedido), lado (±1: para onde o time do impedido ataca), defensor (id de quem fazia a linha; null = a bola ou o
 * meio), por (quem passou)}. P1 'linha': a câmera alinhada com a linha, `vel` até o passe (a linha entra no quadro do
 * passe, sem congelar) e daí até o toque do impedido; P2 'saot': a análise semiautomática congelada no passe. Null se o
 * passe já saiu do anel.
 */
export function roteiroImpedimento(anel, i) {
  const I = REPLAY.impedimento;
  const { fotoTick, apitoTick } = i;
  if (fotoTick == null || anel.slot(fotoTick) < 0) return null;
  let ini = Math.max(anel.primeiro, fotoTick - s60(I.antes));
  const c = anel.ultimoCorte(ini, fotoTick);
  if (c != null) ini = c;
  // depois do passe: até o apito (o toque do impedido) em no máximo `depoisMax` s REAIS — o trecho longo (passe longo,
  // o impedido corre antes de tocar) anda mais depressa, até `velDepoisMax`; passou disso, para antes do toque. Nunca
  // atravessa um corte.
  let apito = Math.max(fotoTick, Math.min(anel.ultimo, apitoTick));
  const cd = anel.primeiroCorte(fotoTick + 1, apito);
  if (cd != null) apito = cd - 1;
  const velDepois = Math.min(I.velDepoisMax, Math.max(I.velDepois, (apito - fotoTick) / 60 / I.depoisMax));
  const fim = Math.min(apito, fotoTick + Math.floor(I.depoisMax * velDepois * 60 + 1e-9));
  const planos = [{ de: ini, ate: fim, vel: I.vel, cam: 'linha', congela: { tick: fotoTick, s: 0, velDepois } }];
  const cena = cenaImpedimento(anel, { fotoTick, id: i.idImpedido, defensor: i.defensor, por: i.por, linhaX: i.linhaX, lado: i.lado });
  if (cena) planos.push(planoSaot(cena));
  return {
    tipo: 'impedimento', planos,
    linhaX: i.linhaX, fotoTick, apitoTick, idImpedido: i.idImpedido, time: i.time, lado: i.lado >= 0 ? 1 : -1,
    defensor: i.defensor ?? null, por: i.por ?? null,
  };
}

/**
 * Roteiro do "Replay" da pausa: os últimos `s` segundos (sem atravessar o último corte), na câmera de TV. Pausa logo
 * depois de uma montagem (falta, lateral, escanteio: menos de `menu.minDepoisCorte` s desde o corte), o que vale rever é
 * o lance ANTES dela — o que parou o jogo —, até o corte (sem atravessar o corte anterior). Com `checar`, a checagem
 * de posição legal no fim (como no gol).
 */
export function roteiroMenu(anel, s = REPLAY.segundos, checar = true) {
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
  const r = { tipo: 'menu', planos: [{ de, ate, vel: REPLAY.menu.vel, cam: 'tv' }], lado: 1 };
  // checagem de posição legal no fim, se a jogada tem um passe apertado que acabou em chute ou gol (com 0,5 s antes dele
  // no plano)
  const cena = checar ? checagemLegal(anel, { fimTick: ate, de: de + 30 }) : null;
  if (cena) { r.planos.push(planoSaot(cena)); r.checagem = true; }
  return r;
}

/**
 * Roteiro só da checagem de posição legal mais apertada do anel (testes e prints: `__golaco.replay.saotDeTeste`): sem
 * exigir chute nem gol (critério i), até 1,5 s de TV até o passe e a análise. `limite` (m): outro teto para a margem
 * (testes do desenho quando o anel não tem passe apertado). Null sem nenhuma.
 */
export function roteiroLegalTeste(anel, limite) {
  const cena = checagemLegal(anel, { teste: true, limite });
  if (!cena) return null;
  const c = anel.ultimoCorte(anel.primeiro, cena.fotoTick);
  const de = Math.max(anel.primeiro, c ?? anel.primeiro, cena.fotoTick - 90);
  if (de >= cena.fotoTick) return null;
  return { tipo: 'menu', planos: [{ de, ate: cena.fotoTick, vel: 1, cam: 'tv' }, planoSaot(cena)], lado: 1, checagem: true };
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
    r.t = p.congela.tick;
    if (p.congela.s > 0) {
      r.congelado += dt;
      if (r.congelado >= p.congela.s - 1e-9) {
        r.congelou = true; r.congelado = 0;
        // nada para tocar depois do congelamento (a análise: de = ate = o tick do passe): o plano acaba neste quadro,
        // sem um quadro a mais parado (a 30 qps o impedimento passava 1 quadro dos 7,5 s)
        if (p.ate <= p.congela.tick) return fimDoPlano(r, p);
      }
      return true;
    }
    // congela.s = 0 (P1 do impedimento): só a troca de velocidade no quadro do passe, sem parar
    r.congelou = true;
  }
  const vel = p.congela && r.congelou ? (p.congela.velDepois ?? p.vel) : p.vel;
  r.t += dt * 60 * vel;
  if (p.congela && !r.congelou && r.t > p.congela.tick) r.t = p.congela.tick;
  if (r.t >= p.ate) return fimDoPlano(r, p);
  return true;
}

/** Fim do plano p: começa o próximo (true) ou, no último, desliga (false). */
function fimDoPlano(r, p) {
  if (r.i + 1 < r.roteiro.planos.length) { comecarPlano(r, r.i + 1); return true; }
  r.t = p.ate; pararRelogio(r); return false;
}

/**
 * Tempo (s) desde o corte para a análise no plano 'saot' atual (congelamento acabado: `s`; a análise de = ate acaba no
 * mesmo quadro em que o congelamento termina, então o último quadro desenhado é o de s − dt).
 */
export function tempoSaot(r) {
  const p = planoAtual(r);
  if (!p || p.cam !== 'saot') return 0;
  return r.congelou ? p.congela.s : r.congelado;
}

const _fs = {};
const COR_AMARELA = 0xffd84a;
/** Mistura duas cores 0xRRGGBB (t de 0 a 1). */
export function misturarCor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/**
 * Linha de impedimento no quadro do replay, decidida pelo plano: no P1 'linha' do impedimento, do quadro do passe em
 * diante (amarela, entra em `linhaEntra` s; não apaga até o fim do plano); no plano 'saot', sempre — branco-gelo, verde
 * na decisão de posição legal. Escreve em out {visivel, x, opacidade, cor}.
 */
export function linhaDoReplay(r, dt, out) {
  const ro = r.roteiro, p = planoAtual(r);
  if (p && p.cam === 'saot') {
    const sc = p.saot, C = REPLAY.saot.cores;
    faseSaot(tempoSaot(r), sc.tipo, _fs, sc.mesmaLinha);
    // (mais suave que no P1: na análise a parede é a linha e a do chão não pode se confundir com as linhas do campo)
    out.visivel = true; out.x = sc.linhaX; out.opacidade = 0.75;
    out.cor = sc.tipo === 'legal' ? misturarCor(C.gelo, C.legal, _fs.cor) : C.gelo;
    return out;
  }
  if (!r.ativo || !ro || ro.tipo !== 'impedimento' || !p || p.cam !== 'linha' || r.t < ro.fotoTick - 1e-6) { out.visivel = false; out.opacidade = 0; r.linhaT = 0; return out; }
  r.linhaT += dt;
  out.visivel = true; out.x = ro.linhaX; out.cor = COR_AMARELA;
  out.opacidade = Math.min(1, Math.max(0, r.linhaT / REPLAY.impedimento.linhaEntra)) * 0.95;
  return out;
}
