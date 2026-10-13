// Cavadinha com DOIS TOQUES no CHUTE (pedido do dono, 12/10: "cavadinha, clicando duas vezes em chutar").
// O 2º aperto do CHUTE antes de o chute do 1º tocar na bola vira cavadinha — de qualquer lugar, mirando pelo
// analógico, com a força do 2º toque (mais tempo = mais alta). O 1º toque rápido (< ACOES.cavadinha.toqueRapido)
// espera a janela do 2º; o chute carregado sai na hora, como antes. A IA continua como antes (a cavadinha dela sai
// sozinha com o goleiro adiantado). Cenas (humano sozinho com a bola, parado/trote/corrida/arrancada em 6 fases
// da passada):
//  A. dois toques (1º de 3–10 ticks, intervalo de 2–9 ticks = 33–150 ms, 2º de 3–40 ticks) → cavadinha em todas,
//     um chute só;
//  B. um toque (2 a 48 ticks; sem goleiro, goleiro adiantado e goleiro na linha) → nunca cavadinha, o chute sai;
//  C. tempo até o contato: o chute carregado do humano sai no MESMO tick que o da IA (a mesma cena com a entrada da
//     IA, `ia: true`); o toque rápido espera no máximo a janela;
//  D. força do 2º toque: segurado = mais alta (ápice);
//  E. mira pelo analógico: a bola cruza a linha do lado pedido;
//  F. qualidade com o goleiro adiantado (StatsBomb-1485: ~30% de gols com o chutador a 0–10 m do goleiro; 41,8% no
//     alvo) e com o goleiro na linha (informação);
//  G. chute carregado + 2º toque depois do contato: só o chute (nada de 2º chute);
//  H. pênalti (Panenka): dois toques = cavadinha; um toque = chute. Tiro livre direto: dois toques = cavadinha (por
//     cima da barreira); um toque = chute. Escanteio: o CHUTE não cobra bola parada (nem duas vezes) — nada sai, e o
//     PASSE depois cobra normalmente;
//  I. botão que já vinha segurado quando o controle trocou (o time apertava no passo anterior): não é toque rápido —
//     o contato não espera a janela (antes: a troca virava um "toque" de poucos ticks e o chute atrasava; o
//     hash-igual do treino de ataque mudava por isso).
//   node tools/teste-cavadinha.mjs [--js <pasta js>]   (--js: mede outra cópia da lógica, ex.: a base — o "antes")
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt, media } from './lib/medidas.mjs';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const { criarMundo, passo } = await imp('sim.js');
const { BOTAO, CAMPO, ACOES, PASSO } = await imp('config.js');
const P = await imp('partida.js');
const A = await imp('acoes.js');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok === null ? 'INFO' : ok ? 'PASSOU' : 'REPROVOU']); if (ok === false) falhas++; }
const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;
const JANELA = Math.round((ACOES.cavadinha?.janela ?? 0) / PASSO);
const ANDARES = [['parado', 0, 0], ['trote', 0.5, 0], ['corrida', 1, 0], ['arrancada', 1, BOTAO.CORRER]];
const FASES = 6;

/**
 * Uma cena: o humano (id 0) com a bola no pé, de frente para o gol de +x. opc = {andar: [nome, mag, botões],
 * fase (ticks a mais de embalo), x, z, gk: x do goleiro (ou null), sem, canto (rad do analógico em relação ao gol),
 * ia (a entrada vem da IA: a demo)}. seq = [[aperta (0/1), ticks], ...] (o analógico segue o andar durante a
 * sequência). Devolve os chutes (log com ação), o tick de soltar o 1º toque, o do 1º contato, a trajetória depois
 * do contato e onde ela cruzou a linha do gol.
 */
