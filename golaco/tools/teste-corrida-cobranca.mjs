// teste-corrida-cobranca (item 70, P1 da golaco/FILA.md; contrato "Cobranças com corrida (item 70, P1)" no CONTRATOS.md;
// js/corrida.js; pesquisa em PESQUISA-ETAPA4.md §16): no pênalti, no escanteio, no tiro de meta e no tiro livre (direto e
// indireto) o cobrador sai do ponto de partida e CORRE até a bola pela locomoção do jogo; o contato é o toque de ação com o
// pé de apoio ao lado da bola. Antes (a main 630960d4) ninguém corria: o cobrador era levado a 0,4 m da bola e a bola saía no
// tick do pedido — o teste REPROVA nela (anda 0 m).
//
// Cenas: estados do COMEÇO de partidas IA × IA (a bola rolando, antes de qualquer bola parada com corrida: as duas versões
// são bit a bit iguais até ali — hash-partida), e a parada forçada (a bola fora com o último toque certo, a falta, o pênalti).
// Os mesmos estados nas duas versões: o tempo da bola morta até a bola rolar é PAREADO com o da main, gravado em
// tools/dados/corrida-ref.json (--gravar-referencia <pasta js da main>).
//
// Metas (para a IA — a cobrança da IA do time de fora e a da IA jogando pelo humano, a demo — e para a pessoa):
//  C1 anda ≥ 3,5 m no pênalti e ≥ 2 m nos outros, do começo da corrida ao contato (main: 0);
//  C2 chega a 2,5–5 m/s no contato (Kellis & Katis 2007; Lees et al. 2010: ~3–4 m/s);
//  C3 o pé de apoio plantado a 0,2–0,45 m do centro da bola no contato (Scurr & Hall 2009: 32,7 ± 7 cm ao lado, 9,7 cm
//     atrás; Hay 1993: 5–28 cm ao lado): todas as cobranças;
//  C3b o gesto: no contato o pé que bate está no ar, com o peso do gesto (conducao.js atualizarGesto) ≥ 0,5 e o tornozelo
//     desenhado a ≤ 0,35 m do centro da bola (o toque de ação de sempre, desenhado pela pose);
//  C4 sem patinar (a régua do teste-patinacao, no cobrador da corrida, quadro a quadro pela pose): pé plantado ≤ 0,05 m/s;
//     nenhum pé salta (≤ 2,5·v + 3 m/s); pouso ≤ 0,19·v + 0,81 m/s; e o pé plantado na SIMULAÇÃO não sai do lugar (o corpo
//     anda pela passada, nunca arrastando o pé);
//  C5 o tempo da bola morta à bola rolando, por tipo, na IA: a média da diferença pareada com a main a ≤ ±0,2 s (o relógio
//     não para nas bolas paradas: a IA começa a corrida antes);
//  C6 a cobrança mirada da pessoa (escanteio ALTA com curva, tiro livre CHUTE com barreira) com o erro do cobrador zerado:
//     a bola real passa a ≤ 3 cm da linha prevista NO SOLTAR do botão (mira-linha.js), do contato ao fim do voo;
//  C7 a cavadinha da pessoa: o 2º toque no CHUTE no MEIO da corrida (≥ ACOES.toqueDuplo depois de soltar o 1º) ainda vira
//     cavadinha (a janela vale a corrida toda — decisão do dono a confirmar: CONTRATOS.md);
//  C8 dois humanos (online 1×1): o mesmo jogo nos dois aparelhos — dois mundos com as mesmas entradas (um deles copiado no
//     meio da corrida) têm o MESMO hash a cada passo, da montagem ao fim do voo;
//  C9 o apito da cobrança no pênalti e no tiro livre com barreira: um por parada, no pronta ou no começo da corrida da IA.
//  C10 o escanteio: quem ataca a zona ESPERA no lugar dele na corrida (no contato andou em média ≤ 2% do caminho da saída à
//     zona; ninguém além de 20% dele): a arrancada para a zona é no chute, como antes. (31/10: até aqui ele saía junto com o
//     cobrador — em média ≥ 3% —, com zonaAntes 0,15; no canhão de escanteios do teste-goleiro-realista, estados do meio da
//     partida, o gol de escanteio ia de 5,1% (main, 22 de 435) a 11,2% (57 de 507), e com ele parado, 6,9% (33 de 480); com
//     35% do caminho, o canhão do teste-bolas-paradas ia de 6,3 a 11,8%.)
//  C11 sem mergulho (01/11: na penúltima passada o pé de apoio ficava plantado com o corpo a ~4,8 m/s andando ~1 m por cima
//     dele — a regulagem esticava o ritmo da passada inteira, o apoio junto — e o quadril caía de 0,92 a 0,63 m em ~0,1 s, a
//     cabeça de 1,55 a 1,26 m; no replay do gol de pênalti a 1ª pessoa balançava 7,5 cm, o G6 do teste-replay-anel): em cada
//     corrida, do 1º passo ao contato, a QUEDA DO QUADRIL abaixo de 0,92 m (a altura da corrida do jogo a ~4 m/s, anim.js
//     0,985 − o agachamento da velocidade) ≤ 0,12 m e nenhuma ≥ 0,15 m, e a da CABEÇA (de pé no ponto de partida → o mínimo)
//     ≤ 0,20 m. A régua: no apoio da corrida o centro de massa baixa ~7 cm (Lee & Farley 1998, J Exp Biol 201:2935) e o
//     joelho de apoio do chute está a ~26° no pouso e ~42° no contato (Lees et al. 2010, J Sports Sci 28(8):805) — o quadril
//     ~2–5 cm abaixo da perna esticada; o desenho da corrida do jogo soma o balanço dele (±3 cm a 4 m/s) e o alcance das
//     pernas: a corrida normal (IA × IA, main, sementes 3001–3004) fica abaixo de 0,92 m 0,063 m na mediana, 0,106 no p90 e
//     0,113 no p95 a 4–4,5 m/s (0,078 · 0,128 · 0,137 a 4,5–5 m/s) — a corrida da cobrança não desce mais que a corrida
//     do jogo na mesma velocidade (o mergulho era 0,29 m). As corridas de todas as partes (A, B) e um
//     CANHÃO DE COBRADORES (cada cena com outro jogador de linha do time batendo: a distância, o ângulo e a velocidade da
//     corrida são de cada um — corrida.js fracDoJogador — e o pé de apoio também), que confere também o C3 e o C4 neles.
//
//   node tools/teste-corrida-cobranca.mjs                               (lógica do repositório)
//   node tools/teste-corrida-cobranca.mjs --js <pasta js>                (outra cópia: a main → REPROVA)
//   node tools/teste-corrida-cobranca.mjs --gravar-referencia <pasta js> [--origem "main <commit>"] (grava os tempos da main em
//     tools/dados/corrida-ref.json)
//   [--cenas 16] (cenas por tipo e caminho)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const GRAVA = args.includes('--gravar-referencia');
const JS = path.resolve(GRAVA ? arg('--gravar-referencia') : arg('--js', path.join(AQUI, '../js')));
const NC = +arg('--cenas', 16);
const REF = path.join(AQUI, 'dados/corrida-ref.json');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const S = await imp('sim.js');
const AN = await imp('anim.js');
const C = await imp('config.js');
const BP = await imp('bolas-paradas.js');
const temCorrida = fs.existsSync(path.join(JS, 'corrida.js'));
const CO = temCorrida ? await imp('corrida.js') : null;
const ML = fs.existsSync(path.join(JS, 'mira-linha.js')) ? await imp('mira-linha.js') : null;
const { PASSO, BOTAO, CAMPO, MIRA, ACOES } = C;
const MX = CAMPO.meioX, J = AN.J;
const NADA = { x: 0, z: 0, botoes: 0 };

