// Replays nas paradas (pedido do dono de 22/10: "os replays de faltas e jogadas passando na tela enquanto o jogo tá
// parado"; PLANO-CENAS.md §2.7; contrato "Cenas das paradas" no CONTRATOS.md): o classificador (js/lances.js) e o roteiro
// (render/replay-roteiro.js roteiroParada) em partidas IA × IA inteiras, com o anel gravado como o main.js e os replays
// "tocados" como a página toca (lib/paradas-node.mjs: o do gol na saída, o do impedimento no apito, o da parada no passo
// antes da montagem).
//   P1 gatilhos: um árbitro INDEPENDENTE escrito aqui (pelos eventos, pelas marcas do anel, pelas posições da bola e pela
//      CINEMÁTICA dela) classifica cada bola morta; o classificador bate 100% nas classes A (pênalti, vermelho, trave) e
//      ≥ 98% nas B (amarelo; falta onde o jogo monta a barreira — o árbitro olha o evento 'barreira' da montagem —;
//      espalmada; chute bloqueado por um adversário que vira escanteio — o árbitro acha o 1º contato pela bola que foge do
//      voo livre, não pelo 'bateuCorpo' que o classificador lê —; chute de dentro da área que passou perto ou que saiu em
//      tiro de meta: 28/10, SoccerNet-v2, js/lances.js REPLAY_PARADA; o de fora da área não, pelo orçamento do ar);
//      nenhum replay em bola morta sem lance;
//   P2 roteiro: ≤ 2 planos, ≤ 8,0 s, a chave dentro do P1, o P2 a 0,5×, os planos dentro do anel DE ONDE O ROTEIRO SAIU (o
//      que a página toca: lib/paradas-node.mjs espera.anel) sem atravessar corte; null com a chave fora do anel; P2b as
//      bordas num anel de mentira (também a chave perto do começo do anel);
//   P3 orçamento (28/10, decisão do dono): ≤ 3 replays de classe B por tempo; ≥ 30 s de bola rolando antes de cada um desde
//      o último replay automático (gol, impedimento ou parada; contado aqui, por fora); um por parada; ≤ 5 por partida (o
//      piso de 2 saiu: não tinha fonte); o ar em replay (gol + impedimento + paradas) entre 8% e 16% do tempo de jogo
//      (SoccerNet-v2: 13,3%) com os gols do real (2,3–3,5 por partida; os segundos de replay por gol medidos) — o medido
//      também ≤ 16% —, reprovando quando a amostra prova (abaixo); e a FIDELIDADE À TV POR SITUAÇÃO (TV_SIT abaixo) ≥ a da
//      versão publicada na mesma amostra (FID_MAIN; reprova quando a contagem prova);
//   P4 pureza: o hashMundo é o mesmo com e sem o classificador lendo cada passo, e ler o passo (lancesPasso,
//      montaNoProximoPasso) não muda o hash;
//   P5 predicado: montaNoProximoPasso(m) antes de cada passo bate 100% com o passo real (a parada montou — o cobrador saiu
//      de null — ou o tempo acabou), a cópia da regra do partida.js regrasPartida guardada contra mudanças nele.
// Na versão sem os replays de parada reprova (js/lances.js e roteiroParada não existem). (28/10) Com o classificador de
// antes (sem 'bloqueio' nem 'chuteFora', a falta perto a 25 m do ponto da falta; com este árbitro) reprova o P1 B (57/106
// no goleiro realista — o js de 0537a78f — e 120/146 na main de 28/10, sementes 1–48; 62/117 no goleiro realista em
// 201–248) e, no goleiro realista, a fidelidade do P3 (40,6% contra 57,6% da main em 1–48, z −3,30; 43,1% contra 61,3% em
// 201–248, z −3,59).
//   node tools/teste-replay-paradas.mjs [--js <pasta da lógica>] [--n 48] [--sem0 1] [--par 4] [--fid-main <% da versão
//        publicada na amostra>] [--json <arquivo: o resumo por partida>]
// (28/10) A amostra padrão é de 48 partidas: com 24 o veredito do P3 dependia da amostra — o goleiro realista passava o ar
// em 1–24 e reprovava em 25–48 (16,1%), e a versão sem as classes novas reprovava a fidelidade em 1–24 (z −3,17) e passava
// em 25–48 (z −1,19); a fidelidade da main ia de 51,1% a 67,6% nas 4 amostras de 24 (1–24, 25–48, 201–224, 225–248). Com
// 48, a fidelidade dá o mesmo veredito nas quatro amostras medidas (1–48, 201–248, 301–348, 401–448). ~10 min com --par 2
// (o dobro das 24).
// (28/10, decisão do dono: ficam os 16%) O AR EM REPLAY REPROVA QUANDO PROVA, a convenção do repositório para as metas
// medidas em amostra (a fidelidade deste teste, o passe certo do teste-intercepta, o C do teste-conducao-curta): o teto
// do intervalo (3,5 gols por partida) só reprova acima de 16% por mais de 1,645 erros-padrão entre partidas (z > 1,645,
// um lado), o piso (2,3 gols) só abaixo de 8% por mais de 1,645, e o medido como o teto; a meta não muda (a conta do
// erro e o piso dele no item). Por quê: nas 4 amostras de 48 o goleiro realista dá o teto 15,52 / 15,52 / 16,07 /
// 16,07% (1–48, 201–248, 301–348, 401–448; erro-padrão 0,35 / 0,31 / 0,32 / 0,38) e a main de 28/10 15,61 / 15,91 /
// 15,69 / 15,70% (~0,30): as duas na borda, e a comparação pontual reprovava por sorteio — a branch em 2 das 4 (z +0,22
// e +0,18); a main, com a média das 4 (15,73%), passa de 16% em ~1 de 5 amostras de 48 (e já reprovou com 24 partidas,
// 16,3% em 101–124). Em 401–448 o excesso da branch nem vem das paradas (2,45% do tempo × 2,62% da main): vem do
// impedimento (1,94 × 1,61%) e do replay do gol (17,28 × 17,00 s por gol) — o goleiro realista muda a partida. Cortar
// os replays de parada (8 → 7 s) passaria raspando, mas encurta o que a TV mostra (mediana 9,5 s por parada com replay
// no SoccerNet-v2): não é o caminho.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

