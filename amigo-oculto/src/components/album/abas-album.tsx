"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AbaAlbum = { id: string; rotulo: string; extra?: string | null; conteudo: ReactNode };

/** Abas do álbum (teclado: setas, Home e End). A aba aberta fica no endereço (?secao=), sem recarregar. */
export function AbasAlbum({ abas, inicial }: { abas: AbaAlbum[]; inicial?: string }) {
  const [atual, setAtual] = useState(abas.some((a) => a.id === inicial) ? inicial! : abas[0].id);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("secao") !== atual) {
      url.searchParams.set("secao", atual);
      window.history.replaceState(window.history.state, "", url);
    }
    lista.current?.querySelector<HTMLElement>(`[data-aba="${atual}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [atual]);

  function tecla(e: React.KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === atual);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % abas.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + abas.length) % abas.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = abas.length - 1;
    else return;
    e.preventDefault();
    setAtual(abas[n].id);
    lista.current?.querySelector<HTMLElement>(`[data-aba="${abas[n].id}"]`)?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <div ref={lista} role="tablist" aria-label="Seções do álbum" onKeyDown={tecla} className="rolagem-fina -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            data-aba={a.id}
            id={`aba-album-${a.id}`}
            aria-selected={atual === a.id}
            aria-controls={`painel-album-${a.id}`}
            tabIndex={atual === a.id ? 0 : -1}
            onClick={() => setAtual(a.id)}
            className={cn(
              "vidro inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-suave transition hover:text-texto",
              atual === a.id && "bg-[color-mix(in_oklab,var(--t1)_16%,transparent)] text-t1",
            )}
          >
            {a.rotulo}
            {a.extra ? <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{a.extra}</span> : null}
          </button>
        ))}
      </div>
      {abas.map((a) => (
        <div key={a.id} role="tabpanel" id={`painel-album-${a.id}`} aria-labelledby={`aba-album-${a.id}`} hidden={atual !== a.id} tabIndex={0} className="focus-visible:outline-none">
          {atual === a.id ? a.conteudo : null}
        </div>
      ))}
    </div>
  );
}
