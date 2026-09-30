// Telas fora da partida: menu, partida rápida, campeonato, configurações, ajuda, diagnóstico.
import { TEAMS, teamById, POS_LABEL } from './teams.js';
import { Match } from './engine.js';
import { PitchRenderer } from './render.js';
import { SIM, QUALITY, QUALITY_KEYS, VERSION } from './config.js';
import { createSeason, table, topScorers, userGame, applyRound, matchSeed, validateSeason, LEAGUE_NAME } from './league.js';
import { loadSeasonRaw, saveSeason, clearSeason, loadHistory, DEFAULT_SETTINGS } from './storage.js';
import { h, crest, stars, kitDots, modal, segmented, switchInput, toast, nextFrame } from './dom.js';
import { log } from './log.js';
import { detectDevice, autoLevel } from './quality.js';

const back = (app, to = 'home') => h('button.btn.icon.ghost', { type: 'button', 'aria-label': 'Voltar', title: 'Voltar (Esc)', onclick: () => app.go[to]() }, '←');
const topbar = (app, title, to) => h('div.topbar', null, back(app, to), h('h2', null, title), h('span.spacer'));

// ---------- menu inicial ----------
export function homeScreen(app) {
  const saved = loadSeasonRaw();
  const hasSeason = validateSeason(saved) && !saved.done;
  const demo = h('canvas', { 'aria-hidden': 'true', style: { width: '100%', height: '100%', display: 'block' } });
  const el = h('section.screen#home', { 'aria-label': 'Menu inicial' },
    h('div.wrap.home', null,
      h('div.hero', null,
        h('div.brand', null, h('span.ball'), h('span', null, 'LANCE ', h('em', null, 'A'), ' LANCE')),
        h('h1', null, 'Assista, mexa no time, ', h('span', null, 'vire o jogo.')),
        h('p', null, 'Simulador de partidas de futebol com a bolinha correndo no campo. Cada passe, desarme e chute é calculado na hora. Você acompanha e decide táticas e substituições.'),
        h('div.mini-pitch', null, demo)),
      h('nav.menu', { 'aria-label': 'Menu principal' },
        h('button.btn.primary', { type: 'button', onclick: () => app.go.quick() }, h('span', null, 'Partida rápida', h('small', null, 'Escolha dois times e comande um deles')), h('span.arr', { 'aria-hidden': 'true' }, '›')),
        h('button.btn', { type: 'button', onclick: () => app.go.season() }, h('span', null, hasSeason ? 'Continuar campeonato' : 'Campeonato', h('small', null, hasSeason ? `${LEAGUE_NAME} · rodada ${saved.round + 1} de ${saved.rounds.length}` : `${LEAGUE_NAME} · 12 clubes, turno único`)), h('span.arr', { 'aria-hidden': 'true' }, '›')),
        h('button.btn', { type: 'button', onclick: () => app.go.settings() }, h('span', null, 'Configurações', h('small', null, `Qualidade: ${app.qualityLabel()}`)), h('span.arr', { 'aria-hidden': 'true' }, '›')),
        h('button.btn', { type: 'button', onclick: () => app.go.help() }, h('span', null, 'Como funciona', h('small', null, 'Controles, táticas e o que o simulador calcula')), h('span.arr', { 'aria-hidden': 'true' }, '›')),
        h('div.foot', null, h('span', null, `v${VERSION} · clubes e jogadores fictícios`), h('button', { type: 'button', onclick: () => app.go.diag() }, 'Diagnóstico')))));
  // partida de demonstração no fundo (só quando o canvas aparece: no celular ele fica oculto)
  let raf = 0, dead = false;
  requestAnimationFrame(() => {
    if (dead || demo.getBoundingClientRect().width < 50) return;
    const r = new PitchRenderer(demo);
    r.setQuality({ ...QUALITY.medio, particles: 0 });
    const m = new Match({ home: TEAMS[0], away: TEAMS[1], seed: 2024 });
    for (let i = 0; i < 400; i++) m.step();
    let last = 0, acc = 0;
    const loop = (now) => {
      if (dead) return;
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (document.hidden) return;
      acc += dt * 1.5;
      while (acc >= SIM.dt) { if (m.phase === 'halftime') m.resumeSecondHalf(); if (!m.finished) m.step(); acc -= SIM.dt; }
      try { r.draw(m, acc / SIM.dt, { view: 'completo', numbers: false }); } catch (e) { log.warn('demo', e.message); dead = true; }
    };
    raf = requestAnimationFrame(loop);
  });
  el.cleanup = () => { dead = true; cancelAnimationFrame(raf); };
  return el;
}

