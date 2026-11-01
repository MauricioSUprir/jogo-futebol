// Custo de desenho das arquibancadas (item 69 da FILA: cadeiras e torcida em 3D; informativo, mede antes → depois):
// chamadas de desenho e triângulos (renderer.info) em três situações, no celular deitado (844×390, Média, dpr 2) e no
// PC (1280×720, Alta):
//   TV)       o jogo na câmera de TV (?demo=1): `n` instantes de uma partida da IA, a cada 3 s — mediana e máximo;
//   PERTO)    as câmeras de perto das arquibancadas (a do gol, a de trás do gol, a do canto da comemoração, a do túnel, a
//             das fileiras da frente bem de perto) e o que elas desenham (as cadeiras 3D e, desde o PR 2, os torcedores 3D:
//             g.estadio.cadeiras.torcedores);
//   PREJOGO)  o pior plano do pré-jogo (todos os planos do roteiro completo; no celular, e no PC com --prejogo-pc).
// Com o orçamento de triângulos por quadro (item 69, PR 2: render/cadeiras-dados.js criarOrcamento3D) cada linha diz também
// o resto do quadro (o total menos o 3D de perto) e o orçamento dele.
// Estádios: o padrão (Estádio Golaço) e, com --tm, os da edição pro do Total Match (o Maracanã, os Aflitos e um grande
// da planta genérica).
//   node tools/medir-cadeiras.mjs [--raiz <pasta do jogo>] [--n 12] [--so tv,perto,prejogo] [--tm] [--prints <pasta>]
//                                 [--json <arquivo>] [--prejogo-pc] [--disp celular,pc] [--estadios nome1,nome2 (com --tm)]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const N = +arg('--n', 12);
const SO = new Set(arg('--so', 'tv,perto,prejogo').split(','));
const PRINTS = arg('--prints', null);
const COM_TM = args.includes('--tm');
const DISP = new Set(arg('--disp', 'celular,pc').split(','));
const PREJOGO_PC = args.includes('--prejogo-pc');
if (PRINTS) fs.mkdirSync(PRINTS, { recursive: true });
const SEMENTE = 4;
const med = v => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const k = v => `${(v / 1000).toFixed(1)}k`;
const saida = { raiz, tv: {}, perto: {}, prejogo: {} };

