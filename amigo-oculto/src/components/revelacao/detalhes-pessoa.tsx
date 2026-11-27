import { Ban, Check, ExternalLink, Gift, Heart, Lightbulb, ListChecks, Palette, Ruler, StickyNote, Tag } from "lucide-react";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { urlPublicaDaMidia } from "@/lib/env";
import { dinheiro } from "@/lib/formatos";
import { amostraDaCor } from "@/lib/sugestoes/cores";
import type { Sugestao } from "@/lib/sugestoes/motor";

/**
 * Detalhes da pessoa sorteada (lista de desejos, preferências e sugestões). Componentes sem estado: servem para a
 * página real (dados do banco) e para a demonstração da página inicial (dados de exemplo).
 */
export type ItemDesejo = {
  id: string;
  title: string;
  notes?: string | null;
  url?: string | null;
  image_path?: string | null;
  price_estimate?: number | string | null;
};

export type PreferenciasPessoa = {
  hobbies?: string[] | null;
  interests?: string[] | null;
  favorite_colors?: string[] | null;
  shirt_size?: string | null;
  pants_size?: string | null;
  shoe_size?: string | null;
  dislikes?: string[] | null;
  notes?: string | null;
} | null;

function dominio(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Chip({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "rubi" }) {
  return (
    <span
      className={
        tom === "rubi"
          ? "inline-flex items-center gap-1.5 rounded-full bg-rubi/10 px-3 py-1 text-sm font-medium text-rubi"
          : "inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--t1)_10%,transparent)] px-3 py-1 text-sm font-medium text-texto"
      }
    >
      {children}
    </span>
  );
}

export function ListaDesejosRevelada({
  nome,
  itens,
  orcamentoMax,
  vazio,
}: {
  nome: string;
  itens: ItemDesejo[];
  orcamentoMax?: number | null;
  /** o que mostrar quando a lista está vazia (ex.: atalho para mandar uma mensagem anônima) */
  vazio?: React.ReactNode;
}) {
  const primeiro = nome.split(/\s+/)[0];
  return (
    <Cartao>
      <TituloCartao
        icone={<ListChecks className="size-5" aria-hidden />}
        titulo="Lista de desejos"
        descricao={itens.length ? `${itens.length} ${itens.length === 1 ? "ideia" : "ideias"} de ${primeiro}` : undefined}
      />
      {itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center">
          <p className="font-semibold">{primeiro} ainda não preencheu a lista de desejos.</p>
          <div className="mt-1 text-sm text-suave">{vazio ?? "Veja as preferências e as ideias abaixo."}</div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((item) => {
            const foto = urlPublicaDaMidia(item.image_path);
            const preco = item.price_estimate !== null && item.price_estimate !== undefined && item.price_estimate !== "" ? Number(item.price_estimate) : null;
            const site = item.url ? dominio(item.url) : null;
            const acima = preco !== null && orcamentoMax ? preco > orcamentoMax * 1.15 : false;
            return (
              <li key={item.id} className="flex gap-3 rounded-2xl bg-white/50 p-3 ring-1 ring-borda dark:bg-white/5">
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto} alt="" width={64} height={64} loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span aria-hidden className="inline-flex size-16 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
                    <Gift className="size-7" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug break-words">{item.title}</p>
                  {item.notes ? <p className="mt-0.5 line-clamp-3 text-sm text-suave break-words">{item.notes}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {preco !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-ouro-escuro dark:text-ouro-claro">
                        <Tag className="size-3.5" aria-hidden /> cerca de {dinheiro(preco)}
                      </span>
                    ) : null}
                    {acima ? <Selo cor="ouro">acima do valor do grupo</Selo> : null}
                    {item.url && site ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        className="inline-flex min-h-8 items-center gap-1 font-semibold text-t1 underline-offset-4 hover:underline"
                      >
                        Ver em {site}
                        <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(abre em outra aba)</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

export function PreferenciasReveladas({ nome, prefs }: { nome: string; prefs: PreferenciasPessoa }) {
  const primeiro = nome.split(/\s+/)[0];
  const gostos = [...(prefs?.hobbies ?? []), ...(prefs?.interests ?? [])].filter((s) => s.trim());
  const cores = (prefs?.favorite_colors ?? []).filter((s) => s.trim());
  const naoQuer = (prefs?.dislikes ?? []).filter((s) => s.trim());
  const tamanhos = [
    ["Camiseta", prefs?.shirt_size],
    ["Calça", prefs?.pants_size],
    ["Calçado", prefs?.shoe_size],
  ].filter(([, v]) => v && String(v).trim()) as [string, string][];
  const nada = !gostos.length && !cores.length && !naoQuer.length && !tamanhos.length && !prefs?.notes?.trim();

  return (
    <Cartao>
      <TituloCartao icone={<Heart className="size-5" aria-hidden />} titulo="Preferências" descricao={`O que ${primeiro} contou sobre os próprios gostos`} />
      {nada ? (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
          {primeiro} ainda não preencheu as preferências.
        </p>
      ) : (
        <dl className="flex flex-col gap-4">
          {gostos.length ? (
            <div>
              <dt className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-suave">
                <Heart className="size-4" aria-hidden /> Gosta de
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {gostos.map((g, i) => (
                  <Chip key={`${g}-${i}`}>{g}</Chip>
                ))}
              </dd>
            </div>
          ) : null}
          {cores.length ? (
            <div>
              <dt className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-suave">
                <Palette className="size-4" aria-hidden /> Cores favoritas
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {cores.map((c, i) => {
                  const amostra = amostraDaCor(c);
                  return (
                    <Chip key={`${c}-${i}`}>
                      {amostra ? <span aria-hidden className="size-3.5 rounded-full ring-1 ring-black/15 dark:ring-white/25" style={{ background: amostra }} /> : null}
                      {c}
                    </Chip>
                  );
                })}
              </dd>
            </div>
          ) : null}
          {tamanhos.length ? (
            <div>
              <dt className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-suave">
                <Ruler className="size-4" aria-hidden /> Tamanhos
              </dt>
              <dd className="grid grid-cols-3 gap-2">
                {tamanhos.map(([rotulo, valor]) => (
                  <span key={rotulo} className="flex flex-col items-center rounded-2xl bg-white/50 px-2 py-2 ring-1 ring-borda dark:bg-white/5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-suave">{rotulo}</span>
                    <span className="font-titulo text-lg font-semibold">{valor}</span>
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {naoQuer.length ? (
            <div>
              <dt className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-suave">
                <Ban className="size-4" aria-hidden /> Prefere não ganhar
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {naoQuer.map((d, i) => (
                  <Chip key={`${d}-${i}`} tom="rubi">
                    {d}
                  </Chip>
                ))}
              </dd>
            </div>
          ) : null}
          {prefs?.notes?.trim() ? (
            <div>
              <dt className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-suave">
                <StickyNote className="size-4" aria-hidden /> Observações
              </dt>
              <dd className="whitespace-pre-line rounded-2xl bg-white/50 p-3 text-sm leading-relaxed ring-1 ring-borda break-words dark:bg-white/5">
                {prefs.notes}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </Cartao>
  );
}

export function SugestoesPresente({ sugestoes, orcamento }: { sugestoes: Sugestao[]; orcamento?: string | null }) {
  return (
    <Cartao>
      <TituloCartao
        icone={<Lightbulb className="size-5" aria-hidden />}
        titulo="Ideias com base nos interesses"
        descricao={orcamento ? `Pensadas para o orçamento do grupo: ${orcamento}` : "O grupo não definiu um valor: as ideias vão de lembrancinhas a presentes maiores."}
      />
      {sugestoes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
          Não achamos ideias para esse valor. Que tal olhar a lista de desejos ou perguntar por uma mensagem anônima?
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sugestoes.map((s) => (
            <li key={s.id} className="flex flex-col rounded-2xl bg-white/50 p-4 ring-1 ring-borda dark:bg-white/5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-snug">{s.titulo}</p>
                {s.orcamento === "perto" ? <Selo cor="ouro" className="shrink-0">perto do valor</Selo> : null}
              </div>
              <p className="mt-1 text-sm text-suave">{s.descricao}</p>
              <p className="mt-2 font-titulo text-lg font-semibold text-ouro-escuro dark:text-ouro-claro">
                {s.faixa.min === s.faixa.max ? dinheiro(s.faixa.min) : `${dinheiro(s.faixa.min)} a ${dinheiro(s.faixa.max)}`}
              </p>
              <ul className="mt-2 flex flex-col gap-1" aria-label="Por que essa ideia">
                {s.motivos.slice(0, 3).map((m) => (
                  <li key={m} className="flex items-start gap-1.5 text-[13px] leading-snug text-suave">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-esmeralda" aria-hidden />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-suave">São ideias para inspirar: confira tamanhos, cores e se a pessoa já não tem.</p>
    </Cartao>
  );
}

/** Os três juntos, no layout da página (duas colunas no PC, uma no celular). */
export function DetalhesDaPessoa({
  nome,
  desejos,
  prefs,
  sugestoes,
  orcamento,
  orcamentoMax,
  vazioDesejos,
}: {
  nome: string;
  desejos: ItemDesejo[];
  prefs: PreferenciasPessoa;
  sugestoes: Sugestao[];
  orcamento?: string | null;
  orcamentoMax?: number | null;
  vazioDesejos?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ListaDesejosRevelada nome={nome} itens={desejos} orcamentoMax={orcamentoMax} vazio={vazioDesejos} />
        <PreferenciasReveladas nome={nome} prefs={prefs} />
      </div>
      <SugestoesPresente sugestoes={sugestoes} orcamento={orcamento} />
    </div>
  );
}
