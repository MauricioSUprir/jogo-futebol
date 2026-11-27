"use client";
import { useOptimistic, useRef, useTransition } from "react";
import { Check, CircleHelp, PartyPopper, ShoppingBag, X } from "lucide-react";
import { responderPresenca, marcarPresenteComprado } from "@/lib/acoes/sala";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { cn } from "@/lib/cn";

type Rsvp = "yes" | "maybe" | "no";

const OPCOES: { valor: Rsvp; rotulo: string; icone: typeof Check; cor: string }[] = [
  { valor: "yes", rotulo: "Vou", icone: Check, cor: "esmeralda" },
  { valor: "maybe", rotulo: "Talvez", icone: CircleHelp, cor: "ouro" },
  { valor: "no", rotulo: "Não vou", icone: X, cor: "rubi" },
];

/** Confirmação de presença (vou / talvez / não vou): toque de novo na opção marcada para desfazer. */
export function ConfirmarPresenca({
  eventoId,
  inicial,
  bloqueado,
  motivoBloqueio,
}: {
  eventoId: string;
  inicial: Rsvp | null;
  bloqueado?: boolean;
  motivoBloqueio?: string;
}) {
  const [atual, setOtimista] = useOptimistic<Rsvp | null>(inicial);
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const { som } = usePreferencias();
  return (
    <div>
      <div role="group" aria-label="Confirmação de presença" className="grid grid-cols-3 gap-2">
        {OPCOES.map((o) => {
          const marcado = atual === o.valor;
          const Icone = o.icone;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={marcado}
              disabled={bloqueado || pendente}
              onClick={() =>
                iniciar(async () => {
                  const novo = marcado ? null : o.valor;
                  setOtimista(novo);
                  const r = await responderPresenca(eventoId, novo);
                  if (r.ok) {
                    tocar("tique", som);
                    avisar(r.mensagem ?? "Resposta salva.");
                  } else avisar(r.erro, "erro");
                })
              }
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-sm font-semibold transition",
                "border-borda bg-white/50 hover:-translate-y-0.5 hover:bg-white/80 disabled:pointer-events-none disabled:opacity-60 dark:bg-white/5 dark:hover:bg-white/10",
                marcado && o.cor === "esmeralda" && "border-esmeralda bg-esmeralda/12 text-esmeralda dark:bg-esmeralda/15",
                marcado && o.cor === "ouro" && "border-ouro bg-ouro/15 text-ouro-escuro dark:text-ouro-claro",
                marcado && o.cor === "rubi" && "border-rubi bg-rubi/10 text-rubi dark:bg-rubi/15",
              )}
            >
              <Icone className="size-5" aria-hidden />
              {o.rotulo}
            </button>
          );
        })}
      </div>
      {bloqueado && motivoBloqueio ? <p className="mt-2 text-xs text-suave">{motivoBloqueio}</p> : null}
    </div>
  );
}

/** "Já comprei o presente" (depois do sorteio): o grupo vê o progresso, ninguém vê para quem é. */
export function JaComprei({ eventoId, inicial, bloqueado }: { eventoId: string; inicial: boolean; bloqueado?: boolean }) {
  const [comprado, setOtimista] = useOptimistic(inicial);
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const { som, vibracao, menosMovimento } = usePreferencias();
  const confete = useRef<ConfeteHandle>(null);
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={comprado}
        aria-label="Já comprei o presente"
        disabled={bloqueado || pendente}
        onClick={() =>
          iniciar(async () => {
            const novo = !comprado;
            setOtimista(novo);
            const r = await marcarPresenteComprado(eventoId, novo);
            if (r.ok) {
              avisar(r.mensagem ?? "Salvo.");
              if (novo) {
                tocar("festa", som);
                vibrar([30, 40, 30], vibracao);
                confete.current?.disparar({ quantidade: 90, origemY: 0.6 });
              }
            } else avisar(r.erro, "erro");
          })
        }
        className={cn(
          "flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition disabled:opacity-60",
          comprado
            ? "border-esmeralda bg-esmeralda/10 dark:bg-esmeralda/15"
            : "border-borda bg-white/50 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10",
        )}
      >
        <span
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl",
            comprado ? "bg-esmeralda text-white" : "bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1",
          )}
        >
          {comprado ? <PartyPopper className="size-5" aria-hidden /> : <ShoppingBag className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{comprado ? "Presente comprado!" : "Já comprei o presente"}</span>
          <span className="block text-sm text-suave">
            {comprado ? "Toque para desmarcar, se precisar." : "Marque quando estiver com o presente em mãos."}
          </span>
        </span>
        <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition", comprado ? "bg-esmeralda" : "bg-black/15 dark:bg-white/15")}>
          <span className={cn("absolute left-1 top-1 size-5 rounded-full bg-white shadow transition", comprado && "translate-x-5")} />
        </span>
      </button>
      <Confete ref={confete} desligado={menosMovimento} />
    </>
  );
}
