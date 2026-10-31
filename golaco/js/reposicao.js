// Reposição do goleiro com a bola nas mãos (C5, item 16 da FILA; contrato "Reposição do goleiro com a mão" no CONTRATOS.md;
// PESQUISA-ETAPA4.md §15): rolar, arremessar por cima do ombro, bate-pronto e chutão. O GESTO é função PURA do estado
// (j.arremessoGk + o tick): a simulação leva a bola nas mãos por ele até a soltura (sim.js bolaNaReposicao) e a pose
// desenha braços, corpo e a perna do chute pela MESMA conta (anim.js) — o replay e o corpo novo (render/esqueleto.js, pelas
// juntas) desenham o mesmo. Sem three.js nem DOM; matemática pelo MD (a bola do estado entra no hash).
//
// Linha do tempo (ticks do mundo; a bola do estado no tick k é a do mundo com m.tick = k):
//   tick0 ............ solta ........................ chuta ............
//   rolar/ombro: a bola nas mãos pela curva do gesto; em `solta` ela sai (acoes.js arremessoGoleiro); os braços seguem.
//   bate/chutão: as mãos levam a bola à frente do pé e a soltam em `solta`; ela cai (queda livre) e o pé bate em `chuta`
//   (o chutão no ar, a GOLEIRO.reposicao.yChutao m; o bate-pronto no tick depois de ela tocar o chão).
import { GOLEIRO, PASSO, G, BOLA } from './config.js';
import { MD } from './matdet.js';
import { clamp } from './mat.js';

const R = GOLEIRO.reposicao, BM = GOLEIRO.bolaMao;
const seg = s => Math.max(1, Math.round(s / PASSO));
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
const lerp3 = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
function bezier(a, c, b, t, o) {
  const u = 1 - t;
  for (let i = 0; i < 3; i++) o[i] = u * u * a[i] + 2 * u * t * c[i] + t * t * b[i];
  return o;
}
const SEGURA = [BM.frente, 0, BM.altura];

/** Lado do braço que arremessa e do pé que chuta: +1 direito, −1 esquerdo (o pé preferido: 1 = direito). */
export function ladoReposicao(j) { return (j.par?.attr?.pePreferido ?? 1) === 0 ? -1 : 1; }

/** Chuta com o pé (bate-pronto, chutão)? */
export const chutaDaMao = tipo => tipo === 'bate' || tipo === 'chutao';

/**
 * Começa o gesto da reposição (sim.js goleiroComBola). plano = {tipo: 'rolar'|'ombro'|'bate'|'chutao', para (id|null),
 * dx, dz (direção pedida, unitária), L (m; o arremesso sem recebedor), forca, gx (x da linha do gol dele)}. A bola, agora no ponto de segurar com a junção
 * de goleiro.js bolaNaMao, entra no gesto com essa diferença (o), que some na 1ª parte (sem salto).
 */
export function iniciarReposicao(m, g, plano) {
  const t = plano.tipo, t0 = m.tick, lado = ladoReposicao(g);
  const solta = t0 + seg(t === 'rolar' ? R.tRolar : t === 'ombro' ? R.tOmbro : R.tSolta);
  let chuta = null;
  if (chutaDaMao(t)) {
    // a queda livre da soltura (soltaPe[2]) até o chão (bate-pronto: o pé no tick depois) ou até yChutao (chutão)
    const yc = t === 'bate' ? BOLA.raio : R.yChutao;
    const tq = Math.sqrt(2 * (R.soltaPe[2] - yc) / G);
    chuta = solta + (t === 'bate' ? Math.ceil(tq / PASSO - 1e-9) + 1 : Math.max(1, Math.round(tq / PASSO)));
  }
  const b = m.bola.p, fx = MD.cos(g.rumo), fz = MD.sin(g.rumo);
  const hx = g.x + fx * SEGURA[0], hz = g.z + fz * SEGURA[0];
  g.arremessoGk = {
    tipo: t, desde: g.segura?.desde ?? t0, tick0: t0, solta, chuta, lado, pe: lado > 0 ? 1 : 0,
    para: plano.para ?? null, dx: plano.dx, dz: plano.dz, L: plano.L ?? 0, forca: plano.forca ?? 0.7,
    rumo: MD.atan2(plano.dz, plano.dx), o: { x: b.x - hx, y: b.y - SEGURA[2], z: b.z - hz }, s: null, feito: null,
    gx: plano.gx ?? null,
  };
  return g.arremessoGk;
}

