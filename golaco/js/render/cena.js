// Cena, renderizador e luz: céu de DIA (gradiente azul + sol) e de NOITE (céu escuro, luz de
// refletores), HemisphereLight + DirectionalLight com sombra SÓ nos jogadores e na bola. A
// câmera da sombra é justa (quadrado fixo em volta da jogada) e anda em passos de 1 texel
// ("texel snapping", Alex Tardif / MS "Common Techniques to Improve Shadow Depth Maps") para a
// borda da sombra não tremeluzir quando a câmera segue o jogador.
import * as THREE from 'three';
import { QUALIDADE } from '../config.js';

const HORAS = {
  dia: {
    topo: 0x2f6fd0, horizonte: 0xbcd6ee, baixo: 0x6d7a72, solCor: 0xfff1d6,
    solDir: [-0.42, 0.74, 0.52],
    hemiCeu: 0xc4dcff, hemiChao: 0x55703c, hemiInt: 1.45,
    luzCor: 0xfff3e2, luzInt: 3.3,
    extraInt: 0, extraDir: [0.5, 0.7, -0.5],
    nevoa: 0xb7cbe0, nevoaPerto: 150, nevoaLonge: 560, exposicao: 1.0,
  },
  noite: {
    topo: 0x01030a, horizonte: 0x0a1422, baixo: 0x050709, solCor: 0x000000,
    solDir: [0.28, 0.9, 0.34],
    hemiCeu: 0x8ea4c8, hemiChao: 0x10200f, hemiInt: 0.55,
    luzCor: 0xeef4ff, luzInt: 3.0,
    extraInt: 1.15, extraDir: [-0.55, 0.72, -0.42],
    nevoa: 0x05080d, nevoaPerto: 120, nevoaLonge: 460, exposicao: 1.04,
  },
};

