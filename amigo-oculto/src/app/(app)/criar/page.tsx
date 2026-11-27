import type { Metadata } from "next";
import { ShieldCheck, UserRoundPlus } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { Cartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { AssistenteCriar } from "@/components/criar/assistente";

export const metadata: Metadata = { title: "Criar amigo oculto" };

export default async function PaginaCriar() {
  const usuario = await exigirUsuario("/criar");
  if (usuario.is_anonymous) {
    return (
      <Cartao forte className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-3xl bg-ouro/15 text-ouro-escuro dark:text-ouro-claro">
          <UserRoundPlus className="size-7" aria-hidden />
        </span>
        <h1 className="font-titulo text-2xl font-semibold">Salve sua conta para criar</h1>
        <p className="text-suave">
          Você está participando como convidado. Para organizar um amigo oculto, finalize seu cadastro com e-mail e senha:
          seus grupos, sua lista de desejos e suas mensagens continuam com você.
        </p>
        <p className="flex items-center gap-2 text-sm text-suave">
          <ShieldCheck className="size-4 text-esmeralda" aria-hidden /> Leva menos de um minuto.
        </p>
        <BotaoLink href="/conta#salvar" variante="ouro" tamanho="g" className="mt-2">
          Salvar minha conta
        </BotaoLink>
      </Cartao>
    );
  }
  return (
    <div className="mx-auto w-full max-w-5xl">
      <AssistenteCriar />
    </div>
  );
}
