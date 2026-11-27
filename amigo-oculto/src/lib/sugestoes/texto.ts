/**
 * Normalização de texto para as sugestões de presente (puro, sem dependências).
 * "Cafés Especiais!" → "cafes especiais" → tokens ["cafe", "especial"].
 */

/** Minúsculas, sem acentos, só letras e números separados por um espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras que não mudam no plural (já sem acento). */
const INVARIAVEIS = new Set(["lapis", "onibus", "tenis", "pires", "virus", "atlas", "gas", "mais", "menos", "pais", "seis", "tres", "bonus", "simples", "cais", "mes"]);

/**
 * Plural → singular por regras simples do português (suficiente para comparar interesses).
 * Recebe a palavra já normalizada.
 */
export function singular(palavra: string): string {
  const p = palavra;
  if (p.length <= 3 || INVARIAVEIS.has(p) || /\d/.test(p)) return p;
  if (p.endsWith("oes") || p.endsWith("aes")) return `${p.slice(0, -3)}ao`; // limões, pães, cães
  if (p.length > 4 && p.endsWith("ais")) return `${p.slice(0, -3)}al`; // animais, jornais
  if (p.length > 4 && p.endsWith("eis")) return `${p.slice(0, -3)}el`; // papéis, anéis
  if (p.length > 4 && p.endsWith("ois")) return `${p.slice(0, -3)}ol`; // lençóis
  if (p.endsWith("ns")) return `${p.slice(0, -2)}m`; // viagens, jardins, bombons
  if (p.endsWith("res") || p.endsWith("zes")) return p.slice(0, -2); // flores, cores, luzes
  if (p.endsWith("s") && !p.endsWith("ss") && !p.endsWith("us") && !p.endsWith("is")) return p.slice(0, -1);
  return p;
}

/** Texto → palavras normalizadas e no singular. */
export function tokens(texto: string): string[] {
  const n = normalizar(texto);
  return n ? n.split(" ").map(singular) : [];
}

/** A frase (já em tokens) aparece inteira e em sequência dentro de `texto` (tokens)? */
export function contemFrase(texto: readonly string[], frase: readonly string[]): boolean {
  if (frase.length === 0 || frase.length > texto.length) return false;
  for (let i = 0; i + frase.length <= texto.length; i++) {
    let igual = true;
    for (let j = 0; j < frase.length; j++) {
      if (texto[i + j] !== frase[j]) {
        igual = false;
        break;
      }
    }
    if (igual) return true;
  }
  return false;
}

/** Palavras sem significado para comparar listas de desejos ("kit de caneca para café" → caneca, cafe). */
export const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "a", "o", "as", "os", "um", "uma", "uns", "umas", "para", "pra", "com", "sem", "em",
  "no", "na", "nos", "nas", "por", "que", "se", "ao", "aos", "kit", "jogo", "tamanho", "qualquer", "algum", "alguma", "coisa",
  "presente", "modelo", "marca", "tipo", "item", "unidade", "novo", "nova", "grande", "pequeno", "pequena", "bom", "boa",
  "preto", "branco", "azul", "verde", "vermelho", "rosa", "cor", "par", "conjunto", "mais", "muito", "bem", "gosta", "gosto",
  "adora", "ama", "curte", "quero", "queria", "algo", "tudo", "nada", "favorito", "favorita", "tambem", "mas", "ela", "ele",
]);

/** Palavras com conteúdo (sem as vazias e com pelo menos 4 letras), para comparar títulos. */
export function palavrasChave(texto: string): string[] {
  return [...new Set(tokens(texto).filter((t) => t.length >= 4 && !PALAVRAS_VAZIAS.has(t)))];
}
