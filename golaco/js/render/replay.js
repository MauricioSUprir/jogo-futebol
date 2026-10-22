// Diretor do REPLAY (render): guarda os gatilhos (gol, impedimento, pausa, paradas), monta o roteiro (replay-roteiro.js),
// anda o relógio do replay e posiciona a câmera de cada plano olhando o que o anel gravou (replay-anel.js). Só LÊ o
// anel: o mundo e o hash não mudam (a simulação fica parada no main.js enquanto o replay toca, como na pausa; o
// replay pode ser interrompido em qualquer quadro sem mexer em nada — "kill cam" do Overwatch, GDC 2017).
//
// Câmeras (PESQUISA-ESTADIO.md §Replay):
//  - 'tv': a MESMA câmera de TV do jogo (camera.js), numa instância só do replay, seguindo a bola gravada;
//  - 'atras': atrás do gol, alta (por cima da rede), um pouco para o lado da bola — o chute vem na direção da câmera;
//  - 'lateral': na beira do campo do lado da TV, na altura dos olhos, teleobjetiva (só no golaço);
//  - 'linha': ALINHADA com a linha de impedimento (no x da linha, alta, do lado da TV): a linha fica em pé no quadro,
//    como a imagem do VAR; o enquadramento fecha no impedido e no defensor da linha (o do evento) na hora do passe (fixo
//    o plano inteiro, sem tremer);
//  - 'saot': a ANÁLISE semiautomática (replay-saot.js): o quadro do passe congelado, só os jogadores do lance, a câmera
//    em órbita do alto até o quadro final oblíquo e fora do centro (calculado uma vez por roteiro), parede, plano, pulsos
//    e a decisão (`cena(dt)` diz ao main.js o que desenhar; o selo vai para o terço de baixo do HUD);
//  - 'primeira' (12/10): a 1ª PESSOA do autor do gol (replay-olhos.js: o olho na cabeça gravada, estabilizado, e o olhar
//    na bola e no gol), campo de visão HORIZONTAL de 90° fixo, plano de recorte próximo de 0,10 m; `desenho()` diz ao main.js
//    que o autor fica sem cabeça e tronco (ocultar) e quando a bola some (perto da lente);
//  - 'treinador' (12/10): a VISÃO DO TREINADOR do time que marcou — parte 1, o que ele vê (teleobjetiva fixa; ele sai da
//    lista de desenho) e, no `corte`, a parte 2: ele reagindo, da câmera parada no gramado (replay-olhos.js);
//  - 'fechada' (22/10, replays nas paradas): a MESMA instância de TV do replay com o campo de visão fechado
//    (REPLAY_PARADA.lento.fov) e o alvo puxado para o ponto do lance (a falta), misturado com a bola — o "replay mais
//    fechado e mais lento" da TV (patente US7657836). O roteiro da parada (roteiroParada) vem do lance da bola morta
//    (js/lances.js), pedido pelo main.js no passo antes da montagem (parada).
// Pós-gol: o gol fica PENDENTE (aoGol) e o replay só entra quando o pós-gol chega na vez dele (depoisDoGol). Hoje
// quem chama é a saída de bola; a cena de comemoração (outra frente) entra ANTES e chama depoisDoGol quando acabar.
import * as THREE from 'three';
import { CAMPO, REPLAY } from '../config.js';
import { REPLAY_PARADA } from '../lances.js';
import { criarCamera } from './camera.js';
import { jogadorNoTick, defensorDaLinha, bolaNoTick } from './replay-anel.js';
import { cameraPrimeira, cameraTreinador, fovVerticalDe, cameraLateral, tecnicosNoTick, zLateralDoPlano } from './replay-olhos.js';
import {
  roteiroGol, roteiroImpedimento, roteiroMenu, roteiroParada, duracao, criarRelogio, iniciarRelogio, pararRelogio, avancarRelogio,
  planoAtual, velocidadeAgora, linhaDoReplay, tempoSaot, roteiroLegalTeste,
} from './replay-roteiro.js';
import { enquadrarSaot, cameraSaot, faseSaot, checagemLegal } from './replay-saot.js';

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
  const _b0 = { x: 0, y: 0, z: 0 }, _b1 = { x: 0, y: 0, z: 0 };
  // análise semiautomática: o quadro final (uma vez por roteiro), a câmera da órbita, a fase e o que desenhar
  const enqS = {}, camS = {}, faseS = {};
  let planoS = null, ultimoImped = null, reduzir = false, reduzirForcado = null;
  // 1ª pessoa e treinador: a câmera do quadro e o que o main.js desenha diferente (ocultar o autor, tirar o treinador,
  // esconder a bola perto da lente)
  const camP = {}, camT = {}, _tecs = [], _lat = { x: 0, y: 0, z: 0 };
  const desenhoX = { ocultar: null, sem: null, semBola: false };
  const cenaS = {
    ativa: false, tipo: null, ids: [], parede: 0, plano: 0, pulsoDef: 0, pulsoAtac: 0, batidaDef: 0, batidaAtac: 0, cor: 0,
    selo: 0, decidido: false, mesmaLinha: false, fase: null, t: 0, cena: null,
  };
  const _cenaInativa = { ativa: false };
  /** "Reduzir movimento" agora (o forçado dos testes, senão o do sistema): sem 1ª pessoa no roteiro do gol. */
  const reduzirAgora = () => reduzirForcado ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** fov vertical de um plano fixo: f em 16:9 ou mais largo; mais estreito abre para a mesma largura. */
  function fovFixo(f) {
    const a = aspectoAtual;
    if (a >= ASPECTO_TV) return f;
    return (2 * Math.atan(Math.tan((f * Math.PI) / 360) * ASPECTO_TV / a) * 180) / Math.PI;
  }
  function ajustarFov(f, perto = 0.5) {
    if (Math.abs(camera.fov - f) > 1e-4 || camera.aspect !== aspectoAtual || camera.near !== perto) { camera.fov = f; camera.aspect = aspectoAtual; camera.near = perto; camera.updateProjectionMatrix(); }
  }

  /**
   * Câmera 'linha': no x da linha, alta, do lado da TV; o fov cobre o impedido e o defensor da linha (com folga) — o do
   * evento (o penúltimo da decisão); sem ele (eventos antigos), o mais perto da linha.
   */
  function enquadrarLinha(ro) {
    const L = REPLAY.linha, zc = CAMPO.meioZ + L.fora, h = L.altura;
    enq.x = ro.linhaX; enq.z = zc;
    let z0 = Infinity, z1 = -Infinity;
    const imp = jogadorNoTick(anel, ro.fotoTick, ro.idImpedido, _j);
    if (imp) { z0 = Math.min(z0, imp.z); z1 = Math.max(z1, imp.z); }
    const def = ro.defensor != null && ro.defensor >= 0 ? jogadorNoTick(anel, ro.fotoTick, ro.defensor, _d) : ro.defensor === undefined ? defensorDaLinha(anel, ro.fotoTick, 1 - ro.time, ro.linhaX, 1.5, _d) : null;
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
      // o replay SABE para onde a bola vai: a câmera de TV antecipa pela velocidade da bola gravada à frente (o jogo ao
      // vivo antecipa pela do controlado), limitada, sem atravessar o fim do plano
      const T = REPLAY.tv, t0 = Math.floor(rel.t), t1 = Math.min(p.ate, t0 + Math.round(T.olhaFrente * 60));
      const b0 = bolaNoTick(anel, t0, _b0), b1 = t1 > t0 ? bolaNoTick(anel, t1, _b1) : null;
      let vx = 0, vz = 0;
      if (b0 && b1) {
        vx = (b1.x - b0.x) * 60 / (t1 - t0); vz = (b1.z - b0.z) * 60 / (t1 - t0);
        const v = Math.hypot(vx, vz);
        if (v > T.velMax) { vx *= T.velMax / v; vz *= T.velMax / v; }
      }
      _alvo.jx = bp.x; _alvo.jz = bp.z; _alvo.jvx = vx; _alvo.jvz = vz; _alvo.bx = bp.x; _alvo.bz = bp.z;
      tv.atualizar(dtR, _alvo, corte);
      camera.position.copy(tv.camera.position); camera.quaternion.copy(tv.camera.quaternion);
      ajustarFov(tv.camera.fov);
      const f = tv.foco(); _foco.x = f.x; _foco.z = f.z;
      return _foco;
    }
    if (p.cam === 'fechada') {
      // a mesma TV do replay, fechada no lance: a posição é a da TV (a mola dela, com o ponto do lance como "jogador" e a
      // bola na mistura), mas o OLHAR vai direto ao ponto entre o lance e a bola — o foco da TV fica preso dentro do campo
      // (camera.js limX ±38,5) e, com o campo de visão × lento.fov, a falta perto da linha de fundo saía do quadro
      const lx = Number.isFinite(ro.x) ? ro.x : bp.x, lz = Number.isFinite(ro.z) ? ro.z : bp.z;
      _alvo.jx = lx; _alvo.jz = lz; _alvo.jvx = 0; _alvo.jvz = 0; _alvo.bx = bp.x; _alvo.bz = bp.z;
      tv.atualizar(dtR, _alvo, corte);
      const M = REPLAY_PARADA.lento.mistura, ax = lx + (bp.x - lx) * M, az = lz + (bp.z - lz) * M;
      camera.position.copy(tv.camera.position);
      camera.lookAt(ax, 0, az);
      ajustarFov(tv.camera.fov * REPLAY_PARADA.lento.fov);
      _foco.x = ax; _foco.z = az;
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
      // nunca dentro de um treinador gravado: com um deles perto do caminho dela no plano, ela fica na frente da área técnica
      // o plano INTEIRO (o z é decidido uma vez por plano: antes pulava 2,5 m no meio dele); e sempre a ≥ 0,6 m deles
      if (seg.planoLat !== p) { seg.planoLat = p; seg.zLat = zLateralDoPlano(anel, p.de, p.ate, s); }
      cameraLateral(seg.cx, tecnicosNoTick(anel, Math.round(rel.t), _tecs), _lat, seg.zLat);
      camera.position.set(_lat.x, _lat.y, _lat.z);
      camera.lookAt(seg.lx, 0.9, seg.lz);
      ajustarFov(fovFixo(Lt.fov));
      _foco.x = seg.lx; _foco.z = seg.lz;
      return _foco;
    }
    if (p.cam === 'primeira' && p.enq) {
      cameraPrimeira(p.enq, rel.t, camP);
      camera.position.set(camP.x, camP.y, camP.z);
      camera.lookAt(camP.lx, camP.ly, camP.lz);
      ajustarFov(fovVerticalDe(camP.fovH, aspectoAtual), REPLAY.primeira.perto);
      _foco.x = camP.x; _foco.z = camP.z;
      return _foco;
    }
    if (p.cam === 'treinador' && p.enq) {
      cameraTreinador(p.enq, rel.t, aspectoAtual, pequena, camT);
      camera.position.set(camT.x, camT.y, camT.z);
      camera.lookAt(camT.lx, camT.ly, camT.lz);
      ajustarFov(camT.fov);
      // a sombra acompanha o que o quadro mostra: na parte 1 o campo lá longe; na parte 2 ele
      _foco.x = camT.parte === 1 ? clamp(camT.lx, -CAMPO.meioX, CAMPO.meioX) : camT.lx; _foco.z = camT.parte === 1 ? clamp(camT.lz, -CAMPO.meioZ, CAMPO.meioZ) : camT.lz;
      return _foco;
    }
    if (p.cam === 'saot') {
      // análise: órbita do alto até o quadro final (sem órbita com "reduzir movimento")
      faseSaot(tempoSaot(rel), p.saot.tipo, faseS, p.saot.mesmaLinha, reduzir);
      cameraSaot(enqS, faseS.u, camS, reduzir);
      camera.position.set(camS.x, camS.y, camS.z);
      camera.lookAt(camS.alvoX, camS.alvoY, camS.alvoZ);
      ajustarFov(camS.fov);
      _foco.x = camS.alvoX; _foco.z = camS.alvoZ;
      return _foco;
    }
    // 'linha': fixa o plano inteiro (a linha em pé no meio do quadro)
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
      let saot = null;
      if (p && p.cam === 'saot') {
        const sc = p.saot;
        faseSaot(tempoSaot(rel), sc.tipo, faseS, sc.mesmaLinha, reduzir);
        cameraSaot(enqS, faseS.u, camS, reduzir);
        saot = {
          tipo: sc.tipo, fase: faseS.fase, t: faseS.t, el: camS.el, az: camS.az, idDef: sc.idDef, idAtac: sc.idAtac, idPor: sc.idPor,
          margem: sc.margem, linhaX: sc.linhaX, lado: sc.lado, fotoTick: sc.fotoTick, mesmaLinha: sc.mesmaLinha, selo: faseS.selo,
          enquadrado: !!enqS.ok, desvio: enqS.desvio, elFim: enqS.el, dist: enqS.d, ladoCamera: enqS.lado,
        };
      }
      return {
        ativo: rel.ativo, tipo: ro?.tipo ?? null, plano: rel.i, planos: ro?.planos.length ?? 0, cam: p?.cam ?? null,
        tick: rel.t, vel: velocidadeAgora(rel), congelado: !!(p && p.congela && !rel.congelou && rel.t >= p.congela.tick),
        quadros: rel.quadros, duracao: duracao(ro), golaco: !!ro?.golaco, fotoTick: ro?.fotoTick ?? null, linhaX: ro?.linhaX ?? null,
        chuteTick: ro?.chuteTick ?? null, golTick: ro?.golTick ?? null, de: p?.de ?? null, ate: p?.ate ?? null,
        checagem: !!ro?.checagem, cams: ro ? ro.planos.map(q => q.cam) : [], saot,
        // replay de parada (22/10): a classe ('A' | 'B'), o lance (lances.js TIPOS_LANCE), a chave e o desfecho
        classe: ro?.classe ?? null, lance: ro?.lance ?? null, chave: ro?.chave ?? null, fim: ro?.fim ?? null,
        // 1ª pessoa e treinador: o autor, o treinador, o corte e a parte agora, o campo de visão
        autor: p?.cam === 'primeira' ? p.autor : null, tecnico: p?.cam === 'treinador' ? p.tecnico : null, corte: p?.corte ?? null,
        parte: p?.cam === 'treinador' ? (p.corte != null && rel.t >= p.corte ? 2 : 1) : null,
        fovH: p?.cam === 'primeira' ? REPLAY.primeira.fovH : p?.cam === 'treinador' && p.enq ? p.enq.fovH : null,
        duracoes: ro ? ro.planos.map(q => +(q.congela ? 0 : (q.ate - q.de) / 60 / q.vel).toFixed(3)) : [],
      };
    },
    redimensionar(a, peq) {
      aspectoAtual = a; pequena = !!peq; tv.redimensionar(a, peq); camera.aspect = a; camera.updateProjectionMatrix();
      // o quadro final da análise depende do aspecto da tela
      if (planoS && rel.ativo) enquadrarSaot(anel, planoS.saot, aspectoAtual, enqS);
    },
    // ---------------------------------------------------------------- gatilhos
    /**
     * Gol (evento 'gol'): fica pendente até o pós-gol chegar na vez do replay. g = {golTick, chuteTick, lado, time, autor,
     * contra, desvio, tipoChute}.
     */
    aoGol(g) { gol = { ...g }; ultimoGol = gol; },
    get golPendente() { return gol; },
    /**
     * GANCHO DO PÓS-GOL: o roteiro do replay do gol pendente (e o esquece), ou null. Ordem da transmissão: gol →
     * comemoração (outra frente: chama isto quando acabar) → replay → saída de bola. Hoje quem chama é a saída.
     */
    depoisDoGol() { const g = gol; gol = null; return g ? roteiroGol(anel, { ...g, reduzirMovimento: reduzirAgora() }) : null; },
    descartarGol() { gol = null; },
    /** Roteiro do último gol de novo (API e prints; golaco força o plano lateral). */
    reverGol(golaco, opc = {}) { return ultimoGol ? roteiroGol(anel, { ...ultimoGol, golaco: golaco ?? undefined, reduzirMovimento: reduzirAgora(), ...opc }) : null; },
    /** Roteiro do impedimento ({fotoTick, apitoTick, linhaX, idImpedido, time, lado, defensor, por}); guarda o último. */
    impedimento(i) { ultimoImped = { ...i }; return roteiroImpedimento(anel, i); },
    /** Roteiro do "Replay" da pausa (últimos 10 s; com a checagem de posição legal no fim, se houver). */
    menu() { return roteiroMenu(anel); },
    /** Roteiro do replay de uma parada (o lance da bola morta: lances.js; roteiroParada), ou null. */
    parada(lance) { return roteiroParada(anel, lance); },
    /**
     * Testes e prints: 'impedimento' = o último impedimento de novo (se o passe ainda está no anel); 'legal' = a checagem
     * de posição legal mais apertada do anel, sem exigir chute nem gol. Null se não há.
     */
    saotDeTeste(tipo, opc = {}) { return tipo === 'legal' ? roteiroLegalTeste(anel, opc.limite) : ultimoImped ? roteiroImpedimento(anel, ultimoImped) : null; },
    /** A margem (m) da posição legal mais apertada no anel agora (sem exigir chute nem gol; até `limite` m), ou null. */
    legalMaisApertada(limite = 60) { const c = checagemLegal(anel, { teste: true, limite }); return c ? c.margem : null; },
    // ---------------------------------------------------------------- relógio
    /** Começa um roteiro (false se vazio). */
    iniciar(ro) {
      if (!iniciarRelogio(rel, ro)) return false;
      seg.corte = true;
      if (ro.tipo === 'impedimento') enquadrarLinha(ro);
      // análise semiautomática: o quadro final uma vez por roteiro
      planoS = ro.planos.find(q => q.cam === 'saot') ?? null;
      if (planoS) enquadrarSaot(anel, planoS.saot, aspectoAtual, enqS);
      reduzir = reduzirForcado ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      return true;
    },
    pular() { pararRelogio(rel); planoS = null; },
    /** Mundo novo: esquece o gol pendente e para o replay. */
    limpar() { pararRelogio(rel); gol = null; ultimoGol = null; ultimoImped = null; planoS = null; },
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
    /** Linha de impedimento do quadro: {visivel, x, opacidade, cor} (P1 do impedimento do passe em diante; análise). */
    linha(dt) { return linhaDoReplay(rel, dt, _linha); },
    /**
     * O que a análise desenha neste quadro (no plano 'saot'; senão {ativa: false}): {ativa, tipo, ids (o impedido, o
     * defensor, quem passou), parede, plano, pulsoDef, pulsoAtac (0–1), batidaDef, batidaAtac (0–1), cor (0 → 1:
     * neutro → decisão), selo (0–1), decidido, mesmaLinha, fase, t, cena (posições: replay-saot.js)}.
     */
    cena() {
      const p = planoAtual(rel);
      if (!p || p.cam !== 'saot') { cenaS.ativa = false; return _cenaInativa; }
      const sc = p.saot;
      faseSaot(tempoSaot(rel), sc.tipo, faseS, sc.mesmaLinha, reduzir);
      cenaS.ativa = true; cenaS.tipo = sc.tipo; cenaS.cena = sc; cenaS.mesmaLinha = sc.mesmaLinha;
      cenaS.ids.length = 0; cenaS.ids.push(sc.idAtac); if (sc.idDef >= 0) cenaS.ids.push(sc.idDef); if (sc.idPor >= 0) cenaS.ids.push(sc.idPor);
      cenaS.parede = faseS.parede; cenaS.plano = faseS.plano; cenaS.pulsoDef = sc.idDef >= 0 ? faseS.pulsoDef : 0; cenaS.pulsoAtac = faseS.pulsoAtac;
      cenaS.batidaDef = faseS.batidaDef; cenaS.batidaAtac = faseS.batidaAtac; cenaS.cor = faseS.cor; cenaS.selo = faseS.selo;
      cenaS.decidido = faseS.decidido; cenaS.fase = faseS.fase; cenaS.t = faseS.t;
      return cenaS;
    },
    /**
     * O que o quadro do replay desenha diferente (12/10): {ocultar: id do autor na 1ª pessoa (sem cabeça e tronco), sem: id do
     * treinador fora da lista (parte 1 da visão dele), semBola: a bola perto da lente (1ª pessoa)}.
     */
    desenho() {
      const p = planoAtual(rel);
      desenhoX.ocultar = null; desenhoX.sem = null; desenhoX.semBola = false;
      if (p && p.cam === 'primeira' && p.enq) { desenhoX.ocultar = p.autor; cameraPrimeira(p.enq, rel.t, camP); desenhoX.semBola = camP.bolaSome; }
      if (p && p.cam === 'treinador' && !(p.corte != null && rel.t >= p.corte)) desenhoX.sem = p.tecnico;
      return desenhoX;
    },
    /** A câmera da 1ª pessoa / do treinador no tick fracionário t do plano atual (testes): {x, y, z, lx, ly, lz, fov | fovH, parte}. */
    cameraExtra(t = rel.t) {
      const p = planoAtual(rel);
      if (!p || !p.enq) return null;
      if (p.cam === 'primeira') return { ...cameraPrimeira(p.enq, t, {}), fov: fovVerticalDe(REPLAY.primeira.fovH, aspectoAtual) };
      if (p.cam === 'treinador') return { ...cameraTreinador(p.enq, t, aspectoAtual, pequena, {}) };
      return null;
    },
    /** "Reduzir movimento" (testes: força; null volta a seguir o sistema no próximo roteiro). */
    set reduzirMovimento(v) { reduzirForcado = v == null ? null : !!v; if (v != null) reduzir = !!v; },
    /** Posiciona a câmera do plano olhando a bola desenhada bp; dtR = dt do quadro × velocidade. Devolve o foco. */
    posicionar,
  };
  return api;
}
