/* ===== views/foco.js — modo foco, pomodoro e ambiente sonoro ===== */
import { h, fmtMin, iso, round, clamp } from '../util.js';
import { st, set, registrarSessao, atualizar, tarefa as getTarefa, nomeMateria, emojiMateria } from '../store.js';
import { filaTarefas, ganharXP, tocarStreak, verificarConquistas, atividadeDoDia, agoraFaca } from '../engine.js';
import { titulo, cartao, kpi, vazio, toast, campo, inp, sel, segmento, gAnel, barra, confirmar, modal, fecharModal } from '../ui.js';
import { opcoesMaterias, selMateria } from './comum.js';

/* ---------- ambiente sonoro (WebAudio, sem arquivos) ---------- */
const AMBIENTES = [
  { id: 'nenhum', rot: '🔇 Silêncio' }, { id: 'chuva', rot: '🌧️ Chuva' },
  { id: 'cafeteria', rot: '☕ Cafeteria' }, { id: 'floresta', rot: '🌲 Floresta' },
  { id: 'lareira', rot: '🔥 Lareira' }, { id: 'oceano', rot: '🌊 Oceano' }, { id: 'branco', rot: '🎧 Ruído branco' },
];
let audioCtx = null, audioNodes = [];
function pararSom() {
  for (const n of audioNodes) { try { n.stop?.(); n.disconnect?.(); } catch { /* ok */ } }
  audioNodes = [];
}
function tocarSom(tipo) {
  pararSom();
  if (tipo === 'nenhum' || !tipo) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const dur = 4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < d.length; i++) {
      const branco = Math.random() * 2 - 1;
      // ruído marrom = mais grave, bom para chuva/lareira/oceano
      ultimo = (ultimo + 0.02 * branco) / 1.02;
      d[i] = tipo === 'branco' ? branco * 0.35 : ultimo * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = { chuva: 1400, cafeteria: 800, floresta: 1000, lareira: 500, oceano: 420, branco: 8000 }[tipo] || 1000;
    const ganho = ctx.createGain();
    ganho.gain.value = 0.18;
    src.connect(filtro); filtro.connect(ganho); ganho.connect(ctx.destination);
    src.start();
    audioNodes = [src, filtro, ganho];
    if (tipo === 'oceano' || tipo === 'floresta') {           // ondas: volume vai e volta
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = tipo === 'oceano' ? 0.08 : 0.15;
      lfoG.gain.value = 0.09;
      lfo.connect(lfoG); lfoG.connect(ganho.gain); lfo.start();
      audioNodes.push(lfo, lfoG);
    }
  } catch (e) { console.warn('Sem áudio disponível', e); }
}

/* ---------- tela ---------- */
export function render(el, { params }) {
  const s = st();
  const pintar = () => { el.replaceChildren(); montar(el, params, pintar); };
  montar(el, params, pintar);
  return () => pararSom();
}

