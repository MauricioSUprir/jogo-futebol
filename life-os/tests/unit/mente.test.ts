import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  apoioNoTopo,
  diaMaisEstressante,
  diasComProvaPerto,
  duracaoCiclo,
  emocoesFrequentes,
  estresseEProvas,
  estresseESono,
  estressePorDiaDaSemana,
  frasesPadroes,
  posicaoRespiracao,
} from "@/lib/mente";
import { chaveConfere, chaveDaSenha, criarVerificador, desembrulharChave, embrulharChave, novoSal } from "@/lib/seguranca/diario";
import { cifrar, decifrar } from "@/lib/seguranca/cifra";
import { somaDias } from "@/lib/datas";

process.env.LIFEOS_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
const ck = (dia: string, estresse: number | null, humor: number | null = 3, emocoes: string[] = []) => ({ dia, estresse, humor, emocoes });
// 2026-11-16 é segunda-feira.
const SEG = "2026-11-16";

describe("respiração", () => {
  it("duração do ciclo", () => {
    expect(duracaoCiclo("caixa")).toBe(16);
    expect(duracaoCiclo("relaxante")).toBe(19);
    expect(duracaoCiclo("coerencia")).toBe(10);
  });
  it("posição dentro do ciclo e fim", () => {
    expect(posicaoRespiracao("caixa", 0, 2)).toEqual({ ciclo: 1, fase: 0, restante: 4, fim: false });
    expect(posicaoRespiracao("caixa", 4, 2)).toMatchObject({ ciclo: 1, fase: 1, restante: 4 });
    expect(posicaoRespiracao("caixa", 13.5, 2)).toMatchObject({ ciclo: 1, fase: 3, restante: 3 });
    expect(posicaoRespiracao("caixa", 16, 2)).toMatchObject({ ciclo: 2, fase: 0 });
    expect(posicaoRespiracao("relaxante", 10, 1)).toMatchObject({ fase: 1, restante: 1 });
    expect(posicaoRespiracao("caixa", 32, 2).fim).toBe(true);
  });
});

describe("padrões de estresse", () => {
  it("média por dia da semana ignora dias sem estresse", () => {
    const por = estressePorDiaDaSemana([ck(SEG, 4), ck(somaDias(SEG, 7), 2), ck(somaDias(SEG, 1), null)]);
    expect(por[1]).toEqual({ dow: 1, media: 3, n: 2 });
    expect(por[2]).toEqual({ dow: 2, media: null, n: 0 });
  });
  it("dia mais estressante só com dados suficientes e diferença clara", () => {
    const tres = Array.from({ length: 21 }, (_, i) => ck(somaDias(SEG, i), i % 7 === 0 ? 5 : 2));
    const r = diaMaisEstressante(tres);
    expect(r?.dow).toBe(1);
    expect(r!.media).toBe(5);
    expect(diaMaisEstressante(tres.slice(0, 10))).toBeNull(); // < 14 registros
    expect(diaMaisEstressante(Array.from({ length: 21 }, (_, i) => ck(somaDias(SEG, i), 3)))).toBeNull(); // sem diferença
  });
  it("estresse depois de noites curtas × meta batida", () => {
    const sono = new Map<string, number>();
    const cks = [];
    for (let i = 0; i < 6; i++) {
      const d = somaDias(SEG, i);
      sono.set(d, i < 3 ? 400 : 560);
      cks.push(ck(d, i < 3 ? 4 : 2));
    }
    expect(estresseESono(cks, sono, 540)).toMatchObject({ a: 4, b: 2, na: 3, nb: 3, diferenca: 2 });
    expect(estresseESono(cks.slice(0, 4), sono, 540)).toBeNull(); // só 1 noite boa
  });
  it("prova perto (até 3 dias depois, inclusive o dia)", () => {
    const dias = [SEG, somaDias(SEG, 1), somaDias(SEG, 2), somaDias(SEG, 5)];
    const s = diasComProvaPerto(dias, [somaDias(SEG, 3)]);
    expect([...s]).toEqual([SEG, somaDias(SEG, 1), somaDias(SEG, 2)]);
    const r = estresseEProvas(
      [ck(SEG, 5), ck(somaDias(SEG, 1), 4), ck(somaDias(SEG, 2), 4), ck(somaDias(SEG, 5), 2), ck(somaDias(SEG, 6), 2), ck(somaDias(SEG, 8), 1)],
      s,
    );
    expect(r?.diferenca).toBeCloseTo(13 / 3 - 5 / 3);
  });
  it("frases sem diagnóstico e só com diferença real", () => {
    const f = frasesPadroes({
      dia: { dow: 1, media: 4.5, geral: 3 },
      sono: { a: 4, b: 2.5, na: 3, nb: 4, diferenca: 1.5 },
      provas: { a: 3.1, b: 3, na: 3, nb: 3, diferenca: 0.1 },
    });
    expect(f).toHaveLength(2);
    expect(f[0].texto).toContain("noites abaixo da sua meta");
    expect(f[1].texto).toContain("Às segundas");
    expect(f.map((x) => x.texto).join(" ")).not.toMatch(/ansiedade|depress|transtorno|diagn/i);
  });
});

describe("emoções e apoio", () => {
  it("emoções mais frequentes", () => {
    expect(emocoesFrequentes([ck(SEG, 1, 3, ["calma", "alegria"]), ck(SEG, 1, 3, ["calma"]), ck(SEG, 1, 3, ["tédio"])], 2)).toEqual([
      { emocao: "calma", vezes: 2 },
      { emocao: "alegria", vezes: 1 },
    ]);
  });
  it("apoio no topo com humor baixo em 3 dos últimos 7 check-ins", () => {
    const base = Array.from({ length: 10 }, (_, i) => ck(somaDias(SEG, i), 2, 4));
    expect(apoioNoTopo(base)).toBe(false);
    expect(apoioNoTopo(base.map((c, i) => (i >= 7 ? { ...c, humor: 1 } : c)))).toBe(true);
    // Humor baixo antigo (fora dos últimos 7) não conta.
    expect(apoioNoTopo(base.map((c, i) => (i < 3 ? { ...c, humor: 1 } : c)))).toBe(false);
  });
});

describe("chave do diário", () => {
  it("a senha certa confere, a errada não; a entrada só abre com a chave da senha", async () => {
    const sal = novoSal();
    const k = await chaveDaSenha("senha-do-diario-1", sal);
    const v = criarVerificador(k);
    expect(chaveConfere(v, k)).toBe(true);
    expect(chaveConfere(v, await chaveDaSenha("senha-errada-123", sal))).toBe(false);
    const c = cifrar("meu segredo", k);
    expect(c).not.toContain("segredo");
    expect(decifrar(c, k)).toBe("meu segredo");
    expect(() => decifrar(c)).toThrow(); // a chave do servidor não abre
  });
  it("cookie: preso ao usuário, com validade e à prova de adulteração", () => {
    const k = randomBytes(32);
    const v = embrulharChave("u1", k, 1_000);
    expect(desembrulharChave(v, "u1", 2_000)?.equals(k)).toBe(true);
    expect(desembrulharChave(v, "u2", 2_000)).toBeNull();
    expect(desembrulharChave(v, "u1", 1_000 + 16 * 60_000)).toBeNull();
    expect(desembrulharChave(v.slice(0, -4) + "AAAA", "u1", 2_000)).toBeNull();
    expect(desembrulharChave(undefined, "u1")).toBeNull();
  });
});
