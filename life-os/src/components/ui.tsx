// Componentes base (no estilo shadcn/ui, feitos à mão com Tailwind — sem dependências extras).
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo" | "contorno";
type TamanhoBotao = "p" | "m" | "g" | "icone";

export function classesBotao(variante: VarianteBotao = "primario", tamanho: TamanhoBotao = "m", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition select-none",
    "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
    {
      primario:
        "bg-gradient-to-r from-eletrico to-violeta text-white shadow-[0_8px_24px_-12px_rgb(37_99_235/0.9)] hover:brightness-110",
      secundario: "bg-painel-2 text-texto border border-borda hover:border-borda-forte hover:bg-[#18213a]",
      fantasma: "text-suave hover:text-texto hover:bg-white/5",
      perigo: "bg-perigo/15 text-[#fda4af] border border-perigo/30 hover:bg-perigo/25",
      contorno: "border border-eletrico/50 text-eletrico-claro hover:bg-eletrico/10",
    }[variante],
    { p: "h-8 px-3 text-sm", m: "h-10 px-4 text-sm", g: "h-12 px-5 text-base", icone: "h-10 w-10" }[tamanho],
    extra,
  );
}

export function Botao({
  variante,
  tamanho,
  className,
  ...props
}: ComponentProps<"button"> & { variante?: VarianteBotao; tamanho?: TamanhoBotao }) {
  return <button {...props} className={classesBotao(variante, tamanho, className)} />;
}

export function Cartao({
  titulo,
  icone: Icone,
  acao,
  className,
  children,
  holo,
  id,
}: {
  titulo?: ReactNode;
  icone?: LucideIcon;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
  holo?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn("painel p-4 sm:p-5 animate-entrar", holo && "holo", className)}>
      {(titulo || acao) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {titulo && (
            <h2 className="flex min-w-0 items-center gap-2 font-display text-[0.95rem] font-semibold tracking-wide">
              {Icone && <Icone aria-hidden className="h-4 w-4 shrink-0 text-eletrico-claro" />}
              <span className="truncate">{titulo}</span>
            </h2>
          )}
          {acao && <div className="flex shrink-0 items-center gap-1">{acao}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const classesEntrada =
  "w-full rounded-xl border border-borda bg-fundo-2/80 px-3 text-sm text-texto placeholder:text-apagado outline-none transition focus:border-eletrico focus:ring-2 focus:ring-eletrico/25 disabled:opacity-60";

export function Entrada({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(classesEntrada, "h-11", className)} />;
}

export function Selecao({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cn(classesEntrada, "seta-select h-11 appearance-none pr-9", className)}>
      {children}
    </select>
  );
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(classesEntrada, "min-h-24 py-2.5", className)} />;
}

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className,
  htmlFor,
}: {
  rotulo: ReactNode;
  dica?: ReactNode;
  erro?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-suave">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="text-xs text-apagado">{dica}</p>}
      {erro && <p className="text-xs text-[#fda4af]">{erro}</p>}
    </div>
  );
}

export function Selo({ children, cor, className }: { children: ReactNode; cor?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium", className)}
      style={cor ? { color: cor, borderColor: cor + "55", background: cor + "18" } : undefined}
    >
      {children}
    </span>
  );
}

export function Vazio({ icone: Icone, titulo, children }: { icone: LucideIcon; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <div className="grid grid-cols-1 h-12 w-12 place-items-center rounded-2xl border border-borda bg-painel-2">
        <Icone aria-hidden className="h-5 w-5 text-eletrico-claro" />
      </div>
      <p className="font-medium">{titulo}</p>
      {children && <div className="text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Mensagem({ tipo, children }: { tipo: "ok" | "erro" | "info"; children: ReactNode }) {
  const cls = {
    ok: "border-ok/30 bg-ok/10 text-[#a7f3d0]",
    erro: "border-perigo/30 bg-perigo/10 text-[#fecdd3]",
    info: "border-eletrico/30 bg-eletrico/10 text-[#bfdbfe]",
  }[tipo];
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={cn("rounded-xl border px-3 py-2 text-sm", cls)}>
      {children}
    </p>
  );
}

export function CabecalhoPagina({
  rotulo,
  titulo,
  descricao,
  acao,
}: {
  rotulo?: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-entrar">
      <div className="min-w-0">
        {rotulo && <p className="rotulo mb-1">{rotulo}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2">{acao}</div>}
    </header>
  );
}

/** Barra de progresso horizontal. */
export function Barra({ pct, cor = "var(--color-eletrico)", className, rotulo }: { pct: number; cor?: string; className?: string; rotulo?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
      className={cn("h-2 overflow-hidden rounded-full bg-white/6", className)}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: cor }} />
    </div>
  );
}