function cena(seq, opc = {}) {
  const [, mag, bot] = opc.andar ?? ANDARES[0];
  const x0 = opc.x ?? (mag > 0 ? GX - 34 : GX - 16), z0 = opc.z ?? 2;
  const rumo = Math.atan2(-z0, GX - x0);
  const jog = [{ id: 0, x: x0, z: z0, rumo, time: 0, papel: 'humano', posicao: 'ATA', attr: { finalizacao: opc.fin ?? 80 } }];
  if (opc.gk != null) jog.push({ id: 20, x: opc.gk, z: opc.gkz ?? 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: { reflexo: 75, posicionamento: 74, mergulho: 75 } });
  const m = criarMundo({ semente: opc.sem ?? 1, jogadores: jog, bola: { x: x0 + Math.cos(rumo) * 0.4, z: z0 + Math.sin(rumo) * 0.4 }, posse: 0, log: true });
  const j = m.jogadores[0];
  const iaE = !!opc.ia;
  // embalo: corre para o gol (a fase da passada muda com os ticks a mais)
  const pre = mag > 0 ? 40 + (opc.fase ?? 0) * 7 : 20 + (opc.fase ?? 0);
  for (let i = 0; i < pre; i++) {
    const r = Math.atan2(-j.z, GX - j.x);
    passo(m, { 0: { x: Math.cos(r) * mag, z: Math.sin(r) * mag, botoes: bot, ia: iaE } });
  }
  let t = 0, solta = null, contato = null;
  const analog = () => {
    const r = Math.atan2(-j.z, GX - j.x) + (opc.canto ?? 0);
    const mm = opc.canto ? Math.max(mag, 0.6) : mag;
    return { x: Math.cos(r) * mm, z: Math.sin(r) * mm };
  };
  const ver = () => { if (contato == null && m.log.some(e => e.acao)) contato = t; };
  for (const [aperta, dur] of seq) {
    for (let i = 0; i < dur; i++) {
      const a = analog();
      passo(m, { 0: { x: a.x, z: a.z, botoes: bot | (aperta ? BOTAO.CHUTE : 0), ia: iaE } });
      t++; ver();
    }
    if (aperta && solta == null) solta = t;
  }
  for (let i = 0; i < 90 && contato == null; i++) {
    const a = opc.canto ? analog() : { x: 0, z: 0 };
    passo(m, { 0: { x: a.x, z: a.z, botoes: 0, ia: iaE } }); t++; ver();
  }
  // voo depois do contato: ápice, linha do gol, desfecho
  let apice = 0, linha = null, res = null;
  if (contato != null) {
    for (let i = 0; i < 300 && !res; i++) {
      const a = { x: m.bola.p.x, y: m.bola.p.y, z: m.bola.p.z };
      passo(m, { 0: { x: 0, z: 0, botoes: 0, ia: iaE } }); t++;
      const b = m.bola.p;
      apice = Math.max(apice, b.y);
      if (!linha && b.x >= GX && a.x < GX) { const f = (GX - a.x) / (b.x - a.x); linha = { y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }; }
      for (const e of m.eventos) { if (e.tipo === 'gol') res = 'gol'; else if (e.tipo === 'defesa') res = 'defesa'; }
      if (!res && (b.x > GX + 1 || (m.bola.rolando && Math.hypot(m.bola.v.x, m.bola.v.z) < 0.5))) res = 'fora';
      if (!res && m.naMao != null) res = 'defesa';
    }
  }
  const chutes = m.log.filter(e => e.acao);
  const noAlvo = !!linha && Math.abs(linha.z) < MEIO - 0.11 && linha.y < CAMPO.gol.altura - 0.11;
  return { chutes, tipo: chutes[0]?.tipo ?? null, solta, contato, dt: contato != null && solta != null ? contato - solta : null, apice, linha, res, noAlvo };
}

