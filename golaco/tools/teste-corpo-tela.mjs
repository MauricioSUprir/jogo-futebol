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
//   C10 as MÁSCARAS dos patrocínios (item 63: "retângulos tracejados brancos em volta dos números e patrocínios"), lidas no
//      navegador como o jogo lê (o alfa do WebP): em cada uma das do índice, contra a caixa que o shader recorta
//      (humano3d.js decalLogo; tools/patrocinios/borda.mjs) — o desenho (α > 8) a ≥ 8 px da borda (2³: limpa até o mip 3;
//      encostado, o borrão do mip grosso e o próprio desenho saíam cortados retos), a névoa (0 < α ≤ 36 longe do desenho:
//      na mistura em cor linear, α 12 de branco numa camisa preta leva o L* de 0 a 25 — um retângulo sujo) ≤ 0,25% da caixa
//      e nada fora da caixa. Na base: 161 de 161 sem a margem.
//   C9b a nuca até a GOLA (R1-4 da revisão: o disco do C9 só pega o occipital; a malha da cabeça desce até a base do
//      pescoço): a câmera a 0,8 m atrás da junta do pescoço, com e sem o mapa de normais, |ΔL*| p99 ≤ 2 nos pixels da PARTE
//      da cabeça (a máscara da parte por uma variante do shader); informativos o degrau na emenda cabeça–corpo e a costura do
//      meio (a linha vertical u ≈ 0 / u ≈ 1 da ilha da cabeça, FILA: pendência do item 62).
//   C11 as BORDAS dos decalques (item 63; R1-2 da revisão: o P6 do teste-patrocinios é só a regra estática): o mesmo quadro
//      com o shader de sempre, com a derivada implícita (textureGrad/textureLod → texture()) e com a caixa cheia e vazia
//      (textureGrad → 1 / 0): C11a longe da borda das caixas o de sempre = o implícito (o gradiente de cada projeção e o
//      nível da cabeça certos); C11b nos pontos da faixa de ±2 px da borda de cada logo onde o implícito escurece (o
//      tracejado no canto da caixa e na manga; ≥ 5), o de sempre = a camisa. Ver bordasDecalques.
// Na versão sem o corpo humano reprova (C0); na base dos itens 62 e 63 (7cb052ad) reprovam o C9, o C9b, o C10 e o C11b.
//   node tools/teste-corpo-tela.mjs [--so-pro] [--prints <pasta>]   (--so-pro: só o pedido pro — C4, C6, C8, C9 e C10; --prints:
//   grava os closes do C9)
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { timeTM } from './lib/pedidos-tm.mjs';
import { medirMascara, lerAlfa, BORDA } from './patrocinios/borda.mjs';

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
 * Troca o shader do corpo novo por uma VARIANTE (C9b e C11): o texto `pref` antes do fragment shader (macros e funções) e,
 * se `troca` = [de, para], a troca dele; `null` volta ao shader de sempre. Os materiais das malhas humano-lod*, achados na
 * cena pela torcida; o customProgramCacheKey novo força o three.js a compilar de novo.
 */
async function varianteCorpo(pg, nome, pref = '', troca = null) {
  return pg.evaluate(([nome, pref, troca]) => {

    const g = window.__golaco;
    let o = g.estadio.torcidaObj?.mesh ?? null;
    while (o && o.parent) o = o.parent;
    const mats = [];
    o?.traverse(x => { if (/^humano-lod/.test(x.name) && x.material && !mats.includes(x.material)) mats.push(x.material); });
    for (const mat of mats) {
      mat.__orig ??= { obc: mat.onBeforeCompile, chave: mat.customProgramCacheKey };
      const { obc, chave } = mat.__orig;
      if (!nome) { mat.onBeforeCompile = obc; mat.customProgramCacheKey = chave; }
      else {
        mat.onBeforeCompile = (sh, r) => { obc(sh, r); if (troca) sh.fragmentShader = sh.fragmentShader.replace(troca[0], troca[1]); sh.fragmentShader = pref + sh.fragmentShader; };
        mat.customProgramCacheKey = () => 'teste-corpo-' + nome;
      }
      mat.needsUpdate = true;
    }
    g.relogio.avancar(0.01); g.desenhar();
    return mats.length;
  }, [nome, pref, troca]);
}
// a máscara da parte (a cabeça em vermelho puro, o corpo em verde puro), no fim do fragment shader
const MASCARA_PARTE = ['#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor = vec4(vParte, 1.0 - vParte, 0.0, 1.0);'];

