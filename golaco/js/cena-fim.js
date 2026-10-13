// Cenas do FIM DE TEMPO (pedido do dono de 12/10: "temos que ter cenas de final de primeiro tempo, final de segundo
// tempo"). PURAS: sem three.js nem DOM, sem m.rng e sem Math.random — testadas em Node (tools/teste-cenas.mjs, seção C)
// e desenhadas pela página (main.js) no lugar dos jogadores da simulação. A simulação não muda: no intervalo o laço fica
// PARADO no tick do apito durante P1–P4 e é solto no P5 (os 3 s de PARTIDA.intervalo, o campo vazio atrás da faixa
// "Intervalo"); no fim do jogo nada é segurado (o mundo já está em 'fim') e a cena termina parada no plano geral, viva
// (os atores respirando), atrás da faixa "Fim de jogo". Contrato em CONTRATOS.md; pesquisa em PESQUISA-CENAS.md;
// constantes em config.js CENA_FIM.
//
// Os 22 são COPIADOS no tick do apito (cena-atores.js), com o árbitro (200, perto da jogada) e os dois assistentes (201,
// 202, na linha lateral, um em cada metade). Todos desaceleram pela locomoção (ninguém para de uma vez).
// Intervalo: 'apito' (o árbitro apita e aponta o túnel) → 'campo' (mãos na cintura, um ou dois com as mãos nos joelhos,
// os pares de adversários mais perto se cumprimentam, o trio se junta) → 'tunel' (ELIPSE: os dois times num funil a
// 8–25 m do túnel, andando para ele; quem perde cabisbaixo, quem ganha conversando) → 'torcida' (palmas se a casa ganha
// ou empata, vaia se perde) → 'geral' (campo vazio, faixa, laço solto).
// Fim do jogo: 'apito' (aponta o meio-campo) → 'vencedor' (os dois braços para o céu, socos, pulos e o abraço em grupo;
// o goleiro vem correndo) → 'perdedor' (agachados, mãos na cabeça e nos joelhos, cabisbaixos; um levanta o outro) — no
// empate, 'neutro' (mãos na cintura e cumprimentos) — → 'cumprimentos' (≥ 3 apertos entre adversários e 1 com o
// árbitro) → 'treinador' (GANCHO: só com os atores do treinador; sem eles o plano sai sem deixar buraco) → 'aplauso'
// (ELIPSE: o time do humano a 8–10 m da própria torcida, andando para ela batendo palmas acima da cabeça) → 'torcida'
// (festa, palmas ou vaia) → 'geral' (até "Jogar de novo"). Nada é alocado por tick.
import { PASSO, CAMPO, CENA_FIM, CENAS, CAMERA_GERAL } from './config.js';
import {
  criarBase, adicionarJogador, adicionarArbitro, adicionarNovo, poseInicial, recriarAtor, soltar, para, irPara, parar,
  desviar, passoAtores, tempoDe, planoNoTempo, hashGol, camValida, melhorCamera, definirPlano, definirPlanoGrupo,
  criarPlanoCena, clamp, suave, lerp, janela, s60, J, moverTudo, gApito, gAponta, gCintura, gJoelhos, gAperto, gCeu, gSoco,
  gCabeca, gTapinha, gPalmasAlto, posturaCabisbaixo, posturaAgachado,
} from './cena-atores.js';
import { cameraDoPlano } from './prejogo-roteiro.js';

const K = CENA_FIM;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const TUNEL = CENAS.tunel;

// ------------------------------------------------------------------------------------------------ plano
/**
 * Plano da cena (só LÊ o mundo). tipo = 'intervalo' | 'fimDeJogo'. opc = {placar ({0, 1}; padrão m.placar),
 * timeHumano (0), treinadores ({0: {id, time, x, z, rumo, kit} | null, 1: ...} — o gancho; sem eles o plano do treinador
 * sai)}. Devolve {tick, tipo, resultado ('intervalo' | 'vitoria' | 'empate'), vencedor (0 | 1 | null), placar, planos
 * [{nome, t0, t1}], duracao (até o plano geral), geral (s do plano geral; 0 = até o fim), arb {x, z}, pares, ...}.
 */
