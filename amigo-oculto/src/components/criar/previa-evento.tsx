"use client";
import { CalendarHeart, Gift, Globe2, Lock, MapPin } from "lucide-react";
import { urlPublicaDaMidia } from "@/lib/env";
import { dataHora, deInputLocal, faixaDePreco } from "@/lib/formatos";
import { lerValor, type RascunhoEvento } from "@/lib/validacao/evento";
import { TEMAS } from "@/lib/temas";
import { EnfeitesTema } from "@/components/grupo/enfeites";
import { MarcaPresente } from "@/components/ui/logo";

const valorOuNulo = (v: string) => {
  const n = lerValor(v);
  return n === null || Number.isNaN(n) ? null : n;
};

/** Como o convite vai aparecer (prévia ao vivo enquanto a pessoa preenche). */
export function PreviaEvento({ r }: { r: RascunhoEvento }) {
  const capa = urlPublicaDaMidia(r.capa);
  const quando = dataHora(deInputLocal(r.revelacaoEm), { weekday: "long" });
  const preco = faixaDePreco(valorOuNulo(r.valorMinimo), valorOuNulo(r.valorMaximo));
  return (
    <div data-tema={r.tema} className="vidro-forte overflow-hidden rounded-[1.75rem]" aria-label="Prévia do convite">
      <div className="relative h-32 overflow-hidden">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]">
            <EnfeitesTema tema={r.tema} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
        <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-[#1d2420]">
          {r.visibilidade === "public" ? <Globe2 className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {r.visibilidade === "public" ? "Público" : "Privado"} · {TEMAS[r.tema].nome}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <MarcaPresente tamanho={36} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-suave">Você foi convidado</p>
            <p className="font-titulo text-xl font-semibold leading-tight [overflow-wrap:anywhere]">{r.nome.trim() || "Nome do seu amigo oculto"}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-suave">
          <li className="flex items-center gap-2">
            <CalendarHeart className="size-4 shrink-0 text-t1" aria-hidden /> {quando ?? "Data da revelação a definir"}
          </li>
          <li className="flex items-center gap-2 [overflow-wrap:anywhere]">
            <MapPin className="size-4 shrink-0 text-t1" aria-hidden /> {r.local.trim() || "Local a definir"}
          </li>
          <li className="flex items-center gap-2">
            <Gift className="size-4 shrink-0 text-t1" aria-hidden /> {preco ?? "Sem faixa de valor"}
          </li>
        </ul>
        <div className="fita-ouro h-px w-full opacity-70" aria-hidden />
        <p className="text-xs text-suave">O código, o QR Code e o link do convite são gerados assim que você criar.</p>
      </div>
    </div>
  );
}
