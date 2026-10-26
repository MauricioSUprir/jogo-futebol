// Teste da SUPERVELOCIDADE (js/velocidade.js, puro): segurando CORRER numa reta o teto passa de 300 km/h em ~1 s e chega a
// ~830 km/h; curva fechada, soltar o CORRER ou um vilão em cena derrubam o embalo; no ar o embalo fica; no embalo a corrida
// gasta menos energia. Com --navegador também no jogo: o velocímetro passa de 300 km/h numa rua reta.
// Uso: node velocista/tools/teste-velocidade.mjs [--navegador]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const V = await import(pathToFileURL(path.join(AQUI, '../js/velocidade.js')).href);
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const kmh = (ms) => Math.round(ms * 3.6);
const reta = { correndo: true, noChao: true, m: 1, angulo: 0.05 };
const rodar = (e, ctx, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) e = V.passoEmbalo(e, ctx, dt); return e; };

ok(kmh(V.tetoCorrida(0)) === 209, `sem embalo, o teto continua o de antes: ${kmh(V.tetoCorrida(0))} km/h`);
let t300 = null; { let e = 0; for (let t = 0; t < 6; t += 1 / 60) { e = V.passoEmbalo(e, reta, 1 / 60); if (t300 === null && V.tetoCorrida(e) * 3.6 > 300) t300 = t; } }
ok(t300 !== null && t300 < 1.5, `na reta, passa de 300 km/h em ${t300?.toFixed(2)} s`);
const cheio = rodar(0, reta, 3.2);
ok(cheio === 1 && kmh(V.tetoCorrida(cheio)) >= 800, `na reta, em ~3 s chega a ${kmh(V.tetoCorrida(cheio))} km/h`);
ok(kmh(V.tetoCorrida(rodar(1, { ...reta, angulo: 1.2 }, 0.4))) < 300, `curva fechada (70°) derruba o embalo em 0,4 s (${kmh(V.tetoCorrida(rodar(1, { ...reta, angulo: 1.2 }, 0.4)))} km/h)`);
ok(rodar(1, { ...reta, angulo: 0.3 }, 1) === 1, 'curva aberta (17°) mantém o embalo');
ok(rodar(1, { ...reta, correndo: false }, 1) === 0, 'soltar o CORRER: o embalo zera em ~0,7 s');
ok(rodar(0, { ...reta, bloqueado: true }, 3) === 0, 'com um vilão em cena o embalo não sobe (perseguições justas)');
ok(rodar(0.7, { ...reta, noChao: false }, 0.5) === 0.7, 'no ar (pulando um carro) o embalo fica');
ok(V.gastoCorrida(0) === 1 && V.gastoCorrida(1) < 0.5, `no embalo cheio a corrida gasta ${Math.round(V.gastoCorrida(1) * 100)}% da energia`);

if (process.argv.includes('--navegador')) {
  const cid = await import(pathToFileURL(path.join(AQUI, '../js/cidade.js')).href);
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  // uma rua reta no sentido +z, longe do laboratório
  const x = cid.centroDe(8) + cid.CELL / 2, z = cid.centroDe(4);
  await pagina.evaluate(([x, z]) => { const R = window.__rel; R.crimes.adiantar(-1e9); Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0, energia: 1 }); R.C.yaw = 0; R.teclas.add('w'); R.teclas.add('shift'); }, [x, z]);
  const passou = await pagina.waitForFunction(() => Number(document.getElementById('vel')?.textContent || 0) > 300, null, { timeout: 900000 }).then(() => true).catch(() => false);
  const v = await pagina.evaluate(() => Number(document.getElementById('vel')?.textContent || 0));
  ok(passou, `no jogo, numa rua reta segurando CORRER, o velocímetro passa de 300 km/h (${v})`);
  // o Flash não voa (dono, 26/10): PULAR segurado no ar não plana, e no ar ele não ganha velocidade
  const noAr = (ini) => pagina.evaluate(([x, z, ini]) => new Promise((fim) => {
    const R = window.__rel; R.teclas.clear(); for (const k of ini.teclas) R.teclas.add(k);
    Object.assign(R.P, { x, z, y: ini.y, vx: 0, vz: 0, vy: ini.vy, noChao: false, pulos: 1, embalo: 0, parede: null, vSolo: 0 });
    const t0 = R.P.t, y0 = R.P.y, f = () => (R.P.t - t0 >= ini.t || R.P.noChao ? fim({ caiu: y0 - R.P.y, t: R.P.t - t0, v: Math.hypot(R.P.vx, R.P.vz), chao: R.P.noChao }) : requestAnimationFrame(f)); requestAnimationFrame(f);
  }), [x, z, ini]);
  const q = await noAr({ y: 60, vy: 0, t: 1.5, teclas: [' '] });
  ok(q.caiu > 25 || q.chao, `segurando PULAR no ar ele cai (${q.caiu.toFixed(1)} m em ${q.t.toFixed(2)} s; planando seriam ~10 m)`);
  const a = await noAr({ y: 0.4, vy: 16, t: 0.6, teclas: ['w', 'shift'] });
  ok(a.v <= 16, `pulando parado e segurando CORRER, no ar ele não acelera (${a.v.toFixed(1)} m/s)`);
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
