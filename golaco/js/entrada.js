// Entrada (DOM): teclado, controle (Gamepad API) e toque. Junta tudo numa saída por quadro
// {x, z, botoes} com o analógico JÁ no mundo (paraMundo com o yaw da câmera) e a máscara BOTAO.
// A máscara só diz "apertado agora": quem mede o tempo segurado (força do passe/chute) é a
// lógica. Um toque mais curto que um quadro não se perde: o aperto fica marcado (pulso) até um
// passo de simulação consumir (limparPulsos). Ações de um toque só (recomeçar, máquina,
// marcador, câmera, ajuda, pausa) vão para uma fila.
//
// Teclado: WASD/setas = analógico; J passe; K chute; L lançamento; I enfiada; Shift correr;
// E modificador (colocado / enfiada alta / cruzamento tenso; condução curta e proteção; dois
// toques = pedalada); Q trocar; G goleiro (segurar = sai do gol); R recomeçar; M máquina de
// passes; N marcador; C câmera; H ou F1 ajuda; Esc pausa.
// Controle: analógico esquerdo; A passe; B chute; X lançamento; Y enfiada (ataque) / goleiro
// (defesa, segurar); LB trocar; RT correr; LT modificador; Start pausa; View ajuda; R3 câmera.
// Toque: analógico flutuante na metade esquerda; à direita, um arco de botões ao alcance do
// polegar. ATAQUE (meu time com a bola): CHUTE (o maior), PASSE, ENFIADA, LANÇAMENTO e CORRER.
// DEFESA: TROCAR, GOLEIRO (segurar) e CORRER — as vagas que sobram no arco ficam para CONTER,
// DIVIDIDA, CARRINHO e PRESSÃO (Etapa 3). Quem decide ataque/defesa é o main.js (definirFase).

import { processarAnalogico, teclasParaAnalogico, paraMundo } from './controle.js';
import { BOTAO, ENTRADA } from './config.js';

const CHAVE_AJUSTES = 'golaco.toque.v1';
const SEM_ACOES = Object.freeze([]);
const ACOES_TECLA = {
  KeyR: 'recomecar', KeyM: 'maquina', KeyN: 'marcador', KeyC: 'camera',
  KeyH: 'ajuda', F1: 'ajuda', Escape: 'pausa', KeyP: 'pausa', F3: 'qps',
};
// tecla → bit da máscara (segurar = bit ligado)
const TECLA_BIT = {
  KeyJ: BOTAO.PASSE, KeyK: BOTAO.CHUTE, KeyL: BOTAO.LANCAMENTO, KeyI: BOTAO.ENFIADA,
  KeyQ: BOTAO.TROCAR, KeyG: BOTAO.GOLEIRO, KeyE: BOTAO.MOD,
  ShiftLeft: BOTAO.CORRER, ShiftRight: BOTAO.CORRER,
};
const MOV = {
  cima: ['KeyW', 'ArrowUp'], baixo: ['KeyS', 'ArrowDown'], esq: ['KeyA', 'ArrowLeft'], dir: ['KeyD', 'ArrowRight'],
};

// Controle padrão (Gamepad API "standard"): índice do botão → bit.
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, L3: 10, R3: 11 };

// Botões de toque: fase em que aparecem e vaga no arco. Vagas: 'grande' (canto, a mais fácil),
// 'a'..'e' no arco em volta dela (a = à esquerda, subindo até e), 'correr' (à esquerda da 'a'
// deitado; no topo do arco em pé). Etapa 3: CONTER, DIVIDIDA, CARRINHO e PRESSÃO entram nas
// vagas livres da defesa (b, c, d, e) — o arco já calcula 5 vagas sem encostar.
export const BOTOES_TOQUE = [
  { id: 'btn-chute', bit: 'CHUTE', fase: 'ataque', vaga: 'grande', rotulo: 'CHUTE' },
  { id: 'btn-passe', bit: 'PASSE', fase: 'ataque', vaga: 'a', rotulo: 'PASSE' },
  { id: 'btn-enfiada', bit: 'ENFIADA', fase: 'ataque', vaga: 'b', rotulo: 'ENFIADA' },
  { id: 'btn-lancamento', bit: 'LANCAMENTO', fase: 'ataque', vaga: 'c', rotulo: 'LANÇAMENTO' },
  { id: 'btn-trocar', bit: 'TROCAR', fase: 'defesa', vaga: 'grande', rotulo: 'TROCAR' },
  { id: 'btn-goleiro', bit: 'GOLEIRO', fase: 'defesa', vaga: 'a', rotulo: 'GOLEIRO' },
  { id: 'btn-correr', bit: 'CORRER', fase: 'ambas', vaga: 'correr', rotulo: 'CORRER' },
];
// diâmetro de cada vaga (px CSS com tamanho 100%); nada fica abaixo de 48 px
const DIAM = { grande: 104, a: 80, b: 72, c: 76, d: 68, e: 68, correr: 76 };
const MIN_ALVO = 48;

