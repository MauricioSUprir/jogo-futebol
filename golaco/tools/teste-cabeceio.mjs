// teste-cabeceio (pedido do dono, 11/10: "os jogadores não cabeceiam a bola, de jeito nenhum"; entrega "cabeceio na bola
// rolando + IA intensa", 12/10). Diagnóstico e contraprova de 11/10: o cabeceio a gol era teletransportado para o chão
// (acoes.js finalizarChute → chutarRasteiro), ninguém pulava (a bola mudava de direção ~0,4 m acima da cabeça desenhada),
// a disputa pelo alto só existia na bola parada e a intenção ignorava o lugar (zagueiro cabeceando de "passe" na própria
// área; o controlado da demo nunca cabeceava a gol). Partes:
//  A) CANHÃO DE CRUZAMENTOS (jogo corrido, 40 cenas): o time 1 cruza da ponta para 2 atacantes (marca do pênalti e 2º
//     pau) marcados por 2 zagueiros colados do lado do gol; o resto longe. Metas: disputa pelo alto em ≥ 60% das cenas;
//     a defesa ganha 30–50% das disputas (Copa América 2021: o ataque ganha 52,6% do 1º contato no escanteio; Opta: 24%
//     dos cruzamentos acham um companheiro); o 1º contato é de cabeça em ≥ 85%; gol em 3–12% dos cruzamentos.
//  B) POSE (o que quem joga vê): em todo cabeceio (cenas A e partidas D), a folga entre a superfície da bola e a da
//     cabeça DESENHADA (anim.js pose logo depois do toque × a bola no toque) ≤ 0,08 m em ≥ 90%; com a bola acima de
//     2,0 m, a pelve desenhada ≥ 0,2 m acima da de pé (0,943 m) em ≥ 90% (houve pulo).
//  C) TELEPORTE: 200 cabeceios a gol com a bola a 2,1 m — nenhum sai rolando no chão no mesmo tick.
//  D) PARTIDAS IA × IA (a demo, como o painel; padrão 4 de 2 × 4 min): duelos pelo alto com a bola rolando ≥ 1,5 por
//     partida; cabeceios para afastar ≥ 25% dos cabeceios (FA/Opta: zagueiros cabeceiam ~2× os atacantes); o time 0
//     da demo (o controlado pela IA) cabeceia a gol pelo menos 1 vez no total.
//  E) HUMANO (mundo do treino, o controlado com o analógico solto): E1 atacante na área sem botão cabeceia a GOL (≥ 90%
//     dos cabeceios); E2 com PASSE e a bola abaixo de 1,25 m não sai cabeceio (0); E3 passe alto para ele chegando a
//     1,6–2,2 m vira cabeceio em ≥ 80%.
//   node tools/teste-cabeceio.mjs                 (lógica do repositório)
//   node tools/teste-cabeceio.mjs --js <pasta>    (outra cópia, ex.: a base — tem de REPROVAR)
//   --partidas N (D; 0 desliga) · --par N (processos da parte D; padrão 4) · --so A,B,C,D,E
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const A = await imp('acoes.js');
const AN = await imp('anim.js');
const S = await imp('sim.js');
const CF = await imp('config.js');
const { uniforme } = await imp('rng.js');
const { alturaNaDistancia } = await imp('bola.js');
const MX = 52.5, PE = 0.943;

/** Folga bola–cabeça desenhada e altura da pelve, no cabeceio de `id` (pose de agora × a bola de antes do passo). */
function medirPose(m, id, ant, lista) {
  const j = m.jogadores.find(o => o.id === id);
  if (!j) return;
  const p = AN.pose(j, m), k = AN.J.cabeca * 3, kp = AN.J.pelve * 3;
  lista.push({ folga: Math.hypot(ant.x - p[k], ant.y - p[k + 1], ant.z - p[k + 2]) - AN.RAIO_CABECA - 0.11, by: ant.y, pelve: p[kp + 1] });
}