const linhas = [['item', 'medido', 'meta', '']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : String(v));
const jog = (m, id) => m.jogadores.find(o => o.id === id);
const TIPOS_C = ['penalti', 'escanteio', 'tiroDeMeta', 'tiroLivre'];

// ------------------------------------------------------------------------------------------------- cenas
const estados = new Map();
/** O começo da partida da semente s com a bola rolando no passo ≥ corte (sem nenhuma bola parada com corrida antes). */
function comeco(s, corte) {
  const k = `${s}/${corte}`;
  if (estados.has(k)) return estados.get(k);
  const m = P.criarPartida({ semente: s });
  let ok = true;
  for (let i = 0; i < corte + 1200; i++) {
    const pr = m.parada;
    if (pr && pr.cobrador != null && TIPOS_C.includes(pr.tipo)) { ok = false; break; }
    if (i >= corte && m.partida.estado === 'jogo' && !m.parada) break;
    P.passoPartida(m, P.entradaDemoPartida(m));
  }
  const r = ok && m.partida.estado === 'jogo' && !m.parada ? m : null;
  estados.set(k, r);
  return r;
}
function bolaFora(m, x, z, ult) {
  const j = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
  m.posse = null; m.naMao = null; m.voo = null;
  Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
  m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
  m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
}
/** Bola morta forçada (o pênalti e o tiro livre: como o árbitro da partida, partida.js decidirFalta/apitarFalta). */
function forcar(m, tipo, t, x, z, direto) {
  m.posse = null; m.naMao = null; m.voo = null;
  for (const j of m.jogadores) { j.pedido = null; j.carga = null; }
  P.bolaMorta(m, tipo, t, x, z);
  if (direto) m.parada.direto = true;
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
}
/** Cena k do tipo: o estado (cópia) com a parada forçada para o time t; null se a semente não serve. */
function cena(tipo, k) {
  const base = comeco(3001 + k, 360 + 90 * (k % 4));
  if (!base) return null;
  const m = S.copiarMundo ? S.copiarMundo(base) : structuredClone(base);
  const t = k % 2, la = m.ataca[t], sz = Math.floor(k / 2) % 2 ? 1 : -1;
  if (tipo === 'escanteio') bolaFora(m, la * (MX + 0.6), sz * (6 + (k % 3) * 4), 1 - t);
  else if (tipo === 'tiroDeMeta') bolaFora(m, -la * (MX + 0.6), sz * (5 + (k % 3) * 5), 1 - t); // (fora do gol: |z| > 3,66)
  else if (tipo === 'penalti') forcar(m, 'penalti', t, la * (MX - CAMPO.marcaPenalti), 0, false);
  else if (tipo === 'tiroLivreD') forcar(m, 'tiroLivre', t, la * (MX - [20, 23, 26, 29][k % 4]), sz * [0, 5, 9][k % 3], true);
  else forcar(m, 'tiroLivre', t, la * (MX - [33, 38, 44][k % 3]), sz * [2, 12, 22][k % 3], false);
  return { m, t };
}

