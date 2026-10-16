// teste-faltas-sentido — pedido do dono, 15/10 (jogando a versão publicada no celular, contra a IA): "tem umas loucuras aí,
// umas forçadas de barra pra ter falta, faltas muito forçadas e sem sentido".
//
// O que NÃO é falta (IFAB Regra 12; PESQUISA-ETAPA4.md §3b): o contato incidental (a passo, sem ninguém entrar no outro);
// o defensor que chega na bola antes do homem sem entrar nele (de frente recuando, de lado acompanhando: desarme limpo);
// a carga ombro a ombro a velocidade razoável; o condutor que recua para dentro de quem estava atrás dele (a carga é
// dele). Falta "forçada" (medida na main, tools/lib/faltas-registro.mjs): o bote da IA marcado com o defensor entrando a
// < 1 m/s no condutor (53% das faltas da IA em quem conduz) e a carga por trás de quem só corria atrás da bola (o
// controlado da pessoa com o analógico na bola, ou o chamado da PRESSÃO: 1,4–3,3 por partida — a IA, 0,1–0,3).
//
// Metas:
//  A. Cenas montadas (faltas.js, 400 sorteios pelo m.rng cada; a falta de verdade continua):
//   A1 bote de frente com o defensor recuando na frente do condutor (bola mais perto dele): 0 falta;
//   A2 bote de lado, ombro a ombro, os dois na mesma velocidade: 0 falta;
//   A3 bola encostada no defensor andando junto com o condutor (≤ 1 m/s de diferença): 0 falta;
//   A4 (de verdade) bote por trás entrando forte (defensor a 7 m/s, condutor a 3): falta em ≥ 70%, temerário + amarelo;
//   A5 (de verdade) bote de lado entrando no condutor a 3 m/s: falta em ≥ 30%;
//   A6 carga: o condutor de costas recua para dentro de quem vinha atrás devagar (fechando a 1,85 m/s, ≥ vMin): 0 falta;
//   A7 (de verdade) carga por trás forte (defensor a 6 m/s, condutor a 2): falta em 35–65% (FALTAS.carga.chance 0,5);
//   A8 DIVIDIDA da pessoa (defesa.js resolverBote, faltas.js chanceFaltaDividida) de frente sem o corpo entrar — recuando
//      ('perdeu') ou parada com o condutor tocando na bola ('tocou'): chance 0 (a mesma régua do bote da IA: contraprova);
//   A9 (de verdade) DIVIDIDA de lado entrando a 3 m/s: ≥ 30%; A10 (de verdade) DIVIDIDA por trás forte: ≥ 70%;
//   A11 segurar (faltaTatica fora do contra-ataque) sem motivo — o condutor parado de costas, andando, ou o defensor
//      alcançando: 0 em 3000 passos; A12 (de verdade) segurar quem escapa do batido (5 m/s): 0,05–0,5% por passo, sem
//      cartão;
//   A13 bote forte na própria área: o defensor tira o corpo (BOTE_EVITADO) — a fração de botes limpos dentro da área é a
//      de fora (|Δ| ≤ 8 pontos; o mesmo contato é falta no campo todo) e a falta dentro existe (pênalti);
//   A14 o bote sem o corpo entrar (A1) não vira roubada limpa: o condutor segura o contato e segue (BOTE_SEM_GANHAR) com
//      a chance que antes era a da falta (chanceFaltaBote, ± 5 pontos) — sem isso a roubada da IA subia ~0,7 por partida e
//      o ataque perdia volume (junção #480 + #481); na corrida (A2, ≥ FALTAS.bote.semCorpoV) quem chega antes leva (0).
//  B. Partidas com o time 0 jogado como uma pessoa (faltas-registro: 'persegue', 'pressao', 'dribla'; o árbitro do teste
//     mede a força do contato pela foto antes do passo — a de quando os corpos encostam nos últimos 0,33 s):
//   B1 faltas de bote da IA com o contato a < 1 m/s: ≤ 0,1 por partida (main: ~2 por partida);
//   B2 carga por trás de quem só corria atrás (controlado pela pessoa ou chamado da PRESSÃO): ≤ 0,25 por partida
//      (main: ~2 por partida);
//   B3 (de verdade) a IA ainda faz falta em quem conduz entrando forte: faltas da IA no time 0 com contato ≥ 2 m/s ≥ 0,5
//      por partida no 'dribla'; vermelhos e pênaltis do 'dribla' ≤ 0,6 por partida cada (main: 1,0 e 1,0; real ~0,15 e
//      ~0,23 em 90 min);
//   B4 'dividida' (a pessoa aperta DIVIDIDA com a bola a ≤ 1,5 m): faltas da DIVIDIDA com o contato a < 1 m/s ≤ 0,1 por
//      partida (main: ~1,9 — 60% das faltas da DIVIDIDA).
// Informativos: a tabela por categoria (quem fez, origem, chegada, força) e as faltas por minuto (real: Premier League
// 2024/25, ~22,8 faltas e ~57 min de bola rolando ≈ 0,40 por minuto; PESQUISA-ETAPA4.md §3b).
//
//   node tools/teste-faltas-sentido.mjs              (lógica do repositório)
//   node tools/teste-faltas-sentido.mjs --js <pasta> (outra cópia da lógica; a main de 15/10 → REPROVA)
//   node tools/teste-faltas-sentido.mjs --partidas 4 (partidas por modelo; padrão 4)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NP = +arg('--partidas', 4);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, info = false) => { linhas.push([nome, medido, meta, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—');
const pc = (a, n) => `${n ? Math.round(100 * a / n) : 0}% (${a}/${n})`;

