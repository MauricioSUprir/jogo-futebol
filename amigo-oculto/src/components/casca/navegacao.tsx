"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Gift, Home, MessageCircleHeart, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/painel", rotulo: "Início", icone: Home },
  { href: "/explorar", rotulo: "Explorar", icone: Compass },
  { href: "/lista-de-desejos", rotulo: "Meus desejos", icone: Gift },
  { href: "/mensagens", rotulo: "Mensagens", icone: MessageCircleHeart },
];

function ativo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MenuSuperior() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="mr-auto hidden items-center gap-1 md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={ativo(pathname, l.href) ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-2 text-sm font-semibold text-suave transition hover:text-texto",
            ativo(pathname, l.href) && "bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1",
          )}
        >
          {l.rotulo}
        </Link>
      ))}
      <Link
        href="/criar"
        className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
      >
        <Plus className="size-4" aria-hidden /> Criar amigo oculto
      </Link>
    </nav>
  );
}

export function BarraInferior({ convidado }: { convidado: boolean }) {
  const pathname = usePathname();
  const itens = [
    { href: "/painel", rotulo: "Início", icone: Home },
    { href: "/explorar", rotulo: "Explorar", icone: Compass },
    { href: convidado ? "/conta#salvar" : "/criar", rotulo: "Criar", icone: Plus, destaque: true },
    { href: "/lista-de-desejos", rotulo: "Desejos", icone: Gift },
    { href: "/conta", rotulo: "Conta", icone: UserRound },
  ];
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="vidro-forte mx-auto flex h-16 max-w-md items-center justify-around rounded-full px-2">
        {itens.map((i) => {
          const Icone = i.icone;
          const atual = ativo(pathname, i.href.split("#")[0]);
          return i.destaque ? (
            <Link
              key={i.rotulo}
              href={i.href}
              aria-label="Criar amigo oculto"
              className="-mt-7 inline-flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_65%,black))] text-white shadow-[0_10px_24px_-8px_var(--t1)] ring-4 ring-[var(--fundo)]"
            >
              <Icone className="size-6" aria-hidden />
            </Link>
          ) : (
            <Link
              key={i.rotulo}
              href={i.href}
              aria-current={atual ? "page" : undefined}
              className={cn("flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[11px] font-semibold text-suave", atual && "text-t1")}
            >
              <Icone className="size-5" aria-hidden />
              {i.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
