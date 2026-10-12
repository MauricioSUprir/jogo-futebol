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
// Festa (pedido de 11/10): a OLA (festa.js estadoOla → uOla; quem está na crista levanta com os braços em V) e a
// luz FALSA dos sinalizadores (luz-falsa.js: uniform, nunca PointLight). O LADO DE CÁ (z +) só vai para a GPU com a
// câmera fora do volume dele: a câmera de TV fica DENTRO da arquibancada do lado de cá (12,3 m de altura a até 69 m
// do meio no celular) e o teste da caixa daria verdadeiro — os torcedores de lá cobririam a tela.
import * as THREE from 'three';
import { gerarTorcidaNiveis, quantosNoSetor, atlasTorcida, TORCIDA, POSE_GLSL, CAIXA_POSE, POSE, cameraNoLadoDeCa } from './torcida-dados.js';
import { OLA_GLSL, estadoOla } from './festa.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ, atualizarLuzFalsa } from './luz-falsa.js';
import { criarBandeiras } from './bandeiras.js';
import { criarSinalizadores } from './sinalizadores.js';

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec4 aPos;
attribute vec4 aCamisa;
attribute vec4 aPele;
attribute vec4 aCabelo;
attribute vec4 aInfo;
uniform float uTempo;
uniform float uTempoOrg;
uniform float uAnimada;
uniform vec2 uExcita;
uniform vec2 uTensao;
uniform vec2 uLamento;
uniform vec2 uPalmas;
uniform vec4 uLuz;
uniform vec4 uOla;
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
${POSE_GLSL}
${OLA_GLSL}
${LUZ_FALSA_GLSL}
const vec2 CAIXA[${CAIXA_POSE.length}] = vec2[${CAIXA_POSE.length}](${CAIXA_POSE.map(([w, h]) => `vec2(${w.toFixed(3)}, ${h.toFixed(3)})`).join(', ')});
void main() {
  float time = step(0.5, aInfo.x);
  float setor = floor(aInfo.y * 3.0 + 0.5);
  bool org = aInfo.z > 0.5;
  float h = aPele.w;
  float h2 = aInfo.w;
  float ex = mix(uExcita.x, uExcita.y, time);
  float te = mix(uTensao.x, uTensao.y, time);
  float la = mix(uLamento.x, uLamento.y, time);
  float pa = mix(uPalmas.x, uPalmas.y, time);
  // a pose e o pulo: a MESMA regra de torcida-dados.js (POSE_GLSL, gerado de POSE_REGRA)
  // a organizada no relógio da batucada (pula no surdo da gravação quando o som toca)
  vec2 pp = torcidaPose(ex, te, la, pa, h, h2, org ? 1.0 : 0.0, org ? uTempoOrg : uTempo, uAnimada);
  float pose = pp.x;
  float pulo = pp.y;
  // ola: quem está na crista levanta com os braços em V (a mesma conta de festa.js olaPeso)
  float ola = torcidaOla(aPos.xz, uOla);
  if (ola > 0.45) pose = ${POSE.BRACOS_V}.0;
  pulo += ola * 0.3 * uAnimada;
  float bal = uAnimada > 0.5 ? sin(uTempo * (0.8 + h2 * 0.9) + h * 40.0) * 0.035 : 0.0;
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
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = vec2((pose + qx + 0.5) / ${TORCIDA.quadros}.0, qy);
  vCamisa = lin(aCamisa.rgb);
  vPele = lin(aPele.rgb);
  vCabelo = lin(aCabelo.rgb);
  vAcento = time > 0.5 ? uAcento1 : uAcento0;
  float luz = setor < 0.5 ? uLuz.x : (setor < 1.5 ? uLuz.y : (setor < 2.5 ? uLuz.z : uLuz.w));
  vLuz = luz * (0.88 + 0.24 * fract(h * 7.31));
  vAltura = qy;
  vFlare = luzFalsa(aPos.xyz + vec3(0.0, 1.2, 0.0));
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
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
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  // cobertura preservada de longe (mipmap tira opacidade das partes finas): sobe o alfa pelo nível do
  // mipmap (Castaño, "Computing Alpha Mipmaps"; Golus, "Anti-aliased Alpha Test")
  vec2 d = fwidth(vUv * uTamAtlas);
  float nivel = max(0.0, log2(max(max(d.x, d.y), 1e-4)));
  float a = t.a * (1.0 + 0.22 * nivel);
  if (a < 0.5) discard;
  vec3 w = t.rgb / max(t.a, 0.004);
  float ac = max(0.0, 1.0 - w.r - w.g - w.b);
  vec3 cor = w.r * vCamisa + w.g * vPele + w.b * vCabelo + ac * vAcento;
  // a fileira da frente faz sombra nas pernas; o resto pela luz do setor
  cor *= vLuz * (0.68 + 0.32 * smoothstep(0.08, 0.7, vAltura)) + vFlare;
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

// luz por setor: [lado de lá (de frente para +z), fundo +x (de frente para −x), fundo −x (para +x), lado de cá (para −z)]
function luzDoSol(sol) {
  const n = [[0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 0, -1]];
  return n.map(v => 0.62 + 0.42 * Math.max(0, v[0] * sol[0] + v[1] * sol[1] + v[2] * sol[2]));
}
const SOL_DIA = (() => { const s = [-0.42, 0.74, 0.52], l = Math.hypot(...s); return s.map(v => v / l); })();
const LUZ = { dia: luzDoSol(SOL_DIA), noite: [0.44, 0.41, 0.41, 0.42] };


/**
 * Cria a torcida. opc = {qualidade, mascara (Uint8Array das cadeiras do mosaico, ou null), hora}.
 * Devolve {mesh, n, atualizar(t, emocao, camera), definirHora(h), definirQualidade(q), dispose()}.
 */
export function criarTorcida(cena, opc) {
  const uni = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uAtlas: { value: null }, uTamAtlas: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 }, uTempoOrg: { value: 0 }, uAnimada: { value: 1 },
    uExcita: { value: new THREE.Vector2() }, uTensao: { value: new THREE.Vector2() },
    uLamento: { value: new THREE.Vector2() }, uPalmas: { value: new THREE.Vector2() },
    uLuz: { value: new THREE.Vector4(...LUZ.dia) }, uCamPos: { value: new THREE.Vector3(0, 20, 60) },
    uOla: { value: new THREE.Vector4(0, 0.16, 0, 0) },
    uFlare: UNIFORMS_LUZ.uFlare, uFlareN: UNIFORMS_LUZ.uFlareN,
    // acento (cachecol) na cor do time, linear: verde do Golaço FC, branco do Ventania FC
    uAcento0: { value: new THREE.Color(0x19e07a) }, uAcento1: { value: new THREE.Color(0xf2f4f5) },
  };
  let mesh = null, material = null, qualidade = null, n = 0, dados = null;
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4();
  function desmontar() {
    if (!mesh) return;
    cena.remove(mesh);
    for (const m of mesh.children) m.geometry.dispose();
    material?.dispose();
    uni.uAtlas.value?.dispose();
    mesh = null;
  }
  /** Monta TODOS os torcedores (os da Alta) uma vez; a qualidade só escolhe quantos desenhar. */
  function montar() {
    desmontar();
    const d = gerarTorcidaNiveis(opc.mascara ?? null);
    dados = d;
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
    material = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, fog: true });
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
      geo.instanceCount = k;
      // os quadros saem do shader: o corte é por CAIXA (os fundos são compridos: 119 m em z — uma esfera de corte
      // pegaria a câmera de TV no meio-campo), feito em atualizar() com o frustum da câmera
      const m = new THREE.Mesh(geo, material);
      m.frustumCulled = false;
      m.userData.caixa = new THREE.Box3(new THREE.Vector3(x0 - 1, y0 - 0.2, z0 - 1), new THREE.Vector3(x1 + 1, y1 + TORCIDA.altura + 0.6, z1 + 1));
      m.userData.grupo = grupo;
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
    for (const m of mesh.children) { const k = quantosNoSetor(dados, m.userData.grupo, q); m.geometry.instanceCount = k; n += k; }
    uni.uAnimada.value = TORCIDA.animada[q] ? 1 : 0;
  }
  montar();
  aplicarQualidade(TORCIDA.ocupacao[opc.qualidade] ? opc.qualidade : 'media');
  // a festa da torcida: faixas, bandeiras e bandeirões (1 chamada) e os sinalizadores (1 chamada, só no evento)
  const bandeiras = criarBandeiras(cena, { qualidade, hora: opc.hora });
  const sinalizadores = criarSinalizadores(cena, { qualidade, hora: opc.hora });
  let festaVisivel = true;
  const t = {
    get mesh() { return mesh; },
    get n() { return n; },
    get qualidade() { return qualidade; },
    get animada() { return !!TORCIDA.animada[qualidade]; },
    uniforms: uni,
    /**
     * t: s (relógio do desenho); emocao: estado de emocao.js; camera: THREE.Camera; batida: relógio da batucada
     * (som.js relogioBatida, s) ou null (sem som: a organizada pula no relógio do desenho).
     */
    atualizar(tempo, emocao, camera, batida = null) {
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
          atualizarLuzFalsa(emocao.festa, emocao.t);
          bandeiras.atualizar(emocao.festa, emocao.t);
          sinalizadores.atualizar(emocao.festa, emocao.t);
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
        if (mesh) for (const m of mesh.children) m.visible = !(m.userData.ladoDeCa && dentro) && _frustum.intersectsBox(m.userData.caixa);
      }
    },
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
