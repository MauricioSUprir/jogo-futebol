"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { useLimitado, useTempoReal } from "@/components/sala/ao-vivo";

/**
 * Sino com o número de não lidas, em tempo real (Supabase Realtime + RLS). Nova notificação: +1, aviso e som.
 * Lidas/apagadas: recontagem no banco (a linha antiga do Realtime não traz o read_at).
 */
export function SinoNotificacoes({ usuarioId, inicial }: { usuarioId: string; inicial: number }) {
  const [naoLidas, setNaoLidas] = useState(inicial);
  const { avisar } = useAvisos();
  const { som } = usePreferencias();
  useEffect(() => setNaoLidas(inicial), [inicial]);

  const recontar = useCallback(async () => {
    const { count } = await clienteNavegador().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    if (typeof count === "number") setNaoLidas(count);
  }, []);
  const recontarLimitado = useLimitado(() => void recontar(), 800);

  const estado = useTempoReal(
    `sino:${usuarioId}`,
    [
      { tabela: "notifications", evento: "INSERT", filtro: `user_id=eq.${usuarioId}` },
      { tabela: "notifications", evento: "UPDATE", filtro: `user_id=eq.${usuarioId}` },
    ],
    (m) => {
      if (m.tipo === "INSERT") {
        setNaoLidas((n) => n + 1);
        const titulo = m.nova.title as string | undefined;
        if (titulo) avisar(titulo, "info");
        tocar("sino", som);
      } else {
        recontarLimitado();
      }
    },
  );

  // voltou à aba ou reconectou: confere o número no banco
  useEffect(() => {
    if (estado === "ao-vivo") recontarLimitado();
  }, [estado, recontarLimitado]);
  useEffect(() => {
    const f = () => document.visibilityState === "visible" && recontarLimitado();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [recontarLimitado]);

  return (
    <Link
      href="/notificacoes"
      aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : "Notificações"}
      className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <Bell className="size-5" aria-hidden />
      {naoLidas > 0 ? (
        <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rubi px-1 text-[10px] font-bold leading-5 text-white">
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      ) : null}
    </Link>
  );
}
