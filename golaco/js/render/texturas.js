// Texturas procedurais (CanvasTexture), todas determinísticas e pequenas (≤ 2048 px):
// gramado com faixas de corte, grão da grama, rede, placas de publicidade (marcas FICTÍCIAS),
// cadeiras da arquibancada, bola, sombra de contato, bandeira de escanteio e indicador.
import * as THREE from 'three';
import { CAMPO } from '../config.js';
import { criarCanvas, texturaCanvas, hash2, ruido, gerador } from './util.js';

// Área coberta pela textura do gramado (campo + entorno).
export const GRAMA = {
  x0: -(CAMPO.meioX + CAMPO.entorno),
  z0: -(CAMPO.meioZ + CAMPO.entorno),
  lx: CAMPO.comprimento + 2 * CAMPO.entorno,
  lz: CAMPO.largura + 2 * CAMPO.entorno,
  faixa: CAMPO.comprimento / 20,   // 20 faixas de corte de 5,25 m
};

/**
 * Gramado inteiro (faixas de corte + manchas grandes + desgaste na boca do gol e no meio).
 * O grão fino fica na textura de detalhe (repetida), para não precisar de resolução aqui.
 */
export function texGramado(largura, aniso) {
  const W = largura, H = largura / 2;
  const c = criarCanvas(W, H);
  const g = c.getContext('2d');
  const pxm = W / GRAMA.lx, pzm = H / GRAMA.lz;
  const X = x => (x - GRAMA.x0) * pxm;
  const Z = z => (z - GRAMA.z0) * pzm;
  // faixas de corte (bordas levemente suaves)
  const claro = [62, 128, 50], escuro = [47, 104, 39];
  const n = Math.ceil(GRAMA.lx / GRAMA.faixa) + 2;
  const inicio = -Math.ceil(-GRAMA.x0 / GRAMA.faixa);
  for (let i = inicio; i < inicio + n; i++) {
    const a = i * GRAMA.faixa, b = a + GRAMA.faixa;
    const cor = (i & 1) ? escuro : claro;
    g.fillStyle = `rgb(${cor[0]},${cor[1]},${cor[2]})`;
    g.fillRect(Math.floor(X(a)), 0, Math.ceil(X(b) - X(a)) + 1, H);
  }
  // suaviza as bordas das faixas (1 px)
  g.filter = 'blur(0.8px)';
  g.drawImage(c, 0, 0);
  g.filter = 'none';
  // manchas grandes (ruído de baixa frequência ampliado): variação de tom do gramado
  const pw = 96, ph = 48;
  const p = criarCanvas(pw, ph);
  const pg = p.getContext('2d');
  const img = pg.createImageData(pw, ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const v = ruido(x / 6, y / 6, 16, 8, 3) * 0.6 + ruido(x / 2.5, y / 2.5, 39, 20, 7) * 0.4;
      const k = (x + y * pw) * 4;
      const claro2 = v > 0.5;
      img.data[k] = claro2 ? 210 : 10;
      img.data[k + 1] = claro2 ? 230 : 30;
      img.data[k + 2] = claro2 ? 140 : 10;
      img.data[k + 3] = Math.round(Math.abs(v - 0.5) * 2 * 34);
    }
  }
  pg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(p, 0, 0, W, H);
  // desgaste: boca dos gols, marca do pênalti e círculo central (grama mais clara/amarelada)
  const gasto = (x, z, rx, rz, a) => {
    const cx = X(x), cz = Z(z);
    const grd = g.createRadialGradient(cx, cz, 0, cx, cz, rx * pxm);
    grd.addColorStop(0, `rgba(150,140,80,${a})`);
    grd.addColorStop(0.6, `rgba(140,135,80,${a * 0.45})`);
    grd.addColorStop(1, 'rgba(140,135,80,0)');
    g.save();
    g.translate(cx, cz); g.scale(1, (rz * pzm) / (rx * pxm)); g.translate(-cx, -cz);
    g.fillStyle = grd;
    g.fillRect(cx - rx * pxm, cz - rx * pxm, rx * pxm * 2, rx * pxm * 2);
    g.restore();
  };
  for (const s of [-1, 1]) {
    gasto(s * (CAMPO.meioX - 2.2), 0, 3.4, 4.2, 0.32);
    gasto(s * (CAMPO.meioX - CAMPO.marcaPenalti), 0, 1.6, 1.4, 0.2);
    gasto(s * (CAMPO.meioX - 8), 0, 9, 7, 0.08);
  }
  gasto(0, 0, 3, 2.5, 0.14);
  // linha da faixa de corte nas laterais do campo (grama do entorno um pouco mais escura)
  g.fillStyle = 'rgba(10,30,8,0.12)';
  g.fillRect(0, 0, W, Z(-CAMPO.meioZ));
  g.fillRect(0, Z(CAMPO.meioZ), W, H - Z(CAMPO.meioZ));
  g.fillRect(0, 0, X(-CAMPO.meioX), H);
  g.fillRect(X(CAMPO.meioX), 0, W - X(CAMPO.meioX), H);
  return texturaCanvas(c, { aniso });
}