// ------------------------------------------------------------------ o filho: uma semente
if (args.includes('--filho')) {
  const { criarSimParadas } = await import(pathToFileURL(path.join(AQUI, 'lib/paradas-node.mjs')).href);
  const P = await criarSimParadas(JS);
  const { CAMPO, PASSO, BARREIRA } = await imp('config.js');
  const { hashMundo } = await imp('sim.js');
  const { marcasDoPasso } = await imp('render/replay-anel.js');
  const BOLA = await imp('bola.js');
  const s = +arg('--s', 1);
  process.send(rodarSemente(P, { CAMPO, PASSO, BARREIRA, BOLA, hashMundo, marcasDoPasso }, s, args.includes('--p4')));
  process.exit(0);
}

const tipoA = new Set(['penalti', 'vermelho', 'trave']);

// (28/10) A TV por SITUAÇÃO — a fração das paradas com um plano de replay entre o lance que parou a bola e o recomeço
// (SoccerNet-v2, rótulos públicos SoccerNet/SN-Labels: Labels-v2 + Labels-cameras, 498 jogos da EPL, LaLiga, Serie A,
// Bundesliga, Ligue 1 e Champions; o replay em [apito − 1 s, recomeço + 1 s); sem gol nem impedimento;
// PESQUISA-CENAS-TV.md §4 "Por situação"; tools/pesquisa/soccernet_situacao.py). A situação é o recomeço e o que veio
// antes dele: CARTÃO entre o apito e o recomeço; senão CHUTE (no alvo ou fora) nos 15 s antes do apito; senão nada. O
// tiro livre de todas as causas (falta ou bola fora). Pela taxa média de cada recomeço só (a 1ª conta) a TV ficava 15–25
// pontos otimista: no jogo quase todo escanteio e a maioria dos tiros de meta vêm de um chute (main, 1–48: 95 de 101 e 59
// de 83; a TV repete 72,5% e 69,0% deles, e 30,6% e 36,5% dos outros). O tiro livre "direto" do SoccerNet é o "with the
// intention to score or if the other team forms a wall" (material suplementar, §7.1): aqui o direto até BARREIRA.longe do
// gol (onde o jogo monta a barreira); o resto vai como indireto.
//              [cartão,  chute nos 15 s, nada]      n (cartão / chute / nada) no SoccerNet-v2
const TV_SIT = {
  lateral:    [0.298, 0.281, 0.060],  //     57 /   541 / 18209
  escanteio:  [0.478, 0.725, 0.306],  //     23 /  1434 /  3335
  tiroDeMeta: [0.691, 0.690, 0.365],  //     68 /  3742 /  3908
  tiroLivreD: [0.964, 0.793, 0.670],  //    523 /    29 /  1614
  tiroLivreI: [0.875, 0.604, 0.371],  //   1087 /   187 /  7342
  penalti:    [0.975, 0.975, 0.975],  //    160 (todos)
};
const CEL_SIT = ['cartão', 'chute nos 15 s', 'nada'];
/** A situação da bola morta q (do filho) para a fidelidade: {chave, p (a taxa da TV)}; null fora da conta. */
function situacaoTV(q, longe) {
  if (q.imped || q.parada === 'saida') return null;
  const k = q.parada === 'tiroLivre' ? (q.direto && q.dist <= longe ? 'tiroLivreD' : 'tiroLivreI') : q.parada;
  const t = TV_SIT[k];
  if (!t) return null;
  const c = q.cartao ? 0 : q.chute15 ? 1 : 2;
  return { chave: `${k} | ${CEL_SIT[c]}`, p: t[c] };
}
// A amostra padrão do teste (o CI) e a fidelidade da VERSÃO PUBLICADA nela, pela MESMA conta (o js publicado com este
// teste: node tools/teste-replay-paradas.mjs --js <publicada>/js). É a régua do "sem recuo" do dono — o PR seguinte não
// pode cair abaixo dela com prova — e, como o hash de referência, é a da versão publicada: atualizada a cada entrega que
// mude a partida. O goleiro realista (C1) entrou com 66,01% (91 replays de parada de 137,85 da TV em 286 bolas mortas; ep
// entre partidas 3,9 pontos) contra 57,56% da main de 28/10 (500c4b1a: 97 de 168,5 em 329; z +1,65). Outra amostra:
// --fid-main <a da versão publicada nela> — o C1: 70,13% nas 201–248 (101 de 144,0; a main 61,31%, z +1,74), 70,55% nas
// 301–348 (115 de 163,0; a main 58,72%, z +2,52) e 62,02% nas 401–448 (92 de 148,3; a main 54,33%, z +1,57). (28/10) No CI
// DESTE PR o z dá ~0 (a régua já é a própria versão nova: a branch contra ela mesma); a prova contra a main de 28/10 é a
// das medições registradas aqui e no PLANO-CENAS.md §2.7 (as 4 amostras com --fid-main da main de cada uma).
const N_PADRAO = 48, S0_PADRAO = 1;
const FID_MAIN = 0.6601;

