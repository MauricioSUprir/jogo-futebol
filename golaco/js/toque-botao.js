// Botões de tela pelo toque (DOM). O navegador só gera o 'click' de um toque quando nenhum outro dedo está na tela: com o
// polegar no analógico, um dedo segurando o CORRER ou outro dedo parado na janela da pausa, o ≡, o Continuar, os chips, o
// "Editar time" e o "Pular" do pré-jogo recebiam pointerdown e pointerup, mas o click nunca vinha (dono, 12/10: "ainda
// tem botões que não funcionam"; medido com toque de verdade pelo CDP, 844×390). Os botões do jogo já agiam no
// pointerdown (entrada.js ligarBotao) e funcionavam com vários dedos.
//  - aoTocar(el, fn): age no pointerup do MESMO dedo que desceu em `el`, ainda dentro do elemento tocado (como um click),
//    e engole o click que vier depois desse toque; mouse e teclado continuam pelo click. fn recebe {target} (o elemento
//    tocado: quem delega pelo closest() funciona igual).
//  - engolirClique(e): uma camada que some no pointerdown (pular o replay, avançar o pré-jogo, fundo da pausa) engole o
//    click do mesmo toque — senão ele caía no que ficou embaixo (o ≡ no canto, e a pausa abria de novo). Com o evento do
//    pointerdown, o click é engolido enquanto aquele dedo está na tela e até JANELA_MS depois de ele sair (o click vem
//    logo depois do pointerup, por mais que o dedo fique na tela).
const JANELA_MS = 450;   // o click do mesmo toque chega logo depois do pointerup (ms, relógio do navegador)
const DEDO_MAX_MS = 8000; // um dedo marcado cujo pointerup nunca veio deixa de engolir depois disto
const FOLGA_PX = 10;     // o dedo pode escorregar um pouco para fora do botão, como no click
let engolirAte = 0;
const dedos = new Map(); // pointerId → quando desceu (dedos de camadas que sumiram no pointerdown)
let instalado = false;

function engolindo() {
  const agora = performance.now();
  if (agora < engolirAte) return true;
  for (const [id, t] of dedos) { if (agora - t < DEDO_MAX_MS) return true; dedos.delete(id); }
  return false;
}

function instalar() {
  if (instalado || typeof document === 'undefined') return;
  instalado = true;
  // na captura, antes de qualquer ouvinte: o click do toque que já agiu não chega a ninguém
  document.addEventListener('click', e => {
    if (engolindo()) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  // o dedo marcado saiu da tela: o click dele ainda vem logo depois
  const saiu = e => { if (dedos.delete(e.pointerId)) engolirAte = Math.max(engolirAte, performance.now() + JANELA_MS); };
  window.addEventListener('pointerup', saiu, true);
  window.addEventListener('pointercancel', saiu, true);
}

/**
 * O click do toque que acabou de agir não chega a ninguém: com o evento do pointerdown (camada que some no toque), enquanto
 * aquele dedo está na tela e até JANELA_MS depois de ele sair; sem evento, nos próximos JANELA_MS.
 */
export function engolirClique(e = null) {
  instalar();
  if (e && e.pointerId != null && e.type === 'pointerdown') dedos.set(e.pointerId, performance.now());
  else engolirAte = Math.max(engolirAte, performance.now() + JANELA_MS);
}

/** Dentro do elemento (com folga): o dedo saiu da tela em cima dele. */
function dentro(alvo, x, y) {
  const el = alvo.closest?.('button, a, input, label, [role="button"], [data-cmd], [data-valor]') ?? alvo;
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false; // escondido no meio do toque
  return x >= r.left - FOLGA_PX && x <= r.right + FOLGA_PX && y >= r.top - FOLGA_PX && y <= r.bottom + FOLGA_PX;
}

/**
 * Liga `fn` ao toque (pointerup do mesmo dedo, dentro do elemento tocado) e ao click (mouse, teclado, element.click()).
 * Um toque age uma vez só: o click que o navegador ainda gerar depois dele é engolido.
 */
export function aoTocar(el, fn) {
  if (!el) return;
  instalar();
  let dedo = null, alvo = null;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || (e.button ?? 0) > 0) return;
    dedo = e.pointerId; alvo = e.target;
  });
  const solta = e => {
    if (e.pointerId !== dedo) return;
    const a = alvo;
    dedo = null; alvo = null;
    // o sistema tomou o toque (rolagem, gesto da borda): não é um toque no botão
    if (e.type !== 'pointerup' || !a || !dentro(a, e.clientX, e.clientY)) return;
    engolirClique();
    fn({ target: a, toque: true });
  };
  el.addEventListener('pointerup', solta);
  el.addEventListener('pointercancel', solta);
  el.addEventListener('click', e => fn(e));
}
