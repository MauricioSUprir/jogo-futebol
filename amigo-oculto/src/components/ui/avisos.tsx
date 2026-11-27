"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type Tipo = "ok" | "erro" | "info";
type Aviso = { id: number; tipo: Tipo; texto: string };

const Contexto = createContext<{ avisar: (texto: string, tipo?: Tipo) => void } | null>(null);

/** Avisos curtos (toasts) — anunciados para leitores de tela pela região ao vivo. */
export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const remover = useCallback((id: number) => setLista((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback(
    (texto: string, tipo: Tipo = "ok") => {
      const id = Date.now() + Math.random();
      setLista((l) => [...l.slice(-2), { id, tipo, texto }]);
      setTimeout(() => remover(id), tipo === "erro" ? 6500 : 4000);
    },
    [remover],
  );
  const valor = useMemo(() => ({ avisar }), [avisar]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <AnimatePresence>
          {lista.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="vidro-forte pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {a.tipo === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-esmeralda" aria-hidden />
              ) : a.tipo === "erro" ? (
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-rubi" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-5 shrink-0 text-ouro" aria-hidden />
              )}
              <span className="flex-1">{a.texto}</span>
              <button type="button" onClick={() => remover(a.id)} aria-label="Fechar aviso" className="-m-1 rounded-full p-1 hover:bg-black/5">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useAvisos fora do ProvedorAvisos");
  return c;
}
