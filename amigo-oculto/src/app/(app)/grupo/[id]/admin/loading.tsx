import { Esqueleto } from "@/components/ui/carregando";

/** Enquanto troca de seção no painel: a capa e as abas do grupo ficam; só o conteúdo pisca. */
export default function Carregando() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]" role="status" aria-label="Carregando o painel">
      <Esqueleto className="h-12 lg:h-[26rem]" />
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-10 w-56" />
        <Esqueleto className="h-48" />
        <Esqueleto className="h-32" />
      </div>
    </div>
  );
}
