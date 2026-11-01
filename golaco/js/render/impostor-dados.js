// O IMPOSTOR OCTAÉDRICO da torcida (dados: conta PURA, sem three.js nem DOM; item 69 da FILA, PR 3 de 4 — pedido do dono de
// 29/10: "cadeiras parecidas com as reais e torcida 3D, em todos os estádios"). Só desenho: nada daqui toca a simulação
// (fora do fecho do hash). SOB DEMANDA, junto do render/impostor.js (que chega com o render/cadeiras3d.js: o 1º quadro e a
// TV não precisam dele).
//
// O torcedor longe era um QUADRO tirado de um atlas SDF desenhado por código (render/torcida-dados.js atlasTorcida: 3 cores
// chapadas, a luz do setor inteiro, virado para a lente). O impostor é o torcedor 3D do PR 2 (render/torcedor-dados.js: o
// Rocketbox homem e mulher, as 8 poses da textura de animação) FOTOGRAFADO de muitas direções NA CARGA — um quadro por
// direção, num mapa hemi-octaédrico — e desenhado no mesmo quadro de 2 triângulos: o vertex shader acha as 3 fotos mais
// perto da direção da câmera e o fragment shader mistura as 3 pelos pesos do triângulo da grade (Brucks, "Octahedral
// Impostors", 2018: a técnica das árvores do Fortnite). Cada foto guarda as REGIÕES do corpo (camisa, pele, cabelo, calça;
// o resto é o tênis ou o cachecol — Dobbyn et al., "Geopostors", 2005: a região no canal para cada um ter as suas cores), a
// NORMAL no espaço da foto (a luz do sol e dos refletores por pixel, a mesma conta do torcedor 3D) e a ALTURA (a sombra da
// fileira da frente nas pernas). A pose continua a do quadro (render/torcedor-pose.js ESTADO_GLSL: a regra, a ola e o
// bandeirão).
//
// O mapa é o HEMI-octaedro com o polo INCLINADO para a frente (IMPOSTOR.inclinacao): a torcida é vista de frente (de baixo
// até de cima), dos lados e, por trás, só do alto (o aéreo do pré-jogo) — nunca de baixo e de trás (seria de dentro da
// arquibancada). Com o polo em +y (o hemisfério de cima das árvores do Brucks) a câmera do gol e as de perto, que olham a
// torcida de baixo, cairiam fora do mapa.
//
// O ASSAMENTO é na CPU (um rasterizador de triângulos com 2×2 amostras por pixel e teste de profundidade), em fatias de
// alguns ms (criarAssador: o 1º quadro não espera) — o mesmo resultado bit a bit no Node (tools/teste-torcida.mjs H) e no
// navegador; nenhum estado do WebGL. Fontes em PESQUISA-ESTADIO.md §16.
import { TORCEDOR3D, REGIAO } from './torcedor-dados.js';
import { CADEIRA } from './cadeiras-dados.js';

export const IMPOSTOR = Object.freeze({
  inclinacao: 45,        // graus: o polo do hemi-octaedro inclinado da vertical para a frente (vê de frente até 45° de baixo; por trás, de 45° para cima)
  alturaMax: 2.5,        // m: o canal da altura (0–1 = 0–2,5 m do piso)
  margem: 1.5,           // texels livres em volta da figura em cada foto (o filtro e o mip 1 não pegam a vizinha)
  ss: 2,                 // amostras por pixel em cada eixo no assamento (2×2: a borda suave)
  porLinha: 4,           // objetos (variação × pose) por linha do atlas: 2 × 8 = 16 objetos em 4 × 4
  alfa: 0.5,             // cobertura mínima de um pixel (o recorte, como o do quadro SDF)
  pesoMin: 0.04,         // no shader, as fotos com peso abaixo disto saem (renormaliza): perto de uma foto, 1–2 leituras
  escala: Object.freeze([0.9, 1.25]),   // a escala do torcedor (aPos.w) no impostor (o maior do quadro vale 1,3–2 lugares)
  favorAnterior: 1.2,    // no teto, o bloco que já estava em impostor vale 20% mais (não pisca na borda do teto)
  fatiaMs: 6,            // ms de assamento por fatia (no tempo ocioso: o 1º quadro não espera)
  // por qualidade: a grade (N × N fotos por objeto), o tamanho de cada foto (px; pares — o mip 1 fica dentro dela), os px da
  // CADEIRA na tela para o bloco ENTRAR/SAIR do impostor (histerese), o teto de torcedores em impostor (o custo por pixel:
  // 6 leituras de textura contra 1 do quadro) e se vale na TV de jogo. Baixa: nada (o quadro SDF de hoje). Média (o
  // celular): 6 × 6 fotos de 20 × 32 px (~3,7 MB na GPU), só fora da TV de jogo (na TV do celular nada fica mais caro que
  // hoje: o mesmo programa do quadro). Alta (o PC): 8 × 8 de 28 × 44 px (~12,6 MB), também na TV.
  qual: Object.freeze({
    baixa: null,
    media: Object.freeze({ N: 6, celula: Object.freeze([20, 32]), pxEntra: 6, pxSai: 5, teto: 6000, naTV: false }),
    alta: Object.freeze({ N: 8, celula: Object.freeze([28, 44]), pxEntra: 4, pxSai: 3.3, teto: 60000, naTV: true }),
  }),
  // a DENSIDADE REAL perto da câmera (os blocos com as cadeiras 3D: render/cadeiras3d.js): 1 torcedor por cadeira ocupada —
  // a ocupação é o público do pedido do TM vezes `cheio` (alguns vazios soltos, como num jogo de verdade); só preenche a
  // cadeira que tem um torcedor desenhado a até `raioMax` cadeiras na fileira dela ou nas vizinhas (os vazios de propósito
  // das plantas — a divisa da torcida visitante, as fileiras debaixo da cobertura, os vomitórios — continuam vazios); a
  // escala do torcedor de verdade (a do 3D)
  perto: Object.freeze({ cheio: 0.96, raioMax: 4, escala: Object.freeze([0.94, 1.06]) }),
});
export const OBJETOS = 16;   // 2 variações (homem, mulher) × 8 poses

