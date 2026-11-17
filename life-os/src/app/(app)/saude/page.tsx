import { HeartPulse } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { MODULOS } from "@/lib/modulos";
import { CabecalhoPagina } from "@/components/ui";
import { CartaoModulo } from "@/components/modulos";

export const metadata = { title: "Saúde" };

export default async function PaginaSaude() {
  await exigirUsuario();
  const mods = MODULOS.filter((m) => m.grupo === "saude");
  return (
    <>
      <CabecalhoPagina rotulo="Saúde" titulo={<span className="flex items-center gap-2"><HeartPulse className="h-7 w-7 text-eletrico-claro" /> Saúde e bem-estar</span>} descricao="Acompanhar, sem diagnosticar: os módulos mostram padrões dos seus próprios registros." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mods.map((m) => (
          <CartaoModulo key={m.nome} m={m} />
        ))}
      </div>
    </>
  );
}
