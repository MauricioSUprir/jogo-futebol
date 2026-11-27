"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, FlaskConical, Plus, RotateCcw, Shuffle, UserRound, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Girando } from "@/components/ui/carregando";
import { sortear } from "@/lib/sorteio/algoritmo";
import { cn } from "@/lib/cn";

/** O palco (revelação + exemplos + catálogo de ideias) só baixa quando alguém vai ver a revelação. */
const carregarPalco = () => import("@/components/inicio/demonstracao-palco");
const PalcoDemonstracao = dynamic(() => carregarPalco().then((m) => m.PalcoDemonstracao), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Girando rotulo="Preparando a revelação" className="text-texto" />
    </div>
  ),
});

const MIN = 3;
const MAX = 8;
const EXEMPLOS: Record<string, string[]> = {
  Amigos: ["Ana", "Bruno", "Carla", "Diego", "Elisa"],
  Família: ["Vó Lúcia", "Tio Beto", "Mariana", "Pedro", "Júlia", "Rafa"],
  Trabalho: ["Camila", "Renato", "Patrícia", "Lucas"],
};

const chave = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const limpar = (nome: string) => nome.replace(/\s+/g, " ").trim().slice(0, 24);

/**
 * Demonstração interativa: a pessoa digita de 3 a 8 nomes, sorteia NO NAVEGADOR com o mesmo algoritmo do servidor
 * (`sortear`), escolhe "sou fulano" e vê a revelação cinematográfica. Nada é enviado nem salvo.
 */
