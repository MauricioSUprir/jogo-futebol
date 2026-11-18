// STUDY CENTER — regras puras (sem banco nem DOM; tests/unit/estudos.test.ts).
// Revisões espaçadas, flashcards de Leitner, média ponderada e "quanto falta", plano da semana,
// status do painel escolar e as fases do Pomodoro.
import { diasEntre, somaDias, type ChaveDia } from "./datas";

// ───────────── Catálogos ─────────────

export const TIPOS_SESSAO: Record<string, string> = {
  estudo: "Estudo",
  pomodoro: "Pomodoro",
  exercicios: "Exercícios",
  revisao: "Revisão",
  simulado: "Simulado",
  leitura: "Leitura",
};

export const STATUS_CONTEUDO: Record<string, string> = {
  pendente: "Pendente",
  estudando: "Estudando",
  concluido: "Concluído",
};

/** Itens que já vêm no checklist de toda prova nova (editáveis). */
export const CHECKLIST_PADRAO = ["Revisar os resumos", "Fazer exercícios", "Separar o material", "Dormir bem na véspera"];

// ───────────── Revisões programadas (repetição espaçada) ─────────────

/** Dias depois da conclusão (1ª revisão) e depois de cada revisão feita. */
export const INTERVALOS_REVISAO = [1, 3, 7, 14, 30] as const;

/**
 * Próxima revisão de um conteúdo. `feitas` = quantas revisões já foram feitas (0 logo ao concluir).
 * Depois da última (5 revisões), o ciclo termina (null).
 */
export function proximaRevisao(feitas: number, dia: ChaveDia): ChaveDia | null {
  const intervalo = INTERVALOS_REVISAO[feitas];
  return intervalo === undefined ? null : somaDias(dia, intervalo);
}

/** Uma revisão feita hoje: a etapa sobe e a próxima data vem do intervalo seguinte. */
export function registrarRevisao(etapa: number, hoje: ChaveDia): { etapa: number; proxima: ChaveDia | null } {
  const nova = etapa + 1;
  return { etapa: nova, proxima: proximaRevisao(nova, hoje) };
}

// ───────────── Flashcards (caixas de Leitner) ─────────────

/** Dias até a próxima revisão em cada caixa (1–5). */
export const DIAS_CAIXA: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

/** Acertou: sobe uma caixa (até a 5) e espaça; errou: volta para a caixa 1 (revê amanhã). */
export function responderCartao(caixa: number, acertou: boolean, hoje: ChaveDia): { caixa: number; proxima: ChaveDia } {
  const atual = Math.min(5, Math.max(1, Math.round(caixa) || 1));
  const nova = acertou ? Math.min(5, atual + 1) : 1;
  return { caixa: nova, proxima: somaDias(hoje, DIAS_CAIXA[nova]) };
}

// ───────────── Notas e "quanto falta" ─────────────

export interface Nota {
  valor: number;
  max: number;
  peso: number;
}

/** Nota na escala 0–10. */
export function naEscala10(n: Pick<Nota, "valor" | "max">): number {
  return n.max > 0 ? (n.valor / n.max) * 10 : 0;
}

/** Média ponderada na escala 0–10 (null sem notas). */
export function mediaPonderada(notas: Nota[]): number | null {
  const validas = notas.filter((n) => n.peso > 0 && n.max > 0);
  const pesos = validas.reduce((s, n) => s + n.peso, 0);
  if (!pesos) return null;
  return validas.reduce((s, n) => s + naEscala10(n) * n.peso, 0) / pesos;
}

export type SituacaoMedia = "sem-notas" | "garantido" | "possivel" | "impossivel";

export interface QuantoFalta {
  situacao: SituacaoMedia;
  media: number | null;
  /** Nota necessária (0–10) na próxima avaliação; null se impossível. */
  necessaria: number | null;
}

/** Arredonda PARA CIMA em 0,1 (a nota que garante a média), sem pegar sujeira de ponto flutuante. */
export function arredondaCima1(x: number): number {
  return Math.ceil(x * 10 - 1e-9) / 10;
}

/**
 * Quanto tirar na próxima avaliação (peso `pesoProxima`) para a média ponderada chegar a `alvo`.
 * Conta: (alvo × (W + p) − Σ nota×peso) ÷ p, na escala 0–10.
 */
export function notaNecessaria(notas: Nota[], alvo: number, pesoProxima = 1): QuantoFalta {
  const validas = notas.filter((n) => n.peso > 0 && n.max > 0);
  const media = mediaPonderada(validas);
  const p = pesoProxima > 0 ? pesoProxima : 1;
  if (media === null) return { situacao: "sem-notas", media: null, necessaria: arredondaCima1(Math.max(0, Math.min(10, alvo))) };
  const W = validas.reduce((s, n) => s + n.peso, 0);
  const S = validas.reduce((s, n) => s + naEscala10(n) * n.peso, 0);
  const x = (alvo * (W + p) - S) / p;
  if (x <= 0) return { situacao: "garantido", media, necessaria: 0 };
  if (x > 10 + 1e-9) return { situacao: "impossivel", media, necessaria: null };
  return { situacao: "possivel", media, necessaria: arredondaCima1(x) };
}

