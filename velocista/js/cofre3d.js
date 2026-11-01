// A SALA SECRETA do Wells (edição pessoal; dono, 31/10: "na parte do dr wells, tem que ter uma sala secreta, que só descobrem
// depois, onde ele entra, fala com a Gideon e tal"): o desenho (a planta e a colisão estão em lab.js COFRE). Uma sala de
// paredes facetadas em claro e grafite com frestas de luz, o teto baixo com um anel aceso, o pedestal com o jornal do futuro
// em holograma, o traje amarelo numa vitrine e a GIDEON — um rosto holográfico grande, azul, que acende quando fala. A porta é
// um painel da parede do saguão que desliza para dentro dela. Tudo desenho próprio, em geometria simples e texturas de canvas.
import * as THREE from 'three';
import { COFRE, PISO, PORTA_Y } from './lab.js';
import { criarHeroi } from './humano.js';

/** as paredes da sala: facetas triangulares claras e escuras, com frestas de luz entre elas */
function texFacetas() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1d24'; x.fillRect(0, 0, 512, 512);
  const n = 4, L = 512 / n;
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = i * L, y0 = j * L, cima = (i + j) % 2;
    for (const t of [0, 1]) {
      const g = 150 + rnd() * 80, k = (t ^ cima) ? 0.62 : 1;
      x.fillStyle = `rgb(${g * k},${g * k * 1.01},${g * k * 1.06})`; x.beginPath();
      if (t === 0) { x.moveTo(x0, y0); x.lineTo(x0 + L, y0); x.lineTo(cima ? x0 : x0 + L, y0 + L); } else { x.moveTo(x0, y0 + L); x.lineTo(x0 + L, y0 + L); x.lineTo(cima ? x0 + L : x0, y0); }
      x.closePath(); x.fill();
    }
  }
  x.strokeStyle = '#0b0d12'; x.lineWidth = 6;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * L, 0); x.lineTo(i * L, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * L); x.lineTo(512, i * L); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
