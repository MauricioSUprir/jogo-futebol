// Partida IA × IA para os testes da IA tática (Etapa 3, Parte 2: teste-forma, teste-taticas,
// teste-pressao). Carrega a lógica de uma pasta (--js), cria a partida com ou sem a IA tática
// (--antes = criarPartida({iaClassica: true}), a IA de hoje no 11×11) e mede, com as definições de
// tools/lib/partida-medidas.mjs (Metrica/FIFA/Wyscout/StatsBomb), a forma e a pressão.
//
// IA × IA "pura": ninguém é do humano (m.humanos = []), então os 22 são guiados pela IA com as
// mesmas regras (o controlado da demo não dá bote nem gira como a IA — mediria dois times diferentes).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as M from './partida-medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** Argumentos comuns: --antes, --js <pasta>, --sementes N (ou SEMENTES=N), --base K (sementes K+1..K+N). */
export function argumentos(padraoSementes = 8) {
  const a = process.argv.slice(2);
  const val = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
  const js = path.resolve(val('--js', path.resolve(AQUI, '../../js')));
  const n = +(val('--sementes', process.env.SEMENTES ?? padraoSementes));
  const base = +(val('--base', process.env.BASE ?? 0));
  return { antes: a.includes('--antes'), js, sementes: Array.from({ length: n }, (_, k) => base + k + 1), detalhe: a.includes('--detalhe') };
}

/** Importa os módulos da lógica da pasta `js`. */
export async function carregar(js) {
  const imp = f => import(pathToFileURL(path.join(js, f)).href);
  const [P, S, C, F, Bo, A] = await Promise.all([imp('partida.js'), imp('sim.js'), imp('config.js'), imp('formacoes.js'), imp('bola.js'), imp('ia-ataque.js')]);
  let T = null;
  try { T = await imp('tatica.js'); } catch { T = null; }
  return { P, S, C, T, F, Bo, A, js };
}

const NADA = { x: 0, z: 0, botoes: 0 };

/**
 * A IA com a bola da Parte 3 já existe nesta lógica? (ia-ataque.js devolve uma entrada para o apoio
 * ou para o condutor, e não null.) As metas que dependem do ataque (forma com a bola, PPDA absoluto,
 * agressão, retomada, jogadores na área no cruzamento) só contam com ela: contra o condutor clássico
 * do treino (conduz para o gol e perde a bola ~25×/min no 11×11) elas medem o ataque, não a defesa.
 */
export function parte3Presente(L) {
  const m = L.P.criarPartida({ semente: 3, minutosPorTempo: 60 });
  m.humanos = [];
  let d = null;
  for (let i = 0; i < 3600 && !d; i++) {
    L.P.passoPartida(m, NADA);
    if (i >= 120) d = m.jogadores.find(o => o.id === m.posse && o.posicao !== 'GOL') ?? null;
  }
  if (!d) return false;
  const c = structuredClone(m);
  const dc = c.jogadores.find(o => o.id === d.id), ap = c.jogadores.find(o => o.time === d.time && o.id !== d.id && o.posicao !== 'GOL');
  return L.A.condutorTatico(c, dc) != null || L.A.apoioTatico(c, ap) != null;
}
/**
 * Partida IA × IA. opc: {antes, times: {0: {formacao, tatica}, 1: {...}}, minutos (por tempo; padrão
 * 60 = sem intervalo no trecho medido)}.
 */
export function criarJogo(L, semente, opc = {}) {
  const m = L.P.criarPartida({ semente, iaClassica: !!opc.antes, minutosPorTempo: opc.minutos ?? 60, times: opc.times });
  m.humanos = [];
  return m;
}
export const passoJogo = (L, m) => L.P.passoPartida(m, NADA);

/**
 * Linhas da forma SEM a bola pela formação (Forcher 2024 mede as linhas do bloco defensivo): defesa
 * = grupo 'def'; frente = quem fica em x ≥ 0 na tabela sem a bola (o 4-3-3 defende em 4-1-4-1: só o
 * centroavante); meio = o resto. Devolve {id: 'def'|'mei'|'ata'} do time t.
 */
export function linhasSemBola(L, m, t) {
  const T = m.times[t], f = L.F.FORMACOES[T.formacao], g = {};
  for (const v of f.vagas) {
    if (v.grupo === 'gol') continue;
    g[T.vagas[v.id]] = v.grupo === 'def' ? 'def' : v.sem.x >= 0 ? 'ata' : 'mei';
  }
  return g;
}

export const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
export const media = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));

/**
 * Joga e mede. opc: {antes, times, min (minutos por semente), ppda (conta PPDA), cada (amostra a cada
 * N ticks; padrão 6 = 0,1 s)}. Amostras com a bola no pé de um jogador de linha (como medidas-antes).
 * Devolve as séries por time defensor e as contagens.
 */
