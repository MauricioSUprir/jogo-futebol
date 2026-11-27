"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Search, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/cartao";
import { Girando } from "@/components/ui/carregando";
import { CartaoPublico } from "@/components/convite/cartao-publico";
import { buscarGruposPublicos, type GrupoPublico } from "@/lib/acoes/eventos";

/** Lista de grupos públicos: busca por nome (na URL, ?q=) e "Carregar mais". */
export function ListaPublicos({ busca, iniciais, temMaisInicial }: { busca: string; iniciais: GrupoPublico[]; temMaisInicial: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [texto, setTexto] = useState(busca);
  const [itens, setItens] = useState(iniciais);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();
  const [buscando, iniciarBusca] = useTransition();
  const primeira = useRef(true);

  // a página (servidor) manda a primeira leva de novo quando a busca muda
  useEffect(() => {
    setItens(iniciais);
    setTemMais(temMaisInicial);
    setErro(null);
  }, [iniciais, temMaisInicial]);

  // busca enquanto digita (com uma pausa), mantendo o endereço compartilhável
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = texto.trim();
      if (q === busca) return;
      iniciarBusca(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca, pathname, router]);

  function carregarMais() {
    setErro(null);
    iniciar(async () => {
      const r = await buscarGruposPublicos(busca, itens.length);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      const novos = r.dados?.itens ?? [];
      setItens((atual) => {
        const vistos = new Set(atual.map((x) => x.id));
        return [...atual, ...novos.filter((x) => !vistos.has(x.id))];
      });
      setTemMais(!!r.dados?.temMais);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = texto.trim();
          iniciarBusca(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }));
        }}
        className="relative"
      >
        <label htmlFor="busca-publicos" className="sr-only">
          Buscar grupos públicos pelo nome
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-suave" aria-hidden />
        <input
          id="busca-publicos"
          type="search"
          name="q"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 80))}
          placeholder="Buscar pelo nome do grupo"
          autoComplete="off"
          className="vidro h-14 w-full rounded-full pl-12 pr-24 text-[15px] text-texto placeholder:text-suave/80 focus:outline-none focus:ring-4 focus:ring-ouro/30 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {buscando ? <Girando rotulo="Buscando" /> : null}
          {texto ? (
            <button
              type="button"
              onClick={() => setTexto("")}
              aria-label="Limpar a busca"
              className="inline-flex size-10 items-center justify-center rounded-full text-suave hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </span>
      </form>

      <p className="sr-only" aria-live="polite">
        {busca ? `${itens.length}${temMais ? " ou mais" : ""} grupos encontrados para ${busca}.` : ""}
      </p>

      {itens.length === 0 ? (
        <Vazio
          icone={<Compass className="size-10" />}
          titulo={busca ? "Nenhum grupo com esse nome" : "Ainda não há grupos públicos abertos"}
          texto={
            busca
              ? "Tente outra palavra, ou peça o código do convite a quem organiza."
              : "Os grupos públicos aparecem aqui enquanto aceitam participantes. Você também pode criar o seu."
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={buscando || undefined}>
          {itens.map((g) => (
            <li key={g.id} className="flex">
              <CartaoPublico g={g} />
            </li>
          ))}
        </ul>
      )}

      {erro ? (
        <p role="alert" className="text-center text-sm font-medium text-rubi">
          {erro}
        </p>
      ) : null}
      {temMais ? (
        <div className="flex justify-center">
          <Botao variante="vidro" tamanho="g" onClick={carregarMais} carregando={carregando}>
            Carregar mais
          </Botao>
        </div>
      ) : null}
    </div>
  );
}
