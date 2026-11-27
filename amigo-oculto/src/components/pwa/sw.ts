"use client";
/**
 * Registro do service worker e utilidades do push no navegador. Em produção, /sw.js; no desenvolvimento, /sw.js?dev=1
 * (o service worker não guarda os estáticos, que lá não têm hash no nome).
 */
export function urlDoServiceWorker() {
  return process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registro = await navigator.serviceWorker.register(urlDoServiceWorker(), { scope: "/" });
  await navigator.serviceWorker.ready;
  return registro;
}

/** O que este navegador permite: push precisa de service worker, PushManager e Notification. */
export function suportePush(): "sim" | "nao" | "ios-instalar" {
  if (typeof window === "undefined") return "nao";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !instalado ? "ios-instalar" : "nao";
  }
  if (ios && !instalado) return "ios-instalar";
  return "sim";
}

/** Chave pública VAPID (base64url) → bytes para o pushManager.subscribe. */
export function chaveVapidEmBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
  const bruto = atob(preenchido.replace(/-/g, "+").replace(/_/g, "/"));
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

/** A inscrição atual deste aparelho (sem criar nada). */
export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration("/");
  return registro ? registro.pushManager.getSubscription() : null;
}
