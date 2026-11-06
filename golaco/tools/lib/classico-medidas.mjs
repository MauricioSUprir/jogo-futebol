// A medida do clássico (item 35; contrato "Clássico pegado (item 35)" no CONTRATOS.md; teste-classico.mjs): uma cópia da
// lógica com ganchos que SÓ LEEM (globalThis.__CL) e a partida medida (2 × `min` min, a demo IA × IA ou contra o humano
// ROTEIRIZADO de tools/lib/humano-roteiro.mjs). Porta do instrumentar.mjs da medida de base (f35/mapa), no molde do
// copiaInstrumentada do lib/corrida-medidas.mjs: cada âncora tem de aparecer UMA vez (senão erro com o nome do arquivo).
//
// Ganchos (nenhum escreve no mundo nem sorteia: o KI do teste confere o hash da cópia com os ganchos ligados):
//  contato  sim.js colisaoCorpos — o começo de cada contato de corpo entre adversários (antes da resposta; rv < 0 fechando)
//  oport    sim.js boteIA — a OPORTUNIDADE de bote (bola ao alcance, depois do descanso e da trava da bola colada), com o cfg
//  tenta    sim.js boteIA — a TENTATIVA (passou o sorteio do cfg.chancePorPasso): o bote que chega
//  res      sim.js boteIA — o desfecho do faltaNoBote (falta / BOTE_EVITADO / BOTE_SEM_GANHAR / null = limpo)
//  pBote    faltas.js faltaNoBote — a chance do árbitro no bote (p = min(0,95, pb·ff)) e o "cuidado" (na área / chance clara)
//  pCarga   faltas.js faltaNaCarga — a chance da carga que passou as travas
//  pTatica  faltas.js faltaTatica — a chance por passo do batido que segura (só p > 0)
//  pDiv     defesa.js — a chance de falta da DIVIDIDA do controlado que não ganhou a bola
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** As âncoras: [arquivo, alvo (aparece UMA vez), troca]. */
export const ANCORAS = [
  ['sim.js', '      const rv = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;\n',
    '      const rv = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;\n      if (p.time !== q.time) globalThis.__CL?.contato(m, p, q, rv);\n'],
  ['sim.js', '  if (!lento && !encostada && (dD < cfg.colada || dB > dD)) return;\n  if (uniforme(m.rng) >= cfg.chancePorPasso) return;\n',
    '  if (!lento && !encostada && (dD < cfg.colada || dB > dD)) return;\n  globalThis.__CL?.oport(m, j, dono, cfg, lento, encostada);\n  if (uniforme(m.rng) >= cfg.chancePorPasso) return;\n  globalThis.__CL?.tenta(m, j, dono, cfg, lento, encostada);\n'],
  ['sim.js', '    const f = faltaNoBote(m, j, dono, lento);\n',
    '    const f = faltaNoBote(m, j, dono, lento);\n    globalThis.__CL?.res(m, j, dono, f);\n'],
  ['faltas.js', '  const p = Math.min(0.95, pb * ff);\n',
    '  const p = Math.min(0.95, pb * ff);\n  globalThis.__CL?.pBote(m, d, c, p, cuidado);\n'],
  ['faltas.js', '  const p = FALTAS.carga.chance * (chanceClara(m, c, d) ? FALTAS.carga.naChanceClara : 1);\n',
    '  const p = FALTAS.carga.chance * (chanceClara(m, c, d) ? FALTAS.carga.naChanceClara : 1);\n  globalThis.__CL?.pCarga(m, d, c, p);\n'],
  ['faltas.js', "  if (!(p > 0) || uniforme(m.rng) >= p) return null;\n  return montarFalta(m, d, c, spa ? 'tatica' : 'segurar', false);\n",
    "  if (p > 0) globalThis.__CL?.pTatica(m, d, c, p, spa);\n  if (!(p > 0) || uniforme(m.rng) >= p) return null;\n  return montarFalta(m, d, c, spa ? 'tatica' : 'segurar', false);\n"],
  ['defesa.js', '    const pF = chanceFaltaDividida(m, j, d0, motivo);\n',
    '    const pF = chanceFaltaDividida(m, j, d0, motivo);\n    globalThis.__CL?.pDiv(m, j, d0, pF);\n'],
];

/** Copia a lógica da pasta `js` (para `dest` ou uma pasta temporária) com os ganchos. Devolve a pasta. */
export function copiaInstrumentadaClassico(js, dest = null) {
  const pasta = dest ?? fs.mkdtempSync(path.join(os.tmpdir(), 'golaco-classico-'));
  fs.cpSync(js, pasta, { recursive: true });
  for (const [arq, alvo, novo] of ANCORAS) {
    const f = path.join(pasta, arq), src = fs.readFileSync(f, 'utf8');
    const n = src.split(alvo).length - 1;
    if (n !== 1) throw new Error(`copiaInstrumentadaClassico: ${arq} — a âncora aparece ${n}× (esperado 1): ${alvo.trim().slice(0, 90)}`);
    fs.writeFileSync(f, src.replace(alvo, novo));
  }
  return pasta;
}

