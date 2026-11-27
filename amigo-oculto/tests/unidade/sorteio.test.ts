import { describe, expect, it, vi } from "vitest";
import {
  ErroSorteio,
  emparelhar,
  fonteCripto,
  montarProibidos,
  sortear,
  sorteioViavel,
  validarPares,
  type FonteAleatoria,
  type Restricao,
} from "@/lib/sorteio/algoritmo";

/** Fonte com semente (só nos testes, para reproduzir casos). */
function fonteSemente(semente: number): FonteAleatoria {
  let s = semente >>> 0 || 1;
  return {
    inteiro(n: number) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) % n;
    },
  };
}

const pessoas = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function restricoesAleatorias(ps: string[], quantas: number, f: FonteAleatoria): Restricao[] {
  const r: Restricao[] = [];
  for (let k = 0; k < quantas; k++) {
    const a = ps[f.inteiro(ps.length)];
    const b = ps[f.inteiro(ps.length)];
    if (a !== b) r.push({ giver: a, receiver: b, mutual: f.inteiro(2) === 0 });
  }
  return r;
}

/** Todas as permutações válidas por força bruta (n pequeno). */
function todasValidas(ps: string[], rs: Restricao[]): string[][] {
  const proibidos = montarProibidos(ps, rs);
  const out: string[][] = [];
  const usado = new Set<string>();
  const atual: string[] = [];
  const rec = (i: number) => {
    if (i === ps.length) {
      out.push([...atual]);
      return;
    }
    for (const r of ps) {
      if (usado.has(r) || proibidos.get(ps[i])!.has(r)) continue;
      usado.add(r);
      atual.push(r);
      rec(i + 1);
      atual.pop();
      usado.delete(r);
    }
  };
  rec(0);
  return out;
}

describe("sorteio: regras obrigatórias", () => {
  it("ninguém tira a si mesmo, todos dão e recebem exatamente uma vez (3 a 60 pessoas, 4000 sorteios)", () => {
    const f = fonteSemente(42);
    for (let k = 0; k < 4000; k++) {
      const n = 3 + (k % 58);
      const ps = pessoas(n);
      const { pares } = sortear(ps, []);
      expect(validarPares(ps, [], pares)).toBeNull();
      expect(new Set(pares.map((p) => p.giver)).size).toBe(n);
      expect(new Set(pares.map((p) => p.receiver)).size).toBe(n);
      for (const p of pares) expect(p.giver).not.toBe(p.receiver);
      void f;
    }
  });

  it("respeita todas as restrições (simples e mútuas) em 3000 cenários aleatórios", () => {
    const f = fonteSemente(7);
    let sorteados = 0;
    for (let k = 0; k < 3000; k++) {
      const ps = pessoas(3 + f.inteiro(20));
      const rs = restricoesAleatorias(ps, f.inteiro(ps.length * 2), f);
      if (!sorteioViavel(ps, rs)) {
        expect(() => sortear(ps, rs)).toThrowError(ErroSorteio);
        continue;
      }
      const { pares } = sortear(ps, rs);
      expect(validarPares(ps, rs, pares)).toBeNull();
      sorteados++;
    }
    expect(sorteados).toBeGreaterThan(1500);
  });

  it("a viabilidade bate com a força bruta em todos os casos pequenos (n ≤ 6)", () => {
    const f = fonteSemente(2026);
    for (let k = 0; k < 1500; k++) {
      const ps = pessoas(3 + f.inteiro(4));
      const rs = restricoesAleatorias(ps, f.inteiro(ps.length * 3), f);
      expect(sorteioViavel(ps, rs)).toBe(todasValidas(ps, rs).length > 0);
    }
  });

  it("detecta combinação impossível antes de sortear", () => {
    const ps = ["ana", "bia", "caio"];
    // Ana não pode tirar ninguém: impossível
    const rs: Restricao[] = [
      { giver: "ana", receiver: "bia", mutual: false },
      { giver: "ana", receiver: "caio", mutual: false },
    ];
    expect(sorteioViavel(ps, rs)).toBe(false);
    try {
      sortear(ps, rs);
      throw new Error("deveria falhar");
    } catch (e) {
      expect(e).toBeInstanceOf(ErroSorteio);
      expect((e as ErroSorteio).codigo).toBe("impossivel");
    }
  });

  it("casais que não podem se tirar (mútuo): nunca aparecem juntos", () => {
    const ps = pessoas(10);
    const rs: Restricao[] = [
      { giver: "p0", receiver: "p1", mutual: true },
      { giver: "p2", receiver: "p3", mutual: true },
      { giver: "p4", receiver: "p5", mutual: true },
    ];
    for (let k = 0; k < 2000; k++) {
      const { pares } = sortear(ps, rs);
      for (const { giver, receiver } of pares) {
        const par = [giver, receiver].sort().join("-");
        expect(["p0-p1", "p2-p3", "p4-p5"]).not.toContain(par);
      }
    }
  });

  it("recusa menos de 3 participantes e nomes repetidos", () => {
    expect(() => sortear(["a", "b"], [])).toThrowError(/pelo menos 3/);
    expect(() => sortear(["a", "b", "a"], [])).toThrowError(/repetidos/);
  });

  it("recusa restrição com alguém de fora do sorteio", () => {
    expect(() => sortear(["a", "b", "c"], [{ giver: "a", receiver: "z", mutual: false }])).toThrowError(ErroSorteio);
  });
});