export function planejarFim(m, tipo, opc = {}) {
  const pl = opc.placar ?? m.placar ?? { 0: 0, 1: 0 };
  const g0 = pl[0] ?? 0, g1 = pl[1] ?? 0;
  const vencedor = g0 > g1 ? 0 : g1 > g0 ? 1 : null;
  const resultado = tipo === 'intervalo' ? 'intervalo' : vencedor == null ? 'empate' : 'vitoria';
  const tr = opc.treinadores ?? null;
  const temTreinador = tipo !== 'intervalo' && !!tr && !!(tr[0] || tr[1]);
  const def = K.planos[resultado];
  const planos = [];
  let t = 0, geral = 0;
  for (const [nome, d] of def) {
    if (nome === 'treinador' && !temTreinador) continue;
    if (nome === 'geral') { geral = d; planos.push({ nome, t0: t, t1: d > 0 ? t + d : Infinity }); continue; }
    planos.push({ nome, t0: t, t1: t + d });
    t += d;
  }
  // o árbitro: perto da jogada (8 m da bola na direção do meio), dentro do campo e longe de todo mundo
  const b = m.bola.p;
  let ax = b.x * 0.85, az = b.z * 0.8;
  const l = Math.hypot(b.x, b.z);
  if (l > 9) { ax = b.x - (b.x / l) * 8; az = b.z - (b.z / l) * 8; }
  for (let it = 0; it < 30; it++) {
    let perto = null, dm = 1.6;
    for (const j of m.jogadores) { const d = Math.hypot(j.x - ax, j.z - az); if (d < dm) { dm = d; perto = j; } }
    if (!perto) break;
    const dx = ax - perto.x, dz = az - perto.z, d = Math.hypot(dx, dz) || 1;
    ax += (dx / d) * 0.8; az += (dz / d) * 0.8;
  }
  ax = clamp(ax, -MX + 3, MX - 3); az = clamp(az, -MZ + 3, MZ - 3);
  // pares de adversários para o aperto de mão (os mais perto primeiro; ≤ maxDist, ou a folga se faltar)
  const A = K.aperto;
  const js = m.jogadores.filter(j => j.posicao !== 'GOL');
  const cand = [];
  for (const a of js) for (const c of js) if (a.time === 0 && c.time === 1) cand.push({ a: a.id, b: c.id, d: Math.hypot(a.x - c.x, a.z - c.z) });
  cand.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const usados = new Set(), pares = [];
  for (const lim of [A.maxDist, A.maxDistFolga]) {
    for (const p of cand) {
      if (pares.length >= A.pares) break;
      if (p.d > lim || usados.has(p.a) || usados.has(p.b)) continue;
      usados.add(p.a); usados.add(p.b); pares.push(p);
    }
    if (pares.length >= 3) break;
  }
  const h = hashGol(m.tick, 200 + (tipo === 'intervalo' ? 1 : 2));
  return {
    tick: m.tick, tipo, resultado, vencedor, placar: { 0: g0, 1: g1 }, planos, duracao: t, geral, arb: { x: ax, z: az }, pares,
    timeHumano: opc.timeHumano ?? 0, treinadores: temTreinador ? tr : null, hash: h, ataca: { ...m.ataca },
  };
}

// ------------------------------------------------------------------------------------------------ cena
/** Cena a partir do mundo no tick do apito (só LÊ o mundo: cópias). */
export function criarCenaFim(plano, m) {
  const c = criarBase(m);
  c.plano = plano;
  c.kFim = s60(plano.duracao);
  c.kGeral = plano.geral > 0 ? s60(plano.duracao + plano.geral) : Infinity;
  for (const j of m.jogadores) {
    const a = adicionarJogador(c, j, plano.vencedor == null ? 'neutro' : j.time === plano.vencedor ? 'vencedor' : 'perdedor');
    a.cede = 0.8;
  }
  const arb = adicionarArbitro(c, CENAS.idArbitro, plano.arb.x, plano.arb.z, Math.atan2(-plano.arb.z, -plano.arb.x));
  arb.cede = 0.3; arb.podeFixar = false;
  c.arbitro = arb;
  c.assistentes = CENAS.assistentes.map(([x, z], i) => {
    const a = adicionarArbitro(c, CENAS.idAssistentes[i], x, z, Math.atan2(-z, -x) , 'assistente');
    a.cede = 0.3;
    return a;
  });
  // treinadores (o gancho): só no fim do jogo, com os atores vindos da página
  c.treinadores = [];
  if (plano.treinadores) for (const t of [0, 1]) {
    const o = plano.treinadores[t];
    if (!o) continue;
    const a = adicionarNovo(c, o, 'treinador');
    a.podeFixar = false; a.cede = 0.3; a.timeT = t;
    c.treinadores.push(a);
  }
  // papéis: os pares do aperto de mão, quem fica com as mãos nos joelhos, o grupo do vencedor e o do perdedor
  c.pares = plano.pares.map((p, k) => ({ a: c.porId.get(p.a), b: c.porId.get(p.b), k, t0: -1, feito: false })).filter(p => p.a && p.b);
  for (const p of c.pares) { p.a.par = p; p.b.par = p; }
  const livres = c.atores.filter(a => (a.tipo === 'vencedor' || a.tipo === 'perdedor' || a.tipo === 'neutro') && !a.par && !a.goleiro);
  livres.sort((x, y) => (hashGol(plano.tick, x.id) % 997) - (hashGol(plano.tick, y.id) % 997));
  for (let k = 0; k < Math.min(K.joelhos, livres.length); k++) livres[k].joelhos = true;
  c.grupoV = null; c.grupoP = null;
  if (plano.resultado === 'vitoria') montarGrupos(c);
  for (const a of c.atores) poseInicial(c, a);
  c.ip = -1;
  entrarPlano(c, 0);
  return c;
}

/**
 * Fim com vencedor: o grupo da festa (o vencedor de linha mais perto do meio e até 5 companheiros mais perto dele; o
 * goleiro vem correndo) e o do lamento (os 4 perdedores mais perto do meio do campo; o 1º agacha, o 2º o levanta).
 */
