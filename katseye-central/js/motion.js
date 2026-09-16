/* ===== motion.js — camada de animação do app =====
   O papel que o Framer Motion faria em React, aqui feito com a Web Animations
   API (`Element.animate`), que já vem no navegador. Zero dependência, zero
   build, e uma única regra: se a pessoa pediu menos movimento (preferência do
   sistema ou chave nas Configurações), nada disso roda — a tela aparece pronta.

   Uso típico:
     entrada(el)                     um elemento sobe e aparece
     cascata(container.children)     a lista inteira entra em sequência
     contar(el, 0, 42)               número correndo até o valor
     revelar(el)                     anima quando entra na tela (scroll)
     pulsar(el)                      chamar atenção depois de uma ação
*/

/* ---------- curvas ---------- */
export const CURVAS = {
  suave: 'cubic-bezier(.4,0,.2,1)',
  saida: 'cubic-bezier(.4,0,1,1)',
  mola: 'cubic-bezier(.34,1.32,.64,1)',
  firme: 'cubic-bezier(.65,0,.35,1)',
};

/** Respeita tanto a preferência do sistema quanto a chave das Configurações. */
export function movimentoReduzido() {
  if (document.documentElement.dataset.movimento === 'off') return true;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** `el.animate` com escape: devolve uma animação "vazia" quando não há movimento. */
function anima(el, quadros, opcoes) {
  if (!el || !el.animate) return null;
  if (movimentoReduzido()) {
    // aplica direto o estado final, sem transição
    const fim = Array.isArray(quadros) ? quadros[quadros.length - 1] : null;
    if (fim) for (const [k, v] of Object.entries(fim)) { try { el.style[k] = v; } catch { /* ignora */ } }
    return null;
  }
  try { return el.animate(quadros, { fill: 'both', ...opcoes }); } catch { return null; }
}

/* ---------- entradas ---------- */
/** Sobe e aparece. `de` aceita 'baixo' | 'cima' | 'esquerda' | 'direita' | 'escala'. */
export function entrada(el, { de = 'baixo', distancia = 12, atraso = 0, duracao = 320 } = {}) {
  const origem = {
    baixo: `translateY(${distancia}px)`,
    cima: `translateY(-${distancia}px)`,
    esquerda: `translateX(-${distancia}px)`,
    direita: `translateX(${distancia}px)`,
    escala: 'scale(.96)',
  }[de] || `translateY(${distancia}px)`;
  return anima(el, [
    { opacity: 0, transform: origem },
    { opacity: 1, transform: 'none' },
  ], { duration: duracao, delay: atraso, easing: CURVAS.suave });
}

/** A mesma entrada, aplicada em sequência: o "stagger". */
export function cascata(elementos, { passo = 45, inicio = 0, ...resto } = {}) {
  const lista = [...(elementos || [])];
  lista.forEach((el, i) => entrada(el, { atraso: inicio + i * passo, ...resto }));
  return lista.length;
}

/** Saída suave — devolve uma Promise que resolve quando terminou. */
export function saida(el, { duracao = 180 } = {}) {
  const a = anima(el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-6px)' }],
    { duration: duracao, easing: CURVAS.saida });
  return a ? a.finished.catch(() => {}) : Promise.resolve();
}

/* ---------- reações ---------- */
/** Um pulso rápido: confirma visualmente que algo aconteceu ali. */
export function pulsar(el, { cor = 'rgba(168,85,247,.45)' } = {}) {
  return anima(el, [
    { boxShadow: `0 0 0 0 ${cor}` },
    { boxShadow: `0 0 0 10px ${cor.replace(/[\d.]+\)$/, '0)')}` },
  ], { duration: 620, easing: CURVAS.saida });
}

/** Tremida curta — erro de validação, campo obrigatório vazio. */
export function tremer(el) {
  return anima(el, [
    { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
    { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' },
  ], { duration: 300, easing: CURVAS.firme });
}

/* ---------- números ---------- */
/**
 * Conta de `de` até `ate` dentro do elemento. Usa requestAnimationFrame e
 * respeita movimento reduzido (nesse caso escreve o valor final direto).
 */
export function contar(el, de, ate, { duracao = 700, formato = (v) => String(Math.round(v)) } = {}) {
  if (!el) return;
  if (movimentoReduzido() || de === ate) { el.textContent = formato(ate); return; }
  const t0 = performance.now();
  const passo = (t) => {
    const p = Math.min(1, (t - t0) / duracao);
    const e = 1 - (1 - p) ** 3;                    // easeOutCubic
    el.textContent = formato(de + (ate - de) * e);
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/** Barra de progresso que cresce da esquerda até `valor` (0..100). */
export function crescer(barraInterna, valor) {
  if (!barraInterna) return;
  const alvo = `${Math.max(0, Math.min(100, valor))}%`;
  if (movimentoReduzido()) { barraInterna.style.width = alvo; return; }
  barraInterna.style.width = '0%';
  requestAnimationFrame(() => { barraInterna.style.width = alvo; });
}

/* ---------- scroll ---------- */
let observador = null;
/**
 * Anima o elemento quando ele entra na tela. Um observador só para o app
 * inteiro; cada elemento é desobservado assim que aparece (anima uma vez).
 */
export function revelar(el, opcoes = {}) {
  if (!el) return;
  if (movimentoReduzido()) return;
  if (!observador) {
    observador = new IntersectionObserver((itens) => {
      for (const it of itens) {
        if (!it.isIntersecting) continue;
        const cfg = it.target.__motion || {};
        entrada(it.target, cfg);
        observador.unobserve(it.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  }
  el.__motion = opcoes;
  el.style.opacity = '0';
  observador.observe(el);
}

/** Aplica `revelar` em todos os filhos diretos, em cascata. */
export function revelarFilhos(container, { passo = 40, ...resto } = {}) {
  [...(container?.children || [])].forEach((el, i) => revelar(el, { atraso: i * passo, ...resto }));
}

/** Limpa o observador — chamado na troca de rota para não vazar nós antigos. */
export function limparRevelar() {
  if (observador) { observador.disconnect(); observador = null; }
}

/* ---------- transição de tela ---------- */
/** Fade + leve subida ao trocar de rota. */
export function trocaDeTela(container) {
  return anima(container, [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 260, easing: CURVAS.suave });
}
