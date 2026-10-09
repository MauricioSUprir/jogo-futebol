// Menus do GOLAÇO: abertura, menu principal, amistoso, Copa/Liga, configurações, controles,
// créditos, pausa e resultado. Todo o DOM é montado aqui dentro de `root` (ver CONTRACTS.md).
//
// Navegação: mouse/toque, teclado (setas movem o foco, Enter seleciona, Esc volta) e controle
// (direcional/analógico, A seleciona, B volta). O foco é espacial: vai para o item mais próximo
// na direção pedida.
//
// Pausa: showPause({ onResume, onRestart, onQuit, onSettings }). "Configurações" abre o painel dentro
// da pausa; ao fechá-lo chamamos onSettings(settings) para o núcleo aplicar o que mudou.
// "Sair" chama onQuit() e volta ao menu (ou ao painel do torneio, se era jogo de torneio).
// Partida do Total Match: showPause({ onResume, onSimRest, onSettings, cfg }) — sem Reiniciar/Sair,
// com "Simular o resto" (o computador termina o jogo e o placar vale).
import { DIFFICULTY, QUALITY, DEFAULT_SETTINGS, FORMATIONS, MODES, WEATHER } from './config.js';
import { TEAMS, teamById, crestSVG, kitSVG, resolveKits, teamStars, playerOverall } from './teams.js';
import * as TT from './tournament.js';