/** O árbitro independente: a bola morta classificada pelo que aconteceu desde a anterior. */
function criarArbitro(K) {
  const { CAMPO, BOLA } = K;
  const MX = CAMPO.meioX, AU = MX - CAMPO.area.profundidade, AZ = CAMPO.area.largura / 2;
  const RP = CAMPO.gol.raioPoste, ZP = CAMPO.gol.largura / 2 + RP, YT = CAMPO.gol.altura + RP;
  const R = { chutes: [], traves: [], defesas: [], faltas: [], bolas: [] };
  const zerar = () => { R.chutes.length = 0; R.traves.length = 0; R.defesas.length = 0; R.faltas.length = 0; };
  let bAnt = null;   // a bola depois do passo anterior (cópia)
  // distância do ponto (z, y) da linha de fundo aos eixos dos postes e do travessão (por amostragem: outra conta)
  function distArmacao(z, y) {
    let d = Infinity;
    for (let k = 0; k <= 200; k++) {
      const yy = YT * k / 200;
      d = Math.min(d, Math.hypot(Math.abs(z) - ZP, y - yy));
      const zz = -ZP + 2 * ZP * k / 200;
      d = Math.min(d, Math.hypot(z - zz, y - YT));
    }
    return d;
  }
  // O 1º contato de alguém com a bola depois do chute, pela CINEMÁTICA (28/10; o classificador lê o evento 'bateuCorpo',
  // o árbitro não): no passo do chute, a bola sai fora do rumo do pé (cond.ult; > 0,001 rad — nas sementes 1–24, 171 de
  // 193 chutes ficam a < 0,0001 rad dele e os outros 22 a ≥ 0,002, entre eles os 10 com a perna no caminho que viraram bola
  // morta em 4 s) ou mais lenta que o chute (< 0,98); depois dele, a bola foge do voo livre (o passoBola numa cópia da
  // bola do passo anterior — a trave, a rede e as placas estão nele: sem ninguém, a mesma conta dá a mesma bola). Quem
  // tocou é o jogador mais perto dela (fora quem chutou nos 10 passos do pé dele), a ≤ 1,2 m (o alcance da perna esticada
  // com folga); sem ninguém ali o desvio não é toque (a bola que quica no passo do chute perde velocidade) e a busca segue.
  function contato(m, c) {
    const t = m.tick, b = m.bola;
    let tocou = false;
    if (c.t === t) {
      if (c.dir) {
        const vh = Math.hypot(b.v.x, b.v.z), v3 = Math.hypot(b.v.x, b.v.y, b.v.z);
        const cosA = vh > 1e-6 ? (b.v.x * c.dir.dx + b.v.z * c.dir.dz) / vh : 1;
        tocou = v3 < 0.98 * c.v || Math.acos(Math.max(-1, Math.min(1, cosA))) > 0.001;
      }
    } else if (bAnt) {
      const pr = BOLA.copiarBola(bAnt);
      BOLA.passoBola(pr, []);
      tocou = Math.hypot(b.v.x - pr.v.x, b.v.y - pr.v.y, b.v.z - pr.v.z) > 0.05;
    }
    if (!tocou) return null;
    let q = null, dq = Infinity;
    for (const j of m.jogadores) {
      if (j.id === c.id && t - c.t <= 10) continue;
      const d = Math.hypot(j.x - b.p.x, j.z - b.p.z);
      if (d < dq) { dq = d; q = j; }
    }
    if (!q || dq > 1.2) return null;
    return { t, id: q.id, time: q.time, gol: q.posicao === 'GOL', d: dq, y: b.p.y, posse: m.posse, naMao: m.naMao };
  }
  function passo(m, ev) {
    const t = m.tick, b = m.bola.p;
    R.bolas.push({ t, x: b.x, y: b.y, z: b.z });
    if (R.bolas.length > 600) R.bolas.shift();
    const chute = marcas => (marcas & 1) !== 0;
    if (chute(K.marcasDoPasso(ev, m.voo))) {
      const e = ev.find(x => x.tipo === 'chute' || x.tipo === 'cabeceio');
      const j = m.jogadores.find(q => q.id === e.id);
      if (j) {
        const lado = m.ataca[j.time] >= 0 ? 1 : -1;
        const v = e.tipo === 'chute' ? (e.v ?? 0) : Math.hypot(m.bola.v.x, m.bola.v.y, m.bola.v.z);
        // (o pé bate no tick do passo e o passo termina com m.tick + 1: sim.js)
        const u = e.tipo === 'chute' && j.cond && j.cond.ult && j.cond.ult.tick >= t - 1 ? j.cond.ult : null;
        R.chutes.push({ t, id: j.id, time: j.time, v, x: j.x, z: j.z, lado, area: j.x * lado >= AU && Math.abs(j.z) <= AZ,
          dir: u ? { dx: u.dx, dz: u.dz } : null, contato: null });
      }
    }
    const c = R.chutes.length ? R.chutes[R.chutes.length - 1] : null;
    if (c && !c.contato && t - c.t <= 300) c.contato = contato(m, c);
    bAnt = K.BOLA.copiarBola(m.bola);
    for (const e of ev) {
      // a trave só conta com a bola viva (ou morta neste passo): depois do apito ela não é lance
      if (e.tipo === 'trave') { if (m.partida.estado === 'jogo' || (m.parada && m.parada.inicio === t)) R.traves.push({ t, x: b.x }); }
      else if (e.tipo === 'defesa') R.defesas.push({ t, modo: e.modo, id: e.id });
      else if (e.tipo === 'falta') R.faltas.push({ t, def: e.def, time: e.time, x: e.x, z: e.z });
    }
  }
  /**
   * Bola morta neste passo: {r (o lance mais forte, sem a falta perto), falta (tiro livre direto com a falta de quem
   * cobra e nada mais forte: vira 'faltaPerto' se o jogo montar a barreira), geo (a conta da barreira daqui: ≤
   * BARREIRA.longe m do gol)}.
   */
  function classificar(m, ev) {
    const pr = m.parada, t = m.tick, J = 240;
    let r = null, falta = false, geo = false, dbg = null;
    const cartoes = ev.filter(e => e.tipo === 'cartao');
    const faltaDe = id => [...R.faltas].reverse().find(f => f.def === id);
    if (ev.some(e => e.tipo === 'impedimento')) r = null;
    else if (ev.some(e => e.tipo === 'penaltiMarcado') && pr.tipo === 'penalti' && R.faltas.some(f => f.time === pr.time)) r = 'penalti';
    else if (cartoes.some(c => c.cor === 'vermelho' && faltaDe(c.id))) r = 'vermelho';
    else if (R.traves.length && t - R.traves[R.traves.length - 1].t <= J) r = 'trave';
    else if (cartoes.some(c => c.cor === 'amarelo' && !c.segundo && faltaDe(c.id))) r = 'amarelo';
    else {
      if (pr.tipo === 'tiroLivre' && pr.direto && R.faltas.some(q => q.time === pr.time)) {
        falta = true;
        const lado = m.ataca[pr.time] >= 0 ? 1 : -1;
        geo = Math.hypot(lado * MX - pr.x, pr.z) <= K.BARREIRA.longe;
      }
      if (R.chutes.length) {
        const c = R.chutes[R.chutes.length - 1];
        const depois = R.defesas.filter(d => d.t >= c.t);
        const esp = depois.find(d => d.modo === 'espalmada');
        const segura = depois.some(d => d.modo !== 'espalmada');
        const k = c.contato && c.contato.t <= t ? c.contato : null;
        // alguém (que não o goleiro defendendo) tocou na bola antes da defesa
        const antes = !!k && (!esp || k.t < esp.t);
        const crit = c.area || c.v >= 22;
        dbg = { chute: c.t, id: c.id, time: c.time, area: c.area, v: +c.v.toFixed(1), dir: !!c.dir, esp: esp ? esp.t : null, segura, k };
        if (t - c.t <= J && !segura) {
          if (!antes && esp && crit) r = 'espalmada';
          else if (antes) {
            // o bloqueio: um adversário de linha (também o da barreira) na altura do corpo, sem dominar, e a bola em escanteio
            if (k.time !== c.time && !k.gol && k.y <= 1.0 && k.posse == null && k.naMao == null
              && pr.tipo === 'escanteio' && crit) r = 'bloqueio';
          } else if (!esp && c.area) {
            // onde a bola cruzou a linha de fundo atacada depois do chute (passou perto e chute fora: só o de dentro da
            // área — 28/10, o orçamento do ar; js/lances.js REPLAY_PARADA)
            const bs = R.bolas.filter(q => q.t >= c.t);
            for (let kk = 1; kk < bs.length; kk++) {
              const u0 = bs[kk - 1].x * c.lado, u1 = bs[kk].x * c.lado;
              if (bs[kk].t > c.t && u0 < MX && u1 >= MX) {
                const a = (MX - u0) / (u1 - u0);
                const zc = bs[kk - 1].z + (bs[kk].z - bs[kk - 1].z) * a, yc = bs[kk - 1].y + (bs[kk].y - bs[kk - 1].y) * a;
                if (distArmacao(zc, yc) <= 1.5 + 0.02) r = 'passouPerto';
                else if (pr.tipo === 'tiroDeMeta') r = 'chuteFora';
                break;
              }
            }
          }
        }
      }
    }
    zerar();
    return { r, falta, geo, dbg };
  }
  return { passo, classificar, zerar };
}

