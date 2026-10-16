// Disputa de pênaltis (modo Pênaltis 3D, pedido do dono de 15/10; js/disputa.js; IFAB Regra 10). Metas:
//   A) a regra pura: alternância ABAB a partir de quem começa; o fim nas 5 (um não alcança mais o outro — conferido contra
//      um árbitro independente que conta as cobranças que faltam uma a uma, em 3000 sequências sorteadas); as alternadas
//      (o mesmo número de cobranças, um a mais); a fila dos cobradores (ninguém bate a 2ª antes de todos baterem a 1ª, o
//      goleiro por último, a fila dá a volta);
//   B) IA × IA chega ao fim em 24 sementes: vencedor certo pelo placar, ninguém bate depois de decidido, ordem ABAB e dos
//      cobradores, placar do mundo = o da disputa, um disputaFim só, duração;
//   C) o lugar de cada um na cobrança (Regra 10): os que esperam no círculo central, o goleiro do time que bate na linha de
//      fundo fora da área, o que defende na linha do gol entre as traves, o cobrador na marca; na caminhada ninguém toca a
//      bola e o cobrador chega andando (sem teletransporte);
//   D) a cobrança da IA: gol / defesa / fora em 48 disputas (real: ~70–76% de conversão, ~18% defesas);
//   E) o humano roteirizado: bate (mira e força pelo analógico e pelo CHUTE — o canto do lado do analógico, sem a IA bater
//      por ele) e defende (o lado do analógico antes do chute é o do mergulho; acertando o lado, defende); parado, a IA bate
//      por ele depois do prazo (a disputa nunca trava);
//   F) determinismo (a mesma semente = o mesmo hash e as mesmas cobranças) e o resultado no contrato do Total Match;
//   G) o fim da cobrança pela Regra 10 (revisão de 16/10): a bola que volta da trave pela boca do gol, bate no goleiro e
//      entra é gol (antes: 'fora' e o gol contado depois, na reação); dado o resultado, nenhum gol conta e nenhuma bola
//      dada como perdida entra depois; 'defesa' só com o goleiro tocando (o 'goleiroBatido' — ele NÃO chegou — contava
//      como toque: o chute que passava rente à trave, por fora, virava 'defesa'); o goleiro na linha no chute (C4);
//      a cavadinha repetida do humano não converte sem risco (E4: o goleiro lê as cavadinhas da disputa).
//   node tools/teste-disputa.mjs [--js <pasta js>] [--rapido]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const RAPIDO = args.includes('--rapido');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const pct = (a, n) => `${fmt(100 * a / Math.max(1, n), 0)}%`;

