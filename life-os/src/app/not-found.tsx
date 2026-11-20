import Link from "next/link";
import { classesBotao } from "@/components/ui";

export default function NaoEncontrado() {
  return (
    <main className="grid grid-cols-1 min-h-dvh place-items-center px-4">
      <div className="painel holo grid grid-cols-1 max-w-sm gap-3 p-6 text-center">
        <p className="rotulo">Erro 404</p>
        <h1 className="font-display text-xl font-semibold">Página não encontrada</h1>
        <Link href="/" className={classesBotao("primario", "m", "justify-self-center")}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
