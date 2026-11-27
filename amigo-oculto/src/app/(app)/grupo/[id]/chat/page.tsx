import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { carregarMembros, mapaDePerfis } from "@/components/sala/dados";
import { ChatDoGrupo } from "@/components/chat/chat";
import { PAGINA_CHAT } from "@/components/chat/tipos";

export const metadata = { title: "Chat do grupo" };

export default async function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [membros, { data }] = await Promise.all([
    carregarMembros(id),
    supabase
      .from("chat_messages")
      .select("id, user_id, body, created_at, deleted_at, deleted_by")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(PAGINA_CHAT + 1),
  ]);
  const lista = data ?? [];
  return (
    <ChatDoGrupo
      eventoId={id}
      eu={g.usuario.id}
      euParticipanteId={g.eu.id}
      admin={g.admin}
      arquivado={!!g.evento.archived_at}
      silenciadoAteInicial={g.eu.muted_until}
      iniciais={lista.slice(0, PAGINA_CHAT).reverse()}
      temMaisInicial={lista.length > PAGINA_CHAT}
      perfisIniciais={mapaDePerfis(membros)}
    />
  );
}