// ---------- partida rápida ----------
export function quickScreen(app) {
  const st = app.quick || (app.quick = { home: TEAMS[0].id, away: TEAMS[1].id, side: 0 });
  const pickers = [0, 1].map((side) => {
    const cur = h('div.cur');
    const grid = h('div.team-grid', { role: 'group', 'aria-label': side === 0 ? 'Mandante' : 'Visitante' });
    const draw = () => {
      const t = teamById(side === 0 ? st.home : st.away);
      cur.replaceChildren(crest(t, 56), h('div', null, h('div.nm', null, t.name), h('div.meta', null, `${t.city} · geral ${t.overall}`), h('div', null, stars(t), ' ', kitDots({ fill: t.primary, trim: t.secondary }), h('span.meta', null, ` ${t.tactics.formation}`))));
      grid.replaceChildren(...TEAMS.map((x) => h('button', {
        type: 'button', title: x.name, 'aria-label': x.name, 'aria-pressed': String(x.id === t.id),
        disabled: x.id === (side === 0 ? st.away : st.home),
        onclick: () => { if (side === 0) st.home = x.id; else st.away = x.id; drawAll(); },
      }, crest(x, 30), x.short)));
    };
    const el = h('div.picker', null, h('div.lbl', null, side === 0 ? 'Mandante' : 'Visitante'), cur, grid);
    el.draw = draw;
    return el;
  });
  const drawAll = () => { pickers.forEach((p) => p.draw()); sideSeg.replaceWith(sideSeg = mkSide()); };
  const mkSide = () => segmented([{ v: 0, label: teamById(st.home).short }, { v: 1, label: teamById(st.away).short }, { v: -1, label: 'Só assistir' }], st.side, (v) => { st.side = +v; }, { label: 'Quem você comanda' });
  let sideSeg = mkSide();
  const swap = h('button.btn.small.ghost', { type: 'button', title: 'Inverter mando', onclick: () => { [st.home, st.away] = [st.away, st.home]; if (st.side >= 0) st.side = 1 - st.side; drawAll(); } }, '⇄');
  const el = h('section.screen#quick', { 'aria-label': 'Partida rápida' },
    h('div.wrap', null,
      topbar(app, 'Partida rápida'),
      h('div.pickers', null, pickers[0], h('div.vs', null, 'x', h('br'), swap), pickers[1]),
      h('div.opts', null,
        h('div.opt-row', null, h('span.l', null, 'Você comanda', h('small', null, 'Táticas e substituições do time escolhido. O outro fica com a IA.')), sideSeg),
        h('div.opt-row', null, h('span.l', null, 'Visual', h('small', null, 'Completo mostra os 22 jogadores; "Só a bola" é a clássica tela de simulação.')),
          segmented([{ v: 'completo', label: 'Completo' }, { v: 'bola', label: 'Só a bola' }], app.settings.view, (v) => { app.settings.view = v; app.saveSettings(); }, { label: 'Visual' }))),
      h('div.actions', null,
        h('button.btn', { type: 'button', onclick: () => instantResult(app, teamById(st.home), teamById(st.away)) }, 'Resultado direto'),
        h('button.btn.primary', { type: 'button', autofocus: true, onclick: () => app.startMatch({ home: teamById(st.home), away: teamById(st.away), userSide: st.side < 0 ? null : st.side }) }, 'Começar partida ▶'))));
  pickers.forEach((p) => p.draw());
  return el;
}

