// Cena SEMIAUTOMÁTICA do impedimento no replay (pedidos do dono de 12/10: "tipo aquelas cenas de replay do impedimento
// semiautomático" e "em um replay qualquer, aparece uma cena de quando NÃO foi impedimento também"). As partes puras, em
// Node (render/replay-saot.js, replay-roteiro.js, replay-anel.js), com cenas MONTADAS (lib/cena-montada.mjs) e lances de
// verdade (IA × IA, sementes 1–40, gravados como o main.js: lib/varre-saot.mjs):
//   S1 durações: impedimento = P1 'linha' (≤ 3,9 s) + P2 'saot' (3,6 s ± 1 quadro) ≤ 7,5 s com o apito 1, 4 e 6 s depois do
//      passe; a análise de posição legal 3,4 s ± 1 quadro; o relógio acaba sozinho a 60 e a 30 qps;
//   S2 o defensor do evento é quem fazia a linha: no anel, o x dele no passo da foto = linhaX (≤ 1e-4) em 100%;
//   S3 critério da POSIÇÃO LEGAL: 10 cenas montadas (+ 2 da pausa) — mostra 0,3 e 0,8 m; não mostra 1,2 m; −0,05 m legal
//      pelas partes só com a parede ("mesma linha"); não mostra com a linha na bola, recebendo de cobrança, com o pé além,
//      com o adversário no meio, antes do último corte; de duas cadeias, a mais apertada;
//   S4 câmera: começa ≥ 60° e termina a 12–24° de elevação e 8–25° fora do eixo da linha; os dois dentro do quadro com
//      8% de folga e sobreposição ≤ 30% em 16:9 e 844×390; ≤ 3° por quadro a 60 qps; ≥ 2 m e fora dos sólidos (placas,
//      bancos) — nas cenas montadas e em 100% dos impedimentos de verdade (os dois a mais de 28 m na largura: o quadro
//      "extra", mais alto, e a prova de que nenhum quadro de 12–24° cabe os dois);
//   S5 o selo só no quadro final e nunca volta a 0 depois de aparecer (a 60 e a 30 qps; "reduzir movimento": sem órbita);
//   S6 gol com checagem: a análise no fim, ≤ 13 s (golaço ≤ 15), o passe checado dentro do plano de TV; sem checagem, o
//      roteiro é igual (campo a campo) ao de antes — também nos gols de verdade;
//   S7 coerência decisão × desenho: impedimento: o plano do atacante passa a parede > 0,10 m em 100%; legal: o quadril até
//      a parede + 0,10 e nenhuma parte que vale além da parte mais recuada do defensor em 100%;
//   S8 a pose da análise é a gravada: nenhuma junta abaixo de −0,02 m; o pé mais baixo do impedido e do defensor ≤ 0,30 m.
// Na versão sem a cena (a main de antes) reprova: render/replay-saot.js não existe.
//   node tools/teste-saot.mjs [--js <pasta js>] [--sementes 40] [--ticks 5000] [--threads 4]
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const pastaJs = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 40), TICKS = +arg('--ticks', 5000), THREADS = +arg('--threads', Math.max(1, Math.min(4, os.cpus().length)));
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok, info = false) { linhas.push([nome, medido, meta, info ? 'INFO' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; }
const f2 = v => (v == null || !Number.isFinite(v) ? String(v) : v.toFixed(2));
const larg = rows => rows.map(r => r.map(String));

let SA = null;
try { SA = await imp('render/replay-saot.js'); } catch (e) { SA = null; }
if (!SA) {
  reg('módulo da cena semiautomática (render/replay-saot.js)', 'não existe (sem a cena)', 'existe', false);
} else {
  const RA = await imp('render/replay-anel.js');
  const RR = await imp('render/replay-roteiro.js');
  const C = await imp('config.js');
  const { NJ, J } = await imp('anim.js');
  const FE = await imp('estadio-forma.js');
  const { REPLAY, CAMPO } = C;
  const S = REPLAY.saot;
  const { montarAnel, lancePasse } = await import(pathToFileURL(path.join(AQUI, 'lib/cena-montada.mjs')).href);
  const { varrerSaot, roteiroGolHoje, igualProfundo, medirOrbita } = await import(pathToFileURL(path.join(AQUI, 'lib/varre-saot.mjs')).href);
  const P = NJ * 3;

  // anel sintético "de jogo" (22 jogadores, tudo função do tick: como o teste-replay-anel)
  const pose0 = new Float32Array(P);
  function anelJogo(de = 2001, ate = 2600) {
    const a = RA.criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    for (let t = de; t <= ate; t++) {
      a.inicio(t, t / 60, false);
      for (let id = 0; id < 22; id++) {
        for (let k = 0; k < P; k++) pose0[k] = (k % 3 === 1 ? 0.95 : 0) + Math.sin(t * 0.013 + id * 0.7 + k * 0.11) * 0.2;
        pose0[1] = 0.95;
        a.jogador(id, id, id >= 11 ? 1 : 0, id === 0 || id === 11, -40 + id * 3 + t * 0.01, Math.cos(t * 0.02 + id) * 20, 0, pose0);
      }
      a.fim({ x: t * 0.05, y: 0.11, z: -t * 0.02 }, { x: 0, y: 0, z: 0, w: 1 });
    }
    return a;
  }
  /** Toca o roteiro no relógio a `qps`: quadros em cada plano, se acabou sozinho, selo por quadro (via faseSaot). */
  function tocar(ro, qps, reduzir = false) {
    const rel = RR.criarRelogio(), dt = 1 / qps;
    RR.iniciarRelogio(rel, ro);
    const porPlano = new Array(ro.planos.length).fill(0);
    const fs = {}, selos = [];
    let q = 0, acabou = false;
    while (q < 2000) {
      porPlano[rel.i]++;
      const p = RR.planoAtual(rel);
      if (p.cam === 'saot') { SA.faseSaot(RR.tempoSaot(rel), p.saot.tipo, fs, p.saot.mesmaLinha, reduzir); selos.push({ selo: fs.selo, fase: fs.fase, u: fs.u }); }
      q++;
      if (!RR.avancarRelogio(rel, dt)) { acabou = true; break; }
    }
    return { porPlano, quadros: q, acabou, selos, dt };
  }

  // ---------------------------------------------------------------- S1 durações
  {
    const a = anelJogo();
    const I = REPLAY.impedimento;
    for (const dA of [1, 4, 6]) {
      const foto = 2150, apito = foto + dA * 60;
      const ro = RR.roteiroImpedimento(a, { fotoTick: foto, apitoTick: apito, linhaX: 5, idImpedido: 9, time: 0, lado: 1, defensor: 15, por: 4 });
      const cams = ro ? ro.planos.map(p => p.cam).join(' → ') : '-';
      const p1 = ro ? RR.duracao({ planos: [ro.planos[0]] }) : NaN, p2 = ro?.planos[1] ? RR.duracao({ planos: [ro.planos[1]] }) : NaN, tot = RR.duracao(ro);
      const ok = !!ro && cams === 'linha → saot' && p1 <= 3.9 + 1e-9 && Math.abs(p2 - S.impedimento.dura) < 1e-9 && tot <= 7.5 + 1e-9
        && ro.planos[0].congela.s === 0 && ro.planos[0].congela.tick === foto && ro.planos[1].congela.tick === foto;
      reg(`S1 impedimento com o apito ${dA} s depois do passe: P1 'linha' + P2 'saot'`, `${cams}; P1 ${f2(p1)} s (sem congelar), P2 ${f2(p2)} s, total ${f2(tot)} s`, 'linha → saot; P1 ≤ 3,9; P2 3,6; ≤ 7,5 s', ok);
      for (const qps of [60, 30]) {
        const t = tocar(ro, qps);
        const sP2 = t.porPlano[1] * t.dt;
        reg(`S1 relógio a ${qps} qps (apito ${dA} s depois): acaba sozinho, P2 = 3,6 s ± 1 quadro`, `${t.quadros} quadros (${f2(t.quadros * t.dt)} s; roteiro ${f2(tot)} s), acabou ${t.acabou}; P2 ${t.porPlano[1]} quadros = ${f2(sP2)} s`,
          `acaba; |P2 − 3,6| ≤ ${f2(t.dt)} s`, t.acabou && Math.abs(sP2 - S.impedimento.dura) <= t.dt + 1e-6 && t.quadros * t.dt <= tot + 2 * t.dt + 1e-6);
      }
    }
    // análise de posição legal (roteiro da pausa / teste) a 60 e 30 qps
    const L = lancePasse({ margem: 0.3 });
    const al = montarAnel(RA, NJ, J, L);
    const rl = RR.roteiroLegalTeste(al);
    const p2l = rl ? RR.duracao({ planos: [rl.planos[rl.planos.length - 1]] }) : NaN;
    for (const qps of [60, 30]) {
      const t = rl ? tocar(rl, qps) : null;
      const sP2 = t ? t.porPlano[t.porPlano.length - 1] * t.dt : NaN;
      reg(`S1 análise de POSIÇÃO LEGAL a ${qps} qps: 3,4 s ± 1 quadro, acaba sozinha`, t ? `${rl.planos.map(p => p.cam).join(' → ')}; plano ${f2(p2l)} s; tocou ${f2(sP2)} s, acabou ${t.acabou}` : 'sem roteiro',
        `saot ${S.legal.dura} s ± ${f2(1 / qps)}`, !!t && t.acabou && Math.abs(p2l - S.legal.dura) < 1e-9 && Math.abs(sP2 - S.legal.dura) <= 1 / qps + 1e-6);
    }
  }

  // ---------------------------------------------------------------- S3 critério da posição legal (cenas montadas)
  const casos = [];
  {
    const chk = (o, opc = {}) => {
      const L = lancePasse(o);
      const a = montarAnel(RA, NJ, J, L);
      return { L, a, c: SA.checagemLegal(a, { golTick: L.gol, time: 0, lado: L.lado, ...opc }) };
    };
    const lista = [
      ['margem 0,3 m (apertado)', { margem: 0.3 }, c => !!c && Math.abs(c.margem - 0.3) < 1e-3 && !c.mesmaLinha],
      ['margem 0,8 m (o olho erra)', { margem: 0.8, lado: -1 }, c => !!c && Math.abs(c.margem - 0.8) < 1e-3],
      ['margem 1,2 m (claro: a TV não desenha)', { margem: 1.2 }, c => !c],
      ['−0,05 m pelo centro, legal pelas partes (o pé do defensor atrás): só a parede', { margem: -0.05, peDef: 0.35 }, c => !!c && c.mesmaLinha && SA.faseSaot(3, 'legal', {}, c.mesmaLinha).plano === 0],
      ['linha na bola (defensor null)', { margem: 0.3, def: null }, c => !c],
      ['recebendo direto de lateral, tiro de meta ou escanteio (sem foto antes)', { margem: 0.3, semFotoAntes: true }, c => !c],
      ['legal pelo centro (0,05 m), mas o pé além da parte mais recuada do defensor', { margem: 0.05, peAtac: 0.45 }, c => !c],
      ['jogada deliberada do adversário no meio da cadeia', { margem: 0.3, adversario: 1230 }, c => !c],
      ['cadeia antes do último corte', { margem: 0.3, cortes: new Set([1320]) }, c => !c],
    ];
    let certos = 0;
    for (const [nome, o, esp] of lista) {
      const { c } = chk(o);
      const ok = esp(c);
      if (ok) certos++;
      casos.push(c);
      reg(`S3 ${nome}`, c ? `mostra (margem ${f2(c.margem)} m${c.mesmaLinha ? ', mesma linha' : ''}, passe ${c.fotoTick})` : 'não mostra', '', ok);
    }
    // duas cadeias no lance: A → B (0,6 m) e B → C (0,2 m): a mais apertada
    {
      const lado = 1, L1 = 20, L2 = 30;
      const jog = [
        { id: 7, time: 0, x: 2, z: -5 }, { id: 9, time: 0, x: L1 - 0.6, z: 8 }, { id: 10, time: 0, x: L2 - 0.2, z: -6 },
        { id: 104, time: 1, x: L1, z: 4 }, { id: 106, time: 1, x: L2, z: -2 }, { id: 101, time: 1, x: 51, z: 0, gol: true },
      ];
      const a = montarAnel(RA, NJ, J, {
        ini: 1000, fim: 1500, lado, jogadores: jog, marcas: { 1400: 1, 1440: 2 },
        fotos: [
          { de: 1000, ate: 1150, tick: 'novo', time: 0, por: 7, def: 104, linhaX: L1, lado },
          { de: 1151, ate: 1209, tick: 1150, time: 0, por: 7, def: 104, linhaX: L1, lado },
          { de: 1210, ate: 1300, tick: 'novo', time: 0, por: 9, def: 106, linhaX: L2, lado },
          { de: 1301, ate: 1359, tick: 1300, time: 0, por: 9, def: 106, linhaX: L2, lado },
          { de: 1360, ate: 1439, tick: 'novo', time: 0, por: 10, def: 106, linhaX: L2, lado },
        ],
      });
      const c = SA.checagemLegal(a, { golTick: 1440, time: 0, lado });
      const ok = !!c && c.idAtac === 10 && Math.abs(c.margem - 0.2) < 1e-3;
      if (ok) certos++;
      reg('S3 duas cadeias (0,6 e 0,2 m): mostra a mais apertada', c ? `jogador ${c.idAtac}, margem ${f2(c.margem)} m` : 'nenhuma', 'jogador 10, 0,20 m', ok);
    }
    reg('S3 critério da posição legal: cenas montadas certas', `${certos} de 10`, '10 de 10', certos === 10);
    // "Replay" da pausa: a cadeia que termina em chute mostra; a que não termina em chute nem gol, não
    {
      const L = lancePasse({ margem: 0.3, fim: 1500 });
      const a = montarAnel(RA, NJ, J, L);
      const rm = RR.roteiroMenu(a);
      const L2 = lancePasse({ margem: 0.3 }); L2.marcas = {};
      const a2 = montarAnel(RA, NJ, J, L2);
      const rm2 = RR.roteiroMenu(a2);
      reg('S3 "Replay" da pausa: com chute no fim mostra a análise; sem chute nem gol, não', `${rm ? rm.planos.map(p => p.cam).join(' → ') : '-'} × ${rm2 ? rm2.planos.map(p => p.cam).join(' → ') : '-'}`, 'tv → saot × tv',
        !!rm && rm.checagem && rm.planos.at(-1).cam === 'saot' && !!rm2 && !rm2.checagem && rm2.planos.length === 1);
    }
  }

  // ---------------------------------------------------------------- S5 selo (só no quadro final; nunca volta a 0)
  {
    const L = lancePasse({ margem: 0.3 });
    const al = montarAnel(RA, NJ, J, L);
    const rl = RR.roteiroLegalTeste(al);
    const a = anelJogo();
    const ri = RR.roteiroImpedimento(a, { fotoTick: 2150, apitoTick: 2240, linhaX: 5, idImpedido: 9, time: 0, lado: 1, defensor: 15, por: 4 });
    for (const [nome, ro] of [['impedimento', ri], ['legal', rl]]) {
      for (const qps of [60, 30]) {
        const t = tocar(ro, qps);
        const antes = t.selos.filter(s => s.selo > 0 && s.fase !== 'final').length;
        let i0 = t.selos.findIndex(s => s.selo > 0), voltou = 0;
        if (i0 >= 0) for (let i = i0; i < t.selos.length; i++) if (!(t.selos[i].selo > 0)) voltou++;
        const finais = t.selos.filter(s => s.fase === 'final').length, comSelo = t.selos.filter(s => s.fase === 'final' && s.selo > 0).length;
        reg(`S5 selo (${nome}, ${qps} qps): só no quadro final, sem piscar`, `antes do final ${antes}; depois de aparecer volta a 0 em ${voltou}; ${comSelo} de ${finais} quadros finais com selo`, '0, 0, ≥ 90%',
          antes === 0 && voltou === 0 && i0 >= 0 && comSelo >= 0.9 * finais);
      }
    }
    const tr = tocar(ri, 60, true);
    const u = tr.selos.every(s => s.u === 1), salto = tr.selos.findIndex(s => s.selo > 0), primeiro = salto >= 0 ? tr.selos[salto].selo : 0;
    reg('S5 "reduzir movimento": a análise já no quadro final (sem órbita) e o selo sem animação', `u = 1 em todos ${u}; 1º quadro com selo: ${f2(primeiro)}`, 'sim; 1', u && primeiro === 1);
  }

  // ---------------------------------------------------------------- S6 gol com checagem (montado)
  {
    const G = REPLAY.gol;
    const L = lancePasse({ margem: 0.3 });
    const a = montarAnel(RA, NJ, J, L);
    const g = { golTick: L.gol, chuteTick: L.chute, lado: L.lado, time: 0 };
    // no golaço o plano lateral come o orçamento: o passe checado perto do chute (o de 3,3 s antes não cabe: sem checagem)
    const Lg = lancePasse({ margem: 0.3, passe: 1330, recebe: 1360 });
    const ag = montarAnel(RA, NJ, J, Lg);
    for (const golaco of [false, true]) {
      const r = RR.roteiroGol(golaco ? ag : a, { ...g, golaco });
      const ult = r?.planos.at(-1), tv = r?.planos[0];
      const max = (golaco ? G.maximoGolaco : G.maximo) + S.extraGol;
      const ok = !!r && r.checagem && ult.cam === 'saot' && Math.abs(RR.duracao({ planos: [ult] }) - S.legal.dura) < 1e-9 && RR.duracao(r) <= max + 1e-9 && tv.cam === 'tv' && tv.de <= ult.saot.fotoTick - 30 && tv.ate >= ult.saot.fotoTick;
      reg(`S6 gol${golaco ? 'aço' : ''} com checagem (montado): a análise no fim, ≤ ${max} s, o passe dentro do plano de TV`, r ? `${r.planos.map(p => p.cam).join(' → ')}; ${f2(RR.duracao(r))} s; TV ${tv.de}–${tv.ate}, passe ${ult.saot?.fotoTick}` : '-', `… → saot; ≤ ${max} s; TV de ≤ passe − 30`, ok);
    }
    // sem checagem: igual ao de antes (sem time; sem cadeia apertada)
    const sem1 = RR.roteiroGol(a, { golTick: L.gol, chuteTick: L.chute, lado: L.lado });
    const L2 = lancePasse({ margem: 1.5 }); const a2 = montarAnel(RA, NJ, J, L2);
    const sem2 = RR.roteiroGol(a2, { golTick: L2.gol, chuteTick: L2.chute, lado: L2.lado, time: 0 });
    const h1 = roteiroGolHoje(a, { golTick: L.gol, chuteTick: L.chute, lado: L.lado }, REPLAY, CAMPO, RA.bolaNoTick);
    const h2 = roteiroGolHoje(a2, { golTick: L2.gol, chuteTick: L2.chute, lado: L2.lado, time: 0 }, REPLAY, CAMPO, RA.bolaNoTick);
    reg('S6 gol sem checagem: o roteiro é igual ao de antes (campo a campo)', `sem time ${igualProfundo(sem1, h1)}; sem cadeia apertada ${igualProfundo(sem2, h2)} (${sem2?.planos.map(p => p.cam).join(' → ')})`, 'iguais', igualProfundo(sem1, h1) && igualProfundo(sem2, h2));
  }

  // ---------------------------------------------------------------- S7 (montado: legal) e S4 (montado: câmera)
  {
    let ok7 = 0, n7 = 0;
    for (const c of casos) {
      if (!c) continue;
      n7++;
      if (c.margem >= -S.mesmaLinha - 1e-9 && c.partes.uAtac <= c.partes.uDef) ok7++;
    }
    reg('S7 legal (cenas montadas que mostram): quadril ≤ parede + 0,10 e nenhuma parte além do defensor', `${ok7} de ${n7}`, '100%', n7 > 0 && ok7 === n7);
  }
  const dentroMeta = e => e.el >= 12 - 1e-6 && e.el <= 24 + 1e-6 && Math.abs(e.desvio) >= 8 - 1e-6 && Math.abs(e.desvio) <= 25 + 1e-6;
  function conferirCamera(e, orb) {
    const naMeta = dentroMeta(e);
    return { ok: e.ok, naMeta, giro: orb.maxGiro, minY: orb.minY, solido: orb.solido, elIni: orb.elIni };
  }
  /**
   * Prova por busca fina: algum quadro de 12–24° e 8–25° fora do eixo (dos dois lados, a 9–60 m, a mesma mira do jogo)
   * cabe os dois com a folga, sem se taparem e com a câmera livre? (el e desvio de grau em grau, d de 0,5 em 0,5 m)
   */
  function algumQuadroNaMeta(c, asp) {
    const q = {};
    for (const lado of [1, -1]) for (let el = 12; el <= 24; el++) for (let dv = 8; dv <= 25; dv++) for (const sg of [1, -1]) {
      const az = lado > 0 ? sg * dv : 180 - sg * dv;
      for (let d = 9; d <= 60; d += 0.5) {
        SA.medirCandidato(c, el, az, d, asp, q);
        if (q.ok && dentroMeta(anguloDe(q))) return true;
      }
    }
    return false;
  }
  /** Elevação e desvio de verdade de um candidato (câmera → alvo). */
  function anguloDe(q) {
    const dx = q.cx - q.tx, dy = q.cy - q.ty, dz = q.cz - q.tz, d = Math.hypot(dx, dy, dz);
    const az = Math.atan2(dx, dz) * 180 / Math.PI;
    return { el: Math.asin(dy / d) * 180 / Math.PI, desvio: Math.abs(az) <= 90 ? az : (az > 0 ? 180 - az : -180 - az) };
  }
  {
    // grade montada: lados, x da linha, z do atacante e distância em z até o defensor (até 48 m: o quadro da TV, 9–30 m,
    // e o mesmo quadro mais longe)
    let n = 0, ok = 0, meta = 0, giroMax = 0, minY = Infinity, solidos = 0, elIniMin = Infinity;
    for (const lado of [1, -1]) for (const lx of [5, 35, 50]) for (const zB of [-30, 0, 30]) for (const dz of [1.5, 8, 20, 28, 36, 48]) for (const sg of [1, -1]) {
      const zD = zB + sg * dz;
      if (Math.abs(zD) > 33) continue;
      const L = lancePasse({ lado, linhaX: lx * lado, margem: -0.4, zB, zD });
      const a = montarAnel(RA, NJ, J, L);
      const c = SA.cenaImpedimento(a, { fotoTick: L.passe, id: 9, defensor: 104, por: 7, linhaX: L.linhaX, lado });
      for (const asp of [16 / 9, 844 / 390]) {
        const e = SA.enquadrarSaot(a, c, asp);
        const orb = medirOrbita(SA, FE, e, 'impedimento');
        const k = conferirCamera(e, orb);
        n++; if (k.ok) ok++; if (k.naMeta) meta++;
        giroMax = Math.max(giroMax, k.giro); minY = Math.min(minY, k.minY); if (k.solido) solidos++; elIniMin = Math.min(elIniMin, k.elIni);
      }
    }
    reg('S4 câmera (cenas montadas, os dois a até 48 m na largura; 16:9 e 844×390): os dois no quadro, sobreposição ≤ 30%', `${ok} de ${n}`, '100%', ok === n);
    reg('S4 câmera (montadas): termina a 12–24° de elevação e 8–25° fora do eixo da linha', `${meta} de ${n}`, '100%', meta === n);
    reg('S4 órbita (montadas, 60 qps): começa ≥ 60°, ≤ 3° por quadro, ≥ 2 m, fora dos sólidos', `começa ≥ ${f2(elIniMin)}°; giro máx ${f2(giroMax)}°/quadro; altura mín ${f2(minY)} m; ${solidos} em sólidos`, '≥ 60; ≤ 3; ≥ 2; 0',
      elIniMin >= 60 && giroMax <= 3 && minY >= 2 && solidos === 0);
  }

  // ---------------------------------------------------------------- lances de verdade (IA × IA): S2, S4, S6, S7, S8
  const t0 = Date.now();
  const sementes = Array.from({ length: NSEM }, (_, i) => i + 1);
  const res = await varrerSaot({ pastaJs, sementes, maxTicks: TICKS, threads: THREADS });
  const imped = res.flatMap(r => r.imped.map(i => ({ ...i, semente: r.semente })));
  const gols = res.flatMap(r => r.gols.map(g => ({ ...g, semente: r.semente })));
  reg('lances de verdade (IA × IA)', `${imped.length} impedimentos e ${gols.length} gols em ${NSEM} sementes × ${TICKS} passos (${((Date.now() - t0) / 1000).toFixed(0)} s)`, '≥ 3 impedimentos', imped.length >= 3);
  {
    const comDef = imped.filter(i => i.def != null);
    const certos = comDef.filter(i => i.distDef != null && i.distDef < 1e-4).length;
    reg('S2 o defensor do evento faz a linha: |x dele no passe − linhaX| < 1e-4 no anel', `${certos} de ${comDef.length} (${imped.length - comDef.length} com a linha na bola/meio)`, '100%', comDef.length > 0 && certos === comDef.length);
  }
  {
    let n = 0, ok = 0, naMeta = 0, extra = 0, provas = 0, giroMax = 0, minY = Infinity, solidos = 0, elIniMin = Infinity;
    const notas = [];
    const G2 = await import(pathToFileURL(path.join(AQUI, 'lib/anel-node.mjs')).href);
    for (const i of imped) {
      if (!i.enq) continue;
      for (const k of ['tv', 'cel']) {
        const e = i.enq[k];
        n++; if (e.ok) ok++;
        giroMax = Math.max(giroMax, e.orbita.maxGiro); minY = Math.min(minY, e.orbita.minY); if (e.orbita.solido) solidos++; elIniMin = Math.min(elIniMin, e.orbita.elIni);
        if (dentroMeta(e)) naMeta++;
        else { extra++; notas.push(`s${i.semente} t${i.tick} (${k}): os dois a ${f2(Math.abs(i.cena.atac.z - (i.cena.def?.z ?? i.cena.atac.z)))} m na largura → ${f2(e.el)}°, ${f2(e.desvio)}°`); }
      }
    }
    // prova: nos que ficaram fora da meta, nenhum quadro de 12–24°/8–25° cabe os dois (refaz a cena e procura)
    if (extra) {
      const Gv = await G2.criarGravador(pastaJs);
      for (const i of imped) {
        if (!i.enq || (dentroMeta(i.enq.tv) && dentroMeta(i.enq.cel))) continue;
        const Sx = Gv.novaPartida(i.semente);
        while (Sx.m.tick < i.tick) Gv.passo(Sx);
        const c = SA.cenaImpedimento(Sx.a, { fotoTick: i.foto, id: i.id, defensor: i.def, por: i.por, linhaX: i.linhaX, lado: i.lado });
        for (const [k, asp] of [['tv', 16 / 9], ['cel', 844 / 390]]) if (!dentroMeta(i.enq[k]) && c && c.def && !algumQuadroNaMeta(c, asp)) provas++;
      }
    }
    reg('S4 câmera nos impedimentos de verdade (16:9 e 844×390): os dois no quadro com 8% de folga, sobreposição ≤ 30%', `${ok} de ${n}`, '100%', n > 0 && ok === n);
    reg('S4 câmera nos impedimentos de verdade: termina a 12–24° e 8–25° fora do eixo', `${naMeta} de ${n}${extra ? `; fora: ${extra} — os dois longe na largura, sem quadro de 12–24° que caiba os dois (provado por busca em ${provas} de ${extra}): ${notas.join('; ')}` : ''}`,
      '100% dos que cabem', naMeta + provas === n);
    reg('S4 órbita nos impedimentos de verdade (60 qps): começa ≥ 60°, ≤ 3° por quadro, ≥ 2 m, fora dos sólidos', `começa ≥ ${f2(elIniMin)}°; giro máx ${f2(giroMax)}°/quadro; altura mín ${f2(minY)} m; ${solidos} em sólidos`, '≥ 60; ≤ 3; ≥ 2; 0',
      n > 0 && elIniMin >= 60 && giroMax <= 3 && minY >= 2 && solidos === 0);
  }
  {
    const P1 = imped.filter(i => i.planos);
    const dOk = P1.filter(i => i.planos.join() === 'linha,saot' && i.p1 <= 3.9 + 1e-9 && Math.abs(i.p2 - S.impedimento.dura) < 1e-9 && i.dur <= 7.5 + 1e-9).length;
    reg('S1 impedimentos de verdade: linha → saot, P1 ≤ 3,9 s, P2 3,6 s, ≤ 7,5 s', `${dOk} de ${P1.length}; durações ${P1.map(i => f2(i.dur)).join(', ')} s`, '100%', P1.length > 0 && dOk === P1.length);
    const c7 = P1.filter(i => i.margem != null);
    const ok7 = c7.filter(i => -i.margem > S.mesmaLinha).length;
    reg('S7 impedimento: o plano do atacante passa a parede > 0,10 m (em u)', `${ok7} de ${c7.length}; menor ${f2(Math.min(...c7.map(i => -i.margem)))} m`, '100%', c7.length > 0 && ok7 === c7.length);
    const contra = c7.filter(i => i.partes && i.partes.legalPartes).length;
    reg('INFO contradição centro × partes (impedido pelo centro, legal pelas partes do corpo)', `${contra} de ${c7.length}`, 'informativo', true, true);
    const c8 = P1.filter(i => i.pose);
    const ok8 = c8.filter(i => i.pose.minY >= -0.02 && (i.pose.peAtac ?? 0) <= 0.30 && (i.pose.peDef ?? 0) <= 0.30).length;
    reg('S8 pose da análise (a gravada): nenhuma junta < −0,02 m; o pé mais baixo do impedido e do defensor ≤ 0,30 m', `${ok8} de ${c8.length}; junta mín ${f2(Math.min(...c8.map(i => i.pose.minY)))} m; pés máx ${f2(Math.max(...c8.map(i => Math.max(i.pose.peAtac ?? 0, i.pose.peDef ?? 0))))} m`, '100%', c8.length > 0 && ok8 === c8.length);
  }
  {
    const com = gols.filter(g => g.checagem), sem = gols.filter(g => !g.checagem);
    const okCom = com.filter(g => g.dur <= (g.golaco ? REPLAY.gol.maximoGolaco : REPLAY.gol.maximo) + S.extraGol + 1e-9 && g.tvDe <= g.passe - 30 && g.tvAte >= g.passe && Math.abs(g.p2 - S.legal.dura) < 1e-9 && g.enq.tv.ok && g.enq.cel.ok).length;
    const okSem = sem.filter(g => g.igualHoje).length;
    reg('S6 gols de verdade sem checagem: o roteiro igual ao de antes', `${okSem} de ${sem.length}`, '100%', okSem === sem.length);
    reg('S6 gols de verdade com checagem: ≤ 13 s (golaço ≤ 15), o passe no plano de TV, a análise 3,4 s, enquadrada', `${okCom} de ${com.length}${com.length ? ` (margens ${com.map(g => f2(g.margem)).join(', ')} m; ${com.map(g => f2(g.dur)).join(', ')} s)` : ''}`, '100%', okCom === com.length);
    const ok7 = com.filter(g => g.margem >= -S.mesmaLinha - 1e-9 && g.partes && g.partes.uAtac <= g.partes.uDef).length;
    reg('S7 legal nos gols de verdade: quadril ≤ parede + 0,10 e nenhuma parte além do defensor', `${ok7} de ${com.length}`, '100%', ok7 === com.length);
    reg('INFO gols com a cena de posição legal (limite 1,0 m; com 0,5 m)', `${com.length} de ${gols.length} no replay; pela regra sem orçamento: ${gols.filter(g => g.legais['1'] != null).length} (1,0 m), ${gols.filter(g => g.legais['0.5'] != null).length} (0,5 m)`, 'informativo (medir-saot: 144 partidas)', true, true);
  }
}

// tabela
const w = linhas[0].map((_, k) => Math.max(...linhas.map(r => String(r[k]).length)));
for (const r of larg(linhas)) console.log(r.map((c, k) => (k === 1 ? c : c.padEnd(Math.min(w[k], 110)))).join('  '));
console.log(falhas ? `\nteste-saot: REPROVOU (${falhas})` : '\nteste-saot: PASSOU');
process.exit(falhas ? 1 : 0);
