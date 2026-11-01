// O IMPOSTOR OCTAÉDRICO da torcida (three.js; SOB DEMANDA — chega com o render/cadeiras3d.js, que o cria quando a torcida
// liga). Item 69 da FILA, PR 3 de 4. Quando o modelo do torcedor 3D chega (render/torcedor3d.js baixa o
// assets/torcedor/torcedor.bin fora da Baixa), o atlas das fotos (render/impostor-dados.js criarAssador: 16 objetos — homem e
// mulher × 8 poses — fotografados de N × N direções num hemi-octaedro de polo inclinado) é ASSADO na CPU em fatias de
// alguns ms no tempo ocioso (o 1º quadro não espera) e vira duas texturas RGBA8 (as regiões e a normal com a altura), com
// o nível 1 de mipmap feito dentro de cada foto. Aí a torcida (render/torcida.js) ganha o programa com os dois ramos: cada
// torcedor desenha o quadro SDF de hoje (aLod 0) ou o impostor (aLod 1) — o mesmo quadro de 2 triângulos, a mesma pose
// (render/torcedor-pose.js ESTADO_GLSL), a mesma chamada de desenho. A escolha é por BLOCO da grade das cadeiras
// (render/impostor-dados.js escolherImpostor: os px da cadeira na tela com histerese e o teto de torcedores da qualidade);
// o grupo sem ninguém em impostor volta ao programa de hoje (o quadro). Na Média (o celular) só fora da TV de jogo: na TV
// do celular nada fica mais caro que hoje. Baixa, o modelo que não veio, o assamento ou o programa que falhou: o quadro
// SDF de sempre. Só desenho: o hash não muda.
import * as THREE from 'three';
import { IMPOSTOR, IMPOSTOR_GLSL, OBJETOS, especificacao, criarAssador, escolherImpostor, blocosDosTorcedores } from './impostor-dados.js';
import { TORCEDOR3D } from './torcedor-dados.js';

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const T3 = TORCEDOR3D, I = IMPOSTOR;
// o sol do dia (o mesmo do quadro e do torcedor 3D: render/torcida.js SOL_DIA) e, à noite, os refletores (de cima)
const SOL = (() => { const s = [-0.42, 0.74, 0.52], l = Math.hypot(...s); return new THREE.Vector3(s[0] / l, s[1] / l, s[2] / l); })();

