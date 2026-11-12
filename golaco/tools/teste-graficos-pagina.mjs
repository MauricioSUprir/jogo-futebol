// Gráficos do celular pela PÁGINA (item 45, caminho B do plano; `golaco/PLANO-GRAFICOS.md` §4): o jogo de verdade
// (index.html) num Chromium com WebGL de verdade (SwiftShader). O par do teste-graficos-celular (o caminho A, pelos módulos):
// aqui entram o que só a página tem — os jogadores, a bola, a torcida, as placas e as bandeiras no mesmo quadro, o painel, a
// troca de qualidade, a perda de contexto, a queda, o redimensionar e o ritmo dos desenhos.
//
// O antisserrilhado é FORÇADO por um addInitScript sobre o getContext do #tela (vale na main, que não tem ?aa; o canvas
// recriado pelo cena.js leva o mesmo id e o mesmo pedido): a carga "oposta" tem o antisserrilhado contrário ao do build e a
// carga "igual" o mesmo do build. As medidas de pixel comparam QUADROS DE CARGAS DIFERENTES, então o instante é o mesmo em
// todas: o relógio manual é alinhado num valor fixo (a torcida anda no relógio do desenho, performance.now; sem o alinhamento
// as cargas diferem em ~9% dos pixels), tudo o que é sob demanda chega antes, a semente é fixa e a câmera é a livre (as poses
// da TV do celular pelas funções puras de render/enquadramento.js). A carga "igual" tem de dar o MESMO quadro do build, bit a
// bit (senão a A2 e a K não medem nada: falha de estrutura). Os quadros isolados (só a torcida, só as bandeiras, só o gramado)
// são o MESMO quadro desenhado de novo pelo renderizador da página com os outros objetos escondidos (o renderizador, a cena e a
// câmera pegos pelo Scene.onBeforeRender no g.desenhar()).
//
// Seções (`--so S2,A2,K,P,P2,P3,R,Q,Z,T`; tabela no plano §4):
//   S2 sonda na página: o contexto com antialias pedido dá true/4 (senão o TESTE É INVÁLIDO). O build: celular 844×390 dpr 2
//      Média 4; tablet 1366×1024 com toque e dpr 2 na Média 0 (o teto de ~1,2 MP); ?aa=1 no tablet 4; PC 1280×720 Média 4.
//   A2 serrilhado do quadro inteiro (jogadores, bola, torcida, placas) em duas poses da TV do celular ('jogo' na bola e 'area'
//      com o gol no foco): máscara geométrica |MSAA − sem AA| > 0,01 (o build × a carga oposta; dos quadros FÍSICOS pelo gancho
//      `__golaco.graficos.fisico` do C9/C10, quando existir), E = RMS(quadro − SSAA 3×3) só na máscara, com o SSAA do MESMO LOD
//      (9 desenhos 1× com a câmera a −⅓, 0, +⅓ px) e físico, razão E_build / E_semAA. Meta Média ≤ 0,6 (na main a Média é a
//      sem AA: 1).
//   K  recortes e silhuetas. (1) franjas: os pixels de borda (a máscara da A2) dentro da torcida, das bandeiras (as de mastro, as
//      faixas da mureta, os bandeirões e as do escanteio), das placas e, no pré-jogo, do letreiro da fachada, cuja cor no quadro
//      com MSAA não é mistura (no espaço da cor guardada) das cores vizinhas (5×5) do quadro sem AA — distância OKLab > 0,03.
//      A meta conta só as bordas com o centro do pixel FORA da região (a amostra extrapolada, o N11, o que o `centroid` muda):
//      ≤ 0,2% delas e ≤ o da main com o MSAA forçado (a referência); com o centro DENTRO, a franja é o fundo escondido na mistura
//      do MSAA (o piso da medida) e fica informativa. (2) a cobertura das bandeiras de mastro a 50 e a
//      100 m (só a malha delas, sobre magenta, com o bandeirão da saída já fechado): pixels visivelmente cobertos (> 40/255 do
//      fundo) no build ÷ no SSAA reduzido, nas caixas das 16 bandeiras da Média. Meta ≥ 0,8. (3) a A2C da torcida
//      (informativa): cobertura ÷ SSAA e a cintilação da silhueta em dois quadros com a câmera andando 0,25 px.
//   P  chamadas e triângulos no quadro fixo da TV ('jogo') = a referência (+0; triângulos ≤ +1%); CPU do quadro (medirQuadro
//      sem a GPU, CPU 4×, com a demo, como o teste-desempenho-celular) PAREADA: com `--base <pasta golaco>`, a versão medida e
//      a base abertas juntas e ≥ 5 janelas de 400 quadros de cada, alternadas; meta: a mediana das diferenças por par ≤ +1,0
//      ms (a main contra ela mesma chega a +0,7: o efeito é da instância do navegador). O "≤ 6 ms" absoluto e o desenho (a
//      parte JS do render) informativos. A CPU NÃO vai à referência (é da máquina).
//   P2 ?perf=1 e ?qps=1 na tela antes do jogo (?prepartida=1): __golaco.perf(); o painel com p95, fase, AA, buffer, GPU e
//      refresh; visível POR CIMA na tela antes do jogo, na pausa e no replay (a pilha do ponto — elementsFromPoint — com toda
//      camada recebendo toque e nenhuma `inert` durante a leitura, e só tapa a camada que PINTA ali: sem isso o véu e a marca
//      REPLAY não contavam, e a camada transparente de tela inteira contaria); o qps mostrado na tela = os desenhos de verdade
//      (0,8–1,25 ×, com um rAF falso a 60 Hz: a tela desenha 30; na main o painel soma o dt de 1 quadro do navegador por
//      desenho e mostra 60). O painel NÃO pega toque (a revisão do bloco 4): em 5 pontos de cada botão de toque e do analógico
//      no jogo (844×390, 667×375, 568×320) e de cada controle das Opções da pausa (844×390, 568×320), o elementFromPoint de
//      verdade nunca é ele (e ele passa por cima de algum alvo: senão a guarda não prova nada).
//   P3 ?gfx=antigo: SAMPLES 0 na Média, o gramado da página (G1–G5 da página, só o gramado e as linhas na pose do meio) = a
//      referência da main e o TEXTO dos programas da torcida e das bandeiras = o da main (FNV-1a; a revisão do bloco 3: o C10
//      não lia o ?gfx=antigo); ?tom=neutro: NeutralToneMapping e a exposição = a do ACES × 1,40 de dia e de noite, também depois do
//      definirHora e de uma recriação (Média → Alta → Baixa recria nas duas versões).
//   R  recriação e contexto. (1) celular com a tela antes do jogo, pelo ≡ → Opções: Média → Baixa → Média com SAMPLES 4 → 0 →
//      4, o canvas novo com o aria-label e o inert de antes, a tela "Ajustando…" à vista e fora, a mira da falta desenha depois;
//      com o módulo da mira baixado ANTES das trocas, o programa dela já está no renderizador novo sem ela ser desenhada (C12);
//      a mensagem POR CIMA do painel ?perf (a pilha do ponto em 5 pontos da linha dela) e, durante a troca, a pausa inert e o
//      foco na tela de carregar, de volta na pausa no fim (a revisão do bloco 4).
//      (2) PC Alta → Baixa com ?prejogo=1 (o vão das placas aberto): localClippingEnabled do vão e o aria-label continuam. (3)
//      __golaco.definirQualidade troca e desenha no mesmo evaluate (o quadro não preto; SAMPLES pela tabela). (4)
//      WEBGL_lose_context: os ganchos ESTRAGADOS antes (a A2C ao contrário, o uAlturaBuffer em −1), perde e restaura — o quadro
//      desenha, os ganchos rodam de novo (A2C dos finos e da torcida = SAMPLES ≥ 2; o uAlturaBuffer = drawingBufferHeight é
//      estrutura: o onBeforeRender o refaz a cada desenho), a mira com programa no contexto restaurado antes de ser desenhada (a
//      linha escondida durante a perda; C12) e depois desenha. (5) o KHR_parallel_shader_compile FALSO (a GPU nunca diz
//      "pronto": o compileAsync nunca resolve, como com o contexto perdido): a carga com a tela cedo chega ao pronto e a troca
//      pela pausa no jogo termina (o prazo de 3 s do compilarAntesDoDesenho); no meio dela, Esc e Esc (uma troca) e P (a outra)
//      não fecham a pausa nem andam o tick (a revisão do bloco 4). As trocas esperam terminar (teto de 90 s; a que não termina reprova). 0 erro no
//      console.
//   Q  queda: a natural com webdriver (rAF falso a 20 Hz com tremor, sem ?q, 8,6 s) cai na sessão e NÃO grava (a recarga abre
//      na Média); com o teto (C13), a 120 Hz por 8,6 s (60 desenhos) não cai; __golaco.quedaDeTeste(): o mesmo canvas, 'baixa',
//      SAMPLES continua 4, a queda nas preferências e na linha da pausa; a recarga em Automática abre na Baixa com SAMPLES 0;
//      escolher a Média apaga.
//   Z  redimensionar: atribuições a canvas.width/height do #tela (contadas pelo addInitScript) com o mesmo tamanho (resize e
//      visualViewport) e com um tamanho novo (espera a janela e o buffer mudarem). Metas 0 e 2 (main: 8 e até 8).
//   T  teto: um rAF falso (tempo virtual) a 90, 120, 144 e 165 Hz conta os desenhos do #tela por segundo: celular 90 / 60 / 72
//      / 82,5 ± 1 em intervalos regulares; PC sem toque a 144 Hz, sem teto. O painel (__golaco.perf().refresh, o C11) diz a tela
//      medida e o n do teto (90 → 1, 120/144/165 → 2; no PC null, "—"). A tela antes do jogo (?prepartida=1) segue no ritmo dela
//      a 144 e a 165 Hz: 28,8 e 33 desenhos por segundo, como sem o teto (pelo teto seriam 24 e 27,5). (Em T, na queda natural e no qps da P2 o render do
//      #tela só conta — o que se mede é quantas vezes a página desenha.)
//
// As seções que dependem de peças que ainda não existem (?aa, ?gfx, ?tom, ?perf, __golaco.perf, quedaDeTeste, o teto) RODAM na
// main e registram o estado de hoje, reprovando a meta como informativa.
//
// A referência (`--gravar-referencia`) grava em tools/dados/graficos-ref.json, chave "pagina" (a do teste-graficos-celular é
// "celular"), os valores AGREGADOS — nunca o hash dos pixels — com a versão do Chromium e o renderizador. As guardas "nada pior"
// comparam com ela; com OUTRO renderizador ganham +50% de tolerância e avisam; outra versão do Chromium só avisa. A referência
// é gravada com o Chromium do CI (o Playwright do `golaco-testes.yml`). As metas absolutas valem sempre.
//
// Informativo por enquanto (até o C14 do plano; `--informativo` é o padrão): imprime as metas e o estado e sai 0 (a sonda
// inválida e as falhas de estrutura — a página não abriu, as cargas não dão o mesmo quadro, erro no console — saem 1 sempre).
// `--valendo` faz as metas contarem.
//   node tools/teste-graficos-pagina.mjs [--raiz <pasta golaco>] [--base <pasta golaco da base>] [--janelas-cpu N]
//                                        [--so S2,A2,K,P,P2,P3,R,Q,Z,T] [--gravar-referencia] [--informativo | --valendo]
//                                        [--prints <pasta>] [--json <arquivo>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { oklab, decSrgb } from './lib/cor-aces.mjs';

const T0 = Date.now();
const args = process.argv.slice(2);
const tem = n => args.includes(n);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
// --base <pasta golaco>: a versão de base da CPU PAREADA (seção P: base e medida na mesma rodada, janelas alternadas)
const raizBase = arg('--base', '') ? path.resolve(arg('--base', '')) : null;
const JANELAS_CPU = Math.max(5, +arg('--janelas-cpu', 6) || 6);
// a folga do "nada pior" da CPU pareada: a main contra ela mesma deu +0,10, +0,30, +0,70, 0,00 e +0,20 ms (5 rodadas de 6
// pares, Chromium 141 do CI; uma rodada com os 6 pares ≥ 0 — o efeito é da INSTÂNCIA do navegador, não da janela, e alternar
// não o tira): o +0,2 ms do plano reprovava o mesmo código em 2 de 5 rodadas. Com +1,0 a guarda pega só a piora de ~15% para
// cima.
const TOL_CPU = 1.0;
const SECOES = ['S2', 'A2', 'K', 'P', 'P2', 'P3', 'R', 'Q', 'Z', 'T'];
const so = new Set((arg('--so', '') || SECOES.join(',')).split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
for (const s of so) if (!SECOES.includes(s)) { console.error(`teste-graficos-pagina: seção desconhecida "${s}" (${SECOES.join(', ')})`); process.exit(2); }
const gravar = tem('--gravar-referencia');
const valendo = tem('--valendo') && !tem('--informativo');
const pastaPrints = arg('--prints', '') ? path.resolve(arg('--prints', '')) : null;
const arqJson = arg('--json', '') ? path.resolve(arg('--json', '')) : null;
if (pastaPrints) fs.mkdirSync(pastaPrints, { recursive: true });
const ARQ_REF = path.join(RAIZ, 'tools', 'dados', 'graficos-ref.json');
const CHAVE_REF = 'pagina';

// ------------------------------------------------------------------ os módulos puros da versão medida (em Node)
const doJogo = p => import(pathToFileURL(path.join(raiz, p)).href);
const EQ = await doJogo('js/render/enquadramento.js');
const BD = await doJogo('js/render/bandeiras-dados.js');

// ------------------------------------------------------------------ resultados
const res = [];
const valores = {};
// as medidas que dependem da MÁQUINA (a CPU): só na saída e no --json, nunca na referência
const medidas = {};
/** Uma meta: tipo 'meta' (conta com --valendo), 'info' (só mostra), 'estrutura' (conta sempre: o teste valeu). */
function meta(secao, nome, medido, alvo, ok, tipo = 'meta') { res.push({ secao, nome, medido: String(medido), alvo, ok: ok === null ? null : !!ok, tipo }); }
const guarda = (k, v) => { if (Number.isFinite(v)) valores[k] = +(+v).toFixed(5); return v; };
const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));
const pct = (v, d = 1) => (Number.isFinite(v) ? (v * 100).toFixed(d).replace('.', ',') + '%' : String(v));
const tempos = [];
let tMarca = Date.now();
const marcar = nome => { const t = Date.now(); tempos.push(`${nome} ${((t - tMarca) / 1000).toFixed(0)} s`); tMarca = t; };
const espera = ms => new Promise(ok => setTimeout(ok, ms));

let REF = null;
try { REF = JSON.parse(fs.readFileSync(ARQ_REF, 'utf8'))[CHAVE_REF] ?? null; } catch (_) { REF = null; }
const cond = { chromium: '', renderer: '' };
// a tolerância das guardas "nada pior" só abre com OUTRO renderizador; a versão do Chromium só avisa (os valores não dependem
// dela: 141 do CI × 153 — a revisão do C3)
const tolRef = () => (REF && REF.renderer !== cond.renderer ? 1.5 : 1);
const versaoDif = () => !!REF && REF.chromium !== cond.chromium;
const ref = k => REF?.valores?.[k];

// ------------------------------------------------------------------ o que entra na página antes do jogo (cada carga)
/**
 * forca: null (o pedido do jogo) | true | false — o antialias do #tela (e do canvas recriado, que leva o mesmo id). Conta as
 * atribuições a width/height do #tela (seção Z). O rAF falso (seções T e Q): com __rafLigar(hz) os quadros passam a vir de um
 * relógio VIRTUAL a hz quadros por segundo (um setTimeout(0) por quadro: tão rápido quanto a máquina desenha); com 0, os de
 * verdade (com tremor = true, os intervalos variam e a média fica).
 */
function INIT(forca) {
  window.__forcaAA = forca;
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, attr) {
    if (this.id === 'tela' && /webgl/.test(String(tipo)) && (window.__forcaAA === true || window.__forcaAA === false)) attr = { ...(attr || {}), antialias: window.__forcaAA };
    const ctx = gc.call(this, tipo, attr);
    // (o contexto WebGL fica guardado no canvas: o teste o lê sem chamar o getContext, que CRIARIA um com o antialias padrão
    // num canvas ainda sem contexto)
    if (ctx && /webgl/.test(String(tipo)) && !this.__ctx) this.__ctx = ctx;
    return ctx;
  };
  window.__atrib = { width: 0, height: 0 };
  for (const k of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    Object.defineProperty(HTMLCanvasElement.prototype, k, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) { if (this.id === 'tela') window.__atrib[k]++; d.set.call(this, v); },
    });
  }
  const nativo = window.requestAnimationFrame.bind(window);
  // (tremor: os intervalos variam em volta de 1/hz — 0,6 1,4 1,0 0,8 1,2 —, a média é a mesma: um ritmo que NÃO está preso num
  // divisor da tela, como o de um aparelho que não segura o desenho)
  const TREMOR = [0.6, 1.4, 1.0, 0.8, 1.2];
  const R = window.__raf = { hz: 0, t: 0, n: 0, fila: [], agendado: false, tremor: false };
  const agendar = () => { if (!R.agendado) { R.agendado = true; setTimeout(tique, 0); } };
  function tique() {
    R.agendado = false;
    const fila = R.fila; R.fila = [];
    if (!R.hz) { for (const cb of fila) nativo(cb); return; }
    R.t += (R.tremor ? TREMOR[R.n % TREMOR.length] : 1) * 1000 / R.hz; R.n++;
    for (const cb of fila) { try { cb(R.t); } catch (e) { setTimeout(() => { throw e; }); } }
    // (a seção Q anota o quadro virtual em que a qualidade caiu)
    const V = window.__vigiaQ, q = window.__golaco?.qualidade;
    if (V && V.n == null && q && q !== V.q0) { V.n = R.n; V.t = R.t; V.q = q; }
    if (R.fila.length) agendar();
  }
  window.requestAnimationFrame = cb => { if (!R.hz) return nativo(cb); R.fila.push(cb); agendar(); return 0; };
  window.__rafLigar = (hz, tremor = false) => {
    R.hz = hz; R.tremor = !!tremor;
    R.t = Math.max(R.t, performance.now());
    if (hz) { if (R.fila.length) agendar(); } else { const fila = R.fila; R.fila = []; for (const cb of fila) nativo(cb); }
  };
}

