/* ===== cartaz.js — o renderizador do Estúdio Criativo =====

   Uma função pura desenha o material inteiro num <canvas>: cartaz, flyer,
   post, ingresso ou A4. A mesma função serve para a pré-visualização na tela
   e para a exportação em alta — muda só a escala. Nada de biblioteca de
   design: Canvas 2D e contas.

   Como usar:
     const c = await renderizar(cfg, { escala: 1 });   // canvas pronto
     const url = await paraPNG(cfg, 3);                // PNG em 3× para impressão
*/

import { FORMATOS, PALETAS, paleta as acharPaleta, formato as acharFormato } from './dados.js';
import { misturar, contraste } from './util.js';

/* ---------- configuração padrão de um projeto ---------- */
export function cfgPadrao(formatoId = 'cartaz') {
  return {
    formato: formatoId,
    paleta: 'iris',
    fundo: 'malha',              // malha | raios | degrade | solido | grade
    selo: 'KATSEYE',
    titulo: 'Beautiful Chaos',
    subtitulo: 'Listening party & fan meeting',
    data: '28 DE JUNHO',
    hora: '20H',
    local: 'São Paulo · Brasil',
    setor: 'PISTA PREMIUM',
    preco: '',
    portador: '',
    serie: '',
    rodape: 'katseye.central',
    alinhamento: 'centro',
    escalaTexto: 1,
    maiusculas: true,
    granulado: true,
    brilho: true,
    integranteId: '',
    corIntegrante: '',
    fotoDataURL: '',
    fotoOpacidade: 0.55,
    fotoPosicao: 50,             // 0..100, enquadramento vertical
  };
}

/* ---------- utilidades de desenho ---------- */
const PILHA_FONTE = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * O atalho `ctx.font` segue a gramática do CSS `font`, que NÃO aceita
 * letter-spacing — enfiar o espaçamento aqui invalida a declaração inteira e
 * o canvas volta para os 10px padrão. Por isso a fonte é só fonte, e o
 * espaçamento vai por `espacar()`, que mexe na propriedade certa.
 */
const fonte = (peso, tam) => `${peso} ${Math.round(tam)}px ${PILHA_FONTE}`;

/** Define o espaçamento entre letras (ignorado em navegador que não suporta). */
function espacar(ctx, px = 0) {
  try { ctx.letterSpacing = `${px}px`; } catch { /* navegador antigo: segue sem */ }
}

