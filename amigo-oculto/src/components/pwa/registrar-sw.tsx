"use client";
import { useEffect } from "react";
import { registrarServiceWorker } from "@/components/pwa/sw";

/** Registra o service worker em produção (página offline e push). No desenvolvimento, só o fluxo de ligar o push registra. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    registrarServiceWorker().catch(() => {});
  }, []);
  return null;
}