export function medirJogos(L, sementes, opc = {}) {
  const R = {
    sem: { 1: [], 2: [], 3: [] }, com: { 1: [], 2: [], 3: [] }, atras: [], atrasT: { 1: [], 2: [], 3: [] }, p1ramo: {}, marca: 0, defN: 0, areaCom: [], areaSem: [],
    m1: [], m2: [], m1t: { 1: [], 2: [], 3: [] }, a10: [], perto3: 0, porta: 0, assentada: 0, assentadaN: 0,
    recepcoes: 0, agressao: 0, perdas: 0, retomada5: 0, chega2: 0, depoisJanela: [], ppda: [], passes: 0, acoes: 0,
    chutes: 0, gols: 0, minutos: 0, ramos: {},
  };
  const cada = opc.cada ?? 6;
  for (const s of sementes) {
    const m = criarJogo(L, s, opc);
    const linhas = { 0: linhasSemBola(L, m, 0), 1: linhasSemBola(L, m, 1) };
    const pp = M.criarContadorPPDA();
    const posse = M.criarRastreioPosse();
    const N = Math.round((opc.min ?? 3) * 60 * 60);
    let donoAnt = null, desde = 0;
    const recepcoes = []; // {tick, id, time (de quem recebeu)}
    const perdas = [];    // {tick, perdeu (time), quem (id), x, z, chegou, retomou}
    let vooAnt = null;
    const ultDono = { 0: null, 1: null };
    for (let i = 0; i < N; i++) {
      const ev = passoJogo(L, m);
      pp.atualizar(m, ev);
      for (const e of ev) { if (e.tipo === 'chute') R.chutes++; if (e.tipo === 'gol') R.gols++; }
      const d = M.donoDaBola(m);
      if (d && d.posicao !== 'GOL') ultDono[d.time] = d.id;
      // recepção de passe: o dono novo é o destino do passe do próprio time que estava no ar
      if (d && vooAnt && vooAnt.para === d.id && vooAnt.time === d.time && d.posicao !== 'GOL') recepcoes.push({ tick: m.tick, id: d.id, time: d.time, ok: false });
      vooAnt = m.voo && m.posse == null ? { para: m.voo.para, time: m.voo.time } : d ? null : vooAnt;
      // perda (troca de posse entre os times, bola rolando, longe de bola parada)
      const tr = posse.atualizar(m);
      if (tr && !(m.parada && !m.parada.rolou) && !ev.some(e => e.tipo === 'saida')) {
        perdas.push({ tick: m.tick, perdeu: tr.de, x: tr.x, z: tr.z, quem: ultDono[tr.de], chegou: false, retomou: false, fim: false });
      }
      // acompanha as perdas abertas (5 s)
      for (const p of perdas) {
        if (p.fim) continue;
        const dt = (m.tick - p.tick) / 60;
        if (dt > 5) { p.fim = true; continue; }
        const tb = M.timeComBola(m);
        if (d && tb === p.perdeu && dt > 0) { p.retomou = true; p.fim = true; continue; }
        if (dt <= 3 && !p.chegou) {
          for (const o of m.jogadores) if (o.time === p.perdeu && o.posicao !== 'GOL' && o.id !== p.quem && Math.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z) <= 2) { p.chegou = true; break; }
        }
      }
      // agressão: recepções com defensor a ≤ 4,6 m em ≤ 2 s
      for (const r of recepcoes) {
        if (r.fim) continue;
        if ((m.tick - r.tick) / 60 > 2) { r.fim = true; continue; }
        const q = m.jogadores.find(o => o.id === r.id);
        if (!q) { r.fim = true; continue; }
        for (const o of m.jogadores) if (o.time !== r.time && o.posicao !== 'GOL' && Math.hypot(o.x - q.x, o.z - q.z) <= 4.6) { r.ok = true; r.fim = true; break; }
      }
      if (i % cada) continue;
      if (!d || d.posicao === 'GOL' || m.naMao != null) { donoAnt = null; continue; }
      const tc = d.time, td = 1 - tc;
      const fc = M.forma(m, tc), fd = M.forma(m, td, { grupos: linhas[td] });
      const tB = M.tercoDaBola(m, td), tBc = M.tercoDaBola(m, tc);
      R.sem[tB].push(fd); R.com[tBc].push(fc);
      R.atras.push(fd.atrasDaBola); R.atrasT[tB].push(fd.atrasDaBola);
      R.areaCom.push(fc.area); R.areaSem.push(fd.area);
      // marcação individual (ramo 'marca') de quem defende, com a bola fora da área de quem defende
      const ub = M.uDe(m, td, m.bola.p.x);
      const naArea = ub < -M.MEIO_X + 16.5 && Math.abs(m.bola.p.z) < 20.16;
      for (const o of M.deLinha(m, td)) {
        const ramo = o.ia?.ramo ?? '?';
        R.ramos[ramo] = (R.ramos[ramo] ?? 0) + 1;
        if (naArea) continue;
        R.defN++; if (ramo === 'marca') R.marca++;
      }
      const dist = M.distanciasAoPortador(m);
      if (dist) {
        const p = M.portador(m);
        let q1 = null, dq = Infinity;
        for (const o of M.deLinha(m, td)) { const dd = Math.hypot(o.x - p.x, o.z - p.z); if (dd < dq) { dq = dd; q1 = o; } }
        const r1 = q1?.ia?.ramo ?? '?';
        (R.p1ramo[r1] ??= []).push(dq);
        R.m1.push(dist[0]); R.m2.push(dist[1]); R.m1t[tB].push(dist[0]);
        R.a10.push(dist.filter(v => v <= 10).length);
        R.porta++; if (dist[0] <= 3) R.perto3++;
        if (d.id === donoAnt && m.tick - desde > 90) { R.assentadaN++; if (dist[0] <= 3) R.assentada++; }
      }
      if (d.id !== donoAnt) { donoAnt = d.id; desde = m.tick; }
    }
    R.minutos += opc.min ?? 3;
    R.recepcoes += recepcoes.length; R.agressao += recepcoes.filter(r => r.ok).length;
    R.perdas += perdas.length; R.retomada5 += perdas.filter(p => p.retomou).length; R.chega2 += perdas.filter(p => p.chegou).length;
    R.passes += pp.passes[0] + pp.passes[1]; R.acoes += pp.acoes[0] + pp.acoes[1];
    R.ppda.push(pp.ppda(0), pp.ppda(1));
  }
  R.ppdaTotal = R.passes / Math.max(1, R.acoes);
  return R;
}
