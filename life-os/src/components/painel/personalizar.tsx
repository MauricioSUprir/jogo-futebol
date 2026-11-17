"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { salvarPainel } from "@/acoes/conta";
import { BotaoEnvio, useFecharDialogo } from "../cliente";
import { NOMES_CARTOES, type CartaoPainel } from "@/lib/catalogo";

/** Escolher quais cartões aparecem na Central de Comando e em que ordem. */
export function PersonalizarPainel({ ordem, ocultos }: { ordem: CartaoPainel[]; ocultos: CartaoPainel[] }) {
  const [lista, setLista] = useState(ordem);
  const fechar = useFecharDialogo();
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setLista(nova);
  };
  return (
    <form
      action={async (fd) => {
        await salvarPainel(fd);
        fechar();
      }}
      className="grid grid-cols-1 gap-3"
    >
      <input type="hidden" name="ordem" value={lista.join(",")} />
      <ul className="grid grid-cols-1 gap-1.5">
        {lista.map((c, i) => (
          <li key={c} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 px-3 py-2">
            <label className="flex flex-1 items-center gap-3 text-sm">
              <input type="checkbox" name={"ver_" + c} defaultChecked={!ocultos.includes(c)} className="h-4 w-4 accent-[#2563eb]" />
              {NOMES_CARTOES[c]}
            </label>
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-suave hover:bg-white/5 disabled:opacity-30" aria-label={`Subir ${NOMES_CARTOES[c]}`}>
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} className="rounded-lg p-1.5 text-suave hover:bg-white/5 disabled:opacity-30" aria-label={`Descer ${NOMES_CARTOES[c]}`}>
              <ArrowDown className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <BotaoEnvio pendente="Salvando…">Salvar painel</BotaoEnvio>
    </form>
  );
}
