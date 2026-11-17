"use client";
import { classesBotao } from "@/components/ui";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid grid-cols-1 min-h-[60dvh] place-items-center px-4">
      <div className="painel grid grid-cols-1 max-w-sm gap-3 p-6 text-center">
        <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-suave">O erro foi registrado no servidor. Tente de novo.</p>
        <button onClick={reset} className={classesBotao("primario", "m", "justify-self-center")}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
