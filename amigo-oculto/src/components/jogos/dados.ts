import "server-only";
import type { ClienteSupabase } from "@/lib/supabase/servidor";

/** Pessoa do grupo como as telas de jogos, ao vivo e álbum usam (nome e foto vêm do perfil). */
export type Pessoa = {
  id: string; // participant_id
  userId: string;
  nome: string;
  avatar: string | null;
  admin: boolean;
  autorizaRevelar: boolean;
};

/** Participantes aprovados com nome e foto (RLS: só quem é do grupo enxerga). */
export async function pessoasDoGrupo(supabase: ClienteSupabase, eventoId: string): Promise<Pessoa[]> {
  const { data } = await supabase
    .from("participants")
    .select("id, user_id, role, allow_public_reveal, created_at, profiles(display_name, avatar_path)")
    .eq("event_id", eventoId)
    .eq("status", "approved")
    .order("created_at");
  return (data ?? []).map((p) => {
    const perfil = (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles) as { display_name: string; avatar_path: string | null } | null;
    return {
      id: p.id,
      userId: p.user_id,
      nome: perfil?.display_name ?? "Participante",
      avatar: perfil?.avatar_path ?? null,
      admin: p.role === "admin",
      autorizaRevelar: p.allow_public_reveal,
    };
  });
}

/** O próprio resultado (só o meu, pela função do banco). null antes do sorteio ou sem par. */
export async function meuAmigo(
  supabase: ClienteSupabase,
  eventoId: string,
): Promise<{ participantId: string; nome: string; avatar: string | null } | null> {
  const { data } = await supabase.rpc("my_assignment", { p_event: eventoId });
  const r = (data ?? null) as { receiver?: { participant_id: string; display_name: string; avatar_path: string | null } } | null;
  if (!r?.receiver) return null;
  return { participantId: r.receiver.participant_id, nome: r.receiver.display_name, avatar: r.receiver.avatar_path };
}
