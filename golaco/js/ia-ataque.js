// IA com a bola na partida (Etapa 3, Parte 3): apoio ao condutor (linhas de passe, largura e
// corredores), corridas nas costas da defesa com o impedimento como forma, ataque à área no
// cruzamento e a decisão do condutor por utilidade (ameaça esperada, xT). Pura: sem three.js nem
// DOM; só MD (sem aleatoriedade própria). Plano 2.5 e 2.6; constantes em config.js IA_ATAQUE.
//
// Contrato com ia-tatica.js: ela chama estas funções com o time na fase 'com' (faseDoTime) e
// depois de tratar recebe / corrida / bola livre. Devolvem a ENTRADA VIRTUAL {x, z, botoes} (a mesma
// forma do ia.js, pelo para() com os modos) ou null — null = a IA clássica decide.
//
// Como joga (tudo no referencial de quem ataca: u = x·ataca para o gol adversário, w = z·ataca):
//  - Referência de cada um = a do time (ia-tatica.js blocoDoTime: posicaoTatica da vaga com a bola), misturada com a sem bola
//    nos TATICA.mistura s depois da retomada e calculada com a bola antecipada (filtrada) — o time
//    anda com o passe. Impedimento é FORMA: fora da corrida ninguém passa da linha do penúltimo
//    adversário − 1 m (quem é seguido pelo marcador que faz a linha a empurra); atacantes e pontas
//    jogam na linha; ninguém recua a menos de IA.recuoMin m do meu gol; quem não é apoio não encosta
//    no condutor; vem e vai leve na linha da referência (dar opção).
//  - Apoio curto (Steiner 2018; Buckland 2004): os 2 companheiros de linha mais perto do condutor
//    escolhem, a 10 Hz, um ponto em 8 direções × 12 e 16 m em volta dele, a ≤ 6 m da própria
//    referência, pela nota linha livre (risco + cone de Steiner) + distância ideal + à frente − amontoado,
//    com histerese e compromisso. O ponto anda junto com o condutor (e à frente dele, pela velocidade).
//  - Corredores no terço final (Metrica): no máximo 1 por corredor lateral (o outro entra no
//    meio-espaço) e, se um lado ficar vazio, o mais perto dele abre; sobreposição do lateral quando a
//    bola está com alguém de lado no campo adversário (Opta).
//  - Corridas nas costas (Ju 2023; SkillCorner; Metrica): atacantes e pontas (e os laterais com
//    mentalidade ofensiva) arrancam quando o condutor está de frente e livre, eles estão perto da linha,
//    há campo às costas da defesa e a linha do passe até o destino está aberta; destino = linha + 8–12 m
//    no corredor dele (j.corrida, a mesma corrida do ia.js); recarga, limite ao mesmo tempo, e a corrida
//    acaba se o condutor não armar a enfiada (o corredor não fica impedido à toa).
//  - Ataque à área (Yamada & Hayashi 2015; Metrica): com a bola de lado no terço final, TATICA.naArea
//    [mentalidade] vão às zonas do cruzamento (1º pau, marca do pênalti, 2º pau…), correndo se longe;
//    com um chute meu no ar, quem está perto acompanha o rebote. Desmarque do adversário colado no caminho.
//  - Condutor por utilidade (Karun Singh 2018, xT; histerese e compromisso): passe, enfiada,
//    lançamento, cruzamento, chute, conduzir (7 direções) ou proteger; U = P·(V + posse) − (1 − P)·(C +
//    posse) com V = xT do destino e C = xT do adversário onde a bola seria perdida. Executa pelos botões
//    virtuais (acaoIA) e fixa a mira no pedido (pedido.dir → miraAuto, o mesmo caminho da reposição do
//    goleiro). Transição ofensiva: +20% nas opções à frente; corridas sem exigir o condutor de frente.

import { IA_ATAQUE, TATICA, CAMPO, PASSO, BOTAO, IA, PARTIDA, ACOES } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { para, acaoIA } from './ia.js';
import { zonasCruzamento } from './acoes.js';
import { faseDoTime } from './tatica.js';
import { FORMACOES } from './formacoes.js';
import { estadoIA, blocoDoTime, alvoCalmo } from './ia-tatica.js';
import { restricaoParada } from './partida.js';

const DT = PASSO;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const AREA_U = MX - CAMPO.area.profundidade, AREA_W = CAMPO.area.largura / 2;
const MEIO_GOL = CAMPO.gol.largura / 2;
const seg = s => Math.round(s / DT);
// quem faz corrida nas costas (plano 2.5; ME/MD são os pontas do 4-4-2, do 4-2-3-1 e do 4-1-4-1)
const CORREDOR = { ATA: 1, SA: 1, PD: 1, PE: 1, MEI: 1, MD: 1, ME: 1 };
const LATERAL = { LD: 1, LE: 1, ADD: 1, ADE: 1 };
const PONTA = { PD: 1, PE: 1, MD: 1, ME: 1 };

const _r = { x: 0, z: 0 }, _ref = { u: 0, w: 0 }, _c = { x: 0, z: 0, mag: 1, modo: 'calma', correr: false };

// ------------------------------------------------------------------------------- ameaça esperada

/**
 * Ameaça esperada (xT, Karun Singh 2018) no ponto (u, w) do referencial de quem ataca: a grade
 * 12×8 de IA_ATAQUE.xT interpolada entre os centros das células (sem degrau na borda da zona, que
 * faria a decisão pular de um lado para o outro).
 */
export function ameacaEsperada(u, w) {
  const X = IA_ATAQUE.xT;
  const cu = clamp((u + MX) / 8.75 - 0.5, 0, 11), cw = clamp((w + MZ) / 8.5 - 0.5, 0, 7);
  const c0 = Math.floor(cu), l0 = Math.floor(cw);
  const c1 = Math.min(11, c0 + 1), l1 = Math.min(7, l0 + 1);
  const fu = cu - c0, fw = cw - l0;
  return (X[l0][c0] * (1 - fu) + X[l0][c1] * fu) * (1 - fw) + (X[l1][c0] * (1 - fu) + X[l1][c1] * fu) * fw;
}

/**
 * Chance de gol de um chute de (u, w) (referencial de quem ataca) pelo ângulo θ da boca do gol:
 * xG ≈ a·θ^b (≈ 0,45 a 6 m, ~0,2 na marca do pênalti, ~0,1 na meia-lua e ~0,05 a 25 m, de frente;
 * ordem de grandeza dos modelos abertos de xG, StatsBomb), com teto.
 */
export function chanceDeGol(u, w) {
  const du = MX - u;
  if (du <= 0.2) return 0;
  const th = Math.abs(MD.atan2(MEIO_GOL - w, du) - MD.atan2(-MEIO_GOL - w, du));
  const c = IA_ATAQUE.utilidade;
  return Math.min(c.xgMax, c.xgA * MD.pow(th, c.xgB));
}

// ------------------------------------------------------------------------------------- riscos

/**
 * Risco de um adversário tomar a bola no caminho de (ax, az) a (bx, bz) com a bola a v m/s — como o
 * acoes.js riscoLinha (reação 0,25 s, corrida a 6,5 m/s), mas medindo a distância até o PONTO do
 * segmento (não até a reta infinita) e dando ao recebedor os pontos a que ele chega antes (quem está
 * colado atrás do recebedor não corta o passe). vRec = velocidade com que o recebedor vem na bola
 * (0 = bola no espaço). Sem o goleiro com semGoleiro (chute).
 */
