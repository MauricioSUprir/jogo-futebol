// Trânsito e pedestres (js/trafego.js, js/pedestres.js).
// Node (lógica, com o three.js de verdade do cache do CDN):
//   C1 carros sempre na faixa da mão direita (centro a 2,2 m do eixo; nunca na faixa dos estacionados nem na calçada)
//   C2 movimento contínuo (passo ≤ v·dt, giro ≤ 4,5 rad/s) — salvo renascimento
//   C3 quase nunca encostam um no outro (pares a < 3 m em ≤ 1% dos instantes)
//   C4 renascem longe do jogador (≥ 0,55 do raio) e a contagem fica 26 (PC) / 14 (celular)
//   C5 o herói passando a < 3 m em > 25 m/s assusta o carro (freia)
//   P1 pedestres nunca dentro de prédio; fora da laje só atravessando na faixa (8,5–12 m do eixo da rua cruzada)
//   P2 o herói passando rápido perto: a pessoa gira/cai e levanta em ≤ 3,2 s
//   P3 o herói parado perto: a pessoa para e olha para ele
//   T  CPU do atualizar (26 carros + 60 pessoas) < 1 ms por quadro
// Navegador (trafego.html): chamadas de desenho do trânsito (≤ 3) e dos pedestres (≤ 4), prints dia/noite/celular.
// Uso: node velocista/tools/teste-trafego.mjs [--prints <pasta>] [--so-node]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VEL = path.join(AQUI, '..');
const args = process.argv.slice(2);
const pastaPrints = args.includes('--prints') ? args[args.indexOf('--prints') + 1] : null;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK  ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// three.js do cache do CDN (o mesmo arquivo que o navegador usa)
const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const cacheDir = path.join(VEL, '..', 'golaco', 'tools', '.cache-cdn');
const arqCache = path.join(cacheDir, URL_THREE.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180));
if (!fs.existsSync(arqCache)) { fs.mkdirSync(cacheDir, { recursive: true }); execFileSync('curl', ['-sSfL', '--retry', '3', '-o', arqCache, URL_THREE], { stdio: 'inherit' }); }
const tmpThree = path.join(fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'three-')), 'three.mjs');
fs.copyFileSync(arqCache, tmpThree);
const THREE = await import(pathToFileURL(tmpThree).href);
const { CELL, MEIO, BLOCO, bloco, celulaDe, centroDe } = await import(pathToFileURL(path.join(VEL, 'js/cidade.js')).href);
const { criarTrafego } = await import(pathToFileURL(path.join(VEL, 'js/trafego.js')).href);
const { criarPedestres } = await import(pathToFileURL(path.join(VEL, 'js/pedestres.js')).href);

const distEixo = (v) => { const k = Math.round((v + MEIO) / CELL); return Math.abs(v - (k * CELL - MEIO)); };
const DT = 1 / 60;

