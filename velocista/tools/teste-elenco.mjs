// Teste do ELENCO DA TEMPORADA e das cenas com movimento (edição pessoal; dono, 31/10: "todas as cenas tem que ter movimento,
// e todos os personagens terem seu boneco ... as cenas NÃO podem ser paradas"). Em Node: todo personagem que fala nas cenas
// da temporada tem corpo (o elenco de aliados.js, a equipe do Cortex, o homem de amarelo; a TV e a Gideon à parte), com os
// arquivos (corpo, roupa, rosto), o retrato da caixa de fala e a escala; a versão normal não ganha nada disso.
// Com --navegador (o celular deitado): numa cena na rua, quem fala e não estava lá entra andando e para a uns 2–4 m do herói,
// fora de parede; a câmera anda em toda fala; a Caitlin falando do laboratório aparece no quadro de vídeo do Cortex; a TV
// também; no fim da cena, o elenco sai; a versão normal sem o quadro.
// Uso: node velocista/tools/teste-elenco.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const HASH = /const HASH = '([0-9a-f]{64})'/.exec(fs.readFileSync(path.join(RAIZ, 'js/edicao.js'), 'utf8'))[1];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// ---- 1. quem fala tem corpo ----
const falantes = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  globalThis.localStorage = { getItem: (k) => (k === 'theflash.edicao.v1' ? '${HASH}' : null), setItem() {}, removeItem() {} };
  const s = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'js/serie.js')).href)});
  const q = {}; for (const [id, fs] of Object.entries(s.CENAS_SERIE)) for (const f of fs) if (!f.cartao) (q[f.quem] ||= []).push(id);
  console.log(JSON.stringify(q));
