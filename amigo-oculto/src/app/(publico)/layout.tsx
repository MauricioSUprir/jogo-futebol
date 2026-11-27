import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BotaoLink } from "@/components/ui/botao";
import { usuarioAtual } from "@/lib/servidor/sessao";

export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  return (
    <div className="fundo-festivo flex min-h-dvh flex-col" data-tema="natal">
      <header className="sticky top-0 z-40 px-4 pt-[env(safe-area-inset-top)]">
        <div className="vidro mx-auto mt-3 flex h-16 max-w-6xl items-center justify-between rounded-full px-4 sm:px-6">
          <Link href="/" className="rounded-full" aria-label="Amigo Oculto — início">
            <Logo tamanho={34} />
          </Link>
          <nav aria-label="Conta" className="flex items-center gap-2">
            {usuario ? (
              <BotaoLink href="/painel" tamanho="p">
                Meu painel
              </BotaoLink>
            ) : (
              <>
                <BotaoLink href="/entrar" variante="fantasma" tamanho="p" className="hidden sm:inline-flex">
                  Entrar
                </BotaoLink>
                <BotaoLink href="/cadastro" tamanho="p">
                  Criar conta
                </BotaoLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-borda pt-6 text-sm text-suave sm:flex-row">
          <Logo tamanho={24} />
          <nav aria-label="Rodapé" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/#como-funciona" className="hover:text-texto">Como funciona</Link>
            <Link href="/explorar" className="hover:text-texto">Grupos públicos</Link>
            <Link href="/privacidade" className="hover:text-texto">Privacidade</Link>
            <Link href="/termos" className="hover:text-texto">Termos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
