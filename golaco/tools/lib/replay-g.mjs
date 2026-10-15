// Itens G do teste-replay-anel (12/10: a 1ª pessoa do autor e a visão do treinador no replay do gol): uma partida IA × IA
// inteira (lib/anel-node.mjs, a mesma gravação do main.js, com os treinadores), e em cada gol, na saída de bola (quando a
// página monta o replay), o roteiro com e sem os extras e as medidas de cada câmera nova, quadro a quadro, lidas do anel:
//   G1 a ordem dos planos; G2 os planos de antes campo a campo iguais (com e sem extras; e com a versão --ref); G3 os
//   orçamentos; G4 dentro do anel, sem atravessar corte; G6–G8 a 1ª pessoa; G9–G10 o treinador; G12 a pose gravada do
//   treinador = a ao vivo, bit a bit.
// Devolve números compactos (o pai junta as sementes).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GRAU = 180 / Math.PI;
const ang = (ax, ay, az, bx, by, bz) => { const d = (ax * bx + ay * by + az * bz) / ((Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz)) || 1); return Math.acos(Math.max(-1, Math.min(1, d))) * GRAU; };

/** Planos de antes (tv, atras, lateral, saot) num texto comparável campo a campo. */
const antigos = r => JSON.stringify({ ...r, planos: r.planos.filter(p => p.cam !== 'primeira' && p.cam !== 'treinador').map(p => ({ ...p })) });

export async function medirSemente(pastaJs, sem, opc = {}) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), 'anel-node.mjs')).href);
  const RA = await imp('render/replay-anel.js'), AG = await imp('render/autor-gol.js');
  const { medirGol } = await criarMedidor(pastaJs, opc);
  const GR = await criarGravador(pastaJs);
  const S = GR.novaPartida(sem, { minutosPorTempo: opc.min });
  const ag = AG.criarAutorGol();
  const timeDe = id => { for (const j of S.m.jogadores) if (j.id === id) return j.time; return null; };
  const gols = [];
  let pend = null;
  const g12 = { comparados: 0, diferentes: 0 };
  const o57 = new Float32Array(57);
  for (let i = 0; i < 400000 && S.m.partida.estado !== 'fim'; i++) {
    const evs = GR.passo(S);
    AG.autorEventos(ag, evs, S.m.tick, timeDe);
    // G12: a pose gravada do treinador no passo = a ao vivo
    if (S.T && i % 211 === 0) for (const tc of S.T.tecs) {
      const p = RA.poseNoTick(S.a, S.m.tick, tc.id, o57);
      g12.comparados++;
      if (!p) { g12.diferentes++; continue; }
      for (let k = 0; k < 57; k++) if (o57[k] !== tc.atu[k]) { g12.diferentes++; break; }
    }
    const eg = evs.find(e => e.tipo === 'gol');
    if (eg && !pend) {
      const g = ag.gol;
      pend = {
        golTick: S.m.tick, chuteTick: ag.chute.ativo ? ag.chute.tick : null, lado: S.m.bola.p.x > 0 ? 1 : -1, time: eg.time,
        autor: g.ativo ? g.id : (eg.autor ?? null), contra: g.ativo ? !!g.contra : false, desvio: g.ativo ? !!g.desvio : false,
        tipoChute: ag.chute.ativo ? ag.chute.tipo : null,
      };
    }
    if (pend && evs.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) {
      if (opc.aoGol) opc.aoGol(S.a, pend);
      gols.push(medirGol(S.a, pend));
      pend = null;
    }
  }
  return { sem, gols, g12 };
}

/**
 * As medidas de um gol no anel (a mesma conta do teste): {medirGol(anel, g)} com g = {golTick, chuteTick, lado, time, autor,
 * contra, desvio, tipoChute}. opc.ref: a pasta js da versão de comparação do G2.
 */
