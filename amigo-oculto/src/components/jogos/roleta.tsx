"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { Check, Dices, SkipForward } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { useTempoReal } from "@/components/sala/ao-vivo";
import { girarRoleta, resolverDesafio } from "@/lib/acoes/jogos";
import { relativo } from "@/lib/formatos";
import { cn } from "@/lib/cn";

type Giro = { id: string; participant_id: string; challenge_index: number; challenge_text: string; status: string; created_at: string };
type PessoaMin = { id: string; nome: string; avatar: string | null };

const CORES = ["var(--t1)", "var(--t2)", "var(--t3)", "#fffdf8"];

function fatia(i: number, total: number, r: number) {
  const a0 = ((i / total) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / total) * 360 - 90) * (Math.PI / 180);
  return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)} Z`;
}

/** Rotação (graus) que deixa o centro da fatia `i` embaixo do ponteiro (no topo). */
function anguloDa(i: number, total: number) {
  return 360 - ((i + 0.5) / total) * 360;
}

export function Roleta({
  eventoId,
  catalogo,
  pessoas,
  euId,
  pendenteInicial,
  girosIniciais,
}: {
  eventoId: string;
  catalogo: string[];
  pessoas: PessoaMin[];
  euId: string;
  pendenteInicial: Giro | null;
  girosIniciais: Giro[];
}) {
  const total = catalogo.length || 30;
  const rotacao = useMotionValue(pendenteInicial ? anguloDa(pendenteInicial.challenge_index, total) : 0);
  const [girando, setGirando] = useState(false);
  const [atual, setAtual] = useState<Giro | null>(pendenteInicial);
  const [giros, setGiros] = useState<Giro[]>(girosIniciais);
  const [mostrarResultado, setMostrarResultado] = useState(!!pendenteInicial);
  const [pendente, iniciar] = useTransition();
  const confete = useRef<ConfeteHandle>(null);
  const { avisar } = useAvisos();
  const { som, vibracao, menosMovimento } = usePreferencias();
  const nomes = new Map(pessoas.map((p) => [p.id, p]));

  const recarregar = useCallback(async () => {
    const { data } = await clienteNavegador()
      .from("challenge_spins")
      .select("id, participant_id, challenge_index, challenge_text, status, created_at")
      .eq("event_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setGiros(data);
  }, [eventoId]);

  useTempoReal(`roleta:${eventoId}`, [{ tabela: "challenge_spins", filtro: `event_id=eq.${eventoId}` }], () => void recarregar());

  function girar() {
    if (girando || atual) return;
    setMostrarResultado(false);
    setGirando(true);
    iniciar(async () => {
      const r = await girarRoleta(eventoId);
      if (!r.ok || !r.dados) {
        setGirando(false);
        if (!r.ok) avisar(r.erro, "erro");
        return;
      }
      const { id, indice, texto } = r.dados;
      const agora = rotacao.get();
      const base = agora - (((agora % 360) + 360) % 360);
      const alvo = base + 360 * (menosMovimento ? 0 : 6) + anguloDa(indice, total);
      let ultimaFatia = Math.floor(agora / (360 / total));
      await animate(rotacao, alvo, {
        duration: menosMovimento ? 0.01 : 5.2,
        ease: [0.12, 0.75, 0.18, 1],
        onUpdate: (v) => {
          const f = Math.floor(v / (360 / total));
          if (f !== ultimaFatia) {
            ultimaFatia = f;
            tocar("tique", som);
          }
        },
      });
      const novo: Giro = { id, participant_id: euId, challenge_index: indice, challenge_text: texto, status: "pending", created_at: new Date().toISOString() };
      setAtual(novo);
      setMostrarResultado(true);
      setGirando(false);
      tocar("revelar", som);
      vibrar([40, 30, 40], vibracao);
      void recarregar();
    });
  }

  function resolver(situacao: "done" | "skipped") {
    if (!atual) return;
    iniciar(async () => {
      const r = await resolverDesafio(eventoId, atual.id, situacao);
      if (r.ok) {
        if (situacao === "done") {
          confete.current?.disparar({ quantidade: 120 });
          tocar("festa", som);
        }
        avisar(r.mensagem ?? "Pronto!");
        setAtual(null);
        setMostrarResultado(false);
        void recarregar();
      } else {
        avisar(r.erro, "erro");
      }
    });
  }

  const r = 140;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <Confete ref={confete} desligado={menosMovimento} />
      <Cartao forte className="flex flex-col items-center gap-5">
        <div className="relative w-full max-w-[22rem]">
          {/* ponteiro */}
          <svg viewBox="0 0 40 36" className="absolute left-1/2 top-0 z-10 w-10 -translate-x-1/2 -translate-y-1 drop-shadow" aria-hidden>
            <path d="M20 34 L4 4 Q20 -2 36 4 Z" fill="var(--ouro)" stroke="#fff" strokeWidth="2" />
          </svg>
          <div className="rounded-full bg-[linear-gradient(135deg,var(--ouro-claro),var(--ouro),var(--ouro-escuro))] p-2.5 shadow-brilho">
            <motion.svg
              viewBox={`${-r - 4} ${-r - 4} ${2 * r + 8} ${2 * r + 8}`}
              className="block aspect-square w-full"
              style={{ rotate: rotacao }}
              role="img"
              aria-label={`Roleta com ${total} desafios`}
            >
              {Array.from({ length: total }, (_, i) => {
                const cor = CORES[i % CORES.length];
                const meio = (((i + 0.5) / total) * 360 - 90) * (Math.PI / 180);
                const tx = Math.cos(meio) * r * 0.82;
                const ty = Math.sin(meio) * r * 0.82;
                return (
                  <g key={i}>
                    <path d={fatia(i, total, r)} fill={cor} stroke="rgb(255 255 255 / .55)" strokeWidth="1" />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill={i % CORES.length === 3 ? "#7a1020" : "#fff"}
                      transform={`rotate(${((i + 0.5) / total) * 360} ${tx} ${ty})`}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <circle r={r * 0.2} fill="#fffdf8" stroke="var(--ouro)" strokeWidth="4" />
              <path d="M0 -14 l4 9 10 1 -7.5 6.5 2.3 9.8L0 6.5l-8.8 5.3 2.3-9.8L-14 -4.5l10-1z" fill="var(--ouro)" />
            </motion.svg>
          </div>
        </div>
        <Botao
          tamanho="g"
          brilho={!atual && !girando}
          onClick={girar}
          disabled={!!atual || girando}
          carregando={girando}
          className="min-w-48"
        >
          <Dices className="size-5" aria-hidden /> {girando ? "Girando…" : "Girar a roleta"}
        </Botao>
        {atual && !girando ? <p className="text-center text-sm text-suave">Cumpra ou pule o desafio atual para girar de novo.</p> : null}
      </Cartao>

      <div className="flex flex-col gap-4">
        <div aria-live="polite">
          {atual && mostrarResultado ? (
            <motion.div
              initial={menosMovimento ? false : { opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="vidro-forte relative overflow-hidden rounded-cartao p-6"
            >
              <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-suave">Desafio nº {atual.challenge_index + 1}</p>
              <p className="mt-2 font-titulo text-2xl font-semibold leading-snug">{atual.challenge_text}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Botao variante="esmeralda" onClick={() => resolver("done")} carregando={pendente}>
                  <Check className="size-4" aria-hidden /> Cumpri!
                </Botao>
                <Botao variante="contorno" onClick={() => resolver("skipped")} disabled={pendente}>
                  <SkipForward className="size-4" aria-hidden /> Pular
                </Botao>
              </div>
              <p className="mt-3 text-xs text-suave">Os desafios são leves e opcionais: pular não tira ponto nenhum.</p>
            </motion.div>
          ) : (
            <Cartao>
              <p className="font-titulo text-lg font-semibold">Como funciona</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-suave">
                <li>Gire e receba um dos {total} desafios — o sorteio é feito no servidor.</li>
                <li>Cumpriu? Toque em “Cumpri!” e ganhe 6 pontos no ranking.</li>
                <li>Não quer fazer? Pule, sem problema nenhum.</li>
              </ul>
            </Cartao>
          )}
        </div>

        <Cartao>
          <h3 className="mb-3 font-titulo text-lg font-semibold">Giros do grupo</h3>
          {giros.length ? (
            <ul className="flex flex-col gap-3" aria-live="polite">
              {giros.map((gi) => {
                const p = nomes.get(gi.participant_id);
                return (
                  <li key={gi.id} className="flex items-start gap-3">
                    <Avatar nome={p?.nome ?? "?"} caminho={p?.avatar} tamanho={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <strong>{gi.participant_id === euId ? "Você" : (p?.nome ?? "Alguém")}</strong>{" "}
                        <span className="text-suave">· {relativo(gi.created_at)}</span>
                      </p>
                      <p className="text-sm text-suave">{gi.challenge_text}</p>
                    </div>
                    <Selo cor={gi.status === "done" ? "esmeralda" : gi.status === "skipped" ? "neutro" : "ouro"} className={cn("shrink-0")}>
                      {gi.status === "done" ? "Cumpriu" : gi.status === "skipped" ? "Pulou" : "Em aberto"}
                    </Selo>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio titulo="Ninguém girou ainda" texto="Seja a primeira pessoa a encarar um desafio!" />
          )}
        </Cartao>
      </div>
    </div>
  );
}
