// Teste dos ajustes do dono de 26/10 no jogo: os raios da corrida (fitas com espessura, sem erro), a ESTEIRA (correndo nela
// o herói fica no lugar, ganha velocidade e os telões mostram), a CONTENÇÃO (os vilões vencidos presos nas celas) e o
// raio no meio da máscara. Uso: node velocista/tools/teste-ajustes.mjs [pasta-de-prints]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), pasta = process.argv[2] || null;
if (pasta) fs.mkdirSync(pasta, { recursive: true });
const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const foto = async (n) => { if (pasta) await pagina.screenshot({ path: path.join(pasta, `${n}.png`), timeout: 600000 }); };
const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
await pagina.evaluate(() => { localStorage.setItem('theflash.viloes.v1', JSON.stringify({ vencidos: ['zoom', 'frio', 'onda', 'mago'] })); });
await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { const R = window.__rel; R.crimes.adiantar(-1e9); R.historia.calarRadio(); R.mundo.T = 0.45; });
// a esteira: em cima dela, segurando CORRER para a frente ao longo da correia
const E = await pagina.evaluate(() => { const R = window.__rel; return { cx: R.LAB_B.cx, cz: R.LAB_B.cz }; });
await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0, energia: 1, h: 0 }); R.C.yaw = 0; R.teclas.add('w'); R.teclas.add('shift'); }, [E.cx - 19.75, E.cz - 2]);
const z0 = E.cz - 2;
ok(await pagina.waitForFunction(() => Math.hypot(window.__rel.P.vx, window.__rel.P.vz) * 3.6 > 150, null, { timeout: 600000 }).then(() => true).catch(() => false), 'na esteira, correndo, a velocidade sobe');
const e1 = await pagina.evaluate(() => ({ z: window.__rel.P.z, kmh: Math.hypot(window.__rel.P.vx, window.__rel.P.vz) * 3.6 }));
ok(Math.abs(e1.z - z0) < 1.5, `e fica no lugar (andou ${Math.abs(e1.z - z0).toFixed(2)} m a ${Math.round(e1.kmh)} km/h)`);
await pagina.evaluate((cz) => { const R = window.__rel; R.C.yaw = Math.PI * 0.75; R.C.pitch = 0.2; }, E.cz);
await quadros(4); await foto('esteira');
await pagina.evaluate(() => { const R = window.__rel; R.teclas.clear(); });
// os raios da corrida: numa rua reta, correndo, sem erro
await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0, energia: 1, h: 0 }); R.C.yaw = 0; R.C.pitch = 0.15; R.teclas.add('w'); R.teclas.add('shift'); }, [E.cx - 600, E.cz + 38]);
await pagina.waitForFunction(() => Math.hypot(window.__rel.P.vx, window.__rel.P.vz) > 40, null, { timeout: 600000 }).catch(() => {});
await quadros(3); await foto('raios');
await pagina.evaluate(() => window.__rel.teclas.clear());
// a contenção: os vencidos nas celas
await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0 }); R.C.yaw = Math.PI / 2; R.C.pitch = 0.1; }, [E.cx + 20, E.cz - 9]);
ok(await pagina.waitForFunction(() => { const p = window.__rel.contencao?.presos; return p && ['zoom', 'frio', 'onda', 'mago'].every((id) => p[id]?.raiz.visible) && !p.reverso?.raiz.visible; }, null, { timeout: 600000 }).then(() => true).catch(() => false), 'na contenção, os 4 vencidos presos (e o Reverso, solto, não)');
await quadros(4); await foto('contencao');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
