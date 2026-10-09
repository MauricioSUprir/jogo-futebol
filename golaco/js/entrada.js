// Entrada (DOM): teclado, controle (Gamepad API) e toque. Junta tudo numa saída por quadro
// {x, z, botoes} com o analógico JÁ no mundo (paraMundo com o yaw da câmera) e a máscara BOTAO.
// Ações de um toque só (recomeçar, máquina, marcador, câmera, ajuda, pausa) vão para uma fila.
//
// Teclado: WASD/setas = analógico; Shift = CORRER; E = MODIFICADOR (condução curta /
// proteção / drible; dois toques rápidos = pedalada); R recomeçar; M máquina de passes; N
// marcador; C câmera; H ou F1 ajuda; Esc pausa. J/K/L/I ficam reservadas (passe, chute,
// lançamento e enfiada nas próximas etapas).
// Controle: analógico esquerdo, RT correr, LT modificador, Start pausa, Y máquina, X marcador,
// Select/View ajuda, R3 câmera.
// Toque: analógico flutuante na metade esquerda (nasce onde o dedo encosta e acompanha o dedo),
// botões CORRER e CONDUÇÃO à direita, botão de menu no topo.

import { processarAnalogico, teclasParaAnalogico, paraMundo } from './controle.js';
import { BOTAO, ENTRADA } from './config.js';

const CHAVE_AJUSTES = 'golaco.toque.v1';
const RESERVADAS = new Set(['KeyJ', 'KeyK', 'KeyL', 'KeyI']);
const ACOES_TECLA = {
  KeyR: 'recomecar', KeyM: 'maquina', KeyN: 'marcador', KeyC: 'camera',
  KeyH: 'ajuda', F1: 'ajuda', Escape: 'pausa', KeyP: 'pausa', F3: 'qps',
};
const MOV = {
  cima: ['KeyW', 'ArrowUp'], baixo: ['KeyS', 'ArrowDown'], esq: ['KeyA', 'ArrowLeft'], dir: ['KeyD', 'ArrowRight'],
};

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
 * opc = {forcarToque: bool, aoAcao(acao)}. Devolve a interface da entrada.
 */
