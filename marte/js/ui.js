// Interface: HUD, bússola, avisos, menus e configurações.
import { SUIT_COLORS } from './config.js';
import { TIERS } from './settings.js';

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export class UI {
  constructor(settings) {
    this.s = settings;
    this.el = {
      hud: $('hud'), sol: $('st-sol'), clock: $('st-clock'), temp: $('st-temp'), press: $('st-press'), wind: $('st-wind'), alt: $('st-alt'),
      toast: $('toast'), fps: $('fps'), strip: $('compass-strip'), visor: $('visor'), touch: $('touch'),
    };
    this._buildCompass();
    this._toastTimer = 0;
    this.applyAccessibility();
  }

  applyAccessibility() {
    document.documentElement.style.setProperty('--ui', this.s.uiScale);
    document.documentElement.classList.toggle('contrast', !!this.s.contrast);
  }

  _buildCompass() {
    const strip = this.el.strip;
    const W = 3; // px por grau
    this.compassW = W;
    const labels = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    let html = '';
    for (let d = -360; d <= 720; d += 15) {
      const a = ((d % 360) + 360) % 360;
      const lab = labels[a];
      html += `<span class="${lab ? 'card' : ''} ${a === 0 ? 'n' : ''}" style="left:${(d + 360) * W}px">${lab || '·'}</span>`;
    }
    strip.innerHTML = html;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }
  showTouch(on) { this.el.touch.classList.toggle('hidden', !on); }
  showVisor(on) { this.el.visor.classList.toggle('hidden', !on); }

  toast(msg, secs = 3.5) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    this._toastTimer = secs;
  }

  update(dt, env, heading, altitude) {
    const h = env.hour;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    this.el.sol.textContent = 'SOL ' + env.sol;
    this.el.clock.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    const t = env.airTempC;
    this.el.temp.textContent = (t < 0 ? '−' : '') + fmt(Math.abs(t)) + ' °C';
    this.el.press.textContent = fmt(env.pressureKPa, 2) + ' kPa';
    this.el.wind.textContent = fmt(env.windSpeed, 0) + ' m/s';
    this.el.alt.textContent = (altitude < 0 ? '−' : '') + fmt(Math.abs(altitude)) + ' m';
    // bússola: o centro da faixa aponta o rumo atual
    const W = this.compassW, box = this.el.strip.parentElement.clientWidth;
    this.el.strip.style.transform = `translateX(${box / 2 - (heading + 360) * W}px)`;
    if (this._toastTimer > 0) { this._toastTimer -= dt; if (this._toastTimer <= 0) this.el.toast.classList.remove('show'); }
  }

  setFps(text) { this.el.fps.textContent = text; }
  toggleFps(on) { this.el.fps.classList.toggle('hidden', !on); }

  showHelp(touch, pad, onClose) {
    const body = $('help-body');
    if (touch) {
      body.innerHTML = `Joystick à esquerda: andar (empurre até a borda para correr)<br>
        Arrastar à direita: olhar em volta · Pinça: zoom<br>
        <b>PULO</b> pula · <b>CORRER</b> fixa a corrida · <b>LUZ</b> lanterna · <b>CÂM</b> 1ª/3ª pessoa`;
    } else {
      body.innerHTML = `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular<br>
        Mouse: olhar (clique para capturar) · Roda: zoom<br>
        <kbd>V</kbd> 1ª/3ª pessoa · <kbd>L</kbd> lanterna · <kbd>T</kbd> acelerar o tempo (segure)<br>
        <kbd>Esc</kbd> pausa e configurações · <kbd>F3</kbd> FPS` +
        (pad ? '<br>Controle: analógicos, A pular, X luz, Y câmera, RT correr, Start pausa' : '');
    }
    $('help').classList.remove('hidden');
    $('help-ok').onclick = () => { $('help').classList.add('hidden'); onClose?.(); };
  }
}

// ---------------------------------------------------------------- menus
export function setupMenus({ settings, hasSave, onNew, onContinue, onSettingsChange, onQualityChange, onResume, onMainMenu, detected }) {
  const screens = ['menu', 'newgame', 'credits', 'settings'];
  const show = (id) => { for (const s of screens) $(s).classList.toggle('hidden', s !== id); };
  const hideAll = () => screens.forEach((s) => $(s).classList.add('hidden'));

  $('btn-continue').classList.toggle('hidden', !hasSave());
  $('btn-new').onclick = () => show('newgame');
  $('btn-continue').onclick = () => { hideAll(); onContinue(); };
  $('btn-credits').onclick = () => show('credits');
  document.querySelector('#credits [data-close]').onclick = () => show('menu');
  let settingsFrom = 'menu';
  $('btn-settings-menu').onclick = () => { settingsFrom = 'menu'; $('set-close').textContent = 'Voltar'; $('set-menu').classList.add('hidden'); show('settings'); };

  // nova missão
  let color = SUIT_COLORS[0].hex;
  const sw = $('ng-colors');
  sw.innerHTML = '';
  for (const c of SUIT_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch'; b.style.background = c.hex; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', c.name);
    b.setAttribute('aria-checked', c.hex === color ? 'true' : 'false');
    b.onclick = () => { color = c.hex; sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); };
    sw.appendChild(b);
  }
  $('ng-name').value = settings.lastName || '';
  $('ng-back').onclick = () => show('menu');
  $('ng-start').onclick = () => {
    const name = ($('ng-name').value || '').trim().slice(0, 16) || 'Astronauta';
    hideAll(); onNew({ name, color });
  };

  // configurações
  const q = $('set-quality');
  const info = () => {
    const t = settings.quality === 'auto' ? detected.tier : settings.quality;
    $('set-quality-info').textContent = `Em uso: ${TIERS[t].label}` + (settings.quality === 'auto' ? ' (automático)' : '') +
      `. GPU: ${detected.gpu || 'desconhecida'}. Trocar a qualidade recarrega o jogo (o progresso é salvo).`;
  };
  q.value = settings.quality; info();
  q.onchange = () => { settings.quality = q.value; info(); onQualityChange(); };
  const bind = (id, key, prop = 'checked', cb) => {
    const el = $(id); el[prop] = settings[key];
    el.oninput = () => { settings[key] = prop === 'checked' ? el.checked : parseFloat(el.value); onSettingsChange(key); cb?.(); };
  };
  bind('set-fps', 'showFps');
  bind('set-sens', 'sensitivity', 'value');
  bind('set-invert', 'invertY');
  bind('set-firstperson', 'firstPerson');
  bind('set-ui', 'uiScale', 'value');
  bind('set-shake', 'reduceShake');
  bind('set-contrast', 'contrast');
  bind('set-vol', 'volume', 'value');
  $('set-close').onclick = () => { if (settingsFrom === 'game') { hideAll(); onResume(); } else show('menu'); };
  $('set-menu').onclick = () => { onMainMenu(); };

  return {
    showMain: () => { $('btn-continue').classList.toggle('hidden', !hasSave()); show('menu'); },
    openPause: () => { settingsFrom = 'game'; $('set-close').textContent = 'Voltar ao jogo'; $('set-menu').classList.remove('hidden'); show('settings'); },
    isOpen: () => screens.some((s) => !$(s).classList.contains('hidden')),
    hideAll,
    prepareMenuSettings: () => { $('set-close').textContent = 'Voltar'; $('set-menu').classList.add('hidden'); },
  };
}
