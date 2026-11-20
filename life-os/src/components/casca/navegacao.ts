import {
  Apple, BrainCircuit, CalendarDays, Droplets, Dumbbell, Flame, Gauge, GraduationCap, HeartPulse, LayoutGrid, MoonStar,
  Settings, Stethoscope, Target, type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  href: string;
  nome: string;
  icone: LucideIcon;
}

export interface GrupoNav {
  nome?: string;
  itens: ItemNav[];
}

/** Menu lateral, em grupos. */
export const NAV_GRUPOS: GrupoNav[] = [
  {
    itens: [
      { href: "/", nome: "Central de Comando", icone: Gauge },
      { href: "/agenda", nome: "Life Calendar", icone: CalendarDays },
      { href: "/habitos", nome: "Habit Tracker", icone: Flame },
      { href: "/metas", nome: "Goals Center", icone: Target },
      { href: "/estudos", nome: "Study Center", icone: GraduationCap },
    ],
  },
  {
    nome: "Saúde",
    itens: [
      { href: "/agua", nome: "Hydro Track", icone: Droplets },
      { href: "/treinos", nome: "Fitness Center", icone: Dumbbell },
      { href: "/sono", nome: "Sleep Lab", icone: MoonStar },
      { href: "/mente", nome: "Mind Center", icone: BrainCircuit },
      { href: "/alimentacao", nome: "Nutrition Hub", icone: Apple },
      { href: "/saude/central", nome: "Health Center", icone: Stethoscope },
    ],
  },
  {
    itens: [
      { href: "/saude", nome: "Saúde e bem-estar", icone: HeartPulse },
      { href: "/mais", nome: "Todos os módulos", icone: LayoutGrid },
    ],
  },
];

export const NAV_PRINCIPAL: ItemNav[] = NAV_GRUPOS.flatMap((g) => g.itens);

export const NAV_CONFIG: ItemNav = { href: "/configuracoes", nome: "Configurações", icone: Settings };

/** Rotas que acendem "Saúde" e "Mais" na barra inferior do celular. */
export const ROTAS_SAUDE = ["/saude", "/agua", "/treinos", "/sono", "/mente", "/alimentacao"];
export const ROTAS_MAIS = ["/mais", "/habitos", "/configuracoes", "/estudos", "/metas"];

export function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** O item mais específico do menu que casa com a rota (ex.: /saude/central acende Health Center, não Saúde). */
export function itemAtivo(pathname: string, itens: ItemNav[]): string | null {
  const casam = itens.filter((i) => ativo(pathname, i.href));
  return casam.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