function lerAjustes() {
  try {
    const a = JSON.parse(localStorage.getItem(CHAVE_AJUSTES) || 'null');
    if (a && typeof a.tamanho === 'number' && typeof a.opacidade === 'number') {
      return { tamanho: Math.min(1.4, Math.max(0.7, a.tamanho)), opacidade: Math.min(1, Math.max(0.25, a.opacidade)) };
    }
  } catch (_) { /* sem armazenamento: usa o padrão */ }
  return { tamanho: 1, opacidade: 0.8 };
}

function salvarAjustes(a) {
  try { localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(a)); } catch (_) { /* sem armazenamento */ }
}

/**
 * Posições dos botões de toque (px CSS, centro e diâmetro) para uma tela W×H com margens
 * seguras sa = {l, r, t, b}, tamanho escolhido e as vagas usadas. Pura (os testes podem chamar).
 * Arco: cada botão tangencia a 'grande' com uma folga e o ângulo até o vizinho sai da
 * condição "corda entre os centros ≥ soma dos raios + folga" — nada encosta em nada.
 */
export function calcularLayoutToque(W, H, sa, tamanho = 1, vagas = ['grande', 'a', 'b', 'c', 'correr']) {
  const retrato = H > W;
  // tela pequena encolhe um pouco (o mínimo de 48 px vale sempre)
  const k = tamanho * (retrato ? Math.min(1, W / 430) : Math.min(1, H / 390));
  const diam = v => Math.max(MIN_ALVO, Math.round(DIAM[v] * k));
  const folga = Math.max(10, Math.round(13 * k));
  const borda = Math.max(12, Math.round(18 * k));
  const out = {};
  const Dg = diam('grande'), rg = Dg / 2;
  const cx = W - sa.r - borda - rg, cy = H - sa.b - borda - rg;
  out.grande = { x: cx, y: cy, d: Dg };
  // arco: ângulo matemático (y para cima) começando à esquerda, um pouco abaixo, subindo
  let ant = null;
  const arco = ['a', 'b', 'c', 'd', 'e'];
  const usados = arco.filter(v => vagas.includes(v));
  const angs = {};
  for (const v of usados) {
    const D = diam(v), r = D / 2;
    const R = rg + folga + r;
    let ang;
    if (!ant) {
      // base alinhada com a da grande
      ang = Math.PI + Math.asin(Math.min(1, Math.max(-1, (rg - r) / R)));
    } else {
      const precisa = ant.r + r + folga;
      const c = (ant.R * ant.R + R * R - precisa * precisa) / (2 * ant.R * R);
      ang = ant.ang - Math.acos(Math.min(1, Math.max(-1, c)));
    }
    out[v] = { x: cx + R * Math.cos(ang), y: cy - R * Math.sin(ang), d: D };
    angs[v] = ang;
    ant = { R, r, ang };
  }
  if (retrato && vagas.includes('correr')) {
    // em pé: CORRER num segundo anel, por cima do arco (à esquerda ficaria em cima do analógico)
    const D = diam('correr'), r = D / 2;
    const dArco = Math.max(...usados.map(v => out[v].d), 0);
    const R2 = rg + folga + dArco + folga + r;
    const lista = usados.map(v => angs[v]);
    const a2 = lista.length >= 2 ? (lista[lista.length - 1] + lista[lista.length - 2]) / 2 : (lista[0] ?? Math.PI * 0.75);
    let x = cx + R2 * Math.cos(a2);
    x = Math.max(sa.l + borda + r, Math.min(W - sa.r - borda - r, x));
    out.correr = { x, y: cy - R2 * Math.sin(a2), d: D };
  }
  if (!retrato && vagas.includes('correr')) {
    // deitado: CORRER à esquerda da 'a' (ou da grande), base alinhada
    const D = diam('correr'), r = D / 2;
    const viz = out.a ?? out.grande;
    const x = viz.x - viz.d / 2 - folga - r;
    out.correr = { x, y: cy + rg - r, d: D };
  }
  return out;
}

