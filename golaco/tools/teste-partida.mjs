// teste-partida (Etapa 3, Parte 1): a partida 11×11 pela sessão (a mesma API da página):
// elenco em campo, relógio, intervalo com troca de lado, fim, recomeços pelo último toque e pela
// linha, paradas sem trava e a bola rolando. Plano 3.1–3.4 e 5.1.
//
// Metas:
//  A. 22 em campo (11 por time), 1 GOL por time, 12 reservas por time, ids únicos ≠ 0 e ≠ 90.
//  B. Relógio: anda (crescente) e chega a 45' no intervalo e a 90' no fim; o intervalo troca o lado
//     (m.ataca invertido, o goleiro no outro gol) e a saída do 2º tempo é de quem não começou; o fim
//     para tudo (120 passos depois: bola e corpos parados, estado 'fim').
//  C. IA × IA, N sementes × 1 tempo de M min (padrão 8 × 4): nenhuma parada > 8 s (da bola morta à
//     cobrança); bola rolando ≥ 60% do tempo; sem NaN; posse troca ≥ 10 vezes no tempo; na parada
//     ninguém além do cobrador fica com a bola; adversários fora do raio (círculo na saída, 2 m no
//     lateral, 9,15 m no escanteio, fora da área no tiro de meta) e, na saída, todos no próprio campo,
//     do fim da montagem até o 1º toque — inclusive na saída depois do gol (≥ 1 por amostra).
//  D. Humano parado (entrada zero; 2 sementes × 1 tempo de 2 min): a IA cobra por ele e nenhuma
//     parada passa de 8 s.
//  E. Canhão de 40 bolas para fora (linhas laterais e de fundo, os dois lados, os dois tempos,
//     último toque dos dois times) + 8 que desviam num jogador antes de sair: recomeço certo (lateral
//     para quem não tocou por último, no ponto em que ela cruzou; escanteio quando o último toque é de
//     quem defende; senão tiro de meta — da Etapa 4 em diante, com a bola no chão dentro da pequena área (Regra 16) e o
//     lateral na linha (Regra 15)) e cobrado em ≤ 8 s.
//  F. Corpo embalado na borda da parada (a parede pela locomoção com a física do corpo): logo depois da montagem de um
//     lateral, escanteio, tiro livre e pênalti do adversário, o jogador do humano a δ m da borda (raio + folga),
//     correndo de lado (CORRER na tangente) com a velocidade para dentro de uma trombada — v ≤ √(2·JOGADOR.freio·
//     (δ + folga)), o que a freada normal do corpo para antes do raio: ninguém entra no raio em nenhuma das 192 cenas.
//     (Antes a parede só limitava o pedido e o corpo levava a velocidade da trombada para dentro: 1 entrada a cada
//     ~30 tempos de 4 min IA × IA, e o C reprovava conforme o sorteio das sementes.)
//  T. A duração (item 33; dono, 17/10: "editar o TEMPO de jogo"; contrato "Tempo de jogo e dificuldade"):
//     T1 PARTIDA.duracoes = [3, 4, 5, 6, 8, 10] com o padrão (4) nela; ticksDoTempo(k) = k·3600; criarPartida({minutosPorTempo})
//        usa a mesma conta.
//     T2 mudarDuracao com estados montados à mão: 7 durações de origem (as do teste-relogio-placar, 0,25–45) × 7 de destino (as
//        6 opções + 0,25) × ticks no 1º tempo, nos acréscimos do 1º, no intervalo, no 2º, nos acréscimos do 2º e no tick 0: o
//        minutoDeJogo IGUAL em todos; o segundo do relogio-placar.segundoDeJogo IGUAL com T' ≥ 2700 ticks (as 6 opções) e, com T'
//        menor (o tick vale mais de 1 s de jogo), a ≤ ⌈2700/T'⌉ s do de antes (o minuto ganha: o menor tick que alcança o segundo
//        pode cair no minuto seguinte); acrescimoDeJogo e o "regular" (d ≥ T) iguais; o segundoNoTempo do partida.js igual ao
//        segundoDeJogo do relogio-placar.js em todos os casos (a conta copiada: o partida.js não importa o relogio-placar.js).
//     T3 partida de verdade (demo, 2 sementes × 1 min): mudarDuracao(m, 0,5) no minuto 20 e (m, 1,5) no minuto 60 — o relógio
//        (segundoDeJogo) nunca volta dentro de cada tempo, do 1º ao último passo; o intervalo e o fim apitam no passo chamada + (T' − d') +
//        ticksAcrescimo (±1); o minuto da súmula (minutoTM) em 1–45 / 46–90 e nunca volta.
//     T4 recusas (false e o hash IGUAL): dois humanos, m.online, Livre, Pênaltis, treino, fim de jogo, min ≤ 0.
//     T5 o hash: mudarDuracao(m, 4) numa partida de 4 min IGUAL; outro valor DIFERE; no tick 0, mudarDuracao(m, 6) = o MESMO
//        hash de criarPartida({minutosPorTempo: 6}) (o Personalizar recria o mundo).
//
//   node tools/teste-partida.mjs                  (lógica do repositório, sementes 1..8)
//   node tools/teste-partida.mjs --base 11        (sementes 11..18; as 5 rodadas usam 1, 11, 21, 31, 41)
//   node tools/teste-partida.mjs --antes          (a mesma partida com a IA clássica do treino)
//   node tools/teste-partida.mjs --js <pasta>     (outra cópia da lógica, ex.: a base 980b0b0 → REPROVA)
//   node tools/teste-partida.mjs --sementes 8 --min 4 --par 2  (processos em paralelo; padrão 2)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const ANTES = args.includes('--antes');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const existe = f => fs.existsSync(path.join(JS, f));
// Etapa 4 (lateral.js): o lateral na linha (Regra 15) e o tiro de meta com a bola no chão (Regra 16)
const BOLAS_E4 = existe('lateral.js');
const PASSO = 1 / 60;
// "dentro" do raio com 1 µm de tolerância numérica: a barreira fica a 9,15 m EXATOS da bola (Regra 13; bolas-paradas.js
// barreiraDoTiroLivre) e o hypot do do meio dá 9,1499999999999932 — 7e-15 m "dentro" contava como entrada no C
const TOL = 1e-6;
const fmtS = v => v.toFixed(2).replace('.', ',');

/**
 * API da partida: a da sessão (a mesma da página). Se a sessão desta lógica ainda não cria a
 * partida (cai no treino) mas o partida.js existe (Parte 0), mede direto pelo partida.js — a linha
 * "a sessão cria a partida" reprova e o resto mostra o que aquela partida fazia.
 */
