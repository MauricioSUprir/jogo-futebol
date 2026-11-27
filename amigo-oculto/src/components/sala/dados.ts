import "server-only";
import { cache } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";

/** Participante aprovado com o perfil (o RLS só entrega quem divide o grupo). */
export type Membro = {
  participanteId: string;
  usuarioId: string;
  nome: string;
  apelido: string | null;
  avatar: string | null;
  bio: string | null;
  admin: boolean;
  rsvp: "yes" | "maybe" | "no" | null;
  comprou: boolean;
  viuEm: string | null;
  entrouEm: string;
  silenciadoAte: string | null;
};

type Perfil = { display_name: string; nickname: string | null; avatar_path: string | null; bio: string | null } | null;

/** Membros aprovados do grupo (uma vez por requisição), organizadores primeiro e depois por nome. */
export const carregarMembros = cache(async (eventoId: string): Promise<Membro[]> => {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("participants")
    .select("id, user_id, role, rsvp, gift_bought, result_viewed_at, created_at, muted_until, profiles(display_name, nickname, avatar_path, bio)")
    .eq("event_id", eventoId)
    .eq("status", "approved");
  return (data ?? [])
    .map((p) => {
      const perfil = p.profiles as unknown as Perfil;
      return {
        participanteId: p.id,
        usuarioId: p.user_id,
        nome: perfil?.display_name ?? "Participante",
        apelido: perfil?.nickname ?? null,
        avatar: perfil?.avatar_path ?? null,
        bio: perfil?.bio ?? null,
        admin: p.role === "admin",
        rsvp: p.rsvp,
        comprou: p.gift_bought,
        viuEm: p.result_viewed_at,
        entrouEm: p.created_at,
        silenciadoAte: p.muted_until,
      };
    })
    .sort((a, b) => Number(b.admin) - Number(a.admin) || a.nome.localeCompare(b.nome, "pt-BR"));
});

/** Mapa usuário → perfil curto (para chat, mural e enquetes). */
export function mapaDePerfis(membros: Membro[]) {
  return Object.fromEntries(
    membros.map((m) => [m.usuarioId, { nome: m.nome, apelido: m.apelido, avatar: m.avatar, participanteId: m.participanteId, admin: m.admin }]),
  );
}
