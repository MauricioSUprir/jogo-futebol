import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "ouro" | "esmeralda" | "vidro" | "fantasma" | "perigo" | "contorno";
type Tamanho = "p" | "m" | "g";

const base =
  "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-[transform,box-shadow,background-color,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ouro/45";

const variantes: Record<Variante, string> = {
  primario:
    "text-white bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--t1)_80%,transparent)] hover:shadow-[0_14px_30px_-10px_color-mix(in_oklab,var(--t1)_90%,transparent)] hover:-translate-y-0.5",
  ouro:
    "text-[#3b2a06] bg-[linear-gradient(135deg,#f7dc8e,#e2b04a_55%,#c48c22)] shadow-brilho hover:-translate-y-0.5",
  esmeralda:
    "text-white bg-[linear-gradient(135deg,var(--esmeralda-clara),var(--esmeralda)_55%,var(--esmeralda-escura))] shadow-[0_10px_24px_-10px_rgb(10_122_85/0.7)] hover:-translate-y-0.5",
  vidro: "vidro text-texto hover:bg-vidro-forte",
  fantasma: "text-texto hover:bg-black/5 dark:hover:bg-white/10",
  perigo: "text-white bg-[linear-gradient(135deg,#e0475b,#a10f25)] hover:-translate-y-0.5",
  contorno: "text-texto border border-borda bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
};

const tamanhos: Record<Tamanho, string> = {
  p: "h-9 px-4 text-sm",
  m: "h-11 px-5 text-[15px]",
  g: "h-14 px-7 text-base",
};

export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "m", extra?: string) {
  return cn(base, variantes[variante], tamanhos[tamanho], extra);
}

export interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  brilho?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = "primario", tamanho = "m", carregando, brilho, className, children, disabled, type = "button", ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classesBotao(variante, tamanho, cn(brilho && "brilho", className))}
      {...resto}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function BotaoLink({
  variante = "primario",
  tamanho = "m",
  brilho,
  className,
  ...resto
}: ComponentProps<typeof Link> & { variante?: Variante; tamanho?: Tamanho; brilho?: boolean }) {
  return <Link className={classesBotao(variante, tamanho, cn(brilho && "brilho", className))} {...resto} />;
}

export function BotaoIcone({
  rotulo,
  className,
  children,
  type = "button",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-texto transition hover:bg-black/5 active:scale-95 disabled:opacity-50 dark:hover:bg-white/10",
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}
