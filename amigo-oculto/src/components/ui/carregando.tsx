import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Girando({ className, rotulo = "Carregando" }: { className?: string; rotulo?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-suave", className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{rotulo}</span>
    </span>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-black/8 dark:bg-white/8", className)} />;
}

export function CarregandoPagina() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8" role="status" aria-label="Carregando">
      <Esqueleto className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Esqueleto className="h-32" />
        <Esqueleto className="h-32" />
      </div>
      <Esqueleto className="h-56 w-full" />
    </div>
  );
}
