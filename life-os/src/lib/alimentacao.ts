// NUTRITION HUB — regras PURAS (tests/unit/alimentacao.test.ts).
// Organiza hábitos alimentares sem calorias, peso, "comida boa/ruim" nem dieta restritiva:
// o objetivo é uma alimentação suficiente e variada. As sugestões são convites, nunca críticas.
import { diaDaSemana, horaParaMinutos, minutosParaHora, type ChaveDia } from "./datas";

export const REFEICOES = {
  cafe: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
  ceia: "Ceia",
  pre_treino: "Pré-treino",
  pos_treino: "Pós-treino",
  outro: "Outro",
} as const;
export type Refeicao = keyof typeof REFEICOES;

export function refeicaoValida(r: string): r is Refeicao {
  return r in REFEICOES;
}

/** Grupos de alimentos. "outros" não conta na variedade. */
export const GRUPOS = {
  frutas: "Frutas",
  vegetais: "Vegetais",
  cereais: "Cereais e pães",
  proteinas: "Proteínas",
  leguminosas: "Leguminosas",
  laticinios: "Laticínios",
  oleaginosas: "Oleaginosas",
  outros: "Outros",
} as const;
export type Grupo = keyof typeof GRUPOS;
export const GRUPOS_VARIEDADE = (Object.keys(GRUPOS) as Grupo[]).filter((g) => g !== "outros");

export function grupoValido(g: string): g is Grupo {
  return g in GRUPOS;
}

export const FOME: Record<number, string> = { 1: "Sem fome", 2: "Pouca fome", 3: "Fome moderada", 4: "Bastante fome", 5: "Muita fome" };
export const SACIEDADE: Record<number, string> = { 1: "Ainda com fome", 2: "Quase satisfeito", 3: "Satisfeito", 4: "Bem satisfeito", 5: "Muito cheio" };

export const CATEGORIAS_COMPRAS = {
  hortifruti: "Hortifrúti",
  padaria: "Padaria",
  laticinios: "Laticínios e ovos",
  carnes: "Carnes e peixes",
  mercearia: "Mercearia",
  bebidas: "Bebidas",
  limpeza: "Limpeza e casa",
  outros: "Outros",
} as const;
export type CategoriaCompra = keyof typeof CATEGORIAS_COMPRAS;

export function categoriaCompraValida(c: string): c is CategoriaCompra {
  return c in CATEGORIAS_COMPRAS;
}

/** Tipo de refeição mais provável pelo horário local (minutos desde a meia-noite). */
export function sugerirRefeicao(minutos: number): Refeicao {
  if (minutos < 5 * 60) return "ceia";
  if (minutos < 10 * 60) return "cafe";
  if (minutos < 11 * 60 + 30) return "lanche_manha";
  if (minutos < 14 * 60 + 30) return "almoco";
  if (minutos < 18 * 60) return "lanche_tarde";
  if (minutos < 21 * 60 + 30) return "jantar";
  return "ceia";
}

export interface RefeicaoReg {
  dia: ChaveDia;
  minutos: number; // horário local (minutos desde a meia-noite)
  tipo: string;
  grupos: string[];
}

/** Grupos diferentes (da variedade) num conjunto de refeições. */
export function gruposDiferentes(refeicoes: Pick<RefeicaoReg, "grupos">[]): Grupo[] {
  const s = new Set<Grupo>();
  for (const r of refeicoes) for (const g of r.grupos) if (grupoValido(g) && g !== "outros") s.add(g);
  return GRUPOS_VARIEDADE.filter((g) => s.has(g));
}

/** Por dia: refeições e grupos diferentes. Dias sem registro ficam de fora. */
export function resumoPorDia(refeicoes: RefeicaoReg[]): Map<ChaveDia, { refeicoes: number; grupos: Grupo[] }> {
  const por = new Map<ChaveDia, RefeicaoReg[]>();
  for (const r of refeicoes) por.set(r.dia, [...(por.get(r.dia) ?? []), r]);
  return new Map([...por.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, rs]) => [d, { refeicoes: rs.length, grupos: gruposDiferentes(rs) }]));
}

/** Em quantos dos `dias` houve pelo menos uma refeição com o grupo. */
export function diasComGrupo(refeicoes: RefeicaoReg[], grupo: Grupo, dias: ChaveDia[]): number {
  const alvo = new Set(dias);
  return new Set(refeicoes.filter((r) => alvo.has(r.dia) && r.grupos.includes(grupo)).map((r) => r.dia)).size;
}

/**
 * Presença de cada grupo nos dias com registro (do mais ao menos presente).
 * pct = dias com o grupo ÷ dias com alguma refeição registrada.
 */