function riscoCaminho(m, time, ax, az, bx, bz, v, vRec, semGoleiro) {
  const dx = bx - ax, dz = bz - az;
  const L = MD.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;
  let r = 0;
  for (const o of m.jogadores) {
    if (o.time === time || (semGoleiro && o.posicao === 'GOL') || o.papel === 'parado' || o.papel === 'marcador') continue;
    const ox = o.x - ax, oz = o.z - az;
    const s = clamp(ox * ux + oz * uz, 0, L);
    const lat = MD.hypot(ox - s * ux, oz - s * uz);
    const tAdv = 0.25 + Math.max(0, lat - 0.9) / 6.5;
    let lim = s / Math.max(v, 3) + 0.15;
    if (vRec > 0) lim = Math.min(lim, (L - s) / vRec + 0.1);
    if (tAdv < lim) { const q = (lim - tAdv) / 0.6; if (q > r) r = q >= 1 ? 1 : q; }
    // a bola passando ao alcance do corpo dele (domínio sem tempo de reação: sim.js bolaLivre) é corte
    // — antes um marcador colado no passador não contava (a bola passava "antes da reação")
    if (s > 0.3 && s < L - 1 && lat < RISCO_CORPO[1]) {
      const q = clamp((RISCO_CORPO[1] - lat) / (RISCO_CORPO[1] - RISCO_CORPO[0]), 0, 1);
      if (q > r) r = q;
    }
  }
  return r;
}
const RISCO_CORPO = [0.9, 1.6]; // m da linha: corte certo até [0], nenhum além de [1]

/**
 * Bloqueio do chute pelo corpo: um adversário de linha a menos de ~0,8 m da linha do chute (entre a
 * bola e o gol) barra a bola sem precisar reagir (sim.js colisaoBolaCorpo) — 1 colado na linha, 0 a
 * 0,8 m.
 */