// ---------------- carros ----------------
for (const mobile of [false, true]) {
  const cena = new THREE.Scene(), tr = criarTrafego(THREE, cena, { mobile });
  const j = { x: 0, z: 0, vx: 0, vz: 0 };
  let amostras = 0, foraFaixa = 0, naCalcada = 0, saltos = 0, giros = 0, encostados = 0, inst = 0, renasc = [], piorLat = 0;
  const ant = new Map();
  for (let s = 0; s < 60 * 120; s++) {
    // 0–40 s parado; 40–80 s correndo a 30 m/s numa avenida (z = 0 é eixo? usa o eixo mais próximo); 80–120 s em diagonal
    if (s === 60 * 40) { j.vx = 30; j.vz = 0; j.z = Math.round((0 + MEIO) / CELL) * CELL - MEIO; }
    if (s === 60 * 80) { j.vx = -14; j.vz = 22; }
    j.x += j.vx * DT; j.z += j.vz * DT;
    tr.atualizar(DT, j, 0);
    inst++;
    let par = false;
    for (let a = 0; a < tr.carros.length; a++) for (let b = a + 1; b < tr.carros.length; b++) if (Math.hypot(tr.carros[a].x - tr.carros[b].x, tr.carros[a].z - tr.carros[b].z) < 3) par = true;
    if (par) encostados++;
    tr.carros.forEach((c, k) => {
      const ex = distEixo(c.x), ez = distEixo(c.z), m = Math.min(ex, ez);
      amostras++;
      if (ex > 8 && ez > 8) naCalcada++;
      if (m > 3.4 && !(ex < 8 && ez < 8)) foraFaixa++;          // dentro do cruzamento (quadrado de 16 m) é tudo pista
      piorLat = Math.max(piorLat, m);
      if (c.renasceu) { renasc.push(Math.hypot(c.x - j.x, c.z - j.z)); ant.set(k, [c.x, c.z, c.h]); return; }
      const p = ant.get(k);
      if (p) {
        const d = Math.hypot(c.x - p[0], c.z - p[1]); if (d > c.v * DT + 0.05 + 1e-6 && d > 0.3) saltos++;
        let dh = Math.atan2(Math.sin(c.h - p[2]), Math.cos(c.h - p[2])); if (Math.abs(dh) / DT > 4.5) giros++;
      }
      ant.set(k, [c.x, c.z, c.h]);
    });
  }
  const R = tr.RAIO, nome = mobile ? 'celular' : 'PC';
  ok(foraFaixa === 0 && naCalcada === 0, `C1 ${nome}: na faixa (pior distância ao eixo ${piorLat.toFixed(2)} m; fora ${foraFaixa}, na calçada ${naCalcada} de ${amostras})`);
  ok(saltos === 0 && giros === 0, `C2 ${nome}: movimento contínuo (saltos ${saltos}, giros bruscos ${giros})`);
  ok(encostados / inst <= 0.01, `C3 ${nome}: carros encostados em ${(100 * encostados / inst).toFixed(2)}% dos instantes (≤ 1%)`);
  const minR = renasc.length ? Math.min(...renasc) : Infinity;
  ok(tr.carros.length === (mobile ? 14 : 26) && minR >= 0.55 * R, `C4 ${nome}: ${tr.carros.length} carros; ${renasc.length} renascimentos, o mais perto a ${minR.toFixed(0)} m (raio ${R})`);
  tr.dispose();
}
{ // C5: susto
  const cena = new THREE.Scene(), tr = criarTrafego(THREE, cena, {});
  const j = { x: 0, z: 0, vx: 0, vz: 0 };
  for (let s = 0; s < 120; s++) tr.atualizar(DT, j, 0);
  const c = tr.carros.find((o) => o.v > 5) || tr.carros[0];
  const fx = Math.cos(c.h), fz = Math.sin(c.h), v0 = c.v;
  const jj = { x: c.x + fx * 1.5 - fz * 1.5, z: c.z + fz * 1.5 + fx * 1.5, vx: 40, vz: 0 };
  tr.atualizar(DT, jj, 0); for (let s = 0; s < 30; s++) tr.atualizar(DT, { ...jj, vx: 0 }, 0);
  ok(c.susto > 0 || c.v < v0 * 0.6, `C5 susto: herói a 1,5 m a 40 m/s → velocidade ${v0.toFixed(1)} → ${c.v.toFixed(1)} m/s`);
  tr.dispose();
}

