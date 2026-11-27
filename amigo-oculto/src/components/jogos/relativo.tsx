"use client";
import { useEffect, useState } from "react";
import { dataHora, relativo } from "@/lib/formatos";

/**
 * "há 3 minutos" em componente cliente: o texto do servidor e o do navegador podem diferir por segundos, então a
 * hidratação ignora esse texto e ele se atualiza a cada minuto.
 */
export function Relativo({ iso, className }: { iso: string; className?: string }) {
  const [, setTique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTique((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={dataHora(iso, { year: "numeric" }) ?? undefined} className={className} suppressHydrationWarning>
      {relativo(iso)}
    </time>
  );
}
