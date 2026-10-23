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
//   node tools/teste-cenas-tela.mjs [--raiz <pasta do jogo>] [--so A,H,R,C,U,L,G,T,I,F,FC,FU,FT,FO] [--capturas <pasta>]
//   (A = PC 1280×720: C1–C6; H = hash com × sem a cena: C7 e o ícone com ?cenas=0; R = replay de parada: C9; C = celular
//   844×390 Média: C3–C5, C8, C10; U = celular com ?corpo=humano: C3, C8; L = 667×375 e 568×320: C4; G = gol: C11;
//   T = Total Match: C12; I = o intervalo (PR 3): I1–I8, I11, I12 — a cena ativa no apito do 1º tempo com o tick parado até
//   o geral, a tarja do placar com os autores da súmula, os lances do guardador dentro da cena, as estatísticas = súmula,
//   o hash do 2º tempo igual ao de ?cenas=0, o toque/Pular, a pausa, nada encostando em 844×390/568×320, o apito no plano
//   do apito e o campo vazio no geral)
// O PÓS-JOGO (PR 4; PLANO-CENAS.md §5.6; partidas de 2 × 1 min levadas até 40 passos do apito final pela API dos testes —
// rodarPassos, nenhuma cena no caminho — e o resto pelo laço da página; o placar escrito no mundo nos desfechos forçados):
//   F (PC 1280×720): F1 a cena começa no apito final (o tick do 'fimDeJogo') com os planos e as durações de cada desfecho
//      (vitória 36 s, empate 33,5 s; a partida de verdade com um gol roteirizado, a derrota 0–1 e o empate 1–1) e, com o gol
//      no último lance, depois do replay dele, no mesmo tick; F2 o mundo.tick e o hash parados do apito até a faixa final (e
//      nela); F3 a tarja do placar final = o placar e os autores da súmula, o painel = as estatísticas da partida, cada um só
//      no plano dele, nunca dois juntos, nenhum outro texto; F4 a tarja do melhor em campo = sumula.melhorEmCampo (= o argmax
//      da nota calculado no teste), a ficha e a nota com uma casa, e o close dele; F5 a faixa final com "Jogar de novo" e
//      "Melhores momentos" (os lances do guardador tocam com o mundo parado e voltam à faixa; um aperto pula o lance; "Jogar de
//      novo" zera a cena); F5b a troca de camisa (o par de linha com o kit misto; o peito na captura pela camisa do outro);
//      F6 Enter = o próximo bloco (não antes de 0,5 s); F10 só as cópias dos treinadores na cena (os vivos parados) e, com o
//      gol no último lance, o apito final pedido no plano do apito (R6);
//   FC (celular 844×390 Média e 568×320): F1; F6 o toque = o próximo bloco, o "Pular" = a faixa final; F8 as tarjas e a faixa
//      final (os dois botões) sem encostar em nada e dentro da tela, ≤ 40 chamadas e ≤ 130 mil triângulos no pior plano e a
//      troca de camisa sem chamada a mais (com × ?troca=0);
//   FU (celular, ?corpo=humano): F9 o corpo novo pronto, ≤ 40 chamadas, ≤ 130 mil triângulos e os jogadores ≤ 60 mil; a troca
//      de camisa no corpo novo (o peito na captura) e sem chamada a mais (com × ?troca=0);
//   FT (Total Match, pedido A): F7 o resultado no localStorage no 1º quadro da cena (com o "melhor" = o da tarja), sem as
//      estatísticas (vitória 30 s), "Voltar ao Total Match" na faixa e o "tm3d:fim" só no clique; o empate sem
//      "empateContinua" = o curto (14,5 s); com "empateContinua: false", o empate inteiro sem as estatísticas e, no celular, o
//      "Pular" leva à faixa com o "Voltar ao Total Match";
//   FO (online, duas abas pelo BroadcastChannel): F1 a cena roda nas duas sem segurar o laço; F2 no fim só o tick anda (o hash
//      sem o tick igual nas duas e no tempo; nenhuma dessincronia).
// Na base sem o pós-jogo (a3821da7: os 22 congelados e só a faixa) reprovam F1, F3–F10 e o F2 fora do online (o tick anda no
// 'fim'); o F2 do online passa lá (sem cena o lockstep também segue) e fica de guarda.
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
const { PED_A, PED_C } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);

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
const capturar = async (pg, nome) => { if (pastaCap) await pg.screenshot({ path: path.join(pastaCap, nome + '.png'), timeout: 180000 }); };
/** Os pixels (média 3×3) de vários pontos [x, y] px CSS numa captura só (o pós-jogo: a captura do Chromium sem GPU é lenta). */
async function pixels(pg, pts) {
  const png = await pg.screenshot({ type: 'png', timeout: 180000 });
  return pg.evaluate(async ({ src, pts }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const k = c.getContext('2d'); k.drawImage(i, 0, 0);
    const s = i.width / window.innerWidth;
    return pts.map(([x, y]) => {
      const d = k.getImageData(Math.round(x * s) - 1, Math.round(y * s) - 1, 3, 3).data;
      const m = [0, 0, 0]; for (let q = 0; q < 9; q++) for (let ch = 0; ch < 3; ch++) m[ch] += d[q * 4 + ch] / 9;
      return m;
    });
  }, { src: png.toString('base64'), pts });
}

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
// (as mensagens do jogo para o TM: o pós-jogo confere que o 'tm3d:fim' só sai no clique)
window.__msgs = [];
addEventListener('message', e => { const q = document.getElementById('q'); if (e.origin === location.origin && q && e.source === q.contentWindow) window.__msgs.push(e.data); });
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
      pausaParada: null, proximo: null, pulou: null, fimTick: null, tempo2: null, caixas: [], apitoNoApito: null, quadros: 0, segura: null };
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
        // (revisão) K SEGURADO o.segura quadros nas estatísticas = um bloco só (o geral): antes um bloco por quadro — do geral
        // ia também à saída (pularFim)
        if (e.fase === 'estatisticas' && o.segura && r.segura == null) {
          const ev = t => window.dispatchEvent(new KeyboardEvent(t, { code: 'KeyK', key: 'k' }));
          ev('keydown');
          for (let k = 0; k < o.segura; k++) ct.quadro(false);
          ev('keyup');
          ct.quadro(false);
          const e2 = g.cenas.ativo ? g.cenas.estado : null;
          r.segura = { ativo: !!g.cenas.ativo, fase: e2?.fase ?? 'acabou', rapido: e2?.rapido ?? null };
        }
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
  let a, b, c, d, z, sg;
  try {
    // (o alvo: 25 s depois do fim do 1º tempo — o intervalo de 3 s e o começo do 2º tempo)
    a = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo: null, pausa: 30 });
    const alvo = (a.tick0 ?? 14400) + 1500;
    a = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, pausa: 30 });
    c = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, proximo: true });
    d = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, pular: true });
    sg = await rodadaIntervalo(P1.pagina, { semente: GOL.semente, golTick: GOL.golTick, alvo, segura: 6 });
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
  meta('I6b (revisão) um botão de jogo segurado (K, 6 quadros) nas estatísticas = um bloco só (o geral, sem ir também à saída); o mesmo hash',
    sg?.segura ? `estatisticas → ${sg.segura.ativo ? sg.segura.fase : 'a cena ACABOU'} (pulado ${sg.segura.rapido}); hash ${sg.hash === a.hash ? 'igual' : 'DIFERENTE'}` : 'não mediu',
    'geral, sem o pulo; igual', !!sg?.segura && sg.segura.ativo && sg.segura.fase === 'geral' && sg.segura.rapido === false && sg.hash === a.hash);
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

// ------------------------------------------------------------------------------------------------ F (pós-jogo, PR 4)
// O que a cena do pós-jogo tem de ser (PLANO-CENAS.md §5.1; o plano 'troca', 1,5 s com a troca de camisa depois da elipse,
// entrou no PR 4 — §6 CENA_FIM): os planos até a faixa final e as durações, NÃO lidos do módulo medido. Sem os treinadores
// (?tecnicos=0) sai o 'treinador'; no TM saem as estatísticas; o empate que continua no TM é o curto.
const FIM_PLANOS = {
  vitoria: [['apito', 1.5], ['vencedor', 3], ['perdedor', 2.5], ['cumprimentos', 2], ['troca', 1.5], ['treinador', 2], ['aplauso', 2.5], ['torcida', 2], ['melhor', 5], ['placar', 8], ['estatisticas', 6]],
  empate: [['apito', 1.5], ['neutro', 3], ['cumprimentos', 2], ['troca', 1.5], ['treinador', 2], ['aplauso', 2.5], ['torcida', 2], ['melhor', 5], ['placar', 8], ['estatisticas', 6]],
  curto: [['apito', 1.5], ['neutro', 3], ['torcida', 2], ['placar', 8]],
};
/** Os planos esperados (o = {troca: false, tecnicos: false, est: false}) e a duração até a faixa final (s). */
function fimEsperado(tipo, o = {}) {
  const P = FIM_PLANOS[tipo].filter(([n]) => !(n === 'troca' && o.troca === false) && !(n === 'treinador' && o.tecnicos === false) && !(n === 'estatisticas' && o.est === false));
  return { tipo, nomes: P.map(p => p[0]), dur: P.reduce((s, p) => s + p[1], 0) };
}
// quadros de folga na duração; folga das peças (px); o teto do celular Média (como C8); a troca de camisa (chamadas a mais);
// o close do melhor em campo (fração da altura da tela, mediana do plano)
const LIM_FIM = { quadros: 3, folga: 4, chamadas: 40, triangulos: 130000, triCorpoMedia: 60000, trocaChamadas: 1, closeMelhor: 0.3, trocaL: 20 };

/**
 * Ajudantes do pós-jogo na página (window.__cf; depois do `instalar`): a partida até perto do apito final pela API dos testes
 * (rodarPassos — nenhuma cena abre no caminho), os quadros até a cena (ou a faixa, sem ela) e a cena quadro a quadro até a
 * faixa final, medindo em window.__mf: o tick e o hash (parados?), os planos na ordem e quantos quadros cada um, as tarjas
 * (em que plano, o conteúdo, as caixas), a faixa antes da hora, os textos fora do placar/tarjas/faixa, os treinadores (as
 * cópias 210/211 da cena e o passo dos vivos), o apito, a troca de camisa, o close do melhor em campo e as chamadas de desenho
 * por plano.
 */
