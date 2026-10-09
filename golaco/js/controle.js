// Entrada pura (sem DOM): zona morta radial do analógico e conversão tela → mundo.
// Zona morta RADIAL (não axial): o módulo é reescalado a partir da borda da zona morta e a
// direção é preservada — uma diagonal sutil vale e nada trava em 8 direções.

import { ENTRADA } from './config.js';
import { clamp } from './mat.js';

export function processarAnalogico(x, y, zonaMorta = ENTRADA.zonaMorta, zonaExterna = ENTRADA.zonaExterna) {
  const m = Math.hypot(x, y);
  if (!(m > zonaMorta)) return { x: 0, y: 0, mag: 0 };
  const mag = clamp((m - zonaMorta) / (zonaExterna - zonaMorta), 0, 1);
  return { x: (x / m) * mag, y: (y / m) * mag, mag };
}

/** Teclas (cima/baixo/esquerda/direita) → analógico. Diagonal com módulo 1. */
export function teclasParaAnalogico(cima, baixo, esq, dir) {
  const x = (dir ? 1 : 0) - (esq ? 1 : 0);
  const y = (cima ? 1 : 0) - (baixo ? 1 : 0);
  const m = Math.hypot(x, y);
  return m > 0 ? { x: x / m, y: y / m, mag: 1 } : { x: 0, y: 0, mag: 0 };
}

/**
 * Analógico da tela (x para a direita, y para CIMA) → vetor no mundo (x, z), dado o rumo
 * para onde a câmera olha no chão (yaw). Câmera de TV atrás da lateral z+ olhando para z−:
 * yaw = −π/2, e "direita na tela" vira +x.
 */
export function paraMundo(ax, ay, yaw) {
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const rx = -fz, rz = fx;
  return { x: rx * ax + fx * ay, z: rz * ax + fz * ay };
}
