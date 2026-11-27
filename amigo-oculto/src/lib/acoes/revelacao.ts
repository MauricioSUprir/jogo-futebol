"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, type Resultado } from "@/lib/acoes/resultado";

const idEvento = z.uuid();

/**
 * Marca que a pessoa viu o próprio resultado (fim da animação da revelação). O banco só grava o do próprio
 * participante (mark_result_viewed); o organizador passa a ver "visto" na contagem, nunca quem tirou quem.
 */
export async function marcarResultadoVisto(eventoId: string): Promise<Resultado> {
  if (!idEvento.safeParse(eventoId).success) return falha("not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("mark_result_viewed", { p_event: eventoId });
  if (error) return falha(error, "Não foi possível registrar que você viu o resultado.");
  // a visão geral (lista de tarefas) e o painel do organizador (quantos já viram) mudam; a página atual não
  revalidatePath(`/grupo/${eventoId}`);
  revalidatePath(`/grupo/${eventoId}/admin`);
  return sucesso();
}

/** "Já comprei o presente" (ou desfaz). Só a própria linha de participante (RLS: participants_update_own). */
export async function marcarPresenteComprado(eventoId: string, comprado: boolean): Promise<Resultado<{ comprado: boolean }>> {
  if (!idEvento.safeParse(eventoId).success || typeof comprado !== "boolean") return falha("invalid_action");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("participants")
    .update({ gift_bought: comprado })
    .eq("event_id", eventoId)
    .eq("user_id", usuario.id)
    .eq("status", "approved")
    .select("gift_bought")
    .maybeSingle();
  if (error) return falha(error, "Não foi possível salvar agora. Tente de novo.");
  if (!data) return falha("forbidden");
  revalidatePath(`/grupo/${eventoId}/revelacao`);
  revalidatePath(`/grupo/${eventoId}`);
  revalidatePath(`/grupo/${eventoId}/admin`);
  return sucesso(data.gift_bought ? "Anotado: presente comprado!" : "Tudo bem, desmarcamos o presente comprado.", { comprado: data.gift_bought });
}
