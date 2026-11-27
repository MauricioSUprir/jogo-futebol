"use client";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { salvarPalpite } from "@/lib/acoes/jogos";
import { cn } from "@/lib/cn";

type Opcao = { id: string; nome: string; avatar: string | null };

/** Grade de pessoas para escolher o palpite. Trocar é livre até o encerramento. */
export function EscolherPalpite({ eventoId, pessoas, atual }: { eventoId: string; pessoas: Opcao[]; atual: string | null }) {
  const [escolhido, setEscolhido] = useState<string | null>(atual);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const { som, vibracao, menosMovimento } = usePreferencias();

  function escolher(id: string) {
    if (id === escolhido || salvando) return;
    const anterior = escolhido;
    setEscolhido(id);
    setSalvando(id);
    iniciar(async () => {
      const r = await salvarPalpite(eventoId, id);
      setSalvando(null);
      if (r.ok) {
        tocar("tique", som);
        vibrar(20, vibracao);
        avisar(r.mensagem ?? "Palpite guardado!");
      } else {
        setEscolhido(anterior);
        avisar(r.erro, "erro");
      }
    });
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Quem você acha que te tirou?</legend>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {pessoas.map((p, i) => {
          const marcado = escolhido === p.id;
          return (
            <motion.li
              key={p.id}
              initial={menosMovimento ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: menosMovimento ? 0 : i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => escolher(p.id)}
                aria-pressed={marcado}
                className={cn(
                  "vidro relative flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-cartao p-4 text-center transition hover:-translate-y-0.5",
                  marcado && "ring-4 ring-[color-mix(in_oklab,var(--t1)_55%,transparent)] shadow-brilho",
                )}
              >
                <Avatar nome={p.nome} caminho={p.avatar} tamanho={64} anel={marcado} />
                <span className="line-clamp-2 text-[15px] font-semibold">{p.nome}</span>
                {marcado ? (
                  <span className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full bg-t1 text-white">
                    {salvando === p.id ? (
                      <span className="size-3 animate-ping rounded-full bg-white" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                  </span>
                ) : null}
                <span className="sr-only">{marcado ? "(seu palpite)" : ""}</span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </fieldset>
  );
}
