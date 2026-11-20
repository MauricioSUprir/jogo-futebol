// GOALS CENTER — regras puras (sem banco nem DOM; tests/unit/metas.test.ts).
import { diasEntre, type ChaveDia } from "./datas";

export const CATEGORIAS_META = {
  saude: { nome: "Saúde e atividades físicas", curto: "Saúde", cor: "#34D399" },
  estudos: { nome: "Estudos", curto: "Estudos", cor: "#60A5FA" },
  tecnologia: { nome: "Tecnologia", curto: "Tecnologia", cor: "#22D3EE" },
  financas: { nome: "Finanças pessoais", curto: "Finanças", cor: "#F59E0B" },
  futebol: { nome: "Futebol", curto: "Futebol", cor: "#A3E635" },
  pessoal: { nome: "Desenvolvimento pessoal", curto: "Pessoal", cor: "#A78BFA" },
  criativo: { nome: "Projetos criativos", curto: "Criativo", cor: "#F472B6" },
} as const;

export type CategoriaMeta = keyof typeof CATEGORIAS_META;

export function categoriaMeta(c: string) {
  return CATEGORIAS_META[c as CategoriaMeta] ?? CATEGORIAS_META.pessoal;
}

export const PRIORIDADES_META: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };

export interface MetaProgresso {
  measure: string; // etapas | numero
  target: number | null;
  current: number;
  steps: { done: boolean }[];
}

/** Progresso 0–100. Etapas: feitas ÷ total; número: atual ÷ alvo. */
export function progressoMeta(m: MetaProgresso): number {
  if (m.measure === "numero") {
    if (!m.target || m.target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((m.current / m.target) * 100)));
  }
  if (!m.steps.length) return 0;
  return Math.round((m.steps.filter((s) => s.done).length / m.steps.length) * 100);
}

/** Bateu o alvo (número) ou terminou todas as etapas (com pelo menos uma). */
export function metaCumprida(m: MetaProgresso): boolean {
  if (m.measure === "numero") return !!m.target && m.target > 0 && m.current >= m.target;
  return m.steps.length > 0 && m.steps.every((s) => s.done);
}

/** "20 de 50 gols", "2 de 3 etapas" */
export function textoProgresso(m: MetaProgresso & { unit?: string | null }): string {
  if (m.measure === "numero") {
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return `${f(m.current)} de ${f(m.target ?? 0)}${m.unit ? ` ${m.unit}` : ""}`;
  }
  const feitas = m.steps.filter((s) => s.done).length;
  return `${feitas} de ${m.steps.length} ${m.steps.length === 1 ? "etapa" : "etapas"}`;
}

/** Texto do prazo: "vence hoje", "faltam 3 dias", "venceu há 2 dias". */
export function textoPrazo(prazo: ChaveDia, hoje: ChaveDia): { texto: string; atrasada: boolean } {
  const n = diasEntre(hoje, prazo);
  if (n === 0) return { texto: "vence hoje", atrasada: false };
  if (n === 1) return { texto: "vence amanhã", atrasada: false };
  if (n > 1) return { texto: `faltam ${n} dias`, atrasada: false };
  return { texto: n === -1 ? "venceu ontem" : `venceu há ${-n} dias`, atrasada: true };
}

export interface MetaOrdenavel {
  priority: number;
  prazo: ChaveDia | null;
  progresso: number;
  criadaEm: number;
}

export type OrdemMetas = "prioridade" | "prazo" | "progresso" | "recentes";

/** Organizar prioridades: alta primeiro (e, empatando, o prazo mais perto); ou por prazo, progresso ou mais recentes. */
export function ordenarMetas<T extends MetaOrdenavel>(metas: T[], ordem: OrdemMetas = "prioridade"): T[] {
  const prazo = (m: T) => m.prazo ?? "9999-12-31";
  return [...metas].sort((a, b) => {
    switch (ordem) {
      case "prazo":
        return prazo(a).localeCompare(prazo(b)) || a.priority - b.priority;
      case "progresso":
        return b.progresso - a.progresso || a.priority - b.priority;
      case "recentes":
        return b.criadaEm - a.criadaEm;
      default:
        return a.priority - b.priority || prazo(a).localeCompare(prazo(b)) || b.criadaEm - a.criadaEm;
    }
  });
}

// ───────────── Conquistas ─────────────

export interface MetaConquista {
  status: string;
  category: string;
  year: number | null;
  prazo: ChaveDia | null;
  concluidaEm: ChaveDia | null;
}

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  ok: boolean;
}

export function conquistasMetas(metas: MetaConquista[]): Conquista[] {
  const feitas = metas.filter((m) => m.status === "concluido");
  const categorias = new Set(feitas.map((m) => m.category));
  return [
    { id: "primeira", nome: "Primeira meta", descricao: "Concluir a primeira meta.", ok: feitas.length >= 1 },
    { id: "cinco", nome: "Cinco metas", descricao: "Concluir 5 metas.", ok: feitas.length >= 5 },
    { id: "anual", nome: "Objetivo do ano", descricao: "Concluir um objetivo anual.", ok: feitas.some((m) => m.year !== null) },
    {
      id: "antes-prazo",
      nome: "Antes do prazo",
      descricao: "Concluir uma meta até o prazo.",
      ok: feitas.some((m) => m.prazo !== null && m.concluidaEm !== null && m.concluidaEm <= m.prazo),
    },
    { id: "tres-categorias", nome: "Equilíbrio", descricao: "Concluir metas em 3 categorias diferentes.", ok: categorias.size >= 3 },
  ];
}
