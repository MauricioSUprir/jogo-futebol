"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Lightbulb,
  KanbanSquare,
  CalendarDays,
  BarChart3,
  Sparkles,
  Palette,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

type Item = { href: string; label: string; icon: React.ElementType; admin?: boolean };

const ITEMS: Item[] = [
  { href: "/ideias", label: "Ideias", icon: Lightbulb },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/metricas", label: "Métricas", icon: BarChart3, admin: true },
  { href: "/sugestoes", label: "IA", icon: Sparkles, admin: true },
  { href: "/pilares", label: "Pilares", icon: Palette, admin: true },
  { href: "/config", label: "Config", icon: Settings, admin: true },
];

export function AppShell({
  children,
  papel,
  nome,
}: {
  children: React.ReactNode;
  papel: "admin" | "editor";
  nome: string;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.admin || papel === "admin");

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card p-3 md:flex">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.14), rgba(255,194,31,.18))" }}
          >
            <Logo size={28} />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-none">CreateFlow</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{nome} · {papel}</div>
          </div>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1">
          {items.map((it) => {
            const active = pathname.startsWith(it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <main className="flex-1">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-card md:hidden">
        {items.slice(0, 5).map((it) => {
          const active = pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
