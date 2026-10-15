// GOLAÇO — identidade visual de cada time na partida (PURO: sem three.js nem DOM; roda nos testes em Node).
//
// Pedido do dono (15/10): "na partida, quero que a logo dos times, torcida, e estádio estejam adaptáveis a cada time".
// Sem ?tm vale IDENTIDADE_PADRAO = EXATAMENTE as constantes de hoje (Golaço FC × Ventania FC): nada muda na tela (os
// desenhos só usam a identidade quando `tm` é verdadeiro; tools/teste-identidade.mjs confere que o padrão é igual às
// constantes de cada módulo). Com o pedido do Total Match (ponte-tm.js, contrato CONTRATO-TM §1/§4),
// identidadeDoPedido(pedido) monta:
//   - cores, sigla, nome e escudo (url; sem escudo, um escudo com a sigla nas cores do time: svgEscudoSigla);
//   - uniformes resolvidos sem confusão pela diferença de cor CIEDE2000 (ΔE₀₀, Sharma, Wu e Dalal 2005): o visitante
//     escolhe casa/fora/terceiro, os goleiros ficam longe dos uniformes de linha e o árbitro longe de todos;
//   - paletas da torcida (≥ 10 cores com neutros), cachecóis, mosaico das cadeiras, faixas com os nomes dos times
//     (textos FICTÍCIOS de torcida; as posições 9 e 11 ficam com o visitante), bandeiras e bandeirões;
//   - placas de publicidade ('TOTAL MATCH' + mandante + escudo + neutra), cadeiras/friso/mosaico pelo mandante,
//     bandeira de escanteio, fachada/cobertura/túnel do estádio de fora e o nome do estádio (jogo neutro → genérico);
//   - cores do HUD com contraste (placar, faixa ENTRA/SAI, minimapa longe do branco da bola e do outro time).
// Tudo é DESENHO (render/DOM): nada daqui entra na simulação nem no hash.

// ------------------------------------------------------------------ cor (sRGB ↔ CIELAB, ΔE₀₀, contraste WCAG)

/** '#rgb' | '#rrggbb' (com ou sem '#') → '#rrggbb' minúsculo, ou null se não for uma cor. */
export function corValida(c) {
  if (typeof c !== 'string') return null;
  let s = c.trim().toLowerCase();
  if (s[0] === '#') s = s.slice(1);
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map(x => x + x).join('');
  return /^[0-9a-f]{6}$/.test(s) ? '#' + s : null;
}
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const paraHex = ([r, g, b]) => '#' + hex2(r) + hex2(g) + hex2(b);
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const gama = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const D65 = [0.95047, 1, 1.08883];
const E3 = Math.pow(6 / 29, 3), K3 = 3 * Math.pow(6 / 29, 2);
const f = t => (t > E3 ? Math.cbrt(t) : t / K3 + 4 / 29);
const finv = t => (t > 6 / 29 ? t * t * t : K3 * (t - 4 / 29));

