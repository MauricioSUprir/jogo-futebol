"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, LogIn, ShieldCheck, Sparkles, UserPlus, UserRound, XCircle } from "lucide-react";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { useAvisos } from "@/components/ui/avisos";
import { participarDoGrupo } from "@/lib/acoes/eventos";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { esquemaNomeConvidado } from "@/lib/validacao/evento";
import { mensagemDeErro } from "@/lib/erros";

type Status = "approved" | "pending" | "rejected" | null;

/**
 * Ações do convite: participar (logado), pedir para entrar (com aprovação), entrar/criar conta ou participar sem
 * cadastro (sessão de convidado segura no próprio aparelho, que dá para salvar como conta depois).
 */
export function EntrarNoGrupo({
  codigo,
  eventoId,
  logado,
  meuStatus,
  aceitando,
  precisaAprovacao,
  convidadoLigado,
}: {
  codigo: string;
  eventoId: string;
  logado: boolean;
  meuStatus: Status;
  aceitando: boolean;
  precisaAprovacao: boolean;
  convidadoLigado: boolean;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [status, setStatus] = useState<Status>(meuStatus);
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [modoConvidado, setModoConvidado] = useState(false);
  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const proximo = encodeURIComponent(`/convite/${codigo}`);

  async function entrarNoGrupo() {
    const r = await participarDoGrupo(codigo, precisaAprovacao ? mensagem : null);
    if (!r.ok) {
      setErro(r.erro);
      avisar(r.erro, "erro");
      router.refresh();
      return;
    }
    if (r.dados?.status === "approved") {
      avisar("Você entrou no grupo!");
      router.push(`/grupo/${r.dados.eventoId}`);
      router.refresh();
    } else if (r.dados?.status === "pending") {
      setStatus("pending");
      router.refresh();
    } else if (r.dados?.status === "rejected") {
      setStatus("rejected");
    }
  }

  function participar(e?: FormEvent) {
    e?.preventDefault();
    setErro(null);
    iniciar(entrarNoGrupo);
  }

  function participarComoConvidado(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = esquemaNomeConvidado.safeParse(nome);
    if (!v.success) {
      setErroNome(v.error.issues[0]?.message ?? "Digite seu nome.");
      return;
    }
    setErroNome(null);
    iniciar(async () => {
      const supabase = clienteNavegador();
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: v.data } } });
      if (error) {
        const texto = /disabled|not allowed/i.test(error.message)
          ? "A participação sem cadastro está desligada no momento. Entre ou crie uma conta."
          : /rate|too many/i.test(error.message)
            ? "Muitas tentativas agora. Espere um pouco e tente de novo."
            : mensagemDeErro(error, "Não foi possível criar a sua sessão de convidado.");
        setErro(texto);
        return;
      }
      await entrarNoGrupo();
    });
  }

  if (status === "approved") {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm font-medium text-esmeralda" role="status">
          <ShieldCheck className="size-4 shrink-0" aria-hidden /> Você já participa deste amigo oculto.
        </p>
        <BotaoLink href={`/grupo/${eventoId}`} tamanho="g" className="w-full">
          Ir para a sala <ArrowRight className="size-5" aria-hidden />
        </BotaoLink>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-3" role="status">
        <div className="flex items-start gap-3 rounded-2xl bg-ouro/12 px-4 py-4">
          <Clock3 className="mt-0.5 size-5 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
          <div>
            <p className="font-semibold">Pedido enviado!</p>
            <p className="text-sm text-suave">
              O organizador precisa aprovar a sua entrada. Você recebe uma notificação assim que ele responder.
            </p>
          </div>
        </div>
        <BotaoLink href="/painel" variante="vidro" className="w-full">
          Ir para o meu painel
        </BotaoLink>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi" role="status">
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> Seu pedido para entrar neste grupo não foi aprovado.
      </p>
    );
  }
  if (!aceitando) return null;

  const rotuloBotao = precisaAprovacao ? "Pedir para entrar" : "Participar";
  const erroVisivel = erro ? (
    <p role="alert" className="rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi">
      {erro}
    </p>
  ) : null;

  if (logado) {
    return (
      <form onSubmit={participar} className="flex flex-col gap-3">
        {precisaAprovacao ? (
          <AreaTexto
            rotulo="Mensagem para o organizador"
            opcional
            placeholder="Ex.: Oi! Sou a prima da Ana."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value.slice(0, 300))}
            dica={`${mensagem.length}/300 · Ajuda o organizador a saber quem é você.`}
            rows={2}
          />
        ) : null}
        {erroVisivel}
        <Botao type="submit" tamanho="g" variante="ouro" carregando={pendente} brilho className="w-full">
          {pendente ? null : <Sparkles className="size-5" aria-hidden />}
          {rotuloBotao}
        </Botao>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {modoConvidado ? (
        <form onSubmit={participarComoConvidado} className="flex flex-col gap-3 rounded-2xl border border-borda p-4" noValidate>
          <Campo
            rotulo="Como você quer aparecer no grupo?"
            placeholder="Seu nome"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            erro={erroNome}
            autoFocus
            required
          />
          {precisaAprovacao ? (
            <AreaTexto
              rotulo="Mensagem para o organizador"
              opcional
              placeholder="Ex.: Oi! Sou a prima da Ana."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value.slice(0, 300))}
              rows={2}
            />
          ) : null}
          <p className="flex items-start gap-2 text-xs text-suave">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-esmeralda" aria-hidden />
            <span>
              Criamos uma sessão segura só neste aparelho, sem e-mail nem senha. Depois, em Minha conta, você pode salvá-la
              como conta para não perder seus grupos se trocar de celular.
            </span>
          </p>
          {erroVisivel}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Botao type="submit" tamanho="g" variante="ouro" carregando={pendente} className="w-full sm:flex-1">
              {precisaAprovacao ? "Pedir para entrar" : "Entrar no grupo"}
            </Botao>
            <Botao variante="fantasma" onClick={() => setModoConvidado(false)} disabled={pendente} className="sm:h-14">
              Voltar
            </Botao>
          </div>
        </form>
      ) : (
        <>
          {convidadoLigado ? (
            <Botao tamanho="g" variante="ouro" brilho onClick={() => setModoConvidado(true)} className="w-full">
              <UserRound className="size-5" aria-hidden /> Participar sem cadastro
            </Botao>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <BotaoLink href={`/entrar?proximo=${proximo}`} variante={convidadoLigado ? "contorno" : "primario"} tamanho="g">
              <LogIn className="size-5" aria-hidden /> Entrar para participar
            </BotaoLink>
            <BotaoLink href={`/cadastro?proximo=${proximo}`} variante="contorno" tamanho="g">
              <UserPlus className="size-5" aria-hidden /> Criar conta
            </BotaoLink>
          </div>
          {convidadoLigado ? (
            <p className="text-center text-xs text-suave">
              Sem cadastro: só seu nome, numa sessão segura neste aparelho. Dá para salvar como conta depois.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
