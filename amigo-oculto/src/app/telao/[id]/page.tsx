import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { pessoasDoGrupo } from "@/components/jogos/dados";
import { Telao } from "@/components/aovivo/telao";
import { BotaoLink } from "@/components/ui/botao";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  await exigirUsuario(`/telao/${id}`);
  const g = await carregarGrupo(id);
  return { title: `Telão — ${g.evento.name}` };
}

/** Telão da revelação ao vivo: tela cheia, fora da casca do app, só para organizadores. */
export default async function PaginaTelao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirUsuario(`/telao/${id}`); // sem login: entra e volta para o telão
  const g = await carregarGrupo(id);
  if (!g.admin) {
    return (
      <main className="fundo-festivo flex min-h-dvh items-center justify-center p-6" data-tema={g.evento.theme}>
        <div className="vidro-forte flex max-w-md flex-col items-center gap-3 rounded-cartao p-8 text-center">
          <Lock className="size-10 text-ouro" aria-hidden />
          <h1 className="font-titulo text-2xl font-semibold">Telão só para organizadores</h1>
          <p className="text-suave">Acompanhe a revelação pelo seu celular: quando for a sua vez, você revela por lá.</p>
          <BotaoLink href={`/grupo/${id}/ao-vivo/participar`} className="mt-2">
            Abrir o modo ao vivo
          </BotaoLink>
        </div>
      </main>
    );
  }
  const supabase = await clienteServidor();
  const [pessoas, s, r, p] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    supabase.from("live_sessions").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("live_reveals").select("id, giver_id, receiver_id, method, revealed_at").eq("event_id", id).order("revealed_at"),
    supabase.from("live_clues").select("id, participant_id, body, created_at").eq("event_id", id).order("created_at"),
  ]);
  return (
    <Telao
      eventoId={id}
      euId={g.eu.id}
      evento={{ nome: g.evento.name, tema: g.evento.theme, status: g.evento.status }}
      pessoas={pessoas.map((x) => ({ id: x.id, nome: x.nome, avatar: x.avatar, autorizaRevelar: x.autorizaRevelar }))}
      inicial={{
        sessao: s.data ?? null,
        revelacoes: r.data ?? [],
        pistas: p.data ?? [],
        autoriza: Object.fromEntries(pessoas.map((x) => [x.id, x.autorizaRevelar])),
      }}
    />
  );
}
