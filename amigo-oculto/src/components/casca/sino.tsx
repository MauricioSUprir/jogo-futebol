"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";

/** Sino com o número de não lidas, atualizado em tempo real (Supabase Realtime + RLS). */
export function SinoNotificacoes({ usuarioId, inicial }: { usuarioId: string; inicial: number }) {
  const [naoLidas, setNaoLidas] = useState(inicial);
  const { avisar } = useAvisos();
  const { som } = usePreferencias();
  useEffect(() => setNaoLidas(inicial), [inicial]);
  useEffect(() => {
    const supabase = clienteNavegador();
    const canal = supabase
      .channel(`notificacoes:${usuarioId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${usuarioId}` },
        (payload) => {
          setNaoLidas((n) => n + 1);
          const titulo = (payload.new as { title?: string }).title;
          if (titulo) avisar(titulo, "info");
          tocar("sino", som);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${usuarioId}` },
        (payload) => {
          const antes = payload.old as { read_at?: string | null };
          const depois = payload.new as { read_at?: string | null };
          if (!antes.read_at && depois.read_at) setNaoLidas((n) => Math.max(0, n - 1));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, avisar, som]);
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
