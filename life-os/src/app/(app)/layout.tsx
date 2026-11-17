import { exigirUsuario } from "@/lib/servidor/sessao";
import { aguaDoPeriodo, carregarHabitos } from "@/lib/servidor/dados";
import { hoje } from "@/lib/datas";
import { programado } from "@/lib/habitos";
import { BarraInferior, BarraLateral } from "@/components/casca/barras";
import { RegistroRapido } from "@/components/casca/registro-rapido";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const [agua, habitos] = await Promise.all([aguaDoPeriodo(user, hojeK, hojeK), carregarHabitos(user, hojeK, { dias: 1 })]);
  const dia = agua.resumo[0];
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-eletrico focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <BarraLateral nome={user.displayName} />
      <div className="min-w-0 flex-1">
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>
      <BarraInferior />
      <RegistroRapido
        hoje={hojeK}
        copo={agua.cfg.glassMl}
        garrafa={agua.cfg.bottleMl}
        rapidos={agua.cfg.quickAmounts}
        aguaMl={dia.aguaMl}
        metaMl={dia.meta}
        habitos={habitos.map((h) => ({
          id: h.habito.id,
          nome: h.habito.name,
          icone: h.habito.icon,
          cor: h.habito.color,
          feito: h.hoje.status === "feito",
          agua: h.habito.source === "agua",
          programado: programado(h.def, hojeK),
        }))}
      />
    </div>
  );
}
