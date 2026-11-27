import Link from "next/link";
import { ExternalLink, Send } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { emailConfigurado } from "@/lib/servidor/entrega";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { PainelCompartilhar } from "@/components/convite/painel-compartilhar";
import { linkDoConvite, qrDoConvite } from "@/components/convite/qr";
import { mensagemDoConvite } from "@/components/convite/mensagem";
import { situacaoDoConvite } from "@/components/convite/situacao";
import { ConvitesEmail, NovoCodigo } from "@/components/admin/convites-cliente";

export async function SecaoConvites({ g }: { g: Grupo }) {
  const e = g.evento;
  const supabase = await clienteServidor();
  const { data: convites } = await supabase
    .from("event_invites")
    .select("id, email, created_at, accepted_at, revoked_at")
    .eq("event_id", e.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const link = linkDoConvite(e.invite_code);
  const qr = await qrDoConvite(link);
  const { aceitando, motivo } = situacaoDoConvite({
    status: e.status,
    archived: !!e.archived_at,
    join_deadline: e.join_deadline,
    max_participants: e.max_participants,
    participant_count: g.totalAprovados,
  });
  return (
    <div className="flex flex-col gap-5">
      <Cartao forte>
        <TituloCartao
          icone={<Send className="size-5" />}
          titulo="Convite do grupo"
          descricao={aceitando ? "Mande o link, mostre o QR Code ou passe o código." : `${motivo} O convite não aceita gente nova no momento.`}
          acao={
            <Link
              href={`/grupo/${e.id}/compartilhar`}
              className="hidden items-center gap-1 text-sm font-semibold text-t1 underline-offset-4 hover:underline sm:inline-flex"
            >
              Página de convite <ExternalLink className="size-4" aria-hidden />
            </Link>
          }
        />
        <PainelCompartilhar
          codigo={e.invite_code}
          link={link}
          qrSvg={qr}
          nome={e.name}
          mensagem={mensagemDoConvite({ nome: e.name, link, codigo: e.invite_code, revelacao: e.reveal_at, local: e.location, valorMinimo: e.gift_min, valorMaximo: e.gift_max })}
        />
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-borda pt-4">
          <NovoCodigo eventoId={e.id} aberto={!e.archived_at} />
          <p className="text-xs text-suave">Troque o código se o convite foi parar com quem não devia.</p>
        </div>
      </Cartao>
      <Cartao>
        <ConvitesEmail
          eventoId={e.id}
          aberto={e.status === "open" && !e.archived_at}
          emailLigado={emailConfigurado()}
          convites={(convites ?? []).map((c) => ({ id: c.id, email: c.email, criadoEm: c.created_at, aceitoEm: c.accepted_at, revogadoEm: c.revoked_at }))}
        />
      </Cartao>
    </div>
  );
}
