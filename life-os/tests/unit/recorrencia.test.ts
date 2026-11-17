import { describe, expect, it } from "vitest";
import { ocorrencias } from "@/lib/recorrencia";

const SP = "America/Sao_Paulo";
const ev = (o: Partial<Parameters<typeof ocorrencias>[0]>) => ({ id: "e", allDay: false, start: new Date("2026-11-17T17:00:00Z"), end: new Date("2026-11-17T18:30:00Z"), recurrence: "nenhuma", recurrenceUntil: null, ...o });

describe("ocorrências", () => {
  it("evento simples dentro e fora do intervalo", () => {
    expect(ocorrencias(ev({}), "2026-11-16", "2026-11-22", SP)).toHaveLength(1);
    expect(ocorrencias(ev({}), "2026-11-18", "2026-11-22", SP)).toHaveLength(0);
  });
  it("semanal mantém a hora local e respeita o fim da repetição", () => {
    const o = ocorrencias(ev({ recurrence: "semanal", recurrenceUntil: new Date("2026-12-01T00:00:00Z") }), "2026-11-01", "2026-12-31", SP);
    expect(o.map((x) => x.dia)).toEqual(["2026-11-17", "2026-11-24", "2026-12-01"]);
    expect(o[1].inicio.toISOString()).toBe("2026-11-24T17:00:00.000Z");
    expect(o[1].fim!.toISOString()).toBe("2026-11-24T18:30:00.000Z");
  });
  it("mensal no dia 31 cai no último dia dos meses curtos", () => {
    const e = ev({ start: new Date("2026-01-31T15:00:00Z"), end: null, recurrence: "mensal" });
    expect(ocorrencias(e, "2026-01-01", "2026-04-30", SP).map((x) => x.dia)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("aniversário anual de dia inteiro, 29/02 em ano não bissexto", () => {
    const e = ev({ allDay: true, start: new Date("2024-02-29T00:00:00Z"), end: null, recurrence: "anual" });
    expect(ocorrencias(e, "2026-01-01", "2026-12-31", SP).map((x) => x.dia)).toEqual(["2026-02-28"]);
    expect(ocorrencias(e, "2028-01-01", "2028-12-31", SP).map((x) => x.dia)).toEqual(["2028-02-29"]);
  });
  it("evento de vários dias aparece se já está em andamento", () => {
    const e = ev({ allDay: true, start: new Date("2026-11-14T00:00:00Z"), end: new Date("2026-11-18T00:00:00Z") });
    const o = ocorrencias(e, "2026-11-16", "2026-11-22", SP);
    expect(o).toHaveLength(1);
    expect(o[0].diaFim).toBe("2026-11-18");
  });
});
