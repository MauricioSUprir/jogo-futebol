// STUDY CENTER — organização escolar: matérias, provas, Pomodoro, revisões, flashcards, notas, simulados e resumos.
import Link from "next/link";
import { CalendarPlus, Plus, Settings2, Timer } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarEstudos } from "@/lib/servidor/estudos";
import { hoje, somaDias } from "@/lib/datas";
import { CabecalhoPagina, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { FormConfigEstudos, FormMateria, FormProva, FormSessao } from "@/components/estudos/formularios";
import { RolarAbaAtiva } from "@/components/estudos/rolar-aba";
import { AbaMaterias, AbaNotas, AbaPomodoro, AbaProvas, AbaRevisoes, AbaSimulados, AbaVisao } from "@/components/estudos/abas";

export const metadata = { title: "Study Center" };

const ABAS = [
  { v: "visao", nome: "Visão geral" },
  { v: "materias", nome: "Matérias" },
  { v: "provas", nome: "Provas e trabalhos" },
  { v: "pomodoro", nome: "Pomodoro" },
  { v: "revisoes", nome: "Revisões e flashcards" },
  { v: "notas", nome: "Notas" },
  { v: "simulados", nome: "Simulados e resumos" },
] as const;
type Aba = (typeof ABAS)[number]["v"];

export default async function PaginaEstudos({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const pedida = (await searchParams).aba;
  const aba: Aba = ABAS.find((a) => a.v === pedida)?.v ?? "visao";
  const d = await carregarEstudos(user, hojeK);
  const ops = d.materias.map((m) => ({ id: m.id, nome: m.name }));
  const props = { d, user, hojeK };

  return (
    <>
      <CabecalhoPagina
        rotulo="Study Center"
        titulo="Central de estudos"
        descricao="Matérias, provas, horas estudadas, revisões e notas: a força-tarefa para passar direto."
        acao={
          <>
            <Dialogo gatilho={<><Timer className="h-4 w-4" /> Registrar estudo</>} classeGatilho={classesBotao("primario")} titulo="Registrar horas estudadas">
              <FormSessao materias={ops} hoje={hojeK} />
            </Dialogo>
            <Dialogo gatilho={<><CalendarPlus className="h-4 w-4" /> Prova ou trabalho</>} titulo="Marcar prova ou trabalho">
              <FormProva materias={ops} dia={somaDias(hojeK, 7)} />
            </Dialogo>
            <Dialogo gatilho={<><Plus className="h-4 w-4" /> Matéria</>} titulo="Nova matéria">
              <FormMateria />
            </Dialogo>
            <Dialogo gatilho={<Settings2 className="h-4 w-4" />} rotuloGatilho="Ajustes do Pomodoro e da meta semanal" classeGatilho={classesBotao("fantasma", "icone")} titulo="Ajustes do Study Center">
              <FormConfigEstudos {...d.prefs} somaMaterias={d.somaMetas} />
            </Dialogo>
          </>
        }
      />
      <nav aria-label="Seções do Study Center" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1 rounded-xl border border-borda bg-fundo-2/60 p-1">
          {ABAS.map((a) => (
            <Link
              key={a.v}
              href={a.v === "visao" ? "/estudos" : `/estudos?aba=${a.v}`}
              aria-current={aba === a.v ? "page" : undefined}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm text-suave transition aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
            >
              {a.nome}
            </Link>
          ))}
        </div>
      </nav>
      <RolarAbaAtiva rotulo="Seções do Study Center" aba={aba} />
      {aba === "visao" && <AbaVisao {...props} />}
      {aba === "materias" && <AbaMaterias {...props} />}
      {aba === "provas" && <AbaProvas {...props} />}
      {aba === "pomodoro" && <AbaPomodoro {...props} />}
      {aba === "revisoes" && <AbaRevisoes {...props} />}
      {aba === "notas" && <AbaNotas {...props} />}
      {aba === "simulados" && <AbaSimulados {...props} />}
    </>
  );
}
