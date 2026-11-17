// LIFE CALENDAR — agenda unificada (semana, mês, dia e tarefas com planejamento automático).
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Download, Focus, ListPlus, ListTodo, Wand2, Check } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarAgenda, itensDoDia, ocupadosDoDia } from "@/lib/servidor/dados";
import { db } from "@/lib/db";
import {
  chave, dataParaChave, diaDaSemana, diaPorExtenso, diaRelativo, diasNoMes, hoje, horaNoFuso, horaParaMinutos, inicioDaSemana,
  intervaloDeDias, nomeDiaCurto, nomeMes, somaDias, somaMeses, validaChave,
} from "@/lib/datas";
import { minutosLivres } from "@/lib/planejador";
import { CATEGORIAS_EVENTO, PRIORIDADES } from "@/lib/catalogo";
import { concluirTarefa } from "@/acoes/agenda";
import { CabecalhoPagina, Cartao, Vazio, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { FormEvento, FormTarefa } from "@/components/agenda/formularios";
import { ItemAgendaBotao, corItem } from "@/components/agenda/item";
import { Planejar } from "@/components/agenda/planejar";
import { cn } from "@/lib/cn";

export const metadata = { title: "Life Calendar" };

type Vista = "semana" | "mes" | "dia" | "tarefas";

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<{ vista?: string; dia?: string }> }) {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const sp = await searchParams;
  const vista: Vista = (["semana", "mes", "dia", "tarefas"] as const).find((v) => v === sp.vista) ?? "semana";
  const ref = sp.dia && validaChave(sp.dia) ? sp.dia : hojeK;

  const abas: { v: Vista; nome: string }[] = [
    { v: "semana", nome: "Semana" },
    { v: "mes", nome: "Mês" },
    { v: "dia", nome: "Dia" },
    { v: "tarefas", nome: "Tarefas" },
  ];

  return (
    <>
      <CabecalhoPagina
        rotulo="Life Calendar"
        titulo="Agenda"
        descricao="Provas, treinos, consultas, partidas, aniversários e tarefas num lugar só."
        acao={
          <>
            <Dialogo gatilho={<><CalendarPlus className="h-4 w-4" /> Evento</>} classeGatilho={classesBotao("primario")} titulo="Novo evento">
              <FormEvento dia={ref} />
            </Dialogo>
            <Dialogo gatilho={<><ListPlus className="h-4 w-4" /> Tarefa</>} titulo="Nova tarefa">
              <FormTarefa dia={ref} />
            </Dialogo>
            <Link href="/agenda/foco" className={classesBotao("secundario")}>
              <Focus className="h-4 w-4" /> Foco
            </Link>
            <a href="/api/exportar/agenda" download className={classesBotao("fantasma", "icone")} aria-label="Exportar agenda (.ics)" title="Exportar agenda (.ics)">
              <Download className="h-4 w-4" />
            </a>
          </>
        }
      />
      <nav aria-label="Visões da agenda" className="mb-4 flex w-full max-w-md rounded-xl border border-borda bg-fundo-2/60 p-1">
        {abas.map((a) => (
          <Link
            key={a.v}
            href={`/agenda?vista=${a.v}${a.v !== "tarefas" && ref !== hojeK ? `&dia=${ref}` : ""}`}
            aria-current={vista === a.v ? "page" : undefined}
            className="flex-1 rounded-lg py-1.5 text-center text-sm text-suave transition aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
          >
            {a.nome}
          </Link>
        ))}
      </nav>
      {vista === "semana" && <VistaSemana user={user} tz={tz} hojeK={hojeK} ref_={ref} />}
      {vista === "mes" && <VistaMes user={user} tz={tz} hojeK={hojeK} ref_={ref} />}
      {vista === "dia" && <VistaDia user={user} tz={tz} hojeK={hojeK} ref_={ref} />}
      {vista === "tarefas" && <VistaTarefas user={user} tz={tz} hojeK={hojeK} />}
    </>
  );
}

type PropsVista = { user: Awaited<ReturnType<typeof exigirUsuario>>; tz: string; hojeK: string; ref_: string };

