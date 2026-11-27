import { describe, expect, it } from "vitest";
import {
  CATALOGO,
  ETIQUETAS,
  IMPLICA,
  avaliarOrcamento,
  descreverOrcamento,
  detectarEtiquetas,
  lerObservacoes,
  normalizar,
  perfilDoBanco,
  singular,
  sugerirPresentes,
  tokens,
  type PerfilParaSugestao,
} from "@/lib/sugestoes";

const ORC = { min: 50, max: 100 };
const porId = new Map(CATALOGO.map((i) => [i.id, i]));
const etiquetasDe = (id: string) => {
  const i = porId.get(id)!;
  return new Set([...i.etiquetas, ...i.etiquetas.flatMap((e) => IMPLICA[e] ?? [])]);
};

describe("texto: normalização, plural e sinônimos", () => {
  it("normaliza acentos, maiúsculas e pontuação", () => {
    expect(normalizar("  Café com LEITE!! ")).toBe("cafe com leite");
    expect(normalizar("Jogos de Tabuleiro & Cartas")).toBe("jogos de tabuleiro cartas");
  });

  it("passa plurais simples para o singular", () => {
    expect(singular("livros")).toBe("livro");
    expect(singular("flores")).toBe("flor");
    expect(singular("animais")).toBe("animal");
    expect(singular("viagens")).toBe("viagem");
    expect(singular("caes")).toBe("cao");
    expect(singular("papeis")).toBe("papel");
    expect(singular("tenis")).toBe("tenis");
    expect(singular("lapis")).toBe("lapis");
    expect(tokens("CAFÉS Especiais")).toEqual(["cafe", "especial"]);
  });

  it("reconhece sinônimos e plurais nos interesses", () => {
    expect(detectarEtiquetas("Livros")).toContain("leitura");
    expect(detectarEtiquetas("videogame")).toContain("games");
    expect(detectarEtiquetas("Cachorros")).toContain("pets");
    expect(detectarEtiquetas("CAFÉS")).toContain("cafe");
    expect(detectarEtiquetas("fotografar")).toContain("fotografia");
    expect(detectarEtiquetas("Maratonar séries")).toContain("series");
    expect(detectarEtiquetas("jogos de tabuleiro")).toContain("tabuleiro");
    expect(detectarEtiquetas("Adoro bike aos domingos")).toContain("bicicleta");
    expect(detectarEtiquetas("bebida alcoólica")).toContain("alcool");
  });

  it("não confunde palavras parecidas", () => {
    expect(detectarEtiquetas("cafeína zero")).not.toContain("leitura");
    expect(detectarEtiquetas("planejamento")).not.toContain("plantas");
    expect(detectarEtiquetas("")).toEqual(new Set());
  });

  it("separa observações positivas e negativas", () => {
    const o = lerObservacoes("Adora café, mas não bebe álcool. Tem alergia a perfume");
    expect(o.positivas).toEqual(["Adora café"]);
    expect(o.negativas).toEqual(["não bebe álcool", "Tem alergia a perfume"]);
  });
});

