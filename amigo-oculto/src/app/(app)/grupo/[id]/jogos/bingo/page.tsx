import { Grid3x3 } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { pessoasDoGrupo } from "@/components/jogos/dados";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { Bingo } from "@/components/jogos/bingo";

export const metadata = { title: "Bingo natalino" };

export default async function PaginaBingo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [pessoas, { data: jogo }] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    supabase
      .from("bingo_games")
      .select("id, status, called, winners, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: cartela } = jogo
    ? await supabase.from("bingo_cards").select("cells, marked, bingo_at").eq("game_id", jogo.id).eq("participant_id", g.eu.id).maybeSingle()
    : { data: null };
  return (
    <div>
      <TopoJogo
        eventoId={id}
        icone={<Grid3x3 className="size-6" aria-hidden />}
        titulo="Bingo natalino"
        descricao="O organizador sorteia os itens; você marca na cartela. Completou uma linha, coluna ou diagonal? Grite BINGO! — o servidor confere."
      />
      <Bingo
        eventoId={id}
        admin={g.admin}
        euId={g.eu.id}
        pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome, avatar: p.avatar }))}
        jogoInicial={jogo ?? null}
        cartelaInicial={cartela ?? null}
      />
    </div>
  );
}
