import { exigirUsuario } from "@/lib/servidor/sessao";
import { aguaDoPeriodo, carregarHabitos } from "@/lib/servidor/dados";
import { hoje } from "@/lib/datas";
import { programado } from "@/lib/habitos";
import { BarraInferior, BarraLateral } from "@/components/casca/barras";
import { RegistroRapido, type ExtraRegistro } from "@/components/casca/registro-rapido";
import { FormCheckin } from "@/components/checkin/form";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { Apple, Dumbbell, GraduationCap, MoonStar, Smile } from "lucide-react";
import { RegistroRapidoTreino } from "@/components/treinos/registro-rapido";
import { RegistroRapidoSono } from "@/components/sono/registro-rapido";
import { RegistroRapidoRefeicao } from "@/components/alimentacao/registro-rapido";
import { RegistroRapidoEstudo } from "@/components/estudos/registro-rapido";
import { dadosRegistroRapidoTreinos } from "@/lib/servidor/treinos";
import { dadosRegistroRapidoSono } from "@/lib/servidor/sono";
import { dadosRegistroRapidoAlimentacao } from "@/lib/servidor/alimentacao";
import { dadosRegistroRapidoEstudos } from "@/lib/servidor/estudos";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const [agua, habitos, checkins, rTreino, rSono, rRefeicao, rEstudo] = await Promise.all([
    aguaDoPeriodo(user, hojeK, hojeK),
    carregarHabitos(user, hojeK, { dias: 1 }),
    checkinsDoPeriodo(user.id, hojeK, hojeK),
    dadosRegistroRapidoTreinos(user, hojeK),
    dadosRegistroRapidoSono(user, hojeK),
    dadosRegistroRapidoAlimentacao(user, hojeK),
    dadosRegistroRapidoEstudos(user, hojeK),
  ]);
  const dia = agua.resumo[0];
  // Registros rápidos dos módulos no botão central (o formulário vem pronto do servidor).
  const extras: ExtraRegistro[] = [
    { chave: "treino", rotulo: "Treino", titulo: "Registrar treino", icone: <Dumbbell aria-hidden />, conteudo: <RegistroRapidoTreino {...rTreino} /> },
    { chave: "sono", rotulo: "Sono", titulo: "Registrar a noite", icone: <MoonStar aria-hidden />, conteudo: <RegistroRapidoSono {...rSono} /> },
    { chave: "refeicao", rotulo: "Refeição", titulo: "Registrar refeição", icone: <Apple aria-hidden />, conteudo: <RegistroRapidoRefeicao {...rRefeicao} /> },
    { chave: "estudo", rotulo: "Estudo", titulo: "Registrar estudo", icone: <GraduationCap aria-hidden />, conteudo: <RegistroRapidoEstudo {...rEstudo} /> },
    {
      chave: "checkin",
      rotulo: "Como estou",
      titulo: "Como você está hoje?",
      icone: <Smile aria-hidden />,
      conteudo: <FormCheckin dia={hojeK} atual={checkins.get(hojeK) ?? null} />,
    },
  ];
  return (
    <div className="min-h-dvh lg:flex">
      {/* No iPhone instalado (barra de status translúcida), o que rola não passa por baixo do relógio e da bateria. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-fundo/90 backdrop-blur-xl" />
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
        extras={extras}
      />
    </div>
  );
}
