// teste-transicao (pedido do dono, 10/10: "o jogo tem que ser MAIS INTENSO, a IA não corre para trás"):
// a TRANSIÇÃO DEFENSIVA da partida 11×11 — depois de cada perda da bola em jogo corrido, o time que
// perdeu volta correndo para trás da linha da bola (recomposição) e os mais perto apertam (contrapressão).
// Partidas inteiras (2 tempos de 4 min reais), 24 sementes, IA × IA (os 22 da IA: m.humanos = []).
// Definições (PESQUISA-ETAPA3.md, seção "Intensidade e recomposição"):
//  - perda = a bola passa a ser do outro time (no pé, nas mãos ou num passe/chute dele no ar) com a bola
//    rolando, fora de bola parada (lib/partida-medidas.mjs criarRastreioPosse, a mesma do teste-pressao);
//  - "atrás da bola" = jogador de linha do time que perdeu entre a bola e o próprio gol (u < u da bola, no
//    referencial dele; a mesma conta do teste-forma);
//  - tempo até 8 dos 10 de linha atrás da bola: só as perdas com menos de 8 atrás na hora; conta até 12 s
//    (janela da "rest defense", Forcher 2023) enquanto o outro time segue com a bola e ela rola; quem não
//    chega em 12 s entra como 12 s; a perda interrompida antes (retomada, bola fora, falta de amostra) sai;
//  - velocidade de recuo de quem ficou à frente do lance: jogadores do time que perdeu a mais de 10 m à
//    frente da linha da bola na hora da perda (sem os da frente que ficam para o contra-ataque — vagas com
//    x ≥ 0 na tabela sem a bola, medidos à parte — e sem o controlado do humano), o quanto andaram para o
//    próprio gol em 3 s ÷ 3 s (perdas em que o outro time segue com a bola os 3 s); o MEIO = esses sem a
//    linha de defesa;
//  - superioridade no contra-ataque: perdas em que o time que recuperou chega ao terço final com a bola no
//    pé em até 12 s e, nessa hora, tem tantos ou mais jogadores de linha no terço final que o time que
//    perdeu tem entre a bola e o próprio gol (% das perdas em jogo corrido).
// Metas (Bauer & Anzer 2021: ≥ 4 atrás da bola e contrapressão de 5 s; FIFA EFI: bloco = 8 atrás; Barnes 2014
// e Ju 2023: a recomposição é corrida de alta intensidade, ≥ 5,5 m/s; Forcher 2023: a "rest defense" decide nos
// 12 s depois da perda):
//  - tempo até 8 atrás da bola: mediana ≤ 6 s;
//  - velocidade de recuo de quem ficou à frente: mediana ≥ 4,6 m/s. O teto físico é a arrancada: parado, o
//    corpo do GOLAÇO anda 18,6 m em 3 s (6,2 m/s; jogador.js passoCorpo, atributos padrão) e, indo para a frente
//    a 6 m/s, só 10,4 m (3,5 m/s: freia e vira); a publicada fica em ~3,8–4,2 m/s (trota de volta);
// Informativos: contra-ataque que chega ao terço final com superioridade (% das perdas; deve cair — a publicada fica em
// ~8%, com a recomposição ~4–8% conforme as sementes: oscila demais entre rodadas para ser meta), o pico da velocidade
// para o próprio gol e a contrapressão (a meta dela é do teste-pressao).
// Com --humano, o time 0 é de um humano ROTEIRIZADO (o controlado joga por um roteiro simples e determinístico);
// as metas valem para o time da IA (1) — a IA contra o humano tem de ser tão intensa quanto IA × IA — e o time
// do humano (os companheiros da IA) é informado. O roteiro padrão é AGRESSIVO (contraprova I3: o de antes chutava
// 0,5–0,8 vez por partida e quase não contra-atacava): conduz em disparada para o gol, passa a cada 0,5–1,5 s
// para a frente (metade das bolas longas pela ENFIADA), chuta de até 28 m, aperta o condutor e dá DIVIDIDA,
// troca de jogador. --roteiro conduz: só conduz em disparada e chuta de 20 m (o contra-ataque individual).
// Contra o humano há também a meta do MEIO (sem a linha de defesa e a frente): mediana ≥ 5,5 m/s em 3 s — é o
// lance de que o dono reclama (o humano rouba e sai; a publicada volta a ~4,8 m/s, trotando). A frente é
// informada à parte (fica para o contra-ataque e volta sem o sprint).
// Nos dois modos: nenhuma recomposição bloqueada nos 0,5 s depois da perda (contraprova I1: o estado velho de uma
// recomposição de outra posse armava a pausa de TATICA.recomp.pausa s justo na transição).
// Informativo (as duas versões): sprints (≥ 7 m/s por ≥ 1 s) por jogador por minuto, distância em alta intensidade
// (≥ 5,5 m/s) por jogador por minuto, chutes e chutes no alvo por partida, posses que chegam ao terço final,
// tempo da recuperação ao chute.
//   node tools/teste-transicao.mjs                 (lógica do repositório, IA × IA)
//   node tools/teste-transicao.mjs --humano        (time 0 do humano roteirizado, agressivo; --roteiro conduz)
//   node tools/teste-transicao.mjs --antes         (a mesma partida com a IA clássica: criarPartida({iaClassica: true}))
//   node tools/teste-transicao.mjs --js <pasta>    (outra cópia da lógica, ex.: a publicada)
//   SEMENTES=24 · --sem0 K (primeira semente) · --par N (processos; padrão 2) · --min M (minutos por tempo)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const ANTES = args.includes('--antes');
const HUMANO = args.includes('--humano') || args.includes('--roteiro');
const ROTEIRO = arg('--roteiro', 'agressivo'); // 'agressivo' (padrão) | 'conduz'
const MIN_TEMPO = +arg('--min', 4);
const JANELA = 12, RECUO = 3, FRENTE = 10;

