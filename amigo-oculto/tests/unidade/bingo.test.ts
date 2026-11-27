import { describe, expect, it } from "vitest";
import {
  CASA_LIVRE,
  LINHAS_BINGO,
  POSICAO_CENTRAL,
  TERMOS_BINGO,
  chamadasNaoMarcadas,
  faltamParaBingo,
  linhasCompletas,
  temBingo,
  termoDoBingo,
} from "@/lib/bingo";

/** Cartela como o banco gera: 24 números distintos e o centro livre. */
function cartela(): number[] {
  const nums = Array.from({ length: 24 }, (_, i) => i * 3); // 0, 3, 6, … 69
  return [...nums.slice(0, 12), CASA_LIVRE, ...nums.slice(12)];
}

describe("termos do bingo", () => {
  it("são 75, todos diferentes, curtos e não vazios", () => {
    expect(TERMOS_BINGO).toHaveLength(75);
    expect(new Set(TERMOS_BINGO.map((t) => t.toLowerCase())).size).toBe(75);
    for (const t of TERMOS_BINGO) {
      expect(t.trim()).toBe(t);
      expect(t.length).toBeGreaterThan(1);
      expect(t.length).toBeLessThanOrEqual(16);
    }
  });

  it("o centro é LIVRE e cada número tem o seu texto", () => {
    expect(termoDoBingo(CASA_LIVRE)).toBe("LIVRE");
    expect(termoDoBingo(0)).toBe(TERMOS_BINGO[0]);
    expect(termoDoBingo(74)).toBe(TERMOS_BINGO[74]);
    expect(termoDoBingo(99)).toBe("Nº 100");
  });
});

describe("regras do bingo (as mesmas do banco)", () => {
  it("12 linhas de 5 casas, e as que passam pelo centro são 4", () => {
    expect(LINHAS_BINGO).toHaveLength(12);
    for (const l of LINHAS_BINGO) expect(l).toHaveLength(5);
    expect(LINHAS_BINGO.filter((l) => l.includes(POSICAO_CENTRAL))).toHaveLength(4);
  });

  it("linha horizontal marcada e chamada vale bingo", () => {
    const c = cartela();
    const chamados = [0, 1, 2, 3, 4].map((p) => c[p]);
    expect(temBingo(c, [0, 1, 2, 3, 4], chamados)).toBe(true);
    expect(linhasCompletas(c, [0, 1, 2, 3, 4], chamados)).toEqual([0]);
  });

  it("marcar sem o número ter sido chamado não conta", () => {
    const c = cartela();
    const chamados = [0, 1, 2, 3].map((p) => c[p]);
    expect(temBingo(c, [0, 1, 2, 3, 4], chamados)).toBe(false);
    expect(faltamParaBingo(c, [0, 1, 2, 3, 4], chamados)).toBe(1);
  });

  it("chamado mas não marcado também não conta (a pessoa tem que marcar)", () => {
    const c = cartela();
    const chamados = c.filter((n) => n >= 0);
    expect(temBingo(c, [], chamados)).toBe(false);
    expect(chamadasNaoMarcadas(c, [], chamados)).toHaveLength(24);
    expect(chamadasNaoMarcadas(c, [], chamados)).not.toContain(POSICAO_CENTRAL);
  });

  it("a casa livre completa a linha do meio, a coluna do meio e as diagonais com 4 casas", () => {
    const c = cartela();
    const meio = [10, 11, 13, 14];
    const diagonal = [0, 6, 18, 24];
    expect(temBingo(c, meio, meio.map((p) => c[p]))).toBe(true);
    expect(linhasCompletas(c, diagonal, diagonal.map((p) => c[p]))).toEqual([10]);
  });

  it("faltam: 4 numa cartela nova (as linhas do centro já têm 1 casa)", () => {
    expect(faltamParaBingo(cartela(), [], [])).toBe(4);
  });

  it("cartela inválida nunca dá bingo", () => {
    expect(temBingo([1, 2, 3], [0, 1, 2], [1, 2, 3])).toBe(false);
  });
});
