import { describe, expect, it } from "vitest";
import {
  amostraDaCor,
  dominioDoLink,
  mover,
  normalizarEtiquetas,
  normalizarLink,
  precoDeTexto,
  precoParaCampo,
} from "@/components/desejos/regras";
import {
  alertasDaParticipacao,
  classificarParticipacoes,
  codigoDoConvite,
  papelNoGrupo,
  primeiroNome,
  proximoMarco,
  saudacao,
  situacaoDoEvento,
  type Participacao,
} from "@/components/painel/dados";
import { linkSeguro, tipoDaNotificacao, TIPOS_NOTIFICACAO } from "@/components/notificacoes/tipos";
import { cronAutorizado } from "@/app/api/cron/autorizar";

const AGORA = Date.parse("2026-12-01T12:00:00Z");
const dias = (n: number) => new Date(AGORA + n * 86400e3).toISOString();

function participacao(evento: Partial<Participacao["evento"]> = {}, p: Partial<Participacao> = {}): Participacao {
  const id = p.id ?? `p-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    event_id: evento.id ?? `e-${id}`,
    user_id: "eu",
    role: "member",
    status: "approved",
    rsvp: null,
    gift_bought: false,
    gift_bought_at: null,
    allow_public_reveal: false,
    result_viewed_at: null,
    muted_until: null,
    join_message: null,
    created_at: dias(-10),
    approved_at: dias(-10),
    ...p,
    evento: {
      id: evento.id ?? `e-${id}`,
      owner_id: "outro",
      name: "Grupo",
      description: null,
      cover_path: null,
      theme: "natal",
      reveal_at: null,
      location: null,
      gift_min: null,
      gift_max: null,
      max_participants: null,
      rules: null,
      join_deadline: null,
      draw_at: null,
      draw_mode: "manual",
      visibility: "private",
      requires_approval: false,
      invite_code: "ABCDEFGH",
      status: "open",
      draw_version: 0,
      drawn_at: null,
      finished_at: null,
      archived_at: null,
      created_at: dias(-20),
      updated_at: dias(-20),
      ...evento,
    },
  } as Participacao;
}

describe("lista de desejos: links", () => {
  it("aceita só https e completa o protocolo", () => {
    expect(normalizarLink("https://loja.com.br/p?id=1")).toBe("https://loja.com.br/p?id=1");
    expect(normalizarLink("loja.com.br/produto")).toBe("https://loja.com.br/produto");
    expect(normalizarLink("  ")).toBeNull();
    expect(normalizarLink("http://loja.com.br")).toBeNull();
    expect(normalizarLink("javascript:alert(1)")).toBeNull();
    expect(normalizarLink("https://usuario:senha@loja.com.br")).toBeNull();
    expect(normalizarLink("https://localhost")).toBeNull();
    expect(normalizarLink(`https://a.com/${"x".repeat(1100)}`)).toBeNull();
  });
  it("mostra o domínio sem www", () => {
    expect(dominioDoLink("https://www.amazon.com.br/dp/1")).toBe("amazon.com.br");
    expect(dominioDoLink("nada")).toBeNull();
  });
});

describe("lista de desejos: preço", () => {
  it("entende o jeito brasileiro e outros", () => {
    expect(precoDeTexto("89,90")).toBe(89.9);
    expect(precoDeTexto("R$ 1.234,56")).toBe(1234.56);
    expect(precoDeTexto("1.234")).toBe(1234);
    expect(precoDeTexto("80.90")).toBe(80.9);
    expect(precoDeTexto("1,234.50")).toBe(1234.5);
    expect(precoDeTexto("99")).toBe(99);
    expect(precoDeTexto("")).toBeNull();
    expect(precoDeTexto("abc")).toBeNaN();
    expect(precoDeTexto("-5")).toBeNaN();
  });
  it("volta para o campo no formato brasileiro", () => {
    expect(precoParaCampo(1234.5)).toBe("1.234,50");
    expect(precoParaCampo(80)).toBe("80");
    expect(precoParaCampo(null)).toBe("");
  });
});

