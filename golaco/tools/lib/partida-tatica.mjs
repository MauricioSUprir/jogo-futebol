// Partida IA × IA para os testes da IA tática (Etapa 3, Parte 2: teste-forma, teste-taticas,
// teste-pressao). Carrega a lógica de uma pasta (--js), cria a partida com ou sem a IA tática
// (--antes = criarPartida({iaClassica: true}), a IA de hoje no 11×11) e mede, com as definições de
// tools/lib/partida-medidas.mjs (Metrica/FIFA/Wyscout/StatsBomb), a forma e a pressão.
//
// IA × IA "pura": ninguém é do humano (m.humanos = []), então os 22 são guiados pela IA com as
// mesmas regras (o controlado da demo não dá bote nem gira como a IA — mediria dois times diferentes).
//
// ATAQUE SUBSTITUTO (só dos testes, enquanto a IA com a bola da Parte 3 não existe): o condutor
// clássico do treino conduz em disparada para o gol e só passa apertado — no 11×11 contra um bloco
// ele perde a bola ~25×/min e as medidas de pressão viram medidas desse ataque. Sem a Parte 3, quem
// está com a bola no pé é conduzido por uma regra simples de construção (trota, segura 2,5–5 s — ~11 passes por minuto, como no jogo real — e passa
// para o companheiro com a linha mais livre e mais à frente; chuta perto do gol), pelos mesmos botões
// do humano: o time com a bola vira "humano" só naquele tick (m.humanos = [time], controlado = o
// condutor); sem dono, ninguém é humano. A defesa medida é sempre a IA do jogo. Com a Parte 3
// presente, os testes usam o jogo de verdade (ataque: 'jogo').
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
  const [P, S, C, F, Bo, A, Ac] = await Promise.all([imp('partida.js'), imp('sim.js'), imp('config.js'), imp('formacoes.js'), imp('bola.js'), imp('ia-ataque.js'), imp('acoes.js')]);
  let T = null;
  try { T = await imp('tatica.js'); } catch { T = null; }
  return { P, S, C, T, F, Bo, A, Ac, js };
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
 * 60 = sem intervalo no trecho medido), ataque: 'jogo' | 'substituto'}.
 */
export function criarJogo(L, semente, opc = {}) {
  const m = L.P.criarPartida({ semente, iaClassica: !!opc.antes, minutosPorTempo: opc.minutos ?? 60, times: opc.times });
  m.humanos = [];
  if (opc.ataque === 'substituto') m._sub = { s: (semente * 2654435761) >>> 0 || 1, id: -1, desde: 0, espera: 0, carga: null };
  return m;
}

/** Um passo da partida IA × IA (com o ataque substituto, se a partida foi criada com ele). */
export function passoJogo(L, m) {
  if (!m._sub) return L.P.passoPartida(m, NADA);
  const e = entradaSubstituta(L, m);
  const est = m.partida.estado;
  // sem condutor (bola livre, no ar, nas mãos, bola parada, intervalo): o passo da partida
  if (e.time == null || est === 'intervalo' || est === 'fim') return L.P.passoPartida(m, NADA);
  // com condutor: o mesmo passo da partida (passoPartida só leva a entrada do time 0)
  L.S.passo(m, { [e.time]: e });
  L.P.regrasPartida(m);
  return m.eventos;
}

// gerador local (não mexe no m.rng: o mundo sorteia o mesmo que no jogo)
function sorteio(st) { st.s ^= st.s << 13; st.s >>>= 0; st.s ^= st.s >>> 17; st.s ^= st.s << 5; st.s >>>= 0; return st.s / 4294967296; }

