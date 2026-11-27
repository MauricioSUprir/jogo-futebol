import Link from "next/link";
import { ArrowRight, Ban, BellRing, Hourglass, MessageCircle, ShieldAlert, Shuffle, UserRoundCheck, Users } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { dataHora } from "@/lib/formatos";
import { cn } from "@/lib/cn";

type Estatisticas = {
  approved: number;
  pending: number;
  viewed: number;
  bought: number;
  rsvp_yes: number;
  rsvp_no: number;
  rsvp_maybe: number;
  with_wishlist: number;
  guests: number;
  chat_messages: number;
  restrictions: number;
  open_reports: number;
  invites: number;
  invites_accepted: number;
};

function Barra({ rotulo, valor, total, cor = "t1", detalhe }: { rotulo: string; valor: number; total: number; cor?: "t1" | "esmeralda" | "ouro"; detalhe?: string }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  const fundo = { t1: "bg-[linear-gradient(90deg,var(--t1),color-mix(in_oklab,var(--t1)_60%,var(--t3)))]", esmeralda: "bg-esmeralda", ouro: "bg-ouro" }[cor];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{rotulo}</span>
        <span className="tabular-nums text-suave">
          {valor} de {total} <span className="font-semibold text-texto">({pct}%)</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10" aria-hidden>
        <div className={cn("h-full rounded-full", fundo)} style={{ width: `${pct}%` }} />
      </div>
      {detalhe ? <p className="text-xs text-suave">{detalhe}</p> : null}
    </div>
  );
}

function Numero({ icone, valor, rotulo, href, alerta }: { icone: React.ReactNode; valor: number; rotulo: string; href?: string; alerta?: boolean }) {
  const conteudo = (
    <>
      <span className={cn("inline-flex size-10 items-center justify-center rounded-2xl", alerta ? "bg-rubi/12 text-rubi" : "bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1")} aria-hidden>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block font-titulo text-2xl font-semibold tabular-nums leading-none">{valor}</span>
        <span className="block text-sm text-suave">{rotulo}</span>
      </span>
    </>
  );
  const classes = "vidro flex items-center gap-3 rounded-2xl p-3.5";
  return href ? (
    <Link href={href} scroll={false} className={cn(classes, "transition hover:-translate-y-0.5")}>
      {conteudo}
    </Link>
  ) : (
    <div className={classes}>{conteudo}</div>
  );
}

export async function SecaoResumo({ g }: { g: Grupo }) {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("admin_event_stats", { p_event: g.evento.id });
  if (error || !data) {
    return (
      <Cartao>
        <p role="alert" className="text-rubi">
          Não foi possível carregar as estatísticas agora.
        </p>
      </Cartao>
    );
  }
  const s = data as unknown as Estatisticas;
  const base = `/grupo/${g.evento.id}/admin`;
  const sorteado = g.evento.status !== "open";
  const semResposta = Math.max(0, s.approved - s.rsvp_yes - s.rsvp_no - s.rsvp_maybe);

  return (
    <div className="flex flex-col gap-5">
      {s.pending > 0 || s.open_reports > 0 ? (
        <div className="flex flex-col gap-2" role="status">
          {s.pending > 0 ? (
            <Link
              href={`${base}?aba=participantes`}
              scroll={false}
              className="flex items-center gap-3 rounded-2xl bg-ouro/12 px-4 py-3 text-sm font-semibold transition hover:bg-ouro/20"
            >
              <Hourglass className="size-5 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
              <span className="flex-1">
                {s.pending} {s.pending === 1 ? "pedido de entrada esperando" : "pedidos de entrada esperando"} a sua resposta
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          {s.open_reports > 0 ? (
            <Link
              href={`${base}?aba=moderacao`}
              scroll={false}
              className="flex items-center gap-3 rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-semibold text-rubi transition hover:bg-rubi/15"
            >
              <ShieldAlert className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">
                {s.open_reports} {s.open_reports === 1 ? "denúncia para analisar" : "denúncias para analisar"}
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero icone={<Users className="size-5" />} valor={s.approved} rotulo="participantes" href={`${base}?aba=participantes`} />
        <Numero icone={<Hourglass className="size-5" />} valor={s.pending} rotulo="pedidos pendentes" href={`${base}?aba=participantes`} alerta={s.pending > 0} />
        <Numero icone={<MessageCircle className="size-5" />} valor={s.chat_messages} rotulo="mensagens no chat" />
        <Numero icone={<ShieldAlert className="size-5" />} valor={s.open_reports} rotulo="denúncias abertas" href={`${base}?aba=moderacao`} alerta={s.open_reports > 0} />
      </div>

      <Cartao>
        <TituloCartao
          icone={<Shuffle className="size-5" />}
          titulo="Andamento"
          descricao={
            sorteado
              ? `Sorteio realizado${g.evento.drawn_at ? ` em ${dataHora(g.evento.drawn_at)}` : ""}. Você acompanha quem já viu e quem já comprou, nunca quem tirou quem.`
              : "Antes do sorteio: acompanhe a presença e as listas de desejos."
          }
        />
        <div className="flex flex-col gap-5">
          {sorteado ? (
            <>
              <Barra rotulo="Já abriram o presente (viram quem tiraram)" valor={s.viewed} total={s.approved} cor="t1" />
              <Barra rotulo="Já compraram o presente" valor={s.bought} total={s.approved} cor="esmeralda" />
            </>
          ) : null}
          <Barra
            rotulo="Confirmaram presença"
            valor={s.rsvp_yes}
            total={s.approved}
            cor="esmeralda"
            detalhe={`Talvez: ${s.rsvp_maybe} · Não vão: ${s.rsvp_no} · Sem resposta: ${semResposta}`}
          />
          <Barra rotulo="Têm lista de desejos" valor={s.with_wishlist} total={s.approved} cor="ouro" />
          {s.invites > 0 ? <Barra rotulo="Convites por e-mail aceitos" valor={s.invites_accepted} total={s.invites} cor="t1" /> : null}
        </div>
      </Cartao>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Numero icone={<UserRoundCheck className="size-5" />} valor={s.guests} rotulo="entraram sem cadastro" />
        <Numero icone={<Ban className="size-5" />} valor={s.restrictions} rotulo="restrições" href={`${base}?aba=restricoes`} />
        <Numero icone={<BellRing className="size-5" />} valor={s.invites} rotulo="convites por e-mail" href={`${base}?aba=convites`} />
      </div>
    </div>
  );
}