/** Simula uma partida inteira sem assistir e abre o resumo. */
async function instantResult(app, home, away) {
  const seed = (Date.now() % 2147483647) || 1;
  const m = new Match({ home, away, seed });
  const prog = h('i');
  const dlg = modal(h('div', null, h('h3', null, 'Simulando…'), h('p.subtitle', null, `${home.name} x ${away.name}`), h('div.progress', null, prog)), { label: 'Simulando', dismissable: false });
  try {
    await runChunked(m, (f) => { prog.style.width = `${Math.round(f * 100)}%`; });
  } catch (e) { log.error(e); dlg.close(); toast('Falha na simulação', true); return; }
  dlg.close();
  app.startMatch({ home, away, userSide: null, seed, preplayed: m });
}

/** Roda a partida em blocos de ~12 ms para a interface continuar respondendo. */
export async function runChunked(m, onProgress) {
  const total = 2 * (m.H + 60);
  while (!m.finished) {
    const t0 = performance.now();
    while (!m.finished && performance.now() - t0 < 12) {
      if (m.phase === 'halftime') m.resumeSecondHalf(); else m.step();
    }
    onProgress?.(Math.min(1, m.tAll / total));
    await nextFrame();
  }
}

// ---------- campeonato ----------
export function seasonScreen(app) {
  const raw = loadSeasonRaw();
  if (raw && !validateSeason(raw)) { log.warn('Campeonato salvo inválido; descartado'); clearSeason(); toast('O campeonato salvo estava corrompido e foi descartado.', true, 4000); }
  const s = validateSeason(raw) ? raw : null;
  if (!s) return seasonPick(app);
  return seasonHub(app, s);
}

function seasonPick(app) {
  let pick = TEAMS[TEAMS.length - 1].id;
  const cur = h('div');
  const grid = h('div.team-grid', { role: 'group', 'aria-label': 'Escolha seu clube' });
  const draw = () => {
    const t = teamById(pick);
    cur.replaceChildren(h('div.picker', null, h('div.lbl', null, 'Seu clube'), h('div.cur', null, crest(t, 56), h('div', null, h('div.nm', null, t.name), h('div.meta', null, `${t.city} · geral ${t.overall}`), stars(t))), grid));
    grid.replaceChildren(...TEAMS.map((x) => h('button', { type: 'button', 'aria-label': x.name, title: x.name, 'aria-pressed': String(x.id === pick), onclick: () => { pick = x.id; draw(); } }, crest(x, 30), x.short)));
  };
  draw();
  return h('section.screen#season', { 'aria-label': 'Novo campeonato' },
    h('div.wrap', null, topbar(app, `Novo campeonato · ${LEAGUE_NAME}`),
      h('p', { style: { color: 'var(--muted)', marginTop: 0 } }, '12 clubes em turno único (11 rodadas). Você comanda um time; os outros jogos da rodada são simulados. O progresso fica salvo neste aparelho.'),
      cur,
      h('div.actions', null, h('button.btn.primary', { type: 'button', onclick: () => { const s = createSeason(pick); saveSeason(s); log.info('Campeonato criado', pick); app.go.season(); } }, 'Começar temporada ▶'))));
}

