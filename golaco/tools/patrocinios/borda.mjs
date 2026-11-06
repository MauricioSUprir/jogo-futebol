// A BORDA das máscaras dos patrocínios (item 63, "retângulos tracejados brancos em volta dos números e patrocínios das
// camisas"). Conta pura (só o canal alfa, 512 × 256, linha a linha), usada pelo gerar.mjs (máscara nova) e pelo
// refazer-bordas.mjs (as máscaras já publicadas: os logos de origem não estão no repositório) e conferida no navegador
// pelo teste-corpo-tela C10:
//  - NÉVOA: o alfa baixo espalhado pela caixa (o ruído do JPEG que vira alfa pela "distância ao fundo × 4,25" do gerar.mjs,
//    o painel cinza de α ~30 atrás do texto) some — α ≤ 36 vira 0 e a rampa até 72 fica contínua. A mistura do shader é em
//    cor LINEAR: α 12/255 de branco numa camisa preta já leva o L* de 0 a 25 (um retângulo sujo em volta do logo);
//  - MARGEM: o desenho fica a ≥ 8 px (2³: limpa até o mip 3, 64 × 32) da borda da caixa que o shader recorta (o centro da
//    máscara com a proporção `asp`, humano3d.js decalLogo) — encostado nela, o borrão do mip grosso (e, sem a folga cortada
//    pela borda da imagem de origem, o próprio desenho) saía cortado reto pela caixa. O desenho encolhe em volta do centro
//    pela `escala` s (filtro de área exato) e o índice guarda s: o jogo alarga a caixa por 1 ÷ s (jogador3d.js
//    escreverDecais) e o logo fica do MESMO tamanho na camisa;
//  - FORA DA CAIXA: 0 (o shader não lê, mas os mips grossos de perto da borda levam o que estiver ali para dentro).
// (Kyle Halladay, "Minimizing Mip Map Artifacts In Atlassed Textures": a margem só protege até o mip em que some;
// lisyarus, "Exploring ways to mipmap alpha-tested textures": o alfa baixo espalhado é o que o filtro carrega)
export const LW = 512, LH = 256;
export const BORDA = { margem: 8, nevoa: [36, 72], desenho: 8 };

/** A caixa do shader em px da máscara (x0, x1, y0, y1; pode ser fracionária): o centro com a proporção asp (decalLogo). */
export function caixaDoShader(asp) {
  const a = Math.max(asp, 0.05), kx = Math.min(1, a / 2), ky = Math.min(1, 2 / a);
  return { x0: LW / 2 * (1 - kx), x1: LW / 2 * (1 + kx), y0: LH / 2 * (1 - ky), y1: LH / 2 * (1 + ky) };
}

/** A rampa da névoa: 0 até nevoa[0], contínua até nevoa[1], igual dali para cima. */
export function semNevoa(a) {
  const [n0, n1] = BORDA.nevoa;
  return a <= n0 ? 0 : a >= n1 ? a : Math.round((a - n0) * n1 / (n1 - n0));
}

/**
 * Medidas de uma máscara (alfa LW × LH) contra a caixa do shader de proporção asp: a margem (px) do desenho (α > 8) até a
 * borda da caixa, a névoa (fração da caixa com 0 < α ≤ 36 a mais de 2 px de um texel com α ≥ 72 — longe do desenho e
 * da borda suave dele) e os texels com α > 0 fora da caixa.
 */
export function medirMascara(alfa, asp) {
  const c = caixaDoShader(asp);
  let margem = Infinity, fora = 0, nevoa = 0, n = 0;
  const forte = new Uint8Array(LW * LH);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) if (alfa[y * LW + x] >= BORDA.nevoa[1]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < LW && yy >= 0 && yy < LH) forte[yy * LW + xx] = 1;
    }
  }
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const a = alfa[y * LW + x];
    const dentro = x + 1 > c.x0 && x < c.x1 && y + 1 > c.y0 && y < c.y1;
    if (!dentro) { if (a > 0) fora++; continue; }
    n++;
    if (a > 0 && a <= BORDA.nevoa[0] && !forte[y * LW + x]) nevoa++;
    if (a > BORDA.desenho) margem = Math.min(margem, x - c.x0, c.x1 - (x + 1), y - c.y0, c.y1 - (y + 1));
  }
  return { margem: margem === Infinity ? null : margem, nevoa: n ? nevoa / n : 0, fora };
}