let DS = null;
try { DS = await imp('disputa.js'); } catch (e) { DS = null; }
if (!DS) {
  reg('disputa de pênaltis (js/disputa.js)', 'não existe', 'existe', false);
} else {
  const { criarDisputa, passoDisputa, entradaDemoDisputa, vencedorDisputa, timeDaCobranca, cobradorDa, resumoDisputa, resultadoPenaltisTM, DISPUTA_ESTADOS } = DS;
  const { DISPUTA, CAMPO, PASSO, BOTAO, PARTIDA, BOLA } = await imp('config.js');
  const { hashMundo, jogadorPorId } = await imp('sim.js');
  const { teleportar } = await imp('partida.js');
  const MX = CAMPO.meioX;
  // a bola passou inteira da linha do gol G entre as traves, por baixo do travessão (pela posição, sem olhar o m.golTick)
  const entrou = (b, G) => b.p.x * G >= MX + BOLA.raio && b.p.x * G - MX < 1.5 && Math.abs(b.p.z) < CAMPO.gol.largura / 2 && b.p.y < CAMPO.gol.altura;

  // ------------------------------------------------------------ A. a regra pura
  {
    const seq = Array.from({ length: 8 }, (_, k) => timeDaCobranca(1, k)).join('');
    reg('A1. Alternância ABAB a partir de quem começa', `começa o 1: ${seq}`, '10101010', seq === '10101010');
    // árbitro independente: depois de cada cobrança, decide pelo que AINDA pode acontecer (todas as sequências do resto)
    function arbitro(gols, chutes) {
      const n = DISPUTA.cobrancas;
      if (chutes[0] <= n && chutes[1] <= n && !(chutes[0] === n && chutes[1] === n)) {
        // o melhor e o pior caso de cada time nas que faltam das 5
        const max0 = gols[0] + (n - chutes[0]), max1 = gols[1] + (n - chutes[1]);
        if (gols[0] > max1) return 0;
        if (gols[1] > max0) return 1;
        return null;
      }
      if (chutes[0] === chutes[1]) return gols[0] === gols[1] ? null : gols[0] > gols[1] ? 0 : 1;
      return null;
    }
    let s = 12345, bate = 0, total = 0, maxK = 0, depois = 0;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let q = 0; q < 3000; q++) {
      const prim = q % 2, conv = 0.4 + 0.5 * r();
      const g = [0, 0], c = [0, 0];
      let v = null, k = 0;
      while (v == null && k < 400) {
        const t = timeDaCobranca(prim, k++);
        c[t]++; if (r() < conv) g[t]++;
        const a = vencedorDisputa(g, c), b = arbitro(g, c);
        total++; if (a === b) bate++;
        v = a;
      }
      maxK = Math.max(maxK, k);
      if (v == null) depois++;
    }
    reg('A2. Fim da disputa = árbitro independente em 3000 sequências sorteadas (5 + alternadas)', `${bate}/${total} decisões iguais; ${depois} sem fim em 400 cobranças; a mais longa ${maxK}`, 'todas iguais; 0', bate === total && depois === 0);
    const casos = [
      [[3, 0], [3, 3], 0, '3×0 depois de 3 cada (o 2º chega no máx. a 2)'],
      [[3, 1], [4, 3], null, '3×1 com 4×3 cobranças (o 2º ainda empata)'],
      [[4, 1], [4, 4], 0, '4×1 com 4×4'],
      [[4, 4], [5, 4], null, '4×4 com 5×4 (falta a 5ª do 2º)'],
      [[4, 4], [5, 5], null, '4×4 nas 5: alternadas'],
      [[5, 4], [5, 5], 0, '5×4 nas 5'],
      [[5, 5], [6, 5], null, 'alternada: só um bateu'],
      [[6, 5], [6, 6], 0, 'alternada: converteu e o outro errou'],
      [[5, 6], [6, 6], 1, 'alternada: errou e o outro converteu'],
      [[2, 0], [2, 2], null, '2×0 com 2×2'],
      [[0, 3], [3, 3], 1, '0×3 depois de 3 cada'],
    ];
    const erradas = casos.filter(([g, c, v]) => vencedorDisputa(g, c) !== v).map(x => x[3]);
    reg('A3. Casos da Regra 10 (fim antecipado e alternadas)', erradas.length ? 'erradas: ' + erradas.join('; ') : `${casos.length} casos certos`, 'todos', erradas.length === 0);
    const ordem = [9, 7, 10, 11, 8, 6, 4, 3, 2, 5, 1];
    const seqC = Array.from({ length: 24 }, (_, n) => cobradorDa(ordem, n));
    const primeira = new Set(seqC.slice(0, 11)).size, volta = seqC[11] === ordem[0] && seqC[22] === ordem[0];
    reg('A4. Fila dos cobradores: 11 diferentes antes de alguém repetir, o 12º é o 1º de novo', `${primeira} diferentes nas 11 primeiras; volta ${volta}`, '11; sim', primeira === 11 && volta);
  }

  // ------------------------------------------------------------ B + C. IA × IA até o fim
  const NB = RAPIDO ? 8 : 24;
  const res = { gol: 0, defesa: 0, fora: 0 };
  const resIA = { gol: 0, defesa: 0, fora: 0 };
  let fimOk = 0, depois = 0, abab = 0, filaOk = 0, placarOk = 0, umFim = 0, tMax = 0, tSoma = 0, ordemGol = 0, ordemOk = 0;
  let circ = 0, circN = 0, esquina = 0, esqN = 0, linhaGol = 0, linhaN = 0, marca = 0, marcaN = 0, tocouCam = 0, saltoMax = 0, levadoMax = 0, cobrMax = 0, montou = -1;
  // G: gol fora do chute (depois do resultado), bola dada como perdida que entrou depois, 'defesa' sem toque do goleiro;
  // C4: o goleiro que defende no tick do chute (o centro e o pé mais perto da linha)
  let golDepois = 0, entrouDepois = 0, defN = 0, defSemToque = 0, chuteN = 0, gkCentroMax = 0, gkPeMax = 0;
  const exG = [];
  for (let s = 1; s <= NB; s++) {
    const m = criarDisputa({ semente: s });
    const D = m.disputa;
    let n = 0, fins = 0;
    const kick = [];
    let ant = null, vigia = false, toqueGk = false;
    while (D.estado !== 'fim' && n < 60 * 600) {
      const est = D.estado;
      const c0 = D.cobrador != null ? jogadorPorId(m, D.cobrador) : null;
      const pc = c0 ? { x: c0.x, z: c0.z } : null;
      const bolaAntes = { x: m.bola.p.x, z: m.bola.p.z };
      const ev = passoDisputa(m, entradaDemoDisputa(m));
      n++;
      // C: caminhada — ninguém toca a bola (ela fica na marca) e o cobrador anda (sem pular)
      if (est === 'caminhada' && D.estado === 'caminhada' && c0 && pc && ant === D.cobrador) {
        if (Math.hypot(m.bola.p.x - bolaAntes.x, m.bola.p.z - bolaAntes.z) > 1e-6) tocouCam++;
        saltoMax = Math.max(saltoMax, Math.hypot(c0.x - pc.x, c0.z - pc.z));
      }
      ant = D.estado === 'caminhada' ? D.cobrador : null;
      for (const e of ev) {
        if (e.tipo === 'gol' && est !== 'chute') { golDepois++; if (exG.length < 4) exG.push(`gol na ${est} (semente ${s}, t${m.tick})`); }
        if ((e.tipo === 'defesa' || e.tipo === 'bateuCorpo') && e.id === D.goleiro) toqueGk = true;
        if (e.tipo === 'cobranca' && e.parada === 'penalti') {
          // C4 (Regra 14): no chute, o goleiro que defende na linha (o centro e o pé mais perto dela)
          const gk = jogadorPorId(m, D.goleiro);
          if (gk) {
            chuteN++;
            gkCentroMax = Math.max(gkCentroMax, MX - gk.x * D.gol);
            gkPeMax = Math.max(gkPeMax, Math.min(...gk.pes.map(p => MX - p.x * D.gol)));
          }
          toqueGk = false;
        }
        if (e.tipo === 'cobrancaPenalti') {
          vigia = false;
          montou = m.tick;
          levadoMax = Math.max(levadoMax, e.levado);
          // C: o lugar de cada um com a cobrança montada
          const G = D.gol;
          for (const j of m.jogadores) {
            if (j.id === D.cobrador) { marcaN++; if (Math.hypot(j.x - G * (MX - CAMPO.marcaPenalti - 0.4), j.z) < 0.05) marca++; }
            else if (j.id === D.goleiro) { linhaN++; if (Math.abs(j.x - G * MX) <= 0.65 && Math.abs(j.z) < CAMPO.gol.largura / 2) linhaGol++; }
            else if (j.id === D.goleiroCobra) { esqN++; if (Math.abs(j.x - G * MX) < 1 && Math.abs(j.z) > CAMPO.area.largura / 2 && Math.abs(j.z) < CAMPO.area.largura / 2 + 2) esquina++; }
            else { circN++; if (Math.hypot(j.x, j.z) <= 9.15) circ++; }
          }
        }
        if (e.tipo === 'cobranca' && montou >= 0) cobrMax = Math.max(cobrMax, (m.tick - montou) * PASSO);
        if (e.tipo === 'disputaCobranca') {
          kick.push(e); res[e.resultado]++; if (e.time === 1) resIA[e.resultado]++;
          if (e.resultado !== 'gol') vigia = true;
          if (e.resultado === 'defesa') { defN++; if (!toqueGk && m.naMao !== D.goleiro) { defSemToque++; if (exG.length < 4) exG.push(`defesa sem toque (semente ${s}, k ${e.k})`); } }
        }
        if (e.tipo === 'disputaFim') fins++;
      }
      // G: a bola de uma cobrança já perdida não entra depois (até a próxima montagem)
      if (vigia && entrou(m.bola, D.gol)) { entrouDepois++; vigia = false; if (exG.length < 4) exG.push(`entrou depois de perdida (semente ${s}, t${m.tick})`); }
    }
    const r = resumoDisputa(m);
    tMax = Math.max(tMax, n * PASSO); tSoma += n * PASSO;
    if (D.estado === 'fim' && r.vencedor != null && vencedorDisputa(r.placar, r.chutes) === r.vencedor) fimOk++;
    // ninguém bateu depois de decidido: com qualquer prefixo menor, ainda não havia vencedor
    let cedo = false;
    const g = [0, 0], c = [0, 0];
    for (let i = 0; i < kick.length - 1; i++) { c[kick[i].time]++; if (kick[i].resultado === 'gol') g[kick[i].time]++; if (vencedorDisputa(g, c) != null) cedo = true; }
    if (cedo) depois++;
    if (kick.every((e, i) => e.time === timeDaCobranca(r.primeiro, i))) abab++;
    // a fila: a n-ésima do time = ordem[n % 11]; o goleiro é o último da ordem
    if (kick.every(e => e.id === cobradorDa(r.ordem[e.time], e.n - 1))) filaOk++;
    for (const t of [0, 1]) { ordemOk++; if (jogadorPorId(m, r.ordem[t][r.ordem[t].length - 1])?.posicao === 'GOL' && new Set(r.ordem[t]).size === 11) ordemGol++; }
    if (m.placar[0] === r.placar[0] && m.placar[1] === r.placar[1]) placarOk++;
    if (fins === 1) umFim++;
  }
  reg(`B1. IA × IA chega ao fim com o vencedor certo (${NB} sementes)`, `${fimOk}/${NB}; um disputaFim em ${umFim}/${NB}; duração média ${fmt(tSoma / NB, 0)} s, máx. ${fmt(tMax, 0)} s`, `${NB}/${NB}; ${NB}/${NB}; máx. ≤ 240 s`, fimOk === NB && umFim === NB && tMax <= 240);
  reg('B2. Ninguém bate depois de decidido; ordem ABAB', `bateu depois em ${depois}; ABAB em ${abab}/${NB}`, `0; ${NB}/${NB}`, depois === 0 && abab === NB);
  reg('B3. Cobradores pela fila (todos antes de repetir; 11 na ordem, o goleiro por último); placar do mundo = da disputa', `fila ${filaOk}/${NB}; ordem ${ordemGol}/${ordemOk}; placar ${placarOk}/${NB}`, `${NB}/${NB}; ${2 * NB}/${2 * NB}; ${NB}/${NB}`, filaOk === NB && ordemGol === ordemOk && placarOk === NB);
  reg('C1. Na cobrança: os que esperam no círculo central (≤ 9,15 m do centro)', `${circ}/${circN}`, 'todos', circ === circN && circN > 0);
  reg('C2. Goleiro do time que bate na linha de fundo, fora da área; o que defende na linha entre as traves; cobrador na marca', `esquina ${esquina}/${esqN}, linha ${linhaGol}/${linhaN}, marca ${marca}/${marcaN}`, 'todos', esquina === esqN && linhaGol === linhaN && marca === marcaN && marcaN > 0);
  reg('C3. Caminhada: a bola parada na marca, o cobrador anda até ela (passo ≤ 0,1 m; levado na montagem ≤ 0,1 m)', `bola mexeu ${tocouCam}; maior passo ${fmt(saltoMax, 3)} m; levado ${fmt(levadoMax, 3)} m`, '0; ≤ 0,1; ≤ 0,1', tocouCam === 0 && saltoMax <= 0.1 && levadoMax <= 0.1);
  reg('C4. Regra 14: no chute, o goleiro que defende NA linha (centro e pé mais perto dela; a linha tem 0,12 m)', `${chuteN} chutes: centro até ${fmt(gkCentroMax, 2)} m, pé até ${fmt(gkPeMax, 2)} m da linha`, 'centro ≤ 0,2 m; pé ≤ 0,12 m (antes 0,56–0,67 / 0,45–0,50)', chuteN > 0 && gkCentroMax <= 0.2 && gkPeMax <= 0.12);
  reg('G2. IA × IA: dado o resultado, nenhum gol conta e nenhuma bola dada como perdida entra; \'defesa\' só com o goleiro tocando', `gol depois do resultado ${golDepois}; entrou depois ${entrouDepois}; defesa sem toque ${defSemToque}/${defN}${exG.length ? ' — ' + exG.join('; ') : ''}`, '0; 0; 0', golDepois === 0 && entrouDepois === 0 && defSemToque === 0);
  const nT = res.gol + res.defesa + res.fora;
  reg('B4. Ritmo: a bola rola a ≤ 4 s da montagem (IA e demo)', `${fmt(cobrMax, 2)} s`, '≤ 4 s', cobrMax <= 4);

  // ------------------------------------------------------------ D. a cobrança da IA (48 disputas)
  {
    const N = RAPIDO ? 12 : 32;
    const r = { gol: 0, defesa: 0, fora: 0 };
    for (let s = 1; s <= N; s++) {
      const m = criarDisputa({ semente: 500 + s });
      let n = 0;
      while (m.disputa.estado !== 'fim' && n++ < 60 * 600) for (const e of passoDisputa(m, entradaDemoDisputa(m))) if (e.tipo === 'disputaCobranca' && e.time === 1) r[e.resultado]++;
    }
    const t = r.gol + r.defesa + r.fora;
    reg(`D. Cobrança da IA (${N} disputas, ${t} cobranças): gol / defesa / fora`, `${pct(r.gol, t)} / ${pct(r.defesa, t)} / ${pct(r.fora, t)}`, 'gol 64–84%, defesa ≥ 8%, fora ≤ 16% (real ~70–76 / ~18 / ~8)',
      r.gol / t >= 0.64 && r.gol / t <= 0.84 && r.defesa / t >= 0.08 && r.fora / t <= 0.16);
    reg(`D2. Todas as cobranças da B (${nT})`, `${pct(res.gol, nT)} / ${pct(res.defesa, nT)} / ${pct(res.fora, nT)}`, 'informativo', true);
  }

  // ------------------------------------------------------------ E. humano roteirizado
  {
    // bate: o humano (time 0) começa; mira para a direita de quem bate e segura o CHUTE ~0,45 s depois da bola pronta
    let bateu = 0, iaBateu = 0, ladoCerto = 0, n = 0, defLado = 0, defN = 0, defendeu = 0, defCerto = 0;
    for (let s = 1; s <= (RAPIDO ? 6 : 16); s++) {
      const m = criarDisputa({ semente: 900 + s, comeca: 0, humano: 0 });
      const D = m.disputa;
      const G = D.gol;
      let segura = -1, ladoMira = 0, ladoDef = 0, k = 0;
      while (D.estado !== 'fim' && k++ < 60 * 400) {
        let e = { x: 0, z: 0, botoes: 0 };
        const pr = m.parada;
        if (D.estado === 'cobranca' && pr && !pr.rolou) {
          if (D.vez === 0) {
            // a direita de quem bate (de frente para o gol de x = G·52,5) é z = +G; lado alterna por cobrança
            ladoMira = D.cobrancas.length % 4 < 2 ? 1 : -1;
            const zMundo = ladoMira * G;
            const pronto = m.tick >= pr.pronta + 6;
            if (pronto && segura < 0) segura = m.tick;
            e = { x: 0.25 * G, z: zMundo, botoes: pronto && m.tick - segura < 27 ? BOTAO.CHUTE : 0 };
          } else {
            // defende: o goleiro para o lado do mundo z = ladoDef (o mesmo da IA? sorteado pela cobrança)
            ladoDef = (D.cobrancas.length >> 1) % 2 ? 1 : -1;
            e = { x: 0, z: ladoDef, botoes: 0 };
          }
        } else segura = -1;
        const ev = passoDisputa(m, e);
        for (const q of ev) {
          if (q.tipo === 'cobranca' && q.parada === 'penalti') {
            const c = jogadorPorId(m, q.id);
            if (c.time === 0) {
              n++;
              // a IA bate pelo humano só depois do prazo (PARTIDA.cobrancaHumanoMax + DISPUTA.esperaHumano desde a montagem)
              if (m.tick - D.desde < (PARTIDA.cobrancaHumanoMax + DISPUTA.esperaHumano) / PASSO - 5) bateu++; else iaBateu++;
              // o canto: a bola vai para o lado pedido (z da bola andando ×  G·lado > 0)
              if (Math.sign(m.bola.v.z) === ladoMira * G) ladoCerto++;
            } else {
              const gk = jogadorPorId(m, D.goleiro);
              defN++;
              if (Math.sign(gk.palpite ?? 0) === ladoDef) defLado++;
            }
          }
          if (q.tipo === 'disputaCobranca' && q.time === 1) {
            const gk = jogadorPorId(m, D.goleiro);
            // a bola foi para o lado escolhido pelo goleiro do humano?
            const zb = gk.defesa?.bz ?? m.bola.p.z;
            if (Math.sign(zb) === ladoDef) { defCerto++; if (q.resultado === 'defesa') defendeu++; }
          }
        }
      }
    }
    reg('E1. O humano bate: o CHUTE dele sai (sem a IA bater por ele) e no canto do analógico', `${bateu}/${n} dele (IA ${iaBateu}); canto pedido ${ladoCerto}/${n}`, 'todos dele; canto ≥ 85%', n > 0 && bateu === n && ladoCerto >= 0.85 * n);
    reg('E2. O humano defende: o lado do analógico antes do chute é o lado do goleiro; acertando, defende algumas', `lado do analógico ${defLado}/${defN}; bola no lado escolhido ${defCerto}, defendidas ${defendeu}`, `${defN}/${defN}; ≥ 1 defesa`, defN > 0 && defLado === defN && defendeu >= 1);
    // parado: a IA bate por ele e a disputa acaba
    const m = criarDisputa({ semente: 77, comeca: 0, humano: 0 });
    let k = 0, ia = 0;
    while (m.disputa.estado !== 'fim' && k++ < 60 * 600) for (const q of passoDisputa(m, { x: 0, z: 0, botoes: 0 })) if (q.tipo === 'cobranca' && jogadorPorId(m, q.id).time === 0) ia++;
    reg('E3. Humano parado: a IA bate por ele depois do prazo e a disputa acaba', `${m.disputa.estado}, ${ia} cobranças dele pela IA, ${fmt(k * PASSO, 0)} s`, 'fim', m.disputa.estado === 'fim' && ia >= 3);
  }

  // ------------------------------------------------------------ G. cenas montadas: o fim da cobrança
  {
    // até o chute da 1ª cobrança (a IA pelos dois)
    const ateChute = s => {
      const m = criarDisputa({ semente: s });
      let n = 0;
      while (m.disputa.estado !== 'chute' && n++ < 60 * 60) passoDisputa(m, entradaDemoDisputa(m));
      return m;
    };
    // roda até o resultado e mais a reação (até a próxima caminhada): {res, golDepois, entrou, toque}
    const ateResultado = m => {
      const D = m.disputa, k0 = D.cobrancas.length, G = D.gol;
      let res = null, golDepois = 0, cruzou = false, toque = false;
      for (let i = 0; i < 60 * 12; i++) {
        const est = D.estado;
        for (const e of passoDisputa(m, entradaDemoDisputa(m))) {
          if (e.tipo === 'disputaCobranca') res = e.resultado;
          if (e.tipo === 'gol' && est !== 'chute') golDepois++;
          if (e.tipo === 'bateuCorpo' && e.id === D.goleiro) toque = true;
        }
        if (entrou(m.bola, G)) cruzou = true;
        if (D.cobrancas.length > k0 && D.estado !== 'reacao') break;
      }
      return { res, golDepois, cruzou, toque };
    };
    // G1: a bola volta da trave pela boca do gol (o estado da semente 1085 da revisão: 13 m/s de lado, 5 m/s para fora), com
    // o goleiro PARADO em vários pontos do caminho; onde ela bate nele e entra, tem de ser gol (e nada conta depois)
    let casos = 0, entraram = 0, certos = 0, golDep = 0;
    const errados = [];
    for (const gx of [51.0, 51.1, 51.2, 51.3]) for (const gz of [0.6, 0.9, 1.2, 1.5]) {
      const m = ateChute(1), D = m.disputa, G = D.gol, b = m.bola, gk = jogadorPorId(m, D.goleiro);
      b.p.x = G * 52.36; b.p.y = 0.37; b.p.z = 3.62; b.v.x = -G * 5.03; b.v.y = -1.81; b.v.z = -13.01;
      b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
      teleportar(gk, G * gx, gz, G > 0 ? Math.PI : 0);
      gk.defesa = null; gk.mergulho = null; gk.palpite = null; gk.papel = 'parado';
      D.trave = true;
      const r = ateResultado(m);
      casos++; golDep += r.golDepois;
      if (r.cruzou) { entraram++; if (r.res === 'gol') certos++; else errados.push(`goleiro em (${gx}, ${gz}): ${r.res}`); }
    }
    reg('G1. Bola na trave que volta pela boca do gol, bate no goleiro e entra: gol (cena montada, goleiro parado em 16 pontos)', `${entraram} entraram: ${certos} gol${errados.length ? ' — ' + errados.join('; ') : ''}; gol contado depois do resultado ${golDep}`, '≥ 1 entrou; todas gol; 0', entraram >= 1 && certos === entraram && golDep === 0);
    // G3: o goleiro batido (mergulhou para o lado errado: 'goleiroBatido', sem tocar) e o chute por fora, rente à trave → 'fora'
    const resB = [];
    for (const s of [1, 2]) for (const lado of [1, -1]) {
      const m = ateChute(s), D = m.disputa, G = D.gol, b = m.bola, gk = jogadorPorId(m, D.goleiro);
      const dx = G * CAMPO.marcaPenalti, dz = lado * 4.4, L = Math.hypot(dx, dz), V = 22;
      b.p.x = G * (MX - CAMPO.marcaPenalti); b.p.y = BOLA.raio; b.p.z = 0; b.v.x = V * dx / L; b.v.y = 3; b.v.z = V * dz / L;
      b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
      // o plano da defesa que falha (como o do palpite errado no goleiro.js lerChute): mergulho para o outro lado
      gk.palpite = -lado * 2.2;
      gk.defesa = { chave: m.voo?.tickChave, lido: m.tick, tick: m.tick + 24, inicio: m.tick + 2, z: -lado * 2.2, y: 0.55, sucesso: false, tipo: 'falhou',
        mergulha: true, proprio: false, lado: -lado, xPlano: G * (MX - 0.3), bx: G * (MX - 0.3), by: 0.55, bz: -lado * 2.2, palpite: true };
      let batido = false;
      const D0 = D.cobrancas.length;
      for (let i = 0; i < 60 * 6 && D.cobrancas.length === D0; i++) for (const e of passoDisputa(m, entradaDemoDisputa(m))) if (e.tipo === 'goleiroBatido' && e.id === gk.id) batido = true;
      resB.push(`${batido ? 'batido' : 'sem batido'} → ${D.cobrancas[D0]?.resultado}`);
    }
    reg('G3. Goleiro batido (mergulhou para o outro lado, sem tocar) e o chute por fora: \'fora\', não \'defesa\'', resB.join('; '), 'batido → fora (4)', resB.length === 4 && resB.every(x => x === 'batido → fora'));
  }

  // ------------------------------------------------------------ E4. a cavadinha repetida do humano
  {
    // o humano começa e bate SEMPRE de cavadinha (dois toques rápidos no CHUTE, o analógico para o gol)
    let n = 0, cav = 0, gol = 0, prim = 0, primGol = 0;
    for (let s = 1; s <= (RAPIDO ? 6 : 16); s++) {
      const m = criarDisputa({ semente: 300 + s, comeca: 0, humano: 0 });
      const D = m.disputa;
      let t0 = -1, k = 0, minhas = 0;
      while (D.estado !== 'fim' && k++ < 60 * 600) {
        let e = { x: 0, z: 0, botoes: 0 };
        const pr = m.parada;
        if (D.estado === 'cobranca' && pr && !pr.rolou && D.vez === 0) {
          if (m.tick >= pr.pronta + 6 && t0 < 0) t0 = m.tick;
          const f = t0 >= 0 ? m.tick - t0 : -1;
          e = { x: 0.3 * D.gol, z: 0, botoes: (f >= 0 && f < 3) || (f >= 5 && f < 8) ? BOTAO.CHUTE : 0 };
        } else if (D.estado !== 'cobranca') t0 = -1;
        for (const q of passoDisputa(m, e)) if (q.tipo === 'disputaCobranca' && q.time === 0) {
          n++; if (q.cavadinha) cav++; if (q.resultado === 'gol') gol++;
          if (minhas++ === 0) { prim++; if (q.resultado === 'gol') primGol++; }
        }
      }
    }
    reg('E4. Cavadinha repetida do humano: o goleiro da IA lê (fica mais no meio) — sem estratégia que converte sem risco', `${cav}/${n} cavadinhas: ${pct(gol, n)} gol (a 1ª da disputa ${pct(primGol, prim)}; chute no canto ~76%, antes ~93%)`, 'todas cavadinha; ≤ 75% no total; a 1ª ≥ 75%', n > 0 && cav === n && gol / n <= 0.75 && primGol / prim >= 0.75);
  }

  // ------------------------------------------------------------ F. determinismo e Total Match
  {
    const rodar = s => { const m = criarDisputa({ semente: s }); const hs = []; let n = 0; while (m.disputa.estado !== 'fim' && n++ < 60 * 600) { passoDisputa(m, entradaDemoDisputa(m)); if (n % 300 === 0) hs.push(hashMundo(m)); } return { hs, r: JSON.stringify(resumoDisputa(m)), m }; };
    const a = rodar(31), b = rodar(31), c = rodar(32);
    const iguais = a.hs.length === b.hs.length && a.hs.every((h, i) => h === b.hs[i]) && a.r === b.r;
    reg('F1. Mesma semente = mesmos hashes (a cada 5 s) e as mesmas cobranças; outra semente, outra disputa', `${iguais ? 'iguais' : 'DIFERENTES'} (${a.hs.length} hashes); semente 32 ${c.r !== a.r ? 'diferente' : 'IGUAL'}`, 'iguais; diferente', iguais && c.r !== a.r);
    const mapa = {};
    for (const j of a.m.jogadores) mapa[j.id] = { tmId: 'tm' + j.id, nome: 'J' + j.id };
    const rt = resultadoPenaltisTM(a.m, mapa);
    const p = rt?.penaltis;
    const ok = !!p && (p.vencedor === 0 || p.vencedor === 1) && p.placar.length === 2 && p.cobrancas.length === a.m.disputa.cobrancas.length
      && p.cobrancas.every(x => (x.lado === 0 || x.lado === 1) && /^tm\d+$/.test(x.tmId) && ['gol', 'defesa', 'fora'].includes(x.resultado))
      && p.cobrancas.filter(x => x.lado === 0 && x.resultado === 'gol').length === p.placar[0] && !('homeGoals' in rt);
    reg('F2. Resultado para o Total Match: {penaltis: {vencedor, placar, cobrancas: [{lado, tmId, nome, resultado}]}}', p ? `vencedor ${p.vencedor}, ${p.placar.join(' × ')}, ${p.cobrancas.length} cobranças` : 'nada', 'o contrato, gols da lista = placar, sem homeGoals', ok);
    reg('F3. Antes do fim não há resultado', String(resultadoPenaltisTM(criarDisputa({ semente: 3 }))), 'null', resultadoPenaltisTM(criarDisputa({ semente: 3 })) === null);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-disputa: REPROVOU (${falhas})` : '\nteste-disputa: PASSOU');
process.exit(falhas ? 1 : 0);
