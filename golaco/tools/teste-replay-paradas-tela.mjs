// Replays nas paradas no navegador (Chromium; pedido do dono de 22/10: "os replays de faltas e jogadas passando na tela
// enquanto o jogo tá parado"; PLANO-CENAS.md §2.7, contrato "Cenas das paradas"). Na página de verdade (main.js +
// js/lances.js + render/replay*.js), relógio manual, com ?replayParada=1 (o webdriver desliga os replays de parada, como a
// substituição). O lance é DE VERDADE: a semente sai de tools/lib/acha-parada.mjs (a partida IA × IA em Node com a entrada
// que a página ?demo=1 entrega, comoPagina; hash Node = Chromium) e a página chega no mesmo lance, no mesmo tick. A página
// anda depressa pela API (rodarPassos 'demo', que nunca arma o replay) até 2 s antes da bola morta do lance e o laço ao
// vivo (relógio manual) joga o resto:
//   V1 o replay começa sozinho no passo ANTES da montagem (tick = pr.inicio + 59 = a espera do Node), tipo 'parada', com a
//      classe, o lance, a chave e as câmeras do Node; o lance ARMADO antes dele é o da bola morta;
//   V2 mundo.tick parado do começo ao fim do replay; no 1º passo depois dele, a montagem (a simulação volta de onde parou);
//   V3 os planos do roteiro na ordem (tv → fechada | atras), a duração real de cada um = a do roteiro (±0,1 s), o total ≤
//      REPLAY_PARADA.maximo + 0,1 s; a marca REPLAY e o placar na tela, nenhum caractere fora do placar (no PC; no celular
//      só o "Pular");
//   V4 o hash no tick espera + 600: com o replay de parada = sem ele (?replayParada=0) = com ?replay=0 = com ?corpo=humano;
//   V5 o pulo por tecla (K, PC) e por toque (celular): o replay some em 1 quadro, os botões de toque voltam, a pausa não
//      abre e o aperto não vira jogada (com o K ainda segurado, 0 botão da pessoa chega ao passo em 40 passos — sim.js
//      j.botoesTime — e o controle: solto e apertado de novo, chega);
//   V6 com "Replays: Desligado" nenhum replay de parada: ?replay=0 até o lance (a simulação passa da espera sem segurar) e
//      a opção da pausa desligada no meio do jogo (o lance armado não toca);
//   V7 celular 844×390 Média (a régua do teste-replay G4/G6): chamadas de desenho por plano (tv e fechada ≤ o máximo ao vivo
//      + 1; atrás do gol ≤ + 3: o lado de cá entra no quadro, como no replay do gol), CPU do quadro do replay (sem o
//      desenho) p95 ≤ o do jogo + 1 ms, e nada some (os 22 e os 2 treinadores e a bola em todo quadro);
//   V8 online com duas abas pelo BroadcastChannel (?replayParada=1 nas DUAS; rev. R26): as duas mostram o replay no mesmo
//      tick, sem dessincronia, os hashes a cada 60 passos iguais e a partida segue; variante, na mesma partida, com os
//      replays desligados numa aba (replay.automatico(false): o estado do ?replay=0 e do "Replays: Desligado"): só a outra
//      segura, esta espera (para em ≤ o passo da outra + D + 2 durante o replay dela) e não há dessincronia;
//   V9 ?corpo=humano: o mesmo replay no mesmo tick, desenhado com o corpo novo (todos os bonecos do quadro), hash igual;
//   V10 (rev. R2) no tick da espera o mundo não é escrito: o hash e o estado da IA (j.ia, j.iaAcao) de todos iguais antes e
//      depois do quadro que começou o replay (a espera vem ANTES da entrada da demo, que escreve no mundo);
//   V11 (revisão de 22/10) a câmera 'fechada' com o lance na linha de fundo: o ponto do lance fica no quadro em todo o P2;
//   console sem erros.
// O PC e o online usam lances FORÇADOS onde o que se mede não depende do lance (V5, a parte da pausa do V6, V7 e V8:
// __golaco.replay.paradas.forcar, na bola morta mais próxima — o mesmo caminho do laço, seguraParaReplayParada no topo da
// volta): na partida IA × IA os replays de parada de verdade aparecem ~1 a cada 13 mil passos (8 sementes) e no online
// até as bolas mortas são raras (~1 a cada 3000 passos, 30 sementes) — o online joga em tempo real, ~30 passos/s com duas
// abas no CI. A semente do online é achada em Node (as 2 bolas mortas mais cedo) com a mesma conta das abas. Na versão sem
// os replays de parada (--raiz <cópia da base>) reprova V1–V3, V5, V7–V10 (não há replay na parada; o lance é achado com
// o js daqui); V4 e V6 passam lá (não têm o que medir: rev. R16 — a V9 aqui também exige o replay desenhado com o corpo
// novo, por isso reprova na base).
//   node tools/teste-replay-paradas-tela.mjs [--raiz <pasta do jogo>] [--so A,B,C,D,E,F,O] [--semente N]
//   (A = PC com o replay, B = sem ele, C = ?replay=0, D = PC com lance forçado, E = celular, F = ?corpo=humano, O = online)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { tabelaTexto } from './lib/medidas.mjs';
import { acharParada } from './lib/acha-parada.mjs';

const t0 = Date.now();
const args = process.argv.slice(2);
const arg = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const raiz = path.resolve(arg('--raiz') ?? RAIZ);
const so = arg('--so') ? new Set(arg('--so').split(',')) : null;
const roda = s => !so || so.has(s);
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => res.push({ nome, medido, alvo, ok: !!ok, info });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const erroCurto = e => String(e?.message ?? e).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0];
const errosTodos = [];
const marcas = [];         // [parte, Date.now() do começo] (os tempos de cada parte, no fim)
const marcar = n => marcas.push([n, Date.now()]);
const PULO = 120;          // passos antes da bola morta em que o laço ao vivo assume (2 s)
const DEPOIS = 600;        // o hash da V4 no tick espera + 600

// ------------------------------------------------------------------------------------------------ o lance (Node)
// a busca usa o js da pasta medida; na versão sem js/lances.js (a base), o daqui (a simulação é a mesma: o classificador
// fica fora do fecho do hash)
const jsMedido = path.join(raiz, 'js');
const jsBusca = fs.existsSync(path.join(jsMedido, 'lances.js')) ? jsMedido : path.join(RAIZ, 'js');
const sementeFixa = arg('--semente') ? [+arg('--semente')] : undefined;
let LANCE = null;
try {
  // o 1º replay de parada em ≤ 6000 passos (100 s) de cada semente: o lance cedo deixa o teste rápido e sem replays
  // automáticos antes (o gol e o impedimento não tocam no rodarPassos: o "espaço" de 30 s da página só fica maior)
  LANCE = await acharParada({ pastaJs: jsBusca, sementes: sementeFixa, maxTicks: 6000, comoPagina: true });
} catch (e) { meta('lance de verdade (Node, acha-parada)', erroCurto(e), 'sem exceção', false); }
if (!LANCE) meta('lance de verdade (Node, acha-parada): um replay de parada em ≤ 6000 passos nas sementes 1–30', 'nenhum', '≥ 1', false);
const ALVO = LANCE ? LANCE.espera + DEPOIS : null;
const URL_DEMO = s => `?q=baixa&hora=dia&demo=1&semente=${s}&comemoracao=0&substituicao=0&prejogo=0`;

