// Corpo humano no jogo (Etapa 5.1b, ?corpo=humano): no navegador, celular 844×390 na Média (a régua) e PC 1280×720 Alta.
//   C0 o corpo carrega sozinho (sob demanda) e desenha TODOS os bonecos da lista (os 22 e os treinadores): a soma dos
//      níveis = os bonecos; o manequim some (0 cápsulas);
//   C1 chamadas de desenho na TV do celular com o corpo humano ≤ as do manequim + 1 (os 4 níveis, no máximo 3 com gente);
//   C2 triângulos dos jogadores ≤ o teto da qualidade (Média 60 mil, Alta 120 mil) em todo quadro de 10 s de jogo;
//   C3 sem o ?corpo=humano nada muda: o corpo não é baixado (nenhum pedido a assets/jogador nem a humano3d.js);
//   C4 rostos reais (Etapa 5.2, a versão de teste da edição PRO do TM): num pedido pro com jogadores do índice
//      (assets/rostos-reais/br.json), cada um com rosto real pede a textura dele e todas carregam (carregados = pedidos ≥ 3);
//   C5 na edição PÚBLICA (o mesmo pedido) e sem o TM nada de rosto real é pedido (nenhum pedido a assets/rostos-reais);
//   C6 patrocínios (só a versão de teste da pro): no mesmo pedido pro, as máscaras dos logos das camisas reais são
//      pedidas e todas carregam (carregados = pedidos ≥ 3); C7 na pública nada de patrocínio é pedido;
//   C8 sem erro no console (shader, textura, carga) nas duas telas;
//   C9 a NUCA de costas (item 62: "linha escura na nuca dos jogadores vistos de costas"): no mesmo pedido pro, a câmera a
//      1 m atrás (e a 3/4 atrás) da cabeça de um jogador com rosto real, a página parada, o MESMO quadro desenhado com o
//      mapa de normais do pano (normalScale 0,8, o de sempre) e sem ele (0): no disco do meio da tela (só cabeça), o |ΔL*|
//      p99 ≤ 2 — a cabeça não usa o mapa de normais do CORPO (lido pela UV da cabeça, ele punha um arco escuro de orelha a
//      orelha, uma faixa e um "V" na nuca e rugas no rosto; na base: p99 ~11–28).
// Na versão sem o corpo humano reprova (C0); na base do item 62 (7cb052ad) reprova o C9.
//   node tools/teste-corpo-tela.mjs [--so-pro] [--prints <pasta>]   (--so-pro: só o pedido pro — C4, C6, C8 e C9; --prints:
//   grava os closes do C9)
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { timeTM } from './lib/pedidos-tm.mjs';

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const srv = await servidor(0, RAIZ);
const CEL = { largura: 844, altura: 390, dpr: 1, toque: true };
const URL0 = '?demo=1&semente=4&hora=dia&replay=0&comemoracao=0';
const SO_PRO = process.argv.includes('--so-pro');
const PRINTS = process.argv.includes('--prints') ? process.argv[process.argv.indexOf('--prints') + 1] : null; // os closes do C9 (conferência)

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
if (!SO_PRO) try {
  const A = await abrirPagina(CEL, URL0 + '&q=media&toque=1&corpo=humano');
  await A.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 120000 }).catch(() => {});
  humanoCel = await medir(A);
  erros.push(...A.erros.map(e => 'celular humano: ' + e));
  await A.navegador.close();
} catch (e) { erros.push('celular humano: ' + e.message); }
if (!SO_PRO) try {
  const B = await abrirPagina(CEL, URL0 + '&q=media&toque=1');
  await B.pagina.waitForTimeout(1500);
  maneqCel = await medir(B, 300);
  const baixou = B.pedidos.filter(u => /assets\/jogador\/|assets\/rostos-reais\/|humano3d\.js|esqueleto\.js|corpo-dados\.js/.test(u));
  meta('C3 sem ?corpo=humano o corpo não é baixado', baixou.length ? baixou.map(u => u.split('/').pop()).join(', ') : 'nenhum pedido', 'nenhum pedido', baixou.length === 0);
  erros.push(...B.erros.map(e => 'celular manequim: ' + e));
  await B.navegador.close();
} catch (e) { erros.push('celular manequim: ' + e.message); }
let pc = null;
if (!SO_PRO) try {
  const C = await abrirPagina({ largura: 1280, altura: 720 }, URL0 + '&q=alta&corpo=humano');
  await C.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 120000 }).catch(() => {});
  pc = await medir(C, 300);
  erros.push(...C.erros.map(e => 'PC humano: ' + e));
  await C.navegador.close();
} catch (e) { erros.push('PC humano: ' + e.message); }

