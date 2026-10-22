// Corpo humano no jogo (Etapa 5.1b, ?corpo=humano): no navegador, celular 844×390 na Média (a régua) e PC 1280×720 Alta.
//   C0 o corpo carrega sozinho (sob demanda) e desenha TODOS os bonecos da lista (os 22 e os treinadores): a soma dos
//      níveis = os bonecos; o manequim some (0 cápsulas);
//   C1 chamadas de desenho na TV do celular com o corpo humano ≤ as do manequim + 1 (os 4 níveis, no máximo 3 com gente);
//   C2 triângulos dos jogadores ≤ o teto da qualidade (Média 60 mil, Alta 120 mil) em todo quadro de 10 s de jogo;
//   C3 sem o ?corpo=humano nada muda: o corpo não é baixado (nenhum pedido a assets/jogador nem a humano3d.js);
//   C8 sem erro no console (shader, textura, carga) nas duas telas.
// Na versão sem o corpo humano reprova (C0).
//   node tools/teste-corpo-tela.mjs
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const srv = await servidor(0, RAIZ);
const CEL = { largura: 844, altura: 390, dpr: 1, toque: true };
const URL0 = '?demo=1&semente=4&hora=dia&replay=0&comemoracao=0';

async function abrirPagina(opc, url) {
  const nav = await abrir(opc);
  const pedidos = [];
  nav.pagina.on('request', r => pedidos.push(r.url()));
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  return { ...nav, pedidos };
}
async function medir(nav, quadros = 600) {
  return nav.pagina.evaluate(async q => {
    const g = window.__golaco;
    g.relogio.usarManual(true);
    let maxTri = 0, maxCham = 0, somaOk = true, bonecosMin = 99, n = 0;
    const cham = [];
    for (let i = 0; i < q; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: i % 10 === 0 });
      if (i % 10) continue;
      const e = g.estado(), c = g.estadio.corpo;
      cham.push(e.desenhoChamadas);
      if (c?.pronto) {
        n++;
        maxTri = Math.max(maxTri, c.triangulos);
        if (c.niveis.reduce((a, b) => a + b, 0) !== c.bonecos) somaOk = false;
        bonecosMin = Math.min(bonecosMin, c.bonecos);
      }
    }
    cham.sort((a, b) => a - b);
    return { maxTri, somaOk, bonecosMin, n, chamMed: cham[cham.length >> 1], chamMax: cham[cham.length - 1], corpo: g.estadio.corpo, jogadores: g.estado().jogadores };
  }, quadros);
}

const erros = [];
let humanoCel = null, maneqCel = null;
try {
  const A = await abrirPagina(CEL, URL0 + '&q=media&toque=1&corpo=humano');
  await A.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 120000 }).catch(() => {});
  humanoCel = await medir(A);
  erros.push(...A.erros.map(e => 'celular humano: ' + e));
  await A.navegador.close();
} catch (e) { erros.push('celular humano: ' + e.message); }
try {
  const B = await abrirPagina(CEL, URL0 + '&q=media&toque=1');
  await B.pagina.waitForTimeout(1500);
  maneqCel = await medir(B, 300);
  const baixou = B.pedidos.filter(u => /assets\/jogador\/|humano3d\.js|esqueleto\.js|corpo-dados\.js/.test(u));
  meta('C3 sem ?corpo=humano o corpo não é baixado', baixou.length ? baixou.map(u => u.split('/').pop()).join(', ') : 'nenhum pedido', 'nenhum pedido', baixou.length === 0);
  erros.push(...B.erros.map(e => 'celular manequim: ' + e));
  await B.navegador.close();
} catch (e) { erros.push('celular manequim: ' + e.message); }
let pc = null;
try {
  const C = await abrirPagina({ largura: 1280, altura: 720 }, URL0 + '&q=alta&corpo=humano');
  await C.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 120000 }).catch(() => {});
  pc = await medir(C, 300);
  erros.push(...C.erros.map(e => 'PC humano: ' + e));
  await C.navegador.close();
} catch (e) { erros.push('PC humano: ' + e.message); }

const h = humanoCel;
meta('C0 o corpo humano carrega e desenha todos os bonecos (soma dos níveis = bonecos; ≥ 22)',
  h ? `pronto ${!!h.corpo?.pronto}${h.corpo?.erro ? ' erro ' + h.corpo.erro : ''}; ${h.n} quadros medidos; bonecos ≥ ${h.bonecosMin}; soma ${h.somaOk ? 'certa' : 'ERRADA'}` : 'não abriu',
  'pronto; soma certa; ≥ 22', h && h.corpo?.pronto && h.somaOk && h.bonecosMin >= 22 && h.n > 10);
meta('C1 chamadas de desenho na TV do celular: humano ≤ manequim + 1',
  h && maneqCel ? `humano mediana ${h.chamMed} (máx ${h.chamMax}); manequim ${maneqCel.chamMed} (máx ${maneqCel.chamMax})` : 'sem medida',
  '≤ manequim + 1', h && maneqCel && h.chamMed <= maneqCel.chamMed + 1);
meta('C2 triângulos dos jogadores ≤ o teto (Média 60 mil no celular, Alta 120 mil no PC)',
  `celular ${h?.maxTri ?? '-'}; PC ${pc?.maxTri ?? '-'}`, '≤ 60000; ≤ 120000', h && pc && h.maxTri <= 6e4 && pc.maxTri <= 1.2e5 && pc.corpo?.pronto);
meta('C8 sem erro no console', erros.length ? erros.slice(0, 3).join(' | ').slice(0, 300) : '0', '0', erros.length === 0);

const L = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(L)}  ${r.medido}   (alvo: ${r.alvo})`);
const falhou = res.some(r => !r.ok);
console.log(`\nteste-corpo-tela: ${falhou ? 'REPROVOU' : 'PASSOU'}`);
srv.fechar?.();
process.exit(falhou ? 1 : 0);