const RAD = Math.PI / 180;
// o polo P a (90° − inclinação) acima do horizonte, para a frente: P = (0, SI, CI)
const CI = Math.cos((90 - IMPOSTOR.inclinacao) * RAD), SI = Math.sin((90 - IMPOSTOR.inclinacao) * RAD);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ------------------------------------------------------------------ o mapa hemi-octaédrico (o polo inclinado)
// Espaço do TORCEDOR (o do torcedor-dados.js): x para a esquerda da pessoa, y para cima, z para a frente (o campo). O polo
// P = (0, cos i, sen i) (i = a inclinação da vertical); a base inclinada X' = x, Y' = P, Z' = X' × Y'. De frente, o mapa vai
// de i − 90° (de baixo) até em cima; por trás, de 90° − i para cima; de lado, do horizonte para cima.
/** Do espaço do torcedor para o inclinado (o polo em +y'). */
export function paraInclinado(d) { return [d[0], d[1] * SI + d[2] * CI, -d[1] * CI + d[2] * SI]; }
/** Do inclinado para o espaço do torcedor. */
export function deInclinado(e) { return [e[0], e[1] * SI - e[2] * CI, e[1] * CI + e[2] * SI]; }
/**
 * Direção (do centro do torcedor para a câmera, no espaço dele) → [u, w] em [−1, 1]² (o hemi-octaedro: o losango
 * |x'| + |z'| ≤ 1 girado 45°). Abaixo do horizonte inclinado, a direção vai para a borda do mapa.
 */
export function codificar(d) {
  const e = paraInclinado(d);
  e[1] = Math.max(e[1], 0);
  const s = Math.max(1e-9, Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]));
  const x = e[0] / s, z = e[2] / s;
  return [x + z, x - z];
}
/** [u, w] em [−1, 1]² → a direção unitária no espaço do torcedor. */
export function decodificar(uv) {
  const x = (uv[0] + uv[1]) / 2, z = (uv[0] - uv[1]) / 2;
  return norm(deInclinado([x, 1 - Math.abs(x) - Math.abs(z), z]));
}
/** A direção da foto (fx, fy) da grade N × N (os vértices da grade: as bordas são o horizonte inclinado). */
export function direcaoDoQuadro(fx, fy, N) { return decodificar([(fx / (N - 1)) * 2 - 1, (fy / (N - 1)) * 2 - 1]); }
/**
 * A base da foto vista da direção d: bx = (y × d) normalizado (a direita da imagem), by = d × bx (o alto da imagem); com d
 * quase vertical (a câmera bem em cima), a direita é o x do torcedor.
 */
export function base(d) {
  let bx = Math.abs(d[1]) > 0.9999 ? [1, 0, 0] : norm([d[2], 0, -d[0]]);
  const by = [d[1] * bx[2] - d[2] * bx[1], d[2] * bx[0] - d[0] * bx[2], d[0] * bx[1] - d[1] * bx[0]];
  return { bx, by };
}
/**
 * As 3 fotos mais perto de [u, w] e os pesos (Brucks: o quadrado da grade em que cai e o triângulo dele — a diagonal
 * troca o vizinho da direita pelo de baixo; na foto exata o peso dela é 1). Devolve {f: [[fx, fy] × 3], w: [w0, w1, w2]}.
 */
export function quadros(uv, N) {
  const n1 = N - 1;
  const gx = clamp((uv[0] * 0.5 + 0.5) * n1, 0, n1), gy = clamp((uv[1] * 0.5 + 0.5) * n1, 0, n1);
  const fx = Math.min(Math.floor(gx), n1 - 1), fy = Math.min(Math.floor(gy), n1 - 1);
  const tx = gx - fx, ty = gy - fy;
  if (tx >= ty) return { f: [[fx, fy], [fx + 1, fy], [fx + 1, fy + 1]], w: [1 - tx, tx - ty, ty] };
  return { f: [[fx, fy], [fx, fy + 1], [fx + 1, fy + 1]], w: [1 - ty, ty - tx, tx] };
}
/**
 * O ponto lp do quadro (relativo ao centro, no espaço do torcedor) visto pela direção v, na foto d (a base bx/by): o raio
 * paralelo a v por lp bate no plano da foto (pelo centro, normal d) — a "projeção virtual" do Brucks para as 3 fotos.
 * Devolve [s, t] (m, no plano da foto).
 */
