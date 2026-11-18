import { describe, expect, it } from "vitest";
import {
  configPomodoro,
  contagem,
  formatarMinutos,
  mediaPonderada,
  notaNecessaria,
  planejarSemana,
  proximaFase,
  proximaRevisao,
  registrarRevisao,
  responderCartao,
  statusMateria,
  POMODORO_PADRAO,
} from "@/lib/estudos";

describe("revisões programadas (repetição espaçada)", () => {
  it("ao concluir, a 1ª revisão é no dia seguinte", () => {
    expect(proximaRevisao(0, "2026-11-18")).toBe("2026-11-19");
  });
  it("cada revisão feita espaça 3, 7, 14 e 30 dias e depois encerra", () => {
    let etapa = 0;
    const datas: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const r = registrarRevisao(etapa, "2026-11-01");
      etapa = r.etapa;
      datas.push(r.proxima);
    }
    expect(datas).toEqual(["2026-11-04", "2026-11-08", "2026-11-15", "2026-12-01", null]);
  });
});

describe("flashcards (Leitner)", () => {
  it("acertou sobe uma caixa e espaça", () => {
    expect(responderCartao(1, true, "2026-11-18")).toEqual({ caixa: 2, proxima: "2026-11-20" });
    expect(responderCartao(3, true, "2026-11-18")).toEqual({ caixa: 4, proxima: "2026-11-26" });
  });
  it("a caixa 5 é o teto", () => {
    expect(responderCartao(5, true, "2026-11-18")).toEqual({ caixa: 5, proxima: "2026-12-04" });
  });
  it("errou volta para a caixa 1 (amanhã)", () => {
    expect(responderCartao(4, false, "2026-11-18")).toEqual({ caixa: 1, proxima: "2026-11-19" });
  });
});

describe("média e quanto falta", () => {
  it("média ponderada na escala 0–10", () => {
    expect(mediaPonderada([{ valor: 5, max: 10, peso: 1 }, { valor: 8, max: 10, peso: 1 }])).toBe(6.5);
    expect(mediaPonderada([{ valor: 15, max: 20, peso: 2 }, { valor: 4, max: 10, peso: 1 }])).toBeCloseTo(6.333, 3);
    expect(mediaPonderada([])).toBeNull();
  });
  it("5 e 8 com média 7: precisa de 8,0 na próxima de peso 1", () => {
    const r = notaNecessaria([{ valor: 5, max: 10, peso: 1 }, { valor: 8, max: 10, peso: 1 }], 7, 1);
    expect(r).toEqual({ situacao: "possivel", media: 6.5, necessaria: 8 });
  });
  it("peso maior na próxima diminui a nota necessária", () => {
    const r = notaNecessaria([{ valor: 5, max: 10, peso: 1 }], 7, 3);
    expect(r.situacao).toBe("possivel");
    expect(r.necessaria).toBeCloseTo(7.7, 5); // (7×4 − 5) ÷ 3 = 7,67 → 7,7
  });
  it("já garantiu", () => {
    expect(notaNecessaria([{ valor: 10, max: 10, peso: 3 }], 6, 1)).toEqual({ situacao: "garantido", media: 10, necessaria: 0 });
  });
  it("impossível com uma prova só", () => {
    const r = notaNecessaria([{ valor: 2, max: 10, peso: 1 }, { valor: 3, max: 10, peso: 1 }], 7, 1);
    expect(r.situacao).toBe("impossivel");
    expect(r.necessaria).toBeNull();
  });
  it("sem notas ainda: precisa da própria média", () => {
    expect(notaNecessaria([], 7, 1)).toEqual({ situacao: "sem-notas", media: null, necessaria: 7 });
  });
});

describe("planejar a semana", () => {
  const base = { planejadosMin: 0, provaEmDias: null };
  it("blocos de 45 min com a sobra no último", () => {
    const r = planejarSemana([{ id: "m", nome: "Matemática", metaMin: 120, feitosMin: 20, ...base }]);
    expect(r.map((t) => t.duracao)).toEqual([45, 55]);
    expect(r.every((t) => t.titulo === "Estudar Matemática" && t.prioridade === 2)).toBe(true);
  });
  it("desconta o já planejado e ignora sobras pequenas", () => {
    expect(planejarSemana([{ id: "m", nome: "X", metaMin: 120, feitosMin: 60, planejadosMin: 50, provaEmDias: null }])).toEqual([]);
  });
  it("prova nos próximos 7 dias = prioridade alta e vem primeiro", () => {
    const r = planejarSemana([
      { id: "a", nome: "História", metaMin: 45, feitosMin: 0, ...base },
      { id: "b", nome: "Física", metaMin: 45, feitosMin: 0, planejadosMin: 0, provaEmDias: 3 },
    ]);
    expect(r[0]).toEqual({ materiaId: "b", titulo: "Estudar Física", duracao: 45, prioridade: 1 });
    expect(r[1].prioridade).toBe(2);
  });
});

describe("painel escolar", () => {
  const vazio = { revisoesVencidas: 0, concluidos: 0, totalConteudos: 0, ultima: null };
  it("revisão vencida vem primeiro", () => {
    expect(statusMateria({ ...vazio, revisoesVencidas: 1, ultima: { dia: "2026-11-18", tipo: "exercicios" } }, "2026-11-18").texto).toBe("revisão pendente");
  });
  it("frases do plano pela última sessão da semana", () => {
    expect(statusMateria({ ...vazio, ultima: { dia: "2026-11-16", tipo: "exercicios" } }, "2026-11-18").texto).toBe("exercícios concluídos");
    expect(statusMateria({ ...vazio, ultima: { dia: "2026-11-16", tipo: "revisao" } }, "2026-11-18").texto).toBe("conteúdo revisado");
    expect(statusMateria({ ...vazio, ultima: { dia: "2026-11-01", tipo: "estudo" } }, "2026-11-18").texto).toBe("sem estudar há 17 dias");
  });
  it("sem sessões: conteúdos ou nada", () => {
    expect(statusMateria({ ...vazio, concluidos: 2, totalConteudos: 5 }, "2026-11-18").texto).toBe("2 de 5 conteúdos concluídos");
    expect(statusMateria(vazio, "2026-11-18").texto).toBe("ainda sem estudo registrado");
  });
});

describe("Pomodoro e textos", () => {
  it("pausa longa a cada 4 focos", () => {
    expect(proximaFase("foco", 1, POMODORO_PADRAO)).toBe("curta");
    expect(proximaFase("foco", 4, POMODORO_PADRAO)).toBe("longa");
    expect(proximaFase("curta", 1, POMODORO_PADRAO)).toBe("foco");
    expect(proximaFase("longa", 4, POMODORO_PADRAO)).toBe("foco");
  });
  it("configuração fora dos limites volta ao padrão", () => {
    expect(configPomodoro({ foco: 500, curta: 3, longa: "x" as unknown as number, cadaLonga: 4 })).toEqual({ foco: 25, curta: 3, longa: 15, cadaLonga: 4 });
  });
  it("contagem e minutos", () => {
    expect([contagem(0), contagem(1), contagem(5), contagem(-2)]).toEqual(["hoje", "amanhã", "em 5 dias", "há 2 dias"]);
    expect([formatarMinutos(45), formatarMinutos(90), formatarMinutos(120)]).toEqual(["45 min", "1 h 30", "2 h"]);
  });
});