// ---------------- pedestres ----------------
{
  const cena = new THREE.Scene(), pd = criarPedestres(THREE, cena, {});
  const j = { x: 0, z: 0, vx: 0, vz: 0 };
  let dentroPredio = 0, foraLaje = 0, cruzamentosRuins = 0, amostras = 0, travessias = 0;
  for (let s = 0; s < 60 * 150; s++) {
    if (s === 60 * 50) { j.vx = 8; j.vz = 3; }
    if (s === 60 * 100) { j.vx = -6; j.vz = -9; }
    j.x += j.vx * DT; j.z += j.vz * DT;
    pd.atualizar(DT, j, 0);
    for (const p of pd.pessoas) {
      amostras++;
      const i = celulaDe(p.x), k = celulaDe(p.z), b = bloco(i, k);
      if (b.lotes.some((l) => p.x > l.x0 + 0.05 && p.x < l.x1 - 0.05 && p.z > l.z0 + 0.05 && p.z < l.z1 - 0.05)) dentroPredio++;
      const naLaje = Math.abs(p.x - centroDe(i)) <= BLOCO / 2 && Math.abs(p.z - centroDe(k)) <= BLOCO / 2;
      if (!naLaje) {
        foraLaje++;
        if (p.estado === 'cruza') travessias++;
        // atravessando: a distância ao eixo da rua que está sendo cruzada (o outro eixo) tem de estar na faixa de pedestre
        const ex = distEixo(p.x), ez = distEixo(p.z), lateral = ex < ez ? ez : ex;   // perto de um eixo (atravessando-o), a distância ao outro
        if (!p.cruzando && p.estado !== 'cruza') cruzamentosRuins++;
        else if (lateral < 8.5 || lateral > 12) cruzamentosRuins++;
      }
    }
  }
  ok(dentroPredio === 0, `P1 pedestres nunca dentro de prédio (${dentroPredio} de ${amostras})`);
  ok(cruzamentosRuins === 0 && foraLaje > 0, `P1 fora da calçada só atravessando na faixa (${foraLaje} amostras fora da laje, ${cruzamentosRuins} fora da faixa)`);
  // P2: passa rápido rente a uma pessoa
  const alvo = pd.pessoas.find((p) => p.estado === 'anda');
  const jr = { x: alvo.x - 1.5, z: alvo.z + 1, vx: 35, vz: 0 };
  pd.atualizar(DT, jr, 0);
  const reagiu = alvo.estado === 'vento' || alvo.estado === 'caido';
  let t = 0; const longe = { x: alvo.x + 60, z: alvo.z + 60, vx: 0, vz: 0 };
  while ((alvo.estado === 'vento' || alvo.estado === 'caido') && t < 6) { pd.atualizar(DT, longe, 0); t += DT; }
  ok(reagiu && t <= 3.2, `P2 reação ao herói rápido (${reagiu ? 'reagiu' : 'não reagiu'}; volta a andar em ${t.toFixed(2)} s)`);
  // P3: herói parado a 3 m
  const p3 = pd.pessoas.find((p) => p.estado === 'anda' && p !== alvo);
  const jp = { x: p3.x + 2, z: p3.z + 2.2, vx: 0, vz: 0 };
  for (let s = 0; s < 30; s++) pd.atualizar(DT, jp, 0);
  const pos0 = [p3.x, p3.z];
  for (let s = 0; s < 120; s++) pd.atualizar(DT, jp, 0);
  const mexeu = Math.hypot(p3.x - pos0[0], p3.z - pos0[1]);
  const dirJ = Math.atan2(jp.z - p3.z, jp.x - p3.x), erro = Math.abs(Math.atan2(Math.sin(dirJ - p3.h), Math.cos(dirJ - p3.h)));
  ok(mexeu < 0.01 && erro < 0.3, `P3 parado perto: a pessoa para (andou ${mexeu.toFixed(3)} m) e olha (erro ${(erro * 57.3).toFixed(0)}°)`);
  pd.dispose();
}

// ---------------- CPU ----------------
{
  const cena = new THREE.Scene(), tr = criarTrafego(THREE, cena, {}), pd = criarPedestres(THREE, cena, {});
  const j = { x: 0, z: 0, vx: 20, vz: 6 };
  for (let s = 0; s < 300; s++) { j.x += j.vx * DT; j.z += j.vz * DT; pd.atualizar(DT, j, 0); tr.atualizar(DT, j, 0, pd.pessoas); }
  const t0 = performance.now(), n = 3000;
  for (let s = 0; s < n; s++) { j.x += j.vx * DT; j.z += j.vz * DT; pd.atualizar(DT, j, 0); tr.atualizar(DT, j, 0, pd.pessoas); }
  const ms = (performance.now() - t0) / n;
  ok(ms < 1, `T CPU do atualizar: ${ms.toFixed(3)} ms por quadro (26 carros + 60 pessoas; meta < 1 ms)`);
}

