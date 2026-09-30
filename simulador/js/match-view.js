// Tela da partida: liga motor + renderizador + interface (placar, controles, abas, táticas).
import { Match } from './engine.js';
import { PitchRenderer, drawMomentum, drawHeat } from './render.js';
import { SIM, SPEEDS, FORMATION_KEYS, MENTALITY, PRESSING, TEMPO, BUDGET } from './config.js';
import { POS_LABEL, slotFit } from './teams.js';
import { h, crest, modal, segmented, toast, ratingBadge, nextFrame } from './dom.js';
import { audio } from './audio.js';
import { log } from './log.js';

const ICON = { goal: '⚽', save: '🧤', wide: '↗', bigMiss: '😱', post: '🥅', blocked: '🛡', corner: '🚩', foul: '✋', yellow: '🟨', red: '🟥', penalty: '❗', offside: '🚩', sub: '🔁', kickoff: '▶', secondHalf: '▶', halftime: '⏸', fulltime: '🏁', added: '⏱', tactic: '📋', formation: '📋' };
const DEAD_LABEL = { goalkick: 'Tiro de meta', corner: 'Escanteio', throwin: 'Lateral', freekick: 'Falta', penalty: 'Pênalti', kickoff: 'Saída de bola' };

export class MatchView {
  /**
   * @param {object} app  contexto do app (settings, quality, monitor, screens)
   * @param {object} o    { home, away, userSide, seed, title, season:{...}|null, onDone(match), onExit() }
   */
  constructor(app, o) {
    this.app = app;
    this.o = o;
    this.match = o.preplayed || new Match({ home: o.home, away: o.away, seed: o.seed, userSide: o.userSide });
    this.speed = app.settings.speed;
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this.lastDraw = 0;
    this.lastUi = 0;
    this.lastSlow = 0;
    this.seen = 0;
    this.stepsLast = 0;
    this.engineMs = 0;
    this.skipping = false;
    this.destroyed = false;
    this.tab = 'feed';
    this.showAll = false;
    this.pads = {};
    this.autoPaused = false;
    this.sheetOpen = null;
    this._build();
    this.renderer = new PitchRenderer(this.canvas);
    this.renderer.reducedMotion = app.settings.reducedMotion;
    this.applyQuality();
    this._bind();
    this._frame = this._frame.bind(this);
    this.raf = requestAnimationFrame(this._frame);
    this._processEvents(true);
    this._updateUi(true);
    log.info(`Partida: ${o.home.name} x ${o.away.name} (semente ${o.seed}, comanda: ${o.userSide ?? 'ninguém'})`);
  }

  applyQuality() {
    this.renderer.setQuality(this.app.qualityPreset());
  }

