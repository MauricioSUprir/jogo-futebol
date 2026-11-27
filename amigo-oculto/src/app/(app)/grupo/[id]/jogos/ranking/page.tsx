import { ChevronDown, Crown, Lock, Trophy } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { calcularConquistas, conquistasDe, detalhesDosPontos, lerEstatisticas, posicoes } from "@/lib/conquistas";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { Medalha } from "@/components/jogos/medalha";
import { Avatar } from "@/components/ui/avatar";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { cn } from "@/lib/cn";

export const metadata = { title: "Ranking e conquistas" };

export default async function PaginaRanking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("participation_stats", { p_event: id });
  const lista = lerEstatisticas(data);
  const pos = posicoes(lista);
  const eu = lista.find((e) => e.participant_id === g.eu.id) ?? null;
  const minhas = eu ? calcularConquistas(eu) : [];
  const conquistadas = minhas.filter((c) => c.conquistada).length;
  const podio = lista.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <TopoJogo
        eventoId={id}
        icone={<Trophy className="size-6" aria-hidden />}
        titulo="Ranking e conquistas"
        descricao="Participar vale pontos: confirmar presença, montar a lista, conversar, jogar, mandar cartões e fotos. Desafios pulados e mensagens anônimas não contam."
      />

      {lista.length && podio[0].points > 0 ? (
        <section aria-label="Pódio" className="grid grid-cols-3 items-end gap-2 sm:gap-4">
          {[1, 0, 2].map((i) => {
            const e = podio[i];
            if (!e) return <div key={i} />;
            const alturas = ["h-32 sm:h-40", "h-24 sm:h-32", "h-20 sm:h-24"];
            return (
              <div key={e.participant_id} className="flex min-w-0 flex-col items-center gap-2 text-center">
                {i === 0 ? <Crown className="size-6 text-ouro" aria-hidden /> : null}
                <Avatar nome={e.display_name} caminho={e.avatar_path} tamanho={i === 0 ? 72 : 56} anel={i === 0} />
                <p className="w-full truncate text-sm font-semibold">{e.display_name}</p>
                <div
                  className={cn(
                    "flex w-full flex-col items-center justify-start rounded-t-2xl pt-3 text-white shadow-md",
                    alturas[i],
                    i === 0
                      ? "bg-[linear-gradient(180deg,#f2cf6b,#c48c22)] text-[#3b2a06]"
                      : i === 1
                        ? "bg-[linear-gradient(180deg,#cfd6dd,#8d98a3)] text-[#1f2a33]"
                        : "bg-[linear-gradient(180deg,#e3a86b,#a8642a)]",
                  )}
                >
                  <span className="font-titulo text-2xl font-semibold">{pos[i]}º</span>
                  <span className="text-xs font-semibold">{e.points} pts</span>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {eu ? (
        <Cartao forte>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-titulo text-xl font-semibold">Suas medalhas</h3>
            <p className="text-sm text-suave">
              <strong className="text-texto">{conquistadas}</strong> de {minhas.length} conquistadas
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {minhas.map((c) => (
              <li key={c.id} className={cn("vidro flex items-center gap-3 rounded-2xl p-3", !c.conquistada && "opacity-80")}>
                <Medalha c={c} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {c.nome}
                    {!c.conquistada ? <Lock className="size-3.5 text-suave" aria-label="ainda bloqueada" /> : <span className="sr-only">(conquistada)</span>}
                  </p>
                  <p className="text-xs text-suave">{c.descricao}</p>
                  {!c.conquistada ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={c.meta}
                        aria-valuenow={Math.min(c.atual, c.meta)}
                        aria-label={`Progresso de ${c.nome}`}
                      >
                        <div className="h-full rounded-full bg-t1" style={{ width: `${c.progresso * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-suave">
                        {Math.min(c.atual, c.meta)}/{c.meta}
                      </span>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      <section aria-labelledby="titulo-ranking">
        <h3 id="titulo-ranking" className="mb-3 font-titulo text-xl font-semibold">
          Classificação geral
        </h3>
        {lista.length ? (
          <ol className="flex flex-col gap-2">
            {lista.map((e, i) => {
              const meda = conquistasDe(e);
              const detalhes = detalhesDosPontos(e);
              const souEu = e.participant_id === g.eu.id;
              return (
                <li key={e.participant_id}>
                  <details className={cn("vidro group rounded-2xl", souEu && "ring-2 ring-[color-mix(in_oklab,var(--t1)_45%,transparent)]")}>
                    <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className={cn("w-8 shrink-0 text-center font-titulo text-lg font-semibold", pos[i] === 1 ? "text-ouro" : "text-suave")}>
                        {pos[i]}º
                      </span>
                      <Avatar nome={e.display_name} caminho={e.avatar_path} tamanho={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {e.display_name}
                          {souEu ? <span className="font-normal text-suave"> (você)</span> : null}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {meda.slice(0, 6).map((c) => (
                            <span key={c.id} title={c.nome}>
                              <Medalha c={c} tamanho={22} />
                              <span className="sr-only">{c.nome}</span>
                            </span>
                          ))}
                          {meda.length > 6 ? <span className="text-xs font-semibold text-suave">+{meda.length - 6}</span> : null}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-titulo text-xl font-semibold">{e.points}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-suave">pontos</span>
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-suave transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="border-t border-borda px-4 py-3">
                      {detalhes.length ? (
                        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                          {detalhes.map((d) => (
                            <li key={d.rotulo} className="flex justify-between gap-3">
                              <span className="text-suave">
                                {d.rotulo}
                                {d.quantidade > 1 ? ` (${d.quantidade})` : ""}
                              </span>
                              <span className="font-semibold tabular-nums">+{d.pontos}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-suave">Ainda sem pontos. Bora participar!</p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        ) : (
          <Vazio icone={<Trophy className="size-10" />} titulo="Ranking vazio" />
        )}
      </section>
    </div>
  );
}
