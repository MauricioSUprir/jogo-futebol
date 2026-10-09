// Física da bola contra os alvos da PESQUISA §1.4 (mesmos casos e faixas da tabela), rolagem com
// teto (Pfaff 2022), a conta do planejador (velParaDistancia, velParaChegarCom) batendo com a
// integração 3D, e colisão contínua com traves, travessão, rede e placas (nada atravessa, a bola
// parada do lado de fora fica onde está).
//   node tools/teste-bola.mjs
import {
  criarBola, passoBola, chutar, chutarRasteiro, copiarBola, velParaDistancia, velParaChegarCom, distAteParar, CONST_BOLA,
} from '../js/bola.js';
import { PASSO, CAMPO, BOLA } from '../js/config.js';
import { criarTreino, passoTreino } from '../js/sessao.js';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const pendentes = [];
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
/** Alvo da PESQUISA que a física, com as constantes da própria PESQUISA, não alcança: aparece na
 *  tabela com o número medido e fica listado no fim, mas não bloqueia (decisão do dono). */
function pend(nome, medido, meta, ok, porque) {
  linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'FORA DO ALVO (pendente)']);
  if (!ok) pendentes.push(`${nome}: ${medido} (meta ${meta}) — ${porque}`);
}

const R = BOLA.raio, X = CAMPO.meioX, G = CAMPO.gol;
const ZL = G.largura / 2, ZP = ZL + G.raioPoste, YT = G.altura + G.raioPoste, FUNDO = X + G.profundidade;
const PZ = CAMPO.meioZ + CAMPO.entorno;
const RAD = Math.PI / 180;
const vel3 = b => Math.hypot(b.v.x, b.v.y, b.v.z);

// ------------------------------------------------------------------ alvos da PESQUISA §1.4

