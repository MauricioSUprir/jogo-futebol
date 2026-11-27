"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, type Resultado } from "@/lib/acoes/resultado";

const uuid = z.uuid();

function revalidar() {
  revalidatePath("/notificacoes");
  revalidatePath("/painel");
}

/** Marca uma notificação como lida (só as próprias: o RLS confere; o filtro por user_id é a segunda trava). */
export async function marcarNotificacaoLida(id: string): Promise<Resultado> {
  if (!uuid.safeParse(id).success) return falha("not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario.id)
    .is("read_at", null);
  if (error) return falha(error);
  revalidar();
  return sucesso();
}

export async function marcarTodasLidas(): Promise<Resultado<{ quantas: number }>> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", usuario.id)
    .is("read_at", null)
    .select("id");
  if (error) return falha(error);
  revalidar();
  const quantas = data?.length ?? 0;
  return sucesso(quantas ? `${quantas} notificaç${quantas === 1 ? "ão marcada" : "ões marcadas"} como lida${quantas === 1 ? "" : "s"}.` : "Tudo já estava lido.", { quantas });
}

export async function excluirNotificacao(id: string): Promise<Resultado> {
  if (!uuid.safeParse(id).success) return falha("not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", usuario.id);
  if (error) return falha(error);
  revalidar();
  return sucesso("Notificação excluída.");
}

/** Apaga as já lidas (limpeza rápida). */
export async function excluirLidas(): Promise<Resultado<{ quantas: number }>> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("notifications").delete().eq("user_id", usuario.id).not("read_at", "is", null).select("id");
  if (error) return falha(error);
  revalidar();
  const quantas = data?.length ?? 0;
  return sucesso(quantas ? `${quantas} notificaç${quantas === 1 ? "ão lida excluída" : "ões lidas excluídas"}.` : "Não havia notificações lidas.", { quantas });
}