/**
 * C9: closes da cabeça de costas de um jogador com rosto real, o mesmo quadro com e sem o mapa de normais do pano (o
 * normalScale do material do corpo, achado na cena pela torcida): o |ΔL*| no disco do meio da tela (só cabeça). C9b: a
 * NUCA até a gola (a câmera a 0,8 m atrás da junta do pescoço): o mesmo |ΔL*| nos pixels da PARTE da cabeça (a malha da
 * cabeça desce até a base do pescoço; a máscara da parte vem de uma variante do shader) e, informativos, o degrau de tom na
 * emenda cabeça–corpo (a gola) e a costura do meio (a linha vertical u ≈ 0 / u ≈ 1 da ilha da cabeça).
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
    const n = A.J.pescoco * 3;
    return { id: j.id, x: po[c], y: po[c + 1], z: po[c + 2], rumo: j.rumo, pescoco: [po[n], po[n + 1], po[n + 2]] };
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
  // C9b: a nuca até a gola — a câmera a 0,8 m atrás da junta do pescoço (com e sem o mapa de normais e a máscara da parte)
  {
    const a = alvo.rumo + Math.PI, [nx, ny, nz] = alvo.pescoco;
    await pg.evaluate(([de, para]) => { const g = window.__golaco; g.cameraLivre({ de, para, fov: 22 }); g.relogio.avancar(0.01); g.desenhar(); },
      [[nx + Math.cos(a) * 0.8, ny + 0.02, nz + Math.sin(a) * 0.8], [nx, ny, nz]]);
    const com = (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
    await pg.evaluate(() => { const m = window.__matCorpo; m.__ns = m.normalScale.x; m.normalScale.set(0, 0); window.__golaco.desenhar(); });
    const sem = (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
    await pg.evaluate(() => { const m = window.__matCorpo; m.normalScale.set(m.__ns, m.__ns); window.__golaco.desenhar(); });
    await varianteCorpo(pg, 'parte', '', MASCARA_PARTE);
    const parte = (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
    await varianteCorpo(pg, null);
    if (PRINTS) { fs.mkdirSync(PRINTS, { recursive: true }); for (const [n, b] of [['com', com], ['sem', sem], ['parte', parte]]) fs.writeFileSync(path.join(PRINTS, `pescoco-${n}.png`), Buffer.from(b, 'base64')); }
    const r = await pg.evaluate(async ([a, b, c]) => {
      const ler = async s => {
        const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0);
        return { d: g2.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
      };
      const A = await ler(a), B = await ler(b), M = await ler(c), W = A.w, H = A.h;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (d, i) => { const Y = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
      const parte = new Int8Array(W * H); // 1 cabeça, 2 corpo, 0 o resto
      for (let i = 0; i < W * H; i++) { const r2 = M.d[i * 4], g2 = M.d[i * 4 + 1], b2 = M.d[i * 4 + 2]; parte[i] = r2 > 230 && g2 < 25 && b2 < 25 ? 1 : g2 > 230 && r2 < 25 && b2 < 25 ? 2 : 0; }
      // os pixels da cabeça com e sem o mapa de normais
      const dl = [];
      for (let i = 0; i < W * H; i++) if (parte[i] === 1) dl.push(Math.abs(L(A.d, i * 4) - L(B.d, i * 4)));
      dl.sort((p, q) => p - q);
      const pc = (l, f) => l.length ? l[Math.min(l.length - 1, Math.floor(f * l.length))] : NaN;
      // a emenda cabeça → corpo (de cima para baixo em cada coluna): o tom 2–4 px acima × 2–4 px abaixo (informativo)
      const em = [];
      for (let x = 0; x < W; x++) for (let y = 4; y < H - 4; y++) {
        const i = y * W + x;
        if (parte[i] !== 1 || parte[i + W] !== 2) continue;
        let ac = 0, ab = 0;
        for (let k = 2; k <= 4; k++) { ac += L(A.d, (i - k * W) * 4); ab += L(A.d, (i + (k + 1) * W) * 4); }
        em.push(Math.abs(ac - ab) / 3);
      }
      em.sort((p, q) => p - q);
      // a costura do meio (informativo): na faixa da cabeça logo acima da emenda, a mediana de 9 linhas por coluna e o
      // maior degrau entre colunas vizinhas no meio da tela (±60 px)
      let yEm = 0, nEm = 0;
      for (let y = 0; y < H - 1; y++) for (let x = (W >> 1) - 60; x < (W >> 1) + 60; x++) if (parte[y * W + x] === 1 && parte[(y + 1) * W + x] === 2) { yEm += y; nEm++; }
      let costura = NaN;
      if (nEm) {
        const y0 = Math.round(yEm / nEm) - 40, col = [];
        for (let x = (W >> 1) - 60; x < (W >> 1) + 60; x++) { const v = []; for (let y = y0 - 4; y <= y0 + 4; y++) if (parte[y * W + x] === 1) v.push(L(A.d, (y * W + x) * 4)); v.sort((p, q) => p - q); col.push(v.length ? v[v.length >> 1] : NaN); }
        costura = 0;
        for (let k = 1; k < col.length; k++) if (Number.isFinite(col[k]) && Number.isFinite(col[k - 1])) costura = Math.max(costura, Math.abs(col[k] - col[k - 1]));
      }
      return { n: dl.length, p50: pc(dl, 0.5), p95: pc(dl, 0.95), p99: pc(dl, 0.99), max: dl[dl.length - 1] ?? NaN, emenda: { n: em.length, p50: pc(em, 0.5), p90: pc(em, 0.9) }, costura };
    }, [com, sem, parte]);
    vistas.push({ nome: 'nuca até a gola', pescoco: true, ...r });
  }
  return { id: alvo.id, vistas };
}

/**
 * C11: as BORDAS dos decalques (item 63: "retângulos tracejados brancos em volta dos números e patrocínios"; R1-2 da
 * revisão). No mesmo pedido pro, closes do 6º jogador da casa (frente e lado a 1 m: peito, fornecedor, ombro e manga; costas
 * a 2,5 m: o número e os de cima/baixo dele), a página parada, o MESMO quadro com 4 variantes do shader:
 *   A o de sempre; B as leituras com derivada IMPLÍCITA (textureGrad e textureLod viram texture(): a derivada de dentro do
 *   desvio, o que o item 63 tirou); Dch/Dvz a caixa CHEIA e VAZIA (textureGrad → 1 e → 0: a caixa de cada decalque e de
 *   cada célula de dígito na tela, a cor do decalque sobre a camisa).
 * Medidas: (a) longe da borda das caixas (a mais de 2 px), A = B: |ΔL*| > 2 em ≤ 0,01% dos pixels — o gradiente analítico
 * de cada projeção dá o mesmo mip da derivada implícita (um fator errado — o kk do logo, a célula 2 × 1 do dígito, o 0,1 do
 * atlas — muda o mip dentro das caixas; a cabeça entra aqui também: o textureLod com o nível da conta = o texture());
 * (b) nas vistas de 1 m (sem o número), na faixa de ±2 px da borda da caixa de cada logo, o B difere do A (o texture()
 * implícito dentro do desvio pega o mip errado nos quads da borda — o SwiftShader mostra uma parte: os PONTOS mais escuros,
 * o pontinho cinza no canto da caixa e a linha pontilhada na manga, e os BLOCOS mais claros, o decalque de cima apagando o
 * de baixo em quads): ≥ 5 px diferentes (a sonda mostra o defeito neste navegador) e, nos pontos, o A = a camisa (= Dvz,
 * |ΔL*| ≤ 3). Voltar ao texture() faz A = B: nada difere — reprova; na base (7cb052ad), o mesmo (o shader dela é o
 * implícito). (A faixa inteira
 * NÃO se compara com a caixa vazia: de perto a margem de 8 texels da máscara é 1–2 px na tela e o mip grosso traz o logo
 * até a borda.) O logo encostado na borda da máscara é o C10.
 */
