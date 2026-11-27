"use client";
import { useOptimistic, useTransition } from "react";
import { CheckCircle2, MessageCircleHeart, ShoppingBag } from "lucide-react";
import { BotaoLink } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { marcarPresenteComprado } from "@/lib/acoes/revelacao";
import { cn } from "@/lib/cn";

/** Atalhos depois da revelação: mensagem anônima e "Já comprei o presente". */
export function AtalhosRevelacao({ eventoId, comprado, mensagensAbertas = true }: { eventoId: string; comprado: boolean; mensagensAbertas?: boolean }) {
  const { avisar } = useAvisos();
  const [pendente, iniciar] = useTransition();
  const [otimista, mudarOtimista] = useOptimistic(comprado);

  function alternar() {
    const novo = !otimista;
    iniciar(async () => {
      mudarOtimista(novo);
      const r = await marcarPresenteComprado(eventoId, novo);
      if (r.ok) avisar(r.mensagem ?? "Salvo.", "ok");
      else avisar(r.erro, "erro");
    });
  }

  return (
    <Cartao className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-titulo text-lg font-semibold">E agora?</h2>
        <p className="text-sm text-suave">Tire uma dúvida sem se entregar e marque quando o presente estiver garantido.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {mensagensAbertas ? (
          <BotaoLink href={`/grupo/${eventoId}/mensagens`} variante="vidro">
            <MessageCircleHeart className="size-4" aria-hidden />
            Mandar mensagem anônima
          </BotaoLink>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={otimista}
          aria-busy={pendente || undefined}
          onClick={alternar}
          disabled={pendente}
          className={cn(
            "relative inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ouro/45",
            otimista
              ? "bg-[linear-gradient(135deg,var(--esmeralda-clara),var(--esmeralda)_55%,var(--esmeralda-escura))] text-white shadow-[0_10px_24px_-10px_rgb(10_122_85/0.7)]"
              : "border border-borda bg-transparent text-texto hover:bg-black/5 dark:hover:bg-white/5",
          )}
        >
          {otimista ? <CheckCircle2 className="size-4" aria-hidden /> : <ShoppingBag className="size-4" aria-hidden />}
          {otimista ? "Presente comprado" : "Já comprei o presente"}
        </button>
      </div>
    </Cartao>
  );
}
