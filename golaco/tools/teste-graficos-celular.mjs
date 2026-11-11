// Gráficos do celular pelos MÓDULOS (item 45, caminho A do plano; `golaco/PLANO-GRAFICOS.md` §4): a régua do gramado, das
// linhas, dos objetos finos e do serrilhado da geometria do campo, num Chromium com WebGL de verdade (SwiftShader). No molde
// do teste-rede-tela: a cena e o campo de render/cena.js + render/campo.js numa tela à parte (uma página mínima com o MESMO
// importmap do index.html), a câmera de TV do celular pelas funções puras de render/enquadramento.js (perfilCamera/poseTV),
// readPixels no mesmo evaluate do desenho. A conta dos pixels é em Node (tools/lib/cor-aces.mjs: OKLab), com a mesma
// projeção da câmera do three (lookAt, fov vertical): de cada pixel, o ponto do chão pelo raio até y = 0.
//
// O antisserrilhado é FORÇADO nos dois sentidos com o contexto PRÉ-CRIADO (canvas.getContext('webgl2', {antialias}) antes do
// criarCena: o three r170 pede o contexto pelo getContext e o navegador devolve o que já existe) — vale na main, que não tem
// ?aa. "O build" é o renderizador que o próprio criarCena cria (sem contexto pré-criado): a seção S diz se ele tem MSAA, e as
// medidas "do build" usam o contexto forçado igual a ele.
//
// Seções (`--so S,A,F,G,D,N`):
//   S  sonda: um contexto com antialias pedido dá antialias/SAMPLES = true/4 (senão o TESTE É INVÁLIDO: reprova sempre, mesmo
//      informativo — nunca passa calado). O build: Média true/4; Baixa false/0; ?aa=0 na Média 0; ?aa=1 na Baixa 4;
//      ?gfx=antigo na Média 0 (cada um numa carga da página com o parâmetro; na main os parâmetros não existem).
//   A  serrilhado da geometria do campo (o campo inteiro, sem jogadores nem torcida), na câmera com o gol no foco ('foco') e
//      com o gol de lá ('la'). Máscara GEOMÉTRICA do mesmo build: |MSAA − sem AA| > 0,01 num canal (dos quadros FÍSICOS: os
//      truques dos finos desligados pelo gancho `graficos.fisico` do C9/C10, quando existir). E = RMS(imagem − SSAA 3×3) só
//      na máscara, com o SSAA do MESMO LOD (9 desenhos 1× com a câmera a −⅓, 0, +⅓ px: o 3× descia o mip das texturas em
//      log2 3 e punha um piso no E) e físico; razão E_build / E_semAA. Meta: Média ≤ 0,6 (na main a Média é a sem AA: 1).
//   F  finos (hastes do véu, cordas do pé e do fundo, mastro da bandeirinha), só a malha 'gols' sobre o preto, 8 quadros com a
//      câmera andando 0,25 px por quadro PERPENDICULAR à peça na tela (o x da câmera para as peças em pé, o y para as
//      deitadas: andando ao longo da peça o traço é o mesmo pixel a pixel e a cintilação não mede nada): em pontos ao longo
//      da projeção de cada peça, a intensidade SOMADA no corte transversal (±3 px). Buraco = soma < 15% da do SSAA (físico) no
//      mesmo ponto e quadro; cintilação = CV da soma por ponto nos 8 quadros. Metas POR PEÇA, valendo a pior: buracos ≤ 5%;
//      cintilação ≤ 1,5 × a do SSAA (piso 0,02 no denominador); soma ±30% da do SSAA. Na Média e na Baixa, e na "Baixa com
//      MSAA" da queda (o contexto da Média com a qualidade Baixa: pixel ratio 1). Na Baixa, também a pose do LIMIAR (a corda
//      do pé de perto, com a meia largura de 1 px caindo entre as pontas: a revisão do bloco 3). Na Média, informativa, a F
//      SOBRE O GRAMADO (a revisão do bloco 3, achado 6 das medidas): as peças com o gramado atrás e as somas do quadro só com
//      o gramado descontadas (no build e no SSAA) — o quadro real; o grão e a sombra atrás da peça entram na conta.
//   G  o gramado (só a malha 'gramado'; G5 com as 'linhas'): G1 a cor na faixa do foco (OKLab, a média das duas classes);
//      G2 o ΔL das faixas (média por faixa pelo x do mundo de cada pixel) perto do foco e ao longe — as duas no quadro SEM as
//      manchas quando há o gancho `campo.graficos.semManchas(bool)` (a revisão do C4–C8: dependiam de onde as manchas caíam
//      perto do foco); G3 as faixas e as bordas (vista de cima, 2 quadros ortográficos: quantas no campo, a distância de cada
//      borda da UEFA à medida, a linha do meio separando claro de escuro); G4 longe − perto (L, C, h); G5 o pico da linha (p95
//      do L dos pixels da linha perto do foco); G6 o σL das manchas em blocos de 8 m, sem a média da faixa e sem uma
//      QUADRÁTICA em x e z, no quadro como ele sai (com o termo de profundidade: uma foto real também tem a curva do ângulo) —
//      INFORMATIVA: a meta 0,010 ± 0,004 é provisória até a régua da foto (o piso, o quadro sem as manchas, e a régua do C6,
//      sem o termo e sem um plano, ao lado); G7 GPU = JS (a classe lida em cada faixa = gramado.js faixaEm(x), quando o módulo
//      existe: {claro}, booleano (claro) ou a paridade/índice da faixa — esta, sem dizer qual é clara, casa pela maioria); G4b
//      a profundidade nas outras câmeras (1ª pessoa e lateral baixa do replay, steadicam, câmera do gol, Jogador e Atrás do
//      Livre, falta e escanteio, aéreo do pré-jogo e, desde a revisão do C4–C8, as câmeras baixas das cenas: o contraplano e a
//      reação da comemoração, a entrada, a fila e o túnel do pré-jogo, a frente e o árbitro da cena do cartão, medidas aos pés
//      do assunto): o L do gramado no foco com × sem o termo (o gancho `campo.graficos.semProfundidade(bool)`, quando existir)
//      e a parte do termo no salto do corte TV → 1ª pessoa (com − sem). A G4 que vale é o TERMO: longe − perto com − sem ele
//      (sem o gancho, 0); o absoluto (o termo + as manchas + a luz) é informativo. No PC a meta do ΔL é a do celular × o modelo
//      do ângulo (24,6° × 15°: render/gramado.js e o cor-aces, a conta do F6 do teste-gramado).
//   D  o grão: E e a cintilação (4 quadros a 0,25 px) por faixa da tela contra o SSAA do MESMO LOD, de perto a longe, e o
//      longe × o perto do foco no próprio build (o critério do passo 4); informativa.
//   N  noite (Média: G1–G5 e A; o Δh noite − dia contra o que o cor-aces prevê para o albedo do dia medido, ± 0,5°), Baixa
//      (G1–G5, A e F) e PC 1280×720 Alta, dia e noite (G1–G5 e A "nada pior"). O "nada pior" da A pelo que não depende do
//      contraste das bordas (a revisão do C4–C8: as linhas mais brancas subiram o E absoluto): no PC (build com MSAA) a razão
//      E_build / E_semAA do mesmo build; na Baixa (sem MSAA) o E ÷ o contraste da referência na máscara (o RMS do gradiente).
//
// A referência (`--gravar-referencia`) grava em tools/dados/graficos-ref.json (chave "celular"; a do teste-graficos-pagina é
// outra chave do mesmo arquivo) os valores AGREGADOS — nunca o hash dos pixels — com a versão do Chromium e o renderizador
// (UNMASKED_RENDERER). As guardas "nada pior" que dependem da rasterização comparam com ela; com OUTRO renderizador ganham +50%
// de tolerância e avisam; outra versão do Chromium só avisa (os valores não dependem dela: 141 do CI × 153). A referência é
// gravada com o Chromium do CI (o Playwright do `golaco-testes.yml`). As metas absolutas valem sempre.
//
// Informativo por enquanto (até o C14 do plano): imprime as metas e o estado, mas sai 0 (a sonda inválida e um erro no
// console saem 1 sempre). `--valendo` faz as metas contarem.
//   node tools/teste-graficos-celular.mjs [--raiz <pasta golaco>] [--so S,A,F,G,D,N] [--gravar-referencia] [--valendo]
//                                         [--prints <pasta>] [--json <arquivo>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { oklab, decSrgb, difMatiz, albedoPara, corNaTela, pocoNoite } from './lib/cor-aces.mjs';

const T0 = Date.now();
const args = process.argv.slice(2);
const tem = n => args.includes(n);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const SECOES = ['S', 'A', 'F', 'G', 'D', 'N'];
const so = new Set((arg('--so', '') || SECOES.join(',')).split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
const gravar = tem('--gravar-referencia');
const valendo = tem('--valendo');
const pastaPrints = arg('--prints', '') ? path.resolve(arg('--prints', '')) : null;
const arqJson = arg('--json', '') ? path.resolve(arg('--json', '')) : null;
if (pastaPrints) fs.mkdirSync(pastaPrints, { recursive: true });
const ARQ_REF = path.join(RAIZ, 'tools', 'dados', 'graficos-ref.json');
const CHAVE_REF = 'celular';

// ------------------------------------------------------------------ os módulos puros da versão medida (em Node)
const doJogo = p => import(pathToFileURL(path.join(raiz, p)).href);
const { CAMPO, REPLAY, COMEMORACAO } = await doJogo('js/config.js');
// as câmeras baixas das cenas (a G4b; a revisão do C4–C8): o pré-jogo e a cena do cartão, quando a versão medida os tem
const opcional = async p => { try { return await doJogo(p); } catch (_) { return null; } };
const PLANOS_PREJOGO = (await opcional('js/prejogo-roteiro.js'))?.PLANOS_PREJOGO ?? null;
const CENA_CARTAO = (await opcional('js/cenas-config.js'))?.CENA_CARTAO ?? null;
const EQ = await doJogo('js/render/enquadramento.js');
const { VEU } = await doJogo('js/rede-forma.js');
let GR_NODE = null;
if (fs.existsSync(path.join(raiz, 'js', 'render', 'gramado.js'))) { try { GR_NODE = await doJogo('js/render/gramado.js'); } catch (_) { GR_NODE = null; } }

// ------------------------------------------------------------------ resultados
const res = [];
const valores = {};
/** Uma meta: tipo 'meta' (conta com --valendo), 'info' (só mostra), 'estrutura' (conta sempre: o teste valeu). */
function meta(secao, nome, medido, alvo, ok, tipo = 'meta') { res.push({ secao, nome, medido, alvo, ok: ok === null ? null : !!ok, tipo }); }
const guarda = (k, v) => { if (Number.isFinite(v)) valores[k] = +v.toFixed(5); return v; };
/** Roda `fn` e passa as metas que ela registrou a informativas (o "passaria"/"fora" fica no texto). */
function comoInfo(fn) {
  const n0 = res.length;
  fn();
  for (let i = n0; i < res.length; i++) { const m = res[i]; if (m.ok !== null) m.medido = `[${m.ok ? 'passaria' : 'fora'}] ${m.medido}`; m.ok = null; m.tipo = 'info'; }
}
const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));
const pct = (v, d = 1) => (Number.isFinite(v) ? (v * 100).toFixed(d).replace('.', ',') + '%' : String(v));
const tempos = [];
let tMarca = Date.now();
const marcar = nome => { const t = Date.now(); tempos.push(`${nome} ${((t - tMarca) / 1000).toFixed(1)} s`); tMarca = t; };

// a referência gravada (se houver) e as condições desta rodada
let REF = null;
try { REF = JSON.parse(fs.readFileSync(ARQ_REF, 'utf8'))[CHAVE_REF] ?? null; } catch (_) { REF = null; }
const cond = { chromium: '', renderer: '' };
// a tolerância das guardas "nada pior" só abre com OUTRO renderizador (a rasterização muda); a versão do Chromium só avisa: os
// valores não dependem dela (147 de 153 iguais e 6 na 5ª casa, entre o 141 do CI e o 153 daqui — a revisão do C3)
const tolRef = () => (REF && REF.renderer !== cond.renderer ? 1.5 : 1);
const versaoDif = () => !!REF && REF.chromium !== cond.chromium;

// ------------------------------------------------------------------ vetores e a câmera do three (lookAt, fov vertical)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A base da câmera como o Matrix4.lookAt do three: z = de − para, x = up × z, y = z × x. pose = {de, para, fov | orto, up}. */
function baseCam(pose, W, H) {
  const ez = norm(sub(pose.de, pose.para)), ex = norm(cross(pose.up ?? [0, 1, 0], ez)), ey = cross(ez, ex);
  const B = { o: pose.de, ex, ey, ez, W, H };
  if (pose.orto) { B.orto = true; B.hw = pose.orto.hw; B.hh = pose.orto.hh; } else { B.tanV = Math.tan((pose.fov * Math.PI) / 360); B.asp = W / H; }
  return B;
}
/** Ponto do mundo → pixel (x da esquerda, y de BAIXO, centro do pixel = inteiro) e profundidade c. */
function projetar(B, p) {
  const d = sub(p, B.o), c = -dot(d, B.ez);
  const nx = B.orto ? dot(d, B.ex) / B.hw : dot(d, B.ex) / (c * B.tanV * B.asp);
  const ny = B.orto ? dot(d, B.ey) / B.hh : dot(d, B.ey) / (c * B.tanV);
  return { x: ((nx + 1) / 2) * B.W - 0.5, y: ((ny + 1) / 2) * B.H - 0.5, c };
}
/** O ponto do chão (y = 0) de cada pixel: Float32Array X e Z (NaN sem chão à frente). */
function mapaChao(B) {
  const { W, H } = B, X = new Float32Array(W * H), Z = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = ((y + 0.5) / H) * 2 - 1;
    for (let x = 0; x < W; x++) {
      const u = ((x + 0.5) / W) * 2 - 1, i = y * W + x;
      let o = B.o, d;
      if (B.orto) {
        o = [B.o[0] + u * B.hw * B.ex[0] + v * B.hh * B.ey[0], B.o[1] + u * B.hw * B.ex[1] + v * B.hh * B.ey[1], B.o[2] + u * B.hw * B.ex[2] + v * B.hh * B.ey[2]];
        d = [-B.ez[0], -B.ez[1], -B.ez[2]];
      } else {
        const a = u * B.tanV * B.asp, b = v * B.tanV;
        d = [-B.ez[0] + a * B.ex[0] + b * B.ey[0], -B.ez[1] + a * B.ex[1] + b * B.ey[1], -B.ez[2] + a * B.ex[2] + b * B.ey[2]];
      }
      if (d[1] >= -1e-9) { X[i] = NaN; Z[i] = NaN; continue; }
      const t = -o[1] / d[1];
      X[i] = o[0] + t * d[0]; Z[i] = o[2] + t * d[2];
    }
  }
  return { X, Z };
}
/** A pose andada d (m) no eixo da TELA: 'h' = o x da câmera (B.ex), 'v' = o y dela (B.ey); a orientação não muda. */
const deslocaCam = (pose, B, eixo, d) => { const e = eixo === 'v' ? B.ey : B.ex; return { ...pose, de: pose.de.map((v, i) => v + d * e[i]), para: pose.para.map((v, i) => v + d * e[i]) }; };

