import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao } from "@/components/ui/cartao";
import { Users } from "lucide-react";
import { ListaParticipantes, PedidosPendentes, type Pessoa } from "@/components/admin/participantes-cliente";

export async function SecaoParticipantes({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, user_id, role, status, rsvp, gift_bought, result_viewed_at, muted_until, join_message, created_at, profiles!participants_user_id_fkey(display_name, avatar_path, is_guest)",
    )
    .eq("event_id", g.evento.id)
    .in("status", ["approved", "pending"])
    .order("created_at");
  if (error) {
    return (
      <Cartao>
        <p role="alert" className="text-rubi">
          Não foi possível carregar os participantes agora.
        </p>
      </Cartao>
    );
  }
  const pessoas: (Pessoa & { status: string })[] = (data ?? []).map((p) => {
    const perfil = p.profiles as unknown as { display_name: string; avatar_path: string | null; is_guest: boolean } | null;
    return {
      id: p.id,
      userId: p.user_id,
      status: p.status,
      nome: perfil?.display_name ?? "Participante",
      avatar: perfil?.avatar_path ?? null,
      convidado: !!perfil?.is_guest,
      papel: p.role,
      dono: p.user_id === g.evento.owner_id,
      eu: p.user_id === g.usuario.id,
      rsvp: p.rsvp,
      comprou: p.gift_bought,
      viu: !!p.result_viewed_at,
      silenciadoAte: p.muted_until,
      mensagem: p.join_message,
      criadoEm: p.created_at,
    };
  });
  const pedidos = pessoas.filter((p) => p.status === "pending");
  const aprovados = pessoas
    .filter((p) => p.status === "approved")
    .sort((a, b) => Number(b.dono) - Number(a.dono) || Number(b.papel === "admin") - Number(a.papel === "admin") || a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <Cartao forte>
      <p className="mb-5 flex items-start gap-2 text-sm text-suave">
        <Users className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
        {g.evento.status === "open"
          ? "Aprove pedidos, defina quem organiza, silencie no chat e remova pessoas antes do sorteio."
          : "O sorteio já aconteceu: a lista está fechada. Você ainda pode definir quem organiza e silenciar no chat."}
      </p>
      <div className="flex flex-col gap-6">
        <PedidosPendentes eventoId={g.evento.id} pedidos={pedidos} />
        <ListaParticipantes eventoId={g.evento.id} pessoas={aprovados} sorteado={g.evento.status !== "open"} />
      </div>
    </Cartao>
  );
}
