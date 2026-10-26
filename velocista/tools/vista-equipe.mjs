// Vista da equipe 3D: os retratos (rosto de frente) e os dois no Cortex virados para o herói.
// Uso: node velocista/tools/vista-equipe.mjs <pasta> [--celular]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
await pagina.goto(srv.url, { timeout: 400000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; localStorage.clear(); document.getElementById('btnJogar').click(); });
const retratos = {};
await pagina.exposeFunction('__ret', (id, url) => { retratos[id] = url; });
await pagina.evaluate(() => { const h = window.__rel.historia, d = h.definirRetrato; h.definirRetrato = (id, url) => { window.__ret(id, url); d(id, url); }; });
await pagina.waitForFunction(() => window.__rel.equipe.pronta, null, { timeout: 400000 });
await pagina.evaluate(() => { const R = window.__rel, l = R.equipe.lugarDoHeroi(); Object.assign(R.P, { x: l.x, y: l.y, z: l.z, h: l.h }); R.C.yaw = l.h; R.mundo.T = 0.45; });
await pagina.waitForTimeout(6000);
for (const [id, url] of Object.entries(retratos)) fs.writeFileSync(path.join(saida, `retrato-${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
// retratos que já tinham saído antes do gancho
const ja = await pagina.evaluate(() => [...document.querySelectorAll('.retrato.foto')].length);
await pagina.screenshot({ path: path.join(saida, `${celular ? 'cel' : 'pc'}-cortex.png`), timeout: 400000 });
console.log('retratos:', Object.keys(retratos).join(', ') || '(nenhum)', ja);
await navegador.close(); await srv.fechar();
