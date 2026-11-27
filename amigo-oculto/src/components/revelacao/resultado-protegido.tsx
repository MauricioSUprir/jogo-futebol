"use client";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Lock, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { EstrelasPalco } from "@/components/revelacao/efeitos-palco";
import type { PessoaRevelada } from "@/components/revelacao/revelacao-cinematografica";

/**
 * Resultado já visto, com proteção de olhares: fica escondido até a pessoa tocar em "Mostrar" e volta a se esconder
 * quando ela toca em "Esconder" ou sai da aba. O nome só entra na página quando está visível.
 */
export function ResultadoProtegido({
  pessoa,
  rotulo = "Você tirou",
  aoVerAnimacao,
  children,
  mostrarInicial = false,
}: {
  pessoa: PessoaRevelada;
  rotulo?: string;
  aoVerAnimacao: () => void;
  /** detalhes (lista de desejos, preferências, sugestões) — também escondidos */
  children?: ReactNode;
  mostrarInicial?: boolean;
}) {
  const [visivel, setVisivel] = useState(mostrarInicial);
  const { menosMovimento } = usePreferencias();

  // saiu da aba (ou bloqueou o celular): esconde de novo
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === "hidden") setVisivel(false);
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  const transicao = { duration: menosMovimento ? 0.15 : 0.35 };

  return (
    <section aria-label="Seu amigo oculto" className="flex flex-col gap-5">
      <div className="palco-revelacao relative isolate overflow-hidden rounded-[2rem] px-5 py-8 shadow-vidro ring-1 ring-black/10 sm:px-8 sm:py-10">
        <EstrelasPalco />
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/15">
            <Lock className="size-3.5" aria-hidden /> Só você vê isto
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {visivel ? (
              <motion.div
                key="visivel"
                className="mt-5 flex flex-col items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={transicao}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f7d983]">{rotulo}</p>
                <div
                  className="mt-4 rounded-full p-[4px] shadow-[0_0_50px_-8px_rgb(242_207_107/0.8)]"
                  style={{ background: "conic-gradient(from 210deg, #f7d983, #b8861f, #fff3c9, #c9962b, #f7d983)" }}
                >
                  <div className="rounded-full bg-[#1d0a12] p-1">
                    <Avatar nome={pessoa.nome} caminho={pessoa.avatar} tamanho={104} />
                  </div>
                </div>
                <h2 className="ouro-palco mt-4 max-w-full font-titulo text-4xl font-semibold leading-tight break-words [text-wrap:balance] sm:text-5xl">
                  {pessoa.nome}
                </h2>
                {pessoa.apelido ? <p className="mt-1 text-sm text-white/80">Apelido: “{pessoa.apelido}”</p> : null}
                {pessoa.bio ? <p className="mt-2 max-w-md text-sm text-white/75">“{pessoa.bio}”</p> : null}
              </motion.div>
            ) : (
              <motion.div
                key="escondido"
                className="mt-5 flex flex-col items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transicao}
              >
                <div
                  aria-hidden
                  className="flex size-[112px] items-center justify-center rounded-full border-2 border-dashed border-[#f2cf6b]/50 bg-white/8"
                >
                  <span className="font-titulo text-5xl text-[#f7d983]/80">?</span>
                </div>
                <p className="mt-4 font-titulo text-2xl font-semibold text-white sm:text-3xl">Seu resultado está guardado</p>
                <p className="mt-1 max-w-sm text-sm text-white/75">Escondido para ninguém ver por cima do seu ombro.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setVisivel((v) => !v)}
              aria-expanded={visivel}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f7dc8e,#e2b04a_55%,#c48c22)] px-6 font-bold text-[#3b2a06] shadow-brilho transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2cf6b]/70"
            >
              {visivel ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              {visivel ? "Esconder" : "Toque para mostrar"}
            </button>
            <button
              type="button"
              onClick={aoVerAnimacao}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2cf6b]/70"
            >
              <RotateCcw className="size-4" aria-hidden />
              Ver a animação de novo
            </button>
          </div>
        </div>
      </div>
      {visivel && children ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={transicao}>
          {children}
        </motion.div>
      ) : null}
    </section>
  );
}