/** Entrada do condutor pelo ataque substituto (e acerta m.humanos/m.controlado para este tick). */
function entradaSubstituta(L, m) {
  const st = m._sub, B = L.C.BOTAO;
  const d = m.naMao == null && m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
  if (!d || (m.parada && !m.parada.rolou)) { m.humanos = []; st.id = -1; st.carga = null; return NADA; }
  const t = d.time, lado = m.ataca[t];
  m.humanos = [t]; m.controlado[t] = d.id;
  if (st.id !== d.id) { st.id = d.id; st.desde = m.tick; st.espera = Math.round((2.5 + 2.5 * sorteio(st)) * 60); st.carga = null; st.fuga = null; }
  // carregando um passe/chute: segura o botão com o analógico no alvo e solta
  if (st.carga) {
    const c = st.carga;
    if (m.tick < c.ate) return { x: c.x * 0.6, z: c.z * 0.6, botoes: c.bot, time: t };
    st.carga = null; st.desde = m.tick; st.espera = Math.round((2.5 + 2.5 * sorteio(st)) * 60);
    return { x: c.x * 0.6, z: c.z * 0.6, botoes: 0, time: t };
  }
  const gx = lado * 52.5, dGol = Math.hypot(gx - d.x, d.z);
  // chute perto do gol
  if (dGol < 22 && Math.abs(d.z) < 16 && d.posicao !== 'GOL') {
    const dx = gx - d.x, dz = -d.z * 0.8, l = Math.hypot(dx, dz) || 1;
    st.carga = { bot: B.CHUTE, x: dx / l, z: dz / l, ate: m.tick + 24 };
    return { x: dx / l, z: dz / l, botoes: B.CHUTE, time: t };
  }
  // marcador mais perto
  let pm = null, dm = Infinity;
  for (const o of m.jogadores) if (o.time !== t && o.posicao !== 'GOL') { const dd = Math.hypot(o.x - d.x, o.z - d.z); if (dd < dm) { dm = dd; pm = o; } }
  const apertado = dm < 2 && m.tick - st.desde > 15;
  if (m.tick - st.desde >= st.espera || apertado || d.posicao === 'GOL') {
    // passe: a linha mais livre (risco do acoes.js) e mais à frente, 6–35 m
    let mel = null, nm = -Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o === d || o.posicao === 'GOL') continue;
      const dx = o.x - d.x, dz = o.z - d.z, l = Math.hypot(dx, dz);
      if (l < 6 || l > 35) continue;
      const risco = L.Ac.riscoLinha(m, d, d.x, d.z, o.x, o.z, 12);
      const nota = (1 - risco) * (1 + 0.5 * Math.max(-0.5, Math.min(1, dx * lado / 25))) - 0.1 * Math.abs(l - 15) / 15;
      if (risco < 0.6 && nota > nm) { nm = nota; mel = o; }
    }
    if (mel) {
      const dx = mel.x - d.x, dz = mel.z - d.z, l = Math.hypot(dx, dz);
      st.carga = { bot: B.PASSE, x: dx / l, z: dz / l, ate: m.tick + Math.round(Math.min(0.5, 0.12 + l / 80) * 60) };
      return { x: dx / l * 0.6, z: dz / l * 0.6, botoes: B.PASSE, time: t };
    }
    st.espera += 30;
  }
  // conduz trotando para a frente; com marcador perto na frente, sai na diagonal (60° do ataque) para o
  // lado de lá dele e segura essa direção por 1 s (decidir a cada tick fazia a bola ziguezaguear)
  let dx = lado, dz = 0;
  if (st.fuga && m.tick < st.fuga.ate) { dx = st.fuga.x; dz = st.fuga.z; }
  else if (pm && dm < 3 && (pm.x - d.x) * lado > 0) {
    const s = pm.z > d.z ? -1 : 1;
    st.fuga = { x: lado * 0.5, z: s * 0.866, ate: m.tick + 60 };
    dx = st.fuga.x; dz = st.fuga.z;
  }
  return { x: dx * 0.55, z: dz * 0.55, botoes: 0, time: t };
}


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
    chutes: 0, gols: 0, minutos: 0, ramos: {}, porBola: [],
  };
  const cada = opc.cada ?? 6;
  R.ataque = opc.ataque ?? 'jogo';
  for (const s of sementes) {
    const m = criarJogo(L, s, opc);
    const linhas = { 0: linhasSemBola(L, m, 0), 1: linhasSemBola(L, m, 1) };
    const pp = M.criarContadorPPDA();
    const posse = M.criarRastreioPosse();
    const N = Math.round((opc.min ?? 3) * 60 * 60);
    let donoAnt = null, desde = 0;
    const recepcoes = []; // {tick, id, time (de quem recebeu)}
    const perdas = [];    // {tick, perdeu (time), quem (id), x, z, chegou, retomou}
    const depois = [];    // {tick (janela + 2 s), perdeu, desde}
    let ultTroca = -1;
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
        // 2 s depois da janela de contrapressão do time que perdeu: quantos ainda apertam?
        const pr = m.times?.[tr.de]?.tatica?.pressao ?? 1;
        depois.push({ tick: m.tick + Math.round(((L.C.IA_DEFESA?.contrapressao?.s?.[pr] ?? 3) + 2) * 60), perdeu: tr.de, desde: m.tick });
      }
      if (tr) ultTroca = m.tick;
      for (const q of depois) {
        if (q.fim || m.tick < q.tick) continue;
        q.fim = true;
        if (ultTroca > q.desde) continue; // a posse trocou de novo no meio (outra perda, outra janela)
        let contra = 0, apertam = 0;
        for (const o of M.deLinha(m, q.perdeu)) {
          const r = o.ia?.ramo;
          if (r === 'contra') contra++;
          if (r === 'contra' || r === 'aperta' || r === 'ataca' || r === 'contem') apertam++;
        }
        R.depoisJanela.push({ contra, apertam });
      }
      // acompanha as perdas abertas (5 s)
      for (const p of perdas) {
        if (p.fim) continue;
        const dt = (m.tick - p.tick) / 60;
        if (dt > 5) { p.fim = true; continue; }
        if (dt <= 3 && !p.chegou) {
          for (const o of m.jogadores) if (o.time === p.perdeu && o.posicao !== 'GOL' && o.id !== p.quem && Math.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z) <= 2) { p.chegou = true; break; }
        }
        const tb = M.timeComBola(m);
        if (d && tb === p.perdeu && dt > 0) { p.retomou = true; if (dt > 3 || p.chegou) p.fim = true; }
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
      R.porBola.push([M.uDe(m, td, m.bola.p.x), fd.alturaLinha, fd.larg, fd.comp]);
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
