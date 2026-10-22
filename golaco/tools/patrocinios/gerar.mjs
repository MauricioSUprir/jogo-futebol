// Patrocínios e marca do fornecedor nas camisas REAIS — só a versão de TESTE (edição pro do Total Match; dono, 22/10:
// "pode botar os patrocinadores sim, lembra que é só aquele teste? vamos tirar dps"). A pesquisa de cada clube
// (<pasta>/<clube>.json, formato abaixo) e os logos baixados viram, para o jogo:
//   assets/tm/patrocinios.json        {clubes: {<nome do clube em uniformes.json>: {casa|fora|terceira|goleiro: [decal]}}}
//     decal = {logo: '<clube>/<marca>.webp', asp: largura ÷ altura do desenho, pos, lado, larg, cor '#rrggbb'}
//     pos ∈ peito | ombro | manga | barra_frontal | acima_numero | abaixo_numero | calcao | fornecedor
//   assets/tm/patrocinios/<clube>/<marca>.webp   a MÁSCARA do logo (branco, a forma no alfa), 512 × 256 com o desenho
//     centrado e encaixado (o jogo pinta com a cor da camisa: na camisa o logo é de uma cor só)
// A máscara sai no Chromium (SVG e PNG): PNG com transparência → o alfa; sem transparência → a distância ao fundo (a cor
// da borda). Recortada no desenho, com 2% de folga.
//   node tools/patrocinios/gerar.mjs <pasta da pesquisa>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir } from '../lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const PASTA = process.argv[2];
if (!PASTA) { console.error('uso: node tools/patrocinios/gerar.mjs <pasta da pesquisa>'); process.exit(2); }
const SAIDA = path.join(RAIZ, 'assets/tm/patrocinios');
const POS = ['peito', 'ombro', 'manga', 'barra_frontal', 'acima_numero', 'abaixo_numero', 'calcao'];
const KITS = ['casa', 'fora', 'terceira', 'goleiro'];
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const uniformes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/tm/uniformes.json'), 'utf8')).clubes;

// os logos a converter
const pedidos = new Map(); // arquivo de origem → destino relativo
const clubes = {};
for (const f of fs.readdirSync(PASTA).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(PASTA, f), 'utf8'));
  const nome = d.clube;
  if (!uniformes[nome]) { console.warn(`${nome}: não está em uniformes.json — pulado`); continue; }
  const sc = slug(nome);
  const destino = (orig, marca) => {
    if (!orig || !fs.existsSync(orig)) return null;
    const rel = `${sc}/${slug(marca)}.webp`;
    pedidos.set(orig, rel);
    return rel;
  };
  const c = { casa: [], fora: [], terceira: [], goleiro: [] };
  for (const p of d.patrocinios ?? []) {
    if (!POS.includes(p.posicao)) { console.warn(`${nome}/${p.nome}: posição ${p.posicao} desconhecida — pulado`); continue; }
    const logo = destino(p.logo, p.nome);
    if (!logo) { console.warn(`${nome}/${p.nome}: sem logo — pulado`); continue; }
    for (const k of p.uniformes ?? KITS) {
      if (!c[k]) continue;
      const cor = hex(p.cor_na_camisa?.[k]) ?? hex(p.cor_na_camisa?.casa) ?? '#ffffff';
      c[k].push({ logo, pos: p.posicao, lado: p.lado ?? null, larg: Number(p.largura_rel) || null, cor, nome: p.nome });
    }
  }
  const fo = d.fornecedor;
  if (fo?.nome) {
    const logo = destino(fo.logo, fo.nome), logo3 = destino(fo.logo_terceira, fo.nome + '-3');
    for (const k of KITS) {
      const l = k === 'terceira' && logo3 ? logo3 : logo;
      if (!l) continue;
      c[k].push({ logo: l, pos: 'fornecedor', lado: null, larg: null, cor: hex(fo.cor_na_camisa?.[k]) ?? '#ffffff', nome: fo.nome });
    }
  }
  clubes[nome] = c;
}

