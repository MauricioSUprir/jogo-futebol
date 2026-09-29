// Painel "six-pack" do Cessna desenhado em canvas: velocímetro, horizonte artificial,
// altímetro, coordenador de curva, giro direcional e variômetro, mais tacômetro e flapes.
import { KT, FT, FPM } from './config.js';

const TAU = Math.PI * 2;

export class Panel {
  constructor(canvas) { this.cv = canvas; this.x = canvas.getContext('2d'); this.t = 0; }

  bezel(cx, cy, r) {
    const x = this.x;
    x.fillStyle = '#0b0b0c'; x.beginPath(); x.arc(cx, cy, r + 8, 0, TAU); x.fill();
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r + 8);
    g.addColorStop(0, '#3a3b3e'); g.addColorStop(1, '#141415');
    x.strokeStyle = g; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, r + 5, 0, TAU); x.stroke();
    x.fillStyle = '#111214'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  ticks(cx, cy, r, a0, a1, n, len, w, color = '#eee') {
    const x = this.x; x.strokeStyle = color; x.lineWidth = w;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len)); x.stroke(); }
  }
  needle(cx, cy, a, len, w = 5, color = '#f4f4f4', tail = 12) {
    const x = this.x; x.save(); x.translate(cx, cy); x.rotate(a);
    x.fillStyle = color; x.beginPath(); x.moveTo(-tail, -w / 2); x.lineTo(len, -w * 0.25); x.lineTo(len + 6, 0); x.lineTo(len, w * 0.25); x.lineTo(-tail, w / 2); x.fill();
    x.restore(); x.fillStyle = '#333'; x.beginPath(); x.arc(cx, cy, 6, 0, TAU); x.fill();
  }
  label(t, cx, cy, size = 13, color = '#ddd') { const x = this.x; x.fillStyle = color; x.font = `600 ${size}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy); }

  // velocímetro: 0–200 kt; arco branco 33–85, verde 48–129, amarelo 129–163, linha vermelha 163
  asi(cx, cy, r, kt) {
    this.bezel(cx, cy, r);
    const x = this.x, ang = (v) => -Math.PI / 2 + (Math.min(v, 200) / 200) * TAU * 0.92 + 0.12;
    const arc = (v0, v1, col, rr, w) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(cx, cy, rr, ang(v0), ang(v1)); x.stroke(); };
    arc(33, 85, '#f2f2f2', r - 16, 5); arc(48, 129, '#1db342', r - 9, 7); arc(129, 163, '#f4c20d', r - 9, 7); arc(162, 164, '#e3261e', r - 9, 10);
    for (let v = 40; v <= 200; v += 10) this.ticks(cx, cy, r - 2, ang(v), ang(v), 0, v % 20 === 0 ? 12 : 7, 2);
    for (let v = 40; v <= 200; v += 20) { const a = ang(v); this.label(String(v), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30), 13); }
    this.label('NÓS', cx, cy - r * 0.35, 11, '#aaa');
    this.needle(cx, cy, ang(Math.max(kt, 0)), r - 14);
  }
  // horizonte artificial
  attitude(cx, cy, r, pitch, roll) {
    this.bezel(cx, cy, r);
    const x = this.x; x.save(); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.clip();
    x.translate(cx, cy); x.rotate(-roll);
    const pp = pitch * 180 / Math.PI * (r / 28);
    x.fillStyle = '#2f7fd1'; x.fillRect(-r * 2, -r * 3 + pp, r * 4, r * 3);
    x.fillStyle = '#7a4a22'; x.fillRect(-r * 2, pp, r * 4, r * 3);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-r * 2, pp); x.lineTo(r * 2, pp); x.stroke();
    for (let d = -20; d <= 20; d += 5) { if (!d) continue; const y = pp - d * (r / 28); const w = d % 10 === 0 ? r * 0.36 : r * 0.18; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-w / 2, y); x.lineTo(w / 2, y); x.stroke(); if (d % 10 === 0) { x.fillStyle = '#fff'; x.font = '10px Arial'; x.fillText(Math.abs(d), w / 2 + 10, y + 3); } }
    x.restore();
    // escala de inclinação
    x.save(); x.translate(cx, cy);
    for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const a = (-90 + d) * Math.PI / 180; x.strokeStyle = '#fff'; x.lineWidth = d % 30 === 0 ? 3 : 2; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); x.lineTo(Math.cos(a) * r * (d % 30 === 0 ? 0.84 : 0.9), Math.sin(a) * r * (d % 30 === 0 ? 0.84 : 0.9)); x.stroke(); }
    x.rotate(-roll); x.fillStyle = '#f5b400'; x.beginPath(); x.moveTo(0, -r * 0.8); x.lineTo(-7, -r * 0.68); x.lineTo(7, -r * 0.68); x.fill();
    x.restore();
    // avião de referência
    x.strokeStyle = '#f5b400'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - r * 0.55, cy); x.lineTo(cx - r * 0.18, cy); x.lineTo(cx - r * 0.1, cy + 8); x.moveTo(cx + r * 0.55, cy); x.lineTo(cx + r * 0.18, cy); x.lineTo(cx + r * 0.1, cy + 8); x.stroke();
    x.fillStyle = '#f5b400'; x.beginPath(); x.arc(cx, cy, 4, 0, TAU); x.fill();
  }
  altimeter(cx, cy, r, ft) {
    this.bezel(cx, cy, r);
    for (let i = 0; i < 50; i++) { const a = -Math.PI / 2 + i / 50 * TAU; this.ticks(cx, cy, r - 2, a, a, 0, i % 5 === 0 ? 12 : 6, 2); }
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU; this.label(String(i), cx + Math.cos(a) * (r - 26), cy + Math.sin(a) * (r - 26), 16); }
    this.label('ALT', cx, cy - r * 0.35, 11, '#aaa');
    this.label('1013', cx + r * 0.45, cy, 11, '#aaa');
    const f = Math.max(ft, 0);
    this.needle(cx, cy, -Math.PI / 2 + (f % 10000) / 10000 * TAU, r * 0.35, 3, '#ddd', 4);
    this.needle(cx, cy, -Math.PI / 2 + (f % 10000) / 10000 * TAU * 10 / 10 * 1, r * 0.5, 8, '#f4f4f4', 8);
    this.needle(cx, cy, -Math.PI / 2 + (f % 1000) / 1000 * TAU, r - 16, 4, '#fff', 14);
  }
  turnCoord(cx, cy, r, turnRate, slip) {
    this.bezel(cx, cy, r);
    const x = this.x;
    // marcas de curva padrão (3°/s)
    // marcas: asas niveladas e curva padrão (3°/s) para cada lado
    for (const d of [-20, 0, 20]) { const a = Math.PI + d * Math.PI / 180; for (const k of [1, -1]) { const aa = k > 0 ? a : a - Math.PI; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + Math.cos(aa) * r * 0.95, cy + Math.sin(aa) * r * 0.95 * (d ? 1 : 1)); x.lineTo(cx + Math.cos(aa) * r * 0.78, cy + Math.sin(aa) * r * 0.78); x.stroke(); } }
    this.label('L', cx - r * 0.7, cy + r * 0.3, 14); this.label('R', cx + r * 0.7, cy + r * 0.3, 14);
    this.label('2 MIN', cx, cy + r * 0.55, 10, '#aaa');
    const bank = Math.max(-0.6, Math.min(0.6, turnRate / (3 * Math.PI / 180) * 20 * Math.PI / 180));
    x.save(); x.translate(cx, cy); x.rotate(bank);
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(-r * 0.62, 0); x.lineTo(r * 0.62, 0); x.moveTo(0, -12); x.lineTo(0, 0); x.stroke();
    x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fillStyle = '#fff'; x.fill();
    x.restore();
    // bola (derrapagem)
    x.strokeStyle = '#777'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy - r * 0.9, r * 1.25, Math.PI / 2 - 0.35, Math.PI / 2 + 0.35); x.stroke(); x.lineCap = 'butt';
    const ba = Math.PI / 2 - Math.max(-0.32, Math.min(0.32, slip * 4));
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx + Math.cos(ba) * r * 1.25, cy - r * 0.9 + Math.sin(ba) * r * 1.25, 7, 0, TAU); x.fill();
  }
  heading(cx, cy, r, hdg) {
    this.bezel(cx, cy, r);
    const x = this.x; x.save(); x.translate(cx, cy); x.rotate(-hdg);
    for (let d = 0; d < 360; d += 5) { const a = d * Math.PI / 180 - Math.PI / 2; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3)); x.lineTo(Math.cos(a) * (r - (d % 10 ? 8 : 14)), Math.sin(a) * (r - (d % 10 ? 8 : 14))); x.stroke(); }
    const lab = { 0: 'N', 90: 'L', 180: 'S', 270: 'O' };
    for (let d = 0; d < 360; d += 30) { x.save(); x.rotate(d * Math.PI / 180); x.fillStyle = lab[d] ? '#f5b400' : '#eee'; x.font = `bold ${lab[d] ? 17 : 14}px Arial`; x.textAlign = 'center'; x.fillText(lab[d] || String(d / 10), 0, -r + 30); x.restore(); }
    x.restore();
    x.strokeStyle = '#f5b400'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy - r * 0.55); x.lineTo(cx, cy + r * 0.3); x.moveTo(cx - r * 0.3, cy - r * 0.1); x.lineTo(cx + r * 0.3, cy - r * 0.1); x.moveTo(cx - r * 0.12, cy + r * 0.25); x.lineTo(cx + r * 0.12, cy + r * 0.25); x.stroke();
    x.fillStyle = '#f5b400'; x.beginPath(); x.moveTo(cx, cy - r + 2); x.lineTo(cx - 6, cy - r + 14); x.lineTo(cx + 6, cy - r + 14); x.fill();
  }
  vsi(cx, cy, r, fpm) {
    this.bezel(cx, cy, r);
    const ang = (v) => Math.PI + Math.max(-2000, Math.min(2000, v)) / 2000 * Math.PI * 0.9;
    for (let v = -2000; v <= 2000; v += 500) { this.ticks(cx, cy, r - 2, ang(v), ang(v), 0, 12, 2); if (v % 1000 === 0) this.label(String(Math.abs(v / 100)), cx + Math.cos(ang(v)) * (r - 28), cy + Math.sin(ang(v)) * (r - 28), 14); }
    for (let v = -2000; v <= 2000; v += 100) this.ticks(cx, cy, r - 2, ang(v), ang(v), 0, 5, 1);
    this.label('SOBE', cx + r * 0.2, cy - r * 0.35, 9, '#aaa'); this.label('DESCE', cx + r * 0.2, cy + r * 0.35, 9, '#aaa');
    this.label('100 FT/MIN', cx - r * 0.05, cy, 9, '#aaa');
    this.needle(cx, cy, ang(fpm), r - 14);
  }
  small(cx, cy, r, v, min, max, title, fmt) {
    this.bezel(cx, cy, r);
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, ang = (q) => a0 + (Math.max(min, Math.min(max, q)) - min) / (max - min) * (a1 - a0);
    this.ticks(cx, cy, r - 2, a0, a1, 10, 7, 1.5);
    this.label(title, cx, cy + r * 0.45, 10, '#aaa');
    this.label(fmt(v), cx, cy + r * 0.2, 12);
    this.needle(cx, cy, ang(v), r - 10, 4);
  }

  draw(o, ctl, night) {
    const x = this.x, W = this.cv.width, H = this.cv.height;
    // fundo do painel (cinza escuro fosco com parafusos)
    x.fillStyle = '#26282b'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1c1d20'; x.fillRect(0, 0, W, 12);
    const r = 68, y1 = 100, y2 = 262, x0 = 110, dx = 164;
    this.asi(x0, y1, r, (o.ias || 0) * KT);
    this.attitude(x0 + dx, y1, r, o.pitch || 0, o.roll || 0);
    this.altimeter(x0 + dx * 2, y1, r, (o.alt || 0) * FT);
    this.turnCoord(x0, y2, r, o.turnRate || 0, o.slip || 0);
    this.heading(x0 + dx, y2, r, o.heading || 0);
    this.vsi(x0 + dx * 2, y2, r, (o.vs || 0) * FPM);
    this.small(x0 + dx * 3 + 10, y1, 50, o.rpm || 0, 0, 3000, 'RPM', (v) => Math.round(v / 10) * 10);
    // flapes, compensador e manete
    const fx = x0 + dx * 3 + 10;
    x.fillStyle = '#111214'; x.fillRect(fx - 48, y2 - 70, 96, 150);
    this.label('FLAPES', fx, y2 - 56, 11, '#aaa');
    x.fillStyle = '#ddd'; x.fillRect(fx - 20, y2 - 42 + (o.flapDeg || 0) * 2.2, 40, 6);
    for (const d of [0, 10, 20, 30]) this.label(d + '°', fx + 32, y2 - 38 + d * 2.2, 10, '#bbb');
    this.label('COMP ' + (ctl.trim > 0 ? '▲' : ctl.trim < 0 ? '▼' : '•') + Math.round(Math.abs(ctl.trim) * 100), fx, y2 + 38, 11, '#ddd');
    this.label('MANETE ' + Math.round(ctl.throttle * 100) + '%', fx, y2 + 58, 11, '#ddd');
    // rádios (decorativos) à direita
    const rx = 740;
    x.fillStyle = '#0d0e10'; x.fillRect(rx, 30, 250, 330);
    x.fillStyle = '#00e676'; x.font = 'bold 22px "Courier New", monospace'; x.textAlign = 'left';
    x.fillText('COM1 118.700', rx + 18, 70); x.fillText('NAV1 110.30', rx + 18, 110);
    x.fillStyle = '#ffb300'; x.fillText('XPDR 7000', rx + 18, 150);
    x.fillStyle = '#9ecbff'; x.font = 'bold 18px "Courier New", monospace';
    x.fillText('GS   ' + String(Math.round((o.gs || 0) * KT)).padStart(3) + ' KT', rx + 18, 200);
    x.fillText('AGL  ' + String(Math.max(0, Math.round((o.agl || 0) * FT))).padStart(5) + ' FT', rx + 18, 230);
    x.fillText('G   ' + (o.gload || 1).toFixed(1), rx + 18, 260);
    if (o.stallWarn) { x.fillStyle = '#ff3b30'; x.font = 'bold 24px Arial'; x.fillText('ESTOL', rx + 18, 310); }
    if (ctl.brake) { x.fillStyle = '#ffb300'; x.font = 'bold 18px Arial'; x.fillText('FREIO', rx + 150, 310); }
    // iluminação noturna do painel
    if (night > 0.3) { x.fillStyle = `rgba(255,120,40,${0.08 * night})`; x.fillRect(0, 0, W, H); }
  }
}
