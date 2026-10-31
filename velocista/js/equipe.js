// A equipe do S.T.A.R. Labs em 3D: Caitlin e Cisco no Cortex (corpos do Rocketbox, MIT, com roupa, rosto e cabelo
// próprios — velocista/tools/personagens; nada da série nem dos atores). Ficam perto da mesa holográfica, viram para o
// herói quando ele entra no Cortex e gesticulam quando falam numa cena. Só são carregados quando o jogo começa e só
// aparecem com o herói perto do laboratório.
// `retratar` tira o RETRATO da caixa de fala (o rosto renderizado num quadrado pequeno). Só a ferramenta
// tools/gerar-retratos.mjs usa: no jogo, ler a imagem de volta da GPU (readPixels) travava o navegador às vezes, então
// os retratos vão prontos em assets/personagens/retratos/.
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { PESSOAL } from './edicao.js';

/** onde cada um fica no Cortex (coordenadas locais do laboratório: u = x - cx, v = z - cz) */
const LUGARES = { caitlin: { u: -3.1, v: -3.5 }, cisco: { u: 3.3, v: -2.9 } };
// na temporada da série (edição pessoal), o Dr. Harrison Wells entre os dois, na cadeira de rodas
if (PESSOAL) LUGARES.wells = { u: 0.2, v: -2.4, sentado: true };
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
      // sem MSAA no alvo (a leitura de um alvo multiamostrado derrubava o navegador): desenha em 256 e reduz para 128
      const L = 256, rt = new THREE.WebGLRenderTarget(L, L); rt.texture.colorSpace = THREE.SRGBColorSpace;
      const cor = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha(), ant = renderer.getRenderTarget();
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(cenaRet, camRet);
      const px = new Uint8Array(L * L * 4); renderer.readRenderTargetPixels(rt, 0, 0, L, L, px);
      renderer.setRenderTarget(ant); renderer.setClearColor(cor, alfa); rt.dispose();
      cenaRet.remove(g); g.position.copy(pos); if (pai) pai.add(g);
      const grande = document.createElement('canvas'); grande.width = grande.height = L;
      const gx = grande.getContext('2d'), img = gx.createImageData(L, L);
      for (let y = 0; y < L; y++) img.data.set(px.subarray((L - 1 - y) * L * 4, (L - y) * L * 4), y * L * 4);   // a GPU lê de baixo para cima
      gx.putImageData(img, 0, 0);
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(grande, 0, 0, 128, 128);
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
      if (L.sentado) p.raiz.add(cadeiraDeRodas());
      pessoas[id] = p;
    })).catch((e) => { console.warn('equipe sem corpo', e); });
    return carregando;
  }

  /** a cadeira de rodas do Wells (geometria simples, no espaço de quem senta: frente = +z) */
  function cadeiraDeRodas() {
    const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.35, metalness: 0.8 }), preto = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.7 });
    for (const s of [-1, 1]) {
      const roda = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 8, 28), preto); roda.rotation.y = Math.PI / 2; roda.position.set(s * 0.29, 0.3, -0.12); g.add(roda);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.008, 6, 24), metal); aro.rotation.y = Math.PI / 2; aro.position.set(s * 0.315, 0.3, -0.12); g.add(aro);
      const rodinha = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14), preto); rodinha.rotation.y = Math.PI / 2; rodinha.position.set(s * 0.2, 0.07, 0.3); g.add(rodinha);
      const braco = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.42), metal); braco.position.set(s * 0.25, 0.68, -0.04); g.add(braco);
      const pe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), metal); pe.position.set(s * 0.1, 0.1, 0.38); g.add(pe);
    }
    const assento = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.44), preto); assento.position.set(0, 0.47, -0.03); g.add(assento);
    const encosto = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), preto); encosto.position.set(0, 0.76, -0.27); encosto.rotation.x = -0.1; g.add(encosto);
    return g;
  }
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** a cada quadro: aparecem com o herói perto do laboratório; viram para ele dentro do Cortex; `quemFala` gesticula */
  function atualizar(dt, P, { noCortex = false, quemFala = null, oculto = false, fora = null } = {}) {
    const perto = Math.hypot(P.x - P0.x, P.z - P0.z) < 70 && !oculto;     // (oculto: a linha do tempo alterada, ninguém no Cortex)
    for (const p of Object.values(pessoas)) {
      p.raiz.visible = perto && !fora?.includes(p.id);                       // (fora: quem está em outro lugar no passo — missoes.js semEquipe)
      if (!perto) continue;
      const alvo = noCortex ? Math.atan2(P.x - p.x, P.z - p.z) : Math.PI;
      p.h += ang(alvo - p.h) * Math.min(1, dt * 3);
      p.raiz.rotation.y = p.h;
      p.modelo.aplicar({ v: 0, noChao: true, fala: quemFala === p.id, sentado: !!LUGARES[p.id].sentado }, dt);
    }
  }

  return {
    carregar, atualizar, retratar,
    /** a temporada da série: o Wells se levanta da cadeira (e volta a sentar depois da cena) */
    levantar(id) { if (LUGARES[id]) LUGARES[id].sentado = false; },
    sentar(id) { if (LUGARES[id]) LUGARES[id].sentado = true; },
    get pronta() { return Object.keys(pessoas).length === Object.keys(LUGARES).length; },
    /** os focos da câmera numa cena: {caitlin: () => ponto, cisco: () => ponto} */
    focos() { return Object.fromEntries(Object.values(pessoas).map((p) => [p.id, () => ({ x: p.x, y: PISO, z: p.z })])); },
    /** onde o herói fica no começo da história: no Cortex, de frente para os dois */
    lugarDoHeroi() { return { x: P0.x, y: PISO, z: P0.z - 7.6, h: Math.atan2(0, 1) }; },
  };
}
