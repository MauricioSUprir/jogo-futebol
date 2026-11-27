"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import type { Database } from "@/lib/database.types";

export type Sessao = Database["public"]["Tables"]["live_sessions"]["Row"];
export type Revelacao = Pick<Database["public"]["Tables"]["live_reveals"]["Row"], "id" | "giver_id" | "receiver_id" | "method" | "revealed_at">;
export type Pista = Pick<Database["public"]["Tables"]["live_clues"]["Row"], "id" | "participant_id" | "body" | "created_at">;
export type PessoaAoVivo = { id: string; nome: string; avatar: string | null; autorizaRevelar: boolean };

export type EstadoAoVivo = {
  sessao: Sessao | null;
  revelacoes: Revelacao[];
  pistas: Pista[];
  /** participant_id → autorizou o organizador a revelar por ele */
  autoriza: Record<string, boolean>;
};

/**
 * Estado da revelação ao vivo, igual no telão e nos celulares: carrega pelo cliente do navegador (RLS vale) e
 * recarrega a cada mudança no tempo real (sessão, revelações, pistas, autorizações). Um recarregamento lento de
 * segurança cobre conexões que caem (TV ligada a noite toda).
 */
export function useAoVivo(
  eventoId: string,
  inicial: EstadoAoVivo,
  eventos: { aoRevelar?: (r: Revelacao) => void; aoPista?: (p: Pista) => void } = {},
) {
  const [estado, setEstado] = useState<EstadoAoVivo>(inicial);
  const vistosRev = useRef(new Set(inicial.revelacoes.map((r) => r.id)));
  const vistosPista = useRef(new Set(inicial.pistas.map((p) => p.id)));
  const ganchos = useRef(eventos);
  useEffect(() => {
    ganchos.current = eventos;
  });

  const recarregar = useCallback(async () => {
    const supabase = clienteNavegador();
    const [s, r, p, a] = await Promise.all([
      supabase.from("live_sessions").select("*").eq("event_id", eventoId).maybeSingle(),
      supabase.from("live_reveals").select("id, giver_id, receiver_id, method, revealed_at").eq("event_id", eventoId).order("revealed_at"),
      supabase.from("live_clues").select("id, participant_id, body, created_at").eq("event_id", eventoId).order("created_at"),
      supabase.from("participants").select("id, allow_public_reveal").eq("event_id", eventoId).eq("status", "approved"),
    ]);
    if (s.error || r.error || p.error) return;
    const revelacoes = r.data ?? [];
    const pistas = p.data ?? [];
    for (const rev of revelacoes) {
      if (!vistosRev.current.has(rev.id)) {
        vistosRev.current.add(rev.id);
        ganchos.current.aoRevelar?.(rev);
      }
    }
    for (const pi of pistas) {
      if (!vistosPista.current.has(pi.id)) {
        vistosPista.current.add(pi.id);
        ganchos.current.aoPista?.(pi);
      }
    }
    setEstado((antes) => ({
      sessao: s.data ?? null,
      revelacoes,
      pistas,
      autoriza: a.data ? Object.fromEntries(a.data.map((x) => [x.id, x.allow_public_reveal])) : antes.autoriza,
    }));
  }, [eventoId]);

  useEffect(() => {
    const supabase = clienteNavegador();
    const filtro = `event_id=eq.${eventoId}`;
    const canal = supabase
      .channel(`aovivo:${eventoId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: filtro }, () => void recarregar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_reveals", filter: filtro }, () => void recarregar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_clues", filter: filtro }, () => void recarregar())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "participants", filter: filtro }, () => void recarregar())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void recarregar();
      });
    const rede = setInterval(() => void recarregar(), 15_000);
    const voltou = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", voltou);
    return () => {
      clearInterval(rede);
      document.removeEventListener("visibilitychange", voltou);
      void supabase.removeChannel(canal);
    };
  }, [eventoId, recarregar]);

  return { estado, recarregar };
}

/** Relógio que anda (para o temporizador). */
export function useAgora(intervalo = 250) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), intervalo);
    return () => clearInterval(t);
  }, [intervalo]);
  return agora;
}

/** Segundos que faltam no discurso e se o relógio está correndo. */
export function temporizador(sessao: Sessao | null, agora: number | null) {
  if (!sessao) return { restantes: 0, total: 60, rodando: false, pausado: false };
  const total = sessao.speech_seconds;
  if (sessao.timer_ends_at) {
    const fim = new Date(sessao.timer_ends_at).getTime();
    const restantes = agora === null ? total : Math.max(0, Math.ceil((fim - agora) / 1000));
    return { restantes, total, rodando: restantes > 0, pausado: false };
  }
  if (sessao.timer_paused_left !== null && sessao.timer_paused_left !== undefined) {
    return { restantes: sessao.timer_paused_left, total, rodando: false, pausado: true };
  }
  return { restantes: total, total, rodando: false, pausado: false };
}

export function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
