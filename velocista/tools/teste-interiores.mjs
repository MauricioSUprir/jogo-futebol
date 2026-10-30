// Teste dos INTERIORES dos lugares (js/interiores.js): a porta de fora é alcançável pela calçada, a sala de dentro é fechada
// (piso, teto, paredes) e tudo nela é alcançável a pé (pontos da história e a porta de saída), os pontos de dentro ficam na
// altura do interior e o herói volta à calçada fora do gatilho. Com --navegador: no jogo, encostar na porta leva para dentro
// (a sala aparece, sem erros) e a porta de dentro devolve para a rua — nos 4 lugares, com prints.
// Uso: node velocista/tools/teste-interiores.mjs [--navegador [pasta-de-prints]]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const I = await imp('interiores.js'), cid = await imp('cidade.js'), M = await imp('marcos.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// por onde passar até os pontos atrás de portas e entre mesas (coordenadas locais da sala)
const VIA = { editor: [[9.4, 1.6], [9.4, 4.6], [13.2, 5.0], [13.2, 8.5]], redacao: [[0, 0]], mesaJoe: [[-11.5, 2.6], [-11.5, 5], [-13.7, 6], [-13.7, 9.2]], csi: [[2, 0], [6, 0], [9.5, 2.6]],
  portaCsi: [[2, 0]], cantoCsi: [[2, 0], [6, 0], [9.5, 2.6]] };
function anda(R, x, z, y, ax, az, passo = 0.15) {
  let i = 0;
  while (Math.hypot(ax - x, az - z) > 0.3 && i++ < 3000) {
    const d = Math.hypot(ax - x, az - z), s = Math.min(passo, d);
    let nx = x + ((ax - x) / d) * s, nz = z + ((az - z) / d) * s;
    const r = cid.empurrar(R, nx, nz, 0.45, y, 1.8); nx = r.x; nz = r.z;
    if (Math.hypot(nx - x, nz - z) < 1e-4) break;
    x = nx; z = nz; y = cid.chaoEm(R, x, z, y);
  }
  return { x, z, y, chegou: Math.hypot(ax - x, az - z) <= 0.5 };
}
for (const id of I.IDS_INTERIOR) {
  const m = M.MARCOS.find((k) => k.id === id), cx = cid.centroDe(m.cel[0]), cz = cid.centroDe(m.cel[1]);
  const R = cid.retangulosPerto(cx, cz, 1), D = I.INTERIORES[id];
  const meus = R.filter((q) => q.interior === id);
  ok(meus.length > 10 && meus.every((q) => q.y0 >= I.Y0 - 1 && q.x1 > q.x0 && q.z1 > q.z0 && q.y1 > q.y0), `${id}: ${meus.length} sólidos da sala, todos no alto (y ≥ ${I.Y0 - 1})`);
  // fora: do ponto da história na calçada até o gatilho da porta, a pé
  const g = D.fora.gatilho, gu = (g[0] + g[1]) / 2, gv = (g[2] + g[3]) / 2, pf = M.pontoMundo(id);
  const ida = anda(R, pf.x, pf.z, 0.3, cx + gu, cz + g[3] + 0.5);                   // anda até encostar na fachada
  ok(I.noGatilhoFora(id, ida.x - cx, ida.z - cz), `${id}: da calçada até a porta (gatilho) a pé`);
  const [vu, vv] = D.fora.volta;
  ok(!cid.empurrar(R, cx + vu, cz + vv, 0.45, 0.3, 1.8).bateu && !I.noGatilhoFora(id, vu, vv), `${id}: a volta para a rua fica livre e fora do gatilho`);
  // dentro: chão no alto, teto em cima; da entrada até cada ponto e até a porta de saída
  const [eu, ev] = D.entrada, ex = cx + eu, ez = cz + ev;
  ok(cid.chaoEm(R, ex, ez, I.Y0 + 0.5) === I.Y0, `${id}: piso de dentro em y = ${I.Y0}`);
  ok(R.some((q) => q.interior === id && q.y0 === I.Y0 + D.teto && ex > q.x0 && ex < q.x1 && ez > q.z0 && ez < q.z1), `${id}: teto em cima (${D.teto} m)`);
  for (const [nome, [pu, pv]] of Object.entries(D.pontos)) {
    const w = M.pontoMundo(nome);
    let r = { x: ex, z: ez, y: I.Y0 };
    for (const [a, b] of [...(VIA[nome] || []), [pu, pv]]) r = anda(R, r.x, r.z, r.y, cx + a, cz + b);
    ok(r.chegou && w.y === I.Y0 && w.interior === id, `${id}: da entrada até "${nome}" a pé (y = ${w.y})`);
  }
  const s = anda(R, ex, ez, I.Y0, cx + (D.porta[0] + D.porta[1]) / 2, cz + D.sala[2] - 0.3);   // até encostar na porta
  ok(I.noGatilhoDentro(id, s.x - cx, s.z - cz), `${id}: da entrada até a porta de saída`);
  ok(!I.noGatilhoDentro(id, eu, ev), `${id}: quem entra não cai direto no gatilho de saída`);
  // a rua não sente a sala do alto: na calçada, o chão continua a calçada
  ok(cid.chaoEm(R, pf.x, pf.z, 0.3) <= cid.CALCADA + 0.01, `${id}: na rua o chão continua o da calçada`);
}

