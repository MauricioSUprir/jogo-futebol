// O desenho do estádio REAL do Total Match (edição pro; contrato "Estádio de cada clube" no CONTRATOS.md). Só é baixado
// com ?tm na edição pro e o estádio achado na base (render/identidade-pagina.js importa e põe em `identidade.estilos`):
// sem ?tm (e na pública) nada daqui entra no download (tools/teste-carga.mjs, ≤ 4 MB). Aqui fica tudo o que só o estádio
// real usa: a fachada por estilo (render/estadio-fora.js chama texFachadaEstilo no lugar da de hoje), a face de dentro da
// fachada (fachadaPorDentro), a marquise que some sem cobertura (esconderMarquise) e a cor de cada cadeira pelo padrão
// (corCadeiraReal, chega a texturas.js texArquibancada como `cores.corCadeira`). Só desenho: nenhuma forma muda.
import * as THREE from 'three';
import { FORA } from '../estadio-forma.js';
import { ARQUIBANCADA as A } from './torcida-dados.js';
import { criarCanvas, texturaCanvas } from './util.js';

const TILE_FACHADA = 12;   // m de fachada por repetição da textura (o mesmo de render/estadio-fora.js)
export const ESTILOS = new Set(['vidro', 'concreto', 'metal', 'membrana', 'tijolo', 'trelica', 'paineis']);
const rgbDe = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hexDe = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Mistura duas cores '#rrggbb' (t = peso da 2ª), clareia e escurece. */
const mix = (a, b, t) => { const x = rgbDe(a), y = rgbDe(b); return hexDe(x.map((v, i) => v + (y[i] - v) * t)); };
const clarear = (h, t) => mix(h, '#ffffff', t), escurecer = (h, t) => mix(h, '#000000', t);
const rgba = (h, a) => { const [r, g, b] = rgbDe(h); return `rgba(${r},${g},${b},${a})`; };
/** Sorteio fixo por célula (i, j): o mesmo de dia e de noite (as duas texturas casam). */
const sorte = (i, j, s = 0) => { const x = Math.sin(i * 127.1 + j * 311.7 + s * 74.7 + 7.3) * 43758.5453; return x - Math.floor(x); };
const QUENTE = '#ffcf8a';   // luz de dentro (lâmpadas), vista pelas aberturas à noite

/**
 * Fachada por estilo (estádio real do Total Match): o mesmo ladrilho de 12 m × 27,6 m da fachada de hoje (base de
 * concreto com o portão e o letreiro, o pano entre 5,2 e 24 m, a faixa de cima e o arremate), o pano desenhado pelo
 * estilo nas cores fa.cor/fa.cor2 com as faixas dos anéis (fa.aneis). Tudo se repete a cada 12 m sem emenda (as
 * divisões são de 0,5/1,5/2/3/6 m). emissiva: o mapa de brilho da noite (LED na cor fa.ledCor; sem LED, as luzes de
 * dentro pelas aberturas).
 */
