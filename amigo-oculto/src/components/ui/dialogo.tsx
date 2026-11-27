"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Diálogo modal acessível sobre o <dialog> nativo (foco preso, Esc fecha, o resto da página fica inerte).
 */
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  className,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
  largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      aria-labelledby="dialogo-titulo"
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-[1.75rem] border-0 bg-transparent p-0 text-texto backdrop:bg-black/45 backdrop:backdrop-blur-sm",
        largura,
      )}
    >
      {aberto ? (
        <div className={cn("vidro-forte max-h-[85dvh] overflow-y-auto rounded-[1.75rem] p-6", className)}>
          <div className="mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="dialogo-titulo" className="font-titulo text-xl font-semibold">
                {titulo}
              </h2>
              {descricao ? <p className="mt-1 text-sm text-suave">{descricao}</p> : null}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="inline-flex size-9 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
