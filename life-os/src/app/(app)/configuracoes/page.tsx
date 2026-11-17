import { exigirUsuario } from "@/lib/servidor/sessao";
import { listaDeFusos } from "@/lib/datas";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { AbasConfig } from "@/components/config/abas";
import { FormPerfil } from "@/components/config/formularios";
import { UserRound } from "lucide-react";

export const metadata = { title: "Configurações" };

export default async function PaginaConfig() {
  const user = await exigirUsuario();
  return (
    <>
      <CabecalhoPagina rotulo="Configurações" titulo="Perfil" />
      <AbasConfig atual="perfil" />
      <Cartao titulo="Seus dados" icone={UserRound} className="max-w-2xl">
        <p className="mb-4 text-sm text-suave">
          Usuário: <span className="text-texto">{user.username}</span>
        </p>
        <FormPerfil nome={user.displayName} fuso={user.timezone} inicio={user.dayStart} fim={user.dayEnd} fusos={listaDeFusos()} />
      </Cartao>
    </>
  );
}
