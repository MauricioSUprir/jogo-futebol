// "Quando a bola pega no goleiro, trava" (dono, 09/10): o MEU goleiro (id 10) que pega a bola solta
// (rebote da própria espalmada, recuo, bola fraca) vira o controlado e fica com ela PARA SEMPRE se o
// jogador não apertar PASSE/CHUTE/LANÇAMENTO/ENFIADA: o analógico não o move, TROCAR é bloqueado com
// a bola na mão e nada repõe por ele. Metas (treino de ataque, sessao.js passoTreino):
//  1. IA chuta no meu goleiro e o humano só mexe o analógico / CORRER / GOLEIRO: a bola sai das mãos
//     em ≤ 3,5 s em todos os casos (GOLEIRO.esperaHumano + folga);
//  2. TROCAR com o goleiro segurando a bola: o controle vai para um jogador de linha no mesmo passo e
//     a bola sai das mãos em ≤ 2 s;
//  3. recuo (passe para o próprio goleiro): a bola sai das mãos em ≤ 3,5 s sem botão de ação;
//  4. jogo livre com quem não sabe repor (6 sementes × 3 min): nenhuma parada > 5 s com a bola na mão;
//  5. sem recuo: quem aperta PASSE com o goleiro tem o PASSE dele (≤ 1,3 s); carregando LANÇAMENTO a
//     reposição automática não atropela a carga; o goleiro da IA continua repondo em 1,5 s.
//   node tools/teste-goleiro-trava.mjs            (no repositório: golaco/tools/)
//   node teste-goleiro-trava.mjs --js <pasta js>  (diagnóstico: roda contra outra cópia da lógica)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const S = await imp('sessao.js');
const { BOTAO, CAMPO } = await imp('config.js');
const { assumirControle } = await imp('acoes.js');
const { criarRng, uniforme } = await imp('rng.js');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));

const jp = (m, id) => m.jogadores.find(j => j.id === id);
/** Teletransporta o jogador parado (corpo, pés e pontos guardados dos pés). */
function mover(j, nx, nz, rumo) {
  const dx = nx - j.x, dz = nz - j.z;
  j.x = nx; j.z = nz; j.vx = 0; j.vz = 0; j.ax = 0; j.az = 0; j.giro = 0; j.rumo = rumo;
  for (const p of j.pes) { p.x += dx; p.z += dz; p.lx += dx; p.lz += dz; p.gx += dx; p.gz += dz; p.tx += dx; p.tz += dz; p.bx += dx; p.bz += dz; }
  j.intercepta = null; j.recebe = null; j.corrida = null;
  if (j.cond) { j.cond.toque = null; j.cond.ref = null; j.cond.busca = false; j.cond.longeDesde = -1; }
}
function darBola(m, id) {
  const j = jp(m, id), b = m.bola;
  b.p.x = j.x + Math.cos(j.rumo) * 0.4; b.p.z = j.z + Math.sin(j.rumo) * 0.4; b.p.y = 0.11;
  b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0; b.rolando = true;
  m.posse = id; m.naMao = null; m.voo = null;
  if (j.time === 0 && m.controlado[0] !== id) assumirControle(m, 0, j);
}
/** Entrada de quem defende: corre com o controlado para a bola. */
function correNaBola(m) {
  const j = jp(m, m.controlado[0]), b = m.bola.p, dx = b.x - j.x, dz = b.z - j.z, l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l, botoes: BOTAO.CORRER };
}

/**
 * A IA (id 23) ataca o meu gol com a bola; o humano corre na bola e, quando o meu goleiro fica com
 * ela, segue `perfil(m, t)` (t = ticks com a bola na mão). Devolve {pegou, segurou (s), ctrlGK,
 * trocaNoPasso, eventos de reposição}. Para 2 s depois de a bola sair da mão (ou maxS com ela).
 */
