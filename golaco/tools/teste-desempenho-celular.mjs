// Desempenho no celular simulado (Etapa 3; plano 4.1, linha do celular): Chromium 844×390, qualidade
// Média, CPU 4× mais lenta (CDP Emulation.setCPUThrottlingRate), 30 s de partida 11×11 com a IA
// jogando pelo humano (?demo=1). Mede a CPU POR QUADRO sem o desenho da GPU (simulação + pose +
// atualização dos jogadores + câmera/HUD; window.__golaco.medirQuadro) — o Chromium daqui desenha
// por software, então o tempo de GPU não serve.
// Metas: CPU por quadro p95 ≤ 6 ms e média ≤ 3 ms (sobram ≥ 10 ms para a GPU a 60 qps); chamadas de
// desenho da partida ≤ as do treino + 2 (mesma câmera); geometrias e texturas iguais depois de 10
// substituições (5 por time; sem vazamento); o quadro durante a comemoração do gol ≤ p95 do jogo + 1 ms.
// Etapa 5.1 (corpo humano, ?corpo=novo): DUAS páginas com a mesma semente — o manequim (padrão) e o corpo novo —, a CPU
// medida em blocos de 2 s alternados entre elas (a carga da máquina pesa igual nas duas). Metas do corpo novo na
// câmera de TV do celular (a do jogo; vários instantes, o pior): jogadores ≤ 30 mil triângulos, SOMBRA dos jogadores
// ≤ 25 mil (item novo: o manequim dá ~52 mil e reprova), chamadas dos jogadores ≤ 4 (+ indicadores, que não entram na
// conta: são os mesmos nos dois); CPU "jogadores" p95 ≤ 1,1× a do manequim na mesma execução; e as metas de sempre
// (CPU, chamadas, vazamento) também no corpo novo.
// Controle: --corpo manequim aplica as metas de desenho ao manequim (reprova na sombra e nos triângulos).
//   node tools/teste-desempenho-celular.mjs [--raiz <pasta do jogo>] [--segundos 30] [--cpu 4] [--corpo novo|manequim]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const SEG = +arg('--segundos', 30);
const CPU = +arg('--cpu', 4);
const DS = Math.max(0, Math.floor(+arg('--semente', 0) || 0)); // soma às sementes (outro conjunto)
const ALVO_CORPO = arg('--corpo', 'novo');
const META = { p95: 6, media: 3, chamadas: 2, triJog: 30000, triSombra: 25000, chamJog: 4, cpuJog: 1.1 };
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const mil = v => `${(v / 1000).toFixed(1)} mil`;

