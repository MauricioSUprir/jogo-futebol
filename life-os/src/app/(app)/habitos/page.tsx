// HABIT TRACKER — hábitos do dia, sequências e estatísticas.
import Link from "next/link";
import { Archive, ArrowDown, ArrowUp, Flame, Plus, Sparkles, Target } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarHabitos } from "@/lib/servidor/dados";
import { diaDaSemana, hoje, nomeDiaCurto } from "@/lib/datas";
import { arquivarHabito, criarSugestoes, moverHabito } from "@/acoes/habitos";
import { SUGESTOES_HABITO } from "@/lib/catalogo";
import { CabecalhoPagina, Cartao, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormHabito } from "@/components/habitos/form";
import { BotaoMarcar, StatusHoje } from "@/components/habitos/linha";
import { IconeHabito } from "@/components/icone-habito";
import { textoFrequencia, type StatusDia } from "@/lib/habitos";
import { cn } from "@/lib/cn";

export const metadata = { title: "Habit Tracker" };

const COR_STATUS: Record<StatusDia, string> = {
  feito: "bg-ok",
  parcial: "bg-alerta/70",
  descanso: "bg-violeta-claro/60",
  pendente: "bg-white/8",
  livre: "bg-transparent border border-borda",
};

export default async function PaginaHabitos() {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const todos = await carregarHabitos(user, hojeK, { incluirArquivados: true });
  const ativos = todos.filter((h) => !h.habito.archived);
  const arquivados = todos.filter((h) => h.habito.archived);
  const media30 = ativos.length ? Math.round(ativos.reduce((s, h) => s + h.taxa30.pct, 0) / ativos.length) : 0;
  const feitosHoje = ativos.filter((h) => h.hoje.status === "feito").length;

  return (
    <>
      <CabecalhoPagina
        rotulo="Habit Tracker"
        titulo="Hábitos"
        descricao="Sequências são só motivação: perder um dia não tira nada de você."
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Novo hábito</>} classeGatilho={classesBotao("primario")} titulo="Novo hábito">
            <FormHabito />
          </Dialogo>
        }
      />

      {ativos.length === 0 ? (
        <Cartao titulo="Comece com sugestões" icone={Sparkles} holo>
          <form action={criarSugestoes} className="grid grid-cols-1 gap-3">
            <p className="text-sm text-suave">Escolha os que fazem sentido para a sua rotina. Dá para editar tudo depois.</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGESTOES_HABITO.map((s, i) => (
                <li key={s.name}>
                  <label className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 p-3 text-sm has-[:checked]:border-eletrico has-[:checked]:bg-eletrico/10">
                    <input type="checkbox" name="s" value={i} defaultChecked className="h-4 w-4 accent-[#2563eb]" />
                    <IconeHabito icone={s.icon} cor={s.color} tamanho="p" />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
            <BotaoEnvio className="justify-self-start" pendente="Criando…">Criar hábitos escolhidos</BotaoEnvio>
          </form>
        </Cartao>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-3 gap-3">
            {[
              { r: "Hoje", v: `${feitosHoje}/${ativos.length}` },
              { r: "Média 30 dias", v: `${media30}%` },
              { r: "Maior sequência", v: `${Math.max(0, ...ativos.map((h) => h.melhor.valor))}` },
            ].map((k) => (
              <div key={k.r} className="painel p-4">
                <p className="rotulo">{k.r}</p>
                <p className="numero mt-1 font-display text-2xl font-bold">{k.v}</p>
              </div>
            ))}
          </section>

          <ul className="grid grid-cols-1 gap-3">
            {ativos.map((h, idx) => (
              <li key={h.habito.id} className="painel flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
                <IconeHabito icone={h.habito.icon} cor={h.habito.color} />
                <div className="min-w-0 flex-1">
                  <Link href={`/habitos/${h.habito.id}`} className="block truncate font-medium hover:text-eletrico-claro">
                    {h.habito.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-suave">
                    <StatusHoje h={h} />
                    <span>{h.habito.source === "agua" ? "Pela meta de água" : textoFrequencia(h.def)}</span>
                    {h.semana && <span className="numero">{h.semana.feitos}/{h.semana.meta} na semana</span>}
                  </div>
                </div>
                <div className="order-last flex w-full items-center gap-4 sm:order-none sm:w-auto">
                  <div className="flex gap-1" aria-label="Últimos 7 dias">
                    {h.ultimos7.map((d) => (
                      <span key={d.dia} className="flex flex-col items-center gap-1">
                        <span className={cn("h-5 w-5 rounded-md", COR_STATUS[d.status])} title={`${d.dia}: ${d.status}`} />
                        <span className="text-[0.6rem] text-apagado">{nomeDiaCurto(diaDaSemana(d.dia)).slice(0, 1)}</span>
                      </span>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="numero flex items-center justify-end gap-1 text-sm font-semibold text-alerta">
                      <Flame className="h-4 w-4" aria-hidden /> {h.sequencia.valor}
                    </p>
                    <p className="numero text-[0.7rem] text-suave">{h.taxa30.pct}% · 30d</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="hidden flex-col sm:flex">
                    <form action={moverHabito}>
                      <input type="hidden" name="id" value={h.habito.id} />
                      <input type="hidden" name="dir" value="cima" />
                      <button disabled={idx === 0} className="rounded p-0.5 text-apagado hover:text-texto disabled:opacity-20" aria-label={`Subir ${h.habito.name}`}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <form action={moverHabito}>
                      <input type="hidden" name="id" value={h.habito.id} />
                      <input type="hidden" name="dir" value="baixo" />
                      <button disabled={idx === ativos.length - 1} className="rounded p-0.5 text-apagado hover:text-texto disabled:opacity-20" aria-label={`Descer ${h.habito.name}`}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                  <BotaoMarcar h={h} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ok" /> Feito</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-alerta/70" /> Parcial</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violeta-claro/60" /> Descanso</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-white/8" /> Não feito</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-borda" /> Não programado</span>
          </p>
        </>
      )}

      {arquivados.length > 0 && (
        <Cartao titulo="Arquivados" icone={Archive} className="mt-6">
          <ul className="grid grid-cols-1 gap-2">
            {arquivados.map((h) => (
              <li key={h.habito.id} className="flex items-center gap-3">
                <IconeHabito icone={h.habito.icon} cor={h.habito.color} tamanho="p" />
                <Link href={`/habitos/${h.habito.id}`} className="flex-1 truncate text-sm text-suave hover:text-texto">
                  {h.habito.name}
                </Link>
                <form action={arquivarHabito}>
                  <input type="hidden" name="id" value={h.habito.id} />
                  <input type="hidden" name="arquivar" value="0" />
                  <button className={classesBotao("fantasma", "p")}>
                    <Target className="h-3.5 w-3.5" /> Reativar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}
