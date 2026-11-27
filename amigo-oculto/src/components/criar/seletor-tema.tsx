"use client";
import { Check } from "lucide-react";
import { TEMAS, type Tema } from "@/lib/temas";
import { cn } from "@/lib/cn";
import { EnfeitesTema } from "@/components/grupo/enfeites";

/** Escolha do tema com amostra de cada um (cada cartão usa as cores do próprio tema). */
export function SeletorTema({ valor, aoMudar, desabilitado }: { valor: Tema; aoMudar: (t: Tema) => void; desabilitado?: boolean }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={desabilitado}>
      <legend className="mb-1.5 text-sm font-semibold">Tema visual</legend>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {(Object.keys(TEMAS) as Tema[]).map((t) => {
          const info = TEMAS[t];
          const marcado = valor === t;
          return (
            <label
              key={t}
              data-tema={t}
              className={cn(
                "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/55 transition dark:bg-white/[0.04]",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ouro/40",
                marcado ? "border-t1 shadow-[0_10px_26px_-14px_var(--t1)]" : "border-borda hover:-translate-y-0.5",
              )}
            >
              <input type="radio" name="tema" value={t} checked={marcado} onChange={() => aoMudar(t)} className="sr-only" />
              <span className="relative block h-16 overflow-hidden bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]" aria-hidden>
                <EnfeitesTema tema={t} />
                {marcado ? (
                  <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-white text-t1 shadow">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span className="flex flex-col gap-1 p-3">
                <span className="flex items-center gap-1.5">
                  {info.cores.map((c) => (
                    <span key={c} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: c }} aria-hidden />
                  ))}
                  <span className="ml-1 text-[15px] font-semibold">{info.nome}</span>
                </span>
                <span className="text-xs leading-snug text-suave">{info.descricao}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
