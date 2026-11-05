// O CARTÃO DO AUTOR do gol na comemoração (item 31; dono, 17/10: "na cena de comemoração, a FOTO do autor com o número e o
// nome"; contrato "Comemoração do gol" no CONTRATOS.md). Puro: sem DOM nem three.js (Node: teste-comemoracao 15). Fora do fecho
// do hash: só decide QUANDO a página mostra o cartão (main.js) — a cena (comemoracao.js) e o mundo não mudam.
//
// Quando: entra `atraso` depois do 1º corte (o "GOL!" sai no corte: um texto por vez), fica `segura` (a cena curta, o gol da IA
// contra a pessoa, `seguraCurta`) e começa a sair pelo menos `folgaFim` antes do fim da cena (= do replay, que entra no mesmo
// quadro em que ela acaba). Base (PESQUISA-ESTADIO §10.1): o flash do autor da TV ~3 s, o "hold" de 4–7 s do LIGR para nome +
// função, entender em 2 s (Wasp3D); entrada em décimos de segundo e saída mais rápida que a entrada. As constantes moram aqui (o
// config.js é do fecho), como o REPLAY_PARADA no lances.js.

export const AUTOR_GOL = {
  /** s depois do 1º corte (COMEMORACAO.rede) */
  atraso: 0.4,
  /** s da animação de entrada (CSS) e da de saída */
  entrada: 0.3,
  saida: 0.2,
  /** s na tela (a partir da entrada) na cena normal e na curta */
  segura: 3.5,
  seguraCurta: 2.6,
  /** a saída começa pelo menos isto antes do fim da cena (some ≥ folgaFim − saida antes do replay) */
  folgaFim: 0.5,
  /** menos que isto na tela (a cena curtíssima): nenhum cartão */
  minimo: 1.5,
};

/**
 * O id de quem ganha o cartão, ou null: só o AUTOR DE VERDADE comemorando. No gol contra o plano.autorId é de quem comemora (do
 * time que marcou: comemoracao.js planejarComemoracao) e no gol sem autor também — nos dois, nada.
 * plano = planejarComemoracao(...); gol = {id, contra} (o autor de verdade: render/autor-gol.js).
 */
export function autorDoCartao(plano, gol) {
  if (!plano || plano.contra || gol?.contra || gol?.id == null) return null;
  return plano.autorId === gol.id ? gol.id : null;
}

/**
 * A janela do cartão em s da cena: {entra, sai} — entra = rede + atraso; sai (o começo da saída) = min(entra + segura (curta:
 * seguraCurta), duracao − folgaFim). null se sobrar menos que `minimo`. duracao = a da cena no começo (o teto: ela encurta quando
 * o autor chega ao alvo — por isso a fase relê a duração a cada quadro).
 */
export function janelaCartao({ rede, duracao, curta }) {
  if (!Number.isFinite(rede) || !Number.isFinite(duracao)) return null;
  const entra = rede + AUTOR_GOL.atraso;
  const sai = Math.min(entra + (curta ? AUTOR_GOL.seguraCurta : AUTOR_GOL.segura), duracao - AUTOR_GOL.folgaFim);
  return sai - entra >= AUTOR_GOL.minimo ? { entra, sai } : null;
}

/**
 * A fase do cartão no instante t (s da cena) com a duração de AGORA: 'antes' | 'entra' | 'fica' | 'sai' | 'fora'. O começo da
 * saída efetivo é min(janela.sai, duracao − folgaFim): a duração só encurta, então a fase só anda para a frente.
 */
export function faseCartao(janela, t, duracao) {
  if (!janela) return 'fora';
  const sai = Number.isFinite(duracao) ? Math.min(janela.sai, duracao - AUTOR_GOL.folgaFim) : janela.sai;
  if (t < janela.entra) return 'antes';
  if (sai <= janela.entra) return 'fora';
  if (t < sai) return t < janela.entra + AUTOR_GOL.entrada ? 'entra' : 'fica';
  if (t < sai + AUTOR_GOL.saida) return 'sai';
  return 'fora';
}