export function reprojetar(lp, v, d, bx, by) {
  const k = dot(lp, d) / Math.max(0.2, dot(v, d));
  const q = [lp[0] - v[0] * k, lp[1] - v[1] * k, lp[2] - v[2] * k];
  return [dot(q, bx), dot(q, by)];
}

// ------------------------------------------------------------------ o atlas (a especificação e o assamento)
/** A especificação do atlas da qualidade (null na Baixa): {N, cw, ch, ss, porLinha, largura, altura, tileW, tileH}. */
export function especificacao(qualidade) {
  const Q = IMPOSTOR.qual[qualidade];
  if (!Q) return null;
  const [cw, ch] = Q.celula, N = Q.N, porLinha = IMPOSTOR.porLinha;
  const tileW = N * cw, tileH = N * ch;
  return { qualidade, N, cw, ch, ss: IMPOSTOR.ss, porLinha, tileW, tileH, largura: porLinha * tileW, altura: Math.ceil(OBJETOS / porLinha) * tileH };
}
/** O objeto (variação v, pose p) → o índice no atlas. */
export const objetoDe = (v, p) => v * TORCEDOR3D.poses + p;
/** A origem (px) da foto (fx, fy) do objeto o no atlas. */
export function origemDaFoto(spec, o, fx, fy) {
  const tx = o % spec.porLinha, ty = Math.floor(o / spec.porLinha);
  return [tx * spec.tileW + fx * spec.cw, ty * spec.tileH + fy * spec.ch];
}

/**
 * O assador do atlas: modelo = lerModelo(torcedor.bin) (o nível 0 de cada variação), spec = especificacao(q). passo(ms)
 * assa até gastar `ms` (uma unidade = o retângulo de um objeto ou uma foto) e devolve true quando acabou; `resultado` =
 * {spec, a, b (Uint8Array RGBA: a = camisa, pele, cabelo, cobertura; b = calça, nx, ny, altura — tudo multiplicado pela
 * cobertura; o resto, cobertura − as 4 regiões, é o tênis ou o cachecol), mip: {a, b, largura, altura} (o nível 1, a
 * média 2 × 2 dentro de cada foto), ret: Float32Array(16 × 4) (o retângulo de cada objeto no plano da foto, relativo ao
 * centro: x0, y0, largura, altura em m), cen: Float32Array(16 × 4) (o centro de cada objeto no espaço do torcedor), ms}.
 * agora: o relógio (ms).
 */
