/* ===== views/relogio.js — Cronômetro e Timer =====
   A tela (#/relogio) e o vigia do timer: ele toca no fim mesmo com o aluno em
   outra tela do app. O estado mora no store (st().relogio) por horário, então
   sobrevive a trocar de tela e a recarregar a página.                        */
import { h } from '../util.js';
import { st, set } from '../store.js';
import { titulo, cartao, toast, segmento } from '../ui.js';
import * as R from '../relogio.js';

const PRONTOS = [1, 3, 5, 10, 15, 25, 45, 60];   // minutos
let aba = 'cronometro';

const rel = () => {
  const r = st().relogio || {};
  return { cronometro: r.cronometro || R.cronometroNovo(), timer: r.timer || R.timerNovo() };
};
const salvar = (parte, valor) => set((s) => { s.relogio = { ...rel(), ...(s.relogio || {}), [parte]: valor }; });

/* ==========================================================
   A TELA
   ========================================================== */
export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  el.append(titulo('⏲️ Cronômetro e timer', 'Cronometre a sua lista de exercícios ou ponha um tempo para a tarefa.'));
  el.append(h('div', { class: 'mb' }, segmento(
    [{ v: 'cronometro', t: '⏱️ Cronômetro' }, { v: 'timer', t: '⏳ Timer' }],
    aba, (v) => { aba = v; pintar(); })));
  el.append(aba === 'timer' ? telaTimer(pintar) : telaCronometro(pintar));
}

const visor = () => h('div', {
  class: 'relogio-visor',
  style: {
    fontSize: 'clamp(54px, 15vw, 96px)', fontWeight: 800, letterSpacing: '-2px', textAlign: 'center',
    fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, margin: '10px 0 18px',
  },
});

/** Repinta o visor enquanto a tela está aberta (para sozinho quando ela sai). */
function animar(no, conta) {
  // o visor é criado antes de entrar na página: só para quando sai DEPOIS de ter entrado
  let entrou = false;
  const passo = () => {
    if (no.isConnected) entrou = true;
    else if (entrou) return;
    no.textContent = conta();
    requestAnimationFrame(passo);
  };
  passo();
}

/* ---------- cronômetro ---------- */
function telaCronometro(pintar) {
  const c = rel().cronometro;
  const v = visor();
  animar(v, () => R.formatar(R.tempoCronometro(rel().cronometro, Date.now()), { centesimos: true }));

  const voltas = R.listaVoltas(c);
  const zerado = !c.rodando && !c.acumulado;
  return cartao(
    v,
    h('div', { class: 'flexb', style: { justifyContent: 'center', flexWrap: 'wrap' } },
      c.rodando
        ? h('button', { class: 'btn', onclick: () => { salvar('cronometro', R.voltaCronometro(rel().cronometro, Date.now())); pintar(); } }, '🏁 Volta')
        : h('button', {
          class: 'btn', disabled: zerado,
          onclick: () => { salvar('cronometro', R.zerarCronometro()); pintar(); },
        }, '↺ Zerar'),
      c.rodando
        ? h('button', { class: 'btn btn--p', onclick: () => { salvar('cronometro', R.pausarCronometro(rel().cronometro, Date.now())); pintar(); } }, '⏸ Pausar')
        : h('button', {
          class: 'btn btn--p', onclick: () => { salvar('cronometro', R.iniciarCronometro(rel().cronometro, Date.now())); pintar(); },
        }, zerado ? '▶ Iniciar' : '▶ Continuar')),
    voltas.length
      ? h('div', { class: 'list mt2' }, ...voltas.map((x) => h('div', { class: 'row row--flat' },
        h('span', { class: 'small muted', style: { width: '64px' } }, `Volta ${x.n}`),
        h('b', { class: 'grow', style: { fontVariantNumeric: 'tabular-nums' } }, R.formatar(x.volta, { centesimos: true })),
        h('span', { class: 'tiny muted', style: { fontVariantNumeric: 'tabular-nums' } }, R.formatar(x.total, { centesimos: true })))))
      : h('p', { class: 'tiny muted center', style: { margin: '14px 0 0' } },
        'Dica: marque uma volta a cada questão para ver em qual você demora mais.'));
}

