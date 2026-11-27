import { Brain } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lerEstatisticas } from "@/lib/conquistas";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { Quiz, type PerguntaQuiz } from "@/components/jogos/quiz";

export const metadata = { title: "Quiz dos participantes" };

export default async function PaginaQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [{ data: lista }, { data: estat }] = await Promise.all([
    supabase.rpc("quiz_list", { p_event: id }),
    supabase.rpc("participation_stats", { p_event: id }),
  ]);
  const placar = lerEstatisticas(estat).map((e) => ({
    id: e.participant_id,
    nome: e.display_name,
    avatar: e.avatar_path,
    acertos: e.quiz_correct,
    respostas: e.quiz_answers,
    perguntas: e.quiz_questions,
  }));
  return (
    <div>
      <TopoJogo
        eventoId={id}
        icone={<Brain className="size-6" aria-hidden />}
        titulo="Quiz dos participantes"
        descricao="Crie até 10 perguntas sobre você e responda as dos outros. Cada resposta vale 3 pontos — e cada acerto, mais 5."
      />
      <Quiz eventoId={id} perguntas={(lista ?? []) as PerguntaQuiz[]} placar={placar} admin={g.admin} euId={g.eu.id} />
    </div>
  );
}
