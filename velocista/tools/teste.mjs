// Teste de navegador do RELÂMPAGO (mundo aberto): carga da cidade, movimento, colisão, pulo, esfera, dia e noite.
// Uso: node velocista/tools/teste.mjs [pasta-de-prints]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const saida = process.argv[2];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const foto = (p, nome) => saida ? p.screenshot({ path: path.join(saida, nome), timeout: 120000 }) : null;

const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
await pagina.goto(srv.url);
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 120000 });
const carga = await pagina.evaluate(() => window.__rel.carregados.size);
ok(carga >= 49, `cidade carregada antes de começar (${carga} quarteirões)`);
await foto(pagina, 'menu.png');
await pagina.click('#btnJogar');
await pagina.waitForTimeout(500);
ok(await pagina.evaluate(() => window.__rel.J.modo) === 'jogando', 'modo jogando');

// correr para frente
await pagina.evaluate(() => { const R = window.__rel; R.P.x = 0; R.P.z = 0; R.P.y = 0; R.C.yaw = 0; R.teclas.add('w'); });
await pagina.waitForFunction(() => window.__rel.P.z > 6, null, { timeout: 150000 }).catch(() => {});
const m1 = await pagina.evaluate(() => ({ z: window.__rel.P.z, v: Math.hypot(window.__rel.P.vx, window.__rel.P.vz) }));
ok(m1.z > 5 && m1.v > 5, `corre (z=${m1.z.toFixed(1)}, v=${m1.v.toFixed(1)} m/s)`);
await foto(pagina, 'rua.png');

// supervelocidade
await pagina.evaluate(() => { window.__rel.teclas.add('shift'); });
await pagina.waitForFunction(() => Math.hypot(window.__rel.P.vx, window.__rel.P.vz) > 30, null, { timeout: 30000 }).catch(() => {});
const m2 = await pagina.evaluate(() => Math.hypot(window.__rel.P.vx, window.__rel.P.vz));
ok(m2 > 30, `supervelocidade (${(m2 * 3.6).toFixed(0)} km/h)`);
await foto(pagina, 'sprint.png');
await pagina.evaluate(() => { window.__rel.teclas.clear(); });

// colisão: de frente contra o primeiro prédio alto da vizinhança, em supervelocidade
const alvo = await pagina.evaluate(async () => {
  const R = window.__rel, mod = await import('/js/cidade.js');
  const b = mod.bloco(14, 14);
  const l = b.lotes[0] || b.lotes.find(Boolean);
  const lote = l || mod.bloco(...mod.LAB_CELULA).lotes[0];
  return { x: (lote.x0 + lote.x1) / 2, z0: lote.z0, lote };
});
await pagina.evaluate((a) => { const P = window.__rel.P; P.x = a.x; P.z = a.z0 - 30; P.y = 0.3; P.vx = 0; P.vz = 0; window.__rel.C.yaw = 0; window.__rel.teclas.add('w'); window.__rel.teclas.add('shift'); }, alvo);
await pagina.waitForTimeout(2500);
const col = await pagina.evaluate(() => ({ z: window.__rel.P.z, y: window.__rel.P.y }));
ok(col.z < alvo.lote.z0 && col.y < 5, `prédio barra o herói (z=${col.z.toFixed(2)} < ${alvo.lote.z0.toFixed(2)})`);
await foto(pagina, 'colisao.png');
console.log('info', JSON.stringify(await pagina.evaluate(() => ({ chamadas: window.__rel.renderer.info.render.calls, triangulos: window.__rel.renderer.info.render.triangles }))));
await pagina.evaluate(() => window.__rel.teclas.clear());

// corpo realista carregado
await pagina.waitForFunction(() => window.__rel.modelo, null, { timeout: 60000 }).catch(() => {});
ok(await pagina.evaluate(() => !!window.__rel.modelo), 'corpo realista (Rocketbox) carregado');

