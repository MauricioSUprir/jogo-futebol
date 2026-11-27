import { CalendarHeart, Gift, MapPin, Users } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { Selo } from "@/components/ui/cartao";
import { Contagem } from "@/components/ui/contagem";
import { dataHora, faixaDePreco } from "@/lib/formatos";
import { urlPublicaDaMidia } from "@/lib/env";
import { EnfeitesTema } from "@/components/grupo/enfeites";

export function rotuloStatus(g: Pick<Grupo, "evento" | "aoVivo">) {
  if (g.evento.archived_at) return { texto: "Arquivado", cor: "neutro" as const };
  if (g.aoVivo?.status === "running") return { texto: "Revelação ao vivo", cor: "rubi" as const };
  if (g.evento.status === "finished") return { texto: "Encerrado", cor: "neutro" as const };
  if (g.evento.status === "drawn") return { texto: "Sorteio realizado", cor: "esmeralda" as const };
  return { texto: "Aguardando o sorteio", cor: "ouro" as const };
}

export function CabecalhoGrupo({ grupo: g }: { grupo: Grupo }) {
  const capa = urlPublicaDaMidia(g.evento.cover_path);
  const st = rotuloStatus(g);
  const preco = faixaDePreco(g.evento.gift_min, g.evento.gift_max);
  const alvo = g.evento.status === "open" && g.evento.draw_mode === "scheduled" && g.evento.draw_at ? g.evento.draw_at : g.evento.reveal_at;
  const rotuloAlvo = g.evento.status === "open" && g.evento.draw_mode === "scheduled" && g.evento.draw_at ? "Sorteio em" : "Revelação em";
  return (
    <section className="vidro-forte relative overflow-hidden rounded-[2rem]">
      <div className="relative h-36 overflow-hidden sm:h-48">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]">
            <EnfeitesTema tema={g.evento.theme} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 sm:left-6">
          <Selo cor={st.cor} className="bg-white/90 dark:bg-black/60">{st.texto}</Selo>
          {g.admin ? <Selo className="bg-white/90 text-texto dark:bg-black/60">Você organiza</Selo> : null}
        </div>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h1 className="font-titulo text-2xl font-semibold leading-tight sm:text-4xl">{g.evento.name}</h1>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-suave">
            <li className="flex items-center gap-1.5">
              <Users className="size-4 text-t1" aria-hidden /> {g.totalAprovados} participante{g.totalAprovados === 1 ? "" : "s"}
            </li>
            {g.evento.reveal_at ? (
              <li className="flex items-center gap-1.5">
                <CalendarHeart className="size-4 text-t1" aria-hidden /> {dataHora(g.evento.reveal_at)}
              </li>
            ) : null}
            {g.evento.location ? (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-t1" aria-hidden /> {g.evento.location}
              </li>
            ) : null}
            {preco ? (
              <li className="flex items-center gap-1.5">
                <Gift className="size-4 text-t1" aria-hidden /> {preco}
              </li>
            ) : null}
          </ul>
        </div>
        {alvo && new Date(alvo) > new Date() && g.evento.status !== "finished" ? <Contagem alvo={alvo} rotulo={rotuloAlvo} compacta /> : null}
      </div>
    </section>
  );
}
