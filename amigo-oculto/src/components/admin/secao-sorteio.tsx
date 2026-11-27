import { History } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { SorteioCliente } from "@/components/admin/sorteio-cliente";
import { dataHora } from "@/lib/formatos";

export async function SecaoSorteio({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const id = g.evento.id;
  const [{ data: participantes }, { data: restricoes }, { data: historico }] = await Promise.all([
    supabase.from("participants").select("id, status").eq("event_id", id).in("status", ["approved", "pending"]),
    supabase.from("restrictions").select("giver_id, receiver_id, mutual").eq("event_id", id),
    supabase
      .from("draw_log")
      .select("id, version, kind, scheduled, participant_count, reason, created_at, profiles!draw_log_performed_by_fkey(display_name)")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const aprovados = (participantes ?? []).filter((p) => p.status === "approved").map((p) => p.id);
  // depois do sorteio a tela só precisa da contagem: nenhum id de participante vai para o navegador
  const aberto = g.evento.status === "open";
  const pendentes = (participantes ?? []).filter((p) => p.status === "pending").length;

  return (
    <div className="flex flex-col gap-5">
      <SorteioCliente
        eventoId={id}
        status={g.evento.status}
        arquivado={!!g.evento.archived_at}
        aprovados={aberto ? aprovados : []}
        totalAprovados={aprovados.length}
        pendentes={pendentes}
        restricoes={aberto ? (restricoes ?? []).map((r) => ({ giver: r.giver_id, receiver: r.receiver_id, mutual: r.mutual })) : []}
        modo={g.evento.draw_mode}
        agendadoPara={g.evento.draw_at}
        prazoEntrada={g.evento.join_deadline}
        revelacao={g.evento.reveal_at}
        sorteadoEm={g.evento.drawn_at}
        versao={g.evento.draw_version}
        aoVivo={!!g.aoVivo}
      />
      <Cartao>
        <TituloCartao icone={<History className="size-5" />} titulo="Histórico do sorteio" descricao="Quando foi sorteado, por quem e por quê. Os pares nunca aparecem." />
        {historico && historico.length > 0 ? (
          <ol className="flex flex-col divide-y divide-borda">
            {historico.map((h) => {
              const quem = (h.profiles as unknown as { display_name: string } | null)?.display_name;
              return (
                <li key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex shrink-0 items-center gap-2 sm:w-44">
                    <Selo cor={h.kind === "redraw" ? "rubi" : "esmeralda"}>{h.kind === "redraw" ? "Refeito" : "Sorteio"}</Selo>
                    <span className="text-xs font-semibold text-suave">versão {h.version}</span>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p>
                      {dataHora(h.created_at, { year: "numeric" })} · {h.participant_count} pessoas ·{" "}
                      {h.scheduled ? "automático (agendado)" : quem ? `por ${quem}` : "pelo organizador"}
                    </p>
                    {h.reason ? <p className="text-suave [overflow-wrap:anywhere]">Motivo: {h.reason}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-suave">O sorteio ainda não foi feito.</p>
        )}
      </Cartao>
    </div>
  );
}
