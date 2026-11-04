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
import * as vEscola from './views/escola.js';
import * as vAprender from './views/aprender.js';
import * as vQuestoes from './views/questoes.js';
import * as vFlash from './views/flashcards.js';
import * as vRevisao from './views/revisao.js';
import * as vFoco from './views/foco.js';
import * as vRelogio from './views/relogio.js';
import * as vDesempenho from './views/desempenho.js';
import * as vConquistas from './views/conquistas.js';
import * as vBiblioteca from './views/biblioteca.js';
import * as vAI from './views/studyai.js';
import * as vConfig from './views/config.js';
import * as vPlanos from './views/planos.js';
import * as vConexoes from './views/conexoes.js';
import * as vCriador from './views/criador.js';
import * as vTermos from './views/termos.js';
import { precisaEntrar, abrirEntrada } from './views/entrar.js';
import { ic, icHtml } from './icones.js';
import { temServidor, buscarEu, garantirSessao, manterServidorAcordado } from './api.js';

/* Menu lateral enxuto: 4 atalhos no topo, seções que abrem e fecham (só a da
   tela atual vem aberta) e a conta no rodapé. g = seção · ic = ícone de traço
   (js/icones.js) · tab = vai na barra de baixo do celular (ta = rótulo curto).
   O 1º item é a tela de entrada do app: o chat. */
export const GRUPOS = { Escola: 'escola', Estudar: 'aprender', Progresso: 'grafico' };
export const MENU = [
  { r: 'ai', ic: 'chat', i: '💬', t: 'MindTrack AI', ta: 'Chat', v: vAI, tab: true },
  { r: 'inicio', ic: 'casa', i: '🏠', t: 'Início', v: vInicio, tab: true },
  { r: 'agenda', ic: 'agenda', i: '📅', t: 'Agenda', v: vAgenda, tab: true },
  { r: 'tarefas', ic: 'tarefas', i: '✅', t: 'Tarefas', v: vTarefas },

  { g: 'Escola', r: 'escola', ic: 'escola', i: '🏫', t: 'Minha Escola', ta: 'Escola', v: vEscola, tab: true },
  { g: 'Escola', r: 'provas', ic: 'provas', i: '🎯', t: 'Provas e testes', v: vProvas },
  { g: 'Escola', r: 'materias', ic: 'materias', i: '📚', t: 'Matérias', v: vMaterias },
  { g: 'Escola', r: 'biblioteca', ic: 'materiais', i: '📂', t: 'Materiais', v: vBiblioteca },

  { g: 'Estudar', r: 'foco', ic: 'foco', i: '⏱️', t: 'Foco', v: vFoco, tab: true },
  { g: 'Estudar', r: 'aprender', ic: 'aprender', i: '🧠', t: 'Aprender', v: vAprender },
  { g: 'Estudar', r: 'questoes', ic: 'questoes', i: '📝', t: 'Questões', v: vQuestoes },
  { g: 'Estudar', r: 'flashcards', ic: 'cartas', i: '🃏', t: 'Flashcards', v: vFlash },
  { g: 'Estudar', r: 'revisao', ic: 'revisao', i: '🔁', t: 'Revisão', v: vRevisao },
  { g: 'Estudar', r: 'relogio', ic: 'relogio', i: '⏲️', t: 'Cronômetro e timer', v: vRelogio },

  { g: 'Progresso', r: 'desempenho', ic: 'grafico', i: '📊', t: 'Desempenho', v: vDesempenho },
  { g: 'Progresso', r: 'conquistas', ic: 'trofeu', i: '🏆', t: 'Conquistas', v: vConquistas },

  { conta: true, r: 'conexoes', ic: 'link', i: '🔗', t: 'Conexões', v: vConexoes },
  { conta: true, r: 'planos', ic: 'estrela', i: '✨', t: 'MindTrack Pro', v: vPlanos },
  { conta: true, r: 'config', ic: 'config', i: '⚙️', t: 'Configurações', v: vConfig },
  { r: 'termos', i: '📄', t: 'Termos e privacidade', v: vTermos, oculto: true },
  // rota escondida: não entra no menu (ver views/criador.js)
  { r: 'criador', i: '🛠️', t: 'Área do criador', v: vCriador, oculto: true },
];