// ------------------------------------------------------------------ o que roda na página depois do pronto
async function instalarPagina() {
  const THREE = await import('three');
  const g = window.__golaco;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  // (o contexto que a PÁGINA criou, guardado pelo INIT: nunca cria um — o getContext num canvas sem contexto criaria)
  const glTela = () => document.getElementById('tela')?.__ctx ?? null;
  const infoGl = gl => {
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { antialias: gl.getContextAttributes()?.antialias ?? null, samples: gl.getParameter(gl.SAMPLES), W: gl.drawingBufferWidth, H: gl.drawingBufferHeight, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), perdido: gl.isContextLost() };
  };
  const lerBuf = (gl, W, H) => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
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
  // o renderizador, a cena e a câmera do último g.desenhar() (o #tela)
  let cap = null;
  const desenharCap = () => {
    let achou = null;
    THREE.Scene.prototype.onBeforeRender = function (r, s, c) { if (r.domElement?.id === 'tela') achou = { r, s, c }; };
    try { g.desenhar(); } finally { delete THREE.Scene.prototype.onBeforeRender; }
    if (achou) cap = achou;
    return achou;
  };
  /** Esconde tudo menos os objetos com esses nomes (exatos; 'prefixo*' casa o prefixo), os ancestrais deles e as luzes. */
  const isolar = (s, nomes) => {
    const casa = n => nomes.some(x => (x.endsWith('*') ? n.startsWith(x.slice(0, -1)) : n === x));
    const alvo = new Set(), anc = new Set(), vis = new Map();
    s.traverse(o => { vis.set(o, o.visible); if (o.name && casa(o.name)) alvo.add(o); });
    for (const o of alvo) for (let p = o.parent; p; p = p.parent) anc.add(p);
    s.traverse(o => {
      if (o === s || alvo.has(o)) return;
      if (anc.has(o)) { o.visible = true; return; }
      for (let p = o.parent; p; p = p.parent) if (alvo.has(p)) return;
      if (!o.isLight) o.visible = false;
    });
    return { n: alvo.size, restaurar: () => { for (const [o, v] of vis) o.visible = v; } };
  };
  // o gancho dos finos do C9/C10 (`__golaco.graficos.fisico(bool)`: os truques dos finos desligados): a referência e as máscaras
  // FÍSICAS (sem ele, o contexto sem AA deixa de ser "o mesmo build menos o MSAA"); na main não existe e nada muda
  const temFisico = () => typeof g.graficos?.fisico === 'function';
  const comFisico = fn => { const t = temFisico(); if (t) g.graficos.fisico(true); try { return fn(); } finally { if (t) g.graficos.fisico(false); } };
  /**
   * O SSAA 3×3 com o MESMO LOD do quadro 1× (item 8 da revisão: o 3× desce o mip em log2 3 e põe um piso de textura no E): 9
   * desenhos no buffer 1× com a câmera deslocada −⅓, 0 e +⅓ px nos dois eixos (os pontos de amostra do 3×3). A soma (Uint16).
   */
  const renderLod = (r, s, c, W, H) => {
    const gl = r.getContext(), soma = new Uint16Array(W * H * 4), v = c.view && c.view.enabled ? { ...c.view } : null;
    try {
      for (const oy of [-1 / 3, 0, 1 / 3]) for (const ox of [-1 / 3, 0, 1 / 3]) {
        c.setViewOffset(W, H, ox, oy, W, H);
        r.render(s, c);
        const px = lerBuf(gl, W, H);
        for (let i = 0; i < soma.length; i++) soma[i] += px[i];
      }
    } finally { if (v) c.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height); else c.clearViewOffset(); }
    return soma;
  };
  /** O mesmo quadro 3× maior (pixel ratio 1), lido inteiro, e a soma de cada bloco 3×3 (Uint16, ÷ 9 = o SSAA). */
  const render3 = (r, s, c, W, H) => {
    const pr = r.getPixelRatio(), tam = r.getSize(new THREE.Vector2());
    r.setPixelRatio(1); r.setSize(W * 3, H * 3, false);
    let px;
    try { r.render(s, c); px = lerBuf(r.getContext(), W * 3, H * 3); } finally { r.setPixelRatio(pr); r.setSize(tam.x, tam.y, false); }
    const W3 = W * 3, soma = new Uint16Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = 4 * (y * W + x);
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const q = 4 * ((y * 3 + dy) * W3 + x * 3 + dx);
        soma[o] += px[q]; soma[o + 1] += px[q + 1]; soma[o + 2] += px[q + 2]; soma[o + 3] += px[q + 3];
      }
    }
    return soma;
  };
  /** Cobertura (1 = visivelmente fora do fundo: algum canal a mais de `limiar`/255 dele). div 9 = o SSAA somado. */
  const mascara = (px, W, H, div, fundo, limiar) => {
    const m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const d = Math.max(Math.abs(px[4 * i] / div - fundo[0]), Math.abs(px[4 * i + 1] / div - fundo[1]), Math.abs(px[4 * i + 2] / div - fundo[2]));
      m[i] = d > limiar ? 1 : 0;
    }
    return m;
  };
  /** O último quadro de novo, só com `nomes`, sobre magenta: {px (1×) ou soma (3×), mascara}. */
  const renderIsolado = (nomes, { escala = 1, limiar = 40, corDe = false } = {}) => {
    const { r, s, c } = cap;
    const iso = isolar(s, nomes);
    const corAntes = new THREE.Color(); r.getClearColor(corAntes); const aAntes = r.getClearAlpha();
    r.setClearColor(0xff00ff, 1);
    const gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    try {
      if (escala === 3) {
        const soma = comFisico(() => render3(r, s, c, W, H));
        const fundo = [soma[0] / 9, soma[1] / 9, soma[2] / 9];
        return { n: iso.n, W, H, m: mascara(soma, W, H, 9, [255, 0, 255], limiar), fundo };
      }
      r.render(s, c);
      const px = lerBuf(gl, W, H);
      return { n: iso.n, W, H, px: corDe ? px : null, m: mascara(px, W, H, 1, [255, 0, 255], limiar), fundo: [px[0], px[1], px[2]] };
    } finally { iso.restaurar(); r.setClearColor(corAntes, aAntes); }
  };
  /** O painel (o .perf-fixo do item 45 ou o #qps de hoje): existe, à vista, por cima de tudo, o texto e o número de qps. */
  /**
   * O que PINTA por cima de `el` em cada ponto [fx, fy] da caixa dele: o elementFromPoint pula as camadas com pointer-events: none
   * (o véu, a marca REPLAY, as cortinas, o painel ?perf desde a revisão do bloco 4) e as `inert` (o fundo da pausa): só durante a
   * leitura, todas recebem toque e ninguém fica inerte (item 10 da revisão; síncrono, sem evento no meio), e a PILHA inteira do
   * ponto (elementsFromPoint) é lida. Cobre só a camada acima que PINTA ali: à vista (checkVisibility com a opacidade e a
   * visibilidade, também dos pais) e com fundo, imagem de fundo, conteúdo substituído, forma de SVG ou texto próprio — a camada
   * transparente de tela inteira (o #toque, a tela antes do jogo saindo com opacidade 0) não tapa nada. {livres, cobertos: [nome]}.
   */
  const pintaPorCima = (el, pontos) => {
    const r = el.getBoundingClientRect();
    const st = document.createElement('style');
    st.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
    document.head.appendChild(st);
    const inertes = [...document.querySelectorAll('[inert]')];
    for (const e of inertes) e.inert = false;
    const pinta = e => {
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      const cs = getComputedStyle(e);
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/), a = m ? (m[1].split(',').map(Number)[3] ?? 1) : 0;
      if (a > 0.02 || cs.backgroundImage !== 'none') return true;
      if (/^(IMG|CANVAS|VIDEO|IFRAME|INPUT|BUTTON|SELECT|TEXTAREA)$/.test(e.tagName)) return true;
      if (e instanceof SVGGraphicsElement && !(e instanceof SVGSVGElement) && e.tagName !== 'g') return true;
      return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    };
    const cobertos = [];
    let livres = 0;
    try {
      for (const [fx, fy] of pontos) {
        let livre = false;
        for (const e of document.elementsFromPoint(r.left + fx * r.width, r.top + fy * r.height)) {
          if (e === el || el.contains(e)) { livre = true; break; }
          if (e.contains(el)) continue;
          if (pinta(e)) { cobertos.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''}`); break; }
        }
        if (livre) livres++;
      }
    } finally { for (const e of inertes) e.inert = true; st.remove(); }
    return { livres, cobertos: [...new Set(cobertos)] };
  };
  const painel = () => {
    const el = document.querySelector('.perf-fixo') || document.getElementById('qps');
    if (!el) return { existe: false, visivel: false, topo: 0, texto: '', qps: NaN, fixo: false };
    const r = el.getBoundingClientRect();
    const vis = !el.hidden && r.width >= 4 && r.height >= 4 && (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
    let topo = 0, tapado = '';
    if (vis) {
      const pc = pintaPorCima(el, [[0.5, 0.5], [0.15, 0.25], [0.85, 0.75]]);
      topo = pc.livres;
      tapado = pc.cobertos.join(', ');
    }
    const texto = (el.innerText || el.textContent || '').trim();
    const m = texto.match(/(\d+(?:[.,]\d+)?)\s*qps/i);
    return { existe: true, visivel: vis, topo: topo / 3, tapado, texto, qps: m ? +m[1].replace(',', '.') : NaN, fixo: el.classList.contains('perf-fixo'), pai: el.parentElement?.id || el.parentElement?.tagName };
  };
  /**
   * A mensagem da tela "Ajustando…" à vista e POR CIMA de tudo (a revisão do bloco 4: o checkVisibility só olha o DOM — com o
   * painel ?perf por cima, ela ficava tapada e o R1 passava): 5 pontos ao longo da linha dela. null sem a mensagem à vista.
   */
  const msgAjustando = () => {
    const el = document.getElementById('carregando-msg');
    if (!el || !/Ajustando/i.test(el.textContent || '') || (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) return null;
    const pc = pintaPorCima(el, [[0.1, 0.5], [0.3, 0.5], [0.5, 0.5], [0.7, 0.5], [0.9, 0.5]]);
    // (e o painel ?perf INTEIRO debaixo da tela de carregar — a mensagem pode cair fora da caixa dele, e a guarda acima não veria
    // a ordem das camadas: 3 pontos do painel, nenhum livre)
    const pn = document.querySelector('.perf-fixo');
    const pp = pn && !pn.hidden && pn.getClientRects().length ? pintaPorCima(pn, [[0.5, 0.5], [0.15, 0.25], [0.85, 0.75]]) : null;
    return { livres: pc.livres, de: 5, cobertos: pc.cobertos, painelLivres: pp ? pp.livres : null, painelSob: pp ? pp.cobertos : [] };
  };
  /**
   * O painel ?perf NÃO pega toque (a revisão do bloco 4): em 5 pontos de cada alvo à vista (`seletor`), o elementFromPoint de
   * verdade (sem forçar nada) nunca é o painel. `sobPainel` conta os pontos dentro da caixa dele (a guarda só prova algo onde ele
   * passa por cima de um alvo).
   */
  const toqueLivre = seletor => {
    const pn = document.querySelector('.perf-fixo') || document.getElementById('qps');
    const pr = pn && !pn.hidden ? pn.getBoundingClientRect() : null;
    const alvos = [...document.querySelectorAll(seletor)].filter(a => a.getClientRects().length && (!a.checkVisibility || a.checkVisibility({ visibilityProperty: true })));
    let pontos = 0, sobPainel = 0;
    const roubados = [];
    for (const a of alvos) {
      const b = a.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const x = b.left + fx * b.width, y = b.top + fy * b.height;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        pontos++;
        if (pr && x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) sobPainel++;
        const e = document.elementFromPoint(x, y);
        if (pn && e && (e === pn || pn.contains(e))) roubados.push(a.id || a.dataset?.valor || (a.textContent || '').trim().slice(0, 16));
      }
    }
    return { alvos: alvos.length, pontos, sobPainel, roubados: [...new Set(roubados)], nRoubados: roubados.length, painel: pr ? [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)] : null };
  };
  const matGols = () => {
    const k = cap ?? desenharCap();
    const gols = k?.s.getObjectByName('gols');
    const mat = gols ? (Array.isArray(gols.material) ? gols.material[0] : gols.material) : null;
    const uni = mat?.uniforms?.uAlturaBuffer ?? mat?.userData?.uAlturaBuffer ?? mat?.userData?.uniforms?.uAlturaBuffer ?? mat?.userData?.shader?.uniforms?.uAlturaBuffer ?? null;
    return { gols, mat, uni, gl: k?.r.getContext() ?? null };
  };
  let idCv = 0;
  const canvasInfo = () => {
    const cv = document.getElementById('tela');
    if (!cv) return null;
    cv.__idTeste ??= ++idCv;
    return { id: cv.__idTeste, aria: cv.getAttribute('aria-label'), inert: !!cv.inert, info: infoGl(glTela()) };
  };
  const ajustando = () => {
    for (const e of document.querySelectorAll('#carregando, .carregando, [role="status"]')) {
      if (/Ajustando/i.test(e.textContent || '') && (!e.checkVisibility || e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) return true;
    }
    return false;
  };
  window.__P = {
    info: () => infoGl(glTela()),
    /** Espera a GPU acabar o que está na fila (gl.finish e as leituras do contexto, que sincronizam com o processo da GPU). */
    drenarGpu() { const gl = glTela(); if (!gl) return null; gl.finish(); return infoGl(gl); },
    canvasInfo, painel, ajustando, msgAjustando, toqueLivre,
    sonda() {
      const r = {};
      for (const aa of [true, false]) {
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        const gl = cv.getContext('webgl2', { antialias: aa, alpha: false, depth: true, stencil: false });
        r[aa ? 'com' : 'sem'] = gl ? { ...infoGl(gl), maxSamples: gl.getParameter(gl.MAX_SAMPLES) } : null;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
      return r;
    },
    /**
     * Um quadro do jogo (pose {de, para, fov} pela câmera livre; null = a câmera de agora, como no pré-jogo), lido no mesmo
     * evaluate do desenho. opc: {cor (o quadro, padrão true), corFisico (o mesmo quadro com o gancho físico, quando existir),
     * ssaa (o SSAA do mesmo LOD, físico), mascaras: {nome: [nomes]}, limiar, png}.
     */
    quadro(pose, opc = {}) {
      if (pose) g.cameraLivre(pose);
      const k = desenharCap();
      if (!k) return null;
      const gl = k.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const e = g.estado();
      const out = { W, H, info: infoGl(gl), chamadas: e.desenhoChamadas, triangulos: e.desenhoTriangulos };
      if (opc.cor !== false) { const px = lerBuf(gl, W, H); out.cor = b64(px); if (opc.png) out.png = png(px, W, H); }
      // (o quadro físico para a máscara, só com o gancho: sem ele é o próprio `cor`)
      if (opc.corFisico && temFisico()) out.corFisico = b64(comFisico(() => { k.r.render(k.s, k.c); return lerBuf(gl, W, H); }));
      if (opc.ssaa) out.ssaa = b64(new Uint8Array(comFisico(() => renderLod(k.r, k.s, k.c, W, H)).buffer));
      if (opc.mascaras) {
        out.mascaras = {}; out.nObj = {};
        for (const [nome, sel] of Object.entries(opc.mascaras)) { const r = renderIsolado(sel, { limiar: opc.limiar ?? 8 }); out.mascaras[nome] = b64(r.m); out.nObj[nome] = r.n; }
      }
      return out;
    },
    /** Cobertura de `sel` sobre magenta no quadro desta pose: as máscaras 1× e 3× (SSAA reduzido). */
    cobertura(pose, sel, limiar = 40) {
      if (pose) g.cameraLivre(pose);
      if (!desenharCap()) return null;
      const a = renderIsolado(sel, { limiar }), b = renderIsolado(sel, { limiar, escala: 3 });
      return { W: a.W, H: a.H, n: a.n, m1: b64(a.m), m3: b64(b.m), fundo1: a.fundo, fundo3: b.fundo };
    },
    /** As cores do quadro só com `sel` (o gramado da P3), sem o céu. */
    isolado(pose, sel) {
      if (pose) g.cameraLivre(pose);
      if (!desenharCap()) return null;
      const r = renderIsolado(sel, { corDe: true });
      return { W: r.W, H: r.H, n: r.n, cor: b64(r.px) };
    },
    /**
     * O TEXTO dos programas da torcida (o quadro) e das bandeiras, pelo FNV-1a de 32 bits do vertex + fragment do material (a
     * revisão do bloco 3: o ?gfx=antigo tem de devolver o texto da main bit a bit; o número vai à referência gravada da main).
     */
    fontes() {
      const fnv = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
      const T = g.estadio?.torcidaObj;
      const mats = (T?.mesh?.children ?? []).map(m => m.material).filter(m => m && m.isShaderMaterial);
      const quadro = mats.find(m => m.name !== 'torcida-impostor') ?? null, band = T?.bandeiras?.mesh?.material ?? null;
      const h = m => (m ? fnv(m.vertexShader + '\n/*frag*/\n' + m.fragmentShader) : null);
      return { torcida: h(quadro), bandeiras: h(band), a2c: !!quadro?.alphaToCoverage };
    },
    /** O tom do renderizador agora (pego no desenho). */
    tom() {
      const k = desenharCap();
      if (!k) return null;
      return { tom: k.r.toneMapping, exposicao: k.r.toneMappingExposure, NEUTRO: THREE.NeutralToneMapping, ACES: THREE.ACESFilmicToneMapping, cv: canvasInfo() };
    },
    /** __golaco.definirQualidade e um desenho no MESMO evaluate (o caminho imediato): o quadro, o canvas e o contexto. */
    trocaImediata(q) {
      const antes = canvasInfo();
      g.definirQualidade(q);
      const k = desenharCap();
      const gl = k?.r.getContext();
      let naoPreto = NaN;
      if (gl) {
        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = lerBuf(gl, W, H);
        let n = 0; for (let i = 0; i < W * H; i++) if (px[4 * i] + px[4 * i + 1] + px[4 * i + 2] > 24) n++;
        naoPreto = n / (W * H);
      }
      return { q: g.qualidade, antes, depois: canvasInfo(), naoPreto };
    },
    /** O quadro desenha? (fração de pixels que não são pretos) */
    naoPreto() {
      const k = desenharCap(); const gl = k?.r.getContext();
      if (!gl || gl.isContextLost()) return NaN;
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = lerBuf(gl, W, H);
      let n = 0; for (let i = 0; i < W * H; i++) if (px[4 * i] + px[4 * i + 1] + px[4 * i + 2] > 24) n++;
      return n / (W * H);
    },
    /** A mira da cobrança: pixels que mudam com × sem a linha (no mesmo instante; teste-bola-parada-tela §3). */
    mira() {
      const ler = () => { const k = desenharCap(); const gl = k.r.getContext(); return lerBuf(gl, gl.drawingBufferWidth, gl.drawingBufferHeight); };
      g.bolaParada.linha(true); g.relogio.avancar(1000 / 60, { desenhar: false });
      const a = ler();
      const ativa = g.bolaParada.estado?.ativa ?? null;
      g.bolaParada.linha(false);
      const b = ler();
      g.bolaParada.linha(true);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 18) n++;
      return { n, ativa };
    },
    /**
     * O render do #tela vira só uma conta (liga = true) ou volta (false): as seções do ritmo (T, Q) medem QUANTAS vezes a página
     * desenha, não o desenho — o SwiftShader levava 0,1–0,4 s por quadro e o rAF falso a 165 Hz, minutos. Cada chamada anota o
     * relógio virtual em window.__desenhos (quando é uma lista).
     */
    soContar(liga) {
      const k = cap ?? desenharCap();
      if (!k) return false;
      const r = k.r;
      if (liga && !r.__renderOriginal) {
        r.__renderOriginal = r.render;
        r.render = function () { window.__nRender = (window.__nRender || 0) + 1; if (window.__desenhos) window.__desenhos.push(window.__raf.t); };
      } else if (!liga && r.__renderOriginal) { r.render = r.__renderOriginal; delete r.__renderOriginal; }
      return true;
    },
    /**
     * Os ganchos do item 45 nos finos (o material da malha 'gols': a A2C e o uAlturaBuffer, onde estiverem) e na torcida (a A2C
     * do material do quadro, C10; null sem a torcida).
     */
    ganchos() {
      const { gols, mat, uni, gl } = matGols();
      const tor = g.estadio?.torcidaObj?.mesh?.children?.[0]?.material ?? null;
      return { temGols: !!gols, a2c: mat ? !!mat.alphaToCoverage : null, a2cTorcida: tor ? !!tor.alphaToCoverage : null, uAltura: uni ? (typeof uni === 'object' && 'value' in uni ? uni.value : uni) : null, H: gl?.drawingBufferHeight ?? null, samples: gl ? gl.getParameter(gl.SAMPLES) : null };
    },
    /**
     * A mira (a malha 'linha-mira' de render/bola-parada.js) já tem programa no renderizador de AGORA? Lido depois de um desenho com
     * ela escondida (visivel false: o desenho não a compilou) — o C12 aquece o programa dela a cada contexto novo (a recriação e o
     * contexto restaurado). null sem o módulo.
     */
    miraCompilada() {
      const k = desenharCap();
      const m = k?.s.getObjectByName('linha-mira');
      if (!m) return null;
      return { programa: !!k.r.properties.get(m.material).currentProgram, visivel: !!m.visible };
    },
    /**
     * Estraga os ganchos ANTES de perder o contexto (item 3 da revisão: a A2C e o uAlturaBuffer são estado JS do material, o
     * loseContext/restoreContext não mexe neles — postos já na criação, a guarda passava sem o ouvinte do contexto restaurado):
     * a A2C ao contrário do certo e o uAlturaBuffer em −1. Depois da volta do contexto, só os ganchos rodando os acertam.
     */
    sabotarGanchos() {
      const { mat, uni, gl } = matGols();
      const certoA2c = gl ? gl.getParameter(gl.SAMPLES) >= 2 : null;
      if (mat && certoA2c !== null) mat.alphaToCoverage = !certoA2c;
      const tor = g.estadio?.torcidaObj?.mesh?.children?.[0]?.material ?? null;
      if (tor && certoA2c !== null) tor.alphaToCoverage = !certoA2c;
      const temU = !!(uni && typeof uni === 'object' && 'value' in uni);
      if (temU) uni.value = -1;
      return { a2c: mat ? mat.alphaToCoverage : null, a2cTorcida: tor ? tor.alphaToCoverage : null, uAltura: temU ? -1 : null };
    },
  };
  return { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, versao: g.versao };
}

// ------------------------------------------------------------------ vetores e a câmera do three (lookAt, fov vertical)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function baseCam(pose, W, H) {
  const ez = norm(sub(pose.de, pose.para)), ex = norm(cross([0, 1, 0], ez)), ey = cross(ez, ex);
  return { o: pose.de, ex, ey, ez, W, H, tanV: Math.tan((pose.fov * Math.PI) / 360), asp: W / H };
}
function projetar(B, p) {
  const d = sub(p, B.o), c = -dot(d, B.ez);
  return { x: ((dot(d, B.ex) / (c * B.tanV * B.asp) + 1) / 2) * B.W - 0.5, y: ((dot(d, B.ey) / (c * B.tanV) + 1) / 2) * B.H - 0.5, c };
}
function mapaChao(B) {
  const { W, H } = B, X = new Float32Array(W * H), Z = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = ((y + 0.5) / H) * 2 - 1;
    for (let x = 0; x < W; x++) {
      const u = ((x + 0.5) / W) * 2 - 1, i = y * W + x, a = u * B.tanV * B.asp, b = v * B.tanV;
      const d = [-B.ez[0] + a * B.ex[0] + b * B.ey[0], -B.ez[1] + a * B.ex[1] + b * B.ey[1], -B.ez[2] + a * B.ex[2] + b * B.ey[2]];
      if (d[1] >= -1e-9) { X[i] = NaN; Z[i] = NaN; continue; }
      const t = -B.o[1] / d[1];
      X[i] = B.o[0] + t * d[0]; Z[i] = B.o[2] + t * d[2];
    }
  }
  return { X, Z };
}
const desloca = (pose, dx) => ({ ...pose, de: [pose.de[0] + dx, pose.de[1], pose.de[2]], para: [pose.para[0] + dx, pose.para[1], pose.para[2]] });

// ------------------------------------------------------------------ pixels e cor
const u8 = s => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.length); };
const u16 = s => { const b = Buffer.from(s, 'base64'); const o = new Uint16Array(b.length / 2); Buffer.from(o.buffer).set(b); return o; };
const LIN = Float64Array.from({ length: 256 }, (_, i) => decSrgb(i / 255));
const labPx = (px, i) => oklab([LIN[px[4 * i]], LIN[px[4 * i + 1]], LIN[px[4 * i + 2]]]);
const labCor = c => oklab([decSrgb(Math.min(255, Math.max(0, c[0])) / 255), decSrgb(Math.min(255, Math.max(0, c[1])) / 255), decSrgb(Math.min(255, Math.max(0, c[2])) / 255)]);
const distLab = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const percentil = (a, p) => { if (!a.length) return NaN; const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.max(0, Math.floor(p * (b.length - 1) + 0.5)))]; };
function acumular(s, px, i) { s[0] += LIN[px[4 * i]]; s[1] += LIN[px[4 * i + 1]]; s[2] += LIN[px[4 * i + 2]]; s[3]++; }
const labDe = s => (s[3] > 0 ? oklab([s[0] / s[3], s[1] / s[3], s[2] / s[3]]) : null);
const contar = m => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };
function difPx(a, b) { if (!a || !b || a.length !== b.length) return Infinity; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; }

/**
 * A2: {E1 (com MSAA), E0 (sem), mascara} pela máscara geométrica |MSAA − sem| > 0,01 (dos quadros físicos M1/M0, quando o
 * gancho existe), contra o SSAA somado (÷ 9; o do mesmo LOD, físico).
 */
function serrilhado(I1, I0, S, N, M1 = null, M0 = null) {
  let n = 0, s1 = 0, s0 = 0;
  const A = M1 ?? I1, Z = M0 ?? I0;
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A[4 * i + c] - Z[4 * i + c]));
    if (m <= 2.55) continue;
    n++;
    for (let c = 0; c < 3; c++) { const ss = S[4 * i + c] / 9; s1 += ((I1[4 * i + c] - ss) / 255) ** 2; s0 += ((I0[4 * i + c] - ss) / 255) ** 2; }
  }
  return { E1: Math.sqrt(s1 / Math.max(1, 3 * n)), E0: Math.sqrt(s0 / Math.max(1, 3 * n)), mascara: n / N };
}

// o ponto mais perto de p num triângulo (Ericson, Real-Time Collision Detection §5.1.5), no espaço da cor guardada
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
function pertoSeg(p, a, b) { const ab = sub(b, a), l2 = dot(ab, ab); if (l2 < 1e-9) return a; const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)); return add(a, mul(ab, t)); }
function pertoTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  if (!Number.isFinite(den)) return null;
  return add(add(a, mul(ab, vb * den)), mul(ac, vc * den));
}
/**
 * K(1): as franjas na região M (dilatada 1 px). Borda = |MSAA − sem| > 0,01; franja = a cor da borda no MSAA a mais de 0,03 em
 * OKLab da mistura mais perto (pontos, segmentos e triângulos) das cores VIZINHAS (5×5) do quadro sem AA. (Com 3×3, o mastro
 * de menos de 1 px, que o quadro sem AA pega aos pedaços, contava como franja na torcida; a franja de verdade — a cor da célula
 * vizinha do atlas na borda sem `centroid`, N11: a linha verde-clara no alto das faixas da mureta — fica igual com 5×5.)
 * As bordas se separam pelo CENTRO do pixel (a máscara M do quadro sem AA): com o centro DENTRO do objeto o MSAA sombreia a
 * mesma amostra do quadro sem AA e a franja é o fundo escondido que entra na mistura (o `centroid` não muda nada ali: um piso
 * da medida, 0,7% das bordas da torcida); com o centro FORA a amostra é extrapolada, a franja do N11 — a classe que a meta conta.
 */
function franjas(I1, I0, M, W, H, R = 2) {
  const D = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!M[y * W + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < H && xx < W) D[yy * W + xx] = 1; }
  }
  let bordas = 0, nf = 0, bFora = 0, fFora = 0;
  for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
    const i = y * W + x;
    if (!D[i]) continue;
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(I1[4 * i + c] - I0[4 * i + c]));
    if (m <= 2.55) continue;
    bordas++;
    const p = [I1[4 * i], I1[4 * i + 1], I1[4 * i + 2]], lp = labCor(p);
    const viz = [], vistos = new Set();
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const j = (y + dy) * W + x + dx, ch = (I0[4 * j] << 16) | (I0[4 * j + 1] << 8) | I0[4 * j + 2];
      if (!vistos.has(ch)) { vistos.add(ch); viz.push([I0[4 * j], I0[4 * j + 1], I0[4 * j + 2]]); }
    }
    let melhor = Infinity;
    const tenta = q => { if (q) { const d = distLab(lp, labCor(q)); if (d < melhor) melhor = d; } };
    for (const a of viz) tenta(a);
    for (let a = 0; a < viz.length && melhor > 0.03; a++) for (let b = a + 1; b < viz.length; b++) tenta(pertoSeg(p, viz[a], viz[b]));
    for (let a = 0; a < viz.length && melhor > 0.03; a++) for (let b = a + 1; b < viz.length && melhor > 0.03; b++) for (let c = b + 1; c < viz.length; c++) tenta(pertoTri(p, viz[a], viz[b], viz[c]));
    const fora = !M[i];
    if (fora) bFora++;
    if (melhor > 0.03) { nf++; if (fora) fFora++; }
  }
  // (0 px de borda: o MSAA não mexe na região — o letreiro com alphaTest sem A2C — e não há franja)
  const bDentro = bordas - bFora, fDentro = nf - fFora;
  return { bordas, franjas: nf, frac: bordas ? nf / bordas : 0, bFora, fFora, fracFora: bFora ? fFora / bFora : 0, bDentro, fDentro, fracDentro: bDentro ? fDentro / bDentro : 0 };
}

/**
 * P3 — o gramado da página na pose do meio (só o gramado, e o gramado com as linhas): G1 a cor média no foco (|x| ≤ 15, |z|
 * ≤ 8, sem o desgaste do círculo central), G2 o ΔL das faixas (perfil por x em 0,25 m, a metade de cima − a de baixo), G3 as
 * bordas no perfil (|x| ≤ 20), G4 longe − perto (L), G5 o p95 do L da linha (o que a linha clareia em ≥ 0,08).
 */
function gramadoPagina(Ig, Il, pose, W, H) {
  const B = baseCam(pose, W, H), { X, Z } = mapaChao(B);
  const sF = [0, 0, 0, 0], sP = [0, 0, 0, 0], sL = [0, 0, 0, 0], bins = new Map();
  for (let i = 0; i < W * H; i++) {
    const x = X[i], z = Z[i];
    if (!Number.isFinite(x)) continue;
    const desg = Math.abs(x) < 4 && Math.abs(z) < 3.5;
    if (Math.abs(x) <= 15 && Math.abs(z) <= 8 && !desg) acumular(sF, Ig, i);
    if (Math.abs(x) <= 20 && Math.abs(z) <= 8 && !desg) { const k = Math.floor((x + 20) / 0.25); let s = bins.get(k); if (!s) { s = [0, 0, 0, 0]; bins.set(k, s); } acumular(s, Ig, i); }
    if (Math.abs(x) <= 12 && z >= 8 && z <= 18) acumular(sP, Ig, i);
    if (Math.abs(x) <= 12 && z >= -32 && z <= -22) acumular(sL, Ig, i);
  }
  const g1 = labDe(sF);
  const perfil = [...bins.entries()].filter(([, s]) => s[3] >= 20).sort((a, b) => a[0] - b[0]).map(([, s]) => labDe(s).L);
  const med = percentil(perfil, 0.5);
  const alto = perfil.filter(L => L > med), baixo = perfil.filter(L => L <= med);
  const dL = media(alto) - media(baixo);
  // bordas: o perfil suavizado (3 bins) cruzando a mediana com histerese de ¼ do ΔL
  const suave = perfil.map((_, k) => media(perfil.slice(Math.max(0, k - 1), k + 2)));
  let estado = suave[0] > med, bordas = 0;
  for (const L of suave) { if (estado && L < med - dL / 4) { estado = false; bordas++; } else if (!estado && L > med + dL / 4) { estado = true; bordas++; } }
  const lp = labDe(sP), ll = labDe(sL);
  const Ls = [];
  for (let y = Math.floor(H * 0.2); y < Math.ceil(H * 0.8); y++) for (let x = Math.floor(W * 0.2); x < Math.ceil(W * 0.8); x++) {
    const i = y * W + x, Lc = labPx(Il, i).L;
    if (Lc - labPx(Ig, i).L >= 0.08) Ls.push(Lc);
  }
  return { L: g1?.L, C: g1?.C, h: g1?.h, dL, bordas, dLonge: ll && lp ? ll.L - lp.L : NaN, linha: percentil(Ls, 0.95), nLinha: Ls.length };
}

// ------------------------------------------------------------------ as cargas
const CEL = { w: 844, h: 390, dpr: 2, toque: true };
const PC = { w: 1280, h: 720, dpr: 1, toque: false };
const URL_CEL = 'prints=1&demo=1&q=media&hora=dia&toque=1&entalhe=1&semente=4&replay=0&comemoracao=0';
const URL_PC = 'prints=1&demo=1&hora=dia&semente=4&replay=0&comemoracao=0';
const srv = await servidor(0, raiz);
const srvBase = raizBase ? await servidor(0, raizBase) : null;
const sessoes = [];
const errosConsole = [];
let invalido = null;

async function carga(cfg, busca, { forca = null, servidor: sv = srv, init2 = null, esperar = true } = {}) {
  const s = await abrir({ largura: cfg.w, altura: cfg.h, dpr: cfg.dpr, toque: cfg.toque });
  sessoes.push(s);
  s.busca = busca; s.srv = sv;
  await s.contexto.addInitScript(INIT, forca);
  // (um script a mais antes da página: o R5, o KHR_parallel_shader_compile falso)
  if (init2) await s.contexto.addInitScript(init2);
  s.pagina.setDefaultTimeout(240000);
  s.r404 = [];
  s.pagina.on('response', r => { if (r.status() === 404) s.r404.push(r.url()); });
  if (!cond.chromium) cond.chromium = s.navegador.version();
  // (sem esperar: quem chama navega e espera o pronto com o prazo dele — o R5 mede se ele chega)
  if (esperar) await irPara(s); else await s.pagina.goto(`${s.srv.url}?${s.busca}`, { waitUntil: 'load' });
  return s;
}
async function irPara(s, recarregar = false) {
  const t0 = Date.now();
  if (recarregar) await s.pagina.reload({ waitUntil: 'load' }); else await s.pagina.goto(`${s.srv.url}?${s.busca}`, { waitUntil: 'load' });
  if (s.busca.includes('segurar3d=1')) await s.pagina.waitForFunction(() => window.__golaco && (window.__golaco.carga === 'segurada' || window.__golaco.pronto), null, { timeout: 240000 });
  else await s.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
  s.tCarga = (Date.now() - t0) / 1000;
  s.inst = await s.pagina.evaluate(instalarPagina);
  // (o renderizador da referência: o da sonda; sem ela — `--so` sem as cargas do celular —, o do #tela da 1ª carga)
  if (!cond.renderer) cond.renderer = (await s.pagina.evaluate(() => window.__P.info()?.renderer).catch(() => '')) || '';
}
function anotarErros(s) {
  for (const e of s.erros.splice(0)) if (!/status of 404/.test(e)) errosConsole.push(`${s.busca.slice(0, 40)}: ${e}`);
  for (const u of s.r404.splice(0)) errosConsole.push(`404: ${u}`);
}
async function fechar(s) {
  if (!s) return;
  anotarErros(s);
  const i = sessoes.indexOf(s); if (i >= 0) sessoes.splice(i, 1);
  await s.navegador.close().catch(() => {});
}
const P = (pg, nome, ...a) => pg.evaluate(([n, aa]) => window.__P[n](...aa), [nome, a]);
/** Espera o relógio virtual do rAF falso chegar a `alvo` ms (com teto de tempo real). */
async function esperarRaf(pg, alvo, tetoMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < tetoMs) { if ((await pg.evaluate(() => window.__raf.t)) >= alvo) return true; await espera(40); }
  return false;
}
/** n quadros de verdade (rAF); true se vieram, false se o teto (30 s) chegou antes. */
const quadrosReais = (pg, n = 2) => pg.evaluate(n => new Promise(ok => { let k = 0; const f = () => (++k >= n ? ok(true) : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(() => ok(false), 30000); }), n);
function salvarPng(nome, b64) { if (pastaPrints && b64) fs.writeFileSync(path.join(pastaPrints, `${nome}.png`), Buffer.from(b64, 'base64')); }

// ------------------------------------------------------------------ as poses (a TV do celular)
const ASP_CEL = CEL.w / CEL.h;
const PERFIL = EQ.perfilCamera({}, 0, ASP_CEL, true);
const tv = (fx, fz) => { const o = EQ.poseTV(PERFIL, fx, fz, ASP_CEL, true, {}); return { de: [...o.de], para: [...o.para], fov: o.fov }; };
const clamp = (v, a, b) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), v));
function posesJogo(bola) {
  return { jogo: tv(clamp(bola.x, -PERFIL.limX, PERFIL.limX), clamp(bola.z, PERFIL.limZ0, PERFIL.limZ1)), area: tv(PERFIL.limX, 0) };
}
const POSE_MEIO = tv(0, 0);
// as bandeiras de mastro da Média (o prefixo da malha) e as poses a 50 e 100 m da mais perto do meio na arquibancada de lá
const BANDS = BD.bandeiras().slice(0, BD.BANDEIRAS.bandeiras.media);
const ALVO_BAND = BANDS.filter(b => !b.org).sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
function poseBandeira(d) {
  const b = ALVO_BAND, c = [b.x + b.ex * 1.0, b.y + 2.3, b.z + b.ez * 1.0], h = Math.sqrt(Math.max(1, d * d - (13 - c[1]) ** 2));
  return { de: [c[0] + b.nx * h, 13, c[2] + b.nz * h], para: c, fov: POSE_MEIO.fov };
}
/** As caixas na tela (px do buffer, y de baixo) das bandeiras de mastro da Média, com o balanço e a onda. */
function caixasBandeiras(pose, W, H) {
  const B = baseCam(pose, W, H), cx = [];
  for (const b of BANDS) {
    const pts = [];
    for (const u of [-2.2, 4.2]) for (const v of [-0.3, 3.7]) for (const w of [-1, 1]) pts.push([b.x + b.ex * u + b.nx * w, b.y + v, b.z + b.ez * u + b.nz * w]);
    const pr = pts.map(p => projetar(B, p));
    if (pr.some(q => !(q.c > 0.5))) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...pr.map(q => q.x)) - 3)), x1 = Math.min(W - 1, Math.ceil(Math.max(...pr.map(q => q.x)) + 3));
    const y0 = Math.max(0, Math.floor(Math.min(...pr.map(q => q.y)) - 3)), y1 = Math.min(H - 1, Math.ceil(Math.max(...pr.map(q => q.y)) + 3));
    if (x1 > x0 && y1 > y0) cx.push({ x0, x1, y0, y1 });
  }
  return cx;
}
function contarCaixas(m, W, caixas) {
  const visto = new Uint8Array(m.length);
  let n = 0;
  for (const c of caixas) for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) { const i = y * W + x; if (!visto[i]) { visto[i] = 1; n += m[i]; } }
  return n;
}

const CATS = { torcida: ['torcida*'], bandeiras: ['festa-bandeiras', 'bandeiras'], placas: ['placas'] };
const CATS_PRE = { letreiro: ['fora-placa'] };

// ================================================================== as cargas do celular (build, oposta, igual)
/**
 * A sequência de cada carga do celular (a mesma nas três): o pré-jogo no plano da fachada (o letreiro), pular, 300 passos com a
 * demo, os quadros das poses 'jogo' e 'area'. papel: 'build' | 'oposta' | 'igual'; semAA: esta carga é a sem antisserrilhado (o
 * SSAA e as máscaras saem dela).
 */
async function sequenciaCel(s, papel, semAA) {
  const pg = s.pagina, r = { papel };
  r.info = await P(pg, 'info');
  await pg.waitForFunction(() => window.__golaco.sobDemanda?.ja() ?? true, null, { timeout: 120000 });
  // (a revisão do bloco 3) o que chega DEPOIS e muda a torcida no quadro — o modelo do torcedor 3D (pedido no quadro seguinte ao
  // das cadeiras: os torcedores dos blocos de perto saem do quadro) e o impostor ASSADO em fatias ociosas entre os desenhos —
  // assenta antes de qualquer medida, desenhando até lá (sem desenho nada anda): sem isso a cena mudava entre os quadros a e b
  // da K3 conforme o relógio da máquina (a carga sem AA com cobertura 0,925 e o SSAA cintilando 4,60% em 2 de 7 rodadas)
  r.assentado = await pg.evaluate(async () => {
    const g = window.__golaco, t0 = performance.now();
    const ok = () => {
      const e = g.estadio;
      if (!e?.torcida || e.torcida.qualidade === 'baixa') return true;
      const tor = e.cadeiras?.torcedores, io = e.impostorObj, imp = io ? io.estado : null;
      return !!tor?.carregado && (!imp || imp.pronto || imp.falhou);
    };
    while (!ok() && performance.now() - t0 < 90000) { g.desenhar(); await new Promise(res => setTimeout(res, 100)); }
    const io = g.estadio?.impostorObj, imp = io ? io.estado : null;
    return { ok: ok(), ms: Math.round(performance.now() - t0), torcedores: !!g.estadio?.cadeiras?.torcedores?.carregado, impostor: imp ? (imp.pronto ? 'pronto' : imp.falhou ? 'falhou' : 'assando') : 'nenhum' };
  });
  // o relógio manual num instante fixo (a torcida anda no relógio do desenho)
  r.plano = await pg.evaluate(() => {
    const g = window.__golaco;
    g.relogio.usarManual(true); g.pausar(true); g.relogio.avancar(1e6 - g.relogio.agora, { desenhar: false }); g.pausar(false);
    const p = g.prejogo?.planos?.find(x => x.id === 'fachada');
    return p ? { t0: p.t0, t1: p.t1, ativo: g.prejogo.ativo } : null;
  });
  const precisaK = so.has('K');
  if (r.plano) {
    const tP = r.plano.t0 + 0.6 * (r.plano.t1 - r.plano.t0);
    r.pre = await pg.evaluate(([t, opc]) => { const g = window.__golaco; g.prejogo.irPara(t); return window.__P.quadro(null, opc); },
      [tP, { cor: precisaK || papel !== 'oposta', mascaras: semAA && precisaK ? CATS_PRE : null, png: !!pastaPrints }]);
    salvarPng(`cel-${papel}-prejogo`, r.pre?.png);
    await pg.evaluate(() => window.__golaco.prejogo.pularTudo());
  }
  r.bola = await pg.evaluate(() => {
    const g = window.__golaco;
    for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    return { ...g.estado().bola, hash: g.hash(), passos: g.passos, tick: g.mundo.tick };
  });
  r.poses = posesJogo(r.bola);
  r.quadros = {};
  for (const [nome, pose] of Object.entries(r.poses)) {
    r.quadros[nome] = await P(pg, 'quadro', pose, { ssaa: semAA && so.has('A2'), corFisico: so.has('A2'), mascaras: semAA && precisaK ? CATS : null, png: !!pastaPrints });
    salvarPng(`cel-${papel}-${nome}`, r.quadros[nome]?.png);
  }
  return r;
}

/**
 * K(2) e K(3) numa carga (build e oposta; a mesma sequência): o bandeirão da saída (16 s; está na mesma malha das bandeiras e
 * cobre a arquibancada de lá) fechado antes — anda até ele fechar —, as bandeiras de mastro a 50 e 100 m e a torcida na pose do
 * jogo e 0,25 px ao lado (na profundidade da arquibancada de lá).
 */
async function medirK23(pg, cel) {
  cel.bandeirao = await pg.evaluate(() => {
    const g = window.__golaco;
    let n = 0;
    for (; n < 3000; n++) { if (n >= 900 && !(g.estadio?.festaVisual?.abre > 0.001)) break; g.relogio.avancar(1000 / 60, { desenhar: false }); }
    g.desenhar();
    return { passos: n, abre: g.estadio?.festaVisual?.abre ?? null };
  });
  cel.cob = {};
  for (const d of [50, 100]) cel.cob[d] = await P(pg, 'cobertura', poseBandeira(d), ['festa-bandeiras']);
  const pj = cel.poses.jogo, B = baseCam(pj, cel.quadros.jogo.W, cel.quadros.jogo.H);
  const cT = projetar(B, [pj.para[0], 8, -50]).c, dx = (0.25 * 2 * cT * B.tanV * B.asp) / B.W;
  cel.torc = [await P(pg, 'cobertura', pj, ['torcida*']), await P(pg, 'cobertura', desloca(pj, dx), ['torcida*'])];
  // o quadro a de novo DEPOIS do b (a revisão do bloco 3): a cena tem de ser a mesma (o SSAA idêntico); senão a cintilação mede
  // a cena mudando, não a câmera andando 0,25 px
  cel.torcDeNovo = await P(pg, 'cobertura', pj, ['torcida*']);
}

let celBuild = null, celOposta = null, celIgual = null;
const precisaCelBuild = ['S2', 'A2', 'K', 'P', 'Z', 'R', 'P3'].some(x => so.has(x));
const precisaPar = so.has('A2') || so.has('K');
let buildAA = null;
let sondaOk = false;
let exposicaoBase = null;

try {
  if (precisaCelBuild) {
    // ---------------------------------------------------------------- C-build
    let s = await carga(CEL, `${URL_CEL}&prejogo=1`);
    try {
      const sonda = await P(s.pagina, 'sonda');
      cond.renderer = sonda.com?.renderer ?? '';
      sondaOk = !!(sonda.com && sonda.com.antialias === true && sonda.com.samples === 4 && sonda.sem && sonda.sem.samples === 0);
      meta('S2', 'Sonda na página: contexto com antialias pedido (SwiftShader)', `com: antialias ${sonda.com?.antialias} SAMPLES ${sonda.com?.samples} (MAX ${sonda.com?.maxSamples}) · sem: SAMPLES ${sonda.sem?.samples} · ${sonda.com?.renderer}`,
        'true/4 e 0 (senão o teste é INVÁLIDO)', sondaOk, 'estrutura');
      if (!sondaOk) { invalido = 'o SwiftShader não deu SAMPLES 4 com antialias pedido'; throw new Error('sonda'); }
      const info = await P(s.pagina, 'info');
      buildAA = info.samples >= 2;
      guarda('S2.cel.samples', info.samples);
      if (so.has('S2')) meta('S2', 'Build: celular 844×390 dpr 2, Média', `antialias ${info.antialias} SAMPLES ${info.samples} · buffer ${info.W}×${info.H}`, 'SAMPLES 4', info.samples === 4);
      celBuild = await sequenciaCel(s, 'build', !buildAA);
      marcar('celular (build)');
      const pg = s.pagina;

      // ---- K(2): as bandeiras de mastro a 50 e 100 m; K(3): a torcida com a câmera andando 0,25 px (no build)
      if (so.has('K')) { await medirK23(pg, celBuild); marcar('K (bandeiras e torcida)'); }
      // ---- P: chamadas e triângulos no quadro fixo da TV
      if (so.has('P')) {
        const q = celBuild.quadros.jogo;
        guarda('P.chamadas', q.chamadas); guarda('P.triangulos', q.triangulos);
        const rc = ref('P.chamadas'), rt = ref('P.triangulos');
        meta('P', 'Chamadas de desenho no quadro fixo da TV (celular Média, pose do jogo)', `${q.chamadas}${Number.isFinite(rc) ? ` · ref ${rc}` : ' · sem referência'}`, '= ref (+0; a FILA admite ≤ +2)',
          Number.isFinite(rc) ? q.chamadas <= rc : null, Number.isFinite(rc) ? 'meta' : 'info');
        meta('P', 'Triângulos no quadro fixo da TV', `${q.triangulos}${Number.isFinite(rt) ? ` · ref ${rt} (${pct(q.triangulos / rt - 1, 2)})` : ' · sem referência'}`, '≤ ref + 1%',
          Number.isFinite(rt) ? q.triangulos <= rt * 1.01 : null, Number.isFinite(rt) ? 'meta' : 'info');
      }
      // ---- P3 (a base): o gramado da página e a exposição do ACES de dia e de noite
      if (so.has('P3')) {
        const gr = await P(pg, 'isolado', POSE_MEIO, ['gramado']), gl = await P(pg, 'isolado', POSE_MEIO, ['gramado', 'linhas']);
        const Gp = gramadoPagina(u8(gr.cor), u8(gl.cor), POSE_MEIO, gr.W, gr.H);
        celBuild.Gp = Gp;
        for (const k of ['L', 'C', 'h', 'dL', 'bordas', 'dLonge', 'linha']) guarda(`Gp.${k}`, Gp[k]);
        meta('P3', 'Gramado da página, build (pose do meio; a referência da ?gfx=antigo)', `L ${f(Gp.L)} C ${f(Gp.C)} h ${f(Gp.h, 1)}° · ΔL ${f(Gp.dL)} · ${Gp.bordas} bordas em |x| ≤ 20 · longe − perto ${f(Gp.dLonge, 4)} · linha p95 ${f(Gp.linha)}`, '—', null, 'info');
        const dia = await P(pg, 'tom');
        await pg.evaluate(() => window.__golaco.definirHora('noite'));
        const noite = await P(pg, 'tom');
        await pg.evaluate(() => window.__golaco.definirHora('dia'));
        exposicaoBase = { dia: dia.exposicao, noite: noite.exposicao, tom: dia.tom, ACES: dia.ACES };
        guarda('P3.exposicao.dia', dia.exposicao); guarda('P3.exposicao.noite', noite.exposicao);
        // o texto dos programas da torcida e das bandeiras (o da main é a referência do ?gfx=antigo; a revisão do bloco 3)
        const fo = await P(pg, 'fontes');
        guarda('P3.fonte.torcida', fo?.torcida); guarda('P3.fonte.bandeiras', fo?.bandeiras);
        meta('P3', 'O texto dos programas da torcida e das bandeiras, build (FNV-1a; o da main é a referência do ?gfx=antigo)', `torcida ${fo?.torcida ?? '—'} · bandeiras ${fo?.bandeiras ?? '—'}${Number.isFinite(ref('P3.fonte.torcida')) ? ` · main ${ref('P3.fonte.torcida')} / ${ref('P3.fonte.bandeiras')}` : ''}`, '—', null, 'info');
        marcar('P3 (base)');
      }
      // ---- Z: o redimensionar
      if (so.has('Z')) try {
        const z1 = await pg.evaluate(() => { window.__atrib.width = 0; window.__atrib.height = 0; window.dispatchEvent(new Event('resize')); window.visualViewport?.dispatchEvent(new Event('resize')); return { ...window.__atrib }; });
        const W0 = await pg.evaluate(() => { window.__atrib.width = 0; window.__atrib.height = 0; return document.getElementById('tela').width; });
        // (o tamanho novo pelo CDP: o setViewportSize do Playwright no contexto de celular cai no Browser.setWindowBounds e falha)
        // (espera a janela E o buffer mudarem, não um tempo fixo: com o MSAA no SwiftShader um quadro passa de 0,5 s — item 11)
        const cdp = await s.contexto.newCDPSession(pg);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: CEL.h, deviceScaleFactor: CEL.dpr, mobile: true });
        const mudou = await pg.waitForFunction(w0 => innerWidth === 800 && document.getElementById('tela').width !== w0, W0, { timeout: 30000 }).then(() => true, () => false);
        const z2 = await pg.evaluate(() => ({ ...window.__atrib, w: innerWidth, h: innerHeight, W: document.getElementById('tela').width, H: document.getElementById('tela').height }));
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: CEL.w, height: CEL.h, deviceScaleFactor: CEL.dpr, mobile: true });
        const voltou = await pg.waitForFunction(([w, w0]) => innerWidth === w && document.getElementById('tela').width === w0, [CEL.w, W0], { timeout: 30000 }).then(() => true, () => false);
        await cdp.detach().catch(() => {});
        if (!mudou || !voltou) meta('Z', 'Redimensionar: a janela e o buffer mudaram e voltaram', `${mudou ? 'mudou' : 'NÃO mudou em 30 s'} · ${voltou ? 'voltou' : 'NÃO voltou em 30 s'}`, 'os dois', false, 'estrutura');
        const n1 = z1.width + z1.height, n2 = z2.width + z2.height;
        guarda('Z.mesmo', n1); guarda('Z.novo', n2);
        meta('Z', 'Redimensionar com o MESMO tamanho (resize + visualViewport)', `${n1} atribuições a canvas.width/height (${z1.width} + ${z1.height})`, '0 (main: 8)', n1 === 0);
        meta('Z', 'Redimensionar com um tamanho NOVO (844 → 800 px)', `${n2} atribuições (${z2.width} + ${z2.height}) · buffer ${z2.W}×${z2.H} (janela ${z2.w}×${z2.h})`, '2 (main: até 8)', n2 === 2 && z2.w === 800);
      } catch (e) { meta('Z', 'Redimensionar: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); }
      // ---- R(3): a troca imediata (troca e desenha no mesmo evaluate)
      if (so.has('R')) {
        const b = await P(pg, 'trocaImediata', 'baixa'), m = await P(pg, 'trocaImediata', 'media');
        meta('R', 'R3 __golaco.definirQualidade: troca e desenha no mesmo evaluate', `Baixa: ${pct(b.naoPreto)} não preto (${b.q}) · Média: ${pct(m.naoPreto)} não preto (${m.q})`, '≥ 50% não preto nas duas', b.naoPreto >= 0.5 && m.naoPreto >= 0.5, 'estrutura');
        meta('R', 'R3 SAMPLES pela tabela na troca imediata (Média → Baixa → Média)', `${b.antes?.info?.samples} → ${b.depois?.info?.samples} → ${m.depois?.info?.samples}${b.depois?.id !== b.antes?.id ? ' (recriou)' : ''}${m.depois?.id !== m.antes?.id ? ' (recriou)' : ''}`, '4 → 0 → 4',
          b.antes?.info?.samples === 4 && b.depois?.info?.samples === 0 && m.depois?.info?.samples === 4);
      }
    } catch (e) {
      if (!invalido) meta('—', 'Rodou (celular, build)', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
    } finally { await fechar(s); }
    if (invalido) throw new Error('sonda');

    // ---------------------------------------------------------------- C-oposta e C-igual (o antisserrilhado forçado)
    if (celBuild && precisaPar) {
      const aaOposta = !buildAA;
      s = await carga(CEL, `${URL_CEL}&prejogo=1&aa=${aaOposta ? 1 : 0}`, { forca: aaOposta });
      try {
        celOposta = await sequenciaCel(s, 'oposta', !aaOposta);
        const ok = celOposta.info.samples === (aaOposta ? 4 : 0);
        meta('A2', 'Carga oposta: o antisserrilhado forçado pelo addInitScript', `pedido ${aaOposta} → SAMPLES ${celOposta.info.samples}`, aaOposta ? 'SAMPLES 4' : 'SAMPLES 0', ok, 'estrutura');
        if (so.has('K')) await medirK23(s.pagina, celOposta);
      } catch (e) {
        meta('—', 'Rodou (celular, carga oposta)', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
      } finally { await fechar(s); }
      marcar('celular (oposta)');
    }
    if (celBuild && precisaPar) {
      s = await carga(CEL, `${URL_CEL}&prejogo=1&aa=${buildAA ? 1 : 0}`, { forca: buildAA });
      try {
        celIgual = await sequenciaCel(s, 'igual', false);
        const dif = [['pre', celBuild.pre?.cor, celIgual.pre?.cor], ...Object.keys(celBuild.quadros).map(k => [k, celBuild.quadros[k]?.cor, celIgual.quadros[k]?.cor])]
          .map(([k, a, b]) => [k, a && b ? difPx(u8(a), u8(b)) : NaN]);
        const okDif = dif.every(([, n]) => n === 0) && celIgual.bola.hash === celBuild.bola.hash;
        meta('A2', 'Determinismo: a carga forçada IGUAL ao build dá o mesmo quadro, bit a bit', `${dif.map(([k, n]) => `${k} ${n} px`).join(' · ')} · hash ${celIgual.bola.hash === celBuild.bola.hash ? 'igual' : 'DIFERENTE'} (${celBuild.bola.passos} passos)`,
          '0 px em todos (senão a A2 e a K não medem nada)', okDif, 'estrutura');
      } catch (e) {
        meta('—', 'Rodou (celular, carga igual)', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
      } finally { await fechar(s); }
      marcar('celular (igual)');
    }

    // ---------------------------------------------------------------- A2 e K (as contas, em Node)
    if (celBuild && celOposta) {
      const com = buildAA ? celBuild : celOposta, sem = buildAA ? celOposta : celBuild;
      if (so.has('A2')) for (const nome of Object.keys(sem.quadros)) {
        const qs = sem.quadros[nome], qc = com.quadros[nome];
        if (!qs?.ssaa || !qc?.cor) { meta('A2', `A2 serrilhado (${nome})`, 'sem quadro', '—', false, 'estrutura'); continue; }
        const N = qs.W * qs.H, r = serrilhado(u8(qc.cor), u8(qs.cor), u16(qs.ssaa), N, qc.corFisico ? u8(qc.corFisico) : null, qs.corFisico ? u8(qs.corFisico) : null);
        const Eb = buildAA ? r.E1 : r.E0, raz = Eb / r.E0;
        guarda(`A2.${nome}.Ebuild`, Eb); guarda(`A2.${nome}.Esem`, r.E0); guarda(`A2.${nome}.Emsaa`, r.E1); guarda(`A2.${nome}.razao`, raz); guarda(`A2.${nome}.mascara`, r.mascara);
        meta('A2', `A2 serrilhado do quadro inteiro (${nome === 'jogo' ? 'TV na bola' : 'TV com o gol no foco'}): razão E_build / E_semAA`,
          `${f(raz, 2)} · E build ${f(Eb, 4)} · sem AA ${f(r.E0, 4)} · MSAA ${f(r.E1, 4)} (× ${f(r.E1 / r.E0, 2)}) · máscara ${pct(r.mascara, 2)} · build ${buildAA ? 'com' : 'sem'} MSAA`, '≤ 0,6', raz <= 0.6);
      }
      if (so.has('K')) {
        // (1) as franjas: o quadro com MSAA × o sem, nas máscaras das categorias (da carga sem AA)
        const linhas = [];
        const fr = (nome, qc, qs, cats) => {
          for (const [cat, mb] of Object.entries(qs?.mascaras ?? {})) {
            const M = u8(mb);
            if (!contar(M)) { linhas.push({ k: `${nome}.${cat}`, txt: `${cat} (${nome}) fora do quadro` }); continue; }
            const r = franjas(u8(qc.cor), u8(qs.cor), M, qs.W, qs.H);
            linhas.push({ k: `${nome}.${cat}`, cat, nome, ...r, area: contar(M) / (qs.W * qs.H), cats });
          }
        };
        if (sem.pre && com.pre) fr('prejogo', com.pre, sem.pre, CATS_PRE);
        for (const nome of Object.keys(sem.quadros)) fr(nome, com.quadros[nome], sem.quadros[nome], CATS);
        for (const l of linhas) {
          if (!('frac' in l)) { meta('K', `K1 franjas: ${l.k}`, l.txt, '—', null, 'info'); continue; }
          guarda(`K.franjas.${l.k}`, l.frac); guarda(`K.bordas.${l.k}`, l.bordas);
          guarda(`K.franjasFora.${l.k}`, l.fracFora); guarda(`K.bordasFora.${l.k}`, l.bFora); guarda(`K.franjasDentro.${l.k}`, l.fracDentro);
          const rf = ref(`K.franjasFora.${l.k}`);
          const tolF = Math.max(0.0005, (rf ?? 0) * 0.25) * tolRef();
          const onde = l.nome === 'prejogo' ? 'pré-jogo, fachada' : l.nome === 'jogo' ? 'TV na bola' : 'TV com o gol no foco';
          // (a revisão do bloco 3) o letreiro do Estádio Golaço é TRANSPARENTE (a borda pela mistura): a A2C do C10 não o pega e a
          // linha não mede nada (0 px de borda na main e agora); o letreiro OPACO (o dos pórticos do Maracanã, só no pré-jogo da
          // edição pro com o estádio real) foi medido à parte no C10 — fica informativa até o C14 decidir se mede o pro aqui
          const naoMede = l.nome === 'prejogo';
          meta('K', `K1 franjas na silhueta, centro do pixel FORA da região (a amostra extrapolada, N11): ${l.cat} (${onde})`,
            `${pct(l.fracFora, 2)} de ${l.bFora} px de borda (${l.fFora})${l.bordas ? '' : ' (o MSAA não muda a região)'} · região ${pct(l.area, 1)} do quadro${Number.isFinite(rf) ? ` · ref ${pct(rf, 2)}` : ' · sem referência'} · MSAA ${buildAA ? 'do build' : 'forçado'}${naoMede ? ' · o letreiro do Estádio Golaço é transparente: a A2C não o pega (não mede)' : ''}`,
            '≤ 0,2% e ≤ a da main com o MSAA forçado', naoMede ? null : l.fracFora <= 0.002 && (!Number.isFinite(rf) || l.fracFora <= rf + tolF), naoMede ? 'info' : 'meta');
          meta('K', `K1 franjas, centro DENTRO da região (o fundo escondido na mistura: o piso da medida): ${l.cat} (${onde})`,
            `${pct(l.fracDentro, 2)} de ${l.bDentro} px (${l.fDentro}) · todas as bordas ${pct(l.frac, 2)} de ${l.bordas}`, 'informativa', null, 'info');
        }
        // (2) as bandeiras de mastro a 50 e 100 m
        for (const [rot, cel] of [['build', celBuild], ['outra', celOposta]]) {
          for (const d of [50, 100]) {
            const c = cel.cob?.[d];
            if (!c) continue;
            const cx = caixasBandeiras(poseBandeira(d), c.W, c.H);
            const n1 = contarCaixas(u8(c.m1), c.W, cx), n3 = contarCaixas(u8(c.m3), c.W, cx), raz = n1 / n3;
            guarda(`K.cob.${d}.${rot}`, raz);
            const aaRot = rot === 'build' ? (buildAA ? 'com MSAA' : 'sem AA') : (buildAA ? 'sem AA' : 'MSAA forçado');
            const areaCx = cx.reduce((a, b) => a + (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1), 0);
            meta('K', `K2 cobertura das bandeiras de mastro a ${d} m (${rot === 'build' ? 'o build' : 'a carga oposta'}, ${aaRot})`, `${f(raz, 3)} do SSAA (${n1} × ${n3} px em ${cx.length} caixas, ${pct(n3 / areaCx, 0)} delas; bandeirão ${f(cel.bandeirao?.abre, 2)} depois de ${cel.bandeirao?.passos} passos)`,
              rot === 'build' ? '≥ 0,8' : '—', rot === 'build' ? raz >= 0.8 : null, rot === 'build' ? 'meta' : 'info');
          }
        }
        // (3) a torcida: cobertura e cintilação da silhueta (a A2C só entra com ganho medido)
        for (const [rot, cel] of [['build', celBuild], ['outra', celOposta]]) {
          if (!cel.torc?.[0] || !cel.torc?.[1]) continue;
          const [a, b] = cel.torc, a1 = u8(a.m1), b1 = u8(b.m1), a3 = u8(a.m3), b3 = u8(b.m3);
          // a cena parada durante a medida: o quadro a desenhado de novo depois do b = o primeiro (máscara 1× e SSAA)
          const r1 = cel.torcDeNovo ? u8(cel.torcDeNovo.m1) : null, r3 = cel.torcDeNovo ? u8(cel.torcDeNovo.m3) : null;
          let dif1 = 0, dif3 = 0;
          if (r1 && r3) for (let i = 0; i < a1.length; i++) { dif1 += a1[i] ^ r1[i]; dif3 += a3[i] ^ r3[i]; }
          meta('K', `K3 a cena parada durante a medida (${rot === 'build' ? 'o build' : 'a carga oposta'}): o quadro a de novo depois do b`,
            r1 ? `${dif1} px diferentes no 1× · ${dif3} no SSAA · assentada antes: ${cel.assentado ? `${cel.assentado.ok ? 'sim' : 'NÃO'} (${cel.assentado.ms} ms; torcedor 3D ${cel.assentado.torcedores ? 'chegou' : 'não'}, impostor ${cel.assentado.impostor})` : '—'}` : 'não medido',
            '0 · 0', r1 ? dif1 === 0 && dif3 === 0 : false, 'estrutura');
          let x1 = 0, o1 = 0, x3 = 0, o3 = 0;
          for (let i = 0; i < a1.length; i++) { x1 += a1[i] ^ b1[i]; o1 += a1[i] | b1[i]; x3 += a3[i] ^ b3[i]; o3 += a3[i] | b3[i]; }
          const cob = contar(a1) / contar(a3), c1 = x1 / o1, c3 = x3 / o3;
          guarda(`K.torcida.${rot}.cob`, cob); guarda(`K.torcida.${rot}.cint`, c1); guarda(`K.torcida.${rot}.cintSSAA`, c3);
          meta('K', `K3 torcida (${rot === 'build' ? 'o build' : 'a carga oposta'}, ${rot === 'build' ? (buildAA ? 'com MSAA' : 'sem AA') : (buildAA ? 'sem AA' : 'MSAA forçado')}): cobertura e cintilação da silhueta (0,25 px)`,
            `cobertura ${f(cob, 3)} do SSAA · cintilação ${pct(c1, 2)} (SSAA ${pct(c3, 2)}, × ${f(c1 / c3, 2)})`, 'informativa (a A2C só entra se cair sem a cobertura cair > 10%)', null, 'info');
        }
      }
      marcar('A2 e K (contas)');
    }
  }

  // ================================================================== P: a CPU do quadro, PAREADA com a base
  if (so.has('P')) await medirCpu();

  // ================================================================== S2: o tablet e o PC
  if (so.has('S2') || so.has('T')) {
    if (so.has('S2')) for (const [rot, busca, alvo] of [['tablet 1366×1024 com toque, dpr 2, Média', 'q=media&segurar3d=1&replay=0&comemoracao=0', 0], ['tablet com ?aa=1', 'q=media&aa=1&segurar3d=1&replay=0&comemoracao=0', 4]]) {
      const s = await carga({ w: 1366, h: 1024, dpr: 2, toque: true }, busca);
      try {
        const info = await P(s.pagina, 'info');
        guarda(`S2.${alvo ? 'tabletAa1' : 'tablet'}.samples`, info?.samples);
        meta('S2', `Build: ${rot}`, `antialias ${info?.antialias} SAMPLES ${info?.samples} · buffer ${info?.W}×${info?.H} (${f((info?.W * info?.H) / 1e6, 2)} MP)`, `SAMPLES ${alvo}${alvo ? '' : ' (o teto de ~1,2 MP)'}`, info?.samples === alvo);
      } catch (e) { meta('S2', `Build: ${rot}: rodou`, e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    }
    const s = await carga(PC, `${URL_PC}&q=media`);
    try {
      if (so.has('S2')) {
        const info = await P(s.pagina, 'info');
        guarda('S2.pc.samples', info?.samples);
        meta('S2', 'Build: PC 1280×720 (sem toque), Média', `antialias ${info?.antialias} SAMPLES ${info?.samples} · buffer ${info?.W}×${info?.H}`, 'SAMPLES 4', info?.samples === 4);
      }
      if (so.has('T')) {
        const t = await medirTeto(s.pagina, [144], { aquece: 1500, janela: 1000 });
        const r = t[144];
        guarda('T.pc144', r?.porSeg);
        meta('T', 'Teto no PC sem toque, rAF a 144 Hz: sem teto', r ? `${f(r.porSeg, 1)} desenhos/s · intervalo mediano ${f(r.mediana, 2)} ms` : 'não mediu', '144 ± 1', r && Math.abs(r.porSeg - 144) <= 1);
        // (o painel: a tela medida e o teto "—" no PC)
        meta('T', 'O painel no PC a 144 Hz: o rAF e o teto "—"', r ? `perf().refresh ${JSON.stringify(r.painel)} · __golaco.teto ${JSON.stringify(r.estado)}` : 'não mediu', 'hz e rafHz 144 ± 1, teto null; ligado false',
          !!r?.painel && Math.abs(r.painel.hz - 144) <= 1 && Math.abs(r.painel.rafHz - 144) <= 1 && r.painel.teto === null && r.estado?.ligado === false);
      }
    } catch (e) { meta('S2', 'PC Média: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    marcar('S2 (tablet e PC)');
  }

  // ================================================================== T: o teto no celular (rAF falso)
  if (so.has('T')) {
    // (um celular barato de desenhar: 640×300, dpr 1, Baixa — o teto não depende da qualidade)
    const s = await carga({ w: 640, h: 300, dpr: 1, toque: true }, 'prints=1&demo=1&q=baixa&hora=dia&toque=1&semente=4&replay=0&comemoracao=0');
    try {
      const ALVO = { 90: 90, 120: 60, 144: 72, 165: 82.5 }, N_ALVO = { 90: 1, 120: 2, 144: 2, 165: 2 };
      const t = await medirTeto(s.pagina, [90, 120, 144, 165], { aquece: 2600, janela: 2000 });
      for (const hz of [90, 120, 144, 165]) {
        const r = t[hz];
        if (!r) { meta('T', `Teto no celular, rAF a ${hz} Hz`, 'não mediu', `${ALVO[hz]} ± 1`, false); continue; }
        guarda(`T.cel${hz}`, r.porSeg);
        meta('T', `Teto no celular, rAF a ${hz} Hz: desenhos por segundo e ritmo`, `${f(r.porSeg, 1)} desenhos/s · intervalos ${f(r.mediana, 2)} ms (mediana), desvio máx ${f(r.desvio, 2)} ms`,
          `${String(ALVO[hz]).replace('.', ',')} ± 1, regulares (desvio ≤ 1 ms)`, Math.abs(r.porSeg - ALVO[hz]) <= 1 && r.desvio <= 1);
        // (o painel do C11 mostra o rAF e o n do teto: "rAF 120 Hz · teto 1 a cada 2"; o hz é o do ritmo do C13 e o rafHz, a mediana
        // do medidor — duas contas independentes do mesmo rAF; a revisão do bloco 4)
        meta('T', `O painel no celular a ${hz} Hz: o rAF (o ritmo do C13 e a mediana do medidor) e o n do teto`, `perf().refresh ${JSON.stringify(r.painel)} · __golaco.teto ${JSON.stringify(r.estado)}`, `hz e rafHz ${hz} ± 1, teto ${N_ALVO[hz]}`,
          !!r.painel && Math.abs(r.painel.hz - hz) <= 1 && Math.abs(r.painel.rafHz - hz) <= 1 && r.painel.teto === N_ALVO[hz] && r.estado?.n === N_ALVO[hz]);
      }
    } catch (e) { meta('T', 'Teto no celular: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    // a tela antes do jogo tem o próprio ritmo de 30 pelo instante do rAF (o PP_QPS) e passa por cima do teto, como antes: a 144 e
    // a 165 Hz ela desenha a cada 5 quadros da tela (o 1º com ≥ 29,3 ms), 28,8 e 33 por segundo; passando pelo teto (72 e 82,5
    // quadros), a cada 3 quadros dele: 24 e 27,5
    const s2 = await carga({ w: 640, h: 300, dpr: 1, toque: true }, 'prepartida=1&q=baixa&hora=dia&toque=1&semente=4&replay=0&comemoracao=0');
    try {
      const pg = s2.pagina;
      await pg.waitForFunction(() => window.__golaco.prepartida?.aberta, null, { timeout: 60000 }).catch(() => {});
      await pg.waitForFunction(() => { const fu = document.getElementById('prepartida')?.dataset.fundo; return !!fu && fu !== '2d'; }, null, { timeout: 120000 }).catch(() => {});
      await espera(500);
      await P(pg, 'drenarGpu');
      const ALVO_PP = { 144: 144 / 5, 165: 165 / 5 };
      for (const hz of [144, 165]) {
        const a = await pg.evaluate(hz => { window.__P.soContar(true); window.__rafLigar(hz); return { t: window.__raf.t }; }, hz);
        // (aquece: a conta do teto, como na T)
        const ok1 = await esperarRaf(pg, a.t + 2600);
        const b = await pg.evaluate(() => ({ d: window.__golaco.prepartida.desenhos, t: window.__raf.t, aberta: !!window.__golaco.prepartida.aberta, n: window.__golaco.teto?.n ?? null }));
        const ok2 = await esperarRaf(pg, b.t + 2000);
        const c = await pg.evaluate(() => { const r = { d: window.__golaco.prepartida.desenhos, t: window.__raf.t, aberta: !!window.__golaco.prepartida.aberta }; window.__rafLigar(0); window.__P.soContar(false); return r; });
        // (a tela desenha pelo instante do rAF: o relógio de verdade alcança o virtual antes de seguir)
        await pg.waitForFunction(t => performance.now() > t + 50, c.t, { timeout: 20000 }).catch(() => {});
        const porSeg = (c.d - b.d) / ((c.t - b.t) / 1000);
        guarda(`T.tela${hz}`, porSeg);
        meta('T', `A tela antes do jogo a ${hz} Hz no celular: o ritmo dela (30 pelo relógio), sem o teto por cima`,
          `${f(porSeg, 1)} desenhos/s (teto n ${b.n ?? '—'})${ok1 && ok2 ? '' : ' (o relógio virtual NÃO chegou)'}${b.aberta && c.aberta ? '' : ' (a tela fechou)'}`,
          `${f(ALVO_PP[hz], 1)} ± 1 (pelo teto seria ${f(hz / 2 / 3, 1)})`, ok1 && ok2 && b.aberta && c.aberta && Math.abs(porSeg - ALVO_PP[hz]) <= 1);
      }
    } catch (e) { meta('T', 'A tela antes do jogo com o teto: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s2); }
    marcar('T (celular)');
  }

  // ================================================================== R(2): PC Alta → Baixa no pré-jogo (o vão aberto)
  if (so.has('R')) {
    const s = await carga(PC, `${URL_PC}&q=alta&prejogo=1`);
    try {
      const pg = s.pagina;
      const r = await pg.evaluate(() => {
        const g = window.__golaco;
        g.relogio.usarManual(true);
        const p = g.prejogo.planos.find(x => x.id === 'entrada') ?? g.prejogo.planos[0];
        g.prejogo.irPara((p.t0 + p.t1) / 2);
        const antes = { vao: g.prejogo.vao, cv: window.__P.canvasInfo(), np: window.__P.naoPreto() };
        g.definirQualidade('baixa');
        const np = window.__P.naoPreto();
        return { antes, depois: { vao: g.prejogo.vao, cv: window.__P.canvasInfo(), np, plano: g.prejogo.plano } };
      });
      const recriou = r.depois.cv?.id !== r.antes.cv?.id;
      meta('R', 'R2 PC Alta → Baixa no pré-jogo: o recorte do vão das placas continua', `antes: aberto ${r.antes.vao?.aberto}, local ${r.antes.vao?.local} · depois: aberto ${r.depois.vao?.aberto}, local ${r.depois.vao?.local} (${recriou ? 'recriou' : 'mesmo canvas'}; plano ${r.depois.plano})`,
        'local true depois', r.antes.vao?.local === true && r.depois.vao?.local === true);
      meta('R', 'R2 PC Alta → Baixa: o canvas novo com o aria-label', `antes "${r.antes.cv?.aria}" · depois "${r.depois.cv?.aria}" · SAMPLES ${r.antes.cv?.info?.samples} → ${r.depois.cv?.info?.samples} · quadro ${pct(r.depois.np)} não preto`,
        '"Campo 3D" depois', r.depois.cv?.aria === 'Campo 3D' && r.depois.np >= 0.5);
    } catch (e) { meta('R', 'R2 PC Alta → Baixa: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    marcar('R2 (PC no pré-jogo)');
  }

  // ================================================================== P2, R(1), R(4): o celular com a tela antes do jogo
  if (so.has('P2') || so.has('R')) {
    const s = await carga(CEL, 'prepartida=1&q=media&qps=1&perf=1&semente=4&replay=0&comemoracao=0&toque=1&entalhe=1');
    const pg = s.pagina;
    try {
      await pg.waitForFunction(() => window.__golaco.prepartida?.aberta, null, { timeout: 60000 }).catch(() => {});
      // (a tela cedo, item 106, abre com o fundo 2D antes do 3D: o qps atrás da tela só existe com o fundo 3D no ar)
      await pg.waitForFunction(() => { const f = document.getElementById('prepartida')?.dataset.fundo; return !!f && f !== '2d'; }, null, { timeout: 120000 }).catch(() => {});
      const perfApi = () => pg.evaluate(() => {
        const g = window.__golaco;
        if (typeof g.perf !== 'function') return null;
        try { return JSON.parse(JSON.stringify(g.perf())); } catch (e) { return { erro: String(e) }; }
      });
      if (so.has('P2')) {
        // o qps de verdade atrás da tela (os desenhos do 3D, 30 por segundo pelo instante do rAF) × o que o painel mostra: um rAF
        // falso a 60 Hz com o render só contando (no SwiftShader a página desenha 3–6 quadros por segundo de verdade e a razão
        // rAF ÷ desenhos variava de 1,35 a 2,3 entre rodadas; a 60 Hz virtuais ela é 2 na main)
        // (drena a fila da GPU antes: atrás da tela o SwiftShader leva ~3 s por quadro de verdade, e com um quadro em voo a tela
        // não desenhava nos quadros do rAF falso — 1 desenho em 158 quadros, sempre que a carga da P2 não era a 1ª da rodada)
        await espera(500);
        await P(pg, 'drenarGpu');
        const a = await pg.evaluate(() => { const ok = window.__P.soContar(true); const d = window.__golaco.prepartida.desenhos; window.__rafLigar(60); return { ok, d, t: window.__raf.t, n: window.__raf.n, nr: window.__nRender || 0 }; });
        const lidos = [];
        for (const k of [1600, 2100, 2600]) { await esperarRaf(pg, a.t + k); lidos.push(await P(pg, 'painel')); }
        const b = await pg.evaluate(() => { const r = { d: window.__golaco.prepartida.desenhos, t: window.__raf.t, n: window.__raf.n, nr: window.__nRender || 0 }; window.__rafLigar(0); window.__P.soContar(false); return r; });
        // (a tela desenha pelo instante do rAF: o relógio de verdade alcança o virtual antes de seguir)
        await pg.waitForFunction(t => performance.now() > t + 50, b.t, { timeout: 20000 }).catch(() => {});
        const real = (b.d - a.d) / ((b.t - a.t) / 1000);
        const pn = lidos[lidos.length - 1], mostrado = percentil(lidos.map(x => x.qps).filter(Number.isFinite), 0.5);
        guarda('P2.tela.real', real); guarda('P2.tela.mostrado', mostrado);
        const api = await perfApi();
        const chaves = api ? Object.keys(api) : [];
        meta('P2', '__golaco.perf() (?perf=1)', api ? `{${chaves.join(', ')}}` : 'não existe', 'p95, fase, AA, buffer, GPU, refresh', !!api && ['p95', 'fase', 'aa', 'buffer', 'gpu', 'refresh'].every(k => JSON.stringify(api).toLowerCase().includes(k)));
        const txt = pn.texto.replace(/\s+/g, ' ');
        const falta = [['p95', /p95/i], ['fase', /fase|tela|jogo|replay|pausa|pré-jogo|cena/i], ['AA', /\bAA\b|MSAA|SAMPLES|amostras/i], ['buffer', /\d+\s*[×x]\s*\d+/], ['GPU', /SwiftShader|ANGLE|GPU|Mali|Adreno|Apple/i], ['refresh', /Hz/i]].filter(([, re]) => !re.test(txt)).map(([k]) => k);
        meta('P2', 'O painel mostra p95, fase, AA, buffer, GPU e refresh', `"${txt.slice(0, 110)}"${falta.length ? ` · falta: ${falta.join(', ')}` : ''}`, 'tudo', pn.existe && !falta.length);
        meta('P2', 'O painel à vista POR CIMA da tela antes do jogo', `${pn.existe ? (pn.visivel ? `visível, ${pct(pn.topo, 0)} dos pontos por cima${pn.tapado ? ` (tapa: ${pn.tapado})` : ''}` : 'escondido') : 'não existe'}${pn.fixo ? ' (.perf-fixo)' : ` (no #${pn.pai})`}`, '100% por cima', pn.visivel && pn.topo === 1);
        // (a régua é a razão mostrado ÷ desenhado: ~1 com o intervalo entre DESENHOS; na main o painel mostra o ritmo do rAF, 60)
        meta('P2', 'O qps do painel na tela antes do jogo = os desenhos de verdade (N3; rAF falso a 60 Hz)', `mostra ${f(mostrado, 1)} · desenhou ${f(real, 1)} por segundo atrás da tela (× ${f(mostrado / real, 2)}) · ${b.n - a.n} quadros do rAF falso em ${f((b.t - a.t) / 1000, 1)} s, ${b.nr - a.nr} desenhos contados${a.ok ? '' : ' (o render NÃO virou conta)'}`, '0,8–1,25 × os desenhos e ≤ 32',
          Number.isFinite(mostrado) && real > 0 && mostrado / real >= 0.8 && mostrado / real <= 1.25 && mostrado <= 32);
        marcar('P2 (tela)');
      }
      // ---- R(1): pelo ≡ → Opções, Média → Baixa → Média
      if (so.has('R') || so.has('P2')) {
        await pg.click('#prepartida [data-pp="menu"]').catch(() => {});
        await quadrosReais(pg, 3);
        if (!(await pg.evaluate(() => window.__golaco.estado().menuAberto))) { await pg.keyboard.press('KeyP'); await quadrosReais(pg, 3); }
        const menu = await pg.evaluate(() => window.__golaco.estado().menuAberto);
        if (so.has('P2')) {
          const pn = await P(pg, 'painel');
          meta('P2', 'O painel à vista POR CIMA da pausa', menu ? (pn.visivel ? `visível, ${pct(pn.topo, 0)} dos pontos por cima${pn.tapado ? ` (tapa: ${pn.tapado})` : ''}` : 'escondido') : 'a pausa não abriu', '100% por cima', menu && pn.visivel && pn.topo === 1);
        }
        if (so.has('R')) {
          await pg.evaluate(() => document.getElementById('btn-opcoes')?.click());
          await quadrosReais(pg, 2);
          // (a mira já baixada antes das trocas: o programa dela tem de estar no renderizador novo sem esperar a 1ª bola parada — C12)
          await pg.evaluate(() => window.__golaco.bolaParada.carregar()).catch(() => {});
          await quadrosReais(pg, 2);
          await pg.evaluate(() => {
            // (a opacidade de cada amostra à vista: ela já nasce 1 — com o fio travado logo depois, um véu ainda transparente ficaria
            // na tela parada; C12. Escondida antes — display none —, a transição de 0,35 s do .carregando não roda nem sem o
            // 'transition: none' do hud.ocupado: a mutação dele passa aqui, ele cobre só a tela ainda saindo depois do pronto)
            // (a revisão do bloco 4: a mensagem POR CIMA do painel ?perf — a pilha do ponto, não só o checkVisibility —, a pausa inert
            // e o foco na tela de carregar em cada amostra com a mensagem à vista)
            const o = window.__ajuste = { visto: 0, opMin: 1, msgVista: 0, msgLivreMin: 5, msgTapa: [], painelVisto: 0, painelLivreMax: 0, painelSob: [], inertNao: 0, focoFora: 0, focos: [] };
            o.id = setInterval(() => {
              if (!window.__P.ajustando()) return;
              o.visto++;
              const c = document.getElementById('carregando');
              if (c) o.opMin = Math.min(o.opMin, +getComputedStyle(c).opacity);
              const m = window.__P.msgAjustando();
              if (m) {
                o.msgVista++; o.msgLivreMin = Math.min(o.msgLivreMin, m.livres); for (const t of m.cobertos) if (!o.msgTapa.includes(t)) o.msgTapa.push(t);
                if (m.painelLivres != null) { o.painelVisto++; o.painelLivreMax = Math.max(o.painelLivreMax, m.painelLivres); for (const t of m.painelSob) if (!o.painelSob.includes(t)) o.painelSob.push(t); }
              }
              if (!document.getElementById('menu')?.inert) o.inertNao++;
              const a = document.activeElement;
              if (a !== c) { o.focoFora++; const n = a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}` : 'nada'; if (!o.focos.includes(n)) o.focos.push(n); }
            }, 8);
          });
          const troca = async q => {
            const antes = await P(pg, 'canvasInfo');
            const v0 = await pg.evaluate(() => window.__ajuste.visto);
            const ok = await pg.evaluate(q => { const b = document.querySelector(`[data-grupo="qualidade"] [data-valor="${q}"]`); if (!b || !b.getClientRects().length) return false; b.click(); return true; }, q);
            // (a recriação com o MSAA compila tudo no SwiftShader: teto alto, e a troca que não termina REPROVA — nunca lê no meio)
            const t0 = Date.now();
            let terminou = false;
            while (ok && Date.now() - t0 < 90000) { const e = await pg.evaluate(() => ({ q: window.__golaco.qualidade, aj: window.__P.ajustando() })); if (e.q === q && !e.aj) { terminou = true; break; } await espera(40); }
            const qr = await quadrosReais(pg, 3);
            // (o foco de volta na pausa — no botão da qualidade — e a pausa sem o inert)
            const fim = await pg.evaluate(() => { const a = document.activeElement, mn = document.getElementById('menu'); return { inert: !!mn?.inert, foco: a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.dataset?.valor ? `[${a.dataset.valor}]` : ''}` : 'nada', naPausa: !!(a && mn?.contains(a)) }; });
            const depois = await P(pg, 'canvasInfo');
            const v1 = await pg.evaluate(() => window.__ajuste.visto);
            const mira = await P(pg, 'miraCompilada');
            return { ok, antes, depois, ajustando: v1 - v0, aindaAjustando: await P(pg, 'ajustando'), terminou: terminou && qr, s: ((Date.now() - t0) / 1000).toFixed(1), mira, fim };
          };
          const b = await troca('baixa'), m = await troca('media');
          await pg.evaluate(() => clearInterval(window.__ajuste.id));
          meta('R', 'R1 as trocas terminam (a qualidade pedida, sem "Ajustando…", e 3 quadros depois)', `Baixa ${b.terminou ? 'terminou' : 'NÃO terminou'} em ${b.s} s · Média ${m.terminou ? 'terminou' : 'NÃO terminou'} em ${m.s} s`, 'as duas em ≤ 90 s',
            b.terminou && m.terminou, 'estrutura');
          const sam = [b.antes?.info?.samples, b.depois?.info?.samples, m.depois?.info?.samples];
          meta('R', 'R1 pelo ≡ → Opções: Média → Baixa → Média (SAMPLES)', `${menu ? '' : 'a pausa NÃO abriu · '}${b.ok && m.ok ? '' : 'botão não achado · '}${sam.join(' → ')}${b.depois?.id !== b.antes?.id ? ' (recriou)' : ' (mesmo canvas)'}${m.depois?.id !== m.antes?.id ? ' (recriou)' : ' (mesmo canvas)'}`,
            '4 → 0 → 4', sam[0] === 4 && sam[1] === 0 && sam[2] === 4);
          meta('R', 'R1 o canvas depois das trocas: aria-label e inert de antes', `aria "${b.antes?.aria}" → "${b.depois?.aria}" → "${m.depois?.aria}" · inert ${b.antes?.inert} → ${b.depois?.inert} → ${m.depois?.inert}`,
            'os de antes', b.depois?.aria === b.antes?.aria && m.depois?.aria === b.antes?.aria && b.depois?.inert === b.antes?.inert && m.depois?.inert === b.antes?.inert && b.antes?.aria === 'Campo 3D');
          const opMin = await pg.evaluate(() => window.__ajuste.opMin);
          meta('R', 'R1 a tela "Ajustando…" aparece e some em cada troca', `vista ${b.ajustando}× e ${m.ajustando}× (amostras de 8 ms) · à vista no fim: ${b.aindaAjustando || m.aindaAjustando ? 'SIM' : 'não'}`,
            'vista nas duas e fora no fim', b.ajustando > 0 && m.ajustando > 0 && !b.aindaAjustando && !m.aindaAjustando);
          meta('R', 'R1 a tela "Ajustando…" já opaca em toda amostra à vista (sem a transição de 0,35 s do .carregando; C12)', `a menor opacidade vista ${f(opMin, 3)} em ${b.ajustando + m.ajustando} amostras`,
            '≥ 0,99', b.ajustando + m.ajustando > 0 && opMin >= 0.99);
          const aj = await pg.evaluate(() => { const o = window.__ajuste; return { msgVista: o.msgVista, msgLivreMin: o.msgLivreMin, msgTapa: o.msgTapa, painelVisto: o.painelVisto, painelLivreMax: o.painelLivreMax, painelSob: o.painelSob, inertNao: o.inertNao, focoFora: o.focoFora, focos: o.focos }; });
          meta('R', 'R1 a mensagem "Ajustando…" POR CIMA de tudo e o painel ?perf debaixo da tela (5 pontos na linha dela e 3 do painel, a pilha do ponto; a revisão do bloco 4)',
            `${aj.msgVista} amostras com a mensagem · a pior com ${aj.msgLivreMin} de 5 pontos livres${aj.msgTapa.length ? ` (tapa: ${aj.msgTapa.join(', ')})` : ''} · o painel em ${aj.painelVisto}: no máximo ${aj.painelLivreMax} de 3 pontos à vista${aj.painelSob.length ? ` (por cima dele: ${aj.painelSob.join(', ')})` : ''}`,
            '5 de 5 e o painel 0 de 3 em toda amostra', aj.msgVista > 0 && aj.msgLivreMin === 5 && aj.painelVisto > 0 && aj.painelLivreMax === 0);
          meta('R', 'R1 durante a troca a pausa fica inert e o foco na tela de carregar; no fim, a pausa sem o inert e o foco de volta nela (a revisão do bloco 4)',
            `amostras: pausa sem inert ${aj.inertNao}, foco fora ${aj.focoFora}${aj.focos.length ? ` (${aj.focos.join(', ')})` : ''} · fim: Baixa inert ${b.fim?.inert}, foco ${b.fim?.foco}; Média inert ${m.fim?.inert}, foco ${m.fim?.foco}`,
            '0; 0; inert false e o foco na pausa nas duas', b.ajustando + m.ajustando > 0 && aj.inertNao === 0 && aj.focoFora === 0 && [b, m].every(x => x.fim && !x.fim.inert && x.fim.naPausa));
          const mz = x => (x.mira ? `${x.mira.programa ? 'com programa' : 'SEM programa'}${x.mira.visivel ? ' (à vista: não vale)' : ''}` : 'sem o módulo');
          meta('R', 'R1 a mira (o módulo baixado antes) com programa no renderizador NOVO depois de cada troca, sem ser desenhada (C12)', `Baixa: ${mz(b)} · Média: ${mz(m)}`,
            'com programa nas duas', [b, m].every(x => x.mira?.programa && !x.mira.visivel));
        }
        // de volta à tela (Esc: Opções → lista → fecha)
        await pg.keyboard.press('Escape'); await quadrosReais(pg, 2);
        await pg.keyboard.press('Escape'); await quadrosReais(pg, 2);
        if (await pg.evaluate(() => window.__golaco.estado().menuAberto)) { await pg.evaluate(() => window.__golaco.fecharMenu()); await quadrosReais(pg, 2); }
        marcar('R1 (pausa)');
      }
      // ---- o jogo: o painel no jogo, na pausa e no replay; a mira; a perda de contexto
      await pg.evaluate(() => window.__golaco.prepartida.jogar());
      await pg.waitForFunction(() => !window.__golaco.prepartida.aberta, null, { timeout: 15000 }).catch(() => {});
      // (a tela sai por uma animação CSS, no relógio de verdade: o painel "no jogo" só se lê com ela fora da vista — lida no meio
      // do esmaecimento, o véu dela ainda tapa o painel)
      await pg.waitForFunction(() => { const pp = document.getElementById('prepartida'); return !pp || pp.hidden || !pp.checkVisibility({ opacityProperty: true, visibilityProperty: true }); }, null, { timeout: 30000 }).catch(() => {});
      await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: i % 30 === 29 }); });
      if (so.has('P2')) {
        const noJogo = await P(pg, 'painel');
        await pg.evaluate(() => { window.__golaco.abrirMenu(); });
        await pg.evaluate(() => window.__golaco.relogio.avancar(1000 / 60));
        const naPausa = await P(pg, 'painel');
        await pg.evaluate(() => { window.__golaco.fecharMenu(); window.__golaco.relogio.avancar(1000 / 60); });
        await pg.waitForFunction(() => window.__golaco.sobDemanda?.ja() ?? true, null, { timeout: 120000 });
        const rep = await pg.evaluate(() => {
          const g = window.__golaco;
          g.replay.menu();
          for (let i = 0; i < 6; i++) g.relogio.avancar(1000 / 60);
          return { ativo: !!g.replay.estado?.ativo, classe: document.documentElement.classList.contains('em-replay') };
        });
        const noReplay = await P(pg, 'painel');
        await pg.evaluate(() => { const g = window.__golaco; g.replay.pular(); g.relogio.avancar(1000 / 60); });
        const dz = p => (p.existe ? (p.visivel ? `visível, ${pct(p.topo, 0)} por cima${p.tapado ? ` (tapa: ${p.tapado})` : ''}` : 'escondido') : 'não existe');
        meta('P2', 'O painel no jogo, na pausa (no jogo) e no replay', `jogo: ${dz(noJogo)} · pausa: ${dz(naPausa)} · replay${rep.ativo ? '' : ' (NÃO começou)'}: ${dz(noReplay)}`,
          'visível e por cima nos três', rep.ativo && [noJogo, naPausa, noReplay].every(p => p.visivel && p.topo === 1));
        const api = await perfApi();
        meta('P2', '__golaco.perf() no jogo: a fase', api ? `fase ${JSON.stringify(api.fase ?? null)}` : 'não existe', 'a fase do jogo', !!api && /jogo/i.test(String(api.fase ?? '')));
        marcar('P2 (jogo, pausa, replay)');
        // ---- o painel NÃO pega toque (a revisão do bloco 4: com pointer-events: auto ele tapava o LANÇAMENTO, a ENFIADA, a
        // DIVIDIDA e o analógico no celular e os botões das Opções da pausa): os botões de toque e o analógico no jogo em 844×390,
        // 667×375 e 568×320 e os controles das Opções da pausa em 844×390 e 568×320 — o elementFromPoint de verdade nunca é ele
        const dim0 = pg.viewportSize();
        const quadro = () => pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 2 }); });
        const toque = [], opcoes = [];
        try {
          for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
            await pg.setViewportSize({ width: w, height: h });
            await quadrosReais(pg, 2); await quadro(); await quadrosReais(pg, 2);
            toque.push({ tela: `${w}×${h}`, ...(await P(pg, 'toqueLivre', '#toque .btn-toque, #zona-analogico')) });
            if (w !== 667) {
              await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-opcoes')?.click(); });
              await quadrosReais(pg, 2); await quadro();
              opcoes.push({ tela: `${w}×${h}`, ...(await P(pg, 'toqueLivre', '#menu button, #menu input, #menu select, #menu [role="slider"]')) });
              await pg.evaluate(() => window.__golaco.fecharMenu());
              await quadro();
            }
          }
        } finally {
          await pg.setViewportSize(dim0).catch(() => {});
          await quadrosReais(pg, 2); await quadro();
        }
        const dt = x => `${x.tela}: ${x.nRoubados} de ${x.pontos} pontos (${x.sobPainel} sob a caixa do painel ${JSON.stringify(x.painel)})${x.roubados.length ? ` — ${x.roubados.join(', ')}` : ''}`;
        meta('P2', 'O painel ?perf não pega toque: os botões de toque e o analógico no jogo (5 pontos de cada; 844×390, 667×375, 568×320)', toque.map(dt).join(' · '),
          '0 pontos tomados pelo painel; o painel sobre algum alvo', toque.length === 3 && toque.every(x => x.alvos > 0 && x.nRoubados === 0) && toque.some(x => x.sobPainel > 0));
        meta('P2', 'O painel ?perf não pega toque: os controles das Opções da pausa (844×390, 568×320)', opcoes.map(dt).join(' · '),
          '0 pontos tomados pelo painel; o painel sobre algum controle', opcoes.length === 2 && opcoes.every(x => x.alvos > 0 && x.nRoubados === 0) && opcoes.some(x => x.sobPainel > 0));
        marcar('P2 (o toque livre)');
      }
      if (so.has('R')) {
        // a mira da falta (o módulo sob demanda; a cobrança do humano), depois das trocas do R1
        const montada = await pg.evaluate(async () => {
          const g = window.__golaco;
          await g.bolaParada.carregar();
          g.forcarEntrada(null);
          g.faltaDeTeste({ u: 22, w: 4 });
          let e = null;
          for (let i = 0; i < 600; i++) {
            g.relogio.avancar(1000 / 60, { desenhar: false });
            e = g.bolaParada.estado;
            if (e?.ativa && e.mistura >= 1 && g.mundo.parada && g.mundo.tick >= g.mundo.parada.pronta) break;
          }
          for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 11 });
          return { ativa: !!g.bolaParada.estado?.ativa, tipo: g.mundo.parada?.tipo ?? null };
        });
        const m1 = await P(pg, 'mira');
        meta('R', 'R1 a mira da falta desenha depois das trocas de qualidade', `${montada.tipo ?? 'sem parada'} (câmera da cobrança ${m1.ativa ? 'ativa' : 'NÃO ativa'}) · ${m1.n} px com × sem a linha`, '≥ 150 px', m1.n >= 150);
        // R(4): estraga os ganchos, perde e restaura o contexto
        const r4 = await pg.evaluate(async () => {
          const cv = document.getElementById('tela'), gl = cv.__ctx, ext = gl?.getExtension('WEBGL_lose_context');
          if (!ext) return { ext: false };
          const ev = { perdeu: 0, voltou: 0 };
          cv.addEventListener('webglcontextlost', () => { ev.perdeu++; });
          cv.addEventListener('webglcontextrestored', () => { ev.voltou++; });
          ev.sabotado = window.__P.sabotarGanchos();
          // (a linha da mira escondida: o desenho depois da volta não a compila — só o aquecimento do contexto novo, C12)
          window.__golaco.bolaParada.linha(false);
          ext.loseContext();
          await new Promise(ok => setTimeout(ok, 150));
          const perdido = gl.isContextLost();
          ext.restoreContext();
          for (let i = 0; i < 100 && (gl.isContextLost() || !ev.voltou); i++) await new Promise(ok => setTimeout(ok, 30));
          const mira = window.__P.miraCompilada();
          window.__golaco.bolaParada.linha(true);
          return { ext: true, perdido, restaurado: !gl.isContextLost(), mira, ...ev };
        });
        await quadrosReais(pg, 2);
        const np = await P(pg, 'naoPreto');
        const gan = await P(pg, 'ganchos');
        const m2 = await P(pg, 'mira');
        meta('R', 'R4 WEBGL_lose_context: perde, restaura e o quadro desenha', r4.ext ? `perdeu ${r4.perdido} (${r4.perdeu} evento) · restaurou ${r4.restaurado} (${r4.voltou} evento) · ${pct(np)} não preto` : 'sem a extensão',
          'restaurado e ≥ 50% não preto', r4.ext && r4.restaurado && np >= 0.5, 'estrutura');
        meta('R', 'R4 os ganchos depois do contexto restaurado (estragados antes de perder: a A2C dos finos e da torcida = SAMPLES ≥ 2)',
          `estragados: A2C ${r4.sabotado?.a2c} (torcida ${r4.sabotado?.a2cTorcida}) · depois: gols ${gan.temGols} · A2C ${gan.a2c} (torcida ${gan.a2cTorcida}; SAMPLES ${gan.samples})`, 'os ganchos refazem as duas',
          gan.temGols && gan.a2c === (gan.samples >= 2) && gan.a2cTorcida === (gan.samples >= 2));
        // (a revisão do bloco 4: o uAlturaBuffer é refeito a cada desenho pelo onBeforeRender da malha — campo.js —, não pelo gancho;
        // sem os ganchos ele ainda dá a altura: estrutura)
        meta('R', 'R4 o uAlturaBuffer = drawingBufferHeight depois do contexto restaurado (estragado antes; o onBeforeRender o refaz a cada desenho)',
          `estragado ${r4.sabotado?.uAltura ?? 'não existe'} · depois ${gan.uAltura ?? 'não existe'} (buffer ${gan.H})`, '= a altura do buffer', gan.uAltura === gan.H, 'estrutura');
        meta('R', 'R4 a mira desenha depois do contexto restaurado', `${m2.n} px com × sem a linha`, '≥ 150 px', m2.n >= 150);
        meta('R', 'R4 a mira com programa no contexto restaurado antes de ser desenhada (o aquecimento do C12; a linha escondida)', r4.mira ? `${r4.mira.programa ? 'com programa' : 'SEM programa'}${r4.mira.visivel ? ' (à vista: não vale)' : ''}` : 'sem o módulo',
          'com programa', !!r4.mira?.programa && !r4.mira.visivel);
        marcar('R1 (mira) e R4 (contexto)');
      }
    } catch (e) {
      meta('—', 'Rodou (celular com a tela antes do jogo)', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
    } finally {
      anotarErros(s);
      await fechar(s);
    }
  }

  // ================================================================== R5: o compileAsync que nunca resolve (a revisão do bloco 4)
  if (so.has('R')) {
    // O KHR_parallel_shader_compile FALSO: a extensão existe e a GPU nunca diz "pronto" (o COMPLETION_STATUS_KHR sempre false) — o
    // compileAsync do r170 sonda a cada 10 ms e nunca resolve, como com o contexto perdido. O SwiftShader do CI não tem a extensão:
    // sem isto, nenhum teste passa pelo caminho dele. Sem o prazo do compilarAntesDoDesenho, a carga com a tela cedo nunca chega ao
    // pronto (também na main: o await vem do item 106) e a troca pela pausa nunca termina, com o 3D sem desenhar
    const INIT_KHR = () => {
      const PR = WebGL2RenderingContext.prototype, ge = PR.getExtension, gpp = PR.getProgramParameter;
      PR.getExtension = function (n) { return n === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: 0x91b1, maxShaderCompilerThreadsKHR() {} } : ge.call(this, n); };
      PR.getProgramParameter = function (p, n) { return n === 0x91b1 ? false : gpp.call(this, p, n); };
    };
    const s = await carga(CEL, 'prepartida=1&q=media&semente=4&replay=0&comemoracao=0&toque=1&entalhe=1', { init2: INIT_KHR, esperar: false });
    const pg = s.pagina;
    try {
      const t0 = Date.now();
      const pronto = await pg.waitForFunction(() => window.__golaco?.pronto, null, { timeout: 90000 }).then(() => true, () => false);
      const tPronto = (Date.now() - t0) / 1000;
      const khr = pronto ? await pg.evaluate(() => !!document.getElementById('tela')?.__ctx?.getExtension('KHR_parallel_shader_compile')) : null;
      meta('R', 'R5 o compileAsync que nunca resolve (o KHR falso): a carga com a tela cedo chega ao pronto (o prazo de 3 s)', pronto ? `pronto em ${f(tPronto, 1)} s (KHR ${khr ? 'falso no ar' : 'NÃO'})` : 'NÃO chegou ao pronto em 90 s',
        'pronto em ≤ 90 s', pronto && khr);
      if (pronto) {
        s.inst = await pg.evaluate(instalarPagina);
        await pg.evaluate(() => window.__golaco.prepartida.jogar());
        await pg.waitForFunction(() => !window.__golaco.prepartida.aberta, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForFunction(() => { const pp = document.getElementById('prepartida'); return !pp || pp.hidden || !pp.checkVisibility({ opacityProperty: true, visibilityProperty: true }); }, null, { timeout: 30000 }).catch(() => {});
        await quadrosReais(pg, 3);
        // a pausa no jogo (o relógio de verdade: fechada, a partida andaria) → Opções → Baixa com Esc e Esc no meio da troca (das
        // Opções à lista e a pausa fechada), depois → Média com o P (fecharia) — uma tecla que fecha por troca: a que reabre
        // esconderia o tick andando
        await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-opcoes')?.click(); });
        await quadrosReais(pg, 3);
        const trocaComTeclas = async (q, teclas) => {
          const e0 = await pg.evaluate(() => ({ tick: window.__golaco.estado().tick }));
          const ok = await pg.evaluate(q => { const b = document.querySelector(`[data-grupo="qualidade"] [data-valor="${q}"]`); if (!b || !b.getClientRects().length) return false; b.click(); return true; }, q);
          const tT = Date.now();
          const amostras = [];
          let k = 0, terminou = false;
          while (ok && Date.now() - tT < 40000) {
            const e = await pg.evaluate(() => { const g = window.__golaco, st = g.estado(); return { t: st.tick, menu: st.menuAberto, trocando: g.qualidadeEstado?.trocando, q: g.qualidade, inert: !!document.getElementById('menu')?.inert }; });
            amostras.push(e);
            if (e.q === q && !e.trocando) { terminou = true; break; }
            if (e.trocando && k < teclas.length) { await pg.keyboard.press(teclas[k]); k++; }
            await espera(120);
          }
          const sT = (Date.now() - tT) / 1000;
          await quadrosReais(pg, 3);
          const e1 = await pg.evaluate(() => ({ tick: window.__golaco.estado().tick, menu: window.__golaco.estado().menuAberto, aj: window.__P.ajustando(), inert: !!document.getElementById('menu')?.inert }));
          return { q, ok, terminou, sT, teclas: k, de: teclas.length, durante: amostras.filter(a => a.trocando), e0, e1 };
        };
        const tb = await trocaComTeclas('baixa', ['Escape', 'Escape']);
        const tm = await trocaComTeclas('media', ['KeyP']);
        meta('R', 'R5 a troca pela pausa com o compileAsync que nunca resolve termina (o prazo de 3 s; depois o 1º desenho compila)',
          [tb, tm].map(x => (x.ok ? `${x.q}: ${x.terminou ? 'terminou' : 'NÃO terminou'} em ${f(x.sT, 1)} s${x.e1.aj ? ' ("Ajustando…" no fim)' : ''}` : `${x.q}: o botão não achado`)).join(' · '),
          'as duas em ≤ 40 s e a tela sai', [tb, tm].every(x => x.ok && x.terminou && !x.e1.aj));
        const dt = x => `${x.q} com ${x.de === 2 ? 'Esc, Esc' : 'P'}: ${x.teclas} tecla(s) em ${x.durante.length} amostras · a pausa aberta em ${x.durante.filter(a => a.menu).length}, inert em ${x.durante.filter(a => a.inert).length} · tick ${x.e0.tick} → ${x.e1.tick} · no fim: pausa ${x.e1.menu ? 'aberta' : 'FECHADA'}, inert ${x.e1.inert}`;
        meta('R', 'R5 no meio da troca, Esc, Esc (uma troca) e P (a outra) não fecham a pausa nem andam o jogo (a pausa inert; a revisão do bloco 4)',
          [tb, tm].map(dt).join(' · '), 'as teclas no meio; a pausa aberta e inert em toda amostra; o tick parado; no fim a pausa aberta sem inert',
          [tb, tm].every(x => x.teclas === x.de && x.durante.length >= 3 && x.durante.every(a => a.menu && a.inert) && x.e1.menu && !x.e1.inert && x.e1.tick === x.e0.tick));
      }
    } catch (e) { meta('R', 'R5 o KHR falso: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    marcar('R5 (o compileAsync que nunca resolve)');
  }

  // ================================================================== Q: a queda
  if (so.has('Q')) {
    // (sem ?q: a Automática; webdriver: sem a tela antes do jogo nem o pré-jogo; um celular menor — 640×300, dpr 1 — para as
    // recargas: a Média e o MSAA valem nele do mesmo jeito)
    const s = await carga({ w: 640, h: 300, dpr: 1, toque: true }, 'semente=4&replay=0&comemoracao=0&toque=1');
    const pg = s.pagina;
    const prefs = () => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}'); } catch (_) { return {}; } });
    try {
      // (1) a queda natural: um rAF falso a 20 Hz COM tremor (o relógio virtual; regular, ele cairia na regra do ritmo preso e
      // a guarda do webdriver não seria testada) por 8,6 s — duas janelas lentas depois dos 3 s — cai na sessão e não grava (o
      // render só conta: a queda olha o ritmo dos quadros, não os pixels)
      const q0 = await pg.evaluate(() => ({ q: window.__golaco.qualidade, escolha: window.__golaco.estado().escolhaQualidade }));
      const t0 = await pg.evaluate(() => { const q0 = window.__golaco.qualidade; window.__P.soContar(true); window.__rafLigar(20, true); window.__vigiaQ = { q0, n0: window.__raf.n, t0: window.__raf.t }; return window.__raf.t; });
      const chegou = await esperarRaf(pg, t0 + 8600, 120000);
      const q1 = await pg.evaluate(() => { const V = window.__vigiaQ; return { q: window.__golaco.qualidade, n: window.__raf.n - V.n0, nQueda: V.n == null ? null : V.n - V.n0, sQueda: V.t == null ? null : (V.t - V.t0) / 1000 }; });
      await pg.evaluate(() => { window.__rafLigar(0); window.__P.soContar(false); });
      const p1 = await prefs();
      meta('Q', 'Q queda natural com webdriver (rAF falso a 20 Hz com tremor, Automática): cai na sessão', `${q0.q} (${q0.escolha}) → ${q1.q}${q1.nQueda != null ? ` no quadro virtual ${q1.nQueda} (${f(q1.sQueda, 1)} s)` : ' (não caiu)'} · ${q1.n} quadros em 8,6 s${chegou ? '' : ' (o relógio virtual NÃO chegou a 8,6 s)'}`, 'media → baixa', q0.q === 'media' && q1.q === 'baixa');
      meta('Q', 'Q queda natural com webdriver: NÃO grava', `preferências: ${JSON.stringify(p1).slice(0, 120)}`, 'sem qualidadeQueda', !('qualidadeQueda' in p1));
      // (2) a recarga: abre na Média (nada gravado); __golaco.quedaDeTeste()
      await irPara(s, true);
      const q2 = await pg.evaluate(() => ({ q: window.__golaco.qualidade, info: window.__P.info() }));
      meta('Q', 'Q a recarga depois da queda natural abre na Média', `${q2.q} · SAMPLES ${q2.info?.samples}`, 'media', q2.q === 'media');
      const dt = await pg.evaluate(() => {
        const g = window.__golaco;
        if (typeof g.quedaDeTeste !== 'function') return null;
        const antes = window.__P.canvasInfo();
        let ret = null;
        try { ret = g.quedaDeTeste(); } catch (e) { ret = { erro: String(e) }; }
        g.relogio.avancar(1000 / 60);
        const info = document.getElementById('info-qualidade');
        return { antes, depois: window.__P.canvasInfo(), q: g.qualidade, ret: ret && typeof ret === 'object' ? JSON.parse(JSON.stringify(ret)) : ret, linha: info ? info.textContent : null };
      });
      const p2 = await prefs();
      if (!dt) {
        meta('Q', 'Q __golaco.quedaDeTeste()', 'não existe', 'o mesmo canvas, baixa, SAMPLES 4, gravada, dita na pausa', false);
      } else {
        meta('Q', 'Q quedaDeTeste: o mesmo canvas, Baixa, SAMPLES continua 4', `${dt.depois?.id === dt.antes?.id ? 'mesmo canvas' : 'RECRIOU'} · ${dt.q} · SAMPLES ${dt.antes?.info?.samples} → ${dt.depois?.info?.samples}`, 'mesmo canvas, baixa, 4',
          dt.depois?.id === dt.antes?.id && dt.q === 'baixa' && dt.depois?.info?.samples === 4);
        meta('Q', 'Q quedaDeTeste: gravada nas preferências e dita na pausa', `preferências: ${JSON.stringify(p2.qualidadeQueda ?? null)} · pausa: "${dt.linha}"${dt.ret?.erro ? ` · ERRO: ${dt.ret.erro.slice(0, 160)}` : ''}`, 'qualidadeQueda e a linha da pausa',
          !!p2.qualidadeQueda && /segurou|queda|caiu/i.test(dt.linha || ''));
      }
      // (3) a recarga em Automática abre na Baixa com SAMPLES 0; escolher a Média apaga a queda
      await irPara(s, true);
      const q3 = await pg.evaluate(() => ({ q: window.__golaco.qualidade, escolha: window.__golaco.estado().escolhaQualidade, info: window.__P.info() }));
      meta('Q', 'Q a recarga depois da queda gravada abre na Baixa', `${q3.q} (${q3.escolha}) · SAMPLES ${q3.info?.samples}`, 'baixa, SAMPLES 0', q3.q === 'baixa' && q3.info?.samples === 0);
      await pg.evaluate(() => window.__golaco.definirQualidade('media'));
      const p3 = await prefs();
      meta('Q', 'Q escolher a Média apaga a queda', `preferências: qualidade ${JSON.stringify(p3.qualidade)} · qualidadeQueda ${JSON.stringify(p3.qualidadeQueda ?? null)}`, 'sem qualidadeQueda',
        dt ? !('qualidadeQueda' in p3) : null, dt ? 'meta' : 'info');
      // (4) o teto, C13: a 120 Hz o celular desenha 60 — a queda mede os quadros DESENHADOS e 60 ≥ 30 não é "o aparelho não segura":
      // um rAF falso a 120 Hz por 8,6 s de volta na Automática não cai. No FIM da Q: com o render de verdade do SwiftShader (3–6
      // quadros por segundo) a página cai sozinha depois de 3 + 2,5 s, e no meio da Q isso tirava a Média do quedaDeTeste
      await pg.evaluate(() => window.__golaco.definirQualidade('auto'));
      const t120 = await pg.evaluate(() => { window.__P.soContar(true); window.__desenhos = []; window.__rafLigar(120); window.__vigiaQ = { q0: window.__golaco.qualidade, n0: window.__raf.n, t0: window.__raf.t }; return window.__raf.t; });
      const chegou120 = await esperarRaf(pg, t120 + 8600, 120000);
      const q120 = await pg.evaluate(() => {
        const V = window.__vigiaQ, d = window.__desenhos ?? [];
        const fim = window.__raf.t, ult = d.filter(t => t > fim - 5000);
        const r = { q0: V.q0, q: window.__golaco.qualidade, porSeg: ult.length / 5, nQueda: V.n == null ? null : V.n - V.n0, n: window.__golaco.teto?.n ?? null };
        window.__rafLigar(0); window.__P.soContar(false); window.__desenhos = null; window.__vigiaQ = null;
        return r;
      });
      meta('Q', 'Q com o teto: rAF falso a 120 Hz por 8,6 s na Automática, a queda NÃO cai', `${q120.q0} → ${q120.q}${q120.nQueda != null ? ` (caiu no quadro virtual ${q120.nQueda})` : ''} · ${f(q120.porSeg, 1)} desenhos/s nos últimos 5 s (teto n ${q120.n ?? '—'})${chegou120 ? '' : ' (o relógio virtual NÃO chegou a 8,6 s)'}`,
        'media', chegou120 && q120.q0 === 'media' && q120.q === 'media');
    } catch (e) {
      meta('—', 'Rodou (a queda)', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
    } finally { await fechar(s); }
    marcar('Q (queda)');
  }

  // ================================================================== P3: ?gfx=antigo e ?tom=neutro
  if (so.has('P3')) {
    let s = await carga(CEL, `${URL_CEL}&gfx=antigo`);
    try {
      const info = await P(s.pagina, 'info');
      meta('P3', '?gfx=antigo: SAMPLES na Média', `antialias ${info?.antialias} SAMPLES ${info?.samples}`, 'SAMPLES 0', info?.samples === 0);
      const gr = await P(s.pagina, 'isolado', POSE_MEIO, ['gramado']), gl = await P(s.pagina, 'isolado', POSE_MEIO, ['gramado', 'linhas']);
      const Gp = gramadoPagina(u8(gr.cor), u8(gl.cor), POSE_MEIO, gr.W, gr.H);
      const TOL = { L: 0.005, C: 0.003, h: 1, dL: 0.004, bordas: 0, dLonge: 0.004, linha: 0.006 };
      const tem = Object.keys(TOL).every(k => Number.isFinite(ref(`Gp.${k}`)));
      const desv = Object.entries(TOL).map(([k, t]) => [k, Gp[k] - ref(`Gp.${k}`), t * tolRef()]);
      meta('P3', '?gfx=antigo: o gramado da página = o da main (G1–G5 da página)',
        `L ${f(Gp.L)} C ${f(Gp.C)} h ${f(Gp.h, 1)}° · ΔL ${f(Gp.dL)} · ${Gp.bordas} bordas · longe − perto ${f(Gp.dLonge, 4)} · linha ${f(Gp.linha)}${tem ? ` · desvios ${desv.map(([k, d]) => `${k} ${f(d, 4)}`).join(', ')}` : ' · sem referência'}`,
        'cada um a ± tolerância da referência', tem ? desv.every(([, d, t]) => Math.abs(d) <= t + 1e-9) : null, tem ? 'meta' : 'info');
      // (a revisão do bloco 3) o ?gfx=antigo desfaz também o C10: o texto dos programas da torcida e das bandeiras = o da main
      // (o ramo do impostor e o recorte dos letreiros pelo teste-gramado G6 e pelo render/util.js recorteAA), sem a A2C
      const fo = await P(s.pagina, 'fontes'), rT = ref('P3.fonte.torcida'), rB = ref('P3.fonte.bandeiras');
      const temF = Number.isFinite(rT) && Number.isFinite(rB);
      meta('P3', '?gfx=antigo: o texto dos programas da torcida e das bandeiras = o da main (e a torcida sem A2C)',
        `torcida ${fo?.torcida ?? '—'} · bandeiras ${fo?.bandeiras ?? '—'} · A2C ${fo?.a2c ? 'LIGADA' : 'não'}${temF ? ` · main ${rT} / ${rB}` : ' · sem referência'}`,
        'iguais à main; sem A2C', temF ? fo?.torcida === rT && fo?.bandeiras === rB && !fo?.a2c : null, temF ? 'meta' : 'info');
    } catch (e) { meta('P3', '?gfx=antigo: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    s = await carga(CEL, `${URL_CEL}&tom=neutro`);
    try {
      const pg = s.pagina;
      const base = exposicaoBase ?? (ref('P3.exposicao.dia') ? { dia: ref('P3.exposicao.dia'), noite: ref('P3.exposicao.noite') } : null);
      const lidos = [];
      const ler = async rot => { const t = await P(pg, 'tom'); lidos.push({ rot, ...t }); return t; };
      await ler('dia');
      await pg.evaluate(() => window.__golaco.definirHora('noite'));
      await ler('noite');
      await pg.evaluate(() => window.__golaco.definirHora('dia'));
      // recriações: Média → Alta → Baixa recria nas duas versões (na main Média → Alta e Alta → Baixa; com o MSAA na Média, Alta → Baixa)
      for (const q of ['alta', 'baixa']) { await pg.evaluate(q => window.__golaco.definirQualidade(q), q); await ler(`dia, ${q}`); }
      await pg.evaluate(() => window.__golaco.definirHora('noite'));
      await ler('noite, baixa');
      const ids = new Set(lidos.map(x => x.cv?.id));
      const esperado = rot => (base ? (rot.startsWith('noite') ? base.noite : base.dia) * 1.40 : NaN);
      const okTom = lidos.every(x => x.tom === x.NEUTRO);
      const okExp = base && lidos.every(x => Math.abs(x.exposicao - esperado(x.rot)) <= 0.005);
      meta('P3', '?tom=neutro: NeutralToneMapping', lidos.map(x => `${x.rot}: ${x.tom === x.NEUTRO ? 'Neutral' : x.tom === x.ACES ? 'ACES' : x.tom}`).join(' · '), 'Neutral em todos', okTom);
      meta('P3', '?tom=neutro: a exposição = a do ACES × 1,40 (dia, noite, depois do definirHora e de recriar)',
        `${lidos.map(x => `${x.rot} ${f(x.exposicao, 3)}${base ? `/${f(esperado(x.rot), 3)}` : ''}`).join(' · ')} · ${ids.size - 1} recriação(ões)${base ? '' : ' · sem a exposição de base'}`, '± 0,005 em todos e ≥ 1 recriação',
        base ? okExp && ids.size >= 2 : null, base ? 'meta' : 'info');
    } catch (e) { meta('P3', '?tom=neutro: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura'); } finally { await fechar(s); }
    marcar('P3 (gfx e tom)');
  }
} catch (e) {
  if (!invalido) meta('—', 'Rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
} finally {
  for (const s of sessoes.splice(0)) { anotarErros(s); await s.navegador.close().catch(() => {}); }
  await srv.fechar();
  if (srvBase) await srvBase.fechar();
}

/**
 * P: a CPU do quadro (medirQuadro sem a GPU, CPU 4×, a demo; como o teste-desempenho-celular), PAREADA (item 4 da revisão: a
 * referência guardava números DESTA máquina e o CI comparava os dele com eles; aqui a base varia 5,4–6,8 ms entre rodadas e
 * 4,5–7,3 entre janelas da mesma rodada). A versão medida e a de base (`--base`) abertas JUNTAS, cada uma com o relógio
 * manual (a outra fica parada: o laço não desenha), e as janelas de 400 quadros ALTERNADAS (medida, base, base, medida, …): a
 * meta é a mediana das diferenças por par ≤ TOL_CPU. Sem `--base`, só a medida, informativa. Nada disso vai à referência.
 */
async function medirCpu() {
  const versoes = [{ rot: 'medida', sv: srv }, ...(srvBase ? [{ rot: 'base', sv: srvBase }] : [])];
  const abertas = [];
  try {
    for (const v of versoes) {
      const s = await carga(CEL, URL_CEL, { servidor: v.sv });
      const pg = s.pagina;
      await pg.waitForFunction(() => window.__golaco.sobDemanda?.ja() ?? true, null, { timeout: 120000 });
      await pg.evaluate(() => {
        const g = window.__golaco;
        g.relogio.usarManual(true);
        for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        g.cameraLivre(null);
        for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      });
      abertas.push({ ...v, s, pg, cdp: await s.contexto.newCDPSession(pg), p95: [], media: [] });
    }
    const janela = async a => {
      await a.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      try {
        return await a.pg.evaluate(n => {
          const g = window.__golaco;
          g.medirQuadro({ zerar: true });
          for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          const r = g.medirQuadro({ zerar: true });
          return { p95: r.cpu.p95, media: r.cpu.media, quadros: r.quadros };
        }, 400);
      } finally { await a.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    };
    for (let k = 0; k < JANELAS_CPU; k++) {
      // a ordem alterna a cada par (a deriva da máquina cai nos dois lados)
      for (const a of k % 2 ? [...abertas].reverse() : abertas) { const r = await janela(a); a.p95.push(r.p95); a.media.push(r.media); }
    }
    // o desenho (a parte JS do render): 120 quadros desenhados, informativo (6 janelas do mesmo código deram 7,4–15,2 ms: o ruído
    // não separa nada — item 17 da revisão)
    for (const a of abertas) {
      await a.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      try { a.desenho = await a.pg.evaluate(() => { const g = window.__golaco; g.medirQuadro({ zerar: true }); for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: true }); return g.medirQuadro({ zerar: true }).desenho; }); } finally { await a.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    }
  } catch (e) {
    meta('P', 'CPU do quadro: rodou', e.message.split('\n')[0].slice(0, 240), 'sem erro', false, 'estrutura');
    for (const a of abertas) await fechar(a.s);
    marcar('P (CPU)');
    return;
  }
  for (const a of abertas) await fechar(a.s);
  const med = a => percentil(a.p95, 0.5);
  const [M, B] = abertas;
  const lista = a => a.p95.map(v => f(v, 2)).join(' / ');
  medidas['P.cpuP95'] = med(M); medidas['P.cpuMedia'] = media(M.media); medidas['P.desenhoP95'] = M.desenho?.p95;
  meta('P', `CPU do quadro sem a GPU (CPU 4×, a demo): p95, a mediana de ${JANELAS_CPU} janelas de 400 quadros (a versão medida)`,
    `${f(med(M), 2)} ms (janelas ${lista(M)}) · méd ${f(media(M.media), 2)} ms`, '≤ 6 ms (informativo: a base já passa dele, "Depende do dono" 30)', med(M) <= 6, 'info');
  if (B) {
    const d = M.p95.map((v, i) => v - B.p95[i]), dm = percentil(d, 0.5);
    medidas['P.cpuP95base'] = med(B); medidas['P.cpuDifPar'] = dm;
    meta('P', 'CPU do quadro: nada pior que a base, PAREADO (a mediana das diferenças por par de janelas)',
      `${dm >= 0 ? '+' : ''}${f(dm, 2)} ms · medida ${f(med(M), 2)} (${lista(M)}) · base ${f(med(B), 2)} (${lista(B)})`, `≤ +${f(TOL_CPU, 1)} ms (o mesmo código varia até +0,7 entre instâncias)`, dm <= TOL_CPU);
  } else meta('P', 'CPU do quadro: nada pior que a base (pareado)', 'sem --base: não medido', `≤ +${f(TOL_CPU, 1)} ms (com --base <pasta golaco da base>)`, null, 'info');
  meta('P', 'O desenho (a parte JS do render, CPU 4×, 120 quadros)', abertas.map(a => `${a.rot} p95 ${f(a.desenho?.p95, 2)} · méd ${f(a.desenho?.media, 2)} ms`).join(' · '), 'informativo (o ruído não separa versões)', null, 'info');
  marcar('P (CPU pareada)');
}

/**
 * T: liga o rAF falso a cada taxa, aquece (o teto do item 45 mede o refresh pelos últimos 30 intervalos e refaz a conta a cada
 * 2 s) e conta os desenhos do #tela numa janela do relógio virtual. Devolve {hz: {porSeg, mediana, desvio, painel, estado}}: o
 * painel = o refresh e o teto do __golaco.perf() (o C11; null sem ele), o estado = o __golaco.teto (o C13; null sem ele).
 */
async function medirTeto(pg, taxas, { aquece = 2600, janela = 1000 } = {}) {
  await pg.evaluate(() => {
    window.__desenhos = null;
    window.__P.soContar(true);
    // (o ?prints=1 abre com o relógio manual: o laço de verdade, pelo rAF, só com ele desligado)
    window.__golaco.relogio.usarManual(false);
    // (a 1ª chamada pede o medidor do painel)
    try { window.__golaco.perf?.(); } catch (_) { /* sem o painel */ }
  });
  const out = {};
  try {
    for (const hz of taxas) {
      const t0 = await pg.evaluate(hz => { window.__rafLigar(hz); return window.__raf.t; }, hz);
      if (!(await esperarRaf(pg, t0 + aquece))) continue;
      const tA = await pg.evaluate(() => { window.__desenhos = []; return window.__raf.t; });
      if (!(await esperarRaf(pg, tA + janela))) continue;
      const d = await pg.evaluate(() => {
        const d = window.__desenhos; window.__desenhos = null;
        let painel = null;
        try { const p = window.__golaco.perf?.(); painel = p ? { hz: p.refresh?.hz ?? null, rafHz: p.refresh?.rafHz ?? null, teto: p.refresh?.teto ?? null } : null; } catch (_) { painel = null; }
        const e = window.__golaco.teto;
        return { d, painel, estado: e ? { ligado: e.ligado, hz: e.hz, n: e.n } : null };
      });
      const v = d.d.filter(t => t > tA && t <= tA + janela + 1e-6);
      const iv = []; for (let i = 1; i < v.length; i++) iv.push(v[i] - v[i - 1]);
      const md = percentil(iv, 0.5);
      out[hz] = { porSeg: (v.length * 1000) / janela, mediana: md, desvio: iv.length ? Math.max(...iv.map(x => Math.abs(x - md))) : NaN, painel: d.painel, estado: d.estado };
    }
  } finally {
    await pg.evaluate(() => { window.__rafLigar(0); window.__P.soContar(false); window.__desenhos = null; }).catch(() => {});
  }
  return out;
}

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
  // (os outros campos do registro — notas à mão, histórico — ficam em toda gravação, também com --so: item 14 da revisão)
  const extras = Object.fromEntries(Object.entries(tudo[CHAVE_REF] ?? {}).filter(([k]) => !['gravado', 'commit', 'secoes', 'chromium', 'renderer', 'nota', 'valores'].includes(k)));
  tudo[CHAVE_REF] = {
    gravado: new Date().toISOString().slice(0, 10), commit, secoes: SECOES.filter(x => secoes.has(x)).join(','), chromium: cond.chromium, renderer: cond.renderer,
    nota: 'valores AGREGADOS do teste-graficos-pagina (nunca hash de pixels); as guardas "nada pior" comparam com eles. A CPU (seção P) não entra: é medida pareada com --base',
    valores: { ...(antes?.valores ?? {}), ...valores },
    ...extras,
  };
  fs.mkdirSync(path.dirname(ARQ_REF), { recursive: true });
  fs.writeFileSync(ARQ_REF, JSON.stringify(tudo, null, 2) + '\n');
}
if (arqJson) fs.writeFileSync(arqJson, JSON.stringify({ cond, valores, medidas, res }, null, 2) + '\n');

// ------------------------------------------------------------------ a tabela
const est = m => (m.ok === null ? 'INFO    ' : m.ok ? 'PASSOU  ' : m.tipo === 'estrutura' || valendo ? 'REPROVOU' : 'FORA    ');
const w0 = Math.max(...res.map(m => m.nome.length)), w1 = Math.min(140, Math.max(...res.map(m => m.medido.length)));
for (const m of res) console.log(`${est(m)} | ${m.secao.padEnd(2)} | ${m.nome.padEnd(w0)} | ${m.medido.padEnd(w1)} | ${m.alvo}`);
const fora = res.filter(m => m.ok === false && m.tipo === 'meta').length;
const estrutura = res.filter(m => m.ok === false && m.tipo === 'estrutura').length;
console.log(`\nChromium ${cond.chromium} · ${cond.renderer}`);
if (REF) console.log(`referência: ${ARQ_REF} (${REF.gravado}, ${REF.commit || 'sem commit'}; Chromium ${REF.chromium})${tolRef() > 1 ? ' — RENDERIZADOR DIFERENTE do gravado: as guardas "nada pior" com +50% de tolerância' : versaoDif() ? ' — Chromium diferente do gravado (só aviso: a tolerância não muda)' : ''}`);
else console.log('referência: nenhuma gravada (as guardas "nada pior" ficam informativas; grave com --gravar-referencia na main)');
if (gravar && !invalido) console.log(`referência gravada em ${ARQ_REF}, chave "${CHAVE_REF}" (${Object.keys(valores).length} valores)`);
console.log(`tempos: ${tempos.join(' · ')} · total ${((Date.now() - T0) / 1000).toFixed(0)} s`);
if (invalido) { console.log(`\nteste-graficos-pagina: TESTE INVÁLIDO (${invalido})`); process.exit(1); }
if (estrutura) { console.log(`\nteste-graficos-pagina: REPROVOU (${estrutura} falha(s) de estrutura)`); process.exit(1); }
if (valendo) { console.log(fora ? `\nteste-graficos-pagina: REPROVOU (${fora})` : '\nteste-graficos-pagina: PASSOU'); process.exit(fora ? 1 : 0); }
console.log(`\nteste-graficos-pagina: INFORMATIVO (${fora} meta(s) fora; as metas valem com --valendo, a partir do C14)`);
process.exit(0);
