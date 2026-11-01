// Botões que não funcionavam (dono, 12/10: "ainda tem botões que não funcionam"; auditoria dos botões com o caçador
// de falhas). Cada item monta o lance na partida 11×11 (lógica pura, Node) com a entrada do humano roteirizada e mede o
// EFEITO no mundo (pedido criado, cobrança saiu, controle trocou ou ficou, o goleiro andou, o companheiro foi apertar).
// A parte da tela (toque de verdade, fase dos botões, PEGAR/TROCAR visíveis) está no tools/teste-controles.mjs.
//  B1 toque aéreo vencido não prende o jogador (sim.js movimentoAereo/bolaLivre): o analógico anda ≥ 80% do que anda sem
//     o toque e o toque é limpo;
//  B2 a troca automática não desfaz a escolha manual (sim.js ganhouPosse/escolhaManual): o passe entre adversários não
//     desfaz o TROCAR nem o goleiro do TROCAR segurado; perdendo a bola, o controle ainda vai para o mais perto dela;
//  B3 PRESSÃO no passe do adversário (defesa.js/ia-tatica.js): o chamado segue chamado durante o passe (correndo para
//     onde a bola vai) e continua chamado com o recebedor;
//  B4 bola parada: o aperto antes da hora (montagem) cobra na hora (partida.js cobrar);
//  B5 CHUTE na bola parada (saída, escanteio, lateral) vira a cobrança padrão (passe / lançamento);
//  B6 pênalti contra: o goleiro do humano fica na linha com o analógico segurado e o mergulho vai para o lado escolhido;
//     no lado certo a defesa vale (goleiro.js lerChute/iniciarMergulho, sim.js goleiroComoLinha);
//     B6d (contraprova, 38 pênaltis no canto, a mesma cena do medir5 da auditoria do goleiro): o lado certo escolhido no
//     fim (0,3 s antes do chute: com a corrida, do fim dela) defende como na main (o passo de ~0,4 m para o lado, na linha)
//     e segurado desde a montagem não defende menos (pareado: reprova quando os pares discordantes provam, binomial; no
//     máximo GOLEIRO.penalti.passo do meio: nem a trave, nem parado no meio); o lado errado não defende — com o cobrador
//     da IA no estilo normal (item 70, P2: o goleiro segurado é lido por quem depende do goleiro, teste-estilos-penalti C2);
//     B6e (contraprova): o canto sai só do z do analógico (ao longo da linha do gol); com a câmera de TV, esquerda/direita
//     da tela (para o batedor ou para o gol) não escolhe canto e o goleiro fica no meio, como sem analógico (antes: +z);
//  B7 LANÇAMENTO dois toques na ponta = cruzamento rasteiro (acoes.js processarPedido);
//  B8 CHUTE de primeira no passe longo (24–30 m): bate de primeira (acoes.js atualizarBotoesAcao);
//  B9 TROCAR na barreira: nunca um jogador parado (sim.js candidatoTroca);
//  B10 tiro livre contra: o chute alto da IA não tira o controle do goleiro (troca.js);
//  B11 pênalti a favor: com qualquer mira, 4–12% para fora (meta do dono ~6%; acoes.js chute) — 120 por mira, reprova quando
//     a contagem PROVA fora da faixa (binomial unilateral, p < 5%; em cada mira, quando prova acima de 20%). (01/11, item 70
//     P2: com 30 por mira a branch deu 13,3% e a base d971fe54 10,0%; com 120, 9,4% × 6,4% — 34 × 23 de 360, a contagem não
//     prova diferença: o sorteio muda com os sorteios a mais da montagem do pênalti, o estilo da IA e o goleiro que sai cedo);
//  B12 quem cobrou a bola parada não toca de novo antes de outro (Regra 15; partida.js rolou, sim.js bolaLivre);
//  B13 cruzamento do adversário com o goleiro escolhido pelo TROCAR segurado (sem reassumir o controle a cada passo, como
//     o G7 do teste-goleiro-regras): o controle fica no goleiro (troca.js trocaAerea, m.trocaManual).
//  B14 (contraprova) a escolha do goleiro pelo TROCAR segurado VENCE quando o meu time tem a bola: num cruzamento depois,
//     com o controle de volta no goleiro sem TROCAR (bola parada contra, defesa com encaixe), a troca aérea leva o
//     controle a quem disputa, como sem escolha nenhuma (antes a trava do goleiro escolhido valia a partida inteira);
//     B14b: a escolha vencida também não desliga a troca automática no passe do adversário quando o controle volta ao
//     jogador escolhido (m.ultPosse guardava só o último time com a bola: a escolha antiga "revivia");
//  B15 (contraprova) pênalti e tiro livre direto a favor: o CHUTE tocado na montagem não bate sozinho na hora da bola
//     pronta (fraco e sem a mira); a cobrança é a do aperto depois de pronta, e o CHUTE segurado desde a montagem
//     ainda bate (partida.js cobrar).
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
const AC = await imp('acoes.js');
const { BOTAO, PASSO, CAMPO, PARTIDA, ACOES, GOLEIRO } = await imp('config.js');
const { provaFora, cdfAlto } = await import('./lib/binomial.mjs');
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
  for (const sem of [21, 22, 23, 24, 25]) {
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

// B6d: o lado certo vale como na main (o passo para o lado); segurado desde a montagem não vale menos
if (faz('B6')) {
  const MX = CAMPO.meioX;
  const gkDe = (m, t) => m.jogadores.find(j => j.time === t && j.posicao === 'GOL');
  function montarPen(sem) {
    const m = P.criarPartida({ semente: sem });
    for (let i = 0; i < 200; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    const lado0 = m.ataca[0], gx = -lado0 * MX;
    const At = m.jogadores.find(j => j.time === 1 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
    const Df = m.jogadores.find(j => j.time === 0 && j.posicao === 'ZAG');
    const x = gx + lado0 * 7.5;
    P.teleportar(At, x, 3, lado0 > 0 ? Math.PI : 0); P.teleportar(Df, x + lado0 * 1, 3.5, lado0 > 0 ? Math.PI : 0);
    m.bola.p.x = x - lado0 * 0.4; m.bola.p.z = 3; m.posse = At.id; m.naMao = null; m.voo = null;
    apitar(m, { def: Df.id, cond: At.id, time: 1, x, z: 3, area: true, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
    if (!m.parada || m.parada.tipo !== 'penalti') return null;
    for (let i = 0; i < 120 && m.parada.cobrador == null; i++) P.passoPartida(m, NADA);
    return m;
  }
  /** O lado (no mundo, sinal de z) para onde a IA bate: a mesma montagem, sem o goleiro escolher. */
  function ladoReal(base) {
    const m = clone(base);
    for (let i = 0; i < 60 * 15; i++) {
      const ev = P.passoPartida(m, NADA);
      if (ev.some(e => e.tipo === 'cobranca' && e.parada === 'penalti')) { P.passoPartida(m, NADA); return Math.sign(m.bola.v.z) || 1; }
    }
    return 1;
  }
  function pen(base, modo, s) {
    const m = clone(base), g = gkDe(m, 0);
    let res = null, zChute = null;
    for (let i = 0; i < 60 * 15 && !res; i++) {
      const pr = m.parada;
      // (o "fim" é 0,3 s antes do chute: com a corrida da cobrança — item 70, P1 — o chute é no fim da corrida, a previsão
      // dela desde o 1º passo; antes, pronta + atraso. Com o pronta + atraso de antes o "fim" caía no meio da corrida, até
      // ~1,1 s antes do chute, e o B6d reprovava desde a d971fe54: certo no fim 45 × segurado 39 em 146)
      const cr = pr && pr.corrida;
      const fim = pr && !pr.rolou && pr.pronta != null && (cr ? cr.estado === 'corre' && m.tick >= cr.t0 + cr.ticks - 18 : m.tick >= pr.pronta + pr.atraso - 18);
      const az = modo === 'certoFim' ? (fim ? s : 0) : modo === 'erradoFim' ? (fim ? -s : 0) : (pr && !pr.rolou ? s : 0);
      for (const e of P.passoPartida(m, { x: 0, z: az, botoes: 0 })) {
        if (e.tipo === 'cobranca' && e.parada === 'penalti') zChute = g.z;
        if (e.tipo === 'penalti') res = e.resultado;
      }
    }
    return { res, z: Math.abs(zChute ?? 0) };
  }
  const t = { certoFim: [0, []], certoSempre: [0, []], erradoFim: [0, []] };
  let n = 0, soFim = 0, soSempre = 0; // (os pares discordantes: só o certo no fim defendeu · só o segurado defendeu)
  // (item 70, P2: o goleiro da pessoa que segura o lado desde a montagem se comprometeu e o cobrador da IA que depende do
  // goleiro — paradinha, pulinho — o lê e bate no outro canto: é o jogo. O B6d confere o LUGAR do goleiro segurado, então
  // a IA bate aqui o estilo normal; a leitura tem o teste dela, teste-estilos-penalti C2)
  const EPb = (await imp('config.js')).ESTILO_PENALTI, fiel0 = EPb ? EPb.ia.fiel : null;
  if (EPb) EPb.ia.fiel = 0;
  for (let k = 0; k < 40; k++) {
    const base = montarPen(8000 + k);
    if (!base || Math.abs(base.parada.miraZ) < 0.5) continue;
    n++;
    const s = ladoReal(base);
    const def = {};
    for (const md of Object.keys(t)) { const r = pen(base, md, s); def[md] = r.res === 'defesa'; if (def[md]) t[md][0]++; t[md][1].push(r.z); }
    if (def.certoFim && !def.certoSempre) soFim++;
    if (def.certoSempre && !def.certoFim) soSempre++;
  }
  if (EPb) EPb.ia.fiel = fiel0;
  const zMax = l => Math.max(...l);
  const passo = GOLEIRO.penalti.passo ?? 0;
  // (segurado × certo no fim, PAREADOS — a mesma cena: reprova quando os pares discordantes PROVAM o segurado pior, binomial
  // unilateral p < 5%. 01/11, item 70 P2: "segurado ≥ certo no fim" na contagem crua reprovava por sorteio — com 146 cenas,
  // 60 × 66, z ≈ 0,7; a base d971fe54 37 × 39 com o "fim" de verdade)
  const segPior = cdfAlto(soFim, soFim + soSempre, 0.5) < 0.05 && soFim > soSempre;
  reg('B6d pênalti contra, 38 no canto: lado certo no fim (0,3 s) e segurado desde a montagem (defesas, |z| máx no chute); lado errado',
    `certo no fim ${t.certoFim[0]}/${n} (|z| ≤ ${f1(zMax(t.certoFim[1]), 2)}) · segurado ${t.certoSempre[0]}/${n} (|z| ≤ ${f1(zMax(t.certoSempre[1]), 2)}; pares: só o fim ${soFim}, só o segurado ${soSempre}) · errado ${t.erradoFim[0]}/${n}`,
    'certo no fim ≥ 7 (a main) · o segurado não pior (pareado, binomial p < 5%), |z| ≤ 0,6 m · errado 0',
    n >= 30 && t.certoFim[0] >= 7 && !segPior && zMax(t.certoSempre[1]) <= 0.6 && passo > 0 && t.erradoFim[0] === 0);
}

// B6e (contraprova): o canto sai só da componente do analógico AO LONGO da linha do gol (z do mundo). Com a câmera de TV
// (render/camera.js, yaw = −π/2: direita da tela = +x, cima = −z) o empurrão para os lados da tela vai para o batedor ou
// para o gol (iz ≈ 0) e antes escolhia sempre +z (gk.iz >= 0); agora não escolhe: fica no meio, como sem analógico
if (faz('B6')) {
  const { paraMundo } = await imp('controle.js');
  const YAW_TV = -Math.PI / 2;
  // [nome, analógico na tela (x para a direita, y para cima), canto esperado (sinal de z; 0 = nenhum)]
  const casos = [
    ['direita', 1, 0, 0], ['esquerda', -1, 0, 0],
    ['quase horizontal (20° acima da direita)', Math.cos(0.35), Math.sin(0.35), 0], ['quase horizontal (20° abaixo da esquerda)', -Math.cos(0.35), -Math.sin(0.35), 0],
    ['cima (trave de lá)', 0, 1, -1], ['baixo (trave de cá)', 0, -1, 1],
    ['diagonal z dominante (60° acima da direita)', Math.cos(1.05), Math.sin(1.05), -1], ['diagonal z dominante (60° abaixo da esquerda)', -Math.cos(1.05), -Math.sin(1.05), 1],
    ['diagonal do teclado (cima + esquerda)', -Math.SQRT1_2, Math.SQRT1_2, -1],
  ];
  /** Segura `ent` desde a montagem até o fim do pênalti: palpite no chute, |z| do goleiro no chute, resultado. */
  function cobrar(base, ent) {
    const m = clone(base), g = ctrl(m);
    let palpite, zChute = null, res = null;
    for (let i = 0; i < 60 * 15 && !res; i++) {
      for (const e of P.passoPartida(m, ent)) {
        if (e.tipo === 'cobranca' && e.parada === 'penalti') { palpite = g.palpite; zChute = g.z; }
        if (e.tipo === 'penalti') res = e.resultado;
      }
    }
    return { palpite, z: zChute, res };
  }
  let n = 0, okSem = 0, nSem = 0, okCanto = 0, nCanto = 0, igualSem = 0;
  const erros = [];
  for (const sem of [2, 4, 5, 6, 7, 8]) {
    const base = penaltiContra(sem);
    if (base.parada?.tipo !== 'penalti' || ctrl(base)?.posicao !== 'GOL') continue;
    n++;
    const ref = cobrar(base, NADA); // sem analógico
    for (const [nome, ax, ay, esperado] of casos) {
      const w = paraMundo(ax, ay, YAW_TV);
      const r = cobrar(base, { x: w.x, z: w.z, botoes: 0 });
      const lado = Math.sign(r.palpite ?? NaN);
      if (esperado === 0) {
        nSem++;
        // nenhum canto e o goleiro como sem analógico: mesmo z no chute (no meio) e mesmo resultado
        const igual = r.palpite === 0 && ref.palpite === 0 && Math.abs((r.z ?? 9) - (ref.z ?? 9)) <= 0.02 && r.res === ref.res;
        if (r.palpite === 0) okSem++;
        if (igual) igualSem++;
        else erros.push(`${sem} ${nome}: palpite ${f1(r.palpite, 1)}, z ${f1(r.z, 2)} × ${f1(ref.z, 2)} sem analógico, ${r.res} × ${ref.res}`);
      } else {
        nCanto++;
        if (lado === esperado) okCanto++;
        else erros.push(`${sem} ${nome}: palpite ${f1(r.palpite, 1)} (esperado ${esperado > 0 ? '+' : '−'}z)`);
      }
    }
  }
  reg('B6e pênalti contra, câmera de TV: esquerda/direita da tela (para o batedor/o gol, |iz| < 0,38) não escolhe canto e o goleiro fica como sem analógico',
    `sem canto ${okSem}/${nSem} · igual a sem analógico ${igualSem}/${nSem}`, 'todos', n >= 5 && okSem === nSem && igualSem === nSem);
  reg('B6e cima/baixo da tela (±z, ao longo da linha do gol) e diagonal com z dominante: o canto do z', `${okCanto}/${nCanto}`, 'todos', n >= 5 && okCanto === nCanto);
  if (erros.length && (args.includes('--detalhe') || igualSem < nSem || okCanto < nCanto)) console.log(erros.slice(0, 12).join('\n'));
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
  const N = +arg('--penaltis', 120);
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
  const modoProva = Object.values(res).some(r => provaFora(r.fora, r.gol + r.defesa + r.fora, null, 0.2));
  reg('B11 pênalti a favor, CHUTE 0,3 s (analógico +z, −z, solto): gol/defesa/fora', `${txt} · fora ${f1(pf)}% (pior mira ${f1(100 * piorModo)}%)`,
    '4–12% para fora no total; ≤ 20% em cada mira (reprova se a contagem prova fora, binomial p < 5%)', tot >= 3 * N * 0.9 && !provaFora(fora, tot, 0.04, 0.12) && !modoProva);
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

// ------------------------------------------------------------------ B13. cruzamento com o goleiro escolhido pelo TROCAR
if (faz('B13')) {
  // auditoria do goleiro (12/10): o humano segura TROCAR (0,55 s) com a ala adversária parada com a bola na ponta —
  // o controle vai ao goleiro — e NÃO reassume nada; a ala cruza para a marca do pênalti. Até alguém do meu time
  // (que não o goleiro) tocar na bola, o controle fica no goleiro (antes troca.js trocaAerea o tirava em 16/16)
  const MX = CAMPO.meioX;
  let n = 0, foi = 0, perdeu = 0;
  const det = [];
  for (let sem = 61; sem <= 68; sem++) for (const zs of [-1, 1]) {
    const m = P.criarPartida({ semente: sem, minutosPorTempo: 60 });
    for (let i = 0; i < 600 && !(m.partida.estado === 'jogo' && !m.parada); i++) P.passoPartida(m, P.entradaDemoPartida(m));
    limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = m.jogadores.find(j => j.time === 0 && j.posicao === 'GOL');
    P.teleportar(g, gx + lado0 * 2, 0, lado0 > 0 ? 0 : Math.PI);
    const atk = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL');
    const def = m.jogadores.filter(o => o.time === 0 && o.posicao !== 'GOL');
    atk.forEach((o, k) => P.teleportar(o, gx + lado0 * (8 + (k % 4) * 3), -9 + (k % 5) * 4.5, lado0 > 0 ? Math.PI : 0));
    def.forEach((o, k) => P.teleportar(o, gx + lado0 * (7 + (k % 4) * 3), -8 + (k % 5) * 4.5, lado0 > 0 ? Math.PI : 0));
    const ala = atk[0]; P.teleportar(ala, gx + lado0 * 4, zs * 26, 0);
    const b = m.bola;
    for (let i = 0; i < 34; i++) {
      b.p.x = ala.x + 0.4; b.p.z = ala.z; b.p.y = 0.11; b.v.x = b.v.y = b.v.z = 0; b.rolando = true; m.posse = ala.id; ala.pedido = null;
      P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.TROCAR });
    }
    n++;
    if (m.controlado[0] !== g.id) { det.push(`${sem}${zs > 0 ? '+' : '-'}: o TROCAR segurado não foi ao goleiro`); continue; }
    foi++;
    m.posse = null;
    b.p.x = gx + lado0 * 4; b.p.z = zs * 25; b.p.y = 0.11;
    const ax = gx + lado0 * 11, T = 1.25;
    b.v.x = (ax - b.p.x) / T; b.v.z = -b.p.z / T; b.v.y = 7.5; b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
    m.voo = { tipo: 'cruzamento', de: ala.id, time: 1, para: null, alvo: { x: ax, z: 0 }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + 75, alto: true };
    m.ultimoToque = { id: ala.id, time: 1, tick: m.tick };
    let p = false, por = '';
    for (let i = 0; i < 80 && !p; i++) {
      const dx = b.p.x - g.x, dz = b.p.z - g.z, l = Math.hypot(dx, dz) || 1;
      const evs = P.passoPartida(m, { x: dx / l, z: dz / l, botoes: 0 });
      // um companheiro (não o goleiro) tocou na bola: daí em diante a troca é a do passe do meu time (legítima)
      const u = m.ultimoToque;
      if (u && u.time === 0 && u.id !== g.id) break;
      // (o domínio também é toque: a posse não grava o m.ultimoToque — com a IA de ataque contra a pessoa, categoria D, o
      // zagueiro ganha a disputa pelo alto e domina no fim do voo em 7 dos 16 casos, e a troca vai a ele no mesmo passo)
      const dono = m.posse != null ? porId(m, m.posse) : null;
      if (dono && dono.time === 0 && dono.id !== g.id) break;
      if (m.controlado[0] !== g.id) { p = true; por = evs.map(e => e.tipo).join(','); }
      if (m.posse != null || m.naMao != null || m.parada) break;
    }
    if (p) perdeu++;
    det.push(`${sem}${zs > 0 ? '+' : '-'}${p ? ':perdeu(' + por + ')' : ''}`);
  }
  reg('B13 cruzamento do adversário com o goleiro do TROCAR segurado (sem reassumir): o controle fica no goleiro',
    `perdeu ${perdeu}/${foi} (goleiro escolhido em ${foi}/${n})${perdeu ? ' — ' + det.filter(x => x.includes(':')).slice(0, 4).join(' ') : ''}`, `0, com ${n}/${n} no goleiro`, foi === n && perdeu === 0);
}

// ------------------------------------------------------------------ B14. escolha do goleiro vencida (contraprova)
if (faz('B14')) {
  const MX = CAMPO.meioX;
  /** Cruzamento do adversário com o humano no goleiro: modo 'sem' (nenhuma escolha) ou 'vencida' (escolheu o goleiro
   * pelo TROCAR segurado, depois o meu time teve a bola). Devolve null (montagem falhou) ou se a troca aérea agiu. */
  function caso(sem, zs, modo) {
    const m = P.criarPartida({ semente: sem, minutosPorTempo: 60 });
    for (let i = 0; i < 600 && !(m.partida.estado === 'jogo' && !m.parada); i++) P.passoPartida(m, P.entradaDemoPartida(m));
    limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = m.jogadores.find(j => j.time === 0 && j.posicao === 'GOL');
    P.teleportar(g, gx + lado0 * 2, 0, lado0 > 0 ? 0 : Math.PI);
    const atk = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL');
    const def = m.jogadores.filter(o => o.time === 0 && o.posicao !== 'GOL');
    atk.forEach((o, k) => P.teleportar(o, gx + lado0 * (8 + (k % 4) * 3), -9 + (k % 5) * 4.5, lado0 > 0 ? Math.PI : 0));
    def.forEach((o, k) => P.teleportar(o, gx + lado0 * (7 + (k % 4) * 3), -8 + (k % 5) * 4.5, lado0 > 0 ? Math.PI : 0));
    const ala = atk[0]; P.teleportar(ala, gx + lado0 * 4, zs * 26, 0);
    const b = m.bola;
    const segura = (dono, n, botoes) => {
      for (let i = 0; i < n; i++) {
        b.p.x = dono.x + 0.4; b.p.z = dono.z; b.p.y = 0.11; b.v.x = b.v.y = b.v.z = 0; b.rolando = true; m.posse = dono.id; dono.pedido = null;
        P.passoPartida(m, { x: 0, z: 0, botoes });
      }
    };
    if (modo === 'vencida') {
      segura(ala, 34, BOTAO.TROCAR);
      if (m.controlado[0] !== g.id) return null;
      AC.assumirControle(m, 0, def[0]);
      segura(def[0], 60, 0); // o meu time com a bola por 1 s: a escolha venceu
    }
    segura(ala, 10, 0);
    if (m.controlado[0] !== g.id) AC.assumirControle(m, 0, g); // o controle de volta no goleiro, sem TROCAR
    m.posse = null;
    b.p.x = gx + lado0 * 4; b.p.z = zs * 25; b.p.y = 0.11;
    const ax = gx + lado0 * 11, T = 1.25;
    b.v.x = (ax - b.p.x) / T; b.v.z = -b.p.z / T; b.v.y = 7.5; b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
    m.voo = { tipo: 'cruzamento', de: ala.id, time: 1, para: null, alvo: { x: ax, z: 0 }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + 75, alto: true };
    m.ultimoToque = { id: ala.id, time: 1, tick: m.tick };
    for (let i = 0; i < 80; i++) {
      const evs = P.passoPartida(m, NADA);
      if (evs.some(e => e.tipo === 'trocaAerea')) return true;
      if (m.controlado[0] !== g.id || m.posse != null || m.naMao != null || m.parada) return false;
    }
    return false;
  }
  const r = { sem: [0, 0], vencida: [0, 0] };
  for (const modo of ['sem', 'vencida']) for (let sem = 61; sem <= 68; sem++) for (const zs of [-1, 1]) {
    const v = caso(sem, zs, modo);
    if (v == null) continue;
    r[modo][1]++; if (v) r[modo][0]++;
  }
  reg('B14 cruzamento depois que a escolha do goleiro (TROCAR segurado) venceu: a troca aérea leva o controle a quem disputa',
    `vencida ${r.vencida[0]}/${r.vencida[1]} · sem escolha ${r.sem[0]}/${r.sem[1]}`, 'vencida = sem escolha, ≥ 90% e ≥ 12 casos',
    r.vencida[1] >= 12 && r.vencida[0] === r.vencida[1] && r.vencida[0] >= 0.9 * r.vencida[1] && r.vencida[0] >= r.sem[0] * r.vencida[1] / Math.max(1, r.sem[1]));
  // B14b: a escolha do TROCAR vencida (o meu time teve a bola depois) não desliga a troca automática do passe do adversário
  // quando o controlado volta a ser o escolhido (a perda com ele mais perto): igual a sem escolha nenhuma
  // (amostra 10 → 40 sementes, 15/10: com 10 o "sem ≥ 3" reprovava pelo sorteio dos lances — a main dava 3/10 e a junção
  // com as faltas com sentido 1/9; com as 40, 13/38 e 13/36, a mesma taxa)
  const rb = { sem: [0, 0], vencida: [0, 0] };
  for (let sem = 11; sem <= 50; sem++) {
    const m = novaPartida(sem, 200);
    let achou = false;
    for (let i = 0; i < 3000 && !achou; i++) {
      P.passoPartida(m, P.entradaDemoPartida(m));
      const d = m.posse != null ? porId(m, m.posse) : null;
      achou = !!d && d.time === 1 && d.posicao !== 'GOL' && !m.parada && m.naMao == null;
    }
    if (!achou) continue;
    for (const modo of ['sem', 'vencida']) {
      const mm = clone(m), d = porId(mm, mm.posse);
      if (modo === 'vencida') rodar(mm, 1, { x: 0, z: 0, botoes: BOTAO.TROCAR });
      const X = porId(mm, mm.controlado[0]);
      if (!X || X.posicao === 'GOL') continue;
      for (let i = 0; i < 30; i++) { bolaNoPe(mm, X); P.passoPartida(mm, NADA); }   // o meu time com a bola
      for (let i = 0; i < 5; i++) { bolaNoPe(mm, d); if (mm.controlado[0] !== X.id) AC.assumirControle(mm, 0, X); P.passoPartida(mm, NADA); } // perdeu, X segue
      if (mm.controlado[0] !== X.id) AC.assumirControle(mm, 0, X);
      let emPasse = false, trocou = null;
      for (let i = 0; i < 360 && trocou == null; i++) {
        const evs = P.passoPartida(mm, NADA);
        const dono = mm.posse != null ? porId(mm, mm.posse) : null;
        if (evs.some(e => e.tipo === 'passe' && porId(mm, e.id)?.time === 1)) emPasse = true;
        if (emPasse && dono && dono.time === 1) trocou = mm.controlado[0] !== X.id;
        if ((dono && dono.time === 0) || mm.parada || mm.naMao != null) break;
        if (mm.controlado[0] !== X.id && !emPasse) break;
      }
      if (trocou == null) continue;
      rb[modo][1]++; if (trocou) rb[modo][0]++;
    }
  }
  reg('B14b passe do adversário depois que a escolha do TROCAR venceu: a troca automática vale como sem escolha',
    `vencida ${rb.vencida[0]}/${rb.vencida[1]} · sem escolha ${rb.sem[0]}/${rb.sem[1]}`, 'trocou na recepção: vencida ≥ sem − 1, sem ≥ 3',
    rb.sem[0] >= 3 && rb.vencida[1] >= 4 && rb.vencida[0] >= rb.sem[0] * rb.vencida[1] / Math.max(1, rb.sem[1]) - 1);
}

// ------------------------------------------------------------------ B15. CHUTE na montagem do pênalti/tiro livre direto
if (faz('B15')) {
  /** Falta do time 1 no meu atacante a `dist` m do gol (área: pênalti; fora: tiro livre direto); devolve o mundo pronto. */
  function cobrancaAGol(sem, penalti) {
    const m = novaPartida(sem, 120);
    limpar(m);
    const lado0 = m.ataca[0], gx = lado0 * CAMPO.meioX, dx = penalti ? 8 : 22;
    const A = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
    const D = m.jogadores.find(j => j.time === 1 && j.posicao === 'ZAG');
    P.teleportar(A, gx - lado0 * dx, 3, lado0 > 0 ? 0 : Math.PI); P.teleportar(D, gx - lado0 * (dx + 1.2), 3.4, lado0 > 0 ? 0 : Math.PI);
    bolaNoPe(m, A);
    apitar(m, { def: D.id, cond: A.id, time: 0, x: A.x, z: A.z, area: penalti, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick });
    for (let i = 0; i < 300 && !(m.parada && m.parada.cobrador != null && m.parada.pronta > 0); i++) P.passoPartida(m, NADA);
    const pr = m.parada;
    if (!pr || pr.tipo !== (penalti ? 'penalti' : 'tiroLivre') || m.controlado[0] !== pr.cobrador) return null;
    return m;
  }
  /**
   * Tick em que a cobrança começa com a entrada bt(tick, pronta) (null: não começou em 4 s depois de pronta): a bola rolou
   * ou — na cobrança com corrida (item 70, P1: o pênalti e o tiro livre) — a corrida do cobrador começou (o soltar do CHUTE;
   * o contato sai no fim dela, ~1,5 s depois).
   */
  function cobranca(m, bt) {
    const pronta = m.parada.pronta, pr = m.parada, n = 240 + (pronta - m.tick);
    for (let i = 0; i < n; i++) {
      const evs = P.passoPartida(m, { x: 0, z: 0, botoes: bt(m.tick, pronta) });
      if (evs.some(e => e.tipo === 'cobranca') || (pr.corrida && pr.corrida.estado === 'corre')) return { t: m.tick, pronta };
    }
    return { t: null, pronta };
  }
  let nA = 0, okA = 0, nB = 0, okB = 0;
  const det = [];
  for (const penalti of [true, false]) for (const sem of [1, 2, 3, 4, 5, 6]) {
    const m0 = cobrancaAGol(sem, penalti);
    if (!m0) { det.push(`${penalti ? 'pên' : 'TL'} ${sem}: sem a cobrança do time 0`); nA++; nB++; continue; }
    // (a) toque 1 s antes de pronta e o aperto de verdade (0,3 s) logo depois: a cobrança é a do aperto de verdade
    const a = cobranca(clone(m0), (t, p) => (t === p - 60 || (t >= p + 2 && t < p + 20)) ? BOTAO.CHUTE : 0);
    nA++; if (a.t != null && a.t >= a.pronta + 2) okA++;
    // (b) CHUTE segurado de pronta − 30 a pronta + 15: bate (a força conta de pronta)
    const b = cobranca(clone(m0), (t, p) => (t >= p - 30 && t < p + 15) ? BOTAO.CHUTE : 0);
    nB++; if (b.t != null && b.t <= b.pronta + 60) okB++;
    det.push(`${penalti ? 'pên' : 'TL'} ${sem}: toque cedo → ${a.t == null ? 'não saiu' : (a.t - a.pronta >= 0 ? '+' : '') + (a.t - a.pronta)}, segurado → ${b.t == null ? 'não saiu' : '+' + (b.t - b.pronta)}`);
  }
  reg('B15a pênalti / tiro livre direto: CHUTE tocado 1 s antes de pronta não bate sozinho (vale o aperto depois de pronta, +2)',
    `${okA}/${nA} · ${det.slice(0, 4).join(' · ')}`, `${nA}/${nA}`, nA >= 10 && okA === nA);
  reg('B15b (guarda) CHUTE segurado desde a montagem até depois de pronta: bate', `${okB}/${nB}`, `${nB}/${nB}`, nB >= 10 && okB === nB);
}

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-botoes: REPROVOU (${falhas})` : '\nteste-botoes: PASSOU');
process.exit(falhas ? 1 : 0);
