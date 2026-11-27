"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { Resultado } from "@/lib/acoes/resultado";

export function BotaoEnviar({ children, variante = "primario", className }: { children: ReactNode; variante?: "primario" | "ouro" | "esmeralda"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" tamanho="g" variante={variante} carregando={pending} className={className ?? "w-full"}>
      {children}
    </Botao>
  );
}

export function MensagemResultado({ estado }: { estado: Resultado<unknown> | null }) {
  if (!estado) return null;
  if (estado.ok) {
    return estado.mensagem ? (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm font-medium text-esmeralda">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {estado.mensagem}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {estado.erro}
    </p>
  );
}

export function erroDoCampo(estado: Resultado<unknown> | null, campo: string) {
  return estado && !estado.ok ? estado.campos?.[campo] : undefined;
}
