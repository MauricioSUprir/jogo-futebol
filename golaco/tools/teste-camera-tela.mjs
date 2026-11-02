// teste-camera-tela: a câmera de TV do item 66 NA PÁGINA (pedido do dono, 23/10: "a câmera não acompanha a bola e não dá
// pra ver a área completamente ... afastar muito pouco mais e centralizar mais"; contrato "Câmera de TV (item 66)" no
// CONTRATOS.md; o teste em Node é o teste-camera.mjs). Relógio manual a 60 qps; celular 844×390 (dpr 2, toque, Média) e PC
// 1280×720 (Média), de dia.
//  J  partida IA × IA (?demo=1&replay=0&comemoracao=0), sementes 4 e 11, um instante a cada 90 quadros com a câmera de jogo:
//     J1 a bola na tela da página (naTela) × a projeção fechada do enquadramento.js com a pose de render.camera (≤ 1,5 px) e
//        a câmera da página × a do teste-camera em Node nos mesmos ticks (≤ 0,2 m: o main.js monta o alvo como o teste);
//     J2 a bola atrás do HUD (celular) = 0; J3 a torcida em pixels (a conta do teste-estadio item 10, celular): ≥ 95% dos
//     instantes com ≥ 1% da tela e mediana ≥ 6%; J4 o controlado ≥ 34 px no celular (mediana); J5 o custo no celular Média
//     (chamadas: mediana ≤ a da base + 2; triângulos: p95 ≤ a da base × 1,10; a base gravada abaixo — `--raiz <base>`
//     mede e imprime); J6 a área "à vista" (no quadro e fora do HUD) com a bola a ≤ 25 m do gol (informativo).
//  A  a bola presa em 6 pontos de cada área por 2 s: A1 os 4 cantos e o alto das 2 traves no quadro
//     (pelo naTela) e A2 a bola dentro do limite do alvo, nos 12 casos × 2 telas.
//  E  o escanteio da pessoa (__golaco.bolaParadaDeTeste('escanteio', {lado: 'ca'|'la'})), celular e PC: E1 a área 100% no
//     quadro e ≥ 95% fora do HUD; E2 a faixa da área ≥ 18% da altura; E3 os jogadores na área ≥ 18 px (celular) / 32 px (PC);
//     E4 o cobrador inteiro (cabeça ≥ 40%, pés ≤ 92% da altura); E5 nada sólido na lente e nenhum jogador a < 0,8 m; E6 o
//     cruzamento (LANÇAMENTO 0,5 s) e os 3 s depois: a bola no quadro ≥ 85%, a área inteira quando a bola está nela ≥ 90%, a
//     mistura a 0 em ≤ 1,3 s sem passo > 2,5 m (o de lá, que olha para o lado oposto ao da TV, volta por corte); E7 o pior
//     quadro no celular ≤ 40 chamadas e ≤ 130 mil triângulos; E8 no Modo Livre (TV, celular) o de lá também volta por corte
//     e a bola fica no quadro ≥ 85% (revisão R5).
//  F  a TV na bola parada da IA (o escanteio dos 2 lados e a falta a 25 m): F1 a área inteira, o gol e a bola no quadro.
//  N  de noite, os mesmos ticks: render.camera igual (Δ ≤ 1 mm: só o resto da mola do relógio de verdade antes do manual).
//  Nenhum erro no console.
//   node tools/teste-camera-tela.mjs [--raiz <pasta golaco>] [--so J|A|E|F|N] [--prints <pasta>]
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RAIZ_JOGO = path.resolve(arg('--raiz', RAIZ));
const SO = arg('--so', null);
const PRINTS = arg('--prints', null);
if (PRINTS) fs.mkdirSync(PRINTS, { recursive: true });
const parte = p => !SO || SO.split(',').includes(p);
let EQ = null;
try { EQ = await import(pathToFileURL(path.join(RAIZ_JOGO, 'js/render/enquadramento.js')).href); } catch { EQ = null; }
const SEMENTES = [4, 11], N_POR_SEMENTE = 20, CADA = 90;
const TELAS = [
  { chave: 'cel', nome: 'celular 844×390', largura: 844, altura: 390, dpr: 2, toque: true },
  { chave: 'pc', nome: 'PC 1280×720', largura: 1280, altura: 720, dpr: 1, toque: false },
];
// o custo da TV no celular Média na BASE (79bbfbc2, medido com `--raiz <base> --so J`: as mesmas sementes e instantes; a
// torcida 40/40 com mediana 8,6%, o controlado 37,4 px, a área a ≤ 25 m do gol no quadro 73,9% e inteira 0/7)
const BASE_CUSTO = { chamadasMed: +(process.env.CAM_BASE_CHAMADAS ?? 28), triangulosP95: +(process.env.CAM_BASE_TRIANGULOS ?? 101200) };