function rodarSemente(P, K, s, comP4) {
  // (28/10) dGol/dImp: a duração de cada replay de gol e de impedimento (o piso do erro-padrão do ar no P3)
  const out = { s, mortas: [], esperas: [], p2: [], p3: [], durGol: 0, nGol: 0, durImp: 0, durPar: 0, dGol: [], dImp: [], ticks: 0, jogo: 0,
    p5: { n: 0, erros: [] }, p4: null, porTempoB: [0, 0], duplas: 0, barreira: { n: 0, difs: [] } };
  const S = P.novaPartida(s);
  const A = criarArbitro(K);
  let rolando = 1e9;
  const rolandoNaMorta = new Map();
  const esperaPorMorta = new Set();
  // o tiro livre direto esperando a montagem: o árbitro decide a falta perto pelo evento 'barreira' dela
  let pendFalta = null;
  // (28/10) o tick do último chute (ou cabeceio para o gol: replay-anel.js marcasDoPasso) — a SITUAÇÃO da bola morta para
  // a fidelidade à TV do P3 (o chute nos 15 s antes dela)
  let ultChute = -1e9;
  for (let i = 0; i < 40000 && S.m.partida.estado !== 'fim'; i++) {
    const m = S.m;
    // antes do passo: o estado para o P5
    const pr0 = m.parada, cob0 = pr0 ? pr0.cobrador : null, est0 = m.partida.estado;
    const r = P.passo(S);
    const ev = r.ev;
    if (K.marcasDoPasso(ev, m.voo) & 1) ultChute = m.tick;
    // P5: o predicado (calculado antes do passo pela harness) × o que o passo fez
    if (est0 === 'parada' && pr0 && cob0 == null) {
      const acabou = ev.some(e => e.tipo === 'intervalo' || e.tipo === 'fimDeJogo');
      const montou = !acabou && m.parada === pr0 && pr0.cobrador != null;
      const real = acabou ? 'fimDoTempo' : montou ? 'monta' : false;
      if (pendFalta && pendFalta.inicio === pr0.inicio && montou) {
        const q = pendFalta.rec, barr = ev.some(e => e.tipo === 'barreira');
        out.barreira.n++;
        if (barr !== q.geo) out.barreira.difs.push(`tick ${q.tick}: conta ${q.geo}, montou ${barr}`);
        q.ref = barr ? 'faltaPerto' : q.refChance;
        pendFalta = null;
      }
      out.p5.n++;
      if ((r.pred || false) !== real && out.p5.erros.length < 5) out.p5.erros.push(`tick ${m.tick}: previu ${r.pred}, foi ${real}`);
      else if ((r.pred || false) !== real) out.p5.erros.push('…');
    }
    // o replay de parada que começou ANTES deste passo; os limites do anel são os do momento do roteiro (e.anel: o passo
    // de depois já gravou mais um — lib/paradas-node.mjs, 28/10); os cortes, do anel de agora (o mesmo de q.de + 1 em diante)
    if (r.espera) {
      const e = r.espera, l = e.lance, ro = e.roteiro, a = S.a, an = e.anel ?? a;
      if (esperaPorMorta.has(l.morta)) out.duplas++;
      esperaPorMorta.add(l.morta);
      out.durPar += e.dur;
      const pl = ro.planos;
      const falhas = [];
      if (pl.length < 1 || pl.length > 2) falhas.push(`${pl.length} planos`);
      if (e.dur > 8.0 + 1e-6) falhas.push(`${e.dur.toFixed(2)} s`);
      if (!(pl[0].de <= l.chave && l.chave <= pl[0].ate)) falhas.push(`chave ${l.chave} fora do P1 [${pl[0].de}, ${pl[0].ate}]`);
      if (pl[1] && Math.abs(pl[1].vel - 0.5) > 1e-9) falhas.push(`P2 a ${pl[1].vel}×`);
      for (const q of pl) {
        if (q.de < an.primeiro || q.ate > an.ultimo || q.ate <= q.de) falhas.push(`plano [${q.de}, ${q.ate}] fora do anel [${an.primeiro}, ${an.ultimo}]`);
        else if (a.primeiroCorte(q.de + 1, q.ate) != null) falhas.push(`plano [${q.de}, ${q.ate}] atravessa o corte ${a.primeiroCorte(q.de + 1, q.ate)}`);
        if (l.ateMax != null && q.ate > l.ateMax) falhas.push(`plano até ${q.ate} > ateMax ${l.ateMax}`);
      }
      if (P.RR.roteiroParada(a, { ...l, chave: a.primeiro - 5 }) !== null) falhas.push('chave fora do anel não deu null');
      if (P.RR.roteiroParada(a, { ...l, chave: -1 }) !== null) falhas.push('chave −1 não deu null');
      out.p2.push({ tick: e.tick, tipo: l.tipo, cams: pl.map(q => q.cam), dur: e.dur, falhas });
      if (l.classe === 'B') {
        const tt = m.partida.tempo === 2 ? 1 : 0;
        out.porTempoB[tt]++;
        const rol = rolandoNaMorta.get(l.morta);
        out.p3.push({ tick: e.tick, tipo: l.tipo, rolando: rol ?? -1 });
      }
      out.esperas.push({ tick: e.tick, morta: l.morta, tipo: l.tipo, classe: l.classe, dur: e.dur, cams: pl.map(q => q.cam) });
      rolando = 0;
    }
    if (r.gol) { out.durGol += r.gol.dur; out.nGol++; out.dGol.push(r.gol.dur); rolando = 0; }
    if (r.imped) { out.durImp += r.imped.dur; out.dImp.push(r.imped.dur); rolando = 0; }
    // o árbitro independente
    A.passo(m, ev);
    const p = m.partida;
    if (p.estado === 'jogo') { rolando++; out.jogo++; }
    if (ev.some(e => e.tipo === 'gol' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) A.zerar();
    const pr = m.parada;
    if (p.estado === 'parada' && pr && pr.inicio === m.tick && pr.cobrador == null && !ev.some(e => e.tipo === 'gol')) {
      const a = A.classificar(m, ev);
      rolandoNaMorta.set(m.tick, rolando);
      const lado = m.ataca[pr.time] >= 0 ? 1 : -1;
      const q = { tick: m.tick, parada: pr.tipo, direto: !!pr.direto, dist: Math.hypot(lado * K.CAMPO.meioX - pr.x, pr.z),
        imped: ev.some(e => e.tipo === 'impedimento'), ref: a.falta && a.geo ? 'faltaPerto' : a.r, refChance: a.r, geo: a.geo,
        got: r.lance ? r.lance.tipo : null, aceito: r.aceito, dbg: a.dbg,
        // a situação (P3 fidelidade): cartão nesta bola morta (os guardados da vantagem também saem aqui: partida.js
        // bolaMorta) e chute nos 15 s antes dela
        cartao: ev.some(e => e.tipo === 'cartao'), chute15: m.tick - ultChute <= 15 * 60 };
      out.mortas.push(q);
      pendFalta = a.falta ? { inicio: pr.inicio, rec: q } : null;
    }
    out.ticks++;
  }
  if (comP4) out.p4 = pureza(P, K, s);
  return out;
}

/** P4: a mesma semente com e sem o classificador; e o hash antes = depois de ler cada passo. */
function pureza(P, K, s) {
  const n = 9000;
  const S1 = P.novaPartida(s, { lances: false, ligado: false }), S2 = P.novaPartida(s, { lances: false, ligado: false });
  const L = P.LA.criarLances();
  let difer = -1, escreve = -1;
  for (let i = 0; i < n; i++) {
    P.GR.passo(S1);
    const ev = P.GR.passo(S2);
    const h0 = K.hashMundo(S2.m);
    P.LA.lancesPasso(L, S2.m, ev);
    P.LA.montaNoProximoPasso(S2.m);
    if (K.hashMundo(S2.m) !== h0 && escreve < 0) escreve = S2.m.tick;
    if (i % 60 === 0 && K.hashMundo(S1.m) !== K.hashMundo(S2.m) && difer < 0) difer = S2.m.tick;
  }
  if (K.hashMundo(S1.m) !== K.hashMundo(S2.m) && difer < 0) difer = S2.m.tick;
  return { n, difer, escreve };
}

// ------------------------------------------------------------------ o pai
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fimTeste = () => { console.log(tabelaTexto(linhas)); console.log(`\nteste-replay-paradas: ${falhas ? 'REPROVOU' : 'PASSOU'}`); process.exit(falhas ? 1 : 0); };

let temModulo = fs.existsSync(path.join(JS, 'lances.js'));
if (temModulo) { const RR = await imp('render/replay-roteiro.js'); temModulo = typeof RR.roteiroParada === 'function'; }
if (!temModulo) {
  for (const k of ['P1 gatilhos', 'P2 roteiro', 'P3 orçamento', 'P5 predicado'])
    reg(k, 'js/lances.js ou roteiroParada não existe nesta versão', 'existe', false);
  fimTeste();
}

const N = +arg('--n', N_PADRAO), S0 = +arg('--sem0', S0_PADRAO);
const PADRAO = N === N_PADRAO && S0 === S0_PADRAO;
const SEMENTES = Array.from({ length: N }, (_, k) => S0 + k);
const P4 = new Set([S0, S0 + 1]);
const nPar = Math.max(1, Math.min(N, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length))));
const t0 = Date.now();
const res = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', '--js', JS, '--s', String(s), ...(P4.has(s) ? ['--p4'] : [])]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
res.sort((a, b) => a.s - b.s);
console.log(`lógica: ${JS}\n${N} partidas IA × IA (sementes ${S0}–${S0 + N - 1}), ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`);

