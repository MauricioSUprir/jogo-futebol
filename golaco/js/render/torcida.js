// Torcida no estádio (three.js): os torcedores em 5 malhas instanciadas (lado de lá, os dois fundos e o lado de
// cá em 2 faixas de fileiras; cada uma com corte pela câmera — na câmera de TV só a do lado de lá vai para a GPU), um
// quadro por torcedor virado para a câmera em volta do eixo vertical ("billboard" cilíndrico) com a
// figura do atlas desenhado por código (torcida-dados.js). Cada torcedor tem posição, camisa, pele,
// cabelo, time, setor e sementes em atributos por instância; a pose (sentado, em pé, palmas, braços para
// cima, cachecol, mãos na cabeça), o pulo e o balanço saem no VERTEX SHADER dos níveis de ânimo (uniforms
// vindos de emocao.js) — nada é recalculado na CPU por quadro.
//
// Qualidade: Baixa = 38% das cadeiras e sem animação (só a pose pelo ânimo, sem pulo nem balanço nem
// palmas); Média = 62% (o celular); Alta = 90%. Os torcedores são montados UMA vez (gerarTorcidaNiveis: as
// qualidades são prefixos umas das outras) e trocar a qualidade é só mudar quantos desenhar e o uniform da
// animação — sem remontar nada nem recompilar o shader (contraprova M4: a troca travava ~300 ms). Um atlas
// só (64 × 128 por pose). Cada quadro encolhe para a caixa da pose (CAIXA_POSE) e os torcedores vêm da
// fileira da frente para a de cima (menos trabalho por pixel; contraprova M3). Noite: a luz dos refletores
// (mais escura e fria que o sol), como a arquibancada. Névoa da cena aplicada (fog).
// Festa (pedido de 11/10): a OLA (festa.js estadoOla → uOla; quem está na crista levanta com os braços em V), a
// luz FALSA dos sinalizadores (luz-falsa.js: uniform, nunca PointLight) e quem fica debaixo do BANDEIRÃO aberto segura
// o pano (braços em V, sem pular: ninguém fura o pano; bandeiras-dados.js sobBandeirao). O LADO DE CÁ (z +) só vai para a GPU com a
// câmera fora do volume dele: a câmera de TV fica DENTRO da arquibancada do lado de cá (12,3 m de altura a até 69 m
// do meio no celular) e o teste da caixa daria verdadeiro — os torcedores de lá cobririam a tela.
import * as THREE from 'three';
import { gerarTorcidaNiveis, quantosNoSetor, atlasTorcida, TORCIDA, CAIXA_POSE, cameraNoLadoDeCa } from './torcida-dados.js';
import { estadoOla, aberturaBandeirao } from './festa.js';
import { bandeiroes } from './bandeiras-dados.js';
import { ESTADO_GLSL } from './torcedor-pose.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ, atualizarLuzFalsa } from './luz-falsa.js';
import { criarBandeiras } from './bandeiras.js';
import { criarSinalizadores } from './sinalizadores.js';

/**
 * Os shaders do quadro (o atlas SDF de hoje). imp (o impostor octaédrico do item 69, PR 3: render/impostor.js, sob demanda)
 * = {vertPars, vertMain, fragPars, fragMain}: o MESMO programa com um ramo por torcedor (aLod: 0 o quadro, 1 o impostor) — o
 * quadro SDF continua igual; sem imp (o programa de hoje, a única coisa que a TV do celular desenha), nada do impostor.
 */
