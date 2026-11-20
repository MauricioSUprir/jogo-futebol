import Link from "next/link";
import { Database, LogOut, Settings, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { FASES, MODULOS } from "@/lib/modulos";
import { CabecalhoPagina, classesBotao } from "@/components/ui";
import { CartaoModulo } from "@/components/modulos";
import { sair } from "@/acoes/conta";

export const metadata = { title: "Todos os módulos" };

export default async function PaginaMais() {
  await exigirUsuario();
  return (
    <>
      <CabecalhoPagina rotulo="LIFE OS" titulo="Todos os módulos" descricao="O que já funciona e o que chega em cada fase do plano." />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href="/configuracoes" className={classesBotao("secundario", "g")}>
          <Settings className="h-4 w-4" /> Perfil
        </Link>
        <Link href="/configuracoes/seguranca" className={classesBotao("secundario", "g")}>
          <ShieldCheck className="h-4 w-4" /> Segurança
        </Link>
        <Link href="/configuracoes/dados" className={classesBotao("secundario", "g")}>
          <Database className="h-4 w-4" /> Dados
        </Link>
        <form action={sair}>
          <button className={classesBotao("fantasma", "g", "w-full")}>
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
      {[1, 2, 3, 4].map((f) => (
        <section key={f} className="mb-6">
          <h2 className="rotulo mb-2">{FASES[f]}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.filter((m) => m.fase === f).map((m) => (
              <CartaoModulo key={m.nome} m={m} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
