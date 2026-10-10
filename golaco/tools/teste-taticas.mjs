// teste-taticas (Etapa 3, Parte 2): cada controle da tática do "Editar time" move a sua medida, e a
// prévia da tela (posicaoTatica com a bola em 0, 0) é o ponto de referência da IA (tela §7.5).
//
// Cenas ESTÁTICAS (plano 5): a bola parada num ponto, no pé de um condutor parado (o jogador do time
// com a bola cuja vaga com a bola fica mais perto dela); cada um começa na referência da OUTRA fase
// (tem de ir até a certa), 4 s para assentar e a média dos 2 s seguintes. O time medido é o 0.
//  1. Formação: posição média por vaga com a bola no centro a ≤ 3 m da tabela (formacoes.js, sem e
//     com a bola) em ≥ 9 de 11, nas 6 formações e nas 2 fases. (Sem a bola, com a pressão Baixa: a
//     referência é a mesma da padrão — a pressão não entra na posicaoTatica — e só o 1º homem sai da
//     vaga; o goleiro é do goleiro.js, fica na linha, e conta como uma das 2 vagas de folga.)
//  2. Altura da linha Baixa/Média/Alta: 26 / 32,5 / 40 ± 2 m (pesquisa §3.1), crescente, passos ≥ 5 m.
//  3. Largura com a bola Estreita/Normal/Aberta: 42 / 48 / 55 ± 3 m (pesquisa §2.1), crescente.
//  4. Mentalidade: x médio com a bola +≥ 2 m por nível (−2..+2).
//  5. Jogadores na área no cruzamento por mentalidade: 2/2/3/4/5 ± 1, não decrescente e +≥ 2 de −2
//     a +2 (Metrica: mediana 3, p90 5). É o ataque à área da Parte 3: sem ela, só informa.
// PRESSÃO Baixa/Média/Alta → distância do 1º marcador até o condutor (mediana) decrescente, ≥ 0,7 m
// por nível, numa cena controlada (condutor em linha reta, sem passar nem fugir); a mesma medida no
// jogo IA × IA (4 sementes × 1,5 min por nível) sai só para informar.
// CONTRATO tela × IA: (a) posicaoTatica com a bola em (0, 0) e a tática padrão a ≤ 3 m da tabela da
// formação em todas as vagas (6 formações × 2 fases; a tabela é de médias); (b) a referência que a
// IA usa no jogo (m.iaBloco) = posicaoTatica da bola de referência daquele tick (bit a bit).
//   node tools/teste-taticas.mjs [--antes] [--js <pasta>] [--sementes N] [--base K] [--detalhe]
import * as T from './lib/partida-tatica.mjs';

const a = T.argumentos(4);
const L = await T.carregar(a.js);
const P3 = T.parte3Presente(L);
const ATAQUE = P3 ? 'jogo' : 'substituto'; // sem a Parte 3, o ataque substituto dos testes (lib/partida-tatica.mjs)
const { fmt, mediana, media } = T;
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok, info = false) {
  linhas.push([nome, medido, meta, info ? (ok ? 'passa (informativo)' : 'AGUARDANDO PARTE 3') : ok ? 'PASSOU' : 'REPROVOU']);
  if (!ok && !info) falhas++;
}
const TAT = (o = {}) => ({ mentalidade: 0, pressao: 1, largura: 1, linha: 1, ...o });

/**
 * Cena estática. o = {formacao, tatica (do time 0), fase ('sem'|'com' do time 0), bola {x, z} (mundo),
 * assenta (s), media (s)}. Devolve {m, media: Map(id → {x, z}), contrato, perdeu, cond}.
 */