async function apiPartida() {
  const S = await imp('sessao.js');
  const P = existe('partida.js') ? await imp('partida.js') : null;
  const viaSessao = !!S.criarTreino({ modo: 'partida', semente: 1 }).partida;
  if (viaSessao || !P) return { viaSessao, criar: o => S.criarTreino({ modo: 'partida', ...o }), passo: S.passoTreino, demo: S.entradaDemo };
  return { viaSessao, criar: o => P.criarPartida(o), passo: P.passoPartida, demo: P.entradaDemoPartida };
}

// --------------------------------------------------------------- medida de uma partida (C e D)
/**
 * Roda 1 tempo IA × IA (ou com o humano parado) e mede paradas, bola rolando, trocas de posse,
 * NaN e as violações da parada. Devolve um resumo serializável.
 */
async function medirTempo(sem, min, parado) {
  const S = await apiPartida();
  const { jogadorPorId } = await imp('sim.js');
  const m = S.criar({ semente: sem, minutosPorTempo: min, iaClassica: ANTES });
  const r = { sem, paradas: [], rolando: 0, total: 0, trocas: 0, nan: false, violaSaida: 0, violaEntra: 0, violaCobranca: 0, violaCampo: 0, violaPosse: 0, saidasGol: 0, tipos: {}, gols: 0, fim: false, detalhes: [] };
  if (!m.partida) { r.semPartida = true; return r; }
  const N = Math.round(min * 60 / PASSO) + 3000;
  let morta = 0, timeAnt = null, golAntes = false; // a saída do começo também é parada
  let dentroAntes = null, prMedida = null;
  const zero = { x: 0, z: 0, botoes: 0 };
  // adversário do cobrador dentro do raio (sem a folga) ou da área
  const dentro = (pr, j) => {
    if (j.id === pr.cobrador || j.time === pr.time) return false;
    if (pr.raio === 'area') { const gx = -m.ataca[pr.time] * 52.5; return Math.abs(j.x - gx) < 16.5 - TOL && Math.abs(j.z) < 20.16 - TOL; }
    return Math.hypot(j.x - pr.x, j.z - pr.z) < pr.raio - TOL;
  };
  for (let i = 0; i < N; i++) {
    const pr0 = m.parada;
    const ev = S.passo(m, parado ? zero : S.demo(m));
    for (const e of ev) {
      if ((e.tipo === 'fora' || e.tipo === 'gol') && morta == null) morta = m.tick - 1;
      if (e.tipo === 'gol') { r.gols++; golAntes = true; }
      if (e.tipo === 'saida' && golAntes) { r.saidasGol++; golAntes = false; }
      if (e.tipo === 'cobranca') {
        // na hora da cobrança (o estado de antes do toque) ninguém dentro
        if (dentroAntes && dentroAntes.size) {
          r.violaCobranca++;
          if (r.detalhes.length < 6) r.detalhes.push(`sem ${sem} tick ${m.tick}: cobrança de ${e.parada} (${e.id}) com ${[...dentroAntes].join(',')} dentro, ${fmtS((m.tick - (morta ?? m.tick)) * PASSO)} s depois da bola morta`);
        }
        dentroAntes = null; prMedida = null;
        if (morta != null) r.paradas.push({ s: (m.tick - morta) * PASSO, tipo: e.parada });
        r.tipos[e.parada] = (r.tipos[e.parada] ?? 0) + 1;
        morta = null;
      }
      if (e.tipo === 'intervalo' || e.tipo === 'fimDeJogo') { morta = null; r.fim = true; }
    }
    if (r.fim) break;
    const est = m.partida.estado;
    if (est === 'jogo' || est === 'parada' || est === 'gol') { r.total++; if (est === 'jogo') r.rolando++; }
    // posse (troca de time com a bola, com a bola em jogo)
    const id = m.naMao ?? m.posse;
    const tb = id != null ? jogadorPorId(m, id)?.time ?? null : (m.voo?.time ?? null);
    if (tb != null && est === 'jogo') { if (timeAnt != null && tb !== timeAnt) r.trocas++; timeAnt = tb; }
    if (!Number.isFinite(m.bola.p.x + m.bola.p.y + m.bola.p.z) || m.jogadores.some(j => !Number.isFinite(j.x + j.z + j.vx + j.vz))) r.nan = true;
    // durante a parada (montada e ainda não cobrada, antes e depois do passo): só o cobrador com a bola
    // e a restrição respeitada por todos
    const pr = m.parada;
    if (pr && pr.cobrador != null && !pr.rolou) {
      // montada e ainda não cobrada: só o cobrador com a bola; ninguém ENTRA no raio (quem estava
      // dentro na montagem sai); na saída, ninguém dentro em nenhum tick e todos no próprio campo
      const dono = m.naMao ?? m.posse;
      if (dono != null && dono !== pr.cobrador) {
        r.violaPosse++;
        if (r.detalhes.length < 6) r.detalhes.push(`sem ${sem} tick ${m.tick}: na parada de ${pr.tipo} (cobrador ${pr.cobrador}) a bola está com ${dono}`);
      }
      const agora = new Set();
      for (const j of m.jogadores) {
        if (j.id === pr.cobrador) continue;
        if (pr.tipo === 'saida' && j.x * m.ataca[j.time] > 0.05) r.violaCampo++;
        if (dentro(pr, j)) agora.add(j.id);
      }
      if (pr.tipo === 'saida') r.violaSaida += agora.size;
      if (prMedida === pr && dentroAntes) for (const id of agora) if (!dentroAntes.has(id)) r.violaEntra++;
      dentroAntes = agora; prMedida = pr;
    } else if (pr0 && !pr0.rolou && pr0.cobrador == null) {
      // bola morta antes da montagem: ninguém fica com ela
      if ((m.posse != null || m.naMao != null) && m.parada && m.parada.cobrador == null) {
        r.violaPosse++;
        if (r.detalhes.length < 6) r.detalhes.push(`sem ${sem} tick ${m.tick}: bola morta (${m.parada.tipo}) com ${m.naMao ?? m.posse}`);
      }
    }
  }
  return r;
}

