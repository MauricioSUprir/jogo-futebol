// CENTRAL DE COMANDO — a página inicial.
import Link from "next/link";
import {
  ArrowRight, CalendarClock, CalendarDays, CheckCircle2, Droplets, Flame, Focus, Lightbulb, ListTodo, SlidersHorizontal,
  Sparkles, Trophy, Wand2,
} from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { aguaDoPeriodo, carregarAgenda, carregarHabitos, itensDoDia } from "@/lib/servidor/dados";
import { db } from "@/lib/db";
import { diaPorExtenso, diaRelativo, diasEntre, hoje, horaNoFuso, intervaloDeDias, minutosNoFuso, nomeDiaCurto, diaDaSemana, saudacao, somaDias } from "@/lib/datas";
import { feito, programado } from "@/lib/habitos";
import { formatarMl } from "@/lib/agua";
import { calcularXp, gerarInsights, nivel } from "@/lib/insights";
import { CARTOES_PAINEL, categoriaEvento, type CartaoPainel } from "@/lib/catalogo";
import { Anel } from "@/components/anel";
import { Barra, Cartao, Vazio, classesBotao } from "@/components/ui";
import { Atualizador, BotaoEnvio, Dialogo, Relogio } from "@/components/cliente";
import { LinhaHabito } from "@/components/habitos/linha";
import { GraficoSemana } from "@/components/graficos";
import { PersonalizarPainel } from "@/components/painel/personalizar";
import { adicionarAgua } from "@/acoes/agua";
import { CartaoPainelCheckin } from "@/components/checkin/cartao-painel";
import { CartaoPainelTreinos } from "@/components/treinos/cartao-painel";
import { CartaoPainelSono } from "@/components/sono/cartao-painel";
import { CartaoPainelSaude } from "@/components/saude/cartao-painel";
import { CartaoPainelMente } from "@/components/mente/cartao-painel";
import { CartaoPainelAlimentacao } from "@/components/alimentacao/cartao-painel";
import { CartaoPainelEstudos } from "@/components/estudos/cartao-painel";
import { CartaoPainelMetas } from "@/components/metas/cartao-painel";
import { insightsTreinos } from "@/lib/servidor/treinos";
import { insightsSono } from "@/lib/servidor/sono";
import { insightsSaude } from "@/lib/servidor/saude";
import { insightsMente } from "@/lib/servidor/mente";
import { insightsAlimentacao } from "@/lib/servidor/alimentacao";
import { insightsEstudos } from "@/lib/servidor/estudos";
import { insightsMetas } from "@/lib/servidor/metas";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/cn";

export const metadata = { title: "Central de Comando" };

