"use client";
import { useActionState, useEffect, useState } from "react";
import { salvarHabito } from "@/acoes/habitos";
import { Campo, Entrada, Mensagem } from "../ui";
import { BotaoEnvio, useFecharDialogo, manterValores } from "../cliente";
import { MAPA_ICONES } from "../icone-habito";
import { CORES_HABITO, ICONES_HABITO } from "@/lib/catalogo";
import { cn } from "@/lib/cn";

export interface HabitoInicial {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  frequencia: string;
  weekdays: number;
  vezesSemana: number;
  metaDia: number;
  agua: boolean;
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

export function FormHabito({ inicial }: { inicial?: HabitoInicial }) {
  const [estado, acao] = useActionState(salvarHabito, undefined);
  const [freq, setFreq] = useState(inicial?.frequencia ?? "diario");
  const [agua, setAgua] = useState(inicial?.agua ?? false);
  const [icone, setIcone] = useState(inicial?.icone ?? "check");
  const [cor, setCor] = useState(inicial?.cor ?? "azul");
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
  const wd = inicial?.weekdays ?? 62;

  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Nome" htmlFor="h-nome">
        <Entrada id="h-nome" name="nome" required maxLength={60} defaultValue={inicial?.nome} placeholder="Ex.: Ler 20 minutos" autoFocus />
      </Campo>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Ícone</legend>
        <input type="hidden" name="icone" value={icone} />
        <div className="grid grid-cols-8 gap-1.5">
          {ICONES_HABITO.map((nome) => {
            const I = MAPA_ICONES[nome];
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setIcone(nome)}
                aria-pressed={icone === nome}
                aria-label={`Ícone ${nome}`}
                className={cn(
                  "grid grid-cols-1 aspect-square place-items-center rounded-lg border transition",
                  icone === nome ? "border-eletrico bg-eletrico/15 text-texto" : "border-borda text-suave hover:text-texto",
                )}
              >
                <I className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Cor</legend>
        <input type="hidden" name="cor" value={cor} />
        <div className="flex flex-wrap gap-2">
          {Object.entries(CORES_HABITO).map(([nome, hex]) => (
            <button
              key={nome}
              type="button"
              onClick={() => setCor(nome)}
              aria-pressed={cor === nome}
              aria-label={`Cor ${nome}`}
              className={cn("h-8 w-8 rounded-full border-2 transition", cor === nome ? "border-texto scale-110" : "border-transparent")}
              style={{ background: hex }}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2 rounded-xl border border-borda bg-fundo-2/60 p-3 text-sm">
        <input type="checkbox" name="agua" checked={agua} onChange={(e) => setAgua(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2563eb]" />
        <span>
          Concluir sozinho pela meta de água
          <span className="block text-xs text-apagado">Fica feito no dia em que o Hydro Track bate a meta.</span>
        </span>
      </label>

      {!agua && (
        <>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-suave">Frequência</legend>
            <input type="hidden" name="frequencia" value={freq} />
            <div className="grid grid-cols-3 gap-2">
              {[
                ["diario", "Todo dia"],
                ["dias", "Dias da semana"],
                ["semanal", "Vezes por semana"],
              ].map(([v, n]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFreq(v)}
                  aria-pressed={freq === v}
                  className={cn(
                    "h-10 rounded-xl border px-2 text-xs transition sm:text-sm",
                    freq === v ? "border-eletrico bg-eletrico/15 text-texto" : "border-borda text-suave hover:text-texto",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          {freq === "dias" && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-suave">Quais dias</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS.map((d) => (
                  <label key={d.i} className="relative">
                    <input type="checkbox" name="dias" value={d.i} defaultChecked={(wd & (1 << d.i)) !== 0} className="peer sr-only" aria-label={d.nome} />
                    <span className="grid grid-cols-1 h-10 place-items-center rounded-xl border border-borda text-sm text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/15 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                      {d.n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            {freq === "semanal" ? (
              <Campo rotulo="Vezes por semana" htmlFor="h-vezes">
                <Entrada id="h-vezes" name="vezesSemana" type="number" min={1} max={7} required defaultValue={inicial?.vezesSemana ?? 3} />
              </Campo>
            ) : (
              <Campo rotulo="Vezes por dia" htmlFor="h-meta" dica="Ex.: 2 para escovar os dentes 2×.">
                <Entrada id="h-meta" name="metaDia" type="number" min={1} max={20} required defaultValue={inicial?.metaDia ?? 1} />
              </Campo>
            )}
          </div>
        </>
      )}
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar alterações" : "Criar hábito"}</BotaoEnvio>
    </form>
  );
}
