// Entrada unificada: teclado, controle (Gamepad API, mapeamento padrão) e toque
// (joystick virtual + botões contextuais). Produz um "comando" por quadro com
// movimento no mundo (relativo à câmera), botões segurados, apertados e soltos
// (com tempo segurado, para a força do passe/chute).

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'pass', KeyJ: 'pass', KeyK: 'shoot', KeyL: 'long', KeyI: 'through', KeyO: 'finesse', KeyP: 'chip',
  KeyQ: 'switch', KeyF: 'skill', KeyE: 'shield', KeyC: 'jockey', Escape: 'pause', Enter: 'confirm',
};
const CHARGE = ['pass', 'shoot', 'long', 'through', 'finesse', 'chip'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.btn = {};            // estado lógico atual (teclado ∪ toque ∪ controle)
    this.prev = {};
    this.downAt = {};
    this.edges = { press: {}, release: {}, hold: {} };
    this.stick = { x: 0, y: 0 };   // tela: x direita, y para cima
    this.rstick = { x: 0, y: 0 };
    this.touchStick = { x: 0, y: 0, id: null };
    this.touchBtn = {};
    this.padIndex = null;
    this.lastDevice = 'keyboard';
    this.enabled = false;
    this.onPause = null;
    this.onAny = null;
    this.charging = null;
    this.kDown = {}; this.taps = {};
    addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      if (this.enabled && (k !== 'pause' || true)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      this.kDown[k] = performance.now() / 1000;
      this.lastDevice = 'keyboard';
      if (k === 'pause' && this.enabled && this.onPause) this.onPause();
      this.onAny && this.onAny();
    });
    addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      this.keys.delete(k);
      // toque rápido entre dois quadros: guarda para não perder o comando
      this.taps[k] = performance.now() / 1000 - (this.kDown[k] || performance.now() / 1000);
    });
    addEventListener('blur', () => this.keys.clear());
    // mouse no PC: esquerdo = passe, direito = chute, meio = passe longo (segure para força)
    this.mouse = {};
    const MB = { 0: 'pass', 2: 'shoot', 1: 'long' };
    const canvas = document.getElementById('c');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => { if (!this.enabled || !MB[e.button]) return; e.preventDefault(); this.mouse[MB[e.button]] = true; this.kDown[MB[e.button]] = performance.now() / 1000; this.lastDevice = 'keyboard'; this.onAny && this.onAny(); });
      addEventListener('mouseup', (e) => { const k = MB[e.button]; if (!k || !this.mouse[k]) return; this.mouse[k] = false; this.taps[k] = performance.now() / 1000 - (this.kDown[k] || 0); });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; this.lastDevice = 'gamepad'; });
    addEventListener('gamepaddisconnected', () => { this.padIndex = null; });
  }

  // ---------------------------------------------------------------- toque
  buildTouch(root) {
    this.touchRoot = root;
    root.innerHTML = '';
    const zone = document.createElement('div');
    zone.className = 'tc-zone';
    const base = document.createElement('div'); base.className = 'tc-base';
    const knob = document.createElement('div'); knob.className = 'tc-knob';
    base.appendChild(knob); zone.appendChild(base);
    root.appendChild(zone);
    const R = 56;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    let ox = 0, oy = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (this.touchStick.id !== null) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.touchStick.id = e.pointerId;
      const r = zone.getBoundingClientRect();
      ox = e.clientX; oy = e.clientY;
      base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px';
      base.classList.add('on');
      this.lastDevice = 'touch';
      this.onAny && this.onAny();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touchStick.id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { ox += dx - dx / d * R; oy += dy - dy / d * R; dx = dx / d * R; dy = dy / d * R; }
      const r = zone.getBoundingClientRect();
      base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
      setKnob(dx, dy);
      this.touchStick.x = dx / R; this.touchStick.y = -dy / R;
    });
    const end = (e) => {
      if (e.pointerId !== this.touchStick.id) return;
      this.touchStick = { x: 0, y: 0, id: null };
      setKnob(0, 0); base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    root.appendChild(pad);
    this.touchButtons = {};
    const defs = [
      ['shoot', 'Chute', 'big'], ['pass', 'Passe', ''], ['long', 'Longo', ''], ['through', 'Enfiada', ''],
      ['finesse', 'Colocado', 'sm'], ['chip', 'Cavadinha', 'sm'], ['sprint', 'Correr', 'wide'], ['skill', 'Drible', 'sm'], ['switch', 'Trocar', 'sm'],
    ];
    for (const [k, label, cls] of defs) {
      const b = document.createElement('button');
      b.className = 'tc-btn tc-' + k + (cls ? ' ' + cls : '');
      b.type = 'button';
      b.innerHTML = `<span>${label}</span><i class="tc-charge"></i>`;
      b.setAttribute('aria-label', label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.touchBtn[k] = true; b.classList.add('on'); this.lastDevice = 'touch'; this.onAny && this.onAny(); });
      const up = () => { this.touchBtn[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      pad.appendChild(b);
      this.touchButtons[k] = b;
    }
    const pause = document.createElement('button');
    pause.className = 'tc-pause'; pause.type = 'button'; pause.setAttribute('aria-label', 'Pausar');
    pause.innerHTML = '<i></i><i></i>';
    pause.addEventListener('click', () => this.onPause && this.onPause());
    root.appendChild(pause);
    this.context = '';
  }

  // Troca os rótulos conforme a situação (ataque, defesa, bola parada, goleiro).
  setContext(ctx) {
    if (!this.touchButtons || ctx === this.context) return;
    this.context = ctx;
    const L = {
      attack: { shoot: 'Chute', pass: 'Passe', long: 'Longo', through: 'Enfiada', finesse: 'Colocado', chip: 'Cavadinha', skill: 'Drible', switch: 'Proteger' },
      defend: { shoot: 'Carrinho', pass: 'Pressão', long: 'Dobrar', through: 'Goleiro', finesse: '—', chip: '—', skill: 'Conter', switch: 'Trocar' },
      loose: { shoot: 'Chute', pass: 'Passe', long: 'Longo', through: 'Enfiada', finesse: 'Colocado', chip: 'Cavadinha', skill: 'Drible', switch: 'Trocar' },
      setpiece: { shoot: 'Chute', pass: 'Curto', long: 'Longo', through: 'Enfiada', finesse: 'Colocado', chip: 'Cavadinha', skill: '—', switch: '—' },
      gk: { shoot: 'Chutão', pass: 'Repor', long: 'Chutão', through: 'Rolar', finesse: '—', chip: '—', skill: '—', switch: '—' },
      penaltyDef: { shoot: '—', pass: '—', long: '—', through: '—', finesse: '—', chip: '—', skill: '—', switch: '—' },
    }[ctx] || {};
    for (const [k, b] of Object.entries(this.touchButtons)) {
      if (!L[k]) continue;
      b.querySelector('span').textContent = L[k];
      b.classList.toggle('off', L[k] === '—');
    }
    this.touchRoot.dataset.ctx = ctx;
  }

  // ------------------------------------------------------------- leitura
  poll(camRight, camFwd) {
    const pad = this.padIndex !== null && navigator.getGamepads ? navigator.getGamepads()[this.padIndex] : null;
    const b = {};
    const k = this.keys;
    for (const n of ['sprint', 'pass', 'shoot', 'long', 'through', 'finesse', 'chip', 'switch', 'skill', 'shield', 'jockey', 'pause']) b[n] = k.has(n) || !!this.touchBtn[n] || !!this.mouse[n];
    // botões de toque que mudam de função com o contexto
    if (this.context === 'attack' && this.touchBtn.switch) { b.shield = true; b.switch = k.has('switch'); }
    if (this.context === 'defend' && this.touchBtn.skill) { b.jockey = true; b.skill = k.has('skill'); }
    let sx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    let sy = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0);
    if (sx && sy) { sx *= 0.7071; sy *= 0.7071; }
    if (this.touchStick.id !== null) { sx = this.touchStick.x; sy = this.touchStick.y; }
    let rx = 0, ry = 0;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const ax = dz(pad.axes[0] || 0), ay = dz(pad.axes[1] || 0);
      if (Math.hypot(ax, ay) > 0.05) { sx = ax; sy = -ay; this.lastDevice = 'gamepad'; }
      rx = dz(pad.axes[2] || 0); ry = -dz(pad.axes[3] || 0);
      const pb = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4));
      const rb = pb(5), lt = pb(6);
      // B com RB = colocado; B com LT = cavadinha
      if (pb(1)) { if (rb) b.finesse = true; else if (lt) b.chip = true; else b.shoot = true; }
      if (pb(0)) b.pass = true;
      if (pb(2)) b.long = true;
      if (pb(3)) b.through = true;
      if (pb(4)) b.switch = true;
      if (pb(7)) b.sprint = true;
      if (lt && !pb(1)) b.jockey = true;
      if (pb(10) || pb(11)) b.skill = true;
      if (pb(9) && !this.prev.padStart && this.onPause) this.onPause();
      this.prev.padStart = pb(9);
      if (pad.buttons.some(x => x && x.pressed)) { this.lastDevice = 'gamepad'; }
      this.pad = pad;
    }
    // bordas
    const now = performance.now() / 1000;
    const press = {}, release = {}, hold = {};
    for (const n of Object.keys(b)) {
      if (b[n] && !this.prev[n]) { press[n] = true; this.downAt[n] = now; }
      if (!b[n] && this.prev[n]) { release[n] = true; hold[n] = now - (this.downAt[n] || now); }
      this.prev[n] = b[n];
    }
    // teclas apertadas e soltas entre dois quadros
    for (const n in this.taps) {
      if (!press[n] && !release[n] && !b[n] && !this.edges.release[n]) { press[n] = true; release[n] = true; hold[n] = this.taps[n]; }
      delete this.taps[n];
    }
    // o botão ainda carregando (barra de força)
    let charging = null;
    for (const n of CHARGE) if (b[n]) { charging = { key: n, t: now - (this.downAt[n] || now) }; break; }
    this.charging = charging;
    // acumula bordas até o próximo passo da simulação consumir
    for (const n in press) this.edges.press[n] = true;
    for (const n in release) { this.edges.release[n] = true; this.edges.hold[n] = hold[n]; }

    // analógico → mundo (relativo à câmera)
    const mx = camRight.x * sx + camFwd.x * sy, mz = camRight.z * sx + camFwd.z * sy;
    const wrx = camRight.x * rx + camFwd.x * ry, wrz = camRight.z * rx + camFwd.z * ry;
    if (this.touchButtons) for (const n of CHARGE) {
      const el = this.touchButtons[n];
      if (el) el.style.setProperty('--charge', b[n] ? Math.min(1, (now - (this.downAt[n] || now)) / 0.95).toFixed(2) : 0);
    }
    this.cmd = { mx, mz, rx: wrx, rz: wrz, held: b, press: this.edges.press, release: this.edges.release, hold: this.edges.hold, sx, sy };
    return this.cmd;
  }

  // Chamado depois que um passo da simulação usou as bordas.
  consume() { this.edges = { press: {}, release: {}, hold: {} }; if (this.cmd) { this.cmd.press = this.edges.press; this.cmd.release = this.edges.release; this.cmd.hold = this.edges.hold; } }

  vibrate(ms) {
    try {
      if (this.lastDevice === 'gamepad' && this.pad && this.pad.vibrationActuator) this.pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.6, weakMagnitude: 0.4 });
      else if (this.lastDevice === 'touch' && navigator.vibrate) navigator.vibrate(ms);
    } catch { /* sem vibração */ }
  }
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
