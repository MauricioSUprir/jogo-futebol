// HUD estilo transmissão: placar com relógio e acréscimos, faixas de eventos,
// animação de gol, cartões, nome e fôlego do jogador controlado, barra de força,
// radar, vento, dicas de bola parada, selo de replay e placar dos pênaltis.
import * as THREE from 'three';
import { PITCH, GOAL, clamp } from './config.js';
import { crestSVG } from './teams.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const _v = new THREE.Vector3();

export class Hud {
  constructor(root) {
    this.root = root;
  }

  init(m, cfg, { touch }) {
    const r = this.root;
    r.innerHTML = '';
    r.classList.remove('hidden');
    this.m = m;
    const [h, a] = m.teams;
    const kitBar = (k) => `background:${k.shirt || '#fff'};box-shadow: inset -4px 0 0 ${k.second || k.shorts || '#000'}`;
    this.board = el('div', 'hud-board');
    this.board.innerHTML = `
      <div class="hb-team"><span class="hb-kit" style="${kitBar(cfg.homeKit)}"></span><span class="hb-crest">${crestSVG(h.data, 26)}</span><b>${h.data.short}</b></div>
      <div class="hb-score"><span id="hb-h">0</span><i>-</i><span id="hb-a">0</span></div>
      <div class="hb-team away"><b>${a.data.short}</b><span class="hb-crest">${crestSVG(a.data, 26)}</span><span class="hb-kit" style="${kitBar(cfg.awayKit)}"></span></div>
      <div class="hb-clock"><span id="hb-t">00:00</span><em id="hb-add"></em></div>`;
    r.appendChild(this.board);
    this.sH = this.board.querySelector('#hb-h'); this.sA = this.board.querySelector('#hb-a');
    this.clock = this.board.querySelector('#hb-t'); this.add = this.board.querySelector('#hb-add');

    this.bannerEl = el('div', 'hud-banner'); r.appendChild(this.bannerEl);
    this.goalEl = el('div', 'hud-goal'); r.appendChild(this.goalEl);
    this.cardEl = el('div', 'hud-card'); r.appendChild(this.cardEl);
    this.tag = el('div', 'hud-tag'); this.tag.innerHTML = '<b></b><i><s></s></i>'; r.appendChild(this.tag);
    this.tagName = this.tag.querySelector('b'); this.tagSta = this.tag.querySelector('s');
    this.power = el('div', 'hud-power'); this.power.innerHTML = '<i><b></b></i>'; r.appendChild(this.power);
    this.powerFill = this.power.querySelector('b');
    this.hint = el('div', 'hud-hint'); r.appendChild(this.hint);
    this.replayEl = el('div', 'hud-replay', '<span>REPLAY</span><small>toque ou aperte qualquer botão para pular</small>'); r.appendChild(this.replayEl);
    this.shoot = el('div', 'hud-shootout'); r.appendChild(this.shoot);
    this.wind = el('div', 'hud-wind'); r.appendChild(this.wind);
    const w = m.wind, ws = Math.hypot(w.x, w.z);
    if (ws > 0.5) {
      this.wind.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3 L18 15 L12 12 L6 15 Z" fill="currentColor"/></svg><span>${(ws * 3.6).toFixed(0)} km/h</span>`;
      this.windArrow = this.wind.querySelector('svg');
    } else this.wind.classList.add('hidden');
    this.radar = el('canvas', 'hud-radar');
    this.radar.width = 210; this.radar.height = 136;
    r.appendChild(this.radar);
    this.rctx = this.radar.getContext('2d');
    this.touch = touch;
    this.lastScore = '';
    this.bannerT = 0; this.goalT = 0; this.cardT = 0;
    this.colors = [cfg.homeKit.shirt || '#fff', cfg.awayKit.shirt || '#000'];
    this.colors2 = [cfg.homeKit.number || '#000', cfg.awayKit.number || '#fff'];
  }

  banner(text, sub, kind = 'info') {
    this.bannerEl.className = 'hud-banner show ' + kind;
    this.bannerEl.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.bannerT = kind === 'period' ? 3.2 : 2.2;
  }

  goal(teamName, name, minute, own) {
    this.goalEl.className = 'hud-goal show';
    this.goalEl.innerHTML = `<div class="g-word">${'GOL'.split('').map((c, i) => `<span style="animation-delay:${i * 0.06}s">${c}</span>`).join('')}<span class="g-ex">!</span></div>
      <div class="g-who"><b>${name}</b><span>${minute}'${own ? ' · contra' : ''} · ${teamName}</span></div>`;
    this.goalT = 4.2;
  }

  card(color, name) {
    this.cardEl.className = 'hud-card show ' + color;
    this.cardEl.innerHTML = `<i></i><span>${name}</span>`;
    this.cardT = 2.8;
  }

  setReplay(on) {
    this.replayEl.classList.toggle('show', on); this.root.classList.toggle('replaying', on);
    if (on) { this.goalEl.classList.remove('show'); this.bannerEl.classList.remove('show'); this.goalT = this.bannerT = 0; }
  }

  shootout(so, teams) {
    if (!so) { this.shoot.classList.remove('show'); return; }
    const row = (i) => {
      const k = so.kicks[i];
      const n = Math.max(5, k.length);
      let s = '';
      for (let j = 0; j < n; j++) s += `<i class="${j < k.length ? (k[j] ? 'ok' : 'x') : ''}"></i>`;
      return `<div><b>${teams[i].data.short}</b>${s}</div>`;
    };
    this.shoot.innerHTML = row(0) + row(1);
    this.shoot.classList.add('show');
  }

