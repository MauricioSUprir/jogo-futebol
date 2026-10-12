// Diretor do REPLAY (render): guarda os gatilhos (gol, impedimento, pausa), monta o roteiro (replay-roteiro.js),
// anda o relógio do replay e posiciona a câmera de cada plano olhando o que o anel gravou (replay-anel.js). Só LÊ o
// anel: o mundo e o hash não mudam (a simulação fica parada no main.js enquanto o replay toca, como na pausa; o
// replay pode ser interrompido em qualquer quadro sem mexer em nada — "kill cam" do Overwatch, GDC 2017).
//
// Câmeras (PESQUISA-ESTADIO.md §Replay):
//  - 'tv': a MESMA câmera de TV do jogo (camera.js), numa instância só do replay, seguindo a bola gravada;
//  - 'atras': atrás do gol, alta (por cima da rede), um pouco para o lado da bola — o chute vem na direção da câmera;
//  - 'lateral': na beira do campo do lado da TV, na altura dos olhos, teleobjetiva (só no golaço);
//  - 'linha': ALINHADA com a linha de impedimento (no x da linha, alta, do lado da TV): a linha fica em pé no quadro,
//    como a imagem do VAR; o enquadramento fecha no impedido e no defensor da linha na hora do passe (fixo o replay
//    inteiro, sem tremer).
// Pós-gol: o gol fica PENDENTE (aoGol) e o replay só entra quando o pós-gol chega na vez dele (depoisDoGol). Hoje
// quem chama é a saída de bola; a cena de comemoração (outra frente) entra ANTES e chama depoisDoGol quando acabar.
import * as THREE from 'three';
import { CAMPO, REPLAY } from '../config.js';
import { criarCamera } from './camera.js';
import { jogadorNoTick, defensorDaLinha } from './replay-anel.js';
import {
  roteiroGol, roteiroImpedimento, roteiroMenu, duracao, criarRelogio, iniciarRelogio, pararRelogio, avancarRelogio,
  planoAtual, velocidadeAgora, linhaDoReplay,
} from './replay-roteiro.js';

const ASPECTO_TV = 16 / 9;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GRAU = Math.PI / 180;

