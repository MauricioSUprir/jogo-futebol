// Mixagem da torcida (som): conta PURA (sem Web Audio nem DOM) dos níveis de cada camada a partir do ânimo
// (emocao.js) e da agenda da festa (festa.js) — o som.js só aplica (setTargetAtTime). Testada em Node
// (tools/teste-torcida.mjs) e medida na saída do jogo (tools/teste-som-jogo.mjs).
//
// Os níveis daqui são em "unidades de −16 LUFS": cada gravação é nivelada para MIXAGEM.alvoLufs pelo ganho de
// nivelamento (nivelamento(lufs medido); som.js SOM.arquivos[*].lufs), então 0,55 de murmúrio e 0,62 de canto
// soam como 0,55 e 0,62 de uma mesma referência. Metas (PESQUISA-ESTADIO.md §6): leito audível o jogo todo, a
// ~−22 dBFS na saída com a bola no meio-campo (−18 LUFS é a referência de volume da PlayStation para portátil,
// Audiokinetic/Sony; aqui o leito fica uns 4 dB abaixo para os lances terem para onde subir), o apito no máximo
// ~8 dB acima do leito, o gol o mais alto de todos e um limitador no fim da cadeia (som.js).
import { nivelCanto } from './festa.js';

export const MIXAGEM = {
  alvoLufs: -16,
  // murmúrio (laço ambiente): calmo com a bola no meio, um pouco mais com o barulho geral subindo
  leito: { calmo: 0.55, agitado: 0.66 },
  // laço do estádio agitado: entra com o agito acima de agitoEntra[0] e chega ao máximo em agitoEntra[1]
  agito: 0.62, agitoEntra: [0.3, 0.95],
  canto: 0.62,               // canto da casa no nível cheio
  cantoVisitante: 0.3,       // o setor visitante (abafado e do lado esquerdo: som.js)
  batucada: 0.42,            // bateria da organizada (fundo +x: lado direito da TV)
  // uma reação ("uuuh", palmas, vaia, gol) abaixa o leito e os cantos em ~4 dB enquanto toca
  reacao: { abaixa: 0.63, dur: 2.6 },
  // disparos (ganho sobre a gravação nivelada; o gol continua o mais alto)
  apito: 0.4, apitoIntervalo: 0.45, apitoFim: 0.47,
  vaia: 0.7,
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(x) { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }

/** Ganho que leva uma gravação de `lufs` (medido, EBU R128) para o alvo da mixagem. */
export function nivelamento(lufs, alvo = MIXAGEM.alvoLufs) {
  return Number.isFinite(lufs) ? Math.pow(10, (alvo - lufs) / 20) : 1;
}

/** Quanto o leito e os cantos abaixam agora por causa de uma reação (1 = nada; MIXAGEM.reacao.abaixa logo depois). */
export function abaixamento(emocao, t = emocao.t) {
  const R = MIXAGEM.reacao;
  const desde = t - (emocao.ultimaReacao ?? -1e9);
  return 1 - (1 - R.abaixa) * clamp(1 - desde / R.dur, 0, 1);
}

/**
 * Alvos de cada camada agora (escreve em `out`, que é devolvido; nada alocado):
 *   ambiente, agito — o leito; canto (nível do clipe `cantoClipe`, do lado `cantoLado`: 0 casa, 1 visitante);
 *   batucada; abaixa (o fator da reação já aplicado).
 */
export function alvosMixagem(emocao, out = {}) {
  const M = MIXAGEM, f = emocao.festa, t = emocao.t;
  const ag = emocao.agito;
  const ab = abaixamento(emocao, t);
  const sobe = suave((ag - M.agitoEntra[0]) / (M.agitoEntra[1] - M.agitoEntra[0]));
  out.abaixa = ab;
  out.ambiente = (M.leito.calmo + (M.leito.agitado - M.leito.calmo) * sobe) * ab;
  out.agito = M.agito * sobe * ab;
  if (f) {
    const nc = nivelCanto(f, t);
    out.cantoClipe = nc > 0 ? f.canto.clipe : -1;
    out.cantoLado = f.canto.lado;
    out.canto = (f.canto.lado ? M.cantoVisitante : M.canto) * nc * ab;
    out.batucada = M.batucada * f.batucada * ab;
    out.proximoCanto = f.canto.proximo;
  } else {
    out.cantoClipe = -1; out.cantoLado = 0; out.canto = 0; out.batucada = 0; out.proximoCanto = -1;
  }
  return out;
}