function cena(o) {
  const tm = 0, tc = o.fase === 'com' ? 0 : 1;
  const m = L.P.criarPartida({ semente: 7, minutosPorTempo: 60, iaClassica: a.antes,
    times: { 0: { formacao: o.formacao, tatica: o.tatica }, 1: { tatica: TAT({ pressao: 0 }) } } });
  const bx = o.bola.x, bz = o.bola.z;
  // condutor: a vaga com a bola do time tc mais perto da bola
  const Tc = m.times[tc], Fc = L.F.FORMACOES[Tc.formacao], lc = m.ataca[tc];
  let vc = null, dm = Infinity;
  for (const v of Fc.vagas) {
    if (v.grupo === 'gol') continue;
    const d = Math.hypot(v.com.x * lc - bx, v.com.z * lc - bz);
    if (d < dm) { dm = d; vc = v; }
  }
  const cond = L.S.jogadorPorId(m, Tc.vagas[vc.id]);
  // cada um começa na referência da OUTRA fase (o medido) ou na da sua (o adversário)
  const r = { x: 0, z: 0 };
  for (const j of m.jogadores) {
    if (j === cond || j.posicao === 'GOL') continue;
    const T2 = m.times[j.time];
    const faseJ = j.time === tc ? 'com' : 'sem';
    const fase0 = j.time === tm ? (faseJ === 'com' ? 'sem' : 'com') : faseJ;
    L.T.posicaoTatica(T2.formacao, j.vagaId, T2.tatica, o.bola, fase0, m.ataca[j.time], r);
    L.P.teleportar(j, r.x, r.z, m.ataca[j.time] > 0 ? 0 : Math.PI);
  }
  L.P.teleportar(cond, bx - 0.45 * lc, bz, lc > 0 ? 0 : Math.PI);
  Object.assign(m.bola, L.Bo.criarBola(bx, bz));
  m.posse = cond.id; m.naMao = null; m.voo = null; m.parada = null;
  m.humanos = [tc]; m.controlado = { [tc]: cond.id };
  // a cena mede a FORMA: o adversário fica parado nas referências dele (com a bola no centro, a
  // vaga do meia dele cai em cima da bola e ele a roubaria do condutor parado) e ninguém dá bote
  for (const j of m.jogadores) {
    if (j.time !== tm && j !== cond && j.posicao !== 'GOL') j.papel = 'parado';
    if (j.time === tm) j.descansoBote = 1e9;
  }
  const ent = { [tc]: { x: 0, z: 0, botoes: 0 } };
  const nA = Math.round((o.assenta ?? 4) * 60), nM = Math.round((o.media ?? 2) * 60);
  const soma = new Map();
  let contrato = null, perdeu = false;
  for (let i = 0; i < nA + nM; i++) {
    const tick = m.tick;
    L.S.passo(m, ent);
    if (m.posse !== cond.id) perdeu = true;
    // a bola fica PARADA no ponto (no pé do condutor): esbarrões e toques de ajuste não a levam embora
    if (Math.hypot(m.bola.p.x - bx, m.bola.p.z - bz) > 0.02 || m.posse !== cond.id) {
      Object.assign(m.bola, L.Bo.criarBola(bx, bz));
      m.posse = cond.id; m.voo = null;
    }
    // contrato (b): a referência que a IA usou neste tick = posicaoTatica com a bola deste tick
    const B = m.iaBloco?.[tm];
    if (i >= nA && B && B.refTick === tick && m.iaTime?.[tm]?.mistura === 1 && contrato !== false) {
      const T0 = m.times[tm], F0 = L.F.FORMACOES[T0.formacao];
      // a referência é a posicaoTatica da bola de referência do tick (bit a bit): a bola, ou onde
      // ela estará pela velocidade de quem a conduz (TATICA.antecipa)
      let ok = true;
      for (const v of F0.vagas) {
        const k = F0.indice[v.id];
        L.T.posicaoTatica(T0.formacao, v, T0.tatica, B.bolaRef, o.fase, m.ataca[tm], r);
        if (r.x !== B.ref[2 * k] || r.z !== B.ref[2 * k + 1]) ok = false;
      }
      contrato = ok;
    }
    if (i < nA) continue;
    for (const j of m.jogadores) {
      if (j.time !== tm) continue;
      const s = soma.get(j.id) ?? { x: 0, z: 0 };
      s.x += j.x / nM; s.z += j.z / nM;
      soma.set(j.id, s);
    }
  }
  return { m, media: soma, contrato: contrato === true, perdeu, cond };
}

