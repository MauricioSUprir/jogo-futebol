import Link from "next/link";
import { Gift, ListChecks, Vote } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dataHora } from "@/lib/formatos";
import { Vazio } from "@/components/ui/cartao";
import { AtualizarAoVivo } from "@/components/sala/ao-vivo";
import { carregarMembros } from "@/components/sala/dados";
import { NovaEnquete } from "@/components/enquetes/nova-enquete";
import { CartaoEnquete } from "@/components/enquetes/cartao-enquete";
import type { EnqueteVista } from "@/components/enquetes/tipos";
import { cn } from "@/lib/cn";

export const metadata = { title: "Enquetes" };

type Bruta = {
  id: string;
  question: string;
  category: string;
  allow_multiple: boolean;
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  created_by: string | null;
  poll_options: { id: string; label: string; position: number }[];
  poll_votes: { option_id: string; user_id: string }[];
};

export default async function Enquetes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ categoria?: string | string[]; nova?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filtro = sp.categoria === "presente" ? "presente" : sp.categoria === "geral" ? "geral" : null;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [membros, { data }] = await Promise.all([
    carregarMembros(id),
    supabase
      .from("polls")
      .select("id, question, category, allow_multiple, closes_at, closed_at, created_at, created_by, poll_options(id, label, position), poll_votes(option_id, user_id)")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const perfil = new Map(membros.map((m) => [m.usuarioId, m] as const));
  const agora = Date.now();
  const todas: EnqueteVista[] = ((data ?? []) as unknown as Bruta[]).map((p) => {
    const aberta = !p.closed_at && (!p.closes_at || new Date(p.closes_at).getTime() > agora);
    const autor = p.created_by ? perfil.get(p.created_by) : undefined;
    return {
      id: p.id,
      pergunta: p.question,
      categoria: p.category === "presente" ? "presente" : "geral",
      multipla: p.allow_multiple,
      encerraEm: p.closes_at,
      encerradaEm: p.closed_at,
      criadaEm: p.created_at,
      aberta,
      autor: autor ? { nome: autor.nome, avatar: autor.avatar } : null,
      podeGerenciar: g.admin || p.created_by === g.usuario.id,
      totalVotantes: new Set(p.poll_votes.map((v) => v.user_id)).size,
      meusVotos: p.poll_votes.filter((v) => v.user_id === g.usuario.id).map((v) => v.option_id),
      opcoes: [...p.poll_options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          id: o.id,
          rotulo: o.label,
          votantes: p.poll_votes
            .filter((v) => v.option_id === o.id)
            .map((v) => {
              const m = perfil.get(v.user_id);
              return { usuarioId: v.user_id, nome: m?.nome ?? "Ex-participante", avatar: m?.avatar ?? null };
            }),
        })),
    };
  });
  const lista = todas
    .filter((e) => !filtro || e.categoria === filtro)
    .sort((a, b) => Number(b.aberta) - Number(a.aberta) || b.criadaEm.localeCompare(a.criadaEm));
  const contagem = {
    todas: todas.length,
    geral: todas.filter((e) => e.categoria === "geral").length,
    presente: todas.filter((e) => e.categoria === "presente").length,
  };
  const eu = membros.find((m) => m.usuarioId === g.usuario.id);
  const silenciado = g.eu.muted_until && new Date(g.eu.muted_until) > new Date() ? g.eu.muted_until : null;
  const bloqueio = g.evento.archived_at
    ? "O grupo está arquivado."
    : silenciado
      ? `O organizador silenciou você até ${dataHora(silenciado)}.`
      : null;
  const base = `/grupo/${id}/enquetes`;
  const abas = [
    { href: base, rotulo: "Todas", n: contagem.todas, atual: !filtro, icone: Vote },
    { href: `${base}?categoria=geral`, rotulo: "Gerais", n: contagem.geral, atual: filtro === "geral", icone: ListChecks },
    { href: `${base}?categoria=presente`, rotulo: "Sobre presentes", n: contagem.presente, atual: filtro === "presente", icone: Gift },
  ];

  return (
    <section aria-labelledby="titulo-enquetes" className="flex flex-col gap-4">
      <AtualizarAoVivo
        canal={`sala-enquetes:${id}`}
        assinaturas={[
          { tabela: "polls", filtro: `event_id=eq.${id}` },
          { tabela: "polls", evento: "DELETE", campo: "id", valores: todas.map((e) => e.id) },
          { tabela: "poll_votes", campo: "poll_id", valores: todas.map((e) => e.id) },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-enquetes" className="font-titulo text-2xl font-semibold">
            Enquetes
          </h2>
          <p className="text-sm text-suave">Decidam juntos: data, lugar, valor, ideias de presente. Os votos aparecem na hora.</p>
        </div>
        <NovaEnquete eventoId={id} categoriaInicial={filtro === "presente" ? "presente" : "geral"} bloqueio={bloqueio} abrirAoCarregar={sp.nova === "1"} />
      </div>

      <nav aria-label="Filtrar enquetes" className="-mx-3 sm:mx-0">
        <ul className="rolagem-fina flex gap-2 overflow-x-auto px-3 pb-1 sm:px-0">
          {abas.map((a) => (
            <li key={a.href} className="shrink-0">
              <Link
                href={a.href}
                aria-current={a.atual ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition",
                  a.atual
                    ? "border-t1 bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1"
                    : "border-borda text-suave hover:text-texto",
                )}
              >
                <a.icone className="size-4" aria-hidden /> {a.rotulo}
                <span className="rounded-full bg-black/5 px-1.5 text-xs tabular-nums dark:bg-white/10">{a.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {lista.length ? (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {lista.map((e) => (
            <li key={e.id}>
              <CartaoEnquete eventoId={id} enquete={e} eu={{ id: g.usuario.id, nome: eu?.nome ?? "Você", avatar: eu?.avatar ?? null }} />
            </li>
          ))}
        </ul>
      ) : (
        <Vazio
          icone={filtro === "presente" ? <Gift className="size-8" aria-hidden /> : <Vote className="size-8" aria-hidden />}
          titulo={filtro === "presente" ? "Nenhuma enquete sobre presentes" : filtro === "geral" ? "Nenhuma enquete geral" : "Nenhuma enquete ainda"}
          texto={
            filtro === "presente"
              ? "Pergunte ao grupo sobre valor, tipo de presente ou embrulho — sem entregar quem você tirou."
              : "Crie a primeira enquete e deixe o grupo decidir junto."
          }
        />
      )}
    </section>
  );
}
