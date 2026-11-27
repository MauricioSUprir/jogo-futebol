import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Barra "X de N" acessível (role=progressbar), nas cores do tema. */
export function BarraProgresso({
  rotulo,
  valor,
  total,
  icone,
  cor = "t1",
  detalhe,
}: {
  rotulo: string;
  valor: number;
  total: number;
  icone?: ReactNode;
  cor?: "t1" | "esmeralda" | "ouro";
  detalhe?: ReactNode;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  const preenchimento = {
    t1: "bg-[linear-gradient(90deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,var(--t3)))]",
    esmeralda: "bg-[linear-gradient(90deg,var(--esmeralda),var(--esmeralda-clara))]",
    ouro: "bg-[linear-gradient(90deg,var(--ouro-escuro),var(--ouro-claro))]",
  }[cor];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {icone ? <span className="shrink-0 text-t1">{icone}</span> : null}
          <span className="min-w-0">{rotulo}</span>
        </p>
        <p className="shrink-0 text-sm tabular-nums text-suave">
          <strong className="font-titulo text-lg text-texto">{valor}</strong> de {total}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={valor}
        aria-valuetext={`${valor} de ${total} (${pct}%)`}
        className="h-2.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700", preenchimento)} style={{ width: `${pct}%` }} />
      </div>
      {detalhe ? <p className="mt-1.5 text-xs text-suave">{detalhe}</p> : null}
    </div>
  );
}