const P = await imp('partida.js');
const F = await imp('faltas.js');
const { FALTAS, ACOES } = await imp('config.js');
const { registrarFaltas } = await import(pathToFileURL(path.join(AQUI, 'lib/faltas-registro.mjs')).href);
const t0 = Date.now();

// ------------------------------------------------------------------ A. cenas montadas
/**
 * Partida com a bola rolando: o condutor C (time 0, atacando +x) em (20, 0) e o defensor D (time 1); os outros longe
 * (atrás do lance). d = {dx, dz (de D relativo a C), dvx, dvz}, c = {vx, vz, rumo}; a bola a `bola` (dx, dz) de C.
 */
function cena({ dx, dz = 0, dvx = 0, dvz = 0, cvx = 0, cvz = 0, crumo = 0, bola = [0.45, 0], sem = 1, cx = 20, cz = 0 }) {
  const m = P.criarPartida({ semente: sem });
  m.partida.estado = 'jogo'; m.parada = null; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
  const C = m.jogadores.find(j => j.time === 0 && j.posicao === 'MC') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
  const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
  for (const j of m.jogadores) {
    if (j === C || j === D) continue;
    if (j.posicao === 'GOL') P.teleportar(j, j.time === 0 ? -51 : 51, 0, j.time === 0 ? 0 : Math.PI);
    else P.teleportar(j, j.time === 0 ? -30 : 40, (j.vagaIdx - 5) * 3, 0); // o time 1 com defensores à frente (sem DOGSO)
  }
  P.teleportar(C, cx, cz, crumo); C.vx = cvx; C.vz = cvz;
  P.teleportar(D, cx + dx, cz + dz, Math.atan2(-dz, -dx)); D.vx = dvx; D.vz = dvz;
  m.bola.p.x = cx + bola[0]; m.bola.p.z = cz + bola[1]; m.bola.p.y = 0.11; m.posse = C.id;
  m.eventos = [];
  return { m, C, D };
}
/** Fração de sorteios do bote da IA que viram falta (e o grau/cartão da 1ª), que ele evita (F.BOTE_EVITADO: tira o corpo),
 * em que o condutor segura sem falta (F.BOTE_SEM_GANHAR: sg) e que saem limpos (null: a IA leva a bola). pb: a chance do
 * bote de antes da força do contato (chanceFaltaBote). */
