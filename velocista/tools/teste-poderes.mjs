// Teste dos PODERES QUE EVOLUEM COM AS BATALHAS (js/poderes.js; dono, 31/10: "as habilidades ele vai ganhando com as
// batalhas"). Em Node: a experiência de cada vitória, os níveis e os bônus de cada um (só melhoram), o que fica guardado, quem
// já tinha jogado começa com a experiência dos vilões vencidos, e a história inteira (os capítulos de vilão) leva até o último
// nível; e no jogo: os bônus chegam aos golpes, ao dano recebido, à recarga, às esferas e ao embalo, o aviso e a fala do
// rádio de cada nível, e a lista na pausa. Com --navegador: a pausa mostra o nível e as habilidades, sem erros.
// Uso: node velocista/tools/teste-poderes.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const P = await import(pathToFileURL(path.join(RAIZ, 'js/poderes.js')).href);
const mem = (o = {}) => ({ d: { ...o }, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } });

// ---- 1. níveis e bônus ----
ok(P.NIVEIS.length === 10 && P.NIVEIS.every((n, i) => i === 0 || n.xp > P.NIVEIS[i - 1].xp), '10 níveis, cada um pedindo mais experiência');
ok(P.NIVEIS.every((n) => n.nome && n.texto && n.texto.length <= 60), 'cada nível com o nome da habilidade e uma frase curta');
let melhora = true;
for (let n = 2; n <= 10; n++) {
  const a = P.bonusDe(n - 1), b = P.bonusDe(n);
  const mudou = ['forca', 'recarga', 'alcance', 'embalo', 'esfera'].filter((k) => b[k] > a[k]).length + (b.protecao < a.protecao ? 1 : 0);
  if (mudou !== 1 || b.forca < a.forca || b.recarga < a.recarga || b.alcance < a.alcance || b.embalo < a.embalo || b.esfera < a.esfera || b.protecao > a.protecao) melhora = false;
}
ok(melhora, 'cada nível melhora exatamente uma coisa e nada piora');
{ const b = P.bonusDe(10); ok(b.forca === 1.4 && b.recarga === 1.5 && b.alcance === 22 && b.protecao === 0.65 && b.embalo === 1.3 && b.esfera === 2, 'no último nível: golpes ×1,4, recarga ×1,5, alcance 22 m, dano recebido ×0,65, embalo ×1,3, esferas ×2'); }
{ const b = P.bonusDe(1); ok(b.forca === 1 && b.recarga === 1 && b.alcance === 16 && b.protecao === 1 && b.embalo === 1 && b.esfera === 1, 'no nível 1 nada muda do jogo de antes (alcance 16 m como o AVANCO_MAX)'); }