// escalada: de frente para um prédio de 25–45 m a mais de 130 km/h
const pr = await pagina.evaluate(async () => {
  const mod = await import('/js/cidade.js');
  for (let i = 19; i <= 25; i++) for (let j = 19; j <= 25; j++) { const b = mod.bloco(i, j); for (const l of b.lotes) if (l.y0 === mod.CALCADA && l.y1 > 22 && l.y1 < 40 && l.x1 - l.x0 > 12 && l.z0 - b.cz < -10 && b.tipo !== 'lab') return { x: (l.x0 + l.x1) / 2, zRua: b.cz - 38, lote: l, cz: b.cz }; }
  return null;
});
ok(!!pr, 'achou um prédio de 22–40 m para escalar');
await pagina.evaluate((a) => { const R = window.__rel, P = R.P; P.x = a.x; P.z = a.zRua; P.y = 0.3; P.vx = 0; P.vz = 46; P.energia = 1; R.C.yaw = 0; R.teclas.clear(); R.teclas.add('w'); R.teclas.add('shift'); }, pr);
await pagina.evaluate(() => { window.__rel.subiu = false; const R = window.__rel; const vigia = () => { if (R.P.parede) R.subiu = true; else requestAnimationFrame(vigia); }; vigia(); });
await pagina.waitForFunction(() => window.__rel.subiu, null, { timeout: 60000 }).catch(() => {});
const sobe = await pagina.evaluate(() => ({ p: window.__rel.subiu, y: window.__rel.P.y }));
ok(sobe.p, `escalada começa a mais de 130 km/h (y=${sobe.y.toFixed(1)})`);
await pagina.waitForFunction(() => window.__rel.P.y > 9 || !window.__rel.P.parede, null, { timeout: 60000 }).catch(() => {});
await pagina.waitForTimeout(600);
await foto(pagina, 'escalada.png');
await pagina.waitForFunction((y1) => !window.__rel.P.parede && Math.abs(window.__rel.P.y - y1) < 0.6, pr.lote.y1, { timeout: 120000 }).catch(() => {});
const topo = await pagina.evaluate(() => ({ p: !!window.__rel.P.parede, y: window.__rel.P.y, c: window.__rel.P.noChao }));
ok(!topo.p && topo.c && Math.abs(topo.y - pr.lote.y1) < 0.6, `chega ao telhado (y=${topo.y.toFixed(1)} de ${pr.lote.y1.toFixed(1)})`);
await foto(pagina, 'topo.png');
// devagar não escala: bate e fica no chão
await pagina.evaluate((a) => { const R = window.__rel, P = R.P; P.parede = null; P.x = a.x; P.z = a.zRua; P.y = 0.3; P.vx = 0; P.vz = 14; R.teclas.clear(); R.teclas.add('w'); }, pr);
await pagina.waitForTimeout(2500);
ok(await pagina.evaluate(() => !window.__rel.P.parede && window.__rel.P.y < 2), 'abaixo da velocidade de escalada o prédio só barra');

// vibrar: atravessa o prédio de ponta a ponta
await pagina.evaluate((a) => { const R = window.__rel, P = R.P; P.parede = null; P.x = a.x; P.z = a.zRua; P.y = 0.3; P.vx = 0; P.vz = 30; P.energia = 1; R.C.yaw = 0; R.teclas.clear(); R.teclas.add('w'); R.teclas.add('shift'); R.teclas.add('v'); }, pr);
await pagina.waitForFunction(() => window.__rel.P.vibrando, null, { timeout: 20000 }).catch(() => {});
ok(await pagina.evaluate(() => window.__rel.P.vibrando), 'vibração liga em velocidade');
await pagina.waitForFunction((z1) => window.__rel.P.z > z1 + 1, pr.lote.z1, { timeout: 90000 }).catch(() => {});
const atrav = await pagina.evaluate(() => window.__rel.P.z);
ok(atrav > pr.lote.z1, `atravessou o prédio (z=${atrav.toFixed(1)} > ${pr.lote.z1.toFixed(1)})`);
await foto(pagina, 'vibrando.png');
await pagina.evaluate(() => window.__rel.teclas.clear());
await pagina.waitForTimeout(500);

// pulo e pulo duplo
await pagina.evaluate(() => { const P = window.__rel.P; P.x = 0; P.z = 0; P.y = 0; P.vx = 0; P.vz = 0; });
await pagina.waitForTimeout(300);
await pagina.evaluate(() => { const R = window.__rel; R.teclas.clear(); R.P.vx = R.P.vz = 0; R.P.energia = 1; });
await pagina.waitForFunction(() => window.__rel.P.noChao, null, { timeout: 30000 });
await pagina.keyboard.press('Space');
await pagina.waitForFunction(() => window.__rel.P.pulos === 1 && window.__rel.P.y > 0.3, null, { timeout: 30000 });
const y1 = await pagina.evaluate(() => window.__rel.P.y);
await pagina.keyboard.press('Space');
await pagina.waitForFunction(() => window.__rel.P.pulos === 2, null, { timeout: 30000 }).catch(() => {});
const pul = await pagina.evaluate(() => window.__rel.P.pulos);
ok(y1 > 0.3 && pul === 2, `pulo e pulo duplo (y=${y1.toFixed(2)}, pulos=${pul})`);
await pagina.waitForTimeout(1500);