  // ---------- construção da interface ----------
  _build() {
    const m = this.match, [H, A] = m.teams;
    const us = this.o.userSide;
    const teamBox = (t, side) => h(`div.sb-team.${side === 0 ? 'home' : 'away'}${side === us ? '.mine' : ''}`, { 'aria-label': side === us ? `${t.def.name} (seu time)` : t.def.name },
      side === 1 && us === 1 ? h('span.you', null, 'VOCÊ') : null,
      side === 0 ? crest(t.def, 36) : null,
      h('span.nm', { title: t.def.name }, h('span.full', null, t.def.name), h('span.short', null, t.def.short)),
      side === 1 ? crest(t.def, 36) : null,
      side === 0 && us === 0 ? h('span.you', null, 'VOCÊ') : null);
    this.hs = h('b', { 'aria-label': `Gols ${H.def.name}` }, '0');
    this.as = h('b', { 'aria-label': `Gols ${A.def.name}` }, '0');
    this.clock = h('span', null, "0'");
    this.periodLbl = h('span', null, '1º tempo');
    this.liveDot = h('i.live');
    this.possH = h('i', { style: { background: H.kit.fill, width: '50%' } });
    this.possA = h('i', { style: { background: A.kit.fill, width: '50%' } });
    const score = h('header.scorebar', null,
      teamBox(H, 0),
      h('div.sb-center', null,
        h('div.sb-score', { role: 'status', 'aria-live': 'polite' }, this.hs, h('span', { 'aria-hidden': 'true' }, '–'), this.as),
        h('div.sb-clock', null, this.liveDot, this.clock, h('span', { 'aria-hidden': 'true' }, '·'), this.periodLbl),
        h('div.poss-bar', { title: 'Posse de bola' }, this.possH, this.possA)),
      teamBox(A, 1));

    this.canvas = h('canvas#pitch', { role: 'img', 'aria-label': 'Campo com a simulação da partida' });
    this.deadTag = h('div.deadtag.hidden');
    this.bannerBox = h('div');
    this.perf = h('div.perf.hidden', { 'aria-hidden': 'true' });
    const pitch = h('div.pitchwrap', null, this.canvas, this.deadTag, this.bannerBox, this.perf);

    this.playBtn = h('button.btn.icon', { type: 'button', 'aria-label': 'Iniciar', title: 'Iniciar/pausar (Espaço)', onclick: () => this.toggle() }, '▶');
    this.speedSeg = segmented(SPEEDS.map((s) => ({ v: s, label: `${s}×`, title: `Velocidade ${s}× (tecla ${SPEEDS.indexOf(s) + 1})` })), this.speed, (v) => this.setSpeed(v), { label: 'Velocidade' });
    this.speedSeg.classList.add('speed');
    this.skipBtn = h('button.btn.small', { type: 'button', title: 'Simular direto até a próxima parada (N)', onclick: () => this.skip() }, 'Intervalo ⏭');
    this.tacBtn = us == null ? null : h('button.btn.small.primary', { type: 'button', title: 'Táticas e substituições (T)', onclick: () => this.openTactics() }, 'Táticas');
    const exitBtn = h('button.btn.small.ghost', { type: 'button', title: 'Sair da partida (Esc)', onclick: () => this.confirmExit() }, 'Sair');
    const ctrl = h('div.ctrl', null, this.playBtn, this.speedSeg, this.skipBtn, h('span.spacer'), this.tacBtn, exitBtn);

    const tabs = [['feed', 'Lances'], ['stats', 'Estatísticas'], ['mom', 'Momento'], ['teams', 'Times']];
    this.tabBtns = tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', id: `tab-${k}`, 'aria-selected': String(k === this.tab), 'aria-controls': 'tabpanel', onclick: () => this.setTab(k) }, l));
    this.tabPanel = h('div.tabpanel#tabpanel', { role: 'tabpanel', tabindex: '0' });
    const panel = h('aside.panel', null, h('div.tabs', { role: 'tablist', 'aria-label': 'Informações da partida' }, this.tabBtns), this.tabPanel);

    this.el = h('section.screen#match', { 'aria-label': `Partida ${H.def.name} contra ${A.def.name}` }, h('div.mgrid', null, score, pitch, ctrl, panel));
    this._renderTab();
  }

  _bind() {
    this._onKey = (e) => {
      if (this.destroyed || e.defaultPrevented) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { e.preventDefault(); this.toggle(); }
      else if (['1', '2', '3', '4'].includes(k)) this.setSpeed(SPEEDS[+k - 1]);
      else if (k === 't' && this.o.userSide != null) this.openTactics();
      else if (k === 'n') this.skip();
      else if (k === 'escape') this.confirmExit();
    };
    document.addEventListener('keydown', this._onKey);
    this._onVis = () => {
      if (document.hidden) {
        if (this.running && this.app.settings.pauseOnBlur) { this.setRunning(false); this.autoPaused = true; }
        audio.pause(true);
      } else {
        audio.pause(false);
        this.last = 0;
        if (this.autoPaused) { this.autoPaused = false; toast('Partida pausada enquanto o app estava em segundo plano'); }
      }
    };
    document.addEventListener('visibilitychange', this._onVis);
    this._ro = new ResizeObserver(() => { this.renderer.dirty = true; });
    this._ro.observe(this.canvas.parentElement);
  }

  // ---------- controle ----------
  start() { audio.unlock(); audio.startMatch(); this.setRunning(true); }
  setRunning(v) {
    if (this.match.finished) v = false;
    if (v && this.match.phase === 'halftime') { this.showHalftime(); return; }
    this.running = v;
    this.last = 0;
    this.playBtn.textContent = v ? '❚❚' : '▶';
    this.playBtn.setAttribute('aria-label', v ? 'Pausar' : 'Continuar');
    this.liveDot.classList.toggle('off', !v);
    audio.pause(!v);
  }
  toggle() { if (this.skipping) return; audio.unlock(); this.setRunning(!this.running); }
  setSpeed(v) {
    if (!SPEEDS.includes(v)) return;
    this.speed = v; this.speedSeg.setValue(v);
    this.app.settings.speed = v; this.app.saveSettings();
  }

