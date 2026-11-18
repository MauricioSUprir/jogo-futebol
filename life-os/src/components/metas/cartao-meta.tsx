// Uma meta na lista do Goals Center.
import Link from "next/link";
import { CalendarClock, CircleCheck, CirclePause, ChevronRight } from "lucide-react";
import type { MetaCarregada } from "@/lib/servidor/metas";
import { categoriaMeta, PRIORIDADES_META, textoPrazo } from "@/lib/metas";
import { diaCurto } from "@/lib/datas";
import { Barra, Selo } from "../ui";
import { IconeCategoria } from "./icones";
import { cn } from "@/lib/cn";

const COR_PRIORIDADE: Record<number, string> = { 1: "#F43F5E", 2: "#F59E0B", 3: "#94A3B8" };

export function CartaoMeta({ m, hojeK }: { m: MetaCarregada; hojeK: string }) {
  const cat = categoriaMeta(m.category);
  const prazo = m.prazo && m.status !== "concluido" ? textoPrazo(m.prazo, hojeK) : null;
  const proxima = m.measure === "etapas" ? m.steps.find((s) => !s.done) : null;
  return (
    <li>
      <Link href={`/metas/${m.id}`} className={cn("painel flex min-w-0 gap-3 p-4 transition hover:border-eletrico/50", m.status === "pausado" && "opacity-70")} data-testid={`meta-${m.title}`}>
        <IconeCategoria categoria={m.category} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <p className="min-w-0 flex-1 break-words font-medium">{m.title}</p>
            {m.status === "concluido" ? (
              <CircleCheck className="h-5 w-5 shrink-0 text-ok" aria-label="Concluída" />
            ) : m.status === "pausado" ? (
              <CirclePause className="h-5 w-5 shrink-0 text-suave" aria-label="Pausada" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-apagado" aria-hidden />
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
            <span>{cat.curto}</span>
            {m.status !== "concluido" && <Selo cor={COR_PRIORIDADE[m.priority]}>Prioridade {PRIORIDADES_META[m.priority]?.toLowerCase()}</Selo>}
            {m.year && <Selo cor="#a78bfa">Objetivo {m.year}</Selo>}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Barra pct={m.progresso} className="flex-1" cor={m.status === "concluido" ? "var(--color-ok)" : undefined} rotulo={`Progresso de ${m.title}`} />
            <span className="numero w-10 shrink-0 text-right text-xs font-semibold">{m.progresso}%</span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-suave">
            <span className="numero">{m.texto}</span>
            {prazo && (
              <span className={cn("flex items-center gap-1", prazo.atrasada && "text-alerta")}>
                <CalendarClock className="h-3 w-3" aria-hidden /> {prazo.texto}
              </span>
            )}
            {m.status === "concluido" && m.completedAt && <span>concluída</span>}
            {m.status === "concluido" && m.prazo && <span>prazo {diaCurto(m.prazo)}</span>}
          </p>
          {proxima && m.status === "ativo" && <p className="mt-1 truncate text-xs text-eletrico-claro">Próxima etapa: {proxima.title}</p>}
        </div>
      </Link>
    </li>
  );
}
