import { CalendarDays, Droplets, Flame, Gauge, HeartPulse, LayoutGrid, Settings, type LucideIcon } from "lucide-react";

export interface ItemNav {
  href: string;
  nome: string;
  icone: LucideIcon;
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { href: "/", nome: "Central de Comando", icone: Gauge },
  { href: "/agua", nome: "Hydro Track", icone: Droplets },
  { href: "/habitos", nome: "Habit Tracker", icone: Flame },
  { href: "/agenda", nome: "Life Calendar", icone: CalendarDays },
  { href: "/saude", nome: "Saúde", icone: HeartPulse },
  { href: "/mais", nome: "Todos os módulos", icone: LayoutGrid },
];

export const NAV_CONFIG: ItemNav = { href: "/configuracoes", nome: "Configurações", icone: Settings };

export function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
