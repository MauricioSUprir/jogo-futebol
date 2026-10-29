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
// ±penaltiCanto, longe do ângulo, e a mira alta só somava bola por cima — com a barra cheia, 17% → 42% para fora; e o chute
// SEM a mira no CANTO — decisão do dono, 28/10: "só o chute mirado sobe — com o analógico apontado para um canto, a barra
// cheia vai no ângulo; sem mirar, o chute fica na altura de hoje"): no chute do jogo (acoes.js chute) o analógico solto,
// para o gol ou nas diagonais leves; na cobrança mirada (chuteMirado) a bola subida que cruza a linha do gol fora da faixa
// do canto (no meio do gol, onde a mira começa: alvoPadrao; ou fora da boca). Os dois pela mesma régua, noCanto
export const miraCheia = forca => forca > ACOES.chute.cheia.de;
// A mira no CANTO (C2, 28/10): o z (m do meio do gol) onde ela cruza a linha do gol a ≥ meia-boca − cheia.zCanto (0,9 →
// 2,76 m: a régua do "no ângulo"). A MESMA régua no chute do jogo (o z do analógico antes do limite da boca, acoes.js
// zBrutoAnalogico; a mira dele fica dentro da boca, zMaxMiraChute) e na cobrança mirada (naFaixaDoCanto: o z onde a bola
// SUBIDA, com o efeito, cruza a linha, com o teto na trave: chuteMirado)
export const noCanto = z => Math.abs(z) >= CAMPO.gol.largura / 2 - ACOES.chute.cheia.zCanto;
export const naFaixaDoCanto = z => noCanto(z) && Math.abs(z) <= CAMPO.gol.largura / 2;
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
// passa mais alto. corta(zLo, zHi) (opcional; a cobrança mirada, elevacaoNoCanto): antes de cada passo da busca binária,
// com o z onde as bolas dos dois lados do intervalo cruzam a linha (NaN quando a de baixo cai antes dela); true = desiste
// (devolve NaN). Sem ele, as mesmas contas de sempre
export function elevacaoNaLinha(pp, ux, uz, gx, s, y, w, corta = null) {
  let lo = -0.14, yMelhor = -Infinity, elMelhor = lo, zLo = NaN;
  for (let el = lo; el <= 0.87 + 1e-9; el += 0.08) {
    const r = naLinha(pp, ux, uz, gx, s, el, w);
    if (r.y >= y) {
      let hi = el, zHi = r.z;
      for (let i = 0; i < 20; i++) {
        if (corta && corta(zLo, zHi)) return NaN;
        const m = (lo + hi) / 2, q = naLinha(pp, ux, uz, gx, s, m, w);
        if (q.y < y) { lo = m; zLo = q.caiu ? NaN : q.z; } else { hi = m; zHi = q.z; }
      }
      return (lo + hi) / 2;
    }
    if (r.y > yMelhor) { yMelhor = r.y; elMelhor = el; }
    lo = el; zLo = r.caiu ? NaN : r.z;
  }
  return elMelhor;
}
function naLinha(pp, ux, uz, gx, s, el, w) {
  const ce = MD.cos(el);
  _v.x = ux * s * ce; _v.y = s * MD.sin(el); _v.z = uz * s * ce;
  return passagemLivre(pp, _v, w, gx);
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
const passaNaLinha = (pp, u, el, s, w, gx) => naLinha(pp, u.x, u.z, gx, s, el, w);

// onde a bola cruza a linha do gol: fora da boca (z < −meia-boca: −2; z > meia-boca: 2), na faixa do canto (−1, 1) ou no
// meio (0) — a régua do naFaixaDoCanto
function regiaoNaLinha(z) {
  const mb = CAMPO.gol.largura / 2, zc = mb - ACOES.chute.cheia.zCanto;
  return z < -mb ? -2 : z <= -zc ? -1 : z < zc ? 0 : z <= mb ? 1 : 2;
}
// com a curva, a busca da elevação subida desiste cedo (o custo: a linha é refeita a cada quadro, e fora da faixa a conta de
// antes vem depois): as bolas dos dois lados do intervalo cruzando a linha na mesma região fora da faixa — o z anda junto com a
// elevação (mais alta, mais tempo de voo, mais curva) — a subida cruza ali também. Na faixa, ou com os lados em regiões
// diferentes, a busca vai até o fim e decide o voo da elevação achada
const cortaForaDaFaixa = (zLo, zHi) => zLo === zLo && zHi === zHi && regiaoNaLinha(zLo) === regiaoNaLinha(zHi) && Math.abs(regiaoNaLinha(zHi)) !== 1;

// A barra cheia da cobrança mirada (C2; revisão de 29/10): a elevação da bola SUBIDA — a altura y NA linha do gol no voo sem
// o gol (elevacaoNaLinha, a conta do chute do jogo) com o efeito w (a curva Z/X e o giroFalta), a trajetória que sai
// chutada e que a linha desenha — se ela cruza a linha do gol na faixa do canto, dentro da boca (naFaixaDoCanto); senão
// null (no meio, fora da boca ou caindo antes da linha: a conta de antes). Julgar pela RETA da mira, sem o efeito, errava
// com a curva: a bola cruzava 0,9–2,2 m de lá (no meio do gol a 2,1 m; ou chegava ao ângulo pela curva sem subir). Sem a
// curva (w.y = 0; o giroFalta é (uz, 0, −ux)·g) o arrasto e o Magnus (g·vy·(ux, uz)) ficam no plano vertical da reta: a bola
// cruza a linha no z da reta (bola.js passoNoAr; a ≤ 1e-12 m) e a conta sai sem o voo subido — o caso da mira padrão, que
// fora do canto paga só a conta de antes (a linha é refeita a cada quadro: mira-linha.js)
function elevacaoNoCanto(pp, ux, uz, gx, s, y, w) {
  if (w.y === 0) return naFaixaDoCanto(pp.z + uz * (gx - pp.x) / ux) ? elevacaoNaLinha(pp, ux, uz, gx, s, y, w) : null;
  const el = elevacaoNaLinha(pp, ux, uz, gx, s, y, w, cortaForaDaFaixa);
  if (el !== el) return null;
  const r = naLinha(pp, ux, uz, gx, s, el, w);
  return !r.caiu && naFaixaDoCanto(r.z) ? el : null;
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
    const lado = ladoDe(m, j.time), gx = lado * CAMPO.meioX, D = ux * lado > 0.05 ? Math.max(1, (gx - pp.x) / ux - 0.4) : 25, br = pr.barreira;
    // a barra cheia (C2) só SEM barreira (a de 0 conta como sem), com a mira indo para o gol e a bola SUBIDA (a altura NA
    // linha do gol, com o efeito: elevacaoNoCanto) cruzando a linha do gol na faixa do canto, dentro da boca (revisão de
    // 29/10). Senão, a conta de antes BIT A BIT: com barreira (a elevação que passa por cima dela; com a borda dela além da
    // linha, D ≤ br.dist + 1, a altura de antes), a mira parada no padrão (o meio do gol), as diagonais leves, a curva que
    // leva a bola para o meio ou para fora da boca, e a mira que não vai para o gol (antes, a 33–35 m sem barreira, a mira
    // no meio com a barra cheia cruzava a linha a 2,10 m contra 1,58 m na main; e pela reta da mira, sem o efeito, a curva
    // levava a bola subida ao meio do gol)
    const comBarreira = br && br.n > 0;
    const elCanto = !comBarreira && ux * lado > 0.05 && miraCheia(forca) ? elevacaoNoCanto(pp, ux, uz, gx, s, alturaMiraChute(forca), w) : null;
    el = comBarreira && D > br.dist + 1 ? elevacaoParaAltura(pp, ux, uz, br.dist, s, BARREIRA.alturaPassar, w)
      : elCanto ?? elevacaoParaAltura(pp, ux, uz, D, s, alturaMiraChute(forca, false), w);
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
