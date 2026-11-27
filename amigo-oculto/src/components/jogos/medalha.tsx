import {
  BookOpen,
  CalendarCheck,
  Camera,
  Clover,
  Dices,
  Eye,
  Gift,
  Hourglass,
  ListChecks,
  Mail,
  MessagesSquare,
  Palette,
  Search,
  Vote,
  type LucideIcon,
} from "lucide-react";
import type { ConquistaCalculada, NomeIcone } from "@/lib/conquistas";
import { cn } from "@/lib/cn";

const ICONES: Record<NomeIcone, LucideIcon> = {
  CalendarCheck,
  Eye,
  ListChecks,
  Gift,
  MessagesSquare,
  Palette,
  Search,
  Mail,
  Hourglass,
  Clover,
  Dices,
  Camera,
  Vote,
  BookOpen,
};

const CORES = {
  ouro: "from-[#f7dc8e] via-[#e2b04a] to-[#a8761a] text-[#3b2a06]",
  rubi: "from-[#ef4a5f] via-[#c0182f] to-[#7a0b1c] text-white",
  esmeralda: "from-[#4fd8a8] via-[#0a7a55] to-[#064d36] text-white",
  t1: "from-[color-mix(in_oklab,var(--t1)_70%,white)] via-[var(--t1)] to-[color-mix(in_oklab,var(--t1)_60%,black)] text-white",
} as const;

/** Medalha circular com o ícone da conquista (cinza enquanto não foi conquistada). */
export function Medalha({ c, tamanho = 56 }: { c: Pick<ConquistaCalculada, "icone" | "cor" | "conquistada" | "nome">; tamanho?: number }) {
  const Icone = ICONES[c.icone];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-md",
        c.conquistada ? CORES[c.cor] : "from-black/10 to-black/20 text-suave grayscale dark:from-white/10 dark:to-white/5",
      )}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      <span className="absolute inset-[3px] rounded-full border border-white/40" />
      <Icone style={{ width: tamanho * 0.45, height: tamanho * 0.45 }} />
    </span>
  );
}