// ------------------------------------------------------------------ A. dois toques → cavadinha
const PADROES = [[3, 2, 3], [4, 4, 4], [6, 6, 5], [8, 8, 10], [5, 3, 40], [10, 9, 4], [4, 9, 20]];
{
  let n = 0, cav = 0, um = 0;
  const falhou = [];
  for (const an of ANDARES) for (let f = 0; f < FASES; f++) for (const [a, g, b] of PADROES) {
    const r = cena([[1, a], [0, g], [1, b]], { andar: an, fase: f, sem: 10 + f });
    n++;
    if (r.tipo === 'cavadinha') cav++;
    else if (falhou.length < 4) falhou.push(`${an[0]} fase ${f} ${a}/${g}/${b}: ${r.tipo ?? 'nenhum chute'}`);
    if (r.chutes.length === 1) um++;
  }
  reg('A. dois toques no CHUTE (1º 3–10 ticks, intervalo 33–150 ms, 2º 3–40 ticks), 4 andares × 6 fases',
    `${cav}/${n} cavadinhas, ${um}/${n} com um chute só${falhou.length ? ' · ' + falhou.join('; ') : ''}`, `${n}/${n} e ${n}/${n}`, cav === n && um === n);
}

// ------------------------------------------------------------------ B. um toque → nunca cavadinha
const SEGURA = [2, 4, 8, 10, 11, 17, 30, 48];
const GOLEIROS = [['sem goleiro', null], ['goleiro adiantado (8 m)', GX - 8], ['goleiro na linha', GX - 1.2]];
{
  let n = 0, cav = 0, saiu = 0;
  const porG = {};
  for (const [nomeG, gk] of GOLEIROS) {
    let cg = 0, ng = 0;
    for (const an of ANDARES) for (let f = 0; f < FASES; f++) for (const h of SEGURA) {
      // com o goleiro adiantado o chutador fica a ~6 m dele (onde a IA faria a cavadinha sozinha)
      const r = cena([[1, h]], { andar: an, fase: f, sem: 20 + f, gk, x: gk === GX - 8 ? (an[1] > 0 ? GX - 26 : GX - 14) : undefined });
      n++; ng++;
      if (r.tipo) saiu++;
      if (r.tipo === 'cavadinha') { cav++; cg++; }
    }
    porG[nomeG] = `${cg}/${ng}`;
  }
  reg('B. um toque só (2–48 ticks segurando; sem goleiro, adiantado, na linha) → nunca cavadinha',
    `${cav} cavadinhas em ${n} (${Object.entries(porG).map(([k, v]) => `${k} ${v}`).join(', ')}); chute saiu em ${saiu}/${n}`, `0; ${n}/${n} chutes`, cav === 0 && saiu === n);
}

// ------------------------------------------------------------------ C. tempo até o contato
{
  let nCarr = 0, iguais = 0;
  const atrasos = [], porAndar = {};
  const dif = [];
  for (const an of ANDARES) for (let f = 0; f < FASES; f++) for (const h of SEGURA) {
    const hu = cena([[1, h]], { andar: an, fase: f, sem: 30 + f });
    const ai = cena([[1, h]], { andar: an, fase: f, sem: 30 + f, ia: true });
    if (hu.dt == null || ai.dt == null) { dif.push(`${an[0]} ${f} ${h}: sem contato`); continue; }
    const rapido = h * PASSO < (ACOES.cavadinha?.toqueRapido ?? 0);
    if (rapido) { atrasos.push(hu.dt - ai.dt); (porAndar[an[0]] ??= []).push(hu.dt - ai.dt); }
    else { nCarr++; if (hu.dt === ai.dt) iguais++; else if (dif.length < 4) dif.push(`${an[0]} fase ${f} ${h} ticks: humano ${hu.dt}, IA ${ai.dt}`); }
  }
  reg('C. chute carregado (≥ toqueRapido): contato no mesmo tick que o da IA (a mesma cena)', `${iguais}/${nCarr}${dif.length ? ' · ' + dif.join('; ') : ''}`, `${nCarr}/${nCarr}`, nCarr > 0 && iguais === nCarr);
  const ms = t => fmt(t * PASSO * 1000, 0);
  const med = l => [...l].sort((a, b) => a - b)[l.length >> 1];
  const txt = Object.entries(porAndar).map(([k, l]) => `${k} ${ms(med(l))}/${ms(Math.max(...l))}`).join(', ');
  const maxA = atrasos.length ? Math.max(...atrasos) : Infinity;
  // parado, o contato sai no fim da janela; correndo, no 1º toque possível depois dela (a passada: até mais um apoio)
  reg('C. toque rápido (< toqueRapido): espera a janela do 2º toque (mediana/máximo do atraso por andar)', `${atrasos.length} toques: ${txt} ms`, `mediana ≤ ${ms(JANELA)} ms (a janela), máximo ≤ ${ms(2 * JANELA)} ms (janela + 1 apoio)`,
    atrasos.length > 0 && JANELA > 0 && med(atrasos) <= JANELA && maxA <= 2 * JANELA);
}

