"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarEmSegundoPlano } from "@/lib/servidor/entrega";
import { ErroServicoSorteio, executarSorteio } from "@/lib/sorteio/servico";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";

/**
 * Sorteio pelo painel do organizador. Quem pede é conferido AQUI (organizador aprovado do grupo) antes de chamar o
 * serviço, que roda com a chave do servidor; o banco confere de novo (commit_draw: p_actor precisa ser organizador).
 * O resultado nunca volta para a tela: só a versão e quantas pessoas entraram.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function organizador(eventoId: string) {
  if (!UUID.test(eventoId)) return { ok: false, erro: falha("event_not_found") } as const;
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: falha("not_authenticated") } as const;
  const supabase = await clienteServidor();
  const [{ data: eu }, { data: evento }] = await Promise.all([
    supabase.from("participants").select("role, status").eq("event_id", eventoId).eq("user_id", usuario.id).maybeSingle(),
    supabase.from("events").select("id, status, archived_at, draw_mode, draw_at, join_deadline, reveal_at").eq("id", eventoId).maybeSingle(),
  ]);
  if (!evento) return { ok: false, erro: falha("event_not_found") } as const;
  if (!eu || eu.status !== "approved" || eu.role !== "admin") return { ok: false, erro: falha("forbidden") } as const;
  return { ok: true, supabase, usuario, evento } as const;
}

function erroDoServico(e: unknown): Resultado<never> {
  if (e instanceof ErroServicoSorteio) return falha(e.codigo, "Não foi possível realizar o sorteio agora.");
  return falha(e, "Não foi possível realizar o sorteio agora. Tente de novo.");
}

export async function realizarSorteio(eventoId: string): Promise<Resultado<{ participantes: number }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (o.evento.archived_at) return falha("event_archived");
  if (o.evento.status !== "open") return falha("already_drawn");
  try {
    const r = await executarSorteio({ eventoId, autorId: o.usuario.id });
    revalidatePath(`/grupo/${eventoId}`, "layout");
    revalidatePath("/painel");
    entregarEmSegundoPlano();
    return sucesso(`Sorteio realizado com ${r.participantes} pessoas! Todos foram avisados para abrir o presente.`, {
      participantes: r.participantes,
    });
  } catch (e) {
    return erroDoServico(e);
  }
}

const esquemaRefazer = z.object({
  confirmacao: z.string().refine((v) => v.trim().toUpperCase() === "REFAZER", "Digite REFAZER para confirmar."),
  motivo: z.string().trim().min(5, "Conte o motivo em poucas palavras (pelo menos 5 letras).").max(300, "Use até 300 caracteres."),
});

export async function refazerSorteio(eventoId: string, entrada: unknown): Promise<Resultado<{ participantes: number }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const v = validar(esquemaRefazer, entrada);
  if (!v.ok) return v.resultado;
  if (o.evento.status === "finished") return falha("event_finished");
  if (o.evento.status !== "drawn") return falha("not_drawn");
  const { data: aoVivo } = await o.supabase.from("live_sessions").select("event_id").eq("event_id", eventoId).maybeSingle();
  if (aoVivo) return falha("live_already_started");
  try {
    const r = await executarSorteio({ eventoId, autorId: o.usuario.id, refazer: true, motivo: v.dados.motivo });
    revalidatePath(`/grupo/${eventoId}`, "layout");
    revalidatePath("/painel");
    entregarEmSegundoPlano();
    return sucesso("Sorteio refeito. O resultado anterior foi invalidado e todos foram avisados.", { participantes: r.participantes });
  } catch (e) {
    return erroDoServico(e);
  }
}

/** Agenda (data ISO no futuro) ou desagenda (null) o sorteio automático. */
export async function agendarSorteio(eventoId: string, quando: string | null): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (o.evento.status !== "open") return falha("locked_after_draw");
  if (o.evento.archived_at) return falha("event_archived");
  if (quando === null) {
    const { error } = await o.supabase.from("events").update({ draw_mode: "manual", draw_at: null }).eq("id", eventoId);
    if (error) return falha(error);
    revalidatePath(`/grupo/${eventoId}`, "layout");
    return sucesso("Agendamento cancelado. O sorteio volta a ser feito por você, quando quiser.");
  }
  const t = typeof quando === "string" ? Date.parse(quando) : Number.NaN;
  if (Number.isNaN(t)) return { ok: false, erro: "Escolha a data e o horário do sorteio.", campos: { quando: "Data inválida." } };
  if (t < Date.now() + 60_000) return { ok: false, erro: "Escolha um horário no futuro.", campos: { quando: "Escolha um horário no futuro." } };
  if (o.evento.join_deadline && Date.parse(o.evento.join_deadline) > t) {
    return { ok: false, erro: "O sorteio precisa ser depois do prazo de entrada.", campos: { quando: "Depois do prazo de entrada." } };
  }
  if (o.evento.reveal_at && Date.parse(o.evento.reveal_at) < t) {
    return { ok: false, erro: "O sorteio precisa acontecer antes da revelação.", campos: { quando: "Antes da revelação." } };
  }
  const { error } = await o.supabase
    .from("events")
    .update({ draw_mode: "scheduled", draw_at: new Date(t).toISOString() })
    .eq("id", eventoId);
  if (error) return falha(error);
  revalidatePath(`/grupo/${eventoId}`, "layout");
  entregarEmSegundoPlano(); // a data do sorteio avisa o grupo (trigger)
  return sucesso("Sorteio agendado. Ele acontece sozinho na hora marcada e todos serão avisados.");
}
