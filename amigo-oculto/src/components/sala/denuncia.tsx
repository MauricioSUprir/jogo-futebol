"use client";
import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto } from "@/components/ui/campos";
import { Botao } from "@/components/ui/botao";
import { useAvisos } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/acoes/resultado";

/**
 * Confirmação de denúncia com motivo opcional. `trecho` mostra o que está sendo denunciado; `explicacao` diz o que
 * acontece depois (quem vê, o que some).
 */
export function DialogoDenuncia({
  aberto,
  aoFechar,
  trecho,
  explicacao,
  aoConfirmar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  trecho?: string | null;
  explicacao: string;
  aoConfirmar: (motivo: string) => Promise<Resultado<unknown>>;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const { avisar } = useAvisos();
  function fechar() {
    setMotivo("");
    setErro(null);
    aoFechar();
  }
  return (
    <Dialogo aberto={aberto} aoFechar={fechar} titulo="Denunciar conteúdo" descricao={explicacao}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await aoConfirmar(motivo.trim());
            if (r.ok) {
              avisar(r.mensagem ?? "Denúncia enviada. Obrigado por avisar.");
              fechar();
            } else setErro(r.erro);
          });
        }}
      >
        {trecho ? (
          <blockquote className="rounded-2xl border border-borda bg-black/[0.03] px-4 py-3 text-sm italic text-suave dark:bg-white/[0.04]">
            {trecho.length > 220 ? `${trecho.slice(0, 220)}…` : trecho}
          </blockquote>
        ) : null}
        <AreaTexto
          rotulo="Motivo"
          opcional
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Conte rapidamente o que há de errado (ofensa, spam, spoiler…)"
          erro={erro}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="perigo" carregando={enviando}>
            <Flag className="size-4" aria-hidden /> Denunciar
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