if (args[0] === '--filho') {
  const [, semTxt, minTxt, paradoTxt] = args;
  const out = [];
  for (const s of semTxt.split(',').map(Number)) out.push(await medirTempo(s, +minTxt, paradoTxt === '1'));
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

// ------------------------------------------------------------------------------- principal
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-partida: REPROVOU (${falhas})${ANTES ? ' [--antes]' : ''}` : `\nteste-partida: PASSOU${ANTES ? ' [--antes]' : ''}`);
  process.exit(falhas ? 1 : 0);
}

const NSEM = +arg('--sementes', 8);
const BASE = +arg('--base', 1);
const MIN = +arg('--min', 4);
const SEMENTES = Array.from({ length: NSEM }, (_, k) => BASE + k);
console.log(`teste-partida: lógica ${JS}${ANTES ? ' (IA clássica: --antes)' : ''}; sementes ${SEMENTES.join(',')}; ${MIN} min por tempo`);

const S = await apiPartida();
const SIM = await imp('sim.js');
const temPartida = existe('partida.js');
const P = temPartida ? await imp('partida.js') : null;
const E = existe('elenco.js') ? await imp('elenco.js') : null;

// ----------------------------------------------------------------------- A. elenco em campo
{
  reg('a sessão cria a partida (criarTreino({modo: "partida"}), a API da página)', S.viaSessao ? 'cria' : 'cai no treino de ataque', 'cria', S.viaSessao);
  const m = S.criar({ semente: BASE, iaClassica: ANTES });
  const js = m.jogadores;
  const porTime = [0, 1].map(t => js.filter(j => j.time === t));
  reg('22 em campo (11 por time)', `${js.length} (${porTime[0].length} + ${porTime[1].length})`, '22 (11 + 11)', js.length === 22 && porTime.every(a => a.length === 11));
  const gols = porTime.map(a => a.filter(j => j.posicao === 'GOL').length);
  reg('1 goleiro por time', gols.join(' e '), '1 e 1', gols.every(g => g === 1));
  let res = 'sem elenco';
  let okRes = false;
  if (E && m.times) {
    const n = [0, 1].map(t => E.ELENCOS[m.times[t].elenco].jogadores.filter(j => !js.some(o => o.id === j.id)).length);
    res = n.join(' e '); okRes = n.every(x => x === 12);
  }
  reg('12 reservas por time (fora de m.jogadores)', res, '12 e 12', okRes);
  const ids = js.map(j => j.id);
  const unicos = new Set(ids).size === ids.length;
  reg('ids únicos, ≠ 0 e ≠ 90', `${new Set(ids).size} distintos${ids.includes(0) ? ', tem o 0' : ''}${ids.includes(90) ? ', tem o 90' : ''}`, 'únicos, sem 0 e 90', unicos && !ids.includes(0) && !ids.includes(90));
}

if (!temPartida) {
  reg('a partida existe (partida.js, criarTreino({modo: "partida"}))', 'partida.js não existe nesta lógica', 'relógio, recomeços, paradas', false);
  fim();
}

// ------------------------------------------------------------------------ B. relógio e lados
{
  const m = S.criar({ semente: BASE + 100, minutosPorTempo: 0.5, iaClassica: ANTES });
  const saida1 = m.partida.saidaInicial;
  const lado0 = m.ataca[0];
  let minIntervalo = null, minFim = null, cresce = true, ultMin = -1, saida2 = null, golOk = null, i = 0;
  const min1 = [];
  for (; i < 20000 && m.partida.estado !== 'fim'; i++) {
    const ev = S.passo(m, S.demo(m));
    const mn = P.minutoDeJogo(m);
    if (mn < ultMin) cresce = false;
    ultMin = mn;
    if (m.partida.tempo === 1 && m.partida.estado !== 'intervalo') min1.push(mn);
    for (const e of ev) {
      if (e.tipo === 'intervalo') minIntervalo = P.minutoDeJogo(m);
      if (e.tipo === 'saida' && m.partida.tempo === 2 && saida2 == null) saida2 = e.time;
      if (e.tipo === 'fimDeJogo') minFim = P.minutoDeJogo(m);
    }
    // 3 s depois da saída do 2º tempo: o goleiro do time 0 defende o outro gol
    if (m.partida.tempo === 2 && golOk == null && m.tick - m.partida.tick0Tempo === 180) {
      const g = m.jogadores.find(j => j.time === 0 && j.posicao === 'GOL');
      golOk = g.x * lado0 > 30; // antes defendia x = −52,5·lado0; agora o +52,5·lado0
    }
  }
  const meio = min1[Math.floor(min1.length / 2)];
  reg('relógio anda (crescente; ~22\' no meio do 1º tempo)', `meio do 1º tempo ${meio}'${cresce ? '' : ', voltou'}`, '20–25\' e nunca volta', cresce && meio >= 20 && meio <= 25);
  reg('intervalo aos 45\' e fim aos 90\'', `${minIntervalo}' e ${minFim}'`, '45\' e 90\'', minIntervalo === 45 && minFim === 90);
  reg('intervalo troca o lado (m.ataca e o goleiro)', `ataca[0] ${lado0} → ${m.ataca[0]}; goleiro no outro gol: ${golOk}`, 'invertido; sim', m.ataca[0] === -lado0 && golOk === true);
  reg('saída do 2º tempo é de quem não começou', `1º: time ${saida1}; 2º: time ${saida2}`, `2º: time ${1 - saida1}`, saida2 === 1 - saida1);
  // fim para tudo
  const foto = () => [m.bola.p.x, m.bola.p.y, m.bola.p.z, ...m.jogadores.flatMap(j => [j.x, j.z, j.rumo])];
  const a = foto();
  const t0 = m.tick;
  for (let k = 0; k < 120; k++) S.passo(m, { x: 1, z: 0, botoes: 0 });
  const b = foto();
  const parado = a.every((v, k) => v === b[k]);
  reg('fim para tudo (120 passos depois)', `${parado ? 'tudo parado' : 'mexeu'}; estado ${m.partida.estado}; tick ${m.tick - t0 === 120 ? 'anda' : 'parado'}`, 'tudo parado; fim', parado && m.partida.estado === 'fim');
}

