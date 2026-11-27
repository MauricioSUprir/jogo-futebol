"use client";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";

/**
 * Recarrega a página que a pessoa tentou abrir. É um formulário GET sem `action` (volta para o próprio endereço): funciona
 * mesmo se o JavaScript da página offline não carregou; com JavaScript, recarrega exatamente o mesmo endereço.
 */
export function TentarDeNovo() {
  return (
    <form method="get">
      <Botao
        type="submit"
        tamanho="g"
        onClick={(e) => {
          e.preventDefault();
          window.location.reload();
        }}
      >
        <RefreshCw className="size-5" aria-hidden /> Tentar de novo
      </Botao>
    </form>
  );
}
