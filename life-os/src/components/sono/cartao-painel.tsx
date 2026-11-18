// Cartão do Sleep Lab no painel: o lembrete de preparar o descanso (na janela antes do horário de dormir)
// ou a última noite e a média da semana.
import Link from "next/link";
import { ArrowRight, BedDouble, MoonStar } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { diaRelativo, horaNoFuso, minutosNoFuso } from "@/lib/datas";
import { QUALIDADE, duracaoMin, formatarDuracao, lembreteDescanso } from "@/lib/sono";
import { resumoSono } from "@/lib/servidor/sono";
import { Barra, Cartao, classesBotao } from "../ui";

export async function CartaoPainelSono({ user, hojeK }: { user: User; hojeK: string }) {
  const tz = user.timezone;
  const { cfg, ultima, media, n } = await resumoSono(user, hojeK);
  const descanso = lembreteDescanso(minutosNoFuso(new Date(), tz), cfg.bedtime, cfg.remindMin);
  const dur = ultima ? duracaoMin(ultima) : 0;
  return (
    <Cartao
      titulo="Sleep Lab"
      icone={MoonStar}
      acao={
        <Link href="/sono" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {descanso && (
        <div role="status" className="mb-3 flex items-start gap-3 rounded-xl border border-violeta/40 bg-violeta/10 px-3 py-2.5">
          <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-violeta-claro" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hora de preparar o descanso</p>
            <p className="text-xs text-suave">Seu horário de dormir é {cfg.bedtime}. Que tal ir desacelerando e deixar a tela de lado?</p>
          </div>
        </div>
      )}
      {!ultima ? (
        <p className="text-sm text-suave">
          Nenhuma noite registrada nesta semana.{" "}
          <Link href="/sono" className="text-eletrico-claro hover:underline">
            Registrar a noite
          </Link>
        </p>
      ) : (
        <>
          <p className="text-xs text-suave first-letter:uppercase">Última noite · acordou {diaRelativo(ultima.dia, hojeK).toLowerCase()}</p>
          <p className="numero mt-1 font-display text-2xl font-bold">{formatarDuracao(dur)}</p>
          <p className="numero text-sm text-suave">
            {horaNoFuso(ultima.deitou, tz)} → {horaNoFuso(ultima.acordou, tz)}
            {ultima.qualidade ? ` · ${QUALIDADE[ultima.qualidade]}` : ""}
          </p>
          <Barra pct={(dur / cfg.targetMin) * 100} cor="linear-gradient(90deg,#7c3aed,#2563eb)" className="mt-3" rotulo="Última noite em relação à meta de sono" />
          <p className="mt-2 text-xs text-suave">
            Meta {formatarDuracao(cfg.targetMin)} · média da semana <span className="numero text-texto">{formatarDuracao(media)}</span> ({n}{" "}
            {n === 1 ? "noite" : "noites"})
          </p>
        </>
      )}
    </Cartao>
  );
}