// ------------------------------------------------------------------ D. força do 2º toque = altura
{
  const curto = [], longo = [];
  for (let s = 1; s <= 16; s++) {
    const a = cena([[1, 4], [0, 4], [1, 3]], { sem: 40 + s, x: GX - 18, z: (s % 5) - 2 });
    const b = cena([[1, 4], [0, 4], [1, 45]], { sem: 40 + s, x: GX - 18, z: (s % 5) - 2 });
    if (a.tipo === 'cavadinha') curto.push(a.apice);
    if (b.tipo === 'cavadinha') longo.push(b.apice);
  }
  const mc = media(curto), ml = media(longo);
  reg('D. 2º toque segurado → cavadinha mais alta (a 18 m)', `ápice ${fmt(mc, 2)} m (2º rápido, n ${curto.length}) → ${fmt(ml, 2)} m (2º segurado 0,75 s, n ${longo.length})`, 'segurado ≥ rápido + 1 m', curto.length >= 12 && longo.length >= 12 && ml >= mc + 1);
}

// ------------------------------------------------------------------ E. mira pelo analógico
{
  let n = 0, certo = 0;
  const zs = { 1: [], '-1': [] };
  for (let s = 1; s <= 40; s++) {
    const lado = s % 2 ? 1 : -1;
    const r = cena([[1, 4], [0, 4], [1, 5]], { sem: 60 + s, x: GX - 16, z: ((s % 5) - 2) * 0.5, canto: lado * 0.35 });
    if (r.tipo !== 'cavadinha' || !r.linha) continue;
    n++;
    zs[lado].push(r.linha.z);
    // analógico girado para + (a direita de quem chuta para o gol de +x) = canto de z positivo (acoes.js zPeloAnalogico)
    if (Math.sign(r.linha.z) === lado) certo++;
  }
  reg('E. dois toques mirando pelo analógico (±20°): a bola cruza a linha do lado pedido', `${certo}/${n} (z médio na linha: ${fmt(media(zs[1]), 2)} m pedindo +, ${fmt(media(zs['-1']), 2)} m pedindo −)`, '≥ 75% (n ≥ 30; a cavadinha é difícil de dosar)', n >= 30 && certo / n >= 0.75);
}

