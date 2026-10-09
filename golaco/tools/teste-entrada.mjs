// Entrada: zona morta RADIAL (uma diagonal sutil vale, nada trava em 8 direções), módulo
// contínuo na borda da zona morta, teclado normalizado e conversão tela → mundo da câmera de
// TV. No fim, o jogador de verdade anda na diagonal sutil pedida.
//   node tools/teste-entrada.mjs
import { processarAnalogico, teclasParaAnalogico, paraMundo } from '../js/controle.js';
import { criarMundo, passo } from '../js/sim.js';
import { ENTRADA } from '../js/config.js';
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
console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-entrada: REPROVOU (${falhas})` : '\nteste-entrada: PASSOU');
process.exit(falhas ? 1 : 0);
