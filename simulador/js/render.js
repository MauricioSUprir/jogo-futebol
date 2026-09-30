// Renderizador 2D (canvas) do campo, das "bolinhas" e da bola.
// O gramado e as linhas são desenhados uma vez num canvas fora da tela (cache) e só são refeitos
// quando o tamanho ou a qualidade mudam; por quadro desenhamos ~25 círculos + efeitos.
import { PITCH } from './config.js';
import { colorDistance, luminance } from './teams.js';

const { halfL: L, halfW: W } = PITCH;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const GK_COLORS = ['#f2e34b', '#38d0f2', '#ff5fa8', '#9dff4a', '#ff9b3d', '#b58cff'];
function gkColor(kits, other) {
  let best = GK_COLORS[0], bd = -1;
  for (const c of GK_COLORS) {
    if (c === other) continue;
    const d = Math.min(...kits.map((k) => colorDistance(c, k.fill)));
    if (d > bd) { bd = d; best = c; }
  }
  return best;
}

export class PitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.bg = document.createElement('canvas');
    this.q = null;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.vertical = false;
    this.scale = 10; this.cx = 0; this.cy = 0;
    this.trail = [];
    this.particles = [];
    this.lastFx = new Set();
    this.dirty = true;
    this.drawMs = 0;
    this.reducedMotion = false;
  }

  setQuality(preset) { this.q = preset; this.dirty = true; }

  /** Ajusta resolução interna ao tamanho CSS do canvas. */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.q?.dprMax ?? 1.5);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === this.w && h === this.h && dpr === this.dpr && !this.dirty) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = w; this.canvas.height = h;
    this.vertical = r.height > r.width * 1.08;
    const m = 3.5; // margem (m) ao redor do campo
    const lenPx = this.vertical ? h : w, widPx = this.vertical ? w : h;
    this.scale = Math.min(lenPx / (2 * L + 2 * m + 3), widPx / (2 * W + 2 * m));
    this.cx = w / 2; this.cy = h / 2;
    this._buildBackground();
    this.dirty = false;
  }

  // mundo → tela
  sx(x, y) { return this.vertical ? this.cx + y * this.scale : this.cx + x * this.scale; }
  sy(x, y) { return this.vertical ? this.cy - x * this.scale : this.cy + y * this.scale; }

  _buildBackground() {
    const q = this.q || { grass: 2, glow: false };
    const c = this.bg; c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const s = this.scale;
    // entorno (pista escura)
    g.fillStyle = '#0c1511';
    g.fillRect(0, 0, this.w, this.h);
    // gramado com faixas de corte
    const stripes = 14;
    const x0 = -L - 3, x1 = L + 3;
    for (let i = 0; i < stripes; i++) {
      const a = x0 + ((x1 - x0) * i) / stripes, b = x0 + ((x1 - x0) * (i + 1)) / stripes;
      g.fillStyle = i % 2 ? '#1f7a3c' : '#237f41';
      this._rectW(g, a, -W - 3, b, W + 3);
    }
    // textura sutil (ruído), mais densa em qualidade maior
    if (q.grass >= 2) {
      const n = Math.round((this.w * this.h) / (q.grass >= 4 ? 90 : q.grass >= 3 ? 160 : 320));
      let seed = 12345;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const x = rnd() * this.w, y = rnd() * this.h;
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)';
        g.fillRect(x, y, 1 + rnd() * this.dpr, 1 + rnd() * this.dpr);
      }
    }
    // linhas
    const lw = Math.max(1, 0.14 * s);
    g.strokeStyle = 'rgba(245,250,245,0.88)';
    g.lineWidth = lw;
    g.lineJoin = 'miter';
    const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(this.sx(x, y), this.sy(x, y)) : g.moveTo(this.sx(x, y), this.sy(x, y)))); g.stroke(); };
    line([[-L, -W], [L, -W], [L, W], [-L, W], [-L, -W]]);
    line([[0, -W], [0, W]]);
    g.beginPath(); g.arc(this.sx(0, 0), this.sy(0, 0), PITCH.circleR * s, 0, Math.PI * 2); g.stroke();
    this._dot(g, 0, 0, Math.max(1.5, 0.25 * s));
    for (const d of [-1, 1]) {
      const gx = d * L;
      line([[gx, -PITCH.boxHalfW], [gx - d * PITCH.boxDepth, -PITCH.boxHalfW], [gx - d * PITCH.boxDepth, PITCH.boxHalfW], [gx, PITCH.boxHalfW]]);
      line([[gx, -PITCH.smallHalfW], [gx - d * PITCH.smallDepth, -PITCH.smallHalfW], [gx - d * PITCH.smallDepth, PITCH.smallHalfW], [gx, PITCH.smallHalfW]]);
      const px = gx - d * PITCH.penaltySpot;
      this._dot(g, px, 0, Math.max(1.5, 0.22 * s));
      // meia-lua (parte do círculo fora da área)
      const ang = Math.acos((PITCH.boxDepth - PITCH.penaltySpot) / PITCH.circleR);
      g.beginPath();
      const base = this.vertical ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : (d > 0 ? Math.PI : 0);
      g.arc(this.sx(px, 0), this.sy(px, 0), PITCH.circleR * s, base - ang, base + ang);
      g.stroke();
      // escanteios
      for (const e of [-1, 1]) {
        g.beginPath();
        const cxp = this.sx(gx, e * W), cyp = this.sy(gx, e * W);
        g.arc(cxp, cyp, 1 * s, 0, Math.PI * 2);
        g.save(); g.clip(this._pitchClip()); g.stroke(); g.restore();
      }
      // gol (rede atrás da linha)
      const depth = 2;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      this._rectW(g, gx, -PITCH.goalHalfW, gx + d * depth, PITCH.goalHalfW);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(0.6, 0.05 * s);
      for (let k = 1; k < 8; k++) { const y = -PITCH.goalHalfW + (2 * PITCH.goalHalfW * k) / 8; line([[gx, y], [gx + d * depth, y]]); }
      g.strokeStyle = '#f7f7f7'; g.lineWidth = Math.max(1.5, 0.22 * s);
      line([[gx, -PITCH.goalHalfW], [gx + d * depth, -PITCH.goalHalfW], [gx + d * depth, PITCH.goalHalfW], [gx, PITCH.goalHalfW]]);
      g.strokeStyle = 'rgba(245,250,245,0.88)'; g.lineWidth = lw;
    }
    // iluminação: vinheta e "pools" dos refletores
    if (q.glow) {
      const r = Math.max(this.w, this.h);
      const vg = g.createRadialGradient(this.cx, this.cy, r * 0.25, this.cx, this.cy, r * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = vg; g.fillRect(0, 0, this.w, this.h);
      if (q.grass >= 4) {
        g.globalCompositeOperation = 'lighter';
        for (const [x, y] of [[-L, -W], [L, -W], [-L, W], [L, W]]) {
          const pg = g.createRadialGradient(this.sx(x, y), this.sy(x, y), 0, this.sx(x, y), this.sy(x, y), 45 * s);
          pg.addColorStop(0, 'rgba(255,255,230,0.07)'); pg.addColorStop(1, 'rgba(255,255,230,0)');
          g.fillStyle = pg; g.fillRect(0, 0, this.w, this.h);
        }
        g.globalCompositeOperation = 'source-over';
      }
    }
  }
  _pitchClip() {
    const p = new Path2D();
    const a = [this.sx(-L, -W), this.sy(-L, -W)], b = [this.sx(L, W), this.sy(L, W)];
    p.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    return p;
  }
  _rectW(g, x0, y0, x1, y1) {
    const ax = this.sx(x0, y0), ay = this.sy(x0, y0), bx = this.sx(x1, y1), by = this.sy(x1, y1);
    g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  }
  _dot(g, x, y, r) { g.fillStyle = 'rgba(245,250,245,0.9)'; g.beginPath(); g.arc(this.sx(x, y), this.sy(x, y), r, 0, Math.PI * 2); g.fill(); }

  /** Limpa rastro/partículas (nova partida, pulo de tempo). */
  reset() { this.trail.length = 0; this.particles.length = 0; this.lastFx.clear(); }

  draw(match, alpha, opts) {
    const t0 = performance.now();
    this.resize();
    const g = this.ctx, q = this.q, s = this.scale;
    g.drawImage(this.bg, 0, 0);
    if (!match) return;
    const kits = match.teams.map((t) => t.kit);
    if (!this._gk || this._gkFor !== match) {
      const a = gkColor(kits, null);
      this._gk = [a, gkColor(kits, a)];
      this._gkFor = match;
    }
    const b = match.ball;
    const bx = lerp(b.px, b.x, alpha), by = lerp(b.py, b.y, alpha), bz = lerp(b.pz, b.z, alpha);
    const showPlayers = opts.view !== 'bola';
    const R = clamp(0.95 * s, 4.5, 15);
    const now = match.tAll;

    // efeitos de chute (linha tracejada que some)
    for (const f of match.fx) {
      const age = now - f.t;
      if (f.kind === 'shot' && age < 1.6) {
        const a = 1 - age / 1.6;
        g.save();
        g.setLineDash([4 * this.dpr, 4 * this.dpr]);
        g.lineWidth = Math.max(1, 0.12 * s);
        g.strokeStyle = f.outcome === 'goal' ? `rgba(200,255,90,${a})` : `rgba(255,255,255,${a * 0.55})`;
        g.beginPath(); g.moveTo(this.sx(f.x0, f.y0), this.sy(f.x0, f.y0)); g.lineTo(this.sx(f.x1, f.y1), this.sy(f.x1, f.y1)); g.stroke();
        g.restore();
      } else if (f.kind === 'offside' && age < 2) {
        const a = 1 - age / 2;
        g.save();
        g.setLineDash([6 * this.dpr, 5 * this.dpr]);
        g.strokeStyle = `rgba(255,210,60,${a})`; g.lineWidth = Math.max(1, 0.1 * s);
        g.beginPath(); g.moveTo(this.sx(f.x, -W), this.sy(f.x, -W)); g.lineTo(this.sx(f.x, W), this.sy(f.x, W)); g.stroke();
        g.restore();
      }
      if (f.kind === 'goal' && !this.lastFx.has(f) && q.particles && !this.reducedMotion) {
        this.lastFx.add(f);
        const col = kits[f.side].fill, col2 = kits[f.side].trim;
        for (let i = 0; i < q.particles; i++) {
          const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 12;
          this.particles.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1.2 + Math.random() * 1.2, c: i % 3 ? col : col2 === col ? '#fff' : col2 });
        }
      }
    }
    if (this.lastFx.size > 20) this.lastFx.clear();

    // modo "só a bola": faixa na cor de quem tem a posse, apontando para o gol atacado
    const possTeam = b.owner ? b.owner.team : b.pass ? b.pass.from.team : null;
    if (!showPlayers && possTeam && !match.dead) {
      const gxw = L * possTeam.dir;
      const x0 = this.sx(bx, 0), y0 = this.sy(bx, 0), x1 = this.sx(gxw, 0), y1 = this.sy(gxw, 0);
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      const [r, gg, bb] = [1, 3, 5].map((i) => parseInt(possTeam.kit.fill.slice(i, i + 2), 16));
      grad.addColorStop(0, `rgba(${r},${gg},${bb},0)`);
      grad.addColorStop(1, `rgba(${r},${gg},${bb},0.22)`);
      g.save(); g.clip(this._pitchClip());
      g.fillStyle = grad;
      const ax = Math.min(x0, x1), ay = Math.min(y0, y1);
      if (this.vertical) g.fillRect(0, ay, this.w, Math.abs(y1 - y0));
      else g.fillRect(ax, 0, Math.abs(x1 - x0), this.h);
      g.restore();
    }

    // marcador da bola parada
    if (match.dead && match.dead.type !== 'kickoff') {
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(1, 0.08 * s);
      g.beginPath(); g.arc(this.sx(match.dead.x, match.dead.y), this.sy(match.dead.x, match.dead.y), 2.2 * s, 0, Math.PI * 2); g.stroke();
    }

    // sombras
    if (q.shadows && showPlayers) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      const ox = 0.35 * s, oy = 0.35 * s;
      g.beginPath();
      for (const t of match.teams) for (const p of t.onPitch) {
        const x = this.sx(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha)) + ox, y = this.sy(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha)) + oy;
        g.moveTo(x + R, y); g.arc(x, y, R, 0, Math.PI * 2);
      }
      g.fill();
    }

    // jogadores
    if (showPlayers) {
      const owner = b.owner;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const font = `800 ${Math.round(R * 1.05)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      g.font = font;
      for (const t of match.teams) {
        const kit = t.kit;
        for (const p of t.onPitch) {
          const x = this.sx(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha)), y = this.sy(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha));
          const fill = p.isGK ? this._gk[t.side] : kit.fill;
          const trim = p.isGK ? '#111' : kit.trim;
          if (p === owner) {
            g.beginPath(); g.arc(x, y, R + Math.max(2.5, 0.35 * s), 0, Math.PI * 2);
            g.fillStyle = 'rgba(200,255,90,0.85)'; g.fill();
          }
          g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2);
          g.fillStyle = fill; g.fill();
          g.lineWidth = Math.max(1.5, R * 0.22); g.strokeStyle = trim; g.stroke();
          if (opts.numbers && q.numbers && R >= 7) {
            g.fillStyle = p.isGK ? '#111' : kit.text;
            g.fillText(String(p.d.number), x, y + R * 0.05);
          }
          if (p.yellow && !p.isGK) { g.fillStyle = '#ffd400'; g.fillRect(x + R * 0.55, y - R * 1.15, R * 0.45, R * 0.6); }
          if (p.energy < 0.5) { g.fillStyle = 'rgba(255,90,70,0.9)'; g.beginPath(); g.arc(x - R * 0.8, y - R * 0.8, Math.max(1.5, R * 0.18), 0, Math.PI * 2); g.fill(); }
        }
      }
    }

    // partículas de gol
    if (this.particles.length) {
      const dt = 1 / 60;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, p.life);
        g.fillStyle = p.c;
        g.fillRect(this.sx(p.x, p.y) - 1.5 * this.dpr, this.sy(p.x, p.y) - 1.5 * this.dpr, 3 * this.dpr, 3 * this.dpr);
      }
      g.globalAlpha = 1;
    }

    // bola: sombra no chão + bola elevada pela altura
    const Rb = clamp(0.45 * s, 3, 8) * (opts.view === 'bola' ? 1.35 : 1);
    const gx = this.sx(bx, by), gy = this.sy(bx, by);
    const lift = bz * s * 0.55;
    const ballX = gx, ballY = gy - lift;
    if (q.trail || opts.view === 'bola') {
      this.trail.push(ballX, ballY);
      if (this.trail.length > 28) this.trail.splice(0, 2);
      if (this.trail.length >= 4) {
        g.lineCap = 'round';
        for (let i = 2; i < this.trail.length; i += 2) {
          const a = i / this.trail.length;
          g.strokeStyle = `rgba(255,255,255,${a * 0.35})`;
          g.lineWidth = Rb * a * 1.4;
          g.beginPath(); g.moveTo(this.trail[i - 2], this.trail[i - 1]); g.lineTo(this.trail[i], this.trail[i + 1]); g.stroke();
        }
      }
    }
    if (q.shadows || bz > 0.2) {
      g.fillStyle = `rgba(0,0,0,${clamp(0.4 - bz * 0.03, 0.12, 0.4)})`;
      g.beginPath(); g.ellipse(gx + Rb * 0.3, gy + Rb * 0.3, Rb * (1 + bz * 0.05), Rb * 0.8 * (1 + bz * 0.05), 0, 0, Math.PI * 2); g.fill();
    }
    // no modo "só a bola", o halo mostra quem tem a posse
    const possT = b.owner ? b.owner.team : b.pass ? b.pass.from.team : null;
    if (opts.view === 'bola' && possT) {
      g.fillStyle = possT.kit.fill;
      g.globalAlpha = 0.55;
      g.beginPath(); g.arc(ballX, ballY, Rb * 2.4, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (q.glow) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.arc(ballX, ballY, Rb * 1.9, 0, Math.PI * 2); g.fill();
    }
    const rb = Rb * (1 + bz * 0.06);
    g.beginPath(); g.arc(ballX, ballY, rb, 0, Math.PI * 2);
    g.fillStyle = '#fbfbf7'; g.fill();
    g.lineWidth = Math.max(1, rb * 0.25); g.strokeStyle = '#1b1b1b'; g.stroke();
    this.drawMs = performance.now() - t0;
  }
}

// ---------- gráficos do painel (momento e mapa de calor) ----------

export function drawMomentum(canvas, match, colors) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  if (r.width < 10) return;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, mid = h / 2;
  g.clearRect(0, 0, w, h);
  const total = Math.max(90, Math.ceil(match.minuteFloat));
  const bw = w / total;
  // suaviza em janelas de 3 minutos
  const m = match.momentum;
  let max = 0.02;
  const vals = [];
  for (let i = 0; i < total; i++) { const v = ((m[i - 1] || 0) + (m[i] || 0) * 2 + (m[i + 1] || 0)) / 4; vals.push(v); max = Math.max(max, Math.abs(v)); }
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, mid - dpr * 0.5, w, dpr);
  g.fillRect((45 / total) * w, 0, dpr, h);
  const now = match.minuteFloat;
  for (let i = 0; i < total && i < now; i++) {
    const v = vals[i] / max;
    const bh = Math.abs(v) * (mid - 6 * dpr);
    g.fillStyle = v >= 0 ? colors[0] : colors[1];
    if (v >= 0) g.fillRect(i * bw + bw * 0.12, mid - bh, bw * 0.76, bh);
    else g.fillRect(i * bw + bw * 0.12, mid, bw * 0.76, bh);
  }
  // gols
  g.font = `${11 * dpr}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const e of match.events) {
    if (e.type !== 'goal') continue;
    const x = Math.min(w - 6 * dpr, (e.minute / total) * w);
    const y = e.side === 0 ? 8 * dpr : h - 8 * dpr;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5 * dpr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.fillText('⚽', x, y + 0.5 * dpr);
  }
}