// P1
const mortas = res.flatMap(r => r.mortas.map(q => ({ ...q, s: r.s })));
const ehA = t => tipoA.has(t);
const emA = mortas.filter(q => ehA(q.ref) || ehA(q.got)), emB = mortas.filter(q => (q.ref && !ehA(q.ref)) || (q.got && !ehA(q.got)));
const okA = emA.filter(q => q.ref === q.got).length, okB = emB.filter(q => q.ref === q.got).length;
const difs = mortas.filter(q => q.ref !== q.got);
const semLance = res.flatMap(r => r.esperas).filter(e => !e.tipo).length;
const porTipo = {};
for (const q of mortas) if (q.got) porTipo[q.got] = (porTipo[q.got] ?? 0) + 1;
const pctA = emA.length ? 100 * okA / emA.length : 100, pctB = emB.length ? 100 * okB / emB.length : 100;
reg('P1 classes A (pênalti, vermelho, trave) = o árbitro independente', `${okA}/${emA.length} (${pctA.toFixed(1).replace('.', ',')}%)`, '100%', pctA === 100);
const barrN = res.reduce((a, r) => a + r.barreira.n, 0), barrD = res.flatMap(r => r.barreira.difs.map(d => `s${r.s} ${d}`));
reg('P1 classes B (amarelo, falta perto, espalmada, bloqueio, passou perto, chute fora) = o árbitro', `${okB}/${emB.length} (${pctB.toFixed(1).replace('.', ',')}%)${difs.length ? '; ex.: s' + difs[0].s + ' t' + difs[0].tick + ' ' + difs[0].parada + ' árbitro ' + difs[0].ref + ' × ' + difs[0].got : ''}; barreira montada = a conta em ${barrN - barrD.length}/${barrN}${barrD.length ? ' (' + barrD[0] + ')' : ''}`,
  '≥ 98%; todas', pctB >= 98 && emB.length > 0 && barrD.length === 0);