// ---------- helpers de DOM ----------
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) el.style.setProperty(p, x);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
// size = largura em "px de referência" (16px = 1em), assim tudo escala com a fonte da interface
const svgEl = (markup, cls = '', size) => h('span', { class: 'gm-svg ' + cls, html: markup, 'aria-hidden': 'true', style: size ? { width: size / 16 + 'em' } : null });

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>', left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.3-1.4M14.5 15.1l2.7 3.7M9.5 15.1l-2.7 3.7M8 10.4L3.7 9"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v3M8 21h8M9 17h6v4H9z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  pad: '<path d="M7 8h10a4 4 0 0 1 4 4l.6 4.2a2.3 2.3 0 0 1-4 1.8L15.5 16h-7l-2.1 2a2.3 2.3 0 0 1-4-1.8L3 12a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r=".6"/><circle cx="17.8" cy="13.3" r=".6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  sunset: '<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 4v4M4.2 10.2l2 1.4M19.8 10.2l-2 1.4M9 21h6"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>',
  touch: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="7.5" cy="13" r="2"/><circle cx="16" cy="11" r="1.2"/><circle cx="18" cy="14" r="1.2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>', exit: '<path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10"/>',
  whistle: '<circle cx="9" cy="14" r="5"/><path d="M13 11l8-3v4l-6.5 1.2"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  fast: '<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/>',
};
const icon = (n) => svgEl(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`, 'gm-ic');
const crest = (t, size, cls = '') => svgEl(crestSVG(t, size), 'gm-crest ' + cls, size);
const kit = (k, size, cls = '') => svgEl(kitSVG(k, size), 'gm-kit ' + cls, size);

// ---------- estado ----------
let S = null, root, bgEl, stage, toastEl, pauseEl = null, pauseCb = {}, pauseView = null, pauseOpenedAt = -1;
let mode = 'menu';            // 'splash' | 'menu' | 'ingame'
let stack = [];
let splashDone = false, lastCfg = null, lastMatch = null, ctrlTab = null;
const sel = { home: 0, away: 1, userSide: 'home', kit: { home: 'auto', away: 'auto' } };

export function initMenus({ root: r, settings, saveSettings, onStartMatch, audio }) {
  const st = settings || {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!(k in st)) st[k] = v;
  S = { settings: st, saveSettings: saveSettings || (() => {}), onStartMatch: onStartMatch || (() => {}), audio };
  root = r;
  root.classList.add('gm-root');
  bgEl = h('div', { class: 'gm-bg', 'aria-hidden': 'true' }, h('div', { class: 'gm-bg-pitch', html: PITCH_SVG }), h('div', { class: 'gm-bg-sweep' }), h('div', { class: 'gm-bg-glow' }));
  stage = h('main', { class: 'gm-stage' });
  toastEl = h('div', { class: 'gm-toast', role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(bgEl, stage, toastEl);
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('pointerdown', () => { root.classList.remove('gm-kbd'); unlockAudio(); });
  requestAnimationFrame(gpLoop);
  applyVolumes();
}

let audioUnlocked = false;
function unlockAudio() { if (audioUnlocked || !S?.audio) return; audioUnlocked = true; try { S.audio.unlock(); } catch { /* sem áudio */ } }
function applyVolumes() { try { S.audio?.setVolumes({ master: S.settings.volMaster, crowd: S.settings.volCrowd, sfx: S.settings.volSfx }); } catch { /* ok */ } }
function setSetting(k, v) { S.settings[k] = v; try { S.saveSettings(S.settings); } catch { /* ok */ } if (k.startsWith('vol')) applyVolumes(); }

// ---------- pilha de telas ----------
function mount(focusKey) {
  const el = stack[stack.length - 1]();
  el.classList.add('gm-screen');
  stage.replaceChildren(el);
  stage.scrollTop = 0; root.scrollTop = 0;
  requestAnimationFrame(() => focusIn(el, focusKey));
}
const focusMemo = new WeakMap();   // tela -> item focado ao sair dela (para voltar no mesmo lugar)
const go = (render) => {
  const top = stack[stack.length - 1], k = document.activeElement?.dataset?.key;
  if (top && k) focusMemo.set(top, k);
  stack.push(render); mount();
};
const reset = (renders) => { stack = renders; mount(); };
const rerender = () => mount(document.activeElement?.dataset?.key);
function back() {
  const esc = stage.querySelector('[data-esc]');
  if (esc) { esc.click(); return; }
  if (stack.length > 1) { stack.pop(); mount(focusMemo.get(stack[stack.length - 1])); }
}
function focusIn(scope, key) {
  const t = (key && scope.querySelector(`[data-key="${CSS.escape(key)}"]`)) || scope.querySelector('[data-autofocus]') || focusables(scope)[0];
  t?.focus({ preventScroll: true });
  t?.scrollIntoView?.({ block: 'nearest' });
}
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2600);
}

// partida aberta sem passar pelos menus (Total Match): teclado e controle ficam com o jogo
export function enterGame() {
  mode = 'ingame';
  document.activeElement?.blur?.();
  stage.replaceChildren();
  root.classList.add('gm-ingame');
}
function leaveGame() { mode = 'menu'; root.classList.remove('gm-ingame'); }

// ---------- API pública ----------
export function showMainMenu() {
  hidePause();
  leaveGame();
  if (!splashDone) { showSplash(); return; }
  reset([scrMain]);
}

export function showPause(cb = {}) {
  pauseCb = cb || {};
  pauseOpenedAt = performance.now();
  if (!pauseEl) { pauseEl = h('div', { class: 'gm-pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pausa' }); root.append(pauseEl); }
  pauseEl.hidden = false;
  renderPause('main');
}

export function hidePause() {
  if (!pauseEl || pauseEl.hidden) return;
  if (pauseView === 'settings') pauseCb.onSettings?.(S.settings);
  pauseEl.hidden = true; pauseEl.replaceChildren(); pauseView = null;
}

export function showMatchResult(result, { onContinue } = {}) {
  hidePause();
  leaveGame();
  const cfg = lastCfg;
  let st = null, champ = false;
  if (cfg && cfg.fixtureId && cfg.mode !== 'amistoso') {
    st = TT.loadTournament();
    if (st && st.type === cfg.mode) {
      const had = !!st.champion;
      TT.recordResult(st, cfg.fixtureId, result);
      TT.simulateRound(st);
      champ = !had && !!st.champion;
    } else st = null;
  }
  const cont = () => {
    onContinue?.();
    if (st) reset(champ ? [scrMain, scrHub, scrChampion] : [scrMain, scrHub]);
    else reset([scrMain]);
  };
  const rematch = !st && lastMatch ? () => { onContinue?.(); startMatch(lastMatch); } : null;
  reset([() => scrResult(result, cfg, { cont, rematch, st })]);
}

// ---------- entrada no jogo ----------
function startMatch(m) {
  const k = resolveKits(m.home, m.away, m.kit || {});
  const cfg = { mode: m.mode, home: m.home, away: m.away, homeKit: k.homeKit, awayKit: k.awayKit, homeGK: k.homeGK, awayGK: k.awayGK,
    userSide: m.userSide, knockout: m.mode === 'copa', settings: { ...S.settings } };
  if (m.fixtureId) cfg.fixtureId = m.fixtureId;
  lastCfg = cfg; lastMatch = m;
  enterGame();
  S.onStartMatch(cfg);
}

// ---------- componentes ----------
function logo(size = 'big') {
  return h('div', { class: `gm-logo gm-logo-${size}` },
    h('span', { class: 'gm-logo-word' }, 'GOLA', h('span', { class: 'gm-logo-c' }, 'Ç'), 'O'),
    h('span', { class: 'gm-logo-bar' }));
}

function topbar(title, sub) {
  return h('header', { class: 'gm-top' },
    h('button', { class: 'gm-back', 'data-key': 'back', 'aria-label': 'Voltar', onclick: back }, icon('back'), h('span', {}, 'Voltar'), h('kbd', {}, 'Esc')),
    h('div', { class: 'gm-top-title' }, h('h1', {}, title), sub ? h('p', {}, sub) : null),
    logo('small'));
}

function btn(label, onclick, { cls = '', key, autofocus, ic, esc } = {}) {
  return h('button', { class: 'gm-btn ' + cls, onclick, 'data-key': key || null, 'data-autofocus': autofocus || null, 'data-esc': esc || null },
    ic ? icon(ic) : null, h('span', {}, label));
}

function stars(t) {
  const n = teamStars(t);
  return h('span', { class: 'gm-stars', 'aria-label': `${String(n).replace('.', ',')} estrelas` },
    [0, 1, 2, 3, 4].map(i => h('i', { class: n >= i + 1 ? 'f' : n >= i + 0.5 ? 'h' : '' }, '★')));
}

function teamLines(t) {
  const slots = FORMATIONS[t.formation];
  const g = { ATT: [], MID: [], DEF: [] };
  slots.forEach((s, i) => g[s[0]]?.push(playerOverall(t.players[i])));
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const all = avg([...g.ATT, ...g.MID, ...g.DEF]);
  return [['ATA', g.ATT], ['MEI', g.MID], ['DEF', g.DEF]].map(([l, a]) => [l, Math.round(t.rating + avg(a) - all)]);
}

function lineBars(t) {
  return h('div', { class: 'gm-lines' }, teamLines(t).map(([l, v]) =>
    h('div', { class: 'gm-line' }, h('span', {}, l), h('b', {}, v), h('i', { style: { '--v': `${Math.max(0, (v - 60) / 35) * 100}%` } }))));
}

function stars3(t) {
  const top = t.players.slice(0, 11).map(p => ({ p, o: playerOverall(p) })).sort((a, b) => b.o - a.o).slice(0, 3);
  return h('div', { class: 'gm-keyp' }, h('h3', {}, 'Destaques'),
    top.map(({ p, o }) => h('div', { class: 'gm-keyp-row' }, h('span', { class: 'num' }, p.num), h('span', { class: 'nm' }, p.name), h('span', { class: 'ps' }, p.pos), h('b', {}, o))));
}

function seg(key, options, { onChange, small } = {}) {
  const wrap = h('div', { class: 'gm-seg' + (small ? ' gm-seg-sm' : ''), role: 'radiogroup' });
  const paint = () => wrap.querySelectorAll('button').forEach(b => { const on = b.dataset.v === String(S.settings[key]); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  for (const [v, label, ic] of options) {
    wrap.append(h('button', { role: 'radio', 'data-v': String(v), 'data-key': `${key}-${v}`,
      onclick: () => { setSetting(key, v); paint(); onChange?.(v); } }, ic ? icon(ic) : null, h('span', {}, label)));
  }
  paint();
  return wrap;
}

function toggle(key, label) {
  const b = h('button', { class: 'gm-toggle', role: 'switch', 'data-key': key, 'aria-label': label },
    h('span', { class: 'gm-toggle-track' }, h('span', { class: 'gm-toggle-knob' })), h('span', { class: 'gm-toggle-txt' }));
  const paint = () => { b.setAttribute('aria-checked', !!S.settings[key]); b.lastChild.textContent = S.settings[key] ? 'Ligado' : 'Desligado'; };
  b.addEventListener('click', () => { setSetting(key, !S.settings[key]); paint(); });
  paint();
  return b;
}

function slider(key, label) {
  const out = h('output', {}, Math.round(S.settings[key] * 100));
  const inp = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(S.settings[key] * 100), 'data-key': key, 'aria-label': label });
  const paint = () => { out.textContent = inp.value; inp.style.setProperty('--p', inp.value + '%'); };
  inp.addEventListener('input', () => { setSetting(key, +inp.value / 100); paint(); });
  paint();
  return h('div', { class: 'gm-slider' }, inp, out);
}

// slider com faixa própria (ex.: tamanho dos botões 70–140%)
function sliderRange(key, label, min, max) {
  const v0 = Math.round((S.settings[key] ?? 1) * 100);
  const out = h('output', {}, v0 + '%');
  const inp = h('input', { type: 'range', min, max, step: 5, value: v0, 'data-key': key, 'aria-label': label });
  const paint = () => { out.textContent = inp.value + '%'; inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%'); };
  inp.addEventListener('input', () => { setSetting(key, +inp.value / 100); paint(); dispatchEvent(new CustomEvent('golaco:touch-layout')); });
  paint();
  return h('div', { class: 'gm-slider' }, inp, out);
}

const row = (label, desc, control) => h('div', { class: 'gm-row' }, h('div', { class: 'gm-row-l' }, h('b', {}, label), desc ? h('small', {}, desc) : null), control);

// ---------- abertura ----------
function showSplash() {
  mode = 'splash';
  stack = [];
  const touch = matchMedia('(pointer: coarse)').matches;
  const el = h('section', { class: 'gm-screen gm-splash', tabindex: '-1' },
    h('div', { class: 'gm-splash-inner' },
      h('p', { class: 'gm-splash-kicker' }, 'Temporada fictícia · futebol 3D'),
      logo('huge'),
      h('p', { class: 'gm-splash-prompt' }, touch ? 'Toque para começar' : 'Pressione qualquer tecla')),
    h('div', { class: 'gm-splash-foot' }, 'Clubes e jogadores fictícios'));
  el.addEventListener('click', leaveSplash);
  stage.replaceChildren(el);
  el.focus({ preventScroll: true });
}
function leaveSplash() {
  if (mode !== 'splash') return;
  unlockAudio();
  splashDone = true; mode = 'menu';
  reset([scrMain]);
}

// ---------- menu principal ----------
function scrMain() {
  const st = TT.loadTournament();
  const chip = (type) => (st && st.type === type ? h('span', { class: 'gm-chip' }, st.champion ? 'Encerrada' : 'Em andamento') : null);
  const tile = (key, title, desc, ic, onclick, extra = {}) => h('button', { class: `gm-tile gm-tile-${key}`, 'data-key': key, 'data-autofocus': extra.autofocus || null, onclick },
    h('span', { class: 'gm-tile-art' }, extra.art || icon(ic)),
    h('span', { class: 'gm-tile-body' }, extra.chip || null, h('span', { class: 'gm-tile-title' }, title), h('span', { class: 'gm-tile-desc' }, desc)),
    h('span', { class: 'gm-tile-go' }, icon('right')));
  const small = (key, title, ic, onclick) => h('button', { class: 'gm-tile gm-tile-small', 'data-key': key, onclick }, icon(ic), h('span', {}, title));
  return h('section', { class: 'gm-main' },
    h('div', { class: 'gm-main-brand' },
      logo('big'),
      h('p', { class: 'gm-tagline' }, 'Futebol 3D no navegador'),
      h('div', { class: 'gm-main-crests' }, TEAMS.map(t => crest(t, 34)))),
    h('nav', { class: 'gm-tiles', 'aria-label': 'Menu principal' },
      tile('amistoso', 'Amistoso', 'Partida rápida · escolha clubes, uniformes e lado', 'ball', () => go(scrTeamSelect),
        { autofocus: true, art: h('span', { class: 'gm-tile-duo' }, crest(TEAMS[sel.home], 110), crest(TEAMS[sel.away], 110)) }),
      tile('copa', 'Copa GOLAÇO', 'Mata-mata com 8 clubes · sorteio', 'trophy', () => go(() => scrTourEntry('copa')), { chip: chip('copa') }),
      tile('liga', 'Liga GOLAÇO', 'Pontos corridos · 7 rodadas', 'table', () => go(() => scrTourEntry('liga')), { chip: chip('liga') }),
      h('div', { class: 'gm-tiles-small' },
        small('config', 'Configurações', 'gear', () => go(scrSettings)),
        small('controles', 'Controles', 'pad', () => go(scrControls)),
        small('creditos', 'Créditos', 'info', () => go(scrCredits)))),
    hints());
}

const hints = () => h('footer', { class: 'gm-hints' },
  h('span', {}, h('kbd', {}, '↑↓←→'), 'Navegar'), h('span', {}, h('kbd', {}, 'Enter'), 'Selecionar'), h('span', {}, h('kbd', {}, 'Esc'), 'Voltar'));

// ---------- amistoso: escolha de times ----------
function cycle(side, d) {
  const other = side === 'home' ? sel.away : sel.home;
  let i = sel[side];
  do i = (i + d + TEAMS.length) % TEAMS.length; while (i === other);
  sel[side] = i; sel.kit = { home: 'auto', away: 'auto' };
  rerender();
}

function scrTeamSelect() {
  const home = TEAMS[sel.home], away = TEAMS[sel.away];
  const k = resolveKits(home, away, sel.kit);
  const panel = (s) => {
    const t = s === 'home' ? home : away;
    const kitShown = s === 'home' ? k.homeKit : k.awayKit, gk = s === 'home' ? k.homeGK : k.awayGK;
    const isUser = sel.userSide === s;
    return h('div', { class: `gm-side gm-side-${s}` + (isUser ? ' is-user' : ''), style: { '--tc': t.colors.primary, '--tc2': t.colors.secondary } },
      h('div', { class: 'gm-side-head' },
        h('span', { class: 'gm-side-label' }, s === 'home' ? 'Mandante' : 'Visitante'),
        h('span', { class: 'gm-ctrl' }, isUser ? h('span', {}, icon('pad'), 'Você') : 'CPU')),
      h('div', { class: 'gm-carousel' },
        h('button', { class: 'gm-arrow', 'data-key': s + '-prev', 'aria-label': 'Time anterior', onclick: () => cycle(s, -1) }, icon('left')),
        h('div', { class: 'gm-carousel-crest' }, crest(t, 120)),
        h('button', { class: 'gm-arrow', 'data-key': s + '-next', 'aria-label': 'Próximo time', onclick: () => cycle(s, 1) }, icon('right'))),
      h('div', { class: 'gm-side-info' },
        h('h2', { class: 'gm-team-name' }, t.name),
        h('p', { class: 'gm-team-meta' }, h('span', {}, t.city), h('span', { class: 'gm-dot' }), h('span', {}, t.formation)),
        h('div', { class: 'gm-team-rate' }, stars(t), h('b', {}, t.rating))),
      lineBars(t),
      stars3(t),
      h('div', { class: 'gm-kitrow' },
        kit(kitShown, 64),
        kit(gk, 38, 'gm-kit-gk'),
        h('button', { class: 'gm-kitbtn', 'data-key': s + '-kit', onclick: () => { sel.kit[s] = kitShown === t.kits.home ? 'away' : 'home'; rerender(); } },
          icon('swap'), h('span', {}, h('b', {}, kitShown === t.kits.home ? 'Principal' : 'Reserva'), h('small', {}, sel.kit[s] === 'auto' ? 'automático' : 'manual')))));
  };
  const pickSide = (v, label, ic) => h('button', { class: 'gm-sidepick-btn' + (sel.userSide === v ? ' on' : ''), role: 'radio', 'aria-checked': sel.userSide === v, 'data-key': 'side-' + v,
    onclick: () => { sel.userSide = v; rerender(); } }, icon(ic), h('span', {}, label));
  const note = k.clash ? h('p', { class: 'gm-warn' }, 'Uniformes parecidos — troque um deles')
    : k.auto ? h('p', { class: 'gm-note' }, icon('check'), 'Cores parecidas: visitante com reserva') : null;
  return h('section', { class: 'gm-select' },
    topbar('Amistoso', 'Escolha os clubes e quem você controla'),
    h('div', { class: 'gm-select-grid' },
      panel('home'),
      h('div', { class: 'gm-vs-col' },
        h('div', { class: 'gm-vs' }, 'VS'),
        h('div', { class: 'gm-sidepick', role: 'radiogroup', 'aria-label': 'Quem você controla' },
          pickSide('home', 'Jogar com mandante', 'left'), pickSide('none', 'Assistir CPU x CPU', 'play'), pickSide('away', 'Jogar com visitante', 'right')),
        note,
        btn('Próximo', () => go(() => scrMatchOptions({ mode: 'amistoso', home, away, userSide: sel.userSide, kit: { ...sel.kit } })), { cls: 'gm-btn-primary', key: 'next', autofocus: true, ic: 'right' })),
      panel('away')));
}

// ---------- opções da partida ----------
function matchOptionsBody(inPause) {
  return [
    row('Dificuldade', inPause ? 'Vale a partir da próxima partida' : null, seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]))),
    row('Duração de cada tempo', 'Minutos reais', seg('halfMinutes', [2, 3, 4, 6, 8, 10].map(m => [m, `${m} min`]), { small: true })),
    row('Horário', null, seg('timeOfDay', [['dia', 'Dia', 'sun'], ['tarde', 'Tarde', 'sunset'], ['noite', 'Noite', 'moon']])),
  ];
}

function scrMatchOptions(m) {
  const k = resolveKits(m.home, m.away, m.kit || {});
  const you = (s) => (m.userSide === s ? h('span', { class: 'gm-you' }, 'Você') : null);
  return h('section', { class: 'gm-options' },
    topbar('Opções da partida', m.mode === 'amistoso' ? 'Amistoso' : `${m.mode === 'copa' ? 'Copa' : 'Liga'} GOLAÇO · ${m.roundName || ''}`),
    h('div', { class: 'gm-options-grid' },
      h('div', { class: 'gm-matchup' },
        h('div', { class: 'gm-mu-team' }, crest(m.home, 88), kit(k.homeKit, 44), h('b', {}, m.home.name), you('home')),
        h('div', { class: 'gm-mu-x' }, 'x'),
        h('div', { class: 'gm-mu-team' }, crest(m.away, 88), kit(k.awayKit, 44), h('b', {}, m.away.name), you('away'))),
      h('div', { class: 'gm-panel gm-options-panel' }, matchOptionsBody(false),
        h('div', { class: 'gm-actions' }, btn('Entrar em campo', () => startMatch(m), { cls: 'gm-btn-primary', key: 'start', autofocus: true, ic: 'whistle' })))));
}

// ---------- Copa / Liga ----------
const TNAME = { copa: 'Copa GOLAÇO', liga: 'Liga GOLAÇO' };

function scrTourEntry(type) {
  const st = TT.loadTournament();
  if (!st || st.type !== type) return scrTourPick(type, st);
  const u = teamById(st.user);
  const status = st.champion ? `Encerrada · campeão: ${teamById(st.champion).name}` : TT.roundLabel(st);
  return h('section', { class: 'gm-entry' },
    topbar(TNAME[type], 'Competição salva'),
    h('div', { class: 'gm-entry-card gm-panel', style: { '--tc': u.colors.primary } },
      crest(u, 110),
      h('div', {}, h('p', { class: 'gm-kicker' }, 'Seu clube'), h('h2', {}, u.name), h('p', { class: 'gm-muted' }, status)),
      h('div', { class: 'gm-actions' },
        btn('Continuar', () => { stack.pop(); go(scrHub); }, { cls: 'gm-btn-primary', autofocus: true, ic: 'play', key: 'cont' }),
        btn('Nova competição', () => go(() => scrTourPick(type, st)), { key: 'new', ic: 'restart' }))));
}

function scrTourPick(type, existing) {
  const warn = existing && !existing.champion
    ? h('p', { class: 'gm-warn' }, `Atenção: começar agora apaga a ${existing.type === 'copa' ? 'Copa' : 'Liga'} em andamento.`) : null;
  const create = (t) => {
    if (type === 'copa') TT.createCup(t.id); else TT.createLeague(t.id);
    reset([scrMain, scrHub]);
    toast(type === 'copa' ? 'Sorteio realizado! Confira a chave.' : 'Tabela criada! 7 rodadas pela frente.');
  };
  return h('section', { class: 'gm-pick' },
    topbar(TNAME[type], 'Escolha o seu clube'),
    warn,
    h('div', { class: 'gm-pick-grid' }, TEAMS.map((t, i) => h('button', { class: 'gm-teamcard', 'data-key': 'pick-' + t.id, 'data-autofocus': i === 0 || null,
      style: { '--tc': t.colors.primary, '--tc2': t.colors.secondary }, onclick: () => create(t) },
    crest(t, 72), h('span', { class: 'gm-tc-name' }, t.name), h('span', { class: 'gm-tc-meta' }, `${t.formation} · ${t.city}`),
    h('span', { class: 'gm-tc-rate' }, stars(t), h('b', {}, t.rating))))));
}

function scoreText(f) {
  if (!f.played) return 'x';
  return `${f.hg} – ${f.ag}`;
}

function miniFixture(st, f) {
  const w = f ? TT.fixtureWinner(f) : null;
  const line = (id, g, p) => {
    if (!id) return h('div', { class: 'gm-bk-row tbd' }, h('span', { class: 'gm-bk-crest' }), h('span', { class: 'gm-bk-name' }, 'A definir'), h('b', {}, ''));
    const t = teamById(id);
    return h('div', { class: 'gm-bk-row' + (w === id ? ' win' : w ? ' lose' : '') + (id === st.user ? ' user' : '') },
      crest(t, 20, 'gm-bk-crest'), h('span', { class: 'gm-bk-name' }, h('span', { class: 'l' }, t.name), h('span', { class: 's' }, t.short)),
      h('b', {}, f && f.played ? g : ''), p != null ? h('small', {}, `(${p})`) : null);
  };
  return h('div', { class: 'gm-bk-match' },
    line(f?.home, f?.hg, f?.pens?.home), line(f?.away, f?.ag, f?.pens?.away));
}

function bracket(st) {
  const cols = st.rounds.map((r, i) => {
    const n = [4, 2, 1][i];
    const fx = Array.from({ length: n }, (_, j) => r.fixtures[j] || null);
    return h('div', { class: 'gm-bk-col' + (i === st.current ? ' now' : '') }, h('h3', {}, ['Quartas', 'Semi', 'Final'][i]),
      h('div', { class: 'gm-bk-list' }, fx.map(f => miniFixture(st, f))));
  });
  const ch = st.champion ? teamById(st.champion) : null;
  cols.push(h('div', { class: 'gm-bk-col gm-bk-champ' }, h('h3', {}, 'Campeão'),
    h('div', { class: 'gm-bk-list' }, h('div', { class: 'gm-bk-trophy' + (ch ? ' on' : '') }, ch ? crest(ch, 54) : icon('trophy'), h('span', {}, ch ? ch.short : '?')))));
  return h('div', { class: 'gm-panel gm-bracket' }, cols);
}

function leagueTable(st) {
  const rows = TT.standings(st);
  return h('div', { class: 'gm-panel gm-tablewrap' }, h('table', { class: 'gm-table' },
    h('thead', {}, h('tr', {}, ['#', 'Clube', 'P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].map((c, i) => h('th', { class: i > 6 && i < 9 ? 'opt' : null, scope: 'col' }, c)))),
    h('tbody', {}, rows.map((r, i) => {
      const t = teamById(r.id);
      return h('tr', { class: (r.id === st.user ? 'user' : '') + (i === 0 ? ' lead' : '') },
        h('td', { class: 'pos' }, i + 1),
        h('td', { class: 'club' }, crest(t, 22), h('span', { class: 'l' }, t.name), h('span', { class: 's' }, t.short)),
        h('td', { class: 'pts' }, r.P), h('td', {}, r.J), h('td', {}, r.V), h('td', {}, r.E), h('td', {}, r.D),
        h('td', { class: 'opt' }, r.GP), h('td', { class: 'opt' }, r.GC), h('td', {}, r.SG > 0 ? '+' + r.SG : r.SG));
    }))));
}

function lastResults(st) {
  let idx = -1;
  for (let i = st.rounds.length - 1; i >= 0; i--) if (st.rounds[i].fixtures.some(f => f.played)) { idx = i; break; }
  if (idx < 0) return null;
  const r = st.rounds[idx];
  return h('div', { class: 'gm-panel gm-results' }, h('h3', {}, `Resultados · ${r.name}`),
    r.fixtures.filter(f => f.played).map(f => {
      const a = teamById(f.home), b = teamById(f.away);
      return h('div', { class: 'gm-res-row' + (f.home === st.user || f.away === st.user ? ' user' : '') },
        h('span', { class: 'n r' }, a.short), crest(a, 18), h('b', {}, `${f.hg} – ${f.ag}`), crest(b, 18), h('span', { class: 'n' }, b.short),
        f.pens ? h('small', {}, `pên. ${f.pens.home}–${f.pens.away}`) : null);
    }));
}

function scorersPanel(st) {
  const list = TT.topScorers(st, 5);
  if (!list.length) return null;
  return h('div', { class: 'gm-panel gm-scorers-top' }, h('h3', {}, 'Artilharia'),
    list.map((s, i) => h('div', { class: 'gm-sc-row' }, h('span', { class: 'rk' }, i + 1), crest(teamById(s.team), 18), h('span', { class: 'n' }, s.name), h('b', {}, s.goals))));
}

function simUser(st) {
  const done = TT.simulateRound(st, { includeUser: true });
  const f = done.find(x => x.home === st.user || x.away === st.user);
  if (f) toast(`Simulado: ${teamById(f.home).short} ${f.hg} – ${f.ag} ${teamById(f.away).short}${f.pens ? ` (pên. ${f.pens.home}–${f.pens.away})` : ''}`);
  if (st.champion) go(scrChampion); else rerender();
}

function nextCard(st) {
  const u = teamById(st.user);
  if (st.champion) {
    const c = teamById(st.champion);
    return h('div', { class: 'gm-panel gm-next gm-next-champ', style: { '--tc': c.colors.primary } },
      h('p', { class: 'gm-kicker' }, 'Campeão'), crest(c, 84), h('h2', {}, c.name),
      h('div', { class: 'gm-actions' }, btn('Celebrar', () => go(scrChampion), { cls: 'gm-btn-primary', autofocus: true, ic: 'trophy', key: 'celebrate' }),
        btn('Nova competição', () => go(() => scrTourPick(st.type, null)), { key: 'new', ic: 'restart' })));
  }
  if (TT.userEliminated(st)) {
    return h('div', { class: 'gm-panel gm-next' },
      h('p', { class: 'gm-kicker' }, 'Fim da linha'), crest(u, 64, 'dim'), h('p', { class: 'gm-muted' }, `O ${u.name} foi eliminado. A copa continua.`),
      h('div', { class: 'gm-actions' }, btn(`Simular ${TT.roundLabel(st).toLowerCase()}`, () => simUser(st), { cls: 'gm-btn-primary', autofocus: true, ic: 'play', key: 'simnext' })));
  }
  const f = TT.nextUserFixture(st);
  if (!f) return h('div', { class: 'gm-panel gm-next' }, btn('Avançar', () => { TT.simulateRound(st); rerender(); }, { cls: 'gm-btn-primary', autofocus: true }));
  const a = teamById(f.home), b = teamById(f.away);
  const userSide = f.home === st.user ? 'home' : 'away';
  return h('div', { class: 'gm-panel gm-next' },
    h('p', { class: 'gm-kicker' }, `Próxima partida · ${TT.roundLabel(st)}`),
    h('div', { class: 'gm-next-mu' },
      h('div', {}, crest(a, 64), h('b', {}, a.short)), h('span', { class: 'gm-next-x' }, 'x'), h('div', {}, crest(b, 64), h('b', {}, b.short))),
    h('p', { class: 'gm-muted' }, `${userSide === 'home' ? 'Em casa' : 'Fora de casa'} · ${a.stadium}${st.type === 'copa' ? ' · mata-mata' : ''}`),
    h('div', { class: 'gm-actions' },
      btn('Jogar', () => go(() => scrMatchOptions({ mode: st.type, home: a, away: b, userSide, kit: {}, fixtureId: f.id, roundName: TT.roundLabel(st) })), { cls: 'gm-btn-primary', autofocus: true, ic: 'play', key: 'play' }),
      btn('Simular', () => simUser(st), { key: 'sim', ic: 'restart' })));
}

function scrHub() {
  const st = TT.loadTournament();
  if (!st) { queueMicrotask(() => reset([scrMain])); return h('section', {}); }
  const u = teamById(st.user);
  return h('section', { class: 'gm-hub' },
    topbar(TNAME[st.type], st.champion ? 'Competição encerrada' : `${TT.roundLabel(st)} · ${u.name}`),
    h('div', { class: 'gm-hub-grid' },
      h('div', { class: 'gm-hub-main' }, st.type === 'copa' ? bracket(st) : leagueTable(st)),
      h('div', { class: 'gm-hub-side' }, nextCard(st), lastResults(st), scorersPanel(st))));
}

function confetti(colors) {
  const box = h('div', { class: 'gm-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 110; i++) {
    box.append(h('i', { style: { '--x': `${Math.random() * 100}%`, '--d': `${-Math.random() * 6}s`, '--t': `${3.5 + Math.random() * 3}s`,
      '--r': `${Math.random() * 720 - 360}deg`, '--s': `${0.6 + Math.random() * 0.8}`, background: colors[i % colors.length] } }));
  }
  return box;
}

function scrChampion() {
  const st = TT.loadTournament();
  if (!st || !st.champion) { queueMicrotask(() => reset([scrMain])); return h('section', {}); }
  const c = teamById(st.champion), you = st.champion === st.user;
  return h('section', { class: 'gm-champ', style: { '--tc': c.colors.primary, '--tc2': c.colors.secondary } },
    confetti([c.colors.primary, c.colors.secondary, '#1ee37a', '#ffffff', '#ffd23f']),
    h('div', { class: 'gm-champ-inner' },
      h('p', { class: 'gm-kicker' }, TNAME[st.type]),
      h('div', { class: 'gm-champ-crest' }, crest(c, 170)),
      h('h1', { class: 'gm-champ-title' }, 'Campeão'),
      h('h2', {}, c.name),
      h('p', { class: 'gm-muted' }, you ? 'Você levou o título! Noite histórica em ' + c.city + '.' : `O título ficou com o ${c.name}. Tente de novo!`),
      h('div', { class: 'gm-actions' },
        btn('Ver competição', () => { stack.length > 1 ? back() : reset([scrMain, scrHub]); }, { cls: 'gm-btn-primary', autofocus: true, key: 'see' }),
        btn('Nova competição', () => reset([scrMain, () => scrTourPick(st.type, null)]), { key: 'new', ic: 'restart' }),
        btn('Menu principal', () => reset([scrMain]), { key: 'menu' }))));
}

// ---------- resultado ----------
const STAT_LABELS = [['possession', 'Posse de bola', '%'], ['shots', 'Finalizações'], ['onTarget', 'No alvo'], ['fouls', 'Faltas'],
  ['corners', 'Escanteios'], ['offsides', 'Impedimentos'], ['yellow', 'Cartões amarelos'], ['red', 'Cartões vermelhos']];

function scrResult(res, cfg, { cont, rematch, st }) {
  const home = cfg?.home, away = cfg?.away;
  const hg = res.homeGoals | 0, ag = res.awayGoals | 0;
  let tag = 'Fim de jogo', tone = '';
  if (cfg && cfg.userSide !== 'none') {
    const my = cfg.userSide === 'home' ? [hg, ag, res.pens?.home, res.pens?.away] : [ag, hg, res.pens?.away, res.pens?.home];
    const win = my[0] > my[1] || (my[0] === my[1] && my[2] > my[3]);
    const lose = my[0] < my[1] || (my[0] === my[1] && my[2] < my[3]);
    tag = win ? 'Vitória' : lose ? 'Derrota' : 'Empate'; tone = win ? 'win' : lose ? 'lose' : 'draw';
  }
  const rn = st?.rounds.find(r => r.fixtures.some(f => f.id === cfg.fixtureId))?.name;
  const ctx = cfg ? (cfg.mode === 'amistoso' ? 'Amistoso' : TNAME[cfg.mode] + (rn ? ` · ${rn}` : '')) : '';
  const side = (t, s) => h('div', { class: 'gm-rs-team' }, t ? crest(t, 96) : null, h('b', {}, t ? t.name : s === 'home' ? 'Mandante' : 'Visitante'));
  const sc = (s) => h('ul', { class: 'gm-rs-goals ' + s }, (res.scorers || []).filter(x => x.side === s).map(x => h('li', {}, icon('ball'), h('span', {}, x.name), h('b', {}, `${x.minute}'`))));
  const stats = res.stats || {};
  return h('section', { class: 'gm-result' },
    h('div', { class: 'gm-result-inner' },
      h('p', { class: `gm-rs-tag ${tone}` }, h('span', {}, tag), ctx ? h('small', {}, ctx) : null),
      h('div', { class: 'gm-rs-score' },
        side(home, 'home'),
        h('div', { class: 'gm-rs-num' }, h('span', {}, hg), h('i', {}, '–'), h('span', {}, ag),
          res.pens ? h('small', {}, `Pênaltis ${res.pens.home} – ${res.pens.away}`) : null),
        side(away, 'away')),
      h('div', { class: 'gm-rs-scorers' }, sc('home'), sc('away')),
      h('div', { class: 'gm-panel gm-rs-stats' }, STAT_LABELS.filter(([k]) => Array.isArray(stats[k])).map(([k, label, unit = '']) => {
        const [a, b] = stats[k].map(v => +v || 0);
        const tot = a + b || 1;
        return h('div', { class: 'gm-stat' },
          h('b', {}, a + unit), h('span', {}, label), h('b', {}, b + unit),
          h('div', { class: 'gm-stat-bar' }, h('i', { class: 'a', style: { '--w': `${(a / tot) * 100}%`, '--c': cfg?.homeKit?.shirt || '#1ee37a' } }),
            h('i', { class: 'b', style: { '--w': `${(b / tot) * 100}%`, '--c': cfg?.awayKit?.shirt || '#fff' } })));
      })),
      h('div', { class: 'gm-actions gm-actions-center' },
        btn(st ? 'Continuar' : 'Menu principal', cont, { cls: 'gm-btn-primary', autofocus: true, esc: true, ic: 'right', key: 'cont' }),
        rematch ? btn('Revanche', rematch, { key: 'rematch', ic: 'restart' }) : null)));
}