// NÃO ATRAVESSA PAREDE (dono, 30/10: "to conseguindo atravessar parede, ta bugando e ta estranho"): o passo do herói do jogo
// (jogo.js passoHeroi) refeito aqui — subpassos, empurrar, a velocidade que sai da batida — correndo em todas as direções,
// de pontos sorteados da sala, a 20 e a 60 qps. Um juiz independente (cruzamento de reta: o centro passou de um lado da
// parede para o outro dentro do comprimento dela) conta as travessias. A regra ANTIGA (até 58 m/s, passos de 0,6 m, sem a
// trava) atravessa; a NOVA (9 m/s dentro, passos de 0,12 m, a trava cruzaSolido) não.
function rodarSala(id, regra, semente) {
  const m = M.MARCOS.find((k) => k.id === id), cx = cid.centroDe(m.cel[0]), cz = cid.centroDe(m.cel[1]);
  const R = cid.retangulosPerto(cx, cz, 1), D = I.INTERIORES[id], [u0, u1, v0, v1] = D.sala;
  const sala = R.filter((q) => q.interior === id && q.y0 < I.Y0 + 0.05 + 1.8 && q.y1 > I.Y0 + 0.1);
  let r = semente >>> 0; const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  const livre = (x, z) => !cid.empurrar(R, x, z, 0.47, I.Y0, 1.8).bateu;
  let travessias = 0, foraDaSala = 0, dentroDeSolido = 0;
  for (let corrida = 0; corrida < 60; corrida++) {
    let x, z, k = 0; do { x = cx + u0 + 0.6 + rnd() * (u1 - u0 - 1.2); z = cz + v0 + 0.6 + rnd() * (v1 - v0 - 1.2); } while (!livre(x, z) && k++ < 200);
    const dt = corrida % 2 ? 1 / 20 : 1 / 60;
    let ang = rnd() * Math.PI * 2, vx = 0, vz = 0;
    for (let f = 0; f < 3 / dt; f++) {
      if (rnd() < 0.04) ang += (rnd() - 0.5) * 2.4;                                   // muda o analógico de vez em quando
      const vmax = regra.vmax, kk = 1 - Math.exp(-5 * dt);
      vx += (Math.sin(ang) * vmax - vx) * kk; vz += (Math.cos(ang) * vmax - vz) * kk;
      const n = Math.max(1, Math.ceil(Math.hypot(vx, vz) * dt / regra.passo)), sub = dt / n;
      for (let s = 0; s < n; s++) {
        const ox = x, oz = z; x += vx * sub; z += vz * sub;
        const q = cid.empurrar(R, x, z, 0.45, I.Y0, 1.8);
        if (q.bateu) { const antes = Math.hypot(vx, vz); x = q.x; z = q.z; vx = (x - ox) / sub * 0.98; vz = (z - oz) / sub * 0.98; const dep = Math.hypot(vx, vz); if (dep > antes) { vx *= antes / dep; vz *= antes / dep; } }
        if (regra.trava && I.cruzaSolido(R, ox, oz, x, z, I.Y0, 1.8)) { x = ox; z = oz; vx *= 0.2; vz *= 0.2; }
        // o juiz: cada sólido da sala, o centro cruzou o meio dele (na direção curta) dentro do comprimento?
        for (const w of sala) {
          const fino = w.x1 - w.x0 < w.z1 - w.z0, meio = fino ? (w.x0 + w.x1) / 2 : (w.z0 + w.z1) / 2;
          const a = fino ? ox : oz, b = fino ? x : z; if ((a - meio) * (b - meio) >= 0) continue;
          const t = (meio - a) / (b - a), along = fino ? oz + (z - oz) * t : ox + (x - ox) * t;
          if (along > (fino ? w.z0 : w.x0) && along < (fino ? w.z1 : w.x1)) travessias++;
        }
      }
      if (x < cx + u0 || x > cx + u1 || z < cz + v0 - 2.4 || z > cz + v1) foraDaSala++;
      if (sala.some((w) => x > w.x0 + 0.02 && x < w.x1 - 0.02 && z > w.z0 + 0.02 && z < w.z1 - 0.02)) dentroDeSolido++;
    }
  }
  return { travessias, foraDaSala, dentroDeSolido };
}
const ANTIGA = { vmax: 58, passo: 0.6, trava: false }, NOVA = { vmax: 9, passo: 0.12, trava: true };
let antigaTotal = 0;
for (const id of I.IDS_INTERIOR) {
  const a = rodarSala(id, ANTIGA, 11), n = rodarSala(id, NOVA, 11);
  antigaTotal += a.travessias + a.foraDaSala;
  console.log(`     ${id}: regra antiga ${a.travessias} travessias, ${a.foraDaSala} quadros fora da sala → nova ${n.travessias} / ${n.foraDaSala} (centro dentro de sólido: ${n.dentroDeSolido})`);
  ok(n.travessias === 0 && n.foraDaSala === 0 && n.dentroDeSolido === 0, `${id}: correndo em todas as direções (60 corridas, 20 e 60 qps) nunca atravessa parede nem sai da sala`);
}
ok(antigaTotal > 0, `a regra antiga atravessava (${antigaTotal}): o teste pega o defeito`);

