// Desempenho no celular simulado (Etapa 3; plano 4.1, linha do celular): Chromium 844×390, qualidade
// Média, CPU 4× mais lenta (CDP Emulation.setCPUThrottlingRate), 30 s de partida 11×11 com a IA
// jogando pelo humano (?demo=1). Mede a CPU POR QUADRO sem o desenho da GPU (simulação + pose +
// atualização dos jogadores + câmera/HUD; window.__golaco.medirQuadro) — o Chromium daqui desenha
// por software, então o tempo de GPU não serve.
// Metas: CPU por quadro p95 ≤ 6 ms e média ≤ 3 ms (sobram ≥ 10 ms para a GPU a 60 qps); chamadas de
// desenho da partida ≤ as do treino + 2 (mesma câmera); geometrias e texturas iguais depois de 10
// substituições (5 por time; sem vazamento).
//   node tools/teste-desempenho-celular.mjs [--raiz <pasta do jogo>] [--segundos 30] [--cpu 4]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const SEG = +arg('--segundos', 30);
const CPU = +arg('--cpu', 4);
const DS = Math.max(0, Math.floor(+arg('--semente', 0) || 0)); // soma às sementes (outro conjunto)
const META = { p95: 6, media: 3, chamadas: 2 };
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));

const srv = await servidor(0, raiz);
const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
try {
  await pg.goto(`${srv.url}?q=media&demo=1&toque=1&entalhe=1&semente=${4 + DS}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  const info = await pg.evaluate(() => {
    const g = window.__golaco;
    return { partida: g.estado().modoTreino === 'partida' && typeof g.medirQuadro === 'function', jogadores: g.estado().jogadores, q: g.qualidade };
  });
  meta('A página abre na partida 11×11 com medirQuadro()', `modo partida ${info.partida}, ${info.jogadores} jogadores, qualidade ${info.q}`, 'partida, 22, media', info.partida && info.jogadores === 22 && info.q === 'media');
  if (!info.partida) throw new Error('a página não tem a partida (antes da Etapa 3)');

  // aquecimento (JIT) sem limitar a CPU, depois a CPU 4× mais lenta
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  const cdp = await contexto.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const med = await pg.evaluate(n => {
    const g = window.__golaco;
    g.medirQuadro({ zerar: true });
    for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    const r = g.medirQuadro({ zerar: true });
    const e = g.estado();
    return { ...r, relogio: e.relogio, placar: e.placar };
  }, Math.round(SEG * 60));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const txt = k => `méd ${f2(med[k].media)} · p95 ${f2(med[k].p95)} · máx ${f2(med[k].max)}`;
  meta(`CPU por quadro sem a GPU (CPU ${CPU}×, ${SEG} s de partida)`, `${txt('cpu')} ms em ${med.quadros} quadros (${med.passos} passos)`, `méd ≤ ${META.media}, p95 ≤ ${META.p95} ms`, med.cpu.media <= META.media && med.cpu.p95 <= META.p95 && med.passos >= SEG * 60 - 2);
  console.log(`      simulação ${txt('sim')} | pose ${txt('pose')} | jogadores ${txt('jogadores')} ms (relógio ${med.relogio?.minuto}', placar ${med.placar.join('×')})`);

  // chamadas de desenho: a mesma câmera no treino de ataque e na partida
  const cham = await pg.evaluate(DS => {
    const g = window.__golaco;
    const medir = () => { g.cameraLivre({ de: [0, 34, 46], para: [0, 0, 0], fov: 55 }); g.desenhar(); g.desenhar(); const c = g.estado().desenhoChamadas; g.cameraLivre(null); return c; };
    const partida = medir();
    g.reiniciar({ modo: 'ataque', semente: 4 + DS });
    g.relogio.avancar(1000 / 60, { desenhar: true });
    const treino = medir();
    return { partida, treino };
  }, DS);
  meta('Chamadas de desenho: partida ≤ treino + 2 (mesma câmera)', `partida ${cham.partida} · treino ${cham.treino}`, `≤ ${cham.treino + META.chamadas}`, cham.partida <= cham.treino + META.chamadas);

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
  meta('10 substituições (5 por time) feitas na parada', `pendentes ${vaz.pend.join('+')}, feitas ${vaz.feitas.join('+')} em ${vaz.quadros} quadros, ${vaz.jogadores} em campo`, '5 + 5, 22 em campo', vaz.feitas[0] === 5 && vaz.feitas[1] === 5 && vaz.jogadores === 22);
  meta('Sem vazamento: geometrias e texturas iguais depois das substituições', `geometrias ${vaz.antes.geo} → ${vaz.depois.geo} · texturas ${vaz.antes.tex} → ${vaz.depois.tex}`, 'iguais', vaz.antes.geo === vaz.depois.geo && vaz.antes.tex === vaz.depois.tex);
  meta('Sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
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
