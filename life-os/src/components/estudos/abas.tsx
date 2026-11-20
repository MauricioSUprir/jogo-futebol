// Abas do Study Center (componentes de servidor; os dados vêm de carregarEstudos).
import Link from "next/link";
import {
  Archive, ArchiveRestore, CalendarClock, CalendarPlus, Check, ClipboardCheck, FileText, GraduationCap, Layers,
  ListChecks, NotebookPen, Pencil, Plus, Repeat, Target, Timer, Trash2, TrendingUp, TriangleAlert, X,
} from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { DadosEstudos } from "@/lib/servidor/estudos";
import { dataParaChave, diaCurto, diaRelativo, diasEntre, horaNoFuso, somaDias } from "@/lib/datas";
import { corHabito } from "@/lib/catalogo";
import {
  INTERVALOS_REVISAO, STATUS_CONTEUDO, TIPOS_SESSAO, contagem, formatarMinutos, formatarNota, mediaPonderada, pct, statusMateria,
} from "@/lib/estudos";
import {
  adicionarItemChecklist, alternarItemChecklist, arquivarMateria, excluirConteudo, excluirFlashcard, excluirItemChecklist, excluirMateria,
  excluirNota, excluirProva, excluirResumo, excluirSessao, excluirSimulado, mudarStatusConteudo, revisarConteudo,
} from "@/acoes/estudos";
import { Barra, Cartao, Selo, Vazio, classesBotao } from "../ui";
import { BotaoEnvio, Dialogo } from "../cliente";
import {
  BotaoPlanejarSemana, FormConteudo, FormDificuldade, FormFlashcard, FormMateria, FormNota, FormProva, FormResumo, FormSessao, FormSimulado,
  QuantoFalta, type MateriaOpcao,
} from "./formularios";
import { Pomodoro } from "./pomodoro";
import { RevisaoCartoes } from "./revisao-cartoes";
import { GraficoSimulados } from "./graficos";
import { cn } from "@/lib/cn";

interface Props {
  d: DadosEstudos;
  user: User;
  hojeK: string;
}

const opcoes = (d: DadosEstudos): MateriaOpcao[] => d.materias.map((m) => ({ id: m.id, nome: m.name }));

function Ponto({ cor }: { cor: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corHabito(cor) }} aria-hidden />;
}

function BotaoLixeira({ acao, id, rotulo }: { acao: (fd: FormData) => Promise<void>; id: string; rotulo: string }) {
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={rotulo} title={rotulo}>
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}

export function SemMaterias() {
  return (
    <Cartao>
      <Vazio icone={GraduationCap} titulo="Comece cadastrando as matérias">
        <p className="mb-3">Cada matéria tem a média que você quer atingir e uma meta de estudo por semana.</p>
        <Dialogo gatilho={<><Plus className="h-4 w-4" /> Nova matéria</>} classeGatilho={classesBotao("primario")} titulo="Nova matéria">
          <FormMateria />
        </Dialogo>
      </Vazio>
    </Cartao>
  );
}

// ───────────── Visão geral (painel escolar) ─────────────

