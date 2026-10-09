// Pequenas funções de matemática para a lógica (sem three.js).

export const TAU = Math.PI * 2;

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Ângulo em (−π, π]. */
export function normAng(a) {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Diferença angular b − a em (−π, π]. */
export function difAng(a, b) {
  return normAng(b - a);
}

export function lerpAng(a, b, t) {
  return a + difAng(a, b) * t;
}

export function hypot2(x, z) {
  return Math.sqrt(x * x + z * z);
}

/** Interpolação linear numa tabela [[x, y1, y2, ...], ...] ordenada por x. Coluna col. */
export function tabela(tab, x, col) {
  if (x <= tab[0][0]) return tab[0][col];
  const n = tab.length;
  if (x >= tab[n - 1][0]) return tab[n - 1][col];
  for (let i = 1; i < n; i++) {
    if (x <= tab[i][0]) {
      const a = tab[i - 1], b = tab[i];
      const t = (x - a[0]) / (b[0] - a[0]);
      return a[col] + (b[col] - a[col]) * t;
    }
  }
  return tab[n - 1][col];
}

/** Atributo 0–100 → valor entre min e max (linear). */
export function porAtributo(attr, min, max) {
  return min + (max - min) * clamp(attr, 0, 100) / 100;
}

/** Arredonda para a grade de 1/q (entrada quantizada). */
export function quantizar(v, q) {
  return Math.round(v * q) / q;
}

/** Distância do ponto (px,pz) ao segmento (ax,az)–(bx,bz). */
export function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-12 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}
