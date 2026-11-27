import Link from "next/link";
import { CalendarHeart, Gift, Lock, Users } from "lucide-react";
import type { GrupoPublico } from "@/lib/acoes/eventos";
import { urlPublicaDaMidia } from "@/lib/env";
import { dataHora, faixaDePreco } from "@/lib/formatos";
import { TEMAS, type Tema } from "@/lib/temas";
import { Selo } from "@/components/ui/cartao";
import { classesBotao } from "@/components/ui/botao";
import { EnfeitesTema } from "@/components/grupo/enfeites";

/** Cartão de um grupo público (Explorar). */
export function CartaoPublico({ g }: { g: GrupoPublico }) {
  const tema = (g.theme in TEMAS ? g.theme : "natal") as Tema;
  const capa = urlPublicaDaMidia(g.cover_path);
  const preco = faixaDePreco(g.gift_min, g.gift_max);
  const lotado = g.max_participants !== null && g.participant_count >= g.max_participants;
  return (
    <article data-tema={tema} className="vidro-forte group flex flex-col overflow-hidden rounded-cartao">
      <div className="relative h-32 overflow-hidden">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]">
            <EnfeitesTema tema={tema} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
        <div className="absolute bottom-2.5 left-3 flex flex-wrap gap-1.5">
          <Selo className="bg-white/90 text-[#1d2420] dark:bg-white/90">{TEMAS[tema].nome}</Selo>
          {g.requires_approval ? (
            <Selo className="bg-white/90 text-[#1d2420] dark:bg-white/90">
              <Lock className="size-3" aria-hidden /> Com aprovação
            </Selo>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="font-titulo text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{g.name}</h2>
          {g.owner_name ? <p className="text-sm text-suave">Organizado por {g.owner_name}</p> : null}
        </div>
        {g.description ? <p className="line-clamp-2 text-sm text-suave [overflow-wrap:anywhere]">{g.description}</p> : null}
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <CalendarHeart className="size-4 shrink-0 text-t1" aria-hidden /> {dataHora(g.reveal_at) ?? "Data a definir"}
          </li>
          <li className="flex items-center gap-2">
            <Gift className="size-4 shrink-0 text-t1" aria-hidden /> {preco ?? "Sem faixa de valor"}
          </li>
          <li className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-t1" aria-hidden />
            {g.participant_count} {g.participant_count === 1 ? "participante" : "participantes"}
            {g.max_participants ? ` de ${g.max_participants}` : ""}
            {lotado ? <Selo cor="rubi">Lotado</Selo> : null}
          </li>
        </ul>
        <Link
          href={`/convite/${g.invite_code}`}
          className={classesBotao(lotado ? "contorno" : "primario", "m", "mt-auto w-full")}
          aria-label={`${g.requires_approval ? "Pedir para entrar" : "Participar"} de ${g.name}`}
        >
          {lotado ? "Ver grupo" : g.requires_approval ? "Pedir para entrar" : "Participar"}
        </Link>
      </div>
    </article>
  );
}
