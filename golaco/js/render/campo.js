// Campo oficial (IFAB Lei 1, medidas em CAMPO): gramado com faixas de corte, linhas finas
// com antisserrilhado analítico (um único mesh), gols com a rede VÉU DE NOIVA branca que BALANÇA (malha subdividida, a
// deformação no vertex shader pela conta de rede-onda.js — uniforms de até 4 batidas), bandeirinhas,
// placas com marcas FICTÍCIAS e arquibancada (a torcida é de torcida.js). Poucos draw calls: tudo o que
// é estático vira um mesh só por material.
import * as THREE from 'three';
import { CAMPO, ESTADIO } from '../config.js';
import { juntarGeometrias, cilindroEntre, caixa, atributosFino } from './util.js';
import {
  GRAMA, texGramadoAntigo, texManchasGramado, texDetalheGrama, texPlacas, PLACA, texArquibancada, ARQ, texBandeira, texBrilho, mascaraTexto,
} from './texturas.js';
import { valoresGramado, GRAMADO_HORAS, gFocoDe, rasanteDaCamera } from './gramado.js';
import { shaderGramado, shaderGramadoAntigo, shaderLinhas, aplicarTrocas } from './gramado-shader.js';
import { GRAFICOS } from './graficos-opcoes.js';
import { imagemEscudo } from './escudo-desenho.js';
import { REDE_GLSL, fixo as fixoRede, REDE } from './rede-onda.js';
import { VEU, COMPRIMENTO_PERFIL, pontoPerfil, profundidadeVeu } from '../rede-forma.js';
// trama da rede (m): colmeia de 12 cm com fio de 6 mm; o fio não afina abaixo de ~1 px, só fica até uRedeMin mais
// transparente; longe (célula < ~2 px) vira um véu branco de opacidade `longe`
export const REDE_TRAMA = { celula: 0.12, fio: 0.006, opacMin: 0.85, longe: 0.32 };
// luz própria (emissive) da rede e da armação, de dia e de noite: a face que a câmera vê fica de costas para o sol e,
// à noite, só pega a luz fraca dos refletores — sem isto o fio saía cinza (L* 79 de dia, 50 à noite, de perto)
export const LUZ_GOL = { redeDia: 0xaaadab, redeNoite: 0xaaadab, armDia: 0x2a2c2b, armNoite: 0x5a5c5b };
import { cameraNoLadoDeCa } from './torcida-dados.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ } from './luz-falsa.js';
import { retasAreaTecnica } from '../estadio-forma.js';
import { fileirasGolaco, gradeGolaco, pintorGolaco, TUNEL, CADEIRAS3D, DEGRAU_LOD, ESCADA_TUNEL, escadaDoPoste } from './cadeiras-dados.js';

const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const L = CAMPO.linha, h = L / 2;
// meia-largura da GEOMETRIA da linha (a linha pintada tem h = 6 cm; o resto é margem para o
// antisserrilhado quando a linha fica com menos de 1 px na tela — "phone-wire AA", Humus)
const HG = 0.45;

// ------------------------------------------------------------------ material da grama

// 0 = dia, 1 = noite (compartilhado pelos materiais do chão): à noite a luz dos refletores
// forma um "poço" de luz — gramado mais claro no meio e caindo para as bordas e o entorno.
// (o luzNoite do shader: render/gramado-shader.js LUZ_NOITE_GLSL)
const uNoite = { value: 0 };

/**
 * O gramado e o chão de fora de ANTES do item 45 (só o `?gfx=antigo`): o grão (textura de detalhe em coordenadas do mundo,
 * duas escalas) e o poço de luz da noite por cima da cor do material/textura. O MESMO texto de shader e a mesma chave da main
 * (render/gramado-shader.js shaderGramadoAntigo; o teste-gramado confere pelo hash gravado da main).
 */
function comDetalheAntigo(mat, detalhe, forca) {
  const S = shaderGramadoAntigo(forca);
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uForca = { value: forca };
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = aplicarTrocas(sh.vertexShader, S.vertex, 'gramado antigo, vertex');
    sh.fragmentShader = aplicarTrocas(sh.fragmentShader, S.fragment, 'gramado antigo, fragment');
  };
  mat.customProgramCacheKey = () => S.chave;
  return mat;
}

/**
 * O gramado no shader (item 45, `PLANO-GRAFICOS.md` passos 2 e 3): os textos em render/gramado-shader.js shaderGramado (puro: o
 * teste-gramado confere o shader montado — as derivadas antes de qualquer desvio, as chaves). `faixas` = a cor inteira do
 * gramado pela conta (as 18 faixas da UEFA, o desgaste, as manchas, o entorno); sem ela (o chão de fora), só o grão e a noite
 * por cima da cor do material. `profundidade` = a profundidade relativa ao foco (no gramado e no chão de fora). `uniforms`: os
 * do gramado (render/gramado.js valoresGramado; os MESMOS objetos nos dois materiais), que o campo muda na troca da hora e, o
 * uGFoco e o uRasante, por quadro; 0 chamada a mais.
 */
function comDetalhe(mat, detalhe, forca, { faixas = false, profundidade = false, uniforms = null } = {}) {
  const S = shaderGramado(forca, { faixas, profundidade });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uForca = { value: forca };
    sh.uniforms.uNoite = uNoite;
    if (faixas || profundidade) Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = aplicarTrocas(sh.vertexShader, S.vertex, 'gramado, vertex');
    sh.fragmentShader = aplicarTrocas(sh.fragmentShader, S.fragment, 'gramado, fragment');
  };
  mat.customProgramCacheKey = () => S.chave;
  return mat;
}

/** Os uniforms do gramado no shader (render/gramado.js): os valores de uma hora num objeto de uniforms do three. */
function uniformsGramado(hora) {
  const u = {};
  for (const [k, val] of Object.entries(valoresGramado(hora))) u[k] = { value: Array.isArray(val) ? new THREE.Vector3(...val) : val };
  return u;
}
function horaGramado(u, hora) {
  for (const [k, val] of Object.entries(valoresGramado(hora))) {
    if (k === 'uGFoco') continue; // escrito por quadro (focador)
    if (Array.isArray(val)) u[k].value.set(...val); else u[k].value = val;
  }
}

/**
 * O onBeforeRender do gramado e do chão de fora (item 45, C7): o uGFoco = o g da profundidade no ponto do chão no meio da tela
 * (render/gramado.js gFocoDe) e o uRasante = o da hora (`base()`: 0 com o gancho semProfundidade) apagado pela altura da
 * câmera (render/gramado.js rasanteDaCamera: nada abaixo de 3 m, inteiro de 8 m para cima — a revisão do C4–C8: nas câmeras
 * baixas o foco cai longe do assunto), pela câmera que vai desenhar — vale para TODA câmera (TV, replay, cinema, Livre,
 * pré-jogo) sem fio no main.js. O three sobe os uniforms do material no 1º desenho dele em cada render() (o
 * `_currentMaterialId` volta a −1 no fim de cada um), depois deste gancho; a sombra usa o onBeforeShadow, que não passa aqui.
 */
function focador(u, base) {
  const o = [0, 0, 0], d = [0, 0, 0];
  return (renderer, cena, camera) => {
    const e = camera.matrixWorld.elements;
    o[0] = e[12]; o[1] = e[13]; o[2] = e[14];
    d[0] = -e[8]; d[1] = -e[9]; d[2] = -e[10];
    u.uGFoco.value = gFocoDe(o, d);
    u.uRasante.value = rasanteDaCamera(base(), o[1]);
  };
}

// ------------------------------------------------------------------ linhas

/**
 * As linhas do campo (um mesh só, antisserrilhado analítico). `uGramado` (os uniforms do gramado no shader; null no
 * `?gfx=antigo`): as linhas mais brancas pelo `uBrancoLinha` (item 45, C7: o ACES do r170 acinzentava o branco — pico L 0,908 —;
 * × 1,8 de dia no albedo dá o pico 0,952, a G5, sem `toneMapped = false`, que dava 0,98 e quebrava a noite).
 */
