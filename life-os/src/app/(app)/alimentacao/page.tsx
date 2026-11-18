// NUTRITION HUB — hábitos alimentares sem dieta restritiva, calorias ou peso: refeições, variedade,
// planejamento (também para dias de treino), lista de compras e receitas favoritas.
import Link from "next/link";
import {
  Apple, BarChart3, BookHeart, CalendarRange, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, ListChecks, Pencil, Plus, ShoppingCart,
  Sparkles, Star, Trash2, Utensils,
} from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { diasDeTreino, refeicoesDoPeriodo, type RefeicaoDoDia } from "@/lib/servidor/alimentacao";
import { db } from "@/lib/db";
import {
  diaCurto, diaDaSemana, diaPorExtenso, diaRelativo, hoje, horaNoFuso, intervaloDeDias, minutosNoFuso, nomeDiaCurto, somaDias, validaChave,
} from "@/lib/datas";
import {
  CATEGORIAS_COMPRAS, FOME, GRUPOS, GRUPOS_VARIEDADE, REFEICOES, SACIEDADE, diasComGrupo, gruposDiferentes, planoDoDia, presencaDosGrupos,
  regularidadeHorario, resumoPorDia, sugerirRefeicao, sugestoesGentis, type CategoriaCompra, type Refeicao,
} from "@/lib/alimentacao";
import {
  alternarCompra, alternarFavorita, excluirCompra, excluirItemPlano, excluirReceita, excluirRefeicao, ingredientesNaLista, limparMarcados,
} from "@/acoes/alimentacao";
import { Barra, CabecalhoPagina, Cartao, Selo, Vazio, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormCompra, FormItemPlano, FormReceita, FormRefeicao } from "@/components/alimentacao/formularios";
import { cn } from "@/lib/cn";

export const metadata = { title: "Nutrition Hub" };

type Aba = "hoje" | "historico" | "plano" | "compras" | "receitas";
const ABAS: { v: Aba; nome: string }[] = [
  { v: "hoje", nome: "Hoje" },
  { v: "historico", nome: "Histórico" },
  { v: "plano", nome: "Plano" },
  { v: "compras", nome: "Compras" },
  { v: "receitas", nome: "Receitas" },
];

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;
const nomeRefeicao = (t: string) => REFEICOES[t as Refeicao] ?? t;

export default async function PaginaAlimentacao({ searchParams }: { searchParams: Promise<{ aba?: string; dia?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const sp = await searchParams;
  const aba: Aba = ABAS.find((a) => a.v === sp.aba)?.v ?? "hoje";
  const dia = sp.dia && validaChave(sp.dia) && sp.dia <= hojeK ? sp.dia : hojeK;
  return (
    <>
      <CabecalhoPagina
        rotulo="Nutrition Hub"
        titulo="Alimentação"
        descricao="Para uma alimentação suficiente e variada: sem dieta, sem contar calorias."
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Refeição</>} classeGatilho={classesBotao("primario")} titulo="Registrar refeição" larga>
            <FormRefeicao hoje={hojeK} tipoSugerido={sugerirRefeicao(minutosNoFuso(new Date(), user.timezone))} idPrefixo="cab" />
          </Dialogo>
        }
      />
      <nav aria-label="Seções do Nutrition Hub" className="mb-4 grid w-full max-w-xl grid-cols-5 rounded-xl border border-borda bg-fundo-2/60 p-1">
        {ABAS.map((a) => (
          <Link
            key={a.v}
            href={a.v === "hoje" ? "/alimentacao" : `/alimentacao?aba=${a.v}`}
            aria-current={aba === a.v ? "page" : undefined}
            className="truncate rounded-lg px-1 py-1.5 text-center text-[0.8rem] text-suave transition sm:text-sm aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
          >
            {a.nome}
          </Link>
        ))}
      </nav>
      {aba === "hoje" && <AbaHoje user={user} hojeK={hojeK} dia={dia} />}
      {aba === "historico" && <AbaHistorico user={user} hojeK={hojeK} />}
      {aba === "plano" && <AbaPlano user={user} hojeK={hojeK} />}
      {aba === "compras" && <AbaCompras user={user} />}
      {aba === "receitas" && <AbaReceitas user={user} />}
    </>
  );
}

