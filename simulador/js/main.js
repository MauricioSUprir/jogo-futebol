// Ponto de entrada: carrega configurações, decide a qualidade, monta as telas e trata falhas.
import { VERSION, QUALITY, QUALITY_KEYS } from './config.js';
import { log, installGlobalHandlers } from './log.js';
import { loadSettings, saveSettings, pushHistory } from './storage.js';
import { FrameMonitor, autoLevel, detectDevice, qualityPreset } from './quality.js';
import { audio } from './audio.js';
import { h, toast } from './dom.js';
import { MatchView } from './match-view.js';
import { homeScreen, quickScreen, seasonScreen, settingsScreen, helpScreen, diagScreen } from './screens.js';

const root = document.getElementById('app');
const dev = detectDevice();

const app = {
  settings: loadSettings(),
  monitor: new FrameMonitor(),
  level: 'medio',
  current: null,
  matchView: null,

  saveSettings() { saveSettings(this.settings); },
  qualityPreset() { return qualityPreset(this.level); },
  qualityLabel() { return this.settings.quality === 'auto' ? `Auto (${QUALITY[this.level].label})` : QUALITY[this.level].label; },
  setQuality(v) {
    this.settings.quality = v;
    this.level = v === 'auto' ? autoLevel(dev) : v;
    this.saveSettings();
    this.matchView?.applyQuality();
    log.info('Qualidade:', this.qualityLabel());
  },
  /** Chamado pela partida ~1x/s; no AUTO pode descer/subir um nível. */
  adaptQuality(now) {
    if (this.settings.quality !== 'auto') { this.monitor.compute(); return null; }
    const next = this.monitor.adapt(now, this.level, QUALITY[this.level].fpsCap);
    if (next && QUALITY_KEYS.includes(next)) { this.level = next; return next; }
    return null;
  },
  applySound() { audio.setEnabled(this.settings.sound); },
  applyMotion() {
    const reduced = this.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.toggle('reduced', this.settings.reducedMotion);
    if (this.matchView) this.matchView.renderer.reducedMotion = reduced;
  },
  resetAll() {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('lal.')) localStorage.removeItem(k); } catch { /* sem acesso */ }
    this.settings = loadSettings();
    this.setQuality(this.settings.quality);
    this.applySound(); this.applyMotion();
    toast('Dados apagados');
    this.go.home();
  },

  show(el) {
    this.matchView?.destroy();
    this.matchView = null;
    this.current?.cleanup?.();
    this.current?.remove();
    this.current = el;
    root.appendChild(el);
    const f = el.querySelector('[autofocus]') || el.querySelector('h2, h1');
    if (f) { if (!f.hasAttribute('tabindex') && !/BUTTON|INPUT/.test(f.tagName)) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  },

  go: {},

  startMatch(o) {
    const seed = o.seed ?? ((Date.now() % 2147483647) || 1);
    const done = o.onDone || (() => this.go.home());
    const quick = !o.season;
    const opts = {
      ...o, seed,
      // partidas rápidas entram no histórico ao terminar (menu ou revanche)
      onDone: (m) => { if (quick) recordHistory(m); done(m); },
      onExit: o.onExit || (() => this.go.home()),
      onRematch: () => { recordHistory(this.matchView?.match); this.startMatch({ home: o.home, away: o.away, userSide: o.userSide }); },
    };
    this.show(h('div'));
    let mv;
    try {
      mv = new MatchView(this, opts);
    } catch (e) {
      log.error('Falha ao abrir a partida', e);
      toast('Não foi possível abrir a partida.', true);
      this.go.home();
      return;
    }
    this.current.remove();
    this.current = mv.el;
    root.appendChild(mv.el);
    this.matchView = mv;
    if (!o.preplayed) mv.start();
  },
};

function recordHistory(m) {
  if (!m?.finished || m._recorded) return;
  m._recorded = true;
  const r = m.result();
  pushHistory({ home: r.home, away: r.away, hs: r.hs, as: r.as, t: Date.now() });
}

const screens = { home: homeScreen, quick: quickScreen, season: seasonScreen, settings: settingsScreen, help: helpScreen, diag: diagScreen };
for (const [k, fn] of Object.entries(screens)) {
  app.go[k] = () => {
    try { app.show(fn(app)); }
    catch (e) { log.error(`Falha ao abrir a tela ${k}`, e); if (k !== 'home') { toast('Algo deu errado ao abrir essa tela.', true); app.go.home(); } else fatal(e); }
  };
}

// Esc volta ao menu nas telas simples (a partida trata o próprio Esc)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || app.matchView || document.querySelector('.overlay')) return;
  if (app.current && app.current.id !== 'home') app.go.home();
});
// qualquer toque libera o áudio (regra de autoplay dos navegadores)
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });

function fatal(e) {
  const box = h('div.fatal', { role: 'alert' }, h('div.box', null,
    h('h2', null, 'Algo deu errado'),
    h('p', { style: { color: 'var(--muted)' } }, 'O simulador encontrou um erro inesperado. Recarregar costuma resolver.'),
    h('pre', { style: { textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: '12px', color: '#ffb3ad' } }, String(e?.message || e)),
    h('button.btn.primary', { type: 'button', onclick: () => location.reload() }, 'Recarregar')));
  document.body.appendChild(box);
}

function boot() {
  clearTimeout(window.__lalBootTimer);
  installGlobalHandlers();
  log.info(`LANCE A LANCE v${VERSION} iniciado`);
  app.level = app.settings.quality === 'auto' ? autoLevel(dev) : app.settings.quality;
  log.info('Aparelho:', dev, '→ qualidade', app.qualityLabel());
  app.applySound();
  app.applyMotion();
  if (!document.createElement('canvas').getContext('2d')) throw new Error('Este navegador não suporta canvas 2D.');
  document.getElementById('boot')?.remove();
  app.go.home();
  // service worker: funciona offline depois da primeira visita
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => log.warn('Service worker não registrado', e.message));
  }
}

try { boot(); } catch (e) { log.error(e); fatal(e); }

// ganchos para testes automatizados (não usados pela interface)
window.__lal = { app, log };