function montarGrupos(c) {
  const P = c.plano;
  const v = c.atores.filter(a => a.tipo === 'vencedor' && !a.goleiro && !a.par);
  const p = c.atores.filter(a => a.tipo === 'perdedor' && !a.goleiro && !a.par);
  const meio = a => Math.hypot(a.j.x, a.j.z * 1.2);
  v.sort((x, y) => meio(x) - meio(y) || x.id - y.id);
  p.sort((x, y) => meio(x) - meio(y) || x.id - y.id);
  if (v.length) {
    const foco = v[0];
    const resto = v.slice(1).sort((x, y) => Math.hypot(x.j.x - foco.j.x, x.j.z - foco.j.z) - Math.hypot(y.j.x - foco.j.x, y.j.z - foco.j.z) || x.id - y.id).slice(0, 5);
    c.grupoV = { foco, membros: resto, x: foco.j.x, z: foco.j.z };
    foco.festa = 0; foco.podeFixar = false;
    resto.forEach((a, i) => { a.festa = i + 1; a.podeFixar = false; });
    const gk = c.atores.find(a => a.tipo === 'vencedor' && a.goleiro);
    if (gk) { gk.corre = true; gk.podeFixar = false; }
  }
  if (p.length >= 2) {
    c.grupoP = { membros: p.slice(0, 4) };
    p.slice(0, 4).forEach((a, i) => { a.lamento = i; a.podeFixar = false; });
  }
  void P;
}

// ------------------------------------------------------------------------------------------------ desejos
const _q = { x: 0, z: 0 };
function tPlano(c, nome) { const p = c.plano.planos.find(q => q.nome === nome); return p ? p.t0 : null; }

function desejo(c, a, t) {
  const P = c.plano, arb = c.arbitro.j, j = a.j;
  const tTunel = tPlano(c, 'tunel'), tCump = tPlano(c, 'cumprimentos'), tApl = tPlano(c, 'aplauso');
  // depois da elipse do túnel (intervalo): todos andam para a boca do túnel (a frente do vão primeiro)
  if (c.noTunel) return andarTunel(c, a);
  if (c.noAplauso && a.aplaude) return irPara(c, a, a.alvoX, a.alvoZ, 1.25, a.rumoAlvo, 0.2, 1.2);
  if (a === c.arbitro) {
    if (P.resultado === 'intervalo' || t < (tCump ?? Infinity)) return parar(c, a, 0, TUNEL.z);
    return parar(c, a, j.x - 1, j.z);
  }
  if (a.tipo === 'assistente') {
    // o trio se junta: os assistentes andam para perto do árbitro
    if (t < 1.2) return parar(c, a, arb.x, arb.z);
    const dx = arb.x - j.x, dz = arb.z - j.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, d - 2.2);
    return desviar(c, a, irPara(c, a, j.x + (dx / d) * Math.min(k, 30), j.z + (dz / d) * Math.min(k, 30), K.velAnda, Math.atan2(dz, dx), 0.3, 1.2));
  }
  if (a.tipo === 'treinador') return parar(c, a, 0, 0);
  // o jogador que cumprimenta o árbitro no fim: vai até ele (0,86 m), de frente
  if (a.vaiArbitro) {
    const dx = arb.x - j.x, dz = arb.z - j.z, d = Math.hypot(dx, dz) || 1, meia = K.aperto.dist;
    return desviar(c, a, irPara(c, a, arb.x - (dx / d) * meia, arb.z - (dz / d) * meia, K.velAnda + 0.4, Math.atan2(dz, dx), 0.03, 1.4));
  }
  // os pares do aperto de mão: andam um para o outro (a partir de 1,0 s; os do fim, a partir do 'cumprimentos' − 2 s)
  if (a.par) {
    const p = a.par, o = p.a === a ? p.b : p.a;
    const t0 = P.resultado === 'intervalo' || P.resultado === 'empate' ? 1.0 : Math.max(1.0, (tCump ?? 7) - 2.6);
    if (t < t0 || p.feito) return parar(c, a, o.j.x, o.j.z);
    const mx = (j.x + o.j.x) / 2, mz = (j.z + o.j.z) / 2, dx = o.j.x - j.x, dz = o.j.z - j.z, d = Math.hypot(dx, dz) || 1;
    const meia = K.aperto.dist / 2;
    return irPara(c, a, mx - (dx / d) * meia, mz - (dz / d) * meia, K.velAnda, Math.atan2(dz, dx), 0.03, 1.4);
  }
  // fim com vencedor: o grupo da festa (abraço em volta do foco; o goleiro vem correndo)
  if (P.resultado === 'vitoria' && t >= 1.6 && t < (tCump ?? 99)) {
    const G = c.grupoV;
    if (G && a.festa != null && a.festa > 0) {
      const f = G.foco.j, k = a.festa - 1, n = G.membros.length;
      const ang = Math.atan2(-f.z, -f.x) + (k - (n - 1) / 2) * 0.95;
      const vx = f.x + Math.cos(ang) * 0.78, vz = f.z + Math.sin(ang) * 0.78;
      return desviar(c, a, irPara(c, a, vx, vz, Math.hypot(vx - j.x, vz - j.z) > 4 ? 4.2 : 2.2, Math.atan2(f.z - j.z, f.x - j.x), 0.1, 3));
    }
    if (a.corre && G) {
      const f = G.foco.j, dx = f.x - j.x, dz = f.z - j.z, d = Math.hypot(dx, dz) || 1;
      return irPara(c, a, f.x - (dx / d) * 1.6, f.z - (dz / d) * 1.6, t > 2.2 ? 5.5 : 1.2, null, 0.4, 3);
    }
  }
  // o lamento: o 2º do grupo vai até o 1º (agachado) para levantá-lo
  if (P.resultado === 'vitoria' && a.lamento === 1 && c.grupoP && t >= tPlano(c, 'perdedor') - 0.6) {
    const o = c.grupoP.membros[0].j, dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz) || 1;
    return irPara(c, a, o.x - (dx / d) * 0.62, o.z - (dz / d) * 0.62, 2.4, Math.atan2(dz, dx), 0.05, 2);
  }
  void tTunel; void tApl;
  return parar(c, a, arb.x, arb.z);
}

