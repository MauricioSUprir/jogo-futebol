"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/cn";

const EMOJIS: [string, string][] = [
  ["😀", "sorriso"], ["😂", "rindo"], ["🥰", "apaixonado"], ["😍", "olhos de coração"], ["😉", "piscadinha"], ["🤫", "segredo"],
  ["🤔", "pensando"], ["😮", "surpreso"], ["😅", "ufa"], ["🥳", "festa"], ["😎", "estiloso"], ["🙏", "obrigado"],
  ["👏", "palmas"], ["🙌", "comemorando"], ["👍", "joinha"], ["❤️", "coração"], ["💚", "coração verde"], ["✨", "brilho"],
  ["🎁", "presente"], ["🎄", "árvore de Natal"], ["🎅", "Papai Noel"], ["⭐", "estrela"], ["❄️", "floco de neve"], ["🔔", "sino"],
  ["🎉", "confete"], ["🎈", "balão"], ["🎂", "bolo"], ["🥂", "brinde"], ["🍫", "chocolate"], ["☕", "café"],
  ["📚", "livro"], ["🎮", "videogame"], ["🎧", "fone"], ["👕", "camiseta"], ["👟", "tênis"], ["💐", "flores"],
  ["🕵️", "detetive"], ["❓", "pergunta"], ["💡", "ideia"], ["🔥", "fogo"], ["😴", "sono"], ["🤐", "boca fechada"],
];

/** Seletor de emojis simples (popover acessível: Esc fecha, foco volta ao botão). */
export function SeletorEmojis({
  aoEscolher,
  desabilitado,
  className,
  acima = true,
}: {
  aoEscolher: (emoji: string) => void;
  desabilitado?: boolean;
  className?: string;
  acima?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const fora = (e: PointerEvent) => {
      if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={botao}
        type="button"
        aria-label="Inserir emoji"
        title="Inserir emoji"
        aria-expanded={aberto}
        aria-controls={id}
        disabled={desabilitado}
        onClick={() => setAberto((a) => !a)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-suave transition hover:bg-black/5 hover:text-texto disabled:opacity-50 dark:hover:bg-white/10"
      >
        <Smile className="size-5" aria-hidden />
      </button>
      {aberto ? (
        <div
          ref={painel}
          id={id}
          role="dialog"
          aria-label="Emojis"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              fechar();
            }
          }}
          className={cn(
            "vidro-forte absolute left-0 z-50 w-[min(19rem,calc(100vw-2.5rem))] rounded-3xl p-2",
            acima ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="grid grid-cols-6 gap-0.5">
            {EMOJIS.map(([e, nome]) => (
              <button
                key={e}
                type="button"
                aria-label={nome}
                title={nome}
                onClick={() => {
                  aoEscolher(e);
                  fechar(false);
                }}
                className="inline-flex aspect-square items-center justify-center rounded-xl text-2xl transition hover:bg-black/5 focus-visible:bg-black/5 dark:hover:bg-white/10"
              >
                <span aria-hidden>{e}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Insere `texto` na posição do cursor de um campo controlado e devolve o novo valor (e reposiciona o cursor). */
export function inserirNoCursor(campo: HTMLTextAreaElement | HTMLInputElement | null, valor: string, texto: string) {
  if (!campo) return valor + texto;
  const ini = campo.selectionStart ?? valor.length;
  const fim = campo.selectionEnd ?? valor.length;
  const novo = valor.slice(0, ini) + texto + valor.slice(fim);
  requestAnimationFrame(() => {
    campo.focus();
    campo.setSelectionRange(ini + texto.length, ini + texto.length);
  });
  return novo;
}
