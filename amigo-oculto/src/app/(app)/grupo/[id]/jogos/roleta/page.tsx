import { Dices } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { pessoasDoGrupo } from "@/components/jogos/dados";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { Roleta } from "@/components/jogos/roleta";

export const metadata = { title: "Roleta de desafios" };

export default async function PaginaRoleta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [{ data: catalogo }, pessoas, { data: pendente }, { data: giros }] = await Promise.all([
    supabase.rpc("challenge_catalog"),
    pessoasDoGrupo(supabase, id),
    supabase
      .from("challenge_spins")
      .select("id, participant_id, challenge_index, challenge_text, status, created_at")
      .eq("participant_id", g.eu.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("challenge_spins")
      .select("id, participant_id, challenge_index, challenge_text, status, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  return (
    <div>
      <TopoJogo
        eventoId={id}
        icone={<Dices className="size-6" aria-hidden />}
        titulo="Roleta de desafios"
        descricao="Desafios leves e opcionais para animar o encontro. Gire, divirta-se — e pule quando não quiser."
      />
      <Roleta
        eventoId={id}
        catalogo={catalogo ?? []}
        pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome, avatar: p.avatar }))}
        euId={g.eu.id}
        pendenteInicial={pendente ?? null}
        girosIniciais={giros ?? []}
      />
    </div>
  );
}
