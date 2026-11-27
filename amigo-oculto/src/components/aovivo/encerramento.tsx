"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Images, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao, BotaoLink } from "@/components/ui/botao";
import type { ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import type { PessoaAoVivo, Revelacao } from "@/components/aovivo/estado";
import { cn } from "@/lib/cn";

/**
 * Encerramento cinematográfico: o céu estrelado, a constelação de todos os pares revelados (um por um, cada linha
 * se desenhando de quem deu para quem recebeu), o agradecimento e os fogos de confete.
 * Só aparecem os pares que foram revelados (pelo próprio participante ou com a autorização dele).
 */
export function Encerramento({
  eventoId,
  nomeEvento,
  pessoas,
  revelacoes,
  som,
  confete,
}: {
  eventoId: string;
  nomeEvento: string;
  pessoas: PessoaAoVivo[];
  revelacoes: Revelacao[];
  som: boolean;
  confete: RefObject<ConfeteHandle | null>;
}) {
  const { menosMovimento } = usePreferencias();
  const [rodada, setRodada] = useState(0);
  const [mostradas, setMostradas] = useState(menosMovimento ? revelacoes.length : 0);
  const [fase, setFase] = useState<"titulo" | "constelacao" | "final">(menosMovimento ? "final" : "titulo");
  const somRef = useRef(som);
  useEffect(() => {
    somRef.current = som;
  }, [som]);

  useEffect(() => {
    if (menosMovimento) {
      setMostradas(revelacoes.length);
      setFase("final");
      return;
    }
    const t: ReturnType<typeof setTimeout>[] = [];
    setMostradas(0);
    setFase("titulo");
    tocar("sino", somRef.current);
    let quando = 2400;
    t.push(setTimeout(() => setFase("constelacao"), quando));
    quando += 600;
    revelacoes.forEach((_, i) => {
      t.push(
        setTimeout(() => {
          setMostradas(i + 1);
          tocar("virar", somRef.current);
        }, quando),
      );
      quando += 1700;
    });
    quando += 600;
    t.push(
      setTimeout(() => {
        setFase("final");
        tocar("festa", somRef.current);
      }, quando),
    );
    // fogos de confete
    [0, 700, 1400, 2400, 3600].forEach((d, i) =>
      t.push(
        setTimeout(() => {
          confete.current?.disparar({ quantidade: 160, origemX: [0.5, 0.2, 0.8, 0.35, 0.65][i], origemY: [0.35, 0.5, 0.5, 0.3, 0.3][i], espalhar: 1.15 });
        }, quando + d),
      ),
    );
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada, menosMovimento]);

  // posições na roda (em %, dentro de um quadrado)
  const n = pessoas.length;
  const pos = new Map(
    pessoas.map((p, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      // arredondado: servidor e navegador diferem nas últimas casas do Math.cos (hidratação)
      return [p.id, { x: Math.round((50 + Math.cos(a) * 40) * 100) / 100, y: Math.round((50 + Math.sin(a) * 40) * 100) / 100 }];
    }),
  );
  const tamanho = n <= 8 ? 72 : n <= 16 ? 54 : 40;
  const visiveis = revelacoes.slice(0, mostradas);
  const ultima = visiveis.at(-1);
  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? "?";
  const ativos = new Set(visiveis.flatMap((r) => [r.giver_id, r.receiver_id]));

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
      <Estrelas parado={menosMovimento} />
      <AnimatePresence mode="wait">
        {fase === "titulo" ? (
          <motion.div key="titulo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.9 }}>
            <p className="text-[0.8em] font-semibold uppercase tracking-[0.35em] text-ouro-claro">E assim termina</p>
            <h2 className="texto-ouro mt-3 font-titulo text-[3.2em] font-semibold leading-tight sm:text-[4em]">{nomeEvento}</h2>
          </motion.div>
        ) : (
          <motion.p key="sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-titulo text-[1.6em] font-semibold sm:text-[2em]">
            {fase === "final" ? "Obrigado por esta noite!" : "A constelação da noite"}
          </motion.p>
        )}
      </AnimatePresence>

      {fase !== "titulo" ? (
        <div
          className={cn("relative aspect-square transition-[width] duration-700", fase === "final" ? "w-[min(46vh,80vw,24em)]" : "w-[min(60vh,86vw,30em)]")}
          role="img" aria-label={`${revelacoes.length} pares revelados ligando ${n} participantes`}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="linha-ouro" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff1c2" />
                <stop offset="1" stopColor="#e2b04a" />
              </linearGradient>
            </defs>
            {visiveis.map((r) => {
              const a = pos.get(r.giver_id);
              const b = pos.get(r.receiver_id);
              if (!a || !b) return null;
              // curva suave pelo centro (fica bonita como uma constelação)
              const cx = 50 + (a.x + b.x - 100) * 0.25;
              const cy = 50 + (a.y + b.y - 100) * 0.25;
              return (
                <motion.path
                  key={r.id}
                  d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="url(#linha-ouro)"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                  initial={menosMovimento ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                  style={{ filter: "drop-shadow(0 0 1.2px rgb(242 207 107 / .9))" }}
                />
              );
            })}
          </svg>
          {pessoas.map((p) => {
            const c = pos.get(p.id)!;
            const aceso = ativos.has(p.id);
            return (
              <motion.div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                animate={{ opacity: aceso || fase === "final" ? 1 : 0.35, scale: aceso ? 1 : 0.85 }}
                transition={{ duration: 0.6 }}
              >
                <div className={cn("rounded-full", aceso && "shadow-[0_0_24px_4px_rgb(242_207_107/0.45)]")}>
                  <Avatar nome={p.nome} caminho={p.avatar} tamanho={tamanho} />
                </div>
              </motion.div>
            );
          })}
          <div className="absolute inset-0 flex items-center justify-center px-[22%]" aria-live="polite">
            <AnimatePresence mode="wait">
              {fase === "final" ? (
                <motion.div key="numeros" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                  <span className="font-titulo text-[2.6em] font-semibold leading-none text-ouro-claro">{revelacoes.length}</span>
                  <span className="text-[0.7em] font-semibold uppercase tracking-[0.2em] text-suave">
                    {revelacoes.length === 1 ? "revelação" : "revelações"}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      {fase === "constelacao" ? (
        <div className="min-h-[1.6em]" aria-live="polite">
          <AnimatePresence mode="wait">
            {ultima ? (
              <motion.p
                key={ultima.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="font-titulo text-[1.3em] font-semibold leading-snug"
              >
                {nomeDe(ultima.giver_id)} <span className="text-ouro-claro">tirou</span> {nomeDe(ultima.receiver_id)}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {fase === "final" ? (
        <motion.div initial={menosMovimento ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <p className="max-w-xl text-[0.9em] text-suave">
            {n} participantes, {revelacoes.length} {revelacoes.length === 1 ? "par revelado" : "pares revelados"} e muitas lembranças. Até o
            próximo amigo oculto!
          </p>
          {revelacoes.length === 0 ? <p className="text-[0.8em] text-suave">Ninguém revelou no telão desta vez — o mistério continua.</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            <BotaoLink href={`/grupo/${eventoId}/album`} variante="ouro" tamanho="g" brilho>
              <Images className="size-5" aria-hidden /> Abrir o álbum
            </BotaoLink>
            {!menosMovimento ? (
              <Botao variante="vidro" tamanho="g" onClick={() => setRodada((r) => r + 1)}>
                <RotateCcw className="size-5" aria-hidden /> Ver de novo
              </Botao>
            ) : null}
          </div>
          <Link href={`/grupo/${eventoId}`} className="text-[0.8em] font-semibold text-suave underline-offset-4 hover:underline">
            Voltar ao grupo
          </Link>
        </motion.div>
      ) : null}
    </div>
  );
}

/** Céu de estrelas que cintilam (posições fixas, sem aleatoriedade para não mudar entre servidor e navegador). */
function Estrelas({ parado }: { parado: boolean }) {
  const estrelas = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 37.7) % 100,
    y: (i * 61.3) % 100,
    t: 2 + ((i * 7) % 4),
    d: 2 + ((i * 13) % 7) * 0.5,
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {estrelas.map((e, i) => (
        <span
          key={i}
          className={cn("absolute rounded-full bg-[#fff1c2]", parado ? "opacity-50" : "cintilar")}
          style={{ left: `${e.x}%`, top: `${e.y}%`, width: e.t, height: e.t, ["--duracao" as string]: `${e.d}s` }}
        />
      ))}
    </div>
  );
}