function instalarFim() {
  const g = window.__golaco, ct = window.__ct;
  const quadro = (des = false) => g.relogio.avancar(1000 / 60, { desenhar: des });
  const vis = e => ct.vis(e, false);
  const faixa = () => {
    const fx = document.getElementById('faixa');
    const b = id => { const e = document.getElementById(id); return e ? { texto: e.textContent.trim(), vis: vis(e), caixa: ct.caixa(e, false), cortado: e.scrollWidth > e.clientWidth + 1 } : null; };
    return { vis: vis(fx), titulo: document.getElementById('faixa-titulo')?.textContent.trim() ?? '', placar: document.getElementById('faixa-placar')?.textContent.trim() ?? '', caixa: ct.caixa(fx, false), botoes: [b('faixa-botao'), b('faixa-botao2')] };
  };
  const textosFora = () => {
    const out = [];
    for (const e of document.body.querySelectorAll('*')) {
      // (a dica de teclas do PC — #dica — some por uma animação CSS de 8 s reais que o relógio manual não anda: reposta a
      // cada reinício, ainda aparece na faixa final dos testes; não é narração)
      if (e.closest('.placar, .tarja-cena, .tarja-placar, .painel-est, #cena, .carregando, #faixa, #dica')) continue;
      let t = '';
      for (const n of e.childNodes) if (n.nodeType === 3) t += n.textContent;
      t = t.trim();
      if (t && ct.vis(e)) out.push(t.slice(0, 30));
    }
    return out;
  };
  // as outras peças do HUD visíveis (data-caixa), menos as tarjas da cena, a dica de teclas do PC e o que é da faixa
  const SEM = new Set(['tarja-placar', 'painel-est', 'tarja-melhor', 'tarja-cena', 'dica']);
  const outras = () => [...document.querySelectorAll('[data-caixa]')].filter(e => !SEM.has(e.dataset.caixa) && !e.closest('#faixa') && ct.vis(e)).map(e => ({ k: e.dataset.caixa, c: ct.caixa(e) }));
  /**
   * A faixa final (o painel e os botões visíveis) contra a tela, um botão contra o outro e contra as outras peças do HUD:
   * {n, ruins, botoes, painel (a menor folga do painel: {k, f})}. As animações e transições CSS vão antes ao estado final (o
   * relógio delas não anda com o relógio manual: um botão de toque ainda entrando contaria como escondido — rev. R24).
   */
  const faixaEnc = () => {
    for (const a of document.getAnimations()) { try { a.finish(); } catch (_) { /* infinita */ } }
    const W = innerWidth, H = innerHeight, bs = ['faixa-botao', 'faixa-botao2'].map(id => document.getElementById(id)).filter(e => e && vis(e));
    const out = { n: bs.length, ruins: [], botoes: bs.map(e => e.textContent.trim()), painel: { k: '-', f: 99 } };
    const os = outras(), fx = document.getElementById('faixa');
    if (fx && vis(fx)) {
      const c = ct.caixa(fx, false);
      if (!(c.x0 >= 0 && c.y0 >= 0 && c.x1 <= W && c.y1 <= H)) out.ruins.push('a faixa fora da tela');
      for (const o of os) { const f = ct.folga(c, o.c); if (f < out.painel.f) out.painel = { k: o.k, f }; if (f < 4) out.ruins.push(`a faixa × ${o.k} ${f.toFixed(0)} px`); }
    }
    // (revisão) os controles de toque não ficam com a faixa final (o arco encostava nos botões dela; a zona do analógico, por
    // baixo, ficava com o toque da metade esquerda deles)
    const tq = document.getElementById('toque');
    out.toque = !!tq && vis(tq);
    if (document.documentElement.classList.contains('com-toque') && out.toque) out.ruins.push('os controles de toque na tela com a faixa final');
    bs.forEach((e, i) => {
      const c = ct.caixa(e, false);
      // (o toque em 10%, 30%, 50%, 70% e 90% da largura de cada botão, na altura do meio, cai no próprio botão)
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const h = document.elementFromPoint(c.x0 + fx * (c.x1 - c.x0), (c.y0 + c.y1) / 2);
        if (!h || !(h === e || e.contains(h))) { out.ruins.push(`${e.id} a ${Math.round(fx * 100)}% da largura cai em ${h ? h.id || h.className || h.tagName : 'nada'}`); break; }
      }
      if (!(c.x0 >= 0 && c.y0 >= 0 && c.x1 <= W && c.y1 <= H)) out.ruins.push(`${e.id} fora da tela`);
      if (e.scrollWidth > e.clientWidth + 1) out.ruins.push(`${e.id} cortado`);
      for (const o of os) { const f = ct.folga(c, o.c); if (f < 4) out.ruins.push(`${e.id} × ${o.k} ${f.toFixed(0)} px`); }
      for (let j = i + 1; j < bs.length; j++) { const f = ct.folga(c, ct.caixa(bs[j], false)); if (f < 4) out.ruins.push(`${e.id} × ${bs[j].id} ${f.toFixed(0)} px`); }
    });
    return out;
  };
  const apitos = () => { const s = g.estadio?.sonsPedidos ?? {}; let n = 0; for (const k of Object.keys(s)) if (/apito/i.test(k)) n += s[k] ?? 0; return n; };
  // o hash do mundo com o tick no lugar de `t` (o online: no 'fim' só o tick anda — R5); devolve o tick de verdade
  const hashSemTick = t => { const m = g.mundo, k = m.tick; m.tick = t; try { return g.hash(); } finally { m.tick = k; } };
  window.__cf = {
    quadro, faixa, textosFora, apitos, hashSemTick, outras, faixaEnc,
    /** A partida de agora até `antes` passos do apito final (o placar escrito no MUNDO se vier: só testes). */
    levar(o = {}) {
      const m = g.mundo, p = m.partida;
      if (!p) return null;
      const antes = o.antes ?? 40;
      let n = 0;
      while (n < 400000 && p.estado !== 'fim' && !(p.tempo === 2 && p.acrescimo != null)) {
        const longe = p.tempo !== 2 || p.estado === 'intervalo' || p.tick0Tempo + p.ticksPorTempo - m.tick > 120;
        const k = longe ? 60 : 1;
        g.rodarPassos(k, 'demo'); n += k;
      }
      const fim = () => p.tick0Tempo + p.ticksPorTempo + Math.round(p.acrescimo * p.ticksPorTempo / 45);
      while (n < 400000 && p.estado !== 'fim' && m.tick < fim() - antes) { g.rodarPassos(1, 'demo'); n++; }
      if (Array.isArray(o.placar)) { m.placar[0] = o.placar[0]; m.placar[1] = o.placar[1]; }
      return { tick: m.tick, fim: p.estado === 'fim' ? m.tick : fim(), placar: [m.placar[0], m.placar[1]], estado: p.estado, passos: n };
    },
    /**
     * Quadros até a cena do pós-jogo começar ou, sem ela, até a faixa do fim (espera o replay do gol do último lance):
     * {cena, quadros, tickApito (o tick do 'fimDeJogo'), quadroApito, tickCena, histTick, faixa}.
     */
    ateCena(max = 3000) {
      const m = g.mundo, p = m.partida;
      let n = 0, tickApito = null, quadroApito = null;
      for (; n < max; n++) {
        quadro(false);
        if (tickApito == null && p.estado === 'fim') { tickApito = m.tick; quadroApito = n; }
        if (g.cenas?.ativo && g.cenas.tipo === 'fim') break;
        if (tickApito != null && n - quadroApito > 30 && !g.replay.estado?.ativo && faixa().vis) break;
      }
      const cena = !!(g.cenas?.ativo && g.cenas.tipo === 'fim');
      return { cena, quadros: n, tickApito, quadroApito, tickCena: cena ? m.tick : null, histTick: g.cenas?.historicoPosJogo?.at(-1)?.tick ?? null, faixa: faixa() };
    },
    /** Sem a cena (a base): `n` quadros depois do apito — o tick anda? a faixa aparece? */
    semCena(n = 180) {
      const m = g.mundo, t0 = m.tick, h0 = g.hash();
      let mudou = 0;
      for (let i = 0; i < n; i++) { quadro(false); if (m.tick !== t0) mudou++; }
      return { tick0: t0, tick: m.tick, tickMudou: mudou, hashIgual: g.hash() === h0, faixa: faixa() };
    },
    /** Começa a medida da cena que acabou de abrir (apito0: a contagem dos apitos de antes, para o R6). */
    iniciar(o = {}) {
      const m = g.mundo, e0 = g.cenas?.estado;
      window.__mf = {
        quadros: 0, tickMudou: 0, hashMudou: 0, tick0: m.tick, hash0: g.hash(), fases: [], saiu: false, faixaQuadros: 0,
        tarjas: { placar: { n: 0, fases: {}, ultimo: null }, estatisticas: { n: 0, fases: {}, ultimo: null }, melhor: { n: 0, fases: {}, ultimo: null } },
        juntas: 0, faixaAntes: 0, textos: new Set(), textosFaixa: new Set(),
        tec: { min210: 99, max210: 0, min211: 99, max211: 0, noPlano: 0, planoN: 0, k0: g.estadio?.tecnicos?.k ?? null, kMudou: 0 },
        apito0: o.apito0 ?? apitos(), apitoNoApito: null, troca: null, close: [], cx: { n: 0, ruins: 0, pior: null, ks: {}, min: { f: 99 } }, por: {},
        ini: e0 && e0.tipo === 'fim' ? { tick: e0.tick, resultado: e0.resultado, curto: e0.curto, segura: e0.segura, vencedor: e0.vencedor, planos: e0.planos.map(p => p.nome), duracao: e0.duracao, melhor: e0.melhor, troca: e0.troca, tempo: e0.tempo } : null,
      };
      return window.__mf.ini;
    },
    /**
     * Anda a cena medindo (o = {desenhar: N (um quadro desenhado a cada N), caixas, depois (quadros na faixa final), max,
     * ate: o plano em que para — com `ateQuadros` quadros dentro dele, para a captura de fora}). Devolve {parou, faixa, fase}.
     */
    andar(o = {}) {
      const M = window.__mf, m = g.mundo;
      if (!M?.ini) return { parou: false, semCena: true };
      let k = 0, dentro = 0;
      while (k < (o.max ?? 4000)) {
        const des = !!o.desenhar && M.quadros % o.desenhar === 0;
        quadro(des); M.quadros++; k++;
        if (m.tick !== M.tick0) M.tickMudou++;
        if (M.quadros % 20 === 0 && g.hash() !== M.hash0) M.hashMudou++;
        const tk = g.estadio?.tecnicos?.k;
        if (tk != null && tk !== M.tec.k0) M.tec.kMudou++;
        const e = g.cenas?.estado;
        if (!e || e.tipo !== 'fim') { M.saiu = true; break; }
        const f = e.faixaFinal ? 'faixa' : e.fase;
        const ult = M.fases[M.fases.length - 1];
        if (!ult || ult.f !== f) {
          if (ult?.f === 'apito') M.apitoNoApito = apitos() - M.apito0;
          M.fases.push({ f, n: 0 });
        }
        M.fases[M.fases.length - 1].n++;
        // as tarjas (o estado da página: rev. R24) — em que plano, o último conteúdo, nunca duas juntas, as caixas
        const T = g.cenas.tarjas;
        let juntas = 0;
        for (const kk of ['placar', 'estatisticas', 'melhor']) {
          const t = T?.[kk];
          if (!t?.visivel) continue;
          juntas++;
          const r = M.tarjas[kk]; r.n++; r.fases[f] = (r.fases[f] ?? 0) + 1; r.ultimo = t;
          const b = T.caixas?.[kk];
          if (o.caixas && b) {
            // (contra o placar, o "Pular", o botão da pausa e toda outra peça visível do HUD)
            const W = innerWidth, H = innerHeight;
            let pert = { k: '-', f: 99 };
            for (const x of outras()) { const fo = ct.folga(b, x.c); if (fo < pert.f) pert = { k: x.k, f: fo }; }
            const dentro = b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H;
            M.cx.n++; M.cx.ks[kk] = (M.cx.ks[kk] ?? 0) + 1;
            if (pert.f < M.cx.min.f) M.cx.min = { k: kk, perto: pert.k, f: pert.f };
            const ruim = !dentro || pert.f < 4;
            if (ruim) M.cx.ruins++;
            if (ruim && !M.cx.pior) M.cx.pior = { k: kk, fase: f, dentro, perto: pert.k, folga: pert.f };
          }
        }
        if (juntas > 1) M.juntas++;
        if (!e.faixaFinal && faixa().vis) M.faixaAntes++;
        if (M.quadros % 3 === 0) for (const t of textosFora()) (e.faixaFinal ? M.textosFaixa : M.textos).add(t);
        // as cópias dos treinadores na cena (a página desenha os atores ativos dela; os vivos ficam fora)
        let n0 = 0, n1 = 0;
        const at = g.cenas.atores() ?? [];
        for (const a of at) if (a.ativo !== false) { if (a.id === 210) n0++; else if (a.id === 211) n1++; }
        M.tec.min210 = Math.min(M.tec.min210, n0); M.tec.max210 = Math.max(M.tec.max210, n0);
        M.tec.min211 = Math.min(M.tec.min211, n1); M.tec.max211 = Math.max(M.tec.max211, n1);
        if (f === 'treinador') { M.tec.planoN++; if (n0 === 1 && n1 === 1) M.tec.noPlano++; }
        if (e.trocou && !M.troca) M.troca = { ...e.troca, fase: f, camisaDe: at.filter(a => a.camisaDe != null).map(a => ({ id: a.id, camisaDe: a.camisaDe, time: a.time, goleiro: !!a.goleiro })) };
        // o close do melhor em campo (a pose desenhada: só nos quadros desenhados)
        if (des && f === 'melhor' && e.melhor) {
          const nt = g.cenas.naTela(e.melhor.id);
          if (nt) M.close.push({ alt: nt.altura / innerHeight, dentro: nt.dentro });
        }
        if (des) {
          const s = g.estado(), p = (M.por[f] ??= { cham: 0, tri: 0, triCorpo: 0, n: 0 });
          p.n++; p.cham = Math.max(p.cham, s.desenhoChamadas); p.tri = Math.max(p.tri, s.desenhoTriangulos);
          const corpo = g.estadio.corpo;
          if (corpo?.pronto) p.triCorpo = Math.max(p.triCorpo, corpo.triangulos);
        }
        if (o.ate && f === o.ate && ++dentro >= (o.ateQuadros ?? 1)) return { parou: true, fase: f };
        if (e.faixaFinal && ++M.faixaQuadros > (o.depois ?? 60)) break;
      }
      return { parou: false, faixa: faixa(), fase: g.cenas?.estado?.fase ?? null };
    },
    /** A medida (os Set viram listas) com o fim: o tick, o hash, a faixa e o histórico da página. */
    medida() {
      const M = window.__mf, m = g.mundo;
      return { ...M, textos: [...M.textos], textosFaixa: [...M.textosFaixa], tickFim: m.tick, hashIgual: g.hash() === M.hash0, faixa: faixa(), faixaEnc: faixaEnc(), hist: g.cenas?.historicoPosJogo?.at(-1) ?? null, estado: g.cenas?.estado ?? null };
    },
  };
}