function corpoNaLinha(m, j, gx, gz) {
  const dx = gx - j.x, dz = gz - j.z, L = MD.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  let b = 0;
  for (const o of m.jogadores) {
    if (o.time === j.time || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
    const ox = o.x - j.x, oz = o.z - j.z, s = ox * ux + oz * uz;
    if (s < 0.3 || s > L) continue;
    const lat = Math.abs(-ox * uz + oz * ux);
    const q = clamp((0.8 - lat) / 0.45, 0, 1);
    if (q > b) b = q;
  }
  return b;
}

/**
 * Linha de passe livre do condutor c até (px, pz) no critério de Steiner 2018 (o mesmo do
 * teste-apoio): nenhum adversário a menos de cone rad da linha, entre o passador e o ponto.
 */
function linhaLivre(m, c, px, pz, cone) {
  const dx = px - c.x, dz = pz - c.z, d = MD.hypot(dx, dz);
  if (d < 1e-6) return true;
  const cc = MD.cos(cone);
  for (const o of m.jogadores) {
    if (o.time === c.time || o.papel === 'parado' || o.papel === 'marcador') continue;
    const ax = o.x - c.x, az = o.z - c.z, da = MD.hypot(ax, az);
    if (da < 1e-6 || da > d + 1) continue;
    if ((ax * dx + az * dz) / (da * d) > cc) return false;
  }
  return true;
}

/** Distância do adversário (de linha ou goleiro) mais perto de (x, z). */
function advMaisPerto(m, time, x, z) {
  let d = Infinity;
  for (const o of m.jogadores) {
    if (o.time === time || o.papel === 'parado' || o.papel === 'marcador') continue;
    const e = MD.hypot(o.x - x, o.z - z);
    if (e < d) d = e;
  }
  return d;
}

/** Indo para uma vaga nova (Editar time; ia-tatica.js reposicionando): fora das opções do condutor. */
const indo = (m, o) => !!o.iaT && o.iaT.reposAte >= m.tick;

// ------------------------------------------------------------------------- estado do time por tick

function novoEstadoJogador() {
  return {
    tAval: -1, papel: 'ref',                                          // papel: 'ref' | 'apoio' | 'area'
    ofu: 0, ofw: 0, ofDesde: -1, ofCond: -1, ofTem: false,            // ponto de apoio (rel. ao condutor)
    ultCorrida: -99999, corrida: false, corridaCond: -1,              // corrida nas costas
    zona: -1,                                                         // ataque à área
    contorna: 0, contornaDesde: -99999, pressaAte: -1,                // desmarque (lado); pressa até o tick
    ultCond: -2, desde: 0, op: '', opDesde: -1, du: 1, dw: 0, correr: false, curta: false, // condutor
    alvo: -1, mira: null, miraAlvo: false,
  };
}

/**
 * Estado do ataque do time t neste tick (uma vez por time e por tick, em m.iaAtq[t]): condutor,
 * linha de impedimento, referências (com o impedimento como forma e os corredores do terço final),
 * os 2 apoios, as corridas ativas e o ataque à área.
 */
function estadoAtaque(m, t) {
  const cache = (m.iaAtq ??= {});
  let A = cache[t];
  if (A && A.tick === m.tick) return A;
  if (!A) {
    A = cache[t] = {
      tick: -1, time: t, lado: 1, ment: 0, posseDesde: 0, timeAnt: null, cond: null, linha: 0, transOf: false,
      ids: [], ref: new Map(), apoio: [-1, -1], corridas: 0,
      area: { ativo: false, ids: [], zonas: [], lado: 0, esc: false },
    };
  }
  A.tick = m.tick;
  const lado = A.lado = m.ataca[t];
  const ts = m.times[t];
  A.ment = clamp(ts.tatica?.mentalidade ?? 0, -2, 2);
  // dono da bola (no pé ou nas mãos) e a troca de posse
  const idB = m.naMao ?? m.posse;
  let dono = null;
  if (idB != null) for (const o of m.jogadores) if (o.id === idB) { dono = o; break; }
  A.cond = dono && dono.time === t ? dono : null;
  const timeBola = dono ? dono.time : (m.voo && m.voo.time != null ? m.voo.time : A.timeAnt);
  if (timeBola !== A.timeAnt) { if (timeBola === t) A.posseDesde = m.tick; A.timeAnt = timeBola; }
  const f = faseDoTime(m, t);
  A.transOf = f.transicao === 'of';
  // corridas nas costas: acabam quando o time perde a bola (o ia.js seguiria correndo) ou depois de
  //   corridas.espera s sem o passe vir para ele. O passe para OUTRO companheiro não acaba a corrida
  //   (integração com a defesa da Parte 2: a bola troca de pé a cada ~2 s e a corrida acabava antes
  //   de 1 s, sem chegar às costas da defesa); quem fica impedido volta correndo (apoioTatico)
  A.corridas = 0;
  for (const o of m.jogadores) {
    const s = o.iaA;
    if (!s || !s.corrida) continue;
    if (!o.corrida || o.corrida.tipo !== 'nasCostas') { s.corrida = false; continue; }
    const paraEle = (m.voo && m.voo.para === o.id) || o.recebe;
    let acaba = timeBola != null && timeBola !== o.time;
    if (!acaba && !paraEle) {
      let c = null;
      if (m.posse != null) for (const q of m.jogadores) if (q.id === m.posse) { c = q; break; }
      const armando = c && c.time === o.time && c.iaA && (c.iaA.op === 'enfiada' || c.iaA.op === 'lancamento') && c.iaA.alvo === o.id;
      acaba = !armando && m.tick - s.ultCorrida > seg(IA_ATAQUE.corridas.espera);
    }
    if (acaba) { o.corrida = null; s.corrida = false; continue; }
    if (o.time === t) A.corridas++;
  }
  // linha de impedimento: o penúltimo adversário (com o goleiro), a bola ou o meio-campo (quem está
  // parado — o cobrador de uma bola parada — também conta para o impedimento; o boneco do treino não)
  let u1 = -Infinity, u2 = -Infinity, d1 = null, d2 = null;
  for (const o of m.jogadores) {
    if (o.time === t || o.papel === 'marcador') continue;
    const u = o.x * lado;
    if (u > u1) { u2 = u1; d2 = d1; u1 = u; d1 = o; } else if (u > u2) { u2 = u; d2 = o; }
  }
  A.linha = Math.max(u2, m.bola.p.x * lado, 0);
  A.defLinha = A.linha === u2 ? d2 : null; // o defensor que faz a linha (se é ele, e não a bola/o meio)
  // referências da vaga: as do time (ia-tatica.js blocoDoTime → posicaoTatica com a bola do ataque —
  // antecipada IA_ATAQUE.antecipa s e filtrada —, misturada com a sem bola depois da retomada). Uma
  // referência só para o time inteiro: a da defesa e a do apoio são a mesma conta (contrato b da tela)
  const B = blocoDoTime(m, t);
  A.ids.length = 0;
  for (const o of m.jogadores) {
    if (o.time !== t || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador' || !o.vagaId) continue;
    A.ids.push(o);
    let r = A.ref.get(o.id);
    if (!r) { r = { u: 0, w: 0 }; A.ref.set(o.id, r); }
    r.u = B.ref[2 * o.vagaIdx] * lado; r.w = B.ref[2 * o.vagaIdx + 1] * lado;
  }
  corredoresTercoFinal(m, A);
  // impedimento como forma e o recuo mínimo; com a bola passando do nosso terço, os atacantes
  // jogam na linha do último defensor (prendem a linha e dão profundidade)
  const naLinha = m.bola.p.x * lado > -TATICA.terco;
  // sobreposição (Opta: até ~7 por jogo): com a bola no pé de um de lado no campo adversário, o
  // lateral do mesmo lado passa por fora dele
  let sobre = null;
  const c = A.cond;
  if (c && c.posicao !== 'GOL' && !LATERAL[c.posDetalhe] && c.x * lado > 0 && Math.abs(c.z) > IA_ATAQUE.sobreposicao.w) {
    const sc = Math.sign(c.z * lado);
    for (const o of A.ids) if (LATERAL[o.posDetalhe] && Math.sign(A.ref.get(o.id).w) === sc) { sobre = o; break; }
    if (sobre) {
      const r = A.ref.get(sobre.id);
      r.u = Math.max(r.u, c.x * lado + IA_ATAQUE.sobreposicao.frente);
      r.w = sc * (MZ - IA_ATAQUE.sobreposicao.linha);
    }
  }
  for (const o of A.ids) {
    const r = A.ref.get(o.id);
    const vg = FORMACOES[ts.formacao]?.porId[o.vagaId];
    // os centroavantes (ATA/SA) jogam na linha do último defensor. Os pontas não: na tabela (Metrica,
    // bola no centro) eles ficam ~7 m atrás da linha; puxados para ela, a forma com a bola saía da
    // tabela (teste-taticas) — eles chegam lá pelas corridas nas costas
    if (naLinha && vg && vg.grupo === 'ata' && !PONTA[o.posDetalhe]) r.u = Math.max(r.u, A.linha - IA_ATAQUE.naLinha);
    r.u = clamp(r.u, -MX + IA.recuoMin, A.linha - folgaLinha(A, o));
  }
  // os 2 apoios: os de linha mais perto do condutor (2 m de vantagem para quem já apoia)
  A.apoio[0] = -1; A.apoio[1] = -1;
  if (A.cond && A.cond.posicao !== 'GOL') {
    let d1 = Infinity, d2 = Infinity;
    for (const o of A.ids) {
      if (o === A.cond || indo(m, o)) continue;
      let d = MD.hypot(o.x - A.cond.x, o.z - A.cond.z);
      if (o.iaA && o.iaA.papel === 'apoio') d -= 2;
      if (d < d1) { d2 = d1; A.apoio[1] = A.apoio[0]; d1 = d; A.apoio[0] = o.id; }
      else if (d < d2) { d2 = d; A.apoio[1] = o.id; }
    }
  }
  ataqueArea(m, A);
  return A;
}

/**
 * Folga até a linha de impedimento para o jogador o: IA_ATAQUE.impedimentoFolga, ou quase nada se
 * quem faz a linha é o marcador dele (até empurraRaio m, do lado do gol) — o atacante empurra a linha
 * para trás: o marcador recua junto e ele nunca passa dela (sem isso, o atacante parava a 1 m do
 * próprio marcador e a linha não recuava nunca).
 */
function folgaLinha(A, o) {
  const d = A.defLinha;
  if (d && d.x * A.lado > o.x * A.lado && MD.hypot(d.x - o.x, d.z - o.z) < IA_ATAQUE.empurraRaio) return IA_ATAQUE.empurraFolga;
  return IA_ATAQUE.impedimentoFolga;
}

/**
 * Terço final (bola em u ≥ TATICA.terco): no máximo 1 de linha no corredor lateral de cada lado
 * (os outros entram no meio-espaço) e, se um corredor lateral ficar vazio, o mais perto dele abre
 * (Metrica, campo adversário com a bola no terço final: 1,0 / 1,5 / 3,9 / 1,5 / 1,1).
 */
function corredoresTercoFinal(m, A) {
  if (m.bola.p.x * A.lado < TATICA.terco) return;
  const [c0, c1] = IA_ATAQUE.corredores;
  for (let s = -1; s <= 1; s += 2) {
    let mais = null, mu = -Infinity;
    for (const o of A.ids) {
      const r = A.ref.get(o.id);
      if (r.w * s > c1 && r.u > 0 && r.u > mu) { mu = r.u; mais = o; }
    }
    if (mais) {
      for (const o of A.ids) {
        const r = A.ref.get(o.id);
        if (o !== mais && r.w * s > c1 && r.u > 0) r.w = s * (c0 + c1) / 2;
      }
    } else {
      let mel = null, dm = Infinity;
      for (const o of A.ids) {
        const r = A.ref.get(o.id);
        if (r.u <= 0 || r.w * s < c0) continue;
        const d = c1 - r.w * s;
        if (d < dm) { dm = d; mel = o; }
      }
      if (mel) A.ref.get(mel.id).w = s * (c1 + 4);
    }
  }
}

/**
 * Ataque à área: com o condutor no corredor lateral do terço final (ou um cruzamento meu no ar, ou o
 * meu escanteio), TATICA.naArea[mentalidade] vão às zonas (escanteio: +2, até 5). Quem vai fica
 * enquanto a situação durar (sem troca a cada tick).
 */
function ataqueArea(m, A) {
  const ar = A.area, c = A.cond, cz = IA_ATAQUE.cruzamento;
  const meuCruz = m.posse == null && m.voo && m.voo.tipo === 'cruzamento' && m.voo.time === A.time;
  const esc = !!(m.parada && !m.parada.rolou && m.parada.tipo === 'escanteio' && m.parada.time === A.time);
  // a área começa a ser atacada antes de a bola chegar à faixa do cruzamento (quem vai à área
  // precisa de tempo para chegar): bola no lado do campo, já no terço final
  const naFaixa = c && c.posicao !== 'GOL' && c.x * A.lado > cz.xAtiva && Math.abs(c.z) > cz.zAtiva;
  if (!(naFaixa || meuCruz || esc)) { if (ar.ativo) { ar.ativo = false; ar.ids.length = 0; } return; }
  // lado de onde a bola vem: o condutor, o ponto do escanteio ou quem cruzou
  let zRef = c ? c.z : esc ? m.parada.z : 1;
  if (!c && !esc) for (const o of m.jogadores) if (o.id === m.voo.de) { zRef = o.z; break; }
  const ladoBola = zRef >= 0 ? 1 : -1;
  if (ar.ativo && (ar.lado === ladoBola || meuCruz) && ar.esc === esc) return; // mantém quem já vai
  ar.ativo = true; ar.lado = ladoBola; ar.esc = esc;
  const n = Math.min(5, TATICA.naArea[A.ment + 2] + (esc ? 2 : 0));
  const zs = zonasCruzamento(A.lado, zRef);
  ar.zonas.length = 0;
  ar.zonas.push(zs[0], zs[2], zs[1]);
  ar.zonas.push({ nome: 'segundoPauAberto', x: A.lado * (MX - 8), z: -ladoBola * 8 });
  ar.zonas.push({ nome: 'entradaArea', x: A.lado * (MX - 18), z: ladoBola * 2 });
  ar.ids.length = 0;
  for (let k = 0; k < n; k++) {
    const zn = ar.zonas[k];
    let mel = null, dm = Infinity;
    for (const o of A.ids) {
      if (o === c || o.posDetalhe === 'ZAG' || ar.ids.includes(o.id) || indo(m, o)) continue;
      let d = MD.hypot(o.x - zn.x, o.z - zn.z);
      if (LATERAL[o.posDetalhe] || o.posDetalhe === 'VOL') d += 10;
      if (d < dm) { dm = d; mel = o; }
    }
    if (!mel) break;
    ar.ids.push(mel.id);
  }
}

// ------------------------------------------------------------------------------- apoio (sem a bola)

/** Jogador do time com a bola que não é o condutor: ponto de apoio, corrida ou ataque à área. */
export function apoioTatico(m, j) {
  if (!m.times || j.posicao === 'GOL' || !j.vagaId) return null;
  estadoIA(m, j);
  const A = estadoAtaque(m, j.time);
  const ia = j.iaA ??= novoEstadoJogador();
  const aval = TATICA.avaliaTicks;
  if (ia.tAval < 0 || m.tick - ia.tAval >= aval || A.posseDesde > ia.tAval || (m.tick + (j.vagaIdx ?? 0)) % aval === 0) {
    avaliarApoio(m, j, A, ia);
    if (j.corrida) return null; // começou a corrida nas costas: o ia.js leva (ramo 'corrida')
  }
  const lado = A.lado;
  let tu, tw, pressa = false;
  // chute meu no ar: quem está perto da área acompanha o lance (rebote do goleiro, bola espirrada)
  const v = m.voo;
  if (m.posse == null && v && v.time === j.time && (v.tipo === 'chute' || v.tipo === 'colocado') && v.de !== j.id) {
    const u = j.x * lado, dGol = MD.hypot(MX - u, j.z);
    if (dGol < IA_ATAQUE.rebote.raio && u > 0) {
      restricaoParada(m, j, (MX - IA_ATAQUE.rebote.frente) * lado, clamp(m.bola.p.z * 0.5 + j.z * 0.5, -6, 6), _r);
      j.ia.ramo = 'rebote';
      return para(j, _r.x, _r.z, 1, true, 0, 'pressa');
    }
  }
  if (ia.papel === 'apoio' && A.cond && ia.ofTem) {
    // o ponto de apoio anda junto com o condutor (e à frente dele, pela velocidade: andando atrás de um
    // ponto que foge, o apoio ficava a 5–7 m do condutor)
    const ta = IA_ATAQUE.apoio.antecipa;
    tu = (A.cond.x + A.cond.vx * ta) * lado + ia.ofu; tw = (A.cond.z + A.cond.vz * ta) * lado + ia.ofw;
    tu = Math.min(tu, A.linha - folgaLinha(A, j));
    // longe do ponto, vai com pressa (trotando, o apoio não acompanhava o condutor e ficava colado nele)
    if (MD.hypot(tu * lado - j.x, tw * lado - j.z) > IA_ATAQUE.apoio.pressa) pressa = true;
    // colado no condutor (ele veio para cima do apoio): abre para longe dele primeiro
    const dc = MD.hypot(j.x - A.cond.x, j.z - A.cond.z);
    if (dc < IA_ATAQUE.apoio.colado && dc > 0.3) {
      const k = IA_ATAQUE.apoio.dist[0] / dc;
      tu = (A.cond.x + (j.x - A.cond.x) * k) * lado; tw = (A.cond.z + (j.z - A.cond.z) * k) * lado;
      tu = Math.min(tu, A.linha - folgaLinha(A, j));
    }
  } else if (ia.papel === 'area' && A.area.ativo) {
    const zn = A.area.zonas[ia.zona] ?? A.area.zonas[0];
    tu = zn.x * lado; tw = zn.z * lado;
    // antes do cruzamento, espera na linha (sem impedimento); com a bola no ar, ataca a zona
    if (m.posse == null && m.voo && m.voo.tipo === 'cruzamento') pressa = true;
    else tu = Math.min(tu, A.linha - folgaLinha(A, j));
    // longe do ponto, ataca a área correndo (quem chega atrasado não cabeceia)
    if (MD.hypot(tu * lado - j.x, tw * lado - j.z) > IA_ATAQUE.areaCorre) pressa = true;
  } else {
    const r = A.ref.get(j.id);
    tu = r ? r.u : j.x * lado; tw = r ? r.w : j.z * lado;
    // retomada com o time longe da referência: volta (ou sobe) com pressa
    pressa = A.transOf && MD.hypot(tu * lado - j.x, tw * lado - j.z) > 12;
    // movimento de apoio contínuo (vem e vai na linha da referência, como o "dar opção" dos jogos de
    // posição): quem não é o apoio curto nem defensor oscila oscila.amp m em u num ciclo de oscila.periodo s
    // (fases diferentes por vaga) — parado na referência, o time andava atrás da jogada
    const osc = IA_ATAQUE.oscila;
    if (osc.amp > 0 && j.posicao !== 'ZAG' && !LATERAL[j.posDetalhe]) tu += osc.amp * MD.sin(2 * Math.PI * (m.tick * DT / osc.periodo + (j.vagaIdx ?? 0) / 11));
    // não encosta no condutor (quem não é apoio abre espaço: Metrica, o mais perto a ~10 m)
    if (A.cond && A.cond !== j) {
      const cu = A.cond.x * lado, cw = A.cond.z * lado, du = tu - cu, dw = tw - cw, d = MD.hypot(du, dw);
      const dmin = IA_ATAQUE.apoio.dist[0];
      if (d < dmin) { const k = d > 0.5 ? dmin / d : 0; tu = k ? cu + du * k : cu - dmin; tw = k ? cw + dw * k : cw; }
    }
  }
  tu = clamp(tu, -MX + IA.recuoMin, MX - 2);
  tw = clamp(tw, -MZ + 1.5, MZ - 1.5);
  restricaoParada(m, j, tu * lado, tw * lado, _r);
  // impedido (depois de uma corrida, ou a linha subiu): volta rápido para a linha (FC 26)
  if (ia.papel !== 'area' && j.x * lado > A.linha && j.x * lado > 0) pressa = true;
  // o ataque avançou e ele ficou para trás: sobe correndo (a referência anda com a bola a ~k·v da
  // bola; trotando, o time inteiro ficava atrás da jogada)
  if ((_r.x - j.x) * lado > IA_ATAQUE.sobeCorrendo) pressa = true;
  // a pressa fica por pressaMin s (ligar e desligar a cada tick trocava o modo e o alvo do para())
  if (pressa) ia.pressaAte = m.tick + seg(IA_ATAQUE.pressaMin);
  else if (m.tick < ia.pressaAte && MD.hypot(_r.x - j.x, _r.z - j.z) > IA.chegou * 3) pressa = true;
  // quem segue a referência (sem pressa) vai pelo ponto calmo da Parte 2 (ia-tatica.js alvoCalmo:
  // filtro do alvo, parado perto dele, marcha/trote fora da faixa em que o tronco treme, rumo com giro
  // limitado) — seguir a referência que anda a cada tick direto pelo para() fazia o tronco tremer
  // (teste-movimento --modo partida: ~1/3 dos tremores eram do apoio pela referência)
  let calmo = null;
  if (ia.papel === 'ref' && !pressa) {
    j.ia.ramo = 'apoioRef';
    calmo = alvoCalmo(m, j, _r.x, _r.z, _c);
    _r.x = calmo.x; _r.z = calmo.z;
  }
  contornar(m, j, ia, _r, ia.papel === 'area' && pressa ? Infinity : A.linha - folgaLinha(A, j), lado);
  j.ia.ramo = ia.papel === 'ref' ? 'apoioRef' : ia.papel === 'apoio' ? 'apoioCurto' : 'area';
  if (calmo && !pressa) return para(j, _r.x, _r.z, calmo.mag, calmo.correr, 0, calmo.modo);
  return para(j, _r.x, _r.z, 1, true, 0, pressa ? 'pressa' : 'calma');
}

/**
 * Desmarque: com um adversário colado no caminho até o alvo (a ≤ contorna.raio m e a menos de
 * contorna.cone do rumo), o alvo do momento vai para o lado dele (contorna.lado m), e o lado escolhido
 * fica por contorna.tempo s — sem isso o atacante empurrava o marcador posicionado do lado do gol e
 * não saía do lugar (o corpo bloqueia o corpo). Muda `alvo` no lugar.
 */
function contornar(m, j, ia, alvo, uMax, lado) {
  const cfg = IA_ATAQUE.contorna;
  const dx = alvo.x - j.x, dz = alvo.z - j.z, d = MD.hypot(dx, dz);
  if (d < cfg.longe) { ia.contorna = 0; return; }
  const ux = dx / d, uz = dz / d;
  let bloq = null, db = cfg.raio;
  for (const o of m.jogadores) {
    if (o.time === j.time || o.papel === 'parado' || o.papel === 'marcador') continue;
    const ox = o.x - j.x, oz = o.z - j.z, e = MD.hypot(ox, oz);
    if (e >= db || e < 1e-6) continue;
    if ((ox * ux + oz * uz) / e < MD.cos(cfg.cone)) continue;
    bloq = o; db = e;
  }
  if (!bloq) { if (m.tick - (ia.contornaDesde ?? -9999) > seg(cfg.tempo)) ia.contorna = 0; return; }
  if (!ia.contorna || m.tick - ia.contornaDesde > seg(cfg.tempo)) {
    // passa pelo lado de que o adversário está menos (desempate: o lado da própria referência)
    const lat = -(bloq.x - j.x) * uz + (bloq.z - j.z) * ux;
    ia.contorna = lat > 0 ? -1 : lat < 0 ? 1 : (j.vagaIdx ?? 0) % 2 ? 1 : -1;
    ia.contornaDesde = m.tick;
  }
  // ponto a "lado" m de lado do adversário, um pouco à frente dele
  const px = -uz * ia.contorna, pz = ux * ia.contorna;
  alvo.x = bloq.x + px * cfg.lado + ux * 1.5;
  alvo.z = bloq.z + pz * cfg.lado + uz * 1.5;
  if (alvo.x * lado > uMax) alvo.x = uMax * lado; // sem passar da linha de impedimento
}

/** Reavalia o papel e o alvo do apoio (10 Hz, escalonado por vagaIdx). */
function avaliarApoio(m, j, A, ia) {
  ia.tAval = m.tick;
  const k = A.area.ativo ? A.area.ids.indexOf(j.id) : -1;
  if (k >= 0) { ia.papel = 'area'; ia.zona = k; ia.ofTem = false; return; }
  if (A.cond && (A.apoio[0] === j.id || A.apoio[1] === j.id)) {
    ia.papel = 'apoio';
    pontoDeApoio(m, j, A, ia);
    if (ia.papel === 'apoio') return;
  }
  ia.papel = 'ref'; ia.ofTem = false;
  tentarCorrida(m, j, A, ia);
}

/**
 * Ponto de apoio (plano 2.5): candidatos em IA_ATAQUE.apoio.direcoes direções × aneis m em volta do
 * condutor, a ≤ raioRef m da própria referência; nota = 2·(1 − risco da linha) + distância ideal +
 * à frente + longe do adversário − amontoado; o ponto atual ganha a histerese e só troca depois do
 * compromisso.
 */
function pontoDeApoio(m, j, A, ia) {
  const c = A.cond, cfg = IA_ATAQUE.apoio, lado = A.lado;
  const cu = c.x * lado, cw = c.z * lado;
  // a referência, afastada do condutor até dist[0] (o condutor entrou na zona dele: ele abre espaço)
  const r0 = A.ref.get(j.id);
  let ru = r0.u, rw = r0.w;
  const dr = MD.hypot(ru - cu, rw - cw);
  if (dr < cfg.dist[0]) {
    if (dr > 0.5) { ru = cu + (ru - cu) * cfg.dist[0] / dr; rw = cw + (rw - cw) * cfg.dist[0] / dr; }
    else { ru = cu - cfg.dist[0]; }
  }
  const r = _ref; r.u = ru; r.w = rw;
  if (ia.ofCond !== c.id) { ia.ofTem = false; ia.ofCond = c.id; }
  const nota = (ou, ow) => {
    const pu = clamp(cu + ou, -MX + IA.recuoMin, Math.min(MX - 2, A.linha - folgaLinha(A, j)));
    const pw = clamp(cw + ow, -MZ + 1.5, MZ - 1.5);
    if (MD.hypot(pu - r.u, pw - r.w) > cfg.raioRef) return -Infinity;
    const px = pu * lado, pz = pw * lado;
    const d = MD.hypot(pu - cu, pw - cw);
    let n = 2 * (1 - riscoCaminho(m, j.time, c.x, c.z, px, pz, 12, 6, false));
    if (!linhaLivre(m, c, px, pz, cfg.cone)) n -= 1;
    n -= d < cfg.dist[0] ? (cfg.dist[0] - d) * 1.0 : d > cfg.dist[1] ? (d - cfg.dist[1]) * 0.25 : 0;
    n += 0.5 * clamp((pu - cu) / 13, -1, 1);
    n += 0.15 * Math.min(4, advMaisPerto(m, j.time, px, pz));
    for (const o of A.ids) {
      if (o === j || o === c) continue;
      const e = MD.hypot(o.x - px, o.z - pz);
      if (e < 6) n -= (6 - e) * 0.15;
    }
    return n;
  };
  let mu = 0, mw = 0, mn = -Infinity;
  if (ia.ofTem) { mn = nota(ia.ofu, ia.ofw); if (mn > -Infinity) mn *= cfg.histerese; mu = ia.ofu; mw = ia.ofw; }
  const comprometido = ia.ofTem && mn > -Infinity && m.tick - ia.ofDesde < seg(cfg.compromisso);
  if (!comprometido) {
    for (const R of cfg.aneis) for (let a = 0; a < cfg.direcoes; a++) {
      const ang = (a / cfg.direcoes) * 2 * Math.PI;
      const ou = R * MD.cos(ang), ow = R * MD.sin(ang);
      const n = nota(ou, ow);
      if (n > mn) { mn = n; mu = ou; mw = ow; }
    }
    const nr = nota(r.u - cu, r.w - cw); // a própria referência também é candidata
    if (nr > mn) { mn = nr; mu = r.u - cu; mw = r.w - cw; }
    if (!ia.ofTem || mu !== ia.ofu || mw !== ia.ofw) ia.ofDesde = m.tick;
  }
  if (mn === -Infinity) { ia.ofTem = false; ia.papel = 'ref'; return; }
  ia.ofu = mu; ia.ofw = mw; ia.ofTem = true;
}

/** Corrida nas costas da defesa (plano 2.5): quem pode, quando e para onde. */
function tentarCorrida(m, j, A, ia) {
  const cfg = IA_ATAQUE.corridas, c = A.cond, lado = A.lado;
  if (!c || c.posicao === 'GOL' || (m.parada && !m.parada.rolou)) return;
  if (!(CORREDOR[j.posDetalhe] || (LATERAL[j.posDetalhe] && A.ment >= 1))) return;
  if (m.tick - ia.ultCorrida < seg(cfg.recarga)) return;
  if (A.corridas >= cfg.max[A.ment >= 1 ? 1 : 0]) return;
  // condutor de frente para o gol adversário, andando com a bola (a corrida acompanha a progressão de
  // quem conduz; com ele parado o corredor esperava a linha) e sem marcador colado (na transição,
  // basta ter campo)
  if (MD.hypot(c.vx, c.vz) < cfg.vCondutor) return;
  if (!A.transOf) {
    if (Math.abs(difAng(lado > 0 ? 0 : Math.PI, c.rumo)) > cfg.angFrente) return;
    if (advMaisPerto(m, j.time, c.x, c.z) < cfg.marcadorLivre) return;
  }
  const u = j.x * lado, w = j.z * lado;
  if (u < A.linha - cfg.folga || u > A.linha + 0.3) return; // até folga m atrás da linha, sem estar impedido
  if (MX - A.linha < cfg.campoMin) return;                 // campo às costas da defesa
  if (u < c.x * lado - 5) return;                           // atrás do condutor não é corrida nas costas
  const alem = lerp(cfg.alem[0], cfg.alem[1], ((j.vagaIdx ?? 0) % 5) / 4);
  const du = Math.min(A.linha + alem, MX - 4);
  const dw = clamp(w * 0.8, -MZ + 4, MZ - 4);
  const x = du * lado, z = dw * lado;
  // o corredor lê o passador: só arranca com a linha do passe até o destino aberta
  if (riscoCaminho(m, j.time, c.x, c.z, x, z, IA_ATAQUE.utilidade.vEnfiada, 0, false) > cfg.linhaMax) return;
  const dist = MD.hypot(x - j.x, z - j.z);
  j.corrida = { x, z, ate: m.tick + seg(dist / j.par.vArrancada + 0.6), tipo: 'nasCostas' };
  ia.ultCorrida = m.tick; ia.corrida = true; ia.corridaCond = c.id;
  A.corridas++;
}

// --------------------------------------------------------------------------------------- condutor

/** O condutor (m.posse === j.id): passe/enfiada/lançamento, chute, cruzamento, conduzir ou proteger. */
export function condutorTatico(m, j) {
  if (!m.times || m.naMao === j.id || j.posicao === 'GOL' || !j.vagaId) return null;
  estadoIA(m, j);
  const A = estadoAtaque(m, j.time);
  const ia = j.iaA ??= novoEstadoJogador();
  const lado = A.lado;
  const nova = m.tick - ia.ultCond > 1; // acabou de pegar a bola
  ia.ultCond = m.tick;
  if (nova) { ia.op = ''; ia.mira = null; ia.desde = m.tick; }
  let extra = 0;
  if (j.iaAcao) { if (m.tick < j.iaAcao.ate) extra = j.iaAcao.bot; else j.iaAcao = null; }
  // ação pedida: fixa a mira no alvo escolhido (pedido.dir → miraAuto em acoes.js executarAcao)
  if (j.pedido && ia.mira) {
    atualizarMira(m, j, ia);
    j.pedido.dir = { x: ia.mira.x, z: ia.mira.z };
  }
  const ocupado = j.iaAcao || j.carga || j.pedido;
  j.ia.ramo = 'comBola';
  const p = m.parada;
  if (p && !p.rolou && p.cobrador === j.id) {
    // cobrança: parado; cobra PARTIDA.cobrancaIA[0] + 0,4 s depois de montar (sem sorteio próprio)
    if (!ocupado && m.tick - p.desde >= seg(PARTIDA.cobrancaIA[0] + 0.4)) decidir(m, j, A, ia, true);
    return { x: 0, z: 0, botoes: extra };
  }
  if (!ocupado && (nova || ia.op === '' || (m.tick + (j.vagaIdx ?? 0)) % IA_ATAQUE.condutor.avaliaTicks === 0)) decidir(m, j, A, ia, false);
  if (ia.op === 'protege') return { x: 0, z: 0, botoes: extra | BOTAO.MOD };
  let mag = IA_ATAQUE.utilidade.magConduz, botoes = extra;
  if (ia.correr) botoes |= BOTAO.CORRER;
  if (ia.curta) { mag = 0.6; botoes |= BOTAO.MOD; }
  return { x: ia.du * lado * mag, z: ia.dw * lado * mag, botoes };
}

/** Mira de um alvo que se move: a direção do condutor até ele (mais o deslocamento da enfiada). */
function atualizarMira(m, j, ia) {
  if (!ia.miraAlvo) return;
  for (const o of m.jogadores) if (o.id === ia.alvo) {
    const dx = o.x + ia.mira.ax - j.x, dz = o.z + ia.mira.az - j.z, d = MD.hypot(dx, dz) || 1;
    ia.mira.x = dx / d; ia.mira.z = dz / d;
    return;
  }
}

/**
 * Decide a próxima ação do condutor por utilidade (plano 2.6). cobranca = bola parada (só passe,
 * lançamento ou cruzamento). Grava a opção em ia.op e, nas ações com bola, aperta o botão virtual.
 */
function decidir(m, j, A, ia, cobranca) {
  const cfg = IA_ATAQUE.condutor, U = IA_ATAQUE.utilidade, lado = A.lado;
  const u0 = j.x * lado, w0 = j.z * lado;
  const risco = IA_ATAQUE.riscoMentalidade[A.ment + 2];
  // valor de ter a bola (some quando ela é perdida): posse + posseMeuCampo no meu campo (cheio até
  // −10 m, zero a partir de +10 m) — na saída de bola o time guarda a bola (PPDA, retomada em ≤ 5 s:
  // sem isso ele arriscava o passe para a frente já no próprio campo e devolvia a bola na hora)
  // (e logo depois de recuperar a bola, posseRetomada: o time segura a bola primeiro — retomava e
  // perdia de novo na hora: retomada em ≤ 5 s ~45%, Metrica 36,5%)
  const K = U.posse + U.posseMeuCampo * clamp(0.5 - u0 / 20, 0, 1) + (m.tick - A.posseDesde < seg(U.posseRetomada[1]) ? U.posseRetomada[0] : 0);
  const frente = du => (A.transOf && du > 3 ? 1 + cfg.transOfBonus : 1);
  // custo de perder a bola ali: a ameaça do adversário com ela (xT espelhado) ÷ risco aceito + a posse
  const perda = (u, w) => ameacaEsperada(-u, -w) / risco + K;
  const atual = ia.op;
  let melhor = '', mU = -Infinity, mAlvo = -1, mDu = 0, mDw = 0, mForca = 0.5, mAx = 0, mAz = 0, mAlta = false;
  const considerar = (op, Uv, alvo, du = 0, dw = 0, forca = 0.5, ax = 0, az = 0, alta = false) => {
    const v = Uv * (op === atual && alvo === ia.alvo ? cfg.histerese : 1);
    if (v > mU) { mU = v; melhor = op; mAlvo = alvo; mDu = du; mDw = dw; mForca = forca; mAx = ax; mAz = az; mAlta = alta; }
  };
  // 1) passe, enfiada e lançamento para cada companheiro de linha
  const faixaCruz = u0 > ACOES.cruzamento.terco && Math.abs(w0) > ACOES.cruzamento.faixa;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o === j || o.posicao === 'GOL' || o.papel === 'parado' || indo(m, o)) continue;
    const ou = o.x * lado, ow = o.z * lado;
    const L = MD.hypot(o.x - j.x, o.z - j.z);
    const imp = !cobranca && ou > A.linha + 0.3; // impedido (a regra é da Etapa 4; aqui é forma)
    const press = clamp((U.pressaoRecebe - advMaisPerto(m, j.time, o.x, o.z)) / (U.pressaoRecebe - 1), 0, 1);
    if (L >= ACOES.passe.dMin && L <= U.passeMax) {
      // P: ninguém corta a linha × precisão (passe longo erra mais) × o recebedor não perde na hora
      const r = riscoCaminho(m, j.time, j.x, j.z, o.x, o.z, U.vPasse, 6, false);
      const P = (1 - r) * (1 - U.erroDist * Math.max(0, L - 20) / 20) * (1 - U.passePress * press);
      const V = ameacaEsperada(ou, ow) * (1 - U.pressaoValor * press) * (imp ? U.impedido : 1) * frente(ou - u0) + K;
      considerar('passe', P * V - (1 - P) * perda((ou + u0) / 2, (ow + w0) / 2), o.id, 0, 0, clamp(0.3 + L / 60, 0.3, 0.7));
    }
    // enfiada para quem corre nas costas (ou em velocidade para o gol perto da linha): a bola no
    // espaço, em U.enfiadaLeads m à frente dele (o acoes.js enfiada acha o ponto pela força); vale a
    // de maior chance entre a RASTEIRA (cortável no caminho: riscoCaminho) e a ALTA, por cima da linha
    // (sem corte no caminho, voo mais longo e domínio mais difícil: × enfiadaAltaP). Chance pelo
    // tempo: ele (já embalado) chega ao ponto antes do adversário mais perto dele. Só um ponto a 6 m e
    // só a rasteira: com a linha de 4 da Parte 2 no caminho a chance era ~0 e não saía enfiada nenhuma
    const sv = MD.hypot(o.vx, o.vz);
    const naCorrida = o.corrida && o.corrida.tipo === 'nasCostas';
    const corre = naCorrida || (o.vx * lado > 4 && ou > A.linha - 3);
    if (!cobranca && corre && sv > 2 && L >= ACOES.enfiada.dMin && L <= ACOES.enfiada.dMax) {
      let rx = o.vx / sv, rz = o.vz / sv;
      if (naCorrida) { const cx = o.corrida.x - o.x, cz = o.corrida.z - o.z, cl = MD.hypot(cx, cz); if (cl > 1) { rx = cx / cl; rz = cz / cl; } }
      const vr = Math.max(5, sv);
      for (const lead of U.enfiadaLeads) {
        const ax = rx * lead, az = rz * lead;
        const ex = o.x + ax, ez = o.z + az, eu = ex * lado, ew = ez * lado;
        if (Math.abs(ez) > MZ - 1 || Math.abs(ex) > MX - 1) continue;
        const dB = MD.hypot(ex - j.x, ez - j.z);
        let tAdv = Infinity;
        for (const q of m.jogadores) if (q.time !== j.time && q.papel !== 'parado' && q.papel !== 'marcador') tAdv = Math.min(tAdv, (q.posicao === 'GOL' ? 0.4 : 0.25) + Math.max(0, MD.hypot(q.x - ex, q.z - ez) - 1) / 6.5);
        const tRun = lead / vr;
        const r = riscoCaminho(m, j.time, j.x, j.z, ex, ez, U.vEnfiada, 0, false);
        const pChao = (1 - r) * clamp((tAdv - Math.max(tRun, dB / U.vEnfiada + 0.3) + 0.3) / 0.6, 0, 1);
        const pAlta = U.enfiadaAltaP * clamp((tAdv - Math.max(tRun, dB / U.vEnfiadaAlta + 0.3) + 0.3) / 0.6, 0, 1);
        const alta = pAlta > pChao, P = alta ? pAlta : pChao;
        const forca = clamp((lead - ACOES.enfiada.lead[0]) / (ACOES.enfiada.lead[1] - ACOES.enfiada.lead[0]), 0, 1);
        considerar('enfiada', P * (ameacaEsperada(eu, ew) * frente(eu - u0) + K) - (1 - P) * perda((eu + u0) / 2, (ew + w0) / 2), o.id, 0, 0, forca, ax, az, alta);
      }
    }
    // (da faixa do cruzamento do acoes.js o LANÇAMENTO vira cruzamento para a zona, não para ele)
    if (L >= cfg.lancamentoMin && L <= ACOES.lancamento.dMax && !imp && !faixaCruz) {
      const P = U.lancamentoP * (1 - 0.5 * press);
      considerar('lancamento', P * (ameacaEsperada(ou, ow) * frente(ou - u0) + K) - (1 - P) * perda(ou, ow), o.id, 0, 0, 0.6);
    }
  }
  // 2) cruzamento: no corredor lateral do terço final, pela gente na área ou chegando nela
  const cz = IA_ATAQUE.cruzamento;
  if ((!cobranca || m.parada.tipo === 'escanteio') && u0 > cz.xTerco && Math.abs(w0) > cz.zLateral) {
    // quem está na área (ou entrando nela: a ≤ cruzamentoRaio m da linha da área, correndo para lá)
    let n = 0;
    for (const o of A.ids) {
      if (o === j) continue;
      const ou = o.x * lado, aw = Math.abs(o.z);
      if (aw > AREA_W + U.cruzamentoRaio || ou < AREA_U - U.cruzamentoRaio) continue;
      if ((ou > AREA_U && aw < AREA_W) || (o.vx * lado > 2 && MD.hypot(Math.max(0, AREA_U - ou), Math.max(0, aw - AREA_W)) < U.cruzamentoRaio)) n++;
    }
    const Pc = U.cruzamentoP[Math.min(n, 3)];
    considerar('cruzamento', Pc * (U.cruzamentoV + K) - (1 - Pc) * K, -1);
  }
  if (!cobranca) {
    const xt0 = ameacaEsperada(u0, w0);
    // 3) chute: xG pelo ângulo × (1 − bloqueio da linha até o canto longe do goleiro); depois do
    //    chute a posse acaba (− K)
    const dGol = MD.hypot(MX - u0, w0);
    if (dGol <= (A.ment >= 1 ? cfg.chuteMaxOfensivo : cfg.chuteMax)) {
      let gz = 0;
      for (const o of m.jogadores) if (o.time !== j.time && o.posicao === 'GOL') { gz = o.z * lado; break; }
      const zm = gz > w0 * 0.15 ? -(MEIO_GOL - U.miraPoste) : (MEIO_GOL - U.miraPoste);
      const bl = Math.max(riscoCaminho(m, j.time, j.x, j.z, MX * lado, zm * lado, U.vChute, 0, true), corpoNaLinha(m, j, MX * lado, zm * lado));
      const fora = u0 < AREA_U || Math.abs(w0) > AREA_W;
      const xg = chanceDeGol(u0, w0) * (1 - U.bloqueio * bl) * U.chute * (fora ? U.chuteLonge : 1);
      considerar('chute', xg - (1 - xg) * K * U.chutePosse, -1, 0, 0, clamp(U.chuteForca[0] + (dGol - 8) / 50, U.chuteForca[0], U.chuteForca[1]), zm);
    }
    // 4) conduzir: 7 direções em volta da direção do gol, 5 m à frente. Quem segura a bola demais
    //    perde a vantagem (a defesa se arruma): depois de conduzSolta[0] s com a bola, conduzir vale
    //    cada vez menos (até conduzSolta[2]× em conduzSolta[1] s) — o condutor solta a bola
    const tPosse = (m.tick - ia.desde) * DT, cs = U.conduzSolta;
    const solta = clamp(1 - (1 - cs[2]) * (tPosse - cs[0]) / (cs[1] - cs[0]), cs[2], 1);
    const aGol = MD.atan2(-w0, MX - u0);
    for (let k = -3; k <= 3; k++) {
      const a = aGol + k * U.passoAngConduz;
      const du = MD.cos(a), dw = MD.sin(a);
      const pu = u0 + du * U.conduzDist, pw = w0 + dw * U.conduzDist;
      if (Math.abs(pw) > MZ - 1.5 || pu > MX - 1 || pu < -MX + 1) continue;
      // dentro da área a defesa fecha (Metrica: 6 defensores na área no cruzamento, 4–8): conduzir
      // para lá vale menos que o caminho livre de agora sugere, e mais ainda perto do gol
      const naArea = pu > AREA_U && Math.abs(pw) < AREA_W;
      const P = manter(m, j, pu * lado, pw * lado) * (naArea ? (MX - pu < U.manterPerto ? U.manterArea[1] : U.manterArea[0]) : 1);
      const Uc = (P * (ameacaEsperada(pu, pw) * frente(du * U.conduzDist) + K) * solta - (1 - P) * perda(pu, pw)) * U.conduz;
      const ehAtual = atual === 'conduz' && Math.abs(difAng(MD.atan2(ia.dw, ia.du), a)) < U.passoAngConduz / 2;
      const v = Uc * (ehAtual ? cfg.histerese : 1);
      if (v > mU) { mU = v; melhor = 'conduz'; mAlvo = -1; mDu = du; mDw = dw; }
    }
    // 5) proteger: marcador colado; segura até protegeMax s por posse (depois solta a bola)
    if (advMaisPerto(m, j.time, j.x, j.z) < U.protegeDist && (atual === 'protege' ? m.tick - ia.opDesde : 0) < seg(U.protegeMax)
      && (m.tick - ia.desde) * DT < U.protegeMax * 2) {
      considerar('protege', U.protegeP * (xt0 + K) - (1 - U.protegeP) * perda(u0, w0), -1);
    }
  }
  if (!melhor) return;
  // compromisso: a direção de condução só muda depois de compromisso s (uma ação vale na hora)
  if (melhor === 'conduz' && atual === 'conduz' && m.tick - ia.opDesde < seg(cfg.compromisso)) return;
  if (atual === 'protege' && melhor !== 'protege' && melhor === 'conduz' && m.tick - ia.opDesde < seg(cfg.compromisso)) return;
  if (melhor !== atual || mAlvo !== ia.alvo) ia.opDesde = m.tick;
  ia.op = melhor; ia.alvo = mAlvo;
  ia.correr = false; ia.curta = false;
  if (melhor === 'conduz') {
    ia.du = mDu; ia.dw = mDw; ia.mira = null;
    // corre com campo à frente; condução curta com o adversário em cima
    const livre = livreAFrente(m, j, mDu * lado, mDw * lado);
    ia.correr = livre > U.correrLivre && (A.transOf || u0 < U.correrAte);
    ia.curta = livre < U.curtaPerto;
    return;
  }
  if (melhor === 'protege') { ia.mira = null; return; }
  // ação com bola: guarda a mira e aperta o botão virtual (o tipo é o nome da opção)
  ia.miraAlvo = mAlvo >= 0;
  if (melhor === 'chute') ia.mira = miraChute(j, lado, mAx);
  else if (melhor === 'cruzamento') ia.mira = miraCruzamento(j, A);
  else { ia.mira = { x: 1, z: 0, ax: mAx, az: mAz }; atualizarMira(m, j, ia); }
  acaoIA(m, j, melhor === 'cruzamento' ? 'lancamento' : melhor, mForca);
  // enfiada alta: o mesmo botão com o modificador (acoes.js enfiada: p.mod = por cima da defesa)
  if (melhor === 'enfiada' && mAlta && j.iaAcao) j.iaAcao.bot |= BOTAO.MOD;
}

