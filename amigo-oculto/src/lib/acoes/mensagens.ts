"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor, type ClienteSupabase } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarEmSegundoPlano } from "@/lib/servidor/entrega";
import { falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import type { Conversas, LadoConversa, MensagemAnonima, TipoMensagemAnonima } from "@/components/mensagens/tipos";

/**
 * Mensagens anônimas entre quem tirou e quem foi tirado. Tudo passa pelas funções do banco (a tabela não tem
 * permissão direta) e o que vai para o navegador é um SUBCONJUNTO do que `secret_threads` devolve — nunca nada a mais.
 */

const id = z.uuid("Identificador inválido.");
const TIPOS = ["message", "question", "clue", "gift_info"] as const;

type Bruta = { id: string; mine: boolean; kind: string; body: string | null; hidden: boolean; created_at: string; read_at: string | null };
type Threads = {
  available: boolean;
  with_receiver?: { receiver_name: string; blocked: boolean; messages: Bruta[] };
  with_santa?: { blocked: boolean; messages: Bruta[] } | null;
};

function limpar(m: Bruta): MensagemAnonima {
  return {
    id: m.id,
    minha: !!m.mine,
    tipo: (TIPOS as readonly string[]).includes(m.kind) ? (m.kind as TipoMensagemAnonima) : "message",
    texto: m.hidden ? null : m.body,
    oculta: !!m.hidden,
    criadaEm: m.created_at,
    lidaEm: m.read_at,
  };
}

/** Lê as conversas pela função do banco e devolve só o que a tela usa (interno: não é ação). */
async function lerConversas(supabase: ClienteSupabase, eventoId: string): Promise<Conversas> {
  const { data, error } = await supabase.rpc("secret_threads", { p_event: eventoId });
  if (error) throw error;
  const t = (data ?? { available: false }) as Threads;
  if (!t.available || !t.with_receiver) return { disponivel: false };
  return {
    disponivel: true,
    paraQuemTirei: {
      nome: t.with_receiver.receiver_name,
      bloqueada: !!t.with_receiver.blocked,
      mensagens: (t.with_receiver.messages ?? []).map(limpar),
    },
    deQuemMeTirou: t.with_santa
      ? { bloqueada: !!t.with_santa.blocked, mensagens: (t.with_santa.messages ?? []).map(limpar) }
      : null,
  };
}

async function sessao() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  return { usuario, supabase: await clienteServidor() };
}

export async function carregarConversas(eventoId: string): Promise<Resultado<Conversas>> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para continuar." };
  try {
    return sucesso(undefined, await lerConversas(s.supabase, eventoId));
  } catch (e) {
    return falha(e, "Não foi possível carregar as conversas.");
  }
}

const esquemaEnvio = z.object({
  eventoId: id,
  para: z.enum(["receiver", "santa"]),
  tipo: z.enum(TIPOS),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(1000, "Use até 1.000 caracteres."),
});

export async function enviarMensagemAnonima(
  eventoId: string,
  para: LadoConversa,
  tipo: TipoMensagemAnonima,
  texto: string,
): Promise<Resultado<Conversas>> {
  const v = esquemaEnvio.safeParse({ eventoId, para, tipo, texto });
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? "Mensagem inválida." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para continuar." };
  // quem foi tirado só responde (o tipo do lado dele é sempre "mensagem")
  const tipoFinal = v.data.para === "santa" ? "message" : v.data.tipo;
  const { error } = await s.supabase.rpc("send_secret_message", {
    p_event: eventoId,
    p_to: v.data.para,
    p_kind: tipoFinal,
    p_body: v.data.texto,
  });
  if (error) return falha(error, "Não foi possível enviar a mensagem.");
  entregarEmSegundoPlano();
  try {
    return sucesso("Mensagem enviada em segredo.", await lerConversas(s.supabase, eventoId));
  } catch {
    return sucesso("Mensagem enviada em segredo.");
  }
}

/**
 * Marca como lidas as mensagens recebidas numa conversa e as notificações correspondentes deste grupo.
 * (As notificações de "quem você tirou respondeu" são do lado `receiver`; as outras de mensagem anônima, do `santa`.)
 */
export async function marcarConversaLida(eventoId: string, lado: LadoConversa): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || (lado !== "receiver" && lado !== "santa")) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para continuar." };
  const { error } = await s.supabase.rpc("mark_secret_read", { p_event: eventoId, p_side: lado });
  if (error) return falha(error);
  let q = s.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", s.usuario.id)
    .eq("event_id", eventoId)
    .eq("kind", "secret_message")
    .is("read_at", null);
  q = lado === "receiver" ? q.eq("title", "Quem você tirou respondeu") : q.neq("title", "Quem você tirou respondeu");
  await q;
  return sucesso();
}

export async function denunciarMensagemAnonima(eventoId: string, mensagemId: string, motivo?: string): Promise<Resultado<Conversas>> {
  if (!id.safeParse(eventoId).success || !id.safeParse(mensagemId).success) return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para continuar." };
  const { error } = await s.supabase.rpc("report_secret_message", {
    p_message: mensagemId,
    p_reason: (motivo ?? "").trim().slice(0, 300) || undefined,
  });
  if (error) return falha(error, "Não foi possível enviar a denúncia.");
  entregarEmSegundoPlano();
  try {
    return sucesso("Mensagem denunciada e escondida. O organizador vai ver só o texto, nunca quem mandou.", await lerConversas(s.supabase, eventoId));
  } catch {
    return sucesso("Mensagem denunciada e escondida.");
  }
}

export async function bloquearAmigoOculto(eventoId: string, bloquear: boolean): Promise<Resultado<Conversas>> {
  if (!id.safeParse(eventoId).success || typeof bloquear !== "boolean") return { ok: false, erro: "Pedido inválido." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para continuar." };
  const { error } = await s.supabase.rpc("block_secret_santa", { p_event: eventoId, p_block: bloquear });
  if (error) return falha(error, "Não foi possível mudar o bloqueio.");
  revalidatePath("/mensagens");
  try {
    return sucesso(
      bloquear ? "Pronto: seu amigo oculto não consegue mais te mandar mensagens." : "Mensagens desbloqueadas.",
      await lerConversas(s.supabase, eventoId),
    );
  } catch {
    return sucesso(bloquear ? "Mensagens bloqueadas." : "Mensagens desbloqueadas.");
  }
}
