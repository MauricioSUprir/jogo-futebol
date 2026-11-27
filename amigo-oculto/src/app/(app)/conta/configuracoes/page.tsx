import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Palette, Settings, Sparkles } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { emailConfigurado, pushConfigurado } from "@/lib/servidor/entrega";
import { VAPID_PUBLICA } from "@/lib/env";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { PushNesteAparelho, TesteNotificacao } from "@/components/conta/push";
import { Aparencia, Efeitos, EmailNotificacoes } from "@/components/conta/preferencias-conta";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const usuario = await exigirUsuario("/conta/configuracoes");
  const supabase = await clienteServidor();
  const [{ data: ajustes }, { data: inscricoes }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", usuario.id).maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint").eq("user_id", usuario.id),
  ]);
  const modo = (ajustes?.color_mode as "system" | "light" | "dark" | undefined) ?? "system";
  const email = !usuario.is_anonymous && usuario.email ? usuario.email : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <Link href="/conta" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
          <ArrowLeft className="size-4" aria-hidden /> Minha conta
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-titulo text-3xl font-semibold sm:text-4xl">
          <Settings className="size-8 text-t1" aria-hidden /> Configurações
        </h1>
        <p className="mt-1 text-suave">Como você quer ser avisado e como o app aparece para você.</p>
      </header>

      <Cartao>
        <TituloCartao
          icone={<Bell className="size-5" />}
          titulo="Notificações"
          descricao="Tudo sempre aparece no sino do app. E-mail e push só com a sua autorização."
        />
        <div className="flex flex-col gap-6">
          <EmailNotificacoes inicial={ajustes?.notify_email ?? true} servidorPronto={emailConfigurado()} email={email} />
          <div className="h-px bg-borda" />
          <PushNesteAparelho
            chavePublica={VAPID_PUBLICA}
            servidorPronto={pushConfigurado()}
            endpointsDaConta={(inscricoes ?? []).map((i) => i.endpoint)}
          />
          <TesteNotificacao />
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao icone={<Palette className="size-5" />} titulo="Aparência" descricao="Claro, escuro ou igual ao do seu aparelho." />
        <Aparencia inicial={modo} />
      </Cartao>

      <Cartao>
        <TituloCartao icone={<Sparkles className="size-5" />} titulo="Efeitos" descricao="Sons, vibração e animações da revelação e dos jogos." />
        <Efeitos
          inicial={{
            som: ajustes?.sound_effects ?? true,
            vibracao: ajustes?.vibration ?? true,
            menosMovimento: ajustes?.reduce_motion ?? false,
          }}
        />
      </Cartao>
    </div>
  );
}
