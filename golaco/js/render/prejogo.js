// Diretor do PRÉ-JOGO (desenho: three.js + DOM; nunca mexe no mundo da partida — o laço fica parado no tick 0 e o
// hash não muda). Toca o roteiro (prejogo-roteiro.js) no relógio do desenho: a câmera de cinema pelos trilhos e
// órbitas, o cortejo (cortejo.js, um mundo à parte: os 22 + 3 árbitros saindo do túnel e fazendo a fila), a torcida e
// o som de cada plano (um ânimo só do pré-jogo, emocao.js), o lado de fora do estádio (estadio-fora.js, descartado
// no fim) e a tela (prejogo-tela.js: abertura, faixas de cinema, preto, Pular e a escalação no campinho).
//
// Tempo do cortejo: os planos cortam e pulam nele (como a TV): o do túnel e o da entrada andam ao vivo (0–12 s), o
// plano alto volta a uma FOTO do instante 31 s calculada antes, aos poucos (≤ 2 ms por quadro, durante a abertura e os
// planos de fora: cortejo "prévia"), e a fila já formada é montada direto (filaFinal). Cada passo do cortejo guarda a
// pose anterior e a atual de cada andante e o desenho interpola (igual ao jogo, a 60/120/144 Hz).
//
// Contrato (main.js): criarPrejogo(ctx) → {iniciar(modo, {abertura}), quadro(dt, agoraMs, desenhar), acao(a),
// proximo(), pularTudo(), irPara(t), ativo, api}. ctx = {cena3d, cam, jog3d, bola3d, campo, torcida, som(),
// mundo(), hora(), qualidade(), comToque(), aoFim()}.
import * as THREE from 'three';
import { PASSO, BOLA } from '../config.js';
import { pose, interpolarPose, NJ, J } from '../anim.js';
import { criarCortejo, passoCortejo, fotoCortejo, restaurarCortejo, filaFinal } from '../cortejo.js';
import { criarRoteiro, planoEm, proximoBloco, cameraEm, cameraAbertura, escuroEm, escalacaoEm, sinaisEm, PREJOGO } from '../prejogo-roteiro.js';
import { noCorredorDoTunel } from '../estadio-forma.js';
import { criarEmocao, emocaoPasso, consumirDisparos } from './emocao.js';
import { forcarFesta } from './festa.js';
import { criarPrejogoTela } from '../prejogo-tela.js';
import { criarEstadioFora } from './estadio-fora.js';

const ASPECTO_TV = 16 / 9;
const NEVOA = { dia: [320, 1700], noite: [160, 1000] };     // névoa nos planos de fora (perto, longe)
const PREVIA_MS = 2;                                          // orçamento por quadro do cortejo "prévia"
// juntas do tronco para cima (a respiração da fila mexe só nelas e na pelve; os pés ficam plantados)
const SUPERIOR = [J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.ombroD, J.cotoveloE, J.cotoveloD, J.maoE, J.maoD];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function aproxima(v, alvo, dt, tau) { return v + (alvo - v) * (1 - Math.exp(-dt / Math.max(1e-3, tau))); }