const vazio = () => ({ andou: [], v: [], apoio: [], planta: [], tempo: [], gesto: [], zona: [], queda: [], plantado: 0, razao: 0, pouso: 0, arrasta: 0, n: 0, semCorrida: 0, falhou: 0 });
// C11: a altura do quadril da corrida do jogo a ~4 m/s (anim.js pesEQuadril: 0,985 − 0,03 − 0,05·v/7), a régua da queda
const QUADRIL_CORRIDA = 0.92;
/**
 * O canhão de cobradores (C11): o q-ésimo jogador de linha do time (sem o cobrador escolhido) passa a bater — o mesmo que o
 * partida.js colocarNaCorrida faz com o escolhido (o plano pelo perfil da parada, ele no ponto de partida, a previsão) — e o
 * escolhido vai para o lugar dele.
 */
function trocarCobrador(m, pr, q) {
  const c = jog(m, pr.cobrador), cr = pr.corrida;
  const l = m.jogadores.filter(o => o.time === pr.time && o.posicao !== 'GOL' && o.id !== c.id).sort((a, b) => a.id - b.id);
  if (!l.length || !CO) return;
  const n = l[q % l.length];
  P.teleportar(c, n.x, n.z, n.rumo);
  const cr2 = CO.planejarCorrida(n, pr.x, pr.z, Math.atan2(cr.uz, cr.ux), cr.perfil);
  P.teleportar(n, cr2.x0, cr2.z0, cr2.rumo0);
  n.guia = null; c.guia = null;
  // (o papel: o cobrador fica 'parado' — o sim.js o move pelo j.guia —, o de antes volta ao dele: partida.js fecharMontagem)
  const papel = n.papel; n.papel = 'parado'; c.papel = pr.papel; pr.papel = papel;
  // (o estilo do pênalti da IA — item 70, P2 —: o mesmo da cena, com os números do jogador novo)
  if (cr.estiloIA && CO.definirEstilo) { cr2.estiloIA = cr.estiloIA; CO.definirEstilo(n, cr2, cr.estiloIA); }
  cr2.ticks = CO.estimarTicks(n, cr2);
  pr.corrida = cr2; pr.cobrador = n.id; m.posse = n.id;
}
const _zs = { x: 0, z: 0 }, _zz = { x: 0, z: 0 };
/** Quem ataca a zona no escanteio pr: [{id, sx, sz, zx, zz}] (a saída e a zona no mundo; bolas-paradas.js pontoEscanteio). */
function zonasDoEscanteio(m, pr) {
  if (!pr || pr.tipo !== 'escanteio' || !pr.papeis || !BP.pontoEscanteio) return [];
  const sz = pr.z >= 0 ? 1 : -1, l = [];
  for (const q of pr.papeis) {
    if (q.papel !== 'atacaZona') continue;
    BP.pontoEscanteio(m, pr.time, sz, q.su, q.sw, _zs); BP.pontoEscanteio(m, pr.time, sz, q.u, q.w, _zz);
    l.push({ id: q.id, sx: _zs.x, sz: _zs.z, zx: _zz.x, zz: _zz.z });
  }
  return l;
}
const limiteBalanco = v => 2.5 * v + 3, limitePouso = v => 0.19 * v + 0.81;
const TORN = [J.tornozeloE, J.tornozeloD];
const _pose = new Float32Array(AN.NJ * 3);

/**
 * Roda a cena até a bola rolar (ou 15 s): o que o cobrador andou na corrida (do 1º passo dela ao contato), a velocidade e
 * o pé de apoio no contato, a patinação dos pés desenhados dele na corrida, o tempo da bola morta à bola rolando e os
 * apitos. ent(m, pr) = a entrada do passo.
 */
