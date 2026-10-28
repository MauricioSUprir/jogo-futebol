// Online 1×1, etapa 1 (contrato "Online 1×1" no CONTRATOS.md): DOIS humanos na lógica da partida — cada pessoa controla
// um time (criarPartida({humanos: [0, 1]}), passoPartida(m, {0: e0, 1: e1})). Com 1 humano nada muda (hash-partida e
// hash-igual IGUAIS); este teste confere o caminho de 2:
//  A) cada cobrança (saída, lateral, escanteio, tiro de meta, tiro livre, pênalti) dos DOIS times sai pela entrada do
//     humano DAQUELE time: (A1) o humano do time que cobra solta o botão e a cobrança começa ali (antes do prazo em que a
//     IA cobraria por ele), com o outro humano apertando botões de ação o tempo todo; (A2) o humano do time que cobra
//     parado e o outro apertando: ninguém cobra antes do prazo (PARTIDA.cobrancaHumanoMax) — só a IA, depois dele.
//     Estados do MEIO de partidas de 2 humanos (4 sementes), 6 tipos × 2 times × 2 variantes;
//  B) a entrada de um time nunca faz um jogador do outro agir: a cada 23 passos de partidas de 2 humanos (2 geradores
//     de entrada), o mesmo passo de novo numa cópia do mundo com a entrada do OUTRO time trocada (analógico, botões e a
//     marca `ia`): a entrada aplicada a cada jogador do time (botões, analógico, rumo pedido), os botões do time, a
//     PRESSÃO pedida e a IA pelo humano não mudam;
//  C) TROCAR, GOLEIRO (saída do goleiro) e PRESSÃO de cada um valem no time dele e só nele (o mesmo estado, o botão em
//     um time e depois no outro);
//  D) o bit IA (entradaDemoPartida(m, time): a IA joga pelo controlado daquele time) — D1 m.iaJoga de cada time segue a
//     entrada DELE a cada passo; D2 IA × humano (um lado só com o bit IA, a partida inteira, e o espelho): acaba, o lado
//     da IA cobra sem esperar o prazo do humano e joga (passes e chutes);
//  E) criarPartida: com humanos [0, 1] os dois controlados são os cobradores da saída, a trava não vale e m.timeHumano é o
//     MEU lado; com humanos [h] (e o padrão) a mesma partida de 1 humano, bit a bit; entradaDemoPartida(m) = a do
//     m.timeHumano.
//   node tools/teste-dois-humanos.mjs [--sementes 4] [--min 1.5]
// Meta: 100% / 0 casos em todos os itens. Sai com código 1 se algum reprovar.
import { tabelaTexto } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const NSEM = +arg('--sementes', 4);
const MIN = +arg('--min', 1.5);
const JS = arg('--js', '../js');
const imp = f => import(new URL(`${JS}/${f}`, import.meta.url).href);
const P = await imp('partida.js');
const S = await imp('sim.js');
const F = await imp('faltas.js');
const { BOTAO, PARTIDA, CAMPO, BOLA, PASSO } = await imp('config.js');
const seg = s => Math.round(s / PASSO);
const t0 = Date.now();

