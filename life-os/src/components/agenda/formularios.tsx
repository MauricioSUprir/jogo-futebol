"use client";
import { useActionState, useEffect, useState } from "react";
import { salvarEvento, salvarTarefa } from "@/acoes/agenda";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao } from "@/components/ui";
import { BotaoEnvio, useFecharDialogo, manterValores } from "@/components/cliente";
import { CATEGORIAS_EVENTO, PRIORIDADES } from "@/lib/catalogo";
import { cn } from "@/lib/cn";

export interface EventoInicial {
  id: string;
  titulo: string;
  categoria: string;
  dia: string;
  diaFim?: string;
  diaInteiro: boolean;
  inicio?: string;
  fim?: string;
  local?: string;
  notas?: string;
  repetir: string;
  repetirAte?: string;
}

function useFecharNoSucesso(ok: string | undefined) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (ok) fechar();
  }, [ok, fechar]);
}

export function FormEvento({ dia, inicial, categoria }: { dia: string; inicial?: EventoInicial; categoria?: string }) {
  const [estado, acao] = useActionState(salvarEvento, undefined);
  const [diaInteiro, setDiaInteiro] = useState(inicial?.diaInteiro ?? false);
  const [repetir, setRepetir] = useState(inicial?.repetir ?? "nenhuma");
  const [categ, setCateg] = useState(inicial?.categoria ?? categoria ?? "compromisso");
  useFecharNoSucesso(estado?.ok);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Título" htmlFor="ev-titulo">
        <Entrada id="ev-titulo" name="titulo" required maxLength={120} defaultValue={inicial?.titulo} placeholder="Ex.: Prova de Matemática" autoFocus />
      </Campo>
      <Campo rotulo="Categoria" htmlFor="ev-cat">
        <Selecao
          id="ev-cat"
          name="categoria"
          value={categ}
          onChange={(e) => {
            setCateg(e.target.value);
            if (e.target.value === "aniversario") {
              setDiaInteiro(true);
              setRepetir("anual");
            }
          }}
        >
          {Object.entries(CATEGORIAS_EVENTO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.nome}
            </option>
          ))}
        </Selecao>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data" htmlFor="ev-dia">
          <Entrada id="ev-dia" name="dia" type="date" required defaultValue={inicial?.dia ?? dia} />
        </Campo>
        <label className="mt-6 flex items-center gap-2 text-sm text-suave">
          <input type="checkbox" name="diaInteiro" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />
          Dia inteiro
        </label>
      </div>
      {diaInteiro ? (
        <Campo rotulo="Até (opcional, para eventos de vários dias)" htmlFor="ev-diafim">
          <Entrada id="ev-diafim" name="diaFim" type="date" defaultValue={inicial?.diaFim} />
        </Campo>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início" htmlFor="ev-ini">
            <Entrada id="ev-ini" name="inicio" type="time" required defaultValue={inicial?.inicio ?? "09:00"} />
          </Campo>
          <Campo rotulo="Fim" htmlFor="ev-fim">
            <Entrada id="ev-fim" name="fim" type="time" defaultValue={inicial?.fim ?? "10:00"} />
          </Campo>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Repetir" htmlFor="ev-rep">
          <Selecao id="ev-rep" name="repetir" value={repetir} onChange={(e) => setRepetir(e.target.value)}>
            <option value="nenhuma">Não repete</option>
            <option value="diaria">Todo dia</option>
            <option value="semanal">Toda semana</option>
            <option value="mensal">Todo mês</option>
            <option value="anual">Todo ano</option>
          </Selecao>
        </Campo>
        {repetir !== "nenhuma" && (
          <Campo rotulo="Até (opcional)" htmlFor="ev-rep-ate">
            <Entrada id="ev-rep-ate" name="repetirAte" type="date" defaultValue={inicial?.repetirAte} />
          </Campo>
        )}
      </div>
      <Campo rotulo="Local (opcional)" htmlFor="ev-local">
        <Entrada id="ev-local" name="local" maxLength={120} defaultValue={inicial?.local} />
      </Campo>
      <Campo rotulo="Anotações (opcional)" htmlFor="ev-notas">
        <AreaTexto id="ev-notas" name="notas" maxLength={2000} defaultValue={inicial?.notas} />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar alterações" : "Criar evento"}</BotaoEnvio>
    </form>
  );
}

export interface TarefaInicial {
  id: string;
  titulo: string;
  duracao: number;
  prioridade: number;
  prazo?: string;
  notas?: string;
  dia?: string;
  hora?: string;
}

const DURACOES = [15, 25, 30, 45, 60, 90, 120];

export function FormTarefa({ dia, inicial }: { dia: string; inicial?: TarefaInicial }) {
  const [estado, acao] = useActionState(salvarTarefa, undefined);
  const [prioridade, setPrioridade] = useState(inicial?.prioridade ?? 2);
  const [comHorario, setComHorario] = useState(!!inicial?.hora);
  useFecharNoSucesso(estado?.ok);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Tarefa" htmlFor="tf-titulo">
        <Entrada id="tf-titulo" name="titulo" required maxLength={120} defaultValue={inicial?.titulo} placeholder="Ex.: Revisar frações" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Duração (min)" htmlFor="tf-dur">
          <Entrada id="tf-dur" name="duracao" type="number" min={5} max={600} step={5} required defaultValue={inicial?.duracao ?? 30} list="tf-duracoes" inputMode="numeric" />
          <datalist id="tf-duracoes">
            {DURACOES.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Prazo (opcional)" htmlFor="tf-prazo">
          <Entrada id="tf-prazo" name="prazo" type="date" defaultValue={inicial?.prazo} />
        </Campo>
      </div>
      <fieldset className="grid grid-cols-1 gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-suave">Prioridade</legend>
        <input type="hidden" name="prioridade" value={prioridade} />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={prioridade === p}
              onClick={() => setPrioridade(p)}
              className={cn(
                "h-10 rounded-xl border text-sm transition",
                prioridade === p ? "border-eletrico bg-eletrico/15 text-texto" : "border-borda text-suave hover:text-texto",
              )}
            >
              {PRIORIDADES[p]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-suave">
        <input type="checkbox" checked={comHorario} onChange={(e) => setComHorario(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />
        Marcar um horário agora (senão o planejador encaixa)
      </label>
      {comHorario && (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia" htmlFor="tf-dia">
            <Entrada id="tf-dia" name="dia" type="date" required defaultValue={inicial?.dia ?? dia} />
          </Campo>
          <Campo rotulo="Hora" htmlFor="tf-hora">
            <Entrada id="tf-hora" name="hora" type="time" required defaultValue={inicial?.hora ?? "15:00"} />
          </Campo>
        </div>
      )}
      <Campo rotulo="Anotações (opcional)" htmlFor="tf-notas">
        <AreaTexto id="tf-notas" name="notas" maxLength={2000} defaultValue={inicial?.notas} />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar alterações" : "Criar tarefa"}</BotaoEnvio>
    </form>
  );
}