// ------------------------------------------------------------------ F. qualidade (StatsBomb-1485)
{
  for (const [nome, gk, meta] of [['goleiro adiantado (~8 m da linha), chutador a 6 m dele', GX - 8, true], ['goleiro na linha, chutador a 14 m', GX - 1.2, false]]) {
    let n = 0, gols = 0, alvo = 0;
    const desf = {};
    for (let s = 1; s <= 80; s++) {
      const gz = ((s % 5) - 2) * 0.8;
      const r = cena([[1, 4], [0, 5], [1, 4]], { sem: 2000 + s, x: GX - 14, z: gz, gk, gkz: gz });
      if (r.tipo !== 'cavadinha') continue;
      n++; if (r.res === 'gol') gols++; if (r.noAlvo) alvo++;
      desf[r.res] = (desf[r.res] ?? 0) + 1;
    }
    const pg = gols / Math.max(1, n);
    const txt = `${n}/80 cavadinhas, ${fmt(pg * 100, 0)}% de gols, ${fmt(alvo / Math.max(1, n) * 100, 0)}% no alvo (${Object.entries(desf).map(([k, v]) => `${k} ${v}`).join(', ')})`;
    if (meta) reg(`F. dois toques — ${nome}`, txt, 'sai cavadinha; 20–50% de gols (dados: ~30%)', n >= 72 && pg >= 0.2 && pg <= 0.5);
    else reg(`F. dois toques — ${nome}`, txt, 'informação (goleiro na linha: quase nunca entra)', null);
  }
}

// ------------------------------------------------------------------ G. chute carregado + 2º toque atrasado
{
  let n = 0, so1 = 0;
  for (const an of ANDARES) for (let f = 0; f < 3; f++) {
    const r = cena([[1, 20], [0, 12], [1, 4], [0, 60]], { andar: an, fase: f, sem: 80 + f });
    n++;
    if (r.chutes.length === 1 && r.tipo === 'chute') so1++;
  }
  reg('G. chute carregado e um 2º toque depois do contato: só o chute', `${so1}/${n}`, `${n}/${n}`, so1 === n);
}

// ------------------------------------------------------------------ H. pênalti (Panenka)
/**
 * Falta a favor do time 0 (o humano cobra): pênalti (x 45, na área) ou tiro livre direto (x, fora da área, com
 * barreira). seq de CHUTE a partir da hora em que a cobrança fica pronta. Devolve o modo do 1º chute e o desfecho.
 */
