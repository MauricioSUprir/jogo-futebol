import { describe, expect, it } from "vitest";
import {
  aulaVsLivre, bateuMeta, desvioCircular, difCircular, duracaoMin, formatarDuracao, horaDeMinutos, instantesDaNoite,
  lembreteDescanso, mediaCircular, noiteDeAula, regularidade, sonoEEnergia, diasParaBits, bitsParaDias, type Noite,
} from "@/lib/sono";
import { horaNoFuso, chaveNoFuso } from "@/lib/datas";
import type { Checkin } from "@/lib/checkin";

const SP = "America/Sao_Paulo";

function noite(dia: string, deitou: string, acordou: string, latencia: number | null = null): Noite {
  const i = instantesDaNoite(dia, deitou, acordou, SP);
  return { dia, ...i, latenciaMin: latencia, despertares: null, qualidade: null, notas: null };
}

describe("instantes da noite", () => {
  it("dormir antes da meia-noite fica no dia anterior", () => {
    const n = noite("2026-11-18", "23:30", "07:15");
    expect(chaveNoFuso(n.deitou, SP)).toBe("2026-11-17");
    expect(horaNoFuso(n.deitou, SP)).toBe("23:30");
    expect(chaveNoFuso(n.acordou, SP)).toBe("2026-11-18");
    expect(duracaoMin(n)).toBe(7 * 60 + 45);
    expect(formatarDuracao(duracaoMin(n))).toBe("7 h 45 min");
  });
  it("dormir depois da meia-noite fica no mesmo dia", () => {
    const n = noite("2026-11-18", "00:40", "08:10");
    expect(chaveNoFuso(n.deitou, SP)).toBe("2026-11-18");
    expect(duracaoMin(n)).toBe(450);
  });
  it("desconta o tempo até pegar no sono", () => {
    expect(duracaoMin(noite("2026-11-18", "22:00", "06:00", 30))).toBe(450);
  });
  it("formata durações", () => {
    expect(formatarDuracao(480)).toBe("8 h");
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(null)).toBe("—");
  });
});

describe("horários circulares", () => {
  it("média de 23:30 e 00:30 é meia-noite (não meio-dia)", () => {
    const m = mediaCircular([23 * 60 + 30, 30])!;
    expect(Math.min(m, 1440 - m)).toBeLessThan(0.01);
    expect(horaDeMinutos(m)).toBe("00:00");
  });
  it("diferença circular", () => {
    expect(difCircular(23 * 60 + 30, 30)).toBe(60);
    expect(difCircular(30, 23 * 60 + 30)).toBe(-60);
  });
  it("desvio de horários iguais é zero e cresce com a variação", () => {
    expect(desvioCircular([1380, 1380, 1380])).toBeCloseTo(0, 5);
    expect(desvioCircular([1380, 1440, 60])).toBeCloseTo(Math.sqrt((60 ** 2 + 0 + 60 ** 2) / 3), 1);
  });
  it("regularidade só dá desvio com 3 noites", () => {
    const r2 = regularidade([noite("2026-11-17", "23:00", "07:00"), noite("2026-11-18", "23:00", "07:00")], SP);
    expect(r2.desvioDormir).toBeNull();
    const r3 = regularidade(
      [noite("2026-11-16", "22:30", "06:30"), noite("2026-11-17", "23:30", "06:30"), noite("2026-11-18", "00:30", "06:30")],
      SP,
    );
    expect(horaDeMinutos(r3.dormir)).toBe("23:30");
    expect(r3.desvioAcordar).toBeCloseTo(0, 5);
    expect(Math.round(r3.desvioDormir!)).toBe(49); // √((60²+0+60²)/3)
  });
});

describe("aula × fim de semana", () => {
  const AULA = diasParaBits([1, 2, 3, 4, 5]);
  it("classifica pelo dia em que acordou", () => {
    expect(noiteDeAula("2026-11-16", AULA)).toBe(true); // segunda
    expect(noiteDeAula("2026-11-22", AULA)).toBe(false); // domingo
    expect(bitsParaDias(AULA)).toEqual([1, 2, 3, 4, 5]);
  });
  it("jet lag social = diferença dos pontos médios", () => {
    const r = aulaVsLivre(
      [
        noite("2026-11-16", "22:00", "06:00"),
        noite("2026-11-17", "22:00", "06:00"),
        noite("2026-11-21", "00:00", "10:00"),
        noite("2026-11-22", "00:00", "10:00"),
      ],
      AULA,
      SP,
    );
    expect(r.aula.n).toBe(2);
    expect(r.livre.n).toBe(2);
    expect(horaDeMinutos(r.aula.meio)).toBe("02:00");
    expect(horaDeMinutos(r.livre.meio)).toBe("05:00");
    expect(r.jetlagMin).toBe(180);
  });
  it("sem 2 noites de cada lado não calcula", () => {
    expect(aulaVsLivre([noite("2026-11-16", "22:00", "06:00")], AULA, SP).jetlagMin).toBeNull();
  });
});

describe("sono e energia", () => {
  const ck = (dia: string, energia: number): [string, Checkin] => [dia, { dia, energia, humor: null, estresse: null, disposicao: null, emocoes: [], notas: null }];
  it("compara energia depois de noites com e sem a meta, com 3 de cada lado", () => {
    const dias = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    const noites = dias.map((d, i) => (i < 3 ? noite(d, "22:00", "07:00") : noite(d, "00:30", "06:30")));
    const checkins = new Map([ck(dias[0], 8), ck(dias[1], 9), ck(dias[2], 7), ck(dias[3], 5), ck(dias[4], 6), ck(dias[5], 4)]);
    const r = sonoEEnergia(noites, checkins, 540)!;
    expect(r.a).toBe(8);
    expect(r.b).toBe(5);
    expect(bateuMeta(noites[0], 540)).toBe(true);
    expect(sonoEEnergia(noites.slice(0, 5), checkins, 540)).toBeNull();
  });
});

describe("lembrete de preparar o descanso", () => {
  it("liga na janela antes do horário, inclusive cruzando a meia-noite", () => {
    expect(lembreteDescanso(22 * 60, "22:30", 30)).toBe(true);
    expect(lembreteDescanso(22 * 60 + 30, "22:30", 30)).toBe(true);
    expect(lembreteDescanso(21 * 60 + 59, "22:30", 30)).toBe(false);
    expect(lembreteDescanso(22 * 60 + 31, "22:30", 30)).toBe(false);
    expect(lembreteDescanso(23 * 60 + 50, "00:10", 30)).toBe(true);
    expect(lembreteDescanso(5, "00:10", 30)).toBe(true);
    expect(lembreteDescanso(22 * 60, "22:30", 0)).toBe(false);
  });
});