/** CIELAB (D65) de uma cor '#rrggbb'. */
export function lab(h) {
  const [r, g, b] = rgb(h).map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65[0];
  const Y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / D65[1];
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / D65[2];
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** '#rrggbb' de um CIELAB (D65), cortado para dentro do sRGB. */
export function deLab([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = D65[0] * finv(fx), Y = D65[1] * finv(fy), Z = D65[2] * finv(fz);
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bb = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return paraHex([r, g, bb].map(v => gama(Math.max(0, Math.min(1, v)))));
}

/** ΔE₀₀ (CIEDE2000) entre dois CIELAB. */
export function deltaE2000(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const rad = Math.PI / 180, P7 = Math.pow(25, 7);
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + P7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const ang = (b, a) => { if (b === 0 && a === 0) return 0; const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1 = ang(b1, a1p), h2 = ang(b2, a2p);
  let dh = 0;
  if (C1 * C2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2);
  const Lm = (L1 + L2) / 2, Cmp = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (C1 * C2 !== 0) hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2);
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.20 * Math.cos((4 * hm - 63) * rad);
  const dT = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + P7));
  const Sl = 1 + 0.015 * Math.pow(Lm - 50, 2) / Math.sqrt(20 + Math.pow(Lm - 50, 2));
  const Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T, Rt = -Math.sin(2 * dT * rad) * Rc;
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
}
/** ΔE₀₀ entre duas cores '#rrggbb'. */
export function deltaE(c1, c2) { return deltaE2000(lab(c1), lab(c2)); }
/** Luminância relativa (WCAG 2.x) e razão de contraste (1–21). */
export function luminancia(h) { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contraste(c1, c2) { const a = luminancia(c1), b = luminancia(c2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
/** Croma (saturação percebida) em CIELAB. */
export function croma(h) { const [, a, b] = lab(h); return Math.hypot(a, b); }
/** A mesma cor com outra luminosidade L* (0–100), mantendo a e b (o que sair do sRGB é cortado). */
export function comL(h, L) { const [, a, b] = lab(h); return deLab([Math.max(0, Math.min(100, L)), a, b]); }
/** Mistura em RGB LINEAR (o que o olho vê de longe numa camisa listrada): t = peso da 2ª cor. */
export function misturar(c1, c2, t) {
  const a = rgb(c1).map(lin), b = rgb(c2).map(lin);
  return paraHex(a.map((v, i) => gama(v * (1 - t) + b[i] * t)));
}
const ESCURO = '#07090a', CLARO = '#f2f4f3';
/** O texto (escuro ou claro) que mais contrasta com o fundo. */
export function textoSobre(fundo) { return contraste(fundo, ESCURO) >= contraste(fundo, CLARO) ? ESCURO : CLARO; }

// ------------------------------------------------------------------ identidade padrão (as constantes de HOJE)

/**
 * Exatamente as constantes de hoje de cada módulo (render/jogador3d.js KITS, render/torcida-dados.js, torcida.js,
 * bandeiras-dados.js TEXTOS, bandeiras.js, texturas.js PAINEIS/texArquibancada/texBandeira, estadio-forma.js FORA.placa,
 * estadio-fora.js, hud.js COR_MAPA, main.js COR_TIME, escalacao-tela.js COR_UNIFORME). Os desenhos NÃO leem este objeto
 * quando `tm` é falso (o código de hoje continua igual); ele serve de referência para os testes e de modelo de formato.
 */
export const IDENTIDADE_PADRAO = congelar({
  tm: false, neutro: false, publico: 1,
  times: [
    { nome: 'Golaço FC', sigla: 'GLÇ', cores: { primaria: '#15191b', secundaria: '#19e07a' }, forte: '#19e07a', escudo: { url: null, simbolo: 'escudo-golaco' } },
    { nome: 'Ventania FC', sigla: 'VNT', cores: { primaria: '#e9ecee', secundaria: '#15191b' }, forte: '#e9ecee', escudo: { url: null, simbolo: 'escudo-ventania' } },
  ],
  kits: {
    linha0: { camisa: '#15191b', calcao: '#0e1112', meiao: '#15191b', chuteira: '#19e07a', acento: '#19e07a', sola: '#0b0d0e', luva: '#19e07a' },
    goleiro0: { camisa: '#b8f02e', calcao: '#101314', meiao: '#b8f02e', chuteira: '#101314', acento: '#101314', sola: '#0b0d0e', luva: '#101314' },
    linha1: { camisa: '#e9ecee', calcao: '#b9bfc4', meiao: '#e9ecee', chuteira: '#15191b', acento: '#15191b', sola: '#d5d9dc', luva: '#15191b' },
    goleiro1: { camisa: '#c4561c', calcao: '#4b5257', meiao: '#c4561c', chuteira: '#2a2e31', acento: '#8f979c', sola: '#1d2023', luva: '#8f979c' },
    arbitro: { camisa: '#2459d6', calcao: '#0e1112', meiao: '#0e1112', chuteira: '#0e1112', acento: '#e9ecee', sola: '#0b0d0e', luva: '#2459d6' },
  },
  torcida: {
    casa: [['#15191b', 50], ['#19e07a', 17], ['#10b862', 8], ['#f2f4f3', 6], ['#2b3238', 7], ['#20304a', 5], ['#7a1f24', 3], ['#c9a227', 2], ['#3a5e8c', 2]],
    fora: [['#e9ecee', 58], ['#b9bfc4', 20], ['#f7f8f8', 10], ['#2b3238', 6], ['#20304a', 6]],
    mosaico: '#19e07a', acentos: ['#19e07a', '#f2f4f5'], foraLados: 0.03,
  },
  mosaico: { texto: 'GOLAÇO' },
  faixas: [
    ['FÚRIA VERDE', '#07090a', '#19e07a', 'borda'],
    ['GALERA GOLAÇO', '#19e07a', '#07090a', 'nenhum'],
    ['NAÇÃO VERDINEGRA', '#f2f4f3', '#0d8447', 'listras'],
    ['AQUI É GOLAÇO', '#07090a', '#f2f4f3', 'verde'],
    ['OS INCANSÁVEIS', '#0d8447', '#f2f4f3', 'borda'],
    ['BONDE DO GOLAÇO', '#07090a', '#19e07a', 'listras'],
    ['SEMPRE CONTIGO', '#19e07a', '#07090a', 'borda'],
    ['VAI, GOLAÇO!', '#07090a', '#f2f4f3', 'verde'],
    ['TORCIDA JOVEM GFC', '#07090a', '#19e07a', 'listras'],
    ['VENTANIA ATÉ O FIM', '#e9ecee', '#2b3238', 'borda'],
    ['GUERREIROS DA ARQUIBANCADA', '#0d8447', '#07090a', 'nenhum'],
    ['FORÇA VENTANIA', '#2b3238', '#e9ecee', 'verde'],
  ],
  festa: { cores: { VERDE: '#19e07a', PRETO: '#07090a', BRANCO: '#f2f4f3', VERDE2: '#0d8447' }, texto: 'GOLAÇO', letra: 'G' },
  paineis: [
    { texto: 'VERDEX', fundo: '#050707', cor: '#19e07a', detalhe: 'barra' },
    { texto: 'GOLAÇO', fundo: '#19e07a', cor: '#050707', detalhe: 'nenhum' },
    { texto: 'NORTE SPORTS', fundo: '#0a0d0e', cor: '#f2f6f3', detalhe: 'seta' },
    { texto: 'GOLAÇO', fundo: '#050707', cor: '#f2f6f3', detalhe: 'verde' },
  ],
  arquibancada: { friso: '#12a95c', mosaico: '#0d8447', cadeira: '#14181a', tom: '#2a3033', tom2: '#0f5233' },
  escanteio: { fundo: '#19e07a', faixa: '#07090a' },
  fachada: { led: '#11a85b', ledNoite: '#19e07a', letreiro: '#19e07a', testeira: '#0d3a25', testeiraFriso: '#19e07a', tunel: '#19e07a', simbolo: '#19e07a' },
  torcedoresFora: { casa: ['#15191b', '#19e07a', '#10b862', '#f2f4f3', '#2b3238'], fora: ['#e9ecee', '#b9bfc4', '#2b3238'] },
  estadio: { nome: 'Estádio Golaço', placa: 'ESTÁDIO GOLAÇO' },
  hud: {
    mapa: { t0: '#19e07a', t0gol: '#c6ff3d', t1: '#93a3ae', t1gol: '#d0631f', bola: '#ffffff' },
    faixa: [{ cor: '#19e07a', texto: '#07090a' }, { cor: '#e7eaec', texto: '#07090a' }],
    placar: ['#19e07a', '#e7eaec'],
  },
});

function congelar(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) congelar(o[k]); }
  return o;
}

// ------------------------------------------------------------------ uniformes (TM → formato do jogador3d.js)

// padrões do TM → fração do iPad do tronco (render/jogador3d.js: 3.0 liso, 3.1 listras, 3.2 metades, 3.3 faixa, 3.4 aros)
export const PADROES = { plain: 0, stripes: 0.1, halves: 0.2, sash: 0.3, hoops: 0.4 };
// peso da 2ª cor no que se vê de longe (a camisa inteira, de longe, na câmera de TV)
const PESO_SEGUNDA = { plain: 0, stripes: 0.5, halves: 0.5, sash: 0.18, hoops: 0.5 };

/** Uniforme do TM ({shirt, sleeves, shorts, socks, pattern, second, trim, ...}) → kit do jogador3d.js. */
export function kitDoTM(k, reserva = '#808890') {
  k = k || {};
  const camisa = corValida(k.shirt) ?? reserva;
  const padrao = Object.prototype.hasOwnProperty.call(PADROES, k.pattern) ? k.pattern : 'plain';
  const segunda = corValida(k.second) ?? corValida(k.trim) ?? textoSobre(camisa);
  // detalhe (listra lateral, punho, gola, faixa do meião): a 2ª cor do uniforme; liso com a 2ª cor igual à camisa, o
  // contraste
  const acento = deltaE(segunda, camisa) < 8 ? (corValida(k.trim) && deltaE(corValida(k.trim), camisa) >= 8 ? corValida(k.trim) : textoSobre(camisa)) : segunda;
  const meiao = corValida(k.socks) ?? camisa;
  const calcao = corValida(k.shorts) ?? acento;
  const kit = {
    camisa, manga: corValida(k.sleeves) ?? camisa, calcao, meiao,
    // chuteira escura (clara só com o meião quase preto) e sola escura
    chuteira: luminancia(meiao) < 0.02 ? '#e9ecee' : '#15191b', acento, sola: '#0b0d0e', luva: acento,
    padrao, segunda: acento,
  };
  return kit;
}
/** Kit de goleiro (camisa, manga comprida e calção) de uma cor só, com o detalhe em contraste. */
function kitGoleiroCor(c) {
  const t = textoSobre(c);
  return { camisa: c, manga: c, calcao: luminancia(c) > 0.3 ? '#15191b' : comL(c, Math.max(8, lab(c)[0] - 25)), meiao: c, chuteira: '#15191b', acento: t, sola: '#0b0d0e', luva: t, padrao: 'plain', segunda: t };
}
/** A cor que se vê de longe na camisa (com a 2ª cor do padrão misturada). */
export function corDeLonge(kit) { return misturar(kit.camisa, kit.segunda ?? kit.acento, PESO_SEGUNDA[kit.padrao] ?? 0); }
/** As cores que dominam a camisa: a da camisa e, nas listras/metades/aros (metade a metade), também a 2ª. */
function dominantes(k) { return (PESO_SEGUNDA[k.padrao] ?? 0) >= 0.5 ? [k.camisa, k.segunda ?? k.acento] : [k.camisa]; }
/**
 * ΔE₀₀ entre duas camisas (a medida do "sem confusão"): metade pela cor vista de longe e metade pela cor dominante mais
 * parecida — vermelho-e-preto em metades contra vermelho com faixa branca dá ~31 de longe, mas as duas são "vermelhas"
 * (dominante 4): 17,5, confusão. Duas camisas lisas: o ΔE das duas cores.
 */
export function deltaCamisas(a, b) {
  let dom = Infinity;
  for (const x of dominantes(a)) for (const y of dominantes(b)) dom = Math.min(dom, deltaE(x, y));
  return 0.5 * deltaE(corDeLonge(a), corDeLonge(b)) + 0.5 * dom;
}
/** Diferença entre dois uniformes para escolher o melhor: as camisas e um pouco do calção. */
export function distanciaUniformes(a, b) { return deltaCamisas(a, b) + 0.25 * deltaE(a.calcao, b.calcao); }

export const LIMIAR = { linha: 25, linhaMin: 15, goleiro: 25, arbitro: 22 };
// goleiros (fictícios; os do TM primeiro): lima, laranja, rosa, roxo, ciano, amarelo, cinza, preto
const GOLEIROS_RESERVA = ['#b8f02e', '#ff7a00', '#e0529c', '#7b4fd6', '#17b6c8', '#f2d21b', '#6b6f7a', '#15191b', '#c4561c'];
// árbitro: azul-royal (o de hoje), preto, amarelo, vermelho, verde-água, rosa, roxo, laranja, ciano, cinza
const ARBITROS = ['#2459d6', '#15191b', '#f2d21b', '#d0312d', '#17a68f', '#e0529c', '#7b4fd6', '#ff8c1a', '#17b6c8', '#7d858c'];

/**
 * Uniformes da partida sem confusão: casa = o de casa (ou o escolhido, `kitEscolhido`); visitante = o primeiro de
 * casa/fora/terceiro com a camisa a ΔE₀₀ ≥ LIMIAR.linha da do mandante (senão o mais diferente; se nem esse passa de
 * LIMIAR.linhaMin, o mandante também pode trocar, se não escolheu); goleiros longe dos 2 uniformes de linha (e do outro
 * goleiro); árbitro longe dos 4. Devolve {kits: {linha0, goleiro0, linha1, goleiro1, arbitro}, escolha, medidas}.
 */
export function resolverUniformes(casa, fora) {
  const op = t => {
    const k = (t && t.kits) || {};
    const p = corValida(t?.colors?.primary) ?? '#808890';
    return [k.home, k.away, k.third].map((x, i) => (x ? kitDoTM(x, p) : null)).map((x, i) => x && { kit: x, i }).filter(Boolean);
  };
  const oc = op(casa), of = op(fora);
  if (!oc.length) oc.push({ kit: kitDoTM({ shirt: casa?.colors?.primary, second: casa?.colors?.secondary }), i: 0 });
  if (!of.length) of.push({ kit: kitDoTM({ shirt: fora?.colors?.primary, second: fora?.colors?.secondary }), i: 0 });
  const esc = t => (t && (t.kitEscolhido === 0 || t.kitEscolhido === 1 || t.kitEscolhido === 2) ? t.kitEscolhido : null);
  const ec = esc(casa), ef = esc(fora);
  const pega = (ops, i) => ops.find(o => o.i === i) ?? ops[0];
  let A = ec != null ? pega(oc, ec) : oc[0], B;
  if (ef != null) {
    B = pega(of, ef);
    // o visitante escolheu: o mandante (se não escolheu) troca para o mais diferente quando há confusão
    if (ec == null && deltaCamisas(A.kit, B.kit) < LIMIAR.linha) A = melhor(oc, o => distanciaUniformes(o.kit, B.kit), o => deltaCamisas(o.kit, B.kit) >= LIMIAR.linha);
  } else {
    B = melhor(of, o => distanciaUniformes(A.kit, o.kit), o => deltaCamisas(A.kit, o.kit) >= LIMIAR.linha);
    if (ec == null && deltaCamisas(A.kit, B.kit) < LIMIAR.linhaMin) {
      // nem o mais diferente do visitante serve: o mandante troca também (o par mais diferente, o de casa primeiro)
      let mel = null;
      for (const a of oc) for (const b of of) { const d = deltaCamisas(a.kit, b.kit); if (!mel || d > mel.d + 1e-9) mel = { a, b, d }; }
      A = mel.a; B = mel.b;
      // e se nem assim: o visitante veste um uniforme de reserva (branco, preto ou cinza com a cor dele no detalhe), como
      // a camisa de emergência que o time leva para o jogo
      if (mel.d < LIMIAR.linhaMin) {
        const cor = corValida(fora?.colors?.primary) ?? B.kit.camisa;
        const res = ['#f2f4f3', '#15191b', '#8a9096', '#ffd23d'].map((c, i) => ({ kit: kitDoTM({ shirt: c, sleeves: c, shorts: c, socks: c, pattern: 'plain', second: deltaE(cor, c) >= 20 ? cor : textoSobre(c), trim: deltaE(cor, c) >= 20 ? cor : textoSobre(c) }), i: 3 + i }));
        B = melhor(res, o => deltaCamisas(A.kit, o.kit), o => deltaCamisas(A.kit, o.kit) >= LIMIAR.linha);
      }
    }
  }
  const linha0 = A.kit, linha1 = B.kit;
  // goleiros: o do TM (gk, depois gkAway) e as cores de reserva, o primeiro longe dos 2 de linha (e do outro goleiro)
  const opGol = t => {
    const k = (t && t.kits) || {};
    const l = [k.gk, k.gkAway].filter(Boolean).map(x => { const c = corValida(x.shirt); return c ? { ...kitGoleiroCor(c), ...kitDoTMGoleiro(x) } : null; }).filter(Boolean);
    for (const c of GOLEIROS_RESERVA) l.push(kitGoleiroCor(c));
    return l.map((kit, i) => ({ kit, i }));
  };
  const longe = (kit, outros) => Math.min(...outros.map(o => deltaCamisas(kit, o)));
  const g0 = melhor(opGol(casa), o => longe(o.kit, [linha0, linha1]), o => longe(o.kit, [linha0, linha1]) >= LIMIAR.goleiro);
  const g1 = melhor(opGol(fora), o => longe(o.kit, [linha0, linha1, g0.kit]), o => longe(o.kit, [linha0, linha1, g0.kit]) >= LIMIAR.goleiro);
  const todos = [linha0, linha1, g0.kit, g1.kit];
  const arb = melhor(ARBITROS.map((c, i) => ({ kit: kitArbitro(c), i })), o => longe(o.kit, todos), o => longe(o.kit, todos) >= LIMIAR.arbitro);
  return {
    kits: { linha0, goleiro0: g0.kit, linha1, goleiro1: g1.kit, arbitro: arb.kit },
    escolha: { casa: ['home', 'away', 'third'][A.i], fora: ['home', 'away', 'third'][B.i] ?? 'reserva' },
    medidas: {
      linhas: deltaCamisas(linha0, linha1),
      goleiros: Math.min(longe(g0.kit, [linha0, linha1]), longe(g1.kit, [linha0, linha1, g0.kit])),
      arbitro: longe(arb.kit, todos),
    },
  };
}
function kitDoTMGoleiro(x) {
  const k = kitDoTM(x);
  // goleiro: manga comprida na cor da camisa (render/jogador3d.js estiloGoleiro) e luva no contraste
  return { camisa: k.camisa, manga: k.camisa, calcao: k.calcao, meiao: k.meiao, acento: k.acento, luva: k.acento, segunda: k.acento, padrao: 'plain' };
}
function kitArbitro(c) {
  const preto = luminancia(c) < 0.03;
  return { camisa: c, calcao: preto ? '#15191b' : '#0e1112', meiao: '#0e1112', chuteira: '#0e1112', acento: preto ? '#e9ecee' : textoSobre(c) === CLARO ? '#e9ecee' : '#15191b', sola: '#0b0d0e', luva: c, manga: c, padrao: 'plain', segunda: '#e9ecee' };
}
/** O primeiro que passa em `ok` (na ordem de preferência); senão o de maior `nota`. */
function melhor(lista, nota, ok) {
  for (const o of lista) if (ok(o)) return o;
  let m = lista[0], v = -Infinity;
  for (const o of lista) { const x = nota(o); if (x > v + 1e-9) { v = x; m = o; } }
  return m;
}

// ------------------------------------------------------------------ cores de cada time

const sigla3 = (s, nome) => {
  const x = String(s || '').trim().toUpperCase();
  if (x) return x.slice(0, 3);
  return String(nome || 'TME').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'TME';
};
const maiusc = s => String(s || '').trim().toLocaleUpperCase('pt-BR');

/**
 * Cores de um time: primária/secundária (as do TM; a secundária igual à primária vira preto ou branco), a FORTE (a de
 * mais croma: a que pinta faixa, friso e bandeira — o verde do Golaço, o vermelho de um rubro-negro; time preto e
 * branco → a mais clara), a escura (para fundo de faixa) e a forte escurecida (o "verde-escuro" das faixas).
 */
export function coresDoTime(t) {
  const k = t?.kits?.home || {};
  const c1 = corValida(t?.colors?.primary) ?? corValida(k.shirt) ?? '#808890';
  let c2 = corValida(t?.colors?.secondary) ?? corValida(k.second) ?? textoSobre(c1);
  if (deltaE(c1, c2) < 8) c2 = luminancia(c1) > 0.3 ? '#111111' : '#ffffff';
  const k1 = croma(c1), k2 = croma(c2);
  let forte;
  if (k1 < 14 && k2 < 14) forte = lab(c1)[0] >= lab(c2)[0] ? c1 : c2;
  else forte = k2 > k1 + 12 ? c2 : c1;
  const outra = forte === c1 ? c2 : c1;
  const escura = lab(outra)[0] < 32 ? outra : ESCURO;
  const L = lab(forte)[0];
  const forte2 = comL(forte, Math.max(22, Math.min(L - 26, 50)));
  return { primaria: c1, secundaria: c2, forte, outra, escura, forte2 };
}

// ------------------------------------------------------------------ torcida

const NEUTROS_TORCIDA = [['#15191b', 6], ['#f2f4f3', 4], ['#2b3238', 6], ['#20304a', 4], ['#5b6168', 3], ['#3a5e8c', 2], ['#7a1f24', 1], ['#c9a227', 1]];
/**
 * Paleta das camisas da torcida de um time ([[hex, peso]…], ≥ 10 cores): a primária (a maioria), a secundária, a forte
 * mais clara e mais escura, e os neutros (quem não veio de camisa). Cores repetidas somam os pesos.
 */
export function paletaTorcida(c) {
  const l = [[c.primaria, 40], [c.secundaria, 18], [comL(c.forte, Math.min(92, lab(c.forte)[0] + 10)), 7], [comL(c.forte, Math.max(12, lab(c.forte)[0] - 14)), 7], ...NEUTROS_TORCIDA];
  const m = new Map();
  for (const [h, p] of l) m.set(h, (m.get(h) ?? 0) + p);
  const r = [...m.entries()];
  // sempre ≥ 10 cores (a variedade da arquibancada; tools/teste-torcida confere)
  const extra = ['#8a9096', '#d9dcde', '#3d2f26', '#46524a'];
  for (const h of extra) { if (r.length >= 10) break; if (!m.has(h)) r.push([h, 1]); }
  return r;
}
/** Cachecol: a cor de mais croma do time (preto e branco: a mais clara). */
function corCachecol(c) { return c.forte; }

// ------------------------------------------------------------------ faixas, bandeiras e placas

/** Nome para escrever em pano/placa: em maiúsculas; comprido demais → a sigla. */
export function nomeCurto(t, max = 16) {
  const n = maiusc(t?.name);
  return n && n.length <= max ? n : sigla3(t?.short, t?.name);
}
function fixaLetra(fundo, letra) { return contraste(fundo, letra) >= 3 ? letra : textoSobre(fundo); }

/**
 * As 12 faixas ([texto, fundo, letra, detalhe, cor do detalhe]) na ordem dos lugares de bandeiras-dados.js faixas():
 * 0–8 e 10 da casa (lado de lá e organizada), 9 e 11 do visitante (o setor dele). Textos FICTÍCIOS de torcida com o
 * nome do time; as cores na mesma ordem do padrão (forte, escura, clara, forte escurecida), com a letra corrigida
 * quando o contraste com o fundo fica abaixo de 3:1.
 */
export function textosFaixas(casa, fora, cc, cf) {
  const N = nomeCurto(casa, 18), S = sigla3(casa?.short, casa?.name);
  const Nf = nomeCurto(fora, 18);
  const P = cc.forte, D = cc.escura, W = CLARO, P2 = cc.forte2;
  const Pf = cf.forte, Df = cf.escura;
  const l = [
    [`FÚRIA ${S}`, D, P, 'borda'],
    [`GALERA ${N}`, P, D, 'nenhum'],
    [`NAÇÃO ${N}`, W, P2, 'listras'],
    [`AQUI É ${N}`, D, W, 'verde', P],
    ['OS INCANSÁVEIS', P2, W, 'borda'],
    [`SEMPRE ${N}`, D, P, 'listras'],
    ['SEMPRE CONTIGO', P, D, 'borda'],
    [`VAI, ${S}!`, D, W, 'verde', P],
    [`TORCIDA JOVEM ${S}`, D, P, 'listras'],
    [`${Nf} ATÉ O FIM`, Pf, Df, 'borda'],
    ['GUERREIROS DA ARQUIBANCADA', P2, D, 'nenhum'],
    [`FORÇA ${Nf}`, Df, Pf === Df ? W : Pf, 'verde', Pf],
  ];
  return l.map(([t, fu, le, de, dc]) => {
    const r = [t, fu, fixaLetra(fu, le), de];
    if (dc) r.push(deltaE(dc, fu) < 12 ? textoSobre(fu) : dc);
    return r;
  });
}

/** Placas de LED do mandante: 'TOTAL MATCH', o nome do mandante, o escudo (com a sigla) e a neutra. */
function paineisTM(casa, cc, neutro, competicao) {
  const tm = { texto: 'TOTAL MATCH', fundo: '#050807', cor: '#22c55e', detalhe: 'barra' };
  const norte = { texto: 'NORTE SPORTS', fundo: '#0a0d0e', cor: '#f2f6f3', detalhe: 'seta', seta: '#22c55e' };
  if (neutro) {
    const comp = maiusc(competicao) || 'FUTEBOL TOTAL';
    return [tm, { texto: comp.length > 22 ? comp.slice(0, 22) : comp, fundo: '#22c55e', cor: '#050807', detalhe: 'nenhum' }, norte, { texto: 'VERDEX', fundo: '#050707', cor: '#22c55e', detalhe: 'barra' }];
  }
  return [
    tm,
    { texto: nomeCurto(casa, 18), fundo: cc.forte, cor: textoSobre(cc.forte), detalhe: 'nenhum' },
    norte,
    { texto: sigla3(casa?.short, casa?.name), fundo: '#050707', cor: '#f2f6f3', detalhe: 'escudo', escudo: 0, borda: cc.forte },
  ];
}

// ------------------------------------------------------------------ HUD

const FUNDO_HUD = '#0b1012', FUNDO_MAPA = '#061a0f', BOLA = '#ffffff';
const RESERVA_HUD = ['#ff8a3d', '#3fa9ff', '#ffd23d', '#c86bff', '#ff5d8f', '#4de3ff', '#9be15d'];
/** Cor do time no placar e na faixa ENTRA/SAI: a forte, clareada até ter contraste ≥ 3 com o fundo escuro do HUD. */
function corPlacar(c) {
  if (contraste(c.forte, FUNDO_HUD) >= 3) return c.forte;
  // a forte mais clara (até L* 78, sem virar outra cor); senão a outra cor do time; senão a forte clareada até dar
  for (let L = lab(c.forte)[0] + 4; L <= 78; L += 4) { const h = comL(c.forte, L); if (croma(c.forte) >= 14 && contraste(h, FUNDO_HUD) >= 3) return h; }
  if (contraste(c.outra, FUNDO_HUD) >= 3) return c.outra;
  let L = lab(c.forte)[0], h = c.forte;
  while (contraste(h, FUNDO_HUD) < 3 && L < 98) { L += 4; h = comL(c.forte, L); }
  return h;
}
/**
 * Cores do minimapa: cada time pela cor dele, mas a ≥ 22 de ΔE₀₀ do branco da bola, com contraste ≥ 3 sobre o verde
 * escuro do mapa e a ≥ 25 do outro time (os goleiros a ≥ 18 de todos). Sem nenhuma do time que sirva, uma de reserva.
 */
export function coresMapa(cc, cf, gol0, gol1, veste0 = null, veste1 = null) {
  const okBase = h => deltaE(h, BOLA) >= 22 && contraste(h, FUNDO_MAPA) >= 3;
  // a camisa que o time veste (vista de longe) primeiro: é por ela que se reconhece o time no campo
  const cands = (c, v) => [...(v ? [v] : []), c.forte, c.outra, ...(v ? [comL(v, 62)] : []), comL(c.forte, 62), comL(c.forte, 70), comL(c.outra, 62), ...RESERVA_HUD];
  const t0 = cands(cc, veste0).find(okBase) ?? RESERVA_HUD[0];
  const t1 = cands(cf, veste1).find(h => okBase(h) && deltaE(h, t0) >= 25) ?? RESERVA_HUD.find(h => deltaE(h, t0) >= 25);
  const candGol = g => [g, comL(g, 62), comL(g, 72), ...RESERVA_HUD];
  const okGol = (h, outros) => okBase(h) && outros.every(o => deltaE(h, o) >= 18);
  const t0gol = candGol(gol0).find(h => okGol(h, [t0, t1])) ?? '#c6ff3d';
  const t1gol = candGol(gol1).find(h => okGol(h, [t0, t1, t0gol])) ?? '#d0631f';
  return { t0, t0gol, t1, t1gol, bola: BOLA };
}

// ------------------------------------------------------------------ escudo de reserva (sigla nas cores do time)

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * Escudo de reserva (sem escudo no pedido, ou a imagem não carregou): a forma do escudo do placar nas cores do time
 * com a sigla — SVG (texto puro). svgEscudoSigla devolve a marcação; urlEscudoSigla, a data URL (placar, canvas).
 */
export function svgEscudoSigla(sigla, cor1, cor2) {
  const c1 = corValida(cor1) ?? '#808890';
  let c2 = corValida(cor2) ?? textoSobre(c1);
  if (deltaE(c1, c2) < 15) c2 = textoSobre(c1);
  const s = esc(String(sigla || '').slice(0, 3));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="220" viewBox="0 0 100 110">`
    + `<path d="M50 6 93 19V55c0 25-18.5 42-43 49.5C25.5 97 7 80 7 55V19z" fill="${c1}" stroke="${c2}" stroke-width="7" stroke-linejoin="round"/>`
    + `<text x="50" y="66" text-anchor="middle" font-family="Inter, system-ui, Arial, sans-serif" font-weight="900" font-size="${s.length > 2 ? 30 : 38}" fill="${c2}">${s}</text></svg>`;
}
export function urlEscudoSigla(sigla, cor1, cor2) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgEscudoSigla(sigla, cor1, cor2));
}

// ------------------------------------------------------------------ identidade do pedido do TM

const ESTADIO_NEUTRO = 'Arena Central';
const urlEscudo = u => (typeof u === 'string' && /^(data:image\/|https?:\/\/|\/|\.\.?\/)/i.test(u.trim()) ? u.trim() : null);

/**
 * Identidade da partida a partir do pedido do TM (contrato §1: {home, away, partida: {neutro, publico, competicao}}).
 * Time 0 = mandante (home), time 1 = visitante. Nunca falha: o que faltar no pedido vem da reserva.
 */
export function identidadeDoPedido(pedido) {
  const casa = pedido?.home || {}, fora = pedido?.away || {};
  const neutro = !!pedido?.partida?.neutro;
  const pub = Number(pedido?.partida?.publico);
  const publico = Number.isFinite(pub) ? Math.max(0.1, Math.min(1, pub)) : 1;
  const cc = coresDoTime(casa), cf = coresDoTime(fora);
  const un = resolverUniformes(casa, fora);
  const time = (t, c, i) => {
    const nome = String(t?.name || (i ? 'Visitante' : 'Mandante'));
    const sigla = sigla3(t?.short, t?.name);
    const gerado = urlEscudoSigla(sigla, c.forte === c.primaria ? c.primaria : c.forte, c.outra);
    return {
      nome, sigla, cores: { primaria: c.primaria, secundaria: c.secundaria }, forte: c.forte, outra: c.outra, escura: c.escura,
      escudo: { url: urlEscudo(t?.identidade?.escudo) ?? gerado, gerado, tipo: t?.identidade?.escudoTipo ?? null, img: null },
    };
  };
  const times = [time(casa, cc, 0), time(fora, cf, 1)];
  // estádio: o do mandante (identidade.estadio.nome, senão stadium); jogo neutro → um nome genérico fictício
  const nomeEst = neutro ? ESTADIO_NEUTRO : (String(casa?.identidade?.estadio?.nome || casa?.stadium || '').trim() || `Arena ${times[0].nome}`);
  // cores do estádio: as do mandante (jogo neutro: as do Total Match)
  const ce = neutro ? coresDoTime({ colors: { primary: '#22c55e', secondary: '#050807' } }) : cc;
  // mosaico das cadeiras: a cor que mais se destaca da maioria da torcida (a primária) e das cadeiras escuras,
  // preferindo as do time
  const CADEIRA = '#14181a';
  const candM = [[ce.secundaria, 25], [ce.forte, 25], [comL(ce.forte, 78), 12], [CLARO, 8], ['#ffd23d', -12]];
  let mos = candM[0][0], vm = -Infinity;
  for (const [h, b] of candM) { const v = Math.min(deltaE(h, ce.primaria), 0.7 * deltaE(h, CADEIRA)) + b; if (v > vm + 1e-9) { vm = v; mos = h; } }
  const mosTex = croma(mos) < 14 ? (lab(mos)[0] > 50 ? '#cfd4d7' : '#0b0d0e') : comL(mos, 48);
  const textoMosaico = neutro ? 'TOTAL MATCH' : nomeCurto(casa, 12);
  const forte = ce.forte, Lf = lab(forte)[0];
  const vivo = croma(forte) < 14 ? forte : comL(forte, Math.max(55, Math.min(80, Lf)));
  const gol0 = un.kits.goleiro0.camisa, gol1 = un.kits.goleiro1.camisa;
  const mapa = coresMapa(cc, cf, gol0, gol1, corDeLonge(un.kits.linha0), corDeLonge(un.kits.linha1));
  // placar e faixa ENTRA/SAI: a cor de cada time; dois times da mesma cor → o visitante pela outra cor dele (ou a da
  // camisa que ele veste), para as duas faixas não ficarem iguais
  const p0 = corPlacar(cc);
  let p1 = corPlacar(cf);
  if (deltaE(p0, p1) < 15) p1 = [cf.outra, un.kits.linha1.camisa, ...RESERVA_HUD].find(h => contraste(h, FUNDO_HUD) >= 3 && deltaE(h, p0) >= 15) ?? p1;
  const faixa = [{ cor: p0, texto: textoSobre(p0) }, { cor: p1, texto: textoSobre(p1) }];
  const escanteioFaixa = deltaE(ce.outra, forte) >= 20 ? ce.outra : textoSobre(forte);
  const festaPreto = deltaE(cc.outra, cc.forte) >= 15 ? cc.outra : textoSobre(cc.forte);
  return {
    tm: true, neutro, publico,
    competicao: String(pedido?.partida?.competicao || ''),
    times,
    kits: un.kits, uniformes: { escolha: un.escolha, medidas: un.medidas },
    torcida: {
      casa: paletaTorcida(cc), fora: paletaTorcida(cf), mosaico: mos, acentos: [corCachecol(cc), corCachecol(cf)],
      // fora do setor visitante: 3% de visitantes espalhados pelos lados (jogo neutro: quase metade)
      foraLados: neutro ? 0.45 : 0.03,
    },
    mosaico: { texto: textoMosaico },
    faixas: textosFaixas(casa, fora, cc, cf),
    festa: {
      cores: { VERDE: cc.forte, PRETO: festaPreto, BRANCO: CLARO, VERDE2: cc.forte2 },
      // a letra/nome sobre o fundo escuro do bandeirão (legível: ≥ 2,5:1)
      corLetra: contraste(festaPreto, cc.forte) >= 2.5 ? cc.forte : textoSobre(festaPreto),
      texto: nomeCurto(casa, 12), letra: sigla3(casa?.short, casa?.name).slice(0, 1), sigla: sigla3(casa?.short, casa?.name), escudo: 0,
    },
    paineis: paineisTM(casa, cc, neutro, pedido?.partida?.competicao),
    arquibancada: { friso: comL(vivo, Math.max(45, Math.min(65, lab(vivo)[0]))), mosaico: mosTex, cadeira: CADEIRA, tom: '#2a3033', tom2: comL(forte, Math.max(18, Math.min(32, Lf - 20))) },
    escanteio: { fundo: forte, faixa: escanteioFaixa },
    fachada: {
      led: comL(vivo, Math.max(40, Math.min(62, lab(vivo)[0]))), ledNoite: vivo, letreiro: vivo,
      testeira: comL(forte, Math.max(10, Math.min(22, Lf - 30))), testeiraFriso: vivo, tunel: vivo, simbolo: vivo,
    },
    torcedoresFora: {
      casa: [cc.primaria, cc.forte, cc.secundaria, comL(cc.forte, Math.min(90, lab(cc.forte)[0] + 12)), '#2b3238'],
      fora: [cf.primaria, cf.secundaria, '#2b3238'],
    },
    estadio: { nome: nomeEst, placa: maiusc(nomeEst) },
    hud: { mapa, faixa, placar: [p0, p1] },
  };
}

/**
 * Extras do placar para hud.definirTimes (main.js timesDoMundo): o escudo-imagem, a cor do time e as cores do
 * minimapa. Sem ?tm, {} (o placar de hoje: os <symbol> do index.html e as cores do CSS).
 */
export function extrasPlacar(ident, t) {
  if (!ident || !ident.tm) return {};
  const T = ident.times[t];
  return {
    escudoUrl: T.escudo.url, cor: ident.hud.placar[t], corTexto: textoSobre(ident.hud.placar[t]),
    mapa: { lin: ident.hud.mapa[t ? 't1' : 't0'], gol: ident.hud.mapa[t ? 't1gol' : 't0gol'] },
  };
}
