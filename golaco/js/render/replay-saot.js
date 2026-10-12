// Cena SEMIAUTOMÁTICA do impedimento no replay (pedidos do dono de 12/10: "no impedimento, quero que seja marcado o
// impedimento, tenha cena de impedimento, tipo aquelas cenas de replay do impedimento semiautomático" e "em um replay
// qualquer, aparece uma cena de quando NÃO foi impedimento também"). O CÉREBRO da cena, puro (sem three.js nem DOM;
// testes em Node: tools/teste-saot.mjs). Constantes em config.js REPLAY.saot; pesquisa em PESQUISA-ESTADIO.md §9.1.
//  - cenaImpedimento(anel, ev): quem é quem no impedimento marcado — o defensor vem do EVENTO (o penúltimo adversário da
//    decisão, impedimento.js), nunca adivinhado pela distância;
//  - checagemLegal(anel, opc): a cadeia de passe A→B mais apertada em POSIÇÃO LEGAL (critério abaixo);
//  - enquadrarSaot(anel, cena, aspecto, out): o quadro final — oblíquo e fora do centro, como o da Premier League ("on
//    an angle, off-centre": em linha com os dois eles se tapam) — por uma projeção pinhole própria, cada jogador um
//    cilindro, os dois dentro do quadro e sem se tapar; câmera fora das placas e dos bancos;
//  - cameraSaot(enq, u, out): a câmera na órbita (u de 0 a 1), do alto até o quadro final;
//  - faseSaot(t, tipo, out): o que aparece em cada instante da análise (parede, plano, pulsos, cor da decisão, selo).
// O ponto que vale é o CENTRO do corpo (o quadril; impedimento.js decide por ele): a parede e o plano ficam nele e o
// desenho nunca contradiz a decisão. A cena de posição legal só aparece se também for legal pelas partes do corpo
// (IFAB: cabeça, tronco e pés; braços não contam) — a imagem nunca mente.
import { REPLAY, CAMPO } from '../config.js';
import { J } from '../anim.js';
import {
  jogadorNoTick, poseNoTick, bolaNoTick, parteMaisAvancada, cadeiasNoIntervalo, fotoNoTick, marcasNoTick,
} from './replay-anel.js';
import { solidoEm } from '../estadio-forma.js';

const S = REPLAY.saot;
const GRAU = Math.PI / 180;
const ASPECTO_TV = 16 / 9;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const suave = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rampa = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// ------------------------------------------------------------------------------------------------ quem é quem
const _pose = new Float32Array(19 * 3), _xz = { x: 0, z: 0 }, _jg = { x: 0, z: 0, time: 0, goleiro: false };
const _b = { x: 0, y: 0, z: 0 };

/** {x, z, y (altura da pelve)} do jogador `id` no passo `tick` (null se não está no anel). */
function quadril(anel, tick, id) {
  if (id == null || id < 0) return null;
  if (!poseNoTick(anel, tick, id, _pose, _xz)) return null;
  return { x: _xz.x, z: _xz.z, y: _pose[J.pelve * 3 + 1] };
}

/**
 * Monta a cena (posições no passo da foto): {tipo, fotoTick, idAtac, idDef, idPor, linhaX, lado, margem, mesmaLinha,
 * atac {x, z, y}, def {x, z, y} | null, por {x, z, y} | null, bola {x, y, z}, zMin, zMax (a faixa em z da parede)}.
 * margem = (linhaX − x do atacante) · lado: > 0 = atrás da linha (legal); < −tolerância = impedido.
 */