function rodar(m, ent, troca = null) {
  const r = { andou: 0, v: NaN, dApoio: NaN, apoiado: false, tempo: NaN, corrida: false, plantado: 0, razao: 0, pouso: 0, arrasta: 0, apitos: 0, tipoVoo: null, pr: null, zona: null,
    qMin: Infinity, cab0: NaN, cabMin: Infinity, perfil: null, id: null };
  let zonas = [];
  let pr = null, ant = null, px = 0, pz = 0, inicio = -1, trocou = troca == null;
  for (let i = 0; i < 60 * 15; i++) {
    const p0 = m.parada;
    if (p0 && !p0.rolou) { pr = p0; if (inicio < 0) inicio = p0.inicio; }
    // o canhão de cobradores (C11): com o plano montado e o cobrador esperando, outro jogador de linha do time bate
    if (!trocou && pr && pr.corrida && pr.corrida.estado === 'espera') { trocou = true; trocarCobrador(m, pr, troca); }
    const correndo = !!(pr && pr.corrida && pr.corrida.estado === 'corre');
    const c = pr && pr.cobrador != null ? jog(m, pr.cobrador) : null;
    if (correndo && !r.corrida) {
      r.corrida = true; px = c.x; pz = c.z; zonas = zonasDoEscanteio(m, pr);
      AN.pose(c, m, _pose); r.cab0 = _pose[J.cabeca * 3 + 1]; r.perfil = pr.corrida.perfil; r.id = c.id;
    }
    const ev = P.passoPartida(m, ent(m, pr));
    r.apitos += ev.filter(e => e.tipo === 'apito' && e.motivo === 'cobranca').length;
    const c1 = pr && pr.cobrador != null ? jog(m, pr.cobrador) : null;
    if (c1 && r.corrida) {
      r.andou += Math.hypot(c1.x - px, c1.z - pz); px = c1.x; pz = c1.z;
      // a régua do teste-patinacao no cobrador da corrida (o quadro da montagem não conta: ela teletransporta)
      AN.pose(c1, m, _pose);
      // C11: o quadril (o guardado pela simulação, o mesmo do desenho) e a cabeça desenhada até o contato
      if (!(pr.rolou || m.parada !== pr)) { r.qMin = Math.min(r.qMin, c1.quadril ?? Infinity); r.cabMin = Math.min(r.cabMin, _pose[J.cabeca * 3 + 1]); }
      const atu = { t: TORN.map(k => [_pose[k * 3], _pose[k * 3 + 1], _pose[k * 3 + 2]]), sim: c1.pes.map(p => ({ apoio: p.apoio, x: p.x, z: p.z })), v: Math.hypot(c1.vx, c1.vz) };
      if (ant) {
        const v = Math.max(atu.v, ant.v);
        for (let p = 0; p < 2; p++) {
          const vp = Math.hypot(atu.t[p][0] - ant.t[p][0], atu.t[p][1] - ant.t[p][1], atu.t[p][2] - ant.t[p][2]) / PASSO;
          const s0 = ant.sim[p], s1 = atu.sim[p];
          if (s0.apoio && s1.apoio && s0.x === s1.x && s0.z === s1.z) r.plantado = Math.max(r.plantado, vp);
          // o pé plantado na simulação não sai do lugar (o corpo anda pela passada: nada de arrastar o pé)
          if (s0.apoio && s1.apoio) r.arrasta = Math.max(r.arrasta, Math.hypot(s1.x - s0.x, s1.z - s0.z));
          if (!s0.apoio && s1.apoio) r.pouso = Math.max(r.pouso, vp / limitePouso(v));
          r.razao = Math.max(r.razao, vp / limiteBalanco(v));
        }
      }
      ant = atu;
    }
    if (pr && (m.parada !== pr || pr.rolou)) {
      // a bola rolou neste passo
      r.tempo = (m.tick - inicio) * PASSO;
      r.tipoVoo = m.voo ? m.voo.tipo : null;
      r.pr = pr;
      // o escanteio (C10): a fração do caminho da saída à zona que cada um de quem ataca a zona andou até o contato
      if (zonas.length) r.zona = zonas.map(z => {
        const j = jog(m, z.id), ux = z.zx - z.sx, uz = z.zz - z.sz, L2 = ux * ux + uz * uz;
        return j && L2 > 1 ? ((j.x - z.sx) * ux + (j.z - z.sz) * uz) / L2 : NaN;
      }).filter(Number.isFinite);
      if (c1) {
        r.v = Math.hypot(c1.vx, c1.vz);
        const ps = pr.corrida ? pr.corrida.ps : 1 - ((c1.par.attr.pePreferido ?? 1) === 0 ? 0 : 1);
        const sup = c1.pes[ps];
        r.dApoio = Math.hypot(sup.x - pr.x, sup.z - pr.z); r.apoiado = sup.apoio;
        // o gesto: o pé que bate no ar, indo à bola (conducao.js atualizarGesto → a pose), o tornozelo desenhado perto dela
        const pe = 1 - ps, kick = c1.pes[pe];
        AN.pose(c1, m, _pose);
        const k = TORN[pe];
        r.gesto = { ar: !kick.apoio, puxa: kick.puxa, d: Math.hypot(_pose[k * 3] - pr.x, _pose[k * 3 + 2] - pr.z) };
      }
      return r;
    }
  }
  return r;
}
function somar(a, r) {
  a.n++;
  if (!Number.isFinite(r.tempo)) { a.falhou++; return; }
  if (!r.corrida) a.semCorrida++;
  if (r.gesto) a.gesto.push(r.gesto);
  if (r.zona && r.zona.length) a.zona.push(r.zona);
  a.andou.push(r.andou); a.v.push(r.v); a.apoio.push(r.dApoio); a.planta.push(r.apoiado ? 1 : 0); a.tempo.push(r.tempo);
  if (r.corrida && Number.isFinite(r.qMin)) a.queda.push({ q: QUADRIL_CORRIDA - r.qMin, c: r.cab0 - r.cabMin, perfil: r.perfil, id: r.id });
  a.plantado = Math.max(a.plantado, r.plantado); a.razao = Math.max(a.razao, r.razao); a.pouso = Math.max(a.pouso, r.pouso); a.arrasta = Math.max(a.arrasta, r.arrasta);
}