/** as frestas de luz (emissivas) do mesmo desenho */
function texFrestas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#9fe3ff'; x.lineWidth = 2.2;
  const L = 64;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * L, 0); x.lineTo(i * L, 256); x.stroke(); }
  x.lineWidth = 1.2; x.strokeStyle = 'rgba(159,227,255,.55)';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); if ((i + j) % 2) { x.moveTo(i * L, j * L); x.lineTo(i * L + L, j * L + L); } else { x.moveTo(i * L + L, j * L); x.lineTo(i * L, j * L + L); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** o jornal do futuro (o mesmo texto do jornal da tela, #jornal) */
function texJornal() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 680;
  const x = c.getContext('2d');
  x.fillStyle = '#e9f6ff'; x.fillRect(0, 0, 512, 680);
  x.fillStyle = '#0d2236'; x.textAlign = 'center';
  x.font = '700 38px Georgia, serif'; x.fillText('CENTRAL CITY CITIZEN', 256, 66);
  x.fillRect(30, 84, 452, 3); x.font = '600 18px Georgia, serif'; x.fillText('Quinta-feira, 25 de abril de 2024', 256, 112); x.fillRect(30, 126, 452, 2);
  x.font = '900 54px Georgia, serif'; x.fillText('O FLASH', 256, 196); x.fillText('DESAPARECE', 256, 254); x.fillText('NA CRISE', 256, 312);
  x.font = 'italic 600 22px Georgia, serif'; x.fillText('por Iris West-Allen', 256, 352);
  x.fillStyle = 'rgba(13,34,54,.75)';
  for (let k = 0; k < 13; k++) { const y = 392 + k * 20; x.fillRect(36, y, 210, 7); x.fillRect(266, y, 210 - (k % 4) * 18, 7); }
  x.strokeStyle = '#0d2236'; x.lineWidth = 3; x.strokeRect(266, 392, 210, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function criarCofre(cena, { cx, cz, mobile = false, aniso = 2 } = {}) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); cena.add(g); g.visible = false;
  const geos = [], mats = [];
  const mesh = (geo, mat) => { geos.push(geo); if (!mats.includes(mat)) mats.push(mat); const o = new THREE.Mesh(geo, mat); g.add(o); return o; };
  const C = COFRE, H = C.teto, u0 = C.u0 + 0.02, u1 = C.u1 - 0.02, v0 = C.v0 + 0.02, v1 = C.v1 - 0.02;
  const facetas = texFacetas(), frestas = texFrestas();
  const mParede = new THREE.MeshStandardMaterial({ color: 0xffffff, map: facetas, emissive: 0x7fd8ff, emissiveMap: frestas, emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
  // uma parede: um retângulo na vertical, de (a,y0) a (b,y1) ao longo de u ('u') ou de v ('v'), na posição c do outro eixo
  const parede = (eixo, a, b, c, y0, y1) => {
    const w = b - a, h = y1 - y0, geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2.2, uv.getY(i) * h / 2.2);
    const o = mesh(geo, mParede); o.position.set(eixo === 'u' ? (a + b) / 2 : c, (y0 + y1) / 2, eixo === 'u' ? c : (a + b) / 2);
    if (eixo === 'v') o.rotation.y = Math.PI / 2;
    return o;
  };
  const [p0, p1] = C.porta;
  parede('v', v0, p0, u0, PISO, H); parede('v', p1, v1, u0, PISO, H); parede('v', p0, p1, u0, PORTA_Y, H);   // a da porta
  parede('v', v0, v1, u1, PISO, H); parede('u', u0, u1, v0, PISO, H); parede('u', u0, u1, v1, PISO, H);
  // piso escuro e brilhante, teto grafite com o anel de luz
  const mPiso = new THREE.MeshStandardMaterial({ color: 0x0c0f15, roughness: 0.18, metalness: 0.6 });
  const piso = mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0).rotateX(-Math.PI / 2), mPiso); piso.position.set((u0 + u1) / 2, PISO + 0.012, (v0 + v1) / 2);
  const teto = mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.7 })); teto.position.set((u0 + u1) / 2, H, (v0 + v1) / 2);
  const mLuz = new THREE.MeshBasicMaterial({ color: 0xbfeaff });
  const anel = mesh(new THREE.TorusGeometry(2.4, 0.05, 6, 48), mLuz); anel.rotation.x = Math.PI / 2; anel.position.set(56.8, H - 0.05, 0);
  for (const v of [v0 + 0.06, v1 - 0.06]) { const f = mesh(new THREE.BoxGeometry(u1 - u0 - 0.4, 0.04, 0.04), mLuz); f.position.set((u0 + u1) / 2, PISO + 0.05, v); }
  // o pedestal do jornal
  const mEscuro = new THREE.MeshStandardMaterial({ color: 0x101319, roughness: 0.35, metalness: 0.7 });
  const ped = mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.95, 28), mEscuro); ped.position.set(56.8, PISO + 0.475, 0);
  const mBrilho = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.85 });
  const tampo = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 28), mBrilho); tampo.position.set(56.8, PISO + 0.965, 0);
  // o jornal em holograma, flutuando em cima do pedestal
  const mJornal = new THREE.MeshBasicMaterial({ map: texJornal(), color: 0x9fdcff, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const jornal = mesh(new THREE.PlaneGeometry(0.72, 0.96), mJornal); jornal.position.set(56.8, PISO + 1.75, 0);
  const mFeixe = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const feixe = mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.8, 24, 1, true), mFeixe); feixe.position.set(56.8, PISO + 1.36, 0);
  // a vitrine do traje amarelo (canto sudeste), com a base acesa em vermelho
  const vitrine = new THREE.Group(); vitrine.position.set(59.9, PISO, -4.5); g.add(vitrine);
  const mVidro = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const vidro = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 1.3), mVidro); vidro.position.y = 1.2; vitrine.add(vidro); geos.push(vidro.geometry); mats.push(mVidro);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 28), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); base.position.y = 0.04; vitrine.add(base); geos.push(base.geometry); mats.push(base.material);
  let traje = null;
  criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, traje: 'reverso' }).then((m) => {
    traje = m; m.grupo.position.y = 0.08; vitrine.add(m.grupo); vitrine.rotation.y = -Math.PI * 0.72;
    m.aplicar({ v: 0, noChao: true }, 0.016);
  }).catch((e) => console.warn('o traje da vitrine não carregou', e));
  // a porta: um painel da parede do saguão (o mesmo cinza), que entra na parede quando abre
  const mPorta = new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.6, metalness: 0.15 });
  const porta = new THREE.Group(); g.add(porta);
  const painel = new THREE.Mesh(new THREE.BoxGeometry(C.t - 0.12, PORTA_Y - PISO, p1 - p0), mPorta); porta.add(painel); geos.push(painel.geometry); mats.push(mPorta);
  const fresta = new THREE.Mesh(new THREE.BoxGeometry(C.t - 0.1, PORTA_Y - PISO - 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x0e1016 })); fresta.position.z = (p1 - p0) / 2 - 0.01; porta.add(fresta);
  porta.position.set(C.parede, PISO + (PORTA_Y - PISO) / 2, (p0 + p1) / 2);

  // ---------- a Gideon: um rosto holográfico grande, azul, flutuando diante da parede do fundo ----------
  const GY = 3.0 - 1.62 * 2.3;                                       // (o corpo some; o rosto, 2,3× maior, fica a uns 3 m do chão)
  const gideon = new THREE.Group(); gideon.position.set(60.25, GY, 0); gideon.rotation.y = -Math.PI / 2; gideon.visible = false; g.add(gideon);
  const mHolo = new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const mFio = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending });
  let rosto = null;
  criarHeroi({ aniso, lod: 0, mobile, pessoa: 'linda' }).then((m) => {
    rosto = m; const cab = m.materiais[1];
    m.grupo.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (o.material !== cab) { o.visible = false; return; }
      o.material = mHolo;
      const fio = new THREE.SkinnedMesh(o.geometry, mFio); fio.bind(o.skeleton, o.bindMatrix); fio.frustumCulled = false; o.parent.add(fio);
    });
    m.grupo.scale.setScalar(2.3); gideon.add(m.grupo); m.aplicar({ v: 0, noChao: true }, 0.016);
  }).catch((e) => console.warn('a Gideon não carregou', e));

  let aberta = 0, alvoAberta = 0, alvoGideon = 0, luzGideon = 0, t = 0, luzes = 0.55;
  const cabeca = new THREE.Vector3();
  return {
    /** a cada quadro: só existe com o laboratório por perto */
    atualizar(dt, P, { visivel = true, falaGideon = false } = {}) {
      g.visible = visivel; if (!visivel) return;
      t += dt;
      aberta += (alvoAberta - aberta) * Math.min(1, dt * 2.2);
      porta.position.z = (p0 + p1) / 2 + aberta * (p1 - p0 + 0.05); porta.visible = aberta < 0.98;
      // o jornal gira devagar e pisca de leve; o feixe pulsa
      jornal.rotation.y = -Math.PI / 2 + Math.sin(t * 0.5) * 0.35; jornal.position.y = PISO + 1.75 + Math.sin(t * 1.3) * 0.03;
      mJornal.opacity = 0.7 + 0.12 * Math.sin(t * 9) * Math.sin(t * 2.3); mFeixe.opacity = 0.1 + 0.05 * Math.sin(t * 3);
      // a Gideon: acende quando fala (ou quando o Wells a chama), some devagar
      const alvo = Math.max(alvoGideon, falaGideon ? 1 : 0);
      luzGideon += (alvo - luzGideon) * Math.min(1, dt * 3);
      gideon.visible = luzGideon > 0.02;
      const fala = falaGideon ? 0.15 * Math.abs(Math.sin(t * 11)) : 0;
      mHolo.opacity = luzGideon * (0.22 + fala + 0.05 * Math.sin(t * 23)); mFio.opacity = luzGideon * (0.32 + fala);
      gideon.position.y = GY + Math.sin(t * 0.9) * 0.05; gideon.rotation.y = -Math.PI / 2 + Math.sin(t * 0.4) * 0.12;
      if (rosto && gideon.visible) rosto.aplicar({ v: 0, noChao: true, fala: falaGideon }, dt);
      mParede.emissiveIntensity = luzes + 0.1 * Math.sin(t * 1.7);
    },
    /** abre (ou fecha) a porta secreta; `ja`: sem animação */
    porta(abrir, ja = false) { alvoAberta = abrir ? 1 : 0; if (ja) aberta = alvoAberta; },
    get aberta() { return aberta > 0.6 || alvoAberta > 0.5; },
    /** a Gideon acesa (o Wells chamou, ou a sala foi descoberta) */
    gideon(on) { alvoGideon = on ? 1 : 0; },
    /** as luzes da sala (na descoberta, acendem de vez) */
    luzes(n) { luzes = n; },
    /** onde a câmera olha quando a Gideon fala (o "pé" dela fica 1,55 m abaixo dos olhos, como numa pessoa) */
    focoGideon() {
      if (!gideon.visible || !rosto) return null;
      const cab = rosto.ossos.find((o) => o.name === 'cabeca'); cab.getWorldPosition(cabeca);
      return { x: cabeca.x, y: cabeca.y - 1.5, z: cabeca.z };
    },
    /** os pontos da sala (mundo) */
    pontos: { centro: { x: cx + 55.2, z: cz }, porta: { x: cx + 50.4, z: cz }, dentro: { x: cx + 53.4, z: cz }, wells: { x: cx + 56.0, z: cz - 0.95 }, gideon: { x: cx + 60.25, z: cz } },
    get prontos() { return !!rosto && !!traje; },
  };
}