// ------------------------------------------------------------------ humano roteirizado (time 0)
// gerador local (não mexe no m.rng: o mundo sorteia o mesmo que sortearia com o humano de verdade)
function sorteio(st) { st.s ^= st.s << 13; st.s >>>= 0; st.s ^= st.s >>> 17; st.s ^= st.s << 5; st.s >>>= 0; return st.s / 4294967296; }

/** Entrada do humano roteirizado: {x, z, botoes} no mundo para o controlado do time 0. */
function entradaRoteiro(m, M, B, st) {
  const j = m.jogadores.find(o => o.id === m.controlado[0]);
  if (!j || m.partida.estado !== 'jogo') return { x: 0, z: 0, botoes: 0 };
  const lado = m.ataca[0], gx = lado * 52.5, b = m.bola.p;
  // botão carregando: segura até soltar (o analógico fica no alvo)
  if (st.carga) {
    const c = st.carga;
    if (m.tick < c.ate && m.posse === j.id) return { x: c.x, z: c.z, botoes: c.bot };
    st.carga = null;
    return { x: c.x, z: c.z, botoes: 0 };
  }
  const pr = m.parada;
  if (pr && !pr.rolou) {
    // bola parada do humano: espera e passa curto para o mais perto (o cobrador é o controlado)
    if (pr.cobrador === j.id && m.tick - pr.desde > 50) {
      const o = maisPerto(m, j, q => q.time === 0 && q !== j && q.posicao !== 'GOL');
      if (o) { const d = dir(j, o.x, o.z); st.carga = { bot: B.PASSE, x: d.x, z: d.z, ate: m.tick + 15 }; return { x: d.x, z: d.z, botoes: B.PASSE }; }
    }
    return { x: 0, z: 0, botoes: 0 };
  }
  const CONDUZ = ROTEIRO === 'conduz';
  if (m.posse === j.id) {
    if (st.id !== j.id) { st.id = j.id; st.desde = m.tick; st.espera = Math.round((0.5 + sorteio(st)) * 60); }
    const dGol = Math.hypot(gx - j.x, j.z);
    if (dGol < (CONDUZ ? 20 : 28) && Math.abs(j.z) < 18) {
      const d = dir(j, gx, -j.z * 0.3);
      st.carga = { bot: B.CHUTE, x: d.x, z: d.z, ate: m.tick + 30 };
      return { x: d.x, z: d.z, botoes: B.CHUTE };
    }
    // 'conduz': só conduz para o gol em disparada (o contra-ataque individual) e chuta perto
    if (CONDUZ) { const d = dir(j, gx, j.z * 0.5); return { x: d.x, z: d.z, botoes: B.CORRER }; }
    if (m.tick - st.desde >= st.espera) {
      // passe para o companheiro mais à frente com a linha mais livre (a mira do acoes.js acha quem está no cone);
      // para a frente e longe (> 12 m à frente), metade das vezes pela ENFIADA: o contra-ataque rápido
      let mel = null, nm = -Infinity;
      for (const o of m.jogadores) {
        if (o.time !== 0 || o === j || o.posicao === 'GOL') continue;
        const l = Math.hypot(o.x - j.x, o.z - j.z);
        if (l < 6 || l > 32) continue;
        let marc = Infinity;
        for (const q of m.jogadores) if (q.time === 1) marc = Math.min(marc, Math.hypot(q.x - o.x, q.z - o.z));
        const n = (o.x - j.x) * lado / 10 + Math.min(marc, 6) / 6 - l / 60;
        if (n > nm) { nm = n; mel = o; }
      }
      if (mel) {
        const d = dir(j, mel.x, mel.z);
        const bot = (mel.x - j.x) * lado > 12 && sorteio(st) < 0.5 ? B.ENFIADA : B.PASSE;
        st.carga = { bot, x: d.x, z: d.z, ate: m.tick + 18 }; st.desde = m.tick; return { x: d.x, z: d.z, botoes: bot };
      }
      st.espera += 30;
    }
    // conduz para o gol, em disparada
    const d = dir(j, gx, j.z * 0.6);
    return { x: d.x * 0.95, z: d.z * 0.95, botoes: B.CORRER };
  }
  st.id = -1;
  const tb = M.timeComBola(m);
  if (tb === 1 && m.naMao == null) {
    // defendendo: TROCAR para o mais perto da bola quando o controlado está longe (borda a cada 1 s)
    const dB = Math.hypot(b.x - j.x, b.z - j.z);
    if (dB > 14 && m.tick - (st.troca ?? -999) > 60) { st.troca = m.tick; return { x: 0, z: 0, botoes: B.TROCAR }; }
    // corre no condutor (entre ele e o gol) e dá DIVIDIDA de perto, de vez em quando
    const gy = -lado * 52.5;
    const tx = b.x + (gy - b.x) * 0.04, tz = b.z * 0.96;
    const d = dir(j, tx, tz);
    let bot = dB > 3 ? B.CORRER : 0;
    if (dB < 1.6 && sorteio(st) < 0.08) bot |= B.DIVIDIDA;
    return { x: d.x, z: d.z, botoes: bot };
  }
  // o próprio time com a bola (ou bola livre): vai um pouco para a frente, trotando
  const d = dir(j, j.x + lado * 6, j.z * 0.9);
  return { x: d.x * 0.5, z: d.z * 0.5, botoes: 0 };
}
function dir(j, x, z) { const dx = x - j.x, dz = z - j.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; }
function maisPerto(m, j, f) { let mel = null, dm = Infinity; for (const o of m.jogadores) if (f(o)) { const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < dm) { dm = d; mel = o; } } return mel; }

