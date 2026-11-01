// PRESSÃO do humano PERCEPTÍVEL (pedido do dono, 11/10: "o botão de pressão não funciona"; o EA FC "teammate pressure":
// segurar o botão manda o companheiro que chega primeiro PERSEGUIR o condutor de forma agressiva, com uma marca em cima
// dele; com o 1º defensor da IA já apertando, vem o segundo). Medida PAREADA (tools/lib/pressao-pareada.mjs): a cada posse
// nova do adversário na partida IA × IA, o mundo é copiado e roda 2 s em dois ramos com a mesma entrada do humano — A sem
// o botão, B com PRESSÃO segurado. Modelos do humano alternados por partida: 'persegue' (analógico na bola) e 'parado'.
// O teste antigo do teste-defesa-humano ("um companheiro a ≤ 2 m em ≤ 2 s") passava SEM o botão (79%).
// Metas (casos "longos": o condutor ≥ 1,5 s com a bola nos dois ramos e um companheiro a ≤ 12 m no começo):
//  M0 os dois ramos começam bit a bit iguais (100%);
//  M1 o mais perto: mediana da distância do companheiro mais perto ao condutor em 1,5 s, com o botão ≤ 2,0 m e ≤ sem − 0,5 m
//     (era "com ≤ sem − 1,0 m": no D4 os companheiros da pessoa passaram a apertar sem o botão — o "sem" foi de ~2,8 a 2,4 m —
//     e o "com" ficou onde estava, ~1,7–1,8 m: o botão continua levando um até o condutor, mas soma menos);
//  M2 (guarda) com o botão, um companheiro chega a ≤ 2 m do condutor em ≤ 1,5 s em ≥ 60% (o diagnóstico pedia 70%: do
//     parado o corpo anda ~6,4 m em 1,5 s, e o companheiro mais perto começa a ~7,5 m na mediana) — desde o D2 (24/10), nos
//     casos longos com o companheiro mais perto a ≤ 8,5 m no começo (ao alcance em 1,5 s): a IA conduzindo contra a pessoa
//     fica com a bola também com ele a 9–12 m, e a amostra de todos os longos passou a medir a distância, não a PRESSÃO
//     (32 partidas, 7001–7032: a base D1 65% em todos e 73,3% ± 4,1 ao alcance; o D2 58% em todos e 70,3% ± 3,1 ao
//     alcance, 79,1% ± 2,4 em 7101–7132 — por faixa de distância, a mesma taxa);
//  M3 um a MAIS na pressão: o 2º companheiro mais perto do condutor em 2 s chega, em média, ≥ 1,5 m mais perto com o botão
//     (sem − com, caso a caso: os dois ramos de cada caso partem do mesmo mundo) — reprova quando a amostra PROVA o Δ abaixo
//     de 1,5 m: bootstrap por partida (o par de ramos de cada caso junto), p = fração das 4000 reamostras com Δ ≥ 1,5, e
//     reprova com p < 0,05. (Até 01/11 era a diferença das MEDIANAS de cada ramo, com ≤ sem − 1,5 m pela conta direta. No CI
//     do #588 — item 70, a corrida das cobranças — ela deu Δ 1,44 em 32 partidas (n = 184). Com 4× a amostra, 128 partidas
//     (7001–7128, 96 delas fora das do CI), a main deu 1,90 (IC 90% 1,65–2,10) e a corrida 2,01 (1,83–2,23): empate — a
//     corrida só troca os lances. Tiradas 32 partidas das 128 da main, a conta direta reprovava em 11%, e em blocos de 8
//     partidas ia de 1,10 a 2,77. E ela quase não via o defeito que mede: com o botão sem somar ninguém (MUTAÇÃO M3 abaixo)
//     as medianas ainda davam Δ ~1,3–1,5 — o limite caía em cima da mutante (reprovava 76–82% das amostras; pela prova,
//     ~20%) —, porque a mediana de cada ramo pula entre os dois grupos de casos (o 2º a ~3 m e a ~6–8 m) e mede QUAIS casos
//     caem de um lado, não quanto cada um chega mais perto. A média pareada separa: main 1,82 (1,66–1,97), corrida 1,95
//     (1,79–2,10), a mutante MUT3 — (—); pela prova, a main reprova em 0,2% das amostras de 32 partidas e 0% das de 64, a
//     mutante em MUT3P. A amostra foi de 32 para 64 partidas (3 processos, 3 vagas no rodar-testes).)
//     MUTAÇÃO M3 (o botão não soma pressão): o chamado segue como o 1º homem — sem as duas travas do "um a mais", o `excluir`
//     de defesa.js pressionadorDe (o 1º homem da IA já apertando não é chamado) e o `pedAnt` de ia-tatica.js (o chamado do
//     tick anterior sai da escolha do 1º homem e o papel dele passa ao próximo). Só sem o `excluir` nada muda (Δ medianas
//     2,38 e média pareada 1,64 em 20 partidas, o M7 em 99,2%): o pedAnt sozinho já mantém o um a mais;
//  M4 sem abuso: faltas do time 0 com o botão ≤ 1,5 × as de sem o botão + 2 (todos os casos);
//  M5 corre de verdade: o escolhido a mais de 4 m do condutor, ≥ 1 s depois de escolhido (o tempo de acelerar: do
//     parado a 6 m/s leva ~1,1 s no perfil de aceleração do jogo), a ≥ vCorrida em ≥ 80% dos ticks;
//  M6 marca visível: com o pedido valendo e um condutor adversário, o escolhido existe para o desenho (defesa.js
//     pressionadorVisivel) em 100% dos ticks;
//  M7 dobra a marcação: com o 1º homem da IA (≠ controlado) já apertando por conta própria, o escolhido é OUTRO em ≥ 95%;
//  M8 contorna (15/10): em disparada, o chamado não tromba em quem está no caminho (companheiro ou adversário que não é o
//     condutor): ≤ 3 trombadas por 100 casos (base 799ab53b: 4,2 — ia reto, perdia ~1,8 m/s e recomeçava a arrancada).
// D1 (dono, 23/10: "preciso do botão de pressão funcionando"). As metas acima passavam e o botão quase não mudava o jogo:
// elas olham só os casos longos (~10% das posses: a IA solta a bola em ~0,5 s). Três metas sobre TODAS as posses, em ramos
// de 3 s com o humano PARADO (pressao-pareada.mjs `tres`; a medida do diagnóstico "como o dono joga"):
//  M9 um toque de 1 s no botão: o time ganha a bola em 3 s (no pé ou nas mãos, antes de parada ou falta dele) em ≥ +6
//     pontos sobre o sem botão (main fd6dedb9: +2,3 — o pedido valia 1 PASSO depois de soltar);
//  M10 com a bola ao alcance do bote do chamado (ACOES.boteIA.alcance), fora das costas do condutor, sem o corpo entrar e
//     fora do descanso de outro bote: o bote liberado (defesa.js boteContidoDoChamado) em ≥ 90% dos passos (main 20%: pela
//     velocidade ABSOLUTA, o chamado que corria junto do condutor nunca tentava; só pela parte da relativa que fecha, 93%:
//     o condutor vindo para cima do chamado parado contava como embalo dele; pela conta do faltas.js forcaContato, 99%);
//  M11 segurado 3 s: trocas do chamado (a marca que pula de jogador) ≤ 0,8 por posse (main 1,30: ~85% num passe da IA).
//     A meta fica a ~1,3 erro-padrão do medido (0,77 ± 0,02 nas sementes 7001–7032 e 7101–7132): como o M2, uma mudança
//     da partida que só troque os lances o reprova por sorteio em ~9% das vezes; folga de verdade só calibrando o jogo
//     (a histeresePasse um pouco maior, medindo o M2 junto), não afrouxando a meta;
//  M12 (contraprova, 24/10) a retomada pela MÃO do goleiro (o encaixe e o PEGAR não passam por sim.js ganhouPosse) encerra
//     o pedido: um toque de 1 passo, o encaixe, a reposição cortada dentro de 1 s — o pedido não volta (antes: 9 de 9 e 7 de 7).
//     (C5, 31/10: a reposição com a mão ganhou o gesto — ≥ 0,45 s depois dos 20 passos — e mira o companheiro livre: cortada
//     dentro de 1 s do toque ela não acontece mais (0 de 11 estados; a mais cedo, 84 passos). O caminho mais rápido que
//     sobrou é o da ENFIADA — a bola no chão e o goleiro sai jogando com o PASSE de pé —, o mesmo passe do pé de antes: 6 de
//     6 cortados entre 42 e 51 passos nas sementes 7001–7002; com o pressaoPedida sem o m.possePorTime, 6 de 6 voltam.)
// AMOSTRA (15/10): 32 partidas (sementes 7001–7032, modelos alternados como antes), uma por processo filho (--par, padrão
// 3). (01/11, item 70: 64 partidas, 7001–7064 — ver o M3.) Com 8, a mesma lógica passava ou reprovava pelo sorteio dos lances: na main (c2f76d69), em 16 conjuntos disjuntos
// de 8 partidas (sementes 7001–7032, 7101–7132, 7201–7232, 7301–7332), o M1 ia de 0,80 a 2,02 m, o M2 de 48 a 73%, a
// folga do M4 de −3,5 a 7 e o M5 de 77 a 83% — só 5 dos 16 passavam em tudo (7001–7008, a do CI, era um deles); qualquer
// mudança da simulação que não mexe na pressão troca os lances e o resultado. As 128 partidas juntas (main c2f76d69, 15/10,
// antes da chegada pelo perfil de aceleração e do desvio): M1 Δ 1,38 m, M2 63%, M3 Δ 2,74 m, M4 110 → 174 faltas (1,58×),
// M5 80,6%, M6 e M7 100%.
// Decisão: a conta direta de cada meta, sem mudar nenhuma, na amostra 4× maior. Reamostrando as 128 partidas (bootstrap por
// partida, 1000 amostras), a chance de reprovar só pelo sorteio cai no M1 de 11% (8 partidas) para 0,7% (32), no M2 de 30%
// para 13% e no M3 de 7% para 0,1%. Em 15/10 o M4 e o M5 estavam no limite (é o jogo, não a amostra: 1,58× as faltas — o
// bote do chamado 7 → 34 e a carga 101 → 137 — e 80,6%); em 23/10 (main fd6dedb9, 32 partidas) os dois têm folga: M4 5 → 2
// faltas e M5 82,1% ± 0,8. Testado e NÃO adotado: reprovar só quando a amostra prova a meta furada (como os cartões do
// teste-faltas) deixava a main estável (~9%), mas a lógica de antes do PRESSÃO novo (#470) passava em M2, M4 e M5 (58%,
// 1,89× as faltas, 78%): com 32 partidas a prova não tem força para separar o limite de um defeito — seria afrouxar as metas.
// (O M3 passou à prova em 01/11 com outra estatística — a média pareada, que separa a mutante dele — e 64 partidas: ver o M3.)
// O erro-padrão entre as partidas aparece no "medido" (M2, M4, M5, M9, M11) só para dizer se o resultado está dentro do
// sorteio.
// Informativos: as metas do diagnóstico que a física do jogo não deixa cumprir (o mais perto ≥ 2 m mais perto em 1,0 s —
// do parado o corpo anda ~3,2 m no 1º segundo; bola ao alcance do bote em ≥ 15% de TODAS as posses — só ~1/5 delas dura
// ≥ 1 s), o alcance do bote nos casos longos e os dois modelos do humano.
//   node tools/teste-pressao-humano.mjs                       (lógica do repositório)
//   node tools/teste-pressao-humano.mjs --js <pasta js>       (outra cópia da lógica, ex.: a base)
//   node tools/teste-pressao-humano.mjs --partidas 64 --sem 7001 --min 4 --par 3   (amostra: partidas de 2 × min minutos)
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(AQUI, '../js');
const NP = +arg('--partidas', 64), MIN = +arg('--min', 4), SEM0 = +arg('--sem', 7001);
const MODELOS = ['persegue', 'parado'];
const PASSO = 1 / 60;
const K2 = Math.round(2 / PASSO);
const seg2 = o => Object.values(o ?? {}).sort((a, b) => a - b)[1];

