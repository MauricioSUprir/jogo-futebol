// Entrada: zona morta RADIAL (uma diagonal sutil vale, nada trava em 8 direções), módulo
// contínuo na borda da zona morta, teclado normalizado e conversão tela → mundo da câmera de
// TV. No fim, o jogador de verdade anda na diagonal sutil pedida.
// Etapa 3 (Parte 4; plano 2.8): botões que mudam de sentido pela fase (J/K/O e A/B/Y/RB: passe/CONTER,
// chute/DIVIDIDA, nada/PRESSÃO, enfiada/goleiro) com o sentido FIXADO NO APERTO (a posse muda com o
// botão segurado e ele não troca de função no meio); teclas novas sem conflito; CONTER, DIVIDIDA e
// PRESSÃO no arco da defesa sem encostar (≥ 48 px) e o CONTER segurado chegando ao jogo.
//   node tools/teste-entrada.mjs
import { processarAnalogico, teclasParaAnalogico, paraMundo } from '../js/controle.js';
import { criarMundo, passo } from '../js/sim.js';
import { ENTRADA, BOTAO } from '../js/config.js';
import * as ENT from '../js/entrada.js';
import { tabelaTexto, fmt, DEG } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

// direção preservada em todos os ângulos (1° em 1°) e módulos
let piorAng = 0;
for (let a = 0; a < 360; a += 1) {
  for (const r of [0.25, 0.4, 0.7, 1]) {
    const x = Math.cos(a / DEG) * r, y = Math.sin(a / DEG) * r;
    const s = processarAnalogico(x, y);
    if (s.mag === 0) continue;
    const e = Math.abs(((Math.atan2(s.y, s.x) * DEG - a + 540) % 360) - 180);
    piorAng = Math.max(piorAng, e);
  }
}
reg('direção preservada (360 ângulos × 4 inclinações)', `${fmt(piorAng, 4)}°`, '< 0,01°', piorAng < 0.01);
// diagonal sutil de 10°
{
  const s = processarAnalogico(Math.cos(10 / DEG) * 0.5, Math.sin(10 / DEG) * 0.5);
  const a = Math.atan2(s.y, s.x) * DEG;
  reg('diagonal sutil de 10° vale', `${fmt(a, 3)}°`, '10°', Math.abs(a - 10) < 0.01);
}
// zona morta e continuidade
{
  const dentro = processarAnalogico(ENTRADA.zonaMorta * 0.9, 0).mag;
  const borda = processarAnalogico(ENTRADA.zonaMorta + 1e-4, 0).mag;
  const cheio = processarAnalogico(0.99, 0).mag;
  reg('dentro da zona morta = 0', fmt(dentro, 4), '0', dentro === 0);
  reg('módulo contínuo na borda (sem salto)', fmt(borda, 4), '< 0,01', borda < 0.01);
  reg('inclinação máxima = 1', fmt(cheio, 3), '1', cheio === 1);
}
// teclado
{
  const t = teclasParaAnalogico(true, false, false, true);
  reg('teclado na diagonal tem módulo 1', fmt(Math.hypot(t.x, t.y), 4), '1', Math.abs(Math.hypot(t.x, t.y) - 1) < 1e-9);
}
// tela → mundo (câmera de TV na lateral z+ olhando para z−: yaw = −π/2)
{
  const d = paraMundo(1, 0, -Math.PI / 2), c = paraMundo(0, 1, -Math.PI / 2);
  reg('direita na tela = +x no mundo', `(${fmt(d.x)}, ${fmt(d.z)})`, '(1, 0)', Math.abs(d.x - 1) < 1e-9 && Math.abs(d.z) < 1e-9);
  reg('para cima na tela = para longe da câmera (−z)', `(${fmt(c.x)}, ${fmt(c.z)})`, '(0, −1)', Math.abs(c.x) < 1e-9 && Math.abs(c.z + 1) < 1e-9);
}
// o jogador anda na diagonal sutil
{
  const m = criarMundo({ semente: 1, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 40, z: 30 }, posse: null });
  const j = m.jogadores[0];
  const s = processarAnalogico(Math.cos(10 / DEG) * 0.6, Math.sin(10 / DEG) * 0.6);
  for (let i = 0; i < 180; i++) passo(m, { 0: { x: s.x, z: s.y, botoes: 0 } });
  const a = Math.atan2(j.vz, j.vx) * DEG;
  reg('jogador corre na diagonal sutil pedida', `${fmt(a, 2)}°`, '10° ± 0,5°', Math.abs(a - 10) < 0.5);
}
// analógico leve (dedo perto do centro): um limiar só para andar e para virar. Nunca anda no
// rumo ANTIGO (pedido abaixo do limiar de direção) nem de costas/de lado sem virar o tronco.
// Parado de frente para +x, pede 90° e 180° com módulos de 0,03 a 0,3, com e sem bola.
{
  let piores = [], ruins = 0, total = 0;
  for (const comBola of [false, true]) {
    for (const mag of [0.03, 0.05, 0.07, 0.09, 0.15, 0.3]) {
      for (const graus of [90, 180]) {
        const m = criarMundo({ semente: 3, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: comBola ? { x: 0.4, z: 0 } : { x: 40, z: 30 }, posse: comBola ? 0 : null });
        const j = m.jogadores[0];
        for (let i = 0; i < 60; i++) passo(m, { 0: { x: 0.5, z: 0, botoes: 0 } });
        for (let i = 0; i < 90; i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
        const ux = Math.cos(graus / DEG), uz = Math.sin(graus / DEG);
        const x0 = j.x, z0 = j.z;
        for (let i = 0; i < 150; i++) passo(m, { 0: { x: ux * mag, z: uz * mag, botoes: 0 } });
        const dx = j.x - x0, dz = j.z - z0;
        const along = dx * ux + dz * uz, perp = Math.abs(-dx * uz + dz * ux);
        const tronco = Math.abs(((Math.atan2(Math.sin(j.rumo), Math.cos(j.rumo)) - Math.atan2(uz, ux)) * DEG + 540) % 360 - 180);
        const ok = perp <= 0.1 && along >= -0.05 && (along <= 0.1 || tronco <= 45);
        total++;
        if (!ok) { ruins++; piores.push(`${comBola ? 'c/' : 's/'} bola, mag ${mag}, ${graus}°: pedido ${fmt(along)} m, fora ${fmt(perp)} m, tronco ${fmt(tronco, 0)}°`); }
      }
    }
  }
  reg('analógico leve: não anda no rumo antigo nem de costas', `${total - ruins}/${total}`, `${total}/${total}`, ruins === 0);
  for (const p of piores) console.log('  - ' + p);
}
// ------------------------------------------------ Etapa 3: botões da defesa (sentido fixado no aperto)
{
  const { criarSentidoFixo, SENTIDO_FASE, ACOES_TECLA, TECLA_BIT, BOTOES_TOQUE, calcularLayoutToque } = ENT;
  if (typeof criarSentidoFixo !== 'function' || !SENTIDO_FASE) {
    reg('botões da defesa: sentido pela fase, fixado no aperto (entrada.js criarSentidoFixo)', 'não existe', 'existe', false);
  } else {
    const nome = b => Object.keys(BOTAO).filter(k => BOTAO[k] & b).join('+') || 'nada';
    // [botão, no ataque, na defesa]
    const casos = [
      ['KeyJ', BOTAO.PASSE, BOTAO.CONTER], ['KeyK', BOTAO.CHUTE, BOTAO.DIVIDIDA], ['KeyO', 0, BOTAO.PRESSAO],
      ['pad:A', BOTAO.PASSE, BOTAO.CONTER], ['pad:B', BOTAO.CHUTE, BOTAO.DIVIDIDA],
      ['pad:Y', BOTAO.ENFIADA, BOTAO.GOLEIRO], ['pad:RB', 0, BOTAO.PRESSAO],
    ];
    for (const [id, atq, def] of casos) {
      const sf = criarSentidoFixo();
      // apertado no ataque; a posse muda (defesa) com ele segurado; solto; apertado na defesa; volta o ataque
      const a1 = sf.bit(id, true, 'ataque'), a2 = sf.bit(id, true, 'defesa');
      sf.bit(id, false, 'defesa');
      const d1 = sf.bit(id, true, 'defesa'), d2 = sf.bit(id, true, 'ataque');
      sf.bit(id, false, 'ataque');
      const a3 = sf.bit(id, true, 'ataque');
      const ok = a1 === atq && a2 === atq && d1 === def && d2 === def && a3 === atq;
      reg(`${id}: ${nome(atq)} no ataque, ${nome(def)} na defesa, fixado no aperto`,
        `ataque ${nome(a1)}→(vira defesa) ${nome(a2)}; defesa ${nome(d1)}→(vira ataque) ${nome(d2)}; de novo ${nome(a3)}`,
        `${nome(atq)}, ${nome(atq)}; ${nome(def)}, ${nome(def)}; ${nome(atq)}`, ok);
    }
    // teclas novas sem conflito com as ações de um toque nem com os bits fixos
    const teclasFase = Object.keys(SENTIDO_FASE).filter(k => !k.startsWith('pad:'));
    const conflito = teclasFase.filter(k => ACOES_TECLA[k] || TECLA_BIT[k]);
    const defesaTeclado = teclasFase.reduce((b, k) => b | SENTIDO_FASE[k][1], 0);
    const defesaPad = Object.keys(SENTIDO_FASE).filter(k => k.startsWith('pad:')).reduce((b, k) => b | SENTIDO_FASE[k][1], 0);
    const precisa = BOTAO.CONTER | BOTAO.DIVIDIDA | BOTAO.PRESSAO;
    reg('teclas da defesa (J, K, O) sem conflito com R/M/N/C/H/F1/Esc/P/F3 e L/I/Q/G/E/Shift', conflito.length ? conflito.join(', ') : 'nenhum', 'nenhum', conflito.length === 0);
    reg('CONTER, DIVIDIDA e PRESSÃO no teclado e no controle', `teclado ${nome(defesaTeclado & precisa)}; controle ${nome(defesaPad & precisa)}`, 'os três nos dois', (defesaTeclado & precisa) === precisa && (defesaPad & precisa) === precisa);
    // arco do toque na defesa: CONTER (b), DIVIDIDA (c), PRESSÃO (d); nada encosta, nada < 48 px
    const def = BOTOES_TOQUE.filter(b => b.fase === 'defesa' || b.fase === 'ambas');
    const vagaDe = bit => def.find(b => b.bit === bit)?.vaga;
    const vagasDef = def.map(b => b.vaga);
    const repetida = vagasDef.length !== new Set(vagasDef).size;
    reg('toque: CONTER, DIVIDIDA e PRESSÃO nas vagas b, c e d da defesa', `${vagaDe('CONTER')}, ${vagaDe('DIVIDIDA')}, ${vagaDe('PRESSAO')}${repetida ? ' (vaga repetida!)' : ''}`, 'b, c, d', vagaDe('CONTER') === 'b' && vagaDe('DIVIDIDA') === 'c' && vagaDe('PRESSAO') === 'd' && !repetida);
    let pior = Infinity, menor = Infinity, fora = 0;
    for (const [W, H] of [[844, 390], [390, 844], [1280, 720], [667, 375], [1920, 1080]]) {
      for (const tam of [0.7, 1, 1.4]) for (const sa of [{ l: 0, r: 0, t: 0, b: 0 }, { l: 44, r: 44, t: 0, b: 21 }, { l: 0, r: 0, t: 47, b: 34 }]) {
        const pos = calcularLayoutToque(W, H, sa, tam, [...new Set([...vagasDef, 'a', 'b', 'c'])]);
        const ps = Object.values(pos);
        for (let i = 0; i < ps.length; i++) {
          menor = Math.min(menor, ps[i].d);
          if (ps[i].x - ps[i].d / 2 < sa.l || ps[i].x + ps[i].d / 2 > W - sa.r || ps[i].y - ps[i].d / 2 < sa.t || ps[i].y + ps[i].d / 2 > H - sa.b) fora++;
          for (let j = i + 1; j < ps.length; j++) pior = Math.min(pior, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) - (ps[i].d + ps[j].d) / 2);
        }
      }
    }
    reg('toque: arco da defesa com 6 botões sem encostar (5 telas × 3 tamanhos × 3 áreas seguras)', `folga mínima ${fmt(pior, 1)} px, menor botão ${menor} px, fora da tela ${fora}`, 'folga ≥ 4 px, ≥ 48 px, 0 fora', pior >= 4 && menor >= 48 && fora === 0);
    // do aperto ao jogo: J segurado na defesa vira CONTER e o controlado contém o condutor
    {
      const m = criarMundo({
        semente: 7, bola: { x: 9.6, z: 0 }, posse: 1,
        jogadores: [{ id: 0, x: 5, z: 1, rumo: 0, time: 0, papel: 'humano' }, { id: 1, x: 10, z: 0, rumo: Math.PI, time: 1, papel: 'humano' }],
      });
      m.humanos = [0, 1]; m.controlado = { 0: 0, 1: 1 };
      const sf = criarSentidoFixo();
      const j = m.jogadores[0], c = m.jogadores[1];
      let ok = 0, n = 0;
      for (let i = 0; i < 240; i++) {
        passo(m, { 0: { x: 0, z: 0, botoes: sf.bit('KeyJ', true, 'defesa') }, 1: { x: -0.7, z: 0, botoes: 0 } });
        if (i < 60) continue;
        const d = Math.hypot(j.x - c.x, j.z - c.z);
        n++; if (d >= 1 && d <= 2.5 && j.x < c.x) ok++;
      }
      reg('J segurado na defesa = CONTER: o controlado acompanha o condutor do lado do gol', `${fmt(100 * ok / n, 0)}% do tempo a 1–2,5 m`, '≥ 80%', ok / n >= 0.8);
    }
  }
}
console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-entrada: REPROVOU (${falhas})` : '\nteste-entrada: PASSOU');
process.exit(falhas ? 1 : 0);