function montarCena(anel, tipo, fotoTick, idAtac, idDef, idPor, linhaX, lado) {
  const atac = quadril(anel, fotoTick, idAtac);
  if (!atac) return null;
  const def = quadril(anel, fotoTick, idDef);
  const por = idPor !== idAtac ? quadril(anel, fotoTick, idPor) : null;
  const b = bolaNoTick(anel, fotoTick, _b);
  const bola = b ? { x: b.x, y: b.y, z: b.z } : { x: linhaX, y: 0.11, z: atac.z };
  const margem = (linhaX - atac.x) * lado;
  // a parede só onde estão os jogadores do lance (± margemZ): uma parede de 68 m encheria o quadro (a câmera fica perto)
  const z0 = Math.min(atac.z, def ? def.z : bola.z), z1 = Math.max(atac.z, def ? def.z : bola.z);
  return {
    tipo, fotoTick, idAtac, idDef: def ? idDef : -1, idPor: por ? idPor : -1, linhaX, lado, margem,
    mesmaLinha: Math.abs(margem) <= S.mesmaLinha, atac, def, por, bola,
    zMin: clamp(z0 - S.parede.margemZ, -CAMPO.meioZ, CAMPO.meioZ), zMax: clamp(z1 + S.parede.margemZ, -CAMPO.meioZ, CAMPO.meioZ),
  };
}

/**
 * Cena do impedimento MARCADO: ev = {fotoTick, id (o impedido), defensor (id do penúltimo na foto; null = a linha era a
 * bola ou o meio), por (quem passou), linhaX, lado (±1: para onde o time do impedido ataca)}. null fora do anel.
 */
export function cenaImpedimento(anel, ev) {
  if (ev.fotoTick == null || anel.slot(ev.fotoTick) < 0) return null;
  return montarCena(anel, 'impedimento', ev.fotoTick, ev.id, ev.defensor ?? -1, ev.por ?? -1, ev.linhaX, ev.lado >= 0 ? 1 : -1);
}

// ------------------------------------------------------------------------------------------------ posição legal
const _cad = [], _f = { tick: -1, time: 0, por: -1, def: -1, linhaX: 0, lado: 1 };
const _pa = { u: 0, junta: -1 }, _pd = { u: 0, junta: -1 };
const _poseD = new Float32Array(19 * 3);

/** A foto ficou com o time `time` (sem zerar nem passar ao adversário) do passo `de` ao `ate`? */
function fotoSegue(anel, de, ate, time) {
  for (let t = de; t <= ate; t++) { const f = fotoNoTick(anel, t, _f); if (!f || f.time !== time) return false; }
  return true;
}

/**
 * Fim do lance a partir da recepção (critério i): no gol, a foto segue com o time até o passo antes do gol; no "Replay"
 * da pausa (sem golTick), a cadeia termina num chute do time (ou num gol) dentro da janela, sem a foto zerar no caminho.
 */
function terminaEmChuteOuGol(anel, c, time, opc, ate) {
  if (opc.golTick != null) return fotoSegue(anel, c.recebeTick, opc.golTick - 1, time);
  for (let t = c.recebeTick; t <= ate; t++) {
    const mk = marcasNoTick(anel, t);
    if (mk & 2) return fotoSegue(anel, c.recebeTick, t - 1, time);
    if (mk & 1) { const f = fotoNoTick(anel, t, _f); if (f && f.time === time) return fotoSegue(anel, c.recebeTick, t, time); }
  }
  return false;
}

/**
 * Margem e legalidade de uma cadeia (critérios iii–v): {margem, legalPartes, uAtac, uDef} ou null (a linha era a bola
 * ou o meio, ou alguém fora do anel).
 */
export function medirCadeia(anel, c) {
  if (c.def < 0) return null;                                      // (iii) a linha era a bola ou o meio-campo
  const b = jogadorNoTick(anel, c.passeTick, c.id, _jg);
  if (!b) return null;
  const margem = (c.linhaX - b.x) * c.lado;                        // (iv) pelo centro
  if (!poseNoTick(anel, c.passeTick, c.id, _pose)) return null;
  if (!poseNoTick(anel, c.passeTick, c.def, _poseD)) return null;
  parteMaisAvancada(_pose, c.lado, _pa); parteMaisAvancada(_poseD, c.lado, _pd);
  return { margem, legalPartes: _pa.u <= _pd.u, uAtac: _pa.u, uDef: _pd.u, juntaAtac: _pa.junta, juntaDef: _pd.junta };   // (v)
}

