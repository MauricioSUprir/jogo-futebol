import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Gift, Hourglass, ListChecks, Radio, UserRoundX } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { mensagemDeErro } from "@/lib/erros";
import { dataHora } from "@/lib/formatos";
import { descreverOrcamento, perfilDoBanco, sugerirPresentes } from "@/lib/sugestoes";
import { BotaoLink } from "@/components/ui/botao";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { Contagem } from "@/components/ui/contagem";
import { Caixa3D } from "@/components/revelacao/caixa-3d";
import { DetalhesDaPessoa } from "@/components/revelacao/detalhes-pessoa";
import { RevelacaoDoGrupo } from "./revelacao-grupo";

export const metadata: Metadata = { title: "Meu amigo oculto", robots: { index: false, follow: false } };

/** O que a função my_assignment devolve (só o resultado da própria pessoa). */
type MinhaRevelacao = {
  status: "open" | "drawn" | "finished";
  draw_at?: string | null;
  draw_mode?: "manual" | "scheduled";
  missing?: boolean;
  viewed_at?: string | null;
  receiver?: {
    participant_id: string;
    user_id: string | null;
    display_name: string | null;
    nickname: string | null;
    avatar_path: string | null;
    bio: string | null;
  };
};

export default async function PaginaRevelacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  if (!g.aprovado) return null; // o layout mostra "aguardando aprovação"
  const { evento } = g;

  if (evento.status === "open") return <AguardandoSorteio grupo={g} />;

  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("my_assignment", { p_event: id });
  if (error) {
    return <Vazio icone={<Gift className="size-8" />} titulo="Não foi possível abrir o seu presente" texto={mensagemDeErro(error)} />;
  }
  const r = (data ?? {}) as MinhaRevelacao;
  if (r.missing || !r.receiver) {
    return (
      <Vazio
        icone={<UserRoundX className="size-8" />}
        titulo="Você não está neste sorteio"
        texto="Você entrou no grupo depois que o sorteio foi feito. Fale com quem organiza: refazer o sorteio inclui você."
        acao={<BotaoLink href={`/grupo/${id}`} variante="vidro">Voltar à visão geral</BotaoLink>}
      />
    );
  }

  const quem = r.receiver;
  const nome = quem.display_name?.trim() || "Participante";
  const [{ data: desejos }, { data: prefs }] = quem.user_id
    ? await Promise.all([
        supabase
          .from("wishlist_items")
          .select("id, title, notes, url, image_path, price_estimate")
          .eq("user_id", quem.user_id)
          .order("position")
          .order("created_at"),
        supabase
          .from("gift_preferences")
          .select("hobbies, interests, favorite_colors, shirt_size, pants_size, shoe_size, dislikes, notes")
          .eq("user_id", quem.user_id)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  const orcamento = { min: evento.gift_min, max: evento.gift_max };
  const sugestoes = sugerirPresentes(perfilDoBanco(prefs, desejos ?? []), orcamento, { quantidade: 6 });
  const maximo = evento.gift_max !== null ? Number(evento.gift_max) : null;

  return (
    <div className="flex flex-col gap-5">
      {g.aoVivo?.status === "running" ? (
        <Cartao className="flex flex-col gap-3 border-rubi/30 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <Radio className="size-5 text-rubi" aria-hidden /> A revelação ao vivo está acontecendo agora.
          </p>
          <BotaoLink href={`/grupo/${id}/ao-vivo/participar`} tamanho="p">
            Participar ao vivo
          </BotaoLink>
        </Cartao>
      ) : null}
      <RevelacaoDoGrupo
        eventoId={id}
        pessoa={{ nome, apelido: quem.nickname, avatar: quem.avatar_path, bio: quem.bio }}
        jaVisto={!!r.viewed_at}
        presenteComprado={g.eu.gift_bought}
        detalhes={
          <DetalhesDaPessoa
            nome={nome}
            desejos={desejos ?? []}
            prefs={prefs}
            sugestoes={sugestoes}
            orcamento={descreverOrcamento(orcamento)?.replace(/^de /, "")}
            orcamentoMax={maximo}
            vazioDesejos={
              <>
                Que tal perguntar?{" "}
                <Link href={`/grupo/${id}/mensagens`} className="font-semibold text-t1 underline underline-offset-4">
                  Mande uma mensagem anônima
                </Link>
                .
              </>
            }
          />
        }
      />
    </div>
  );
}

function AguardandoSorteio({ grupo: g }: { grupo: Awaited<ReturnType<typeof carregarGrupo>> }) {
  const { evento } = g;
  const agendado = evento.draw_mode === "scheduled" && evento.draw_at;
  return (
    <div className="flex flex-col gap-5">
      <section className="palco-revelacao relative isolate flex flex-col items-center overflow-hidden rounded-[2rem] px-5 pb-8 pt-6 text-center shadow-vidro sm:pb-10">
        <div className="opacity-90">
          <Caixa3D fase="parada" tamanho={150} />
        </div>
        <h2 className="font-titulo text-2xl font-semibold text-white sm:text-3xl">Seu presente ainda está sendo embrulhado</h2>
        {agendado ? (
          <>
            <p className="mt-2 max-w-md text-white/80">
              <CalendarClock className="mr-1 inline size-4 align-[-2px]" aria-hidden />O sorteio acontece sozinho em {dataHora(evento.draw_at)}. Volte
              aqui para abrir o seu presente.
            </p>
            <div className="mt-5 [&_.vidro]:bg-white/10 [&_.vidro]:text-white [&_.vidro]:ring-1 [&_.vidro]:ring-white/15 [&_.text-suave]:text-white/70">
              <Contagem alvo={evento.draw_at!} rotulo="Falta pouco" />
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-md text-white/80">
            <Hourglass className="mr-1 inline size-4 align-[-2px]" aria-hidden />
            Aguardando {g.admin ? "você fazer" : "o organizador fazer"} o sorteio. Quando acontecer, você recebe uma notificação e o seu
            presente aparece aqui.
          </p>
        )}
        {g.admin ? (
          <BotaoLink href={`/grupo/${evento.id}/admin`} variante="ouro" className="mt-6">
            Ir para Organizar
          </BotaoLink>
        ) : null}
      </section>
      <Cartao className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-0.5 size-5 shrink-0 text-t1" aria-hidden />
          <p className="text-sm">
            <strong className="font-semibold">Enquanto isso:</strong> complete a sua lista de desejos e as preferências. Quem tirar você vai ver,
            junto com ideias de presente dentro do valor do grupo.
          </p>
        </div>
        <BotaoLink href="/lista-de-desejos" variante="vidro" tamanho="p" className="shrink-0">
          Minha lista de desejos
        </BotaoLink>
      </Cartao>
    </div>
  );
}
