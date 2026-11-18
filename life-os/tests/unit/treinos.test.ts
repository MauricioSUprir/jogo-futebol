import { describe, expect, it } from "vitest";
import * as T from "@/lib/treinos";
import { intervaloDeDias, somaDias } from "@/lib/datas";

const HOJE = "2026-11-18"; // quarta-feira
const at = (dia: string, duracao = 60, esforco: number | null = 5, tipo = "musculacao"): T.AtividadeResumo => ({ dia, tipo, duracao, esforco });
const rec = (dia: string, p: Partial<T.RegistroRecuperacao> = {}): T.RegistroRecuperacao => ({
  dia,
  descanso: false,
  cansaco: null,
  recuperacao: null,
  dor: null,
  desconforto: null,
  ...p,
});

describe("carga, ritmo e números", () => {
  it("carga = duração × esforço; sem esforço vale 5", () => {
    expect(T.cargaSessao(60, 7)).toBe(420);
    expect(T.cargaSessao(40, null)).toBe(200);
  });
  it("ritmo em min/km só com distância", () => {
    expect(T.ritmo(30, 5)).toBe("6:00 /km");
    expect(T.ritmo(27.5, 5)).toBe("5:30 /km");
    expect(T.ritmo(30, null)).toBeNull();
    expect(T.ritmo(30, 0)).toBeNull();
  });
  it("duração e repetições sugeridas", () => {
    expect(T.formatarDuracao(45)).toBe("45 min");
    expect(T.formatarDuracao(80)).toBe("1 h 20 min");
    expect(T.formatarDuracao(120)).toBe("2 h");
    expect(T.repsSugeridas("8-12")).toBe(8);
    expect(T.repsSugeridas("30 s")).toBe(30);
    expect(T.repsSugeridas("até a falha")).toBeNull();
  });
});

describe("semana de treinamento", () => {
  it("cada dia com as fichas; sem ficha = recuperação", () => {
    const fichas = [
      { id: "a", nome: "Treino A", dias: T.mascaraDias([1, 4]) }, // seg, qui
      { id: "b", nome: "Treino B", dias: T.mascaraDias([2]) }, // ter
    ];
    const g = T.gradeDaSemana(fichas, "2026-11-16"); // segunda
    expect(g.map((d) => d.fichas.map((f) => f.nome).join("+") || "—")).toEqual(["Treino A", "Treino B", "—", "Treino A", "—", "—", "—"]);
    expect(g[2].recuperacao).toBe(true);
    expect(T.diasDaMascara(T.mascaraDias([0, 6, 3]))).toEqual([0, 3, 6]);
  });
});

describe("evolução da carga", () => {
  const series: T.SerieFeita[] = [
    { dia: "2026-11-02", sessaoId: "s1", exercicio: "Supino reto", serie: 1, reps: 10, carga: 30 },
    { dia: "2026-11-02", sessaoId: "s1", exercicio: "Supino reto", serie: 2, reps: 8, carga: 32.5 },
    { dia: "2026-11-09", sessaoId: "s2", exercicio: "supino  reto ", serie: 1, reps: 10, carga: 32.5 },
    { dia: "2026-11-09", sessaoId: "s2", exercicio: "Supino reto", serie: 2, reps: 10, carga: 35 },
    { dia: "2026-11-09", sessaoId: "s2", exercicio: "Agachamento", serie: 1, reps: 12, carga: 40 },
  ];
  it("maior carga por sessão, nomes normalizados, em ordem de data", () => {
    const e = T.evolucaoCarga(series, "SUPINO RETO");
    expect(e.map((p) => [p.dia, p.maior, p.reps])).toEqual([
      ["2026-11-02", 32.5, 8],
      ["2026-11-09", 35, 10],
    ]);
    expect(e[0].volume).toBe(30 * 10 + 32.5 * 8);
  });
  it("lista de exercícios e a carga da última vez por série", () => {
    expect(T.exerciciosFeitos(series)).toHaveLength(2);
    const u = T.cargasDaUltimaVez(series);
    expect(u.get("supino reto")).toEqual([
      { reps: 10, carga: 32.5 },
      { reps: 10, carga: 35 },
    ]);
    expect(u.get("agachamento")).toEqual([{ reps: 12, carga: 40 }]);
  });
});