const srv = await servidor(0, raiz);
async function pagina(nome, url, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load', timeout: 600000 });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 600000 });
  if (opc.corpo) await nav.pagina.waitForFunction(() => window.__golaco.estadio.corpo?.pronto || window.__golaco.estadio.corpo?.erro, null, { timeout: 180000 }).catch(() => {});
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, fechar: async () => { errosTodos.push(...nav.erros.map(e => `${nome}: ${e}`)); await nav.navegador.close(); } };
}

// no navegador: o texto visível fora do placar (e fora da marca REPLAY e do "Pular"), em todo o corpo da página
const TEXTOS_FORA = () => {
  const ok = e => {
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.01) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const out = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('.placar') || e.closest('#replay-marca') || e.closest('#replay-pular')) continue;
    let txt = '';
    for (const n of e.childNodes) if (n.nodeType === 3) txt += n.textContent;
    txt = txt.trim();
    if (txt && ok(e)) out.push(txt);
  }
  const vis = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };
  const pular = document.getElementById('replay-pular')?.getBoundingClientRect();
  return { fora: out, marca: vis('replay-marca') && document.getElementById('replay-marca').textContent.trim() === 'REPLAY', placar: !!document.querySelector('#hud .placar') && document.querySelector('#hud .placar').getBoundingClientRect().width > 0,
    pular: vis('replay-pular') ? { h: Math.round(pular.height), dentro: pular.right <= innerWidth && pular.bottom <= innerHeight } : null };
};

/**
 * Joga o lance na página: depressa (rodarPassos 'demo') até a bola morta − PULO e o laço ao vivo daí em diante — meio
 * quadro por vez até o tick da espera (0 ou 1 passo por quadro: o quadro que começa o replay não roda passo nenhum), a
 * foto do mundo no tick da espera e depois do quadro que começou o replay (V10), os quadros do replay (V2/V3, um quadro =
 * 1/60 s), o 1º passo depois dele e o laço até o tick ALVO (o hash da V4). o = {morta, espera, alvo, corpo (desenha 1 quadro
 * em 10 no replay e confere o corpo novo)}.
 */
async function jogarLance(pg, o) {
  await pg.evaluate(ate => { const g = window.__golaco; const n = ate - g.mundo.tick; if (n > 0) g.rodarPassos(n, 'demo'); }, o.morta - PULO);
  return pg.evaluate(({ o, TEXTOS }) => {
    const textos = new Function(`return (${TEXTOS})()`);
    const g = window.__golaco, m = g.mundo, R = g.replay, P = R.paradas ?? null;
    const est = () => R.estado;
    const ativoParada = () => !!est()?.ativo && est().tipo === 'parada';
    const out = { api: !!P, ligado: P ? P.ligado : null, armado: null, armadoTick: null, inicioTick: null, quadrosParada: 0, paradasVistas: [], quadrosNaEspera: 0 };
    const iaDe = () => JSON.stringify(m.jogadores.map(j => [j.id, j.ia ?? null, j.iaAcao ?? null]));
    let q = 0;
    const olhar = () => {
      if (P && !out.armado && P.armado) { out.armado = P.armado; out.armadoTick = m.tick; }
      if (m.tick === o.espera) out.quadrosNaEspera++;
      if (ativoParada()) { out.quadrosParada++; if (!out.paradasVistas.includes(m.tick)) out.paradasVistas.push(m.tick); }
    };
    // 1) até o tick da espera, meio quadro por vez (o replay pode começar antes: aí a V1 reprova pelo tick)
    while (q < 4000 && m.tick < o.espera && !est()?.ativo) { g.relogio.avancar(1000 / 120, { desenhar: false }); q++; olhar(); }
    // 2) V10: a foto no tick da espera e depois do quadro que começou o replay (sem passo nenhum no meio)
    const antes = { tick: m.tick, hash: g.hash(), ia: iaDe(), ativo: !!est()?.ativo };
    let k = 0;
    while (k < 6 && !est()?.ativo && m.tick === antes.tick) { g.relogio.avancar(1000 / 120, { desenhar: false }); k++; olhar(); }
    const depoisIa = iaDe();
    out.v10 = { tickAntes: antes.tick, ativoAntes: antes.ativo, k, tickDepois: m.tick, hashIgual: antes.hash === g.hash(), iaIgual: antes.ia === depoisIa, ativo: !!est()?.ativo, tipo: est()?.tipo ?? null };
    // 3) V1: o replay que começou
    const e0 = est();
    if (e0?.ativo) {
      out.inicioTick = m.tick;
      out.inicio = { tipo: e0.tipo, classe: e0.classe, lance: e0.lance, chave: e0.chave, fim: e0.fim, cams: [...e0.cams], duracoes: [...e0.duracoes], duracao: e0.duracao,
        pr: m.parada ? { inicio: m.parada.inicio, cobrador: m.parada.cobrador, tipo: m.parada.tipo } : null, estado: m.partida.estado };
      out.hist = P ? P.historico : null;
      // 4) V2/V3: os quadros do replay (1/60 s cada); a tela a 20 quadros do começo de cada plano
      const qs = [], telas = [], corpo = { quadros: 0, ok: 0, ex: '' };
      let n = 0, noPlano = 0, planoAnt = -1;
      while (est().ativo && n < 1500) {
        const e = est();
        if (e.plano !== planoAnt) { planoAnt = e.plano; noPlano = 0; }
        qs.push([m.tick, e.plano, e.cam, e.vel, e.tipo]);
        if (++noPlano === 20) telas.push({ cam: e.cam, ...textos() });
        const des = !!o.corpo && n % 10 === 0;
        g.relogio.avancar(1000 / 60, { desenhar: des });
        n++; olhar();
        if (des && est().ativo) {
          const c = g.estadio.corpo, d = R.desenho;
          corpo.quadros++;
          if (c?.pronto && d && c.bonecos === d.ids.length && c.niveis.reduce((a, b) => a + b, 0) === c.bonecos) corpo.ok++;
          else if (!corpo.ex) corpo.ex = `corpo ${c?.pronto ? 'pronto' : 'não pronto'}, bonecos ${c?.bonecos ?? '-'} × lista ${d?.ids.length ?? '-'}`;
        }
      }
      out.qs = qs; out.telas = telas; out.corpo = corpo;
      // 5) o 1º passo depois do replay: a montagem no tick seguinte
      const tFim = m.tick;
      let w = 0;
      while (w < 8 && m.tick === tFim) { g.relogio.avancar(1000 / 60, { desenhar: false }); w++; olhar(); }
      out.depois = { tFim, tick: m.tick, quadros: w, cobrador: m.parada?.cobrador ?? null, estado: m.partida.estado, inicio: m.parada?.inicio ?? null, replay: !!est()?.ativo };
    }
    // 6) até o tick ALVO (os outros replays tocam inteiros: não mudam a simulação); o fim em meio quadro (0 ou 1 passo)
    let z = 0;
    while (z < 9000 && m.tick < o.alvo - 2) { g.relogio.avancar(1000 / 60, { desenhar: false }); z++; olhar(); }
    while (z < 18000 && m.tick < o.alvo) { g.relogio.avancar(1000 / 120, { desenhar: false }); z++; olhar(); }
    out.hash = m.tick === o.alvo ? g.hash() : null;
    out.tickFim = m.tick;
    out.histFim = P ? P.historico : null;
    return out;
  }, { o, TEXTOS: TEXTOS_FORA.toString() });
}

/**
 * A próxima bola morta (rodarPassos 'demo' em lotes de 20: a montagem só sai 60 passos depois dela, e o lance armado até
 * 40 passos depois ainda toca no passo antes da montagem; ≥ 400 passos no anel) e um lance de teste armado nela (forcar).
 */
