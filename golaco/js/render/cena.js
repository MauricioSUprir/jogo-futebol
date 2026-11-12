// Cena, renderizador e luz: céu de DIA (gradiente azul + sol) e de NOITE (céu escuro, luz de
// refletores), HemisphereLight + DirectionalLight com sombra SÓ nos jogadores e na bola. A
// câmera da sombra é justa (quadrado fixo em volta da jogada) e anda em passos de 1 texel
// ("texel snapping", Alex Tardif / MS "Common Techniques to Improve Shadow Depth Maps") para a
// borda da sombra não tremeluzir quando a câmera segue o jogador.
//
// O antisserrilhado (item 45, `golaco/PLANO-GRAFICOS.md` passo 1): o MSAA 4× do próprio canvas (o pedido `antialias` do
// contexto; sem passada extra) pela tabela AA_QUALIDADE — a Média passou a ter (D1); o QUALIDADE.antialias do config.js
// ficou como a tabela de antes (?gfx=antigo) e o config.js, do fecho do hash, não se toca. A troca de qualidade compara o
// antisserrilhado PEDIDO com o do CONTEXTO (o que o navegador deu: a queda automática deixa a Baixa num contexto com MSAA),
// nunca com o nome da qualidade. Recriar o renderizador (canvas novo) leva o canvas inteiro (atributos e inert) e o recorte
// local e roda os ganchos aoRecriar — os mesmos do contexto restaurado (webglcontextrestored).
import * as THREE from 'three';
import { QUALIDADE } from '../config.js';
import { GRAFICOS } from './graficos-opcoes.js';

/** O antisserrilhado (MSAA do canvas) por qualidade. O ?aa=0|1 passa por cima; o ?gfx=antigo volta ao QUALIDADE.antialias. */
export const AA_QUALIDADE = Object.freeze({ baixa: false, media: true, alta: true });
// o teto dos aparelhos de toque (escolha D8 do dono): o MSAA que a tabela ACRESCENTA (o da Média) só com a área da tela ×
// min(dpr, pixelRatioMax)² ≤ 1,2 MP — o 844×390 dá 0,74 MP e o 932×430 0,90 (com MSAA); o iPad mini 1,9 e o iPad Pro 12,9"
// 3,1 (sem: a Média do tablet fica como antes, pr 1,5 e sem MSAA, ~100 MB a menos no Safari). O MSAA que já existia (a Alta)
// fica em todo aparelho: nada pior que antes. No PC não há teto
export const AA_TETO_TOQUE = 1.2e6;
// a exposição por tom: o Neutral pede × 1,40 para a cena ficar no brilho do ACES (PLANO-GRAFICOS.md §2, D2; só diagnóstico)
export const FATOR_TOM = Object.freeze({ aces: 1, neutro: 1.4 });
const fatorTom = FATOR_TOM[GRAFICOS.tom] ?? 1;

/** O aparelho, para o teto: toque (pointer: coarse), dpr e a TELA (screen: não muda ao girar o celular). */
function ambiente() {
  if (typeof window === 'undefined') return { toque: false, dpr: 1, telaW: 0, telaH: 0 };
  return {
    toque: !!window.matchMedia?.('(pointer: coarse)').matches,
    dpr: window.devicePixelRatio || 1,
    telaW: window.screen?.width ?? 0, telaH: window.screen?.height ?? 0,
  };
}

/** O antisserrilhado PEDIDO para a qualidade `nome` neste aparelho (a tabela, o ?aa, o ?gfx=antigo e o teto do toque). */
export function aaPedido(nome, opc = GRAFICOS, amb = ambiente()) {
  const q = QUALIDADE[nome];
  if (opc.aa === true || opc.aa === false) return opc.aa;
  if (opc.gfxAntigo) return !!q?.antialias;
  let aa = !!AA_QUALIDADE[nome];
  if (aa && q && !q.antialias && amb.toque) {
    const pr = Math.min(amb.dpr, q.pixelRatioMax);
    if (amb.telaW * amb.telaH * pr * pr > AA_TETO_TOQUE) aa = false;
  }
  return aa;
}

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
    // refletores: luz branca fria, alta e de dois lados; pouco ambiente (sombras mais
    // marcadas) e névoa escura que apaga o que está longe do gramado iluminado
    topo: 0x01030a, horizonte: 0x0a1422, baixo: 0x050709, solCor: 0x000000,
    solDir: [0.26, 0.9, 0.36],
    hemiCeu: 0x7f93b8, hemiChao: 0x0c180c, hemiInt: 0.32,
    luzCor: 0xe2ecff, luzInt: 2.9,
    extraInt: 1.25, extraDir: [-0.5, 0.75, -0.45],
    nevoa: 0x020407, nevoaPerto: 55, nevoaLonge: 290, exposicao: 0.98,
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
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizonte, uTopo, pow(clamp(h, 0.0, 1.0), 0.42));
        c = mix(c, uBaixo, smoothstep(0.0, -0.06, h));
        float s = max(dot(d, normalize(uSolDir)), 0.0);
        c += uSolCor * (pow(s, 1200.0) * 30.0 + pow(s, 16.0) * 0.35 + pow(s, 3.0) * 0.06) * (1.0 - uNoite);
        // à noite: sem estrelas (com os refletores acesos não se vê nenhuma — e pontos de
        // 1 px piscavam como sujeira na tela); só o halo dos refletores perto do horizonte
        c += vec3(0.035, 0.05, 0.07) * uNoite * (1.0 - smoothstep(0.0, 0.35, h));
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

