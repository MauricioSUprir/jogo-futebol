import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown, History, PartyPopper, Users } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { CapaGrupo } from "@/components/painel/cartao-grupo";
import { ROTULO_SITUACAO, papelNoGrupo, situacaoDoEvento, type Participacao } from "@/components/painel/dados";
import { dataCurta } from "@/lib/formatos";
import { nomeDoTema } from "@/lib/temas";

export const metadata: Metadata = { title: "Histórico de participação" };

function ano(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric" });
}

export default async function Historico() {
  const usuario = await exigirUsuario("/painel/historico");
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("participants")
    .select("*, evento:events(*)")
    .eq("user_id", usuario.id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false });
  const lista = (data ?? []).filter((p): p is Participacao => !!p.evento);

  const quando = (p: Participacao) => p.evento.reveal_at ?? p.evento.finished_at ?? p.evento.created_at;
  lista.sort((a, b) => quando(b).localeCompare(quando(a)));
  const porAno = new Map<string, Participacao[]>();
  for (const p of lista) {
    const a = ano(quando(p));
    porAno.set(a, [...(porAno.get(a) ?? []), p]);
  }
  const aprovados = lista.filter((p) => p.status === "approved");
  const organizados = aprovados.filter((p) => p.evento.owner_id === usuario.id || p.role === "admin").length;
  const concluidos = aprovados.filter((p) => ["encerrado", "arquivado"].includes(situacaoDoEvento(p.evento))).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link href="/painel" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
          <ArrowLeft className="size-4" aria-hidden /> Meu painel
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-titulo text-3xl font-semibold">
          <History className="size-7 text-t1" aria-hidden /> Histórico de participação
        </h1>
        <p className="mt-1 text-suave">Todos os amigos ocultos de que você participou, com datas e o seu papel em cada um.</p>
      </div>

      <ul className="grid grid-cols-3 gap-3" aria-label="Resumo">
        {[
          { rotulo: "Grupos", valor: aprovados.length, icone: Users },
          { rotulo: "Organizados", valor: organizados, icone: Crown },
          { rotulo: "Concluídos", valor: concluidos, icone: PartyPopper },
        ].map((n) => (
          <li key={n.rotulo} className="vidro flex flex-col items-center gap-1 rounded-cartao p-3 text-center sm:p-4">
            <n.icone className="size-5 text-t1" aria-hidden />
            <span className="font-titulo text-2xl font-semibold tabular-nums sm:text-3xl">{n.valor}</span>
            <span className="text-xs font-semibold text-suave">{n.rotulo}</span>
          </li>
        ))}
      </ul>

      {lista.length === 0 ? (
        <Vazio
          icone={<History className="size-10" />}
          titulo="Seu histórico começa no primeiro grupo"
          texto="Quando você participar de um amigo oculto, ele aparece aqui — mesmo depois de encerrado ou arquivado."
          acao={<BotaoLink href="/painel">Voltar ao painel</BotaoLink>}
        />
      ) : (
        [...porAno.entries()].map(([a, itens]) => (
          <section key={a} aria-labelledby={`ano-${a}`}>
            <h2 id={`ano-${a}`} className="mb-2 font-titulo text-xl font-semibold">
              {a}
            </h2>
            <Cartao className="p-2 sm:p-3">
              <ul className="flex flex-col divide-y divide-borda">
                {itens.map((p) => {
                  const e = p.evento;
                  const sit = situacaoDoEvento(e);
                  const st = ROTULO_SITUACAO[sit];
                  return (
                    <li key={p.id} data-tema={e.theme}>
                      <Link href={`/grupo/${e.id}`} className="flex items-start gap-3 rounded-2xl p-2.5 transition hover:bg-black/5 dark:hover:bg-white/5">
                        <CapaGrupo evento={e} className="size-14 shrink-0 rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-semibold">{e.name}</p>
                            {p.status === "pending" ? <Selo cor="ouro">Aguardando aprovação</Selo> : <Selo cor={st.cor}>{st.texto}</Selo>}
                          </div>
                          <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13px] text-suave sm:grid-cols-2">
                            <div className="flex gap-1">
                              <dt>Papel:</dt>
                              <dd className="font-medium text-texto">{papelNoGrupo(p, e, usuario.id)}</dd>
                            </div>
                            <div className="flex gap-1">
                              <dt>Entrou em:</dt>
                              <dd>{dataCurta(p.approved_at ?? p.created_at)}</dd>
                            </div>
                            {e.reveal_at ? (
                              <div className="flex gap-1">
                                <dt>Revelação:</dt>
                                <dd>{dataCurta(e.reveal_at)}</dd>
                              </div>
                            ) : null}
                            {e.finished_at ? (
                              <div className="flex gap-1">
                                <dt>Encerrado em:</dt>
                                <dd>{dataCurta(e.finished_at)}</dd>
                              </div>
                            ) : null}
                            {e.archived_at ? (
                              <div className="flex gap-1">
                                <dt>Arquivado em:</dt>
                                <dd>{dataCurta(e.archived_at)}</dd>
                              </div>
                            ) : null}
                            <div className="flex gap-1">
                              <dt>Tema:</dt>
                              <dd>{nomeDoTema(e.theme)}</dd>
                            </div>
                          </dl>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Cartao>
          </section>
        ))
      )}
    </div>
  );
}
