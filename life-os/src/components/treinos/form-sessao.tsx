"use client";
// Sessão de musculação: as séries feitas (repetições e carga), já preenchidas pela ficha e pela carga da
// última vez, com o cronômetro de intervalo.
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Square, Timer, Trash2, X } from "lucide-react";
import { registrarAtividade } from "@/acoes/treinos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores } from "../cliente";
import { CampoEsforco } from "./formularios";
import { GRUPOS_MUSCULARES } from "@/lib/treinos";
import { cn } from "@/lib/cn";

export interface SerieEdicao {
  reps: string;
  carga: string;
}

export interface ExercicioSessao {
  nome: string;
  grupo: string;
  descanso: number;
  dica?: string; // "3 × 8-12 · 30 kg na ficha"
  series: SerieEdicao[];
}

export interface SessaoInicial {
  id?: string;
  fichaId?: string;
  titulo: string;
  dia: string;
  hora?: string;
  duracao: number;
  esforco: number | null;
  notas: string;
  exercicios: ExercicioSessao[];
}

// ───────────── Cronômetro de intervalo ─────────────

function formatar(seg: number) {
  const s = Math.max(0, Math.ceil(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Cronômetro do descanso entre séries. Conta pelo relógio (fim = agora + restante), então não atrasa com
 * a tela em segundo plano; no fim vibra (quando o aparelho deixa) e pisca.
 */
export function useCronometro() {
  const [fim, setFim] = useState<number | null>(null); // instante do fim quando rodando
  const [restante, setRestante] = useState(0); // segundos (parado/pausado)
  const [total, setTotal] = useState(0);
  const [acabou, setAcabou] = useState(false);
  const [, setTique] = useState(0);
  const rodando = fim !== null;
  const avisou = useRef(false);

  useEffect(() => {
    if (fim === null) return;
    const t = setInterval(() => {
      setTique((x) => x + 1);
      if (Date.now() >= fim && !avisou.current) {
        avisou.current = true;
        setFim(null);
        setRestante(0);
        setAcabou(true);
        try {
          navigator.vibrate?.([250, 120, 250, 120, 400]);
        } catch {}
      }
    }, 250);
    return () => clearInterval(t);
  }, [fim]);

  const iniciar = useCallback((seg: number) => {
    avisou.current = false;
    setAcabou(false);
    setTotal(seg);
    setRestante(seg);
    setFim(Date.now() + seg * 1000);
  }, []);
  const agora = rodando ? Math.max(0, (fim - Date.now()) / 1000) : restante;
  return {
    rodando,
    acabou,
    total,
    segundos: agora,
    ativo: rodando || restante > 0 || acabou,
    iniciar,
    mais15: () => {
      if (rodando) setFim((f) => (f ?? Date.now()) + 15_000);
      else {
        setRestante((r) => r + 15);
        setAcabou(false);
      }
      setTotal((t) => t + 15);
    },
    pausar: () => {
      if (!rodando) return;
      setRestante(agora);
      setFim(null);
    },
    continuar: () => {
      if (rodando || restante <= 0) return;
      avisou.current = false;
      setFim(Date.now() + restante * 1000);
    },
    parar: () => {
      setFim(null);
      setRestante(0);
      setAcabou(false);
    },
  };
}

export function PainelCronometro({ c }: { c: ReturnType<typeof useCronometro> }) {
  if (!c.ativo) return null;
  const pct = c.total ? (c.segundos / c.total) * 100 : 0;
  return (
    <div
      role="timer"
      aria-live={c.acabou ? "assertive" : "off"}
      className={cn(
        "painel fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md border-borda-forte p-3 lg:bottom-6",
        c.acabou && "animate-pulse border-ok/60",
      )}
      style={{ background: c.acabou ? "#0f2a24" : "#141c30" }}
    >
      <div className="flex items-center gap-3">
        <Timer className={cn("h-5 w-5 shrink-0", c.acabou ? "text-ok" : "text-eletrico-claro")} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-suave">{c.acabou ? "Descanso terminado: próxima série" : c.rodando ? "Descanso" : "Descanso pausado"}</p>
          <p className="numero font-display text-2xl font-bold leading-tight">{formatar(c.segundos)}</p>
        </div>
        <button type="button" onClick={c.mais15} className={classesBotao("secundario", "p")} aria-label="Mais 15 segundos">
          +15 s
        </button>
        {c.rodando ? (
          <button type="button" onClick={c.pausar} className={classesBotao("secundario", "icone", "h-8 w-8")} aria-label="Pausar">
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          !c.acabou && (
            <button type="button" onClick={c.continuar} className={classesBotao("secundario", "icone", "h-8 w-8")} aria-label="Continuar">
              <Play className="h-4 w-4" />
            </button>
          )
        )}
        <button type="button" onClick={c.parar} className={classesBotao("fantasma", "icone", "h-8 w-8")} aria-label="Fechar cronômetro">
          {c.acabou ? <X className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
      </div>
      {!c.acabou && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/6" aria-hidden>
          <div className="h-full rounded-full bg-eletrico transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ───────────── Formulário da sessão ─────────────

export function FormSessao({ hoje, inicial }: { hoje: string; inicial: SessaoInicial }) {
  const [estado, acao] = useActionState(registrarAtividade, undefined);
  // Sessão nova sem ficha começa com um exercício em branco; editar uma sessão sem séries (registro rápido) começa vazia.
  const [exs, setExs] = useState<ExercicioSessao[]>(
    inicial.exercicios.length || inicial.id ? inicial.exercicios : [{ nome: "", grupo: "outro", descanso: 60, series: [{ reps: "", carga: "" }] }],
  );
  const c = useCronometro();

  const serializar = () =>
    JSON.stringify(
      exs.flatMap((e) =>
        e.series.map((s, k) => ({ exercicio: e.nome, grupo: e.grupo, serie: k + 1, reps: s.reps, carga: s.carga })),
      ),
    );
  const mudaEx = (i: number, campo: "nome" | "grupo", v: string) => setExs((l) => l.map((e, k) => (k === i ? { ...e, [campo]: v } : e)));
  const mudaSerie = (i: number, j: number, campo: keyof SerieEdicao, v: string) =>
    setExs((l) => l.map((e, k) => (k === i ? { ...e, series: e.series.map((s, m) => (m === j ? { ...s, [campo]: v } : s)) } : e)));
  const maisSerie = (i: number) =>
    setExs((l) => l.map((e, k) => (k === i && e.series.length < 20 ? { ...e, series: [...e.series, { ...(e.series[e.series.length - 1] ?? { reps: "", carga: "" }) }] } : e)));
  const menosSerie = (i: number, j: number) => setExs((l) => l.map((e, k) => (k === i && e.series.length > 1 ? { ...e, series: e.series.filter((_, m) => m !== j) } : e)));

  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="tipo" value="musculacao" />
      <input type="hidden" name="series" value={serializar()} />
      <input type="hidden" name="voltar" value="/treinos?aba=musculacao" />
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      {inicial.fichaId && <input type="hidden" name="fichaId" value={inicial.fichaId} />}

      <div className="painel grid grid-cols-1 gap-3 p-4">
        <Campo rotulo="Título (opcional)" htmlFor="ss-tit">
          <Entrada id="ss-tit" name="titulo" maxLength={80} defaultValue={inicial.titulo} />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Data" htmlFor="ss-dia">
            <Entrada id="ss-dia" name="dia" type="date" required max={hoje} defaultValue={inicial.dia} />
          </Campo>
          <Campo rotulo="Horário" htmlFor="ss-hora">
            <Entrada id="ss-hora" name="hora" type="time" defaultValue={inicial.hora} />
          </Campo>
          <Campo rotulo="Duração (min)" htmlFor="ss-dur">
            <Entrada id="ss-dur" name="duracao" type="number" inputMode="numeric" min={1} max={600} required defaultValue={inicial.duracao} />
          </Campo>
          <div className="col-span-2 sm:col-span-1">
            <CampoEsforco id="ss-esf" valor={inicial.esforco} />
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-3">
        {exs.map((e, i) => (
          <li key={i} className="painel grid grid-cols-1 gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Entrada
                aria-label={`Exercício ${i + 1}`}
                value={e.nome}
                onChange={(ev) => mudaEx(i, "nome", ev.target.value)}
                maxLength={80}
                required
                placeholder="Exercício"
                className="h-10 min-w-0 flex-1 basis-40 font-medium"
              />
              <Selecao aria-label={`Grupo muscular do exercício ${i + 1}`} value={e.grupo} onChange={(ev) => mudaEx(i, "grupo", ev.target.value)} className="h-10 w-auto basis-32">
                {Object.entries(GRUPOS_MUSCULARES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selecao>
              <button
                type="button"
                onClick={() => setExs((l) => l.filter((_, k) => k !== i))}
                className={classesBotao("fantasma", "icone", "h-9 w-9 hover:text-perigo")}
                aria-label={`Tirar ${e.nome || `exercício ${i + 1}`}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {e.dica && <p className="-mt-1 text-xs text-apagado">{e.dica}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] text-apagado">
                  <th className="w-10 pb-1 font-medium">Série</th>
                  <th className="pb-1 font-medium">Repetições</th>
                  <th className="pb-1 font-medium">Carga (kg)</th>
                  <th className="w-8 pb-1" />
                </tr>
              </thead>
              <tbody>
                {e.series.map((s, j) => (
                  <tr key={j}>
                    <td className="numero py-1 text-suave">{j + 1}</td>
                    <td className="py-1 pr-2">
                      <Entrada
                        aria-label={`${e.nome || "Exercício"}: repetições da série ${j + 1}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={500}
                        value={s.reps}
                        onChange={(ev) => mudaSerie(i, j, "reps", ev.target.value)}
                        className="h-10"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Entrada
                        aria-label={`${e.nome || "Exercício"}: carga da série ${j + 1}`}
                        inputMode="decimal"
                        value={s.carga}
                        onChange={(ev) => mudaSerie(i, j, "carga", ev.target.value)}
                        placeholder="—"
                        className="h-10"
                      />
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() => menosSerie(i, j)}
                        disabled={e.series.length === 1}
                        className="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo disabled:opacity-30"
                        aria-label={`Tirar série ${j + 1} de ${e.nome || "exercício"}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => maisSerie(i)} className={classesBotao("fantasma", "p")}>
                <Plus className="h-4 w-4" /> Série
              </button>
              <button type="button" onClick={() => c.iniciar(e.descanso || 60)} className={classesBotao("contorno", "p")}>
                <Timer className="h-4 w-4" /> Descanso {e.descanso || 60} s
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setExs((l) => (l.length < 30 ? [...l, { nome: "", grupo: "outro", descanso: 60, series: [{ reps: "", carga: "" }] }] : l))}
        className={classesBotao("contorno", "m")}
      >
        <Plus className="h-4 w-4" /> Adicionar exercício
      </button>
      <Campo rotulo="Observações e técnica (opcional)" htmlFor="ss-notas" dica="Ex.: melhorei a descida no agachamento; ombro estável no supino.">
        <AreaTexto id="ss-notas" name="notas" maxLength={2000} defaultValue={inicial.notas} className="min-h-20" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…" tamanho="g">
        {inicial.id ? "Salvar sessão" : "Concluir sessão"}
      </BotaoEnvio>
      {/* Com o cronômetro aberto, o fim da página sobe o bastante para o botão não ficar por baixo dele. */}
      {c.ativo && <div aria-hidden className="h-28 lg:h-20" />}
      <PainelCronometro c={c} />
    </form>
  );
}