function retArred(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Quebra o texto em linhas que cabem em `maxL`. Respeita quebras manuais. */
function quebrar(ctx, txt, maxL) {
  const linhas = [];
  for (const paragrafo of String(txt || '').split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) { linhas.push(''); continue; }
    let atual = palavras[0];
    for (const p of palavras.slice(1)) {
      const teste = `${atual} ${p}`;
      if (ctx.measureText(teste).width <= maxL) atual = teste;
      else { linhas.push(atual); atual = p; }
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Escreve linhas já quebradas e devolve a altura ocupada. */
function escrever(ctx, linhas, x, y, alturaLinha) {
  linhas.forEach((l, i) => ctx.fillText(l, x, y + i * alturaLinha));
  return linhas.length * alturaLinha;
}

/** Diminui a fonte até o texto caber em no máximo `maxLinhas`. */
function ajustar(ctx, txt, maxL, tamInicial, maxLinhas, peso = 800, esp = 0) {
  let tam = tamInicial;
  espacar(ctx, esp);
  for (let i = 0; i < 40; i += 1) {
    ctx.font = fonte(peso, tam);
    const linhas = quebrar(ctx, txt, maxL);
    if (linhas.length <= maxLinhas && linhas.every((l) => ctx.measureText(l).width <= maxL)) {
      return { tam, linhas };
    }
    tam *= 0.94;
  }
  ctx.font = fonte(peso, tam);
  return { tam, linhas: quebrar(ctx, txt, maxL) };
}

/* ---------- fundos ---------- */
function fundoMalha(ctx, w, h, p) {
  ctx.fillStyle = p.fundo;
  ctx.fillRect(0, 0, w, h);
  const bolhas = [
    { x: 0.14, y: 0.16, r: 0.70, cor: p.a, op: 0.78 },
    { x: 0.90, y: 0.26, r: 0.60, cor: p.b, op: 0.64 },
    { x: 0.58, y: 0.92, r: 0.72, cor: p.c, op: 0.38 },
    { x: 0.06, y: 0.72, r: 0.50, cor: p.b, op: 0.34 },
  ];
  for (const b of bolhas) {
    const raio = b.r * Math.max(w, h) * 0.62;
    const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, raio);
    g.addColorStop(0, `${b.cor}${Math.round(b.op * 255).toString(16).padStart(2, '0')}`);
    g.addColorStop(1, `${b.cor}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
function fundoRaios(ctx, w, h, p) {
  ctx.fillStyle = p.fundo;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2; const cy = h * 0.42;
  const n = 26;
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * w * 2, cy + Math.sin(a0) * w * 2);
    ctx.lineTo(cx + Math.cos(a1) * w * 2, cy + Math.sin(a1) * w * 2);
    ctx.closePath();
    ctx.fillStyle = `${i % 2 ? p.a : p.b}14`;
    ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
  g.addColorStop(0, `${p.a}55`);
  g.addColorStop(1, `${p.fundo}f2`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function fundoDegrade(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.a);
  g.addColorStop(0.55, misturar(p.b, p.fundo, 0.25));
  g.addColorStop(1, p.fundo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function fundoSolido(ctx, w, h, p) {
  ctx.fillStyle = p.fundo;
  ctx.fillRect(0, 0, w, h);
}
function fundoGrade(ctx, w, h, p) {
  fundoSolido(ctx, w, h, p);
  const passo = Math.max(w, h) / 26;
  ctx.strokeStyle = `${p.a}22`;
  ctx.lineWidth = Math.max(1, w / 900);
  for (let x = 0; x <= w; x += passo) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += passo) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const g = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.8);
  g.addColorStop(0, `${p.b}3a`);
  g.addColorStop(1, `${p.fundo}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const FUNDOS = { malha: fundoMalha, raios: fundoRaios, degrade: fundoDegrade, solido: fundoSolido, grade: fundoGrade };
export const TIPOS_FUNDO = [
  { v: 'malha', t: 'Malha' }, { v: 'raios', t: 'Raios' }, { v: 'degrade', t: 'Degradê' },
  { v: 'grade', t: 'Grade' }, { v: 'solido', t: 'Sólido' },
];

/** Grão de filme: um ladrilho pequeno repetido, para não pesar em alta resolução. */
let ladrilhoGrao = null;
function grao(ctx, w, h, forca = 0.06) {
  if (!ladrilhoGrao) {
    const t = document.createElement('canvas');
    t.width = 128; t.height = 128;
    const c = t.getContext('2d');
    const img = c.createImageData(128, 128);
    let semente = 1337;
    for (let i = 0; i < img.data.length; i += 4) {
      semente = (semente * 1103515245 + 12345) & 0x7fffffff;      // ruído reprodutível
      const v = semente % 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    ladrilhoGrao = t;
  }
  ctx.save();
  ctx.globalAlpha = forca;
  ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(ladrilhoGrao, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Vinheta: escurece as bordas e faz o texto respirar. */
function vinheta(ctx, w, h, cor) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, `${cor}00`);
  g.addColorStop(1, `${cor}a0`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Desenha a foto cobrindo a área toda (object-fit: cover). */
function fotoCover(ctx, img, w, h, posicao = 50, opacidade = 0.55) {
  const escala = Math.max(w / img.width, h / img.height);
  const lw = img.width * escala; const lh = img.height * escala;
  const x = (w - lw) / 2;
  const y = (h - lh) * (posicao / 100);
  ctx.save();
  ctx.globalAlpha = opacidade;
  ctx.drawImage(img, x, y, lw, lh);
  ctx.restore();
}

export function carregarImagem(src) {
  return new Promise((ok) => {
    if (!src) { ok(null); return; }
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/* ---------- a marca (olho estilizado) ---------- */
function olho(ctx, cx, cy, larg, cor) {
  const alt = larg * 0.52;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = larg * 0.055;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - larg / 2, cy);
  ctx.quadraticCurveTo(cx, cy - alt, cx + larg / 2, cy);
  ctx.quadraticCurveTo(cx, cy + alt, cx - larg / 2, cy);
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(cx, cy, larg * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ==========================================================
   LAYOUT 1 — cartaz / flyer / post / A4
   ========================================================== */
function desenharCartaz(ctx, cfg, w, h, p, img) {
  const centro = cfg.alinhamento === 'centro';
  const margem = w * 0.085;
  const maxL = w - margem * 2;
  const x = centro ? w / 2 : margem;
  const e = Number(cfg.escalaTexto) || 1;
  const txtCor = p.txt;
  const cx = (t) => (cfg.maiusculas ? String(t || '').toUpperCase() : String(t || ''));

  (FUNDOS[cfg.fundo] || fundoMalha)(ctx, w, h, p);
  if (img) {
    fotoCover(ctx, img, w, h, cfg.fotoPosicao, cfg.fotoOpacidade);
  } else {
    // Sem foto, a metade de cima fica um vazio escuro que parece peça
    // inacabada. A marca d'água ocupa esse espaço de propósito — discreta
    // o bastante para nunca competir com o título.
    ctx.save();
    ctx.globalAlpha = 0.07;
    olho(ctx, w / 2, h * 0.33, w * 0.62, p.txt);
    ctx.restore();
  }
  vinheta(ctx, w, h, p.fundo);

  ctx.textAlign = centro ? 'center' : 'left';
  ctx.textBaseline = 'top';

  /* --- topo: selo --- */
  let y = margem;
  if (cfg.selo) {
    ctx.font = fonte(800, w * 0.028 * e);
    const larguraSelo = ctx.measureText(cx(cfg.selo)).width + w * 0.055;
    const alturaSelo = w * 0.062 * e;
    const sx = centro ? (w - larguraSelo) / 2 : margem;
    ctx.save();
    ctx.fillStyle = `${p.a}2e`;
    ctx.strokeStyle = `${p.a}88`;
    ctx.lineWidth = Math.max(1, w / 700);
    retArred(ctx, sx, y, larguraSelo, alturaSelo, alturaSelo / 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    olho(ctx, sx + w * 0.032, y + alturaSelo / 2, w * 0.036, p.a);
    ctx.fillStyle = txtCor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    espacar(ctx, w * 0.004);
    ctx.fillText(cx(cfg.selo), sx + w * 0.058, y + alturaSelo / 2);
    espacar(ctx, 0);
    ctx.textAlign = centro ? 'center' : 'left';
    ctx.textBaseline = 'top';
    y += alturaSelo + h * 0.03;
  }

  /* --- da base para cima ---
     O conteúdo é empilhado de baixo para cima, cada bloco empurrando o
     limite. Antes o rodapé era ancorado no fim da peça por fora dessa
     conta, e quando o título crescia as duas linhas se sobrepunham. */
  const topoLivre = y;                       // onde o selo terminou
  const infos = [cfg.data, cfg.hora, cfg.local].filter(Boolean).map(cx);
  let base = h - margem * 0.7;
  ctx.textBaseline = 'bottom';

  // rodapé e preço, na mesma linha
  if (cfg.rodape || cfg.preco) {
    const tamRodape = w * 0.022 * e;
    const tamPreco = w * 0.03 * e;
    if (cfg.rodape) {
      espacar(ctx, w * 0.004);
      ctx.font = fonte(600, tamRodape);
      ctx.fillStyle = `${txtCor}70`;
      ctx.fillText(cx(cfg.rodape), x, base);
      espacar(ctx, 0);
    }
    if (cfg.preco) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = fonte(800, tamPreco);
      ctx.fillStyle = p.c;
      ctx.fillText(cx(cfg.preco), w - margem, base);
      ctx.restore();
    }
    base -= Math.max(tamRodape, cfg.preco ? tamPreco : 0) * 1.7;
  }

  // linha de data / hora / local
  if (infos.length) {
    const tamInfo = w * 0.031 * e;
    espacar(ctx, w * 0.003);
    ctx.font = fonte(700, tamInfo);
    ctx.fillStyle = p.c;
    ctx.fillText(infos.join('   ·   '), x, base);
    espacar(ctx, 0);
    base -= tamInfo * 1.7;
  }

  // filete decorativo
  const larguraFilete = centro ? w * 0.6 : maxL * 0.5;
  const xFilete = centro ? (w - larguraFilete) / 2 : margem;
  const grad = ctx.createLinearGradient(xFilete, 0, xFilete + larguraFilete, 0);
  grad.addColorStop(0, `${p.a}00`);
  grad.addColorStop(0.5, p.a);
  grad.addColorStop(1, `${p.c}00`);
  ctx.fillStyle = grad;
  ctx.fillRect(xFilete, base, larguraFilete, Math.max(2, w * 0.003));
  base -= w * 0.035;

  // título: só pode usar o vão entre o selo e o que já foi empilhado
  const alturaSub = cfg.subtitulo ? w * 0.055 * e : 0;
  const vao = Math.max(w * 0.1, base - topoLivre - alturaSub);
  const tituloBase = Math.min(w * 0.155 * e, (vao / 3) / 1.02);
  const { tam, linhas } = ajustar(ctx, cx(cfg.titulo), maxL, tituloBase, 3, 800, -w * 0.002);

  espacar(ctx, -w * 0.002);
  ctx.font = fonte(800, tam);
  ctx.fillStyle = txtCor;
  const desenharTitulo = () => linhas.forEach((l, i) => {
    ctx.fillText(l, x, base - (linhas.length - 1 - i) * tam * 1.02);
  });
  if (cfg.brilho) {
    ctx.save();
    ctx.shadowColor = `${p.a}99`;
    ctx.shadowBlur = w * 0.045;
    desenharTitulo();
    ctx.restore();
  }
  desenharTitulo();
  espacar(ctx, 0);
  base -= linhas.length * tam * 1.02 + w * 0.012;

  // subtítulo, acima do título
  if (cfg.subtitulo) {
    ctx.font = fonte(600, w * 0.036 * e);
    ctx.fillStyle = `${txtCor}b8`;
    const [linhaSub] = quebrar(ctx, cx(cfg.subtitulo), maxL);
    ctx.fillText(linhaSub || '', x, base);
  }

  ctx.textBaseline = 'top';
}


/* ==========================================================
   LAYOUT 2 — ingresso colecionável
   ========================================================== */
function desenharIngresso(ctx, cfg, w, h, p, img) {
  const cx = (t) => (cfg.maiusculas ? String(t || '').toUpperCase() : String(t || ''));
  const e = Number(cfg.escalaTexto) || 1;
  const margem = h * 0.1;
  const canhoto = w * 0.24;
  const corte = w - canhoto;

  /* fundo geral */
  (FUNDOS[cfg.fundo] || fundoMalha)(ctx, w, h, p);
  if (img) fotoCover(ctx, img, w, h, cfg.fotoPosicao, cfg.fotoOpacidade * 0.8);

  /* corpo principal escurecido para o texto ler bem */
  ctx.save();
  const gCorpo = ctx.createLinearGradient(0, 0, corte, 0);
  gCorpo.addColorStop(0, `${p.fundo}f0`);
  gCorpo.addColorStop(1, `${p.fundo}9a`);
  ctx.fillStyle = gCorpo;
  ctx.fillRect(0, 0, corte, h);
  ctx.restore();

  /* canhoto com a cor de acento */
  ctx.save();
  const gCanhoto = ctx.createLinearGradient(corte, 0, w, h);
  gCanhoto.addColorStop(0, p.a);
  gCanhoto.addColorStop(1, p.b);
  ctx.fillStyle = gCanhoto;
  ctx.fillRect(corte, 0, canhoto, h);
  ctx.restore();

  /* picote */
  ctx.save();
  ctx.strokeStyle = `${p.fundo}dd`;
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.setLineDash([h * 0.035, h * 0.028]);
  ctx.beginPath();
  ctx.moveTo(corte, h * 0.06);
  ctx.lineTo(corte, h * 0.94);
  ctx.stroke();
  ctx.restore();
  // furos do picote
  ctx.fillStyle = '#00000000';
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  [0, h].forEach((cy) => {
    ctx.beginPath();
    ctx.arc(corte, cy, h * 0.052, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  /* --- lado esquerdo: o evento --- */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = margem;

  olho(ctx, margem + h * 0.045, y + h * 0.045, h * 0.09, p.a);
  espacar(ctx, h * 0.012);
  ctx.font = fonte(800, h * 0.052 * e);
  ctx.fillStyle = p.txt;
  ctx.fillText(cx(cfg.selo || 'KATSEYE'), margem + h * 0.12, y + h * 0.02);
  espacar(ctx, 0);
  y += h * 0.13;

  /* O título só pode ocupar o que sobra entre o cabeçalho e a linha de
     campos — por isso os campos são posicionados primeiro e o título é
     dimensionado para caber no vão que restou. */
  const maxL = corte - margem * 2;
  const campos = [
    ['DATA', cfg.data],
    ['HORA', cfg.hora],
    ['LOCAL', cfg.local],
    ['SETOR', cfg.setor],
  ].filter(([, v]) => v);

  const yCampos = h - margem - h * 0.2;
  const alturaSub = cfg.subtitulo ? h * 0.085 : 0;
  const vao = Math.max(h * 0.12, yCampos - y - alturaSub - h * 0.03);
  const tamTitulo = Math.min(h * 0.2 * e, (vao / 2) / 1.04);

  const { tam, linhas } = ajustar(ctx, cx(cfg.titulo), maxL, tamTitulo, 2, 800, -h * 0.002);
  ctx.fillStyle = p.txt;
  y += escrever(ctx, linhas, margem, y, tam * 1.04);
  espacar(ctx, 0);

  if (cfg.subtitulo) {
    ctx.font = fonte(600, h * 0.05 * e);
    ctx.fillStyle = `${p.txt}aa`;
    const [linhaSub] = quebrar(ctx, cx(cfg.subtitulo), maxL);
    ctx.fillText(linhaSub || '', margem, Math.min(y + h * 0.015, yCampos - h * 0.07));
  }

  /* linha de campos — colunas iguais, para nunca invadir o canhoto */
  const larguraCol = (corte - margem * 2) / Math.max(1, campos.length);

  campos.forEach(([rot, val], i) => {
    const xc = margem + i * larguraCol;
    espacar(ctx, h * 0.008);
    ctx.font = fonte(700, h * 0.034 * e);
    ctx.fillStyle = `${p.txt}80`;
    ctx.fillText(rot, xc, yCampos);
    espacar(ctx, 0);

    // o valor encolhe até caber na própria coluna
    let tamVal = h * 0.056 * e;
    ctx.font = fonte(800, tamVal);
    const texto = cx(val);
    while (ctx.measureText(texto).width > larguraCol - h * 0.03 && tamVal > h * 0.026) {
      tamVal *= 0.93;
      ctx.font = fonte(800, tamVal);
    }
    ctx.fillStyle = p.txt;
    ctx.fillText(texto, xc, yCampos + h * 0.05);
  });

  if (cfg.portador) {
    ctx.font = fonte(600, h * 0.04 * e);
    ctx.fillStyle = `${p.txt}9a`;
    ctx.textAlign = 'left';
    ctx.fillText(`${cx('portador')}: ${cx(cfg.portador)}`, margem, h - margem * 0.55);
  }

  /* --- canhoto: setor, série e código de barras --- */
  const corCanhoto = contraste(p.a);
  ctx.save();
  ctx.translate(corte + canhoto / 2, h / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  espacar(ctx, h * 0.006);
  let tamSetor = h * 0.085 * e;
  ctx.font = fonte(800, tamSetor);
  const textoSetor = cx(cfg.setor || 'ADMIT ONE');
  while (ctx.measureText(textoSetor).width > canhoto * 0.86 && tamSetor > h * 0.03) {
    tamSetor *= 0.92;
    ctx.font = fonte(800, tamSetor);
  }
  ctx.fillStyle = corCanhoto;
  ctx.fillText(textoSetor, 0, -h * 0.22);
  espacar(ctx, 0);

  if (cfg.preco) {
    ctx.font = fonte(800, h * 0.1 * e);
    ctx.fillText(cx(cfg.preco), 0, -h * 0.06);
  }

  // código de barras decorativo, derivado da série (mesma série, mesmo padrão)
  const serie = cfg.serie || gerarSerie(cfg.titulo);
  const barras = 34;
  const larguraBarras = canhoto * 0.62;
  let semente = [...serie].reduce((a, c) => a + c.charCodeAt(0), 7);
  ctx.save();
  ctx.translate(-larguraBarras / 2, h * 0.08);
  for (let i = 0; i < barras; i += 1) {
    semente = (semente * 1103515245 + 12345) & 0x7fffffff;
    const larg = ((semente % 3) + 1) * (larguraBarras / barras / 2.4);
    ctx.fillStyle = `${corCanhoto}${semente % 2 ? 'ff' : '88'}`;
    ctx.fillRect((i * larguraBarras) / barras, 0, larg, h * 0.13);
  }
  ctx.restore();

  espacar(ctx, h * 0.01);
  ctx.font = fonte(700, h * 0.042 * e);
  ctx.fillStyle = `${corCanhoto}dd`;
  ctx.fillText(serie, 0, h * 0.3);
  espacar(ctx, 0);
  ctx.restore();
}

/** Série determinística: o mesmo ingresso gera sempre o mesmo código. */
export function gerarSerie(base = '') {
  const semente = [...String(base || 'KATSEYE')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l = letras[semente % 24] + letras[(semente >> 5) % 24];
  return `KE-${l}${String(semente % 100000).padStart(5, '0')}`;
}

/* ==========================================================
   RENDERIZAÇÃO
   ========================================================== */
/**
 * Desenha `cfg` num canvas e devolve o canvas.
 * `escala` 1 = tamanho de projeto; 2 ou 3 = exportação em alta.
 */
export async function renderizar(cfg, { escala = 1, canvas = null } = {}) {
  const f = acharFormato(cfg.formato);
  const p = { ...acharPaleta(cfg.paleta) };
  if (cfg.corIntegrante) { p.a = cfg.corIntegrante; }

  const w = f.l; const hgt = f.a;
  const c = canvas || document.createElement('canvas');
  c.width = Math.round(w * escala);
  c.height = Math.round(hgt * escala);
  const ctx = c.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  ctx.imageSmoothingQuality = 'high';

  const img = await carregarImagem(cfg.fotoDataURL);

  if (f.id === 'ingresso') desenharIngresso(ctx, cfg, w, hgt, p, img);
  else desenharCartaz(ctx, cfg, w, hgt, p, img);

  if (cfg.granulado) grao(ctx, w, hgt, 0.05);
  return c;
}

/** PNG pronto para baixar. */
export async function paraPNG(cfg, escala = 2) {
  const c = await renderizar(cfg, { escala });
  return c.toDataURL('image/png');
}

/**
 * Abre a janela de impressão com a arte no tamanho exato da página — é assim
 * que se gera o PDF sem carregar uma biblioteca: "Salvar como PDF" no diálogo
 * do próprio navegador, com a resolução de impressão preservada.
 */
export async function paraImpressao(cfg) {
  const f = acharFormato(cfg.formato);
  const url = await paraPNG(cfg, 3);
  const mm = (px) => `${((px / 150) * 25.4).toFixed(1)}mm`;   // projeto pensado a 150 dpi
  const janela = window.open('', '_blank');
  if (!janela) throw new Error('O navegador bloqueou a janela de impressão. Libere os pop-ups e tente de novo.');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${(cfg.titulo || 'KATSEYE Central').replace(/[<>]/g, '')}</title>
<style>
  @page { size: ${mm(f.l)} ${mm(f.a)}; margin: 0 }
  html,body { margin:0; padding:0; background:#fff }
  img { width:${mm(f.l)}; height:${mm(f.a)}; display:block }
  @media screen { body{background:#111;display:grid;place-items:center;min-height:100vh} img{max-width:92vw;height:auto} }
</style></head><body><img src="${url}" alt=""><script>
  const img = document.images[0];
  if (img.complete) setTimeout(() => window.print(), 250);
  else img.onload = () => setTimeout(() => window.print(), 250);
<\/script></body></html>`);
  janela.document.close();
}

export { FORMATOS, PALETAS };
