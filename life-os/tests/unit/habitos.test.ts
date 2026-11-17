import { describe, expect, it } from "vitest";
import * as H from "@/lib/habitos";

const diario: H.DefHabito = { frequency: "diario", weekdays: 127, timesPerWeek: 3, targetPerDay: 1, startDay: "2026-11-01" };
const regs = (dias: Record<string, number | "d">): H.Registros =>
  new Map(Object.entries(dias).map(([k, v]) => [k, v === "d" ? { count: 0, skipped: true } : { count: v, skipped: false }]));

describe("sequências", () => {
  it("hoje pendente não quebra a sequência", () => {
    const r = regs({ "2026-11-15": 1, "2026-11-16": 1 });
    expect(H.sequenciaAtual(diario, r, "2026-11-17")).toEqual({ valor: 2, unidade: "dias" });
  });
  it("hoje feito soma; dia perdido quebra", () => {
    const r = regs({ "2026-11-13": 1, "2026-11-15": 1, "2026-11-16": 1, "2026-11-17": 1 });
    expect(H.sequenciaAtual(diario, r, "2026-11-17").valor).toBe(3);
  });
  it("descanso planejado é neutro (não quebra, não soma)", () => {
    const r = regs({ "2026-11-14": 1, "2026-11-15": "d", "2026-11-16": 1 });
    expect(H.sequenciaAtual(diario, r, "2026-11-17").valor).toBe(2);
  });
  it("dias da semana: dia não programado não quebra", () => {
    const h = { ...diario, frequency: "dias", weekdays: 0b0101010 }; // seg, qua, sex
    const r = regs({ "2026-11-11": 1, "2026-11-13": 1, "2026-11-16": 1 }); // qua, sex, seg
    expect(H.sequenciaAtual(h, r, "2026-11-17").valor).toBe(3); // terça não é programada
  });
  it("meta por dia: 1 de 2 é parcial e não conta", () => {
    const h = { ...diario, targetPerDay: 2 };
    const r = regs({ "2026-11-16": 1, "2026-11-15": 2 });
    expect(H.statusDoDia(h, r.get("2026-11-16"), "2026-11-16")).toBe("parcial");
    expect(H.sequenciaAtual(h, r, "2026-11-17").valor).toBe(0);
  });
  it("melhor sequência", () => {
    const r = regs({ "2026-11-02": 1, "2026-11-03": 1, "2026-11-04": 1, "2026-11-05": 1, "2026-11-07": 1 });
    expect(H.melhorSequencia(diario, r, "2026-11-17").valor).toBe(4);
  });
  it("semanal: semanas cumpridas seguidas; a atual em andamento não quebra", () => {
    const h = { ...diario, frequency: "semanal", timesPerWeek: 2 };
    const r = regs({ "2026-11-03": 1, "2026-11-05": 1, "2026-11-10": 1, "2026-11-12": 1, "2026-11-17": 1 });
    expect(H.sequenciaAtual(h, r, "2026-11-17")).toEqual({ valor: 2, unidade: "semanas" });
    expect(H.progressoSemana(h, r, "2026-11-17")).toEqual({ feitos: 1, meta: 2 });
  });
});

describe("taxa de conclusão", () => {
  it("hoje pendente e descanso saem da conta", () => {
    const r = regs({ "2026-11-14": 1, "2026-11-15": "d", "2026-11-16": 1 });
    const t = H.taxaConclusao(diario, r, "2026-11-13", "2026-11-17", "2026-11-17");
    expect(t).toEqual({ feitos: 2, esperados: 3, pct: 67 });
  });
  it("não conta antes do início do hábito", () => {
    const h = { ...diario, startDay: "2026-11-16" };
    const t = H.taxaConclusao(h, regs({ "2026-11-16": 1 }), "2026-11-01", "2026-11-17", "2026-11-17");
    expect(t.pct).toBe(100);
  });
  it("texto da frequência", () => {
    expect(H.textoFrequencia({ frequency: "dias", weekdays: 62, timesPerWeek: 3, targetPerDay: 1 })).toBe("Dias úteis");
    expect(H.textoFrequencia({ frequency: "dias", weekdays: 0b0101010, timesPerWeek: 3, targetPerDay: 2 })).toBe("Seg, Qua, Sex · 2× ao dia");
    expect(H.textoFrequencia({ frequency: "semanal", weekdays: 127, timesPerWeek: 4, targetPerDay: 1 })).toBe("4× por semana");
  });
});
