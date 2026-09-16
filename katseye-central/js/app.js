/* ===== app.js — a casca do KATSEYE Central =====
   Rotas, menu, barra superior, busca global, notificações e boot. Cada tela
   é um módulo com `render(alvo, ctx)` que pode devolver uma função de
   limpeza — o roteador chama essa função antes de trocar de tela, e é por
   isso que relógios e vozes não vazam entre rotas.                         */

import { $, $$, h, iniciais, norm, fmtData, cortar } from './util.js';
import { carregar, st, aoMudar, set, aplicarPrefs, integrantes, lancamentos, GRUPO } from './store.js';
import { notificacoes, metricas, saudeDoPlano } from './engine.js';
import { toast, modal, fecharModal, vazio, cascata } from './ui.js';
import { trocaDeTela, limparRevelar } from './motion.js';

import * as vInicio from './views/inicio.js';
import * as vMembros from './views/membros.js';
import * as vAgenda from './views/agenda.js';
import * as vEstudio from './views/estudio.js';
import * as vConselheiro from './views/conselheiro.js';
import * as vConfig from './views/config.js';

/* ---------- mapa de rotas ---------- */
export const MENU = [
  { r: 'inicio', i: '🛰️', t: 'Command Center', curto: 'Início', v: vInicio, tab: true, sec: 'Painel' },
  { r: 'agenda', i: '📅', t: 'Agenda', curto: 'Agenda', v: vAgenda, tab: true, sec: 'Painel' },
  { r: 'membros', i: '👑', t: 'Enciclopédia', curto: 'Grupo', v: vMembros, tab: true, sec: 'O grupo' },
  { r: 'estudio', i: '🎨', t: 'Estúdio Criativo', curto: 'Estúdio', v: vEstudio, tab: true, sec: 'Produção' },
  { r: 'conselheiro', i: '🧠', t: 'Conselheiro', curto: 'IA', v: vConselheiro, tab: true, sec: 'Produção' },
  { r: 'config', i: '⚙️', t: 'Sistema', curto: 'Sistema', v: vConfig, sec: 'Sistema' },
];

export const irPara = (rota) => { location.hash = rota.startsWith('#') ? rota : `#/${rota}`; };

/* ==========================================================
   MENU
   ========================================================== */
function montarMenu() {
  const nav = $('#sideNav');
  nav.replaceChildren();
  let secAtual = '';
  for (const m of MENU) {
    if (m.sec !== secAtual) { nav.append(h('div', { class: 'side__sec' }, m.sec)); secAtual = m.sec; }
    nav.append(h('a', { href: `#/${m.r}`, 'data-r': m.r },
      h('span', { class: 'i' }, m.i), m.t));
  }

  const tab = $('#tabbar');
  tab.replaceChildren(...MENU.filter((m) => m.tab).map((m) =>
    h('a', { href: `#/${m.r}`, 'data-r': m.r }, h('b', {}, m.i), m.curto)));
}

