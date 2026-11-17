import { describe, expect, it } from "vitest";
import { resumoPorDia, sequenciaMeta, treinoVsDescanso, regularidade, formatarMl } from "@/lib/agua";
import { gerarInsights, nivel, calcularXp } from "@/lib/insights";

const regs = [
  { day: "2026-11-16", hora: 9, amountMl: 1500, beverage: "agua" },
  { day: "2026-11-16", hora: 15, amountMl: 600, beverage: "agua" },
  { day: "2026-11-16", hora: 16, amountMl: 300, beverage: "suco" },
  { day: "2026-11-15", hora: 10, amountMl: 2000, beverage: "agua" },
  { day: "2026-11-17", hora: 8, amountMl: 400, beverage: "agua" },
];
const dias = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"];

describe("água", () => {
  const r = resumoPorDia(regs, dias, () => 2000, (d) => d === "2026-11-16");
  it("só água conta para a meta; outras bebidas à parte", () => {
    expect(r[2]).toMatchObject({ aguaMl: 2100, outrasMl: 300, copos: 2, bateu: true, treino: true });
  });
  it("sequência da meta (hoje pendente não quebra)", () => {
    expect(sequenciaMeta(r, "2026-11-17")).toBe(2);
  });
  it("treino × descanso e regularidade", () => {
    expect(treinoVsDescanso(r, "2026-11-17")).toEqual({ treino: 2100, descanso: 2000, nTreino: 1, nDescanso: 1 });
    expect(regularidade(regs, ["2026-11-16"])).toBe(29); // 2 de 7 blocos de 2 h
  });
  it("formato", () => {
    expect(formatarMl(2400)).toBe("2,4 L");
    expect(formatarMl(250)).toBe("250 ml");
  });
});

describe("insights e nível", () => {
  it("frases a partir dos registros", () => {
    const d = (ml: number) => ({ dia: "x", aguaMl: ml, outrasMl: 0, copos: 1, meta: 2000, treino: false, bateu: ml >= 2000 });
    const ins = gerarInsights({
      agua7: [2000, 2100, 2500, 1000, 2200, 2300, 2000].map(d),
      aguaAnterior7: [1000, 1000, 1000, 1000, 1000, 1000, 1000].map(d),
      habitos: [{ nome: "Ler", pct30: 93, esperados30: 30, sequencia: 12 }, { nome: "Estudar", pct30: 20, esperados30: 20, sequencia: 0 }],
      provasProximas: [{ titulo: "Prova de Matemática", dias: 2 }],
    });
    const textos = ins.map((i) => i.texto).join(" | ");
    expect(textos).toContain("6 dos últimos 7 dias");
    expect(textos).toContain("+");
    expect(textos).toContain('"Ler" (93%');
    expect(ins.length).toBeLessThanOrEqual(4);
  });
  it("níveis triangulares", () => {
    expect(nivel(0)).toMatchObject({ nivel: 1, base: 0, proximo: 100 });
    expect(nivel(100).nivel).toBe(2);
    expect(nivel(299).nivel).toBe(2);
    expect(nivel(300).nivel).toBe(3);
    expect(calcularXp({ habitos: 3, diasMetaAgua: 2, tarefas: 4 })).toBe(80);
  });
});
