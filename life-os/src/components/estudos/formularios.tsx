"use client";
// Formulários do Study Center (todos em diálogo; fecham sozinhos ao salvar).
import { useActionState, useEffect, useState } from "react";
import { CalendarPlus, Wand2 } from "lucide-react";
import {
  planejarSemana,
  registrarSessao,
  salvarConfigEstudos,
  salvarConteudo,
  salvarDificuldade,
  salvarFlashcard,
  salvarMateria,
  salvarNota,
  salvarProva,
  salvarResumo,
  salvarSimulado,
} from "@/acoes/estudos";
import type { Estado } from "@/acoes/tipos";
import { CORES_HABITO } from "@/lib/catalogo";
import { TIPOS_SESSAO, formatarNota, notaNecessaria, type Nota } from "@/lib/estudos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { cn } from "@/lib/cn";

export interface MateriaOpcao {
  id: string;
  nome: string;
}

function useFechar(estado: Estado) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
}

function Retorno({ estado }: { estado: Estado }) {
  return estado?.erro ? <Mensagem tipo="erro">{estado.erro}</Mensagem> : null;
}

function SelecaoMateria({ id, materias, padrao, obrigatoria }: { id: string; materias: MateriaOpcao[]; padrao?: string | null; obrigatoria?: boolean }) {
  return (
    <Selecao id={id} name="materia" defaultValue={padrao ?? (obrigatoria ? materias[0]?.id : "")} required={obrigatoria}>
      {!obrigatoria && <option value="">Sem matéria</option>}
      {materias.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nome}
        </option>
      ))}
    </Selecao>
  );
}

// ───── Matéria ─────

export function FormMateria({ inicial }: { inicial?: { id: string; nome: string; cor: string; media: number; meta: number } }) {
  const [estado, acao] = useActionState(salvarMateria, undefined);
  const [cor, setCor] = useState(inicial?.cor ?? "azul");
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Nome" htmlFor="mt-nome">
        <Entrada id="mt-nome" name="nome" required maxLength={60} defaultValue={inicial?.nome} placeholder="Ex.: Matemática" autoFocus />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Cor</legend>
        <input type="hidden" name="cor" value={cor} />
        <div className="flex flex-wrap gap-2">
          {Object.entries(CORES_HABITO).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCor(k)}
              aria-pressed={cor === k}
              aria-label={`Cor ${k}`}
              className={cn("h-8 w-8 rounded-full border-2 transition", cor === k ? "border-texto scale-110" : "border-transparent")}
              style={{ background: v }}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Média que quer atingir" htmlFor="mt-media" dica="Escala de 0 a 10.">
          <Entrada id="mt-media" name="media" type="number" inputMode="decimal" min={0} max={10} step={0.1} required defaultValue={inicial?.media ?? 6} />
        </Campo>
        <Campo rotulo="Meta semanal (min)" htmlFor="mt-meta">
          <Entrada id="mt-meta" name="meta" type="number" inputMode="numeric" min={0} max={1500} step={5} required defaultValue={inicial?.meta ?? 120} />
        </Campo>
      </div>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar" : "Criar matéria"}</BotaoEnvio>
    </form>
  );
}

// ───── Prova ou trabalho ─────