export function presencaDosGrupos(refeicoes: RefeicaoReg[]): { grupo: Grupo; dias: number; pct: number }[] {
  const diasRegistrados = new Set(refeicoes.map((r) => r.dia));
  const n = diasRegistrados.size;
  return GRUPOS_VARIEDADE.map((g) => {
    const dias = new Set(refeicoes.filter((r) => r.grupos.includes(g)).map((r) => r.dia)).size;
    return { grupo: g, dias, pct: n ? Math.round((dias / n) * 100) : 0 };
  }).sort((a, b) => b.dias - a.dias || GRUPOS_VARIEDADE.indexOf(a.grupo) - GRUPOS_VARIEDADE.indexOf(b.grupo));
}

/**
 * Regularidade do horário de uma refeição: média e desvio (minutos).
 * "regular" = desvio ≤ 45 min com pelo menos 3 registros. Usa só o 1º registro do tipo em cada dia.
 */
export function regularidadeHorario(refeicoes: RefeicaoReg[], tipo: Refeicao): { media: string; desvioMin: number; n: number; regular: boolean } | null {
  const primeiro = new Map<ChaveDia, number>();
  for (const r of refeicoes) {
    if (r.tipo !== tipo) continue;
    const atual = primeiro.get(r.dia);
    if (atual === undefined || r.minutos < atual) primeiro.set(r.dia, r.minutos);
  }
  const v = [...primeiro.values()];
  if (v.length < 2) return null;
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  const desvio = Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / v.length);
  return { media: minutosParaHora(Math.round(media)), desvioMin: Math.round(desvio), n: v.length, regular: v.length >= 3 && desvio <= 45 };
}

export interface ItemPlano {
  weekdays: number; // bit 0 = domingo … bit 6 = sábado
  trainingDay: boolean;
}

/** Itens do planejamento que valem no dia: os do dia da semana, e os "de dia de treino" só quando for. */
export function planoDoDia<T extends ItemPlano>(itens: T[], dia: ChaveDia, diaDeTreino: boolean): T[] {
  const bit = 1 << diaDaSemana(dia);
  return itens.filter((i) => (i.weekdays & bit) !== 0 && (!i.trainingDay || diaDeTreino));
}

/** Separa por vírgula, menos dentro de parênteses e no número decimal ("1,5 xícara"). */
function separarVirgulas(linha: string): string[] {
  const partes: string[] = [];
  let atual = "";
  let nivel = 0;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === "(") nivel++;
    if (c === ")") nivel = Math.max(0, nivel - 1);
    const decimal = c === "," && /\d/.test(linha[i - 1] ?? "") && /\d/.test(linha[i + 1] ?? "");
    if (c === "," && nivel === 0 && !decimal) {
      partes.push(atual);
      atual = "";
    } else atual += c;
  }
  partes.push(atual);
  return partes;
}

/** Ingredientes de uma receita (uma linha ou vírgula por item) → itens da lista de compras. */
export function ingredientesParaLista(texto: string): string[] {
  const vistos = new Set<string>();
  const r: string[] = [];
  for (const bruto of texto.split(/\r?\n|;/).flatMap(separarVirgulas)) {
    const nome = bruto
      .replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    if (!nome) continue;
    const k = nome.toLocaleLowerCase("pt-BR");
    if (vistos.has(k)) continue;
    vistos.add(k);
    r.push(nome);
  }
  return r;
}

export interface Sugestao {
  tom: "positivo" | "neutro" | "atencao";
  texto: string;
}

/**
 * Sugestões gentis a partir da última semana (até `dias` com registro). Só com pelo menos 3 dias registrados.
 * Nunca falam de quantidade, calorias ou peso: só de incluir variedade.
 */
export function sugestoesGentis(refeicoes: RefeicaoReg[], ultimos7: ChaveDia[]): Sugestao[] {
  const alvo = new Set(ultimos7);
  const daSemana = refeicoes.filter((r) => alvo.has(r.dia));
  const diasRegistrados = new Set(daSemana.map((r) => r.dia)).size;
  if (diasRegistrados < 3) return [];
  const r: Sugestao[] = [];
  const variedade = gruposDiferentes(daSemana).length;
  if (variedade >= 6) r.push({ tom: "positivo", texto: `Semana variada: ${variedade} grupos de alimentos diferentes nos seus registros.` });
  const fruta = diasComGrupo(daSemana, "frutas", ultimos7);
  const vegetal = diasComGrupo(daSemana, "vegetais", ultimos7);
  if (fruta < Math.ceil(diasRegistrados / 2)) r.push({ tom: "neutro", texto: "Que tal incluir uma fruta no lanche? Ela apareceu em poucos dias desta semana." });
  else if (fruta >= diasRegistrados) r.push({ tom: "positivo", texto: "Fruta em todos os dias registrados da semana." });
  if (vegetal < Math.ceil(diasRegistrados / 2)) r.push({ tom: "neutro", texto: "Um vegetal no almoço ou no jantar ajuda a variar o prato." });
  return r.slice(0, 2);
}

/** Minutos locais de "HH:MM" (ou null). */
export function minutosDe(hhmm: string): number | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? horaParaMinutos(hhmm) : null;
}
