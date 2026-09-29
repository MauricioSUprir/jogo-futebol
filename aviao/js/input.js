// Entrada de voo: teclado, mouse (olhar), gamepad/manche USB, toque (manche virtual + manete)
// e inclinação do celular (acelerômetro).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FlightInput {
  constructor(canvas, touchUI, settings) {
    this.canvas = canvas; this.settings = settings;
    this.keys = new Set();
    this.pitch = 0; this.roll = 0; this.yaw = 0;           // -1..1 (pitch + = puxar)
    this.throttle = 0; this.brake = 0; this.trim = 0;
    this.flapsDelta = 0;
    this.actions = new Set();
    this.look = { x: 0, y: 0, active: false };
    this.zoom = 0;
    this.enabled = false; this.usingTouch = false; this.usingPad = false; this.timeWarp = false;
    this._stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this._look = { id: null, x: 0, y: 0 };
    this._padPrev = [];
    this.tilt = { ok: false, beta0: null, gamma0: null, x: 0, y: 0 };

    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = { KeyC: 'cam', KeyP: 'pause', Escape: 'pause', KeyL: 'lights', KeyR: 'reset', KeyH: 'help', F3: 'fps', KeyM: 'engine' }[e.code];
      if (a) { e.preventDefault?.(); this.actions.add(a); }
      if (e.code === 'KeyF') this.flapsDelta += 1;
      if (e.code === 'KeyV') this.flapsDelta -= 1;
      if (e.code === 'Digit1') this.throttle = 0.0;
      if (e.code === 'Digit9') this.throttle = 0.75;
      if (e.code === 'Digit0') this.throttle = 1.0;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // mouse: arrastar gira a câmera; roda: zoom
    let drag = false;
    canvas.addEventListener('mousedown', () => { drag = true; });
    addEventListener('mouseup', () => { drag = false; });
    addEventListener('mousemove', (e) => { if (this.enabled && drag) { this.look.x += e.movementX; this.look.y += e.movementY; this._lookT = performance.now(); } });
    canvas.addEventListener('wheel', (e) => { if (this.enabled) { this.zoom += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });

    // toque: manche virtual à direita, manete (deslizante) à esquerda, arrastar no resto = olhar
    const { stickZone, stickBase, stickKnob, throttleBar, throttleFill, buttons } = touchUI;
    const R = 60;
    stickZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.usingTouch = true; const s = this._stick; s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY;
      const r = stickZone.getBoundingClientRect();
      stickBase.style.left = (e.clientX - r.left - 75) + 'px'; stickBase.style.top = (e.clientY - r.top - 75) + 'px';
      stickZone.setPointerCapture(e.pointerId);
    });
    stickZone.addEventListener('pointermove', (e) => {
      const s = this._stick; if (e.pointerId !== s.id) return;
      let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      s.x = dx / R; s.y = dy / R; stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const endStick = (e) => { const s = this._stick; if (e.pointerId !== s.id) return; s.id = null; s.x = s.y = 0; stickKnob.style.transform = ''; stickBase.style.left = stickBase.style.top = ''; };
    stickZone.addEventListener('pointerup', endStick); stickZone.addEventListener('pointercancel', endStick);

    const setThr = (e) => { const r = throttleBar.getBoundingClientRect(); this.throttle = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
    throttleBar.addEventListener('pointerdown', (e) => { this.usingTouch = true; throttleBar.setPointerCapture(e.pointerId); setThr(e); e.preventDefault(); });
    throttleBar.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType !== 'mouse') setThr(e); });
    this.throttleFill = throttleFill;

    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; this.usingTouch = true; if (this._look.id === null) this._look = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointermove', (e) => { const l = this._look; if (e.pointerId !== l.id) return; this.look.x += (e.clientX - l.x) * 1.5; this.look.y += (e.clientY - l.y) * 1.5; l.x = e.clientX; l.y = e.clientY; this._lookT = performance.now(); });
    const endLook = (e) => { if (e.pointerId === this._look.id) this._look.id = null; };
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);

    for (const b of buttons) {
      const act = b.dataset.act;
      const down = (e) => {
        e.preventDefault(); e.stopPropagation(); this.usingTouch = true; navigator.vibrate?.(8);
        if (act === 'flapdn') this.flapsDelta += 1; else if (act === 'flapup') this.flapsDelta -= 1;
        else if (act === 'brake') this._touchBrake = true;
        else if (act === 'rudl') this._touchRud = -1; else if (act === 'rudr') this._touchRud = 1;
        else this.actions.add(act);
      };
      const up = () => { if (act === 'brake') this._touchBrake = false; if (act === 'rudl' || act === 'rudr') this._touchRud = 0; };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }

    addEventListener('deviceorientation', (e) => {
      if (e.beta == null) return;
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0);
      // em paisagem, "frente/trás" é o gamma e "lados" é o beta
      let pitchRaw, rollRaw;
      if (ang === 90) { pitchRaw = -e.gamma; rollRaw = e.beta; } else if (ang === -90 || ang === 270) { pitchRaw = e.gamma; rollRaw = -e.beta; } else { pitchRaw = e.beta; rollRaw = e.gamma; }
      const t = this.tilt; t.ok = true;
      if (t.beta0 === null) { t.beta0 = pitchRaw; t.gamma0 = rollRaw; }
      t.y = clamp((pitchRaw - t.beta0) / 25, -1, 1); t.x = clamp((rollRaw - t.gamma0) / 30, -1, 1);
    });
  }

  async enableTilt() {
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch { /* recusado */ }
    this.tilt.beta0 = null;
  }
  recenterTilt() { this.tilt.beta0 = null; }

  poll(dt) {
    const k = this.keys, s = this.settings;
    // "simple": W/S = potência, A/D = curva, ↑/↓ = sobe/desce (nariz para cima com ↑)
    // "sim": como num simulador de verdade, W/S = empurrar/puxar o manche e Shift/Ctrl = potência
    const simple = s.scheme !== 'sim';
    this.simple = simple;
    let tp = simple
      ? (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0)
      : (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    let tr = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let ty = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const thrUp = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('PageUp') || k.has('Equal') || k.has('NumpadAdd') || (simple && k.has('KeyW'));
    const thrDn = k.has('ControlLeft') || k.has('ControlRight') || k.has('PageDown') || k.has('Minus') || k.has('NumpadSubtract') || (simple && k.has('KeyS'));
    const thrRate = simple ? 0.7 : 0.45;
    if (thrUp) this.throttle = clamp(this.throttle + dt * thrRate, 0, 1);
    if (thrDn) this.throttle = clamp(this.throttle - dt * thrRate, 0, 1);
    if (k.has('BracketRight')) this.trim = clamp(this.trim + dt * 0.25, -1, 1);
    if (k.has('BracketLeft')) this.trim = clamp(this.trim - dt * 0.25, -1, 1);
    this.timeWarp = k.has('KeyT');
    let brake = k.has('KeyB') || k.has('Space') || (simple && k.has('KeyS') && this.throttle === 0) ? 1 : 0;
    // teclado é digital: suaviza como um manche de verdade
    const rate = (cur, tgt, up, back) => { const r = tgt === 0 ? back : up; return cur + clamp(tgt - cur, -r * dt, r * dt); };
    let analog = false;

    // gamepad / manche USB
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92);
      const std = p.mapping === 'standard';
      const ax = (i) => dz(p.axes[i] || 0);
      const pressed = (i) => !!p.buttons[i]?.pressed, edge = (i) => pressed(i) && !this._padPrev[i];
      if (p.axes.some((v) => Math.abs(v) > 0.15) || p.buttons.some((b) => b.pressed)) this.usingPad = true;
      if (std) {
        if (ax(0) || ax(1)) { analog = true; this.roll = ax(0); this.pitch = ax(1); }
        this.look.x += ax(2) * 700 * dt; this.look.y += ax(3) * 500 * dt; if (ax(2) || ax(3)) this._lookT = performance.now();
        const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
        this.throttle = clamp(this.throttle + (rt - lt) * dt * 0.6, 0, 1);
        if (pressed(4)) ty = -1; if (pressed(5)) ty = 1;
        if (pressed(0)) brake = 1;
        if (edge(2)) this.flapsDelta += 1; if (edge(3)) this.flapsDelta -= 1;
        if (edge(1)) this.actions.add('cam'); if (edge(9)) this.actions.add('pause'); if (edge(8)) this.actions.add('reset');
        if (pressed(12)) this.trim = clamp(this.trim - dt * 0.25, -1, 1); if (pressed(13)) this.trim = clamp(this.trim + dt * 0.25, -1, 1);
      } else {
        // manche genérico: X/Y = comandos, eixo 2 = manete, eixo 5 (torção) = pedais
        analog = true; this.roll = ax(0); this.pitch = ax(1);
        if (p.axes.length > 2) this.throttle = clamp((1 - (p.axes[2] || 0)) / 2, 0, 1);
        if (p.axes.length > 5) ty = ax(5);
        if (pressed(0)) brake = 1; if (edge(1)) this.actions.add('cam');
      }
      this._padPrev = p.buttons.map((b) => b.pressed);
      break;
    }
    // toque / inclinação
    if (this._stick.id !== null) { analog = true; this.roll = this._stick.x; this.pitch = this._stick.y; }
    else if (s.tilt && this.tilt.ok && this.usingTouch) { analog = true; this.roll = this.tilt.x; this.pitch = this.tilt.y; }
    if (this._touchBrake) brake = 1;
    if (this._touchRud) ty = this._touchRud;
    if (this.throttleFill) this.throttleFill.style.height = Math.round(this.throttle * 100) + '%';

    // no modo simples, manche para cima (gamepad/toque) = subir
    if (analog && simple) this.pitch = -this.pitch;
    if (!analog) { this.pitch = rate(this.pitch, tp, 2.2, 3.0); this.roll = rate(this.roll, tr, 2.6, 3.5); }
    this.yaw = rate(this.yaw, ty, 3, 4);
    this.brake = brake;
    this.look.active = performance.now() - (this._lookT || 0) < 1500 || this._look.id !== null;
  }
  get pitchCmd() { return this.settings.invertPitch ? -this.pitch : this.pitch; }
  consumeLook() { const l = { x: this.look.x, y: this.look.y, active: this.look.active }; this.look.x = this.look.y = 0; return l; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }
  consumeFlaps() { const f = this.flapsDelta; this.flapsDelta = 0; return f; }
  take(a) { const h = this.actions.has(a); this.actions.delete(a); return h; }
}
