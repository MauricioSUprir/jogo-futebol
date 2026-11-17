import { describe, expect, it } from "vitest";
import * as D from "@/lib/datas";

describe("datas e fusos", () => {
  it("chave do dia no fuso (São Paulo é UTC−3)", () => {
    const t = new Date("2026-11-18T02:30:00Z"); // 23:30 do dia 17 em SP
    expect(D.chaveNoFuso(t, "America/Sao_Paulo")).toBe("2026-11-17");
    expect(D.chaveNoFuso(t, "UTC")).toBe("2026-11-18");
    expect(D.horaNoFuso(t, "America/Sao_Paulo")).toBe("23:30");
  });
  it("local → UTC, inclusive com horário de verão (Nova York)", () => {
    expect(D.localParaUtc("2026-11-17", "14:00", "America/Sao_Paulo").toISOString()).toBe("2026-11-17T17:00:00.000Z");
    expect(D.localParaUtc("2026-07-01", "12:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(D.localParaUtc("2026-01-15", "12:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });
  it("aritmética de dias, semana começando na segunda, meses", () => {
    expect(D.somaDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(D.somaDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(D.diasEntre("2026-11-01", "2026-12-01")).toBe(30);
    expect(D.diaDaSemana("2026-11-17")).toBe(2); // terça
    expect(D.inicioDaSemana("2026-11-17")).toBe("2026-11-16");
    expect(D.inicioDaSemana("2026-11-22")).toBe("2026-11-16"); // domingo fica na semana que começou na segunda
    expect(D.somaMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(D.somaMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(D.intervaloDeDias("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("validações e textos", () => {
    expect(D.validaChave("2026-02-30")).toBe(false);
    expect(D.validaChave("2026-02-28")).toBe(true);
    expect(D.validaHora("24:00")).toBe(false);
    expect(D.validaHora("07:05")).toBe(true);
    expect(D.diaPorExtenso("2026-11-17")).toBe("terça-feira, 17 de novembro");
    expect(D.diaRelativo("2026-11-18", "2026-11-17")).toBe("Amanhã");
    expect(D.saudacao(9 * 60)).toBe("Bom dia");
    expect(D.minutosParaHora(-30)).toBe("23:30");
    expect(D.fusoValido("America/Sao_Paulo")).toBe(true);
    expect(D.fusoValido("Lua/Base")).toBe(false);
  });
});