/** O gesto em andamento com a bola ainda com ele (nas mãos ou caindo para o pé)? Devolve o estado ou null. */
export function reposicaoAtiva(m, g) {
  const ar = g.arremessoGk;
  return ar && ar.feito == null && m.naMao === g.id && g.segura && ar.desde === g.segura.desde ? ar : null;
}

const _c = [0, 0, 0];
/** Ponto [frente, lado, altura] do centro da bola nas mãos na fração s (0 = segurando, 1 = soltura), na base do corpo. */
function curvaMao(tipo, s, o) {
  if (tipo === 'rolar' || tipo === 'ombro') {
    const a = tipo === 'rolar' ? 0.4 : 0.45, tras = tipo === 'rolar' ? R.rolarTras : R.ombroTras;
    if (s < a) return lerp3(SEGURA, tras, suave(s / a), o);
    const u = (s - a) / (1 - a);
    // o arco da soltura acelera (u²): o braço "chicoteia" e a bola sai no fim
    return bezier(tras, tipo === 'rolar' ? R.rolarBaixo : R.ombroCima, tipo === 'rolar' ? R.rolarSolta : R.ombroSolta, u * u, o);
  }
  return lerp3(SEGURA, R.soltaPe, suave(s), o);
}

/**
 * Centro da bola do gesto no tick k (escreve em out {x, y, z}; devolve out): nas mãos até a soltura (na base do corpo de
 * agora: j.x, j.z, j.rumo), com a diferença do começo sumindo; depois da soltura do bate-pronto/chutão, em queda livre do
 * ponto da soltura (ar.s) até o chão. vy (opcional, em out.vy): a velocidade vertical da queda. Com ar.gx (a partida), a bola
 * nas mãos fica a ≥ GOLEIRO.soltaLinha m aquém da linha do gol (colado nela, a bola atrás da cabeça ou ele virando cruzava a
 * linha: gol contra — teste-goleiro-regras G3c).
 */
export function bolaReposicao(j, ar, k, out) {
  if (ar.s && k > ar.solta) {
    const dt = (k - ar.solta) * PASSO;
    const y = ar.s.y - 0.5 * G * dt * dt;
    out.x = ar.s.x; out.z = ar.s.z;
    out.y = Math.max(BOLA.raio, y); out.vy = y > BOLA.raio ? -G * dt : 0;
    return out;
  }
  const s = clamp((k - ar.tick0) / Math.max(1, ar.solta - ar.tick0), 0, 1);
  curvaMao(ar.tipo, s, _c);
  const fx = MD.cos(j.rumo), fz = MD.sin(j.rumo), rx = -fz, rz = fx, l = _c[1] * ar.lado;
  const w = 1 - suave(s / 0.4);
  out.x = j.x + fx * _c[0] + rx * l + ar.o.x * w;
  out.y = _c[2] + ar.o.y * w;
  out.z = j.z + fz * _c[0] + rz * l + ar.o.z * w;
  out.vy = 0;
  if (ar.gx != null) {
    const sg = ar.gx > 0 ? 1 : -1;
    if ((ar.gx - out.x) * sg < GOLEIRO.soltaLinha) out.x = ar.gx - sg * GOLEIRO.soltaLinha;
  }
  return out;
}

const _b = { x: 0, y: 0, z: 0, vy: 0 };
/**
 * Quadro do gesto para a pose (anim.js), no tick k: escreve em q e devolve q (ou null sem gesto neste tick).
 * q.desce (m: o quadril desce), q.inclina (rad: o tronco a mais para a frente), q.w[0..1] (peso da mão esquerda/direita do
 * gesto sobre a do desenho normal), q.m[0..1] {x, y, z} (as mãos), q.wp (peso do tornozelo do pé que chuta), q.pe (0/1),
 * q.p {x, y, z} (o tornozelo), q.ponta (rad: a ponta do pé para baixo).
 */
