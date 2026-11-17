"use client";
import { useActionState } from "react";
import { ShieldCheck, ShieldOff, KeyRound, Copy } from "lucide-react";
import {
  confirmarDoisFatores,
  desligarDoisFatores,
  iniciarDoisFatores,
  novosCodigosRecuperacao,
  salvarPerfil,
  trocarSenha,
  type EstadoDoisFatores,
} from "@/acoes/conta";
import { Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores } from "../cliente";

export function FormPerfil({ nome, fuso, inicio, fim, fusos }: { nome: string; fuso: string; inicio: string; fim: string; fusos: string[] }) {
  const [estado, acao] = useActionState(salvarPerfil, undefined);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      <Campo rotulo="Nome" htmlFor="p-nome">
        <Entrada id="p-nome" name="nome" required maxLength={60} defaultValue={nome} />
      </Campo>
      <Campo rotulo="Fuso horário" htmlFor="p-fuso" dica="Define o que é 'hoje' para água, hábitos e agenda.">
        <Selecao id="p-fuso" name="fuso" defaultValue={fuso}>
          {fusos.map((f) => (
            <option key={f} value={f}>
              {f.replaceAll("_", " ")}
            </option>
          ))}
        </Selecao>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Meu dia começa" htmlFor="p-ini">
          <Entrada id="p-ini" name="inicioDia" type="time" required defaultValue={inicio} />
        </Campo>
        <Campo rotulo="Meu dia termina" htmlFor="p-fim">
          <Entrada id="p-fim" name="fimDia" type="time" required defaultValue={fim} />
        </Campo>
      </div>
      <p className="-mt-2 text-xs text-apagado">O planejamento automático só encaixa tarefas dentro dessa janela (o resto é descanso).</p>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
      <BotaoEnvio className="justify-self-start" pendente="Salvando…">Salvar perfil</BotaoEnvio>
    </form>
  );
}

export function FormSenha() {
  const [estado, acao] = useActionState(trocarSenha, undefined);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Senha atual" htmlFor="s-atual">
        <Entrada id="s-atual" name="atual" type="password" autoComplete="current-password" required />
      </Campo>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Nova senha" htmlFor="s-nova">
          <Entrada id="s-nova" name="nova" type="password" autoComplete="new-password" required minLength={10} />
        </Campo>
        <Campo rotulo="Confirme a nova senha" htmlFor="s-conf">
          <Entrada id="s-conf" name="confirma" type="password" autoComplete="new-password" required minLength={10} />
        </Campo>
      </div>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
      <BotaoEnvio className="justify-self-start" variante="secundario" pendente="Trocando…">
        <KeyRound className="h-4 w-4" /> Trocar senha
      </BotaoEnvio>
    </form>
  );
}