// rostos reais: um pedido do TM (pro e pública) com os jogadores de um clube do índice (o nome do clube e o do jogador
// dão a chave "br-<clube>__<jogador>", como as fotos do TM)
const arqIndice = path.join(RAIZ, 'assets/rostos-reais/br.json');
const indice = fs.existsSync(arqIndice) ? JSON.parse(fs.readFileSync(arqIndice, 'utf8')) : {};
const porClube = {};
for (const [k, v] of Object.entries(indice)) { const [cl] = k.slice(3).split('__'); (porClube[cl] ??= []).push(v.nome); }
const [clube, nomes] = Object.entries(porClube).sort((a, b) => b[1].length - a[1].length)[0] ?? ['', []];
function pedidoRostos(edicao) {
  const casa = timeTM(clube.replace(/-/g, ' '), 'CAS', '4-3-3', 80, 11), fora = timeTM('Visitante Teste', 'VIS', '4-2-3-1', 80, 23);
  casa.players.forEach((p, i) => { if (nomes[i]) p.nomeCompleto = nomes[i]; });
  return { v: 2, id: 'rr' + edicao, titulo: 'R', origem: 'teste', userSide: 'home', controle: null, edicao,
    partida: { neutro: true, publico: 0.8, classico: false, nomeClassico: null, competicao: 'Teste' }, home: casa, away: fora };
}
/**
 * C9: closes da cabeça de costas de um jogador com rosto real, o mesmo quadro com e sem o mapa de normais do pano (o
 * normalScale do material do corpo, achado na cena pela torcida): o |ΔL*| no disco do meio da tela (só cabeça).
 */
