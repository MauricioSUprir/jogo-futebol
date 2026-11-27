"use client";
import { useActionState } from "react";
import { entrar } from "@/lib/acoes/contas";
import { Campo } from "@/components/ui/campos";
import { BotaoEnviar, MensagemResultado, erroDoCampo } from "@/components/contas/partes";

export function FormEntrar({ proximo }: { proximo?: string }) {
  const [estado, acao] = useActionState(entrar, null);
  return (
    <form action={acao} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="proximo" value={proximo ?? ""} />
      <Campo name="email" type="email" rotulo="E-mail" autoComplete="email" required inputMode="email" erro={erroDoCampo(estado, "email")} />
      <Campo name="senha" type="password" rotulo="Senha" autoComplete="current-password" required erro={erroDoCampo(estado, "senha")} />
      <MensagemResultado estado={estado} />
      <BotaoEnviar>Entrar</BotaoEnviar>
    </form>
  );
}
