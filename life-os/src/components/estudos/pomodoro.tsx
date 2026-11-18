"use client";
// Cronômetro Pomodoro. Conta pelo relógio (não por "ticks"), então não atrasa com a aba em segundo plano.
// Ao fim de cada foco registra a sessão de estudo sozinho; aviso visual e vibração no fim de cada fase.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";
import { registrarPomodoro } from "@/acoes/estudos";
import { proximaFase, type ConfigPomodoro, type FasePomodoro } from "@/lib/estudos";
import { Anel } from "../anel";
import { Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { cn } from "@/lib/cn";
import type { MateriaOpcao } from "./formularios";

const NOMES: Record<FasePomodoro, string> = { foco: "Foco", curta: "Pausa curta", longa: "Pausa longa" };
const CHAVE = "lifeos.pomodoro";

interface Estado {
  fase: FasePomodoro;
  focos: number; // focos concluídos nesta rodada
  fimEm: number | null; // instante do fim (rodando)
  restanteMs: number; // pausado
}

export function Pomodoro({ cfg, materias }: { cfg: ConfigPomodoro; materias: MateriaOpcao[] }) {
  const duracao = useCallback((f: FasePomodoro) => (f === "foco" ? cfg.foco : f === "curta" ? cfg.curta : cfg.longa) * 60_000, [cfg]);
  const [st, setSt] = useState<Estado>({ fase: "foco", focos: 0, fimEm: null, restanteMs: cfg.foco * 60_000 });
  const [agora, setAgora] = useState(() => Date.now());
  const [materia, setMateria] = useState(materias[0]?.id ?? "");
  const [conteudo, setConteudo] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [piscando, setPiscando] = useState(false);
  const [, iniciar] = useTransition();
  const encerrando = useRef(false);

  // Retoma um cronômetro em andamento (recarregar a página não perde o foco).
  useEffect(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null") as (Estado & { materia?: string; conteudo?: string }) | null;
      if (salvo && salvo.fase) {
        setSt({ fase: salvo.fase, focos: salvo.focos ?? 0, fimEm: salvo.fimEm, restanteMs: salvo.restanteMs });
        if (salvo.materia !== undefined) setMateria(salvo.materia);
        if (salvo.conteudo) setConteudo(salvo.conteudo);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({ ...st, materia, conteudo }));
    } catch {}
  }, [st, materia, conteudo]);

  const restante = st.fimEm ? Math.max(0, st.fimEm - agora) : st.restanteMs;
  const rodando = st.fimEm !== null;

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [rodando]);

  const registrar = useCallback(
    (minutos: number) => {
      if (minutos < 1) return;
      iniciar(async () => {
        const r = await registrarPomodoro({ materiaId: materia || null, minutos, conteudo });
        setAviso(r?.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: r?.ok ?? "Registrado." });
      });
    },
    [materia, conteudo],
  );

  const sinal = () => {
    setPiscando(true);
    setTimeout(() => setPiscando(false), 2400);
    try {
      navigator.vibrate?.([300, 120, 300]);
    } catch {}
  };

  // Fim da fase.
  useEffect(() => {
    if (!rodando || restante > 0 || encerrando.current) return;
    encerrando.current = true;
    const focos = st.fase === "foco" ? st.focos + 1 : st.focos;
    if (st.fase === "foco") registrar(cfg.foco);
    else setAviso({ tipo: "info", texto: "Pausa terminada. Bora para o próximo foco." });
    sinal();
    const prox = proximaFase(st.fase, focos, cfg);
    setSt({ fase: prox, focos, fimEm: null, restanteMs: duracao(prox) });
    encerrando.current = false;
  }, [rodando, restante, st, cfg, duracao, registrar]);

  const comecar = () => {
    setAviso(null);
    setAgora(Date.now());
    setSt((s) => ({ ...s, fimEm: Date.now() + s.restanteMs }));
  };
  const pausar = () => setSt((s) => ({ ...s, fimEm: null, restanteMs: Math.max(0, (s.fimEm ?? 0) - Date.now()) }));
  const zerar = () => setSt({ fase: "foco", focos: 0, fimEm: null, restanteMs: duracao("foco") });
  const pular = () =>
    setSt((s) => {
      const prox = proximaFase(s.fase, s.fase === "foco" ? s.focos + 1 : s.focos, cfg);
      return { fase: prox, focos: s.fase === "foco" ? s.focos + 1 : s.focos, fimEm: null, restanteMs: duracao(prox) };
    });
  /** Encerra o foco agora e registra o tempo já estudado. */
  const concluirAgora = () => {
    const feitos = Math.floor((duracao("foco") - restante) / 60_000);
    if (feitos >= 1) registrar(feitos);
    else setAviso({ tipo: "info", texto: "Menos de 1 minuto: nada registrado." });
    const focos = st.focos + 1;
    const prox = proximaFase("foco", focos, cfg);
    setSt({ fase: prox, focos, fimEm: null, restanteMs: duracao(prox) });
  };

  const total = duracao(st.fase);
  const pct = total ? ((total - restante) / total) * 100 : 0;
  const mm = String(Math.floor(restante / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((restante % 60_000) / 1000)).padStart(2, "0");
  const cor = st.fase === "foco" ? "url(#grad-anel)" : "#199e70";

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
      <div className={cn("flex flex-col items-center gap-3 rounded-2xl p-2 transition", piscando && "animate-pulse bg-eletrico/10")}>
        <p className="rotulo" aria-live="polite">
          {NOMES[st.fase]} · {st.focos % cfg.cadaLonga}/{cfg.cadaLonga}
        </p>
        <Anel pct={pct} tamanho={208} espessura={14} cor={cor} rotulo={`${NOMES[st.fase]}: faltam ${mm} minutos e ${ss} segundos`}>
          <div>
            <p className="numero font-display text-5xl font-bold" data-testid="pomodoro-tempo">
              {mm}:{ss}
            </p>
            <p className="text-xs text-suave">{rodando ? "rodando" : "parado"}</p>
          </div>
        </Anel>
        <div className="flex flex-wrap justify-center gap-2">
          {rodando ? (
            <button type="button" onClick={pausar} className={classesBotao("primario", "g")}>
              <Pause className="h-5 w-5" /> Pausar
            </button>
          ) : (
            <button type="button" onClick={comecar} className={classesBotao("primario", "g")}>
              <Play className="h-5 w-5" /> {restante < total ? "Continuar" : "Começar"}
            </button>
          )}
          {st.fase === "foco" && restante < total && (
            <button type="button" onClick={concluirAgora} className={classesBotao("secundario", "g")} title="Encerra o foco e registra o tempo estudado">
              <Square className="h-4 w-4" /> Concluir
            </button>
          )}
          <button type="button" onClick={pular} className={classesBotao("fantasma", "icone")} aria-label="Pular fase" title="Pular fase">
            <SkipForward className="h-5 w-5" />
          </button>
          <button type="button" onClick={zerar} className={classesBotao("fantasma", "icone")} aria-label="Recomeçar" title="Recomeçar">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Campo rotulo="Matéria" htmlFor="pm-materia">
          <Selecao id="pm-materia" value={materia} onChange={(e) => setMateria(e.target.value)}>
            <option value="">Sem matéria</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Conteúdo (opcional)" htmlFor="pm-conteudo">
          <Entrada id="pm-conteudo" value={conteudo} maxLength={120} onChange={(e) => setConteudo(e.target.value)} placeholder="Ex.: lista de frações" />
        </Campo>
        <p className="text-xs text-apagado">
          Foco de {cfg.foco} min, pausa de {cfg.curta} min e pausa longa de {cfg.longa} min a cada {cfg.cadaLonga} focos. Cada foco concluído entra
          sozinho nas horas estudadas.
        </p>
        {aviso && <Mensagem tipo={aviso.tipo}>{aviso.texto}</Mensagem>}
      </div>
    </div>
  );
}
