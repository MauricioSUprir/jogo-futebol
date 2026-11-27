"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function AbasGrupo({
  id,
  sorteado,
  admin,
  albumAberto,
  aoVivo,
}: {
  id: string;
  sorteado: boolean;
  admin: boolean;
  albumAberto: boolean;
  aoVivo: boolean;
}) {
  const base = `/grupo/${id}`;
  const abas = [
    { href: base, rotulo: "Visão geral", exato: true },
    sorteado ? { href: `${base}/revelacao`, rotulo: "Meu amigo oculto" } : null,
    { href: `${base}/participantes`, rotulo: "Participantes" },
    { href: `${base}/mural`, rotulo: "Mural" },
    { href: `${base}/chat`, rotulo: "Chat" },
    sorteado ? { href: `${base}/mensagens`, rotulo: "Mensagens anônimas" } : null,
    { href: `${base}/enquetes`, rotulo: "Enquetes" },
    { href: `${base}/jogos`, rotulo: "Jogos" },
    aoVivo || (admin && sorteado) ? { href: `${base}/ao-vivo/participar`, rotulo: aoVivo ? "Ao vivo agora" : "Ao vivo" } : null,
    albumAberto ? { href: `${base}/album`, rotulo: "Álbum" } : null,
    admin ? { href: `${base}/admin`, rotulo: "Organizar" } : null,
  ].filter(Boolean) as { href: string; rotulo: string; exato?: boolean }[];
  const pathname = usePathname();
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav aria-label="Seções do grupo" className="-mx-3 sm:mx-0">
      <div ref={lista} className="rolagem-fina flex gap-1.5 overflow-x-auto px-3 pb-1 sm:px-0">
        {abas.map((a) => {
          const atual = a.exato ? pathname === a.href : pathname === a.href || pathname.startsWith(`${a.href}/`);
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "vidro shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-suave transition hover:text-texto",
                atual && "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow-md hover:text-white",
                a.rotulo === "Ao vivo agora" && !atual && "text-rubi",
              )}
            >
              {a.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