  update(dt, m, camera, view) {
    // placar e relógio
    const sc = `${m.teams[0].score}-${m.teams[1].score}`;
    if (sc !== this.lastScore) {
      this.sH.textContent = m.teams[0].score; this.sA.textContent = m.teams[1].score;
      if (this.lastScore) this.board.classList.remove('bump'), void this.board.offsetWidth, this.board.classList.add('bump');
      this.lastScore = sc;
    }
    const base = m.half === 1 ? 0 : m.half === 2 ? 45 : m.half === 3 ? 90 : 105;
    const endMin = [0, 45, 90, 105, 120][m.half];
    const secs = Math.max(0, m.clock);
    let mm = Math.floor(secs / 60), ss = Math.floor(secs % 60);
    if (m.shootout) { this.clock.textContent = 'PÊN'; this.add.textContent = ''; }
    else {
      this.clock.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      this.add.textContent = m.stoppage && mm >= endMin - 1 ? `+${m.stoppage}` : '';
    }
    void base;

    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerEl.classList.remove('show'); }
    if (this.goalT > 0) { this.goalT -= dt; if (this.goalT <= 0) this.goalEl.classList.remove('show'); }
    if (this.cardT > 0) { this.cardT -= dt; if (this.cardT <= 0) this.cardEl.classList.remove('show'); }

    // nome do jogador controlado
    const p = m.controlled;
    const W = this.root.clientWidth, H = this.root.clientHeight;
    const showTag = p && !view.replay && m.phase !== 'goal' && view.names;
    if (showTag) {
      _v.set(p.x, 2.35 + p.y, p.z).project(camera);
      const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
      this.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (this.tagPlayer !== p) { this.tagPlayer = p; this.tagName.textContent = `${p.data.num} ${p.data.name}`; }
      this.tagSta.style.width = (p.stamina * 100).toFixed(0) + '%';
      this.tag.classList.add('show');
      // barra de força
      const ch = view.charging;
      if (ch && ['pass', 'shoot', 'long', 'through', 'finesse', 'chip'].includes(ch.key) && ch.t > 0.08) {
        _v.set(p.x, -0.1, p.z).project(camera);
        const px = (_v.x * 0.5 + 0.5) * W, py = (-_v.y * 0.5 + 0.5) * H;
        const f = clamp(0.12 + ch.t / 0.95, 0, 1.1);
        this.power.style.transform = `translate(${px.toFixed(1)}px, ${(py + 14).toFixed(1)}px)`;
        this.powerFill.style.width = Math.min(100, f * 100).toFixed(0) + '%';
        this.power.classList.toggle('over', f > 0.95);
        this.power.classList.add('show');
      } else this.power.classList.remove('show');
    } else { this.tag.classList.remove('show'); this.power.classList.remove('show'); }

    // vento relativo à câmera
    if (this.windArrow) {
      const w = m.wind;
      const sx = w.x * view.right.x + w.z * view.right.z, sy = w.x * view.fwd.x + w.z * view.fwd.z;
      this.windArrow.style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
    }

    this.hint.textContent = view.hint || '';
    this.hint.classList.toggle('show', !!view.hint);
    if (view.radar && !view.replay) this.drawRadar(m, view);
    this.radar.classList.toggle('hidden', !view.radar || view.replay);
  }

  drawRadar(m, view) {
    const c = this.rctx, W = this.radar.width, H = this.radar.height;
    c.clearRect(0, 0, W, H);
    const pad = 6;
    const sx = (W - pad * 2) / PITCH.length, sz = (H - pad * 2) / PITCH.width;
    // orientação: igual à câmera de TV (x → direita invertida se a câmera olha +z)
    const flip = view.right.x < 0 ? -1 : 1;
    const X = (x) => W / 2 + x * sx * flip;
    const Z = (z) => H / 2 - z * sz * (view.fwd.z > 0 ? 1 : -1);
    c.fillStyle = 'rgba(10,20,14,0.55)';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
    c.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    c.beginPath(); c.moveTo(W / 2, pad); c.lineTo(W / 2, H - pad); c.stroke();
    c.beginPath(); c.arc(W / 2, H / 2, PITCH.centerRadius * sx, 0, Math.PI * 2); c.stroke();
    for (const s of [-1, 1]) {
      const x0 = X(s * PITCH.halfL), x1 = X(s * (PITCH.halfL - PITCH.boxDepth));
      c.strokeRect(Math.min(x0, x1), Z(PITCH.boxHalfW), Math.abs(x1 - x0), Z(-PITCH.boxHalfW) - Z(PITCH.boxHalfW));
    }
    for (const p of m.players) {
      if (p.sentOff) continue;
      const i = p.team.i;
      c.fillStyle = this.colors[i];
      c.strokeStyle = this.colors2[i];
      c.beginPath(); c.arc(X(p.x), Z(p.z), p === m.controlled ? 4.2 : 3, 0, Math.PI * 2); c.fill(); c.stroke();
      if (p === m.controlled) { c.strokeStyle = '#c8ff2e'; c.lineWidth = 2; c.beginPath(); c.arc(X(p.x), Z(p.z), 6.5, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; }
    }
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(X(m.ball.p.x), Z(m.ball.p.z), 2.6, 0, Math.PI * 2); c.fill();
  }

  hide() { this.root.classList.add('hidden'); }
}