export function AbaVisao({ d, user, hojeK }: Props) {
  if (!d.materias.length) return <SemMaterias />;
  const revisoes = d.revisoesHoje.length + d.cartoesHoje.length;
  const proxima = d.provas.find((p) => p.tipo === "prova");
  const notasDe = (id: string) => d.notas.filter((n) => n.subjectId === id).map((n) => ({ valor: n.value, max: n.maxValue, peso: n.weight }));
  const kpis = [
    { r: "Nesta semana", v: formatarMinutos(d.minutosSemana), det: d.metaSemana ? `de ${formatarMinutos(d.metaSemana)} (${pct(d.minutosSemana, d.metaSemana)}%)` : "sem meta", icone: Timer },
    { r: "Revisões hoje", v: String(revisoes), det: `${d.revisoesHoje.length} cont. · ${d.cartoesHoje.length} cartões`, icone: Repeat },
    { r: "Próxima prova", v: proxima ? contagem(diasEntre(hojeK, proxima.dia)) : "—", det: proxima ? proxima.titulo : "nenhuma marcada", icone: CalendarClock },
    { r: "Matérias", v: String(d.materias.length), det: `${d.conteudos.filter((c) => c.status === "concluido").length} conteúdos feitos`, icone: GraduationCap },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
      <section aria-label="Resumo dos estudos" className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.r} className="painel min-w-0 p-3.5 sm:p-4">
            <p className="rotulo flex items-center gap-1.5">
              <k.icone className="h-3.5 w-3.5 text-eletrico-claro" aria-hidden /> {k.r}
            </p>
            <p className="numero mt-1.5 truncate font-display text-xl font-bold first-letter:uppercase">{k.v}</p>
            <p className="truncate text-xs text-suave">{k.det}</p>
          </div>
        ))}
      </section>

      <Cartao titulo="Painel escolar" icone={GraduationCap} className="lg:col-span-3" holo>
        <ul className="grid grid-cols-1 gap-2">
          {d.materias.map((m) => {
            const cont = d.conteudos.filter((c) => c.subjectId === m.id);
            const est = statusMateria(
              {
                revisoesVencidas: d.revisoesHoje.filter((c) => c.subjectId === m.id).length,
                concluidos: cont.filter((c) => c.status === "concluido").length,
                totalConteudos: cont.length,
                ultima: d.ultimaPorMateria.get(m.id) ?? null,
              },
              hojeK,
            );
            const media = mediaPonderada(notasDe(m.id));
            const min = d.minPorMateria.get(m.id) ?? 0;
            const prova = d.provas.find((p) => p.materiaId === m.id && p.tipo === "prova");
            return (
              <li key={m.id} className="rounded-xl border border-borda bg-fundo-2/50 px-3 py-2.5" data-testid={`painel-${m.name}`}>
                <p className="flex min-w-0 items-center gap-2 text-sm">
                  <Ponto cor={m.color} />
                  <span className="truncate font-medium">{m.name}:</span>
                  <span className={cn("min-w-0 truncate", est.tom === "atencao" ? "text-alerta" : est.tom === "positivo" ? "text-ok" : "text-suave")}>{est.texto}.</span>
                </p>
                <p className="mt-1 text-xs text-suave">
                  Média <span className={cn("numero", media !== null && media >= m.targetAvg ? "text-ok" : "text-texto")}>{formatarNota(media)}</span> de alvo{" "}
                  <span className="numero">{formatarNota(m.targetAvg)}</span> · <span className="numero">{formatarMinutos(min)}</span> de {formatarMinutos(m.weeklyGoalMin)} nesta semana
                  {prova && <> · prova {contagem(diasEntre(hojeK, prova.dia))}</>}
                </p>
                <Barra pct={pct(min, m.weeklyGoalMin)} className="mt-2 h-1.5" cor={corHabito(m.color)} rotulo={`Estudo de ${m.name} na semana`} />
              </li>
            );
          })}
        </ul>
      </Cartao>

      <div className="grid grid-cols-1 gap-4 lg:col-span-2">
        <Cartao titulo="Provas e trabalhos" icone={CalendarClock} acao={<Link href="/estudos?aba=provas" className={classesBotao("fantasma", "p")}>Ver todos</Link>}>
          {d.provas.length === 0 ? (
            <p className="py-3 text-sm text-suave">Nada marcado. Use “Prova ou trabalho” para colocar na agenda.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {d.provas.slice(0, 4).map((p) => {
                const n = diasEntre(hojeK, p.dia);
                const feitos = p.checklist.filter((c) => c.feito).length;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="grid grid-cols-1 h-11 w-11 shrink-0 place-items-center rounded-xl border border-borda bg-painel-2 text-center">
                      <span className="numero font-display text-base font-bold leading-none">{n}</span>
                      <span className="text-[0.55rem] leading-none text-suave">{n === 1 ? "dia" : "dias"}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.titulo}</p>
                      <p className="truncate text-xs text-suave">
                        {p.tipo === "prova" ? "Prova" : "Trabalho"}
                        {p.materiaNome ? ` · ${p.materiaNome}` : ""} · {diaRelativo(p.dia, hojeK)}
                        {p.checklist.length > 0 && ` · checklist ${feitos}/${p.checklist.length}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Planejamento semanal" icone={Target}>
          <p className="text-sm text-suave">
            Meta da semana: <span className="numero text-texto">{formatarMinutos(d.metaSemana)}</span>; estudado:{" "}
            <span className="numero text-texto">{formatarMinutos(d.minutosSemana)}</span>.
          </p>
          <Barra pct={pct(d.minutosSemana, d.metaSemana)} className="my-3" rotulo="Estudo da semana" />
          <BotaoPlanejarSemana />
          <p className="mt-2 text-xs text-apagado">
            Cria tarefas de 45 min com o que falta de cada matéria (prioridade alta se houver prova em 7 dias). Depois,{" "}
            <Link href="/agenda?vista=tarefas" className="text-eletrico-claro hover:underline">
              encaixe nos horários livres
            </Link>
            .
          </p>
        </Cartao>
      </div>
    </div>
  );
}

// ───────────── Matérias e conteúdos ─────────────

export function AbaMaterias({ d, hojeK }: Props) {
  const ops = opcoes(d);
  return (
    <div className="grid grid-cols-1 gap-4">
      {!d.materias.length && <SemMaterias />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {d.materias.map((m) => {
          const cont = d.conteudos.filter((c) => c.subjectId === m.id);
          const concluidos = cont.filter((c) => c.status === "concluido").length;
          return (
            <Cartao
              key={m.id}
              titulo={
                <span className="flex min-w-0 items-center gap-2">
                  <Ponto cor={m.color} /> <span className="truncate">{m.name}</span>
                </span>
              }
              acao={
                <>
                  <Dialogo gatilho={<Pencil className="h-4 w-4" />} rotuloGatilho={`Editar ${m.name}`} classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8")} titulo="Editar matéria">
                    <FormMateria inicial={{ id: m.id, nome: m.name, cor: m.color, media: m.targetAvg, meta: m.weeklyGoalMin }} />
                  </Dialogo>
                  <form action={arquivarMateria}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="valor" value="1" />
                    <button className={classesBotao("fantasma", "icone", "h-8 w-8")} aria-label={`Arquivar ${m.name}`} title="Arquivar">
                      <Archive className="h-4 w-4" />
                    </button>
                  </form>
                </>
              }
            >
              <p className="mb-3 text-xs text-suave">
                Alvo <span className="numero text-texto">{formatarNota(m.targetAvg)}</span> · meta de {formatarMinutos(m.weeklyGoalMin)} por semana ·{" "}
                <span className="numero text-texto">{concluidos}</span> de {cont.length} conteúdo(s) concluído(s)
              </p>
              {cont.length > 0 && <Barra pct={pct(concluidos, cont.length)} className="mb-3 h-1.5" cor={corHabito(m.color)} rotulo={`Conteúdos concluídos de ${m.name}`} />}
              <ul className="grid grid-cols-1 gap-2">
                {cont.map((c) => (
                  <li key={c.id} className="rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={cn("break-words text-sm font-medium", c.status === "concluido" && "text-suave")}>{c.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
                          {c.difficulty && (
                            <Selo cor="#fbbf24">
                              <TriangleAlert className="h-3 w-3" aria-hidden /> dificuldade
                            </Selo>
                          )}
                          {c.status === "concluido" &&
                            (c.nextReview ? (
                              <span>
                                Revisão {Math.min(c.reviewStage + 1, INTERVALOS_REVISAO.length)} de {INTERVALOS_REVISAO.length}: {diaRelativo(dataParaChave(c.nextReview), hojeK).toLowerCase()}
                              </span>
                            ) : (
                              <span>revisões completas</span>
                            ))}
                        </p>
                        {c.difficulty && c.difficultyNote && <p className="mt-1 break-words text-xs text-alerta/90">{c.difficultyNote}</p>}
                      </div>
                      <Dialogo gatilho={<TriangleAlert className="h-4 w-4" />} rotuloGatilho={`Dificuldade em ${c.title}`} classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8")} titulo="Registro de dificuldade" descricao={c.title}>
                        <FormDificuldade id={c.id} dificil={c.difficulty} nota={c.difficultyNote} />
                      </Dialogo>
                      <BotaoLixeira acao={excluirConteudo} id={c.id} rotulo={`Excluir ${c.title}`} />
                    </div>
                    <div className="mt-2 flex rounded-lg border border-borda p-0.5" role="group" aria-label={`Status de ${c.title}`}>
                      {Object.entries(STATUS_CONTEUDO).map(([s, nome]) => (
                        <form key={s} action={mudarStatusConteudo} className="flex-1">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            aria-pressed={c.status === s}
                            aria-label={`${c.title}: ${nome}`}
                            className="w-full rounded-md py-1 text-xs text-suave transition aria-pressed:bg-eletrico/20 aria-pressed:text-texto"
                          >
                            {nome}
                          </button>
                        </form>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Dialogo gatilho={<><Plus className="h-4 w-4" /> Conteúdo</>} classeGatilho={classesBotao("contorno", "p")} titulo="Novo conteúdo">
                  <FormConteudo materias={ops} materia={m.id} />
                </Dialogo>
              </div>
            </Cartao>
          );
        })}
      </div>
      {d.arquivadas.length > 0 && (
        <details className="painel p-4">
          <summary className="cursor-pointer text-sm text-suave">Matérias arquivadas ({d.arquivadas.length})</summary>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {d.arquivadas.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <Ponto cor={m.color} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <form action={arquivarMateria}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="valor" value="0" />
                  <button className={classesBotao("fantasma", "p")}>
                    <ArchiveRestore className="h-4 w-4" /> Restaurar
                  </button>
                </form>
                <Dialogo
                  gatilho={<Trash2 className="h-4 w-4" />}
                  rotuloGatilho={`Excluir de vez ${m.name}`}
                  classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo"
                  titulo={`Excluir ${m.name}?`}
                  descricao="Apaga a matéria com os conteúdos e as notas. Sessões, provas e flashcards ficam, sem a matéria. Não dá para desfazer."
                >
                  <form action={excluirMateria}>
                    <input type="hidden" name="id" value={m.id} />
                    <BotaoEnvio variante="perigo" className="w-full" pendente="Excluindo…">
                      <Trash2 className="h-4 w-4" /> Excluir de vez
                    </BotaoEnvio>
                  </form>
                </Dialogo>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ───────────── Provas e trabalhos ─────────────

export function AbaProvas({ d, user, hojeK }: Props) {
  const ops = opcoes(d);
  const tz = user.timezone;
  const item = (p: DadosEstudos["provas"][number], passado = false) => {
    const n = diasEntre(hojeK, p.dia);
    const feitos = p.checklist.filter((c) => c.feito).length;
    return (
      <li key={p.id} className={cn("painel p-4", passado && "opacity-70")} data-testid={`prova-${p.titulo}`}>
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("grid grid-cols-1 h-14 w-14 shrink-0 place-items-center rounded-2xl border text-center", p.tipo === "prova" ? "border-perigo/40 bg-perigo/10" : "border-alerta/40 bg-alerta/10")}>
            <span className="numero font-display text-xl font-bold leading-none">{Math.abs(n)}</span>
            <span className="text-[0.6rem] leading-none text-suave">{n < 0 ? "dias atrás" : Math.abs(n) === 1 ? "dia" : "dias"}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <Selo cor={p.tipo === "prova" ? "#F43F5E" : "#F59E0B"}>{p.tipo === "prova" ? "Prova" : "Trabalho"}</Selo>
              {p.materiaNome && <span className="text-xs text-suave">{p.materiaNome}</span>}
            </p>
            <p className="mt-1 break-words font-medium">{p.titulo}</p>
            <p className="text-xs text-suave first-letter:uppercase">
              {diaRelativo(p.dia, hojeK)} · {contagem(n)}
              {!p.diaInteiro && ` · ${horaNoFuso(p.inicio, tz)}${p.fim ? `–${horaNoFuso(p.fim, tz)}` : ""}`}
            </p>
            {p.notas && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-suave">{p.notas}</p>}
          </div>
          <div className="flex shrink-0 items-center">
            <Dialogo gatilho={<Pencil className="h-4 w-4" />} rotuloGatilho={`Editar ${p.titulo}`} classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8")} titulo="Editar">
              <FormProva
                materias={ops}
                dia={p.dia}
                inicial={{ id: p.id, titulo: p.titulo, tipo: p.tipo, materia: p.materiaId, dia: p.dia, inicio: p.diaInteiro ? undefined : horaNoFuso(p.inicio, tz), fim: p.fim && !p.diaInteiro ? horaNoFuso(p.fim, tz) : undefined, notas: p.notas }}
              />
            </Dialogo>
            <BotaoLixeira acao={excluirProva} id={p.id} rotulo={`Excluir ${p.titulo}`} />
          </div>
        </div>
        {!passado && (
          <div className="mt-3 border-t border-borda pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-suave">
              <ListChecks className="h-3.5 w-3.5" aria-hidden /> Checklist antes {p.tipo === "prova" ? "da prova" : "da entrega"}
              {p.checklist.length > 0 && <span className="numero">({feitos}/{p.checklist.length})</span>}
            </p>
            <ul className="grid grid-cols-1 gap-1">
              {p.checklist.map((c) => (
                <li key={c.id} className="flex min-w-0 items-center gap-2">
                  <form action={alternarItemChecklist}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="valor" value={c.feito ? "0" : "1"} />
                    <button
                      aria-pressed={c.feito}
                      aria-label={`${c.feito ? "Desmarcar" : "Marcar"} "${c.texto}"`}
                      className={cn("grid grid-cols-1 h-6 w-6 place-items-center rounded-md border transition", c.feito ? "border-ok/50 bg-ok/20 text-ok" : "border-borda-forte hover:border-eletrico")}
                    >
                      {c.feito && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </form>
                  <span className={cn("min-w-0 flex-1 break-words text-sm", c.feito && "text-suave line-through decoration-suave/50")}>{c.texto}</span>
                  <form action={excluirItemChecklist}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded p-1 text-apagado hover:text-perigo" aria-label={`Tirar "${c.texto}" do checklist`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={adicionarItemChecklist} className="mt-2 flex gap-2">
              <input type="hidden" name="evento" value={p.id} />
              <input
                name="texto"
                maxLength={120}
                required
                placeholder="Novo item"
                aria-label={`Novo item do checklist de ${p.titulo}`}
                className="h-9 min-w-0 flex-1 rounded-lg border border-borda bg-fundo-2/80 px-3 text-sm outline-none focus:border-eletrico"
              />
              <BotaoEnvio variante="secundario" tamanho="p" className="h-9" aria-label="Adicionar item">
                <Plus className="h-4 w-4" />
              </BotaoEnvio>
            </form>
          </div>
        )}
      </li>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-suave">Provas e trabalhos ficam na agenda (Life Calendar), com a matéria e o checklist.</p>
        <Dialogo gatilho={<><CalendarPlus className="h-4 w-4" /> Prova ou trabalho</>} classeGatilho={classesBotao("primario")} titulo="Marcar prova ou trabalho">
          <FormProva materias={ops} dia={somaDias(hojeK, 7)} />
        </Dialogo>
      </div>
      {d.provas.length === 0 ? (
        <Cartao>
          <Vazio icone={CalendarClock} titulo="Nenhuma prova ou trabalho marcado" />
        </Cartao>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{d.provas.map((p) => item(p))}</ul>
      )}
      {d.provasPassadas.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-suave">Últimos 30 dias ({d.provasPassadas.length})</summary>
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">{[...d.provasPassadas].reverse().map((p) => item(p, true))}</ul>
        </details>
      )}
    </div>
  );
}

// ───────────── Pomodoro e horas estudadas ─────────────

export function AbaPomodoro({ d, user, hojeK }: Props) {
  const tz = user.timezone;
  const deHoje = d.sessoes.filter((s) => dataParaChave(s.day) === hojeK);
  const minHoje = deHoje.reduce((s, x) => s + x.durationMin, 0);
  const porDia = new Map<string, number>();
  for (const s of d.sessoes) porDia.set(dataParaChave(s.day), (porDia.get(dataParaChave(s.day)) ?? 0) + s.durationMin);
  const anteriores = d.sessoes.filter((s) => dataParaChave(s.day) < hojeK);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Cartao titulo="Pomodoro" icone={Timer} holo className="lg:col-span-3">
        <Pomodoro cfg={d.prefs} materias={opcoes(d)} />
      </Cartao>
      <Cartao
        titulo={`Hoje · ${formatarMinutos(minHoje)}`}
        icone={Check}
        className="lg:col-span-2"
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> À mão</>} classeGatilho={classesBotao("fantasma", "p")} titulo="Registrar horas estudadas">
            <FormSessao materias={opcoes(d)} hoje={hojeK} />
          </Dialogo>
        }
      >
        {deHoje.length === 0 ? (
          <p className="py-4 text-center text-sm text-suave">Nenhum estudo registrado hoje.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {deHoje.map((s) => (
              <li key={s.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2 text-sm">
                <span className="numero w-11 shrink-0 text-xs text-suave">{horaNoFuso(s.at, tz)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.subject?.name ?? "Sem matéria"}
                  <span className="text-suave"> · {TIPOS_SESSAO[s.kind] ?? s.kind}{s.topic ? ` · ${s.topic}` : ""}</span>
                </span>
                <span className="numero shrink-0 font-medium">{s.durationMin} min</span>
                <BotaoLixeira acao={excluirSessao} id={s.id} rotulo={`Apagar estudo das ${horaNoFuso(s.at, tz)}`} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao titulo="Horas estudadas (últimos dias)" icone={TrendingUp} className="lg:col-span-5">
        {anteriores.length === 0 ? (
          <p className="text-sm text-suave">O histórico aparece aqui conforme você registra.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {anteriores.slice(0, 20).map((s) => (
              <li key={s.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-suave">{diaCurto(dataParaChave(s.day))}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.subject?.name ?? "Sem matéria"} <span className="text-suave">· {TIPOS_SESSAO[s.kind] ?? s.kind}</span>
                </span>
                <span className="numero shrink-0">{s.durationMin} min</span>
                <BotaoLixeira acao={excluirSessao} id={s.id} rotulo={`Apagar estudo de ${diaCurto(dataParaChave(s.day))}`} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

// ───────────── Revisões e flashcards ─────────────

export function AbaRevisoes({ d, hojeK }: Props) {
  const ops = opcoes(d);
  const nome = (id: string | null) => d.materias.find((m) => m.id === id)?.name ?? d.arquivadas.find((m) => m.id === id)?.name ?? "";
  const proximas = d.conteudos
    .filter((c) => c.status === "concluido" && c.nextReview && dataParaChave(c.nextReview) > hojeK && dataParaChave(c.nextReview) <= somaDias(hojeK, 7))
    .sort((a, b) => a.nextReview!.getTime() - b.nextReview!.getTime());
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao titulo={`Revisões de hoje (${d.revisoesHoje.length})`} icone={Repeat}>
        {d.revisoesHoje.length === 0 ? (
          <p className="py-3 text-sm text-suave">Nenhuma revisão vencida. Ao concluir um conteúdo, as revisões entram aqui depois de 1, 3, 7, 14 e 30 dias.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {d.revisoesHoje.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-suave">
                    {nome(c.subjectId)} · revisão {c.reviewStage + 1} de {INTERVALOS_REVISAO.length}
                  </p>
                </div>
                <form action={revisarConteudo}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="registrar" value="1" />
                  <BotaoEnvio variante="contorno" tamanho="p" pendente="…" aria-label={`Revisei ${c.title}`}>
                    <Check className="h-4 w-4" /> Revisei
                  </BotaoEnvio>
                </form>
              </li>
            ))}
          </ul>
        )}
        {proximas.length > 0 && (
          <div className="mt-3 border-t border-borda pt-3">
            <p className="mb-1.5 text-xs font-medium text-suave">Próximos 7 dias</p>
            <ul className="grid grid-cols-1 gap-1 text-sm">
              {proximas.map((c) => (
                <li key={c.id} className="flex min-w-0 gap-2">
                  <span className="w-20 shrink-0 text-xs text-suave">{diaRelativo(dataParaChave(c.nextReview!), hojeK)}</span>
                  <span className="min-w-0 truncate">{c.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Cartao>

      <Cartao
        titulo={`Flashcards de hoje (${d.cartoesHoje.length})`}
        icone={Layers}
        holo
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Cartão</>} classeGatilho={classesBotao("fantasma", "p")} titulo="Novo flashcard">
            <FormFlashcard materias={ops} />
          </Dialogo>
        }
      >
        <RevisaoCartoes
          cartoes={d.cartoesHoje.map((c) => ({ id: c.id, frente: c.front, verso: c.back, caixa: c.box, materia: c.subject?.name ?? null }))}
          vazio={d.cartoes.length ? "Nenhum cartão para hoje. Volte amanhã!" : "Crie cartões de pergunta e resposta para revisar."}
        />
        <p className="mt-3 text-xs text-apagado">Caixas de Leitner: acertou, o cartão sobe de caixa e volta em 1, 2, 4, 8 ou 16 dias; errou, volta para a caixa 1.</p>
      </Cartao>

      {d.cartoes.length > 0 && (
        <details className="painel p-4 lg:col-span-2">
          <summary className="cursor-pointer text-sm text-suave">Todos os cartões ({d.cartoes.length})</summary>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {d.cartoes.map((c) => (
              <li key={c.id} className="flex min-w-0 items-start gap-2 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2" data-testid="cartao-flash">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{c.front}</p>
                  <p className="text-xs text-suave">
                    Caixa <span className="numero">{c.box}</span> · próxima: {diaRelativo(dataParaChave(c.due), hojeK).toLowerCase()}
                    {c.subject ? ` · ${c.subject.name}` : ""}
                  </p>
                </div>
                <Dialogo gatilho={<Pencil className="h-4 w-4" />} rotuloGatilho="Editar cartão" classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8")} titulo="Editar flashcard">
                  <FormFlashcard materias={ops} inicial={{ id: c.id, materia: c.subjectId, frente: c.front, verso: c.back }} />
                </Dialogo>
                <BotaoLixeira acao={excluirFlashcard} id={c.id} rotulo="Excluir cartão" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ───────────── Notas e quanto falta ─────────────

export function AbaNotas({ d, hojeK }: Props) {
  const ops = opcoes(d);
  if (!d.materias.length) return <SemMaterias />;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-suave">Notas com peso; o painel calcula a média e quanto falta para o alvo de cada matéria.</p>
        <Dialogo gatilho={<><Plus className="h-4 w-4" /> Nota</>} classeGatilho={classesBotao("primario")} titulo="Registrar nota">
          <FormNota materias={ops} hoje={hojeK} />
        </Dialogo>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {d.materias.map((m) => {
          const ns = d.notas.filter((n) => n.subjectId === m.id);
          const lista = ns.map((n) => ({ valor: n.value, max: n.maxValue, peso: n.weight }));
          const media = mediaPonderada(lista);
          return (
            <Cartao
              key={m.id}
              titulo={
                <span className="flex min-w-0 items-center gap-2">
                  <Ponto cor={m.color} /> <span className="truncate">{m.name}</span>
                </span>
              }
              acao={
                <Dialogo gatilho={<Plus className="h-4 w-4" />} rotuloGatilho={`Registrar nota de ${m.name}`} classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8")} titulo={`Nota de ${m.name}`}>
                  <FormNota materias={ops} materia={m.id} hoje={hojeK} />
                </Dialogo>
              }
            >
              <dl className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <dt className="rotulo">Média atual</dt>
                  <dd className={cn("numero mt-1 font-display text-2xl font-bold", media !== null && media >= m.targetAvg && "text-ok")}>{formatarNota(media)}</dd>
                </div>
                <div>
                  <dt className="rotulo">Alvo</dt>
                  <dd className="numero mt-1 font-display text-2xl font-bold">{formatarNota(m.targetAvg)}</dd>
                </div>
              </dl>
              <QuantoFalta notas={lista} alvo={m.targetAvg} idBase={m.id} />
              {ns.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-suave">
                      <tr>
                        <th className="py-1 font-medium">Avaliação</th>
                        <th className="py-1 font-medium">Nota</th>
                        <th className="py-1 font-medium">Peso</th>
                        <th className="py-1 font-medium">
                          <span className="sr-only">Apagar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="numero">
                      {ns.map((n) => (
                        <tr key={n.id} className="border-t border-borda">
                          <td className="max-w-[9rem] truncate py-1 pr-2">
                            {n.title}
                            {n.term && <span className="text-suave"> · {n.term}</span>}
                          </td>
                          <td className="py-1">
                            {formatarNota(n.value)}/{formatarNota(n.maxValue)}
                          </td>
                          <td className="py-1">{n.weight.toLocaleString("pt-BR")}</td>
                          <td className="py-1 text-right">
                            <BotaoLixeira acao={excluirNota} id={n.id} rotulo={`Apagar a nota ${n.title}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Cartao>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Simulados e resumos ─────────────

export function AbaSimulados({ d, hojeK }: Props) {
  const ops = opcoes(d);
  const recentes = d.simulados.slice(-12);
  const mediaPct = d.simulados.length ? Math.round(d.simulados.reduce((s, q) => s + pct(q.correct, q.total), 0) / d.simulados.length) : null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao
        titulo="Questões e simulados"
        icone={ClipboardCheck}
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Resultado</>} classeGatilho={classesBotao("fantasma", "p")} titulo="Registrar questões ou simulado">
            <FormSimulado materias={ops} hoje={hojeK} />
          </Dialogo>
        }
      >
        {d.simulados.length === 0 ? (
          <p className="py-3 text-sm text-suave">Registre listas de questões e simulados para ver a evolução do desempenho.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-suave">
              Média de acertos: <span className="numero text-texto">{mediaPct}%</span> em {d.simulados.length} registro(s).
            </p>
            {recentes.length >= 2 && (
              <>
                <GraficoSimulados
                  dados={recentes.map((q) => ({ rotulo: diaCurto(dataParaChave(q.day)), titulo: q.title, pct: pct(q.correct, q.total), acertos: `${q.correct} de ${q.total}` }))}
                />
              </>
            )}
            <details className="mt-3 text-sm" open={recentes.length < 2}>
              <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em lista</summary>
              <ul className="mt-2 grid grid-cols-1 gap-1.5">
                {[...d.simulados].reverse().map((q) => (
                  <li key={q.id} className="flex min-w-0 items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-suave">{diaCurto(dataParaChave(q.day))}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {q.title}
                      {q.subject ? <span className="text-suave"> · {q.subject.name}</span> : null}
                    </span>
                    <span className="numero shrink-0 text-xs">
                      {q.correct}/{q.total} · <span className="font-semibold">{pct(q.correct, q.total)}%</span>
                    </span>
                    <BotaoLixeira acao={excluirSimulado} id={q.id} rotulo={`Apagar ${q.title}`} />
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Cartao>

      <Cartao
        titulo="Resumos"
        icone={NotebookPen}
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Resumo</>} classeGatilho={classesBotao("fantasma", "p")} titulo="Novo resumo" larga>
            <FormResumo materias={ops} />
          </Dialogo>
        }
      >
        {d.resumos.length === 0 ? (
          <p className="py-3 text-sm text-suave">Escreva resumos por matéria para revisar antes das provas.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {d.resumos.map((r) => (
              <li key={r.id}>
                <details className="rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-eletrico-claro" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                    <span className="shrink-0 text-xs text-suave">{r.subject?.name ?? ""}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-suave">{r.body}</p>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <Dialogo gatilho={<><Pencil className="h-3.5 w-3.5" /> Editar</>} classeGatilho={classesBotao("fantasma", "p")} titulo="Editar resumo" larga>
                      <FormResumo materias={ops} inicial={{ id: r.id, materia: r.subjectId, titulo: r.title, texto: r.body }} />
                    </Dialogo>
                    <BotaoLixeira acao={excluirResumo} id={r.id} rotulo={`Apagar o resumo ${r.title}`} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

