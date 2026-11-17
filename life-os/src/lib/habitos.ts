// Regras dos hábitos — PURAS (tests/unit/habitos.test.ts).
// Princípio do projeto: sequências são só motivacionais. Hoje ainda não feito NÃO quebra a sequência,
// e dia de descanso planejado ("descanso") é neutro: não conta como falta.
import { type ChaveDia, diaDaSemana, inicioDaSemana, somaDias, diasEntre } from "./datas";

export type Frequencia = "diario" | "dias" | "semanal";

export interface DefHabito {
  frequency: Frequencia | string;
  weekdays: number; // bit 0 = domingo … bit 6 = sábado
  timesPerWeek: number;
  targetPerDay: number;
  startDay: ChaveDia;
}

export interface RegistroDia {
  count: number;
  skipped: boolean;
}

export type Registros = Map<ChaveDia, RegistroDia>;

export type StatusDia = "feito" | "parcial" | "descanso" | "pendente" | "livre";

export const MARCOS_SEQUENCIA = [3, 7, 14, 30, 60, 100, 180, 365];

export function programado(h: DefHabito, dia: ChaveDia): boolean {
  if (dia < h.startDay) return false;
  if (h.frequency === "dias") return (h.weekdays & (1 << diaDaSemana(dia))) !== 0;
  return true;
}

export function feito(h: DefHabito, r: RegistroDia | undefined): boolean {
  return !!r && r.count >= Math.max(1, h.targetPerDay);
}

export function statusDoDia(h: DefHabito, r: RegistroDia | undefined, dia: ChaveDia): StatusDia {
  if (feito(h, r)) return "feito";
  if (r?.skipped) return "descanso";
  if (!programado(h, dia)) return "livre";
  if (r && r.count > 0) return "parcial";
  return "pendente";
}

export interface Sequencia {
  valor: number;
  unidade: "dias" | "semanas";
}

// ───── Hábitos por semana ("X vezes por semana") ─────

/** Quantas vezes foi feito na semana que começa em `segunda`, até `ate` (inclusive). */
function feitosNaSemana(h: DefHabito, regs: Registros, segunda: ChaveDia, ate: ChaveDia): { feitos: number; descansos: number } {
  let feitos = 0;
  let descansos = 0;
  for (let i = 0; i < 7; i++) {
    const d = somaDias(segunda, i);
    if (d > ate) break;
    const r = regs.get(d);
    if (feito(h, r)) feitos++;
    else if (r?.skipped) descansos++;
  }
  return { feitos, descansos };
}

function semanaCumprida(h: DefHabito, regs: Registros, segunda: ChaveDia, ate: ChaveDia): boolean {
  const { feitos, descansos } = feitosNaSemana(h, regs, segunda, ate);
  return feitos + descansos >= Math.max(1, h.timesPerWeek);
}

export function progressoSemana(h: DefHabito, regs: Registros, hoje: ChaveDia): { feitos: number; meta: number } {
  const { feitos } = feitosNaSemana(h, regs, inicioDaSemana(hoje), hoje);
  return { feitos, meta: Math.max(1, h.timesPerWeek) };
}

// ───── Sequências ─────

export function sequenciaAtual(h: DefHabito, regs: Registros, hoje: ChaveDia): Sequencia {
  if (h.frequency === "semanal") {
    let valor = 0;
    let segunda = inicioDaSemana(hoje);
    // A semana atual conta se já foi cumprida; se não, ainda está em andamento (não quebra).
    if (semanaCumprida(h, regs, segunda, hoje)) valor++;
    segunda = somaDias(segunda, -7);
    while (somaDias(segunda, 6) >= h.startDay) {
      if (!semanaCumprida(h, regs, segunda, somaDias(segunda, 6))) break;
      valor++;
      segunda = somaDias(segunda, -7);
    }
    return { valor, unidade: "semanas" };
  }

  let valor = 0;
  let dia = hoje;
  // Hoje ainda não feito fica de fora (está pendente, não perdido).
  if (!feito(h, regs.get(dia))) dia = somaDias(dia, -1);
  else {
    valor = 1;
    dia = somaDias(dia, -1);
  }
  while (dia >= h.startDay) {
    const r = regs.get(dia);
    if (feito(h, r)) valor++;
    else if (r?.skipped || !programado(h, dia)) {
      // neutro
    } else break;
    dia = somaDias(dia, -1);
  }
  return { valor, unidade: "dias" };
}