function Navegacao({ anterior, proximo, titulo, vista }: { anterior: string; proximo: string; titulo: React.ReactNode; vista: Vista }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-lg font-semibold first-letter:uppercase">{titulo}</h2>
      <div className="flex items-center gap-1">
        <Link href={`/agenda?vista=${vista}&dia=${anterior}`} className={classesBotao("fantasma", "icone")} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link href={`/agenda?vista=${vista}`} className={classesBotao("secundario", "p")}>
          Hoje
        </Link>
        <Link href={`/agenda?vista=${vista}&dia=${proximo}`} className={classesBotao("fantasma", "icone")} aria-label="Próximo">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

async function VistaSemana({ user, tz, hojeK, ref_ }: PropsVista) {
  const ini = inicioDaSemana(ref_);
  const fim = somaDias(ini, 6);
  const itens = await carregarAgenda(user, ini, fim);
  const dias = intervaloDeDias(ini, fim);
  const [, mi, di] = ini.split("-").map(Number);
  const [, mf, df] = fim.split("-").map(Number);
  return (
    <>
      <Navegacao
        vista="semana"
        anterior={somaDias(ini, -7)}
        proximo={somaDias(ini, 7)}
        titulo={`${di} ${nomeMes(mi).slice(0, 3)} – ${df} ${nomeMes(mf).slice(0, 3)}`}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {dias.map((d) => {
          const doDia = itensDoDia(itens, d);
          return (
            <section key={d} className={cn("painel flex flex-col p-3 lg:min-h-64", doDia.length === 0 && "max-lg:flex-row max-lg:items-center max-lg:justify-between max-lg:py-2.5", d === hojeK && "holo")} aria-label={diaPorExtenso(d)}>
              <Link href={`/agenda?vista=dia&dia=${d}`} className={cn("flex items-baseline justify-between gap-2 hover:text-eletrico-claro", doDia.length === 0 ? "max-lg:justify-start max-lg:gap-3 lg:mb-2" : "mb-2")}>
                <span className="text-xs uppercase tracking-wider text-suave">{nomeDiaCurto(diaDaSemana(d))}</span>
                <span className={cn("numero font-display text-lg font-bold", d === hojeK && "text-eletrico-claro")}>{Number(d.slice(8))}</span>
              </Link>
              {doDia.length === 0 ? (
                <p className="text-xs text-apagado lg:mt-2">Livre</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1.5">
                  {doDia.map((i) => (
                    <li key={i.tipo + i.id + i.dia}>
                      <ItemAgendaBotao item={i} tz={tz} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

async function VistaMes({ user, tz, hojeK, ref_ }: PropsVista) {
  const [ano, mes] = ref_.split("-").map(Number);
  const primeiro = chave(ano, mes, 1);
  const ultimo = chave(ano, mes, diasNoMes(ano, mes));
  const ini = inicioDaSemana(primeiro);
  const fim = somaDias(inicioDaSemana(ultimo), 6);
  const itens = await carregarAgenda(user, ini, fim);
  const dias = intervaloDeDias(ini, fim);
  return (
    <>
      <Navegacao vista="mes" anterior={somaMeses(primeiro, -1)} proximo={somaMeses(primeiro, 1)} titulo={`${nomeMes(mes)} de ${ano}`} />
      <div className="painel overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] uppercase tracking-wider text-apagado">
          {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dias.map((d) => {
            const doDia = itensDoDia(itens, d);
            const fora = d.slice(5, 7) !== String(mes).padStart(2, "0");
            return (
              <Link
                key={d}
                href={`/agenda?vista=dia&dia=${d}`}
                className={cn(
                  "flex min-h-14 flex-col rounded-lg border border-transparent p-1 transition hover:border-borda-forte sm:min-h-24 sm:p-1.5",
                  fora && "opacity-40",
                  d === hojeK && "border-eletrico/60 bg-eletrico/10",
                )}
                aria-label={`${diaPorExtenso(d)}: ${doDia.length} item(ns)`}
              >
                <span className="numero text-xs font-semibold">{Number(d.slice(8))}</span>
                <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {doDia.slice(0, 3).map((i) => (
                    <span key={i.tipo + i.id} className="truncate rounded px-1 text-[0.68rem] leading-4" style={{ background: corItem(i) + "26", color: "#e2e8f0" }}>
                      {i.titulo}
                    </span>
                  ))}
                  {doDia.length > 3 && <span className="text-[0.65rem] text-suave">+{doDia.length - 3}</span>}
                </span>
                <span className="mt-auto flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                  {doDia.slice(0, 4).map((i) => (
                    <span key={i.tipo + i.id} className="h-1.5 w-1.5 rounded-full" style={{ background: corItem(i) }} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        {Object.values(CATEGORIAS_EVENTO).map((c) => (
          <li key={c.nome} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} aria-hidden /> {c.nome}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa]" aria-hidden /> Tarefa
        </li>
      </ul>
    </>
  );
}

async function VistaDia({ user, tz, hojeK, ref_ }: PropsVista) {
  const itens = await carregarAgenda(user, ref_, ref_);
  const doDia = itensDoDia(itens, ref_);
  const livres = minutosLivres(horaParaMinutos(user.dayStart), horaParaMinutos(user.dayEnd), ocupadosDoDia(itens, ref_, tz));
  return (
    <>
      <Navegacao vista="dia" anterior={somaDias(ref_, -1)} proximo={somaDias(ref_, 1)} titulo={diaPorExtenso(ref_, true)} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Cartao titulo={diaRelativo(ref_, hojeK)} icone={CalendarDays} className="lg:col-span-2">
          {doDia.length === 0 ? (
            <Vazio icone={CalendarDays} titulo="Nada marcado">Use os botões Evento ou Tarefa acima.</Vazio>
          ) : (
            <ol className="grid grid-cols-1 gap-2">
              {doDia.map((i) => (
                <li key={i.tipo + i.id} className="grid grid-cols-[4.5rem_1fr] items-start gap-3">
                  <span className="numero pt-2 text-right text-xs text-suave">{i.diaInteiro ? "Dia todo" : horaNoFuso(i.inicio, tz)}</span>
                  <ItemAgendaBotao item={i} tz={tz} />
                </li>
              ))}
            </ol>
          )}
        </Cartao>
        <Cartao titulo="Tempo livre" icone={Wand2}>
          <p className="numero font-display text-3xl font-bold">
            {Math.floor(livres / 60)}h{String(livres % 60).padStart(2, "0")}
          </p>
          <p className="mt-1 text-sm text-suave">
            livres entre {user.dayStart} e {user.dayEnd} (ajuste a janela do dia em Configurações).
          </p>
          {ref_ >= hojeK && (
            <Link href="/agenda?vista=tarefas" className={classesBotao("contorno", "p", "mt-4")}>
              <Wand2 className="h-4 w-4" /> Planejar tarefas
            </Link>
          )}
        </Cartao>
      </div>
    </>
  );
}

async function VistaTarefas({ user, tz, hojeK }: Omit<PropsVista, "ref_">) {
  const [pendentes, feitas] = await Promise.all([
    db.task.findMany({ where: { userId: user.id, done: false }, orderBy: [{ priority: "asc" }, { dueDay: "asc" }, { createdAt: "asc" }] }),
    db.task.findMany({ where: { userId: user.id, done: true }, orderBy: { doneAt: "desc" }, take: 10 }),
  ]);
  const semHorario = pendentes.filter((t) => !t.scheduledStart);
  const agendadas = pendentes.filter((t) => t.scheduledStart).sort((a, b) => a.scheduledStart!.getTime() - b.scheduledStart!.getTime());

  const Linha = ({ t }: { t: (typeof pendentes)[number] }) => (
    <li className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 px-3 py-2">
      <form action={concluirTarefa}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="feita" value={t.done ? "0" : "1"} />
        <button
          className={cn("grid grid-cols-1 h-7 w-7 place-items-center rounded-lg border transition", t.done ? "border-ok/40 bg-ok/15 text-ok" : "border-borda text-transparent hover:border-eletrico hover:text-suave")}
          aria-label={t.done ? `Reabrir "${t.title}"` : `Concluir "${t.title}"`}
        >
          <Check className="h-4 w-4" />
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", t.done && "text-suave line-through")}>{t.title}</p>
        <p className="numero text-xs text-suave">
          {t.durationMin} min · {PRIORIDADES[t.priority]}
          {t.dueDay && ` · prazo ${diaRelativo(dataParaChave(t.dueDay), hojeK).toLowerCase()}`}
          {t.scheduledStart && ` · ${diaRelativo(hoje(tz, t.scheduledStart), hojeK).toLowerCase()} ${horaNoFuso(t.scheduledStart, tz)}`}
        </p>
      </div>
      {t.dueDay && dataParaChave(t.dueDay) < hojeK && !t.done && <span className="text-xs text-perigo">atrasada</span>}
    </li>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao titulo="Planejamento automático" icone={Wand2} holo className="lg:col-span-2">
        <p className="mb-3 text-sm text-suave">
          O LIFE OS encaixa as tarefas sem horário nos espaços livres entre {user.dayStart} e {user.dayEnd}, respeitando aulas,
          compromissos e pausas. Prioridade alta e prazo mais perto vêm primeiro.
        </p>
        <Planejar hoje={hojeK} amanha={somaDias(hojeK, 1)} />
      </Cartao>
      <Cartao titulo={`Sem horário (${semHorario.length})`} icone={ListTodo}>
        {semHorario.length === 0 ? <p className="text-sm text-suave">Nenhuma tarefa esperando.</p> : <ul className="grid grid-cols-1 gap-2">{semHorario.map((t) => <Linha key={t.id} t={t} />)}</ul>}
      </Cartao>
      <Cartao titulo={`Agendadas (${agendadas.length})`} icone={CalendarDays}>
        {agendadas.length === 0 ? <p className="text-sm text-suave">Nada agendado.</p> : <ul className="grid grid-cols-1 gap-2">{agendadas.map((t) => <Linha key={t.id} t={t} />)}</ul>}
      </Cartao>
      {feitas.length > 0 && (
        <Cartao titulo="Concluídas recentemente" icone={Check} className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{feitas.map((t) => <Linha key={t.id} t={t} />)}</ul>
        </Cartao>
      )}
    </div>
  );
}
