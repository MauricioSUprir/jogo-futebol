// Texturas procedurais (canvas) do laboratório. Todas ≤ 1024². O emblema é o desenho próprio (estrela num anel); se o
// assets/star/config.json apontar um arquivo (do dono, ver assets/star/LEIAME.md) ele o substitui no letreiro, no piso e nas paredes.
export const ROTULOS = [
  'CONTENÇÃO 01', 'CONTENÇÃO 02', 'CONTENÇÃO 03', 'CONTENÇÃO 04', 'CONTENÇÃO 05', 'CONTENÇÃO 06', 'CONTENÇÃO 07', 'CONTENÇÃO 08',
  'CORTEX', 'ESTEIRA DE VELOCIDADE', 'ACELERADOR', 'RECEPÇÃO', 'SAÍDA', 'ALTA ENERGIA', 'ÁREA RESTRITA', 'CONTENÇÃO',
  '0 m', '5 m', '10 m', '15 m', '20 m', '25 m', 'ÁTRIO', 'PESQUISA',
];
const COLS = 4, LINS = 8;
/** Retângulo [u0, u1, v0, v1] do rótulo no atlas (v para cima). */
export function retanguloRotulo(nome) {
  const i = ROTULOS.indexOf(nome); if (i < 0) throw new Error(`rótulo desconhecido: ${nome}`);
  const c = i % COLS, l = Math.floor(i / COLS);
  return [c / COLS + 0.004, (c + 1) / COLS - 0.004, 1 - (l + 1) / LINS + 0.004, 1 - l / LINS - 0.004];
}