// ------------------------------------------------------------------ pixels e cor
const LIN = Float64Array.from({ length: 256 }, (_, i) => decSrgb(i / 255));
/** Decodifica o que a página devolveu: {px (Uint8 ou Uint16 com a soma de 9), w, h, x, y, div (1 ou 9)}. */
function decodificar(r) {
  const buf = Buffer.from(r.dados, 'base64');
  let px;
  if (r.tipo === 'u16') { px = new Uint16Array(buf.length / 2); Buffer.from(px.buffer).set(buf); } else { px = new Uint8Array(buf.length); px.set(buf); }
  return { px, w: r.w, h: r.h, x: r.x, y: r.y, div: r.tipo === 'u16' ? 9 : 1 };
}
const linDe = v => (Number.isInteger(v) ? LIN[v] : decSrgb(v / 255));
/** OKLab da média LINEAR de um acumulador [r, g, b, n]. */
const labDe = s => (s[3] > 0 ? oklab([s[0] / s[3], s[1] / s[3], s[2] / s[3]]) : null);
function acumular(s, I, i) { s[0] += linDe(I.px[4 * i] / I.div); s[1] += linDe(I.px[4 * i + 1] / I.div); s[2] += linDe(I.px[4 * i + 2] / I.div); s[3]++; }
const Lpix = (I, i) => oklab([linDe(I.px[4 * i] / I.div), linDe(I.px[4 * i + 1] / I.div), linDe(I.px[4 * i + 2] / I.div)]).L;
const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const percentil = (a, p) => { if (!a.length) return NaN; const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.max(0, Math.floor(p * (b.length - 1) + 0.5)))]; };