const marcarAtiva = (rota) => $$('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === rota));

/* ==========================================================
   BARRA SUPERIOR
   ========================================================== */
function atualizarTopo() {
  const s = st();
  const m = metricas();
  const saude = saudeDoPlano();

  const av = $('#topAvatar');
  av.textContent = s.perfil.nome ? iniciais(s.perfil.nome) : '☉';

  const pendentes = notificacoes().filter((n) => !s.lidas.includes(n.id));
  $('#topBell .dot').hidden = pendentes.length === 0;

  const selo = $('#topSaude');
  selo.textContent = `${saude.nota}`;
  selo.className = `pill chip ${saude.cls}`;
  selo.title = `Planejamento ${saude.rot} · ${m.abertas} tarefas abertas`;

  const rodape = $('#sideFoot');
  rodape.replaceChildren(
    h('div', { class: 'flexb' },
      h('span', { class: 'grow' },
        h('div', { style: { fontSize: '12.5px', fontWeight: '800' } }, s.perfil.nome || 'Sem nome'),
        h('div', { class: 'tiny dim2' }, s.perfil.papel || 'defina em Sistema')),
      h('a', { class: 'icon-btn', href: '#/config', 'aria-label': 'Sistema' }, '⚙️')));
}

/* ==========================================================
   NOTIFICAÇÕES
   ========================================================== */
function abrirNotificacoes() {
  const s = st();
  const lista = notificacoes();
  const caixa = h('div', { class: 'list' });

  if (!lista.length) {
    caixa.append(vazio('Tudo em ordem', 'Nenhum alerta agora.', null, '✅'));
  } else {
    for (const n of lista) {
      caixa.append(h('button', {
        class: 'row row--btn',
        onclick: () => { fecharModal(); if (n.rota) location.hash = n.rota; },
      },
        h('span', { style: { fontSize: '17px' } }, n.icone),
        h('span', { class: 'grow small' }, n.txt)));
    }
    caixa.append(h('button', {
      class: 'btn btn--blk mt',
      onclick: () => {
        set((x) => { x.lidas = [...new Set([...x.lidas, ...lista.map((n) => n.id)])].slice(-300); });
        fecharModal(); atualizarTopo(); toast('Marcadas como lidas');
      },
    }, 'Marcar todas como lidas'));
  }
  modal('🔔 Notificações', caixa);
}

/* ==========================================================
   BUSCA GLOBAL
   ========================================================== */
function abrirBusca() {
  const campo = h('input', { class: 'inp', placeholder: 'Buscar tarefas, compromissos, integrantes, peças…', autofocus: true });
  const res = h('div', { class: 'list mt' });

  function buscar() {
    const q = norm(campo.value.trim());
    res.replaceChildren();
    if (q.length < 2) {
      res.append(h('p', { class: 'small muted center' }, 'Digite ao menos duas letras.'));
      return;
    }
    const s = st();
    const achados = [];

    for (const m of integrantes()) {
      if (norm(`${m.nome} ${m.nomeCompleto || ''} ${m.pais || ''} ${m.papel || ''}`).includes(q)) {
        achados.push({ i: '👑', t: m.nome, s: m.papel || m.pais, r: `#/membros/${m.id}` });
      }
    }
    for (const t of s.tarefas) {
      if (norm(`${t.titulo} ${(t.tags || []).join(' ')} ${t.nota || ''}`).includes(q)) {
        achados.push({ i: '✅', t: t.titulo, s: `tarefa · ${fmtData(t.prazo)}`, r: '#/agenda' });
      }
    }
    for (const e of s.eventos) {
      if (norm(`${e.titulo} ${e.local || ''} ${e.nota || ''}`).includes(q)) {
        achados.push({ i: '📅', t: e.titulo, s: `compromisso · ${fmtData(e.data)}`, r: `#/agenda?dia=${e.data}` });
      }
    }
    for (const rel of lancamentos()) {
      if (norm(`${rel.titulo} ${rel.tipo} ${rel.nota || ''}`).includes(q)) {
        achados.push({ i: '💿', t: rel.titulo, s: `${rel.tipo} · ${fmtData(rel.data, { relativo: false })}`, r: '#/membros' });
      }
    }
    for (const p of s.projetos) {
      if (norm(p.nome).includes(q)) achados.push({ i: '🎨', t: p.nome, s: `peça · ${p.formato}`, r: `#/estudio/${p.id}` });
    }
    for (const c of s.conversas) {
      if (norm(c.titulo).includes(q)) achados.push({ i: '💬', t: cortar(c.titulo, 40), s: 'conversa', r: '#/conselheiro' });
    }

    if (!achados.length) {
      res.append(vazio('Nada encontrado', `Nenhum resultado para "${campo.value.trim()}".`, null, '🔍'));
      return;
    }
    for (const a of achados.slice(0, 24)) {
      res.append(h('button', {
        class: 'row row--btn',
        onclick: () => { fecharModal(); location.hash = a.r; },
      },
        h('span', { style: { fontSize: '16px' } }, a.i),
        h('span', { class: 'grow' },
          h('div', { class: 'ttl' }, a.t),
          h('div', { class: 'sub' }, h('span', {}, a.s)))));
    }
    cascata(res.children, { passo: 22, distancia: 6 });
  }

  campo.addEventListener('input', buscar);
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const p = res.querySelector('button'); if (p) p.click(); }
  });
  modal('🔍 Buscar', h('div', {}, campo, res));
  buscar();
  setTimeout(() => campo.focus(), 50);
}

/* ==========================================================
   ROTEADOR
   ========================================================== */
let limparAnterior = null;