/**
 * A POSIÇÃO LEGAL mais apertada para mostrar (a "checagem" do VAR, PESQUISA-ESTADIO.md §9.1). opc = {golTick (o replay
 * do gol) | fimTick (o "Replay" da pausa: fim da janela), time (do gol; sem ele, os dois times), lado (do gol), de (o
 * primeiro passe que vale: o começo do plano de TV + 0,5 s), teste (sem o critério i), limite (m; padrão S.limite),
 * semPartes (sem o critério v: só para medir a contradição centro × partes — tools/medir-saot.mjs)}.
 * Critério: (i) o lance termina em gol do time (ou, na pausa, em chute/gol) sem a foto zerar no caminho; (ii) cadeia A→B
 * do time no anel, depois do último corte; (iii) a linha era um defensor; (iv) margem pelo centro em [−mesmaLinha,
 * limite]; (v) legal também pelas partes do corpo, sem tolerância. A de menor margem; null se nenhuma.
 */
export function checagemLegal(anel, opc = {}) {
  if (anel.ultimo < 0) return null;
  const ate = Math.min(anel.ultimo, opc.golTick ?? opc.fimTick ?? anel.ultimo);
  const corte = anel.ultimoCorte(anel.primeiro, ate);
  let de = Math.max(anel.primeiro, corte ?? anel.primeiro, opc.de ?? -Infinity);
  const limite = opc.limite ?? S.limite;
  let melhor = null, mMargem = Infinity;
  for (const time of opc.time != null ? [opc.time] : [0, 1]) {
    const n = cadeiasNoIntervalo(anel, de, ate, time, _cad);
    for (let k = 0; k < n; k++) {
      const c = _cad[k];
      if (opc.lado != null && c.lado !== (opc.lado >= 0 ? 1 : -1)) continue;
      const md = medirCadeia(anel, c);
      if (!md || md.margem < -S.mesmaLinha || md.margem > limite || (!md.legalPartes && !opc.semPartes)) continue;
      if (md.margem >= mMargem) continue;
      if (!opc.teste && !terminaEmChuteOuGol(anel, c, time, opc, ate)) continue;
      mMargem = md.margem;
      melhor = { passeTick: c.passeTick, recebeTick: c.recebeTick, id: c.id, por: c.por, def: c.def, linhaX: c.linhaX, lado: c.lado, time, partes: md };
    }
  }
  if (!melhor) return null;
  const cena = montarCena(anel, 'legal', melhor.passeTick, melhor.id, melhor.def, melhor.por, melhor.linhaX, melhor.lado);
  if (cena) { cena.recebeTick = melhor.recebeTick; cena.time = melhor.time; cena.partes = melhor.partes; }
  return cena;
}

// ------------------------------------------------------------------------------------------------ câmera
/** fov vertical para o aspecto: `f` em 16:9 ou mais largo; mais estreito abre para a mesma largura (replay.js fovFixo). */
export function fovPara(f, aspecto) {
  if (aspecto >= ASPECTO_TV) return f;
  return (2 * Math.atan(Math.tan((f * Math.PI) / 360) * ASPECTO_TV / aspecto) * 180) / Math.PI;
}

// base da câmera (reaproveitada): f (frente), r (direita), u (cima)
const _bs = { fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, ux: 0, uy: 0, uz: 0 };
function base(cx, cy, cz, tx, ty, tz) {
  let fx = tx - cx, fy = ty - cy, fz = tz - cz;
  const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
  // r = f × cima
  let rx = -fz, rz = fx; const lr = Math.hypot(rx, rz) || 1; rx /= lr; rz /= lr;
  // u = r × f
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  _bs.fx = fx; _bs.fy = fy; _bs.fz = fz; _bs.rx = rx; _bs.ry = 0; _bs.rz = rz; _bs.ux = ux; _bs.uy = uy; _bs.uz = uz;
  return _bs;
}

