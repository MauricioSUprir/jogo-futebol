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
import { IMPOSTOR, OBJETOS, especificacao, criarAssador, escolherImpostor, blocosDosTorcedores, GLSL_IMPOSTOR } from './impostor-dados.js';
import { TORCEDOR3D } from './torcedor-dados.js';

const T3 = TORCEDOR3D, I = IMPOSTOR;
// o sol do dia (o mesmo do quadro e do torcedor 3D: render/torcida.js SOL_DIA) e, à noite, os refletores (de cima)
const SOL = (() => { const s = [-0.42, 0.74, 0.52], l = Math.hypot(...s); return new THREE.Vector3(s[0] / l, s[1] / l, s[2] / l); })();
// (os TEXTOS do ramo do impostor na torcida, novo e o de antes do item 45: render/impostor-dados.js glslImpostor)

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
      if (!ligado || !atlas || !torcida.impostorLigado) return;
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
