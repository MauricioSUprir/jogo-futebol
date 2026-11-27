"use client";
import { useEffect, useState } from "react";
import { dataHora, relativo } from "@/lib/formatos";

/**
 * "há 5 minutos" que não diverge entre o servidor e o navegador: na primeira pintura mostra a data fixa e, já no
 * navegador, troca para o relativo (e atualiza a cada minuto).
 */
export function TempoRelativo({ iso, prefixo }: { iso: string; prefixo?: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    const atualizar = () => setTexto(relativo(iso));
    atualizar();
    const t = setInterval(atualizar, 60_000);
    return () => clearInterval(t);
  }, [iso]);
  return (
    <time dateTime={iso} title={dataHora(iso, { year: "numeric" }) ?? undefined}>
      {prefixo ? `${prefixo} ` : ""}
      {texto ?? `em ${dataHora(iso)}`}
    </time>
  );
}