function sorteiaBote(o, N = 400) {
  const { m, C, D } = cena(o);
  let n = 0, ev = 0, sg = 0, f1 = null;
  for (let i = 0; i < N; i++) {
    const f = F.faltaNoBote(m, D, C);
    if (f && f.evitado) ev++;
    else if (f && f.semGanhar) sg++;
    else if (f) { n++; f1 ??= f; }
  }
  return { p: n / N, f1, n, N, ev, sg, pb: F.chanceFaltaBote(D, C), limpo: (N - n - ev - sg) / N };
}
/** Faltas de segurar (faltas.js faltaTatica) em N passos com a cena parada: {n, N, f1}. */
function sorteiaSegurar(o, N = 3000) {
  const { m, C, D } = cena(o);
  let n = 0, f1 = null;
  for (let i = 0; i < N; i++) { const f = F.faltaTatica(m, D, C); if (f) { n++; f1 ??= f; } }
  return { n, N, f1 };
}
/** Fração de sorteios da carga que viram falta: o choque passa por guardarChoque (como em sim.js) quando ela existe. */
function sorteiaCarga(o, N = 400) {
  const { m, C, D } = cena(o);
  const lx = C.x - D.x, lz = C.z - D.z, l = Math.hypot(lx, lz) || 1, nx = lx / l, nz = lz / l;
  const rv = (D.vx - C.vx) * nx + (D.vz - C.vz) * nz;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (F.guardarChoque) F.guardarChoque(m, D, C, nx, nz);
    if (F.faltaNaCarga(m, D, C, rv)) n++;
  }
  return { p: n / N, n, N, rv };
}
{
  // A1: defensor 0,95 m à frente do condutor, recuando a 3,5 m/s; o condutor a 4 m/s; a bola a 0,55 m do condutor (mais
  // perto do defensor: o bote da IA só sai assim)
  const a1 = sorteiaBote({ dx: 0.95, dvx: 3.5, cvx: 4, bola: [0.55, 0] });
  reg('A1 bote de frente, o defensor recuando na frente do condutor (a bola mais perto dele)', `falta em ${pc(a1.n, a1.N)}`, '0', a1.n === 0);
  // A2: lado a lado a 0,7 m, os dois a 5 m/s para +x; a bola entre os dois, à frente
  const a2 = sorteiaBote({ dx: 0.1, dz: 0.7, dvx: 5, cvx: 5, bola: [0.35, 0.4] });
  reg('A2 bote de lado, ombro a ombro na mesma velocidade', `falta em ${pc(a2.n, a2.N)}`, '0', a2.n === 0);
  // A3: a bola encostada no defensor (à frente do condutor, a 0,62 m), os dois andando a 1,6 e 1,2 m/s
  const a3 = sorteiaBote({ dx: 0.95, dz: 0.1, dvx: 1.2, cvx: 1.6, bola: [0.55, 0.05] });
  reg('A3 bola encostada no defensor andando junto (≤ 1 m/s de diferença)', `falta em ${pc(a3.n, a3.N)}`, '0', a3.n === 0);
  // A14: o bote sem o corpo entrar (A1 de frente, condutor a 4 m/s) deixou de ser falta, mas não virou roubada limpa: o
  // condutor segura o contato e segue com a chance que antes era a da falta (chanceFaltaBote; faltas.js BOTE_SEM_GANHAR);
  // na corrida (A2, 5 m/s ≥ FALTAS.bote.semCorpoV) a bola vai à frente do pé e quem chega nela antes leva (0)
  const segura = a => Math.abs(a.sg / a.N - a.pb) <= 0.05 && a.sg > 0;
  reg('A14 bote sem o corpo entrar: o condutor segura sem falta (A1) · na corrida não (A2)', `segura ${pc(a1.sg, a1.N)} (antes da força: ${pc(Math.round(a1.pb * a1.N), a1.N)}) · ${pc(a2.sg, a2.N)}`,
    'a chance de antes ± 5 pontos · 0', segura(a1) && a2.sg === 0);
  // A4: por trás, o defensor a 7 m/s e o condutor a 3 m/s, a 0,8 m (a bola ao alcance dele, do lado)
  const a4 = sorteiaBote({ dx: -0.8, dz: 0.15, dvx: 7, cvx: 3, bola: [-0.3, 0.35] });
  reg('A4 (de verdade) bote por trás entrando forte: falta, temerário + amarelo', `falta em ${pc(a4.n, a4.N)} · ${a4.f1 ? `${a4.f1.grau}/${a4.f1.cartao}` : '—'}`, '≥ 70% · temerario/amarelo',
    a4.p >= 0.7 && a4.f1?.grau === 'temerario' && a4.f1?.cartao === 'amarelo');
  // A5: de lado, entrando no condutor a 3 m/s (o condutor a 4 m/s para +x, o defensor vindo de z = 0,8 para dentro)
  const a5 = sorteiaBote({ dx: 0.1, dz: 0.8, dvx: 4, dvz: -3, cvx: 4, bola: [0.35, 0.45] });
  reg('A5 (de verdade) bote de lado entrando no condutor a 3 m/s', `falta em ${pc(a5.n, a5.N)}`, '≥ 30%', a5.p >= 0.3);
  // A6: o condutor de costas para o defensor (rumo +x), recuando a 0,95 m/s para dentro dele; o defensor a 0,9 m/s
  const a6 = sorteiaCarga({ dx: -0.6, dvx: 0.9, cvx: -0.95, crumo: 0, bola: [0.4, 0] });
  reg('A6 carga: o condutor recua para dentro de quem vinha atrás devagar (a carga é dele)', `fechando a ${f2(a6.rv)} m/s · falta em ${pc(a6.n, a6.N)}`, `0 (vMin ${f2(FALTAS.carga.vMin)})`, a6.rv >= FALTAS.carga.vMin && a6.n === 0);
  // A7: por trás, o defensor a 6 m/s, o condutor a 2 m/s
  const a7 = sorteiaCarga({ dx: -0.6, dvx: 6, cvx: 2, bola: [0.4, 0] });
  reg('A7 (de verdade) carga por trás forte (6 → 2 m/s)', `falta em ${pc(a7.n, a7.N)}`, '35–65%', a7.p >= 0.35 && a7.p <= 0.65);
  // A8–A10: a DIVIDIDA da pessoa que não ganha a bola (defesa.js resolverBote) — a mesma régua do bote da IA (contraprova
  // de 15/10: só o bote da IA tinha ganhado a força do contato). Na main a chance é chanceFaltaBote × FALTAS.dividida
  const chDiv = F.chanceFaltaDividida ?? ((m, d, c, mot) => F.chanceFaltaBote(d, c) * (FALTAS.dividida[mot] ?? 0));
  const div = (o, mot) => { const { m, C, D } = cena(o); return chDiv(m, D, C, mot); };
  const a8p = div({ dx: 0.95, dvx: 3.5, cvx: 4, bola: [0.55, 0] }, 'perdeu'), a8t = div({ dx: 0.9, dvx: 0, cvx: 0.5, bola: [0.4, 0] }, 'tocou');
  reg('A8 DIVIDIDA de frente sem o corpo entrar (recuando · parado com o condutor tocando): chance de falta', `${f2(100 * a8p)}% · ${f2(100 * a8t)}%`, '0 · 0', a8p === 0 && a8t === 0);
  const a9 = div({ dx: 0.1, dz: 0.8, dvx: 4, dvz: -3, cvx: 4, bola: [0.35, 0.45] }, 'perdeu');
  reg('A9 (de verdade) DIVIDIDA de lado entrando no condutor a 3 m/s', `chance ${f2(100 * a9)}%`, '≥ 30%', a9 >= 0.3);
  const a10 = div({ dx: -0.8, dz: 0.15, dvx: 7, cvx: 3, bola: [-0.3, 0.35] }, 'perdeu');
  reg('A10 (de verdade) DIVIDIDA por trás entrando forte (7 → 3 m/s)', `chance ${f2(100 * a10)}%`, '≥ 70%', a10 >= 0.7);
  // A11–A12: segurar (faltaTatica fora do contra-ataque, origem 'segurar') só quem está escapando do defensor batido
  const s1 = sorteiaSegurar({ dx: -0.7, crumo: 0, bola: [0.4, 0] });             // condutor parado, de costas para ele
  const s2 = sorteiaSegurar({ dx: -0.8, cvx: 1.5, bola: [0.45, 0] });            // condutor andando, o defensor parado
  const s3 = sorteiaSegurar({ dx: -0.9, dvx: 5.5, cvx: 3.5, bola: [0.45, 0] });  // o defensor alcançando (dá o bote)
  reg('A11 segurar sem motivo: o condutor parado · andando · o defensor alcançando (faltas em 3000 passos)', `${s1.n} · ${s2.n} · ${s3.n}`, '0 · 0 · 0', s1.n + s2.n + s3.n === 0);
  const s4 = sorteiaSegurar({ dx: -0.9, dvx: 4.5, cvx: 5, bola: [0.45, 0] });    // escapando a 5 m/s do batido
  reg("A12 (de verdade) segurar quem escapa do defensor batido (5 m/s, ele a 4,5), sem cartão", `${s4.n} em ${s4.N} passos (${f2(100 * s4.n / s4.N)}%) · ${s4.f1 ? `${s4.f1.origem}/${s4.f1.cartao ?? 'sem cartão'}` : '—'}`, '0,05–0,5% · segurar/sem cartão',
    s4.n / s4.N >= 0.0005 && s4.n / s4.N <= 0.005 && s4.f1?.origem === 'segurar' && !s4.f1?.cartao);
  // A13: na própria área o defensor que entraria no homem TIRA O CORPO (faltas.js BOTE_EVITADO) — não vira desarme limpo:
  // com o mesmo contato (de lado, entrando a 3 m/s; o condutor correndo pela largura, sem chance clara), a fração de botes
  // limpos dentro da área é a de fora (o mesmo contato é falta no campo todo) e a falta ainda existe (pênalti)
  const fora = sorteiaBote({ cx: 20, cz: 8, dx: 0.8, dz: 0.1, dvx: -3, dvz: 4, cvz: 4, crumo: Math.PI / 2, bola: [0.45, 0.35] });
  const dentro = sorteiaBote({ cx: 44, cz: 8, dx: 0.8, dz: 0.1, dvx: -3, dvz: 4, cvz: 4, crumo: Math.PI / 2, bola: [0.45, 0.35] });
  reg('A13 bote forte na própria área: limpo dentro × fora · falta dentro', `${pc(Math.round(dentro.limpo * dentro.N), dentro.N)} × ${pc(Math.round(fora.limpo * fora.N), fora.N)} · ${pc(dentro.n, dentro.N)} (${dentro.f1?.area ? 'pênalti' : '—'})`, '|Δ| ≤ 8 pontos · > 0',
    Math.abs(dentro.limpo - fora.limpo) <= 0.08 && dentro.n > 0 && !!dentro.f1?.area && fora.n > 0);
}

