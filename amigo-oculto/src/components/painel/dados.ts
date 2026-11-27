/**
 * Regras puras do painel pessoal: separar os grupos em ativos, próximos e concluídos, os alertas de cada um e a
 * saudação. Sem DOM e sem banco (testadas em Node).
 */
import type { Database } from "@/lib/database.types";

export type LinhaEvento = Database["public"]["Tables"]["events"]["Row"];
export type LinhaParticipante = Database["public"]["Tables"]["participants"]["Row"];
export type Participacao = LinhaParticipante & { evento: LinhaEvento };

export type Situacao = "aberto" | "sorteado" | "encerrado" | "arquivado";

export function situacaoDoEvento(e: Pick<LinhaEvento, "status" | "archived_at">): Situacao {
  if (e.archived_at) return "arquivado";
  if (e.status === "finished") return "encerrado";
  if (e.status === "drawn") return "sorteado";
  return "aberto";
}

export const ROTULO_SITUACAO: Record<Situacao, { texto: string; cor: "ouro" | "esmeralda" | "neutro" }> = {
  aberto: { texto: "Aguardando o sorteio", cor: "ouro" },
  sorteado: { texto: "Sorteio realizado", cor: "esmeralda" },
  encerrado: { texto: "Encerrado", cor: "neutro" },
  arquivado: { texto: "Arquivado", cor: "neutro" },
};

export function papelNoGrupo(p: Pick<LinhaParticipante, "role" | "status">, evento: Pick<LinhaEvento, "owner_id">, usuarioId: string) {
  if (p.status === "pending") return "Aguardando aprovação";
  if (evento.owner_id === usuarioId) return "Você criou";
  if (p.role === "admin") return "Organizador";
  return "Participante";
}

function tempo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** O próximo marco do grupo: o sorteio agendado (se ainda aberto) ou o encontro/revelação. */
export function proximoMarco(e: LinhaEvento, agora = Date.now()): { alvo: string; rotulo: string } | null {
  const sit = situacaoDoEvento(e);
  if (sit === "encerrado" || sit === "arquivado") return null;
  const sorteio = tempo(e.draw_at);
  if (sit === "aberto" && e.draw_mode === "scheduled" && e.draw_at && sorteio !== null && sorteio > agora) {
    return { alvo: e.draw_at, rotulo: "Sorteio em" };
  }
  const encontro = tempo(e.reveal_at);
  if (e.reveal_at && encontro !== null && encontro > agora) return { alvo: e.reveal_at, rotulo: "Revelação em" };
  return null;
}

export type Alerta = { tipo: "ver" | "comprar" | "presenca" | "sorteio"; texto: string; href: string; urgente?: boolean };

/** O que a pessoa ainda precisa fazer neste grupo (nada que revele o sorteio). */
export function alertasDaParticipacao(p: Participacao, agora = Date.now()): Alerta[] {
  const e = p.evento;
  if (p.status !== "approved" || situacaoDoEvento(e) === "arquivado" || situacaoDoEvento(e) === "encerrado") return [];
  const saida: Alerta[] = [];
  const encontro = tempo(e.reveal_at);
  const emBreve = encontro !== null && encontro > agora && encontro - agora < 3 * 86400e3;
  if (e.status === "drawn") {
    if (!p.result_viewed_at) saida.push({ tipo: "ver", texto: "Você ainda não viu quem tirou", href: `/grupo/${e.id}/revelacao`, urgente: true });
    if (!p.gift_bought) saida.push({ tipo: "comprar", texto: "Falta comprar o presente", href: `/grupo/${e.id}`, urgente: emBreve });
  }
  if (!p.rsvp && encontro !== null && encontro > agora) {
    saida.push({ tipo: "presenca", texto: "Confirme sua presença", href: `/grupo/${e.id}` });
  }
  const sorteio = tempo(e.draw_at);
  if (e.status === "open" && e.draw_mode === "scheduled" && sorteio !== null && sorteio > agora && sorteio - agora < 2 * 86400e3) {
    saida.push({ tipo: "sorteio", texto: "O sorteio é em menos de 2 dias", href: `/grupo/${e.id}` });
  }
  return saida;
}

export type PainelClassificado = {
  ativos: Participacao[];
  proximos: Participacao[];
  concluidos: Participacao[];
  pendentes: Participacao[];
};

/**
 * Separa as participações: pedidos ainda pendentes, grupos ativos (aberto/sorteado), os próximos (com data futura,
 * do mais perto para o mais longe) e os concluídos/arquivados (do mais recente para o mais antigo). Recusados somem.
 */
export function classificarParticipacoes(lista: readonly Participacao[], agora = Date.now()): PainelClassificado {
  const ativos: Participacao[] = [];
  const concluidos: Participacao[] = [];
  const pendentes: Participacao[] = [];
  for (const p of lista) {
    if (!p.evento) continue;
    if (p.status === "rejected") continue;
    if (p.status === "pending") {
      if (situacaoDoEvento(p.evento) === "aberto") pendentes.push(p);
      continue;
    }
    const sit = situacaoDoEvento(p.evento);
    if (sit === "aberto" || sit === "sorteado") ativos.push(p);
    else concluidos.push(p);
  }
  const quando = (p: Participacao) => {
    const m = proximoMarco(p.evento, agora);
    return m ? new Date(m.alvo).getTime() : Number.POSITIVE_INFINITY;
  };
  ativos.sort((a, b) => quando(a) - quando(b) || b.evento.created_at.localeCompare(a.evento.created_at));
  const proximos = ativos.filter((p) => proximoMarco(p.evento, agora) !== null);
  const fim = (p: Participacao) => p.evento.archived_at ?? p.evento.finished_at ?? p.evento.reveal_at ?? p.evento.created_at;
  concluidos.sort((a, b) => fim(b).localeCompare(fim(a)));
  pendentes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { ativos, proximos, concluidos, pendentes };
}

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora de São Paulo. */
export function saudacao(agora = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(agora));
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Primeiro nome para a saudação (o apelido, se houver). */
export function primeiroNome(nome: string | null | undefined, apelido?: string | null): string {
  const a = (apelido ?? "").trim();
  if (a) return a;
  return (nome ?? "").trim().split(/\s+/)[0] || "você";
}

/** Código de convite digitado ("rw7v 3x2h", ou o link inteiro) → as 8 letras, ou null. */
export function codigoDoConvite(bruto: string): string | null {
  const t = bruto.trim();
  const doLink = /\/convite\/([A-Za-z0-9]{8})(?:[/?#]|$)/.exec(t);
  const limpo = (doLink ? doLink[1] : t).replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(limpo) ? limpo : null;
}