// ───────────── Hoje ─────────────

function ItemRefeicao({ r, hojeK, tz }: { r: RefeicaoDoDia; hojeK: string; tz: string }) {
  return (
    <li className="rounded-xl border border-borda bg-fundo-2/50 p-3" data-testid="refeicao">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{nomeRefeicao(r.tipo)}</span>
            <span className="numero text-xs text-apagado">{horaNoFuso(r.at, tz)}</span>
          </p>
          <p className="break-words text-sm text-texto/90">{r.descricao}</p>
          {r.grupos.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Grupos">
              {r.grupos.map((g) => (
                <li key={g}>
                  <Selo cor="#34d399">{GRUPOS[g as keyof typeof GRUPOS] ?? g}</Selo>
                </li>
              ))}
            </ul>
          )}
          {(r.fome !== null || r.saciedade !== null) && (
            <p className="mt-1 text-xs text-suave">
              {r.fome !== null && <>Antes: {FOME[r.fome]}</>}
              {r.fome !== null && r.saciedade !== null && " · "}
              {r.saciedade !== null && <>Depois: {SACIEDADE[r.saciedade]}</>}
            </p>
          )}
          {r.notas && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-suave">{r.notas}</p>}
        </div>
        <div className="flex shrink-0 items-center">
          <Dialogo gatilho={<Pencil className="h-4 w-4" />} rotuloGatilho={`Editar ${nomeRefeicao(r.tipo)}`} classeGatilho={classesBotao("fantasma", "p", "px-2")} titulo="Editar refeição" larga>
            <FormRefeicao
              hoje={hojeK}
              idPrefixo={`e${r.id}`}
              inicial={{
                id: r.id,
                dia: r.dia,
                hora: horaNoFuso(r.at, tz),
                tipo: r.tipo,
                descricao: r.descricao,
                grupos: r.grupos,
                fome: r.fome,
                saciedade: r.saciedade,
                notas: r.notas,
              }}
            />
          </Dialogo>
          <form action={excluirRefeicao}>
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Apagar ${nomeRefeicao(r.tipo)} das ${horaNoFuso(r.at, tz)}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

async function AbaHoje({ user, hojeK, dia }: { user: Usuario; hojeK: string; dia: string }) {
  const tz = user.timezone;
  const ult7 = intervaloDeDias(somaDias(hojeK, -6), hojeK);
  const [semana, doDia, treino, plano] = await Promise.all([
    refeicoesDoPeriodo(user, ult7[0], hojeK),
    refeicoesDoPeriodo(user, dia, dia),
    diasDeTreino(user.id, dia, dia),
    db.mealPlanItem.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
  ]);
  const ehTreino = treino.has(dia);
  const planejado = planoDoDia(plano, dia, ehTreino);
  const gruposDia = gruposDiferentes(doDia);
  const faltam = GRUPOS_VARIEDADE.filter((g) => !gruposDia.includes(g));
  const sugestoes = sugestoesGentis(semana, ult7);
  const kpis = [
    { r: dia === hojeK ? "Refeições hoje" : "Refeições", v: String(doDia.length) },
    { r: "Variedade do dia", v: `${gruposDia.length}/${GRUPOS_VARIEDADE.length}`, d: "grupos diferentes" },
    { r: "Fruta", v: `${diasComGrupo(semana, "frutas", ult7)} de 7`, d: "dias na semana" },
    { r: "Vegetais", v: `${diasComGrupo(semana, "vegetais", ult7)} de 7`, d: "dias na semana" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.r} className="painel p-4">
            <p className="rotulo">{k.r}</p>
            <p className="numero mt-1 font-display text-xl font-bold">{k.v}</p>
            {k.d && <p className="text-[0.7rem] text-apagado">{k.d}</p>}
          </div>
        ))}
      </section>

      <Cartao
        titulo={<span className="first-letter:uppercase">{diaRelativo(dia, hojeK) === "Hoje" ? "Refeições de hoje" : diaPorExtenso(dia)}</span>}
        icone={Utensils}
        className="lg:col-span-3"
        acao={
          <>
            <Link href={`/alimentacao?dia=${somaDias(dia, -1)}`} className={classesBotao("fantasma", "icone")} aria-label="Dia anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {dia !== hojeK && (
              <>
                <Link href="/alimentacao" className={classesBotao("secundario", "p")}>
                  Hoje
                </Link>
                <Link href={`/alimentacao?dia=${somaDias(dia, 1)}`} className={classesBotao("fantasma", "icone")} aria-label="Próximo dia">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </>
        }
      >
        {doDia.length === 0 ? (
          <Vazio icone={Utensils} titulo="Nenhuma refeição registrada">Use o botão Refeição (ou o Registrar) para anotar.</Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {doDia.map((r) => (
              <ItemRefeicao key={r.id} r={r} hojeK={hojeK} tz={tz} />
            ))}
          </ul>
        )}
      </Cartao>

      <div className="grid grid-cols-1 gap-4 lg:col-span-2">
        <Cartao titulo="Variedade do dia" icone={Apple}>
          <ul className="flex flex-wrap gap-1.5" aria-label="Grupos de alimentos do dia">
            {GRUPOS_VARIEDADE.map((g) => (
              <li key={g}>
                {gruposDia.includes(g) ? (
                  <Selo cor="#34d399">
                    <Check className="h-3 w-3" aria-hidden /> {GRUPOS[g]}
                  </Selo>
                ) : (
                  <Selo className="border-borda text-apagado">{GRUPOS[g]}</Selo>
                )}
              </li>
            ))}
          </ul>
          {dia === hojeK && doDia.length > 0 && (faltam.includes("frutas") || faltam.includes("vegetais")) && (
            <p className="mt-3 text-sm text-suave">
              {faltam.includes("frutas") ? "Que tal incluir uma fruta no próximo lanche?" : "Um vegetal no almoço ou jantar ajuda a variar o prato."}
            </p>
          )}
        </Cartao>

        <Cartao
          titulo="Planejado para o dia"
          icone={CalendarRange}
          acao={ehTreino ? <Selo cor="#34d399"><Dumbbell className="h-3 w-3" aria-hidden /> Dia de treino</Selo> : undefined}
        >
          {planejado.length === 0 ? (
            <p className="text-sm text-suave">
              Nada planejado.{" "}
              <Link href="/alimentacao?aba=plano" className="text-eletrico-claro hover:underline">
                Planejar lanches e refeições
              </Link>
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 text-sm" data-testid="plano-do-dia">
              {planejado.map((i) => (
                <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-suave">{nomeRefeicao(i.slot)}:</span>
                  <span className="min-w-0 break-words">{i.description}</span>
                  {i.trainingDay && <span className="text-xs text-ok">(dia de treino)</span>}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {sugestoes.length > 0 && (
          <Cartao titulo="Sugestões" icone={Sparkles}>
            <ul className="grid grid-cols-1 gap-2">
              {sugestoes.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", s.tom === "positivo" ? "text-ok" : "text-eletrico-claro")} aria-hidden />
                  <span>{s.texto}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
    </div>
  );
}

// ───────────── Histórico ─────────────

async function AbaHistorico({ user, hojeK }: { user: Usuario; hojeK: string }) {
  const dias30 = intervaloDeDias(somaDias(hojeK, -29), hojeK);
  const ult7 = dias30.slice(-7);
  const refeicoes = await refeicoesDoPeriodo(user, dias30[0], hojeK);
  const porDia = resumoPorDia(refeicoes);
  const diasRegistrados = porDia.size;
  const media = diasRegistrados ? refeicoes.length / diasRegistrados : 0;
  const presenca = presencaDosGrupos(refeicoes);
  const semana = refeicoes.filter((r) => ult7.includes(r.dia));
  const horarios = (["cafe", "almoco", "lanche_tarde", "jantar"] as Refeicao[]).map((t) => ({ t, h: regularidadeHorario(refeicoes, t) }));
  const kpis = [
    { r: "Dias com registro", v: `${diasRegistrados}`, d: "nos últimos 30" },
    { r: "Refeições por dia", v: media.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), d: "nos dias registrados" },
    { r: "Grupos na semana", v: `${gruposDiferentes(semana).length}/${GRUPOS_VARIEDADE.length}`, d: "variedade dos últimos 7 dias" },
    { r: "Fruta e vegetal", v: `${diasComGrupo(semana, "frutas", ult7)} · ${diasComGrupo(semana, "vegetais", ult7)}`, d: "dias com cada um (7 dias)" },
  ];
  if (refeicoes.length === 0) {
    return (
      <Cartao>
        <Vazio icone={BarChart3} titulo="Sem histórico ainda">Registre as refeições por alguns dias e os padrões aparecem aqui.</Vazio>
      </Cartao>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section aria-label="Resumo de 30 dias" className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.r} className="painel p-4">
            <p className="rotulo">{k.r}</p>
            <p className="numero mt-1 font-display text-xl font-bold">{k.v}</p>
            <p className="text-[0.7rem] text-apagado">{k.d}</p>
          </div>
        ))}
      </section>
      <Cartao titulo="Grupos mais e menos presentes" icone={Apple}>
        <p className="mb-3 text-xs text-apagado">Em quantos dos dias registrados cada grupo apareceu.</p>
        <ul className="grid grid-cols-1 gap-2.5">
          {presenca.map((g) => (
            <li key={g.grupo}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{GRUPOS[g.grupo]}</span>
                <span className="numero text-suave">
                  {g.dias} de {diasRegistrados} dias
                </span>
              </div>
              <Barra pct={g.pct} cor="#3987e5" rotulo={`${GRUPOS[g.grupo]}: ${g.pct}% dos dias`} />
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Horários das refeições" icone={Clock3}>
        <p className="mb-3 text-xs text-apagado">Horário médio e quanto ele varia de um dia para o outro.</p>
        <ul className="grid grid-cols-1 gap-2">
          {horarios.map(({ t, h }) => (
            <li key={t} className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2 text-sm">
              <span>{REFEICOES[t]}</span>
              {h ? (
                <span className="numero text-right text-suave">
                  <span className="text-texto">{h.media}</span> · ±{h.desvioMin} min
                  <span className={cn("ml-2 text-xs", h.regular ? "text-ok" : "text-apagado")}>{h.regular ? "regular" : h.n < 3 ? "poucos dias" : "varia"}</span>
                </span>
              ) : (
                <span className="text-xs text-apagado">poucos registros</span>
              )}
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Dia a dia" icone={ListChecks} className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-xs">
            <thead className="text-suave">
              <tr>
                <th className="py-1 font-medium">Dia</th>
                <th className="py-1 font-medium">Refeições</th>
                <th className="py-1 font-medium">Grupos</th>
              </tr>
            </thead>
            <tbody>
              {[...porDia.entries()].reverse().map(([d, r]) => (
                <tr key={d} className="border-t border-borda align-top">
                  <td className="numero py-1.5 pr-2">
                    <Link href={`/alimentacao?dia=${d}`} className="hover:text-eletrico-claro">
                      {nomeDiaCurto(diaDaSemana(d))}, {diaCurto(d)}
                    </Link>
                  </td>
                  <td className="numero py-1.5 pr-2">{r.refeicoes}</td>
                  <td className="py-1.5 text-suave">{r.grupos.length ? r.grupos.map((g) => GRUPOS[g]).join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}

// ───────────── Planejamento ─────────────

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

async function AbaPlano({ user, hojeK }: { user: Usuario; hojeK: string }) {
  const itens = await db.mealPlanItem.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
  const hojeDow = diaDaSemana(hojeK);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Cartao
        titulo="Planejamento"
        icone={CalendarRange}
        className="lg:col-span-2"
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Planejar</>} classeGatilho={classesBotao("primario", "p")} titulo="Planejar lanche ou refeição">
            <FormItemPlano />
          </Dialogo>
        }
      >
        {itens.length === 0 ? (
          <Vazio icone={CalendarRange} titulo="Nada planejado ainda">
            Planeje os lanches da semana e o que comer em dias de treino.
          </Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {itens.map((i) => (
              <li key={i.id} className="flex items-start gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="text-suave">{nomeRefeicao(i.slot)}:</span> <span className="break-words">{i.description}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1">
                    {ORDEM_DIAS.map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-[0.65rem]",
                          i.weekdays & (1 << d) ? "bg-eletrico/20 text-texto" : "text-apagado",
                        )}
                        aria-hidden
                      >
                        {nomeDiaCurto(d)}
                      </span>
                    ))}
                    <span className="sr-only">Dias: {ORDEM_DIAS.filter((d) => i.weekdays & (1 << d)).map(nomeDiaCurto).join(", ")}</span>
                    {i.trainingDay && (
                      <Selo cor="#34d399" className="ml-1">
                        <Dumbbell className="h-3 w-3" aria-hidden /> Dia de treino
                      </Selo>
                    )}
                  </p>
                </div>
                <form action={excluirItemPlano}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Remover ${i.description} do planejamento`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao titulo="A semana" icone={CalendarRange}>
        <ol className="grid grid-cols-1 gap-2">
          {ORDEM_DIAS.map((d) => {
            const doDia = itens.filter((i) => i.weekdays & (1 << d));
            return (
              <li key={d} className={cn("rounded-xl border px-3 py-2", d === hojeDow ? "border-eletrico/50 bg-eletrico/10" : "border-borda")}>
                <p className="rotulo mb-1">{nomeDiaCurto(d)}{d === hojeDow && " · hoje"}</p>
                {doDia.length === 0 ? (
                  <p className="text-xs text-apagado">—</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-0.5 text-xs">
                    {doDia.map((i) => (
                      <li key={i.id} className="break-words">
                        {nomeRefeicao(i.slot)}: {i.description}
                        {i.trainingDay && <span className="text-ok"> · treino</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </Cartao>
    </div>
  );
}

// ───────────── Lista de compras ─────────────

async function AbaCompras({ user }: { user: Usuario }) {
  const itens = await db.shoppingItem.findMany({ where: { userId: user.id }, orderBy: [{ checked: "asc" }, { createdAt: "asc" }] });
  const pendentes = itens.filter((i) => !i.checked);
  const marcados = itens.filter((i) => i.checked);
  const porCategoria = (Object.keys(CATEGORIAS_COMPRAS) as CategoriaCompra[])
    .map((c) => ({ c, itens: pendentes.filter((i) => (i.category in CATEGORIAS_COMPRAS ? i.category : "outros") === c) }))
    .filter((g) => g.itens.length);
  const Linha = ({ i }: { i: (typeof itens)[number] }) => (
    <li className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2" data-testid="item-compra">
      <form action={alternarCompra}>
        <input type="hidden" name="id" value={i.id} />
        <input type="hidden" name="marcar" value={i.checked ? "0" : "1"} />
        <button
          className={cn(
            "grid grid-cols-1 h-7 w-7 place-items-center rounded-lg border transition",
            i.checked ? "border-ok/40 bg-ok/15 text-ok" : "border-borda text-transparent hover:border-eletrico",
          )}
          aria-label={i.checked ? `Desmarcar ${i.name}` : `Marcar ${i.name}`}
          aria-pressed={i.checked}
        >
          <Check className="h-4 w-4" />
        </button>
      </form>
      <span className={cn("min-w-0 flex-1 break-words text-sm", i.checked && "text-suave line-through decoration-suave/50")}>
        {i.name}
        {i.quantity && <span className="text-xs text-suave"> · {i.quantity}</span>}
      </span>
      <form action={excluirCompra}>
        <input type="hidden" name="id" value={i.id} />
        <button className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo" aria-label={`Tirar ${i.name} da lista`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </form>
    </li>
  );
  return (
    <div className="grid grid-cols-1 gap-4">
      <Cartao titulo="Adicionar à lista" icone={ShoppingCart}>
        <FormCompra />
      </Cartao>
      <Cartao
        titulo={`Lista · ${pendentes.length} ${pendentes.length === 1 ? "item" : "itens"}`}
        icone={ListChecks}
        acao={
          marcados.length > 0 ? (
            <form action={limparMarcados}>
              <BotaoEnvio variante="fantasma" tamanho="p" pendente="…">
                Limpar marcados ({marcados.length})
              </BotaoEnvio>
            </form>
          ) : undefined
        }
      >
        {itens.length === 0 ? (
          <Vazio icone={ShoppingCart} titulo="Lista vazia">Adicione itens ou mande os ingredientes de uma receita.</Vazio>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {porCategoria.map((g) => (
              <section key={g.c} aria-label={CATEGORIAS_COMPRAS[g.c]}>
                <h3 className="rotulo mb-1.5">{CATEGORIAS_COMPRAS[g.c]}</h3>
                <ul className="grid grid-cols-1 gap-1.5">
                  {g.itens.map((i) => (
                    <Linha key={i.id} i={i} />
                  ))}
                </ul>
              </section>
            ))}
            {marcados.length > 0 && (
              <section aria-label="No carrinho">
                <h3 className="rotulo mb-1.5">No carrinho</h3>
                <ul className="grid grid-cols-1 gap-1.5">
                  {marcados.map((i) => (
                    <Linha key={i.id} i={i} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Cartao>
    </div>
  );
}

// ───────────── Receitas ─────────────

async function AbaReceitas({ user }: { user: Usuario }) {
  const receitas = await db.recipe.findMany({ where: { userId: user.id }, orderBy: [{ favorite: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Dialogo gatilho={<><Plus className="h-4 w-4" /> Nova receita</>} classeGatilho={classesBotao("primario")} titulo="Nova receita" larga>
          <FormReceita />
        </Dialogo>
      </div>
      {receitas.length === 0 ? (
        <Cartao>
          <Vazio icone={BookHeart} titulo="Nenhuma receita ainda">Guarde as receitas favoritas e as boas para dias de treino.</Vazio>
        </Cartao>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {receitas.map((r) => (
            <li key={r.id} className="painel p-4" data-testid="receita">
              <div className="mb-2 flex items-start gap-2">
                <h3 className="min-w-0 flex-1 break-words font-display font-semibold">{r.title}</h3>
                <form action={alternarFavorita}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="favorita" value={r.favorite ? "0" : "1"} />
                  <button
                    className={cn("rounded-lg p-1.5 transition", r.favorite ? "text-alerta" : "text-apagado hover:text-texto")}
                    aria-label={r.favorite ? `Tirar ${r.title} das favoritas` : `Marcar ${r.title} como favorita`}
                    aria-pressed={r.favorite}
                  >
                    <Star className={cn("h-4 w-4", r.favorite && "fill-current")} />
                  </button>
                </form>
              </div>
              {(r.tags.length > 0 || r.forTraining) && (
                <ul className="mb-2 flex flex-wrap gap-1">
                  {r.forTraining && (
                    <li>
                      <Selo cor="#34d399">
                        <Dumbbell className="h-3 w-3" aria-hidden /> Dia de treino
                      </Selo>
                    </li>
                  )}
                  {r.tags.map((t) => (
                    <li key={t}>
                      <Selo cor="#94a3b8">{t}</Selo>
                    </li>
                  ))}
                </ul>
              )}
              <p className="rotulo mb-1">Ingredientes</p>
              <p className="whitespace-pre-wrap break-words text-sm text-texto/90">{r.ingredients}</p>
              {r.steps && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-suave hover:text-texto">Modo de preparo</summary>
                  <p className="mt-1 whitespace-pre-wrap break-words text-texto/90">{r.steps}</p>
                </details>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borda pt-3">
                <form action={ingredientesNaLista}>
                  <input type="hidden" name="id" value={r.id} />
                  <BotaoEnvio variante="secundario" tamanho="p" pendente="Adicionando…">
                    <ShoppingCart className="h-4 w-4" /> Ingredientes na lista
                  </BotaoEnvio>
                </form>
                <Dialogo gatilho="Editar" classeGatilho={classesBotao("fantasma", "p")} titulo="Editar receita" larga>
                  <FormReceita
                    inicial={{ id: r.id, titulo: r.title, ingredientes: r.ingredients, preparo: r.steps, etiquetas: r.tags, treino: r.forTraining, favorita: r.favorite }}
                  />
                </Dialogo>
                <Dialogo
                  gatilho={<Trash2 className="h-4 w-4" />}
                  rotuloGatilho={`Apagar ${r.title}`}
                  classeGatilho={classesBotao("fantasma", "p", "px-2 hover:text-perigo")}
                  titulo="Apagar esta receita?"
                >
                  <form action={excluirReceita}>
                    <input type="hidden" name="id" value={r.id} />
                    <BotaoEnvio variante="perigo" className="w-full" pendente="Apagando…">
                      Apagar receita
                    </BotaoEnvio>
                  </form>
                </Dialogo>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
