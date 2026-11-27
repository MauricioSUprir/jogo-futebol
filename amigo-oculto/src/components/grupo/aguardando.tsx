import { Hourglass } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { Cartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";

export function AguardandoAprovacao({ grupo: g }: { grupo: Grupo }) {
  const recusado = g.eu.status === "rejected";
  return (
    <Cartao forte className="mx-auto max-w-lg text-center" data-tema={g.evento.theme}>
      <Hourglass className="mx-auto size-10 text-ouro" aria-hidden />
      <h1 className="mt-3 font-titulo text-2xl font-semibold">{g.evento.name}</h1>
      <p className="mt-2 text-suave">
        {recusado
          ? "Seu pedido para entrar neste grupo não foi aprovado."
          : "Seu pedido foi enviado! Assim que o organizador aprovar, você recebe uma notificação e entra na sala."}
      </p>
      <BotaoLink href="/painel" variante="vidro" className="mt-5">
        Voltar ao painel
      </BotaoLink>
    </Cartao>
  );
}
