import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BarraInferior, MenuSuperior } from "@/components/casca/navegacao";
import { SinoNotificacoes } from "@/components/casca/sino";
import { MenuConta } from "@/components/casca/menu-conta";
import { exigirUsuario, perfilAtual } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { SincronizarModo } from "@/components/casca/sincronizar-modo";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const perfil = await perfilAtual();
  const supabase = await clienteServidor();
  const [{ count }, { data: ajustes }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("user_settings").select("color_mode").maybeSingle(),
  ]);
  const nome = perfil?.display_name ?? "Você";
  return (
    <div className="fundo-festivo flex min-h-dvh flex-col" data-tema="natal">
      <SincronizarModo modo={(ajustes?.color_mode as "system" | "light" | "dark") ?? "system"} />
      <header className="sticky top-0 z-40 px-3 pt-[env(safe-area-inset-top)] sm:px-4">
        <div className="vidro mx-auto mt-3 flex h-16 max-w-6xl items-center gap-2 rounded-full pl-4 pr-2 sm:pl-6">
          <Link href="/painel" className="mr-auto rounded-full md:mr-4" aria-label="Amigo Oculto — meu painel">
            <Logo tamanho={32} />
          </Link>
          <MenuSuperior />
          <SinoNotificacoes usuarioId={usuario.id} inicial={count ?? 0} />
          <MenuConta nome={nome} avatar={perfil?.avatar_path ?? null} convidado={!!usuario.is_anonymous} />
        </div>
      </header>
      {usuario.is_anonymous ? (
        <div className="mx-auto mt-3 w-full max-w-6xl px-3 sm:px-4">
          <p className="vidro rounded-2xl px-4 py-2.5 text-sm">
            Você está participando como <strong>convidado</strong>.{" "}
            <Link href="/conta#salvar" className="font-semibold text-t1 underline underline-offset-4">
              Salve sua conta
            </Link>{" "}
            para não perder seus grupos se trocar de aparelho.
          </p>
        </div>
      ) : null}
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-4 md:pb-12">
        {children}
      </main>
      <BarraInferior convidado={!!usuario.is_anonymous} />
    </div>
  );
}