  /** Simula direto até o intervalo (1º tempo) ou até o fim (2º tempo), em blocos, sem travar a tela. */
  async skip() {
    if (this.skipping || this.match.finished) return;
    const m = this.match;
    if (m.phase === 'halftime') { this.continueSecondHalf(); return; }
    this.skipping = true;
    const wasRunning = this.running;
    this.setRunning(false);
    const target = m.period === 1 ? 'halftime' : 'ended';
    const prog = h('i');
    const b = h('div.banner', null, h('div.sub', null, target === 'halftime' ? 'Simulando até o intervalo…' : 'Simulando até o fim…'), h('div.progress', null, prog));
    this.bannerBox.replaceChildren(b);
    const startT = m.tp;
    const endT = m.H + 3;
    try {
      while (m.phase === 'play' && !this.destroyed) {
        const t0 = performance.now();
        while (m.phase === 'play' && performance.now() - t0 < 12) m.step();
        prog.style.width = `${Math.min(100, ((m.tp - startT) / (endT - startT)) * 100)}%`;
        this._processEvents(true);
        await nextFrame();
      }
    } catch (e) { log.error('Falha ao simular', e); toast('Falha ao simular. Veja o diagnóstico.', true); }
    if (this.destroyed) return;
    this.skipping = false;
    this.bannerBox.replaceChildren();
    this.renderer.reset();
    this.acc = 0;
    this._processEvents(false, true);
    this._updateUi(true);
    if (m.phase === 'play' && wasRunning) this.setRunning(true);
  }

  continueSecondHalf() {
    if (this.match.phase !== 'halftime') return;
    this._htModal?.close();
    this._htModal = null;
    this.match.resumeSecondHalf();
    this.renderer.reset();
    this._processEvents();
    this.setRunning(true);
  }

