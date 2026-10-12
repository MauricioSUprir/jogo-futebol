// Anel do REPLAY: os últimos REPLAY.segundos (10 s = 600 passos) do que foi DESENHADO. Puro (sem three.js nem DOM):
// roda nos testes em Node (tools/teste-replay-anel.mjs).
//
// A cada passo da simulação o main.js já calcula a pose de cada jogador (anim.js, uma vez por passo) para o desenho
// interpolado; o anel só COPIA essa pose (NJ×3 floats, no mundo), x/z/rumo, a bola (p + q) e o relógio do estádio
// (para a rede balançar de novo no replay). Nada é recalculado e nada é escrito no mundo: o hash não muda. O replay
// lê dois passos vizinhos e interpola como o desenho ao vivo (anim.js interpolarPose; "snapshot interpolation",
// Gaffer on Games). Gravar o ESTADO desenhado (e não as entradas para re-simular) custa memória fixa e nunca diverge;
// re-simular custaria a simulação inteira por passo durante o replay (PESQUISA-ESTADIO.md §Replay).
//
// Memória fixa, alocada uma vez: ticks × vagas × (NJ×3 + 3) Float32 (10 s, 24 vagas, NJ = 19: ~3,3 MB). Nada é
// alocado por passo.
//
// Corte: um passo em que alguém foi levado longe (montagem do recomeço, saída de bola) ou a bola pulou é marcado; o
// replay nunca interpola através dele (lerQuadro) e os roteiros não atravessam um corte (ultimoCorte).

export function criarAnel({ ticks = 600, vagas = 24, nj = 19 } = {}) {
  const P = nj * 3, K = P + 3;
  const dados = new Float32Array(ticks * vagas * K);
  const ids = new Int16Array(ticks * vagas).fill(-1);
  const info = new Uint8Array(ticks * vagas);          // bit0 = time 1, bit1 = goleiro
  const nVagas = new Uint8Array(ticks);
  const bola = new Float32Array(ticks * 7);             // p (x, y, z) + q (x, y, z, w)
  const tickDe = new Int32Array(ticks).fill(-1);
  const tEst = new Float64Array(ticks);                 // relógio do estádio (s) no fim do passo
  const corte = new Uint8Array(ticks);                  // 1 = alguém teletransportado neste passo
  let ultimo = -1, primeiro = -1, slotAtual = -1;
  const a = {
    ticks, vagas, K, P, nj, dados, ids, info, nVagas, bola, tickDe, tEst, corte,
    /** Tick mais novo gravado (-1: vazio). */
    get ultimo() { return ultimo; },
    /** Tick mais velho ainda no anel (sem buraco até `ultimo`). */
    get primeiro() { return primeiro; },
    /** Bytes ocupados (fixos). */
    get bytes() { return dados.byteLength + ids.byteLength + info.byteLength + nVagas.byteLength + bola.byteLength + tickDe.byteLength + tEst.byteLength + corte.byteLength; },
    /** Esquece tudo (mundo novo). */
    limpar() { tickDe.fill(-1); ultimo = -1; primeiro = -1; slotAtual = -1; },
    /** Começa o registro do passo `tick` (t = relógio do estádio, s; cortou = alguém/a bola teletransportado). */
    inicio(tick, t, cortou) {
      const s = ((tick % ticks) + ticks) % ticks;
      // começo, buraco ou mundo novo (o tick voltou): o anel recomeça daqui
      if (ultimo < 0 || tick !== ultimo + 1) { tickDe.fill(-1); primeiro = tick; }
      slotAtual = s; tickDe[s] = tick; tEst[s] = t; corte[s] = cortou ? 1 : 0; nVagas[s] = 0;
      ultimo = tick;
      if (ultimo - primeiro >= ticks) primeiro = ultimo - ticks + 1;
    },
    /** Um jogador do passo atual na vaga v (pose = Float32Array NJ×3 já calculada, no mundo). */
    jogador(v, id, time, goleiro, x, z, rumo, pose) {
      if (slotAtual < 0 || v >= vagas) return;
      const s = slotAtual, i = s * vagas + v, o = i * K;
      ids[i] = id; info[i] = (time === 1 ? 1 : 0) | (goleiro ? 2 : 0);
      dados.set(pose.length === P ? pose : pose.subarray(0, P), o);
      dados[o + P] = x; dados[o + P + 1] = z; dados[o + P + 2] = rumo;
      if (v + 1 > nVagas[s]) nVagas[s] = v + 1;
    },
    /** Fecha o passo com a bola (p {x,y,z}, q {x,y,z,w}). */
    fim(p, q) {
      if (slotAtual < 0) return;
      const o = slotAtual * 7;
      bola[o] = p.x; bola[o + 1] = p.y; bola[o + 2] = p.z; bola[o + 3] = q.x; bola[o + 4] = q.y; bola[o + 5] = q.z; bola[o + 6] = q.w;
    },
    /** Índice do slot do tick (ou -1 se não está no anel). */
    slot(tick) {
      if (ultimo < 0 || tick < primeiro || tick > ultimo) return -1;
      const s = ((tick % ticks) + ticks) % ticks;
      return tickDe[s] === tick ? s : -1;
    },
    /** Último corte (tick) em [de, ate], ou null — o replay não atravessa um corte. */
    ultimoCorte(de, ate) {
      for (let t = ate; t >= de; t--) { const s = a.slot(t); if (s >= 0 && corte[s]) return t; }
      return null;
    },
  };
  return a;
}