// ------------------------------------------------------------------ uma partida (processo filho)
async function coletar(sem) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const S = await import(pathToFileURL(path.join(JS, 'sim.js')).href);
  const C = await import(pathToFileURL(path.join(JS, 'config.js')).href);
  const F = await import(pathToFileURL(path.join(JS, 'formacoes.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  // por time que PERDEU a bola: t8 (s), recuo (m/s), superioridade, contrapressão
  const novo = () => ({ t8: [], recuo: [], recuoMeio: [], recuoFrente: [], pico: [], vel: [], perdas: 0, sup: 0, chegaTerco: 0, chega2: 0, chega2N: 0, bloq: 0, bloqN: 0 });
  const R = {
    t: { 0: novo(), 1: novo() }, chutes: 0, noAlvo: 0, gols: 0, chutesT: [0, 0], golsT: [0, 0], sprints: 0, hiM: 0, tJog: 0, posses: 0, possesTerco: 0,
    recChute: [], rolando: 0,
  };
  const m = P.criarPartida({ semente: sem, iaClassica: ANTES, minutosPorTempo: MIN_TEMPO });
  if (!HUMANO) m.humanos = [];
  const st = { s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 };
  const posse = M.criarRastreioPosse();
  const N = Math.round(2 * MIN_TEMPO * 3600 + 1200);
  const frente = {}; // id → é da frente sem a bola (fica para o contra-ataque)
  const meio = {};   // id → é do meio (nem da linha de defesa nem da frente)
  const marcarFrente = () => {
    for (const t of [0, 1]) {
      const T = m.times[t], f = F.FORMACOES[T.formacao];
      for (const v of f.vagas) { frente[T.vagas[v.id]] = v.sem.x >= 0; meio[T.vagas[v.id]] = v.sem.x < 0 && v.grupo !== 'def' && v.grupo !== 'gol'; }
    }
  };
  const bloqAnt = new Map(); // id → j.iaT.recompBloq do tick anterior (bloqueio da recomposição armado)
  marcarFrente();
  const abertas = [];   // transições em andamento
  const sprint = new Map(); // id → ticks seguidos ≥ 7 m/s
  let chuteAberto = null; // {tick}
  let possesAbertas = null; // {time, terco}
  let recup = null; // {time, tick}
  const ctrl = () => (HUMANO ? m.controlado[0] : -1);
  // fecha as transições acabadas: t8 (só as com < 8 atrás na hora; 12 s = não chegou), contra-ataque
  const fechar = () => {
    for (let k = abertas.length - 1; k >= 0; k--) {
      const a = abertas[k];
      if (!a.fim) continue;
      const A = R.t[a.p];
      if (a.n0 < 8) {
        if (a.t8 >= 0) A.t8.push(a.t8);
        else if (a.t8 === -1) A.t8.push(JANELA);
      }
      if (a.chegou) A.chegaTerco++;
      if (a.sup) A.sup++;
      if (!a.cpCorte) { A.chega2N++; if (a.chega2) A.chega2++; }
      abertas.splice(k, 1);
    }
  };
  for (let i = 0; i < N; i++) {
    const ent = HUMANO ? entradaRoteiro(m, M, C.BOTAO, st) : { x: 0, z: 0, botoes: 0 };
    const ev = P.passoPartida(m, ent);
    if (m.partida.estado === 'fim') break;
    if (ev.some(e => e.tipo === 'substituicao' || e.tipo === 'intervalo')) marcarFrente();
    for (const e of ev) {
      if (e.tipo === 'gol') {
        R.gols++; if (chuteAberto) { R.noAlvo++; chuteAberto = null; }
        const tg = e.time ?? m.jogadores.find(o => o.id === e.id)?.time;
        if (tg === 0 || tg === 1) R.golsT[tg]++;
      }
      else if (e.tipo === 'defesa' && (e.modo === 'encaixe' || e.modo === 'espalmada') && chuteAberto) { R.noAlvo++; chuteAberto = null; }
      if (M.ehChute(m, e)) {
        R.chutes++; chuteAberto = { tick: m.tick };
        const j = m.jogadores.find(o => o.id === e.id);
        if (j) R.chutesT[j.time]++;
        if (j && recup && recup.time === j.time) { R.recChute.push((m.tick - recup.tick) / 60); recup = null; }
      }
    }
    if (chuteAberto && m.tick - chuteAberto.tick > 240) chuteAberto = null;
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    const tr = posse.atualizar(m);
    const tc = M.timeComBola(m);
    if (!rolando) {
      // (a bola saiu antes de 3 s: a contrapressão dessa perda não tem amostra)
      for (const a of abertas) { if (a.t8 === -1) a.t8 = -2; if ((m.tick - a.tick) / 60 < 3 && !a.chega2) a.cpCorte = true; a.fim = true; }
      fechar();
      sprint.clear(); possesAbertas = null; recup = null;
      continue;
    }
    R.rolando++;
    // intensidade (todos os de linha): sprints ≥ 7 m/s por ≥ 1 s e distância ≥ 5,5 m/s
    for (const j of m.jogadores) {
      if (j.posicao === 'GOL' || j.papel === 'parado') continue;
      const v = Math.hypot(j.vx, j.vz);
      R.tJog++;
      if (v >= 5.5) R.hiM += v / 60;
      const n = sprint.get(j.id) ?? 0;
      if (v >= 7) { sprint.set(j.id, n + 1); if (n + 1 === 60) R.sprints++; } else if (n) sprint.set(j.id, 0);
    }
    // posses que chegam ao terço final (a posse começa na troca de time com a bola)
    if (tc != null && (!possesAbertas || possesAbertas.time !== tc)) { possesAbertas = { time: tc, terco: false }; R.posses++; }
    if (possesAbertas && !possesAbertas.terco && M.donoDaBola(m)?.time === possesAbertas.time && M.uDe(m, possesAbertas.time, m.bola.p.x) >= 17.5) { possesAbertas.terco = true; R.possesTerco++; }
    // perda em jogo corrido: abre a transição do time que perdeu
    if (tr && !ev.some(e => e.tipo === 'saida')) {
      const p = tr.de, A = R.t[p];
      A.perdas++;
      recup = { time: tr.para, tick: m.tick };
      const ub = M.uDe(m, p, m.bola.p.x);
      let atras = 0;
      const fr = [];
      for (const o of M.deLinha(m, p)) {
        const u = M.uDe(m, p, o.x);
        if (u < ub) atras++;
        if (u - ub > FRENTE && o.id !== ctrl()) fr.push({ id: o.id, u0: u, pico: 0, frente: !!frente[o.id], meio: !!meio[o.id] });
      }
      const quem = M.donoDaBola(m);
      abertas.push({ p, a: tr.para, tick: m.tick, n0: atras, t8: atras >= 8 ? 0 : -1, fr, recuoFeito: false, sup: false, chegou: false, chega2: false, quemPerdeu: R.ultDono?.[p] ?? -1, bloqFeito: false });
    }
    if (M.donoDaBola(m) && M.donoDaBola(m).posicao !== 'GOL') (R.ultDono ??= {})[M.donoDaBola(m).time] = M.donoDaBola(m).id;
    // acompanha as transições abertas
    for (const a of abertas) {
      if (a.fim) continue;
      const dt = (m.tick - a.tick) / 60;
      const A = R.t[a.p];
      if (dt <= 3 && !a.chega2) {
        for (const o of M.deLinha(m, a.p)) if (o.id !== a.quemPerdeu && Math.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z) <= 2) { a.chega2 = true; break; }
      }
      // retomou: acaba (o que já foi medido fica)
      if (tc === a.p) {
        if (a.t8 < 0) a.t8 = -2; // interrompida antes de chegar: sai da conta
        a.fim = true;
      }
      if (a.fim) continue;
      const ub = M.uDe(m, a.p, m.bola.p.x);
      if (a.t8 < 0) {
        let atras = 0;
        for (const o of M.deLinha(m, a.p)) if (M.uDe(m, a.p, o.x) < ub) atras++;
        if (atras >= 8) a.t8 = dt;
      }
      // bloqueio da recomposição armado nos 0,5 s depois da perda (contraprova I1: o estado velho de uma
      // recomposição de outra posse bloqueava o jogador por TATICA.recomp.pausa s justo na transição)
      if (dt <= 0.5) {
        for (const o of M.deLinha(m, a.p)) {
          const b = o.iaT?.recompBloq;
          if (b != null && b !== (bloqAnt.get(o.id) ?? -1) && b > m.tick) A.bloq++;
        }
      } else if (!a.bloqFeito) { a.bloqFeito = true; A.bloqN++; }
      if (!a.recuoFeito) {
        // pico da velocidade para o próprio gol (−u̇ no referencial de quem perdeu)
        for (const f of a.fr) {
          const o = m.jogadores.find(q => q.id === f.id);
          if (o) f.pico = Math.max(f.pico, -o.vx * m.ataca[a.p]);
        }
      }
      if (!a.recuoFeito && dt >= RECUO) {
        a.recuoFeito = true;
        for (const f of a.fr) {
          const o = m.jogadores.find(q => q.id === f.id);
          if (!o) continue;
          const r = (f.u0 - M.uDe(m, a.p, o.x)) / RECUO;
          if (f.frente) { A.recuoFrente.push(r); continue; }
          A.recuo.push(r); A.pico.push(f.pico);
          if (f.meio) A.recuoMeio.push(r);
        }
      }
      // contra-ataque chega ao terço final com a bola no pé
      const d = M.donoDaBola(m);
      if (!a.chegou && d && d.time === a.a && d.posicao !== 'GOL' && M.uDe(m, a.a, m.bola.p.x) >= 17.5) {
        a.chegou = true;
        const uba = M.uDe(m, a.a, m.bola.p.x);
        let atq = 0, def = 0;
        for (const o of M.deLinha(m, a.a)) if (M.uDe(m, a.a, o.x) >= 17.5) atq++;
        for (const o of M.deLinha(m, a.p)) if (M.uDe(m, a.a, o.x) > uba) def++;
        a.sup = atq >= def;
      }
      if (dt >= JANELA) a.fim = true;
    }
    fechar();
    for (const o of m.jogadores) bloqAnt.set(o.id, o.iaT?.recompBloq ?? -1);
  }
  delete R.ultDono;
  return R;
}

if (args.includes('--filho')) {
  process.send(await coletar(+arg('--s', 1)));
  process.exit(0);
}

// ------------------------------------------------------------------ processo principal
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, info = false) => { linhas.push([nome, medido, meta, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-transicao: REPROVOU (${falhas})` : '\nteste-transicao: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'partida.js'))) {
  reg('a partida 11×11 existe (criarPartida)', 'partida.js não existe nesta lógica', 'criarPartida', false);
  fim();
}
const NS = +(process.env.SEMENTES ?? 24), S0 = +arg('--sem0', 1);
const SEMENTES = Array.from({ length: NS }, (_, k) => S0 + k);
const t0 = Date.now();
const res = [];
let prox = 0;
const nPar = Math.max(1, Math.min(SEMENTES.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 2)));
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--s', String(s)]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] : NaN; };
const pct = (a, b) => (b ? 100 * a / b : NaN);
const junta = (times, k) => res.flatMap(r => times.flatMap(t => r.t[t][k]));
const soma = (times, k) => res.reduce((s, r) => s + times.reduce((q, t) => q + r.t[t][k], 0), 0);
const somaR = k => res.reduce((s, r) => s + r[k], 0);
console.log(`lógica: ${JS}${ANTES ? ' (--antes: IA clássica na partida)' : ''}${HUMANO ? ` · time 0 do humano roteirizado (${ROTEIRO})` : ' · IA × IA'}`);
console.log(`${NS} partidas (sementes ${S0}–${S0 + NS - 1}) de 2 × ${MIN_TEMPO} min, ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// metas: IA × IA = os dois times; com o humano, o time da IA (1)
const META = HUMANO ? [1] : [0, 1];
function bloco(times, info, rot) {
  const t8 = junta(times, 't8'), rc = junta(times, 'recuo'), pd = soma(times, 'perdas');
  const sup = soma(times, 'sup'), ch = soma(times, 'chegaTerco');
  const c2 = pct(soma(times, 'chega2'), soma(times, 'chega2N'));
  reg(`${rot}tempo até 8 dos 10 de linha atrás da bola (mediana · p75)`, `${fmt(quant(t8, 0.5))} s · ${fmt(quant(t8, 0.75))} s (${t8.length} perdas com < 8 atrás)`, 'mediana ≤ 6 s', quant(t8, 0.5) <= 6, info);
  reg(`${rot}velocidade de recuo de quem ficou > 10 m à frente da bola, 3 s (mediana · p25)`, `${fmt(quant(rc, 0.5))} · ${fmt(quant(rc, 0.25))} m/s (${rc.length} jogadores)`, 'mediana ≥ 4,6 m/s', quant(rc, 0.5) >= 4.6, info);
  // o MEIO contra o humano (contraprova I3): o lance de que o dono reclama — o humano rouba e sai em
  // velocidade; o meio da IA que ficou à frente volta em disparada (a publicada: ~4,8 m/s, trotando)
  const rm = junta(times, 'recuoMeio'), rf = junta(times, 'recuoFrente');
  reg(`${rot}… só o MEIO (sem a linha de defesa e a frente), 3 s (mediana)`, `${fmt(quant(rm, 0.5))} m/s (${rm.length} jogadores)`, HUMANO && !info ? 'mediana ≥ 5,5 m/s' : '—', quant(rm, 0.5) >= 5.5, info || !HUMANO);
  reg(`${rot}… a FRENTE (fica para o contra-ataque e volta sem o sprint), 3 s (mediana)`, `${fmt(quant(rf, 0.5))} m/s (${rf.length} jogadores)`, '—', true, true);
  const bq = soma(times, 'bloq');
  reg(`${rot}recomposição bloqueada nos 0,5 s depois da perda (estado velho de outra posse)`, `${bq} em ${soma(times, 'bloqN')} perdas`, '0', bq === 0, info);
  const pc = junta(times, 'pico');
  reg(`${rot}pico da velocidade para o próprio gol nesses 3 s (mediana · % ≥ 5,5 m/s)`, `${fmt(quant(pc, 0.5))} m/s · ${fmt(pct(pc.filter(v => v >= 5.5).length, pc.length))}%`, '—', true, true);
  reg(`${rot}contra-ataque chega ao terço final com superioridade`, `${fmt(pct(sup, pd))}% das perdas (chega ao terço em 12 s: ${fmt(pct(ch, pd))}%; ${pd} perdas)`, '— (deve cair; publicada ~8%)', true, true);
  reg(`${rot}contrapressão: alguém ≠ quem perdeu a ≤ 2 m da bola em ≤ 3 s (a meta é do teste-pressao)`, `${fmt(c2)}%`, '—', true, true);
}
bloco(META, false, HUMANO ? 'IA (time 1): ' : '');
if (HUMANO) bloco([0], true, 'time do humano (0): ');
const tJ = somaR('tJog') / 3600; // minutos·jogador de bola rolando
reg('sprints (≥ 7 m/s por ≥ 1 s) por jogador por minuto de bola rolando', fmt(somaR('sprints') / tJ, 2), '—', true, true);
reg('distância em alta intensidade (≥ 5,5 m/s) por jogador', `${fmt(somaR('hiM') / tJ)} m/min`, '—', true, true);
reg('chutes · no alvo por partida', `${fmt(somaR('chutes') / NS)} · ${fmt(somaR('noAlvo') / NS)} (gols ${fmt(somaR('gols') / NS, 2)})${HUMANO ? ` — IA ${fmt(res.reduce((a, r) => a + r.chutesT[1], 0) / NS)} chutes, ${fmt(res.reduce((a, r) => a + r.golsT[1], 0) / NS, 2)} gols; humano ${fmt(res.reduce((a, r) => a + r.chutesT[0], 0) / NS)} chutes, ${fmt(res.reduce((a, r) => a + r.golsT[0], 0) / NS, 2)} gols` : ''}`, '—', true, true);
reg('posses que chegam ao terço final', `${fmt(pct(somaR('possesTerco'), somaR('posses')))}% de ${fmt(somaR('posses') / NS, 0)} por partida`, '—', true, true);
const rcx = res.flatMap(r => r.recChute);
reg('tempo da recuperação ao chute (mediana)', `${fmt(quant(rcx, 0.5))} s (${rcx.length} chutes da mesma posse)`, '—', true, true);
fim();