/**
 * O que a súmula diz (na página, com o mundo parado no apito): o melhor em campo (sumula.js melhorEmCampo e, à parte, o
 * argmax da nota — notaDe — com o desempate gols, assistências, menor id), a ficha dele, os gols (time, minuto, contra,
 * pênalti) e as estatísticas da partida.
 */
const doSumula = pg => pg.evaluate(async () => {
  const g = window.__golaco, m = g.mundo, S = g.cenas?.sumula?.() ?? null;
  if (!S) return null;
  const SU = await import('./js/sumula.js'), E = await import('./js/elenco.js');
  const exp = new Set((m.expulsos ?? []).map(j => j.id));
  const cand = [];
  for (const j of m.jogadores) if ((j.time === 0 || j.time === 1) && !exp.has(j.id)) cand.push([j.id, j.time]);
  for (const t of [0, 1]) for (const id of m.times?.[t]?.saiu ?? []) if (!exp.has(id) && !cand.some(c => c[0] === id)) cand.push([id, t]);
  let arg = null;
  for (const [id, time] of cand) {
    const nota = SU.notaDe(S, m, id, time), n = S.jog[id] ?? {}, x = { id, time, nota, gols: n.gols ?? 0, assist: n.assist ?? 0 };
    if (!arg || x.nota > arg.nota || (x.nota === arg.nota && (x.gols > arg.gols || (x.gols === arg.gols && (x.assist > arg.assist || (x.assist === arg.assist && x.id < arg.id)))))) arg = x;
  }
  const mc = SU.melhorEmCampo(S, m);
  const ficha = id => { const f = E.fichaDe(id), el = E.ELENCOS[E.elencoDoJogador(id)]; return f ? { num: String(f.num ?? ''), nome: f.nome ?? '', camisa: f.camisa ?? f.nome ?? '', sigla: el?.sigla ?? '' } : null; };
  return { mc, arg, ficha: mc ? ficha(mc.id) : null, gols: S.gols.map(x => ({ time: x.time, minuto: x.minuto, contra: !!x.contra, penalti: !!x.penalti, id: x.id })), est: SU.estatisticas(S, null), placar: [m.placar[0], m.placar[1]] };
});

/**
 * A troca de camisa na captura: o peito de cada um do par (a mediana do L* de 9 pontos na altura do peito, do lado de FORA
 * do abraço — a caixa da pose inclui o braço nas costas do outro) — {la, lb} (o do time 0 e o do time 1) e o RGB do meio.
 */
async function peitosTroca(pg, na, nb) {
  const pts = (nt, outro) => {
    const w = nt.x1 - nt.x0, h = nt.y1 - nt.y0, fora = (nt.x0 + nt.x1) / 2 >= (outro.x0 + outro.x1) / 2;
    const out = [];
    for (const fx of [0.55, 0.65, 0.75]) for (const fy of [0.18, 0.22, 0.26]) out.push([fora ? nt.x0 + fx * w : nt.x1 - fx * w, nt.y0 + fy * h]);
    return out;
  };
  const pa = pts(na, nb), pb = pts(nb, na);
  const cs = await pixels(pg, [...pa, ...pb]);
  const med = v => [...v].sort((x, y) => x - y)[v.length >> 1];
  const la = med(cs.slice(0, 9).map(c => lab(c)[0])), lb = med(cs.slice(9).map(c => lab(c)[0]));
  return { la, lb, rgbA: cs[4].map(Math.round), rgbB: cs[13].map(Math.round) };
}

/** F1 de uma cena andada até a faixa final: começou no apito, o resultado, os planos na ordem e a duração. */
function conferirF1(rot, A, M, esp, resEsp) {
  const nomes = M?.fases?.map(x => x.f) ?? [];
  const antesFaixa = M?.fases ? M.fases.filter(x => x.f !== 'faixa').reduce((s, x) => s + x.n, 0) : 0;
  const durOk = Math.abs(antesFaixa / 60 - esp.dur) <= LIM_FIM.quadros / 60 + 1e-9;
  const ok = A.cena && A.histTick === A.tickApito && A.tickCena === A.tickApito && M.ini?.resultado === resEsp && nomes.join() === [...esp.nomes, 'faixa'].join() && durOk;
  meta(`F1 ${rot}: a cena começa no apito final (o tick do 'fimDeJogo'), o resultado, os planos na ordem e a duração até a faixa final`,
    A.cena ? `apito no tick ${A.tickApito}, cena no ${A.tickCena} (histórico ${A.histTick}); ${M.ini?.resultado}${M.ini?.curto ? ' (curto)' : ''}; ${nomes.join(' → ')}; ${f2(antesFaixa / 60)} s` : `nenhuma cena (apito no tick ${A.tickApito}; faixa ${A.faixa?.vis ? `"${A.faixa.titulo}"` : 'não'})`,
    `${resEsp}; ${esp.nomes.join(' → ')} → faixa; ${f2(esp.dur)} s ± ${LIM_FIM.quadros} quadros`, ok);
}
/** F2 fora do online: o tick e o hash parados do apito até a faixa final (e nela). */
function conferirF2(rot, A, M, S0) {
  if (A.cena) {
    meta(`F2 ${rot}: fora do online o mundo.tick e o hashMundo não mudam do apito até a faixa final (e ${M.faixaQuadros} quadros nela)`,
      `tick ${M.tick0}: mudou em ${M.tickMudou} de ${M.quadros} quadros; hash ${M.hashIgual ? 'igual' : 'DIFERENTE'} (mudou em ${M.hashMudou} amostras); segura ${M.ini?.segura}`,
      '0; igual; segura', M.quadros > 0 && M.tickMudou === 0 && M.hashMudou === 0 && M.hashIgual && M.ini?.segura === true && M.faixaQuadros > 0);
  } else {
    meta(`F2 ${rot}: fora do online o mundo.tick e o hashMundo não mudam do apito até a faixa final`,
      S0 ? `sem cena: o tick andou ${S0.tick0} → ${S0.tick} (mudou em ${S0.tickMudou} de 180 quadros); hash ${S0.hashIgual ? 'igual' : 'DIFERENTE'}` : 'sem cena', '0; igual', !!S0 && S0.tickMudou === 0 && S0.hashIgual);
  }
}

/**
 * A cena aberta andada até a faixa final (o = as opções do andar: desenhar, caixas, depois), parando no meio do plano da
 * troca para a captura do peito do par (o = {troca: true}; o quadro desenhado). Devolve {M (a medida), px (a troca)}.
 */
async function andarCena(pg, o = {}, nomeCap = null) {
  await pg.evaluate(() => window.__cf.iniciar());
  let px = null;
  if (o.troca) {
    const r = await pg.evaluate(o => window.__cf.andar({ ...o, ate: 'troca', ateQuadros: 45 }), o);
    if (r.parou) {
      const q = await pg.evaluate(() => {
        const g = window.__golaco;
        g.relogio.avancar(1000 / 60, { desenhar: true });
        window.__mf.quadros++;
        const e = g.cenas.estado, t = e?.troca;
        if (!t) return null;
        // (as cores escritas no manequim: o par e um companheiro de linha de cada um com o uniforme de sempre)
        const ats = g.cenas.atores() ?? [], cor = id => g.estadio.coresJogador?.(id) ?? null;
        const mate = time => ats.find(a => a.time === time && !a.goleiro && a.ativo !== false && a.id !== t.a && a.id !== t.b && a.camisaDe == null && cor(a.id));
        const m0 = mate(0), m1 = mate(1);
        const cores = { a: cor(t.a), b: cor(t.b), m0: m0 ? cor(m0.id) : null, m1: m1 ? cor(m1.id) : null };
        return { a: t.a, b: t.b, na: g.cenas.naTela(t.a), nb: g.cenas.naTela(t.b), kitA: t.kitA, kitB: t.kitB, cores };
      });
      if (q?.na && q?.nb) {
        px = { ...q, ...(await peitosTroca(pg, q.na, q.nb)) };
        if (nomeCap) await capturar(pg, nomeCap + '-troca');
      } else px = q;
    }
  }
  await pg.evaluate(o => window.__cf.andar(o), { desenhar: o.desenhar, caixas: o.caixas, depois: o.depois ?? 60 });
  const M = await pg.evaluate(() => window.__cf.medida());
  if (nomeCap) await capturar(pg, nomeCap + '-faixa');
  return { M, px };
}
let golRoteirizado = null;
/**
 * Uma partida da página até a cena do pós-jogo (o = {semente, gol: o roteirizado do time 0 antes — o lance guardado dos
 * melhores momentos —, placar: [casa, fora] | 'vitoria' (a casa um gol à frente) escrito no mundo}) e, com a cena, ela
 * andada (andarCena; sem ela, 180 quadros: o tick anda?). Devolve {A (ateCena), M, px, X (semCena), lances, gol}.
 */
