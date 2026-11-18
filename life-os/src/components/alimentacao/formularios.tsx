"use client";
// Formulários do Nutrition Hub (sem calorias, peso ou restrição).
import { useActionState, useEffect, useState } from "react";
import { adicionarCompra, registrarRefeicao, salvarItemPlano, salvarReceita } from "@/acoes/alimentacao";
import { CATEGORIAS_COMPRAS, FOME, GRUPOS, REFEICOES, SACIEDADE, type Refeicao } from "@/lib/alimentacao";
import type { Estado } from "@/acoes/tipos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { Escala } from "../checkin/form";

function useFecharNoOk(estado: Estado) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
}

const lista = (o: Record<number, string>) => Object.entries(o).map(([v, t]) => ({ v: Number(v), t }));

function Chip({ nome, valor, marcado, rotulo }: { nome: string; valor: string; marcado?: boolean; rotulo: string }) {
  return (
    <label>
      <input type="checkbox" name={nome} value={valor} defaultChecked={marcado} className="peer sr-only" />
      <span className="inline-flex h-8 cursor-pointer select-none items-center rounded-full border border-borda px-3 text-xs text-suave transition peer-checked:border-ok peer-checked:bg-ok/15 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
        {rotulo}
      </span>
    </label>
  );
}

export interface RefeicaoInicial {
  id: string;
  dia: string;
  hora: string;
  tipo: string;
  descricao: string;
  grupos: string[];
  fome: number | null;
  saciedade: number | null;
  notas: string | null;
}

export function FormRefeicao({
  hoje,
  tipoSugerido,
  inicial,
  compacto,
  idPrefixo = "rf",
}: {
  hoje: string;
  tipoSugerido?: Refeicao;
  inicial?: RefeicaoInicial;
  compacto?: boolean;
  idPrefixo?: string;
}) {
  const [estado, acao] = useActionState(registrarRefeicao, undefined);
  const [chave, setChave] = useState(0);
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (!estado?.ok) return;
    fechar();
    if (!inicial) setChave((k) => k + 1); // fora de diálogo: limpa para a próxima
  }, [estado, fechar, inicial]);
  const p = idPrefixo;
  return (
    <form key={chave} action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Refeição" htmlFor={`${p}-tipo`}>
          <Selecao id={`${p}-tipo`} name="tipo" defaultValue={inicial?.tipo ?? tipoSugerido ?? "almoco"}>
            {Object.entries(REFEICOES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
        {!compacto && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Dia" htmlFor={`${p}-dia`} className="content-start">
              <Entrada id={`${p}-dia`} name="dia" type="date" max={hoje} defaultValue={inicial?.dia ?? hoje} />
            </Campo>
            <Campo rotulo="Horário" htmlFor={`${p}-hora`} dica={inicial ? undefined : "Vazio = agora"} className="content-start">
              <Entrada id={`${p}-hora`} name="hora" type="time" defaultValue={inicial?.hora} />
            </Campo>
          </div>
        )}
      </div>
      <Campo rotulo="O que comeu" htmlFor={`${p}-desc`}>
        <Entrada id={`${p}-desc`} name="descricao" required maxLength={300} defaultValue={inicial?.descricao} placeholder="Ex.: arroz, feijão, frango e salada" />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Grupos de alimentos</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(GRUPOS).map(([k, v]) => (
            <Chip key={k} nome="grupos" valor={k} rotulo={v} marcado={inicial?.grupos.includes(k)} />
          ))}
        </div>
      </fieldset>
      <div>
        <Escala nome="fome" rotulo="Fome antes (opcional)" opcoes={lista(FOME)} valor={inicial?.fome ?? null} compacta />
        <p className="mt-1 text-xs text-apagado">1 = {FOME[1].toLowerCase()} · 5 = {FOME[5].toLowerCase()}</p>
      </div>
      <div>
        <Escala nome="saciedade" rotulo="Como ficou depois (opcional)" opcoes={lista(SACIEDADE)} valor={inicial?.saciedade ?? null} compacta />
        <p className="mt-1 text-xs text-apagado">1 = {SACIEDADE[1].toLowerCase()} · 3 = {SACIEDADE[3].toLowerCase()} · 5 = {SACIEDADE[5].toLowerCase()}</p>
      </div>
      {!compacto && (
        <Campo rotulo="Observações (opcional)" htmlFor={`${p}-notas`}>
          <AreaTexto id={`${p}-notas`} name="notas" maxLength={1000} defaultValue={inicial?.notas ?? ""} className="min-h-16" />
        </Campo>
      )}
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && !compacto && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
      <BotaoEnvio pendente="Registrando…">{inicial ? "Salvar alterações" : "Registrar refeição"}</BotaoEnvio>
    </form>
  );
}

