import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { EditarEvento } from "@/components/admin/editar-evento";
import { eventoParaRascunho } from "@/lib/validacao/evento";

export async function SecaoEvento({ g }: { g: Grupo }) {
  const e = g.evento;
  const supabase = await clienteServidor();
  const { count } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", e.id)
    .in("status", ["approved", "pending"]);
  return (
    <EditarEvento
      // a chave muda quando o evento é salvo por outra aba/organizador: o formulário recomeça do que está gravado
      key={e.updated_at}
      eventoId={e.id}
      inicial={eventoParaRascunho(e)}
      original={{ revelacaoEm: e.reveal_at, prazoEntrada: e.join_deadline, sorteioEm: e.draw_at }}
      ocupados={count ?? 0}
      sorteado={e.status !== "open"}
    />
  );
}