// ---------- configurações ----------
function settingsBody(inPause) {
  const sec = (title, ...rows) => h('div', { class: 'gm-panel gm-set-sec' }, h('h3', {}, title), rows);
  return h('div', { class: 'gm-set-grid' },
    sec('Partida', ...matchOptionsBody(inPause), row('Vento', 'Afeta a bola em chutes longos', toggle('wind', 'Vento')),
      row('Clima', 'A chuva muda a bola (escorrega, quica menos) e o gramado', seg('weather', [...Object.entries(WEATHER).map(([k, w]) => [k, w.label]), ['aleatorio', 'Aleatório']], { small: true }))),
    sec('Jogo', row('Câmera', null, seg('camera', [['tv', 'TV'], ['pro', 'Pro'], ['aerea', 'Aérea']])),
      row('Modo de jogo', 'Authentic 0,93× (recomendado) · Competitivo 1,0× resposta máxima · Simulação 0,85× mais peso e erros · Arcade 1,08× mais chances',
        seg('gameMode', Object.entries(MODES).map(([k, mo]) => [k, mo.label]), { small: true, onChange: (v) => setSetting('gameSpeed', MODES[v].speed) })),
      row('Assistência de passe', 'Corrige a mira dos passes', toggle('passAssist', 'Assistência de passe')),
      row('Radar', 'Minimapa na parte de baixo', toggle('radar', 'Radar')),
      row('Nomes dos jogadores', 'Nome sobre o jogador controlado', toggle('names', 'Nomes dos jogadores')),
      row('Vibração', 'Controle e celular', toggle('vibration', 'Vibração'))),
    sec('Toque (celular)',
      row('Tamanho dos botões', null, sliderRange('touchScale', 'Tamanho dos botões', 70, 140)),
      row('Transparência', 'Opacidade dos botões', sliderRange('touchOpacity', 'Opacidade dos botões', 30, 100)),
      row('Tocar no jogador', 'Sem a bola, tocar num companheiro seleciona ele', toggle('tapSelect', 'Tocar no jogador')),
      row('Posição dos botões', 'Arraste cada botão para onde preferir',
        h('button', { class: 'gm-btn gm-btn-sm', 'data-key': 'edit-touch', onclick: () => dispatchEvent(new CustomEvent('golaco:edit-touch')) }, h('span', {}, 'Ajustar')))),
    sec('Vídeo', row('Qualidade gráfica', 'Automático ajusta pelo desempenho', seg('quality', [['auto', 'Auto'], ...Object.entries(QUALITY).map(([k, q]) => [k, q.label])], { small: true }))),
    sec('Áudio', row('Volume geral', null, slider('volMaster', 'Volume geral')), row('Torcida', null, slider('volCrowd', 'Volume da torcida')),
      row('Efeitos', null, slider('volSfx', 'Volume dos efeitos'))),
    h('div', { class: 'gm-actions' }, btn('Restaurar padrões', () => {
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) S.settings[k] = v;
      try { S.saveSettings(S.settings); } catch { /* ok */ }
      applyVolumes();
      if (inPause) renderPause('settings'); else rerender();
      toast('Configurações restauradas');
    }, { cls: 'gm-btn-ghost', key: 'reset', ic: 'restart' })));
}