function render() {
  const hash = location.hash.replace(/^#\/?/, '') || 'inicio';
  const [rota, ...resto] = hash.split(/[/?]/);
  const item = MENU.find((m) => m.r === rota) || MENU[0];
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const alvo = $('#view');

  if (typeof limparAnterior === 'function') {
    try { limparAnterior(); } catch (e) { console.error(e); }
  }
  limparAnterior = null;
  limparRevelar();
  alvo.replaceChildren();

  try {
    const r = item.v.render(alvo, { id: resto[0] || null, params });
    if (typeof r === 'function') limparAnterior = r;
  } catch (e) {
    console.error(e);
    alvo.replaceChildren(h('div', { class: 'empty' },
      h('span', { class: 'em' }, '💥'),
      h('b', {}, 'Algo quebrou nesta tela'),
      h('span', {}, String(e.message || e)),
      h('div', { class: 'mt flexb', style: { justifyContent: 'center' } },
        h('button', { class: 'btn btn--p', onclick: () => location.reload() }, 'Recarregar'),
        h('a', { class: 'btn', href: '#/inicio' }, 'Voltar ao início'))));
  }

  marcarAtiva(item.r);
  $('#side').classList.remove('open');
  $('.side__scrim').hidden = true;
  window.scrollTo({ top: 0 });
  document.title = `${item.t} · ${GRUPO.nome} Central`;
  trocaDeTela(alvo);
  atualizarTopo();
}

/* ==========================================================
   ATIVAÇÃO POR LINK
   ==========================================================
   Abrir o app com `#/ativar?chave=SUA_CHAVE` liga o Gemini de uma vez, sem
   ninguém digitar nada. Serve para o dono guardar um atalho pessoal.

   A chave vai no fragmento (depois do #), que o navegador NUNCA envia ao
   servidor — nem o GitHub Pages a vê. Ainda assim ela fica no endereço, então
   o app a tira da barra assim que guarda, e o aviso é claro: esse link é
   pessoal, quem o tiver usa a sua cota.                                     */
function ativacaoPorLink() {
  const corte = location.hash.indexOf('?');
  if (corte < 0) return false;
  const params = new URLSearchParams(location.hash.slice(corte + 1));
  const chave = (params.get('chave') || '').trim();
  if (!chave) return false;

  set((s) => {
    s.ia.chaveGemini = chave;
    s.ia.provedor = 'gemini';
    s.ia.modo = 'chave';
  });

  // limpa o endereço: a chave sai da barra, do histórico desta navegação e
  // de qualquer print de tela que a pessoa venha a tirar depois
  try {
    history.replaceState(null, '', `${location.pathname}#/conselheiro`);
  } catch { location.hash = '#/conselheiro'; }
  return true;
}

/* ==========================================================
   BOOT
   ========================================================== */
function iniciar() {
  // ?zerar apaga tudo deste aparelho (com confirmação) — link de recomeço
  if (new URLSearchParams(location.search).has('zerar')) {
    if (confirm('Zerar o KATSEYE Central neste aparelho? Todos os dados salvos aqui serão apagados.')) {
      try { localStorage.removeItem('katseye.central.v1'); } catch { /* segue */ }
      try { indexedDB.deleteDatabase('katseye-fotos'); } catch { /* segue */ }
    }
    location.replace(location.pathname + location.hash);
    return;
  }

  carregar();
  aplicarPrefs();
  montarMenu();

  const ligouPeloLink = ativacaoPorLink();

  addEventListener('hashchange', render);
  aoMudar(() => atualizarTopo());

  document.addEventListener('ks:erro-gravacao', (e) => {
    toast('Não consegui salvar — o armazenamento do navegador está cheio.', 'bad');
    console.error('Falha de gravação:', e.detail);
  });

  $('[data-abrir-menu]').addEventListener('click', () => {
    $('#side').classList.add('open');
    $('.side__scrim').hidden = false;
  });
  $$('[data-fechar-menu]').forEach((b) => b.addEventListener('click', () => {
    $('#side').classList.remove('open');
    $('.side__scrim').hidden = true;
  }));
  $$('[data-modal-fechar]').forEach((b) => b.addEventListener('click', fecharModal));
  $('[data-acao="busca"]').addEventListener('click', abrirBusca);
  $('[data-acao="notifs"]').addEventListener('click', abrirNotificacoes);
  $('[data-acao="perfil"]').addEventListener('click', () => irPara('config'));
  $('[data-acao="saude"]').addEventListener('click', () => irPara('agenda'));

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrirBusca(); }
  });

  if (!location.hash) location.hash = `#/${st().prefs.abrirEm || 'inicio'}`;
  render();

  $('#boot')?.remove();
  $('#app').hidden = false;

  if (ligouPeloLink) {
    set((s) => { s.visto.boasVindas = true; });   // não atrapalha com o modal
    toast('Gemini ligado neste aparelho 🎉', 'good');
    registrarAtivacao();
  }

  // primeira visita: uma palavra sobre o que é isso, e nada mais
  if (!st().visto.boasVindas) {
    setTimeout(() => {
      modal(`✨ Bem-vindo ao ${GRUPO.nome} Central`, h('div', { class: 'small' },
        h('p', {}, 'Um painel de gestão criativa dedicado ao ', h('b', {}, GRUPO.nome),
          ` (${GRUPO.gravadoras}): agenda inteligente, enciclopédia do grupo, estúdio de cartazes e `
          + 'ingressos, e um conselheiro para pensar junto.'),
        h('p', { class: 'mt' }, h('b', {}, 'Tudo fica no seu aparelho.'),
          ' Nada é enviado para servidor nenhum — a não ser as perguntas que você fizer com a IA ligada.'),
        h('p', { class: 'mt muted' },
          'Os dados do grupo que já vêm preenchidos são uma semente com o que é amplamente conhecido, '
          + 'não uma base oficial. Tudo é editável aqui dentro.'),
        h('div', { class: 'flexb mt2' },
          h('button', {
            class: 'btn btn--p sp',
            onclick: () => { set((s) => { s.visto.boasVindas = true; }); fecharModal(); },
          }, 'Começar'))));
    }, 500);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

/** Confirma que a chave do link funciona de verdade, sem travar a tela. */
async function registrarAtivacao() {
  const { perguntar } = await import('./ia.js');
  const r = await perguntar([], 'Responda apenas: ok');
  if (r.local) {
    set((s) => { s.ia.modo = 'local'; });
    toast(`A chave do link não funcionou: ${r.erro || 'recusada'}`, 'bad');
  } else {
    toast('Testado: o Conselheiro já está respondendo pela IA ✅', 'good');
  }
  render();
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciar);
else iniciar();
