// Canhão do goleiro (medir-goleiro.mjs e teste-goleiro-realista.mjs; pedido do dono, 15/10): uma partida IA × IA com as
// medidas do goleiro e, de cópias do mundo no MEIO dela (a bola no pé de um atacante a 8–32 m do gol), chutes de canhão
// 'natural' (na hora, o goleiro como a IA o deixou) e 'perto' (bola e chutador a 6–16,5 m, 0,75 s para ele se arrumar) e
// escanteios. Só mede — não muda nada do jogo. Funciona com qualquer cópia da lógica (o.js: a pasta js).
//   medirSemente(sem, { js, estados, k, kp, ke, min }) → { sem, naturais, canhao, mov, esc, cruz, saidas, gols }
//   emParalelo(arquivo, sems, par, argsFilho) — roda medirSemente em processos (o arquivo responde com servirFilho)
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** No processo filho: responde cada {sem} com fn(sem) (sai só depois de a mensagem ir: a resposta grande se perdia). */
export function servirFilho(fn) {
  process.on('message', async ({ sem }) => {
    let msg;
    try { msg = { ok: true, r: await fn(sem) }; } catch (e) { msg = { ok: false, erro: String(e && e.stack || e) }; }
    process.send(msg, () => process.exit(0));
  });
}

/** Roda as sementes em até `par` processos (o `arquivo` com '--filho' e argsFilho) e devolve as respostas. */
export function emParalelo(arquivo, sems, par, argsFilho = [], log = true) {
  const res = [];
  const t0 = Date.now();
  return new Promise((ok, falha) => {
    let prox = 0, ativos = 0;
    const lanca = () => {
      if (prox >= sems.length && ativos === 0) return ok(res);
      while (ativos < par && prox < sems.length) {
        const sem = sems[prox++]; ativos++;
        const f = fork(arquivo, [...argsFilho, '--filho']);
        let veio = false;
        f.on('message', msg => {
          veio = true;
          if (!msg.ok) { console.error(msg.erro); falha(new Error('filho')); return; }
          res.push(msg.r);
          if (log) process.stderr.write(`semente ${sem} ok (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
        });
        f.on('exit', code => { if (!veio) process.stderr.write(`semente ${sem}: o processo saiu sem resposta (código ${code})\n`); ativos--; lanca(); });
        f.send({ sem });
      }
    };
    lanca();
  });
}

export async function medirSemente(sem, o = {}) {
  const JS = o.js, NEST = o.estados ?? 12, K = o.k ?? 10, KP = o.kp ?? 10, KE = o.ke ?? 2, MIN = o.min ?? 4;
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const P = await imp('partida.js');
  const S = await imp('sim.js');
  const GK = await imp('goleiro.js');
  const B = await imp('bola.js');
  const RG = await imp('regras-goleiro.js');
  const { uniforme } = await imp('rng.js');
  const { CAMPO, GOLEIRO, PASSO } = await imp('config.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'partida-medidas.mjs')).href);
  const MX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;
  const jog = (m, id) => m.jogadores.find(o => o.id === id);
  const goleiroDe = (m, t) => m.jogadores.find(o => o.time === t && o.posicao === 'GOL');
  const rolando = m => m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
  const gxDe = (m, g) => GK.linhaDoGol(m, g);

  /** Onde o goleiro "quer" estar (a mesma conta do movimentoGoleiro sem chute/saída) e o erro dele. */
  function estadoGoleiro(m, g) {
    const b = m.bola, gx = gxDe(m, g), s = Math.sign(gx);
    const dBola = Math.hypot(b.p.x - gx, b.p.z);
    const Pf = GOLEIRO.profundidade;
    const dLinha = dBola <= 20 ? Pf[0] + (Pf[1] - Pf[0]) * Math.min(1, Math.max(0, (dBola - 6) / 14))
      : Pf[1] + (GOLEIRO.profundidadeLonge - Pf[1]) * Math.min(1, Math.max(0, (dBola - 20) / 20));
    const alvo = GK.pontoBissetriz(b.p.x, b.p.z, gx, dLinha);
    const prof = (gx - g.x) * s;
    const naProf = GK.pontoBissetriz(b.p.x, b.p.z, gx, Math.max(0.05, prof)); // a bissetriz na profundidade dele
    const v = Math.hypot(g.vx, g.vz);
    const apoio = (g.pes[0].apoio ? 1 : 0) + (g.pes[1].apoio ? 1 : 0);
    return { v, vz: g.vz, prof, erroAlvo: Math.hypot(g.x - alvo.x, g.z - alvo.z), erroBis: g.z - naProf.z, apoio, saindo: !!g.saindo, dBola };
  }

  /** Pés cruzados: o pé esquerdo (0) à direita do direito (1), na direita do corpo. */
  function pesCruzados(g) {
    const rx = -Math.sin(g.rumo), rz = Math.cos(g.rumo);
    const p0 = g.pes[0], p1 = g.pes[1];
    const x0 = p0.apoio ? p0.x : p0.tx, z0 = p0.apoio ? p0.z : p0.tz, x1 = p1.apoio ? p1.x : p1.tx, z1 = p1.apoio ? p1.z : p1.tz;
    return (x0 - x1) * rx + (z0 - z1) * rz > 0.04;
  }

  // ------------------------------------------------------------------ partida natural (com medidas) e cópias
  const m = P.criarPartida({ semente: sem, minutosPorTempo: MIN });
  const N = Math.round(2 * MIN * 3600 + 3600);
  const estados = [];
  let ultCap = -1e9;
  const mov = [0, 1].map(() => ({ ticks: 0, v: [], acimaDe3: 0, acimaDe4: 0, inv: 0, vzAnt: 0, cruz: 0, lateral: 0, saltoPos: 0, saltoRumo: 0, erroAlvo: 0, xAnt: null, zAnt: null, rAnt: null, armado: 0, armadoSet: 0 }));
  const naturais = [];          // chutes da partida
  let aberto = null;
  const esc = { n: 0, gols: 0, gkToca: 0, chutes: 0 }, cruz = { n: 0, gols: 0, gkToca: 0, chutes: 0 };
  let escAb = null, cruzAb = null;
  const saidas = { '1x1': 0, botao: 0, cruzamento: 0, bolaSolta: 0 };
  for (let i = 0; i < N; i++) {
    // estado do goleiro ANTES do passo (o chute sai dentro do passo)
    const pre = [goleiroDe(m, 0), goleiroDe(m, 1)].map(g => (g ? estadoGoleiro(m, g) : null));
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    const vivo = rolando(m);
    // ---- movimento dos goleiros (posicionando: sem defesa desenhada, sem a bola, sem chute lido em andamento)
    for (const t of [0, 1]) {
      const g = goleiroDe(m, t); if (!g) continue;
      const R = mov[t];
      const def = g.defesa && !g.defesa.fora && m.tick < g.defesa.tick + 6;
      const posic = vivo && m.posse !== g.id && m.naMao !== g.id && !GK.mergulhoAtivo(g, m.tick) && !def;
      if (posic && R.xAnt != null) {
        const v = Math.hypot(g.vx, g.vz);
        R.ticks++; if (R.v.length < 40000) R.v.push(v);
        if (v > 3) R.acimaDe3++;
        if (v > 4) R.acimaDe4++;
        if (Math.abs(g.vz) > 0.3 && Math.abs(R.vzAnt) > 0.3 && Math.sign(g.vz) !== Math.sign(R.vzAnt)) R.inv++;
        if (Math.abs(g.vz) > 0.3) R.vzAnt = g.vz;
        const dir = Math.atan2(g.vz, g.vx);
        let da = Math.abs(dir - g.rumo) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da;
        if (v > 1 && da > 1.05 && da < 2.1) { R.lateral++; if (pesCruzados(g)) R.cruz++; }
        if (Math.hypot(g.x - R.xAnt, g.z - R.zAnt) > 0.13) R.saltoPos++;
        let dr = Math.abs(g.rumo - R.rAnt) % (2 * Math.PI); if (dr > Math.PI) dr = 2 * Math.PI - dr;
        if (dr > 0.35) R.saltoRumo++;
        R.erroAlvo += estadoGoleiro(m, g).erroAlvo;
        // o dono da bola adversário armando o CHUTE (a carga do botão ou o pedido esperando o toque) a até 30 m do gol: o
        // goleiro está "set" (parado e os dois pés no chão)?
        const d = m.posse != null ? jog(m, m.posse) : null;
        if (d && d.time !== g.time && ((d.carga && d.carga.tipo === 'chute') || (d.pedido && d.pedido.tipo === 'chute')) && Math.hypot(m.bola.p.x - gxDe(m, g), m.bola.p.z) < 30) {
          R.armado++;
          if (v < 0.5 && g.pes[0].apoio && g.pes[1].apoio) R.armadoSet++;
        }
      }
      R.xAnt = g.x; R.zAnt = g.z; R.rAnt = g.rumo;
    }
    // ---- eventos
    for (const e of ev) {
      const j = e.id != null ? jog(m, e.id) : null;
      if (e.tipo === 'saidaGoleiro') saidas[e.modo && saidas[e.modo] != null ? e.modo : 'botao']++;
      if (e.tipo === 'cobranca' && e.parada === 'escanteio' && j) { esc.n++; escAb = { t: j.time, tick: m.tick, chute: false, toca: false }; }
      if (e.tipo === 'passe' && e.modo === 'cruzamento' && j && !(escAb && m.tick - escAb.tick < 30)) { cruz.n++; cruzAb = { t: j.time, tick: m.tick, chute: false, toca: false }; }
      for (const ab of [escAb, cruzAb]) {
        if (!ab) continue;
        if (e.tipo === 'defesa' && j && j.time !== ab.t && !ab.toca) { ab.toca = true; if (ab === escAb) esc.gkToca++; else cruz.gkToca++; }
        if (j && j.time === ab.t && M.ehChute(m, e) && !ab.chute) { ab.chute = true; if (ab === escAb) esc.chutes++; else cruz.chutes++; }
        if (e.tipo === 'gol' && e.time === ab.t) { if (ab === escAb) esc.gols++; else cruz.gols++; }
      }
      // chutes naturais: o goleiro adversário no instante (pre), a leitura dele (já feita neste passo) e o desfecho
      if (j && M.ehChute(m, e) && !(m.parada && m.parada.tipo === 'penalti')) {
        if (aberto) { aberto.res ??= 'fora'; naturais.push(aberto); }
        const g = goleiroDe(m, 1 - j.time);
        const u = M.uDe(m, j.time, m.bola.p.x), w = M.wDe(m, j.time, m.bola.p.z);
        aberto = g ? {
          fonte: 'partida', tick: m.tick, time: j.time, gk: g.id, gkHumano: m.humanos.includes(g.time), dist: Math.hypot(MX - u, w),
          cab: e.tipo === 'passe', pre: pre[g.time], ...leitura(m, g), ...geometria(m, g), res: null,
          umXum: umXum(m, j, g),
        } : null;
      }
    }
    if (aberto) acompanhar(m, aberto, ev);
    if (aberto && aberto.res && aberto.fim) { naturais.push(aberto); aberto = null; }
    if (escAb && m.tick - escAb.tick > 8 * 60) escAb = null;
    if (cruzAb && m.tick - cruzAb.tick > 5 * 60) cruzAb = null;
    // ---- cópias do meio da partida: a bola no pé de um atacante a 8–32 m do gol, ±55°
    if (vivo && m.tick >= 3600 && m.tick - ultCap >= 180 && estados.length < NEST && m.posse != null && m.naMao == null) {
      const d = jog(m, m.posse);
      if (d && d.posicao !== 'GOL') {
        const u = M.uDe(m, d.time, m.bola.p.x), w = M.wDe(m, d.time, m.bola.p.z);
        const dist = Math.hypot(MX - u, w), ang = Math.abs(Math.atan2(w, MX - u));
        if (dist >= 8 && dist <= 32 && ang < 0.96 && m.bola.p.y < 0.3) { estados.push({ m: structuredClone(m), dono: d.id }); ultCap = m.tick; }
      }
    }
  }
  if (aberto) { aberto.res ??= 'fora'; naturais.push(aberto); }

  // ------------------------------------------------------------------ canhão
  const canhao = [];
  for (let e = 0; e < estados.length; e++) {
    for (let k = 0; k < K + KP; k++) {
      const q = structuredClone(estados[e].m);
      for (let i = 0; i < 5 * k + e + 1; i++) uniforme(q.rng);
      q.humanos = [];
      const modo = k < K ? 'natural' : 'perto';
      const a = jog(q, estados[e].dono);
      const g = goleiroDe(q, 1 - a.time);
      if (!a || !g) continue;
      const gx = gxDe(q, g), s = Math.sign(gx);
      // sorteios do canhão por um gerador próprio (não mexe no do mundo além do avanço acima)
      const r = sorteador(sem * 7919 + e * 131 + k);
      if (modo === 'perto') {
        const d = 6 + 10.5 * r(), ang = (r() * 2 - 1) * 0.8;
        const bx = gx - s * d * Math.cos(ang), bz = d * Math.sin(ang);
        const rumo = Math.atan2(-bz, gx - bx);
        P.teleportar(a, bx - Math.cos(rumo) * 0.35, bz - Math.sin(rumo) * 0.35, rumo);
        q.posse = null; q.voo = null; q.naMao = null;
        Object.assign(q.bola.p, { x: bx, y: 0.11, z: bz }); Object.assign(q.bola.v, { x: 0, y: 0, z: 0 }); Object.assign(q.bola.w, { x: 0, y: 0, z: 0 });
        q.bola.rolando = true;
        const papel = a.papel; a.papel = 'parado';
        let ok = true;
        for (let i = 0; i < 45 && ok; i++) {
          P.passoPartida(q, P.entradaDemoPartida(q));
          if (q.posse != null || q.naMao != null || !rolando(q) || Math.hypot(q.bola.p.x - bx, q.bola.p.z - bz) > 0.3) ok = false;
        }
        a.papel = papel;
        if (!ok) { canhao.push({ fonte: modo, res: 'semCena' }); continue; }
        const perto = q.jogadores.some(o => o.id !== a.id && o.time !== a.time && o.posicao !== 'GOL' && Math.hypot(o.x - q.bola.p.x, o.z - q.bola.p.z) < 1.2);
        if (perto) { canhao.push({ fonte: modo, res: 'semCena' }); continue; }
      } else {
        if (q.posse !== a.id || q.bola.p.y > 0.3) { canhao.push({ fonte: modo, res: 'semCena' }); continue; }
      }
      const pre = estadoGoleiro(q, g);
      const zt = (r() * 2 - 1) * 3.5, yt = 0.12 + 2.18 * r(), v = 14 + 16 * r();
      dispararChute(q, a, gx, zt, yt, v);
      const reg = { fonte: modo, tick: q.tick, time: a.time, gk: g.id, dist: Math.hypot(q.bola.p.x - gx, q.bola.p.z), v0: v, pre, ...geometria(q, g), res: null, umXum: umXum(q, a, g) };
      let lido = false;
      for (let i = 0; i < 300; i++) {
        const ev = P.passoPartida(q, P.entradaDemoPartida(q));
        if (!lido) { Object.assign(reg, leitura(q, g)); lido = true; }
        acompanhar(q, reg, ev);
        if (reg.res && reg.fim) break;
      }
      reg.res ??= 'fora';
      canhao.push(reg);
    }
    // escanteios do mesmo estado (o goleiro e a área no cruzamento)
    for (let k = 0; k < KE; k++) {
      const q = structuredClone(estados[e].m);
      for (let i = 0; i < 3 * k + e + 7; i++) uniforme(q.rng);
      q.humanos = [];
      const ta = (e + k) % 2, la = q.ataca[ta];
      const ult = q.jogadores.find(o => o.time === 1 - ta && o.posicao !== 'GOL');
      q.posse = null; q.naMao = null; q.voo = null;
      Object.assign(q.bola.p, { x: la * (MX + 0.6), y: 0.11, z: (k % 2 ? 1 : -1) * (6 + (e % 3) * 4) }); Object.assign(q.bola.v, { x: 0, y: 0, z: 0 });
      q.partida.ultimoTime = 1 - ta; q.partida.ultimoId = ult.id; q.partida.ultimoTick = q.tick;
      q.ultimoToque = { id: ult.id, time: 1 - ta, tick: q.tick };
      const g = goleiroDe(q, 1 - ta);
      const reg = { fonte: 'escanteio', res: 'semCena', gkToca: false, gkModo: null, chute: false, gol: false, cab: false, desce: null, gkPre: null };
      let t0 = null;
      for (let i = 0; i < 60 * 16; i++) {
        const ev = P.passoPartida(q, P.entradaDemoPartida(q));
        for (const e2 of ev) {
          const j = e2.id != null ? jog(q, e2.id) : null;
          if (e2.tipo === 'cobranca' && e2.parada === 'escanteio' && t0 == null) {
            t0 = q.tick; reg.res = 'ok';
            reg.gkPre = { prof: Math.abs(gxDe(q, g) - g.x), z: g.z * Math.sign(q.bola.p.z || 1) };
            // onde a bola desce para a cabeça (≤ 2,4 m), pela física do jogo
            const t = B.criarBola(0, 0); Object.assign(t.p, q.bola.p); Object.assign(t.v, q.bola.v); Object.assign(t.w, q.bola.w); t.rolando = q.bola.rolando;
            let yAnt = t.p.y;
            for (let n = 1; n < 150; n++) {
              B.passoBola(t, null);
              if (t.p.y < 2.4 && t.p.y < yAnt) { reg.desce = { dLinha: Math.abs(gxDe(q, g) - t.p.x), z: t.p.z, tick: n, dGk: Math.hypot(t.p.x - g.x, t.p.z - g.z) }; break; }
              yAnt = t.p.y;
            }
          }
          if (t0 == null) continue;
          if (j && j.id === g.id && (e2.tipo === 'defesa' || e2.tipo === 'bateuCorpo') && !reg.gkToca) { reg.gkToca = true; reg.gkModo = e2.modo ?? e2.tipo; }
          // a saída no alto (o goleiro sai no cruzamento: encaixe ou soco) e a que falhou
          if (j && j.id === g.id && e2.tipo === 'saidaGoleiro' && e2.modo === 'cruzamento') reg.gkSai = true;
          if (j && j.id === g.id && e2.tipo === 'defesa' && e2.saidaAlta && !reg.gkAlto) reg.gkAlto = e2.modo;
          if (j && j.id === g.id && e2.tipo === 'saidaFalhou') reg.gkFalhou = true;
          if (j && j.time === ta && M.ehChute(q, e2) && !reg.chute && q.tick - t0 < 8 * 60) { reg.chute = true; reg.cab = e2.tipo === 'passe'; Object.assign(reg, { leit: leitura(q, g) }); }
          if (e2.tipo === 'gol' && q.tick - t0 < 8 * 60) reg.gol = e2.time === ta;
        }
        if (t0 != null && (q.tick - t0 > 8 * 60 || q.partida.estado === 'gol' || reg.gol)) break;
      }
      canhao.push(reg);
    }
  }
  // movimento: resumo
  const movR = mov.map(R => {
    const v = R.v.slice().sort((a, b) => a - b);
    const p = f => v.length ? v[Math.min(v.length - 1, Math.floor(f * v.length))] : 0;
    return { ticks: R.ticks, p50: p(0.5), p90: p(0.9), p99: p(0.99), acimaDe3: R.acimaDe3, acimaDe4: R.acimaDe4, inv: R.inv, lateral: R.lateral, cruz: R.cruz, saltoPos: R.saltoPos, saltoRumo: R.saltoRumo, erroAlvo: R.erroAlvo, armado: R.armado, armadoSet: R.armadoSet };
  });
  return { sem, naturais, canhao, mov: movR, esc, cruz, saidas, gols: [m.placar[0], m.placar[1]] };

  // ------------------------------------------------------------------ auxiliares do filho
  function sorteador(s0) { let s = (s0 >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function dispararChute(q, a, gx, zt, yt, v) {
    const b = q.bola;
    const dx = gx - b.p.x, dz = zt - b.p.z, dh = Math.hypot(dx, dz), ux = dx / dh, uz = dz / dh;
    const yEm = el => {
      const t = B.criarBola(b.p.x, b.p.z); t.p.y = b.p.y;
      if (el <= 0) B.chutarRasteiro(t, ux * v, uz * v);
      else { B.chutar(t, { x: ux * v * Math.cos(el), y: v * Math.sin(el), z: uz * v * Math.cos(el) }, { x: 0, y: 0, z: 0 }); t.rolando = false; }
      const c = GK.preverPassagem(t, gx, 200);
      return c ? c.y : -1;
    };
    let el = 0;
    if (yt > 0.25) {
      let lo = 0.001, hi = 0.75;
      for (let n = 0; n < 26; n++) { const mid = (lo + hi) / 2; if (yEm(mid) < yt) lo = mid; else hi = mid; }
      el = (lo + hi) / 2;
    }
    q.posse = null; q.naMao = null;
    if (el <= 0) { b.p.y = 0.11; B.chutarRasteiro(b, ux * v, uz * v); }
    else { B.chutar(b, { x: ux * v * Math.cos(el), y: v * Math.sin(el), z: uz * v * Math.cos(el) }, { x: 0, y: 0, z: 0 }); b.rolando = false; }
    const c = a.cond;
    if (c) { c.toque = null; c.busca = false; c.longeDesde = -1; c.ult = { tick: q.tick, pe: 0, bx: b.p.x, bz: b.p.z, dx: ux, dz: uz, v, tipo: 'chute' }; }
    a.pedido = null; a.carga = null;
    q.ultimoToque = { id: a.id, time: a.time, tick: q.tick };
    RG.registrarChute(q, a, 'chute');
    q.voo = { tipo: 'chute', de: a.id, time: a.time, para: null, alvo: { x: gx, z: zt }, tick0: q.tick, tickChave: q.tick, tickChegada: q.tick, alto: b.v.y > 1.5 };
  }

  /** Geometria do chute que acabou de sair: no plano do goleiro e na linha do gol. */
  function geometria(q, g) {
    const b = q.bola, gx = gxDe(q, g);
    const linha = GK.preverPassagem(b, gx, 200);
    const xPl = Math.abs(g.x - gx) > 0.3 ? g.x : gx - Math.sign(gx) * 0.3;
    const plano = GK.preverPassagem(b, xPl, 200) ?? linha;
    const vb = Math.hypot(b.v.x, b.v.y, b.v.z);
    if (!linha || !plano) return { vb, noAlvo: false };
    const noAlvo = Math.abs(linha.z) < MEIO - 0.05 && linha.y < CAMPO.gol.altura - 0.05;
    return {
      vb, noAlvo, zLinha: linha.z, yLinha: linha.y, lat: Math.abs(plano.z - g.z), yPl: plano.y, tVoo: plano.ticks * PASSO,
      vPl: plano.v, dTrave: MEIO - Math.abs(linha.z), gz0: g.z, gx0: g.x,
    };
  }

  /** A leitura do goleiro neste passo (lerChute já rodou): j.defesa e o evento leituraGoleiro. */
  function leitura(q, g) {
    const d = g.defesa, le = q.eventos.find(e => e.tipo === 'leituraGoleiro' && e.id === g.id);
    return {
      p: le ? le.p : null, chega: le ? le.chega : null, dFora: d ? !!d.fora : null, semMao: d ? !!d.semMao : null,
      folga: le && le.folga != null ? le.folga : null, corpo: le ? !!le.corpo : null, tPl: le && le.t != null ? le.t : null,
      dTipo: d ? d.tipo : null, dSucesso: d ? d.sucesso : null, mergulha: d ? !!d.mergulha : null, recuo: d ? !!d.recuo : null,
    };
  }

  /** 1×1: chutador na área, nenhum defensor de linha no triângulo bola–traves nem a ≤ 2 m dele. */
  function umXum(q, a, g) {
    const gx = gxDe(q, g), b = q.bola;
    if (Math.abs(b.p.x - gx) > 16.5 || Math.abs(b.p.z) > 20.16) return false;
    for (const o of q.jogadores) {
      if (o.time === a.time || o.posicao === 'GOL') continue;
      if (Math.hypot(o.x - b.p.x, o.z - b.p.z) < 2) return false;
      // dentro do triângulo (bola, trave 1, trave 2)?
      const s = (px, pz, ax, az, bx, bz) => (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
      const d1 = s(o.x, o.z, b.p.x, b.p.z, gx, -MEIO - 0.5), d2 = s(o.x, o.z, gx, -MEIO - 0.5, gx, MEIO + 0.5), d3 = s(o.x, o.z, gx, MEIO + 0.5, b.p.x, b.p.z);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) return false;
    }
    return true;
  }

  /** Desfecho do chute e o que vem depois da defesa (espalmada: para onde, quem pega, rebote). */
  function acompanhar(q, r, ev) {
    const g = jog(q, r.gk);
    const dt = q.tick - r.tick;
    if (g && g.mergulho && r.mTipo === undefined && g.mergulho.tick0 >= r.tick) { r.mTipo = g.mergulho.tipo; r.rebaixada = !!g.mergulho.rebaixada; }
    for (const e of ev) {
      const j = e.id != null ? jog(q, e.id) : null;
      if (!r.res) {
        if (e.tipo === 'gol') {
          r.res = e.time === r.time ? 'gol' : 'contra'; r.fim = true;
          // a bola passou pelo corpo do goleiro? (no plano dele, a < 0,35 m do centro e abaixo de 1,7 m)
          r.peloCorpo = r.cruzouGk ? r.cruzouGk.d < 0.35 && r.cruzouGk.y < 1.7 : null;
        } else if (e.tipo === 'defesa' && j && j.id === r.gk) { r.res = 'defesa'; r.modo = e.modo; r.tDef = dt; }
        else if (e.tipo === 'bateuCorpo' && j && j.id !== r.gk && j.id !== q.voo?.de && dt > 0) { r.res = 'bloqueado'; r.fim = true; }
        else if (e.tipo === 'trave') r.trave = true;
        else if (e.tipo === 'fora') { r.res = 'fora'; r.fim = true; }
      } else if (r.res === 'defesa' && !r.fim) {
        if (e.tipo === 'fora') { r.depois = Math.abs(q.bola.p.x) > MX ? 'linhaDeFundo' : 'lateral'; r.fim = true; }
        else if (e.tipo === 'gol') { r.golRebote = e.time === r.time; r.depois ??= 'gol'; r.fim = true; }
        else if (j && j.time === r.time && M.ehChute(q, e) && !r.reboteChute) r.reboteChute = true;
      }
    }
    // a bola cruzando o plano do goleiro (para o "passou pelo corpo")
    // (interpolado entre o tick de antes e o de agora: a bola cruzada passa até ~0,25 m de lado num tick)
    if (!r.res && g && r.cruzouGk == null && r.gx0 != null) {
      const s = Math.sign(gxDe(q, g)), b = q.bola.p;
      if ((b.x - g.x) * s >= 0) {
        const a = r.bolaAnt;
        const f = a && (b.x - a.x) !== 0 ? Math.min(1, Math.max(0, (g.x - a.x) / (b.x - a.x))) : 1;
        const z = a ? a.z + (b.z - a.z) * f : b.z, y = a ? a.y + (b.y - a.y) * f : b.y;
        r.cruzouGk = { d: Math.abs(z - g.z), y };
      }
      r.bolaAnt = { x: b.x, y: b.y, z: b.z };
    }
    if (r.res === 'defesa' && !r.fim) {
      if (r.modo !== 'espalmada') { r.fim = true; return; }
      const dtd = dt - r.tDef;
      if (dtd === 1) { r.vEsp = Math.hypot(q.bola.v.x, q.bola.v.z); r.vyEsp = q.bola.v.y; }
      if (dtd === 60) {
        const gx = g ? gxDe(q, g) : 0;
        r.zona1s = Math.abs(gx - q.bola.p.x) < 11 && Math.abs(q.bola.p.z) < 9;
      }
      const dono = M.donoDaBola(q);
      if (dono && r.pega == null) r.pega = dono.time === r.time ? 'ataque' : dono.id === r.gk ? 'goleiro' : 'defesa';
      if (dtd > 180) { r.depois ??= r.pega ? 'emJogo' : 'solta'; r.fim = true; }
    }
    if (!r.res && dt > 240) { r.res = 'fora'; r.fim = true; }
  }
}
