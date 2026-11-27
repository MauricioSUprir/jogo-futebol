import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Cartao({ className, forte, ...resto }: HTMLAttributes<HTMLDivElement> & { forte?: boolean }) {
  return <div className={cn(forte ? "vidro-forte" : "vidro", "rounded-cartao p-5 sm:p-6", className)} {...resto} />;
}

export function TituloCartao({
  icone,
  titulo,
  descricao,
  acao,
  nivel = 2,
}: {
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  nivel?: 2 | 3;
}) {
  const H = nivel === 2 ? "h2" : "h3";
  return (
    <div className="mb-4 flex items-start gap-3">
      {icone ? (
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
          {icone}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <H className="font-titulo text-lg font-semibold leading-tight sm:text-xl">{titulo}</H>
        {descricao ? <p className="mt-0.5 text-sm text-suave">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}

export function Selo({
  children,
  cor = "neutro",
  className,
}: {
  children: ReactNode;
  cor?: "neutro" | "rubi" | "esmeralda" | "ouro" | "t1";
  className?: string;
}) {
  const cores = {
    neutro: "bg-black/5 text-suave dark:bg-white/10",
    rubi: "bg-rubi/12 text-rubi",
    esmeralda: "bg-esmeralda/12 text-esmeralda",
    ouro: "bg-ouro/15 text-ouro-escuro dark:text-ouro-claro",
    t1: "bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cores[cor], className)}>
      {children}
    </span>
  );
}

export function Vazio({ icone, titulo, texto, acao }: { icone?: ReactNode; titulo: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-cartao border border-dashed border-borda px-6 py-10 text-center">
      {icone ? <div className="mb-1 text-ouro">{icone}</div> : null}
      <p className="font-titulo text-lg font-semibold">{titulo}</p>
      {texto ? <p className="max-w-sm text-sm text-suave">{texto}</p> : null}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}
