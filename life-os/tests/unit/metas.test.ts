import { describe, expect, it } from "vitest";
import { conquistasMetas, metaCumprida, ordenarMetas, progressoMeta, textoPrazo, textoProgresso } from "@/lib/metas";

describe("progresso da meta", () => {
  it("por etapas", () => {
    const m = { measure: "etapas", target: null, current: 0, steps: [{ done: true }, { done: false }, { done: false }] };
    expect(progressoMeta(m)).toBe(33);
    expect(metaCumprida(m)).toBe(false);
    expect(textoProgresso(m)).toBe("1 de 3 etapas");
    expect(metaCumprida({ ...m, steps: [{ done: true }, { done: true }] })).toBe(true);
  });
  it("sem etapas não conta como cumprida", () => {
    const m = { measure: "etapas", target: null, current: 0, steps: [] };
    expect(progressoMeta(m)).toBe(0);
    expect(metaCumprida(m)).toBe(false);
  });
  it("por número (limitado a 0–100%)", () => {
    const m = { measure: "numero", target: 50, current: 20, steps: [], unit: "gols" };
    expect(progressoMeta(m)).toBe(40);
    expect(textoProgresso(m)).toBe("20 de 50 gols");
    expect(progressoMeta({ ...m, current: 80 })).toBe(100);
    expect(metaCumprida({ ...m, current: 50 })).toBe(true);
    expect(progressoMeta({ ...m, target: 0 })).toBe(0);
  });
});

describe("prazo e ordem", () => {
  it("texto do prazo", () => {
    expect(textoPrazo("2026-11-18", "2026-11-18")).toEqual({ texto: "vence hoje", atrasada: false });
    expect(textoPrazo("2026-11-21", "2026-11-18").texto).toBe("faltam 3 dias");
    expect(textoPrazo("2026-11-16", "2026-11-18")).toEqual({ texto: "venceu há 2 dias", atrasada: true });
  });
  it("prioridade alta primeiro e, empatando, o prazo mais perto", () => {
    const ms = [
      { id: "a", priority: 2, prazo: "2026-12-01", progresso: 10, criadaEm: 1 },
      { id: "b", priority: 1, prazo: null, progresso: 90, criadaEm: 2 },
      { id: "c", priority: 1, prazo: "2026-11-20", progresso: 0, criadaEm: 3 },
    ];
    expect(ordenarMetas(ms).map((m) => m.id)).toEqual(["c", "b", "a"]);
    expect(ordenarMetas(ms, "progresso").map((m) => m.id)).toEqual(["b", "a", "c"]);
    expect(ordenarMetas(ms, "prazo").map((m) => m.id)).toEqual(["c", "a", "b"]);
    expect(ordenarMetas(ms, "recentes").map((m) => m.id)).toEqual(["c", "b", "a"]);
  });
});

describe("conquistas", () => {
  const meta = (o: Partial<Parameters<typeof conquistasMetas>[0][number]>) => ({
    status: "concluido",
    category: "estudos",
    year: null,
    prazo: null,
    concluidaEm: "2026-11-10",
    ...o,
  });
  const ok = (ms: Parameters<typeof conquistasMetas>[0]) => conquistasMetas(ms).filter((c) => c.ok).map((c) => c.id);
  it("nenhuma sem metas concluídas", () => {
    expect(ok([meta({ status: "ativo" })])).toEqual([]);
  });
  it("primeira meta", () => {
    expect(ok([meta({})])).toEqual(["primeira"]);
  });
  it("antes do prazo, anual e equilíbrio", () => {
    const r = ok([meta({ prazo: "2026-11-10" }), meta({ category: "saude", year: 2026 }), meta({ category: "futebol", prazo: "2026-11-01" })]);
    expect(r).toEqual(["primeira", "anual", "antes-prazo", "tres-categorias"]);
  });
  it("concluída depois do prazo não vale 'antes do prazo'; cinco metas", () => {
    const r = ok(Array.from({ length: 5 }, () => meta({ prazo: "2026-11-01" })));
    expect(r).toEqual(["primeira", "cinco"]);
  });
});
