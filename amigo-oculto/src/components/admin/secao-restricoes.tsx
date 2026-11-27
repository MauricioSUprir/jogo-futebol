import { Ban } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao } from "@/components/ui/cartao";
import { RestricoesCliente } from "@/components/admin/restricoes-cliente";

export async function SecaoRestricoes({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const id = g.evento.id;
  const [{ data: participantes }, { data: restricoes }] = await Promise.all([
    supabase
      .from("participants")
      .select("id, profiles!participants_user_id_fkey(display_name, avatar_path)")
      .eq("event_id", id)
      .eq("status", "approved")
      .order("created_at"),
    supabase.from("restrictions").select("id, giver_id, receiver_id, mutual, note").eq("event_id", id).order("created_at"),
  ]);
  const pessoas = (participantes ?? [])
    .map((p) => {
      const perfil = p.profiles as unknown as { display_name: string; avatar_path: string | null } | null;
      return { id: p.id, nome: perfil?.display_name ?? "Participante", avatar: perfil?.avatar_path ?? null };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <Cartao forte>
      <p className="mb-5 flex items-start gap-2 text-sm text-suave">
        <Ban className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
        Impeça que certas pessoas se tirem (casais, irmãos, quem mora junto). Só os organizadores veem esta lista.
      </p>
      <RestricoesCliente
        eventoId={id}
        aberto={g.evento.status === "open" && !g.evento.archived_at}
        pessoas={pessoas}
        restricoes={(restricoes ?? []).map((r) => ({ id: r.id, dador: r.giver_id, recebedor: r.receiver_id, mutuo: r.mutual, observacao: r.note }))}
      />
    </Cartao>
  );
}
