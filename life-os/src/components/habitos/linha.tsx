// Linha de um hábito com o status de hoje e o botão de marcar (painel e Habit Tracker).
import Link from "next/link";
import { Check, Clock, Coffee, Flame, Minus, Plus } from "lucide-react";
import { marcarHabito } from "@/acoes/habitos";
import { IconeHabito } from "../icone-habito";
import { textoFrequencia } from "@/lib/habitos";
import type { HabitoCompleto } from "@/lib/servidor/dados";
import { cn } from "@/lib/cn";

export function StatusHoje({ h }: { h: HabitoCompleto }) {
  const s = h.hoje.status;
  const mapa = {
    feito: { icone: Check, texto: "Feito", cls: "text-ok" },
    parcial: { icone: Clock, texto: `${h.hoje.count}/${h.def.targetPerDay}`, cls: "text-alerta" },
    pendente: { icone: Clock, texto: "Pendente", cls: "text-suave" },
    descanso: { icone: Coffee, texto: "Descanso", cls: "text-violeta-claro" },
    livre: { icone: Minus, texto: "Hoje não", cls: "text-apagado" },
  }[s];
  const I = mapa.icone;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", mapa.cls)}>
      <I className="h-3.5 w-3.5" aria-hidden /> {mapa.texto}
    </span>
  );
}

export function BotaoMarcar({ h }: { h: HabitoCompleto }) {
  const feito = h.hoje.status === "feito";
  if (h.habito.source === "agua") {
    return (
      <Link
        href="/agua"
        className={cn(
          "grid grid-cols-1 h-10 w-10 place-items-center rounded-xl border transition",
          feito ? "border-ok/40 bg-ok/15 text-ok" : "border-borda text-suave hover:text-texto",
        )}
        aria-label={feito ? "Meta de água batida" : "Abrir o Hydro Track"}
        title="Marcado pela meta de água"
      >
        {feito ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </Link>
    );
  }
  const varias = h.def.targetPerDay > 1;
  return (
    <form action={marcarHabito}>
      <input type="hidden" name="id" value={h.habito.id} />
      <input type="hidden" name="acao" value={varias && !feito ? "mais" : "alternar"} />
      <button
        className={cn(
          "grid grid-cols-1 h-10 w-10 place-items-center rounded-xl border transition active:scale-95",
          feito
            ? "border-ok/40 bg-ok/15 text-ok shadow-[0_0_18px_-6px_rgb(52_211_153/0.8)]"
            : "border-borda bg-fundo-2/60 text-suave hover:border-eletrico hover:text-texto",
        )}
        aria-pressed={feito}
        aria-label={feito ? `Desmarcar "${h.habito.name}"` : varias ? `Somar 1 em "${h.habito.name}"` : `Marcar "${h.habito.name}" como feito`}
      >
        {feito ? <Check className="h-5 w-5" /> : varias ? <Plus className="h-5 w-5" /> : <Check className="h-5 w-5 opacity-30" />}
      </button>
    </form>
  );
}

export function LinhaHabito({ h, comLink = true, compacto }: { h: HabitoCompleto; comLink?: boolean; compacto?: boolean }) {
  const nome = (
    <span className="block truncate font-medium">{h.habito.name}</span>
  );
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-borda bg-fundo-2/50 px-3 py-2.5">
      <IconeHabito icone={h.habito.icon} cor={h.habito.color} />
      <div className="min-w-0 flex-1">
        {comLink ? (
          <Link href={`/habitos/${h.habito.id}`} className="hover:text-eletrico-claro">
            {nome}
          </Link>
        ) : (
          nome
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <StatusHoje h={h} />
          {h.semana ? (
            <span className="numero text-xs text-suave">
              {h.semana.feitos}/{h.semana.meta} na semana
            </span>
          ) : (
            !compacto && <span className="hidden text-xs text-apagado sm:inline">{textoFrequencia(h.def)}</span>
          )}
          {h.sequencia.valor > 0 && (
            <span className="numero inline-flex items-center gap-0.5 text-xs text-alerta" title="Sequência atual">
              <Flame className="h-3.5 w-3.5" aria-hidden /> {h.sequencia.valor} {h.sequencia.unidade === "semanas" ? "sem." : h.sequencia.valor === 1 ? "dia" : "dias"}
            </span>
          )}
        </div>
      </div>
      <BotaoMarcar h={h} />
    </li>
  );
}