export function criarPrejogo(ctx) {
  const tela = criarPrejogoTela({
    aoProximo: () => proximo(), aoPularTudo: () => pularTudo(), aoComecar: () => comecar(), comToque: () => ctx.comToque(),
  });
  const st = {
    ativo: false, fase: 'parado', modo: null, r: null, t: 0, tAb: 0, i: -1, c: null, previa: null, fotos: new Map(),
    tcsPrevia: [], filaPronta: false, disparados: new Set(), fora: null, emocao: null, desde: 0, terminando: false,
    nevoa: null, cameraNF: null, cenaSom: { ganho: 1, filtro: null }, ladoDeCaForcado: false,
  };
  // desenho do cortejo: pose anterior/atual/desenhada por andante (nada alocado por quadro)
  const est = [];
  const lista = [];
  const _cam = {}, _sin = {}, _esc = {};
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4(), _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _bola = { x: 0, y: BOLA.raio, z: 0 };
  const ctxEmo = { t: 0, bola: { x: 0, y: 0, z: 0 }, posseTime: null, ataca: { 0: 1, 1: -1 }, estado: 'parada' };

  const camera = () => ctx.cam.camera;
  const plano = () => (st.r && st.i >= 0 ? st.r.planos[st.i] : null);

  // ---------------------------------------------------------------- cortejo
  function estadoDe(k) {
    let e = est[k];
    if (!e) { e = { ant: new Float32Array(NJ * 3), atu: new Float32Array(NJ * 3), des: new Float32Array(NJ * 3), x0: 0, z0: 0, r0: 0, x1: 0, z1: 0, r1: 0 }; est[k] = e; }
    return e;
  }
  /** Pose atual de todos (depois de um passo ou de montar a fila); `copia`: a anterior = a atual (corte). */
  function posesAtuais(copia) {
    const c = st.c;
    c.andantes.forEach((a, k) => {
      const e = estadoDe(k), j = a.j;
      if (!copia) { e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1; }
      pose(j, c.mini, e.atu);
      e.x1 = j.x; e.z1 = j.z; e.r1 = j.rumo;
      if (copia) { e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1; }
    });
  }
  /** Leva o cortejo ao tick pedido (volta a uma foto se precisar); as poses dos 2 últimos passos ficam guardadas. */
  function cortejoAte(tick) {
    const c = st.c;
    let pulou = false;
    if (tick < c.tick || tick - c.tick > 600) {
      // a foto mais perto antes do tick (a do começo sempre existe); para a frente, só se ela adiantar
      let melhor = 0;
      for (const k of st.fotos.keys()) if (k <= tick && k > melhor) melhor = k;
      if (tick < c.tick || melhor > c.tick) { restaurarCortejo(c, st.fotos.get(melhor)); pulou = true; }
    }
    if (c.tick >= tick) { if (pulou) posesAtuais(true); return; }
    while (c.tick < tick - 1) { passoCortejo(c); pulou = true; }
    // o último passo guarda a pose anterior e a atual (o desenho interpola entre as duas)
    if (pulou) posesAtuais(true);
    passoCortejo(c);
    posesAtuais(false);
  }
  /** O cortejo "prévia" anda aos poucos até o maior instante pedido pelos planos (as fotos dos cortes). */
  function avancarPrevia(orcamentoMs) {
    const p = st.previa;
    if (!p || !st.tcsPrevia.length) return;
    const fim = st.tcsPrevia[st.tcsPrevia.length - 1];
    const t0 = performance.now();
    while (p.tick < fim && (orcamentoMs == null || performance.now() - t0 < orcamentoMs)) {
      passoCortejo(p);
      if (st.tcsPrevia.includes(p.tick) && !st.fotos.has(p.tick)) st.fotos.set(p.tick, fotoCortejo(p));
    }
    if (p.tick >= fim) st.previa = null;
  }
  function garantirFoto(tick) {
    if (st.fotos.has(tick)) return;
    if (st.previa) avancarPrevia(null);
  }

  // ---------------------------------------------------------------- planos
  function entrarPlano(i) {
    st.i = i;
    const p = st.r.planos[i];
    st.desde = st.t;
    // névoa e alcance da câmera: de fora (o bairro até ~1,7 km) ou de dentro (a do jogo)
    const cena = ctx.cena3d.cena, cam = camera();
    const H = ctx.hora() === 'noite' ? NEVOA.noite : NEVOA.dia;
    if (p.fora) { cena.fog.near = H[0]; cena.fog.far = H[1]; cam.near = 2; cam.far = 3400; }
    else { cena.fog.near = st.nevoa.near; cena.fog.far = st.nevoa.far; cam.near = noCorredorDoTunel(...pontoInicial(i)) ? 0.12 : 0.3; cam.far = st.cameraNF.far; }
    cam.updateProjectionMatrix();
    if (st.fora) st.fora.modoFora(!!p.fora);
    // o cortejo deste plano
    const cj = p.cortejo;
    if (cj === 'fila') {
      if (!st.filaPronta) { filaFinal(st.c); st.filaPronta = true; }
      posesAtuais(true);
    } else if (cj && cj.tc != null) {
      const tick = Math.round(cj.tc / PASSO);
      st.filaPronta = false;
      garantirFoto(tick);
      cortejoAte(tick);
      posesAtuais(true);
    }
  }
  function pontoInicial(i) { const c = cameraEm(st.r, st.r.planos[i].t0, {}); return [c.px, c.py, c.pz]; }

  // ---------------------------------------------------------------- desenho
  function montarLista(alfa, respira, tempo) {
    const c = st.c;
    let n = 0;
    c.andantes.forEach((a, k) => {
      const e = estadoDe(k);
      interpolarPose(e.ant, e.atu, alfa, e.des);
      if (respira) respirar(e.des, a.id, tempo);
      const it = lista[n] ?? (lista[n] = {});
      it.id = a.id; it.time = a.time; it.goleiro = a.goleiro; it.kit = a.kit; it.pose = e.des;
      it.controlado = false; it.proximo = false;
      it.x = e.x0 + (e.x1 - e.x0) * alfa; it.z = e.z0 + (e.z1 - e.z0) * alfa; it.rumo = e.r1;
      n++;
    });
    lista.length = n;
    return lista;
  }
  /**
   * A fila parada "respira" (só no desenho, sobre a pose: os pés plantados não mexem): o peito sobe e desce ±1 cm a
   * ~0,25 Hz e o peso passa de um pé para o outro (o tronco ±1,2 cm de lado), cada um no seu ritmo (pelo id).
   */
  function respirar(P, id, t) {
    const f = 0.22 + ((id * 0.618) % 1) * 0.08, fase = id * 1.7;
    const sobe = 0.01 * Math.sin(2 * Math.PI * f * t + fase);
    const lado = 0.012 * Math.sin(2 * Math.PI * 0.09 * t + fase * 0.37);
    for (const k of SUPERIOR) {
      const w = k === J.lombar ? 0.4 : 1;
      P[k * 3] += lado * w;
      P[k * 3 + 1] += sobe * (k === J.lombar ? 0.3 : 1);
    }
    P[J.pelve * 3] += lado * 0.5;
  }

  /** Câmera de cinema: posição, alvo e fov (o fov do roteiro é o vertical em 16:9; mais estreito, a mesma largura). */
  function posicionarCamera(c) {
    const cam = camera();
    const a = window.innerWidth / Math.max(1, window.innerHeight);
    let fov = c.fov;
    if (a < ASPECTO_TV) fov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * ASPECTO_TV / a) * 180) / Math.PI;
    if (Math.abs(cam.fov - fov) > 1e-4 || cam.aspect !== a) { cam.fov = fov; cam.aspect = a; cam.updateProjectionMatrix(); }
    cam.position.set(c.px, c.py, c.pz);
    cam.lookAt(c.lx, c.ly, c.lz);
    cam.updateMatrixWorld();
  }

  /** No pré-jogo o lado de cá (arquibancada, túnel, torcida) é desenhado sempre que estiver no quadro. */
  function forcarLadoDeCa() {
    const cam = camera();
    _frustum.setFromProjectionMatrix(_mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const ca = ctx.campo.ladoDeCa;
    if (ca) { ca.visible = ca.userData.caixas.some(b => _frustum.intersectsBox(b)); if (ca.visible) ca.geometry.setDrawRange(0, Infinity); }
    const tm = ctx.torcida.mesh;
    if (tm) for (const m of tm.children) if (m.userData.ladoDeCa) { m.visible = _frustum.intersectsBox(m.userData.caixa); m.geometry.instanceCount = m.userData.k; }
  }

  /** Ânimo da torcida e som do plano (só do pré-jogo; nada do mundo). */
  function torcidaESom(dt, agoraS, s) {
    const emo = st.emocao;
    const tEst = st.t + 2;  // o relógio do estádio do pré-jogo (a festa conta dele)
    ctxEmo.t = tEst;
    emocaoPasso(emo, ctxEmo, dt);
    emo.agito = aproxima(emo.agito, s.agito, dt, 0.6);
    const [g0, g1] = emo.torcida;
    g0.tensao = aproxima(g0.tensao, s.tensao0, dt, 0.5); g1.tensao = aproxima(g1.tensao, s.tensao1, dt, 0.5);
    g0.palmas = Math.max(g0.palmas, aproxima(g0.palmas, s.palmas0, dt, 0.4)); g1.palmas = Math.max(g1.palmas, aproxima(g1.palmas, s.palmas1, dt, 0.4));
    // eventos do plano: festa (sinalizadores, bandeirão) e palmas
    const p = plano();
    if (p && p.eventos) {
      const tau = st.t - p.t0;
      p.eventos.forEach((ev, k) => {
        const chave = `${p.i}:${k}`;
        if (tau >= ev.em && tau < ev.em + 1.5 && !st.disparados.has(chave)) {
          st.disparados.add(chave);
          if (ev.festa) forcarFesta(emo.festa, ev.festa);
          if (ev.disparo) emo.disparar(ev.disparo.tipo, ev.disparo.grupo, ev.disparo.forca);
        }
      });
    }
    const som = ctx.som();
    const ds = consumirDisparos(emo);
    if (som) {
      for (const d of ds) if (d.tipo !== 'apito') som.tocar(d);
      st.cenaSom.ganho = s.ganho; st.cenaSom.filtro = s.filtro;
      som.cena(st.cenaSom);
      som.atualizar(emo, false, agoraS);
    }
  }

  function desenharMundo(dt, agoraMs, renderizar, c, comCortejo, alfa, respira) {
    posicionarCamera(c);
    const { cena3d, jog3d, bola3d, campo, torcida } = ctx;
    // foco da sombra: a fila, o túnel ou o ponto que a câmera olha (perto do campo)
    let fx = clamp(c.lx, -40, 40), fz = clamp(c.lz, -30, 30);
    const p = plano();
    if (p && p.id === 'tunel') { fx = 0; fz = 48; }
    else if (comCortejo) { fx = 0; fz = st.filaPronta ? 3.2 : clamp(c.lz, -10, 46); }
    cena3d.acompanhar(fx, fz);
    jog3d.atualizar(comCortejo ? montarLista(alfa, respira, agoraMs / 1000) : (lista.length = 0, lista), camera());
    bola3d.atualizar(_bola, _q);
    campo.atualizar(agoraMs / 1000, camera(), renderizar);
    torcida.atualizar(agoraMs / 1000, st.emocao, camera(), ctx.som() ? ctx.som().relogioBatida : null, renderizar);
    forcarLadoDeCa();
    if (st.fora) st.fora.atualizar(agoraMs / 1000, camera());
    if (renderizar) { const t0 = performance.now(); cena3d.desenhar(camera()); mq.des += performance.now() - t0; }
  }

  // ---------------------------------------------------------------- ciclo
  function iniciar(modo, opc = {}) {
    const m = ctx.mundo();
    if (!m || !m.times || modo === 'desligado' || !PREJOGO.modos.includes(modo)) return false;
    if (st.ativo) encerrar(false);
    st.modo = modo;
    st.r = criarRoteiro(modo);
    st.t = 0; st.tAb = 0; st.i = -1; st.filaPronta = false; st.disparados.clear(); st.terminando = false;
    st.c = criarCortejo(m.times);
    st.fotos = new Map([[0, fotoCortejo(st.c)]]);
    st.tcsPrevia = [...new Set(st.r.planos.filter(p => p.cortejo && p.cortejo.tc > 0).map(p => Math.round(p.cortejo.tc / PASSO)))].sort((a, b) => a - b);
    st.previa = st.tcsPrevia.length ? criarCortejo(m.times) : null;
    st.emocao = criarEmocao();
    posesAtuais(true);
    const cena = ctx.cena3d.cena, cam = camera();
    st.nevoa = { near: cena.fog.near, far: cena.fog.far };
    st.cameraNF = { near: cam.near, far: cam.far };
    // a estrutura de fora (fachada, cobertura, cantos, túnel) aparece também de dentro: em todo pré-jogo
    const precisaFora = true;
    if (precisaFora) {
      const t0 = performance.now();
      st.fora = criarEstadioFora(cena, { qualidade: ctx.qualidade(), hora: ctx.hora(), aniso: ctx.cena3d.anisotropia(), materialTorcida: ctx.torcida.mesh?.children?.[0]?.material ?? null });
      st.msFora = performance.now() - t0;
    }
    tela.escalacao.montar(m.times);
    tela.mostrar(true);
    st.ativo = true;
    if (opc.abertura) {
      st.fase = 'abertura';
      tela.abertura(m.times);
      if (st.fora) st.fora.modoFora(true);
      cena.fog.near = NEVOA[ctx.hora() === 'noite' ? 'noite' : 'dia'][0]; cena.fog.far = NEVOA[ctx.hora() === 'noite' ? 'noite' : 'dia'][1];
      cam.near = 2; cam.far = 3400; cam.updateProjectionMatrix();
    } else {
      st.fase = 'rodando';
      tela.abertura(null);
    }
    return true;
  }
  /** Da abertura para as cenas (o toque já liberou o som; no Android pede a tela cheia deitada). */
  function comecar() {
    if (st.fase !== 'abertura') return;
    st.fase = 'rodando';
    tela.abertura(null);
    st.t = 0; st.i = -1;
    try {
      const d = document.documentElement;
      if (ctx.comToque() && document.fullscreenEnabled && !document.fullscreenElement && screen.orientation && typeof screen.orientation.lock === 'function') {
        d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation.lock('landscape')).catch(() => {});
      }
    } catch (_) { /* sem tela cheia */ }
  }
  function proximo() {
    if (!st.ativo) return;
    if (st.fase === 'abertura') { comecar(); return; }
    const t = proximoBloco(st.r, st.t);
    if (t >= st.r.total - 1e-6) { encerrar(true); return; }
    irPara(t);
  }
  function pularTudo() { if (st.ativo) encerrar(true); }
  function irPara(t) {
    if (!st.ativo) return;
    if (st.fase === 'abertura') comecar();
    st.t = clamp(t, 0, st.r.total);
    if (st.t >= st.r.total) { encerrar(true); return; }
    const i = planoEm(st.r, st.t);
    entrarPlano(i);
    // a câmera e o cortejo já no instante pedido (o próximo quadro desenha)
    const p = st.r.planos[i];
    if (p.cortejo && p.cortejo.tc != null) cortejoAte(Math.ceil((p.cortejo.tc + (st.t - p.t0)) / PASSO - 1e-9));
  }
  /** Fim: limpa tudo o que é do pré-jogo e devolve a página ao jogo (main.js aoFim: apito, HUD, entrada). */
  function encerrar(avisar) {
    if (!st.ativo) return;
    st.ativo = false; st.fase = 'parado';
    tela.mostrar(false);
    const cena = ctx.cena3d.cena, cam = camera();
    if (st.nevoa) { cena.fog.near = st.nevoa.near; cena.fog.far = st.nevoa.far; }
    if (st.cameraNF) { cam.near = st.cameraNF.near; cam.far = st.cameraNF.far; cam.updateProjectionMatrix(); }
    if (st.fora) { st.fora.dispose(); st.fora = null; }
    const som = ctx.som();
    if (som) som.cena(null);
    st.c = null; st.previa = null; st.fotos = new Map(); st.emocao = null; lista.length = 0;
    if (avisar && ctx.aoFim) ctx.aoFim();
  }

  // CPU por quadro do pré-jogo SEM o desenho (a GPU por software do headless fica de fora), num anel fixo
  const MQ = 2048, mq = { n: 0, i: 0, v: new Float64Array(MQ), des: 0 };
  /** Um quadro (dt s reais; 0 com a página parada). Devolve false quando o pré-jogo acabou neste quadro. */
  function quadro(dtReal, agoraMs, renderizar = true) {
    if (!st.ativo) return false;
    const t0 = performance.now();
    mq.des = 0;
    const r = quadroInterno(dtReal, agoraMs, renderizar);
    mq.v[mq.i] = performance.now() - t0 - mq.des; mq.i = (mq.i + 1) % MQ; mq.n = Math.min(MQ, mq.n + 1);
    return r;
  }
  function quadroInterno(dtReal, agoraMs, renderizar) {
    tela.atualizar(performance.now());
    const dt = clamp(dtReal, 0, 0.1);
    const agoraS = agoraMs / 1000;
    if (st.fase === 'abertura') {
      st.tAb += dt;
      avancarPrevia(PREVIA_MS);
      cameraAbertura(st.tAb, _cam);
      tela.faixas(0, PREJOGO.letterbox); tela.preto(0); tela.fundoEscalacao(0);
      sinaisEm(st.r, 0, _sin); _sin.agito = 0.15; _sin.filtro = 600; _sin.ganho = 0.5;
      torcidaESom(dt, agoraS, _sin);
      desenharMundo(dt, agoraMs, renderizar, _cam, false, 1, false);
      return true;
    }
    st.t += dt;
    if (st.t >= st.r.total) { encerrar(true); return false; }
    const i = planoEm(st.r, st.t);
    if (i !== st.i) entrarPlano(i);
    const p = st.r.planos[i];
    avancarPrevia(PREVIA_MS);
    // cortejo do plano
    let comCortejo = false, alfa = 1, respira = false;
    if (p.cortejo && p.cortejo.tc != null) {
      const tc = p.cortejo.tc + (st.t - p.t0);
      const alvo = Math.ceil(tc / PASSO - 1e-9);
      cortejoAte(alvo);
      alfa = clamp(1 - (alvo - tc / PASSO), 0, 1);
      comCortejo = true;
    } else if (p.cortejo === 'fila') { comCortejo = true; respira = true; }
    cameraEm(st.r, st.t, _cam);
    sinaisEm(st.r, st.t, _sin);
    torcidaESom(dt, agoraS, _sin);
    // tela: faixas de cinema nas cenas (entram no começo e saem antes da escalação), preto e escalação
    const cenas = p.bloco === 'cenas';
    const kf = cenas ? clamp(Math.min(st.t / 0.6, (st.r.fimCenas - st.t) / 0.5), 0, 1) : 0;
    tela.faixas(kf, PREJOGO.letterbox);
    tela.preto(escuroEm(st.r, st.t));
    escalacaoEm(st.r, st.t, _esc);
    _esc.tau = p.bloco.startsWith('escalacao') ? st.t - p.t0 : null;
    tela.fundoEscalacao(cenas ? clamp((st.t - (st.r.fimCenas - 0.4)) / 0.4, 0, 1) : 1);
    tela.escalacao.mostrar(_esc);
    desenharMundo(dt, agoraMs, renderizar, _cam, comCortejo, alfa, respira);
    return true;
  }

  /** Ações da entrada (main.js tratarAcao) durante o pré-jogo: a pausa (Esc, P, Start) pula tudo. */
  function acao(a) {
    if (!st.ativo) return false;
    if (a === 'pausa') pularTudo();
    return true;
  }

  /** Andantes do cortejo com a cabeça dentro do quadro agora (testes). */
  function andantesNaTela() {
    if (!st.ativo || !st.c || !lista.length) return 0;
    const cam = camera();
    let n = 0;
    for (const it of lista) {
      const P = it.pose;
      _v.set(P[J.cabeca * 3], P[J.cabeca * 3 + 1], P[J.cabeca * 3 + 2]).project(cam);
      if (_v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1) n++;
    }
    return n;
  }

  const api = {
    get ativo() { return st.ativo; },
    get fase() { return st.fase; },
    get modo() { return st.modo; },
    get bloco() { return st.ativo && st.fase === 'rodando' ? st.r.planos[planoEm(st.r, st.t)].bloco : (st.fase === 'abertura' ? 'abertura' : null); },
    get plano() { return st.ativo && st.fase === 'rodando' ? st.r.planos[planoEm(st.r, st.t)].id : null; },
    get indice() { return st.ativo && st.fase === 'rodando' ? planoEm(st.r, st.t) : -1; },
    get tempo() { return st.t; },
    get total() { return st.r ? st.r.total : 0; },
    get fimCenas() { return st.r ? st.r.fimCenas : 0; },
    get planos() { return st.r ? st.r.planos.map(p => ({ id: p.id, nome: p.nome, bloco: p.bloco, t0: p.t0, t1: p.t1, fora: !!p.fora, cortejo: p.cortejo ?? null, time: p.time ?? null })) : []; },
    get naAbertura() { return st.fase === 'abertura'; },
    get pularVisivel() { return tela.pularVisivel; },
    get camera() { const c = camera(); return { x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov, near: c.near, far: c.far }; },
    get somCena() { const s = ctx.som(); return s ? s.cenaPre : null; },
    /** CPU por quadro do pré-jogo sem o desenho (ms): {quadros, media, p95, max}; opc.zerar recomeça. */
    medirQuadro(opc = {}) {
      const n = mq.n, v = new Float64Array(n);
      for (let k = 0; k < n; k++) v[k] = mq.v[(mq.i - n + k + MQ) % MQ];
      let soma = 0, max = 0;
      for (let k = 0; k < n; k++) { soma += v[k]; if (v[k] > max) max = v[k]; }
      v.sort();
      if (opc.zerar) { mq.n = 0; mq.i = 0; }
      return { quadros: n, media: n ? soma / n : 0, p95: n ? v[Math.min(n - 1, Math.floor(0.95 * n))] : 0, max };
    },
    /** O último quadro desenhado: chamadas de desenho e triângulos. */
    get desenho() { const i = ctx.cena3d.info().render; return { chamadas: i.calls, triangulos: i.triangles }; },
    get cortejo() { return st.c ? { tick: st.c.tick, fila: st.filaPronta, fotos: [...st.fotos.keys()], previa: !!st.previa } : null; },
    get fora() { return st.fora ? { ...st.fora.info, msCriar: Math.round(st.msFora ?? 0) } : null; },
    pular: () => proximo(), pularTudo: () => pularTudo(), irPara: t => irPara(t), comecar: () => comecar(),
    andantesNaTela,
    /** Posição desenhada (interpolada) do andante `id` no último quadro, ou null (testes: a câmera passando pela fila). */
    posicaoAndante(id) { for (const it of lista) if (it.id === id) return { x: it.x, z: it.z }; return null; },
    escalacao: {
      get visivel() { return tela.escalacao.estado.visivel; },
      get time() { return tela.escalacao.estado.time; },
      get cheia() { return tela.escalacao.estado.cheia; },
      cartas: t => tela.escalacao.cartas(t),
      folha: t => { const r = tela.escalacao.folha(t).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
      get pular() { const r = tela.botaoPular.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, visivel: tela.pularVisivel }; },
      info: t => { const f = tela.escalacao.folha(t).querySelector('.pj-esc-info'); const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
    },
  };

  return {
    iniciar, quadro, acao, proximo, pularTudo, irPara, comecar,
    /** Sai sem avisar o main.js (mundo novo pela API ou troca de modo no meio do pré-jogo). */
    cancelar: () => encerrar(false),
    get ativo() { return st.ativo; },
    get naAbertura() { return st.fase === 'abertura'; },
    api,
  };
}
