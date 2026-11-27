"use client";
import { motion } from "framer-motion";

/** Estrelas paradas do fundo do palco (posições fixas: nada de sorteio na renderização). */
const ESTRELAS: [number, number, number, number][] = [
  [8, 12, 3, 2.6], [18, 70, 2, 3.4], [26, 30, 2.5, 2.2], [36, 8, 2, 3.8], [44, 84, 3, 2.9], [55, 18, 2, 3.1],
  [63, 64, 2.5, 2.4], [72, 10, 3, 3.6], [80, 40, 2, 2.7], [88, 78, 2.5, 3.2], [93, 20, 2, 2.5], [5, 50, 2, 3.9],
  [49, 46, 1.5, 2.8], [68, 88, 2, 3.3], [14, 90, 2.5, 2.1], [96, 56, 1.5, 3.7],
];

export function EstrelasPalco() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {ESTRELAS.map(([x, y, s, d], i) => (
        <span
          key={i}
          className="cintilar absolute rounded-full bg-[#fff3c9]"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, boxShadow: "0 0 8px 2px rgb(255 226 150 / 0.55)", ["--duracao" as string]: `${d}s` }}
        />
      ))}
      {/* canhão de luz de cima */}
      <div
        className="absolute left-1/2 top-0 h-[70%] w-[min(42rem,120%)] -translate-x-1/2"
        style={{ background: "radial-gradient(50% 100% at 50% 0%, rgb(255 236 190 / 0.16), transparent 70%)" }}
      />
    </div>
  );
}

/** Raios de luz girando (atrás do presente aberto e da pessoa revelada). */
export function RaiosDeLuz({ ligado, simples, tamanho = 560 }: { ligado: boolean; simples: boolean; tamanho?: number }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ width: tamanho, height: tamanho, marginLeft: -tamanho / 2, marginTop: -tamanho / 2 }}
      initial={false}
      animate={ligado ? { opacity: 1, scale: 1 } : { opacity: 0, scale: simples ? 1 : 0.3 }}
      transition={{ duration: simples ? 0.4 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="raios-luz girar-lento absolute inset-0" style={{ ["--duracao" as string]: "48s" }} />
      <div
        className="absolute inset-[22%] rounded-full"
        style={{ background: "radial-gradient(circle, rgb(255 238 190 / 0.55), rgb(242 207 107 / 0.18) 45%, transparent 70%)" }}
      />
    </motion.div>
  );
}

/** Explosão de faíscas douradas saindo do presente (só na abertura, posições calculadas, sem sorteio). */
export function Faiscas({ ativo, quantidade = 26 }: { ativo: boolean; quantidade?: number }) {
  if (!ativo) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-0">
      {Array.from({ length: quantidade }, (_, i) => {
        const ang = (i / quantidade) * Math.PI * 2 + (i % 3) * 0.21;
        const dist = 120 + ((i * 37) % 140);
        const tam = 4 + ((i * 7) % 7);
        const cor = i % 4 === 0 ? "#ffffff" : i % 4 === 1 ? "#f7d983" : i % 4 === 2 ? "#ff8fa0" : "#7fe0be";
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: tam, height: tam, background: cor, boxShadow: `0 0 10px 2px ${cor}`, left: -tam / 2, top: -tam / 2 }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - 60, scale: [0, 1.3, 0.6], opacity: [1, 1, 0] }}
            transition={{ duration: 1.3 + (i % 5) * 0.12, ease: [0.1, 0.7, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}

/** Clarão rápido na abertura. */
export function Clarao({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: "radial-gradient(circle at 50% 50%, rgb(255 246 214 / 0.95), rgb(255 230 160 / 0.35) 35%, transparent 70%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9, times: [0, 0.25, 1] }}
    />
  );
}