function scrSettings() {
  return h('section', { class: 'gm-settings' }, topbar('Configurações', 'Salvas automaticamente'), settingsBody(false));
}

// ---------- controles ----------
const KB = [
  [['W', 'A', 'S', 'D'], 'Mover', '(ou setas)'], [['Shift'], 'Correr'],
  [['Espaço'], 'Passe', 'Defendendo: segure para pressionar'], [['J'], 'Dividida', 'Desarme em pé (defesa)'], [['K'], 'Chute', 'Segure para mais força · Defendendo: carrinho'],
  [['L'], 'Passe longo / cruzamento'], [['I'], 'Enfiada'], [['O'], 'Chute colocado'], [['P'], 'Cavadinha'],
  [['Q'], 'Trocar jogador'], [['F'], 'Drible / finta'], [['E'], 'Proteger a bola'], [['C'], 'Contenção (defesa)'], [['Esc'], 'Pausa'],
  [['Mouse E'], 'Passe', 'Botão esquerdo'], [['Mouse D'], 'Chute', 'Botão direito · segure para força'],
];
const GP = [
  ['LS', 'Mover', 'Analógico esquerdo'], ['A', 'Passe', 'Defendendo: pressão'], ['B', 'Chute', 'Segure para força · Defendendo: carrinho'],
  ['X', 'Passe longo / cruzamento'], ['Y', 'Enfiada'], ['RB', 'Dividida', 'Sozinho, na defesa · com B: chute colocado'], ['LT', 'Cavadinha', 'Com B'],
  ['LB', 'Trocar jogador'], ['RT', 'Correr'], ['RS', 'Drible / finta', 'Analógico direito'], ['☰', 'Pausa', 'Start'],
];
const PAD_SVG = `<svg viewBox="0 0 320 200" fill="none">
<path d="M88 40h144c34 0 52 22 60 60l14 58c6 26-22 42-40 22l-30-32H84l-30 32c-18 20-46 4-40-22l14-58c8-38 26-60 60-60z" fill="#141816" stroke="#2c3530" stroke-width="3"/>
<rect x="70" y="24" width="50" height="12" rx="6" fill="#262b28"/><rect x="200" y="24" width="50" height="12" rx="6" fill="#262b28"/>
<text x="95" y="20" fill="#8b988f" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">LB · LT</text><text x="225" y="20" fill="#8b988f" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">RB · RT</text>
<circle cx="96" cy="86" r="20" fill="#050706" stroke="#1ee37a" stroke-width="2"/><text x="96" y="90" fill="#1ee37a" font-size="11" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700">LS</text>
<circle cx="196" cy="130" r="20" fill="#050706" stroke="#3a443e" stroke-width="2"/><text x="196" y="134" fill="#8b988f" font-size="11" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700">RS</text>
<path d="M118 118h12v-12h12v12h12v12h-12v12h-12v-12h-12z" fill="#262b28"/>
<circle cx="236" cy="104" r="11" fill="#2fbf5a"/><text x="236" y="108" fill="#08120a" font-size="12" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">A</text>
<circle cx="258" cy="82" r="11" fill="#e8413c"/><text x="258" y="86" fill="#fff" font-size="12" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">B</text>
<circle cx="214" cy="82" r="11" fill="#2f7de8"/><text x="214" y="86" fill="#fff" font-size="12" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">X</text>
<circle cx="236" cy="60" r="11" fill="#f2c21b"/><text x="236" y="64" fill="#1a1400" font-size="12" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">Y</text>
<rect x="170" y="66" width="18" height="9" rx="4.5" fill="#3a443e"/><rect x="132" y="66" width="18" height="9" rx="4.5" fill="#3a443e"/></svg>`;
const TOUCH_SVG = `<svg viewBox="0 0 340 170" fill="none" font-family="Inter,sans-serif">
<rect x="4" y="4" width="332" height="162" rx="22" fill="#0c0f0d" stroke="#2c3530" stroke-width="3"/>
<rect x="18" y="16" width="304" height="138" rx="10" fill="#10331f" opacity=".55"/>
<path d="M170 16v138M18 85h304" stroke="#fff" stroke-opacity=".12"/><circle cx="170" cy="85" r="22" stroke="#fff" stroke-opacity=".12"/>
<circle cx="70" cy="110" r="32" fill="#fff" fill-opacity=".08" stroke="#1ee37a" stroke-opacity=".7" stroke-width="2"/><circle cx="78" cy="104" r="13" fill="#1ee37a" fill-opacity=".85"/>
<text x="70" y="160" fill="#1ee37a" font-size="10" text-anchor="middle">Joystick</text>
<circle cx="292" cy="118" r="20" fill="#1ee37a" fill-opacity=".9"/><text x="292" y="122" fill="#050706" font-size="10" font-weight="800" text-anchor="middle">CHUTE</text>
<circle cx="250" cy="130" r="16" fill="#fff" fill-opacity=".85"/><text x="250" y="134" fill="#050706" font-size="9" font-weight="800" text-anchor="middle">PASSE</text>
<circle cx="252" cy="88" r="16" fill="#fff" fill-opacity=".6"/><text x="252" y="91" fill="#050706" font-size="7.5" font-weight="800" text-anchor="middle">LONGO</text>
<circle cx="294" cy="72" r="18" fill="#fff" fill-opacity=".6"/><text x="294" y="75" fill="#050706" font-size="7" font-weight="800" text-anchor="middle">ENFIADA</text>
<circle cx="210" cy="136" r="16" fill="#fff" fill-opacity=".35"/><text x="210" y="139" fill="#fff" font-size="7" font-weight="800" text-anchor="middle">CORRER</text>
<rect x="150" y="22" width="40" height="14" rx="7" fill="#fff" fill-opacity=".2"/><text x="170" y="32" fill="#fff" font-size="8" text-anchor="middle">❚❚</text></svg>`;

