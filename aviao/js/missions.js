// Fase 2: missões com argolas, pousos avaliados, pane de motor, estrelas e rádio da torre.
import * as THREE from 'three';

const D2R = Math.PI / 180;

// Posições reais (lat, lon) e altitudes em metros acima do mar.
export const MISSIONS = [
  {
    id: 'primeiro-voo', name: 'Primeiro voo', level: 'Fácil',
    desc: 'Decole do Santos Dumont, passe pelas argolas sobre a baía e contorne o Pão de Açúcar até Copacabana.',
    start: 'sdu20', time: 'manha', par: 250,
    radio: ['Santos Dumont torre, Papa Romeo Juliet Zulu Romeo, pista vinte esquerda, autorizado decolagem. Após decolar, curva à esquerda para a saída da baía.'],
    rings: [[-22.9258, -43.1612, 110], [-22.9345, -43.1480, 190], [-22.9425, -43.1360, 260], [-22.9580, -43.1395, 330], [-22.9660, -43.1560, 380], [-22.9745, -43.1790, 420]],
    finish: 'Você está sobre Copacabana. Bom voo!',
  },
  {
    id: 'orla', name: 'Argolas na orla', level: 'Médio',
    desc: 'Voo baixo sobre o mar, do Leme ao Leblon, passando por dentro das argolas. Cuidado com os prédios da orla. Dica: tire um pouco de velocidade (S) para fazer as curvas mais fechadas.',
    start: 'orla', time: 'tarde', par: 200,
    radio: ['Tráfego Copacabana, Papa Romeo Juliet Zulu Romeo iniciando passagem baixa na orla, sentido Leblon.'],
    rings: [[-22.9682, -43.1690, 175], [-22.9744, -43.1770, 170], [-22.9814, -43.1845, 165], [-22.9955, -43.1960, 170], [-22.9952, -43.2060, 165], [-22.9940, -43.2155, 165], [-22.9928, -43.2240, 170]],
    ringRadius: 70,
    finish: 'Passagem completa na orla de Copacabana, Ipanema e Leblon!',
  },
  {
    id: 'pouso-sdu', name: 'Pouso no Santos Dumont', level: 'Médio',
    desc: 'Final de 3 milhas para a pista 20L. Siga as luzes PAPI (duas brancas, duas vermelhas), toque suave e pare na pista.',
    start: 'final-sdu', time: 'tarde',
    radio: ['Papa Romeo Juliet Zulu Romeo, Santos Dumont torre, vento calmo, pista vinte esquerda, autorizado pouso.'],
    land: { idents: ['20L'] },
    finish: 'Pouso concluído no Santos Dumont.',
  },
  {
    id: 'circuito-gig', name: 'Circuito no Galeão', level: 'Médio',
    desc: 'Decole na pista 10 do Galeão, faça o circuito de tráfego pela esquerda passando pelas argolas e pouse na mesma pista.',
    start: 'gig10', time: 'meio', circuit: '10',
    radio: ['Galeão torre, Papa Romeo Juliet Zulu Romeo, pista um zero, autorizado decolagem. Circuito pela esquerda, reporte na perna do vento.'],
    land: { idents: ['10'] },
    finish: 'Circuito completo no Galeão.',
  },
  {
    id: 'pane', name: 'Pane no motor', level: 'Difícil',
    desc: 'A 2.500 pés sobre a baía o motor para. Plane até o Santos Dumont (ou o Galeão) e pouse. O Cessna plana cerca de 9 metros para cada metro de altura.',
    start: 'pane', time: 'tarde', engineFailAt: 8,
    radio: ['Mayday, mayday, mayday, Papa Romeo Juliet Zulu Romeo, pane de motor, dois mil e quinhentos pés sobre a baía, tentando o Santos Dumont.', 'Papa Romeo Juliet Zulu Romeo, Santos Dumont torre, ciente, pista vinte esquerda livre, pouse a critério.'],
    land: { idents: ['20L', '02R', '02L', '20R', '10', '28', '15', '33'] },
    finish: 'Pouso sem motor! Os passageiros aplaudem.',
  },
  {
    id: 'cristo', name: 'Volta ao Cristo', level: 'Difícil',
    desc: 'Dê uma volta completa em torno do Cristo Redentor passando pelas argolas, e depois volte para o Santos Dumont.',
    start: 'cristo-volta', time: 'por', par: 170, ringsAround: 'cristo', ringRadius: 85,
    radio: ['Tráfego Corcovado, Papa Romeo Juliet Zulu Romeo circulando o Cristo Redentor a três mil pés.'],
    finish: 'Volta completa no Cristo Redentor!',
  },
];

