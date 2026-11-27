import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { ListaNotificacoes, type Notificacao } from "@/components/notificacoes/lista-notificacoes";
import { classesBotao } from "@/components/ui/botao";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notificações" };

const POR_PAGINA = 20;

export default async function PaginaNotificacoes({ searchParams }: { searchParams: Promise<{ pagina?: string; filtro?: string }> }) {
  const usuario = await exigirUsuario("/notificacoes");
  const { pagina: p, filtro } = await searchParams;
  const soNaoLidas = filtro === "nao-lidas";
  const pagina = Math.max(1, Math.min(500, Number.parseInt(p ?? "1", 10) || 1));
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at, read_at", { count: "exact" })
    .eq("user_id", usuario.id)
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (soNaoLidas) consulta = consulta.is("read_at", null);

  const [{ data, count }, { count: naoLidas }, { count: lidas }] = await Promise.all([
    consulta,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", usuario.id).is("read_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", usuario.id).not("read_at", "is", null),
  ]);
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const url = (n: number) => `/notificacoes?${new URLSearchParams({ ...(soNaoLidas ? { filtro: "nao-lidas" } : {}), ...(n > 1 ? { pagina: String(n) } : {}) })}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-titulo text-3xl font-semibold sm:text-4xl">
            <Bell className="size-8 text-t1" aria-hidden /> Notificações
          </h1>
          <p className="mt-1 text-suave">
            {naoLidas ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo lido"} · as novas aparecem aqui na hora.
          </p>
        </div>
        <Link
          href="/conta/configuracoes"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-t1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Settings className="size-4" aria-hidden /> E-mail e push
        </Link>
      </header>

      <nav aria-label="Filtro" className="vidro inline-flex self-start rounded-full p-1">
        {[
          { rotulo: "Todas", href: "/notificacoes", ativo: !soNaoLidas },
          { rotulo: `Não lidas${naoLidas ? ` (${naoLidas})` : ""}`, href: "/notificacoes?filtro=nao-lidas", ativo: soNaoLidas },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.ativo ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition",
              f.ativo ? "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white" : "text-suave hover:text-texto",
            )}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      <ListaNotificacoes
        key={`${pagina}-${soNaoLidas}`}
        iniciais={(data ?? []) as Notificacao[]}
        usuarioId={usuario.id}
        aoVivo={pagina === 1}
        soNaoLidas={soNaoLidas}
        temLidas={(lidas ?? 0) > 0}
      />

      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          {pagina > 1 ? (
            <Link href={url(pagina - 1)} className={classesBotao("vidro", "p")}>
              <ChevronLeft className="size-4" aria-hidden /> Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-suave">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={url(pagina + 1)} className={classesBotao("vidro", "p")}>
              Anteriores <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
