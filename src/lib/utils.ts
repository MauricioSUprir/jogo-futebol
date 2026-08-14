import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Estima a duração falada (segundos) de um texto, dado palavras/min. */
export function estimarDuracaoSeg(texto: string, palavrasPorMin: number): number {
  const palavras = (texto?.trim().match(/\S+/g) ?? []).length;
  if (palavras === 0) return 0;
  return Math.round((palavras / Math.max(palavrasPorMin, 1)) * 60);
}

export function contarPalavras(texto: string): number {
  return (texto?.trim().match(/\S+/g) ?? []).length;
}

export function formatarDuracao(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatarNumero(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatarPct(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}
