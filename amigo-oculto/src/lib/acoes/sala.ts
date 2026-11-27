"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { dataHora } from "@/lib/formatos";
import { PAGINA_CHAT, type MensagemChat } from "@/components/chat/tipos";

/**
 * Ações da sala do grupo: presença, "já comprei", mural de bilhetes, chat coletivo e moderação.
 * Tudo com o cliente da sessão (RLS vale); as regras de quem pode o quê estão no banco.
 */

const id = z.uuid("Identificador inválido.");

async function sessao() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  return { usuario, supabase: await clienteServidor() };
}

const naoLogado: Resultado<never> = { ok: false, erro: "Entre na sua conta para continuar." };

/** Mensagem clara para quem foi silenciado ou está num grupo arquivado (o RLS só responde "violação de política"). */
async function motivoSemPermissao(eventoId: string): Promise<string | null> {
  const s = await sessao();
  if (!s) return "Entre na sua conta para continuar.";
  const [{ data: eu }, { data: ev }] = await Promise.all([
    s.supabase.from("participants").select("status, muted_until").eq("event_id", eventoId).eq("user_id", s.usuario.id).maybeSingle(),
    s.supabase.from("events").select("archived_at").eq("id", eventoId).maybeSingle(),
  ]);
  if (!eu || eu.status !== "approved") return "Você não participa deste grupo.";
  if (ev?.archived_at) return "Este grupo está arquivado: o mural e o chat ficam só para leitura.";
  if (eu.muted_until && new Date(eu.muted_until) > new Date()) {
    return `O organizador silenciou você até ${dataHora(eu.muted_until)}. Você ainda pode ler tudo.`;
  }
  return null;
}

function rlsNegou(erro: { code?: string; message?: string } | null) {
  return !!erro && (erro.code === "42501" || /row-level security/i.test(erro.message ?? ""));
}

// ---------------------------------------------------------------------------------------------------------------------
// Presença e presente
// ---------------------------------------------------------------------------------------------------------------------
const esquemaPresenca = z.object({ eventoId: id, resposta: z.enum(["yes", "maybe", "no"]).nullable() });

export async function responderPresenca(eventoId: string, resposta: "yes" | "maybe" | "no" | null): Promise<Resultado> {
  const v = esquemaPresenca.safeParse({ eventoId, resposta });
  if (!v.success) return { ok: false, erro: "Resposta inválida." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { data: ev } = await s.supabase.from("events").select("status, archived_at").eq("id", eventoId).maybeSingle();
  if (!ev) return falha("event_not_found");
  if (ev.status === "finished") return falha("event_finished");
  if (ev.archived_at) return falha("event_archived");
  const { data, error } = await s.supabase
    .from("participants")
    .update({ rsvp: resposta })
    .eq("event_id", eventoId)
    .eq("user_id", s.usuario.id)
    .select("id")
    .maybeSingle();
  if (error) return falha(error);
  if (!data) return falha("forbidden");
  revalidatePath(`/grupo/${eventoId}`, "layout");
  const textos = { yes: "Presença confirmada! Até lá.", maybe: "Anotado: talvez você vá.", no: "Tudo bem, anotamos que você não vai." };
  return sucesso(resposta ? textos[resposta] : "Resposta removida.");
}

export async function marcarPresenteComprado(eventoId: string, comprado: boolean): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || typeof comprado !== "boolean") return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { data: ev } = await s.supabase.from("events").select("status").eq("id", eventoId).maybeSingle();
  if (!ev) return falha("event_not_found");
  if (ev.status === "open") return falha("not_drawn");
  const { data, error } = await s.supabase
    .from("participants")
    .update({ gift_bought: comprado })
    .eq("event_id", eventoId)
    .eq("user_id", s.usuario.id)
    .select("id")
    .maybeSingle();
  if (error) return falha(error);
  if (!data) return falha("forbidden");
  revalidatePath(`/grupo/${eventoId}`, "layout");
  return sucesso(comprado ? "Presente comprado! Agora é só embrulhar." : "Tudo bem, desmarcamos.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Mural de bilhetes
// ---------------------------------------------------------------------------------------------------------------------
export type CorBilhete = "ouro" | "vermelho" | "verde" | "neve" | "rosa" | "azul";
const esquemaBilhete = z.object({
  eventoId: id,
  texto: z.string().trim().min(1, "Escreva o seu bilhete.").max(500, "Use até 500 caracteres."),
  cor: z.enum(["ouro", "vermelho", "verde", "neve", "rosa", "azul"]),
});

export async function publicarBilhete(eventoId: string, texto: string, cor: CorBilhete): Promise<Resultado> {
  const v = esquemaBilhete.safeParse({ eventoId, texto, cor });
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? "Confira o bilhete.", campos: { texto: v.error.issues[0]?.message ?? "" } };
  const s = await sessao();
  if (!s) return naoLogado;
  const { error } = await s.supabase.from("wall_posts").insert({ event_id: eventoId, body: v.data.texto, color: v.data.cor });
  if (error) {
    if (rlsNegou(error)) return { ok: false, erro: (await motivoSemPermissao(eventoId)) ?? "Você não pode publicar neste mural agora." };
    return falha(error, "Não foi possível publicar o bilhete.");
  }
  revalidatePath(`/grupo/${eventoId}/mural`);
  return sucesso("Bilhete colado no mural!");
}

