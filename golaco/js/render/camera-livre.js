// Câmeras do Modo Livre (pedido do dono de 16/10: "... pode ser adaptável durante a partida, assim como a camera";
// contrato "Modo Livre" no CONTRATOS.md). Carregado só no Livre (livre-pagina.js, que vem por import dinâmico): sem o Livre
// nada disto entra no download e render/camera.js não muda (o gancho `definirExtra` fica vazio).
//
// As seis câmeras (as do EA FC 25/26 — fifplay.com/fc-25-camera-settings, fifauteam.com/fc-26-camera): TV (Tele Broadcast,
// a de hoje), Aproximada (Dynamic, a de hoje), AMPLA (Co-op: mais longe e um pouco mais alta, o time todo no quadro), ALTA
// (Tactical: bem alta, quase de cima — sem furar a arquibancada nem a cobertura), ATRÁS (End to End: atrás do lance,
// olhando para o gol que o MEU time ataca) e JOGADOR (Pro: atrás e acima do controlado, olhando para o gol que eu ataco).
// "Altura" e "Distância" 0–20 (a Altura e o Zoom da câmera personalizada do EA FC): 10 = o perfil sem ajuste, 0 = 0,6×,
// 20 = 1,5× a altura / a distância do perfil. A Distância afasta a câmera e abre o plano junto (a mesma largura vista por
// metro de distância): mais longe = mais campo, não só outra perspectiva.
//
// Rumo (yaw): TV, Aproximada, Ampla e Alta ficam de lado (−π/2, o da TV); Atrás e Jogador olham pelo comprimento, com o
// rumo FIXO na direção do ataque do time do humano (0 ou π, como o yawDisputa dos pênaltis) — camera.js `yaw` devolve o
// daqui e o main.js yawEntrada usa ele: analógico para cima = para o gol que eu ataco. Nada de rumo seguindo o corpo (o
// controle ficaria à deriva). Troca entre câmeras de mesmo rumo: transição de 0,6 s (como TV ↔ aproximada); de rumo
// diferente: corte (girar 90° com o jogo andando enjoa e o analógico mudaria no meio do giro).
//
// Segurança (tools/teste-livre-tela.mjs A varre as poses em Node): nenhuma pose fica dentro de um sólido do estádio do jogo
// (estadio-forma.js solidoEm sem o lado de fora) — a não ser a arquibancada de cá com a câmera dentro da caixa dela, que
// sai do desenho (torcida-dados.js cameraNoLadoDeCa: é onde a TV de hoje fica) — e nenhuma arquibancada fica entre a
// câmera e o campo: perto do lado de cá a câmera fica DENTRO da caixa dela (y ≤ 26) ou na frente dela (z ≤ 43,5); Atrás e
// Jogador nunca passam das placas do fundo (|x| ≤ 58); Jogador fica a ≥ 3,2 m de altura (acima de qualquer cabeça: nada
// atravessa o modelo do controlado, a ≥ 6 m dele) e ≥ 3,2 m acima do travessão quando passa atrás do gol. Saindo da caixa da
// arquibancada de cá, a câmera anda pela reta até o ponto olhado (contínua: nada de pular de uma borda para a outra).
//
// Enquadramento (`enquadrar`, depois dos limites): a bola e os pés do controlado ficam dentro das margens do quadro (QUADRO:
// dos lados, em cima e acima do minimapa do PC e dos botões do celular, embaixo); se não ficam — Atrás perto do meu gol, com
// o recuo cortado pelas placas; a Distância baixa nas laterais e nos cantos —, o ponto olhado anda para eles o mínimo que
// basta (a câmera não sai do lugar seguro). Os limites do foco das de lado encolhem com a Distância (`limitesLateral`).
// Jogador: na troca de controlado para longe do foco, corte (a mola levava ~0,6 s, com ele fora do quadro e a câmera
// varrendo o campo a até ~90 m/s).
import { CAMPO, CAMERA } from '../config.js';
import { solidoEm } from '../estadio-forma.js';
import { cameraNoLadoDeCa, ARQUIBANCADA } from './torcida-dados.js';