async function posJogo(pg, o = {}, nomeCap = null) {
  golRoteirizado ??= (await import(pathToFileURL(path.join(AQUI, 'lib/gol-roteirizado.mjs')).href)).golRoteirizado;
  if (o.reiniciar !== false) await pg.evaluate(s => window.__golaco.reiniciar({ modo: 'partida', semente: s, minutosPorTempo: 1 }), o.semente ?? 7);
  let gol = null, lances = 0;
  if (o.gol) {
    gol = await golRoteirizado(pg, { reiniciar: false, time: 0, marcarChute: true });
    lances = await pg.evaluate(() => { const g = window.__golaco, cf = window.__cf; let n = 0; while ((g.cenas?.lances?.length ?? 0) < 1 && n < 1200) { cf.quadro(false); n++; } return g.cenas?.lances?.length ?? 0; });
  }
  const A = await pg.evaluate(placar => {
    const cf = window.__cf, m = window.__golaco.mundo;
    const lev = cf.levar({ antes: 40 });
    if (placar === 'vitoria') { m.placar[0] = Math.max(m.placar[0], m.placar[1] + 1); lev.placar = [m.placar[0], m.placar[1]]; }
    else if (Array.isArray(placar)) { m.placar[0] = placar[0]; m.placar[1] = placar[1]; lev.placar = [...placar]; }
    return { ...cf.ateCena(), lev };
  }, o.placar ?? null);
  let M = null, px = null, X = null;
  if (A.cena) ({ M, px } = await andarCena(pg, o, nomeCap));
  else X = await pg.evaluate(() => window.__cf.semCena(180));
  return { A, M, px, X, lances, gol };
}
/** A troca de camisa de uma cena medida (o par, os kits mistos e, com a captura, o peito pela camisa trocada). */
function conferirTroca(rot, M, px, opcTroca = {}) {
  const t = M?.troca, cd = t?.camisaDe ?? [];
  const ida = cd.find(x => x.id === t?.a), idb = cd.find(x => x.id === t?.b);
  const okPar = !!t && !!ida && !!idb && ida.camisaDe === t.b && idb.camisaDe === t.a && !ida.goleiro && !idb.goleiro && t.a !== M.ini.melhor?.id && t.b !== M.ini.melhor?.id && /^troca:/.test(t.kitA ?? '') && /^troca:/.test(t.kitB ?? '');
  const okPx = !!px && Number.isFinite(px.la) && Number.isFinite(px.lb) && px.la - px.lb >= LIM_FIM.trocaL;
  meta(`F5b a troca de camisa (${rot}): o par de linha (não o melhor em campo) com a camisa do outro — o kit misto — e o peito na captura pela camisa trocada (L* do time 0 − L* do time 1)`,
    t ? `${t.a} (time 0) ↔ ${t.b} (time 1) no plano ${t.fase}; kits ${t.kitA} / ${t.kitB}; L* do peito ${px ? `${f2(px.la)} [${px.rgbA}] × ${f2(px.lb)} [${px.rgbB}]` : 'não medido'}` : 'sem troca',
    `a camisa do outro; ≥ ${LIM_FIM.trocaL}`, okPar && okPx);
  // (revisão) as cores do manequim do kit misto: o tronco = o do companheiro do OUTRO time; o calção, a listra da coxa, o meião
  // e a faixa do meião = os do companheiro do PRÓPRIO time (antes a listra e a faixa vinham com o acento da camisa)
  if (opcTroca.cores) {
    const C = px?.cores, ig = (u, v) => !!u && !!v && u.every((x, i) => Math.abs(x - v[i]) < 1e-4);
    const um = (eu, meu, outro) => !!eu && !!meu && !!outro && ig(eu.tronco, outro.tronco) && ['calcao', 'listra', 'meiao', 'faixa'].every(k => ig(eu[k], meu[k]));
    const hex = v => (v ? '#' + v.map(x => Math.round(Math.min(1, Math.max(0, x)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('') : '-');
    meta(`F5b a troca de camisa (${rot}): as cores do kit misto no manequim — a camisa do outro time, o calção e o meião (com a listra e a faixa) do próprio`,
      C ? `time 0 (${t?.a}): tronco ${hex(C.a?.tronco)} (o do outro ${hex(C.m1?.tronco)}), listra ${hex(C.a?.listra)} e faixa ${hex(C.a?.faixa)} (as do time ${hex(C.m0?.listra)}/${hex(C.m0?.faixa)}); time 1 (${t?.b}): tronco ${hex(C.b?.tronco)} (${hex(C.m0?.tronco)}), listra ${hex(C.b?.listra)} e faixa ${hex(C.b?.faixa)} (${hex(C.m1?.listra)}/${hex(C.m1?.faixa)})` : 'não medido',
      'iguais', !!C && um(C.a, C.m0, C.m1) && um(C.b, C.m1, C.m0));
  }
}
/** As chamadas e os triângulos do pior plano de uma cena medida (M.por). */
function piorPlano(M) {
  let cham = 0, tri = 0, triCorpo = 0, fc = '-', ft = '-';
  for (const [f, p] of Object.entries(M?.por ?? {})) {
    if (p.cham > cham) { cham = p.cham; fc = f; }
    if (p.tri > tri) { tri = p.tri; ft = f; }
    triCorpo = Math.max(triCorpo, p.triCorpo);
  }
  return { cham, tri, triCorpo, fc, ft };
}
/** As chamadas com a troca × sem ela (?troca=0), plano a plano (os planos dos dois). */
function conferirCustoTroca(rot, M1, M0) {
  const comuns = Object.keys(M1?.por ?? {}).filter(f => M0?.por?.[f]);
  const difs = comuns.map(f => [f, M1.por[f].cham - M0.por[f].cham]);
  const pior = difs.reduce((x, d) => (d[1] > x[1] ? d : x), ['-', -Infinity]);
  meta(`F8 ${rot}: a troca de camisa não custa chamada de desenho (com × ?troca=0, plano a plano; teto +${LIM_FIM.trocaChamadas})`,
    comuns.length ? `${difs.map(([f, d]) => `${f} ${M1.por[f].cham}/${M0.por[f].cham}`).join(', ')}; a mais no pior: ${pior[1]} (${pior[0]})` : 'sem medida',
    `≤ +${LIM_FIM.trocaChamadas}`, comuns.length >= 5 && pior[1] <= LIM_FIM.trocaChamadas);
}

marcar('F');
if (roda('F')) try {
  golRoteirizado ??= (await import(pathToFileURL(path.join(AQUI, 'lib/gol-roteirizado.mjs')).href)).golRoteirizado;
  const P = await pagina('F', '?q=baixa&hora=dia&semente=5&demo=1&cenas=1&prejogo=0&comemoracao=0&replay=0&replayParada=0&substituicao=0');
  try {
    const pg = P.pagina;
    await pg.evaluate(instalarFim);
    // ---- 1) a partida de verdade: um gol do time 0 (o guardador o guarda na saída: os melhores momentos) e o resto pela demo
    await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 5, minutosPorTempo: 1 }));
    const gol = await golRoteirizado(pg, { reiniciar: false, time: 0, marcarChute: true });
    const A1 = await pg.evaluate(() => {
      const g = window.__golaco, cf = window.__cf;
      let n = 0;
      while ((g.cenas?.lances?.length ?? 0) < 1 && n < 1200) { cf.quadro(false); n++; }
      const lances = g.cenas?.lances?.length ?? 0;
      const lev = cf.levar({ antes: 40 });
      return { ...cf.ateCena(), lances, lev };
    });
    let M1 = null, S1 = null, px = null, X1 = null;
    // (até o meio do plano da troca, o quadro desenhado: o peito de cada um do par na captura — a camisa do outro)
    if (A1.cena) { ({ M: M1, px } = await andarCena(pg, { desenhar: 10, depois: 120, troca: true }, 'pc')); S1 = await doSumula(pg); }
    else X1 = await pg.evaluate(() => window.__cf.semCena(180));
    const pl1 = A1.lev?.placar ?? [0, 0];
    const res1 = pl1[0] === pl1[1] ? 'empate' : 'vitoria';
    const esp1 = fimEsperado(res1);
    conferirF1(`PC, a partida de verdade (gol roteirizado ${gol?.ok ? 'sim' : 'NÃO'}; ${pl1.join('–')})`, A1, M1 ?? {}, esp1, res1);
    conferirF2('PC', A1, M1 ?? {}, X1);
    // F3: a tarja do placar = o placar e os autores da súmula (cada gol com o minuto do lado certo); o painel = as estatísticas
    {
      const tp = M1?.tarjas.placar, te = M1?.tarjas.estatisticas;
      const golsTxt = tp?.ultimo?.gols ?? '';
      const nums = golsTxt.match(/\d+/g)?.map(Number) ?? [];
      const aut = tp?.ultimo?.autores ?? [[], []];
      const golsOk = !!S1 && S1.gols.every(x => (aut[x.time] ?? []).some(t => t.includes(`${x.minuto}'`))) && [0, 1].every(t => (aut[t] ?? []).join(' ').split("'").length - 1 === S1.gols.filter(x => x.time === t).length);
      meta('F3 a tarja do placar final: o placar do mundo e os autores da súmula (cada gol com o minuto, do lado do time), só no plano do placar',
        tp?.n ? `${tp.n} quadros em ${JSON.stringify(tp.fases)}; "${golsTxt}" · ${JSON.stringify(aut)} × súmula ${S1?.gols.map(x => `${x.time}:${x.minuto}'${x.contra ? '(c)' : ''}`).join(', ') || 'sem gols'}, placar ${S1?.placar.join('–')}` : 'não apareceu',
        `${f2(8)} s no plano placar; iguais`, !!tp?.n && Object.keys(tp.fases).join() === 'placar' && Math.abs(tp.n / 60 - 8) <= 0.1 && nums.join() === (S1?.placar ?? []).join() && golsOk && (S1?.gols.length ?? 0) > 0);
      const linhas = te?.ultimo?.linhas ?? [];
      const num = t => +(String(t).match(/\d+/)?.[0] ?? NaN);
      const est = S1?.est;
      const estErr = est ? ['posse', 'chutes', 'noAlvo', 'escanteios', 'faltas'].filter(k => { const l = linhas.find(x => x.item === k); return !l || num(l.a) !== est[k][0] || num(l.b) !== est[k][1]; }) : ['sem súmula'];
      meta('F3 o painel de estatísticas da PARTIDA = a súmula (posse, finalizações, no alvo, escanteios, faltas), só no plano das estatísticas',
        te?.n ? `${te.n} quadros em ${JSON.stringify(te.fases)}; "${te.ultimo?.titulo}": ${linhas.map(l => `${l.item} ${l.a}–${l.b}`).join(', ')}; diferentes: ${estErr.join(', ') || 'nenhum'}` : 'não apareceu',
        '"Partida"; 6 s; iguais', !!te?.n && Object.keys(te.fases).join() === 'estatisticas' && Math.abs(te.n / 60 - 6) <= 0.1 && te.ultimo?.titulo === 'Partida' && estErr.length === 0);
    }
    // F4: a tarja do melhor em campo = sumula.melhorEmCampo (e o argmax da nota calculado aqui), a ficha dele e a nota com uma
    // casa; o close dele no plano
    {
      const tm = M1?.tarjas.melhor, u = tm?.ultimo, mc = S1?.mc, fi = S1?.ficha;
      const notaTxt = mc ? mc.nota.toFixed(1).replace('.', ',') : '-';
      const okTarja = !!u && !!fi && u.num === fi.num && (u.nome === fi.nome || u.nome === fi.camisa) && u.sigla === fi.sigla && u.nota === notaTxt && /melhor em campo/i.test(u.rotulo);
      const closeMed = M1?.close?.length ? [...M1.close].map(c => c.alt).sort((a, b) => a - b)[M1.close.length >> 1] : 0;
      meta('F4 a tarja do melhor em campo = sumula.melhorEmCampo (= o argmax da nota, desempate gols/assistências/id), com a ficha e a nota com uma casa, só no plano dele; o close dele',
        tm?.n ? `${tm.n} quadros em ${JSON.stringify(tm.fases)}; "${u?.sigla} ${u?.num} ${u?.nome} · ${u?.rotulo} · ${u?.nota}" × melhorEmCampo ${mc ? `${mc.id} (${notaTxt})` : '-'} = argmax ${S1?.arg?.id ?? '-'} = plano ${M1?.ini?.melhor?.id ?? '-'}; ficha ${fi ? `${fi.sigla} ${fi.num} ${fi.nome}` : '-'}; close (mediana) ${f2(closeMed)} da altura em ${M1?.close?.length ?? 0} quadros` : 'não apareceu',
        `5 s no plano melhor; iguais; close ≥ ${LIM_FIM.closeMelhor}`, !!tm?.n && Object.keys(tm.fases).join() === 'melhor' && Math.abs(tm.n / 60 - 5) <= 0.1 && !!mc && mc.id === S1.arg.id && mc.id === M1.ini.melhor?.id && okTarja && closeMed >= LIM_FIM.closeMelhor);
    }
    // tela: nenhuma tarja fora do plano dela nem duas juntas, a faixa só no fim, nenhum outro texto (sem narração)
    meta('F3/F4 tela: as tarjas nunca juntas, a faixa do fim só depois dos planos, nenhum texto fora do placar, das tarjas e da faixa',
      M1 ? `juntas ${M1.juntas} quadros; faixa antes ${M1.faixaAntes}; textos na cena ${M1.textos.length ? JSON.stringify(M1.textos) : 'nenhum'}; na faixa ${M1.textosFaixa.length ? JSON.stringify(M1.textosFaixa) : 'nenhum'}` : 'nenhuma cena',
      '0; 0; nenhum', !!M1 && M1.juntas === 0 && M1.faixaAntes === 0 && M1.textos.length === 0 && M1.textosFaixa.length === 0);
    // F10: os treinadores — só as cópias da cena (um 210 e um 211 entre os atores ativos o tempo todo, apertando a mão no plano
    // deles) e os vivos parados (o passo deles não anda: o laço segurado)
    meta('F10 os treinadores: só as cópias da cena (no máximo um 210 e um 211; os dois no plano "treinador") e os vivos parados',
      M1 ? `210: ${M1.tec.min210}–${M1.tec.max210}, 211: ${M1.tec.min211}–${M1.tec.max211} por quadro; no plano treinador os dois em ${M1.tec.noPlano}/${M1.tec.planoN}; o passo dos vivos mudou em ${M1.tec.kMudou} quadros` : 'nenhuma cena',
      '≤ 1 e ≤ 1; todos; 0', !!M1 && M1.tec.max210 <= 1 && M1.tec.max211 <= 1 && M1.tec.planoN > 0 && M1.tec.noPlano === M1.tec.planoN && M1.tec.kMudou === 0);
    // a troca de camisa: o par (nunca goleiro, nunca o melhor em campo), cada um com a camisa do outro (o kit misto
    // 'troca:<camisa>:<resto>:<num>') e, no quadro desenhado, o peito do do time 0 claro (a camisa branca do visitante) e o do
    // time 1 escuro (a preta do mandante)
    conferirTroca('PC, manequim', M1, px, { cores: true });
    // F5: a faixa final com os dois botões; "Melhores momentos" toca o guardador (o mundo parado) e volta à faixa; um aperto
    // pula o lance e volta à faixa; "Jogar de novo" zera a cena
    {
      const fx = M1?.faixa, b = fx?.botoes ?? [];
      let mm = null, mm2 = null, nova = null;
      if (M1 && b[1]?.vis) {
        await pg.click('#faixa-botao2', { timeout: 10000 });
        mm = await pg.evaluate(() => {
          const g = window.__golaco, cf = window.__cf, m = g.mundo, t0 = m.tick, h0 = g.hash();
          let n = 0, tocando = 0, faixaJunto = 0, tickMudou = 0, tipos = new Set();
          while (n < 60 * 45) {
            cf.quadro(n % 30 === 0); n++;
            if (m.tick !== t0) tickMudou++;
            const r = g.replay.estado;
            if (r?.ativo) { tocando++; tipos.add(r.tipo); if (cf.faixa().vis) faixaJunto++; }
            const e = g.cenas.estado;
            if (n > 10 && !e?.mm && !r?.ativo) break;
          }
          for (let i = 0; i < 10; i++) cf.quadro(false);
          return { n, tocando, faixaJunto, tickMudou, hashIgual: g.hash() === h0, tipos: [...tipos], hist: g.cenas.historicoPosJogo.at(-1)?.mm ?? null, faixa: cf.faixa(), ativa: g.cenas.ativo };
        });
        // de novo, e uma tecla pula o lance (volta à faixa; o aperto não vira jogada: o mundo parado)
        await pg.click('#faixa-botao2', { timeout: 10000 });
        await pg.evaluate(() => { for (let i = 0; i < 40; i++) window.__cf.quadro(false); });
        const antes = await pg.evaluate(() => ({ tocando: !!window.__golaco.replay.estado?.ativo }));
        await pg.keyboard.down('KeyK');
        await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__cf.quadro(false); });
        await pg.keyboard.up('KeyK');
        mm2 = await pg.evaluate(() => {
          const g = window.__golaco, cf = window.__cf;
          let q = 0; while (q < 8 && g.replay.estado?.ativo) { cf.quadro(false); q++; }
          for (let i = 0; i < 6; i++) cf.quadro(false);
          return { q, ativo: !!g.replay.estado?.ativo, hist: g.cenas.historicoPosJogo.at(-1)?.mm ?? null, faixa: cf.faixa(), tick: g.mundo.tick, mmEstado: g.cenas.estado?.mm ?? null };
        });
        mm2.antes = antes;
        // "Jogar de novo": a cena sai, o mundo é novo, nenhuma tarja nem faixa
        await pg.click('#faixa-botao', { timeout: 10000 });
        nova = await pg.evaluate(() => {
          const g = window.__golaco, cf = window.__cf;
          for (let i = 0; i < 10; i++) cf.quadro(false);
          const T = g.cenas.tarjas;
          return { ativa: g.cenas.ativo, tick: g.mundo.tick, estado: g.mundo.partida?.estado, faixa: cf.faixa().vis, tarjas: ['placar', 'estatisticas', 'melhor'].filter(k => T?.[k]?.visivel) };
        });
      }
      meta('F5 a faixa final: "Fim de jogo", o placar e os dois botões ("Jogar de novo" e "Melhores momentos", com lance guardado)',
        fx ? `"${fx.titulo}" "${fx.placar}"; ${b.map(x => (x ? `"${x.texto}" ${x.vis ? 'visível' : 'escondido'}` : '-')).join(', ')}; ${A1.lances} lance(s) guardado(s)` : 'nenhuma faixa',
        'Fim de jogo; os dois visíveis', !!M1 && fx?.vis && /fim de jogo/i.test(fx.titulo) && /jogar de novo/i.test(b[0]?.texto ?? '') && b[0]?.vis && /melhores momentos/i.test(b[1]?.texto ?? '') && b[1]?.vis && A1.lances >= 1);
      meta('F5 "Melhores momentos": os lances do guardador tocam (a faixa escondida, o mundo parado) e a faixa volta com os botões',
        mm ? `${mm.tocando} quadros de replay (${mm.tipos.join(', ')}), a faixa junto em ${mm.faixaJunto}; vistos ${mm.hist?.vistos ?? '-'} de ${mm.hist?.lances?.length ?? '-'}, fim ${mm.hist?.fim}; tick ${mm.tickMudou ? 'ANDOU' : 'parado'}, hash ${mm.hashIgual ? 'igual' : 'DIFERENTE'}; depois a faixa ${mm.faixa.vis ? 'visível' : 'escondida'} com ${mm.faixa.botoes.filter(x => x?.vis).length} botões` : 'não tocou',
        '> 1 s de lance; 0; vistos todos; parado; a faixa de volta', !!mm && mm.tocando > 60 && mm.faixaJunto === 0 && mm.hist?.fim && !mm.hist.pulou && mm.hist.vistos === mm.hist.lances.length && mm.tickMudou === 0 && mm.hashIgual && mm.faixa.vis && mm.faixa.botoes.every(x => x?.vis) && mm.ativa);
      meta('F5 um aperto novo pula o lance dos melhores momentos e volta à faixa',
        mm2 ? `tocando antes do aperto: ${mm2.antes.tocando}; acabou em ${mm2.q} quadros (${mm2.ativo ? 'AINDA tocando' : 'parou'}); pulou ${mm2.hist?.pulou}; faixa ${mm2.faixa.vis ? 'visível' : 'escondida'}` : 'não tocou',
        'acaba em ≤ 4 quadros; pulou; a faixa', !!mm2 && mm2.antes.tocando && !mm2.ativo && mm2.q <= 4 && mm2.hist?.pulou === true && mm2.faixa.vis && !mm2.mmEstado);
      meta('F5 "Jogar de novo" zera a cena (o mundo novo, nenhuma tarja, nenhuma faixa)',
        nova ? `cena ${nova.ativa ? 'ATIVA' : 'fora'}; tick ${nova.tick} (${nova.estado}); faixa ${nova.faixa ? 'VISÍVEL' : 'escondida'}; tarjas ${nova.tarjas.join(', ') || 'nenhuma'}` : 'não clicou',
        'fora; tick pequeno; nenhuma', !!nova && !nova.ativa && nova.tick < 200 && !nova.faixa && nova.tarjas.length === 0);
    }

    // ---- 2) e 3) derrota (0–1) e empate (1–1), o placar escrito no mundo: os planos de cada desfecho e o tick parado
    for (const [rot, placar, tipo, res] of [['derrota 0–1', [0, 1], 'vitoria', 'vitoria'], ['empate 1–1', [1, 1], 'empate', 'empate']]) {
      const A = await pg.evaluate(placar => {
        const g = window.__golaco, cf = window.__cf;
        g.reiniciar({ modo: 'partida', semente: 7, minutosPorTempo: 1 });
        const lev = cf.levar({ antes: 40, placar });
        return { ...cf.ateCena(), lev };
      }, placar);
      let M = null, X = null;
      if (A.cena) { await pg.evaluate(() => window.__cf.iniciar()); await pg.evaluate(() => window.__cf.andar({ depois: 30 })); M = await pg.evaluate(() => window.__cf.medida()); } else X = await pg.evaluate(() => window.__cf.semCena(180));
      conferirF1(`PC, ${rot}${tipo === 'vitoria' ? ' (o visitante vence)' : ''}`, A, M ?? {}, fimEsperado(tipo), res);
      if (tipo === 'vitoria') meta(`F1 PC, ${rot}: quem venceu é o visitante (vencedor 1) e o melhor em campo existe`, M ? `vencedor ${M.ini?.vencedor}; melhor ${M.ini?.melhor?.id ?? '-'}` : 'nenhuma cena', '1; existe', M?.ini?.vencedor === 1 && M.ini.melhor != null);
      conferirF2(`PC, ${rot}`, A, M ?? {}, X);
    }

    // ---- 4) F6: Enter = o próximo bloco (os planos de campo → o melhor → o placar → as estatísticas → a faixa final); antes de
    // 0,5 s não pula
    {
      const A = await pg.evaluate(() => {
        const g = window.__golaco, cf = window.__cf;
        g.reiniciar({ modo: 'partida', semente: 7, minutosPorTempo: 1 });
        cf.levar({ antes: 40, placar: [2, 1] });
        const a = cf.ateCena();
        for (let i = 0; i < 12; i++) cf.quadro(false);
        return a;
      });
      const passos = [];
      let cedo = null, pausa = null;
      if (A.cena) {
        await pg.keyboard.press('Enter');
        cedo = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) window.__cf.quadro(false); return { fase: g.cenas.estado?.fase, t: g.cenas.estado?.tempo }; });
        // Esc = a pausa (como no intervalo): a cena congela (o relógio dela e o mundo) e volta de onde parou
        await pg.evaluate(() => { for (let i = 0; i < 30; i++) window.__cf.quadro(false); });
        const p0 = await pg.evaluate(() => ({ t: window.__golaco.cenas.estado?.tempo, tick: window.__golaco.mundo.tick }));
        await pg.keyboard.press('Escape');
        pausa = await pg.evaluate(p0 => {
          const g = window.__golaco;
          for (let i = 0; i < 30; i++) window.__cf.quadro(false);
          return { ...p0, depois: g.cenas.estado?.tempo, tickIgual: g.mundo.tick === p0.tick, fase: g.cenas.estado?.fase, faixa: !!g.cenas.estado?.faixaFinal };
        }, p0);
        await pg.keyboard.press('Escape');
        pausa.volta = await pg.evaluate(t => { for (let i = 0; i < 30; i++) window.__cf.quadro(false); return window.__golaco.cenas.estado?.tempo - t; }, pausa.depois ?? 0);
        await pg.evaluate(() => { const g = window.__golaco; while (g.cenas.estado && g.cenas.estado.tempo < 0.7) window.__cf.quadro(false); });
        for (let i = 0; i < 4; i++) {
          // (a fase de ANTES do aperto: o Enter vira a ação na hora, no evento da tecla — o quadro só desenha)
          const t0 = await pg.evaluate(() => ({ tick: window.__golaco.mundo.tick, fase: window.__golaco.cenas.estado?.fase }));
          await pg.keyboard.press('Enter');
          passos.push(await pg.evaluate(t0 => {
            const g = window.__golaco, cf = window.__cf, mudou = () => g.cenas.estado?.fase !== t0.fase || g.cenas.estado?.faixaFinal;
            let q = 0;
            if (!mudou()) while (q < 4) { cf.quadro(false); q++; if (mudou()) break; }
            for (let k = 0; k < 20; k++) cf.quadro(false);
            const e = g.cenas.estado;
            return { q, fase: e?.faixaFinal ? 'faixa' : e?.fase ?? 'fim', tick: g.mundo.tick === t0.tick };
          }, t0));
        }
      }
      const seq = passos.map(p => p.fase);
      meta('F6 PC: Enter antes de 0,5 s não pula; depois, cada Enter = o próximo bloco (melhor → placar → estatísticas → faixa final) em ≤ 2 quadros, o mundo parado',
        A.cena ? `cedo (${f2(cedo?.t)} s): ${cedo?.fase}; ${passos.map(p => `${p.fase} (${p.q} q)`).join(' → ')}; tick ${passos.every(p => p.tick) ? 'parado' : 'ANDOU'}` : 'nenhuma cena',
        'apito; melhor → placar → estatisticas → faixa', A.cena && cedo?.fase === 'apito' && seq.join() === 'melhor,placar,estatisticas,faixa' && passos.every(p => p.q <= 2 && p.tick));
      meta('F6 PC: Esc = a pausa — a cena congela (o relógio dela e o mundo; nem vai à faixa) e volta de onde parou com Esc',
        pausa ? `tempo ${f2(pausa.t)} → ${f2(pausa.depois)} s em 30 quadros pausados (${pausa.fase}${pausa.faixa ? ', FAIXA' : ''}); tick ${pausa.tickIgual ? 'parado' : 'ANDOU'}; depois de Esc andou ${f2(pausa.volta)} s em 30 quadros` : 'nenhuma cena',
        'parados; anda ~0,5 s', !!pausa && Math.abs(pausa.depois - pausa.t) < 1e-6 && pausa.tickIgual && !pausa.faixa && pausa.volta > 0.4);
    }
    // (revisão) um botão de jogo SEGURADO (K por 6 quadros, depois de 0,5 s) = um bloco só, como o Enter: antes o aperto que
    // disparava nunca ficava marcado como visto e avançava um bloco por QUADRO (do apito à faixa final)
    {
      const A = await pg.evaluate(() => {
        const g = window.__golaco, cf = window.__cf;
        g.reiniciar({ modo: 'partida', semente: 7, minutosPorTempo: 1 });
        cf.levar({ antes: 40, placar: [2, 1] });
        const a = cf.ateCena();
        let n = 0;
        while (a.cena && g.cenas.estado && g.cenas.estado.tempo < 0.7 && n < 200) { cf.quadro(false); n++; }
        return { cena: a.cena, fase: g.cenas.estado?.fase ?? null };
      });
      let seg = null;
      if (A.cena) {
        await pg.keyboard.down('KeyK');
        await pg.evaluate(() => { for (let i = 0; i < 6; i++) window.__cf.quadro(false); });
        await pg.keyboard.up('KeyK');
        seg = await pg.evaluate(() => { for (let i = 0; i < 2; i++) window.__cf.quadro(false); const e = window.__golaco.cenas.estado; return { fase: e?.faixaFinal ? 'faixa' : e?.fase ?? 'fim' }; });
      }
      meta('F6 PC (revisão): um botão de jogo segurado (K, 6 quadros) = um bloco só (apito → melhor), como o Enter',
        seg ? `${A.fase} → ${seg.fase}` : 'nenhuma cena', 'apito → melhor', !!seg && A.fase === 'apito' && seg.fase === 'melhor');
    }

    // ---- 5) o gol no último lance (o replay dele ligado): o gol → o replay do gol → a cena (no tick do apito, que o replay
    // não andou) e o apito final pedido até o fim do plano do apito (R6: não depois da cena)
    {
      const G = await pg.evaluate(async () => {
        const g = window.__golaco, cf = window.__cf;
        g.replay.automatico(true);
        g.reiniciar({ modo: 'partida', semente: 5, minutosPorTempo: 1 });
        const { criarBola } = await import('./js/bola.js');
        const { CAMPO } = await import('./js/config.js');
        g.rodarPassos(600, 'demo');
        let w = 0; while (w < 3000 && g.mundo.partida.estado !== 'jogo') { g.rodarPassos(1, 'demo'); w++; }
        const m = g.mundo, p = m.partida, adv = 1, lado = m.ataca[adv];
        // o 2º tempo nos acréscimos, acabando 60 passos depois daqui: o gol sai antes e o fim chega no passo da saída
        p.tempo = 2; p.acrescimo = 1;
        p.tick0Tempo = m.tick - (p.ticksPorTempo + Math.round(p.ticksPorTempo / 45)) + 60;
        const autor = m.jogadores.find(j => j.time === adv && j.posicao !== 'GOL'), gk = m.jogadores.find(j => j.time === 0 && j.posicao === 'GOL');
        m.posse = null; m.naMao = null; m.voo = null; m.parada = null; p.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
        Object.assign(m.bola, criarBola(lado * (CAMPO.meioX - 0.5), gk && gk.z > 0 ? -2.7 : 2.7));
        m.bola.p.y = 0.4; m.bola.v.x = lado * 16; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = false;
        m.ultimoToque = { id: autor.id, time: adv, tick: m.tick };
        const fase = () => (g.cenas?.ativo && g.cenas.tipo === 'fim' ? 'cena' : g.replay.estado?.ativo ? 'replay:' + g.replay.estado.tipo : p.estado);
        const seq = [];
        let n = 0, tickApito = null, cena = null, depoisFaixa = 0, apReplay = null;
        while (n < 6000) {
          cf.quadro(false); n++;
          if (tickApito == null && p.estado === 'fim') tickApito = m.tick;
          const s = fase();
          if (seq[seq.length - 1]?.s !== s) seq.push({ s, tick: m.tick, apitos: cf.apitos() });
          // (os apitos pedidos até o último quadro do replay do gol: o adiado não toca durante ele)
          if (s === 'replay:gol') apReplay = cf.apitos();
          if (s === 'cena') { cena = { tick: m.tick, hist: g.cenas.historicoPosJogo.at(-1)?.tick ?? null }; break; }
          if (tickApito != null && seq.some(x => x.s === 'replay:gol') && !g.replay.estado?.ativo && cf.faixa().vis && ++depoisFaixa > 30) break;
        }
        let ate = null;
        if (cena) {
          cf.iniciar({ apito0: apReplay ?? cf.apitos() });
          cf.andar({ ate: 'vencedor' });
          ate = { apitoNoApito: window.__mf.apitoNoApito, fases: window.__mf.fases.map(x => x.f), tickMudou: window.__mf.tickMudou };
        }
        g.replay.automatico(false);
        return { seq, tickApito, cena, ate, apReplay, placar: [m.placar[0], m.placar[1]] };
      });
      const ord = G.seq.map(x => `${x.s}@${x.tick}`).join(' → ');
      const iR = G.seq.findIndex(x => x.s === 'replay:gol'), iC = G.seq.findIndex(x => x.s === 'cena');
      meta('F1 o gol no último lance: o gol → o replay do gol → a cena, no tick do apito (o replay não andou o mundo)',
        `${ord}; apito no tick ${G.tickApito}; ${G.cena ? `cena no ${G.cena.tick} (histórico ${G.cena.hist})` : 'nenhuma cena'}; placar ${G.placar.join('–')}`,
        'gol → replay:gol → cena; o mesmo tick', iR >= 0 && iC > iR && G.cena?.tick === G.tickApito && G.cena?.hist === G.tickApito);
      meta('F10 (rev. R6) com o gol no último lance, o apito final é pedido no plano do apito (depois do replay do gol, não depois da cena)',
        G.ate ? `durante o replay: ${(G.apReplay ?? 0) - (G.seq[iR]?.apitos ?? 0)}; do fim do replay até o fim do plano do apito: ${G.ate.apitoNoApito}; fases ${G.ate.fases.join(' → ')}` : 'nenhuma cena',
        '0; ≥ 1', !!G.ate && G.ate.apitoNoApito >= 1 && G.apReplay != null && G.apReplay - (G.seq[iR]?.apitos ?? 0) === 0);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('F execução (pós-jogo no PC: F1–F6, F10)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ FC (pós-jogo no celular)
/** F8: as tarjas (contra o placar, o "Pular", a pausa e toda peça visível) e a faixa final (os dois botões) no celular. */
function conferirTelaCel(rot, R, opc = {}) {
  const M = R.M, cx = M?.cx, fe = M?.faixaEnc;
  const ks = Object.keys(cx?.ks ?? {}).sort().join();
  const esp = opc.est === false ? 'melhor,placar' : 'estatisticas,melhor,placar';
  meta(`F8 ${rot}: as tarjas (placar final, estatísticas, melhor em campo) dentro da tela e a ≥ ${LIM_FIM.folga} px do placar, do "Pular", da pausa e de toda peça do HUD`,
    M ? `${cx.n} medidas (${JSON.stringify(cx.ks)}); ${cx.ruins} ruins${cx.pior ? ` (${cx.pior.k} no ${cx.pior.fase}: dentro ${cx.pior.dentro}, ${cx.pior.perto} a ${f2(cx.pior.folga)} px)` : ''}; a menor folga ${cx.min.k} × ${cx.min.perto} ${f2(cx.min.f)} px` : 'nenhuma cena',
    `as 3 medidas; 0`, !!M && ks === esp && cx.ruins === 0);
  meta(`F8 ${rot}: a faixa final — o painel e os ${opc.botoes ?? 2} botões dentro da tela, sem cortar o texto, sem encostar um no outro nem em peça do HUD (≥ ${LIM_FIM.folga} px)`,
    fe ? `${fe.n} botões (${fe.botoes.join(' / ')}); o painel a ${f2(fe.painel.f)} px de ${fe.painel.k}; ${fe.ruins.length ? fe.ruins.join('; ') : 'nada encosta'}` : 'nenhuma faixa',
    `${opc.botoes ?? 2}; nada`, !!fe && fe.n === (opc.botoes ?? 2) && fe.ruins.length === 0);
}
/** F6 no celular: o toque na tela = o próximo bloco (antes de 0,5 s não); o "Pular" = a faixa final. */
async function toqueCel(pg) {
  const A = await pg.evaluate(() => {
    const g = window.__golaco, cf = window.__cf;
    g.reiniciar({ modo: 'partida', semente: 7, minutosPorTempo: 1 });
    cf.levar({ antes: 40, placar: [2, 1] });
    const a = cf.ateCena();
    for (let i = 0; i < 12; i++) cf.quadro(false);
    return a;
  });
  if (!A.cena) return { cena: false };
  const vp = pg.viewportSize();
  await pg.touchscreen.tap(vp.width / 2, vp.height / 2);
  const cedo = await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__cf.quadro(false); return { fase: window.__golaco.cenas.estado?.fase, t: window.__golaco.cenas.estado?.tempo }; });
  await pg.evaluate(() => { const g = window.__golaco; while (g.cenas.estado && g.cenas.estado.tempo < 0.7) window.__cf.quadro(false); });
  const f0 = await pg.evaluate(() => window.__golaco.cenas.estado?.fase);
  await pg.touchscreen.tap(vp.width / 2, vp.height / 2);
  const toque = await pg.evaluate(f0 => {
    const g = window.__golaco, cf = window.__cf, mudou = () => g.cenas.estado?.fase !== f0;
    let q = 0;
    if (!mudou()) while (q < 4) { cf.quadro(false); q++; if (mudou()) break; }
    return { q, fase: g.cenas.estado?.fase, tick: g.mundo.tick };
  }, f0);
  const pul = await pg.evaluate(() => window.__golaco.cenas.tarjas?.caixas?.pular ?? null);
  let pulo = null;
  if (pul) {
    await pg.touchscreen.tap((pul.x0 + pul.x1) / 2, (pul.y0 + pul.y1) / 2);
    pulo = await pg.evaluate(t0 => {
      const g = window.__golaco, cf = window.__cf;
      let q = 0;
      if (!g.cenas.estado?.faixaFinal) while (q < 4) { cf.quadro(false); q++; if (g.cenas.estado?.faixaFinal) break; }
      return { q, faixa: !!g.cenas.estado?.faixaFinal, pulou: g.cenas.historicoPosJogo.at(-1)?.pulou ?? null, tick: g.mundo.tick === t0, vis: cf.faixa().vis };
    }, toque.tick);
  }
  return { cena: true, cedo, f0, toque, pul, pulo };
}
marcar('FC');
if (roda('FC')) try {
  const url = t => `?q=media&hora=dia&semente=5&demo=1&cenas=1&prejogo=0&comemoracao=0&replay=0&replayParada=0&substituicao=0${t ? '' : '&troca=0'}`;
  const cel = { largura: 844, altura: 390, dpr: 2, toque: true };
  let r1 = null, r0 = null, rl = null, tq = null, volta = null;
  const C1 = await pagina('FC', url(true), cel);
  try {
    const pg = C1.pagina;
    await pg.evaluate(instalarFim);
    // a vitória com o gol roteirizado (o lance guardado: os dois botões da faixa), desenhada a cada 6 quadros
    r1 = await posJogo(pg, { semente: 5, gol: true, placar: 'vitoria', desenhar: 8, caixas: true, depois: 30 }, 'cel');
    tq = await toqueCel(pg);
    // 568×320 (a mesma página, a janela menor): só as caixas
    await pg.setViewportSize({ width: 568, height: 320 });
    for (let i = 0; i < 3; i++) await pg.evaluate(() => window.__cf.quadro(true));
    rl = await posJogo(pg, { semente: 5, gol: true, placar: 'vitoria', caixas: true, depois: 30 }, 'cel568');
    // (revisão) "Jogar de novo" pelo toque no botão da faixa: a partida nova e os controles de toque de volta
    const bj = await pg.evaluate(() => { const e = document.getElementById('faixa-botao'); const r = e && window.__ct.vis(e, false) ? e.getBoundingClientRect() : null; return r ? { x: r.left + r.width * 0.2, y: r.top + r.height / 2 } : null; });
    if (bj) {
      await pg.touchscreen.tap(bj.x, bj.y);
      volta = await pg.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__cf.quadro(true);
        const g = window.__golaco, t = document.getElementById('toque'), b = document.getElementById('btn-correr');
        return { fimFaixa: document.documentElement.classList.contains('fim-faixa'), toque: window.__ct.vis(t, false), correr: !!b && window.__ct.vis(b, false), cena: !!g.cenas?.ativo, tick: g.mundo.tick, faixa: window.__cf.faixa().vis };
      });
    }
  } finally { await C1.fechar(); }
  const C0 = await pagina('FC0', url(false), cel);
  try { await C0.pagina.evaluate(instalarFim); r0 = await posJogo(C0.pagina, { semente: 5, gol: true, placar: 'vitoria', desenhar: 8, depois: 10 }); } finally { await C0.fechar(); }
  conferirF1('celular 844×390 Média, vitória', r1.A, r1.M ?? {}, fimEsperado('vitoria'), 'vitoria');
  conferirTelaCel('celular 844×390', r1);
  conferirTelaCel('celular 568×320', rl);
  meta('F8 celular (revisão): "Jogar de novo" pelo toque (a 20% da largura do botão) — a partida nova e os controles de toque de volta (o CORRER na tela)',
    volta ? `cena ${volta.cena ? 'ATIVA' : 'fora'}; tick ${volta.tick}; faixa ${volta.faixa ? 'VISÍVEL' : 'fora'}; html.fim-faixa ${volta.fimFaixa}; toque ${volta.toque ? 'na tela' : 'FORA'}, CORRER ${volta.correr ? 'na tela' : 'FORA'}` : 'sem o botão',
    'fora; tick pequeno; fora; false; na tela', !!volta && !volta.cena && volta.tick < 200 && !volta.faixa && !volta.fimFaixa && volta.toque && volta.correr);
  const pp = piorPlano(r1.M);
  meta(`F8 celular 844×390 Média (manequim): ≤ ${LIM_FIM.chamadas} chamadas de desenho e ≤ ${LIM_FIM.triangulos / 1000} mil triângulos no pior plano`,
    r1.M ? `${pp.cham} chamadas (${pp.fc}), ${(pp.tri / 1000).toFixed(0)} mil triângulos (${pp.ft}); ${Object.entries(r1.M.por).map(([f, p]) => `${f} ${p.cham}`).join(', ')}` : 'nenhuma cena',
    `≤ ${LIM_FIM.chamadas}; ≤ ${LIM_FIM.triangulos / 1000} mil`, !!r1.M && pp.cham > 0 && pp.cham <= LIM_FIM.chamadas && pp.tri <= LIM_FIM.triangulos);
  conferirCustoTroca('celular, manequim', r1.M, r0?.M);
  meta('F6 celular: o toque na tela antes de 0,5 s não pula; depois = o próximo bloco (≤ 2 quadros); o "Pular" (≥ 48 px) = a faixa final (≤ 2 quadros), o mundo parado',
    tq?.cena ? `cedo (${f2(tq.cedo.t)} s): ${tq.cedo.fase}; toque: ${tq.f0} → ${tq.toque.fase} (${tq.toque.q} q); Pular ${tq.pul ? `${f2(tq.pul.y1 - tq.pul.y0)} px` : 'sem caixa'} → ${tq.pulo ? `${tq.pulo.faixa ? 'faixa' : 'NÃO'} (${tq.pulo.q} q), pulou ${tq.pulo.pulou}, tick ${tq.pulo.tick ? 'parado' : 'ANDOU'}` : '-'}` : 'nenhuma cena',
    'apito; melhor; faixa', !!tq?.cena && tq.cedo.fase === 'apito' && tq.toque.fase === 'melhor' && tq.toque.q <= 2 && !!tq.pul && tq.pul.y1 - tq.pul.y0 >= 48 && tq.pulo?.faixa && tq.pulo.q <= 2 && tq.pulo.pulou === true && tq.pulo.tick && tq.pulo.vis);
} catch (e) { meta('FC execução (pós-jogo no celular: F1, F6, F8)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ FU (celular, ?corpo=humano)
marcar('FU');
if (roda('FU')) try {
  const url = t => `?q=media&hora=dia&semente=7&demo=1&cenas=1&prejogo=0&comemoracao=0&replay=0&replayParada=0&substituicao=0&corpo=humano${t ? '' : '&troca=0'}`;
  const cel = { largura: 844, altura: 390, dpr: 2, toque: true, corpo: true };
  let u1 = null, u0 = null, corpo = null;
  const U1 = await pagina('FU', url(true), cel);
  try {
    await U1.pagina.evaluate(instalarFim);
    corpo = await U1.pagina.evaluate(() => window.__golaco.estadio.corpo);
    u1 = await posJogo(U1.pagina, { semente: 7, placar: [2, 1], desenhar: 8, depois: 10, troca: true }, 'humano');
  } finally { await U1.fechar(); }
  const U0 = await pagina('FU0', url(false), cel);
  try { await U0.pagina.evaluate(instalarFim); u0 = await posJogo(U0.pagina, { semente: 7, placar: [2, 1], desenhar: 8, depois: 10 }); } finally { await U0.fechar(); }
  conferirF1('celular, ?corpo=humano, 2–1', u1.A, u1.M ?? {}, fimEsperado('vitoria'), 'vitoria');
  const pp = piorPlano(u1.M);
  meta(`F9 ?corpo=humano no celular 844×390 Média: o corpo novo pronto, ≤ ${LIM_FIM.chamadas} chamadas, ≤ ${LIM_FIM.triangulos / 1000} mil triângulos no pior plano e os jogadores ≤ ${LIM_FIM.triCorpoMedia / 1000} mil`,
    u1.M ? `corpo ${corpo?.pronto ? 'pronto' : corpo?.erro ? `erro ${corpo.erro}` : 'não'}; ${pp.cham} chamadas (${pp.fc}), ${(pp.tri / 1000).toFixed(0)} mil (${pp.ft}), jogadores ${(pp.triCorpo / 1000).toFixed(0)} mil` : 'nenhuma cena',
    `pronto; ≤ ${LIM_FIM.chamadas}; ≤ ${LIM_FIM.triangulos / 1000} mil; ≤ ${LIM_FIM.triCorpoMedia / 1000} mil`, !!u1.M && !!corpo?.pronto && pp.cham > 0 && pp.cham <= LIM_FIM.chamadas && pp.tri <= LIM_FIM.triangulos && pp.triCorpo > 0 && pp.triCorpo <= LIM_FIM.triCorpoMedia);
  conferirTroca('celular, corpo novo', u1.M, u1.px);
  conferirCustoTroca('celular, corpo novo', u1.M, u0?.M);
} catch (e) { meta('FU execução (pós-jogo com o corpo novo: F9)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ FT (pós-jogo no Total Match)
/** Abre o "TM" (o pedido no localStorage e o jogo num iframe) e devolve {s, fr} com os ajudantes instalados no quadro. */
async function abrirTM(pedido, q, tela = { largura: 1280, altura: 720 }) {
  const s = await abrir(tela);
  const url = `${srv.url}__quadro-tm-${pedido.id}.html`;
  await s.contexto.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlQuadro(pedido, q) }));
  await s.pagina.goto(url, { waitUntil: 'load' });
  let fr = null;
  for (let i = 0; i < 400 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
  if (!fr) throw new Error('o quadro do jogo não abriu');
  await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 600000 });
  await fr.evaluate(instalar);
  await fr.evaluate(instalarFim);
  await fr.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { s, fr };
}
/** No TM: a partida até a cena com o placar e o resultado gravado no localStorage no 1º quadro da cena. */
const ateCenaTM = (fr, id, placar) => fr.evaluate(({ id, placar }) => {
  const cf = window.__cf;
  const lev = cf.levar({ antes: 40, placar });
  const a = cf.ateCena();
  const r = localStorage.getItem('tm3d:resultado:' + id);
  return { ...a, lev, res: r ? JSON.parse(r) : null };
}, { id, placar });
marcar('FT');
if (roda('FT')) try {
  const Q = 'q=baixa&min=1&cenas=1&prejogo=0&comemoracao=0&replay=0&replayParada=0&substituicao=0';
  const PED_E = { ...PED_A, id: 'tE', partida: { ...PED_A.partida, empateContinua: false } };
  // FT1: a vitória (2–1) no PC — o resultado gravado antes da cena, sem as estatísticas, o "tm3d:fim" só no clique
  {
    const { s, fr } = await abrirTM(PED_A, Q);
    try {
      const A = await ateCenaTM(fr, PED_A.id, [2, 1]);
      let R = null, msgs0 = null, msgs1 = null;
      if (A.cena) {
        R = await andarCena(fr, { depois: 30 });
        msgs0 = await s.pagina.evaluate(() => window.__msgs.map(m => m?.tipo));
        await fr.click('#faixa-botao', { timeout: 10000 });
        await s.pagina.waitForTimeout(1500);
        msgs1 = await s.pagina.evaluate(() => window.__msgs.filter(m => m?.tipo === 'tm3d:fim').map(m => ({ casa: m.resultado?.homeGoals, fora: m.resultado?.awayGoals, melhor: m.resultado?.melhor ?? null })));
      }
      errosTodos.push(...s.erros.map(e => `FT1: ${e}`));
      const M = R?.M, res = A.res, rm = res?.melhor, tm = M?.tarjas?.melhor?.ultimo;
      meta('F7 TM: o resultado já está no localStorage no 1º quadro da cena (o placar e o "melhor" opcional = o melhor em campo da cena)',
        A.cena ? `resultado ${res ? `${res.homeGoals}–${res.awayGoals}, melhor ${rm ? `lado ${rm.lado} ${rm.nome} ${rm.nota}` : 'sem'}` : 'NÃO gravado'}; o melhor da cena ${M?.ini?.melhor ? `${M.ini.melhor.time}/${M.ini.melhor.id} ${M.ini.melhor.nota}` : '-'}; a tarja ${tm ? `"${tm.nome} ${tm.nota}"` : '-'}` : 'nenhuma cena',
        '2–1; o mesmo melhor e a mesma nota', A.cena && res?.homeGoals === 2 && res?.awayGoals === 1 && !!rm && rm.lado === M?.ini?.melhor?.time && rm.nota === M.ini.melhor.nota && tm?.nota === rm.nota.toFixed(1).replace('.', ','));
      conferirF1('TM, vitória 2–1 (sem as estatísticas)', A, M ?? {}, fimEsperado('vitoria', { est: false }), 'vitoria');
      meta('F7 TM: nenhum painel de estatísticas; a faixa final com "Voltar ao Total Match" (sem "Melhores momentos": nenhum lance guardado); o "tm3d:fim" só no clique, com o "melhor"',
        M ? `painel ${M.tarjas.estatisticas.n} quadros; faixa ${M.faixa.botoes.map(x => (x ? `"${x.texto}" ${x.vis ? 'visível' : 'escondido'}` : '-')).join(', ')}; mensagens antes do clique ${JSON.stringify(msgs0)}; depois ${JSON.stringify(msgs1)}` : 'nenhuma cena',
        '0; Voltar; nenhuma; 1 com o melhor', !!M && M.tarjas.estatisticas.n === 0 && /voltar ao total match/i.test(M.faixa.botoes[0]?.texto ?? '') && M.faixa.botoes[0]?.vis && !M.faixa.botoes[1]?.vis && !(msgs0 ?? []).includes('tm3d:fim') && msgs1?.length === 1 && msgs1[0].casa === 2 && msgs1[0].fora === 1 && msgs1[0].melhor?.nota === rm?.nota);
    } finally { await s.navegador.close(); }
  }
  // FT2: o empate (1–1) sem o campo empateContinua = a versão curta
  {
    const { s, fr } = await abrirTM(PED_A, Q);
    try {
      const A = await ateCenaTM(fr, PED_A.id, [1, 1]);
      const R = A.cena ? await andarCena(fr, { depois: 10 }) : null;
      errosTodos.push(...s.erros.map(e => `FT2: ${e}`));
      conferirF1('TM, empate 1–1 sem "empateContinua" (a versão curta)', A, R?.M ?? {}, fimEsperado('curto'), 'empate');
      meta('F7 TM, a versão curta: curto, sem o melhor em campo (nem a tarja)', R?.M ? `curto ${R.M.ini.curto}; melhor ${R.M.ini.melhor?.id ?? 'nenhum'}; a tarja ${R.M.tarjas.melhor.n} quadros` : 'nenhuma cena',
        'curto; nenhum; 0', !!R?.M && R.M.ini.curto === true && R.M.ini.melhor == null && R.M.tarjas.melhor.n === 0);
    } finally { await s.navegador.close(); }
  }
  // FT3: o empate com empateContinua false = a versão inteira (sem as estatísticas); no celular, o "Pular" leva à faixa com o
  // "Voltar ao Total Match" num toque
  {
    const { s, fr } = await abrirTM(PED_E, Q, { largura: 844, altura: 390, dpr: 1, toque: true });
    try {
      const A = await ateCenaTM(fr, PED_E.id, [1, 1]);
      let e0 = null, pulo = null;
      if (A.cena) {
        e0 = await fr.evaluate(() => { const g = window.__golaco, cf = window.__cf; for (let i = 0; i < 45; i++) cf.quadro(false); const e = g.cenas.estado; return { curto: e.curto, planos: e.planos.map(p => p.nome), resultado: e.resultado }; });
        const pul = await fr.evaluate(() => window.__golaco.cenas.tarjas?.caixas?.pular ?? null);
        if (pul) {
          // (o quadro do jogo ocupa a página inteira: as coordenadas do quadro = as da página)
          await s.pagina.touchscreen.tap((pul.x0 + pul.x1) / 2, (pul.y0 + pul.y1) / 2);
          pulo = await fr.evaluate(() => {
            const g = window.__golaco, cf = window.__cf;
            let q = 0;
            if (!g.cenas.estado?.faixaFinal) while (q < 4) { cf.quadro(false); q++; if (g.cenas.estado?.faixaFinal) break; }
            return { q, faixa: cf.faixa() };
          });
        }
      }
      errosTodos.push(...s.erros.map(e => `FT3: ${e}`));
      const esp = fimEsperado('empate', { est: false });
      meta('F7 TM, empate com "empateContinua: false": a versão inteira do empate (sem as estatísticas); no celular o "Pular" = a faixa com "Voltar ao Total Match" (o 2º toque)',
        A.cena ? `curto ${e0?.curto}; ${e0?.planos.join(' → ')}; Pular → ${pulo ? `${pulo.faixa.vis ? `faixa "${pulo.faixa.botoes[0]?.texto}" ${pulo.faixa.botoes[0]?.vis ? 'visível' : 'escondido'}` : 'SEM faixa'} em ${pulo.q} quadros` : '-'}` : 'nenhuma cena',
        `${esp.nomes.join(' → ')} → geral; a faixa em ≤ 2 quadros`, A.cena && e0?.curto === false && e0.planos.join() === [...esp.nomes, 'geral'].join() && pulo?.faixa.vis && pulo.q <= 2 && /voltar ao total match/i.test(pulo.faixa.botoes[0]?.texto ?? '') && pulo.faixa.botoes[0]?.vis);
    } finally { await s.navegador.close(); }
  }
} catch (e) { meta('FT execução (pós-jogo no Total Match: F7)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ FO (pós-jogo no online)
marcar('FO');
if (roda('FO')) try {
  const s = await abrir({ largura: 844, altura: 390, dpr: 1, toque: true });
  try {
    const sala = 'posjogo' + Date.now();
    const q = lado => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=7&min=0.12&q=baixa&replay=0&comemoracao=0&prejogo=0&D=4&cenas=1`;
    const A = s.pagina, B = await s.contexto.newPage();
    B.on('pageerror', e => errosTodos.push(`FO B: ${e.message}`));
    B.on('console', m => { if (m.type() === 'error') errosTodos.push(`FO B: ${m.text()}`); });
    await Promise.all([A.goto(q(0), { waitUntil: 'load' }), B.goto(q(1), { waitUntil: 'load' })]);
    await Promise.all([A, B].map(p => p.waitForFunction(() => window.__golaco && window.__golaco.pronto && window.__golaco.online && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 600000 })));
    const fim = p => p.waitForFunction(() => window.__golaco.online?.estado === 'fim', null, { timeout: 900000, polling: 250 }).then(() => true, () => false);
    const [fa, fb] = await Promise.all([fim(A), fim(B)]);
    // (o hash com o tick no lugar de 0: no 'fim' só o tick anda — R5)
    const amostra = p => p.evaluate(() => {
      const g = window.__golaco, o = g.online, m = g.mundo, e = g.cenas?.estado ?? null;
      const k = m.tick; m.tick = 0; const hst = g.hash(); m.tick = k;
      return { tick: k, n: o.n, hst, dessinc: !!o.dessinc, hashes: o.hashes, cena: g.cenas?.ativo ? g.cenas.tipo : null, fase: e?.fase ?? null, segura: e?.segura ?? null, planos: e?.planos?.length ?? 0 };
    });
    await A.waitForTimeout(1500);
    const a1 = await amostra(A), b1 = await amostra(B);
    await A.waitForTimeout(6000);
    const a2 = await amostra(A), b2 = await amostra(B);
    errosTodos.push(...s.erros.map(e => `FO A: ${e}`));
    const mx = new Map(a2.hashes), comuns = b2.hashes.filter(([n]) => mx.has(n)), difs = comuns.filter(([n, h]) => mx.get(n) !== h).length;
    meta('F1 online (duas abas pelo BroadcastChannel): a cena do pós-jogo roda nas duas, sem segurar o laço',
      `fim ${fa}/${fb}; A: ${a1.cena ?? 'sem cena'} (${a1.fase ?? '-'} → ${a2.fase ?? '-'}, segura ${a1.segura}); B: ${b1.cena ?? 'sem cena'} (${b1.fase ?? '-'} → ${b2.fase ?? '-'}, segura ${b1.segura})`,
      "'fim' nas duas; segura false", fa && fb && a1.cena === 'fim' && b1.cena === 'fim' && a1.segura === false && b1.segura === false);
    meta('F2 online: no fim só o tick anda — o hash com o tick tirado igual nas duas abas e no tempo, nenhuma dessincronia',
      `A tick ${a1.tick} → ${a2.tick}, B ${b1.tick} → ${b2.tick}; hash sem o tick A ${a1.hst === a2.hst ? 'igual' : 'MUDOU'}, B ${b1.hst === b2.hst ? 'igual' : 'MUDOU'}, A = B ${a2.hst === b2.hst ? 'sim' : 'NÃO'}; hashes ${difs} diferentes de ${comuns.length} em comum; dessinc ${a2.dessinc || b2.dessinc}`,
      'anda; iguais; 0', fa && fb && a2.tick > a1.tick && b2.tick > b1.tick && a1.hst === a2.hst && b1.hst === b2.hst && a2.hst === b2.hst && comuns.length >= 5 && difs === 0 && !a2.dessinc && !b2.dessinc);
  } finally { await s.navegador.close(); }
} catch (e) { meta('FO execução (pós-jogo no online: F1, F2)', erroCurto(e), 'sem exceção', false); }

marcar('fim');
await srv.fechar();
meta('console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const seg = (Date.now() - t0) / 1000;
console.log(`tempos: ${marcas.slice(0, -1).map(([n, t], k) => [n, (marcas[k + 1][1] - t) / 1000]).filter(([, x]) => x >= 0.5).map(([n, x]) => `${n} ${x.toFixed(0)} s`).join(', ')}\n`);
console.log(tabelaTexto([['', 'Item', 'Medido', 'Alvo'], ...res.map(r => [r.info ? 'INFO' : r.ok ? 'PASSOU' : 'REPROVOU', r.nome, r.medido, r.alvo])]));
const falhas = res.filter(r => !r.ok && !r.info).length;
console.log(`\nteste-cenas-tela: ${falhas ? `REPROVOU (${falhas})` : 'PASSOU'} em ${seg.toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
