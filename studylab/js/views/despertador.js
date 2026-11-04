/* ===== views/despertador.js — despertador do MindTrack AI =====
   A tela (#/despertador) e o tocador, que confere os alarmes a cada 10 s
   enquanto o app está aberto e, na hora, cobre a tela, toca e vibra.        */
import { h, uid } from '../util.js';
import { st, set } from '../store.js';
import { titulo, cartao, vazio, toast, confirmar } from '../ui.js';
import {
  DIAS_CURTOS, SONECA_MIN, devemTocar, aposTocar, soneca, proximoToque, faltaTexto, descreverDias, horaValida,
} from '../despertador.js';

const atalhos = [
  { rot: 'Dias de semana', dias: [1, 2, 3, 4, 5] },
  { rot: 'Todo dia', dias: [0, 1, 2, 3, 4, 5, 6] },
  { rot: 'Fim de semana', dias: [0, 6] },
  { rot: 'Uma vez', dias: [] },
];
const lista = () => st().despertadores || [];
const salvarAlarme = (a) => set((s) => {
  s.despertadores ||= [];
  const i = s.despertadores.findIndex((x) => x.id === a.id);
  if (i >= 0) s.despertadores[i] = a; else s.despertadores.push(a);
});

/* ==========================================================
   A TELA
   ========================================================== */
export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
  // atualiza o "toca em ..." a cada 30 s enquanto a tela está aberta
  const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); pintar(); }, 30000);
}

function montar(el, pintar) {
  el.append(titulo('⏰ Despertador', 'Hora de estudar, de acordar ou de revisar — o MindTrack te chama.'));
  el.append(formulario(pintar));

  const alarmes = [...lista()].sort((a, b) => a.hora.localeCompare(b.hora));
  if (!alarmes.length) {
    el.append(h('div', { class: 'mt2' }, vazio('Nenhum despertador ainda', 'Escolha a hora acima e toque em "Criar despertador".')));
  } else {
    el.append(h('div', { class: 'list mt2' }, ...alarmes.map((a) => linhaAlarme(a, pintar))));
  }
  el.append(h('div', { class: 'mt2' }, cartaoAvisos(pintar)));
}

function formulario(pintar) {
  let dias = [1, 2, 3, 4, 5];
  const hora = h('input', { class: 'inp', type: 'time', value: '07:00', style: { fontSize: '22px', maxWidth: '150px' } });
  const rotulo = h('input', { class: 'inp', placeholder: 'Nome (ex.: Hora de estudar)', maxlength: 40 });
  const chipsDias = h('div', { class: 'chips' });
  const chipsAtalho = h('div', { class: 'chips' });
  const pintarDias = () => {
    chipsDias.replaceChildren(...DIAS_CURTOS.map((d, i) => h('button', {
      class: `chip ${dias.includes(i) ? 'chip--on' : ''}`, style: { cursor: 'pointer' },
      onclick: () => { dias = dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i]; pintarDias(); },
    }, d)));
    chipsAtalho.replaceChildren(...atalhos.map((at) => h('button', {
      class: `chip ${descreverDias(dias) === at.rot ? 'chip--on' : ''}`, style: { cursor: 'pointer' },
      onclick: () => { dias = [...at.dias]; pintarDias(); },
    }, at.rot)));
  };
  pintarDias();

  return cartao(
    h('b', {}, '➕ Novo despertador'),
    h('div', { class: 'flexb mt', style: { flexWrap: 'wrap' } }, hora, rotulo),
    h('div', { class: 'mt' }, chipsAtalho),
    h('div', { class: 'mt' }, chipsDias),
    h('div', { class: 'flexb mt' },
      h('button', { class: 'btn', onclick: () => tocarSom(1.6) }, '🔊 Testar som'),
      h('button', {
        class: 'btn btn--p sp', onclick: () => {
          if (!horaValida(hora.value)) return toast('Escolha a hora', 'bad');
          const a = {
            id: uid('alarme'), hora: hora.value, dias: [...dias].sort(),
            rotulo: rotulo.value.trim() || 'Hora de estudar', ativo: true, ultimo: null, sonecaAte: null,
          };
          salvarAlarme(a);
          primeiroToque();
          toast(`Despertador criado — toca ${faltaTexto(proximoToque(a, new Date()), new Date())} ⏰`, 'good');
          pintar();
        },
      }, 'Criar despertador')));
}

function linhaAlarme(a, pintar) {
  const prox = proximoToque(a, new Date());
  return h('div', { class: 'row', style: { opacity: a.ativo ? 1 : 0.55 } },
    h('div', { class: 'grow' },
      h('div', { style: { fontSize: '26px', fontWeight: 800, letterSpacing: '-.5px' } }, a.hora),
      h('div', { class: 'small' }, `${a.rotulo} · ${descreverDias(a.dias)}`),
      h('div', { class: 'tiny muted' }, a.ativo
        ? (a.sonecaAte ? `😴 soneca — toca ${faltaTexto(prox, new Date())}` : `toca ${faltaTexto(prox, new Date())}`)
        : 'desligado')),
    h('button', {
      class: `btn btn--sm ${a.ativo ? 'btn--p' : ''}`,
      onclick: () => { salvarAlarme({ ...a, ativo: !a.ativo, sonecaAte: null }); pintar(); },
    }, a.ativo ? 'Ligado' : 'Desligado'),
    h('button', {
      class: 'icon-btn', title: 'Apagar',
      onclick: () => confirmar('Apagar este despertador?', `${a.hora} · ${a.rotulo}`, () => {
        set((s) => { s.despertadores = (s.despertadores || []).filter((x) => x.id !== a.id); });
        pintar();
      }),
    }, '🗑️'));
}

