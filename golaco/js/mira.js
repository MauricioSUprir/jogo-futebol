// Cobrança mirada da bola parada da PESSOA (16/10): contrato no CONTRATOS.md, constantes em config.js MIRA. Puro.
import { CAMPO, ACOES, MIRA, BOTAO, BARREIRA, PASSO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { criarBola, passoBola, elevacaoParaAltura, passagemLivre } from './bola.js';

export const TIPOS_MIRA = ['escanteio', 'tiroLivre', 'tiroDeMeta'];
const ladoDe = (m, t) => (m.ataca ? m.ataca[t] : (t === 0 ? 1 : -1));
export const chuteAGol = (m, pr) => pr.tipo === 'tiroLivre' && !!pr.direto && MD.hypot(ladoDe(m, pr.time) * CAMPO.meioX - pr.x, pr.z) <= MIRA.distChute;

// alvo de partida (câmera e mira): marca do pênalti, meio do gol, 35 m à frente (tiro de meta), 30 m para o gol
export function alvoPadrao(m, pr, out = {}) {
  const lado = ladoDe(m, pr.time), gx = lado * CAMPO.meioX;
  if (pr.tipo === 'escanteio') { out.x = gx - lado * CAMPO.marcaPenalti; out.z = 0; }
  else if (pr.tipo === 'penalti' || chuteAGol(m, pr)) { out.x = gx; out.z = 0; }
  else if (pr.tipo === 'tiroDeMeta') { out.x = pr.x + lado * 35; out.z = pr.z * 2.5; }
  else { const dx = gx - lado * CAMPO.marcaPenalti - pr.x, dz = -pr.z, k = Math.min(1, 30 / (MD.hypot(dx, dz) || 1)); out.x = pr.x + dx * k; out.z = pr.z + dz * k; }
  return out;
}

export function criarMira(m, pr) {
  const a = alvoPadrao(m, pr), ang0 = MD.atan2(a.z - pr.z, a.x - pr.x);
  return { ang0, ang: ang0, curva: 0, cone: MIRA.cone[pr.tipo] ?? 1, rep: [-1, -1] };
}

// um tick: o lado do analógico (de ang0) gira a mira; EFEITO_E/D: um degrau de curva (segurar repete)
export function atualizarMira(m, c, mi, tipo) {
  const lat = (-MD.sin(mi.ang0) * c.ix + MD.cos(mi.ang0) * c.iz) * c.imag;
  if (c.imag > 0 && Math.abs(lat) > 0.15) mi.ang = mi.ang0 + clamp(difAng(mi.ang0, mi.ang + lat * MIRA.gira * PASSO), -mi.cone, mi.cone);
  if (tipo === 'tiroDeMeta') { mi.curva = 0; return; }
  for (let k = 0, P = MIRA.curvaPasso; k < 2; k++) {
    const bit = k ? BOTAO.EFEITO_D : BOTAO.EFEITO_E, antes = (c.botoesAnt & bit) !== 0;
    if (!(c.botoes & bit)) { mi.rep[k] = -1; continue; }
    if (!antes || (mi.rep[k] >= 0 && m.tick >= mi.rep[k])) {
      mi.curva = clamp(Math.round((mi.curva + (k ? P : -P)) / P) * P, -1, 1);
      mi.rep[k] = m.tick + Math.round((antes ? 1 : 2.5) * MIRA.curvaRepete / PASSO);
    }
  }
}

// tipo pelo botão: alta, tensa, chute (a trajetória) ou curta, longa (o passe do jogo)
export function tipoMirado(m, pr, botao, mod) {
  const aGol = chuteAGol(m, pr), passe = botao === 'passe' || botao === 'enfiada';
  if (pr.tipo === 'tiroDeMeta') return passe ? 'curta' : 'longa';
  if (passe) return 'curta';
  if (botao === 'chute') return aGol ? 'chute' : 'tensa';
  if (botao === 'lancamento') return mod ? 'tensa' : 'alta';
  return aGol ? 'chute' : 'alta';
}
export const comTrajetoria = t => t === 'alta' || t === 'tensa' || t === 'chute';

// A mira do chute pela força (C2, item 13): a MESMA conta no chute do jogo (acoes.js chute) e na linha da cobrança mirada
// (chuteMirado), para a linha continuar a física da bola. Até ACOES.chute.cheia.de, a curva de antes, medida 0,4 m antes da
// linha (a IA chuta com ≤ 0,9: a partida IA × IA fica igual); acima, a barra cheia sobe até cheia.y m NA linha do gol
// (saidaNaLinha: de perto a subida é íngreme e a altura medida antes da linha passava nela até 0,35 m mais alta, no
// travessão) e o canto do analógico chega a meia-boca − cheia.zFolga m: o ângulo. Com o erro do chute (forcaMaxErro), uma
// parte passa por cima. cheia = false: a curva de antes em toda força (o pênalti do humano: a mira dele vai só a
// ±penaltiCanto, longe do ângulo, e a mira alta só somava bola por cima — com a barra cheia, 17% → 42% para fora)
export const miraCheia = forca => forca > ACOES.chute.cheia.de;
export function alturaMiraChute(forca, cheia = true) {
  const c = ACOES.chute, y = lerp(c.yAlvo[0], c.yAlvo[1], forca * forca), k = c.cheia;
  if (!cheia || !miraCheia(forca)) return y;
  const y0 = lerp(c.yAlvo[0], c.yAlvo[1], k.de * k.de);
  return lerp(y0, k.y, clamp((forca - k.de) / (1 - k.de), 0, 1));
}
// o maior |z| (m do meio do gol) da mira do analógico no chute do jogo
export function zMaxMiraChute(forca) {
  const k = ACOES.chute.cheia, meio = CAMPO.gol.largura / 2;
  return meio - (miraCheia(forca) ? lerp(k.zFolgaJogo, k.zFolga, clamp((forca - k.de) / (1 - k.de), 0, 1)) : k.zFolgaJogo);
}

// Elevação (rad) para a bola, saindo de pp a s m/s na direção (ux, uz) com o giro w, cruzar a linha do gol (x = gx) na
// altura y, no voo SEM o gol (bola.js passagemLivre), de −8° a 50° como bola.js elevacaoParaAltura. A altura na linha não
// cresce em toda a faixa (alta demais, a bola lenta cai antes da linha): a 1ª elevação de baixo para cima que chega a y
// (passos de 0,08 rad) e a busca binária entre ela e a de antes — o chute mais tenso que chega lá; nenhuma chega, a que
// passa mais alto
export function elevacaoNaLinha(pp, ux, uz, gx, s, y, w) {
  let lo = -0.14, yMelhor = -Infinity, elMelhor = lo;
  for (let el = lo; el <= 0.87 + 1e-9; el += 0.08) {
    const yl = alturaNaLinha(pp, ux, uz, gx, s, el, w);
    if (yl >= y) {
      let hi = el;
      for (let i = 0; i < 20; i++) {
        const m = (lo + hi) / 2;
        if (alturaNaLinha(pp, ux, uz, gx, s, m, w) < y) lo = m; else hi = m;
      }
      return (lo + hi) / 2;
    }
    if (yl > yMelhor) { yMelhor = yl; elMelhor = el; }
    lo = el;
  }
  return elMelhor;
}
function alturaNaLinha(pp, ux, uz, gx, s, el, w) {
  const ce = MD.cos(el);
  _v.x = ux * s * ce; _v.y = s * MD.sin(el); _v.z = uz * s * ce;
  return passagemLivre(pp, _v, w, gx).y;
}
const _v = { x: 0, y: 0, z: 0 };

// A saída do chute com a barra cheia (revisão do C2): a direção (ux, uz) e a elevação para a bola, SEM o erro, cruzar a linha
// do gol (x = gx) em (y, zMira). Sem efeito a reta até a mira já cruza em zMira e só a elevação é buscada; com o efeito do
// colocado, o giro da saída por secante (dz/da = (gx − x)/ux² no 1º passo, ≤ 6 voltas, até 5 mm). O voo de teste com o gol
// (alturaNaDistancia) batia no travessão, na haste ou no véu no passo em que chegava à distância da mira e voltava 'caiu': a
// busca do giro saltava (o colocado sem erro a 19 m passava a 8 m do gol; a 35 m, na trave). O giro que não chega à linha
// (o colocado fraco de longe e de lado não alcança a mira: cai antes) volta para o meio do caminho até o último que chegava
export function saidaNaLinha(pp, gx, zMira, s, y, w, out = {}) {
  let ux = gx - pp.x, uz = zMira - pp.z;
  const L = MD.hypot(ux, uz) || 1;
  ux /= L; uz /= L;
  out.x = ux; out.z = uz; out.el = elevacaoNaLinha(pp, ux, uz, gx, s, y, w);
  if (w.x === 0 && w.y === 0 && w.z === 0) return out;
  const gira = a => { const c = MD.cos(a), sn = MD.sin(a); return { x: ux * c - uz * sn, z: ux * sn + uz * c }; };
  let a = 0, r = passaNaLinha(pp, out, out.el, s, w, gx);
  // nem a reta chega à linha (o efeito afasta a bola dela: o colocado lento de lado, para o 1º pau): gira contra o efeito
  // (a força de Magnus em z é −ωy·vx; dz/da tem o sinal de gx − x: o giro que a desfaz tem o sinal de ωy) até chegar
  for (let k = 1; k <= 8 && r.caiu && w.y !== 0; k++) {
    a = k * 0.05 * Math.sign(w.y);
    const g = gira(a), el = elevacaoNaLinha(pp, g.x, g.z, gx, s, y, w);
    r = passaNaLinha(pp, g, el, s, w, gx);
    if (!r.caiu) { out.x = g.x; out.z = g.z; out.el = el; }
  }
  if (r.caiu) return out; // nenhum giro chega: a reta (o chute cai antes da linha)
  let aOk = a, eOk = r.z - zMira;
  a -= eOk * ux * ux / (gx - pp.x);
  for (let k = 0; k < 6 && Math.abs(eOk) > 0.005; k++) {
    const g = gira(a), el = elevacaoNaLinha(pp, g.x, g.z, gx, s, y, w);
    r = passaNaLinha(pp, g, el, s, w, gx);
    if (r.caiu) { a = (a + aOk) / 2; continue; }
    const e = r.z - zMira;
    out.x = g.x; out.z = g.z; out.el = el;
    if (Math.abs(e) <= 0.005 || a === aOk) break;
    const d = (e - eOk) / (a - aOk);
    aOk = a; eOk = e;
    a -= e / (Math.abs(d) > 1e-6 ? d : (gx - pp.x) / (ux * ux));
  }
  return out;
}
function passaNaLinha(pp, u, el, s, w, gx) {
  const ce = MD.cos(el);
  _v.x = u.x * s * ce; _v.y = s * MD.sin(el); _v.z = u.z * s * ce;
  return passagemLivre(pp, _v, w, gx);
}

// {v, w} PRETENDIDOS (a mesma conta no chute e na linha); curva + = para a direita de quem bate (ωy < 0)
export function chuteMirado(m, j, pr, tipo, forca, ang, curva, out = {}) {
  const b = m.bola, pp = { x: b.p.x, y: b.p.y, z: b.p.z }, ux = MD.cos(ang), uz = MD.sin(ang), a = j.par.attr, ch = tipo === 'chute';
  const wy = -clamp(curva, -1, 1) * MIRA.giro * lerp(MIRA.giroAtrib[0], MIRA.giroAtrib[1], clamp(((ch ? a.finalizacao : a.passeLongo) ?? 70) / 100, 0, 1));
  const cfg = ch ? ACOES.chute : tipo === 'tensa' ? MIRA.tensa : MIRA.alta, g = ch ? cfg.giroFalta : 6;
  const w = { x: uz * g, y: wy, z: -ux * g };
  let s = lerp(cfg.v[0], cfg.v[1], forca), el = cfg.elev;
  if (ch) {
    s *= lerp(0.86, 1.08, a.finalizacao / 100);
    const lado = ladoDe(m, j.time), D = ux * lado > 0.05 ? Math.max(1, (lado * CAMPO.meioX - pp.x) / ux - 0.4) : 25, br = pr.barreira;
    // (a barra cheia: a altura NA linha do gol, no voo sem o gol — a mesma conta do chute do jogo, saidaNaLinha)
    el = br && br.n > 0 && D > br.dist + 1 ? elevacaoParaAltura(pp, ux, uz, br.dist, s, BARREIRA.alturaPassar, w)
      : miraCheia(forca) && ux * lado > 0.05 ? elevacaoNaLinha(pp, ux, uz, lado * CAMPO.meioX, s, alturaMiraChute(forca), w)
        : elevacaoParaAltura(pp, ux, uz, D, s, alturaMiraChute(forca), w);
  }
  const ce = MD.cos(el);
  out.v = { x: ux * s * ce, y: s * MD.sin(el), z: uz * s * ce }; out.w = w;
  return out;
}

// a bola (bola.js passoBola) até tocar algo ou o chão, sair ou andar maxDist: x, y, z por tick em pts
export function simularLinha(m, v, w, pts, maxDist = Infinity, max = MIRA.maxPontos) {
  const p0 = m.bola.p, b = criarBola(p0.x, p0.z), ev = [];
  b.p.y = p0.y; Object.assign(b.v, v); Object.assign(b.w, w); b.rolando = !(v.y > 0.01);
  pts[0] = b.p.x; pts[1] = b.p.y; pts[2] = b.p.z;
  let n = 1;
  while (n < max) {
    ev.length = 0; passoBola(b, ev);
    pts[n * 3] = b.p.x; pts[n * 3 + 1] = b.p.y; pts[n * 3 + 2] = b.p.z; n++;
    if (ev.length || b.rolando || Math.abs(b.p.x) > CAMPO.meioX + 0.3 || Math.abs(b.p.z) > CAMPO.meioZ + 0.3 || MD.hypot(b.p.x - p0.x, b.p.z - p0.z) >= maxDist) break;
  }
  return n;
}
