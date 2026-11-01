// Teste da SALA SECRETA do Wells (edição pessoal; dono, 31/10: "na parte do dr wells, tem que ter uma sala secreta, que só
// descobrem depois, onde ele entra, fala com a Gideon e tal. as cenas NÃO podem ser paradas"). Em Node: a planta (lab.js
// COFRE) só existe na edição pessoal — a parede que não está na planta, a porta sólida enquanto fechada, a sala no fundo do
// saguão da ala leste —; as cenas do Wells com a Gideon e o jornal do futuro passam nela; a sala é descoberta no episódio 19.
// Com --navegador (o celular deitado): antes do episódio 19 a porta segura o herói; na cena do episódio 7 o Wells entra pela
// porta escondida andando, a Gideon acende e a câmera fica dentro da sala; depois a porta fecha e o herói volta; com a sala
// descoberta, a porta fica aberta e dá para entrar; na descoberta a equipe está lá dentro; no episódio 20 o Barry fala com a
// Gideon.
// Uso: node velocista/tools/teste-cofre.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const HASH = /const HASH = '([0-9a-f]{64})'/.exec(fs.readFileSync(path.join(RAIZ, 'js/edicao.js'), 'utf8'))[1];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// a planta, nas duas edições (cada uma num processo: a edição é lida uma vez, na carga)
const planta = (pessoal) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  globalThis.localStorage = { getItem: (k) => (k === 'theflash.edicao.v1' && ${pessoal} ? '${HASH}' : null), setItem() {}, removeItem() {} };
  const L = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'js/lab.js')).href)});
  const p = L.planoLab(0, 0), porta = p.rects.filter((q) => q.cofre);
  const s = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'js/serie.js')).href)});
  console.log(JSON.stringify({ parede: L.ANEXO_PAREDES.some((w) => w.id === 'cofre'), sala: L.SALAS.cofre || null, ala: L.SALAS.alaLeste.u, porta,
    dentro: p.dentro(56, 0, 1), saguao: p.dentro(45, 0, 1), banco: L.MOVEIS_ANEXOS.some((m) => m[0] === 51 && m[1] === 55),
    noCofre: [...s.CENAS_NO_COFRE], heroi: [...s.CENAS_COFRE_HEROI],
    falas: Object.fromEntries([...s.CENAS_NO_COFRE, ...s.CENAS_COFRE_HEROI].map((id) => [id, (s.CENAS_SERIE[id] || []).map((f) => (f.quem || '') + ':' + (f.acao || ''))])) }));