if (args.includes('--filho')) {
  // uma partida: os casos da medida pareada, só com o que as metas usam (a mensagem fica pequena)
  const s = +arg('--s');
  const { medirPressaoPareada } = await import(pathToFileURL(path.join(AQUI, 'lib/pressao-pareada.mjs')).href);
  const { casos, PASSO: P } = await medirPressaoPareada(JS, { sementes: [s], min: MIN, T: 2, alcance: 15, modelos: [MODELOS[(s - SEM0) % MODELOS.length]], tres: true });
  if (Math.abs(P - PASSO) > 1e-12) throw new Error(`PASSO da lógica ${P} ≠ ${PASSO}`);
  const r = x => ({
    d1: x.d[Math.round(1 / PASSO)], d15: x.d[Math.round(1.5 / PASSO)], t2: x.t2, perdeu: x.perdeu, s2: seg2(x.dj[K2]),
    faltas: x.faltas, alcBote: x.alcBote, rouba: x.rouba, corre: x.corre, correTot: x.correTot, corre1: x.corre1, correTot1: x.correTot1,
    marcaOk: x.marcaOk, marcaTot: x.marcaTot, p1Dobra: x.p1Dobra, p1Tot: x.p1Tot, choques: x.choques ?? 0,
  });
  const msg = { s, casos: casos.map(c => ({ sem: c.sem, modelo: c.modelo, d0: c.d0, h0: c.h0, A: r(c.A), B: r(c.B), t3: c.t3 })) };
  await new Promise(ok => process.send(msg, ok));
  process.exit(0);
}

