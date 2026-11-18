"use client";
// Formulários do Mind Center: entradas do diário, coisas boas e a senha extra.
import { useActionState, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  apagarDiario,
  destrancarDiario,
  ligarSenhaDiario,
  salvarCoisasBoas,
  salvarEntrada,
  tirarSenhaDiario,
  trocarSenhaDiario,
} from "@/acoes/mente";
import { PERGUNTAS_GUIA, TIPOS_DIARIO, type TipoDiario } from "@/lib/mente";
import type { Estado } from "@/acoes/tipos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { cn } from "@/lib/cn";

function useFecharNoOk(estado: Estado) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
}

function Retorno({ estado }: { estado: Estado }) {
  if (estado?.erro) return <Mensagem tipo="erro">{estado.erro}</Mensagem>;
  if (estado?.ok) return <Mensagem tipo="ok">{estado.ok}</Mensagem>;
  return null;
}

export interface EntradaInicial {
  id: string;
  dia: string;
  tipo: TipoDiario;
  titulo: string | null;
  texto: string;
}

/** Nova entrada ou edição. Com `comPerguntas`, mostra as perguntas-guia da reflexão. */
export function FormEntrada({
  hoje,
  inicial,
  tipoInicial = "diario",
  comPerguntas,
  idPrefixo = "en",
}: {
  hoje: string;
  inicial?: EntradaInicial;
  tipoInicial?: TipoDiario;
  comPerguntas?: boolean;
  idPrefixo?: string;
}) {
  const [estado, acao] = useActionState(salvarEntrada, undefined);
  const [tipo, setTipo] = useState<TipoDiario>(inicial?.tipo ?? tipoInicial);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  useFecharNoOk(estado);
  const p = idPrefixo;
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Tipo" htmlFor={`${p}-tipo`}>
          <Selecao id={`${p}-tipo`} name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDiario)}>
            {Object.entries(TIPOS_DIARIO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Dia" htmlFor={`${p}-dia`}>
          <Entrada id={`${p}-dia`} name="dia" type="date" max={hoje} defaultValue={inicial?.dia ?? hoje} />
        </Campo>
      </div>
      {comPerguntas && tipo === "reflexao" && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-suave">Perguntas-guia (opcional)</p>
          <div className="flex flex-wrap gap-1.5">
            {PERGUNTAS_GUIA.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTitulo(q)}
                aria-pressed={titulo === q}
                className={cn(
                  "rounded-full border px-3 py-1 text-left text-xs transition",
                  titulo === q ? "border-violeta bg-violeta/20 text-texto" : "border-borda text-suave hover:text-texto",
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <Campo rotulo="Título (opcional)" htmlFor={`${p}-titulo`}>
        <Entrada id={`${p}-titulo`} name="titulo" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </Campo>
      <Campo rotulo="Texto" htmlFor={`${p}-texto`} dica="Só você lê. Fica cifrado no servidor.">
        <AreaTexto id={`${p}-texto`} name="texto" required maxLength={20_000} defaultValue={inicial?.texto} className="min-h-36" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar alterações" : "Salvar no diário"}</BotaoEnvio>
    </form>
  );
}

/** "3 coisas boas do dia" (entrada rápida). */
export function FormCoisasBoas({ hoje }: { hoje: string }) {
  const [estado, acao] = useActionState(salvarCoisasBoas, undefined);
  const [chave, setChave] = useState(0);
  useEffect(() => {
    if (estado?.ok) setChave((k) => k + 1); // limpa os campos depois de salvar
  }, [estado]);
  return (
    <form key={chave} action={acao} onReset={manterValores} className="grid grid-cols-1 gap-2">
      <input type="hidden" name="dia" value={hoje} />
      {[1, 2, 3].map((n) => (
        <Entrada key={n} name="coisa" maxLength={300} placeholder={`${n}. Uma coisa boa de hoje`} aria-label={`Coisa boa ${n}`} />
      ))}
      <Retorno estado={estado} />
      <BotaoEnvio variante="secundario" pendente="Guardando…">
        Guardar coisas boas
      </BotaoEnvio>
    </form>
  );
}

export function FormDestrancar() {
  const [estado, acao] = useActionState(destrancarDiario, undefined);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Senha do diário" htmlFor="di-senha">
        <Entrada id="di-senha" name="senha" type="password" autoComplete="current-password" required autoFocus />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Abrindo…">Destrancar</BotaoEnvio>
    </form>
  );
}

function AvisoSemVolta() {
  return (
    <p className="flex gap-2 rounded-xl border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm text-[#fde68a]">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Esquecendo esta senha, as entradas do diário <strong>não voltam</strong>: nem o servidor consegue abri-las. Anote num lugar seguro.
      </span>
    </p>
  );
}

export function FormLigarSenha() {
  const [estado, acao] = useActionState(ligarSenhaDiario, undefined);
  useFecharNoOk(estado);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <p className="text-sm text-suave">
        Com a senha extra, a chave do diário sai da senha: sem ela, o texto não abre — nem para quem tiver acesso ao banco. O humor, a energia e o
        estresse continuam fora da senha (são as estatísticas).
      </p>
      <AvisoSemVolta />
      <Campo rotulo="Senha do diário" htmlFor="ds-senha" dica="Diferente da senha da conta. Pelo menos 10 caracteres, misturando letras e números.">
        <Entrada id="ds-senha" name="senha" type="password" autoComplete="new-password" required minLength={10} />
      </Campo>
      <Campo rotulo="Confirme a senha" htmlFor="ds-confirma">
        <Entrada id="ds-confirma" name="confirma" type="password" autoComplete="new-password" required />
      </Campo>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="entendi" value="1" required className="mt-0.5 h-4 w-4 accent-[#2563eb]" />
        <span>Entendi: sem a senha, as entradas não podem ser recuperadas.</span>
      </label>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Cifrando o diário…">Ligar senha extra</BotaoEnvio>
    </form>
  );
}

export function FormTrocarSenha() {
  const [estado, acao] = useActionState(trocarSenhaDiario, undefined);
  useFecharNoOk(estado);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Senha atual do diário" htmlFor="dt-atual">
        <Entrada id="dt-atual" name="atual" type="password" autoComplete="current-password" required />
      </Campo>
      <Campo rotulo="Nova senha" htmlFor="dt-nova">
        <Entrada id="dt-nova" name="nova" type="password" autoComplete="new-password" required minLength={10} />
      </Campo>
      <Campo rotulo="Confirme a nova senha" htmlFor="dt-confirma">
        <Entrada id="dt-confirma" name="confirma" type="password" autoComplete="new-password" required />
      </Campo>
      <AvisoSemVolta />
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Recifrando…">Trocar senha</BotaoEnvio>
    </form>
  );
}

export function FormTirarSenha() {
  const [estado, acao] = useActionState(tirarSenhaDiario, undefined);
  useFecharNoOk(estado);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <p className="text-sm text-suave">O diário continua cifrado, com a chave do servidor, e não pede mais senha para abrir.</p>
      <Campo rotulo="Senha atual do diário" htmlFor="dx-atual">
        <Entrada id="dx-atual" name="atual" type="password" autoComplete="current-password" required />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio variante="secundario" pendente="Recifrando…">
        Tirar a senha extra
      </BotaoEnvio>
    </form>
  );
}

export function FormApagarDiario() {
  const [estado, acao] = useActionState(apagarDiario, undefined);
  useFecharNoOk(estado);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3">
      <p className="text-sm text-suave">
        Apaga <strong className="text-texto">todas</strong> as entradas do diário e a senha extra. Os check-ins de humor, energia e estresse ficam.
        Não dá para desfazer.
      </p>
      <Campo rotulo='Digite "APAGAR" para confirmar' htmlFor="da-conf">
        <Entrada id="da-conf" name="confirmacao" required autoComplete="off" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio variante="perigo" pendente="Apagando…">
        Apagar o diário e recomeçar
      </BotaoEnvio>
    </form>
  );
}
