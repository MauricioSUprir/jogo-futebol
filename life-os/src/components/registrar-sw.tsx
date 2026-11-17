"use client";
import { useEffect } from "react";

/** Registra o service worker (app instalável no iPhone/Android/PC). Só em produção. */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