const srv = await servidor(0, raiz);
const { navegador, contexto, pagina: pgA, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
const errosB = [];
const NOME = { a: 'manequim', b: 'corpo novo' };
try {
  const pgB = await contexto.newPage();
  pgB.on('pageerror', e => errosB.push(String(e)));
  pgB.on('console', m => { if (m.type() === 'error') errosB.push(m.text()); });
  const URL0 = `${srv.url}?q=media&demo=1&toque=1&entalhe=1&replay=0&comemoracao=0&semente=${4 + DS}`;
  const pags = { a: pgA, b: pgB };
  const info = {};
  for (const k of ['a', 'b']) {
    // uma de cada vez (com a máquina carregada, as duas juntas passam do tempo de abrir)
    await pags[k].goto(URL0 + (k === 'b' ? '&corpo=novo' : ''), { waitUntil: 'load' });
    await pags[k].waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
    await pags[k].evaluate(() => window.__golaco.relogio.usarManual(true));   // o laço real para enquanto a outra abre
    info[k] = await pags[k].evaluate(() => {
      const g = window.__golaco;
      return { partida: g.estado().modoTreino === 'partida' && typeof g.medirQuadro === 'function', jogadores: g.estado().jogadores, q: g.qualidade, corpo: g.estado().corpo ?? 'manequim' };
    });
  }
  meta('A página abre na partida 11×11 com medirQuadro()', `modo partida ${info.a.partida}, ${info.a.jogadores} jogadores, qualidade ${info.a.q}`, 'partida, 22, media', info.a.partida && info.a.jogadores === 22 && info.a.q === 'media');
  if (!info.a.partida) throw new Error('a página não tem a partida (antes da Etapa 3)');
  meta('?corpo=novo abre com o corpo humano', `${info.b.corpo}, ${info.b.jogadores} jogadores, qualidade ${info.b.q}`, 'corpo, 22, media', info.b.corpo === 'corpo' && info.b.jogadores === 22 && info.b.q === 'media');

  // aquecimento (JIT) sem limitar a CPU, depois a CPU 4× mais lenta, em blocos de 2 s alternados entre as páginas
  for (const pg of [pgA, pgB]) await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.medirQuadro({ zerar: true }); });
  const cdp = { a: await contexto.newCDPSession(pgA), b: await contexto.newCDPSession(pgB) };
  const total = Math.round(SEG * 60), BLOCO = 120;
  for (let feito = 0; feito < total; feito += BLOCO) {
    for (const k of ['a', 'b']) {
      await cdp[k].send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await pags[k].evaluate(n => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); }, Math.min(BLOCO, total - feito));
      await cdp[k].send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  }
  const med = {};
  for (const k of ['a', 'b']) {
    med[k] = await pags[k].evaluate(() => {
      const g = window.__golaco;
      const r = g.medirQuadro({ zerar: true });
      const e = g.estado();
      return { ...r, relogio: e.relogio, placar: e.placar };
    });
  }
  const txt = (m, k) => `méd ${f2(m[k].media)} · p95 ${f2(m[k].p95)} · máx ${f2(m[k].max)}`;
  for (const k of ['a', 'b']) {
    const m = med[k];
    meta(`CPU por quadro sem a GPU — ${NOME[k]} (CPU ${CPU}×, ${SEG} s de partida)`, `${txt(m, 'cpu')} ms em ${m.quadros} quadros (${m.passos} passos)`, `méd ≤ ${META.media}, p95 ≤ ${META.p95} ms`, m.cpu.media <= META.media && m.cpu.p95 <= META.p95 && m.passos >= SEG * 60 - 2);
    console.log(`      ${NOME[k]}: simulação ${txt(m, 'sim')} | pose ${txt(m, 'pose')} | jogadores ${txt(m, 'jogadores')} ms (relógio ${m.relogio?.minuto}', placar ${m.placar.join('×')})`);
  }
  meta('CPU "jogadores" (poses + desenho dos jogadores): corpo novo ÷ manequim, p95', `${f2(med.b.jogadores.p95)} ÷ ${f2(med.a.jogadores.p95)} ms = ${f2(med.b.jogadores.p95 / med.a.jogadores.p95)}×`, `≤ ${META.cpuJog}×`, med.b.jogadores.p95 <= META.cpuJog * med.a.jogadores.p95);

  // desenho dos jogadores na câmera do jogo (TV do celular): 12 instantes em 24 s de jogo, o pior de cada número
  const des = {};
  for (const k of ['a', 'b']) {
    des[k] = await pags[k].evaluate(() => {
      const g = window.__golaco;
      const pior = { tri: 0, triSombra: 0, chamadas: 0, chamadasSombra: 0, instantes: 0 };
      for (let s = 0; s < 12; s++) {
        for (let i = 0; i < 119; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        g.relogio.avancar(1000 / 60, { desenhar: true });
        const j = g.estado().jogadoresDesenho;
        if (!j) continue;
        pior.instantes++;
        for (const c of ['tri', 'triSombra', 'chamadas', 'chamadasSombra']) pior[c] = Math.max(pior[c], j[c]);
      }
      return pior;
    });
  }
  const alvo = ALVO_CORPO === 'manequim' ? 'a' : 'b';
  const outro = alvo === 'a' ? 'b' : 'a';
  const d = des[alvo], o = des[outro];
  const rot = `${NOME[alvo]}${alvo === 'a' ? ' (CONTROLE)' : ''}`;
  meta(`Jogadores na câmera de TV do celular — ${rot}`, `${mil(d.tri)} tri (${NOME[outro]}: ${mil(o.tri)}), pior de ${d.instantes} instantes`, `≤ ${mil(META.triJog)}`, d.instantes >= 10 && d.tri > 0 && d.tri <= META.triJog);
  meta(`Sombra dos jogadores — ${rot}`, `${mil(d.triSombra)} tri em ${d.chamadasSombra} chamadas (${NOME[outro]}: ${mil(o.triSombra)} em ${o.chamadasSombra})`, `≤ ${mil(META.triSombra)}`, d.instantes >= 10 && d.triSombra > 0 && d.triSombra <= META.triSombra);
  meta(`Chamadas dos jogadores (sem os indicadores) — ${rot}`, `${d.chamadas} (${NOME[outro]}: ${o.chamadas})`, `≤ ${META.chamJog}`, d.chamadas > 0 && d.chamadas <= META.chamJog);

  for (const k of ['a', 'b']) {
    const pg = pags[k];
    // chamadas de desenho: a mesma câmera no treino de ataque e na partida. Os sinalizadores da torcida (1 chamada, só
    // nos ~30 s depois de um gol ou de uma saída de bola do tempo; nunca no treino) contam à parte: o custo deles é
    // medido no teste-estadio (item 12, festa ≤ 2 chamadas)
    const cham = await pg.evaluate(DS => {
      const g = window.__golaco;
      const medir = () => { g.cameraLivre({ de: [0, 34, 46], para: [0, 0, 0], fov: 55 }); g.desenhar(); g.desenhar(); const c = g.estado().desenhoChamadas; const sin = g.estadio?.festaVisual?.sinalizadores ? 1 : 0; g.cameraLivre(null); return [c, sin]; };
      const [partida, sinalizadores] = medir();
      g.reiniciar({ modo: 'ataque', semente: 4 + DS });
      g.relogio.avancar(1000 / 60, { desenhar: true });
      const [treino] = medir();
      return { partida, sinalizadores, treino };
    }, DS);
    meta(`Chamadas de desenho: partida ≤ treino + 2 (mesma câmera) — ${NOME[k]}`, `partida ${cham.partida}${cham.sinalizadores ? ` (${cham.sinalizadores} dos sinalizadores acesos neste instante, à parte)` : ''} · treino ${cham.treino}`, `≤ ${cham.treino + META.chamadas}`, cham.partida - cham.sinalizadores <= cham.treino + META.chamadas);

    // vazamento: 10 substituições (5 por time) e a memória da GPU igual
    const vaz = await pg.evaluate(DS => {
      const g = window.__golaco;
      g.reiniciar({ modo: 'partida', semente: 6 + DS, minutosPorTempo: 0.2 });
      for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: true });
      const antes = { geo: g.estado().geometrias, tex: g.estado().texturas };
      const eds = [0, 1].map(t => {
        const s = g.estadoTime(t);
        const el = window.__golaco.mundo.times[t].elenco;
        const campo = new Set(Object.values(s.vagas));
        const vagas = { ...s.vagas };
        const sai = Object.keys(s.vagas).filter(v => v !== 'GOL').slice(0, 5).map(v => s.vagas[v]);
        // reservas do mesmo elenco (ids do time: 1–23 ou 101–123), na ordem dos ids, sem goleiros
        const base = el === 'golaco' ? 0 : 100;
        const reservas = [];
        for (let n = 12; n <= 23 && reservas.length < 5; n++) if (!campo.has(base + n) && n !== 12 && n !== 23) reservas.push(base + n);
        const subs = sai.map((id, k) => ({ sai: id, entra: reservas[k] }));
        for (const p of subs) { const v = Object.keys(vagas).find(k => vagas[k] === p.sai); vagas[v] = p.entra; }
        return { tipo: 'editarTime', time: t, base: s.versao, formacao: s.formacao, vagas, substituicoes: subs, tatica: s.tatica };
      });
      g.rodarPassos(1, [{ x: 0, z: 0, botoes: 0, acoes: eds }]);
      const pend = [0, 1].map(t => g.estadoTime(t).pendente?.substituicoes?.length ?? 0);
      let n = 0;
      while (n < 3600 && (g.estadoTime(0).subs.feitas < 5 || g.estadoTime(1).subs.feitas < 5)) { g.relogio.avancar(1000 / 60, { desenhar: n % 30 === 0 }); n++; }
      for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: true });
      const e = g.estado();
      return { antes, depois: { geo: e.geometrias, tex: e.texturas }, pend, feitas: [g.estadoTime(0).subs.feitas, g.estadoTime(1).subs.feitas], quadros: n, jogadores: e.jogadores };
    }, DS);
    meta(`10 substituições (5 por time) feitas na parada — ${NOME[k]}`, `pendentes ${vaz.pend.join('+')}, feitas ${vaz.feitas.join('+')} em ${vaz.quadros} quadros, ${vaz.jogadores} em campo`, '5 + 5, 22 em campo', vaz.feitas[0] === 5 && vaz.feitas[1] === 5 && vaz.jogadores === 22);
    meta(`Sem vazamento: geometrias e texturas iguais depois das substituições — ${NOME[k]}`, `geometrias ${vaz.antes.geo} → ${vaz.depois.geo} · texturas ${vaz.antes.tex} → ${vaz.depois.tex}`, 'iguais', vaz.antes.geo === vaz.depois.geo && vaz.antes.tex === vaz.depois.tex);
    // comemoração do gol (CPU 4×): a página abre com ?comemoracao=0 (a cena seguraria a simulação nos 30 s medidos); aqui
    // ela é ligada e o quadro da cena (os 22 atores dela, junto com a simulação nos primeiros 2,5 s) é medido contra o p95
    // do jogo da mesma página
    if (await pg.evaluate(() => !!window.__golaco.comemoracao)) {
      await pg.evaluate(() => window.__golaco.comemoracao.ligada(true));
      const golC = await golRoteirizado(pg, { semente: 5, time: 0 });
      await cdp[k].send('Emulation.setCPUThrottlingRate', { rate: CPU });
      const mc = await pg.evaluate(() => {
        const g = window.__golaco;
        g.medirQuadro({ zerar: true }); g.comemoracao.zerarCusto();
        let n = 0;
        while (g.comemoracao.ativa && g.comemoracao.estado.estado === 'rodando' && n < 700) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
        return { q: g.medirQuadro({ zerar: true }), c: g.comemoracao.custo, n };
      });
      await cdp[k].send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await pg.evaluate(() => window.__golaco.comemoracao.ligada(false));
      meta(`Comemoração do gol (CPU ${CPU}×): CPU do quadro na cena — ${NOME[k]}`, golC.ok ? `méd ${f2(mc.q.cpu.media)} · p95 ${f2(mc.q.cpu.p95)} ms em ${mc.n} quadros (a cena: ${f2(mc.c.msPorTick)} ms por tick) × jogo p95 ${f2(med[k].cpu.p95)} ms` : 'o gol roteirizado não saiu',
        'p95 ≤ jogo p95 + 1 ms', golC.ok && mc.n > 300 && mc.q.cpu.p95 <= med[k].cpu.p95 + 1);
    }
  }
  meta('Sem erro no console (manequim e corpo novo)', erros.length + errosB.length ? [...erros, ...errosB].slice(0, 3).join(' | ') : '0', '0', erros.length + errosB.length === 0);
} catch (e) {
  meta('Execução', e.message, 'sem exceção', false);
} finally {
  await navegador.close();
  await srv.fechar();
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-desempenho-celular: PASSOU' : '\nteste-desempenho-celular: REPROVOU');
process.exit(ok ? 0 : 1);