export const CAMERAS_LIVRE = ['tv', 'aproximada', 'ampla', 'alta', 'atras', 'jogador'];
export const NOME_CAMERA = { tv: 'TV', aproximada: 'Aproximada', ampla: 'Ampla', alta: 'Alta', atras: 'Atrás', jogador: 'Jogador' };
/** Altura e Distância: 0–20, 10 = o perfil. */
export const AJUSTE = { min: 0, max: 20, padrao: 10 };
export const TRANSICAO = 0.6; // s — a mesma da TV ↔ aproximada (camera.js)

const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
// de lado (o rumo da TV): o foco entre o controlado e a bola, a mesma conta da TV (camera.js), com mais bola e mais campo.
// Alta: 65° de inclinação (a 52 m de altura, 24 m antes do foco) — o campo todo de lado a lado, a câmera nunca chega à
// arquibancada de cá (z ≤ 40). Ampla: 28° (24 m, 46 m), 62 m de largura no foco (a TV vê 45).
// pelo comprimento (rumo do ataque): `recuo` atrás do foco, `altura`, o ponto que olha `adiante` do foco, fov vertical em
// 16:9 (mais estreita: a mesma largura; mais larga — o celular deitado — vê mais dos lados).
export const PERFIS_LIVRE = {
  ampla: { largura: 62, distancia: 46, altura: 24, pesoBola: 0.5, antecipa: 0.45, anteVoo: 0.45, limX: MX - 21, limZ0: -MZ + 15, limZ1: MZ - 14, olharY: 0 },
  alta: { largura: 76, distancia: 24, altura: 52, pesoBola: 0.55, antecipa: 0.3, anteVoo: 0.5, limX: MX - 24, limZ0: -MZ + 24, limZ1: MZ - 18, olharY: 0 },
  atras: { recuo: 19, altura: 9.5, adiante: 12, olharY: 0, fov: 42, pesoBola: 0.5, antecipa: 0.4, anteVoo: 0.4 },
  // (olhando 7 m adiante, no chão: o controlado fica a ~3/4 da altura do quadro, acima do minimapa do PC e do pé da tela;
  // olhando 10 m adiante a 1 m de altura, os pés dele ficavam a 86%, debaixo do minimapa)
  jogador: { recuo: 7.5, altura: 3.9, adiante: 7, olharY: 0.2, fov: 48, antecipa: 0.18, bolaZ: 0.3, bolaZMax: 4 },
};
const LATERAIS = new Set(['tv', 'aproximada', 'ampla', 'alta']);
/**
 * Margens do quadro (NDC, −1..1) para a bola e o controlado (os pés e a cabeça): dos lados, em cima e embaixo — −0,7 fica acima do
 * minimapa do PC (no pé da tela, a partir de ~−0,75) e dos botões do celular. `perto`: um ponto a menos disto à frente da
 * câmera (atrás dela, ou embaixo dela) não entra no enquadramento — girar até ele seria virar a câmera.
 */
export const QUADRO = { x: 0.92, cima: 0.9, baixo: -0.7, perto: 1.5 };
/** Jogador: a troca de controlado corta quando o alvo pula mais que `salto` m num quadro e fica a mais de `longe` m do foco. */
export const CORTE_JOGADOR = { salto: 3, longe: 8 };
export const SEGURANCA = {
  xFundo: CAMPO.meioX + CAMPO.entorno - 0.5,  // 58 m: Atrás e Jogador nunca passam das placas do fundo
  zCa: ARQUIBANCADA.frenteZ - 1,              // 43,5 m: daqui para trás, a caixa da arquibancada de cá
  yCa: ARQUIBANCADA.yTopoLado + 6,            // 26 m: dentro da caixa (cameraNoLadoDeCa: y < 27) ela sai do desenho
  zCaMax: 70,                                 // antes do teto curto e da parede de cá (z 70 → 78,5)
  yJogador: 3.2,                              // acima de qualquer cabeça (pulo de cabeceio ~2,6 m)
  folga: 0.6,                                 // m de sólido em volta da câmera (o plano perto é 0,5 m)
};
const PERTO = new Set(['arquibancada de cá', 'túnel (paredes)', 'parede de cá', 'teto de cá']);
const ASPECTO_TV = 16 / 9;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
/** 0–20 → 0,6×–1,5× (10 = 1×). */
export function fatorAjuste(v) {
  const x = clamp(Number.isFinite(+v) ? +v : AJUSTE.padrao, AJUSTE.min, AJUSTE.max);
  return x <= 10 ? 0.6 + 0.04 * x : 1 + 0.05 * (x - 10);
}
/** Rumo no chão para onde a câmera olha (o do analógico): de lado −π/2; Atrás/Jogador, o do ataque (dir = ±1). */
export function yawDe(modo, dir) { return LATERAIS.has(modo) ? -Math.PI / 2 : dir >= 0 ? 0 : Math.PI; }

