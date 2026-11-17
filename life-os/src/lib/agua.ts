// Estatísticas da água — PURAS (tests/unit/agua.test.ts).
// Só "água" conta para a meta; as outras bebidas ficam registradas à parte.
import { type ChaveDia, somaDias } from "./datas";

export interface RegistroAgua {
  day: ChaveDia;
  hora: number; // 0–23, local
  amountMl: number;
  beverage: string;
}

export interface DiaAgua {
  dia: ChaveDia;
  aguaMl: number;
  outrasMl: number;
  copos: number;
  meta: number;
  treino: boolean;
  bateu: boolean;
}

export const BEBIDAS: Record<string, string> = {
  agua: "Água",
  cha: "Chá",
  suco: "Suco",
  leite: "Leite",
  cafe: "Café",
  isotonico: "Isotônico",
  refrigerante: "Refrigerante",
  outro: "Outra bebida",
};

export function resumoPorDia(
  registros: RegistroAgua[],
  dias: ChaveDia[],
  metaDoDia: (dia: ChaveDia) => number,
  treinoDoDia: (dia: ChaveDia) => boolean,
): DiaAgua[] {
  const mapa = new Map<ChaveDia, DiaAgua>();
  for (const d of dias) {
    const meta = metaDoDia(d);
    mapa.set(d, { dia: d, aguaMl: 0, outrasMl: 0, copos: 0, meta, treino: treinoDoDia(d), bateu: false });
  }
  for (const r of registros) {
    const d = mapa.get(r.day);
    if (!d) continue;
    if (r.beverage === "agua") {
      d.aguaMl += r.amountMl;
      d.copos++;
    } else d.outrasMl += r.amountMl;
  }
  for (const d of mapa.values()) d.bateu = d.meta > 0 && d.aguaMl >= d.meta;
  return dias.map((d) => mapa.get(d)!);
}

/** Dias seguidos batendo a meta; hoje ainda não batido não quebra. */
export function sequenciaMeta(dias: DiaAgua[], hoje: ChaveDia): number {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  let n = 0;
  let d = hoje;
  if (porDia.get(d)?.bateu) n++;
  d = somaDias(d, -1);
  while (porDia.has(d) && porDia.get(d)!.bateu) {
    n++;
    d = somaDias(d, -1);
  }
  return n;
}

export function media(valores: number[]): number {
  return valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
}

/** Médias de dias de treino × descanso (só dias já terminados com algum registro). */
export function treinoVsDescanso(dias: DiaAgua[], hoje: ChaveDia): { treino: number; descanso: number; nTreino: number; nDescanso: number } {
  const passados = dias.filter((d) => d.dia < hoje && d.aguaMl > 0);
  const t = passados.filter((d) => d.treino).map((d) => d.aguaMl);
  const r = passados.filter((d) => !d.treino).map((d) => d.aguaMl);
  return { treino: media(t), descanso: media(r), nTreino: t.length, nDescanso: r.length };
}

/** Água por hora do dia (para ver a regularidade). */
export function porHora(registros: RegistroAgua[]): number[] {
  const horas = new Array(24).fill(0);
  for (const r of registros) if (r.beverage === "agua") horas[r.hora] += r.amountMl;
  return horas;
}

/** Regularidade: % das horas acordado (8h–22h) com algum registro, na média dos dias. */
export function regularidade(registros: RegistroAgua[], dias: ChaveDia[], de = 8, ate = 22): number {
  if (!dias.length) return 0;
  const porDia = new Map<ChaveDia, Set<number>>();
  for (const r of registros) {
    if (r.beverage !== "agua" || r.hora < de || r.hora >= ate) continue;
    // blocos de 2 h
    const bloco = Math.floor((r.hora - de) / 2);
    if (!porDia.has(r.day)) porDia.set(r.day, new Set());
    porDia.get(r.day)!.add(bloco);
  }
  const blocos = Math.ceil((ate - de) / 2);
  let soma = 0;
  for (const d of dias) soma += (porDia.get(d)?.size ?? 0) / blocos;
  return Math.round((soma / dias.length) * 100);
}

export function formatarMl(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
  }
  return `${ml.toLocaleString("pt-BR")} ml`;
}