// 1) quique vertical: queda de 2,00 m (base da bola) → 1º rebote entre 0,60 e 0,85 m (FIFA)
{
  const b = criarBola(0, 0); b.p.y = 2 + R; b.rolando = false;
  let subiu = false, pico = 0;
  for (let i = 0; i < 400; i++) {
    const vyAnt = b.v.y;
    passoBola(b, []);
    if (vyAnt < 0 && b.v.y > 0) subiu = true;
    if (subiu) { pico = Math.max(pico, b.p.y); if (b.v.y < 0) break; }
  }
  reg('quique — queda de 2,00 m, 1º rebote', `${fmt(pico - R, 3)} m`, '0,60–0,85 m', pico - R >= 0.6 && pico - R <= 0.85);
}
// 2) quique oblíquo: 13,9 m/s a 25°, sem giro → sai com 45–60% da velocidade (FIFA, seco)
{
  const b = criarBola(0, 0); b.rolando = false;
  chutar(b, { x: 13.9 * Math.cos(25 * RAD), y: -13.9 * Math.sin(25 * RAD), z: 0 }, { x: 0, y: 0, z: 0 });
  let ret = NaN;
  for (let i = 0; i < 60; i++) {
    const vAntes = vel3(b), ev = [];
    passoBola(b, ev);
    if (ev.some(e => e.tipo === 'quique')) { ret = vel3(b) / vAntes; break; }
  }
  reg('quique oblíquo 13,9 m/s a 25° — velocidade que sobra', `${fmt(ret * 100, 1)}%`, '45–60%', ret >= 0.45 && ret <= 0.6);
}
// 3) rolagem (FIFA; Gabrielsen 2004): de 3,2 m/s para em 4–10 m; de 2,5 m/s perde 0,55 ± 0,05 m/s no 1º metro
{
  const d = distAteParar(3.2);
  reg('rolagem — saindo a 3,2 m/s, para em', `${fmt(d)} m`, '4–10 m', d >= 4 && d <= 10);
  const b = criarBola(0, 0); chutarRasteiro(b, 2.5, 0);
  let xAnt = 0, sAnt = 2.5, s1 = NaN;
  for (let i = 0; i < 600; i++) {
    passoBola(b, []);
    if (b.p.x >= 1) { s1 = sAnt + (b.v.x - sAnt) * (1 - xAnt) / (b.p.x - xAnt); break; }
    xAnt = b.p.x; sAnt = b.v.x;
  }
  reg('rolagem — saindo a 2,5 m/s, perda no 1º metro', `${fmt(2.5 - s1, 3)} m/s`, '0,50–0,60 m/s', 2.5 - s1 >= 0.5 && 2.5 - s1 <= 0.6);
}
// 4) alcance a 25°, sem giro, saindo do chão (Asai & Seo 2013): 17 m/s → 17,5–19,5 m; 28 m/s → 44,1–47,1 m
{
  const alcance = (v0) => {
    const b = criarBola(0, 0); b.rolando = false;
    chutar(b, { x: v0 * Math.cos(25 * RAD), y: v0 * Math.sin(25 * RAD), z: 0 }, { x: 0, y: 0, z: 0 });
    for (let i = 0; i < 600; i++) {
      const c = copiarBola(b), ev = [];
      passoBola(b, ev);
      // pouso interpolado em y = R a partir do estado antes do passo do quique
      if (ev.some(e => e.tipo === 'quique') || b.rolando) return c.p.x + c.v.x * (c.p.y - R) / Math.max(-c.v.y, 1e-9);
    }
    return NaN;
  };
  const a17 = alcance(17), a28 = alcance(28);
  reg('alcance a 25° saindo a 17 m/s', `${fmt(a17)} m`, '17,5–19,5 m', a17 >= 17.5 && a17 <= 19.5);
  reg('alcance a 25° saindo a 28 m/s', `${fmt(a28)} m`, '44,1–47,1 m', a28 >= 44.1 && a28 <= 47.1);
}
// 5) chute reto de 30 m/s, sem giro, até 25 m (Passmore 2012): chega em 0,94–1,00 s, a 22–25 m/s
{
  const b = criarBola(0, 0); b.rolando = false;
  chutar(b, { x: 30 * Math.cos(11 * RAD), y: 30 * Math.sin(11 * RAD), z: 0 }, { x: 0, y: 0, z: 0 });
  let xAnt = 0, sAnt = 30, t = NaN, s = NaN, quicou = false;
  for (let i = 0; i < 600; i++) {
    const ev = [];
    passoBola(b, ev);
    if (ev.some(e => e.tipo === 'quique')) quicou = true;
    const sv = vel3(b);
    if (b.p.x >= 25) { const fr = (25 - xAnt) / (b.p.x - xAnt); t = (i + fr) * PASSO; s = sAnt + (sv - sAnt) * fr; break; }
    xAnt = b.p.x; sAnt = sv;
  }
  reg('chute reto de 30 m/s — tempo até 25 m', `${fmt(t, 3)} s${quicou ? ' (quicou)' : ''}`, '0,94–1,00 s, sem quicar', !quicou && t >= 0.94 && t <= 1.0);
  reg('chute reto de 30 m/s — velocidade aos 25 m', `${fmt(s)} m/s`, '22–25 m/s', s >= 22 && s <= 25);
}
// 6) giro (Tsukada & Sakurai 2008): 25 m/s com 8 rps → aos 18 m, 6,8–7,6 rps e eixo < 2° de desvio
{
  const b = criarBola(0, 0); b.rolando = false;
  const w0 = { x: 0.3, y: 1, z: 0.2 }, n0 = Math.hypot(w0.x, w0.y, w0.z), W = 8 * 2 * Math.PI;
  chutar(b, { x: 25 * Math.cos(12 * RAD), y: 25 * Math.sin(12 * RAD), z: 0 }, { x: w0.x / n0 * W, y: w0.y / n0 * W, z: w0.z / n0 * W });
  let i = 0;
  while (i < 600 && Math.hypot(b.p.x, b.p.z) < 18) { passoBola(b, []); i++; }
  const wm = Math.hypot(b.w.x, b.w.y, b.w.z);
  const cosEixo = (b.w.x * w0.x + b.w.y * w0.y + b.w.z * w0.z) / (wm * n0);
  const eixo = Math.acos(Math.min(1, cosEixo)) / RAD;
  reg('giro — 25 m/s com 8 rps, aos 18 m', `${fmt(wm / (2 * Math.PI))} rps, eixo ${fmt(eixo, 3)}°`, '6,8–7,6 rps; eixo < 2°', wm / (2 * Math.PI) >= 6.8 && wm / (2 * Math.PI) <= 7.6 && eixo < 2);
}
// 7) falta com curva (Goff & Carré 2009): 36 m/s, 63 rad/s de eixo vertical, alvo a 27 m. Elevação
// escolhida para a bola chegar aos 27 m a ~2 m de altura (cai no ângulo, por baixo do travessão).
{
  const voo = (elev) => {
    const b = criarBola(0, 0); b.rolando = false;
    chutar(b, { x: 36 * Math.cos(elev * RAD), y: 36 * Math.sin(elev * RAD), z: 0 }, { x: 0, y: 63, z: 0 });
    let i = 0;
    while (i < 600 && Math.hypot(b.p.x, b.p.z) < 27) { passoBola(b, []); i++; }
    return b;
  };
  let melhor = null, elevM = 0;
  for (let e = 6; e <= 20; e += 0.25) { const b = voo(e); if (!melhor || Math.abs(b.p.y - 2) < Math.abs(melhor.p.y - 2)) { melhor = b; elevM = e; } }
  const curva = -melhor.p.z, s = vel3(melhor);
  reg('falta com curva (36 m/s, 63 rad/s) — curva lateral aos 27 m', `${fmt(curva)} m (elevação ${fmt(elevM, 2)}°, altura ${fmt(melhor.p.y)} m)`, '2,5–3,5 m', curva >= 2.5 && curva <= 3.5);
  pend('falta com curva (36 m/s, 63 rad/s) — velocidade aos 27 m', `${fmt(s)} m/s`, '17–21 m/s', s >= 17 && s <= 21,
    'com o C_D da §1.1 (0,18 + acréscimo de giro +0,10/+0,13, ponta de cima) a bola chega a ~24 m/s; ' +
    'chegar a 19 m/s pede C_D médio ~0,44 (acréscimo de giro ~+0,20–0,25), o dobro da faixa medida em túnel');
}

