// HYDRO TRACK — controle de água.
import Link from "next/link";
import { BarChart3, Clock3, CupSoda, Download, Droplets, Dumbbell, GlassWater, Milk, Plus, Settings2, Trash2, Undo2 } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { aguaDoPeriodo } from "@/lib/servidor/dados";
import { diaCurto, hoje, horaNoFuso, intervaloDeDias, nomeDiaCurto, diaDaSemana, somaDias } from "@/lib/datas";
import { BEBIDAS, formatarMl, media, porHora, regularidade, sequenciaMeta, treinoVsDescanso } from "@/lib/agua";
import { adicionarAgua, desfazerUltimaAgua, marcarDiaTreino, removerAgua } from "@/acoes/agua";
import { Anel } from "@/components/anel";
import { CabecalhoPagina, Cartao, Vazio, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormBebida, FormConfigAgua } from "@/components/agua/formularios";
import { GraficoAguaDias, GraficoHoras } from "@/components/graficos";
import { cn } from "@/lib/cn";

export const metadata = { title: "Hydro Track" };

export default async function PaginaAgua({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const periodo = (await searchParams).periodo === "30" ? 30 : 7;
  const { cfg, registros, resumo } = await aguaDoPeriodo(user, somaDias(hojeK, -59), hojeK);

  const dia = resumo[resumo.length - 1];
  const pct = dia.meta ? Math.round((dia.aguaMl / dia.meta) * 100) : 0;
  const falta = Math.max(0, dia.meta - dia.aguaMl);
  const deHoje = registros.filter((r) => r.day === hojeK).reverse();
  const passados7 = resumo.slice(-8, -1);
  const batidos7 = passados7.filter((d) => d.bateu).length;
  const seq = sequenciaMeta(resumo, hojeK);
  const ult14 = intervaloDeDias(somaDias(hojeK, -14), somaDias(hojeK, -1));
  const reg14 = registros.filter((r) => ult14.includes(r.day));
  const regHoras = registros.filter((r) => r.day >= somaDias(hojeK, -13));
  const regul = regularidade(reg14, ult14);
  const tvd = treinoVsDescanso(resumo.slice(-31), hojeK);
  const grafico = resumo.slice(-periodo).map((d) => ({
    dia: d.dia === hojeK ? "hoje" : periodo === 7 ? nomeDiaCurto(diaDaSemana(d.dia)) : diaCurto(d.dia),
    ml: d.aguaMl,
  }));
  const horas = porHora(regHoras).map((ml, h) => ({ hora: `${h}h`, ml }));

  const botoes = [
    { ml: cfg.glassMl, rotulo: "Copo", detalhe: `${cfg.glassMl} ml`, tipo: "copo", icone: GlassWater },
    { ml: cfg.bottleMl, rotulo: "Garrafa", detalhe: `${cfg.bottleMl} ml`, tipo: "garrafa", icone: Milk },
    ...cfg.quickAmounts.map((ml) => ({ ml, rotulo: `+${ml}`, detalhe: "ml", tipo: "rapido", icone: Plus })),
  ];

  return (
    <>
      <CabecalhoPagina
        rotulo="Hydro Track"
        titulo="Controle de água"
        descricao="Registre cada copo; o painel acompanha em tempo real."
        acao={
          <>
            <a href="/api/exportar/agua" className={classesBotao("secundario", "m")} download>
              <Download className="h-4 w-4" /> CSV
            </a>
            <Dialogo gatilho={<><Settings2 className="h-4 w-4" /> Meta e copos</>} titulo="Configurar o Hydro Track">
              <FormConfigAgua meta={cfg.goalMl} copo={cfg.glassMl} garrafa={cfg.bottleMl} rapidos={cfg.quickAmounts} />
            </Dialogo>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Cartao holo className="lg:col-span-3">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <Anel pct={pct} tamanho={176} espessura={14} rotulo={`${pct}% da meta de água`}>
              <div>
                <Droplets className="mx-auto mb-1 h-5 w-5 text-ciano" aria-hidden />
                <p className="numero font-display text-3xl font-bold">{pct}%</p>
                <p className="text-xs text-suave">da meta</p>
              </div>
            </Anel>
            <div className="w-full min-w-0 flex-1">
              <dl className="grid grid-cols-3 gap-2 text-center sm:text-left">
                <div>
                  <dt className="rotulo">Registrada</dt>
                  <dd className="numero mt-1 font-display text-lg font-semibold">{formatarMl(dia.aguaMl)}</dd>
                </div>
                <div>
                  <dt className="rotulo">Meta</dt>
                  <dd className="numero mt-1 font-display text-lg font-semibold">{formatarMl(dia.meta)}</dd>
                </div>
                <div>
                  <dt className="rotulo">Registros</dt>
                  <dd className="numero mt-1 font-display text-lg font-semibold">{dia.copos}</dd>
                </div>
              </dl>
              <p className="mt-3 text-center text-sm text-suave sm:text-left">
                {falta > 0 ? <>Faltam <span className="numero text-texto">{formatarMl(falta)}</span> para a meta.</> : "Meta de hoje batida."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {botoes.map((b) => (
                  <form key={b.tipo + b.ml} action={adicionarAgua}>
                    <input type="hidden" name="ml" value={b.ml} />
                    <input type="hidden" name="tipo" value={b.tipo} />
                    <BotaoEnvio variante="secundario" className="h-14 w-full flex-col gap-0" pendente="…" aria-label={`Registrar ${b.ml} ml`}>
                      <span className="flex items-center gap-1 font-semibold">
                        <b.icone className="h-4 w-4 text-ciano" aria-hidden /> {b.rotulo}
                      </span>
                      <span className="text-[0.7rem] text-suave">{b.detalhe}</span>
                    </BotaoEnvio>
                  </form>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Dialogo gatilho={<><CupSoda className="h-4 w-4" /> Personalizar</>} classeGatilho={classesBotao("contorno", "p")} titulo="Registrar bebida">
                  <FormBebida hoje={hojeK} copo={cfg.glassMl} />
                </Dialogo>
                <form action={marcarDiaTreino}>
                  <input type="hidden" name="dia" value={hojeK} />
                  <input type="hidden" name="valor" value={dia.treino ? "0" : "1"} />
                  <button className={classesBotao(dia.treino ? "contorno" : "fantasma", "p")} aria-pressed={dia.treino}>
                    <Dumbbell className="h-4 w-4" /> {dia.treino ? "Dia de treino" : "Marcar dia de treino"}
                  </button>
                </form>
                {deHoje.length > 0 && (
                  <form action={desfazerUltimaAgua}>
                    <button className={classesBotao("fantasma", "p")}>
                      <Undo2 className="h-4 w-4" /> Desfazer último
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Hoje" icone={Clock3} className="lg:col-span-2">
          {deHoje.length === 0 ? (
            <Vazio icone={GlassWater} titulo="Nenhum registro hoje">Toque em Copo para começar.</Vazio>
          ) : (
            <ul className="grid grid-cols-1 max-h-80 gap-1.5 overflow-y-auto pr-1">
              {deHoje.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                  <span className="numero w-11 text-xs text-suave">{horaNoFuso(r.at, tz)}</span>
                  <span className={cn("flex-1 text-sm", r.beverage !== "agua" && "text-violeta-claro")}>{BEBIDAS[r.beverage] ?? r.beverage}</span>
                  <span className="numero text-sm font-medium">{r.amountMl} ml</span>
                  <form action={removerAgua}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Apagar registro das ${horaNoFuso(r.at, tz)}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {dia.outrasMl > 0 && (
            <p className="mt-3 text-xs text-suave">
              Outras bebidas hoje: <span className="numero text-texto">{formatarMl(dia.outrasMl)}</span> (fora da meta)
            </p>
          )}
        </Cartao>

        <section aria-label="Estatísticas" className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-4">
          {[
            { r: "Média 7 dias", v: formatarMl(media(passados7.map((d) => d.aguaMl))) },
            { r: "Meta batida", v: `${batidos7} de 7 dias` },
            { r: "Sequência", v: `${seq} ${seq === 1 ? "dia" : "dias"}` },
            { r: "Regularidade", v: `${regul}%`, d: "dos períodos de 2 h com registro (8h–22h, 14 dias)" },
          ].map((k) => (
            <div key={k.r} className="painel p-4" title={k.d}>
              <p className="rotulo">{k.r}</p>
              <p className="numero mt-1 font-display text-xl font-bold">{k.v}</p>
              {k.d && <p className="mt-0.5 text-[0.68rem] leading-tight text-apagado">{k.d}</p>}
            </div>
          ))}
        </section>

        <Cartao
          titulo={`Água por dia · ${periodo} dias`}
          icone={BarChart3}
          className="lg:col-span-3"
          acao={
            <div className="flex rounded-lg border border-borda p-0.5 text-xs">
              {[7, 30].map((p) => (
                <Link key={p} href={`/agua?periodo=${p}`} aria-current={periodo === p ? "page" : undefined} className="rounded-md px-2.5 py-1 text-suave aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto">
                  {p} dias
                </Link>
              ))}
            </div>
          }
        >
          <GraficoAguaDias dados={grafico} meta={cfg.goalMl} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-suave">
                <tr>
                  <th className="py-1 font-medium">Dia</th>
                  <th className="py-1 font-medium">Água</th>
                  <th className="py-1 font-medium">Meta</th>
                  <th className="py-1 font-medium">Treino</th>
                </tr>
              </thead>
              <tbody className="numero">
                {resumo.slice(-periodo).reverse().map((d) => (
                  <tr key={d.dia} className="border-t border-borda">
                    <td className="py-1">{diaCurto(d.dia)}</td>
                    <td className="py-1">{formatarMl(d.aguaMl)}</td>
                    <td className="py-1">{d.bateu ? "Batida" : `${Math.round((d.aguaMl / d.meta) * 100)}%`}</td>
                    <td className="py-1">{d.treino ? "Sim" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Cartao>

        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <Cartao titulo="Horários (14 dias)" icone={Clock3}>
            {regHoras.length === 0 ? <p className="py-6 text-center text-sm text-suave">Sem registros nos últimos 14 dias.</p> : <GraficoHoras dados={horas} />}
          </Cartao>
          <Cartao titulo="Treino × descanso (30 dias)" icone={Dumbbell}>
            {tvd.nTreino === 0 ? (
              <p className="text-sm text-suave">Marque os dias de treino para comparar a hidratação.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="rotulo">Dias de treino</dt>
                  <dd className="numero mt-1 font-display text-lg font-semibold">{formatarMl(tvd.treino)}</dd>
                  <dd className="text-xs text-apagado">média de {tvd.nTreino} dia(s)</dd>
                </div>
                <div>
                  <dt className="rotulo">Descanso</dt>
                  <dd className="numero mt-1 font-display text-lg font-semibold">{formatarMl(tvd.descanso)}</dd>
                  <dd className="text-xs text-apagado">média de {tvd.nDescanso} dia(s)</dd>
                </div>
              </dl>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
