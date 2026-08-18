/* ===== views/conquistas.js — XP, níveis, conquistas, streak e loja de StudyCoins ===== */
import { h, iso, addDays, today, daysBetween, parseISO, fmtMin, round, DIAS_S } from '../util.js';
import { st, set, aplicarTema } from '../store.js';
import { CONQUISTAS, NIVEIS, nivelDe, xpDoNivel, atividadeDoDia, serieDiaria, resumoPeriodo } from '../engine.js';
import { titulo, cartao, kpi, vazio, modal, fecharModal, toast, gAnel, barra, progresso, segmento, gBarras } from '../ui.js';

const LOJA = [
  { id: 'av_foguete', tipo: 'avatar', nome: 'Foguete', valor: '🚀', preco: 60 },
  { id: 'av_cerebro', tipo: 'avatar', nome: 'Cérebro', valor: '🧠', preco: 60 },
  { id: 'av_coruja', tipo: 'avatar', nome: 'Coruja', valor: '🦉', preco: 90 },
  { id: 'av_dragao', tipo: 'avatar', nome: 'Dragão', valor: '🐉', preco: 150 },
  { id: 'av_coroa', tipo: 'avatar', nome: 'Coroa', valor: '👑', preco: 250 },
  { id: 'cor_ciano', tipo: 'cor', nome: 'Ciano', valor: '#22d3ee', preco: 80 },
  { id: 'cor_verde', tipo: 'cor', nome: 'Verde-menta', valor: '#34d399', preco: 80 },
  { id: 'cor_rosa', tipo: 'cor', nome: 'Rosa', valor: '#f472b6', preco: 120 },
  { id: 'cor_ambar', tipo: 'cor', nome: 'Âmbar', valor: '#fbbf24', preco: 120 },
  { id: 'cor_vermelho', tipo: 'cor', nome: 'Vermelho', valor: '#f87171', preco: 160 },
];

let aba = 'progresso';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  const nv = nivelDe(s.jogo.xp);

  el.append(titulo('🏆 Conquistas', 'Seu progresso vira nível, XP e StudyCoins.'));

  el.append(h('div', { class: 'hero mb' }, h('div', { class: 'flexb' },
    h('div', { style: { color: 'var(--acc)' } }, gAnel(nv.progresso, { tam: 96, larguraTraco: 9, texto: String(nv.nivel) })),
    h('div', { class: 'grow' },
      h('h1', { style: { fontSize: '20px' } }, `Nível ${nv.nivel} — ${nv.titulo}`),
      h('p', { style: { margin: '2px 0 8px' } }, `${nv.xpAtual} / ${nv.xpNivel} XP para o próximo nível`),
      h('div', { class: 'chips' },
        h('span', { class: 'chip chip--on' }, `⭐ ${s.jogo.xp} XP total`),
        h('span', { class: 'chip chip--on' }, `🪙 ${s.jogo.moedas} StudyCoins`),
        h('span', { class: 'chip chip--on' }, `🔥 ${s.jogo.streak} dias`),
        h('span', { class: 'chip' }, `🏅 ${s.jogo.conquistas.length}/${CONQUISTAS.length}`))))));

  el.append(h('div', { class: 'mb' }, segmento([
    { v: 'progresso', t: '🔥 Sequência' }, { v: 'conquistas', t: '🏅 Conquistas' },
    { v: 'niveis', t: '🎮 Níveis' }, { v: 'loja', t: '🪙 Loja' },
  ], aba, (v) => { aba = v; pintar(); })));

  if (aba === 'progresso') abaStreak(el);
  if (aba === 'conquistas') abaConquistas(el);
  if (aba === 'niveis') abaNiveis(el, nv);
  if (aba === 'loja') abaLoja(el, pintar);
}