/** Mola crítica exata (a mesma de camera.js). */
function mola(est, kx, kv, alvo, w, dt) {
  const y = est[kx] - alvo, j1 = est[kv] + y * w, e = Math.exp(-w * dt);
  est[kx] = alvo + (y + j1 * dt) * e;
  est[kv] = (est[kv] - j1 * w * dt) * e;
}

/** fov vertical que mostra a largura `larg` (no foco, a `d` m) — a conta de camera.js fovPara. */
function fovLargura(larg, d, a, pequena) {
  const r = suave((1.25 - a) / 0.5);
  if (a < ASPECTO_TV) larg *= lerp(Math.sqrt(Math.max(a, 1.25) / ASPECTO_TV), 1, r);
  if (pequena) larg *= CAMERA.telaPequena;
  return (2 * Math.atan(larg / 2 / d / a) * 180) / Math.PI;
}
/** fov vertical de um plano pelo comprimento: f em 16:9 ou mais largo; mais estreito, a mesma largura (camera.js fovFixo). */
function fovFixo(f, a) {
  if (a >= ASPECTO_TV) return f;
  return (2 * Math.atan((Math.tan((f * Math.PI) / 360) * ASPECTO_TV) / a) * 180) / Math.PI;
}

/** Um sólido do estádio do jogo na posição (fora a arquibancada de cá com a câmera dentro da caixa dela)? */
export function poseBloqueada(x, y, z) {
  const s = solidoEm(x, y, z, SEGURANCA.folga, false);
  return !!s && !(PERTO.has(s) && cameraNoLadoDeCa({ x, y, z }));
}

/**
 * Os limites de segurança na pose `out` ({de, para, fov}) do modo: perto do lado de cá a câmera fica dentro da caixa da
 * arquibancada (que sai do desenho) ou na frente dela; Atrás/Jogador antes das placas do fundo; depois, sobe até sair de
 * qualquer sólido (o travessão, uma quina). Pura.
 */
export function segurarPose(modo, out) {
  const S = SEGURANCA, d = out.de;
  if (LATERAIS.has(modo)) {
    if (d[2] > S.zCaMax) d[2] = S.zCaMax;
    // na caixa da arquibancada de cá e acima dela (a arquibancada voltaria ao desenho entre a câmera e o campo): a câmera
    // anda pela reta até o ponto olhado até sair dela (z = 43,5 ou y = 26, o que vier primeiro) e o plano abre na mesma
    // conta (a mesma largura no ponto olhado). Contínua: antes ela ia para a borda mais perto, e trocar de borda pulava até
    // 14 m num quadro (Ampla com a Altura 20, com o controlado andando para o lado de cá)
    if (d[2] > S.zCa && d[1] > S.yCa) {
      const p = out.para;
      const lz = d[2] > p[2] ? (d[2] - S.zCa) / (d[2] - p[2]) : 1, ly = d[1] > p[1] ? (d[1] - S.yCa) / (d[1] - p[1]) : 1;
      const l = Math.min(lz, ly, 0.9);
      for (let i = 0; i < 3; i++) d[i] += (p[i] - d[i]) * l;
      out.fov = (2 * Math.atan(Math.tan((out.fov * Math.PI) / 360) / (1 - l)) * 180) / Math.PI;
    }
  } else {
    d[0] = clamp(d[0], -S.xFundo, S.xFundo);
    d[2] = clamp(d[2], -(MZ + 4), MZ + 4);
    if (modo === 'jogador' && d[1] < S.yJogador) d[1] = S.yJogador;
  }
  for (let k = 0; k < 24 && poseBloqueada(d[0], d[1], d[2]); k++) d[1] += 0.5;
  return out;
}