// as diferenças (até 12), para achar quem errou
if (difs.length) for (const q of difs.slice(0, 12)) console.log(`DIF s${q.s} t${q.tick} ${q.parada}: árbitro ${q.ref} × classificador ${q.got} ${JSON.stringify(q.dbg, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(3) : v))}`);
reg('P1 nenhum replay sem lance; lances por tipo', `${semLance} sem lance; ${Object.entries(porTipo).map(([k, v]) => k + ' ' + v).join(', ')} em ${mortas.length} bolas mortas`, '0', semLance === 0);

// P2
const p2 = res.flatMap(r => r.p2.map(q => ({ ...q, s: r.s })));
const p2ruins = p2.filter(q => q.falhas.length);
const durMax = Math.max(0, ...p2.map(q => q.dur));
const cams = {};
for (const q of p2) { const k = q.cams.join('+'); cams[k] = (cams[k] ?? 0) + 1; }
reg('P2 roteiro: ≤ 2 planos, ≤ 8,0 s, chave no P1, P2 a 0,5×, dentro do anel sem corte, null fora dele',
  `${p2.length} roteiros; ${p2ruins.length} ruins${p2ruins.length ? ' (s' + p2ruins[0].s + ': ' + p2ruins[0].falhas[0] + ')' : ''}; máx ${durMax.toFixed(2).replace('.', ',')} s; ${Object.entries(cams).map(([k, v]) => k + ' ' + v).join(', ')}`,
  '0 ruins', p2.length > 0 && p2ruins.length === 0);

// P2b: casos de borda num anel de mentira (2001 passos, sem corte)
{
  const RR = await imp('render/replay-roteiro.js');
  const { REPLAY_PARADA: R } = await imp('lances.js');
  const anelF = { primeiro: 0, ultimo: 2000, slot: t => (t >= 0 && t <= 2000 ? t : -1), primeiroCorte: () => null, ultimoCorte: () => null };
  const dur = ro => ro.planos.reduce((a, q) => a + (q.ate - q.de) / 60 / q.vel, 0);
  const ruins = [];
  // (a) a chance com o desfecho longe (o P2 não cabe): o P1 sozinho começa em chave − tv.antes, ≤ máximo
  for (const D of [60, 100, 115, 140, 200, 240]) {
    const ro = RR.roteiroParada(anelF, { tipo: 'trave', classe: 'A', chave: 1000, fim: 1000 + D, x: 50, z: 2, lado: 1 });
    if (!ro || dur(ro) > R.maximo + 1e-9) ruins.push(`trave D=${D}: ${ro ? dur(ro).toFixed(2) + ' s' : 'null'}`);
    else if (ro.planos.length === 1 && ro.planos[0].de !== 1000 - Math.round(R.tv.antes * 60)) ruins.push(`trave D=${D}: só o P1, começando em ${ro.planos[0].de} (e não em ${1000 - Math.round(R.tv.antes * 60)})`);
  }
  // (b) o vermelho com a falta no passo da bola morta (o replay acaba no contato): P1 até a chave, P2 'fechada' com a
  // aproximação inteira (antes + depois) antes dela
  const rv = RR.roteiroParada(anelF, { tipo: 'vermelho', classe: 'A', chave: 1000, fim: 1000, ateMax: 1000, x: 30, z: 5, lado: 1 });
  const lento = Math.round((R.lento.antes + R.lento.depois) * 60);
  if (!rv || rv.planos.length !== 2 || rv.planos[0].ate !== 1000 || rv.planos[1].cam !== 'fechada' || rv.planos[1].de !== 1000 - lento || rv.planos[1].ate !== 1000)
    ruins.push(`vermelho no contato: ${JSON.stringify(rv?.planos ?? null)}`);
  // (c) (28/10) a chave a menos de tv.antes s do 1º passo do anel (o amarelo dado na bola morta depois da vantagem: a falta
  // ficou ~9 s antes do replay; main, s207): o P1 começa NO 1º passo do anel, nem antes nem depois, e nada sai dele
  for (const k of [0, 1, 60, 149, 150, 151]) {
    const ro = RR.roteiroParada(anelF, { tipo: 'amarelo', classe: 'B', chave: k, fim: k, x: 30, z: 5, lado: 1 });
    const de0 = Math.max(anelF.primeiro, k - Math.round(R.tv.antes * 60));
    if (!ro || ro.planos[0].de !== de0 || ro.planos.some(q => q.de < anelF.primeiro || q.ate > anelF.ultimo || q.ate <= q.de))
      ruins.push(`amarelo com a chave em ${k} (o anel começa em ${anelF.primeiro}): ${JSON.stringify(ro?.planos ?? null)}`);
  }
  reg('P2b bordas (anel de mentira): o P1 inteiro quando o P2 sai; o vermelho acaba no contato com o lento inteiro; a chave perto do começo do anel',
    `${ruins.length} ruins${ruins.length ? ' (' + ruins[0] + ')' : ''}`, '0', ruins.length === 0);
}

// P3
const tetoRuim = res.filter(r => r.porTempoB[0] > 3 || r.porTempoB[1] > 3);
const espacoRuim = res.flatMap(r => r.p3.map(q => ({ ...q, s: r.s }))).filter(q => q.rolando < 30 * 60);
const duplas = res.reduce((a, r) => a + r.duplas, 0);
reg('P3 ≤ 3 de classe B por tempo; ≥ 30 s de bola rolando antes de cada um; um por parada',
  `${tetoRuim.length} tempos acima do teto; ${espacoRuim.length} sem o espaço${espacoRuim.length ? ' (s' + espacoRuim[0].s + ' t' + espacoRuim[0].tick + ': ' + (espacoRuim[0].rolando / 60).toFixed(1).replace('.', ',') + ' s)' : ''}; ${duplas} paradas com 2`,
  '0; 0; 0', tetoRuim.length === 0 && espacoRuim.length === 0 && duplas === 0);
