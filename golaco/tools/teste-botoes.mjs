// Botões que não funcionavam (dono, 12/10: "ainda tem botões que não funcionam"; auditoria dos botões com o caçador
// de falhas). Cada item monta o lance na partida 11×11 (lógica pura, Node) com a entrada do humano roteirizada e mede o
// EFEITO no mundo (pedido criado, cobrança saiu, controle trocou ou ficou, o goleiro andou, o companheiro foi apertar).
// A parte da tela (toque de verdade, fase dos botões, PEGAR/TROCAR visíveis) está no tools/teste-controles.mjs.
//  B1 toque aéreo vencido não prende o jogador (sim.js movimentoAereo/bolaLivre): o analógico anda ≥ 80% do que anda sem
//     o toque e o toque é limpo;
//  B2 troca automática só na PERDA da bola (sim.js ganhouPosse): o passe entre adversários não desfaz o TROCAR nem o
//     goleiro do TROCAR segurado; perdendo a bola, o controle ainda vai para o mais perto dela;
//  B3 PRESSÃO no passe do adversário (defesa.js/ia-tatica.js): o chamado segue chamado durante o passe (correndo para
//     onde a bola vai) e continua chamado com o recebedor;
//  B4 bola parada: o aperto antes da hora (montagem) cobra na hora (partida.js cobrar);
//  B5 CHUTE na bola parada (saída, escanteio, lateral) vira a cobrança padrão (passe / lançamento);
//  B6 pênalti contra: o goleiro do humano fica na linha com o analógico segurado e o mergulho vai para o lado escolhido;
//     no lado certo a defesa vale (goleiro.js lerChute/iniciarMergulho, sim.js goleiroComoLinha);
//  B7 LANÇAMENTO dois toques na ponta = cruzamento rasteiro (acoes.js processarPedido);
//  B8 CHUTE de primeira no passe longo (24–30 m): bate de primeira (acoes.js atualizarBotoesAcao);
//  B9 TROCAR na barreira: nunca um jogador parado (sim.js candidatoTroca);
//  B10 tiro livre contra: o chute alto da IA não tira o controle do goleiro (troca.js);
//  B11 pênalti a favor: com qualquer mira, 4–12% para fora (meta do dono ~6%; acoes.js chute);
//  B12 quem cobrou a bola parada não toca de novo antes de outro (Regra 15; partida.js rolou, sim.js bolaLivre).
//   node tools/teste-botoes.mjs                 (lógica do repositório)
//   node tools/teste-botoes.mjs --js <pasta>    (outra cópia da lógica, ex.: a base → REPROVA)
//   node tools/teste-botoes.mjs --so B3         (um item só)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const SO = arg('--so', null);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const S = await imp('sim.js');
const F = await imp('faltas.js');
const { BOTAO, PASSO, CAMPO, PARTIDA, ACOES } = await imp('config.js');
// calibração (B11): outro canto da mira do pênalti do humano, sem mexer no config.js
if (arg('--canto', null) != null && ACOES.chute) ACOES.chute.penaltiCanto = +arg('--canto');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const faz = id => !SO || SO.split(',').includes(id);
const f1 = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const NADA = Object.freeze({ x: 0, z: 0, botoes: 0 });
const porId = (m, id) => m.jogadores.find(o => o.id === id) ?? null;
const ctrl = m => porId(m, m.controlado[0]);
const clone = m => structuredClone(m);

/** Partida já com a bola rolando (a IA jogando pelo humano `passos` ticks). */
function novaPartida(sem, passos = 240) {
  const m = P.criarPartida({ semente: sem });
  for (let i = 0; i < passos; i++) P.passoPartida(m, P.entradaDemoPartida(m));
  return m;
}
/** Tira o lance em andamento (como a cenaDeTeste da página): bola sem dono, sem parada, sem ações. */
function limpar(m) {
  const pr = m.parada;
  if (pr && pr.cobrador != null && pr.papel != null) { const c0 = porId(m, pr.cobrador); if (c0 && c0.papel === 'parado') c0.papel = pr.papel; }
  m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null; m.posse = null;
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
  for (const j of m.jogadores) { j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; j.defesa = null; j.mergulho = null; if (j.cond) j.cond.toque = null; }
}
/** Bola no pé de j (parada, 0,4 m à frente). */
function bolaNoPe(m, j) {
  const b = m.bola;
  b.p.x = j.x + Math.cos(j.rumo) * 0.4; b.p.y = 0.11; b.p.z = j.z + Math.sin(j.rumo) * 0.4;
  b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
  m.posse = j.id;
}
/** Roda n passos com a entrada do humano (objeto ou função (i, m)); devolve os eventos com o tick. */
function rodar(m, n, ent = NADA, ate = null) {
  const evs = [];
  for (let i = 0; i < n; i++) {
    const e = typeof ent === 'function' ? ent(i, m) : ent;
    for (const ev of P.passoPartida(m, e)) evs.push({ ...ev, tick: m.tick });
    if (ate && ate(m, evs)) break;
  }
  return evs;
}
/** Apita a falta f (como o teste-faltas): monta a parada pela regra da partida. */
function apitar(m, f) { m.eventos = []; m.faltaPendente = f; P.regrasPartida(m); return m.eventos; }