/** No funil do túnel (intervalo): anda para a frente do vão das placas e depois para a boca do túnel. */
function andarTunel(c, a) {
  const j = a.j;
  const wx = clamp(j.x * 0.3, -1.6, 1.6), wz = 39.5;
  const x = j.z < wz - 0.6 ? wx : TUNEL.x, z = j.z < wz - 0.6 ? wz : TUNEL.z + 3;
  return desviar(c, a, irPara(c, a, x, z, a.velTunel ?? K.velAnda, null, 0.2, 1.2));
}

// ------------------------------------------------------------------------------------------------ gestos
function gestos(c, a, t) {
  const P = c.plano, o = a.atu, h = a.j.rumo;
  const tCampo = tPlano(c, 'campo'), tVenc = tPlano(c, 'vencedor'), tPerd = tPlano(c, 'perdedor'), tNeutro = tPlano(c, 'neutro');
  const tCump = tPlano(c, 'cumprimentos'), tApl = tPlano(c, 'aplauso'), tTr = tPlano(c, 'treinador');
  if (a === c.arbitro) {
    gApito(o, h, janela(t, 0.08, 0.9, 0.12, 0.2));
    const alvoX = P.tipo === 'intervalo' ? TUNEL.x : 0, alvoZ = P.tipo === 'intervalo' ? TUNEL.z : 0;
    gAponta(o, h, 1, alvoX, P.tipo === 'intervalo' ? 2 : 0.3, alvoZ, janela(t, 0.95, 2.6, 0.2, 0.3));
    apertoArbitro(c, a, t);
    return;
  }
  if (a.tipo === 'assistente') return;
  if (a.tipo === 'treinador') { gestosTreinador(c, a, t, tTr); return; }
  if (c.noTunel) {
    if (a.cabisbaixo) posturaCabisbaixo(o, h, 1);
    else if (a.conversa != null) conversar(c, a);
    return;
  }
  if (c.noAplauso && a.aplaude) { gPalmasAlto(o, h, t, suave((t - tApl - 0.2) / 0.35)); return; }
  // o aperto de mão (os pares)
  if (a.vaiArbitro && c.parArbitro && c.parArbitro.t0 >= 0) {
    const p = c.parArbitro, w = janela(t, p.t0, p.t0 + 1.0, 0.25, 0.3);
    if (w > 0) {
      const pa = a.atu, pb = c.arbitro.atu, pe = J.pelve * 3;
      const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0));
      gAperto(pa, a.j.rumo, (pa[pe] + pb[pe]) / 2, my, (pa[pe + 2] + pb[pe + 2]) / 2, w);
      return;
    }
  }
  if (a.par) { aperto(c, a, t); if (!a.par.ativo) cintura(c, a, t); return; }
  if (P.resultado === 'intervalo' || P.resultado === 'empate') {
    // mãos na cintura (ou nos joelhos) depois do apito, enquanto o plano é de campo
    const t0 = 1.0, t1 = P.resultado === 'intervalo' ? tCampo + 2.5 + 0.1 : tNeutro + 3.0 + 0.6;
    if (a.joelhos) gJoelhos(o, a.j, janela(t, t0 + 0.4, t1, 0.5, 0.4));
    else gCintura(o, h, janela(t, t0, t1, 0.45, 0.4));
    return;
  }
  // vitória: a festa do grupo (os dois braços para o céu, socos e pulos) e o lamento
  if (a.festa != null) { festa(c, a, t, tVenc); return; }
  if (a.corre) { gCeu(o, h, janela(t, tVenc + 0.6, tCump, 0.3, 0.4)); return; }
  if (a.lamento != null) { lamento(c, a, t, tPerd, tCump); return; }
  if (a.tipo === 'vencedor') { gSoco(o, h, a.id % 2 ? 1 : -1, janela(t, tVenc + 0.4, tCump, 0.4, 0.4)); return; }
  if (a.tipo === 'perdedor') {
    if (a.joelhos) gJoelhos(o, a.j, janela(t, 1.2, tCump + 1.5, 0.5, 0.4));
    else { posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3)); gCintura(o, h, janela(t, 1.0, tCump, 0.5, 0.4)); }
  }
}

/** Mãos na cintura (os pares antes e depois do aperto). */
function cintura(c, a, t) {
  const P = c.plano;
  if (P.resultado === 'vitoria') return;
  gCintura(a.atu, a.j.rumo, janela(t, 1.0, 1e9, 0.45, 0.3) * (a.par && a.par.ativo ? 0 : 1));
}

/** O aperto de mão de um par: as mãos direitas no meio dos dois (a ~1,06 m), sacudindo duas vezes. */
function aperto(c, a, t) {
  const p = a.par, o = p.a === a ? p.b : p.a;
  const d = Math.hypot(a.j.x - o.j.x, a.j.z - o.j.z);
  const tMin = c.plano.resultado === 'vitoria' ? (tPlano(c, 'cumprimentos') ?? 7) - 1.6 : 1.0;
  if (!p.feito && p.t0 < 0 && t >= tMin && d >= 0.8 && d <= K.aperto.dist + 0.12 && Math.hypot(a.j.vx, a.j.vz) < 0.35 && Math.hypot(o.j.vx, o.j.vz) < 0.35) p.t0 = t;
  const dur = 1.0;
  p.ativo = p.t0 >= 0 && t < p.t0 + dur + 0.3;
  if (p.t0 >= 0 && t > p.t0 + dur + 0.3) p.feito = true;
  if (p.t0 < 0) return;
  const w = janela(t, p.t0, p.t0 + dur, 0.25, 0.3);
  if (w <= 0) return;
  // o ponto: o meio das duas pelves, a ~1,06 m, sacudindo
  const pa = a.atu, pb = o.atu, pe = J.pelve * 3;
  const mx = (pa[pe] + pb[pe]) / 2, mz = (pa[pe + 2] + pb[pe + 2]) / 2;
  const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0)) * suave((t - p.t0) / 0.3);
  gAperto(pa, a.j.rumo, mx, my, mz, w);
}