function controlsBody() {
  if (!ctrlTab) ctrlTab = matchMedia('(pointer: coarse)').matches ? 'toque' : 'teclado';
  const content = h('div', { class: 'gm-ctrl-content' });
  const tabs = h('div', { class: 'gm-seg gm-tabs', role: 'tablist' });
  const paint = () => {
    tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === ctrlTab); b.setAttribute('aria-selected', b.dataset.v === ctrlTab); });
    let body;
    if (ctrlTab === 'teclado') {
      body = h('div', { class: 'gm-keys' }, KB.map(([keys, act, note]) => h('div', { class: 'gm-key-row' },
        h('span', { class: 'gm-caps' + (keys.length === 4 ? ' gm-wasd' : '') }, keys.map(k => h('kbd', { class: k.length > 2 ? 'wide' : null }, k))),
        h('span', { class: 'gm-act' }, h('b', {}, act), note ? h('small', {}, note) : null))));
    } else if (ctrlTab === 'controle') {
      body = h('div', { class: 'gm-ctrl-pad' }, svgEl(PAD_SVG, 'gm-pad-art'),
        h('div', { class: 'gm-keys' }, GP.map(([b, act, note]) => h('div', { class: 'gm-key-row' },
          h('span', { class: 'gm-caps' }, h('kbd', { class: 'gp gp-' + b.toLowerCase().replace('☰', 'st') }, b)),
          h('span', { class: 'gm-act' }, h('b', {}, act), note ? h('small', {}, note) : null)))));
    } else {
      body = h('div', { class: 'gm-ctrl-pad' }, svgEl(TOUCH_SVG, 'gm-pad-art gm-touch-art'),
        h('div', { class: 'gm-touch-notes' },
          h('p', {}, h('b', {}, 'Joystick esquerdo'), ' — arraste no lado esquerdo da tela para mover o jogador.'),
          h('p', {}, h('b', {}, 'Com a bola'), ' — Passe, Chute (segure para força), Enfiada e Correr. Arraste o Passe para cima para lançar; o Chute para cima é cavadinha e para o lado, colocado. Deslize na área livre da direita para driblar.'),
          h('p', {}, h('b', {}, 'Sem a bola'), ' — Dividida (desarme em pé), Carrinho, Pressão (segure) e TROCAR jogador.'),
          h('p', {}, h('b', {}, 'Pausa'), ' — botão no topo da tela.')));
    }
    content.replaceChildren(body);
  };
  for (const [v, label, ic] of [['teclado', 'Teclado', 'keyboard'], ['controle', 'Controle', 'pad'], ['toque', 'Toque', 'touch']]) {
    tabs.append(h('button', { role: 'tab', 'data-v': v, 'data-key': 'tab-' + v, onclick: () => { ctrlTab = v; paint(); } }, icon(ic), h('span', {}, label)));
  }
  paint();
  return h('div', { class: 'gm-controls-body' }, tabs, h('div', { class: 'gm-panel' }, content));
}