const t0 = Date.now();
const SEMENTES = Array.from({ length: NP }, (_, k) => SEM0 + k);
const nPar = Math.max(1, Math.min(SEMENTES.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
const porPartida = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    porPartida.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--s', String(s)]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
porPartida.sort((a, b) => a.s - b.s);
const casos = porPartida.flatMap(p => p.casos);

/** M12: estados da demo com o time 1 de posse; em cada um, toque → encaixe → reposição cortada (ver o M12). */
async function retomadaPelaMao() {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const P = await imp('partida.js'), S = await imp('sim.js'), CFG = await imp('config.js'), D = await imp('defesa.js'), A = await imp('acoes.js');
  // V: a validade do pedido em passos (DEFESA_HUMANO.pressao.validade s; na main antes do D1, 1 PASSO — lá o toque nunca
  // durava até a reposição e o M12 passa sem a janela ter sentido)
  // (a reposição cortada dentro da validade é rara e depende dos estados: as sementes seguem, até 6, até ≥ 4 na janela)
  // (C5: ENFIADA = a bola no chão no passo 21 depois do encaixe; o PASSE de pé apertado 3 passos depois da soltura — o aperto
  // no passo da soltura sai com ela —, pelo analógico na direção do adversário a 5 m, como antes)
  const { BOTAO: B } = CFG, V = Math.round(CFG.DEFESA_HUMANO.pressao.validade / PASSO), sementes = [];
  let casosM = 0, janela = 0, fant = 0;
  for (let sem = SEM0; sem < SEM0 + 6 && (sementes.length < 2 || janela < 4); sem++) {
    sementes.push(sem);
    const m = P.criarPartida({ semente: sem, minutosPorTempo: MIN });
    for (let i = 0, n = 0; i < 20000 && n < 8; i++) {
      P.passoPartida(m, P.entradaDemoPartida(m));
      if (i < 1200 || i % 600 !== 0) continue;
      const dono = m.posse != null ? S.jogadorPorId(m, m.posse) : null;
      if (!dono || dono.time !== 1 || m.partida.estado !== 'jogo' || m.naMao != null || m.parada) continue;
      n++; casosM++;
      const w = S.copiarMundo(m), tq = w.tick;
      P.passoPartida(w, { x: 0, z: 0, botoes: B.PRESSAO });
      const g = w.jogadores.find(j => j.time === 0 && j.posicao === 'GOL'), adv = w.jogadores.find(j => j.time === 1 && j.posicao !== 'GOL');
      const sx = Math.sign(g.x), b = w.bola;
      b.p.x = g.x - sx * 0.3; b.p.z = g.z; b.p.y = 1.0;
      b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
      w.naMao = g.id; w.posse = g.id; g.segura = { desde: w.tick }; w.voo = null;
      A.assumirControle(w, 0, g);
      adv.x = g.x - sx * 5; adv.z = g.z; adv.vx = adv.vz = 0;
      let perdeu = -1, f = false;
      for (let k = 0; k < V + 10; k++) {
        P.passoPartida(w, k < 3 ? { x: -sx, z: 0, botoes: B.ENFIADA } : k >= 24 && k < 27 ? { x: -sx, z: 0, botoes: B.PASSE } : { x: 0, z: 0, botoes: 0 });
        const d = w.posse != null ? S.jogadorPorId(w, w.posse) : null;
        if (perdeu < 0 && w.naMao == null && d && d.time === 1) perdeu = w.tick - tq;
        if (perdeu >= 0 && (D.pressaoPedida(w, 0) || D.pressionadorVisivel(w, 0) >= 0)) f = true;
      }
      if (perdeu >= 0 && perdeu <= V) { janela++; if (f) fant++; }
    }
  }
  return { casos: casosM, janela, fant, sementes };
}

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const pc = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`;
// erro-padrão da soma de uma grandeza por partida (as partidas são independentes): √(n · var) — só para mostrar se o
// resultado está dentro do sorteio (a decisão é a conta direta da meta)
function epSoma(v) { const n = v.length, mu = v.reduce((s, x) => s + x, 0) / n; return Math.sqrt(n * v.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, n - 1)); }
// M3 pela prova (ver o cabeçalho): Δ = a MÉDIA, caso a caso, de quanto o 2º companheiro mais perto está mais perto do condutor
// em 2 s com o botão (sem − com: os dois ramos de cada caso partem do mesmo mundo). O IC sai do bootstrap por PARTIDA (as
// partidas sorteadas com reposição — o par de ramos de cada caso vai junto, e os casos de uma partida também), com semente
// fixa (o resultado não muda de uma rodada para outra). p = fração das reamostras com Δ ≥ meta (percentil, unilateral): com
// p < 0,05 a amostra PROVA o Δ abaixo da meta. IC 90% = os percentis 5 e 95.
const M3_META = 1.5, M3_REAMOSTRAS = 4000;
function bootM3(grupos, meta, nB) {
  // (por partida só a soma das diferenças e o número de casos: a média de uma reamostra é Σ somas / Σ casos)
  const g = grupos.map(cs => [cs.reduce((t, c) => t + c.A.s2 - c.B.s2, 0), cs.length]);
  let s = 0x7001;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ds = [];
  for (let k = 0; k < nB; k++) {
    let a = 0, n = 0;
    for (let i = 0; i < g.length; i++) { const x = g[Math.floor(r() * g.length)]; a += x[0]; n += x[1]; }
    ds.push(n ? a / n : NaN);
  }
  // (reamostra sem caso nenhum = Δ indefinido: conta como meta não cumprida; só acontece com amostras minúsculas)
  const ok = ds.filter(Number.isFinite).sort((x, y) => x - y), q = f => ok[Math.min(ok.length - 1, Math.floor(f * ok.length))];
  return { p: ok.filter(d => d >= meta).length / nB, p05: q(0.05), p95: q(0.95) };
}
const mediaPareada = cs => (cs.length ? cs.reduce((t, c) => t + c.A.s2 - c.B.s2, 0) / cs.length : NaN);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, info = false) => { linhas.push([nome, medido, meta, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };

const h0 = casos.filter(c => c.h0).length;
reg('M0 os dois ramos começam bit a bit iguais', `${h0}/${casos.length}`, '100%', casos.length > 0 && h0 === casos.length);
const longo = c => (c.A.perdeu == null || c.A.perdeu >= 1.5) && (c.B.perdeu == null || c.B.perdeu >= 1.5) && c.d0 <= 12;
const L = casos.filter(longo);
const NMIN = 20;
const d15A = med(L.map(c => c.A.d15)), d15B = med(L.map(c => c.B.d15));
reg('M1 o mais perto: mediana da distância ao condutor em 1,5 s, sem → com o botão', `${fmt(d15A)} → ${fmt(d15B)} m (Δ ${fmt(d15A - d15B)}; n = ${L.length})`, 'com ≤ 2,0 m e Δ ≥ 0,5 m', L.length >= NMIN && d15B <= 2.0 && d15A - d15B >= 0.5);
// (D2, 24/10: o M2 conta os casos longos AO ALCANCE — o companheiro mais perto a ≤ M2_ALCANCE m no começo: do parado o
// corpo anda ~6,4 m em 1,5 s, + os 2 m. Com a IA conduzindo contra a pessoa, ela passou a ficar com a bola quando o
// companheiro mais perto da pessoa está longe — de 9 a 12 m, 27 → 145 casos em 16 partidas —, onde chegar em 1,5 s é quase
// impossível; por faixa de distância a taxa não mudou. O M2 de todos os casos longos segue impresso, informativo)
const M2_ALCANCE = 8.5;
const ok2 = c => c.B.t2 != null && c.B.t2 <= 1.5, ok2A = c => c.A.t2 != null && c.A.t2 <= 1.5;
const LA = L.filter(c => c.d0 <= M2_ALCANCE);
const c2 = LA.filter(ok2).length, c2A = LA.filter(ok2A).length;
const ep2 = LA.length ? Math.sqrt(c2 / LA.length * (1 - c2 / LA.length) / LA.length) : NaN;
reg(`M2 (guarda) com o botão: um companheiro a ≤ 2 m do condutor em ≤ 1,5 s (o mais perto a ≤ ${fmt(M2_ALCANCE, 1)} m no começo)`, `${pc(c2, LA.length)} (${fmt(100 * c2 / LA.length, 1)}% ± ${fmt(100 * ep2, 1)}; sem: ${pc(c2A, LA.length)})`, '≥ 60%', LA.length >= NMIN && c2 >= 0.6 * LA.length);
reg('(informativo) o M2 em todos os casos longos (o mais perto a ≤ 12 m)', `${pc(L.filter(ok2).length, L.length)} (sem: ${pc(L.filter(ok2A).length, L.length)})`, '—', true, true);
// (M3 pela PROVA, 01/11 — ver o cabeçalho: a média pareada caso a caso; reprova quando a amostra prova o Δ abaixo de 1,5 m.
// As medianas de cada ramo — a conta de antes — seguem impressas)
const L2p = porPartida.map(p => p.casos.filter(c => longo(c) && c.A.s2 != null && c.B.s2 != null));
const L2 = L2p.flat();
const s2A = med(L2.map(c => c.A.s2)), s2B = med(L2.map(c => c.B.s2)), d3 = mediaPareada(L2);
const b3 = bootM3(L2p, M3_META, M3_REAMOSTRAS);
reg('M3 um a mais na pressão: o 2º companheiro mais perto do condutor em 2 s, quanto mais perto com o botão (média por caso)', `Δ ${fmt(d3)} m (IC 90% ${fmt(b3.p05)}–${fmt(b3.p95)}; p = ${fmt(b3.p, 3)}; n = ${L2.length}; medianas sem → com ${fmt(s2A)} → ${fmt(s2B)} m)`, 'Δ ≥ 1,5 m (reprova com p < 0,05)', L2.length >= NMIN / 2 && b3.p >= 0.05);
const soma = (cs, f) => cs.reduce((s, c) => s + f(c), 0);
const fA = soma(casos, c => c.A.faltas), fB = soma(casos, c => c.B.faltas);
const ep4 = epSoma(porPartida.map(p => soma(p.casos, c => c.B.faltas - 1.5 * c.A.faltas)));
reg('M4 faltas do time 0 nos 2 s (todos os casos): sem → com o botão', `${fA} → ${fB} (com − 1,5 × sem − 2 = ${fmt(fB - 1.5 * fA - 2, 1)} ± ${fmt(ep4, 1)})`, 'com ≤ 1,5 × sem + 2', fB <= 1.5 * fA + 2);
// (o erro-padrão da fração dos ticks entre as partidas: os ticks de um mesmo lance não são independentes)
const co = soma(casos, c => c.B.corre1), ct = soma(casos, c => c.B.correTot1);
const ep5 = epSoma(porPartida.map(p => soma(p.casos, c => c.B.corre1 - (co / ct) * c.B.correTot1)));
reg('M5 escolhido a > 4 m do condutor, ≥ 1 s depois de escolhido, a ≥ vCorrida', `${pc(co, ct)} (${fmt(100 * co / ct, 1)}% ± ${fmt(100 * ep5 / ct, 1)})`, '≥ 80%', ct > 0 && co >= 0.8 * ct);
const mo = soma(casos, c => c.B.marcaOk), mt = soma(casos, c => c.B.marcaTot);
reg('M6 marca visível: o escolhido existe para o desenho com o pedido valendo', pc(mo, mt), '100%', mt > 0 && mo === mt);
const pd = soma(casos, c => c.B.p1Dobra), pt = soma(casos, c => c.B.p1Tot);
reg('M7 1º homem da IA já apertando: o botão chama OUTRO (dobra a marcação)', pt ? pc(pd, pt) : '— (sem o estado apertaProprio)', '≥ 95%', pt > 0 && pd >= 0.95 * pt);
// M8 o chamado contorna quem está no caminho (defesa.js desvio): trombadas dele em disparada com quem não é o condutor,
// por 100 casos (base 799ab53b: ~11)
const chq = soma(casos, c => c.B.choques);
reg('M8 o chamado contorna: trombadas em disparada com quem não é o condutor, por 100 casos', `${fmt(100 * chq / Math.max(1, casos.length), 1)} (${chq} em ${casos.length})`, '≤ 3', casos.length > 0 && 100 * chq / casos.length <= 3);
// M9–M11 (D1, 23/10): TODAS as posses, ramos de 3 s com o humano parado (pressao-pareada.mjs `tres`)
const T3 = casos.filter(c => c.t3), n3 = T3.length;
const g3 = k => soma(T3, c => c.t3[k].g);
const gA = g3('A3'), g1 = g3('P1'), gP = g3('P3');
// erro-padrão da diferença pareada P1 − A3 entre as partidas (os casos de uma partida não são independentes)
const ep9 = n3 ? epSoma(porPartida.map(p => soma(p.casos.filter(c => c.t3), c => c.t3.P1.g - c.t3.A3.g))) / n3 : NaN;
const d9 = n3 ? 100 * (g1 - gA) / n3 : NaN;
reg('M9 botão 1 s, humano parado: ganha a bola em 3 s, com − sem (todas as posses)', `${pc(gA, n3)} → ${pc(g1, n3)} (+${fmt(d9, 1)} pontos ± ${fmt(100 * ep9, 1)}; 3 s segurado: ${pc(gP, n3)})`, '≥ +6 pontos', n3 >= 200 && d9 >= 6);
const al = soma(T3, c => c.t3.P3.alc), li = soma(T3, c => c.t3.P3.lib);
reg('M10 bola ao alcance do chamado (sem estar por trás, sem o corpo entrar, fora do descanso): bote liberado', pc(li, al), '≥ 90% dos passos', al >= 100 && li >= 0.9 * al);
const tr = soma(T3, c => c.t3.P3.tr);
// (o erro-padrão da razão trocas/posses entre as partidas, como o do M5)
const ep11 = n3 ? epSoma(porPartida.map(p => soma(p.casos.filter(c => c.t3), c => c.t3.P3.tr - tr / n3))) / n3 : NaN;
reg('M11 trocas do chamado em 3 s segurado (a marca que pula de jogador), por posse', `${fmt(n3 ? tr / n3 : NaN, 2)} ± ${fmt(ep11, 2)} (${tr} em ${n3})`, '≤ 0,8', n3 >= 200 && tr / n3 <= 0.8);
// M12 a retomada pela MÃO do goleiro encerra o pedido (contraprova do D1, 24/10): toque de 1 passo no PRESSÃO com o
// adversário de posse → encaixe do goleiro do time 0 (as atribuições do goleiro.js aplicarDefesa: não passa por sim.js
// ganhouPosse) → o humano, no goleiro, solta a bola no chão (ENFIADA; C5) e passa de pé no adversário a 5 m → a bola
// perdida dentro da validade do toque. Sem o botão
// desde o toque, o pedido não volta a valer (pressaoPedida) nem chama ninguém (pressionadorVisivel). Antes da correção
// (defesa.js pressaoPedida sem m.possePorTime): todos voltavam (9 de 9 nas sementes 7001–7002, 7 de 7 nas 7101–7102)
const m12 = await retomadaPelaMao();
reg('M12 a retomada pela mão do goleiro encerra o pedido: o toque de antes não volta depois da reposição cortada',
  `${m12.fant} de ${m12.janela} reposições cortadas dentro da validade (${m12.casos} estados, sementes ${m12.sementes.join(', ')})`, '0, com ≥ 4 na janela', m12.janela >= 4 && m12.fant === 0);
// informativos
reg('(D1) todas as posses, humano parado, 3 s: roubadas do chamado (1 s · 3 s de botão) · faltas do time 0 (sem → 1 s → 3 s)',
  `${soma(T3, c => c.t3.P1.rb)} · ${soma(T3, c => c.t3.P3.rb)} · ${soma(T3, c => c.t3.A3.f)} → ${soma(T3, c => c.t3.P1.f)} → ${soma(T3, c => c.t3.P3.f)}`, '—', true, true);
reg('(D1, a C1) o CONTROLADO parado chega a ≤ 1 m do condutor em 3 s: sem → 1 s → 3 s de botão',
  `${pc(soma(T3, c => c.t3.A3.ct ?? 0), n3)} → ${pc(soma(T3, c => c.t3.P1.ct ?? 0), n3)} → ${pc(soma(T3, c => c.t3.P3.ct ?? 0), n3)}`, '—', true, true);
const d1A = med(L.map(c => c.A.d1)), d1B = med(L.map(c => c.B.d1));
reg('(diagnóstico) o mais perto em 1,0 s: sem → com', `${fmt(d1A)} → ${fmt(d1B)} m (Δ ${fmt(d1A - d1B)})`, 'Δ ≥ 2,0 m', true, true);
const bA = casos.filter(c => c.A.alcBote != null).length, bB = casos.filter(c => c.B.alcBote != null).length;
const lbA = L.filter(c => c.A.alcBote != null).length, lbB = L.filter(c => c.B.alcBote != null).length;
reg('(diagnóstico) bola ao alcance do bote em ≤ 2 s: todos · casos longos', `${pc(bA, casos.length)} → ${pc(bB, casos.length)} · ${pc(lbA, L.length)} → ${pc(lbB, L.length)}`, '—', true, true);
const c5 = soma(casos, c => c.B.corre), t5 = soma(casos, c => c.B.correTot);
reg('(diagnóstico) escolhido a > 4 m, ≥ 0,5 s depois de escolhido, a ≥ vCorrida', pc(c5, t5), '—', true, true);
for (const mod of MODELOS) {
  const Lm = L.filter(c => c.modelo === mod), Cm = casos.filter(c => c.modelo === mod);
  const r1 = Cm.filter(c => c.A.rouba).length, r2 = Cm.filter(c => c.B.rouba).length;
  reg(`humano '${mod}': d(1,5 s) sem → com · ≤ 2 m em ≤ 1,5 s · faltas · roubadas`, `${fmt(med(Lm.map(c => c.A.d15)))} → ${fmt(med(Lm.map(c => c.B.d15)))} m · ${pc(Lm.filter(c => c.B.t2 != null && c.B.t2 <= 1.5).length, Lm.length)} · ${soma(Cm, c => c.A.faltas)} → ${soma(Cm, c => c.B.faltas)} · ${r1} → ${r2} em ${Cm.length} casos`, '—', true, true);
}
// a conta direta de antes em blocos de 8 partidas (o que o teste de 8 partidas veria em cada conjunto)
if (porPartida.length >= 16) {
  const blocos = [];
  for (let b = 0; b + 8 <= porPartida.length; b += 8) {
    const cs = porPartida.slice(b, b + 8).flatMap(p => p.casos), Lb = cs.filter(longo);
    const m1 = med(Lb.map(c => c.A.d15)) - med(Lb.map(c => c.B.d15));
    const Lb2 = Lb.filter(c => c.d0 <= M2_ALCANCE), m2 = Lb2.filter(ok2).length / Lb2.length;
    const a4 = soma(cs, c => c.A.faltas), b4 = soma(cs, c => c.B.faltas);
    const m5 = soma(cs, c => c.B.corre1) / soma(cs, c => c.B.correTot1);
    const m3 = mediaPareada(Lb.filter(c => c.A.s2 != null && c.B.s2 != null));
    blocos.push(`${porPartida[b].s}: ${fmt(m1)} · ${Math.round(100 * m2)}% · ${fmt(m3)} · ${a4}→${b4} · ${fmt(100 * m5, 1)}%`);
  }
  reg('(dispersão) blocos de 8 partidas: M1 Δ · M2 · M3 Δ · M4 · M5 pela conta direta', blocos.join(' | '), '—', true, true);
}
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(`lógica: ${JS} · ${NP} partidas de 2 × ${MIN} min (sementes ${SEM0}–${SEM0 + NP - 1}, ${nPar} processos) · ${casos.length} casos · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-pressao-humano: REPROVOU (${falhas})` : '\nteste-pressao-humano: PASSOU');
process.exit(falhas ? 1 : 0);