/** O árbitro cumprimenta um jogador no fim (o 1º do par que já apertou a mão chega nele). */
function apertoArbitro(c, a, t) {
  const p = c.parArbitro;
  if (!p || p.t0 < 0) return;
  const w = janela(t, p.t0, p.t0 + 1.0, 0.25, 0.3);
  if (w <= 0) return;
  const o = p.jog, pa = a.atu, pb = o.atu, pe = J.pelve * 3;
  const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0));
  gAperto(pa, a.j.rumo, (pa[pe] + pb[pe]) / 2, my, (pa[pe + 2] + pb[pe + 2]) / 2, w);
}

/** A festa do vencedor: os dois braços para o céu, depois socos alternados; o foco pula. */
function festa(c, a, t, tVenc) {
  const o = a.atu, h = a.j.rumo, k = a.festa;
  const w = janela(t, tVenc + 0.1 + 0.08 * k, tPlano(c, 'cumprimentos') ?? 99, 0.3, 0.4);
  if (w <= 0) return;
  if (k % 3 === 2) { gSoco(o, h, -1, w, 0.08 * Math.sin(2 * Math.PI * 2.2 * t)); gSoco(o, h, 1, w, -0.08 * Math.sin(2 * Math.PI * 2.2 * t)); }
  else gCeu(o, h, w);
  // pulos do grupo (os pés saem do chão: a régua do pé plantado não vale aqui, como no pulo do grupo da comemoração),
  // só parado no lugar dele
  const G = c.grupoV, f = G ? G.foco.j : null;
  const noLugar = k === 0 ? Math.hypot(a.j.vx, a.j.vz) < 0.3 : f && Math.hypot(a.j.x - f.x, a.j.z - f.z) < 1.0 && Math.hypot(a.j.vx, a.j.vz) < 0.4;
  if (noLugar && w > 0.5) {
    const sn = Math.sin(2 * Math.PI * 1.8 * (t - tVenc));
    const dy = sn > 0 ? 0.13 * sn * w : 0;
    if (dy > 0) { moverTudo(o, dy); a.noAr = true; }
  }
}

/** O lamento do perdedor: o 1º agachado com as mãos na cabeça (levantado pelo 2º), o 3º com as mãos nos joelhos, o 4º cabisbaixo com as mãos na cabeça. */
function lamento(c, a, t, tPerd, tCump) {
  const o = a.atu, h = a.j.rumo, i = a.lamento;
  if (i === 0) {
    // agacha no apito e levanta quando o companheiro chega (a mão nas costas)
    const lev = c.levantou ?? Infinity;
    const w = janela(t, 1.0, Math.min(lev + 0.6, tCump), 0.6, 0.6);
    posturaAgachado(o, a.j, w);
    gCabeca(o, h, w);
    posturaCabisbaixo(o, h, Math.max(w, janela(t, 1.0, 1e9, 0.5, 0.5) * 0.8));
  } else if (i === 1) {
    const ag = c.grupoP.membros[0];
    const d = Math.hypot(a.j.x - ag.j.x, a.j.z - ag.j.z);
    const w = suave((1.0 - d) / 0.3) * janela(t, tPerd - 0.4, tCump, 0.2, 0.3);
    if (w > 0.9 && c.levantou == null) c.levantou = t;
    gTapinha(o, h, -1, ag.atu, ag.j.rumo, t, w);
    posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3) * (1 - w));
  } else if (i === 2) gJoelhos(o, a.j, janela(t, 1.0, tCump + 1.0, 0.5, 0.4));
  else { gCabeca(o, h, janela(t, 1.0, tCump, 0.5, 0.4)); posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3)); }
}

/** Conversando no túnel: a cabeça virada para o vizinho (o rumo do corpo segue o caminho). */
function conversar(c, a) {
  const o = a.atu, viz = c.atores[a.conversa];
  if (!viz) return;
  const ic = J.cabeca * 3, ip = J.pescoco * 3;
  const dx = viz.j.x - a.j.x, dz = viz.j.z - a.j.z, d = Math.hypot(dx, dz) || 1;
  const hx = o[ic] - o[ip], hy = o[ic + 1] - o[ip + 1], hz = o[ic + 2] - o[ip + 2];
  const lh = Math.hypot(hx, hz);
  o[ic] = o[ip] + (dx / d) * lh * 0.9 + hx * 0.1; o[ic + 2] = o[ip + 2] + (dz / d) * lh * 0.9 + hz * 0.1; o[ic + 1] = o[ip + 1] + hy;
}

