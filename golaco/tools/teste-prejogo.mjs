// Pré-jogo no navegador (Chromium): pedido do dono de 11/10 — cenas de fora do estádio, o estádio, a entrada dos times,
// a fila com a câmera passando, cortes de torcida e as escalações dos dois times no campinho, uma depois da outra
// (~10 s cada, o mesmo fundo). Com ?prejogo=1 (desligado por padrão com navigator.webdriver: os outros testes abrem
// direto no jogo), relógio manual, PC 1280×720 Alta e celular 844×390 Média com toque:
//   1) logo depois de pronto: o pré-jogo ativo na abertura, a partida no tick 0 (0 passos), o HUD escondido, 0 erros;
//      sem ?prejogo (webdriver) ele NÃO liga;
//   2) ≥ 11 planos na ordem do roteiro; cenas de 50–65 s; a escalação do mandante inteira na tela 10 ± 0,2 s e depois
//      a do visitante pelo mesmo tempo (relógio de 50 ms);
//   3) cada plano aparece (print com variação de cor): túnel, entrada, plano alto e o geral com ≥ 8 andantes na tela;
//      nas filas a câmera anda ≥ 8 m e cada um dos 11 do time passa pelo terço central do quadro (30 qps); nos planos
//      de fora a fachada cobre ≥ 25% da tela;
//   4) escalação: 11 cartas com os titulares de estadoTime(t) na ordem das vagas, folga ≥ 6 px, nada fora da tela nem da
//      área segura, letra ≥ 10 px, nada cortado e o botão Pular sem encostar em carta nem no nome do time — também em
//      568×320, 667×375 e 1920×1080;
//   5) pular: um clique/toque avança 1 bloco no mesmo quadro; Esc (PC) e o botão Pular (celular) vão direto ao jogo:
//      o HUD volta, a partida continua no tick 0 com o hash de criarPartida (Node) e 600 passos dão o mesmo hash no Node
//      e no Chromium;
//   6) som: com o toque da abertura as camadas da torcida tocam no pré-jogo, o filtro de fora abafa; o apito da saída
//      só toca no FIM (0 antes, 1 depois);
//   7) desempenho no celular (Média): ≤ 40 chamadas de desenho e ≤ 130 mil triângulos em todo plano;
//   8) memória: geometrias e texturas depois do pré-jogo = as do jogo aberto sem ele (o lado de fora descartado).
// Na versão publicada não há pré-jogo (reprova no item 1).
//   node tools/teste-prejogo.mjs [--raiz <pasta do jogo>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);
const { criarPartida, passoPartida } = await imp('partida.js');
const { hashMundo } = await imp('sim.js');
const { BOTAO } = await imp('config.js');
const SEMENTE = 3;
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : String(v));
const hexa = h => (h >>> 0).toString(16).padStart(8, '0');

// o roteiro de 600 passos depois do pré-jogo (o mesmo nos dois motores)
function roteiro(n) {
  const r = [];
  for (let i = 0; i < n; i++) {
    const a = 0.8 * Math.sin(i / 40);
    r.push({ x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, botoes: (i >= 90 && i < 170 ? BOTAO.CORRER : 0) | (i >= 260 && i < 280 ? BOTAO.PASSE : 0) | (i >= 420 && i < 445 ? BOTAO.CHUTE : 0) });
  }
  return r;
}
function hashNode(n) {
  const m = criarPartida({ semente: SEMENTE });
  const h0 = hashMundo(m);
  for (const e of roteiro(n)) {
    const t = { 0: { x: e.x, z: e.z, botoes: e.botoes } };
    Object.defineProperties(t, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } });
    passoPartida(m, t, null);
  }
  return { h0, h: hashMundo(m) };
}
const NODE = hashNode(600);

/** Desvio e número de cores de um print (PNG) — decodificado numa página auxiliar. */
async function estatisticas(contexto, png) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const r = await aux.evaluate(async src => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.getElementById('c'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0, s2 = 0, n = 0; const cores = new Set();
    for (let k = 0; k < d.length; k += 4 * 7) { const l = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; s += l; s2 += l * l; n++; cores.add((d[k] >> 4) * 256 + (d[k + 1] >> 4) * 16 + (d[k + 2] >> 4)); }
    const m = s / n;
    return { desvio: Math.sqrt(Math.max(0, s2 / n - m * m)), cores: cores.size };
  }, png.toString('base64'));
  await aux.close();
  return r;
}