const linhas = [];
let falhas = 0;
function meta(nome, medido, ok, alvo = '') { linhas.push(`${ok === null ? 'INFO   ' : ok ? 'PASSOU ' : 'REPROVOU'}  ${nome} — ${medido}${alvo ? ` (alvo: ${alvo})` : ''}`); if (ok === false) falhas++; }
const q = (v, p) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : NaN; };
const f1 = v => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '–');
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '–');

// as formas do HUD visíveis (a régua do teste-hud-minimo, reduzida): retângulos e círculos (o painel #mira da cobrança mirada
// saiu com o item 65: a tela da cobrança fica sem painel)
const FORMAS = `(() => {
  const vis = e => e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.01;
  const alfa = c => { const v = (c.match(/[\\d.]+/g) ?? []).map(Number); return v.length > 3 ? v[3] : v.length ? 1 : 0; };
  const transparente = e => { const s = getComputedStyle(e); return alfa(s.backgroundColor) < 0.01 && s.backgroundImage === 'none' && s.boxShadow === 'none'
    && ['Top', 'Right', 'Bottom', 'Left'].every(l => parseFloat(s['border' + l + 'Width']) === 0 || s['border' + l + 'Style'] === 'none' || alfa(s['border' + l + 'Color']) < 0.01); };
  const f = [];
  for (const e of document.querySelectorAll('#hud [data-caixa], #carga.visivel')) {
    if (!vis(e)) continue;
    let r = e.getBoundingClientRect();
    if (e.children.length && transparente(e)) {
      let u = null;
      for (const c of e.children) { const cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) continue;
        u = u ? { left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; }
      if (u) r = { ...u, width: u.right - u.left, height: u.bottom - u.top };
    }
    if (r.width >= 1 && r.height >= 1) f.push({ nome: e.dataset.caixa || e.id, ret: [r.left, r.top, r.right, r.bottom] });
  }
  for (const e of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) {
    if (getComputedStyle(e).display === 'none' || e.offsetWidth === 0) continue;
    f.push({ nome: e.id, circ: [e.offsetLeft + e.offsetWidth / 2, e.offsetTop + e.offsetHeight / 2, Math.min(e.offsetWidth, e.offsetHeight) / 2] });
  }
  const ab = document.querySelector('#toque:not([hidden]) .analogico-base');
  const op = ab ? +getComputedStyle(document.getElementById('analogico')).opacity : 0;
  if (ab && op > 0.25) { const r = ab.getBoundingClientRect(); if (r.width > 0) f.push({ nome: 'analogico', circ: [r.left + r.width / 2, r.top + r.height / 2, r.width / 2] }); }
  return f;
})`;
// funções da página (texto: eval dentro do evaluate)
const AUX = `({
  dentroF: (f, x, y) => f.some(s => (s.ret ? x >= s.ret[0] && x <= s.ret[2] && y >= s.ret[1] && y <= s.ret[3] : (x - s.circ[0]) ** 2 + (y - s.circ[1]) ** 2 <= s.circ[2] ** 2)),
  naQ: p => !p.atras && p.x >= -0.5 && p.x <= innerWidth + 0.5 && p.y >= -0.5 && p.y <= innerHeight + 0.5,
  // a área do gol gx (±52,5): cantos e topo das traves (naTela) e a grade 11 × 15 (no quadro; fora do HUD)
  area(g, gx, f) {
    const s = Math.sign(gx), r = { pontos: [], quadro: 0, vista: 0, y0: Infinity, y1: -Infinity };
    for (const [u, y, z] of [[0, 0, 20.16], [16.5, 0, 20.16], [0, 0, -20.16], [16.5, 0, -20.16], [0, 2.44, 3.66], [0, 2.44, -3.66]]) r.pontos.push(g.naTela(gx - s * u, y, z));
    let tot = 0;
    for (let i = 0; i <= 10; i++) for (let k = 0; k <= 14; k++) {
      tot++; const p = g.naTela(gx - s * 16.5 * i / 10, 0, -20.16 + 40.32 * k / 14);
      if (this.naQ(p)) { r.quadro++; if (!f || !this.dentroF(f, p.x, p.y)) r.vista++; r.y0 = Math.min(r.y0, p.y); r.y1 = Math.max(r.y1, p.y); }
    }
    r.quadro /= tot; r.vista /= tot; r.inteira = r.pontos.every(p => this.naQ(p));
    return r;
  },
})`;