describe("catálogo", () => {
  it("tem ~150 ideias válidas, com ids únicos e etiquetas conhecidas", () => {
    expect(CATALOGO.length).toBeGreaterThanOrEqual(140);
    expect(new Set(CATALOGO.map((i) => i.id)).size).toBe(CATALOGO.length);
    for (const i of CATALOGO) {
      expect(i.preco[0], i.id).toBeGreaterThan(0);
      expect(i.preco[0], i.id).toBeLessThanOrEqual(i.preco[1]);
      expect(i.etiquetas.length, i.id).toBeGreaterThan(0);
      for (const e of i.etiquetas) expect(Object.keys(ETIQUETAS), `${i.id}: ${e}`).toContain(e);
      expect(i.titulo.length, i.id).toBeLessThanOrEqual(60);
    }
  });

  it("tem ideias versáteis em todas as faixas comuns de orçamento", () => {
    for (const [min, max] of [[20, 40], [30, 60], [50, 100], [100, 200], [200, 400], [400, 800]]) {
      const versateis = CATALOGO.filter((i) => i.versatil && i.preco[0] <= max && i.preco[1] >= min);
      expect(versateis.length, `${min}-${max}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("orçamento", () => {
  it("descreve o orçamento do grupo", () => {
    expect(descreverOrcamento({ min: 50, max: 100 })).toMatch(/^de R\$\s50 a R\$\s100$/);
    expect(descreverOrcamento({ max: 100 })).toMatch(/^de até R\$\s100$/);
    expect(descreverOrcamento({ min: "50" })).toMatch(/^a partir de R\$\s50$/);
    expect(descreverOrcamento(null)).toBeNull();
  });

  it("classifica dentro, perto (tolerância) e fora", () => {
    expect(avaliarOrcamento([60, 90], ORC).tipo).toBe("dentro");
    expect(avaliarOrcamento([80, 200], ORC).tipo).toBe("dentro"); // dá para achar até R$ 100
    expect(avaliarOrcamento([105, 200], ORC).tipo).toBe("acima");
    expect(avaliarOrcamento([20, 45], ORC).tipo).toBe("abaixo");
    expect(avaliarOrcamento([130, 300], ORC).tipo).toBe("fora");
    expect(avaliarOrcamento([10, 30], ORC).tipo).toBe("fora");
    expect(avaliarOrcamento([500, 900], null).tipo).toBe("livre");
  });

  it("nunca sugere nada fora do orçamento (com a tolerância de 15%)", () => {
    const perfis: PerfilParaSugestao[] = [
      {},
      { interesses: ["tecnologia", "games"] },
      { hobbies: ["viagem", "fotografia"], cores: ["azul"] },
      { interesses: ["astronomia"] }, // telescópio é caro: não pode aparecer
    ];
    for (const perfil of perfis) {
      for (const orc of [ORC, { min: 20, max: 40 }, { max: 60 }, { min: 300, max: 500 }]) {
        const lista = sugerirPresentes(perfil, orc, { quantidade: 8 });
        expect(lista.length).toBeGreaterThan(0);
        const lo = (orc.min ?? 0) * 0.85;
        const hi = orc.max * 1.15;
        for (const s of lista) {
          const ideia = porId.get(s.id)!;
          expect(ideia.preco[0], `${s.id} em ${JSON.stringify(orc)}`).toBeLessThanOrEqual(hi);
          expect(ideia.preco[1], `${s.id} em ${JSON.stringify(orc)}`).toBeGreaterThanOrEqual(lo);
          expect(s.faixa.min).toBeLessThanOrEqual(s.faixa.max);
        }
      }
    }
  });

  it("recorta a faixa mostrada pelo orçamento e diz o motivo", () => {
    const [s] = sugerirPresentes({ interesses: ["café"] }, ORC, { quantidade: 1 });
    expect(s.faixa.min).toBeGreaterThanOrEqual(50);
    expect(s.faixa.max).toBeLessThanOrEqual(100);
    expect(s.motivos.some((m) => /^Dentro do orçamento de R\$\s50 a R\$\s100$/.test(m))).toBe(true);
  });
});

describe("interesses", () => {
  it("a primeira ideia combina com o interesse e explica o porquê", () => {
    const [s] = sugerirPresentes({ interesses: ["café"] }, ORC);
    expect(etiquetasDe(s.id).has("cafe")).toBe(true);
    expect(s.motivos[0]).toBe("Porque gosta de café");
  });

  it("acha o interesse escrito de outro jeito (sinônimos, plural, maiúsculas, sem acento)", () => {
    const casos: [string, string][] = [
      ["LIVROS", "leitura"],
      ["Videogame", "games"],
      ["cachorros", "pets"],
      ["cafe", "cafe"],
      ["Corrida de rua", "corrida"],
      ["mangás", "anime"],
      ["horta", "jardinagem"],
    ];
    for (const [texto, etiqueta] of casos) {
      const lista = sugerirPresentes({ hobbies: [texto] }, { min: 30, max: 300 }, { quantidade: 3 });
      expect(etiquetasDe(lista[0].id).has(etiqueta as never), `${texto} → ${lista[0].id}`).toBe(true);
    }
  });

  it("varia as ideias quando a pessoa tem vários interesses", () => {
    const lista = sugerirPresentes({ interesses: ["café", "plantas", "games"] }, { min: 50, max: 150 }, { quantidade: 6 });
    const principais = lista.map((s) => s.etiquetas[0]);
    for (const e of ["cafe", "plantas", "games"]) expect(principais, e).toContain(e);
  });

  it("usa as palavras da lista de desejos", () => {
    const lista = sugerirPresentes({ desejos: [{ titulo: "Caneca térmica", notas: null }] }, ORC, { quantidade: 4 });
    expect(lista[0].id).toBe("caneca-termica");
    expect(lista[0].motivos).toContain("Parecido com “Caneca térmica”, da lista de desejos");
  });

  it("considera a cor favorita e o tamanho conhecido", () => {
    const comCor = sugerirPresentes({ interesses: ["yoga"], cores: ["Verde"] }, { min: 50, max: 250 }, { quantidade: 3 });
    const tapete = comCor.find((s) => s.id === "tapete-yoga");
    expect(tapete?.motivos).toContain("Dá para escolher em verde, a cor favorita");

    const semTamanho = sugerirPresentes({ interesses: ["futebol"] }, { min: 200, max: 450 }, { quantidade: 10 });
    expect(semTamanho.some((s) => porId.get(s.id)!.tamanho)).toBe(false);

    const comTamanho = sugerirPresentes({ interesses: ["futebol"], tamanhos: { camiseta: "M" } }, { min: 200, max: 450 }, { quantidade: 10 });
    const camisa = comTamanho.find((s) => s.id === "camisa-time");
    expect(camisa?.motivos).toContain("Tamanho já informado: M");
  });
});

describe("exclusões", () => {
  it("não sugere o que a pessoa disse que não quer", () => {
    const lista = sugerirPresentes({ interesses: ["chocolate", "doces", "café"], naoQuer: ["chocolate"] }, ORC, { quantidade: 10 });
    expect(lista.some((s) => etiquetasDe(s.id).has("chocolate"))).toBe(false);
  });

  it("exclui por grupo (bebida alcoólica tira vinho, cerveja e drinks) mesmo com o interesse", () => {
    const lista = sugerirPresentes({ interesses: ["vinho", "cozinha"], naoQuer: ["bebida alcoólica"] }, { min: 50, max: 300 }, { quantidade: 10 });
    for (const s of lista) {
      const e = etiquetasDe(s.id);
      expect(e.has("vinho") || e.has("cerveja") || e.has("drinks"), s.id).toBe(false);
    }
    expect(lista.length).toBeGreaterThan(0);
  });

  it("exclui por palavra e pelas observações negativas", () => {
    const porPalavra = sugerirPresentes({ interesses: ["café"], naoQuer: ["canecas"] }, ORC, { quantidade: 10 });
    expect(porPalavra.some((s) => /caneca/i.test(s.titulo))).toBe(false);

    const porObs = sugerirPresentes({ interesses: ["café"], observacoes: "Ama café, mas não bebe álcool e é alérgica a perfume." }, { min: 50, max: 600 }, { quantidade: 12 });
    expect(porObs.some((s) => etiquetasDe(s.id).has("alcool") || etiquetasDe(s.id).has("perfumaria"))).toBe(false);
  });

  it("não sugere roupa para quem disse que não quer roupa", () => {
    const lista = sugerirPresentes({ interesses: ["futebol", "fitness"], tamanhos: { camiseta: "G" }, naoQuer: ["roupas"] }, { min: 100, max: 400 }, { quantidade: 10 });
    expect(lista.some((s) => porId.get(s.id)!.tamanho === "roupa")).toBe(false);
  });
});

describe("sem interesses", () => {
  it("devolve ideias versáteis dentro do orçamento", () => {
    for (const orc of [ORC, { min: 20, max: 40 }, { min: 100, max: 200 }, null]) {
      const lista = sugerirPresentes({}, orc, { quantidade: 6 });
      expect(lista.length).toBe(6);
      for (const s of lista) {
        expect(s.versatil, `${s.id} em ${JSON.stringify(orc)}`).toBe(true);
        expect(s.motivos).toContain("Ideia versátil, agrada quase todo mundo");
      }
    }
  });

  it("é determinístico, sem repetições e respeita a quantidade", () => {
    const perfil = perfilDoBanco(
      { hobbies: ["leitura", "café"], favorite_colors: ["verde"], shirt_size: "M", interests: [], dislikes: [], notes: null },
      [{ title: "Livro de ficção" }, { title: "Caneca térmica" }],
    );
    const a = sugerirPresentes(perfil, { min: 50, max: 120 }, { quantidade: 8 });
    const b = sugerirPresentes(perfil, { min: 50, max: 120 }, { quantidade: 8 });
    expect(a).toEqual(b);
    expect(a.length).toBe(8);
    expect(new Set(a.map((s) => s.id)).size).toBe(8);
    expect(sugerirPresentes(perfil, ORC, { quantidade: 0 })).toEqual([]);
  });
});