function scrControls() {
  return h('section', { class: 'gm-controls' }, topbar('Controles', 'Teclado, controle e toque'), controlsBody());
}

// ---------- créditos ----------
function scrCredits() {
  return h('section', { class: 'gm-credits' }, topbar('Créditos', null),
    h('div', { class: 'gm-panel gm-credits-body' },
      logo('mid'),
      h('p', { class: 'gm-muted' }, 'Jogo de futebol 3D feito para o navegador — PC e celular, sem instalação.'),
      h('dl', {},
        h('dt', {}, 'Motor 3D'), h('dd', {}, 'three.js — licença MIT'),
        h('dt', {}, 'Texturas'), h('dd', {}, 'ambientCG — domínio público (CC0)'),
        h('dt', {}, 'Tipografia'), h('dd', {}, 'Barlow Condensed e Inter — SIL Open Font License'),
        h('dt', {}, 'Áudio'), h('dd', {}, 'Sintetizado em tempo real (Web Audio)')),
      h('p', { class: 'gm-disclaimer' }, 'Todos os clubes, jogadores, escudos, estádios, cidades e patrocinadores do GOLAÇO são fictícios. Qualquer semelhança com pessoas ou entidades reais é mera coincidência.'),
      h('div', { class: 'gm-credit-crests' }, TEAMS.map(t => crest(t, 44)))));
}