const TIPOS = [
  { nome: 'pênalti', tipo: 'penalti', anda: 3.5 },
  { nome: 'escanteio', tipo: 'escanteio', anda: 2 },
  { nome: 'tiro de meta', tipo: 'tiroDeMeta', anda: 2 },
  { nome: 'tiro livre direto', tipo: 'tiroLivreD', anda: 2 },
  { nome: 'tiro livre indireto', tipo: 'tiroLivreI', anda: 2 },
];
// a IA: a do time de fora (m.humanos = []: a cobrança da IA) e a IA jogando pelo humano (a demo, entrada com iaCobra)
const CAMINHOS = [
  { nome: 'IA', prep: m => { m.humanos = []; }, ent: () => NADA },
  { nome: 'demo', prep: (m, t) => { m.humanos = [t]; m.timeHumano = t; }, ent: m => P.entradaDemoPartida(m) },
];

// ---------------------------------------------------------------------------------- gravação da referência
if (GRAVA) {
  // (de onde: --origem <texto>, ex.: "main 630960d4"; o caminho da pasta não vai para o arquivo — é da máquina de quem gravou)
  const ref = { origem: arg('--origem', 'main'), cenas: NC, tempos: {} };
  for (const T of TIPOS) for (const K of CAMINHOS) {
    const l = [];
    for (let k = 0; k < NC; k++) {
      const q = cena(T.tipo, k);
      if (!q) { l.push(null); continue; }
      K.prep(q.m, q.t);
      const r = rodar(q.m, K.ent);
      l.push(Number.isFinite(r.tempo) ? +r.tempo.toFixed(4) : null);
    }
    ref.tempos[`${T.tipo}/${K.nome}`] = l;
  }
  fs.mkdirSync(path.dirname(REF), { recursive: true });
  fs.writeFileSync(REF, JSON.stringify(ref, null, 1) + '\n');
  console.log(`teste-corrida-cobranca: referência gravada em ${path.relative(process.cwd(), REF)} (${NC} cenas por tipo e caminho)`);
  process.exit(0);
}
const ref = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : null;

// ---------------------------------------------------------------------------------- A. a IA (C1–C5, C9)
const tot = vazio(), dt = {}, porTipo = {};
let apitosRuins = 0, apitosVistos = 0;
for (const T of TIPOS) {
  const a = (porTipo[T.tipo] = vazio());
  for (const K of CAMINHOS) {
    const difs = [];
    for (let k = 0; k < NC; k++) {
      const q = cena(T.tipo, k);
      if (!q) continue;
      K.prep(q.m, q.t);
      const r = rodar(q.m, K.ent);
      somar(a, r); somar(tot, r);
      const ok = Number.isFinite(r.tempo);
      if (ok && r.andou < T.anda) a.curta = (a.curta ?? 0) + 1;
      const rt = ref?.tempos?.[`${T.tipo}/${K.nome}`]?.[k];
      if (ok && rt != null && (NC === ref.cenas)) difs.push(r.tempo - rt);
      // o apito: um no pênalti e no tiro livre com barreira; nenhum nos outros
      if (ok && r.pr) {
        const quer = r.pr.tipo === 'penalti' || (r.pr.tipo === 'tiroLivre' && r.pr.barreira && r.pr.barreira.n > 0) ? 1 : 0;
        apitosVistos += quer;
        if (r.apitos !== quer) apitosRuins++;
      }
    }
    dt[`${T.tipo}/${K.nome}`] = difs;
  }
}
const min = l => (l.length ? Math.min(...l) : NaN), max = l => (l.length ? Math.max(...l) : NaN);
const media = l => (l.length ? l.reduce((x, y) => x + y, 0) / l.length : NaN);
for (const T of TIPOS) {
  const a = porTipo[T.tipo];
  reg(`C1 ${T.nome}: anda até a bola antes do contato (mínimo; IA e demo)`, `${f2(min(a.andou))} m (${a.andou.length} cobranças; sem corrida ${a.semCorrida}; não rolou ${a.falhou})`,
    `≥ ${f2(T.anda)} m`, a.andou.length > 0 && min(a.andou) >= T.anda && a.falhou === 0);
}
reg('C2 velocidade no contato (todas as cobranças da IA)', `${f2(min(tot.v))}–${f2(max(tot.v))} m/s`, '2,5–5 m/s', tot.v.length > 0 && min(tot.v) >= 2.5 && max(tot.v) <= 5);
const plantados = tot.planta.reduce((x, y) => x + y, 0);
reg('C3 pé de apoio no contato: plantado, a 0,2–0,45 m do centro da bola', `${f2(min(tot.apoio))}–${f2(max(tot.apoio))} m · plantado ${plantados}/${tot.planta.length}`,
  '0,2–0,45 m · todos', tot.apoio.length > 0 && min(tot.apoio) >= 0.2 && max(tot.apoio) <= 0.45 && plantados === tot.planta.length);
{
  const g = tot.gesto, bons = g.filter(x => x.ar && x.puxa >= 0.5 && x.d <= 0.35).length;
  reg('C3b o gesto no contato: o pé que bate no ar, o peso do gesto ≥ 0,5 e o tornozelo desenhado a ≤ 0,35 m do centro da bola',
    `${bons}/${g.length} (peso ${f2(min(g.map(x => x.puxa)))}–${f2(max(g.map(x => x.puxa)))}; tornozelo ${f2(min(g.map(x => x.d)))}–${f2(max(g.map(x => x.d)))} m)`, 'todas', g.length > 0 && bons === g.length);
}
reg('C4 sem patinar (o cobrador na corrida): plantado · salto / limite · pouso / limite · pé plantado na simulação andou', `${f2(tot.plantado)} m/s · ${f2(tot.razao)} · ${f2(tot.pouso)} · ${f2(tot.arrasta)} m`,
  '≤ 0,05 · ≤ 1 · ≤ 1 · 0', tot.andou.length > 0 && tot.plantado <= 0.05 && tot.razao <= 1 && tot.pouso <= 1 && tot.arrasta === 0);
