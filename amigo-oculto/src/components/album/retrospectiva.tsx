"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Crown, Gift, Pause, Play, Quote, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MarcaPresente } from "@/components/ui/logo";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { dataCurta } from "@/lib/formatos";
import { cn } from "@/lib/cn";

type P = { nome: string; avatar: string | null };
export type DadosRetrospectiva = {
  evento: { nome: string; data: string | null };
  pessoas: (P & { id: string })[];
  numeros: { rotulo: string; valor: number }[];
  recados: { texto: string; autor: string }[];
  fotos: string[];
  revelacoes: { de: P; para: P }[];
  destaques: (P & { pontos: number })[];
};

const DURACAO = 5600;

/** Retrospectiva no estilo "stories": avança sozinha, com play/pausa e setas. Com menos movimento, vira uma lista parada. */
export function Retrospectiva({ dados }: { dados: DadosRetrospectiva }) {
  const { menosMovimento } = usePreferencias();
  const slides = useMemo(() => montarSlides(dados), [dados]);
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [inicio, setInicio] = useState(0);
  const [agora, setAgora] = useState(0);

  const ir = useCallback(
    (n: number) => {
      setI(Math.max(0, Math.min(slides.length - 1, n)));
      setInicio(performance.now());
    },
    [slides.length],
  );

  useEffect(() => {
    if (!tocando) return;
    let quadro = 0;
    const passo = (t: number) => {
      setAgora(t);
      if (t - inicio >= DURACAO) {
        if (i >= slides.length - 1) {
          setTocando(false);
          return;
        }
        setI((x) => x + 1);
        setInicio(t);
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [tocando, inicio, i, slides.length]);

  if (menosMovimento) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-suave">Versão sem animações (você pediu menos movimento).</p>
        {slides.map((s) => (
          <div key={s.id} className="relative overflow-hidden rounded-cartao bg-[linear-gradient(150deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))] p-6 text-white">
            {s.conteudo(false)}
          </div>
        ))}
      </div>
    );
  }

  const progresso = tocando ? Math.min(1, (agora - inicio) / DURACAO) : 0;
  const s = slides[i];
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative isolate aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] bg-[linear-gradient(150deg,var(--t1),color-mix(in_oklab,var(--t2)_75%,black)_70%)] text-white shadow-[0_30px_60px_-25px_rgb(0_0_0/0.6)] sm:aspect-video sm:max-w-3xl"
        role="region"
        aria-roledescription="apresentação"
        aria-label={`Retrospectiva: ${s.titulo} (${i + 1} de ${slides.length})`}
      >
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(255_255_255/0.18),transparent_45%),radial-gradient(circle_at_90%_90%,rgb(242_207_107/0.25),transparent_50%)]" />
        <div className="absolute inset-x-4 top-4 z-10 flex gap-1.5" aria-hidden>
          {slides.map((x, k) => (
            <div key={x.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progresso * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-8 pt-12 text-center sm:px-12"
          >
            {s.conteudo(true)}
          </motion.div>
        </AnimatePresence>
        <button type="button" className="absolute inset-y-0 left-0 z-10 w-1/4" onClick={() => ir(i - 1)} aria-label="Slide anterior" />
        <button type="button" className="absolute inset-y-0 right-0 z-10 w-1/4" onClick={() => ir(i + 1)} aria-label="Próximo slide" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} className="vidro inline-flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label="Anterior">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!tocando && i === slides.length - 1) ir(0);
            else setInicio(performance.now() - (tocando ? 0 : progresso * DURACAO));
            setTocando((v) => !v);
          }}
          className="inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] px-5 font-semibold text-white shadow-md"
        >
          {tocando ? <Pause className="size-5" aria-hidden /> : i === slides.length - 1 ? <RotateCcw className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          {tocando ? "Pausar" : i === slides.length - 1 ? "Rever" : i === 0 ? "Assistir" : "Continuar"}
        </button>
        <button type="button" onClick={() => ir(i + 1)} disabled={i === slides.length - 1} className="vidro inline-flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label="Próximo">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <p className="text-xs text-suave" aria-live="polite">
        {i + 1} de {slides.length} · {s.titulo}
      </p>
    </div>
  );
}