// ---------- pausa ----------
function renderPause(view) {
  if (pauseView === 'settings' && view !== 'settings') pauseCb.onSettings?.(S.settings);
  pauseView = view;
  const cfg = lastCfg || pauseCb.cfg;      // partida do Total Match: o cfg vem do núcleo
  const head = cfg ? h('div', { class: 'gm-pause-mu' }, crest(cfg.home, 34), h('b', {}, cfg.home.short), h('span', {}, 'x'), h('b', {}, cfg.away.short), crest(cfg.away, 34)) : null;
  const sub = (title, body) => h('div', { class: 'gm-pause-panel wide' },
    h('div', { class: 'gm-pause-head' }, h('button', { class: 'gm-back', 'data-key': 'pback', 'data-esc': '', onclick: () => renderPause('main') }, icon('back'), h('span', {}, 'Voltar'), h('kbd', {}, 'Esc')), h('h2', {}, title)),
    h('div', { class: 'gm-pause-scroll' }, body));
  const confirm = (title, text, yes, action) => h('div', { class: 'gm-pause-panel' }, h('h2', {}, title), h('p', { class: 'gm-muted' }, text),
    h('div', { class: 'gm-pause-btns' }, btn(yes, action, { cls: 'gm-btn-danger', key: 'yes' }), btn('Cancelar', () => renderPause('main'), { autofocus: true, key: 'no', esc: true })));
  let panel;
  if (view === 'settings') panel = sub('Configurações', settingsBody(true));
  else if (view === 'controls') panel = sub('Controles', controlsBody());
  else if (view === 'restart') panel = confirm('Reiniciar partida?', 'O placar volta a 0 x 0.', 'Reiniciar', () => { const cb = pauseCb; hidePause(); cb.onRestart?.(); });
  else if (view === 'quit') panel = confirm('Sair da partida?', cfg?.fixtureId ? 'O jogo não será registrado; você poderá jogá-lo de novo.' : 'O progresso desta partida será perdido.', 'Sair', quitMatch);
  else if (view === 'simrest') panel = confirm('Simular o resto?', 'O computador joga os minutos que faltam e o placar vale.', 'Simular', () => { const cb = pauseCb; hidePause(); cb.onSimRest?.(); });
  // sem onRestart/onQuit (partida do Total Match) os botões somem; com onSimRest aparece "Simular o resto"
  else panel = h('div', { class: 'gm-pause-panel' },
    h('p', { class: 'gm-kicker' }, 'Partida pausada'), head,
    h('div', { class: 'gm-pause-btns' },
      btn('Continuar', resume, { cls: 'gm-btn-primary', autofocus: true, ic: 'play', key: 'resume' }),
      pauseCb.onRestart ? btn('Reiniciar', () => renderPause('restart'), { ic: 'restart', key: 'restart' }) : null,
      pauseCb.onSimRest ? btn('Simular o resto', () => renderPause('simrest'), { ic: 'fast', key: 'simrest' }) : null,
      btn('Configurações', () => renderPause('settings'), { ic: 'gear', key: 'settings' }),
      btn('Controles', () => renderPause('controls'), { ic: 'pad', key: 'controls' }),
      pauseCb.onQuit ? btn('Sair', () => renderPause('quit'), { ic: 'exit', key: 'quit' }) : null));
  pauseEl.replaceChildren(panel);
  requestAnimationFrame(() => focusIn(panel));
}
function resume() { const cb = pauseCb; hidePause(); cb.onResume?.(); }
function quitMatch() {
  const cb = pauseCb, cfg = lastCfg;
  hidePause();
  cb.onQuit?.();
  if (mode !== 'ingame') return;                 // o núcleo já mostrou outra tela
  leaveGame();
  const st = cfg?.fixtureId ? TT.loadTournament() : null;
  reset(st && st.type === cfg.mode ? [scrMain, scrHub] : [scrMain]);
}

