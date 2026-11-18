"use client";
// Na barra de abas que rola de lado (celular), mostra a aba ativa (senão "Notas" ou "Simulados" ficam fora da vista).
import { useEffect } from "react";

export function RolarAbaAtiva({ rotulo, aba }: { rotulo: string; aba: string }) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(`nav[aria-label="${rotulo}"]`);
    const ativa = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !ativa) return;
    const alvo = ativa.offsetLeft - (nav.clientWidth - ativa.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, alvo), behavior: "instant" as ScrollBehavior });
  }, [rotulo, aba]);
  return null;
}
