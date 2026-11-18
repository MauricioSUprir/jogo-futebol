"use client";
// Revisão dos flashcards do dia: frente → mostrar o verso → "Acertei" (sobe de caixa) ou "Errei" (volta à 1).
import { useEffect, useState, useTransition } from "react";
import { Check, Eye, RotateCcw, X } from "lucide-react";
import { responderFlashcard } from "@/acoes/estudos";
import { classesBotao, Mensagem } from "../ui";

export interface CartaoRevisao {
  id: string;
  frente: string;
  verso: string;
  caixa: number;
  materia: string | null;
}

/**
 * Fica montada durante toda a revisão: a fila é a do começo (a página atualiza a cada resposta e a lista do servidor
 * encolhe, mas o resumo do fim não pode sumir).
 */
export function RevisaoCartoes({ cartoes, vazio }: { cartoes: CartaoRevisao[]; vazio: string }) {
  const [fila, setFila] = useState(cartoes);
  const [i, setI] = useState(0);
  const [verso, setVerso] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  // Sem revisão em andamento (vazia ou terminada), um cartão novo para hoje começa outra rodada.
  useEffect(() => {
    if (i < fila.length) return;
    const vistos = new Set(fila.map((c) => c.id));
    if (cartoes.some((c) => !vistos.has(c.id))) {
      setFila(cartoes);
      setI(0);
      setAcertos(0);
    }
  }, [cartoes, fila, i]);
  const atual = fila[i];

  if (!fila.length) return <p className="py-3 text-sm text-suave">{vazio}</p>;
  if (!atual) {
    return (
      <div className="grid grid-cols-1 place-items-center gap-2 py-6 text-center">
        <p className="font-display text-lg font-semibold">Revisão do dia concluída</p>
        <p className="text-sm text-suave">
          {acertos} de {fila.length} certos. Os cartões voltam no dia certo de cada caixa.
        </p>
      </div>
    );
  }
  const responder = (acertou: boolean) =>
    iniciar(async () => {
      const r = await responderFlashcard(atual.id, acertou);
      if (r?.erro) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      if (acertou) setAcertos((a) => a + 1);
      setVerso(false);
      setI((n) => n + 1);
    });

  return (
    <div className="grid grid-cols-1 gap-3" data-testid="revisao-cartoes">
      <p className="text-xs text-suave">
        Cartão {i + 1} de {fila.length} · caixa {atual.caixa}
        {atual.materia ? ` · ${atual.materia}` : ""}
      </p>
      <div className="min-h-32 rounded-2xl border border-borda-forte bg-fundo-2/70 p-4">
        <p className="whitespace-pre-wrap break-words text-base font-medium">{atual.frente}</p>
        {verso && <p className="mt-3 whitespace-pre-wrap break-words border-t border-borda pt-3 text-sm text-eletrico-claro">{atual.verso}</p>}
      </div>
      {!verso ? (
        <button type="button" onClick={() => setVerso(true)} className={classesBotao("secundario", "g")}>
          <Eye className="h-4 w-4" /> Mostrar a resposta
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pendente} onClick={() => responder(false)} className={classesBotao("perigo", "g")}>
            <X className="h-4 w-4" /> Errei
          </button>
          <button type="button" disabled={pendente} onClick={() => responder(true)} className={classesBotao("primario", "g")}>
            <Check className="h-4 w-4" /> Acertei
          </button>
        </div>
      )}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {verso && (
        <button type="button" onClick={() => setVerso(false)} className={classesBotao("fantasma", "p", "justify-self-start")}>
          <RotateCcw className="h-3.5 w-3.5" /> Esconder
        </button>
      )}
    </div>
  );
}