// ------------------------------------------------------------------ rolagem com teto (Pfaff 2022)

// 8) passe rasteiro de referência: saída a 16,2 m/s, perda média de 7,93 m/s² (± 20%) até ~8 m/s
{
  const b = criarBola(0, 0); chutarRasteiro(b, 16.2, 0);
  let sAnt = 16.2, t8 = NaN;
  for (let i = 0; i < 600; i++) {
    passoBola(b, []);
    if (b.v.x <= 8) { t8 = (i + (sAnt - 8) / (sAnt - b.v.x)) * PASSO; break; }
    sAnt = b.v.x;
  }
  const a = (16.2 - 8) / t8;
  reg('passe rasteiro a 16,2 m/s — perda média até 8 m/s', `${fmt(a)} m/s²`, '7,93 ± 20% (6,34–9,52)', a >= 6.34 && a <= 9.52);
}
// 9) sanidade: rasteira a 25 m/s chega aos 30 m com pelo menos 8 m/s
{
  const b = criarBola(0, 0); chutarRasteiro(b, 25, 0);
  let xAnt = 0, sAnt = 25, s30 = 0;
  for (let i = 0; i < 900; i++) {
    passoBola(b, []);
    if (b.p.x >= 30) { s30 = sAnt + (b.v.x - sAnt) * (30 - xAnt) / (b.p.x - xAnt); break; }
    if (b.v.x === 0) break;
    xAnt = b.p.x; sAnt = b.v.x;
  }
  reg('rasteira a 25 m/s — velocidade aos 30 m', `${fmt(s30)} m/s`, '≥ 8 m/s', s30 >= 8);
}

// ------------------------------------------------------------------ planejador = integração