// ------------------------------------------------------------------ o que roda na página
async function instalarPagina() {
  const THREE = await import('three');
  const { criarCena } = await import('./js/render/cena.js');
  const { criarCampo } = await import('./js/render/campo.js');
  const pega = async p => { try { return await import(p); } catch (_) { return null; } };
  const CAM = await pega('./js/render/camera.js');
  const PBP = await pega('./js/render/plano-bola-parada.js');
  const CL = await pega('./js/render/camera-livre.js');
  const GR = await pega('./js/render/gramado.js');
  const ATTR = { alpha: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const cenas = new Map(), campos = new Map();
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const infoGl = gl => {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { antialias: gl.getContextAttributes().antialias, samples: gl.getParameter(gl.SAMPLES), W: gl.drawingBufferWidth, H: gl.drawingBufferHeight, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  };
  const png = (px, W, H) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g2 = cv.getContext('2d'), im = g2.createImageData(W, H);
    for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    // alfa 255 (a revisão do bloco 3): o three r170 pede o contexto com alpha true e a A2C deixa alfa < 1 no buffer nas bordas
    // das peças — na tela o compositor soma quase nada (o fundo da página é quase preto), mas o PNG saía translúcido
    for (let i = 3; i < im.data.length; i += 4) im.data[i] = 255;
    g2.putImageData(im, 0, 0);
    return cv.toDataURL('image/png').split(',')[1];
  };
  window.__G = {
    sonda() {
      const r = {};
      for (const aa of [true, false]) {
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        const gl = cv.getContext('webgl2', { ...ATTR, antialias: aa });
        r[aa ? 'com' : 'sem'] = gl ? { ...infoGl(gl), maxSamples: gl.getParameter(gl.MAX_SAMPLES) } : null;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
      return r;
    },
    /** O renderizador que o próprio build cria para a qualidade q (sem contexto pré-criado). */
    doBuild(q) {
      const cv = document.createElement('canvas');
      const c3 = criarCena({ canvas: cv, qualidade: q, hora: 'dia' });
      c3.redimensionar(innerWidth, innerHeight);
      const r = { q, ...infoGl(c3.renderer.getContext()), pr: c3.renderer.getPixelRatio() };
      c3.renderer.dispose(); c3.renderer.forceContextLoss();
      return r;
    },
    /** Cena com o antisserrilhado forçado (aa true/false: contexto pré-criado). */
    novaCena(id, { q, hora, aa }) {
      const cv = document.createElement('canvas');
      cv.getContext('webgl2', { ...ATTR, antialias: aa });
      const c3 = criarCena({ canvas: cv, qualidade: q, hora });
      c3.redimensionar(innerWidth, innerHeight);
      cenas.set(id, { c3, hora, cam: new THREE.PerspectiveCamera(32, 1, 0.5, 900), orto: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600) });
      return { ...infoGl(c3.renderer.getContext()), pr: c3.renderer.getPixelRatio(), aniso: c3.anisotropia() };
    },
    novoCampo(id, { q, cena }) {
      const campo = criarCampo({ qualidade: q, aniso: cenas.get(cena).c3.anisotropia() });
      campo.definirHora(cenas.get(cena).hora);
      campos.set(id, campo);
      return { filhos: campo.grupo.children.map(o => o.name) };
    },
    hora(id, campoId, h) { const C = cenas.get(id); C.hora = h; C.c3.definirHora(h); campos.get(campoId).definirHora(h); },
    semProfundidade(campoId, v) { const c = campos.get(campoId); if (typeof c?.graficos?.semProfundidade !== 'function') return false; c.graficos.semProfundidade(v); return true; },
    semManchas(campoId, v) { const c = campos.get(campoId); if (typeof c?.graficos?.semManchas !== 'function') return false; c.graficos.semManchas(v); return true; },
    /** O gancho `fisico` (C9/C10) existe no campo ou na cena? */
    temFisico(id, campoId) { return typeof campos.get(campoId)?.graficos?.fisico === 'function' || typeof cenas.get(id)?.c3?.graficos?.fisico === 'function'; },
    faixas(xs) {
      if (typeof GR?.faixaEm !== 'function') return null;
      return xs.map(x => { const v = GR.faixaEm(x); return v && typeof v === 'object' ? ('claro' in v ? (v.claro ? 1 : 0) : ((v.paridade ?? v.indice ?? 0) & 1) + 2) : typeof v === 'boolean' ? (v ? 1 : 0) : (v & 1) + 2; });
    },
    /**
     * Um quadro: pose {de, para, fov, perto | orto: {hw, hh}, up}; opc {so: nomes visíveis do campo (null = todos), semCeu,
     * fundo (cor de fundo), escala (1 | 3: SSAA 3×3 reduzido por caixa → soma de 9 em Uint16 | 'lod': o MESMO SSAA 3×3 com o
     * mip das texturas do quadro 1×), fisico (os truques dos finos desligados pelo gancho `graficos.fisico`, quando existir: a
     * referência e a máscara FÍSICAS), rect {x, y, w, h} (no buffer 1×, y de baixo), png}. readPixels no mesmo evaluate do
     * desenho.
     */
    quadro(id, campoId, pose, opc = {}) {
      const C = cenas.get(id), c3 = C.c3, r = c3.renderer, campo = campos.get(campoId);
      if (campo.grupo.parent !== c3.cena) c3.cena.add(campo.grupo);
      const gl = r.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      let cam;
      if (pose.orto) {
        cam = C.orto; cam.left = -pose.orto.hw; cam.right = pose.orto.hw; cam.top = pose.orto.hh; cam.bottom = -pose.orto.hh; cam.near = 0.1; cam.far = 600;
      } else { cam = C.cam; cam.fov = pose.fov; cam.aspect = W / H; cam.near = pose.perto ?? 0.5; cam.far = 900; }
      cam.up.set(...(pose.up ?? [0, 1, 0]));
      cam.clearViewOffset();
      cam.position.set(...pose.de); cam.lookAt(...pose.para); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      c3.acompanhar(pose.para[0], pose.para[2]);
      campo.atualizar(0, cam, true, true);
      const vis = campo.grupo.children.map(o => o.visible);
      if (opc.so) campo.grupo.children.forEach(o => { o.visible = opc.so.includes(o.name); });
      const ceu = c3.cena.getObjectByName('ceu');
      if (opc.semCeu) ceu.visible = false;
      const fundoAntes = new THREE.Color(); r.getClearColor(fundoAntes);
      if (opc.fundo !== undefined) r.setClearColor(opc.fundo);
      // o modo dos finos (C9) pelo MSAA do contexto que vai desenhar: o jogo chama campo.definirAA(cena.amostras) na criação e
      // na recriação; aqui o MESMO campo desenha em contextos com e sem MSAA, e cada quadro diz o seu (sem isto o campo ficaria
      // no modo de nascença, a mistura, também no contexto com MSAA, onde o build usa a A2C)
      if (typeof campo.definirAA === 'function') campo.definirAA(gl.getParameter(gl.SAMPLES));
      // (os ganchos dos finos — C9/C10 — desligados só neste desenho: a referência não depende do código medido)
      const fis = [campo.graficos?.fisico, c3.graficos?.fisico].filter(fn => typeof fn === 'function');
      if (opc.fisico) for (const fn of fis) fn(true);
      const k = opc.escala === 3 ? 3 : 1, lod = opc.escala === 'lod';
      const pr = r.getPixelRatio(), tam = r.getSize(new THREE.Vector2());
      const R = opc.rect ?? { x: 0, y: 0, w: W, h: H };
      let px, soma = null;
      try {
        if (lod) {
          // o SSAA com o MESMO LOD do 1× (item 8 da revisão): 9 desenhos no buffer 1× com a câmera deslocada −⅓, 0 e +⅓ px nos
          // dois eixos (os pontos de amostra do 3×3) — as derivadas, e o mip das texturas, são as do quadro 1× (o 3× desce o
          // LOD em log2 3 ≈ 1,58 e ganha um detalhe que o quadro 1× não tem)
          px = new Uint8Array(R.w * R.h * 4); soma = new Uint16Array(R.w * R.h * 4);
          for (const oy of [-1 / 3, 0, 1 / 3]) for (const ox of [-1 / 3, 0, 1 / 3]) {
            cam.setViewOffset(W, H, ox, oy, W, H);
            c3.desenhar(cam);
            gl.readPixels(R.x, R.y, R.w, R.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            for (let i = 0; i < soma.length; i++) soma[i] += px[i];
          }
          cam.clearViewOffset();
        } else {
          if (k === 3) { r.setPixelRatio(1); r.setSize(W * 3, H * 3, false); }
          c3.desenhar(cam);
          px = new Uint8Array(R.w * k * R.h * k * 4);
          gl.readPixels(R.x * k, R.y * k, R.w * k, R.h * k, gl.RGBA, gl.UNSIGNED_BYTE, px);
        }
      } finally {
        if (k === 3) { r.setPixelRatio(pr); r.setSize(tam.x, tam.y, false); }
        if (opc.fisico) for (const fn of fis) fn(false);
        cam.clearViewOffset();
      }
      campo.grupo.children.forEach((o, i) => { o.visible = vis[i]; });
      ceu.visible = true;
      r.setClearColor(fundoAntes);
      let saida;
      if (lod) saida = { dados: b64(new Uint8Array(soma.buffer)), tipo: 'u16' };
      else if (k === 3) {
        const w = R.w, h = R.h, W3 = w * 3, s = new Uint16Array(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const o = 4 * (y * w + x);
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
            const q = 4 * ((y * 3 + dy) * W3 + x * 3 + dx);
            s[o] += px[q]; s[o + 1] += px[q + 1]; s[o + 2] += px[q + 2]; s[o + 3] += px[q + 3];
          }
        }
        saida = { dados: b64(new Uint8Array(s.buffer)), tipo: 'u16' };
      } else saida = { dados: b64(px), tipo: 'u8' };
      return { ...saida, w: R.w, h: R.h, x: R.x, y: R.y, W, H, png: opc.png && k === 1 && !lod ? png(px, R.w, R.h) : null };
    },
    liberar(id) { const C = cenas.get(id); if (!C) return; C.c3.renderer.dispose(); C.c3.renderer.forceContextLoss(); cenas.delete(id); },
  };
  return {
    consts: {
      CAMERA_GOL: CAM?.CAMERA_GOL ?? null, CAMERA_BOLA_PARADA: PBP?.CAMERA_BOLA_PARADA ?? null, CAMERA_ESCANTEIO: PBP?.CAMERA_ESCANTEIO ?? null,
      PERFIS_LIVRE: CL?.PERFIS_LIVRE ?? null,
    },
    gramado: !!GR, faixaEm: typeof GR?.faixaEm === 'function', w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
  };
}

// ------------------------------------------------------------------ a página mínima (o importmap da versão medida)
const htmlJogo = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const importmap = (htmlJogo.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
if (!importmap) { console.error('teste-graficos-celular: sem importmap no index.html da raiz'); process.exit(1); }
// a mesma meta viewport do jogo (sem ela o Chromium "móvel" põe a página em 980 px e o buffer da Média sai 1470×679)
const viewport = (htmlJogo.match(/<meta name="viewport"[^>]*>/) || ['<meta name="viewport" content="width=device-width, initial-scale=1">'])[0];
const HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${viewport}<link rel="icon" href="data:,"><title>gráficos</title>${importmap}</head><body style="margin:0;background:#000"></body></html>`;
// 404 que são do próprio teste: os módulos que a versão medida pode não ter (o import opcional)
const OPCIONAIS = /\/js\/render\/(gramado|graficos-opcoes)\.js(\?|$)/;
const srv = await servidor(0, raiz);

async function abrirPagina(cfg) {
  const s = await abrir({ largura: cfg.w, altura: cfg.h, dpr: cfg.dpr, toque: cfg.toque });
  await s.contexto.route(/\/__graficos\.html(\?|$)/, rota => rota.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }));
  s.pagina.setDefaultTimeout(240000);
  s.outros404 = [];
  s.pagina.on('response', r => { if (r.status() === 404 && !OPCIONAIS.test(r.url())) s.outros404.push(r.url()); });
  if (!cond.chromium) cond.chromium = s.navegador.version();
  s.ir = async (busca = '') => {
    await s.pagina.goto(`${srv.url}__graficos.html${busca}`, { waitUntil: 'load' });
    return s.pagina.evaluate(instalarPagina);
  };
  return s;
}
/** Chama um método do __G na página. */
const G = (pg, nome, ...a) => pg.evaluate(([n, aa]) => window.__G[n](...aa), [nome, a]);
async function quadro(pg, cena, campo, pose, opc = {}, nomePrint = null) {
  const r = await G(pg, 'quadro', cena, campo, pose, { ...opc, png: !!(pastaPrints && nomePrint) });
  if (r.png && nomePrint) fs.writeFileSync(path.join(pastaPrints, `${nomePrint}.png`), Buffer.from(r.png, 'base64'));
  return decodificar(r);
}

// ------------------------------------------------------------------ as poses
const poses = {};
function posesTV(asp, pequena) {
  const p = EQ.perfilCamera({}, 0, asp, pequena);
  const tv = (fx, fz) => { const o = EQ.poseTV(p, fx, fz, asp, pequena, {}); return { de: [...o.de], para: [...o.para], fov: o.fov }; };
  return { perfil: p, meio: tv(0, 0), foco: tv(p.limX, 0), la: tv(p.limX, p.limZ1), canto: tv(p.limX, p.limZ0) };
}
/** Vista de cima, ortográfica (x da tela = x do mundo; para cima = −z): metade do campo com 3 m de sobra no meio. */
function posesTopo(asp) {
  const hw = 30, hh = hw / asp, cz = -34 + hh + 1.2;
  return [-1, 1].map(s => ({ orto: { hw, hh }, de: [s * 27, 150, cz], para: [s * 27, 0, cz], up: [0, 0, -1] }));
}
/** As câmeras da G4b (pelas constantes dos módulos quando a página as deu; senão os valores de hoje). */
function posesG4b(consts, asp, focoTV) {
  const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  const fovDeH = fh => (2 * Math.atan(Math.tan((fh * Math.PI) / 360) / asp) * 180) / Math.PI;
  const CG = consts.CAMERA_GOL ?? { recuo: 6.5, lateral: 13, altura: 2.6, olharAlem: 1, olharY: 1.55, fov: 27 };
  const BP = consts.CAMERA_BOLA_PARADA ?? { atras: 4.6, lado: 1.9, altura: 2.6, alvoY: 0.4, fov: [40, 74] };
  const ES = consts.CAMERA_ESCANTEIO ?? { atras: 13, lado: 1.2, altura: 8, alvoY: 0.3, fov: [26, 62] };
  const PL = consts.PERFIS_LIVRE ?? { atras: { recuo: 19, altura: 9.5, adiante: 12, olharY: 0, fov: 42 }, jogador: { recuo: 7.5, altura: 3.9, adiante: 7, olharY: 0.2, fov: 48 } };
  const LT = REPLAY?.lateral ?? { recuo: 5, altura: 1.6, fora: 3.5, fov: 18 };
  const P1 = REPLAY?.gol?.primeira ?? REPLAY?.primeira ?? { fovH: 90, arfagemAntes: -18, perto: 0.1 };
  const ST = { frente: 6.5, lado: 2.4, altura: 1.6, fov: 32 };
  // 1ª pessoa: o olho a 1,72 m com a arfagem de antes do chute, olhando o MESMO ponto do chão que a TV com o gol no foco
  // (o corte TV → 1ª pessoa compara o mesmo pedaço de gramado: o salto é só o que muda com a vista, não a troca de faixa)
  const arf = (Math.abs(P1.arfagemAntes ?? -18) * Math.PI) / 180, dOlho = 1.72 / Math.tan(arf);
  const olho = [focoTV[0] - dOlho, 1.72, focoTV[2]];
  const fBP = Array.isArray(BP.fov) ? BP.fov[0] : BP.fov, fES = Array.isArray(ES.fov) ? ES.fov[0] : ES.fov;
  const orbAng = (50 * Math.PI) / 180;
  return {
    'replay-1a-pessoa': { de: olho, para: [focoTV[0], 0, focoTV[2]], fov: fovDeH(P1.fovH ?? 90), perto: P1.perto ?? 0.1 },
    'replay-lateral': { de: [28 - LT.recuo, LT.altura, MZ + LT.fora], para: [30, 0.4, 10], fov: LT.fov },
    steadicam: { de: [40 + ST.frente, ST.altura, 20 + ST.lado], para: [40.3, 1.5, 20], fov: ST.fov },
    'camera-gol': { de: [MX - CG.recuo, CG.altura, CG.lateral], para: [MX + CG.olharAlem, CG.olharY, 0], fov: CG.fov },
    'livre-jogador': { de: [20 - PL.jogador.recuo, PL.jogador.altura, 5], para: [20 + PL.jogador.adiante, PL.jogador.olharY, 5], fov: PL.jogador.fov },
    'livre-atras': { de: [20 - PL.atras.recuo, PL.atras.altura, 5], para: [20 + PL.atras.adiante, PL.atras.olharY, 5], fov: PL.atras.fov },
    falta: { de: [24 - BP.atras, BP.altura, 4 + BP.lado], para: [MX, BP.alvoY, 0], fov: fBP },
    escanteio: { de: [MX + ES.atras * 0.55, ES.altura, MZ + ES.atras * 0.8], para: [MX - 11, ES.alvoY, 0], fov: fES },
    'prejogo-aereo': { de: [267 * Math.cos(orbAng), 113, 267 * Math.sin(orbAng)], para: [0, 12, 0], fov: 38 },
    ...posesBaixas(),
  };
}
/**
 * As câmeras BAIXAS das cenas que a G4b não media (a revisão do C4–C8: o raio do meio toca o chão muito além do assunto, ou
 * não toca, e o termo de antes punha o chão aos pés dele no teto de −8%): o contraplano e a reação da comemoração (o autor em
 * (40, 20), andando em +x), a entrada, a fila do mandante e o túnel do pré-jogo (o ponto do chão sob o "para" do trilho) e a
 * cena do cartão (o punido em (30, −10)). `pe` = os pés do assunto, onde a Lfoco mede.
 */
function posesBaixas() {
  const out = {};
  const C = COMEMORACAO?.camera, A = [40, 20];
  if (C?.contraplano) out['com-contraplano'] = { de: [A[0] - C.contraplano.atras, C.contraplano.altura, A[1] + C.contraplano.lado], para: [A[0] + C.contraplano.alem, C.contraplano.olharY, A[1]], fov: C.contraplano.fov ?? 36, pe: A };
  if (C?.reacao) out['com-reacao'] = { de: [A[0] + C.reacao.dist, C.reacao.altura, A[1]], para: [A[0], C.reacao.olharY, A[1]], fov: C.reacao.fov ?? 30, pe: A };
  const trilho = (id, k) => {
    const P = PLANOS_PREJOGO?.[id]?.cam; if (!P?.de) return null;
    const j = k < 0 ? P.de.length - 1 : k, fov = Array.isArray(P.fov) ? P.fov[j] : P.fov;
    return { de: [...P.de[j]], para: [...P.para[j]], fov: fov ?? 40, pe: [P.para[j][0], P.para[j][2]] };
  };
  for (const [nome, id, k] of [['pre-entrada', 'entrada', -1], ['pre-fila', 'filaMandante', 0], ['pre-tunel', 'tunel', -1]]) { const p = trilho(id, k); if (p) out[nome] = p; }
  const CC = CENA_CARTAO?.camera, B = [30, -10];
  if (CC?.frente) out['cartao-frente'] = { de: [B[0] + CC.frente.dist, CC.frente.altura, B[1]], para: [B[0], CC.frente.olharY, B[1]], fov: CC.frente.fov ?? 30, pe: B };
  if (CC?.arbitro) out['cartao-arbitro'] = { de: [B[0] + CC.arbitro.dist, CC.arbitro.altura, B[1]], para: [B[0], CC.arbitro.olharY, B[1]], fov: CC.arbitro.fov ?? 31, pe: B };
  return out;
}

// ------------------------------------------------------------------ as peças finas do gol (cópia da geometria de campo.js criarGols)
function pecasGol() {
  const g = CAMPO.gol, R = g.raioPoste, zp = g.largura / 2 + R, yt = g.altura + R, zl = g.largura / 2;
  const H = VEU?.haste ?? g.veu?.haste ?? 0.45, F = VEU?.fundo ?? g.veu?.fundo ?? 2.8, MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  const L = [];
  for (const s of [-1, 1]) {
    const x = s * MX;
    for (const t of [-1, 1]) {
      L.push({ nome: `poste${s}${t}`, tipo: 'grosso', a: [x, 0, t * zp], b: [x, yt + R, t * zp], r: R });
      L.push({ nome: `haste${s}${t}`, tipo: 'haste', a: [x, yt, t * zp], b: [x + s * H, g.altura + 0.02, t * zl], r: 0.028 });
      L.push({ nome: `pe${s}${t}`, tipo: 'corda do pé', a: [x + s * R, 0.012, t * zl], b: [x + s * F, 0.012, t * zl], r: 0.012 });
      L.push({ nome: `mastro${s}${t}`, tipo: 'mastro', a: [x, 0, t * MZ], b: [x, 1.55, t * MZ], r: 0.018 });
      L.push({ nome: `tampa${s}${t}`, tipo: 'grosso', a: [x, 1.55, t * MZ], b: [x, 1.57, t * MZ], r: 0.022 });
    }
    L.push({ nome: `travessao${s}`, tipo: 'grosso', a: [x, yt, -zp - R], b: [x, yt, zp + R], r: R });
    L.push({ nome: `fundo${s}`, tipo: 'corda do fundo', a: [x + s * F, 0.012, -zl], b: [x + s * F, 0.012, zl], r: 0.014 });
  }
  return L;
}
const FINOS = ['haste', 'corda do pé', 'corda do fundo', 'mastro'];

// ------------------------------------------------------------------ medidas
/**
 * Serrilhado (A): {E1, E0, mascara, C} pela máscara geométrica |MSAA − sem| > 0,01 (M1/M0: os quadros físicos da máscara). C =
 * o CONTRASTE da referência na máscara (o RMS do gradiente da SSAA, de um pixel ao vizinho da direita e ao de cima, 0–1): o E
 * cresce com o contraste das bordas (as linhas mais brancas do C7 subiram o E da Baixa sem AA em 2–4%, sem mudar o
 * serrilhado); E ÷ C é o serrilhado sem o contraste (a guarda "nada pior" da Baixa; a revisão do C4–C8).
 */
function serrilhado(I1, I0, S, M1 = I1, M0 = I0) {
  let n = 0, s1 = 0, s0 = 0, sg = 0, ng = 0;
  const W = I1.w, N = I1.w * I1.h;
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(M1.px[4 * i + c] - M0.px[4 * i + c]));
    if (m <= 2.55) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      const ss = S.px[4 * i + c] / 9;
      s1 += ((I1.px[4 * i + c] - ss) / 255) ** 2; s0 += ((I0.px[4 * i + c] - ss) / 255) ** 2;
    }
    if (i % W < W - 1 && i + W < N) {
      for (let c = 0; c < 3; c++) {
        const ss = S.px[4 * i + c];
        sg += ((S.px[4 * (i + 1) + c] - ss) / 2295) ** 2 + ((S.px[4 * (i + W) + c] - ss) / 2295) ** 2;
      }
      ng++;
    }
  }
  return { E1: Math.sqrt(s1 / Math.max(1, 3 * n)), E0: Math.sqrt(s0 / Math.max(1, 3 * n)), mascara: n / N, C: Math.sqrt(sg / Math.max(1, 6 * ng)) };
}

/** Bordas das faixas num perfil L(x) (x crescente): medianas de 1 m de cada lado, máximo local, refino pelo cruzamento. */
function bordasDoPerfil(xs, Ls) {
  const n = xs.length, dx = (xs[n - 1] - xs[0]) / (n - 1), w = Math.max(3, Math.round(1 / dx));
  const med = (a, b) => { const v = []; for (let i = Math.max(0, a); i <= Math.min(n - 1, b); i++) if (Number.isFinite(Ls[i])) v.push(Ls[i]); return v.length ? percentil(v, 0.5) : NaN; };
  const e = new Float64Array(n).fill(NaN), esq = new Float64Array(n), dir = new Float64Array(n);
  for (let i = w; i < n - w; i++) { esq[i] = med(i - w, i - 1); dir[i] = med(i + 1, i + w); e[i] = dir[i] - esq[i]; }
  const abs = Array.from(e).filter(Number.isFinite).map(Math.abs);
  const contraste = percentil(abs, 0.98);
  const cand = [];
  for (let i = w; i < n - w; i++) {
    const a = Math.abs(e[i]);
    if (!(a >= 0.45 * contraste)) continue;
    let max = true;
    for (let j = i - w; j <= i + w; j++) if (j !== i && Math.abs(e[j]) > a) { max = false; break; }
    if (max) cand.push(i);
  }
  const bordas = [];
  for (const i of cand) {
    const alvo = (esq[i] + dir[i]) / 2;
    let melhor = null;
    for (let k = i - Math.ceil(w / 2); k < i + Math.ceil(w / 2); k++) {
      if (k < 0 || k + 1 >= n) continue;
      const a = Ls[k] - alvo, b = Ls[k + 1] - alvo;
      if (a * b <= 0 && a !== b) { const x = xs[k] + (a / (a - b)) * (xs[k + 1] - xs[k]); if (!melhor || Math.abs(k - i) < melhor.d) melhor = { x, d: Math.abs(k - i) }; }
    }
    const x = melhor ? melhor.x : xs[i];
    if (bordas.length && x - bordas[bordas.length - 1].x < 2) { if (Math.abs(e[i]) > bordas[bordas.length - 1].e) bordas[bordas.length - 1] = { x, e: Math.abs(e[i]), sobe: e[i] > 0 }; continue; }
    bordas.push({ x, e: Math.abs(e[i]), sobe: e[i] > 0 });
  }
  return { bordas, contraste };
}
/** As bordas da UEFA (a partir da linha de fundo: 4 × 5,5 m + 5 faixas iguais até o meio), em x. */
function bordasUefa() {
  const MX = CAMPO.meioX, d = [5.5, 11, 16.5, 22], resto = (MX - 22) / 5;
  for (let k = 1; k < 5; k++) d.push(22 + k * resto);
  const xs = [0];
  for (const s of [-1, 1]) for (const v of d) xs.push(s * (MX - v));
  return xs.sort((a, b) => a - b);
}

/** G3: o perfil da vista de cima (2 quadros) → as bordas, a contagem e o erro contra a UEFA. */
function medirFaixas(quadros, topo) {
  const cols = new Map();
  quadros.forEach((I, q) => {
    const B = baseCam(topo[q], I.w, I.h), { X, Z } = mapaChao(B);
    for (let x = 0; x < I.w; x++) {
      const xm = X[x]; // a coluna tem o mesmo x
      if (Math.abs(xm) > 56) continue;
      // de cada quadro só a parte longe da borda dele: a linha do meio (uma borda) fica inteira no 1º, que vai até x = 3
      if ((q === 0 && xm > 2) || (q === 1 && xm <= 2)) continue;
      const s = [0, 0, 0, 0];
      for (let y = 0; y < I.h; y++) { const i = y * I.w + x, z = Z[i]; if (z >= -31 && z <= -12) acumular(s, I, i); }
      if (s[3] > 20) cols.set(Math.round(xm * 1000), { x: xm, L: labDe(s).L });
    }
  });
  const v = [...cols.values()].sort((a, b) => a.x - b.x);
  const xs = v.map(c => c.x), Ls = v.map(c => c.L);
  const { bordas, contraste } = bordasDoPerfil(xs, Ls);
  const MX = CAMPO.meioX;
  const dentro = bordas.filter(b => Math.abs(b.x) < MX - 0.3);
  const uefa = bordasUefa();
  const erros = uefa.map(u => { let m = Infinity; for (const b of dentro) m = Math.min(m, Math.abs(b.x - u)); return { u, erro: m }; });
  const pior = erros.reduce((a, b) => (b.erro > a.erro ? b : a), { erro: -1 });
  const nivel = (a, b) => { const l = []; for (let i = 0; i < xs.length; i++) if (xs[i] >= a && xs[i] <= b) l.push(Ls[i]); return media(l); };
  const meioE = nivel(-0.9, -0.25), meioD = nivel(0.25, 0.9);
  const passo = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : NaN;
  return { bordas: dentro.map(b => b.x), faixas: dentro.length + 1, erros, pior, contraste, meioSepara: Math.abs(meioD - meioE) >= 0.5 * contraste, meioE, meioD, passo };
}

/** Faixa de cada x pelas bordas medidas: índice e a distância à borda mais perto. */
function faixaDe(bordas, x) {
  let lo = 0, hi = bordas.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (bordas[m] < x) lo = m + 1; else hi = m; }
  const d = Math.min(lo < bordas.length ? bordas[lo] - x : Infinity, lo > 0 ? x - bordas[lo - 1] : Infinity);
  return { k: lo, d };
}
/**
 * G1, G2, G4, G6 (e a classe de cada faixa para a G7) no quadro do 'meio' (só o gramado). perto do foco: |Z| ≤ 8, |X| ≤ 15
 * (sem o desgaste do círculo central); longe: Z de −34 a −24; G4: perto Z 8–18 × longe Z −32 a −22, |X| ≤ 12.
 */
function medirGramado(I, pose, bordas) {
  const B = baseCam(pose, I.w, I.h), { X, Z } = mapaChao(B);
  const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  const nf = bordas.length + 1;
  const reg = { foco: [], longe: [], g4perto: [], g4longe: [], todo: [] };
  for (const k in reg) for (let j = 0; j < nf; j++) reg[k].push([0, 0, 0, 0]);
  const Lp = new Float32Array(I.w * I.h).fill(NaN), kp = new Int16Array(I.w * I.h).fill(-1);
  for (let i = 0; i < I.w * I.h; i++) {
    const x = X[i], z = Z[i];
    if (!(Math.abs(x) <= MX - 0.3 && Math.abs(z) <= MZ - 0.3)) continue;
    const { k, d } = faixaDe(bordas, x);
    if (d < 0.3) continue;
    const desgaste = Math.abs(x) < 4 && Math.abs(z) < 3.5;
    if (!desgaste) { acumular(reg.todo[k], I, i); Lp[i] = Lpix(I, i); kp[i] = k; }
    if (Math.abs(z) <= 8 && Math.abs(x) <= 15 && !desgaste) acumular(reg.foco[k], I, i);
    if (z >= -34 && z <= -24 && Math.abs(x) <= 30) acumular(reg.longe[k], I, i);
    if (Math.abs(x) <= 12 && z >= 8 && z <= 18) acumular(reg.g4perto[k], I, i);
    if (Math.abs(x) <= 12 && z >= -32 && z <= -22) acumular(reg.g4longe[k], I, i);
  }
  // a classe de cada faixa (clara = acima da média das vizinhas), pelo campo todo
  const Ltodo = reg.todo.map(s => (s[3] > 200 ? labDe(s).L : NaN));
  const classe = Ltodo.map((L, j) => {
    const viz = [Ltodo[j - 1], Ltodo[j + 1]].filter(Number.isFinite);
    return Number.isFinite(L) && viz.length ? (L > media(viz) ? 1 : 0) : -1;
  });
  const dL = (acc, min) => {
    const Ls = acc.map(s => (s[3] >= min ? labDe(s).L : NaN)), d = [];
    for (let j = 0; j + 1 < Ls.length; j++) if (Number.isFinite(Ls[j]) && Number.isFinite(Ls[j + 1])) d.push(Math.abs(Ls[j] - Ls[j + 1]));
    return { dL: media(d), pares: d.length };
  };
  const porClasse = acc => {
    const s = [[0, 0, 0, 0], [0, 0, 0, 0]];
    acc.forEach((a, j) => { if (classe[j] >= 0) for (let c = 0; c < 4; c++) s[classe[j]][c] += a[c]; });
    const o = s.map(labDe);
    if (!o[0] || !o[1]) return null;
    const hm = o[0].h + difMatiz(o[1].h, o[0].h) / 2;
    return { L: (o[0].L + o[1].L) / 2, C: (o[0].C + o[1].C) / 2, h: (hm + 360) % 360, claro: o[1], escuro: o[0] };
  };
  const g1 = porClasse(reg.foco);
  const g2 = { foco: dL(reg.foco, 300), longe: dL(reg.longe, 300) };
  const p4 = porClasse(reg.g4perto), l4 = porClasse(reg.g4longe);
  const g4 = p4 && l4 ? { dL: l4.L - p4.L, dC: l4.C - p4.C, dh: difMatiz(l4.h, p4.h), perto: p4, longe: l4 } : null;
  // G6: σL das manchas em blocos de 8 m, sem a média da faixa e sem um plano (mínimos quadrados em X e Z)
  const Lfaixa = reg.todo.map(s => (s[3] > 200 ? labDe(s).L : NaN));
  const blocos = new Map();
  for (let i = 0; i < Lp.length; i++) {
    if (!Number.isFinite(Lp[i]) || kp[i] < 0 || !Number.isFinite(Lfaixa[kp[i]])) continue;
    const bx = Math.floor((X[i] + 56) / 8), bz = Math.floor((Z[i] + 40) / 8), ch = bx * 100 + bz;
    let b = blocos.get(ch); if (!b) { b = { s: 0, n: 0, sx: 0, sz: 0 }; blocos.set(ch, b); }
    b.s += Lp[i] - Lfaixa[kp[i]]; b.n++; b.sx += X[i]; b.sz += Z[i];
  }
  const bl = [...blocos.values()].filter(b => b.n >= 200).map(b => ({ r: b.s / b.n, x: b.sx / b.n, z: b.sz / b.n, n: b.n }));
  let g6 = null;
  if (bl.length >= 6) {
    // plano r ≈ a + b·x + c·z (normais 3×3)
    let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
    for (const b of bl) { const v = [1, b.x, b.z]; for (let i = 0; i < 3; i++) { y[i] += v[i] * b.r; for (let j = 0; j < 3; j++) S[i][j] += v[i] * v[j]; } }
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(S), coef = [0, 1, 2].map(k => det(S.map((row, i) => row.map((v, j) => (j === k ? y[i] : v)))) / D);
    const resid = bl.map(b => b.r - (coef[0] + coef[1] * b.x + coef[2] * b.z));
    const m = media(resid);
    // a régua nova (a revisão do C4–C8): sem uma QUADRÁTICA em x e z (1, x, z, x², xz, z²) — o termo de profundidade e o
    // ângulo da vista são curvas suaves em z que o plano não tira (uma foto real também as tem: medida assim, ela se compara
    // com o quadro COM o termo); as manchas (3–10 m) e o grão ficam
    const fq = [b => 1, b => b.x, b => b.z, b => b.x * b.x, b => b.x * b.z, b => b.z * b.z];
    const residQ = residuosMQ(bl, fq), mq = media(residQ);
    g6 = { sigma: Math.sqrt(media(resid.map(r => (r - m) ** 2))), sigmaQ: Math.sqrt(media(residQ.map(r => (r - mq) ** 2))), blocos: bl.length };
  }
  return { g1, g2, g4, g6, classe, X, Z, kp };
}

/** Mínimos quadrados de r ≈ Σ aₖ·fₖ(b) (eliminação de Gauss com pivô parcial nas normais): os resíduos r − ajuste. */
function residuosMQ(bl, fns) {
  const n = fns.length, A = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (const b of bl) {
    const v = fns.map(fn => fn(b));
    for (let i = 0; i < n; i++) { A[i][n] += v[i] * b.r; for (let j = 0; j < n; j++) A[i][j] += v[i] * v[j]; }
  }
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]; }
  }
  const a = A.map((row, i) => row[n] / row[i]);
  return bl.map(b => b.r - fns.reduce((acc, fn, i) => acc + a[i] * fn(b), 0));
}

/** G5: o pico da linha (p95 do L dos pixels que a linha clareia em ≥ 0,08) no meio do quadro. */
function picoLinha(Icom, Isem) {
  const L = [];
  const { w, h } = Icom;
  for (let y = Math.floor(h * 0.2); y < Math.ceil(h * 0.8); y++) for (let x = Math.floor(w * 0.2); x < Math.ceil(w * 0.8); x++) {
    const i = y * w + x, Lc = Lpix(Icom, i);
    if (Lc - Lpix(Isem, i) >= 0.08) L.push(Lc);
  }
  return { p95: percentil(L, 0.95), n: L.length };
}

/** G4b: L do gramado (média linear) numa janela de 40 × 40 px em volta do ponto do chão olhado (ou do meio da tela). */
function Lfoco(I, pose) {
  const B = baseCam(pose, I.w, I.h);
  // (os pés do assunto quando a pose os dá: no contraplano da comemoração o alvo fica 6 m além do autor)
  let alvo = projetar(B, pose.pe ? [pose.pe[0], 0, pose.pe[1]] : [pose.para[0], 0, pose.para[2]]);
  if (!(alvo.c > 0 && alvo.x >= 20 && alvo.x < I.w - 20 && alvo.y >= 20 && alvo.y < I.h - 20)) alvo = { x: I.w / 2, y: I.h / 2 };
  const { X, Z } = mapaChao(B), s = [0, 0, 0, 0];
  for (let y = Math.round(alvo.y) - 20; y < Math.round(alvo.y) + 20; y++) for (let x = Math.round(alvo.x) - 20; x < Math.round(alvo.x) + 20; x++) {
    if (x < 0 || y < 0 || x >= I.w || y >= I.h) continue;
    const i = y * I.w + x;
    if (Math.abs(X[i]) <= 58 && Math.abs(Z[i]) <= 39) acumular(s, I, i);
  }
  const o = labDe(s);
  return o ? { L: o.L, n: s[3] } : { L: NaN, n: 0 };
}

/** Amostra bilinear do brilho (média dos 3 canais, 0–255) num recorte. */
function brilho(I, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  let s = 0;
  for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const xx = x0 + dx, yy = y0 + dy;
    if (xx < 0 || yy < 0 || xx >= I.w || yy >= I.h) continue;
    const i = 4 * (yy * I.w + xx);
    s += wt * (I.px[i] + I.px[i + 1] + I.px[i + 2]) / (3 * I.div);
  }
  return s;
}
const distSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1; let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy); };

/**
 * F: os pontos de amostra das peças finas na pose (quadro 0) e o recorte que cobre todos os quadros. Cada ponto guarda a
 * peça, o t ao longo dela (refeito a cada quadro pela pose deslocada) e o PASSE em que é medido: a câmera anda na direção da
 * tela mais perpendicular à peça ('h' para a peça mais em pé que deitada na tela, 'v' para a deitada). Andando AO LONGO da
 * peça, o traço projetado é o mesmo pixel a pixel (uma reta é invariante pela translação paralela a ela) e a "cintilação"
 * virava o tracejado parado lido em 8 pontos (o SSAA dava CV 0 na corda do pé: a revisão do C3).
 */
function prepararFinos(pose, W, H, nq, cRef) {
  const pecas = pecasGol();
  const B = baseCam(pose, W, H);
  const proj = pecas.map(p => ({ ...p, A: projetar(B, p.a), Bp: projetar(B, p.b) }));
  const dentro = q => q.c > 0.5 && q.x > 4 && q.x < W - 5 && q.y > 4 && q.y < H - 5;
  const pontos = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of proj) {
    if (!FINOS.includes(p.tipo) || !dentro(p.A) || !dentro(p.Bp)) continue;
    const comp = Math.hypot(p.Bp.x - p.A.x, p.Bp.y - p.A.y);
    const n = Math.max(1, Math.floor((comp * 0.7) / 2));
    for (let j = 0; j < n; j++) {
      const t = 0.15 + (0.7 * (j + 0.5)) / n;
      const pt = { x: p.A.x + t * (p.Bp.x - p.A.x), y: p.A.y + t * (p.Bp.y - p.A.y) };
      // longe de qualquer outra peça (as grossas e as outras finas) no corte de ±3 px
      if (proj.some(o => o !== p && o.A.c > 0.5 && o.Bp.c > 0.5 && distSeg(pt, o.A, o.Bp) < 5)) continue;
      pontos.push({ peca: p, t, passe: Math.abs(p.Bp.y - p.A.y) >= Math.abs(p.Bp.x - p.A.x) ? 'h' : 'v' });
      x0 = Math.min(x0, pt.x); x1 = Math.max(x1, pt.x); y0 = Math.min(y0, pt.y); y1 = Math.max(y1, pt.y);
    }
  }
  // a câmera anda 0,25 px por quadro na profundidade cRef: o ponto mais perto anda 0,25 × cRef / c
  const cMin = Math.min(...pontos.map(p => Math.min(projetar(B, p.peca.a).c, projetar(B, p.peca.b).c)));
  const m = 8 + Math.ceil(0.25 * nq * (cRef / Math.max(1, cMin)));
  const rect = pontos.length ? { x: Math.max(0, Math.floor(x0 - m)), y: Math.max(0, Math.floor(y0 - m)) } : null;
  if (rect) { rect.w = Math.min(W, Math.ceil(x1 + m)) - rect.x; rect.h = Math.min(H, Math.ceil(y1 + m)) - rect.y; }
  return { pontos, rect };
}
/** A soma no corte transversal (±3 px, de 1 em 1 px) de cada ponto num quadro (a pose deslocada). */
function somasFinos(I, pose, W, H, pontos) {
  const B = baseCam(pose, W, H);
  return pontos.map(({ peca, t }) => {
    const A = projetar(B, peca.a), Bp = projetar(B, peca.b);
    const px = A.x + t * (Bp.x - A.x) - I.x, py = A.y + t * (Bp.y - A.y) - I.y;
    let nx = -(Bp.y - A.y), ny = Bp.x - A.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    let s = 0;
    for (let k = -3; k <= 3; k++) s += brilho(I, px + k * nx, py + k * ny);
    return s;
  });
}
/**
 * Buracos, cintilação e soma de um conjunto de pontos contra o SSAA: cada ponto traz as somas por quadro do quadro medido
 * (`campo`: 'vb' o build, 'vx' o outro contexto) e do SSAA ('vs'), no passe dele.
 */
function estatFinos(pontos, filtro = null, campo = 'vb') {
  let nb = 0, n = 0, sb = 0, ss = 0;
  const cvB = [], cvS = [];
  for (const p of pontos) {
    if (filtro && p.peca.tipo !== filtro) continue;
    const vb = p[campo], vs = p.vs;
    if (!vb || !vs) continue;
    const mb = media(vb), ms = media(vs);
    if (!(ms > 6)) continue;
    for (let k = 0; k < vb.length; k++) { n++; if (vb[k] < 0.15 * vs[k]) nb++; sb += vb[k]; ss += vs[k]; }
    cvB.push(mb > 0 ? Math.sqrt(media(vb.map(v => (v - mb) ** 2))) / mb : 1);
    cvS.push(Math.sqrt(media(vs.map(v => (v - ms) ** 2))) / ms);
  }
  const cint = media(cvB), cintS = media(cvS);
  return { n, pontos: cvB.length, buracos: n ? nb / n : NaN, cint, cintS, raz: cint / Math.max(cintS, PISO_CV), soma: ss ? sb / ss : NaN };
}
// o piso do denominador da cintilação (o SSAA de uma peça que cruza poucos pixels dá CV perto de 0) e o mínimo de pontos de
// uma peça para ela contar na meta POR PEÇA
const PISO_CV = 0.02, MIN_PONTOS_PECA = 2;
/** Por peça (as que têm pontos bastantes) e a pior de cada medida. */
function porPeca(pontos, campo = 'vb') {
  const tipos = Object.fromEntries(FINOS.map(t => [t, estatFinos(pontos, t, campo)]));
  const validas = FINOS.filter(t => tipos[t].pontos >= MIN_PONTOS_PECA);
  const pior = (fn, cmp) => validas.reduce((a, t) => (a === null || cmp(fn(tipos[t]), fn(tipos[a])) ? t : a), null);
  const pb = pior(e => e.buracos, (x, y) => x > y), pc = pior(e => e.raz, (x, y) => x > y), ps = pior(e => Math.abs(Math.log(e.soma)), (x, y) => x > y);
  return {
    tipos, validas, geral: estatFinos(pontos, null, campo),
    pior: {
      buracos: pb ? { peca: pb, v: tipos[pb].buracos } : null,
      raz: pc ? { peca: pc, v: tipos[pc].raz } : null,
      soma: ps ? { peca: ps, v: tipos[ps].soma } : null,
    },
  };
}

/**
 * F, a pose do LIMIAR (a revisão do bloco 3): a corda do pé do gol de +x vista de perto e de lado (a câmera 'atras' do replay, a do
 * gol e a da comemoração passam por aqui), com a meia largura de 1 px caindo entre as duas pontas no buffer da Baixa (844 × 390).
 */
function poseLimiar() {
  const MX = CAMPO.meioX, zl = CAMPO.gol.largura / 2;
  return { de: [MX - 3.5, 1.6, 10], para: [MX + 1.5, 0.3, zl], fov: 32 };
}
/** A meia largura na tela (px) nas duas pontas da corda do pé de +x pela conta do shader (render/campo.js: P[1][1]·H/2/w). */
function meiaNasPontas(pose, W, H) {
  const pe = pecasGol().find(p => p.nome === 'pe11'), B = baseCam(pose, W, H);
  const meia = pe.r * Math.cos(Math.PI / 16);
  return [pe.a, pe.b].map(q => (meia * H) / (2 * projetar(B, q).c * B.tanV));
}

// ------------------------------------------------------------------ as rodadas
const NQ_F = 8, NQ_D = 4;
const CEL = { nome: 'cel', w: 844, h: 390, dpr: 2, toque: true };
const PC = { nome: 'pc', w: 1280, h: 720, dpr: 1, toque: false };
let invalido = null;
const errosConsole = [];

/**
 * A seção F numa cena (build) contra a sem AA com SSAA (físico): 2 câmeras, NQ_F quadros em cada passe (a câmera andando 0,25
 * px por quadro no x da tela para as peças em pé e no y para as deitadas). Devolve os pontos com as somas e as estatísticas
 * por peça, por câmera; com `extra`, as do outro contexto também.
 */
async function secaoF(pg, rotulo, cenaBuild, cenaSem, campo, P, W, H, extra = null, cams = ['foco', 'la'], grama = false) {
  const saida = {};
  for (const cn of cams) {
    const pose = P[cn];
    const B = baseCam(pose, W, H), cRef = projetar(B, [CAMPO.meioX, 1, 0]).c;
    // 0,25 px na profundidade do gol (pixels quadrados: o mesmo no x e no y da tela)
    const d0 = (0.25 * 2 * cRef * B.tanV) / H;
    const { pontos, rect } = prepararFinos(pose, W, H, NQ_F, cRef);
    if (!pontos.length) { saida[cn] = null; continue; }
    for (const p of pontos) { p.vb = []; p.vs = []; if (extra) p.vx = []; }
    const opc = { so: grama ? ['gols', 'gramado'] : ['gols'], semCeu: true, fundo: 0x000000, rect };
    // sobre o gramado: as somas do quadro só com o gramado descontadas (no build e no SSAA físico)
    const opcG = { so: ['gramado'], semCeu: true, fundo: 0x000000, rect };
    const menos = (a, b) => a.map((v, j) => v - b[j]);
    for (const passe of ['h', 'v']) {
      const pp = pontos.filter(p => p.passe === passe);
      if (!pp.length) continue;
      for (let q = 0; q < NQ_F; q++) {
        const pq = deslocaCam(pose, B, passe, q * d0);
        const Ib = await quadro(pg, cenaBuild, campo, pq, opc, q === 0 && passe === 'h' ? `${rotulo}-F-${cn}` : null);
        const Is = await quadro(pg, cenaSem, campo, pq, { ...opc, escala: 3, fisico: true });
        let sb = somasFinos(Ib, pq, W, H, pp), ss = somasFinos(Is, pq, W, H, pp);
        if (grama) {
          sb = menos(sb, somasFinos(await quadro(pg, cenaBuild, campo, pq, opcG), pq, W, H, pp));
          ss = menos(ss, somasFinos(await quadro(pg, cenaSem, campo, pq, { ...opcG, escala: 3, fisico: true }), pq, W, H, pp));
        }
        pp.forEach((p, j) => { p.vb.push(sb[j]); p.vs.push(ss[j]); });
        if (extra) { const sx = somasFinos(await quadro(pg, extra, campo, pq, opc), pq, W, H, pp); pp.forEach((p, j) => p.vx.push(sx[j])); }
      }
    }
    saida[cn] = { pontos, build: porPeca(pontos, 'vb'), extra: extra ? porPeca(pontos, 'vx') : null, passes: { h: pontos.filter(p => p.passe === 'h').length, v: pontos.filter(p => p.passe === 'v').length } };
  }
  return saida;
}
const slugPeca = t => ({ haste: 'haste', 'corda do pé': 'cordaPe', 'corda do fundo': 'cordaFundo', mastro: 'mastro' }[t] ?? t);
/**
 * As metas da F POR PEÇA, valendo a pior (a média de todos os pontos escondia o mastro: × 3,22 numa "geral" de × 1,74):
 * buracos ≤ 5% em toda peça; cintilação ≤ 1,5 × a do SSAA (com o piso PISO_CV no denominador) e soma 0,7–1,3 em toda peça.
 * `qual`: 'build' (as somas do quadro medido) ou 'extra' (o outro contexto).
 */
const NOME_CAM_F = { foco: 'gol no foco', la: 'gol de lá', limiar: 'o limiar de 1 px dentro da corda do pé' };
function metasF(rotulo, F, chave, qual = 'build', tipo = 'meta') {
  for (const cn of Object.keys(F)) {
    const r0 = F[cn], r = r0?.[qual];
    const nomeCam = NOME_CAM_F[cn] ?? cn;
    if (!r) { meta('F', `Finos (${rotulo}, ${nomeCam}): sem peça fina no quadro`, '—', 'peças no quadro', false, 'info'); continue; }
    for (const t of r.validas) {
      const e = r.tipos[t], s = slugPeca(t);
      guarda(`F.${chave}.${cn}.${s}.buracos`, e.buracos); guarda(`F.${chave}.${cn}.${s}.cint`, e.cint); guarda(`F.${chave}.${cn}.${s}.cintSSAA`, e.cintS); guarda(`F.${chave}.${cn}.${s}.soma`, e.soma);
    }
    const P_ = r.pior;
    guarda(`F.${chave}.${cn}.buracos`, P_.buracos?.v); guarda(`F.${chave}.${cn}.razao`, P_.raz?.v); guarda(`F.${chave}.${cn}.soma`, P_.soma?.v);
    const fora = FINOS.filter(t => !r.validas.includes(t) && r.tipos[t].pontos > 0);
    const tipos = r.validas.map(t => { const e = r.tipos[t]; return `${t} ${pct(e.buracos, 0)} · CV ${f(e.cint)}/${f(e.cintS)} × ${f(e.raz, 2)} · soma ${f(e.soma, 2)} (${e.pontos} pt)`; }).join(' | ');
    const extraTxt = `${tipos}${fora.length ? ` | poucos pontos: ${fora.join(', ')}` : ''} · passes h ${r0.passes.h} / v ${r0.passes.v} pontos${r0.nota ? ` · ${r0.nota}` : ''}`;
    const okB = r.validas.length > 0 && r.validas.every(t => r.tipos[t].buracos <= 0.05);
    meta('F', `Finos (${rotulo}, ${nomeCam}): buracos, pior peça`, `${P_.buracos ? `${pct(P_.buracos.v)} (${P_.buracos.peca})` : '—'} · geral ${pct(r.geral.buracos)} de ${r.geral.n} · ${extraTxt}`, '≤ 5% em toda peça', okB, tipo);
    const okC = r.validas.length > 0 && r.validas.every(t => r.tipos[t].raz <= 1.5 && r.tipos[t].soma >= 0.7 && r.tipos[t].soma <= 1.3);
    meta('F', `Finos (${rotulo}, ${nomeCam}): cintilação e soma, pior peça`,
      `cintilação × ${f(P_.raz?.v, 2)} (${P_.raz?.peca ?? '—'}) · soma ${f(P_.soma?.v, 2)} (${P_.soma?.peca ?? '—'}) · geral CV ${f(r.geral.cint)} (SSAA ${f(r.geral.cintS)}) · soma ${f(r.geral.soma, 2)}`,
      `CV ≤ 1,5 × SSAA (piso ${f(PISO_CV, 2)}) · soma 0,7–1,3, em toda peça`, okC, tipo);
  }
}

/** G1–G5 (e G6/G7 quando pedido) num conjunto de cena/campo/hora: devolve as medidas. */
async function medirG(pg, rotulo, cena, campo, P, topo) {
  const tq = [];
  for (let k = 0; k < topo.length; k++) tq.push(await quadro(pg, cena, campo, topo[k], { so: ['gramado'], semCeu: true }, `${rotulo}-G3-topo${k}`));
  const g3 = medirFaixas(tq, topo);
  const Imeio = await quadro(pg, cena, campo, P.meio, { so: ['gramado'], semCeu: true }, `${rotulo}-G-meio`);
  const gm = g3.bordas.length >= 8 ? medirGramado(Imeio, P.meio, g3.bordas) : null;
  // o mesmo quadro SEM o termo de profundidade (o gancho do C7): a G4 mede com − sem, só o termo (item 6 da revisão: o absoluto
  // levava as manchas, ±0,004–0,007 entre ~4 blocos de cada região, e a luz da noite, −0,017 contra o dia)
  let g4sem = null, gmSem = null, temGancho = false;
  if (gm && (temGancho = await G(pg, 'semProfundidade', campo, true))) {
    try { gmSem = medirGramado(await quadro(pg, cena, campo, P.meio, { so: ['gramado'], semCeu: true }), P.meio, g3.bordas); g4sem = gmSem.g4; } finally { await G(pg, 'semProfundidade', campo, false); }
  }
  // a G1 e a G2 no quadro SEM as manchas (o gancho semManchas, quando existir; a revisão do C4–C8: o L da G1 e o ΔL ao longe
  // da G2 dependiam de onde as manchas caíam perto do foco — uManchas 0 / 0,17 / 0,34 dava L 0,581 / 0,575 / 0,568 e o longe
  // × 1,00 / 1,07 / 1,14); a G6 desse quadro é o piso da régua (só o termo e o grão: a quadrática tem de tirar o termo)
  let gm12 = null;
  if (gm && await G(pg, 'semManchas', campo, true)) {
    try { gm12 = medirGramado(await quadro(pg, cena, campo, P.meio, { so: ['gramado'], semCeu: true }), P.meio, g3.bordas); } finally { await G(pg, 'semManchas', campo, false); }
  }
  const Icom = await quadro(pg, cena, campo, P.foco, { so: ['gramado', 'linhas'], semCeu: true }, `${rotulo}-G5-linhas`);
  const Isem = await quadro(pg, cena, campo, P.foco, { so: ['gramado'], semCeu: true });
  const g5 = picoLinha(Icom, Isem);
  return { g3, gm, g5, g4sem, gmSem, temGancho, gm12 };
}

/**
 * O TERMO de profundidade pelo MODELO (render/gramado.js e a luz do dia e o ACES do r170 pelo cor-aces; a conta do F6 do
 * teste-gramado), longe − perto com − sem, nas regiões da G4 (|x| ≤ 12; perto z 8…18, longe z −32…−22), para a câmera da
 * pose; null sem o gramado.js. A meta da G4 do PC sai daqui (a revisão do C4–C8): a foto (+0,026) é da TV a ~15°, e no PC
 * (24,6°) o MESMO termo dá outro gradiente — a meta do PC é a do celular × modelo(PC) ÷ modelo(celular).
 */
function termoModelo(pose) {
  const GRn = GR_NODE;
  if (typeof GRn?.termoProfundidade !== 'function' || typeof GRn?.gFocoDe !== 'function') return null;
  const D = GRn.GRAMADO_HORAS.dia, ras0 = GRn.valoresGramado('dia').uRasante;
  const ras = typeof GRn.rasanteDaCamera === 'function' ? GRn.rasanteDaCamera(ras0, pose.de[1]) : ras0;
  const gf = GRn.gFocoDe(pose.de, sub(pose.para, pose.de));
  const regiao = (z0, z1, com) => {
    const acc = [0, 0, 0]; let n = 0;
    for (let x = -12; x <= 12; x += 0.5) for (let z = z0; z <= z1; z += 0.5) for (const alb of [D.clara, D.escura]) {
      const g = GRn.gProfundidade(...pose.de, x, z);
      const c = corNaTela(com ? GRn.termoProfundidade(alb, g, gf, ras) : alb);
      for (let i = 0; i < 3; i++) acc[i] += c[i];
      n++;
    }
    return oklab(acc.map(v => v / n));
  };
  const dif = com => regiao(-32, -22, com).L - regiao(8, 18, com).L;
  return dif(true) - dif(false);
}
function metasG(rotulo, chave, M, opc = {}) {
  const { g3, gm, g5 } = M;
  const sec = opc.secao ?? 'G';
  // G1 e G2 do quadro sem as manchas, quando há o gancho (a revisão do C4–C8)
  const gc = M.gm12 ?? gm, semMan = M.gm12 ? ', sem as manchas' : '';
  // G1
  const g1 = gc?.g1;
  if (g1) {
    guarda(`G1.${chave}.L`, g1.L); guarda(`G1.${chave}.C`, g1.C); guarda(`G1.${chave}.h`, g1.h);
    meta(sec, `G1 cor na faixa do foco (${rotulo}${semMan})`, `L ${f(g1.L)} C ${f(g1.C)} h ${f(g1.h, 1)}° (clara L ${f(g1.claro.L)} · escura L ${f(g1.escuro.L)})`, 'L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3°',
      opc.semG1 ? null : Math.abs(g1.L - 0.58) <= 0.02 && Math.abs(g1.C - 0.10) <= 0.01 && Math.abs(difMatiz(g1.h, 124)) <= 3, opc.semG1 ? 'info' : 'meta');
  } else meta(sec, `G1 cor na faixa do foco (${rotulo})`, 'não medido (faixas não achadas)', 'L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3°', false, opc.semG1 ? 'info' : 'meta');
  // G2
  const g2 = gc?.g2;
  if (g2) {
    guarda(`G2.${chave}.foco`, g2.foco.dL); guarda(`G2.${chave}.longe`, g2.longe.dL);
    const raz = g2.longe.dL / g2.foco.dL;
    meta(sec, `G2 ΔL das faixas (${rotulo}${semMan})`, `perto do foco ${f(g2.foco.dL)} (${g2.foco.pares} pares) · ao longe ${f(g2.longe.dL)} (× ${f(raz, 2)})`, '0,056 ± 0,008; ao longe ≥ 0,6×',
      Math.abs(g2.foco.dL - 0.056) <= 0.008 && raz >= 0.6);
  } else meta(sec, `G2 ΔL das faixas (${rotulo})`, 'não medido', '0,056 ± 0,008', false);
  // G3
  guarda(`G3.${chave}.faixas`, g3.faixas); guarda(`G3.${chave}.piorErro`, g3.pior.erro);
  const tolB = Math.max(0.10, g3.passo || 0);
  meta(sec, `G3 faixas e bordas (${rotulo})`, `${g3.faixas} faixas no campo · pior borda da UEFA a ${f(g3.pior.erro, 2)} m (x = ${f(g3.pior.u, 2)}) · meio ${g3.meioSepara ? 'separa' : 'NÃO separa'} (${f(g3.meioE)} | ${f(g3.meioD)})`,
    `18 · ≤ ${f(tolB, 2)} m · separa`, g3.faixas === 18 && g3.pior.erro <= tolB && g3.meioSepara);
  // G4: o termo de profundidade = (longe − perto) com o termo − sem ele; o absoluto (o termo + as manchas + a luz) informativo
  const g4 = gm?.g4;
  if (g4 && !opc.semG4) {
    guarda(`G4.${chave}.dL`, g4.dL); guarda(`G4.${chave}.dC`, g4.dC); guarda(`G4.${chave}.dh`, g4.dh);
    meta(sec, `G4 longe − perto no quadro, absoluto (${rotulo})`, `ΔL ${f(g4.dL, 4)} · ΔC ${f(g4.dC, 4)} · Δh ${f(g4.dh, 2)}° (perto L ${f(g4.perto.L)}, longe L ${f(g4.longe.L)})`,
      'informativo (o termo + as manchas + a luz)', null, 'info');
    const s4 = M.g4sem;
    // sem o gancho a versão não tem o termo: com − sem = 0 (a main reprova a meta por isso)
    const t = s4 ? { dL: g4.dL - s4.dL, dC: g4.dC - s4.dC, dh: g4.dh - s4.dh } : { dL: 0, dC: 0, dh: 0 };
    guarda(`G4t.${chave}.dL`, t.dL); guarda(`G4t.${chave}.dC`, t.dC); guarda(`G4t.${chave}.dh`, t.dh);
    // a meta do ΔL: a da foto (+0,026, a TV do celular a ~15°) ou, no PC, a do celular × o modelo do ângulo (opc.alvoG4)
    const alvo = opc.alvoG4?.v ?? 0.026;
    meta(sec, `G4 o termo de profundidade, longe − perto com − sem o termo (${rotulo})`,
      `ΔL ${f(t.dL, 4)} · ΔC ${f(t.dC, 4)} · Δh ${f(t.dh, 2)}°${s4 ? '' : ' (sem o gancho semProfundidade: a versão não tem o termo, 0)'}${opc.alvoG4 ? ` · ${opc.alvoG4.txt}` : ''}`,
      `ΔL +${f(alvo, 3)} ± 0,008; ΔC ≤ 0; |Δh| ≤ 2°`, Math.abs(t.dL - alvo) <= 0.008 && t.dC <= 0 && Math.abs(t.dh) <= 2);
  }
  // G5
  guarda(`G5.${chave}.p95`, g5.p95);
  meta(sec, `G5 pico da linha (${rotulo})`, `p95 L ${f(g5.p95)} (${g5.n} px da linha)`, opc.linhaSo97 ? '≤ 0,97' : '0,952 ± 0,01 e ≤ 0,97',
    opc.linhaSo97 ? g5.p95 <= 0.97 : Math.abs(g5.p95 - 0.952) <= 0.01 && g5.p95 <= 0.97);
}

/**
 * A: a máscara geométrica |MSAA − sem| e a referência são FÍSICAS (os truques dos finos do C9/C10 desligados pelo gancho
 * `graficos.fisico`, quando existir: sem ele, o contexto sem AA deixa de ser "o mesmo build menos o MSAA" e a máscara deixa de
 * ser só geometria); a referência é o SSAA com o MESMO LOD do quadro 1× (o 3× desce o mip e põe um piso de textura no E).
 */
async function secaoA(pg, rotulo, chave, cena1, cena0, campo, P, buildAA, opc = {}) {
  const out = {};
  const temFisico = await G(pg, 'temFisico', cena0, campo);
  for (const cn of ['foco', 'la']) {
    const I1 = await quadro(pg, cena1, campo, P[cn], {}, `${rotulo}-A-${cn}-msaa`);
    const I0 = await quadro(pg, cena0, campo, P[cn], {}, `${rotulo}-A-${cn}-sem`);
    const S = await quadro(pg, cena0, campo, P[cn], { escala: 'lod', fisico: true });
    const M1 = temFisico ? await quadro(pg, cena1, campo, P[cn], { fisico: true }) : I1;
    const M0 = temFisico ? await quadro(pg, cena0, campo, P[cn], { fisico: true }) : I0;
    const r = serrilhado(I1, I0, S, M1, M0);
    const Eb = buildAA ? r.E1 : r.E0, raz = Eb / r.E0, En = Eb / r.C;
    guarda(`A.${chave}.${cn}.Ebuild`, Eb); guarda(`A.${chave}.${cn}.Esem`, r.E0); guarda(`A.${chave}.${cn}.Emsaa`, r.E1); guarda(`A.${chave}.${cn}.razao`, raz); guarda(`A.${chave}.${cn}.mascara`, r.mascara);
    guarda(`A.${chave}.${cn}.contraste`, r.C); guarda(`A.${chave}.${cn}.Enorm`, En);
    out[cn] = { ...r, Eb, raz, En };
    const nomeCam = cn === 'foco' ? 'gol no foco' : 'gol de lá';
    const base = `E build ${f(Eb, 4)} · sem AA ${f(r.E0, 4)} · MSAA forçado ${f(r.E1, 4)} (× ${f(r.E1 / r.E0, 2)}) · máscara ${pct(r.mascara, 2)} · contraste ${f(r.C, 4)} · build ${buildAA ? 'com' : 'sem'} MSAA`;
    if (opc.nadaPior) {
      // a guarda pelo que não depende do contraste das bordas (a revisão do C4–C8: as linhas mais brancas do C7 subiram o E
      // absoluto em 2–5% sem mudar o antisserrilhado): com MSAA no build (o PC Alta), a razão E_build / E_semAA do mesmo build;
      // sem (a Baixa), o E ÷ o contraste da referência na máscara. O E absoluto contra a referência fica no texto.
      const tol = 0.10 * tolRef();
      const qual = buildAA ? 'razao' : 'Enorm', v = buildAA ? raz : En, ref = REF?.valores?.[`A.${chave}.${cn}.${qual}`];
      const refE = REF?.valores?.[`A.${chave}.${cn}.Ebuild`];
      const nomeV = buildAA ? 'razão E_build / E_semAA' : 'E ÷ contraste';
      meta(opc.secao ?? 'A', `A serrilhado (${rotulo}, ${nomeCam}): nada pior que a referência, pela ${nomeV}`,
        `${nomeV} ${f(v, 4)}${Number.isFinite(ref) ? ` · ref ${f(ref, 4)} (× ${f(v / ref, 3)})` : ' · sem referência'} · ${base}${Number.isFinite(refE) ? ` · E absoluto ref ${f(refE, 4)} (× ${f(Eb / refE, 3)})` : ''}`,
        `${nomeV} ≤ ref × ${f(1 + tol, 2)}`, Number.isFinite(ref) ? v <= ref * (1 + tol) : null, Number.isFinite(ref) ? (opc.tipo ?? 'meta') : 'info');
    } else {
      meta(opc.secao ?? 'A', `A serrilhado (${rotulo}, ${nomeCam}): razão E_build / E_semAA`, `${f(raz, 2)} · ${base}`, opc.alvo ?? '≤ 0,6', opc.alvoFn ? opc.alvoFn(raz) : raz <= 0.6, opc.tipo ?? 'meta');
    }
  }
  return out;
}

/**
 * A cor da noite que o cor-aces prevê para o gramado do dia medido (G1 por classe): o albedo de cada classe pela inversa
 * exata do ACES sob a luz do dia, levado à luz da noite com o poço de luz do foco (a região do G1 fica toda no 1,04), e a
 * média das classes como na G1.
 */
function preverNoite(g1) {
  const fator = pocoNoite(0, 0);
  const lab = o => oklab(corNaTela(albedoPara(o.L, o.C, o.h, { hora: 'dia' }), { hora: 'noite', fator }));
  const c = lab(g1.claro), e = lab(g1.escuro);
  const hm = e.h + difMatiz(c.h, e.h) / 2;
  return { L: (c.L + e.L) / 2, C: (c.C + e.C) / 2, h: (hm + 360) % 360 };
}

// ================================================================== celular (844×390, dpr 2, toque)
const sessoes = [];
let g1Dia = null;
try {
  const cel = await abrirPagina(CEL);
  sessoes.push(cel);
  const pg = cel.pagina;
  const anotarErros = () => { for (const e of cel.erros.splice(0)) if (!/status of 404/.test(e)) errosConsole.push(e); for (const u of cel.outros404.splice(0)) errosConsole.push(`404: ${u}`); };

  // ---- S: o build com os parâmetros (cada um numa carga)
  const buildPar = {};
  if (so.has('S')) {
    for (const [busca, q] of [['?aa=0', 'media'], ['?aa=1', 'baixa'], ['?gfx=antigo', 'media']]) {
      await cel.ir(busca);
      buildPar[busca] = await G(pg, 'doBuild', q);
    }
  }
  const info = await cel.ir('');
  const sonda = await G(pg, 'sonda');
  cond.renderer = sonda.com?.renderer ?? '';
  const build = { media: await G(pg, 'doBuild', 'media'), baixa: await G(pg, 'doBuild', 'baixa'), alta: await G(pg, 'doBuild', 'alta') };
  anotarErros();
  marcar('carga e sonda');
  // a sonda vale para o teste inteiro: sem MSAA quando pedido, as medidas com "MSAA forçado" não medem nada
  const sondaOk = sonda.com && sonda.com.antialias === true && sonda.com.samples === 4 && sonda.sem && sonda.sem.samples === 0;
  meta('S', 'Sonda: contexto com antialias pedido (SwiftShader)', `com: antialias ${sonda.com?.antialias} SAMPLES ${sonda.com?.samples} (MAX ${sonda.com?.maxSamples}) · sem: SAMPLES ${sonda.sem?.samples} · ${sonda.com?.renderer}`,
    'true/4 e 0 (senão o teste é INVÁLIDO)', sondaOk, 'estrutura');
  if (!sondaOk) invalido = 'o SwiftShader não deu SAMPLES 4 com antialias pedido';
  if (so.has('S')) {
    const fx = b => `antialias ${b.antialias} SAMPLES ${b.samples} · buffer ${b.W}×${b.H} (pr ${b.pr})`;
    meta('S', 'Build: Média (844×390 dpr 2)', fx(build.media), 'true/4', build.media.antialias === true && build.media.samples === 4);
    meta('S', 'Build: Baixa', fx(build.baixa), 'false/0', build.baixa.antialias === false && build.baixa.samples === 0);
    meta('S', 'Build: Alta (só informação)', fx(build.alta), '—', null, 'info');
    meta('S', 'Build: ?aa=0 na Média', fx(buildPar['?aa=0']), 'SAMPLES 0', buildPar['?aa=0'].samples === 0);
    meta('S', 'Build: ?aa=1 na Baixa', fx(buildPar['?aa=1']), 'SAMPLES 4', buildPar['?aa=1'].samples === 4);
    meta('S', 'Build: ?gfx=antigo na Média', fx(buildPar['?gfx=antigo']), 'SAMPLES 0', buildPar['?gfx=antigo'].samples === 0);
    guarda('S.media.samples', build.media.samples); guarda('S.baixa.samples', build.baixa.samples);
  }
  if (invalido) throw new Error('sonda');

  const asp = info.w / info.h;
  const P = posesTV(asp, true), topo = posesTopo(asp);
  const precisaMedia = ['A', 'F', 'G', 'D', 'N'].some(s => so.has(s));
  if (precisaMedia) {
    const im1 = await G(pg, 'novaCena', 'm1', { q: 'media', hora: 'dia', aa: true });
    const im0 = await G(pg, 'novaCena', 'm0', { q: 'media', hora: 'dia', aa: false });
    await G(pg, 'novoCampo', 'cm', { q: 'media', cena: 'm1' });
    if (im1.samples !== 4 || im0.samples !== 0 || im1.W !== im0.W) throw new Error(`contextos forçados: ${JSON.stringify([im1, im0])}`);
    const W = im1.W, H = im1.H;
    const mb = build.media.antialias ? 'm1' : 'm0';
    marcar('cenas da Média');

    // ---- G (dia, Média)
    if (so.has('G')) {
      const M = await medirG(pg, 'cel-media-dia', mb, 'cm', P, topo);
      g1Dia = (M.gm12 ?? M.gm)?.g1 ?? null;
      metasG('celular Média, dia', 'media.dia', M);
      // G6 (a revisão do C4–C8): a régua NOVA é o quadro como ele sai (com o termo de profundidade) sem uma QUADRÁTICA em x e z
      // — o termo e o ângulo da vista são curvas suaves em z, e uma foto real também as tem: só assim o número se compara com
      // o de uma foto. A meta 0,010 ± 0,004 é PROVISÓRIA (o ponto de partida; a régua da foto em blocos de 8 m nunca foi refeita
      // e o C6 calibrou o uManchas contra ela): INFORMATIVA até a régua da foto, e a comparação k 0,10 × 0,17 vai ao dono
      // (PLANO-GRAFICOS.md §4 e §7). O piso da régua (o quadro sem as manchas: só o termo e o grão) mostra que a quadrática
      // tira o termo; a régua do C6 (o quadro sem o termo, sem um plano) fica ao lado
      const g6 = M.gm?.g6;
      if (g6) {
        guarda('G6.media.dia.sigmaQ', g6.sigmaQ);
        comoInfo(() => meta('G', 'G6 σL das manchas, blocos de 8 m, sem uma quadrática em x e z (a régua nova; o quadro com o termo)', `${f(g6.sigmaQ, 4)} (${g6.blocos} blocos)`,
          '0,010 ± 0,004 PROVISÓRIA (a régua da foto não foi refeita: informativa)', Math.abs(g6.sigmaQ - 0.010) <= 0.004));
      } else meta('G', 'G6 σL das manchas (celular Média, dia)', 'não medido', '0,010 ± 0,004 provisória', null, 'info');
      if (M.gm12?.g6) { guarda('G6.media.dia.pisoQ', M.gm12.g6.sigmaQ); meta('G', 'G6 o piso da régua nova: o quadro sem as manchas (o termo e o grão), sem a quadrática', `${f(M.gm12.g6.sigmaQ, 4)} (${M.gm12.g6.blocos} blocos)`, 'informativo (o grão e o resto do termo depois da quadrática: em quadratura com as manchas, ~2% do σ)', null, 'info'); }
      const g6c6 = (M.gmSem ?? M.gm)?.g6;
      if (g6c6) { guarda('G6.media.dia.sigma', g6c6.sigma); meta('G', `G6 a régua do C6: sem um plano${M.gmSem ? ', o quadro sem o termo' : ''}`, `${f(g6c6.sigma, 4)} (${g6c6.blocos} blocos)`, 'informativo (a régua com que o C6 calibrou o uManchas)', null, 'info'); }
      // G7: a classe medida de cada faixa contra o gramado.js faixaEm
      if (M.gm && (info.faixaEm || typeof GR_NODE?.faixaEm === 'function')) {
        const xs = [];
        for (let x = -5300; x <= 5300; x++) xs.push(x / 100);
        let par;
        if (typeof GR_NODE?.faixaEm === 'function') par = xs.map(x => { const v = GR_NODE.faixaEm(x); return v && typeof v === 'object' ? ('claro' in v ? (v.claro ? 1 : 0) : ((v.paridade ?? v.indice ?? 0) & 1) + 2) : typeof v === 'boolean' ? (v ? 1 : 0) : (v & 1) + 2; });
        else par = await G(pg, 'faixas', xs);
        const parEm = x => par[Math.max(0, Math.min(par.length - 1, Math.round(x * 100) + 5300))];
        // por pixel fora da borda (±0,3 m pela própria faixaEm): a classe da faixa medida × a da faixaEm
        const { X, kp, classe } = M.gm;
        const conta = new Map();
        for (let i = 0; i < kp.length; i++) {
          if (kp[i] < 0 || classe[kp[i]] < 0) continue;
          const x = X[i], p = parEm(x);
          if (parEm(x - 0.3) !== p || parEm(x + 0.3) !== p) continue;
          const ch = `${p}:${classe[kp[i]]}`; conta.set(ch, (conta.get(ch) ?? 0) + 1);
        }
        let total = 0, certos = 0;
        const temClaro = [...conta.keys()].some(k => k.startsWith('0:') || k.startsWith('1:'));
        if (temClaro) { for (const [k, n] of conta) { total += n; const [p, c] = k.split(':').map(Number); if (p === c) certos += n; } }
        else {
          // paridade sem dizer qual é clara: a correspondência pela maioria
          const a = (conta.get('2:0') ?? 0) + (conta.get('3:1') ?? 0), b = (conta.get('2:1') ?? 0) + (conta.get('3:0') ?? 0);
          total = a + b; certos = Math.max(a, b);
        }
        guarda('G7.media.dia.acerto', total ? certos / total : NaN);
        meta('G', 'G7 GPU = JS (classe da faixa × gramado.js faixaEm)', `${pct(total ? certos / total : NaN, 2)} de ${total} px${temClaro ? '' : ' (paridade pela maioria)'}`, '100% fora da borda', total > 0 && certos === total);
      } else meta('G', 'G7 GPU = JS (gramado.js faixaEm)', 'sem gramado.js faixaEm nesta versão', 'estrutural (C4 em diante)', null, 'info');

      // G4b: o L do gramado no foco nas outras câmeras, com × sem o termo de profundidade, e o salto no corte TV → 1ª pessoa
      const PB = posesG4b(info.consts, asp, P.foco.para);
      const temGancho = await G(pg, 'semProfundidade', 'cm', false);
      const linhas = [];
      const Lsem = {};
      let piorDif = 0;
      const comSem = async (pose, nomePrint = null) => {
        const Lc = Lfoco(await quadro(pg, mb, 'cm', pose, { so: ['gramado'], semCeu: true }, nomePrint), pose);
        let Ls = Lc;
        if (temGancho) { await G(pg, 'semProfundidade', 'cm', true); try { Ls = Lfoco(await quadro(pg, mb, 'cm', pose, { so: ['gramado'], semCeu: true }), pose); } finally { await G(pg, 'semProfundidade', 'cm', false); } }
        return { Lc, Ls };
      };
      for (const [nome, pose] of Object.entries(PB)) {
        const { Lc, Ls } = await comSem(pose, `cel-media-dia-G4b-${nome}`);
        Lsem[nome] = Ls.L;
        guarda(`G4b.media.dia.${nome}.L`, Lc.L);
        const d = Lc.L - Ls.L; piorDif = Math.max(piorDif, Math.abs(d));
        linhas.push(`${nome} ${f(Lc.L)}${temGancho ? ` (${d >= 0 ? '+' : ''}${f(d, 4)})` : ''}`);
      }
      meta('G', 'G4b L do gramado no foco nas outras câmeras', `${linhas.join(' · ')}${temGancho ? '' : ' · sem o gancho semProfundidade: nada a comparar'}`, 'com − sem o termo ≤ 0,005 em todas',
        temGancho ? piorDif <= 0.005 : null, temGancho ? 'meta' : 'info');
      // o corte TV (o gol no foco) → 1ª pessoa: o salto do L no meio da tela. A meta é a parte do TERMO no salto, com − sem
      // (item 16 da revisão: as duas janelas veem pedaços diferentes das manchas, e com as manchas do C6 o salto bruto oscila
      // perto do 0,01 sem o termo ter culpa); o salto bruto e a referência ficam informativos
      const tv = await comSem(P.foco);
      const L1p = valores['G4b.media.dia.replay-1a-pessoa.L'];
      const salto = Math.abs(L1p - tv.Lc.L);
      const saltoTermo = (L1p - tv.Lc.L) - (Lsem['replay-1a-pessoa'] - tv.Ls.L);
      guarda('G4b.media.dia.salto', salto); guarda('G4b.media.dia.saltoTermo', saltoTermo);
      const refSalto = REF?.valores?.['G4b.media.dia.salto'];
      meta('G', 'G4b salto do L no corte TV → 1ª pessoa, bruto', `${f(salto, 4)} (TV ${f(tv.Lc.L)} → 1ª pessoa ${f(L1p)})${Number.isFinite(refSalto) ? ` · ref ${f(refSalto, 4)}` : ''}`, 'informativo', null, 'info');
      meta('G', 'G4b a parte do termo no salto TV → 1ª pessoa (com − sem o termo)', `${f(saltoTermo, 4)}${temGancho ? '' : ' (sem o gancho: a versão não tem o termo, 0)'}`, '|com − sem| ≤ 0,01',
        Math.abs(saltoTermo) <= 0.01);
      marcar('G (Média, dia)');
    }

    // ---- A (dia e noite, Média)
    if (so.has('A')) {
      await secaoA(pg, 'cel-media-dia', 'media.dia', 'm1', 'm0', 'cm', P, build.media.antialias);
      marcar('A (Média, dia)');
    }

    // ---- F (Média)
    if (so.has('F')) {
      const F = await secaoF(pg, 'cel-media', mb, 'm0', 'cm', P, W, H, mb === 'm1' ? 'm0' : 'm1');
      metasF('celular Média', F, 'media');
      // o outro contexto (na main, o MSAA forçado: o que a Média ganha no C5), informativo
      comoInfo(() => metasF(`celular Média, o outro contexto: ${mb === 'm1' ? 'sem AA' : 'MSAA forçado'}`, F, 'mediaOutro', 'extra'));
      // sobre o gramado (informativa; a revisão do bloco 3): a guarda continua a do preto
      const Fg = await secaoF(pg, 'cel-media-grama', mb, 'm0', 'cm', P, W, H, null, ['foco', 'la'], true);
      comoInfo(() => metasF('celular Média, sobre o gramado: o grão e a sombra atrás da peça entram na conta', Fg, 'mediaGrama'));
      marcar('F (Média)');
    }

    // ---- D (grão, Média, dia): E e cintilação por faixa da tela, contra o SSAA com o MESMO LOD (item 8 da revisão: o SSAA 3×
    // desce o mip em log2 3 e o build "cintilava menos que o ideal", × 0,66–0,84) e entre as faixas do próprio build
    if (so.has('D')) {
      const pose = P.meio, B = baseCam(pose, W, H), cRef = projetar(B, [0, 0, 0]).c;
      const d0 = (0.25 * 2 * cRef * B.tanV) / H;
      // as faixas da tela pela distância: z de 22 (o pé da tela) a −34 (a lateral de lá), em 5 faixas
      const ZB = [22, 10, 0, -12, -24, -34], nb = ZB.length - 1, bandas = Array.from({ length: nb }, () => ({ e: 0, n: 0, vb: [], vs: [] }));
      const { X, Z } = mapaChao(B);
      const banda = new Int8Array(W * H).fill(-1);
      for (let i = 0; i < W * H; i++) if (Math.abs(X[i]) <= 50) for (let k = 0; k < nb; k++) if (Z[i] <= ZB[k] && Z[i] > ZB[k + 1]) { banda[i] = k; break; }
      const quadrosB = [], quadrosS = [];
      for (let q = 0; q < NQ_D; q++) {
        const pq = deslocaCam(pose, B, 'h', q * d0);
        quadrosB.push(await quadro(pg, mb, 'cm', pq, { so: ['gramado'], semCeu: true }));
        quadrosS.push(await quadro(pg, 'm0', 'cm', pq, { so: ['gramado'], semCeu: true, escala: 'lod', fisico: true }));
      }
      // amostra de 1 a cada 3 pixels (a cintilação por pixel nos NQ_D quadros)
      for (let i = 0; i < W * H; i += 3) {
        const b = banda[i]; if (b < 0) continue;
        const vb = quadrosB.map(I => (I.px[4 * i] + I.px[4 * i + 1] + I.px[4 * i + 2]) / 3), vs = quadrosS.map(I => (I.px[4 * i] + I.px[4 * i + 1] + I.px[4 * i + 2]) / 27);
        for (let k = 0; k < NQ_D; k++) { bandas[b].e += ((vb[k] - vs[k]) / 255) ** 2; bandas[b].n++; }
        const mb_ = media(vb), ms_ = media(vs);
        bandas[b].vb.push(Math.sqrt(media(vb.map(v => (v - mb_) ** 2)))); bandas[b].vs.push(Math.sqrt(media(vs.map(v => (v - ms_) ** 2))));
      }
      const R = bandas.map(b => ({ E: Math.sqrt(b.e / Math.max(1, b.n)), cb: media(b.vb), cs: media(b.vs) }));
      const txt = R.map((r, k) => {
        guarda(`D.media.dia.b${k}.E`, r.E); guarda(`D.media.dia.b${k}.cint`, r.cb / r.cs); guarda(`D.media.dia.b${k}.cintBuild`, r.cb);
        return `z ${ZB[k]}…${ZB[k + 1]} E ${f(r.E, 4)} cint × ${f(r.cb / r.cs, 2)} (${f(r.cb, 2)}/255)`;
      }).join(' · ');
      meta('D', 'Grão: E e cintilação contra o SSAA do MESMO LOD (÷ a dele) por faixa da tela, de perto para longe', txt, 'informativa (só reprova se o filtro do passo 4 entrar)', null, 'info');
      // o critério do passo 4 entre as faixas do PRÓPRIO build: o longe (z −24…−34) × o perto do foco (z 10…0)
      const rE = R[4].E / R[1].E, rC = R[4].cb / R[1].cb;
      guarda('D.media.dia.longePertoE', rE); guarda('D.media.dia.longePertoCint', rC);
      meta('D', 'Grão: o longe × o perto do foco no próprio build (o critério do passo 4)', `E × ${f(rE, 2)} · cintilação × ${f(rC, 2)} (longe ÷ perto)`, 'informativa (o filtro do passo 4 só entra se o longe passar do perto)', null, 'info');
      marcar('D (grão)');
    }

    // ---- N: noite (Média) e Baixa
    if (so.has('N')) {
      // noite, Média: G1–G5 e A
      for (const c of ['m1', 'm0']) await G(pg, 'hora', c, 'cm', 'noite');
      const Mn = await medirG(pg, 'cel-media-noite', mb, 'cm', P, topo);
      metasG('celular Média, noite', 'media.noite', Mn, { secao: 'N', semG1: true, linhaSo97: true });
      // Δh (noite − dia) contra o que o cor-aces PREVÊ para o albedo em uso (item 7 da revisão: com a referência ± 2°, as cores
      // do C6 caíam no limite — a luz fria gira mais um verde mais amarelo, 3,3° → 5,3°): o albedo de cada classe sai do dia
      // medido pela inversa exata do ACES e da luz do dia, e vai à luz da noite com o poço do foco
      const g1n = (Mn.gm12 ?? Mn.gm)?.g1, hNoite = g1n?.h;
      if (g1Dia && Number.isFinite(hNoite)) {
        const dh = difMatiz(hNoite, g1Dia.h), pr = preverNoite(g1Dia), dhPrev = difMatiz(pr.h, g1Dia.h);
        guarda('N.media.dhNoiteDia', dh); guarda('N.media.dhPrevisto', dhPrev);
        const ref = REF?.valores?.['N.media.dhNoiteDia'];
        meta('N', 'Δh (noite − dia), celular Média, contra a previsão do cor-aces', `${f(dh, 2)}° · previsto ${f(dhPrev, 2)}° (noite prevista L ${f(pr.L)} C ${f(pr.C)} h ${f(pr.h, 1)}° · medida L ${f(g1n.L)} C ${f(g1n.C)} h ${f(hNoite, 1)}°)${Number.isFinite(ref) ? ` · ref ${f(ref, 2)}°` : ''}`,
          'o previsto ± 0,5°', Math.abs(dh - dhPrev) <= 0.5);
      } else meta('N', 'Δh (noite − dia), celular Média', 'sem o dia medido (rode com a seção G)', 'o previsto ± 0,5°', null, 'info');
      await secaoA(pg, 'cel-media-noite', 'media.noite', 'm1', 'm0', 'cm', P, build.media.antialias, { secao: 'N' });
      for (const c of ['m1', 'm0']) await G(pg, 'hora', c, 'cm', 'dia');
      marcar('N (Média, noite)');
    }
    await G(pg, 'liberar', 'm1'); await G(pg, 'liberar', 'm0');

    if (so.has('N')) {
      // Baixa: o contexto sem AA (o build) e o com MSAA (a queda: a Baixa no canvas da Média)
      const ib0 = await G(pg, 'novaCena', 'b0', { q: 'baixa', hora: 'dia', aa: false });
      await G(pg, 'novaCena', 'b1', { q: 'baixa', hora: 'dia', aa: true });
      await G(pg, 'novoCampo', 'cb', { q: 'baixa', cena: 'b0' });
      const bb = build.baixa.antialias ? 'b1' : 'b0';
      const Wb = ib0.W, Hb = ib0.H;
      const Mb = await medirG(pg, 'cel-baixa-dia', bb, 'cb', P, topo);
      metasG('celular Baixa, dia', 'baixa.dia', Mb, { secao: 'N' });
      // a Baixa sem MSAA: a razão é 1 por construção; o "nada pior" contra a referência fica informativo (plano §4)
      await secaoA(pg, 'cel-baixa-dia', 'baixa.dia', 'b1', 'b0', 'cb', P, build.baixa.antialias, { secao: 'N', nadaPior: true, tipo: 'info' });
      // + a pose do LIMIAR (a revisão do bloco 3): a corda do pé de perto, com a meia largura de 1 px (o limiar que a mistura
      // tinha) caindo DENTRO da peça — o caso que abria o buraco onde a meia interpolada passava por 0 (a TV fica abaixo do
      // limiar nas duas pontas e não o via)
      const pl = poseLimiar(), mp = meiaNasPontas(pl, Wb, Hb);
      const Fb = await secaoF(pg, 'cel-baixa', bb, 'b0', 'cb', { ...P, limiar: pl }, Wb, Hb, 'b1', ['foco', 'la', 'limiar']);
      if (Fb.limiar) Fb.limiar.nota = `meia largura nas pontas da corda ${f(mp[0], 2)} / ${f(mp[1], 2)} px`;
      meta('F', 'Finos (celular Baixa): a pose do limiar cruza 1 px dentro da corda do pé', `meia largura nas pontas ${f(mp[0], 2)} / ${f(mp[1], 2)} px`,
        'uma ponta acima de 1 px e a outra abaixo', Math.max(...mp) > 1 && Math.min(...mp) < 1, 'estrutura');
      metasF('celular Baixa', Fb, 'baixa');
      // a "Baixa com MSAA" da queda: as mesmas metas no outro contexto (a TV); a pose do limiar ali é INFORMATIVA — a A2C não tem
      // limiar (contínua em k = 1) e as cordas dessa pose têm 1,2–2,3 px (não crescem): o que ela mede é o MSAA 4× numa peça de
      // 1–2 px contra o SSAA 3×3 (×2,67 a corda do fundo, igual no HEAD do C10; a escolha da mistura analítica também com MSAA
      // é do C14, com a do gol de lá)
      metasF('celular Baixa com MSAA (a queda)', { foco: Fb.foco, la: Fb.la }, 'baixaMsaa', 'extra');
      if (Fb.limiar) comoInfo(() => metasF('celular Baixa com MSAA (a queda), sem limiar na A2C', { limiar: Fb.limiar }, 'baixaMsaa', 'extra'));
      await G(pg, 'liberar', 'b0'); await G(pg, 'liberar', 'b1');
      marcar('N (Baixa)');
    }
  }
  anotarErros();
} catch (e) {
  if (!invalido) meta('—', 'Rodou (celular)', e.message.split('\n')[0], 'sem erro', false, 'estrutura');
} finally {
  for (const s of sessoes.splice(0)) await s.navegador.close();
}

// ================================================================== PC 1280×720 Alta, dia e noite
if (so.has('N') && !invalido) {
  let pc = null;
  try {
    pc = await abrirPagina(PC);
    const pg = pc.pagina;
    const info = await pc.ir('');
    const bAlta = await G(pg, 'doBuild', 'alta');
    await G(pg, 'novaCena', 'a1', { q: 'alta', hora: 'dia', aa: true });
    await G(pg, 'novaCena', 'a0', { q: 'alta', hora: 'dia', aa: false });
    await G(pg, 'novoCampo', 'ca', { q: 'alta', cena: 'a1' });
    const ab = bAlta.antialias ? 'a1' : 'a0';
    const asp = info.w / info.h, P = posesTV(asp, false), topo = posesTopo(asp);
    // a meta da G4 no PC (a revisão do C4–C8): a da foto é da TV a ~15° (a do celular); a 24,6° o MESMO termo dá outro
    // gradiente — a meta do celular × modelo(PC) ÷ modelo(celular), o modelo pela conta do F6 do teste-gramado
    const mPC = termoModelo(P.meio), mCel = termoModelo(posesTV(CEL.w / CEL.h, true).meio);
    const alvoG4 = Number.isFinite(mPC) && Number.isFinite(mCel) && mCel > 0
      ? { v: 0.026 * mPC / mCel, txt: `a meta do celular × o modelo do ângulo (PC ${f(mPC, 4)} ÷ celular ${f(mCel, 4)} = × ${f(mPC / mCel, 2)})` } : null;
    if (alvoG4) guarda('G4.alta.alvo', alvoG4.v);
    for (const hora of ['dia', 'noite']) {
      if (hora === 'noite') for (const c of ['a1', 'a0']) await G(pg, 'hora', c, 'ca', 'noite');
      const M = await medirG(pg, `pc-alta-${hora}`, ab, 'ca', P, topo);
      metasG(`PC Alta, ${hora}`, `alta.${hora}`, M, { secao: 'N', semG1: hora === 'noite', linhaSo97: hora === 'noite', alvoG4 });
      await secaoA(pg, `pc-alta-${hora}`, `alta.${hora}`, 'a1', 'a0', 'ca', P, bAlta.antialias, { secao: 'N', nadaPior: true });
    }
    for (const e of pc.erros.splice(0)) if (!/status of 404/.test(e)) errosConsole.push(e);
    for (const u of pc.outros404.splice(0)) errosConsole.push(`404: ${u}`);
    marcar('N (PC Alta)');
  } catch (e) {
    meta('—', 'Rodou (PC)', e.message.split('\n')[0], 'sem erro', false, 'estrutura');
  } finally {
    if (pc) await pc.navegador.close();
  }
}
await srv.fechar();

if (errosConsole.length) meta('—', 'Sem erro no console', errosConsole.slice(0, 3).join(' | ').slice(0, 300), 'nenhum', false, 'estrutura');

// ------------------------------------------------------------------ a referência
if (gravar && !invalido) {
  let tudo = {};
  try { tudo = JSON.parse(fs.readFileSync(ARQ_REF, 'utf8')); } catch (_) { tudo = {}; }
  let commit = '';
  try { commit = execFileSync('git', ['-C', raiz, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { commit = ''; }
  // com --so parcial, junta com o que já estava gravado (as outras seções ficam)
  const antes = so.size < SECOES.length ? tudo[CHAVE_REF] : null;
  const secoes = new Set([...(antes?.secoes ? antes.secoes.split(',') : []), ...so]);
  // (os outros campos do registro — notas à mão, histórico — ficam em toda gravação, também com --so)
  const extras = Object.fromEntries(Object.entries(tudo[CHAVE_REF] ?? {}).filter(([k]) => !['gravado', 'commit', 'secoes', 'chromium', 'renderer', 'nota', 'valores'].includes(k)));
  tudo[CHAVE_REF] = {
    gravado: new Date().toISOString().slice(0, 10), commit, secoes: SECOES.filter(x => secoes.has(x)).join(','), chromium: cond.chromium, renderer: cond.renderer,
    nota: 'valores AGREGADOS do teste-graficos-celular (nunca hash de pixels); as guardas "nada pior" comparam com eles',
    valores: { ...(antes?.valores ?? {}), ...valores },
    ...extras,
  };
  fs.mkdirSync(path.dirname(ARQ_REF), { recursive: true });
  fs.writeFileSync(ARQ_REF, JSON.stringify(tudo, null, 2) + '\n');
}
if (arqJson) fs.writeFileSync(arqJson, JSON.stringify({ cond, valores, res }, null, 2) + '\n');

// ------------------------------------------------------------------ a tabela
const est = m => (m.ok === null ? 'INFO    ' : m.ok ? 'PASSOU  ' : m.tipo === 'estrutura' || valendo ? 'REPROVOU' : 'FORA    ');
const w0 = Math.max(...res.map(m => m.nome.length)), w1 = Math.min(140, Math.max(...res.map(m => m.medido.length)));
for (const m of res) console.log(`${est(m)} | ${m.secao.padEnd(1)} | ${m.nome.padEnd(w0)} | ${m.medido.padEnd(w1)} | ${m.alvo}`);
const fora = res.filter(m => m.ok === false && m.tipo === 'meta').length;
const estrutura = res.filter(m => m.ok === false && m.tipo === 'estrutura').length;
console.log(`\nChromium ${cond.chromium} · ${cond.renderer}`);
if (REF) console.log(`referência: ${ARQ_REF} (${REF.gravado}, ${REF.commit || 'sem commit'}; Chromium ${REF.chromium})${tolRef() > 1 ? ' — RENDERIZADOR DIFERENTE do gravado: as guardas "nada pior" com +50% de tolerância' : versaoDif() ? ' — Chromium diferente do gravado (só aviso: a tolerância não muda)' : ''}`);
else console.log('referência: nenhuma gravada (as guardas "nada pior" ficam informativas; grave com --gravar-referencia na main)');
if (gravar && !invalido) console.log(`referência gravada em ${ARQ_REF} (${Object.keys(valores).length} valores)`);
console.log(`tempos: ${tempos.join(' · ')} · total ${((Date.now() - T0) / 1000).toFixed(0)} s`);
if (invalido) { console.log(`\nteste-graficos-celular: TESTE INVÁLIDO (${invalido})`); process.exit(1); }
if (estrutura) { console.log(`\nteste-graficos-celular: REPROVOU (${estrutura} falha(s) de estrutura)`); process.exit(1); }
if (valendo) { console.log(fora ? `\nteste-graficos-celular: REPROVOU (${fora})` : '\nteste-graficos-celular: PASSOU'); process.exit(fora ? 1 : 0); }
console.log(`\nteste-graficos-celular: INFORMATIVO (${fora} meta(s) fora; as metas valem com --valendo, a partir do C14)`);
process.exit(0);
