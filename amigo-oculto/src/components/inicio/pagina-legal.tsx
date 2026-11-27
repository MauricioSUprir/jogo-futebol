import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollText } from "lucide-react";

/** Moldura das páginas legais: título, data, índice e o texto. */
export function PaginaLegal({
  titulo,
  resumo,
  atualizado,
  indice,
  children,
}: {
  titulo: string;
  resumo: ReactNode;
  atualizado: string;
  indice: { id: string; titulo: string }[];
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-t1">
          <ScrollText className="size-4" aria-hidden /> Amigo Oculto
        </p>
        <h1 className="mt-2 font-titulo text-4xl font-semibold leading-tight sm:text-5xl">{titulo}</h1>
        <p className="mt-2 text-sm text-suave">Última atualização: {atualizado}</p>
        <div className="vidro mt-6 rounded-cartao p-5 text-[15px] leading-relaxed">{resumo}</div>
      </header>
      <nav aria-label="Nesta página" className="vidro mb-8 rounded-cartao p-5">
        <p className="mb-2 text-sm font-bold">Nesta página</p>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {indice.map((item, i) => (
            <li key={item.id}>
              <Link href={`#${item.id}`} className="inline-flex min-h-8 items-center text-suave underline-offset-4 hover:text-texto hover:underline">
                {i + 1}. {item.titulo}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <div className="texto-legal">{children}</div>
    </article>
  );
}

/** E-mail de contato do responsável pelo site (variável CONTATO_EMAIL), quando configurado. */
export function emailDeContato(): string | null {
  const e = (process.env.CONTATO_EMAIL ?? process.env.NEXT_PUBLIC_CONTATO_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