/**
 * Retângulo na tela (NDC −1..1) do cilindro de pé em (x, z) — raio e altura de S.cilindro —, vista da câmera c com a base
 * b e as tangentes tanH/tanV. out {x0, x1, y0, y1, atras}.
 */
export function retanguloCilindro(x, z, cx, cy, cz, b, tanH, tanV, out = { x0: 0, x1: 0, y0: 0, y1: 0, atras: false }) {
  const R = S.cilindro.raio, H = S.cilindro.altura;
  out.x0 = Infinity; out.x1 = -Infinity; out.y0 = Infinity; out.y1 = -Infinity; out.atras = false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
    for (let h = 0; h <= 1; h++) {
      const dx = px - cx, dy = h * H - cy, dz = pz - cz;
      const zc = dx * b.fx + dy * b.fy + dz * b.fz;
      if (zc <= 0.05) { out.atras = true; continue; }
      const sx = (dx * b.rx + dz * b.rz) / (zc * tanH), sy = (dx * b.ux + dy * b.uy + dz * b.uz) / (zc * tanV);
      if (sx < out.x0) out.x0 = sx; if (sx > out.x1) out.x1 = sx; if (sy < out.y0) out.y0 = sy; if (sy > out.y1) out.y1 = sy;
    }
  }
  return out;
}

/** Fração da área do MENOR retângulo coberta pelo outro (0 = sem se tapar). */
export function sobreposicao(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  const aa = (a.x1 - a.x0) * (a.y1 - a.y0), ab = (b.x1 - b.x0) * (b.y1 - b.y0);
  return (w * h) / Math.max(1e-9, Math.min(aa, ab));
}

/** Câmera em (cx, cy, cz) e a linha de visão até os alvos livres de sólidos (placas, bancos, arquibancada, gols)? */
function cameraLivre(cx, cy, cz, alvos) {
  if (cy < S.alturaMin) return false;
  if (solidoEm(cx, cy, cz, 0.4, false)) return false;
  for (const a of alvos) {
    const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz, L = Math.hypot(dx, dy, dz);
    // amostras até 1,5 m antes do alvo (perto dele o "chão" e o próprio corpo não contam)
    const n = Math.max(2, Math.ceil((L - 1.5) / 1.5));
    for (let k = 1; k <= n; k++) {
      const t = ((L - 1.5) / L) * (k / n);
      const s = solidoEm(cx + dx * t, cy + dy * t, cz + dz * t, 0.05, false);
      if (s && s !== 'chão') return false;
    }
  }
  return true;
}

const _ra = { x0: 0, x1: 0, y0: 0, y1: 0, atras: false }, _rd = { x0: 0, x1: 0, y0: 0, y1: 0, atras: false };
/** Projeta os dois cilindros com a câmera em c olhando t; devolve quanto passam da folga (0 = dentro). */
function projetarPar(A, D, cx, cy, cz, tx, ty, tz, tanH, tanV) {
  const b = base(cx, cy, cz, tx, ty, tz);
  retanguloCilindro(A.x, A.z, cx, cy, cz, b, tanH, tanV, _ra);
  retanguloCilindro(D.x, D.z, cx, cy, cz, b, tanH, tanV, _rd);
  const lim = 1 - 2 * S.folga; // a folga é fração do quadro de cada lado (NDC vai de −1 a 1)
  let fora = 0;
  for (const r of [_ra, _rd]) {
    if (r.atras) fora += 10;
    fora += Math.max(0, r.x1 - lim) + Math.max(0, -lim - r.x0) + Math.max(0, r.y1 - lim) + Math.max(0, -lim - r.y0);
  }
  return fora;
}

