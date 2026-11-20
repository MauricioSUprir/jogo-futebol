"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { verificarCodigo } from "@/acoes/conta";
import { Campo, Entrada, Mensagem } from "@/components/ui";
import { BotaoEnvio, manterValores } from "@/components/cliente";

export function FormVerificar({ de }: { de: string }) {
  const [estado, acao] = useActionState(verificarCodigo, undefined);
  const [recuperacao, setRecuperacao] = useState(false);
  return (
    <form action={acao} onReset={manterValores} className="painel holo grid grid-cols-1 gap-4 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-suave">
          {recuperacao ? "Digite um dos seus códigos de recuperação." : "Digite o código de 6 dígitos do seu app autenticador."}
        </p>
      </div>
      <input type="hidden" name="de" value={de} />
      <Campo rotulo={recuperacao ? "Código de recuperação" : "Código"} htmlFor="codigo">
        {recuperacao ? (
          <Entrada id="codigo" name="codigo" autoComplete="off" autoCapitalize="characters" required placeholder="XXXXX-XXXXX" autoFocus />
        ) : (
          <Entrada
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="text-center font-display text-2xl tracking-[0.5em]"
          />
        )}
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio tamanho="g" pendente="Conferindo…">
        Confirmar
      </BotaoEnvio>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-eletrico-claro hover:underline" onClick={() => setRecuperacao((v) => !v)}>
          {recuperacao ? "Usar o app autenticador" : "Usar código de recuperação"}
        </button>
        <Link href="/entrar" className="text-suave hover:text-texto">
          Voltar
        </Link>
      </div>
    </form>
  );
}
