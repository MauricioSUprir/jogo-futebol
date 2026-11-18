// SLEEP LAB — monitoramento do sono.
import Link from "next/link";
import { BarChart3, BedDouble, CalendarRange, Clock3, Moon, MoonStar, NotebookPen, Pencil, Settings2, Sparkles, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { configSono, noitesDoPeriodo } from "@/lib/servidor/sono";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { diaCurto, diaDaSemana, diaRelativo, hoje, horaNoFuso, intervaloDeDias, nomeDiaCurto, somaDias } from "@/lib/datas";
import {
  QUALIDADE, aulaVsLivre, bateuMeta, bitsParaDias, duracaoMin, formatarDuracao, horaDeMinutos, horas, regularidade, sonoEEnergia,
} from "@/lib/sono";
import { umaCasa } from "@/lib/checkin";
import { excluirNoite } from "@/acoes/sono";
import { Anel } from "@/components/anel";
import { CabecalhoPagina, Cartao, Selo, Vazio, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormConfigSono, FormNoite, type NoiteForm } from "@/components/sono/formularios";
import { GraficoSono } from "@/components/sono/graficos";

export const metadata = { title: "Sleep Lab" };

export default async function PaginaSono({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const periodo = (await searchParams).periodo === "30" ? 30 : 7;
  const de = somaDias(hojeK, -59);
  const [cfg, noites, checkins] = await Promise.all([configSono(user.id), noitesDoPeriodo(user.id, de, hojeK), checkinsDoPeriodo(user.id, de, hojeK)]);
  const meta = cfg.targetMin;
  const porDia = new Map(noites.map((n) => [n.dia, n]));

  const ultima = noites[noites.length - 1] ?? null;
  const durUltima = ultima ? duracaoMin(ultima) : 0;
  const pct = ultima ? Math.round((durUltima / meta) * 100) : 0;
  const ult7 = noites.filter((n) => n.dia > somaDias(hojeK, -7));
  const media7 = ult7.length ? ult7.reduce((s, n) => s + duracaoMin(n), 0) / ult7.length : null;
  const batidas7 = ult7.filter((n) => bateuMeta(n, meta)).length;
  const ult14 = noites.filter((n) => n.dia > somaDias(hojeK, -14));
  const reg = regularidade(ult14, tz);
  const ult30 = noites.filter((n) => n.dia > somaDias(hojeK, -30));
  const aul = aulaVsLivre(ult30, cfg.schoolDays, tz);
  const energia = sonoEEnergia(noites, checkins, meta);
  const comEnergia = noites.filter((n) => checkins.get(n.dia)?.energia != null);
  const nComMeta = comEnergia.filter((n) => bateuMeta(n, meta)).length;

  const dias = intervaloDeDias(somaDias(hojeK, -(periodo - 1)), hojeK);
  const grafico = dias.map((d) => {
    const n = porDia.get(d);
    return { dia: d === hojeK ? "hoje" : periodo === 7 ? nomeDiaCurto(diaDaSemana(d)) : diaCurto(d), horas: n ? horas(duracaoMin(n)) : null };
  });
  const historico = [...ult30].reverse();
  const paraForm = (n: (typeof noites)[number]): NoiteForm => ({
    id: n.id,
    dia: n.dia,
    deitou: horaNoFuso(n.deitou, tz),
    acordou: horaNoFuso(n.acordou, tz),
    latenciaMin: n.latenciaMin,
    despertares: n.despertares,
    qualidade: n.qualidade,
    notas: n.notas,
  });
  const nova: NoiteForm = {
    dia: hojeK,
    deitou: porDia.get(hojeK) ? horaNoFuso(porDia.get(hojeK)!.deitou, tz) : cfg.bedtime,
    acordou: porDia.get(hojeK) ? horaNoFuso(porDia.get(hojeK)!.acordou, tz) : cfg.wake,
    latenciaMin: null,
    despertares: null,
    qualidade: null,
    notas: null,
  };

  return (
    <>
      <CabecalhoPagina
        rotulo="Sleep Lab"
        titulo="Sono"
        descricao="Horários, duração, qualidade e regularidade das suas noites."
        acao={
          <>
            <Dialogo gatilho={<><BedDouble className="h-4 w-4" /> Registrar noite</>} classeGatilho={classesBotao("primario")} titulo="Registrar noite">
              <FormNoite hoje={hojeK} noite={nova} />
            </Dialogo>
            <Dialogo gatilho={<><Settings2 className="h-4 w-4" /> Meta e horários</>} titulo="Configurar o Sleep Lab">
              <FormConfigSono metaMin={meta} dormir={cfg.bedtime} acordar={cfg.wake} diasAula={bitsParaDias(cfg.schoolDays)} lembreteMin={cfg.remindMin} />
            </Dialogo>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Cartao holo className="lg:col-span-3" titulo="Última noite" icone={MoonStar}>
          {!ultima ? (
            <Vazio icone={Moon} titulo="Nenhuma noite registrada">Toque em Registrar noite: horário em que dormiu e em que acordou.</Vazio>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Anel pct={pct} tamanho={168} espessura={14} rotulo={`${pct}% da meta de sono`}>
                <div>
                  <MoonStar className="mx-auto mb-1 h-5 w-5 text-violeta-claro" aria-hidden />
                  <p className="numero font-display text-2xl font-bold">{formatarDuracao(durUltima)}</p>
                  <p className="text-xs text-suave">{pct}% da meta</p>
                </div>
              </Anel>
              <div className="w-full min-w-0 flex-1">
                <p className="text-sm text-suave first-letter:uppercase">
                  {diaRelativo(ultima.dia, hojeK) === "Hoje" ? "Acordou hoje" : `Acordou ${diaRelativo(ultima.dia, hojeK).toLowerCase()}`}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center sm:text-left">
                  <div>
                    <dt className="rotulo">Dormiu</dt>
                    <dd className="numero mt-1 font-display text-lg font-semibold">{horaNoFuso(ultima.deitou, tz)}</dd>
                  </div>
                  <div>
                    <dt className="rotulo">Acordou</dt>
                    <dd className="numero mt-1 font-display text-lg font-semibold">{horaNoFuso(ultima.acordou, tz)}</dd>
                  </div>
                  <div>
                    <dt className="rotulo">Qualidade</dt>
                    <dd className="mt-1 font-display text-lg font-semibold">{ultima.qualidade ? QUALIDADE[ultima.qualidade] : "—"}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-suave">
                  Meta: <span className="numero text-texto">{formatarDuracao(meta)}</span>
                  {durUltima >= meta ? " · chegou à meta" : ` · faltaram ${formatarDuracao(meta - durUltima)}`}
                  {ultima.latenciaMin ? ` · ${ultima.latenciaMin} min até pegar no sono` : ""}
                </p>
                {ultima.notas && <p className="mt-2 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2 text-sm text-suave">{ultima.notas}</p>}
              </div>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Sono e disposição" icone={Sparkles} className="lg:col-span-2">
          {energia ? (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="rotulo">Com a meta</dt>
                  <dd className="numero mt-1 font-display text-2xl font-bold">{umaCasa(energia.a)}</dd>
                  <dd className="text-xs text-apagado">energia média · {energia.na} dia(s)</dd>
                </div>
                <div>
                  <dt className="rotulo">Sem a meta</dt>
                  <dd className="numero mt-1 font-display text-2xl font-bold">{umaCasa(energia.b)}</dd>
                  <dd className="text-xs text-apagado">energia média · {energia.nb} dia(s)</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-suave">
                {energia.diferenca >= 0.5
                  ? `Você costuma relatar mais energia depois das noites com ${formatarDuracao(meta)} ou mais.`
                  : energia.diferenca <= -0.5
                    ? "Nos seus registros, a energia não foi maior depois das noites mais longas."
                    : "Por enquanto, a energia ficou parecida nos dois tipos de noite."}
              </p>
            </>
          ) : (
            <p className="text-sm text-suave">
              Compara a energia do check-in do dia com a noite anterior. Faltam dados: precisa de pelo menos 3 noites com a meta e 3 sem, com o
              check-in de energia (hoje: {nComMeta} com e {comEnergia.length - nComMeta} sem).
            </p>
          )}
          <p className="mt-3 text-xs text-apagado">Padrões dos seus registros, sem diagnóstico.</p>
        </Cartao>

        <section aria-label="Estatísticas" className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-4">
          {[
            { r: "Média 7 noites", v: formatarDuracao(media7), d: `${ult7.length} noite(s) registrada(s)` },
            { r: "Meta alcançada", v: `${batidas7} de ${ult7.length}`, d: "noites desta semana" },
            { r: "Dormir (média)", v: horaDeMinutos(reg.dormir), d: reg.desvioDormir !== null ? `varia ± ${Math.round(reg.desvioDormir)} min` : "14 dias" },
            { r: "Acordar (média)", v: horaDeMinutos(reg.acordar), d: reg.desvioAcordar !== null ? `varia ± ${Math.round(reg.desvioAcordar)} min` : "14 dias" },
          ].map((k) => (
            <div key={k.r} className="painel p-4">
              <p className="rotulo">{k.r}</p>
              <p className="numero mt-1 font-display text-xl font-bold">{k.v}</p>
              <p className="mt-0.5 text-[0.68rem] leading-tight text-apagado">{k.d}</p>
            </div>
          ))}
        </section>

        <Cartao
          titulo="Horas por noite"
          icone={BarChart3}
          className="lg:col-span-3"
          acao={
            <div className="flex rounded-lg border border-borda p-0.5 text-xs">
              {[7, 30].map((p) => (
                <Link
                  key={p}
                  href={`/sono?periodo=${p}`}
                  aria-current={periodo === p ? "page" : undefined}
                  className="rounded-md px-2.5 py-1 text-suave aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto"
                >
                  {p} dias
                </Link>
              ))}
            </div>
          }
        >
          <GraficoSono dados={grafico} metaHoras={meta / 60} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-suave">
                <tr>
                  <th className="py-1 font-medium">Dia</th>
                  <th className="py-1 font-medium">Dormiu</th>
                  <th className="py-1 font-medium">Acordou</th>
                  <th className="py-1 font-medium">Sono</th>
                </tr>
              </thead>
              <tbody className="numero">
                {[...dias].reverse().map((d) => {
                  const n = porDia.get(d);
                  return (
                    <tr key={d} className="border-t border-borda">
                      <td className="py-1">{diaCurto(d)}</td>
                      <td className="py-1">{n ? horaNoFuso(n.deitou, tz) : "—"}</td>
                      <td className="py-1">{n ? horaNoFuso(n.acordou, tz) : "—"}</td>
                      <td className="py-1">{n ? formatarDuracao(duracaoMin(n)) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </Cartao>

        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <Cartao titulo="Regularidade (14 dias)" icone={Clock3}>
            {reg.n < 3 ? (
              <p className="text-sm text-suave">Com 3 noites ou mais aparece quanto seus horários variam.</p>
            ) : (
              <>
                <p className="text-sm">
                  Horário de dormir varia <span className="numero font-semibold">± {Math.round(reg.desvioDormir ?? 0)} min</span>; o de acordar,{" "}
                  <span className="numero font-semibold">± {Math.round(reg.desvioAcordar ?? 0)} min</span>.
                </p>
                <p className="mt-2 text-xs text-apagado">
                  Média de {reg.n} noites: dorme por volta das {horaDeMinutos(reg.dormir)} e acorda por volta das {horaDeMinutos(reg.acordar)}. Quanto
                  menor a variação, mais regular a rotina.
                </p>
              </>
            )}
          </Cartao>
          <Cartao titulo="Dias de aula × dias livres (30 dias)" icone={CalendarRange}>
            {aul.aula.n === 0 && aul.livre.n === 0 ? (
              <p className="text-sm text-suave">Registre noites para comparar.</p>
            ) : (
              <>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-suave">
                    <tr>
                      <th className="pb-1 font-medium" />
                      <th className="pb-1 font-medium">Aula</th>
                      <th className="pb-1 font-medium">Livre</th>
                    </tr>
                  </thead>
                  <tbody className="numero">
                    {[
                      { r: "Noites", a: String(aul.aula.n), l: String(aul.livre.n) },
                      { r: "Duração", a: formatarDuracao(aul.aula.duracao), l: formatarDuracao(aul.livre.duracao) },
                      { r: "Dormir", a: horaDeMinutos(aul.aula.dormir), l: horaDeMinutos(aul.livre.dormir) },
                      { r: "Acordar", a: horaDeMinutos(aul.aula.acordar), l: horaDeMinutos(aul.livre.acordar) },
                    ].map((l) => (
                      <tr key={l.r} className="border-t border-borda">
                        <th scope="row" className="py-1 text-xs font-medium text-suave">
                          {l.r}
                        </th>
                        <td className="py-1">{l.a}</td>
                        <td className="py-1">{l.l}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-apagado">
                  {aul.jetlagMin !== null
                    ? `O meio do seu sono muda ${formatarDuracao(aul.jetlagMin)} entre os dois tipos de dia (o "jet lag social").`
                    : "Com 2 noites de cada tipo aparece a diferença do meio do sono."}
                </p>
              </>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Histórico e diário de sono (30 dias)" icone={NotebookPen} className="lg:col-span-5">
          {historico.length === 0 ? (
            <p className="py-4 text-center text-sm text-suave">Sem noites nos últimos 30 dias.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {historico.map((n) => {
                const dur = duracaoMin(n);
                return (
                  <li key={n.id} className="rounded-xl border border-borda bg-fundo-2/50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-24 shrink-0 text-sm font-medium first-letter:uppercase">{diaRelativo(n.dia, hojeK)}</span>
                      <span className="numero text-sm text-suave">
                        {horaNoFuso(n.deitou, tz)} → {horaNoFuso(n.acordou, tz)}
                      </span>
                      <span className="numero text-sm font-semibold">{formatarDuracao(dur)}</span>
                      {bateuMeta(n, meta) && <Selo cor="#34d399">meta</Selo>}
                      {n.qualidade && <Selo cor="#a78bfa">{QUALIDADE[n.qualidade]}</Selo>}
                      <div className="ml-auto flex items-center gap-1">
                        <Dialogo
                          gatilho={<Pencil className="h-4 w-4" />}
                          rotuloGatilho={`Editar a noite de ${diaCurto(n.dia)}`}
                          classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-white/5 hover:text-texto"
                          titulo="Editar noite"
                        >
                          <FormNoite hoje={hojeK} noite={paraForm(n)} />
                        </Dialogo>
                        <form action={excluirNoite}>
                          <input type="hidden" name="id" value={n.id} />
                          <BotaoEnvio
                            variante="fantasma"
                            tamanho="p"
                            className="h-auto px-1.5 py-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo"
                            aria-label={`Apagar a noite de ${diaCurto(n.dia)}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </BotaoEnvio>
                        </form>
                      </div>
                    </div>
                    {(n.notas || n.despertares || n.latenciaMin) && (
                      <p className="mt-1 text-xs text-suave">
                        {[
                          n.latenciaMin ? `${n.latenciaMin} min até dormir` : null,
                          n.despertares ? `${n.despertares} despertar(es)` : null,
                          n.notas,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