/**
 * Limites do foco de Ampla/Alta com a Distância fd: com o plano mais fechado (fd < 1) a margem até a borda do campo encolhe
 * junto (antes, fixa, com a Distância 0 a bola na lateral de lá e nos cantos saía do quadro). out = {limX, limZ0, limZ1}.
 */
export function limitesLateral(P, fd, out = {}) {
  const k = Math.min(1, fd);
  out.limX = MX - (MX - P.limX) * k; out.limZ0 = -MZ + (P.limZ0 + MZ) * k; out.limZ1 = MZ - (MZ - P.limZ1) * k;
  return out;
}

const _f = [0, 0, 0], _rr = [0, 0, 0], _u = [0, 0, 0], _p0 = [0, 0, 0], _t = [0, 0, 0];
/** A base da câmera (frente, direita, cima) da pose — a do lookAt do three.js com o "cima" em y. */
function baseDa(out) {
  const d = out.de, p = out.para;
  let fx = p[0] - d[0], fy = p[1] - d[1], fz = p[2] - d[2];
  const lf = Math.hypot(fx, fy, fz) || 1; fx /= lf; fy /= lf; fz /= lf;
  let rx = -fz, rz = fx;
  const lr = Math.hypot(rx, rz) || 1; rx /= lr; rz /= lr;
  _f[0] = fx; _f[1] = fy; _f[2] = fz; _rr[0] = rx; _rr[1] = 0; _rr[2] = rz;
  _u[0] = -rz * fy; _u[1] = rz * fx - rx * fz; _u[2] = rx * fy;
}
/** Os pontos (bits de `sel`) cabem nas margens da pose? */
function cabe(out, aspecto, pts, n, sel) {
  baseDa(out);
  const tv = Math.tan((out.fov * Math.PI) / 360), th = tv * aspecto, d = out.de, Q = QUADRO;
  for (let k = 0; k < n; k++) {
    if (!(sel & (1 << k))) continue;
    const vx = pts[3 * k] - d[0], vy = pts[3 * k + 1] - d[1], vz = pts[3 * k + 2] - d[2];
    const z = vx * _f[0] + vy * _f[1] + vz * _f[2];
    if (z < Q.perto) return false;
    const x = (vx * _rr[0] + vz * _rr[2]) / (z * th), y = (vx * _u[0] + vy * _u[1] + vz * _u[2]) / (z * tv);
    if (x > Q.x || x < -Q.x || y > Q.cima || y < Q.baixo) return false;
  }
  return true;
}
function olharPara(out, s) { for (let i = 0; i < 3; i++) out.para[i] = _p0[i] + (_t[i] - _p0[i]) * s; }
/**
 * Enquadra a pose: pts = [x, y, z, …] (n ≤ 8; o 1º é a bola — fica sempre no quadro, se os dois não couberem). Os pontos à
 * frente da câmera (≥ QUADRO.perto) fora das margens: o ponto olhado anda para o meio deles o mínimo que basta (bisseção;
 * contínuo nos pontos). Pura; devolve out.
 */
export function enquadrar(out, aspecto, pts, n) {
  baseDa(out);
  let sel = 0;
  for (let k = 0; k < n; k++) {
    const vx = pts[3 * k] - out.de[0], vy = pts[3 * k + 1] - out.de[1], vz = pts[3 * k + 2] - out.de[2];
    if (vx * _f[0] + vy * _f[1] + vz * _f[2] >= QUADRO.perto) sel |= 1 << k;
  }
  if (!sel || cabe(out, aspecto, pts, n, sel)) return out;
  for (let i = 0; i < 3; i++) _p0[i] = out.para[i];
  const alvo = s => {
    let c = 0; _t[0] = _t[1] = _t[2] = 0;
    for (let k = 0; k < n; k++) if (s & (1 << k)) { c++; for (let i = 0; i < 3; i++) _t[i] += pts[3 * k + i]; }
    for (let i = 0; i < 3; i++) _t[i] /= c;
  };
  alvo(sel);
  olharPara(out, 1);
  // os dois longe demais um do outro para caberem juntos: a bola primeiro
  if (!cabe(out, aspecto, pts, n, sel) && (sel & 1) && sel !== 1) { sel = 1; alvo(sel); olharPara(out, 1); }
  if (!cabe(out, aspecto, pts, n, sel)) return out;
  let lo = 0, hi = 1;
  for (let it = 0; it < 14; it++) {
    const m = (lo + hi) / 2;
    olharPara(out, m);
    if (cabe(out, aspecto, pts, n, sel)) hi = m; else lo = m;
  }
  olharPara(out, hi);
  return out;
}