// --------------------------------------------------------------- C e D. paradas (paralelo)
function rodarFilho(sementes, min, parado) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--filho', sementes.join(','), String(min), parado ? '1' : '0', '--js', JS, ...(ANTES ? ['--antes'] : [])]);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))));
  });
}
// 2 processos (o rodar-testes já roda os testes em paralelo: mais que isso disputa os núcleos com o
// teste-custo, que mede tempo); --par N muda
const nPar = Math.max(1, Math.min(+arg('--par', 2), os.cpus().length || 1));
const lotes = Array.from({ length: nPar }, () => []);
SEMENTES.forEach((s, k) => lotes[k % nPar].push(s));
const [resC, resD] = await Promise.all([
  Promise.all(lotes.filter(l => l.length).map(l => rodarFilho(l, MIN, false))).then(a => a.flat()),
  rodarFilho([BASE + 200, BASE + 201], 2, true),
]);
{
  const r = resC.sort((a, b) => a.sem - b.sem);
  const max = Math.max(0, ...r.flatMap(x => x.paradas.map(p => p.s)));
  const nPar2 = r.reduce((s, x) => s + x.paradas.length, 0);
  reg(`C. nenhuma parada > 8 s (${r.length} sementes × ${MIN} min, IA × IA)`, `${nPar2} paradas, a mais longa ${fmt(max, 2)} s`, '≤ 8 s', max <= 8 && nPar2 > 0);
  const rol = r.map(x => (100 * x.rolando) / Math.max(1, x.total));
  const rolMin = Math.min(...rol), rolMed = rol.slice().sort((a, b) => a - b)[rol.length >> 1];
  reg('C. bola rolando (% do tempo de jogo)', `mediana ${fmt(rolMed)}%, pior ${fmt(rolMin)}%`, '≥ 60% em todas', rolMin >= 60);
  reg('C. sem NaN', r.some(x => x.nan) ? 'NaN' : 'sem NaN', 'sem NaN', !r.some(x => x.nan));
  const tro = r.map(x => x.trocas);
  reg('C. posse troca no tempo (não trava)', `mín ${Math.min(...tro)}, mediana ${tro.slice().sort((a, b) => a - b)[tro.length >> 1]}`, '≥ 10 em todas', Math.min(...tro) >= 10);
  const vp = r.reduce((s, x) => s + x.violaPosse, 0);
  reg('C. na parada, só o cobrador fica com a bola', `${vp} ticks fora da regra`, '0', vp === 0);
  const soma = k => r.reduce((s, x) => s + x[k], 0);
  const sg = soma('saidasGol');
  const tipos = {};
  for (const x of r) for (const k in x.tipos) tipos[k] = (tipos[k] ?? 0) + x.tipos[k];
  reg('C. saída: adversários fora do círculo e todos no seu campo até o 1º toque', `${soma('violaSaida')} + ${soma('violaCampo')} ticks fora da regra; ${sg} saídas depois de gol`, '0 + 0; ≥ 1 saída depois de gol', soma('violaSaida') === 0 && soma('violaCampo') === 0 && sg >= 1);
  reg('C. lateral/escanteio/tiro de meta: ninguém entra no raio; ninguém dentro na cobrança', `${soma('violaEntra')} entradas; ${soma('violaCobranca')} cobranças com alguém dentro; cobranças ${JSON.stringify(tipos)}`, '0; 0', soma('violaEntra') === 0 && soma('violaCobranca') === 0);
  const det = r.flatMap(x => x.detalhes);
  if (det.length) console.log('detalhes das paradas fora da regra:\n  ' + det.slice(0, 12).join('\n  '));
  const naoAcabou = r.filter(x => !x.fim).length;
  reg('C. o tempo termina (intervalo)', `${r.length - naoAcabou} de ${r.length}`, 'todas', naoAcabou === 0);
}
{
  const r = resD;
  const max = Math.max(0, ...r.flatMap(x => x.paradas.map(p => p.s)));
  const n = r.reduce((s, x) => s + x.paradas.length, 0);
  reg('D. humano parado: nenhuma parada > 8 s (a IA cobra por ele)', `${n} paradas, a mais longa ${fmt(max, 2)} s`, '≤ 8 s', max <= 8 && n > 0);
}

