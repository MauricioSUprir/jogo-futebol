import Link from "next/link";
import { Eye, ShoppingBag, UserPlus, Users } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao } from "@/components/ui/cartao";
import { AtualizarAoVivo } from "@/components/sala/ao-vivo";
import { carregarMembros } from "@/components/sala/dados";
import { GradeParticipantes } from "@/components/sala/participantes";

export const metadata = { title: "Participantes" };

export default async function Participantes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const membros = await carregarMembros(id);
  const [{ data: itens }, pendentes] = await Promise.all([
    membros.length
      ? supabase.from("wishlist_items").select("user_id").in("user_id", membros.map((m) => m.usuarioId))
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    g.admin
      ? supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);
  const porUsuario = new Map<string, number>();
  for (const i of itens ?? []) porUsuario.set(i.user_id, (porUsuario.get(i.user_id) ?? 0) + 1);
  const sorteado = g.evento.status !== "open";
  const total = membros.length;
  const viram = membros.filter((m) => m.viuEm).length;
  const compraram = membros.filter((m) => m.comprou).length;

  return (
    <section aria-labelledby="titulo-participantes" className="flex flex-col gap-4">
      <AtualizarAoVivo
        canal={`sala-participantes:${id}`}
        assinaturas={[
          { tabela: "participants", filtro: `event_id=eq.${id}` },
          { tabela: "events", filtro: `id=eq.${id}` },
        ]}
        mostrar
        className="self-end"
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-participantes" className="font-titulo text-2xl font-semibold">
            Participantes
          </h2>
          <p className="text-sm text-suave">
            {total} pessoa{total === 1 ? "" : "s"} no grupo. Toque em alguém para ver a lista de desejos e as preferências.
          </p>
        </div>
        {sorteado ? (
          <ul className="flex flex-wrap gap-2 text-sm font-semibold">
            <li className="vidro inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Eye className="size-4 text-t1" aria-hidden /> {viram}/{total} viram
            </li>
            <li className="vidro inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <ShoppingBag className="size-4 text-t1" aria-hidden /> {compraram}/{total} compraram
            </li>
          </ul>
        ) : null}
      </div>

      {g.admin && (pendentes.count ?? 0) > 0 ? (
        <Cartao className="flex flex-wrap items-center gap-3 py-4">
          <UserPlus className="size-5 text-ouro" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>{pendentes.count}</strong> pedido{pendentes.count === 1 ? "" : "s"} para entrar aguardando a sua aprovação.
          </p>
          <Link href={`/grupo/${id}/admin`} className="text-sm font-semibold text-t1 underline underline-offset-4">
            Responder
          </Link>
        </Cartao>
      ) : null}

      {total ? (
        <GradeParticipantes
          base={`/grupo/${id}`}
          sorteado={sorteado}
          membros={membros.map((m) => ({
            participanteId: m.participanteId,
            usuarioId: m.usuarioId,
            nome: m.nome,
            apelido: m.apelido,
            avatar: m.avatar,
            admin: m.admin,
            dono: m.usuarioId === g.evento.owner_id,
            eu: m.usuarioId === g.usuario.id,
            rsvp: m.rsvp,
            comprou: m.comprou,
            viu: !!m.viuEm,
            itensDesejos: porUsuario.get(m.usuarioId) ?? 0,
          }))}
        />
      ) : (
        <Cartao className="text-center">
          <Users className="mx-auto size-8 text-ouro" aria-hidden />
          <p className="mt-2 font-semibold">Ninguém por aqui ainda.</p>
        </Cartao>
      )}
    </section>
  );
}