async function forcarLance(pg, tipo, ponto = null, naChave = 0) {
  return pg.evaluate(([tipo, ponto, naChave]) => {
    const g = window.__golaco, m = g.mundo, P = g.replay.paradas;
    if (!P) return { semApi: true };
    const desde = m.tick;
    // naChave (V11): o lance no lugar em que a bola ESTAVA na chave, como uma falta de verdade (lances.js grava o ponto do
    // lance), e só a bola morta com a bola a |x| ≥ naChave num tick de 0,5 a 3,5 s antes dela (a chave = o último desses).
    // Antes o ponto era fixo (±49, −24) e a bola morta, qualquer uma: com a bola longe do ponto o olhar entre o lance e a
    // bola o tirava do quadro por construção, e o resultado dependia da semente da página (24/10, D2: a bola a 39 m em x do
    // ponto, |x| 1,36 da tela; a base, 23 m, 0,33). Com a chave fixa em inicio − 90 a busca dependia da semente de outro
    // jeito (revisão do D2: com a demo da página IA × IA, nenhuma bola morta assim em 30000 passos da semente 2)
    const H = 256, hx = new Float64Array(H), hz = new Float64Array(H);
    const anota = () => { hx[m.tick % H] = m.bola.p.x; hz[m.tick % H] = m.bola.p.z; };
    const nova = () => m.partida?.estado === 'parada' && m.parada && m.parada.cobrador == null && m.parada.inicio > Math.max(400, desde) && m.tick - m.parada.inicio <= 40;
    const chaveDe = () => {
      if (!naChave) return m.parada.inicio - 90;
      for (let k = m.parada.inicio - 30; k >= Math.max(desde + 1, m.parada.inicio - 210, m.tick - H + 2); k--) if (Math.abs(hx[k % H]) >= naChave) return k;
      return null;
    };
    const serve = () => !naChave || chaveDe() != null;
    let n = 0;
    anota();
    if (naChave) { while (n < 30000 && !(nova() && serve())) { g.rodarPassos(1, 'demo'); anota(); n++; } }
    else while (n < 30000 && !nova()) { g.rodarPassos(20, 'demo'); n += 20; }
    if (!nova() || !serve()) return { semParada: true, n };
    const b = m.bola.p, chave = chaveDe(), chance = tipo === 'espalmada' || tipo === 'trave' || tipo === 'passouPerto';
    const cx = hx[chave % H], cz = hz[chave % H];
    const x = naChave ? cx : ponto ? (b.x >= 0 ? 1 : -1) * Math.abs(ponto.x) : b.x, z = naChave ? cz : ponto ? ponto.z : b.z;
    const ok = P.forcar({ classe: 'A', tipo, chave, fim: chance ? chave + 30 : chave, x, z, lado: x >= 0 ? 1 : -1 });
    return { ok, inicio: m.parada.inicio, chave, parada: m.parada.tipo, tick: m.tick, x, z, bx: b.x, bz: b.z };
  }, [tipo, ponto, naChave]);
}
/**
 * O laço ao vivo até o replay DE PARADA começar (≤ max quadros de 1/60 s). Outro replay no caminho (o do impedimento cujo
 * apito foi a bola morta achada: ele começa num microtask, depois do rodarPassos) é pulado — não muda a simulação.
 */
async function ateReplay(pg, max = 150) {
  return pg.evaluate(max => {
    const g = window.__golaco, m = g.mundo;
    let q = 0, outros = 0;
    for (;;) {
      const e = g.replay.estado;
      if (e?.ativo && e.tipo === 'parada') break;
      if (e?.ativo) { g.replay.pular(); outros++; }
      if (q >= max) break;
      g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
    }
    const e = g.replay.estado;
    return { q, outros, ativo: !!e?.ativo, tipo: e?.tipo ?? null, cams: e?.cams ?? [], tick: m.tick, inicio: m.parada?.inicio ?? null, hist: g.replay.paradas?.historico?.length ?? 0 };
  }, max);
}
const avancar = (pg, n) => pg.evaluate(n => { for (let i = 0; i < n; i++) window.__golaco.relogio.avancar(1000 / 60, { desenhar: false }); }, n);

// ------------------------------------------------------------------------------------------------ A (PC, com o replay)
let A = null, B = null, C = null, F = null;
marcar('A');
if (LANCE && roda('A')) try {
  const P = await pagina('A', URL_DEMO(LANCE.semente) + '&replayParada=1');
  try { A = await jogarLance(P.pagina, { morta: LANCE.morta, espera: LANCE.espera, alvo: ALVO }); } finally { await P.fechar(); }
} catch (e) { meta('A execução (PC, com o replay de parada)', erroCurto(e), 'sem exceção', false); }
marcar('B');
if (LANCE && roda('B')) try {
  const P = await pagina('B', URL_DEMO(LANCE.semente) + '&replayParada=0');
  try { B = await jogarLance(P.pagina, { morta: LANCE.morta, espera: LANCE.espera, alvo: ALVO }); } finally { await P.fechar(); }
} catch (e) { meta('B execução (PC, ?replayParada=0)', erroCurto(e), 'sem exceção', false); }
marcar('C');
if (LANCE && roda('C')) try {
  const P = await pagina('C', URL_DEMO(LANCE.semente) + '&replayParada=1&replay=0');
  try { C = await jogarLance(P.pagina, { morta: LANCE.morta, espera: LANCE.espera, alvo: ALVO }); } finally { await P.fechar(); }
} catch (e) { meta('C execução (PC, ?replay=0)', erroCurto(e), 'sem exceção', false); }
marcar('F');
if (LANCE && roda('F')) try {
  const P = await pagina('F', URL_DEMO(LANCE.semente) + '&replayParada=1&corpo=humano', { corpo: true });
  try { F = await jogarLance(P.pagina, { morta: LANCE.morta, espera: LANCE.espera, alvo: ALVO, corpo: true }); } finally { await P.fechar(); }
} catch (e) { meta('F execução (?corpo=humano)', erroCurto(e), 'sem exceção', false); }

