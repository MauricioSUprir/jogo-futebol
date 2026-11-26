// A sombra do estádio no desenho (item 46; a conta pura e o GLSL em js/sombra-estadio.js; contrato "Sombra do estádio (item
// 46)" no CONTRATOS.md): a TEXTURA da máscara (R 8 bits, a distância com sinal à borda da sombra, 384 × 288 texels de 0,5 m:
// ~110 KB; nenhum mapa de sombra novo, nenhum render target, nenhuma chamada de desenho a mais), os UNIFORMS compartilhados
// (os mesmos objetos em todo material: trocar a textura ou a força não recompila nada) e a injeção nos materiais
// (`comSombraEstadio`: o gramado, o chão de fora, as linhas, os gols, as bandeirinhas, as placas, os jogadores dos dois corpos,
// a bola e, só abaixo de 0,25 m, o piso das plantas na malha das arquibancadas).
//
// A máscara sai da planta do estádio (definirEstadioSombra, no criarCampo) EM FATIAS no tempo ocioso (requestIdleCallback; o
// cálculo inteiro leva ~50–170 ms no PC e não pode travar a montagem do 3D nem um toque): até ela chegar, e de noite, a força
// fica 0 (o fator é 1: o desenho de antes) e ela entra em 0,8 s. O ?sombra=sync (e, sem o ?sombra=fatias, o webdriver) calcula
// de uma vez na carga; o ?sombra=0 e o ?gfx=antigo desligam (os materiais saem sem a injeção: o shader de antes).
import * as THREE from 'three';
import { SOL_DIA, calcularMascara, mascaraVazia, uniformsDaMascara, trocasSombra, SOMBRA_TRECHO_LUZ } from '../sombra-estadio.js';
import { aplicarTrocas } from './gramado-shader.js';
import { GRAFICOS } from './graficos-opcoes.js';

/** Ligada nesta página (sem o ?sombra=0 e sem o ?gfx=antigo). */
export const SOMBRA_LIGADA = GRAFICOS.sombra !== false;
// de uma vez na carga: o ?sombra=sync e, sem o ?sombra=fatias, com webdriver (o quadro de um teste não pode depender de quando o
// tempo ocioso chegou: o teste-graficos-pagina compara cargas diferentes pixel a pixel)
const DE_UMA_VEZ = GRAFICOS.sombra === 'sync' || (GRAFICOS.sombra !== 'fatias' && typeof navigator !== 'undefined' && !!navigator.webdriver);

