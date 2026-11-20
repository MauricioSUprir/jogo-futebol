// Detalhe do hábito: calendário, sequências, conquistas e edição.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Award, CalendarDays, ChevronLeft, ChevronRight, Coffee, Flame, Pencil, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarHabitos } from "@/lib/servidor/dados";
import { chave, diaDaSemana, diasEntre, diasNoMes, hoje, nomeMes, somaMeses } from "@/lib/datas";
import { MARCOS_SEQUENCIA, proximoMarco, statusDoDia, taxaConclusao, textoFrequencia } from "@/lib/habitos";
import { arquivarHabito, excluirHabito, marcarHabito } from "@/acoes/habitos";
import { CabecalhoPagina, Cartao, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { FormHabito } from "@/components/habitos/form";
import { IconeHabito } from "@/components/icone-habito";
import { cn } from "@/lib/cn";
import { somaDias } from "@/lib/datas";

export const metadata = { title: "Hábito" };

export default async function PaginaHabito({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const user = await exigirUsuario();
  const { id } = await params;
  const hojeK = hoje(user.timezone);
  const [h] = await carregarHabitos(user, hojeK, { id, incluirArquivados: true });
  if (!h) notFound();

  const mesPedido = (await searchParams).mes;
  const base = mesPedido && /^\d{4}-\d{2}$/.test(mesPedido) ? `${mesPedido}-01` : hojeK.slice(0, 8) + "01";
  const [ano, mes] = base.split("-").map(Number);
  const total = diasNoMes(ano, mes);
  const vazios = (diaDaSemana(base) + 6) % 7; // semana começa na segunda
  const dias = Array.from({ length: total }, (_, i) => chave(ano, mes, i + 1));
  const taxa90 = taxaConclusao(h.def, h.regs, somaDias(hojeK, -89), hojeK, hojeK);
  const unidade = h.sequencia.unidade === "semanas" ? "semanas" : "dias";
  const prox = proximoMarco(h.melhor.valor);
  const agua = h.habito.source === "agua";

  return (
    <>
      <Link href="/habitos" className={classesBotao("fantasma", "p", "-ml-2 mb-2")}>
        <ArrowLeft className="h-4 w-4" /> Hábitos
      </Link>
      <CabecalhoPagina
        rotulo={agua ? "Pela meta de água" : textoFrequencia(h.def)}
        titulo={
          <span className="flex items-center gap-3">
            <IconeHabito icone={h.habito.icon} cor={h.habito.color} tamanho="g" /> {h.habito.name}
          </span>
        }
        acao={
          <>
            <Dialogo gatilho={<><Pencil className="h-4 w-4" /> Editar</>} titulo="Editar hábito">
              <FormHabito
                inicial={{
                  id: h.habito.id,
                  nome: h.habito.name,
                  icone: h.habito.icon,
                  cor: h.habito.color,
                  frequencia: h.habito.frequency,
                  weekdays: h.habito.weekdays,
                  vezesSemana: h.habito.timesPerWeek,
                  metaDia: h.habito.targetPerDay,
                  agua,
                }}
              />
            </Dialogo>
            <form action={arquivarHabito}>
              <input type="hidden" name="id" value={h.habito.id} />
              <input type="hidden" name="arquivar" value={h.habito.archived ? "0" : "1"} />
              <button className={classesBotao("secundario")}>
                <Archive className="h-4 w-4" /> {h.habito.archived ? "Reativar" : "Arquivar"}
              </button>
            </form>
            <Dialogo gatilho={<Trash2 className="h-4 w-4" />} rotuloGatilho="Excluir hábito" classeGatilho={classesBotao("perigo", "icone")} titulo="Excluir hábito?" descricao="Apaga o hábito e todo o histórico dele. Arquivar guarda o histórico.">
              <form action={excluirHabito} className="flex justify-end gap-2">
                <input type="hidden" name="id" value={h.habito.id} />
                <button className={classesBotao("perigo")}>Excluir para sempre</button>
              </form>
            </Dialogo>
          </>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { r: "Sequência atual", v: `${h.sequencia.valor} ${unidade}`, i: Flame },
          { r: "Melhor sequência", v: `${h.melhor.valor} ${unidade}`, i: Award },
          { r: "Conclusão 30 dias", v: `${h.taxa30.pct}%`, d: `${h.taxa30.feitos} de ${h.taxa30.esperados}` },
          { r: "Conclusão 90 dias", v: `${taxa90.pct}%`, d: `${h.total} vezes no total` },
        ].map((k) => (
          <div key={k.r} className="painel p-4">
            <p className="rotulo">{k.r}</p>
            <p className="numero mt-1 font-display text-2xl font-bold">{k.v}</p>
            {k.d && <p className="numero text-xs text-suave">{k.d}</p>}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Cartao
          titulo={<span className="first-letter:uppercase">{nomeMes(mes)} de {ano}</span>}
          icone={CalendarDays}
          className="lg:col-span-2"
          acao={
            <>
              <Link href={`?mes=${somaMeses(base, -1).slice(0, 7)}`} className={classesBotao("fantasma", "icone")} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href={`?mes=${somaMeses(base, 1).slice(0, 7)}`} className={classesBotao("fantasma", "icone")} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          }
        >
          <div className="grid grid-cols-7 gap-1.5 text-center text-[0.68rem] text-apagado">
            {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
              <span key={d}>{d}</span>
            ))}
            {Array.from({ length: vazios }, (_, i) => (
              <span key={"v" + i} />
            ))}
            {dias.map((d) => {
              const s = statusDoDia(h.def, h.regs.get(d), d);
              const futuro = d > hojeK;
              const editavel = !agua && !futuro && diasEntre(d, hojeK) <= 60;
              const cls = cn(
                "relative grid grid-cols-1 aspect-square place-items-center rounded-lg border text-sm transition",
                s === "feito" && "border-ok/40 bg-ok/20 text-texto",
                s === "parcial" && "border-alerta/40 bg-alerta/15",
                s === "descanso" && "border-violeta-claro/40 bg-violeta/20",
                s === "pendente" && (d < hojeK ? "border-borda bg-white/4 text-suave" : "border-borda text-suave"),
                s === "livre" && "border-transparent text-apagado",
                futuro && "opacity-40",
                d === hojeK && "ring-2 ring-eletrico-claro",
                editavel && "hover:border-eletrico",
              );
              const conteudo = (
                <>
                  <span className="numero">{Number(d.slice(8))}</span>
                  {s === "descanso" && <Coffee className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-violeta-claro" aria-hidden />}
                </>
              );
              return editavel ? (
                <form key={d} action={marcarHabito}>
                  <input type="hidden" name="id" value={h.habito.id} />
                  <input type="hidden" name="dia" value={d} />
                  <input type="hidden" name="acao" value="alternar" />
                  <button className={cn(cls, "w-full")} aria-label={`${d}: ${s}. Alternar feito.`}>
                    {conteudo}
                  </button>
                </form>
              ) : (
                <span key={d} className={cls} aria-label={`${d}: ${s}`}>
                  {conteudo}
                </span>
              );
            })}
          </div>
          {!agua && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
              <span>Toque num dia (até 60 dias atrás) para marcar ou desmarcar.</span>
              <form action={marcarHabito}>
                <input type="hidden" name="id" value={h.habito.id} />
                <input type="hidden" name="acao" value="descanso" />
                <button className={classesBotao("contorno", "p")} aria-pressed={h.hoje.skipped}>
                  <Coffee className="h-3.5 w-3.5" /> {h.hoje.skipped ? "Tirar descanso de hoje" : "Hoje é dia de descanso"}
                </button>
              </form>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Conquistas" icone={Award}>
          <ul className="grid grid-cols-4 gap-2">
            {MARCOS_SEQUENCIA.map((m) => {
              const ok = h.melhor.valor >= m;
              return (
                <li
                  key={m}
                  className={cn(
                    "grid grid-cols-1 aspect-square place-items-center rounded-2xl border text-center",
                    ok ? "holo border-transparent bg-eletrico/10" : "border-borda opacity-40",
                  )}
                  title={ok ? `Conquistado: ${m} ${unidade} seguidos` : `Bloqueado: ${m} ${unidade}`}
                >
                  <span>
                    <span className="numero block font-display text-lg font-bold">{m}</span>
                    <span className="block text-[0.6rem] text-suave">{unidade}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-suave">
            {prox ? (
              <>
                Próxima conquista: <span className="text-texto">{prox} {unidade}</span> seguidos.
              </>
            ) : (
              "Todas as conquistas desbloqueadas."
            )}
          </p>
        </Cartao>
      </div>
    </>
  );
}
