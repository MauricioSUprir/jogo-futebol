import { describe, expect, it } from "vitest";
import { dobrar, gerarIcs, linhaCsv } from "@/lib/ics";

describe("iCalendar", () => {
  const agora = new Date("2026-11-17T12:00:00Z");
  it("evento com hora, repetição e escapes", () => {
    const ics = gerarIcs([{ uid: "a", titulo: "Treino; perna, forte", diaInteiro: false, inicio: new Date("2026-11-18T21:00:00Z"), fim: new Date("2026-11-18T22:30:00Z"), recorrencia: "semanal", repetirAte: new Date("2026-12-31T00:00:00Z") }], agora);
    expect(ics).toContain("DTSTART:20261118T210000Z");
    expect(ics).toContain("DTEND:20261118T223000Z");
    expect(ics).toContain("SUMMARY:Treino\; perna\\, forte");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
  it("dia inteiro com DTEND exclusivo", () => {
    const ics = gerarIcs([{ uid: "b", titulo: "Aniversário", diaInteiro: true, inicio: new Date("2026-03-10T00:00:00Z"), fim: null, recorrencia: "anual" }], agora);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260310");
    expect(ics).toContain("DTEND;VALUE=DATE:20260311");
    expect(ics).toContain("RRULE:FREQ=YEARLY");
  });
  it("dobra linhas longas em ≤ 75 bytes, sem quebrar acentos", () => {
    const longa = "DESCRIPTION:" + "ação ".repeat(40);
    const dobrada = dobrar(longa);
    for (const parte of dobrada.split("\r\n")) expect(Buffer.byteLength(parte)).toBeLessThanOrEqual(75);
    expect(dobrada.replace(/\r\n /g, "")).toBe(longa);
  });
  it("CSV com aspas e sem fórmula", () => {
    expect(linhaCsv(["a;b", 'x"y', "=SOMA(A1)", 3])).toBe(`"a;b";"x""y";'=SOMA(A1);3`);
  });
});