/**
 * opc = {forcarToque: bool, aoAcao(acao), aoMudarLayout()}. Devolve a interface da entrada.
 * aoMudarLayout: os controles de toque apareceram/sumiram (o HUD do topo se ajusta).
 */
export function criarEntrada(opc = {}) {
  const teclas = new Set();
  const fila = [];
  // ações saem na hora (menu, ajuda e câmera não esperam o próximo quadro); sem callback,
  // ficam na fila para consumirAcoes()
  const emitir = a => { if (opc.aoAcao) opc.aoAcao(a); else fila.push(a); };
  let usandoToque = !!opc.forcarToque || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let forcada = null;      // entrada injetada pelos testes
  let pulsos = 0;          // botões apertados desde o último passo (toque curto não se perde)
  let fase = 'ataque';     // pedida pelo main.js (estado do mundo)
  let faseVisivel = 'ataque';
  const ajustes = lerAjustes();

  // ---------------------------------------------------------------- teclado
  function ehMov(code) { return MOV.cima.includes(code) || MOV.baixo.includes(code) || MOV.esq.includes(code) || MOV.dir.includes(code); }
  window.addEventListener('keydown', e => {
    const code = e.code;
    const usado = ehMov(code) || TECLA_BIT[code] || ACOES_TECLA[code];
    if (usado) {
      // Ctrl + tecla do jogo não pode virar atalho do navegador (salvar, favoritos...)
      if (e.ctrlKey || code.startsWith('Arrow') || code === 'F1' || code === 'F3' || code === 'Space') e.preventDefault();
    }
    if (e.repeat) return;
    teclas.add(code);
    if (TECLA_BIT[code]) pulsos |= TECLA_BIT[code];
    if (ACOES_TECLA[code]) emitir(ACOES_TECLA[code]);
  });
  window.addEventListener('keyup', e => { teclas.delete(e.code); });
  window.addEventListener('blur', () => { teclas.clear(); });

  // cada fonte escreve no próprio objeto (nada é alocado por quadro além do que controle.js devolve)
  const fTec = { ax: 0, ay: 0, mag: 0, botoes: 0 };
  const fPad = { ax: 0, ay: 0, mag: 0, botoes: 0 };
  const fToq = { ax: 0, ay: 0, mag: 0, botoes: 0 };
  function temTecla(l) { for (let i = 0; i < l.length; i++) if (teclas.has(l[i])) return true; return false; }
  function lerTeclado() {
    const a = teclasParaAnalogico(temTecla(MOV.cima), temTecla(MOV.baixo), temTecla(MOV.esq), temTecla(MOV.dir));
    let b = 0;
    // modificador só no E: Ctrl + W fecharia a aba do navegador (o navegador não deixa impedir)
    for (const c of teclas) if (TECLA_BIT[c]) b |= TECLA_BIT[c];
    fTec.ax = a.x; fTec.ay = a.y; fTec.mag = a.mag; fTec.botoes = b;
    return fTec;
  }

  // ---------------------------------------------------------------- controle
  const antes = [];
  let bitY = 0;            // Y vale ENFIADA no ataque e GOLEIRO na defesa (fixado ao apertar)
  let gp = null;           // controle lido neste quadro
  let bPad = 0;            // máscara do controle sendo montada
  function apertado(i) { const x = gp.buttons[i]; return x ? x.value > 0.3 || x.pressed : false; }
  function segura(i, bit) {
    const p = apertado(i);
    if (p) { bPad |= bit; if (!antes[i]) pulsos |= bit; }
    antes[i] = p;
  }
  function borda(i, acao) { const p = apertado(i); if (p && !antes[i]) emitir(acao); antes[i] = p; }
  function lerControle() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : null;
    gp = null;
    if (lista) for (let i = 0; i < lista.length; i++) { const g = lista[i]; if (g && g.connected) { gp = g; break; } }
    if (!gp) return null;
    let ax = gp.axes[0] ?? 0, ay = -(gp.axes[1] ?? 0);
    // cruz digital como alternativa ao analógico
    const dc = apertado(12), db = apertado(13), de = apertado(14), dd = apertado(15);
    if (dc || db || de || dd) { const t = teclasParaAnalogico(dc, db, de, dd); ax = t.x; ay = t.y; }
    const a = processarAnalogico(ax, ay, ENTRADA.zonaMorta, ENTRADA.zonaExterna);
    bPad = 0;
    segura(PAD.RT, BOTAO.CORRER);
    segura(PAD.LT, BOTAO.MOD);
    segura(PAD.A, BOTAO.PASSE);
    segura(PAD.B, BOTAO.CHUTE);
    segura(PAD.X, BOTAO.LANCAMENTO);
    segura(PAD.LB, BOTAO.TROCAR);
    // Y: o sentido é decidido no aperto e vale até soltar (a posse pode mudar no meio)
    if (apertado(PAD.Y)) {
      if (!antes[PAD.Y]) { bitY = fase === 'defesa' ? BOTAO.GOLEIRO : BOTAO.ENFIADA; pulsos |= bitY; }
      bPad |= bitY;
      antes[PAD.Y] = true;
    } else { antes[PAD.Y] = false; bitY = 0; }
    borda(PAD.START, 'pausa'); borda(PAD.VIEW, 'ajuda'); borda(PAD.R3, 'camera');
    fPad.ax = a.x; fPad.ay = a.y; fPad.mag = a.mag; fPad.botoes = bPad;
    return fPad;
  }

  // ---------------------------------------------------------------- toque
  const raizToque = document.getElementById('toque');
  const zona = document.getElementById('zona-analogico');
  const base = document.getElementById('analogico');
  const pino = base ? base.querySelector('.analogico-pino') : null;
  const toque = { id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  // botões: elemento, bit e quem está segurando (pointerId)
  const bts = BOTOES_TOQUE.map(d => ({ ...d, el: document.getElementById(d.id), mask: BOTAO[d.bit] ?? 0, dedo: null }))
    .filter(b => b.el);

  function raioBase() { return 58 * ajustes.tamanho; }
  // margens seguras (entalhe) lidas das variáveis CSS calculadas
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);pointer-events:none;visibility:hidden';
  document.body.appendChild(sonda);
  function margensSeguras() {
    const r = sonda.getBoundingClientRect();
    return { l: r.left, t: r.top, r: window.innerWidth - r.right, b: window.innerHeight - r.bottom };
  }
  function posicionarBase(x, y, ativo) {
    if (!base) return;
    base.style.transform = `translate(${x}px, ${y}px)`;
    base.classList.toggle('ativo', ativo);
  }
  function posicionarPino(vx, vy) {
    if (!pino) return;
    const r = raioBase();
    pino.style.transform = `translate(${vx * r}px, ${-vy * r}px)`;
  }
  let ultimoPos = null;     // último layout dos botões (todas as vagas, das duas fases)
  function baseRepouso() {
    // posição de descanso (só a dica visual; o analógico é flutuante): canto inferior esquerdo,
    // dentro da área segura. Tela estreita em pé com botões grandes: sobe o que precisar para
    // não encostar em nenhuma vaga do arco (das duas fases: não pula quando a posse muda)
    if (!zona) return;
    const z = zona.getBoundingClientRect();
    const r = raioBase();
    const sa = margensSeguras();
    const x = Math.max(z.left, sa.l) + r + 26;
    let y = z.bottom - sa.b - r - 22;
    if (ultimoPos) {
      for (let volta = 0, mexeu = true; mexeu && volta < 8; volta++) {
        mexeu = false;
        for (const k in ultimoPos) {
          const p = ultimoPos[k], dmin = r + p.d / 2 + 8, dx = x - p.x;
          if (Math.abs(dx) < dmin && Math.hypot(dx, y - p.y) < dmin) {
            y = p.y - Math.sqrt(dmin * dmin - dx * dx) - 0.5;
            mexeu = true;
          }
        }
      }
    }
    posicionarBase(x, Math.max(y, z.top + r), false);
    posicionarPino(0, 0);
  }
  function limitarOrigem(x, y) {
    const z = zona.getBoundingClientRect();
    const r = raioBase();
    const sa = margensSeguras();
    const x0 = Math.max(z.left, sa.l) + r + 4, x1 = z.right - r * 0.5;
    const y0 = z.top + r * 0.5, y1 = z.bottom - sa.b - r - 4;
    return [Math.min(Math.max(x, x0), Math.max(x0, x1)), Math.min(Math.max(y, y0), Math.max(y0, y1))];
  }
  if (zona) {
    zona.addEventListener('pointerdown', e => {
      if (toque.id !== null) return;
      e.preventDefault();
      usandoToque = true;
      mostrarToque(true);
      toque.id = e.pointerId;
      [toque.ox, toque.oy] = limitarOrigem(e.clientX, e.clientY);
      toque.vx = toque.vy = 0;
      try { zona.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      posicionarBase(toque.ox, toque.oy, true);
      moverToque(e);
    });
    zona.addEventListener('pointermove', e => { if (e.pointerId === toque.id) { e.preventDefault(); moverToque(e); } });
    const soltar = e => {
      if (e.pointerId !== toque.id) return;
      toque.id = null; toque.vx = toque.vy = 0;
      baseRepouso();
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
    zona.addEventListener('lostpointercapture', soltar);
  }
  function moverToque(e) {
    const r = raioBase();
    let dx = (e.clientX - toque.ox) / r, dy = -(e.clientY - toque.oy) / r;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      // analógico flutuante: a base acompanha o dedo quando ele passa da borda
      const exc = (m - 1) * r;
      toque.ox += (dx / m) * exc; toque.oy -= (dy / m) * exc;
      [toque.ox, toque.oy] = limitarOrigem(toque.ox, toque.oy);
      dx = (e.clientX - toque.ox) / r; dy = -(e.clientY - toque.oy) / r;
      const m2 = Math.hypot(dx, dy);
      if (m2 > 1) { dx /= m2; dy /= m2; }
      posicionarBase(toque.ox, toque.oy, true);
    }
    toque.vx = dx; toque.vy = dy;
    posicionarPino(dx, dy);
  }
  function ligarBotao(b) {
    const el = b.el;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      usandoToque = true;
      b.dedo = e.pointerId;
      pulsos |= b.mask;
      el.classList.add('ativo');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    });
    const solta = e => {
      if (e.pointerId !== b.dedo) return;
      b.dedo = null;
      el.classList.remove('ativo');
      trocarFaseSePuder();
    };
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
    el.addEventListener('lostpointercapture', solta);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  for (const b of bts) ligarBotao(b);
  const btMenu = document.getElementById('btn-menu');
  if (btMenu) btMenu.addEventListener('click', () => emitir('pausa'));
  window.addEventListener('touchstart', () => { if (!usandoToque) { usandoToque = true; mostrarToque(true); } }, { passive: true });

  function lerToque() {
    let b = 0;
    for (const x of bts) if (x.dedo !== null) b |= x.mask;
    if (toque.id === null && !b) return null;
    const a = processarAnalogico(toque.vx, toque.vy, ENTRADA.zonaMorta, ENTRADA.zonaExterna);
    fToq.ax = a.x; fToq.ay = a.y; fToq.mag = a.mag; fToq.botoes = b;
    return fToq;
  }

  // Ataque × defesa: troca os botões visíveis. Um botão de uma fase que está sendo segurado
  // segura a troca até ser solto (o chute carregando não some debaixo do dedo).
  function trocarFaseSePuder(forcar = false) {
    if (fase === faseVisivel && !forcar) return;
    if (bts.some(b => b.dedo !== null && b.fase !== 'ambas')) return;
    faseVisivel = fase;
    if (raizToque) {
      raizToque.classList.toggle('fase-ataque', fase === 'ataque');
      raizToque.classList.toggle('fase-defesa', fase === 'defesa');
      raizToque.dataset.fase = fase;
    }
  }

  function layout() {
    if (!raizToque || raizToque.hidden) return;
    const W = window.innerWidth, H = window.innerHeight;
    const sa = margensSeguras();
    const vagas = [...new Set(bts.map(b => b.vaga))];
    const pos = calcularLayoutToque(W, H, sa, ajustes.tamanho, vagas);
    ultimoPos = pos;
    for (const b of bts) {
      const p = pos[b.vaga];
      if (!p) continue;
      const s = b.el.style;
      s.left = `${(p.x - p.d / 2).toFixed(1)}px`;
      s.top = `${(p.y - p.d / 2).toFixed(1)}px`;
      s.width = s.height = `${p.d}px`;
      // texto cabendo no círculo: palavra longa (LANÇAMENTO) com letra menor
      const n = b.rotulo.length;
      const longo = n > 8;
      const fs = Math.max(8.5, Math.min(p.d * 0.15, (p.d * 0.74) / (n * 0.66)));
      s.setProperty('--fs', `${fs.toFixed(1)}px`);
      s.setProperty('--ls', longo ? '0' : '0.04em');
      // palavra longa: ícone menor, para o rótulo subir para perto do centro (onde o círculo é
      // mais largo) e não encostar na borda
      s.setProperty('--ic', `${Math.round(p.d * (b.vaga === 'grande' ? 0.36 : longo ? 0.27 : 0.32))}px`);
    }
  }

  function aplicarAjustes() {
    const r = document.documentElement.style;
    r.setProperty('--toque-escala', String(ajustes.tamanho));
    r.setProperty('--toque-opacidade', String(ajustes.opacidade));
    layout();
    if (toque.id === null) baseRepouso();
  }
  function mostrarToque(v) {
    if (!raizToque) return;
    raizToque.hidden = !v;
    document.documentElement.classList.toggle('com-toque', v);
    if (v) { layout(); requestAnimationFrame(() => { layout(); baseRepouso(); if (opc.aoMudarLayout) opc.aoMudarLayout(); }); }
    else if (opc.aoMudarLayout) opc.aoMudarLayout();
  }
  if (raizToque) { raizToque.classList.add('fase-ataque'); raizToque.dataset.fase = 'ataque'; }
  aplicarAjustes();
  mostrarToque(usandoToque);
  const aoRedimensionar = () => { layout(); if (toque.id === null) baseRepouso(); };
  window.addEventListener('resize', aoRedimensionar);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', aoRedimensionar);

  const saida = { x: 0, z: 0, botoes: 0, ax: 0, ay: 0, mag: 0 };
  return {
    /** Lê todas as fontes. yaw = rumo da câmera no chão. botoes = apertados agora + pulsos. */
    ler(yaw) {
      if (forcada) {
        saida.x = forcada.x ?? 0; saida.z = forcada.z ?? 0; saida.botoes = (forcada.botoes ?? 0) | 0;
        saida.ax = saida.ay = 0; saida.mag = Math.hypot(saida.x, saida.z);
        return saida;
      }
      const t = lerTeclado(), c = lerControle(), q = lerToque();
      let ax = 0, ay = 0, mag = 0, botoes = 0;
      for (let i = 0; i < 3; i++) {
        const f = i === 0 ? t : i === 1 ? c : q;
        if (!f) continue;
        botoes |= f.botoes;
        if (f.mag > mag) { mag = f.mag; ax = f.ax; ay = f.ay; }
      }
      const w = paraMundo(ax, ay, yaw);
      saida.x = w.x; saida.z = w.z; saida.botoes = botoes | pulsos; saida.ax = ax; saida.ay = ay; saida.mag = mag;
      return saida;
    },
    /** Um passo de simulação usou a entrada: os apertos curtos já foram vistos. */
    limparPulsos() { pulsos = 0; },
    /** 'ataque' | 'defesa' (estado do mundo, decidido no main.js). */
    definirFase(f) {
      if (f !== 'ataque' && f !== 'defesa') return;
      fase = f;
      trocarFaseSePuder();
    },
    get fase() { return faseVisivel; },
    /** Reaplica no DOM a fase visível (testes que mexem nas classes à mão). */
    sincronizarFase() { trocarFaseSePuder(true); },
    /** Ações pendentes (recomecar, maquina, marcador, camera, ajuda, pausa, qps). */
    consumirAcoes() { return fila.length ? fila.splice(0) : SEM_ACOES; },
    empurrarAcao(a) { emitir(a); },
    forcar(e) { forcada = e; },
    get usandoToque() { return usandoToque; },
    mostrarToque,
    get ajustes() { return { ...ajustes }; },
    definirAjustes(a) {
      if (typeof a.tamanho === 'number') ajustes.tamanho = Math.min(1.4, Math.max(0.7, a.tamanho));
      if (typeof a.opacidade === 'number') ajustes.opacidade = Math.min(1, Math.max(0.25, a.opacidade));
      salvarAjustes(ajustes);
      aplicarAjustes();
    },
    /** Solta tudo (pausa, troca de aba). */
    soltarTudo() {
      teclas.clear();
      pulsos = 0;
      toque.id = null; toque.vx = toque.vy = 0;
      for (const b of bts) { b.dedo = null; b.el.classList.remove('ativo'); }
      trocarFaseSePuder();
      baseRepouso();
    },
  };
}