// ------------------------------------------------------------------ processo filho: partidas da parte D
if (args.includes('--filho')) {
  const sem = +arg('--s', 1001);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  const R = { sem, cab: 0, afasta: 0, cabGol0: 0, cabGol1: 0, duelos: 0, duelosRolando: 0, poses: [] };
  const N = 2 * 4 * 3600 + 3600;
  for (let i = 0; i < N; i++) {
    const ant = { ...m.bola.p };
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    for (const e of ev) {
      if (e.tipo === 'disputaAerea') { R.duelos++; if (e.bolaParada === false) R.duelosRolando++; }
      if (e.tipo === 'passe' && e.modo === 'cabeceio') {
        R.cab++;
        const j = m.jogadores.find(o => o.id === e.id);
        const tipo = m.voo && m.voo.de === e.id ? m.voo.cabeceio : null;
        if (tipo === 'lancamento') R.afasta++;
        if (M.ehChute(m, e) && j) R[j.time === 0 ? 'cabGol0' : 'cabGol1']++;
        medirPose(m, e.id, ant, R.poses);
      }
    }
    if (m.partida.estado === 'fim') break;
  }
  process.send(R);
  process.exit(0);
}

/** P(X ≥ k) para X ~ Binomial(n, p) (termos em log). */
function caudaBinomial(k, n, p) {
  if (k <= 0) return 1;
  let lt = n * Math.log(1 - p), abaixo = 0;
  const r = Math.log(p / (1 - p));
  for (let i = 0; i < k; i++) { abaixo += Math.exp(lt); lt += Math.log((n - i) / (i + 1)) + r; }
  return Math.max(0, 1 - abaixo);
}
const linhas = [['parte', 'medida', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (parte, nome, medido, meta, ok) => { linhas.push([parte, nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const pc = (a, b) => (b ? `${(100 * a / b).toFixed(0)}%` : '—');
const SO = (arg('--so', 'A,B,C,D,E,F')).split(',');
const poses = [];

// ------------------------------------------------------------------ A) canhão de cruzamentos
if (SO.includes('A') || SO.includes('B')) {
  const N = 60;
  const R = { cenas: 0, disputa: 0, defGanhou: 0, disputas: 0, cabeca: 0, gol: 0, prim: {} };
  for (let k = 0; k < N; k++) {
    const m = P.criarPartida({ semente: 3000 + k, minutosPorTempo: 4 });
    for (let i = 0; i < 400 && !(m.partida.estado === 'jogo' && (!m.parada || m.parada.rolou)); i++) P.passoPartida(m, P.entradaDemoPartida(m));
    for (let i = 0; i < 30; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    const T = 1, lado = m.ataca[T], sz = k % 2 ? 1 : -1;
    const meu = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL');
    const deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
    const ata = meu.filter(j => j.posicao === 'ATA'), zag = deles.filter(j => j.posicao === 'ZAG' || j.posDetalhe === 'ZAG');
    const cruzador = meu.find(j => !ata.includes(j));
    const a1 = ata[0] ?? meu[1], a2 = ata[1] ?? meu.find(j => j !== cruzador && j !== a1);
    const d1 = zag[0] ?? deles[0], d2 = zag[1] ?? deles[1];
    const jit = () => (uniforme(m.rng) - 0.5);
    const gx = lado * MX;
    P.teleportar(cruzador, gx - lado * (14 + 2 * jit()), sz * (27 + 2 * jit()), Math.atan2(-sz, lado));
    P.teleportar(a1, gx - lado * (11 + 2 * jit()), sz * 1.5 * jit(), lado > 0 ? 0 : Math.PI);
    P.teleportar(a2, gx - lado * (7 + jit()), -sz * (3 + jit()), lado > 0 ? 0 : Math.PI);
    P.teleportar(d1, a1.x + lado * (0.9 + 0.3 * jit()), a1.z + 0.4 * jit(), lado > 0 ? Math.PI : 0);
    P.teleportar(d2, a2.x + lado * (0.9 + 0.3 * jit()), a2.z + 0.4 * jit(), lado > 0 ? Math.PI : 0);
    let q = 0;
    for (const j of m.jogadores) {
      if ([cruzador, a1, a2, d1, d2].includes(j) || j.posicao === 'GOL') continue;
      P.teleportar(j, -lado * (5 + 3 * (q % 4)), -30 + 6 * (q % 11), j.rumo); q++;
    }
    const gk = m.jogadores.find(j => j.time !== T && j.posicao === 'GOL');
    P.teleportar(gk, gx - lado * 1.5, 0, lado > 0 ? Math.PI : 0);
    const b = m.bola;
    b.p.x = cruzador.x + Math.cos(cruzador.rumo) * 0.35; b.p.z = cruzador.z + Math.sin(cruzador.rumo) * 0.35; b.p.y = 0.11;
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
    m.posse = cruzador.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    m.ultimoToque = { id: cruzador.id, time: T, tick: m.tick };
    cruzador.pedido = { tipo: 'lancamento', forca: 0.7, tick: m.tick };
    A.executarAcao(m, cruzador, cruzador.par.attr.pePreferido ?? 1, false);
    if (!m.voo || m.voo.tipo !== 'cruzamento') continue;
    R.cenas++;
    let prim = null, disputou = false, cabGol = null;
    for (let i = 0; i < 240; i++) {
      const ant = { ...b.p };
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      for (const e of ev) {
        const j = e.id != null ? m.jogadores.find(o => o.id === e.id) : null;
        // desfecho do cabeceio a gol do ataque (informativo: no alvo = gol + defesa)
        if (e.tipo === 'passe' && e.modo === 'cabeceio' && j && j.time === T && m.voo && m.voo.cabeceio === 'chute' && !cabGol) { cabGol = 'fora'; R.cabGolN = (R.cabGolN ?? 0) + 1; }
        else if (cabGol === 'fora' && e.tipo === 'defesa') { cabGol = 'defesa'; R.cabGolDef = (R.cabGolDef ?? 0) + 1; }
        else if (cabGol === 'fora' && e.tipo === 'gol' && e.time === T) { cabGol = 'gol'; R.cabGolGol = (R.cabGolGol ?? 0) + 1; }
        if (e.tipo === 'disputaAerea' && !prim) {
          disputou = true; R.disputas++;
          if (j && j.time !== T) R.defGanhou++;
          if (e.alcancou === false) R.semDono = (R.semDono ?? 0) + 1;
          const dono = m.jogadores.find(o => o.id === e.dono);
          if (dono && dono.time !== T) R.donoDef = (R.donoDef ?? 0) + 1;
        }
        if (e.tipo === 'passe' && e.modo === 'cabeceio' && j) medirPose(m, e.id, ant, poses);
        if (!prim) {
          if (e.tipo === 'passe' && e.modo === 'cabeceio' && j) { prim = j.time === T ? 'cabeça (ataque)' : 'cabeça (defesa)'; R.cabeca++; }
          else if (e.tipo === 'dominioAereo' && j) prim = 'peito';
          else if (e.tipo === 'defesa' || m.naMao != null) prim = 'goleiro';
          else if (e.tipo === 'bateuCorpo') prim = 'corpo';
          else if (e.tipo === 'fora') prim = 'fora';
        }
        if (e.tipo === 'gol' && e.time === T) R.gol++;
      }
      if (!prim && m.posse != null) prim = 'domínio no pé (quicou)';
      if (prim && (m.partida.estado !== 'jogo' || i > 200)) break;
    }
    if (disputou) R.disputa++;
    prim = prim ?? 'ninguém';
    R.prim[prim] = (R.prim[prim] ?? 0) + 1;
  }
  if (SO.includes('A')) {
    reg('A', 'cenas com disputa pelo alto', `${R.disputa}/${R.cenas}`, '≥ 60%', R.cenas >= 30 && R.disputa >= 0.6 * R.cenas);
    reg('A', 'a defesa ganha a disputa', `${R.defGanhou}/${R.disputas} (${pc(R.defGanhou, R.disputas)})`, '30–50%', R.disputas > 0 && R.defGanhou >= 0.3 * R.disputas && R.defGanhou <= 0.5 * R.disputas);
    reg('A', '1º contato de cabeça', `${R.cabeca}/${R.cenas} (${pc(R.cabeca, R.cenas)})`, '≥ 85%', R.cabeca >= 0.85 * R.cenas);
    // (60 cenas: a taxa varia ±4 pontos só pelo sorteio — o teto reprova só quando a contagem PROVA mais de 12%, P(X ≥ gols |
    // n, 0,12) < 5% (binomial), como o C3 do teste-bolas-paradas; o piso de 3% fica direto)
    const pGolCruz = caudaBinomial(R.gol, R.cenas, 0.12);
    reg('A', 'gol do cruzamento', `${R.gol}/${R.cenas} (${pc(R.gol, R.cenas)}; p = ${pGolCruz.toFixed(2)} contra 12%)`, '3–12% (p ≥ 0,05)', R.gol >= 0.03 * R.cenas && pGolCruz >= 0.05);
    console.log('A — 1º contato:', JSON.stringify(R.prim), `· disputas em que quem ia na bola não alcançou: ${R.semDono ?? 0} · em que quem ia na bola era da defesa: ${R.donoDef ?? 0}`);
    const nG = R.cabGolN ?? 0, gG = R.cabGolGol ?? 0, dG = R.cabGolDef ?? 0;
    console.log(`A — cabeceios a gol do ataque: ${nG} · no alvo ${pc(gG + dG, nG)} · gol ${pc(gG, nG)} · o goleiro defende ${pc(dG, gG + dG)} (Opta: ~40% no alvo, 10–13% gol)`);
  }
}

// ------------------------------------------------------------------ C) teleporte do cabeceio a gol
if (SO.includes('C')) {
  let chao = 0, n = 0;
  for (let k = 0; k < 200; k++) {
    const m = P.criarPartida({ semente: 500 + k, minutosPorTempo: 4 });
    m.partida.estado = 'jogo'; m.parada = null;
    const j = m.jogadores.find(q => q.time === 0 && q.posicao === 'ATA') ?? m.jogadores.find(q => q.time === 0 && q.posicao !== 'GOL');
    const lado = m.ataca[0];
    j.x = lado * (MX - 9); j.z = (k % 7) - 3; j.vx = 0; j.vz = 0;
    const b = m.bola;
    b.p.x = j.x; b.p.y = 2.1; b.p.z = j.z; b.v.x = 0; b.v.y = -3; b.v.z = (k % 2 ? 1 : -1) * 10; b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
    m.posse = null;
    A.executarCabeceio(m, j, { tipo: 'chute', forca: 0.7 });
    n++;
    if (b.rolando && b.p.y < 0.2) chao++;
  }
  reg('C', 'cabeceio a gol (bola a 2,1 m) que sai rolando no chão no mesmo tick', `${chao}/${n}`, '0', chao === 0);
}

// ------------------------------------------------------------------ E) humano (mundo do treino)
function lancar(m, x0, z0, px, pz, h, s) {
  const p = { x: x0, y: 0.11, z: z0 };
  const D = Math.hypot(px - x0, pz - z0), ux = (px - x0) / D, uz = (pz - z0) / D;
  let lo = -0.1, hi = 1.0;
  for (let k = 0; k < 30; k++) { const el = (lo + hi) / 2; if (alturaNaDistancia(p, ux, uz, D, s, el).y < h) lo = el; else hi = el; }
  const el = (lo + hi) / 2;
  Object.assign(m.bola.p, p);
  m.bola.v.x = ux * s * Math.cos(el); m.bola.v.y = s * Math.sin(el); m.bola.v.z = uz * s * Math.cos(el);
  m.bola.w.x = 0; m.bola.w.y = 0; m.bola.w.z = 0; m.bola.rolando = false; m.posse = null;
  m.voo = { tipo: 'lancamento', de: 9, time: 0, tick0: m.tick, tickChave: m.tick, alto: true };
}
if (SO.includes('E')) {
  const B = CF.BOTAO;
  // E1: atacante controlado na área, sem botão, cruzamento na cabeça
  let gol = 0, nCab = 0;
  for (let s = 1; s <= 16; s++) {
    const jog = [
      { id: 0, x: MX - 8, z: (s % 5) - 2, rumo: 0, time: 0, papel: 'humano', posicao: 'ATA', attr: { cabeceio: 75, impulsao: 70 } },
      { id: 20, x: MX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'parado', posicao: 'GOL' },
    ];
    const m = S.criarMundo({ semente: 200 + s, jogadores: jog, bola: { x: 30, z: 20 }, posse: null });
    lancar(m, MX - 20, 24, MX - 8, (s % 5) - 2, 1.9 + 0.05 * (s % 4), 21);
    for (let i = 0; i < 150; i++) {
      S.passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      const e = m.eventos.find(e => e.tipo === 'cabeceio' && e.id === 0);
      if (e) { nCab++; if (m.voo && m.voo.cabeceio === 'chute') gol++; break; }
    }
  }
  reg('E', 'E1 atacante controlado na área, sem botão: cabeceia a gol', `${gol}/${nCab}`, '≥ 90% (≥ 12 cabeceios)', nCab >= 12 && gol >= 0.9 * nCab);
  // E2: PASSE apertado e a bola abaixo de 1,25 m: não é cabeceio
  let cabBaixo = 0, toques = 0;
  for (let s = 1; s <= 16; s++) {
    const h = 0.75 + 0.03 * (s % 15);
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'MEI' }];
    const m = S.criarMundo({ semente: 300 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    lancar(m, 10, (s % 3) - 1, 0, 0, h, 13);
    for (let i = 0; i < 150; i++) {
      S.passo(m, { 0: { x: 0, z: 0, botoes: i < 10 ? B.PASSE : 0 } });
      if (m.eventos.some(e => e.tipo === 'cabeceio')) { cabBaixo++; toques++; break; }
      if (m.eventos.some(e => e.tipo === 'dominioAereo' || e.tipo === 'passe') || m.posse === 0) { toques++; break; }
    }
  }
  reg('E', 'E2 com PASSE e a bola a 0,75–1,2 m: cabeceios', `${cabBaixo} (em ${toques} toques)`, '0', toques >= 12 && cabBaixo === 0);
  // E3: passe alto para o controlado, chegando a 1,6–2,2 m (o analógico solto)
  let deCabeca = 0, prim = 0;
  for (let s = 1; s <= 16; s++) {
    const h = 1.6 + 0.04 * (s % 16);
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'MEI', attr: { impulsao: 65 } }];
    const m = S.criarMundo({ semente: 400 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    lancar(m, 18, (s % 3) - 1, 0, 0, h, 17);
    m.voo.para = 0;
    for (let i = 0; i < 150; i++) {
      S.passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      if (m.eventos.some(e => e.tipo === 'cabeceio')) { deCabeca++; prim++; break; }
      if (m.eventos.some(e => e.tipo === 'dominioAereo') || m.posse === 0) { prim++; break; }
    }
  }
  reg('E', 'E3 passe alto para ele a 1,6–2,2 m: 1º toque de cabeça', `${deCabeca}/${prim}`, '≥ 80%', prim >= 12 && deCabeca >= 0.8 * prim);
}

// ------------------------------------------------------------------ F) bola morta e teleporte no pulo (contraprova de 14/10)
// Na semente 1008 do painel (tick ~21580) dois jogadores planejaram o cabeceio de uma bola que ia sair pela linha de fundo
// — o ponto do contato 3,3 m ATRÁS da linha, dentro da rede —, correram para lá, saíram do chão com a bola já fora (a
// parada do tiro de meta montando) e foram teletransportados no ar pela montagem: os pés ficaram no ponto de pouso velho,
// a 7 e 15 m do corpo, e foram plantados lá. Partes:
//  F1/F2) BOLA QUE SAI (20 cenas, partida): a bola subindo a ~3,2 m, 3,5 m antes da linha de fundo e fora da trave, só desce
//     à altura da cabeça 1–3 m depois dela; 2 atacantes e 2 zagueiros perto da linha. Metas: nenhum cabeceio planejado
//     com a bola fora do campo (F1) e ninguém sai do chão com a bola morta (a parada ainda sem cobrar, F2).
//  F3) TELEPORTE NO AR (16 cenas, treino): o jogador no ar é levado pela montagem (partida.js teleportar) 10 m para o lado;
//     os pés ficam com o corpo (≤ 1,2 m) até o fim do pulo.
if (SO.includes('F')) {
  const fora = (x, z) => Math.abs(x) > MX + 0.11 || Math.abs(z) > 34 + 0.11;
  let cenas = 0, planosFora = 0, pulosMorta = 0, planos = 0;
  for (let k = 0; k < 20; k++) {
    const m = P.criarPartida({ semente: 7000 + k, minutosPorTempo: 4 });
    for (let i = 0; i < 400 && !(m.partida.estado === 'jogo' && (!m.parada || m.parada.rolou)); i++) P.passoPartida(m, P.entradaDemoPartida(m));
    for (let i = 0; i < 30; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    const T = 1, lado = m.ataca[T], sz = k % 2 ? 1 : -1, gx = lado * MX;
    const meu = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL');
    const deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
    const quatro = [meu[0], meu[1], deles[0], deles[1]];
    const zs = [sz * 5.2, sz * 6.6, sz * 5.6, sz * 7.0];
    quatro.forEach((j, q) => P.teleportar(j, gx - lado * (q < 2 ? 1.2 : 0.6), zs[q], lado > 0 ? 0 : Math.PI));
    let q = 0;
    for (const j of m.jogadores) {
      if (quatro.includes(j) || j.posicao === 'GOL') continue;
      P.teleportar(j, -lado * (5 + 3 * (q % 4)), -30 + 6 * (q % 11), j.rumo); q++;
    }
    const gk = m.jogadores.find(j => j.time !== T && j.posicao === 'GOL');
    P.teleportar(gk, gx - lado * 1.0, 0, lado > 0 ? Math.PI : 0);
    // a bola subindo a ~3,2 m, 3,5 m antes da linha de fundo e fora da trave: passa por cima de todos e só desce à altura da
    // cabeça 1–3 m depois da linha (o lance da semente 1008)
    const b = m.bola;
    b.p.x = gx - lado * 3.5; b.p.y = 3.2 + 0.02 * k; b.p.z = sz * 6;
    b.v.x = lado * (6 + 0.15 * (k % 10)); b.v.y = 2.0; b.v.z = 0.2 * sz;
    b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
    const px = gx + lado * 3, pz = sz * 6;
    m.posse = null; m.naMao = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    const lancador = meu[2];
    m.voo = { tipo: 'lancamento', de: lancador.id, time: T, para: meu[0].id, alvo: { x: px, z: pz }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + 60, alto: true };
    m.ultimoToque = { id: lancador.id, time: T, tick: m.tick };
    cenas++;
    const vistos = new Set(), saiuAntes = new Map();
    for (let i = 0; i < 220; i++) {
      P.passoPartida(m, P.entradaDemoPartida(m));
      const morta = !!(m.parada && !m.parada.rolou);
      for (const j of m.jogadores) {
        const c = j.cab;
        if (c && c.cabeceio && !vistos.has(`${j.id}:${c.tc}`)) {
          vistos.add(`${j.id}:${c.tc}`); planos++;
          if (fora(c.bx, c.bz)) planosFora++;
        }
        const saiu = !!(c && c.saiu);
        if (saiu && !saiuAntes.get(j.id) && morta) pulosMorta++;
        saiuAntes.set(j.id, saiu);
      }
      if (m.parada && m.parada.rolou) break;
    }
  }
  reg('F', 'F1 cabeceios planejados com a bola fora do campo', `${planosFora} (de ${planos} planos em ${cenas} cenas)`, '0', cenas >= 15 && planosFora === 0);
  reg('F', 'F2 pulos que saem do chão com a bola morta (parada sem cobrar)', `${pulosMorta}`, '0', cenas >= 15 && pulosMorta === 0);
  // F3: teleporte no ar
  let noAr = 0, longe = 0, pior = 0;
  for (let s = 1; s <= 16; s++) {
    const h = 2.0 + 0.02 * s;
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'MEI', attr: { impulsao: 70 } }];
    const m = S.criarMundo({ semente: 600 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    lancar(m, 18, (s % 3) - 1, 0, 0, h, 17);
    m.voo.para = 0;
    const j = m.jogadores[0];
    let levado = false;
    for (let i = 0; i < 150; i++) {
      S.passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      const c = j.cab;
      if (!levado && c && c.saiu && m.tick > c.td + 2 && m.tick < c.tp - 2) { P.teleportar(j, j.x, j.z + 10, j.rumo); levado = true; noAr++; continue; }
      if (levado) {
        for (const p of j.pes) { const d = Math.hypot((p.apoio ? p.x : p.tx) - j.x, (p.apoio ? p.z : p.tz) - j.z); pior = Math.max(pior, d); if (d > 1.2) { longe++; break; } }
        if (!j.cab) break;
      }
    }
  }
  reg('F', 'F3 teleporte no ar: passos com um pé a mais de 1,2 m do corpo', `${longe} (em ${noAr} pulos; pior ${pior.toFixed(2)} m)`, '0 (≥ 12 pulos)', noAr >= 12 && longe === 0);
  // F4: PULO FANTASMA (partida; 8 partidas IA × IA: 3 de 100 pulos saíam do chão 0,27 s depois de outro tocar na bola,
  // com ela já a 7–8 m do ponto do plano). Cena: lançamento alto para um atacante sozinho; com o pulo planejado e ainda
  // no chão, a bola é desviada (outro tocou nela: a velocidade gira 60° e perde 30%). Meta: ninguém sai do chão para o
  // ponto velho; sem o desvio (guarda), ele pula em ≥ 80% das cenas.
  let planF = 0, fant = 0, guarda = 0, nG = 0;
  for (let k = 0; k < 24; k++) {
    for (const desvia of [true, false]) {
      const m = P.criarPartida({ semente: 7100 + k, minutosPorTempo: 4 });
      for (let i = 0; i < 400 && !(m.partida.estado === 'jogo' && (!m.parada || m.parada.rolou)); i++) P.passoPartida(m, P.entradaDemoPartida(m));
      const T = 1, lado = m.ataca[T];
      const ata = m.jogadores.find(j => j.time === T && j.posicao === 'ATA') ?? m.jogadores.find(j => j.time === T && j.posicao !== 'GOL');
      const z0 = (k % 5) - 2;
      P.teleportar(ata, lado * 10, z0, lado > 0 ? Math.PI : 0);
      let q = 0;
      for (const j of m.jogadores) { if (j === ata || j.posicao === 'GOL') continue; P.teleportar(j, -lado * (20 + 3 * (q % 4)), -30 + 6 * (q % 11), j.rumo); q++; }
      const b = m.bola, h = 2.0 + 0.02 * (k % 10), s = 17;
      const p0 = { x: lado * 28, y: 0.11, z: z0 }, D = Math.abs(p0.x - ata.x), ux = -lado, uz = 0;
      let lo = -0.1, hi = 1.0;
      for (let it = 0; it < 30; it++) { const el = (lo + hi) / 2; if (alturaNaDistancia(p0, ux, uz, D, s, el).y < h) lo = el; else hi = el; }
      const el = (lo + hi) / 2;
      Object.assign(b.p, p0); b.v.x = ux * s * Math.cos(el); b.v.y = s * Math.sin(el); b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
      m.posse = null; m.naMao = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
      const lanc = m.jogadores.find(j => j.time === T && j !== ata && j.posicao !== 'GOL');
      m.voo = { tipo: 'lancamento', de: lanc.id, time: T, para: ata.id, alvo: { x: ata.x, z: ata.z }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + 60, alto: true };
      m.ultimoToque = { id: lanc.id, time: T, tick: m.tick };
      let desviou = false, pulou = false, plano = false;
      for (let i = 0; i < 150; i++) {
        P.passoPartida(m, P.entradaDemoPartida(m));
        const c = ata.cab;
        if (c && c.cabeceio && c.h > 0 && !c.saiu) plano = true;
        if (desvia && !desviou && c && c.h > 0 && !c.saiu && c.td - m.tick >= 4 && c.td - m.tick <= 12) {
          const a = 1.05 * (k % 2 ? 1 : -1), cs = Math.cos(a), sn = Math.sin(a);
          const vx = b.v.x * 0.7, vz = b.v.z * 0.7;
          b.v.x = vx * cs - vz * sn; b.v.z = vx * sn + vz * cs; b.v.y *= 0.7;
          m.voo = null; m.ultimoToque = { id: lanc.id, time: T, tick: m.tick };
          desviou = true;
        }
        if (c && c.saiu) { pulou = true; break; }
        if (m.eventos.some(e => e.tipo === 'cabeceio' || e.tipo === 'dominioAereo') || m.posse != null) break;
      }
      if (desvia) { if (desviou) { planF++; if (pulou) fant++; } }
      else if (plano) { nG++; if (pulou) guarda++; }
    }
  }
  reg('F', 'F4 pulo fantasma: a bola desviada depois do plano e ele sai do chão para o ponto velho', `${fant}/${planF}`, '0 (≥ 12 cenas)', planF >= 12 && fant === 0);
  reg('F', 'F4 (guarda) sem o desvio ele pula', `${guarda}/${nG}`, '≥ 80% (≥ 12 cenas)', nG >= 12 && guarda >= 0.8 * nG);
}

// ------------------------------------------------------------------ D) partidas IA × IA
const NP = +arg('--partidas', 4);
if (SO.includes('D') && NP > 0) {
  const sementes = Array.from({ length: NP }, (_, k) => 1001 + k);
  const nPar = Math.max(1, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length)));
  const res = [];
  let prox = 0;
  await Promise.all(Array.from({ length: Math.min(nPar, NP) }, async () => {
    while (prox < sementes.length) {
      const s = sementes[prox++];
      res.push(await new Promise((ok, erro) => {
        const c = fork(fileURLToPath(import.meta.url), ['--filho', '--s', String(s), '--js', JS]);
        c.on('message', ok); c.on('error', erro);
        c.on('exit', (cod, sinal) => { if (cod || sinal) erro(new Error(`semente ${s}: saiu com ${cod ?? sinal}`)); });
      }));
    }
  }));
  const soma = f => res.reduce((a, r) => a + f(r), 0);
  const cab = soma(r => r.cab), afasta = soma(r => r.afasta), dr = soma(r => r.duelosRolando);
  for (const r of res) poses.push(...r.poses);
  reg('D', 'duelos pelo alto com a bola rolando, por partida', `${(dr / NP).toFixed(2)} (${(soma(r => r.duelos) / NP).toFixed(2)} com a bola parada)`, '≥ 1,5', dr / NP >= 1.5);
  reg('D', 'cabeceios para afastar', `${afasta}/${cab} (${pc(afasta, cab)})`, '≥ 25%', cab > 0 && afasta >= 0.25 * cab);
  reg('D', 'cabeceios a gol do time 0 da demo (o controlado pela IA)', `${soma(r => r.cabGol0)} (time 1: ${soma(r => r.cabGol1)})`, '≥ 1', soma(r => r.cabGol0) >= 1);
  console.log(`D — ${NP} partidas: ${(cab / NP).toFixed(1)} cabeceios por partida`);
}

// ------------------------------------------------------------------ B) pose
if (SO.includes('B')) {
  const ok = poses.filter(p => p.folga <= 0.08).length;
  const altos = poses.filter(p => p.by > 2.0), pulou = altos.filter(p => p.pelve - PE >= 0.2).length;
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
  reg('B', 'folga bola–cabeça desenhada ≤ 0,08 m', `${ok}/${poses.length} (${pc(ok, poses.length)}; mediana ${med(poses.map(p => p.folga)).toFixed(2)} m)`, '≥ 90%', poses.length >= 20 && ok >= 0.9 * poses.length);
  reg('B', 'bola acima de 2,0 m: a pelve sobe ≥ 0,2 m', `${pulou}/${altos.length} (${pc(pulou, altos.length)})`, '≥ 90%', altos.length >= 5 && pulou >= 0.9 * altos.length);
}

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-cabeceio: REPROVOU (${falhas})` : '\nteste-cabeceio: PASSOU');
process.exit(falhas ? 1 : 0);