export function FormProva({
  materias,
  dia,
  inicial,
}: {
  materias: MateriaOpcao[];
  dia: string;
  inicial?: { id: string; titulo: string; tipo: string; materia: string | null; dia: string; inicio?: string; fim?: string; notas?: string | null };
}) {
  const [estado, acao] = useActionState(salvarProva, undefined);
  const [tipo, setTipo] = useState(inicial?.tipo ?? "prova");
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <div className="flex rounded-xl border border-borda bg-fundo-2/60 p-1" role="radiogroup" aria-label="Tipo">
        {[
          ["prova", "Prova"],
          ["trabalho", "Trabalho"],
        ].map(([v, n]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={tipo === v}
            onClick={() => setTipo(v)}
            className="flex-1 rounded-lg py-1.5 text-sm text-suave aria-checked:bg-eletrico/20 aria-checked:text-texto"
          >
            {n}
          </button>
        ))}
      </div>
      <Campo rotulo="Título" htmlFor="pv-titulo">
        <Entrada id="pv-titulo" name="titulo" required maxLength={120} defaultValue={inicial?.titulo} placeholder={tipo === "prova" ? "Ex.: Prova de frações" : "Ex.: Trabalho de História"} autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Matéria" htmlFor="pv-materia">
          <SelecaoMateria id="pv-materia" materias={materias} padrao={inicial?.materia} />
        </Campo>
        <Campo rotulo={tipo === "prova" ? "Dia da prova" : "Entrega"} htmlFor="pv-dia">
          <Entrada id="pv-dia" name="dia" type="date" required defaultValue={inicial?.dia ?? dia} />
        </Campo>
        <Campo rotulo="Início (opcional)" htmlFor="pv-ini" dica="Vazio = dia inteiro">
          <Entrada id="pv-ini" name="inicio" type="time" defaultValue={inicial?.inicio} />
        </Campo>
        <Campo rotulo="Fim (opcional)" htmlFor="pv-fim">
          <Entrada id="pv-fim" name="fim" type="time" defaultValue={inicial?.fim} />
        </Campo>
      </div>
      <Campo rotulo="Conteúdo e observações" htmlFor="pv-notas">
        <AreaTexto id="pv-notas" name="notas" maxLength={2000} defaultValue={inicial?.notas ?? ""} className="min-h-20" />
      </Campo>
      {!inicial && tipo === "prova" && <p className="text-xs text-apagado">A prova entra na agenda com um checklist pronto (você pode mudar os itens).</p>}
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">
        <CalendarPlus className="h-4 w-4" /> {inicial ? "Salvar" : "Marcar na agenda"}
      </BotaoEnvio>
    </form>
  );
}

// ───── Sessão de estudo (registro manual) ─────

export function FormSessao({ materias, hoje, compacto }: { materias: MateriaOpcao[]; hoje: string; compacto?: boolean }) {
  const [estado, acao] = useActionState(registrarSessao, undefined);
  const [min, setMin] = useState("30");
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Matéria" htmlFor="ss-materia">
          <SelecaoMateria id="ss-materia" materias={materias} padrao={materias[0]?.id ?? ""} />
        </Campo>
        <Campo rotulo="Tipo" htmlFor="ss-tipo">
          <Selecao id="ss-tipo" name="tipo" defaultValue="estudo">
            {Object.entries(TIPOS_SESSAO)
              .filter(([k]) => k !== "pomodoro")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Selecao>
        </Campo>
      </div>
      <Campo rotulo="Minutos" htmlFor="ss-min">
        <Entrada id="ss-min" name="minutos" type="number" inputMode="numeric" min={1} max={600} required value={min} onChange={(e) => setMin(e.target.value)} />
      </Campo>
      <div className="flex flex-wrap gap-1.5" aria-label="Atalhos de duração">
        {[25, 30, 45, 60, 90].map((m) => (
          <button key={m} type="button" onClick={() => setMin(String(m))} className={classesBotao(min === String(m) ? "contorno" : "secundario", "p")}>
            {m} min
          </button>
        ))}
      </div>
      {!compacto && (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia" htmlFor="ss-dia">
            <Entrada id="ss-dia" name="dia" type="date" defaultValue={hoje} max={hoje} />
          </Campo>
          <Campo rotulo="Horário (opcional)" htmlFor="ss-hora" dica="Vazio = agora">
            <Entrada id="ss-hora" name="hora" type="time" />
          </Campo>
        </div>
      )}
      <Campo rotulo="Conteúdo (opcional)" htmlFor="ss-cont">
        <Entrada id="ss-cont" name="conteudo" maxLength={120} placeholder="Ex.: equações do 1º grau" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Registrando…">Registrar estudo</BotaoEnvio>
    </form>
  );
}

// ───── Conteúdo e dificuldade ─────

export function FormConteudo({ materias, materia }: { materias: MateriaOpcao[]; materia?: string }) {
  const [estado, acao] = useActionState(salvarConteudo, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Matéria" htmlFor="ct-materia">
        <SelecaoMateria id="ct-materia" materias={materias} padrao={materia} obrigatoria />
      </Campo>
      <Campo rotulo="Conteúdo" htmlFor="ct-titulo">
        <Entrada id="ct-titulo" name="titulo" required maxLength={120} placeholder="Ex.: Frações" autoFocus />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Adicionar conteúdo</BotaoEnvio>
    </form>
  );
}

export function FormDificuldade({ id, dificil, nota }: { id: string; dificil: boolean; nota: string | null }) {
  const [estado, acao] = useActionState(salvarDificuldade, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="dificil" defaultChecked={dificil} className="h-4 w-4 accent-[#7c3aed]" /> Tenho dificuldade neste conteúdo
      </label>
      <Campo rotulo="O que está difícil (opcional)" htmlFor="df-nota">
        <AreaTexto id="df-nota" name="nota" maxLength={500} defaultValue={nota ?? ""} className="min-h-20" placeholder="Ex.: não entendi a regra de sinais" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Salvar</BotaoEnvio>
    </form>
  );
}