export default async function CentralDeComando() {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const agoraMin = minutosNoFuso(new Date(), tz);

  // Insights dos módulos: um módulo com problema não derruba o painel.
  const seguro = (p: Promise<Insight[]>) => p.catch(() => [] as Insight[]);
  const [agua, habitos, agenda, tarefasFeitas, tarefasPendentes, contagens, insightsModulos] = await Promise.all([
    aguaDoPeriodo(user, somaDias(hojeK, -400), hojeK),
    carregarHabitos(user, hojeK),
    carregarAgenda(user, hojeK, somaDias(hojeK, 7)),
    db.task.count({ where: { userId: user.id, done: true } }),
    db.task.count({ where: { userId: user.id, done: false, scheduledStart: null } }),
    Promise.all([
      db.activity.count({ where: { userId: user.id } }),
      db.studySession.count({ where: { userId: user.id } }),
      db.goal.count({ where: { userId: user.id, status: "concluido" } }),
      db.dailyCheckin.count({ where: { userId: user.id } }),
      db.sleepLog.count({ where: { userId: user.id } }),
    ]),
    Promise.all(
      [insightsTreinos, insightsSono, insightsEstudos, insightsMetas, insightsMente, insightsAlimentacao, insightsSaude].map((f) => seguro(f(user, hojeK))),
    ),
  ]);
  const [atividades, sessoesEstudo, metasConcluidas, checkins, noites] = contagens;

  // ───── números do dia ─────
  const diaAgua = agua.resumo[agua.resumo.length - 1];
  const pctAgua = diaAgua.meta ? Math.round((diaAgua.aguaMl / diaAgua.meta) * 100) : 0;
  const deHoje = habitos.filter((h) => programado(h.def, hojeK) || h.hoje.status === "feito");
  const feitosHoje = deHoje.filter((h) => h.hoje.status === "feito").length;
  const contaveis = deHoje.filter((h) => h.hoje.status !== "descanso").length;
  const pctHabitos = contaveis ? Math.round((feitosHoje / contaveis) * 100) : 0;
  const itensHoje = itensDoDia(agenda, hojeK);
  const proximos = agenda.filter(
    (i) => i.tipo === "evento" && i.dia > hojeK && ["prova", "trabalho", "consulta", "aniversario", "partida", "evento", "meta"].includes(i.categoria),
  );
  const melhorSeq = Math.max(0, ...habitos.filter((h) => h.sequencia.unidade === "dias").map((h) => h.sequencia.valor));

  // ───── semana ─────
  const ultimos7 = intervaloDeDias(somaDias(hojeK, -6), hojeK);
  const resumoPorDia = new Map(agua.resumo.map((d) => [d.dia, d]));
  const semana = ultimos7.map((d) => {
    const prog = habitos.filter((h) => programado(h.def, d) && !h.regs.get(d)?.skipped);
    const f = prog.filter((h) => feito(h.def, h.regs.get(d))).length;
    const a = resumoPorDia.get(d)!;
    return {
      dia: d === hojeK ? "hoje" : nomeDiaCurto(diaDaSemana(d)),
      habitos: prog.length ? Math.round((f / prog.length) * 100) : 0,
      agua: a.meta ? Math.min(100, Math.round((a.aguaMl / a.meta) * 100)) : 0,
    };
  });
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const aguaSemana = media(agua.resumo.slice(-8, -1).map((d) => d.aguaMl));
  const aguaAnterior = media(agua.resumo.slice(-15, -8).map((d) => d.aguaMl));

  // ───── insights e nível ─────
  const insights = gerarInsights({
    agua7: agua.resumo.slice(-8, -1),
    aguaAnterior7: agua.resumo.slice(-15, -8),
    habitos: habitos.map((h) => ({ nome: h.habito.name, pct30: h.taxa30.pct, esperados30: h.taxa30.esperados, sequencia: h.sequencia.unidade === "dias" ? h.sequencia.valor : 0 })),
    // A prova que o Study Center já comenta (com o checklist) não se repete aqui.
    provasProximas: agenda
      .filter((i) => i.tipo === "evento" && i.categoria === "prova" && i.dia >= hojeK)
      .filter((i) => !insightsModulos.flat().some((m) => m.texto.includes(i.titulo)))
      .map((i) => ({ titulo: i.titulo, dias: diasEntre(hojeK, i.dia) })),
  });
  // Primeiro os avisos de atenção (ex.: descanso), depois os positivos; no máximo 6.
  const peso = { atencao: 0, positivo: 1, neutro: 2 } as Record<string, number>;
  const todosInsights = [...insightsModulos.flat(), ...insights]
    .map((i, k) => ({ i, k }))
    .sort((a, b) => (peso[a.i.tom] ?? 3) - (peso[b.i.tom] ?? 3) || a.k - b.k)
    .map((x) => x.i)
    .slice(0, 6);
  const xp = calcularXp({
    habitos: habitos.reduce((s, h) => s + h.total, 0),
    diasMetaAgua: agua.resumo.filter((d) => d.bateu).length,
    tarefas: tarefasFeitas,
    atividades,
    sessoesEstudo,
    metasConcluidas,
    checkins,
    noites,
  });
  const lv = nivel(xp);

  // ───── preferências do painel ─────
  const prefs = (user.prefs ?? {}) as { painel?: { ordem?: string[]; ocultos?: string[] } };
  const ordem = [...new Set([...(prefs.painel?.ordem ?? []), ...CARTOES_PAINEL])].filter((c): c is CartaoPainel =>
    (CARTOES_PAINEL as readonly string[]).includes(c),
  );
  const ocultos = (prefs.painel?.ocultos ?? []).filter((c): c is CartaoPainel => (CARTOES_PAINEL as readonly string[]).includes(c));

  const botoesAgua = [
    { ml: agua.cfg.glassMl, rotulo: `+${agua.cfg.glassMl} ml`, tipo: "copo" },
    ...agua.cfg.quickAmounts.filter((q) => q !== agua.cfg.glassMl).slice(0, 2).map((ml) => ({ ml, rotulo: `+${ml} ml`, tipo: "rapido" })),
  ];

  const cartoes: Record<CartaoPainel, React.ReactNode> = {
    agua: (
      <Cartao key="agua" titulo="Hydro Track" icone={Droplets} holo acao={<Link href="/agua" className={classesBotao("fantasma", "p")}>Abrir <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        <div className="flex items-center gap-4">
          <Anel pct={pctAgua} tamanho={112} rotulo={`${pctAgua}% da meta de água`}>
            <div>
              <p className="numero font-display text-2xl font-bold">{pctAgua}%</p>
              <p className="text-[0.65rem] text-suave">da meta</p>
            </div>
          </Anel>
          <div className="min-w-0 flex-1">
            <p className="numero font-display text-xl font-semibold">{formatarMl(diaAgua.aguaMl)}</p>
            <p className="text-sm text-suave">de {formatarMl(diaAgua.meta)} · {diaAgua.copos} {diaAgua.copos === 1 ? "registro" : "registros"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {botoesAgua.map((b) => (
                <form key={b.rotulo} action={adicionarAgua}>
                  <input type="hidden" name="ml" value={b.ml} />
                  <input type="hidden" name="tipo" value={b.tipo} />
                  <BotaoEnvio variante="secundario" tamanho="p" pendente="…">
                    {b.rotulo}
                  </BotaoEnvio>
                </form>
              ))}
            </div>
          </div>
        </div>
      </Cartao>
    ),
    habitos: (
      <Cartao
        key="habitos"
        titulo="Hábitos de hoje"
        icone={Flame}
        acao={<span className="numero text-sm text-suave">{feitosHoje}/{contaveis}</span>}
        className="lg:row-span-2"
      >
        {habitos.length === 0 ? (
          <Vazio icone={Flame} titulo="Nenhum hábito ainda">
            <Link href="/habitos" className="text-eletrico-claro hover:underline">Criar os primeiros hábitos</Link>
          </Vazio>
        ) : (
          <>
            <Barra pct={pctHabitos} className="mb-3" rotulo="Hábitos de hoje concluídos" />
            <ul className="grid grid-cols-1 gap-2">
              {deHoje.map((h) => (
                <LinhaHabito key={h.habito.id} h={h} compacto />
              ))}
            </ul>
            {deHoje.length < habitos.length && (
              <p className="mt-2 text-xs text-apagado">{habitos.length - deHoje.length} hábito(s) não programado(s) para hoje.</p>
            )}
          </>
        )}
      </Cartao>
    ),
    agenda: (
      <Cartao
        key="agenda"
        titulo="Agenda de hoje"
        icone={CalendarDays}
        acao={
          <>
            <Link href="/agenda/foco" className={classesBotao("fantasma", "p", "px-2")} title="Modo foco" aria-label="Modo foco">
              <Focus className="h-4 w-4" />
            </Link>
            <Link href="/agenda?vista=tarefas" className={classesBotao("fantasma", "p", "px-2")} title="Planejar o dia" aria-label="Planejar o dia">
              <Wand2 className="h-4 w-4" />
            </Link>
          </>
        }
      >
        {itensHoje.length === 0 ? (
          <Vazio icone={CalendarDays} titulo="Nada marcado para hoje">
            {tarefasPendentes > 0 ? `${tarefasPendentes} tarefa(s) esperando horário.` : "Dia livre."}
          </Vazio>
        ) : (
          <ol className="relative grid grid-cols-1 gap-2 border-l border-borda pl-4">
            {itensHoje.map((i) => {
              const fimMin = i.fim ? minutosNoFuso(i.fim, tz) : null;
              const passou = !i.diaInteiro && fimMin !== null && i.diaFim === hojeK && fimMin < agoraMin;
              const agora = !i.diaInteiro && !passou && minutosNoFuso(i.inicio, tz) <= agoraMin && (fimMin === null || fimMin >= agoraMin) && i.dia === hojeK;
              const cor = i.tipo === "tarefa" ? "#a78bfa" : categoriaEvento(i.categoria).cor;
              return (
                <li key={i.tipo + i.id + i.dia} className={cn("relative", passou && "opacity-50")}>
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-painel" style={{ background: cor }} aria-hidden />
                  <p className="numero text-xs text-suave">
                    {i.diaInteiro ? "Dia inteiro" : `${horaNoFuso(i.inicio, tz)}${i.fim ? ` – ${horaNoFuso(i.fim, tz)}` : ""}`}
                    {agora && <span className="ml-2 rounded-full bg-eletrico/20 px-1.5 py-px text-[0.65rem] font-semibold text-eletrico-claro">AGORA</span>}
                  </p>
                  <p className={cn("text-sm font-medium", i.concluida && "line-through text-suave")}>{i.titulo}</p>
                </li>
              );
            })}
          </ol>
        )}
      </Cartao>
    ),
    proximos: (
      <Cartao key="proximos" titulo="Próximos 7 dias" icone={CalendarClock} acao={<Link href="/agenda" className={classesBotao("fantasma", "p")}>Agenda <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        {proximos.length === 0 ? (
          <p className="py-4 text-center text-sm text-suave">Nenhuma prova, consulta ou evento marcado.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {proximos.slice(0, 6).map((i) => {
              const c = categoriaEvento(i.categoria);
              const n = diasEntre(hojeK, i.dia);
              return (
                <li key={i.id + i.dia} className="flex items-center gap-3">
                  <span className="grid grid-cols-1 h-10 w-10 shrink-0 place-items-center rounded-xl border text-center" style={{ borderColor: c.cor + "55", background: c.cor + "14" }}>
                    <span className="numero font-display text-sm font-bold leading-none">{n}</span>
                    <span className="sr-only">dias</span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.titulo}</p>
                    <p className="text-xs text-suave">
                      {c.nome} · {diaRelativo(i.dia, hojeK)}
                      {!i.diaInteiro && ` · ${horaNoFuso(i.inicio, tz)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    ),
    semana: (
      <Cartao key="semana" titulo="Sua semana" icone={Trophy}>
        <GraficoSemana dados={semana} />
        <p className="mt-3 text-xs text-suave">
          Água: média de <span className="numero text-texto">{formatarMl(aguaSemana)}</span>/dia nos últimos 7 dias
          {aguaAnterior > 0 && (
            <>
              {" "}(semana anterior: <span className="numero text-texto">{formatarMl(aguaAnterior)}</span>)
            </>
          )}
          .
        </p>
      </Cartao>
    ),
    insights: (
      <Cartao key="insights" titulo="Smart Insights" icone={Lightbulb}>
        {todosInsights.length === 0 ? (
          <p className="py-3 text-sm text-suave">Registre alguns dias de água, hábitos, sono e treinos e os padrões aparecem aqui.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {todosInsights.map((i, k) => (
              <li key={k} className="flex gap-2 text-sm">
                <Sparkles
                  className={cn("mt-0.5 h-4 w-4 shrink-0", i.tom === "positivo" ? "text-ok" : i.tom === "atencao" ? "text-alerta" : "text-eletrico-claro")}
                  aria-hidden
                />
                <span>{i.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    ),
    checkin: <CartaoPainelCheckin key="checkin" user={user} hojeK={hojeK} />,
    treinos: <CartaoPainelTreinos key="treinos" user={user} hojeK={hojeK} />,
    estudos: <CartaoPainelEstudos key="estudos" user={user} hojeK={hojeK} />,
    sono: <CartaoPainelSono key="sono" user={user} hojeK={hojeK} />,
    metas: <CartaoPainelMetas key="metas" user={user} hojeK={hojeK} />,
    alimentacao: <CartaoPainelAlimentacao key="alimentacao" user={user} hojeK={hojeK} />,
    mente: <CartaoPainelMente key="mente" user={user} hojeK={hojeK} />,
    saude: <CartaoPainelSaude key="saude" user={user} hojeK={hojeK} />,
  };

  const kpis = [
    { rotulo: "Água", valor: `${pctAgua}%`, detalhe: formatarMl(diaAgua.aguaMl), icone: Droplets, pct: pctAgua },
    { rotulo: "Hábitos", valor: `${feitosHoje}/${contaveis}`, detalhe: `${pctHabitos}% do dia`, icone: CheckCircle2, pct: pctHabitos },
    { rotulo: "Agenda", valor: String(itensHoje.length), detalhe: `${tarefasPendentes} tarefa(s) sem horário`, icone: ListTodo },
    { rotulo: "Sequência", valor: `${melhorSeq}`, detalhe: melhorSeq === 1 ? "dia seguido" : "dias seguidos", icone: Flame },
  ];

  return (
    <>
      <Atualizador />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-entrar">
        <div className="min-w-0">
          <p className="rotulo mb-1">Central de Comando</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {saudacao(agoraMin)}, <span className="texto-holo">{user.displayName}</span>
          </h1>
          <p className="mt-1 text-sm text-suave first-letter:uppercase">
            {diaPorExtenso(hojeK)} · <Relogio fuso={tz} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="painel flex items-center gap-3 px-3 py-2" title={`${xp} XP`}>
            <Trophy className="h-4 w-4 text-alerta" aria-hidden />
            <div className="w-28">
              <p className="numero text-xs font-semibold">Nível {lv.nivel} · {xp} XP</p>
              <Barra pct={lv.pct} cor="linear-gradient(90deg,#2563eb,#7c3aed)" className="mt-1 h-1.5" rotulo="Progresso até o próximo nível" />
            </div>
          </div>
          <Dialogo
            gatilho={<SlidersHorizontal className="h-4 w-4" />}
            rotuloGatilho="Personalizar o painel"
            classeGatilho={classesBotao("secundario", "icone")}
            titulo="Personalizar o painel"
            descricao="Escolha os cartões e a ordem."
          >
            <PersonalizarPainel ordem={ordem} ocultos={ocultos} />
          </Dialogo>
        </div>
      </header>

      <section aria-label="Resumo do dia" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.rotulo} className="painel p-3.5 animate-entrar sm:p-4">
            <p className="rotulo flex items-center gap-1.5">
              <k.icone className="h-3.5 w-3.5 text-eletrico-claro" aria-hidden /> {k.rotulo}
            </p>
            <p className="numero mt-1.5 font-display text-2xl font-bold">{k.valor}</p>
            <p className="truncate text-xs text-suave">{k.detalhe}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {ordem.filter((c) => !ocultos.includes(c)).map((c) => cartoes[c])}
      </div>
    </>
  );
}