export function criarEntrada(opc = {}) {
  const teclas = new Set();
  const fila = [];
  // ações saem na hora (menu, ajuda e câmera não esperam o próximo quadro); sem callback,
  // ficam na fila para consumirAcoes()
  const emitir = a => { if (opc.aoAcao) opc.aoAcao(a); else fila.push(a); };
  let usandoToque = !!opc.forcarToque || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let forcada = null;      // entrada injetada pelos testes
  const ajustes = lerAjustes();

  // ---------------------------------------------------------------- teclado
  function ehMov(code) { return MOV.cima.includes(code) || MOV.baixo.includes(code) || MOV.esq.includes(code) || MOV.dir.includes(code); }
  window.addEventListener('keydown', e => {
    const code = e.code;
    const usado = ehMov(code) || code.startsWith('Shift') || code === 'KeyE' || ACOES_TECLA[code] || RESERVADAS.has(code);
    if (usado) {
      // Ctrl + tecla do jogo não pode virar atalho do navegador (salvar, favoritos...)
      if (e.ctrlKey || code.startsWith('Arrow') || code === 'F1' || code === 'F3' || code === 'Space') e.preventDefault();
    }
    if (e.repeat) return;
    teclas.add(code);
    if (ACOES_TECLA[code]) emitir(ACOES_TECLA[code]);
  });
  window.addEventListener('keyup', e => { teclas.delete(e.code); });
  window.addEventListener('blur', () => { teclas.clear(); });

  function lerTeclado() {
    const tem = l => l.some(c => teclas.has(c));
    const a = teclasParaAnalogico(tem(MOV.cima), tem(MOV.baixo), tem(MOV.esq), tem(MOV.dir));
    let b = 0;
    if (teclas.has('ShiftLeft') || teclas.has('ShiftRight')) b |= BOTAO.CORRER;
    // modificador só no E: Ctrl + W fecharia a aba do navegador (o navegador não deixa impedir)
    if (teclas.has('KeyE')) b |= BOTAO.MOD;
    return { ax: a.x, ay: a.y, mag: a.mag, botoes: b };
  }

  // ---------------------------------------------------------------- controle
  const antes = [];
  function lerControle() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const g of lista) if (g && g.connected) { gp = g; break; }
    if (!gp) return null;
    const bt = i => gp.buttons[i] ? gp.buttons[i].value > 0.3 || gp.buttons[i].pressed : false;
    let ax = gp.axes[0] ?? 0, ay = -(gp.axes[1] ?? 0);
    // cruz digital como alternativa ao analógico
    const dc = bt(12), db = bt(13), de = bt(14), dd = bt(15);
    if (dc || db || de || dd) { const t = teclasParaAnalogico(dc, db, de, dd); ax = t.x; ay = t.y; }
    const a = processarAnalogico(ax, ay, ENTRADA.zonaMorta, ENTRADA.zonaExterna);
    let b = 0;
    if (bt(7)) b |= BOTAO.CORRER;
    if (bt(6)) b |= BOTAO.MOD;
    const borda = (i, acao) => { const p = bt(i); if (p && !antes[i]) emitir(acao); antes[i] = p; };
    borda(9, 'pausa'); borda(3, 'maquina'); borda(2, 'marcador'); borda(8, 'ajuda'); borda(11, 'camera');
    return { ax: a.x, ay: a.y, mag: a.mag, botoes: b };
  }

  // ---------------------------------------------------------------- toque
  const raizToque = document.getElementById('toque');
  const zona = document.getElementById('zona-analogico');
  const base = document.getElementById('analogico');
  const pino = base ? base.querySelector('.analogico-pino') : null;
  const btCorrer = document.getElementById('btn-correr');
  const btMod = document.getElementById('btn-mod');
  const toque = { id: null, ox: 0, oy: 0, vx: 0, vy: 0, correr: false, mod: false, idCorrer: null, idMod: null };

  function raioBase() { return 58 * ajustes.tamanho; }
  // margens seguras (entalhe) lidas das variáveis CSS calculadas
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:fixed;left:var(--sa-l);bottom:var(--sa-b);width:0;height:0;pointer-events:none;visibility:hidden';
  document.body.appendChild(sonda);
  function margensSeguras() {
    const r = sonda.getBoundingClientRect();
    return { l: r.left, b: window.innerHeight - r.bottom };
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
  function baseRepouso() {
    // posição de descanso (só a dica visual): canto inferior esquerdo, dentro da área segura
    if (!zona) return;
    const z = zona.getBoundingClientRect();
    const r = raioBase();
    const sa = margensSeguras();
    posicionarBase(Math.max(z.left, sa.l) + r + 26, z.bottom - sa.b - r - 22, false);
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
  function ligarBotao(el, chave, chaveId) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      usandoToque = true;
      toque[chave] = true; toque[chaveId] = e.pointerId;
      el.classList.add('ativo');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    });
    const solta = e => {
      if (e.pointerId !== toque[chaveId]) return;
      toque[chave] = false; toque[chaveId] = null;
      el.classList.remove('ativo');
    };
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
    el.addEventListener('lostpointercapture', solta);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  ligarBotao(btCorrer, 'correr', 'idCorrer');
  ligarBotao(btMod, 'mod', 'idMod');
  const btMenu = document.getElementById('btn-menu');
  if (btMenu) btMenu.addEventListener('click', () => emitir('pausa'));
  window.addEventListener('touchstart', () => { if (!usandoToque) { usandoToque = true; mostrarToque(true); } }, { passive: true });

  function lerToque() {
    if (toque.id === null && !toque.correr && !toque.mod) return null;
    const a = processarAnalogico(toque.vx, toque.vy, ENTRADA.zonaMorta, ENTRADA.zonaExterna);
    let b = 0;
    if (toque.correr) b |= BOTAO.CORRER;
    if (toque.mod) b |= BOTAO.MOD;
    return { ax: a.x, ay: a.y, mag: a.mag, botoes: b };
  }

  function aplicarAjustes() {
    const r = document.documentElement.style;
    r.setProperty('--toque-escala', String(ajustes.tamanho));
    r.setProperty('--toque-opacidade', String(ajustes.opacidade));
    if (toque.id === null) baseRepouso();
  }
  function mostrarToque(v) {
    if (!raizToque) return;
    raizToque.hidden = !v;
    document.documentElement.classList.toggle('com-toque', v);
    if (v) requestAnimationFrame(baseRepouso);
  }
  aplicarAjustes();
  mostrarToque(usandoToque);
  window.addEventListener('resize', () => { if (toque.id === null) baseRepouso(); });

  const saida = { x: 0, z: 0, botoes: 0, ax: 0, ay: 0, mag: 0 };
  return {
    /** Lê todas as fontes. yaw = rumo da câmera no chão. */
    ler(yaw) {
      if (forcada) {
        saida.x = forcada.x ?? 0; saida.z = forcada.z ?? 0; saida.botoes = forcada.botoes ?? 0;
        saida.ax = saida.ay = 0; saida.mag = Math.hypot(saida.x, saida.z);
        return saida;
      }
      const fontes = [lerTeclado(), lerControle(), lerToque()];
      let ax = 0, ay = 0, mag = 0, botoes = 0;
      for (const f of fontes) {
        if (!f) continue;
        botoes |= f.botoes;
        if (f.mag > mag) { mag = f.mag; ax = f.ax; ay = f.ay; }
      }
      const w = paraMundo(ax, ay, yaw);
      saida.x = w.x; saida.z = w.z; saida.botoes = botoes; saida.ax = ax; saida.ay = ay; saida.mag = mag;
      return saida;
    },
    /** Ações pendentes (recomecar, maquina, marcador, camera, ajuda, pausa, qps). */
    consumirAcoes() { return fila.splice(0); },
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
      toque.id = null; toque.vx = toque.vy = 0; toque.correr = toque.mod = false;
      btCorrer?.classList.remove('ativo'); btMod?.classList.remove('ativo');
      baseRepouso();
    },
  };
}
