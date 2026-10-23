// Cenas das paradas no navegador — a parte do CARTÃO (Chromium; pedido do dono de 22/10: "as cenas de cartões";
// PLANO-CENAS.md §3.6, contrato "Cenas das paradas" no CONTRATOS.md). Na página de verdade (main.js + js/cena-cartao.js +
// render/cartao3d.js + js/cenas-tela.js + hud.js), relógio manual, com ?cenas=1 (o webdriver desliga as cenas, como a
// substituição). Os cartões saem pela __golaco.faltaDeTeste (amarelo, vermelho, 2º amarelo: o caminho das regras e dos
// eventos da página, com a decisão da cena no fim — decidirCartao):
//   C1 a cena ativa, tipo 'cartao', da cor do cartão (o 2º amarelo com `segundo`), com os planos da cena na ordem (amarelo
//      árbitro → reação → anota, 5,45 s; vermelho árbitro → reação → saída → túnel → torcida, 8,9 s; 2º amarelo, 9,9 s);
//   C2 mundo.tick parado do começo ao fim da cena; no 1º quadro depois dela a simulação anda do MESMO tick;
//   C3 o cartão 3D na tela (inteiro no quadro, ≥ 14 px no PC e ≥ 10 no celular, a cor certa no pixel do meio no PC — ΔE76
//      ≤ 15) e NA MÃO: ≤ 6 cm da mão desenhada do árbitro em todo quadro com ele visível, também com ?corpo=humano (a
//      postura do corpo novo por cima: jog3d.poseDesenhada); no 2º amarelo o amarelo e depois o vermelho;
//   C4 a tarja de identificação (sigla, número e nome do punido, o cartão desenhado — nem motivo nem minuto) visível do
//      cartão no alto até o fim da cena (no máximo CENAS.tarja = 6 s), invisível antes, depois da cena, no pulo e no replay
//      que vem a seguir; medida pelo estado da página (rev. R24), não pelo relógio das animações CSS; nenhum outro texto na
//      tela (só o placar, a tarja e o "Pular"); folga ≥ 4 px do placar e do "Pular" e dentro da tela em 1280×720, 844×390,
//      667×375 e 568×320 (o nome cortado com reticências fica anotado);
//   C5 pular: antes de 0,5 s nem tecla nem toque pulam; a tecla segurada desde antes da cena não pula; um aperto NOVO
//      depois de 0,5 s (tecla K, Enter; toque na tela do celular) acaba a cena em ≤ 2 quadros; com o K ainda segurado, nada
//      sai dele em 40 passos (nem carga, nem pedido, nem bola no ar do humano); o "Pular" do celular ≥ 48 px na tela;
//   C6 o #cartao-icone não aparece para quem teve a cena (nem durante nem nos 3 s depois); com ?cenas=0 ele aparece (a
//      medida não é vazia);
//   C7 o hash no tick T + 600 com a cena = o da aba com ?cenas=0 (a mesma semente, a entrada da demo — ?demo=1, o caminho
//      que ESCREVE no mundo —, a mesma falta no mesmo tick; amarelo e vermelho) e o mundo no tick T igual antes e depois da
//      cena (hash e j.ia/j.iaAcao);
//   C8 celular 844×390 Média: ≤ 40 chamadas de desenho e ≤ 130 mil triângulos no pior plano (amarelo e vermelho), com o
//      manequim e com ?corpo=humano (com ele, os triângulos dos jogadores ≤ o teto da Média, 60 mil);
//   C9 com o replay de parada armado: cartão (no tick T do apito) → 1 s ao vivo → replay de parada no passo antes da
//      montagem (T + 59) → montagem (T + 60); (rev. R1) o replay toca INTEIRO: o P1 começa em chave − tv.antes e nenhum
//      corte no anel de chave − tv.antes até a espera; os treinadores vivos no mesmo x/z e no mesmo passo antes e depois da
//      cena (a cena desenha cópias deles, no lugar deles);
//   C10 o submenu "Modo de jogo" (Pré-jogo, Substituição e o botão novo, Cenas) cabe sem rolar em 844×390, os botões não
//      encostam nem cortam o texto; o botão alterna ligadas ↔ desligadas e a página segue;
//   C11 (rev. R7) a vantagem que vira gol com cartão: comemoração → cartão (mundo.tick = gol + 149) → saída e replay do gol
//      (gol + 150) → jogo; também com a comemoração pulada antes da hora (a cortina para no gol + 149; a comemoração sai do
//      desenho quando o cartão começa); C11b com o TROCAR segurado da comemoração até o gol + 155, a simulação com a cena =
//      a sem ela (o passo da saída vai com a entrada neutra nos dois);
//   C12 (rev. R11) Total Match, "só o meu jogador" expulso: a faixa "Você foi expulso" não aparece antes do fim da cena e
//      do replay de parada daquela bola morta, e depois deles fica ≥ 5 s visível; C12b o 2º amarelo dele na vantagem que vira
//      gol: a faixa só depois da comemoração, da cena e do replay do gol (≥ 5 s); C12c no gol que acaba o jogo, fica a faixa
//      do fim (com o "Voltar ao Total Match") e a do expulso não sai;
//   C6b a cena pulada antes de o cartão subir (0,6 s): o ícone de sempre aparece; C4 também em 560×400 no PC (nome longo);
//   console sem erros.
// Na versão sem as cenas (--raiz <cópia da base>) reprova C1–C6, C8, C9, C11 e C12 (só o ícone de hoje; a faixa do expulso
// sai no apito); C7 e C10 passam lá (não têm o que medir: rev. R16) e ficam de guarda.
//   node tools/teste-cenas-tela.mjs [--raiz <pasta do jogo>] [--so A,H,R,C,U,L,G,T,I] [--capturas <pasta>]
//   (A = PC 1280×720: C1–C6; H = hash com × sem a cena: C7 e o ícone com ?cenas=0; R = replay de parada: C9; C = celular
//   844×390 Média: C3–C5, C8, C10; U = celular com ?corpo=humano: C3, C8; L = 667×375 e 568×320: C4; G = gol: C11;
//   T = Total Match: C12; I = o intervalo (PR 3): I1–I8, I11, I12 — a cena ativa no apito do 1º tempo com o tick parado até
//   o geral, a tarja do placar com os autores da súmula, os lances do guardador dentro da cena, as estatísticas = súmula,
//   o hash do 2º tempo igual ao de ?cenas=0, o toque/Pular, a pausa, nada encostando em 844×390/568×320, o apito no plano
//   do apito e o campo vazio no geral)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { tabelaTexto } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
const args = process.argv.slice(2);
const arg = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const raiz = path.resolve(arg('--raiz') ?? RAIZ);
const so = arg('--so') ? new Set(arg('--so').split(',')) : null;
const roda = s => !so || so.has(s);
const pastaCap = arg('--capturas') ? path.resolve(arg('--capturas')) : null;
if (pastaCap) fs.mkdirSync(pastaCap, { recursive: true });
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => res.push({ nome, medido, alvo, ok: !!ok, info });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const cm = v => (Number.isFinite(v) ? (100 * v).toFixed(1) : '-');
const erroCurto = e => String(e?.message ?? e).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0];
const errosTodos = [];
const marcas = [];
const marcar = n => marcas.push([n, Date.now()]);
const { PED_C } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);

// o que a cena tem de ser (PLANO-CENAS.md §3.1: os planos e as durações; não lidos do módulo medido)
const PLANOS = {
  amarelo: { nomes: ['arbitro', 'reacao', 'anota'], dur: 5.45 },
  vermelho: { nomes: ['arbitro', 'reacao', 'saida', 'tunel', 'torcida'], dur: 8.9 },
  segundo: { nomes: ['arbitro', 'reacao', 'saida', 'tunel', 'torcida'], dur: 9.9 },
};
const CASOS = [
  ['amarelo', { cartao: 'amarelo' }, 'amarelo', ['amarelo']],
  ['vermelho', { cartao: 'vermelho' }, 'vermelho', ['vermelho']],
  ['2º amarelo', { segundo: true }, 'segundo', ['amarelo', 'vermelho']],
];
const COR = { amarelo: [0xf5, 0xc5, 0x18], vermelho: [0xe5, 0x48, 0x4d] };
const LIM = { mao: 0.06, chamadas: 40, triangulos: 130000, triCorpoMedia: 60000, tarja: 6, folga: 4 };

// ΔE76 (CIELAB) entre duas cores sRGB 0–255
function lab([r, g, b]) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

const srv = await servidor(0, raiz);
async function pagina(nome, url, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load', timeout: 600000 });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 600000 });
  if (opc.corpo) await nav.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 300000 }).catch(() => {});
  await nav.pagina.evaluate(instalar);
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, fechar: async () => { errosTodos.push(...nav.erros.map(e => `${nome}: ${e}`)); await nav.navegador.close(); } };
}

/** O pixel (média 3×3) em (x, y) px CSS de uma captura da página. */
async function pixel(pg, x, y) {
  const png = await pg.screenshot({ type: 'png' });
  return pg.evaluate(async ({ src, x, y }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const k = c.getContext('2d'); k.drawImage(i, 0, 0);
    const s = i.width / window.innerWidth, px = Math.round(x * s), py = Math.round(y * s);
    const d = k.getImageData(px - 1, py - 1, 3, 3).data;
    const m = [0, 0, 0]; for (let q = 0; q < 9; q++) for (let ch = 0; ch < 3; ch++) m[ch] += d[q * 4 + ch] / 9;
    return m;
  }, { src: png.toString('base64'), x, y });
}
const capturar = async (pg, nome) => { if (pastaCap) await pg.screenshot({ path: path.join(pastaCap, nome + '.png') }); };

/**
 * Ajudantes na página (window.__ct): visibilidade de verdade (display/visibility/opacidade dos ancestrais e caixa), o ícone
 * do cartão, os textos visíveis fora do placar, da tarja e do "Pular", a tarja (estado + o texto que se VÊ) e o andar da
 * cena quadro a quadro medindo em window.__med.
 */
