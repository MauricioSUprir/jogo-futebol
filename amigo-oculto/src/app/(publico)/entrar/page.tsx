import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao } from "@/components/ui/cartao";
import { FormEntrar } from "./form";
import { BotaoGoogle } from "@/components/contas/botao-google";
import { GOOGLE_LIGADO } from "@/lib/env";
import { usuarioAtual } from "@/lib/servidor/sessao";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<{ proximo?: string; erro?: string }> }) {
  const { proximo, erro } = await searchParams;
  const usuario = await usuarioAtual();
  if (usuario && !usuario.is_anonymous) redirect(proximo?.startsWith("/") ? proximo : "/painel");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Cartao forte className="p-7 sm:p-8">
        <h1 className="font-titulo text-3xl font-semibold">Que bom te ver!</h1>
        <p className="mt-1 text-suave">Entre para ver seus grupos e o seu presente.</p>
        {erro ? (
          <p role="alert" className="mt-4 rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi">
            {erro === "provedor" ? "O login com o Google foi cancelado ou não deu certo." : "Este link expirou ou já foi usado. Peça outro."}
          </p>
        ) : null}
        {GOOGLE_LIGADO ? (
          <div className="mt-6 flex flex-col gap-4">
            <BotaoGoogle proximo={proximo ?? "/painel"} />
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-suave">
              <span className="h-px flex-1 bg-borda" /> ou com e-mail <span className="h-px flex-1 bg-borda" />
            </div>
          </div>
        ) : null}
        <FormEntrar proximo={proximo} />
        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link href="/recuperar-senha" className="font-semibold text-t1 underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>
          <p className="text-suave">
            Ainda não tem conta?{" "}
            <Link href={`/cadastro${proximo ? `?proximo=${encodeURIComponent(proximo)}` : ""}`} className="font-semibold text-t1 underline-offset-4 hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </Cartao>
    </div>
  );
}
