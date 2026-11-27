"use client";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";

export function TentarDeNovo() {
  return (
    <Botao tamanho="g" onClick={() => window.location.reload()}>
      <RefreshCw className="size-5" aria-hidden /> Tentar de novo
    </Botao>
  );
}
