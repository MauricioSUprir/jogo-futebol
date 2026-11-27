"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { History, LogOut, Settings, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { sair } from "@/lib/acoes/contas";

export function MenuConta({ nome, avatar, convidado }: { nome: string; avatar: string | null; convidado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Menu da conta de ${nome}`}
        onClick={() => setAberto((a) => !a)}
        className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Avatar nome={nome} caminho={avatar} tamanho={36} />
      </button>
      {aberto ? (
        <div role="menu" className="vidro-forte absolute right-0 top-12 z-50 w-60 rounded-3xl p-2">
          <p className="truncate px-3 py-2 text-sm font-semibold">
            {nome}
            {convidado ? <span className="block text-xs font-normal text-suave">Convidado</span> : null}
          </p>
          <Link role="menuitem" href="/conta" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
            <UserRound className="size-4" aria-hidden /> Minha conta
          </Link>
          <Link role="menuitem" href="/conta/configuracoes" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
            <Settings className="size-4" aria-hidden /> Configurações
          </Link>
          <Link role="menuitem" href="/painel/historico" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
            <History className="size-4" aria-hidden /> Histórico
          </Link>
          <form action={sair}>
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-rubi hover:bg-rubi/10">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