// ------------------------------------------------------------------ o ramo do impostor no programa da torcida
const VERT_PARS = /* glsl */`
attribute float aLod;
attribute vec2 aRumo;
uniform float uImpN;
uniform vec2 uImpCel;
uniform vec2 uImpTam;
uniform float uImpPorLinha;
uniform vec4 uImpRet[${OBJETOS}];
uniform vec4 uImpCen[${OBJETOS}];
uniform vec3 uImpLuz;
varying float vImpModo;
varying vec4 vImpUv01;
varying vec2 vImpUv2;
varying vec4 vImpCel01;
varying vec2 vImpCel2;
varying vec3 vImpW;
varying vec3 vImpL0;
varying vec3 vImpL1;
varying vec3 vImpL2;
varying vec4 vImpX;
${IMPOSTOR_GLSL}
vec2 impOrigem(float o, vec2 f) {
  float tx = mod(o, uImpPorLinha), ty = floor(o / uImpPorLinha + 1e-4);
  return ((vec2(tx, ty) * uImpN + f) * uImpCel) / uImpTam;
}
`;
// dentro de main() da torcida, com h, h2, pose, pulo, bal e mvPosition já declarados (render/torcida.js shaders)
const VERT_MAIN = /* glsl */`
    float iPose = floor(pose + 0.5);
    float iVar = fract(h * 31.7 + h2 * 7.3) < ${g(T3.mulher)} ? 1.0 : 0.0;
    int iObj = int(iVar * ${g(T3.poses)} + iPose + 0.5);
    vec4 iR = uImpRet[iObj];
    vec3 iCn = uImpCen[iObj].xyz;
    bool iSent = iPose < ${g(T3.sentadas)} - 0.5;
    float iPiv = iSent ? ${g(T3.assento)} : 0.0;
    float iE = clamp(aPos.w, ${g(I.escala[0])}, ${g(I.escala[1])});
    vec3 iX = vec3(aRumo.y, 0.0, -aRumo.x);
    vec3 iZ = vec3(aRumo.x, 0.0, aRumo.y);
    // o centro do objeto escalado (pelo assento sentado, pelo piso de pé), o pulo (só de pé) e o balanço (cresce com a altura)
    vec3 iC = vec3(iCn.x * iE, iPiv + (iCn.y - iPiv) * iE + (iSent ? 0.0 : pulo), iCn.z * iE);
    iC.x += bal * clamp((iC.y - iPiv) / ${g(T3.alturaBal)}, 0.0, 1.0);
    vec3 iCentro = aPos.xyz + iX * iC.x + vec3(0.0, iC.y, 0.0) + iZ * iC.z;
    vec3 iVw = normalize(uCamPos - iCentro);
    vec3 iV = vec3(dot(iVw, iX), iVw.y, dot(iVw, iZ));
    // as 3 fotos mais perto da direção da câmera e os pesos; a base de cada uma e a do quadro (virado para a câmera)
    vec2 iF0, iF1, iF2;
    vec3 iW;
    impQuadros(impCodifica(iV), uImpN, iF0, iF1, iF2, iW);
    vec3 iD0 = impDirecao(iF0, uImpN), iD1 = impDirecao(iF1, uImpN), iD2 = impDirecao(iF2, uImpN);
    vec3 iBx0, iBy0, iBx1, iBy1, iBx2, iBy2, iBxv, iByv;
    impBase(iD0, iBx0, iBy0);
    impBase(iD1, iBx1, iBy1);
    impBase(iD2, iBx2, iBy2);
    impBase(iV, iBxv, iByv);
    vec3 iLp = iBxv * (iR.x + (position.x + 0.5) * iR.z) + iByv * (iR.y + position.y * iR.w);
    vec3 iPl = iC + iLp * iE;
    vec3 iP = aPos.xyz + iX * iPl.x + vec3(0.0, iPl.y, 0.0) + iZ * iPl.z;
    mvPosition = viewMatrix * vec4(iP, 1.0);
    // o canto do quadro em cada foto (a projeção virtual: o raio da câmera no plano de cada foto)
    vImpUv01 = vec4((impReprojeta(iLp, iV, iD0, iBx0, iBy0) - iR.xy) / iR.zw, (impReprojeta(iLp, iV, iD1, iBx1, iBy1) - iR.xy) / iR.zw);
    vImpUv2 = (impReprojeta(iLp, iV, iD2, iBx2, iBy2) - iR.xy) / iR.zw;
    float iO = float(iObj);
    vImpCel01 = vec4(impOrigem(iO, iF0), impOrigem(iO, iF1));
    vImpCel2 = impOrigem(iO, iF2);
    vImpW = iW;
    // a luz (o sol de dia, de cima à noite) no espaço de cada foto: o fragment shader faz N·L com a normal da foto
    vec3 iL = vec3(dot(uImpLuz, iX), uImpLuz.y, dot(uImpLuz, iZ));
    vImpL0 = vec3(dot(iL, iBx0), dot(iL, iBy0), dot(iL, iD0));
    vImpL1 = vec3(dot(iL, iBx1), dot(iL, iBy1), dot(iL, iD1));
    vImpL2 = vec3(dot(iL, iBx2), dot(iL, iBy2), dot(iL, iD2));
    vImpX = vec4(h, iPose, iPiv, 0.88 + 0.24 * fract(h * 7.31));
`;
const FRAG_PARS = /* glsl */`
uniform sampler2D uImpA;
uniform sampler2D uImpB;
uniform vec2 uImpCel;
uniform vec2 uImpTam;
uniform float uNoiteImp;
uniform vec3 uCalcaImp[${T3.calca.length}];
uniform vec3 uSapatoImp[${T3.sapato.length}];
varying float vImpModo;
varying vec4 vImpUv01;
varying vec2 vImpUv2;
varying vec4 vImpCel01;
varying vec2 vImpCel2;
varying vec3 vImpW;
varying vec3 vImpL0;
varying vec3 vImpL1;
varying vec3 vImpL2;
varying vec4 vImpX;
// uma foto: as regiões e a normal (já vezes a cobertura) somadas pelo peso; N·L no espaço dela
void impAmostra(vec2 cel, vec2 uv, float w, vec3 L, inout vec4 A, inout vec4 B, inout float ndl) {
  if (w <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return;
  vec2 c = cel + uv * uImpCel / uImpTam;
  vec4 ta = texture2D(uImpA, c), tb = texture2D(uImpB, c);
  A += w * ta;
  B += w * tb;
  vec2 n = tb.gb * 2.0 - ta.a;
  ndl += w * dot(vec3(n, sqrt(max(ta.a * ta.a - dot(n, n), 0.0))), L);
}
`;
const FRAG_MAIN = /* glsl */`
    vec4 iA = vec4(0.0), iB = vec4(0.0);
    float iNdl = 0.0;
    impAmostra(vImpCel01.xy, vImpUv01.xy, vImpW.x, vImpL0, iA, iB, iNdl);
    impAmostra(vImpCel01.zw, vImpUv01.zw, vImpW.y, vImpL1, iA, iB, iNdl);
    impAmostra(vImpCel2, vImpUv2, vImpW.z, vImpL2, iA, iB, iNdl);
    if (iA.a < ${g(I.alfa)}) discard;
    vec3 iWr = iA.rgb / iA.a;
    float iWc = iB.r / iA.a;
    float iAlt = iB.a / iA.a * ${g(I.alturaMax)};
    float iResto = max(0.0, 1.0 - iWr.r - iWr.g - iWr.b - iWc);
    float iN = iNdl / iA.a;
    float iH = vImpX.x;
    vec3 iCalca = uCalcaImp[int(fract(iH * 13.13) * ${g(T3.calca.length)})];
    vec3 iSapato = uSapatoImp[int(fract(iH * 5.71) * ${g(T3.sapato.length)})];
    // o resto (o que não é camisa, pele, cabelo nem calça): o cachecol acima de 1 m na pose do cachecol; senão o tênis
    vec3 iRc = (abs(vImpX.y - 6.0) < 0.5 && iAlt > 1.0) ? vAcento : iSapato;
    cor = iWr.r * vCamisa + iWr.g * vPele + iWr.b * vCabelo + iWc * iCalca + iResto * iRc;
    // a luz do torcedor 3D (render/torcedor3d.js): o sol pela normal de dia, os refletores de cima à noite, cada um com a
    // sua e a fileira da frente escurecendo as pernas; mais a luz falsa dos sinalizadores
    float iLuz = uNoiteImp > 0.5 ? 0.33 + 0.17 * (0.5 + 0.5 * iN) : 0.6 + 0.44 * max(0.0, iN);
    iLuz *= vImpX.w * (0.7 + 0.3 * smoothstep(0.05, 0.75, iAlt - vImpX.z * 0.5));
    cor *= iLuz + vFlare;
`;
export const GLSL_IMPOSTOR = Object.freeze({ vertPars: VERT_PARS, vertMain: VERT_MAIN, fragPars: FRAG_PARS, fragMain: FRAG_MAIN });