const uDe = (m, x) => x * m.ataca[0];
const wDe = (m, z) => z * m.ataca[0];
const perdas = [];

// ---------------------------------------------------------------- 1. formação (6 × 2) e contrato (b)
let piorForm = { n: 11, txt: '' }, contratoB = true, contratoN = 0;
const porForm = [];
for (const f of Object.keys(L.F.FORMACOES)) {
  for (const fase of ['sem', 'com']) {
    const c = cena({ formacao: f, tatica: TAT(fase === 'sem' ? { pressao: 0 } : {}), fase, bola: { x: 0, z: 0 } });
    if (c.perdeu) perdas.push(`${f} ${fase}`);
    const T0 = c.m.times[0], F0 = L.F.FORMACOES[f], l = c.m.ataca[0];
    let n = 0;
    const longe = [];
    for (const v of F0.vagas) {
      const p = c.media.get(T0.vagas[v.id]);
      const d = Math.hypot(p.x - v[fase].x * l, p.z - v[fase].z * l);
      if (d <= 3) n++; else longe.push(`${v.id} ${fmt(d)}`);
    }
    porForm.push(`${f} ${fase} ${n}/11${longe.length ? ` (${longe.join(', ')})` : ''}`);
    if (n < piorForm.n) piorForm = { n, txt: `${f} ${fase}: ${n}/11 (longe: ${longe.join(', ')})` };
    contratoN++;
    if (!c.contrato) contratoB = false;
  }
}
reg('formação: vagas a ≤ 3 m da tabela (6 formações × 2 fases, pior caso)', piorForm.n === 11 ? 'todas 11/11' : piorForm.txt, '≥ 9 de 11', piorForm.n >= 9);

// ------------------------------------------------------------------------- 2. altura da linha
const alturas = [];
for (let n = 0; n < 3; n++) {
  const c = cena({ formacao: '4-3-3', tatica: TAT({ pressao: 0, linha: n }), fase: 'sem', bola: { x: 0, z: 0 } });
  const T0 = c.m.times[0], F0 = L.F.FORMACOES['4-3-3'];
  let min = Infinity;
  for (const v of F0.vagas) if (v.grupo === 'def') min = Math.min(min, uDe(c.m, c.media.get(T0.vagas[v.id]).x));
  alturas.push(min + 52.5);
}
const ALT = [26, 32.5, 40];
reg('altura da linha Baixa / Média / Alta (bola no centro)', alturas.map(v => `${fmt(v)} m`).join(' / '), '26 / 32,5 / 40 ± 2 m, passos ≥ 5 m',
  alturas.every((v, k) => Math.abs(v - ALT[k]) <= 2) && alturas[1] - alturas[0] >= 5 && alturas[2] - alturas[1] >= 5);

// --------------------------------------------------------------------- 3. largura com a bola
const larguras = [];
for (let n = 0; n < 3; n++) {
  const c = cena({ formacao: '4-3-3', tatica: TAT({ largura: n }), fase: 'com', bola: { x: 0, z: 0 } });
  let a0 = Infinity, a1 = -Infinity;
  for (const j of c.m.jogadores) {
    if (j.time !== 0 || j.posicao === 'GOL') continue;
    const w = wDe(c.m, c.media.get(j.id).z);
    a0 = Math.min(a0, w); a1 = Math.max(a1, w);
  }
  larguras.push(a1 - a0);
}
const LAR = [42, 48, 55];
reg('largura com a bola Estreita / Normal / Aberta', larguras.map(v => `${fmt(v)} m`).join(' / '), '42 / 48 / 55 ± 3 m, crescente',
  larguras.every((v, k) => Math.abs(v - LAR[k]) <= 3) && larguras[1] > larguras[0] && larguras[2] > larguras[1]);