if (!ref) reg('C5 a referência da main (tools/dados/corrida-ref.json)', 'não existe', '--gravar-referencia <pasta js da main>', false);
else {
  for (const T of TIPOS) for (const K of CAMINHOS) {
    const l = dt[`${T.tipo}/${K.nome}`];
    const mm = media(l);
    reg(`C5 ${T.nome} (${K.nome}): bola morta → rolando, a diferença pareada com a main (média)`, `${mm >= 0 ? '+' : ''}${f2(mm)} s (${l.length} pares; ${f2(min(l))} a ${f2(max(l))})`,
      '±0,2 s', l.length >= Math.min(4, NC) && Math.abs(mm) <= 0.2);
  }
}
{
  // C10 o escanteio: quem ataca a zona espera no lugar na corrida (a arrancada é no chute) e não chega antes
  const z = porTipo.escanteio.zona, todos = z.flat(), medias = z.map(media);
  reg('C10 escanteio: quem ataca a zona espera no lugar na corrida (fração média do caminho da saída à zona no contato) e não chega antes (a maior)',
    `média ${f2(media(medias))} (maior por escanteio ${f2(max(medias))}) · maior ${f2(max(todos))} (${z.length} escanteios, ${todos.length} atacantes)`,
    'média ≤ 0,02 · maior ≤ 0,20', z.length >= Math.min(4, NC) && media(medias) <= 0.02 && max(todos) <= 0.2);
}
reg('C9 o apito da cobrança: um no pênalti e no tiro livre com barreira, nenhum nos outros', `${apitosRuins} paradas fora disso (${apitosVistos} com apito)`, '0', apitosRuins === 0 && apitosVistos > 0);

// ---------------------------------------------------------------------------------- B. a pessoa (C1–C3 e C6, C7)
/** A pessoa (sem ia/iaCobra) do time t aperta `b` por k ticks a partir da bola pronta, com o analógico (x, z), e solta. */
function pessoa(b, k, dir = null, segundo = null) {
  let t0 = -1;
  return (m, pr) => {
    if (!pr || pr.rolou || pr.cobrador == null || m.tick < pr.pronta + 2) return NADA;
    if (t0 < 0) t0 = m.tick;
    const i = m.tick - t0;
    const x = dir ? dir.x : 0, z = dir ? dir.z : 0;
    if (i < k) return { x, z, botoes: b };
    if (segundo && i >= k + segundo.depois && i < k + segundo.depois + segundo.k) return { x, z, botoes: BOTAO.CHUTE };
    return { x, z, botoes: 0 };
  };
}
const PESSOA = [
  { nome: 'pênalti', tipo: 'penalti', b: BOTAO.CHUTE, k: 28, anda: 3.5, dir: t => ({ x: t, z: 0.35 }) },
  { nome: 'escanteio', tipo: 'escanteio', b: BOTAO.LANCAMENTO, k: 30, anda: 2 },
  { nome: 'tiro de meta', tipo: 'tiroDeMeta', b: BOTAO.LANCAMENTO, k: 40, anda: 2 },
  { nome: 'tiro livre direto', tipo: 'tiroLivreD', b: BOTAO.CHUTE, k: 34, anda: 2 },
  { nome: 'tiro livre indireto', tipo: 'tiroLivreI', b: BOTAO.PASSE, k: 20, anda: 2 },
];
const pes = vazio();
let pesCurta = 0;
for (const T of PESSOA) {
  for (let k = 0; k < Math.max(4, NC >> 1); k++) {
    const q = cena(T.tipo, k);
    if (!q) continue;
    q.m.humanos = [q.t]; q.m.timeHumano = q.t;
    const lado = q.m.ataca[q.t];
    const r = rodar(q.m, pessoa(T.b, T.k, T.dir ? T.dir(lado) : null));
    somar(pes, r);
    if (Number.isFinite(r.tempo) && r.andou < T.anda) pesCurta++;
  }
}
reg('C1–C3 a pessoa (os 5 tipos): anda o mínimo · velocidade · pé de apoio plantado a 0,2–0,45 m',
  `curtas ${pesCurta} · ${f2(min(pes.andou))} m · ${f2(min(pes.v))}–${f2(max(pes.v))} m/s · ${f2(min(pes.apoio))}–${f2(max(pes.apoio))} m, plantado ${pes.planta.reduce((x, y) => x + y, 0)}/${pes.planta.length} · não rolou ${pes.falhou}`,
  '0 · — · 2,5–5 · 0,2–0,45, todos · 0',
  pes.andou.length > 0 && pesCurta === 0 && pes.falhou === 0 && min(pes.v) >= 2.5 && max(pes.v) <= 5 && min(pes.apoio) >= 0.2 && max(pes.apoio) <= 0.45 && pes.planta.every(x => x === 1));
