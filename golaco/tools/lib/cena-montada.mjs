// Cenas MONTADAS para a análise semiautomática (tools/teste-saot.mjs, teste-replay-anel.mjs): um anel sintético com
// jogadores de pé (pose simples, juntas no mundo) em posições escolhidas e a foto da Regra 11 de cada passo como o main.js
// grava — para conferir o critério da posição legal, a câmera e a coerência sem depender de uma partida.
//   montarAnel(RA, NJ, J, {ini, fim, jogadores, fotos, marcas, cortes}) → anel
//   lancePasse(opc) → as opções de um lance A → B (e o gol) com a margem pedida

/**
 * Pose de pé (NJ×3 no mundo) em (x, z), de frente para `rumo` (rad). peU: m que o pé DIREITO avança no sentido u (= x ·
 * lado) — o atacante com o pé além da linha, o defensor com o pé para trás (para o próprio gol).
 */
export function poseEmPe(J, NJ, x, z, rumo = 0, peU = 0, lado = 1) {
  const p = new Float32Array(NJ * 3);
  const fx = Math.cos(rumo), fz = Math.sin(rumo), lx = -fz, lz = fx; // frente e esquerda
  const put = (j, y, dl, df = 0) => { p[j * 3] = x + lx * dl + fx * df; p[j * 3 + 1] = y; p[j * 3 + 2] = z + lz * dl + fz * df; };
  put(J.pelve, 0.95, 0); put(J.lombar, 1.15, 0); put(J.peito, 1.35, 0); put(J.pescoco, 1.55, 0); put(J.cabeca, 1.7, 0);
  put(J.ombroE, 1.45, 0.2); put(J.ombroD, 1.45, -0.2);
  put(J.cotoveloE, 1.2, 0.25); put(J.cotoveloD, 1.2, -0.25);
  put(J.maoE, 0.95, 0.27); put(J.maoD, 0.95, -0.27);
  put(J.quadrilE, 0.92, 0.1); put(J.quadrilD, 0.92, -0.1);
  put(J.joelhoE, 0.5, 0.11); put(J.joelhoD, 0.5, -0.11);
  put(J.tornozeloE, 0.08, 0.11); put(J.tornozeloD, 0.08, -0.11);
  put(J.pontaE, 0.04, 0.11, 0.15); put(J.pontaD, 0.04, -0.11, 0.15);
  if (peU) for (const j of [J.joelhoD, J.tornozeloD, J.pontaD]) p[j * 3] += lado * peU * (j === J.joelhoD ? 0.5 : 1);
  return p;
}

/**
 * Anel sintético. o = {ini, fim (ticks gravados), lado (do time 0), jogadores: [{id, time, x, z, rumo?, peU?, gol?}],
 * fotos: [{de, ate, tick ('novo' = o próprio passo, ou um tick fixo), time, por, def (null = bola/meio), linhaX, lado}]
 * (a foto em vigor no fim de cada passo; sem foto no passo = nenhuma), marcas: {tick: bits}, cortes: Set de ticks,
 * bolaX(t)?}.
 */
export function montarAnel(RA, NJ, J, o) {
  const a = RA.criarAnel({ ticks: 600, vagas: 24, nj: NJ });
  const lado = o.lado ?? 1;
  const poses = o.jogadores.map(j => poseEmPe(J, NJ, j.x, j.z, j.rumo ?? ((j.time === 0) === (lado > 0) ? 0 : Math.PI), j.peU ?? 0, lado));
  for (let t = o.ini; t <= o.fim; t++) {
    a.inicio(t, t / 60, o.cortes?.has(t) ?? false);
    o.jogadores.forEach((j, v) => a.jogador(v, j.id, j.time, !!j.gol, j.x, j.z, j.rumo ?? 0, poses[v]));
    const f = (o.fotos ?? []).find(q => t >= q.de && t <= q.ate);
    if (f) a.foto(f.tick === 'novo' ? t : f.tick, f.time, f.por, f.def, f.linhaX, f.lado);
    if (o.marcas?.[t]) a.marcar(o.marcas[t]);
    a.fim({ x: o.bolaX ? o.bolaX(t) : 0, y: 0.11, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
  }
  return a;
}

/**
 * Lance A (id 7) → B (id 9) do time 0 contra o defensor da linha D (104), com um goleiro (101) e um zagueiro além (105):
 * A conduz até `passe` (foto nova a cada passo), a foto de A fica até `recebe`, depois B conduz, chuta em `chute` e
 * faz o gol em `gol`. margem = (linhaX − x de B) · lado (> 0: B atrás da linha). Opções: lado, linhaX, margem, zB, zD,
 * peAtac (pé de B além, m), peDef (pé de D para trás, m), def (o defensor na foto; null = a linha era a bola),
 * adversario (tick em que a foto passa ao adversário entre o passe e a recepção), semFotoAntes (cobrança de lateral,
 * tiro de meta ou escanteio: nenhuma foto até a recepção), ini, fim, passe, recebe, chute, gol, cortes.
 */
export function lancePasse(o = {}) {
  const lado = o.lado ?? 1, linhaX = o.linhaX ?? 25 * lado, margem = o.margem ?? 0.3;
  const ini = o.ini ?? 1000, passe = o.passe ?? 1200, recebe = o.recebe ?? 1260, chute = o.chute ?? 1400, gol = o.gol ?? 1440, fim = o.fim ?? 1500;
  const def = o.def === undefined ? 104 : o.def;
  const xB = linhaX - margem * lado;
  const jogadores = [
    { id: 7, time: 0, x: linhaX - 18 * lado, z: -5 },
    { id: 9, time: 0, x: xB, z: o.zB ?? 8, peU: o.peAtac ?? 0 },
    { id: 104, time: 1, x: linhaX, z: o.zD ?? 4, peU: o.peDef ?? 0 },
    { id: 105, time: 1, x: linhaX + 6 * lado, z: -10 },
    { id: 101, time: 1, x: lado * 51, z: 0, gol: true },
  ];
  const F = (de, ate, tick, por, time = 0) => ({ de, ate, tick, time, por, def, linhaX, lado: time === 0 ? lado : -lado });
  const fotos = [];
  if (o.semFotoAntes) fotos.push(F(recebe, gol - 1, 'novo', 9));
  else {
    fotos.push(F(ini, passe, 'novo', 7));
    if (o.adversario != null) { fotos.push(F(passe + 1, o.adversario - 1, passe, 7)); fotos.push({ de: o.adversario, ate: recebe - 1, tick: o.adversario, time: 1, por: 104, def: 9, linhaX: -linhaX, lado: -lado }); }
    else fotos.push(F(passe + 1, recebe - 1, passe, 7));
    fotos.push(F(recebe, gol - 1, 'novo', 9));
  }
  return { ini, fim, lado, jogadores, fotos, marcas: { [chute]: 1, [gol]: 2 }, cortes: o.cortes, passe, recebe, chute, gol, linhaX };
}