export class MissionRunner {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx;       // ctx: { ll, runways, terrain, meta }
    this.group = new THREE.Group(); scene.add(this.group);
    this.active = null;
  }

  loadBest() { try { return JSON.parse(localStorage.getItem('ceudorio.missions.v1') || '{}'); } catch { return {}; } }
  saveBest(id, stars) {
    const b = this.loadBest();
    if ((b[id] || 0) < stars) { b[id] = stars; try { localStorage.setItem('ceudorio.missions.v1', JSON.stringify(b)); } catch { /* sem armazenamento */ } }
  }

  // monta as argolas (posição mundo + normal) a partir da definição
  _buildRings(def) {
    const { ll, runways, meta } = this.ctx;
    const pts = [];
    if (def.rings) for (const [la, lo, alt] of def.rings) { const p = ll(la, lo); pts.push(new THREE.Vector3(p.x, alt, p.z)); }
    if (def.circuit) {
      // circuito de tráfego pela esquerda, no referencial da pista
      const r = runways.list.find((q) => q.le === def.circuit || q.he === def.circuit);
      const fromLe = r.le === def.circuit;
      const x0 = fromLe ? r.x1 : r.x2, z0 = fromLe ? r.z1 : r.z2, ux = fromLe ? r.ux : -r.ux, uz = fromLe ? r.uz : -r.uz;
      const lx = uz, lz = -ux, L = r.length, h = r.elev;
      const at = (a, c, alt) => new THREE.Vector3(x0 + ux * a + lx * c, h + alt, z0 + uz * a + lz * c);
      pts.push(at(L + 1400, 0, 260), at(L + 1700, 1500, 330), at(L * 0.5, 1700, 340), at(-1700, 1500, 300), at(-2600, 0, 220));
    }
    if (def.ringsAround === 'cristo') {
      const c = meta.landmarks.cristo.world;
      // 6 argolas num círculo de 1 km em volta da estátua (o Cessna precisa de ~400 m de raio de curva)
      const R = 1000, n = 6, alt = c.y + 190;
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - i / n * Math.PI * 2; pts.push(new THREE.Vector3(c.x + Math.cos(a) * R, alt, c.z + Math.sin(a) * R)); }
    }
    return pts;
  }

  start(def, fm) {
    this.stop();
    const pts = this._buildRings(def);
    const R = def.ringRadius || 55;
    const rings = [];
    let prev = fm.pos.clone();
    for (let i = 0; i < pts.length; i++) {
      const next = pts[i + 1];
      // a argola "olha" na direção de voo esperada (média entre chegar e sair)
      const dirIn = pts[i].clone().sub(prev).setY(0).normalize();
      const dirOut = next ? next.clone().sub(pts[i]).setY(0).normalize() : dirIn;
      const n = dirIn.clone().add(dirOut).normalize();
      if (n.lengthSq() < 0.5) n.copy(dirIn);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(R, 2.6, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, fog: true }));
      mesh.position.copy(pts[i]); mesh.lookAt(pts[i].clone().add(n));
      mesh.renderOrder = 4;
      this.group.add(mesh);
      rings.push({ c: pts[i], n, R, mesh, passed: false, missed: false });
      prev = pts[i];
    }
    this.active = {
      def, rings, idx: 0, t: 0, missed: 0, done: false, failed: false, landing: null, touch: null,
      prevPos: fm.pos.clone(), engineFailed: false, result: null,
    };
    this._styleRings();
  }

  stop() {
    this.group.children.slice().forEach((m) => { m.geometry.dispose(); m.material.dispose(); this.group.remove(m); });
    this.active = null;
  }

  _styleRings() {
    const a = this.active; if (!a) return;
    a.rings.forEach((r, i) => {
      r.mesh.visible = !r.passed && !r.missed && i < a.idx + 3;
      const cur = i === a.idx;
      r.mesh.material.color.set(cur ? 0xffb020 : 0xffffff);
      r.mesh.material.opacity = cur ? 0.95 : 0.35;
    });
  }

  // objetivo atual para a seta de navegação
  target() {
    const a = this.active; if (!a || a.done) return null;
    if (a.idx < a.rings.length) return { pos: a.rings[a.idx].c, label: `Argola ${a.idx + 1}/${a.rings.length}` };
    if (a.def.land) {
      const rw = this._landRunway(); if (!rw) return null;
      return { pos: new THREE.Vector3(rw.tx, rw.elev, rw.tz), label: `Pouse na pista ${rw.ident}`, runway: true };
    }
    return null;
  }

  _landRunway() {
    // pista de pouso mais próxima entre as permitidas (cabeceira de aproximação)
    const a = this.active, { runways } = this.ctx;
    let best = null;
    for (const r of runways.list) for (const [ident, tx, tz, ux, uz] of [[r.le, r.x1, r.z1, r.ux, r.uz], [r.he, r.x2, r.z2, -r.ux, -r.uz]]) {
      if (!a.def.land.idents.includes(ident)) continue;
      const d = Math.hypot(tx - this._pos.x, tz - this._pos.z);
      if (!best || d < best.d) best = { ident, tx, tz, ux, uz, L: r.length, W: r.width, elev: r.elev, d };
    }
    return best;
  }

  _onRunway(p) {
    // devolve {ident, along, cross} se o ponto estiver sobre uma pista permitida
    const a = this.active, { runways } = this.ctx;
    for (const r of runways.list) for (const [ident, tx, tz, ux, uz] of [[r.le, r.x1, r.z1, r.ux, r.uz], [r.he, r.x2, r.z2, -r.ux, -r.uz]]) {
      if (!a.def.land.idents.includes(ident)) continue;
      const along = (p.x - tx) * ux + (p.z - tz) * uz, cross = -(p.x - tx) * uz + (p.z - tz) * ux;
      if (along > -10 && along < r.length + 10 && Math.abs(cross) < r.width / 2 + 4) return { ident, along, cross, L: r.length };
    }
    return null;
  }

  /** chamado a cada quadro; devolve eventos para a interface */
  update(dt, fm, flightEvents) {
    const a = this.active; if (!a || a.done) return [];
    const out = [];
    this._pos = fm.pos;
    a.t += dt;
    if (a.def.engineFailAt && !a.engineFailed && a.t > a.def.engineFailAt) {
      a.engineFailed = true; fm.engineOn = false;
      out.push({ type: 'engine' });
    }
    // argolas: cruzou o plano? dentro do raio conta, fora conta como perdida
    if (a.idx < a.rings.length) {
      const r = a.rings[a.idx];
      const d0 = a.prevPos.clone().sub(r.c).dot(r.n), d1 = fm.pos.clone().sub(r.c).dot(r.n);
      if (d0 < 0 && d1 >= 0) {
        const t = d0 / (d0 - d1);
        const hit = a.prevPos.clone().lerp(fm.pos, t);
        const dist = hit.distanceTo(r.c);
        // dentro do raio conta; passou ao lado (até 1,5 km) conta como perdida e segue para a próxima
        if (dist <= r.R) { r.passed = true; out.push({ type: 'ring', i: a.idx, n: a.rings.length }); }
        else if (dist < 1500) { r.missed = true; a.missed++; out.push({ type: 'miss', i: a.idx }); }
        if (r.passed || r.missed) { a.idx++; this._styleRings(); }
      }
      if (a.idx >= a.rings.length && !a.def.land) this._finish(true, out);
    }
    // pouso
    if (a.def.land && a.idx >= a.rings.length) {
      for (const e of flightEvents) if (e.type === 'touchdown') {
        const on = this._onRunway(e.pos);
        if (!on) { this._finish(false, out, 'Tocou fora da pista.'); break; }
        a.touch = { fpm: e.fpm, cross: on.cross, along: on.along, ident: on.ident, speed: e.speed };
      }
      if (a.touch && fm.onGround && fm.vel.length() < 2.5) {
        const on = this._onRunway(fm.pos);
        if (on) this._finish(true, out); else this._finish(false, out, 'O avião saiu da pista antes de parar.');
      }
    }
    for (const e of flightEvents) if (e.type === 'crash') this._finish(false, out, e.reason);
    a.prevPos.copy(fm.pos);
    return out;
  }

  _finish(ok, out, reason) {
    const a = this.active; if (a.done) return;
    a.done = true;
    let stars = 0; const lines = [];
    if (ok) {
      stars = 3;
      if (a.rings.length) {
        const passed = a.rings.filter((r) => r.passed).length;
        lines.push(`Argolas: ${passed} de ${a.rings.length}`);
        if (a.missed > 0) stars = Math.min(stars, a.missed <= 1 ? 2 : 1);
      }
      if (a.def.par) {
        lines.push(`Tempo: ${fmtTime(a.t)} (meta ${fmtTime(a.def.par)})`);
        if (a.t > a.def.par * 1.4) stars = Math.min(stars, 1); else if (a.t > a.def.par) stars = Math.min(stars, 2);
      }
      if (a.touch) {
        const f = Math.round(a.touch.fpm), c = Math.abs(a.touch.cross);
        lines.push(`Toque: ${f} pés/min, ${c.toFixed(1)} m do eixo, ${Math.round(a.touch.along)} m após a cabeceira ${a.touch.ident}`);
        const s = f > -300 && c < 4 ? 3 : f > -500 && c < 9 ? 2 : 1;
        stars = Math.min(stars, s);
      }
      stars = Math.max(1, stars);
    } else lines.push(reason || 'Missão não concluída.');
    a.result = { ok, stars, lines, time: a.t };
    if (ok) this.saveBest(a.def.id, stars);
    out.push({ type: ok ? 'complete' : 'fail', result: a.result });
  }
}

export function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; }

// rádio: voz da torre (síntese do navegador) + legenda
export class Radio {
  constructor(settings) { this.settings = settings; this.voice = null; }
  _pick() {
    if (this.voice || !window.speechSynthesis) return this.voice;
    const vs = speechSynthesis.getVoices();
    this.voice = vs.find((v) => /pt[-_]BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null;
    return this.voice;
  }
  say(text) {
    if (this.settings.voice === false || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.08; u.pitch = 0.95;
      const v = this._pick(); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* sem voz */ }
  }
  stop() { try { window.speechSynthesis?.cancel(); } catch { /* */ } }
}