/** As texturas do atlas (o nível 0 e o 1: imutáveis com 2 níveis — o 2 misturaria fotos vizinhas). */
function texturas(r) {
  const S = r.spec;
  const tex = (n0, n1) => {
    const t = new THREE.DataTexture(n0, S.largura, S.altura, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.mipmaps = [{ data: n0, width: S.largura, height: S.altura }, { data: n1, width: r.mip.largura, height: r.mip.altura }];
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { a: tex(r.a, r.mip.a), b: tex(r.b, r.mip.b) };
}

/**
 * Cria o impostor. opc = {torcida (render/torcida.js), grade (a das cadeiras: os blocos), qualidade, hora, agendar
 * (opcional: fn(cb) para a próxima fatia; padrão requestIdleCallback)}. Devolve {preparar(modelo), atualizar(cam, deJogo,
 * semCa), definirQualidade(q), definirHora(h), estado, resultado, dispose()}.
 */
export function criarImpostor(opc) {
  const { torcida, grade } = opc;
  let qualidade = opc.qualidade ?? 'media', hora = opc.hora ?? 'dia';
  let modelo = null, assador = null, specAssando = null, atlas = null, tex = null, mapa = null, ligado = false, falhou = false;
  let anteriores = new Set(), nPor = null, nPorQ = -1, chave = '', agendado = false, msAssando = 0, descartado = false, pausado = false;
  const ret = Array.from({ length: OBJETOS }, () => new THREE.Vector4()), cen = Array.from({ length: OBJETOS }, () => new THREE.Vector4());
  const U = {
    uImpA: { value: null }, uImpB: { value: null }, uImpN: { value: 6 }, uImpCel: { value: new THREE.Vector2(1, 1) },
    uImpTam: { value: new THREE.Vector2(1, 1) }, uImpPorLinha: { value: I.porLinha }, uImpRet: { value: ret }, uImpCen: { value: cen },
    uImpLuz: { value: SOL.clone() }, uNoiteImp: { value: 0 },
    uCalcaImp: { value: T3.calca.map(c => new THREE.Color(c)) }, uSapatoImp: { value: T3.sapato.map(c => new THREE.Color(c)) },
  };
  const agendar = opc.agendar ?? (cb => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 200 }) : setTimeout(cb, 16)));
  const qIdx = () => Math.max(0, ['baixa', 'media', 'alta'].indexOf(qualidade));
  function definirHoraU() { U.uNoiteImp.value = hora === 'noite' ? 1 : 0; U.uImpLuz.value.copy(hora === 'noite' ? new THREE.Vector3(0, 1, 0) : SOL); }
  definirHoraU();

  /** O atlas da qualidade (a Baixa não tem): começa o assamento em fatias. */
  function assar() {
    const spec = especificacao(qualidade);
    if (!spec || !modelo || falhou || descartado) return;
    if (atlas && atlas.spec.N === spec.N && atlas.spec.cw === spec.cw && atlas.spec.ch === spec.ch) return;
    if (specAssando && specAssando.qualidade === spec.qualidade) return;
    specAssando = spec;
    try { assador = criarAssador(modelo, spec); } catch (e) { falhou = true; assador = null; return; }
    msAssando = 0;
    fatia();
  }
  function fatia() {
    if (agendado || !assador || descartado) return;
    agendado = true;
    agendar(prazo => {
      agendado = false;
      if (!assador || descartado) return;
      // o tempo ocioso que o navegador deu (até 2,5 fatias; no prazo vencido — a página sem folga —, uma fatia)
      const livre = prazo && typeof prazo.timeRemaining === 'function' && !prazo.didTimeout ? prazo.timeRemaining() - 1 : I.fatiaMs;
      const ms = Math.max(2, Math.min(2.5 * I.fatiaMs, livre));
      let fim = false;
      try { fim = assador.passo(ms); } catch (e) { falhou = true; assador = null; return; }
      msAssando = assador.resultado?.ms ?? msAssando + ms;
      if (fim) concluir(assador.resultado); else fatia();
    });
  }
  /** O atlas ficou pronto: as texturas, os blocos de cada torcedor e o programa com os dois ramos na torcida. */
  function concluir(r) {
    assador = null; specAssando = null;
    try {
      const novo = texturas(r);
      tex?.a.dispose(); tex?.b.dispose();
      tex = novo; atlas = r;
      U.uImpA.value = tex.a; U.uImpB.value = tex.b;
      U.uImpN.value = r.spec.N; U.uImpCel.value.set(r.spec.cw, r.spec.ch); U.uImpTam.value.set(r.spec.largura, r.spec.altura);
      for (let o = 0; o < OBJETOS; o++) { ret[o].fromArray(r.ret, 4 * o); cen[o].fromArray(r.cen, 4 * o); }
      if (!mapa) mapa = blocosDosTorcedores(grade.blocos, torcida.dados.pos, torcida.dados.n);
      if (!ligado) {
        ligado = torcida.ligarImpostor({ ...GLSL_IMPOSTOR, uniforms: U, rumo: mapa.rumo });
        if (!ligado) falhou = true;
      }
      anteriores = new Set(); chave = '';
    } catch (e) { falhou = true; torcida.desligarImpostor?.(); ligado = false; }
  }
  /** Os torcedores desenhados (nível ≤ a qualidade) de cada bloco: o teto conta estes. */
  function porBloco() {
    const q = qIdx();
    if (nPor && nPorQ === q) return nPor;
    const d = torcida.dados, nb = grade.blocos.length;
    nPor = new Int32Array(nb);
    for (let b = 0; b < nb; b++) { let k = 0; for (let j = mapa.inicio[b]; j < mapa.inicio[b + 1]; j++) if (d.nivel[mapa.idx[j]] <= q) k++; nPor[b] = k; }
    nPorQ = q;
    return nPor;
  }
  /** Escreve os torcedores dos blocos escolhidos (o aLod): só quando a escolha muda. */
  function aplicar(lista) {
    const k = [...lista].sort((a, b) => a - b).join(',');
    if (k === chave) return;
    chave = k;
    const idx = [];
    for (const b of lista) for (let j = mapa.inicio[b]; j < mapa.inicio[b + 1]; j++) idx.push(mapa.idx[j]);
    torcida.definirLod(idx);
  }
  return {
    /** O modelo do torcedor 3D chegou (render/torcedor3d.js): assa o atlas da qualidade (fora da Baixa). */
    preparar(m) { if (!modelo && m) { modelo = m; assar(); } },
    /**
     * Um quadro: cam = {x, y, z, fx, fy, fz, fov, aspecto, alturaPx} (a de render/cadeiras3d.js), deJogo (a TV de jogo: na
     * Média, nada em impostor), semCa (a câmera dentro do lado de cá: os blocos dele não entram).
     */
    atualizar(cam, deJogo = false, semCa = false) {
      if (!ligado || !atlas || !torcida.impostor?.ligado) return;
      const Q = I.qual[qualidade];
      if (!Q || (deJogo && !Q.naTV) || pausado) { anteriores = new Set(); aplicar(anteriores); return; }
      const r = escolherImpostor(grade.blocos, cam, anteriores, { pxEntra: Q.pxEntra, pxSai: Q.pxSai, teto: Q.teto, nPor: porBloco(), semSetor: semCa ? 3 : null });
      anteriores = r.lista;
      aplicar(r.lista);
    },
    definirQualidade(q) {
      if (q === qualidade) return;
      qualidade = q; nPor = null;
      if (!I.qual[q]) { anteriores = new Set(); if (ligado) aplicar(anteriores); return; }
      assar();
    },
    definirHora(h) { hora = h; definirHoraU(); },
    /** Testes: o mesmo quadro com e sem o impostor (pausado: todos no quadro SDF; o atlas e o programa ficam). */
    pausar(v) { pausado = !!v; },
    /**
     * O impostor agora (testes e medidas): {pronto (o atlas e o programa), assando (0–1, ou null), falhou, ms (o tempo do
     * assamento), spec, blocos (em impostor), torcedores (em impostor), mapeados (torcedores com bloco), largura, altura}.
     */
    get estado() {
      const ti = torcida.impostor;
      return {
        pronto: ligado && !!atlas && !!ti?.ligado, assando: assador ? assador.progresso : null, falhou: falhou || !!ti?.falhou, ms: atlas ? atlas.ms : msAssando,
        spec: atlas ? { qualidade: atlas.spec.qualidade, N: atlas.spec.N, celula: [atlas.spec.cw, atlas.spec.ch], largura: atlas.spec.largura, altura: atlas.spec.altura } : null,
        blocos: anteriores.size, torcedores: ti?.torcedores ?? 0, mapeados: mapa ? mapa.idx.length : 0,
      };
    },
    /** O resultado do assamento (testes: o atlas, os retângulos, os centros) e o mapa dos blocos. */
    get resultado() { return atlas; },
    get mapa() { return mapa; },
    get uniforms() { return U; },
    dispose() { descartado = true; assador = null; tex?.a.dispose(); tex?.b.dispose(); torcida.desligarImpostor?.(); },
  };
}
