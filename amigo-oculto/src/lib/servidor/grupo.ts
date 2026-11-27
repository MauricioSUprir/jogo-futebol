import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { executarSorteio } from "@/lib/sorteio/servico";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Carrega o grupo para a sala (uma vez por requisição): o evento, a minha participação e a sessão ao vivo.
 * Se o sorteio agendado venceu e ninguém rodou ainda (cron atrasado), roda aqui — o banco garante uma vez só.
 */
export const carregarGrupo = cache(async (id: string) => {
  if (!UUID.test(id)) notFound();
  const usuario = await exigirUsuario(`/grupo/${id}`);
  const supabase = await clienteServidor();
  let [{ data: evento }, { data: eu }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("participants").select("*").eq("event_id", id).eq("user_id", usuario.id).maybeSingle(),
  ]);
  if (!evento || !eu) notFound();

  if (evento.status === "open" && evento.draw_mode === "scheduled" && evento.draw_at && new Date(evento.draw_at) <= new Date() && !evento.archived_at) {
    try {
      await executarSorteio({ eventoId: id, autorId: null });
    } catch {
      // outro processo já sorteou, ou faltam participantes: a sala mostra o estado atual
    }
    ({ data: evento } = await supabase.from("events").select("*").eq("id", id).single());
    ({ data: eu } = await supabase.from("participants").select("*").eq("event_id", id).eq("user_id", usuario.id).single());
    if (!evento || !eu) notFound();
  }

  const [{ count: aprovados }, { data: aoVivo }] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "approved"),
    supabase.from("live_sessions").select("status, current_id, mode").eq("event_id", id).maybeSingle(),
  ]);
  return {
    usuario,
    evento,
    eu,
    aprovado: eu.status === "approved",
    admin: eu.status === "approved" && eu.role === "admin",
    dono: evento.owner_id === usuario.id,
    totalAprovados: aprovados ?? 0,
    aoVivo,
  };
});

export type Grupo = Awaited<ReturnType<typeof carregarGrupo>>;
