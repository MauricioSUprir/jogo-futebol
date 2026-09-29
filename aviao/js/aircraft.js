// Modelo 3D procedural do Cessna 172 (eixos locais: +x asa direita, +y cima, -z nariz; origem no CG).
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

const D2R = Math.PI / 180;

// seções da fuselagem: [z, meia-largura, y do topo, y da base]
const FUS = [
  [-2.32, 0.04, 0.00, -0.08], [-2.14, 0.22, 0.16, -0.26], [-2.02, 0.40, 0.32, -0.40], [-1.40, 0.51, 0.42, -0.52],
  [-0.80, 0.55, 0.46, -0.58], [-0.20, 0.57, 0.75, -0.60], [0.40, 0.58, 0.79, -0.58], [1.10, 0.55, 0.77, -0.52],
  [1.80, 0.42, 0.63, -0.38], [2.80, 0.27, 0.50, -0.18], [3.90, 0.14, 0.42, 0.02], [4.75, 0.07, 0.38, 0.14], [4.95, 0.03, 0.36, 0.22],
];
const RING = 36;

function fusPoint(st, th, grow = 0) {
  const [z, hw, top, bot] = st;
  const cy = (top + bot) / 2, hh = (top - bot) / 2;
  const c = Math.cos(th), s = Math.sin(th), e = 2 / 2.7;
  const x = Math.sign(c) * Math.pow(Math.abs(c), e) * (hw + grow);
  const y = cy + Math.sign(s) * Math.pow(Math.abs(s), e) * (hh + grow);
  return new THREE.Vector3(x, y, z);
}
// janelas: para-brisa e laterais (ângulo 0 = direita, 90° = topo)
function isGlass(z, thDeg) {
  const t = ((thDeg % 360) + 360) % 360;
  if (z > -0.78 && z < -0.22) return t > 18 && t < 162;
  if (z > -0.2 && z < 1.3) return (t > 14 && t < 62) || (t > 118 && t < 166);
  return false;
}