/* ---------- timer ---------- */
function telaTimer(pintar) {
  const t = rel().timer;
  const v = visor();
  animar(v, () => R.formatar(R.restanteTimer(rel().timer, Date.now()), { paraCima: true }));

  const minutos = h('input', { class: 'inp', type: 'number', min: 1, max: 1440, placeholder: 'min', style: { width: '86px' } });
  const parado = !t.rodando;
  const cheio = parado && t.restante === t.duracao;

  return cartao(
    v,
    h('div', { class: 'flexb', style: { justifyContent: 'center', flexWrap: 'wrap' } },
      h('button', {
        class: 'btn', disabled: cheio,
        onclick: () => { salvar('timer', R.reiniciarTimer(rel().timer)); pintar(); },
      }, '↺ Reiniciar'),
      t.rodando
        ? h('button', { class: 'btn btn--p', onclick: () => { salvar('timer', R.pausarTimer(rel().timer, Date.now())); pintar(); } }, '⏸ Pausar')
        : h('button', {
          class: 'btn btn--p', onclick: () => {
            prepararSom();
            salvar('timer', R.iniciarTimer(rel().timer, Date.now()));
            pintar();
          },
        }, cheio || t.tocou ? '▶ Iniciar' : '▶ Continuar'),
      h('button', { class: 'btn', onclick: () => { salvar('timer', R.somarTimer(rel().timer, 60000, Date.now())); pintar(); } }, '+1 min')),
    h('div', { class: 'mt2' },
      h('b', { class: 'small' }, 'Escolher o tempo'),
      h('div', { class: 'chips mt' }, ...PRONTOS.map((m) => h('button', {
        class: `chip ${t.duracao === m * 60000 ? 'chip--on' : ''}`, style: { cursor: 'pointer' },
        onclick: () => { salvar('timer', R.definirTimer(rel().timer, m * 60000)); pintar(); },
      }, m < 60 ? `${m} min` : '1 h'))),
      h('div', { class: 'flexb mt' }, minutos,
        h('button', {
          class: 'btn btn--sm', onclick: () => {
            const m = Number(minutos.value);
            if (!(m >= 1 && m <= 1440)) return toast('Escolha de 1 a 1440 minutos', 'bad');
            salvar('timer', R.definirTimer(rel().timer, m * 60000));
            pintar();
          },
        }, 'Usar'))),
    h('p', { class: 'tiny muted', style: { margin: '12px 0 0' } },
      'O timer continua contando se você for para outra tela do app e toca quando acabar. Com o app fechado ele para de tocar, mas o tempo segue certo quando você volta.'));
}

/* ==========================================================
   O SOM E O AVISO DE FIM
   ========================================================== */
let ctx = null, tocando = null, vigia = null;

/** O navegador só deixa tocar som depois de um toque do usuário: o Iniciar prepara o áudio. */
function prepararSom() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sem áudio: o aviso ainda cobre a tela e vibra */ }
}

/** Bipe gerado na hora (sem arquivo): 3 bipes, pausa, repete. */
function tocarSom(segundos = 30) {
  prepararSom();
  if (!ctx) return () => {};
  const ganho = ctx.createGain();
  ganho.gain.value = 0;
  ganho.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 880;
  osc.connect(ganho);
  const t0 = ctx.currentTime + 0.05;
  for (let s = 0; s < segundos; s += 1.2) {
    for (let b = 0; b < 3; b++) {
      const t = t0 + s + b * 0.18;
      ganho.gain.setValueAtTime(0, t);
      ganho.gain.linearRampToValueAtTime(0.18, t + 0.01);
      ganho.gain.setValueAtTime(0.18, t + 0.1);
      ganho.gain.linearRampToValueAtTime(0, t + 0.12);
    }
  }
  osc.start(t0);
  osc.stop(t0 + segundos);
  return () => { try { osc.stop(); osc.disconnect(); ganho.disconnect(); } catch { /* ok */ } };
}

function avisarFim() {
  if (tocando) return;
  const parar = tocarSom(30);
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { /* ok */ }
  const fechar = () => {
    parar();
    try { navigator.vibrate?.(0); } catch { /* ok */ }
    tela.remove();
    tocando = null;
  };
  const tela = h('div', { class: 'focus-full', role: 'alertdialog', 'aria-label': 'Timer', style: { zIndex: 95 } },
    h('div', { style: { fontSize: '64px' } }, '⏳'),
    h('h1', {}, 'Tempo esgotado!'),
    h('div', { class: 'flexb', style: { flexWrap: 'wrap', justifyContent: 'center' } },
      h('button', {
        class: 'btn', onclick: () => {
          salvar('timer', R.iniciarTimer(R.somarTimer(rel().timer, 60000, Date.now()), Date.now()));
          fechar();
        },
      }, '+1 min'),
      h('button', { class: 'btn btn--p', onclick: fechar }, 'Parar')));
  document.body.append(tela);
  tocando = { fechar };
}

function conferir() {
  const t = rel().timer;
  if (!R.timerAcabou(t, Date.now())) return;
  salvar('timer', R.marcarTocou(t));
  avisarFim();
}

/** Liga o vigia do timer (uma vez, no início do app). */
export function iniciarRelogio() {
  if (vigia) return;
  conferir();
  vigia = setInterval(conferir, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) conferir(); });
}
