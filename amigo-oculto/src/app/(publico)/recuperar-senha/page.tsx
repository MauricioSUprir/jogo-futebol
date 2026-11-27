"use client";
import Link from "next/link";
import { useActionState } from "react";
import { recuperarSenha } from "@/lib/acoes/contas";
import { Cartao } from "@/components/ui/cartao";
import { Campo } from "@/components/ui/campos";
import { BotaoEnviar, MensagemResultado, erroDoCampo } from "@/components/contas/partes";

export default function PaginaRecuperar() {
  const [estado, acao] = useActionState(recuperarSenha, null);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Cartao forte className="p-7 sm:p-8">
        <h1 className="font-titulo text-3xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-suave">Informe seu e-mail e enviaremos um link para criar uma senha nova.</p>
        <form action={acao} className="mt-6 flex flex-col gap-4" noValidate>
          <Campo name="email" type="email" rotulo="E-mail" autoComplete="email" inputMode="email" required erro={erroDoCampo(estado, "email")} />
          <MensagemResultado estado={estado} />
          <BotaoEnviar>Enviar link</BotaoEnviar>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/entrar" className="font-semibold text-t1 underline-offset-4 hover:underline">Voltar para entrar</Link>
        </p>
      </Cartao>
    </div>
  );
}