// ---------- entrada: teclado e controle ----------
const pauseOpen = () => !!(pauseEl && !pauseEl.hidden);
const isActive = () => !!S && (mode !== 'ingame' || pauseOpen());
const scope = () => (pauseOpen() ? pauseEl : stage);

function focusables(sc) {
  return [...sc.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
}

function moveFocus(dir) {
  const sc = scope();
  const items = focusables(sc);
  if (!items.length) return;
  const cur = document.activeElement;
  if (!cur || !sc.contains(cur) || !items.includes(cur)) { (sc.querySelector('[data-autofocus]') || items[0]).focus(); return; }
  const a = cur.getBoundingClientRect();
  const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
  const horiz = dir === 'right' || dir === 'left';
  const cands = [];
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
    // o candidato precisa estar claramente na direção pedida
    if (dir === 'right' && bcx <= Math.max(acx, a.right - a.width * 0.3)) continue;
    if (dir === 'left' && bcx >= Math.min(acx, a.left + a.width * 0.3)) continue;
    if (dir === 'down' && bcy <= Math.max(acy, a.bottom - a.height * 0.3)) continue;
    if (dir === 'up' && bcy >= Math.min(acy, a.top + a.height * 0.3)) continue;
    const main = Math.max(0, dir === 'right' ? b.left - a.right : dir === 'left' ? a.left - b.right : dir === 'down' ? b.top - a.bottom : a.top - b.bottom);
    const cross = horiz ? Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)) : Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
    cands.push({ el, main, cross, off: Math.round((horiz ? Math.abs(bcy - acy) : Math.abs(bcx - acx)) / 16), pos: horiz ? b.top : b.left });
  }
  if (!cands.length) return;
  let pool;
  if (horiz) {
    // na horizontal: primeiro quem está na mesma linha (sobreposição vertical)
    pool = cands.filter(c => c.cross === 0);
    pool = pool.length ? pool.sort((x, y) => x.main - y.main || x.off - y.off) : cands.sort((x, y) => (x.main + x.cross * 3) - (y.main + y.cross * 3));
  } else {
    // na vertical: primeiro a mesma coluna (sobreposição horizontal); senão a "linha" mais próxima
    pool = cands.filter(c => c.cross === 0).sort((x, y) => x.main - y.main || x.off - y.off || x.pos - y.pos);
    if (!pool.length) {
      const m = Math.min(...cands.map(c => c.main));
      pool = cands.filter(c => c.main <= m + 24).sort((x, y) => x.cross - y.cross || x.off - y.off);
    }
  }
  const best = pool[0].el;
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

function escape() {
  if (pauseOpen()) {
    if (pauseView === 'main') resume(); else renderPause('main');
    return;
  }
  if (mode === 'splash') { leaveSplash(); return; }
  back();
}

const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
function onKey(e) {
  if (!isActive()) return;
  if (mode === 'splash') { if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) { e.preventDefault(); leaveSplash(); } return; }
  const dir = DIRS[e.key];
  const t = e.target;
  if (dir) {
    if (t?.type === 'range' && (dir === 'left' || dir === 'right')) return;     // ajuste nativo do slider
    root.classList.add('gm-kbd');
    e.preventDefault(); e.stopPropagation();
    moveFocus(dir);
  } else if (e.key === 'Escape' || (e.key === 'Backspace' && t?.tagName !== 'INPUT')) {
    if (e.repeat || e.timeStamp <= pauseOpenedAt) return;                         // o mesmo Esc que abriu a pausa
    e.preventDefault(); e.stopPropagation();
    escape();
  } else if (e.key === 'Enter' || e.key === ' ') {
    root.classList.add('gm-kbd');
    if (!scope().contains(document.activeElement)) { e.preventDefault(); moveFocus('down'); }
    e.stopPropagation();
  } else if (e.key === 'Tab') root.classList.add('gm-kbd');
}

const gp = { prev: [], dir: null, next: 0 };
function gpLoop(now) {
  requestAnimationFrame(gpLoop);
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = [...pads].find(x => x && x.connected);
  if (!p) return;
  const pr = (i) => !!p.buttons[i]?.pressed;
  const edge = (i) => pr(i) && !gp.prev[i];
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const dir = pr(12) || ay < -0.55 ? 'up' : pr(13) || ay > 0.55 ? 'down' : pr(14) || ax < -0.55 ? 'left' : pr(15) || ax > 0.55 ? 'right' : null;
  if (isActive()) {
    if (mode === 'splash') { if (p.buttons.some((b, i) => b.pressed && !gp.prev[i])) leaveSplash(); }
    else {
      if (dir && (dir !== gp.dir || now > gp.next)) {
        root.classList.add('gm-kbd');
        const t = document.activeElement;
        if (t?.type === 'range' && (dir === 'left' || dir === 'right')) {
          dir === 'left' ? t.stepDown() : t.stepUp(); t.dispatchEvent(new Event('input', { bubbles: true }));
        } else moveFocus(dir);
        gp.next = now + (dir !== gp.dir ? 380 : 140);
      }
      if (edge(0)) { root.classList.add('gm-kbd'); const t = document.activeElement; if (t && scope().contains(t) && t !== scope()) t.click(); else moveFocus('down'); }
      else if (edge(1)) escape();
    }
  }
  gp.dir = dir;
  gp.prev = p.buttons.map(b => b.pressed);
}

// ---------- arte de fundo: linhas do campo ----------
const PITCH_SVG = `<svg viewBox="0 0 1050 680" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="2.2">
<rect x="10" y="10" width="1030" height="660"/><path d="M525 10v660"/><circle cx="525" cy="340" r="91.5"/><circle cx="525" cy="340" r="3" fill="currentColor"/>
<rect x="10" y="138" width="165" height="404"/><rect x="10" y="248" width="55" height="184"/><path d="M175 267a91.5 91.5 0 0 1 0 146"/>
<rect x="875" y="138" width="165" height="404"/><rect x="985" y="248" width="55" height="184"/><path d="M875 267a91.5 91.5 0 0 0 0 146"/>
<circle cx="120" cy="340" r="3" fill="currentColor"/><circle cx="930" cy="340" r="3" fill="currentColor"/></svg>`;