function criarLinhas(detalhe, uGramado = null) {
  const pos = [], cruz = [], idx = [];
  const y = 0.012;
  function quad(ax, az, bx, bz, ca, cb) {
    // segmento reto da linha central A→B; ca/cb = deslocamento lateral de cada borda
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    const i0 = pos.length / 3;
    pos.push(ax + nx * ca, y, az + nz * ca, bx + nx * ca, y, bz + nz * ca, bx + nx * cb, y, bz + nz * cb, ax + nx * cb, y, az + nz * cb);
    cruz.push(ca, ca, cb, cb);
    idx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  function reta(ax, az, bx, bz) {
    // estende h nas pontas para os cantos fecharem
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const ux = dx / l, uz = dz / l;
    quad(ax - ux * h, az - uz * h, bx + ux * h, bz + uz * h, -HG, HG);
  }
  function arco(cx, cz, rc, a0, a1, n) {
    if (a1 < a0) { const t = a0; a0 = a1; a1 = t; } // sempre no sentido que mantém a face para cima
    const r0 = Math.max(0, rc - HG), r1 = rc + HG;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * (i / n), t1 = a0 + (a1 - a0) * ((i + 1) / n);
      const i0 = pos.length / 3;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      pos.push(cx + c0 * r0, y, cz + s0 * r0, cx + c1 * r0, y, cz + s1 * r0, cx + c1 * r1, y, cz + s1 * r1, cx + c0 * r1, y, cz + s0 * r1);
      cruz.push(r0 - rc, r0 - rc, r1 - rc, r1 - rc);
      idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
  }
  // linhas laterais e de fundo (a linha pertence à área que delimita: borda externa na medida)
  reta(-MX, -(MZ - h), MX, -(MZ - h));
  reta(-MX, MZ - h, MX, MZ - h);
  reta(-(MX - h), -MZ, -(MX - h), MZ);
  reta(MX - h, -MZ, MX - h, MZ);
  // linha do meio, círculo central e marca central
  reta(0, -MZ + L, 0, MZ - L);
  arco(0, 0, CAMPO.raioCirculo - h, 0, Math.PI * 2, 160);
  arco(0, 0, 0.055, 0, Math.PI * 2, 20);
  for (const s of [-1, 1]) {
    // grande área
    const ax = s * (MX - CAMPO.area.profundidade + h), az = CAMPO.area.largura / 2 - h;
    reta(ax, -az, ax, az);
    reta(s * MX, -az, ax, -az);
    reta(s * MX, az, ax, az);
    // pequena área
    const px = s * (MX - CAMPO.pequenaArea.profundidade + h), pz = CAMPO.pequenaArea.largura / 2 - h;
    reta(px, -pz, px, pz);
    reta(s * MX, -pz, px, -pz);
    reta(s * MX, pz, px, pz);
    // marca do pênalti
    const mx = s * (MX - CAMPO.marcaPenalti);
    arco(mx, 0, 0.055, 0, Math.PI * 2, 20);
    // meia-lua: parte do círculo de 9,15 m em volta da marca que fica fora da área
    const rc = CAMPO.raioArco - h;
    const lim = Math.acos((CAMPO.area.profundidade - CAMPO.marcaPenalti) / rc);
    const centro = s > 0 ? Math.PI : 0;
    arco(mx, 0, rc, centro - lim, centro + lim, 64);
    // arcos de escanteio (quarto de círculo para dentro do campo)
    for (const t of [-1, 1]) {
      const cx = s * MX, cz = t * MZ;
      const a0 = Math.atan2(-t, 0), a1 = Math.atan2(0, -s);
      let da = a1 - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      arco(cx, cz, CAMPO.raioEscanteio - h, a0, a0 + da, 16);
    }
  }
  // as duas ÁREAS TÉCNICAS (IFAB Regra 1; estadio-forma.js retasAreaTecnica: 3 linhas de cada, para dentro da área, na
  // mesma malha — nenhuma chamada de desenho a mais): cada retângulo vira a linha central dele, sem esticar as pontas
  for (const r of retasAreaTecnica()) {
    if (r.x1 - r.x0 >= r.z1 - r.z0) { const zc = (r.z0 + r.z1) / 2; quad(r.x0, zc, r.x1, zc, -HG, HG); }
    else { const xc = (r.x0 + r.x1) / 2; quad(xc, r.z0, xc, r.z1, -HG, HG); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('aCruz', new THREE.Float32BufferAttribute(cruz, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf3f6f1, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const S = shaderLinhas({ branco: !!uGramado });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uMeia = { value: h };
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uNoite = uNoite;
    if (uGramado) sh.uniforms.uBrancoLinha = uGramado.uBrancoLinha;
    sh.vertexShader = aplicarTrocas(sh.vertexShader, S.vertex, 'linhas, vertex');
    sh.fragmentShader = aplicarTrocas(sh.fragmentShader, S.fragment, 'linhas, fragment');
  };
  mat.customProgramCacheKey = () => S.chave;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'linhas';
  return mesh;
}

// ------------------------------------------------------------------ gols

/**
 * A LARGURA MÍNIMA das peças finas do gol (item 45, C9; `PLANO-GRAFICOS.md` passo 5, o "phone-wire AA" do Humus): hastes do véu,
 * cordas do pé e do fundo, mastros das bandeirinhas e as tampas deles ficam a 0,3–0,9 px na TV do celular e saíam TRACEJADAS
 * (abaixo de 1 px a peça cai entre os centros dos pixels ou das amostras e some aos pedaços). No vértice a peça cresce no corte
 * (crescer o raio do círculo por k cresce a silhueta na tela por k em qualquer direção da câmera) e a COBERTURA esmaece o que
 * cresceu, pelo MSAA do contexto que desenha:
 * - com MSAA: até `largMin` px EXATO, alfa = largura real ÷ largura nova, em alfa para cobertura (A2C, sem ordenar). Com 1 px
 *   exato as 4 amostras cobrem a faixa uma vez cada, e a A2C (no SwiftShader por degraus fixos, alfa ≥ 0,2 / 0,4 / 0,6 / 0,8,
 *   sem pontilhado) mostra o mesmo tanto com a câmera andando; a corda deitada cresce a partir do contato com o chão (aChao);
 * - sem MSAA (a Baixa): mistura com cobertura ANALÍTICA, como as linhas do campo: a peça cresce até a meia largura + `franja`
 *   px e cada pixel leva a fração da faixa de verdade na caixa dele, no eixo menor da tela (a soma por coluna é a largura da
 *   faixa). Com 1 px e o alfa constante, cada coluna acendia 1 ou 2 pixels inteiros e a corda do fundo, em diagonal, cintilava
 *   ×2,2 o SSAA. Em TODO vértice fino, com qualquer largura (a revisão do bloco 3): com um limiar (só abaixo de 2 px), a peça
 *   que cruzava o limiar entre as duas pontas interpolava um vértice analítico com um de fora (a meia largura de −1 a ~1, o
 *   lado de 0 a ±2) e abria um BURACO onde a meia interpolada passava por 0 — na Baixa, nas câmeras perto do gol (a corda do pé
 *   a 1,09/0,89 px nas pontas: 31 faixas de 1 px com menos da metade do físico, a pior 0,02). Sem o limiar o crescimento
 *   (meia + franja) ÷ meia vai a 1 sozinho nas peças grossas, sem salto (o mesmo caso: a pior 0,95).
 * Postes e travessão (≥ 1,6 px mesmo na Baixa do gol de lá) não crescem. O px vem do `uAlturaBuffer` (a altura do buffer onde
 * se desenha, no onBeforeRender da malha: acompanha a rotação, a queda de 1,5 para 1 e a recriação sem gancho).
 */
export const FINOS = Object.freeze({ largMin: 1, franja: 1 });
// os lados do prisma fino (antes 5 nas cordas, 8 no resto): com 16 a largura na tela varia só 2% com o giro (2r × cos(π/16) a 2r);
// a A2C só fica parada a 1 px EXATO, e o octógono do mastro de frente para a TV dava 1,08 px (×1,96)
const SEGS_FINO = 16;

/** Os textos do shader dos finos (sem derivada nem leitura de textura: nada a conferir na ordem dos desvios). uModoFino: 0 =
 *  físico (a peça de verdade), 1 = A2C (com MSAA), 2 = mistura analítica (sem MSAA). */
const SHADER_FINOS = {
  vertex: [
    ['#include <common>', `#include <common>
      attribute float aFino;
      attribute vec3 aEixo;
      attribute vec3 aDir;
      attribute float aChao;
      uniform float uAlturaBuffer;
      uniform float uLargMin;
      uniform float uFranja;
      uniform float uModoFino;
      varying float vCob;
      varying float vLado;
      varying float vMeia;
      varying float vCos;`],
    ['#include <begin_vertex>', `#include <begin_vertex>
      vCob = 1.0; vLado = 0.0; vMeia = -1.0; vCos = 1.0;
      if (aFino > 0.0 && uModoFino > 0.5) {
        // px por metro na profundidade do eixo: P[1][1] × H/2 ÷ w (perspectiva e ortográfica)
        vec4 cE = projectionMatrix * modelViewMatrix * vec4(aEixo, 1.0);
        float pxM = projectionMatrix[1][1] * uAlturaBuffer * 0.5 / max(cE.w, 1e-4);
        float meiaPx = aFino * pxM;
        if (uModoFino < 1.5) {
          float k = uLargMin / max(2.0 * meiaPx, 1e-4);
          if (k > 1.0) {
            vec3 c = aEixo - vec3(0.0, aChao * aFino, 0.0);
            transformed = c + (transformed - c) * k;
            vCob = 1.0 / k;
          }
        } else {
          transformed = aEixo + (transformed - aEixo) * ((meiaPx + uFranja) / max(meiaPx, 1e-4));
          // a tela em px (x pelo aspecto): o eixo projetado, a normal dele e a distância lateral deste vértice ao eixo
          float asp = projectionMatrix[1][1] / projectionMatrix[0][0];
          vec4 cD = projectionMatrix * modelViewMatrix * vec4(aEixo + aDir * 0.05, 1.0);
          vec4 cV = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
          vec2 sE = vec2(cE.x * asp, cE.y) / cE.w;
          vec2 A = vec2(cD.x * asp, cD.y) / cD.w - sE;
          float lA = length(A);
          A = lA > 1e-9 ? A / lA : vec2(1.0, 0.0);
          vLado = dot(vec2(cV.x * asp, cV.y) / cV.w - sE, vec2(-A.y, A.x)) * uAlturaBuffer * 0.5;
          vMeia = meiaPx;
          vCos = max(abs(A.x), abs(A.y));
        }
      }`],
  ],
  fragment: [
    ['#include <common>', `#include <common>
      varying float vCob;
      varying float vLado;
      varying float vMeia;
      varying float vCos;`],
    ['#include <color_fragment>', `#include <color_fragment>
      {
        // a cobertura: a fração da caixa do pixel no eixo menor da tela (meia altura vCos/2 na distância lateral) que cai na
        // faixa de verdade (|lado| ≤ vMeia); fora do modo analítico, a do vértice
        float cob = vCob;
        if (vMeia >= 0.0) {
          float hc = 0.5 * vCos;
          cob = clamp(min(vLado + hc, vMeia) - max(vLado - hc, -vMeia), 0.0, vCos) / vCos;
          if (cob < 0.004) discard;
        }
        diffuseColor.a *= cob;
      }`],
  ],
  chave: 'gols-finos-v2',
};

function criarGols(antigo = false) {
  const g = CAMPO.gol;
  const R = g.raioPoste;
  const zp = g.largura / 2 + R;          // centro do poste (igual a bola.js)
  const yt = g.altura + R;               // centro do travessão
  const geos = [], cores = [];
  const branco = new THREE.Color(0xf7f9f8), preto = new THREE.Color(0x1a1d1e);
  const zl = g.largura / 2, H = VEU.haste, F = VEU.fundo;
  // uma peça: o cilindro de a a b com os atributos da largura mínima. Fina = cresce abaixo de FINOS.largMin px, com SEGS_FINO
  // lados; as pontas FECHADAS onde ficam à vista (a revisão do bloco 3: o material só desenha a frente das faces, e a ponta
  // aberta virava um anel com o fundo aparecendo — a ponta de trás da haste e a da frente da corda do pé, a 1,41 raio do eixo
  // do poste, 100% expostas; as das cordas, 46%; no plano 'atras' do replay a boca da haste tinha 5–8 px). Só o mastro fica
  // aberto: o pé no plano do chão (a boca para baixo) e a cabeça dentro da tampa dele. No `?gfx=antigo`, os lados (`velho`)
  // e as tampas de antes
  const peca = (a, b, raio, velho, cor, { fino = true, noChao = false, tampa = !fino } = {}) => {
    const segs = fino && !antigo ? SEGS_FINO : velho;
    geos.push(atributosFino(cilindroEntre(a, b, raio, segs, !tampa && !antigo), a, b, fino ? raio : 0, { noChao, segs }));
    cores.push(cor);
  };
  for (const s of [-1, 1]) {
    const x = s * MX;
    for (const t of [-1, 1]) {
      peca([x, 0, t * zp], [x, yt + R, t * zp], R, 16, branco, { fino: false });
      // haste do canto de cima (véu de noiva): do alto do poste para trás, segura a faixa de cima da rede
      peca([x, yt, t * zp], [x + s * H, g.altura + 0.02, t * zl], 0.028, 8, branco, { tampa: true });
      // pé da lateral no chão (corda presa por estacas), do poste até o fundo do véu
      peca([x + s * R, 0.012, t * zl], [x + s * F, 0.012, t * zl], 0.012, 5, branco, { noChao: true, tampa: true });
      // mastro da bandeirinha e a tampa dele
      peca([x, 0, t * MZ], [x, 1.55, t * MZ], 0.018, 8, branco);
      peca([x, 1.55, t * MZ], [x, 1.57, t * MZ], 0.022, 8, preto, { tampa: true });
    }
    peca([x, yt, -zp - R], [x, yt, zp + R], R, 16, branco, { fino: false });
    // fundo do véu preso no chão (corda e estacas)
    peca([x + s * F, 0.012, -zl], [x + s * F, 0.012, zl], 0.014, 5, branco, { noChao: true, tampa: true });
  }
  const matArm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: LUZ_GOL.armDia });
  const estrutura = new THREE.Mesh(juntarGeometrias(geos, cores), matArm);
  estrutura.name = 'gols';
  const finos = larguraMinima(estrutura, antigo);
  const rede = criarRede();
  return { estrutura, rede: rede.mesh, uniformsRede: rede.uniforms, matArm, matRede: rede.mesh.material, finos };
}

/**
 * O shader e o esmaecimento da largura mínima numa malha de finos (render/util.js atributosFino). Controles: definirAA(amostras)
 * = o modo pelo SAMPLES do contexto que desenha (nunca o nome da qualidade: a queda deixa a Baixa num contexto com MSAA) — ≥ 2:
 * A2C (lista opaca); < 2: mistura (transparente, escrevendo a profundidade, renderOrder 1; a rede continua no 2: a franja quase
 * transparente esconde a rede atrás dela — medido na Baixa com o teste-rede-tela, os finos depois da rede mudavam o "clareia o gol
 * na TV" de ΔL* 17,4 a 17,6 de dia e 18,2 a 18,5 à noite, e nada nas câmeras de perto: não pesa, fica); fisico(bool) =
 * os desenhos seguintes SEM os truques (a peça de verdade, opaca: as referências e as máscaras dos testes). Os dois mudam o
 * material FORA do desenho (o `transparent` decide a lista no projectObject, antes do onBeforeRender), sempre escrevem tudo (um
 * material estragado por fora volta ao certo) e só pedem o programa novo quando algo mudou. `antigo` (`?gfx=antigo`): o
 * material de antes, sem shader nem modos.
 */
function larguraMinima(mesh, antigo = false) {
  const mat = mesh.material;
  if (antigo) return { definirAA() {}, fisico() {}, get estado() { return { modo: 'antigo', amostras: null, largMin: null }; } };
  const U = { uAlturaBuffer: { value: 1 }, uLargMin: { value: FINOS.largMin }, uFranja: { value: FINOS.franja }, uModoFino: { value: 0 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = aplicarTrocas(sh.vertexShader, SHADER_FINOS.vertex, 'gols (finos), vertex');
    sh.fragmentShader = aplicarTrocas(sh.fragmentShader, SHADER_FINOS.fragment, 'gols (finos), fragment');
  };
  mat.customProgramCacheKey = () => SHADER_FINOS.chave;
  // (os testes acham o uniform aqui: teste-graficos-pagina R4)
  mat.userData.uAlturaBuffer = U.uAlturaBuffer;
  mesh.onBeforeRender = renderer => {
    const alvo = renderer.getRenderTarget();
    U.uAlturaBuffer.value = alvo ? alvo.height : renderer.getContext().drawingBufferHeight;
  };
  let amostras = 0, fisico = false;
  const aplicar = () => {
    const a2c = !fisico && amostras >= 2, mistura = !fisico && amostras < 2;
    const mudou = mat.alphaToCoverage !== a2c || mat.transparent !== mistura;
    mat.alphaToCoverage = a2c;
    mat.transparent = mistura;
    mat.depthWrite = true;
    mesh.renderOrder = mistura ? 1 : 0;
    U.uModoFino.value = fisico ? 0 : a2c ? 1 : 2;
    if (mudou) mat.needsUpdate = true;
  };
  aplicar();
  return {
    definirAA(n) { amostras = n | 0; aplicar(); },
    fisico(v) { fisico = !!v; aplicar(); },
    get estado() { return { modo: fisico ? 'fisico' : amostras >= 2 ? 'a2c' : 'mistura', amostras, largMin: U.uLargMin.value }; },
  };
}

/**
 * Rede VÉU DE NOIVA dos dois gols (forma de ../rede-forma.js, a mesma da física da bola): o véu (faixa de cima +
 * a curva até o chão, na largura toda) e as duas laterais (do poste até o véu), numa malha a ~15 cm com dois
 * atributos por vértice — aFixo (0 na armação: rede-onda.js fixo) e aUvM (coordenadas em METROS sobre o tecido,
 * para a trama colmeia do fragment shader). O vertex shader empurra o vértice com o campo vetorial redeDesloc
 * (REDE_GLSL) e refaz a normal pela inclinação da bolsa. A trama é procedural (sem textura): hexágonos com fio
 * que nunca fica mais fino que ~1 px (só mais transparente) e, longe, um véu branco uniforme (sem moiré).
 */
function criarRede() {
  const g = CAMPO.gol;
  const PASSO_MALHA = 0.15;
  const zl = g.largura / 2, ya = g.altura;
  const pos = [], nrm = [], uvm = [], fixa = [], idx = [];
  const _o = { X: 0, y: 0, nx: 0, ny: 0, s: 0 };
  for (const s of [-1, 1]) {
    // véu: u na largura (z), v ao longo do perfil (s)
    const na = Math.round(g.largura / PASSO_MALHA), nb = Math.round(COMPRIMENTO_PERFIL / PASSO_MALHA);
    let base = pos.length / 3;
    for (let b = 0; b <= nb; b++) {
      pontoPerfil(b / nb * COMPRIMENTO_PERFIL, _o);
      for (let a = 0; a <= na; a++) {
        const z = -zl + a / na * g.largura, x = s * (MX + _o.X), y = _o.y;
        pos.push(x, y, z); nrm.push(-s * _o.nx, -_o.ny, 0); uvm.push(z + zl, _o.s);
        fixa.push(fixoRede(x, y, z));
      }
    }
    for (let b = 0; b < nb; b++) for (let a = 0; a < na; a++) {
      const k = base + b * (na + 1) + a;
      idx.push(k, k + 1, k + na + 2, k, k + na + 2, k + na + 1);
    }
    // laterais: X = a · profundidade(y) (colunas em leque), y de 0 a HG
    for (const t of [-1, 1]) {
      const nx = Math.round(VEU.fundo / PASSO_MALHA), ny = Math.round(ya / PASSO_MALHA);
      base = pos.length / 3;
      for (let b = 0; b <= ny; b++) {
        const y = b / ny * ya, prof = profundidadeVeu(y);
        for (let a = 0; a <= nx; a++) {
          const X = a / nx * prof, x = s * (MX + X), z = t * zl;
          pos.push(x, y, z); nrm.push(0, 0, -t); uvm.push(X, y);
          fixa.push(fixoRede(x, y, z));
        }
      }
      for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
        const k = base + b * (nx + 1) + a;
        idx.push(k, k + 1, k + nx + 2, k, k + nx + 2, k + nx + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aUvM', new THREE.Float32BufferAttribute(uvm, 2));
  geo.setAttribute('aFixo', new THREE.Float32BufferAttribute(fixa, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += REDE.ampMax + 0.2;
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf2f4f3, emissive: LUZ_GOL.redeDia, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const uniforms = {
    uRedeA: { value: new Float32Array(4 * REDE.maxImpactos) }, uRedeB: { value: new Float32Array(4 * REDE.maxImpactos).fill(-1) },
    uRedeCel: { value: REDE_TRAMA.celula }, uRedeFio: { value: REDE_TRAMA.fio }, uRedeMin: { value: REDE_TRAMA.opacMin }, uRedeLonge: { value: REDE_TRAMA.longe },
  };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFixo;\nattribute vec2 aUvM;\nvarying vec2 vUvM;' + REDE_GLSL)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 redeD = vec3(0.0);
        if (aFixo > 0.0) {
          redeD = redeDesloc(position) * aFixo;
          if (dot(redeD, redeD) > 0.0) {
            vec3 nP = -objectNormal;
            vec3 ta = normalize(abs(nP.y) < 0.9 ? cross(nP, vec3(0.0, 1.0, 0.0)) : cross(nP, vec3(1.0, 0.0, 0.0)));
            vec3 tb = cross(nP, ta);
            vec3 da = redeDesloc(position + ta * 0.1) * aFixo - redeD;
            vec3 db = redeDesloc(position + tb * 0.1) * aFixo - redeD;
            vec3 n2 = normalize(cross(ta * 0.1 + da, tb * 0.1 + db));
            objectNormal = dot(n2, objectNormal) < 0.0 ? -n2 : n2;
          }
        }
        vUvM = aUvM;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += redeD;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUvM;
        uniform float uRedeCel, uRedeFio, uRedeMin, uRedeLonge;
        // trama colmeia (hexágonos de ponta para cima, distância entre lados = 1 célula)
        float redeHexBorda(vec2 p) {
          vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
          vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          g = abs(g);
          return 0.5 - max(dot(g, vec2(0.5, 0.8660254)), g.x);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 pc = vUvM / uRedeCel;
          float e = redeHexBorda(pc);
          float fw = max(length(vec2(dFdx(pc.x), dFdy(pc.x))), length(vec2(dFdx(pc.y), dFdy(pc.y))));
          float w = 0.5 * uRedeFio / uRedeCel;
          float wd = max(w, 0.6 * fw);
          float a = 1.0 - smoothstep(wd - 0.5 * fw, wd + 0.5 * fw, e);
          a *= clamp(w / wd, uRedeMin, 1.0);
          a = mix(a, uRedeLonge, smoothstep(0.3, 0.75, fw));
          diffuseColor.a *= a;
          if (diffuseColor.a < 0.01) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'rede-veu';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rede';
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

// ------------------------------------------------------------------ bandeirinhas

function criarBandeiras(ident = null) {
  const pos = [], uv = [], nrm = [], ond = [];
  const W = 0.42, H = 0.3, NS = 6;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const x = s * MX, z = t * MZ;
    // a bandeira aponta para fora do campo, na direção da linha de fundo
    const dx = s, dz = 0;
    for (let i = 0; i < NS; i++) {
      const u0 = i / NS, u1 = (i + 1) / NS;
      const quadr = [[u0, 0], [u1, 0], [u1, 1], [u0, 0], [u1, 1], [u0, 1]];
      for (const [u, v] of quadr) {
        pos.push(x + dx * u * W, 1.55 - H + v * H, z + dz * u * W);
        uv.push(s > 0 ? u : 1 - u, v);
        nrm.push(0, 0, 1);
        ond.push(u);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aOnda', new THREE.Float32BufferAttribute(ond, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ map: texBandeira(ident ? ident.escanteio : null), side: THREE.DoubleSide });
  const tempo = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTempo = tempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aOnda;\nuniform float uTempo;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fase = transformed.x * 1.7 + transformed.z * 0.9;
        transformed.z += sin(uTempo * 6.0 - aOnda * 7.0 + fase) * 0.05 * aOnda;
        transformed.y -= aOnda * aOnda * 0.03;`);
  };
  mat.customProgramCacheKey = () => 'bandeira';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bandeiras';
  return { mesh, tempo };
}

// ------------------------------------------------------------------ placas

function criarPlacas(aniso, ident = null) {
  const PX = MX + CAMPO.entorno, PZ = MZ + CAMPO.entorno;
  const A = PLACA.altura;
  const pos = [], uv = [], nrm = [];
  let u0 = 0;
  function face(ax, az, bx, bz, nx, nz) {
    const l = Math.hypot(bx - ax, bz - az);
    const u1 = u0 + l / PLACA.periodo;
    pos.push(ax, 0, az, bx, 0, bz, bx, A, bz, ax, 0, az, bx, A, bz, ax, A, az);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    for (let k = 0; k < 6; k++) nrm.push(nx, 0, nz);
    u0 = u1;
  }
  // lado de lá (z−), lado de cá (z+) e fundos (x±), viradas para o campo
  const d = 0.02; // a face de LED fica 2 cm à frente da caixa (sem z-fighting)
  face(-PX, -PZ + d, PX, -PZ + d, 0, 1);
  face(PX, PZ - d, -PX, PZ - d, 0, -1);
  face(PX - d, -PZ, PX - d, PZ, -1, 0);
  face(-PX + d, PZ, -PX + d, -PZ, 1, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.computeBoundingSphere();
  // LED: material sem luz (a placa brilha sozinha), mais forte à noite
  const mat = new THREE.MeshBasicMaterial({ map: ident ? texPlacas(aniso, ident.paineis, [imagemEscudo(ident, 0), imagemEscudo(ident, 1)]) : texPlacas(aniso), color: 0xdddddd, fog: false });
  const frente = new THREE.Mesh(geo, mat);
  frente.name = 'placas';
  const E = 0.12;
  const preto = new THREE.Color(0x0b0d0e);
  const caixas = [
    caixa(0, A / 2, -PZ - E / 2, PX * 2 + E * 2, A, E), caixa(0, A + 0.02, -PZ - E / 2, PX * 2 + E * 2, 0.04, E + 0.02),
    caixa(PX + E / 2, A / 2, 0, E, A, PZ * 2), caixa(PX + E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
    caixa(-PX - E / 2, A / 2, 0, E, A, PZ * 2), caixa(-PX - E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
  ];
  const cores = caixas.map(() => preto);
  // lado de cá: a câmera de TV vê as COSTAS destas placas embaixo da tela (lateral e escanteio do lado de cá) —
  // antes uma faixa preta; agora o acolchoado verde da cor do gramado de fora (a face vertical recebe ~0,7 da luz do
  // chão: o verde é ~1,4× mais claro que o 0x2c5a26 do chão) em painéis de 6 m alternados, com um friso verde —
  // some no gramado atrás delas (pedido de 11/10)
  const verdes = [new THREE.Color(0x3b7a35), new THREE.Color(0x36722f)], friso = new THREE.Color(0x4f9a47);
  const painel = PLACA.periodo / 4, x0 = -PX - E, total = 2 * (PX + E);
  for (let k = 0, x = x0; x < x0 + total - 1e-6; k++, x += painel) {
    const w = Math.min(painel, x0 + total - x);
    caixas.push(caixa(x + w / 2, A / 2, PZ + E / 2, w, A, E)); cores.push(verdes[k % 2]);
  }
  caixas.push(caixa(0, A + 0.02, PZ + E / 2, PX * 2 + E * 2, 0.04, E + 0.02)); cores.push(friso);
  const corpo = new THREE.Mesh(juntarGeometrias(caixas, cores), new THREE.MeshLambertMaterial({ vertexColors: true }));
  corpo.name = 'placas-estrutura';
  return { frente, corpo, mat };
}

/**
 * Bancos de reservas (config.js ESTADIO.bancos): um de cada lado do túnel, atrás das placas do lado de cá, abertos para
 * o campo (parede do fundo, laterais, cobertura, assento e encosto verdes). Vão na MALHA do lado de cá (`L`, retalhos da
 * textura das cadeiras × cor por vértice): com a câmera de TV dentro da arquibancada de cá eles saem do desenho junto
 * com ela — no celular a TV fica mais alta e mais atrás, e a cobertura aparecia como uma placa lisa no canto de baixo.
 */
function bancosDeReservas(L, CU, CV, VERDE) {
  const B = ESTADIO.bancos;
  const [za, zb] = B.z, h = B.altura, prof = zb - za, zc = (za + zb) / 2;
  const concreto = (cx, cy, cz, w, a, d, c) => caixaL(L, cx, cy, cz, w, a, d, CU, CV, c);
  const verde = (cx, cy, cz, w, a, d, c) => caixaL(L, cx, cy, cz, w, a, d, [0.2, 0.21], VERDE, c);
  for (const s of [-1, 1]) {
    const xa = s * B.x[0], xb = s * B.x[1], xc = (xa + xb) / 2, larg = Math.abs(xb - xa);
    concreto(xc, h / 2, zb - 0.1, larg, h, 0.2, 0.3);              // parede do fundo
    concreto(xa, h / 2, zc, 0.15, h, prof, 0.3);                    // laterais
    concreto(xb, h / 2, zc, 0.15, h, prof, 0.3);
    concreto(xc, h + 0.06, zc - 0.25, larg + 0.4, 0.12, prof + 0.6, 0.42); // cobertura
    verde(xc, 0.45, zb - 0.75, larg - 0.6, 0.1, 0.5, 0.9);           // assento
    verde(xc, 0.82, zb - 0.45, larg - 0.6, 0.62, 0.08, 0.55);        // encosto
    concreto(xc, 0.02, zc, larg, 0.04, prof, 0.5);                  // piso
  }
}

/** Caixa de 6 faces na malha da arquibancada (`L.quad`), toda no mesmo retalho (u, v) da textura e cor c. */
function caixaL(L, cx, cy, cz, w, a, d, [u0, u1], [v0, v1], c) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - a / 2, y1 = cy + a / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  L.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], u0, u1, v0, v1, c);
  L.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], u0, u1, v0, v1, c);
  L.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], u0, u1, v0, v1, c);
  L.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], u0, u1, v0, v1, c);
  L.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], u0, u1, v0, v1, c);
  L.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], u0, u1, v0, v1, c);
}

// ------------------------------------------------------------------ arquibancada e entorno

/**
 * Máscara das cadeiras 3D de perto (item 69; render/cadeiras3d.js escreve): até `CADEIRAS3D.blocosMax` caixas orientadas
 * (os blocos que viraram cadeira 3D) onde o material das arquibancadas troca a cadeira PINTADA pelo concreto do degrau
 * (o piso e o espelho pela normal) — a cadeira 3D fica sozinha em cima do degrau, sem a pintada embaixo. Uniforms
 * compartilhados por todos os materiais de arquibancada (nada recompila); sem bloco perto (n = 0) a conta nem roda.
 */
const NPERTO = CADEIRAS3D.blocosMax;
export const UNIFORMS_PERTO = {
  uPertoN: { value: 0 },
  uPertoC: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // centro (x, y, z) e 0
  uPertoE: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // meia-extensão (ao longo, y, de lado)
  uPertoA: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // eixo ao longo (x, z)
  uConcPiso: { value: new THREE.Color(0x43494c) }, uConcEspelho: { value: new THREE.Color(0x3b4043) },
};
const PERTO_GLSL = `
uniform int uPertoN;
uniform vec4 uPertoC[${NPERTO}];
uniform vec4 uPertoE[${NPERTO}];
uniform vec4 uPertoA[${NPERTO}];
uniform vec3 uConcPiso;
uniform vec3 uConcEspelho;
varying vec3 vNormMundo;
bool cadeiraPerto(vec3 p) {
  for (int i = 0; i < ${NPERTO}; i++) {
    if (i >= uPertoN) break;
    vec3 q = p - uPertoC[i].xyz;
    vec2 ax = uPertoA[i].xy;
    float al = dot(q.xz, ax), at = dot(q.xz, vec2(-ax.y, ax.x));
    if (abs(al) <= uPertoE[i].x && abs(q.y) <= uPertoE[i].y && abs(at) <= uPertoE[i].z) return true;
  }
  return false;
}`;

/**
 * A malha de cada setor em escada só com a câmera perto dela (render/cadeiras-dados.js DEGRAU_LOD, com histerese): troca a
 * geometria do Mesh (a lisa ↔ a em escada) — o desenho e o corte pela câmera não mudam (a mesma malha, o mesmo material;
 * o vão da pré-carga do lado de cá, drawRange, passa junto). soLisa: a câmera de jogo (a TV, camera.js deJogo) fica sempre
 * com a lisa — de 30 m ou mais o degrau não aparece e o custo do jogo na TV não sobe (a do fundo chegava a < 52 m).
 */
export function trocarLod(malhas, pos, soLisa = false) {
  for (const m of malhas) {
    const l = m.userData.lod;
    if (!l) continue;
    let d = Infinity;
    if (!soLisa) for (const c of l.caixas) if (!c.isEmpty()) d = Math.min(d, c.distanceToPoint(pos));
    const quer = l.emDegrau ? d <= DEGRAU_LOD.sai : d <= DEGRAU_LOD.entra;
    if (quer === l.emDegrau) continue;
    const velha = m.geometry, nova = quer ? l.deg : l.liso;
    nova.setDrawRange(velha.drawRange.start, velha.drawRange.count);
    velha.setDrawRange(0, Infinity);
    m.geometry = nova;
    l.emDegrau = quer;
  }
}
/**
 * Luz FALSA dos sinalizadores no concreto e nas cadeiras (luz-falsa.js: uniform vec4[8], nunca PointLight — uma luz de
 * verdade recompilaria todos os materiais do three.js no meio do gol). Sem sinalizador aceso, a conta nem roda. Também a
 * máscara das cadeiras 3D de perto (UNIFORMS_PERTO): dentro de um bloco em 3D, o concreto do degrau no lugar da pintura.
 */
export function comLuzFalsa(mat, chave) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlare = UNIFORMS_LUZ.uFlare;
    sh.uniforms.uFlareN = UNIFORMS_LUZ.uFlareN;
    for (const k of Object.keys(UNIFORMS_PERTO)) sh.uniforms[k] = UNIFORMS_PERTO[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;\nvarying vec3 vNormMundo;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoFlare = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;' + LUZ_FALSA_GLSL + PERTO_GLSL)
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (uPertoN > 0 && cadeiraPerto(vMundoFlare)) diffuseColor.rgb = diffuse * (abs(vNormMundo.y) > 0.5 ? uConcPiso : uConcEspelho);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * luzFalsa(vMundoFlare);');
  };
  mat.customProgramCacheKey = () => 'arq-luz-falsa-' + chave;
  return mat;
}

function criarArquibancada(aniso, qualidade, ident = null) {
  const larg = qualidade === 'baixa' ? 1024 : 2048;
  const V_PAREDE = 0.975, vMax = 1 - 24 / 512;
  function construtor(comCor = false) {
    const pos = [], uv = [], nrm = [], cor = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
    function tri(p0, p1, p2, t0, t1, t2, c = 1) {
      a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
      n.crossVectors(a, b).normalize();
      pos.push(...p0, ...p1, ...p2);
      uv.push(...t0, ...t1, ...t2);
      for (let k = 0; k < 3; k++) { nrm.push(n.x, n.y, n.z); cor.push(c, c, c); }
    }
    function quad(p0, p1, p2, p3, u0, u1, v0, v1, c = 1) {
      tri(p0, p1, p2, [u0, v0], [u1, v0], [u1, v1], c);
      tri(p0, p2, p3, [u0, v0], [u1, v1], [u0, v1], c);
    }
    function mesh(tex, chave) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      if (comCor) geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
      geo.computeBoundingSphere();
      return new THREE.Mesh(geo, comLuzFalsa(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, vertexColors: comCor }), chave));
    }
    return { tri, quad, mesh };
  }
  const frenteZ = MZ + CAMPO.entorno + 4.5;           // 44,5
  const fundoZ = frenteZ + 30, yBase = 1.4, yTopo = 20;
  const xA = ARQ.comprimento / 2;                       // ±62,5 (encosta nas de trás dos gols)
  // o DEGRAU em geometria (item 69): cada fileira da grade (render/cadeiras-dados.js) é um piso e um espelho, com a
  // célula dela na textura (o piso na faixa de baixo, o espelho na de cima)
  const FL = fileirasGolaco('lado'), FF = fileirasGolaco('fundo');
  // lado de lá (z negativo), de frente para a câmera de TV, com GOLAÇO nas cadeiras
  const L1 = construtor();
  {
    const z0 = -frenteZ, z1 = -fundoZ, z = d => z0 - d;
    L1.quad([-xA, 0, z0], [xA, 0, z0], [xA, yBase, z0], [-xA, yBase, z0], 0, 1, V_PAREDE, 1);
    for (const r of FL) {
      L1.quad([-xA, r.y, z(r.d0)], [xA, r.y, z(r.d0)], [xA, r.y, z(r.d1)], [-xA, r.y, z(r.d1)], 0, 1, r.v0, r.vm);
      L1.quad([-xA, r.y, z(r.d1)], [xA, r.y, z(r.d1)], [xA, r.y1, z(r.d1)], [-xA, r.y1, z(r.d1)], 0, 1, r.vm, r.v1);
    }
    L1.quad([-xA, yTopo, z1], [xA, yTopo, z1], [xA, yTopo + 5, z1], [-xA, yTopo + 5, z1], 0, 1, V_PAREDE, 1);
    L1.quad([-xA, yTopo + 5, z1], [xA, yTopo + 5, z1], [xA, yTopo + 6.5, z1 + 16], [-xA, yTopo + 6.5, z1 + 16], 0, 1, V_PAREDE, 1);
    // laterais (triângulos) fechando o fim da arquibancada nos cantos
    for (const s of [-1, 1]) {
      const x = s * xA;
      L1.tri([x, 0, z0], [x, yBase, z0], [x, yTopo + 5, z1], [0.5, V_PAREDE], [0.5, 1], [0.6, 1]);
      L1.tri([x, 0, z0], [x, yTopo + 5, z1], [x, 0, z1], [0.5, V_PAREDE], [0.6, 1], [0.6, V_PAREDE]);
    }
  }
  const g = new THREE.Group();
  // com ?tm: as cores das cadeiras, do friso e do mosaico pelo mandante, e o nome dele no mosaico (identidade.js)
  const coresArq = ident ? ident.arquibancada : null, mascaraTm = ident ? mascaraTexto(ident.mosaico.texto, 2.6) : null;
  const lado = L1.mesh(texArquibancada(aniso, true, larg, coresArq, mascaraTm), 'lado');
  // atrás dos gols (x±): do canto de lá (z −74,5) até o lado de cá (z +44,5); 30 fileiras (as da textura até 82%)
  const L2 = construtor();
  for (const s of [-1, 1]) {
    const x0 = s * (MX + CAMPO.entorno + 4), x1 = s * (MX + CAMPO.entorno + 4 + 26), x = d => x0 + s * d;
    const za = s > 0 ? frenteZ : -fundoZ, zb = s > 0 ? -fundoZ : frenteZ;
    const yT = 17;
    const u1 = (frenteZ + fundoZ) / ARQ.comprimento;
    L2.quad([x0, 0, za], [x0, 0, zb], [x0, yBase, zb], [x0, yBase, za], 0, u1, V_PAREDE, 1);
    // a escada do poste do refletor (item 69, PR 4: render/cadeiras-dados.js escadaDoPoste) no concreto da escada (o retalho
    // da textura: a célula 0, a escada da fileira 17)
    const ep = escadaDoPoste(s > 0 ? 1 : 2), nA = Math.round(ARQ.comprimento / ARQ.assentoLarg);
    const zU = u => za + (zb - za) * (u / u1);
    const trechos = ep ? [[0, ep[0] / nA, false], [ep[0] / nA, (ep[1] + 1) / nA, true], [(ep[1] + 1) / nA, u1, false]] : [[0, u1, false]];
    for (const r of FF) for (const [ua, ub, esc] of trechos) {
      const [qa, qb, qv0, qv1] = esc ? [0.002, 0.006, 0.484, 0.49] : [ua, ub, null, null];
      L2.quad([x(r.d0), r.y, zU(ua)], [x(r.d0), r.y, zU(ub)], [x(r.d1), r.y, zU(ub)], [x(r.d1), r.y, zU(ua)], qa, qb, qv0 ?? r.v0, qv1 ?? r.vm);
      L2.quad([x(r.d1), r.y, zU(ua)], [x(r.d1), r.y, zU(ub)], [x(r.d1), r.y1, zU(ub)], [x(r.d1), r.y1, zU(ua)], qa, qb, qv0 ?? r.vm, qv1 ?? r.v1, esc ? 0.8 : 1);
    }
    L2.quad([x1, yT, za], [x1, yT, zb], [x1, yT + 5, zb], [x1, yT + 5, za], 0, u1, V_PAREDE, 1);
  }
  const texSemNome = texArquibancada(aniso, false, larg, coresArq);
  const fundos = L2.mesh(texSemNome, 'fundos');
  lado.name = 'arquibancada-lado';
  fundos.name = 'arquibancada-fundos';
  const ca = criarLadoDeCa(construtor, texSemNome, { frenteZ, fundoZ, yBase, yTopo, xA, V_PAREDE, vMax, FL });
  g.userData.materiais = [lado.material, fundos.material, ca.material];
  g.userData.ladoDeCa = ca;
  // a grade das cadeiras (as 3D de perto, sob demanda: render/cadeiras3d.js) com a MESMA cor de cada célula da textura
  const pintLado = pintorGolaco({ comTexto: true, cores: coresArq, mascara: mascaraTm ?? mascaraTexto('GOLAÇO') });
  const pintSem = pintorGolaco({ comTexto: false, cores: coresArq });
  g.userData.cadeiras = {
    grade: gradeGolaco(),
    cor: a => (a.setor === 0 ? pintLado : pintSem)(a.f, a.a)?.cor ?? '#14181a',
    concreto: { piso: 0x43494c, espelho: 0x3b4043 },
  };
  g.add(lado, fundos, ca);
  return g;
}

/**
 * Arquibancada do LADO DE CÁ (z +; pedido de 11/10): a de lá espelhada (36 fileiras, 125 m), com o TÚNEL dos times
 * no meio (config.js ESTADIO.tunel: boca de 7 × 3,2 m na frente da arquibancada, o corredor escuro entrando 12 m por
 * baixo das cadeiras e as cadeiras cortadas em cima da boca) e um teto curto (o plano geral do intervalo, de z = 78
 * a 34 m de altura, passa por cima). A câmera de TV fica DENTRO desta arquibancada: atualizar() a tira do desenho
 * com a câmera lá dentro (torcida-dados.js cameraNoLadoDeCa, a mesma conta da torcida).
 */
function criarLadoDeCa(construtor, tex, A) {
  const { frenteZ: z0, fundoZ: z1, yBase, yTopo, xA, V_PAREDE, vMax, FL } = A;
  const T = ESTADIO.tunel;
  const L = construtor(true);
  const ti = T.largura / 2, mt = ti + 0.4, ya = T.altura, ytt = T.altura + T.laje;
  void vMax;
  const z = d => z0 + d;
  // a 1ª fileira que passa por cima do teto do túnel (as de baixo não têm cadeira em cima da boca: a mesma conta da
  // grade, render/cadeiras-dados.js — o piso abaixo do topo do túnel com a folga)
  const jT = FL.findIndex(r => r.y >= TUNEL.topo);
  const zt = z(FL[jT].d0);
  const uX = x => (x + xA) / (2 * xA);
  // retalhos da textura das cadeiras: o concreto claro da escada (célula da cadeira 0, no meio da fileira 17) e o
  // friso verde do parapeito (o topo da faixa de parede)
  const CU = [0.002, 0.006], CV = [0.484, 0.49], VERDE = [0.996, 0.999];
  // mureta da frente dos dois lados da boca
  L.quad([-xA, 0, z0], [-mt, 0, z0], [-mt, yBase, z0], [-xA, yBase, z0], uX(-xA), uX(-mt), V_PAREDE, 1);
  L.quad([mt, 0, z0], [xA, 0, z0], [xA, yBase, z0], [mt, yBase, z0], uX(mt), uX(xA), V_PAREDE, 1);
  // degraus (piso + espelho): os dois lados inteiros; no meio, só os que passam por cima do teto do túnel. Ao lado da
  // boca, nas fileiras de baixo, as escadas das células ESCADA_TUNEL (item 69, PR 4: a grade tira as cadeiras delas) no
  // concreto da escada (o retalho CU/CV)
  const xCel = a => -ARQ.comprimento / 2 + ARQ.assentoLarg * a;
  const eE = [xCel(ESCADA_TUNEL[0]), -mt], eD = [mt, xCel(ESCADA_TUNEL[3] + 1)];
  for (const r of FL) {
    const trechos = r.j >= jT ? [[-xA, xA]] : [[-xA, eE[0]], [eD[1], xA]];
    for (const [xa, xb] of trechos) {
      L.quad([xa, r.y, z(r.d0)], [xb, r.y, z(r.d0)], [xb, r.y, z(r.d1)], [xa, r.y, z(r.d1)], uX(xa), uX(xb), r.v0, r.vm);
      L.quad([xa, r.y, z(r.d1)], [xb, r.y, z(r.d1)], [xb, r.y1, z(r.d1)], [xa, r.y1, z(r.d1)], uX(xa), uX(xb), r.vm, r.v1);
    }
    if (r.j < jT) for (const [xa, xb] of [eE, eD]) {
      L.quad([xa, r.y, z(r.d0)], [xb, r.y, z(r.d0)], [xb, r.y, z(r.d1)], [xa, r.y, z(r.d1)], CU[0], CU[1], CV[0], CV[1], 1);
      L.quad([xa, r.y, z(r.d1)], [xb, r.y, z(r.d1)], [xb, r.y1, z(r.d1)], [xa, r.y1, z(r.d1)], CU[0], CU[1], CV[0], CV[1], 0.8);
    }
  }
  // parede de trás e um teto curto
  L.quad([-xA, yTopo, z1], [xA, yTopo, z1], [xA, yTopo + 5, z1], [-xA, yTopo + 5, z1], 0, 1, V_PAREDE, 1);
  L.quad([-xA, yTopo + 5, z1], [xA, yTopo + 5, z1], [xA, yTopo + 5.6, z1 - 4.5], [-xA, yTopo + 5.6, z1 - 4.5], 0, 1, V_PAREDE, 1);
  for (const s of [-1, 1]) {
    const x = s * xA;
    L.tri([x, 0, z0], [x, yBase, z0], [x, yTopo + 5, z1], [0.5, V_PAREDE], [0.5, 1], [0.6, 1]);
    L.tri([x, 0, z0], [x, yTopo + 5, z1], [x, 0, z1], [0.5, V_PAREDE], [0.6, 1], [0.6, V_PAREDE]);
  }
  // a boca do túnel saliente entre os degraus: o teto (laje), o espelho dele até o degrau de cima e as paredes de fora
  // (de cada piso até a laje) em concreto, a moldura verde
  L.quad([-mt, ytt, z0], [mt, ytt, z0], [mt, ytt, zt], [-mt, ytt, zt], CU[0], CU[1], CV[0], CV[1], 1);
  L.quad([-mt, ytt, zt], [mt, ytt, zt], [mt, FL[jT].y, zt], [-mt, FL[jT].y, zt], CU[0], CU[1], CV[0], CV[1], 0.8);
  for (const s of [-1, 1]) {
    const x = s * mt;
    for (const r of FL.slice(0, jT)) L.quad([x, r.y, z(r.d0)], [x, ytt, z(r.d0)], [x, ytt, z(r.d1)], [x, r.y, z(r.d1)], CU[0], CU[1], CV[0], CV[1], 0.9);
    L.quad([s * ti, 0, z0], [s * mt, 0, z0], [s * mt, ytt, z0], [s * ti, ytt, z0], 0.2, 0.21, VERDE[0], VERDE[1], 0.8);
  }
  L.quad([-ti, ya, z0], [ti, ya, z0], [ti, ytt, z0], [-ti, ytt, z0], 0.2, 0.21, VERDE[0], VERDE[1], 0.8);
  // por dentro: o concreto cada vez mais escuro (cor por vértice), o fundo quase preto
  const zf = z0 + T.profundidade;
  for (const s of [-1, 1]) L.quad([s * ti, 0, z0], [s * ti, 0, zf], [s * ti, ya, zf], [s * ti, ya, z0], CU[0], CU[1], CV[0], CV[1], 0.45);
  L.quad([-ti, ya, z0], [ti, ya, z0], [ti, ya, zf], [-ti, ya, zf], CU[0], CU[1], CV[0], CV[1], 0.32);
  L.quad([-ti, 0.02, z0], [ti, 0.02, z0], [ti, 0.02, zf], [-ti, 0.02, zf], CU[0], CU[1], CV[0], CV[1], 0.55);
  L.quad([-ti, 0, zf], [ti, 0, zf], [ti, ya, zf], [-ti, ya, zf], CU[0], CU[1], CV[0], CV[1], 0.1);
  bancosDeReservas(L, CU, CV, VERDE);
  const m = L.mesh(tex, 'ca');
  m.name = 'arquibancada-ca';
  // o corte é o de atualizar(): a câmera dentro dela ou as caixas fora do quadro. Duas caixas (a faixa da frente, baixa,
  // e a de cima): uma caixa só, com a câmera de TV do PC na frente dela olhando para baixo, passava no teste plano a
  // plano do Frustum (falso positivo) — 1 chamada de desenho à toa, medida em 20 instantes do jogo
  m.frustumCulled = false;
  const zm = z0 + 0.4 * (z1 - z0);
  const yS = zz => yBase + (yTopo - yBase) * (zz - z0) / (z1 - z0);
  m.userData.caixas = [
    new THREE.Box3(new THREE.Vector3(-xA - 0.5, -0.5, z0 - 0.6), new THREE.Vector3(xA + 0.5, yS(zm) + 0.5, zm + 0.5)),
    new THREE.Box3(new THREE.Vector3(-xA - 0.5, yS(zm) - 0.5, zm - 0.5), new THREE.Vector3(xA + 0.5, yTopo + 6.2, z1 + 0.6)),
    // os bancos de reservas, na frente da arquibancada
    new THREE.Box3(new THREE.Vector3(-ESTADIO.bancos.x[1] - 0.5, -0.1, ESTADIO.bancos.z[0] - 0.8), new THREE.Vector3(ESTADIO.bancos.x[1] + 0.5, ESTADIO.bancos.altura + 0.3, z0)),
  ];
  return m;
}

/** Torres de refletores nos cantos (só aparecem em câmeras mais abertas) + brilho à noite. */
function criarRefletores() {
  const geos = [], lamp = [];
  const spots = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const x = s * 72, z = t * 56;
    geos.push(cilindroEntre([x, 0, z], [x, 38, z], 0.45, 8));
    // painel virado para o centro do campo
    const g = new THREE.BoxGeometry(7, 3.2, 0.4);
    g.rotateY(Math.atan2(-x, -z));
    g.translate(x, 39.5, z);
    lamp.push(g);
    spots.push(new THREE.Vector3(x * 0.985, 39.5, z * 0.985));
  }
  const torres = new THREE.Mesh(juntarGeometrias(geos), new THREE.MeshLambertMaterial({ color: 0x2a2f31 }));
  const matLamp = new THREE.MeshBasicMaterial({ color: 0x3a4044 });
  const lampadas = new THREE.Mesh(juntarGeometrias(lamp), matLamp);
  const grupo = new THREE.Group();
  grupo.add(torres, lampadas);
  const brilhos = [];
  const tex = texBrilho();
  for (const p of spots) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdfeaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sp.position.copy(p);
    sp.scale.set(26, 26, 1);
    sp.visible = false;
    grupo.add(sp);
    brilhos.push(sp);
  }
  grupo.name = 'refletores';
  return { grupo, matLamp, brilhos };
}

/**
 * Monta o campo inteiro. opc: {qualidade, aniso, identidade (identidade.js; só a do Total Match — `tm` — muda as placas,
 * as cadeiras, o mosaico e as bandeiras de escanteio: só desenho, a geometria é a mesma)}. Devolve {grupo,
 * definirHora(h), atualizar(t)}.
 */
export function criarCampo(opc) {
  const aniso = opc.aniso ?? 4;
  const ident = opc.identidade && opc.identidade.tm ? opc.identidade : null;
  // o gramado no shader (item 45): a textura só das manchas e do desgaste, 512 × 256 (256 × 128 na Baixa; antes a textura
  // inteira de 2048 × 1024, ~11 MB na GPU com os mips); o `?gfx=antigo` volta a textura e o shader de antes, bit a bit
  const antigo = GRAFICOS.gfxAntigo;
  const tamGrama = opc.qualidade === 'baixa' ? (antigo ? 1024 : 256) : (antigo ? 2048 : 512);
  const grupo = new THREE.Group();
  grupo.name = 'campo';
  const detalhe = texDetalheGrama(opc.qualidade === 'baixa' ? 256 : 512, aniso);
  const uGramado = antigo ? null : uniformsGramado('dia');
  // gramado (campo + entorno)
  const gg = new THREE.PlaneGeometry(GRAMA.lx, GRAMA.lz, 1, 1);
  gg.rotateX(-Math.PI / 2);
  const matGrama = antigo
    ? comDetalheAntigo(new THREE.MeshLambertMaterial({ map: texGramadoAntigo(tamGrama, aniso) }), detalhe, 0.85)
    : comDetalhe(new THREE.MeshLambertMaterial({ map: texManchasGramado(tamGrama, aniso) }), detalhe, 0.85, { faixas: true, profundidade: true, uniforms: uGramado });
  const grama = new THREE.Mesh(gg, matGrama);
  grama.receiveShadow = true;
  grama.name = 'gramado';
  grupo.add(grama);
  // chão de fora (concreto escuro), um pouco abaixo
  const gf = new THREE.PlaneGeometry(420, 420, 1, 1);
  gf.rotateX(-Math.PI / 2);
  gf.translate(0, -0.02, 0);
  // atrás das placas a grama continua até a arquibancada (mais escura, sem faixas): a cor de fora do gramado no shader
  // (render/gramado.js, a mesma matiz das faixas; antes 0x2c5a26, h 143,8°)
  const fora = new THREE.Mesh(gf, antigo
    ? comDetalheAntigo(new THREE.MeshLambertMaterial({ color: 0x2c5a26 }), detalhe, 0.6)
    : comDetalhe(new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(...GRAMADO_HORAS.dia.fora) }), detalhe, 0.6, { profundidade: true, uniforms: uGramado }));
  fora.name = 'chao-fora';
  grupo.add(fora);
  // a profundidade relativa ao foco (C7): o uGFoco e o uRasante de cada desenho, pela câmera dele (os mesmos uniforms nos dois
  // materiais; os dois ganchos fazem a mesma conta, então vale a ordem em que o three desenhar); `semProf` = o gancho dos
  // testes; `rasBase` = o uRasante da hora antes da altura da câmera
  let horaG = 'dia', semProf = false, semMan = false, rasBase = uGramado ? uGramado.uRasante.value : 0;
  if (uGramado) grama.onBeforeRender = fora.onBeforeRender = focador(uGramado, () => rasBase);
  const rasante = () => { if (uGramado) uGramado.uRasante.value = rasBase = semProf ? 0 : valoresGramado(horaG).uRasante; };
  const manchas = () => { if (uGramado) uGramado.uManchas.value = semMan ? 0 : valoresGramado(horaG).uManchas; };
  grupo.add(criarLinhas(detalhe, uGramado));
  const gols = criarGols(antigo);
  grupo.add(gols.estrutura, gols.rede);
  // rede que balança: main.js escreve os impactos (rede-onda.js uniformsRede) nestes vetores
  const uRede = gols.uniformsRede;
  const band = criarBandeiras(ident);
  grupo.add(band.mesh);
  const placas = criarPlacas(aniso, ident);
  grupo.add(placas.frente, placas.corpo);
  // estádio com forma própria (render/estadio-real.js, sob demanda): a tigela e a cobertura dele, sem as torres
  const f3 = ident?.forma3d;
  const arq = f3 ? f3.real.criarTigela(f3.planta, { aniso, qualidade: opc.qualidade, ident, comLuzFalsa }) : criarArquibancada(aniso, opc.qualidade, ident);
  grupo.add(arq);
  const refl = criarRefletores();
  if (!f3) grupo.add(refl.grupo);
  const ladoDeCa = arq.userData.ladoDeCa;
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4();
  // cadeiras 3D de perto (item 69; render/cadeiras3d.js sob demanda: ligarCadeiras quando o módulo chega)
  let cad3d = null, alturaTela = 720, qualCad = opc.qualidade ?? 'media', horaCad = 'dia', torcidaCad = null, medidorCad = null;
  // pré-carga (como a torcida): no 1º quadro, se a câmera não a vê, a arquibancada do lado de cá vai para a GPU com
  // 0 triângulos (geometria e programa prontos) — o 1º corte de câmera que a mostra não engasga
  let precarga = true, restaurar = false;
  return {
    grupo,
    /** Vetores dos uniforms da rede (a = [x, y, z, amp]·4, b = [τ, pano, 0, 0]·4): rede-onda.js uniformsRede. */
    rede: { a: uRede.uRedeA.value, b: uRede.uRedeB.value, mesh: gols.rede },
    /**
     * O antisserrilhado dos finos do gol (item 45, C9: FINOS) pelas AMOSTRAS do contexto que desenha (o SAMPLES: o
     * `cena.amostras`, nunca o nome da qualidade): ≥ 2 = alfa para cobertura, < 2 = mistura. O main.js chama na criação e no
     * `cena.aoRecriar` (a recriação do renderizador e o contexto restaurado); sem chamada, a mistura (certa em qualquer contexto).
     */
    definirAA(amostras) { gols.finos.definirAA(amostras); },
    /**
     * Os gráficos do item 45 (testes e diagnóstico): antigo = o `?gfx=antigo` (o gramado de antes); gramado = os uniforms do
     * gramado no shader ({uClara, uEscura, uManchas, uRasante, uGFoco, …}: render/gramado.js), null no antigo;
     * semProfundidade(bool) = o termo de profundidade desligado (o uRasante em 0, também depois de uma troca de hora) — a G4 do
     * teste-graficos-celular mede o TERMO, com − sem ele (sem efeito no antigo, que não tem o termo); semManchas(bool) = as
     * manchas desligadas (o uManchas em 0, também depois de uma troca de hora) — a G1 e a G2 medem a cor e as faixas sem
     * depender de onde as manchas caem perto do foco (a revisão do C4–C8; sem efeito no antigo); fisico(bool) = os desenhos
     * seguintes SEM os truques dos finos (C9: sem a largura mínima, sem A2C, sem mistura — a peça de verdade, opaca; com false
     * voltam): as referências SSAA e as máscaras geométricas dos testes (seções A, A2 e F) não dependem do código medido;
     * finos = o estado dos finos agora ({modo: 'a2c' | 'mistura' | 'fisico', amostras, largMin}).
     */
    graficos: {
      antigo, gramado: uGramado,
      semProfundidade(v) { semProf = !!v; rasante(); },
      semManchas(v) { semMan = !!v; manchas(); },
      fisico(v) { gols.finos.fisico(v); },
      get finos() { return gols.finos.estado; },
    },
    definirHora(hora) {
      const noite = hora === 'noite';
      uNoite.value = noite ? 1 : 0;
      if (uGramado) {
        horaG = hora;
        horaGramado(uGramado, hora);
        rasante();
        manchas();
        fora.material.color.setRGB(...(GRAMADO_HORAS[hora] ?? GRAMADO_HORAS.dia).fora);
      }
      // arquibancada à noite: só a luz que escapa dos refletores
      for (const m of arq.userData.materiais) m.color.setScalar(noite ? 0.42 : 1);
      arq.userData.definirHora?.(hora);
      placas.mat.color.setHex(noite ? 0xffffff : 0xd4d4d4);
      // rede e traves brancas também à noite (só a luz dos refletores deixava a rede cinza-escura)
      gols.matRede.emissive.setHex(noite ? LUZ_GOL.redeNoite : LUZ_GOL.redeDia);
      gols.matArm.emissive.setHex(noite ? LUZ_GOL.armNoite : LUZ_GOL.armDia);
      refl.matLamp.color.setHex(noite ? 0xf4f8ff : 0x3a4044);
      for (const b of refl.brilhos) b.visible = noite;
      horaCad = hora;
      cad3d?.definirHora(hora);
    },
    /**
     * t: s; camera (opcional): o lado de cá só vai para a GPU com a câmera fora dele e a caixa no quadro; desenha: este
     * quadro vai mesmo ser desenhado (com o celular em pé a tela de girar cobre tudo e nada é desenhado — a pré-carga
     * espera o 1º quadro desenhado de verdade); deJogo: é a câmera de jogo (a TV: camera.js deJogo) — sem cadeira 3D.
     */
    atualizar(t, camera = null, desenha = true, deJogo = false) {
      band.tempo.value = t;
      if (camera) {
        camera.updateMatrixWorld();
        _frustum.setFromProjectionMatrix(_mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cx = ladoDeCa.userData.caixas;
        const dentroCa = cameraNoLadoDeCa(camera.position);
        const ver = !dentroCa && cx.some(c => _frustum.intersectsBox(c));
        if (restaurar) { restaurar = false; ladoDeCa.geometry.setDrawRange(0, Infinity); }
        if (precarga && desenha && !ver) { ladoDeCa.visible = true; ladoDeCa.geometry.setDrawRange(0, 0); restaurar = true; } else ladoDeCa.visible = ver;
        if (desenha) precarga = false;
        // o degrau das plantas curvas (lisa de longe e na TV, em escada de perto) e as cadeiras 3D dos blocos perto da câmera
        arq.userData.atualizarLod?.(camera.position, deJogo);
        cad3d?.atualizar(camera, alturaTela, dentroCa, deJogo);
      }
    },
    /** Liga as cadeiras 3D de perto (o módulo render/cadeiras3d.js chegou: main.js SOB.cadeiras). */
    ligarCadeiras(md) {
      if (cad3d || !arq.userData.cadeiras) return;
      cad3d = md.criarCadeiras3D({ grupo, info: arq.userData.cadeiras, uniforms: UNIFORMS_PERTO, qualidade: qualCad, medidor: medidorCad });
      cad3d.definirHora(horaCad);
      if (torcidaCad) cad3d.ligarTorcida(torcidaCad);
    },
    /** A torcida do estádio (render/torcida.js) ficou pronta: o torcedor 3D de perto senta nas cadeiras 3D (item 69, PR 2). */
    ligarTorcida(t) { torcidaCad = t; cad3d?.ligarTorcida(t); },
    /**
     * De onde vem o total do último desenho (() → {frame, triangles}: o renderer.info.render): o ORÇAMENTO de triângulos por
     * quadro do 3D de perto (render/cadeiras3d.js; sem ele, só os tetos da qualidade).
     */
    definirMedidor(fn) { medidorCad = fn ?? null; cad3d?.definirMedidor(medidorCad); },
    /** Altura da tela em px CSS (a escolha dos blocos de perto é pelos px da cadeira). */
    definirAlturaTela(px) { if (px > 0) alturaTela = px; },
    definirQualidade(q) { qualCad = q; cad3d?.definirQualidade(q); },
    /** Mostra/esconde as cadeiras 3D (testes; escondidas, a cadeira pintada volta em todo bloco). */
    mostrarCadeiras(v) { cad3d?.ligar(v); },
    /** As cadeiras 3D neste quadro (testes): {carregado, blocos, instancias, teto, mascara, torcedores, orcamento}. */
    get cadeiras() { return { carregado: !!cad3d, blocos: cad3d?.blocos ?? 0, instancias: cad3d?.instancias ?? 0, teto: cad3d?.teto ?? null, mascara: UNIFORMS_PERTO.uPertoN.value, torcedores: cad3d?.torcedores ?? null, orcamento: cad3d?.orcamento ?? null, impostor: cad3d?.impostor ?? null }; },
    /** O impostor da torcida (item 69, PR 3: render/impostor.js), ou null. */
    get impostorObj() { return cad3d?.impostorObj ?? null; },
    /** O torcedor 3D (testes: as malhas, o modelo e a VAT de render/torcedor3d.js), ou null. */
    get torcedor3d() { return cad3d?.torcedor3d ?? null; },
    get grade() { return arq.userData.cadeiras?.grade ?? null; },
    /** As malhas das arquibancadas agora (testes): {nome, visivel, triangulos, emDegrau (a malha em escada: DEGRAU_LOD)}. */
    get arquibancadas() {
      return arq.children.filter(m => /^arquibancada-/.test(m.name)).map(m => {
        const gg = m.geometry, n = gg.index ? gg.index.count : gg.attributes.position.count;
        return { nome: m.name, visivel: m.visible, triangulos: Math.round(Math.min(n, gg.drawRange.count) / 3), emDegrau: m.userData.lod ? m.userData.lod.emDegrau : true, trisLiso: m.userData.lod ? m.userData.lod.liso.index.count / 3 : null, trisDegrau: m.userData.lod ? m.userData.lod.deg.index.count / 3 : null };
      });
    },
    /** A arquibancada do lado de cá (testes: visível ou não neste quadro). */
    get ladoDeCa() { return ladoDeCa; },
  };
}