// ---- 2. ganhar e guardar ----
{
  const a = mem(), p = P.criarPoderes({ armazem: a });
  ok(p.nivel === 1 && p.xp === 0, 'começa no nível 1');
  ok(p.ganhar('nocaute').length === 0 && p.xp === 2, 'um nocaute dá 2');
  const novos = p.ganhar('vilao');
  ok(novos.length === 1 && novos[0].nivel === 2 && novos[0].nome === 'Punho relâmpago' && p.bonus.forca === 1.2, 'um vilão vencido dá 100: sobe ao nível 2 (Punho relâmpago)');
  const p2 = P.criarPoderes({ armazem: a, inicial: 9999 });
  ok(p2.xp === 102 && p2.nivel === 2, 'fica guardado (e a experiência inicial só vale para quem ainda não tinha o save)');
  const n3 = p.ganhar('vilao', 3); ok(n3.map((n) => n.nivel).join(',') === '3,4', 'subindo dois níveis de uma vez, os dois aparecem');
  const pr = p.progresso; ok(pr.fracao >= 0 && pr.fracao < 1 && pr.ate === P.NIVEIS[4].xp, `o progresso até o próximo nível (${(pr.fracao * 100).toFixed(0)}%)`);
  const q = P.criarPoderes({ armazem: mem(), inicial: 5000 }); ok(q.nivel === 10 && q.progresso.fracao === 1, 'no último nível o progresso fica cheio');
}
// ---- 3. a história inteira leva até o fim: os capítulos de vilão (sem contar crimes e rivais) chegam perto do topo ----
{
  const viloes = ler('js/viloes.js'), caps = (/export const CAPITULOS = \[([\s\S]*?)\n\];/.exec(viloes)?.[1].match(/\{ id: '/g) || []).length;
  const xp = caps * P.XP.vilao;
  ok(caps >= 15 && P.nivelDe(xp) >= 8 && P.nivelDe(xp + 40 * P.XP.crime + 10 * P.XP.rival) === 10, `os ${caps} capítulos de vilão levam ao nível ${P.nivelDe(xp)}; com os crimes e os rivais pelo caminho, ao 10`);
  ok(P.nivelDe(6 * P.XP.vilao) <= 6, `os 6 primeiros capítulos (Parte 1) não passam do nível 6 (${P.nivelDe(6 * P.XP.vilao)})`);
}
// ---- 4. no jogo ----
const jogo = ler('js/jogo.js'), combate = ler('js/combate.js'), historia = ler('js/historia.js'), vel = ler('js/velocidade.js'), html = ler('index.html');
ok(/const poderes = criarPoderes\(/.test(jogo) && /inicial:/.test(jogo), 'o jogo cria os poderes (com a experiência dos vilões já vencidos)');
ok(/ganharXp\('vilao'\)/.test(jogo) && /ganharXp\('rival'\)/.test(jogo) && /ganharXp\('crime'\)/.test(jogo) && /ganharXp\('nocaute'\)/.test(jogo), 'experiência das quatro vitórias: vilão, rival, crime e nocaute');
ok(/P\.protecao = \(J\.roupa === 'novo' \? ARMADURA : 1\) \* poderes\.bonus\.protecao/.test(jogo), 'o dano recebido (P.protecao, lido pelo combate e pelos vilões)');
ok(/ENERGIA\.recarga \* dt \* \(m < 0\.1 \? 3 : 1\) \* poderes\.bonus\.recarga/.test(jogo) && /ENERGIA\.esfera \* poderes\.bonus\.esfera/.test(jogo), 'a recarga e as esferas');
ok(/ganho: poderes\.bonus\.embalo/.test(jogo) && /SUPER\.sobe \* ganho \* dt/.test(vel), 'o embalo da supervelocidade');
ok(/combate\.definirBonus\(/.test(jogo) && /dano \*= bonus\.forca/.test(combate) && /alvoMaisPerto\(P, dirX, dirZ, bonus\.alcance\)/.test(combate), 'a força dos golpes e o alcance do BATER');
for (let n = 2; n <= 10; n++) if (!new RegExp(`'nivel-${n}': \\[F\\('(caitlin|cisco)'`).test(historia)) { ok(false, `a fala do rádio do nível ${n}`); }
ok(/'nivel-10': \[/.test(historia), 'a Caitlin ou o Cisco explicam cada habilidade nova pelo rádio');
ok(/id="poderes"/.test(html) && /function mostrarPoderes\(/.test(jogo), 'a pausa mostra os poderes');

if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  pagina.setDefaultTimeout(1200000);
  await pagina.addInitScript(() => localStorage.setItem('theflash.poderes.v1', JSON.stringify({ xp: 360 })));
  await pagina.goto(srv.url + '?missao=assalto');
  await pagina.waitForSelector('#btnJogar:not([hidden])');
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.waitForFunction(() => window.__rel.carregados.size >= 9, null, { polling: 500 });
  ok(await pagina.evaluate(() => window.__rel.poderes.nivel === 4 && window.__rel.P.protecao === 1), 'o nível guardado (4) carrega');
  // uma vitória sobre um vilão: sobe para o 5 (Pele de raio), com o aviso
  await pagina.evaluate(() => { window.__rel.historia.calarRadio(); window.__rel.ganharXp('vilao'); window.__rel.ganharXp('vilao'); });
  await pagina.waitForFunction(() => /Pele de raio/.test(document.getElementById('aviso').textContent), null, { polling: 300 });
  await pagina.waitForFunction(() => window.__rel.P.protecao === 0.8, null, { polling: 300 });
  ok(true, 'sobe ao nível 5 com o aviso "Pele de raio" e o dano recebido cai para 80%');
  await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
  const pausa = await pagina.evaluate(() => { const e = document.getElementById('poderes'); return { txt: e.textContent, apr: e.querySelectorAll('.aprendida').length, tot: e.querySelectorAll('.hab').length }; });
  ok(/Nível 5/.test(pausa.txt) && pausa.apr === 5 && pausa.tot === 10, `a pausa: nível 5, 5 de 10 habilidades aprendidas (${pausa.apr}/${pausa.tot})`);
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