export function texFachadaEstilo(aniso, emissiva, fa) {
  const W = 512, H = 512, F = FORA.fachada, T = TILE_FACHADA;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const Y = y => H - (y / F.altura) * H, X = x => (x / T) * W;
  const ret = (x0, y0, x1, y1, cor) => { g.fillStyle = cor; g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); };
  const c1 = fa.cor, c2 = fa.cor2, led = fa.ledCor ?? null;
  const an = Math.max(1, Math.min(3, Math.round(fa.aneis) || 2));
  const Y0 = 5.2, Y1 = 24;
  const nivel = k => Y0 + (Y1 - Y0) * k / an;       // limite entre os anéis (k = 0..an)
  const noite = emissiva;
  // luz de dentro à noite: com LED, a cor dele; sem LED, a das lâmpadas (mais fraca)
  const luz = (a, s = 0) => (led ? rgba(led, Math.min(1, a)) : rgba(QUENTE, Math.min(1, a * 0.55 * (0.7 + 0.6 * s))));
  g.fillStyle = noite ? '#000' : mix('#30373b', c2, 0.3);
  g.fillRect(0, 0, W, H);
  const faixasAneis = (alt, cor) => { for (let k = 1; k < an; k++) ret(0, nivel(k) - alt / 2, T, nivel(k) + alt / 2, cor); };
  const e = fa.estilo;
  if (e === 'vidro') {
    // pano de vidro: o reflexo do céu em cima, mais escuro embaixo; montantes a cada 1,5 m e travessas
    if (!noite) {
      const gr = g.createLinearGradient(0, Y(Y1), 0, Y(Y0));
      gr.addColorStop(0, mix(c1, '#dbe9f2', 0.38)); gr.addColorStop(0.55, c1); gr.addColorStop(1, mix(c1, '#0b1217', 0.45));
      g.fillStyle = gr; g.fillRect(0, Y(Y1), W, Y(Y0) - Y(Y1));
      for (let i = 0; i < 8; i++) ret(i * 1.5, Y0, i * 1.5 + 1.5, Y1, `rgba(255,255,255,${(0.1 * sorte(i, 1)).toFixed(3)})`);
    } else for (let i = 0; i < 8; i++) for (let j = 0; j < an * 3; j++) {
      const y0 = Y0 + (Y1 - Y0) * j / (an * 3), y1 = Y0 + (Y1 - Y0) * (j + 1) / (an * 3), s = sorte(i, j, 2);
      ret(i * 1.5, y0, i * 1.5 + 1.5, y1, luz(led ? 0.45 + 0.35 * s : (s > 0.3 ? 0.8 : 0.25), s));
    }
    const mont = noite ? '#000' : c2;
    for (let j = 0; j <= an * 3; j++) { const y = Y0 + (Y1 - Y0) * j / (an * 3); ret(0, y - 0.04, T, y + 0.04, noite ? '#000' : rgba(c2, 0.85)); }
    for (let i = 0; i <= 8; i++) ret(i * 1.5 - 0.07, Y0, i * 1.5 + 0.07, Y1, mont);
    faixasAneis(0.55, noite ? (led ? led : '#000') : clarear(c2, 0.2));
  } else if (e === 'concreto') {
    // concreto aparente: o paredão com as marcas da fôrma, uma galeria aberta por anel (o escuro de dentro, com a sombra
    // da laje de cima), os pilares a cada 3 m passando na frente e as vigas dos anéis
    if (!noite) {
      ret(0, Y0, T, Y1, c1);
      for (let x = 0; x < T; x += 0.6) ret(x, Y0, x + 0.035, Y1, 'rgba(0,0,0,0.07)');
      for (let y = Y0; y < Y1; y += 1.2) ret(0, y, T, y + 0.04, 'rgba(0,0,0,0.05)');
    } else ret(0, Y0, T, Y1, '#000');
    for (let k = 0; k < an; k++) {
      const yb = nivel(k), h = nivel(k + 1) - yb, a0 = yb + 0.2 * h, a1 = yb + 0.64 * h;
      if (!noite) {
        ret(0, a0, T, a1, mix('#15191c', c2, 0.22));
        const gr = g.createLinearGradient(0, Y(a1), 0, Y(a1 - 0.35 * (a1 - a0)));
        gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, Y(a1), W, Y(a1 - 0.35 * (a1 - a0)) - Y(a1));
        ret(0, a0 - 0.12, T, a0, clarear(c1, 0.2));
      } else for (let i = 0; i < 4; i++) for (const d of i === 3 ? [0, -T] : [0]) ret(i * 3 + 1.9 + d, a0, i * 3 + 4.1 + d, a1, luz(0.6, sorte(i, k, 3)));
    }
    for (let i = 0; i < 4; i++) {
      const x = i * 3 + 1.1;
      ret(x, Y0, x + 0.8, Y1, noite ? '#000' : clarear(c1, 0.06));
      if (!noite) { ret(x, Y0, x + 0.12, Y1, clarear(c1, 0.22)); ret(x + 0.66, Y0, x + 0.8, Y1, escurecer(c1, 0.25)); }
    }
    for (let k = 0; k <= an; k++) ret(0, nivel(k) - 0.3, T, nivel(k) + 0.3, noite ? '#000' : clarear(c1, 0.12));
    if (noite && led) for (let k = 1; k < an; k++) ret(0, nivel(k) + 0.18, T, nivel(k) + 0.3, led);
  } else if (e === 'metal') {
    // lâminas verticais (brises) a cada 0,5 m na frente de um fundo escuro; as faixas dos anéis em chapa lisa
    ret(0, Y0, T, Y1, noite ? '#000' : escurecer(c2, 0.4));
    if (noite) for (let i = 0; i < 24; i++) { const gr = g.createLinearGradient(0, Y(Y1), 0, Y(Y0)); gr.addColorStop(0, luz(0.35, 0.5)); gr.addColorStop(1, luz(0.85, 0.5)); g.fillStyle = gr; g.fillRect(X(i * 0.5), Y(Y1), X(0.5), Y(Y0) - Y(Y1)); }
    for (let i = 0; i < 24; i++) {
      const x = i * 0.5 + 0.07, s = sorte(i, 0, 4);
      if (noite) { ret(x, Y0, x + 0.36, Y1, '#000'); continue; }
      const gr = g.createLinearGradient(X(x), 0, X(x + 0.36), 0);
      gr.addColorStop(0, clarear(c1, 0.16 + 0.08 * s)); gr.addColorStop(1, escurecer(c1, 0.12 + 0.08 * s));
      g.fillStyle = gr; g.fillRect(X(x), Y(Y1), X(0.36), Y(Y0) - Y(Y1));
    }
    for (let k = 0; k <= an; k++) ret(0, nivel(k) - (k % an ? 0.35 : 0.25), T, nivel(k) + (k % an ? 0.35 : 0.25), noite ? '#000' : c2);
  } else if (e === 'membrana') {
    // almofadas em losango (ETFE): 2 m × 2,35 m, em fileiras desencontradas; à noite acendem (com LED, na cor dele)
    ret(0, Y0, T, Y1, noite ? '#000' : c2);
    const w = 2, h = 2.35, nl = Math.round((Y1 - Y0) / (h / 2));
    g.save(); g.beginPath(); g.rect(0, Y(Y1), W, Y(Y0) - Y(Y1)); g.clip();
    for (let j = 0; j <= nl; j++) for (let i = -1; i <= 6; i++) {
      const cx = i * w + (j % 2 ? 0 : w / 2), cy = Y0 + j * h / 2, s = sorte(((i % 6) + 6) % 6, j, 5);
      const hw = w / 2 - 0.07, hh = h / 2 - 0.08;
      g.beginPath(); g.moveTo(X(cx), Y(cy + hh)); g.lineTo(X(cx + hw), Y(cy)); g.lineTo(X(cx), Y(cy - hh)); g.lineTo(X(cx - hw), Y(cy)); g.closePath();
      const gr = g.createRadialGradient(X(cx), Y(cy), 1, X(cx), Y(cy), X(hw));
      if (noite) { gr.addColorStop(0, luz(led ? 0.95 : 0.7, s)); gr.addColorStop(1, luz(led ? 0.45 : 0.15, s)); }
      else { gr.addColorStop(0, clarear(c1, 0.3 + 0.08 * s)); gr.addColorStop(1, escurecer(c1, 0.06)); }
      g.fillStyle = gr; g.fill();
    }
    g.restore();
    faixasAneis(0.18, noite ? '#000' : c2);
  } else if (e === 'tijolo') {
    // alvenaria: tijolos de 0,5 × 0,235 m em amarração, janelas por anel (a cada 3 m) com moldura e as faixas de pedra
    if (!noite) {
      ret(0, Y0, T, Y1, mix(c1, '#d9d4c8', 0.5));
      const hb = 0.235, nl = Math.ceil((Y1 - Y0) / hb);
      for (let j = 0; j < nl; j++) for (let i = 0; i <= 24; i++) {
        const x0 = i * 0.5 - (j % 2 ? 0.25 : 0), y0 = Y0 + j * hb, s = sorte(((i % 24) + 24) % 24, j, 6);
        ret(x0 + 0.02, y0 + 0.025, x0 + 0.48, Math.min(Y1, y0 + hb - 0.02), s < 0.5 ? mix(c1, '#000000', 0.12 * s) : mix(c1, '#ffffff', 0.1 * (s - 0.5)));
      }
    } else ret(0, Y0, T, Y1, '#000');
    for (let k = 0; k < an; k++) {
      const y0 = nivel(k), y1 = nivel(k + 1), hj = Math.min(2.8, (y1 - y0) * 0.5), ym = (y0 + y1) / 2;
      for (let i = 0; i < 4; i++) {
        const xm = i * 3 + 1.5, s = sorte(i, k, 7);
        if (noite) { ret(xm - 0.6, ym - hj / 2, xm + 0.6, ym + hj / 2, s > 0.3 ? (led ? rgba(mix(led, QUENTE, 0.4), 0.85) : rgba(QUENTE, 0.45 + 0.35 * s)) : rgba(QUENTE, 0.08)); continue; }
        ret(xm - 0.78, ym - hj / 2 - 0.18, xm + 0.78, ym + hj / 2 + 0.12, c2);
        ret(xm - 0.6, ym - hj / 2, xm + 0.6, ym + hj / 2, '#1b2328');
        ret(xm - 0.03, ym - hj / 2, xm + 0.03, ym + hj / 2, c2);
        ret(xm - 0.6, ym + hj / 6 - 0.03, xm + 0.6, ym + hj / 6 + 0.03, c2);
      }
    }
    for (let k = 0; k <= an; k++) ret(0, nivel(k) - 0.25, T, nivel(k) + 0.25, noite ? (led && k > 0 && k < an ? led : '#000') : c2);
  } else if (e === 'trelica') {
    // aço à mostra: montantes a cada 6 m, banzos nos anéis e as diagonais em X na frente do fechamento
    if (!noite) {
      const gr = g.createLinearGradient(0, Y(Y1), 0, Y(Y0));
      gr.addColorStop(0, clarear(c1, 0.12)); gr.addColorStop(1, mix(c1, '#26323a', 0.3));
      g.fillStyle = gr; g.fillRect(0, Y(Y1), W, Y(Y0) - Y(Y1));
      for (let i = 0; i < 8; i++) ret(i * 1.5, Y0, i * 1.5 + 0.03, Y1, rgba('#000000', 0.18));
    } else for (let k = 0; k < an; k++) for (let b = 0; b < 2; b++) ret(b * 6, nivel(k), b * 6 + 6, nivel(k + 1), luz(led ? 0.55 : 0.6, sorte(b, k, 8)));
    const aco = noite ? '#000' : c2, sombra = noite ? '#000' : escurecer(c2, 0.4);
    g.lineCap = 'butt';
    for (let k = 0; k < an; k++) for (let b = 0; b < 2; b++) {
      const x0 = b * 6, x1 = x0 + 6, y0 = nivel(k) + 0.2, y1 = nivel(k + 1) - 0.2;
      for (const [cor, dx, lw] of [[sombra, 0.12, 0.3], [aco, 0, 0.24]]) {
        g.strokeStyle = cor; g.lineWidth = X(lw);
        g.beginPath(); g.moveTo(X(x0 + dx), Y(y0)); g.lineTo(X(x1 + dx), Y(y1)); g.moveTo(X(x0 + dx), Y(y1)); g.lineTo(X(x1 + dx), Y(y0)); g.stroke();
      }
    }
    for (const x of [0, 6, 12]) ret(x - 0.22, Y0, x + 0.22, Y1, aco);
    for (let k = 0; k <= an; k++) ret(0, nivel(k) - 0.22, T, nivel(k) + 0.22, aco);
  } else {
    // painéis em mosaico de 2 cores: 1,5 m de largura, 4 fileiras por anel, com as juntas e as faixas dos anéis
    const pal = [c1, c1, c1, c2, c2, mix(c1, c2, 0.5), clarear(c1, 0.14), escurecer(c2, 0.12)];
    for (let k = 0; k < an; k++) for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) {
      const y0 = nivel(k) + (nivel(k + 1) - nivel(k)) * j / 4, y1 = nivel(k) + (nivel(k + 1) - nivel(k)) * (j + 1) / 4, s = sorte(i, k * 4 + j, 9);
      ret(i * 1.5, y0, i * 1.5 + 1.5, y1, noite ? (led ? rgba(led, 0.15 + 0.8 * s) : (s > 0.86 ? rgba(QUENTE, 0.3) : '#000')) : pal[Math.floor(s * pal.length) % pal.length]);
      ret(i * 1.5, y0, i * 1.5 + 0.05, y1, rgba('#000000', noite ? 1 : 0.32));
      ret(i * 1.5, y0, i * 1.5 + 1.5, y0 + 0.05, rgba('#000000', noite ? 1 : 0.32));
    }
    faixasAneis(0.4, noite ? '#000' : escurecer(c2, 0.3));
  }
  // faixa de cima (LED ou cornija), arremate, laje sobre a base, juntas da base, portão e letreiro
  if (!noite) {
    ret(0, Y1, T, 25.7, led ? fa.led : escurecer(c2, 0.12));
    ret(0, 25.7, T, F.altura, mix(c2, '#e8ecee', 0.55));
    ret(0, 4.6, T, Y0, mix(c1, '#e4e8ea', 0.55));
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < T; x += 2) g.fillRect(X(x), Y(4.6), 1, H - Y(4.6));
    ret(4.4, 0, 7.6, 3.6, '#0b0e10');
  } else {
    ret(0, Y1, T, 25.7, led ?? '#000');
    ret(0, 0, T, Y0, '#000');
    ret(4.4, 0, 7.6, 3.6, '#ffd9a0');
  }
  ret(4.6, 3.85, 7.4, 4.2, fa.letreiro);
  const t = texturaCanvas(c, { aniso, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Cor de uma cadeira pelo padrão (identidade.js arquibancadaReal: cores.padrao): 'liso' e 'mosaico' (uma cor com a
 * variação sutil tom/tom2), 'misto' (salpicado com as duas cores e um pouco de branco), 'faixas' (anéis alternados pelas
 * fileiras; com 1 anel, setores alternados entre os corredores). f = fileira (0 = a de cima), a = cadeira, r = sorteio.
 */
export function corCadeiraReal(cores, f, a, nF, r) {
  const c1 = cores.cadeira, c2 = cores.cadeira2 ?? cores.tom2;
  if (cores.padrao === 'misto') return r < 0.5 ? c1 : r < 0.84 ? c2 : r < 0.93 ? '#e6e9e9' : cores.tom;
  if (cores.padrao === 'faixas') {
    const an = Math.max(1, Math.min(3, Math.round(cores.aneis) || 1));
    // anel de baixo = a 1ª cor (os anéis contados de baixo para cima); 1 anel: os setores entre corredores
    const banda = an >= 2 ? an - 1 - Math.min(an - 1, Math.floor(f * an / nF)) : Math.floor(a / 26);
    return r < 0.05 ? cores.tom : banda % 2 ? c2 : c1;
  }
  return r < 0.05 ? cores.tom : r < 0.09 ? cores.tom2 : c1;
}

// o muro de dentro: um concreto escuro (sRGB #4a5256, em linear; um pouco mais claro que a parede das cadeiras, #2b3235)
const MURO = 'vec3(0.068, 0.084, 0.093)';
/**
 * A face de DENTRO da fachada (a malha é DoubleSide; onde a cobertura foi tirada ela aparece atrás das arquibancadas): um
 * muro liso e apagado, sem o desenho de fora nem o LED aceso. Lado de dentro = a normal de fora (vNormal, a do atributo)
 * de costas para a câmera. Mesma malha, mesma chamada de desenho (só o programa do material muda).
 */
export function fachadaPorDentro(mat) {
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\nbool fachadaDentro = dot(vNormal, vViewPosition) < 0.0;\nif (fachadaDentro) diffuseColor.rgb = diffuse * ${MURO};`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (fachadaDentro) totalEmissiveRadiance = vec3(0.0);');
  };
  mat.customProgramCacheKey = () => 'fachada-por-dentro';
  return mat;
}

// a marquise da arquibancada de lá (y 25 → 26,5) e o teto curto da de cá (y 25 → 25,6) de render/campo.js: os únicos
// triângulos dessas malhas acima do alto da parede de trás (A.yTopoLado + 5 = 25 m)
const Y_MARQUISE = A.yTopoLado + 5 + 0.2;
let tocadas = [];   // [{at, copia}] da última vez (marquiseEscondida, testes)
/**
 * Sem cobertura ('nenhuma'): no pré-jogo, a marquise de lá e o teto curto de cá somem — os triângulos acima de
 * Y_MARQUISE viram pontos (a mesma malha, a mesma chamada de desenho). Devolve a função que os põe de volta (o jogo fica
 * com o estádio dele) ou null. Só desenho: os sólidos dos trilhos (estadio-forma.js 'marquise de lá') não mudam.
 */
export function esconderMarquise(cena, cobertura) {
  if (cobertura !== 'nenhuma' || !cena) return null;
  const guardadas = [];
  for (const nome of ['arquibancada-lado', 'arquibancada-ca']) {
    const g = cena.getObjectByName(nome)?.geometry, at = g?.attributes?.position;
    if (!at || g.index) continue;
    const p = at.array, copia = p.slice();
    let n = 0;
    for (let t = 0; t + 8 < p.length; t += 9) {
      if (Math.max(p[t + 1], p[t + 4], p[t + 7]) <= Y_MARQUISE) continue;
      for (let k = 3; k < 9; k++) p[t + k] = p[t + (k % 3)];
      n++;
    }
    if (n) { at.needsUpdate = true; guardadas.push({ at, copia }); }
  }
  tocadas = guardadas;
  return guardadas.length ? () => { for (const { at, copia } of guardadas) { at.array.set(copia); at.needsUpdate = true; } } : null;
}
/** Testes: quantos triângulos da marquise estão escondidos agora (0 = as malhas do jogo inteiras de volta). */
export function marquiseEscondida() {
  let n = 0;
  for (const { at, copia } of tocadas) for (let t = 0; t + 8 < copia.length; t += 9) for (let k = 0; k < 9; k++) if (at.array[t + k] !== copia[t + k]) { n++; break; }
  return n;
}
