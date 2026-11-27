"use client";
import { useEffect, useState } from "react";
import { dataHora, relativo } from "@/lib/formatos";

/** "há 5 minutos", atualizado a cada minuto; a data completa fica no title (e no dateTime para leitores de tela). */
export function TempoRelativo({ iso, className }: { iso: string; className?: string }) {
  const [, setTique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTique((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={dataHora(iso) ?? undefined} className={className} suppressHydrationWarning>
      {relativo(iso)}
    </time>
  );
}

const FUSO = "America/Sao_Paulo";

export function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** Chave do dia no fuso de São Paulo (AAAA-MM-DD). */
export function chaveDoDia(iso: string | number | Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** "Hoje", "Ontem" ou "24 de dezembro" (com o ano se não for o atual). */
export function rotuloDoDia(iso: string, agora = Date.now()) {
  const dia = chaveDoDia(iso);
  if (dia === chaveDoDia(agora)) return "Hoje";
  if (dia === chaveDoDia(agora - 86_400_000)) return "Ontem";
  const mesmoAno = dia.slice(0, 4) === chaveDoDia(agora).slice(0, 4);
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(mesmoAno ? {} : { year: "numeric" }),
  });
}