// ---------------- navegador ----------------
if (!args.includes('--so-node')) {
  const { servidor, abrir } = await import(pathToFileURL(path.join(VEL, '..', 'golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, VEL);
  for (const caso of [{ nome: 'pc-dia', q: '', o: { largura: 1280, altura: 720 } }, { nome: 'pc-noite', q: '?noite=1', o: { largura: 1280, altura: 720 } }, { nome: 'cel-dia', q: '?mobile=1', o: { largura: 844, altura: 390, dpr: 2, toque: true } }]) {
    const { navegador, pagina, erros } = await abrir(caso.o);
    await pagina.goto(srv.url + 'trafego.html' + caso.q);
    await pagina.waitForFunction(() => window.__traf && window.__traf.cpu().n > 20, null, { timeout: 120000 });
    // câmera numa esquina perto do jogador, a 2 m de altura olhando a rua
    await pagina.evaluate(() => { const T = window.__traf; T.cam.alvo = [T.jog.x + 4, 1.4, T.jog.z + 4]; T.cam.dist = 26; T.cam.pitch = 0.32; T.cam.yaw = 0.8; });
    await pagina.waitForTimeout(1500);
    const info = await pagina.evaluate(() => {
      const T = window.__traf, r = T.renderer;
      r.render(T.cena, T.camera); const total = r.info.render.calls;
      T.traf.malhas.forEach((m) => { m.visible = false; }); r.render(T.cena, T.camera); const semCarros = r.info.render.calls;
      T.ped.malha.visible = false; r.render(T.cena, T.camera); const semNada = r.info.render.calls;
      T.traf.malhas.forEach((m) => { m.visible = true; }); T.ped.malha.visible = true;
      return { carros: total - semCarros, pedestres: semCarros - semNada };
    });
    // (um InstancedMesh por modelo de carro: seis no PC, três no celular, mais o facho dos faróis)
    if (caso.nome === 'pc-dia') ok(info.carros <= 7 && info.pedestres <= 4, `desenho: trânsito ${info.carros} chamadas (≤ 7: seis modelos + o facho), pedestres ${info.pedestres} (≤ 4)`);
    if (caso.nome === 'cel-dia') ok(info.carros <= 4, `desenho no celular: trânsito ${info.carros} chamadas (≤ 4: três modelos + o facho)`);
    if (pastaPrints) {
      fs.mkdirSync(pastaPrints, { recursive: true });
      await pagina.screenshot({ path: path.join(pastaPrints, `${caso.nome}.png`), timeout: 120000 });
      await pagina.evaluate(() => {           // de perto: a pessoa mais próxima do jogador
        const T = window.__traf; let m = null, md = 1e9; for (const p of T.ped.pessoas) { const d = Math.hypot(p.x - T.jog.x, p.z - T.jog.z); if (d < md) { md = d; m = p; } }
        T.cam.alvo = [m.x, 1.1, m.z]; T.cam.dist = 4.5; T.cam.pitch = 0.12; T.cam.yaw = -m.h + Math.PI / 2 + 0.6; });
      await pagina.waitForTimeout(800);
      await pagina.screenshot({ path: path.join(pastaPrints, `${caso.nome}-perto.png`), timeout: 120000 });
    }
    ok(erros.length === 0, `${caso.nome}: console sem erros (${erros.slice(0, 2).join(' | ')})`);
    await navegador.close();
  }
  await srv.fechar();
}
process.exit(falhas ? 1 : 0);
