"use client";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";

/**
 * Caixa de presente em 3D de verdade (CSS 3D: seis faces, tampa com espessura e laço dourado de dois planos).
 * Fases: "parada" (flutua e gira de leve), "tremendo" (a contagem: treme mais a cada número), "abrindo" (a tampa voa,
 * a fita se desfaz e a luz sai de dentro) e "aberta". Puramente visual (aria-hidden): quem chama põe o botão.
 */
export type FaseCaixa = "parada" | "tremendo" | "abrindo" | "aberta";

const VERMELHO = {
  frente: "linear-gradient(165deg, #ef4a5f 0%, #c81e34 55%, #9e1128 100%)",
  lado: "linear-gradient(165deg, #b8172d 0%, #8f0f22 70%, #6e0a1a 100%)",
  fundo: "#5c0816",
  tampaTopo: "linear-gradient(135deg, #ff6b7d 0%, #e2394f 45%, #b3172d 100%)",
  tampaFrente: "linear-gradient(180deg, #e2394f, #a5142a)",
  tampaLado: "linear-gradient(180deg, #b3172d, #7c0c1d)",
  tampaBaixo: "#5c0816",
};
const OURO = {
  claro: "linear-gradient(90deg, #a87917 0%, #f7dc8e 38%, #fff3c9 50%, #e2b04a 64%, #a87917 100%)",
  escuro: "linear-gradient(90deg, #7f5a0f 0%, #c99a35 45%, #e8c46a 55%, #7f5a0f 100%)",
};

function Face({ estilo, fundo, children, className }: { estilo: CSSProperties; fundo: string; children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{ position: "absolute", left: 0, top: 0, background: fundo, backfaceVisibility: "visible", ...estilo }}
    >
      {children}
    </div>
  );
}

/** Faixa dourada vertical no meio de uma face (a fita). */
function Fita({ largura, ouro, desfeita, atraso = 0 }: { largura: number; ouro: string; desfeita: boolean; atraso?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        width: largura,
        marginLeft: -largura / 2,
        background: ouro,
        boxShadow: "0 0 0 1px rgb(120 80 10 / 0.25)",
        transformOrigin: "50% 100%",
        transform: desfeita ? "scaleY(0)" : "scaleY(1)",
        opacity: desfeita ? 0 : 1,
        transition: `transform 0.55s cubic-bezier(.6,0,.4,1) ${atraso}s, opacity 0.4s ease ${atraso + 0.2}s`,
      }}
    />
  );
}