/**
 * Pose de um perfil DE LADO (o rumo da TV) com o foco (fx, fz): {de, para, fov}. P = {largura, distancia, altura, olharY}
 * (o de camera.js para TV/aproximada, PERFIS_LIVRE para Ampla/Alta); fa/fd = os fatores de Altura e Distância.
 */
export function poseLateral(P, fx, fz, fa, fd, aspecto, pequena, out, fovPara = null) {
  const d = P.distancia * fd, h = P.altura * fa;
  out.de[0] = fx; out.de[1] = h; out.de[2] = fz + d;
  out.para[0] = fx; out.para[1] = P.olharY; out.para[2] = fz;
  if (fovPara) {
    // TV/aproximada: a conta da própria camera.js (com o retrato, a tela pequena e o perfil misturado)
    _q.largura = P.largura * fd; _q.distancia = d; _q.altura = h; _q.olharY = P.olharY; _q.retrato = P.retrato ?? 0;
    out.fov = fovPara(_q);
  } else out.fov = fovLargura(P.largura * fd, Math.hypot(d, h - P.olharY), aspecto, pequena);
  return out;
}
const _q = { largura: 0, distancia: 0, altura: 0, olharY: 0, retrato: 0 };

/**
 * Pose de Atrás/Jogador com o foco (fx, fz) e o rumo do ataque dir (±1): a câmera `recuo` atrás do foco pelo comprimento,
 * olhando `adiante`; desvio = quanto o ponto olhado vai de lado (Jogador: para a bola). Perto do próprio gol o recuo
 * encurta (as placas do fundo) e a câmera sobe 0,3 m por metro que faltou.
 */
export function poseComprimento(modo, fx, fz, dir, fa, fd, aspecto, out, desvio = 0) {
  const P = PERFIS_LIVRE[modo];
  const r = P.recuo * fd, h = P.altura * fa, s = dir >= 0 ? 1 : -1;
  let cx = fx - s * r;
  const falta = Math.max(0, Math.abs(cx) - SEGURANCA.xFundo);
  out.de[0] = cx; out.de[1] = h + 0.3 * falta; out.de[2] = fz;
  out.para[0] = fx + s * P.adiante * fd; out.para[1] = P.olharY; out.para[2] = fz + desvio;
  out.fov = fovFixo(P.fov, aspecto);
  return out;
}

const novaPose = () => ({ de: [0, 0, 0], para: [0, 0, 0], fov: 32 });

/**
 * A câmera do Livre que camera.js chama (definirExtra). opc.dir() = o rumo do ataque do time do humano (+1 | −1), lido a
 * cada quadro. Estado próprio: um foco com mola por câmera nova (as quatro andam juntas: a transição mistura duas poses
 * já assentadas), a troca (de qual câmera, há quanto tempo) e os fatores.
 */
