import { describe, expect, it } from "vitest";
import {
  RASCUNHO_VAZIO,
  argumentosCriarEvento,
  colunasDoEvento,
  errosDoEvento,
  esquemaEvento,
  etapaDoCampo,
  eventoParaRascunho,
  lerValor,
  normalizarCodigo,
  rascunhoParaEntrada,
  type EntradaEvento,
} from "@/lib/validacao/evento";

const AGORA = new Date("2026-11-27T12:00:00.000Z");
const emDias = (d: number) => new Date(AGORA.getTime() + d * 86400e3).toISOString();

function entrada(extra: Partial<EntradaEvento> = {}): EntradaEvento {
  return { ...rascunhoParaEntrada({ ...RASCUNHO_VAZIO, nome: "Amigo oculto da família" }), ...extra };
}

describe("validação do evento", () => {
  it("aceita o mínimo (só o nome) e normaliza os vazios para null", () => {
    const r = esquemaEvento({ agora: AGORA }).parse(entrada());
    expect(r.nome).toBe("Amigo oculto da família");
    expect(r.descricao).toBeNull();
    expect(r.valorMinimo).toBeNull();
    expect(r.limite).toBeNull();
    expect(r.revelacaoEm).toBeNull();
    expect(r.modoSorteio).toBe("manual");
    expect(r.visibilidade).toBe("private");
    expect(r.aprovacao).toBe(false);
  });

  it("nome: 3 a 80 caracteres, sem espaços sobrando", () => {
    expect(errosDoEvento(entrada({ nome: "ab" }), { agora: AGORA }).nome).toMatch(/pelo menos 3/);
    expect(errosDoEvento(entrada({ nome: "   " }), { agora: AGORA }).nome).toBeTruthy();
    expect(errosDoEvento(entrada({ nome: "x".repeat(81) }), { agora: AGORA }).nome).toMatch(/até 80/);
    expect(esquemaEvento({ agora: AGORA }).parse(entrada({ nome: "  Natal   da   firma " })).nome).toBe("Natal da firma");
    expect(errosDoEvento(entrada({ nome: "x".repeat(80) }), { agora: AGORA })).toEqual({});
  });

  it("datas precisam estar no futuro", () => {
    expect(errosDoEvento(entrada({ revelacaoEm: emDias(-1) }), { agora: AGORA }).revelacaoEm).toMatch(/futura/);
    expect(errosDoEvento(entrada({ prazoEntrada: emDias(-2) }), { agora: AGORA }).prazoEntrada).toMatch(/futura/);
    expect(errosDoEvento(entrada({ sorteioEm: emDias(-3) }), { agora: AGORA }).sorteioEm).toMatch(/futuro/);
    expect(errosDoEvento(entrada({ revelacaoEm: emDias(5) }), { agora: AGORA })).toEqual({});
    expect(errosDoEvento(entrada({ revelacaoEm: "não é data" }), { agora: AGORA }).revelacaoEm).toMatch(/inválid/);
  });

  it("na edição, uma data que não mudou pode estar no passado", () => {
    const antiga = emDias(-10);
    expect(errosDoEvento(entrada({ revelacaoEm: antiga }), { agora: AGORA, original: { revelacaoEm: antiga } })).toEqual({});
    // mudar para outra data passada continua proibido
    expect(errosDoEvento(entrada({ revelacaoEm: emDias(-9) }), { agora: AGORA, original: { revelacaoEm: antiga } }).revelacaoEm).toBeTruthy();
  });

  it("ordem: prazo de entrada ≤ sorteio ≤ revelação", () => {
    const ok = entrada({ prazoEntrada: emDias(2), sorteioEm: emDias(3), revelacaoEm: emDias(10) });
    expect(errosDoEvento(ok, { agora: AGORA })).toEqual({});
    expect(errosDoEvento(entrada({ prazoEntrada: emDias(5), sorteioEm: emDias(3) }), { agora: AGORA }).prazoEntrada).toMatch(/até a data do sorteio/);
    expect(errosDoEvento(entrada({ sorteioEm: emDias(11), revelacaoEm: emDias(10) }), { agora: AGORA }).sorteioEm).toMatch(/antes da revelação/);
    expect(errosDoEvento(entrada({ prazoEntrada: emDias(12), revelacaoEm: emDias(10) }), { agora: AGORA }).prazoEntrada).toMatch(/antes da revelação/);
    // datas iguais são aceitas
    expect(errosDoEvento(entrada({ prazoEntrada: emDias(3), sorteioEm: emDias(3), revelacaoEm: emDias(3) }), { agora: AGORA })).toEqual({});
  });

  it("sorteio agendado exige a data do sorteio", () => {
    expect(errosDoEvento(entrada({ modoSorteio: "scheduled" }), { agora: AGORA }).sorteioEm).toMatch(/agendado/);
    expect(errosDoEvento(entrada({ modoSorteio: "scheduled", sorteioEm: emDias(1) }), { agora: AGORA })).toEqual({});
    // no manual a data é opcional
    expect(errosDoEvento(entrada({ modoSorteio: "manual" }), { agora: AGORA })).toEqual({});
  });

  it("valores: formato brasileiro, mínimo ≤ máximo, sem negativos", () => {
    const r = esquemaEvento({ agora: AGORA }).parse(entrada({ valorMinimo: "R$ 49,90", valorMaximo: "1.000" }));
    expect(r.valorMinimo).toBe(49.9);
    expect(r.valorMaximo).toBe(1000);
    expect(errosDoEvento(entrada({ valorMinimo: "100", valorMaximo: "50" }), { agora: AGORA }).valorMaximo).toMatch(/maior ou igual/);
    expect(errosDoEvento(entrada({ valorMinimo: "50", valorMaximo: "50" }), { agora: AGORA })).toEqual({});
    expect(errosDoEvento(entrada({ valorMinimo: "-5" }), { agora: AGORA }).valorMinimo).toBeTruthy();
    expect(errosDoEvento(entrada({ valorMaximo: "abc" }), { agora: AGORA }).valorMaximo).toMatch(/reais/);
    expect(errosDoEvento(entrada({ valorMaximo: "200000" }), { agora: AGORA }).valorMaximo).toMatch(/100\.000/);
  });

  it("limite de participantes entre 3 e 1000 (e não abaixo de quem já entrou)", () => {
    expect(errosDoEvento(entrada({ limite: "2" }), { agora: AGORA }).limite).toMatch(/mínimo/);
    expect(errosDoEvento(entrada({ limite: "1001" }), { agora: AGORA }).limite).toMatch(/máximo/);
    expect(errosDoEvento(entrada({ limite: "10,5" }), { agora: AGORA }).limite).toMatch(/inteiro/);
    expect(esquemaEvento({ agora: AGORA }).parse(entrada({ limite: "30" })).limite).toBe(30);
    expect(errosDoEvento(entrada({ limite: "5" }), { agora: AGORA, ocupados: 8 }).limite).toMatch(/já tem 8/);
    expect(errosDoEvento(entrada({ limite: "8" }), { agora: AGORA, ocupados: 8 })).toEqual({});
  });

  it("tema, visibilidade e modo só aceitam os valores conhecidos", () => {
    expect(errosDoEvento({ ...entrada(), tema: "halloween" }, { agora: AGORA }).tema).toBeTruthy();
    expect(errosDoEvento({ ...entrada(), visibilidade: "secreto" }, { agora: AGORA }).visibilidade).toBeTruthy();
    expect(errosDoEvento({ ...entrada(), modoSorteio: "talvez" }, { agora: AGORA }).modoSorteio).toBeTruthy();
  });

  it("textos longos demais são recusados", () => {
    expect(errosDoEvento(entrada({ descricao: "x".repeat(2001) }), { agora: AGORA }).descricao).toBeTruthy();
    expect(errosDoEvento(entrada({ regras: "x".repeat(4001) }), { agora: AGORA }).regras).toBeTruthy();
    expect(errosDoEvento(entrada({ local: "x".repeat(201) }), { agora: AGORA }).local).toBeTruthy();
  });

  it("rascunho ↔ banco: datas no horário de São Paulo", () => {
    const e = rascunhoParaEntrada({ ...RASCUNHO_VAZIO, nome: "Teste", revelacaoEm: "2026-12-24T20:00" });
    expect(e.revelacaoEm).toBe("2026-12-24T23:00:00.000Z");
    const r = eventoParaRascunho({
      name: "Teste",
      description: null,
      cover_path: null,
      theme: "aniversario",
      reveal_at: "2026-12-24T23:00:00+00:00",
      location: "Casa",
      gift_min: 50,
      gift_max: 99.9,
      max_participants: 20,
      rules: null,
      join_deadline: null,
      draw_at: null,
      draw_mode: "manual",
      visibility: "public",
      requires_approval: true,
    });
    expect(r.revelacaoEm).toBe("2026-12-24T20:00");
    expect(r.valorMaximo).toBe("99,9");
    expect(r.limite).toBe("20");
    expect(r.tema).toBe("aniversario");
    expect(r.aprovacao).toBe(true);
  });

  it("argumentos da criação e colunas da edição", () => {
    const d = esquemaEvento({ agora: AGORA }).parse(
      entrada({ valorMinimo: "30", limite: "12", sorteioEm: emDias(2), modoSorteio: "scheduled", aprovacao: true }),
    );
    const args = argumentosCriarEvento(d);
    expect(args.p_name).toBe("Amigo oculto da família");
    expect(args.p_gift_min).toBe(30);
    expect(args.p_gift_max).toBeUndefined(); // vazio → padrão do banco
    expect(args.p_draw_mode).toBe("scheduled");
    expect(args.p_requires_approval).toBe(true);

    const abertas = colunasDoEvento(d, { sorteado: false });
    expect(abertas).toHaveProperty("max_participants", 12);
    expect(abertas).toHaveProperty("draw_mode", "scheduled");
    const depois = colunasDoEvento(d, { sorteado: true });
    for (const travado of ["max_participants", "join_deadline", "draw_at", "draw_mode", "requires_approval"]) {
      expect(depois).not.toHaveProperty(travado);
    }
    expect(depois).toHaveProperty("gift_min", 30);
  });

  it("utilitários: valores, código e etapa do campo", () => {
    expect(lerValor("")).toBeNull();
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("50.5")).toBe(50.5);
    expect(Number.isNaN(lerValor("1,2,3") as number)).toBe(true);
    expect(normalizarCodigo(" rw7v-3x2h ")).toBe("RW7V3X2H");
    expect(normalizarCodigo("curto")).toBeNull();
    expect(etapaDoCampo("valorMaximo")).toBe("presentes");
    expect(etapaDoCampo("sorteioEm")).toBe("participacao");
    expect(etapaDoCampo("inexistente")).toBeNull();
  });
});
