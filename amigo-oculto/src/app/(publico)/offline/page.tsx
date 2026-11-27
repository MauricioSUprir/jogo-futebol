import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Cartao } from "@/components/ui/cartao";
import { MarcaPresente } from "@/components/ui/logo";
import { TentarDeNovo } from "@/components/pwa/tentar-de-novo";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };

/** Página que o service worker mostra quando não há internet (guardada sem cookies: nada pessoal aqui). */
export default function PaginaOffline() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
      <Cartao forte className="flex flex-col items-center p-8 text-center">
        <div className="relative mb-5">
          <MarcaPresente tamanho={88} className="opacity-90" />
          <span className="vidro-forte absolute -bottom-1 -right-2 inline-flex size-10 items-center justify-center rounded-full text-rubi">
            <WifiOff className="size-5" aria-hidden />
          </span>
        </div>
        <h1 className="font-titulo text-3xl font-semibold">Você está sem conexão</h1>
        <p className="mt-2 text-suave">
          Seus grupos, mensagens e o resultado do sorteio ficam guardados com segurança no servidor. Assim que a internet voltar,
          é só tentar de novo.
        </p>
        <div className="mt-6">
          <TentarDeNovo />
        </div>
      </Cartao>
    </div>
  );
}