export function irPara(rota) { location.hash = rota.startsWith('#') ? rota : `#/${rota}`; }

/* ---------- montagem do menu ---------- */
const abertos = new Set();            // seções que o aluno abriu nesta visita
const link = (m) => h('a', { href: `#/${m.r}`, 'data-r': m.r }, ic(m.ic), h('span', {}, m.t));

function montarMenu() {
  const nav = $('#sideNav');
  const visiveis = MENU.filter((x) => !x.oculto && !x.conta);
  const itens = visiveis.filter((m) => !m.g).map(link);
  for (const [g, icone] of Object.entries(GRUPOS)) {
    const filhos = visiveis.filter((m) => m.g === g);
    const sec = h('div', { class: 'side__sec', 'data-g': g },
      h('button', {
        class: 'side__sec-h', type: 'button', 'aria-expanded': 'false',
        onclick: () => {
          const abrir = !sec.classList.contains('aberta');
          if (abrir) abertos.add(g); else abertos.delete(g);
          sec.classList.toggle('aberta', abrir);
          sec.firstChild.setAttribute('aria-expanded', String(abrir));
        },
      }, ic(icone), h('span', {}, g), h('small', {}, String(filhos.length)), ic('seta', 16)),
      h('div', { class: 'side__sec-b' }, h('div', {}, ...filhos.map(link))));
    itens.push(sec);
  }
  nav.replaceChildren(...itens);
  $('#sideConta').replaceChildren(...MENU.filter((m) => m.conta).map(link));
  const tab = $('#tabbar');
  tab.replaceChildren(...MENU.filter((m) => m.tab).map((m) =>
    h('a', { href: `#/${m.r}`, 'data-r': m.r }, ic(m.ic, 22), h('span', {}, m.ta || m.t))));
}

function marcarAtiva(rota) {
  $$('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === rota));
  const g = MENU.find((m) => m.r === rota)?.g;
  $$('.side__sec').forEach((sec) => {
    const abrir = sec.dataset.g === g || abertos.has(sec.dataset.g);
    sec.classList.toggle('aberta', abrir);
    sec.classList.toggle('tem-ativa', sec.dataset.g === g);
    sec.firstChild.setAttribute('aria-expanded', String(abrir));
  });
}

/* ---------- topo ---------- */
function atualizarTopo() {
  const s = st();
  $('#topStreak').innerHTML = `${icHtml('fogo', 16)} <b>${s.jogo.streak}</b>`;
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
  const hash = location.hash.replace(/^#\/?/, '') || MENU[0].r;
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
  document.title = `${item.t} · MindTrack AI`;
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
  // Link de recomeço: abrir o app com ?zerar apaga TUDO deste aparelho e
  // começa do zero (com confirmação, para ninguém perder dados sem querer).
  if (new URLSearchParams(location.search).has('zerar')) {
    const confirmou = confirm('Zerar o MindTrack neste aparelho? Todos os dados salvos aqui serão apagados.');
    if (confirmou) {
      try { localStorage.removeItem('studylab.v1'); } catch { /* segue */ }
      try { indexedDB.deleteDatabase('studylab-fotos'); } catch { /* segue */ }
    }
    // tira o ?zerar do endereço para não perguntar de novo a cada recarga
    location.replace(location.pathname + location.hash);
    return;
  }
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
  vRelogio.iniciarRelogio();
  manterServidorAcordado();
  setTimeout(() => vConexoes.sincronizarAoAbrir().catch(() => {}), 2500);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciar);
else iniciar();