// ------------------------------------------------------------- 4. mentalidade (x médio com a bola)
const xs = [];
for (let n = -2; n <= 2; n++) {
  const c = cena({ formacao: '4-3-3', tatica: TAT({ mentalidade: n }), fase: 'com', bola: { x: 0, z: 0 } });
  const us = c.m.jogadores.filter(j => j.time === 0 && j.posicao !== 'GOL' && j !== c.cond).map(j => uDe(c.m, c.media.get(j.id).x));
  xs.push(media(us));
}
const passosX = xs.slice(1).map((v, k) => v - xs[k]);
reg('mentalidade: x médio com a bola, −2 → +2', `${xs.map(v => fmt(v)).join(' / ')} (passos ${passosX.map(v => fmt(v)).join(' / ')})`, '+≥ 2 m por nível', passosX.every(v => v >= 2));

// ------------------------------------------------- 5. na área no cruzamento (ataque à área: Parte 3)
const naArea = [];
for (let n = -2; n <= 2; n++) {
  const c = cena({ formacao: '4-3-3', tatica: TAT({ mentalidade: n }), fase: 'com', bola: { x: 40, z: 25 } });
  let s = 0;
  for (const j of c.m.jogadores) {
    if (j.time !== 0 || j.posicao === 'GOL' || j === c.cond) continue;
    const p = c.media.get(j.id);
    if (uDe(c.m, p.x) > 36 && Math.abs(wDe(c.m, p.z)) < 20.16) s++;
  }
  naArea.push(s);
}
const NA = [2, 2, 3, 4, 5];
reg('na área no cruzamento, mentalidade −2 → +2', naArea.join(' / '), '2/2/3/4/5 ± 1, não decresce, +≥ 2',
  naArea.every((v, k) => Math.abs(v - NA[k]) <= 1) && naArea.every((v, k) => k === 0 || v >= naArea[k - 1]) && naArea[4] - naArea[0] >= 2, !P3);

// ------------------------------------------- 6. pressão: 1º marcador (cena controlada + informativo)
// Cena: o meia do Ventania conduz em linha reta, trotando, do campo dele até a nossa área (3 faixas
// do campo × 2 sementes), sem passar nem fugir; o time 0 defende com a pressão Baixa/Média/Alta.
// Mede a distância do marcador mais perto (mediana, enquanto ele tem a bola). Assim o controle é que
// muda a medida (no jogo, a mediana também depende de quando o condutor passa ou foge do aperto:
// a dinâmica sai abaixo só para informar; as faixas por nível estão no teste-pressao).
function cenaPressao(p, z0, sem) {
  const m = L.P.criarPartida({ semente: sem, minutosPorTempo: 60, iaClassica: a.antes,
    times: { 0: { tatica: TAT({ pressao: p }) }, 1: { tatica: TAT({ pressao: 0 }) } } });
  const T1 = m.times[1], F1 = L.F.FORMACOES[T1.formacao];
  let vc = null, dm = Infinity;
  for (const v of F1.vagas) { if (v.grupo === 'gol') continue; const d = Math.hypot(v.com.x * -1 - 12, v.com.z * -1 - z0); if (d < dm) { dm = d; vc = v; } }
  const cond = L.S.jogadorPorId(m, T1.vagas[vc.id]);
  const r = { x: 0, z: 0 }, bola = { x: 12, z: z0 };
  for (const j of m.jogadores) {
    if (j === cond || j.posicao === 'GOL') continue;
    const T2 = m.times[j.time];
    L.T.posicaoTatica(T2.formacao, j.vagaId, T2.tatica, bola, j.time === 1 ? 'com' : 'sem', m.ataca[j.time], r);
    L.P.teleportar(j, r.x, r.z, m.ataca[j.time] > 0 ? 0 : Math.PI);
  }
  L.P.teleportar(cond, 12.45, z0, Math.PI);
  Object.assign(m.bola, L.Bo.criarBola(12, z0));
  m.posse = cond.id; m.naMao = null; m.voo = null; m.parada = null;
  m.humanos = [1]; m.controlado = { 1: cond.id };
  const ds = [];
  for (let i = 0; i < 12 * 60; i++) {
    L.S.passo(m, { 1: { x: -0.55, z: 0, botoes: 0 } });
    if (m.posse !== cond.id || cond.x < -30) break;
    if (i < 60) continue;
    let d = Infinity;
    for (const o of m.jogadores) if (o.time === 0 && o.posicao !== 'GOL') d = Math.min(d, Math.hypot(o.x - cond.x, o.z - cond.z));
    ds.push(d);
  }
  return ds;
}
const prim = [], primN = [];
for (let p = 0; p < 3; p++) {
  const ds = [];
  for (const sem of [11, 12]) for (const z0 of [-12, 0, 12]) ds.push(...cenaPressao(p, z0, sem));
  prim.push(mediana(ds)); primN.push(ds.length);
}
reg('pressão Baixa / Média / Alta: 1º marcador até o condutor (cena controlada)', `${prim.map(v => `${fmt(v)} m`).join(' / ')} (${primN.join(' / ')} amostras)`, 'decrescente, ≥ 0,7 m por nível',
  prim[0] - prim[1] >= 0.7 && prim[1] - prim[2] >= 0.7);
