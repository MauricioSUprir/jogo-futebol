"use client";
import Link from "next/link";
import { useActionState } from "react";
import { cadastrar } from "@/lib/acoes/contas";
import { Campo } from "@/components/ui/campos";
import { BotaoEnviar, MensagemResultado, erroDoCampo } from "@/components/contas/partes";

export function FormCadastro({ proximo }: { proximo?: string }) {
  const [estado, acao] = useActionState(cadastrar, null);
  if (estado?.ok) return <div className="mt-6"><MensagemResultado estado={estado} /></div>;
  return (
    <form action={acao} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="proximo" value={proximo ?? ""} />
      <Campo name="nome" rotulo="Seu nome" autoComplete="name" required maxLength={60} erro={erroDoCampo(estado, "nome")} />
      <Campo name="email" type="email" rotulo="E-mail" autoComplete="email" inputMode="email" required erro={erroDoCampo(estado, "email")} />
      <Campo
        name="senha"
        type="password"
        rotulo="Senha"
        autoComplete="new-password"
        required
        minLength={8}
        dica="Pelo menos 8 caracteres, com letras e números."
        erro={erroDoCampo(estado, "senha")}
      />
      <Campo name="confirmar" type="password" rotulo="Confirme a senha" autoComplete="new-password" required erro={erroDoCampo(estado, "confirmar")} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="termos" value="1" required className="mt-0.5 size-5 accent-[var(--rubi)]" />
        <span>
          Li e aceito os <Link href="/termos" className="font-semibold underline">termos</Link> e a{" "}
          <Link href="/privacidade" className="font-semibold underline">política de privacidade</Link>.
        </span>
      </label>
      {erroDoCampo(estado, "termos") ? <p className="-mt-2 text-sm font-medium text-rubi">{erroDoCampo(estado, "termos")}</p> : null}
      <MensagemResultado estado={estado} />
      <BotaoEnviar>Criar conta</BotaoEnviar>
    </form>
  );
}
