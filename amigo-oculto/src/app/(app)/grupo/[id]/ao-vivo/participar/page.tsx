import { Radio } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { meuAmigo, pessoasDoGrupo } from "@/components/jogos/dados";
import { ParticiparAoVivo } from "@/components/aovivo/participar";
import { BotaoLink } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/cartao";

export const metadata = { title: "Revelação ao vivo" };

export default async function PaginaParticipar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  if (g.evento.status === "open") {
    return (
      <Vazio
        icone={<Radio className="size-10" />}
        titulo="A revelação ao vivo vem depois do sorteio"
        texto="Quando o sorteio sair, o organizador pode abrir o telão no dia do encontro e cada um revela pelo celular."
        acao={<BotaoLink href={`/grupo/${id}`} variante="vidro">Voltar à visão geral</BotaoLink>}
      />
    );
  }
  const supabase = await clienteServidor();
  const [pessoas, s, r, p, amigo] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    supabase.from("live_sessions").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("live_reveals").select("id, giver_id, receiver_id, method, revealed_at").eq("event_id", id).order("revealed_at"),
    supabase.from("live_clues").select("id, participant_id, body, created_at").eq("event_id", id).order("created_at"),
    meuAmigo(supabase, id),
  ]);
  return (
    <ParticiparAoVivo
      eventoId={id}
      euId={g.eu.id}
      admin={g.admin}
      pessoas={pessoas.map((x) => ({ id: x.id, nome: x.nome, avatar: x.avatar, autorizaRevelar: x.autorizaRevelar }))}
      inicial={{
        sessao: s.data ?? null,
        revelacoes: r.data ?? [],
        pistas: p.data ?? [],
        autoriza: Object.fromEntries(pessoas.map((x) => [x.id, x.autorizaRevelar])),
      }}
      meuAmigo={amigo ? { nome: amigo.nome, avatar: amigo.avatar } : null}
    />
  );
}
