"use client";
// Formulários do Goals Center (em diálogo; fecham sozinhos ao salvar).
import { useActionState, useEffect, useState } from "react";
import { adicionarEtapa, registrarProgresso, salvarMeta } from "@/acoes/metas";
import type { Estado } from "@/acoes/tipos";
import { CATEGORIAS_META, PRIORIDADES_META } from "@/lib/metas";
import { AreaTexto, Campo, Entrada, Mensagem } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { ICONES_CATEGORIA } from "./icones";
import { cn } from "@/lib/cn";

function useFechar(estado: Estado) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
}

export interface MetaInicial {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string | null;
  porque: string | null;
  prazo: string | null;
  ano: number | null;
  prioridade: number;
  medida: string;
  alvo: number | null;
  unidade: string | null;
}

function Segmentos({ nome, opcoes, valor, aoMudar, rotulo }: { nome: string; opcoes: [string, string][]; valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-suave">{rotulo}</legend>
      <input type="hidden" name={nome} value={valor} />
      <div className="flex rounded-xl border border-borda bg-fundo-2/60 p-1" role="radiogroup" aria-label={rotulo}>
        {opcoes.map(([v, n]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valor === v}
            onClick={() => aoMudar(v)}
            className="flex-1 rounded-lg py-1.5 text-sm text-suave aria-checked:bg-eletrico/20 aria-checked:text-texto"
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FormMeta({ inicial, ano, categoria }: { inicial?: MetaInicial; ano: number; categoria?: string }) {
  const [estado, acao] = useActionState(salvarMeta, undefined);
  const [cat, setCat] = useState(inicial?.categoria ?? categoria ?? "pessoal");
  const [medida, setMedida] = useState(inicial?.medida ?? "etapas");
  const [prioridade, setPrioridade] = useState(String(inicial?.prioridade ?? 2));
  const [anual, setAnual] = useState(inicial ? inicial.ano !== null : false);
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Meta" htmlFor="mt-titulo">
        <Entrada id="mt-titulo" name="titulo" required maxLength={120} defaultValue={inicial?.titulo} placeholder="Ex.: Fazer 20 gols na temporada" autoFocus />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Categoria</legend>
        <input type="hidden" name="categoria" value={cat} />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Categoria">
          {Object.entries(CATEGORIAS_META).map(([k, c]) => {
            const I = ICONES_CATEGORIA[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={cat === k}
                onClick={() => setCat(k)}
                title={c.nome}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs transition",
                  cat === k ? "border-eletrico bg-eletrico/15 text-texto" : "border-borda text-suave hover:border-borda-forte",
                )}
              >
                <I className="h-4 w-4 shrink-0" style={{ color: c.cor }} aria-hidden />
                <span className="truncate">{c.curto}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <Segmentos nome="prioridade" rotulo="Prioridade" valor={prioridade} aoMudar={setPrioridade} opcoes={Object.entries(PRIORIDADES_META)} />
      {!inicial && (
        <Segmentos
          nome="medida"
          rotulo="Como medir"
          valor={medida}
          aoMudar={setMedida}
          opcoes={[
            ["etapas", "Por etapas"],
            ["numero", "Por número"],
          ]}
        />
      )}
      {inicial && <input type="hidden" name="medida" value={medida} />}
      {medida === "etapas" && !inicial && (
        <Campo rotulo="Etapas (uma por linha)" htmlFor="mt-etapas" dica="Você pode adicionar etapas e prazos depois, na página da meta.">
          <AreaTexto id="mt-etapas" name="etapas" className="min-h-24" placeholder={"Ex.:\nTreinar finalização 2× por semana\nJogar o campeonato do bairro"} />
        </Campo>
      )}
      {medida === "numero" && (
        <div className="grid grid-cols-3 gap-3">
          {!inicial && (
            <Campo rotulo="Atual" htmlFor="mt-atual">
              <Entrada id="mt-atual" name="atual" type="number" inputMode="decimal" min={0} step="any" defaultValue={0} />
            </Campo>
          )}
          <Campo rotulo="Alvo" htmlFor="mt-alvo" className={inicial ? "col-span-2" : undefined}>
            <Entrada id="mt-alvo" name="alvo" type="number" inputMode="decimal" min={0} step="any" required defaultValue={inicial?.alvo ?? ""} />
          </Campo>
          <Campo rotulo="Unidade" htmlFor="mt-unidade">
            <Entrada id="mt-unidade" name="unidade" maxLength={30} defaultValue={inicial?.unidade ?? ""} placeholder="gols" />
          </Campo>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Prazo (opcional)" htmlFor="mt-prazo" dica="Vira um lembrete na agenda.">
          <Entrada id="mt-prazo" name="prazo" type="date" defaultValue={inicial?.prazo ?? ""} />
        </Campo>
        <div className="grid grid-cols-1 content-start gap-1.5">
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" name="anual" checked={anual} onChange={(e) => setAnual(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" /> Objetivo anual
          </label>
          {anual && <Entrada name="ano" type="number" min={2000} max={2100} defaultValue={inicial?.ano ?? ano} aria-label="Ano do objetivo" className="h-9" />}
        </div>
      </div>
      <Campo rotulo="Por que essa meta importa (opcional)" htmlFor="mt-porque">
        <Entrada id="mt-porque" name="porque" maxLength={500} defaultValue={inicial?.porque ?? ""} placeholder="Ex.: quero ser titular no time da escola" />
      </Campo>
      <Campo rotulo="Descrição (opcional)" htmlFor="mt-desc">
        <AreaTexto id="mt-desc" name="descricao" maxLength={2000} defaultValue={inicial?.descricao ?? ""} className="min-h-20" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar" : "Criar meta"}</BotaoEnvio>
    </form>
  );
}

export function FormEtapa({ meta }: { meta: string }) {
  const [estado, acao] = useActionState(adicionarEtapa, undefined);
  const [chave, setChave] = useState(0);
  useEffect(() => {
    if (estado?.ok) setChave((k) => k + 1);
  }, [estado]);
  return (
    <form key={chave} action={acao} onReset={manterValores} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="meta" value={meta} />
      <Campo rotulo="Nova etapa" htmlFor="et-titulo">
        <Entrada id="et-titulo" name="titulo" required maxLength={120} placeholder="Ex.: Correr 3 km sem parar" />
      </Campo>
      <Campo rotulo="Prazo (opcional)" htmlFor="et-prazo">
        <Entrada id="et-prazo" name="prazo" type="date" />
      </Campo>
      <BotaoEnvio variante="secundario" pendente="…">
        Adicionar
      </BotaoEnvio>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
    </form>
  );
}

export function FormProgresso({ meta, numero, atual, unidade }: { meta: string; numero: boolean; atual: number; unidade: string | null }) {
  const [estado, acao] = useActionState(registrarProgresso, undefined);
  const [modo, setModo] = useState("somar");
  useFechar(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="meta" value={meta} />
      {numero && (
        <>
          <Segmentos
            nome="modo"
            rotulo="Registrar"
            valor={modo}
            aoMudar={setModo}
            opcoes={[
              ["somar", "Somar ao atual"],
              ["definir", "Novo total"],
            ]}
          />
          <Campo
            rotulo={modo === "somar" ? `Quanto somar${unidade ? ` (${unidade})` : ""}` : `Novo total${unidade ? ` (${unidade})` : ""}`}
            htmlFor="pg-valor"
            dica={`Atual: ${atual.toLocaleString("pt-BR")}${unidade ? ` ${unidade}` : ""}`}
          >
            <Entrada id="pg-valor" name="valor" type="number" inputMode="decimal" step="any" required autoFocus />
          </Campo>
        </>
      )}
      <Campo rotulo={numero ? "Nota (opcional)" : "O que avançou"} htmlFor="pg-nota">
        <AreaTexto id="pg-nota" name="nota" maxLength={500} required={!numero} className="min-h-20" autoFocus={!numero} />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Registrar progresso</BotaoEnvio>
    </form>
  );
}