/** O treinador (gancho): o do vencedor comemora (3 socos no ar ou os braços para o céu); o outro fica. */
function gestosTreinador(c, a, t, tTr) {
  if (tTr == null) return;
  const venceu = c.plano.vencedor === a.timeT;
  if (!venceu) return;
  const o = a.atu, h = a.j.rumo, w = janela(t, tTr + 0.1, tTr + 2.0, 0.2, 0.3);
  const s = Math.sin(2 * Math.PI * 1.5 * (t - tTr));
  gSoco(o, h, -1, w, 0.08 * s); gSoco(o, h, 1, w, 0.08 * s);
}

// ------------------------------------------------------------------------------------------------ passo e planos
/** Um tick (1/60 s). No fim do jogo a cena continua viva no plano geral (respirando) depois do último plano. */
export function passoCenaFim(c) {
  if (c.acabou) return false;
  passoAtores(c, desejo, gestos);
  const t = c.k * PASSO, P = c.plano;
  // o aperto com o árbitro (fim): o 1º jogador de um par que já terminou o aperto vai até ele
  if (P.tipo === 'fimDeJogo' && !c.parArbitro) {
    const tc = tPlano(c, 'cumprimentos');
    if (tc != null && t >= tc - 1.2) {
      const p = c.pares.find(q => q.feito) ?? c.pares[0];
      if (p) { c.parArbitro = { jog: p.a, t0: -1 }; p.a.vaiArbitro = true; soltar(p.a); }
    }
  }
  if (c.parArbitro && c.parArbitro.t0 < 0) {
    const jg = c.parArbitro.jog, d = Math.hypot(jg.j.x - c.arbitro.j.x, jg.j.z - c.arbitro.j.z);
    if (d <= K.aperto.dist + 0.12 && Math.hypot(jg.j.vx, jg.j.vz) < 0.5) c.parArbitro.t0 = t;
  }
  const pl = P.planos, ip = planoNoTempo(c, t);
  if (ip !== c.ip && ip < pl.length) entrarPlano(c, ip);
  // eventos da torcida: no plano 'torcida' (o placar decide palmas, vaia ou festa)
  if (!c.evTorcida && ip < pl.length && pl[ip].nome === 'torcida') {
    c.evTorcida = true;
    c.eventos.push({ tipo: 'cenaFim', fim: P.tipo, placar: { ...P.placar } });
  }
  if (c.k >= c.kGeral) c.acabou = true;
  return true;
}

/** Avança a cena dt s reais (relógio do desenho). Devolve alfa; os ticks em c.ticksUltimo. */
export function avancarCenaFim(c, dt) {
  c.ticksUltimo = 0;
  if (c.acabou) { c.alfa = 1; return 1; }
  c.acum += Math.max(0, dt);
  while (c.acum >= PASSO - 1e-9 && !c.acabou) { passoCenaFim(c); c.acum -= PASSO; c.ticksUltimo++; }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou ? 1 : Math.min(1, c.acum / PASSO);
  return c.alfa;
}
export function tempoCenaFim(c) { return tempoDe(c); }
/** Duração até o plano geral (s). */
export function duracaoCenaFim(c) { return c.kFim * PASSO; }
/** Nome do plano no estado desenhado ('geral' depois do último; 'fim' quando a cena do intervalo acaba). */
export function faseFim(c) {
  if (c.acabou) return 'fim';
  const ip = planoNoTempo(c, tempoDe(c));
  return ip < c.plano.planos.length ? c.plano.planos[ip].nome : 'geral';
}

/** Entra no plano ip: as elipses (túnel, aplauso), o campo vazio do geral do intervalo e a câmera dele. */
function entrarPlano(c, ip) {
  c.ip = ip;
  const nome = c.plano.planos[ip].nome;
  c.noTunel = false;
  if (nome === 'tunel') elipseTunel(c);
  if (nome === 'aplauso') elipseAplauso(c);
  if (nome !== 'aplauso' && c.noAplauso) c.noAplauso = nome === 'torcida' || nome === 'geral';
  if (nome === 'geral' && c.plano.tipo === 'intervalo') for (const a of c.atores) a.ativo = false;
  if (nome === 'tunel') c.noTunel = true;
  c.cams[ip] = escolherCamera(c, ip);
  c.cortes++;
}

/** ELIPSE do intervalo: os dois times (e o trio) num funil a 8–25 m da boca do túnel, andando para ela. */
function elipseTunel(c) {
  const P = c.plano, F = K.funil;
  const lista = c.atores.filter(a => a.tipo !== 'treinador');
  // ordem: o trio na frente, depois os jogadores pelo hash (misturados, como saem do campo)
  lista.sort((x, y) => (x.time === 2 ? 0 : 1) - (y.time === 2 ? 0 : 1) || (hashGol(P.tick, x.id) % 1009) - (hashGol(P.tick, y.id) % 1009));
  const n = lista.length;
  lista.forEach((a, i) => {
    const u = i / Math.max(1, n - 1);
    const d = lerp(F.d[0], F.d[1], u);
    // o funil abre com a distância: ±(1,2 + 0,42·(d − 8)) m de lado, em fileiras de 2–3
    const fila = i % 3, larg = 1.2 + 0.42 * (d - F.d[0]);
    const lado = (fila - 1) * larg * 0.55 + ((hashGol(P.tick, a.id + 7) % 100) / 100 - 0.5) * 0.6;
    const x = clamp(lado, -20, 20), z = TUNEL.z - 4 - Math.sqrt(Math.max(1, d * d - lado * lado));
    const dx = clamp(x * 0.3, -1.6, 1.6) - x, dz = 39.5 - z, l = Math.hypot(dx, dz) || 1;
    a.velTunel = lerp(F.vel[0], F.vel[1], ((hashGol(P.tick, a.id + 3) % 100) / 100));
    recriarAtor(c, a, x, z, Math.atan2(dz, dx), { dx: dx / l, dz: dz / l, vel: a.velTunel, ticks: 45 });
    a.podeFixar = false;
    a.cabisbaixo = P.vencedor != null && a.time === 1 - P.vencedor;
    a.conversa = null;
  });
  // quem ganha (ou, no empate, todos) conversa com o vizinho da frente do mesmo time
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.cabisbaixo || a.time === 2) continue;
    for (let k = i + 1; k < Math.min(lista.length, i + 4); k++) if (lista[k].time === a.time) { a.conversa = c.atores.indexOf(lista[k]); break; }
  }
}

