// GOALS CENTER — metas com etapas ou número, prazos, objetivos anuais, concluídas e conquistas.
import Link from "next/link";
import { Award, Plus, Target, Trophy } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarMetas, paraConquistas } from "@/lib/servidor/metas";
import { hoje } from "@/lib/datas";
import { CATEGORIAS_META, conquistasMetas, ordenarMetas, type OrdemMetas } from "@/lib/metas";
import { CabecalhoPagina, Cartao, Vazio, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { FormMeta } from "@/components/metas/formularios";
import { CartaoMeta } from "@/components/metas/cartao-meta";
import { IconeCategoria } from "@/components/metas/icones";
import { RolarAbaAtiva } from "@/components/estudos/rolar-aba";
import { cn } from "@/lib/cn";

export const metadata = { title: "Goals Center" };

const ABAS = [
  { v: "ativas", nome: "Ativas" },
  { v: "anuais", nome: "Anuais" },
  { v: "concluidas", nome: "Concluídas" },
  { v: "conquistas", nome: "Conquistas" },
] as const;
type Aba = (typeof ABAS)[number]["v"];

const ORDENS: { v: OrdemMetas; nome: string }[] = [
  { v: "prioridade", nome: "Prioridade" },
  { v: "prazo", nome: "Prazo" },
  { v: "progresso", nome: "Progresso" },
  { v: "recentes", nome: "Recentes" },
];

export default async function PaginaMetas({ searchParams }: { searchParams: Promise<{ aba?: string; ordem?: string; cat?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const ano = Number(hojeK.slice(0, 4));
  const sp = await searchParams;
  const aba: Aba = ABAS.find((a) => a.v === sp.aba)?.v ?? "ativas";
  const ordem: OrdemMetas = ORDENS.find((o) => o.v === sp.ordem)?.v ?? "prioridade";
  const cat = sp.cat && sp.cat in CATEGORIAS_META ? sp.cat : null;
  const todas = await carregarMetas(user.id);
  const filtradas = cat ? todas.filter((m) => m.category === cat) : todas;
  const ativas = ordenarMetas(filtradas.filter((m) => m.status !== "concluido"), ordem);
  const concluidas = filtradas.filter((m) => m.status === "concluido").sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const conquistas = conquistasMetas(paraConquistas(todas, user.timezone));
  const anos = [...new Set(filtradas.filter((m) => m.year).map((m) => m.year!))].sort((a, b) => (a === ano ? -1 : b === ano ? 1 : b - a));

  const url = (o: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const v = { aba, ordem, cat, ...o };
    if (v.aba && v.aba !== "ativas") p.set("aba", v.aba);
    if (v.ordem && v.ordem !== "prioridade") p.set("ordem", v.ordem);
    if (v.cat) p.set("cat", v.cat);
    const q = p.toString();
    return q ? `/metas?${q}` : "/metas";
  };

  const lista = (metas: typeof todas, vazio: string) =>
    metas.length === 0 ? (
      <Cartao>
        <Vazio icone={Target} titulo={vazio} />
      </Cartao>
    ) : (
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {metas.map((m) => (
          <CartaoMeta key={m.id} m={m} hojeK={hojeK} />
        ))}
      </ul>
    );

  return (
    <>
      <CabecalhoPagina
        rotulo="Goals Center"
        titulo="Metas"
        descricao="Objetivos divididos em etapas, com prazo e progresso. As metas são suas: ajuste quando quiser."
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Nova meta</>} classeGatilho={classesBotao("primario")} titulo="Nova meta" larga>
            <FormMeta ano={ano} categoria={cat ?? undefined} />
          </Dialogo>
        }
      />
      <nav aria-label="Seções do Goals Center" className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1 rounded-xl border border-borda bg-fundo-2/60 p-1 sm:max-w-md">
          {ABAS.map((a) => (
            <Link
              key={a.v}
              href={url({ aba: a.v })}
              aria-current={aba === a.v ? "page" : undefined}
              className="flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm text-suave transition aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
            >
              {a.nome}
            </Link>
          ))}
        </div>
      </nav>
      <RolarAbaAtiva rotulo="Seções do Goals Center" aba={aba} />

      {aba !== "conquistas" && (
        <div className="mb-4 grid grid-cols-1 gap-2">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filtrar por categoria">
            <Link href={url({ cat: null })} aria-current={!cat ? "true" : undefined} className="shrink-0 rounded-full border border-borda px-3 py-1 text-xs text-suave aria-[current=true]:border-eletrico aria-[current=true]:text-texto">
              Todas
            </Link>
            {Object.entries(CATEGORIAS_META).map(([k, c]) => (
              <Link key={k} href={url({ cat: k })} aria-current={cat === k ? "true" : undefined} className="shrink-0 whitespace-nowrap rounded-full border border-borda px-3 py-1 text-xs text-suave aria-[current=true]:border-eletrico aria-[current=true]:text-texto">
                {c.curto}
              </Link>
            ))}
          </div>
          {aba === "ativas" && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-suave">
              Ordenar:
              {ORDENS.map((o) => (
                <Link key={o.v} href={url({ ordem: o.v })} aria-current={ordem === o.v ? "true" : undefined} className="rounded-md px-2 py-0.5 aria-[current=true]:bg-eletrico/20 aria-[current=true]:text-texto">
                  {o.nome}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}

      {aba === "ativas" && lista(ativas, todas.length ? "Nenhuma meta ativa aqui" : "Crie sua primeira meta")}

      {aba === "anuais" &&
        (anos.length === 0 ? (
          <Cartao>
            <Vazio icone={Target} titulo="Nenhum objetivo anual">
              Marque “Objetivo anual” ao criar uma meta para ela aparecer em “Objetivos de {ano}”.
            </Vazio>
          </Cartao>
        ) : (
          anos.map((a) => {
            const doAno = ordenarMetas(filtradas.filter((m) => m.year === a), "prioridade");
            const feitos = doAno.filter((m) => m.status === "concluido").length;
            return (
              <section key={a} className="mb-6">
                <h2 className="rotulo mb-2">
                  Objetivos de {a} · {feitos} de {doAno.length} concluídos
                </h2>
                <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {doAno.map((m) => (
                    <CartaoMeta key={m.id} m={m} hojeK={hojeK} />
                  ))}
                </ul>
              </section>
            );
          })
        ))}

      {aba === "concluidas" && lista(concluidas, "Nenhuma meta concluída ainda")}

      {aba === "conquistas" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Cartao titulo="Conquistas" icone={Award} holo>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {conquistas.map((c) => (
                <li
                  key={c.id}
                  data-conquista={c.id}
                  data-ok={c.ok ? "1" : "0"}
                  className={cn("flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-3 text-center", c.ok ? "holo border-transparent bg-eletrico/10" : "border-borda opacity-45")}
                  title={c.ok ? `Conquistado: ${c.descricao}` : `Bloqueado: ${c.descricao}`}
                >
                  <Trophy className={cn("h-6 w-6", c.ok ? "text-alerta" : "text-apagado")} aria-hidden />
                  <span className="text-sm font-semibold">{c.nome}</span>
                  <span className="text-[0.68rem] leading-tight text-suave">{c.descricao}</span>
                  <span className="sr-only">{c.ok ? "conquistada" : "bloqueada"}</span>
                </li>
              ))}
            </ul>
          </Cartao>
          <Cartao titulo="Metas concluídas por categoria" icone={Target}>
            <ul className="grid grid-cols-1 gap-2">
              {Object.entries(CATEGORIAS_META).map(([k, c]) => {
                const n = todas.filter((m) => m.category === k && m.status === "concluido").length;
                const total = todas.filter((m) => m.category === k).length;
                return (
                  <li key={k} className="flex items-center gap-3">
                    <IconeCategoria categoria={k} tamanho="p" />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                    <span className="numero text-sm text-suave">
                      {n}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        </div>
      )}
    </>
  );
}
