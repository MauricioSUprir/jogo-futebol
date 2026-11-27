"use client";
import { useEffect, useRef } from "react";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";

/** Confete uma vez quando o grupo acabou de ser criado (respeita "reduzir movimento"). */
export function FestaCriado() {
  const ref = useRef<ConfeteHandle>(null);
  const { menosMovimento } = usePreferencias();
  useEffect(() => {
    if (menosMovimento) return;
    const t = setTimeout(() => ref.current?.disparar({ quantidade: 140, origemY: 0.25 }), 250);
    return () => clearTimeout(t);
  }, [menosMovimento]);
  return <Confete ref={ref} desligado={menosMovimento} />;
}
