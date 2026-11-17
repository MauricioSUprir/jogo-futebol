"use client";
import { useActionState } from "react";
import { configurarConta } from "@/acoes/conta";
import { Campo, Entrada, Mensagem, Selecao } from "@/components/ui";
import { BotaoEnvio, manterValores } from "@/components/cliente";

export function FormConfigurar({ fusos, semToken }: { fusos: string[]; semToken: boolean }) {
  const [estado, acao] = useActionState(configurarConta, undefined);
  return (
    <form action={acao} onReset={manterValores} className="painel holo grid grid-cols-1 gap-4 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Primeira configuração</h1>
        <p className="mt-1 text-sm text-suave">Crie a sua conta. Depois disso, ninguém mais consegue criar outra.</p>
      </div>
      {semToken && <Mensagem tipo="erro">Defina LIFEOS_SETUP_TOKEN no .env do servidor e reinicie.</Mensagem>}
      <Campo rotulo="Código de configuração" dica="Está no .env do servidor (LIFEOS_SETUP_TOKEN)." htmlFor="token">
        <Entrada id="token" name="token" type="password" autoComplete="off" required />
      </Campo>
      <Campo rotulo="Seu nome" htmlFor="nome">
        <Entrada id="nome" name="nome" autoComplete="given-name" required maxLength={60} />
      </Campo>
      <Campo rotulo="Usuário" dica="Minúsculas, números, ponto ou hífen." htmlFor="usuario">
        <Entrada id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required pattern="[a-z0-9._\-]{3,32}" />
      </Campo>
      <Campo rotulo="Senha" dica="Pelo menos 10 caracteres, misturando letras e números." htmlFor="senha">
        <Entrada id="senha" name="senha" type="password" autoComplete="new-password" required minLength={10} />
      </Campo>
      <Campo rotulo="Confirme a senha" htmlFor="confirma">
        <Entrada id="confirma" name="confirma" type="password" autoComplete="new-password" required minLength={10} />
      </Campo>
      <Campo rotulo="Fuso horário" htmlFor="fuso">
        <Selecao id="fuso" name="fuso" defaultValue="America/Sao_Paulo">
          {fusos.map((f) => (
            <option key={f} value={f}>
              {f.replaceAll("_", " ")}
            </option>
          ))}
        </Selecao>
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio tamanho="g" pendente="Criando…">
        Criar conta e entrar
      </BotaoEnvio>
    </form>
  );
}
