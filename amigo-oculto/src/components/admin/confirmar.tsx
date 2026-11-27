"use client";
import { useState, type ReactNode } from "react";
import { Dialogo } from "@/components/ui/dialogo";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

/**
 * Confirmação de ação destrutiva. Com `digitar`, a pessoa precisa escrever a palavra (ou o nome) para liberar o botão.
 */
export function Confirmar({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rotuloConfirmar,
  aoConfirmar,
  carregando,
  perigo = true,
  digitar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children?: ReactNode;
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  carregando?: boolean;
  perigo?: boolean;
  digitar?: { palavra: string; rotulo: ReactNode };
}) {
  const [texto, setTexto] = useState("");
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const liberado = !digitar || norm(texto) === norm(digitar.palavra);
  function fechar() {
    setTexto("");
    aoFechar();
  }
  return (
    <Dialogo aberto={aberto} aoFechar={fechar} titulo={titulo} descricao={descricao}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (liberado && !carregando) aoConfirmar();
        }}
      >
        {children}
        {digitar ? (
          <Campo rotulo={digitar.rotulo} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoFocus spellCheck={false} />
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="fantasma" onClick={fechar} disabled={carregando}>
            Cancelar
          </Botao>
          <Botao type="submit" variante={perigo ? "perigo" : "primario"} carregando={carregando} disabled={!liberado}>
            {rotuloConfirmar}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
