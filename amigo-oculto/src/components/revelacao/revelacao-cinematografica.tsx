"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { EyeOff, Hand, RotateCcw, SkipForward, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { Avatar } from "@/components/ui/avatar";
import { urlPublicaDaMidia } from "@/lib/env";
import { cn } from "@/lib/cn";
import { Caixa3D } from "@/components/revelacao/caixa-3d";
import { Clarao, EstrelasPalco, Faiscas, RaiosDeLuz } from "@/components/revelacao/efeitos-palco";

export type PessoaRevelada = { nome: string; apelido?: string | null; avatar?: string | null; bio?: string | null };

type Fase = "fechada" | "contagem" | "abrindo" | "revelada";

/** Tamanho da caixa e do retrato pela largura da tela (celular primeiro). */
function useTelaLarga() {
  const [larga, setLarga] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 640px)");
    setLarga(m.matches);
    const f = () => setLarga(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return larga;
}

/** Botão claro sobre o palco escuro (som, animações, pular...). */
function BotaoPalco({
  children,
  className,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2cf6b]/70",
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

/**
 * Revelação cinematográfica do amigo oculto:
 * 1) caixa misteriosa → 2) "Toque no presente" → 3) contagem 3-2-1 → 4) a tampa voa e a fita se desfaz →
 * 5) faíscas, raios de luz e confete → 6) nome e foto → 7) os detalhes (lista de desejos, preferências) entram por baixo.
 * Som e vibração seguem as preferências da conta (e podem ser desligados aqui); "Reduzir animações" troca tudo por
 * esmaecimentos simples. O nome só entra na página no momento da revelação.
 */
export function RevelacaoCinematografica({
  pessoa,
  aoRevelar,
  aoEsconder,
  children,
  rotulo = "Você tirou",
  chamada = "Quem será que você tirou?",
  selo,
  revelarDireto = false,
  className,
}: {
  pessoa: PessoaRevelada;
  /** chamado uma vez, quando o nome aparece */
  aoRevelar?: () => void;
  /** mostra o botão "Esconder" depois da revelação (proteção de olhares) */
  aoEsconder?: () => void;
  /** aparece embaixo do palco depois da revelação (lista de desejos, preferências, sugestões) */
  children?: ReactNode;
  rotulo?: string;
  chamada?: string;
  /** etiqueta no canto do palco (ex.: "Só você vê isto", "Demonstração") */
  selo?: ReactNode;
  revelarDireto?: boolean;
  className?: string;
}) {
  const prefs = usePreferencias();
  const larga = useTelaLarga();
  const [som, setSom] = useState(prefs.som);
  const [simples, setSimples] = useState(prefs.menosMovimento);
  const mexeuSom = useRef(false);
  const mexeuSimples = useRef(false);
  const [fase, setFase] = useState<Fase>(revelarDireto ? "revelada" : "fechada");
  const [numero, setNumero] = useState(3);
  const [rodada, setRodada] = useState(0);
  const confete = useRef<ConfeteHandle>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const focarNome = useRef(false);
  const jaAvisou = useRef(false);
  const comemorar = useRef(!revelarDireto);
  const somRef = useRef(som);
  const simplesRef = useRef(simples);
  const vibrarRef = useRef(prefs.vibracao);
  const aoRevelarRef = useRef(aoRevelar);
  const dicaId = useId();

  // as preferências chegam/mudam depois da hidratação (ex.: "reduzir movimento" do sistema)
  useEffect(() => {
    if (!mexeuSom.current) setSom(prefs.som);
  }, [prefs.som]);
  useEffect(() => {
    if (!mexeuSimples.current) setSimples(prefs.menosMovimento);
  }, [prefs.menosMovimento]);
  useEffect(() => {
    somRef.current = som;
    simplesRef.current = simples;
    vibrarRef.current = prefs.vibracao;
    aoRevelarRef.current = aoRevelar;
  });

  // a foto já fica no cache antes da revelação (sem "piscar" ao aparecer)
  useEffect(() => {
    const url = urlPublicaDaMidia(pessoa.avatar);
    if (url) {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = url;
    }
  }, [pessoa.avatar]);

  function iniciar() {
    if (fase !== "fechada") return;
    comemorar.current = true;
    setNumero(3);
    setFase("contagem");
    tocar("contagem", som);
    vibrar(35, prefs.vibracao);
    // o palco inteiro à vista durante a contagem (no celular a caixa pode estar no pé da tela)
    const r = palco.current?.getBoundingClientRect();
    if (r && (r.top < 0 || r.bottom > window.innerHeight)) palco.current?.scrollIntoView({ block: "center", behavior: simples ? "auto" : "smooth" });
  }

  // contagem 3 → 2 → 1 → abre
  useEffect(() => {
    if (fase !== "contagem") return;
    const passo = (n: number) => {
      setNumero(n);
      tocar("contagem", somRef.current);
      vibrar(n === 1 ? 60 : 35, vibrarRef.current);
    };
    const t = [
      window.setTimeout(() => passo(2), 1000),
      window.setTimeout(() => passo(1), 2000),
      window.setTimeout(() => setFase("abrindo"), 3000),
    ];
    return () => t.forEach(clearTimeout);
  }, [fase, rodada]);

  // abertura: tampa voa, luz sai de dentro
  useEffect(() => {
    if (fase !== "abrindo") return;
    tocar("abrir", somRef.current);
    vibrar([50, 40, 110], vibrarRef.current);
    const t = window.setTimeout(() => setFase("revelada"), simplesRef.current ? 450 : 1150);
    return () => clearTimeout(t);
  }, [fase]);

  // revelação: confete, som, foco no nome, avisa quem chamou (uma vez)
  useEffect(() => {
    if (fase !== "revelada") return;
    const t: number[] = [];
    if (comemorar.current) {
      tocar("revelar", somRef.current);
      vibrar([40, 50, 40, 50, 200], vibrarRef.current);
      if (!simplesRef.current) {
        confete.current?.disparar({ quantidade: 170, origemY: 0.42, espalhar: 1.05 });
        t.push(window.setTimeout(() => confete.current?.disparar({ quantidade: 60, origemX: 0.12, origemY: 0.7, espalhar: 0.8 }), 380));
        t.push(window.setTimeout(() => confete.current?.disparar({ quantidade: 60, origemX: 0.88, origemY: 0.7, espalhar: 0.8 }), 520));
      }
      // o foco vai para o nome quando ele entrar na tela (ref do título); se já está na tela, agora
      if (titulo.current) t.push(window.setTimeout(() => titulo.current?.focus({ preventScroll: true }), 300));
      else focarNome.current = true;
    }
    if (!jaAvisou.current) {
      jaAvisou.current = true;
      aoRevelarRef.current?.();
    }
    return () => t.forEach(clearTimeout);
  }, [fase, rodada]);

  function pular() {
    setFase("revelada");
  }

  function deNovo() {
    comemorar.current = true;
    setRodada((r) => r + 1);
    setFase("fechada");
  }

  const tamCaixa = larga ? 214 : 164;
  const tamFoto = larga ? 148 : 116;
  const aberta = fase === "abrindo" || fase === "revelada";
  const anuncio =
    fase === "contagem" ? `${numero}` : fase === "abrindo" ? "Abrindo o presente…" : fase === "revelada" ? `${rotulo}: ${pessoa.nome}!` : "";

  return (
    <MotionConfig reducedMotion={simples ? "always" : "never"}>
      <section aria-label="Revelação do amigo oculto" className={cn("flex flex-col gap-5", className)}>
        <div ref={palco} className="palco-revelacao relative isolate flex min-h-[32rem] flex-col overflow-hidden rounded-[2rem] shadow-vidro ring-1 ring-black/10 sm:min-h-[37rem]">
          <EstrelasPalco />
          <RaiosDeLuz ligado={aberta} simples={simples} tamanho={larga ? 640 : 460} />
          <Clarao ativo={fase === "abrindo" && !simples} />

          {/* topo: selo e controles */}
          <div className="relative z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
            <div className="min-w-0 pt-1.5">{selo}</div>
            <div className="flex shrink-0 gap-2">
              <BotaoPalco
                aria-pressed={som}
                title={som ? "Desligar o som" : "Ligar o som"}
                onClick={() => {
                  mexeuSom.current = true;
                  setSom((s) => !s);
                }}
                className="px-3 sm:px-4"
              >
                {som ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
                <span className="sr-only sm:not-sr-only">Som</span>
              </BotaoPalco>
              <BotaoPalco
                aria-pressed={simples}
                title={simples ? "Voltar às animações completas" : "Reduzir animações"}
                onClick={() => {
                  mexeuSimples.current = true;
                  setSimples((s) => !s);
                }}
                className="px-3 sm:px-4"
              >
                {simples ? <Wind className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                <span className="sr-only sm:not-sr-only">Reduzir animações</span>
              </BotaoPalco>
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-8">
            <AnimatePresence mode="wait" initial={false}>
              {fase !== "revelada" ? (
                <motion.div
                  key={`caixa-${rodada}`}
                  className="relative flex flex-col items-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, y: 30 }}
                  transition={{ duration: 0.45 }}
                >
                  <p className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#f7d983]">
                    {fase === "fechada" ? chamada : fase === "contagem" ? "Prepare-se…" : "Abrindo!"}
                  </p>

                  {/* brilho atrás da caixa */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 -z-10 rounded-full"
                    style={{
                      width: tamCaixa * 1.9,
                      height: tamCaixa * 1.9,
                      marginLeft: -tamCaixa * 0.95,
                      marginTop: -tamCaixa * 0.95,
                      background: "radial-gradient(circle, rgb(242 207 107 / 0.45), rgb(226 57 79 / 0.16) 45%, transparent 70%)",
                    }}
                    animate={simples ? { opacity: 0.8 } : { opacity: [0.55, 1, 0.55], scale: [0.95, 1.06, 0.95] }}
                    transition={simples ? { duration: 0.3 } : { duration: fase === "contagem" ? 1 : 3.2, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {fase === "fechada" ? (
                    <button
                      type="button"
                      onClick={iniciar}
                      aria-describedby={dicaId}
                      className="group relative flex flex-col items-center rounded-[2rem] px-2 pb-2 outline-none focus-visible:ring-4 focus-visible:ring-[#f2cf6b]/70"
                    >
                      <span className="transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-95">
                        <Caixa3D fase="parada" tamanho={tamCaixa} simples={simples} />
                      </span>
                      <span className="pulsar-anel -mt-1 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f7dc8e,#e2b04a_55%,#c48c22)] px-6 text-base font-bold text-[#3b2a06] shadow-brilho">
                        <Hand className="size-5" aria-hidden />
                        Toque no presente
                      </span>
                    </button>
                  ) : (
                    <div className="relative px-2 pb-2">
                      <Caixa3D fase={fase === "contagem" ? "tremendo" : "abrindo"} tremor={fase === "contagem" ? 3 - numero : 0} tamanho={tamCaixa} simples={simples} />
                      <Faiscas ativo={fase === "abrindo" && !simples} />
                      {/* contagem sobre a caixa */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <AnimatePresence mode="popLayout">
                          {fase === "contagem" ? (
                            <motion.span
                              key={numero}
                              aria-hidden
                              className="ouro-palco font-titulo text-[7.5rem] font-bold leading-none sm:text-[10rem]"
                              style={{ filter: "drop-shadow(0 4px 0 rgb(70 8 22 / 0.8)) drop-shadow(0 0 26px rgb(242 207 107 / 0.65))" }}
                              initial={{ opacity: 0, scale: 2.4 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.4 }}
                              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                            >
                              {numero}
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  <p id={dicaId} className="mt-4 max-w-xs text-center text-sm text-white/75">
                    {fase === "fechada"
                      ? "Toque, conte até três com a gente e descubra. Ninguém mais vê o seu resultado."
                      : fase === "contagem"
                        ? "Contagem regressiva…"
                        : "O presente está abrindo!"}
                  </p>
                  {fase !== "fechada" ? (
                    <BotaoPalco onClick={pular} className="mt-4 bg-transparent text-white/80 ring-white/15">
                      <SkipForward className="size-4" aria-hidden />
                      Pular animação
                    </BotaoPalco>
                  ) : null}
                </motion.div>
              ) : (
                <motion.div
                  key={`pessoa-${rodada}`}
                  className="relative flex w-full max-w-xl flex-col items-center text-center"
                  initial={{ opacity: 0, scale: 0.8, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.9 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f7d983]">{rotulo}</p>
                  <div className="relative mt-5">
                    <motion.div
                      className="rounded-full p-[5px] shadow-[0_0_70px_-6px_rgb(242_207_107/0.8)]"
                      style={{ background: "conic-gradient(from 210deg, #f7d983, #b8861f, #fff3c9, #c9962b, #f7d983)" }}
                      initial={{ rotate: -25 }}
                      animate={{ rotate: 0 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    >
                      <div className="rounded-full bg-[#1d0a12] p-1">
                        <Avatar nome={pessoa.nome} caminho={pessoa.avatar} tamanho={tamFoto} />
                      </div>
                    </motion.div>
                    {[
                      { x: "-18%", y: "8%", d: 0.2, s: 22 },
                      { x: "100%", y: "0%", d: 0.35, s: 16 },
                      { x: "92%", y: "78%", d: 0.5, s: 20 },
                      { x: "-10%", y: "80%", d: 0.65, s: 14 },
                    ].map((e, i) => (
                      <motion.span
                        key={i}
                        aria-hidden
                        className="absolute text-[#f7d983]"
                        style={{ left: e.x, top: e.y }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0.7], scale: [0, 1.2, 1] }}
                        transition={{ delay: e.d, duration: 0.7 }}
                      >
                        <Sparkles style={{ width: e.s, height: e.s }} />
                      </motion.span>
                    ))}
                  </div>
                  <h2
                    ref={(el) => {
                      titulo.current = el;
                      // ao entrar depois da animação, o foco vai para o nome (leitores de tela e teclado continuam dali)
                      if (el && focarNome.current) {
                        focarNome.current = false;
                        window.setTimeout(() => el.focus({ preventScroll: true }), 300);
                      }
                    }}
                    tabIndex={-1}
                    className="ouro-palco mt-5 max-w-full font-titulo text-4xl font-semibold leading-[1.1] break-words outline-none [hyphens:auto] [text-wrap:balance] sm:text-6xl"
                  >
                    {pessoa.nome}
                  </h2>
                  {pessoa.apelido ? <p className="mt-2 text-base text-white/80">Apelido: “{pessoa.apelido}”</p> : null}
                  {pessoa.bio ? <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">“{pessoa.bio}”</p> : null}
                  <div className="mt-7 flex flex-wrap justify-center gap-2">
                    <BotaoPalco onClick={deNovo}>
                      <RotateCcw className="size-4" aria-hidden />
                      Ver a animação de novo
                    </BotaoPalco>
                    {aoEsconder ? (
                      <BotaoPalco onClick={aoEsconder}>
                        <EyeOff className="size-4" aria-hidden />
                        Esconder
                      </BotaoPalco>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {anuncio}
          </p>
        </div>

        {fase === "revelada" && children ? (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: comemorar.current ? 0.9 : 0, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
        <Confete ref={confete} desligado={simples} />
      </section>
    </MotionConfig>
  );
}