// ───── Flashcard ─────

export function FormFlashcard({ materias, inicial }: { materias: MateriaOpcao[]; inicial?: { id: string; materia: string | null; frente: string; verso: string } }) {
  const [estado, acao] = useActionState(salvarFlashcard, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Matéria" htmlFor="fc-materia">
        <SelecaoMateria id="fc-materia" materias={materias} padrao={inicial?.materia ?? materias[0]?.id ?? ""} />
      </Campo>
      <Campo rotulo="Frente (pergunta)" htmlFor="fc-frente">
        <AreaTexto id="fc-frente" name="frente" required maxLength={500} defaultValue={inicial?.frente} className="min-h-16" autoFocus />
      </Campo>
      <Campo rotulo="Verso (resposta)" htmlFor="fc-verso">
        <AreaTexto id="fc-verso" name="verso" required maxLength={1000} defaultValue={inicial?.verso} className="min-h-16" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar" : "Criar cartão"}</BotaoEnvio>
    </form>
  );
}

// ───── Notas ─────

export function FormNota({ materias, materia, hoje }: { materias: MateriaOpcao[]; materia?: string; hoje: string }) {
  const [estado, acao] = useActionState(salvarNota, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Matéria" htmlFor="nt-materia">
          <SelecaoMateria id="nt-materia" materias={materias} padrao={materia} obrigatoria />
        </Campo>
        <Campo rotulo="Avaliação" htmlFor="nt-titulo">
          <Entrada id="nt-titulo" name="titulo" required maxLength={80} placeholder="Ex.: Prova 1" autoFocus />
        </Campo>
        <Campo rotulo="Nota" htmlFor="nt-valor">
          <Entrada id="nt-valor" name="valor" type="number" inputMode="decimal" min={0} step={0.1} required />
        </Campo>
        <Campo rotulo="Nota máxima" htmlFor="nt-max">
          <Entrada id="nt-max" name="maximo" type="number" inputMode="decimal" min={0.1} step={0.1} required defaultValue={10} />
        </Campo>
        <Campo rotulo="Peso" htmlFor="nt-peso">
          <Entrada id="nt-peso" name="peso" type="number" inputMode="decimal" min={0.1} step={0.1} required defaultValue={1} />
        </Campo>
        <Campo rotulo="Data" htmlFor="nt-dia">
          <Entrada id="nt-dia" name="dia" type="date" defaultValue={hoje} />
        </Campo>
      </div>
      <Campo rotulo="Bimestre ou trimestre (opcional)" htmlFor="nt-bim">
        <Entrada id="nt-bim" name="bimestre" maxLength={40} placeholder="Ex.: 4º bimestre" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Registrar nota</BotaoEnvio>
    </form>
  );
}

/** "Quanto falta": média atual e a nota necessária na próxima avaliação, com o peso ajustável. */
export function QuantoFalta({ notas, alvo, idBase }: { notas: Nota[]; alvo: number; idBase: string }) {
  const [peso, setPeso] = useState("1");
  const p = Number(peso.replace(",", "."));
  const r = notaNecessaria(notas, alvo, Number.isFinite(p) && p > 0 ? p : 1);
  const frase =
    r.situacao === "garantido"
      ? "Média garantida: mesmo com 0 na próxima, você fica acima do alvo."
      : r.situacao === "impossivel"
        ? "Com uma avaliação só, não dá para chegar à média. Converse com o professor sobre recuperação ou trabalhos extras."
        : r.situacao === "sem-notas"
          ? "Ainda sem notas: a próxima define a média."
          : "Na próxima avaliação, você precisa de:";
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-borda bg-fundo-2/50 p-3" data-testid={`quanto-falta-${idBase}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-suave">{frase}</p>
        <label className="flex items-center gap-2 text-xs text-suave" htmlFor={`peso-${idBase}`}>
          Peso da próxima
          <Entrada id={`peso-${idBase}`} type="number" inputMode="decimal" min={0.1} step={0.1} value={peso} onChange={(e) => setPeso(e.target.value)} className="h-8 w-16 px-2 text-center" />
        </label>
      </div>
      {r.situacao !== "impossivel" && r.situacao !== "garantido" && (
        <p className="numero font-display text-2xl font-bold" data-testid="nota-necessaria">
          {formatarNota(r.necessaria)}
        </p>
      )}
    </div>
  );
}