async function bordasDecalques(pg) {
  const alvo = await pg.evaluate(async () => {
    const g = window.__golaco, A = await import(new URL('js/anim.js', location.href).href);
    const js = g.mundo.jogadores.filter(j => j.time === 0 && !j.goleiro);
    const j = js[Math.min(5, js.length - 1)];
    if (!j) return null;
    const po = A.pose(j, g.mundo, new Float32Array(A.NJ * 3)), J = A.J;
    const m = (a, b) => [0, 1, 2].map(k => (po[a * 3 + k] + po[b * 3 + k]) / 2);
    return { id: j.id, rumo: j.rumo, costas: m(J.peito, J.lombar), peito: m(J.peito, J.pescoco), ombro: [0, 1, 2].map(k => po[J.ombroD * 3 + k]) };
  });
  if (!alvo) return { erro: 'sem jogador' };
  const vistas = [
    { nome: 'frente 1 m', ang: 0, alvo: alvo.peito, d: 1, borda: true },
    { nome: 'lado 1 m', ang: Math.PI / 2, alvo: alvo.ombro, d: 1, borda: true },
    { nome: 'costas 2,5 m', ang: Math.PI, alvo: alvo.costas, d: 2.5, borda: false },
  ];
  const foto = async v => {
    const a = alvo.rumo + v.ang;
    await pg.evaluate(([de, para]) => { const g = window.__golaco; g.cameraLivre({ de, para, fov: 22 }); g.relogio.avancar(0.01); g.desenhar(); },
      [[v.alvo[0] + Math.cos(a) * v.d, v.alvo[1] + 0.05, v.alvo[2] + Math.sin(a) * v.d], v.alvo]);
    return (await pg.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
  };
  const VARIANTES = [
    ['A', null],
    ['B', '#define textureGrad(s, p, dx, dy) texture(s, p)\n#define textureLod(s, p, l) texture(s, p)\n'],
    ['Dch', '#define textureGrad(s, p, dx, dy) vec4(1.0)\n'],
    ['Dvz', '#define textureGrad(s, p, dx, dy) vec4(0.0)\n'],
  ];
  const img = Object.fromEntries(vistas.map(v => [v.nome, {}]));
  for (const [nome, pref] of VARIANTES) {
    await varianteCorpo(pg, pref ? 'c11-' + nome : null, pref ?? '');
    for (const v of vistas) img[v.nome][nome] = await foto(v);
  }
  await varianteCorpo(pg, null);
  if (PRINTS) { fs.mkdirSync(PRINTS, { recursive: true }); for (const v of vistas) for (const [n, b] of Object.entries(img[v.nome])) fs.writeFileSync(path.join(PRINTS, `decal-${v.nome.replace(/\W+/g, '-')}-${n}.png`), Buffer.from(b, 'base64')); }
  const res = [];
  for (const v of vistas) {
    const r = await pg.evaluate(async ([a, b, ch, vz, borda]) => {
      const ler = async s => {
        const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const g2 = cv.getContext('2d'); g2.drawImage(im, 0, 0);
        return { d: g2.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
      };
      const A = await ler(a), B = await ler(b), CH = await ler(ch), VZ = await ler(vz), W = A.w, H = A.h;
      const lin = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      const L = (d, i) => { const Y = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
      const caixa = new Uint8Array(W * H);
      let nCaixa = 0;
      for (let i = 0; i < W * H; i++) if (Math.abs(L(CH.d, i * 4) - L(VZ.d, i * 4)) > 3) { caixa[i] = 1; nCaixa++; }
      // a faixa da borda: a menos de 2 px (Chebyshev) de um pixel do outro lado
      const perto = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let mud = false;
        for (let dy = -2; dy <= 2 && !mud; dy++) for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
          if (caixa[yy * W + xx] !== caixa[i]) { mud = true; break; }
        }
        if (mud) perto[i] = 1;
      }
      let longe = 0, longeRuim = 0, longeMax = 0, faixa = 0, difer = 0, apaga = 0, pontos = 0, sujos = 0, sujoMax = 0, ex = '';
      for (let i = 0; i < W * H; i++) {
        const la = L(A.d, i * 4), lb = L(B.d, i * 4);
        if (!perto[i]) {
          longe++;
          const dd = Math.abs(la - lb);
          if (dd > 2) longeRuim++;
          if (dd > longeMax) longeMax = dd;
        } else if (borda) {
          faixa++;
          // o defeito do implícito na faixa: onde o B difere do A — os PONTOS (o B mais escuro: ali o A tem de ser a camisa,
          // = a caixa vazia) e os BLOCOS (o B mais claro: o decalque de cima lido no mip errado apaga o de baixo em blocos de
          // 2 × 2, o "retângulo branco")
          if (Math.abs(la - lb) > 4) difer++;
          if (lb > la + 4) apaga++;
          if (lb < la - 4) {
            pontos++;
            const dd = Math.abs(la - L(VZ.d, i * 4));
            if (dd > 3) { sujos++; ex ||= `(${i % W}, ${Math.floor(i / W)})`; }
            if (dd > sujoMax) sujoMax = dd;
          }
        }
      }
      return { nCaixa, longe, longeRuim, longeMax, faixa, difer, apaga, pontos, sujos, sujoMax, ex };
    }, [img[v.nome].A, img[v.nome].B, img[v.nome].Dch, img[v.nome].Dvz, v.borda]);
    res.push({ nome: v.nome, borda: v.borda, ...r });
  }
  return { id: alvo.id, vistas: res };
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
  let decais = null;
  if (edicao === 'pro') {
    try { nuca = await nucaDeCostas(nav.pagina); } catch (e) { nuca = { erro: e.message }; }
    try { decais = await bordasDecalques(nav.pagina); } catch (e) { decais = { erro: e.message }; }
  }
  const err = nav.erros.slice();
  await nav.navegador.close();
  return { r, lg, nuca, decais, err, baixou: pedidos.filter(u => /assets\/rostos-reais\//.test(u)), baixouPat: pedidos.filter(u => /assets\/tm\/patrocinios/.test(u)) };
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
  const nc = rPro?.nuca, vs = (nc?.vistas ?? []).filter(v => !v.pescoco), vp = (nc?.vistas ?? []).find(v => v.pescoco);
  meta('C9 a nuca de costas: o mesmo quadro com e sem o mapa de normais do pano, |ΔL*| p99 na cabeça',
    vs.length ? `jogador ${nc.id}: ` + vs.map(v => `${v.nome} p50 ${v.p50.toFixed(1)} p95 ${v.p95.toFixed(1)} p99 ${v.p99.toFixed(1)} máx ${v.max.toFixed(1)} (${v.n} px)`).join('; ') : (nc?.erro ?? 'não mediu'),
    '≤ 2 em cada vista', vs.length === 2 && vs.every(v => v.n > 1000 && v.p99 <= 2));
  meta('C9b a nuca até a gola (0,8 m atrás do pescoço): com e sem o mapa de normais, |ΔL*| p99 nos pixels da parte da cabeça',
    vp ? `p50 ${vp.p50.toFixed(1)} p95 ${vp.p95.toFixed(1)} p99 ${vp.p99.toFixed(1)} máx ${vp.max.toFixed(1)} (${vp.n} px); informativos: a emenda cabeça–corpo |ΔL*| p50 ${vp.emenda.p50?.toFixed(1)} p90 ${vp.emenda.p90?.toFixed(1)} (${vp.emenda.n} colunas), a costura do meio (o maior degrau entre colunas) ${vp.costura?.toFixed(1)}` : (nc?.erro ?? 'não mediu'),
    '≤ 2 (≥ 5000 px)', vp && vp.n >= 5000 && vp.p99 <= 2);
}
{
  const dc = rPro?.decais, vs = dc?.vistas ?? [];
  const okA = vs.length === 3 && vs.every(v => v.nCaixa > 500 && v.longeRuim <= 1e-4 * v.longe);
  const vb = vs.filter(v => v.borda), difer = vb.reduce((a, v) => a + v.difer, 0);
  const okB = vs.length === 3 && vb.every(v => v.faixa > 200 && v.sujos === 0) && difer >= 5;
  meta('C11a longe da borda dos decalques: o shader de sempre = o com a derivada implícita (o gradiente de cada projeção certo; a cabeça pelo textureLod)',
    vs.length ? vs.map(v => `${v.nome}: ${v.longeRuim} de ${v.longe} px com |ΔL*| > 2 (máx ${v.longeMax.toFixed(1)}; caixas ${v.nCaixa} px)`).join('; ') : (dc?.erro ?? 'não mediu'),
    '≤ 0,01% em cada vista', okA);
  meta('C11b o tracejado: na faixa de ±2 px da borda de cada logo o de sempre ≠ o implícito (≥ 5 px nas vistas de 1 m) e, nos pontos que o implícito escurece, = a camisa',
    vs.length ? vb.map(v => `${v.nome}: ${v.difer} de ${v.faixa} px da faixa diferem (${v.pontos} pontos, ${v.apaga} em blocos), ${v.sujos} sujos no de sempre (máx |ΔL*| ${v.sujoMax.toFixed(1)})${v.ex ? ' ex. ' + v.ex : ''}`).join('; ') : (dc?.erro ?? 'não mediu'),
    '≥ 5 px; 0 sujos', okB);
}
meta('C7 na edição pública nada de patrocínio é pedido',
  rPub ? `${rPub.baixouPat.length} pedidos a assets/tm/patrocinios*; logos ${JSON.stringify(rPub.lg)}` : 'não abriu', '0', rPub && rPub.baixouPat.length === 0 && !(rPub.lg?.pedidos > 0));

// C10: as máscaras dos patrocínios (o alfa lido no navegador; as contas do borda.mjs)
try {
  const idx = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/tm/patrocinios.json'), 'utf8'));
  const asp = new Map();
  for (const kits of Object.values(idx.clubes)) for (const lista of Object.values(kits)) for (const d of lista) asp.set(d.logo, d.asp);
  const nav = await abrir({ largura: 600, altura: 400 });
  let semMargem = 0, nevoa = 0, fora = 0, pior = Infinity, piorN = 0, exM = '', exN = '';
  for (const [rel, a] of asp) {
    const buf = fs.readFileSync(path.join(RAIZ, 'assets/tm/patrocinios', rel));
    const m = medirMascara(await lerAlfa(nav.pagina, 'data:image/webp;base64,' + buf.toString('base64')), a);
    if (m.margem !== null && m.margem < BORDA.margem) { semMargem++; exM ||= `${rel} ${m.margem.toFixed(1)} px`; }
    if (m.margem !== null) pior = Math.min(pior, m.margem);
    if (m.nevoa > 0.0025) { nevoa++; exN ||= `${rel} ${(m.nevoa * 100).toFixed(1)}%`; }
    piorN = Math.max(piorN, m.nevoa);
    if (m.fora > 0) fora++;
  }
  erros.push(...nav.erros.map(e => 'máscaras: ' + e));
  await nav.navegador.close();
  meta('C10 as máscaras dos patrocínios: o desenho a ≥ 8 px da caixa do shader, névoa ≤ 0,25%, nada fora da caixa',
    `${asp.size} máscaras: ${semMargem} sem a margem${exM ? ' (ex.: ' + exM + ')' : ''} (pior ${pior.toFixed(1)} px); ${nevoa} com névoa${exN ? ' (ex.: ' + exN + ')' : ''} (pior ${(piorN * 100).toFixed(2)}%); ${fora} com alfa fora`,
    '0; 0; 0', asp.size > 0 && semMargem === 0 && nevoa === 0 && fora === 0);
} catch (e) { erros.push('máscaras: ' + e.message); meta('C10 as máscaras dos patrocínios', e.message, 'medidas', false); }

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

if (SO_PRO) for (let i = res.length - 1; i >= 0; i--) if (!/^C([4689]|9b|10|11[ab]) /.test(res[i].nome)) res.splice(i, 1);
const L = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(L)}  ${r.medido}   (alvo: ${r.alvo})`);
const falhou = res.some(r => !r.ok);
console.log(`\nteste-corpo-tela: ${falhou ? 'REPROVOU' : 'PASSOU'}`);
srv.fechar?.();
process.exit(falhou ? 1 : 0);
