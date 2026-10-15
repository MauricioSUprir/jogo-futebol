// Varre partidas IA × IA (Node, em paralelo: worker_threads) gravando o anel como o main.js (lib/anel-node.mjs) e mede,
// em cada IMPEDIMENTO e em cada GOL, a cena semiautomática do replay (render/replay-saot.js, replay-roteiro.js). Usado
// pelo teste-saot (S2, S4, S6–S8 com lances de verdade) e pelo medir-saot (frequência da posição legal).
//   varrerSaot({pastaJs, sementes, maxTicks, threads, limites}) → [{semente, ticks, imped: [...], gols: [...]}]
// Cada impedimento: {tick, foto, apito, id, def, por, lado, margem, distDef (|x do defensor − linhaX| no anel), dur, p1,
// p2, planos, enq: {tv, cel} (quadro final e a órbita a 60 qps), pose: {minY, peAtac, peDef}, partes}. Cada gol:
// {tick, time, lado, golaco, dur, checagem, planos, passe?, tvDe, tvAte, margem?, igualHoje (sem checagem: o roteiro
// de antes), legais: {limite: margem | null}}.
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';

const AQUI = fileURLToPath(import.meta.url);

export async function varrerSaot({ pastaJs, sementes, maxTicks = 6000, threads = Math.max(1, Math.min(os.cpus().length, 4)), limites = [0.5, 1.0], comoPagina = false, aoTerminar = null }) {
  const fila = sementes.slice();
  const res = [];
  async function trabalhador() {
    while (fila.length) {
      const semente = fila.shift();
      const r = await new Promise((ok, erro) => {
        const w = new Worker(AQUI, { workerData: { varreSaot: true, pastaJs, semente, maxTicks, limites, comoPagina } });
        w.once('message', ok); w.once('error', erro);
        w.once('exit', c => { if (c) erro(new Error(`worker saiu com ${c}`)); });
      });
      res.push(r);
      if (aoTerminar) aoTerminar(r, res.length, sementes.length, res);
    }
  }
  await Promise.all(Array.from({ length: Math.min(threads, sementes.length) }, trabalhador));
  res.sort((a, b) => a.semente - b.semente);
  return res;
}

// ------------------------------------------------------------------------------------------------ worker
/** Roteiro do gol de ANTES da cena semiautomática (copiado da main, sem checagem): a referência de "idêntico ao de hoje". */
export function roteiroGolHoje(anel, g, REPLAY, CAMPO, bolaNoTick) {
  const s60 = s => Math.round(s * 60);
  const G = REPLAY.gol;
  const { golTick, lado } = g;
  if (anel.slot(golTick) < 0) return null;
  const chute = g.chuteTick != null && anel.slot(g.chuteTick) >= 0 ? g.chuteTick : Math.max(anel.primeiro, golTick - 45);
  const cDepois = anel.primeiroCorte(golTick + 1, Math.min(anel.ultimo, golTick + s60(Math.max(G.depois, G.lentoDepois))));
  const fimMax = cDepois != null ? cDepois - 1 : anel.ultimo;
  const fimTV = Math.min(fimMax, golTick + s60(G.depois));
  let ini = Math.max(anel.primeiro, chute - s60(G.antes));
  const c = anel.ultimoCorte(ini, golTick);
  if (c != null) ini = c;
  const fimA = Math.min(fimMax, golTick + s60(G.lentoDepois));
  const ehGolaco = () => { if (g.chuteTick == null) return false; const b = bolaNoTick(anel, g.chuteTick); if (!b) return false; return Math.hypot(b.x - lado * CAMPO.meioX, b.z) >= REPLAY.gol.golaco; };
  const golaco = g.golaco ?? ehGolaco();
  const lat = golaco ? { de: Math.max(ini, chute - s60(G.lateralAntes)), ate: Math.min(fimMax, chute + s60(G.lateralDepois)), vel: G.vel[2], cam: 'lateral' } : null;
  const orcamento = golaco ? G.maximoGolaco - Math.max(0, lat.ate - lat.de) / 60 / G.vel[2] : G.maximo;
  let iniA = Math.max(ini, chute - s60(G.lentoAntes));
  const total = () => (fimTV - ini) / 60 / G.vel[0] + (fimA - iniA) / 60 / G.vel[1];
  let excesso = total() - orcamento;
  if (excesso > 0) ini = Math.max(ini, Math.min(ini + s60(excesso * G.vel[0]), chute - s60(G.antesMin)));
  excesso = total() - orcamento;
  if (excesso > 0) iniA = Math.max(iniA, Math.min(iniA + Math.ceil(excesso * 60 * G.vel[1]), chute - 18));
  const planos = [
    { de: ini, ate: fimTV, vel: G.vel[0], cam: 'tv' },
    { de: iniA, ate: fimA, vel: G.vel[1], cam: 'atras' },
  ];
  if (lat) { lat.de = Math.max(lat.de, ini); planos.push(lat); }
  const validos = planos.filter(p => p.ate > p.de);
  if (!validos.length) return null;
  return { tipo: 'gol', planos: validos, lado: lado >= 0 ? 1 : -1, golTick, chuteTick: chute, golaco };
}