// ------------------------------------------------------------------ B1. toque aéreo vencido
if (faz('B1')) {
  let ok = 0, n = 0;
  const det = [];
  for (const sem of [1, 2, 3, 4, 5, 6]) {
    const m = novaPartida(sem);
    limpar(m);
    const c = ctrl(m);
    // a bola com um adversário longe (> 25 m), parado
    const o = m.jogadores.filter(x => x.time === 1 && x.posicao !== 'GOL').sort((a, b) => Math.hypot(b.x - c.x, b.z - c.z) - Math.hypot(a.x - c.x, a.z - c.z))[0];
    bolaNoPe(m, o);
    const A = clone(m), B = clone(m);
    const cB = ctrl(B);
    cB.cond.toque = { tick: B.tick - 5, pe: 1, bx: cB.x - 4, bz: cB.z - 4, tipo: 'aereo', y: 1.6 };
    const ent = { x: 0, z: 1, botoes: BOTAO.CORRER };
    // o mesmo jogador nos dois ramos (a troca automática do passe do adversário trocava o controlado no meio: B2)
    const id = cB.id, zA0 = porId(A, id).z, zB0 = cB.z;
    rodar(A, 90, ent); rodar(B, 90, ent);
    const dA = porId(A, id).z - zA0, dB = porId(B, id).z - zB0;
    const limpo = !(porId(B, id).cond.toque && porId(B, id).cond.toque.tipo === 'aereo');
    n++;
    if (dB >= 0.8 * dA && limpo) ok++;
    det.push(`${f1(dB)}/${f1(dA)}${limpo ? '' : '*'}`);
  }
  reg('B1 toque aéreo vencido: o analógico anda (com/sem o toque, m em z; * = toque ainda marcado)', `${det.join(' ')} · ${ok}/${n}`, '≥ 80% do que anda sem o toque, toque limpo, 6/6', ok === n);
}

