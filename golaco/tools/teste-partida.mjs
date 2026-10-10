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
//     quem defende; senão tiro de meta com o goleiro com a bola nas mãos) e cobrado em ≤ 8 s.
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
const PASSO = 1 / 60;
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
    if (pr.raio === 'area') { const gx = -m.ataca[pr.time] * 52.5; return Math.abs(j.x - gx) < 16.5 && Math.abs(j.z) < 20.16; }
    return Math.hypot(j.x - pr.x, j.z - pr.z) < pr.raio;
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
      if (!montada && m.parada && m.parada.cobrador != null) montada = { ...m.parada, naMao: m.naMao, ataca: { ...m.ataca } };
      // raio da parada: ninguém entra; ninguém dentro na cobrança
      const pr = m.parada;
      if (pr && pr.cobrador != null && !pr.rolou) {
        const agora = new Set();
        for (const j of m.jogadores) {
          if (j.id === pr.cobrador || j.time === pr.time || j === defl) continue;
          const den = pr.raio === 'area' ? Math.abs(j.x + m.ataca[pr.time] * meioX) < 16.5 && Math.abs(j.z) < 20.16 : Math.hypot(j.x - pr.x, j.z - pr.z) < pr.raio;
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
      ok = montada.tipo === 'lateral' && montada.time === 1 - toque && Math.abs(montada.x - alvoX) <= 1 && Math.sign(montada.z) === sz && Math.abs(Math.abs(montada.z) - (meioZ - 0.3)) < 1e-9;
    } else {
      const defende = montada.ataca[0] === -sx ? 0 : 1;
      if (toque === defende) {
        esperado = `escanteio para ${1 - defende}`;
        ok = montada.tipo === 'escanteio' && montada.time === 1 - defende && Math.sign(montada.x) === sx && Math.sign(montada.z) === sz;
      } else {
        esperado = `tiro de meta para ${defende}`;
        const g = m.jogadores.find(j => j.time === defende && j.posicao === 'GOL');
        ok = montada.tipo === 'tiroDeMeta' && montada.time === defende && montada.naMao === g.id && Math.abs(montada.x - sx * (meioX - 5.5)) < 0.01;
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
fim();
