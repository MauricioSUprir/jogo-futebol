"use client";
// Menu lateral retrátil (computador/tablet) e barra inferior com 5 atalhos (celular).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Gauge, HeartPulse, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { NAV_CONFIG, NAV_PRINCIPAL, ativo } from "./navegacao";
import { Logo } from "../logo";
import { cn } from "@/lib/cn";
import { sair } from "@/acoes/conta";

export const EVENTO_REGISTRAR = "lifeos:registrar";
export function abrirRegistro() {
  window.dispatchEvent(new Event(EVENTO_REGISTRAR));
}

export function BarraLateral({ nome }: { nome: string }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem("lifeos.menu") === "recolhido");
    } catch {}
  }, []);
  const alternar = () => {
    setRecolhida((v) => {
      try {
        localStorage.setItem("lifeos.menu", v ? "aberto" : "recolhido");
      } catch {}
      return !v;
    });
  };
  const itens = [...NAV_PRINCIPAL, NAV_CONFIG];
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-borda bg-fundo-2/70 backdrop-blur-xl transition-[width] duration-300 lg:flex",
        recolhida ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center", recolhida ? "justify-center" : "justify-between px-4")}>
        <Link href="/" aria-label="LIFE OS — início">
          <Logo soMarca={recolhida} />
        </Link>
        {!recolhida && (
          <button onClick={alternar} className="rounded-lg p-2 text-suave hover:bg-white/5 hover:text-texto" aria-label="Recolher menu">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      {recolhida && (
        <button onClick={alternar} className="mx-auto mb-2 rounded-lg p-2 text-suave hover:bg-white/5 hover:text-texto" aria-label="Abrir menu">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
      <div className="px-3">
        <button
          onClick={abrirRegistro}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl bg-gradient-to-r from-eletrico to-violeta font-medium text-white shadow-[0_8px_24px_-12px_rgb(37_99_235/0.9)] hover:brightness-110",
            recolhida ? "justify-center" : "px-4",
          )}
          aria-label="Registrar"
        >
          <Plus className="h-5 w-5" />
          {!recolhida && <span>Registrar</span>}
        </button>
      </div>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Módulos">
        {itens.map((i) => {
          const sel = ativo(pathname, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              title={recolhida ? i.nome : undefined}
              aria-current={sel ? "page" : undefined}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-xl text-sm transition",
                recolhida ? "justify-center" : "px-3",
                sel ? "bg-eletrico/15 text-texto shadow-[inset_0_0_0_1px_rgb(37_99_235/0.35)]" : "text-suave hover:bg-white/5 hover:text-texto",
              )}
            >
              <i.icone className={cn("h-[18px] w-[18px] shrink-0", sel && "text-eletrico-claro")} aria-hidden />
              {!recolhida && <span className="truncate">{i.nome}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={cn("border-t border-borda p-3", recolhida && "flex justify-center")}>
        <form action={sair} className={cn("flex items-center gap-2", !recolhida && "justify-between")}>
          {!recolhida && (
            <div className="min-w-0 px-1">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="text-xs text-apagado">Acesso privado</p>
            </div>
          )}
          <button className="rounded-lg p-2 text-suave hover:bg-white/5 hover:text-texto" aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

const INFERIOR = [
  { href: "/", nome: "Início", icone: Gauge },
  { href: "/saude", nome: "Saúde", icone: HeartPulse },
  null,
  { href: "/agenda", nome: "Agenda", icone: CalendarDays },
  { href: "/mais", nome: "Mais", icone: LayoutGrid },
];

function ativoInferior(pathname: string, href: string) {
  if (href === "/saude") return ["/saude", "/agua"].some((p) => ativo(pathname, p));
  if (href === "/mais") return ["/mais", "/habitos", "/configuracoes"].some((p) => ativo(pathname, p));
  return ativo(pathname, href);
}

export function BarraInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-fundo/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {INFERIOR.map((i, k) =>
          i === null ? (
            <li key="registrar" className="flex justify-center">
              <button
                onClick={abrirRegistro}
                aria-label="Registrar"
                className="-mt-6 grid grid-cols-1 h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-eletrico via-[#4f46e5] to-violeta text-white shadow-[0_10px_30px_-8px_rgb(37_99_235/0.9)] ring-4 ring-fundo active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            </li>
          ) : (
            <li key={k}>
              <Link
                href={i.href}
                aria-current={ativoInferior(pathname, i.href) ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-1 text-[0.68rem] text-apagado aria-[current=page]:text-eletrico-claro"
              >
                <i.icone className="h-5 w-5" aria-hidden />
                {i.nome}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