// ------------------------------------------------------------------ B2. troca automática só na perda
if (faz('B2')) {
  /**
   * Do estado m (o time 1 com a bola), o humano escolhe (TROCAR tocado, ou segurado 0,5 s = goleiro) e fica parado;
   * até o time 0 tocar na bola (ou 6 s): a escolha foi desfeita sem perda? Conta os passes completos do time 1.
   */
  function caso(m, segurar) {
    const T = segurar ? Math.round(0.5 / PASSO) + 2 : 1;
    rodar(m, T, i => ({ x: 0, z: 0, botoes: BOTAO.TROCAR }));
    const escolhido = m.controlado[0];
    const goleiro = porId(m, escolhido)?.posicao === 'GOL';
    let desfeita = false, passes = 0, emPasse = false;
    for (let i = 0; i < 360; i++) {
      const evs = P.passoPartida(m, NADA);
      const dono = m.posse != null ? porId(m, m.posse) : null;
      if (evs.some(e => e.tipo === 'passe' && porId(m, e.id)?.time === 1)) emPasse = true;
      if (emPasse && dono && dono.time === 1) { passes++; emPasse = false; }
      // o time 0 tocou: acabou o lance
      if ((dono && dono.time === 0) || (m.ultimoToque && m.ultimoToque.time === 0 && m.ultimoToque.tick > m.tick - 2) || m.parada || m.naMao != null) break;
      if (m.controlado[0] !== escolhido) { desfeita = true; break; }
    }
    return { escolhido, goleiro, desfeita, passes };
  }
  let nT = 0, dT = 0, nG = 0, dG = 0, gOk = 0;
  const det = [];
  for (const sem of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const m = novaPartida(sem, 200);
    // espera o time 1 com a bola no pé, sem parada
    let achou = false;
    for (let i = 0; i < 3000 && !achou; i++) {
      P.passoPartida(m, P.entradaDemoPartida(m));
      const d = m.posse != null ? porId(m, m.posse) : null;
      achou = !!d && d.time === 1 && d.posicao !== 'GOL' && !m.parada && m.naMao == null;
    }
    if (!achou) continue;
    const a = caso(clone(m), false), b = caso(clone(m), true);
    if (a.passes > 0) { nT++; if (a.desfeita) dT++; }
    if (b.goleiro) gOk++;
    if (b.passes > 0 && b.goleiro) { nG++; if (b.desfeita) dG++; }
    det.push(`${sem}:${a.passes}p${a.desfeita ? 'X' : ''}/${b.goleiro ? 'G' : '-'}${b.passes}p${b.desfeita ? 'X' : ''}`);
  }
  reg('B2a TROCAR tocado e o adversário trocando passes: escolha desfeita sem perda', `${dT}/${nT} lances com passe do adversário`, `0 (com ≥ 4 lances)`, nT >= 4 && dT === 0);
  reg('B2b TROCAR segurado 0,5 s = goleiro; o adversário trocando passes: goleiro tirado sem perda', `${dG}/${nG} (goleiro escolhido em ${gOk})`, `0 (com ≥ 4 lances)`, nG >= 4 && dG === 0);
  // perdendo a bola (posse do time 0 → time 1), o controle ainda vai para o jogador de linha mais perto dela
  let perdas = 0, foi = 0;
  for (const sem of [21, 22, 23]) {
    const m = novaPartida(sem, 100);
    let antes = m.posse != null ? porId(m, m.posse)?.time : null;
    for (let i = 0; i < 60 * 90; i++) {
      const evs = P.passoPartida(m, P.entradaDemoPartida(m));
      const d = m.posse != null ? porId(m, m.posse) : null;
      const agora = d ? d.time : antes;
      if (antes === 0 && agora === 1 && !m.parada && m.naMao == null) {
        perdas++;
        let mel = null, dm = Infinity;
        for (const o of m.jogadores) { if (o.time !== 0 || o.posicao === 'GOL') continue; const q = Math.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z); if (q < dm) { dm = q; mel = o; } }
        if (mel && m.controlado[0] === mel.id) foi++;
      }
      antes = agora;
    }
  }
  reg('B2c (guarda) perdendo a bola (posse do meu time → adversário): o controle vai para o mais perto dela', `${foi}/${perdas}`, '≥ 90% (com ≥ 8 perdas)', perdas >= 8 && foi >= 0.9 * perdas);
}