if (process.argv.includes('--navegador')) {
  const saida = process.argv[process.argv.indexOf('--navegador') + 1];
  if (saida && !saida.startsWith('--')) fs.mkdirSync(saida, { recursive: true });
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  const espera = (fn, arg, t = 600000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
  await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; window.__rel.crimes.adiantar(-1e9); });
  for (const id of I.IDS_INTERIOR) {
    const m = M.MARCOS.find((k) => k.id === id), cx = cid.centroDe(m.cel[0]), cz = cid.centroDe(m.cel[1]), D = I.INTERIORES[id], g = D.fora.gatilho;
    // na calçada, diante da porta; espera o quarteirão carregar e então encosta na porta
    await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0 }); R.C.yaw = 0; }, [cx + (g[0] + g[1]) / 2, cz + g[2] - 3]);
    await espera((k) => [...window.__rel.carregados.keys()].includes(k), `${m.cel[0]},${m.cel[1]}`, 300000);
    await pagina.evaluate(([x, z]) => { Object.assign(window.__rel.P, { x, z, y: 0.3, vx: 0, vz: 0 }); }, [cx + (g[0] + g[1]) / 2, cz + (g[2] + g[3]) / 2]);
    const entrou = await espera((id) => window.__rel.J.interior === id && !window.__rel.J.porta && Math.abs(window.__rel.P.y - 1500) < 1, id, 300000);
    ok(entrou, `no jogo, encostar na porta leva para dentro de "${D.nome}"`);
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (saida && !saida.startsWith('--')) await pagina.screenshot({ path: path.join(saida, `dentro-${id}.png`), timeout: 600000 });
    if (id === 'delegacia') {
      // no jogo de verdade: a 40 m/s contra a parede de vidro do laboratório (16 cm, em u = 4), fora do vão da porta, e
      // apertando VIBRAR: ele para do lado de cá, não vibra e não passa de 9 m/s
      await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, vx: 40, vz: 0, h: Math.PI / 2 }); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV' })); }, [cx + 1.5, cz - 6]);
      await pagina.waitForTimeout(2500);
      const r = await pagina.evaluate((cx) => { window.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', code: 'KeyV' })); const P = window.__rel.P; return { u: P.x - cx, vib: P.vibrando, v: Math.hypot(P.vx, P.vz) }; }, cx);
      ok(r.u < 4 - 0.08 && !r.vib && r.v <= 9.5, `a 40 m/s contra a parede de vidro, vibrando: fica do lado de cá (u = ${r.u.toFixed(2)}, vibrando ${r.vib}, ${r.v.toFixed(1)} m/s)`);
    }
    // vira para a porta de saída e encosta nela
    await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, vx: 0, vz: -1 }); }, [cx + (D.porta[0] + D.porta[1]) / 2, cz + D.sala[2] + 0.1]);
    const saiu = await espera(() => !window.__rel.J.interior && !window.__rel.J.porta && window.__rel.P.y < 3, null, 300000);
    const pos = await pagina.evaluate(() => ({ x: window.__rel.P.x, z: window.__rel.P.z }));
    ok(saiu && Math.hypot(pos.x - (cx + D.fora.volta[0]), pos.z - (cz + D.fora.volta[1])) < 1.5, `no jogo, a porta de dentro devolve para a calçada de "${D.nome}"`);
  }
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
