"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export type ConfeteHandle = { disparar: (opcoes?: { quantidade?: number; origemX?: number; origemY?: number; espalhar?: number }) => void };

type Particula = {
  x: number; y: number; vx: number; vy: number; giro: number; vGiro: number;
  cor: string; forma: 0 | 1 | 2; tamanho: number; vida: number; balanco: number;
};

const CORES = ["#e2394f", "#f2cf6b", "#19b383", "#fffdf8", "#c9962b", "#ff8fa0", "#7fe0be"];

/**
 * Confete em canvas (sem dependências): retângulos, círculos e estrelas que caem com gravidade e balanço.
 * Fica por cima de tudo, sem pegar cliques; respeita "reduzir movimento" (não dispara).
 */
export const Confete = forwardRef<ConfeteHandle, { desligado?: boolean }>(function Confete({ desligado }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const particulas = useRef<Particula[]>([]);
  const quadro = useRef<number | null>(null);

  const passo = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== c.clientWidth * dpr) {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, c.clientWidth, c.clientHeight);
    const vivas: Particula[] = [];
    for (const p of particulas.current) {
      p.vy += 0.16;
      p.vx *= 0.992;
      p.vy *= 0.992;
      p.balanco += 0.08;
      p.x += p.vx + Math.sin(p.balanco) * 0.6;
      p.y += p.vy;
      p.giro += p.vGiro;
      p.vida -= 1;
      if (p.vida > 0 && p.y < c.clientHeight + 40) vivas.push(p);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.giro);
      g.globalAlpha = Math.min(1, p.vida / 40);
      g.fillStyle = p.cor;
      if (p.forma === 0) {
        g.fillRect(-p.tamanho / 2, -p.tamanho / 4, p.tamanho, p.tamanho / 2);
      } else if (p.forma === 1) {
        g.beginPath();
        g.arc(0, 0, p.tamanho / 3, 0, Math.PI * 2);
        g.fill();
      } else {
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          g.lineTo(Math.cos(a) * p.tamanho * 0.5, Math.sin(a) * p.tamanho * 0.5);
        }
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    particulas.current = vivas;
    quadro.current = vivas.length ? requestAnimationFrame(passo) : null;
  }, []);

  useImperativeHandle(ref, () => ({
    disparar(opcoes = {}) {
      if (desligado) return;
      const c = canvas.current;
      if (!c) return;
      const { quantidade = 160, origemX = 0.5, origemY = 0.45, espalhar = 1 } = opcoes;
      const ox = c.clientWidth * origemX;
      const oy = c.clientHeight * origemY;
      for (let i = 0; i < quantidade; i++) {
        const ang = Math.random() * Math.PI * 2;
        const vel = (4 + Math.random() * 9) * espalhar;
        particulas.current.push({
          x: ox, y: oy,
          vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 5,
          giro: Math.random() * Math.PI, vGiro: (Math.random() - 0.5) * 0.35,
          cor: CORES[i % CORES.length], forma: (i % 3) as 0 | 1 | 2,
          tamanho: 7 + Math.random() * 7, vida: 140 + Math.random() * 80, balanco: Math.random() * 6,
        });
      }
      if (quadro.current === null) quadro.current = requestAnimationFrame(passo);
    },
  }), [desligado, passo]);

  useEffect(() => () => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
  }, []);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />;
});