/** Troca as constantes do config.js (CONST.caminho=valorJSON) antes de carregar o resto da lógica (as tabelas são juntadas na carga). */
export function aplicarSets(C, sets) {
  for (const s of sets) {
    const chave = s.slice(0, s.indexOf('=')), partes = chave.split('.');
    let o = C[partes[0]];
    for (const q of partes.slice(1, -1)) o = o?.[q];
    const ult = partes[partes.length - 1];
    if (!o || !(ult in o)) throw new Error(`--set: ${chave} não existe`);
    o[ult] = JSON.parse(s.slice(s.indexOf('=') + 1));
  }
}

/** Carrega a lógica da pasta `js` (com os --set aplicados antes) + as ferramentas de medida. */
export async function carregarLogica(js, sets = []) {
  const imp = f => import(pathToFileURL(path.join(js, f)).href);
  const C = await imp('config.js');
  aplicarSets(C, sets);
  const P = await imp('partida.js'), S = await imp('sim.js'), F = await imp('faltas.js'), T = await imp('tatica.js');
  const IT = await imp('ia-tatica.js'), DF = await imp('defesa.js');
  const LV = await imp('livre.js'), DP = await imp('disputa.js'), R = await imp('rng.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'partida-medidas.mjs')).href);
  const H = await import(pathToFileURL(path.join(AQUI, 'humano-roteiro.mjs')).href);
  return { C, P, S, F, T, IT, DF, LV, DP, R, M, H };
}

const novoTime = () => ({
  oport: 0, tenta: 0, tentaLento: 0, tentaEnc: 0, cheg: { frente: 0, lado: 0, tras: 0 },
  cfgOk: 0, cfgErr: 0, cfgErrEx: null,
  bAval: 0, bSomaP: 0, bEsp: 0, bCheg: { frente: [0, 0], lado: [0, 0], tras: [0, 0] }, bLento: [0, 0],
  rFalta: 0, rEvitado: 0, rSemGanhar: 0, rLimpo: 0,
  cAval: 0, cSomaP: 0, tAval: 0, tSomaP: 0, dAval: 0, dSomaP: 0,
  faltas: 0, origem: {}, amarelos: 0, vermelhos: 0, motivos: {}, penaltis: 0, gols: 0, chutes: 0, roubadas: 0, boteErrado: 0,
  // o controlado de um time humano (a pessoa / a IA pelo controlado na demo): nunca dá boteIA
  oportCtrl: 0, tentaCtrl: 0, faltasCtrl: 0,
  // volume (os guiados pela IA de linha, bola rolando): metros, jogador-ticks, em disparada (> 7 m/s); presença: ticks com o
  // condutor adversário e alguém meu a ≤ 5 m dele / ticks com o condutor adversário; posse (ticks com a bola no pé do time)
  vol: 0, volTk: 0, disp: 0, pres: 0, presN: 0, posse: 0,
});

const estadoRot = sem => ({ s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 });
const V_DISP = 7;

/**
 * Uma partida medida. `L` = carregarLogica da cópia INSTRUMENTADA. modo 'demo' (IA × IA: a IA pelo controlado do time 0,
 * entradaDemoPartida) ou um roteiro ('agressivo' | 'conduz' | 'calmo' | 'passivo': o time 0 é a pessoa). `classico` passa
 * {classico: true} ao criarPartida; `dificuldade` (fora do 'normal') também. `cada` > 0: guarda o hash a cada `cada` passos
 * (o KI). Devolve {modo, sem, classico, dif, t: [time 0, time 1], contatos (começos de contato de corpo entre adversários),
 * rolTk, ticks, fim, h}.
 */
export function jogarMedida(L, { sem, modo, classico = false, dificuldade = 'normal', min = 4, cada = 0, maxPassos = 0 }) {
  const { C, P, S, F, M, H } = L;
  const opc = { semente: sem, minutosPorTempo: min };
  if (classico) opc.classico = true;
  if (dificuldade && dificuldade !== 'normal') opc.dificuldade = dificuldade;
  const m = P.criarPartida(opc);
  const HUM = modo !== 'demo';
  const st = estadoRot(sem);
  const R = { modo, sem, classico: !!classico, dif: dificuldade, t: [novoTime(), novoTime()], contatos: 0, rolTk: 0, ticks: 0, fim: false, h: [] };
  const ctrl = j => m.humanos.includes(j.time) && m.controlado[j.time] === j.id;
  const temCfg = typeof S.cfgBote === 'function';
  const timeDe = id => { for (const o of m.jogadores) if (o.id === id) return o; for (const o of m.expulsos ?? []) if (o.id === id) return o; return null; };
  let prev = new Set(), cur = new Set();
  globalThis.__CL = {
    contato(mm, p, q) { const k = p.id < q.id ? p.id * 10000 + q.id : q.id * 10000 + p.id; cur.add(k); if (!prev.has(k)) R.contatos++; },
    oport(mm, j) { const r = R.t[j.time]; if (ctrl(j)) r.oportCtrl++; else r.oport++; },
    tenta(mm, j, dono, cfg, lento, enc) {
      const r = R.t[j.time];
      if (ctrl(j)) { r.tentaCtrl++; return; }
      r.tenta++; if (lento) r.tentaLento++; if (enc) r.tentaEnc++;
      r.cheg[F.chegada(j, dono)]++;
      // K3: o cfg usado é o da tabela do time (a dificuldade contra a pessoa e o clássico)
      const esp = temCfg ? S.cfgBote(mm, j.time) : null;
      if (cfg === esp) r.cfgOk++; else { r.cfgErr++; if (!r.cfgErrEx) r.cfgErrEx = `time ${j.time} tick ${mm.tick}`; }
    },
    res(mm, j, dono, f) {
      if (ctrl(j)) return;
      const r = R.t[j.time];
      if (f == null) r.rLimpo++; else if (f.evitado) r.rEvitado++; else if (f.semGanhar) r.rSemGanhar++; else r.rFalta++;
    },
    pBote(mm, d, c, p, cuidado) {
      if (ctrl(d)) return;
      const r = R.t[d.time];
      r.bAval++; r.bSomaP += p; r.bEsp += p * cuidado;
      const ch = F.chegada(d, c); r.bCheg[ch][0]++; r.bCheg[ch][1] += p;
      if (Math.hypot(c.vx, c.vz) < C.ACOES.boteIA.vParado) { r.bLento[0]++; r.bLento[1] += p; }
    },
    pCarga(mm, d, c, p) { if (ctrl(d)) return; const r = R.t[d.time]; r.cAval++; r.cSomaP += p; },
    pTatica(mm, d, c, p) { if (ctrl(d)) return; const r = R.t[d.time]; r.tAval++; r.tSomaP += p; },
    pDiv(mm, j, d0, p) { const r = R.t[j.time]; r.dAval++; r.dSomaP += p; },
  };
  const N = maxPassos || Math.round(2 * min * 3600) + 9000;
  try {
    for (let i = 0; i < N; i++) {
      prev = cur; cur = new Set();
      const ent = HUM ? H.entradaRoteiro(m, M, C.BOTAO, st, modo) : P.entradaDemoPartida(m);
      const ev = P.passoPartida(m, ent) ?? m.eventos ?? [];
      R.ticks++;
      for (const e of ev) {
        switch (e.tipo) {
          case 'falta': {
            const d = timeDe(e.def);
            if (!d) break;
            const r = R.t[d.time];
            if (m.humanos.includes(d.time) && m.controlado[d.time] === d.id) { r.faltasCtrl++; break; }
            r.faltas++; r.origem[e.origem] = (r.origem[e.origem] ?? 0) + 1;
            break;
          }
          case 'cartao': {
            const r = R.t[e.time];
            if (e.cor === 'vermelho') r.vermelhos++; else r.amarelos++;
            r.motivos[e.motivo] = (r.motivos[e.motivo] ?? 0) + 1;
            break;
          }
          case 'penaltiMarcado': R.t[1 - e.time].penaltis++; break;
          case 'gol': R.t[e.time].gols++; break;
          case 'roubada': { const q = timeDe(e.id); if (q && e.ia) R.t[q.time].roubadas++; break; }
          case 'boteErrado': { const q = timeDe(e.id); if (q) R.t[q.time].boteErrado++; break; }
          default: break;
        }
        if (e.id != null && M.ehChute(m, e)) { const q = timeDe(e.id); if (q) R.t[q.time].chutes++; }
      }
      if (cada && m.tick % cada === 0) R.h.push(S.hashMundo(m));
      if (m.partida.estado === 'fim') { R.fim = true; break; }
      const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
      if (!rolando) continue;
      R.rolTk++;
      const cid = m.naMao == null ? m.posse : null;
      let cond = null;
      if (cid != null) for (const o of m.jogadores) if (o.id === cid) { cond = o; break; }
      if (cond) R.t[cond.time].posse++;
      const perto = [false, false];
      for (const o of m.jogadores) {
        if (o.posicao === 'GOL' || ctrl(o)) continue;
        const r = R.t[o.time], v = Math.hypot(o.vx, o.vz);
        r.vol += v / 60; r.volTk++;
        if (v > V_DISP) r.disp++;
        if (cond && o.time !== cond.time && Math.hypot(o.x - cond.x, o.z - cond.z) <= 5) perto[o.time] = true;
      }
      if (cond) { const td = 1 - cond.time; R.t[td].presN++; if (perto[td]) R.t[td].pres++; }
    }
  } finally {
    globalThis.__CL = null;
  }
  return R;
}