function shaders(imp = null) {
  const vert = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec4 aPos;
attribute vec4 aCamisa;
attribute vec4 aPele;
attribute vec4 aCabelo;
attribute vec4 aInfo;
attribute float aOculto;
uniform vec4 uLuz;
uniform vec3 uCamPos;
uniform vec3 uAcento0;
uniform vec3 uAcento1;
varying vec2 vUv;
varying vec3 vCamisa;
varying vec3 vPele;
varying vec3 vCabelo;
varying vec3 vAcento;
varying float vLuz;
varying float vAltura;
varying vec3 vFlare;
vec3 lin(vec3 c) { return c * c * (0.3 + 0.7 * c); }
${ESTADO_GLSL}
${LUZ_FALSA_GLSL}
const vec2 CAIXA[${CAIXA_POSE.length}] = vec2[${CAIXA_POSE.length}](${CAIXA_POSE.map(([w, h]) => `vec2(${w.toFixed(3)}, ${h.toFixed(3)})`).join(', ')});
${imp ? imp.vertPars : ''}
void main() {
  // o torcedor desenhado em 3D (render/torcedor3d.js, os blocos perto da câmera) sai do quadro: nada a rasterizar
  if (aOculto > 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float time = step(0.5, aInfo.x);
  float setor = floor(aInfo.y * 3.0 + 0.5);
  float h = aPele.w;
  float h2 = aInfo.w;
  // a pose, o pulo e o balanço: a MESMA conta do torcedor 3D (render/torcedor-pose.js ESTADO_GLSL: a regra de
  // torcida-dados.js POSE_REGRA, a ola de festa.js e o bandeirão de bandeiras-dados.js; a organizada no relógio da
  // batucada — pula no surdo da gravação quando o som toca)
  vec3 est = torcedorEstado(aPos.xyz, h, aInfo);
  float pose = est.x;
  float pulo = est.y;
  float bal = est.z;
  vCamisa = lin(aCamisa.rgb);
  vPele = lin(aPele.rgb);
  vCabelo = lin(aCabelo.rgb);
  vAcento = time > 0.5 ? uAcento1 : uAcento0;
  vFlare = luzFalsa(aPos.xyz + vec3(0.0, 1.2, 0.0));
  vec4 mvPosition;
  ${imp ? `vImpModo = step(0.5, aLod);
  if (aLod > 0.5) {
${imp.vertMain}
  } else {` : '{'}
    // virado para a câmera, girando só em volta do eixo vertical
    vec3 paraCam = uCamPos - aPos.xyz;
    paraCam.y = 0.0;
    vec3 dir = normalize(paraCam + vec3(1e-4, 0.0, 0.0));
    vec3 dirX = vec3(dir.z, 0.0, -dir.x);
    float esc = aPos.w;
    // o quadro encolhe para a caixa da pose (fração da célula): qx em −w/2…w/2, qy em 0…h
    vec2 cx = CAIXA[int(pose + 0.5)];
    float qx = position.x * cx.x;
    float qy = position.y * cx.y;
    vec3 p = aPos.xyz + dirX * (qx * ${TORCIDA.largura.toFixed(3)} * esc + bal)
           + vec3(0.0, qy * ${TORCIDA.altura.toFixed(3)} * esc + pulo, 0.0)
           + dir * (h2 - 0.5) * 0.08;
    mvPosition = viewMatrix * vec4(p, 1.0);
    vUv = vec2((pose + qx + 0.5) / ${TORCIDA.quadros}.0, qy);
    float luz = setor < 0.5 ? uLuz.x : (setor < 1.5 ? uLuz.y : (setor < 2.5 ? uLuz.z : uLuz.w));
    vLuz = luz * (0.88 + 0.24 * fract(h * 7.31));
    vAltura = qy;
  }
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
  const frag = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform vec2 uTamAtlas;
varying vec2 vUv;
varying vec3 vCamisa;
varying vec3 vPele;
varying vec3 vCabelo;
varying vec3 vAcento;
varying float vLuz;
varying float vAltura;
varying vec3 vFlare;
${imp ? imp.fragPars : ''}
void main() {
  vec3 cor;
  ${imp ? `if (vImpModo > 0.5) {
${imp.fragMain}
  } else {` : '{'}
    vec4 t = texture2D(uAtlas, vUv);
    // cobertura preservada de longe (mipmap tira opacidade das partes finas): sobe o alfa pelo nível do
    // mipmap (Castaño, "Computing Alpha Mipmaps"; Golus, "Anti-aliased Alpha Test")
    vec2 d = fwidth(vUv * uTamAtlas);
    float nivel = max(0.0, log2(max(max(d.x, d.y), 1e-4)));
    float a = t.a * (1.0 + 0.22 * nivel);
    if (a < 0.5) discard;
    vec3 w = t.rgb / max(t.a, 0.004);
    float ac = max(0.0, 1.0 - w.r - w.g - w.b);
    cor = w.r * vCamisa + w.g * vPele + w.b * vCabelo + ac * vAcento;
    // a fileira da frente faz sombra nas pernas; o resto pela luz do setor
    cor *= vLuz * (0.68 + 0.32 * smoothstep(0.08, 0.7, vAltura)) + vFlare;
  }
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
  return { vert, frag };
}

// luz por setor: [lado de lá (de frente para +z), fundo +x (de frente para −x), fundo −x (para +x), lado de cá (para −z)]
function luzDoSol(sol) {
  const n = [[0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 0, -1]];
  return n.map(v => 0.62 + 0.42 * Math.max(0, v[0] * sol[0] + v[1] * sol[1] + v[2] * sol[2]));
}
const SOL_DIA = (() => { const s = [-0.42, 0.74, 0.52], l = Math.hypot(...s); return s.map(v => v / l); })();
const LUZ = { dia: luzDoSol(SOL_DIA), noite: [0.44, 0.41, 0.41, 0.42] };


/**
 * Cria a torcida. opc = {qualidade, mascara (Uint8Array das cadeiras do mosaico, ou null), hora, identidade (identidade.js:
 * só a do Total Match — `tm` — muda as camisas, os cachecóis, as faixas, as bandeiras e o público; os lugares e os
 * sorteios são os mesmos)}.
 * Devolve {mesh, n, atualizar(t, emocao, camera), definirHora(h), definirQualidade(q), dispose()}.
 */
export function criarTorcida(cena, opc) {
  const ident = opc.identidade && opc.identidade.tm ? opc.identidade : null;
  const BANDEIROES = bandeiroes();   // aqui (não na carga): um estádio com forma própria troca os lugares antes
  const uni = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uAtlas: { value: null }, uTamAtlas: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 }, uTempoOrg: { value: 0 }, uAnimada: { value: 1 },
    uExcita: { value: new THREE.Vector2() }, uTensao: { value: new THREE.Vector2() },
    uLamento: { value: new THREE.Vector2() }, uPalmas: { value: new THREE.Vector2() },
    uLuz: { value: new THREE.Vector4(...LUZ.dia) }, uCamPos: { value: new THREE.Vector3(0, 20, 60) },
    uOla: { value: new THREE.Vector4(0, 0.16, 0, 0) },
    uBandA: { value: BANDEIROES.map(b => new THREE.Vector3(...b.A)) }, uBandU: { value: BANDEIROES.map(b => new THREE.Vector3(...b.U)) },
    uBandV: { value: BANDEIROES.map(b => new THREE.Vector3(...b.V)) }, uAbre: { value: new THREE.Vector2(0, 0) },
    uFlare: UNIFORMS_LUZ.uFlare, uFlareN: UNIFORMS_LUZ.uFlareN,
    // acento (cachecol) na cor do time, linear: verde do Golaço FC, branco do Ventania FC
    uAcento0: { value: new THREE.Color(0x19e07a) }, uAcento1: { value: new THREE.Color(0xf2f4f5) },
  };
  // cachecol de cada time (Total Match): as cores da identidade
  if (ident) { uni.uAcento0.value.set(ident.torcida.acentos[0]); uni.uAcento1.value.set(ident.torcida.acentos[1]); }
  let mesh = null, material = null, qualidade = null, n = 0, dados = null;
  // quem está desenhado em 3D agora (render/torcedor3d.js): 255 sai do quadro (aOculto); os índices são os de `dados`
  let oculto = null, ocultos = [];
  // o IMPOSTOR (item 69, PR 3; render/impostor.js liga): o material com os dois ramos (impMat), o aLod por torcedor (255 = em
  // impostor; o grupo só usa impMat com alguém nele — sem ninguém, o programa de hoje), a malha PERTO (a densidade real nos
  // blocos das cadeiras 3D, fora das fileiras em 3D) e a conferência do programa (falhou = o quadro SDF de volta)
  let impMat = null, lod = null, emImp = [], perto = null, precargaImp = false, conferir = 0, falhasAntes = 0, impFalhou = false;
  const grupos = () => (mesh ? mesh.children.filter(m => m.userData.grupo !== undefined) : []);
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4();
  function desmontar() {
    if (!mesh) return;
    cena.remove(mesh);
    for (const m of mesh.children) m.geometry.dispose();
    material?.dispose();
    impMat?.dispose();
    uni.uAtlas.value?.dispose();
    mesh = null; perto = null; impMat = null;
  }
  /** Monta TODOS os torcedores (os da Alta) uma vez; a qualidade só escolhe quantos desenhar. */
  function montar() {
    desmontar();
    const d = gerarTorcidaNiveis(opc.mascara ?? null, ident ? { ...ident.torcida, publico: ident.publico } : null, ident?.forma3d?.planta.lugares);
    dados = d;
    oculto = new Uint8Array(d.n); ocultos = [];
    const [cw, ch] = TORCIDA.atlas;
    const at = atlasTorcida(cw, ch);
    const tex = new THREE.DataTexture(at.dados, at.largura, at.altura, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    uni.uAtlas.value = tex;
    uni.uTamAtlas.value.set(at.largura, at.altura);
    const sh = shaders();
    material = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: sh.vert, fragmentShader: sh.frag, fog: true });
    // um InstancedMesh por grupo (lado de lá, fundo +x, fundo −x, lado de cá frente, lado de cá cima): o mesmo
    // material e o mesmo atlas, cada um com a caixa de corte dos seus torcedores — com a câmera de TV no meio-campo
    // os fundos e o lado de cá ficam fora do quadro e nem chegam à GPU (só 1 chamada de desenho no jogo).
    // Os torcedores de cada grupo já vêm em ordem (nível, fileira da frente para cima): subarrays, sem cópia.
    mesh = new THREE.Group();
    mesh.name = 'torcida';
    const quad = new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3);
    const indice = new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1);
    for (let grupo = 0; grupo < d.faixas.length; grupo++) {
      const f = d.faixas[grupo];
      const k = f.porNivel[0] + f.porNivel[1] + f.porNivel[2];
      if (!k) continue;
      const a = 4 * f.inicio, b = 4 * (f.inicio + k);
      const pos = d.pos.subarray(a, b);
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let j = 0; j < k; j++) {
        const x = pos[4 * j], y = pos[4 * j + 1], z = pos[4 * j + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', quad);
      geo.setIndex(indice);
      geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 4));
      geo.setAttribute('aCamisa', new THREE.InstancedBufferAttribute(d.camisa.subarray(a, b), 4, true));
      geo.setAttribute('aPele', new THREE.InstancedBufferAttribute(d.pele.subarray(a, b), 4, true));
      geo.setAttribute('aCabelo', new THREE.InstancedBufferAttribute(d.cabelo.subarray(a, b), 4, true));
      geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(d.info.subarray(a, b), 4, true));
      geo.setAttribute('aOculto', new THREE.InstancedBufferAttribute(oculto.subarray(f.inicio, f.inicio + k), 1, true));
      geo.instanceCount = k;
      // os quadros saem do shader: o corte é por CAIXA (os fundos são compridos: 119 m em z — uma esfera de corte
      // pegaria a câmera de TV no meio-campo), feito em atualizar() com o frustum da câmera
      const m = new THREE.Mesh(geo, material);
      m.frustumCulled = false;
      m.userData.caixa = new THREE.Box3(new THREE.Vector3(x0 - 1, y0 - 0.2, z0 - 1), new THREE.Vector3(x1 + 1, y1 + TORCIDA.altura + 0.6, z1 + 1));
      m.userData.grupo = grupo;
      m.userData.faixa = [f.inicio, f.inicio + k];
      m.userData.ladoDeCa = f.setor === 3;
      m.name = `torcida-${f.nome}`;
      mesh.add(m);
    }
    cena.add(mesh);
  }
  /** Qualidade: quantos desenhar em cada arquibancada (prefixo) e a animação (uniform: nada recompila). */
  function aplicarQualidade(q) {
    qualidade = q;
    n = 0;
    for (const m of grupos()) { const k = quantosNoSetor(dados, m.userData.grupo, q); m.userData.k = k; m.geometry.instanceCount = k; n += k; }
    uni.uAnimada.value = TORCIDA.animada[q] ? 1 : 0;
  }
  montar();
  aplicarQualidade(TORCIDA.ocupacao[opc.qualidade] ? opc.qualidade : 'media');
  // a festa da torcida: faixas, bandeiras e bandeirões (1 chamada) e os sinalizadores (1 chamada, só no evento)
  const bandeiras = criarBandeiras(cena, { qualidade, hora: opc.hora, identidade: ident });
  const sinalizadores = criarSinalizadores(cena, { qualidade, hora: opc.hora });
  let festaVisivel = true;
  // ---------------------------------------------------------------- o impostor (item 69, PR 3) e a densidade real perto
  const contarFalhas = () => (opc.programas?.() ?? []).filter(p => p && p.diagnostics && p.diagnostics.runnable === false).length;
  const QUAD = () => mesh.children[0].geometry;
  /** A malha PERTO (a densidade real: as pessoas dos blocos das cadeiras 3D fora das fileiras em 3D), com `cap` lugares. */
  function criarPerto(cap) {
    // o quadro: uma cópia própria (a malha perto pode ser trocada por uma maior — o dispose dela não leva os buffers dos grupos)
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', QUAD().attributes.position.clone());
    geo.setIndex(QUAD().index.clone());
    const at = (nome, k, Tipo, normal) => { const a = new THREE.InstancedBufferAttribute(new Tipo(cap * k), k, normal); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(nome, a); };
    at('aPos', 4, Float32Array, false); at('aCamisa', 4, Uint8Array, true); at('aPele', 4, Uint8Array, true); at('aCabelo', 4, Uint8Array, true);
    at('aInfo', 4, Uint8Array, true); at('aOculto', 1, Uint8Array, true); at('aLod', 1, Uint8Array, true); at('aRumo', 2, Int8Array, true);
    geo.instanceCount = 0;
    const m = new THREE.Mesh(geo, impMat ?? material);
    m.name = 'torcida-perto';
    m.frustumCulled = false;      // a escolha já é pelo cone da câmera (os blocos das cadeiras 3D)
    m.visible = false;
    m.userData = { k: 0, cap };
    mesh.add(m);
    return m;
  }
  /**
   * Liga o impostor: imp = {vertPars, vertMain, fragPars, fragMain (o GLSL do render/impostor.js), uniforms (os dele: o
   * atlas e as contas), rumo: Int8Array(2·n) (cos e sen do rumo de cada torcedor × 127)}. O programa compila no próximo
   * quadro desenhado (a malha perto com 0 instâncias) e é conferido no seguinte (falhou: o quadro SDF de volta).
   */
  function ligarImpostor(imp) {
    if (!mesh || impFalhou) return false;
    const sh = shaders(imp);
    impMat?.dispose();
    impMat = new THREE.ShaderMaterial({ uniforms: { ...uni, ...imp.uniforms }, vertexShader: sh.vert, fragmentShader: sh.frag, fog: true });
    impMat.name = 'torcida-impostor';
    lod = new Uint8Array(dados.n); emImp = [];
    for (const m of grupos()) {
      const [i0, i1] = m.userData.faixa;
      m.geometry.setAttribute('aLod', new THREE.InstancedBufferAttribute(lod.subarray(i0, i1), 1, true));
      m.geometry.setAttribute('aRumo', new THREE.InstancedBufferAttribute(imp.rumo.subarray(2 * i0, 2 * i1), 2, true));
      m.userData.nImp = 0;
      m.material = material;
    }
    if (!perto) perto = criarPerto(256);
    else if (perto.userData.k) { const L = perto.geometry.attributes.aLod; L.array.fill(255, 0, perto.userData.k); L.needsUpdate = true; }
    falhasAntes = contarFalhas();
    precargaImp = true;
    return true;
  }
  /** O quadro SDF em tudo (a Baixa, o programa que falhou: `falhou` = para sempre nesta página). */
  function desligarImpostor(falhou = false) {
    if (falhou) impFalhou = true;
    if (!mesh) return;
    for (const m of grupos()) { m.material = material; m.userData.nImp = 0; }
    if (lod) { lod.fill(0); for (const m of grupos()) if (m.geometry.attributes.aLod) m.geometry.attributes.aLod.needsUpdate = true; }
    emImp = [];
    if (perto) { perto.material = material; const L = perto.geometry.attributes.aLod; L.array.fill(0); L.needsUpdate = true; }
    impMat?.dispose();
    impMat = null; precargaImp = false; conferir = 0;
  }
  /**
   * Os torcedores em IMPOSTOR agora (índices de `dados`; os outros, o quadro SDF): só os grupos que mudaram sobem de novo
   * para a GPU; o grupo sem ninguém em impostor volta ao programa de hoje (o do quadro).
   */
  function definirLod(indices) {
    if (!impMat || !lod) return;
    const mudou = new Set();
    const gs = grupos();
    const grupoDe = i => { for (const m of gs) if (i >= m.userData.faixa[0] && i < m.userData.faixa[1]) return m; return null; };
    for (const i of emImp) { lod[i] = 0; const m = grupoDe(i); if (m) { mudou.add(m); m.userData.nImp--; } }
    emImp = Array.from(indices ?? []);
    for (const i of emImp) { lod[i] = 255; const m = grupoDe(i); if (m) { mudou.add(m); m.userData.nImp++; } }
    for (const m of mudou) m.geometry.attributes.aLod.needsUpdate = true;
    for (const m of gs) m.material = m.userData.nImp > 0 ? impMat : material;
  }
  /**
   * As pessoas da densidade real perto (render/impostor-dados.js preencherBloco; as das fileiras sem 3D dos blocos das
   * cadeiras 3D): P = {n, pos, camisa, pele, cabelo, info, rumo (Int8Array 2n)} ou null. Em impostor se ele está ligado.
   */
  function definirPerto(P) {
    const k = P ? P.n : 0;
    if (!mesh || (!k && !perto)) return;
    if (!perto || perto.userData.cap < k) {
      if (perto) { mesh.remove(perto); perto.geometry.dispose(); }
      perto = criarPerto(Math.max(256, 1 << Math.ceil(Math.log2(k))));
    }
    const A = perto.geometry.attributes;
    if (k) {
      A.aPos.array.set(P.pos.subarray(0, 4 * k)); A.aCamisa.array.set(P.camisa.subarray(0, 4 * k));
      A.aPele.array.set(P.pele.subarray(0, 4 * k)); A.aCabelo.array.set(P.cabelo.subarray(0, 4 * k));
      A.aInfo.array.set(P.info.subarray(0, 4 * k)); A.aRumo.array.set(P.rumo.subarray(0, 2 * k));
      A.aOculto.array.fill(0, 0, k); A.aLod.array.fill(impMat ? 255 : 0, 0, k);
      for (const nome of ['aPos', 'aCamisa', 'aPele', 'aCabelo', 'aInfo', 'aRumo', 'aOculto', 'aLod']) {
        const a = A[nome];
        a.clearUpdateRanges?.(); a.addUpdateRange?.(0, k * a.itemSize); a.needsUpdate = true;
      }
    }
    perto.userData.k = k;
    perto.geometry.instanceCount = k;
    perto.material = impMat ?? material;
    perto.visible = k > 0;
  }

  // pré-carga: no 1º quadro desenhado os grupos fora do quadro (o lado de cá, os fundos) vão para a GPU com 0
  // instâncias — geometria enviada e programa pronto, nenhuma chamada de desenho —, para a 1ª vez que aparecem (um
  // corte de câmera) não engasgar nem subir a memória da GPU no meio do jogo
  let precarga = true;
  const t = {
    get mesh() { return mesh; },
    get n() { return n; },
    get qualidade() { return qualidade; },
    get animada() { return !!TORCIDA.animada[qualidade]; },
    uniforms: uni,
    /**
     * t: s (relógio do desenho); emocao: estado de emocao.js; camera: THREE.Camera; batida: relógio da batucada
     * (som.js relogioBatida, s) ou null (sem som: a organizada pula no relógio do desenho); desenha: este quadro vai
     * mesmo ser desenhado (a pré-carga espera o 1º desenhado de verdade: com o celular em pé nada é desenhado).
     */
    atualizar(tempo, emocao, camera, batida = null, desenha = true) {
      uni.uTempo.value = tempo % 3600;
      uni.uTempoOrg.value = batida != null ? batida : tempo % 3600;
      if (emocao) {
        const [a, b] = emocao.torcida;
        uni.uExcita.value.set(a.excita, b.excita);
        uni.uTensao.value.set(a.tensao, b.tensao);
        uni.uLamento.value.set(a.lamento, b.lamento);
        uni.uPalmas.value.set(a.palmas, b.palmas);
        // festa: a ola, a luz dos sinalizadores, as bandeiras e os sinalizadores (no relógio do estádio, o da agenda)
        if (emocao.festa) {
          const o = estadoOla(emocao.festa, emocao.t);
          uni.uOla.value.set(o.theta, o.largura, o.forca, o.ativa ? 1 : 0);
          const ab = aberturaBandeirao(emocao.festa, emocao.t);
          uni.uAbre.value.set(ab, ab);
          atualizarLuzFalsa(emocao.festa, emocao.t);
          bandeiras.atualizar(emocao.festa, emocao.t);
          sinalizadores.atualizar(emocao.festa, emocao.t, desenha);
          if (!festaVisivel) sinalizadores.mesh.visible = false;
        }
      }
      if (camera) {
        uni.uCamPos.value.copy(camera.position);
        // corte por arquibancada: só vai para a GPU a que a câmera vê (matriz desta posição da câmera, já); o lado de
        // cá nunca com a câmera dentro dele (a câmera de TV)
        camera.updateMatrixWorld();
        _frustum.setFromProjectionMatrix(_mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const dentro = cameraNoLadoDeCa(camera.position);
        if (mesh) {
          for (const m of grupos()) {
            const ver = !(m.userData.ladoDeCa && dentro) && _frustum.intersectsBox(m.userData.caixa);
            if (precarga && desenha && !ver) { m.visible = true; m.geometry.instanceCount = 0; } else { m.visible = ver; m.geometry.instanceCount = m.userData.k; }
          }
          if (desenha) precarga = false;
          // a malha perto (a densidade real): só com alguém; a pré-carga do programa do impostor no 1º quadro desenhado
          // depois de ligar (0 instâncias: compila, nenhuma chamada) e, no seguinte, a conferência dele
          if (perto) {
            if (precargaImp && desenha && impMat) { perto.material = impMat; perto.visible = true; perto.geometry.instanceCount = perto.userData.k; precargaImp = false; conferir = 2; }
            else { perto.visible = perto.userData.k > 0; perto.geometry.instanceCount = perto.userData.k; }
          }
          if (conferir && desenha && --conferir === 0 && opc.programas && impMat) {
            // o programa com o impostor não compilou (o celular sem algo do GLSL 3): o quadro SDF de volta, para sempre
            if (contarFalhas() > falhasAntes) desligarImpostor(true);
          }
        }
      }
    },
    /** Os torcedores de todas as qualidades (gerarTorcidaNiveis: posições, cores, sementes, nível): o torcedor 3D lê daqui. */
    get dados() { return dados; },
    /**
     * Os torcedores desenhados em 3D agora (render/torcedor3d.js: os índices de `dados`) saem do quadro — só eles (os de
     * antes voltam). Só as malhas que mudaram sobem de novo para a GPU.
     */
    ocultar(indices) {
      if (!mesh) return;
      const mudou = new Set();
      const grupoDe = i => { for (const m of grupos()) if (i >= m.userData.faixa[0] && i < m.userData.faixa[1]) return m; return null; };
      for (const i of ocultos) { oculto[i] = 0; const m = grupoDe(i); if (m) mudou.add(m); }
      ocultos = Array.from(indices ?? []);
      for (const i of ocultos) { oculto[i] = 255; const m = grupoDe(i); if (m) mudou.add(m); }
      for (const m of mudou) m.geometry.attributes.aOculto.needsUpdate = true;
    },
    /** Quantos torcedores estão fora do quadro agora (desenhados em 3D). */
    get nOcultos() { return ocultos.length; },
    // o impostor (item 69, PR 3: render/impostor.js) e a densidade real perto
    ligarImpostor, desligarImpostor, definirLod, definirPerto,
    /**
     * O impostor agora (testes): {ligado (o programa com os dois ramos existe), falhou, torcedores (em impostor), grupos
     * (os que usam o programa do impostor), perto (as pessoas da malha perto), programa (o material)}.
     */
    get impostor() {
      const gs = grupos();
      return { ligado: !!impMat, falhou: impFalhou, torcedores: emImp.length, grupos: gs.filter(m => m.material === impMat && impMat).map(m => m.name), perto: perto ? perto.userData.k : 0, precarga: precargaImp || conferir > 0, material: impMat };
    },
    /** O programa com o impostor existe (barato: a cada quadro). */
    get impostorLigado() { return !!impMat; },
    /** A malha perto (testes). */
    get malhaPerto() { return perto; },
    definirHora(h) { uni.uLuz.value.set(...(h === 'noite' ? LUZ.noite : LUZ.dia)); bandeiras.definirHora(h); sinalizadores.definirHora(h); },
    definirQualidade(q) { if (q !== qualidade && TORCIDA.ocupacao[q]) { aplicarQualidade(q); bandeiras.definirQualidade(q); sinalizadores.definirQualidade(q); } },
    /** Faixas/bandeiras/bandeirões e sinalizadores (testes e prints). */
    bandeiras, sinalizadores,
    /** Mostra/esconde a festa (faixas, bandeiras, bandeirões, sinalizadores) — conferência nos testes. */
    mostrarFesta(v) { festaVisivel = !!v; bandeiras.mesh.visible = festaVisivel; if (!festaVisivel) sinalizadores.mesh.visible = false; },
    dispose() { desmontar(); bandeiras.dispose(); sinalizadores.dispose(); },
  };
  t.definirHora(opc.hora ?? 'dia');
  return t;
}