const lerpAng = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/**
 * Lê o quadro do tick FRACIONÁRIO `t` (ex.: 812,4 = 40% do caminho entre os passos 812 e 813): escreve em `lista`
 * (itens reaproveitados, cada um com o próprio `pose`, no formato do jogador3d.atualizar) e na bola `bp` {x,y,z} /
 * `bq` {x,y,z,w} (q por nlerp: entre passos de 1/60 s é o mesmo que o slerp). O passo seguinte marcado como corte não
 * é interpolado (fica no anterior). kitDe(id, goleiro) → uniforme ou null. Devolve quantos jogadores (0 = fora do anel).
 */
export function lerQuadro(a, t, lista, bp, bq, kitDe = null) {
  const t0 = Math.floor(t);
  let s0 = a.slot(t0), s1 = a.slot(t0 + 1);
  if (s0 < 0) s0 = s1;
  if (s1 < 0 || a.corte[s1]) s1 = s0;
  if (s0 < 0) { lista.length = 0; return 0; }
  const f = s1 === s0 ? 0 : t - t0;
  const { K, P, dados, vagas } = a;
  let n = 0;
  for (let v = 0; v < a.nVagas[s0]; v++) {
    const i0 = s0 * vagas + v, id = a.ids[i0];
    if (id < 0) continue;
    // o mesmo jogador no passo seguinte (a ordem pode mudar numa substituição ou expulsão)
    let i1 = s1 * vagas + v;
    if (a.ids[i1] !== id) { i1 = i0; for (let w = 0; w < a.nVagas[s1]; w++) if (a.ids[s1 * vagas + w] === id) { i1 = s1 * vagas + w; break; } }
    const it = lista[n] ?? (lista[n] = { pose: new Float32Array(P) });
    if (!it.pose || it.pose.length !== P) it.pose = new Float32Array(P);
    const o0 = i0 * K, o1 = i1 * K, pose = it.pose;
    for (let k = 0; k < P; k++) pose[k] = dados[o0 + k] + (dados[o1 + k] - dados[o0 + k]) * f;
    it.x = dados[o0 + P] + (dados[o1 + P] - dados[o0 + P]) * f;
    it.z = dados[o0 + P + 1] + (dados[o1 + P + 1] - dados[o0 + P + 1]) * f;
    it.rumo = lerpAng(dados[o0 + P + 2], dados[o1 + P + 2], f);
    it.id = id; it.time = a.info[i0] & 1; it.goleiro = (a.info[i0] & 2) !== 0;
    // no replay ninguém está "controlado" (sem anel nem seta: a transmissão não tem cursor)
    it.controlado = false; it.proximo = false; it.kit = kitDe ? kitDe(id, it.goleiro) : null;
    n++;
  }
  lista.length = n;
  const b0 = s0 * 7, b1 = s1 * 7, B = a.bola;
  bp.x = B[b0] + (B[b1] - B[b0]) * f; bp.y = B[b0 + 1] + (B[b1 + 1] - B[b0 + 1]) * f; bp.z = B[b0 + 2] + (B[b1 + 2] - B[b0 + 2]) * f;
  let qx = B[b0 + 3], qy = B[b0 + 4], qz = B[b0 + 5], qw = B[b0 + 6];
  let rx = B[b1 + 3], ry = B[b1 + 4], rz = B[b1 + 5], rw = B[b1 + 6];
  if (qx * rx + qy * ry + qz * rz + qw * rw < 0) { rx = -rx; ry = -ry; rz = -rz; rw = -rw; }
  qx += (rx - qx) * f; qy += (ry - qy) * f; qz += (rz - qz) * f; qw += (rw - qw) * f;
  const l = Math.hypot(qx, qy, qz, qw) || 1;
  bq.x = qx / l; bq.y = qy / l; bq.z = qz / l; bq.w = qw / l;
  return n;
}