export function criarCameraLivre(opc = {}) {
  const dirDe = opc.dir ?? (() => 1);
  const focos = {};
  for (const m of ['ampla', 'alta', 'atras', 'jogador']) focos[m] = { x: 0, z: 0, vx: 0, vz: 0 };
  let iniciado = false, atual = null, anterior = null, t = TRANSICAO, fa = 1, fd = 1, dir = 1;
  const pA = novaPose(), pB = novaPose(), fim = novaPose();
  const _pts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const _foco = { x: 0, z: 0 };

  /** Foco das câmeras de lado novas (a conta da TV em camera.js, com os pesos do perfil). */
  function alvoLateral(P, alvo, k) {
    let px = alvo.bx, pz = alvo.bz;
    if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.az)) { px += (alvo.ax - alvo.bx) * P.anteVoo; pz += (alvo.az - alvo.bz) * P.anteVoo; }
    const larg = P.largura * fd;
    const dbx = px - alvo.jx, dbz = pz - alvo.jz, db = Math.hypot(dbx, dbz), R = larg * 0.31;
    const w = db > 12 ? Math.max(P.pesoBola * 12 / db, 1 - R / db) : P.pesoBola;
    let fx = alvo.jx + dbx * w + alvo.jvx * P.antecipa, fz = alvo.jz + dbz * w + alvo.jvz * P.antecipa;
    fx = clamp(fx, alvo.bx - larg * 0.38, alvo.bx + larg * 0.38);
    fz = clamp(fz, alvo.bz - larg * 0.24, alvo.bz + larg * 0.24);
    const L = limitesLateral(P, fd, _lim);
    k.ax = clamp(fx, -L.limX, L.limX); k.az = clamp(fz, L.limZ0, L.limZ1);
  }
  const _lim = { limX: 0, limZ0: 0, limZ1: 0 };
  /** Foco de Atrás: entre o controlado e a bola; a bola entre 3 m atrás e 14 m adiante do foco, ≤ 9 m de lado. */
  function alvoAtras(alvo, k) {
    const P = PERFIS_LIVRE.atras;
    let px = alvo.bx, pz = alvo.bz;
    if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.az)) { px += (alvo.ax - alvo.bx) * P.anteVoo; pz += (alvo.az - alvo.bz) * P.anteVoo; }
    let fx = alvo.jx + (px - alvo.jx) * P.pesoBola + alvo.jvx * P.antecipa;
    let fz = alvo.jz + (pz - alvo.jz) * P.pesoBola + alvo.jvz * P.antecipa;
    // u = quanto o foco está adiante da bola, no rumo do ataque
    const u = clamp((fx - alvo.bx) * dir, -14, 3);
    fx = alvo.bx + u * dir;
    fz = clamp(fz, alvo.bz - 9, alvo.bz + 9);
    k.ax = clamp(fx, -MX + 4, MX - 4); k.az = clamp(fz, -MZ + 4, MZ - 4);
  }
  const _k = { ax: 0, az: 0 };
  // o alvo do Jogador no quadro de antes (a troca de controlado = o alvo pula)
  const jogAntes = { x: 0, z: 0, ok: false };
  let cortesJogador = 0;
  function andarFocos(dt, alvo, corte) {
    const wr = CAMERA.rigidez;
    for (const m of ['ampla', 'alta', 'atras', 'jogador']) {
      const f = focos[m];
      let pula = false;
      if (m === 'jogador') {
        const P = PERFIS_LIVRE.jogador;
        _k.ax = alvo.jx + alvo.jvx * P.antecipa; _k.az = alvo.jz + alvo.jvz * P.antecipa;
        // troca de controlado (o alvo pulou) para longe do foco: corte — com a mola o novo ficava até ~0,6 s fora do quadro
        pula = jogAntes.ok && Math.hypot(_k.ax - jogAntes.x, _k.az - jogAntes.z) > CORTE_JOGADOR.salto
          && Math.hypot(_k.ax - f.x, _k.az - f.z) > CORTE_JOGADOR.longe;
        jogAntes.x = _k.ax; jogAntes.z = _k.az; jogAntes.ok = true;
        if (pula && iniciado && !corte) cortesJogador++;
      } else if (m === 'atras') alvoAtras(alvo, _k);
      else alvoLateral(PERFIS_LIVRE[m], alvo, _k);
      if (corte || !iniciado || pula) { f.x = _k.ax; f.z = _k.az; f.vx = 0; f.vz = 0; continue; }
      const w = m === 'jogador' ? 6 : wr;
      mola(f, 'x', 'vx', _k.ax, w, dt);
      mola(f, 'z', 'vz', _k.az, m === 'atras' || m === 'jogador' ? w : w * 0.8, dt);
    }
    iniciado = true;
  }
  /** A pose do modo neste quadro (sem os limites). I = o interno de camera.js (o perfil TV/aproximada e o foco dela). */
  function pose(modo, I, alvo, out) {
    const est = I.est;
    if (modo === 'tv' || modo === 'aproximada') return poseLateral(I.p, est.x, est.z, fa, fd, est.aspecto, est.pequena, out, I.fovPara);
    const f = focos[modo];
    if (modo === 'ampla' || modo === 'alta') return poseLateral(PERFIS_LIVRE[modo], f.x, f.z, fa, fd, est.aspecto, est.pequena, out);
    let desvio = 0;
    if (modo === 'jogador') { const P = PERFIS_LIVRE.jogador; desvio = clamp((alvo.bz - f.z) * P.bolaZ, -P.bolaZMax, P.bolaZMax); }
    return poseComprimento(modo, f.x, f.z, dir, fa, fd, est.aspecto, out, desvio);
  }

  const api = {
    modos: CAMERAS_LIVRE,
    /** O rumo do analógico (camera.js yaw): o do modo escolhido agora (na transição, já o novo). */
    get yaw() { return yawDe(atual ?? 'tv', dir); },
    /** O foco da sombra (camera.js foco). */
    get foco() { return _foco; },
    /** Altura e Distância (0–20; 10 = o perfil). */
    definirAjuste(a) { fa = fatorAjuste(a?.altura); fd = fatorAjuste(a?.distancia); },
    /** Estado para os testes: o modo, o de antes (na transição), a fração dela, o rumo e os fatores. */
    resumo() { return { modo: atual, anterior: t < TRANSICAO ? anterior : null, transicao: Math.min(1, t / TRANSICAO), yaw: yawDe(atual ?? 'tv', dir), dir, fa, fd, cortesJogador }; },
    /**
     * camera.js: depois de posicionar a câmera de jogo (TV/aproximada) — fora a câmera do gol, a de cinema, o plano geral e
     * a livre dos prints. Troca a pose pela do modo (est.modo), com a transição e os limites.
     */
    atualizar(dt, alvo, corte, I) {
      dir = dirDe() >= 0 ? 1 : -1;
      const modo = CAMERAS_LIVRE.includes(I.est.modo) ? I.est.modo : 'tv';
      if (modo !== atual) {
        anterior = atual; atual = modo; t = 0;
        // rumo diferente (de lado ↔ pelo comprimento) ou o 1º quadro: corte
        if (anterior == null || yawDe(anterior, dir) !== yawDe(modo, dir)) t = TRANSICAO;
      }
      if (corte) t = TRANSICAO;
      andarFocos(dt, alvo, corte);
      pose(modo, I, alvo, fim);
      segurarPose(modo, fim);
      // a bola, os pés e a cabeça do controlado no quadro (a bola no chão: o ponto dela no gramado)
      _pts[0] = alvo.bx; _pts[1] = 0.11; _pts[2] = alvo.bz; _pts[3] = alvo.jx; _pts[4] = 0; _pts[5] = alvo.jz;
      _pts[6] = alvo.jx; _pts[7] = 1.8; _pts[8] = alvo.jz;
      if (t < TRANSICAO) {
        t += dt;
        pose(anterior, I, alvo, pA);
        segurarPose(anterior, pA);
        const s = suave(t / TRANSICAO);
        for (let i = 0; i < 3; i++) { pB.de[i] = lerp(pA.de[i], fim.de[i], s); pB.para[i] = lerp(pA.para[i], fim.para[i], s); }
        pB.fov = lerp(pA.fov, fim.fov, s);
        segurarPose(modo, pB);
        enquadrar(pB, I.est.aspecto, _pts, 3);
        aplicar(I.camera, I.est.aspecto, pB);
      } else aplicar(I.camera, I.est.aspecto, enquadrar(fim, I.est.aspecto, _pts, 3));
      return true;
    },
    /** A pose pura de um modo com um foco dado (testes em Node): {de, para, fov}. */
    poseDe: pose,
  };
  function aplicar(camera, aspecto, p) {
    if (Math.abs(camera.fov - p.fov) > 1e-4 || camera.aspect !== aspecto) { camera.fov = p.fov; camera.aspect = aspecto; camera.updateProjectionMatrix(); }
    camera.position.set(p.de[0], p.de[1], p.de[2]);
    camera.lookAt(p.para[0], p.para[1], p.para[2]);
    // a sombra acompanha o que a câmera olha (de lado: o foco; pelo comprimento: entre o foco e o ponto olhado)
    _foco.x = LATERAIS.has(atual) ? p.para[0] : (p.de[0] + p.para[0]) * 0.5 + (p.para[0] - p.de[0]) * 0.2;
    _foco.z = p.para[2];
  }
  return api;
}
