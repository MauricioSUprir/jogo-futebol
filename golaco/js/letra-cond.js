// GOLAÇO — a largura de um texto em TM Cond 800 (Barlow Condensed ExtraBold, OFL; a letra da carta do TM) sem esperar a fonte
// chegar: a tabela de avanços da fonte (assets/tm/fontes/tmcond-800-latin.woff2). Puro (sem DOM nem three.js), fora do fecho do
// hash. Usada pela tela antes do jogo (prepartida.js, item 64: o nome na ficha) e pela escalação do pré-jogo (escalacao-tela.js,
// item 29: a largura da carta pelo nome mais largo). A tabela ignora o kerning (que estreita): a conta erra para o lado seguro.

// avanços da TM Cond 800 em 1/1000 em, de U+0020 a U+00FF (latin-1); medidos da fonte
export const AVANCO = Object.freeze([200, 289, 385, 626, 454, 761, 624, 188, 343, 343, 362, 437, 223, 337, 235, 444, 456, 294, 451, 446, 508, 450, 451, 422, 446, 446, 298, 246, 437, 437, 437, 462, 760, 508, 477, 470, 480, 441, 427, 473, 483, 235, 462, 505, 437, 558, 522, 479, 474, 467, 481, 454, 485, 480, 506, 707, 490, 492, 419, 360, 444, 360, 432, 437, 234, 457, 453, 445, 453, 446, 305, 451, 455, 223, 223, 465, 219, 685, 455, 452, 456, 456, 336, 426, 299, 455, 456, 635, 462, 442, 377, 370, 201, 370, 500, 426, 426, 426, 426, 426, 426, 0, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 200, 289, 445, 522, 587, 534, 201, 454, 391, 776, 298, 454, 437, 0, 433, 280, 359, 437, 273, 289, 234, 458, 530, 235, 162, 161, 301, 454, 735, 701, 815, 462, 508, 508, 508, 508, 508, 508, 775, 470, 441, 441, 441, 441, 235, 235, 235, 235, 506, 522, 479, 479, 479, 479, 479, 409, 517, 480, 480, 480, 480, 492, 473, 471, 457, 457, 457, 457, 457, 457, 698, 445, 446, 446, 446, 446, 197, 197, 197, 197, 456, 455, 452, 452, 452, 452, 452, 437, 459, 455, 455, 455, 455, 442, 451, 442]);
/** Largura (px) do texto em TM Cond 800 a `px` (caixa alta: o nome de camisa na ficha); fora do latin-1, 0,5 em por letra. */
export function larguraCond(texto, px, caixaAlta = true) {
  const s = caixaAlta ? String(texto).toUpperCase() : String(texto);
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0); w += c >= 32 && c <= 255 ? AVANCO[c - 32] : 500; }
  return w / 1000 * px;
}
/**
 * A mesma largura com o avanço de cada letra arredondado ao px inteiro: o Chromium sem posição subpixel do texto (Linux, o
 * navegador dos testes e do CI) arredonda o avanço de cada letra — até +0,5 px por letra (a 14,44 px, "Mmmmmmmmmm" dá 97,1 px
 * pela tabela e 98 na tela). Quem não pode cortar o nome (a escalação do pré-jogo, item 29) usa a maior das duas.
 */
export function larguraCondInteira(texto, px, caixaAlta = true) {
  const s = caixaAlta ? String(texto).toUpperCase() : String(texto);
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0); w += Math.round((c >= 32 && c <= 255 ? AVANCO[c - 32] : 500) / 1000 * px); }
  return w;
}