  // ---------- laço ----------
  _frame(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this._frame);
    const app = this.app, m = this.match;
    app.monitor.frame(now);
    const dtReal = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this._pollPad();
    if (this.running && !this.skipping && m.phase === 'play') {
      this.acc += dtReal * this.speed;
      let steps = 0;
      const t0 = performance.now();
      while (this.acc >= SIM.dt && steps < BUDGET.maxStepsPerFrame) {
        m.step(); this.acc -= SIM.dt; steps++;
        if (m.phase !== 'play') { this.acc = 0; break; }
        if (performance.now() - t0 > BUDGET.engineMsPerFrame * Math.max(1, this.speed / 2)) { this.acc = Math.min(this.acc, SIM.dt); break; }
      }
      this.stepsLast = steps;
      this.engineMs = performance.now() - t0;
      if (steps) this._processEvents();
    }
    const cap = app.qualityPreset().fpsCap;
    if (cap && now - this.lastDraw < 1000 / cap - 2) return;
    this.lastDraw = now;
    try {
      this.renderer.draw(m, this.running && !this.skipping ? Math.min(1, this.acc / SIM.dt) : 1, { view: app.settings.view, numbers: app.settings.numbers });
    } catch (e) {
      log.error('Falha ao desenhar', e);
    }
    if (now - this.lastUi > 200) { this.lastUi = now; this._updateUi(); }
    if (now - this.lastSlow > 1000) {
      this.lastSlow = now;
      this._updateSlow();
      const next = app.adaptQuality(now);
      if (next) this.applyQuality();
    }
  }

  _pollPad() {
    if (!navigator.getGamepads) return;
    let pads;
    try { pads = navigator.getGamepads(); } catch { return; }
    for (const p of pads) {
      if (!p) continue;
      const prev = this.pads[p.index] || [];
      const cur = p.buttons.map((b) => b.pressed);
      const hit = (i) => cur[i] && !prev[i];
      if (hit(0) || hit(9)) this.toggle();
      if (hit(4)) this.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(this.speed) - 1)]);
      if (hit(5)) this.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(this.speed) + 1)]);
      if (hit(3) && this.o.userSide != null && !this.sheetOpen) this.openTactics();
      if (hit(2)) this.skip();
      this.pads[p.index] = cur;
    }
  }

  // ---------- eventos ----------
  _processEvents(silent = false, rebuild = false) {
    const m = this.match;
    if (rebuild) this._renderFeed(true);
    for (; this.seen < m.events.length; this.seen++) {
      const e = m.events[this.seen];
      if (!rebuild) this._feedAdd(e, !silent);
      if (silent) continue;
      audio.event(e.type);
      if (e.type === 'goal') this._goalBanner(e);
      else if (e.type === 'red') this._banner('EXPULSO', e.text, false);
      else if (e.type === 'penalty') this._banner('PÊNALTI', e.text, false);
    }
    if (m.phase === 'halftime' && !this._htModal && !this.skipping) this.showHalftime();
    if (m.finished && !this._ftShown && !this.skipping) this.showFulltime();
  }

  _goalBanner(e) {
    const t = this.match.teams[e.side];
    (e.side === 0 ? this.hs : this.as).classList.remove('flash');
    void this.hs.offsetWidth;
    (e.side === 0 ? this.hs : this.as).classList.add('flash');
    const who = [...t.onPitch, ...t.out].find((p) => p.d.id === e.playerId);
    this._banner('GOL!', `${who ? who.d.name : ''} · ${t.def.name} ${e.label}`, true);
  }
  _banner(big, sub, goal) {
    const b = h('div.banner', { role: 'status' }, h('div.big', null, big), h('div.sub', null, sub));
    if (goal) b.classList.add('goal');
    this.bannerBox.replaceChildren(b);
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { if (this.bannerBox.contains(b)) b.remove(); }, Math.max(1400, 2800 / Math.sqrt(this.speed)));
  }

  // ---------- intervalo / fim ----------
  showHalftime() {
    if (this._htModal) return;
    this.setRunning(false);
    audio.event('halftime');
    const m = this.match, [H, A] = m.teams;
    const body = h('div', null,
      h('h3', null, 'Intervalo'),
      h('p.subtitle', null, 'Ajuste o time antes do 2º tempo, se quiser.'),
      this._finalScore(),
      this._miniStats(),
      h('div.foot-actions', null,
        this.o.userSide != null ? h('button.btn', { type: 'button', onclick: () => this.openTactics() }, 'Táticas e trocas') : null,
        h('button.btn.primary', { type: 'button', autofocus: true, onclick: () => this.continueSecondHalf() }, 'Começar 2º tempo')));
    this._htModal = modal(body, { label: 'Intervalo', dismissable: false });
    this._updateUi(true);
  }

  showFulltime() {
    this._ftShown = true;
    this.setRunning(false);
    audio.stopMatch();
    const m = this.match;
    this._updateUi(true);
    const motm = m.manOfTheMatch();
    const season = !!this.o.season;
    let dlg;
    const body = h('div', null,
      h('h3', null, 'Fim de jogo'),
      h('p.subtitle', null, this.o.title || 'Partida amistosa'),
      this._finalScore(),
      motm ? h('div.motm', null, ratingBadge(motm.rating), h('div', null, h('div', { style: { fontWeight: 800 } }, `Melhor em campo: ${motm.player.d.name}`), h('small', { style: { color: 'var(--muted)' } }, `${motm.player.team.def.name} · ${POS_LABEL[motm.player.d.pos]}`))) : null,
      this._miniStats(),
      h('div.foot-actions', null,
        h('button.btn.ghost', { type: 'button', onclick: () => { dlg.close(); this.setTab('stats'); } }, 'Ver detalhes'),
        season
          ? h('button.btn.primary', { type: 'button', autofocus: true, onclick: () => { dlg.close(); this.o.onDone?.(m); } }, 'Continuar campeonato')
          : [h('button.btn', { type: 'button', onclick: () => { dlg.close(); this.o.onRematch?.(); } }, 'Revanche'),
            h('button.btn.primary', { type: 'button', autofocus: true, onclick: () => { dlg.close(); this.o.onDone?.(m); } }, 'Menu')]));
    dlg = modal(body, { label: 'Fim de jogo' });
    this._ftModal = dlg;
  }

  _finalScore() {
    const m = this.match, [H, A] = m.teams;
    const scorers = (side) => m.events.filter((e) => e.type === 'goal' && e.side === side).map((e) => {
      const t = m.teams[side];
      const p = [...t.onPitch, ...t.out].find((x) => x.d.id === e.playerId);
      return h('div', null, `${p ? p.d.name : '?'} ${e.label}${e.kind === 'penalty' ? ' (pên.)' : ''}`);
    });
    return h('div', null,
      h('div.final-score', null,
        h('div.t', null, crest(H.def, 48), H.def.name),
        h('div.sc', null, `${H.score} – ${A.score}`),
        h('div.t', null, crest(A.def, 48), A.def.name)),
      h('div.scorers', null, h('div', null, scorers(0)), h('div', null, scorers(1))));
  }
  _miniStats() {
    const m = this.match, [a, b] = m.teams.map((t) => t.stats);
    const [pa, pb] = m.possession();
    const cards = (x) => (x.yellow || x.red ? `${x.yellow ? x.yellow + '🟨' : ''}${x.red ? ' ' + x.red + '🟥' : ''}`.trim() : '0');
    const rows = [['Posse', `${pa}%`, `${pb}%`], ['Gols esperados (xG)', a.xg.toFixed(2), b.xg.toFixed(2)], ['Finalizações', a.shots, b.shots], ['No alvo', a.onTarget, b.onTarget], ['Escanteios', a.corners, b.corners], ['Cartões', cards(a), cards(b)]];
    return h('div.mini-stats', null, rows.map(([l, x, y]) => [h('span', null, String(x)), h('span', null, l), h('span', null, String(y))]));
  }

  // ---------- táticas e substituições ----------
  openTactics(preselectOut = null) {
    if (this.o.userSide == null || this.match.finished || this.sheetOpen) return;
    const side = this.o.userSide;
    const m = this.match, t = m.teams[side];
    const wasRunning = this.running;
    this.setRunning(false);
    let selOut = preselectOut, selIn = null;
    const notice = h('div.notice', { role: 'status' });
    const subsLeft = h('span');
    const outList = h('div.plist', { role: 'group', 'aria-label': 'Em campo' });
    const inList = h('div.plist', { role: 'group', 'aria-label': 'Reservas' });
    const confirmBtn = h('button.btn.primary', { type: 'button', disabled: true, onclick: () => doSub() }, 'Confirmar troca');
    const energyBar = (e) => h('span.energy', { title: `Energia ${Math.round(e * 100)}%` }, h('i', { style: { width: `${Math.round(e * 100)}%`, background: e > 0.7 ? '#7ddc6a' : e > 0.5 ? '#e8c65a' : '#f0705a' } }));
    const draw = () => {
      subsLeft.textContent = `${t.subsLeft} de ${SIM.maxSubs} trocas restantes`;
      outList.replaceChildren(...t.onPitch.map((p) => h('button', { type: 'button', 'aria-pressed': String(selOut === p.d.id), onclick: () => { selOut = selOut === p.d.id ? null : p.d.id; draw(); } },
        h('span.n', null, p.d.number), h('span.nm', null, p.d.name, h('small', null, `${p.slot === 'GOL' ? 'Goleiro' : p.slot}${p.yellow ? ' · 🟨' : ''}`)), ratingBadge(m.rating(p)), energyBar(p.energy))));
      const outP = t.onPitch.find((p) => p.d.id === selOut);
      const bench = t.bench.filter((b) => !b.used).sort((a, b) => (outP ? slotFit(b.d.pos, outP.slot) * b.d.overall - slotFit(a.d.pos, outP.slot) * a.d.overall : b.d.overall - a.d.overall));
      inList.replaceChildren(...(bench.length ? bench.map((b) => h('button', { type: 'button', 'aria-pressed': String(selIn === b.d.id), disabled: t.subsLeft <= 0, onclick: () => { selIn = selIn === b.d.id ? null : b.d.id; draw(); } },
        h('span.n', null, b.d.number), h('span.nm', null, b.d.name, h('small', null, `${b.d.pos} · geral ${b.d.overall}`)), h('span.p', null, outP ? `${Math.round(slotFit(b.d.pos, outP.slot) * 100)}%` : ''), energyBar(1))) : [h('div.notice', null, 'Sem reservas disponíveis.')]));
      confirmBtn.disabled = !(selOut && selIn && t.subsLeft > 0);
    };
    const doSub = () => {
      const r = m.substitute(side, selOut, selIn);
      if (!r.ok) { notice.textContent = r.error; notice.classList.add('err'); return; }
      notice.classList.remove('err');
      const ev = m.events[m.events.length - 1];
      notice.textContent = ev.text;
      selOut = selIn = null;
      this._processEvents(true);
      draw();
    };
    const tac = t.tactics;
    const formSeg = segmented(FORMATION_KEYS.map((f) => ({ v: f, label: f })), tac.formation, (v) => { m.setTactics(side, { formation: v }); this._processEvents(true); draw(); }, { label: 'Formação', wide: true });
    const mentSeg = segmented(MENTALITY.map((x) => ({ v: x.v, label: x.label })), tac.mentality, (v) => { m.setTactics(side, { mentality: +v }); this._processEvents(true); }, { label: 'Mentalidade', wide: true });
    const pressSeg = segmented(PRESSING.map((x) => ({ v: x.v, label: x.label })), tac.pressing, (v) => m.setTactics(side, { pressing: +v }), { label: 'Pressão', wide: true });
    const tempoSeg = segmented(TEMPO.map((x) => ({ v: x.v, label: x.label })), tac.tempo, (v) => m.setTactics(side, { tempo: +v }), { label: 'Ritmo', wide: true });
    const body = h('div', null,
      h('h3', null, `Táticas · ${t.def.name}`),
      h('p.subtitle', null, 'A partida fica pausada enquanto você mexe no time. As mudanças valem na hora.'),
      h('div.field', null, h('span', null, 'Formação'), formSeg),
      h('div.field', { style: { marginTop: '12px' } }, h('span', null, 'Mentalidade'), mentSeg),
      h('div.grid2', { style: { marginTop: '12px' } }, h('div.field', null, h('span', null, 'Pressão'), pressSeg), h('div.field', null, h('span', null, 'Ritmo'), tempoSeg)),
      h('h4.sec', null, 'Substituições · ', subsLeft),
      h('div.subs', null, h('div', null, h('div.field', null, h('span', null, 'Sai (em campo)')), outList), h('div', null, h('div.field', null, h('span', null, 'Entra (reservas)')), inList)),
      notice,
      h('div.foot-actions', null, confirmBtn, h('button.btn', { type: 'button', autofocus: true, onclick: () => dlg.close() }, 'Voltar ao jogo')));
    draw();
    const dlg = modal(body, {
      label: 'Táticas e substituições',
      onClose: () => {
        this.sheetOpen = null;
        this._updateUi(true);
        if (this.match.phase === 'play' && wasRunning) this.setRunning(true);
      },
    });
    this.sheetOpen = dlg;
  }

  confirmExit() {
    if (this.sheetOpen || document.querySelector('.overlay')) return;
    if (this.match.finished) { this.o.onExit?.(); return; }
    const wasRunning = this.running;
    this.setRunning(false);
    let dlg;
    const body = h('div', null,
      h('h3', null, 'Sair da partida?'),
      h('p.subtitle', null, this.o.season ? 'O jogo não será contado; você pode jogá-lo de novo pelo campeonato.' : 'A partida em andamento será perdida.'),
      h('div.foot-actions', null,
        h('button.btn', { type: 'button', autofocus: true, onclick: () => dlg.close() }, 'Continuar jogando'),
        h('button.btn.danger', { type: 'button', onclick: () => { dlg.close(); this.o.onExit?.(); } }, 'Sair')));
    dlg = modal(body, { label: 'Sair da partida', onClose: () => { if (wasRunning && this.match.phase === 'play' && !this.destroyed) this.setRunning(true); } });
  }

  // ---------- abas ----------
  setTab(k) {
    this.tab = k;
    for (const b of this.tabBtns) b.setAttribute('aria-selected', String(b.id === `tab-${k}`));
    this.tabPanel.setAttribute('aria-labelledby', `tab-${k}`);
    this._renderTab();
  }
  _renderTab() {
    const p = this.tabPanel;
    p.replaceChildren();
    if (this.tab === 'feed') this._renderFeed(true);
    else if (this.tab === 'stats') { this._statsEl = h('div.stats'); p.append(this._statsEl); this._renderStats(); }
    else if (this.tab === 'mom') {
      this._momCanvas = h('canvas', { role: 'img', 'aria-label': 'Gráfico de momento da partida' });
      const [H, A] = this.match.teams;
      p.append(h('div.mom', null, h('p', { style: { color: 'var(--muted)', fontSize: '13px', marginTop: 0 } }, 'Pressão ofensiva minuto a minuto: barras para cima são do mandante, para baixo do visitante. ⚽ marca os gols.'),
        this._momCanvas, h('div.legend', null, h('span', null, h('i', { style: { background: H.kit.fill } }), H.def.name), h('span', null, h('i', { style: { background: A.kit.fill } }), A.def.name))));
      requestAnimationFrame(() => this._renderMomentum());
    } else if (this.tab === 'teams') { this._teamsEl = h('div'); p.append(this._teamsEl); this._renderTeams(); }
  }

  _feedItem(e, fresh) {
    const quiet = !!e.quiet;
    const li = h('li', null, h('span.min', null, e.label), h('span.ic', { 'aria-hidden': 'true' }, ICON[e.type] || '•'),
      h('span', null, e.side != null ? h('i.side-dot', { style: { background: this.match.teams[e.side].kit.fill } }) : null, e.text));
    if (quiet) li.classList.add('quiet');
    if (e.type === 'goal') li.classList.add('goal');
    if (fresh) li.classList.add('new');
    return li;
  }
  _renderFeed(full) {
    if (this.tab !== 'feed') return;
    const p = this.tabPanel;
    if (full || !this._feed) {
      const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Mostrar todos os lances' });
      sw.checked = this.showAll;
      sw.addEventListener('change', () => { this.showAll = sw.checked; this._renderFeed(true); });
      this._feed = h('ol.feed', { 'aria-live': 'off' });
      p.replaceChildren(h('div.feed-filter', null, h('span', null, 'Mais recentes primeiro'), h('label.switch', null, 'Todos os lances', sw)), this._feed);
      const evs = this.match.events.slice(0, this.seen).filter((e) => this.showAll || !e.quiet).slice(-150).reverse();
      this._feed.append(...evs.map((e) => this._feedItem(e, false)));
    }
  }
  _feedAdd(e, fresh) {
    if (this.tab !== 'feed' || !this._feed) return;
    if (e.quiet && !this.showAll) return;
    this._feed.prepend(this._feedItem(e, fresh));
    while (this._feed.children.length > 150) this._feed.lastChild.remove();
  }

  _renderStats() {
    if (this.tab !== 'stats' || !this._statsEl) return;
    const m = this.match, [H, A] = m.teams, [a, b] = [H.stats, A.stats];
    const [pa, pb] = m.possession();
    const pct = (s) => (s.passes ? Math.round((s.passOk / s.passes) * 100) : 0);
    const rows = [
      ['Posse de bola', pa, pb, '%'],
      ['Gols esperados (xG)', +a.xg.toFixed(2), +b.xg.toFixed(2), ''],
      ['Finalizações', a.shots, b.shots, ''],
      ['No alvo', a.onTarget, b.onTarget, ''],
      ['Grandes chances', a.bigChances, b.bigChances, ''],
      ['Precisão de passe', pct(a), pct(b), '%'],
      ['Cruzamentos certos', a.crossOk, b.crossOk, ''],
      ['Desarmes', a.tackles, b.tackles, ''],
      ['Defesas do goleiro', a.saves, b.saves, ''],
      ['Escanteios', a.corners, b.corners, ''],
      ['Impedimentos', a.offsides, b.offsides, ''],
      ['Faltas', a.fouls, b.fouls, ''],
      ['Cartões amarelos', a.yellow, b.yellow, ''],
      ['Cartões vermelhos', a.red, b.red, ''],
    ];
    const el = this._statsEl;
    if (!el.children.length) {
      for (const [l] of rows) {
        const x = h('span'), y = h('span'), bx = h('i', { style: { background: H.kit.fill } }), by = h('i', { style: { background: A.kit.fill } });
        el.append(h('div.stat', { dataset: { k: l } }, h('div.row', null, x, h('span', null, l), y), h('div.bars', null, h('div', null, bx), h('div', null, by))));
      }
      this._heatA = h('canvas', { role: 'img', 'aria-label': `Mapa de calor ${H.def.name}` });
      this._heatB = h('canvas', { role: 'img', 'aria-label': `Mapa de calor ${A.def.name}` });
      el.append(h('h4.sec', null, 'Onde cada time teve a bola'), h('div.heat', null, h('figure', null, this._heatA, h('figcaption', null, H.def.name)), h('figure', null, this._heatB, h('figcaption', null, A.def.name))));
    }
    rows.forEach(([, x, y, suf], i) => {
      const st = el.children[i];
      const [sx, , sy] = st.firstChild.children;
      sx.textContent = `${x}${suf}`; sy.textContent = `${y}${suf}`;
      const tot = x + y || 1;
      const [bx, by] = st.lastChild.querySelectorAll('i');
      bx.style.width = `${(x / tot) * 100}%`; by.style.width = `${(y / tot) * 100}%`;
    });
  }

  _renderMomentum() {
    if (this.tab !== 'mom' || !this._momCanvas) return;
    drawMomentum(this._momCanvas, this.match, this.match.teams.map((t) => t.kit.fill));
  }

  _renderTeams() {
    if (this.tab !== 'teams' || !this._teamsEl) return;
    const m = this.match;
    const order = this.o.userSide === 1 ? [1, 0] : [0, 1];
    const blocks = [];
    for (const side of order) {
      const t = m.teams[side];
      const mine = side === this.o.userSide;
      blocks.push(h('div.teamhdr', null, crest(t.def, 22), t.def.name, h('span.f', null, `${t.tactics.formation} · ${t.subsLeft} trocas`)));
      const rows = [...t.onPitch, ...t.out].map((p) => {
        const icons = `${'⚽'.repeat(p.st.goals)}${p.st.assists ? '🅰'.repeat(p.st.assists) : ''}${p.yellow ? '🟨' : ''}${p.off ? '🟥' : ''}${p.entered > 0 ? '🔼' : ''}${p.left != null && !p.off && !t.onPitch.includes(p) ? '🔽' : ''}`;
        const tr = h('tr', null,
          h('td.num', null, p.d.number),
          h('td.pos', null, p.isGK ? 'GOL' : p.slot),
          h('td', null, mine && t.onPitch.includes(p) && !m.finished ? h('button', { type: 'button', style: { background: 'none', border: 0, padding: '4px 0', textAlign: 'left', minHeight: '32px' }, title: 'Substituir', onclick: () => this.openTactics(p.d.id) }, p.d.name) : p.d.name, icons ? ` ${icons}` : ''),
          h('td.en', null, t.onPitch.includes(p) ? h('span.energy', { title: `Energia ${Math.round(p.energy * 100)}%` }, h('i', { style: { width: `${Math.round(p.energy * 100)}%`, background: p.energy > 0.7 ? '#7ddc6a' : p.energy > 0.5 ? '#e8c65a' : '#f0705a' } })) : ''),
          h('td.rt', null, ratingBadge(m.rating(p))));
        if (!t.onPitch.includes(p)) tr.classList.add('out');
        return tr;
      });
      blocks.push(h('table.lineup', null, h('tbody', null, rows)));
    }
    this._teamsEl.replaceChildren(...blocks);
  }

  // ---------- atualização periódica ----------
  _updateUi(force = false) {
    const m = this.match, [H, A] = m.teams;
    this.hs.textContent = H.score; this.as.textContent = A.score;
    this.clock.textContent = m.finished ? 'Encerrado' : m.phase === 'halftime' ? 'Intervalo' : m.clockLabel;
    this.periodLbl.textContent = m.finished ? `${m.added[1] ? '90+' + m.added[1] + "'" : "90'"}` : m.period === 1 ? '1º tempo' : '2º tempo';
    const [pa, pb] = m.possession();
    this.possH.style.width = `${pa}%`; this.possA.style.width = `${pb}%`;
    this.skipBtn.textContent = m.phase === 'halftime' ? '2º tempo ▶' : m.period === 1 ? 'Intervalo ⏭' : 'Fim ⏭';
    this.skipBtn.disabled = m.finished;
    if (this.tacBtn) this.tacBtn.disabled = m.finished;
    if (m.dead && !m.finished && m.phase === 'play') {
      this.deadTag.textContent = `${DEAD_LABEL[m.dead.type] || ''} · ${m.dead.team.def.short}`;
      this.deadTag.classList.remove('hidden');
    } else this.deadTag.classList.add('hidden');
    if (this.tab === 'stats') this._renderStats();
    const perfOn = this.app.settings.showStats;
    this.perf.classList.toggle('hidden', !perfOn);
    if (perfOn) {
      const mon = this.app.monitor;
      const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/d';
      this.perf.textContent = `${mon.fps.toFixed(0)} fps  p95 ${mon.p95.toFixed(1)} ms\ndesenho ${this.renderer.drawMs.toFixed(2)} ms\nmotor ${this.engineMs.toFixed(2)} ms (${this.stepsLast} passos)\nqualidade ${this.app.qualityLabel()}  dpr ${this.renderer.dpr.toFixed(2)}\nmemória ${mem}  quadros longos ${mon.longFrames}`;
    }
    if (force) { this._updateSlow(); }
  }
  _updateSlow() {
    if (this.tab === 'mom') this._renderMomentum();
    if (this.tab === 'teams' && !this.sheetOpen) this._renderTeams();
    if (this.tab === 'stats' && this._heatA) {
      drawHeat(this._heatA, this.match, 0, this.match.teams[0].kit.fill);
      drawHeat(this._heatB, this.match, 1, this.match.teams[1].kit.fill);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this._bannerT);
    document.removeEventListener('keydown', this._onKey);
    document.removeEventListener('visibilitychange', this._onVis);
    this._ro?.disconnect();
    this._htModal?.close();
    this._ftModal?.close();
    this.sheetOpen?.close();
    audio.stopMatch();
    this.el.remove();
  }
}
