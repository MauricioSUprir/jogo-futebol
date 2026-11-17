import { describe, expect, it } from "vitest";
import { planejarDia, minutosLivres } from "@/lib/planejador";

const t = (id: string, durationMin: number, priority = 2, dueDay: string | null = null) => ({ id, durationMin, priority, dueDay });

describe("planejamento automático", () => {
  it("respeita compromissos com folga e a janela do dia", () => {
    const p = planejarDia({ janelaInicio: 8 * 60, janelaFim: 12 * 60, ocupados: [{ inicio: 9 * 60, fim: 10 * 60 }], tarefas: [t("a", 50), t("b", 60)] });
    // a: 08:00–08:50 (folga de 10 antes das 9h). b: depois das 10:10.
    expect(p.encaixes).toEqual([{ id: "a", inicio: 480, fim: 530 }, { id: "b", inicio: 610, fim: 670 }]);
    expect(p.semLugar).toEqual([]);
  });
  it("prioridade alta primeiro, depois prazo", () => {
    const p = planejarDia({ janelaInicio: 0, janelaFim: 600, ocupados: [], tarefas: [t("baixa", 30, 3), t("alta", 30, 1), t("media-prazo", 30, 2, "2026-11-18"), t("media", 30, 2)] });
    expect(p.encaixes.map((e) => e.id)).toEqual(["alta", "media-prazo", "media", "baixa"]);
  });
  it("começa depois de agora (arredondado a 5 min)", () => {
    const p = planejarDia({ janelaInicio: 480, janelaFim: 1320, ocupados: [], tarefas: [t("a", 30)], agoraMin: 14 * 60 + 2 });
    expect(p.encaixes[0].inicio).toBe(14 * 60 + 5);
  });
  it("pausa depois de 90 min de foco seguido", () => {
    const p = planejarDia({ janelaInicio: 0, janelaFim: 600, ocupados: [], tarefas: [t("a", 45), t("b", 45), t("c", 45)] });
    const [a, b, c] = p.encaixes;
    expect(b.inicio - a.fim).toBe(5);
    expect(c.inicio - b.fim).toBeGreaterThanOrEqual(15);
  });
  it("tarefa que não cabe fica sem lugar", () => {
    const p = planejarDia({ janelaInicio: 0, janelaFim: 60, ocupados: [], tarefas: [t("grande", 120), t("ok", 30)] });
    expect(p.semLugar).toEqual(["grande"]);
    expect(p.encaixes.map((e) => e.id)).toEqual(["ok"]);
  });
  it("minutos livres", () => {
    expect(minutosLivres(0, 100, [{ inicio: 10, fim: 30 }, { inicio: 20, fim: 40 }])).toBe(70);
  });
});