function texturaDe(m) {
  const t = new THREE.DataTexture(m.dados, m.nx, m.nz, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/** Os uniforms da sombra do estádio: os MESMOS objetos em todos os materiais (render/campo.js, jogador3d, humano3d, bola3d). */
export const UNIFORMS_SOMBRA = {
  uSombraMapa: { value: null }, uSombraCaixa: { value: new THREE.Vector4() }, uSombraK: { value: new THREE.Vector2() },
  uSombraFaixa: { value: 3 }, uSombraBorda: { value: 0.2 }, uSombraForca: { value: 0 },
};

const estado = { ligada: SOMBRA_LIGADA, pronta: false, hora: 'dia', fora: false, ms: 0, sombra: 0, npecas: 0, mascara: null, fatias: 0, maiorFatia: 0, teste: null };
let vez = 0;

function usarMascara(m) {
  const U = uniformsDaMascara(m);
  const velha = UNIFORMS_SOMBRA.uSombraMapa.value;
  UNIFORMS_SOMBRA.uSombraMapa.value = texturaDe(m);
  velha?.dispose();
  UNIFORMS_SOMBRA.uSombraCaixa.value.set(...U.caixa);
  UNIFORMS_SOMBRA.uSombraK.value.set(...U.k);
  UNIFORMS_SOMBRA.uSombraFaixa.value = U.faixa;
  UNIFORMS_SOMBRA.uSombraBorda.value = U.borda;
  estado.mascara = m;
}
usarMascara(mascaraVazia());

// a força que a regra pede agora e a de antes da última mudança: a máscara que fica pronta no meio da partida (sem a tela antes
// do jogo nem o pré-jogo, que dão tempo de sobra) entra em `FADE_S` s (passoSombra, por quadro) — nada de pular de um quadro
// para o outro; a hora, os planos de fora e os testes mudam na hora
const FADE_S = 0.8;
let alvo = 0, fade = null;
function forca(suave = false) {
  alvo = estado.ligada && estado.pronta && estado.hora !== 'noite' && !estado.fora ? 1 : 0;
  // (os testes desligam a sombra no mesmo quadro para comparar os pixels: forcaTeste(0); null volta à regra)
  if (estado.teste != null) { fade = null; UNIFORMS_SOMBRA.uSombraForca.value = estado.teste; return; }
  if (suave && alvo !== UNIFORMS_SOMBRA.uSombraForca.value) fade = { de: UNIFORMS_SOMBRA.uSombraForca.value, t0: null };
  else { fade = null; UNIFORMS_SOMBRA.uSombraForca.value = alvo; }
}
/** Por quadro (render/campo.js atualizar; t em s): a entrada suave da máscara que chegou. */
export function passoSombra(t) {
  if (!fade) return;
  if (fade.t0 == null) fade.t0 = t;
  const u = Math.min(1, Math.max(0, (t - fade.t0) / FADE_S));
  UNIFORMS_SOMBRA.uSombraForca.value = fade.de + (alvo - fade.de) * u * u * (3 - 2 * u);
  if (u >= 1) fade = null;
}

const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const ocioso = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(() => fn(null), 16));

/**
 * O estádio desta partida: `planta` = a planta da forma (identidade forma3d.planta) ou null (o Estádio Golaço). Começa o cálculo
 * da máscara (em fatias no tempo ocioso; com o ?sombra=sync, de uma vez) e devolve uma promessa que resolve quando ela está na
 * textura (ou na hora, desligada).
 */
export function definirEstadioSombra(planta = null) {
  return (promessa = calcular(planta));
}
let promessa = Promise.resolve(estado);
/** A promessa da máscara pedida por último (testes: __golaco.sombraEstadio.esperar()). */
export function esperarSombra() { return promessa; }
function calcular(planta) {
  const minha = ++vez;
  estado.pronta = false;
  forca();
  if (!estado.ligada) return Promise.resolve(estado);
  const t0 = agora();
  let it;
  try { it = calcularMascara(planta, SOL_DIA); } catch (e) { console.error('sombra do estádio: a máscara falhou', e); return Promise.resolve(estado); }
  const terminar = m => {
    usarMascara(m);
    estado.pronta = true;
    estado.ms = agora() - t0;
    estado.sombra = m.sombra;
    estado.npecas = m.npecas;
    // (de uma vez, na carga: sem a entrada suave)
    forca(!DE_UMA_VEZ);
    return estado;
  };
  estado.fatias = 0; estado.maiorFatia = 0;
  const passo = () => {
    const ta = agora();
    const r = it.next();
    estado.fatias++;
    estado.maiorFatia = Math.max(estado.maiorFatia, agora() - ta);
    return r;
  };
  if (DE_UMA_VEZ) {
    try { let r; do r = passo(); while (!r.done); return Promise.resolve(terminar(r.value)); } catch (e) { console.error('sombra do estádio: a máscara falhou', e); return Promise.resolve(estado); }
  }
  return new Promise(ok => {
    const rodar = prazo => {
      if (minha !== vez) { ok(estado); return; }
      try {
        // fatias enquanto sobra tempo ocioso (o que o navegador diz, menos 2 ms) ou, chamada pelo prazo (sem tempo ocioso: o
        // jogo ocupa todos os quadros), até 6 ms — no mínimo uma por chamada
        const fim = agora() + (prazo && !prazo.didTimeout ? Math.max(0, prazo.timeRemaining() - 2) : 6);
        let r;
        do r = passo(); while (!r.done && agora() < fim);
        if (r.done) { ok(terminar(r.value)); return; }
      } catch (e) { console.error('sombra do estádio: a máscara falhou', e); ok(estado); return; }
      ocioso(rodar);
    };
    ocioso(rodar);
  });
}

/** A hora: de noite (refletores) a força é 0. */
export function definirHoraSombra(hora) { estado.hora = hora; forca(); }
/** Os planos de FORA do estádio que trocam o sol (render/estadio-real.js luzDoRio): a máscara é do sol do jogo — força 0. */
export function definirForaSombra(v) { estado.fora = !!v; forca(); }

/** Testes: a força forçada (0 ou 1; null = a regra: ligada, pronta, de dia e fora dos planos de fora). */
export function forcaTesteSombra(v) { estado.teste = v == null ? null : +v; forca(); }

/** O estado (testes): {ligada, pronta, hora, ms, sombra (a fração da caixa), npecas, fatias, maiorFatia, forca, mascara}. */
export function estadoSombra() { return { ...estado, forca: UNIFORMS_SOMBRA.uSombraForca.value }; }

const LUZES = THREE.ShaderChunk.lights_fragment_begin;
if (SOMBRA_LIGADA && !LUZES.includes(SOMBRA_TRECHO_LUZ)) console.error(`sombra do estádio: o lights_fragment_begin do three não tem "${SOMBRA_TRECHO_LUZ}" — a luz do sol sai sem a sombra do estádio`);

/**
 * Liga a sombra do estádio no material (Lambert ou Standard/Physical; encadeia o onBeforeCompile dele e acrescenta à chave do
 * cache). opc.soChao: só abaixo de 0,25 m do mundo (o piso das plantas na malha das arquibancadas). Desligada (?sombra=0,
 * ?gfx=antigo), o material sai como estava. Devolve o material.
 */
export function comSombraEstadio(mat, opc = {}) {
  if (!SOMBRA_LIGADA || mat.userData.sombraEstadio) return mat;
  mat.userData.sombraEstadio = true;
  const T = trocasSombra(LUZES, { soChao: !!opc.soChao });
  const antes = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
  const chaveAntes = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  const nome = mat.name || mat.type;
  mat.onBeforeCompile = (sh, r) => {
    if (antes) antes.call(mat, sh, r);
    Object.assign(sh.uniforms, UNIFORMS_SOMBRA);
    sh.vertexShader = aplicarTrocas(sh.vertexShader, T.vertex, `sombra do estádio (${nome}), vertex`);
    sh.fragmentShader = aplicarTrocas(sh.fragmentShader, T.fragment, `sombra do estádio (${nome}), fragment`);
  };
  // (sem chave própria, a do three é o texto do onBeforeCompile: o de antes, para dois materiais diferentes não dividirem um
  // programa pela chave do invólucro)
  const base = chaveAntes ? () => chaveAntes.call(mat) : antes ? () => antes.toString() : () => '';
  const suf = opc.soChao ? '|sombra-estadio-chao-v1' : '|sombra-estadio-v1';
  mat.customProgramCacheKey = () => base() + suf;
  mat.needsUpdate = true;
  return mat;
}