export function criarDiretor({ anel, aspecto }) {
  const camera = new THREE.PerspectiveCamera(30, aspecto, 0.5, 900);
  camera.name = 'camera-replay';
  const tv = criarCamera(aspecto);          // a mesma câmera de TV do jogo, numa instância só do replay
  const rel = criarRelogio();
  let gol = null;                           // gol pendente {golTick, chuteTick, lado}
  let ultimoGol = null;                     // o último gol (API e prints: rever o replay dele)
  let aspectoAtual = aspecto, pequena = false;
  const seg = { lx: 0, ly: 0, lz: 0, cx: 0, corte: true };
  // enquadramento da câmera 'linha' (calculado uma vez por roteiro, no quadro do passe)
  const enq = { x: 0, z: 0, olharZ: 0, fov: 30 };
  const _alvo = { jx: 0, jz: 0, jvx: 0, jvz: 0, bx: 0, bz: 0, ax: NaN, az: NaN };
  const _linha = { visivel: false, x: 0, opacidade: 0 };
  const _foco = { x: 0, z: 0 };
  const _j = { x: 0, z: 0, time: 0, goleiro: false }, _d = { id: -1, x: 0, z: 0 };

  /** fov vertical de um plano fixo: f em 16:9 ou mais largo; mais estreito abre para a mesma largura. */
  function fovFixo(f) {
    const a = aspectoAtual;
    if (a >= ASPECTO_TV) return f;
    return (2 * Math.atan(Math.tan((f * Math.PI) / 360) * ASPECTO_TV / a) * 180) / Math.PI;
  }
  function ajustarFov(f) {
    if (Math.abs(camera.fov - f) > 1e-4 || camera.aspect !== aspectoAtual) { camera.fov = f; camera.aspect = aspectoAtual; camera.updateProjectionMatrix(); }
  }

  /** Câmera 'linha': no x da linha, alta, do lado da TV; o fov cobre o impedido e o defensor da linha (com folga). */
  function enquadrarLinha(ro) {
    const L = REPLAY.linha, zc = CAMPO.meioZ + L.fora, h = L.altura;
    enq.x = ro.linhaX; enq.z = zc;
    let z0 = Infinity, z1 = -Infinity;
    const imp = jogadorNoTick(anel, ro.fotoTick, ro.idImpedido, _j);
    if (imp) { z0 = Math.min(z0, imp.z); z1 = Math.max(z1, imp.z); }
    const def = defensorDaLinha(anel, ro.fotoTick, 1 - ro.time, ro.linhaX, 1.5, _d);
    if (def) { z0 = Math.min(z0, def.z); z1 = Math.max(z1, def.z); }
    if (!(z1 >= z0)) { z0 = -6; z1 = 6; }
    z0 = clamp(z0 - L.folga, -CAMPO.meioZ - 1, CAMPO.meioZ); z1 = clamp(z1 + L.folga, -CAMPO.meioZ, CAMPO.meioZ + 1);
    // ângulo de depressão de cada ponta (z maior = mais perto da câmera = mais para baixo no quadro)
    const a0 = Math.atan2(h, zc - z0), a1 = Math.atan2(h, zc - z1);
    const meio = (a0 + a1) / 2;
    enq.fov = clamp((a1 - a0) / GRAU * 1.08, L.fovMin, L.fovMax);
    enq.olharZ = zc - h / Math.tan(meio);
  }

  function posicionar(bp, dtR, lista) {
    const p = planoAtual(rel), ro = rel.roteiro;
    if (!p) return _foco;
    const corte = seg.corte; seg.corte = false;
    const k = corte ? 1 : 1 - Math.exp(-Math.max(0, dtR) * REPLAY.atras.mola);
    seg.lx += (bp.x - seg.lx) * k; seg.lz += (bp.z - seg.lz) * k; seg.ly += (Math.min(bp.y, 3) - seg.ly) * k;
    const s = ro.lado >= 0 ? 1 : -1, MX = CAMPO.meioX;
    if (p.cam === 'tv') {
      _alvo.jx = bp.x; _alvo.jz = bp.z; _alvo.bx = bp.x; _alvo.bz = bp.z;
      tv.atualizar(dtR, _alvo, corte);
      camera.position.copy(tv.camera.position); camera.quaternion.copy(tv.camera.quaternion);
      ajustarFov(tv.camera.fov);
      const f = tv.foco(); _foco.x = f.x; _foco.z = f.z;
      return _foco;
    }
    if (p.cam === 'atras') {
      const A = REPLAY.atras;
      camera.position.set(s * (MX + A.recuo), A.altura, clamp(seg.lz * A.lado, -A.ladoMax, A.ladoMax));
      camera.lookAt(seg.lx, Math.max(0.6, seg.ly * 0.6), seg.lz);
      ajustarFov(fovFixo(pequena ? A.fovCelular : A.fov));
      _foco.x = s * (MX - 8); _foco.z = seg.lz;
      return _foco;
    }
    if (p.cam === 'lateral') {
      const Lt = REPLAY.lateral;
      if (corte) seg.cx = seg.lx - s * Lt.recuo;
      seg.cx += (seg.lx - s * Lt.recuo - seg.cx) * k;
      camera.position.set(seg.cx, Lt.altura, CAMPO.meioZ + Lt.fora);
      camera.lookAt(seg.lx, 0.9, seg.lz);
      ajustarFov(fovFixo(Lt.fov));
      _foco.x = seg.lx; _foco.z = seg.lz;
      return _foco;
    }
    // 'linha': fixa o replay inteiro (a linha em pé no meio do quadro)
    camera.position.set(enq.x, REPLAY.linha.altura, enq.z);
    camera.lookAt(enq.x, 0, enq.olharZ);
    ajustarFov(fovFixo(enq.fov));
    _foco.x = enq.x; _foco.z = clamp(enq.olharZ, -CAMPO.meioZ, CAMPO.meioZ);
    return _foco;
  }

  const api = {
    camera,
    get ativo() { return rel.ativo; },
    get roteiro() { return rel.roteiro; },
    /** Estado para testes e prints. */
    get estado() {
      const p = planoAtual(rel), ro = rel.roteiro;
      return {
        ativo: rel.ativo, tipo: ro?.tipo ?? null, plano: rel.i, planos: ro?.planos.length ?? 0, cam: p?.cam ?? null,
        tick: rel.t, vel: velocidadeAgora(rel), congelado: !!(p && p.congela && !rel.congelou && rel.t >= p.congela.tick),
        quadros: rel.quadros, duracao: duracao(ro), golaco: !!ro?.golaco, fotoTick: ro?.fotoTick ?? null, linhaX: ro?.linhaX ?? null,
        de: p?.de ?? null, ate: p?.ate ?? null,
      };
    },
    redimensionar(a, peq) { aspectoAtual = a; pequena = !!peq; tv.redimensionar(a, peq); camera.aspect = a; camera.updateProjectionMatrix(); },
    // ---------------------------------------------------------------- gatilhos
    /** Gol (evento 'gol'): fica pendente até o pós-gol chegar na vez do replay. g = {golTick, chuteTick, lado}. */
    aoGol(g) { gol = { ...g }; ultimoGol = gol; },
    get golPendente() { return gol; },
    /**
     * GANCHO DO PÓS-GOL: o roteiro do replay do gol pendente (e o esquece), ou null. Ordem da transmissão: gol →
     * comemoração (outra frente: chama isto quando acabar) → replay → saída de bola. Hoje quem chama é a saída.
     */
    depoisDoGol() { const g = gol; gol = null; return g ? roteiroGol(anel, g) : null; },
    descartarGol() { gol = null; },
    /** Roteiro do último gol de novo (API e prints; golaco força o plano lateral). */
    reverGol(golaco) { return ultimoGol ? roteiroGol(anel, { ...ultimoGol, golaco: golaco ?? undefined }) : null; },
    /** Roteiro do impedimento ({fotoTick, apitoTick, linhaX, idImpedido, time, lado}). */
    impedimento(i) { return roteiroImpedimento(anel, i); },
    /** Roteiro do "Replay" da pausa (últimos 10 s). */
    menu() { return roteiroMenu(anel); },
    // ---------------------------------------------------------------- relógio
    /** Começa um roteiro (false se vazio). */
    iniciar(ro) {
      if (!iniciarRelogio(rel, ro)) return false;
      seg.corte = true;
      if (ro.tipo === 'impedimento') enquadrarLinha(ro);
      return true;
    },
    pular() { pararRelogio(rel); },
    /** Mundo novo: esquece o gol pendente e para o replay. */
    limpar() { pararRelogio(rel); gol = null; ultimoGol = null; },
    /** Avança dt s reais (false: acabou). */
    avancar(dt) {
      const vivo = avancarRelogio(rel, dt);
      if (rel.novoPlano) seg.corte = true;
      return vivo;
    },
    /** Tick fracionário que o quadro mostra. */
    get tick() { return rel.t; },
    /** Velocidade agora (0 = congelado). */
    get velocidade() { return velocidadeAgora(rel); },
    /** Linha de impedimento do quadro: {visivel, x, opacidade} (só no replay do impedimento, do passe em diante). */
    linha(dt) { return linhaDoReplay(rel, dt, _linha); },
    /** Posiciona a câmera do plano olhando a bola desenhada bp; dtR = dt do quadro × velocidade. Devolve o foco. */
    posicionar,
  };
  return api;
}
