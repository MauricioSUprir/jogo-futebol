"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const caixa =
  "w-full rounded-2xl border border-borda bg-white/70 px-4 text-[15px] text-texto placeholder:text-suave/70 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] " +
  "transition focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 disabled:opacity-60 dark:bg-white/5 " +
  "aria-[invalid=true]:border-rubi aria-[invalid=true]:ring-rubi/20";

type Base = { rotulo?: ReactNode; dica?: ReactNode; erro?: string | null; wrapperClassName?: string };

function Moldura({
  id,
  rotulo,
  dica,
  erro,
  children,
  className,
  opcional,
}: Base & { id: string; children: ReactNode; className?: string; opcional?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rotulo ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {rotulo}
          {opcional ? <span className="ml-1 font-normal text-suave">(opcional)</span> : null}
        </label>
      ) : null}
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-sm font-medium text-rubi" role="alert">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-xs text-suave">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export const Campo = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Base & { opcional?: boolean }>(
  function Campo({ rotulo, dica, erro, wrapperClassName, className, id, opcional, ...resto }, ref) {
    const gerado = useId();
    const meuId = id ?? gerado;
    return (
      <Moldura id={meuId} rotulo={rotulo} dica={dica} erro={erro} className={wrapperClassName} opcional={opcional}>
        <input
          ref={ref}
          id={meuId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${meuId}-erro` : dica ? `${meuId}-dica` : undefined}
          className={cn(caixa, "h-12", className)}
          {...resto}
        />
      </Moldura>
    );
  },
);

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Base & { opcional?: boolean }>(
  function AreaTexto({ rotulo, dica, erro, wrapperClassName, className, id, opcional, ...resto }, ref) {
    const gerado = useId();
    const meuId = id ?? gerado;
    return (
      <Moldura id={meuId} rotulo={rotulo} dica={dica} erro={erro} className={wrapperClassName} opcional={opcional}>
        <textarea
          ref={ref}
          id={meuId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${meuId}-erro` : dica ? `${meuId}-dica` : undefined}
          className={cn(caixa, "min-h-24 py-3 leading-relaxed", className)}
          {...resto}
        />
      </Moldura>
    );
  },
);

export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Base & { opcional?: boolean }>(
  function Selecao({ rotulo, dica, erro, wrapperClassName, className, id, children, opcional, ...resto }, ref) {
    const gerado = useId();
    const meuId = id ?? gerado;
    return (
      <Moldura id={meuId} rotulo={rotulo} dica={dica} erro={erro} className={wrapperClassName} opcional={opcional}>
        <select
          ref={ref}
          id={meuId}
          aria-invalid={erro ? true : undefined}
          className={cn(caixa, "h-12 appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10", className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          }}
          {...resto}
        >
          {children}
        </select>
      </Moldura>
    );
  },
);

/** Interruptor acessível (role=switch). Funciona em formulários pelo input escondido. */
export function Interruptor({
  rotulo,
  descricao,
  name,
  marcado,
  aoMudar,
  padrao,
  desabilitado,
}: {
  rotulo: ReactNode;
  descricao?: ReactNode;
  name?: string;
  marcado?: boolean;
  aoMudar?: (v: boolean) => void;
  padrao?: boolean;
  desabilitado?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start justify-between gap-4 py-2", desabilitado && "opacity-60")}>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{rotulo}</span>
        {descricao ? <span className="block text-sm text-suave">{descricao}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          name={name}
          className="peer sr-only"
          checked={marcado}
          defaultChecked={marcado === undefined ? padrao : undefined}
          onChange={(e) => aoMudar?.(e.target.checked)}
          disabled={desabilitado}
          value="1"
        />
        <span className="h-7 w-12 rounded-full bg-black/15 transition peer-checked:bg-esmeralda peer-focus-visible:ring-4 peer-focus-visible:ring-ouro/40 dark:bg-white/15" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
