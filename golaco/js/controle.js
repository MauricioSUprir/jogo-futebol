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

/**
 * Mira pela tela (C6, item 68 da FILA; contrato "Mira pela tela" no CONTRATOS.md): a direção do analógico NA TELA (ax para a
 * direita, ay para cima), saindo do ponto (ox, 0, oz) do gramado, levada ao gramado pela câmera que desenhou o quadro — a
 * reta do olho por cada ponto da tela até o plano y = 0 (o raycast do three.js: Raycaster.setFromCamera + Ray.intersectPlane).
 * A conta é exata para DIREÇÕES: a projeção do gramado na tela é uma homografia (leva reta em reta), então a reta da tela que
 * sai do ponto vira a reta do gramado que sai dele; a direção dela é a derivada da projeção (a jacobiana 2×2 no ponto)
 * invertida — sem "passo" na tela e sem cair acima do horizonte. paraMundo (só o rumo da câmera) é o caso da câmera olhando
 * de cima; na TV do celular (15°) a profundidade fica achatada na tela e o rumo sozinho erra a mira (o meio do gol visto
 * virava o pau de perto).
 * cam = {px, py, pz: o olho; rx, ry, rz: a direita; ux, uy, uz: o cima; fx, fy, fz: a frente (para onde a câmera olha)},
 * unitários (a matriz da câmera). Pixel quadrado (o three.js usa o mesmo foco nos dois eixos), então nem o fov nem o
 * formato da tela entram. out = {x, z}: a direção unitária no gramado. Devolve out, ou null quando a conta não vale (o ponto
 * atrás do olho ou a câmera rasante): quem chama usa paraMundo. Pura (sem DOM nem three.js).
 */
export function miraPelaTela(ax, ay, cam, ox, oz, out = { x: 0, z: 0 }) {
  if (!cam || !(Math.hypot(ax, ay) > 0)) return null;
  const dx = ox - cam.px, dy = -cam.py, dz = oz - cam.pz;
  // o ponto na câmera: xc à direita, yc para cima, zc à frente (a tela é xc/zc, yc/zc)
  const xc = dx * cam.rx + dy * cam.ry + dz * cam.rz;
  const yc = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  const zc = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (!(zc > 0.5)) return null;
  // jacobiana (sem o fator 1/zc², positivo) de uma direção (wx, 0, wz) do gramado para a tela (du, dv)
  const a = cam.rx * zc - xc * cam.fx, b = cam.rz * zc - xc * cam.fz;
  const c = cam.ux * zc - yc * cam.fx, d = cam.uz * zc - yc * cam.fz;
  const det = a * d - b * c;
  // câmera rasante (o gramado de lado na tela): a direção na tela não diz a do gramado
  if (!(Math.abs(det) > 1e-6 * zc * zc)) return null;
  const wx = (d * ax - b * ay) / det, wz = (-c * ax + a * ay) / det;
  const l = Math.hypot(wx, wz);
  if (!(l > 0)) return null;
  out.x = wx / l; out.z = wz / l;
  return out;
}

/** A câmera (Object3D do three.js, com a matrixWorld em dia) → o `cam` de miraPelaTela, em out (sem alocar). */
export function cameraDaMatriz(e, out = {}) {
  // matrixWorld (coluna a coluna): 0–2 a direita, 4–6 o cima, 8–10 o "para trás" (a câmera olha para −z), 12–14 o olho
  out.rx = e[0]; out.ry = e[1]; out.rz = e[2];
  out.ux = e[4]; out.uy = e[5]; out.uz = e[6];
  out.fx = -e[8]; out.fy = -e[9]; out.fz = -e[10];
  out.px = e[12]; out.py = e[13]; out.pz = e[14];
  return out;
}