function montar(el, params, pintar) {
  const s = st();
  const tarefaId = params.get('tarefa');
  const minParam = Number(params.get('min')) || 0;
  const tituloParam = params.get('titulo') ? decodeURIComponent(params.get('titulo')) : '';
  const hoje = atividadeDoDia();

  el.append(titulo('⏱️ Foco', 'Uma tarefa, um cronômetro, zero distração.'));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(fmtMin(hoje.minutos), 'estudados hoje'),
    kpi(s.sessoes.filter((x) => x.em.slice(0, 10) === iso()).length, 'sessões hoje'),
    kpi(s.jogo.streak, 'dias de sequência'),
    kpi(fmtMin(s.prefs.minutosDia), 'meta diária')));

  /* configuração */
  let minutos = minParam || s.prefs.blocoFoco || 25;
  let alvo = tarefaId || '';
  let som = s.prefs.som || 'nenhum';
  let pomodoro = false;

  const tarefas = filaTarefas();
  const selTarefa = sel([{ v: '', t: '— sem tarefa específica —' }, ...tarefas.map((t) => ({ v: t.id, t: `${t.titulo} (${nomeMateria(t.materiaId)})` }))], alvo);
  selTarefa.addEventListener('change', () => { alvo = selTarefa.value; });

  const inpMin = inp({ type: 'number', min: 5, max: 180, step: 5, value: minutos });
  inpMin.addEventListener('input', () => { minutos = Number(inpMin.value) || 25; });

  const sugestao = agoraFaca();

  el.append(h('div', { class: 'grid g2' },
    cartao(
      h('b', {}, '▶ Iniciar sessão'),
      h('label', { class: 'f mt' }, h('span', {}, 'Duração'),
        segmento([{ v: 25, t: '25 min' }, { v: 40, t: '40 min' }, { v: 60, t: '60 min' }, { v: -1, t: 'Personalizado' }],
          [25, 40, 60].includes(minutos) ? minutos : -1,
          (v) => { if (v > 0) { minutos = Number(v); inpMin.value = v; } })),
      campo('Minutos', inpMin),
      campo('Tarefa', selTarefa),
      h('label', { class: 'f' }, h('span', {}, 'Ambiente sonoro'),
        segmento(AMBIENTES.map((a) => ({ v: a.id, t: a.rot })), som, (v) => { som = v; set((x) => { x.prefs.som = v; }); tocarSom(v); })),
      h('label', { class: 'flexb mb', style: { cursor: 'pointer' } },
        h('input', { type: 'checkbox', onchange: (e) => { pomodoro = e.target.checked; } }),
        h('span', { class: 'small' }, `🍅 Ciclo pomodoro (${s.prefs.blocoFoco}min foco / ${s.prefs.pausaCurta}min pausa, pausa longa de ${s.prefs.pausaLonga}min a cada ${s.prefs.ciclosAtePausaLonga} ciclos)`)),
      h('button', {
        class: 'btn btn--p btn--blk btn--xl', onclick: () => iniciarFoco({
          minutos, tarefaId: alvo || null, som, pomodoro, titulo: tituloParam || (alvo ? getTarefa(alvo)?.titulo : '') || 'Sessão de foco',
        }),
      }, '▶ COMEÇAR')),
    cartao(
      h('b', {}, '🚫 Sugestão do StudyLab'),
      sugestao
        ? h('div', {},
          h('p', { class: 'muted small' }, 'Se estiver na dúvida do que fazer, comece por aqui:'),
          h('div', { style: { fontSize: '17px', fontWeight: 800 } }, `${emojiMateria(sugestao.materiaId)} ${sugestao.titulo}`),
          h('div', { class: 'tiny muted mb' }, `${nomeMateria(sugestao.materiaId)} · ${fmtMin(sugestao.minutos)}`),
          h('button', {
            class: 'btn btn--blk', onclick: () => iniciarFoco({
              minutos: sugestao.minutos, tarefaId: sugestao.tarefaId, som, pomodoro: false, titulo: sugestao.titulo,
            }),
          }, `▶ Focar ${fmtMin(sugestao.minutos)} nisso`))
        : h('p', { class: 'muted small' }, 'Sem tarefas em aberto — aproveite para revisar.'),
      h('div', { class: 'hr' }),
      h('b', { class: 'small' }, '🍅 Como funciona o pomodoro'),
      h('p', { class: 'tiny muted', style: { marginBottom: 0 } },
        'Você estuda em blocos curtos com pausas curtas entre eles. Depois de alguns ciclos, uma pausa longa. '
        + 'Cada bloco concluído entra automaticamente no seu histórico de estudo.'))));

  /* histórico */
  const ses = s.sessoes.slice(-12).reverse();
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '🕘 Últimas sessões'),
    ses.length ? h('div', { class: 'list mt' }, ...ses.map((x) => h('div', { class: 'row row--flat' },
      h('span', {}, { foco: '⏱️', pomodoro: '🍅', questoes: '📝', simulado: '🧪', flashcards: '🃏', desafio: '⚔️', boss: '👑', diagnostico: '🧪' }[x.tipo] || '•'),
      h('span', { class: 'grow small' }, `${x.tipo} · ${x.materiaId ? nomeMateria(x.materiaId) : 'geral'}`),
      h('span', { class: 'chip' }, fmtMin(x.minutos)),
      h('span', { class: 'tiny muted' }, new Date(x.em).toLocaleDateString('pt-BR')))))
      : h('p', { class: 'muted small' }, 'Nenhuma sessão ainda.'))));
}

/* ==========================================================
   CRONÔMETRO EM TELA CHEIA
   ========================================================== */
