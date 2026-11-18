// Ícone e texto do humor (1–5) para telas de servidor.
import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import { HUMOR } from "@/lib/checkin";
import { cn } from "@/lib/cn";

export const ICONE_HUMOR: Record<number, LucideIcon> = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh };
const COR_HUMOR: Record<number, string> = { 1: "text-[#fda4af]", 2: "text-alerta", 3: "text-suave", 4: "text-eletrico-claro", 5: "text-ok" };

export function SeloHumor({ humor, grande }: { humor: number; grande?: boolean }) {
  const Icone = ICONE_HUMOR[humor] ?? Meh;
  return (
    <span className={cn("inline-flex items-center gap-1.5", COR_HUMOR[humor])}>
      <Icone className={grande ? "h-7 w-7" : "h-4 w-4"} aria-hidden />
      <span className={cn(grande ? "font-display text-lg font-semibold text-texto" : "text-sm text-texto")}>{HUMOR[humor]}</span>
    </span>
  );
}