function ListaCodigos({ codigos }: { codigos: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <Mensagem tipo="info">
        Guarde estes códigos num lugar seguro (fora do celular). Cada um entra uma vez se você perder o autenticador. Eles não aparecem de novo.
      </Mensagem>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-borda bg-fundo-2/80 p-3 font-mono text-sm" data-testid="codigos-recuperacao">
        {codigos.map((c) => (
          <li key={c} className="numero tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <button type="button" className={classesBotao("secundario", "p", "justify-self-start")} onClick={() => navigator.clipboard?.writeText(codigos.join("\n"))}>
        <Copy className="h-4 w-4" /> Copiar códigos
      </button>
    </div>
  );
}

export function DoisFatores({ ligado, codigosRestantes }: { ligado: boolean; codigosRestantes: number }) {
  // Uma máquina só: "iniciar" gera o segredo e o QR; "confirmar" confere o código e mostra os códigos de recuperação.
  const [conf, passo, iniciando] = useActionState(
    async (prev: EstadoDoisFatores, fd: FormData): Promise<EstadoDoisFatores> =>
      fd.get("passo") === "iniciar" ? iniciarDoisFatores() : confirmarDoisFatores(prev, fd),
    { etapa: "inicio" } as EstadoDoisFatores,
  );
  const [desl, desligar] = useActionState(desligarDoisFatores, undefined);
  const [novos, gerarNovos] = useActionState(novosCodigosRecuperacao, undefined);

  if (conf.etapa === "codigos") {
    return (
      <div className="grid grid-cols-1 gap-3">
        <Mensagem tipo="ok">Verificação em duas etapas ligada.</Mensagem>
        <ListaCodigos codigos={conf.codigos} />
      </div>
    );
  }

  if (ligado) {
    return (
      <div className="grid grid-cols-1 gap-5">
        <p className="flex items-center gap-2 text-sm text-ok">
          <ShieldCheck className="h-4 w-4" /> Ligada · {codigosRestantes} código(s) de recuperação sem uso
        </p>
        {novos?.codigos ? (
          <ListaCodigos codigos={novos.codigos} />
        ) : (
          <details className="rounded-xl border border-borda p-3">
            <summary className="cursor-pointer text-sm">Gerar novos códigos de recuperação</summary>
            <form action={gerarNovos} onReset={manterValores} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Campo rotulo="Senha" htmlFor="n-senha">
                <Entrada id="n-senha" name="senha" type="password" autoComplete="current-password" required />
              </Campo>
              <Campo rotulo="Código do app" htmlFor="n-cod">
                <Entrada id="n-cod" name="codigo" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" />
              </Campo>
              <BotaoEnvio variante="secundario" pendente="Gerando…">Gerar</BotaoEnvio>
              {novos?.erro && <div className="sm:col-span-3"><Mensagem tipo="erro">{novos.erro}</Mensagem></div>}
            </form>
          </details>
        )}
        <details className="rounded-xl border border-perigo/30 p-3">
          <summary className="cursor-pointer text-sm text-[#fda4af]">Desligar a verificação em duas etapas</summary>
          <form action={desligar} onReset={manterValores} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Campo rotulo="Senha" htmlFor="d-senha">
              <Entrada id="d-senha" name="senha" type="password" autoComplete="current-password" required />
            </Campo>
            <Campo rotulo="Código do app" htmlFor="d-cod">
              <Entrada id="d-cod" name="codigo" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" />
            </Campo>
            <BotaoEnvio variante="perigo" pendente="Desligando…">
              <ShieldOff className="h-4 w-4" /> Desligar
            </BotaoEnvio>
            {desl?.erro && <div className="sm:col-span-3"><Mensagem tipo="erro">{desl.erro}</Mensagem></div>}
          </form>
        </details>
      </div>
    );
  }

  if (desl?.ok) return <Mensagem tipo="ok">{desl.ok}</Mensagem>;

  if (conf.etapa === "configurar") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
        <div
          className="mx-auto w-44 overflow-hidden rounded-xl bg-[#f8fafc] p-2 sm:w-full"
          role="img"
          aria-label="QR code para o app autenticador"
          dangerouslySetInnerHTML={{ __html: conf.qr }}
        />
        <div className="grid grid-cols-1 gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-suave">
            <li>Abra um app autenticador (Apple Senhas, Google Authenticator, Authy, 1Password…).</li>
            <li>Leia o QR code ou digite a chave abaixo.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          <p className="break-all rounded-lg border border-borda bg-fundo-2/80 px-3 py-2 font-mono text-xs tracking-wider" data-testid="segredo-totp">
            {conf.segredo}
          </p>
          <form action={passo} onReset={manterValores} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="passo" value="confirmar" />
            <Campo rotulo="Código" htmlFor="t-cod">
              <Entrada id="t-cod" name="codigo" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" className="w-36 text-center tracking-[0.3em]" />
            </Campo>
            <BotaoEnvio pendente="Conferindo…">Ativar</BotaoEnvio>
          </form>
          {conf.erro && <Mensagem tipo="erro">{conf.erro}</Mensagem>}
        </div>
      </div>
    );
  }

  return (
    <form action={passo} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="passo" value="iniciar" />
      <p className="text-sm text-suave">
        Além da senha, pede um código de 6 dígitos do seu celular a cada login. Recomendado: o LIFE OS guarda dados de saúde.
      </p>
      {conf.etapa === "inicio" && conf.erro && <Mensagem tipo="erro">{conf.erro}</Mensagem>}
      <button className={classesBotao("primario", "m", "justify-self-start")} disabled={iniciando}>
        <ShieldCheck className="h-4 w-4" /> {iniciando ? "Preparando…" : "Ligar verificação em duas etapas"}
      </button>
    </form>
  );
}
