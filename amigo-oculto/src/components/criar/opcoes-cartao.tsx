"use client";
import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type OpcaoCartao<T extends string> = { valor: T; titulo: ReactNode; descricao?: ReactNode; icone?: ReactNode; extra?: ReactNode };

/**
 * Grupo de opções em cartões (rádios nativos: setas do teclado, leitor de tela e formulário funcionam).
 */
export function OpcoesCartao<T extends string>({
  rotulo,
  dica,
  opcoes,
  valor,
  aoMudar,
  nome,
  desabilitado,
  erro,
  colunas = 2,
}: {
  rotulo: ReactNode;
  dica?: ReactNode;
  opcoes: OpcaoCartao<T>[];
  valor: T;
  aoMudar: (v: T) => void;
  nome?: string;
  desabilitado?: boolean;
  erro?: string | null;
  colunas?: 1 | 2 | 4;
}) {
  const id = useId();
  const grupo = nome ?? id;
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", desabilitado && "opacity-65")} disabled={desabilitado} aria-describedby={dica ? `${id}-dica` : undefined}>
      <legend className="mb-1.5 text-sm font-semibold">{rotulo}</legend>
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5",
          colunas === 2 && "sm:grid-cols-2",
          colunas === 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {opcoes.map((o) => {
          const marcado = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={cn(
                "group relative flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border bg-white/55 p-3.5 transition dark:bg-white/[0.04]",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ouro/40",
                marcado
                  ? "border-[color-mix(in_oklab,var(--t1)_70%,transparent)] bg-[color-mix(in_oklab,var(--t1)_9%,transparent)] shadow-[0_8px_24px_-14px_var(--t1)]"
                  : "border-borda hover:border-[color-mix(in_oklab,var(--t1)_35%,transparent)]",
                desabilitado && "cursor-not-allowed",
              )}
            >
              <input
                type="radio"
                name={grupo}
                value={o.valor}
                checked={marcado}
                onChange={() => aoMudar(o.valor)}
                className="sr-only"
              />
              {o.icone ? (
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition",
                    marcado ? "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white" : "bg-black/5 text-suave dark:bg-white/10",
                  )}
                  aria-hidden
                >
                  {o.icone}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{o.titulo}</span>
                {o.descricao ? <span className="mt-0.5 block text-sm leading-snug text-suave">{o.descricao}</span> : null}
                {o.extra}
              </span>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition",
                  marcado ? "border-transparent bg-t1 text-white" : "border-borda",
                )}
              >
                {marcado ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </div>
      {erro ? (
        <p className="text-sm font-medium text-rubi" role="alert">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-xs text-suave">
          {dica}
        </p>
      ) : null}
    </fieldset>
  );
}
