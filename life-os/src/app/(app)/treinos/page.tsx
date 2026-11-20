// FITNESS CENTER — musculação, futebol, cardio e recuperação.
import Link from "next/link";
import { Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { dadosRegistroRapidoTreinos } from "@/lib/servidor/treinos";
import { hoje } from "@/lib/datas";
import { CabecalhoPagina, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { EscolherAtividade } from "@/components/treinos/formularios";
import { AbaCardio, AbaFutebol, AbaGeral, AbaMusculacao, AbaRecuperacao } from "@/components/treinos/abas";

export const metadata = { title: "Fitness Center" };

const ABAS = [
  { v: "geral", nome: "Visão geral" },
  { v: "musculacao", nome: "Musculação" },
  { v: "futebol", nome: "Futebol" },
  { v: "cardio", nome: "Cardio" },
  { v: "recuperacao", nome: "Recuperação" },
] as const;
type Aba = (typeof ABAS)[number]["v"];

export default async function PaginaTreinos({ searchParams }: { searchParams: Promise<{ aba?: string; temporada?: string; ex?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const sp = await searchParams;
  const aba: Aba = ABAS.find((a) => a.v === sp.aba)?.v ?? "geral";
  const { fichas } = await dadosRegistroRapidoTreinos(user, hojeK);
  return (
    <>
      <CabecalhoPagina
        rotulo="Fitness Center"
        titulo="Treinos"
        descricao="Evolução com técnica e recuperação: treino e descanso andam juntos."
        acao={
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Registrar atividade</>} classeGatilho={classesBotao("primario")} titulo="Registrar atividade" descricao="Escolha o tipo.">
            <EscolherAtividade hoje={hojeK} fichas={fichas} />
          </Dialogo>
        }
      />
      <nav aria-label="Seções do Fitness Center" className="mb-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-borda bg-fundo-2/60 p-1 sm:flex sm:max-w-2xl">
          {ABAS.map((a) => (
            <Link
              key={a.v}
              href={`/treinos?aba=${a.v}`}
              aria-current={aba === a.v ? "page" : undefined}
              className="min-w-0 truncate rounded-lg px-2 py-1.5 text-center text-sm text-suave transition sm:flex-1 aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
            >
              {a.nome}
            </Link>
          ))}
        </div>
      </nav>
      {aba === "geral" && <AbaGeral user={user} hojeK={hojeK} />}
      {aba === "musculacao" && <AbaMusculacao user={user} hojeK={hojeK} exercicio={sp.ex} />}
      {aba === "futebol" && <AbaFutebol user={user} hojeK={hojeK} temporada={sp.temporada ? Number(sp.temporada) : undefined} />}
      {aba === "cardio" && <AbaCardio user={user} hojeK={hojeK} />}
      {aba === "recuperacao" && <AbaRecuperacao user={user} hojeK={hojeK} />}
    </>
  );
}
