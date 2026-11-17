import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Modulo } from "@/lib/modulos";
import { FASES } from "@/lib/modulos";
import { cn } from "@/lib/cn";

export function CartaoModulo({ m }: { m: Modulo }) {
  const conteudo = (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold">{m.nome}</p>
        <p className="mt-0.5 text-sm text-suave">{m.descricao}</p>
      </div>
      {m.href ? (
        <ArrowRight className="h-4 w-4 shrink-0 text-eletrico-claro" aria-hidden />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-borda px-2 py-0.5 text-[0.68rem] text-apagado">
          <Lock className="h-3 w-3" aria-hidden /> {FASES[m.fase].split(" · ")[0]}
        </span>
      )}
    </>
  );
  const cls = cn("painel flex items-center gap-3 p-4", m.href ? "transition hover:border-eletrico/50" : "opacity-60");
  return m.href ? (
    <Link href={m.href} className={cls}>
      {conteudo}
    </Link>
  ) : (
    <div className={cls} aria-label={`${m.nome}: chega na ${FASES[m.fase]}`}>
      {conteudo}
    </div>
  );
}
