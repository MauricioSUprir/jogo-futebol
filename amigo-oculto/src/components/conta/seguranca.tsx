"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, KeyRound, ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { MensagemResultado, erroDoCampo } from "@/components/contas/partes";
import { salvarContaConvidado } from "@/lib/acoes/contas";
import { alterarEmail, alterarSenha } from "@/lib/acoes/perfil";
import { useAcaoFormulario } from "@/components/conta/usar-acao";

/** Convidado (login anônimo) vira conta completa com e-mail e senha — mantém grupos, lista e mensagens. */
export function SalvarContaConvidado() {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState("");
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);
  const { estado, enviando, aoEnviar } = useAcaoFormulario(salvarContaConvidado, (r) => r.ok && router.refresh());
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        const senha = new FormData(e.currentTarget).get("senha");
        if (senha !== confirmar) {
          e.preventDefault();
          setErroConfirmar("As senhas não conferem.");
          return;
        }
        setErroConfirmar(null);
        aoEnviar(e);
      }}
    >
      <Campo name="email" type="email" rotulo="E-mail" autoComplete="email" inputMode="email" required erro={erroDoCampo(estado, "email")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          name="senha"
          type="password"
          rotulo="Crie uma senha"
          autoComplete="new-password"
          required
          dica="Pelo menos 8 caracteres, com letras e números."
          erro={erroDoCampo(estado, "senha")}
        />
        <Campo
          type="password"
          rotulo="Repita a senha"
          autoComplete="new-password"
          required
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          erro={erroConfirmar}
        />
      </div>
      <MensagemResultado estado={estado} />
      <Botao type="submit" variante="ouro" tamanho="g" carregando={enviando} className="sm:self-start">
        <ShieldCheck className="size-5" aria-hidden /> Salvar minha conta
      </Botao>
    </form>
  );
}

export function TrocarEmail({ atual, pendente }: { atual: string; pendente: string | null }) {
  const { estado, enviando, aoEnviar } = useAcaoFormulario(alterarEmail);
  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-3">
      <p className="text-sm">
        E-mail atual: <strong className="break-all">{atual}</strong>
      </p>
      {pendente ? (
        <p className="rounded-2xl bg-ouro/12 px-3 py-2 text-sm text-ouro-escuro dark:text-ouro-claro">
          Aguardando confirmação de <strong className="break-all">{pendente}</strong>. Abra o link que enviamos.
        </p>
      ) : null}
      <Campo
        name="email"
        type="email"
        rotulo={
          <span className="inline-flex items-center gap-1.5">
            <AtSign className="size-4" aria-hidden /> Novo e-mail
          </span>
        }
        autoComplete="email"
        inputMode="email"
        required
        erro={erroDoCampo(estado, "email")}
      />
      <MensagemResultado estado={estado} />
      <Botao type="submit" variante="contorno" carregando={enviando} className="self-start">
        Trocar e-mail
      </Botao>
    </form>
  );
}

export function TrocarSenha({ temSenha }: { temSenha: boolean }) {
  const { estado, enviando, aoEnviar } = useAcaoFormulario(alterarSenha, (r, form) => r.ok && form.reset());
  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-3">
      {temSenha ? (
        <Campo name="atual" type="password" rotulo="Senha atual" autoComplete="current-password" required erro={erroDoCampo(estado, "atual")} />
      ) : (
        <p className="text-sm text-suave">Você entra com o Google. Se quiser, crie uma senha para entrar também com e-mail.</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo
          name="nova"
          type="password"
          rotulo={
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="size-4" aria-hidden /> {temSenha ? "Nova senha" : "Senha"}
            </span>
          }
          autoComplete="new-password"
          required
          dica="Pelo menos 8 caracteres, com letras e números."
          erro={erroDoCampo(estado, "nova")}
        />
        <Campo name="confirmar" type="password" rotulo="Repita a senha" autoComplete="new-password" required erro={erroDoCampo(estado, "confirmar")} />
      </div>
      <MensagemResultado estado={estado} />
      <Botao type="submit" variante="contorno" carregando={enviando} className="self-start">
        {temSenha ? "Trocar senha" : "Criar senha"}
      </Botao>
    </form>
  );
}