// ------------------------------------------------------------------ B. partidas com o humano
const MOD = ['persegue', 'pressao', 'dribla'];
const res = {};
for (const [k, mod] of MOD.entries()) res[mod] = await registrarFaltas(JS, { sementes: Array.from({ length: NP }, (_, i) => 8101 + 100 * k + i), modelos: [mod] });
const todas = MOD.flatMap(md => res[md].faltas), NT = NP * MOD.length;
const semForca = todas.filter(f => f.origem === 'bote' && f.timeDef === 1 && f.forcaContato < 1);
reg('B1 falta de bote da IA com o contato a < 1 m/s (por partida)', `${f2(semForca.length / NT)} (${semForca.length} em ${NT} partidas)`, '≤ 0,1', semForca.length / NT <= 0.1);
const cargaH = todas.filter(f => f.origem === 'carga' && f.timeDef === 0 && (f.controlado || f.chamado));
reg('B2 carga por trás de quem só corria atrás (controlado da pessoa ou chamado da PRESSÃO), por partida', `${f2(cargaH.length / NT)} (${cargaH.length}: ${cargaH.filter(f => f.controlado).length} do controlado, ${cargaH.filter(f => f.chamado).length} do chamado)`, '≤ 0,25', cargaH.length / NT <= 0.25);
{
  const dr = res.dribla, nd = dr.partidas.length;
  const fortes = dr.faltas.filter(f => f.timeDef === 1 && (f.origem === 'bote' || f.origem === 'carga') && f.forcaContato >= 2).length;
  const verm = dr.partidas.reduce((s, p) => s + p.vermelhos, 0), pen = dr.partidas.reduce((s, p) => s + p.penaltis, 0);
  reg("B3 (de verdade) 'dribla': falta da IA entrando forte (≥ 2 m/s) · vermelhos · pênaltis, por partida", `${f2(fortes / nd)} · ${f2(verm / nd)} · ${f2(pen / nd)}`, '≥ 0,5 · ≤ 0,6 · ≤ 0,6',
    fortes / nd >= 0.5 && verm / nd <= 0.6 && pen / nd <= 0.6);
}
{
  // B4: a pessoa que aperta DIVIDIDA (faltas-registro 'dividida': com a bola a ≤ 1,5 m, no máximo a cada 0,4 s) não leva
  // falta com o corpo entrando a < 1 m/s no condutor (main: ~1,9 por partida, 60% das faltas da DIVIDIDA)
  res.dividida = await registrarFaltas(JS, { sementes: Array.from({ length: NP }, (_, i) => 8401 + i), modelos: ['dividida'] });
  const dv = res.dividida.faltas.filter(f => f.origem === 'dividida' && f.timeDef === 0);
  const fracas = dv.filter(f => f.forcaContato < 1).length, nd = res.dividida.partidas.length;
  reg("B4 'dividida': falta da DIVIDIDA da pessoa com o contato a < 1 m/s (por partida)", `${f2(fracas / nd)} (${fracas} de ${dv.length} faltas da DIVIDIDA em ${nd} partidas; ${res.dividida.partidas.reduce((s, p) => s + p.divididas, 0)} divididas)`, '≤ 0,1', fracas / nd <= 0.1);
}
// informativos: por modelo e categoria
for (const mod of [...MOD, 'dividida']) {
  const r = res[mod], n = r.partidas.length, min = r.partidas.reduce((s, p) => s + p.ticksJogo, 0) / 3600;
  const cat = {};
  for (const f of r.faltas) {
    const quem = f.timeDef === 0 ? (f.controlado ? 'controlado' : f.chamado ? 'chamado' : 'companheiro') : 'IA';
    const k = `${quem} ${f.origem}`;
    cat[k] = (cat[k] ?? 0) + 1;
  }
  const s = k => r.partidas.reduce((a, p) => a + p[k], 0);
  reg(`'${mod}': faltas/partida (por min de jogo) · amarelos · vermelhos · pênaltis · categorias`, `${f2(r.faltas.length / n)} (${f2(r.faltas.length / min)}/min) · ${f2(s('amarelos') / n)} · ${f2(s('vermelhos') / n)} · ${f2(s('penaltis') / n)} · ${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`, 'real ~0,40/min', true, true);
}

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(`lógica: ${JS} · ${NP} partidas por modelo (${MOD.join(', ')}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-faltas-sentido: REPROVOU (${falhas})` : '\nteste-faltas-sentido: PASSOU');
process.exit(falhas ? 1 : 0);
