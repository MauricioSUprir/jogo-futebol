import { describe, expect, it } from "vitest";
import {
  CONQUISTAS,
  calcularConquistas,
  conquistasDe,
  detalhesDosPontos,
  lerEstatisticas,
  posicoes,
  type EstatisticasParticipacao,
} from "@/lib/conquistas";

function estat(parcial: Partial<EstatisticasParticipacao> = {}): EstatisticasParticipacao {
  return {
    participant_id: "p1",
    user_id: "u1",
    display_name: "Ana",
    avatar_path: null,
    chat: 0,
    wall: 0,
    votes: 0,
    quiz_answers: 0,
    quiz_correct: 0,
    quiz_questions: 0,
    wishlist: 0,
    cards: 0,
    capsules: 0,
    challenges: 0,
    bingo: 0,
    photos: 0,
    rsvp: false,
    gift_bought: false,
    viewed: false,
    points: 0,
    ...parcial,
  };
}

describe("conquistas", () => {
  it("ids únicos, metas positivas e as medalhas pedidas pelo cliente", () => {
    const ids = CONQUISTAS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CONQUISTAS) expect(c.meta).toBeGreaterThan(0);
    const nomes = CONQUISTAS.map((c) => c.nome);
    for (const n of [
      "Confirmado", "Curioso", "Lista completa", "Presente garantido", "Tagarela", "Artista do mural", "Detetive do quiz",
      "Carteiro", "Viajante do tempo", "Sortudo do bingo", "Desafiador", "Fotógrafo",
    ]) {
      expect(nomes).toContain(n);
    }
  });

  it("quem não fez nada não tem nenhuma", () => {
    expect(conquistasDe(estat())).toHaveLength(0);
    for (const c of calcularConquistas(estat())) {
      expect(c.progresso).toBe(0);
      expect(c.conquistada).toBe(false);
    }
  });

  it("libera pela meta e mostra o progresso parcial", () => {
    const e = estat({ rsvp: true, chat: 4, wall: 3, bingo: 1, photos: 7, wishlist: 2 });
    const ids = conquistasDe(e).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["confirmado", "artista-do-mural", "sortudo-do-bingo", "fotografo"]));
    expect(ids).not.toContain("tagarela");
    const tagarela = calcularConquistas(e).find((c) => c.id === "tagarela")!;
    expect(tagarela.progresso).toBeCloseTo(0.4);
    const lista = calcularConquistas(e).find((c) => c.id === "lista-completa")!;
    expect(lista.atual).toBe(2);
    expect(lista.conquistada).toBe(false);
    // progresso nunca passa de 100%
    expect(calcularConquistas(e).find((c) => c.id === "fotografo")!.progresso).toBe(1);
  });

  it("quem fez tudo tem todas", () => {
    const e = estat({
      rsvp: true, viewed: true, gift_bought: true, wishlist: 5, chat: 30, wall: 10, votes: 5, quiz_correct: 5,
      quiz_answers: 5, quiz_questions: 5, cards: 5, capsules: 2, bingo: 1, challenges: 4, photos: 10,
    });
    expect(conquistasDe(e)).toHaveLength(CONQUISTAS.length);
  });
});

describe("pontos e posições", () => {
  it("o detalhe dos pontos usa os mesmos pesos e limites do banco", () => {
    const e = estat({ rsvp: true, chat: 50, wall: 12, photos: 2, bingo: 1 });
    const d = detalhesDosPontos(e);
    const soma = d.reduce((s, i) => s + i.pontos, 0);
    // 10 (rsvp) + 30 (chat limitado a 30) + 30 (mural limitado a 10 × 3) + 6 (fotos) + 15 (bingo)
    expect(soma).toBe(91);
    expect(d.find((i) => i.rotulo === "Mensagens no chat")).toEqual({ rotulo: "Mensagens no chat", quantidade: 50, pontos: 30 });
    expect(d.every((i) => i.quantidade > 0)).toBe(true);
  });

  it("empates dividem a posição", () => {
    expect(posicoes([{ points: 50 }, { points: 40 }, { points: 40 }, { points: 10 }])).toEqual([1, 2, 2, 4]);
    expect(posicoes([])).toEqual([]);
  });

  it("lê o JSON do banco com números em texto", () => {
    const [e] = lerEstatisticas([{ participant_id: "x", display_name: "Bia", chat: "3", points: "12", rsvp: true }]);
    expect(e.chat).toBe(3);
    expect(e.points).toBe(12);
    expect(e.rsvp).toBe(true);
    expect(e.wall).toBe(0);
    expect(lerEstatisticas(null)).toEqual([]);
  });
});