reg('C4 a pessoa: sem patinar (plantado · salto · pouso · pé plantado andou)', `${f2(pes.plantado)} m/s · ${f2(pes.razao)} · ${f2(pes.pouso)} · ${f2(pes.arrasta)} m`, '≤ 0,05 · ≤ 1 · ≤ 1 · 0', pes.andou.length > 0 && pes.plantado <= 0.05 && pes.razao <= 1 && pes.pouso <= 1 && pes.arrasta === 0);

// C6: a linha prevista no soltar × a bola real
if (ML) {
  const erro0 = MIRA.erro;
  MIRA.erro = 0;
  const pts = new Float64Array(MIRA.maxPontos * 3);
  const casos = [
    { nome: 'escanteio ALTA curva +1', tipo: 'escanteio', b: BOTAO.LANCAMENTO, k: 36, curva: 1 },
    { nome: 'tiro livre CHUTE com barreira curva +0,75', tipo: 'tiroLivreD', b: BOTAO.CHUTE, k: 34, curva: 0.75 },
  ];
  const ds = [];
  for (const cs of casos) {
    for (let k = 0; k < 3; k++) {
      const q = cena(cs.tipo, k);
      if (!q) continue;
      const m = q.m;
      m.humanos = [q.t]; m.timeHumano = q.t;
      // os outros longe (a bola sem ninguém no caminho, como o teste-mira A) e a pessoa espera a mira
      let pr = null, n = 0, d = 0, soltou = false, linha = false;
      const ent = pessoa(cs.b, cs.k);
      for (let i = 0; i < 60 * 15; i++) {
        const p0 = m.parada;
        if (p0 && !p0.rolou && p0.cobrador != null) {
          if (!pr) {
            pr = p0;
            for (const o of m.jogadores) if (o.id !== pr.cobrador) P.teleportar(o, -m.ataca[pr.time] * 8 + (o.id % 7), (o.id % 11) - 5, 0);
          }
          if (pr.mira) pr.mira.curva = cs.curva;
          // a linha no soltar (o 1º passo da corrida): a que a tela mostra
          if (!linha && pr.corrida && pr.corrida.estado === 'corre') { const v = ML.preverMira(m, pts, {}); n = v ? v.n : 0; linha = true; }
        }
        const antes = m.parada;
        P.passoPartida(m, ent(m, m.parada));
        if (pr && antes === pr && (m.parada !== pr || pr.rolou)) { soltou = true; break; }
      }
      if (!soltou || !linha || n < 3) { ds.push(Infinity); continue; }
      // a bola no fim do passo do contato = o ponto 1 da linha; depois, um ponto por passo
      for (let i = 1; i < n - 1; i++) {
        d = Math.max(d, Math.hypot(m.bola.p.x - pts[i * 3], m.bola.p.y - pts[i * 3 + 1], m.bola.p.z - pts[i * 3 + 2]));
        P.passoPartida(m, NADA);
        if (Math.abs(m.bola.p.x) > MX - 0.3 || m.posse != null || m.naMao != null) break;
      }
      ds.push(d);
    }
  }
  MIRA.erro = erro0;
  reg('C6 cobrança mirada da pessoa: a bola real × a linha mostrada no soltar (escanteio e tiro livre, erro zerado)', `${f2(max(ds) * 100)} cm (${ds.length} cobranças)`, '≤ 3 cm', ds.length >= 4 && max(ds) <= 0.03);
} else reg('C6 cobrança mirada (mira-linha.js)', 'não existe nesta lógica', '≤ 3 cm', false);

// C7: a cavadinha com o 2º toque no meio da corrida
{
  let cav = 0, n = 0, longe = 0;
  for (let k = 0; k < 4; k++) {
    const q = cena('penalti', k);
    if (!q) continue;
    q.m.humanos = [q.t]; q.m.timeHumano = q.t;
    const depois = Math.round((ACOES.toqueDuplo + 0.15) / PASSO); // o 2º toque além da janela de sempre
    const r = rodar(q.m, pessoa(BOTAO.CHUTE, 6, { x: q.m.ataca[q.t], z: 0 }, { depois, k: 5 }));
    if (!Number.isFinite(r.tempo)) continue;
    n++;
    if (r.tipoVoo === 'cavadinha') cav++;
    if (r.tempo > 0 && r.corrida) longe++;
  }
  reg('C7 cavadinha: o 2º toque no CHUTE no meio da corrida (0,5 s depois de soltar o 1º)', `${cav}/${n} cavadinhas (${longe} com corrida)`, 'todas', n >= 3 && cav === n && longe === n);
}

// ---------------------------------------------------------------------------------- C. dois humanos (C8)
{
  let iguais = true, passos = 0, corridas = 0;
  for (let k = 0; k < 2; k++) {
    const q = cena(k ? 'tiroLivreD' : 'escanteio', k);
    if (!q) { iguais = false; continue; }
    const a = q.m;
    a.humanos = [0, 1];
    let b = null;
    const ent = pessoa(k ? BOTAO.CHUTE : BOTAO.LANCAMENTO, 30);
    for (let i = 0; i < 60 * 9; i++) {
      const pr = a.parada;
      const e = ent(a, pr && !pr.rolou ? pr : null);
      const e2 = pr ? { [pr.time]: e, [1 - pr.time]: NADA } : { 0: NADA, 1: NADA };
      // o 2º aparelho: o mundo copiado no meio da corrida (o estado inteiro passa de um para o outro)
      if (!b && pr && pr.corrida && pr.corrida.estado === 'corre') { b = S.copiarMundo(a); corridas++; }
      P.passoPartida(a, e2);
      if (b) { P.passoPartida(b, structuredClone(e2)); passos++; if (S.hashMundo(a) !== S.hashMundo(b)) { iguais = false; break; } }
    }
  }
  reg('C8 dois humanos (online 1×1): o mesmo hash nos dois aparelhos, da corrida ao fim', `${iguais ? 'iguais' : 'DIFERENTES'} em ${passos} passos (${corridas} corridas)`, 'iguais · 2 corridas', iguais && corridas === 2 && passos > 0);
}