/** "8,0" / "7,5" */
export function formatarNota(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ───────────── Planejamento da semana ─────────────

export interface MateriaPlano {
  id: string;
  nome: string;
  metaMin: number;
  feitosMin: number;
  /** Minutos já planejados em tarefas abertas ("Estudar <nome>"). */
  planejadosMin: number;
  /** Dias até a próxima prova da matéria (null se não houver). */
  provaEmDias: number | null;
}

export interface TarefaPlano {
  materiaId: string;
  titulo: string;
  duracao: number;
  prioridade: 1 | 2 | 3;
}

export const BLOCO_ESTUDO = 45;
const BLOCO_MINIMO = 15;

/**
 * Tarefas "Estudar <matéria>" para o que falta da meta semanal (meta − estudado − já planejado), em blocos de 45 min
 * (o último arredondado para no mínimo 15). Prioridade alta para quem tem prova nos próximos 7 dias.
 */
export function planejarSemana(materias: MateriaPlano[], bloco = BLOCO_ESTUDO): TarefaPlano[] {
  const r: TarefaPlano[] = [];
  const ordem = [...materias].sort((a, b) => (a.provaEmDias ?? 999) - (b.provaEmDias ?? 999));
  for (const m of ordem) {
    let falta = Math.max(0, m.metaMin - m.feitosMin - m.planejadosMin);
    if (falta < BLOCO_MINIMO) continue;
    const prioridade = m.provaEmDias !== null && m.provaEmDias >= 0 && m.provaEmDias <= 7 ? 1 : 2;
    while (falta >= BLOCO_MINIMO) {
      // Sobra pequena (< 15 min) entra no último bloco em vez de virar uma tarefa curta demais.
      const dur = falta < bloco + BLOCO_MINIMO ? Math.ceil(falta / 5) * 5 : bloco;
      r.push({ materiaId: m.id, titulo: tituloEstudo(m.nome), duracao: dur, prioridade });
      falta -= dur;
    }
  }
  return r;
}

export function tituloEstudo(nome: string): string {
  return `Estudar ${nome}`;
}

// ───────────── Painel escolar ─────────────

export interface EstadoMateria {
  revisoesVencidas: number;
  concluidos: number;
  totalConteudos: number;
  /** Última sessão de estudo da matéria. */
  ultima: { dia: ChaveDia; tipo: string } | null;
}

/** A frase do painel escolar ("revisão pendente", "exercícios concluídos", "conteúdo revisado"…). */
export function statusMateria(e: EstadoMateria, hoje: ChaveDia): { texto: string; tom: "positivo" | "neutro" | "atencao" } {
  if (e.revisoesVencidas > 0) return { texto: e.revisoesVencidas === 1 ? "revisão pendente" : `${e.revisoesVencidas} revisões pendentes`, tom: "atencao" };
  if (e.ultima) {
    const dias = diasEntre(e.ultima.dia, hoje);
    if (dias <= 7) {
      const t = e.ultima.tipo;
      if (t === "exercicios") return { texto: "exercícios concluídos", tom: "positivo" };
      if (t === "revisao") return { texto: "conteúdo revisado", tom: "positivo" };
      if (t === "simulado") return { texto: "simulado feito", tom: "positivo" };
      return { texto: dias === 0 ? "estudou hoje" : "estudo em dia", tom: "positivo" };
    }
    return { texto: `sem estudar há ${dias} dias`, tom: "atencao" };
  }
  if (e.totalConteudos > 0) return { texto: `${e.concluidos} de ${e.totalConteudos} conteúdos concluídos`, tom: "neutro" };
  return { texto: "ainda sem estudo registrado", tom: "neutro" };
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function contagem(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias > 1) return `em ${dias} dias`;
  if (dias === -1) return "ontem";
  return `há ${-dias} dias`;
}

/** "1 h 30", "45 min" */
export function formatarMinutos(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

// ───────────── Pomodoro ─────────────

export type FasePomodoro = "foco" | "curta" | "longa";

export interface ConfigPomodoro {
  foco: number;
  curta: number;
  longa: number;
  /** Pausa longa a cada N focos. */
  cadaLonga: number;
}

export const POMODORO_PADRAO: ConfigPomodoro = { foco: 25, curta: 5, longa: 15, cadaLonga: 4 };

/** Fase seguinte: depois do N-ésimo foco, pausa longa se N for múltiplo de `cadaLonga`; depois de pausa, foco. */
export function proximaFase(fase: FasePomodoro, focosFeitos: number, cfg: ConfigPomodoro): FasePomodoro {
  if (fase !== "foco") return "foco";
  return focosFeitos > 0 && focosFeitos % Math.max(1, cfg.cadaLonga) === 0 ? "longa" : "curta";
}

export function configPomodoro(bruto: Partial<ConfigPomodoro> | undefined): ConfigPomodoro {
  const n = (v: unknown, min: number, max: number, pad: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) && x >= min && x <= max ? x : pad;
  };
  return {
    foco: n(bruto?.foco, 5, 90, POMODORO_PADRAO.foco),
    curta: n(bruto?.curta, 1, 30, POMODORO_PADRAO.curta),
    longa: n(bruto?.longa, 5, 60, POMODORO_PADRAO.longa),
    cadaLonga: n(bruto?.cadaLonga, 2, 8, POMODORO_PADRAO.cadaLonga),
  };
}
