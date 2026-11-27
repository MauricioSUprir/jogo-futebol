import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  CalendarHeart,
  ChevronRight,
  Gift,
  History,
  MailPlus,
  MessageCircleHeart,
  Plus,
  Settings,
  Sparkles,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { Contagem } from "@/components/ui/contagem";
import { MarcaPresente } from "@/components/ui/logo";
import { EntrarComCodigo } from "@/components/painel/entrar-com-codigo";
import { CapaGrupo } from "@/components/painel/cartao-grupo";
import { linkSeguro, tipoDaNotificacao } from "@/components/notificacoes/tipos";
import { dataHora, relativo } from "@/lib/formatos";
import { cn } from "@/lib/cn";
import { proximoMarco, type Participacao } from "@/components/painel/dados";

export type ConvitePendente = {
  id: string;
  event_id: string;
  name: string;
  theme: string;
  cover_path: string | null;
  reveal_at: string | null;
  invite_code: string;
  invited_at: string;
  invited_by: string | null;
};

export type NotificacaoResumo = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

export function TituloSecao({ id, icone, children, acao }: { id: string; icone: ReactNode; children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-t1" aria-hidden>
        {icone}
      </span>
      <h2 id={id} className="flex-1 font-titulo text-xl font-semibold">
        {children}
      </h2>
      {acao}
    </div>
  );
}

/** Topo do painel: saudação, resumo e os dois atalhos principais. */
export function Saudacao({
  saudacao,
  nome,
  convidado,
  resumo,
}: {
  saudacao: string;
  nome: string;
  convidado: boolean;
  resumo: string;
}) {
  return (
    <section aria-labelledby="painel-titulo" className="vidro-forte relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 opacity-90 sm:right-6 sm:top-4">
        <MarcaPresente tamanho={120} className="flutuar rotate-6 drop-shadow-xl" />
      </div>
      <div className="relative max-w-xl pr-24 sm:pr-0">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-suave">{saudacao}</p>
        <h1 id="painel-titulo" className="mt-1 font-titulo text-3xl font-semibold leading-tight sm:text-4xl">
          Olá, <span className="texto-ouro">{nome}</span>!
        </h1>
        <p className="mt-2 text-suave">{resumo}</p>
      </div>
      <div className="relative mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <BotaoLink href={convidado ? "/conta#salvar" : "/criar"} tamanho="g" brilho className="w-full sm:w-auto">
            <Plus className="size-5" aria-hidden /> Criar amigo oculto
          </BotaoLink>
          {convidado ? <p className="text-xs text-suave">Salve sua conta para criar grupos.</p> : null}
        </div>
        <EntrarComCodigo className="sm:max-w-md" />
      </div>
    </section>
  );
}