/** Igualdade profunda (campos enumeráveis). */
export function igualProfundo(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return Number.isNaN(a) && Number.isNaN(b);
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => igualProfundo(a[k], b[k]));
}

/**
 * A órbita da análise a 60 qps (o relógio de verdade): câmera de cada quadro, o maior giro da direção da vista por
 * quadro (graus), a menor altura e se algum quadro fica dentro de um sólido. Puro: recebe os módulos.
 */
export function medirOrbita(SA, FE, enq, tipo, mesmaLinha = false, dt = 1 / 60) {
  const dura = SA.duracaoSaot(tipo);
  const fs = {}, cam = {};
  let ant = null, maxGiro = 0, minY = Infinity, solido = null, elIni = null;
  for (let t = 0; t <= dura + 1e-9; t += dt) {
    SA.faseSaot(t, tipo, fs, mesmaLinha);
    SA.cameraSaot(enq, fs.u, cam);
    const fx = cam.alvoX - cam.x, fy = cam.alvoY - cam.y, fz = cam.alvoZ - cam.z, l = Math.hypot(fx, fy, fz);
    const d = [fx / l, fy / l, fz / l];
    if (ant) maxGiro = Math.max(maxGiro, Math.acos(Math.min(1, d[0] * ant[0] + d[1] * ant[1] + d[2] * ant[2])) * 180 / Math.PI);
    ant = d;
    if (elIni == null) elIni = cam.el;
    minY = Math.min(minY, cam.y);
    const s = FE.solidoEm(cam.x, cam.y, cam.z, 0.3, false);
    if (s && !solido) solido = s;
  }
  return { maxGiro, minY, solido, elIni, elFim: cam.el };
}