function criarCeu() {
  const geo = new THREE.SphereGeometry(800, 32, 16);
  const uni = {
    uTopo: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uBaixo: { value: new THREE.Color() },
    uSolDir: { value: new THREE.Vector3(0, 1, 0) }, uSolCor: { value: new THREE.Color() }, uNoite: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uTopo; uniform vec3 uHorizonte; uniform vec3 uBaixo;
      uniform vec3 uSolDir; uniform vec3 uSolCor; uniform float uNoite;
      varying vec3 vDir;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizonte, uTopo, pow(clamp(h, 0.0, 1.0), 0.42));
        c = mix(c, uBaixo, smoothstep(0.0, -0.06, h));
        float s = max(dot(d, normalize(uSolDir)), 0.0);
        c += uSolCor * (pow(s, 1200.0) * 30.0 + pow(s, 16.0) * 0.35 + pow(s, 3.0) * 0.06) * (1.0 - uNoite);
        if (uNoite > 0.5) {
          vec2 g = floor(vec2(atan(d.z, d.x) * 220.0, h * 220.0));
          c += vec3(step(0.9972, h21(g))) * smoothstep(0.08, 0.5, h) * 0.9;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.name = 'ceu';
  return { mesh, uni };
}

function criarRenderer(canvas, q) {
  const r = new THREE.WebGLRenderer({
    canvas, antialias: q.antialias, alpha: false, stencil: false, powerPreference: 'high-performance',
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = q.sombras;
  r.shadowMap.type = q.mapaSombra >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  return r;
}

/**
 * Cria a cena. opc = {canvas, qualidade: 'baixa'|'media'|'alta', hora: 'dia'|'noite'}.
 */
export function criarCena(opc) {
  let nomeQ = opc.qualidade;
  let q = QUALIDADE[nomeQ];
  let renderer = criarRenderer(opc.canvas, q);
  const cena = new THREE.Scene();
  const ceu = criarCeu();
  cena.add(ceu.mesh);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
  cena.add(hemi);
  const luz = new THREE.DirectionalLight(0xffffff, 3);
  cena.add(luz, luz.target);
  const extra = new THREE.DirectionalLight(0xffffff, 0);
  cena.add(extra, extra.target);
  cena.fog = new THREE.Fog(0xffffff, 150, 560);
  let hora = opc.hora;
  const dirLuz = new THREE.Vector3(0, 1, 0);
  // base da vista da luz (para o "texel snapping")
  const eixoD = new THREE.Vector3(), eixoC = new THREE.Vector3();
  const RAIO_SOMBRA = 21;

  function configurarSombra() {
    luz.castShadow = q.sombras;
    renderer.shadowMap.enabled = q.sombras;
    renderer.shadowMap.type = q.mapaSombra >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (luz.shadow.map) { luz.shadow.map.dispose(); luz.shadow.map = null; }
    if (q.sombras) {
      luz.shadow.mapSize.set(q.mapaSombra, q.mapaSombra);
      const c = luz.shadow.camera;
      c.left = -RAIO_SOMBRA; c.right = RAIO_SOMBRA; c.top = RAIO_SOMBRA; c.bottom = -RAIO_SOMBRA;
      c.near = 1; c.far = 160;
      c.updateProjectionMatrix();
      luz.shadow.bias = -0.0006;
      luz.shadow.normalBias = 0.015;
      luz.shadow.radius = 2;
    }
    cena.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }

  function aplicarHora(h) {
    hora = h;
    const H = HORAS[h] ?? HORAS.dia;
    ceu.uni.uTopo.value.setHex(H.topo);
    ceu.uni.uHorizonte.value.setHex(H.horizonte);
    ceu.uni.uBaixo.value.setHex(H.baixo);
    ceu.uni.uSolCor.value.setHex(H.solCor);
    ceu.uni.uSolDir.value.set(...H.solDir).normalize();
    ceu.uni.uNoite.value = h === 'noite' ? 1 : 0;
    hemi.color.setHex(H.hemiCeu); hemi.groundColor.setHex(H.hemiChao); hemi.intensity = H.hemiInt;
    luz.color.setHex(H.luzCor); luz.intensity = H.luzInt;
    dirLuz.set(...H.solDir).normalize();
    extra.intensity = H.extraInt;
    extra.color.setHex(0xdfe8ff);
    extra.position.set(...H.extraDir).multiplyScalar(60);
    extra.target.position.set(0, 0, 0);
    cena.fog.color.setHex(H.nevoa); cena.fog.near = H.nevoaPerto; cena.fog.far = H.nevoaLonge;
    renderer.setClearColor(H.horizonte);
    renderer.toneMappingExposure = H.exposicao;
    // base ortonormal da vista da luz
    eixoD.crossVectors(new THREE.Vector3(0, 1, 0), dirLuz).normalize();
    if (eixoD.lengthSq() < 1e-6) eixoD.set(1, 0, 0);
    eixoC.crossVectors(dirLuz, eixoD).normalize();
  }

  configurarSombra();
  aplicarHora(hora);
  const foco = new THREE.Vector3();

  return {
    cena,
    get renderer() { return renderer; },
    get qualidade() { return nomeQ; },
    get hora() { return hora; },
    anisotropia() { return Math.min(renderer.capabilities.getMaxAnisotropy(), nomeQ === 'baixa' ? 2 : nomeQ === 'media' ? 4 : 8); },
    definirHora: aplicarHora,
    /** Troca a qualidade. Se o antisserrilhado mudar, recria o renderizador (novo canvas). */
    definirQualidade(nome, recriarSePreciso = true) {
      const nova = QUALIDADE[nome];
      if (!nova) return false;
      let recriou = false;
      if (recriarSePreciso && nova.antialias !== q.antialias) {
        const velho = renderer;
        const cv = velho.domElement;
        const novo = document.createElement('canvas');
        novo.id = cv.id; novo.className = cv.className;
        cv.replaceWith(novo);
        if (luz.shadow.map) { luz.shadow.map.dispose(); luz.shadow.map = null; }
        velho.dispose();
        velho.forceContextLoss();
        renderer = criarRenderer(novo, nova);
        recriou = true;
      }
      nomeQ = nome; q = nova;
      configurarSombra();
      aplicarHora(hora);
      return recriou;
    },
    redimensionar(w, h) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioMax));
      renderer.setSize(w, h, false);
    },
    /** Sombra acompanha a jogada, andando de texel em texel. */
    acompanhar(x, z) {
      foco.set(x, 0, z);
      if (q.sombras) {
        const texel = (2 * RAIO_SOMBRA) / q.mapaSombra;
        const u = foco.dot(eixoD), v = foco.dot(eixoC);
        foco.addScaledVector(eixoD, Math.round(u / texel) * texel - u);
        foco.addScaledVector(eixoC, Math.round(v / texel) * texel - v);
      }
      luz.target.position.copy(foco);
      luz.position.copy(foco).addScaledVector(dirLuz, 80);
      luz.target.updateMatrixWorld();
      ceu.mesh.position.set(x, 0, z);
    },
    desenhar(camera) {
      ceu.mesh.position.copy(camera.position);
      renderer.render(cena, camera);
    },
    info() { return renderer.info; },
  };
}
