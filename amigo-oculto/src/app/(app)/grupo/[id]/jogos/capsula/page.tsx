import { Hourglass } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { CapsulaDoTempo, type Capsula } from "@/components/jogos/capsula";

export const metadata = { title: "Cápsula do tempo" };

export default async function PaginaCapsula({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [{ data: lista }, { data: resumo }] = await Promise.all([
    // RLS: as minhas (lacradas ou não) e as já abertas do grupo
    supabase
      .from("time_capsules")
      .select("id, body, open_at, created_at, user_id, profiles(display_name, avatar_path)")
      .eq("event_id", id)
      .order("open_at", { ascending: true }),
    supabase.rpc("capsule_summary", { p_event: id }),
  ]);
  const agora = Date.now();
  const capsulas: (Capsula & { aberta: boolean })[] = (lista ?? []).map((c) => {
    const perfil = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as { display_name: string; avatar_path: string | null } | null;
    return {
      id: c.id,
      body: c.body,
      open_at: c.open_at,
      created_at: c.created_at,
      mine: c.user_id === g.usuario.id,
      autor: perfil?.display_name ?? "Participante",
      avatar: perfil?.avatar_path ?? null,
      aberta: new Date(c.open_at).getTime() <= agora,
    };
  });
  const r = (resumo ?? {}) as { sealed?: number; opened?: number; next_open_at?: string | null };
  return (
    <div>
      <TopoJogo
        eventoId={id}
        icone={<Hourglass className="size-6" aria-hidden />}
        titulo="Cápsula do tempo"
        descricao="Escreva uma mensagem que fica lacrada até a data que você escolher. Quando abrir, todo o grupo lê."
      />
      <CapsulaDoTempo
        eventoId={id}
        minhas={capsulas.filter((c) => c.mine && !c.aberta)}
        abertas={capsulas.filter((c) => c.aberta).reverse()}
        resumo={{ sealed: r.sealed ?? 0, opened: r.opened ?? 0, next_open_at: r.next_open_at ?? null }}
        encontro={g.evento.reveal_at}
      />
    </div>
  );
}