function falta(sem, seq, opc = {}) {
  const x = opc.x ?? 45, z = opc.z ?? 3, area = opc.area ?? true;
  const m = P.criarPartida({ semente: sem });
  for (let i = 0; i < 200; i++) P.passoPartida(m, P.entradaDemoPartida(m));
  const At = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
  const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
  P.teleportar(At, x, z, 0); P.teleportar(D, x - 1, z + 0.5, 0);
  m.bola.p.x = x + 0.4; m.bola.p.z = z; m.posse = At.id; m.naMao = null; m.voo = null;
  m.eventos = [];
  m.faltaPendente = { def: D.id, cond: At.id, time: 0, x, z, area, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick };
  P.regrasPartida(m);
  const tipo = area ? 'penalti' : 'tiroLivre';
  if (m.parada?.tipo !== tipo || (!area && !m.parada.direto)) return { erro: `sem ${tipo}${area ? '' : ' direto'}` };
  // espera a cobrança ficar pronta com o cobrador do humano
  for (let i = 0; i < 60 * 10 && !(m.parada && m.tick >= m.parada.pronta + 2 && m.controlado[0] === m.parada.cobrador); i++) P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
  if (!m.parada || m.controlado[0] !== m.parada.cobrador) return { erro: 'o cobrador não é do humano' };
  const barreira = m.parada.barreira?.n ?? 0;
  let modo = null, res = null, bateu = false;
  const olhar = evs => {
    for (const e of evs) {
      if (e.tipo === 'chute' && !modo) modo = e.modo;
      if (e.tipo === 'penalti') res = e.resultado;
      if (e.tipo === 'bateuBarreira') bateu = true;
      if (!area && modo && !res && (e.tipo === 'gol' || e.tipo === 'defesa')) res = e.tipo;
    }
  };
  for (const [aperta, dur] of seq) for (let i = 0; i < dur; i++) olhar(P.passoPartida(m, { x: 0, z: 0, botoes: aperta ? BOTAO.CHUTE : 0 }));
  for (let i = 0; i < 60 * 6 && !res; i++) olhar(P.passoPartida(m, { x: 0, z: 0, botoes: 0 }));
  if (!area && modo && !res) res = 'fora';
  return { modo, res, barreira, bateu };
}
const penalti = (sem, seq) => falta(sem, seq);
{
  let n2 = 0, cav = 0, n1 = 0, nc1 = 0, erro = null;
  const desf = {};
  for (let s = 1; s <= 12; s++) {
    const d = penalti(7000 + s, [[1, 4], [0, 5], [1, 4]]);
    if (d.erro) { erro = d.erro; continue; }
    n2++; if (d.modo === 'cavadinha') { cav++; desf[d.res] = (desf[d.res] ?? 0) + 1; }
    const u = penalti(7000 + s, [[1, 4]]);
    if (u.erro) { erro = u.erro; continue; }
    n1++; if (u.modo === 'chute') nc1++;
  }
  reg('H. pênalti do humano: dois toques = cavadinha (Panenka); um toque = chute', `dois toques: ${cav}/${n2} cavadinhas (${Object.entries(desf).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}) · um toque: ${nc1}/${n1} chutes${erro ? ` · ${erro}` : ''}`, '12/12 e 12/12', n2 === 12 && cav === 12 && n1 === 12 && nc1 === 12);
}
{
  // tiro livre direto a ~22 m, de frente, com barreira: a cavadinha cai logo depois da linha (alemDaLinha) e passa
  // por cima da barreira; o desfecho é informação (de longe ela é um balão fácil para o goleiro na linha)
  let n2 = 0, cav = 0, n1 = 0, nc1 = 0, bateu = 0, comBarreira = 0, erro = null;
  const desf = {};
  for (let s = 1; s <= 10; s++) {
    const o = { x: 30.5, z: (s % 5) - 2, area: false };
    const d = falta(7100 + s, [[1, 4], [0, 5], [1, 4]], o);
    if (d.erro) { erro = d.erro; continue; }
    n2++; if (d.barreira > 0) comBarreira++;
    if (d.modo === 'cavadinha') { cav++; desf[d.res] = (desf[d.res] ?? 0) + 1; if (d.bateu) bateu++; }
    const u = falta(7100 + s, [[1, 4]], o);
    if (u.erro) { erro = u.erro; continue; }
    n1++; if (u.modo === 'chute' || u.modo === 'colocado') nc1++;
  }
  reg('H2. tiro livre direto (~22 m, barreira): dois toques = cavadinha, por cima da barreira; um toque = chute', `dois toques: ${cav}/${n2} cavadinhas (barreira em ${comBarreira}/${n2}; bateu nela ${bateu}; ${Object.entries(desf).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}) · um toque: ${nc1}/${n1} chutes${erro ? ` · ${erro}` : ''}`, '10/10, barreira em todos, nenhuma na barreira; 10/10 chutes', n2 === 10 && cav === 10 && comBarreira === 10 && bateu === 0 && n1 === 10 && nc1 === 10);
}
{
  // escanteio do humano: o CHUTE não cobra bola parada (só pênalti e tiro livre direto) — nem com dois toques; o PASSE
  // depois cobra normalmente (nada fica preso pela janela do 2º toque)
  let n = 0, ok = 0, erro = null;
  const det = [];
  for (let s = 1; s <= 6; s++) {
    const m = P.criarPartida({ semente: 7200 + s });
    for (let i = 0; i < 200; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    const lado = m.ataca[0];
    const d1 = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
    m.posse = null; m.naMao = null; m.voo = null;
    Object.assign(m.bola.p, { x: lado * (CAMPO.meioX + 0.6), y: 0.11, z: 12 }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = 1; m.partida.ultimoId = d1.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: d1.id, time: 1, tick: m.tick };
    for (let i = 0; i < 400 && !(m.parada && m.parada.tipo === 'escanteio' && m.parada.cobrador != null && m.tick >= m.parada.pronta + 2 && m.controlado[0] === m.parada.cobrador); i++) P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
    if (!m.parada || m.parada.tipo !== 'escanteio' || m.controlado[0] !== m.parada.cobrador) { erro = 'sem escanteio do humano'; continue; }
    n++;
    let chutes = 0, rolou = false;
    const olhar = evs => { for (const e of evs) { if (e.tipo === 'chute') chutes++; if (e.tipo === 'cobranca' || e.tipo === 'passe') rolou = true; } };
    for (const [aperta, dur] of [[1, 4], [0, 5], [1, 4], [0, 40]]) for (let i = 0; i < dur; i++) olhar(P.passoPartida(m, { x: 0, z: 0, botoes: aperta ? BOTAO.CHUTE : 0 }));
    const parado = !!m.parada && m.parada.tipo === 'escanteio' && !m.parada.rolou && !rolou && chutes === 0;
    for (let i = 0; i < 10; i++) olhar(P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.PASSE }));
    for (let i = 0; i < 90 && !rolou; i++) olhar(P.passoPartida(m, { x: 0, z: 0, botoes: 0 }));
    if (parado && rolou && chutes === 0) ok++;
    else if (det.length < 3) det.push(`semente ${7200 + s}: parado ${parado}, cobrou com o PASSE ${rolou}, chutes ${chutes}`);
  }
  reg('H3. escanteio: CHUTE duas vezes não cobra (nada sai); o PASSE depois cobra', `${ok}/${n}${det.length ? ' · ' + det.join('; ') : ''}${erro ? ` · ${erro}` : ''}`, '6/6', n === 6 && ok === 6);
}