/** Convites recebidos por e-mail que ainda esperam a pessoa, e os pedidos dela aguardando aprovação. */
export function SecaoConvites({ convites, pedidos }: { convites: ConvitePendente[]; pedidos: Participacao[] }) {
  if (!convites.length && !pedidos.length) return null;
  return (
    <section aria-labelledby="sec-convites">
      <TituloSecao id="sec-convites" icone={<MailPlus className="size-5" />}>
        Convites pendentes
      </TituloSecao>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {convites.map((c) => (
          <li key={c.id} data-tema={c.theme} className="vidro relative flex items-center gap-3 overflow-hidden rounded-cartao p-3 pr-4">
            <CapaGrupo evento={c} className="size-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name}</p>
              <p className="truncate text-[13px] text-suave">
                {c.invited_by ? `${c.invited_by} te convidou` : "Você foi convidado"} · {relativo(c.invited_at)}
              </p>
            </div>
            <BotaoLink href={`/convite/${c.invite_code}`} tamanho="p" className="shrink-0">
              Ver convite
            </BotaoLink>
          </li>
        ))}
        {pedidos.map((p) => (
          <li key={p.id} data-tema={p.evento.theme} className="vidro relative flex items-center gap-3 overflow-hidden rounded-cartao p-3 pr-4">
            <CapaGrupo evento={p.evento} className="size-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.evento.name}</p>
              <p className="truncate text-[13px] text-suave">Seu pedido aguarda o organizador · {relativo(p.created_at)}</p>
            </div>
            <Selo cor="ouro" className="shrink-0">
              Aguardando
            </Selo>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os próximos encontros, do mais perto para o mais longe, com contagem regressiva. */
export function SecaoProximos({ proximos, agora }: { proximos: Participacao[]; agora: number }) {
  if (!proximos.length) return null;
  return (
    <section aria-labelledby="sec-proximos">
      <TituloSecao id="sec-proximos" icone={<CalendarHeart className="size-5" />}>
        Próximos eventos
      </TituloSecao>
      <ol className="flex flex-col gap-3">
        {proximos.slice(0, 3).map((p) => {
          const marco = proximoMarco(p.evento, agora)!;
          return (
            <li key={p.id} data-tema={p.evento.theme}>
              <Link
                href={`/grupo/${p.evento.id}`}
                className="vidro flex flex-col gap-3 rounded-cartao p-4 transition hover:-translate-y-0.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span aria-hidden className="h-12 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--t1),var(--t3))]" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.evento.name}</p>
                    <p className="text-[13px] text-suave">
                      {marco.rotulo} {dataHora(marco.alvo)}
                    </p>
                  </div>
                </div>
                <Contagem alvo={marco.alvo} compacta className="shrink-0" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Primeira visita: ninguém em grupo nenhum ainda. */
export function BoasVindas({ convidado }: { convidado: boolean }) {
  const passos = [
    {
      icone: <Sparkles className="size-5" />,
      titulo: "Crie o seu grupo",
      texto: "Nome, data, valor do presente e tema. O convite sai por link, QR Code ou WhatsApp.",
      href: convidado ? "/conta#salvar" : "/criar",
      acao: convidado ? "Salvar minha conta" : "Criar amigo oculto",
    },
    {
      icone: <TicketCheck className="size-5" />,
      titulo: "Ou entre com um código",
      texto: "Recebeu um convite? Digite o código de 8 letras no campo acima.",
    },
    {
      icone: <Gift className="size-5" />,
      titulo: "Monte sua lista de desejos",
      texto: "Quem tirar você vai agradecer: ideias, links, tamanhos e o que você não quer ganhar.",
      href: "/lista-de-desejos",
      acao: "Montar minha lista",
    },
  ];
  return (
    <Cartao forte className="relative overflow-hidden">
      <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
      <TituloCartao
        icone={<Gift className="size-5" />}
        titulo="Bem-vindo ao seu primeiro amigo oculto!"
        descricao="Por aqui você acompanha todos os seus grupos, o sorteio, as mensagens e a revelação."
      />
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {passos.map((p, i) => (
          <li key={p.titulo} className="flex flex-col gap-2 rounded-3xl border border-borda bg-white/40 p-4 dark:bg-white/5">
            <span className="flex items-center gap-2 text-t1">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-sm font-bold">
                {i + 1}
              </span>
              {p.icone}
            </span>
            <p className="font-semibold">{p.titulo}</p>
            <p className="text-sm text-suave">{p.texto}</p>
            {p.href ? (
              <Link href={p.href} className="mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-t1 underline-offset-4 hover:underline">
                {p.acao} <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </Cartao>
  );
}

/** Lateral: resumo da lista de desejos. */
export function CartaoDesejos({ quantidade, preferenciasVazias }: { quantidade: number; preferenciasVazias: boolean }) {
  return (
    <Cartao>
      <TituloCartao
        nivel={2}
        icone={<Gift className="size-5" />}
        titulo="Minha lista de desejos"
        descricao={quantidade ? `${quantidade} ${quantidade === 1 ? "item" : "itens"} na lista` : "Sua lista está vazia"}
      />
      {quantidade === 0 ? (
        <p className="mb-4 text-sm text-suave">
          Dê uma ajudinha para quem tirar você: adicione ideias com foto, link e preço. Só as pessoas dos seus grupos veem.
        </p>
      ) : preferenciasVazias ? (
        <p className="mb-4 text-sm text-suave">Conte também seus hobbies, cores favoritas e tamanhos — ajuda muito na escolha.</p>
      ) : (
        <p className="mb-4 text-sm text-suave">Mantenha a ordem de preferência em dia: o primeiro item é o mais desejado.</p>
      )}
      <BotaoLink href="/lista-de-desejos" variante={quantidade === 0 ? "ouro" : "vidro"} tamanho="p" className="w-full">
        {quantidade === 0 ? "Começar minha lista" : "Abrir minha lista"}
      </BotaoLink>
    </Cartao>
  );
}

function ItemNotificacao({ n }: { n: NotificacaoResumo }) {
  const tipo = tipoDaNotificacao(n.kind);
  const Icone = tipo.icone;
  const href = linkSeguro(n.link) ?? "/notificacoes";
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-start gap-3 rounded-2xl p-2 transition hover:bg-black/5 dark:hover:bg-white/5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
          <Icone className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("line-clamp-2 text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
          <span className="block text-xs text-suave">{relativo(n.created_at)}</span>
        </span>
        {!n.read_at ? <span className="mt-2 size-2 shrink-0 rounded-full bg-rubi" aria-label="Não lida" /> : null}
      </Link>
    </li>
  );
}

/** Lateral: mensagens anônimas e cartões recebidos (pelas notificações; o conteúdo fica nas Mensagens). */
export function CartaoMensagens({ mensagens }: { mensagens: NotificacaoResumo[] }) {
  return (
    <Cartao>
      <TituloCartao
        icone={<MessageCircleHeart className="size-5" />}
        titulo="Mensagens recebidas"
        acao={
          <Link href="/mensagens" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-t1">
            Ver todas <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {mensagens.length ? (
        <ul className="-mx-2 flex flex-col gap-0.5">
          {mensagens.map((n) => (
            <ItemNotificacao key={n.id} n={n} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-suave">Nenhuma mensagem ainda. Depois do sorteio, quem te tirou pode mandar pistas anônimas.</p>
      )}
    </Cartao>
  );
}

/** Lateral: notificações recentes ainda não lidas. */
export function CartaoNotificacoes({ notificacoes, total }: { notificacoes: NotificacaoResumo[]; total: number }) {
  return (
    <Cartao>
      <TituloCartao
        icone={<Bell className="size-5" />}
        titulo="Notificações"
        descricao={total ? `${total} não ${total === 1 ? "lida" : "lidas"}` : "Tudo em dia"}
        acao={
          <Link href="/notificacoes" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-t1">
            Abrir <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {notificacoes.length ? (
        <ul className="-mx-2 flex flex-col gap-0.5">
          {notificacoes.map((n) => (
            <ItemNotificacao key={n.id} n={n} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-suave">Nada novo por aqui. Avisamos assim que algo acontecer nos seus grupos.</p>
      )}
    </Cartao>
  );
}

/** Lateral: atalhos da conta. */
export function CartaoConta() {
  const itens = [
    { href: "/conta", rotulo: "Minha conta", texto: "Foto, nome e apelido", icone: UserRound },
    { href: "/conta/configuracoes", rotulo: "Configurações", texto: "Notificações, aparência e efeitos", icone: Settings },
    { href: "/painel/historico", rotulo: "Histórico", texto: "Todos os amigos ocultos de que você participou", icone: History },
  ];
  return (
    <Cartao>
      <h2 className="sr-only">Conta</h2>
      <ul className="-m-2 flex flex-col">
        {itens.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-14 items-center gap-3 rounded-2xl p-2 transition hover:bg-black/5 dark:hover:bg-white/5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
                <i.icone className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{i.rotulo}</span>
                <span className="block truncate text-xs text-suave">{i.texto}</span>
              </span>
              <ChevronRight className="size-4 text-suave" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
