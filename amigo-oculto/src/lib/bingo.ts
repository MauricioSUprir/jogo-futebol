/**
 * Bingo natalino: o banco sorteia NÚMEROS (0 a 74) e guarda as cartelas; o texto de cada número mora aqui.
 * A cartela tem 25 casas (5 × 5, lidas linha a linha); a do meio (posição 12) é a casa LIVRE (valor -1 no banco).
 * As regras de "bingo" daqui são as MESMAS de `bingo_claim` no banco (12 linhas: 5 horizontais, 5 verticais e as
 * 2 diagonais; vale a casa marcada cujo número já foi chamado) — a tela só usa isso para acender o botão.
 */

/** 75 termos festivos, índices 0–74. Curtos para caberem numa casa da cartela no celular. */
export const TERMOS_BINGO = [
  // 0–14
  "Papai Noel", "Rena", "Trenó", "Sino", "Estrela", "Presépio", "Guirlanda", "Meia", "Presente", "Laço",
  "Fita", "Vela", "Pisca-pisca", "Árvore", "Bola de Natal",
  // 15–29
  "Panetone", "Rabanada", "Peru", "Chester", "Tender", "Farofa", "Salpicão", "Pavê", "Uva-passa", "Castanha",
  "Nozes", "Lentilha", "Romã", "Chocotone", "Pudim",
  // 30–44
  "Biscoito", "Bengala doce", "Chocolate", "Sorvete", "Ponche", "Champanhe", "Brinde", "Ceia", "Amigo oculto", "Abraço",
  "Beijo", "Foto", "Selfie", "Música", "Dança",
  // 45–59
  "Família", "Amigos", "Ano Novo", "Fogos", "Contagem", "Meia-noite", "Roupa branca", "Desejo", "Promessa", "Gorro",
  "Boneco de neve", "Floco de neve", "Anjo", "Duende", "Carta",
  // 60–74
  "Embrulho", "Cartão", "Surpresa", "Risada", "Karaokê", "Viagem", "Férias", "Praia", "Piscina", "Calor",
  "Ventilador", "Sobremesa", "Mesa posta", "Gratidão", "Alegria",
] as const;

export const CASA_LIVRE = -1;
export const POSICAO_CENTRAL = 12;
export const LETRAS_BINGO = ["B", "I", "N", "G", "O"] as const;

/** As 12 linhas que valem bingo (posições 0–24 da cartela). */
export const LINHAS_BINGO: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

/** Texto do número sorteado (ou "LIVRE" na casa do meio). */
export function termoDoBingo(numero: number): string {
  if (numero === CASA_LIVRE) return "LIVRE";
  return TERMOS_BINGO[numero] ?? `Nº ${numero + 1}`;
}

/** A casa conta para o bingo? (livre, ou marcada E já chamada) */
export function casaValida(posicao: number, cells: readonly number[], marcadas: readonly number[], chamados: readonly number[]): boolean {
  if (posicao === POSICAO_CENTRAL) return true;
  return marcadas.includes(posicao) && chamados.includes(cells[posicao]);
}

/** Índices (0–11) das linhas completas. */
export function linhasCompletas(cells: readonly number[], marcadas: readonly number[], chamados: readonly number[]): number[] {
  if (cells.length !== 25) return [];
  const completas: number[] = [];
  LINHAS_BINGO.forEach((linha, i) => {
    if (linha.every((p) => casaValida(p, cells, marcadas, chamados))) completas.push(i);
  });
  return completas;
}

export function temBingo(cells: readonly number[], marcadas: readonly number[], chamados: readonly number[]): boolean {
  return linhasCompletas(cells, marcadas, chamados).length > 0;
}

/** Quantas casas faltam na linha mais adiantada (0 = bingo). Para a dica "falta 1!". */
export function faltamParaBingo(cells: readonly number[], marcadas: readonly number[], chamados: readonly number[]): number {
  if (cells.length !== 25) return 5;
  let menor = 5;
  for (const linha of LINHAS_BINGO) {
    const faltam = linha.filter((p) => !casaValida(p, cells, marcadas, chamados)).length;
    if (faltam < menor) menor = faltam;
  }
  return menor;
}

/** Posições de casas já chamadas que a pessoa ainda não marcou (a tela dá um brilho discreto nelas). */
export function chamadasNaoMarcadas(cells: readonly number[], marcadas: readonly number[], chamados: readonly number[]): number[] {
  const set = new Set(chamados);
  const r: number[] = [];
  cells.forEach((n, p) => {
    if (p !== POSICAO_CENTRAL && set.has(n) && !marcadas.includes(p)) r.push(p);
  });
  return r;
}