/** As cartas de uma escalação na tela: folga, fora da tela, letra, nomes. */
async function conferirEscalacao(pg, t) {
  return pg.evaluate(t => {
    const g = window.__golaco, P = g.prejogo;
    const cs = P.escalacao.cartas(t);
    const W = innerWidth, H = innerHeight;
    const css = getComputedStyle(document.documentElement);
    const sa = k => parseFloat(css.getPropertyValue(k)) || 0;
    const area = { l: sa('--sa-l'), r: W - sa('--sa-r'), t: sa('--sa-t'), b: H - sa('--sa-b') };
    let folga = Infinity, fora = 0, cortados = 0, fonte = Infinity;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i].rect;
      if (a.x < area.l - 0.5 || a.y < area.t - 0.5 || a.x + a.w > area.r + 0.5 || a.y + a.h > area.b + 0.5) fora++;
      if (cs[i].cortado) cortados++;
      fonte = Math.min(fonte, cs[i].fonteMin);
      for (let k = i + 1; k < cs.length; k++) {
        const b = cs[k].rect;
        const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        folga = Math.min(folga, Math.max(gx, gy));
      }
    }
    const tm = g.estadoTime(t);
    const ordem = Object.values(tm.vagas);
    const ids = cs.map(c => c.id);
    // o botão Pular (se estiver visível) não encosta em carta nem no nome do time
    const pu = P.escalacao.pular, info = P.escalacao.info(t);
    const toca = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let pularEncosta = 0;
    if (pu.visivel) {
      for (const c of cs) if (toca(pu, c.rect)) pularEncosta++;
      const nome = document.querySelectorAll('.pj-esc')[t].querySelector('.pj-esc-nome').getBoundingClientRect();
      if (toca(pu, { x: nome.left, y: nome.top, w: nome.width, h: nome.height })) pularEncosta++;
    }
    return { n: cs.length, folga, fora, cortados, fonte, ordemOk: ids.length === 11 && ids.every((id, i) => id === ordem[i]), nomes: cs.map(c => c.nome).join(', '), pularEncosta, info };
  }, t);
}