function instalar() {
  const g = window.__golaco;
  // (opac = false: a opacidade não conta — a tarja entra com um esmaecer de 0,25 s pelo relógio das animações CSS, que não
  // anda com o relógio manual; o que se mede é o estado da página: rev. R24)
  const vis = (e, opac = true) => {
    if (!e) return false;
    for (let a = e; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden' || (opac && +s.opacity < 0.01)) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const caixa = (e, opac = true) => { if (!vis(e, opac)) return null; const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
  const folga = (a, b) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
  const icone = () => { const e = document.getElementById('cartao-icone'); return !!e && e.classList.contains('visivel') && vis(e, false); };   // (a opacidade: transição CSS)
  const textosFora = () => {
    const out = [];
    for (const e of document.body.querySelectorAll('*')) {
      if (e.closest('.placar, #tarja-cena, #cena, .carregando')) continue;
      let t = '';
      for (const n of e.childNodes) if (n.nodeType === 3) t += n.textContent;
      t = t.trim();
      if (t && vis(e)) out.push(t.slice(0, 30));
    }
    return out;
  };
  // a tarja como a tela mostra: os pedaços VISÍVEIS (sem a frase do leitor de tela), o nome cortado, a caixa
  const tarjaVista = () => {
    const el = document.getElementById('tarja-cena'), v = e => vis(e, false);
    if (!el || !v(el)) return null;
    const pedacos = [...el.querySelectorAll('.tc-sigla, .tc-num, .tc-nome')].filter(v).map(e => e.textContent.trim()).filter(Boolean);
    const nome = [...el.querySelectorAll('.tc-nome')].find(v);
    const cartoes = [...el.querySelectorAll('.tc-cartao')].filter(v).map(e => (e.classList.contains('vermelho') ? 'vermelho' : 'amarelo'));
    return { pedacos, cartoes, cortado: !!nome && nome.scrollWidth > nome.clientWidth + 1, caixa: caixa(el, false) };
  };
  const quadro = (des = false) => g.relogio.avancar(1000 / 60, { desenhar: des });
  /**
   * Anda a cena quadro a quadro até ela acabar (ou o tempo dela passar de `ate`), medindo em window.__med: o tick (parado?),
   * as fases na ordem, o cartão 3D (cor, distância da mão desenhada, na tela), a tarja (quando visível × o tempo da cena), o
   * ícone, os textos fora do placar e, a cada `desenhar` quadros, as chamadas e os triângulos por fase.
   */
  function andar(o = {}) {
    const M = window.__med;
    let n = 0;
    while (g.cenas?.ativo && n < (o.max ?? 1500)) {
      if (o.ate != null && (g.cenas.estado?.tempo ?? 0) >= o.ate) break;
      const des = !!o.desenhar && M.quadros % o.desenhar === 0;
      quadro(des); n++;
      if (!g.cenas.ativo) { M.fim = true; break; }
      M.quadros++;
      const e = g.cenas.estado, m = g.mundo;
      if (m.tick !== M.tick0) M.tickMudou++;
      if (M.fases[M.fases.length - 1] !== e.fase) M.fases.push(e.fase);
      const c3 = g.cenas.cartao3d;
      if (c3) {
        if (M.cores[M.cores.length - 1] !== c3.cor) M.cores.push(c3.cor);
        const mao = g.cenas.maoArbitro;
        if (mao) { const d = Math.hypot(c3.x - mao.x, c3.y - mao.y, c3.z - mao.z); M.mao.n++; M.mao.max = Math.max(M.mao.max, d); } else M.mao.sem++;
        // no alto (o braço reto acima da cabeça): inteiro no quadro e o tamanho na tela
        if (e.fase === 'arbitro') {
          const T = e.tempos, alto = (e.tempo >= T.alto && e.tempo <= (T.altoFim1 ?? T.altoFim)) || (T.alto2 != null && e.tempo >= T.alto2 && e.tempo <= T.altoFim);
          if (alto) {
            const nt = g.cenas.naTela('cartao');
            M.alto.n++;
            if (nt && nt.dentro && !nt.atras) { M.alto.dentro++; M.alto.minAlt = Math.min(M.alto.minAlt, nt.altura); M.alto.maxAlt = Math.max(M.alto.maxAlt, nt.altura); }
          }
        }
      }
      const tv = tarjaVista(), est = g.cenas.tarja;
      const deve = e.tempo >= e.tempos.alto - 1e-9 && e.tempo < e.tempos.alto + M.tarjaMax - 1e-9;
      if (tv && est?.visivel) { M.tarja.vista++; if (!deve) M.tarja.fora++; M.tarja.ultimo = tv; if (tv.cortado) M.tarja.cortado++; } else if (deve) M.tarja.faltou++;
      if (deve) M.tarja.devia++;
      if (icone()) M.icone++;
      for (const t of textosFora()) M.textos.add(t);
      if (des) {
        const s = g.estado(), p = (M.por[e.fase] ??= { cham: 0, tri: 0, triCorpo: 0, n: 0 });
        p.n++; p.cham = Math.max(p.cham, s.desenhoChamadas); p.tri = Math.max(p.tri, s.desenhoTriangulos);
        const corpo = g.estadio.corpo;
        if (corpo?.pronto) p.triCorpo = Math.max(p.triCorpo, corpo.triangulos);
      }
    }
    return { n, ativo: !!g.cenas?.ativo, tempo: g.cenas?.estado?.tempo ?? null };
  }
  window.__ct = {
    vis, caixa, folga, icone, textosFora, tarjaVista, quadro, andar,
    /** Começa a medida da cena que acabou de abrir. */
    iniciar(tarjaMax) {
      const e = g.cenas?.estado ?? null;
      window.__med = {
        tick0: g.mundo.tick, quadros: 0, tickMudou: 0, fases: [], cores: [], mao: { n: 0, max: 0, sem: 0 },
        alto: { n: 0, dentro: 0, minAlt: Infinity, maxAlt: 0 }, tarja: { vista: 0, devia: 0, faltou: 0, fora: 0, cortado: 0, ultimo: null },
        icone: 0, textos: new Set(), por: {}, fim: false, tarjaMax, ini: e && { cor: e.cor, segundo: e.segundo, variante: e.variante, id: e.id, time: e.time, duracao: e.duracao, tempos: e.tempos, planos: e.planos.map(p => p.nome) },
      };
      return window.__med.ini;
    },
    /** Depois da cena: `n` quadros de jogo (o ícone, a tarja e o tick). */
    depois(n = 180) {
      const M = window.__med, tickFim = g.mundo.tick;
      let icone = 0, tarja = 0, primeiro = null;
      for (let i = 0; i < n; i++) {
        quadro(false);
        if (primeiro == null && g.mundo.tick !== tickFim) primeiro = i + 1;
        if (window.__ct.icone()) icone++;
        if (window.__ct.tarjaVista()) tarja++;
      }
      M.depois = { tickFim, tick: g.mundo.tick, primeiro, icone, tarja };
      return M.depois;
    },
    /** A medida (os Set viram listas). */
    medida() { const M = window.__med; return { ...M, textos: [...M.textos] }; },
    /** Espera as animações CSS da tarja acabarem (a caixa sem o deslize de entrada). */
    async tarjaParada(ms = 3000) {
      const el = document.getElementById('tarja-cena');
      const t = performance.now();
      while (el && performance.now() - t < ms && el.getAnimations().some(a => a.playState !== 'finished')) await new Promise(r => setTimeout(r, 30));
      return el ? el.getAnimations().length : 0;
    },
  };
}

/** Reinicia a partida, anda até o meio dela e faz a falta (com a cena, se houver): {f, ini (a cena), tick}. */
async function falta(pg, opc, o = {}) {
  return pg.evaluate(async ({ opc, o }) => {
    const g = window.__golaco;
    g.reiniciar({ modo: 'partida', semente: o.semente ?? 7 });
    g.rodarPassos(o.passos ?? 600, 'demo');
    for (let i = 0; i < 60; i++) window.__ct.quadro(false);
    let tarjaMax = 6;
    // (só com as cenas: na base o import do arquivo que não existe sairia no console como um 404)
    if (g.cenas) try { tarjaMax = (await import('./js/cenas-config.js')).CENAS.tarja; } catch (_) { /* sem o módulo */ }
    const f = g.faltaDeTeste(opc);
    const ini = g.cenas ? window.__ct.iniciar(tarjaMax) : null;
    let ficha = null;
    try {
      const E = await import('./js/elenco.js');
      const id = ini?.id ?? f?.def, fi = E.fichaDe(id), el = E.ELENCOS[E.elencoDoJogador(id)];
      ficha = fi && { num: String(fi.num), nome: fi.nome, camisa: fi.camisa ?? fi.nome, sigla: el?.sigla ?? '' };
    } catch (_) { /* sem a ficha */ }
    return { f, ini, ativo: !!g.cenas?.ativo, tipo: g.cenas?.tipo ?? null, tick: g.mundo.tick, ficha, temCenas: !!g.cenas };
  }, { opc, o });
}
const andar = (pg, o) => pg.evaluate(o => window.__ct.andar(o), o);
const medida = pg => pg.evaluate(() => window.__ct.medida());

/** C1–C4/C6 de um caso já andado até o fim (M = a medida, F = a falta). */
function conferirCaso(rotulo, M, F, chave, cores, opc = {}) {
  const P = PLANOS[chave], ini = F.ini, d = M.depois ?? {};
  const corEsp = chave === 'amarelo' ? 'amarelo' : 'vermelho';
  // (o quadro em que a cena acaba conta: nele a cena ainda andou o último pedaço)
  const dur = (M.quadros + (M.fim ? 1 : 0)) / 60;
  meta(`C1 ${rotulo}: a cena ativa, tipo cartao, da cor certa, com os planos na ordem e a duração da cena`,
    F.ativo ? `${F.tipo} ${ini.cor}${ini.segundo ? ' (2º amarelo)' : ''}, ${ini.variante}; fases ${M.fases.join(' → ')}; ${f2(dur)} s (${M.quadros} quadros)` : `nenhuma cena (falta: cartão ${F.f?.cartao ?? '-'}, parada ${F.f?.parada ?? '-'})`,
    `${corEsp}${chave === 'segundo' ? ' com segundo' : ''}; ${P.nomes.join(' → ')}; ${f2(P.dur)} s ± 2 quadros`,
    F.ativo && F.tipo === 'cartao' && ini.cor === corEsp && !!ini.segundo === (chave === 'segundo') && M.fases.join() === P.nomes.join() && Math.abs(dur - P.dur) <= 2 / 60 + 1e-9 && M.fim);
  meta(`C2 ${rotulo}: mundo.tick parado na cena inteira; depois, a simulação anda do mesmo tick`,
    F.ativo ? `tick ${M.tick0}: mudou em ${M.tickMudou} de ${M.quadros} quadros; fim no tick ${d.tickFim}, 1º passo ${d.primeiro != null ? `no ${d.primeiro}º quadro depois` : 'nunca'}, 3 s depois ${d.tick}` : 'nenhuma cena',
    'parado; o mesmo tick no fim; anda no 1º–2º quadro', F.ativo && M.quadros > 0 && M.tickMudou === 0 && d.tickFim === M.tick0 && d.primeiro != null && d.primeiro <= 2 && d.tick >= M.tick0 + 150);
  if (!opc.semC3) {
    const altMin = opc.altMin ?? 14;
    meta(`C3 ${rotulo}: o cartão 3D na mão (≤ ${cm(LIM.mao)} cm da mão desenhada) e na tela no alto (inteiro, ≥ ${altMin} px)${cores.length > 1 ? ', o amarelo e depois o vermelho' : ''}`,
      F.ativo ? `cores ${M.cores.join(' → ') || 'nenhuma'}; mão a ≤ ${cm(M.mao.max)} cm em ${M.mao.n} quadros${M.mao.sem ? ` (${M.mao.sem} sem a mão desenhada)` : ''}; no alto ${M.alto.dentro}/${M.alto.n} quadros inteiro no quadro, ${f2(M.alto.minAlt)}–${f2(M.alto.maxAlt)} px` : 'nenhuma cena',
      `${cores.join(' → ')}; ≤ ${cm(LIM.mao)} cm; todos, ≥ ${altMin} px`,
      F.ativo && M.cores.join() === cores.join() && M.mao.n > 0 && M.mao.sem === 0 && M.mao.max <= LIM.mao && M.alto.n >= 30 && M.alto.dentro === M.alto.n && M.alto.minAlt >= altMin);
  }
  if (!opc.semC4) {
    const tv = M.tarja.ultimo, fi = F.ficha, nomeEsp = opc.toque ? fi?.camisa : fi?.nome;
    const esp = fi ? [fi.sigla, fi.num, nomeEsp] : [];
    const cartEsp = chave === 'segundo' ? ['amarelo', 'vermelho'] : [corEsp];
    const okTxt = !!tv && tv.pedacos.join('|') === esp.join('|') && tv.cartoes.join() === cartEsp.join();
    meta(`C4 ${rotulo}: a tarja (sigla, número, nome, o cartão desenhado) do cartão no alto até o fim da cena (≤ ${LIM.tarja} s); fora disso e depois dela, nunca; nenhum outro texto na tela`,
      F.ativo ? `vista em ${M.tarja.vista} quadros (devia ${M.tarja.devia}, faltou ${M.tarja.faltou}, fora da janela ${M.tarja.fora}); "${tv ? tv.pedacos.join(' ') : '-'}" [${tv ? tv.cartoes.join('+') : '-'}] × esperado "${esp.join(' ')}" [${cartEsp.join('+')}]${M.tarja.cortado ? ` (nome cortado em ${M.tarja.cortado} quadros)` : ''}; depois da cena: ${d.tarja} quadros; outros textos: ${M.textos.length ? JSON.stringify(M.textos) : 'nenhum'}` : 'nenhuma cena (nenhuma tarja)',
      'a janela inteira (±1 quadro), 0 fora; o texto do punido; 0 depois; nenhum',
      F.ativo && M.tarja.devia > 0 && M.tarja.faltou <= 1 && M.tarja.fora <= 1 && okTxt && d.tarja === 0 && M.textos.length === 0);
  }
  if (!opc.semC6) meta(`C6 ${rotulo}: o #cartao-icone não aparece para quem teve a cena (durante e 3 s depois)`,
    F.ativo ? `${M.icone} quadros durante, ${d.icone} depois` : `sem cena: o ícone ${d.icone ?? '-'} quadros`, '0 e 0', F.ativo && M.icone === 0 && d.icone === 0);
}

// ------------------------------------------------------------------------------------------------ A (PC 1280×720)
marcar('A');
if (roda('A')) try {
  const P = await pagina('A', '?q=media&hora=dia&semente=7&cenas=1&prejogo=0&comemoracao=0&replay=0&substituicao=0');
  try {
    const pg = P.pagina;
    for (const [rotulo, opc, chave, cores] of CASOS) {
      const F = await falta(pg, opc);
      const px = [];
      if (F.ativo) {
        // o pixel do meio do cartão no alto (cada cor: o amarelo e, no 2º amarelo, o vermelho): o quadro desenhado
        for (const cor of cores) {
          const ate = await pg.evaluate(cor => { const T = window.__golaco.cenas.estado.tempos; return (cor === 'vermelho' && T.alto2 != null ? T.alto2 : T.alto) + 0.35; }, cor);
          await andar(pg, { ate });
          // (um quadro DESENHADO, medido como os outros)
          await andar(pg, { max: 1, desenhar: 1 });
          const nt = await pg.evaluate(() => { const g = window.__golaco; return { nt: g.cenas.naTela('cartao'), c3: g.cenas.cartao3d }; });
          if (nt.nt && nt.c3) {
            const p = await pixel(pg, (nt.nt.x0 + nt.nt.x1) / 2, (nt.nt.y0 + nt.nt.y1) / 2);
            px.push({ cor, c3: nt.c3.cor, alt: nt.nt.altura, dE: deltaE(p, COR[cor]), rgb: p.map(Math.round) });
            await capturar(pg, `pc-${chave}-${cor}`);
          } else px.push({ cor, alt: 0, dE: 999 });
        }
      }
      await andar(pg, {});
      if (F.ativo) await pg.evaluate(() => window.__ct.depois(180));
      else await pg.evaluate(async tarjaMax => { window.__ct.iniciar(tarjaMax); window.__ct.depois(180); }, LIM.tarja);
      const M = await medida(pg);
      conferirCaso(`PC ${rotulo}`, M, F, chave, cores);
      if (F.ativo) meta(`C3 PC ${rotulo}: a cor certa no pixel do meio do cartão no alto (ΔE76 ≤ 15)`,
        px.map(q => `${q.cor}: ${f2(q.alt)} px, ΔE ${f2(q.dE)} [${q.rgb ?? '-'}]`).join('; '), '≤ 15', px.length === cores.length && px.every(q => q.c3 === q.cor && q.dE <= 15));
    }
    // C4 PC: a caixa da tarja (sem o deslize de entrada) contra o placar, dentro da tela
    {
      const F = await falta(pg, { cartao: 'amarelo' });
      let lay = null;
      if (F.ativo) {
        await pg.evaluate(() => window.__ct.andar({ ate: window.__golaco.cenas.estado.tempos.alto + 0.3 }));
        await pg.evaluate(() => window.__ct.tarjaParada());
        lay = await pg.evaluate(() => {
          const c = window.__ct, t = c.tarjaVista(), pl = c.caixa(document.querySelector('#hud .placar'));
          return { t: t?.caixa ?? null, pl, folga: t?.caixa && pl ? c.folga(t.caixa, pl) : null, W: innerWidth, H: innerHeight };
        });
        await capturar(pg, 'pc-tarja');
        await pg.evaluate(() => { window.__golaco.cenas.pular(); for (let i = 0; i < 3; i++) window.__ct.quadro(false); });
      }
      meta('C4 PC 1280×720: a tarja longe do placar (≥ 4 px) e dentro da tela',
        lay?.t ? `tarja ${lay.t.x0.toFixed(0)}–${lay.t.x1.toFixed(0)} × ${lay.t.y0.toFixed(0)}–${lay.t.y1.toFixed(0)}; placar ${lay.pl ? `${lay.pl.x0.toFixed(0)}–${lay.pl.x1.toFixed(0)} × ${lay.pl.y0.toFixed(0)}–${lay.pl.y1.toFixed(0)}` : '-'}; folga ${f2(lay.folga)} px` : 'sem tarja',
        '≥ 4 px; dentro', !!lay?.t && lay.folga >= LIM.folga && lay.t.x0 >= 0 && lay.t.y0 >= 0 && lay.t.x1 <= lay.W && lay.t.y1 <= lay.H);
    }
    // C5 PC: a tecla K segurada desde antes da cena não pula; solta e apertada de novo depois de 0,5 s pula; com o K segurado,
    // nada sai dele (40 passos)
    {
      await pg.evaluate(() => { const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 7 }); g.rodarPassos(600, 'demo'); for (let i = 0; i < 60; i++) window.__ct.quadro(false); });
      await pg.keyboard.down('KeyK');
      const F = await pg.evaluate(() => { window.__ct.quadro(false); const g = window.__golaco; const f = g.faltaDeTeste({ cartao: 'amarelo' }); return { f, ativo: !!g.cenas?.ativo }; });
      let seg = null, pulo = null, cedo = null;
      if (F.ativo) {
        seg = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 60; i++) window.__ct.quadro(false); return { ativo: g.cenas.ativo, t: g.cenas.estado?.tempo }; });
        await pg.keyboard.up('KeyK');
        await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__ct.quadro(false); });
        await pg.keyboard.down('KeyK');
        pulo = await pg.evaluate(() => {
          const g = window.__golaco, m = g.mundo;
          const t = g.cenas.estado?.tempo;
          let q = 0; while (q < 6 && g.cenas.ativo) { window.__ct.quadro(false); q++; }
          const tarja = !!window.__ct.tarjaVista();
          // 40 passos com o K segurado: nada de carga, pedido ou bola no ar do controlado do humano
          const t0 = m.tick, ruins = [];
          let k = 0;
          while (m.tick - t0 < 40 && k < 200) {
            window.__ct.quadro(false); k++;
            const id = m.controlado?.[0], j = m.jogadores.find(o => o.id === id);
            if (j && j.carga) ruins.push('carga');
            if (j && j.pedido && j.pedido.tick > t0) ruins.push('pedido ' + j.pedido.tipo);
            if (m.voo && m.voo.de === id && m.voo.tick0 > t0) ruins.push('bola ' + m.voo.tipo);
          }
          return { t, q, ativo: g.cenas.ativo, tarja, ruins: [...new Set(ruins)], passos: m.tick - t0 };
        });
        await pg.keyboard.up('KeyK');
        // uma cena nova: o K (apertado e solto) e o Enter antes de 0,5 s não pulam; o Enter depois de 0,5 s pula
        await pg.evaluate(() => { for (let i = 0; i < 30; i++) window.__ct.quadro(false); window.__golaco.faltaDeTeste({ cartao: 'amarelo' }); for (let i = 0; i < 12; i++) window.__ct.quadro(false); });
        await pg.keyboard.press('KeyK');
        await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__ct.quadro(false); });
        await pg.keyboard.press('Enter');
        cedo = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) window.__ct.quadro(false); return { ativo: g.cenas.ativo, t: g.cenas.estado?.tempo }; });
        await pg.evaluate(() => { const g = window.__golaco; while (g.cenas.ativo && g.cenas.estado.tempo < 0.7) window.__ct.quadro(false); });
        await pg.keyboard.press('Enter');
        const enter = await pg.evaluate(() => { const g = window.__golaco; let q = 0; while (q < 6 && g.cenas.ativo) { window.__ct.quadro(false); q++; } return { q, ativo: g.cenas.ativo }; });
        cedo.enter = enter;
      } else await pg.keyboard.up('KeyK');
      meta('C5 PC: a tecla K segurada desde antes da cena não pula (1 s depois)', seg ? `ativa ${seg.ativo} (t ${f2(seg.t)} s)` : 'nenhuma cena', 'ativa', !!seg?.ativo);
      // C6b: pulada aos 0,6 s, ANTES de o cartão subir (0,95 s: nem a tarja nem o cartão 3D apareceram) — o ícone de sempre
      // aparece em cima de quem levou (antes não ficava nada na tela dizendo o cartão)
      const pre = await pg.evaluate(() => {
        const g = window.__golaco, ct = window.__ct;
        for (let i = 0; i < 30; i++) ct.quadro(false);
        g.faltaDeTeste({ cartao: 'amarelo' });
        if (!g.cenas?.ativo) return null;
        while (g.cenas.ativo && g.cenas.estado.tempo < 0.6) ct.quadro(false);
        return { t: g.cenas.estado?.tempo, c3: !!g.cenas.cartao3d?.visivel, tarja: !!ct.tarjaVista() };
      });
      let pul = null;
      if (pre) {
        await pg.keyboard.press('Enter');
        pul = await pg.evaluate(() => {
          const g = window.__golaco, ct = window.__ct;
          let q = 0; while (q < 6 && g.cenas.ativo) { ct.quadro(false); q++; }
          let icone = 0;
          for (let i = 0; i < 60; i++) { ct.quadro(false); if (ct.icone()) icone++; }
          return { q, ativo: g.cenas.ativo, icone };
        });
      }
      meta('C6b PC: a cena pulada antes de o cartão subir (0,6 s) — o #cartao-icone de sempre aparece em cima de quem levou',
        pre ? `pulada aos ${f2(pre.t)} s (cartão 3D ${pre.c3 ? 'visível' : 'não'}, tarja ${pre.tarja ? 'visível' : 'não'}): ${pul.q} quadro(s), ativa ${pul.ativo}; o ícone em ${pul.icone} dos 60 quadros seguintes` : 'nenhuma cena',
        'acabou; o ícone em ≥ 30 de 60', !!pul && !pul.ativo && pul.icone >= 30 && !pre.c3 && !pre.tarja);
      meta('C5 PC: o K e o Enter apertados antes de 0,5 s não pulam', cedo ? `t ${f2(cedo.t)} s: ativa ${cedo.ativo}` : 'nenhuma cena', 'ativa', !!cedo?.ativo && cedo.t < 0.5);
      meta('C5 PC: um aperto NOVO depois de 0,5 s (K; Enter) acaba a cena em ≤ 2 quadros, a tarja some junto e o K segurado não vira jogada (40 passos)',
        pulo ? `K aos ${f2(pulo.t)} s: ${pulo.q} quadro(s), ativa ${pulo.ativo}, tarja ${pulo.tarja}; ${pulo.ruins.length ? pulo.ruins.join(', ') : 'nenhuma carga, pedido ou bola no ar'} em ${pulo.passos} passos; Enter: ${cedo?.enter ? `${cedo.enter.q} quadro(s), ativa ${cedo.enter.ativo}` : '-'}` : 'nenhuma cena',
        '≤ 2, não, não; nada; ≤ 2, não', !!pulo && pulo.t >= 0.5 && pulo.q <= 2 && !pulo.ativo && !pulo.tarja && pulo.ruins.length === 0 && pulo.passos >= 40 && !!cedo?.enter && cedo.enter.q <= 2 && !cedo.enter.ativo);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('A execução (PC: C1–C6)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ H (hash com × sem a cena)
/**
 * A mesma partida (?demo=1: a entrada da demo, o caminho que escreve no mundo) e a mesma falta no mesmo tick T, com a cena
 * (?cenas=1) e sem ela (?cenas=0): o hash no tick T + 600; com a cena, o mundo no tick T antes e depois dela; sem ela, os
 * quadros com o ícone.
 */
async function rodadaHash(pg, opc) {
  return pg.evaluate(opc => {
    const g = window.__golaco, ct = window.__ct;
    g.reiniciar({ modo: 'partida', semente: 7 });
    g.rodarPassos(900, 'demo');
    const f = g.faltaDeTeste(opc);
    const m = g.mundo, T = m.tick, alvo = T + 600;
    const iaDe = () => JSON.stringify(m.jogadores.map(j => [j.id, j.ia ?? null, j.iaAcao ?? null]));
    const antes = { hash: g.hash(), ia: iaDe() };
    let q = 0, icone = 0;
    const cena = !!g.cenas?.ativo;
    while (g.cenas?.ativo && q < 1500) { ct.quadro(false); q++; if (ct.icone()) icone++; }
    const fimCena = { tick: m.tick, hash: g.hash(), ia: iaDe() };
    let z = 0;
    while (m.tick < alvo - 2 && z < 6000) { ct.quadro(false); z++; if (ct.icone()) icone++; }
    while (m.tick < alvo && z < 12000) { g.relogio.avancar(1000 / 120, { desenhar: false }); z++; }
    return { f, T, cena, quadrosCena: q, mesmoMundo: fimCena.tick === T && fimCena.hash === antes.hash && fimCena.ia === antes.ia, tickFimCena: fimCena.tick, hash: m.tick === alvo ? g.hash() : null, tick: m.tick, icone };
  }, opc);
}
marcar('H');
if (roda('H')) try {
  const com = {}, sem = {};
  for (const [lado, cenas] of [[com, 1], [sem, 0]]) {
    const P = await pagina(`H${cenas}`, `?q=baixa&hora=dia&semente=7&demo=1&cenas=${cenas}&prejogo=0&comemoracao=0&replay=0&substituicao=0`);
    try {
      for (const cor of ['amarelo', 'vermelho']) lado[cor] = await rodadaHash(P.pagina, { cartao: cor });
    } finally { await P.fechar(); }
  }
  for (const cor of ['amarelo', 'vermelho']) {
    const a = com[cor], b = sem[cor];
    meta(`C7 ${cor}: o hash no tick T + 600 com a cena = o da aba com ?cenas=0 (?demo=1, a mesma falta no mesmo tick T); o mundo no tick T igual antes e depois da cena`,
      `T ${a.T} / ${b.T}; com: cena ${a.cena ? `${a.quadrosCena} quadros, no fim tick ${a.tickFimCena}, mundo ${a.mesmoMundo ? 'igual' : 'DIFERENTE'}` : 'não houve'}; hash ${a.hash ?? `não chegou (tick ${a.tick})`} × ${b.hash ?? `não chegou (tick ${b.tick})`}`,
      'iguais; o mesmo mundo no tick T', a.hash != null && a.hash === b.hash && a.T === b.T && (!a.cena || (a.mesmoMundo && a.tickFimCena === a.T)));
  }
  meta('C6 com ?cenas=0 o #cartao-icone aparece em cima de quem levou (a medida do C6 não é vazia)',
    `amarelo ${sem.amarelo.icone} quadros, vermelho ${sem.vermelho.icone}; cena ${sem.amarelo.cena || sem.vermelho.cena ? 'SIM' : 'não'}`, '> 0; sem cena',
    sem.amarelo.icone > 0 && sem.vermelho.icone > 0 && !sem.amarelo.cena && !sem.vermelho.cena);
} catch (e) { meta('H execução (C7: hash com × sem a cena)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ R (replay de parada armado)
marcar('R');
if (roda('R')) try {
  const P = await pagina('R', '?q=baixa&hora=dia&semente=7&demo=1&cenas=1&replay=1&replayParada=1&prejogo=0&comemoracao=0&substituicao=0');
  try {
    const r = await P.pagina.evaluate(() => {
      const g = window.__golaco, ct = window.__ct;
      const R = g.replay, PR = R.paradas ?? null;
      g.rodarPassos(400, 'demo');
      // a falta de teste leva o adversário para junto do condutor: o lance escolhido é um em que o adversário mais perto já
      // está a < 1,6 m de onde a falta o põe e a bola junto do pé (nada salta > 2 m: nenhum corte no anel por causa dela),
      // com o anel sem corte nos últimos 160 passos (o P1 inteiro fica medível)
      const avancar = () => { if (R.estado?.ativo) R.pular(); if (g.cenas?.ativo) g.cenas.pular(); ct.quadro(false); };
      let q = 0, achou = false;
      for (; q < 9000 && !achou; q++) {
        avancar();
        const m = g.mundo;
        if (m.tick < 600 || m.partida.estado !== 'jogo' || R.estado?.ativo || g.cenas?.ativo) continue;
        const c = m.jogadores.find(j => j.id === m.controlado[0]);
        if (!c || m.posse !== c.id) continue;
        const lado = m.ataca[c.time];
        let d = null, dm = Infinity;
        for (const o of m.jogadores) { if (o.time === c.time || o.posicao === 'GOL') continue; const k = Math.hypot(o.x - c.x, o.z - c.z); if (k < dm) { dm = k; d = o; } }
        if (!d || Math.hypot(d.x - (c.x - lado * 1.1), d.z - (c.z + 0.3)) > 1.6 || Math.hypot(m.bola.p.x - (c.x + lado * 0.4), m.bola.p.z - c.z) > 2) continue;
        let corte = false;
        for (let t = m.tick - 160; t <= m.tick && !corte; t++) if (R.corteNoAnel(t) !== false) corte = true;
        if (!corte) achou = true;
      }
      if (!achou) return { achou, q };
      const m = g.mundo;
      const tecs = () => JSON.stringify((g.estadio.tecnicos?.lista ?? []).map(t => [t.id, +t.x.toFixed(4), +t.z.toFixed(4)]));
      const tec0 = tecs(), k0 = g.estadio.tecnicos?.k ?? null;
      const f = g.faltaDeTeste({ cartao: 'amarelo' });
      const T = m.tick, b = m.bola.p, cond = m.jogadores.find(j => j.id === f.cond);
      const forcado = PR ? PR.forcar({ classe: 'A', tipo: 'amarelo', chave: T, fim: T, time: cond?.time ?? 0, ids: [f.def, f.cond], x: b.x, z: b.z, lado: m.ataca[cond?.time ?? 0], peso: 4 }) : false;
      // as cópias dos treinadores na cena: no lugar dos vivos
      const copias = g.cenas?.ativo ? JSON.stringify(g.cenas.atores().filter(a => a.tipo === 'tecnico').map(a => [a.id, +a.x.toFixed(4), +a.z.toFixed(4)])) : null;
      const seq = [];
      let n = 0, tec1 = null, k1 = null, ini = null, tarjaReplay = 0;
      const fase = () => (g.cenas?.ativo ? 'cartao' : R.estado?.ativo ? 'replay:' + R.estado.tipo : m.parada?.cobrador != null ? 'montagem' : m.partida.estado === 'parada' ? 'ao vivo' : 'jogo');
      while (n < 3000) {
        ct.quadro(false); n++;
        const s = fase();
        if (s === 'replay:parada' && ct.tarjaVista()) tarjaReplay++;
        if (seq[seq.length - 1]?.s !== s) {
          seq.push({ s, tick: m.tick });
          if (s !== 'cartao' && tec1 == null) { tec1 = tecs(); k1 = g.estadio.tecnicos?.k ?? null; }
          if (s === 'replay:parada') { const e = R.estado; ini = { tick: m.tick, de: e.de, ate: e.ate, cams: [...e.cams], duracao: e.duracao, chave: e.chave }; }
        }
        if (s === 'montagem' || s === 'jogo') break;
      }
      const cortes = [];
      if (ini) for (let t = T - 150; t <= ini.tick; t++) { const c = R.corteNoAnel(t); if (c !== false) cortes.push(`${t}${c == null ? ' (fora do anel)' : ''}`); }
      return { achou, q, T, f, forcado, seq, ini, tecIgual: tec0 === tec1, k0, k1, tec0, copias, cortes, tarjaReplay, temCenas: !!g.cenas, temParadas: !!PR };
    });
    if (!r.achou) meta('C9 o lance para a falta de teste (o adversário perto, sem corte no anel)', `nenhum em ${r.q} quadros`, '≥ 1', false);
    else {
      const ordem = r.seq.map(x => `${x.s}@${x.tick}`).join(' → ');
      const iCart = r.seq.findIndex(x => x.s === 'cartao'), iRep = r.seq.findIndex(x => x.s === 'replay:parada'), iMon = r.seq.findIndex(x => x.s === 'montagem');
      const okOrdem = iCart === 0 && r.seq[0].tick === r.T && iRep > iCart && r.seq[iRep].tick === r.T + 59 && iMon > iRep && r.seq[iMon].tick === r.T + 60 &&
        r.seq.slice(iCart + 1, iRep).every(x => x.s === 'ao vivo') && r.tarjaReplay === 0;
      meta('C9 com o replay de parada armado: cartão no tick T → 1 s ao vivo → replay de parada no passo antes da montagem (T + 59) → montagem (T + 60); a tarja não volta no replay',
        `T ${r.T}: ${ordem}; tarja no replay ${r.tarjaReplay} quadros${r.forcado ? '' : ' (sem a API dos replays de parada)'}`, 'cartao@T → ao vivo → replay:parada@T+59 → montagem@T+60; 0', okOrdem);
      const i = r.ini;
      meta('C9 (rev. R1) o replay toca INTEIRO: o P1 (tv) começa em chave − 2,5 s e nenhum corte no anel de chave − 2,5 s até a espera',
        i ? `P1 ${i.cams[0]} ${i.de}–${i.ate} (chave ${i.chave}: começa em chave − ${i.chave - i.de}); ${i.cams.join('+')} ${f2(i.duracao)} s; cortes no anel ${r.cortes.length ? r.cortes.join(', ') : 'nenhum'} em ${r.T - 150}–${i.tick}` : 'nenhum replay de parada',
        `tv de ${r.T - 150}; nenhum corte`, !!i && i.cams[0] === 'tv' && i.chave === r.T && i.de === r.T - 150 && r.cortes.length === 0);
      meta('C9 (rev. R1) os treinadores vivos no mesmo x/z e no mesmo passo antes e depois da cena; as cópias da cena no lugar deles',
        `antes ${r.tec0} (passo ${r.k0}); depois ${r.tecIgual ? 'iguais' : 'DIFERENTES'} (passo ${r.k1}); cópias na cena ${r.copias ?? '-'}`,
        'iguais; o mesmo passo; as cópias nos mesmos lugares', r.temCenas && r.tecIgual && r.k0 === r.k1 && r.copias === r.tec0);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('R execução (C9: cartão → replay de parada → montagem)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ C (celular 844×390 Média)
/** A tarja contra o placar e o "Pular" (caixas sem o deslize de entrada) numa cena aberta: {t, pl, pu, folgas, dentro}. */
async function layoutTarja(pg) {
  await pg.evaluate(() => window.__ct.andar({ ate: window.__golaco.cenas.estado.tempos.alto + 0.3 }));
  await pg.evaluate(() => window.__ct.tarjaParada());
  return pg.evaluate(() => {
    const c = window.__ct, t = c.tarjaVista(), pl = c.caixa(document.querySelector('#hud .placar')), pu = c.caixa(document.getElementById('cena-pular'));
    const T = t?.caixa;
    return { t: T ?? null, pl, pu, fPl: T && pl ? c.folga(T, pl) : null, fPu: T && pu ? c.folga(T, pu) : null, cortado: t?.cortado ?? null,
      dentro: !!T && T.x0 >= 0 && T.y0 >= 0 && T.x1 <= innerWidth && T.y1 <= innerHeight, W: innerWidth, H: innerHeight };
  });
}
const txtCaixa = b => (b ? `${b.x0.toFixed(0)}–${b.x1.toFixed(0)} × ${b.y0.toFixed(0)}–${b.y1.toFixed(0)}` : '-');
function conferirLayout(nome, L) {
  meta(`C4 ${nome}: a tarja não encosta no placar nem no "Pular" (≥ 4 px) e fica dentro da tela`,
    L?.t ? `tarja ${txtCaixa(L.t)}; placar ${txtCaixa(L.pl)} (folga ${f2(L.fPl)} px); "Pular" ${txtCaixa(L.pu)} (folga ${f2(L.fPu)} px)${L.cortado ? '; o nome cortado com reticências' : ''}` : 'sem tarja',
    '≥ 4 px dos dois; dentro', !!L?.t && !!L.pu && L.fPl >= LIM.folga && L.fPu >= LIM.folga && L.dentro);
}

marcar('C');
if (roda('C')) try {
  const P = await pagina('C', '?q=media&hora=noite&semente=7&cenas=1&prejogo=0&comemoracao=0&replay=0&substituicao=0&toque=1&entalhe=1', { largura: 844, altura: 390, toque: true });
  try {
    const pg = P.pagina;
    // C5 toque (antes do desenho pesado: a GPU de software atrasa o toque que vem depois de muitos quadros desenhados)
    {
      const F = await falta(pg, { cartao: 'amarelo' });
      let cedo = null, tocou = null, pular = null;
      if (F.ativo) {
        await pg.evaluate(() => window.__ct.andar({ ate: 0.2 }));
        pular = await pg.evaluate(() => { const b = window.__ct.caixa(document.getElementById('cena-pular')); return b && { h: b.y1 - b.y0, w: b.x1 - b.x0, dentro: b.x0 >= 0 && b.y0 >= 0 && b.x1 <= innerWidth && b.y1 <= innerHeight }; });
        await pg.touchscreen.tap(300, 200);
        cedo = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) window.__ct.quadro(false); return { ativo: g.cenas.ativo, t: g.cenas.estado?.tempo }; });
        await pg.evaluate(() => window.__ct.andar({ ate: 0.8 }));
        await pg.touchscreen.tap(300, 200);
        tocou = await pg.evaluate(() => {
          const g = window.__golaco;
          let q = 0; while (q < 6 && g.cenas.ativo) { window.__ct.quadro(false); q++; }
          const toque = getComputedStyle(document.getElementById('toque')).display !== 'none';
          return { q, ativo: g.cenas.ativo, toque, menu: g.estado().menuAberto, tarja: !!window.__ct.tarjaVista() };
        });
      }
      meta('C5 celular: o "Pular" na tela (≥ 48 px, dentro dela) durante a cena', pular ? `${f2(pular.w)} × ${f2(pular.h)} px${pular.dentro ? '' : ' (fora da tela)'}` : 'não aparece', '≥ 48 px; dentro', !!pular && pular.h >= 48 && pular.dentro);
      meta('C5 celular: um toque antes de 0,5 s não pula; depois de 0,5 s, um toque em qualquer lugar acaba a cena em ≤ 2 quadros (os botões de toque voltam, a pausa não abre, a tarja some)',
        tocou ? `aos ${f2(cedo.t)} s: ativa ${cedo.ativo}; aos 0,8 s: ${tocou.q} quadro(s), ativa ${tocou.ativo}, botões ${tocou.toque ? 'visíveis' : 'escondidos'}, pausa ${tocou.menu}, tarja ${tocou.tarja}` : 'nenhuma cena',
        'ativa; ≤ 2, não, visíveis, não, não', !!tocou && cedo.ativo && cedo.t < 0.5 && tocou.q <= 2 && !tocou.ativo && tocou.toque && !tocou.menu && !tocou.tarja);
    }
    // C4 celular 844×390: a caixa da tarja
    {
      const F = await falta(pg, { cartao: 'vermelho' });
      const L = F.ativo ? await layoutTarja(pg) : null;
      await capturar(pg, 'cel-844-tarja');
      if (F.ativo) await pg.evaluate(() => { window.__golaco.cenas.pular(); for (let i = 0; i < 3; i++) window.__ct.quadro(false); });
      conferirLayout('celular 844×390', L);
    }
    // C10 o submenu "Modo de jogo" (antes do desenho pesado)
    {
      const r = await pg.evaluate(async () => {
        const g = window.__golaco, ct = window.__ct;
        g.abrirMenu();
        document.getElementById('btn-modos')?.click();
        await new Promise(res => setTimeout(res, 50));
        const j = document.querySelector('.janela-menu'), bs = [...document.querySelectorAll('#menu-modos .linha-cenas .btn')];
        const cx = bs.map(b => ct.caixa(b));
        let folgaMin = Infinity;
        for (let a = 0; a < cx.length; a++) for (let b = a + 1; b < cx.length; b++) if (cx[a] && cx[b]) folgaMin = Math.min(folgaMin, ct.folga(cx[a], cx[b]));
        const jr = j?.getBoundingClientRect();
        const cortados = bs.filter(b => b.scrollWidth > b.clientWidth + 1 || [...b.querySelectorAll('small')].some(s => s.scrollWidth > s.clientWidth + 1)).map(b => b.id);
        const fora = bs.filter((b, k) => !cx[k] || (jr && (cx[k].x0 < jr.left - 0.5 || cx[k].x1 > jr.right + 0.5))).map(b => b.id);
        const out = { rola: j ? j.scrollHeight - j.clientHeight : NaN, ids: bs.map(b => b.id), textos: bs.map(b => b.textContent.replace(/\s+/g, ' ').trim()), visiveis: cx.filter(Boolean).length, folgaMin, cortados, fora };
        const btn = document.getElementById('btn-cenas'), est = () => document.getElementById('estado-cenas')?.textContent.trim();
        if (btn && g.cenas) {
          out.antes = { txt: est(), ligado: g.cenas.ligado };
          btn.click(); out.depois = { txt: est(), ligado: g.cenas.ligado };
          btn.click(); out.volta = { txt: est(), ligado: g.cenas.ligado };
        }
        document.querySelector('#menu-modos [data-cmd="modos-voltar"]')?.click();
        g.fecharMenu();
        for (let i = 0; i < 3; i++) ct.quadro(false);
        return out;
      });
      const temNovo = r.ids.includes('btn-cenas');
      const alterna = !temNovo || (!!r.antes && r.antes.txt === 'ligadas' && r.antes.ligado === true && r.depois.txt === 'desligadas' && r.depois.ligado === false && r.volta.txt === 'ligadas' && r.volta.ligado === true);
      meta('C10 o submenu "Modo de jogo" com o botão novo (Cenas) cabe sem rolar em 844×390; os botões não encostam (≥ 4 px), não cortam o texto; o botão alterna ligadas ↔ desligadas',
        `rola ${r.rola} px; ${r.textos.map(t => `"${t}"`).join(', ')} (${r.visiveis}/${r.ids.length} visíveis, folga mínima ${f2(r.folgaMin)} px${r.cortados.length ? `, cortados ${r.cortados.join(',')}` : ''}${r.fora.length ? `, fora da janela ${r.fora.join(',')}` : ''}); ${temNovo ? (r.antes ? `alterna: ${r.antes.txt}/${r.antes.ligado} → ${r.depois.txt}/${r.depois.ligado} → ${r.volta.txt}/${r.volta.ligado}` : 'sem a API das cenas') : 'sem o botão novo (a base)'}`,
        'rola ≤ 0; todos visíveis; ≥ 4 px; nenhum cortado; alterna', r.rola <= 0 && r.visiveis === r.ids.length && r.ids.length >= 2 && (r.ids.length < 2 || r.folgaMin >= LIM.folga) && r.cortados.length === 0 && r.fora.length === 0 && alterna);
    }
    // C8 (manequim) + C1–C4/C6 do celular: amarelo e vermelho, 1 quadro desenhado em 6
    for (const [rotulo, opc, chave, cores] of CASOS.slice(0, 2)) {
      const F = await falta(pg, opc);
      await andar(pg, { desenhar: 6 });
      if (F.ativo) await pg.evaluate(() => window.__ct.depois(180));
      else await pg.evaluate(async tarjaMax => { window.__ct.iniciar(tarjaMax); window.__ct.depois(180); }, LIM.tarja);
      const M = await medida(pg);
      conferirCaso(`celular ${rotulo}`, M, F, chave, cores, { altMin: 10, toque: true });
      const pior = Object.entries(M.por);
      const cham = Math.max(0, ...pior.map(([, p]) => p.cham)), tri = Math.max(0, ...pior.map(([, p]) => p.tri));
      meta(`C8 celular 844×390 Média, ${rotulo} (manequim): o pior plano ≤ ${LIM.chamadas} chamadas e ≤ ${LIM.triangulos / 1000} mil triângulos`,
        pior.length ? pior.map(([f, p]) => `${f} ${p.cham}/${(p.tri / 1000).toFixed(0)} mil (${p.n})`).join(' · ') : 'nenhum plano desenhado (sem a cena)',
        `≤ ${LIM.chamadas}; ≤ ${LIM.triangulos / 1000} mil; os ${PLANOS[chave].nomes.length} planos`,
        F.ativo && pior.length === PLANOS[chave].nomes.length && cham <= LIM.chamadas && tri <= LIM.triangulos);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('C execução (celular 844×390: C3–C5, C8, C10)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ U (celular, ?corpo=humano)
marcar('U');
if (roda('U')) try {
  const P = await pagina('U', '?q=media&hora=dia&semente=7&cenas=1&corpo=humano&prejogo=0&comemoracao=0&replay=0&substituicao=0&toque=1&entalhe=1', { largura: 844, altura: 390, toque: true, corpo: true });
  try {
    const pg = P.pagina;
    const corpo = await pg.evaluate(() => window.__golaco.estadio.corpo);
    if (!corpo?.pronto) meta('U o corpo humano carregado (?corpo=humano)', corpo?.erro ?? 'não carregou', 'pronto', false);
    for (const [rotulo, opc, chave, cores] of CASOS.slice(0, 2)) {
      const F = await falta(pg, opc);
      await andar(pg, { desenhar: 6 });
      if (F.ativo) await pg.evaluate(() => window.__ct.depois(180));
      const M = await medida(pg);
      conferirCaso(`?corpo=humano ${rotulo}`, M, F, chave, cores, { altMin: 10, toque: true, semC4: true, semC6: true });
      const pior = Object.entries(M.por);
      const cham = Math.max(0, ...pior.map(([, p]) => p.cham)), tri = Math.max(0, ...pior.map(([, p]) => p.tri)), triC = Math.max(0, ...pior.map(([, p]) => p.triCorpo));
      meta(`C8 celular 844×390 Média, ${rotulo} (?corpo=humano): o pior plano ≤ ${LIM.chamadas} chamadas e ≤ ${LIM.triangulos / 1000} mil triângulos; os dos jogadores ≤ ${LIM.triCorpoMedia / 1000} mil (o teto da Média)`,
        pior.length ? `${pior.map(([f, p]) => `${f} ${p.cham}/${(p.tri / 1000).toFixed(0)} mil, corpo ${(p.triCorpo / 1000).toFixed(1)} mil (${p.n})`).join(' · ')}` : 'nenhum plano desenhado (sem a cena)',
        `≤ ${LIM.chamadas}; ≤ ${LIM.triangulos / 1000} mil; ≤ ${LIM.triCorpoMedia / 1000} mil`,
        F.ativo && !!corpo?.pronto && pior.length === PLANOS[chave].nomes.length && cham <= LIM.chamadas && tri <= LIM.triangulos && triC > 0 && triC <= LIM.triCorpoMedia);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('U execução (celular com ?corpo=humano: C3, C8)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ L (667×375 e 568×320)
marcar('L');
if (roda('L')) for (const [larg, alt] of [[667, 375], [568, 320]]) {
  try {
    const P = await pagina(`L${larg}`, '?q=baixa&hora=dia&semente=7&cenas=1&prejogo=0&comemoracao=0&replay=0&substituicao=0&toque=1&entalhe=1', { largura: larg, altura: alt, dpr: 2, toque: true });
    try {
      const pg = P.pagina;
      const F = await falta(pg, { segundo: true });
      const L = F.ativo ? await layoutTarja(pg) : null;
      await capturar(pg, `cel-${larg}-tarja`);
      conferirLayout(`celular ${larg}×${alt}`, L);
    } finally { await P.fechar(); }
  } catch (e) { meta(`L execução (${larg}×${alt}: C4)`, erroCurto(e), 'sem exceção', false); }
}

// C4 PC numa janela estreita (560×400, sem toque): um nome longo (como o nome completo que o TM manda) corta com reticências
// DENTRO da tela — antes a tarja tinha 520 px fixos e passava 24 px da borda direita
if (roda('L')) try {
  const P = await pagina('L560', '?q=baixa&hora=dia&semente=7&cenas=1&prejogo=0&comemoracao=0&replay=0&substituicao=0', { largura: 560, altura: 400 });
  try {
    const pg = P.pagina;
    const F = await falta(pg, { cartao: 'amarelo' });
    let L = null;
    if (F.ativo) {
      await pg.evaluate(() => window.__ct.andar({ ate: window.__golaco.cenas.estado.tempos.alto + 0.3 }));
      await pg.evaluate(() => window.__ct.tarjaParada());
      L = await pg.evaluate(() => {
        const el = document.getElementById('tarja-cena'), nome = el?.querySelector('.tc-nome-completo');
        if (nome) nome.textContent = 'Henrique Bittencourt de Albuquerque Neto';
        const c = window.__ct, t = c.tarjaVista(), pl = c.caixa(document.querySelector('#hud .placar'));
        return { t: t?.caixa ?? null, cortado: t?.cortado ?? null, pl, fPl: t?.caixa && pl ? c.folga(t.caixa, pl) : null, W: innerWidth, H: innerHeight };
      });
      await capturar(pg, 'pc-560-tarja');
    }
    meta('C4 PC 560×400 (janela estreita, sem toque): a tarja com um nome longo dentro da tela (o nome cortado com reticências) e longe do placar',
      L?.t ? `tarja ${txtCaixa(L.t)} em ${L.W}×${L.H}; nome ${L.cortado ? 'cortado com reticências' : 'inteiro'}; placar a ${f2(L.fPl)} px` : 'sem tarja',
      `dentro (x1 ≤ ${560}); cortado; ≥ ${LIM.folga} px`, !!L?.t && L.t.x0 >= 0 && L.t.x1 <= L.W && L.t.y1 <= L.H && L.cortado && L.fPl >= LIM.folga);
  } finally { await P.fechar(); }
} catch (e) { meta('L execução (PC 560×400: C4)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ G (vantagem que virou gol)
/**
 * O cartão da vantagem que acabou em gol (o cartão guardado sai na bola morta do gol): a bola posta a 0,5 m da linha do
 * gol, rumo ao canto longe do goleiro, a 16 m/s, com o último toque de um atacante; o laço ao vivo faz o gol. pularEm = o
 * tempo da comemoração em que ela é pulada (a cortina dos passos que faltam), ou null. A sequência por quadro: a
 * comemoração (rodando | solta), o cartão, o replay e o jogo, com o tick de cada troca.
 */
async function golComCartao(pg, pularEm) {
  return pg.evaluate(async pularEm => {
    const g = window.__golaco, ct = window.__ct;
    g.reiniciar({ modo: 'partida', semente: 5 });
    const { criarBola } = await import('./js/bola.js');
    const { CAMPO } = await import('./js/config.js');
    g.rodarPassos(600, 'demo');
    let w = 0; while (w < 3000 && g.mundo.partida.estado !== 'jogo') { g.rodarPassos(1, 'demo'); w++; }
    for (let i = 0; i < 30; i++) ct.quadro(false);
    const m = g.mundo, lado = m.ataca[0];
    const adv = m.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
    const autor = m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
    const gk = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
    m.partida.cartoesPendentes.push({ id: adv.id, cor: 'amarelo', motivo: 'spa' });
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    Object.assign(m.bola, criarBola(lado * (CAMPO.meioX - 0.5), gk && gk.z > 0 ? -2.7 : 2.7));
    m.bola.p.y = 0.4; m.bola.v.x = lado * 16; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = false;
    m.ultimoToque = { id: autor.id, time: 0, tick: m.tick };
    const fase = () => (g.cenas?.ativo ? 'cartao' : g.replay.estado?.ativo ? 'replay:' + g.replay.estado.tipo : g.comemoracao.ativa ? 'comemoracao:' + g.comemoracao.estado.estado : 'jogo');
    const seq = [];
    let q = 0, desde = null, pulou = null, comNoCartao = null, cena = null, golT = null;
    while (q < 5000) {
      ct.quadro(false); q++;
      if (desde == null && m.partida.estado === 'gol') { desde = m.partida.desde; golT = m.tick; }
      const s = fase();
      if (seq[seq.length - 1]?.s !== s) {
        seq.push({ s, tick: m.tick, q, estado: m.partida.estado });
        if (s === 'cartao') { comNoCartao = g.comemoracao.ativa; const e = g.cenas.estado; cena = { cor: e.cor, id: e.id }; }
      }
      if (pularEm != null && pulou == null && g.comemoracao.ativa && g.comemoracao.estado.estado === 'rodando' && g.comemoracao.estado.t >= pularEm) { g.comemoracao.pular(); pulou = { q, tick: m.tick }; }
      // depois do replay do gol (ou de 3 s de jogo sem ele), acabou
      const ult = seq[seq.length - 1];
      if (seq.some(x => x.s === 'cartao') && ult.s === 'jogo' && (seq.some(x => x.s === 'replay:gol') || q - ult.q > 180)) break;
    }
    return { adv: adv.id, desde, golT, seq, pulou, comNoCartao, cena, temCenas: !!g.cenas };
  }, pularEm);
}
/**
 * C11b: a mesma vantagem que vira gol, com o TROCAR (Q) segurado do começo da comemoração até o passo gol + 155 (a
 * comemoração e a cena do cartão acabam sozinhas: o botão segurado não pula), com as cenas ligadas ou desligadas
 * (g.cenas.ligar): o passo da saída (gol + 150) vai com a entrada NEUTRA nos dois — com a cena, a comemoração saía do
 * desenho no gol + 149 e o Q chegava à simulação um passo antes (a borda do TROCAR no passo da montagem, que refaz o
 * controlado). Meio quadro por vez (cada um roda 0 ou 1 passo): a mesma entrada por tick nos dois. O hash no gol + 400.
 */
async function golComTrocar(pg, ligadas) {
  const ini = await pg.evaluate(async ligadas => {
    const g = window.__golaco, ct = window.__ct;
    g.cenas?.ligar(ligadas);
    g.reiniciar({ modo: 'partida', semente: 5 });
    const { criarBola } = await import('./js/bola.js');
    const { CAMPO } = await import('./js/config.js');
    g.rodarPassos(600, 'demo');
    let w = 0; while (w < 3000 && g.mundo.partida.estado !== 'jogo') { g.rodarPassos(1, 'demo'); w++; }
    for (let i = 0; i < 30; i++) ct.quadro(false);
    const m = g.mundo, lado = m.ataca[0];
    const adv = m.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
    const autor = m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
    const gk = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
    m.partida.cartoesPendentes.push({ id: adv.id, cor: 'amarelo', motivo: 'spa' });
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    Object.assign(m.bola, criarBola(lado * (CAMPO.meioX - 0.5), gk && gk.z > 0 ? -2.7 : 2.7));
    m.bola.p.y = 0.4; m.bola.v.x = lado * 16; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = false;
    m.ultimoToque = { id: autor.id, time: 0, tick: m.tick };
    let q = 0; while (q < 600 && m.partida.estado !== 'gol') { g.relogio.avancar(1000 / 120, { desenhar: false }); q++; }
    return { desde: m.partida.estado === 'gol' ? m.partida.desde : null, tick: m.tick, comemoracao: g.comemoracao.ativa, ligado: !!g.cenas?.ligado };
  }, ligadas);
  if (ini.desde == null) return { ini };
  await pg.keyboard.down('KeyQ');
  const meio = await pg.evaluate(alvo => {
    const g = window.__golaco, m = g.mundo;
    let n = 0, cartao = false, replay = false;
    while (m.tick < alvo && n < 40000) { g.relogio.avancar(1000 / 120, { desenhar: false }); n++; if (g.cenas?.ativo) cartao = true; if (g.replay.estado?.ativo) replay = true; }
    return { tick: m.tick, cartao, replay, ctrl: m.controlado[0] };
  }, ini.desde + 155);
  await pg.keyboard.up('KeyQ');
  const fim = await pg.evaluate(alvo => {
    const g = window.__golaco, m = g.mundo;
    let n = 0;
    while (m.tick < alvo && n < 40000) { g.relogio.avancar(1000 / 120, { desenhar: false }); n++; }
    return { tick: m.tick, hash: m.tick === alvo ? g.hash() : null, ctrl: m.controlado[0] };
  }, ini.desde + 400);
  await pg.evaluate(() => window.__golaco.cenas?.ligar(true));
  return { ini, meio, fim };
}

marcar('G');
if (roda('G')) try {
  const P = await pagina('G', '?q=baixa&hora=dia&semente=5&cenas=1&prejogo=0&comemoracao=1&replay=1&substituicao=0');
  try {
    {
      const com = await golComTrocar(P.pagina, true), sem = await golComTrocar(P.pagina, false);
      const txt = r => (r.ini.desde == null ? 'sem gol' : `gol ${r.ini.desde}; cena do cartão ${r.meio.cartao ? 'sim' : 'não'}, replay ${r.meio.replay ? 'sim' : 'não'}; controlado ${r.meio.ctrl} → ${r.fim.ctrl}; hash@gol+400 ${r.fim.hash ?? `não chegou (tick ${r.fim.tick})`}`);
      meta('C11b vantagem que vira gol com o TROCAR segurado até o gol + 155: com a cena do cartão × sem ela, a simulação igual (o passo da saída neutro nos dois)',
        `com: ${txt(com)} | sem: ${txt(sem)}`, 'cena só no 1º; os dois hashes iguais',
        com.ini.desde != null && sem.ini.desde != null && com.meio.cartao && !sem.meio.cartao && com.fim.hash != null && com.fim.hash === sem.fim.hash);
    }
    for (const [rotulo, pularEm] of [['a comemoração inteira', null], ['a comemoração pulada antes da hora (cortina)', 1.0]]) {
      const r = await golComCartao(P.pagina, pularEm);
      const s = r.seq, ord = s.map(x => `${x.s}@${x.tick}`).join(' → ');
      const iC = s.findIndex(x => x.s === 'cartao'), iR = s.findIndex(x => x.s === 'replay:gol');
      const iCom = s.findIndex(x => x.s.startsWith('comemoracao'));
      // entre o fim do cartão e o replay do gol só o quadro em que a cena acabou (sem passo: o mundo ainda no gol + 149)
      const entre = iC >= 0 && iR > iC ? s.slice(iC + 1, iR) : [];
      const ok = r.desde != null && iCom >= 0 && iC > iCom && s[iC].tick === r.desde + 149 && iR > iC && entre.every(x => x.s === 'jogo' && x.tick === r.desde + 149) &&
        (iR > iC + 1 ? s[iR].q - s[iC + 1].q <= 2 : true) && s[iR].tick === r.desde + 150 && s[iR].estado !== 'gol' &&
        r.comNoCartao === false && r.cena?.id === r.adv && r.cena?.cor === 'amarelo' && s.slice(iCom, iC).every(x => x.s.startsWith('comemoracao')) &&
        (pularEm == null ? s.slice(iCom, iC).every(x => x.s === 'comemoracao:rodando') : !!r.pulou && s.slice(iCom, iC).some(x => x.s === 'comemoracao:solta'));
      meta(`C11 (rev. R7) vantagem que vira gol, ${rotulo}: comemoração → cartão (gol + 149) → saída e replay do gol (gol + 150); a comemoração fora do desenho no cartão`,
        `gol no tick ${r.desde ?? '-'}${r.pulou ? `, pulada no tick ${r.pulou.tick}` : ''}: ${ord}; cartão ${r.cena ? `${r.cena.cor} de ${r.cena.id} (o guardado: ${r.adv})` : 'nenhum'}; comemoração ${r.comNoCartao ? 'AINDA ATIVA' : 'fora'} no cartão`,
        `comemoracao → cartao@${r.desde != null ? r.desde + 149 : 'gol+149'} → replay:gol@${r.desde != null ? r.desde + 150 : 'gol+150'}`, ok);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('G execução (C11: a vantagem que virou gol)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ T (Total Match, travado expulso)
/** Página do "TM" (a mesma origem): grava o pedido e abre o jogo num iframe (como o teste-tm-tela). */
function htmlQuadro(pedido, q) {
  const json = JSON.stringify(JSON.stringify(pedido)).replace(/</g, '\\u003c');
  const id = JSON.stringify(pedido.id);
  return `<!doctype html><html><head><meta charset="utf-8"><title>TM</title></head><body style="margin:0;background:#000">
<script>
localStorage.setItem('tm3d:pedido:' + ${id}, ${json});
localStorage.removeItem('tm3d:resultado:' + ${id});
const f = document.createElement('iframe');
f.id = 'q'; f.src = 'index.html?tm=' + encodeURIComponent(${id}) + '&${q}';
f.allow = 'fullscreen; autoplay; gamepad';
f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
}
marcar('T');
if (roda('T')) try {
  const s = await abrir({ largura: 1280, altura: 720 });
  try {
    const url = `${srv.url}__quadro-tm-${PED_C.id}.html`;
    await s.contexto.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlQuadro(PED_C, 'q=baixa&cenas=1&replay=1&replayParada=1&comemoracao=0&prejogo=0&substituicao=0') }));
    await s.pagina.goto(url, { waitUntil: 'load' });
    let fr = null;
    for (let i = 0; i < 400 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
    if (!fr) throw new Error('o quadro do jogo não abriu');
    await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 600000 });
    await fr.evaluate(instalar);
    const r = await fr.evaluate(() => {
      const g = window.__golaco, ct = window.__ct;
      g.relogio.usarManual(true);
      g.rodarPassos(600, 'demo');
      for (let i = 0; i < 60; i++) ct.quadro(false);
      const trava = g.tm?.trava ?? null, ctrl = g.estado().controlado;
      // a falta é DO travado (o controlado), com o vermelho; o replay de parada (classe A) da bola morta dela, armado
      const f = g.faltaDeTeste({ cartao: 'vermelho', doMeu: true });
      const m = g.mundo, T = m.tick, b = m.bola.p, cond = m.jogadores.find(j => j.id === f.cond);
      const forcado = g.replay.paradas ? g.replay.paradas.forcar({ classe: 'A', tipo: 'vermelho', chave: T, fim: T, time: cond?.time ?? 1, ids: [f.def, f.cond], x: b.x, z: b.z, lado: m.ataca[cond?.time ?? 1], peso: 4 }) : false;
      const fx = document.getElementById('faixa'), titulo = () => document.getElementById('faixa-titulo')?.textContent.trim() ?? '';
      const faixa = () => ct.vis(fx) && /expulso/i.test(titulo());
      const fase = () => (g.cenas?.ativo ? 'cartao' : g.replay.estado?.ativo ? 'replay:' + g.replay.estado.tipo : m.partida.estado === 'parada' && m.parada?.cobrador == null ? 'ao vivo' : 'jogo');
      const seq = [{ s: fase(), tick: m.tick, faixa: faixa() }];
      let n = 0, antes = 0;
      const viuReplay = () => seq.some(x => x.s === 'replay:parada');
      while (n < 3000) {
        const fi = faixa(), s = fase();
        if (fi && (s !== 'jogo' && s !== 'ao vivo' || !viuReplay())) antes++;
        if (fi && viuReplay() && s !== 'replay:parada' && s !== 'cartao') break;
        ct.quadro(false); n++;
        const s2 = fase();
        if (seq[seq.length - 1].s !== s2) seq.push({ s: s2, tick: m.tick, faixa: faixa() });
      }
      return { trava, ctrl, f, T, forcado, seq, antes, faixa: faixa(), titulo: titulo(), temCenas: !!g.cenas };
    });
    // os 6 s da faixa contam em tempo real (setTimeout): visível por quanto tempo depois de aparecer (o jogo andando junto)
    let dur = 0;
    if (r.faixa) {
      const t1 = Date.now();
      let vis = true;
      while (vis && Date.now() - t1 < 10000) {
        await s.pagina.waitForTimeout(100);
        vis = await fr.evaluate(() => { for (let i = 0; i < 6; i++) window.__ct.quadro(false); return window.__ct.vis(document.getElementById('faixa')) && /expulso/i.test(document.getElementById('faixa-titulo')?.textContent ?? ''); });
      }
      dur = (Date.now() - t1) / 1000;
    }
    errosTodos.push(...s.erros.map(e => `T: ${e}`));
    const ord = r.seq.map(x => `${x.s}@${x.tick}${x.faixa ? '+faixa' : ''}`).join(' → ');
    const iC = r.seq.findIndex(x => x.s === 'cartao'), iR = r.seq.findIndex(x => x.s === 'replay:parada');
    meta('C12 (rev. R11) Total Match, o travado expulso: a faixa "Você foi expulso" só depois da cena e do replay de parada (nenhum quadro antes), e depois ≥ 5 s visível',
      `travado ${r.trava} (controlado ${r.ctrl}), a falta dele ${r.f?.def === r.trava ? 'sim' : 'NÃO'}; ${ord}; faixa antes do fim ${r.antes} quadros; depois ${r.faixa ? `"${r.titulo}" por ${f2(dur)} s` : 'não apareceu'}`,
      'cartao → ao vivo → replay:parada → faixa; 0; ≥ 5 s', r.f?.def === r.trava && iC === 0 && iR > iC && r.antes === 0 && r.faixa && dur >= 5);
    // C12b / C12c: o 2º amarelo do travado guardado na vantagem que acaba em gol do adversário (o cartão sai no gol). b: no
    // meio do jogo, com a comemoração — a faixa só DEPOIS da comemoração, da cena do cartão e do replay do gol (antes ela
    // era mostrada no tick do gol, escondida debaixo das três, e os 6 s acabavam sem ninguém ver); c: o gol que acaba o
    // jogo — a faixa do fim fica (com o "Voltar ao Total Match") e a do expulso não sai. "Mostrada" = a faixa com o título
    // do expulso e sem `hidden`, mesmo escondida pelo CSS das cenas (o que o hud fez, não o que a tela pinta)
    const golTravado = (fimDeJogo) => fr.evaluate(async fimDeJogo => {
      const g = window.__golaco, ct = window.__ct;
      g.comemoracao.ligada(!fimDeJogo);
      g.reiniciar({ modo: 'partida', semente: 5 });
      const { criarBola } = await import('./js/bola.js');
      const { CAMPO } = await import('./js/config.js');
      g.rodarPassos(600, 'demo');
      let w = 0; while (w < 3000 && g.mundo.partida.estado !== 'jogo') { g.rodarPassos(1, 'demo'); w++; }
      for (let i = 0; i < 30; i++) ct.quadro(false);
      const m = g.mundo, p = m.partida, trava = g.tm?.trava ?? null;
      const tj = m.jogadores.find(j => j.id === trava);
      if (!tj) return { erro: 'sem o travado' };
      const T = tj.time, adv = 1 - T, lado = m.ataca[adv];
      p.cartoes[trava] = 1;
      p.cartoesPendentes.push({ id: trava, cor: 'amarelo', motivo: 'spa' });
      if (fimDeJogo) {
        // o 2º tempo nos acréscimos, acabando 60 passos depois daqui (o gol sai antes; o fim chega no passo da saída)
        p.tempo = 2; p.acrescimo = 1;
        p.tick0Tempo = m.tick - (p.ticksPorTempo + Math.round(p.ticksPorTempo / 45)) + 60;
      }
      const autor = m.jogadores.find(j => j.time === adv && j.posicao !== 'GOL');
      const gk = m.jogadores.find(j => j.time === T && j.posicao === 'GOL');
      m.posse = null; m.naMao = null; m.voo = null; m.parada = null; p.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
      Object.assign(m.bola, criarBola(lado * (CAMPO.meioX - 0.5), gk && gk.z > 0 ? -2.7 : 2.7));
      m.bola.p.y = 0.4; m.bola.v.x = lado * 16; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = false;
      m.ultimoToque = { id: autor.id, time: adv, tick: m.tick };
      const fx = document.getElementById('faixa'), titulo = () => document.getElementById('faixa-titulo')?.textContent.trim() ?? '';
      const mostrada = () => !fx.hidden && /expulso/i.test(titulo());
      const fase = () => (g.cenas?.ativo ? 'cartao' : g.replay.estado?.ativo ? 'replay:' + g.replay.estado.tipo : g.comemoracao.ativa ? 'comemoracao' : p.estado === 'gol' ? 'gol' : p.estado === 'fim' ? 'fim' : 'jogo');
      const seq = [];
      let n = 0, primeira = null, depois = 0;
      while (n < 12000) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
        const s = fase();
        if (seq[seq.length - 1]?.s !== s) seq.push({ s, tick: m.tick });
        if (primeira == null && mostrada()) primeira = { s, tick: m.tick, estado: p.estado, vista: ct.vis(fx) };
        const viuReplay = seq.some(x => x.s === 'replay:gol');
        if (viuReplay && (s === 'jogo' || s === 'fim') && ++depois > 240) break;
        if (!fimDeJogo && primeira && primeira.s === 'jogo' && viuReplay) break;
      }
      g.comemoracao.ligada(true);
      return { trava, seq, primeira, estado: p.estado, titulo: titulo(), oculta: fx.hidden, vista: ct.vis(fx), botao: document.getElementById('faixa-botao')?.textContent.trim() ?? '', botaoVisto: ct.vis(document.getElementById('faixa-botao')) };
    }, fimDeJogo);
    {
      const b = await golTravado(false);
      let durB = 0;
      if (b.primeira && b.vista) {
        const t1 = Date.now();
        let vis = true;
        while (vis && Date.now() - t1 < 10000) {
          await s.pagina.waitForTimeout(100);
          vis = await fr.evaluate(() => { for (let i = 0; i < 6; i++) window.__ct.quadro(false); return window.__ct.vis(document.getElementById('faixa')) && /expulso/i.test(document.getElementById('faixa-titulo')?.textContent ?? ''); });
        }
        durB = (Date.now() - t1) / 1000;
      }
      const ordB = (b.seq ?? []).map(x => `${x.s}@${x.tick}`).join(' → ');
      const iCom = (b.seq ?? []).findIndex(x => x.s === 'comemoracao'), iCa = (b.seq ?? []).findIndex(x => x.s === 'cartao'), iRe = (b.seq ?? []).findIndex(x => x.s === 'replay:gol');
      meta('C12b (rev. R11) TM, o 2º amarelo do travado na vantagem que vira gol: a faixa "Você foi expulso" só depois da comemoração, da cena do cartão e do replay do gol, e depois ≥ 5 s visível',
        b.erro ?? `${ordB}; mostrada pela 1ª vez ${b.primeira ? `em ${b.primeira.s}@${b.primeira.tick} (estado ${b.primeira.estado})` : 'nunca'}; visível ${f2(durB)} s`,
        'comemoracao → cartao → replay:gol → faixa no jogo; ≥ 5 s', !b.erro && iCom >= 0 && iCa > iCom && iRe > iCa && b.primeira?.s === 'jogo' && durB >= 5);
      const c = await golTravado(true);
      const ordC = (c.seq ?? []).map(x => `${x.s}@${x.tick}`).join(' → ');
      meta('C12c TM, o mesmo no gol que acaba o jogo: a faixa do expulso não sai e fica a do fim, com o "Voltar ao Total Match"',
        c.erro ?? `${ordC}; a do expulso ${c.primeira ? `mostrada em ${c.primeira.s}@${c.primeira.tick}` : 'nunca'}; no fim: "${c.titulo}" ${c.vista ? 'visível' : 'escondida'}, botão "${c.botao}" ${c.botaoVisto ? 'visível' : 'escondido'}`,
        'nunca; "Fim de jogo" com o botão', !c.erro && c.estado === 'fim' && !c.primeira && /fim de jogo/i.test(c.titulo) && c.vista && /total match/i.test(c.botao) && c.botaoVisto);
    }
  } finally { await s.navegador.close(); }
} catch (e) { meta('T execução (C12: Total Match, o travado expulso)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ I (intervalo, PR 3)
/**
 * A cena do intervalo de uma partida IA × IA de verdade (?demo=1): a semente com um gol no 1º tempo (acharGol, como a página
 * joga), o gol AO VIVO (o guardador o guarda na saída), a API até o fim do tempo regulamentar (o acréscimo anunciado) e o
 * laço ao vivo até a saída do 2º tempo. Mede a cena quadro a quadro e devolve o hash no tick `alvo` (pela API depois dela).
 * o = {semente, golTick, alvo, proximo (o toque no 'campo'), pular (o Pular no 'campo'), pausa (quadros pausados no 'tunel'),
 * caixas (as tarjas e o painel contra o placar e o "Pular")}.
 */
async function rodadaIntervalo(pg, o) {
  return pg.evaluate(async o => {
    const g = window.__golaco, ct = window.__ct;
    g.reiniciar({ modo: 'partida', semente: o.semente });
    // (o mundo NOVO: o reiniciar troca o objeto)
    const m = g.mundo;
    if (o.golTick != null) {
      g.rodarPassos(Math.max(0, o.golTick - 120 - m.tick), 'demo');
      let q = 0;
      while (m.tick < o.golTick + 220 && q < 3000) { ct.quadro(false); q++; }
    }
    let n = 0;
    while (m.partida.tempo === 1 && m.partida.acrescimo == null && n < 40000) { g.rodarPassos(30, 'demo'); n += 30; }
    const sons0 = { ...g.estadio.sonsPedidos };
    const r = { cena: false, fases: [], tickMudou: 0, tick0: null, placar: [m.placar[0], m.placar[1]], lances: g.cenas?.lances?.length ?? null,
      tarjaPlacar: 0, tarjaTexto: null, est: 0, estLinhas: null, replayLance: 0, cenaDuranteLance: 0, geralVazio: 0, geral: 0,
      pausaParada: null, proximo: null, pulou: null, fimTick: null, tempo2: null, caixas: [], apitoNoApito: null, quadros: 0 };
    let q = 0, ultimaFase = null, viuApito = false;
    for (; q < 40000; q++) {
      ct.quadro(false);
      if (!r.cena && g.cenas?.ativo && g.cenas.tipo === 'intervalo') { r.cena = true; r.tick0 = m.tick; }
      if (r.cena && !g.cenas.ativo) { r.fimTick = m.tick; break; }
      if (!r.cena) { if (m.partida.tempo === 2 && m.partida.estado === 'jogo') break; continue; }
      r.quadros++;
      const e = g.cenas.estado;
      if (e.fase !== ultimaFase) {
        // o apito pedido até o fim do plano 'apito' (R6: sem esperar a cena acabar)
        if (ultimaFase === 'apito' && !viuApito) { const s1 = g.estadio.sonsPedidos; r.apitoNoApito = Object.keys(s1).filter(k => /apito/i.test(k) && (s1[k] ?? 0) > (sons0[k] ?? 0)); viuApito = true; }
        r.fases.push(e.fase); ultimaFase = e.fase;
        if (e.fase === 'campo' && o.proximo && r.proximo == null) { g.cenas.proximo(); r.proximo = g.cenas.estado?.fase ?? 'acabou'; }
        if (e.fase === 'campo' && o.pular && r.pulou == null) { g.cenas.pular(); r.pulou = { fase: g.cenas.estado?.fase ?? 'acabou', ativo: g.cenas.ativo }; }
        if (e.fase === 'tunel' && o.pausa && r.pausaParada == null) {
          const t0 = e.tempo; g.pausar(true);
          for (let k = 0; k < o.pausa; k++) ct.quadro(false);
          r.pausaParada = { antes: t0, depois: g.cenas.estado.tempo, tick: m.tick === r.tick0 }; g.pausar(false);
        }
      }
      if (e.fase !== 'geral' && m.tick !== r.tick0) r.tickMudou++;
      const T = g.cenas.tarjas;
      if (T?.placar?.visivel) { r.tarjaPlacar++; r.tarjaTexto = { gols: T.placar.gols, autores: T.placar.autores }; }
      if (T?.estatisticas?.visivel) { r.est++; r.estLinhas = T.estatisticas.linhas; }
      if (o.caixas && (T?.placar?.visivel || T?.estatisticas?.visivel)) {
        const C = T.caixas, W = innerWidth, H = innerHeight;
        for (const k of ['placar', 'estatisticas']) {
          const b = C[k]; if (!b) continue;
          const f = (a, c) => (a && c ? Math.max(c.x0 - a.x1, a.x0 - c.x1, c.y0 - a.y1, a.y0 - c.y1) : 99);
          r.caixas.push({ k, dentro: b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H, placarHud: f(b, C.placarHud), pular: f(b, C.pular) });
        }
      }
      const rp = g.replay.estado;
      if (rp?.ativo && rp.tipo === 'lance') { r.replayLance++; if (g.cenas.ativo) r.cenaDuranteLance++; }
      if (e.fase === 'geral') { r.geral++; if (e.vazio && !e.bolaVisivel) r.geralVazio++; }
    }
    r.tempo2 = m.partida.tempo === 2;
    const S = g.cenas?.sumula?.() ?? null;
    if (S) {
      const SU = await import('./js/sumula.js');
      r.sumula = { est: SU.estatisticas(S, 1), gols: S.gols.map(x => ({ time: x.time, minuto: x.minuto, contra: x.contra })) };
    }
    if (o.alvo != null) { if (m.tick < o.alvo) g.rodarPassos(o.alvo - m.tick, 'demo'); r.hash = m.tick === o.alvo ? g.hash() : null; r.tickHash = m.tick; }
    return r;
  }, o);
}
marcar('I');
if (roda('I')) try {
  const { acharGol } = await import(pathToFileURL(path.join(AQUI, 'lib/acha-gol.mjs')).href);
  const GOL = await acharGol({ pastaJs: path.join(RAIZ, 'js'), maxTicks: 13000, comoPagina: true });
  if (!GOL) throw new Error('nenhuma semente com gol no 1º tempo');
  const url = c => `?q=baixa&hora=dia&semente=${GOL.semente}&demo=1&cenas=${c}&prejogo=0&comemoracao=0&replay=0&replayParada=0&substituicao=0`;
  const P1 = await pagina('I1', url(1));
  let a, b, c, d, z;
  try {
    // (o alvo: 25 s depois do fim do 1º tempo — o intervalo de 3 s e o começo do 2º tempo)
    a = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo: null, pausa: 30 });
    const alvo = (a.tick0 ?? 14400) + 1500;
    a = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, pausa: 30 });
    c = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, proximo: true });
    d = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, pular: true });
    const P0 = await pagina('I0', url(0));
    try { b = await rodadaIntervalo(P0.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo }); } finally { await P0.fechar(); }
  } finally { await P1.fechar(); }
  const PC = await pagina('IC', url(1), { largura: 844, altura: 390, dpr: 2, toque: true });
  try { z = await rodadaIntervalo(PC.pagina, { semente: GOL.semente, golTick: GOL.golTick, caixas: true }); } finally { await PC.fechar(); }
  const PL = await pagina('IL', url(1), { largura: 568, altura: 320, dpr: 2, toque: true });
  let zl;
  try { zl = await rodadaIntervalo(PL.pagina, { semente: GOL.semente, golTick: GOL.golTick, caixas: true }); } finally { await PL.fechar(); }

  meta('I1 a cena ativa no apito do 1º tempo, o mundo.tick parado até o geral, os planos na ordem',
    a.cena ? `tick ${a.tick0}; fases ${a.fases.join(' → ')}; o tick mudou em ${a.tickMudou} quadros antes do geral; ${a.quadros} quadros` : 'nenhuma cena (só a faixa)',
    'apito → campo → tunel → torcida → [lances] → estatisticas → geral; 0', a.cena && a.tickMudou === 0 && a.fases[0] === 'apito' && a.fases.includes('estatisticas') && a.fases.at(-1) === 'geral');
  const gols1 = (a.sumula?.gols ?? []).filter(x => x.minuto <= 45);
  const autOk = a.tarjaTexto && gols1.every(x => (a.tarjaTexto.autores[x.time] ?? []).some(t => t.includes(`${x.minuto}'`)));
  meta('I2 a tarja do placar com os autores do 1º tempo (os minutos da súmula) aparece na cena',
    a.tarjaTexto ? `${a.tarjaPlacar} quadros; "${a.tarjaTexto.gols}" · ${JSON.stringify(a.tarjaTexto.autores)} × súmula ${gols1.map(x => `${x.time}:${x.minuto}'`).join(', ')}` : 'não apareceu',
    '≥ 1 s; os autores certos', a.tarjaPlacar >= 60 && !!autOk && gols1.length > 0);
  meta('I3 os lances do 1º tempo (o guardador) tocam dentro da cena, e a cena continua depois deles',
    `${a.lances ?? '-'} guardados; ${a.replayLance} quadros de lance, a cena ativa em ${a.cenaDuranteLance}; fases ${a.fases.includes('lances') ? 'com' : 'sem'} 'lances'`,
    '≥ 1 guardado; o lance tocado com a cena ativa', (a.lances ?? 0) >= 1 && a.replayLance > 30 && a.cenaDuranteLance === a.replayLance && a.fases.includes('estatisticas'));
  const est = a.sumula?.est, linhas = a.estLinhas ?? [];
  const num = t => +(String(t).match(/\d+/)?.[0] ?? NaN);
  const estErr = est ? ['posse', 'chutes', 'noAlvo', 'escanteios', 'faltas'].filter(k => { const l = linhas.find(x => x.item === k); return !l || num(l.a) !== est[k][0] || num(l.b) !== est[k][1]; }) : ['sem súmula'];
  meta('I4 o painel de estatísticas do 1º tempo = a súmula (posse, finalizações, no alvo, escanteios, faltas)',
    `${a.est} quadros; ${linhas.map(l => `${l.item} ${l.a}–${l.b}`).join(', ')}; diferentes: ${estErr.join(', ') || 'nenhum'}`, 'iguais', a.est > 60 && estErr.length === 0);
  meta('I5 o hash no mesmo tick do 2º tempo com a cena = o da aba com ?cenas=0 (?demo=1)',
    `com ${a.hash ?? `não chegou (${a.tickHash})`} × sem ${b.hash ?? `não chegou (${b.tickHash})`}; sem a cena: ${b.cena ? 'teve cena!' : 'sem cena'}`, 'iguais',
    a.hash != null && a.hash === b.hash && !b.cena);
  meta('I6 o toque no campo = o próximo bloco; o Pular = a saída do 2º tempo (o mesmo hash)',
    `toque: campo → ${c.proximo ?? '-'}; pular: ${d.pulou ? (d.pulou.ativo ? `fase ${d.pulou.fase}` : 'acabou') : '-'}, 2º tempo ${d.tempo2}; hash ${c.hash === a.hash ? 'igual' : 'DIFERENTE'} / ${d.hash === a.hash ? 'igual' : 'DIFERENTE'}`,
    'o bloco seguinte; geral/saída; iguais', c.proximo != null && c.proximo !== 'campo' && d.pulou != null && (!d.pulou.ativo || d.pulou.fase === 'geral') && d.tempo2 && c.hash === a.hash && d.hash === a.hash);
  meta('I7 a pausa congela a cena (o relógio dela e o mundo)',
    a.pausaParada ? `tempo ${a.pausaParada.antes.toFixed(2)} → ${a.pausaParada.depois.toFixed(2)} s em 30 quadros pausados; tick ${a.pausaParada.tick ? 'parado' : 'ANDOU'}` : 'não mediu',
    'parados', !!a.pausaParada && Math.abs(a.pausaParada.depois - a.pausaParada.antes) < 1e-6 && a.pausaParada.tick);
  const enc = [...(z?.caixas ?? []).map(x => ({ ...x, tela: '844×390' })), ...(zl?.caixas ?? []).map(x => ({ ...x, tela: '568×320' }))];
  const ruins = enc.filter(x => !x.dentro || x.placarHud < 4 || x.pular < 4);
  meta('I8 a tarja do placar e o painel não encostam no placar nem no "Pular" e ficam na tela (844×390 e 568×320)',
    `${enc.length} medidas; ${ruins.length} ruins${ruins.length ? ` (${ruins[0].tela} ${ruins[0].k}: dentro ${ruins[0].dentro}, placar ${ruins[0].placarHud.toFixed(0)} px, Pular ${ruins[0].pular.toFixed(0)} px)` : ''}`,
    '0 (folga ≥ 4 px)', enc.length > 0 && ruins.length === 0);
  meta('I11 o apito do intervalo é pedido no plano do apito (não no fim da cena)', a.apitoNoApito ? `pedidos até o fim do apito: ${a.apitoNoApito.join(', ') || 'nenhum'}` : 'não mediu',
    '≥ 1', (a.apitoNoApito?.length ?? 0) > 0);
  meta('I12 no geral o campo vazio: nenhum dos 22 nem a bola até o corte da saída', `${a.geralVazio}/${a.geral} quadros do geral vazios`, 'todos', a.geral > 0 && a.geralVazio === a.geral);
} catch (e) { meta('I execução (intervalo: I1–I8, I11, I12)', erroCurto(e), 'sem exceção', false); }

marcar('fim');
await srv.fechar();
meta('console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const seg = (Date.now() - t0) / 1000;
console.log(`tempos: ${marcas.slice(0, -1).map(([n, t], k) => [n, (marcas[k + 1][1] - t) / 1000]).filter(([, x]) => x >= 0.5).map(([n, x]) => `${n} ${x.toFixed(0)} s`).join(', ')}\n`);
console.log(tabelaTexto([['', 'Item', 'Medido', 'Alvo'], ...res.map(r => [r.info ? 'INFO' : r.ok ? 'PASSOU' : 'REPROVOU', r.nome, r.medido, r.alvo])]));
const falhas = res.filter(r => !r.ok && !r.info).length;
console.log(`\nteste-cenas-tela: ${falhas ? `REPROVOU (${falhas})` : 'PASSOU'} em ${seg.toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