function criarRenderer(canvas, q, aa) {
  const r = new THREE.WebGLRenderer({
    canvas, antialias: aa, alpha: false, stencil: false, powerPreference: 'high-performance',
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = GRAFICOS.tom === 'neutro' ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
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
  // o contexto: o antisserrilhado PEDIDO ao criá-lo e o que o navegador DEU (o atributo devolvido e as amostras do buffer
  // padrão: Média 4 no MSAA). Lidos na criação e no contexto restaurado, com o buffer padrão ligado
  const ctx = { pedido: aaPedido(nomeQ), aa: false, amostras: 0 };
  let renderer = criarRenderer(opc.canvas, q, ctx.pedido);
  const lerContexto = () => {
    const gl = renderer.getContext();
    ctx.aa = !!gl.getContextAttributes()?.antialias;
    ctx.amostras = gl.getParameter(gl.SAMPLES) | 0;
  };
  lerContexto();
  // os ganchos de quem precisa saber do contexto novo (a A2C dos finos, a mira): na recriação e no contexto restaurado
  const ganchos = [];
  const rodarGanchos = motivo => {
    const ev = { motivo, renderer, aa: ctx.aa, amostras: ctx.amostras };
    for (const fn of ganchos.slice()) {
      try { fn(ev); } catch (e) { console.error('cena: gancho aoRecriar falhou', e); }
    }
  };
  // a chave do último tamanho do buffer (largura x altura @ pixel ratio): o resize e o visualViewport chamam os dois
  let chaveTam = '';
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
  // raio da sombra em volta do foco: 21 m; na Alta, 28 m (com 22 em campo, os jogadores da borda do
  // quadro de TV, ~45 m de largura, ficavam só com a mancha). Texel com o mapa de 2048: 2,7 cm.
  const raioSombra = () => (q.mapaSombra >= 2048 ? 28 : 21);

  function configurarSombra() {
    luz.castShadow = q.sombras;
    renderer.shadowMap.enabled = q.sombras;
    renderer.shadowMap.type = q.mapaSombra >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (luz.shadow.map) { luz.shadow.map.dispose(); luz.shadow.map = null; }
    if (q.sombras) {
      luz.shadow.mapSize.set(q.mapaSombra, q.mapaSombra);
      const c = luz.shadow.camera, R = raioSombra();
      c.left = -R; c.right = R; c.top = R; c.bottom = -R;
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
    // (o ?tom=neutro pede × 1,40; aqui a exposição sobrevive à troca de hora e à recriação)
    renderer.toneMappingExposure = H.exposicao * fatorTom;
    // base ortonormal da vista da luz
    eixoD.crossVectors(new THREE.Vector3(0, 1, 0), dirLuz).normalize();
    if (eixoD.lengthSq() < 1e-6) eixoD.set(1, 0, 0);
    eixoC.crossVectors(dirLuz, eixoD).normalize();
  }

  configurarSombra();
  aplicarHora(hora);
  const foco = new THREE.Vector3();
  // o contexto restaurado (o ouvinte em todo canvas da cena; depois do ouvinte do three, posto no construtor do renderizador:
  // o dele refaz o estado da GPU antes; o setClearColor mora no WebGLBackground, que o initGLContext refaz — a hora repõe)
  function aoRestaurar() { lerContexto(); aplicarHora(hora); rodarGanchos('contexto'); }
  // recriar para a qualidade `nome`: o antisserrilhado PEDIDO para ela é outro que o do CONTEXTO, e este contexto não foi pedido
  // assim (o navegador recusou o MSAA: recriar daria o mesmo)
  const precisaRecriar = nome => { const aa = aaPedido(nome); return aa !== ctx.aa && aa !== ctx.pedido; };
  opc.canvas.addEventListener('webglcontextrestored', aoRestaurar);

  return {
    cena,
    get renderer() { return renderer; },
    get qualidade() { return nomeQ; },
    get hora() { return hora; },
    /** O antisserrilhado do CONTEXTO (o atributo que o navegador deu) e as amostras do buffer padrão (SAMPLES: 4 com MSAA). */
    get aaContexto() { return ctx.aa; },
    get amostras() { return ctx.amostras; },
    anisotropia() { return Math.min(renderer.capabilities.getMaxAnisotropy(), nomeQ === 'baixa' ? 2 : nomeQ === 'media' ? 4 : 8); },
    definirHora: aplicarHora,
    /**
     * Troca a qualidade. Recria o renderizador (canvas novo) quando o antisserrilhado PEDIDO para ela é outro que o do
     * CONTEXTO — menos quando este contexto já foi pedido assim (o navegador recusou o MSAA: recriar daria o mesmo). Sem
     * `recriarSePreciso` (a queda automática no meio da partida: recompilar trava a tela) o contexto fica, com o MSAA dele.
     * Devolve se recriou.
     */
    definirQualidade(nome, recriarSePreciso = true) {
      const nova = QUALIDADE[nome];
      if (!nova) return false;
      const aa = aaPedido(nome);
      let recriou = false;
      if (recriarSePreciso && precisaRecriar(nome)) {
        const velho = renderer;
        const cv = velho.domElement;
        const novo = document.createElement('canvas');
        // o canvas inteiro: TODOS os atributos (id, classe, aria-label, inert, a largura e a altura do buffer) e o inert
        for (const a of cv.attributes) novo.setAttribute(a.name, a.value);
        novo.inert = cv.inert;
        // o único estado do renderizador que se perderia (o recorte do vão das placas no pré-jogo, render/vao-placas.js)
        const recorte = velho.localClippingEnabled;
        cv.removeEventListener('webglcontextrestored', aoRestaurar);
        cv.replaceWith(novo);
        if (luz.shadow.map) { luz.shadow.map.dispose(); luz.shadow.map = null; }
        velho.dispose();
        velho.forceContextLoss();
        renderer = criarRenderer(novo, nova, aa);
        renderer.localClippingEnabled = recorte;
        novo.addEventListener('webglcontextrestored', aoRestaurar);
        ctx.pedido = aa;
        lerContexto();
        // (o canvas novo é outro buffer: o próximo redimensionar acerta o tamanho e o pixel ratio)
        chaveTam = '';
        recriou = true;
      }
      nomeQ = nome; q = nova;
      configurarSombra();
      aplicarHora(hora);
      if (recriou) rodarGanchos('recriacao');
      return recriou;
    },
    /** A troca para a qualidade `nome` recriaria o renderizador (a pausa mostra a tela "Ajustando…" antes; o main.js C12). */
    precisaRecriar,
    /**
     * Os ganchos do contexto novo: fn({motivo: 'recriacao' | 'contexto', renderer, aa, amostras}) roda depois da recriação do
     * renderizador (definirQualidade) e no contexto restaurado (webglcontextrestored). Devolve a função que o tira.
     */
    aoRecriar(fn) {
      ganchos.push(fn);
      return () => { const i = ganchos.indexOf(fn); if (i >= 0) ganchos.splice(i, 1); };
    },
    /** Quantos ganchos do contexto novo estão registrados (testes: nenhum vaza a cada pré-jogo — o letreiro de fora, C10). */
    get nGanchos() { return ganchos.length; },
    /**
     * O buffer do canvas para a janela w × h (px CSS) com o pixel ratio da qualidade. Só mexe quando a largura, a altura ou o
     * pixel ratio mudam (o resize e o visualViewport chamam os dois; cada atribuição a canvas.width/height refaz o provedor do
     * canvas e, com MSAA, realoca as amostras): um setDrawingBufferSize, 2 atribuições. Devolve se mudou.
     */
    redimensionar(w, h) {
      const pr = Math.min(window.devicePixelRatio || 1, q.pixelRatioMax);
      const chave = `${w}x${h}@${pr}`;
      if (chave === chaveTam) return false;
      chaveTam = chave;
      renderer.setDrawingBufferSize(w, h, pr);
      return true;
    },
    /** Sombra acompanha a jogada, andando de texel em texel. */
    acompanhar(x, z) {
      foco.set(x, 0, z);
      if (q.sombras) {
        const texel = (2 * raioSombra()) / q.mapaSombra;
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
    /** Raio (m) da sombra em volta do foco (21; 28 na Alta). */
    get raioSombra() { return q.sombras ? raioSombra() : 0; },
  };
}