const lanceTxt = LANCE ? `semente ${LANCE.semente}, ${LANCE.classe}/${LANCE.tipo}, bola morta ${LANCE.morta}, espera ${LANCE.espera}, chave ${LANCE.chave}, ${LANCE.cams.join('+')} ${f2(LANCE.dur)} s` : '-';
if (A) {
  const i = A.inicio, h = A.hist?.[0];
  const ok1 = !!i && i.tipo === 'parada' && A.inicioTick === LANCE.espera && i.pr && A.inicioTick === i.pr.inicio + 59 && i.pr.cobrador == null &&
    i.classe === LANCE.classe && i.lance === LANCE.tipo && i.chave === LANCE.chave && i.cams.join() === LANCE.cams.join() &&
    !!A.armado && A.armado.morta === LANCE.morta && A.armadoTick === LANCE.morta && !!h && h.tick === LANCE.espera && h.tipo === LANCE.tipo;
  meta('V1 o replay começa sozinho no passo antes da montagem (pr.inicio + 59), tipo parada, o lance do Node',
    i ? `${i.tipo} no tick ${A.inicioTick} (bola morta ${i.pr?.inicio ?? '-'} + ${i.pr ? A.inicioTick - i.pr.inicio : '-'}, cobrador ${i.pr?.cobrador ?? 'nenhum'}); ${i.classe}/${i.lance}, chave ${i.chave}, ${i.cams.join('+')}; armado no tick ${A.armadoTick ?? '-'} (morta ${A.armado?.morta ?? '-'}); histórico ${h ? `${h.tick} ${h.tipo}` : 'vazio'} — Node: ${lanceTxt}`
      : `nenhum replay (api ${A.api}; armado ${A.armado ? A.armado.tipo + ' no tick ' + A.armadoTick : 'nunca'}; tick ${A.v10.tickAntes} → ${A.v10.tickDepois}) — Node: ${lanceTxt}`,
    'tipo parada no tick da espera do Node, o mesmo lance', ok1);
  // V2: a simulação parada no replay inteiro e a montagem no passo seguinte
  const qs = A.qs ?? [], parada = qs.length > 0 && qs.every(x => x[0] === qs[0][0]);
  const d = A.depois;
  const monta = !!d && d.tick === d.tFim + 1 && !d.replay && (d.cobrador != null || d.estado === 'intervalo' || d.estado === 'fim');
  meta('V2 mundo.tick parado no replay inteiro; no 1º passo depois dele, a montagem (o tick seguinte)',
    qs.length ? `${qs.length} quadros no tick ${qs[0][0]}${parada ? '' : ' (ANDOU)'}; depois: tick ${d?.tFim} → ${d?.tick} em ${d?.quadros} quadros, cobrador ${d?.cobrador ?? 'nenhum'}, estado ${d?.estado}` : 'sem replay',
    'parada; tick + 1 com o cobrador', qs.length > 0 && parada && monta);
  // V3: os planos do roteiro, a duração de cada um e a tela
  const seq = [];
  for (const x of qs) if (!seq.length || seq[seq.length - 1].plano !== x[1]) seq.push({ plano: x[1], cam: x[2], vel: x[3] });
  const crescente = seq.every((s, k) => k === 0 || s.plano > seq[k - 1].plano);
  const porPlano = (i?.cams ?? []).map((c, k) => ({ cam: c, real: qs.filter(x => x[1] === k).length / 60, rot: i.duracoes[k] }));
  const durOk = porPlano.length > 0 && porPlano.every(p => Math.abs(p.real - p.rot) <= 0.1 + 1e-9);
  const esperado = LANCE ? ['tv', ['trave', 'espalmada', 'passouPerto'].includes(LANCE.tipo) ? 'atras' : 'fechada'] : [];
  const tl = A.telas ?? [], foraTxt = [...new Set(tl.flatMap(t => t.fora))];
  const telaOk = tl.length >= Math.min(2, seq.length) && tl.length > 0 && tl.every(t => t.marca && t.placar && t.fora.length === 0 && !t.pular);
  meta('V3 planos do roteiro (tv 1× → fechada | atrás 0,5×), cada um com a duração do roteiro (±0,1 s), total ≤ 8,1 s; só a marca REPLAY e o placar (0 caractere fora dele)',
    seq.length ? `quadros ${seq.map(s => `${s.cam}@${s.vel}`).join(' · ')}; ${porPlano.map(p => `${p.cam} ${f2(p.real)}/${f2(p.rot)}`).join(' · ')} s; total ${f2(qs.length / 60)} s; tela: marca ${tl.map(t => t.marca).join('/')}, placar ${tl.map(t => t.placar).join('/')}, texto fora ${foraTxt.length ? JSON.stringify(foraTxt) : '0 caractere'}` : 'sem replay',
    `${esperado.join(' · ')}; ±0,1 s; ≤ 8,1 s; marca e placar, 0 fora`,
    seq.length === 2 && crescente && seq.map(s => s.cam).join() === esperado.join() && seq[0].vel === 1 && seq[1].vel === 0.5 && durOk && qs.length / 60 <= 8.1 && telaOk);
  const v = A.v10;
  meta('V10 no tick da espera o mundo não é escrito: hash e j.ia/j.iaAcao de todos iguais antes e depois do quadro que começou o replay',
    `tick ${v.tickAntes} → ${v.tickDepois} (${v.k} meio-quadros, replay ${v.ativo ? v.tipo : 'não'}${v.ativoAntes ? ', já ativo antes' : ''}); hash ${v.hashIgual ? 'igual' : 'DIFERENTE'}, IA ${v.iaIgual ? 'igual' : 'DIFERENTE'}`,
    'o mesmo tick, replay parada, hash e IA iguais', !v.ativoAntes && v.ativo && v.tipo === 'parada' && v.tickAntes === LANCE.espera && v.tickDepois === v.tickAntes && v.hashIgual && v.iaIgual);
}
if (A && B) {
  const hs = [['com', A.hash], ['sem (?replayParada=0)', B.hash], ...(C ? [['?replay=0', C.hash]] : []), ...(F ? [['?corpo=humano', F.hash]] : [])];
  meta(`V4 hash no tick espera + ${DEPOIS} (${ALVO}): com o replay de parada = sem ele${C ? ' = ?replay=0' : ''}${F ? ' = ?corpo=humano' : ''}`,
    hs.map(([n, h]) => `${n} ${h ?? 'não chegou'}`).join(' / ') + `; sem: ${B.quadrosParada} quadros de replay de parada, ${B.quadrosNaEspera} meio-quadros no tick da espera`,
    'iguais (e nenhum replay de parada sem ele)', A.hash != null && hs.every(([, h]) => h === A.hash) && B.quadrosParada === 0 && (B.histFim ?? []).length === 0);
}
if (C) {
  meta('V6a ?replay=0 ("Replays: Desligado"): nenhum replay de parada; a simulação passa da espera sem segurar',
    `ligado ${C.ligado}; ${C.quadrosParada} quadros de replay de parada; histórico ${(C.histFim ?? []).length}; ${C.quadrosNaEspera} meio-quadros no tick da espera; chegou no tick ${C.tickFim}`,
    'false; 0; 0; ≤ 3 meio-quadros', C.ligado !== true && C.quadrosParada === 0 && (C.histFim ?? []).length === 0 && C.quadrosNaEspera <= 3 && C.tickFim === ALVO);
}
if (F) {
  const c = F.corpo ?? { quadros: 0, ok: 0 };
  meta('V9 ?corpo=humano: o mesmo replay no mesmo tick, desenhado com o corpo novo (todos os bonecos da lista)',
    F.inicio ? `${F.inicio.tipo} no tick ${F.inicioTick} (Node ${LANCE.espera}), ${F.inicio.cams.join('+')}; corpo em ${c.ok}/${c.quadros} quadros desenhados${c.ex ? ` (ex.: ${c.ex})` : ''}` : 'nenhum replay',
    'parada no tick do Node; todos', !!F.inicio && F.inicio.tipo === 'parada' && F.inicioTick === LANCE.espera && c.quadros > 0 && c.ok === c.quadros);
}