const DIAS = [
  { i: 1, n: "S", nome: "segunda" },
  { i: 2, n: "T", nome: "terça" },
  { i: 3, n: "Q", nome: "quarta" },
  { i: 4, n: "Q", nome: "quinta" },
  { i: 5, n: "S", nome: "sexta" },
  { i: 6, n: "S", nome: "sábado" },
  { i: 0, n: "D", nome: "domingo" },
];

export function FormItemPlano() {
  const [estado, acao] = useActionState(salvarItemPlano, undefined);
  useFecharNoOk(estado);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <Campo rotulo="Refeição" htmlFor="pl-tipo">
        <Selecao id="pl-tipo" name="tipo" defaultValue="lanche_tarde">
          {Object.entries(REFEICOES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selecao>
      </Campo>
      <Campo rotulo="O que planejou" htmlFor="pl-desc">
        <Entrada id="pl-desc" name="descricao" required maxLength={200} placeholder="Ex.: banana com aveia e iogurte" />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Dias da semana</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS.map((d) => (
            <label key={d.i}>
              <input type="checkbox" name="dias" value={d.i} defaultChecked={d.i >= 1 && d.i <= 5} className="peer sr-only" aria-label={d.nome} />
              <span className="grid grid-cols-1 h-10 cursor-pointer place-items-center rounded-xl border border-borda text-sm text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/15 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                {d.n}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 rounded-xl border border-borda bg-fundo-2/60 p-3 text-sm">
        <input type="checkbox" name="treino" value="1" className="mt-0.5 h-4 w-4 accent-[#2563eb]" />
        <span>
          Só em dias de treino
          <span className="block text-xs text-apagado">Aparece quando há treino registrado no Fitness Center ou o dia está marcado como de treino.</span>
        </span>
      </label>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Adicionar ao planejamento</BotaoEnvio>
    </form>
  );
}

export function FormCompra() {
  const [estado, acao] = useActionState(adicionarCompra, undefined);
  const [chave, setChave] = useState(0);
  useEffect(() => {
    if (estado?.ok) setChave((k) => k + 1);
  }, [estado]);
  return (
    <form key={chave} action={acao} onReset={manterValores} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto] sm:items-end">
      <Campo rotulo="Item" htmlFor="cp-nome">
        <Entrada id="cp-nome" name="nome" required maxLength={120} placeholder="Ex.: bananas" />
      </Campo>
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <Campo rotulo="Quantidade" htmlFor="cp-qtd">
          <Entrada id="cp-qtd" name="quantidade" maxLength={40} placeholder="1 dúzia" />
        </Campo>
        <Campo rotulo="Seção" htmlFor="cp-cat">
          <Selecao id="cp-cat" name="categoria" defaultValue="hortifruti">
            {Object.entries(CATEGORIAS_COMPRAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
      <BotaoEnvio pendente="…">Adicionar</BotaoEnvio>
      {estado?.erro && <div className="sm:col-span-4"><Mensagem tipo="erro">{estado.erro}</Mensagem></div>}
    </form>
  );
}

export interface ReceitaInicial {
  id: string;
  titulo: string;
  ingredientes: string;
  preparo: string | null;
  etiquetas: string[];
  treino: boolean;
  favorita: boolean;
}

export function FormReceita({ inicial }: { inicial?: ReceitaInicial }) {
  const [estado, acao] = useActionState(salvarReceita, undefined);
  useFecharNoOk(estado);
  const p = inicial ? `rc${inicial.id}` : "rc";
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="favorita" value={inicial && !inicial.favorita ? "0" : "1"} />
      <Campo rotulo="Nome da receita" htmlFor={`${p}-titulo`}>
        <Entrada id={`${p}-titulo`} name="titulo" required maxLength={100} defaultValue={inicial?.titulo} />
      </Campo>
      <Campo rotulo="Ingredientes" htmlFor={`${p}-ing`} dica="Um por linha (ou separados por vírgula). Dá para mandar todos para a lista de compras.">
        <AreaTexto id={`${p}-ing`} name="ingredientes" required maxLength={4000} defaultValue={inicial?.ingredientes} className="min-h-28" />
      </Campo>
      <Campo rotulo="Modo de preparo (opcional)" htmlFor={`${p}-prep`}>
        <AreaTexto id={`${p}-prep`} name="preparo" maxLength={8000} defaultValue={inicial?.preparo ?? ""} />
      </Campo>
      <Campo rotulo="Etiquetas (opcional)" htmlFor={`${p}-tags`} dica="Separadas por vírgula. Ex.: lanche, rápido">
        <Entrada id={`${p}-tags`} name="etiquetas" maxLength={200} defaultValue={inicial?.etiquetas.join(", ")} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="treino" value="1" defaultChecked={inicial?.treino} className="h-4 w-4 accent-[#2563eb]" />
        Boa para dia de treino
      </label>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar alterações" : "Salvar receita"}</BotaoEnvio>
    </form>
  );
}