// esfera: teleporta para a mais próxima
const col2 = await pagina.evaluate(() => {
  const R = window.__rel, o = R.orbesAtivos[0].o; R.P.x = o.x; R.P.z = o.z; R.P.y = Math.max(0, o.y - 0.9); R.P.vy = 0; return R.J.coletadas;
});
await pagina.waitForFunction((n) => window.__rel.J.coletadas > n, col2, { timeout: 60000 }).catch(() => {});
ok(await pagina.evaluate(() => window.__rel.J.coletadas) === col2 + 1, 'coleta uma esfera');

// laboratório: de fora, pela porta até o Cortex, e escalar a parede dele
await pagina.evaluate(() => { const R = window.__rel, P = R.P; R.teclas.clear(); P.parede = null; P.vibrando = false; P.x = -6; P.z = -8; P.y = 0; P.vx = P.vz = 0; R.C.yaw = Math.PI / 4; R.C.pitch = 0.22; R.CAM.dist = 14; R.mundo.T = 0.5; });
await pagina.waitForTimeout(1500);
await foto(pagina, 'lab-fora.png');
await pagina.evaluate(() => { const R = window.__rel; R.CAM.dist = 6.6; });
await pagina.evaluate(() => { const R = window.__rel, P = R.P; P.x = 38; P.z = -4; P.y = 0.3; P.vx = 0; P.vz = 16; R.C.yaw = 0; R.C.pitch = 0.3; R.teclas.add('w'); });
const sala = (nome) => pagina.waitForFunction(async (n) => { const m = await import('/js/cidade.js'); const R = window.__rel; return m.bloco(...m.LAB_CELULA).plano.dentro(R.P.x, R.P.z, R.P.y) === n; }, nome, { timeout: 400000 }).then(() => true).catch(() => false);
ok(await sala('atrio'), 'entra no átrio pela porta');
await foto(pagina, 'lab-atrio.png');
ok(await sala('cortex'), 'chega ao Cortex');
await pagina.waitForFunction(() => window.__rel.missoes.indice >= 1, null, { timeout: 200000 }).catch(() => {});
ok(await pagina.evaluate(() => window.__rel.missoes.indice >= 1), 'missão 1 (chegar ao Cortex) concluída');
// crime: força um assalto, leva o herói até o ladrão e confere que foi impedido
await pagina.evaluate(() => { const R = window.__rel; R.teclas.clear(); R.crimes.atualizar(60, R.P, { forcar: 'assalto' }); });
const crime = await pagina.evaluate(() => { const c = window.__rel.crimes.ativo; return c && { tipo: c.tipo, x: c.x, z: c.z }; });
ok(crime && crime.tipo === 'assalto', `um assalto começa (${crime && Math.round(crime.x)}, ${crime && Math.round(crime.z)})`);
await pagina.evaluate(() => { const R = window.__rel, c = R.crimes.ativo; R.P.x = c.x; R.P.z = c.z; R.P.y = 0; R.P.vx = R.P.vz = 0; });
await pagina.waitForFunction(() => window.__rel.missoes.stats.crimes >= 1, null, { timeout: 60000 }).catch(() => {});
ok(await pagina.evaluate(() => window.__rel.missoes.stats.crimes >= 1 && !window.__rel.crimes.ativo), 'alcançar o ladrão impede o assalto');
await foto(pagina, 'crime.png');
await foto(pagina, 'lab-cortex.png');
await pagina.evaluate(() => window.__rel.teclas.clear());

// dia, entardecer e noite
for (const [nome, T] of [['dia', 0.5], ['tarde', 0.74], ['noite', 0.95]]) {
  await pagina.evaluate((T) => { const R = window.__rel; R.mundo.T = T; R.P.x = 0; R.P.z = 0; R.P.y = 0; R.P.vx = R.P.vz = 0; R.C.yaw = 0.7; R.C.pitch = 0.35; }, T);
  await pagina.waitForTimeout(900);
  await foto(pagina, `${nome}.png`);
}
// streaming: viaja longe e confere que descarrega
await pagina.evaluate(() => { window.__rel.P.x = 700; window.__rel.P.z = -600; });
await pagina.waitForFunction(() => window.__rel.carregados.size > 60, null, { timeout: 60000 }).catch(() => {});
const dep = await pagina.evaluate(() => window.__rel.carregados.size);
ok(dep > 40 && dep <= 100, `streaming mantém ${dep} quarteirões`);
await pagina.keyboard.press('m'); await pagina.waitForTimeout(300); await foto(pagina, 'mapa.png');

ok(erros.length === 0, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