describe("sorteio: aleatoriedade", () => {
  it("é uniforme entre as combinações válidas (n = 4: os 9 desarranjos, qui-quadrado)", () => {
    const ps = pessoas(4);
    const N = 27000;
    const contagem = new Map<string, number>();
    for (let k = 0; k < N; k++) {
      const { pares } = sortear(ps, []);
      const chave = pares.map((p) => p.receiver).join(",");
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    expect(contagem.size).toBe(9);
    const esperado = N / 9;
    let qui = 0;
    for (const c of contagem.values()) qui += (c - esperado) ** 2 / esperado;
    // 8 graus de liberdade: p = 0,001 em 26,12
    expect(qui).toBeLessThan(26.12);
  });

  it("com restrições continua uniforme entre as válidas (n = 5, qui-quadrado)", () => {
    const ps = pessoas(5);
    const rs: Restricao[] = [{ giver: "p0", receiver: "p1", mutual: true }, { giver: "p2", receiver: "p4", mutual: false }];
    const validas = todasValidas(ps, rs);
    const N = 400 * validas.length;
    const contagem = new Map<string, number>();
    for (let k = 0; k < N; k++) {
      const chave = sortear(ps, rs).pares.map((p) => p.receiver).join(",");
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    expect(contagem.size).toBe(validas.length);
    const esperado = N / validas.length;
    let qui = 0;
    for (const c of contagem.values()) qui += (c - esperado) ** 2 / esperado;
    // limite folgado (p ≈ 0,0001) para não falhar por acaso
    expect(qui).toBeLessThan(validas.length - 1 + 6 * Math.sqrt(2 * (validas.length - 1)));
  });

  it("usa a Web Crypto e nunca Math.random", () => {
    const espiaRandom = vi.spyOn(Math, "random");
    const espiaCripto = vi.spyOn(globalThis.crypto, "getRandomValues");
    sortear(pessoas(12), []);
    expect(espiaRandom).not.toHaveBeenCalled();
    expect(espiaCripto).toHaveBeenCalled();
    espiaRandom.mockRestore();
    espiaCripto.mockRestore();
  });

  it("a fonte criptográfica cobre todo o intervalo sem sair dele", () => {
    const f = fonteCripto();
    const vistos = new Set<number>();
    for (let k = 0; k < 5000; k++) {
      const v = f.inteiro(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      vistos.add(v);
    }
    expect(vistos.size).toBe(7);
    expect(() => f.inteiro(0)).toThrow();
  });
});

describe("sorteio: casos difíceis", () => {
  it("cai na construção guiada quando a rejeição não acha e mesmo assim respeita tudo", () => {
    const f = fonteSemente(99);
    for (let k = 0; k < 300; k++) {
      const ps = pessoas(6 + f.inteiro(8));
      const rs = restricoesAleatorias(ps, ps.length * 3, f);
      if (!sorteioViavel(ps, rs)) continue;
      const r = sortear(ps, rs, { tentativasRejeicao: 0 });
      expect(r.metodo).toBe("guiado");
      expect(validarPares(ps, rs, r.pares)).toBeNull();
    }
  });

  it("único jeito possível: acha a única combinação (ciclo forçado)", () => {
    const ps = pessoas(5);
    // cada um só pode tirar o próximo
    const rs: Restricao[] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (j !== i && j !== (i + 1) % 5) rs.push({ giver: ps[i], receiver: ps[j], mutual: false });
    expect(todasValidas(ps, rs)).toHaveLength(1);
    for (const tentativas of [0, 5000]) {
      const { pares } = sortear(ps, rs, { tentativasRejeicao: tentativas });
      for (const p of pares) expect(p.receiver).toBe(ps[(ps.indexOf(p.giver) + 1) % 5]);
    }
  });

  it("sorteia 1000 participantes com restrições em menos de 2 s", () => {
    const ps = pessoas(1000);
    const f = fonteSemente(5);
    const rs = restricoesAleatorias(ps, 1500, f);
    const t0 = performance.now();
    const { pares } = sortear(ps, rs);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(validarPares(ps, rs, pares)).toBeNull();
  });

  it("emparelhamento máximo devolve só arestas permitidas", () => {
    const ps = pessoas(8);
    const proibidos = montarProibidos(ps, [{ giver: "p0", receiver: "p1", mutual: true }]);
    const m = emparelhar(ps, ps, (d, r) => !proibidos.get(d)!.has(r));
    expect(m.size).toBe(8);
    for (const [d, r] of m) expect(proibidos.get(d)!.has(r)).toBe(false);
    expect(new Set(m.values()).size).toBe(8);
  });
});