// a mesma medida no jogo (IA × IA, 4 sementes × 1,5 min por nível): só informa
const primJ = [];
for (let p = 0; p < 3; p++) {
  const tat = TAT({ pressao: p });
  const R = T.medirJogos(L, a.sementes, { antes: a.antes, min: 1.5, ataque: ATAQUE, times: { 0: { tatica: tat }, 1: { tatica: tat } } });
  primJ.push(mediana(R.m1));
}
linhas.push(['  a mesma medida no jogo (IA × IA, informativo)', primJ.map(v => `${fmt(v)} m`).join(' / '), '—', 'informa']);

// ------------------------------------------------------------------------------ 7. contrato
// (a tabela é de posições MÉDIAS — que encolhem a largura e juntam as linhas, pesquisa §1.2 —; a
// prévia é o ponto do instante: a mesma folga de 3 m do teste da formação)
let desvioA = 0, piorA = '';
const r = { x: 0, z: 0 };
for (const [f, F] of Object.entries(L.F.FORMACOES)) {
  for (const fase of ['sem', 'com']) {
    for (const v of F.vagas) {
      L.T.posicaoTatica(f, v.id, TAT(), { x: 0, z: 0 }, fase, 1, r);
      const d = Math.hypot(r.x - v[fase].x, r.z - v[fase].z);
      if (d > desvioA) { desvioA = d; piorA = `${f} ${fase} ${v.id}`; }
    }
  }
}
reg('contrato (a): prévia (bola em 0, 0, tática padrão) × tabela da formação', `maior desvio ${fmt(desvioA, 2)} m (${piorA})`, '≤ 3 m em todas as vagas', desvioA <= 3);
reg('contrato (b): referência da IA no jogo = posicaoTatica da bola de referência do tick', `${contratoB ? 'igual' : 'diferente (ou a IA não usa a tática)'} em ${contratoN} cenas`, 'igual', contratoB);

console.log(`lógica: ${a.js}${a.antes ? '  (--antes: IA clássica no 11×11)' : ''} · Parte 3 ${P3 ? 'presente (jogo de verdade)' : 'ausente: ataque substituto dos testes; o ataque à área só informa'}`);
if (a.detalhe) console.log('formações: ' + porForm.join(' · ') + (perdas.length ? `\ncondutor perdeu a bola em: ${perdas.join(', ')}` : ''));
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-taticas: REPROVOU (${falhas})` : '\nteste-taticas: PASSOU');
process.exit(falhas ? 1 : 0);
