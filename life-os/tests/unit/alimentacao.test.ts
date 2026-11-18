import { describe, expect, it } from "vitest";
import {
  diasComGrupo,
  gruposDiferentes,
  ingredientesParaLista,
  planoDoDia,
  presencaDosGrupos,
  regularidadeHorario,
  resumoPorDia,
  sugerirRefeicao,
  sugestoesGentis,
  type RefeicaoReg,
} from "@/lib/alimentacao";
import { intervaloDeDias, somaDias } from "@/lib/datas";

const SEG = "2026-11-16"; // segunda-feira
const r = (dia: string, tipo: string, grupos: string[], minutos = 12 * 60): RefeicaoReg => ({ dia, tipo, grupos, minutos });

describe("tipo de refeição pelo horário", () => {
  it("sugere pelo relógio", () => {
    expect(sugerirRefeicao(7 * 60)).toBe("cafe");
    expect(sugerirRefeicao(10 * 60 + 30)).toBe("lanche_manha");
    expect(sugerirRefeicao(12 * 60 + 30)).toBe("almoco");
    expect(sugerirRefeicao(16 * 60)).toBe("lanche_tarde");
    expect(sugerirRefeicao(20 * 60)).toBe("jantar");
    expect(sugerirRefeicao(23 * 60)).toBe("ceia");
    expect(sugerirRefeicao(2 * 60)).toBe("ceia");
  });
});

describe("variedade", () => {
  const semana = [
    r(SEG, "almoco", ["cereais", "proteinas", "vegetais", "leguminosas"]),
    r(SEG, "lanche_tarde", ["frutas", "laticinios", "outros"]),
    r(somaDias(SEG, 1), "almoco", ["cereais", "proteinas"]),
    r(somaDias(SEG, 2), "cafe", ["frutas", "oleaginosas"]),
  ];
  it("grupos diferentes ignoram 'outros' e nomes inválidos", () => {
    expect(gruposDiferentes([r(SEG, "x", ["frutas", "outros", "doce", "frutas"])])).toEqual(["frutas"]);
  });
  it("resumo por dia", () => {
    const m = resumoPorDia(semana);
    expect(m.get(SEG)).toEqual({ refeicoes: 2, grupos: ["frutas", "vegetais", "cereais", "proteinas", "leguminosas", "laticinios"] });
    expect(m.get(somaDias(SEG, 1))!.grupos).toEqual(["cereais", "proteinas"]);
  });
  it("dias com fruta e presença dos grupos", () => {
    const dias = intervaloDeDias(SEG, somaDias(SEG, 6));
    expect(diasComGrupo(semana, "frutas", dias)).toBe(2);
    expect(diasComGrupo(semana, "vegetais", dias)).toBe(1);
    const p = presencaDosGrupos(semana);
    expect(p[0]).toEqual({ grupo: "frutas", dias: 2, pct: 67 });
    expect(p.find((g) => g.grupo === "vegetais")).toEqual({ grupo: "vegetais", dias: 1, pct: 33 });
    expect(p).toHaveLength(7);
  });
});

describe("regularidade dos horários", () => {
  it("regular com desvio pequeno e 3+ dias; usa o primeiro registro do dia", () => {
    const v = [r(SEG, "almoco", [], 720), r(somaDias(SEG, 1), "almoco", [], 750), r(somaDias(SEG, 2), "almoco", [], 690), r(somaDias(SEG, 2), "almoco", [], 900)];
    const g = regularidadeHorario(v, "almoco")!;
    expect(g).toMatchObject({ media: "12:00", n: 3, regular: true });
    expect(g.desvioMin).toBe(24);
    expect(regularidadeHorario([r(SEG, "jantar", [], 1100), r(somaDias(SEG, 1), "jantar", [], 1300), r(somaDias(SEG, 2), "jantar", [], 1180)], "jantar")!.regular).toBe(false);
    expect(regularidadeHorario([r(SEG, "cafe", [], 420)], "cafe")).toBeNull();
  });
});

describe("planejamento do dia", () => {
  const itens = [
    { id: "a", weekdays: 0b0111110, trainingDay: false }, // seg–sex
    { id: "b", weekdays: 0b1000001, trainingDay: false }, // fim de semana
    { id: "c", weekdays: 127, trainingDay: true }, // dia de treino
  ];
  it("pelo dia da semana e só mostra o de treino quando é dia de treino", () => {
    expect(planoDoDia(itens, SEG, false).map((i) => i.id)).toEqual(["a"]);
    expect(planoDoDia(itens, SEG, true).map((i) => i.id)).toEqual(["a", "c"]);
    expect(planoDoDia(itens, somaDias(SEG, 5), false).map((i) => i.id)).toEqual(["b"]);
  });
});

describe("ingredientes para a lista", () => {
  it("separa por linha, ponto e vírgula e vírgula, sem quebrar decimais nem parênteses", () => {
    expect(ingredientesParaLista("- 2 bananas\n1,5 xícara de aveia, mel (a gosto, opcional); canela\n\n* Leite\n3) ovos")).toEqual([
      "2 bananas",
      "1,5 xícara de aveia",
      "mel (a gosto, opcional)",
      "canela",
      "Leite",
      "ovos",
    ]);
  });
  it("não repete o mesmo item", () => {
    expect(ingredientesParaLista("Ovo\novo\n OVO ")).toEqual(["Ovo"]);
  });
});

describe("sugestões gentis", () => {
  const dias = intervaloDeDias(SEG, somaDias(SEG, 6));
  it("sem sugestão com menos de 3 dias registrados", () => {
    expect(sugestoesGentis([r(SEG, "almoco", ["cereais"])], dias)).toEqual([]);
  });
  it("convida a incluir fruta e vegetal, sem falar de calorias ou peso", () => {
    const pouca = [0, 1, 2, 3].map((i) => r(somaDias(SEG, i), "almoco", ["cereais", "proteinas"]));
    const t = sugestoesGentis(pouca, dias).map((x) => x.texto).join(" ");
    expect(t).toMatch(/fruta/);
    expect(t).toMatch(/vegetal/);
    expect(t).not.toMatch(/calori|peso|engorda|proibid|dieta/i);
  });
  it("elogia a variedade", () => {
    const boa = [0, 1, 2].map((i) => r(somaDias(SEG, i), "almoco", ["cereais", "proteinas", "vegetais", "frutas", "leguminosas", "laticinios"]));
    expect(sugestoesGentis(boa, dias)[0]).toMatchObject({ tom: "positivo" });
  });
});