if (!isMainThread && workerData?.varreSaot) {
  const { pastaJs, semente, maxTicks, limites, comoPagina } = workerData;
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(AQUI), 'anel-node.mjs')).href);
  const G = await criarGravador(pastaJs);
  const SA = await imp('render/replay-saot.js');
  const RR = await imp('render/replay-roteiro.js');
  const RA = G.RA;
  const FE = await imp('estadio-forma.js');
  const { REPLAY, CAMPO } = G.C;
  const { J, NJ } = await imp('anim.js');
  const S = G.novaPartida(semente, { comoPagina });
  const imped = [], gols = [];
  let chute = null;
  const pose = new Float32Array(NJ * 3);
  for (let i = 0; i < maxTicks; i++) {
    const evs = G.passo(S);
    for (const e of evs) if (e.tipo === 'chute' || e.tipo === 'cabeceio') chute = S.m.tick;
    for (const ei of evs.filter(e => e.tipo === 'impedimento')) {
      const lado = S.m.ataca[ei.time];
      const ro = RR.roteiroImpedimento(S.a, { fotoTick: ei.tickFoto, apitoTick: S.m.tick, linhaX: ei.linhaX, idImpedido: ei.id, time: ei.time, lado, defensor: ei.defensor, por: ei.por });
      const it = { tick: S.m.tick, foto: ei.tickFoto, apito: S.m.tick, id: ei.id, def: ei.defensor, por: ei.por, lado, linhaX: ei.linhaX };
      if (ro) {
        it.planos = ro.planos.map(p => p.cam); it.dur = RR.duracao(ro);
        it.p1 = RR.duracao({ planos: [ro.planos[0]] }); it.p2 = ro.planos[1] ? RR.duracao({ planos: [ro.planos[1]] }) : null;
        const c = ro.planos[1]?.saot;
        if (c) {
          it.margem = c.margem; it.cena = { atac: c.atac, def: c.def, zMin: c.zMin, zMax: c.zMax };
          const dd = ei.defensor != null ? RA.jogadorNoTick(S.a, ei.tickFoto, ei.defensor) : null;
          it.distDef = dd ? Math.abs(dd.x - ei.linhaX) : null;
          it.enq = {};
          for (const [nome, asp] of [['tv', 16 / 9], ['cel', 844 / 390]]) {
            const e = SA.enquadrarSaot(S.a, c, asp);
            it.enq[nome] = { ok: e.ok, el: e.el, desvio: e.desvio, d: e.d, sobre: e.sobre, ra: e.ra, rd: e.rd, lado: e.lado, cx: e.cx, cy: e.cy, cz: e.cz, orbita: medirOrbita(SA, FE, e, 'impedimento') };
          }
          // pose da análise (a gravada): a junta mais baixa e o pé mais baixo do impedido e do defensor
          let minY = Infinity; const pes = {};
          for (const [k, id] of [['atac', ei.id], ['def', ei.defensor]]) {
            if (id == null || !RA.poseNoTick(S.a, ei.tickFoto, id, pose)) continue;
            for (let q = 0; q < NJ; q++) minY = Math.min(minY, pose[q * 3 + 1]);
            pes[k] = Math.min(pose[J.tornozeloE * 3 + 1], pose[J.tornozeloD * 3 + 1], pose[J.pontaE * 3 + 1], pose[J.pontaD * 3 + 1]);
          }
          it.pose = { minY, peAtac: pes.atac ?? null, peDef: pes.def ?? null };
          // contradição centro × partes (informativa): impedido pelo centro, mas legal pelas partes?
          if (ei.defensor != null) {
            const md = SA.medirCadeia(S.a, { passeTick: ei.tickFoto, id: ei.id, def: ei.defensor, linhaX: ei.linhaX, lado });
            it.partes = md ? { uAtac: md.uAtac, uDef: md.uDef, legalPartes: md.legalPartes } : null;
          }
        }
      }
      imped.push(it);
    }
    const eg = evs.find(e => e.tipo === 'gol');
    if (eg) {
      const g = { golTick: S.m.tick, chuteTick: chute && S.m.tick - chute < 240 ? chute : null, lado: S.m.bola.p.x > 0 ? 1 : -1, time: eg.time };
      // a parte do replay que esta cena mede (tv, atras [, lateral] e a checagem): sem as câmeras 3 e 4 do gol (12/10: a 1ª
      // pessoa e o treinador têm orçamento próprio, medido no teste-replay-anel G1–G13; versões sem elas ignoram o campo)
      const r = RR.roteiroGol(S.a, { ...g, extras: false });
      const hoje = roteiroGolHoje(S.a, g, REPLAY, CAMPO, RA.bolaNoTick);
      const it = { tick: g.golTick, time: g.time, lado: g.lado, golaco: !!r?.golaco, dur: RR.duracao(r), checagem: !!r?.checagem, planos: r ? r.planos.map(p => p.cam) : [] };
      it.durHoje = RR.duracao(hoje);
      it.igualHoje = igualProfundo(r, hoje);
      if (r?.checagem) {
        const ps = r.planos[r.planos.length - 1];
        it.passe = ps.saot.fotoTick; it.margem = ps.saot.margem; it.tvDe = r.planos[0].de; it.tvAte = r.planos[0].ate;
        it.p2 = RR.duracao({ planos: [ps] });
        const e = SA.enquadrarSaot(S.a, ps.saot, 16 / 9), e2 = SA.enquadrarSaot(S.a, ps.saot, 844 / 390);
        it.enq = { tv: { ok: e.ok, sobre: e.sobre, el: e.el, desvio: e.desvio, orbita: medirOrbita(SA, FE, e, 'legal', ps.saot.mesmaLinha) }, cel: { ok: e2.ok, sobre: e2.sobre, el: e2.el, desvio: e2.desvio } };
        it.partes = ps.saot.partes ? { uAtac: ps.saot.partes.uAtac, uDef: ps.saot.partes.uDef } : null;
        it.mesmaLinha = ps.saot.mesmaLinha;
      }
      // frequência (medir-saot): a cena legal com cada limite, sem pensar no orçamento do replay; a mesma sem o critério
      // das partes do corpo (a contradição centro × partes); as margens de todas as cadeias do time no lance
      it.legais = {}; it.legaisCentro = {};
      for (const lim of limites) {
        const cl = SA.checagemLegal(S.a, { golTick: g.golTick, time: g.time, lado: g.lado, limite: lim }); it.legais[lim] = cl ? cl.margem : null;
        const cc = SA.checagemLegal(S.a, { golTick: g.golTick, time: g.time, lado: g.lado, limite: lim, semPartes: true }); it.legaisCentro[lim] = cc ? cc.margem : null;
      }
      const corte = S.a.ultimoCorte(S.a.primeiro, g.golTick);
      const cad = [];
      const nC = RA.cadeiasNoIntervalo(S.a, Math.max(S.a.primeiro, corte ?? S.a.primeiro), g.golTick, g.time, cad);
      it.margens = [];
      for (let k = 0; k < nC; k++) { const md = SA.medirCadeia(S.a, cad[k]); if (md) it.margens.push(+md.margem.toFixed(3)); }
      gols.push(it);
    }
    if (S.m.partida?.estado === 'fim') break;
  }
  parentPort.postMessage({ semente, ticks: S.m.tick, imped, gols, gravarUs: 1000 * S.ms / Math.max(1, S.n) });
}