const nEsp = res.reduce((a, r) => a + r.esperas.length, 0), media = nEsp / res.length;
// (28/10, decisão do dono: o piso de 2 por partida saiu — não tinha fonte; fica o teto e, no lugar do piso, a fidelidade à TV
// abaixo, que não pode ficar abaixo da da versão publicada)
reg('P3 replays de parada por partida (média)', `${media.toFixed(2).replace('.', ',')} (${nEsp} em ${res.length})`, '≤ 5', media <= 5);
const ar = res.reduce((a, r) => a + r.durGol + r.durImp + r.durPar, 0), jogoS = res.reduce((a, r) => a + r.ticks, 0) / 60;
const fat = 100 * ar / jogoS;
const pPar = 100 * res.reduce((a, r) => a + r.durPar, 0) / jogoS;
// o replay do gol acompanha os gols da amostra (24 partidas: ±1,3 por partida só de sorteio, e a IA de hoje marca abaixo do
// real): a meta vale com os gols do real (2,3–3,5 por partida, a meta do painel) e os segundos de replay por gol medidos
const nGol = res.reduce((a, r) => a + r.nGol, 0), segGol = nGol ? res.reduce((a, r) => a + r.durGol, 0) / nGol : NaN;
const semGol = res.reduce((a, r) => a + r.durImp + r.durPar, 0);
const arCom = g => 100 * (semGol + segGol * g * res.length) / jogoS, [arLo, arHi] = [arCom(2.3), arCom(3.5)];
const f1 = v => v.toFixed(1).replace('.', ','), f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—');
// (28/10, decisão do dono: ficam os 16%) O ar REPROVA QUANDO PROVA (o porquê, com as 4 amostras de 48, no cabeçalho): o
// teto (3,5 gols por partida) com z > 1,645, o piso (2,3) com z < −1,645, o medido como o teto. O erro-padrão é o ENTRE
// PARTIDAS (cada partida um conglomerado; a linearização de Taylor do estimador de razão, como a fidelidade — Cochran
// 1977, cap. 6): com a_i os segundos de replay de impedimento + parada, g_i/n_i os do gol e os gols, t_i o tempo e s =
// Σg ÷ Σn, a parte da partida i no teto com c gols é u_i = (a_i + c·s + c·k·(g_i − s·n_i)/Σn − H·t_i) ÷ Σt e o ep =
// √(k/(k−1)·Σu_i²) (= o jackknife entre partidas a ±0,005 ponto nas 4 amostras). Nunca abaixo do PISO DAS DURAÇÕES: o
// erro que sobra com o mesmo número de replays em toda partida — pela variância total, Var(Σ_{j≤N} d_j) = E[N]·Var(d) +
// Var(N)·E[d]² ≥ E[N]·Var(d) —, √(Σ_imp (d − d̄)² + Σ_par (d − d̄)² + (c·k/Σn)²·Σ_gol (d − s)²) ÷ Σt (o "binomial"
// daqui; 0,15 / 0,14 / 0,16 / 0,18 ponto no teto das 4 amostras de 48, que só morde em amostras pequenas). O Poisson
// composto (Σd², cada replay independente) não serve de piso: o espaço de 30 s e o teto de 3 por tempo deixam a
// contagem de replays de PARADA por partida menos dispersa que a de Poisson (variância ÷ média 0,99 / 0,77 / 0,62 /
// 0,84), e ele sai ACIMA do entre partidas medido nas 4 (0,352 / 0,344 / 0,374 / 0,388 × 0,347 / 0,314 / 0,317 / 0,384)
// — a regra ficaria mais frouxa do que a amostra sustenta.
const epAr = (() => {
  const k = res.length, T = jogoS, desv = xs => { const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); return xs.reduce((a, d) => a + (d - m) ** 2, 0); };
  const vImp = desv(res.flatMap(r => r.dImp)), vPar = desv(res.flatMap(r => r.esperas.map(e => e.dur)));
  const vGol = res.reduce((a, r) => a + r.dGol.reduce((b, d) => b + (d - segGol) ** 2, 0), 0);
  // o teto/piso com c gols por partida (c = null: o medido, com os gols da amostra)
  return c => {
    const H = (c == null ? ar : semGol + segGol * c * k) / T;
    const u = r => (c == null ? r.durImp + r.durPar + r.durGol : r.durImp + r.durPar + c * segGol + c * k * (r.durGol - segGol * r.nGol) / nGol) - H * r.ticks / 60;
    const ep = k > 1 ? Math.sqrt(k / (k - 1) * res.reduce((a, r) => a + u(r) ** 2, 0)) / T : 0;
    const piso = Math.sqrt(vImp + vPar + (c == null ? vGol : (c * k / nGol) ** 2 * vGol)) / T;
    return { ep: 100 * ep, piso: 100 * piso, e: 100 * Math.max(ep, piso) };
  };
})();
const [eLo, eHi, eMed] = nGol > 0 ? [epAr(2.3), epAr(3.5), epAr(null)] : [{}, {}, {}];
const zLo = (arLo - 8) / eLo.e, zHi = (arHi - 16) / eHi.e, zMed = (fat - 16) / eMed.e;
reg('P3 o ar em replay (gol + impedimento + paradas) / o tempo de jogo, com 2,3–3,5 gols por partida',
  `${f2(arLo)}–${f2(arHi)}% (z do piso ${f2(zLo)}, do teto ${f2(zHi)}; ep entre partidas ${f2(eLo.ep)} / ${f2(eHi.ep)} pt, piso das durações ${f2(eLo.piso)} / ${f2(eHi.piso)}; medido ${f1(fat)}% com ${nGol} gols, ${f1(segGol)} s por gol, z ${f2(zMed)}; paradas ${f1(pPar)}%)`,
  '8–16% (SoccerNet 13,3%; reprova quando prova: z > 1,645)',
  nGol > 0 && zLo >= -1.645 && zHi <= 1.645 && zMed <= 1.645);
