// Câmera de TV: na lateral do lado de cá (z positivo), olhando para z negativo (yaw = −π/2 no
// chão — o mesmo que controle.js/paraMundo usa para converter o analógico). Segue um ALVO
// (jogador + bola, com antecipação pela velocidade) por uma mola crítica exata (não treme e não
// acompanha cada passada: o alvo usa o centro do corpo e a bola interpolados, nunca a pélvis
// que sobe e desce), limitada ao campo. Modo "aproximada" (CAMERA.aproximada) com transição.
//
// Enquadramento pela LARGURA vista no foco (como o diretor de TV fecha o plano), não pelo fov:
// tela mais larga que 16:9 (celular deitado) mantém a largura e fecha na altura — jogadores
// maiores sem perder o que se vê dos lados; tela mais estreita (4:3) perde só metade da
// largura; em pé (retrato) entra um perfil próprio, mais alto e inclinado, para o quadro não
// virar metade céu. Tela pequena (celular) fecha mais (CAMERA.telaPequena) e, deitado, usa a TV mais baixa e mais
// longe (CAMERA.celular): a torcida do outro lado aparece no alto do quadro durante o jogo.
//
// TV de jogo (item 66; dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a área completamente"): o foco segue a
// BOLA com a previsão do caso, o espaço à frente do ataque, a área inteira no último terço e a bola com prioridade, numa mola
// com a velocidade do alvo (render/enquadramento.js focoTV; contrato "Câmera de TV (item 66)"). O foco de antes (o controlado +
// a bola) fica na aproximada, no retrato e na transição (alvoLegado/molaLegada).
import * as THREE from 'three';
import {
  mola, PERFIS_CAMERA as PERFIS, ASPECTO_TV, perfilCamera, fovPara as fovParaTV, alvoLegado, molaLegada,
  criarEnquadramento, focoTV, geometriaTV, larguraVista, poseTV, perfilAjustado,
} from './enquadramento.js';
// câmera da bola parada (plano: render/bola-parada.js): entra em `entra` s (no corte, direto) e volta em `sai` s — menos
// quando ela olha para o lado OPOSTO ao da TV (o escanteio do lado de lá, de trás do cobrador para o lado de cá; item 66):
// aí a volta é por CORTE (como o diretor de TV corta da câmera do escanteio para a principal; corte não enjoa — Eiserloh,
// GDC 2016): misturando 180° de rumo, o olhar passava pelo chão e a bola saía do quadro de 0,3 a 0,9 s depois do chute
// (teste-camera-tela E6: 81% com a bola no quadro; no Modo Livre, contra o rumo da câmera dele: E8). corteOposto = o cosseno
// entre os dois olhares abaixo do qual corta
// (−0,5: mais de 120°; o escanteio de lá dá ~−0,9; o pênalti, o tiro livre e o tiro de meta, olhando para o gol, ~0 ± 0,3
// e continuam misturando — com 0, o pênalti cortava: teste-bola-parada-tela item 4).
const BP = { entra: 0.6, sai: 1.1, mola: 7, corteOposto: -0.5 };


export const MODOS_CAMERA = ['tv', 'aproximada'];

// os perfis (TV, aproximada, celular deitado, retrato), o fov pela largura e o foco moram no módulo puro
// render/enquadramento.js (os testes em Node usam as mesmas contas). A TV (mistura 0, paisagem) segue o foco NOVO do
// item 66 (a bola com a previsão certa, o espaço à frente, a área inteira no último terço, a bola com prioridade, a mola
// com a velocidade do alvo: enquadramento.js focoTV); a aproximada, o retrato, a transição, o efeito do gol do treino e o
// plano 'fechada' do replay (alvo.legado) seguem o de hoje (alvoLegado/molaLegada) — a troca parte do estado, sem salto.

// Efeito do gol (render): zoom leve (o fov fecha até 9%) e um tremor curto que morre em ~1 s — sem
// enjoar: amplitude ≤ 0,12 m (a 44 m do foco: ~0,15°), 6–9,5 Hz, sem girar a câmera além do que o "olhar" desloca (metade do tremor), e o
// foco puxa um pouco para a boca do gol (a rede estufada aparece). Com "reduzir movimento" do sistema:
// sem tremor e metade do zoom.
export const EFEITO_GOL = { duracao: 2.4, zoom: 0.09, zoomEntra: 0.35, zoomSai: [1.6, 2.4], tremor: 0.12, tremorTau: 0.3, puxaGol: 0.3 };