async function nucaDeCostas(pg) {
  await pg.evaluate(() => {
    const g = window.__golaco;
    g.relogio.usarManual(true);
    g.pausar(true);
    document.documentElement.classList.add('sem-hud');
  });
  // um jogador de linha da casa (os rostos reais) — o 6º da lista; a câmera olha a CABEÇA da pose do jogo (anim.js)
  const alvo = await pg.evaluate(async () => {
    const g = window.__golaco, A = await import(new URL('js/anim.js', location.href).href);
    const js = g.mundo.jogadores.filter(j => j.time === 0 && !j.goleiro);
    const j = js[Math.min(5, js.length - 1)];
    if (!j) return null;
    const po = A.pose(j, g.mundo, new Float32Array(A.NJ * 3)), c = A.J.cabeca * 3;
    return { id: j.id, x: po[c], y: po[c + 1], z: po[c + 2], rumo: j.rumo };
  });
  if (!alvo) return { erro: 'sem jogador' };
  const vistas = [];
  for (const [nome, ang] of [['costas', Math.PI], ['3/4 atrás', Math.PI * 0.78]]) {
    const a = alvo.rumo + ang;
    const ok = await pg.evaluate(([de, para]) => {
      const g = window.__golaco;
      g.cameraLivre({ de, para, fov: 22 });
      // o material do corpo novo: a cena pela torcida (subindo até a raiz)
      let o = g.estadio.torcidaObj?.mesh ?? null;
      while (o && o.parent) o = o.parent;
      const malha = o?.getObjectByName?.('humano-lod0');
      window.__matCorpo = malha?.material ?? null;
      g.relogio.avancar(0.01); g.desenhar();
      return !!window.__matCorpo?.normalScale;
    }, [[alvo.x + Math.cos(a), alvo.y + 0.06, alvo.z + Math.sin(a)], [alvo.x, alvo.y, alvo.z]]);
    if (!ok) return { erro: 'material do corpo não achado' };
    // (a captura do Chromium sem GPU é lenta com a máquina carregada: o prazo largo, como no teste-cenas-tela)
    const com = (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
    await pg.evaluate(() => { const m = window.__matCorpo; m.__ns = m.normalScale.x; m.normalScale.set(0, 0); window.__golaco.desenhar(); });
    const sem = (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
    if (PRINTS) { fs.mkdirSync(PRINTS, { recursive: true }); const n = nome.replace(/\W+/g, '-'); fs.writeFileSync(path.join(PRINTS, `nuca-${n}-com.png`), Buffer.from(com, 'base64')); fs.writeFileSync(path.join(PRINTS, `nuca-${n}-sem.png`), Buffer.from(sem, 'base64')); }
    await pg.evaluate(() => { const m = window.__matCorpo; m.normalScale.set(m.__ns, m.__ns); window.__golaco.desenhar(); });
    const r = await pg.evaluate(async ([a, b]) => {
      const ler = async s => {
        const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g2 = c.getContext('2d'); g2.drawImage(img, 0, 0);
        return { d: g2.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      };
      const A = await ler(a), B = await ler(b);
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (d, i) => { const Y = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
      // o disco do meio: 0,065 m em volta do ponto olhado (a 1 m com 22° de campo: ~120 px na altura de 720)
      const cx = A.w / 2, cy = A.h / 2, raio = 0.065 / Math.tan(11 * Math.PI / 180) * (A.h / 2);
      const dl = [];
      for (let y = Math.floor(cy - raio); y <= cy + raio; y++) for (let x = Math.floor(cx - raio); x <= cx + raio; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > raio * raio) continue;
        const i = (y * A.w + x) * 4;
        dl.push(Math.abs(L(A.d, i) - L(B.d, i)));
      }
      dl.sort((p, q) => p - q);
      const pc = f => dl[Math.min(dl.length - 1, Math.floor(f * dl.length))];
      return { n: dl.length, p50: pc(0.5), p95: pc(0.95), p99: pc(0.99), max: dl[dl.length - 1] };
    }, [com, sem]);
    vistas.push({ nome, ...r });
  }
  return { id: alvo.id, vistas };
}
async function rostosNoPedido(edicao) {
  const ped = pedidoRostos(edicao);
  const nav = await abrir({ largura: 1280, altura: 720 });
  await nav.contexto.addInitScript(([id, j]) => { localStorage.setItem('tm3d:pedido:' + id, j); }, [ped.id, JSON.stringify(ped)]);
  const pedidos = [];
  nav.pagina.on('request', r => pedidos.push(r.url()));
  await nav.pagina.goto(srv.url + `index.html?tm=${ped.id}&q=media&replay=0&comemoracao=0&prejogo=0&hora=dia&corpo=humano`, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await nav.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 120000 }).catch(() => {});
  await nav.pagina.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60); });
  // as texturas entram uma a uma, a cada quadro: espera todas (ou 20 s)
  await nav.pagina.waitForFunction(() => { const c = window.__golaco.estadio.corpo, r = c?.rostos, l = c?.logos; window.__golaco.relogio.avancar(1000 / 60); return r && r.pedidos > 0 && r.carregados >= r.pedidos && l && l.pedidos > 0 && l.carregados >= l.pedidos; }, null, { timeout: 20000, polling: 100 }).catch(() => {});
  const r = await nav.pagina.evaluate(() => window.__golaco.estadio.corpo?.rostos ?? null);
  const lg = await nav.pagina.evaluate(() => window.__golaco.estadio.corpo?.logos ?? null);
  let nuca = null;
  if (edicao === 'pro') { try { nuca = await nucaDeCostas(nav.pagina); } catch (e) { nuca = { erro: e.message }; } }
  const err = nav.erros.slice();
  await nav.navegador.close();
  return { r, lg, nuca, err, baixou: pedidos.filter(u => /assets\/rostos-reais\//.test(u)), baixouPat: pedidos.filter(u => /assets\/tm\/patrocinios/.test(u)) };
}
let rPro = null, rPub = null;
try { rPro = await rostosNoPedido('pro'); erros.push(...rPro.err.map(e => 'rostos pro: ' + e)); } catch (e) { erros.push('rostos pro: ' + e.message); }
if (!SO_PRO) try { rPub = await rostosNoPedido('publica'); erros.push(...rPub.err.map(e => 'rostos pública: ' + e)); } catch (e) { erros.push('rostos pública: ' + e.message); }
meta('C4 rostos reais na edição pro: cada jogador com rosto pede a textura e todas carregam',
  rPro?.r ? `${clube}: índice ${rPro.r.indice ? 'sim' : 'não'}; ${rPro.r.carregados}/${rPro.r.pedidos} carregados (${nomes.length} no índice)` : 'sem índice ou não abriu',
  'carregados = pedidos ≥ 3', rPro?.r && rPro.r.indice && rPro.r.pedidos >= 3 && rPro.r.carregados === rPro.r.pedidos);
meta('C5 na edição pública nada de rosto real é pedido',
  rPub ? `${rPub.baixou.length} pedidos a assets/rostos-reais; rostos ${JSON.stringify(rPub.r)}` : 'não abriu', '0', rPub && rPub.baixou.length === 0 && !(rPub.r?.pedidos > 0));
meta('C6 patrocínios na edição pro (versão de teste): os logos das camisas reais são pedidos e carregam',
  rPro?.lg ? `${rPro.lg.carregados}/${rPro.lg.pedidos} logos carregados` : 'não abriu', 'carregados = pedidos ≥ 3', rPro?.lg && rPro.lg.pedidos >= 3 && rPro.lg.carregados === rPro.lg.pedidos);
{
  const nc = rPro?.nuca, vs = nc?.vistas ?? [];
  meta('C9 a nuca de costas: o mesmo quadro com e sem o mapa de normais do pano, |ΔL*| p99 na cabeça',
    vs.length ? `jogador ${nc.id}: ` + vs.map(v => `${v.nome} p50 ${v.p50.toFixed(1)} p95 ${v.p95.toFixed(1)} p99 ${v.p99.toFixed(1)} máx ${v.max.toFixed(1)} (${v.n} px)`).join('; ') : (nc?.erro ?? 'não mediu'),
    '≤ 2 em cada vista', vs.length === 2 && vs.every(v => v.n > 1000 && v.p99 <= 2));
}
meta('C7 na edição pública nada de patrocínio é pedido',
  rPub ? `${rPub.baixouPat.length} pedidos a assets/tm/patrocinios*; logos ${JSON.stringify(rPub.lg)}` : 'não abriu', '0', rPub && rPub.baixouPat.length === 0 && !(rPub.lg?.pedidos > 0));

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

if (SO_PRO) for (let i = res.length - 1; i >= 0; i--) if (!/^C[4689] /.test(res[i].nome)) res.splice(i, 1);
const L = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(L)}  ${r.medido}   (alvo: ${r.alvo})`);
const falhou = res.some(r => !r.ok);
console.log(`\nteste-corpo-tela: ${falhou ? 'REPROVOU' : 'PASSOU'}`);
srv.fechar?.();
process.exit(falhou ? 1 : 0);