/**
 * Mede um quadro candidato: câmera a `d` m do ponto médio M (dos dois quadris), `el`° de elevação, azimute `az`° (0 =
 * +z, o lado da TV), MIRANDO o centro do par na tela (um perto e o outro longe da câmera: o ponto médio no espaço não é
 * o meio da tela). out {ok, sobre (sobreposição), fora (quanto passa da folga, ≥ 0), livre, cx, cy, cz (câmera), tx, ty,
 * tz (para onde olha), ra, rd}.
 */
function medirQuadro(cena, M, el, az, d, tanH, tanV, out) {
  const ce = Math.cos(el * GRAU), se = Math.sin(el * GRAU);
  const cx = M.x + Math.sin(az * GRAU) * ce * d, cy = M.y + se * d, cz = M.z + Math.cos(az * GRAU) * ce * d;
  const A = cena.atac, D = cena.def ?? { x: cena.linhaX, z: cena.bola.z };
  let tx = M.x, ty = M.y, tz = M.z;
  projetarPar(A, D, cx, cy, cz, tx, ty, tz, tanH, tanV);
  // mira de novo: o ponto (na profundidade de M) que cai no centro do retângulo dos dois
  const mx = (Math.min(_ra.x0, _rd.x0) + Math.max(_ra.x1, _rd.x1)) / 2, my = (Math.min(_ra.y0, _rd.y0) + Math.max(_ra.y1, _rd.y1)) / 2;
  if (!_ra.atras && !_rd.atras && Number.isFinite(mx) && Number.isFinite(my)) {
    const b = base(cx, cy, cz, tx, ty, tz);
    tx += (b.rx * mx * tanH + b.ux * my * tanV) * d; ty += (b.ry * mx * tanH + b.uy * my * tanV) * d; tz += (b.rz * mx * tanH + b.uz * my * tanV) * d;
  }
  const fora = projetarPar(A, D, cx, cy, cz, tx, ty, tz, tanH, tanV);
  out.sobre = sobreposicao(_ra, _rd); out.fora = fora;
  out.cx = cx; out.cy = cy; out.cz = cz; out.tx = tx; out.ty = ty; out.tz = tz;
  out.livre = cameraLivre(cx, cy, cz, [{ x: A.x, y: 1.6, z: A.z }, { x: D.x, y: 1.6, z: D.z }]);
  out.ok = out.livre && fora === 0 && out.sobre <= S.sobreposicaoMax;
  out.ra = { ..._ra }; out.rd = { ..._rd };
  return out;
}

/**
 * Um candidato a quadro final (testes: a prova de que nenhum quadro de uma faixa cabe os dois): câmera a `d` m do ponto
 * médio dos quadris, `el`°, azimute `az`° (0 = +z), para o `aspecto`. {ok, sobre, fora, livre, ...}.
 */
export function medirCandidato(cena, el, az, d, aspecto, out = {}) {
  const A = cena.atac, D = cena.def ?? { x: cena.linhaX, z: cena.bola.z, y: A.y };
  const M = { x: (A.x + D.x) / 2, y: ((A.y ?? 0.95) + (D.y ?? 0.95)) / 2, z: (A.z + D.z) / 2 };
  const fov = fovPara(S.fov, aspecto), tanV = Math.tan((fov * GRAU) / 2);
  return medirQuadro(cena, M, el, az, d, tanV * aspecto, tanV, out);
}

