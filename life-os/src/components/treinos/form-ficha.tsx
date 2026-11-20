"use client";
// Editor de ficha de treino: nome, foco, dias da semana, favorita e exercícios (adicionar, mover, tirar).
import { useActionState, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import { salvarFicha } from "@/acoes/treinos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { GRUPOS_MUSCULARES } from "@/lib/treinos";
import { nomeDiaCurto } from "@/lib/datas";

export interface ExercicioEdicao {
  nome: string;
  grupo: string;
  series: number | string;
  reps: string;
  carga: number | string | null;
  descanso: number | string;
  obs: string;
}

export interface FichaInicial {
  id: string;
  nome: string;
  foco: string | null;
  dias: number[];
  favorita: boolean;
  notas: string | null;
  exercicios: ExercicioEdicao[];
}

const novo = (): ExercicioEdicao => ({ nome: "", grupo: "outro", series: 3, reps: "10", carga: "", descanso: 60, obs: "" });
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

export function FormFicha({ inicial }: { inicial?: FichaInicial }) {
  const [estado, acao] = useActionState(salvarFicha, undefined);
  const [exs, setExs] = useState<ExercicioEdicao[]>(inicial?.exercicios.length ? inicial.exercicios : [novo()]);
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
  const muda = (i: number, campo: keyof ExercicioEdicao, v: string) => setExs((l) => l.map((e, k) => (k === i ? { ...e, [campo]: v } : e)));
  const mover = (i: number, d: -1 | 1) =>
    setExs((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="exercicios" value={JSON.stringify(exs)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome da ficha" htmlFor="fi-nome">
          <Entrada id="fi-nome" name="nome" required maxLength={80} defaultValue={inicial?.nome} placeholder="Ex.: Treino A — superiores" autoFocus />
        </Campo>
        <Campo rotulo="Foco / grupos musculares (opcional)" htmlFor="fi-foco">
          <Entrada id="fi-foco" name="foco" maxLength={80} defaultValue={inicial?.foco ?? ""} placeholder="Ex.: peito, costas e core" />
        </Campo>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Dias da semana (semana de treinamento)</legend>
        <div className="grid grid-cols-7 gap-1">
          {ORDEM_DIAS.map((d) => (
            <label key={d}>
              <input type="checkbox" name="dias" value={d} defaultChecked={inicial?.dias.includes(d)} className="peer sr-only" />
              <span className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-borda bg-fundo-2/70 text-xs capitalize text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                {nomeDiaCurto(d)}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-apagado">Os dias sem ficha aparecem como recuperação na grade da semana.</p>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-suave">
        <input type="checkbox" name="favorita" defaultChecked={inicial?.favorita} className="h-4 w-4 accent-[#2563eb]" />
        <Star className="h-4 w-4 text-alerta" aria-hidden /> Ficha favorita
      </label>

      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-1 text-xs font-medium text-suave">Exercícios ({exs.length})</legend>
        {exs.map((e, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-borda bg-fundo-2/50 p-3">
            <div className="flex items-center gap-2">
              <span className="numero w-5 shrink-0 text-xs text-apagado">{i + 1}.</span>
              <Entrada
                aria-label={`Nome do exercício ${i + 1}`}
                value={e.nome}
                onChange={(ev) => muda(i, "nome", ev.target.value)}
                maxLength={80}
                required
                placeholder="Ex.: Supino reto"
                className="h-10 min-w-0 flex-1"
              />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className={classesBotao("fantasma", "icone", "h-9 w-9 shrink-0")} aria-label={`Subir exercício ${i + 1}`}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === exs.length - 1} className={classesBotao("fantasma", "icone", "h-9 w-9 shrink-0")} aria-label={`Descer exercício ${i + 1}`}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setExs((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : l))}
                disabled={exs.length === 1}
                className={classesBotao("fantasma", "icone", "h-9 w-9 shrink-0 hover:text-perigo")}
                aria-label={`Tirar exercício ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label className="col-span-2 grid grid-cols-1 gap-1 text-[0.7rem] text-apagado sm:col-span-1">
                Grupo
                <Selecao value={e.grupo} onChange={(ev) => muda(i, "grupo", ev.target.value)} className="h-10">
                  {Object.entries(GRUPOS_MUSCULARES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="grid grid-cols-1 gap-1 text-[0.7rem] text-apagado">
                Séries
                <Entrada type="number" inputMode="numeric" min={1} max={20} value={e.series} onChange={(ev) => muda(i, "series", ev.target.value)} className="h-10" />
              </label>
              <label className="grid grid-cols-1 gap-1 text-[0.7rem] text-apagado">
                Repetições
                <Entrada value={e.reps} onChange={(ev) => muda(i, "reps", ev.target.value)} maxLength={20} placeholder="8-12" className="h-10" />
              </label>
              <label className="grid grid-cols-1 gap-1 text-[0.7rem] text-apagado">
                Carga (kg)
                <Entrada inputMode="decimal" value={e.carga ?? ""} onChange={(ev) => muda(i, "carga", ev.target.value)} placeholder="—" className="h-10" />
              </label>
              <label className="grid grid-cols-1 gap-1 text-[0.7rem] text-apagado">
                Intervalo (s)
                <Entrada type="number" inputMode="numeric" min={0} max={900} step={5} value={e.descanso} onChange={(ev) => muda(i, "descanso", ev.target.value)} className="h-10" />
              </label>
            </div>
            <Entrada aria-label={`Observação do exercício ${i + 1}`} value={e.obs} onChange={(ev) => muda(i, "obs", ev.target.value)} maxLength={200} placeholder="Observação de técnica (opcional)" className="h-10" />
          </div>
        ))}
        <button type="button" onClick={() => setExs((l) => (l.length < 30 ? [...l, novo()] : l))} className={classesBotao("contorno", "m")}>
          <Plus className="h-4 w-4" /> Adicionar exercício
        </button>
      </fieldset>
      <Campo rotulo="Observações da ficha (opcional)" htmlFor="fi-notas">
        <AreaTexto id="fi-notas" name="notas" maxLength={1000} defaultValue={inicial?.notas ?? ""} className="min-h-16" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar ficha" : "Criar ficha"}</BotaoEnvio>
    </form>
  );
}
