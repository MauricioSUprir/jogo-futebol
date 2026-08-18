// Gera os icones do LookLab (PNG) sem dependencias externas.
// Uso: node scripts/make-looklab-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const OUT = new URL("../looklab/assets/", import.meta.url);

/* ---------- encoder PNG (RGBA, sem filtro) ---------- */
function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- geometria (coordenadas 0..1) ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy || 1e-9), 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

// Cabide: gancho (arco), ombros (duas diagonais) e barra inferior.
function hangerAlpha(x, y) {
  const w = 0.030;              // espessura do traco
  const cx = 0.5;
  const hookR = 0.070, hookCy = 0.250;
  const shoulderY = 0.430, barY = 0.630, halfBar = 0.290;

  // gancho: circulo tangente a haste, aberto no quadrante inferior esquerdo
  const dx = x - (cx + hookR), dy = y - hookCy;
  const ang = Math.atan2(dy, dx);            // -pi..pi (y cresce para baixo)
  let hook = 1e9;
  if (ang <= 1.05) hook = Math.abs(Math.hypot(dx, dy) - hookR);
  // haste vertical ligando o gancho ao vertice dos ombros
  const stem = segDist(x, y, cx, hookCy, cx, shoulderY);
  // ombros
  const l = segDist(x, y, cx, shoulderY, cx - halfBar, barY);
  const r = segDist(x, y, cx, shoulderY, cx + halfBar, barY);
  // barra
  const bar = segDist(x, y, cx - halfBar, barY, cx + halfBar, barY);

  const d = Math.min(hook, stem, l, r, bar) - w / 2;
  return clamp(0.5 - d * 220, 0, 1);
}

function roundedSquareAlpha(x, y, r) {
  const qx = Math.abs(x - 0.5) - (0.5 - r);
  const qy = Math.abs(y - 0.5) - (0.5 - r);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return clamp(0.5 - d * 300, 0, 1);
}

/* ---------- render ---------- */
function render(size, { radius = 0.5, pad = 0 } = {}) {
  const SS = 3, S = size * SS;
  const acc = new Float64Array(size * size * 4);
  for (let sy = 0; sy < S; sy++) {
    for (let sx = 0; sx < S; sx++) {
      const x = (sx + 0.5) / S, y = (sy + 0.5) / S;
      // fundo: gradiente roxo eletrico na diagonal
      const t = clamp((x * 0.55 + y * 0.75), 0, 1);
      let r = mix(124, 192, t), g = mix(58, 132, t), b = mix(237, 252, t);
      let a = roundedSquareAlpha(x, y, radius);
      // cabide branco
      const sx2 = (x - 0.5) / (1 - pad) + 0.5, sy2 = (y - 0.5) / (1 - pad) + 0.5;
      const h = hangerAlpha(sx2, sy2);
      r = mix(r, 255, h); g = mix(g, 255, h); b = mix(b, 255, h);
      const px = ((sy / SS) | 0) * size + ((sx / SS) | 0);
      acc[px * 4] += r * a; acc[px * 4 + 1] += g * a; acc[px * 4 + 2] += b * a; acc[px * 4 + 3] += a;
    }
  }
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let i = 0; i < size * size; i++) {
    const a = acc[i * 4 + 3] / n;
    out[i * 4] = Math.round(a ? acc[i * 4] / n / a : 0);
    out[i * 4 + 1] = Math.round(a ? acc[i * 4 + 1] / n / a : 0);
    out[i * 4 + 2] = Math.round(a ? acc[i * 4 + 2] / n / a : 0);
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

const jobs = [
  ["icon-512.png", 512, { radius: 0.5 }],   // maskable: quadrado cheio arredondado
  ["icon-192.png", 192, { radius: 0.5 }],
  ["icon-180.png", 180, { radius: 0.5 }],
  ["logo.png", 320, { radius: 0.28, pad: 0.06 }],
];
for (const [name, size, opts] of jobs) {
  writeFileSync(new URL(name, OUT), png(size, size, render(size, opts)));
  console.log("ok", name, size + "x" + size);
}
