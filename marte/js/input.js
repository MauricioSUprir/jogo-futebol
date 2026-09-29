// Entrada unificada: teclado + mouse, toque (joystick virtual) e gamepad.
export class Input {
  constructor(canvas, touchUI) {
    this.canvas = canvas;
    this.keys = new Set();
    this.moveX = 0; this.moveY = 0;
    this.look = { x: 0, y: 0 };
    this.run = false; this.runToggle = false;
    this.jump = false;
    this.actions = new Set();          // ações de um quadro: cam, lamp, pause, fps
    this.zoom = 0;
    this.enabled = false;
    this.usingTouch = false;
    this.usingPad = false;
    this.timeWarp = false;
    this._jumpQueued = false;
    this._touchMove = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this._touchLook = { id: null, x: 0, y: 0 };
    this._padPrev = [];

    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this._jumpQueued = true;
      if (e.code === 'KeyV') this.actions.add('cam');
      if (e.code === 'KeyL') this.actions.add('lamp');
      if (e.code === 'CapsLock') this.runToggle = !this.runToggle;
      if (e.code === 'F3') { e.preventDefault(); this.actions.add('fps'); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.actions.add('pause');
      if (e.code === 'KeyH') this.actions.add('help');
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); });

    // mouse: arrastar gira a câmera; clique trava o ponteiro (modo FPS)
    canvas.addEventListener('mousedown', () => {
      if (!this.enabled || this.usingTouch) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas || (e.buttons & 1)) { this.look.x += e.movementX; this.look.y += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { if (this.enabled) { this.zoom += Math.sign(e.deltaY) * 0.6; e.preventDefault(); } }, { passive: false });

    // toque
    const stickZone = touchUI.stickZone, base = touchUI.stickBase, knob = touchUI.stickKnob;
    const R = 52;
    stickZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.usingTouch = true;
      const t = this._touchMove; t.id = e.pointerId; t.ox = e.clientX; t.oy = e.clientY;
      const r = stickZone.getBoundingClientRect();
      base.style.left = (e.clientX - r.left - 65) + 'px'; base.style.bottom = (r.bottom - e.clientY - 65) + 'px';
      stickZone.setPointerCapture(e.pointerId);
    });
    stickZone.addEventListener('pointermove', (e) => {
      const t = this._touchMove; if (e.pointerId !== t.id) return;
      let dx = e.clientX - t.ox, dy = e.clientY - t.oy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      t.x = dx / R; t.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const endStick = (e) => {
      const t = this._touchMove; if (e.pointerId !== t.id) return;
      t.id = null; t.x = 0; t.y = 0; knob.style.transform = '';
      base.style.left = ''; base.style.bottom = '';
    };
    stickZone.addEventListener('pointerup', endStick); stickZone.addEventListener('pointercancel', endStick);

    // metade direita da tela: olhar; pinça: zoom
    const pinch = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.enabled) return;
      this.usingTouch = true;
      pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._touchLook.id === null) { this._touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') return;
      if (pinch.size === 2 && pinch.has(e.pointerId)) {
        const pts = [...pinch.values()];
        const d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p2 = [...pinch.values()];
        const d1 = Math.hypot(p2[0].x - p2[1].x, p2[0].y - p2[1].y);
        this.zoom -= (d1 - d0) * 0.02;
        return;
      }
      if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const t = this._touchLook; if (e.pointerId !== t.id) return;
      this.look.x += (e.clientX - t.x) * 1.6; this.look.y += (e.clientY - t.y) * 1.6;
      t.x = e.clientX; t.y = e.clientY;
    });
    const endLook = (e) => { pinch.delete(e.pointerId); if (e.pointerId === this._touchLook.id) this._touchLook.id = null; };
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);

    for (const b of touchUI.buttons) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); this.usingTouch = true;
        if (act === 'jump') this._jumpQueued = true;
        else if (act === 'run') { this.runToggle = !this.runToggle; b.classList.toggle('on', this.runToggle); }
        else this.actions.add(act);
        navigator.vibrate?.(8);
      });
    }
    this.runButton = touchUI.buttons.find((b) => b.dataset.act === 'run');
  }

  // chamado uma vez por quadro
  poll(dt) {
    const k = this.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    this.timeWarp = k.has('KeyT');
    if (this._touchMove.id !== null) { mx = this._touchMove.x; my = this._touchMove.y; }

    // gamepad (layout padrão)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      if (lx || ly || rx || ry || p.buttons.some((b) => b.pressed)) this.usingPad = true;
      if (lx || ly) { mx = lx; my = -ly; }
      this.look.x += rx * 900 * dt; this.look.y += ry * 700 * dt;
      const pressed = (i) => p.buttons[i]?.pressed;
      const edge = (i) => pressed(i) && !this._padPrev[i];
      if (edge(0)) this._jumpQueued = true;            // A / X
      if (edge(3)) this.actions.add('cam');            // Y / triângulo
      if (edge(2)) this.actions.add('lamp');           // X / quadrado
      if (edge(9)) this.actions.add('pause');          // start
      if (pressed(10) || (p.buttons[7]?.value || 0) > 0.5) run = true; // L3 ou RT
      if (pressed(4)) this.zoom -= dt * 4; if (pressed(5)) this.zoom += dt * 4;
      this.timeWarp = this.timeWarp || pressed(6);
      this._padPrev = p.buttons.map((b) => b.pressed);
      break;
    }
    this.moveX = mx; this.moveY = my;
    // no toque, empurrar o joystick até a borda também faz correr
    const stickFull = this._touchMove.id !== null && Math.hypot(mx, my) > 0.97;
    this.run = run || this.runToggle || stickFull;
    this.jump = this._jumpQueued; this._jumpQueued = false;
  }

  consumeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = 0; this.look.y = 0; return l; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }
  take(action) { const has = this.actions.has(action); this.actions.delete(action); return has; }
}
