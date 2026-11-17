// Ocorrências de eventos (inclusive repetidos) num intervalo de dias — PURO (tests/unit/recorrencia.test.ts).
import {
  type ChaveDia,
  chaveNoFuso,
  dataParaChave,
  diaDaSemana,
  diasEntre,
  diasNoMes,
  horaNoFuso,
  localParaUtc,
  somaDias,
} from "./datas";

export type Recorrencia = "nenhuma" | "diaria" | "semanal" | "mensal" | "anual";

export interface EventoBase {
  id: string;
  allDay: boolean;
  start: Date;
  end: Date | null;
  recurrence: string;
  recurrenceUntil: Date | null; // @db.Date
}

export interface Ocorrencia {
  id: string;
  /** Chave do dia em que começa (local). */
  dia: ChaveDia;
  /** Último dia que a ocorrência ocupa (eventos de vários dias). */
  diaFim: ChaveDia;
  inicio: Date;
  fim: Date | null;
}

/** O dia `base` repete em `dia`? */
function repeteEm(rec: string, base: ChaveDia, dia: ChaveDia): boolean {
  if (dia < base) return false;
  if (dia === base) return true;
  const [, bm, bd] = base.split("-").map(Number);
  const [da, dm, dd] = dia.split("-").map(Number);
  switch (rec) {
    case "diaria":
      return true;
    case "semanal":
      return diaDaSemana(dia) === diaDaSemana(base);
    case "mensal":
      // dia 31 cai no último dia dos meses mais curtos
      return dd === Math.min(bd, diasNoMes(da, dm));
    case "anual":
      if (dm !== bm) return false;
      return dd === Math.min(bd, diasNoMes(da, dm));
    default:
      return false;
  }
}

export function ocorrencias(ev: EventoBase, de: ChaveDia, ate: ChaveDia, fuso: string): Ocorrencia[] {
  const base = ev.allDay ? dataParaChave(ev.start) : chaveNoFuso(ev.start, fuso);
  const fimBase = ev.end ? (ev.allDay ? dataParaChave(ev.end) : chaveNoFuso(new Date(ev.end.getTime() - 1), fuso)) : base;
  const dur = ev.end ? ev.end.getTime() - ev.start.getTime() : 0;
  const extensao = Math.max(0, diasEntre(base, fimBase < base ? base : fimBase));
  const hora = ev.allDay ? "00:00" : horaNoFuso(ev.start, fuso);
  const ate2 = ev.recurrenceUntil ? (dataParaChave(ev.recurrenceUntil) < ate ? dataParaChave(ev.recurrenceUntil) : ate) : ate;

  const lista: Ocorrencia[] = [];
  const montar = (dia: ChaveDia): Ocorrencia => {
    const inicio = ev.allDay ? new Date(dia + "T00:00:00.000Z") : localParaUtc(dia, hora, fuso);
    return {
      id: ev.id,
      dia,
      diaFim: somaDias(dia, extensao),
      inicio,
      fim: ev.end ? new Date(inicio.getTime() + dur) : null,
    };
  };

  if (ev.recurrence === "nenhuma" || !ev.recurrence) {
    if (base <= ate && somaDias(base, extensao) >= de) lista.push(montar(base));
    return lista;
  }
  // Começa antes do intervalo o bastante para pegar eventos de vários dias que já estão em andamento.
  let d = somaDias(de, -extensao);
  if (d < base) d = base;
  for (; d <= ate2; d = somaDias(d, 1)) {
    if (repeteEm(ev.recurrence, base, d)) lista.push(montar(d));
  }
  // Ocorrências que começam depois de `ate` nunca entram; as que terminam antes de `de` saem.
  return lista.filter((o) => o.diaFim >= de && o.dia <= ate);
}

export function textoRecorrencia(r: string): string {
  return (
    { diaria: "Todo dia", semanal: "Toda semana", mensal: "Todo mês", anual: "Todo ano" } as Record<string, string>
  )[r] ?? "";
}
