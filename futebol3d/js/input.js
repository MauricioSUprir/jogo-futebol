// Entrada unificada: teclado, controle (Gamepad API, mapeamento padrão) e toque
// (joystick virtual + botões contextuais). Produz um "comando" por quadro com
// movimento no mundo (relativo à câmera), botões segurados, apertados e soltos
// (com tempo segurado, para a força do passe/chute).

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'pass', KeyJ: 'tackle', KeyK: 'shoot', KeyL: 'long', KeyI: 'through', KeyO: 'finesse', KeyP: 'chip',
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
    this.lastDevice = (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) ? 'touch' : 'keyboard';
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
    let R = 60;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    let ox = 0, oy = 0;
    const home = () => { base.style.left = ''; base.style.top = ''; base.style.bottom = ''; };
    zone.addEventListener('pointerdown', (e) => {
      if (this.touchStick.id !== null) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.touchStick.id = e.pointerId;
      const r = zone.getBoundingClientRect();
      R = base.offsetWidth * 0.42;
      ox = e.clientX; oy = e.clientY;
      base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top - base.offsetHeight / 2) + 'px'; base.style.bottom = 'auto';
      base.classList.add('on');
      this.lastDevice = 'touch';
      this.onAny && this.onAny();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touchStick.id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      // a base acompanha o dedo quando ele passa do limite
      if (d > R * 1.25) { ox += dx - dx / d * R * 1.25; oy += dy - dy / d * R * 1.25; const r = zone.getBoundingClientRect(); base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top - base.offsetHeight / 2) + 'px'; }
      const k = Math.min(1, d / R);
      const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
      setKnob(nx * Math.min(d, R), ny * Math.min(d, R));
      // zona morta + curva suave
      const m = k < 0.12 ? 0 : (k - 0.12) / 0.88;
      this.touchStick.x = nx * m; this.touchStick.y = -ny * m;
      // empurrou até a borda: corre (como no futebol de celular)
      this.touchStick.sprint = d > R * 1.05;
      base.classList.toggle('sprint', this.touchStick.sprint);
    });
    const end = (e) => {
      if (e.pointerId !== this.touchStick.id) return;
      this.touchStick = { x: 0, y: 0, id: null, sprint: false };
      setKnob(0, 0); base.classList.remove('on', 'sprint'); home();
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    root.appendChild(pad);
    // Só 4 botões (como no futebol de celular). O resto é gesto:
    //  - arrastar o PASSE para cima = lançamento/cruzamento (na defesa: dobrar a marcação)
    //  - arrastar o CHUTE para cima = cavadinha; para o lado/baixo = colocado
    //  - o 3º botão muda com o lance: ENFIADA no ataque, TROCAR na defesa e com bola solta
    //  - deslizar o dedo na área livre da direita = drible (finta)
    // O gesto é decidido ao soltar (as ações saem no soltar, com a força do tempo segurado).
    const swipe = document.createElement('div');
    swipe.className = 'tc-swipe';
    root.insertBefore(swipe, pad);
    let sw = null;
    swipe.addEventListener('pointerdown', (e) => { e.preventDefault(); swipe.setPointerCapture(e.pointerId); sw = { x: e.clientX, y: e.clientY, t: performance.now() }; this.lastDevice = 'touch'; });
    swipe.addEventListener('pointerup', (e) => {
      if (!sw) return;
      const d = Math.hypot(e.clientX - sw.x, e.clientY - sw.y);
      if (d > 30 && performance.now() - sw.t < this.swipeMs) this.taps.skill = 0.05;
      else if (d < 14 && performance.now() - sw.t < 350) this.onTapScreen?.(e.clientX, e.clientY);   // toque curto: selecionar jogador
      sw = null;
    });
    swipe.addEventListener('pointercancel', () => { sw = null; });
    this.touchButtons = {};
    this.touchKey = {};              // botão → tecla lógica atual (o 3º muda com o contexto)
    this.swapRelease = {};           // gesto: soltar o botão X vira a ação Y
    this.swipeMs = 700;              // deslize mais lento que isso não conta como drible
    // 'tackle' (DIVIDIDA) só aparece na defesa
    const defs = [['shoot', 'Chute', 'big'], ['pass', 'Passe', ''], ['third', 'Enfiada', ''], ['tackle', 'Dividida', ''], ['sprint', 'Correr', 'wide']];
    for (const [id, label, cls] of defs) {
      const b = document.createElement('button');
      b.className = 'tc-btn tc-' + id + (cls ? ' ' + cls : '');
      b.type = 'button';
      b.innerHTML = `<span>${label}</span><em></em><i class="tc-charge"></i>`;
      b.setAttribute('aria-label', label);
      this.touchKey[id] = id === 'third' ? 'through' : id;
      let st = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); b.setPointerCapture(e.pointerId);
        if (this.editing) return;
        st = { x: e.clientX, y: e.clientY, key: this.touchKey[id] };
        // TROCAR decide no soltar: toque = troca inteligente; arrastar = troca direcional
        if (st.key !== 'switch') this.touchBtn[st.key] = true;
        b.classList.add('on'); this.lastDevice = 'touch'; this.onAny && this.onAny();
      });
      b.addEventListener('pointermove', (e) => {
        if (!st) return;
        const g = gestureFor(id, st.key, e.clientX - st.x, e.clientY - st.y);
        b.dataset.g = g || '';
      });
      const up = (e) => {
        if (!st) return;
        if (st.key === 'switch') {
          if (e && e.type === 'pointerup') {
            const dx = e.clientX - st.x, dy = e.clientY - st.y;
            if (Math.hypot(dx, dy) >= 34) { this.switchDir = { dx, dy }; this.taps.switchdir = 0.05; }
            else this.taps.switch = 0.05;
          }
          b.classList.remove('on'); st = null;
          return;
        }
        const g = e && e.type === 'pointerup' ? gestureFor(id, st.key, e.clientX - st.x, e.clientY - st.y) : null;
        if (g) this.swapRelease[st.key] = g;
        this.touchBtn[st.key] = false; b.classList.remove('on'); b.dataset.g = ''; st = null;
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      pad.appendChild(b);
      this.touchButtons[id] = b;
    }
    if (this.settings) this.applyTouchLayout(this.settings);
    const pause = document.createElement('button');
    pause.className = 'tc-pause'; pause.type = 'button'; pause.setAttribute('aria-label', 'Pausar');
    pause.innerHTML = '<i></i><i></i>';
    pause.addEventListener('click', () => this.onPause && this.onPause());
    root.appendChild(pause);
    this.context = '';
  }

  // Tamanho, transparência e posição dos botões (configurações; §15 "redimensionável").
  applyTouchLayout(st) {
    if (!this.touchRoot) return;
    this.touchRoot.style.setProperty('--tc-scale', st.touchScale ?? 1);
    this.touchRoot.style.setProperty('--tc-alpha', st.touchOpacity ?? 0.85);
    for (const [id, b] of Object.entries(this.touchButtons || {})) {
      const o = (st.touchLayout || {})[id] || [0, 0];
      b.style.setProperty('--dx', o[0] + 'vh'); b.style.setProperty('--dy', o[1] + 'vh');
    }
  }

  // Editor: arrasta os botões para onde quiser; "Concluir" salva, "Padrão" volta ao original.
  editTouchLayout(root, st, save, onClose) {
    const wasHidden = root.classList.contains('hidden');
    if (!this.touchButtons) this.buildTouch(root);
    root.classList.remove('hidden');
    root.classList.add('tc-editing');
    this.editing = true;
    const layout = { ...(st.touchLayout || {}) };
    const bar = document.createElement('div');
    bar.className = 'tc-editbar';
    bar.innerHTML = '<b>Arraste os botões</b><button type="button" data-a="reset">Padrão</button><button type="button" data-a="ok">Concluir</button>';
    root.appendChild(bar);
    const vh = innerHeight / 100;
    const offs = [];
    for (const [id, b] of Object.entries(this.touchButtons)) {
      b.classList.remove('hide');
      let d = null;
      const down = (e) => { if (!this.editing) return; e.stopPropagation(); const o = layout[id] || [0, 0]; d = { x: e.clientX, y: e.clientY, o }; b.classList.add('on'); };
      const move = (e) => { if (!d) return; const o = [d.o[0] + (e.clientX - d.x) / vh * -1, d.o[1] + (e.clientY - d.y) / vh]; layout[id] = [Math.round(o[0] * 10) / 10, Math.round(o[1] * 10) / 10]; this.applyTouchLayout({ ...st, touchLayout: layout }); };
      const up = () => { d = null; b.classList.remove('on'); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointermove', move); b.addEventListener('pointerup', up);
      offs.push(() => { b.removeEventListener('pointerdown', down); b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); });
    }
    const close = (keep) => {
      offs.forEach(f => f());
      bar.remove(); root.classList.remove('tc-editing'); this.editing = false;
      if (keep) save(layout); else this.applyTouchLayout(st);
      if (wasHidden) root.classList.add('hidden');
      this.context = ''; onClose?.();
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'reset') { for (const k in layout) delete layout[k]; this.applyTouchLayout({ ...st, touchLayout: layout }); }
      if (a === 'ok') close(true);
    });
  }

  // Troca os rótulos (e a função do 3º botão) conforme a situação.
  setContext(ctx) {
    if (!this.touchButtons || ctx === this.context) return;
    this.context = ctx;
    // [rótulo, dica do gesto] por botão; third = [rótulo, tecla lógica]
    const L = {
      attack: { shoot: ['Chute', '↑ cavadinha · → colocado'], pass: ['Passe', '↑ lançar'], third: ['Enfiada', 'through'] },
      defend: { shoot: ['Carrinho', ''], pass: ['Pressão', ''], third: ['Trocar', 'switch'], tackle: ['Dividida', ''] },
      loose: { shoot: ['Chute', ''], pass: ['Passe', '↑ lançar'], third: ['Trocar', 'switch'] },
      setpiece: { shoot: ['Chute', '↑ cavadinha · → colocado'], pass: ['Curto', ''], third: ['Longo', 'long'] },
      gk: { shoot: ['Chutão', ''], pass: ['Repor', ''], third: ['Rolar', 'through'] },
      penaltyDef: { shoot: ['—', ''], pass: ['—', ''], third: ['—', 'through'] },
    }[ctx] || {};
    for (const [id, b] of Object.entries(this.touchButtons)) {
      const v = L[id];
      if (!v) continue;
      b.querySelector('span').textContent = v[0];
      b.classList.toggle('off', v[0] === '—');
      if (id === 'third') { this.touchKey.third = v[1]; b.classList.toggle('tc-troca', v[1] === 'switch'); }
      else b.querySelector('em').textContent = v[1];
    }
    this.touchButtons.tackle.classList.toggle('hide', ctx !== 'defend');
    this.touchRoot.dataset.ctx = ctx;
  }

  // ------------------------------------------------------------- leitura
  poll(camRight, camFwd) {
    const pad = this.padIndex !== null && navigator.getGamepads ? navigator.getGamepads()[this.padIndex] : null;
    const b = {};
    const k = this.keys;
    for (const n of ['sprint', 'pass', 'shoot', 'long', 'through', 'finesse', 'chip', 'switch', 'switchdir', 'skill', 'shield', 'jockey', 'tackle', 'pause']) b[n] = k.has(n) || !!this.touchBtn[n] || !!this.mouse[n];
    let sx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    let sy = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0);
    if (sx && sy) { sx *= 0.7071; sy *= 0.7071; }
    if (this.touchStick.id !== null) { sx = this.touchStick.x; sy = this.touchStick.y; if (this.touchStick.sprint) b.sprint = true; }
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
      if (rb && !pb(1)) b.tackle = true;     // RB sozinho = dividida
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
    // gesto no botão de toque: o soltar vira outra ação, com a mesma força
    for (const n in this.swapRelease) {
      const to = this.swapRelease[n];
      if (release[n]) { delete release[n]; release[to] = true; hold[to] = hold[n]; delete hold[n]; }
      delete this.swapRelease[n];
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
    if (this.touchButtons) for (const [id, el] of Object.entries(this.touchButtons)) {
      const n = this.touchKey[id];
      if (CHARGE.includes(n)) el.style.setProperty('--charge', b[n] ? Math.min(1, (now - (this.downAt[n] || now)) / 0.95).toFixed(2) : 0);
    }
    // troca direcional: arrasto na tela → direção no campo (relativa à câmera)
    let swx = 0, swz = 0;
    if (this.switchDir) {
      const { dx, dy } = this.switchDir;
      swx = camRight.x * dx - camFwd.x * dy; swz = camRight.z * dx - camFwd.z * dy;
      const l = Math.hypot(swx, swz) || 1; swx /= l; swz /= l;
      if (!this.edges.press.switchdir) this.switchDir = null;
    }
    this.cmd = { mx, mz, rx: wrx, rz: wrz, held: b, press: this.edges.press, release: this.edges.release, hold: this.edges.hold, sx, sy, swx, swz };
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

// gesto ao arrastar um botão de toque (null = toque normal)
function gestureFor(id, key, dx, dy) {
  if (Math.hypot(dx, dy) < 34) return null;
  if (id === 'pass' && dy < -Math.abs(dx) * 0.6) return 'long';
  if (id === 'shoot' && key === 'shoot') return dy < -Math.abs(dx) * 0.6 ? 'chip' : 'finesse';
  return null;
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