/** Grão da grama: tons de cinza em torno de 0,5 (multiplicado por 2 no shader), repetível. */
export function texDetalheGrama(tam, aniso) {
  const c = criarCanvas(tam, tam);
  const g = c.getContext('2d');
  const img = g.createImageData(tam, tam);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const v = 128 + (hash2(x, y, 11) - 0.5) * 40 + (ruido(x / 8, y / 8, tam / 8, tam / 8, 5) - 0.5) * 30;
      const k = (x + y * tam) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // folhas: traços curtos claros e escuros (repetidos nas bordas para emendar sem costura)
  const rnd = gerador(77);
  const nTr = Math.round(tam * tam / 22);
  g.lineCap = 'round';
  for (let i = 0; i < nTr; i++) {
    const x = rnd() * tam, y = rnd() * tam;
    const a = rnd() * Math.PI * 2;
    const l = 2 + rnd() * 5;
    const claro = rnd() < 0.5;
    g.strokeStyle = claro ? `rgba(255,255,255,${0.10 + rnd() * 0.12})` : `rgba(0,0,0,${0.10 + rnd() * 0.12})`;
    g.lineWidth = 0.8 + rnd() * 0.8;
    for (const ox of [-tam, 0, tam]) for (const oy of [-tam, 0, tam]) {
      const x0 = x + ox, y0 = y + oy;
      if (x0 < -8 || x0 > tam + 8 || y0 < -8 || y0 > tam + 8) continue;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke();
    }
  }
  return texturaCanvas(c, { repetir: true, aniso, cor: false });
}

/** Malha da rede (fios brancos com transparência), repetível. */
export function texRede(aniso) {
  const t = 128;
  const c = criarCanvas(t, t);
  const g = c.getContext('2d');
  g.clearRect(0, 0, t, t);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 7;
  // losango: duas diagonais, emendando nas bordas
  g.beginPath();
  g.moveTo(0, t / 2); g.lineTo(t / 2, 0); g.lineTo(t, t / 2); g.lineTo(t / 2, t); g.closePath();
  g.stroke();
  const tx = texturaCanvas(c, { repetir: true, aniso });
  tx.premultiplyAlpha = false;
  return tx;
}

// Marcas FICTÍCIAS das placas (nada licenciado).
const PAINEIS = [
  { texto: 'VERDEX', fundo: '#050707', cor: '#19e07a', detalhe: 'barra' },
  { texto: 'GOLAÇO', fundo: '#19e07a', cor: '#050707', detalhe: 'nenhum' },
  { texto: 'NORTE SPORTS', fundo: '#0a0d0e', cor: '#f2f6f3', detalhe: 'seta' },
  { texto: 'GOLAÇO', fundo: '#050707', cor: '#f2f6f3', detalhe: 'verde' },
];
export const PLACA = { altura: 0.9, periodo: 24 }; // 4 painéis de 6 m