/**
 * Mira do chute: a direção que, pela conta do acoes.js chute (lat × meio gol × 1,4), põe a bola no
 * canto zm (referencial de quem ataca).
 */
function miraChute(j, lado, zm) {
  const bx = j.x * lado, bz = j.z * lado;
  const a = MD.atan2(-bz, MX - bx) + MD.asin(clamp(zm / (MEIO_GOL * 1.4), -0.99, 0.99));
  return { x: MD.cos(a) * lado, z: MD.sin(a) * lado, ax: 0, az: 0 };
}

/**
 * Mira do cruzamento: o setor que o acoes.js cruzamento lê do analógico (1º pau, 2º pau ou marca do
 * pênalti), pela zona com mais companheiros chegando.
 */
function miraCruzamento(j, A) {
  const lado = A.lado;
  const zonas = zonasCruzamento(lado, j.z);
  let mel = 2, mn = -Infinity;
  for (let k = 0; k < 3; k++) {
    let n = 0;
    for (const o of A.ids) { if (o === j) continue; const d = MD.hypot(o.x - zonas[k].x, o.z - zonas[k].z); if (d < 7) n += 1 - d / 7; }
    if (n > mn) { mn = n; mel = k; }
  }
  const sz = j.z >= 0 ? 1 : -1;
  const phi = mel === 0 ? 0.9 : mel === 2 ? -0.9 : 0; // acoes.js: phi = atan2(mr.x·lado, −mr.z·sz)
  return { x: lado * MD.sin(phi), z: -sz * MD.cos(phi), ax: 0, az: 0 };
}

