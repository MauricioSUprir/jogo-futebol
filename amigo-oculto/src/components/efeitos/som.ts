"use client";
/**
 * Efeitos sonoros sintetizados na hora (Web Audio): nada de arquivo de áudio, nada de licença.
 * Só tocam depois de um gesto da pessoa (regra dos navegadores) e se o som estiver ligado nas preferências.
 */
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function nota(c: AudioContext, freq: number, inicio: number, dur: number, volume = 0.18, tipo: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, c.currentTime + inicio);
  g.gain.setValueAtTime(0.0001, c.currentTime + inicio);
  g.gain.exponentialRampToValueAtTime(volume, c.currentTime + inicio + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + inicio + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + inicio);
  o.stop(c.currentTime + inicio + dur + 0.05);
}

export type Efeito = "tique" | "contagem" | "abrir" | "revelar" | "festa" | "sino" | "erro" | "virar";

export function tocar(efeito: Efeito, ligado = true) {
  if (!ligado) return;
  const c = contexto();
  if (!c) return;
  switch (efeito) {
    case "tique":
      nota(c, 1320, 0, 0.06, 0.08, "triangle");
      break;
    case "contagem":
      nota(c, 660, 0, 0.18, 0.16, "triangle");
      break;
    case "abrir":
      for (let i = 0; i < 6; i++) nota(c, 400 + i * 120, i * 0.035, 0.14, 0.09, "sawtooth");
      break;
    case "revelar":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(c, f, i * 0.09, 0.6, 0.15, "triangle"));
      [1567.98, 2093].forEach((f, i) => nota(c, f, 0.4 + i * 0.12, 0.8, 0.06, "sine"));
      break;
    case "festa":
      [784, 988, 1175, 1568, 1319, 1568].forEach((f, i) => nota(c, f, i * 0.11, 0.35, 0.11, "square"));
      break;
    case "sino":
      nota(c, 1318.5, 0, 1.2, 0.12, "sine");
      nota(c, 1975.5, 0.02, 0.9, 0.05, "sine");
      break;
    case "virar":
      nota(c, 300, 0, 0.12, 0.08, "triangle");
      nota(c, 450, 0.06, 0.12, 0.06, "triangle");
      break;
    case "erro":
      nota(c, 220, 0, 0.25, 0.12, "square");
      break;
  }
}

export function vibrar(padrao: number | number[], ligado = true) {
  if (!ligado || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(padrao);
  } catch {
    // alguns navegadores bloqueiam sem gesto
  }
}