// a conversão no Chromium
fs.mkdirSync(SAIDA, { recursive: true });
const nav = await abrir({ largura: 600, altura: 400 });
const asp = {}, cheio = {};
for (const [orig, rel] of pedidos) {
  const tipo = orig.endsWith('.svg') ? 'image/svg+xml' : orig.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dados = 'data:' + tipo + ';base64,' + fs.readFileSync(orig).toString('base64');
  const r = await nav.pagina.evaluate(async src => {
    const img = new Image(); img.src = src;
    await img.decode();
    const L = 1024, w0 = img.naturalWidth || 1024, h0 = img.naturalHeight || 512;
    const s = L / Math.max(w0, h0), W = Math.max(1, Math.round(w0 * s)), H = Math.max(1, Math.round(h0 * s));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let transp = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transp++;
    const comAlfa = transp > 0.05 * W * H;
    // o fundo: a mediana da borda
    const borda = [];
    for (let x = 0; x < W; x++) { borda.push(x * 4, ((H - 1) * W + x) * 4); }
    for (let y = 0; y < H; y++) { borda.push(y * W * 4, (y * W + W - 1) * 4); }
    const med = k => { const v = borda.map(i => d[i + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const bg = [med(0), med(1), med(2)];
    const m = new Uint8ClampedArray(W * H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = comAlfa ? d[i + 3] : Math.min(255, Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) * 4.25) * (d[i + 3] / 255);
      m[y * W + x] = a;
      if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    // logo com uma FORMA cheia e o texto dentro (a elipse do supermercado, o balão do Zé Delivery): a máscara só da forma
    // virava uma mancha. Dentro da forma, as duas cores pelo limiar de Otsu do brilho; a da borda é a forma, a outra o
    // conteúdo; com a forma maciça (≥ 55% da caixa) e o conteúdo ocupando 3–70%, o conteúdo sai VAZADO (como na camisa:
    // a forma pintada, o texto na cor do tecido)
    {
      const hist = new Float64Array(256); let n = 0, area = 0;
      for (let i = 0; i < W * H; i++) if (m[i] > 128) { const L = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; hist[L]++; n++; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * W + x] > 128) area++;
      let soma = 0; for (let t = 0; t < 256; t++) soma += t * hist[t];
      let sB = 0, wB = 0, melhor = 0, lim = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
        sB += t * hist[t]; const mB = sB / wB, mF = (soma - sB) / wF, v = wB * wF * (mB - mF) ** 2;
        if (v > melhor) { melhor = v; lim = t; }
      }
      let escuros = 0; for (let t = 0; t <= lim; t++) escuros += hist[t];
      const fEsc = escuros / Math.max(1, n);
      // a cor da FORMA é a da borda dela (os pixels da forma encostados no fundo); a outra é o conteúdo (texto, desenho)
      let bordaL = 0, nb = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (m[i] > 128 && (m[i - 1] <= 128 || m[i + 1] <= 128 || m[i - W] <= 128 || m[i + W] <= 128)) { bordaL += d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114; nb++; }
      }
      const formaClara = nb ? bordaL / nb > lim : fEsc >= 0.5, menorEscuro = formaClara;
      const fMenor = formaClara ? fEsc : 1 - fEsc;
      const macica = area / ((x1 - x0 + 1) * (y1 - y0 + 1));
      if (n > 0 && macica >= 0.55 && fMenor >= 0.03 && fMenor <= 0.7 && melhor / (n * n) > 200) {
        for (let i = 0; i < W * H; i++) {
          if (m[i] <= 8) continue;
          const L = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
          const texto = menorEscuro ? L <= lim : L > lim;
          if (texto) m[i] = 0;
        }
      }
    }
    const pw = Math.round((x1 - x0 + 1) * 0.02) + 1, ph = Math.round((y1 - y0 + 1) * 0.02) + 1;
    x0 = Math.max(0, x0 - pw); y0 = Math.max(0, y0 - ph); x1 = Math.min(W - 1, x1 + pw); y1 = Math.min(H - 1, y1 + ph);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, aspecto = cw / ch;
    let cheios = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * W + x] > 128) cheios++;
    const cheio = cheios / (cw * ch);
    // a máscara recortada, encaixada e centrada em 512 × 256
    const t = document.createElement('canvas'); t.width = cw; t.height = ch;
    const tg = t.getContext('2d'); const td = tg.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const o = (y * cw + x) * 4; td.data[o] = td.data[o + 1] = td.data[o + 2] = 255; td.data[o + 3] = m[(y + y0) * W + x + x0];
    }
    tg.putImageData(td, 0, 0);
    const o = document.createElement('canvas'); o.width = 512; o.height = 256;
    const og = o.getContext('2d');
    const k = Math.min(512 / cw, 256 / ch), dw = cw * k, dh = ch * k;
    og.drawImage(t, (512 - dw) / 2, (256 - dh) / 2, dw, dh);
    const url = o.toDataURL('image/webp', 0.9);
    return { url, aspecto, comAlfa, cheio };
  }, dados).catch(e => ({ erro: String(e) }));
  if (!r || r.erro || !r.url) { console.warn(`${rel}: não converteu (${r?.erro ?? 'vazio'})`); continue; }
  fs.mkdirSync(path.join(SAIDA, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(SAIDA, rel), Buffer.from(r.url.split(',')[1], 'base64'));
  asp[rel] = Math.round(r.aspecto * 1000) / 1000;
  cheio[rel] = Math.round(r.cheio * 1000) / 1000;
}
await nav.navegador.close();

// o índice (só os decalques cujo logo converteu)
let n = 0;
for (const c of Object.values(clubes)) for (const k of KITS) {
  c[k] = c[k].filter(x => asp[x.logo]).map(x => ({ ...x, asp: asp[x.logo] }));
  n += c[k].length;
}
const indice = {
  descricao: 'Patrocínios e marca do fornecedor nas camisas reais — SÓ a versão de teste (edição pro do Total Match). Gerado por golaco/tools/patrocinios/gerar.mjs a partir da pesquisa de cada clube.',
  versao: 1, clubes,
  // a fração cheia da caixa de cada máscara (teste-patrocinios P5: logo virando mancha)
  cheio,
};
fs.writeFileSync(path.join(RAIZ, 'assets/tm/patrocinios.json'), JSON.stringify(indice) + '\n');
const bytes = [...new Set(Object.keys(asp))].reduce((s, r) => s + fs.statSync(path.join(SAIDA, r)).size, 0);
console.log(`${Object.keys(clubes).length} clubes, ${Object.keys(asp).length} logos (${(bytes / 1024).toFixed(0)} KB), ${n} decalques`);
process.exit(0);
