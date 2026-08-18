/* ===== app.js — casca do aplicativo: menu, barra superior, rotas ===== */
import { $, $$, h, iso, inicial, saudacao } from './util.js';
import { carregar, st, onChange, salvar, set } from './store.js';
import { recalcularDominios, verificarConquistas, notificacoes, nivelDe, tocarStreak } from './engine.js';
import { toast, modal, fecharModal, gAnel } from './ui.js';
import { abrirQuickAdd } from './views/quickadd.js';
import { abrirBusca } from './views/busca.js';
import { abrirPerfil } from './views/perfil.js';

import * as vInicio from './views/inicio.js';
import * as vAgenda from './views/agenda.js';
import * as vTarefas from './views/tarefas.js';
import * as vProvas from './views/provas.js';
import * as vMaterias from './views/materias.js';
import * as vAprender from './views/aprender.js';
import * as vQuestoes from './views/questoes.js';
import * as vFlash from './views/flashcards.js';
import * as vRevisao from './views/revisao.js';
import * as vFoco from './views/foco.js';
import * as vDesempenho from './views/desempenho.js';
import * as vConquistas from './views/conquistas.js';
import * as vBiblioteca from './views/biblioteca.js';
import * as vAI from './views/studyai.js';
import * as vConfig from './views/config.js';
import * as vPlanos from './views/planos.js';
import * as vCriador from './views/criador.js';
import { precisaEntrar, abrirEntrada } from './views/entrar.js';
import { temServidor, buscarEu, garantirSessao } from './api.js';

export const MENU = [
  { r: 'inicio', i: '🏠', t: 'Início', v: vInicio, tab: true },
  { r: 'agenda', i: '📅', t: 'Agenda', v: vAgenda, tab: true },
  { r: 'tarefas', i: '✅', t: 'Tarefas', v: vTarefas, tab: true },
  { r: 'provas', i: '🎯', t: 'Provas', v: vProvas },
  { r: 'materias', i: '📚', t: 'Matérias', v: vMaterias },
  { r: 'aprender', i: '🧠', t: 'Aprender', v: vAprender },
  { r: 'questoes', i: '📝', t: 'Questões', v: vQuestoes },
  { r: 'flashcards', i: '🃏', t: 'Flashcards', v: vFlash },
  { r: 'revisao', i: '🔁', t: 'Revisão', v: vRevisao },
  { r: 'foco', i: '⏱️', t: 'Foco', v: vFoco, tab: true },
  { r: 'desempenho', i: '📊', t: 'Desempenho', v: vDesempenho },
  { r: 'conquistas', i: '🏆', t: 'Conquistas', v: vConquistas },
  { r: 'biblioteca', i: '📂', t: 'Biblioteca', v: vBiblioteca },
  { r: 'planos', i: '✨', t: 'StudyLab Pro', v: vPlanos },
  { r: 'ai', i: '🤖', t: 'Study AI', v: vAI, tab: true },
  { r: 'config', i: '⚙️', t: 'Configurações', v: vConfig },
  // rota escondida: não entra no menu (ver views/criador.js)
  { r: 'criador', i: '🛠️', t: 'Área do criador', v: vCriador, oculto: true },
];

export function irPara(rota) { location.hash = rota.startsWith('#') ? rota : `#/${rota}`; }

/* ---------- montagem do menu ---------- */
function montarMenu() {
  const nav = $('#sideNav');
  nav.replaceChildren(...MENU.filter((m) => !m.oculto).map((m) =>
    h('a', { href: `#/${m.r}`, 'data-r': m.r }, h('span', { class: 'i' }, m.i), m.t)));
  const tab = $('#tabbar');
  const tabs = MENU.filter((m) => m.tab);
  tab.replaceChildren(...tabs.map((m) =>
    h('a', { href: `#/${m.r}`, 'data-r': m.r }, h('b', {}, m.i), m.t)));
}