function cartaoAvisos(pintar) {
  const suporta = 'Notification' in window;
  const permissao = suporta ? Notification.permission : 'indisponivel';
  return cartao(
    h('b', { class: 'small' }, '📌 Para não perder o despertador'),
    h('ul', { class: 'small', style: { paddingLeft: '18px', margin: '6px 0 0', lineHeight: 1.7 } },
      h('li', {}, 'Ele toca com o MindTrack AI ', h('b', {}, 'aberto'), ' (pode ser em outra aba ou com a tela do app ao fundo).'),
      h('li', {}, 'Com o app fechado de vez, o navegador não deixa nenhum site tocar — para acordar com o celular desligado da tela, use também o alarme do próprio celular.'),
      h('li', {}, 'Instale o app na tela de início (menu do navegador → "Adicionar à tela inicial") para ele ficar mais à mão.')),
    suporta && permissao === 'default'
      ? h('button', {
        class: 'btn btn--blk mt', onclick: async () => {
          const r = await Notification.requestPermission().catch(() => 'denied');
          toast(r === 'granted' ? 'Avisos ligados ✓' : 'Os avisos ficaram desligados', r === 'granted' ? 'good' : 'bad');
          pintar();
        },
      }, '🔔 Ligar avisos do navegador')
      : h('p', { class: 'tiny muted', style: { margin: '8px 0 0' } },
        permissao === 'granted' ? '🔔 Avisos do navegador ligados.'
          : permissao === 'denied' ? '🔕 Os avisos estão bloqueados nas configurações do navegador — o despertador toca na tela mesmo assim.'
            : ''));
}

/* ==========================================================
   O TOCADOR
   ========================================================== */
let ctx = null, tocando = null, relogio = null;

/** O navegador só deixa tocar som depois de um toque do usuário: o 1º toque prepara o áudio. */
function primeiroToque() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sem áudio: o alarme ainda cobre a tela e vibra */ }
}

/** Bipe de despertador gerado na hora (sem arquivo): 3 bipes, pausa, repete. */
function tocarSom(segundos = 60) {
  primeiroToque();
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

function tocar(alarme) {
  if (tocando) return;   // um de cada vez; o outro toca na próxima conferida
  const parar = tocarSom(60);
  try { navigator.vibrate?.([400, 200, 400, 200, 400, 800, 400, 200, 400, 200, 400]); } catch { /* ok */ }
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(`⏰ ${alarme.rotulo}`, { body: `São ${alarme.hora} — hora de abrir o MindTrack AI.`, tag: alarme.id }); } catch { /* ok */ }
  }

  const fechar = () => {
    parar();
    try { navigator.vibrate?.(0); } catch { /* ok */ }
    tela.remove();
    tocando = null;
  };
  const tela = h('div', { class: 'focus-full', role: 'alertdialog', 'aria-label': 'Despertador', style: { zIndex: 95 } },
    h('div', { style: { fontSize: '64px' } }, '⏰'),
    h('div', { style: { fontSize: '56px', fontWeight: 800, letterSpacing: '-1px' } }, alarme.hora),
    h('h2', {}, alarme.rotulo),
    h('div', { class: 'flexb', style: { flexWrap: 'wrap', justifyContent: 'center' } },
      h('button', {
        class: 'btn', onclick: () => {
          salvarAlarme(soneca(lista().find((x) => x.id === alarme.id) || alarme, new Date()));
          toast(`Soneca: toca de novo em ${SONECA_MIN} min 😴`);
          fechar();
        },
      }, `😴 Soneca ${SONECA_MIN} min`),
      h('button', { class: 'btn btn--p', onclick: () => { fechar(); location.hash = '#/foco'; } }, '▶ Começar a estudar'),
      h('button', { class: 'btn', onclick: fechar }, 'Desligar')));
  document.body.append(tela);
  tocando = { alarme, fechar };
}

function conferir() {
  const agora = new Date();
  const hora = devemTocar(lista(), agora);
  if (!hora.length) return;
  for (const a of hora) salvarAlarme(aposTocar(a, agora));
  tocar(hora[0]);
}

/** Liga o tocador (uma vez, no início do app). */
export function iniciarDespertador() {
  if (relogio) return;
  addEventListener('pointerdown', primeiroToque, { once: true, capture: true });
  addEventListener('keydown', primeiroToque, { once: true, capture: true });
  conferir();
  relogio = setInterval(conferir, 10000);
  // a aba que volta do fundo confere na hora (o navegador atrasa o relógio das abas escondidas)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) conferir(); });
}

/** Para os testes de navegador: dispara um alarme agora. */
export const tocarAgora = (alarme) => tocar(alarme);