`], { encoding: 'utf8' }));
const N = planta(false), S = planta(true);
ok(!N.parede && !N.sala && !N.porta.length && N.ala[1] === 61 && N.banco, 'versão normal: a ala leste como sempre (sem a parede, sem a sala, o banco no lugar)');
ok(S.parede && S.sala && S.ala[1] < 52 && S.dentro === 'cofre' && S.saguao === 'alaLeste' && !S.banco, 'edição pessoal: uma parede que não está em nenhuma planta fecha o fundo do saguão da ala leste; atrás dela, a sala');
ok(S.porta.length === 1 && S.porta[0].y0 <= 0.3 && S.porta[0].y1 >= 4.9 && S.porta[0].z1 - S.porta[0].z0 > 2, 'a porta escondida: sólida (do chão até a verga) enquanto fechada');
ok(['pov-e2', 'pov-e4', 'pov-e7', 'pov-e8', 'pov-e18'].every((id) => S.noCofre.includes(id)) && S.noCofre.every((id) => S.falas[id].some((f) => /^gideon:|jornalFuturo/.test(f))),
  'as cenas do Wells com a Gideon e o jornal do futuro (episódios 2, 4, 7, 8, 18) passam na sala secreta');
ok(S.heroi.includes('depois-s1e19-sala') && S.heroi.includes('ep-20') && S.falas['ep-20'].some((f) => f.startsWith('gideon:')), 'o Barry lá dentro: a descoberta (episódio 19) e a conversa com a Gideon (episódio 20)');
const jogo = ler('js/jogo.js'), cofre = ler('js/cofre3d.js');
ok(/const POS_SALA = PESSOAL \? MISSOES\.findIndex\(\(m\) => m\.id === 's1e19-sala'\)/.test(jogo) && /if \(!J\.cenaCofre\) cofre\.porta\(cofreDescoberto\(\)\)/.test(jogo), 'fechada até a equipe descobrir (o passo "A sala escondida", episódio 19); depois, aberta');
ok(/const ignorarComPorta = \(q\) => q\.cofre/.test(jogo) && /J\.cofreAberto \? ignorarComPorta/.test(jogo), 'a porta aberta não segura o herói (nem a câmera)');
ok(/pessoa: 'linda'/.test(cofre) && /AdditiveBlending/.test(cofre) && /wireframe: true/.test(cofre) && /traje: 'reverso'/.test(cofre) && /DESAPARECE/.test(cofre), 'a Gideon (um rosto holográfico), o jornal do futuro e o traje amarelo na vitrine');
ok(/if \(PESSOAL\) import\('\.\/cofre3d\.js'\)/.test(jogo), 'o desenho da sala só é baixado na edição pessoal');

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
  await pagina.waitForFunction(() => !!window.__rel.cofre && window.__rel.equipe.pronta, null, { polling: 500 });
  // anda para o leste (contra a porta) por uns quadros e devolve onde o herói ficou (u, local do laboratório)
  const empurrarPorta = async () => {
    await pagina.evaluate(() => { const R = window.__rel, w = R.LAB_B.plano.pontosDeInteresse.find((q) => q.nome === 'portaCofre'); Object.assign(R.P, { x: w.x, z: w.z, y: w.y, vx: 0, vz: 0, h: Math.PI / 2 }); R.C.yaw = Math.PI / 2; });
    await quadros(4);
    for (let k = 0; k < 40; k++) { await pagina.evaluate(() => { const R = window.__rel; R.P.vx = 6; R.P.vz = 0; R.P.h = Math.PI / 2; }); await quadros(1); }
    return pagina.evaluate(() => window.__rel.P.x - window.__rel.LAB_B.cx);
  };
  ok(await pagina.evaluate(() => !window.__rel.cofreDescoberto() && !window.__rel.cofre.aberta), 'no começo da temporada a sala é segredo: a porta fechada');
  const u0 = await empurrarPorta();
  ok(u0 < 51.8, `e ela segura o herói do lado de fora (parou em u = ${u0.toFixed(2)}; a parede fica em 52)`);
  // a cena do episódio 7: o Wells entra pela porta escondida e fala com a Gideon
  await pagina.evaluate(() => window.__rel.rodarCena('pov-e7', window.__rel.focosCena(), null, { sempre: true }));
  await quadros(3);
  const ini = await pagina.evaluate(() => { const R = window.__rel, p = R.aliados.pessoas.wells; return { porta: R.cofre.aberta, fora: R.J.heroiFora, u: p ? p.x - R.LAB_B.cx : null }; });
  const linhas = [];
  for (let i = 0; i < 14 && await pagina.evaluate(() => !!window.__rel.historia.cenaAtual); i++) {
    await quadros(10);
    linhas.push(await pagina.evaluate(() => {
      const R = window.__rel, p = R.aliados.pessoas.wells, c = R.camera.position, q = R.historia.quemFala;
      return { q, u: p?.raiz.visible ? p.x - R.LAB_B.cx : null, camU: c.x - R.LAB_B.cx, camV: c.z - R.LAB_B.cz, gideon: !!R.cofre.focoGideon(), quadro: R.estudio?.atual || null };
    }));
    if (linhas.at(-1).q === 'gideon') await pagina.screenshot({ path: '/tmp/teste-cofre-gideon.png' });
    await pagina.evaluate(() => { const h = window.__rel.historia; h.avancar(); h.avancar(); });
  }
  const falas = linhas.filter((l) => l.q === 'wells' || l.q === 'gideon');
  ok(ini.porta && ini.fora && ini.u != null && ini.u < 52, `episódio 7: a porta abre, o herói sai de cena e o Wells começa do lado de fora dela (u = ${ini.u?.toFixed(1)})`);
  ok(falas.length >= 3 && falas.slice(-1)[0].u > 53, `e entra andando na sala (u = ${falas.map((l) => l.u?.toFixed(1)).join(' → ')})`);
  ok(linhas.some((l) => l.q === 'gideon' && l.gideon), 'a Gideon acende quando fala');
  ok(falas.every((l) => l.camU > 50 && l.camU < 61.2 && Math.abs(l.camV) < 5.6), `a câmera fica na sala (não vai para o Cortex): u ${falas.map((l) => l.camU.toFixed(1)).join(', ')}`);
  ok(linhas.every((l) => !l.quadro), 'sem o quadro de vídeo (o Wells está ali)');
  await quadros(4);
  ok(await pagina.evaluate(() => { const R = window.__rel; return !R.J.heroiFora && R.heroi.visible && !R.historia.cenaAtual && !R.J.cenaCofre; }), 'no fim, o herói volta');
  await quadros(30);
  ok(await pagina.evaluate(() => !window.__rel.cofre.aberta), 'e a porta fecha de novo (a sala ainda é segredo)');
  // descoberta: daqui em diante a porta fica aberta e dá para entrar
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e20-plano'));
  await quadros(40);
  ok(await pagina.evaluate(() => window.__rel.cofreDescoberto() && window.__rel.cofre.aberta), 'depois do episódio 19, a porta fica aberta');
  const u1 = await empurrarPorta();
  ok(u1 > 52.4, `e o herói entra na sala (chegou a u = ${u1.toFixed(2)})`);
  // a descoberta: a equipe está lá dentro
  await pagina.evaluate(() => window.__rel.rodarCena('depois-s1e19-sala', window.__rel.focosCena(), null, { sempre: true }));
  await quadros(80);
  ok(await pagina.evaluate(() => { const R = window.__rel, u = (id) => { const f = R.aliados.foco(id); return f ? f.x - R.LAB_B.cx : -99; }; return R.P.x - R.LAB_B.cx > 52.4 && u('cisco') > 52.2 && u('caitlin') > 52.2; }), 'a descoberta: o Barry, a Caitlin e o Cisco dentro da sala');
  await pagina.evaluate(() => window.__rel.historia.pular()); await quadros(3);
  // o episódio 20: o Barry e a Gideon
  await pagina.evaluate(() => window.__rel.rodarCena('ep-20', window.__rel.focosCena(), null, { sempre: true }));
  for (let i = 0; i < 6 && await pagina.evaluate(() => window.__rel.historia.quemFala !== 'gideon'); i++) { await quadros(3); await pagina.evaluate(() => window.__rel.historia.avancar()); }
  await quadros(20);
  ok(await pagina.evaluate(() => { const R = window.__rel, f = R.cofre.focoGideon(); return R.historia.quemFala === 'gideon' && !!f && !R.J.heroiFora; }), 'episódio 20: o Barry na sala, a Gideon acesa falando com ele');
  await pagina.screenshot({ path: '/tmp/teste-cofre-ep20.png' });
  await pagina.evaluate(() => window.__rel.historia.pular()); await quadros(3);
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