// 10) velParaDistancia(d, n) leva a bola exatamente a d em n passos (inclui passes longos)
{
  let pior = 0;
  for (const [d, n] of [[1.2, 30], [2.4, 43], [4.0, 30], [0.6, 60], [3.3, 96], [12, 40], [25, 60], [30, 70]]) {
    const v = velParaDistancia(d, n);
    const b = criarBola(0, 0);
    chutarRasteiro(b, v * 0.6, v * 0.8);
    for (let i = 0; i < n; i++) passoBola(b, []);
    pior = Math.max(pior, Math.abs(Math.hypot(b.p.x, b.p.z) - d));
  }
  reg('toque planejado chega ao ponto (pior erro)', `${fmt(pior * 1000, 3)} mm`, '< 1 mm', pior < 1e-3);
}
// 11) velParaChegarCom(dist, v): a bola chega com a velocidade pedida (2–30 m, 3–15 m/s)
{
  const chegada = (v0, dist) => {
    const b = criarBola(0, 0); chutarRasteiro(b, v0 * 0.6, v0 * 0.8);
    let dAnt = 0, sAnt = v0;
    for (let i = 0; i < 6000; i++) {
      passoBola(b, []);
      const d = Math.hypot(b.p.x, b.p.z), s = Math.hypot(b.v.x, b.v.z);
      if (d >= dist) return sAnt + (s - sAnt) * (dist - dAnt) / (d - dAnt);
      if (s === 0) return 0;
      dAnt = d; sAnt = s;
    }
    return 0;
  };
  let pior = 0, caso = '';
  for (let dist = 2; dist <= 30; dist += 1.5) {
    for (let vc = 3; vc <= 15; vc++) {
      const v0 = velParaChegarCom(dist, vc), e = Math.abs(chegada(v0, dist) - vc) / vc;
      if (e > pior) { pior = e; caso = `${fmt(dist, 1)} m a ${vc} m/s`; }
    }
  }
  // a diferença que sobra é de amostragem: a medida interpola entre ticks; a conta usa o subpasso
  reg('passe com velocidade de chegada — pior erro (2–30 m, 3–15 m/s)', `${fmt(pior * 100, 2)}% (${caso})`, '≤ 1%', pior <= 0.01);
  const v0 = velParaChegarCom(19.5, 6), s = chegada(v0, 19.5);
  reg('passe de 19,5 m pedindo chegada a 6 m/s', `sai ${fmt(v0)} m/s, chega ${fmt(s)} m/s`, '5,94–6,06 m/s', Math.abs(s - 6) <= 0.06);
}

// ------------------------------------------------------------------ rolando sem derrapar

// 12) rolando: o giro é de rolamento puro
{
  const b = criarBola(0, 0);
  chutarRasteiro(b, 5, 2);
  for (let i = 0; i < 30; i++) passoBola(b, []);
  const vcx = b.v.x + CONST_BOLA.R * b.w.z, vcz = b.v.z - CONST_BOLA.R * b.w.x;
  reg('rolando — ponto de contato parado (sem derrapar)', `${fmt(Math.hypot(vcx, vcz), 6)} m/s`, '< 1e-6', Math.hypot(vcx, vcz) < 1e-6);
}

// ------------------------------------------------------------------ traves, travessão e rede

