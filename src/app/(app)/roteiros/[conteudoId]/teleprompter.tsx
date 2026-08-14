"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Minus, Plus, X, RotateCcw, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Modo teleprompter: texto grande, rolagem controlada por velocidade. */
export function Teleprompter({ texto, onClose }: { texto: string; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number>(0);
  const [rodando, setRodando] = useState(false);
  const [velocidade, setVelocidade] = useState(40); // px/s
  const [fonte, setFonte] = useState(40); // px

  useEffect(() => {
    function step(ts: number) {
      const el = scrollRef.current;
      if (el) {
        if (lastTs.current) {
          const dt = (ts - lastTs.current) / 1000;
          el.scrollTop += velocidade * dt;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            setRodando(false);
          }
        }
        lastTs.current = ts;
      }
      rafRef.current = requestAnimationFrame(step);
    }
    if (rodando) {
      lastTs.current = 0;
      rafRef.current = requestAnimationFrame(step);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [rodando, velocidade]);

  function reiniciar() {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setRodando(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      {/* Faixa-guia central */}
      <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 h-px bg-primary/60" />

      <div
        ref={scrollRef}
        className="teleprompter-scroll flex-1 overflow-y-auto px-6 py-[33vh]"
        onClick={() => setRodando((r) => !r)}
      >
        <p
          className="mx-auto max-w-3xl whitespace-pre-wrap text-center font-semibold leading-relaxed"
          style={{ fontSize: `${fonte}px` }}
        >
          {texto || "Roteiro vazio."}
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/80 p-3">
        <Button variant="secondary" size="icon" onClick={() => setRodando((r) => !r)}>
          {rodando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icon" onClick={reiniciar}>
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs">
          <span className="opacity-70">vel</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setVelocidade((v) => Math.max(10, v - 10))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-10 text-center">{velocidade}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setVelocidade((v) => Math.min(200, v + 10))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs">
          <Type className="h-3 w-3 opacity-70" />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setFonte((f) => Math.max(20, f - 4))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center">{fonte}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setFonte((f) => Math.min(96, f + 4))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <Button variant="destructive" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
