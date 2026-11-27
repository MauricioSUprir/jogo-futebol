import Link from "next/link";
import { AlarmClock, CalendarHeart, CheckCircle2, ChevronRight, Eye, Gift, Radio, ShoppingBag, Users } from "lucide-react";
import { Selo } from "@/components/ui/cartao";
import { EnfeitesTema } from "@/components/grupo/enfeites";
import { urlPublicaDaMidia } from "@/lib/env";
import { dataCurta, dataHora, faixaDePreco } from "@/lib/formatos";
import { cn } from "@/lib/cn";
import {
  ROTULO_SITUACAO,
  alertasDaParticipacao,
  papelNoGrupo,
  proximoMarco,
  situacaoDoEvento,
  type Alerta,
  type Participacao,
} from "@/components/painel/dados";

const ICONE_ALERTA: Record<Alerta["tipo"], typeof Eye> = {
  ver: Eye,
  comprar: ShoppingBag,
  presenca: CheckCircle2,
  sorteio: AlarmClock,
};

/** Capa do grupo: a foto enviada ou as cores do tema com os enfeites. */
export function CapaGrupo({ evento, className }: { evento: { cover_path: string | null; theme: string }; className?: string }) {
  const capa = urlPublicaDaMidia(evento.cover_path);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capa} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]">
          <EnfeitesTema tema={evento.theme} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
    </div>
  );
}

/** Cartão de um grupo no painel: capa, situação, papel, data, contagem e o que falta fazer. O cartão todo é um link. */
export function CartaoGrupo({
  p,
  usuarioId,
  participantes,
  aoVivo,
  agora,
}: {
  p: Participacao;
  usuarioId: string;
  participantes?: number;
  aoVivo?: boolean;
  agora: number;
}) {
  const e = p.evento;
  const sit = situacaoDoEvento(e);
  const st = ROTULO_SITUACAO[sit];
  const marco = proximoMarco(e, agora);
  const alertas = alertasDaParticipacao(p, agora);
  const preco = faixaDePreco(e.gift_min, e.gift_max);
  const papel = papelNoGrupo(p, e, usuarioId);
  return (
    <article data-tema={e.theme} className="vidro group relative flex flex-col overflow-hidden rounded-cartao transition hover:-translate-y-0.5 hover:shadow-lg">
      <CapaGrupo evento={e} className="h-24 shrink-0" />
      <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap items-center gap-1.5">
        {aoVivo ? (
          <Selo cor="rubi" className="bg-white/95 dark:bg-black/70">
            <Radio className="size-3.5" aria-hidden /> Ao vivo agora
          </Selo>
        ) : (
          <Selo cor={st.cor} className="bg-white/95 dark:bg-black/70">{st.texto}</Selo>
        )}
        <Selo className="bg-white/95 text-texto dark:bg-black/70">{papel}</Selo>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-titulo text-lg font-semibold leading-snug">
            <Link
              href={`/grupo/${e.id}`}
              className="rounded-md after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-cartao focus-visible:after:ring-4 focus-visible:after:ring-ouro/45"
            >
              {e.name}
            </Link>
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-suave">
            {e.reveal_at ? (
              <li className="flex items-center gap-1">
                <CalendarHeart className="size-3.5 text-t1" aria-hidden /> {dataHora(e.reveal_at, { month: "short" })}
              </li>
            ) : null}
            {typeof participantes === "number" ? (
              <li className="flex items-center gap-1">
                <Users className="size-3.5 text-t1" aria-hidden /> {participantes} {participantes === 1 ? "pessoa" : "pessoas"}
              </li>
            ) : null}
            {preco ? (
              <li className="flex items-center gap-1">
                <Gift className="size-3.5 text-t1" aria-hidden /> {preco}
              </li>
            ) : null}
          </ul>
        </div>
        {marco ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-t1">
            <AlarmClock className="size-4" aria-hidden /> {marco.rotulo} {dataHora(marco.alvo, { month: "short" })}
          </p>
        ) : null}
        {alertas.length ? (
          <ul className="relative z-10 mt-auto flex flex-col gap-1.5" aria-label="O que falta fazer">
            {alertas.map((a) => {
              const Icone = ICONE_ALERTA[a.tipo];
              return (
                <li key={a.tipo}>
                  <Link
                    href={a.href}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                      a.urgente ? "bg-rubi/10 text-rubi hover:bg-rubi/15" : "bg-ouro/12 text-ouro-escuro hover:bg-ouro/20 dark:text-ouro-claro",
                    )}
                  >
                    <Icone className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{a.texto}</span>
                    <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : sit === "sorteado" ? (
          <p className="mt-auto flex items-center gap-2 text-sm font-medium text-esmeralda">
            <CheckCircle2 className="size-4" aria-hidden /> Tudo em dia por aqui!
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Linha compacta (concluídos, histórico e pedidos pendentes). */
export function LinhaGrupo({ p, usuarioId, extra }: { p: Participacao; usuarioId: string; extra?: React.ReactNode }) {
  const e = p.evento;
  const sit = situacaoDoEvento(e);
  const st = ROTULO_SITUACAO[sit];
  const quando = e.reveal_at ?? e.finished_at ?? e.created_at;
  const conteudo = (
    <>
      <CapaGrupo evento={e} className="size-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{e.name}</p>
        <p className="truncate text-[13px] text-suave">
          {p.status === "pending" ? "Pedido enviado" : papelNoGrupo(p, e, usuarioId)} · {dataCurta(quando)}
        </p>
      </div>
      {extra ?? (p.status === "pending" ? <Selo cor="ouro">Aguardando</Selo> : <Selo cor={st.cor}>{st.texto}</Selo>)}
    </>
  );
  return (
    <li data-tema={e.theme}>
      <Link href={`/grupo/${e.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl p-2 transition hover:bg-black/5 dark:hover:bg-white/5">
        {conteudo}
      </Link>
    </li>
  );
}
