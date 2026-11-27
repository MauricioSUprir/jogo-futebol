import { MessagesSquare, ShieldAlert } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { Denuncias, ModeracaoChat, type Denuncia } from "@/components/admin/moderacao-cliente";

type Perfil = { display_name: string; avatar_path: string | null } | null;

export async function SecaoModeracao({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const id = g.evento.id;
  const [{ data: denuncias }, { data: chat }, { data: silenciados }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, kind, target_id, reason, snapshot, created_at, resolved_at, resolution, profiles!reports_reporter_id_fkey(display_name)")
      .eq("event_id", id)
      .order("resolved_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("chat_messages")
      .select("id, body, created_at, profiles!chat_messages_user_id_fkey(display_name, avatar_path)")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("participants")
      .select("id, muted_until, profiles!participants_user_id_fkey(display_name)")
      .eq("event_id", id)
      .eq("status", "approved")
      .gt("muted_until", new Date().toISOString()),
  ]);

  // autor do conteúdo denunciado (nunca na mensagem anônima: lá o remetente é protegido)
  const alvos = { chat: [] as string[], wall: [] as string[], photo: [] as string[] };
  for (const d of denuncias ?? []) if (d.kind !== "secret" && !d.resolved_at) alvos[d.kind as "chat" | "wall" | "photo"].push(d.target_id);
  const autores = new Map<string, string>();
  const [rChat, rMural, rFotos] = await Promise.all([
    alvos.chat.length
      ? supabase.from("chat_messages").select("id, profiles!chat_messages_user_id_fkey(display_name)").in("id", alvos.chat)
      : Promise.resolve({ data: [] as { id: string; profiles: unknown }[] }),
    alvos.wall.length
      ? supabase.from("wall_posts").select("id, profiles!wall_posts_user_id_fkey(display_name)").in("id", alvos.wall)
      : Promise.resolve({ data: [] as { id: string; profiles: unknown }[] }),
    alvos.photo.length
      ? supabase.from("album_photos").select("id, profiles!album_photos_uploader_id_fkey(display_name)").in("id", alvos.photo)
      : Promise.resolve({ data: [] as { id: string; profiles: unknown }[] }),
  ]);
  for (const r of [...(rChat.data ?? []), ...(rMural.data ?? []), ...(rFotos.data ?? [])]) {
    const nome = (r.profiles as Perfil)?.display_name;
    if (nome) autores.set(r.id, nome);
  }

  const lista: Denuncia[] = (denuncias ?? []).map((d) => ({
    id: d.id,
    tipo: d.kind as Denuncia["tipo"],
    texto: d.snapshot,
    motivo: d.reason,
    criadoEm: d.created_at,
    denunciante: d.kind === "secret" ? null : ((d.profiles as unknown as Perfil)?.display_name ?? null),
    autor: d.kind === "secret" ? null : (autores.get(d.target_id) ?? null),
    resolvidaEm: d.resolved_at,
    resolucao: d.resolution as Denuncia["resolucao"],
  }));

  return (
    <div className="flex flex-col gap-5">
      <Cartao forte>
        <TituloCartao
          icone={<ShieldAlert className="size-5" />}
          titulo="Denúncias"
          descricao="Decida o que fazer com o que foi denunciado. Nas mensagens anônimas você vê o texto, nunca quem mandou."
        />
        <Denuncias eventoId={id} denuncias={lista} />
      </Cartao>
      <Cartao>
        <TituloCartao icone={<MessagesSquare className="size-5" />} titulo="Chat do grupo" descricao="Apague mensagens e libere quem foi silenciado." />
        <ModeracaoChat
          eventoId={id}
          mensagens={(chat ?? []).map((m) => {
            const p = m.profiles as unknown as Perfil;
            return { id: m.id, texto: m.body, autor: p?.display_name ?? "Participante", avatar: p?.avatar_path ?? null, criadoEm: m.created_at };
          })}
          silenciados={(silenciados ?? []).map((s) => ({
            participanteId: s.id,
            nome: (s.profiles as unknown as Perfil)?.display_name ?? "Participante",
            ate: s.muted_until!,
          }))}
        />
      </Cartao>
    </div>
  );
}