export function quadroReposicao(j, m, q) {
  const ar = j.arremessoGk;
  if (!ar) return null;
  const k = m.tick;
  const ativa = reposicaoAtiva(m, j);
  const depois = !ativa && ar.feito != null && k > ar.feito ? (k - ar.feito) * PASSO : -1;
  const dur = chutaDaMao(ar.tipo) ? R.chuteSegue + 0.1 : R.seguimento;
  if (!ativa && !(depois >= 0 && depois < dur)) return null;
  const fx = MD.cos(j.rumo), fz = MD.sin(j.rumo), rx = -fz, rz = fx, L = ar.lado;
  const P = (f, l, y, o) => { o.x = j.x + fx * f + rx * l * L; o.y = y; o.z = j.z + fz * f + rz * l * L; return o; };
  q.desce = 0; q.inclina = 0; q.wp = 0; q.pe = ar.pe; q.ponta = 0;
  const iA = L > 0 ? 1 : 0, iO = 1 - iA; // a mão que arremessa (A) e a outra (O), pelo índice da pose (0 = esquerda)
  const mA = q.m[iA], mO = q.m[iO];
  const s = ativa ? clamp((k - ar.tick0) / Math.max(1, ar.solta - ar.tick0), 0, 1) : 1;
  const palma = BM.palma;
  if (ar.tipo === 'rolar' || ar.tipo === 'ombro') {
    const rol = ar.tipo === 'rolar';
    // o corpo: rolando desce e inclina até a soltura e volta no seguimento; por cima do ombro, o tronco vai para trás no
    // armar e para a frente na soltura
    const sobe = depois >= 0 ? 1 - suave(depois / R.seguimento) : 1;
    if (rol) { const e = ativa ? suave(s / 0.5) : sobe; q.desce = R.agacha * e; q.inclina = R.inclina * e; }
    else q.inclina = ativa ? (s < 0.45 ? -0.18 * suave(s / 0.45) : -0.18 + 0.43 * suave((s - 0.45) / 0.55)) : 0.25 * sobe;
    if (ativa) {
      bolaReposicao(j, ar, k, _b);
      // a mão que arremessa: de um lado da bola (segurando) para trás dela (empurra) na 1ª parte
      const t = suave(s / 0.35), atras = rol ? 0.085 : 0.1, cima = rol ? 0.075 : -0.035;
      const ax = _b.x + (rx * L * palma) * (1 - t) + (-fx * atras) * t, az = _b.z + (rz * L * palma) * (1 - t) + (-fz * atras) * t;
      mA.x = ax; mA.y = _b.y + cima * t; mA.z = az;
      // a outra: do outro lado da bola para o equilíbrio (rolando, aberta e baixa; por cima, apontando o alvo)
      P(rol ? 0.3 : 0.42, rol ? -0.38 : -0.16, rol ? 0.62 : 1.42, _o);
      mO.x = _b.x - rx * L * palma + (_o.x - (_b.x - rx * L * palma)) * t;
      mO.y = _b.y + (_o.y - _b.y) * t;
      mO.z = _b.z - rz * L * palma + (_o.z - (_b.z - rz * L * palma)) * t;
      q.w[0] = 1; q.w[1] = 1;
    } else {
      // depois da soltura: a mão que arremessa segue para a frente (rolando) ou para baixo cruzando o corpo (por cima) e as
      // duas voltam ao desenho normal na 2ª metade do seguimento
      const e = suave(depois / (R.seguimento * 0.5)), w = depois < R.seguimento * 0.5 ? 1 : 1 - suave((depois - R.seguimento * 0.5) / (R.seguimento * 0.5));
      const so = rol ? R.rolarSolta : R.ombroSolta;
      P(so[0] - (rol ? 0.085 : 0.1), so[1], so[2] + (rol ? 0.075 : -0.035), _o);
      P(rol ? 0.85 : 0.42, rol ? 0.14 : -0.06, rol ? 0.45 : 1.05, _p);
      mA.x = _o.x + (_p.x - _o.x) * e; mA.y = _o.y + (_p.y - _o.y) * e; mA.z = _o.z + (_p.z - _o.z) * e;
      P(rol ? 0.3 : 0.42, rol ? -0.38 : -0.16, rol ? 0.62 : 1.42, mO);
      q.w[0] = w; q.w[1] = w;
    }
    return q;
  }
  // bate-pronto e chutão: as mãos levam a bola à frente do pé e soltam; depois abrem (equilíbrio) e voltam
  if (ativa && k <= ar.solta) {
    bolaReposicao(j, ar, k, _b);
    mA.x = _b.x + rx * L * palma; mA.y = _b.y; mA.z = _b.z + rz * L * palma;
    mO.x = _b.x - rx * L * palma; mO.y = _b.y; mO.z = _b.z - rz * L * palma;
    q.w[0] = 1; q.w[1] = 1;
  } else {
    const t = (k - ar.solta) * PASSO;
    // as mãos saem da bola na soltura e abrem para os lados; voltam no fim do seguimento do chute
    const fim = (ar.chuta - ar.solta) * PASSO + R.chuteSegue;
    const e = suave(t / 0.2), w = 1 - suave((t - fim + 0.1) / 0.2);
    const sp = R.soltaPe;
    P(sp[0], sp[1] + palma, sp[2], _o); P(0.12, 0.42, 1.0, _p);
    mA.x = _o.x + (_p.x - _o.x) * e; mA.y = _o.y + (_p.y - _o.y) * e; mA.z = _o.z + (_p.z - _o.z) * e;
    P(sp[0], sp[1] - palma, sp[2], _o); P(0.12, -0.46, 1.02, _p);
    mO.x = _o.x + (_p.x - _o.x) * e; mO.y = _o.y + (_p.y - _o.y) * e; mO.z = _o.z + (_p.z - _o.z) * e;
    q.w[0] = w; q.w[1] = w;
  }
  // a perna do chute: do pé plantado para trás (armar), à bola no tick do chute (acelerando), o seguimento para cima e de
  // volta ao pé plantado da simulação (q.p é o tornozelo; peso q.wp sobre o pé da simulação)
  if (k > ar.solta) {
    // (o pé desenhado da simulação: jogador.js passoPeDesenhado — plantado, o ponto do chão)
    const pe = j.pes[ar.pe];
    _f.x = pe.tx ?? pe.x; _f.y = pe.ty ?? 0.08; _f.z = pe.tz ?? pe.z;
    P(-0.34, 0.14, 0.42, _bk);
    const yc = ar.tipo === 'bate' ? BOLA.raio : R.yChutao;
    // a bola no tick do chute: ar.s (soltura) caindo até yc — o tornozelo atrás dela, um pouco abaixo do centro
    const bx = ar.s ? ar.s.x : _f.x, bz = ar.s ? ar.s.z : _f.z;
    _ct.x = bx - fx * 0.13; _ct.y = Math.max(0.09, yc - 0.02); _ct.z = bz - fz * 0.13;
    P(0.78, 0.06, yc + (ar.tipo === 'bate' ? 0.6 : 0.65), _sg);
    const u = (k - ar.solta) / Math.max(1, ar.chuta - ar.solta);
    let a, b, e;
    if (k <= ar.chuta) {
      if (u < 0.55) { a = _f; b = _bk; e = suave(u / 0.55); }
      else { a = _bk; b = _ct; const v = (u - 0.55) / 0.45; e = v * v; }
      q.ponta = -0.5 * suave(u / 0.55);
    } else {
      const v = (k - ar.chuta) * PASSO / R.chuteSegue;
      if (v < 0.45) { a = _ct; b = _sg; e = 1 - (1 - v / 0.45) * (1 - v / 0.45); q.ponta = -0.5; }
      else { a = _sg; b = _f; e = suave((v - 0.45) / 0.55); q.ponta = -0.5 * (1 - e); }
      if (v >= 1) { a = _f; b = _f; e = 0; q.ponta = 0; }
    }
    q.p.x = a.x + (b.x - a.x) * e; q.p.y = a.y + (b.y - a.y) * e; q.p.z = a.z + (b.z - a.z) * e;
    q.wp = 1;
  }
  return q;
}
const _o = { x: 0, y: 0, z: 0 }, _p = { x: 0, y: 0, z: 0 }, _f = { x: 0, y: 0, z: 0 }, _bk = { x: 0, y: 0, z: 0 }, _ct = { x: 0, y: 0, z: 0 }, _sg = { x: 0, y: 0, z: 0 };

/** Quadro vazio para quadroReposicao (cada chamador tem o seu). */
export function novoQuadroReposicao() {
  return { desce: 0, inclina: 0, w: [0, 0], m: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], wp: 0, pe: 1, p: { x: 0, y: 0, z: 0 }, ponta: 0 };
}