describe("futebol", () => {
  const jogos: T.JogoFutebol[] = [
    { dia: "2026-03-10", subtipo: "partida", minutos: 90, duracao: 100, gols: 1, assistencias: 1, posicao: "meia", nota: 8 },
    { dia: "2026-03-20", subtipo: "partida", minutos: 45, duracao: 60, gols: 0, assistencias: 1, posicao: "atacante", nota: 6 },
    { dia: "2026-04-02", subtipo: "treino", minutos: null, duracao: 90, gols: null, assistencias: null, posicao: null, nota: null },
    { dia: "2026-04-05", subtipo: "recreativo", minutos: null, duracao: 45, gols: 2, assistencias: 0, posicao: "atacante", nota: null },
    { dia: "2025-10-01", subtipo: "partida", minutos: 60, duracao: 70, gols: 0, assistencias: 0, posicao: "meia", nota: 5 },
  ];
  it("estatísticas: treino fica fora dos jogos; por 90 só com 90+ min", () => {
    const e = T.estatisticasFutebol(jogos.filter((j) => j.dia >= "2026"));
    expect(e).toMatchObject({ jogos: 3, partidas: 2, recreativos: 1, treinos: 1, minutos: 180, gols: 3, assistencias: 2 });
    expect(e.por90).toBeCloseTo(2.5);
    expect(e.mediaDesempenho).toBe(7);
    expect(e.porPosicao[0]).toMatchObject({ posicao: "atacante", jogos: 2, gols: 2 });
    expect(T.estatisticasFutebol([jogos[1]]).por90).toBeNull();
  });
  it("temporadas e frequência por mês", () => {
    expect(T.porTemporada(jogos).map((t) => [t.temporada, t.est.jogos])).toEqual([
      [2026, 3],
      [2025, 1],
    ]);
    const m = T.jogosPorMes(jogos, 2026);
    expect(m[2]).toBe(2);
    expect(m[3]).toBe(1); // o treino de abril não conta
    expect(m.reduce((s, x) => s + x, 0)).toBe(3);
  });
});

describe("minutos", () => {
  it("por tipo e por semana", () => {
    const l = [at(HOJE, 60), at(somaDias(HOJE, -1), 30, 5, "cardio"), at(somaDias(HOJE, -8), 90, 5, "futebol")];
    expect(T.minutosPorTipo(l, somaDias(HOJE, -6), HOJE)).toEqual({ musculacao: 60, cardio: 30, futebol: 0 });
    expect(T.minutosPorSemana(l, HOJE, 2).map((s) => s.minutos)).toEqual([90, 90]);
    expect(T.minutosPorSemana(l, HOJE, 2, "cardio").map((s) => s.minutos)).toEqual([0, 30]);
  });
});