const srv = await servidor(0, raiz);
const PERFIS = [
  { nome: 'PC 1280×720 Alta', largura: 1280, altura: 720, dpr: 1, q: 'alta', toque: false, pc: true },
  { nome: 'celular 844×390 Média', largura: 844, altura: 390, dpr: 2, q: 'media', toque: true, pc: false },
];
const memoria = {};
try {
  // ---------------------------------------------------------------- 1b) sem ?prejogo, com webdriver: não liga
  {
    const { navegador, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
    await pg.goto(`${srv.url}?semente=${SEMENTE}&q=media`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    const r = await pg.evaluate(() => ({ ativo: !!window.__golaco.prejogo?.ativo, wd: navigator.webdriver }));
    meta('Testes automatizados (webdriver) abrem direto no jogo', `pré-jogo ativo ${r.ativo} (webdriver ${r.wd})`, 'false', r.ativo === false && erros.length === 0);
    // memória do jogo sem pré-jogo (item 8): 120 quadros do jogo
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
    memoria.sem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
    await navegador.close();
  }

  for (const P of PERFIS) {
    const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: P.largura, altura: P.altura, dpr: P.dpr, toque: P.toque });
    await pg.goto(`${srv.url}?prejogo=1&semente=${SEMENTE}&q=${P.q}&hora=dia${P.toque ? '&toque=1' : ''}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); });
    // ---------------------------------------------------------------- 1) abertura, tick 0
    const e1 = await pg.evaluate(() => {
      const g = window.__golaco, p = g.prejogo;
      if (!p) return null;
      return { ativo: p.ativo, fase: p.fase, tick: g.estado().tick, passos: g.passos, hud: getComputedStyle(document.getElementById('hud')).display, apito: g.estadio.som?.tocados?.apito ?? 0 };
    });
    if (!e1) {
      meta(`${P.nome}: pré-jogo na página (window.__golaco.prejogo)`, 'não existe: a página abre direto na saída de bola', 'existe', false);
      await navegador.close();
      continue;
    }
    meta(`${P.nome}: abre no pré-jogo (abertura), partida no tick 0, HUD escondido`, `ativo ${e1.ativo}, ${e1.fase}, tick ${e1.tick}, ${e1.passos} passos, HUD ${e1.hud}, ${erros.length} erros`, 'true, abertura, 0, 0, none, 0', e1.ativo && e1.fase === 'abertura' && e1.tick === 0 && e1.passos === 0 && e1.hud === 'none' && erros.length === 0);
    // o toque da abertura: começa as cenas e libera o som
    if (P.toque) await pg.touchscreen.tap(P.largura / 2, P.altura / 2); else await pg.mouse.click(P.largura / 2, P.altura / 2);
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(16); });
    // ---------------------------------------------------------------- 2) roteiro
    const R = await pg.evaluate(() => { const p = window.__golaco.prejogo; return { fase: p.fase, planos: p.planos, fimCenas: p.fimCenas, total: p.total }; });
    const ids = R.planos.map(p => p.id);
    const ordemEsperada = ['aereo', 'fachada', 'dentro', 'tunel', 'entrada', 'alto', 'filaMandante', 'filaVisitante', 'organizada', 'ladoDeLa', 'visitantes', 'geral', 'escalacao0', 'escalacao1'];
    meta(`${P.nome}: o toque da abertura começa as cenas; ≥ 11 planos na ordem; cenas 50–65 s`, `${R.fase}; ${ids.length} planos; cenas ${f1(R.fimCenas)} s (total ${f1(R.total)} s)`, 'rodando; a ordem do roteiro; 50–65 s', R.fase === 'rodando' && ids.length >= 11 && ordemEsperada.every((id, i) => ids[i] === id) && R.fimCenas >= 50 && R.fimCenas <= 65);
    // ---------------------------------------------------------------- 3) e 7) cada plano
    const porPlano = [];
    let piorCham = 0, piorTri = 0, semCor = [], poucos = [], fachadaPouca = [];
    for (const p of R.planos) {
      const t = (p.t0 + p.t1) / 2;
      const r = await pg.evaluate(t => {
        const g = window.__golaco, pj = g.prejogo;
        pj.irPara(t - 0.04); g.relogio.avancar(16); g.relogio.avancar(16);
        const d = pj.desenho;
        // a fachada na tela (o retângulo projetado da caixa dela, cortado pela tela)
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const x of [-93, 93]) for (const y of [0, 27.6]) for (const z of [-79, 79]) { const q = g.naTela(x, y, z); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
        const W = innerWidth, H = innerHeight;
        const cob = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)) / (W * H);
        return { plano: pj.plano, na: pj.andantesNaTela(), cham: d.chamadas, tri: d.triangulos, cob, som: g.estadio.som, cena: pj.somCena };
      }, t);
      const png = await pg.screenshot();
      const est = await estatisticas(contexto, png);
      porPlano.push({ id: p.id, ...r, ...est });
      if (r.plano !== p.id) semCor.push(`${p.id}≠${r.plano}`);
      if (est.desvio < 8 || est.cores < 40) semCor.push(`${p.id} (desvio ${f1(est.desvio)}, ${est.cores} cores)`);
      if (['tunel', 'entrada', 'alto', 'geral'].includes(p.id) && r.na < 8) poucos.push(`${p.id}: ${r.na}`);
      if (p.fora && r.cob < 0.25) fachadaPouca.push(`${p.id}: ${f1(r.cob * 100)}%`);
      piorCham = Math.max(piorCham, r.cham); piorTri = Math.max(piorTri, r.tri);
    }
    meta(`${P.nome}: cada plano aparece (o plano certo, print com cor)`, semCor.length ? semCor.join('; ') : `${porPlano.length} planos (desvio mín ${f1(Math.min(...porPlano.map(x => x.desvio)))})`, 'todos', semCor.length === 0);
    meta(`${P.nome}: túnel, entrada, plano alto e geral com ≥ 8 andantes na tela`, poucos.length ? poucos.join('; ') : porPlano.filter(x => ['tunel', 'entrada', 'alto', 'geral'].includes(x.id)).map(x => `${x.id} ${x.na}`).join(', '), '≥ 8', poucos.length === 0);
    meta(`${P.nome}: planos de fora com a fachada ≥ 25% da tela`, fachadaPouca.length ? fachadaPouca.join('; ') : porPlano.filter(x => R.planos.find(q => q.id === x.id)?.fora).map(x => `${x.id} ${f1(x.cob * 100)}%`).join(', '), '≥ 25%', fachadaPouca.length === 0);
    if (!P.pc) meta(`${P.nome}: ≤ 40 chamadas de desenho e ≤ 130 mil triângulos em todo plano`, `pior ${piorCham} chamadas, ${f1(piorTri / 1000)} mil tri (${porPlano.map(x => `${x.id} ${x.cham}/${Math.round(x.tri / 1000)}k`).join(' ')})`, '≤ 40; ≤ 130 mil', piorCham <= 40 && piorTri <= 130000);
    // as filas: a câmera passando (30 qps) — cada um dos 11 do time pelo terço central do quadro
    for (const id of ['filaMandante', 'filaVisitante']) {
      const p = R.planos.find(q => q.id === id);
      const r = await pg.evaluate(({ t0, t1, time }) => {
        const g = window.__golaco, pj = g.prejogo;
        const vistos = new Set();
        let c0 = null, c1 = null;
        for (let t = t0 + 0.01; t < t1 - 0.01; t += 1 / 30) {
          pj.irPara(t); g.relogio.avancar(0, { desenhar: false });
          const c = pj.camera; if (!c0) c0 = c; c1 = c;
          const W = innerWidth;
          const s = g.estadoTime(time);
          for (const id of Object.values(s.vagas)) {
            const q = pj.posicaoAndante(id);
            if (!q) continue;
            const v = g.naTela(q.x, 1.75, q.z);
            if (v.x > W / 3 && v.x < 2 * W / 3) vistos.add(id);
          }
        }
        return { vistos: vistos.size, anda: Math.hypot(c1.x - c0.x, c1.z - c0.z) };
      }, { t0: p.t0, t1: p.t1, time: p.time });
      meta(`${P.nome}: ${id === 'filaMandante' ? 'fila do mandante' : 'fila do visitante'} — os 11 passam pelo terço central, a câmera anda ≥ 8 m`, `${r.vistos}/11; ${f1(r.anda)} m`, '11/11; ≥ 8 m', r.vistos === 11 && r.anda >= 8);
    }
    // som durante o pré-jogo (de fora abafado; por dentro aberto)
    const fora = porPlano.find(x => x.id === 'aereo'), dentro = porPlano.find(x => x.id === 'dentro');
    meta(`${P.nome}: som do pré-jogo (contexto rodando, camadas do leito; de fora abafado, por dentro aberto)`, `contexto ${dentro?.som?.contexto}, laços ${(dentro?.som?.lacos ?? []).join('/') || '—'}; filtro de fora ${fora?.cena?.filtro} Hz, por dentro ${dentro?.cena?.filtro} Hz`, 'running; ≥ 1 laço; < 1000; 18000', dentro?.som?.contexto === 'running' && (dentro?.som?.lacos?.length ?? 0) >= 1 && fora?.cena?.filtro < 1000 && dentro?.cena?.filtro >= 18000);
    // ---------------------------------------------------------------- 4) escalação (e nas outras telas)
    for (const t of [0, 1]) {
      await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; const p = pj.planos.find(q => q.id === `escalacao${t}`); pj.irPara(p.t0 + 2); g.relogio.avancar(16); }, t);
      const c = await conferirEscalacao(pg, t);
      meta(`${P.nome}: escalação ${t === 0 ? 'do mandante' : 'do visitante'} — 11 titulares na ordem, nada encosta`, `${c.n} cartas (${c.nomes}); folga ${f1(c.folga)} px; fora ${c.fora}; letra ${f1(c.fonte)} px; cortados ${c.cortados}; Pular encosta ${c.pularEncosta}`, '11 na ordem; ≥ 6 px; 0; ≥ 10 px; 0; 0', c.n === 11 && c.ordemOk && c.folga >= 6 && c.fora === 0 && c.fonte >= 10 && c.cortados === 0 && c.pularEncosta === 0);
    }
    if (P.pc) {
      for (const [w, h] of [[568, 320], [667, 375], [1920, 1080]]) {
        await pg.setViewportSize({ width: w, height: h });
        let pior = { folga: Infinity, fora: 0, fonte: Infinity, cortados: 0, ordem: true, n: 11, pular: 0 };
        for (const t of [0, 1]) {
          await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; const p = pj.planos.find(q => q.id === `escalacao${t}`); pj.irPara(p.t0 + 2); g.relogio.avancar(16); g.relogio.avancar(16); }, t);
          const c = await conferirEscalacao(pg, t);
          pior = { folga: Math.min(pior.folga, c.folga), fora: pior.fora + c.fora, fonte: Math.min(pior.fonte, c.fonte), cortados: pior.cortados + c.cortados, ordem: pior.ordem && c.ordemOk, n: Math.min(pior.n, c.n), pular: pior.pular + c.pularEncosta };
        }
        meta(`Escalação em ${w}×${h}: nada encosta`, `folga ${f1(pior.folga)} px; fora ${pior.fora}; letra ${f1(pior.fonte)} px; cortados ${pior.cortados}; Pular encosta ${pior.pular}`, '≥ 6 px; 0; ≥ 10 px; 0; 0', pior.n === 11 && pior.ordem && pior.folga >= 6 && pior.fora === 0 && pior.fonte >= 10 && pior.cortados === 0 && pior.pular === 0);
      }
      await pg.setViewportSize({ width: P.largura, height: P.altura });
      // ---------------------------------------------------------------- 2b) as duas escalações ~10 s cada (relógio de 50 ms)
      const tempos = await pg.evaluate(() => {
        const g = window.__golaco, pj = g.prejogo;
        pj.irPara(pj.fimCenas - 0.3);
        const cheia = { 0: 0, 1: 0 };
        let apitoAntes = g.estadio.som?.tocados?.apito ?? 0, n = 0;
        while (pj.ativo && n < 1000) {
          g.relogio.avancar(50, { desenhar: false });
          n++;
          if (!pj.ativo) break;
          apitoAntes = Math.max(apitoAntes, g.estadio.som?.tocados?.apito ?? 0);
          const c = pj.escalacao.cheia;
          if (c === 0 || c === 1) cheia[c] += 0.05;
        }
        const e = g.estado();
        return { cheia, apitoAntes, ativo: pj.ativo, tick: e.tick, passos: g.passos, hash: g.hash(), hud: getComputedStyle(document.getElementById('hud')).display, apito: g.estadio.som?.tocados?.apito ?? 0, estado: e.relogio?.estado };
      });
      meta(`${P.nome}: escalação do mandante inteira 10 ± 0,2 s, depois a do visitante`, `${f1(tempos.cheia[0])} s e ${f1(tempos.cheia[1])} s`, '10 ± 0,2 s cada', Math.abs(tempos.cheia[0] - 10) <= 0.2 && Math.abs(tempos.cheia[1] - 10) <= 0.2);
      meta(`${P.nome}: fim natural → jogo no tick 0 com o hash de criarPartida (Node)`, `ativo ${tempos.ativo}, tick ${tempos.tick}, ${tempos.passos} passos, HUD ${tempos.hud}, relógio ${tempos.estado}; hash ${hexa(tempos.hash)} × Node ${hexa(NODE.h0)}`, 'false, 0, iguais', !tempos.ativo && tempos.tick === 0 && tempos.hud !== 'none' && tempos.hash === NODE.h0);
      meta(`${P.nome}: o apito da saída só no fim do pré-jogo`, `${tempos.apitoAntes} antes; ${tempos.apito} depois`, '0; 1', tempos.apitoAntes === 0 && tempos.apito === 1);
      const h = await pg.evaluate(rot => window.__golaco.rodarPassos(rot.length, rot), roteiro(600));
      meta(`${P.nome}: 600 passos depois do pré-jogo (Node = Chromium)`, `Chromium ${hexa(h)} · Node ${hexa(NODE.h)}`, 'iguais', h === NODE.h);
    } else {
      // ---------------------------------------------------------------- 5) pular: toque = próximo bloco; botão Pular = jogo
      const b = await pg.evaluate(() => { const g = window.__golaco, pj = g.prejogo; pj.irPara(20); g.relogio.avancar(16); return pj.bloco; });
      await pg.touchscreen.tap(P.largura * 0.6, P.altura * 0.4);
      const b1 = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      await pg.touchscreen.tap(P.largura * 0.6, P.altura * 0.4);
      const b2 = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      meta(`${P.nome}: um toque avança 1 bloco no mesmo quadro`, `${b} → ${b1} → ${b2}`, 'cenas → escalacao0 → escalacao1', b === 'cenas' && b1 === 'escalacao0' && b2 === 'escalacao1');
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const pu = await pg.evaluate(() => window.__golaco.prejogo.escalacao.pular);
      await pg.touchscreen.tap(pu.x + pu.w / 2, pu.y + pu.h / 2);
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const fim = await pg.evaluate(() => { const g = window.__golaco, e = g.estado(); return { ativo: g.prejogo.ativo, tick: e.tick, hash: g.hash(), hud: getComputedStyle(document.getElementById('hud')).display, toque: getComputedStyle(document.getElementById('toque')).display, apito: g.estadio.som?.tocados?.apito ?? 0 }; });
      meta(`${P.nome}: botão Pular → direto ao jogo (HUD e toque de volta; tick 0 e o hash de criarPartida)`, `ativo ${fim.ativo}, tick ${fim.tick}, HUD ${fim.hud}, toque ${fim.toque}; hash ${hexa(fim.hash)} × Node ${hexa(NODE.h0)}; apito ${fim.apito}`, 'false, 0, visíveis, iguais, 1', !fim.ativo && fim.tick === 0 && fim.hud !== 'none' && fim.toque !== 'none' && fim.hash === NODE.h0 && fim.apito === 1);
      const h = await pg.evaluate(rot => window.__golaco.rodarPassos(rot.length, rot), roteiro(600));
      meta(`${P.nome}: 600 passos depois de pular (Node = Chromium)`, `Chromium ${hexa(h)} · Node ${hexa(NODE.h)}`, 'iguais', h === NODE.h);
    }
    // ---------------------------------------------------------------- 8) memória depois do pré-jogo
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
    const mem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
    if (P.pc) memoria.pc = mem;
    meta(`${P.nome}: sem erro no console`, `${erros.length}${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}`, '0', erros.length === 0);
    await navegador.close();
  }
  // Esc no PC (pular tudo) e a memória (item 8)
  {
    const { navegador, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
    await pg.goto(`${srv.url}?prejogo=1&semente=${SEMENTE}&q=alta&hora=dia`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    const ok = await pg.evaluate(() => !!window.__golaco.prejogo);
    if (ok) {
      await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.prejogo.comecar(); g.prejogo.irPara(30); g.relogio.avancar(16); });
      await pg.keyboard.press('Enter');
      const b = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      await pg.keyboard.press('Escape');
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const fim = await pg.evaluate(() => { const g = window.__golaco; return { ativo: g.prejogo.ativo, tick: g.estado().tick, menu: g.estado().menuAberto, hash: g.hash() }; });
      meta('PC: Enter → próximo bloco; Esc → direto ao jogo (sem abrir o menu)', `Enter: ${b}; Esc: ativo ${fim.ativo}, tick ${fim.tick}, menu ${fim.menu}, hash ${hexa(fim.hash)}`, 'escalacao0; false, 0, false, o de criarPartida', b === 'escalacao0' && !fim.ativo && fim.tick === 0 && !fim.menu && fim.hash === NODE.h0);
      await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
      const mem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
      meta('Memória: geometrias e texturas depois do pré-jogo = as do jogo sem ele', `com pré-jogo ${mem.geometrias} geo / ${mem.texturas} tex; sem ${memoria.sem.geometrias} / ${memoria.sem.texturas}`, 'iguais', mem.geometrias === memoria.sem.geometrias && mem.texturas === memoria.sem.texturas);
      meta('PC (Esc): sem erro no console', `${erros.length}`, '0', erros.length === 0);
    }
    await navegador.close();
  }
} finally {
  await srv.fechar();
}

let falhas = 0;
for (const r of res) {
  if (!r.ok) falhas++;
  console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}   (alvo: ${r.alvo})`);
}
console.log(falhas ? `\nteste-prejogo: REPROVOU (${falhas})` : '\nteste-prejogo: PASSOU');
process.exit(falhas ? 1 : 0);
