"use client";
import { useState, useTransition, type FormEvent } from "react";
import type { Resultado } from "@/lib/acoes/resultado";

/**
 * Envia um formulário para uma Server Action `(estado, FormData)` sem o reset automático do React 19 (que apagava o
 * que a pessoa digitou quando dava erro). Devolve o último resultado, o "enviando" e o onSubmit.
 */
export function useAcaoFormulario<T>(
  acao: (estado: unknown, form: FormData) => Promise<Resultado<T>>,
  depois?: (r: Resultado<T>, form: HTMLFormElement) => void,
) {
  const [estado, setEstado] = useState<Resultado<T> | null>(null);
  const [enviando, iniciar] = useTransition();
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    iniciar(async () => {
      const r = await acao(estado, dados);
      setEstado(r);
      depois?.(r, form);
    });
  }
  return { estado, enviando, aoEnviar, limpar: () => setEstado(null) };
}
