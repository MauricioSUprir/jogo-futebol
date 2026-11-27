import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cartao } from "@/components/ui/cartao";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { FormNovaSenha } from "./form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function PaginaAtualizarSenha() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/recuperar-senha");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Cartao forte className="p-7 sm:p-8">
        <h1 className="font-titulo text-3xl font-semibold">Crie uma senha nova</h1>
        <p className="mt-1 text-suave">Para a conta {usuario.email}.</p>
        <FormNovaSenha />
      </Cartao>
    </div>
  );
}
