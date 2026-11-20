"use client";
import { useActionState } from "react";
import { entrar } from "@/acoes/conta";
import { Campo, Entrada, Mensagem } from "@/components/ui";
import { BotaoEnvio, manterValores } from "@/components/cliente";

export function FormEntrar({ de }: { de: string }) {
  const [estado, acao] = useActionState(entrar, undefined);
  return (
    <form action={acao} onReset={manterValores} className="painel holo grid grid-cols-1 gap-4 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-suave">Acesso privado.</p>
      </div>
      <input type="hidden" name="de" value={de} />
      <Campo rotulo="Usuário" htmlFor="usuario">
        <Entrada id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus />
      </Campo>
      <Campo rotulo="Senha" htmlFor="senha">
        <Entrada id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio tamanho="g" pendente="Entrando…">
        Entrar
      </BotaoEnvio>
    </form>
  );
}
