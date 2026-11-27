"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Preferencias = { som: boolean; vibracao: boolean; menosMovimento: boolean };

const Contexto = createContext<Preferencias>({ som: true, vibracao: true, menosMovimento: false });

/**
 * Preferências de efeitos: as da conta (user_settings) quando houver; o "reduzir movimento" do sistema também vale.
 * A classe .menos-movimento no <html> desliga as animações de CSS.
 */
export function ProvedorPreferencias({ inicial, children }: { inicial: Preferencias; children: ReactNode }) {
  const [sistemaReduz, setSistemaReduz] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSistemaReduz(m.matches);
    const f = () => setSistemaReduz(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const valor = useMemo(() => ({ ...inicial, menosMovimento: inicial.menosMovimento || sistemaReduz }), [inicial, sistemaReduz]);
  useEffect(() => {
    document.documentElement.classList.toggle("menos-movimento", valor.menosMovimento);
  }, [valor.menosMovimento]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePreferencias() {
  return useContext(Contexto);
}