export function criarTexturas(THREE, aniso = 4) {
  const lista = [];
  let sem = 91;
  const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
  const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, { cor = true, repete = true } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (cor) t.colorSpace = THREE.SRGBColorSpace;
    if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso; lista.push(t); return t;
  };
  const ruido = (g, w, h, n, a = 0.06) => { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } };
  const T = {};

  // ----- fachada: painéis azul-marinho foscos de 2 m (tile 8 m), juntas finas e parafusos discretos -----
  { const [c, g] = tela(512, 512); g.fillStyle = '#16233d'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = Math.floor(rnd() * 7); g.fillStyle = `rgb(${24 + s},${38 + s},${66 + s})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); }
    g.strokeStyle = 'rgba(8,14,26,0.85)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    g.fillStyle = 'rgba(90,110,140,0.35)'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) for (const [dx, dy] of [[8, 8], [116, 8], [8, 116], [116, 116]]) g.fillRect(x * 128 + dx, y * 128 + dy, 3, 3);
    ruido(g, 512, 512, 4000, 0.05); T.fachada = tex(c); }
  // ----- andares com janelas em fita (tile 8 m = 2 andares de 4 m): peitoril azul-marinho + vidro escuro; à noite parte acende -----
  { const [c, g] = tela(512, 512), [ce, ge] = tela(512, 512);
    g.fillStyle = '#16233d'; g.fillRect(0, 0, 512, 512); ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 512);
    for (let f = 0; f < 2; f++) {
      const y0 = f * 256, jan = y0 + 92, alt = 150;            // peitoril de ~1,4 m, janela de ~2,3 m
      g.fillStyle = '#1b2a48'; g.fillRect(0, y0 + 2, 512, 86);
      const gr = g.createLinearGradient(0, jan, 0, jan + alt); gr.addColorStop(0, '#2c4466'); gr.addColorStop(0.55, '#14243c'); gr.addColorStop(1, '#0d1829'); g.fillStyle = gr; g.fillRect(0, jan, 512, alt);
      for (let k = 0; k < 5; k++) {                            // 5 vãos de 1,6 m por ladrilho; uns acesos à noite
        const x0 = k * 102.4;
        if (rnd() < 0.42) { const q = 0.55 + rnd() * 0.45; ge.fillStyle = `rgb(${Math.round(255 * q)},${Math.round(214 * q)},${Math.round(160 * q)})`; ge.fillRect(x0 + 5, jan + 4, 92, alt - 8); }
        g.fillStyle = '#0a111e'; g.fillRect(x0, jan, 5, alt);  // montante
      }
      g.fillStyle = '#0a111e'; g.fillRect(0, jan - 3, 512, 4); g.fillRect(0, jan + alt, 512, 4);
      g.fillStyle = 'rgba(160,190,230,0.10)'; g.fillRect(0, jan + 6, 512, 18);   // reflexo fraco do céu no alto do vidro
    }
    ruido(g, 512, 512, 3000, 0.05); T.janelas = tex(c); T.janelasLuz = tex(ce); }
  // ----- parede interna -----
  { const [c, g] = tela(512, 512); g.fillStyle = '#e8edf1'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(120,135,150,0.5)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    ruido(g, 512, 512, 2500, 0.05); T.parede = tex(c); }
  // ----- pisos -----
  { const [c, g] = tela(512, 512); g.fillStyle = '#9aa4ad'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = 196 + Math.floor(rnd() * 16); g.fillStyle = `rgb(${s},${s + 5},${s + 10})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); }
    const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.18)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    ruido(g, 512, 512, 3000, 0.06); T.pisoAtrio = tex(c); }
  { const [c, g] = tela(1024, 1024); g.fillStyle = '#080e15'; g.fillRect(0, 0, 1024, 1024);
    const gr = g.createRadialGradient(512, 512, 40, 512, 512, 720); gr.addColorStop(0, '#16324a'); gr.addColorStop(1, '#070c12'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(63,224,255,0.9)'; for (const [r, w] of [[96, 5], [168, 3], [250, 5], [340, 2], [430, 4], [500, 2]]) { g.lineWidth = w; g.beginPath(); g.arc(512, 512, r, 0, 6.2832); g.stroke(); }
    g.strokeStyle = 'rgba(63,224,255,0.35)'; g.lineWidth = 2; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; g.beginPath(); g.moveTo(512 + Math.cos(a) * 100, 512 + Math.sin(a) * 100); g.lineTo(512 + Math.cos(a) * 500, 512 + Math.sin(a) * 500); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.strokeRect(14, 14, 996, 996);
    ruido(g, 1024, 1024, 5000, 0.05); T.pisoCortex = tex(c, { repete: false }); }
  { const [c, g] = tela(512, 512); g.fillStyle = '#a9b3bb'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const s = 170 + Math.floor(rnd() * 14); g.fillStyle = `rgb(${s},${s + 6},${s + 12})`; g.fillRect(x * 256 + 3, y * 256 + 3, 250, 250); }
    ruido(g, 512, 512, 5000, 0.1); T.pisoCont = tex(c); }
  { const [c, g] = tela(512, 1024); g.fillStyle = '#1b2736'; g.fillRect(0, 0, 512, 1024);
    const pista = (r, cor, w) => { g.strokeStyle = cor; g.lineWidth = w; g.beginPath(); g.moveTo(256 - r, 300); g.arc(256, 300, r, Math.PI, 0); g.lineTo(256 + r, 724); g.arc(256, 724, r, 0, Math.PI); g.closePath(); g.stroke(); };
    for (let k = 0; k < 5; k++) pista(70 + k * 36, k === 0 || k === 4 ? 'rgba(255,255,255,0.9)' : 'rgba(63,224,255,0.7)', k === 0 || k === 4 ? 6 : 3);
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(70 + 36 * 0 + i * 17.5 + 12, 300 + j * 12 - 6, 17.5, 12); }
    ruido(g, 512, 1024, 6000, 0.08); T.pisoEsteira = tex(c, { repete: false }); }
  { const [c, g] = tela(256, 256); g.fillStyle = '#15191e'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#3b444d'; g.lineWidth = 3; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(256, i * 16); g.stroke(); }
    g.fillStyle = '#0a0c0f'; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.fillRect(x * 16 + 4, y * 16 + 4, 8, 8);
    T.pisoAcel = tex(c); }
  { const [c, g] = tela(256, 64); g.fillStyle = '#ffc400'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#16181b'; for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 40, 64); g.lineTo(i * 40 + 20, 64); g.lineTo(i * 40 + 52, 0); g.lineTo(i * 40 + 32, 0); g.fill(); } T.perigo = tex(c); }
  { const [c, g] = tela(256, 256); g.fillStyle = '#1a1d22'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#2b3036'; for (let i = 0; i < 16; i++) g.fillRect(0, i * 16 + 2, 256, 6); ruido(g, 256, 256, 1500, 0.1); T.correia = tex(c); }
  // ----- teto: placas e luminárias (+ emissiva só nas luzes) -----
  { const [c, g] = tela(512, 512), [ce, ge] = tela(512, 512);
    g.fillStyle = '#d9dee3'; g.fillRect(0, 0, 512, 512); ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(100,110,120,0.6)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
    for (const [x, y] of [[64, 64], [320, 64], [64, 320], [320, 320]]) { g.fillStyle = '#f6fbff'; g.fillRect(x, y, 128, 128); ge.fillStyle = '#e6f6ff'; ge.fillRect(x + 6, y + 6, 116, 116); }
    T.teto = tex(c); T.tetoLuz = tex(ce); }
  // ----- pavimento externo e telhado -----
  { const [c, g] = tela(512, 512); g.fillStyle = '#b6bbbf'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = 170 + Math.floor(rnd() * 20); g.fillStyle = `rgb(${s},${s + 3},${s + 6})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); }
    ruido(g, 512, 512, 6000, 0.1); T.pav = tex(c); }
  { const [c, g] = tela(256, 256); g.fillStyle = '#74777b'; g.fillRect(0, 0, 256, 256); ruido(g, 256, 256, 6000, 0.22);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } T.telhado = tex(c); }

  // ----- logo: estrela de 5 pontas dentro de um anel (ciano e branco) -----
  function pintaLogo(g, cx, cy, R, fundo) {
    if (fundo) { g.fillStyle = fundo; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.fill(); }
    g.strokeStyle = '#8fb8e6'; g.lineWidth = R * 0.09; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, 6.2832); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = R * 0.025; g.beginPath(); g.arc(cx, cy, R * 0.78, 0, 6.2832); g.stroke();
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? R * 0.30 : R * 0.68; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = R * 0.03; g.strokeStyle = '#8fb8e6'; g.stroke();
  }
  let cLogo, gLogo;
  { const [c, g] = tela(512, 512); cLogo = c; gLogo = g; pintaLogo(g, 256, 256, 250, 'rgba(6,20,34,0.82)'); T.logo = tex(c, { repete: false }); }
  let cLogoL, gLogoL;                              // painéis largos (10 × 6 m)
  { const [c, g] = tela(1024, 614); cLogoL = c; gLogoL = g; pintaLogo(g, 512, 307, 290, 'rgba(6,20,34,0.82)'); T.logoL = tex(c, { repete: false }); }
  T.logoDoDono = (img) => {                       // troca o emblema pelo arquivo do dono (e refaz o letreiro)
    const cabe = (g, W, H, m) => { g.clearRect(0, 0, W, H); const k = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height); g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k); };
    cabe(gLogo, 512, 512, 24); T.logo.needsUpdate = true; cabe(gLogoL, 1024, 614, 60); T.logoL.needsUpdate = true;
    if (T.letreiroG) {
      const g = T.letreiroG, gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#06121f'); gr.addColorStop(1, '#0b2236'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 128);
      g.strokeStyle = '#3fe0ff'; g.lineWidth = 4; g.strokeRect(4, 4, 1016, 120);
      const k = 108 / img.height, w = img.width * k; g.drawImage(img, 28, 10, w, 108);
      g.fillStyle = '#3fe0ff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '600 30px Arial, Helvetica, sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText('PESQUISA  ·  ENERGIA', 28 + w + 50, 48); g.fillText('VELOCIDADE', 28 + w + 50, 90);
      T.letreiro.needsUpdate = true;
    }
  };
  { const [c, g] = tela(1024, 128);
    const gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#0c1830'); gr.addColorStop(1, '#13223e'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 128);
    g.strokeStyle = '#8fb8e6'; g.lineWidth = 3; g.strokeRect(4, 4, 1016, 120);
    pintaLogo(g, 72, 64, 52, null);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    let px = 62; g.font = `bold ${px}px Arial, Helvetica, sans-serif`;
    while (g.measureText('S.T.A.R. LABS').width > 840 && px > 20) { px -= 2; g.font = `bold ${px}px Arial, Helvetica, sans-serif`; }
    g.fillText('S.T.A.R. LABS', 150, 50);
    g.fillStyle = '#9cc0e8'; g.font = '600 22px Arial, Helvetica, sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '8px';
    g.fillText('PESQUISA  ·  ENERGIA  ·  VELOCIDADE', 154, 102);
    T.letreiroG = g; T.letreiro = tex(c, { repete: false }); }
  // assets/star/config.json diz qual arquivo usar ({"logo": "logo.png"}); com "logo": null fica o emblema próprio (sem pedido de rede perdido)
  fetch(new URL('../assets/star/config.json', import.meta.url)).then((r) => r.json()).then((cfg) => {
    if (!cfg.logo) return;
    const img = new Image(); img.onload = () => T.logoDoDono(img); img.src = new URL(`../assets/star/${cfg.logo}`, import.meta.url).href;
  }).catch(() => { /* sem configuração: fica o emblema próprio */ });

  // ----- atlas de placas -----
  { const [c, g] = tela(1024, 1024); const cw = 256, ch = 128;
    ROTULOS.forEach((nome, i) => {
      const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch;
      const perigo = /ALTA|RESTRITA|CONTEN/.test(nome), medida = /\bm$/.test(nome);
      g.fillStyle = perigo ? '#2a1d05' : '#0b1b2b'; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      g.strokeStyle = perigo ? '#ffc400' : '#3fe0ff'; g.lineWidth = 4; g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
      g.fillStyle = perigo ? '#ffd23f' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let px = medida ? 64 : 34; const larg = cw - 36; g.font = `bold ${px}px Arial, Helvetica, sans-serif`;
      const partes = nome.includes(' ') && !medida && nome.length > 11 ? nome.split(' ') : [nome];
      for (const p of partes) while (g.measureText(p).width > larg && px > 12) { px -= 2; g.font = `bold ${px}px Arial, Helvetica, sans-serif`; }
      partes.forEach((p, k) => g.fillText(p, x + cw / 2, y + ch / 2 + (k - (partes.length - 1) / 2) * (px + 4)));
    });
    T.atlas = tex(c, { repete: false }); }

  // ----- telas animadas (512 × 256) -----
  const telas = {};
  function nova(nome, pinta) { const [c, g] = tela(512, 256); const t = tex(c, { repete: false }); telas[nome] = { c, g, t, pinta }; pinta(g, 0); t.needsUpdate = true; }
  const fundo = (g, a = '#06121c', b = '#0a2438') => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#3fe0ff'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 252); };
  const txt = (g, s, x, y, px, cor = '#fff', al = 'left') => { g.fillStyle = cor; g.font = `bold ${px}px Arial, Helvetica, sans-serif`; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  nova('mapa', (g, t) => {
    fundo(g); g.strokeStyle = 'rgba(63,224,255,0.25)'; g.lineWidth = 1; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 32, 40); g.lineTo(i * 32, 256); g.stroke(); } for (let j = 1; j <= 7; j++) { g.beginPath(); g.moveTo(0, 40 + j * 31); g.lineTo(512, 40 + j * 31); g.stroke(); }
    g.fillStyle = 'rgba(63,224,255,0.22)'; for (let i = 0; i < 40; i++) { const x = 8 + (i * 97) % 480, y = 50 + (i * 53) % 180; g.fillRect(x, y, 14 + (i * 7) % 24, 10 + (i * 11) % 22); }
    for (let k = 0; k < 4; k++) { const a = t * 0.8 + k * 1.6, x = 256 + Math.cos(a) * (60 + k * 40), y = 150 + Math.sin(a * 1.3) * (30 + k * 18); g.fillStyle = k === 0 ? '#ff4d5e' : '#ffd23f'; g.beginPath(); g.arc(x, y, 6, 0, 6.2832); g.fill(); g.strokeStyle = g.fillStyle; g.globalAlpha = 0.5; g.beginPath(); g.arc(x, y, 8 + (t * 14 + k * 5) % 20, 0, 6.2832); g.stroke(); g.globalAlpha = 1; }
    txt(g, 'MONITORAMENTO URBANO', 16, 20, 22, '#3fe0ff'); txt(g, 'SETOR 07 · ATIVO', 496, 20, 16, '#9fe9ff', 'right');
  });
  nova('energia', (g, t) => {
    fundo(g); txt(g, 'ENERGIA', 16, 24, 22, '#3fe0ff'); txt(g, `${Math.round(84 + 5 * Math.sin(t))}%`, 496, 28, 36, '#ffd23f', 'right');
    for (let i = 0; i < 16; i++) { const h = 30 + 80 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.7)); g.fillStyle = i % 4 === 0 ? '#ffd23f' : '#3fe0ff'; g.fillRect(20 + i * 29, 230 - h, 20, h); }
    g.strokeStyle = '#ff4d5e'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 480; x += 8) { const y = 120 + 30 * Math.sin(x * 0.04 + t * 2); x ? g.lineTo(16 + x, y) : g.moveTo(16, y); } g.stroke();
  });
  nova('relogio', (g, t) => {
    fundo(g, '#050b12', '#0c1a28'); const s = Math.floor(t * 4) % 86400, hh = String(Math.floor(s / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    txt(g, `${hh}:${mm}:${ss}`, 256, 110, 96, '#ffffff', 'center'); txt(g, 'RECORDE DA ESTEIRA  1.482 km/h', 256, 190, 28, '#3fe0ff', 'center'); txt(g, 'S.T.A.R. LABS · PESQUISA EM VELOCIDADE', 256, 230, 16, '#9fe9ff', 'center');
  });
  nova('onda', (g, t) => {
    fundo(g); txt(g, 'ANÁLISE DE PARTÍCULAS', 16, 20, 20, '#3fe0ff');
    for (const [cor, f, a, off] of [['#3fe0ff', 0.05, 40, 0], ['#ffd23f', 0.11, 22, 1.7], ['#ff4d5e', 0.03, 30, 3.1]]) { g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 488; x += 6) { const y = 140 + a * Math.sin(x * f + t * 2 + off) * Math.sin(x * 0.012 + t * 0.5); x ? g.lineTo(12 + x, y) : g.moveTo(12, y); } g.stroke(); }
  });
  nova('vel', (g, t) => {
    fundo(g, '#07090f', '#10202e'); const v = Math.round(700 + 140 * Math.sin(t * 0.9));
    txt(g, 'TESTE DE VELOCIDADE', 256, 28, 22, '#3fe0ff', 'center'); txt(g, String(v), 230, 130, 120, '#ffffff', 'center'); txt(g, 'km/h', 440, 150, 38, '#ffd23f', 'center');
    g.fillStyle = '#1b2b3a'; g.fillRect(24, 210, 464, 20); g.fillStyle = '#3fe0ff'; g.fillRect(24, 210, 464 * (v - 500) / 400, 20);
  });
  const redesenhar = (tempo, so) => { for (const [nome, o] of Object.entries(telas)) { if (so && !so.includes(nome)) continue; o.pinta(o.g, tempo); o.t.needsUpdate = true; } };
  return { T, telas, redesenhar, texturas: lista };
}