export async function criarMedidor(pastaJs, opc = {}) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const RR = await imp('render/replay-roteiro.js'), RA = await imp('render/replay-anel.js'), RO = await imp('render/replay-olhos.js');
  const C = await imp('config.js'), EF = await imp('estadio-forma.js');
  const { J, SEGMENTOS, RAIO_CABECA } = await imp('anim.js');
  // G13: os segmentos do próprio autor que a 1ª pessoa DESENHA (jogador3d.js OCULTA.cabeca | OCULTA.tronco tira a cabeça,
  // o pescoço, o peito, os ombros e os braços: a mesma regra pelo nome das juntas)
  const NOME = Object.fromEntries(Object.entries(J).map(([n, i]) => [i, n]));
  const VISIVEL_1P = SEGMENTOS.map(([a, b]) => { const nm = NOME[a] + ' ' + NOME[b]; return !(/pescoco|peito|ombro|cotovelo|mao|cabeca/.test(nm) || (NOME[a] === 'lombar' && NOME[b] === 'peito')); });
  const REF = opc.ref ? await import(pathToFileURL(path.join(opc.ref, 'render/replay-roteiro.js')).href) : null;
  const { REPLAY, CAMPO } = C;
  const telas = [[16 / 9, false], [844 / 390, true], [568 / 320, true]];
  return { medirGol };

  // ---------------------------------------------------------------------------------------------- um gol
  function medirGol(a, g) {
    const r = RR.roteiroGol(a, g), r0 = RR.roteiroGol(a, { ...g, extras: false });
    const out = { golTick: g.golTick, chute: g.chuteTick, contra: g.contra, autor: g.autor, tipo: g.tipoChute, time: g.time, ok: !!r };
    if (!r) return out;
    out.cams = r.planos.map(p => p.cam);
    out.golaco = !!r.golaco; out.checagem = !!r.checagem;
    // G2: os planos de antes iguais com e sem extras; e com a versão --ref (o roteiro sem extras = o de antes)
    out.igualSemExtras = antigos(r) === antigos(r0);
    if (REF) { const rr = REF.roteiroGol(a, { golTick: g.golTick, chuteTick: g.chuteTick, lado: g.lado, time: g.time }); out.igualRef = !!rr && JSON.stringify(rr) === JSON.stringify(r0); }
    // G3: durações
    const dur = p => (p.ate - p.de) / 60 / p.vel;
    const ext = r.planos.filter(p => p.cam === 'primeira' || p.cam === 'treinador');
    out.extras = ext.reduce((s, p) => s + dur(p), 0); out.total = RR.duracao(r); out.antiga = RR.duracao(r0);
    // G4: dentro do anel e sem atravessar corte
    out.dentro = r.planos.every(p => a.slot(p.de) >= 0 && a.slot(p.ate) >= 0 && (p.cam === 'saot' || a.primeiroCorte(p.de + 1, p.ate) == null));
    // G1: a ordem pelos nomes
    const ordem = ['tv', 'atras', 'lateral', 'primeira', 'treinador', 'saot'];
    out.ordem = out.cams.every((c, i) => i === 0 || ordem.indexOf(c) > ordem.indexOf(out.cams[i - 1]));
    const prim = r.planos.find(p => p.cam === 'primeira'), tr = r.planos.find(p => p.cam === 'treinador');
    out.temPrimeira = !!prim; out.temTreinador = !!tr; out.parte2 = !!tr?.enq?.parte2;
    if (prim) out.p = medirPrimeira(a, prim, g);
    if (tr) out.t = medirTreinador(a, tr, g);
    return out;
  }

  // ---------------------------------------------------------------------------------------------- 1ª pessoa (G6–G8)
  function medirPrimeira(a, p, g) {
    const e = p.enq, F = REPLAY.primeira, cab = p.tipoChute === 'cabeceio';
    const m = { olhoCab: 0, olhoBruto: 0, arfMin: Infinity, arfMax: -Infinity, resid: 0, residBruto: 0, giros: [], bolaIn: 0, bolaN: 0, olharBola: [], gol0: null, gol1: null, lente: -1, de: p.de, ate: p.ate, cortado: !!p.cortadoPelaLente, solido: 0, solidoEx: '', proprio: Infinity, n: 0 };
    const cam = {}, pr = {}, cabeca = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }, PA = new Float32Array(57);
    const gx = p.lado * CAMPO.meioX, gy = CAMPO.gol.altura / 2;
    let ant = null;
    const ys = [], ysB = [], correndo = [];
    for (let t = p.de; t <= p.ate; t++) {
      RO.cameraPrimeira(e, t, cam);
      const i = t - e.w0;
      RA.juntaNoTick(a, t, p.autor, J.cabeca, cabeca);
      // G13: a lente fora dos sólidos do estádio (gol, placas, bancos...) e acima do chão; longe do que se vê do próprio corpo
      m.n++;
      const so = lenteEmSolido(cam.x, cam.y, cam.z, F.perto);
      if (so) { m.solido++; if (!m.solidoEx) m.solidoEx = `${so} no passo ${t} (y ${cam.y.toFixed(2)})`; }
      if (RA.poseNoTick(a, t, p.autor, PA)) m.proprio = Math.min(m.proprio, distCorpo(PA, cam.x, cam.y, cam.z, VISIVEL_1P));
      m.olhoCab = Math.max(m.olhoCab, Math.hypot(cam.x - cabeca.x, cam.y - cabeca.y, cam.z - cabeca.z));
      m.olhoBruto = Math.max(m.olhoBruto, Math.hypot(cam.x - e.bruto[i * 3], cam.y - e.bruto[i * 3 + 1], cam.z - e.bruto[i * 3 + 2]));
      m.olhoBrutoH = Math.max(m.olhoBrutoH ?? 0, Math.hypot(cam.x - e.bruto[i * 3], cam.z - e.bruto[i * 3 + 2]));
      const dx = cam.lx - cam.x, dy = cam.ly - cam.y, dz = cam.lz - cam.z;
      const arf = Math.atan2(dy, Math.hypot(dx, dz)) * GRAU;
      m.arfMin = Math.min(m.arfMin, arf); m.arfMax = Math.max(m.arfMax, arf);
      if (ant) m.giros.push(ang(dx, dy, dz, ant[0], ant[1], ant[2]) * 60 * p.vel);
      ant = [dx, dy, dz];
      // a bola (no quadro de chute a gol, fora da janela em que ela some) e o olhar
      RA.bolaNoTick(a, t, b);
      m.olharBola.push(ang(dx, dy, dz, b.x - cam.x, b.y - cam.y, b.z - cam.z));
      if (t >= p.chuteTick && t <= p.golTick && !cam.bolaSome) {
        m.bolaN++;
        let dentro = true;
        for (const [asp] of telas.slice(0, 2)) { RO.projetar(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz, RO.fovVerticalDe(F.fovH, asp), asp, b.x, b.y, b.z, pr); if (!(pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1)) dentro = false; }
        if (dentro) m.bolaIn++;
      }
      // a boca do gol (o centro dela) no quadro
      const golNoQuadro = () => telas.slice(0, 2).every(([asp]) => { RO.projetar(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz, RO.fovVerticalDe(F.fovH, asp), asp, gx, gy, 0, pr); return pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1; });
      if (t === p.chuteTick - 30) m.gol0 = golNoQuadro();
      if (t >= p.chuteTick + 18 && t <= p.golTick) { const ok = golNoQuadro(); m.gol1 = (m.gol1 ?? true) && ok; }
      // balanço residual: o olho correndo (o autor a > 3 m/s, sem pulo)
      const j0 = RA.jogadorNoTick(a, t - 1, p.autor), j1 = RA.jogadorNoTick(a, t + 1, p.autor);
      const v = j0 && j1 ? Math.hypot(j1.x - j0.x, j1.z - j0.z) * 30 : 0;
      ys.push(cam.y); ysB.push(e.bruto[i * 3 + 1]);
      correndo.push(v > 3 && !cab && cabeca.y < 1.75 && t < p.chuteTick - 6);
    }
    // y − média móvel de 0,5 s (31 passos) — a média com o olho de verdade dos 15 passos de cada lado (o enquadramento vai
    // além do plano: nada de repetir a borda, que inventava balanço no começo e no fim)
    const yCam = t => RO.cameraPrimeira(e, t, cam).y, yBr = t => e.bruto[Math.max(0, Math.min(e.n - 1, t - e.w0)) * 3 + 1];
    const res = f => { let mx = 0; for (let i = 0; i < ys.length; i++) { if (!correndo[i]) continue; const t = p.de + i; let s = 0; for (let k = -15; k <= 15; k++) s += f(t + k); mx = Math.max(mx, Math.abs(f(t) - s / 31)); } return mx; };
    m.resid = res(yCam); m.residBruto = res(yBr);
    m.nCorrendo = correndo.filter(Boolean).length;
    m.lente = RO.corpoNaLente(a, e, F.corpo, p.autor);
    m.olharBolaMed = mediana(m.olharBola); delete m.olharBola;
    return m;
  }

  // ---------------------------------------------------------------------------------------------- treinador (G9–G10)
  function medirTreinador(a, p, g) {
    const e = p.enq, Tr = REPLAY.treinador;
    const m = { olhoCab: 0, fovs: new Set(), bolaIn: 0, bolaN: 0, golGol: null, giros: [], p2: null, de: p.de, corte: p.corte, ate: p.ate, n: 0, solido: 0, solidoEx: '', corpoLente: 0, corpoEx: '', corpoMin: Infinity };
    const cam = {}, pr = {}, cabeca = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }, Q = new Float32Array(57);
    const gx = p.lado * CAMPO.meioX, gy = CAMPO.gol.altura / 2;
    let ant = null;
    const fim1 = p.corte ?? p.ate;
    for (let t = p.de; t <= fim1; t++) {
      RO.cameraTreinador(e, t, 16 / 9, false, cam);
      if (cam.parte !== 1) continue;
      RA.juntaNoTick(a, t, p.tecnico, J.cabeca, cabeca);
      m.olhoCab = Math.max(m.olhoCab, Math.hypot(cam.x - cabeca.x, cam.y - cabeca.y, cam.z - cabeca.z));
      m.fovs.add(cam.fov.toFixed(6));
      // G13: a lente fora dos sólidos e nenhum outro corpo (jogador, o outro treinador) a < REPLAY.primeira.corpo m dela
      // no quadro (ele mesmo sai da lista de desenho na parte 1)
      m.n++;
      const so = lenteEmSolido(cam.x, cam.y, cam.z, 0.5);
      if (so) { m.solido++; if (!m.solidoEx) m.solidoEx = `${so} no passo ${t}`; }
      const s = a.slot(t);
      for (let v = 0; s >= 0 && v < a.nVagas[s]; v++) {
        const id = a.ids[s * a.vagas + v];
        if (id < 0 || id === p.tecnico) continue;
        const cx = a.dados[(s * a.vagas + v) * a.K + a.P], cz = a.dados[(s * a.vagas + v) * a.K + a.P + 1];
        if (Math.hypot(cx - cam.x, cz - cam.z) > 2.5) continue;
        RA.poseNoTick(a, t, id, Q);
        const d = distCorpo(Q, cam.x, cam.y, cam.z);
        m.corpoMin = Math.min(m.corpoMin, d);
        if (d < REPLAY.primeira.corpo) {
          RO.projetar(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz, cam.fov, 16 / 9, cx, 1.0, cz, pr);
          if (pr.z > -0.3 && Math.abs(pr.x) <= 1.3) { m.corpoLente++; if (!m.corpoEx) m.corpoEx = `${id} a ${d.toFixed(2)} m no passo ${t}`; }
        }
      }
      const dx = cam.lx - cam.x, dy = cam.ly - cam.y, dz = cam.lz - cam.z;
      if (ant) m.giros.push(ang(dx, dy, dz, ant[0], ant[1], ant[2]) * 60 * p.vel);
      ant = [dx, dy, dz];
      RA.bolaNoTick(a, t, b);
      m.bolaN++;
      let dentro = true;
      for (const [asp, peq] of telas.slice(0, 2)) { const c2 = RO.cameraTreinador(e, t, asp, peq, {}); RO.projetar(c2.x, c2.y, c2.z, c2.lx, c2.ly, c2.lz, c2.fov, asp, b.x, b.y, b.z, pr); if (!(pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1)) dentro = false; }
      if (dentro) m.bolaIn++;
      if (t === p.golTick) m.golGol = telas.slice(0, 2).every(([asp, peq]) => { const c2 = RO.cameraTreinador(e, t, asp, peq, {}); RO.projetar(c2.x, c2.y, c2.z, c2.lx, c2.ly, c2.lz, c2.fov, asp, gx, gy, 0, pr); return pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1; });
    }
    m.fovs = m.fovs.size;
    // (o filho manda por JSON: Infinity viraria null e o pai leria 0 m — "o mais perto a 0,00 m" sem ninguém a < 2,5 m)
    if (!Number.isFinite(m.corpoMin)) m.corpoMin = null;
    if (p.corte != null && e.parte2) m.p2 = medirParte2(a, p, e);
    return m;
  }

  /**
   * A lente (x, y, z) dentro de algo sólido do estádio (estadio-forma.js solidoEm, folga 5 cm; o chão conta só com a lente a
   * < perto + 5 cm dele: o plano de recorte próximo entraria no gramado)? O nome ou null.
   */
  function lenteEmSolido(x, y, z, perto) {
    if (y < perto + 0.05) return 'chão';
    const so = EF.solidoEm(x, y, z, 0.05, false);
    return so && so !== 'chão' ? so : null;
  }

  /** Distância do ponto à superfície do corpo gravado (cápsulas e cabeça; `vis`: só os segmentos marcados, sem a cabeça). */
  function distCorpo(P, x, y, z, vis = null) {
    let dm = Infinity;
    for (let si = 0; si < SEGMENTOS.length; si++) {
      if (vis && !vis[si]) continue;
      const [ja, jb, ra, rb] = SEGMENTOS[si];
      const ax = P[ja * 3], ay = P[ja * 3 + 1], az = P[ja * 3 + 2], vx = P[jb * 3] - ax, vy = P[jb * 3 + 1] - ay, vz = P[jb * 3 + 2] - az;
      const l2 = vx * vx + vy * vy + vz * vz || 1e-9, u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / l2));
      dm = Math.min(dm, Math.hypot(x - ax - vx * u, y - ay - vy * u, z - az - vz * u) - (ra + (rb - ra) * u));
    }
    if (vis) return dm;
    const ic = J.cabeca * 3;
    return Math.min(dm, Math.hypot(x - P[ic], y - P[ic + 1], z - P[ic + 2]) - RAIO_CABECA);
  }

  function medirParte2(a, p, e) {
    const pr = {}, P = new Float32Array(57), Q = new Float32Array(57);
    const r = { n: 0, inteiro: 0, xMin: Infinity, xMax: -Infinity, livre: 0, camSolido: false, camCorpo: Infinity, perto2: 0, reage: 0 };
    const q = e.parte2;
    r.camSolido = !!EF.solidoEm(q.cam.x, q.cam.y, q.cam.z, 0.3, false);
    for (let t = p.corte; t <= p.ate; t++) {
      if (!RA.poseNoTick(a, t, p.tecnico, P)) continue;
      r.n++;
      // reagindo ao gol: uma mão acima do topo da cabeça (o soco no ar da comemoração: tecnicos.js 'comemora')
      if (Math.max(P[J.maoE * 3 + 1], P[J.maoD * 3 + 1]) > P[J.cabeca * 3 + 1] + RAIO_CABECA) r.reage++;
      let inteiro = true;
      for (const [asp, peq] of telas) {
        const c = RO.cameraTreinador(e, t, asp, peq, {});
        // cabeça (o alto: centro + raio) e os pés (tornozelos e pontas)
        const pts = [[P[J.cabeca * 3], P[J.cabeca * 3 + 1] + RAIO_CABECA * 1.1, P[J.cabeca * 3 + 2]], ...[J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD].map(k => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]])];
        for (const [x, y, z] of pts) { RO.projetar(c.x, c.y, c.z, c.lx, c.ly, c.lz, c.fov, asp, x, y, z, pr); if (!(pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1)) inteiro = false; }
        if (asp === 16 / 9) {
          RO.projetar(c.x, c.y, c.z, c.lx, c.ly, c.lz, c.fov, asp, P[J.pelve * 3], 0.92, P[J.pelve * 3 + 2], pr);
          const xs = (pr.x + 1) / 2; r.xMin = Math.min(r.xMin, xs); r.xMax = Math.max(r.xMax, xs);
        }
      }
      if (inteiro) r.inteiro++;
      // cabeça e peito sem ninguém na frente; a câmera a ≥ 0,6 m de qualquer corpo; nada a < 2 m dela no quadro
      const c = RO.cameraTreinador(e, t, 16 / 9, false, {});
      let livre = true;
      const s = a.slot(t);
      for (let v = 0; v < a.nVagas[s]; v++) {
        const id = a.ids[s * a.vagas + v];
        if (id < 0 || id === p.tecnico) continue;
        RA.poseNoTick(a, t, id, Q);
        r.camCorpo = Math.min(r.camCorpo, distCorpo(Q, c.x, c.y, c.z));
        for (const k of [J.cabeca, J.peito]) {
          // amostra o caminho da câmera até a junta: algum ponto dentro do corpo do outro?
          for (let u = 0.05; u < 0.97; u += 0.04) {
            const x = c.x + (P[k * 3] - c.x) * u, y = c.y + (P[k * 3 + 1] - c.y) * u, z = c.z + (P[k * 3 + 2] - c.z) * u;
            if (distCorpo(Q, x, y, z) < 0) { livre = false; break; }
          }
        }
        for (let j = 0; j < 19; j++) {
          const x = Q[j * 3], y = Q[j * 3 + 1], z = Q[j * 3 + 2];
          if (Math.hypot(x - c.x, y - c.y, z - c.z) < 2) { RO.projetar(c.x, c.y, c.z, c.lx, c.ly, c.lz, c.fov, 16 / 9, x, y, z, pr); if (pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1) { r.perto2++; break; } }
        }
      }
      if (livre) r.livre++;
    }
    return r;
  }
}

export function mediana(arr) { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; }
export function quantil(arr, q) { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
