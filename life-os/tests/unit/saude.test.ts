import { describe, expect, it } from "vitest";
import {
  contentDisposition, energiaEAtividade, lerContatos, linhaDiario, linkTelefone, nomeAtividade, nomeSeguro, proximasDoses,
  tipoPeloConteudo, tipoValido, type DiaDiario,
} from "@/lib/saude";
import { formatarDuracao } from "@/lib/sono";
import type { Checkin } from "@/lib/checkin";
import { cifrarBytes, decifrarBytes } from "@/lib/seguranca/cifra-bytes";
import { randomBytes } from "node:crypto";

describe("cifra dos documentos", () => {
  const chave = randomBytes(32);
  it("ida e volta, IV novo a cada vez, e recusa conteúdo adulterado ou outra chave", () => {
    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 250]);
    const a = cifrarBytes(original, chave);
    const b = cifrarBytes(original, chave);
    expect(a.equals(b)).toBe(false);
    expect([...decifrarBytes(a, chave)]).toEqual([...original]);
    const adulterado = Buffer.from(a);
    adulterado[adulterado.length - 1] ^= 1;
    expect(() => decifrarBytes(adulterado, chave)).toThrow();
    expect(() => decifrarBytes(a, randomBytes(32))).toThrow();
  });
});

const ck = (dia: string, energia: number | null, extra: Partial<Checkin> = {}): Checkin => ({
  dia, energia, humor: null, estresse: null, disposicao: null, emocoes: [], notas: null, ...extra,
});

describe("tipo do arquivo pelo conteúdo", () => {
  it("reconhece PDF, PNG, JPG e WEBP pela assinatura", () => {
    expect(tipoPeloConteudo(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(tipoPeloConteudo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(tipoPeloConteudo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoPeloConteudo(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("recusa o resto, mesmo com nome de imagem", () => {
    expect(tipoPeloConteudo(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(tipoPeloConteudo(new Uint8Array([]))).toBeNull();
    expect(tipoPeloConteudo(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
  });
});

describe("nomes de arquivo", () => {
  it("tira pastas, caracteres perigosos e usa a extensão do tipo real", () => {
    expect(nomeSeguro('../../etc/Hemograma "março".pdf', "application/pdf")).toBe("Hemograma março.pdf");
    expect(nomeSeguro("foto.exe", "image/png")).toBe("foto.png");
    expect(nomeSeguro("", "image/jpeg")).toBe("documento.jpg");
  });
  it("Content-Disposition com reserva ASCII e UTF-8", () => {
    const h = contentDisposition("Hemograma março.pdf");
    expect(h).toContain('filename="Hemograma marco.pdf"');
    expect(h).toContain("filename*=UTF-8''Hemograma%20mar%C3%A7o.pdf");
  });
});

describe("emergência", () => {
  it("lê contatos sem confiar no formato", () => {
    expect(lerContatos("x")).toEqual([]);
    expect(lerContatos([{ nome: "Mãe", relacao: "mãe", telefone: "(11) 99999-0000" }, null, { nome: "" }])).toEqual([
      { nome: "Mãe", relacao: "mãe", telefone: "(11) 99999-0000" },
    ]);
  });
  it("link de telefone só com dígitos", () => {
    expect(linkTelefone("(11) 99999-0000")).toBe("tel:11999990000");
    expect(linkTelefone("+55 11 99999-0000")).toBe("tel:+5511999990000");
    expect(linkTelefone("abc")).toBeNull();
  });
});

describe("diário de saúde", () => {
  it("monta a linha no formato do plano", () => {
    const d: DiaDiario = { dia: "2026-11-17", checkin: ck("2026-11-17", 8, { disposicao: 3, notas: "Dia tranquilo." }), sonoMin: 480, atividades: ["Futebol"] };
    expect(linhaDiario(d, formatarDuracao)).toEqual(["Energia: 8/10", "Disposição: Boa", "Sono: 8 h", "Atividade física: Futebol", "Observações: Dia tranquilo."]);
    expect(linhaDiario({ dia: "2026-11-17", checkin: null, sonoMin: null, atividades: [] }, formatarDuracao)).toEqual([
      "Energia: —",
      "Disposição: —",
      "Sono: —",
      "Atividade física: —",
    ]);
  });
  it("energia com × sem atividade só com 3 dias de cada lado", () => {
    const dias: DiaDiario[] = [7, 8, 9, 5, 6, 4].map((e, i) => ({
      dia: `2026-11-1${i}`,
      checkin: ck(`2026-11-1${i}`, e),
      sonoMin: null,
      atividades: i < 3 ? ["Futebol"] : [],
    }));
    expect(energiaEAtividade(dias)).toMatchObject({ a: 8, b: 5, na: 3, nb: 3 });
    expect(energiaEAtividade(dias.slice(0, 5))).toBeNull();
  });
  it("nome da atividade", () => {
    expect(nomeAtividade("cardio", "corrida")).toBe("Corrida");
    expect(nomeAtividade("futebol", "partida")).toBe("Futebol");
    expect(nomeAtividade("xyz", null)).toBe("Atividade");
  });
});

describe("resumo", () => {
  it("próximas doses a partir de hoje, em ordem", () => {
    const r = proximasDoses(
      [
        { id: "1", tipo: "vacina", titulo: "A", dia: "2026-01-01", proximo: "2027-01-01", status: "ativo" },
        { id: "2", tipo: "vacina", titulo: "B", dia: "2026-01-01", proximo: "2026-12-01", status: "ativo" },
        { id: "3", tipo: "vacina", titulo: "C", dia: "2026-01-01", proximo: "2026-10-01", status: "ativo" },
        { id: "4", tipo: "exame", titulo: "D", dia: "2026-01-01", proximo: "2026-12-01", status: "ativo" },
      ],
      "2026-11-18",
    );
    expect(r.map((x) => x.id)).toEqual(["2", "1"]);
    expect(tipoValido("vacina")).toBe(true);
    expect(tipoValido("cirurgia")).toBe(false);
  });
});
