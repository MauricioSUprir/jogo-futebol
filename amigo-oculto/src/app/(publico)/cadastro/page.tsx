import type { Metadata } from "next";
import Link from "next/link";
import { Cartao } from "@/components/ui/cartao";
import { FormCadastro } from "./form";
import { BotaoGoogle } from "@/components/contas/botao-google";
import { GOOGLE_LIGADO } from "@/lib/env";

export const metadata: Metadata = { title: "Criar conta" };

export default async function PaginaCadastro({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Cartao forte className="p-7 sm:p-8">
        <h1 className="font-titulo text-3xl font-semibold">Crie sua conta</h1>
        <p className="mt-1 text-suave">Leva menos de um minuto. Depois é só convidar a turma.</p>
        {GOOGLE_LIGADO ? (
          <div className="mt-6 flex flex-col gap-4">
            <BotaoGoogle proximo={proximo ?? "/painel"} rotulo="Cadastrar com Google" />
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-suave">
              <span className="h-px flex-1 bg-borda" /> ou com e-mail <span className="h-px flex-1 bg-borda" />
            </div>
          </div>
        ) : null}
        <FormCadastro proximo={proximo} />
        <p className="mt-6 text-center text-sm text-suave">
          Já tem conta?{" "}
          <Link href={`/entrar${proximo ? `?proximo=${encodeURIComponent(proximo)}` : ""}`} className="font-semibold text-t1 underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </Cartao>
    </div>
  );
}
