"use client";
// Exercícios de respiração: o círculo cresce ao inspirar e encolhe ao expirar.
// Com "reduzir movimento" ligado no aparelho, o círculo fica parado e só o texto e a contagem mudam.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { RESPIRACOES, posicaoRespiracao, type TipoRespiracao } from "@/lib/mente";
import { classesBotao } from "../ui";
import { cn } from "@/lib/cn";

const CICLOS = [3, 5, 10];

export function Respiracao() {
  const [tipo, setTipo] = useState<TipoRespiracao>("caixa");
  const [ciclos, setCiclos] = useState(5);
  const [rodando, setRodando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [reduzir, setReduzir] = useState(false);
  // Tempo já corrido antes da última pausa. Recomeçar troca o objeto (a pausa pendente mexe no antigo).
  const base = useRef<{ acumulado: number }>({ acumulado: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ver = () => setReduzir(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  useEffect(() => {
    if (!rodando) return;
    const b = base.current;
    const inicio = performance.now();
    const t = setInterval(() => setSegundos(b.acumulado + (performance.now() - inicio) / 1000), 100);
    return () => {
      clearInterval(t);
      b.acumulado += (performance.now() - inicio) / 1000;
    };
  }, [rodando]);

  const pos = posicaoRespiracao(tipo, segundos, ciclos);
  useEffect(() => {
    if (pos.fim && rodando) setRodando(false);
  }, [pos.fim, rodando]);

  const fases = RESPIRACOES[tipo].fases;
  const fase = fases[pos.fase];
  const comecou = segundos > 0;
  // Tamanho do círculo: cheio depois de inspirar; pequeno depois de expirar; "segure" mantém o da fase anterior.
  let cheio = false;
  for (let i = 0; i <= pos.fase; i++) {
    if (fases[i].movimento === "cresce") cheio = true;
    if (fases[i].movimento === "encolhe") cheio = false;
  }
  const escala = !comecou || reduzir ? 0.78 : cheio ? 1 : 0.55;

  const recomecar = () => {
    setRodando(false);
    base.current = { acumulado: 0 };
    setSegundos(0);
  };
  const trocar = (fn: () => void) => {
    recomecar();
    fn();
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="grid grid-cols-1 gap-4">
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-suave">Exercício</legend>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(RESPIRACOES) as TipoRespiracao[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tipo === k}
                onClick={() => trocar(() => setTipo(k))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition",
                  tipo === k ? "border-eletrico bg-eletrico/15" : "border-borda hover:border-borda-forte",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{RESPIRACOES[k].nome}</span>
                  <span className="numero text-xs text-suave">{RESPIRACOES[k].resumo}</span>
                </span>
                <span className="block text-xs text-suave">{RESPIRACOES[k].descricao}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-suave">Ciclos</legend>
          <div className="grid grid-cols-3 gap-2">
            {CICLOS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={ciclos === c}
                onClick={() => trocar(() => setCiclos(c))}
                className={cn(
                  "h-10 rounded-xl border text-sm transition",
                  ciclos === c ? "border-eletrico bg-eletrico/15 text-texto" : "border-borda text-suave hover:text-texto",
                )}
              >
                {c} ciclos
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="grid h-60 w-60 max-w-full place-items-center" aria-hidden>
          <div
            className="grid h-56 w-56 place-items-center rounded-full border border-eletrico/40 bg-[radial-gradient(circle_at_35%_30%,rgb(96_165_250/0.45),rgb(124_58_237/0.25)_60%,transparent_75%)] shadow-[0_0_60px_-10px_rgb(37_99_235/0.7)]"
            style={{
              transform: `scale(${escala})`,
              transition: rodando && !reduzir ? `transform ${fase.segundos}s linear` : "transform 0.4s ease",
            }}
          />
        </div>
        <div className="text-center" aria-live="polite" aria-atomic="true">
          <p className="font-display text-2xl font-semibold">{pos.fim ? "Pronto" : comecou ? fase.nome : "Pronto para começar"}</p>
          <p className="numero text-sm text-suave">
            {pos.fim ? `${ciclos} ciclos feitos. Como você está?` : comecou ? `${pos.restante} s · ciclo ${pos.ciclo} de ${ciclos}` : `${ciclos} ciclos`}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {!pos.fim && (
            <button type="button" onClick={() => setRodando((r) => !r)} className={classesBotao("primario", "g")}>
              {rodando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {rodando ? "Pausar" : comecou ? "Continuar" : "Iniciar"}
            </button>
          )}
          {comecou && (
            <button type="button" onClick={recomecar} className={classesBotao("secundario", "g")}>
              <RotateCcw className="h-4 w-4" /> Recomeçar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
