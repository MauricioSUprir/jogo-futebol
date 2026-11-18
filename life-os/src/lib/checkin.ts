// Check-in do dia: o mesmo registro serve ao diário de saúde (Health Center) e ao humor (Mind Center).
// Escalas percebidas, sem diagnóstico: os módulos só mostram padrões dos próprios registros.
import type { ChaveDia } from "./datas";

export const HUMOR: Record<number, string> = { 1: "Muito mal", 2: "Mal", 3: "Neutro", 4: "Bem", 5: "Muito bem" };
export const ESTRESSE: Record<number, string> = { 1: "Muito baixo", 2: "Baixo", 3: "Médio", 4: "Alto", 5: "Muito alto" };
export const DISPOSICAO: Record<number, string> = { 1: "Ruim", 2: "Regular", 3: "Boa", 4: "Ótima" };

export const EMOCOES = [
  "alegria",
  "calma",
  "gratidão",
  "motivação",
  "orgulho",
  "empolgação",
  "cansaço",
  "ansiedade",
  "tristeza",
  "raiva",
  "frustração",
  "tédio",
  "solidão",
  "medo",
] as const;

export interface Checkin {
  dia: ChaveDia;
  energia: number | null; // 1–10
  humor: number | null; // 1–5
  estresse: number | null; // 1–5
  disposicao: number | null; // 1–4
  emocoes: string[];
  notas: string | null;
}

/** Média de uma lista (ignora vazios); null sem dados. */
export function mediaDe(valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Arredonda para 1 casa, no formato brasileiro. */
export function umaCasa(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/**
 * Compara uma medida entre dois grupos de dias (ex.: energia depois de noites com e sem a meta de sono).
 * Só responde com pelo menos `minimo` dias em cada grupo, para não tirar conclusão de 1 ou 2 registros.
 */
export function comparaGrupos(
  pares: { grupo: "a" | "b"; valor: number | null }[],
  minimo = 3,
): { a: number; b: number; na: number; nb: number; diferenca: number } | null {
  const a = pares.filter((p) => p.grupo === "a" && p.valor !== null).map((p) => p.valor as number);
  const b = pares.filter((p) => p.grupo === "b" && p.valor !== null).map((p) => p.valor as number);
  if (a.length < minimo || b.length < minimo) return null;
  const ma = mediaDe(a)!;
  const mb = mediaDe(b)!;
  return { a: ma, b: mb, na: a.length, nb: b.length, diferenca: ma - mb };
}
