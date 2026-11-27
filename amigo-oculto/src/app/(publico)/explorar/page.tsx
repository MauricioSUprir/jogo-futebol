import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { buscarGruposPublicos } from "@/lib/acoes/eventos";
import { ListaPublicos } from "@/components/convite/lista-publicos";
import { OutroCodigo } from "@/components/convite/outro-codigo";
import { Cartao } from "@/components/ui/cartao";

export const metadata: Metadata = {
  title: "Grupos públicos",
  description: "Encontre amigos ocultos públicos abertos e peça para participar.",
};

export default async function PaginaExplorar({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const busca = (Array.isArray(q) ? q[0] : q ?? "").trim().slice(0, 80);
  const r = await buscarGruposPublicos(busca, 0);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t1">Explorar</p>
        <h1 className="font-titulo text-3xl font-semibold leading-tight sm:text-4xl">Grupos públicos</h1>
        <p className="max-w-2xl text-suave">
          Amigos ocultos abertos para quem quiser participar. Escolha um, veja os detalhes e peça para entrar: o organizador decide
          quem fica.
        </p>
      </header>
      {r.ok ? (
        <ListaPublicos busca={busca} iniciais={r.dados?.itens ?? []} temMaisInicial={!!r.dados?.temMais} />
      ) : (
        <p role="alert" className="rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi">
          {r.erro}
        </p>
      )}
      <Cartao className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-start gap-3 sm:w-72 sm:shrink-0">
          <KeyRound className="mt-0.5 size-6 shrink-0 text-t1" aria-hidden />
          <div>
            <h2 className="font-semibold">Tem um código de convite?</h2>
            <p className="text-sm text-suave">Grupos privados só aparecem para quem tem o código.</p>
          </div>
        </div>
        <div className="flex-1">
          <OutroCodigo />
        </div>
      </Cartao>
    </div>
  );
}
