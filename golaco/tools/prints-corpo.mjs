// Prints LADO A LADO da Etapa 5.1: o manequim (padrão) × o corpo humano (?corpo=novo), no MESMO instante (a mesma
// semente, os mesmos passos com o relógio manual e a mesma câmera nas duas páginas), com a torcida e o HUD:
// PC 1280×720 Alta e celular 844×390 Média (toque), de dia e de noite — o jogo na câmera de TV, de perto, o goleiro
// defendendo (mergulho no contato), o pré-jogo de perto (túnel e fila) e a comemoração do gol.
// Saída: tools/saida/etapa5-corpo/<cena>.png (esquerda: manequim; direita: corpo novo). Fora do git.
//   node tools/prints-corpo.mjs [--so pc-jogo-dia,celular-goleiro-noite]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const iSo = args.indexOf('--so');
const so = iSo >= 0 ? new Set(args[iSo + 1].split(',')) : null;
const SAIDA = path.join(RAIZ, 'tools', 'saida', 'etapa5-corpo');
fs.mkdirSync(SAIDA, { recursive: true });

const PC = { largura: 1280, altura: 720, dpr: 1, toque: false };
const CEL = { largura: 844, altura: 390, dpr: 2, toque: true };
const JOGO_PC = h => `prints=1&replay=0&comemoracao=0&q=alta&hora=${h}&demo=1`;
const JOGO_CEL = h => `prints=1&replay=0&comemoracao=0&q=media&hora=${h}&toque=1&entalhe=1&demo=1`;
const CENAS = [
  { nome: 'pc-jogo-dia', ...PC, url: JOGO_PC('dia'), prep: 'ataque' },
  { nome: 'pc-jogo-noite', ...PC, url: JOGO_PC('noite'), prep: 'ataque' },
  { nome: 'celular-jogo-dia', ...CEL, url: JOGO_CEL('dia'), prep: 'ataque' },
  { nome: 'celular-jogo-noite', ...CEL, url: JOGO_CEL('noite'), prep: 'ataque' },
  { nome: 'pc-perto-dia', ...PC, url: JOGO_PC('dia'), prep: 'ataque', perto: true },
  { nome: 'celular-perto-noite', ...CEL, url: JOGO_CEL('noite'), prep: 'ataque', perto: true },
  { nome: 'pc-goleiro-dia', ...PC, url: 'prints=1&replay=0&comemoracao=0&q=alta&hora=dia&modo=ataque', prep: 'goleiro' },
  { nome: 'pc-goleiro-noite', ...PC, url: 'prints=1&replay=0&comemoracao=0&q=alta&hora=noite&modo=ataque', prep: 'goleiro' },
  { nome: 'celular-goleiro-dia', ...CEL, url: 'prints=1&replay=0&comemoracao=0&q=media&hora=dia&toque=1&entalhe=1&modo=ataque', prep: 'goleiro' },
  { nome: 'celular-goleiro-noite', ...CEL, url: 'prints=1&replay=0&comemoracao=0&q=media&hora=noite&toque=1&entalhe=1&modo=ataque', prep: 'goleiro' },
  { nome: 'pc-prejogo-tunel-dia', ...PC, url: 'prejogo=1&q=alta&hora=dia', prejogo: 'tunel' },
  { nome: 'pc-prejogo-fila-noite', ...PC, url: 'prejogo=1&q=alta&hora=noite', prejogo: 'filaMandante' },
  { nome: 'celular-prejogo-tunel-noite', ...CEL, url: 'prejogo=1&q=media&hora=noite&toque=1&entalhe=1', prejogo: 'tunel' },
  { nome: 'celular-prejogo-fila-dia', ...CEL, url: 'prejogo=1&q=media&hora=dia&toque=1&entalhe=1', prejogo: 'filaMandante' },
  { nome: 'pc-comemoracao-dia', ...PC, url: 'prints=1&replay=0&q=alta&hora=dia&demo=1', prep: 'comemoracao' },
  { nome: 'celular-comemoracao-noite', ...CEL, url: 'prints=1&replay=0&q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'comemoracao' },
];

/** Prepara a cena na página (relógio manual); devolve um texto curto. */
async function preparar(pg, c) {
  if (c.prep === 'comemoracao') {
    await pg.evaluate(() => window.__golaco.comemoracao?.forcarFinal?.('ceu'));
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    return pg.evaluate(ok => {
      const g = window.__golaco, C = g.comemoracao;
      let n = 0;
      while (n < 900 && C.ativa && !(C.estado.fase === 'final' && C.estado.t >= C.estado.kFinal / 60 + 1.0)) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
      const e = C.estado;
      return `gol roteirizado ${ok}; ${e ? `comemoração ${e.variante}, fase ${e.fase}, t ${e.t.toFixed(2)} s, plano ${e.plano}` : 'sem cena'}`;
    }, !!gol?.ok);
  }
  return pg.evaluate(c => {
    const g = window.__golaco;
    if (c.prep === 'ataque') {
      for (let i = 0; i < 3600; i++) {
        const e = g.estado();
        const rolando = !e.relogio || ((!e.parada || e.parada.rolou) && e.relogio.estado === 'jogo');
        if (e.fase === 'ataque' && e.posse != null && e.posse === e.controlado && rolando) break;
        g.relogio.avancar(1000 / 60, { desenhar: false });
      }
      g.relogio.avancar(1000 / 60, { desenhar: true });
      if (c.perto) {
        const j = g.estado().jogador;
        g.cameraLivre({ de: [j.x - 4.2, 1.6, j.z + 3.6], para: [j.x + 0.6, 0.95, j.z], fov: 42 });
      }
      const e = g.estado();
      return `tick ${e.tick}, posse ${e.posse}`;
    }
    if (c.prep === 'goleiro') {
      // chute no canto a ~2 m do goleiro, meia altura, 19 m/s (como o prints.mjs mergulho:contato); para no contato
      const m = g.mundo, gk = m.jogadores.find(j => j.posicao === 'GOL' && j.time === 1);
      const de = m.jogadores.find(j => j.id === m.controlado[0]);
      const b = m.bola;
      const sx = gk.x - 17, sz = gk.z - 3, pz = gk.z + 2.1, py = 0.9, v = 19;
      const kx = (52.5 - sx) / (gk.x - sx), zLinha = sz + (pz - sz) * kx;
      const ux0 = 52.5 - sx, uz0 = zLinha - sz, D = Math.hypot(ux0, uz0), Dg = Math.hypot(gk.x - sx, pz - sz);
      let lo = -0.2, hi = 0.6;
      for (let k = 0; k < 30; k++) { const el = (lo + hi) / 2, t = Dg / (v * Math.cos(el)); if (0.11 + v * Math.sin(el) * t - 4.905 * t * t < py) lo = el; else hi = el; }
      const el = (lo + hi) / 2;
      b.p.x = sx; b.p.y = 0.11; b.p.z = sz;
      b.v.x = (ux0 / D) * v * Math.cos(el); b.v.y = v * Math.sin(el); b.v.z = (uz0 / D) * v * Math.cos(el);
      b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
      m.posse = null; m.naMao = null;
      if (de && de.cond) { de.cond.toque = null; de.cond.busca = false; }
      m.voo = { tipo: 'chute', de: de ? de.id : 0, time: 0, tick0: m.tick, tickChave: m.tick };
      for (let i = 0; i < 150; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const d = gk.mergulho;
        if (d && d.tc != null && m.tick >= d.tc) break;
      }
      g.cameraLivre({ de: [gk.x - 6.5, 1.5, gk.z - 3.2], para: [gk.x - 0.2, 0.75, gk.z + 1.1], fov: 38 });
      const d = gk.mergulho;
      return `goleiro ${gk.id}: ${d ? `${d.tipo}, contato no tick ${d.tc - d.tick0}` : 'sem mergulho'}`;
    }
    return '';
  }, c);
}

async function prejogo(pg, c) {
  if (c.toque) await pg.touchscreen.tap(c.largura / 2, c.altura / 2); else await pg.mouse.click(c.largura / 2, c.altura / 2);
  return pg.evaluate(id => {
    const g = window.__golaco, pj = g.prejogo;
    g.relogio.avancar(16);
    const p = pj.planos.find(q => q.id === id);
    if (!p) return `sem o plano ${id}`;
    pj.irPara(p.t0 + (p.t1 - p.t0) * 0.55);
    g.relogio.avancar(16); g.relogio.avancar(16);
    return `plano ${pj.plano}, ${pj.andantesNaTela()} andantes na tela`;
  }, c.prejogo);
}

async function lado(contexto, c, corpo, srvUrl) {
  const pg = await contexto.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await pg.goto(`${srvUrl}?semente=3&${c.url}${corpo ? '&corpo=novo' : ''}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  const nota = c.prejogo ? await prejogo(pg, c) : await preparar(pg, c);
  await pg.evaluate(() => window.__golaco.desenhar());
  const info = await pg.evaluate(() => { const e = window.__golaco.estado(); return { corpo: e.corpo, j: e.jogadoresDesenho, cham: e.desenhoChamadas, tri: e.desenhoTriangulos }; });
  // máquina dividida: o print pode demorar minutos; uma segunda tentativa redesenha antes
  let png;
  try { png = await pg.screenshot({ type: 'png', timeout: 300000 }); } catch (_) {
    await pg.evaluate(() => window.__golaco.desenhar());
    png = await pg.screenshot({ type: 'png', timeout: 300000 });
  }
  await pg.close();
  return { png, nota, info, erros };
}

async function juntar(contexto, a, b) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const r = await aux.evaluate(async ({ a, b }) => {
    const ler = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i; };
    const [ia, ib] = [await ler(a), await ler(b)];
    const c = document.getElementById('c'); c.width = ia.width * 2 + 8; c.height = ia.height;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(ia, 0, 0); g.drawImage(ib, ia.width + 8, 0);
    const k = Math.max(1, Math.round(ia.height / 720));
    for (const [x, t] of [[0, 'manequim (hoje)'], [ia.width + 8, 'corpo novo (?corpo=novo)']]) {
      g.font = `600 ${16 * k}px sans-serif`;
      const w = g.measureText(t).width;
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x + 8 * k, c.height - 34 * k, w + 16 * k, 26 * k);
      g.fillStyle = '#fff'; g.fillText(t, x + 16 * k, c.height - 15 * k);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { a: a.toString('base64'), b: b.toString('base64') });
  await aux.close();
  return Buffer.from(r, 'base64');
}

const srv = await servidor();
let falhas = 0;
for (const c of CENAS) {
  if (so && !so.has(c.nome)) continue;
  const t0 = Date.now();
  const { navegador, contexto } = await abrir({ largura: c.largura, altura: c.altura, dpr: c.dpr, toque: c.toque });
  try {
    const A = await lado(contexto, c, false, srv.url);
    const B = await lado(contexto, c, true, srv.url);
    const arq = path.join(SAIDA, `${c.nome}.png`);
    fs.writeFileSync(arq, await juntar(contexto, A.png, B.png));
    const ok = B.info.corpo === 'corpo' && A.info.corpo === 'manequim' && !A.erros.length && !B.erros.length;
    if (!ok) falhas++;
    const jt = x => (x.j ? `${x.j.chamadas}+${x.j.chamadasSombra} cham., ${(x.j.tri / 1000).toFixed(1)}+${(x.j.triSombra / 1000).toFixed(1)} mil tri` : '-');
    console.log(`${ok ? 'ok  ' : 'ERRO'} ${c.nome} (${((Date.now() - t0) / 1000).toFixed(0)} s): ${B.nota} | manequim ${jt(A.info)} (${A.info.cham} cham. no quadro) | corpo ${jt(B.info)} (${B.info.cham} cham.)${A.erros.length + B.erros.length ? ' | erros: ' + [...A.erros, ...B.erros].slice(0, 2).join(' | ') : ''}`);
    if (A.nota !== B.nota) console.log(`     (atenção: as duas páginas não chegaram ao mesmo ponto: "${A.nota}" × "${B.nota}")`);
  } catch (e) {
    falhas++;
    console.log(`ERRO ${c.nome}: ${e.message.split('\n')[0]}`);
  } finally {
    await navegador.close();
  }
}
await srv.fechar();
console.log(`\nprints em ${SAIDA}${falhas ? ` — ${falhas} cena(s) com problema` : ''}`);
process.exit(falhas ? 1 : 0);
