// As abas do Fitness Center (componentes de servidor): visão geral, musculação, futebol, cardio e recuperação.
import Link from "next/link";
import {
  Activity as IconeAtividade, Archive, ArchiveRestore, ArrowDown, ArrowUp, BedDouble, CalendarRange, ChartLine, Dumbbell, Footprints, History,
  ListChecks, MoonStar, Pencil, Plus, ShieldCheck, Star, Trash2, Trophy,
} from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { alternarFavorita, arquivarFicha, excluirFicha, excluirRecuperacao, moverFicha } from "@/acoes/treinos";
import { Barra, Cartao, Selecao, Selo, Vazio, classesBotao } from "../ui";
import { BotaoEnvio, Dialogo } from "../cliente";
import { FormCardio, FormFutebol, FormRecuperacao } from "./formularios";
import { FormFicha } from "./form-ficha";
import { GraficoBarras, GraficoCarga } from "./graficos";
import { BotaoNovaSessao, GradeSemana, ItemAtividade, Kpi, LegendaEsforco, ListaAlertas, tituloAtividade } from "./partes";
import {
  baseDosAlertas, carregarAtividades, carregarFichas, carregarRecuperacao, jogoDe, recuperacaoDe, resumoDe, seriesFeitas, sonoRecente,
} from "@/lib/servidor/treinos";
import { dataParaChave, diaCurto, diaRelativo, inicioDaSemana, nomeDiaCurto, nomeMes, somaDias } from "@/lib/datas";
import {
  GRUPOS_MUSCULARES, POSICOES, TIPOS_CARDIO, diasDaMascara, estatisticasFutebol, evolucaoCarga, exerciciosFeitos, formatarDuracao,
  gradeDaSemana, jogosPorMes, minutosPorSemana, minutosPorTipo, num, porTemporada, ritmo, temporadaDe,
} from "@/lib/treinos";
import { cn } from "@/lib/cn";

interface Props {
  user: User;
  hojeK: string;
}

/** Atividades feitas por dia (para a grade da semana). */
function feitosPorDia(ativs: Awaited<ReturnType<typeof carregarAtividades>>) {
  const m = new Map<string, string[]>();
  for (const a of ativs) {
    const d = dataParaChave(a.day);
    m.set(d, [...(m.get(d) ?? []), tituloAtividade(a)]);
  }
  return m;
}

async function dadosDaSemana(user: User, hojeK: string) {
  const inicio = inicioDaSemana(hojeK);
  const [fichas, ativs, recs] = await Promise.all([
    carregarFichas(user.id),
    carregarAtividades(user.id, inicio, somaDias(inicio, 6)),
    carregarRecuperacao(user.id, inicio, somaDias(inicio, 6)),
  ]);
  const grade = gradeDaSemana(
    fichas.map((f) => ({ id: f.id, nome: f.name, dias: f.weekdays })),
    inicio,
  );
  return { fichas, grade, feitos: feitosPorDia(ativs), descansos: new Set(recs.filter((r) => r.restDay).map((r) => dataParaChave(r.day))) };
}

// ───────────── Visão geral ─────────────

