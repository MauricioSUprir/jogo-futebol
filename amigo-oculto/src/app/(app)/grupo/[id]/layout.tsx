import type { Metadata } from "next";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { CabecalhoGrupo } from "@/components/grupo/cabecalho";
import { AbasGrupo } from "@/components/grupo/abas";
import { AguardandoAprovacao } from "@/components/grupo/aguardando";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const g = await carregarGrupo(id);
  return { title: g.evento.name };
}

export default async function LayoutGrupo({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  if (!g.aprovado) return <AguardandoAprovacao grupo={g} />;
  return (
    <div data-tema={g.evento.theme} className="flex flex-col gap-5">
      <CabecalhoGrupo grupo={g} />
      <AbasGrupo
        id={id}
        sorteado={g.evento.status !== "open"}
        admin={g.admin}
        albumAberto={g.evento.status === "finished" || !!g.aoVivo}
        aoVivo={!!g.aoVivo && g.aoVivo.status === "running"}
      />
      <div>{children}</div>
    </div>
  );
}