type Slide = { id: string; titulo: string; conteudo: (animado: boolean) => ReactNode };

function Titulo({ children, pequeno }: { children: ReactNode; pequeno?: string }) {
  return (
    <>
      {pequeno ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/75">{pequeno}</p> : null}
      <h3 className="mt-2 font-titulo text-3xl font-semibold leading-tight sm:text-4xl">{children}</h3>
    </>
  );
}

function Contador({ valor, animado }: { valor: number; animado: boolean }) {
  const [v, setV] = useState(animado ? 0 : valor);
  useEffect(() => {
    if (!animado) return;
    let q = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const f = Math.min(1, (t - t0) / 1200);
      setV(Math.round(valor * (1 - Math.pow(1 - f, 3))));
      if (f < 1) q = requestAnimationFrame(passo);
    };
    q = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(q);
  }, [valor, animado]);
  return <>{v}</>;
}

function aparecer(animado: boolean, atraso = 0) {
  return animado
    ? { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: atraso, type: "spring" as const, stiffness: 160, damping: 16 } }
    : {};
}

function montarSlides(d: DadosRetrospectiva): Slide[] {
  const s: Slide[] = [];
  s.push({
    id: "abertura",
    titulo: "Abertura",
    conteudo: (a) => (
      <>
        <motion.div {...aparecer(a)}>
          <MarcaPresente tamanho={72} className="mx-auto" />
        </motion.div>
        <motion.div {...aparecer(a, 0.2)} className="mt-4">
          <Titulo pequeno="Retrospectiva">{d.evento.nome}</Titulo>
        </motion.div>
        {d.evento.data ? (
          <motion.p {...aparecer(a, 0.4)} className="mt-3 text-white/80">
            {dataCurta(d.evento.data)}
          </motion.p>
        ) : null}
      </>
    ),
  });
  if (d.pessoas.length) {
    s.push({
      id: "turma",
      titulo: "A turma",
      conteudo: (a) => (
        <>
          <Titulo pequeno="A turma">{d.pessoas.length} pessoas especiais</Titulo>
          <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-3">
            {d.pessoas.slice(0, 24).map((p, k) => (
              <motion.div key={p.id} {...aparecer(a, 0.2 + k * 0.06)} className="flex w-16 flex-col items-center gap-1">
                <Avatar nome={p.nome} caminho={p.avatar} tamanho={48} />
                <span className="w-full truncate text-[11px] text-white/85">{p.nome.split(" ")[0]}</span>
              </motion.div>
            ))}
          </div>
        </>
      ),
    });
  }
  const numeros = d.numeros.filter((n) => n.valor > 0);
  if (numeros.length) {
    s.push({
      id: "numeros",
      titulo: "Em números",
      conteudo: (a) => (
        <>
          <Titulo pequeno="Em números">O que vivemos juntos</Titulo>
          <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
            {numeros.slice(0, 6).map((n, k) => (
              <motion.div key={n.rotulo} {...aparecer(a, 0.15 + k * 0.1)} className="rounded-2xl bg-white/12 px-3 py-3 backdrop-blur">
                <p className="font-titulo text-4xl font-semibold text-[#ffe9a6]">
                  <Contador valor={n.valor} animado={a} />
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{n.rotulo}</p>
              </motion.div>
            ))}
          </div>
        </>
      ),
    });
  }
  if (d.recados.length) {
    s.push({
      id: "recados",
      titulo: "Recados",
      conteudo: (a) => (
        <>
          <Titulo pequeno="Recados">Palavras que ficaram</Titulo>
          <div className="mt-5 flex w-full max-w-lg flex-col gap-3">
            {d.recados.slice(0, 3).map((r, k) => (
              <motion.blockquote key={k} {...aparecer(a, 0.2 + k * 0.5)} className="rounded-2xl bg-white/12 px-4 py-3 text-left backdrop-blur">
                <Quote className="mb-1 size-4 text-[#ffe9a6]" aria-hidden />
                <p className="line-clamp-3 text-[15px]">{r.texto}</p>
                <footer className="mt-1 text-xs text-white/75">— {r.autor}</footer>
              </motion.blockquote>
            ))}
          </div>
        </>
      ),
    });
  }
  if (d.fotos.length) {
    s.push({
      id: "fotos",
      titulo: "Fotos",
      conteudo: (a) => (
        <>
          <Titulo pequeno="Fotos">Momentos guardados</Titulo>
          <div className="mt-5 grid w-full max-w-lg grid-cols-3 gap-2">
            {d.fotos.slice(0, 6).map((u, k) => (
              <motion.div
                key={u}
                initial={a ? { opacity: 0, scale: 0.7, rotate: (k % 2 ? 6 : -6) } : false}
                animate={{ opacity: 1, scale: 1, rotate: (k % 2 ? 2 : -2) }}
                transition={{ delay: 0.2 + k * 0.18, type: "spring", stiffness: 140, damping: 14 }}
                className="aspect-square overflow-hidden rounded-xl border-4 border-white shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
              </motion.div>
            ))}
          </div>
        </>
      ),
    });
  }
  if (d.revelacoes.length) {
    s.push({
      id: "revelacoes",
      titulo: "Revelações",
      conteudo: (a) => (
        <>
          <Titulo pequeno="A grande revelação">Quem tirou quem</Titulo>
          <ul className="mt-5 flex w-full max-w-md flex-col gap-2">
            {d.revelacoes.slice(0, 6).map((r, k) => (
              <motion.li key={k} {...aparecer(a, 0.2 + k * 0.35)} className="flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-2 backdrop-blur">
                <Avatar nome={r.de.nome} caminho={r.de.avatar} tamanho={32} />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{r.de.nome}</span>
                <Gift className="size-4 shrink-0 text-[#ffe9a6]" aria-label="tirou" />
                <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">{r.para.nome}</span>
                <Avatar nome={r.para.nome} caminho={r.para.avatar} tamanho={32} />
              </motion.li>
            ))}
            {d.revelacoes.length > 6 ? <li className="text-sm text-white/75">e mais {d.revelacoes.length - 6}…</li> : null}
          </ul>
        </>
      ),
    });
  }
  if (d.destaques.length && d.destaques[0].pontos > 0) {
    s.push({
      id: "destaques",
      titulo: "Destaques",
      conteudo: (a) => (
        <>
          <Titulo pequeno="Ranking">Quem mais participou</Titulo>
          <div className="mt-6 flex items-end justify-center gap-4">
            {[1, 0, 2].map((k) => {
              const p = d.destaques[k];
              if (!p) return null;
              return (
                <motion.div key={k} {...aparecer(a, 0.3 + (k === 0 ? 0.6 : k * 0.2))} className={cn("flex flex-col items-center gap-1", k === 0 ? "pb-6" : "")}>
                  {k === 0 ? <Crown className="size-6 text-[#ffe9a6]" aria-hidden /> : null}
                  <Avatar nome={p.nome} caminho={p.avatar} tamanho={k === 0 ? 76 : 56} anel={k === 0} />
                  <span className="max-w-24 truncate text-sm font-semibold">{p.nome.split(" ")[0]}</span>
                  <span className="text-xs text-white/75">{p.pontos} pts</span>
                </motion.div>
              );
            })}
          </div>
        </>
      ),
    });
  }
  s.push({
    id: "fim",
    titulo: "Até a próxima",
    conteudo: (a) => (
      <>
        <motion.div {...aparecer(a)} className="flex flex-col items-center">
          <MarcaPresente tamanho={64} />
          <Titulo>Até o próximo amigo oculto!</Titulo>
          <p className="mt-3 max-w-sm text-white/80">Obrigado por fazer parte de {d.evento.nome}.</p>
        </motion.div>
      </>
    ),
  });
  return s;
}