// ------------------------------------------------------------------ E. canhão de bolas para fora
{
  const B = await imp('bola.js');
  const meioX = 52.5, meioZ = 34;
  /** Partida rolando no tempo `tempo` (1 ou 2), pronta para receber a bola do canhão. */
  function partidaRolando(sem, tempo) {
    const m = S.criar({ semente: sem, minutosPorTempo: 2, iaClassica: ANTES });
    if (tempo === 2) m.partida.tick0Tempo -= m.partida.ticksPorTempo; // o 1º tempo acaba no próximo passo
    for (let i = 0; i < 1500 && !(m.partida.estado === 'jogo' && m.partida.tempo === tempo); i++) S.passo(m, S.demo(m));
    return m;
  }
  /** Afasta de (x, z) quem está a < 12 m (para ninguém tocar a bola no caminho). */
  function afastar(m, x, z, menos = null) {
    for (const j of m.jogadores) {
      if (j === menos) continue;
      const d = Math.hypot(j.x - x, j.z - z);
      if (d < 12) P.teleportar(j, Math.max(-50, Math.min(50, j.x + (j.x >= x ? 14 : -14))), j.z * 0.4, j.rumo);
    }
  }
  let certos = 0, total = 0, maxParada = 0, erros = [], desvValidos = 0, desvCertos = 0, entrou = 0, dentroCobranca = 0;
  for (let k = 0; k < 48; k++) {
    const desvio = k >= 40;
    const tempo = (k >> 1) % 2 === 0 ? 1 : 2;
    const m = partidaRolando(BASE + 300 + k, tempo);
    if (m.partida.estado !== 'jogo') { erros.push(`#${k}: não rolou`); total++; continue; }
    const lateral = desvio || k % 2 === 0;
    const sx = (k >> 2) % 2 === 0 ? 1 : -1, sz = (k >> 3) % 2 === 0 ? 1 : -1;
    const toque = (k >> 4) % 2 === 0 ? 0 : 1;
    const toq = m.jogadores.find(j => j.time === toque && j.posicao !== 'GOL');
    let x0, z0, vx, vz, alvoX = null;
    if (lateral) {
      x0 = sx * (5 + (k * 7) % 40); z0 = sz * (meioZ - 4); vx = sx * -2; vz = sz * 13;
      alvoX = x0 + vx * (Math.abs(sz * meioZ - z0) / Math.abs(vz));
    } else {
      x0 = sx * (meioX - 4); z0 = sz * ((k * 5) % 30 + 1); vx = sx * 13; vz = sz * 1.5;
    }
    m.posse = null; m.naMao = null; m.voo = null;
    for (const j of m.jogadores) { j.recebe = null; j.corrida = null; }
    let defl = null;
    if (desvio) {
      // um jogador do outro time encostado na linha, de lado no caminho: a bola raspa nele e sai
      defl = m.jogadores.find(j => j.time !== toque && j.posicao !== 'GOL' && j.id !== m.controlado[1 - toque]) ?? m.jogadores.find(j => j.time !== toque && j.posicao !== 'GOL');
      afastar(m, x0, z0 + sz * 2, defl);
      P.teleportar(defl, x0 + 0.24, sz * (meioZ - 1.4), 0);
      defl.papel = 'parado'; // não domina a bola: só desvia
      vx = 0; vz = sz * 12;
    } else afastar(m, x0, z0);
    Object.assign(m.bola, B.criarBola(x0, z0));
    B.chutarRasteiro(m.bola, vx, vz);
    m.ultimoToque = { id: toq.id, time: toque, tick: m.tick };
    let montada = null, bateu = false, cobrou = null, t0 = m.tick, saiuLateral = null, dentroAntes = null;
    for (let i = 0; i < 900 && cobrou == null; i++) {
      const ev = S.passo(m, S.demo(m));
      for (const e of ev) {
        if (e.tipo === 'bateuCorpo' && defl && e.id === defl.id && montada == null) bateu = true;
        if (e.tipo === 'fora' && saiuLateral == null) saiuLateral = Math.abs(m.bola.p.z) > meioZ;
        if (e.tipo === 'cobranca' && montada) { cobrou = (m.tick - t0) * PASSO; if (dentroAntes && dentroAntes.size) dentroCobranca++; }
      }
      if (!montada && m.parada && m.parada.cobrador != null) montada = { ...m.parada, naMao: m.naMao, ataca: { ...m.ataca }, lateralNaLinha: BOLAS_E4, tiroDeMetaNoChao: BOLAS_E4 };
      // raio da parada: ninguém entra; ninguém dentro na cobrança
      const pr = m.parada;
      if (pr && pr.cobrador != null && !pr.rolou) {
        const agora = new Set();
        for (const j of m.jogadores) {
          if (j.id === pr.cobrador || j.time === pr.time || j === defl) continue;
          const den = pr.raio === 'area' ? Math.abs(j.x + m.ataca[pr.time] * meioX) < 16.5 - TOL && Math.abs(j.z) < 20.16 - TOL : Math.hypot(j.x - pr.x, j.z - pr.z) < pr.raio - TOL;
          if (den) agora.add(j.id);
        }
        if (dentroAntes) for (const id of agora) if (!dentroAntes.has(id)) entrou++;
        dentroAntes = agora;
      }
      if (defl && montada && defl.papel === 'parado' && m.parada?.cobrador !== defl.id) defl.papel = 'ia';
      if (!montada && i > 400) break;
    }
    if (defl && defl.papel === 'parado' && m.parada?.cobrador !== defl.id) defl.papel = 'ia';
    if (desvio) {
      if (!bateu || !saiuLateral || !montada) continue; // não raspou ou não saiu pela lateral: caso não vale
      desvValidos++;
      const ok = montada.tipo === 'lateral' && montada.time === toque; // o último toque foi do outro time
      if (ok) desvCertos++; else erros.push(`desvio #${k}: ${montada.tipo} para ${montada.time} (esperado lateral para ${toque})`);
      maxParada = Math.max(maxParada, cobrou ?? 99);
      continue;
    }
    total++;
    if (!montada) { erros.push(`#${k}: nenhum recomeço`); continue; }
    maxParada = Math.max(maxParada, cobrou ?? 99);
    let ok, esperado;
    if (lateral) {
      esperado = `lateral para ${1 - toque} em x≈${alvoX.toFixed(1)}`;
      // (Etapa 4, Regra 15: o ponto do lateral é a linha — o cobrador com o pé sobre ela; antes, 0,3 m para dentro)
      const zl = montada.lateralNaLinha ? meioZ : meioZ - 0.3;
      ok = montada.tipo === 'lateral' && montada.time === 1 - toque && Math.abs(montada.x - alvoX) <= 1 && Math.sign(montada.z) === sz && Math.abs(Math.abs(montada.z) - zl) < 1e-9;
    } else {
      const defende = montada.ataca[0] === -sx ? 0 : 1;
      if (toque === defende) {
        esperado = `escanteio para ${1 - defende}`;
        ok = montada.tipo === 'escanteio' && montada.time === 1 - defende && Math.sign(montada.x) === sx && Math.sign(montada.z) === sz;
      } else {
        esperado = `tiro de meta para ${defende}`;
        const g = m.jogadores.find(j => j.time === defende && j.posicao === 'GOL');
        // (Etapa 4, Regra 16: a bola no chão dentro da pequena área e o goleiro cobra com o pé; antes, nas mãos dele)
        ok = montada.tipo === 'tiroDeMeta' && montada.time === defende && montada.cobrador === g.id
          && (montada.tiroDeMetaNoChao ? montada.naMao == null && Math.abs(montada.x) >= meioX - 5.5 && Math.abs(montada.x) <= meioX : montada.naMao === g.id && Math.abs(montada.x - sx * (meioX - 5.5)) < 0.01);
      }
    }
    if (ok) certos++; else erros.push(`#${k} (${tempo}º tempo): ${montada.tipo} para ${montada.time} em (${montada.x.toFixed(1)}, ${montada.z.toFixed(1)}); esperado ${esperado}`);
  }
  if (erros.length) console.log('canhão:\n  ' + erros.slice(0, 10).join('\n  '));
  reg('E. canhão: 40 bolas para fora → recomeço certo (tipo, time, ponto)', `${certos}/${total}`, '40/40', certos === 40 && total === 40);
  reg('E. desvio no corpo antes de sair: lateral para o outro time', `${desvCertos}/${desvValidos} válidos (de 8)`, 'todos certos, ≥ 4 válidos', desvValidos >= 4 && desvCertos === desvValidos);
  reg('E. canhão: cobrado em ≤ 8 s', `a mais longa ${fmt(maxParada, 2)} s`, '≤ 8 s', maxParada <= 8);
  reg('E. canhão: ninguém entra no raio; ninguém dentro na cobrança', `${entrou} entradas; ${dentroCobranca} cobranças com alguém dentro`, '0; 0', entrou === 0 && dentroCobranca === 0);
}