// ------------------------------------------------------------------ geradores de entrada
function gerador(sem) {
  let s = (sem * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const q = v => Math.round(v * 1024) / 1024 + 0; // como a rede (1/1024)
const NEUTRA = Object.freeze({ x: 0, z: 0, botoes: 0 });
const LISTA = [0, 0, 0, BOTAO.CORRER, BOTAO.PASSE, BOTAO.CHUTE, BOTAO.LANCAMENTO, BOTAO.ENFIADA, BOTAO.TROCAR, BOTAO.CONTER,
  BOTAO.DIVIDIDA, BOTAO.PRESSAO, BOTAO.MOD, BOTAO.GOLEIRO, BOTAO.CORRER | BOTAO.PASSE];

/** Gerador "pessoa" do time t: analógico e botões sorteados, a IA dele sem a marca `ia` ou a IA pelo humano (bit IA). */
function criarPessoa(sem, t, comBitIA = true) {
  const r = gerador(sem * 7 + t + 1);
  let e = NEUTRA, dura = 0, modo = 0, durModo = 0;
  return function entrada(m) {
    if (durModo-- <= 0) { const u = r(); modo = comBitIA && u < 0.25 ? 2 : u < 0.6 ? 1 : 0; durModo = 120 + Math.floor(r() * 600); }
    if (dura-- <= 0) {
      const ang = r() * 2 * Math.PI, mag = r() < 0.2 ? 0 : 0.3 + 0.7 * r();
      e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes: LISTA[Math.floor(r() * LISTA.length)] };
      dura = 10 + Math.floor(r() * 50);
    }
    if (modo === 2) return P.entradaDemoPartida(m, t);
    let ent = e;
    if (modo === 1) { const d = P.entradaDemoPartida(structuredClone(m), t); ent = { x: d.x, z: d.z, botoes: d.botoes | (r() < 0.3 ? e.botoes : 0) }; }
    return { x: q(ent.x), z: q(ent.z), botoes: ent.botoes | 0 };
  };
}

/** O outro humano "barulhento": analógico sorteado e PASSE / LANÇAMENTO / CHUTE apertados e soltos sem parar. */
function criarBarulho(sem) {
  const r = gerador(sem * 13 + 5);
  const B = [BOTAO.PASSE, BOTAO.LANCAMENTO, BOTAO.CHUTE, BOTAO.ENFIADA, BOTAO.PASSE | BOTAO.CORRER];
  let k = 0, b = 0, ang = 0;
  return () => {
    if (k % 9 === 0) { b = B[Math.floor(r() * B.length)]; ang = r() * 2 * Math.PI; }
    const e = { x: q(Math.cos(ang)), z: q(Math.sin(ang)), botoes: k % 9 < 6 ? b : 0 };
    k++;
    return e;
  };
}

const ents2 = (T, eT, eO) => (T === 0 ? { 0: eT, 1: eO } : { 0: eO, 1: eT });

/** Estado do meio de uma partida de 2 humanos (bola rolando, ninguém com a bola nas mãos). */
function estadoDoMeio(sem, passos) {
  const m = P.criarPartida({ semente: 300 + sem, humanos: [0, 1], minutosPorTempo: 4 });
  const pe = [criarPessoa(sem, 0), criarPessoa(sem, 1)];
  for (let i = 0; i < passos || m.partida.estado !== 'jogo' || m.parada || m.naMao != null; i++) P.passoPartida(m, { 0: pe[0](m), 1: pe[1](m) }, null);
  return m;
}

// ------------------------------------------------------------------ A) cobranças pelo humano do time que cobra
const TIPOS = ['saida', 'lateral', 'escanteio', 'tiroDeMeta', 'tiroLivre', 'penalti'];

/** Monta a bola parada `tipo` para o time T cobrar (fora do passo, como a página: main.js bolaParadaDeTeste/faltaDeTeste). */
function forcar(m, tipo, T, sem) {
  const lado = m.ataca[T];
  m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
  m.faltaPendente = null; m.partida.vantagem = null;
  for (const j of m.jogadores) { j.pedido = null; j.carga = null; }
  if (tipo === 'saida') { m.eventos = []; P.montarSaida(m, T); return; }
  if (tipo === 'lateral' || tipo === 'escanteio' || tipo === 'tiroDeMeta') {
    const s = sem % 2 ? 1 : -1;
    const x = tipo === 'lateral' ? lado * (8 + 3 * sem) : tipo === 'escanteio' ? lado * (CAMPO.meioX + 0.6) : -lado * (CAMPO.meioX + 0.6);
    const z = tipo === 'lateral' ? s * (CAMPO.meioZ + 0.5) : s * (tipo === 'escanteio' ? 10 : 9);
    const ult = 1 - T, j = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
    Object.assign(m.bola.p, { x, y: BOLA.raio, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
    return; // o próximo passo vê a bola fora e monta o recomeço (Regras 15, 16, 17)
  }
  // tiro livre (falta no próprio campo, parado: sem vantagem) e pênalti (falta dentro da área adversária)
  const c = m.jogadores.find(o => o.time === T && o.posicao !== 'GOL' && o.id === m.controlado[T]) ?? m.jogadores.find(o => o.time === T && o.posicao !== 'GOL');
  let d = null, dm = Infinity;
  for (const o of m.jogadores) { if (o.time === T || o.posicao === 'GOL') continue; const q2 = Math.hypot(o.x - c.x, o.z - c.z); if (q2 < dm) { dm = q2; d = o; } }
  const rumo = lado > 0 ? 0 : Math.PI;
  if (tipo === 'penalti') P.teleportar(c, lado * (CAMPO.meioX - 9), 3, rumo);
  else P.teleportar(c, -lado * 15, 6, rumo);
  P.teleportar(d, c.x - lado * 1.1, c.z + 0.3, rumo);
  Object.assign(m.bola.p, { x: c.x + lado * 0.4, y: BOLA.raio, z: c.z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
  m.posse = c.id;
  const f = F.montarFalta(m, d, c, 'bote', true);
  f.cartao = null;
  m.eventos = []; m.faltaPendente = f;
  P.regrasPartida(m);
}

/**
 * Uma cena da parte A. variante 'A1': o humano do time T aperta o botão da cobrança e solta 20 ticks depois de a bola ficar
 * pronta; 'A2': o humano de T parado. O outro humano, barulhento o tempo todo. Devolve {ok, motivo, ...}.
 */
function cenaCobranca(m0, tipo, T, variante, sem) {
  const m = structuredClone(m0);
  forcar(m, tipo, T, sem);
  const outro = criarBarulho(sem * 31 + T * 7 + TIPOS.indexOf(tipo));
  const botao = tipo === 'penalti' ? BOTAO.CHUTE : BOTAO.PASSE;
  const APERTO = 15; // ticks (0,25 s: chute de um toque, sem a janela da cavadinha)
  let pr = null, solta = null, inicio = null;
  for (let i = 0; i < 900 && inicio == null; i++) {
    const p = m.parada;
    if (!pr && p && !p.rolou && p.cobrador != null) { pr = p; solta = Math.max(p.pronta, m.tick) + 20; }
    let eT = NEUTRA;
    if (variante === 'A1' && pr && m.tick >= solta - APERTO && m.tick < solta) eT = { x: q(m.ataca[T] * 0.8), z: q(0.3), botoes: botao };
    const tick = m.tick;
    P.passoPartida(m, ents2(T, eT, outro()), null);
    if (pr && (pr.rolou || pr.arremesso || m.parada !== pr)) inicio = tick;
  }
  if (!pr) return { ok: false, motivo: 'a bola parada não foi montada' };
  const c = S.jogadorPorId(m, pr.cobrador);
  const prazo = pr.inicio + seg(PARTIDA.cobrancaHumanoMax);
  const base = { tipo, T, variante, cobrador: pr.cobrador, timeCobrador: c?.time, inicio, solta, prazo, tipoParada: pr.tipo };
  if (pr.tipo !== tipo) return { ...base, ok: false, motivo: `montou ${pr.tipo}` };
  if (!c || c.time !== T) return { ...base, ok: false, motivo: 'cobrador de outro time' };
  if (inicio == null) return { ...base, ok: false, motivo: 'não cobrou' };
  if (variante === 'A1') {
    if (solta + 30 >= prazo) return { ...base, ok: false, motivo: 'cena sem folga antes do prazo' };
    if (inicio < solta) return { ...base, ok: false, motivo: `cobrou antes de o humano soltar (${solta - inicio} ticks)` };
    if (inicio > solta + 30) return { ...base, ok: false, motivo: `cobrou ${inicio - solta} ticks depois de soltar` };
    return { ...base, ok: true };
  }
  if (inicio < prazo) return { ...base, ok: false, motivo: `cobrou ${prazo - inicio} ticks antes do prazo (sem o humano do time)` };
  return { ...base, ok: true };
}

const meios = [];
for (let sem = 1; sem <= NSEM; sem++) meios.push(estadoDoMeio(sem, 1500 + 450 * sem));
const resA = { A1: [], A2: [] };
for (let k = 0; k < meios.length; k++) {
  for (const tipo of TIPOS) for (const T of [0, 1]) for (const v of ['A1', 'A2']) resA[v].push(cenaCobranca(meios[k], tipo, T, v, k + 1));
}

// ------------------------------------------------------------------ B, C, D1) partidas de 2 humanos
const LIMIAR = 1e-12;
// O que vem da ENTRADA do time T: os campos do controlado dele (sem o bit IA) e os do time. Os outros jogadores de T são
// IA e reagem ao mundo — e o mundo muda de verdade com a jogada do outro no mesmo passo (a cobrança dele sai antes do
// passo, o passe dele muda a bola): isso é jogo, não entrada vazando de um time para o outro.
// (o controlado apertando sozinho pelo PRESSÃO com o analógico solto — a C1, defesa.js entradaPressaoPropria — reage ao
// mundo como a IA: o analógico dele no passo é do jogo, não da entrada — e se ela vale ou não depende de o time dele estar
// defendendo, que a jogada do outro no mesmo passo muda — e a disparada dela soma o CORRER aos botões aplicados; os botões
// da ENTRADA do time continuam comparados)
const c1Ativa = (m, T) => { const c = m.iaJoga?.[T] ? null : S.jogadorPorId(m, m.controlado[T]); return !!c && c.pressaoP?.tick === m.tick - 1; }; // (o passo já avançou o m.tick)
function camposTime(m, T, soBotoes = false) {
  const o = [];
  const c = m.iaJoga?.[T] ? null : S.jogadorPorId(m, m.controlado[T]);
  if (c) o.push(soBotoes ? [c.id, c.botoesTime ?? 0] : [c.id, c.botoesTime ?? 0, c.botoes ?? 0, c.ix ?? 0, c.iz ?? 0, c.imag ?? 0, c.intRumo ?? 0]);
  o.push(['time', m.botoesTimeAgora?.[T] ?? 0, m.pedidoPressao?.[T] ?? -1, m.iaJoga?.[T] ? 1 : 0]);
  return o;
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) for (let k = 0; k < a[i].length; k++) {
    const x = a[i][k], y = b[i][k];
    if (typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) > LIMIAR : x !== y) return false;
  }
  return true;
}
const trocada = (e, r) => ({ x: q(-(e.z ?? 0) || 0.7 * (r() - 0.5)), z: q((e.x ?? 0) || 0.7 * (r() - 0.5)), botoes: (~(e.botoes | 0)) & 0x7fff & ~BOTAO.MOD, ia: !e.ia && r() < 0.5 });

const resB = { casos: 0, falhas: [] };
const resD1 = { casos: 0, falhas: 0 };
const sondas = { TROCAR: [[], []], GOLEIRO: [[], []], PRESSAO: [[], []] }; // [time] → {ok, motivo}
function passoN(m, ents, n = 1) { const ev = []; for (let i = 0; i < n; i++) ev.push(...P.passoPartida(m, ents, null)); return ev; }

/** Sondas da parte C no estado m (cópias): o botão no time T; e o mesmo botão no outro time não mexe no T. */
function sondar(m, T) {
  const O = 1 - T;
  const livre = m.partida.estado === 'jogo' && !m.parada && m.naMao == null;
  if (!livre) return;
  // TROCAR: o controlado de T sem a bola e um candidato à troca
  {
    const ctrl = S.jogadorPorId(m, m.controlado[T]), cand = S.candidatoTroca(m, T);
    if (ctrl && ctrl.posicao !== 'GOL' && m.posse !== ctrl.id && cand && cand.id !== ctrl.id) {
      const a = structuredClone(m);
      passoN(a, { 0: NEUTRA, 1: NEUTRA });
      const antesO = a.controlado[O];
      // no passo neutro o controlado pode ter dominado a bola (TROCAR nunca troca com a bola no pé) ou trocado sozinho
      if (a.posse === a.controlado[T] || a.controlado[T] !== ctrl.id || a.parada || a.naMao != null) return sondarResto(m, T, O);
      const ev = passoN(a, ents2(T, { x: 0, z: 0, botoes: BOTAO.TROCAR }, NEUTRA));
      const mi = ev.find(e => e.tipo === 'troca' && !e.auto && !e.goleiro);
      const jt = mi ? S.jogadorPorId(a, mi.id) : null;
      // o outro time pode trocar sozinho no mesmo passo (bola alta: trocaAerea; passe: troca automática) — isso é dele
      const oTrocouSo = ev.some(e => (e.tipo === 'trocaAerea' || (e.tipo === 'troca' && e.auto)) && S.jogadorPorId(a, e.id)?.time === O);
      // no mesmo passo o time T pode ter dominado a bola com outro jogador: a troca automática dá o controle a quem domina
      // (sim.js ganhouPosse) depois do TROCAR — vale o TROCAR (o evento manual dele) e a regra da posse
      const retomou = ev.some(e => e.tipo === 'troca' && e.auto && e.id === a.posse && S.jogadorPorId(a, e.id)?.time === T);
      // o novo controlado pode jogar a bola no mesmo passo (o cabeceio de passe sem botão, cabeceio.js) e a troca
      // automática no passe leva o controle ao recebedor: a ordem troca → passe DELE → troca automática no time T
      const iM = ev.indexOf(mi), iP = jt ? ev.findIndex((e, k) => k > iM && e.tipo === 'passe' && e.id === jt.id) : -1;
      const tAuto = iP < 0 ? null : ev.find((e, k) => k > iP && e.tipo === 'troca' && e.auto && S.jogadorPorId(a, e.id)?.time === T);
      const okA = !!jt && jt.time === T && (a.controlado[T] === jt.id || retomou || (tAuto && a.controlado[T] === tAuto.id)) && (a.controlado[O] === antesO || oTrocouSo);
      const b = structuredClone(m);
      passoN(b, { 0: NEUTRA, 1: NEUTRA });
      const evB = passoN(b, ents2(T, NEUTRA, { x: 0, z: 0, botoes: BOTAO.TROCAR }));
      const okB = !evB.some(e => e.tipo === 'troca' && !e.auto && S.jogadorPorId(b, e.id)?.time === T);
      sondas.TROCAR[T].push({ ok: okA && okB, motivo: !okA ? 'o TROCAR do time não trocou o controlado dele' : !okB ? 'o TROCAR do outro time trocou o controlado deste' : '' });
    }
  }
  sondarResto(m, T, O);
}
function sondarResto(m, T, O) {
  // GOLEIRO: o goleiro de T (não controlado, sem defesa nem mergulho, ainda não saindo) e o adversário com a bola
  {
    const g = m.jogadores.find(o => o.time === T && o.posicao === 'GOL');
    const dono = m.posse != null ? S.jogadorPorId(m, m.posse) : null;
    if (g && m.controlado[T] !== g.id && !g.defesa && !g.mergulho && !g.saindo && dono && dono.time === O) {
      const botao = (a, quem) => { passoN(a, { 0: NEUTRA, 1: NEUTRA }); return passoN(a, ents2(T, quem === T ? { x: 0, z: 0, botoes: BOTAO.GOLEIRO } : NEUTRA, quem === O ? { x: 0, z: 0, botoes: BOTAO.GOLEIRO } : NEUTRA), 3); };
      const evA = botao(structuredClone(m), T), evB = botao(structuredClone(m), O);
      const pelo = ev => ev.some(e => e.tipo === 'saidaGoleiro' && e.id === g.id && !e.modo);
      const okA = pelo(evA), okB = !pelo(evB);
      sondas.GOLEIRO[T].push({ ok: okA && okB, motivo: !okA ? 'o GOLEIRO do time não tirou o goleiro dele' : !okB ? 'o GOLEIRO do outro time tirou o goleiro deste' : '' });
    }
  }
  // PRESSÃO: o pedido do time T (m.pedidoPressao[T]) só com o botão de T. A retomada encerra o pedido do time que ganhou a
  // bola (D1, 23/10: defesa.js encerrarPressao) — com a bola dele depois do passo, o pedido dele null também vale
  {
    const a = structuredClone(m), b = structuredClone(m);
    const pa = a.pedidoPressao?.[O] ?? null;
    passoN(a, ents2(T, { x: 0, z: 0, botoes: BOTAO.PRESSAO }, NEUTRA));
    const pb = b.pedidoPressao?.[T] ?? null;
    passoN(b, ents2(T, NEUTRA, { x: 0, z: 0, botoes: BOTAO.PRESSAO }));
    const timeBola = w => { const d = w.naMao ?? w.posse; return d != null ? S.jogadorPorId(w, d)?.time : null; };
    const encerrado = (w, X) => (w.pedidoPressao?.[X] ?? null) === null && timeBola(w) === X;
    const okA = (a.pedidoPressao?.[T] === m.tick || encerrado(a, T)) && ((a.pedidoPressao?.[O] ?? null) === pa || encerrado(a, O));
    const okB = (b.pedidoPressao?.[T] ?? null) === pb || encerrado(b, T);
    sondas.PRESSAO[T].push({ ok: okA && okB, motivo: !okA ? 'a PRESSÃO do time não marcou o pedido dele (ou marcou o do outro)' : !okB ? 'a PRESSÃO do outro time marcou o pedido deste' : '' });
  }
}

for (let sem = 1; sem <= NSEM; sem++) {
  const m = P.criarPartida({ semente: 500 + sem, humanos: [0, 1], minutosPorTempo: MIN });
  const pe = [criarPessoa(sem + 40, 0), criarPessoa(sem + 40, 1)];
  const rb = gerador(sem * 101);
  for (let i = 0; m.partida.estado !== 'fim' && i < 2 * MIN * 3600 + 3000; i++) {
    const e = { 0: pe[0](m), 1: pe[1](m) };
    const est = m.partida.estado;
    if (i % 23 === 11 && est !== 'intervalo' && est !== 'fim') {
      for (const T of [0, 1]) {
        const a = structuredClone(m), b = structuredClone(m);
        P.passoPartida(a, e, null);
        P.passoPartida(b, ents2(T, e[T], trocada(e[1 - T], rb)), null);
        // a troca AUTOMÁTICA de T (passe do outro, bola alta: troca.js) depende do mundo — com ela o controlado muda de
        // verdade e não há o que comparar
        const auto = x => x.eventos.some(ev => ev.tipo === 'troca' && ev.auto && S.jogadorPorId(x, ev.id)?.time === T);
        if (a.controlado[T] !== b.controlado[T] && (auto(a) || auto(b))) continue;
        resB.casos++;
        // o controlado que T assumiu NESTE passo (o TROCAR sai depois da entrada aplicada: sim.js) tem o analógico do passo
        // escrito pela IA, que lê o mundo (a cobrança do outro: a bola vindo, a recepção) — dele valem o id e os botões
        const trocou = a.controlado[T] !== m.controlado[T] || b.controlado[T] !== m.controlado[T];
        const sb = c1Ativa(a, T) || c1Ativa(b, T) || trocou;
        if (!iguais(camposTime(a, T, sb), camposTime(b, T, sb)) && resB.falhas.length < 1e6) resB.falhas.push({ sem, tick: m.tick, T });
      }
    }
    if (i % 97 === 40) for (const T of [0, 1]) sondar(m, T);
    P.passoPartida(m, e, null);
    if (est !== 'intervalo' && est !== 'fim') {
      resD1.casos++;
      if (!!m.iaJoga?.[0] !== !!e[0].ia || !!m.iaJoga?.[1] !== !!e[1].ia) resD1.falhas++;
    }
  }
}

// ------------------------------------------------------------------ D2) IA × humano (um lado só com o bit IA)
const resD2 = [];
for (let sem = 1; sem <= 2; sem++) for (const LIA of [0, 1]) {
  const m = P.criarPartida({ semente: 700 + sem * 2 + LIA, humanos: [0, 1], minutosPorTempo: MIN });
  const pessoa = criarPessoa(sem + 80, 1 - LIA, false);
  let pr = null, atraso = 0, cobIA = 0, acoesIA = 0, andou = 0, ultimo = null;
  for (let i = 0; m.partida.estado !== 'fim' && i < 2 * MIN * 3600 + 3000; i++) {
    const eIA = P.entradaDemoPartida(m, LIA);
    const eH = pessoa(m);
    const p = m.parada;
    if (p && !p.rolou && p.cobrador != null && p !== pr) pr = p;
    const ctrl = S.jogadorPorId(m, m.controlado[LIA]);
    if (ctrl && ultimo && ultimo.id === ctrl.id) andou += Math.hypot(ctrl.x - ultimo.x, ctrl.z - ultimo.z);
    ultimo = ctrl ? { id: ctrl.id, x: ctrl.x, z: ctrl.z } : null;
    const tick = m.tick;
    const ev = P.passoPartida(m, ents2(LIA, eIA, eH), null);
    for (const e of ev) if ((e.tipo === 'passe' || e.tipo === 'chute') && S.jogadorPorId(m, e.id)?.time === LIA) acoesIA++;
    if (pr && (pr.rolou || pr.arremesso || m.parada !== pr)) {
      const c = S.jogadorPorId(m, pr.cobrador);
      if (c && c.time === LIA) { cobIA++; if (tick >= pr.inicio + seg(PARTIDA.cobrancaHumanoMax)) atraso++; }
      pr = null;
    }
  }
  resD2.push({ sem, LIA, fim: m.partida.estado === 'fim', cobIA, atraso, acoesIA, andou, placar: `${m.placar[0]}×${m.placar[1]}` });
}

// ------------------------------------------------------------------ E) criarPartida e entradaDemoPartida
const resE = [];
{
  const m = P.criarPartida({ semente: 9, humanos: [0, 1], humano: 1, trava: 5 });
  // cada time humano fica com o MESMO controlado que teria sozinho (o da saída é o cobrador; o outro, quem a montagem
  // da saída escolhe — fecharMontagem —, como na partida de 1 humano)
  // (o papel 'humano' é só a marca inicial do cobrador — o controle segue m.controlado —, então compara-se o time inteiro)
  const um = [P.criarPartida({ semente: 9, humano: 0 }), P.criarPartida({ semente: 9, humano: 1 })];
  const papeis = (x, t) => x.jogadores.filter(j => j.time === t).map(j => `${j.id}:${j.papel}`).join();
  const ok = m.humanos.join() === '0,1' && [0, 1].every(t => m.controlado[t] === um[t].controlado[t] && papeis(m, t) === papeis(um[t], t))
    && m.trava == null && m.timeHumano === 1;
  resE.push(['E1 humanos [0, 1]: controlados = os de cada um sozinho (o cobrador da saída), papel humano, sem trava, timeHumano = o meu lado', ok]);
}
for (const h of [0, 1]) {
  const a = P.criarPartida({ semente: 11 + h, humano: h }), b = P.criarPartida({ semente: 11 + h, humano: h, humanos: [h] });
  const pe = criarPessoa(60 + h, h), pb = criarPessoa(60 + h, h);
  let ok = S.hashMundo(a) === S.hashMundo(b);
  for (let i = 0; i < 1500 && ok; i++) { P.passoPartida(a, pe(a), null); P.passoPartida(b, pb(b), null); ok = S.hashMundo(a) === S.hashMundo(b); }
  resE.push([`E2 humano ${h}: humanos [${h}] = o padrão de 1 humano, bit a bit (1500 passos)`, ok]);
}
{
  const m = estadoDoMeio(2, 900);
  const m1 = P.criarPartida({ semente: 13, humano: 1 });
  for (let i = 0; i < 600; i++) P.passoPartida(m1, P.entradaDemoPartida(m1), null);
  const a = structuredClone(m1), b = structuredClone(m1);
  const ok1 = JSON.stringify(P.entradaDemoPartida(a)) === JSON.stringify(P.entradaDemoPartida(b, 1)) && S.hashMundo(a) === S.hashMundo(b);
  // com 2 humanos, a do time t é a do controlado DELE: o mesmo que a do mundo de 1 humano daquele time
  const x0 = structuredClone(m), x1 = structuredClone(m);
  x1.timeHumano = 1;
  const ok2 = JSON.stringify(P.entradaDemoPartida(x0, 1)) === JSON.stringify(P.entradaDemoPartida(x1));
  resE.push(['E3 entradaDemoPartida(m) = entradaDemoPartida(m, m.timeHumano); a do time 1 = a do controlado do time 1', ok1 && ok2]);
}

// ------------------------------------------------------------------ resultado
const linhas = [['item', 'medido', 'meta', 'resultado']];
let falhas = 0;
const linha = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const pct = (a, b) => (b ? `${a} de ${b} (${(100 * a / b).toFixed(1).replace('.', ',')}%)` : '0 de 0');
for (const v of ['A1', 'A2']) {
  const r = resA[v], ok = r.filter(x => x.ok).length;
  const porTipo = TIPOS.map(t => `${t} ${r.filter(x => x.tipo === t && x.ok).length}/${r.filter(x => x.tipo === t).length}`).join(' · ');
  linha(v === 'A1' ? 'A1 cobrança pelo humano DAQUELE time (o outro apertando sem parar)' : 'A2 o humano do time parado: ninguém cobra antes do prazo, nem pelo outro',
    `${pct(ok, r.length)}: ${porTipo}`, '100%', ok === r.length && r.length === 6 * 2 * NSEM);
  for (const x of r.filter(y => !y.ok).slice(0, 6)) console.log(`  ${v} falhou: ${x.tipo} do time ${x.T}: ${x.motivo}`);
}
linha('B a entrada de um time não muda a do controlado do outro nem a do time dele (passo repetido com a do outro trocada)', `${resB.falhas.length} de ${resB.casos} casos`, '0 casos', resB.falhas.length === 0 && resB.casos > 0);
for (const x of resB.falhas.slice(0, 5)) console.log(`  B falhou: semente ${x.sem}, tick ${x.tick}, time ${x.T}`);
for (const [nome, chave] of [['C1 TROCAR', 'TROCAR'], ['C2 GOLEIRO (saída do goleiro)', 'GOLEIRO'], ['C3 PRESSÃO', 'PRESSAO']]) {
  const r = sondas[chave], n0 = r[0].length, n1 = r[1].length, ok0 = r[0].filter(x => x.ok).length, ok1 = r[1].filter(x => x.ok).length;
  linha(`${nome} de cada um vale só no time dele`, `time 0: ${ok0}/${n0} · time 1: ${ok1}/${n1}`, '100%, ≥ 5 por time', ok0 === n0 && ok1 === n1 && n0 >= 5 && n1 >= 5);
  for (const x of [...r[0], ...r[1]].filter(y => !y.ok).slice(0, 3)) console.log(`  ${chave} falhou: ${x.motivo}`);
}
linha('D1 m.iaJoga de cada time = a marca `ia` da entrada DELE', `${resD1.falhas} de ${resD1.casos} passos`, '0', resD1.falhas === 0 && resD1.casos > 0);
for (const r of resD2) {
  linha(`D2 IA × humano (semente ${r.sem}, IA no time ${r.LIA}): acaba, cobra sem esperar o prazo, joga`,
    `${r.fim ? 'acabou' : 'NÃO acabou'} ${r.placar}; ${r.cobIA} cobranças (${r.atraso} no prazo do humano); ${r.acoesIA} passes/chutes; controlado andou ${r.andou.toFixed(0)} m`,
    'fim · 0 no prazo · ≥ 20 ações · ≥ 200 m', r.fim && r.atraso === 0 && r.cobIA > 0 && r.acoesIA >= 20 && r.andou >= 200);
}
for (const [nome, ok] of resE) linha(nome, ok ? 'sim' : 'não', 'sim', ok);
console.log(tabelaTexto(linhas));
console.log(`\nteste-dois-humanos: ${falhas ? `REPROVOU (${falhas} itens)` : 'PASSOU'} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