export function Demonstracao() {
  const [nomes, setNomes] = useState<string[]>(EXEMPLOS.Amigos);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pares, setPares] = useState<Map<string, string> | null>(null);
  const [eu, setEu] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  function mudarNomes(lista: string[]) {
    setNomes(lista);
    setPares(null);
    setEu(null);
  }

  function adicionar(e: FormEvent) {
    e.preventDefault();
    const nome = limpar(novo);
    if (!nome) return setErro("Digite um nome.");
    if (nomes.length >= MAX) return setErro(`A demonstração aceita até ${MAX} nomes.`);
    if (nomes.some((n) => chave(n) === chave(nome))) return setErro(`“${nome}” já está na lista. Use um sobrenome ou apelido.`);
    mudarNomes([...nomes, nome]);
    setNovo("");
    setErro(null);
    campo.current?.focus();
  }

  function sortearAgora() {
    if (nomes.length < MIN) return setErro(`Coloque pelo menos ${MIN} nomes para sortear.`);
    void carregarPalco(); // já começa a baixar o palco
    const { pares: resultado } = sortear(nomes, []);
    setPares(new Map(resultado.map((p) => [p.giver, p.receiver])));
    setRodada((r) => r + 1);
    setEu(null);
    setErro(null);
  }

  // abre/fecha o diálogo de tela cheia (o <dialog> nativo prende o foco e deixa o resto da página inerte)
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (eu && !d.open) d.showModal();
    if (!eu && d.open) d.close();
    document.documentElement.style.overflow = eu ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [eu]);

  const sorteado = eu && pares ? pares.get(eu) ?? null : null;

  return (
    <div className="vidro-forte relative rounded-[2rem] p-5 sm:p-8">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-ouro/15 px-3.5 py-1.5 text-sm font-bold text-ouro-escuro dark:text-ouro-claro">
        <FlaskConical className="size-4" aria-hidden /> Demonstração: nada é salvo nem enviado
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        {/* passo 1 */}
        <div>
          <h3 className="flex items-center gap-2 font-titulo text-xl font-semibold">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-t1 text-sm font-bold text-white">1</span>
            Quem participa?
          </h3>
          <ul aria-label="Participantes da demonstração" className="mt-4 flex min-h-12 flex-wrap gap-2">
            {nomes.map((n) => (
              <li key={n} className="inline-flex items-center gap-1 rounded-full bg-white/80 py-1 pl-3.5 pr-1 text-[15px] font-semibold ring-1 ring-borda dark:bg-white/10">
                {n}
                <button
                  type="button"
                  onClick={() => mudarNomes(nomes.filter((x) => x !== n))}
                  aria-label={`Remover ${n}`}
                  className="inline-flex size-8 items-center justify-center rounded-full text-suave hover:bg-black/5 hover:text-rubi dark:hover:bg-white/10"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={adicionar} className="mt-4 flex gap-2" noValidate>
            <label htmlFor={`${id}-nome`} className="sr-only">
              Nome de quem participa
            </label>
            <input
              ref={campo}
              id={`${id}-nome`}
              value={novo}
              onChange={(e) => {
                setNovo(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder={nomes.length >= MAX ? "Lista cheia" : "Digite um nome"}
              maxLength={24}
              autoComplete="off"
              disabled={nomes.length >= MAX}
              aria-describedby={`${id}-info`}
              className="h-12 min-w-0 flex-1 rounded-full border border-borda bg-white/75 px-5 text-[15px] text-texto placeholder:text-suave/80 focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 disabled:opacity-60 dark:bg-white/5"
            />
            <Botao type="submit" variante="contorno" className="h-12 shrink-0" disabled={nomes.length >= MAX}>
              <Plus className="size-4" aria-hidden /> Adicionar
            </Botao>
          </form>
          <p id={`${id}-info`} className="mt-2 text-xs text-suave">
            {nomes.length} de {MAX} nomes (mínimo {MIN}).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-suave">Exemplos prontos:</span>
            {Object.entries(EXEMPLOS).map(([rotulo, lista]) => (
              <button
                key={rotulo}
                type="button"
                onClick={() => {
                  mudarNomes(lista);
                  setErro(null);
                }}
                className="min-h-10 rounded-full px-3.5 text-sm font-semibold text-t1 ring-1 ring-[color-mix(in_oklab,var(--t1)_35%,transparent)] transition hover:bg-[color-mix(in_oklab,var(--t1)_10%,transparent)]"
              >
                {rotulo}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                mudarNomes([]);
                campo.current?.focus();
              }}
              className="min-h-10 rounded-full px-3.5 text-sm font-semibold text-suave hover:text-texto"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* passos 2 e 3 */}
        <div className="flex flex-col">
          <h3 className="flex items-center gap-2 font-titulo text-xl font-semibold">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-esmeralda text-sm font-bold text-white">2</span>
            Sorteie
          </h3>
          <p className="mt-2 text-sm text-suave">O mesmo algoritmo do app, rodando aqui no seu aparelho: ninguém tira a si mesmo e cada um tira uma pessoa só.</p>
          <Botao variante="ouro" tamanho="g" className="mt-4 w-full sm:w-auto sm:self-start" onClick={sortearAgora} brilho={!pares}>
            {pares ? <RotateCcw className="size-5" aria-hidden /> : <Shuffle className="size-5" aria-hidden />}
            {pares ? "Sortear de novo" : "Sortear agora"}
          </Botao>
          <div aria-live="polite" className="mt-3 min-h-6 text-sm">
            {erro ? (
              <p role="alert" className="font-semibold text-rubi">
                {erro}
              </p>
            ) : pares ? (
              <p className="flex items-center gap-1.5 font-semibold text-esmeralda">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Sorteio {rodada > 1 ? "refeito" : "feito"}! Agora diga quem é você.
              </p>
            ) : null}
          </div>

          {!pares ? (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-borda px-5 py-8 text-center">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ouro/25 text-sm font-bold text-ouro-escuro dark:text-ouro-claro">3</span>
              <p className="font-semibold">Depois do sorteio, você escolhe quem é</p>
              <p className="max-w-xs text-sm text-suave">E abre o presente para ver quem tirou, com lista de desejos e ideias de presente.</p>
            </div>
          ) : null}
          {pares ? (
            <div className="mt-4">
              <h3 className="flex items-center gap-2 font-titulo text-xl font-semibold">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-ouro text-sm font-bold text-[#3b2a06]">3</span>
                Quem é você?
              </h3>
              <p className="mt-2 text-sm text-suave">Cada pessoa só vê quem ela tirou. Escolha um nome para abrir o presente dele.</p>
              <ul className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                {nomes.map((n) => (
                  <li key={n}>
                    <button
                      type="button"
                      onPointerEnter={() => void carregarPalco()}
                      onFocus={() => void carregarPalco()}
                      onClick={() => setEu(n)}
                      className={cn(
                        "vidro flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left text-[15px] font-semibold transition hover:-translate-y-0.5 hover:shadow-brilho",
                      )}
                    >
                      <UserRound className="size-4 shrink-0 text-t1" aria-hidden />
                      <span className="min-w-0 truncate">Sou {n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogo}
        aria-label={eu ? `Revelação de demonstração para ${eu}` : "Revelação de demonstração"}
        onClose={() => setEu(null)}
        onClick={(e) => {
          if (e.target === dialogo.current) setEu(null);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-fundo p-0 text-texto backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:m-auto sm:h-[min(94dvh,64rem)] sm:w-[min(94vw,62rem)] sm:rounded-[2rem] sm:shadow-2xl"
      >
        {eu && sorteado ? (
          <div className="fundo-festivo min-h-full">
            <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--fundo)_82%,transparent)] px-4 py-3 backdrop-blur-md sm:px-6">
              <p className="min-w-0 truncate font-semibold">
                Você é <span className="text-t1">{eu}</span>
              </p>
              <button
                type="button"
                onClick={() => setEu(null)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-borda hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="size-4" aria-hidden /> Fechar
              </button>
            </div>
            <div className="px-3 pb-10 pt-2 sm:px-6">
              <PalcoDemonstracao key={`${eu}-${rodada}`} sorteado={sorteado} indice={nomes.indexOf(sorteado)} aoTrocar={() => setEu(null)} />
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