// ------------------------------------------------------------------------------------------------ D (PC, lance forçado)
marcar('D');
if (roda('D')) try {
  const P = await pagina('D', `?q=baixa&hora=dia&semente=${LANCE?.semente ?? 4}&replayParada=1&comemoracao=0&substituicao=0&prejogo=0`);
  try {
    const pg = P.pagina;
    const f1 = await forcarLance(pg, 'faltaPerto');
    const a1 = await ateReplay(pg);
    let k1 = null, k2 = null;
    if (a1.ativo && a1.tipo === 'parada') {
      await avancar(pg, 20);
      await pg.keyboard.down('KeyK');
      k1 = await pg.evaluate(() => {
        const g = window.__golaco, m = g.mundo;
        // os botões da pessoa que chegam ao passo (sim.js j.botoesTime: a entrada do time do humano, antes do CONTER)
        const botoesDaPessoa = () => m.jogadores.find(j => j.time === 0)?.botoesTime | 0;
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const r = { ativo: g.replay.estado.ativo, menu: g.estado().menuAberto, tick0: m.tick, botoes: 0, cargas: 0 };
        for (let i = 0; i < 40; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (botoesDaPessoa()) r.botoes++; if (g.estado().jogador?.carga) r.cargas++; }
        r.passos = m.tick - r.tick0; r.cobrador = m.parada?.cobrador ?? null;
        return r;
      });
      await pg.keyboard.up('KeyK');
      await avancar(pg, 3);
      // o controle: solto e apertado de novo, o K chega ao jogador (a medida acima não é vazia)
      await pg.keyboard.down('KeyK');
      k2 = await pg.evaluate(() => { const g = window.__golaco; let b = 0; for (let i = 0; i < 6; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.mundo.jogadores.find(j => j.time === 0)?.botoesTime | 0) b++; } return b; });
      await pg.keyboard.up('KeyK');
    }
    meta('V5a o pulo pela tecla (K, PC): o replay some em 1 quadro, a pausa não abre e o K segurado não vira jogada',
      f1.semApi ? 'sem a API de replays de parada' : !a1.ativo ? `nenhum replay em ${a1.q} quadros (lance forçado na bola morta ${f1.inicio ?? '-'}, ${f1.parada ?? '-'})` : k1 ? `${a1.tipo} no tick ${a1.tick} (bola morta ${f1.inicio} + ${a1.tick - f1.inicio}); K: replay ${k1.ativo}, pausa ${k1.menu}; com o K segurado ${k1.passos} passos, ${k1.botoes} com botão da pessoa no passo, ${k1.cargas} com carga; solto e apertado de novo: ${k2} de 6 com o botão` : `${a1.tipo}`,
      'some; não; 0 e 0; ≥ 1', !!k1 && !k1.ativo && !k1.menu && k1.passos >= 30 && k1.botoes === 0 && k1.cargas === 0 && k2 >= 1);
    // V11 (revisão de 22/10): a câmera 'fechada' com o lance na linha de fundo (|x| 49, perto da bandeirinha): o foco da TV
    // fica preso dentro do campo (camera.js limX) e, com o campo de visão × 0,5, o lance saía do quadro — agora o olhar vai
    // ao ponto entre o lance e a bola: o ponto do lance fica a |x| ≤ 0,6 e |y| ≤ 0,8 da tela em todo quadro do P2
    // (o lance onde a bola estava na chave, a |x| ≥ 45: além do limX ±38,5 do foco da TV, que é o que o V11 confere)
    const f11 = await forcarLance(pg, 'faltaPerto', null, 45);
    const a11 = await ateReplay(pg);
    const v11 = a11.ativo ? await pg.evaluate(([x, z]) => {
      const g = window.__golaco;
      let q = 0, n = 0, pior = 0, piorY = 0, atras = 0;
      while (q < 900 && g.replay.estado?.ativo) {
        g.relogio.avancar(1000 / 60); q++;
        const e = g.replay.estado;
        if (e?.ativo && e.cam === 'fechada') {
          const p = g.replay.paradas.ndc(x, 0.9, z);
          if (!p) continue;
          n++; if (p.atras) atras++;
          pior = Math.max(pior, Math.abs(p.x)); piorY = Math.max(piorY, Math.abs(p.y));
        }
      }
      return { q, n, pior, piorY, atras };
    }, [f11.x, f11.z]) : null;
    meta('V11 câmera \'fechada\' com o lance na linha de fundo: o ponto do lance no quadro em todo o P2',
      f11.semParada ? `nenhuma bola morta com a bola a |x| ≥ 45 de 0,5 a 3,5 s antes em ${f11.n} passos` : !a11.ativo ? `nenhum replay em ${a11.q} quadros (lance forçado em ${f11.x}, ${f11.z})` : `lance em (${f2(f11.x)}, ${f2(f11.z)}), chave ${f11.chave}, na bola morta ${f11.inicio} (${f11.parada}, bola em ${f2(f11.bx)}, ${f2(f11.bz)}); ${v11.n} quadros da 'fechada'; |x| máx ${v11.pior.toFixed(2).replace('.', ',')}, |y| máx ${v11.piorY.toFixed(2).replace('.', ',')}, ${v11.atras} atrás da câmera`,
      '≥ 30 quadros; |x| ≤ 0,6; |y| ≤ 0,8; 0', !!v11 && v11.n >= 30 && v11.pior <= 0.6 && v11.piorY <= 0.8 && v11.atras === 0);
    // V6b: a opção da pausa desligada no meio do jogo: o lance armado não toca
    await pg.evaluate(() => window.__golaco.abrirMenu());
    // o clique no próprio botão (o handler da pausa): o page.click espera a página "estabilizar" pelo requestAnimationFrame e,
    // com o relógio manual, chegou a esperar 120 s numa rodada (22/10) — o que se mede aqui é a opção, não o ponteiro
    await pg.waitForSelector('#menu .segmentado[data-grupo="replayAuto"] button[data-valor="desligado"]', { state: 'visible', timeout: 30000 });
    await pg.evaluate(() => document.querySelector('#menu .segmentado[data-grupo="replayAuto"] button[data-valor="desligado"]').click());
    await pg.evaluate(() => window.__golaco.fecharMenu());
    const f2b = await forcarLance(pg, 'faltaPerto');
    const v6 = await pg.evaluate(ini => {
      const g = window.__golaco, m = g.mundo;
      let q = 0, rep = 0, naEspera = 0;
      while (q < 160 && m.tick < ini + 70) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; if (g.replay.estado?.ativo) rep++; if (m.tick === ini + 59) naEspera++; }
      return { rep, naEspera, tick: m.tick, ligado: g.replay.paradas?.ligado ?? null, auto: g.replay.automatico(), hist: g.replay.paradas?.historico?.length ?? 0, armado: g.replay.paradas?.armado ?? null };
    }, f2b.inicio ?? 0);
    meta('V6b "Replays: Desligado" na pausa no meio do jogo: o lance armado não toca e a simulação passa da espera',
      f2b.semApi ? `automático ${v6.auto}; sem a API de replays de parada (nada a armar: ${v6.rep} quadros de replay)` : `automático ${v6.auto}, ligado ${v6.ligado}; lance forçado na bola morta ${f2b.inicio} (${f2b.parada}): ${v6.rep} quadros de replay, ${v6.naEspera} quadros no tick da espera, tick ${v6.tick}; histórico ${v6.hist}, armado ${v6.armado ? 'sim' : 'não'}`,
      'false; 0; ≤ 2; 2 (só os do V5a e do V11); não',
      // (na versão sem os replays de parada não há o que armar: passa só com a opção desligada e nenhum replay)
      f2b.semApi ? v6.auto === false && v6.rep === 0 : v6.auto === false && v6.ligado === false && v6.rep === 0 && v6.naEspera <= 2 && v6.tick >= (f2b.inicio ?? 0) + 70 && v6.hist === 2 && !v6.armado);
  } finally { await P.fechar(); }
} catch (e) { meta('D execução (PC, lance forçado: V5a, V6b)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ E (celular, 844×390 Média)
marcar('E');
if (roda('E')) try {
  const P = await pagina('E', `?q=media&hora=dia&semente=${LANCE?.semente ?? 4}&replayParada=1&comemoracao=0&substituicao=0&prejogo=0&toque=1&entalhe=1`, { largura: 844, altura: 390, toque: true });
  try {
    const pg = P.pagina;
    // o jogo ao vivo: chamadas em 60 quadros desenhados (1 em 2) e a CPU do quadro em 600 (como o teste-replay G4). O
    // desenho no Chromium daqui (SwiftShader) é a parte cara do teste: a GPU de software atrasa o que vem depois (o toque
    // chegou a esperar 47 s pelos quadros na fila)
    marcar('E ao vivo');
    // (um replay de verdade no caminho — gol, impedimento, uma parada que o classificador armou — é pulado: só o jogo conta)
    const vivo = await pg.evaluate(() => {
      const g = window.__golaco;
      const passo = des => { if (g.replay.estado?.ativo) g.replay.pular(); g.relogio.avancar(1000 / 60, { desenhar: des }); };
      g.rodarPassos(300, 'demo');
      for (let i = 0; i < 120; i++) passo(false);
      let cham = 0, tri = 0;
      for (let i = 0; i < 120; i++) { const des = i % 2 === 0; passo(des); if (!des || g.replay.estado?.ativo) continue; const e = g.estado(); cham = Math.max(cham, e.desenhoChamadas); tri = Math.max(tri, e.desenhoTriangulos); }
      g.medirQuadro({ zerar: true });
      for (let i = 0; i < 600; i++) passo(false);
      const q = g.medirQuadro({ zerar: true });
      return { cham, tri, p95: q.cpu.p95, media: q.cpu.media, n: q.quadros };
    });
    // os planos do replay de parada: falta (tv + fechada) e chance (tv + atrás); 1 quadro desenhado em 8 (na chance só o
    // plano de trás do gol: a TV já foi medida na falta)
    const por = {}, nada = { n: 0, faltam: 0, ex: '', semBola: 0 }, custos = [];
    let telaCel = null;
    marcar('E replays');
    for (const tipo of ['faltaPerto', 'espalmada']) {
      const f = await forcarLance(pg, tipo);
      const a = await ateReplay(pg);
      if (!a.ativo) { custos.push({ tipo, sem: true, f, a }); continue; }
      const r = await pg.evaluate(({ TEXTOS, soAtras }) => {
        const textos = new Function(`return (${TEXTOS})()`);
        const g = window.__golaco, out = { por: {}, n: 0, faltam: 0, ex: '', semBola: 0, tela: null };
        g.replay.zerarCusto();
        let k = 0;
        while (g.replay.estado.ativo && k < 1200) {
          const des = k % 8 === 0 && (!soAtras || g.replay.estado.cam !== 'tv');
          g.relogio.avancar(1000 / 60, { desenhar: des }); k++;
          const e = g.replay.estado;
          if (!e.ativo) break;
          const c = (out.por[e.cam] ??= { quadros: 0, desenhados: 0, cham: 0, tri: 0 });
          c.quadros++;
          if (des) { const s = g.estado(); c.desenhados++; c.cham = Math.max(c.cham, s.desenhoChamadas); c.tri = Math.max(c.tri, s.desenhoTriangulos); }
          const d = g.replay.desenho;
          out.n++;
          const esperado = 22 + (g.estadio.tecnicos ? 2 : 0);
          if (!d || d.ids.length !== esperado) { out.faltam++; if (!out.ex) out.ex = `${d ? d.ids.length : '-'} de ${esperado} no plano ${e.cam}`; }
          if (d && !d.bola) out.semBola++;
          if (k === 40 && !out.tela) out.tela = textos();
        }
        out.custo = g.replay.custo;
        return out;
      }, { TEXTOS: TEXTOS_FORA.toString(), soAtras: tipo === 'espalmada' });
      for (const [cam, o] of Object.entries(r.por)) {
        const t = (por[cam] ??= { quadros: 0, desenhados: 0, cham: 0, tri: 0 });
        t.quadros += o.quadros; t.desenhados += o.desenhados; t.cham = Math.max(t.cham, o.cham); t.tri = Math.max(t.tri, o.tri);
      }
      nada.n += r.n; nada.faltam += r.faltam; nada.semBola += r.semBola; if (!nada.ex) nada.ex = r.ex;
      custos.push({ tipo, p95: r.custo.quadroReplayP95, media: r.custo.quadroReplayMs, quadros: r.custo.quadros });
      if (!telaCel) telaCel = r.tela;
    }
    const cams = Object.entries(por);
    const limite = cam => vivo.cham + (cam === 'atras' ? 3 : 1);
    const medidos = custos.filter(c => !c.sem);
    meta('V7 celular 844×390 Média: chamadas por plano (tv e fechada ≤ ao vivo + 1; atrás ≤ + 3) e CPU do quadro do replay p95 ≤ a do jogo + 1 ms',
      `${cams.map(([c, o]) => `${c} ${o.cham} (${o.desenhados} quadros, ${(o.tri / 1000).toFixed(0)} mil tri)`).join(' · ') || 'nenhum replay'} × ao vivo ${vivo.cham} (${(vivo.tri / 1000).toFixed(0)} mil); CPU p95 ${medidos.map(c => `${c.tipo} ${f2(c.p95)} ms (média ${f2(c.media)}, ${c.quadros} quadros)`).join(', ') || '-'} × jogo p95 ${f2(vivo.p95)} ms (média ${f2(vivo.media)}, ${vivo.n} quadros)`,
      `tv, fechada ≤ ${vivo.cham + 1}; atras ≤ ${vivo.cham + 3}; ≤ ${f2(vivo.p95 + 1)} ms`,
      ['tv', 'fechada', 'atras'].every(c => por[c]?.desenhados > 0) && cams.every(([c, o]) => o.cham <= limite(c)) && medidos.length === 2 && medidos.every(c => c.quadros > 0 && c.p95 <= vivo.p95 + 1));
    meta('V7b nada some no replay de parada (celular): os 22 e os 2 treinadores e a bola em todo quadro',
      `${nada.n - nada.faltam}/${nada.n} quadros com a lista inteira${nada.ex ? ` (ex.: ${nada.ex})` : ''}; bola escondida em ${nada.semBola}`,
      'todos; 0', nada.n > 0 && nada.faltam === 0 && nada.semBola === 0);
    meta('V3b celular: na tela do replay só o placar, a marca REPLAY e o "Pular" (≥ 48 px, dentro da tela)',
      telaCel ? `marca ${telaCel.marca}, placar ${telaCel.placar}, "Pular" ${telaCel.pular ? `${telaCel.pular.h} px${telaCel.pular.dentro ? '' : ' (fora da tela)'}` : 'não'}; texto fora ${telaCel.fora.length ? JSON.stringify(telaCel.fora) : '0 caractere'}` : 'sem replay',
      'sim, sim, ≥ 48 px; 0', !!telaCel && telaCel.marca && telaCel.placar && !!telaCel.pular && telaCel.pular.h >= 48 && telaCel.pular.dentro && telaCel.fora.length === 0);
    // V5b: o toque em qualquer lugar pula (os botões de toque voltam; a pausa não abre; nada chega ao jogador)
    marcar('E toque');
    const f3 = await forcarLance(pg, 'faltaPerto');
    const a3 = await ateReplay(pg);
    let t1 = null;
    if (a3.ativo) {
      await avancar(pg, 20);
      const antes = await pg.evaluate(() => ({ toque: getComputedStyle(document.getElementById('toque')).display !== 'none', ativo: window.__golaco.replay.estado.ativo }));
      await pg.touchscreen.tap(300, 200);
      t1 = await pg.evaluate(() => {
        const g = window.__golaco, m = g.mundo;
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const r = { ativo: g.replay.estado.ativo, toque: getComputedStyle(document.getElementById('toque')).display !== 'none', menu: g.estado().menuAberto, tick0: m.tick, botoes: 0 };
        for (let i = 0; i < 30; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (m.jogadores.find(j => j.time === 0)?.botoesTime | 0) r.botoes++; }
        r.passos = m.tick - r.tick0;
        return r;
      });
      t1.antes = antes;
    }
    meta('V5b o pulo pelo toque (celular): um toque em qualquer lugar pula; os botões de toque voltam, a pausa não abre e nada chega ao jogador',
      f3.semApi ? 'sem a API de replays de parada' : !t1 ? `nenhum replay (${a3.q} quadros)` : `antes: replay ${t1.antes.ativo}, toque ${t1.antes.toque}; depois do toque: replay ${t1.ativo}, toque ${t1.toque}, pausa ${t1.menu}; ${t1.botoes} de ${t1.passos} passos com botão`,
      'sim, escondidos → não, visíveis, não; 0', !!t1 && t1.antes.ativo && !t1.antes.toque && !t1.ativo && t1.toque && !t1.menu && t1.botoes === 0 && t1.passos >= 20);
  } finally { await P.fechar(); }
} catch (e) { meta('E execução (celular: V7, V3b, V5b)', erroCurto(e), 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ O (online, duas abas)
/**
 * A semente da partida online com duas bolas mortas cedo (nas partidas online IA × IA elas são raras: ~1 a cada 3000
 * passos), em Node, como as abas com ?ia=1&D=4 jogam: os 4 primeiros passos com as entradas neutras do atraso D e depois o
 * bit IA nos dois times (online.js passoOnline) — hash Node = página. A 1ª no passo ≥ 240 (4 s no anel) e a 2ª ≥ 1ª + 179
 * (o fim do 1º replay + 120 passos), as duas até o passo 2400. Com o js da pasta medida (sem js/lances.js, o daqui):
 * {semente, a, b} ou null.
 */
async function sementeOnline() {
  const imp = f => import(pathToFileURL(path.join(jsBusca, f)).href);
  const P = await imp('partida.js'), O = await imp('online.js');
  const fns = { passoPartida: P.passoPartida, entradaDemoPartida: P.entradaDemoPartida };
  const ia = { 0: { x: 0, z: 0, botoes: 0, ia: true }, 1: { x: 0, z: 0, botoes: 0, ia: true } };
  const neutra = { 0: { x: 0, z: 0, botoes: 0 }, 1: { x: 0, z: 0, botoes: 0 } };
  for (let semente = 1; semente <= 40; semente++) {
    const m = P.criarPartida({ semente, humanos: [0, 1] });
    m.online = true;
    let a = null;
    for (let n = 0; m.tick < 2400; n++) {
      O.passoOnline(m, n < 4 ? neutra : ia, null, fns);
      const pr = m.parada;
      if (m.partida.estado !== 'parada' || !pr || pr.cobrador != null || pr.inicio !== m.tick) continue;
      if (a == null) { if (pr.inicio >= 240) a = pr.inicio; } else if (pr.inicio >= a + 179) return { semente, a, b: pr.inicio };
    }
  }
  return null;
}

/**
 * Duas abas do mesmo Chromium (BroadcastChannel) jogando a mesma partida com a IA pelos dois controlados (?ia=1). Um vigia
 * em cada aba (addInitScript: desde o 1º quadro, antes de qualquer bola morta) arma um lance de teste na 1ª bola morta do
 * passo 240 em diante (a mesma nas duas: a simulação é a mesma) e, quando o replay dele acaba, na 1ª depois do tick dele
 * + 120; a aba B desliga os replays quando o 1º acaba ("Replays: Desligado", replay.automatico(false): o estado do
 * ?replay=0). Cada quadro anota [Date.now(), passo, replay de parada, tick, aviso]. Fase 1 = V8, fase 2 = V8b.
 */
async function sessaoOnline(semente) {
  // a tela menor do celular deitado: o SwiftShader desenha menos e as abas andam mais passos por segundo
  const s = await abrir({ largura: 568, altura: 320, dpr: 1, toque: true });
  await s.contexto.addInitScript(() => {
    const V = window.__vigia = { log: [], forcados: [], fase: 0, depois: 240, semApi: null, desligou: null };
    const ladoB = new URLSearchParams(location.search).get('lado') === '1';
    const volta = () => {
      requestAnimationFrame(volta);
      const g = window.__golaco;
      if (!g || !g.pronto || !g.online) return;
      const P = g.replay?.paradas ?? null, m = g.mundo, pr = m.parada, e = g.replay?.estado;
      V.semApi = !P;
      if (P) {
        const h = P.historico;
        // o 1º replay acabou: o 2º lance vem depois do tick dele + 120; a aba B desliga os replays
        if (V.fase === 1 && h.length >= 1 && !e?.ativo) { V.fase = 2; V.depois = h[0].tick + 120; if (ladoB) { g.replay.automatico(false); V.desligou = m.tick; } }
        if ((V.fase === 0 || V.fase === 2) && m.partida?.estado === 'parada' && pr && pr.cobrador == null && pr.inicio >= V.depois && m.tick - pr.inicio <= 30) {
          const b = m.bola.p, chave = Math.max(1, pr.inicio - 90);
          V.forcados.push({ inicio: pr.inicio, tick: m.tick, ok: P.forcar({ classe: 'A', tipo: 'faltaPerto', chave, fim: chave, x: b.x, z: b.z, lado: b.x >= 0 ? 1 : -1 }) });
          V.fase++;
        }
      }
      const av = document.getElementById('online-aviso');
      V.log.push([Date.now(), g.online?.n ?? 0, e?.ativo && e.tipo === 'parada' ? 1 : 0, m.tick, av && !av.hidden ? av.textContent.trim().slice(0, 40) : '']);
    };
    requestAnimationFrame(volta);
  });
  const sala = 'paradas' + Date.now();
  const url = lado => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=${semente}&q=baixa&comemoracao=0&prejogo=0&substituicao=0&replayParada=1&D=4`;
  const pA = s.pagina, pB = await s.contexto.newPage();
  const erros = [];
  for (const [p, n] of [[pA, 'A'], [pB, 'B']]) {
    p.on('pageerror', e => erros.push(`online ${n}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') erros.push(`online ${n}: ${m.text()}`); });
  }
  const est = p => p.evaluate(() => {
    const g = window.__golaco, o = g.online, V = window.__vigia;
    return { n: o.n, D: o.D, dessinc: o.dessinc, hashes: o.hashes, hist: g.replay.paradas?.historico ?? null, forcados: V.forcados, semApi: V.semApi, desligou: V.desligou, log: V.log, ligado: g.replay.paradas?.ligado ?? null };
  });
  const ate = (p, n, ms = 300000) => p.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: ms, polling: 250 }).then(() => true, () => false);
  // o replay de parada número k já acabou na aba (o histórico tem k e o último quadro anotado é sem replay)
  const replayAcabou = (p, k) => p.waitForFunction(k => { const h = window.__golaco?.replay?.paradas?.historico ?? []; const l = window.__vigia.log; return h.length >= k && l.length && l[l.length - 1][2] === 0; }, k, { timeout: 600000, polling: 250 }).then(() => true, () => false);
  try {
    await Promise.all([pA.goto(url(0), { waitUntil: 'load' }), pB.goto(url(1), { waitUntil: 'load' })]);
    const pronto = p => p.waitForFunction(() => window.__golaco && window.__golaco.pronto && window.__golaco.online, null, { timeout: 300000 });
    await Promise.all([pronto(pA), pronto(pB)]);
    // sem a API (a base), nada é armado: o tempo de uma partida curta e as medidas mostram que não houve replay
    const semApi = await pA.evaluate(() => !window.__golaco.replay.paradas);
    const f1 = !semApi && await replayAcabou(pA, 1) && await replayAcabou(pB, 1);
    const a1 = await est(pA);
    const t1 = a1.hist?.[0]?.tick ?? 0;
    await Promise.all([ate(pA, t1 + 120), ate(pB, t1 + 120)]);
    const [x1, y1] = await Promise.all([est(pA), est(pB)]);
    const f2 = !semApi && await replayAcabou(pA, 2);
    const a2 = await est(pA);
    const t2 = a2.hist?.[1]?.tick ?? 0;
    await Promise.all([ate(pA, t2 + 240), ate(pB, t2 + 240)]);
    const [x2, y2] = await Promise.all([est(pA), est(pB)]);
    return { f1, f2, x1, y1, x2, y2, erros };
  } finally { errosTodos.push(...erros); await s.navegador.close(); }
}
function compararHashes(x, y) {
  const mx = new Map(x.hashes), comuns = y.hashes.filter(([n]) => mx.has(n));
  return { comuns: comuns.length, difs: comuns.filter(([n, h]) => mx.get(n) !== h).length, ultimo: comuns.length ? comuns[comuns.length - 1][0] : null };
}
/** As janelas (Date.now()) dos replays de parada no log de uma aba: [{t0, t1, tick, quadros}]. */
function janelas(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i][2] !== 1 || (i > 0 && log[i - 1][2] === 1)) continue;
    let k = i; while (k < log.length && log[k][2] === 1) k++;
    out.push({ t0: log[i][0], t1: log[Math.min(k, log.length - 1)][0], tick: log[i][3], quadros: k - i });
  }
  return out;
}
/** O passo (online.n) da aba no instante t (o último registro até t). */
const passoEm = (log, t) => { let n = null; for (const l of log) { if (l[0] > t) break; n = l[1]; } return n; };
marcar('O');
if (roda('O')) {
  try {
    const SO = await sementeOnline();
    if (!SO) throw new Error('nenhuma semente online com duas bolas mortas até o passo 2400 (Node)');
    const r = await sessaoOnline(SO.semente);
    // V8: fase 1
    {
      const { x1: a, y1: b } = r, c = compararHashes(a, b), ja = janelas(a.log)[0], jb = janelas(b.log)[0];
      const ha = a.hist?.[0], hb = b.hist?.[0], fa = a.forcados[0], fb = b.forcados[0];
      meta('V8 online (duas abas, ?replayParada=1 nas duas): as duas mostram o replay de parada no mesmo tick, sem dessincronia, os hashes a cada 60 passos iguais e a partida segue',
        a.semApi ? `semente ${SO.semente}: sem a API de replays de parada` : `semente ${SO.semente}: forçado na bola morta ${fa?.inicio ?? '-'} / ${fb?.inicio ?? '-'} (Node: ${SO.a}); replay A ${ha ? `tick ${ha.tick} (${ja?.quadros ?? 0} quadros)` : 'não'}, B ${hb ? `tick ${hb.tick} (${jb?.quadros ?? 0} quadros)` : 'não'}; dessincronia ${a.dessinc ? 'SIM' : 'não'}/${b.dessinc ? 'SIM' : 'não'}; hashes ${c.difs} diferentes de ${c.comuns} em comum (até o passo ${c.ultimo}); passos ${a.n}/${b.n}`,
        'as duas no tick da espera; não; 0 de ≥ 5; seguem',
        r.f1 && !!fa && !!fb && fa.inicio === fb.inicio && !!ha && !!hb && ha.tick === hb.tick && ha.tick === fa.inicio + 59 && !a.dessinc && !b.dessinc && c.difs === 0 && c.comuns >= 5 && c.ultimo > ha.tick);
    }
    // V8b: fase 2 (B com os replays desligados)
    {
      const { x2: a, y2: b } = r, c = compararHashes(a, b), ja = janelas(a.log)[1];
      const ha = a.hist?.[1], fa = a.forcados[1];
      // B não segura: durante o replay de A ela para no passo em que A parou + D (a entrada de A que ela tem) + folga. O D
      // de cada aba só sobe e pode ser diferente nas duas (a máquina carregada sobe o de A): B anda até onde a entrada de A
      // chegou, o passo de A + o D de A — vale o maior dos dois (antes o de B: reprovava por 3 passos com o CI cheio)
      const Dmax = Math.max(a.D ?? 0, b.D ?? 0);
      const nA0 = ja ? passoEm(a.log, ja.t0) : null, nB0 = ja ? passoEm(b.log, ja.t0) : null, nB1 = ja ? passoEm(b.log, ja.t1 - 300) : null;
      const espera = !!ja && b.log.some(l => l[0] >= ja.t0 && l[0] <= ja.t1 && /Aguardando/.test(l[4]));
      meta('V8b online com os replays desligados numa aba ("Replays: Desligado" = ?replay=0): só a outra segura, esta espera (para no passo de A + D + 2 no máximo) e não há dessincronia',
        a.semApi ? 'sem a API de replays de parada' : `forçado na bola morta ${fa?.inicio ?? '-'} (Node: ${SO.b}); B desligou os replays no tick ${b.desligou ?? '-'}; A: replay ${ha ? `tick ${ha.tick} (${ja?.quadros ?? 0} quadros, ${ja ? f2((ja.t1 - ja.t0) / 1000) : '-'} s)` : 'não'}; B (ligado ${b.ligado}): ${(b.hist ?? []).length} replays no total, passo ${nB0} → ${nB1} durante o de A (A parou no ${nA0}, D ${a.D}/${b.D})${espera ? ', "Aguardando…" na tela' : ''}; dessincronia ${a.dessinc ? 'SIM' : 'não'}/${b.dessinc ? 'SIM' : 'não'}; hashes ${c.difs} diferentes de ${c.comuns} (até o passo ${c.ultimo})`,
        'A segura; B 1 replay (só o da fase 1) e para em ≤ o passo de A + D + 2; não; 0',
        r.f2 && !!ha && ha.tick === fa.inicio + 59 && b.ligado === false && (b.hist ?? []).length === 1 && nA0 != null && nB1 != null && nB1 <= nA0 + Dmax + 2 && !a.dessinc && !b.dessinc && c.difs === 0 && c.comuns >= 5 && c.ultimo > ha.tick);
    }
  } catch (e) { meta('V8 execução (online)', erroCurto(e), 'sem exceção', false); }
}

marcar('fim');
await srv.fechar();
meta('console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const seg = (Date.now() - t0) / 1000;
console.log(`lance: ${lanceTxt}`);
console.log(`tempos: ${marcas.slice(0, -1).map(([n, t], k) => [n, (marcas[k + 1][1] - t) / 1000]).filter(([, x]) => x >= 0.5).map(([n, x]) => `${n} ${x.toFixed(0)} s`).join(', ')}\n`);
console.log(tabelaTexto([['', 'Item', 'Medido', 'Alvo'], ...res.map(r => [r.info ? 'INFO' : r.ok ? 'PASSOU' : 'REPROVOU', r.nome, r.medido, r.alvo])]));
const ok = res.length > 0 && res.every(r => r.ok || r.info);
console.log(`\nteste-replay-paradas-tela: ${ok ? 'PASSOU' : 'REPROVOU'} em ${seg.toFixed(1)} s`);
process.exit(ok ? 0 : 1);