/** ELIPSE do fim: o time do humano a 8–10 m da própria torcida (fundo dele), andando para ela batendo palmas. */
function elipseAplauso(c) {
  const P = c.plano, th = P.timeHumano;
  const sx = th === 1 ? -1 : 1;     // a torcida do time 0 é a organizada (fundo +x); a do 1, o setor visitante (−x)
  const frente = 62.5;
  const time = c.atores.filter(a => a.time === th && a.tipo !== 'treinador');
  time.sort((x, y) => x.id - y.id);
  const n = time.length;
  time.forEach((a, i) => {
    const d = lerp(K.aplauso.d[0], K.aplauso.d[1], (i % 2) * 0.6 + 0.2);
    let z = (i - (n - 1) / 2) * 2.05;
    if (Math.abs(z) < 5.6) z = (z >= 0 ? 1 : -1) * (5.6 + Math.abs(z) * 0.4);   // longe do gol e da rede
    const x = sx * (frente - d) - sx * (i % 2) * 1.4;
    a.alvoX = sx * (frente - 4.6); a.alvoZ = z; a.rumoAlvo = sx > 0 ? 0 : Math.PI;
    recriarAtor(c, a, x, z, a.rumoAlvo, { dx: sx, dz: 0, vel: 1.2, ticks: 40 });
    a.aplaude = true; a.podeFixar = false;
  });
  // os outros (o outro time e o trio) perto da câmera ou na frente dela reaparecem no meio-campo (no mesmo corte)
  const cx = sx * (62.5 - 10 - K.camera.aplauso.atras);
  let k = 0;
  for (const a of c.atores) {
    if (a.aplaude || a.tipo === 'treinador') continue;
    if (Math.abs(a.j.x - cx) < 16 && Math.abs(a.j.z) < 26 && a.j.x * sx > cx * sx - 14) {
      const x = -sx * (4 + (k % 5) * 2.2), z = (Math.floor(k / 5) - 1) * 3.1 + (k % 2) * 0.9;
      recriarAtor(c, a, x, z, sx > 0 ? 0 : Math.PI);
      k++;
    }
  }
  c.noAplauso = true;
}

// ------------------------------------------------------------------------------------------------ câmera
const _a = [];
function escolherCamera(c, ip) {
  const P = c.plano, nome = P.planos[ip].nome, C = K.camera, arb = c.arbitro;
  switch (nome) {
    case 'apito': {
      // alto e aberto, do lado da TV, mais perto do árbitro que o plano geral
      const x = clamp(arb.j.x * 0.75, -40, 40), z = MZ + 4.5;
      return { x, y: C.apito.altura, z, fov: C.apito.fov };
    }
    case 'campo': case 'neutro': case 'cumprimentos': {
      // o 1º par do aperto (ou o árbitro) de lado, do lado da TV
      const p = c.pares[0];
      const sx = p ? (p.a.j.x + p.b.j.x) / 2 : arb.j.x, sz = p ? (p.a.j.z + p.b.j.z) / 2 : arb.j.z;
      const D = nome === 'cumprimentos' ? C.cumprimentos : C.campo;
      const cands = [];
      for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: sx + Math.cos(a0) * D.dist, y: D.altura, z: sz + Math.sin(a0) * D.dist, pref: Math.abs(da) * 0.4 });
      }
      _a.length = 0; if (p) _a.push(p.a, p.b); else _a.push(arb);
      return { ...melhorCamera(c, cands, _a), sx, sz, fov: D.fov };
    }
    case 'tunel': {
      const T = C.tunel;
      const cands = [];
      for (const sg of [1, -1]) for (const dz of [0, -0.6, 0.5]) cands.push({ x: sg * T.x, y: T.y, z: T.z + dz });
      _a.length = 0;
      return { ...melhorCamera(c, cands, _a), fov: T.fov, olhar: true };
    }
    case 'vencedor': {
      const G = c.grupoV;
      const f = G ? G.foco.j : arb.j;
      const cands = [];
      for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: f.x + Math.cos(a0) * C.grupo.dist, y: C.grupo.altura, z: f.z + Math.sin(a0) * C.grupo.dist, pref: Math.abs(da) * 0.3 });
      }
      _a.length = 0; if (G) _a.push(G.foco);
      return { ...melhorCamera(c, cands, _a), fov: C.grupo.fov };
    }
    case 'perdedor': {
      const g = c.grupoP;
      const f = g ? g.membros[0].j : arb.j;
      const cands = [];
      for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2.0, -2.0]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: f.x + Math.cos(a0) * C.close.dist, y: C.close.altura, z: f.z + Math.sin(a0) * C.close.dist, pref: Math.abs(da) * 0.3 });
      }
      _a.length = 0; if (g) _a.push(...g.membros.slice(0, 2));
      return { ...melhorCamera(c, cands, _a), fov: C.close.fov };
    }
    case 'treinador': {
      const tr = c.treinadores.find(a => a.timeT === P.vencedor) ?? c.treinadores[0];
      const sx = tr ? tr.j.x : 0;
      return { x: sx + (sx >= 0 ? -3 : 3), y: C.treinador.altura, z: 33, fov: C.treinador.fov, alvo: tr };
    }
    case 'aplauso': {
      const sx = P.timeHumano === 1 ? -1 : 1;
      return { x: sx * (62.5 - 10 - C.aplauso.atras), y: C.aplauso.altura, z: 1.5, fov: C.aplauso.fov, olharX: sx * 66 };
    }
    case 'torcida': return { trilho: 'organizada' };
    case 'geral': return { geral: true };
    default: return { x: 0, y: 10, z: 30 };
  }
}

