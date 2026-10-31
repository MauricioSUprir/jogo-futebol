// teste-mira-tela: a mira das ações pelo que se vê na tela (C6, item 68 da FILA; contrato "Mira pela tela" no
// CONTRATOS.md; PESQUISA-ETAPA2.md §2.12). Na página de verdade (a câmera de verdade do jogo, render/camera.js, e o
// caminho inteiro: o controle → entrada.js → main.js → sim.js → acoes.js), em PC 1280×720 (TV, 24,6°) e celular 844×390
// (a TV do celular, CAMERA.celular, 15°). Um controle de mentira (navigator.getGamepads) empurra o analógico na direção EM
// QUE A PESSOA VÊ o alvo na tela: do ponto da bola no gramado (o mesmo de onde a página leva a direção ao gramado) até o
// ponto do alvo no gramado — o meio da linha do gol, o pau de perto (o do lado da bola) e o pau de longe. Com o CHUTE
// segurado, a simulação guarda a mira (j.mira, a direção da ação no mundo) — a mesma que o chute, o passe, a enfiada, o
// lançamento e o cruzamento usam. Posições: o último terço inteiro, a cada 2,5 m (364, a bola no pé do controlado, os
// adversários de linha longe).
//  M1  a mira cai no alvo: a reta da mira cruza a linha do gol mais perto do alvo apontado que dos outros dois (meio, pau
//      de perto, pau de longe) em ≥ 90% das posições, para cada alvo, no PC e no celular (na main: só pelo rumo da câmera);
//  M2  o meio do gol visto vira chute no MEIO (fora dos cantos da régua do C2, |z| < meia-boca − cheia.zCanto, a conta do
//      acoes.js zBrutoAnalogico) em ≥ 90% das posições, PC e celular;
//  M3  o erro da mira (o ângulo entre a mira e a reta da bola ao alvo no gramado): p95 ≤ 1° (a conta é exata para direções;
//      sobra a quantização da entrada, 1/1024);
//  M4  pênalti (a câmera atrás do cobrador, render/bola-parada.js): o analógico apontado para o meio do gol visto → a mira
//      do chute (m.voo.alvo.z) a ≤ 0,6 m do meio; para cada trave vista → o canto daquele lado (|z| ≥ 2 m, o sinal certo);
//  M5  nenhum erro no console;
//  M6  outras câmeras (uma grade a cada 7,5 m): a aproximada da partida (PC e celular) e as do Modo Livre de trás (Atrás e
//      Jogador, celular) — a mira cai no alvo (o pior dos três) em ≥ 90% e o erro p95 ≤ 1°.
//  Na main (só pelo rumo da câmera) reprova 13 de 19.
//  Informativo: o analógico na horizontal da tela para o gol (a reta de verdade é a linha x: do lado aberto ela passa do
//  pau de perto), a tabela alvo × zona do chute e o erro da mira em graus.
//   node tools/teste-mira-tela.mjs [--raiz <pasta do golaco>] [--so pc|celular|livre] [--passo 2.5] [--sem-penalti]
//     [--sem-outras] [--passo-outras 7.5] [--desenhar] [--json <arq>]
//   (--raiz mede outra cópia do jogo — a main: `git archive <commit> golaco | tar -x -C <pasta>`)
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RAIZ_JOGO = path.resolve(arg('--raiz', RAIZ));
const SO = arg('--so', null);
const PASSO = +arg('--passo', 2.5);
const PENALTI = !args.includes('--sem-penalti');
const JSON_SAIDA = arg('--json', null);
// outras câmeras (M6): a aproximada da partida (C) e, no celular, as do Modo Livre de trás (Atrás, Jogador), numa grade mais rala
const OUTRAS = !args.includes('--sem-outras');
const PASSO_OUTRAS = +arg('--passo-outras', 7.5);
// o 1º quadro de cada posição desenhado: as matrizes da câmera em dia para o naTela. A página de agora põe a câmera em dia a
// cada quadro (main.js telaMira) e não precisa; a main não — medindo outra cópia (--raiz), desenha (mais lento)
const DESENHAR = args.includes('--desenhar') || RAIZ_JOGO !== path.resolve(RAIZ);
const t0 = Date.now();
const res = [];
const meta = (nome, medido, alvo, ok) => { res.push({ nome, medido, alvo, ok: !!ok }); console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome} — ${medido} (meta: ${alvo})`); };
const pc = (n, d) => (d ? `${(100 * n / d).toFixed(1).replace('.', ',')}%` : '-');
const f2 = v => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2).replace('.', ','));

const MEIA = 7.32 / 2, REGUA = MEIA - 0.9; // CAMPO.gol.largura / 2 e a régua do canto (ACOES.chute.cheia.zCanto)
const TELAS = [
  { nome: 'PC 1280×720', id: 'pc', largura: 1280, altura: 720, toque: false },
  { nome: 'celular 844×390', id: 'celular', largura: 844, altura: 390, toque: true },
].filter(t => !SO || t.id === SO);  // --so livre: só o Modo Livre

const srv = await servidor(0, RAIZ_JOGO);

// o controle de mentira: o analógico e os botões que o teste escreve em window.__pad
const PAD_FALSO = () => {
  window.__pad = { axes: [0, 0, 0, 0], b: new Array(17).fill(false) };
  const lista = () => [{
    id: 'controle de teste', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes: window.__pad.axes.slice(), buttons: window.__pad.b.map(p => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
  }];
  Object.defineProperty(navigator, 'getGamepads', { value: lista, configurable: true });
};

/**
 * Uma posição, inteira na página (uma ida e volta só): o controlado (o atacante do time 0) com a bola no pé em (u m da linha
 * de fundo atacada, z), os outros longe do lance; um quadro DESENHADO (a câmera corta para a jogada — o controlado levado
 * longe: main.js rodarPasso — e as matrizes ficam em dia para o naTela: DESENHAR); depois, para cada alvo, o analógico que a pessoa
 * empurraria para apontar do ponto da bola no gramado para (gx, 0, zAlvo) NA TELA, com o CHUTE segurado, um quadro, e a
 * mira guardada pela simulação (j.mira). Devolve {lado, gx, amostras: [{ox, oz, mx, mz, atras}]} na ordem dos alvos.
 */
async function medirPosicao(pg, u, z, alvos) {
  return pg.evaluate(async ([u, z, alvos, desenhar]) => {
    const g = window.__golaco, m = g.mundo, pad = window.__pad;
    const P = await import('./js/partida.js'), A = await import('./js/acoes.js');
    pad.axes[0] = 0; pad.axes[1] = 0; pad.b.fill(false);
    const lado = m.ataca[0], gx = lado * 52.5, x = gx - lado * u;
    // a parada em andamento acaba (o cobrador, parado nela, volta a se mexer — como partida.js encerrarParada)
    const pr = m.parada;
    if (pr && pr.cobrador != null && pr.papel != null) { const c0 = m.jogadores.find(o => o.id === pr.cobrador); if (c0 && c0.papel === 'parado') c0.papel = pr.papel; }
    m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
    if (m.faltaPendente !== undefined) m.faltaPendente = null;
    const at = m.jogadores.find(o => o.time === 0 && o.posicao === 'ATA') ?? m.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL');
    // ninguém rouba nem recebe no meio do caminho: os adversários de linha no campo deles, os meus atrás da bola
    for (const o of m.jogadores) {
      o.pedido = null; o.carga = null; o.mira = null; o.recebe = null;
      if (o === at || o.posicao === 'GOL') continue;
      const k = o.vagaIdx ?? 0;
      P.teleportar(o, -lado * (o.time !== 0 ? 40 : 20), -30 + (k % 11) * 6, lado > 0 ? 0 : Math.PI);
    }
    P.teleportar(at, x, z, lado > 0 ? 0 : Math.PI);
    m.bola.p.x = x + lado * 0.34; m.bola.p.y = 0.11; m.bola.p.z = z;
    m.bola.v.x = 0; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.w.x = 0; m.bola.w.y = 0; m.bola.w.z = 0; m.bola.rolando = true;
    m.posse = at.id;
    if (m.controlado[0] !== at.id) A.assumirControle(m, 0, at);
    g.relogio.avancar(1000 / 60, { desenhar });
    const amostras = [];
    for (const [zA, horizontal] of alvos) {
      const b = g.render.bola;
      const o = g.naTela(b.x, 0, b.z), t = g.naTela(gx, 0, zA);
      let ax, ay;
      if (horizontal) { ax = Math.sign(t.x - o.x) || 1; ay = 0; } else { ax = t.x - o.x; ay = -(t.y - o.y); const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
      // o controle: o eixo 1 é para BAIXO (entrada.js lerControle inverte); B = CHUTE no ataque
      pad.axes[0] = ax; pad.axes[1] = -ay; pad.b[1] = true;
      const ox = b.x, oz = b.z;
      // (sem desenhar: a página põe a câmera em dia a cada quadro — main.js telaMira; a main, sem isso, quase não mexe a
      // câmera depois do corte com o lance parado)
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const mi = at.mira;
      amostras.push({ ox, oz, mx: mi ? mi.x : null, mz: mi ? mi.z : null, atras: o.atras || t.atras });
    }
    pad.axes[0] = 0; pad.axes[1] = 0; pad.b.fill(false);
    return { lado, gx, amostras };
  }, [u, z, alvos, DESENHAR]);
}

/** Um quadro do laço da página (o relógio manual), desenhado (as matrizes da câmera em dia para o naTela). */
const quadro = pg => pg.evaluate(() => window.__golaco.relogio.avancar(1000 / 60, { desenhar: true }));

/** O analógico que a pessoa empurraria para apontar do ponto da bola no gramado para (gx, 0, zAlvo) na tela (o pênalti). */
async function apontar(pg, gx, zAlvo) {
  return pg.evaluate(([gx, zAlvo]) => {
    const g = window.__golaco, b = g.render.bola;
    const o = g.naTela(b.x, 0, b.z), t = g.naTela(gx, 0, zAlvo);
    let ax = t.x - o.x, ay = -(t.y - o.y); const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    window.__pad.axes[0] = ax; window.__pad.axes[1] = -ay; window.__pad.b[1] = true;
    return { atras: o.atras || t.atras };
  }, [gx, zAlvo]);
}
const soltar = pg => pg.evaluate(() => { window.__pad.axes[0] = 0; window.__pad.axes[1] = 0; window.__pad.b.fill(false); });

/** z onde a reta (ox, oz) + t·(dx, dz) cruza a linha do gol x = gx; null se não chega lá (para trás ou paralela). */
function cruza(ox, oz, dx, dz, gx) {
  const k = (gx - ox) / dx;
  return Number.isFinite(k) && k > 0 ? oz + dz * k : null;
}
const difAng = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
/** O z da mira do chute pelo analógico (acoes.js zBrutoAnalogico, a conta de hoje): o ângulo até a reta bola–meio do gol. */
const zChute = (ox, oz, gx, lado, dx, dz) => Math.sin(difAng(Math.atan2(-oz, gx - ox), Math.atan2(dz, dx))) * lado * MEIA * 1.4;

const p95 = v => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.min(o.length - 1, Math.floor(0.95 * o.length))] : null; };
const p50 = v => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor(0.5 * o.length)] : null; };

/**
 * A grade do último terço: u = metros da linha de fundo atacada (0–35), z = a largura (sem o z = 0), a cada `passo` a partir
 * de passo/2. Para cada posição: o meio, o pau de perto e o pau de longe vistos e o analógico na horizontal.
 */
async function medirGrade(pg, passo) {
  const A = { meio: { cai: 0, zona: { meio: 0, perto: 0, longe: 0 }, err: [] }, perto: { cai: 0, zona: { meio: 0, perto: 0, longe: 0 }, err: [] }, longe: { cai: 0, zona: { meio: 0, perto: 0, longe: 0 }, err: [] } };
  const H = { meio: 0, perto: 0, longe: 0, n: 0 };
  let n = 0, semMira = 0, fora = 0;
  const tq0 = Date.now();
  for (let u = passo / 2; u < 35; u += passo) {
    for (let z = -34 + passo / 2 + 0.5; z <= 34 - 0.5; z += passo) {
      const zz = Math.round(z * 100) / 100;
      if (Math.abs(zz) < 0.5) continue;
      const sPerto = Math.sign(zz);
      const alvos = { meio: 0, perto: sPerto * MEIA, longe: -sPerto * MEIA };
      const zonaDe = zc => (Math.abs(zc) < REGUA ? 'meio' : Math.sign(zc) === sPerto ? 'perto' : 'longe');
      const lista = [...Object.entries(alvos), ['horizontal', 0]];
      const p = await medirPosicao(pg, u, zz, lista.map(([k, v]) => [v, k === 'horizontal']));
      let conta = true;
      lista.forEach(([nome, zA], i) => {
        const ap = p.amostras[i];
        if (!conta) return;
        if (ap.atras) { fora++; conta = false; return; }
        if (ap.mx == null) { semMira++; conta = false; return; }
        const l = Math.hypot(ap.mx, ap.mz), dx = ap.mx / l, dz = ap.mz / l;
        const zZona = zonaDe(zChute(ap.ox, ap.oz, p.gx, p.lado, dx, dz));
        if (nome === 'horizontal') { H[zZona]++; H.n++; return; }
        const zc = cruza(ap.ox, ap.oz, dx, dz, p.gx);
        let perto = null, dm = Infinity;
        if (zc != null) for (const [k, v] of Object.entries(alvos)) { const d = Math.abs(zc - v); if (d < dm) { dm = d; perto = k; } }
        const a = A[nome];
        if (perto === nome) a.cai++;
        a.zona[zZona]++;
        a.err.push(Math.abs(difAng(Math.atan2(zA - ap.oz, p.gx - ap.ox), Math.atan2(dz, dx))) * 180 / Math.PI);
      });
      if (conta) n++;
    }
  }
  await soltar(pg);
  return { A, H, n, semMira, fora, segs: (Date.now() - tq0) / 1000 };
}
function imprimir(gr) {
  const { A, H, n } = gr;
  console.log('  alvo visto  → cai no alvo | zona do chute: meio / canto de perto / canto de longe | erro da mira p50 / p95');
  for (const k of ['meio', 'perto', 'longe']) {
    const a = A[k];
    console.log(`  ${k.padEnd(10)} → ${pc(a.cai, n).padStart(6)} | ${pc(a.zona.meio, n)} / ${pc(a.zona.perto, n)} / ${pc(a.zona.longe, n)} | ${f2(p50(a.err))}° / ${f2(p95(a.err))}°`);
  }
  console.log(`  horizontal → zona do chute: ${pc(H.meio, H.n)} / ${pc(H.perto, H.n)} / ${pc(H.longe, H.n)} (informativo)`);
}
const resumoGrade = gr => ({ n: gr.n, fora: gr.fora, A: Object.fromEntries(Object.entries(gr.A).map(([k, a]) => [k, { cai: a.cai, zona: a.zona, p50: p50(a.err), p95: p95(a.err) }])) });
/** M6: em outra câmera, a mira cai no alvo (os três) em ≥ 90% e o erro p95 ≤ 1° (as posições com o alvo no quadro). */
function outraCamera(tela, nome, gr) {
  const errT = [...gr.A.meio.err, ...gr.A.perto.err, ...gr.A.longe.err];
  const piorCai = Math.min(gr.A.meio.cai, gr.A.perto.cai, gr.A.longe.cai);
  console.log(`\n${tela.nome}, câmera ${nome}: ${gr.n} posições (${gr.fora} fora do quadro, ${gr.semMira} sem mira)`);
  imprimir(gr);
  meta(`M6 ${tela.nome}, câmera ${nome}: a mira cai no alvo (o pior dos três) e o erro`, `${pc(piorCai, gr.n)} de ${gr.n}; p95 ${f2(p95(errT))}°`, '≥ 90% e p95 ≤ 1° (≥ 20 posições)', gr.n >= 20 && piorCai >= 0.9 * gr.n && p95(errT) <= 1);
}

const saida = { raiz: RAIZ_JOGO, telas: {} };
for (const tela of TELAS) {
  const s = await abrir({ largura: tela.largura, altura: tela.altura, toque: tela.toque });
  const pg = s.pagina;
  await s.contexto.addInitScript(PAD_FALSO);
  await pg.goto(`${srv.url}?semente=5&q=baixa&replay=0&comemoracao=0&replayParada=0&cenas=0&substituicao=0`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  const g0 = await medirGrade(pg, PASSO);
  const { A, H, n } = g0;
  console.log(`\n${tela.nome}: ${n} posições (${g0.fora} fora do quadro, ${g0.semMira} sem mira) em ${g0.segs.toFixed(0)} s`);
  imprimir(g0);
  const okN = n >= 300;
  for (const k of ['meio', 'perto', 'longe']) meta(`M1 ${tela.nome}: apontando para o ${k === 'meio' ? 'meio do gol' : `pau de ${k}`} visto, a mira cai no alvo`, `${pc(A[k].cai, n)} de ${n} posições`, '≥ 90%', okN && A[k].cai >= 0.9 * n);
  meta(`M2 ${tela.nome}: o meio do gol visto vira chute no meio (fora dos cantos)`, `${pc(A.meio.zona.meio, n)} (canto de perto ${pc(A.meio.zona.perto, n)}, de longe ${pc(A.meio.zona.longe, n)})`, '≥ 90%', okN && A.meio.zona.meio >= 0.9 * n);
  const errT = [...A.meio.err, ...A.perto.err, ...A.longe.err];
  meta(`M3 ${tela.nome}: erro da mira (mira × reta da bola ao alvo no gramado)`, `p50 ${f2(p50(errT))}°, p95 ${f2(p95(errT))}°`, 'p95 ≤ 1°', p95(errT) != null && p95(errT) <= 1);
  saida.telas[tela.id] = { n, A: Object.fromEntries(Object.entries(A).map(([k, a]) => [k, { cai: a.cai, zona: a.zona, p50: p50(a.err), p95: p95(a.err) }])), H, segs: g0.segs };

  // ---------------------------------------------------------------- a câmera aproximada (C) da partida
  if (OUTRAS) {
    await pg.evaluate(() => window.__golaco.definirCamera('aproximada'));
    const ga = await medirGrade(pg, PASSO_OUTRAS);
    await pg.evaluate(() => window.__golaco.definirCamera('tv'));
    outraCamera(tela, 'aproximada', ga);
    saida.telas[tela.id].aproximada = resumoGrade(ga);
  }

  // ---------------------------------------------------------------- pênalti (a câmera atrás do cobrador)
  if (PENALTI) {
    await pg.evaluate(() => window.__golaco.bolaParada.carregar());
    const pen = [];
    for (const [nome, zA] of [['meio', 0], ['trave +z', MEIA], ['trave −z', -MEIA]]) {
      await soltar(pg);
      const ok = await pg.evaluate(() => {
        const g = window.__golaco;
        if (!g.bolaParada?.carregar) return false;
        g.faltaDeTeste({ area: true });
        for (let i = 0; i < 600; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          const e = g.bolaParada.estado, m = g.mundo;
          if (e && e.ativa && e.mistura >= 1 && m.parada && m.parada.tipo === 'penalti' && m.tick >= m.parada.pronta) return true;
        }
        return false;
      });
      if (!ok) { pen.push({ nome, z: null }); continue; }
      await quadro(pg);
      const gx = await pg.evaluate(() => window.__golaco.mundo.ataca[0] * 52.5);
      // apontar e segurar o CHUTE 0,3 s (não é toque rápido: nada de cavadinha), soltar e esperar a bola sair
      for (let i = 0; i < 18; i++) { await apontar(pg, gx, zA); await quadro(pg); }
      await pg.evaluate(() => { window.__pad.b[1] = false; });
      const z = await pg.evaluate(() => {
        const g = window.__golaco;
        for (let i = 0; i < 120; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          const v = g.mundo.voo;
          if (v && (v.tipo === 'chute' || v.tipo === 'colocado' || v.tipo === 'cavadinha')) return { z: v.alvo.z, tipo: v.tipo };
        }
        return null;
      });
      pen.push({ nome, z: z ? z.z : null, tipo: z?.tipo ?? null });
      await soltar(pg);
    }
    console.log(`  pênalti: ${pen.map(p => `${p.nome} → z ${f2(p.z)}${p.tipo && p.tipo !== 'chute' ? ` (${p.tipo})` : ''}`).join(' · ')}`);
    const zMeio = pen[0].z, zMais = pen[1].z, zMenos = pen[2].z;
    const okPen = zMeio != null && Math.abs(zMeio) <= 0.6 && zMais != null && zMais >= 2 && zMenos != null && zMenos <= -2;
    meta(`M4 ${tela.nome}: pênalti, a mira do chute pelo gol visto (meio · trave +z · trave −z)`, `${f2(zMeio)} · ${f2(zMais)} · ${f2(zMenos)} m`, '|meio| ≤ 0,6; traves ≥ 2 m do lado certo', okPen);
    saida.telas[tela.id].penalti = pen;
  }
  meta(`M5 ${tela.nome}: nenhum erro no console`, s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', '0', s.erros.length === 0);
  await s.navegador.close();
}
// ------------------------------------------------------------------ o Modo Livre: as câmeras de trás (celular)
if (OUTRAS && (!SO || SO === 'celular' || SO === 'livre')) {
  const tela = { nome: 'celular 844×390, Modo Livre', id: 'livre' };
  const s = await abrir({ largura: 844, altura: 390, toque: true });
  const pg = s.pagina;
  await s.contexto.addInitScript(PAD_FALSO);
  await pg.goto(`${srv.url}?modo=livre&semente=5&q=baixa&replay=0&comemoracao=0`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await pg.evaluate(async () => { const g = window.__golaco; await g.carregarLivre(); g.relogio.usarManual(true); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  saida.telas.livre = {};
  for (const c of ['atras', 'jogador']) {
    const modo = await pg.evaluate(c => { const g = window.__golaco; g.definirCamera(c); g.relogio.avancar(1000 / 60, { desenhar: false }); return g.camera; }, c);
    if (modo !== c) { meta(`M6 ${tela.nome}, câmera ${c}`, `a câmera não trocou (${modo})`, c, false); continue; }
    const gr = await medirGrade(pg, PASSO_OUTRAS);
    outraCamera(tela, c, gr);
    saida.telas.livre[c] = resumoGrade(gr);
  }
  meta(`M5 ${tela.nome}: nenhum erro no console`, s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', '0', s.erros.length === 0);
  await s.navegador.close();
}
await srv.fechar();
if (JSON_SAIDA) fs.writeFileSync(JSON_SAIDA, JSON.stringify(saida, null, 1));
const falhas = res.filter(r => !r.ok).length;
console.log(`\nteste-mira-tela: ${falhas ? `REPROVOU (${falhas} de ${res.length})` : `PASSOU (${res.length} itens)`} em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(falhas ? 1 : 0);
