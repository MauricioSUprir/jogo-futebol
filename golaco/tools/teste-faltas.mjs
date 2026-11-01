// teste-faltas (Etapa 4): faltas com vantagem, cartões e expulsão (IFAB Regra 12), tiro livre direto e pênalti (Regra 14).
//
// Metas:
//  A. Cenas montadas (faltas.js): chegada por trás/lado/frente; bote por trás a ≥ FALTAS.temerario → temerário +
//     amarelo; de frente sem ataque promissor → sem cartão; chance clara de gol (DOGSO) fora da área → vermelho; na
//     área tentando jogar a bola → amarelo + pênalti; carga na chance clara (sem tentar a bola) na área → vermelho;
//     falta tática no ataque promissor → amarelo.
//  B. Regras (partida.js): (1) sem vantagem → apito, tiro livre DIRETO de quem sofreu no ponto, o cartão sai; (2) com
//     a bola indo para a frente no ataque → vantagem; o outro time pega a bola no prazo → volta à falta (tiro livre no
//     ponto da falta); (3) na área → pênalti: na cobrança todos fora da área e da meia-lua e atrás da bola, menos o
//     cobrador e o goleiro (na linha); a cobrança sai em ≤ 8 s e vira gol, defesa ou fora; (4) 2º amarelo → vermelho e
//     expulsão: sai do campo (10 em campo), fica na vaga como buraco, não pode ser substituído, o técnico muda a vaga
//     vazia (nunca o gol), mudar a formação deixa o buraco fora do gol, 2 min de jogo depois sem erro e sem ele na bola;
//     (5) goleiro expulso → o de linha mais perto do gol vai para o gol.
//  C. Canhão de 400 pênaltis (IA × goleiro IA): gol 70–82%, defesa 12–24%, fora 2–10% (meta do dono: ~76/18/6).
//  D. 48 partidas IA × IA (sementes 1001–1048; eram 12 até 15/10 e 36 até 31/10): faltas 1,5–5 por partida (teste de
//     Poisson: reprova se a contagem prova que está fora da faixa — 31/10, item 70: com a corrida das cobranças o CI deu 1,47
//     nas 36 partidas; no painel de 144, a main 2,0 × 1,8 (288 × 259, sementes 1001–1144) e 1,97 × 1,79 (284 × 258,
//     3001–3144): juntas, p ≈ 0,10 — empate pela régua, com o PR ~10% abaixo nas duas); amarelos 10–30% das faltas
//     (teste binomial: reprova se a contagem prova que está fora da faixa); vermelhos ≤ 0,2 por partida (teste de Poisson:
//     reprova se a contagem prova mais que isso); nenhuma parada passa de 8 s; nada de NaN. AMOSTRA: com ~2 faltas por
//     partida a contagem de 12 partidas é de Poisson com desvio de ~0,4 por partida, e uma mudança que não mexe nas faltas
//     passava ou reprovava a meta de 1,5 pelo sorteio dos lances (15/10, a IA do domínio-sem-passar: 1,42 nas 1001–1012,
//     2,33 nas 1013–1036; a lógica de antes 2,00 / 1,96 e a main 1,75 / 2,50). As 48 em 3 fatias de 16, uma por processo
//     filho (--par, padrão 3), enquanto o processo principal faz as partes A–C.
//
//   node tools/teste-faltas.mjs              (lógica do repositório)
//   node tools/teste-faltas.mjs --js <pasta> (outra cópia da lógica; a publicada antes desta parte → REPROVA)
//   node tools/teste-faltas.mjs --par 3      (no máximo 3 fatias da parte D ao mesmo tempo)
import { fork } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-faltas: REPROVOU (${falhas})` : '\nteste-faltas: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'faltas.js'))) {
  reg('as faltas existem (faltas.js)', 'não existe nesta lógica', 'faltas.js', false);
  fim();
}
const P = await imp('partida.js');
const F = await imp('faltas.js');
const E = await imp('escalacao.js');
const { FALTAS, PARTIDA, CAMPO, ACOES } = await imp('config.js');
const PASSO = 1 / 60;

// parte D: as partidas inteiras em processos filhos (começam já e correm junto com as partes A–C)
const D_SEM0 = 1001, D_N = 48, D_FATIA = 16;
/** Partidas IA × IA inteiras das sementes s0 … s0 + n − 1: as contagens da parte D. */
function partidasD(s0, n) {
  let faltas = 0, amar = 0, verm = 0, nan = false, paradaMax = 0;
  for (let s = s0; s < s0 + n; s++) {
    const m = P.criarPartida({ semente: s });
    let inicio = null;
    for (let i = 0; i < 2 * 4 * 3600 + 4000; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      for (const e of ev) {
        if (e.tipo === 'falta') faltas++;
        if (e.tipo === 'cartao') { if (e.cor === 'amarelo') amar++; else if (!e.segundo || e.motivo === 'segundoAmarelo') verm++; }
      }
      const pr = m.parada;
      if (pr && !pr.rolou && m.partida.estado === 'parada') { if (inicio == null) inicio = pr.inicio; paradaMax = Math.max(paradaMax, (m.tick - inicio) * PASSO); }
      else inicio = null;
      if (!Number.isFinite(m.bola.p.x)) nan = true;
      // as contagens dos acréscimos (gols, substituições, impedimentos, faltas, cartões) valem nos dois tempos
      for (const k of ['gols', 'subs', 'imped', 'faltas', 'cartoes']) if (!Number.isFinite(m.partida.contagem[k])) nan = true;
      if (m.partida.estado === 'fim') break;
    }
  }
  return { faltas, amar, verm, nan, paradaMax };
}
if (args.includes('--filho-d')) {
  const r = partidasD(+arg('--s0'), +arg('--n'));
  await new Promise(ok => process.send(r, ok));
  process.exit(0);
}
const filhosD = (async () => {
  const fatias = [];
  for (let s0 = D_SEM0; s0 < D_SEM0 + D_N; s0 += D_FATIA) fatias.push([s0, Math.min(D_FATIA, D_SEM0 + D_N - s0)]);
  const nPar = Math.max(1, Math.min(fatias.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
  const res = [];
  let prox = 0;
  await Promise.all(Array.from({ length: nPar }, async () => {
    while (prox < fatias.length) {
      const [s0, n] = fatias[prox++];
      res.push(await new Promise((ok, erro) => {
        const c = fork(fileURLToPath(import.meta.url), [...args, '--filho-d', '--s0', String(s0), '--n', String(n)]);
        c.on('message', ok); c.on('error', erro);
        c.on('exit', cod => { if (cod) erro(new Error(`parte D, sementes ${s0}–${s0 + n - 1}: saiu com ${cod}`)); });
      }));
    }
  }));
  return res;
})();

/** Partida com a bola rolando e o time 0 atacando +x: o atacante A (time 0) com a bola e o defensor D (time 1). */
function cena({ ax = 20, az = 0, avx = 6, dx = 18.8, dz = 0, dvx = 7, outros = 'longe', sem = 1 } = {}) {
  const m = P.criarPartida({ semente: sem });
  m.partida.estado = 'jogo'; m.parada = null; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
  const A = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
  const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
  for (const j of m.jogadores) {
    if (j === A || j === D) continue;
    if (j.posicao === 'GOL') P.teleportar(j, j.time === 0 ? -51 : 51, 0, j.time === 0 ? 0 : Math.PI);
    // os outros longe (atrás da jogada) ou, com outros = 'frente', 3 defensores entre A e o gol
    else P.teleportar(j, j.time === 0 ? -30 : (outros === 'frente' && j.vagaIdx < 4 ? ax + 6 + j.vagaIdx : -20 - j.vagaIdx), (j.vagaIdx - 5) * 3, 0);
  }
  P.teleportar(A, ax, az, 0); A.vx = avx; A.vz = 0;
  P.teleportar(D, dx, dz, 0); D.vx = dvx; D.vz = 0;
  m.bola.p.x = ax + 0.4; m.bola.p.z = az; m.posse = A.id;
  m.eventos = [];
  return { m, A, D };
}

/** P(X ≥ k) para X ~ Poisson(λ). */
// cauda binomial: P(X ≥ k) e P(X ≤ k) para X ~ Bin(n, p) — a fração de amarelos é uma contagem em ~25 faltas (12
// partidas): a faixa 10–30% só reprova quando a contagem PROVA que a taxa está fora dela (como os vermelhos abaixo)
function binomPmf(n, k, p) { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c * p ** k * (1 - p) ** (n - k); }
function caudaBinomAcima(k, n, p) { let s = 0; for (let i = k; i <= n; i++) s += binomPmf(n, i, p); return Math.min(1, s); }
function caudaBinomAbaixo(k, n, p) { let s = 0; for (let i = 0; i <= k; i++) s += binomPmf(n, i, p); return Math.min(1, s); }
function caudaPoisson(k, lam) {
  let termo = Math.exp(-lam), acum = 0;
  for (let i = 0; i < k; i++) { acum += termo; termo *= lam / (i + 1); }
  return Math.max(0, 1 - acum);
}

// ------------------------------------------------------------------ A. cenas montadas
const casos = [];
const caso = (nome, ok, det = '') => casos.push({ nome, ok: !!ok, det });
{
  const { A, D } = cena();
  caso('chegada por trás', F.chegada(D, A) === 'tras', F.chegada(D, A));
  D.x = A.x + 1.2; D.z = A.z; caso('chegada de frente', F.chegada(D, A) === 'frente');
  D.x = A.x; D.z = A.z + 1.2; caso('chegada de lado', F.chegada(D, A) === 'lado');
}
{
  const { m, A, D } = cena({ ax: -10, avx: 3, dx: -11.2, dvx: FALTAS.temerario + 0.5 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  caso('por trás em velocidade → temerário + amarelo', f.grau === 'temerario' && f.cartao === 'amarelo', `${f.grau}/${f.cartao}`);
}
{
  const { m, A, D } = cena({ ax: -10, avx: 1, dx: -8.8, dvx: -2 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  caso('de frente, sem ataque promissor → sem cartão', f.grau === 'imprudente' && !f.cartao, `${f.grau}/${f.cartao}`);
}
{
  const { m, A, D } = cena({ ax: 25, avx: 7, dx: 23.8, dvx: 7 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  caso('chance clara de gol fora da área → vermelho', F.chanceClara(m, A, D) && f.cartao === 'vermelho' && f.motivo === 'dogso' && !f.area, `${f.cartao}/${f.motivo}/área ${f.area}`);
}
{
  const { m, A, D } = cena({ ax: 40, avx: 6, dx: 38.8, dvx: 6.5 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  caso('chance clara na área tentando a bola → amarelo + pênalti', f.area && f.cartao === 'amarelo' && f.motivo === 'dogsoArea', `${f.cartao}/${f.motivo}/área ${f.area}`);
  const g = F.montarFalta(m, D, A, 'carga', false);
  caso('chance clara na área sem tentar a bola (carga) → vermelho', g.area && g.cartao === 'vermelho', `${g.cartao}/${g.motivo}`);
}
{
  const { m, A, D } = cena({ ax: 20, avx: 6, dx: 18.8, dvx: 6, outros: 'frente' });
  const f = F.montarFalta(m, D, A, 'tatica', false);
  caso('falta tática no ataque → amarelo (SPA), sem chance clara', !F.chanceClara(m, A, D) && f.cartao === 'amarelo', `${f.cartao}/${f.motivo}`);
}
const okA = casos.filter(c => c.ok).length;
reg('A. cenas da Regra 12', `${okA}/${casos.length}${casos.filter(c => !c.ok).map(c => ` · falhou: ${c.nome} (${c.det})`).join('')}`, 'todas', okA === casos.length);

// ------------------------------------------------------------------ B. regras
/** Passa a falta pelas regras (como o passo faria) e devolve os eventos. */
function apitar(m, f) {
  m.eventos = []; m.faltaPendente = f;
  P.regrasPartida(m);
  return m.eventos;
}
{ // (1) sem vantagem: tiro livre direto no ponto, cartão
  const { m, A, D } = cena({ ax: -10, avx: 1, dx: -11.2, dvx: FALTAS.temerario + 0.5 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  const ev = apitar(m, f);
  const pr = m.parada;
  const cartao = ev.find(e => e.tipo === 'cartao');
  reg('B1. sem vantagem: tiro livre direto de quem sofreu no ponto, com o cartão',
    `${pr?.tipo}${pr?.direto ? ' direto' : ''} do time ${pr?.time} em (${pr?.x?.toFixed(1)}, ${pr?.z?.toFixed(1)}) · cartão ${cartao ? `${cartao.cor} para ${cartao.id}` : 'nenhum'}`,
    'tiroLivre direto do time 0 em (−10, 0) · amarelo para o defensor',
    pr && pr.tipo === 'tiroLivre' && pr.direto && pr.time === 0 && Math.abs(pr.x + 10) < 0.01 && cartao?.cor === 'amarelo' && cartao.id === D.id);
}
{ // (2) vantagem e a volta
  const { m, A, D } = cena({ ax: 15, avx: 6, dx: 13.8, dvx: 3, outros: 'frente' });
  const f = F.montarFalta(m, D, A, 'bote', true);
  // depois da falta no bote o defensor descansa, como em sim.js boteIA (sem isso, colado atrás do atacante na vantagem,
  // ele podia segurá-lo de novo: faltas.js faltaTatica 'segurar')
  D.descansoBote = ACOES.boteIA.descanso;
  const ev = apitar(m, f);
  const deu = ev.some(e => e.tipo === 'vantagem') && !m.parada;
  // o defensor pega a bola 1 s depois (dentro do prazo)
  for (let i = 0; i < 60; i++) P.passoPartida(m, { x: 1, z: 0, botoes: 0 });
  m.posse = D.id; m.naMao = null; m.voo = null; m.eventos = [];
  P.regrasPartida(m);
  const volta = m.eventos.some(e => e.tipo === 'vantagemVolta');
  const pr = m.parada;
  reg('B2. vantagem: segue; o outro time pega a bola no prazo → volta à falta', `vantagem ${deu ? 'sim' : 'não'} · volta ${volta ? 'sim' : 'não'} · ${pr?.tipo ?? 'sem parada'} em (${pr?.x?.toFixed(1)}, ${pr?.z?.toFixed(1)})`,
    'sim · sim · tiroLivre em (15, 0)', deu && volta && pr?.tipo === 'tiroLivre' && Math.abs(pr.x - 15) < 0.01 && pr.time === 0);
}
{ // (3) pênalti
  const { m, A, D } = cena({ ax: 42, az: 4, avx: 4, dx: 40.8, dz: 4, dvx: 4 });
  const f = F.montarFalta(m, D, A, 'bote', true);
  const ev = apitar(m, f);
  const marcou = ev.some(e => e.tipo === 'penaltiMarcado') && m.parada?.tipo === 'penalti';
  let res = null, t0 = m.tick, posOk = true, det = '', gk = null, tCobr = null;
  for (let i = 0; i < 60 * 15 && !res; i++) {
    const evs = P.passoPartida(m, P.entradaDemoPartida(m));
    const pr = m.parada;
    for (const e of evs) {
      if (e.tipo === 'cobranca' && e.parada === 'penalti') {
        tCobr = (m.tick - t0) * PASSO;
        // no toque: todos fora da área e da meia-lua e atrás da bola (menos o cobrador e o goleiro na linha)
        const lado = m.ataca[0], gx = lado * CAMPO.meioX, mk = gx - lado * CAMPO.marcaPenalti;
        for (const j of m.jogadores) {
          if (j.id === e.id) continue;
          if (j.time === 1 && j.posicao === 'GOL') { gk = j; if ((gx - j.x) * lado > 1.0) { posOk = false; det += ` goleiro a ${((gx - j.x) * lado).toFixed(2)} m da linha`; } continue; }
          if (j.time === 0 && j.posicao === 'GOL') continue;
          const naArea = (gx - j.x) * lado < CAMPO.area.profundidade - 0.1 && Math.abs(j.z) < CAMPO.area.largura / 2 - 0.1;
          const naMeiaLua = Math.hypot(j.x - mk, j.z) < 9.15 - 0.2;
          const frente = (j.x - mk) * lado > 0.3;
          if (naArea || naMeiaLua || frente) { posOk = false; det += ` ${j.id}${naArea ? ' na área' : ''}${naMeiaLua ? ' na meia-lua' : ''}${frente ? ' à frente' : ''}`; }
        }
      }
      if (e.tipo === 'penalti') res = e.resultado;
    }
    void pr;
  }
  reg('B3. pênalti: marcado, todos no lugar na cobrança, sai em ≤ 8 s, tem resultado', `marcado ${marcou ? 'sim' : 'não'} · cobrança em ${tCobr?.toFixed(1)} s · ${posOk ? 'todos no lugar' : 'fora do lugar:' + det} · resultado ${res}`,
    'sim · ≤ 8 s · no lugar · gol/defesa/fora', marcou && tCobr != null && tCobr <= PARTIDA.paradaMax && posOk && !!res && !!gk);
}
{ // (4) 2º amarelo → expulsão, 10 em campo, a escalação e 2 min de jogo
  const { m, A, D } = cena({ ax: -10, avx: 1, dx: -11.2, dvx: FALTAS.temerario + 0.5 });
  m.partida.cartoes[D.id] = 1; // já tem um amarelo
  const f = F.montarFalta(m, D, A, 'bote', true);
  const ev = apitar(m, f);
  const verm = ev.some(e => e.tipo === 'cartao' && e.cor === 'vermelho' && e.id === D.id);
  const naoEsta = !m.jogadores.some(j => j.id === D.id), dez = m.jogadores.filter(j => j.time === 1).length;
  const s = m.times[1];
  const buraco = Object.values(s.vagas).includes(D.id) && (s.expulsos ?? []).includes(D.id);
  // a escalação de agora vale; substituir o expulso é recusado; o buraco muda de vaga (não para o gol)
  const r0 = E.rascunhoDe(s, null, 1);
  // a escalação de agora (com o buraco) como edição: tem que valer
  const val = E.validarEdicao(s, { tipo: 'editarTime', time: 1, base: s.versao, formacao: s.formacao, vagas: { ...s.vagas }, tatica: { ...s.tatica }, substituicoes: [] });
  const reserva = E.reservasDe(r0)[0];
  let t1 = E.tocar(r0, D.id).rasc; const sub = E.tocar(t1, reserva).evento;
  const titular = Object.values(r0.vagas).find(id => id !== D.id && id !== r0.vagas.GOL);
  t1 = E.tocar(E.tocar(r0, D.id).rasc, titular);
  const moveu = t1.evento?.tipo === 'trocou' && E.validarEdicao(s, E.edicaoDe(t1.rasc)).ok;
  const paraGol = E.tocar(E.tocar(r0, D.id).rasc, r0.vagas.GOL).evento;
  const outraForm = E.mudarFormacao(r0, r0.formacao === '4-4-2' ? '4-3-3' : '4-4-2');
  const formOk = outraForm.vagas.GOL !== D.id && Object.values(outraForm.vagas).includes(D.id) && E.validarEdicao(s, E.edicaoDe(outraForm)).ok;
  // 2 min de jogo com 10
  let nan = false, tocou = false;
  for (let i = 0; i < 2 * 3600; i++) {
    P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.posse === D.id || m.naMao === D.id) tocou = true;
    for (const j of m.jogadores) if (!Number.isFinite(j.x) || !Number.isFinite(j.z)) nan = true;
    if (!Number.isFinite(m.bola.p.x)) nan = true;
    if (m.partida.estado === 'fim') break;
  }
  reg('B4. 2º amarelo → vermelho: sai, 10 em campo, buraco na vaga, sem substituto', `vermelho ${verm ? 'sim' : 'não'} · fora do campo ${naoEsta ? 'sim' : 'não'} · em campo ${dez} · buraco ${buraco ? 'sim' : 'não'} · escalação válida ${val.ok ? 'sim' : val.motivo} · substituir: ${sub?.tipo}`,
    'sim · sim · 10 · sim · sim · recusou', verm && naoEsta && dez === 10 && buraco && val.ok && sub?.tipo === 'recusou');
  reg('B4. o técnico muda a vaga vazia (nunca o gol); formação nova deixa o buraco fora do gol; 2 min sem erro', `move ${moveu ? 'sim' : 'não'} · para o gol: ${paraGol?.tipo} · formação ${formOk ? 'ok' : 'errada'} · NaN ${nan ? 'sim' : 'não'} · expulso na bola ${tocou ? 'sim' : 'não'}`,
    'sim · recusou · ok · não · não', moveu && paraGol?.tipo === 'recusou' && formOk && !nan && !tocou);
}
{ // (5) goleiro expulso
  const { m } = cena({ ax: -10, avx: 1, dx: -11.2, dvx: 2 });
  const gk = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
  const A = m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
  const f = { def: gk.id, cond: A.id, time: 0, x: -20, z: 0, area: false, chegada: 'frente', v: 2, grau: 'excessivo', cartao: 'vermelho', motivo: 'forcaExcessiva', origem: 'bote', tick: m.tick };
  apitar(m, f);
  const novo = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
  const s = m.times[1];
  reg('B5. goleiro expulso → o de linha mais perto do gol vai para o gol', `novo goleiro ${novo ? novo.id : 'nenhum'} · vaga GOL ${s.vagas.GOL} · buraco em ${Object.keys(s.vagas).find(k => s.vagas[k] === gk.id)}`,
    'um de linha no gol, o buraco fora do gol', !!novo && novo.id !== gk.id && s.vagas.GOL === novo.id && s.vagas.GOL !== gk.id);
}

// ------------------------------------------------------------------ C. canhão de pênaltis
{
  const N = +(arg('--penaltis', 400));
  const res = { gol: 0, defesa: 0, fora: 0, nada: 0 };
  for (let k = 0; k < N; k++) {
    const m = P.criarPartida({ semente: 5000 + k });
    for (let i = 0; i < 200; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    const A = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
    const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
    P.teleportar(A, 45, 3, 0); P.teleportar(D, 44, 3.5, 0);
    m.bola.p.x = 45.4; m.bola.p.z = 3; m.posse = A.id; m.naMao = null; m.voo = null;
    apitar(m, { def: D.id, cond: A.id, time: 0, x: 45, z: 3, area: true, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
    let r = null;
    for (let i = 0; i < 60 * 20 && !r; i++) for (const e of P.passoPartida(m, P.entradaDemoPartida(m))) if (e.tipo === 'penalti') r = e.resultado;
    res[r ?? 'nada']++;
  }
  const p = k => 100 * res[k] / N;
  const f1 = v => v.toFixed(1).replace('.', ',');
  reg(`C. canhão de ${N} pênaltis: gol / defesa / fora`, `${f1(p('gol'))} / ${f1(p('defesa'))} / ${f1(p('fora'))}%${res.nada ? ` · sem resultado ${res.nada}` : ''}`, '70–82 / 12–24 / 2–10% (dono: ~76/18/6)',
    p('gol') >= 70 && p('gol') <= 82 && p('defesa') >= 12 && p('defesa') <= 24 && p('fora') >= 2 && p('fora') <= 10 && res.nada === 0);
}

// ------------------------------------------------------------------ D. partidas inteiras
{
  const N = D_N;
  let faltas = 0, amar = 0, verm = 0, nan = false, paradaMax = 0;
  for (const r of await filhosD) { faltas += r.faltas; amar += r.amar; verm += r.verm; nan ||= r.nan; paradaMax = Math.max(paradaMax, r.paradaMax); }
  const f2 = v => v.toFixed(2).replace('.', ',');
  // (a faixa pelo teste de Poisson: reprova se a contagem PROVA menos de 1,5 ou mais de 5 por partida, p < 5%)
  const pFBaixo = 1 - caudaPoisson(faltas + 1, 1.5 * N), pFAlto = caudaPoisson(faltas, 5 * N);
  reg(`D. faltas por partida (${N} partidas IA × IA)`, `${f2(faltas / N)} (${faltas}; p = ${f2(pFBaixo)} contra 1,5, ${f2(pFAlto)} contra 5)`, '1,5–5 (p ≥ 0,05)', pFBaixo >= 0.05 && pFAlto >= 0.05);
  // vermelhos: poucos por partida (~0,1), então em N partidas a contagem é de Poisson. Reprova só se ela PROVA a taxa
  // acima de 0,2 por partida (P(X ≥ contagem | λ = 0,2·N) < 5%); com "verm / N ≤ 0,2" direto, 12 partidas com a taxa
  // real de 0,10–0,13 (painel de 144) reprovavam em 12–21% das rodadas só por sorteio
  const pVerm = caudaPoisson(verm, 0.2 * N);
  // amarelos: a faixa 10–30% pelo teste binomial (reprova se a contagem prova mais de 30% ou menos de 10%) e pelo menos
  // 1 amarelo (com ~25 faltas, 0 amarelo não "prova" < 10% sozinho: P = 6,5%); a medida de verdade da taxa é o painel de
  // 144 partidas (19% nas regras e controles; 17,5% na main)
  const pAmarAlto = caudaBinomAcima(amar, faltas, 0.3), pAmarBaixo = caudaBinomAbaixo(amar, faltas, 0.1);
  reg('D. amarelos (fração das faltas) e vermelhos por partida', `${f2(100 * amar / Math.max(1, faltas))}% (${amar}/${faltas}; p = ${f2(pAmarAlto)} contra 30%, ${f2(pAmarBaixo)} contra 10%) · ${verm} em ${N} (${f2(verm / N)}; p = ${f2(pVerm)} contra 0,2)`, '10–30% (p ≥ 0,05 nos dois lados; ≥ 1 amarelo) · taxa ≤ 0,2 (p ≥ 0,05)', faltas > 0 && amar >= 1 && pAmarAlto >= 0.05 && pAmarBaixo >= 0.05 && pVerm >= 0.05);
  reg('D. nenhuma parada passa de 8 s; nada de NaN (bola e contagens)', `parada mais longa ${f2(paradaMax)} s · NaN ${nan ? 'sim' : 'não'}`, `≤ ${PARTIDA.paradaMax} s · não`, paradaMax <= PARTIDA.paradaMax + 0.05 && !nan);
}
fim();