// Câmera do GOL da partida (contraprova I2 e I3): na câmera de TV a rede balançando mexia só 2,5% dos pixels do
// gol e, no celular, a torcida ficava fora do quadro quase metade do tempo. No gol a transmissão CORTA (como o
// diretor de TV faz; corte não enjoa, travelling rápido sim) para um plano fechado na boca do gol: do mesmo lado
// da câmera de TV (z+, sem inverter esquerda/direita), baixo e bem fora do eixo (~60°) — a rede de fundo
// estufando de perfil, a bola no bojo e a arquibancada atrás do gol (a torcida explodindo) enchendo o fundo do
// quadro. Fica até a saída de bola (main.js encerra no 'saida'/'recomeco'; o corte de volta é o da saída);
// aproxima devagar (o fov fecha 7% em 2,5 s) e dá um tranco curtíssimo na batida. "Reduzir movimento": sem
// aproximar nem tremer. fov vertical fixo em telas 16:9 ou mais largas (o celular deitado vê mais dos lados);
// mais estreitas abrem para caber a mesma largura.
export const CAMERA_GOL = {
  recuo: 6.5, lateral: 13, altura: 2.6,      // m: antes da linha do gol, para o lado da TV e de altura (~60° do eixo)
  olharAlem: 1.0, olharY: 1.55, olharBola: 0.2, // olha 1 m além da linha, a 1,55 m de altura, um pouco para o lado da bola
  fov: 27, aproxima: 0.07, aproximaT: 2.5,
  celularDesvio: 1.1,                         // m — no celular o olhar vai para a direita (o gol fica longe dos botões)
  tremor: 0.035, tremorTau: 0.22,
  maxDuracao: 4,                              // s — sem saída de bola (treino), volta sozinha
};
// Câmera de CINEMA da comemoração do gol (js/comemoracao.js planoCamera: steadicam no autor, contraplano com a torcida,
// reação de quem sofreu): CORTE seco quando o plano muda (o nome) — travelling rápido enjoa, corte não (Eiserloh, GDC
// 2016). Dentro do plano a câmera segue o plano como ele vem: a suavidade já está nele (a média do autor em 0,3 s, sem
// atraso: comemoracao.js); uma mola aqui atrasava a steadicam ~2,7 m a 8 m/s (o autor corria para dentro da lente).
// "Reduzir movimento" do sistema: a câmera não anda dentro do plano (fica onde o plano começou e só gira para o assunto).
// Plano geral do estádio no intervalo e no fim (a torcida inteira no quadro, também no celular).
export const CAMERA_GERAL = { de: [0, 34, 78], para: [0, 3, -16], fov: 31 };
const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export function criarCamera(aspecto) {
  const camera = new THREE.PerspectiveCamera(32, aspecto, 0.5, 900);
  const est = {
    modo: 'tv',
    mistura: 0,               // 0 = TV, 1 = aproximada (transição suave)
    x: 0, z: 0, vx: 0, vz: 0, // foco seguido pela mola
    iniciado: false,
    aspecto,
    pequena: false,           // tela de celular (menor lado < 520 px CSS)
    gol: { ativo: false, t: 0, x: 0, z: 0, reduz: false, fechado: false }, // efeito do gol
    geral: false,             // plano geral (intervalo, fim)
    corte: false,             // próximo atualizar corta (sem mola): fim da câmera do gol sem saída
    cinema: null,             // plano de cinema da comemoração ({nome, de, para, fov}) ou null
    bp: { s: 0, plano: null, p: new Array(14).fill(0), ok: false }, // de, para, fov (0–6) e velocidades (7–13)
    extra: null,              // Modo Livre: as câmeras dele (render/camera-livre.js) por cima da câmera de jogo
  };
  // câmera de cinema: o nome do plano (mudou = corte), onde o plano começou e para onde olha
  const cin = { nome: null, de0: [0, 0, 0], para: [0, 0, 0], reduz: false };
  const yaw = -Math.PI / 2;
  const _p = {};
  const _foco = { x: 0, z: 0 }, _leg = { x: 0, z: 0 }, _pose = { de: [0, 0, 0], para: [0, 0, 0], fov: 32 };
  const E = criarEnquadramento(), G = {}; // a TV nova (item 66): o estado dela e a geometria do quadro
  const _pAj = {}; // o perfil da TV com a Altura e a Distância do Livre (a geometria que ele desenha)
  const interno = { camera, est, p: _p, fovPara };
  // TV ↔ aproximada pela transição; paisagem ↔ retrato pelo formato da tela (1,25 → 0,75)
  function perfil() { return perfilCamera(_p, est.mistura, est.aspecto, est.pequena); }
  /** fov vertical que mostra a largura do perfil no foco, para o formato desta tela. */
  function fovPara(p) { return fovParaTV(p, est.aspecto, est.pequena); }
  /** Zoom (fração do fov) e tremor (m) do efeito do gol no tempo do efeito. */
  function efeitoGol() {
    const g = est.gol;
    if (!g.ativo) return null;
    const E = EFEITO_GOL, t = g.t;
    const zoom = E.zoom * (g.reduz ? 0.5 : 1) * suave(t / E.zoomEntra) * (1 - suave((t - E.zoomSai[0]) / (E.zoomSai[1] - E.zoomSai[0])));
    const a = g.reduz ? 0 : E.tremor * Math.exp(-t / E.tremorTau) * (1 - suave((t - 0.9) / 0.4));
    // tremor grave (6–9,5 Hz: o estádio "treme", sem o zumbido de alta frequência que enjoa)
    const tx = a * (0.6 * Math.sin(t * 2 * Math.PI * 6.1) + 0.4 * Math.sin(t * 2 * Math.PI * 9.4 + 1.3));
    const ty = a * (0.55 * Math.sin(t * 2 * Math.PI * 7.3 + 0.7) + 0.45 * Math.sin(t * 2 * Math.PI * 8.9 + 2.1));
    _ef.zoom = zoom; _ef.tx = tx; _ef.ty = ty;
    return _ef;
  }
  const _ef = { zoom: 0, tx: 0, ty: 0 };
  /** fov vertical de um plano fixo: f em 16:9 ou mais largo; mais estreito, a mesma largura. */
  function fovFixo(f) {
    const a = est.aspecto;
    if (a >= ASPECTO_TV) return f;
    const th = Math.tan((f * Math.PI) / 360) * ASPECTO_TV;
    return (2 * Math.atan(th / a) * 180) / Math.PI;
  }
  function ajustarFov(fov) {
    if (Math.abs(camera.fov - fov) > 1e-4 || camera.aspect !== est.aspecto) {
      camera.fov = fov; camera.aspect = est.aspecto; camera.updateProjectionMatrix();
    }
  }
  /** Câmera do gol (plano fechado na boca do gol). */
  function posicionarGol() {
    const g = est.gol, C = CAMERA_GOL, t = g.t, s = g.x >= 0 ? 1 : -1;
    const mx = Math.abs(g.x);
    ajustarFov(fovFixo(C.fov) * (g.reduz ? 1 : 1 - C.aproxima * suave(t / C.aproximaT)));
    const a = g.reduz ? 0 : C.tremor * Math.exp(-t / C.tremorTau);
    const tx = a * Math.sin(t * 2 * Math.PI * 6.1), ty = a * Math.sin(t * 2 * Math.PI * 7.3 + 0.7);
    const px = s * (mx - C.recuo), pz = C.lateral;
    let lx = s * (mx + C.olharAlem), lz = clamp(g.z, -3.66, 3.66) * C.olharBola;
    if (est.pequena) {
      // celular: o arco de botões fica à direita — o olhar vai um pouco para a direita e o gol para a esquerda
      const dx = lx - px, dz = lz - pz, l = Math.hypot(dx, dz) || 1;
      lx += (-dz / l) * C.celularDesvio; lz += (dx / l) * C.celularDesvio;
    }
    camera.position.set(px + tx, C.altura + ty, pz);
    camera.lookAt(lx, C.olharY, lz);
  }
  /** Câmera de cinema (comemoração): corte quando o plano muda; dentro dele, o plano como vem (já suave). */
  function posicionarCinema() {
    const p = est.cinema;
    if (cin.nome !== p.nome) {
      for (let i = 0; i < 3; i++) cin.de0[i] = p.de[i];
      cin.nome = p.nome; cin.reduz = reduzMovimento();
    }
    for (let i = 0; i < 3; i++) cin.para[i] = p.para[i];
    const de = cin.reduz ? cin.de0 : p.de;
    ajustarFov(fovFixo(p.fov));
    camera.position.set(de[0], de[1], de[2]);
    camera.lookAt(cin.para[0], cin.para[1], cin.para[2]);
  }
  function posicionar(p) {
    if (!est.livre && est.cinema) { posicionarCinema(); return; }
    if (!est.livre && est.gol.ativo && est.gol.fechado) { posicionarGol(); return; }
    if (!est.livre && est.geral) {
      const G = CAMERA_GERAL;
      ajustarFov(fovFixo(G.fov));
      camera.position.set(G.de[0], G.de[1], G.de[2]);
      camera.lookAt(G.para[0], G.para[1], G.para[2]);
      return;
    }
    const ef = est.gol.fechado ? null : efeitoGol();
    const fov = fovPara(p) * (ef ? 1 - ef.zoom : 1);
    if (Math.abs(camera.fov - fov) > 1e-4 || camera.aspect !== est.aspecto) {
      camera.fov = fov;
      camera.aspect = est.aspecto;
      camera.updateProjectionMatrix();
    }
    if (est.livre) {
      // câmera livre (prints de conferência: close do manequim, gol, linhas)
      const l = est.livre;
      camera.position.set(l.de[0], l.de[1], l.de[2]);
      camera.lookAt(l.para[0], l.para[1], l.para[2]);
      if (l.fov && Math.abs(camera.fov - l.fov) > 1e-4) { camera.fov = l.fov; camera.updateProjectionMatrix(); }
      return;
    }
    if (ef) {
      camera.position.set(est.x + ef.tx, p.altura + ef.ty, est.z + p.distancia);
      camera.lookAt(est.x + ef.tx * 0.5, p.olharY + ef.ty * 0.5, est.z);
    } else {
      poseTV(p, est.x, est.z, est.aspecto, est.pequena, _pose);
      camera.position.set(_pose.de[0], _pose.de[1], _pose.de[2]);
      camera.lookAt(_pose.para[0], _pose.para[1], _pose.para[2]);
    }
    // bola parada: mistura posição, direção do olhar e fov (sem salto)
    if (est.bp.ok && suave(est.bp.s)) misturarBP(_d1.set(est.x, p.olharY, est.z).sub(camera.position).normalize());
  }
  /**
   * Mistura o plano da bola parada (render/bola-parada.js) por cima da pose que a câmera tem agora; d1 = a direção do olhar
   * dela (normalizada). A câmera de jogo (posicionar) e, no Modo Livre, a câmera dele (depois de est.extra.atualizar: senão
   * ela cobria o plano e o analógico girava pelo rumo de uma câmera escondida — bp.yaw no main.js).
   */
  function misturarBP(d1) {
    const bp = est.bp, e = suave(bp.s), q = bp.p;
    if (!bp.ok || !e) return;
    _a.copy(camera.position); _b.set(q[0], q[1], q[2]);
    _d2.set(q[3], q[4], q[5]).sub(_b).normalize();
    camera.position.lerpVectors(_a, _b, e);
    camera.lookAt(_a.copy(camera.position).add(d1.lerp(_d2, e).normalize()));
    camera.fov = lerp(camera.fov, fovFixo(q[6]), e); camera.updateProjectionMatrix();
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
  /**
   * O olhar da bola parada (q: de, para) e o da câmera de jogo apontam para lados opostos? A TV (perfil p) ou, no Modo Livre,
   * a câmera dele pelo rumo no chão (est.extra.yaw: de lado −π/2, como a TV; Atrás e Jogador pelo comprimento). No Livre a
   * volta do escanteio de lá misturava 180° e a bola saía do quadro de 0,27 a 0,80 s depois do cruzamento (revisão R5; antes
   * do item 66, com a câmera da bola parada baixa, não saía).
   */
  function oposta(q, p) {
    const dx = q[3] - q[0], dy = q[4] - q[1], dz = q[5] - q[2];
    if (est.extra) { const y = est.extra.yaw; return (dx * Math.cos(y) + dz * Math.sin(y)) / (Math.hypot(dx, dz) || 1) < BP.corteOposto; }
    const ty = p.olharY - p.altura, tz = -p.distancia;
    return (dy * ty + dz * tz) / ((Math.hypot(dx, dy, dz) * Math.hypot(ty, tz)) || 1) < BP.corteOposto;
  }
  function atualizarBP(dt, corte, p) {
    const bp = est.bp, pl = bp.plano;
    if (!pl) {
      if (bp.ok && bp.s > 0 && oposta(bp.p, p)) { bp.s = 0; bp.ok = false; est.corteBP = true; return; }
      bp.s = Math.max(0, bp.s - dt / BP.sai); if (!bp.s) bp.ok = false; return;
    }
    const alvo = [...pl.de, ...pl.para, pl.fov], novo = !bp.ok || corte || bp.s <= 0;
    for (let i = 0; i < 7; i++) if (novo) { bp.p[i] = alvo[i]; bp.p[7 + i] = 0; } else mola(bp.p, i, 7 + i, alvo[i], BP.mola, dt);
    bp.ok = true;
    bp.s = corte ? 1 : Math.min(1, bp.s + dt / BP.entra);
  }
  return {
    camera,
    get yaw() { return est.extra ? est.extra.yaw : yaw; },
    get modo() { return est.modo; },
    definirModo(m) { if (PERFIS[m] || est.extra?.modos.includes(m)) est.modo = m; },
    /** Modo Livre (render/camera-livre.js) ou null: os modos, o rumo e a pose dele valem por cima da câmera de jogo. */
    definirExtra(x) { est.extra = x || null; if (!x && !PERFIS[est.modo]) est.modo = 'tv'; },
    alternarModo() { est.modo = est.modo === 'tv' ? 'aproximada' : 'tv'; return est.modo; },
    /** a = largura/altura da tela; pequena = celular (fecha mais o plano). */
    redimensionar(a, pequena = false) { est.aspecto = a; est.pequena = !!pequena; },
    /**
     * dt do quadro (s). alvo = {jx, jz, jvx, jvz, bx, bz, ax?, az?} (posições INTERPOLADAS;
     * ax/az = ponto de queda do passe/lançamento em andamento, se houver).
     * corte = true reposiciona sem mola (recomeço).
     */
    atualizar(dt, alvo, corte = false) {
      const metaMistura = est.modo === 'aproximada' ? 1 : 0;
      est.mistura += clamp(metaMistura - est.mistura, -dt / 0.6, dt / 0.6);
      const p = perfil();
      // o foco de hoje (o legado: entre o controlado e o ponto da bola; enquadramento.js alvoLegado)
      alvoLegado(alvo, p, _leg);
      let fx = _leg.x, fz = _leg.z;
      // efeito do gol: o foco puxa um pouco para a boca do gol (a rede estufada no quadro); a câmera do gol da
      // partida (fechado) fica até a saída de bola (ou maxDuracao) e corta de volta
      const g = est.gol;
      if (g.ativo && g.fechado) {
        g.t += dt;
        if (g.t >= CAMERA_GOL.maxDuracao) { g.ativo = false; g.fechado = false; corte = true; }
      } else if (g.ativo) {
        g.t += dt;
        if (g.t >= EFEITO_GOL.duracao) g.ativo = false;
        else {
          const w = EFEITO_GOL.puxaGol * suave(g.t / 0.4) * (1 - suave((g.t - 1.6) / 0.8));
          fx = lerp(fx, g.x, w); fz = lerp(fz, g.z, w);
        }
      }
      fx = clamp(fx, -p.limX, p.limX);
      fz = clamp(fz, p.limZ0, p.limZ1);
      if (est.corte) { corte = true; est.corte = false; }
      est.corteBP = false;
      atualizarBP(dt, corte, p);
      const novo = est.mistura === 0 && p.retrato === 0 && !(g.ativo && !g.fechado) && !alvo.legado;
      if (novo) {
        // a TV nova (item 66): a bola teletransportada também corta (E.cortou). No Livre, a geometria com a Altura e a
        // Distância dele (a pose que a câmera dele desenha: render/camera-livre.js poseLateral; revisão R3)
        const aj = est.extra?.fatores, pg = aj && (aj.fa !== 1 || aj.fd !== 1) ? perfilAjustado(_pAj, p, aj.fa, aj.fd) : p;
        geometriaTV(G, pg, est.aspecto, est.pequena);
        if (est.extra?.segurarTV && est.iniciado && !corte) est.extra.segurarTV(G, est.z);
        focoTV(E, est, alvo, p, G, larguraVista(pg, est.pequena), dt, corte || !est.iniciado);
        est.iniciado = true;
      } else {
        E.ok = false; E.cortou = corte || !est.iniciado;
        if (!est.iniciado || corte) {
          est.x = fx; est.z = fz; est.vx = 0; est.vz = 0; est.iniciado = true;
        } else molaLegada(est, fx, fz, dt);
      }
      posicionar(p);
      if (est.extra && !est.cinema && !(g.ativo && g.fechado) && !est.geral && !est.livre) {
        est.extra.atualizar(dt, alvo, corte, interno);
        // a bola parada do humano também no Livre, misturada por cima da câmera dele (a mesma mola, a mesma entrada e saída)
        if (est.bp.ok && suave(est.bp.s)) misturarBP(camera.getWorldDirection(_d1));
      }
    },
    /** Foco atual da câmera (para a sombra acompanhar a jogada; na câmera do gol, a boca do gol). */
    foco() {
      const g = est.gol;
      if (est.cinema && cin.nome) { _foco.x = cin.para[0]; _foco.z = cin.para[2]; }
      else if (g.ativo && g.fechado) { _foco.x = g.x - Math.sign(g.x || 1) * 6; _foco.z = clamp(g.z, -3.66, 3.66) * 0.5; }
      else if (est.geral) { _foco.x = 0; _foco.z = 0; }
      else { const e = est.extra?.foco ?? est; _foco.x = e.x; _foco.z = e.z; }
      return _foco;
    },
    /**
     * Efeito do gol na boca do gol (x = ±meioX, z = onde a bola entrou). opc.fechado (partida): CORTA para a
     * câmera do gol (CAMERA_GOL) até encerrarGol(); sem ele (treino): zoom leve e tremor curto (EFEITO_GOL).
     */
    efeitoGol(x, z, opc = {}) { Object.assign(est.gol, { ativo: true, t: 0, x, z, reduz: reduzMovimento(), fechado: !!opc.fechado }); },
    /** Fim do efeito do gol (saída de bola, recomeço do treino): a câmera de jogo volta (main.js corta). */
    encerrarGol() { est.gol.ativo = false; est.gol.fechado = false; },
    get efeitoAtivo() { return est.gol.ativo; },
    /** 'fechado' (câmera do gol), 'leve' (zoom/tremor do treino) ou null. */
    get planoGol() { return est.gol.ativo ? (est.gol.fechado ? 'fechado' : 'leve') : null; },
    /** Plano geral do estádio (intervalo e fim) ligado/desligado. */
    planoGeral(v) { est.geral = !!v; },
    get geral() { return est.geral; },
    /**
     * Câmera de cinema da comemoração: o plano {nome, de:[x,y,z], para:[x,y,z], fov} (o mesmo objeto, atualizado a cada
     * quadro: comemoracao.js planoCamera) ou null (a câmera de jogo volta; quem chama corta).
     */
    definirCinema(p) { est.cinema = p || null; if (!p) cin.nome = null; },
    /** Nome do plano de cinema agora ('steadicam', 'contraplano', 'reacao') ou null. */
    get cinema() { return est.cinema && cin.nome ? cin.nome : null; },
    /**
     * A câmera de JOGO agora (a TV/aproximada seguindo o lance: sem cinema, sem a livre dos testes, sem o plano geral, sem
     * o efeito do gol e sem a câmera da bola parada)? Nela nada de perto entra (item 69: as cadeiras 3D só nas câmeras
     * de perto — a do gol, a comemoração, as cenas, o replay, o pré-jogo).
     */
    get deJogo() { return !est.cinema && !est.livre && !est.geral && !est.gol.ativo && !(est.bp.ok && est.bp.s > 0.01); },
    bolaParada(pl) { est.bp.plano = pl || null; },
    /** Este quadro cortou (o corte pedido, o 1º quadro, na TV nova a bola teletransportada, ou a volta da bola parada oposta)? */
    get cortou() { return !!E.cortou || !!est.corteBP; },
    /** A TV nova agora (testes): o peso da área (wA), o lado do espaço à frente, a bola parada com a área, o limite duro. */
    get enquadramento() { return { novo: E.ok, wA: E.wA, lado: E.dir, frente: E.frente, parada: E.parada, duro: E.duro, limX: E.limX }; },
    get misturaBolaParada() { return est.bp.s; },
    /** Câmera livre para prints de conferência: {de:[x,y,z], para:[x,y,z], fov?} ou null. */
    definirLivre(l) { est.livre = l ? { de: [...l.de], para: [...l.para], fov: l.fov } : null; },
  };
}