export function criarAssador(modelo, spec, agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  const N = spec.N, cw = spec.cw, ch = spec.ch, SS = spec.ss, NF = N * N;
  const W = spec.largura, H = spec.altura;
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const ret = new Float32Array(OBJETOS * 4), cen = new Float32Array(OBJETOS * 4);
  const nPoses = TORCEDOR3D.poses;
  // as fotos (direção e base), as mesmas para todos os objetos
  const fotos = [];
  for (let fy = 0; fy < N; fy++) for (let fx = 0; fx < N; fx++) { const d = direcaoDoQuadro(fx, fy, N), B = base(d); fotos.push({ fx, fy, d, bx: B.bx, by: B.by }); }
  const Ws = cw * SS, Hs = ch * SS;
  const zb = new Float32Array(Ws * Hs), rg = new Int8Array(Ws * Hs), nxs = new Float32Array(Ws * Hs), nys = new Float32Array(Ws * Hs), als = new Float32Array(Ws * Hs);
  let o = 0, etapa = 0, feito = false, gasto = 0;
  let pts = null, nor = null, reg = null, idx = null, nV = 0, C = [0, 0, 0];
  const sx = [], sy = [], sz = [];
  function carregarObjeto() {
    const v = Math.floor(o / nPoses), p = o % nPoses, m = modelo.malhas[Math.min(v, modelo.nVar - 1)][0];
    nV = m.nV; idx = m.indice; reg = m.regiao;
    pts = m.pos.subarray(3 * p * nV, 3 * (p + 1) * nV); nor = m.nor.subarray(3 * p * nV, 3 * (p + 1) * nV);
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) { const x = pts[3 * i + k]; if (x < mn[k]) mn[k] = x; if (x > mx[k]) mx[k] = x; }
    C = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    // o retângulo: a união da figura em todas as fotos (a imagem de qualquer direção cabe nele) e a margem em texels
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const F of fotos) for (let i = 0; i < nV; i++) {
      const r = [pts[3 * i] - C[0], pts[3 * i + 1] - C[1], pts[3 * i + 2] - C[2]];
      const s = dot(r, F.bx), t = dot(r, F.by);
      if (s < s0) s0 = s; if (s > s1) s1 = s; if (t < t0) t0 = t; if (t > t1) t1 = t;
    }
    const mg = IMPOSTOR.margem, esc = Math.max((s1 - s0) / (cw - 2 * mg), (t1 - t0) / (ch - 2 * mg));
    const w = cw * esc, h = ch * esc;
    ret.set([(s0 + s1) / 2 - w / 2, (t0 + t1) / 2 - h / 2, w, h], 4 * o);
    cen.set([C[0], C[1], C[2], 0], 4 * o);
  }
  /** Uma foto do objeto o: rasteriza (2×2 amostras, profundidade) e reduz para a célula do atlas. */
  function foto(F) {
    const R = ret.subarray(4 * o, 4 * o + 4);
    zb.fill(-Infinity); rg.fill(-1);
    for (let i = 0; i < nV; i++) {
      const r = [pts[3 * i] - C[0], pts[3 * i + 1] - C[1], pts[3 * i + 2] - C[2]];
      sx[i] = ((dot(r, F.bx) - R[0]) / R[2]) * Ws; sy[i] = ((dot(r, F.by) - R[1]) / R[3]) * Hs; sz[i] = dot(r, F.d);
    }
    const nT = idx.length / 3;
    for (let t = 0; t < nT; t++) {
      const i0 = idx[3 * t], i1 = idx[3 * t + 1], i2 = idx[3 * t + 2];
      const x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const ix0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), ix1 = Math.min(Ws - 1, Math.ceil(Math.max(x0, x1, x2)));
      const iy0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), iy1 = Math.min(Hs - 1, Math.ceil(Math.max(y0, y1, y2)));
      const inv = 1 / area;
      for (let py = iy0; py <= iy1; py++) {
        const cy = py + 0.5;
        for (let px = ix0; px <= ix1; px++) {
          const cx = px + 0.5;
          const l0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) * inv;
          const l1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) * inv;
          const l2 = 1 - l0 - l1;
          if (l0 < -1e-7 || l1 < -1e-7 || l2 < -1e-7) continue;
          const z = l0 * sz[i0] + l1 * sz[i1] + l2 * sz[i2], k = py * Ws + px;
          if (z <= zb[k]) continue;
          zb[k] = z;
          rg[k] = reg[l0 >= l1 && l0 >= l2 ? i0 : l1 >= l2 ? i1 : i2];
          // a normal interpolada no espaço da foto (dos dois lados: a superfície vista vira para a câmera)
          const nx = l0 * nor[3 * i0] + l1 * nor[3 * i1] + l2 * nor[3 * i2];
          const ny = l0 * nor[3 * i0 + 1] + l1 * nor[3 * i1 + 1] + l2 * nor[3 * i2 + 1];
          const nz = l0 * nor[3 * i0 + 2] + l1 * nor[3 * i1 + 2] + l2 * nor[3 * i2 + 2];
          let fx = nx * F.bx[0] + ny * F.bx[1] + nz * F.bx[2], fy = nx * F.by[0] + ny * F.by[1] + nz * F.by[2], fz = nx * F.d[0] + ny * F.d[1] + nz * F.d[2];
          if (fz < 0) { fx = -fx; fy = -fy; fz = -fz; }
          const ln = Math.hypot(fx, fy, fz) || 1;
          nxs[k] = fx / ln; nys[k] = fy / ln;
          als[k] = clamp((l0 * pts[3 * i0 + 1] + l1 * pts[3 * i1 + 1] + l2 * pts[3 * i2 + 1]) / IMPOSTOR.alturaMax, 0, 1);
        }
      }
    }
    // a célula do atlas: a média das SS × SS amostras (já multiplicada pela cobertura)
    const [ox, oy] = origemDaFoto(spec, o, F.fx, F.fy), q = 255 / (SS * SS);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let cob = 0, ca = 0, pe = 0, cb = 0, cl = 0, nx = 0, ny = 0, al = 0;
      for (let jy = 0; jy < SS; jy++) for (let jx = 0; jx < SS; jx++) {
        const k = (y * SS + jy) * Ws + x * SS + jx, r = rg[k];
        if (r < 0) continue;
        cob++;
        if (r === REGIAO.camisa) ca++; else if (r === REGIAO.pele) pe++; else if (r === REGIAO.cabelo) cb++; else if (r === REGIAO.calca) cl++;
        nx += nxs[k] * 0.5 + 0.5; ny += nys[k] * 0.5 + 0.5; al += als[k];
      }
      const kk = 4 * ((oy + y) * W + ox + x);
      a[kk] = Math.round(ca * q); a[kk + 1] = Math.round(pe * q); a[kk + 2] = Math.round(cb * q); a[kk + 3] = Math.round(cob * q);
      b[kk] = Math.round(cl * q); b[kk + 1] = Math.round(nx * q); b[kk + 2] = Math.round(ny * q); b[kk + 3] = Math.round(al * q);
    }
  }
  /** O nível 1: a média 2 × 2 (as fotos têm lado par: a média não mistura duas fotos). */
  function mip(src) {
    const w2 = W / 2, h2 = H / 2, out = new Uint8Array(w2 * h2 * 4);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) for (let c = 0; c < 4; c++) {
      const s = src[4 * (2 * y * W + 2 * x) + c] + src[4 * (2 * y * W + 2 * x + 1) + c] + src[4 * ((2 * y + 1) * W + 2 * x) + c] + src[4 * ((2 * y + 1) * W + 2 * x + 1) + c];
      out[4 * (y * w2 + x) + c] = (s + 2) >> 2;
    }
    return out;
  }
  let resultado = null;
  function unidade() {
    if (etapa === 0) carregarObjeto();
    else foto(fotos[etapa - 1]);
    etapa++;
    if (etapa > NF) { etapa = 0; o++; }
    if (o >= OBJETOS) {
      feito = true;
      resultado = { spec, a, b, mip: { a: mip(a), b: mip(b), largura: W / 2, altura: H / 2 }, ret, cen, ms: gasto };
    }
  }
  return {
    /** Assa por até `ms` (pelo menos uma unidade); true quando acabou. */
    passo(ms = IMPOSTOR.fatiaMs) {
      const t0 = agora();
      while (!feito) { unidade(); if (agora() - t0 >= ms) break; }
      gasto += agora() - t0;
      return feito;
    },
    get feito() { return feito; },
    get resultado() { return resultado; },
    /** Quanto já foi (0–1). */
    get progresso() { return (o * (NF + 1) + etapa) / (OBJETOS * (NF + 1)); },
  };
}
/** O atlas inteiro de uma vez (os testes; na página, o criarAssador em fatias). */
export function assarImpostor(modelo, spec) { const as = criarAssador(modelo, spec); as.passo(Infinity); return as.resultado; }