// 13) trave: bola rasteira no poste volta
{
  const b = criarBola(X - 4, ZP);
  b.p.y = 0.5; b.rolando = false;
  chutar(b, { x: 15, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
  const ev = [];
  for (let i = 0; i < 40; i++) passoBola(b, ev);
  reg('trave — bola bate no poste e volta', `${ev.filter(e => e.tipo === 'trave').length} batida(s), vx ${fmt(b.v.x)}`, 'bate e vx < 0', ev.some(e => e.tipo === 'trave') && b.v.x < 0);
}
// 14) poste e travessão em qualquer velocidade (15–40 m/s), de frente e oblíquo, 50 fases do subpasso
{
  let tot = 0, semTrave = 0, passou = 0;
  for (const v of [15, 20, 22, 25, 30, 35, 40]) {
    for (const ang of [0, 20, 40]) {
      for (let k = 0; k < 50; k++) {
        const off = (k % 5 - 2) * 0.03, dist = 2 + (k / 50) * (v / 120);
        const b = criarBola(X - dist * Math.cos(ang * RAD), ZP + off - dist * Math.sin(ang * RAD));
        chutarRasteiro(b, v * Math.cos(ang * RAD), v * Math.sin(ang * RAD));
        const ev = [];
        let xmax = -1e9;
        for (let i = 0; i < 20; i++) { passoBola(b, ev); xmax = Math.max(xmax, b.p.x); }
        tot++;
        if (!ev.some(e => e.tipo === 'trave')) semTrave++;
        if (xmax > X + 0.2) passou++;
      }
    }
    for (let k = 0; k < 50; k++) {
      const off = (k % 5 - 2) * 0.03, dist = 2 + (k / 50) * (v / 120);
      const b = criarBola(X - dist, 0.5); b.p.y = YT + off; b.rolando = false;
      chutar(b, { x: v, y: 9.81 * (dist / v) / 2, z: 0 }, { x: 0, y: 0, z: 0 });
      const ev = [];
      let xmax = -1e9;
      for (let i = 0; i < 20; i++) { passoBola(b, ev); xmax = Math.max(xmax, b.p.x); }
      tot++;
      if (!ev.some(e => e.tipo === 'trave')) semTrave++;
      if (xmax > X + 0.2) passou++;
    }
  }
  reg('poste e travessão a 15–40 m/s — bola atravessa', `${passou}/${tot} atravessaram, ${semTrave} sem 'trave'`, '0 e 0', passou === 0 && semTrave === 0);
}
// 15) rede: chute forte no meio do gol fica dentro
{
  const b = criarBola(X - 11, 0); b.p.y = 0.8; b.rolando = false;
  chutar(b, { x: 28, y: 2, z: 1 }, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 240; i++) passoBola(b, []);
  const dentro = b.p.x > X && b.p.x < FUNDO + 0.01 && Math.abs(b.p.z) < ZL;
  reg('rede — chute forte fica dentro do gol', `x ${fmt(b.p.x)} z ${fmt(b.p.z)}`, 'dentro da rede', dentro);
}
// 16) rede lateral e teto não deixam a bola passar, por fora nem por dentro (10–30 m/s, 50 fases)
{
  const dentroGol = b => b.p.x > X && b.p.x < FUNDO && Math.abs(b.p.z) < ZL && b.p.y < G.altura;
  let entrou = 0, saiu = 0, entrouTeto = 0, saiuTeto = 0, n = 0;
  for (const v of [10, 14, 16, 20, 25, 30]) {
    for (let k = 0; k < 50; k++) {
      n++;
      const xk = X + 0.3 + (k % 10) * 0.17, fase = k * (v / 120 / 50);
      const a = criarBola(xk, ZL + 1.5 + fase); chutarRasteiro(a, 0, -v);
      const c = criarBola(xk, 1.0 + fase); chutarRasteiro(c, 0, v);
      const t = criarBola(X + 1, (k % 10 - 5) * 0.5); t.p.y = G.altura + 0.4 + fase; t.rolando = false;
      chutar(t, { x: 0, y: -v, z: 0 }, { x: 0, y: 0, z: 0 });
      const u = criarBola(X + 1, (k % 10 - 5) * 0.5); u.p.y = 0.5 + fase; u.rolando = false;
      chutar(u, { x: 0, y: v, z: 0 }, { x: 0, y: 0, z: 0 });
      let fa = false, fc = false, ft = false, fu = false;
      for (let i = 0; i < 40; i++) {
        passoBola(a, []); passoBola(c, []); passoBola(t, []); passoBola(u, []);
        if (dentroGol(a)) fa = true;
        if (Math.abs(c.p.z) > ZL) fc = true;
        if (dentroGol(t)) ft = true;
        if (u.p.y > G.altura && Math.abs(u.p.z) < ZL) fu = true;
      }
      entrou += fa; saiu += fc; entrouTeto += ft; saiuTeto += fu;
    }
  }
  reg('rede lateral e teto a 10–30 m/s — atravessou (fora→dentro / dentro→fora)',
    `lateral ${entrou}/${saiu}, teto ${entrouTeto}/${saiuTeto} em ${n} cada`, '0', entrou + saiu + entrouTeto + saiuTeto === 0);
}
// 17) bola atrás do gol fica atrás do gol: parada, rolando paralela à linha e vindo para o campo
{
  let desl = 0, eventos = 0;
  for (const x of [54.7, 55.5, 57, 58.3]) {
    const b = criarBola(x, 0.5), ev = [];
    for (let i = 0; i < 60; i++) passoBola(b, ev);
    desl = Math.max(desl, Math.hypot(b.p.x - x, b.p.z - 0.5));
    eventos += ev.length;
  }
  reg('bola parada atrás do gol (x 54,7–58,3) — deslocamento em 1 s', `${fmt(desl * 1000, 3)} mm, ${eventos} evento(s)`, '0 mm, nenhum evento', desl < 1e-9 && eventos === 0);
  let dev = 0;
  for (const x of [54.7, 55.5, 57]) {
    const b = criarBola(x, -6); chutarRasteiro(b, 0, 8);
    for (let i = 0; i < 120; i++) { passoBola(b, []); dev = Math.max(dev, Math.abs(b.p.x - x)); }
  }
  reg('bola rolando atrás do gol, paralela à linha — desvio em x', `${fmt(dev * 1000, 3)} mm`, '0 mm', dev < 1e-9);
  let atravessou = 0, tot = 0;
  for (const v of [3, 6, 15, 30]) {
    for (let k = 0; k < 20; k++) {
      const b = criarBola(57 + k * 0.013, 0.3); chutarRasteiro(b, -v, 0);
      let passou = false;
      for (let i = 0; i < 120; i++) { passoBola(b, []); if (b.p.x < FUNDO + R - 1e-9) passou = true; }
      tot++; if (passou) atravessou++;
    }
  }
  reg('bola de trás do gol rolando para o campo (3–30 m/s) — atravessa a rede de fundo', `${atravessou}/${tot}`, '0', atravessou === 0);
}
// 18) treino: jogador parado atrás do gol não gera "Gol!" (antes: um por segundo)
{
  const m = criarTreino({ modo: 'conducao', semente: 1, x: 56.5, z: 0.5, rumo: 0 });
  let gols = 0;
  for (let i = 0; i < 240; i++) gols += passoTreino(m, { x: 0, z: 0, botoes: 0 }).filter(e => e.tipo === 'gol').length;
  const a = criarTreino({ modo: 'ataque', semente: 1 });
  a.posse = null; Object.assign(a.bola, criarBola(56, 0.5));
  let golsA = 0;
  for (let i = 0; i < 60; i++) golsA += passoTreino(a, { x: 0, z: 0, botoes: 0 }).filter(e => e.tipo === 'gol').length;
  reg("treino — bola atrás do gol: eventos 'gol' (condução 4 s / ataque 1 s)", `${gols} / ${golsA}`, '0 / 0', gols === 0 && golsA === 0);
}
// 19) placa: a bola que passou por cima (ou foi posta além dela) fica lá fora; de dentro, bate e volta
{
  const b = criarBola(0, PZ - 3); b.p.y = 1.5; b.rolando = false;
  chutar(b, { x: 0, y: 3, z: 8 }, { x: 0, y: 0, z: 0 });
  let zAnt = b.p.z, salto = 0;
  for (let i = 0; i < 120; i++) { passoBola(b, []); salto = Math.max(salto, zAnt - b.p.z); zAnt = b.p.z; }
  const c = criarBola(0, PZ + 0.73); chutarRasteiro(c, 0, 3);
  let za = c.p.z, salto2 = 0;
  for (let i = 0; i < 60; i++) { passoBola(c, []); salto2 = Math.max(salto2, za - c.p.z); za = c.p.z; }
  reg('placa — bola por cima / posta do lado de fora: maior salto para dentro', `${fmt(salto, 3)} m / ${fmt(salto2, 3)} m`, '0 m', salto === 0 && salto2 === 0);
  const d = criarBola(0, PZ - 2); chutarRasteiro(d, 0, 6);
  const ev = [];
  for (let i = 0; i < 60; i++) passoBola(d, ev);
  reg('placa — rasteira de dentro bate e volta', `${ev.filter(e => e.tipo === 'placa').length} batida(s), vz ${fmt(d.v.z)}`, '1 batida, vz < 0', ev.filter(e => e.tipo === 'placa').length === 1 && d.v.z < 0 && d.p.z <= PZ - R);
}

// ------------------------------------------------------------------ determinismo

// 20) determinismo da bola (inclui giro, rede e trave)
{
  const rodar = () => {
    const b = criarBola(0, 0); b.p.y = 1; b.rolando = false;
    chutar(b, { x: 20, y: 6, z: 3 }, { x: 5, y: 20, z: -3 });
    for (let i = 0; i < 300; i++) passoBola(b, []);
    const c = criarBola(X - 3, ZP - 0.05); chutarRasteiro(c, 30, 0);
    for (let i = 0; i < 120; i++) passoBola(c, []);
    return [b.p.x, b.p.y, b.p.z, b.q.w, c.p.x, c.p.z, c.v.x].join(',');
  };
  reg('determinismo — mesmas condições, mesma bola', rodar() === rodar() ? 'igual' : 'diferente', 'igual', rodar() === rodar());
}

console.log(tabelaTexto(linhas));
if (pendentes.length) {
  console.log('\nAlvos da PESQUISA fora do alcance (não bloqueiam; decisão do dono):');
  for (const p of pendentes) console.log(`  - ${p}`);
}
console.log(falhas ? `\nteste-bola: REPROVOU (${falhas})` : `\nteste-bola: PASSOU${pendentes.length ? ` (${pendentes.length} pendente)` : ''}`);
process.exit(falhas ? 1 : 0);
