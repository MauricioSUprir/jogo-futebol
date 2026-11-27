import { Esqueleto } from "@/components/ui/carregando";

export default function Carregando() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Carregando o convite">
      <Esqueleto className="h-80" />
      <Esqueleto className="h-32" />
    </div>
  );
}
