"use client";
import { useEffect } from "react";

export type ModoCor = "system" | "light" | "dark";

/**
 * Claro/escuro. A escolha fica no cookie `ao-modo` (o servidor já manda o <html> com a classe certa: nada pisca) e na
 * conta (user_settings.color_mode, que manda). No modo "sistema" as cores vêm do CSS (prefers-color-scheme) e a classe
 * .dark acompanha o sistema depois de carregar.
 */
export function aplicarModo(modo: ModoCor) {
  try {
    document.cookie = `ao-modo=${modo}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem("ao-modo", modo);
  } catch {}
  const raiz = document.documentElement;
  const escuro = modo === "dark" || (modo === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  raiz.classList.toggle("dark", escuro);
  raiz.classList.toggle("light", modo === "light");
}

/** No layout raiz: aplica o modo do cookie e acompanha o sistema quando a escolha é "sistema". */
export function ModoDoSistema({ modo }: { modo: ModoCor }) {
  useEffect(() => {
    aplicarModo(modo);
    if (modo !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => aplicarModo("system");
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [modo]);
  return null;
}

/** No layout do app: a escolha salva na conta vale em todos os aparelhos. */
export function SincronizarModo({ modo }: { modo: ModoCor }) {
  useEffect(() => aplicarModo(modo), [modo]);
  return null;
}
