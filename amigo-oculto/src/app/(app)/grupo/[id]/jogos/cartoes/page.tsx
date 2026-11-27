import { Mail } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { meuAmigo, pessoasDoGrupo } from "@/components/jogos/dados";
import { TopoJogo } from "@/components/jogos/topo-jogo";
import { Cartoes, type CartaoEnviado, type CartaoRecebido } from "@/components/jogos/cartoes";

export const metadata = { title: "Cartões virtuais" };

export default async function PaginaCartoes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba } = await searchParams;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [pessoas, amigo, { data: meus }] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    g.evento.status !== "open" ? meuAmigo(supabase, id) : Promise.resolve(null),
    // my_cards também marca os recebidos como lidos (a pessoa está vendo agora)
    supabase.rpc("my_cards", { p_event: id }),
  ]);
  const cartoes = (meus ?? { received: [], sent: [] }) as { received: CartaoRecebido[]; sent: CartaoEnviado[] };
  const eu = pessoas.find((p) => p.id === g.eu.id);
  return (
    <div>
      <TopoJogo
        eventoId={id}
        icone={<Mail className="size-6" aria-hidden />}
        titulo="Cartões virtuais"
        descricao="Escolha um modelo, escreva uma mensagem e mande para alguém do grupo. Para quem você tirou, dá para mandar em segredo."
      />
      <Cartoes
        eventoId={id}
        meuNome={eu?.nome ?? "Você"}
        pessoas={pessoas.filter((p) => p.id !== g.eu.id).map((p) => ({ id: p.id, nome: p.nome }))}
        meuAmigo={amigo ? { participantId: amigo.participantId, nome: amigo.nome } : null}
        recebidos={cartoes.received ?? []}
        enviados={cartoes.sent ?? []}
        abaInicial={aba === "recebidos" || aba === "enviados" || aba === "criar" ? aba : undefined}
      />
    </div>
  );
}