// (28/10, decisão do dono) A FIDELIDADE À TV POR SITUAÇÃO: os replays de parada ÷ os que a TV faria nas mesmas bolas
// mortas (sem gol, sem impedimento, sem a saída), cada uma pela taxa do SoccerNet-v2 da SITUAÇÃO dela (TV_SIT: o recomeço e o
// que veio antes) — a regra "sem recuo" do dono: não pode ficar abaixo da da versão publicada (FID_MAIN) na mesma amostra.
// Reprova quando a contagem PROVA (z < −1,645, um lado, como o passe certo do teste-intercepta), com o erro-padrão ENTRE
// PARTIDAS (cada partida é um conglomerado de bolas mortas; a linearização de Taylor do estimador de razão — Cochran,
// Sampling Techniques, 1977, cap. 6): √(Σ (r_i − f·e_i)² / (k(k−1))) / (Σe ÷ k), r_i os replays e e_i os esperados da partida
// i; nunca abaixo do "binomial" (cada bola morta com replay ou não, na fidelidade da versão publicada: √(Σ p_j(1 − p_j)) ÷
// Σe, p_j = FID_MAIN × a taxa da situação dela).
{
  const longe = (await imp('config.js')).BARREIRA.longe;
  const cel = {}, porPartida = [];
  let fora = 0;
  for (const r of res) {
    const comReplay = new Set(r.esperas.map(e => e.morta));
    let e = 0, n = 0;
    const ps = [];
    for (const q of r.mortas) {
      const st = situacaoTV(q, longe);
      if (!st) { if (comReplay.has(q.tick)) fora++; continue; }
      const rep = comReplay.has(q.tick);
      e += st.p; n += rep ? 1 : 0; ps.push(st.p);
      const c = (cel[st.chave] ??= { n: 0, rep: 0, esp: 0, p: st.p });
      c.n++; c.rep += rep ? 1 : 0; c.esp += st.p;
    }
    porPartida.push({ r: n, e, ps });
  }
  const k = porPartida.length, E = porPartida.reduce((a, q) => a + q.e, 0), Rr = porPartida.reduce((a, q) => a + q.r, 0);
  const fid = E > 0 ? Rr / E : NaN;
  const ep = k > 1 ? Math.sqrt(porPartida.reduce((a, q) => a + (q.r - fid * q.e) ** 2, 0) / (k * (k - 1))) / (E / k) : 0;
  const pct = (x, c = 1) => (Number.isFinite(x) ? (100 * x).toFixed(c).replace('.', ',') : '—');
  // a fidelidade da versão publicada: a constante (da amostra padrão) ou --fid-main (outra amostra; em % ou fração)
  const fm = arg('--fid-main', null);
  const fidMain = fm != null ? (v => (v > 3 ? v / 100 : v))(+String(fm).replace(',', '.')) : PADRAO ? FID_MAIN : null;
  for (const [kk, c] of Object.entries(cel).sort((a, b) => b[1].esp - a[1].esp))
    console.log(`fidelidade por situação: ${kk.padEnd(26)} ${String(c.n).padStart(4)} bolas mortas, ${String(c.rep).padStart(3)} replays (${pct(c.rep / c.n, 0)}%; a TV ${pct(c.p, 1)}%: ${c.esp.toFixed(1).replace('.', ',')})`);
  if (fidMain == null) {
    reg('P3 fidelidade à TV por situação (SoccerNet-v2) ≥ a da versão publicada na mesma amostra', `${pct(fid)}% (${Rr} de ${E.toFixed(1).replace('.', ',')}; ep entre partidas ${pct(ep)} pt)`,
      `informativo: amostra fora do padrão (${N_PADRAO} a partir de ${S0_PADRAO}) sem --fid-main`, true);
  } else {
    const epBin = Math.sqrt(porPartida.reduce((a, q) => a + q.ps.reduce((b, p) => { const pp = Math.min(1, fidMain * p); return b + pp * (1 - pp); }, 0), 0)) / E;
    const z = (fid - fidMain) / Math.max(ep, epBin);
    reg('P3 fidelidade à TV por situação (SoccerNet-v2) ≥ a da versão publicada na mesma amostra',
      `${pct(fid)}% (${Rr} replays de ${E.toFixed(1).replace('.', ',')} da TV em ${porPartida.reduce((a, q) => a + q.ps.length, 0)} bolas mortas${fora ? '; ' + fora + ' replays fora da tabela' : ''}); z ${Number.isFinite(z) ? z.toFixed(2).replace('.', ',') : '—'} (ep entre partidas ${pct(ep)} pt, binomial ${pct(epBin)} pt)`,
      `≥ ${pct(fidMain)}% (${fm != null ? '--fid-main' : 'a versão publicada nestas sementes'}; reprova quando prova: z < −1,645)`,
      E > 0 && fora === 0 && z >= -1.645);
  }
}
if (arg('--json', null)) fs.writeFileSync(arg('--json'), JSON.stringify(res.map(r => ({ s: r.s, esperas: r.esperas, nGol: r.nGol, durGol: r.durGol, durImp: r.durImp, durPar: r.durPar, dGol: r.dGol, dImp: r.dImp, ticks: r.ticks,
  mortas: r.mortas.map(q => ({ tick: q.tick, parada: q.parada, direto: q.direto, dist: q.dist, imped: q.imped, cartao: q.cartao, chute15: q.chute15, ref: q.ref, got: q.got, aceito: q.aceito })) }))));

// P4
const p4 = res.filter(r => r.p4).map(r => ({ s: r.s, ...r.p4 }));
const p4ruim = p4.filter(q => q.difer >= 0 || q.escreve >= 0);
reg('P4 pureza: hash igual com e sem o classificador; ler o passo não muda o hash', `${p4.length} sementes × ${p4[0]?.n ?? 0} passos; ${p4ruim.length ? 's' + p4ruim[0].s + ': difere no tick ' + p4ruim[0].difer + ', escreve no ' + p4ruim[0].escreve : 'iguais'}`,
  'iguais', p4.length > 0 && p4ruim.length === 0);

// P5
const p5n = res.reduce((a, r) => a + r.p5.n, 0), p5e = res.flatMap(r => r.p5.erros.map(e => `s${r.s} ${e}`));
reg('P5 montaNoProximoPasso = o passo real (montou / fim do tempo / nada)', `${p5n - p5e.length}/${p5n}${p5e.length ? ' (ex.: ' + p5e[0] + ')' : ''}`, '100%', p5n > 0 && p5e.length === 0);

fimTeste();