function seasonHub(app, s) {
  const me = teamById(s.user);
  const rows = table(s);
  const pos = rows.findIndex((r) => r.id === s.user) + 1;
  const formEl = (f) => h('span.form', null, f.map((x) => h('i', { style: { background: x === 'V' ? '#7ddc6a' : x === 'E' ? '#c9c9c9' : '#f0705a' }, title: { V: 'Vitória', E: 'Empate', D: 'Derrota' }[x] }, x)));
  const tbl = h('table.tbl', null,
    h('thead', null, h('tr', null, ['#', 'Clube', 'P', 'J', 'V', 'E', 'D', 'SG', 'Últ.'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, rows.map((r, i) => {
      const t = teamById(r.id);
      const tr = h('tr', null, h('td.pos', null, i + 1), h('td', null, h('span', null, crest(t, 18), t.name)), h('td.pts', null, r.pts), h('td', null, r.p), h('td', null, r.w), h('td', null, r.d), h('td', null, r.l), h('td', null, r.gd > 0 ? `+${r.gd}` : r.gd), h('td', null, formEl(r.form)));
      if (r.id === s.user) tr.classList.add('me');
      return tr;
    })));
  const scorers = topScorers(s, 6);
  const lastRound = s.results[s.results.length - 1];
  const cards = [];
  if (s.done) {
    const champ = teamById(rows[0].id);
    cards.push(h('div.card', null, h('h3', null, 'Temporada encerrada'),
      h('div.next', null, h('div.t', null, crest(champ, 72), `${champ.name} é campeão!`)),
      h('p', { style: { textAlign: 'center', color: 'var(--muted)' } }, `${me.name} terminou em ${pos}º com ${rows[pos - 1].pts} pontos.`),
      h('div.actions', { style: { justifyContent: 'center' } }, h('button.btn.primary', { type: 'button', onclick: () => { clearSeason(); app.go.season(); } }, 'Nova temporada'))));
  } else {
    const ug = userGame(s);
    const H = teamById(ug.home), A = teamById(ug.away);
    const prog = h('i');
    const progWrap = h('div.progress.hidden', null, prog);
    const playBtn = h('button.btn.primary', { type: 'button', onclick: () => playRound(app, s, true, prog, progWrap) }, 'Jogar e comandar ▶');
    const simBtn = h('button.btn', { type: 'button', onclick: () => playRound(app, s, false, prog, progWrap) }, 'Simular rodada');
    cards.push(h('div.card', null, h('h3', null, `Rodada ${s.round + 1} de ${s.rounds.length}`),
      h('div.next', null, h('div.t', null, crest(H, 56), H.name), h('div.vs', null, 'x'), h('div.t', null, crest(A, 56), A.name)),
      h('div.actions', { style: { justifyContent: 'center' } }, simBtn, playBtn), progWrap));
  }
  if (lastRound) {
    cards.push(h('div.card', null, h('h3', null, `Resultados da rodada ${s.results.length}`), h('div.results', null, lastRound.map((r) => {
      const el = h('div.r', null, h('span', null, teamById(r.home).name), h('b', null, `${r.hs} – ${r.as}`), h('span', null, teamById(r.away).name));
      if (r.home === s.user || r.away === s.user) el.classList.add('me');
      return el;
    }))));
  }
  cards.push(h('div.card', null, h('h3', null, 'Artilharia'), scorers.length ? h('div.results', null, scorers.map((x) => h('div.r', { style: { gridTemplateColumns: '1fr auto' } }, h('span', { style: { textAlign: 'left' } }, `${x.p.name} (${x.team.short})`), h('b', null, x.goals)))) : h('p', { style: { color: 'var(--muted)', margin: 0 } }, 'Ninguém marcou ainda.')));
  const abandon = h('button.btn.small.danger', { type: 'button', onclick: () => {
    let d;
    d = modal(h('div', null, h('h3', null, 'Abandonar campeonato?'), h('p.subtitle', null, 'O progresso salvo será apagado.'), h('div.foot-actions', null, h('button.btn', { type: 'button', autofocus: true, onclick: () => d.close() }, 'Cancelar'), h('button.btn.danger', { type: 'button', onclick: () => { d.close(); clearSeason(); app.go.home(); } }, 'Apagar'))), { label: 'Abandonar campeonato' });
  } }, 'Abandonar');
  return h('section.screen#season', { 'aria-label': 'Campeonato' },
    h('div.wrap', null,
      h('div.topbar', null, back(app), crest(me, 32), h('h2', null, `${me.name} · ${pos}º lugar`), h('span.spacer'), abandon),
      h('div.hub', null, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, ...cards), h('div.card', null, h('h3', null, `Classificação · ${LEAGUE_NAME}`), h('div', { style: { overflowX: 'auto' } }, tbl)))));
}

/** Joga a rodada: a partida do usuário (assistida ou simulada) + as outras simuladas. */
async function playRound(app, s, watch, prog, progWrap) {
  const ug = userGame(s);
  const seedU = matchSeed(s, s.round, ug.gi);
  const finish = async (userResult) => {
    progWrap?.classList.remove('hidden');
    const results = [];
    const games = s.rounds[s.round];
    for (let gi = 0; gi < games.length; gi++) {
      if (gi === ug.gi && userResult) { results.push(userResult); continue; }
      const m = new Match({ home: teamById(games[gi][0]), away: teamById(games[gi][1]), seed: matchSeed(s, s.round, gi) });
      await runChunked(m);
      results.push(m.result());
      if (prog) prog.style.width = `${Math.round(((gi + 1) / games.length) * 100)}%`;
    }
    applyRound(s, results);
    if (!saveSeason(s)) toast('Não foi possível salvar o progresso neste aparelho.', true, 4000);
    log.info(`Rodada ${s.round} concluída`);
    app.go.season();
  };
  if (watch) {
    app.startMatch({
      home: teamById(ug.home), away: teamById(ug.away), userSide: ug.home === s.user ? 0 : 1, seed: seedU,
      title: `${LEAGUE_NAME} · rodada ${s.round + 1}`,
      season: { s },
      onDone: async (m) => {
        const wait = modal(h('div', null, h('h3', null, 'Fechando a rodada…'), h('p.subtitle', null, 'Simulando os outros jogos.'), h('div.progress', null, prog = h('i'))), { label: 'Rodada', dismissable: false });
        try { await finish(m.result()); } catch (e) { log.error(e); toast('Falha ao fechar a rodada', true); }
        wait.close();
      },
      onExit: () => app.go.season(),
    });
  } else {
    for (const b of document.querySelectorAll('#season .card .btn')) b.disabled = true;
    try { await finish(null); } catch (e) { log.error(e); toast('Falha ao simular a rodada', true); app.go.season(); }
  }
}

// ---------- configurações ----------
export function settingsScreen(app) {
  const s = app.settings;
  const dev = detectDevice();
  const autoTxt = `Automático (${QUALITY[autoLevel(dev)].label.toLowerCase()} para este aparelho)`;
  const qSeg = segmented([{ v: 'auto', label: 'Auto' }, ...QUALITY_KEYS.map((k) => ({ v: k, label: QUALITY[k].label }))], s.quality, (v) => { app.setQuality(v); qHint.textContent = hintFor(v); }, { label: 'Qualidade gráfica' });
  const hintFor = (v) => (v === 'auto' ? `${autoTxt}. Ajusta sozinho se o aparelho não der conta.` : { baixo: 'Mínimo de efeitos, 30 quadros por segundo: poupa bateria.', medio: 'Sombras e textura leve do gramado.', alto: 'Rastro da bola, iluminação e alta resolução.', ultra: 'Resolução máxima, refletores e mais partículas.' }[v]);
  const qHint = h('small', null, hintFor(s.quality));
  const el = h('section.screen#settings', { 'aria-label': 'Configurações' },
    h('div.wrap', null, topbar(app, 'Configurações'),
      h('div.settings', null,
        h('div.opt-row', null, h('span.l', null, 'Qualidade gráfica', qHint), qSeg),
        h('div.opt-row', null, h('span.l', null, 'Visual do campo', h('small', null, 'Completo (22 jogadores) ou só a bola')), segmented([{ v: 'completo', label: 'Completo' }, { v: 'bola', label: 'Só a bola' }], s.view, (v) => { s.view = v; app.saveSettings(); }, { label: 'Visual' })),
        switchInput('Números nas camisas', s.numbers, (v) => { s.numbers = v; app.saveSettings(); }),
        switchInput('Som', s.sound, (v) => { s.sound = v; app.saveSettings(); app.applySound(); }, 'Apito e torcida sintetizados'),
        switchInput('Pausar em segundo plano', s.pauseOnBlur, (v) => { s.pauseOnBlur = v; app.saveSettings(); }, 'Pausa a partida quando você troca de aba ou de app'),
        switchInput('Reduzir animações', s.reducedMotion, (v) => { s.reducedMotion = v; app.saveSettings(); app.applyMotion(); }),
        switchInput('Mostrar desempenho', s.showStats, (v) => { s.showStats = v; app.saveSettings(); }, 'FPS, tempo de quadro e memória durante a partida'),
        h('div.opt-row', null, h('span.l', null, 'Dados salvos', h('small', null, 'Configurações, campeonato e histórico ficam só neste aparelho.')),
          h('button.btn.small.danger', { type: 'button', onclick: () => {
            let d;
            d = modal(h('div', null, h('h3', null, 'Apagar todos os dados?'), h('p.subtitle', null, 'Configurações, campeonato e histórico serão apagados deste aparelho.'), h('div.foot-actions', null, h('button.btn', { type: 'button', autofocus: true, onclick: () => d.close() }, 'Cancelar'), h('button.btn.danger', { type: 'button', onclick: () => { d.close(); app.resetAll(); } }, 'Apagar tudo'))), { label: 'Apagar dados' });
          } }, 'Apagar dados')),
        h('div.opt-row', null, h('span.l', null, 'Padrões', h('small', null, 'Volta as configurações ao original')), h('button.btn.small', { type: 'button', onclick: () => { Object.assign(s, DEFAULT_SETTINGS); app.saveSettings(); app.setQuality(s.quality); app.applySound(); app.applyMotion(); app.go.settings(); toast('Configurações restauradas'); } }, 'Restaurar')))));
  return el;
}

// ---------- ajuda ----------
export function helpScreen(app) {
  return h('section.screen#help', { 'aria-label': 'Como funciona' },
    h('div.wrap', null, topbar(app, 'Como funciona'),
      h('div.help', null,
        h('p', null, 'O LANCE A LANCE simula a partida em tempo real: 22 jogadores com velocidade, energia e atributos próprios; a bola rola e voa com física (atrito, gravidade, quique). Quem está com a bola decide entre passar, conduzir, cruzar ou chutar comparando risco e recompensa; os marcadores pressionam, cobrem espaços e tentam o desarme. Faltas, cartões, impedimento, escanteios, pênaltis e acréscimos acontecem conforme o jogo.'),
        h('h3', null, 'Tempo'),
        h('p', null, 'Os 90 minutos passam em 10 minutos reais na velocidade 1×. Use 2×, 4× e 8× para acelerar, ou "Intervalo ⏭" / "Fim ⏭" para pular direto. Cada tempo tem acréscimos de acordo com gols, trocas e cartões.'),
        h('h3', null, 'Táticas'),
        h('ul', null,
          h('li', null, h('b', null, 'Formação: '), '4-4-2, 4-3-3, 4-2-3-1, 3-5-2 e 5-3-2. Os jogadores são redistribuídos pelas vagas que combinam com a posição de cada um.'),
          h('li', null, h('b', null, 'Mentalidade: '), 'da retranca ao "tudo ao ataque". Muda a altura do bloco, o avanço dos laterais e a vontade de finalizar.'),
          h('li', null, h('b', null, 'Pressão: '), 'quantos jogadores sobem no portador da bola e até onde. Pressão alta rouba mais bolas, mas cansa e faz mais faltas.'),
          h('li', null, h('b', null, 'Ritmo: '), 'cadenciado troca passes seguros; vertical busca o gol mais rápido e com mais corridas em profundidade.'),
          h('li', null, h('b', null, 'Substituições: '), 'até 5. Jogador cansado corre menos, erra mais e desarma pior. A bolinha vermelha no jogador indica fôlego baixo.')),
        h('h3', null, 'Atalhos'),
        h('p', null, h('kbd', null, 'Espaço'), ' pausa · ', h('kbd', null, '1'), '–', h('kbd', null, '4'), ' velocidade · ', h('kbd', null, 'T'), ' táticas · ', h('kbd', null, 'N'), ' pular · ', h('kbd', null, 'Esc'), ' sair/voltar'),
        h('p', null, 'Controle (gamepad): ', h('kbd', null, 'A'), ' pausa · ', h('kbd', null, 'LB'), '/', h('kbd', null, 'RB'), ' velocidade · ', h('kbd', null, 'Y'), ' táticas · ', h('kbd', null, 'X'), ' pular.'),
        h('h3', null, 'Estatísticas'),
        h('p', null, 'xG (gols esperados) mede a qualidade das chances: um chute da marca do pênalti vale ~0,3; de fora da área, ~0,05. O gráfico de Momento mostra quem pressionou em cada minuto. As notas dos jogadores (3 a 10) consideram gols, assistências, passes, desarmes, defesas e o resultado.'),
        h('p', { style: { color: 'var(--muted)' } }, 'Todos os clubes, jogadores e escudos são fictícios.'))));
}

// ---------- diagnóstico ----------
export function diagScreen(app) {
  const dev = detectDevice();
  const pre = h('pre', { tabindex: '0' });
  const info = () => [
    `LANCE A LANCE v${VERSION}`,
    `Navegador: ${navigator.userAgent}`,
    `Tela: ${screen.width}×${screen.height} @${devicePixelRatio}  janela ${innerWidth}×${innerHeight}`,
    `Núcleos: ${dev.cores}  memória: ${dev.mem ?? 'n/d'} GB  toque: ${dev.touch}  celular: ${dev.mobile}`,
    `Qualidade: ${app.settings.quality} → ${app.qualityLabel()}  (auto sugeriria ${autoLevel(dev)})`,
    `Quadros: ${app.monitor.fps.toFixed(1)} fps  p95 ${app.monitor.p95.toFixed(1)} ms  longos ${app.monitor.longFrames}`,
    `Histórico salvo: ${loadHistory().length} partidas`,
    '', '— Registro —', log.dump() || '(vazio)',
  ].join('\n');
  pre.textContent = info();
  const bench = h('button.btn.small', { type: 'button', onclick: async () => {
    bench.disabled = true; bench.textContent = 'Medindo…';
    await nextFrame();
    const t0 = performance.now();
    const m = new Match({ home: TEAMS[0], away: TEAMS[1], seed: 1 });
    m.runToEnd();
    const ms = performance.now() - t0;
    log.info(`Teste do motor: 1 partida completa em ${ms.toFixed(0)} ms (${(m.tick / ms).toFixed(0)} passos/ms)`);
    pre.textContent = info();
    bench.disabled = false; bench.textContent = 'Testar velocidade do motor';
  } }, 'Testar velocidade do motor');
  return h('section.screen#diag.diag', { 'aria-label': 'Diagnóstico' },
    h('div.wrap', null, topbar(app, 'Diagnóstico'),
      h('p', { style: { color: 'var(--muted)', marginTop: 0 } }, 'Informações técnicas para relatar problemas. Nada é enviado: copie e mande se precisar.'),
      h('div.actions', { style: { justifyContent: 'flex-start', marginTop: 0, marginBottom: '12px' } },
        h('button.btn.small', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(info()); toast('Copiado'); } catch { toast('Não foi possível copiar; selecione o texto.', true); } } }, 'Copiar'),
        bench,
        h('button.btn.small', { type: 'button', onclick: () => { pre.textContent = info(); } }, 'Atualizar')),
      pre));
}

export { POS_LABEL };
