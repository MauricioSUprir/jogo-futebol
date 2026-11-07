/* ===== views/perfil.js — cartão de perfil da barra superior ===== */
import { h, fmtMin, inicial } from '../util.js';
import { st } from '../store.js';
import { nivelDe, resumoPeriodo, CONQUISTAS, atividadeDoDia } from '../engine.js';
import { modal, fecharModal, gAnel, progresso } from '../ui.js';

export function abrirPerfil() {
  const s = st();
  const nv = nivelDe(s.jogo.xp);
  const r = resumoPeriodo(7);
  const hoje = atividadeDoDia();
  modal('👤 Perfil', h('div', {},
    h('div', { class: 'flexb mb' },
      h('div', { style: { color: 'var(--acc)' } }, gAnel(nv.progresso, { tam: 78, texto: String(nv.nivel) })),
      h('div', { class: 'grow' },
        h('b', { style: { fontSize: '17px' } }, `${s.perfil.avatar || '🎓'} ${s.perfil.nome}`),
        h('div', { class: 'small muted' }, s.perfil.serie),
        h('div', { class: 'chips mt' },
          h('span', { class: 'chip' }, `⭐ ${s.jogo.xp} XP`),
          h('span', { class: 'chip' }, `🪙 ${s.jogo.moedas}`),
          h('span', { class: 'chip' }, `🔥 ${s.jogo.streak}`)))),
    progresso(`Nível ${nv.nivel} — ${nv.titulo}`, nv.progresso * 100),
    h('div', { class: 'grid g3 keep2 mt2' },
      h('div', { class: 'kpi' }, h('b', {}, fmtMin(hoje.minutos)), h('span', {}, 'hoje')),
      h('div', { class: 'kpi' }, h('b', {}, fmtMin(r.minutos)), h('span', {}, 'na semana')),
      h('div', { class: 'kpi' }, h('b', {}, `${s.jogo.conquistas.length}/${CONQUISTAS.length}`), h('span', {}, 'conquistas'))),
    h('div', { class: 'grid g2 keep2 mt2' },
      h('a', { class: 'btn btn--blk', href: '#/conquistas', onclick: fecharModal }, '🏆 Conquistas'),
      h('a', { class: 'btn btn--blk', href: '#/config', onclick: fecharModal }, '⚙️ Configurações'))));
}