// ------------------------------------------------------------------ o impostor de um torcedor (a MESMA conta do shader)
/**
 * O quadro do impostor de um torcedor (o vertex shader em JS: IMPOSTOR_GLSL impVertice). t = {pos: [x, y, z] (o piso do
 * lugar), esc (aPos.w), rumo: [cos, sin], pose, pulo, bal, v (variação)}; cam = [x, y, z]; at = {ret, cen} (o resultado do
 * assamento); spec. Devolve {centro (mundo), v (a direção da câmera no espaço do torcedor), f: [[fx, fy] × 3], w: [3],
 * canto(qx, qy) → {p (mundo), uv: [[s, t] × 3] (0–1 na foto de cada um)}}.
 */
export function impostorDoTorcedor(t, cam, at, spec) {
  const o = objetoDe(t.v, Math.floor(t.pose + 0.5)), R = at.ret.subarray(4 * o, 4 * o + 4), Cn = at.cen.subarray(4 * o, 4 * o + 3);
  const sentado = Math.floor(t.pose + 0.5) < TORCEDOR3D.sentadas;
  const piv = sentado ? TORCEDOR3D.assento : 0, e = clamp(t.esc, IMPOSTOR.escala[0], IMPOSTOR.escala[1]);
  const [cr, sr] = t.rumo;
  const X = [sr, 0, -cr], Z = [cr, 0, sr];
  const doLocal = q => [t.pos[0] + X[0] * q[0] + Z[0] * q[2], t.pos[1] + q[1], t.pos[2] + X[2] * q[0] + Z[2] * q[2]];
  // o centro escalado (pelo assento sentado, pelo piso de pé), o pulo (só de pé) e o balanço (cresce com a altura)
  const cl = [Cn[0] * e, piv + (Cn[1] - piv) * e + (sentado ? 0 : t.pulo), Cn[2] * e];
  const altoC = clamp((cl[1] - piv) / TORCEDOR3D.alturaBal, 0, 1);
  cl[0] += t.bal * altoC;
  const centro = doLocal(cl);
  const vw = norm([cam[0] - centro[0], cam[1] - centro[1], cam[2] - centro[2]]);
  const v = [dot(vw, X), vw[1], dot(vw, Z)];
  const q = quadros(codificar(v), spec.N);
  const F = q.f.map(([fx, fy]) => { const d = direcaoDoQuadro(fx, fy, spec.N), B = base(d); return { d, ...B }; });
  const Bv = base(v);
  return {
    centro, v, f: q.f, w: q.w,
    canto(qx, qy) {
      const lp = [0, 1, 2].map(k => Bv.bx[k] * (R[0] + qx * R[2]) + Bv.by[k] * (R[1] + qy * R[3]));
      const p = doLocal([cl[0] + lp[0] * e, cl[1] + lp[1] * e, cl[2] + lp[2] * e]);
      const uv = F.map(f => { const [s, tt] = reprojetar(lp, v, f.d, f.bx, f.by); return [(s - R[0]) / R[2], (tt - R[1]) / R[3]]; });
      return { p, uv };
    },
  };
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * As mesmas contas em GLSL (o vertex shader do impostor: render/impostor.js; o teste-estadio confere GPU = JS):
 * vec2 impCodifica(vec3 d), vec3 impDecodifica(vec2 uv), vec3 impDirecao(vec2 f, float n), void impBase(vec3 d, out vec3
 * bx, out vec3 by), void impQuadros(vec2 uv, float n, out vec2 f0, out vec2 f1, out vec2 f2, out vec3 w) e vec2
 * impReprojeta(vec3 lp, vec3 v, vec3 d, vec3 bx, vec3 by).
 */
export const IMPOSTOR_GLSL = `
const float IMP_CI = ${g(CI)};
const float IMP_SI = ${g(SI)};
vec3 impParaInclinado(vec3 d) { return vec3(d.x, d.y * IMP_SI + d.z * IMP_CI, -d.y * IMP_CI + d.z * IMP_SI); }
vec3 impDeInclinado(vec3 e) { return vec3(e.x, e.y * IMP_SI - e.z * IMP_CI, e.y * IMP_CI + e.z * IMP_SI); }
vec2 impCodifica(vec3 d) {
  vec3 e = impParaInclinado(d);
  e.y = max(e.y, 0.0);
  float s = max(1e-9, abs(e.x) + abs(e.y) + abs(e.z));
  float x = e.x / s, z = e.z / s;
  return vec2(x + z, x - z);
}
vec3 impDecodifica(vec2 uv) {
  float x = (uv.x + uv.y) * 0.5, z = (uv.x - uv.y) * 0.5;
  return normalize(impDeInclinado(vec3(x, 1.0 - abs(x) - abs(z), z)));
}
vec3 impDirecao(vec2 f, float n) { return impDecodifica(f / (n - 1.0) * 2.0 - 1.0); }
void impBase(vec3 d, out vec3 bx, out vec3 by) {
  bx = abs(d.y) > 0.9999 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(d.z, 0.0, -d.x));
  by = cross(d, bx);
}
void impQuadros(vec2 uv, float n, out vec2 f0, out vec2 f1, out vec2 f2, out vec3 w) {
  float n1 = n - 1.0;
  vec2 gg = clamp((uv * 0.5 + 0.5) * n1, 0.0, n1);
  vec2 f = min(floor(gg), vec2(n1 - 1.0));
  vec2 t = gg - f;
  f0 = f;
  f2 = f + 1.0;
  if (t.x >= t.y) { f1 = f + vec2(1.0, 0.0); w = vec3(1.0 - t.x, t.x - t.y, t.y); }
  else { f1 = f + vec2(0.0, 1.0); w = vec3(1.0 - t.y, t.y - t.x, t.x); }
}
vec2 impReprojeta(vec3 lp, vec3 v, vec3 d, vec3 bx, vec3 by) {
  vec3 q = lp - v * (dot(lp, d) / max(0.2, dot(v, d)));
  return vec2(dot(q, bx), dot(q, by));
}
`;

// ------------------------------------------------------------------ a escolha dos blocos em impostor (pura)
/**
 * Quais blocos da grade vão em IMPOSTOR neste quadro (os outros, o quadro SDF). cam = {x, y, z, fx, fy, fz (frente), fov
 * (graus), aspecto, alturaPx}; anteriores: Set dos blocos em impostor no quadro anterior; opc = {pxEntra, pxSai, teto
 * (torcedores), favorAnterior, nPor (Int32Array: os torcedores desenhados de cada bloco), semSetor}. Os px são os da
 * CADEIRA (0,5 m) no ponto do bloco mais perto da câmera (a conta de escolherBlocos: entra com ≥ pxEntra, fica com ≥
 * pxSai); fora do cone da câmera, nada; o teto conta torcedores (os de mais px primeiro; quem já estava vale
 * `favorAnterior` mais). Devolve {lista: Set, torcedores, px: Map(bloco → px)}.
 */
export function escolherImpostor(blocos, cam, anteriores = new Set(), opc = {}) {
  const O = { favorAnterior: IMPOSTOR.favorAnterior, ...opc };
  const teto = Number.isFinite(O.teto) ? O.teto : 0;
  const lista = new Set(), pxs = new Map();
  if (teto <= 0 || !blocos.length) return { lista, torcedores: 0, px: pxs };
  const meio = (clamp(cam.fov, 1, 170) * Math.PI) / 360, tg = Math.tan(meio);
  const diag = Math.atan(tg * Math.sqrt(1 + (cam.aspecto ?? 1) ** 2));
  const cands = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i], n = O.nPor ? O.nPor[i] : b.n;
    if (!n) continue;
    if (O.semSetor != null && b.setor === O.semSetor) continue;
    const dx = b.c[0] - cam.x, dy = b.c[1] - cam.y, dz = b.c[2] - cam.z, d = Math.hypot(dx, dy, dz);
    if (d > b.raio) {
      const ang = Math.acos(clamp((dx * cam.fx + dy * cam.fy + dz * cam.fz) / d, -1, 1));
      if (ang - Math.asin(clamp(b.raio / d, 0, 1)) > diag) continue;
    }
    const px = (CADEIRA.largura * cam.alturaPx) / (2 * Math.max(0.5, d - b.raio) * tg);
    const ja = anteriores.has(i);
    if (px < (ja ? O.pxSai : O.pxEntra)) continue;
    cands.push([i, px, px * (ja ? O.favorAnterior : 1), n]);
  }
  cands.sort((p, q) => q[2] - p[2] || p[0] - q[0]);
  let tor = 0;
  for (const [i, px, , n] of cands) {
    if (tor + n > teto) continue;
    lista.add(i); pxs.set(i, px); tor += n;
  }
  return { lista, torcedores: tor, px: pxs };
}

