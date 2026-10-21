// Prints dos ESTÁDIOS REAIS (navegador; conferência da forma de cada estádio contra a foto e a pesquisa): para cada
// estádio, a edição pro do Total Match (?tm) com ele de mandante, os planos do pré-jogo que mostram o estádio (aéreo,
// fachada, de dentro, geral) e o quadro da câmera de TV do jogo, no celular 844×390 Média de dia. Uma folha por estádio
// em tools/saida/estadios/<chave>.png (5 quadros com o nome) e uma folha geral com o aéreo de todos (aereos.png).
// --json <arquivo>: estádios a mais (ou no lugar) da base, {chave: {nome, forma, ...}} — a base servida ganha eles (as
// formas novas antes de irem para assets/tm/estadios.json). Confere erros no console e que a forma carregou.
//   node tools/prints-estadios.mjs [--chaves a,b,c] [--json extra.json] [--planos aereo,fachada,dentro,geral,jogo] [--q media]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { PED_A } from './lib/pedidos-tm.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SAIDA = process.env.SAIDA_PRINTS ? path.resolve(process.env.SAIDA_PRINTS) : path.join(RAIZ, 'tools', 'saida', 'estadios');
fs.mkdirSync(SAIDA, { recursive: true });
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'tm', 'estadios.json'), 'utf8'));
const extra = arg('--json', null) ? JSON.parse(fs.readFileSync(path.resolve(arg('--json')), 'utf8')) : {};
Object.assign(base.estadios, extra);
const chaves = arg('--chaves', null) ? arg('--chaves').split(',') : Object.keys(extra).length ? Object.keys(extra) : Object.keys(base.estadios).filter(k => base.estadios[k].forma);
const PLANOS = arg('--planos', 'aereo,fachada,dentro,geral,jogo').split(',');
const Q = arg('--q', 'media');

const srv = await servidor(0);
const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
await contexto.route(/assets\/tm\/estadios\.json/, rota => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base) }));
const ids = chaves.map((_, i) => `est-${i}`);
await contexto.addInitScript(lista => { for (const [k, v] of lista) try { localStorage.setItem(k, v); } catch (_) { /* nada */ } },
  chaves.map((c, i) => ['tm3d:pedido:' + ids[i], JSON.stringify({ ...PED_A, id: ids[i], edicao: 'pro', home: { ...PED_A.home, stadium: base.estadios[c].nome } })]));

async function folha(arquivos, destino, col = 5) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const dados = arquivos.map(a => ({ nome: a.nome, b64: fs.readFileSync(a.arq).toString('base64') }));
  const b64 = await aux.evaluate(async ([lista, col]) => {
    const imgs = [];
    for (const d of lista) { const i = new Image(); i.src = 'data:image/png;base64,' + d.b64; await i.decode(); imgs.push(i); }
    const w = 560, h = Math.round(w * imgs[0].height / imgs[0].width), rot = 24;
    const c = document.getElementById('c');
    c.width = Math.min(col, imgs.length) * w; c.height = Math.ceil(imgs.length / col) * (h + rot);
    const g = c.getContext('2d');
    g.fillStyle = '#07090a'; g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, k) => {
      const x = (k % col) * w, y = Math.floor(k / col) * (h + rot);
      g.drawImage(im, x, y, w, h);
      g.fillStyle = '#eaf3ee'; g.font = '700 15px system-ui, sans-serif'; g.fillText(lista[k].nome, x + 8, y + h + 17);
    });
    return c.toDataURL('image/png').split(',')[1];
  }, [dados, col]);
  fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
  await aux.close();
}

const aereos = [], problemas = [];
try {
  for (const [i, chave] of chaves.entries()) {
    const nErros = erros.length;
    await pg.goto(`${srv.url}?tm=${ids[i]}&prejogo=1&semente=7&q=${Q}&hora=dia&toque=1&replay=0&comemoracao=0`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    const est = await pg.evaluate(() => {
      const g = window.__golaco, id = g.identidade;
      g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16);
      if (!g.prejogo) return null;
      g.prejogo.comecar(); g.relogio.avancar(16);
      return { nome: id?.estadio?.nome, forma: id?.forma3d?.planta?.familia ?? null, planos: g.prejogo.planos.map(p => ({ id: p.id, t0: p.t0, t1: p.t1 })) };
    });
    if (!est) { problemas.push(`${chave}: sem pré-jogo`); continue; }
    if (!est.forma) problemas.push(`${chave}: a forma não carregou (${est.nome})`);
    const arqs = [];
    for (const id of PLANOS.filter(p => p !== 'jogo')) {
      const p = est.planos.find(x => x.id === id);
      if (!p) continue;
      const r = await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; pj.irPara(t); g.relogio.avancar(16); g.relogio.avancar(16); const d = pj.desenho; return { cham: d.chamadas, tri: d.triangulos }; }, p.t0 + (p.t1 - p.t0) * 0.6);
      const arq = path.join(SAIDA, `${chave}-${id}.png`);
      await pg.screenshot({ path: arq });
      arqs.push({ nome: `${chave} · ${id} · ${r.cham} cham · ${Math.round(r.tri / 1000)}k tri`, arq });
      if (id === 'aereo') aereos.push({ nome: `${chave} (${est.forma})`, arq });
    }
    if (PLANOS.includes('jogo')) {
      await pg.evaluate(() => { const g = window.__golaco; g.prejogo.pularTudo(); for (let k = 0; k < 40; k++) g.relogio.avancar(16); });
      const arq = path.join(SAIDA, `${chave}-jogo.png`);
      await pg.screenshot({ path: arq });
      arqs.push({ nome: `${chave} · jogo (TV)`, arq });
    }
    if (erros.length > nErros) problemas.push(`${chave}: ${erros.length - nErros} erro(s): ${erros.slice(nErros, nErros + 2).join(' | ')}`);
    if (arqs.length) await folha(arqs, path.join(SAIDA, `${chave}.png`));
    console.log(`${chave}: ${est.nome} · forma ${est.forma ?? 'nenhuma'} · ${arqs.length} quadros`);
  }
  if (aereos.length > 1) await folha(aereos, path.join(SAIDA, 'aereos.png'), 6);
} finally {
  await navegador.close();
  await srv.fechar();
}
console.log(problemas.length ? `\nproblemas:\n  ${problemas.join('\n  ')}` : '\nsem problemas');
console.log(`saída: ${SAIDA}`);