const srv = await servidor(0, RAIZ_JOGO);
const pronta = pg => pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
const geo = T => {
  if (!EQ) return null;
  const p = EQ.perfilCamera({}, 0, T.largura / T.altura, Math.min(T.largura, T.altura) < 520);
  return { p, g: EQ.geometriaTV({}, p, T.largura / T.altura, Math.min(T.largura, T.altura) < 520) };
};
let errosTot = 0;
const rastro = { cel: [], pc: [] };

try {
  // ================================================================================================ J: a partida da demo
  if (parte('J')) {
    for (const T of TELAS) {
      const G = geo(T), J = [];
      for (const sem of SEMENTES) {
        const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
        try {
          await pagina.goto(`${srv.url}?q=media&demo=1&semente=${sem}${T.toque ? '&toque=1' : ''}&hora=dia&replay=0&comemoracao=0`, { waitUntil: 'load' });
          await pronta(pagina);
          const r = await pagina.evaluate(([FS, AX, N, CADA, cel]) => {
            const formas = eval(FS), X = eval(AX);
            const g = window.__golaco; g.relogio.usarManual(true);
            const cv = document.querySelector('canvas');
            const off = document.createElement('canvas'); off.width = Math.round(innerWidth / 4); off.height = Math.round(innerHeight / 4);
            const cx = off.getContext('2d', { willReadFrequently: true });
            const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
            const out = [];
            let guarda = 0;
            while (out.length < N && guarda++ < N * 6) {
              for (let i = 0; i < CADA; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
              const m = g.mundo, pr = m.parada;
              if (g.estadio.planoCamera !== 'jogo' || m.partida?.estado !== 'jogo') continue;
              const bo = m.bola.p, f = cel ? formas() : [];
              const s = { tick: m.tick, cam: { ...g.render.camera }, bola: { x: bo.x, y: bo.y, z: bo.z }, rolando: !pr || pr.rolou };
              if (cel) {
                // a torcida (o mesmo quadro com × sem ela) e o custo do quadro desenhado
                g.estadio.mostrarTorcida(true); g.desenhar(); const a = ler();
                const e0 = g.estado(); s.chamadas = e0.desenhoChamadas; s.triangulos = e0.desenhoTriangulos;
                g.estadio.mostrarTorcida(false); g.desenhar(); const b = ler();
                g.estadio.mostrarTorcida(true); g.desenhar();
                let n = 0;
                for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 24) n++;
                s.torc = n / (a.length / 4);
              }
              const pb = g.naTela(bo.x, bo.y, bo.z); s.bpx = [pb.x, pb.y]; s.bolaNoQuadro = X.naQ(pb); s.bolaHud = s.bolaNoQuadro && X.dentroF(f, pb.x, pb.y);
              const j = g.render.jogador;
              if (j) { const p0 = g.naTela(j.x, 0, j.z), p1 = g.naTela(j.x, 1.8, j.z); s.hCtrl = Math.abs(p0.y - p1.y); }
              const gx = (bo.x >= 0 ? 1 : -1) * 52.5;
              if (Math.hypot(bo.x - gx, bo.z) <= 25) { const a = X.area(g, gx, cel ? f : null); s.area = { quadro: a.quadro, vista: a.vista, inteira: a.inteira }; }
              out.push(s);
            }
            return out;
          }, [FORMAS, AUX, N_POR_SEMENTE, CADA, T.toque]);
          r.forEach(s => { s.sem = sem; });
          J.push(...r);
          errosTot += erros.length;
          if (erros.length) console.log(`  (${T.nome}, semente ${sem}: ${erros.length} erro(s) no console: ${erros.slice(0, 2).join(' | ')})`);
          if (PRINTS) { await pagina.evaluate(() => window.__golaco.desenhar()); await pagina.screenshot({ path: path.join(PRINTS, `jogo-${T.chave}-s${sem}.png`) }); }
        } finally { await navegador.close(); }
      }
      // J1 a projeção fechada × o naTela da página
      if (G) {
        let pior = 0;
        const o = {};
        for (const s of J) {
          const fx = s.cam.x, fz = s.cam.z - G.p.distancia;
          EQ.projetarTV(G.g, fx, fz, s.bola.x, s.bola.y, s.bola.z, o);
          const px = (o.x + 1) / 2 * T.largura, py = (1 - o.y) / 2 * T.altura;
          pior = Math.max(pior, Math.hypot(px - s.bpx[0], py - s.bpx[1]));
        }
        meta(`J1 ${T.nome}: a bola na tela da página × a projeção fechada (enquadramento.js) com a pose de render.camera (${J.length} instantes)`, `pior ${f2(pior)} px`, pior <= 1.5, '≤ 1,5 px');
      } else meta(`J1 ${T.nome}: a projeção fechada (render/enquadramento.js)`, 'o módulo não existe nesta versão', false);
      rastro[T.chave] = J.map(s => ({ sem: s.sem, tick: s.tick, cam: s.cam }));
      const cel = T.chave === 'cel';
      if (cel) {
        meta(`J2 ${T.nome}: a bola atrás do HUD`, `${J.filter(s => s.bolaHud).length}/${J.length}`, J.filter(s => s.bolaHud).length === 0, '0');
        const tor = J.map(s => s.torc), com = tor.filter(v => v >= 0.01).length;
        meta(`J3 ${T.nome}: a torcida em pixels (com × sem ela): instantes com ≥ 1% da tela; mediana`, `${com}/${J.length}; ${f1(100 * q(tor, 0.5))}% (antes 60/60, 8,3%)`, com >= 0.95 * J.length && q(tor, 0.5) >= 0.06, '≥ 95%; ≥ 6%');
        const hc = q(J.map(s => s.hCtrl), 0.5);
        meta(`J4 ${T.nome}: o controlado (0 → 1,8 m), mediana`, `${f1(hc)} px (antes 37,4)`, hc >= 34, '≥ 34 px');
        const cm = q(J.map(s => s.chamadas), 0.5), tp = q(J.map(s => s.triangulos), 0.95);
        if (Number.isFinite(BASE_CUSTO.chamadasMed) && Number.isFinite(BASE_CUSTO.triangulosP95)) {
          meta(`J5 ${T.nome} Média: o custo da TV — chamadas (mediana); triângulos (p95)`, `${f1(cm)} (base ${f1(BASE_CUSTO.chamadasMed)}); ${(tp / 1000).toFixed(1)} mil (base ${(BASE_CUSTO.triangulosP95 / 1000).toFixed(1)} mil)`, cm <= BASE_CUSTO.chamadasMed + 2 && tp <= BASE_CUSTO.triangulosP95 * 1.1, 'mediana ≤ base + 2; p95 ≤ base × 1,10');
        } else meta(`J5 ${T.nome} Média: o custo da TV (sem a base gravada: CAM_BASE_CHAMADAS / CAM_BASE_TRIANGULOS)`, `chamadas mediana ${f1(cm)}, triângulos p95 ${(tp / 1000).toFixed(1)} mil`, null);
      } else {
        const hc = q(J.map(s => s.hCtrl), 0.5);
        meta(`J4 ${T.nome}: o controlado (0 → 1,8 m), mediana`, `${f1(hc)} px (antes 47,4)`, hc >= 43, '≥ 43 px');
      }
      const ar = J.filter(s => s.area);
      meta(`J6 ${T.nome}: bola a ≤ 25 m do gol (${ar.length}): a área no quadro; inteira; ${cel ? '"à vista" (fora do HUD)' : ''}`, `${f1(100 * q(ar.map(s => s.area.quadro), 0.5))}%; ${ar.filter(s => s.area.inteira).length}/${ar.length}${cel ? `; ${f1(100 * q(ar.map(s => s.area.vista), 0.5))}% (antes 78,2% no quadro)` : ''}`, null);
    }
    // J1b a câmera da página × a do teste-camera em Node nos mesmos ticks (a demo com comoPagina, o alvo pelo preencherAlvo)
    if (EQ) {
      const res = await new Promise((ok, falha) => {
        const ticks = JSON.stringify({ cel: rastro.cel, pc: rastro.pc });
        const tmp = path.join(os.tmpdir(), `rastro-camera-${process.pid}.json`);
        fs.writeFileSync(tmp, ticks);
        const p = spawn(process.execPath, [path.join(AQUI, 'teste-camera.mjs'), '--rastro', tmp, '--js', path.join(RAIZ_JOGO, 'js')], { stdio: ['ignore', 'pipe', 'inherit'] });
        let txt = '';
        p.stdout.on('data', d => { txt += d; });
        p.on('close', c => { fs.rmSync(tmp, { force: true }); if (c) falha(new Error(`teste-camera --rastro: saída ${c}`)); else { try { ok(JSON.parse(txt)); } catch (e) { falha(e); } } });
      }).catch(e => ({ erro: e.message }));
      if (res.erro) meta('J1 a câmera da página × a do teste-camera (Node) nos mesmos ticks', res.erro, false);
      else for (const T of TELAS) {
        const d = res[T.chave] ?? [];
        const ds = d.map(x => x.d).sort((a, b) => a - b);
        meta(`J1 ${T.nome}: a câmera da página × a do teste-camera (Node) nos mesmos ticks (${ds.length})`, `mediana ${ds.length ? ds[ds.length >> 1].toFixed(3) : '–'} m, pior ${ds.length ? ds[ds.length - 1].toFixed(3) : '–'} m`, ds.length >= 10 && ds[ds.length - 1] <= 0.2, '≤ 0,2 m');
      }
    }
  }

  // ================================================================================================ A: a bola na área
  if (parte('A')) {
    for (const T of TELAS) {
      const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
      try {
        await pagina.goto(`${srv.url}?q=media&semente=4${T.toque ? '&toque=1' : ''}&hora=dia&replay=0&comemoracao=0`, { waitUntil: 'load' });
        await pronta(pagina);
        const r = await pagina.evaluate(([AX]) => {
          const X = eval(AX), g = window.__golaco; g.relogio.usarManual(true);
          for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          const out = [];
          for (const s of [1, -1]) for (const [u, z] of [[3, 0], [8, 12], [8, -12], [14, 18], [14, -18], [11, 0]]) {
            const m = g.mundo;
            // a bola presa no ponto por 2 s (a câmera em regime nele; a teletransportada corta na TV nova)
            for (let k = 0; k < 120; k++) {
              m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo';
              Object.assign(m.bola.p, { x: s * (52.5 - u), y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
              g.relogio.avancar(1000 / 60, { desenhar: false });
            }
            Object.assign(m.bola.p, { x: s * (52.5 - u), y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
            g.desenhar();
            const a = X.area(g, s * 52.5, null), bo = m.bola.p, pb = g.naTela(bo.x, bo.y, bo.z);
            const nx = 2 * pb.x / innerWidth - 1, ny = 1 - 2 * pb.y / innerHeight;
            out.push({ caso: `${s > 0 ? '+' : '−'}x u${u} z${z}`, inteira: a.inteira, bola: Math.abs(nx) <= 0.78 + 0.02 && ny >= -0.62 - 0.02 && ny <= 0.8 + 0.02, nx, ny });
          }
          return out;
        }, [AUX]);
        const ruins = r.filter(c => !c.inteira), bolaF = r.filter(c => !c.bola);
        meta(`A1 ${T.nome}: a bola em 6 pontos de cada área: os 4 cantos e o alto das 2 traves no quadro`, `${r.length - ruins.length}/${r.length}${ruins.length ? ` (${ruins.map(c => c.caso).join(', ')})` : ''}`, ruins.length === 0, '12/12');
        meta(`A2 ${T.nome}: … e a bola dentro do limite do alvo (|x| ≤ 0,78, y de −0,62 a 0,80)`, `${r.length - bolaF.length}/${r.length}${bolaF.length ? ` (${bolaF.map(c => `${c.caso} ${f2(c.nx)},${f2(c.ny)}`).join('; ')})` : ''}`, bolaF.length === 0, '12/12');
        errosTot += erros.length;
      } finally { await navegador.close(); }
    }
  }

  // ================================================================================================ E e F: as bolas paradas
  /** Monta a bola parada (o escanteio da pessoa ou da IA, a falta da IA) e espera a câmera pronta; devolve as medidas. */
  async function bolaParada(pagina, tipo, opc, cel) {
    return pagina.evaluate(async ([FS, AX, tipo, opc, cel]) => {
      const formas = eval(FS), X = eval(AX), g = window.__golaco;
      const { solidoEm } = await import('./js/estadio-forma.js');
      g.relogio.usarManual(true);
      for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      if (tipo === 'falta') g.faltaDeTeste({ doMeu: true, u: opc.u ?? 25, w: opc.w ?? 0 });
      else g.bolaParadaDeTeste(tipo, opc);
      let est = null;
      for (let i = 0; i < 900; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        est = g.bolaParada?.estado;
        const pr = g.mundo.parada, pronta = pr && g.mundo.tick >= pr.pronta;
        if (pronta && (!opc.pessoa || (est?.ativa && est.mistura >= 1))) break;
      }
      for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.desenhar();
      const m = g.mundo, pr = m.parada;
      if (!pr) return { erro: 'sem a parada' };
      const gx = (m.ataca[pr.time] || 1) * 52.5, f = cel ? formas() : [];
      const a = X.area(g, gx, f);
      const cob = m.jogadores.find(o => o.id === pr.cobrador);
      const cab = cob ? g.naTela(cob.x, 1.85, cob.z) : null, pes = cob ? g.naTela(cob.x, 0.03, cob.z) : null;
      const bo = m.bola.p, pb = g.naTela(bo.x, bo.y, bo.z);
      const hs = [];
      for (const o of m.jogadores) {
        if (Math.abs(o.x - gx) > 16.5 || Math.abs(o.z) > 20.16) continue;
        const p0 = g.naTela(o.x, 0, o.z), p1 = g.naTela(o.x, 1.8, o.z); if (X.naQ(p0)) hs.push(Math.abs(p0.y - p1.y));
      }
      hs.sort((x, y) => x - y);
      const c = g.render.camera;
      let perto = Infinity;
      for (const o of m.jogadores) perto = Math.min(perto, Math.hypot(o.x - c.x, o.z - c.z) + Math.max(0, c.y - 1.9));
      const e0 = g.estado();
      return {
        tipo: pr.tipo, time: pr.time, mistura: est?.mistura ?? 0, ativa: !!est?.ativa, H: innerHeight, area: a, inteira: a.inteira,
        faixa: (a.y1 - a.y0) / innerHeight, hMed: hs.length ? hs[hs.length >> 1] : NaN, nJog: hs.length,
        cab: cab ? cab.y / innerHeight : NaN, pes: pes ? pes.y / innerHeight : NaN, bola: X.naQ(pb),
        solido: solidoEm(c.x, c.y, c.z, 0.3, false), perto, cam: { ...c }, chamadas: e0.desenhoChamadas, triangulos: e0.desenhoTriangulos,
      };
    }, [FORMAS, AUX, tipo, opc, cel]);
  }
  if (parte('E')) {
    for (const T of TELAS) {
      const cel = T.chave === 'cel';
      for (const lado of ['ca', 'la']) {
        const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
        try {
          await pagina.goto(`${srv.url}?q=media&semente=4${T.toque ? '&toque=1' : ''}&hora=dia&replay=0&comemoracao=0`, { waitUntil: 'load' });
          await pronta(pagina);
          await pagina.evaluate(() => window.__golaco.bolaParada.carregar());
          const e = await bolaParada(pagina, 'escanteio', { lado, pessoa: true }, cel);
          const tag = `${T.nome}, escanteio ${lado === 'ca' ? 'de cá' : 'de lá'}`;
          if (e.erro || !e.ativa) { meta(`E ${tag}: a câmera atrás do cobrador`, e.erro ?? 'não veio', false); continue; }
          if (PRINTS) await pagina.screenshot({ path: path.join(PRINTS, `escanteio-${T.chave}-${lado}.png`) });
          meta(`E1 ${tag}: a área no quadro; fora do HUD`, `${f1(100 * e.area.quadro)}%; ${f1(100 * e.area.vista)}%`, e.area.quadro >= 0.999 && e.area.vista >= 0.95, '100%; ≥ 95%');
          meta(`E2 ${tag}: a faixa da área na altura da tela`, `${f1(100 * e.faixa)}% (antes 7,7%)`, e.faixa >= 0.18, '≥ 18%');
          const mj = cel ? 18 : 32;
          meta(`E3 ${tag}: os jogadores na área (${e.nJog}), mediana`, `${f1(e.hMed)} px (antes ${cel ? '15,0' : '27,6'})`, e.hMed >= mj, `≥ ${mj} px`);
          meta(`E4 ${tag}: o cobrador inteiro (cabeça; pés, na altura)`, `${f1(100 * e.cab)}%; ${f1(100 * e.pes)}%`, e.cab >= 0.4 && e.pes <= 0.92, 'cabeça ≥ 40%, pés ≤ 92%');
          meta(`E5 ${tag}: nada sólido na lente; o jogador mais perto`, `${e.solido ?? 'livre'}; ${f1(e.perto)} m (lente em ${[e.cam.x, e.cam.y, e.cam.z].map(f1).join(', ')})`, !e.solido && e.perto >= 0.8, 'livre; ≥ 0,8 m');
          if (cel) meta(`E7 ${tag}: o custo do quadro (Média)`, `${e.chamadas} chamadas; ${(e.triangulos / 1000).toFixed(1)} mil triângulos`, e.chamadas <= 40 && e.triangulos <= 130000, '≤ 40; ≤ 130 mil');
          // E6: o cruzamento (LANÇAMENTO segurado 0,5 s) e os 3 s depois
          const D = await pagina.evaluate(([AX]) => {
            const X = eval(AX), g = window.__golaco;
            const L = []; let chute = -1, i = 0;
            g.forcarEntrada({ x: 0, z: 0, botoes: 16 });
            const um = () => {
              g.relogio.avancar(1000 / 60, { desenhar: false }); i++;
              const m = g.mundo;
              if (chute < 0 && (!m.parada || m.parada.rolou)) chute = i;
            };
            for (let k = 0; k < 30; k++) um();
            g.forcarEntrada({ x: 0, z: 0, botoes: 0 });
            let ant = { ...g.render.camera }, mAnt = g.bolaParada?.estado?.mistura ?? 0;
            for (let k = 0; k < 900 && (chute < 0 || i - chute < 180); k++) {
              um();
              const mi = g.bolaParada?.estado?.mistura ?? 0;
              if (chute < 0) { ant = { ...g.render.camera }; mAnt = mi; continue; }
              const m = g.mundo, bo = m.bola.p, pb = g.naTela(bo.x, bo.y, bo.z), c = g.render.camera;
              const naArea = Math.abs(bo.x) >= 36 && Math.abs(bo.z) <= 20.16;
              // (a volta por corte: a mistura cai de uma vez — o escanteio do lado de lá olha para o lado oposto ao da TV)
              L.push({ t: (i - chute) / 60, mistura: mi, corte: mAnt > 0.5 && mi === 0, plano: g.estadio.planoCamera, bola: X.naQ(pb), naArea, inteira: naArea ? X.area(g, Math.sign(bo.x) * 52.5, null).inteira : null, passo: Math.hypot(c.x - ant.x, c.y - ant.y, c.z - ant.z) });
              ant = { ...c }; mAnt = mi;
            }
            g.forcarEntrada(null);
            return L;
          }, [AUX]);
          const jogo = D.filter(x => x.plano === 'jogo' || x.mistura > 0), naA = jogo.filter(x => x.naArea);
          const zero = D.find(x => x.mistura <= 0), antes0 = D.filter(x => !zero || x.t <= zero.t);
          const bolaPct = jogo.length ? jogo.filter(x => x.bola).length / jogo.length : NaN, areaPct = naA.length ? naA.filter(x => x.inteira).length / naA.length : NaN;
          const passoMax = Math.max(0, ...antes0.filter(x => !x.corte).map(x => x.passo)), cortou = D.some(x => x.corte);
          meta(`E6 ${tag}: o cruzamento e os 3 s depois — bola no quadro; a área inteira com a bola nela (${naA.length}); a mistura a 0${cortou ? ' (por corte)' : ''}; maior passo até lá fora do corte`, `${f1(100 * bolaPct)}%; ${f1(100 * areaPct)}%; ${zero ? f2(zero.t) : '–'} s; ${f2(passoMax)} m`, bolaPct >= 0.85 && (!naA.length || areaPct >= 0.9) && !!zero && zero.t <= 1.3 && passoMax <= 2.5 && cortou === (lado === 'la'), '≥ 85%; ≥ 90%; ≤ 1,3 s; ≤ 2,5 m; o corte só no de lá');
          errosTot += erros.length;
        } finally { await navegador.close(); }
      }
    }
  }
  if (parte('E')) {
    // E8 (revisão R5): no Modo Livre a volta do escanteio de lá também é por corte (contra o rumo da câmera dele: a TV do Livre
    // olha como a TV); misturando 180°, a bola saía do quadro de 0,27 a 0,80 s depois do cruzamento (33 de 181 quadros)
    const T = TELAS[0];
    const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
    try {
      await pagina.goto(`${srv.url}?q=media&semente=4${T.toque ? '&toque=1' : ''}&hora=dia&replay=0&comemoracao=0&modo=livre`, { waitUntil: 'load' });
      await pronta(pagina);
      await pagina.evaluate(() => document.getElementById('btn-livre-jogar')?.click());
      await pagina.evaluate(() => window.__golaco.bolaParada.carregar());
      const e = await bolaParada(pagina, 'escanteio', { lado: 'la', pessoa: true }, false);
      if (e.erro || !e.ativa) meta('E8 celular, Modo Livre (TV), escanteio de lá: a câmera atrás do cobrador', e.erro ?? 'não veio', false);
      else {
        const D = await pagina.evaluate(([AX]) => {
          const X = eval(AX), g = window.__golaco, L = [];
          let chute = -1, i = 0;
          const um = () => { g.relogio.avancar(1000 / 60, { desenhar: false }); i++; const m = g.mundo; if (chute < 0 && (!m.parada || m.parada.rolou)) chute = i; };
          g.forcarEntrada({ x: 0, z: 0, botoes: 16 });
          for (let k = 0; k < 30; k++) um();
          g.forcarEntrada({ x: 0, z: 0, botoes: 0 });
          let mAnt = g.bolaParada?.estado?.mistura ?? 0;
          for (let k = 0; k < 900 && (chute < 0 || i - chute < 180); k++) {
            um();
            const mi = g.bolaParada?.estado?.mistura ?? 0;
            if (chute < 0) { mAnt = mi; continue; }
            const bo = g.mundo.bola.p;
            L.push({ bola: X.naQ(g.naTela(bo.x, bo.y, bo.z)), corte: mAnt > 0.5 && mi === 0 });
            mAnt = mi;
          }
          g.forcarEntrada(null);
          return L;
        }, [AUX]);
        const bolaPct = D.length ? D.filter(x => x.bola).length / D.length : NaN, cortou = D.some(x => x.corte);
        meta('E8 celular, Modo Livre (TV), escanteio de lá: o cruzamento e os 3 s depois — bola no quadro; a volta por corte',
          `${f1(100 * bolaPct)}% (${D.length} quadros); ${cortou ? 'corte' : 'misturando'}`, bolaPct >= 0.85 && cortou, '≥ 85%; corte');
      }
      errosTot += erros.length;
    } finally { await navegador.close(); }
  }
  if (parte('F')) {
    for (const T of TELAS) {
      const cel = T.chave === 'cel', ruins = [];
      let n = 0;
      for (const caso of [{ tipo: 'escanteio', opc: { time: 1, lado: 'ca' } }, { tipo: 'escanteio', opc: { time: 1, lado: 'la' } }, { tipo: 'falta', opc: { u: 25 } }]) {
        const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
        try {
          await pagina.goto(`${srv.url}?q=media&semente=4${T.toque ? '&toque=1' : ''}&hora=dia&replay=0&comemoracao=0`, { waitUntil: 'load' });
          await pronta(pagina);
          const e = await bolaParada(pagina, caso.tipo, caso.opc, cel);
          n++;
          const nome = `${caso.tipo === 'falta' ? 'falta a 25 m' : `escanteio ${caso.opc.lado === 'ca' ? 'de cá' : 'de lá'}`}`;
          if (e.erro) ruins.push(`${nome}: ${e.erro}`);
          else if (!(e.inteira && e.bola) || e.mistura > 0.01) ruins.push(`${nome}: área ${e.inteira ? 'inteira' : `${f1(100 * e.area.quadro)}%`}, bola ${e.bola ? 'no quadro' : 'fora'}, mistura ${f2(e.mistura)}, time ${e.time}`);
          if (PRINTS) await pagina.screenshot({ path: path.join(PRINTS, `tv-${T.chave}-${caso.tipo}-${caso.opc.lado ?? 'f'}.png`) });
          errosTot += erros.length;
        } finally { await navegador.close(); }
      }
      meta(`F1 ${T.nome}: a TV na bola parada da IA (escanteio dos 2 lados, falta a 25 m): a área inteira, o gol e a bola no quadro`, `${n - ruins.length}/${n}${ruins.length ? ` (${ruins.join('; ')})` : ''}`, ruins.length === 0, `${n}/${n}`);
    }
  }
  // ================================================================================================ N: de noite
  if (parte('N')) {
    const T = TELAS[0], cams = {};
    for (const hora of ['dia', 'noite']) {
      const { navegador, pagina, erros } = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
      try {
        await pagina.goto(`${srv.url}?q=media&demo=1&semente=4&toque=1&hora=${hora}&replay=0&comemoracao=0`, { waitUntil: 'load' });
        await pronta(pagina);
        cams[hora] = await pagina.evaluate(() => {
          const g = window.__golaco; g.relogio.usarManual(true);
          const out = [];
          for (let k = 0; k < 6; k++) { for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.desenhar(); out.push({ tick: g.mundo.tick, ...g.render.camera }); }
          return out;
        });
        errosTot += erros.length;
      } finally { await navegador.close(); }
    }
    let d = 0;
    cams.dia.forEach((c, i) => { const o = cams.noite[i]; d = Math.max(d, o.tick !== c.tick ? Infinity : Math.hypot(c.x - o.x, c.y - o.y, c.z - o.z)); });
    // (≤ 1 mm, não 0: antes do relógio manual a página anda alguns quadros no relógio de verdade, com dt variável, e a mola
    // guarda um resto que some exponencialmente — 4,6e-5 m no 1º instante, 1e-13 m depois)
    meta(`N ${T.nome}: de noite, os mesmos ticks — render.camera`, `Δ ${d === Infinity ? 'ticks diferentes' : d.toExponential(1)} m`, d <= 1e-3, '≤ 1 mm');
  }
  meta('Nenhum erro no console', `${errosTot}`, errosTot === 0, '0');
} finally { await srv.fechar(); }

console.log(linhas.join('\n'));
console.log(falhas ? `\nteste-camera-tela: REPROVOU (${falhas})` : '\nteste-camera-tela: PASSOU');
process.exit(falhas ? 1 : 0);