export function melhorSequencia(h: DefHabito, regs: Registros, hoje: ChaveDia): Sequencia {
  if (h.frequency === "semanal") {
    let melhor = 0;
    let atual = 0;
    for (let s = inicioDaSemana(h.startDay); s <= hoje; s = somaDias(s, 7)) {
      const fim = somaDias(s, 6) > hoje ? hoje : somaDias(s, 6);
      if (semanaCumprida(h, regs, s, fim)) {
        atual++;
        melhor = Math.max(melhor, atual);
      } else if (fim < hoje) atual = 0;
    }
    return { valor: melhor, unidade: "semanas" };
  }
  let melhor = 0;
  let atual = 0;
  for (let d = h.startDay; d <= hoje; d = somaDias(d, 1)) {
    const r = regs.get(d);
    if (feito(h, r)) {
      atual++;
      melhor = Math.max(melhor, atual);
    } else if (r?.skipped || !programado(h, d)) {
      // neutro
    } else if (d < hoje) atual = 0;
  }
  return { valor: melhor, unidade: "dias" };
}

// ───── Taxa de conclusão ─────

export interface Taxa {
  feitos: number;
  esperados: number;
  pct: number; // 0–100
}

/**
 * Conclusão no intervalo [de, ate] (até hoje). Dias de descanso saem da conta;
 * hoje só entra se já foi feito (não pune o dia em andamento).
 */
export function taxaConclusao(h: DefHabito, regs: Registros, de: ChaveDia, ate: ChaveDia, hoje: ChaveDia): Taxa {
  const inicio = de < h.startDay ? h.startDay : de;
  const fim = ate > hoje ? hoje : ate;
  let feitos = 0;
  let esperados = 0;
  if (h.frequency === "semanal") {
    for (let s = inicioDaSemana(inicio); s <= fim; s = somaDias(s, 7)) {
      const fimSemana = somaDias(s, 6);
      const { feitos: f, descansos } = feitosNaSemana(h, regs, s, fimSemana > fim ? fim : fimSemana);
      const meta = Math.max(0, Math.max(1, h.timesPerWeek) - descansos);
      const emAndamento = fimSemana >= hoje;
      if (emAndamento && f < meta) {
        // semana atual incompleta: conta só o que já foi feito
        feitos += f;
        esperados += f;
        continue;
      }
      feitos += Math.min(f, meta);
      esperados += meta;
    }
  } else {
    for (let d = inicio; d <= fim; d = somaDias(d, 1)) {
      if (!programado(h, d)) continue;
      const r = regs.get(d);
      if (feito(h, r)) {
        feitos++;
        esperados++;
      } else if (r?.skipped) continue;
      else if (d < hoje) esperados++;
    }
  }
  return { feitos, esperados, pct: esperados ? Math.round((feitos / esperados) * 100) : 0 };
}

export function totalConclusoes(h: DefHabito, regs: Registros): number {
  let n = 0;
  for (const r of regs.values()) if (feito(h, r)) n++;
  return n;
}

export function marcosAlcancados(melhor: number): number[] {
  return MARCOS_SEQUENCIA.filter((m) => melhor >= m);
}

export function proximoMarco(atual: number): number | null {
  return MARCOS_SEQUENCIA.find((m) => m > atual) ?? null;
}

/** Texto curto da frequência: "Todos os dias", "Seg, Qua, Sex", "3× por semana". */
export function textoFrequencia(h: Pick<DefHabito, "frequency" | "weekdays" | "timesPerWeek" | "targetPerDay">): string {
  const vezes = h.targetPerDay > 1 ? ` · ${h.targetPerDay}× ao dia` : "";
  if (h.frequency === "semanal") return `${h.timesPerWeek}× por semana`;
  if (h.frequency === "dias") {
    if (h.weekdays === 127) return "Todos os dias" + vezes;
    if (h.weekdays === 62) return "Dias úteis" + vezes;
    if (h.weekdays === 65) return "Fins de semana" + vezes;
    const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    return ordem.filter((i) => h.weekdays & (1 << i)).map((i) => nomes[i]).join(", ") + vezes;
  }
  return "Todos os dias" + vezes;
}

/** Dias desde o início (para mostrar "há N dias"). */
export function idadeEmDias(h: DefHabito, hoje: ChaveDia): number {
  return Math.max(0, diasEntre(h.startDay, hoje));
}
