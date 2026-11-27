"use client";
import { useCallback, useTransition } from "react";
import { useAvisos } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/acoes/resultado";

/**
 * Executa uma Server Action com estado de carregamento e aviso (toast) do resultado. A página se atualiza sozinha
 * (as ações chamam revalidatePath).
 */
export function useAcao() {
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const executar = useCallback(
    <T,>(fn: () => Promise<Resultado<T>>, opcoes: { sucesso?: string; depois?: (r: Resultado<T>) => void; erro?: (r: Resultado<T>) => void } = {}) => {
      iniciar(async () => {
        try {
          const r = await fn();
          if (r.ok) {
            avisar(r.mensagem ?? opcoes.sucesso ?? "Pronto!");
            opcoes.depois?.(r);
          } else {
            avisar(r.erro, "erro");
            opcoes.erro?.(r);
          }
        } catch (e) {
          // redirect() de uma ação também chega aqui como exceção especial: deixa passar
          if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
          avisar("Não foi possível concluir agora. Confira a conexão e tente de novo.", "erro");
        }
      });
    },
    [avisar],
  );
  return { pendente, executar };
}