/** Reamostra 1D com o filtro de área exato: out[j] = a média de src em [c + (j − c)/s, c + (j + 1 − c)/s] (0 fora). */
function areaLinha(src, n, s, c, out) {
  for (let j = 0; j < n; j++) {
    const a = c + (j - c) / s, b = c + (j + 1 - c) / s;
    let soma = 0;
    for (let k = Math.max(0, Math.floor(a)); k < Math.min(n, Math.ceil(b)); k++) soma += src[k] * (Math.min(b, k + 1) - Math.max(a, k));
    out[j] = soma / (b - a);
  }
}

/**
 * A máscara pronta: sem a névoa, nada fora da caixa e o desenho a ≥ BORDA.margem px da borda dela (encolhido pela escala
 * em volta do centro). alfa: Uint8Array LW × LH (não muda). Devolve {alfa (novo), escala (≤ 1; 1 = não encolheu)}.
 */
export function prepararMascara(alfa, asp) {
  const c = caixaDoShader(asp), M = BORDA.margem;
  const a = new Float64Array(LW * LH);
  let bx0 = LW, bx1 = -1, by0 = LH, by1 = -1;
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const dentro = x + 1 > c.x0 && x < c.x1 && y + 1 > c.y0 && y < c.y1;
    const v = dentro ? semNevoa(alfa[y * LW + x]) : 0;
    a[y * LW + x] = v;
    if (v > BORDA.desenho) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  }
  let s = 1;
  if (bx1 >= 0) {
    const cx = LW / 2, cy = LH / 2;
    const ex = Math.max(cx - bx0, bx1 + 1 - cx), ey = Math.max(cy - by0, by1 + 1 - cy);
    // (+1 px: o filtro de área espalha a borda do desenho por até 1 texel)
    s = Math.min(1, (cx - c.x0 - M - 1) / ex, (cy - c.y0 - M - 1) / ey);
    s = Math.floor(s * 1e4) / 1e4;
  }
  const out = new Uint8Array(LW * LH);
  if (s >= 1) { for (let i = 0; i < out.length; i++) out[i] = Math.round(a[i]); return { alfa: out, escala: 1 }; }
  // separável: as linhas (x), depois as colunas (y), em volta do centro da máscara (o da caixa)
  const tmp = new Float64Array(LW * LH), lin = new Float64Array(Math.max(LW, LH)), res = new Float64Array(Math.max(LW, LH));
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) lin[x] = a[y * LW + x];
    areaLinha(lin, LW, s, LW / 2, res);
    for (let x = 0; x < LW; x++) tmp[y * LW + x] = res[x];
  }
  for (let x = 0; x < LW; x++) {
    for (let y = 0; y < LH; y++) lin[y] = tmp[y * LW + x];
    areaLinha(lin, LH, s, LH / 2, res);
    for (let y = 0; y < LH; y++) out[y * LW + x] = Math.max(0, Math.min(255, Math.round(res[y])));
  }
  return { alfa: out, escala: s };
}

// ---------------------------------------------------------------------------------------------- no navegador (Playwright)
/** O alfa (LW × LH, linha a linha de cima para baixo, como o arquivo) de uma imagem (data URL), lido como o jogo lê. */
export async function lerAlfa(pagina, dadosUrl) {
  const b64 = await pagina.evaluate(async ([src, W, H]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];
    let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
    return btoa(s);
  }, [dadosUrl, LW, LH]);
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
/** O WebP da máscara (branco, a forma no alfa; o alfa sai sem perda — o RGB constante com perda 0,9, como o gerar.mjs). */
export async function webpDoAlfa(pagina, alfa) {
  const url = await pagina.evaluate(([b64, W, H]) => {
    const bin = atob(b64), c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = bin.charCodeAt(i); }
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  }, [Buffer.from(alfa).toString('base64'), LW, LH]);
  return Buffer.from(url.split(',')[1], 'base64');
}
