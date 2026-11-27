import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History, KeyRound, Settings, ShieldCheck, UserRound } from "lucide-react";
import { exigirUsuario, perfilAtual } from "@/lib/servidor/sessao";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { FormPerfil, FotoPerfil } from "@/components/conta/perfil";
import { SalvarContaConvidado, TrocarEmail, TrocarSenha } from "@/components/conta/seguranca";
import { PrivacidadeDados } from "@/components/conta/privacidade";
import { dataCurta } from "@/lib/formatos";

export const metadata: Metadata = { title: "Minha conta" };

export default async function PaginaConta() {
  const usuario = await exigirUsuario("/conta");
  const perfil = await perfilAtual();
  const nome = perfil?.display_name ?? "Você";
  const convidado = !!usuario.is_anonymous;
  const provedores = (usuario.identities ?? []).map((i) => i.provider);
  const temSenha = provedores.includes("email");
  const comGoogle = provedores.includes("google");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-titulo text-3xl font-semibold sm:text-4xl">
            <UserRound className="size-8 text-t1" aria-hidden /> Minha conta
          </h1>
          <p className="mt-1 text-suave">
            {convidado ? "Você está participando como convidado." : `Conta criada em ${dataCurta(usuario.created_at)}.`}
          </p>
        </div>
        <Link
          href="/conta/configuracoes"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-t1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Settings className="size-4" aria-hidden /> Configurações
        </Link>
      </header>

      {convidado ? (
        <section id="salvar" aria-labelledby="titulo-salvar" className="scroll-mt-28">
          <Cartao forte className="relative overflow-hidden">
            <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
            <TituloCartao
              icone={<ShieldCheck className="size-5" />}
              titulo={<span id="titulo-salvar">Salve sua conta</span>}
              descricao="Com e-mail e senha você não perde seus grupos, sua lista e suas mensagens se trocar de aparelho — e pode criar o seu próprio amigo oculto."
            />
            <SalvarContaConvidado />
          </Cartao>
        </section>
      ) : null}

      <Cartao>
        <TituloCartao icone={<UserRound className="size-5" />} titulo="Perfil" descricao="É assim que as pessoas dos seus grupos te veem." />
        <div className="flex flex-col gap-6">
          <FotoPerfil nome={nome} caminho={perfil?.avatar_path ?? null} />
          <FormPerfil nome={nome} apelido={perfil?.nickname ?? null} bio={perfil?.bio ?? null} />
        </div>
      </Cartao>

      {!convidado && usuario.email ? (
        <Cartao>
          <TituloCartao
            icone={<KeyRound className="size-5" />}
            titulo="Acesso"
            descricao="E-mail e senha usados para entrar."
            acao={comGoogle ? <Selo cor="esmeralda">Google conectado</Selo> : undefined}
          />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TrocarEmail atual={usuario.email} pendente={usuario.new_email ?? null} />
            <TrocarSenha temSenha={temSenha} />
          </div>
        </Cartao>
      ) : null}

      <Cartao>
        <TituloCartao icone={<ShieldCheck className="size-5" />} titulo="Privacidade e dados" descricao="Seus dados são seus (LGPD)." />
        <PrivacidadeDados convidado={convidado} />
      </Cartao>

      <Link
        href="/painel/historico"
        className="vidro flex min-h-16 items-center gap-3 rounded-cartao px-5 py-3 transition hover:-translate-y-0.5"
      >
        <History className="size-5 text-t1" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Histórico de amigos ocultos</span>
          <span className="block text-sm text-suave">Todos os grupos de que você participou</span>
        </span>
        <ChevronRight className="size-5 text-suave" aria-hidden />
      </Link>
    </div>
  );
}
