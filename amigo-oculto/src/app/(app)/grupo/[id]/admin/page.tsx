import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2 } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { NavAdmin } from "@/components/admin/nav-admin";
import { SECOES, secaoValida, type IdSecao } from "@/components/admin/secoes";
import { SecaoResumo } from "@/components/admin/secao-resumo";
import { SecaoParticipantes } from "@/components/admin/secao-participantes";
import { SecaoSorteio } from "@/components/admin/secao-sorteio";
import { SecaoRestricoes } from "@/components/admin/secao-restricoes";
import { SecaoConvites } from "@/components/admin/secao-convites";
import { SecaoAvisos } from "@/components/admin/secao-avisos";
import { SecaoModeracao } from "@/components/admin/secao-moderacao";
import { SecaoEvento } from "@/components/admin/secao-evento";
import { SecaoEncerramento } from "@/components/admin/secao-encerramento";
import { classesBotao } from "@/components/ui/botao";

export const metadata: Metadata = { title: "Painel do organizador" };

/**
 * Painel do organizador. Só para organizadores aprovados (os outros recebem 404). Cada seção carrega só os próprios
 * dados. Nada aqui mostra quem tirou quem — nem as funções que o painel usa devolvem isso.
 */
export default async function PaginaAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba } = await searchParams;
  const g = await carregarGrupo(id);
  if (!g.admin) notFound();
  const secao: IdSecao = secaoValida(aba);

  const supabase = await clienteServidor();
  const [{ count: pedidos }, { count: denuncias }] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("event_id", id).is("resolved_at", null),
  ]);
  const titulo = SECOES.find((s) => s.id === secao)!.rotulo;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-3">
        <NavAdmin id={id} atual={secao} contadores={{ participantes: pedidos ?? 0, moderacao: denuncias ?? 0 }} />
        <Link href={`/grupo/${id}/compartilhar`} className={classesBotao("vidro", "m", "hidden lg:inline-flex")}>
          <Share2 className="size-4" aria-hidden /> Convidar pessoas
        </Link>
      </div>
      <section aria-labelledby="titulo-secao-admin" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t1">Painel do organizador</p>
            <h2 id="titulo-secao-admin" className="font-titulo text-2xl font-semibold leading-tight">
              {titulo}
            </h2>
          </div>
          <Link href={`/grupo/${id}/compartilhar`} className={classesBotao("vidro", "p", "lg:hidden")}>
            <Share2 className="size-4" aria-hidden /> Convidar
          </Link>
        </div>
        {secao === "resumo" ? <SecaoResumo g={g} /> : null}
        {secao === "participantes" ? <SecaoParticipantes g={g} /> : null}
        {secao === "sorteio" ? <SecaoSorteio g={g} /> : null}
        {secao === "restricoes" ? <SecaoRestricoes g={g} /> : null}
        {secao === "convites" ? <SecaoConvites g={g} /> : null}
        {secao === "avisos" ? <SecaoAvisos g={g} /> : null}
        {secao === "moderacao" ? <SecaoModeracao g={g} /> : null}
        {secao === "evento" ? <SecaoEvento g={g} /> : null}
        {secao === "encerramento" ? <SecaoEncerramento g={g} /> : null}
      </section>
    </div>
  );
}
