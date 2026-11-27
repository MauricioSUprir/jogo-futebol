import { BellRing, Megaphone } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { AvisosCliente, LembretesCliente } from "@/components/admin/avisos-cliente";

export async function SecaoAvisos({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const id = g.evento.id;
  const [{ data: avisos }, { data: stats }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, pinned, created_at, profiles!announcements_author_id_fkey(display_name)")
      .eq("event_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("admin_event_stats", { p_event: id }),
  ]);
  const s = (stats ?? {}) as Record<string, number>;
  const aprovados = s.approved ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <Cartao forte>
        <TituloCartao
          icone={<Megaphone className="size-5" />}
          titulo="Avisos"
          descricao="Recados do organizador para todo o grupo. Cada aviso novo gera uma notificação para todos."
        />
        <AvisosCliente
          eventoId={id}
          avisos={(avisos ?? []).map((a) => ({
            id: a.id,
            titulo: a.title,
            corpo: a.body,
            fixado: a.pinned,
            criadoEm: a.created_at,
            autor: (a.profiles as unknown as { display_name: string } | null)?.display_name ?? null,
          }))}
        />
      </Cartao>
      <Cartao>
        <TituloCartao
          icone={<BellRing className="size-5" />}
          titulo="Lembretes"
          descricao="Um toque e só quem está pendente recebe. Cada tipo pode ser enviado de novo depois de 6 horas."
        />
        <LembretesCliente
          eventoId={id}
          sorteado={g.evento.status === "drawn"}
          faltam={{
            semLista: Math.max(0, aprovados - (s.with_wishlist ?? 0)),
            semResposta: Math.max(0, aprovados - (s.rsvp_yes ?? 0) - (s.rsvp_no ?? 0) - (s.rsvp_maybe ?? 0)),
            naoViram: Math.max(0, aprovados - (s.viewed ?? 0)),
            naoCompraram: Math.max(0, aprovados - (s.bought ?? 0)),
          }}
        />
      </Cartao>
    </div>
  );
}