// ───── Simulados e resumos ─────

export function FormSimulado({ materias, hoje }: { materias: MateriaOpcao[]; hoje: string }) {
  const [estado, acao] = useActionState(salvarSimulado, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Título" htmlFor="sm-titulo">
        <Entrada id="sm-titulo" name="titulo" required maxLength={80} placeholder="Ex.: Simulado de Matemática" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Matéria" htmlFor="sm-materia">
          <SelecaoMateria id="sm-materia" materias={materias} padrao="" />
        </Campo>
        <Campo rotulo="Data" htmlFor="sm-dia">
          <Entrada id="sm-dia" name="dia" type="date" defaultValue={hoje} max={hoje} />
        </Campo>
        <Campo rotulo="Questões" htmlFor="sm-total">
          <Entrada id="sm-total" name="total" type="number" inputMode="numeric" min={1} max={500} required />
        </Campo>
        <Campo rotulo="Acertos" htmlFor="sm-acertos">
          <Entrada id="sm-acertos" name="acertos" type="number" inputMode="numeric" min={0} max={500} required />
        </Campo>
      </div>
      <Campo rotulo="O que errei / revisar (opcional)" htmlFor="sm-notas">
        <AreaTexto id="sm-notas" name="notas" maxLength={1000} className="min-h-16" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Registrar resultado</BotaoEnvio>
    </form>
  );
}

export function FormResumo({ materias, inicial }: { materias: MateriaOpcao[]; inicial?: { id: string; materia: string | null; titulo: string; texto: string } }) {
  const [estado, acao] = useActionState(salvarResumo, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Título" htmlFor="rs-titulo">
          <Entrada id="rs-titulo" name="titulo" required maxLength={120} defaultValue={inicial?.titulo} autoFocus />
        </Campo>
        <Campo rotulo="Matéria" htmlFor="rs-materia">
          <SelecaoMateria id="rs-materia" materias={materias} padrao={inicial?.materia ?? ""} />
        </Campo>
      </div>
      <Campo rotulo="Resumo" htmlFor="rs-texto">
        <AreaTexto id="rs-texto" name="texto" required maxLength={20000} defaultValue={inicial?.texto} className="min-h-48" />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Salvar resumo</BotaoEnvio>
    </form>
  );
}

// ───── Configuração e plano da semana ─────

export function FormConfigEstudos({ foco, curta, longa, cadaLonga, metaTotal, somaMaterias }: { foco: number; curta: number; longa: number; cadaLonga: number; metaTotal: number | null; somaMaterias: number }) {
  const [estado, acao] = useActionState(salvarConfigEstudos, undefined);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Foco (min)" htmlFor="cf-foco">
          <Entrada id="cf-foco" name="foco" type="number" inputMode="numeric" min={5} max={90} required defaultValue={foco} />
        </Campo>
        <Campo rotulo="Pausa curta (min)" htmlFor="cf-curta">
          <Entrada id="cf-curta" name="curta" type="number" inputMode="numeric" min={1} max={30} required defaultValue={curta} />
        </Campo>
        <Campo rotulo="Pausa longa (min)" htmlFor="cf-longa">
          <Entrada id="cf-longa" name="longa" type="number" inputMode="numeric" min={5} max={60} required defaultValue={longa} />
        </Campo>
        <Campo rotulo="Pausa longa a cada" htmlFor="cf-cada" dica="focos">
          <Entrada id="cf-cada" name="cadaLonga" type="number" inputMode="numeric" min={2} max={8} required defaultValue={cadaLonga} />
        </Campo>
      </div>
      <Campo rotulo="Meta semanal total (min)" htmlFor="cf-meta" dica={`Vazio = soma das matérias (${somaMaterias} min).`}>
        <Entrada id="cf-meta" name="metaTotal" type="number" inputMode="numeric" min={0} max={5000} defaultValue={metaTotal ?? ""} />
      </Campo>
      <Retorno estado={estado} />
      <BotaoEnvio pendente="Salvando…">Salvar</BotaoEnvio>
    </form>
  );
}

export function BotaoPlanejarSemana() {
  const [estado, acao] = useActionState(planejarSemana, undefined);
  return (
    <form action={acao} className="grid grid-cols-1 gap-2">
      <BotaoEnvio variante="contorno" pendente="Planejando…">
        <Wand2 className="h-4 w-4" /> Planejar a semana na agenda
      </BotaoEnvio>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
    </form>
  );
}