// ------------------------------------------- F. corpo embalado na borda da parada (trombada, embalo)
{
  const CFG = await imp('config.js');
  const AC = await imp('acoes.js');
  const { PARTIDA, JOGADOR, BOTAO, CAMPO } = CFG;
  const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  // partida rolando (sem parada) para clonar
  const m0 = S.criar({ semente: BASE + 400, iaClassica: ANTES });
  for (let i = 0; i < 3000 && !(i > 240 && m0.partida.estado === 'jogo' && !m0.parada); i++) S.passo(m0, S.demo(m0));
  const parado = { x: 0, z: 0, botoes: 0 };
  /** Clona a partida e monta a parada `tipo` do time 1 (o humano, time 0, defende); null se não montou. */
  function montar(tipo) {
    const m = structuredClone(m0);
    const t = 1, lado = m.ataca[t];
    const ult = m.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL');
    m.posse = null; m.naMao = null; m.voo = null;
    if (tipo === 'lateral' || tipo === 'escanteio') {
      // bola fora com o último toque do time 0
      const x = tipo === 'lateral' ? -10 : lado * (MX + 0.6), z = tipo === 'lateral' ? MZ + 0.5 : 12;
      Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
      m.partida.ultimoTime = 0; m.partida.ultimoId = ult.id; m.partida.ultimoTick = m.tick;
      m.ultimoToque = { id: ult.id, time: 0, tick: m.tick };
    } else {
      // falta de um zagueiro do time 0 no atacante do time 1: tiro livre a 26 m ou pênalti (Etapa 4, faltas.js)
      const area = tipo === 'penalti', x = lado * (MX - (area ? 8 : 26)), z = area ? 2 : 3;
      const At = m.jogadores.find(o => o.time === t && o.posicao === 'ATA') ?? m.jogadores.find(o => o.time === t && o.posicao !== 'GOL');
      const D = m.jogadores.find(o => o.time === 0 && o.posicao === 'ZAG') ?? ult;
      P.teleportar(At, x, z, 0); P.teleportar(D, x - lado, z, 0); At.vx = 0;
      m.posse = At.id; m.eventos = [];
      m.faltaPendente = { def: D.id, cond: At.id, time: t, x, z, area, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick };
      if (P.regrasPartida) P.regrasPartida(m);
    }
    for (let i = 0; i < 500; i++) {
      const pr = m.parada;
      if (pr && pr.tipo === tipo && pr.cobrador != null && !pr.rolou) return m;
      S.passo(m, parado);
    }
    return null;
  }
  const TIPOS = ['lateral', 'escanteio', 'tiroLivre', 'penalti'];
  const F = PARTIDA.folgaRaio ?? 0;
  let n = 0, entraram = 0, pior = Infinity;
  const naoMontou = [], porTipo = {}, exemplos = [];
  for (const tipo of TIPOS) {
    const mb = montar(tipo);
    if (!mb) { naoMontou.push(tipo); continue; }
    const pr0 = mb.parada, R = pr0.raio, lado = mb.ataca[pr0.time];
    // de que lado o jogador do humano chega: de dentro do campo (lateral, escanteio) ou do meio-campo (tiro livre e
    // pênalti: a meia-lua fora da área)
    const th0 = tipo === 'lateral' ? Math.atan2(-Math.sign(pr0.z), 0) : tipo === 'escanteio' ? Math.atan2(-Math.sign(pr0.z), -lado) : Math.atan2(0, -lado);
    porTipo[tipo] = 0;
    for (const dth of [-30, 0, 30]) for (const delta of [0.05, 0.3]) for (const f of [0.9, 1]) for (const u of [3.5, 6]) for (const sg of [-1, 1]) {
      const m = structuredClone(mb), pr = m.parada;
      const th = th0 + dth * Math.PI / 180, nx = Math.cos(th), nz = Math.sin(th); // do ponto para fora
      const tx = -nz * sg, tz = nx * sg;                                            // tangente (para onde ele corre)
      const vin = f * Math.sqrt(2 * JOGADOR.freio * (delta + F));                   // a freada normal para antes do raio
      const j = m.jogadores.find(o => o.time !== pr.time && o.posicao !== 'GOL' && o.id !== pr.cobrador && o.papel !== 'parado' && !(pr.barreira && pr.barreira.ids.includes(o.id)));
      P.teleportar(j, pr.x + nx * (R + F + delta), pr.z + nz * (R + F + delta), Math.atan2(tz, tx));
      j.vx = tx * u - nx * vin; j.vz = tz * u - nz * vin;
      AC.assumirControle(m, 0, j);
      let dmin = Infinity;
      for (let i = 0; i < 180; i++) {
        const ev = S.passo(m, { x: tx, z: tz, botoes: BOTAO.CORRER });
        if (m.parada !== pr || ev.some(e => e.tipo === 'cobranca')) break;
        dmin = Math.min(dmin, Math.hypot(j.x - pr.x, j.z - pr.z));
      }
      n++;
      pior = Math.min(pior, dmin - R);
      if (dmin < R - TOL) {
        entraram++; porTipo[tipo]++;
        if (exemplos.length < 6) exemplos.push(`${tipo} θ ${dth}° δ ${fmt(delta, 2)} m, para dentro ${fmt(vin, 2)} m/s, de lado ${fmt(u, 1)} m/s: chegou a ${fmt(dmin, 3)} m (raio ${R})`);
      }
    }
  }
  if (exemplos.length) console.log('F. entraram:\n  ' + exemplos.join('\n  '));
  reg('F. corpo embalado na borda (trombada correndo de lado): ninguém entra no raio (lateral, escanteio, tiro livre, pênalti)',
    `${entraram} de ${n} cenas entraram (${TIPOS.map(t => `${t} ${porTipo[t] ?? '—'}`).join(' · ')}); menor folga ${fmt(pior, 3)} m${naoMontou.length ? `; não montou: ${naoMontou.join(', ')}` : ''}`,
    '0 de 192', n === 192 && entraram === 0);
}