/** Laço: duas alças e as pontas, desenhado em SVG (usado em dois planos cruzados para parecer 3D). */
function Laco({ largura, id }: { largura: number; id: string }) {
  return (
    <svg viewBox="0 0 120 70" width={largura} height={(largura * 70) / 120} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c9" />
          <stop offset=".45" stopColor="#f2cf6b" />
          <stop offset="1" stopColor="#a87917" />
        </linearGradient>
        <linearGradient id={`${id}-d`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7dc8e" />
          <stop offset=".5" stopColor="#d9a63c" />
          <stop offset="1" stopColor="#8a6212" />
        </linearGradient>
      </defs>
      {/* alças */}
      <path d="M60 58 C 40 40, 10 22, 14 8 C 18 -4, 42 4, 60 46 Z" fill={`url(#${id}-l)`} stroke="#8a6212" strokeWidth="1.2" />
      <path d="M60 58 C 80 40, 110 22, 106 8 C 102 -4, 78 4, 60 46 Z" fill={`url(#${id}-d)`} stroke="#8a6212" strokeWidth="1.2" />
      {/* brilho das alças */}
      <path d="M24 12 C 30 10, 44 22, 54 40" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <path d="M96 12 C 90 10, 76 22, 66 40" fill="none" stroke="#fffaf0" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
      {/* nó */}
      <ellipse cx="60" cy="54" rx="10" ry="11" fill={`url(#${id}-l)`} stroke="#8a6212" strokeWidth="1.2" />
    </svg>
  );
}

export function Caixa3D({
  fase,
  tamanho = 190,
  tremor = 0,
  simples = false,
}: {
  fase: FaseCaixa;
  /** lado da caixa em px */
  tamanho?: number;
  /** 0 a 3: quanto treme na contagem */
  tremor?: number;
  simples?: boolean;
}) {
  const l = tamanho;
  const a = Math.round(l * 0.74); // altura do corpo
  const T = Math.round(l * 1.12); // lado da tampa
  const t = Math.round(l * 0.22); // espessura da tampa
  const fita = Math.round(l * 0.17);
  const laco = Math.round(l * 0.95);
  const lacoAlt = Math.round((laco * 70) / 120);
  const aberta = fase === "abrindo" || fase === "aberta";
  const id = `laco-${tamanho}`;

  // rotação de base: vemos a frente, o lado direito e o topo
  const base = { rotateX: -18, rotateY: -32 };
  const giro =
    simples || fase === "aberta"
      ? { ...base, y: 0, rotateZ: 0 }
      : fase === "tremendo"
        ? {
            ...base,
            y: 0,
            rotateZ: [0, -2 - tremor * 1.6, 2 + tremor * 1.6, -1.5 - tremor, 1.5 + tremor, 0],
            x: [0, -2 - tremor * 2, 2 + tremor * 2, 0],
          }
        : fase === "abrindo"
          ? { rotateX: -24, rotateY: -28, y: 8, rotateZ: 0, x: 0 }
          : { rotateX: -18, rotateY: [-36, -26, -36], y: [0, -12, 0], rotateZ: 0, x: 0 };
  const transicaoGiro =
    fase === "tremendo"
      ? { duration: Math.max(0.28, 0.5 - tremor * 0.07), repeat: Infinity, ease: "easeInOut" as const }
      : fase === "parada" && !simples
        ? { duration: 7, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 0.5, ease: "easeOut" as const };

  const altura = a + t + lacoAlt;

  return (
    <div aria-hidden className="relative select-none" style={{ width: T + 40, height: altura + 40, perspective: 1100 }}>
      {/* sombra no chão */}
      <motion.div
        className="absolute left-1/2 rounded-[50%] bg-black/45 blur-md"
        style={{ width: l * 1.15, height: l * 0.22, marginLeft: -(l * 1.15) / 2, bottom: 4 }}
        animate={fase === "parada" && !simples ? { scale: [1, 0.86, 1], opacity: [0.55, 0.38, 0.55] } : { scale: 1, opacity: 0.5 }}
        transition={fase === "parada" && !simples ? { duration: 7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      />
      <motion.div
        className="absolute"
        style={{
          width: l,
          height: a,
          left: (T + 40 - l) / 2,
          bottom: 20 + l * 0.11,
          transformStyle: "preserve-3d",
        }}
        initial={base}
        animate={giro}
        transition={transicaoGiro}
      >
        {/* ---------- corpo ---------- */}
        <Face fundo={VERMELHO.frente} estilo={{ width: l, height: a, transform: `translateZ(${l / 2}px)`, overflow: "hidden" }} className="brilho">
          <Fita largura={fita} ouro={OURO.claro} desfeita={aberta} atraso={0.1} />
        </Face>
        <Face fundo={VERMELHO.lado} estilo={{ width: l, height: a, transform: `rotateY(180deg) translateZ(${l / 2}px)` }}>
          <Fita largura={fita} ouro={OURO.escuro} desfeita={aberta} atraso={0.1} />
        </Face>
        <Face fundo={VERMELHO.lado} estilo={{ width: l, height: a, transform: `rotateY(90deg) translateZ(${l / 2}px)` }}>
          <Fita largura={fita} ouro={OURO.escuro} desfeita={aberta} atraso={0.15} />
        </Face>
        <Face fundo={VERMELHO.lado} estilo={{ width: l, height: a, transform: `rotateY(-90deg) translateZ(${l / 2}px)` }}>
          <Fita largura={fita} ouro={OURO.escuro} desfeita={aberta} atraso={0.15} />
        </Face>
        <Face fundo={VERMELHO.fundo} estilo={{ width: l, height: l, top: (a - l) / 2, transform: `rotateX(-90deg) translateZ(${a / 2}px)` }} />
        {/* luz que sai de dentro quando abre */}
        <Face
          fundo="radial-gradient(circle at 50% 50%, #fffbe8 0%, #ffe39a 30%, rgb(242 207 107 / 0.6) 55%, rgb(120 10 30 / 0.9) 100%)"
          estilo={{
            width: l,
            height: l,
            top: (a - l) / 2,
            transform: `rotateX(90deg) translateZ(${a / 2 - 3}px)`,
            opacity: aberta ? 1 : 0,
            transition: "opacity 0.35s ease 0.15s",
          }}
        />

        {/* ---------- tampa ---------- */}
        <motion.div
          style={{
            position: "absolute",
            width: T,
            height: t,
            left: (l - T) / 2,
            top: -t + Math.round(t * 0.35),
            transformStyle: "preserve-3d",
          }}
          initial={{ y: 0, x: 0, rotateZ: 0, rotateX: 0, opacity: 1 }}
          animate={
            aberta
              ? simples
                ? { opacity: 0 }
                : { y: -l * 1.25, x: l * 0.42, rotateZ: 32, rotateX: -42, opacity: [1, 1, 0] }
              : fase === "tremendo"
                ? { y: [0, -3 - tremor * 2, 0], x: 0, rotateZ: 0, rotateX: 0, opacity: 1 }
                : { y: 0, x: 0, rotateZ: 0, rotateX: 0, opacity: 1 }
          }
          transition={
            aberta
              ? { duration: simples ? 0.4 : 1.05, ease: [0.2, 0.7, 0.3, 1], opacity: { duration: simples ? 0.4 : 1.05, times: [0, 0.7, 1] } }
              : fase === "tremendo"
                ? { duration: 0.32, repeat: Infinity }
                : { duration: 0.3 }
          }
        >
          <Face fundo={VERMELHO.tampaFrente} estilo={{ width: T, height: t, transform: `translateZ(${T / 2}px)` }}>
            <Fita largura={fita} ouro={OURO.claro} desfeita={false} />
          </Face>
          <Face fundo={VERMELHO.tampaLado} estilo={{ width: T, height: t, transform: `rotateY(180deg) translateZ(${T / 2}px)` }}>
            <Fita largura={fita} ouro={OURO.escuro} desfeita={false} />
          </Face>
          <Face fundo={VERMELHO.tampaLado} estilo={{ width: T, height: t, transform: `rotateY(90deg) translateZ(${T / 2}px)` }}>
            <Fita largura={fita} ouro={OURO.escuro} desfeita={false} />
          </Face>
          <Face fundo={VERMELHO.tampaLado} estilo={{ width: T, height: t, transform: `rotateY(-90deg) translateZ(${T / 2}px)` }}>
            <Fita largura={fita} ouro={OURO.escuro} desfeita={false} />
          </Face>
          <Face fundo={VERMELHO.tampaBaixo} estilo={{ width: T, height: T, top: (t - T) / 2, transform: `rotateX(-90deg) translateZ(${t / 2}px)` }} />
          <Face fundo={VERMELHO.tampaTopo} estilo={{ width: T, height: T, top: (t - T) / 2, transform: `rotateX(90deg) translateZ(${t / 2}px)` }}>
            {/* fita em cruz no topo */}
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: fita, marginLeft: -fita / 2, background: OURO.claro }} />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: fita,
                marginTop: -fita / 2,
                background: "linear-gradient(180deg, #a87917 0%, #f7dc8e 38%, #fff3c9 50%, #e2b04a 64%, #a87917 100%)",
              }}
            />
          </Face>
          {/* laço em dois planos cruzados, em pé sobre o topo */}
          <div
            style={{
              position: "absolute",
              left: (T - laco) / 2,
              top: -lacoAlt + Math.round(lacoAlt * 0.08),
              width: laco,
              height: lacoAlt,
              transformStyle: "preserve-3d",
            }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              <Laco largura={laco} id={`${id}-a`} />
            </div>
            <div style={{ position: "absolute", inset: 0, transform: "rotateY(90deg)" }}>
              <Laco largura={laco} id={`${id}-b`} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