/**
 * Plano de câmera do estado desenhado: out = {nome, de, para, fov, tunel}. opc = {pequena, aspecto}. Pura.
 */
export function planoCameraFim(c, opc, out) {
  out.tunel = false;
  if (c.acabou) { out.nome = 'fim'; return out; }
  const t = tempoDe(c), ip = planoNoTempo(c, t), pl = c.plano.planos[ip];
  if (!pl) { out.nome = 'fim'; return out; }
  const cam = c.cams[ip] ?? (c.cams[ip] = escolherCamera(c, ip));
  const al = c.alfa, arb = c.arbitro;
  switch (pl.nome) {
    case 'apito': {
      const ax = lerp(arb.x0, arb.x1, al), az = lerp(arb.z0, arb.z1, al);
      return definirPlano(out, 'apito', cam.x, cam.y, cam.z, ax, 0.5, az, cam.fov, opc);
    }
    case 'campo': case 'neutro': case 'cumprimentos': {
      const p = c.pares[0];
      _g.length = 0;
      if (p) _g.push(lerp(p.a.x0, p.a.x1, al), lerp(p.a.z0, p.a.z1, al), lerp(p.b.x0, p.b.x1, al), lerp(p.b.z0, p.b.z1, al));
      else _g.push(lerp(arb.x0, arb.x1, al), lerp(arb.z0, arb.z1, al));
      return definirPlanoGrupo(out, pl.nome, cam.x, cam.y, cam.z, _g, 1.0, cam.fov, opc);
    }
    case 'tunel': {
      out.tunel = true;
      definirPlano(out, 'tunel', cam.x, cam.y, cam.z, 0, 1.2, 28, cam.fov, opc);
      out.tunel = true;
      return out;
    }
    case 'vencedor': case 'perdedor': {
      const g = pl.nome === 'vencedor' ? c.grupoV : c.grupoP;
      _g.length = 0;
      const lista = g ? (pl.nome === 'vencedor' ? [g.foco, ...g.membros.slice(0, 2)] : g.membros.slice(0, 3)) : [arb];
      for (const a of lista) _g.push(lerp(a.x0, a.x1, al), lerp(a.z0, a.z1, al));
      return definirPlanoGrupo(out, pl.nome, cam.x, cam.y, cam.z, _g, 1.0, cam.fov, opc);
    }
    case 'treinador': {
      const tr = cam.alvo;
      return definirPlano(out, 'treinador', cam.x, cam.y, cam.z, tr ? lerp(tr.x0, tr.x1, al) : 0, 1.3, tr ? lerp(tr.z0, tr.z1, al) : 36, cam.fov, opc);
    }
    case 'aplauso': return definirPlano(out, 'aplauso', cam.x, cam.y, cam.z, cam.olharX, 5.5, 0, cam.fov, opc);
    case 'torcida': {
      const u = (t - pl.t0) / Math.max(0.1, pl.t1 - pl.t0);
      const q = cameraDoPlano(cam.trilho, u, _cp);
      out.nome = 'torcida';
      out.de[0] = q.px; out.de[1] = q.py; out.de[2] = q.pz; out.para[0] = q.lx; out.para[1] = q.ly; out.para[2] = q.lz; out.fov = q.fov;
      return out;
    }
    case 'geral': {
      const G = CAMERA_GERAL;
      out.nome = 'geral';
      out.de[0] = G.de[0]; out.de[1] = G.de[1]; out.de[2] = G.de[2]; out.para[0] = G.para[0]; out.para[1] = G.para[1]; out.para[2] = G.para[2]; out.fov = G.fov;
      return out;
    }
    default: out.nome = 'fim'; return out;
  }
}
const _cp = {}, _g = [];
export { criarPlanoCena as criarPlanoCameraFim };

/** Eventos novos da cena (a reação da torcida no plano dela); esvazia a fila. */
export function consumirEventosFim(c, out = []) {
  out.length = 0;
  for (const e of c.eventos) out.push(e);
  c.eventos.length = 0;
  return out;
}

/** Informação para testes e API: por ator {id, time, tipo, x, z, rumo, v, fixo, ativo, kit, recriado}. */
export function infoAtoresFim(c) {
  return c.atores.map(a => ({
    id: a.id, time: a.time, tipo: a.tipo, x: a.j.x, z: a.j.z, rumo: a.j.rumo, v: Math.hypot(a.j.vx, a.j.vz), fixo: a.fixo,
    ativo: a.ativo, kit: a.kit, goleiro: a.goleiro, recriado: a.recriado, par: a.par ? a.par.k : null,
  }));
}