function ataqueDaIA(sem, x0, z0, perfil, maxS = 12) {
  const m = S.criarTreino({ semente: sem });
  for (const [id, x, z] of [[0, -5, 0], [1, 10, 2], [2, 5, -20], [3, 5, 20], [4, -12, 0]]) mover(jp(m, id), x, z, Math.PI);
  mover(jp(m, 23), x0, z0, Math.PI); mover(jp(m, 21), x0 + 6, z0 - 8, Math.PI); mover(jp(m, 22), x0 + 6, z0 + 8, Math.PI);
  darBola(m, 23);
  let t0 = null, tSolta = null, ctrlGK = false, trocaNoPasso = null, repos = [];
  for (let i = 0; i < 60 * 30; i++) {
    let e;
    if (m.naMao === 10) {
      if (t0 == null) t0 = m.tick;
      if (m.controlado[0] === 10) ctrlGK = true;
      e = perfil(m, m.tick - t0);
    } else e = correNaBola(m);
    const antes = m.controlado[0];
    const ev = S.passoTreino(m, e);
    if (t0 != null && m.naMao === 10 && (e.botoes & BOTAO.TROCAR) && antes === 10 && trocaNoPasso == null) trocaNoPasso = m.controlado[0] !== 10;
    if (t0 != null && tSolta == null && m.naMao !== 10) { tSolta = m.tick; repos = ev.filter(x => (x.tipo === 'passe' || x.tipo === 'chute') && x.id === 10).map(x => x.modo); }
    if (tSolta != null && m.tick - tSolta > 120) break;
    if (t0 != null && tSolta == null && m.tick - t0 > maxS * 60) break;
    if (t0 == null && (m.golTick != null || i > 60 * 12)) break;
  }
  return { pegou: t0 != null, segurou: t0 == null ? 0 : ((tSolta ?? m.tick) - t0) / 60, solto: tSolta != null, ctrlGK, trocaNoPasso, repos };
}
const CASOS_IA = [];
for (let s = 1; s <= 12; s++) for (const z0 of [-8, 0, 8]) for (const x0 of [-36, -30]) CASOS_IA.push([s * 31 + 7, x0, z0]);