// ------------------------------------------------------------- T. a duração (item 33: mudarDuracao)
{
  const { PARTIDA } = await imp('config.js');
  const RP = existe('relogio-placar.js') ? await imp('relogio-placar.js') : null;
  const temT = typeof P.mudarDuracao === 'function' && typeof P.ticksDoTempo === 'function';
  if (!temT) {
    for (const k of ['T1', 'T2', 'T3', 'T4', 'T5']) reg(`${k}. a duração (item 33)`, 'sem ticksDoTempo/mudarDuracao nesta lógica', 'existe', false);
  } else {
    // T1
    const dur = PARTIDA.duracoes;
    const okLista = Array.isArray(dur) && dur.join(',') === '3,4,5,6,8,10' && dur.includes(PARTIDA.minutosPorTempo) && PARTIDA.minutosPorTempo === 4;
    const okTicks = (dur ?? []).every(k => P.ticksDoTempo(k) === k * 3600 && P.criarPartida({ semente: 1, minutosPorTempo: k }).partida.ticksPorTempo === k * 3600);
    reg('T1. PARTIDA.duracoes e ticksDoTempo(k) = k·3600 = o ticksPorTempo do criarPartida', `${JSON.stringify(dur)}; padrão ${PARTIDA.minutosPorTempo}; ticks ${okTicks ? 'iguais' : 'DIFERENTES'}`, '[3,4,5,6,8,10], padrão 4 nela; iguais', okLista && okTicks);

    // T2: estados montados à mão
    const ORIG = [0.25, 0.5, 1, 4, 6, 10, 45], DEST = [3, 4, 5, 6, 8, 10, 0.25];
    let semente = 12345;
    const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
    let casos = 0, minDif = 0, segDif = 0, segLonge = 0, segVolta = 0, acrDif = 0, regDif = 0, contaDif = 0;
    const exemplos = [];
    const foto = m => ({ mi: P.minutoDeJogo(m), s: RP.segundoDeJogo(m), ac: JSON.stringify(P.acrescimoDeJogo(m)), reg: m.partida.estado !== 'intervalo' && m.tick - m.partida.tick0Tempo >= m.partida.ticksPorTempo });
    const confereConta = m => {
      const p = m.partida;
      if (p.estado === 'intervalo' || typeof P.segundoNoTempo !== 'function') return;
      const d = Math.max(0, m.tick - p.tick0Tempo);
      if ((p.tempo - 1) * 2700 + P.segundoNoTempo(d, p.ticksPorTempo) !== RP.segundoDeJogo(m)) contaDif++;
    };
    for (const m0 of ORIG) {
      const m = P.criarPartida({ semente: 3, minutosPorTempo: m0 });
      const T = P.ticksDoTempo(m0);
      // d no tempo regulamentar: as bordas de cada minuto (±1) e sorteados; nos acréscimos: até 10 min de jogo além
      const ds = [0, 1, T - 1];
      for (let k = 1; k < 45; k++) { const b = Math.round(k * T / 45); ds.push(b - 1, b, b + 1); }
      for (let k = 0; k < 120; k++) ds.push(Math.floor(rnd() * T));
      const dsAcr = [T, T + 1];
      for (let k = 0; k < 40; k++) dsAcr.push(T + Math.floor(rnd() * T * 10 / 45));
      const estados = [];
      for (const tempo of [1, 2]) {
        for (const d of ds) estados.push({ tempo, d, acr: null, est: 'jogo' });
        for (const d of dsAcr) estados.push({ tempo, d, acr: 1 + Math.floor(rnd() * 10), est: rnd() < 0.2 ? 'parada' : 'jogo' });
      }
      estados.push({ tempo: 1, d: 0, acr: null, est: 'intervalo' });
      for (const e of estados) {
        for (const m1 of DEST) {
          if (m1 === m0) continue;
          const p = m.partida;
          m.tick = 50000 + e.d + 7; p.tempo = e.tempo; p.tick0Tempo = m.tick - e.d; p.ticksPorTempo = T; p.estado = e.est; p.acrescimo = e.acr;
          confereConta(m);
          const a = foto(m);
          const ok = P.mudarDuracao(m, m1);
          confereConta(m);
          const b = foto(m);
          casos++;
          const T2 = P.ticksDoTempo(m1);
          if (!ok || a.mi !== b.mi) { minDif++; if (exemplos.length < 6) exemplos.push(`${m0}→${m1} t${e.tempo} d ${e.d}: minuto ${a.mi} → ${b.mi}${ok ? '' : ' (recusou)'}`); }
          if (T2 >= 2700) { if (a.s !== b.s) { segDif++; if (exemplos.length < 6) exemplos.push(`${m0}→${m1} t${e.tempo} d ${e.d}: segundo ${a.s} → ${b.s}`); } }
          else { if (Math.abs(b.s - a.s) > Math.ceil(2700 / T2)) segLonge++; if (b.s < a.s) segVolta++; }
          if (a.ac !== b.ac) { acrDif++; if (exemplos.length < 6) exemplos.push(`${m0}→${m1} t${e.tempo} d ${e.d}: acréscimo ${a.ac} → ${b.ac}`); }
          if (a.reg !== b.reg) regDif++;
          if (e.est === 'intervalo' && (m.partida.ticksPorTempo !== T2 || m.partida.tick0Tempo !== m.tick - e.d)) regDif++;
        }
      }
    }
    if (exemplos.length) console.log('T2:\n  ' + exemplos.join('\n  '));
    reg(`T2. mudarDuracao em ${casos} estados (7 origens × 7 destinos; 1º/2º tempo, acréscimos, intervalo, tick 0): minuto, acréscimo e "regular" iguais`,
      `minuto diferente em ${minDif}; acréscimo em ${acrDif}; regular em ${regDif}`, '0; 0; 0', casos > 0 && minDif === 0 && acrDif === 0 && regDif === 0);
    reg('T2. o segundo mostrado: IGUAL com T\' ≥ 2700 ticks (as 6 opções); com T\' menor, a ≤ ⌈2700/T\'⌉ s',
      `diferente em ${segDif} (T' ≥ 2700); longe em ${segLonge} (T' < 2700; voltou ${segVolta}, informativo)`, '0; 0', segDif === 0 && segLonge === 0);
    reg('T2. segundoNoTempo (partida.js) = segundoDeJogo (relogio-placar.js) em todos os casos', typeof P.segundoNoTempo === 'function' ? `${contaDif} diferentes` : 'sem segundoNoTempo', '0', typeof P.segundoNoTempo === 'function' && contaDif === 0);

    // T3: partida de verdade (demo, 2 sementes × 1 min), 0,5 no minuto 20 e 1,5 no minuto 60
    const SUM = existe('sumula.js') ? await imp('sumula.js') : null;
    let volta = 0, apitoLonge = 0, sumFora = 0, sumVolta = 0, nApitos = 0;
    const det3 = [];
    for (const sem of [BASE + 300, BASE + 301]) {
      const m = S.criar({ semente: sem, minutosPorTempo: 1 });
      let ultS = -1, ultTM = 0, mud = null;
      for (let i = 0; i < 40000 && m.partida.estado !== 'fim'; i++) {
        const mi = P.minutoDeJogo(m);
        if (!mud && m.partida.tempo === 1 && mi >= 20 && m.partida.estado !== 'intervalo') {
          const d = m.tick - m.partida.tick0Tempo; P.mudarDuracao(m, 0.5); mud = { tick: m.tick, d2: m.tick - m.partida.tick0Tempo, T2: m.partida.ticksPorTempo, ev: 'intervalo', d };
        } else if (mud && mud.ev === 'intervalo' && mud.feito && m.partida.tempo === 2 && mi >= 60) {
          P.mudarDuracao(m, 1.5); mud = { tick: m.tick, d2: m.tick - m.partida.tick0Tempo, T2: m.partida.ticksPorTempo, ev: 'fimDeJogo' };
        }
        const ev = S.passo(m, S.demo(m));
        // (o relógio de um tempo: no intervalo e no fim o placar mostra 45:00 e 90:00 — de 47:13 nos acréscimos para "Intervalo")
        const est = m.partida.estado;
        const s = est === 'intervalo' || est === 'fim' ? -1 : RP.segundoDeJogo(m);
        if (s >= 0 && s < ultS) { volta++; if (det3.length < 4) det3.push(`sem ${sem} tick ${m.tick}: ${ultS} → ${s}`); }
        ultS = s;
        if (SUM) {
          const tm = SUM.minutoTM(m), t = m.partida.tempo;
          if (tm < ultTM) sumVolta++;
          ultTM = tm;
          if (ev.some(e => e.tipo === 'gol') && !(t === 1 ? tm >= 1 && tm <= 45 : tm >= 46 && tm <= 90)) sumFora++;
        }
        const ap = ev.find(e => e.tipo === mud?.ev);
        if (ap) {
          nApitos++;
          const p = m.partida, acr = p.acrescimo ?? 0;
          const esperado = mud.tick + (mud.T2 - mud.d2) + Math.round(acr * mud.T2 / 45);
          if (Math.abs(m.tick - esperado) > 1) { apitoLonge++; if (det3.length < 4) det3.push(`sem ${sem}: ${mud.ev} no tick ${m.tick}, esperado ${esperado}`); }
          mud.feito = true;
          if (mud.ev === 'fimDeJogo') mud = { ev: 'nada', feito: true };
        }
      }
      if (m.partida.estado !== 'fim') { apitoLonge++; det3.push(`sem ${sem}: não acabou`); }
    }
    if (det3.length) console.log('T3:\n  ' + det3.join('\n  '));
    reg('T3. partida (demo, 2 × 1 min; 0,5 min no minuto 20 e 1,5 no 60): o relógio nunca volta; intervalo e fim no passo previsto (±1)',
      `voltou ${volta}×; ${nApitos} apitos, ${apitoLonge} fora do previsto`, '0; 4 apitos, 0 fora', volta === 0 && nApitos === 4 && apitoLonge === 0);
    reg('T3. o minuto da súmula (minutoTM): em 1–45 / 46–90 nos gols e nunca volta', SUM ? `${sumFora} gols fora; voltou ${sumVolta}×` : 'sem sumula.js', '0; 0', !!SUM && sumFora === 0 && sumVolta === 0);

    // T4: recusas
    const { hashMundo } = SIM;
    const recusas = [];
    const recusa = (nome, m, min = 6) => { const h0 = hashMundo(m); const r = P.mudarDuracao(m, min); recusas.push(`${nome} ${r === false && hashMundo(m) === h0 ? 'ok' : 'ACEITOU'}`); return r === false && hashMundo(m) === h0; };
    let okT4 = true;
    okT4 = recusa('dois humanos', P.criarPartida({ semente: 2, humanos: [0, 1] })) && okT4;
    { const m = P.criarPartida({ semente: 2 }); m.online = true; okT4 = recusa('m.online', m) && okT4; }
    if (existe('livre.js')) { const L = await imp('livre.js'); okT4 = recusa('Livre', L.criarLivre({ semente: 2 })) && okT4; }
    if (existe('disputa.js')) { const D = await imp('disputa.js'); okT4 = recusa('Pênaltis', D.criarDisputa({ semente: 2 })) && okT4; }
    { const SS = await imp('sessao.js'); const m = SS.criarTreino({ modo: 'ataque', semente: 2 }); const h0 = hashMundo(m); const r = P.mudarDuracao(m, 6); recusas.push(`treino ${r === false && hashMundo(m) === h0 ? 'ok' : 'ACEITOU'}`); okT4 = r === false && hashMundo(m) === h0 && okT4; }
    { const m = P.criarPartida({ semente: 2 }); m.partida.estado = 'fim'; okT4 = recusa('fim', m) && okT4; }
    { const m = P.criarPartida({ semente: 2 }); for (let i = 0; i < 300; i++) S.passo(m, S.demo(m)); okT4 = recusa('min 0', m, 0) && okT4; okT4 = recusa('min −1', m, -1) && okT4; okT4 = recusa('min NaN', m, NaN) && okT4; }
    reg('T4. recusas (false e o hash IGUAL)', recusas.join('; '), 'todas ok', okT4);

    // T5: o hash
    const ma = P.criarPartida({ semente: 4 }), mb = P.criarPartida({ semente: 4 }), mc = P.criarPartida({ semente: 4 });
    for (let i = 0; i < 1500; i++) { S.passo(ma, S.demo(ma)); S.passo(mb, S.demo(mb)); S.passo(mc, S.demo(mc)); }
    P.mudarDuracao(mb, 4); P.mudarDuracao(mc, 6);
    for (let i = 0; i < 600; i++) { S.passo(ma, S.demo(ma)); S.passo(mb, S.demo(mb)); S.passo(mc, S.demo(mc)); }
    const igual4 = hashMundo(ma) === hashMundo(mb), difere6 = hashMundo(ma) !== hashMundo(mc);
    const z = P.criarPartida({ semente: 5 }); P.mudarDuracao(z, 6);
    const z6 = P.criarPartida({ semente: 5, minutosPorTempo: 6 });
    let igualTick0 = hashMundo(z) === hashMundo(z6);
    for (let i = 0; i < 600 && igualTick0; i++) { S.passo(z, S.demo(z)); S.passo(z6, S.demo(z6)); if (i % 100 === 0 && hashMundo(z) !== hashMundo(z6)) igualTick0 = false; }
    igualTick0 = igualTick0 && hashMundo(z) === hashMundo(z6);
    reg('T5. o hash: mudarDuracao(m, 4) numa de 4 min IGUAL; (m, 6) DIFERE; no tick 0, (m, 6) = criarPartida({minutosPorTempo: 6}) por 600 passos',
      `${igual4 ? 'igual' : 'DIFERENTE'}; ${difere6 ? 'difere' : 'IGUAL'}; tick 0 ${igualTick0 ? 'igual' : 'DIFERENTE'}`, 'igual; difere; igual', igual4 && difere6 && igualTick0);
  }
}
fim();
