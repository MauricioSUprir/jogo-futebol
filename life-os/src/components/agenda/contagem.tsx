"use client";
import { useEffect, useState } from "react";

/** Contagem regressiva ao vivo para o Modo foco. */
export function Contagem({ inicio, fim }: { inicio: number; fim: number }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (agora === null) return <div className="h-20" />;
  const resta = Math.max(0, fim - agora);
  const pct = Math.min(100, Math.max(0, ((agora - inicio) / (fim - inicio)) * 100));
  const h = Math.floor(resta / 3_600_000);
  const m = Math.floor((resta % 3_600_000) / 60_000);
  const s = Math.floor((resta % 60_000) / 1000);
  return (
    <div>
      <p className="numero font-display text-5xl font-bold tracking-tight sm:text-6xl" aria-live="off">
        {h > 0 && `${h}:`}
        {String(m).padStart(h > 0 ? 2 : 1, "0")}:{String(s).padStart(2, "0")}
      </p>
      <p className="mt-1 text-sm text-suave">{resta === 0 ? "Terminou" : "restando"}</p>
      <div className="mx-auto mt-5 h-2 max-w-md overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento da atividade">
        <div className="h-full rounded-full bg-gradient-to-r from-ciano via-eletrico to-violeta transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
