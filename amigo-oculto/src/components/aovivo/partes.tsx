"use client";
import { Gift } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { mmss } from "@/components/aovivo/estado";

/** Anel do temporizador do discurso. */
export function RelogioDiscurso({
  restantes,
  total,
  rodando,
  tamanho = 180,
  className,
}: {
  restantes: number;
  total: number;
  rodando: boolean;
  tamanho?: number;
  className?: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const fracao = total > 0 ? Math.max(0, Math.min(1, restantes / total)) : 0;
  const acabando = restantes <= 10 && restantes > 0;
  const esgotado = restantes === 0;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={esgotado || acabando ? "var(--rubi)" : "var(--ouro)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fracao)}
          style={{ transition: "stroke-dashoffset .25s linear, stroke .3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-titulo font-semibold tabular-nums leading-none", esgotado && "animate-pulse text-rubi", acabando && "text-rubi")}
          style={{ fontSize: tamanho * 0.24 }}
        >
          {mmss(restantes)}
        </span>
        <span className="mt-1 text-[0.7em] font-semibold uppercase tracking-[0.18em] text-suave">
          {esgotado ? "Tempo!" : rodando ? "discurso" : "pausado"}
        </span>
      </div>
    </div>
  );
}

/** "Fulano → Beltrano" com as duas fotos e um presente no meio. */
export function ParRevelado({
  de,
  para,
  tamanho = 56,
  animado,
  className,
}: {
  de: { nome: string; avatar: string | null };
  para: { nome: string; avatar: string | null };
  tamanho?: number;
  animado?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <Avatar nome={de.nome} caminho={de.avatar} tamanho={tamanho} />
        <span className="w-full truncate text-sm font-semibold">{de.nome}</span>
      </div>
      <motion.span
        initial={animado ? { scale: 0, rotate: -30 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--ouro-claro),var(--ouro))] text-[#3b2a06]"
        aria-hidden
      >
        <Gift className="size-4" />
      </motion.span>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <Avatar nome={para.nome} caminho={para.avatar} tamanho={tamanho} />
        <span className="w-full truncate text-sm font-semibold">{para.nome}</span>
      </div>
    </div>
  );
}