export function drawHeat(canvas, match, side, color) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  if (r.width < 10) return;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.fillStyle = '#1d6a37'; g.fillRect(0, 0, w, h);
  const grid = match.heat[side];
  let max = 0.001;
  for (const v of grid) max = Math.max(max, v);
  const cw = w / 24, ch = h / 16;
  const [cr, cg, cb] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  // o motor já grava no referencial do time: ataque sempre para a direita
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
    const v = grid[y * 24 + x] / max;
    if (v < 0.04) continue;
    const X = x, Y = y;
    g.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(0.9, v * 0.95)})`;
    g.fillRect(X * cw, Y * ch, cw + 0.5, ch + 0.5);
  }
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = dpr;
  g.strokeRect(dpr / 2, dpr / 2, w - dpr, h - dpr);
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, (9.15 / 68) * h, 0, Math.PI * 2); g.stroke();
  const bw = (16.5 / 105) * w, bh = (40.3 / 68) * h;
  g.strokeRect(0, (h - bh) / 2, bw, bh); g.strokeRect(w - bw, (h - bh) / 2, bw, bh);
  // seta de ataque
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = `${10 * dpr}px system-ui, sans-serif`; g.textAlign = 'right';
  g.fillText('ataque →', w - 4 * dpr, 10 * dpr);
}

export { luminance };
