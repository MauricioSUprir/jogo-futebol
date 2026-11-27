"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { cn } from "@/lib/cn";

/**
 * Assinatura de uma tabela no Realtime (postgres_changes respeita o RLS de quem assina).
 * - `filtro`: ex. `event_id=eq.<id>`. DELETE não aceita filtro no Supabase: para apagar, use `evento: "DELETE"` sem
 *   filtro e limite pelo `campo`/`valores` (a linha antiga traz só a chave primária).
 * - `campo` + `valores`: só reage se a linha (nova ou antiga) tiver `campo` entre os `valores`.
 */
export type Assinatura = {
  tabela: string;
  evento?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filtro?: string;
  campo?: string;
  valores?: string[];
};

type Linha = Record<string, unknown>;
export type Mudanca = { tabela: string; tipo: string; nova: Linha; antiga: Linha };

/** Nome único por montagem: o `channel()` do supabase-js reaproveita um canal com o mesmo nome (e o React monta duas
 * vezes em desenvolvimento), o que faria o `.on()` cair num canal já assinado. */
function nomeUnico(base: string) {
  return `${base}:${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Assina várias tabelas num canal só e chama `aoMudar` a cada mudança que passar pelos filtros.
 * Devolve o estado da conexão ("conectando" | "ao-vivo" | "caiu").
 */
export function useTempoReal(canal: string, assinaturas: Assinatura[], aoMudar: (m: Mudanca) => void, ligado = true) {
  const [estado, setEstado] = useState<"conectando" | "ao-vivo" | "caiu">("conectando");
  const refAssinaturas = useRef(assinaturas);
  const refAoMudar = useRef(aoMudar);
  useEffect(() => {
    refAssinaturas.current = assinaturas;
    refAoMudar.current = aoMudar;
  });
  // só reassina quando muda o que vai para o servidor (tabela, evento, filtro)
  const chave = assinaturas.map((a) => `${a.tabela}|${a.evento ?? "*"}|${a.filtro ?? ""}`).join(";");

  // `tentativa` muda quando o servidor recusa o canal: assina de novo (com o token renovado)
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ligado) return;
    const supabase = clienteNavegador();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let encerrado = false;
    let refazer: ReturnType<typeof setTimeout> | null = null;
    const falhou = () => {
      setEstado("caiu");
      if (!encerrado && !refazer) refazer = setTimeout(() => setTentativa((t) => t + 1), Math.min(15_000, 1500 * 2 ** Math.min(tentativa, 3)));
    };
    void (async () => {
      // O join leva o token que o Realtime já tem NAQUELE instante; logo depois de carregar a página ele ainda não
      // chegou (é buscado de forma assíncrona) e o canal entraria como `anon` — o RLS recusa os filtros e nada chega.
      try {
        await supabase.realtime.setAuth();
      } catch {
        // sem sessão: o canal falha e tenta de novo
      }
      if (encerrado) return;
      ch = supabase.channel(nomeUnico(canal));
      refAssinaturas.current.forEach((a, i) => {
        const config = {
          event: a.evento ?? "*",
          schema: "public",
          table: a.tabela,
          ...(a.filtro ? { filter: a.filtro } : {}),
        } as const;
        ch!.on("postgres_changes", config as never, (payload: RealtimePostgresChangesPayload<Linha>) => {
          const atual = refAssinaturas.current[i] ?? a;
          const nova = (payload.new ?? {}) as Linha;
          const antiga = (payload.old ?? {}) as Linha;
          if (atual.campo && atual.valores) {
            const v = (nova[atual.campo] ?? antiga[atual.campo]) as string | undefined;
            if (!v || !atual.valores.includes(v)) return;
          }
          refAoMudar.current({ tabela: a.tabela, tipo: payload.eventType, nova, antiga });
        });
      });
      // recusa das assinaturas (ex.: filtro negado) chega como mensagem de sistema com status "error"
      ch.on("system", {}, (m: { status?: string; extension?: string }) => {
        if (m?.status === "error" && m.extension === "postgres_changes") falhou();
      });
      ch.subscribe((status) => {
        if (encerrado) return;
        if (status === "SUBSCRIBED") setEstado("ao-vivo");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") falhou();
      });
    })();
    return () => {
      encerrado = true;
      if (refazer) clearTimeout(refazer);
      if (ch) void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, chave, ligado, tentativa]);

  return estado;
}

/** Chama `fn` no máximo uma vez a cada `intervalo` ms (a última chamada nunca se perde). */
export function useLimitado(fn: () => void, intervalo = 1200) {
  const ultima = useRef(0);
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refFn = useRef(fn);
  useEffect(() => {
    refFn.current = fn;
  });
  useEffect(
    () => () => {
      if (pendente.current) clearTimeout(pendente.current);
    },
    [],
  );
  return useRef(() => {
    const agora = Date.now();
    const falta = ultima.current + intervalo - agora;
    if (falta <= 0) {
      ultima.current = agora;
      refFn.current();
    } else if (!pendente.current) {
      pendente.current = setTimeout(() => {
        pendente.current = null;
        ultima.current = Date.now();
        refFn.current();
      }, falta);
    }
  }).current;
}

/**
 * Mantém uma página do servidor atualizada: a cada mudança nas tabelas assinadas, `router.refresh()` (com intervalo
 * mínimo). Também atualiza quando a aba volta a ficar visível (pega o que passou com o aparelho dormindo).
 */
export function AtualizarAoVivo({
  canal,
  assinaturas,
  mostrar = false,
  className,
}: {
  canal: string;
  assinaturas: Assinatura[];
  mostrar?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const atualizar = useLimitado(() => router.refresh(), 1200);
  const estado = useTempoReal(canal, assinaturas, () => atualizar());
  // voltou depois de cair: busca o que passou nesse meio-tempo
  const anterior = useRef(estado);
  useEffect(() => {
    if (anterior.current === "caiu" && estado === "ao-vivo") atualizar();
    anterior.current = estado;
  }, [estado, atualizar]);
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [atualizar]);
  if (!mostrar) return null;
  return <IndicadorAoVivo estado={estado} className={className} />;
}

export function IndicadorAoVivo({ estado, className }: { estado: "conectando" | "ao-vivo" | "caiu"; className?: string }) {
  const texto = estado === "ao-vivo" ? "Ao vivo" : estado === "caiu" ? "Reconectando…" : "Conectando…";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-suave", className)}
      title={estado === "ao-vivo" ? "Esta página se atualiza sozinha" : undefined}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          estado === "ao-vivo" ? "bg-esmeralda shadow-[0_0_0_3px_color-mix(in_oklab,var(--esmeralda)_25%,transparent)]" : "bg-ouro",
        )}
      />
      {texto}
    </span>
  );
}
