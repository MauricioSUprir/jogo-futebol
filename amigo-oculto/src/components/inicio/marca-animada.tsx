"use client";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePreferencias } from "@/components/efeitos/preferencias";

/**
 * O logotipo em versão grande e viva: a mesma caixa de presente da marca, com a tampa "respirando", a estrela do
 * laço brilhando e girando de leve, e faíscas em volta. Parado com movimento reduzido.
 */
export function MarcaAnimada({ tamanho = 96 }: { tamanho?: number }) {
  const id = useId().replace(/:/g, "");
  const sistemaReduz = useReducedMotion();
  const { menosMovimento } = usePreferencias();
  const parado = !!sistemaReduz || menosMovimento;
  const loop = (duracao: number, atraso = 0) => (parado ? { duration: 0 } : { duration: duracao, repeat: Infinity, ease: "easeInOut" as const, delay: atraso });

  return (
    <div className="relative inline-flex" style={{ width: tamanho * 1.45, height: tamanho * 1.45 }}>
      {/* halo dourado */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(242 207 107 / 0.55), rgb(226 57 79 / 0.12) 50%, transparent 70%)" }}
        animate={parado ? { opacity: 0.8 } : { opacity: [0.6, 1, 0.6], scale: [0.94, 1.05, 0.94] }}
        transition={loop(4)}
      />
      <motion.svg
        viewBox="0 0 64 64"
        width={tamanho}
        height={tamanho}
        className="relative m-auto drop-shadow-[0_14px_22px_rgb(143_15_34/0.35)]"
        role="img"
        aria-label="Amigo Oculto"
        animate={parado ? { y: 0 } : { y: [0, -6, 0] }}
        transition={loop(5)}
      >
        <defs>
          <linearGradient id={`${id}-caixa`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2394f" />
            <stop offset="1" stopColor="#8f0f22" />
          </linearGradient>
          <linearGradient id={`${id}-tampa`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ef4a5f" />
            <stop offset="1" stopColor="#b3172d" />
          </linearGradient>
          <linearGradient id={`${id}-ouro`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff1c2" />
            <stop offset=".45" stopColor="#f2cf6b" />
            <stop offset="1" stopColor="#b8861f" />
          </linearGradient>
          <linearGradient id={`${id}-verde`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#19b383" />
            <stop offset="1" stopColor="#064d36" />
          </linearGradient>
        </defs>
        <rect x="10" y="30" width="44" height="28" rx="6" fill={`url(#${id}-caixa)`} />
        <rect x="31" y="30" width="2" height="28" fill="#000" opacity=".08" />
        <rect x="28" y="30" width="8" height="28" fill={`url(#${id}-verde)`} />
        <circle cx="32" cy="44" r="6.2" fill="#fffdf8" opacity=".95" />
        <path d="M30 42.2c.2-1.4 1.2-2.2 2.4-2.2 1.4 0 2.4.9 2.4 2.1 0 1.8-2.4 1.9-2.4 3.6" fill="none" stroke="#8f0f22" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="32.4" cy="47.8" r=".95" fill="#8f0f22" />
        {/* tampa respirando, com a estrela do laço */}
        <motion.g animate={parado ? { y: 0 } : { y: [0, -2.2, 0, -1, 0] }} transition={loop(2.6, 0.6)}>
          <rect x="7" y="22" width="50" height="11" rx="5" fill={`url(#${id}-tampa)`} />
          <rect x="28" y="22" width="8" height="11" fill={`url(#${id}-verde)`} />
          <motion.path
            d="M32 4.5l3.1 7.2 7.8.6-5.9 5.1 1.9 7.6L32 21l-6.9 4 1.9-7.6-5.9-5.1 7.8-.6z"
            fill={`url(#${id}-ouro)`}
            style={{ transformOrigin: "32px 15px", transformBox: "view-box" }}
            animate={parado ? { rotate: 0, scale: 1 } : { rotate: [0, 8, -6, 0], scale: [1, 1.1, 1] }}
            transition={loop(3.4)}
          />
        </motion.g>
      </motion.svg>
      {[
        { x: "6%", y: "18%", s: 14, a: 0 },
        { x: "84%", y: "12%", s: 18, a: 0.8 },
        { x: "88%", y: "70%", s: 12, a: 1.6 },
        { x: "2%", y: "74%", s: 10, a: 2.2 },
      ].map((f, i) => (
        <motion.svg
          key={i}
          aria-hidden
          viewBox="0 0 24 24"
          width={f.s}
          height={f.s}
          className="absolute"
          style={{ left: f.x, top: f.y }}
          animate={parado ? { opacity: 0.8, scale: 1 } : { opacity: [0.2, 1, 0.2], scale: [0.7, 1.15, 0.7] }}
          transition={loop(2.4, f.a)}
        >
          <path d="M12 0 C 13 8, 16 11, 24 12 C 16 13, 13 16, 12 24 C 11 16, 8 13, 0 12 C 8 11, 11 8, 12 0 Z" fill="#e2b04a" />
        </motion.svg>
      ))}
    </div>
  );
}