/** Faixa de placas de LED: 4 painéis lado a lado (cada um 6 m × 0,9 m). */
export function texPlacas(aniso) {
  const W = 2048, H = 80;
  const c = criarCanvas(W, H);
  const g = c.getContext('2d');
  const pw = W / PAINEIS.length;
  PAINEIS.forEach((p, i) => {
    const x0 = i * pw;
    g.fillStyle = p.fundo;
    g.fillRect(x0, 0, pw, H);
    // brilho sutil do LED
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(255,255,255,0.07)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = grd;
    g.fillRect(x0, 0, pw, H);
    g.save();
    g.beginPath(); g.rect(x0, 0, pw, H); g.clip();
    g.fillStyle = p.cor;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tam = p.texto.length > 8 ? 44 : 54;
    g.font = `italic 900 ${tam}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    const larg = Math.min(pw * 0.78, g.measureText(p.texto).width);
    const sx = larg / Math.max(1, g.measureText(p.texto).width);
    g.translate(x0 + pw / 2, H / 2 + 2);
    g.scale(sx, 1);
    g.fillText(p.texto, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (p.detalhe === 'barra') {
      g.fillStyle = p.cor;
      g.fillRect(x0 + 18, H - 12, pw - 36, 4);
    } else if (p.detalhe === 'seta') {
      g.fillStyle = '#19e07a';
      g.beginPath(); g.moveTo(x0 + 20, 18); g.lineTo(x0 + 44, H / 2); g.lineTo(x0 + 20, H - 18); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x0 + pw - 44, 18); g.lineTo(x0 + pw - 20, H / 2); g.lineTo(x0 + pw - 44, H - 18); g.closePath(); g.fill();
    } else if (p.detalhe === 'verde') {
      g.fillStyle = '#19e07a';
      g.fillRect(x0, 0, 10, H); g.fillRect(x0 + pw - 10, 0, 10, H);
    }
    g.restore();
    // separação entre painéis
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(x0, 0, 2, H);
  });
  return texturaCanvas(c, { repetir: true, aniso });
}

export const ARQ = { fileiras: 36, assentoLarg: 0.5, comprimento: 125 };

/**
 * Cadeiras da arquibancada: fileiras (degrau, assento, encosto), corredores e o nome
 * GOLAÇO em cadeiras verdes no meio. A faixa de cima (v > 0,95) é a cor das paredes.
 */
export function texArquibancada(aniso, comTexto = true) {
  const W = 2048, H = 512;
  const c = criarCanvas(W, H);
  const g = c.getContext('2d');
  const topo = 24;                      // faixa de parede (cinza-escuro)
  g.fillStyle = '#202426';
  g.fillRect(0, 0, W, topo);
  const nF = ARQ.fileiras;
  const hF = (H - topo) / nF;
  const nA = Math.round(ARQ.comprimento / ARQ.assentoLarg);
  const wA = W / nA;
  // máscara do texto (uma célula por cadeira)
  const mk = criarCanvas(nA, nF);
  const mg = mk.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, nA, nF);
  mg.fillStyle = '#fff';
  mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.font = '900 13px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  // largura do texto ~60 m (120 cadeiras), nas fileiras 3–14 (as que a câmera de TV vê)
  const larg = mg.measureText('GOLAÇO').width;
  mg.save();
  mg.translate(nA / 2, nF - 9.5);
  mg.scale(120 / larg, 1);
  if (comTexto) mg.fillText('GOLAÇO', 0, 0);
  mg.restore();
  const mascara = mg.getImageData(0, 0, nA, nF).data;
  const rnd = gerador(comTexto ? 5 : 9);
  for (let f = 0; f < nF; f++) {
    const y0 = topo + f * hF;
    // degrau (concreto)
    g.fillStyle = '#3b4043';
    g.fillRect(0, y0, W, hF);
    for (let a = 0; a < nA; a++) {
      const corredor = (a % 26) < 2;
      const x0 = a * wA;
      if (corredor) {
        g.fillStyle = f % 2 ? '#4a4f52' : '#43484b';
        g.fillRect(x0, y0, wA, hF);
        continue;
      }
      const texto = mascara[(a + f * nA) * 4] > 110;
      let cor;
      if (texto) cor = '#12b866';
      else {
        const r = rnd();
        cor = r < 0.06 ? '#2a3033' : r < 0.12 ? '#0f5233' : '#14181a';
      }
      g.fillStyle = cor;
      g.fillRect(x0 + 0.6, y0 + hF * 0.22, wA - 1.2, hF * 0.55);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x0 + 0.6, y0 + hF * 0.22, wA - 1.2, hF * 0.12);
    }
    // sombra do degrau de cima
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, y0, W, Math.max(1, hF * 0.12));
  }
  return texturaCanvas(c, { aniso });
}

/**
 * Bola: 12 pentágonos e 20 hexágonos (icosaedro truncado, por Voronoi na esfera) com
 * costuras; pentágonos pretos com contorno verde. Projeção equirretangular da SphereGeometry.
 */
export function texBola(W) {
  const H = W / 2;
  const c = criarCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const fi = (1 + Math.sqrt(5)) / 2;
  const centros = [];
  const add = (x, y, z, pent) => { const l = Math.hypot(x, y, z); centros.push([x / l, y / l, z / l, pent]); };
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    add(0, a, b * fi, 1); add(a, b * fi, 0, 1); add(b * fi, 0, a, 1);
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) add(a, b, d, 0);
  const ifi = 1 / fi;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    add(0, a * ifi, b * fi, 0); add(a * ifi, b * fi, 0, 0); add(b * fi, 0, a * ifi, 0);
  }
  for (let py = 0; py < H; py++) {
    const th = Math.PI * (py + 0.5) / H;
    const st = Math.sin(th), ct = Math.cos(th);
    for (let px = 0; px < W; px++) {
      const ph = 2 * Math.PI * (px + 0.5) / W;
      const dx = -Math.cos(ph) * st, dy = ct, dz = Math.sin(ph) * st;
      let m1 = -2, m2 = -2, i1 = 0;
      for (let i = 0; i < centros.length; i++) {
        const cc = centros[i];
        const d = cc[0] * dx + cc[1] * dy + cc[2] * dz;
        if (d > m1) { m2 = m1; m1 = d; i1 = i; } else if (d > m2) m2 = d;
      }
      const borda = Math.acos(Math.min(1, m2)) - Math.acos(Math.min(1, m1)); // ~2× dist. à costura
      let r, gg, b;
      if (centros[i1][3]) {
        if (borda < 0.05) { r = 70; gg = 74; b = 72; }
        else if (borda < 0.13) { r = 25; gg = 224; b = 122; }
        else { r = 12; gg = 14; b = 15; }
      } else {
        const sombra = borda < 0.04 ? 0.62 : 1;
        r = 240 * sombra; gg = 243 * sombra; b = 240 * sombra;
      }
      const k = (px + py * W) * 4;
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return texturaCanvas(c, { aniso: 4 });
}

/** Sombra de contato (mancha radial suave). */
export function texMancha() {
  const t = 64;
  const c = criarCanvas(t, t);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, t, t);
  return texturaCanvas(c, { cor: false });
}

/** Bandeira de escanteio (verde com faixa preta). */
export function texBandeira() {
  const c = criarCanvas(64, 48);
  const g = c.getContext('2d');
  g.fillStyle = '#19e07a'; g.fillRect(0, 0, 64, 48);
  g.fillStyle = '#07090a';
  g.beginPath(); g.moveTo(0, 48); g.lineTo(64, 0); g.lineTo(64, 14); g.lineTo(14, 48); g.closePath(); g.fill();
  return texturaCanvas(c, {});
}

/** Indicador acima do jogador controlado (seta verde para baixo). */
export function texIndicador() {
  const c = criarCanvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#19e07a';
  g.strokeStyle = '#07090a';
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(8, 12); g.lineTo(56, 12); g.lineTo(32, 54); g.closePath();
  g.stroke(); g.fill();
  return texturaCanvas(c, {});
}

/** Brilho do refletor (sprite aditivo à noite). */
export function texBrilho() {
  const t = 64;
  const c = criarCanvas(t, t);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(230,240,255,0.6)');
  grd.addColorStop(1, 'rgba(200,220,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, t, t);
  return texturaCanvas(c, {});
}

export { THREE };
