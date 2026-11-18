// Uma meta: progresso, etapas com prazo, registro de progresso, evolução e histórico.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, CircleCheck, History, ListChecks, Pause, Pencil, Play, RotateCcw, Trash2, TrendingUp } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { db } from "@/lib/db";
import { chaveNoFuso, dataParaChave, diaCurto, diaPorExtenso, hoje } from "@/lib/datas";
import { categoriaMeta, metaCumprida, PRIORIDADES_META, progressoMeta, textoPrazo, textoProgresso } from "@/lib/metas";
import { alternarEtapa, excluirEtapa, excluirMeta, mudarStatusMeta } from "@/acoes/metas";
import { Anel } from "@/components/anel";
import { CabecalhoPagina, Cartao, Mensagem, Selo, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormEtapa, FormMeta, FormProgresso } from "@/components/metas/formularios";
import { GraficoEvolucao } from "@/components/metas/grafico";
import { IconeCategoria } from "@/components/metas/icones";
import { cn } from "@/lib/cn";

export const metadata = { title: "Meta" };

export default async function PaginaMeta({ params }: { params: Promise<{ id: string }> }) {
  const user = await exigirUsuario();
  const { id } = await params;
  const g = await db.goal.findFirst({
    where: { id, userId: user.id },
    include: { steps: { orderBy: { position: "asc" } }, updates: { orderBy: { at: "desc" }, take: 100 } },
  });
  if (!g) notFound();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const cat = categoriaMeta(g.category);
  const pct = progressoMeta(g);
  const prazo = g.deadline ? dataParaChave(g.deadline) : null;
  const tp = prazo && g.status !== "concluido" ? textoPrazo(prazo, hojeK) : null;
  const numero = g.measure === "numero";
  const concluida = g.status === "concluido";
  const pontos = numero
    ? [...g.updates]
        .reverse()
        .filter((u) => u.value !== null)
        .map((u) => ({ rotulo: diaCurto(chaveNoFuso(u.at, tz)), valor: u.value as number }))
    : [];
  const status = (acao: string, rotulo: string, Icone: typeof Pause, variante: "contorno" | "secundario" | "fantasma" = "secundario") => (
    <form action={mudarStatusMeta}>
      <input type="hidden" name="id" value={g.id} />
      <input type="hidden" name="acao" value={acao} />
      <BotaoEnvio variante={variante} pendente="…">
        <Icone className="h-4 w-4" /> {rotulo}
      </BotaoEnvio>
    </form>
  );

  return (
    <>
      <Link href="/metas" className={classesBotao("fantasma", "p", "-ml-2 mb-2")}>
        <ArrowLeft className="h-4 w-4" /> Metas
      </Link>
      <CabecalhoPagina
        rotulo={cat.nome}
        titulo={<span className="break-words">{g.title}</span>}
        descricao={g.why ? `Por que importa: ${g.why}` : undefined}
        acao={
          <>
            {!concluida && g.status === "ativo" && (
              <Dialogo gatilho={<><TrendingUp className="h-4 w-4" /> Registrar progresso</>} classeGatilho={classesBotao("primario")} titulo="Registrar progresso" descricao={g.title}>
                <FormProgresso meta={g.id} numero={numero} atual={g.current} unidade={g.unit} />
              </Dialogo>
            )}
            <Dialogo gatilho={<Pencil className="h-4 w-4" />} rotuloGatilho="Editar meta" classeGatilho={classesBotao("secundario", "icone")} titulo="Editar meta" larga>
              <FormMeta
                ano={Number(hojeK.slice(0, 4))}
                inicial={{ id: g.id, titulo: g.title, categoria: g.category, descricao: g.description, porque: g.why, prazo, ano: g.year, prioridade: g.priority, medida: g.measure, alvo: g.target, unidade: g.unit }}
              />
            </Dialogo>
          </>
        }
      />

      {concluida && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-between">
          <Mensagem tipo="ok">
            Meta concluída{g.completedAt ? ` em ${diaPorExtenso(chaveNoFuso(g.completedAt, tz), true)}` : ""}. Parabéns!
          </Mensagem>
          {status("reabrir", "Reabrir", RotateCcw, "fantasma")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Cartao holo className="lg:col-span-2">
          <div className="flex flex-col items-center gap-4 text-center">
            <Anel pct={pct} tamanho={168} espessura={13} cor={concluida ? "#34d399" : undefined} rotulo={`${pct}% concluído`}>
              <div>
                <p className="numero font-display text-4xl font-bold" data-testid="progresso-meta">
                  {pct}%
                </p>
                <p className="text-xs text-suave">{textoProgresso(g)}</p>
              </div>
            </Anel>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="flex items-center gap-2 text-sm text-suave">
                <IconeCategoria categoria={g.category} tamanho="p" /> {cat.curto}
              </span>
              <Selo cor={g.priority === 1 ? "#F43F5E" : g.priority === 2 ? "#F59E0B" : "#94A3B8"}>Prioridade {PRIORIDADES_META[g.priority]?.toLowerCase()}</Selo>
              {g.year && <Selo cor="#a78bfa">Objetivo {g.year}</Selo>}
              {g.status === "pausado" && <Selo cor="#94a3b8">Pausada</Selo>}
            </div>
            {prazo && (
              <p className={cn("flex items-center gap-1.5 text-sm", tp?.atrasada ? "text-alerta" : "text-suave")}>
                <CalendarClock className="h-4 w-4" aria-hidden /> Prazo: {diaPorExtenso(prazo, true)}
                {tp && ` · ${tp.texto}`}
              </p>
            )}
            {g.description && <p className="whitespace-pre-wrap break-words text-left text-sm text-suave">{g.description}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {g.status === "ativo" && status("pausar", "Pausar", Pause, "fantasma")}
              {g.status === "pausado" && status("retomar", "Retomar", Play)}
              {!concluida && status("concluir", "Concluir", CircleCheck, "contorno")}
              <Dialogo
                gatilho={<><Trash2 className="h-4 w-4" /> Excluir</>}
                classeGatilho={classesBotao("fantasma", "m", "text-[#fda4af]")}
                titulo="Excluir esta meta?"
                descricao="Apaga a meta, as etapas, o histórico de progresso e o lembrete do prazo na agenda. Não dá para desfazer."
              >
                <form action={excluirMeta}>
                  <input type="hidden" name="id" value={g.id} />
                  <BotaoEnvio variante="perigo" className="w-full" pendente="Excluindo…">
                    <Trash2 className="h-4 w-4" /> Excluir meta
                  </BotaoEnvio>
                </form>
              </Dialogo>
            </div>
          </div>
        </Cartao>

        <div className="grid grid-cols-1 gap-4 lg:col-span-3">
          {!numero && (
            <Cartao titulo={`Etapas (${g.steps.filter((s) => s.done).length}/${g.steps.length})`} icone={ListChecks}>
              {g.steps.length === 0 ? (
                <p className="mb-3 text-sm text-suave">Divida a meta em etapas menores: o progresso sobe a cada etapa feita.</p>
              ) : (
                <ul className="mb-3 grid grid-cols-1 gap-1.5">
                  {g.steps.map((s) => {
                    const sp = s.dueDay && !s.done ? textoPrazo(dataParaChave(s.dueDay), hojeK) : null;
                    return (
                      <li key={s.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                        <form action={alternarEtapa}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="valor" value={s.done ? "0" : "1"} />
                          <button
                            aria-pressed={s.done}
                            aria-label={`${s.done ? "Desmarcar" : "Marcar"} a etapa "${s.title}"`}
                            className={cn("grid grid-cols-1 h-7 w-7 place-items-center rounded-lg border transition", s.done ? "border-ok/50 bg-ok/20 text-ok" : "border-borda-forte hover:border-eletrico")}
                          >
                            {s.done && <Check className="h-4 w-4" />}
                          </button>
                        </form>
                        <div className="min-w-0 flex-1">
                          <p className={cn("break-words text-sm", s.done && "text-suave line-through decoration-suave/50")}>{s.title}</p>
                          {(sp || (s.dueDay && s.done)) && (
                            <p className={cn("text-xs", sp?.atrasada ? "text-alerta" : "text-suave")}>
                              {s.dueDay && `até ${diaCurto(dataParaChave(s.dueDay))}`}
                              {sp && ` · ${sp.texto}`}
                            </p>
                          )}
                        </div>
                        <form action={excluirEtapa}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Excluir a etapa "${s.title}"`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!concluida && <FormEtapa meta={g.id} />}
              {!concluida && metaCumprida(g) && <p className="mt-2 text-xs text-ok">Todas as etapas feitas.</p>}
            </Cartao>
          )}

          {numero && (
            <Cartao titulo="Evolução" icone={TrendingUp}>
              {pontos.length >= 2 ? (
                <>
                  <GraficoEvolucao dados={pontos} alvo={g.target ?? 0} unidade={g.unit} />
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-suave hover:text-texto">Ver em tabela</summary>
                    <table className="mt-2 w-full text-left">
                      <tbody className="numero">
                        {pontos.map((p, i) => (
                          <tr key={i} className="border-t border-borda">
                            <td className="py-1">{p.rotulo}</td>
                            <td className="py-1">
                              {p.valor.toLocaleString("pt-BR")}
                              {g.unit ? ` ${g.unit}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              ) : (
                <p className="text-sm text-suave">
                  Atual: <span className="numero text-texto">{textoProgresso(g)}</span>. O gráfico aparece a partir de 2 registros de progresso.
                </p>
              )}
            </Cartao>
          )}

          <Cartao titulo="Histórico de progresso" icone={History}>
            {g.updates.length === 0 ? (
              <p className="text-sm text-suave">Os registros de progresso aparecem aqui.</p>
            ) : (
              <ol className="grid grid-cols-1 gap-2">
                {g.updates.map((u) => (
                  <li key={u.id} className="flex min-w-0 gap-3 text-sm">
                    <span className="w-14 shrink-0 text-xs text-suave">{diaCurto(chaveNoFuso(u.at, tz))}</span>
                    <span className="min-w-0 flex-1 break-words">
                      {u.value !== null && (
                        <span className="numero font-medium">
                          <span className="font-normal text-suave">total </span>
                          {u.value.toLocaleString("pt-BR")}
                          {g.unit ? ` ${g.unit}` : ""}
                          {u.note ? " · " : ""}
                        </span>
                      )}
                      {u.note && <span className="text-suave">{u.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