// ---------------------------------------------------------------------------------- D. sem mergulho (C11)
{
  // o canhão de cobradores: as cenas da parte A (a IA) com outro jogador de linha do time batendo em cada uma
  const can = vazio();
  for (const T of TIPOS) {
    for (let k = 0; k < NC; k++) {
      const q = cena(T.tipo, k);
      if (!q) continue;
      q.m.humanos = [];
      somar(can, rodar(q.m, () => NADA, k));
    }
  }
  // o canhão de estilos (item 70, P2): as cenas de pênalti com o estilo FORÇADO na IA (forte, colocado, paradinha, pulinho),
  // cada uma com outro jogador de linha batendo, e a pessoa com a PARADINHA e o PULINHO
  const est = vazio();
  const EP = C.ESTILO_PENALTI;
  if (EP) {
    const fiel0 = EP.ia.fiel, pesos0 = EP.ia.pesos;
    for (const e of ['forte', 'colocado', 'paradinha', 'pulinho']) {
      EP.ia.fiel = 1; EP.ia.pesos = [[e, 1]];
      for (let k = 0; k < NC; k++) {
        const q = cena('penalti', k);
        if (!q) continue;
        q.m.humanos = [];
        somar(est, rodar(q.m, () => NADA, k));
      }
    }
    EP.ia.fiel = fiel0; EP.ia.pesos = pesos0;
    for (const b of [BOTAO.PARADINHA, BOTAO.PULINHO]) {
      for (let k = 0; k < 4; k++) {
        const q = cena('penalti', k);
        if (!q) continue;
        q.m.humanos = [q.t]; q.m.timeHumano = q.t;
        somar(est, rodar(q.m, pessoa(BOTAO.CHUTE | b, 28, { x: q.m.ataca[q.t], z: 0.35 })));
      }
    }
  }
  for (const k of ['apoio', 'planta']) can[k].push(...est[k]);
  for (const k of ['plantado', 'razao', 'pouso', 'arrasta']) can[k] = Math.max(can[k], est[k]);
  can.falhou += est.falhou;
  const qs = [...tot.queda, ...pes.queda, ...can.queda, ...est.queda];
  const pior = qs.reduce((a, b) => (b.q > a.q ? b : a), { q: -Infinity });
  const porPerfil = {};
  for (const x of qs) (porPerfil[x.perfil] ??= []).push(x.q);
  const resumo = Object.entries(porPerfil).map(([k, v]) => `${k} ${f2(Math.max(...v))}`).join(', ');
  const fundas = qs.filter(x => x.q >= 0.15).length, cab = Math.max(...qs.map(x => x.c));
  reg('C11 sem mergulho na corrida: a queda do quadril abaixo de 0,92 m (pior; por perfil) · corridas com ≥ 0,15 m · a da cabeça (de pé → mínimo)',
    `${pior.q.toFixed(3).replace('.', ',')} m (${pior.perfil}, id ${pior.id}; ${resumo}) · ${fundas}/${qs.length} (${f2(100 * fundas / Math.max(1, qs.length))}%) · ${f2(cab)} m (${can.queda.length} do canhão de cobradores, ${est.queda.length} do de estilos)`,
    '≤ 0,12 m · 0 · ≤ 0,20 m', qs.length >= 39 && can.queda.length >= 39 && (!EP || est.queda.length >= 4 * NC) && pior.q <= 0.12 && fundas === 0 && cab <= 0.2);
  const plantadosC = can.planta.reduce((x, y) => x + y, 0);
  reg('C11 o canhão de cobradores e o de estilos: o pé de apoio plantado a 0,2–0,45 m (C3) e sem patinar (C4: plantado · salto · pouso · pé plantado andou)',
    `${f2(min(can.apoio))}–${f2(max(can.apoio))} m, plantado ${plantadosC}/${can.planta.length} · ${f2(can.plantado)} m/s · ${f2(can.razao)} · ${f2(can.pouso)} · ${f2(can.arrasta)} m (não rolou ${can.falhou})`,
    '0,2–0,45 m, todos · ≤ 0,05 · ≤ 1 · ≤ 1 · 0', can.apoio.length >= 39 && can.falhou === 0 && min(can.apoio) >= 0.2 && max(can.apoio) <= 0.45 && plantadosC === can.planta.length
      && can.plantado <= 0.05 && can.razao <= 1 && can.pouso <= 1 && can.arrasta === 0);
}

// ---------------------------------------------------------------------------------- saída
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
if (!temCorrida) console.log('\n(lógica sem js/corrida.js: a main antes do item 70)');
console.log(falhas ? `\nteste-corrida-cobranca: REPROVOU (${falhas})` : '\nteste-corrida-cobranca: PASSOU');
process.exit(falhas ? 1 : 0);