// ------------------------------------------------------------------ B3. PRESSÃO no passe do adversário
if (faz('B3')) {
  let ticksPasse = 0, comChamado = 0, passesFeitos = 0, mesmo = 0;
  for (const sem of [31, 32, 33, 34, 35, 36, 37, 38]) {
    const m = novaPartida(sem, 200);
    for (let k = 0; k < 4; k++) {
      // o time 1 com a bola no pé
      let achou = false;
      for (let i = 0; i < 3000 && !achou; i++) {
        P.passoPartida(m, P.entradaDemoPartida(m));
        const d = m.posse != null ? porId(m, m.posse) : null;
        achou = !!d && d.time === 1 && d.posicao !== 'GOL' && !m.parada && m.naMao == null;
      }
      if (!achou) break;
      const B = clone(m);
      // idPasse: quem estava chamado no fim do passe (corria para onde a bola ia); 6 ticks depois de o recebedor dominar,
      // o chamado ainda é ele? (antes ninguém era chamado no passe e, no recebedor, outro partia do zero)
      let emPasse = false, idPasse = -1, conta = -1;
      for (let i = 0; i < 180; i++) {
        P.passoPartida(B, { x: 0, z: 0, botoes: BOTAO.PRESSAO });
        const c = B.pressaoHumano?.[0];
        const id = c && c.tick === B.tick - 1 ? c.id : -1;
        const dono = B.posse != null ? porId(B, B.posse) : null;
        const passeAdv = !dono && B.voo && B.voo.time === 1 && !['chute', 'colocado', 'cavadinha'].includes(B.voo.tipo) && !B.parada;
        if (passeAdv) {
          emPasse = true; idPasse = id; conta = -1;
          ticksPasse++; if (id >= 0) comChamado++;
        } else if (dono && dono.time === 1) {
          if (emPasse) { emPasse = false; conta = 0; }
          if (conta >= 0 && ++conta === 6) { passesFeitos++; if (id >= 0 && id === idPasse) mesmo++; conta = -1; }
        } else break;
      }
      // segue a partida a partir de um pouco depois
      for (let i = 0; i < 240; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    }
  }
  const pc = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`;
  reg('B3a PRESSÃO segurado no passe do adversário: alguém segue chamado (ticks do passe)', pc(comChamado, ticksPasse), '≥ 90% (≥ 100 ticks)', ticksPasse >= 100 && comChamado >= 0.9 * ticksPasse);
  reg('B3b o chamado do fim do passe do adversário continua chamado com o recebedor (0,1 s depois do domínio)', pc(mesmo, passesFeitos), '≥ 80% (≥ 8 passes)', passesFeitos >= 8 && mesmo >= 0.8 * passesFeitos);
}

// ------------------------------------------------------------------ B4/B5. bola parada: aperto antes da hora e CHUTE
/** Partida nova na saída do time 0: o mundo no tick em que a montagem fechou (cobrador = controlado). */
function saida(sem) {
  const m = P.criarPartida({ semente: sem });
  for (let i = 0; i < 200 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
  return m;
}
/** Aperta `bit` por `dur` ticks a partir do tick `t0` e espera a cobrança até `ate` ticks; devolve o tick dela ou null. */
function cobrarCom(m, bit, t0, dur, ate, x = 0, z = 0) {
  let t = null;
  rodar(m, ate - m.tick, (i, mm) => ({ x, z, botoes: mm.tick >= t0 && mm.tick < t0 + dur ? bit : 0 }), (mm, evs) => {
    const ev = evs.find(e => e.tipo === 'cobranca' || e.tipo === 'arremesso');
    if (ev) { t = ev.tick; return true; }
    return false;
  });
  return t;
}
if (faz('B4')) {
  const det = [];
  let ok = 0, n = 0;
  for (const sem of [1, 2]) {
    const m0 = saida(sem);
    const pronta = m0.parada.pronta;
    for (const off of [-40, -10, -1]) {
      const t = cobrarCom(clone(m0), BOTAO.PASSE, pronta + off, 1, pronta + 60);
      n++; if (t != null && t <= pronta + 15) ok++;
      det.push(`${off}: ${t == null ? 'não saiu' : `+${t - pronta}`}`);
    }
  }
  reg('B4 saída: PASSE tocado ANTES de a bola ficar pronta (−40, −10, −1 ticks) cobra na hora', `${det.join(' · ')} (${ok}/${n})`, `sai até pronta + 15 ticks, ${n}/${n}`, ok === n);
}
if (faz('B5')) {
  const det = [];
  let ok = 0, n = 0;
  for (const sem of [1, 2]) {
    const m0 = saida(sem);
    const pronta = m0.parada.pronta;
    const tToque = cobrarCom(clone(m0), BOTAO.CHUTE, pronta + 5, 1, pronta + 120);
    const tSeg = cobrarCom(clone(m0), BOTAO.CHUTE, pronta, 36, pronta + 160);
    n += 2; if (tToque != null) ok++; if (tSeg != null) ok++;
    det.push(`saída ${sem}: tocado ${tToque == null ? 'não' : '+' + (tToque - pronta)}, segurado ${tSeg == null ? 'não' : '+' + (tSeg - pronta)}`);
  }
  // escanteio e lateral a favor (a bola sai pelo adversário: a parada do time 0, o cobrador é o controlado)
  for (const tipo of ['escanteio', 'lateral']) {
    for (const sem of [3, 4]) {
      const m = novaPartida(sem);
      limpar(m);
      const lado = m.ataca[0];
      const j1 = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
      const x = tipo === 'lateral' ? lado * 14 : lado * (CAMPO.meioX + 0.6), z = tipo === 'lateral' ? CAMPO.meioZ + 0.5 : 10;
      Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
      m.partida.ultimoTime = 1; m.partida.ultimoId = j1.id; m.partida.ultimoTick = m.tick;
      m.ultimoToque = { id: j1.id, time: 1, tick: m.tick };
      for (let i = 0; i < 400 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
      const pr = m.parada;
      if (!pr || pr.time !== 0 || m.controlado[0] !== pr.cobrador) { det.push(`${tipo} ${sem}: sem a parada do time 0`); n++; continue; }
      const t = cobrarCom(m, BOTAO.CHUTE, pr.pronta + 5, 1, pr.pronta + 120);
      n++; if (t != null) ok++;
      det.push(`${tipo} ${sem}: ${t == null ? 'não saiu' : '+' + (t - pr.pronta)}`);
    }
  }
  reg('B5 CHUTE na bola parada a favor (saída tocado/segurado, escanteio, lateral) faz a cobrança', `${det.join(' · ')} (${ok}/${n})`, `${n}/${n} saem (antes da IA cobrar em ${PARTIDA.cobrancaHumanoMax} s)`, ok === n);
}

// ------------------------------------------------------------------ B6. pênalti contra (goleiro do humano)
/** Pênalti do time 1 contra o time 0 (o humano no goleiro). Devolve o mundo logo depois do apito. */
function penaltiContra(sem) {
  const m = novaPartida(sem, 150);
  limpar(m);
  const lado1 = m.ataca[1], gx = lado1 * CAMPO.meioX;
  const A = m.jogadores.find(j => j.time === 1 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
  const D = m.jogadores.find(j => j.time === 0 && j.posicao === 'ZAG');
  P.teleportar(A, gx - lado1 * 8, 3, lado1 > 0 ? 0 : Math.PI); P.teleportar(D, gx - lado1 * 6.8, 3.4, lado1 > 0 ? 0 : Math.PI);
  bolaNoPe(m, A);
  apitar(m, { def: D.id, cond: A.id, time: 1, x: A.x, z: A.z, area: true, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
  // a montagem fecha (o cobrador no ponto, o humano no goleiro)
  for (let i = 0; i < 300 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
  return m;
}
if (faz('B6')) {
  let nLinha = 0, okLinha = 0, nErr = 0, okErr = 0, nCerto = 0, okCerto = 0;
  const det = [];
  for (const sem of [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    const m0 = penaltiContra(sem);
    if (m0.parada?.tipo !== 'penalti') { det.push(`${sem}: sem pênalti`); continue; }
    const g0 = ctrl(m0);
    if (!g0 || g0.posicao !== 'GOL') { det.push(`${sem}: humano fora do gol`); continue; }
    // o canto que a IA sorteou na montagem (pr.miraZ, no referencial de quem bate: + = à direita dele; no mundo, z tem o
    // sinal de ataca × miraZ — partida.js dirParaZ); o meio não serve para lado certo/errado
    const mz = m0.parada.miraZ ?? 0;
    if (Math.abs(mz) < 1) { det.push(`${sem}: chute no meio (${f1(mz, 2)})`); continue; }
    const lado = Math.sign(m0.ataca[1] * mz);
    const zBola = lado * Math.abs(mz);
    for (const caso of ['certo', 'errado']) {
      const m = clone(m0), g = ctrl(m);
      const az = caso === 'certo' ? lado : -lado;
      let zChute = null, lz = null, p = null, errLido = false, bz = null;
      rodar(m, 400, { x: 0, z: az, botoes: 0 }, (mm, evs) => {
        if (zChute == null && evs.some(e => e.tipo === 'cobranca')) zChute = g.z;
        const lg = evs.find(e => e.tipo === 'leituraGoleiro' && e.id === g.id);
        if (lg && p == null) { p = lg.p; errLido = lg.palpite != null; bz = g.defesa?.bz ?? null; }
        if (g.mergulho && lz == null) lz = g.mergulho.lz;
        return evs.some(e => e.tipo === 'penalti');
      });
      if (zChute != null) { nLinha++; if (Math.abs(zChute) <= 1.0) okLinha++; }
      if (caso === 'errado') { if (errLido) { nErr++; if (lz == null || Math.sign(lz) === Math.sign(az)) okErr++; } }
      else if (bz != null && Math.abs(bz) > 0.5 && Math.sign(bz) === Math.sign(az)) { nCerto++; if (!errLido) okCerto++; }
      det.push(`${sem} ${caso}: z no chute ${f1(zChute, 2)}, mergulho ${lz ?? '-'}, p ${f1(p, 2)}`);
    }
  }
  reg('B6a pênalti contra, analógico segurado: o goleiro fica na linha (|z| no chute)', `${okLinha}/${nLinha}`, `≤ 1,0 m em todos`, nLinha >= 8 && okLinha === nLinha);
  reg('B6b lado errado: o mergulho vai para o lado escolhido (não para o da bola)', `${okErr}/${nErr}`, 'todos', nErr >= 4 && okErr === nErr);
  reg('B6c lado certo (a bola cruza do lado escolhido): a leitura NÃO conta como lado errado (no canto extremo p pode ser 0 pelo alcance)', `${okCerto}/${nCerto}`, 'todos', nCerto >= 3 && okCerto === nCerto);
  if (args.includes('--detalhe')) console.log(det.join('\n'));
}

// ------------------------------------------------------------------ B7. LANÇAMENTO dois toques = cruzamento rasteiro
if (faz('B7')) {
  const det = [];
  let ok = 0, n = 0, altoOk = 0, nAlto = 0;
  for (const sem of [1, 2, 3]) {
    const m0 = novaPartida(sem);
    limpar(m0);
    const lado = m0.ataca[0];
    const c = ctrl(m0);
    P.teleportar(c, lado * 30, 25, lado > 0 ? 0 : Math.PI);
    for (const o of m0.jogadores) if (o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 9) P.teleportar(o, o.x - lado * 12, o.z * 0.5, o.rumo);
    bolaNoPe(m0, c);
    rodar(m0, 3, NADA);
    for (const [dur, gap] of [[1, 3], [1, 8], [5, 1], [5, 6], [3, 12]]) {
      const m = clone(m0);
      const t0 = m.tick;
      const bot = (i, mm) => {
        const k = mm.tick - t0;
        return { x: 0, z: 0, botoes: (k < dur || (k >= dur + gap && k < 2 * dur + gap)) ? BOTAO.LANCAMENTO : 0 };
      };
      let voo = null;
      rodar(m, 90, bot, mm => { if (mm.voo && mm.voo.de === c.id) { voo = { ...mm.voo }; return true; } return false; });
      n++; if (voo && voo.tipo === 'cruzamento' && voo.rasteiro) ok++;
      det.push(`${dur}+${gap}: ${voo ? `${voo.tipo}${voo.rasteiro ? ' rasteiro' : ' alto'}` : 'nada'}`);
    }
    // um toque só: cruzamento alto (o normal)
    const m = clone(m0), t0 = m.tick;
    let voo = null;
    rodar(m, 90, (i, mm) => ({ x: 0, z: 0, botoes: mm.tick - t0 < 2 ? BOTAO.LANCAMENTO : 0 }), mm => { if (mm.voo && mm.voo.de === c.id) { voo = { ...mm.voo }; return true; } return false; });
    nAlto++; if (voo && voo.tipo === 'cruzamento' && !voo.rasteiro) altoOk++;
  }
  reg('B7 LANÇAMENTO dois toques na ponta (dedo de 1–5 ticks, 1–12 entre os toques) = cruzamento rasteiro', `${ok}/${n} · ${det.slice(0, 5).join(', ')}`, `${n}/${n}`, ok === n);
  reg('B7b LANÇAMENTO um toque na ponta = cruzamento alto', `${altoOk}/${nAlto}`, `${nAlto}/${nAlto}`, altoOk === nAlto);
}

// ------------------------------------------------------------------ B8. CHUTE de primeira no passe longo
if (faz('B8')) {
  const det = [];
  let ok = 0, n = 0;
  for (const dist of [14, 24, 30]) {
    for (const sem of [1, 2, 3]) {
      const m = novaPartida(sem);
      limpar(m);
      const lado = m.ataca[0];
      const c = ctrl(m);
      // o recebedor (controlado) de frente para o gol adversário; o passador atrás dele, a `dist` m
      // (no próprio campo: no campo de ataque, sem defensores perto, o recebedor ficava impedido)
      P.teleportar(c, -lado * 2, 6, lado > 0 ? 0 : Math.PI);
      const pa = m.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL' && o !== c);
      P.teleportar(pa, c.x - lado * dist, c.z, lado > 0 ? 0 : Math.PI);
      for (const o of m.jogadores) if (o.time === 1 && o.posicao !== 'GOL' && (Math.hypot(o.x - c.x, o.z - c.z) < 10 || Math.abs(o.z - c.z) < 4)) P.teleportar(o, o.x, o.z + 15, o.rumo);
      bolaNoPe(m, pa);
      pa.pedido = { tipo: 'passe', forca: 0.9, mod: false, tick: m.tick, dir: { x: lado, z: 0 } };
      let tPasse = null, chute = false, dominou = false;
      rodar(m, 300, (i, mm) => ({ x: 0, z: 0, botoes: tPasse != null && mm.tick === tPasse + 6 ? BOTAO.CHUTE : 0 }), (mm, evs) => {
        if (tPasse == null && evs.some(e => e.tipo === 'passe' && e.id === pa.id)) tPasse = mm.tick;
        if (evs.some(e => e.tipo === 'chute' && e.id === c.id)) { chute = true; return true; }
        if (mm.posse === c.id) dominou = true;
        return dominou && mm.tick > (tPasse ?? 0) + 20;
      });
      n++; if (chute) ok++;
      det.push(`${dist} m/${sem}: ${chute ? 'primeira' : dominou ? 'dominou' : tPasse == null ? 'sem passe' : 'nada'}`);
    }
  }
  reg('B8 CHUTE tocado 6 ticks depois do passe (14, 24 e 30 m): bate de primeira', `${ok}/${n} · ${det.join(', ')}`, `${n}/${n}`, ok === n);
}

// ------------------------------------------------------------------ B9/B10. tiro livre contra (barreira)
/** Tiro livre direto do time 1 a ~20 m do gol do time 0 (com barreira; o humano no goleiro). */
function tiroLivreContra(sem) {
  const m = novaPartida(sem, 150);
  limpar(m);
  const lado1 = m.ataca[1], gx = lado1 * CAMPO.meioX;
  const A = m.jogadores.find(j => j.time === 1 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
  const D = m.jogadores.find(j => j.time === 0 && j.posicao === 'ZAG');
  P.teleportar(A, gx - lado1 * 20, 2, lado1 > 0 ? 0 : Math.PI); P.teleportar(D, gx - lado1 * 18.8, 2.4, lado1 > 0 ? 0 : Math.PI);
  bolaNoPe(m, A);
  apitar(m, { def: D.id, cond: A.id, time: 1, x: A.x, z: A.z, area: false, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
  // a montagem (barreira) termina
  for (let i = 0; i < 200 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
  return m;
}
if (faz('B9')) {
  const det = [];
  let ok = 0, n = 0;
  for (const sem of [1, 2, 3]) {
    const m = tiroLivreContra(sem);
    if (m.parada?.tipo !== 'tiroLivre' || !(m.parada.barreira?.n > 0)) { det.push(`${sem}: sem barreira`); n++; continue; }
    const ids = [];
    for (let k = 0; k < 2; k++) {
      rodar(m, 1, { x: 0, z: 0, botoes: BOTAO.TROCAR });
      rodar(m, 2, NADA);
      ids.push(m.controlado[0]);
    }
    const c = ctrl(m), x0 = c.x, z0 = c.z;
    rodar(m, 60, { x: 0, z: 1, botoes: 0 });
    const andou = Math.hypot(c.x - x0, c.z - z0);
    const parados = ids.filter(id => porId(m, id)?.papel === 'parado').length;
    n++; if (parados === 0 && andou > 1.5) ok++;
    det.push(`${sem}: ${ids.join('→')} (${parados} na barreira), andou ${f1(andou)} m`);
  }
  reg('B9 TROCAR no tiro livre contra (barreira): nunca um da barreira, e o escolhido anda (1 s de analógico)', `${det.join(' · ')}`, `0 na barreira, > 1,5 m, ${n}/${n}`, ok === n);
}
if (faz('B10')) {
  const det = [];
  let ok = 0, n = 0;
  for (const sem of [1, 2, 3, 4]) {
    const m = tiroLivreContra(sem);
    const g = ctrl(m);
    if (!g || g.posicao !== 'GOL' || m.parada?.tipo !== 'tiroLivre') { det.push(`${sem}: humano fora do gol`); n++; continue; }
    // conta só enquanto a bola é o chute do adversário (depois que o meu time toca nela — o cabeceio de um zagueiro para
    // um companheiro —, o controle ir para o recebedor é o normal)
    let chutou = false, saiu = null;
    const chuteAdv = mm => !!mm.voo && mm.voo.time === 1 && ['chute', 'colocado', 'cavadinha'].includes(mm.voo.tipo);
    rodar(m, 600, NADA, (mm, evs) => {
      if (evs.some(e => e.tipo === 'cobranca')) chutou = true;
      if (!chutou) return false;
      if (mm.controlado[0] !== g.id) {
        if (chuteAdv(mm) && mm.posse == null && !mm.parada && mm.naMao == null) saiu = mm.controlado[0];
        return true;
      }
      return !chuteAdv(mm) || mm.posse != null || mm.parada != null || mm.naMao != null;
    });
    n++; if (chutou && saiu == null) ok++;
    det.push(`${sem}: ${!chutou ? 'sem chute' : saiu == null ? 'ficou no goleiro' : `foi para o ${saiu}`}`);
  }
  reg('B10 tiro livre contra: o chute alto da IA não tira o controle do goleiro', det.join(' · '), `${n}/${n}`, ok === n);
}

// ------------------------------------------------------------------ B11. pênalti a favor: para fora
if (faz('B11')) {
  const N = +arg('--penaltis', 30);
  const res = {};
  for (const modo of ['mais', 'menos', 'sem']) {
    const r = res[modo] = { gol: 0, defesa: 0, fora: 0, nada: 0 };
    for (let k = 0; k < N; k++) {
      const m = novaPartida(7000 + k, 120);
      limpar(m);
      const lado0 = m.ataca[0], gx = lado0 * CAMPO.meioX;
      const A = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
      const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
      P.teleportar(A, gx - lado0 * 8, 3, lado0 > 0 ? 0 : Math.PI); P.teleportar(D, gx - lado0 * 9.2, 3.4, lado0 > 0 ? 0 : Math.PI);
      bolaNoPe(m, A);
      apitar(m, { def: D.id, cond: A.id, time: 0, x: A.x, z: A.z, area: true, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
      for (let i = 0; i < 300 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
      const pr = m.parada;
      if (!pr || pr.tipo !== 'penalti' || m.controlado[0] !== pr.cobrador) { r.nada++; continue; }
      const az = modo === 'mais' ? 1 : modo === 'menos' ? -1 : 0;
      const t0 = pr.pronta + 2;
      let out = null;
      rodar(m, 600, (i, mm) => ({ x: 0, z: az, botoes: mm.tick >= t0 && mm.tick < t0 + 18 ? BOTAO.CHUTE : 0 }), (mm, evs) => {
        const e = evs.find(q => q.tipo === 'penalti');
        if (e) { out = e.resultado; return true; }
        return false;
      });
      r[out ?? 'nada']++;
    }
  }
  const tot = Object.values(res).reduce((s, r) => s + r.gol + r.defesa + r.fora, 0);
  const fora = Object.values(res).reduce((s, r) => s + r.fora, 0);
  const txt = Object.entries(res).map(([k, r]) => `${k}: ${r.gol}/${r.defesa}/${r.fora}${r.nada ? ` (${r.nada} sem)` : ''}`).join(' · ');
  const pf = tot ? 100 * fora / tot : 100;
  const piorModo = Math.max(...Object.values(res).map(r => r.fora / Math.max(1, r.gol + r.defesa + r.fora)));
  reg('B11 pênalti a favor, CHUTE 0,3 s (analógico +z, −z, solto): gol/defesa/fora', `${txt} · fora ${f1(pf)}%`, '4–12% para fora no total; ≤ 20% em cada mira', tot >= 3 * N * 0.9 && pf >= 4 && pf <= 12 && piorModo <= 0.2);
}

// ------------------------------------------------------------------ B12. quem cobrou não toca de novo
if (faz('B12')) {
  const det = [];
  let ok = 0, n = 0;
  for (const sem of [3, 4, 5]) {
    const m = novaPartida(sem);
    limpar(m);
    const lado = m.ataca[0];
    const j1 = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
    Object.assign(m.bola.p, { x: lado * 14, y: 0.11, z: CAMPO.meioZ + 0.5 }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = 1; m.partida.ultimoId = j1.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: j1.id, time: 1, tick: m.tick };
    for (let i = 0; i < 400 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
    const pr = m.parada;
    if (!pr || pr.tipo !== 'lateral') { det.push(`${sem}: sem lateral`); n++; continue; }
    const cob = pr.cobrador;
    // o arremesso sai (PASSE) e, logo depois de a bola rolar, ela volta para o pé do arremessador, sem ninguém perto
    let rolou = false;
    rodar(m, 200, (i, mm) => ({ x: 0, z: 0, botoes: mm.tick === pr.pronta + 2 ? BOTAO.PASSE : 0 }), (mm, evs) => { rolou = evs.some(e => e.tipo === 'cobranca'); return rolou; });
    if (!rolou) { det.push(`${sem}: o arremesso não saiu`); n++; continue; }
    const c = porId(m, cob);
    m.voo = null; m.posse = null;
    for (const j of m.jogadores) { j.recebe = null; if (j !== c && Math.hypot(j.x - c.x, j.z - c.z) < 7) P.teleportar(j, j.x - lado * 9, j.z - 8, j.rumo); }
    const b = m.bola;
    b.p.x = c.x - lado * 0.3; b.p.y = 0.11; b.p.z = c.z - 0.6; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true;
    let tocou = false;
    rodar(m, 30, NADA, mm => { if (mm.posse === cob) tocou = true; return tocou; });
    n++; if (!tocou) ok++;
    det.push(`${sem}: ${tocou ? 'o arremessador pegou a bola' : 'não tocou'}`);
  }
  reg('B12 lateral: o arremessador não toca de novo antes de outro jogador (Regra 15)', det.join(' · '), `${n}/${n}`, ok === n);
}

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-botoes: REPROVOU (${falhas})` : '\nteste-botoes: PASSOU');
process.exit(falhas ? 1 : 0);
