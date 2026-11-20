// Ícones das categorias de metas (lucide, sem emoji).
import { Cpu, Goal, GraduationCap, HeartPulse, Palette, Sprout, Wallet, type LucideIcon } from "lucide-react";
import { categoriaMeta } from "@/lib/metas";

export const ICONES_CATEGORIA: Record<string, LucideIcon> = {
  saude: HeartPulse,
  estudos: GraduationCap,
  tecnologia: Cpu,
  financas: Wallet,
  futebol: Goal,
  pessoal: Sprout,
  criativo: Palette,
};

export function IconeCategoria({ categoria, tamanho = "m" }: { categoria: string; tamanho?: "p" | "m" }) {
  const I = ICONES_CATEGORIA[categoria] ?? Sprout;
  const c = categoriaMeta(categoria);
  return (
    <span
      className={tamanho === "p" ? "grid grid-cols-1 h-8 w-8 shrink-0 place-items-center rounded-lg border" : "grid grid-cols-1 h-10 w-10 shrink-0 place-items-center rounded-xl border"}
      style={{ borderColor: c.cor + "55", background: c.cor + "18", color: c.cor }}
      aria-hidden
    >
      <I className={tamanho === "p" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}
