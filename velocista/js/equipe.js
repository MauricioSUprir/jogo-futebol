// A equipe do S.T.A.R. Labs em 3D: Caitlin e Cisco no Cortex (corpos do Rocketbox, MIT, com roupa, rosto e cabelo
// próprios — velocista/tools/personagens; nada da série nem dos atores). Ficam perto da mesa holográfica, viram para o
// herói quando ele entra no Cortex e gesticulam quando falam numa cena. Só são carregados quando o jogo começa e só
// aparecem com o herói perto do laboratório.
// Também tira os RETRATOS da caixa de fala: o rosto de cada personagem renderizado uma vez num quadrado pequeno.
import * as THREE from 'three';
import { criarHeroi } from './humano.js';

/** onde cada um fica no Cortex (coordenadas locais do laboratório: u = x - cx, v = z - cz) */
const LUGARES = { caitlin: { u: -3.1, v: -3.5 }, cisco: { u: 3.3, v: -2.9 } };
const PISO = 0.3;

export function criarEquipe(cena, { mobile = false, aniso = 2, renderer = null, lab, aoRetrato = () => {} } = {}) {
  const P0 = { x: lab.cx, z: lab.cz };
  const pessoas = {};                                       // id → {modelo, x, z, h}
  let carregando = null;

  // ---------- retrato: a cabeça, de frente, num quadrado de 128 px ----------
  const cenaRet = new THREE.Scene();
  cenaRet.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2228, 2.2));
  const luzRet = new THREE.DirectionalLight(0xffffff, 2.6); luzRet.position.set(0.6, 1.2, 1.5); cenaRet.add(luzRet);
  const camRet = new THREE.PerspectiveCamera(24, 1, 0.05, 10);
  const vTmp = new THREE.Vector3();
  function retratar(id, modelo) {
    if (!renderer || !modelo) return;
    try {
      const g = modelo.grupo, pai = g.parent, pos = g.position.clone();
      cenaRet.add(g); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
      const cab = modelo.ossos.find((o) => o.name === 'cabeca'); cab.getWorldPosition(vTmp);
      camRet.position.set(vTmp.x + 0.08, vTmp.y - 0.0, vTmp.z + 0.72); camRet.lookAt(vTmp.x, vTmp.y - 0.035, vTmp.z);
      const rt = new THREE.WebGLRenderTarget(128, 128, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
      const cor = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha(), tm = renderer.toneMapping;
      renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(cenaRet, camRet);
      const px = new Uint8Array(128 * 128 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 128, 128, px);
      renderer.setRenderTarget(null); renderer.setClearColor(cor, alfa); renderer.toneMapping = tm; rt.dispose();
      cenaRet.remove(g); g.position.copy(pos); if (pai) pai.add(g);
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(128, 128);
      for (let y = 0; y < 128; y++) img.data.set(px.subarray((127 - y) * 512, (128 - y) * 512), y * 512);   // a GPU lê de baixo para cima
      ctx.putImageData(img, 0, 0);
      aoRetrato(id, cv.toDataURL('image/png'));
    } catch (e) { console.warn('retrato', id, e); }
  }

  function carregar() {
    if (carregando) return carregando;
    carregando = Promise.all(Object.keys(LUGARES).map(async (id) => {
      const modelo = await criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, pessoa: id });
      const L = LUGARES[id], p = { id, modelo, x: P0.x + L.u, z: P0.z + L.v, h: Math.PI, fala: false };
      modelo.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; });
      // o modelo (grupo `frente`) já olha para +z; o rumo vai no grupo de fora, como no herói
      p.raiz = new THREE.Group(); p.raiz.add(modelo.grupo); p.raiz.position.set(p.x, PISO, p.z);
      p.raiz.rotation.y = p.h; p.raiz.visible = false; cena.add(p.raiz);
      pessoas[id] = p;
      retratar(id, modelo);
    })).catch((e) => { console.warn('equipe sem corpo', e); });
    return carregando;
  }

  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** a cada quadro: aparecem com o herói perto do laboratório; viram para ele dentro do Cortex; `quemFala` gesticula */
  function atualizar(dt, P, { noCortex = false, quemFala = null } = {}) {
    const perto = Math.hypot(P.x - P0.x, P.z - P0.z) < 70;
    for (const p of Object.values(pessoas)) {
      p.raiz.visible = perto;
      if (!perto) continue;
      const alvo = noCortex ? Math.atan2(P.x - p.x, P.z - p.z) : Math.PI;
      p.h += ang(alvo - p.h) * Math.min(1, dt * 3);
      p.raiz.rotation.y = p.h;
      p.modelo.aplicar({ v: 0, noChao: true, fala: quemFala === p.id }, dt);
    }
  }

  return {
    carregar, atualizar, retratar,
    get pronta() { return Object.keys(pessoas).length === Object.keys(LUGARES).length; },
    /** os focos da câmera numa cena: {caitlin: () => ponto, cisco: () => ponto} */
    focos() { return Object.fromEntries(Object.values(pessoas).map((p) => [p.id, () => ({ x: p.x, y: PISO, z: p.z })])); },
    /** onde o herói fica no começo da história: no Cortex, de frente para os dois */
    lugarDoHeroi() { return { x: P0.x, y: PISO, z: P0.z - 7.6, h: Math.atan2(0, 1) }; },
  };
}
