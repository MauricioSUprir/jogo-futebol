"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarEmSegundoPlano } from "@/lib/servidor/entrega";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";

/**
 * Revelação ao vivo. O banco garante as regras: só o organizador conduz; só o participante da vez revela o próprio
 * par (ou o organizador, se a pessoa autorizou); a ordem nunca entrega um par antes da hora.
 */

const id = z.uuid("Identificador inválido.");
const NAO_LOGADO: Resultado<never> = { ok: false, erro: "Entre na sua conta para continuar." };

async function cliente() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  return { usuario, supabase: await clienteServidor() };
}

function atualizar(eventoId: string) {
  revalidatePath(`/grupo/${eventoId}`, "layout");
  revalidatePath(`/telao/${eventoId}`);
}

export async function iniciarAoVivo(eventoId: string, modo: "chain" | "random", segundos: number): Promise<Resultado> {
  const v = validar(
    z.object({ eventoId: id, modo: z.enum(["chain", "random"]), segundos: z.number().int().min(10).max(600) }),
    { eventoId, modo, segundos },
  );
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_start", { p_event: eventoId, p_mode: modo, p_seconds: segundos });
  if (error) return falha(error);
  entregarEmSegundoPlano();
  atualizar(eventoId);
  return sucesso("A revelação começou! Todos foram avisados.");
}

export async function temporizadorAoVivo(eventoId: string, acao: "start" | "pause" | "reset"): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, acao: z.enum(["start", "pause", "reset"]) }), { eventoId, acao });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_timer", { p_event: eventoId, p_action: acao });
  if (error) return falha(error);
  return sucesso();
}

export async function ajustarSegundosAoVivo(eventoId: string, segundos: number): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, segundos: z.number().int().min(10).max(600) }), { eventoId, segundos });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_set_seconds", { p_event: eventoId, p_seconds: segundos });
  if (error) return falha(error);
  return sucesso();
}

export async function proximoAoVivo(eventoId: string): Promise<Resultado<{ proximo: string | null }>> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("live_next", { p_event: eventoId });
  if (error) return falha(error);
  return sucesso(undefined, { proximo: (data as string | null) ?? null });
}

export async function revelarPorParticipante(eventoId: string, participanteId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, participanteId: id }), { eventoId, participanteId });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_reveal_for", { p_event: eventoId, p_participant: participanteId });
  if (error) return falha(error);
  return sucesso();
}

export async function encerrarAoVivo(eventoId: string): Promise<Resultado> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_finish", { p_event: eventoId });
  if (error) return falha(error);
  entregarEmSegundoPlano();
  atualizar(eventoId);
  return sucesso("Revelação encerrada. O álbum de memórias está aberto!");
}

export async function enviarPistaAoVivo(eventoId: string, texto: string): Promise<Resultado> {
  const v = validar(
    z.object({ eventoId: id, texto: z.string().trim().min(1, "Escreva a pista.").max(200, "Use até 200 caracteres.") }),
    { eventoId, texto },
  );
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_clue", { p_event: eventoId, p_body: v.dados.texto });
  if (error) return falha(error);
  return sucesso("Pista no telão!");
}

export async function revelarMeuAmigo(eventoId: string): Promise<Resultado> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("live_reveal", { p_event: eventoId });
  if (error) return falha(error);
  revalidatePath(`/grupo/${eventoId}/album`);
  return sucesso("Revelado! Olhe para o telão.");
}

/** Interruptor do próprio participante: deixa (ou não) o organizador revelar por ele no telão. */
export async function autorizarRevelacaoPublica(eventoId: string, autorizo: boolean): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, autorizo: z.boolean() }), { eventoId, autorizo });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase
    .from("participants")
    .update({ allow_public_reveal: autorizo })
    .eq("event_id", eventoId)
    .eq("user_id", s.usuario.id)
    .select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: "Você não participa deste grupo." };
  return sucesso(autorizo ? "Pronto: o organizador pode revelar por você no telão." : "Autorização retirada: só você revela o seu par.");
}
