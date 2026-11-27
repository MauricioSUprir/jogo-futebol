"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 };
}

/** Contagem regressiva ao vivo até `alvo`. Anuncia para leitores de tela só a cada minuto (aria-live educado). */
export function Contagem({ alvo, rotulo, compacta, className }: { alvo: string; rotulo?: string; compacta?: boolean; className?: string }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const fim = new Date(alvo).getTime();
  if (agora === null) return <div className={cn("h-16", className)} aria-hidden />;
  const restante = fim - agora;
  if (restante <= 0) return <p className={cn("font-titulo text-lg font-semibold text-t1", className)}>É hoje!</p>;
  const p = partes(restante);
  const itens: [number, string][] = [
    [p.dias, p.dias === 1 ? "dia" : "dias"],
    [p.horas, "horas"],
    [p.minutos, "min"],
    [p.segundos, "seg"],
  ];
  return (
    <div className={className}>
      {rotulo ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-suave">{rotulo}</p> : null}
      <div className="flex gap-2" aria-hidden>
        {itens.map(([v, r]) => (
          <div key={r} className={cn("vidro flex flex-col items-center rounded-2xl", compacta ? "min-w-12 px-2 py-1.5" : "min-w-16 px-3 py-2")}>
            <span className={cn("font-titulo font-semibold tabular-nums", compacta ? "text-lg" : "text-2xl sm:text-3xl")}>
              {String(v).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-suave">{r}</span>
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Faltam {p.dias} dias, {p.horas} horas e {p.minutos} minutos.
      </p>
    </div>
  );
}