// ------------------------------------------------------------ 1. só analógico / CORRER / GOLEIRO
{
  const perfil = (m, t) => ({ x: Math.cos(t * 0.04), z: Math.sin(t * 0.04), botoes: (t % 120 < 60 ? BOTAO.CORRER : BOTAO.GOLEIRO) });
  let n = 0, nCtrl = 0, pior = 0, presos = 0;
  for (const c of CASOS_IA) {
    const r = ataqueDaIA(...c, perfil);
    if (!r.pegou) continue;
    n++; if (r.ctrlGK) nCtrl++;
    pior = Math.max(pior, r.segurou);
    if (!r.solto) presos++;
  }
  reg('IA chuta no meu goleiro; humano só mexe analógico/CORRER/GOLEIRO — bola nas mãos',
    `${n} casos (${nCtrl} com o controle no goleiro): pior ${fmt(pior)} s, ${presos} presos ≥ 12 s`, '≤ 3,5 s em todos', n >= 20 && nCtrl >= 10 && pior <= 3.5);
}
// ------------------------------------------------------------ 2. TROCAR com o goleiro segurando
{
  const perfil = (m, t) => ({ x: 0, z: 0, botoes: t >= 30 && t < 34 ? BOTAO.TROCAR : 0 });
  let n = 0, trocou = 0, pior = 0;
  for (const c of CASOS_IA) {
    const r = ataqueDaIA(...c, perfil);
    if (!r.pegou || !r.ctrlGK) continue;
    n++; if (r.trocaNoPasso) trocou++;
    pior = Math.max(pior, r.segurou);
  }
  reg('TROCAR com o goleiro segurando: controle vai para a linha e a bola sai das mãos',
    `${trocou}/${n} trocaram no passo; bola nas mãos: pior ${fmt(pior)} s`, `${n}/${n} · ≤ 2 s`, n >= 10 && trocou === n && pior <= 2.0);
}
// ------------------------------------------------------------ 2b. reposição sem recebedor
{
  // LANÇAMENTO com o analógico para a lateral vazia (ninguém no cone): a bola vai no espaço e o
  // humano não pode ficar controlando o goleiro sem a bola (o analógico não move o goleiro)
  let n = 0, presos = 0, pior = 0;
  for (const c of CASOS_IA) {
    const sem = c[0];
    const m0 = ataqueDaIA(...c, () => ({ x: 0, z: 0, botoes: 0 }), 0.2);
    if (!m0.pegou || !m0.ctrlGK) continue;
    // de novo, agora com o LANÇAMENTO para a lateral
    const m = S.criarTreino({ semente: sem });
    for (const [id, x, z] of [[0, -5, 0], [1, 10, 2], [2, 5, -20], [3, 5, 20], [4, -12, 0]]) mover(jp(m, id), x, z, Math.PI);
    mover(jp(m, 23), c[1], c[2], Math.PI); mover(jp(m, 21), c[1] + 6, c[2] - 8, Math.PI); mover(jp(m, 22), c[1] + 6, c[2] + 8, Math.PI);
    darBola(m, 23);
    let t0 = null, tSolta = null, semBola = 0;
    for (let i = 0; i < 60 * 25; i++) {
      let e;
      if (m.naMao === 10) { if (t0 == null) t0 = m.tick; const t = m.tick - t0; e = { x: 0, z: 1, botoes: t >= 40 && t < 50 ? BOTAO.LANCAMENTO : 0 }; }
      else if (tSolta != null) e = { x: 1, z: 0, botoes: 0 }; // o humano tenta sair jogando com o analógico
      else e = correNaBola(m);
      S.passoTreino(m, e);
      if (t0 != null && tSolta == null && m.naMao !== 10) tSolta = m.tick;
      if (tSolta != null) {
        if (m.controlado[0] === 10 && m.posse !== 10) semBola++;
        if (m.tick - tSolta > 180) break;
      }
      if (t0 == null && i > 60 * 12) break;
    }
    if (tSolta == null) continue;
    n++; if (semBola > 0) presos++; pior = Math.max(pior, semBola / 60);
  }
  reg('reposição sem recebedor: o humano não fica controlando o goleiro sem a bola', `${presos}/${n} ficaram no goleiro, pior ${fmt(pior)} s`, '0', n >= 10 && presos === 0);
}
// ------------------------------------------------------------ 3. recuo para o goleiro
{
  let n = 0, pior = 0, passes = 0;
  for (const dist of [12, 28, 38]) for (const zo of [-10, 0, 10]) for (const ft of [2, 30]) for (const sem of [1, 2]) {
    const m = S.criarTreino({ semente: 900 + sem });
    const x0 = -CAMPO.meioX + dist;
    for (const [id, x, z] of [[0, x0 + 15, 5], [1, x0 + 30, 0], [2, x0 + 20, -20], [3, x0 + 20, 20]]) mover(jp(m, id), x, z, 0);
    for (const [id, x, z] of [[21, x0 + 25, -7], [22, x0 + 25, 7], [23, x0 + 18, 0]]) mover(jp(m, id), x, z, Math.PI);
    mover(jp(m, 4), x0, zo, Math.PI);
    darBola(m, 4);
    for (let i = 0; i < 30; i++) S.passoTreino(m, { x: 0, z: 0, botoes: 0 });
    if (m.posse !== 4) darBola(m, 4);
    let passou = false, t0 = null, tSolta = null;
    for (let i = 0; i < 60 * 20; i++) {
      const j = jp(m, m.controlado[0]), g = jp(m, 10);
      let e;
      if (!passou) { const dx = g.x - j.x, dz = g.z - j.z, l = Math.hypot(dx, dz) || 1; e = { x: dx / l, z: dz / l, botoes: i < ft ? BOTAO.PASSE : 0 }; }
      else e = correNaBola(m); // analógico na bola (com quem estiver controlando), sem botão de ação
      const ev = S.passoTreino(m, e);
      if (ev.some(x => x.tipo === 'passe' && x.id === 4 && x.para === 10)) { passou = true; passes++; }
      if (m.naMao === 10 && t0 == null) t0 = m.tick;
      if (t0 != null && tSolta == null && m.naMao !== 10) tSolta = m.tick;
      if (tSolta != null || (t0 != null && m.tick - t0 > 12 * 60) || m.golTick != null) break;
    }
    if (t0 == null) continue;
    n++;
    pior = Math.max(pior, ((tSolta ?? m.tick) - t0) / 60);
  }
  reg('recuo para o meu goleiro, sem botão de ação depois — bola nas mãos', `${n} casos (${passes} recuos): pior ${fmt(pior)} s`, '≤ 3,5 s', n >= 20 && pior <= 3.5);
}
// ------------------------------------------------------------ 4. jogo livre com quem não sabe repor
{
  function humano(sem) {
    const r = criarRng(sem * 7919 + 2);
    let ate = 0, botao = 0, seg = 0, t0 = 0;
    return m => {
      const j = jp(m, m.controlado[0]);
      if (m.naMao === j.id) {
        // não sabe que tem de apertar PASSE/LANÇAMENTO: mexe o analógico, corre, aperta GOLEIRO
        const t = m.tick - (j.segura?.desde ?? m.tick);
        return { x: Math.cos(t * 0.05), z: Math.sin(t * 0.05), botoes: Math.floor(t / 40) % 2 ? BOTAO.GOLEIRO : BOTAO.CORRER };
      }
      if (m.tick >= ate) {
        ate = m.tick + 18 + Math.floor(uniforme(r) * 55); const u = uniforme(r); botao = 0; t0 = m.tick;
        if (m.posse === j.id) { const dGol = Math.hypot(CAMPO.meioX - j.x, j.z); if (dGol < 25 && u < 0.5) botao = BOTAO.CHUTE; else if (u < 0.25) botao = BOTAO.PASSE; seg = 6 + Math.floor(uniforme(r) * 40); }
        else if (u < 0.12) { botao = BOTAO.TROCAR; seg = 3; } else if (u < 0.2) { botao = BOTAO.GOLEIRO; seg = 40; }
      }
      const b = m.bola.p; let dx, dz;
      if (m.posse === j.id) { dx = CAMPO.meioX - 6 - j.x; dz = -j.z * 0.5; } else { dx = b.x - j.x; dz = b.z - j.z; }
      const l = Math.hypot(dx, dz) || 1;
      return { x: dx / l, z: dz / l, botoes: (botao && m.tick - t0 < seg ? botao : 0) | BOTAO.CORRER };
    };
  }
  let paradas = 0, pior = 0, total = 0, segurando = 0;
  for (let sem = 1; sem <= 6; sem++) {
    const m = S.criarTreino({ semente: sem });
    const h = humano(sem);
    let desde = null;
    for (let i = 0; i < 60 * 60 * 3; i++) {
      S.passoTreino(m, h(m));
      total++;
      if (m.naMao != null) { segurando++; if (desde == null) desde = m.tick; }
      else if (desde != null) { const s = (m.tick - desde) / 60; if (s > 5) paradas++; pior = Math.max(pior, s); desde = null; }
    }
    if (desde != null) { const s = (m.tick - desde) / 60; if (s > 5) paradas++; pior = Math.max(pior, s); }
  }
  reg('jogo livre (6 × 3 min) com quem não sabe repor — bola parada nas mãos do goleiro',
    `${paradas} paradas > 5 s, maior ${fmt(pior)} s, ${fmt(100 * segurando / total)}% do tempo com a bola na mão`, '0 paradas > 5 s', paradas === 0);
}
// ------------------------------------------------------------ 5. sem recuo
{
  // quem sabe: PASSE (J) 1 s depois de pegar → o passe dele
  let n = 0, pior = 0, doHumano = 0;
  for (const c of CASOS_IA) {
    const r = ataqueDaIA(...c, (m, t) => ({ x: 1, z: 0, botoes: t >= 60 && t < 64 ? BOTAO.PASSE : 0 }));
    if (!r.pegou || !r.ctrlGK) continue;
    n++; pior = Math.max(pior, r.segurou); if (r.repos.includes('passe')) doHumano++;
  }
  reg('quem aperta PASSE com o goleiro: sai o PASSE dele', `${doHumano}/${n} passes, pior ${fmt(pior, 2)} s`, `${n}/${n} · ≤ 1,3 s`, n >= 10 && doHumano === n && pior <= 1.3);
  // carregando LANÇAMENTO por cima dos 3 s: a reposição automática não atropela a carga
  let nL = 0, atropelou = 0;
  for (const c of CASOS_IA) {
    const r = ataqueDaIA(...c, (m, t) => ({ x: 1, z: 0, botoes: t >= 150 && t < 240 ? BOTAO.LANCAMENTO : 0 }));
    if (!r.pegou || !r.ctrlGK) continue;
    nL++; if (r.segurou < 150 / 60 + 0.5) atropelou++;
  }
  reg('carregando LANÇAMENTO (2,5–4 s): solta no fim da carga do humano', `${atropelou}/${nL} soltaram antes da carga`, '0', nL >= 10 && atropelou === 0);
  // goleiro da IA (id 20): continua repondo em 1,5 s
  let nI = 0, fora = 0, mn = Infinity, mx = 0;
  for (const d of [12, 18, 24]) for (const zo of [-5, 0, 5]) for (const ft of [2, 8, 20]) for (const sem of [1, 2]) {
    const m = S.criarTreino({ semente: 500 + sem + d });
    const x0 = CAMPO.meioX - d;
    mover(jp(m, 0), x0, zo, Math.atan2(-zo, CAMPO.meioX - x0));
    mover(jp(m, 21), x0 - 6, zo - 9, 0); mover(jp(m, 22), x0 - 6, zo + 9, 0); mover(jp(m, 23), x0 - 9, zo, 0);
    darBola(m, 0);
    let t0 = null;
    for (let i = 0; i < 60 * 10; i++) {
      const j = jp(m, m.controlado[0]), a = Math.atan2(-j.z, CAMPO.meioX - j.x);
      S.passoTreino(m, { x: Math.cos(a), z: Math.sin(a), botoes: i < ft ? BOTAO.CHUTE : 0 });
      if (m.golTick != null) break; // depois de um gol a jogada recomeça sozinha (2,5 s): não conta
      if (m.naMao === 20 && t0 == null) t0 = m.tick;
      if (t0 != null && m.naMao !== 20) { const s = (m.tick - t0) / 60; nI++; mn = Math.min(mn, s); mx = Math.max(mx, s); if (s < 1.4 || s > 1.6) fora++; break; }
    }
  }
  reg('goleiro da IA repõe em 1,5 s (sem mudança)', `${nI} casos: ${fmt(mn, 2)}–${fmt(mx, 2)} s`, '1,4–1,6 s', nI >= 10 && fora === 0);
}

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(`lógica: ${JS}`);
console.log(linhas.map(l => l.map((v, c) => String(v).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-goleiro-trava: REPROVOU (${falhas})` : '\nteste-goleiro-trava: PASSOU');
process.exit(falhas ? 1 : 0);
