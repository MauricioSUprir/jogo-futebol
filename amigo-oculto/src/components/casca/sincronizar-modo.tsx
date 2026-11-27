"use client";
import { useEffect } from "react";

/** Mantém o claro/escuro do aparelho igual ao da conta (que manda). */
export function SincronizarModo({ modo }: { modo: "system" | "light" | "dark" }) {
  useEffect(() => aplicarModo(modo), [modo]);
  return null;
}

export function aplicarModo(modo: "system" | "light" | "dark") {
  try {
    localStorage.setItem("ao-modo", modo);
  } catch {}
  const escuro = modo === "dark" || (modo === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
}