describe("alertas de recuperação", () => {
  it("(a) 6 dias seguidos sem descanso → alerta; descanso marcado quebra a sequência", () => {
    const seis = intervaloDeDias(somaDias(HOJE, -5), HOJE).map((d) => at(d));
    expect(T.diasSeguidosComAtividade(seis, [], HOJE)).toBe(6);
    expect(T.alertasRecuperacao(seis, [], HOJE).map((a) => a.id)).toContain("seguidos");
    const cinco = seis.slice(1);
    expect(T.alertasRecuperacao(cinco, [], HOJE).map((a) => a.id)).not.toContain("seguidos");
    const comDescanso = [rec(somaDias(HOJE, -2), { descanso: true })];
    expect(T.diasSeguidosComAtividade(seis, comDescanso, HOJE)).toBe(2);
  });
  it("(a) hoje ainda sem atividade: conta a sequência até ontem", () => {
    const l = intervaloDeDias(somaDias(HOJE, -6), somaDias(HOJE, -1)).map((d) => at(d));
    expect(T.diasSeguidosComAtividade(l, [], HOJE)).toBe(6);
  });
  it("(b) carga 1,5× acima da média das 3 semanas anteriores, só com histórico", () => {
    const antes = [7, 14, 21].flatMap((k) => [at(somaDias(HOJE, -k - 1), 60, 5), at(somaDias(HOJE, -k - 3), 60, 5)]); // 600 por semana
    const comecoHistorico = at(somaDias(HOJE, -27), 10, 1);
    const semana = [at(HOJE, 100, 6), at(somaDias(HOJE, -2), 100, 6)]; // 1200
    const ids = T.alertasRecuperacao([comecoHistorico, ...antes, ...semana], [], HOJE).map((a) => a.id);
    expect(ids).toContain("carga");
    // Sem as 3 semanas inteiras de histórico, não compara.
    expect(T.cargaSemanal([...antes, ...semana], HOJE).media).toBeNull();
    // Igual ao costume: sem alerta.
    const normal = [at(HOJE, 60, 5), at(somaDias(HOJE, -2), 60, 5)];
    expect(T.alertasRecuperacao([comecoHistorico, ...antes, ...normal], [], HOJE).map((a) => a.id)).not.toContain("carga");
  });
  it("(c) cansaço alto ou recuperação baixa em 2 dos últimos 3 registros", () => {
    const r = [rec(HOJE, { cansaco: 4 }), rec(somaDias(HOJE, -1), { recuperacao: 3 }), rec(somaDias(HOJE, -2), { recuperacao: 2 })];
    expect(T.alertasRecuperacao([], r, HOJE).map((a) => a.id)).toContain("cansaco");
    const so1 = [rec(HOJE, { cansaco: 4 }), rec(somaDias(HOJE, -1), { recuperacao: 3 }), rec(somaDias(HOJE, -2), { cansaco: 2 })];
    expect(T.alertasRecuperacao([], so1, HOJE).map((a) => a.id)).not.toContain("cansaco");
  });
  it("(d) desconforto ou dor forte nos últimos 3 dias → procurar um adulto ou profissional se continuar", () => {
    const a = T.alertasRecuperacao([], [rec(somaDias(HOJE, -2), { desconforto: "joelho" })], HOJE);
    expect(a.map((x) => x.id)).toContain("desconforto");
    expect(a.find((x) => x.id === "desconforto")!.texto).toMatch(/adulto de confiança ou um profissional de saúde/);
    expect(T.alertasRecuperacao([], [rec(HOJE, { dor: 4 })], HOJE).map((x) => x.id)).toContain("desconforto");
    expect(T.alertasRecuperacao([], [rec(somaDias(HOJE, -3), { dor: 5 })], HOJE).map((x) => x.id)).not.toContain("desconforto");
  });
  it("semana equilibrada ganha elogio; nenhum texto manda treinar mais", () => {
    const l = [at(HOJE), at(somaDias(HOJE, -2)), at(somaDias(HOJE, -4), 45, 4, "futebol")];
    const a = T.alertasRecuperacao(l, [], HOJE);
    expect(a).toEqual([expect.objectContaining({ id: "equilibrio", tom: "positivo" })]);
    const todos = [
      ...T.alertasRecuperacao(intervaloDeDias(somaDias(HOJE, -8), HOJE).map((d) => at(d, 120, 9)), [rec(HOJE, { dor: 5, cansaco: 5 }), rec(somaDias(HOJE, -1), { cansaco: 5 })], HOJE),
      ...a,
    ];
    for (const x of todos) expect(x.texto).not.toMatch(/treine mais|aumente|mais forte no treino/i);
  });
});
