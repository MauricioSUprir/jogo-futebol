// O tempo de jogo e a dificuldade da partida (item 33 da FILA; dono, 17/10: "editar o TEMPO de jogo e a DIFICULDADE (na
// pausa/antes do jogo e vindo do TM pelo pedido)"; contrato "Tempo de jogo e dificuldade" no CONTRATOS.md). PURO: sem DOM e
// sem three.js; importa o config.js e o tatica.js (só LÊ o mundo) e FICA FORA do fecho do hash (só a página o lê: main.js, e o
// teste-ponte-tm). A conta que mexe no mundo mora no partida.js (mudarDuracao, definirDificuldade); aqui ficam a leitura do
// pedido do Total Match, os ciclos da pausa, os textos e o resultado que volta ao TM.
import { PARTIDA, DIFICULDADE, PASSO } from './config.js';
import { contraPessoa } from './tatica.js';

/** As durações (minutos REAIS por tempo) que a pessoa escolhe; o padrão (4) entre elas. */
export const DURACOES = PARTIDA.duracoes;
/** Os níveis, do mais fácil ao mais difícil (os 4 do Total Match). */
export const NIVEIS = DIFICULDADE.niveis;
export const NOME_NIVEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', lenda: 'Lenda' };

/** A duração da lista (3, 4, 5, 6, 8, 10) ou null. */
export function minutosValidos(v) { return typeof v === 'number' && DURACOES.includes(v) ? v : null; }
/** O nível ('facil' | 'normal' | 'dificil' | 'lenda') ou null. */
export function nivelValido(v) { return typeof v === 'string' && NIVEIS.includes(v) ? v : null; }

/**
 * Os ajustes que o pedido do Total Match manda (partida.minutosPorTempo, partida.dificuldade, partida.ajustesFixos):
 * {minutosPorTempo | null, dificuldade | null, fixos}. Fora da lista = null (a página usa o padrão). No online (modo 'online')
 * nunca há dificuldade (duas pessoas): só a duração, a do anfitrião (o mesmo pedido nos dois aparelhos).
 */
export function ajustesDoPedido(pedido) {
  const p = pedido && typeof pedido === 'object' ? pedido.partida : null;
  if (!p || typeof p !== 'object') return { minutosPorTempo: null, dificuldade: null, fixos: false };
  const online = pedido.modo === 'online';
  return {
    minutosPorTempo: minutosValidos(p.minutosPorTempo),
    dificuldade: online ? null : nivelValido(p.dificuldade),
    fixos: !!p.ajustesFixos,
  };
}

/** O ciclo da pausa: 3 → 4 → 5 → 6 → 8 → 10 → 3. Um valor fora da lista (o ?min dos testes) vai à menor opção maior que ele. */
export function proximaDuracao(min) {
  const k = DURACOES.indexOf(min);
  if (k >= 0) return DURACOES[(k + 1) % DURACOES.length];
  return DURACOES.find(d => d > min) ?? DURACOES[0];
}
/** O ciclo da pausa: Fácil → Normal → Difícil → Lenda → Fácil. */
export function proximoNivel(n) {
  const k = NIVEIS.indexOf(n);
  return NIVEIS[(k + 1) % NIVEIS.length];
}
/** O mais fácil dos dois níveis (o que vai ao resultado do TM: a dificuldade mais fácil usada na partida). */
export function maisFacil(a, b) {
  const ka = NIVEIS.indexOf(a), kb = NIVEIS.indexOf(b);
  if (ka < 0) return kb < 0 ? null : b;
  if (kb < 0) return a;
  return ka <= kb ? a : b;
}

/**
 * O nível que o passo que ACABOU de rodar usou contra a pessoa, ou null: só na partida (não no online, no Livre nem nos
 * Pênaltis), com UMA pessoa jogando de verdade contra a IA (contraPessoa do time da IA: a entrada sem a marca da IA — o Simular
 * o resto e a demo não contam — e o travado do TM em campo). A página chama depois de cada passo e guarda o mais fácil
 * (`maisFacil`): um nível só atravessado no ciclo da pausa, sem nenhum passo jogado nele, não conta (revisão do item 33, A3).
 */
export function nivelDoPasso(m) {
  if (!m?.partida || m.modo !== 'partida' || m.online || m.livre || m.disputa || m.humanos?.length !== 1) return null;
  return contraPessoa(m, 1 - m.humanos[0]) ? (m.dificuldade ?? 'normal') : null;
}

const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
/** "2 × 4 min" (a curta da pausa e do celular). */
export function textoDuracao(min) { return `2 × ${num(min)} min`; }
/** "Normal" (o nome do nível). */
export function textoNivel(n) { return NOME_NIVEL[n] ?? NOME_NIVEL.normal; }

/**
 * O resultado ao Total Match com os 2 campos do item 33 (opcionais; o TM decide depois o que faz com eles): `dificuldade` = a
 * MAIS FÁCIL em que a pessoa JOGOU pelo menos um passo (a.maisFacil, nivelDoPasso; sem nenhum passo jogado — o Simular o resto
 * desde o começo, a IA × IA, onde a dificuldade não age —, o Normal) e `minutosPorTempo` = a duração no apito (pelo mundo). Só na
 * partida (não no Livre nem nos Pênaltis) e nunca no online (sem dificuldade). Devolve um objeto novo (r fica como está).
 */
export function resultadoComAjustes(r, a, m) {
  if (!r || typeof r !== 'object' || !m?.partida || m.modo !== 'partida') return r;
  const o = { ...r };
  const min = m.partida.ticksPorTempo * PASSO / 60;
  o.minutosPorTempo = Math.round(min * 1000) / 1000;
  if (!m.online && m.humanos?.length === 1) o.dificuldade = nivelValido(a?.maisFacil) ?? 'normal';
  return o;
}