describe("etiquetas e cores", () => {
  it("apara, tira repetidas (sem acento/maiúscula) e respeita o limite", () => {
    expect(normalizarEtiquetas(["  Café ", "cafe", "Leitura", "", "  leitura"])).toEqual(["Café", "Leitura"]);
    expect(normalizarEtiquetas(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(normalizarEtiquetas(["x".repeat(80)], 20, 40)[0]).toHaveLength(40);
  });
  it("acha a amostra da cor pelo nome ou pelo hex", () => {
    expect(amostraDaCor("Verde")).toBe("#1f9d55");
    expect(amostraDaCor("verde-água")).toBe("#1f9d55");
    expect(amostraDaCor("lilas")).toBe("#b79ce8");
    expect(amostraDaCor("#ABC")).toBe("#abc");
    expect(amostraDaCor("terracota")).toBeNull();
  });
  it("move itens para reordenar sem mexer no original", () => {
    const l = ["a", "b", "c", "d"];
    expect(mover(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(mover(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(mover(l, 1, 99)).toEqual(["a", "c", "d", "b"]);
    expect(l).toEqual(["a", "b", "c", "d"]);
  });
});

describe("painel: classificação dos grupos", () => {
  it("separa ativos, próximos, concluídos e pedidos pendentes; recusados somem", () => {
    const aberto = participacao({ name: "Aberto", reveal_at: dias(5) });
    const sorteado = participacao({ name: "Sorteado", status: "drawn", reveal_at: dias(2) });
    const semData = participacao({ name: "Sem data", status: "drawn" });
    const encerrado = participacao({ name: "Encerrado", status: "finished", finished_at: dias(-1) });
    const arquivado = participacao({ name: "Arquivado", archived_at: dias(-3) });
    const pedido = participacao({ name: "Pedido" }, { status: "pending" });
    const recusado = participacao({ name: "Recusado" }, { status: "rejected" });
    const r = classificarParticipacoes([aberto, sorteado, semData, encerrado, arquivado, pedido, recusado], AGORA);
    expect(r.ativos.map((p) => p.evento.name)).toEqual(["Sorteado", "Aberto", "Sem data"]);
    expect(r.proximos.map((p) => p.evento.name)).toEqual(["Sorteado", "Aberto"]);
    expect(r.concluidos.map((p) => p.evento.name)).toEqual(["Encerrado", "Arquivado"]);
    expect(r.pendentes.map((p) => p.evento.name)).toEqual(["Pedido"]);
  });

  it("o próximo marco é o sorteio agendado e, depois, a revelação", () => {
    const agendado = participacao({ draw_mode: "scheduled", draw_at: dias(1), reveal_at: dias(10) });
    expect(proximoMarco(agendado.evento, AGORA)).toEqual({ alvo: dias(1), rotulo: "Sorteio em" });
    const sorteado = participacao({ status: "drawn", draw_mode: "scheduled", draw_at: dias(-1), reveal_at: dias(10) });
    expect(proximoMarco(sorteado.evento, AGORA)).toEqual({ alvo: dias(10), rotulo: "Revelação em" });
    expect(proximoMarco(participacao({ reveal_at: dias(-1) }).evento, AGORA)).toBeNull();
    expect(situacaoDoEvento({ status: "drawn", archived_at: dias(-1) })).toBe("arquivado");
  });

  it("alertas: resultado não visto, presente e presença — nada depois de encerrar", () => {
    const p = participacao({ status: "drawn", reveal_at: dias(2) });
    const tipos = alertasDaParticipacao(p, AGORA).map((a) => a.tipo);
    expect(tipos).toEqual(["ver", "comprar", "presenca"]);
    expect(alertasDaParticipacao(p, AGORA).find((a) => a.tipo === "comprar")?.urgente).toBe(true);
    const tudoFeito = participacao({ status: "drawn", reveal_at: dias(2) }, { result_viewed_at: dias(-1), gift_bought: true, rsvp: "yes" });
    expect(alertasDaParticipacao(tudoFeito, AGORA)).toEqual([]);
    const encerrado = participacao({ status: "finished" });
    expect(alertasDaParticipacao(encerrado, AGORA)).toEqual([]);
    const pendente = participacao({ status: "drawn" }, { status: "pending" });
    expect(alertasDaParticipacao(pendente, AGORA)).toEqual([]);
  });

  it("os links dos alertas nunca carregam nada do sorteio", () => {
    const p = participacao({ id: "ev1", status: "drawn", reveal_at: dias(2) });
    for (const a of alertasDaParticipacao(p, AGORA)) expect(a.href).toMatch(/^\/grupo\/ev1(\/revelacao)?$/);
  });

  it("papel no grupo", () => {
    const e = participacao().evento;
    expect(papelNoGrupo({ role: "admin", status: "approved" }, { owner_id: "eu" }, "eu")).toBe("Você criou");
    expect(papelNoGrupo({ role: "admin", status: "approved" }, e, "eu")).toBe("Organizador");
    expect(papelNoGrupo({ role: "member", status: "approved" }, e, "eu")).toBe("Participante");
    expect(papelNoGrupo({ role: "member", status: "pending" }, e, "eu")).toBe("Aguardando aprovação");
  });

  it("saudação pela hora de São Paulo e o primeiro nome", () => {
    expect(saudacao(new Date("2026-12-01T12:00:00Z"))).toBe("Bom dia"); // 9h em SP
    expect(saudacao(new Date("2026-12-01T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(saudacao(new Date("2026-12-01T02:00:00Z"))).toBe("Boa noite"); // 23h
    expect(primeiroNome("Ana Clara Souza")).toBe("Ana");
    expect(primeiroNome("Ana Clara", "Aninha")).toBe("Aninha");
    expect(primeiroNome("")).toBe("você");
  });

  it("código do convite: letras soltas ou o link inteiro", () => {
    expect(codigoDoConvite("rw7v 3x2h")).toBe("RW7V3X2H");
    expect(codigoDoConvite("https://amigo.app/convite/RW7V3X2H?x=1")).toBe("RW7V3X2H");
    expect(codigoDoConvite("RW7V-3X2H")).toBe("RW7V3X2H");
    expect(codigoDoConvite("curto")).toBeNull();
    expect(codigoDoConvite("../../admin")).toBeNull();
  });
});

describe("notificações", () => {
  it("todos os tipos do banco têm ícone e nome; desconhecido cai no padrão", () => {
    const tipos = ["draw", "redraw", "secret_message", "announcement", "reminder", "event_soon", "live_start", "rules_changed",
      "new_participant", "join_request", "approved", "rejected", "removed", "role", "invite", "card", "bingo", "finished", "report", "test"];
    for (const t of tipos) expect(TIPOS_NOTIFICACAO[t], t).toBeDefined();
    expect(tipoDaNotificacao("xyz").rotulo).toBe("Notificação");
  });
  it("só navega para links internos", () => {
    expect(linkSeguro("/grupo/1")).toBe("/grupo/1");
    expect(linkSeguro("//evil.com")).toBeNull();
    expect(linkSeguro("/\\evil.com")).toBeNull();
    expect(linkSeguro("https://evil.com")).toBeNull();
    expect(linkSeguro(null)).toBeNull();
  });
});

describe("cron: autorização", () => {
  const segredo = "segredo-local-do-cron";
  it("aceita só o Bearer certo", () => {
    expect(cronAutorizado(`Bearer ${segredo}`, segredo)).toBe(true);
    expect(cronAutorizado(`bearer   ${segredo}`, segredo)).toBe(true);
    expect(cronAutorizado(`Bearer ${segredo}x`, segredo)).toBe(false);
    expect(cronAutorizado(segredo, segredo)).toBe(false);
    expect(cronAutorizado(null, segredo)).toBe(false);
    expect(cronAutorizado("Bearer ", segredo)).toBe(false);
  });
  it("sem segredo (ou curto demais) ninguém passa", () => {
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado("Bearer abc", "abc")).toBe(false);
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
  });
});