// ------------------------------------------------------------------ I. botão segurado de antes da troca de controle
// (a mesma conta do passo: atualizarBotoesAcao com o time segurando o CHUTE no passo anterior e o jogador vendo a borda
// agora — a troca de controle com o botão apertado; o hash-igual do treino de ataque, semente 17, passa por isso)
{
  const res = {};
  for (const herdado of [true, false]) {
    const m = criarMundo({ semente: 5, jogadores: [{ id: 0, x: GX - 20, z: 0, rumo: 0, time: 0, papel: 'humano', posicao: 'ATA' }], bola: { x: GX - 19.6, z: 0 }, posse: 0, log: true });
    passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const j = m.jogadores[0];
    const t0 = m.tick;
    // aperto: o jogador vê a borda (antes 0); o time já segurava (herdado) ou não (aperto novo)
    m.botoesTimeAnt[0] = herdado ? BOTAO.CHUTE : 0; m.botoesTimeAgora[0] = BOTAO.CHUTE;
    j.porHumano = true; j.botoesAnt = 0; j.botoes = BOTAO.CHUTE;
    A.atualizarBotoesAcao(m, j);
    // solta 6 ticks depois (toque rápido para o jogador)
    m.tick = t0 + 6;
    m.botoesTimeAnt[0] = BOTAO.CHUTE; m.botoesTimeAgora[0] = 0;
    j.botoesAnt = BOTAO.CHUTE; j.botoes = 0;
    A.atualizarBotoesAcao(m, j);
    res[herdado] = { pedido: !!j.pedido, humano: !!j.pedido?.humano, espera: j.pedido?.espera != null ? j.pedido.espera - m.tick : null };
  }
  const h = res[true], nv = res[false];
  reg('I. CHUTE que já vinha segurado na troca de controle: o contato não espera a janela (o aperto novo espera)',
    `herdado: espera ${h.espera ?? 'nenhuma'}${h.humano ? ' (pedido do humano)' : ''} · aperto novo: espera ${nv.espera ?? 'nenhuma'} ticks`, 'herdado sem espera (e do humano); novo com a janela',
    h.pedido && h.humano && h.espera == null && nv.pedido && nv.espera === JANELA);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-cavadinha: REPROVOU (${falhas})` : '\nteste-cavadinha: PASSOU');
process.exit(falhas ? 1 : 0);