export async function AbaGeral({ user, hojeK }: Props) {
  const tz = user.timezone;
  const [base, semana, recentes] = await Promise.all([
    baseDosAlertas(user.id, hojeK),
    dadosDaSemana(user, hojeK),
    carregarAtividades(user.id, somaDias(hojeK, -30), hojeK),
  ]);
  const de = somaDias(hojeK, -6);
  const porTipo = minutosPorTipo(base.resumo, de, hojeK);
  const total = porTipo.musculacao + porTipo.cardio + porTipo.futebol;
  const ultimos7 = base.resumo.filter((a) => a.dia >= de && a.dia <= hojeK && a.duracao > 0);
  const diasAtivos = new Set(ultimos7.map((a) => a.dia)).size;
  const maior = Math.max(1, porTipo.musculacao, porTipo.cardio, porTipo.futebol);
  const recHoje = base.recup.find((r) => r.dia === hojeK);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section aria-label="Últimos 7 dias" className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
        <Kpi rotulo="Minutos (7 dias)" valor={formatarDuracao(total)} detalhe={`${ultimos7.length} atividade(s)`} />
        <Kpi rotulo="Dias ativos" valor={`${diasAtivos} de 7`} detalhe={`${7 - diasAtivos} de descanso`} />
        <Kpi
          rotulo="Carga (7 dias)"
          valor={base.carga.atual.toLocaleString("pt-BR")}
          detalhe={base.carga.media !== null ? `média das 3 semanas antes: ${Math.round(base.carga.media).toLocaleString("pt-BR")}` : "compara depois de 3 semanas de registros"}
        />
        <Kpi
          rotulo="Recuperação hoje"
          valor={
            recHoje?.recuperacao ? (
              `${recHoje.recuperacao} de 5`
            ) : (
              <Link href="/treinos?aba=recuperacao" className="text-eletrico-claro hover:underline">
                Registrar
              </Link>
            )
          }
          detalhe={recHoje?.descanso ? "dia de descanso" : recHoje?.cansaco ? `cansaço ${recHoje.cansaco} de 5` : "cansaço, dores e sono"}
        />
      </section>

      <Cartao titulo="Alertas de recuperação" icone={ShieldCheck} className="lg:col-span-2">
        <ListaAlertas alertas={base.alertas} vazio="Nada a apontar. Continue alternando treino e descanso." />
        <div className="mt-3">
          <LegendaEsforco />
        </div>
      </Cartao>

      <Cartao titulo="Minutos por tipo (7 dias)" icone={IconeAtividade}>
        <ul className="grid grid-cols-1 gap-3">
          {[
            { nome: "Musculação", v: porTipo.musculacao },
            { nome: "Cardio", v: porTipo.cardio },
            { nome: "Futebol", v: porTipo.futebol },
          ].map((t) => (
            <li key={t.nome}>
              <p className="mb-1 flex justify-between text-sm">
                <span>{t.nome}</span>
                <span className="numero text-suave">{t.v} min</span>
              </p>
              <Barra pct={(t.v / maior) * 100} cor="#3987e5" rotulo={`${t.nome}: ${t.v} minutos`} />
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Semana de treinamento" icone={CalendarRange} className="lg:col-span-3" acao={<Link href="/treinos?aba=musculacao" className={classesBotao("fantasma", "p")}>Fichas</Link>}>
        {semana.fichas.length === 0 && <p className="mb-3 text-sm text-suave">Crie fichas com dias da semana na aba Musculação para montar a semana.</p>}
        <GradeSemana grade={semana.grade} hojeK={hojeK} feitos={semana.feitos} descansos={semana.descansos} />
      </Cartao>

      <Cartao titulo="Últimas atividades" icone={History} className="lg:col-span-3">
        {recentes.length === 0 ? (
          <Vazio icone={Dumbbell} titulo="Nenhuma atividade ainda">Use “Registrar atividade” no topo.</Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {recentes.slice(0, 8).map((a) => (
              <ItemAtividade key={a.id} a={a} tz={tz} hojeK={hojeK} />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

// ───────────── Musculação ─────────────

export async function AbaMusculacao({ user, hojeK, exercicio }: Props & { exercicio?: string }) {
  const tz = user.timezone;
  const [semana, arquivadas, sessoes, series] = await Promise.all([
    dadosDaSemana(user, hojeK),
    carregarFichas(user.id, true).then((l) => l.filter((f) => f.archived)),
    carregarAtividades(user.id, somaDias(hojeK, -365), hojeK, "musculacao"),
    seriesFeitas(user.id),
  ]);
  const nomes = exerciciosFeitos(series);
  // Padrão: o exercício mais recente que tem carga registrada (o gráfico de um exercício só com peso do corpo ficaria vazio).
  const comCarga = nomes.find((n) => evolucaoCarga(series, n).length > 0);
  const ex = exercicio && nomes.some((n) => n.toLowerCase() === exercicio.toLowerCase()) ? exercicio : (comCarga ?? nomes[0]);
  const evolucao = ex ? evolucaoCarga(series, ex) : [];
  const fichas = semana.fichas;
  const inicialDe = (f: (typeof fichas)[number]) => ({
    id: f.id,
    nome: f.name,
    foco: f.focus,
    dias: diasDaMascara(f.weekdays),
    favorita: f.favorite,
    notas: f.notes,
    exercicios: f.exercises.map((e) => ({ nome: e.name, grupo: e.muscleGroup, series: e.sets, reps: e.reps, carga: e.loadKg ?? "", descanso: e.restSec, obs: e.notes ?? "" })),
  });
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao
        titulo="Fichas de treino"
        icone={ListChecks}
        className="lg:col-span-2"
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Nova ficha</>} classeGatilho={classesBotao("primario", "p")} titulo="Nova ficha de treino" larga>
            <FormFicha />
          </Dialogo>
        }
      >
        {fichas.length === 0 ? (
          <Vazio icone={Dumbbell} titulo="Nenhuma ficha ainda">Monte a primeira com os exercícios, séries, repetições, carga e intervalo.</Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {fichas.map((f, i) => (
              <li key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-borda bg-fundo-2/50 p-3">
                <div className="flex items-start gap-2">
                  <form action={alternarFavorita}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-lg p-1 text-apagado hover:text-alerta" aria-label={f.favorite ? `Tirar ${f.name} das favoritas` : `Marcar ${f.name} como favorita`} aria-pressed={f.favorite}>
                      <Star className={cn("h-4 w-4", f.favorite && "fill-alerta text-alerta")} />
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="text-xs text-suave">
                      {f.exercises.length} exercício{f.exercises.length === 1 ? "" : "s"}
                      {f.focus && ` · ${f.focus}`}
                    </p>
                  </div>
                  <BotaoNovaSessao fichaId={f.id} rotulo="Treinar" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {diasDaMascara(f.weekdays).length === 0 ? (
                    <span className="text-xs text-apagado">Sem dia fixo</span>
                  ) : (
                    [1, 2, 3, 4, 5, 6, 0].filter((d) => (f.weekdays >> d) & 1).map((d) => <Selo key={d}>{nomeDiaCurto(d)}</Selo>)
                  )}
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-suave hover:text-texto">Exercícios</summary>
                  <ol className="mt-2 grid grid-cols-1 gap-1">
                    {f.exercises.map((e) => (
                      <li key={e.id} className="flex min-w-0 justify-between gap-2 text-xs">
                        <span className="truncate">
                          {e.name} <span className="text-apagado">· {GRUPOS_MUSCULARES[e.muscleGroup] ?? e.muscleGroup}</span>
                        </span>
                        <span className="numero shrink-0 text-suave">
                          {e.sets} × {e.reps}
                          {e.loadKg !== null && ` · ${num(e.loadKg)} kg`} · {e.restSec} s
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="flex flex-wrap items-center gap-1 border-t border-borda pt-2">
                  <Dialogo gatilho={<><Pencil className="h-3.5 w-3.5" /> Editar</>} classeGatilho={classesBotao("fantasma", "p")} titulo={`Editar · ${f.name}`} larga>
                    <FormFicha inicial={inicialDe(f)} />
                  </Dialogo>
                  <form action={moverFicha}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="direcao" value="cima" />
                    <button className={classesBotao("fantasma", "icone", "h-8 w-8")} disabled={i === 0} aria-label={`Subir ${f.name}`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={moverFicha}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="direcao" value="baixo" />
                    <button className={classesBotao("fantasma", "icone", "h-8 w-8")} disabled={i === fichas.length - 1} aria-label={`Descer ${f.name}`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={arquivarFicha} className="ml-auto">
                    <input type="hidden" name="id" value={f.id} />
                    <button className={classesBotao("fantasma", "icone", "h-8 w-8")} aria-label={`Arquivar ${f.name}`} title="Arquivar">
                      <Archive className="h-4 w-4" />
                    </button>
                  </form>
                  <Dialogo
                    gatilho={<Trash2 className="h-4 w-4" />}
                    rotuloGatilho={`Excluir ${f.name}`}
                    classeGatilho={classesBotao("fantasma", "icone", "h-8 w-8 hover:text-perigo")}
                    titulo="Excluir ficha?"
                    descricao={f.name}
                  >
                    <form action={excluirFicha} className="grid grid-cols-1 gap-3">
                      <input type="hidden" name="id" value={f.id} />
                      <p className="text-sm text-suave">As sessões já feitas com ela continuam no histórico.</p>
                      <BotaoEnvio variante="perigo" pendente="Excluindo…">Excluir</BotaoEnvio>
                    </form>
                  </Dialogo>
                </div>
              </li>
            ))}
          </ul>
        )}
        {arquivadas.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-suave hover:text-texto">Arquivadas ({arquivadas.length})</summary>
            <ul className="mt-2 grid grid-cols-1 gap-1">
              {arquivadas.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-borda px-3 py-1.5">
                  <span className="truncate text-suave">{f.name}</span>
                  <form action={arquivarFicha}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className={classesBotao("fantasma", "p")}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Reativar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Cartao>

      <Cartao titulo="Semana de treinamento" icone={CalendarRange} className="lg:col-span-2">
        <GradeSemana grade={semana.grade} hojeK={hojeK} feitos={semana.feitos} descansos={semana.descansos} />
        <p className="mt-2 text-xs text-apagado">Dias sem ficha ficam para recuperação. Marque um descanso planejado na aba Recuperação.</p>
      </Cartao>

      <Cartao titulo="Evolução da carga" icone={ChartLine}>
        {nomes.length === 0 ? (
          <p className="py-4 text-sm text-suave">Registre sessões com carga para acompanhar a evolução de cada exercício.</p>
        ) : (
          <>
            <form method="get" action="/treinos" className="mb-3 flex gap-2">
              <input type="hidden" name="aba" value="musculacao" />
              <Selecao name="ex" defaultValue={ex} aria-label="Exercício" className="h-10 min-w-0 flex-1">
                {nomes.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Selecao>
              <button className={classesBotao("secundario", "m", "h-10 shrink-0")}>Ver</button>
            </form>
            {evolucao.length === 0 ? (
              <p className="text-sm text-suave">Sem carga registrada para {ex}.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-suave">Maior carga por sessão (kg) · {ex}</p>
                <GraficoCarga dados={evolucao.map((p) => ({ rotulo: diaCurto(p.dia), carga: p.maior }))} exercicio={ex!} />
                {evolucao.length === 1 && <p className="mt-1 text-xs text-apagado">A linha aparece a partir da 2ª sessão com carga.</p>}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
                  <table className="mt-2 w-full text-left text-xs">
                    <thead className="text-suave">
                      <tr>
                        <th className="py-1 font-medium">Dia</th>
                        <th className="py-1 font-medium">Maior carga</th>
                        <th className="py-1 font-medium">Reps</th>
                        <th className="py-1 font-medium">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="numero">
                      {[...evolucao].reverse().map((p) => (
                        <tr key={p.sessaoId} className="border-t border-borda">
                          <td className="py-1">{diaCurto(p.dia)}</td>
                          <td className="py-1">{num(p.maior)} kg</td>
                          <td className="py-1">{p.reps ?? "—"}</td>
                          <td className="py-1">{Math.round(p.volume).toLocaleString("pt-BR")} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </>
        )}
      </Cartao>

      <Cartao
        titulo="Histórico de sessões"
        icone={History}
        acao={
          <Link href="/treinos/sessao" className={classesBotao("fantasma", "p")}>
            <Plus className="h-3.5 w-3.5" /> Sessão livre
          </Link>
        }
      >
        {sessoes.length === 0 ? (
          <p className="py-4 text-sm text-suave">Nenhuma sessão registrada.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {sessoes.slice(0, 20).map((a) => (
              <ItemAtividade key={a.id} a={a} tz={tz} hojeK={hojeK} mostrarNotas />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

// ───────────── Futebol ─────────────

export async function AbaFutebol({ user, hojeK, temporada }: Props & { temporada?: number }) {
  const tz = user.timezone;
  const todos = await carregarAtividades(user.id, "2000-01-01", hojeK, "futebol");
  const jogos = todos.map(jogoDe);
  const anoAtual = Number(hojeK.slice(0, 4));
  const anos = [...new Set([anoAtual, ...jogos.map((j) => temporadaDe(j.dia))])].sort((a, b) => b - a);
  const ano = temporada && anos.includes(temporada) ? temporada : anoAtual;
  const daTemporada = todos.filter((a) => temporadaDe(dataParaChave(a.day)) === ano);
  const est = estatisticasFutebol(daTemporada.map(jogoDe));
  const meses = jogosPorMes(jogos, ano);
  const temporadas = porTemporada(jogos);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-wrap items-center gap-2 lg:col-span-3">
        <nav aria-label="Temporadas" className="flex flex-wrap gap-1">
          {anos.map((a) => (
            <Link
              key={a}
              href={`/treinos?aba=futebol&temporada=${a}`}
              aria-current={a === ano ? "page" : undefined}
              className="numero rounded-lg border border-borda px-3 py-1.5 text-sm text-suave aria-[current=page]:border-eletrico aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto"
            >
              {a}
            </Link>
          ))}
        </nav>
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Dialogo gatilho={<><Trophy className="h-4 w-4" /> Registrar jogo</>} classeGatilho={classesBotao("primario", "m")} titulo="Registrar jogo">
            <FormFutebol hoje={hojeK} />
          </Dialogo>
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Treino técnico</>} classeGatilho={classesBotao("secundario", "m")} titulo="Treino técnico">
            <FormFutebol hoje={hojeK} subtipoInicial="treino" />
          </Dialogo>
        </div>
      </div>

      <section aria-label={`Temporada ${ano}`} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-3">
        <Kpi rotulo="Jogos" valor={est.jogos} detalhe={`${est.partidas} partida(s) · ${est.recreativos} recreativo(s)`} />
        <Kpi rotulo="Minutos" valor={est.minutos.toLocaleString("pt-BR")} detalhe={`${est.treinos} treino(s) técnico(s)`} />
        <Kpi rotulo="Gols" valor={est.gols} detalhe={`${est.assistencias} assistência(s)`} />
        <Kpi
          rotulo="G + A por 90 min"
          valor={est.por90 === null ? "—" : num(est.por90, 2)}
          detalhe={est.mediaDesempenho === null ? "desempenho: —" : `desempenho médio ${num(est.mediaDesempenho)}`}
        />
      </section>

      <Cartao titulo={`Jogos por mês · ${ano}`} icone={CalendarRange} className="lg:col-span-2">
        {est.jogos === 0 ? (
          <p className="py-4 text-sm text-suave">Nenhum jogo nesta temporada.</p>
        ) : (
          <>
            <GraficoBarras
              dados={meses.map((v, i) => ({ rotulo: nomeMes(i + 1).slice(0, 3), valor: v }))}
              nome="Jogos"
              descricao={`Jogos por mês na temporada ${ano}`}
              todosRotulos
            />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
              <table className="mt-2 w-full text-left text-xs">
                <tbody className="numero">
                  {meses.map((v, i) => (
                    <tr key={i} className="border-t border-borda">
                      <td className="py-1 capitalize">{nomeMes(i + 1)}</td>
                      <td className="py-1">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Cartao>

      <Cartao titulo="Por posição" icone={Footprints}>
        {est.porPosicao.length === 0 ? (
          <p className="py-4 text-sm text-suave">Sem jogos registrados.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-suave">
              <tr>
                <th className="py-1 font-medium">Posição</th>
                <th className="py-1 font-medium">J</th>
                <th className="py-1 font-medium">Min</th>
                <th className="py-1 font-medium">G</th>
                <th className="py-1 font-medium">A</th>
              </tr>
            </thead>
            <tbody className="numero">
              {est.porPosicao.map((p) => (
                <tr key={p.posicao} className="border-t border-borda">
                  <td className="py-1">{POSICOES[p.posicao] ?? "Sem posição"}</td>
                  <td className="py-1">{p.jogos}</td>
                  <td className="py-1">{p.minutos}</td>
                  <td className="py-1">{p.gols}</td>
                  <td className="py-1">{p.assistencias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>

      <Cartao titulo={`Registros · ${ano}`} icone={History} className="lg:col-span-2">
        {daTemporada.length === 0 ? (
          <Vazio icone={Trophy} titulo="Nada nesta temporada">Registre jogos, treinos técnicos e o futebol recreativo.</Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {daTemporada.map((a) => (
              <ItemAtividade key={a.id} a={a} tz={tz} hojeK={hojeK} mostrarNotas />
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Evolução por temporada" icone={ChartLine}>
        {temporadas.length === 0 ? (
          <p className="py-4 text-sm text-suave">As temporadas aparecem aqui conforme os jogos forem registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-suave">
                <tr>
                  <th className="py-1 font-medium">Temp.</th>
                  <th className="py-1 font-medium">J</th>
                  <th className="py-1 font-medium">G</th>
                  <th className="py-1 font-medium">A</th>
                  <th className="py-1 font-medium">G+A/90</th>
                  <th className="py-1 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody className="numero">
                {temporadas.map((t) => (
                  <tr key={t.temporada} className="border-t border-borda">
                    <td className="py-1">{t.temporada}</td>
                    <td className="py-1">{t.est.jogos}</td>
                    <td className="py-1">{t.est.gols}</td>
                    <td className="py-1">{t.est.assistencias}</td>
                    <td className="py-1">{t.est.por90 === null ? "—" : num(t.est.por90, 2)}</td>
                    <td className="py-1">{t.est.mediaDesempenho === null ? "—" : num(t.est.mediaDesempenho)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-apagado">G+A/90 só aparece com pelo menos 90 minutos jogados.</p>
      </Cartao>
    </div>
  );
}

// ───────────── Cardio ─────────────

export async function AbaCardio({ user, hojeK }: Props) {
  const tz = user.timezone;
  const lista = await carregarAtividades(user.id, somaDias(hojeK, -365), hojeK, "cardio");
  const resumo = lista.map(resumoDe);
  const de = somaDias(hojeK, -6);
  const semana = lista.filter((a) => dataParaChave(a.day) >= de);
  const minSemana = semana.reduce((s, a) => s + a.durationMin, 0);
  const kmSemana = semana.reduce((s, a) => s + (a.distanceKm ?? 0), 0);
  const semanas = minutosPorSemana(resumo, hojeK, 8);
  const corridas = lista.filter((a) => a.subtype === "corrida" && a.distanceKm);
  const melhorRitmo = corridas.reduce<{ seg: number; a: (typeof lista)[number] } | null>((m, a) => {
    const seg = (a.durationMin * 60) / (a.distanceKm ?? 1);
    return !m || seg < m.seg ? { seg, a } : m;
  }, null);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex justify-end lg:col-span-3">
        <Dialogo gatilho={<><Footprints className="h-4 w-4" /> Registrar cardio</>} classeGatilho={classesBotao("primario", "p")} titulo="Registrar cardio">
          <FormCardio hoje={hojeK} />
        </Dialogo>
      </div>
      <section aria-label="Cardio nos últimos 7 dias" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-3">
        <Kpi rotulo="Minutos (7 dias)" valor={formatarDuracao(minSemana)} detalhe={`${semana.length} sessão(ões)`} />
        <Kpi rotulo="Distância (7 dias)" valor={`${num(kmSemana, 1)} km`} detalhe="quando informada" />
        <Kpi
          rotulo="Melhor ritmo (corrida)"
          valor={melhorRitmo ? ritmo(melhorRitmo.a.durationMin, melhorRitmo.a.distanceKm) : "—"}
          detalhe={melhorRitmo ? diaCurto(dataParaChave(melhorRitmo.a.day)) : "corridas com distância"}
        />
      </section>
      <Cartao titulo="Minutos de cardio por semana" icone={CalendarRange} className="lg:col-span-2">
        <GraficoBarras
          dados={semanas.map((s) => ({ rotulo: diaCurto(s.inicio), valor: s.minutos }))}
          nome="Minutos"
          unidade=" min"
          descricao="Minutos de cardio por semana nas últimas 8 semanas"
        />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
          <table className="mt-2 w-full text-left text-xs">
            <tbody className="numero">
              {semanas.map((s) => (
                <tr key={s.inicio} className="border-t border-borda">
                  <td className="py-1">semana de {diaCurto(s.inicio)}</td>
                  <td className="py-1">{s.minutos} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Cartao>
      <Cartao titulo="Por atividade (30 dias)" icone={IconeAtividade}>
        <ul className="grid grid-cols-1 gap-1.5 text-sm">
          {Object.entries(TIPOS_CARDIO).map(([k, v]) => {
            const l = lista.filter((a) => a.subtype === k && dataParaChave(a.day) >= somaDias(hojeK, -29));
            if (l.length === 0) return null;
            return (
              <li key={k} className="flex justify-between gap-2">
                <span>{v}</span>
                <span className="numero text-suave">
                  {l.length}× · {formatarDuracao(l.reduce((s, a) => s + a.durationMin, 0))}
                </span>
              </li>
            );
          })}
        </ul>
        {lista.filter((a) => dataParaChave(a.day) >= somaDias(hojeK, -29)).length === 0 && <p className="text-sm text-suave">Nada nos últimos 30 dias.</p>}
      </Cartao>
      <Cartao titulo="Histórico" icone={History} className="lg:col-span-3">
        {lista.length === 0 ? (
          <Vazio icone={Footprints} titulo="Nenhum cardio ainda">Caminhada, corrida, bicicleta, esteira, natação…</Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {lista.slice(0, 30).map((a) => (
              <ItemAtividade key={a.id} a={a} tz={tz} hojeK={hojeK} mostrarNotas />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

// ───────────── Recuperação ─────────────

const QUALIDADE: Record<number, string> = { 1: "Muito ruim", 2: "Ruim", 3: "Regular", 4: "Boa", 5: "Muito boa" };

export async function AbaRecuperacao({ user, hojeK }: Props) {
  const [base, recs, sono, planejados] = await Promise.all([
    baseDosAlertas(user.id, hojeK),
    carregarRecuperacao(user.id, somaDias(hojeK, -20), hojeK),
    sonoRecente(user, hojeK, 7),
    carregarRecuperacao(user.id, somaDias(hojeK, 1), somaDias(hojeK, 7)),
  ]);
  const deHoje = recs.find((r) => dataParaChave(r.day) === hojeK);
  const inicial = (r: (typeof recs)[number] | undefined) =>
    r
      ? {
          descanso: r.restDay,
          cansaco: r.fatigue,
          recuperacao: r.recovery,
          dor: r.soreness,
          desconforto: r.discomfort,
          local: r.bodyPart,
          notas: r.notes,
        }
      : null;
  const fmtSono = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Cartao titulo="Alertas" icone={ShieldCheck} className="lg:col-span-5">
        <ListaAlertas alertas={base.alertas} vazio="Nenhum sinal de esforço acumulado. Descansar faz parte do treino." />
      </Cartao>

      <Cartao titulo="Como você está hoje" icone={BedDouble} className="lg:col-span-3">
        <FormRecuperacao dia={hojeK} hoje={hojeK} inicial={inicial(deHoje)} />
      </Cartao>

      <div className="grid grid-cols-1 gap-4 lg:col-span-2">
        <Cartao titulo="Sono das últimas noites" icone={MoonStar} acao={<Link href="/sono" className={classesBotao("fantasma", "p")}>Sleep Lab</Link>}>
          {sono.length === 0 ? (
            <p className="text-sm text-suave">
              Nenhuma noite registrada. <Link href="/sono" className="text-eletrico-claro hover:underline">Registre o sono no Sleep Lab</Link> para ver aqui a
              relação com a recuperação.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 text-sm">
              {sono.map((s) => (
                <li key={s.dia} className="flex items-center justify-between gap-2">
                  <span className="text-suave">{diaRelativo(s.dia, hojeK)}</span>
                  <span className="numero">{fmtSono(s.minutos)}</span>
                  <span className="text-xs text-apagado">{s.qualidade ? QUALIDADE[s.qualidade] : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        {planejados.some((r) => r.restDay) && (
          <Cartao titulo="Descansos planejados" icone={CalendarRange}>
            <ul className="grid grid-cols-1 gap-1 text-sm">
              {planejados
                .filter((r) => r.restDay)
                .reverse()
                .map((r) => (
                  <li key={dataParaChave(r.day)} className="flex items-center justify-between gap-2">
                    <span>{diaRelativo(dataParaChave(r.day), hojeK)}</span>
                    <form action={excluirRecuperacao}>
                      <input type="hidden" name="dia" value={dataParaChave(r.day)} />
                      <button className="rounded-lg p-1 text-apagado hover:text-perigo" aria-label={`Desmarcar descanso de ${diaRelativo(dataParaChave(r.day), hojeK)}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          </Cartao>
        )}
      </div>

      <Cartao titulo="Últimos registros" icone={History} className="lg:col-span-5">
        {recs.length === 0 ? (
          <p className="text-sm text-suave">Registre o dia para acompanhar cansaço, recuperação e dores.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {recs.map((r) => {
              const dia = dataParaChave(r.day);
              const rr = recuperacaoDe(r);
              const partes = [
                rr.cansaco !== null && `cansaço ${rr.cansaco}/5`,
                rr.recuperacao !== null && `recuperação ${rr.recuperacao}/5`,
                rr.dor !== null && `dor ${rr.dor}/5`,
              ].filter(Boolean);
              return (
                <li key={dia} className="flex items-start gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {diaRelativo(dia, hojeK)}
                      {r.restDay && <Selo cor="#34d399">descanso</Selo>}
                    </p>
                    <p className="mt-0.5 text-xs text-suave">{partes.length ? partes.join(" · ") : "—"}</p>
                    {r.discomfort && (
                      <p className="mt-0.5 text-xs text-alerta">
                        {r.discomfort}
                        {r.bodyPart && ` (${r.bodyPart})`}
                      </p>
                    )}
                  </div>
                  <Dialogo
                    gatilho={<Pencil className="h-4 w-4" />}
                    rotuloGatilho={`Editar recuperação de ${diaRelativo(dia, hojeK)}`}
                    classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-white/5 hover:text-texto"
                    titulo="Editar recuperação"
                  >
                    <FormRecuperacao dia={dia} hoje={hojeK} inicial={inicial(r)} />
                  </Dialogo>
                  <form action={excluirRecuperacao}>
                    <input type="hidden" name="dia" value={dia} />
                    <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Apagar recuperação de ${diaRelativo(dia, hojeK)}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