/**
 * Chance de manter a bola conduzindo até (px, pz). Cada adversário perto do caminho ameaça pela
 * distância lateral (até manterRaio m) — inteiro se está à frente (entre a bola e o destino: um
 * zagueiro de frente não deixa passar conduzindo; duelo 1 × 1 ganho ~50%), menos se está de lado
 * ou atrás; o drible do condutor tira parte da ameaça. Produto das chances de cada um.
 */
function manter(m, j, px, pz) {
  const U = IA_ATAQUE.utilidade;
  const dx = px - j.x, dz = pz - j.z, L = MD.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const k = U.manterPeso * lerp(1.15, 0.8, (j.par.attr.drible ?? 65) / 100);
  let P = 1;
  for (const o of m.jogadores) {
    if (o.time === j.time || o.papel === 'parado' || o.papel === 'marcador') continue;
    const ox = o.x - j.x, oz = o.z - j.z;
    const pr = ox * ux + oz * uz;
    if (pr < -2) continue;
    const s = clamp(pr, 0, L);
    const lat = MD.hypot(ox - s * ux, oz - s * uz);
    if (lat >= U.manterRaio) continue;
    const frente = pr > 0.3 ? 1 : U.manterLado;
    P *= 1 - clamp((U.manterRaio - lat) / (U.manterRaio - 0.5), 0, 1) * frente * k;
  }
  return P;
}

/** Distância livre à frente na direção (dx, dz): o adversário mais perto num cone de ±45°. */
function livreAFrente(m, j, dx, dz) {
  let d = 40;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const ox = o.x - j.x, oz = o.z - j.z, e = MD.hypot(ox, oz);
    if (e < 1e-6) return 0;
    if ((ox * dx + oz * dz) / e > 0.7 && e < d) d = e;
  }
  return d;
}