`], { encoding: 'utf8' }));
const aliados = ler('js/aliados.js'), humano = ler('js/humano.js'), historia = ler('js/historia.js'), jogo = ler('js/jogo.js');
const ELENCO = JSON.parse(/export const ELENCO = (\[[^\]]+\])/.exec(aliados)[1].replace(/'/g, '"'));
const EQUIPE = ['caitlin', 'cisco', 'wells'], ESPECIAIS = ['heroi', 'tv', 'gideon', 'thawne', 'reverso'];
const PERFIS_FIXOS = ['joe', 'iris', 'cigarra', 'violeta', 'vulto', 'negro', 'mago', 'mark', 'frio', 'onda'];
const semCorpo = Object.keys(falantes).filter((q) => !ELENCO.includes(q) && !EQUIPE.includes(q) && !ESPECIAIS.includes(q) && !PERFIS_FIXOS.includes(q));
ok(!semCorpo.length, `todo personagem que fala nas cenas da temporada tem corpo (${Object.keys(falantes).length} personagens; sem corpo: ${semCorpo.join(', ') || 'nenhum'})`);
const faltaArq = ELENCO.filter((id) => !['corpo.bin', 'corpo.json', 'corpo.webp', 'cabeca.webp'].every((f) => fs.existsSync(path.join(RAIZ, 'assets/personagens', id, f))));
ok(ELENCO.length >= 20 && !faltaArq.length, `o elenco novo (${ELENCO.length}) com corpo, roupa e rosto (${faltaArq.join(', ') || 'todos'})`);
const semRetrato = ELENCO.filter((id) => !fs.existsSync(path.join(RAIZ, 'assets/personagens/retratos', `${id}.webp`)));
ok(!semRetrato.length && ELENCO.every((id) => historia.includes(`'${id}'`)), `cada um com o retrato da caixa de fala (${semRetrato.join(', ') || 'todos'})`);
ok(ELENCO.every((id) => new RegExp(`\\b${id}: \\{ escala: [0-9.]+ \\}`).test(humano)) && /crianca: \{ escala: 0\.7/.test(humano) && /grodd: \{ escala: 1\.[3-6]/.test(humano), 'a escala de cada um (o Barry de 11 anos menor, o Grodd bem maior)');
ok(ELENCO.every((id) => ler('assets/personagens/CREDITOS.md').includes(`\`${id}/\``)), 'os créditos de cada corpo (Rocketbox, MIT)');
ok(/if \(PESSOAL\) \{\s*for \(const id of ELENCO\) PERFIS\[id\]/.test(aliados), 'o elenco só existe na edição pessoal (a versão normal não muda)');
ok(/function encenar\(ids, centro, livre/.test(aliados) && /function encenarElenco\(id, foco\)/.test(jogo) && /if \(PESSOAL && \(historia\.vaiTocar\(id\) \|\| opc\?\.sempre\)\) encenarElenco\(id, foco\)/.test(jogo) && /aliados\.dispensar\(\)/.test(jogo),
  'quem fala e não está na cena entra andando no começo dela; no fim, sai');
ok(/const M = PESSOAL \? 1 : 0/.test(historia) && /px \+= 0\.022 \* Math\.sin/.test(historia), 'na edição pessoal a câmera das cenas nunca fica parada (aproxima, gira em volta, câmera na mão)');
ok(/function cameraDaCenaLivre\(\)/.test(jogo) && /else cameraDaCenaLivre\(\);/.test(jogo) && /get alvoCamera\(\)/.test(historia), 'a câmera das cenas não entra em parede (as imagens vazias: o céu, a rua, um muro)');
ok(/import\('\.\/estudio\.js'\)/.test(jogo) && /if \(PESSOAL\) import\('\.\/estudio\.js'\)/.test(jogo), 'o quadro de vídeo (estudio.js) só é baixado na edição pessoal');

// ---- 2. no navegador ----
if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  pagina.setDefaultTimeout(1200000);
  await pagina.addInitScript((h) => {
    localStorage.setItem('theflash.edicao.v1', h); localStorage.setItem('theflash.serie.versao', '2');
    localStorage.setItem('theflash.serie.historia.v1', JSON.stringify({ vistas: ['cena:noite-do-raio', 'cena:prologo'], capitulo: null }));
  }, HASH);
  await pagina.goto(srv.url + '?historia=1');
  await pagina.waitForSelector('#btnJogar:not([hidden])');
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  for (let i = 0; i < 20 && await pagina.evaluate(() => window.__rel.J.modo !== 'jogando'); i++) { await pagina.evaluate(() => window.__rel.historia.pular()); await pagina.waitForTimeout(800); }
  await pagina.evaluate(() => window.__rel.historia.calarRadio());
  await pagina.waitForFunction(() => !!window.__rel.estudio, null, { polling: 500 });
  const camPos = () => pagina.evaluate(() => { const c = window.__rel.camera.position; return [c.x, c.y, c.z]; });
  // roda uma cena numa praça aberta e devolve, por fala: quem fala, a distância dele ao herói, o quanto a câmera andou e o quadro
  async function rodar(id, extra = () => null) {
    await pagina.evaluate(() => { const R = window.__rel, w = R.pontoMundo('prefeitura'); Object.assign(R.P, { x: w.x, z: w.z, vx: 0, vz: 0 }); });
    await quadros(6);
    await pagina.evaluate((id) => window.__rel.rodarCena(id, window.__rel.focosCena(), null, { sempre: true }), id);
    const linhas = [];
    for (let i = 0; i < 40 && await pagina.evaluate(() => !!window.__rel.historia.cenaAtual); i++) {
      await quadros(4);
      const a = await camPos(); await quadros(8); const b = await camPos();
      linhas.push({ ...(await pagina.evaluate(() => {
        const R = window.__rel, q = R.historia.quemFala, f = q && R.historia.pontoDe(q), cartao = !!R.historia.cartaoAtual;
        const qv = document.getElementById('quadroVideo');
        return { q, cartao, d: f ? Math.hypot(f.x - R.P.x, f.z - R.P.z) : null, quadro: R.estudio?.atual || null, qvVisivel: !!qv && !qv.hidden && qv.offsetWidth > 50, elenco: R.aliados.emCena };
      })), andou: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), extra: await extra() });
      await pagina.evaluate(() => { const h = window.__rel.historia; h.avancar(); h.avancar(); });
    }
    await quadros(3);
    return linhas;
  }
  const banco = await rodar('depois-s1e1-banco');
  const ol = banco.filter((l) => l.q === 'oliver'), jo = banco.filter((l) => l.q === 'joe');
  ok(ol.length >= 2 && ol.every((l) => l.d != null && l.d > 1.2 && l.d < 4.8) && jo.every((l) => l.d != null && l.d < 6), `episódio 1: o Joe e o Oliver em cena, perto do Barry (Oliver a ${ol.map((l) => l.d?.toFixed(1)).join('/')} m)`);
  const falas = banco.filter((l) => !l.cartao);
  ok(falas.length >= 6 && falas.every((l) => l.andou > 0.015), `a câmera anda em toda fala (o menor movimento: ${Math.min(...falas.map((l) => l.andou)).toFixed(3)} m em 8 quadros)`);
  ok(await pagina.evaluate(() => !window.__rel.aliados.emCena.length && !window.__rel.aliados.foco('oliver')), 'no fim da cena, o elenco sai');
  ok(await pagina.evaluate(() => { const R = window.__rel; return ['oliver', 'joe'].every((id) => { const p = R.aliados.pessoas[id]; return !p || !p.raiz.visible; }); }), 'e ninguém fica de pé na rua depois');
  const desc = await rodar('depois-s1e1-descontrole');
  const ca = desc.filter((l) => l.q === 'caitlin');
  ok(ca.length && ca.every((l) => l.quadro === 'caitlin' && l.qvVisivel), `a Caitlin falando do laboratório: o quadro de vídeo do Cortex com ela (${ca.map((l) => l.quadro).join(',')})`);
  ok(desc.filter((l) => l.q === 'heroi').every((l) => !l.qvVisivel), 'e o quadro some quando é o Barry que fala');
  // a TV ao vivo (a abertura)
  await pagina.evaluate(() => { window.__rel.estudio.mostrar('tv'); });
  await quadros(4);
  ok(await pagina.evaluate(() => { const q = document.getElementById('quadroVideo'); return !q.hidden && q.classList.contains('tv') && /AO VIVO/.test(q.textContent); }), 'a TV: o quadro "AO VIVO" com o S.T.A.R. Labs');
  await pagina.screenshot({ path: '/tmp/teste-elenco-tv.png' });
  await pagina.evaluate(() => { window.__rel.estudio.mostrar(null); });
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  // a versão normal: nada disso
  await pagina.evaluate(() => localStorage.removeItem('theflash.edicao.v1'));
  await pagina.reload();
  await pagina.waitForSelector('#btnJogar:not([hidden])');
  await pagina.waitForTimeout(3000);
  ok(await pagina.evaluate(() => window.__rel.PESSOAL === false && !document.getElementById('quadroVideo') && !window.__rel.estudio), 'versão normal: sem o quadro de vídeo nem o elenco');
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
