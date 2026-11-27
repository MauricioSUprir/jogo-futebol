"use client";
import { Relativo } from "@/components/jogos/relativo";
import { useState } from "react";
import { CartaoVirtual } from "@/components/jogos/cartao-virtual";
import { Dialogo } from "@/components/ui/dialogo";

type Cartao = { id: string; modelo: string; titulo: string | null; texto: string; de: string; quando: string };

/** Os cartões que eu recebi, guardados no álbum (só eu vejo os meus). */
export function CartoesDoAlbum({ cartoes, para }: { cartoes: Cartao[]; para: string }) {
  const [aberto, setAberto] = useState<Cartao | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cartoes.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setAberto(c)}
              className="flex w-full flex-col gap-1.5 rounded-[1.4rem] text-left transition hover:-translate-y-1"
              aria-label={`Abrir cartão de ${c.de}${c.titulo ? `: ${c.titulo}` : ""}`}
            >
              <CartaoVirtual compacto modelo={c.modelo} titulo={c.titulo} texto={c.texto} de={c.de} />
              <Relativo iso={c.quando} className="px-1 text-xs text-suave" />
            </button>
          </li>
        ))}
      </ul>
      <Dialogo aberto={!!aberto} aoFechar={() => setAberto(null)} titulo={aberto ? `Cartão de ${aberto.de}` : ""} largura="max-w-md">
        {aberto ? <CartaoVirtual modelo={aberto.modelo} titulo={aberto.titulo} texto={aberto.texto} de={aberto.de} para={para} /> : null}
      </Dialogo>
    </>
  );
}