/**
 * Quadro final da análise (uma vez por roteiro): tenta `elFim` × `desvios` (do lado da TV; sem nenhum, do lado oposto)
 * e, em cada um, a MENOR distância em [dist] que enquadra os dois com a folga e sem se taparem (sobreposição ≤ máx.),
 * câmera ≥ alturaMin e fora dos sólidos; sem nenhum, o nível "extra" (os dois longe na largura). Fica no primeiro que
 * serve; sem nenhum, no menos ruim (ok = false). out = {ok, nivel (0 = o da TV, 1 = longe, 2 = extra), mx, my, mz (o centro da
 * órbita: para onde a câmera final olha), el, az (graus; 0 = +z: a câmera final em coordenadas esféricas em volta do
 * centro), desvio (graus fora do eixo da linha, com sinal), d, fov (vertical, graus, já para o aspecto), cx, cy, cz,
 * sobre, ra, rd (retângulos NDC), lado ('tv'|'oposto')}.
 */
export function enquadrarSaot(anel, cena, aspecto, out = {}) {
  const A = cena.atac, D = cena.def ?? { x: cena.linhaX, z: cena.bola.z, y: A.y };
  const M = { x: (A.x + D.x) / 2, y: ((A.y ?? 0.95) + (D.y ?? 0.95)) / 2, z: (A.z + D.z) / 2 };
  const fov = fovPara(S.fov, aspecto);
  const tanV = Math.tan((fov * GRAU) / 2), tanH = tanV * aspecto;
  const q = {};
  let menos = null, menosPena = Infinity;
  // 1º o quadro da TV (12–24°, perto da linha); só se nenhum couber, o mesmo mais longe e, por fim, o "extra" (os dois
  // longe na largura do campo)
  for (const [nivel, F] of [[0, S], [1, S.longe], [2, S.extra]]) {
    for (const lado of ['tv', 'oposto']) {
      for (const el of F.elFim) {
        for (const dv of F.desvios) {
          const az = lado === 'tv' ? dv : 180 - dv;
          for (let d = F.dist[0]; d <= F.dist[1] + 1e-9; d += 0.25) {
            medirQuadro(cena, M, el, az, d, tanH, tanV, q);
            if (q.ok) return preencherEnq(out, fov, q, lado, true, nivel);
            if (q.livre) {
              const pena = q.fora * 4 + Math.max(0, q.sobre - S.sobreposicaoMax) + (lado === 'oposto' ? 0.5 : 0) + nivel;
              if (pena < menosPena) { menosPena = pena; menos = { q: { ...q }, lado, nivel }; }
            }
          }
        }
      }
    }
  }
  if (menos) return preencherEnq(out, fov, menos.q, menos.lado, false, menos.nivel);
  // nada livre (não acontece no campo): o primeiro candidato, do alto
  medirQuadro(cena, M, S.elFim[1], S.desvios[0], S.dist[1], tanH, tanV, q);
  return preencherEnq(out, fov, q, 'tv', false, 0);
}

/** Preenche o quadro final pela câmera e pelo alvo do candidato: coordenadas esféricas em volta do alvo. */
function preencherEnq(out, fov, q, lado, ok, nivel) {
  const dx = q.cx - q.tx, dy = q.cy - q.ty, dz = q.cz - q.tz, d = Math.hypot(dx, dy, dz);
  const el = Math.asin(dy / d) / GRAU, az = Math.atan2(dx, dz) / GRAU;
  // desvio do eixo da linha (o eixo z): do lado da TV, o próprio azimute; do lado oposto, 180° − azimute
  let dv = lado === 'tv' ? az : 180 - az;
  if (dv > 180) dv -= 360; else if (dv < -180) dv += 360;
  out.ok = ok; out.nivel = nivel; out.mx = q.tx; out.my = q.ty; out.mz = q.tz; out.el = el; out.az = az; out.desvio = dv; out.d = d; out.fov = fov;
  out.cx = q.cx; out.cy = q.cy; out.cz = q.cz; out.sobre = q.sobre; out.ra = q.ra; out.rd = q.rd; out.lado = lado;
  return out;
}

/**
 * Câmera da órbita (u de 0 a 1, suavizado aqui): do alto (elIni°, azimute final + azIni° para o lado de fora, distIni ×
 * d) até o quadro final, em coordenadas esféricas em volta do ponto médio dos quadris. reduzir ("reduzir movimento"):
 * já no quadro final. out {x, y, z, alvoX, alvoY, alvoZ, fov, el, az}.
 */