/** Relógio do estádio (s) no tick fracionário t (a rede re-balança no replay com o tempo gravado). */
export function tempoEstadio(a, t) {
  const t0 = Math.floor(t);
  const s0 = a.slot(t0), s1 = a.slot(t0 + 1);
  if (s0 < 0) return s1 >= 0 ? a.tEst[s1] : 0;
  return s1 < 0 ? a.tEst[s0] : a.tEst[s0] + (a.tEst[s1] - a.tEst[s0]) * (t - t0);
}

/** Bola gravada no passo `tick` em out {x, y, z} (null se o passo não está no anel). */
export function bolaNoTick(a, tick, out = { x: 0, y: 0, z: 0 }) {
  const s = a.slot(tick);
  if (s < 0) return null;
  out.x = a.bola[s * 7]; out.y = a.bola[s * 7 + 1]; out.z = a.bola[s * 7 + 2];
  return out;
}

/** Jogador `id` gravado no passo `tick` em out {x, z, time, goleiro} (null se não está). */
export function jogadorNoTick(a, tick, id, out = { x: 0, z: 0, time: 0, goleiro: false }) {
  const s = a.slot(tick);
  if (s < 0) return null;
  for (let v = 0; v < a.nVagas[s]; v++) {
    const i = s * a.vagas + v;
    if (a.ids[i] !== id) continue;
    const o = i * a.K + a.P;
    out.x = a.dados[o]; out.z = a.dados[o + 1]; out.time = a.info[i] & 1; out.goleiro = (a.info[i] & 2) !== 0;
    return out;
  }
  return null;
}

/**
 * O defensor que fazia a linha no passo `tick`: o jogador do time `time` (não goleiro de preferência) cujo x está
 * mais perto de `linhaX` (até `tol` m). Devolve {id, x, z} ou null (a linha era a bola ou o meio-campo).
 */
export function defensorDaLinha(a, tick, time, linhaX, tol = 1, out = { id: -1, x: 0, z: 0 }) {
  const s = a.slot(tick);
  if (s < 0) return null;
  let melhor = -1, dm = tol;
  for (let v = 0; v < a.nVagas[s]; v++) {
    const i = s * a.vagas + v;
    if ((a.info[i] & 1) !== time) continue;
    const d = Math.abs(a.dados[i * a.K + a.P] - linhaX);
    if (d <= dm) { dm = d; melhor = i; }
  }
  if (melhor < 0) return null;
  out.id = a.ids[melhor]; out.x = a.dados[melhor * a.K + a.P]; out.z = a.dados[melhor * a.K + a.P + 1];
  return out;
}