// estádios do Total Match (pedido v2 montado à mão, edição pro: o estádio real do mandante)
// (--estadios a,b,c: os nomes da base no lugar destes 3 — item 69, PR 4: as famílias da planta genérica e um sem forma)
const LISTA_TM = arg('--estadios', null)?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const CASOS_TM = LISTA_TM ? LISTA_TM.map(n => [n, n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')]) : [['Maracanã', 'maracana'], ['Aflitos', 'aflitos'], ['San Siro', 'sansiro']];
async function pedidoTM(contexto) {
  const { PED_A } = await import(new URL('./lib/pedidos-tm.mjs', import.meta.url).href);
  await contexto.addInitScript(lista => { for (const [k2, v] of lista) try { localStorage.setItem(k2, v); } catch (_) { /* nada */ } },
    CASOS_TM.map(([nome, id]) => ['tm3d:pedido:med-' + id, JSON.stringify({ ...PED_A, id: 'med-' + id, edicao: 'pro', home: { ...PED_A.home, stadium: nome } })]));
}
// o modelo do torcedor 3D (PR 2) chega depois do módulo das cadeiras (pedido no 1º quadro) e o impostor da torcida (PR 3) é
// assado depois dele, em fatias no tempo ocioso: espera os dois, se a página tiver (a Baixa não tem nenhum)
const esperaTorcedor = async pg => {
  await pg.waitForFunction(() => { const c = window.__golaco.estadio?.cadeiras; return !c || !c.carregado || !c.torcedores || c.torcedores.carregado; }, null, { timeout: 60000 }).catch(() => {});
  await pg.waitForFunction(() => { const g = window.__golaco; g.desenhar(); const i = g.estadio?.impostor; return !i || i.pronto || i.falhou || !i.spec && i.assando == null && !g.estadio.cadeiras?.torcedores?.carregado; }, null, { timeout: 60000, polling: 100 }).catch(() => {});
};
const ESTADIOS = [['padrao', '']].concat(COM_TM ? CASOS_TM.map(([, id]) => [id, `tm=med-${id}&`]) : []);

// câmeras de perto: [nome, de, para, fov]
const PERTO = [
  ['gol', [-49.5, 1.6, 0], [-80, 8, 0], 60],              // dentro do gol, olhando a arquibancada de trás dele
  ['atras', [-56, 6, -8], [-70, 10, 6], 55],               // atrás do gol, alto, olhando a arquibancada de perto
  ['canto', [48, 1.7, -30], [62, 6, -44], 50],             // comemoração no canto (bandeirinha), de frente para a torcida
  ['lado', [10, 2.2, -36], [14, 9, -52], 55],              // na lateral, a arquibancada de lá de perto
  ['tunel', [0, 3.5, 40], [0, 8, 10], 60],                 // na boca do túnel, olhando o campo (a arquibancada de lá ao fundo)
  ['frente', [8, 3.2, -41.5], [9, 4.6, -47], 50],          // na beira do campo, as fileiras da frente do lado de lá bem de perto
];
// o torcedor 3D (PR 2) num texto curto: quantos, em quantas fileiras de blocos, triângulos e os níveis
const txtTor = t => (t ? ` · torcedores 3D: ${t.torcedores} (${k(t.triangulos)} tri, níveis ${t.lods.join('/')})` : '');
// o orçamento do quadro (PR 2): o resto e o máximo do 3D de perto
const txtOrc = o => (o && o.resto != null ? ` · resto ${k(o.resto)}, orçamento ${Number.isFinite(o.orcamento) ? k(o.orcamento) : '∞'}` : '');
// o impostor (PR 3): blocos e torcedores nele, grupos no programa dele e as pessoas da malha perto (a densidade real)
const txtImp = i => (i && i.pronto ? ` · impostor: ${i.blocos} blocos, ${i.torcedores} torcedores, ${i.torcida.grupos.length} grupos, perto ${i.torcida.perto}` : '');

for (const [nomeDisp, disp] of [['celular', { largura: 844, altura: 390, dpr: 2, toque: true, q: 'media' }], ['pc', { largura: 1280, altura: 720, dpr: 1, toque: false, q: 'alta' }]].filter(([n]) => DISP.has(n))) {
  const srv = await servidor(0, raiz);
  const { navegador, contexto, pagina: pg, erros } = await abrir(disp);
  if (COM_TM) await pedidoTM(contexto);
  try {
    for (const [est, qs] of ESTADIOS) {
      const chave = `${nomeDisp}/${est}`;
      // ---------------------------------------------------------------- TV e PERTO (a partida da IA)
      if (SO.has('tv') || SO.has('perto')) {
        await pg.goto(`${srv.url}?${qs}q=${disp.q}&demo=1${disp.toque ? '&toque=1' : ''}&replay=0&comemoracao=0&prejogo=0&semente=${SEMENTE}&hora=dia`, { waitUntil: 'load', timeout: 180000 });
        await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
        await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: true }); });
        await esperaTorcedor(pg);
        if (SO.has('tv')) {
          const tv = await pg.evaluate(n => {
            const g = window.__golaco, c = [], t = [];
            for (let i = 0; i < n; i++) {
              for (let p = 0; p < 180; p++) g.relogio.avancar(1000 / 60, { desenhar: p === 179 });
              const e = g.estado(); c.push(e.desenhoChamadas); t.push(e.desenhoTriangulos);
            }
            return { c, t };
          }, N);
          saida.tv[chave] = { chamadas: [med(tv.c), Math.max(...tv.c)], triangulos: [med(tv.t), Math.max(...tv.t)] };
          console.log(`TV ${chave}: chamadas med ${med(tv.c)} máx ${Math.max(...tv.c)} · triângulos med ${k(med(tv.t))} máx ${k(Math.max(...tv.t))}`);
          if (PRINTS) await pg.screenshot({ path: path.join(PRINTS, `tv-${nomeDisp}-${est}.png`), timeout: 180000 });
        }
        if (SO.has('perto')) {
          for (const hora of PRINTS ? ['dia', 'noite'] : ['dia']) {
            await pg.evaluate(h => window.__golaco.definirHora(h), hora);
            for (const [nome, de, para, fov] of PERTO) {
              const r = await pg.evaluate(([de2, para2, fov2]) => {
                const g = window.__golaco;
                g.cameraLivre({ de: de2, para: para2, fov: fov2 });
                g.desenhar(); g.desenhar(); g.desenhar();
                const e = g.estado(), cad = g.estadio?.cadeiras ?? null;
                return { c: e.desenhoChamadas, t: e.desenhoTriangulos, cad: cad ? { blocos: cad.blocos, instancias: cad.instancias, torcedores: cad.torcedores ?? null, orcamento: cad.orcamento ?? null } : null, imp: g.estadio?.impostor ?? null };
              }, [de, para, fov]);
              if (hora === 'dia') {
                saida.perto[`${chave}/${nome}`] = r;
                console.log(`PERTO ${chave} ${nome}: chamadas ${r.c} · triângulos ${k(r.t)}${r.cad ? ` · cadeiras: ${r.cad.blocos} blocos, ${r.cad.instancias} instâncias${txtTor(r.cad.torcedores)}${txtOrc(r.cad.orcamento)}` : ''}${txtImp(r.imp)}`);
              }
              if (PRINTS) await pg.screenshot({ path: path.join(PRINTS, `perto-${nome}-${nomeDisp}-${est}-${hora}.png`), timeout: 180000 });
            }
            await pg.evaluate(() => window.__golaco.cameraLivre(null));
          }
          await pg.evaluate(() => window.__golaco.definirHora('dia'));
        }
      }
      // ---------------------------------------------------------------- PREJOGO (só no celular)
      if (SO.has('prejogo') && (nomeDisp === 'celular' || PREJOGO_PC)) {
        await pg.goto(`${srv.url}?${qs}q=${disp.q}&prejogo=1&semente=${SEMENTE}&hora=dia${disp.toque ? '&toque=1' : ''}`, { waitUntil: 'load', timeout: 180000 });
        await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
        const planos = await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); g.prejogo.comecar(); g.relogio.avancar(16); return g.prejogo.planos; });
        await esperaTorcedor(pg);
        const por = [];
        for (const p of planos) {
          const r = await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; pj.irPara(t - 0.04); g.relogio.avancar(16); g.relogio.avancar(16); const d = pj.desenho; const cad = g.estadio?.cadeiras ?? null; const im = g.estadio?.impostor; return { plano: pj.plano, c: d.chamadas, t: d.triangulos, cad: cad ? cad.instancias : null, tor: cad?.torcedores ? cad.torcedores.torcedores : null, imp: im?.pronto ? im.torcedores : null }; }, (p.t0 + p.t1) / 2);
          por.push({ id: p.id, ...r });
          if (PRINTS && ['dentro', 'tunel', 'entrada', 'organizada', 'ladoDeLa', 'visitantes'].includes(p.id)) await pg.screenshot({ path: path.join(PRINTS, `prejogo-${p.id}-${est}.png`), timeout: 180000 });
        }
        const pc = Math.max(...por.map(x => x.c)), pt = Math.max(...por.map(x => x.t));
        saida.prejogo[chave] = { piorChamadas: pc, piorTriangulos: pt, planos: por };
        console.log(`PREJOGO ${chave}: pior ${pc} chamadas, ${k(pt)} triângulos — ${por.map(x => `${x.id} ${x.c}/${Math.round(x.t / 1000)}k${x.cad ? `(${x.cad}${x.tor ? `+${x.tor}` : ''})` : ''}${x.imp ? `[imp ${x.imp}]` : ''}`).join(' ')}`);
      }
    }
    if (erros.length) console.log(`erros no console (${nomeDisp}): ${erros.slice(0, 3).join(' | ')}`);
  } finally {
    await navegador.close();
    await srv.fechar();
  }
}
const js = arg('--json', null);
if (js) fs.writeFileSync(js, JSON.stringify(saida, null, 1));