// ------------------------------------------------------------------ cada torcedor no seu bloco (e o rumo dele)
/**
 * O bloco da grade de cada torcedor (pela caixa orientada do bloco: render/cadeiras-dados.js blocoDe; fora de todas, o
 * centro mais perto a até o raio) e o RUMO dele (para onde a fileira olha: o do bloco; sem bloco, o ponto do gramado mais
 * perto). pos = Float32Array(4n) (torcida.dados.pos). Devolve {bloco: Int32Array(n) (−1 = nenhum), rumo: Int8Array(2n)
 * (cos e sen × 127), inicio: Int32Array(blocos + 1) e idx: Int32Array(n) (os torcedores de cada bloco, em ordem)}.
 */
export function blocosDosTorcedores(blocos, pos, n) {
  const CEL = 8, chave = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const mapa = new Map();
  blocos.forEach((b, k) => {
    const r = b.raio + 1;
    for (let i = Math.floor((b.c[0] - r) / CEL); i <= Math.floor((b.c[0] + r) / CEL); i++) for (let j = Math.floor((b.c[2] - r) / CEL); j <= Math.floor((b.c[2] + r) / CEL); j++) {
      const ch = chave(i, j), l = mapa.get(ch);
      if (l) l.push(k); else mapa.set(ch, [k]);
    }
  });
  const bloco = new Int32Array(n).fill(-1), rumo = new Int8Array(2 * n);
  const dentro = (b, x, y, z, folga) => {
    const cx = b.caixa ? b.caixa.c : b.c, ax = b.caixa ? b.caixa.eixo[0] : 1, az = b.caixa ? b.caixa.eixo[1] : 0, e = b.caixa ? b.caixa.e : [b.raio, b.raio, b.raio];
    const dx = x - cx[0], dz = z - cx[2];
    return Math.abs(dx * ax + dz * az) <= e[0] + folga && Math.abs(y + 0.5 - cx[1]) <= e[1] + 1 + folga && Math.abs(dx * az - dz * ax) <= e[2] + folga;
  };
  for (let t = 0; t < n; t++) {
    const x = pos[4 * t], y = pos[4 * t + 1], z = pos[4 * t + 2];
    const l = mapa.get(chave(Math.floor(x / CEL), Math.floor(z / CEL))) ?? [];
    let melhor = -1, dm = Infinity;
    for (const folga of [0.05, 0.6]) {
      for (const k of l) {
        const b = blocos[k];
        if (!dentro(b, x, y, z, folga)) continue;
        const d = Math.hypot(b.c[0] - x, b.c[1] - y, b.c[2] - z);
        if (d < dm) { dm = d; melhor = k; }
      }
      if (melhor >= 0) break;
    }
    if (melhor < 0) for (const k of l) { const b = blocos[k], d = Math.hypot(b.c[0] - x, b.c[1] - y, b.c[2] - z); if (d < b.raio && d < dm) { dm = d; melhor = k; } }
    bloco[t] = melhor;
    let rx, rz;
    if (melhor >= 0 && blocos[melhor].caixa) { const [ax, az] = blocos[melhor].caixa.eixo; rx = az; rz = -ax; }
    else { const px = clamp(x, -52.5, 52.5) - x, pz = clamp(z, -34, 34) - z, L = Math.hypot(px, pz) || 1; rx = px / L; rz = pz / L; }
    // o rumo aponta para o campo (o eixo da caixa pode ter os dois sentidos)
    const cx = clamp(x, -52.5, 52.5) - x, cz = clamp(z, -34, 34) - z;
    if (rx * cx + rz * cz < 0) { rx = -rx; rz = -rz; }
    rumo[2 * t] = Math.round(rx * 127); rumo[2 * t + 1] = Math.round(rz * 127);
  }
  const inicio = new Int32Array(blocos.length + 1);
  for (let t = 0; t < n; t++) if (bloco[t] >= 0) inicio[bloco[t] + 1]++;
  for (let k = 0; k < blocos.length; k++) inicio[k + 1] += inicio[k];
  const idx = new Int32Array(inicio[blocos.length]), cur = inicio.slice(0, blocos.length);
  for (let t = 0; t < n; t++) if (bloco[t] >= 0) idx[cur[bloco[t]]++] = t;
  return { bloco, rumo, inicio, idx };
}

