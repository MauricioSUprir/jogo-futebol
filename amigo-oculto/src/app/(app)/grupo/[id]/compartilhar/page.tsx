import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleAlert, PartyPopper, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { PainelCompartilhar } from "@/components/convite/painel-compartilhar";
import { FestaCriado } from "@/components/convite/festa-criado";
import { linkDoConvite, qrDoConvite } from "@/components/convite/qr";
import { mensagemDoConvite } from "@/components/convite/mensagem";
import { situacaoDoConvite } from "@/components/convite/situacao";

export const metadata: Metadata = { title: "Convidar pessoas" };

export default async function PaginaCompartilhar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const { id } = await params;
  const { novo } = await searchParams;
  const g = await carregarGrupo(id);
  if (!g.aprovado) notFound();
  const e = g.evento;
  const link = linkDoConvite(e.invite_code);
  const qr = await qrDoConvite(link);
  const mensagem = mensagemDoConvite({
    nome: e.name,
    link,
    codigo: e.invite_code,
    revelacao: e.reveal_at,
    local: e.location,
    valorMinimo: e.gift_min,
    valorMaximo: e.gift_max,
  });
  const { aceitando, motivo } = situacaoDoConvite({
    status: e.status,
    archived: !!e.archived_at,
    join_deadline: e.join_deadline,
    max_participants: e.max_participants,
    participant_count: g.totalAprovados,
  });
  const recemCriado = novo === "1" && g.admin;

  return (
    <div className="flex flex-col gap-5">
      {recemCriado ? (
        <>
          <FestaCriado />
          <Cartao forte className="relative overflow-hidden">
            <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ouro/15 text-ouro-escuro dark:text-ouro-claro">
                <PartyPopper className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-titulo text-2xl font-semibold">Seu amigo oculto foi criado!</h2>
                <p className="mt-1 text-suave">
                  Agora é só chamar a turma. Mande o link pelo WhatsApp, mostre o QR Code ou passe o código.
                </p>
              </div>
            </div>
          </Cartao>
        </>
      ) : null}

      {!aceitando ? (
        <p className="flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm" role="status">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
          <span>
            {motivo} O link continua mostrando o grupo, mas ninguém novo consegue entrar.
            {g.admin ? (
              <>
                {" "}
                <Link href={`/grupo/${id}/admin?aba=evento`} className="font-semibold underline underline-offset-4">
                  Ajustar no painel
                </Link>
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      <Cartao forte>
        <TituloCartao
          titulo="Convide para o amigo oculto"
          descricao={
            e.requires_approval
              ? "Quem entrar pelo convite fica aguardando a aprovação do organizador."
              : "Quem entrar pelo convite já fica no grupo, sem precisar de cadastro completo."
          }
        />
        <PainelCompartilhar codigo={e.invite_code} link={link} qrSvg={qr} nome={e.name} mensagem={mensagem} />
      </Cartao>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Cartao className="flex flex-col gap-2">
          <UsersRound className="size-6 text-t1" aria-hidden />
          <h3 className="font-semibold">Acompanhe quem entrou</h3>
          <p className="text-sm text-suave">
            {g.totalAprovados} {g.totalAprovados === 1 ? "pessoa já está" : "pessoas já estão"} no grupo.
          </p>
          <Link href={`/grupo/${id}/participantes`} className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-t1 underline-offset-4 hover:underline">
            Ver participantes <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Cartao>
        <Cartao className="flex flex-col gap-2">
          <ShieldCheck className="size-6 text-t1" aria-hidden />
          <h3 className="font-semibold">Sorteio seguro</h3>
          <p className="text-sm text-suave">Ninguém vê os pares, nem o organizador. Cada pessoa só descobre quem tirou.</p>
        </Cartao>
        {g.admin ? (
          <Cartao className="flex flex-col gap-2">
            <Settings2 className="size-6 text-t1" aria-hidden />
            <h3 className="font-semibold">Quando todos entrarem</h3>
            <p className="text-sm text-suave">Configure restrições (quem não pode tirar quem) e faça o sorteio pelo painel.</p>
            <Link href={`/grupo/${id}/admin?aba=sorteio`} className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-t1 underline-offset-4 hover:underline">
              Painel do organizador <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Cartao>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <BotaoLink href={`/grupo/${id}`} tamanho="g">
          Ir para a sala <ArrowRight className="size-5" aria-hidden />
        </BotaoLink>
      </div>
    </div>
  );
}