/* ---------- streak ---------- */
function abaStreak(el) {
  const s = st();
  const hoje = atividadeDoDia();
  const okHoje = hoje.minutos >= (s.prefs.metaStreakMin || 10) || hoje.questoes >= (s.prefs.metaStreakQuestoes || 5);
  const serie = serieDiaria(28);

  el.append(h('div', { class: 'grid g2 mb' },
    cartao(
      h('div', { class: 'center' },
        h('div', { style: { fontSize: '54px' } }, '🔥'),
        h('div', { style: { fontSize: '34px', fontWeight: 800 } }, s.jogo.streak),
        h('div', { class: 'muted' }, `dia${s.jogo.streak === 1 ? '' : 's'} seguidos estudando`),
        h('div', { class: 'tiny muted mt' }, `recorde: ${s.jogo.recordeStreak || 0} dias`)),
      h('div', { class: 'hr' }),
      h('b', { class: 'small' }, okHoje ? '✅ Hoje já conta!' : '⏳ Falta pouco para hoje contar'),
      h('p', { class: 'tiny muted' }, `Basta ${s.prefs.metaStreakMin} minutos de estudo OU ${s.prefs.metaStreakQuestoes} questões. Hoje: ${fmtMin(hoje.minutos)} e ${hoje.questoes} questões.`),
      progresso('Progresso de hoje', Math.min(100, Math.max((hoje.minutos / (s.prefs.metaStreakMin || 10)) * 100, (hoje.questoes / (s.prefs.metaStreakQuestoes || 5)) * 100)), { cls: okHoje ? 'ok' : 'warn' })),
    cartao(
      h('b', {}, '📅 Últimos 28 dias'),
      h('div', { class: 'mt', style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px' } },
        ...serie.map((d) => {
          const ativo = d.minutos > 0 || d.questoes > 0;
          const forte = d.minutos >= (s.prefs.minutosDia || 90);
          return h('div', {
            title: `${d.dia}: ${fmtMin(d.minutos)}, ${d.questoes} questões`,
            style: {
              aspectRatio: '1', borderRadius: '7px',
              background: forte ? 'var(--acc)' : ativo ? 'rgba(124,92,255,.4)' : 'var(--panel2)',
              border: '1px solid var(--line)',
            },
          });
        })),
      h('p', { class: 'tiny muted mt' }, 'Quanto mais forte a cor, mais você estudou naquele dia.'))));

  const r = resumoPeriodo(7);
  el.append(h('div', { class: 'grid g4 keep2' },
    kpi(fmtMin(r.minutos), 'na semana'),
    kpi(r.questoes, 'questões'),
    kpi(`${r.taxa}%`, 'acerto'),
    kpi(r.sessoes, 'sessões')));
}

/* ---------- conquistas ---------- */
function abaConquistas(el) {
  const s = st();
  const got = new Set(s.jogo.conquistas);
  el.append(h('div', { class: 'grid g2' }, ...CONQUISTAS.map((c) => h('div', { class: `ach ${got.has(c.id) ? 'got' : 'lock'}` },
    h('span', { class: 'em' }, got.has(c.id) ? c.emoji : '🔒'),
    h('div', { class: 'grow' },
      h('b', { class: 'small' }, c.nome),
      h('div', { class: 'tiny muted' }, c.desc)),
    got.has(c.id) ? h('span', { class: 'chip ok' }, '✓') : null))));
  el.append(h('p', { class: 'tiny muted center mt' }, `${got.size} de ${CONQUISTAS.length} desbloqueadas · cada conquista rende 25 🪙`));
}

/* ---------- níveis ---------- */
function abaNiveis(el, nv) {
  const linhas = [];
  for (let n = 1; n <= 50; n++) {
    const titulo1 = NIVEIS.find((x) => x.n === n)?.t;
    if (!titulo1 && n !== nv.nivel && n % 5 !== 0) continue;
    linhas.push({ n, t: titulo1 || '—', xp: xpDoNivel(n) });
  }
  el.append(cartao(
    h('b', {}, '🎮 Escada de níveis'),
    h('p', { class: 'tiny muted' }, 'XP vem de tarefas concluídas, sessões de foco, questões, revisões e simulados.'),
    h('div', { class: 'list mt' }, ...linhas.map((l) => h('div', {
      class: 'row row--flat', style: l.n === nv.nivel ? { borderColor: 'var(--acc)' } : {},
    },
      h('b', { style: { width: '38px' } }, l.n),
      h('span', { class: 'grow small' }, l.t === '—' ? `Nível ${l.n}` : l.t),
      h('span', { class: 'chip' }, `${l.xp} XP`),
      l.n === nv.nivel ? h('span', { class: 'chip chip--on' }, 'você está aqui') : null))),
    h('div', { class: 'hr' }),
    h('b', { class: 'small' }, 'Quanto vale cada coisa'),
    h('div', { class: 'chips mt' },
      h('span', { class: 'chip' }, '✅ tarefa concluída · +20 a +80'),
      h('span', { class: 'chip' }, '⏱️ sessão de foco · +10 a +60'),
      h('span', { class: 'chip' }, '📝 questão · +6'),
      h('span', { class: 'chip' }, '🃏 flashcards · +3 por card'),
      h('span', { class: 'chip' }, '🧪 simulado · +100'),
      h('span', { class: 'chip' }, '👑 boss · +200'))));
}

/* ---------- loja ---------- */
function abaLoja(el, pintar) {
  const s = st();
  const meus = new Set(s.jogo.itens || []);
  el.append(cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🪙 Loja de StudyCoins'),
      h('span', { class: 'chip sp' }, `você tem ${s.jogo.moedas} 🪙`)),
    h('p', { class: 'tiny muted' }, 'Moedas vêm de estudar — nunca de dinheiro de verdade.'),
    h('div', { class: 'grid g3 mt' }, ...LOJA.map((item) => {
      const tem = meus.has(item.id);
      const emUso = item.tipo === 'avatar' ? s.perfil.avatar === item.valor : s.perfil.acento === item.valor;
      return h('div', { class: 'card card--flat center' },
        item.tipo === 'avatar'
          ? h('div', { style: { fontSize: '30px' } }, item.valor)
          : h('div', { style: { height: '32px', borderRadius: '9px', background: item.valor, margin: '0 8px 6px' } }),
        h('b', { class: 'small' }, item.nome),
        h('div', { class: 'tiny muted mb' }, tem ? (emUso ? 'em uso' : 'seu') : `${item.preco} 🪙`),
        h('button', {
          class: `btn btn--sm ${emUso ? '' : 'btn--p'}`, disabled: emUso || null,
          onclick: () => {
            if (!tem) {
              if (s.jogo.moedas < item.preco) return toast('StudyCoins insuficientes — estude mais! 😄', 'bad');
              set((x) => { x.jogo.moedas -= item.preco; x.jogo.itens.push(item.id); });
              toast(`${item.nome} desbloqueado!`, 'good');
            }
            set((x) => { if (item.tipo === 'avatar') x.perfil.avatar = item.valor; else x.perfil.acento = item.valor; });
            aplicarTema();
            pintar();
          },
        }, emUso ? 'em uso' : tem ? 'usar' : 'comprar'));
    })),
    h('div', { class: 'hr' }),
    h('button', {
      class: 'btn btn--sm', onclick: () => {
        set((x) => { x.perfil.acento = null; }); aplicarTema(); pintar(); toast('Cor padrão restaurada');
      },
    }, '↩️ Voltar à cor padrão')));
}