// ------------------------------------------------------------------ a densidade real perto (pura)
/** Sorteio pela chave da cadeira (0–1; o mesmo sempre): um misturador de 32 bits com a parte alta e a baixa da chave. */
export function sorteioCadeira(chave, sal = 0) {
  let h = (Math.floor(chave / 4294967296) * 0x9e3779b1) ^ (chave >>> 0) ^ Math.imul(sal + 1, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/**
 * As PESSOAS de um bloco perto da câmera com a densidade real: 1 por cadeira ocupada. assentos: as cadeiras do bloco (da
 * grade: {f, x, y, z, rumo, chave}); ocup: Int32Array (o torcedor da torcida sentado em cada uma, ou −1); dados =
 * torcida.dados (pos, camisa, pele, cabelo, info, nivel, publico); q = o nível da qualidade (0 Baixa, 1 Média, 2 Alta: os
 * desenhados são os de nível ≤ q); eixo = [ax, az] (ao longo da fileira). A ocupação alvo é público × `perto.cheio`; os
 * desenhados ficam; depois entram os torcedores da torcida de nível acima da qualidade sentados nas cadeiras vazias (gente
 * de verdade da torcida) e, se ainda faltar, gente nova — só nas cadeiras com um torcedor a até `raio` cadeiras na
 * fileira dela ou nas vizinhas (raio = cadeiras por torcedor no bloco, de 1 a raioMax), com o time, o setor e a organizada
 * do mais perto e a camisa, a pele e o cabelo de outros do bloco (sorteados pela chave da cadeira). Devolve {n, origem:
 * Int32Array (o índice na torcida, ou −1 para gente nova), assento: Int32Array (o índice em `assentos`), pos: Float32Array
 * (4n: x, y, z, escala), camisa, pele, cabelo, info: Uint8Array (4n, como a torcida), desenhados, daTorcida, novos}.
 */
export function preencherBloco(assentos, ocup, dados, q, eixo, opc = {}) {
  const P = { ...IMPOSTOR.perto, ...opc };
  const nA = assentos.length;
  const alvo = clamp((dados.publico ?? 1) * P.cheio, 0, 1);
  const ao = assentos.map(c => c.x * eixo[0] + c.z * eixo[1]);
  const quem = new Int32Array(nA).fill(-1);      // o torcedor da torcida que fica na cadeira (desenhado ou de nível acima)
  let desenhados = 0, daTorcida = 0, novos = 0;
  for (let i = 0; i < nA; i++) if (ocup[i] >= 0 && dados.nivel[ocup[i]] <= q) { quem[i] = ocup[i]; desenhados++; }
  const K = Math.round(alvo * nA);
  // 1) a gente da torcida de nível acima da qualidade nas cadeiras vazias (pela ordem do sorteio)
  const cima = [];
  for (let i = 0; i < nA; i++) if (ocup[i] >= 0 && quem[i] < 0) cima.push(i);
  cima.sort((x, y) => sorteioCadeira(assentos[x].chave, 1) - sorteioCadeira(assentos[y].chave, 1) || x - y);
  for (const i of cima) { if (desenhados + daTorcida >= K) break; quem[i] = ocup[i]; daTorcida++; }
  const reais = [];
  for (let i = 0; i < nA; i++) if (quem[i] >= 0) reais.push(i);
  // 2) gente nova (só perto de alguém: os vazios de propósito ficam vazios)
  const novo = new Uint8Array(nA), base2 = new Int32Array(nA).fill(-1);
  if (reais.length && desenhados + daTorcida < K) {
    const raio = clamp(Math.round(nA / reais.length), 1, P.raioMax) * CADEIRA.largura + 0.05;
    const cand = [];
    for (let i = 0; i < nA; i++) {
      if (quem[i] >= 0) continue;
      let m = -1, dm = Infinity;
      for (const j of reais) {
        const df = Math.abs(assentos[j].f - assentos[i].f);
        if (df > 1) continue;
        const da = Math.abs(ao[j] - ao[i]);
        if (da > raio) continue;
        const d = da + 0.8 * df;
        if (d < dm) { dm = d; m = j; }
      }
      if (m >= 0) { cand.push(i); base2[i] = m; }
    }
    cand.sort((x, y) => sorteioCadeira(assentos[x].chave, 2) - sorteioCadeira(assentos[y].chave, 2) || x - y);
    for (const i of cand) { if (desenhados + daTorcida + novos >= K) break; novo[i] = 1; novos++; }
  }
  const n = desenhados + daTorcida + novos;
  const origem = new Int32Array(n), assento = new Int32Array(n), pos = new Float32Array(4 * n);
  const camisa = new Uint8Array(4 * n), pele = new Uint8Array(4 * n), cabelo = new Uint8Array(4 * n), info = new Uint8Array(4 * n);
  const D = dados;
  const pegar = (lst, s) => lst[Math.min(lst.length - 1, Math.floor(s * lst.length))];
  let k = 0;
  for (let i = 0; i < nA; i++) {
    if (quem[i] < 0 && !novo[i]) continue;
    const c = assentos[i];
    origem[k] = quem[i]; assento[k] = i;
    if (quem[i] >= 0) {
      const t = quem[i];
      pos.set(D.pos.subarray(4 * t, 4 * t + 4), 4 * k); camisa.set(D.camisa.subarray(4 * t, 4 * t + 4), 4 * k);
      pele.set(D.pele.subarray(4 * t, 4 * t + 4), 4 * k); cabelo.set(D.cabelo.subarray(4 * t, 4 * t + 4), 4 * k);
      info.set(D.info.subarray(4 * t, 4 * t + 4), 4 * k);
    } else {
      const ch = c.chave, viz = quem[base2[i]];
      const time = D.info[4 * viz];
      const mesmos = reais.filter(j => D.info[4 * quem[j]] === time);
      const tc = quem[pegar(mesmos.length ? mesmos : reais, sorteioCadeira(ch, 3))];
      const tp = quem[pegar(reais, sorteioCadeira(ch, 4))], tb = quem[pegar(reais, sorteioCadeira(ch, 5))];
      pos.set([c.x, c.y, c.z, 0.92 + 0.16 * sorteioCadeira(ch, 6)], 4 * k);
      camisa.set(D.camisa.subarray(4 * tc, 4 * tc + 4), 4 * k);
      pele.set(D.pele.subarray(4 * tp, 4 * tp + 3), 4 * k); pele[4 * k + 3] = Math.floor(sorteioCadeira(ch, 7) * 255.99);
      cabelo.set(D.cabelo.subarray(4 * tb, 4 * tb + 4), 4 * k);
      info.set([time, D.info[4 * viz + 1], D.info[4 * viz + 2], Math.floor(sorteioCadeira(ch, 8) * 255.99)], 4 * k);
    }
    k++;
  }
  return { n, origem, assento, pos, camisa, pele, cabelo, info, desenhados, daTorcida, novos };
}