function loftFuselage(glassPart, grow) {
  const pos = [], idx = [], col = [];
  // refina as seções para a janela ficar recortada com precisão
  const st = [];
  for (let i = 0; i < FUS.length - 1; i++) {
    const a = FUS[i], b = FUS[i + 1], n = Math.max(1, Math.round((b[0] - a[0]) / 0.18));
    for (let k = 0; k < n; k++) { const t = k / n; st.push(a.map((v, j) => v + (b[j] - v) * t)); }
  }
  st.push(FUS[FUS.length - 1]);
  for (const s of st) for (let r = 0; r <= RING; r++) {
    const th = r / RING * Math.PI * 2;
    const p = fusPoint(s, th, grow);
    pos.push(p.x, p.y, p.z);
    // faixa de pintura ao longo da fuselagem
    const rel = (p.y - (s[2] + s[3]) / 2) / ((s[2] - s[3]) / 2 + 1e-3);
    const stripe = !glassPart && rel > -0.28 && rel < -0.08 && s[0] > -1.9 ? 1 : 0;
    col.push(stripe, 0, 0);
  }
  const W = RING + 1;
  for (let i = 0; i < st.length - 1; i++) for (let r = 0; r < RING; r++) {
    const zm = (st[i][0] + st[i + 1][0]) / 2, thm = (r + 0.5) / RING * 360;
    if (isGlass(zm, thm) !== glassPart) continue;
    const a = i * W + r, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('stripe', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// perfil NACA 2412 (x ao longo da corda 0..1, y espessura), sentido: bordo de fuga -> extradorso -> bordo de ataque -> intradorso
function naca2412(n = 14) {
  const m = 0.02, p = 0.4, t = 0.12, pts = [];
  const f = (x) => {
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    const yc = x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x);
    return [yc + yt, yc - yt];
  };
  for (let i = n; i >= 0; i--) { const x = (1 - Math.cos(i / n * Math.PI)) / 2; pts.push([x, f(x)[0]]); }
  for (let i = 1; i < n; i++) { const x = (1 - Math.cos(i / n * Math.PI)) / 2; pts.push([x, f(x)[1]]); }
  return pts;
}
const AIRFOIL = naca2412();

// painel de superfície aerodinâmica entre seções [{x, le(z do bordo de ataque), chord, y}], cortando a corda entre c0..c1
function panel(sections, c0 = 0, c1 = 1, axis = 'x') {
  const pos = [], idx = [];
  const prof = AIRFOIL.filter(([u]) => true).map(([u, v]) => [c0 + u * (c1 - c0), v]);
  for (const s of sections) for (const [u, v] of prof) {
    const along = s.le + u * s.chord, thick = v * s.chord * (s.tscale || 1);
    if (axis === 'x') pos.push(s.x, s.y + thick, along); else pos.push(thick + (s.x || 0), s.y, along);
  }
  const n = prof.length;
  for (let i = 0; i < sections.length - 1; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + (k + 1) % n, c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  // tampas das pontas
  for (const si of [0, sections.length - 1]) for (let k = 1; k < n - 1; k++) {
    const o = si * n; if (si === 0) idx.push(o, o + k + 1, o + k); else idx.push(o, o + k, o + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function textTex(txt, w = 512, h = 128, color = '#1d2a44') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
  x.fillStyle = color; x.font = `bold ${h * 0.72}px "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(txt, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function buildAircraft(accent = '#1f4fa8', registration = 'PR-JZR') {
  const root = new THREE.Group();
  const paint = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0xf4f4f1, roughness: 0.32, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2 }), (sh) => {
    sh.uniforms.uAccent = { value: new THREE.Color(accent) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 stripe; varying float vStripe;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripe = stripe.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStripe; uniform vec3 uAccent;')
      .replace('#include <map_fragment>', 'diffuseColor.rgb = mix( diffuseColor.rgb, uAccent, step( 0.5, vStripe ) );');
  }, 'paint');
  const white = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.25 }), null, 'white');
  const accentM = registerMaterial(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(accent), roughness: 0.35, clearcoat: 0.5 }), null, 'accent');
  const glass = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0x0c1418, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }), null, 'glass', { shadows: true });
  const interior = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x4b4744, roughness: 0.9, side: THREE.BackSide }), null, 'interior');
  const dark = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x222325, roughness: 0.7 }), null, 'dark');
  const metal = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xa7abb2, roughness: 0.3, metalness: 0.9 }), null, 'metal');
  const tire = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }), null, 'tire');

  // fuselagem externa, interior escuro (visto da cabine) e vidros
  const fusG = loftFuselage(false, 0);
  const fus = new THREE.Mesh(fusG, paint); root.add(fus);
  const fusIn = new THREE.Mesh(fusG, interior); fusIn.castShadow = false; root.add(fusIn);
  const gl = new THREE.Mesh(loftFuselage(true, 0.004), glass); gl.castShadow = false; gl.renderOrder = 2; root.add(gl);
  // capô e tomadas de ar
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), dark); intake.position.set(0, -0.32, -2.0); root.add(intake);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 8), metal); exhaust.rotation.x = Math.PI / 2; exhaust.position.set(0.22, -0.5, -1.55); root.add(exhaust);

  // ---- asa alta: painel interno retangular e externo afilado, diedro de 1,73°
  const wingY = 0.8, dih = Math.tan(1.73 * D2R);
  const ctl = {};
  const wing = new THREE.Group(); root.add(wing);
  for (const side of [-1, 1]) {
    const secs = [
      { x: side * 0.55, le: -0.62, chord: 1.63, y: wingY + 0.55 * dih },
      { x: side * 2.62, le: -0.62, chord: 1.63, y: wingY + 2.62 * dih },
      { x: side * 5.42, le: -0.47, chord: 1.13, y: wingY + 5.42 * dih, tscale: 0.85 },
    ];
    const main = panel(side > 0 ? secs : secs.slice(), 0, 0.74);
    const wm = new THREE.Mesh(main, white); wing.add(wm);
    if (side < 0) main.index.array.reverse();
    // flape (interno) e aileron (externo), articulados no bordo de fuga
    const mk = (s0, s1, name) => {
      const hingeZ = s0.le + s0.chord * 0.74, hy = s0.y;
      const pivot = new THREE.Group(); pivot.position.set(0, hy, hingeZ);
      const geo = panel([s0, s1].map((s) => ({ ...s, le: s.le - hingeZ, y: s.y - hy })), 0.74, 1.0);
      if (side < 0) geo.index.array.reverse();
      pivot.add(new THREE.Mesh(geo, white));
      wing.add(pivot); ctl[name + (side < 0 ? 'L' : 'R')] = pivot;
    };
    const lerpS = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, le: a.le + (b.le - a.le) * t, chord: a.chord + (b.chord - a.chord) * t, y: a.y + (b.y - a.y) * t });
    mk(lerpS(secs[0], secs[1], 0.02), lerpS(secs[1], secs[2], 0.12), 'flap');
    mk(lerpS(secs[1], secs[2], 0.16), lerpS(secs[1], secs[2], 0.97), 'ail');
    // ponta da asa com a cor e a luz de navegação
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), side < 0 ? new THREE.MeshBasicMaterial({ color: 0xff2020 }) : new THREE.MeshBasicMaterial({ color: 0x20ff40 }));
    tip.position.set(side * 5.46, secs[2].y + 0.02, -0.4); wing.add(tip);
    // montante da asa
    const a = new THREE.Vector3(side * 0.55, -0.34, -0.05), b = new THREE.Vector3(side * 2.65, wingY + 2.6 * dih - 0.05, -0.12);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, a.distanceTo(b), 8), white);
    strut.position.copy(a).add(b).multiplyScalar(0.5); strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); strut.scale.set(1.6, 1, 0.6);
    root.add(strut);
  }

  // ---- empenagem horizontal (estabilizador + profundor)
  for (const side of [-1, 1]) {
    const s0 = { x: side * 0.1, le: 3.95, chord: 1.2, y: 0.36 }, s1 = { x: side * 1.72, le: 4.25, chord: 0.8, y: 0.36 };
    const g = panel([s0, s1], 0, 0.6); if (side < 0) g.index.array.reverse();
    root.add(new THREE.Mesh(g, white));
    const hz = s0.le + s0.chord * 0.6;
    if (!ctl.elev) { ctl.elev = new THREE.Group(); ctl.elev.position.set(0, 0.36, hz); root.add(ctl.elev); }
    const eg = panel([s0, s1].map((s) => ({ ...s, le: s.le - hz, y: 0 })), 0.6, 1.0); if (side < 0) eg.index.array.reverse();
    ctl.elev.add(new THREE.Mesh(eg, white));
  }
  // ---- deriva e leme (perfil vertical)
  {
    const secs = [{ x: 0, le: 3.55, chord: 1.65, y: 0.38 }, { x: 0, le: 4.45, chord: 0.8, y: 1.78 }];
    const g = panel(secs, 0, 0.62, 'y'); root.add(new THREE.Mesh(g, white));
    const hz0 = secs[0].le + secs[0].chord * 0.62, hz1 = secs[1].le + secs[1].chord * 0.62;
    const pivot = new THREE.Group(); pivot.position.set(0, 0.38, hz0);
    const axis = new THREE.Vector3(0, 1.4, hz1 - hz0).normalize();
    pivot.userData.axis = axis;
    const rg = panel(secs.map((s) => ({ ...s, le: s.le - hz0, y: s.y - 0.38 })), 0.62, 1.0, 'y');
    const rm = new THREE.Mesh(rg, white); pivot.add(rm);
    const band = new THREE.Mesh(panel([{ x: 0, le: 4.2 - hz0, chord: 1.0, y: 1.25 }, { x: 0, le: 4.45 - hz0, chord: 0.8, y: 1.4 }], 0.62, 1.0, 'y'), accentM);
    band.scale.set(1.08, 1, 1); pivot.add(band);
    ctl.rudder = pivot; root.add(pivot);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff1a1a })); beacon.position.set(0, 1.82, 4.6); root.add(beacon); ctl.beacon = beacon;
  }
  // matrícula nas laterais do cone de cauda
  const regTex = textTex(registration);
  for (const side of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.3), new THREE.MeshStandardMaterial({ map: regTex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    pl.position.set(side * 0.35, 0.18, 2.55); pl.rotation.y = side * Math.PI / 2; pl.rotation.x = 0;
    if (side < 0) pl.scale.x = 1;
    root.add(pl);
  }

  // ---- trem de pouso fixo (rodas no contato em y = -1,33)
  const wheel = (x, z, r = 0.2, pants = true) => {
    const g = new THREE.Group(); g.position.set(x, -1.33 + r, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.13, 18).rotateZ(Math.PI / 2), tire); g.add(t);
    if (pants) { const p = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), white); p.scale.set(0.12, 0.2, 0.46); p.position.y = 0.02; g.add(p); }
    root.add(g); return g;
  };
  for (const side of [-1, 1]) {
    wheel(side * 1.25, 0.32);
    const a = new THREE.Vector3(side * 0.42, -0.55, 0.3), b = new THREE.Vector3(side * 1.23, -1.1, 0.32);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, a.distanceTo(b), 0.05), metal);
    leg.position.copy(a).add(b).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); root.add(leg);
  }
  const noseW = wheel(0, -1.55, 0.18, true);
  const ns = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), metal); ns.position.set(0, -0.8, -1.58); root.add(ns);
  ctl.noseWheel = noseW;

  // ---- hélice: pás visíveis parada; disco translúcido girando
  const prop = new THREE.Group(); prop.position.set(0, -0.05, -2.2); root.add(prop);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 20).rotateX(-Math.PI / 2), white); spinner.position.z = -0.1; prop.add(spinner);
  const blades = new THREE.Group(); prop.add(blades);
  for (const s of [-1, 1]) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.9, 0.025), dark); bl.position.y = s * 0.5; bl.rotation.y = s * 0.25; blades.add(bl);
    const tipP = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.026), new THREE.MeshStandardMaterial({ color: 0xf2c200 })); tipP.position.y = s * 0.92; tipP.rotation.y = s * 0.25; blades.add(tipP);
  }
  const discTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, 'rgba(30,30,30,0.0)'); g.addColorStop(0.5, 'rgba(40,40,40,0.18)'); g.addColorStop(0.93, 'rgba(60,60,60,0.22)'); g.addColorStop(0.96, 'rgba(240,200,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  })();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.97, 40), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  disc.castShadow = false; prop.add(disc);

  // ---- cabine: painel, glareshield, manche e pilares
  const cockpit = new THREE.Group(); root.add(cockpit);
  const panelCanvas = document.createElement('canvas'); panelCanvas.width = 1024; panelCanvas.height = 400;
  const panelTex = new THREE.CanvasTexture(panelCanvas); panelTex.colorSpace = THREE.SRGBColorSpace; panelTex.anisotropy = 8;
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.414), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.7, emissive: 0xffffff, emissiveMap: panelTex, emissiveIntensity: 0.0 }));
  panelMesh.position.set(0, 0.18, -0.78); panelMesh.rotation.x = -0.12; cockpit.add(panelMesh);
  const glare = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.3), dark); glare.position.set(0, 0.41, -0.84); cockpit.add(glare);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.2), dark); lower.position.set(0, -0.2, -0.86); cockpit.add(lower);
  const yoke = new THREE.Group(); yoke.position.set(-0.3, 0.06, -0.62); cockpit.add(yoke);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8).rotateX(Math.PI / 2), metal); shaft.position.z = -0.1; yoke.add(shaft);
  const wheelY = new THREE.Group(); yoke.add(wheelY);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), dark); wheelY.add(hub);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), dark); h.position.set(s * 0.1, 0, 0); wheelY.add(h); const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.035), dark); g2.position.set(s * 0.17, 0.02, 0); wheelY.add(g2); }
  ctl.yoke = yoke; ctl.yokeWheel = wheelY;
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * 0.53, 0.44, -0.78), b = new THREE.Vector3(side * 0.56, 0.76, -0.22);
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.035, a.distanceTo(b), 0.035), dark);
    pil.position.copy(a).add(b).multiplyScalar(0.5); pil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); cockpit.add(pil);
  }
  const compassPost = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.03), dark); compassPost.position.set(0, 0.62, -0.5); cockpit.add(compassPost);
  cockpit.visible = true;

  // luzes: estrobos nas pontas (piscam), farol de pouso na asa esquerda
  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const strobes = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), strobeMat); m.position.set(s * 5.47, wingY + 5.42 * dih + 0.02, -0.25); root.add(m); return m; });
  const landing = new THREE.SpotLight(0xfff4e6, 0, 900, 0.22, 0.4, 1.4);
  landing.position.set(-2.3, wingY - 0.02, -0.7); landing.target.position.set(-2.3, -8, -60);
  root.add(landing, landing.target);

  root.traverse((o) => { if (o.isMesh && o !== gl && o !== disc && o !== fusIn) { o.castShadow = true; o.receiveShadow = true; } });

  const api = {
    root, ctl, blades, disc, panelCanvas, panelTex, panelMesh, cockpit, strobes, landing,
    update(fm, dt, t, lightsOn) {
      const c = fm.ctl;
      const ail = c.aileron * 20 * D2R, el = -(c.elevator * 25 * D2R) - c.trim * 0.12, rud = c.rudder * 16 * D2R;
      ctl.ailL.rotation.x = ail; ctl.ailR.rotation.x = -ail;
      ctl.flapL.rotation.x = -fm.flapDeg * D2R; ctl.flapR.rotation.x = -fm.flapDeg * D2R;
      ctl.elev.rotation.x = -el;
      ctl.rudder.quaternion.setFromAxisAngle(ctl.rudder.userData.axis, -rud);
      ctl.noseWheel.rotation.y = -c.rudder * 10 * D2R;
      ctl.yoke.position.z = -0.62 + c.elevator * 0.07; ctl.yokeWheel.rotation.z = -c.aileron * 0.8;
      const spin = fm.rpm / 60 * Math.PI * 2;
      blades.rotation.z += spin * dt;
      const fast = fm.rpm > 420;
      blades.visible = !fast || (Math.floor(t * 30) % 2 === 0 && fm.rpm < 900);
      disc.visible = fm.rpm > 250;
      disc.material.opacity = THREE.MathUtils.clamp((fm.rpm - 250) / 900, 0, 1);
      // estrobos: dois flashes a cada 1,2 s; farol anticolisão pisca
      const ph = t % 1.2;
      const on = lightsOn && (ph < 0.05 || (ph > 0.12 && ph < 0.17));
      strobes.forEach((s) => { s.visible = on; });
      ctl.beacon.material.color.setRGB(ph % 0.6 < 0.1 ? 1 : 0.25, 0.05, 0.05);
      landing.intensity = lightsOn ? 400 : 0;
    },
  };
  return api;
}
