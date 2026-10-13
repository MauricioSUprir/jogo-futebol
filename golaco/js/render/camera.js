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
// Bola longe (lançamento, defesa): a bola manda — o foco nunca fica a mais de ~0,31 da largura
// vista do "ponto da bola", e a bola nunca sai do quadro. Com a bola no ar (m.voo), o ponto da
// bola antecipa a queda (vai parte do caminho até m.voo.alvo); a mola deixa tudo suave.
import * as THREE from 'three';
import { CAMERA, CAMPO, CAMERA_GERAL } from '../config.js';

/** Mola crítica exata (a mesma de util.js molaCritica), escrevendo no estado: sem alocar. */
function mola(est, kx, kv, alvo, w, dt) {
  const y = est[kx] - alvo;
  const j1 = est[kv] + y * w;
  const e = Math.exp(-w * dt);
  est[kx] = alvo + (y + j1 * dt) * e;
  est[kv] = (est[kv] - j1 * w * dt) * e;
}


export const MODOS_CAMERA = ['tv', 'aproximada'];

const PERFIS = {
  tv: {
    largura: CAMERA.largura, distancia: CAMERA.distancia, altura: CAMERA.altura,
    pesoBola: 0.45, antecipa: 0.55, anteVoo: 0.42, limX: CAMPO.meioX - 14, limZ0: -CAMPO.meioZ + 12, limZ1: CAMPO.meioZ - 11, olharY: 0,
  },
  aproximada: {
    largura: CAMERA.aproximada.largura, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura,
    pesoBola: 0.3, antecipa: 0.35, anteVoo: 0.3, limX: CAMPO.meioX - 3, limZ0: -CAMPO.meioZ + 3, limZ1: CAMPO.meioZ - 2, olharY: 0.6,
  },
};
// celular deitado: a TV mais baixa e mais longe (a torcida no alto do quadro); a mesma largura vista no foco
const TV_CELULAR = { ...PERFIS.tv, ...CAMERA.celular };
// celular em pé: mesmos pesos, câmera mais alta/inclinada e limites que deixam chegar às linhas
const RETRATO = {
  tv: { ...PERFIS.tv, ...CAMERA.retrato, limX: CAMPO.meioX - 8, limZ0: -CAMPO.meioZ + 6, limZ1: CAMPO.meioZ - 6 },
  aproximada: { ...PERFIS.aproximada, ...CAMERA.retratoAproximada },
};
const ASPECTO_TV = 16 / 9;
const CHAVES = Object.keys(PERFIS.tv);

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
// (os números ficam em config.js: as cenas de fim de tempo, puras, terminam neste mesmo plano)
export { CAMERA_GERAL };
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
  };
  // câmera de cinema: o nome do plano (mudou = corte), onde o plano começou e para onde olha
  const cin = { nome: null, de0: [0, 0, 0], para: [0, 0, 0], reduz: false };
  const yaw = -Math.PI / 2;
  const _p = {};
  const _foco = { x: 0, z: 0 };
  function perfil() {
    // TV ↔ aproximada pela transição; paisagem ↔ retrato pelo formato da tela (1,25 → 0,75)
    const s = suave(est.mistura);
    const r = suave((1.25 - est.aspecto) / 0.5);
    const tv = est.pequena ? TV_CELULAR : PERFIS.tv;
    for (const k of CHAVES) {
      const pais = lerp(tv[k], PERFIS.aproximada[k], s);
      const ret = lerp(RETRATO.tv[k], RETRATO.aproximada[k], s);
      _p[k] = lerp(pais, ret, r);
    }
    _p.retrato = r;
    return _p;
  }
  /** fov vertical que mostra a largura do perfil no foco, para o formato desta tela. */
  function fovPara(p) {
    const a = est.aspecto;
    let larg = p.largura;
    // paisagem mais estreita que 16:9 (4:3) perde só metade da largura; o retrato já tem a sua
    if (a < ASPECTO_TV) larg *= lerp(Math.sqrt(Math.max(a, 1.25) / ASPECTO_TV), 1, p.retrato);
    if (est.pequena) larg *= CAMERA.telaPequena;
    const d = Math.hypot(p.distancia, p.altura - p.olharY);
    return (2 * Math.atan(larg / 2 / d / a) * 180) / Math.PI;
  }
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
      camera.position.set(est.x, p.altura, est.z + p.distancia);
      camera.lookAt(est.x, p.olharY, est.z);
    }
  }
  return {
    camera,
    get yaw() { return yaw; },
    get modo() { return est.modo; },
    definirModo(m) { if (PERFIS[m]) est.modo = m; },
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
      // ponto da bola: no ar, antecipa a queda (parte do caminho até o alvo)
      let px = alvo.bx, pz = alvo.bz;
      if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.az)) {
        px += (alvo.ax - alvo.bx) * p.anteVoo;
        pz += (alvo.az - alvo.bz) * p.anteVoo;
      }
      // foco: entre jogador e bola. Perto, a bola pesa pesoBola; um pouco longe (passe da
      // máquina chegando) pesa menos; muito longe, a bola manda (o foco fica a ≤ R dela)
      const dbx = px - alvo.jx, dbz = pz - alvo.jz;
      const db = Math.hypot(dbx, dbz);
      const R = p.largura * 0.31;
      const w = db > 12 ? Math.max(p.pesoBola * 12 / db, 1 - R / db) : p.pesoBola;
      let fx = alvo.jx + dbx * w + alvo.jvx * p.antecipa;
      let fz = alvo.jz + dbz * w + alvo.jvz * p.antecipa;
      // a bola (de verdade) nunca sai do quadro: na profundidade se vê menos que na largura
      const mx = p.largura * 0.38, mz = p.largura * 0.24;
      fx = clamp(fx, alvo.bx - mx, alvo.bx + mx);
      fz = clamp(fz, alvo.bz - mz, alvo.bz + mz);
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
      if (!est.iniciado || corte) {
        est.x = fx; est.z = fz; est.vx = 0; est.vz = 0; est.iniciado = true;
      } else {
        const wr = CAMERA.rigidez;
        mola(est, 'x', 'vx', fx, wr, dt);
        mola(est, 'z', 'vz', fz, wr * 0.8, dt);
      }
      posicionar(p);
    },
    /** Foco atual da câmera (para a sombra acompanhar a jogada; na câmera do gol, a boca do gol). */
    foco() {
      const g = est.gol;
      if (est.cinema && cin.nome) { _foco.x = cin.para[0]; _foco.z = cin.para[2]; }
      else if (g.ativo && g.fechado) { _foco.x = g.x - Math.sign(g.x || 1) * 6; _foco.z = clamp(g.z, -3.66, 3.66) * 0.5; }
      else if (est.geral) { _foco.x = 0; _foco.z = 0; }
      else { _foco.x = est.x; _foco.z = est.z; }
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
    /** Câmera livre para prints de conferência: {de:[x,y,z], para:[x,y,z], fov?} ou null. */
    definirLivre(l) { est.livre = l ? { de: [...l.de], para: [...l.para], fov: l.fov } : null; },
  };
}