export function iniciarFoco({ minutos, tarefaId = null, som = 'nenhum', pomodoro = false, titulo: tit = 'Foco' }) {
  const s = st();
  const tela = h('div', { class: 'focus-full' });
  document.body.append(tela); document.body.style.overflow = 'hidden';
  tocarSom(som);

  let fase = 'foco';             // foco | pausa | pausaLonga
  let ciclo = 1;
  let restante = minutos * 60;
  let total = restante;
  let rodando = true;
  let acumulado = 0;
  const t = tarefaId ? getTarefa(tarefaId) : null;

  const tempoEl = h('div', { class: 'focus-time' });
  const subEl = h('div', { class: 'focus-sub' });
  const anelWrap = h('div', { style: { color: 'var(--acc)' } });

  const timer = setInterval(() => {
    if (!rodando) return;
    restante--;
    if (fase === 'foco') acumulado++;
    if (restante <= 0) proximaFase();
    pintar();
  }, 1000);

  function proximaFase() {
    if (fase === 'foco') {
      registrarBloco();
      if (!pomodoro) return terminar();
      const longa = ciclo % (s.prefs.ciclosAtePausaLonga || 4) === 0;
      fase = longa ? 'pausaLonga' : 'pausa';
      restante = total = (longa ? s.prefs.pausaLonga : s.prefs.pausaCurta) * 60;
      beep();
      toast(longa ? '🍅 Pausa longa! Levanta e respira.' : '☕ Pausa curta.', 'good');
    } else {
      fase = 'foco'; ciclo++;
      restante = total = (s.prefs.blocoFoco || 25) * 60;
      beep();
      toast('▶ De volta ao foco.', 'good');
    }
  }

  function registrarBloco() {
    const min = Math.max(1, Math.round(acumulado / 60));
    acumulado = 0;
    registrarSessao({ tipo: pomodoro ? 'pomodoro' : 'foco', minutos: min, materiaId: t?.materiaId || null, tarefaId: tarefaId || null });
    if (t) atualizar('tarefas', t.id, { minutosFeitos: (t.minutosFeitos || 0) + min, status: t.status === 'aberto' ? 'andamento' : t.status });
    const g = ganharXP(Math.min(60, 10 + min), 'foco');
    tocarStreak();
    for (const c of verificarConquistas()) toast(`${c.emoji} Conquista: ${c.nome}`, 'good');
    toast(`✅ ${min} min registrados · +${g.qtd} XP`, 'good');
  }

  function terminar(semRegistrar = false) {
    clearInterval(timer); pararSom();
    if (!semRegistrar && acumulado >= 60) registrarBloco();
    tela.remove(); document.body.style.overflow = '';
    location.hash = location.hash.split('?')[0];
  }

  function beep() {
    try {
      const ctx = audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 660; g.gain.value = .12;
      o.connect(g); g.connect(ctx.destination); o.start();
      setTimeout(() => { o.stop(); o.disconnect(); }, 320);
    } catch { /* sem som */ }
  }

  function pintar() {
    const m = Math.floor(restante / 60), sg = restante % 60;
    tempoEl.textContent = `${String(m).padStart(2, '0')}:${String(sg).padStart(2, '0')}`;
    subEl.textContent = fase === 'foco'
      ? `${tit}${t ? ' · ' + nomeMateria(t.materiaId) : ''}`
      : (fase === 'pausaLonga' ? 'Pausa longa — descanse de verdade' : 'Pausa curta');
    anelWrap.replaceChildren(gAnel(1 - restante / Math.max(1, total), { tam: 132, larguraTraco: 8, cor: fase === 'foco' ? '#7c5cff' : '#34d399' }));
    document.title = `${tempoEl.textContent} · StudyLab`;
  }

  const btnPausa = h('button', { class: 'btn', onclick: () => { rodando = !rodando; btnPausa.textContent = rodando ? '⏸ Pausar' : '▶ Retomar'; } }, '⏸ Pausar');

  tela.append(
    h('div', { class: 'flexb', style: { position: 'absolute', top: '14px', left: '14px', right: '14px' } },
      h('button', { class: 'icon-btn', onclick: () => confirmar('Encerrar sessão?', 'O tempo já estudado será registrado.', () => terminar()) }, '✕'),
      h('span', { class: 'sp chip' }, pomodoro ? `🍅 ciclo ${ciclo}` : '⏱️ foco'),
      h('span', { class: 'chip' }, AMBIENTES.find((a) => a.id === som)?.rot || '')),
    anelWrap, tempoEl, subEl,
    h('div', { class: 'flexb mt2' },
      btnPausa,
      h('button', { class: 'btn', onclick: () => { restante = 1; } }, '⏭ Pular fase'),
      h('button', { class: 'btn btn--g', onclick: () => terminar() }, '✔ Concluir')),
    t ? h('p', { class: 'tiny muted mt' }, `Tarefa: ${t.titulo} · estimativa ${fmtMin(t.minutos)} · já feitos ${fmtMin(t.minutosFeitos || 0)}`) : null);
  pintar();
}