function marcarAtiva(rota) {
  $$('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === rota));
}

/* ---------- topo ---------- */
function atualizarTopo() {
  const s = st();
  $('#topStreak').innerHTML = `🔥 <b>${s.jogo.streak}</b>`;
  $('#topAvatar').textContent = s.perfil.avatar && s.perfil.avatar.length <= 2 ? s.perfil.avatar : inicial(s.perfil.nome);
  const n = notificacoes().filter((x) => !s.lidas.includes(x.id));
  $('#topBell .dot').hidden = n.length === 0;
  const nv = nivelDe(s.jogo.xp);
  const foot = $('#sideLevel');
  foot.replaceChildren(
    h('div', { class: 'lvl__ring' }, gAnel(nv.progresso, { tam: 38, larguraTraco: 5, texto: String(nv.nivel) })),
    h('div', { class: 'lvl__t' },
      h('b', {}, `Nível ${nv.nivel} — ${nv.titulo}`),
      h('span', {}, `${nv.xpAtual}/${nv.xpNivel} XP · 🪙 ${s.jogo.moedas}`)));
}

/* ---------- notificações ---------- */
function abrirNotificacoes() {
  const s = st();
  const lista = notificacoes();
  const box = h('div', { class: 'list' });
  if (!lista.length) box.append(h('div', { class: 'empty' }, h('b', {}, 'Tudo em ordem 🎉'), h('span', {}, 'Nenhum alerta agora.')));
  for (const n of lista) {
    box.append(h('button', {
      class: 'row', style: { textAlign: 'left', cursor: 'pointer' },
      onclick: () => { fecharModal(); if (n.rota) location.hash = n.rota; },
    },
      h('span', { style: { fontSize: '18px' } }, n.icone),
      h('span', { class: 'grow' }, h('div', { class: 'small' }, n.txt))));
  }
  box.append(h('button', {
    class: 'btn btn--blk mt', onclick: () => {
      set((x) => { x.lidas = [...new Set([...x.lidas, ...lista.map((n) => n.id)])].slice(-200); });
      fecharModal(); atualizarTopo(); toast('Notificações marcadas como lidas');
    },
  }, 'Marcar todas como lidas'));
  modal('🔔 Notificações', box);
}

/* ---------- roteador ---------- */
let limparAnterior = null;
function render() {
  const hash = location.hash.replace(/^#\/?/, '') || 'inicio';
  const [rota, ...resto] = hash.split(/[/?]/);
  const item = MENU.find((m) => m.r === rota) || MENU[0];
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const view = $('#view');

  if (typeof limparAnterior === 'function') { try { limparAnterior(); } catch (e) { console.error(e); } }
  limparAnterior = null;
  view.replaceChildren();
  try {
    const r = item.v.render(view, { id: resto[0] || null, params });
    if (typeof r === 'function') limparAnterior = r;
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'empty' }, h('b', {}, 'Ops — algo quebrou nesta tela'),
      h('span', {}, String(e.message || e)),
      h('div', { class: 'mt' }, h('button', { class: 'btn', onclick: () => location.reload() }, 'Recarregar'))));
  }
  marcarAtiva(item.r);
  $('#side').classList.remove('open');
  $('.side__scrim').hidden = true;
  window.scrollTo({ top: 0 });
  document.title = `${item.t} · StudyLab`;
}

/* ---------- rotina diária ---------- */
function rotinaDiaria() {
  recalcularDominios();
  const novas = verificarConquistas();
  for (const c of novas) toast(`${c.emoji} Conquista desbloqueada: ${c.nome}`, 'good');
  tocarStreak();
  atualizarTopo();
}

/* ---------- boot ---------- */
function iniciar() {
  carregar();
  montarMenu();
  rotinaDiaria();
  if (precisaEntrar()) abrirEntrada(() => { montarMenu(); rotinaDiaria(); render(); });
  // com servidor, quem manda no plano é ele — o app só espelha
  if (temServidor()) {
    garantirSessao().then(() => buscarEu()).then(() => render())
      .catch(() => { /* offline ou servidor fora: segue com o que está salvo */ });
  }

  addEventListener('hashchange', render);
  onChange(() => atualizarTopo());

  $('[data-open-side]').addEventListener('click', () => {
    $('#side').classList.add('open'); $('.side__scrim').hidden = false;
  });
  $$('[data-close-side]').forEach((b) => b.addEventListener('click', () => {
    $('#side').classList.remove('open'); $('.side__scrim').hidden = true;
  }));
  $$('[data-modal-close]').forEach((b) => b.addEventListener('click', fecharModal));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrirBusca(); }
  });
  $('[data-action="busca"]').addEventListener('click', abrirBusca);
  $('[data-action="quickadd"]').addEventListener('click', () => abrirQuickAdd());
  $('[data-action="notifs"]').addEventListener('click', abrirNotificacoes);
  $('[data-action="perfil"]').addEventListener('click', abrirPerfil);
  $('[data-action="streak"]').addEventListener('click', () => irPara('conquistas'));

  render();
  $('#boot').remove();
  $('#app').hidden = false;

  // a cada 5 min revalida domínio/conquistas (o app costuma ficar aberto)
  setInterval(rotinaDiaria, 5 * 60 * 1000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciar);
else iniciar();
