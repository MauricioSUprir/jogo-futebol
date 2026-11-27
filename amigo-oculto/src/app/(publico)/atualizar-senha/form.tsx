"use client";
import { useActionState } from "react";
import { atualizarSenha } from "@/lib/acoes/contas";
import { Campo } from "@/components/ui/campos";
import { BotaoLink } from "@/components/ui/botao";
import { BotaoEnviar, MensagemResultado, erroDoCampo } from "@/components/contas/partes";

export function FormNovaSenha() {
  const [estado, acao] = useActionState(atualizarSenha, null);
  if (estado?.ok)
    return (
      <div className="mt-6 flex flex-col gap-4">
        <MensagemResultado estado={estado} />
        <BotaoLink href="/painel" tamanho="g">Ir para o painel</BotaoLink>
      </div>
    );
  return (
    <form action={acao} className="mt-6 flex flex-col gap-4" noValidate>
      <Campo name="senha" type="password" rotulo="Nova senha" autoComplete="new-password" dica="Pelo menos 8 caracteres, com letras e números." erro={erroDoCampo(estado, "senha")} />
      <Campo name="confirmar" type="password" rotulo="Confirme a nova senha" autoComplete="new-password" erro={erroDoCampo(estado, "confirmar")} />
      <MensagemResultado estado={estado} />
      <BotaoEnviar>Salvar senha</BotaoEnviar>
    </form>
  );
}