export function cameraSaot(enq, u, out = {}, reduzir = false) {
  const s = reduzir ? 1 : suave(u);
  const sinal = enq.desvio >= 0 ? 1 : -1;
  const el = lerp(S.elIni, enq.el, s);
  const az = lerp(enq.az + sinal * (enq.lado === 'oposto' ? -1 : 1) * S.azIni, enq.az, s);
  const d = lerp(enq.d * S.distIni, enq.d, s);
  const ce = Math.cos(el * GRAU);
  out.x = enq.mx + Math.sin(az * GRAU) * ce * d; out.y = enq.my + Math.sin(el * GRAU) * d; out.z = enq.mz + Math.cos(az * GRAU) * ce * d;
  out.alvoX = enq.mx; out.alvoY = enq.my; out.alvoZ = enq.mz; out.fov = enq.fov; out.el = el; out.az = az;
  return out;
}

// ------------------------------------------------------------------------------------------------ fases
/**
 * O que a análise mostra no instante t (s desde o corte) — tipo 'impedimento' (3,6 s) ou 'legal' (3,4 s). out = {tipo,
 * t, fase ('entrada' | 'orbita' | 'final'), u (órbita, 0–1, sem suavizar), parede, plano (alfas 0–1), pulsoDef,
 * pulsoAtac (0–1), batidaDef, batidaAtac (fase da batida, 0–1), cor (0 = neutro → 1 = cor da decisão), selo (0–1),
 * decidido}. mesmaLinha (legal): sem o plano do atacante — o pulso dele fica encostado na parede, parado, no quadro
 * final. reduzir ("reduzir movimento"): sem órbita (u = 1) e o selo entra sem animação.
 */
export function faseSaot(t, tipo, out = {}, mesmaLinha = false, reduzir = false) {
  const T = S[tipo] ?? S.impedimento;
  out.tipo = tipo; out.t = t;
  out.fase = t < T.orbita[0] ? 'entrada' : t < T.decisao ? 'orbita' : 'final';
  out.u = reduzir ? 1 : rampa(t, T.orbita[0], T.orbita[1]);
  out.parede = rampa(t, T.parede[0], T.parede[1]);
  out.plano = tipo === 'legal' && mesmaLinha ? 0 : rampa(t, T.plano[0], T.plano[1]);
  // pulsos: entram em 0,12 s e somem na decisão (o quadro final da PL não tem pulso)
  const some = 1 - rampa(t, T.decisao, T.decisao + S.cor);
  out.pulsoDef = rampa(t, T.pulsoDef[0], T.pulsoDef[0] + 0.12) * (t < T.pulsoDef[1] ? 1 : some);
  out.batidaDef = t >= T.pulsoDef[0] ? ((t - T.pulsoDef[0]) % S.batida) / S.batida : 0;
  const fixo = tipo === 'legal' && mesmaLinha;   // "mesma linha": o pulso do atacante fica (parado) no quadro final
  out.pulsoAtac = rampa(t, T.pulsoAtac[0], T.pulsoAtac[0] + 0.12) * (t < T.pulsoAtac[1] || fixo ? 1 : some);
  out.batidaAtac = fixo && t >= T.decisao ? 0 : t >= T.pulsoAtac[0] ? ((t - T.pulsoAtac[0]) % S.batida) / S.batida : 0;
  out.cor = rampa(t, T.decisao, T.decisao + S.cor);
  out.decidido = t >= T.decisao;
  out.selo = reduzir ? (out.decidido ? 1 : 0) : rampa(t, T.decisao, T.decisao + S.selo);
  return out;
}

/** Duração (s) da análise do tipo. */
export const duracaoSaot = tipo => (S[tipo] ?? S.impedimento).dura;