export async function excluirBilhete(eventoId: string, bilheteId: string): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || !id.safeParse(bilheteId).success) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { data, error } = await s.supabase.from("wall_posts").delete().eq("id", bilheteId).eq("event_id", eventoId).select("id");
  if (error) return falha(error);
  if (!data?.length) return falha("forbidden");
  revalidatePath(`/grupo/${eventoId}/mural`);
  return sucesso("Bilhete removido.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Denúncias (chat e mural) e moderação
// ---------------------------------------------------------------------------------------------------------------------
export async function denunciarConteudo(tipo: "chat" | "wall", alvoId: string, motivo?: string): Promise<Resultado> {
  if ((tipo !== "chat" && tipo !== "wall") || !id.safeParse(alvoId).success) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { error } = await s.supabase.rpc("report_content", {
    p_kind: tipo,
    p_target: alvoId,
    p_reason: (motivo ?? "").trim().slice(0, 300) || undefined,
  });
  if (error) return falha(error, "Não foi possível enviar a denúncia.");
  return sucesso("Denúncia enviada ao organizador. Obrigado por avisar.");
}

export async function silenciarParticipante(eventoId: string, participanteId: string, minutos: number): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || !id.safeParse(participanteId).success) return { ok: false, erro: "Pedido inválido." };
  const m = Math.max(0, Math.min(60 * 24 * 30, Math.round(Number(minutos) || 0)));
  const s = await sessao();
  if (!s) return naoLogado;
  const { error } = await s.supabase.rpc("mute_participant", { p_participant: participanteId, p_minutes: m });
  if (error) return falha(error, "Não foi possível silenciar.");
  revalidatePath(`/grupo/${eventoId}`, "layout");
  return sucesso(m ? "Participante silenciado no chat e no mural." : "Silêncio retirado.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Chat coletivo
// ---------------------------------------------------------------------------------------------------------------------
const esquemaMensagem = z.object({
  eventoId: id,
  texto: z.string().trim().min(1, "Escreva uma mensagem.").max(1000, "Use até 1.000 caracteres."),
});

export async function enviarMensagemChat(eventoId: string, texto: string): Promise<Resultado<MensagemChat>> {
  const v = esquemaMensagem.safeParse({ eventoId, texto });
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? "Mensagem inválida." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { data, error } = await s.supabase
    .from("chat_messages")
    .insert({ event_id: eventoId, body: v.data.texto })
    .select("id, user_id, body, created_at, deleted_at, deleted_by")
    .single();
  if (error) {
    if (rlsNegou(error)) return { ok: false, erro: (await motivoSemPermissao(eventoId)) ?? "Você não pode enviar mensagens neste chat." };
    return falha(error, "Não foi possível enviar a mensagem.");
  }
  return sucesso(undefined, data);
}

export async function apagarMensagemChat(mensagemId: string): Promise<Resultado> {
  if (!id.safeParse(mensagemId).success) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { error } = await s.supabase.rpc("delete_chat_message", { p_message: mensagemId });
  if (error) return falha(error, "Não foi possível apagar a mensagem.");
  return sucesso("Mensagem apagada.");
}

/** Página de mensagens mais antigas que `antesDe` (em ordem cronológica). */
export async function mensagensAnteriores(
  eventoId: string,
  antesDe: string,
): Promise<Resultado<{ mensagens: MensagemChat[]; temMais: boolean }>> {
  if (!id.safeParse(eventoId).success || Number.isNaN(Date.parse(antesDe))) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return naoLogado;
  const { data, error } = await s.supabase
    .from("chat_messages")
    .select("id, user_id, body, created_at, deleted_at, deleted_by")
    .eq("event_id", eventoId)
    .lt("created_at", antesDe)
    .order("created_at", { ascending: false })
    .limit(PAGINA_CHAT + 1);
  if (error) return falha(error, "Não foi possível carregar as mensagens.");
  const temMais = data.length > PAGINA_CHAT;
  return sucesso(undefined, { mensagens: data.slice(0, PAGINA_CHAT).reverse(), temMais });
}

/** Perfil de quem apareceu no chat depois que a página abriu (o RLS só mostra quem divide o grupo). */
export async function perfilDoMembro(eventoId: string, usuarioId: string) {
  if (!id.safeParse(eventoId).success || !id.safeParse(usuarioId).success) return null;
  const s = await sessao();
  if (!s) return null;
  const { data } = await s.supabase
    .from("participants")
    .select("id, role, profiles(display_name, nickname, avatar_path)")
    .eq("event_id", eventoId)
    .eq("user_id", usuarioId)
    .maybeSingle();
  if (!data?.profiles) return null;
  const p = data.profiles as unknown as { display_name: string; nickname: string | null; avatar_path: string | null };
  return { nome: p.display_name, apelido: p.nickname, avatar: p.avatar_path, participanteId: data.id, admin: data.role === "admin" };
}
