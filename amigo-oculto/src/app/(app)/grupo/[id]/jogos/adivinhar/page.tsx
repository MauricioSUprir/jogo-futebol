import { CircleCheck, CircleX, Search, Sparkles } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { pessoasDoGrupo } from "@/components/jogos/dados";
import { AvisoSigilo, TopoJogo } from "@/components/jogos/topo-jogo";
import { EscolherPalpite } from "@/components/jogos/palpite";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { Avatar } from "@/components/ui/avatar";
import { relativo } from "@/lib/formatos";

export const metadata = { title: "Adivinhe quem te tirou" };

type MeuPalpite = {
  status: "open" | "drawn" | "finished";
  guessed_id: string | null;
  updated_at: string | null;
  correct?: boolean | null;
  total_guesses: number;
  total_correct?: number;
};

export default async function Adivinhar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const topo = (
    <TopoJogo
      eventoId={id}
      icone={<Search className="size-6" aria-hidden />}
      titulo="Adivinhe quem te tirou"
      descricao="Escolha quem você acha que é o seu amigo oculto. Dá para trocar até o fim — e no encerramento você descobre se acertou."
    />
  );
  if (g.evento.status === "open") {
    return (
      <div>
        {topo}
        <Vazio icone={<Search className="size-10" />} titulo="Espere o sorteio" texto="Os palpites abrem assim que o sorteio for realizado." />
      </div>
    );
  }

  const supabase = await clienteServidor();
  const [pessoas, { data: bruto }, { data: revelacao }] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    supabase.rpc("my_guess", { p_event: id }),
    // se quem me tirou revelou ao vivo, isso já é público para o grupo
    supabase.from("live_reveals").select("giver_id").eq("event_id", id).eq("receiver_id", g.eu.id).maybeSingle(),
  ]);
  const palpite = (bruto ?? { guessed_id: null, total_guesses: 0 }) as MeuPalpite;
  const outros = pessoas.filter((p) => p.id !== g.eu.id);
  const escolhido = outros.find((p) => p.id === palpite.guessed_id) ?? null;
  const reveladoPor = revelacao ? pessoas.find((p) => p.id === revelacao.giver_id) : null;

  if (g.evento.status === "finished") {
    const acertou = palpite.correct === true;
    const total = palpite.total_guesses ?? 0;
    const certos = palpite.total_correct ?? 0;
    return (
      <div className="flex flex-col gap-5">
        {topo}
        <Cartao forte className="relative overflow-hidden text-center">
          {escolhido ? (
            <>
              <div className="mx-auto mb-3 inline-flex">
                {acertou ? (
                  <CircleCheck className="size-14 text-esmeralda" aria-hidden />
                ) : (
                  <CircleX className="size-14 text-rubi" aria-hidden />
                )}
              </div>
              <p className="font-titulo text-3xl font-semibold">{acertou ? "Você acertou!" : "Não foi dessa vez"}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Avatar nome={escolhido.nome} caminho={escolhido.avatar} tamanho={48} />
                <p className="text-left text-sm text-suave">
                  Seu palpite foi <strong className="text-texto">{escolhido.nome}</strong>
                  {acertou ? " — e era mesmo!" : "."}
                </p>
              </div>
            </>
          ) : (
            <p className="font-titulo text-2xl font-semibold">Você não deu palpite desta vez</p>
          )}
          {reveladoPor && !acertou ? (
            <p className="mx-auto mt-4 max-w-md text-sm text-suave">
              Na revelação ao vivo, <strong className="text-texto">{reveladoPor.nome}</strong> contou que tirou você.
            </p>
          ) : null}
        </Cartao>
        <Cartao>
          <h3 className="font-titulo text-lg font-semibold">Como o grupo se saiu</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Numero valor={total} rotulo={total === 1 ? "palpite dado" : "palpites dados"} />
            <Numero valor={certos} rotulo={certos === 1 ? "acerto" : "acertos"} />
            <Numero valor={total ? `${Math.round((certos / total) * 100)}%` : "—"} rotulo="de acerto" />
          </div>
          {total && certos === 0 ? <p className="mt-4 text-sm text-suave">Ninguém acertou: o sigilo foi perfeito!</p> : null}
          {total && certos === total ? <p className="mt-4 text-sm text-suave">Todo mundo acertou — que turma de detetives!</p> : null}
        </Cartao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {topo}
      <Cartao className="flex flex-wrap items-center gap-4">
        <Sparkles className="size-6 shrink-0 text-ouro" aria-hidden />
        <div className="min-w-0 flex-1">
          {escolhido ? (
            <p className="text-[15px]">
              Seu palpite: <strong>{escolhido.nome}</strong>
              {palpite.updated_at ? <span className="text-suave"> · {relativo(palpite.updated_at)}</span> : null}
            </p>
          ) : (
            <p className="text-[15px] font-semibold">Toque em quem você acha que te tirou.</p>
          )}
          <p className="text-sm text-suave">
            {palpite.total_guesses
              ? `${palpite.total_guesses} ${palpite.total_guesses === 1 ? "pessoa já palpitou" : "pessoas já palpitaram"} no grupo.`
              : "Ninguém palpitou ainda. Seja o primeiro!"}
          </p>
        </div>
      </Cartao>
      <EscolherPalpite eventoId={id} pessoas={outros.map((p) => ({ id: p.id, nome: p.nome, avatar: p.avatar }))} atual={palpite.guessed_id} />
      <AvisoSigilo>O resultado só aparece quando o amigo oculto for encerrado — e só para você. Ninguém vê o seu palpite.</AvisoSigilo>
    </div>
  );
}

function Numero({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div className="vidro rounded-2xl px-4 py-3 text-center">
      <p className="font-titulo text-3xl font-semibold text-t1">{valor}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-suave">{rotulo}</p>
    </div>
  );
}
