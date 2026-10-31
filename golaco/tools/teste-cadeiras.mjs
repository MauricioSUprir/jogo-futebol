// Cadeiras e degraus das arquibancadas (item 69 da FILA, PR 1: a cadeira e o degrau; render/cadeiras-dados.js, PURO).
// A GRADE de cadeiras de cada planta é a fonte única da textura, do degrau em geometria e dos lugares da torcida, nas 3
// malhas de estádio: o Estádio Golaço (render/campo.js), a tigela do Maracanã (estadio-planta.js) e as genéricas
// (estadio-generico.js). Na main este teste reprova: o módulo não existe (a cadeira é só pintura numa rampa lisa).
//   C1) pureza: cadeiras-dados.js sem three.js nem DOM (roda em Node);
//   C2) as medidas da pesquisa (PESQUISA-ESTADIO.md §14): cadeira ≥ ~0,5 m (FIFA 2022: centros ≥ 500 mm), fileira ~0,8 m
//       (FIFA/Green Guide: 800 mm), ≤ 28 cadeiras entre escadas, escada ≥ 1,0 m, caimento ≤ 34° (Green Guide) no Golaço e
//       no Maracanã; a capacidade da grade perto da do estádio (o Golaço: as 29,6 mil cadeiras da textura de antes);
//   C3) a textura = a grade: cada cadeira cai na célula dela (o u na cadeira, o v na fileira; o piso embaixo, o espelho em
//       cima) e a volta (o ponto → a cadeira) acha a mesma cadeira;
//   C4) os lugares da torcida = cadeiras da grade (no piso do degrau, no centro do assento; um por cadeira), nas 3;
//   C5) o degrau no perfil das 3 malhas: piso horizontal e espelho vertical por fileira (perfilEmDegraus/aneisEmDegraus),
//       e as 3 malhas montam com ele (campo.js, estadio-real.js, estadio-generico.js);
//   C6) a escolha dos blocos de perto (escolherBlocos): longe/TV nenhum, perto ≥ 1 na frente da câmera, histerese
//       (entra ≥ pxEntra, fica até pxSai), teto de instâncias e de blocos, Baixa sem nenhum, o lado de cá fora com a câmera
//       dentro dele, nada atrás da câmera; a caixa da máscara contém as cadeiras do bloco;
//   C7) a cadeira rebatível: ~20 triângulos, largura ≤ 0,47 m, assento a ~0,43 m, encosto ≥ 30 cm acima dele (UEFA);
//   C8) o ORÇAMENTO de triângulos por quadro do 3D de perto (orcamentoPerto, criarOrcamento3D, corteDeCamera; PR 2): do nada
//       (depois do corte) tudo o que cabe com as pessoas primeiro; a histerese (desce só quando estoura, sobe 1 unidade por
//       quadro com margem); o corte de câmera; 6000 quadros com o resto andando ± 2,5 mil e pulando no corte: o total nunca
//       passa de 130 mil na Média, o quadro do corte sem 3D de perto e o seguinte com a escolha inteira; parado, nada pisca.
//   node tools/teste-cadeiras.mjs [--js <pasta js>] [--rapido (só 12 genéricas)]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const RAPIDO = args.includes('--rapido');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))]; };

let CD = null;
try { CD = await imp('render/cadeiras-dados.js'); } catch (_) { CD = null; }
if (!CD) {
  reg('C1 a grade das cadeiras (render/cadeiras-dados.js)', 'não existe (a cadeira é pintura numa rampa lisa, sem degrau)', 'existe', false);
} else {
  const fonte = f => fs.readFileSync(path.join(pastaJs, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // ---------------------------------------------------------------- C1
  {
    const s = fonte('render/cadeiras-dados.js');
    const ruins = ["from 'three'", 'document.', 'window.', 'navigator.', 'HTMLCanvas', 'getContext('].filter(t => s.includes(t));
    reg('C1 pureza: render/cadeiras-dados.js sem three.js nem DOM', ruins.length ? ruins.join(', ') : 'nenhum', 'nenhum', ruins.length === 0);
  }
  const { CADEIRA, NO_PISO } = CD;
  const base = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8')).estadios;
  const PL = await imp('estadio-planta.js');
  const GE = await imp('estadio-generico.js');
  const TD = await imp('render/torcida-dados.js');
  const { ESTADIO } = await imp('config.js');

  // ---------------------------------------------------------------- C2 (Golaço)
  const GG = CD.gradeGolaco();
  {
    const FL = CD.fileirasGolaco('lado'), FF = CD.fileirasGolaco('fundo');
    const prof = [...FL, ...FF].map(r => r.d1 - r.d0), caim = [...FL, ...FF].map(r => Math.atan2(r.y1 - r.y, r.d1 - r.d0) * 180 / Math.PI);
    // cadeiras entre escadas e a escada (células de 0,5 m)
    const A = CD.ARQ_GOLACO;
    let entre = 0, run = 0;
    for (let a = 0; a < 250; a++) { if (a % A.corredor < 2) { entre = Math.max(entre, run); run = 0; } else run++; }
    entre = Math.max(entre, run);
    reg('C2 Golaço: cadeira 0,5 m, fileira 0,83–0,87 m, ≤ 28 entre escadas (escada 1,0 m), caimento ≤ 34°',
      `cadeira ${fmt(A.assento, 2)} m; fileira ${fmt(Math.min(...prof), 3)}–${fmt(Math.max(...prof), 3)} m; ${entre} entre escadas; caimento ${fmt(Math.min(...caim), 1)}–${fmt(Math.max(...caim), 1)}°`,
      '0,5; 0,75–0,9; ≤ 28; ≤ 34°', A.assento >= 0.5 && Math.min(...prof) >= 0.75 && Math.max(...prof) <= 0.9 && entre <= CADEIRA.entreEscadas && Math.max(...caim) <= CADEIRA.caimentoMax);
    const nCad = TD.cadeiras().length;
    reg('C2 Golaço: a capacidade da grade = as cadeiras da textura de antes (36 × 250, sem escadas, os fundos até 82%, sem o túnel)', `${GG.capacidade} cadeiras (torcida-dados.js cadeiras(): ${nCad})`, '29.500–29.700 e iguais', GG.capacidade >= 29500 && GG.capacidade <= 29700 && nCad === GG.capacidade);
  }
  // ---------------------------------------------------------------- C2 (Maracanã)
  const PM = PL.criarPlanta(PL.validarForma(base.maracana.forma));
  const GM = PM.grade;
  /** As medidas de uma grade de anel: larguras (p1/p50/p99), fileiras (profundidade média de cada uma pela volta), escada. */
  function medidasAnel(P, G) {
    const largs = [];
    let cap = 0;
    G.iterar(c => { cap++; largs.push(c.larg); });
    const profs = [], caims = [];
    for (const r of G.fileiras) {
      let soma = 0, n = 0, cmax = 0;
      for (let i = 0; i < 90; i++) {
        const th = -Math.PI + (2 * Math.PI * (i + 0.5)) / 90, D = P.rB(th) - P.rF(th);
        if (D < 2.5) continue;
        const p = D * (r.s1 - r.s0); soma += p; n++;
        const sub = (P.perfil.length > 1 ? P.perfil(r.s1, th) - P.perfil(r.s0, th) : P.perfil(r.s1) - P.perfil(r.s0));
        cmax = Math.max(cmax, Math.atan2(sub, p) * 180 / Math.PI);
      }
      if (n) { profs.push(soma / n); caims.push(cmax); }
    }
    return { cap, l1: pct(largs, 0.01), l50: pct(largs, 0.5), l99: pct(largs, 0.99), p0: Math.min(...profs), p1: Math.max(...profs), pm: pct(profs, 0.5), p10: pct(profs, 0.1), entre: Math.max(...G.fileiras.map(r => r.n)), caim: Math.max(...caims) };
  }
  {
    const m = medidasAnel(PM, GM);
    // a escada radial do Maracanã é a da textura aprovada nas rodadas da prévia (8% do gomo: 0,6 m na 1ª fileira, 1,1 m na
    // última); a pesquisa pede 1,2 m (SGSA SG02) — PR 4 calibra (aqui só não pode ficar mais estreita que isso)
    let perim0 = 0, px = 0, pz = 0;
    for (let i = 0; i <= 720; i++) { const [x, z] = PM.ponto(-Math.PI + (2 * Math.PI * i) / 720, 0); if (i) perim0 += Math.hypot(x - px, z - pz); px = x; pz = z; }
    const escada = (GM.corredor * perim0) / PM.forma.corredores;
    reg('C2 Maracanã: cadeira ≥ ~0,5 m (p1–p99 0,42–0,62), fileira 0,7–1,0 m, ≤ 28 entre escadas, escada ≥ 0,55 m na 1ª fileira, caimento ≤ 34°',
      `cadeira p1 ${fmt(m.l1, 2)} · p50 ${fmt(m.l50, 2)} · p99 ${fmt(m.l99, 2)} m; ${GM.NF} fileiras de ${fmt(m.p0, 2)}–${fmt(m.p1, 2)} m (mediana ${fmt(m.pm, 2)}); ${m.entre} entre escadas; escada ${fmt(escada, 2)} m (1ª fileira); caimento ≤ ${fmt(m.caim, 1)}°`,
      'p1 ≥ 0,42, p99 ≤ 0,62; 0,7–1,0; ≤ 28; ≥ 0,55; ≤ 34°', m.l1 >= 0.42 && m.l99 <= 0.62 && m.p0 >= 0.7 && m.p1 <= 1.0 && m.entre <= 28 && escada >= 0.55 && m.caim <= CADEIRA.caimentoMax);
    const capReal = base.maracana.capacidade;
    reg('C2 Maracanã: a capacidade da grade perto da real (±15%)', `${m.cap} cadeiras × ${capReal} (${fmt(100 * (m.cap / capReal - 1), 1)}%)`, '±15%', Math.abs(m.cap / capReal - 1) <= 0.15);
  }
  // ---------------------------------------------------------------- C2 (genéricas)
  const genericas = Object.entries(base).filter(([k, e]) => k !== 'maracana' && e.forma && GE.validarFormaGenerica(e.forma));
  const amostra = RAPIDO ? genericas.filter((_, i) => i % 9 === 0) : genericas;
  const plantasG = [];
  {
    const razoes = [], ruinsL = [], ruinsP = [], ruinsE = [];
    for (const [k, e] of amostra) {
      const P = GE.criarPlantaGenerica(GE.validarFormaGenerica(e.forma));
      plantasG.push([k, P, e]);
      const m = medidasAnel(P, P.grade);
      razoes.push([k, m.cap / e.capacidade]);
      if (m.l1 < 0.4 || m.l99 > 0.8 || m.l50 < 0.46 || m.l50 > 0.62) ruinsL.push(`${k} ${fmt(m.l1, 2)}/${fmt(m.l50, 2)}/${fmt(m.l99, 2)}`);
      if (Math.abs(m.pm - CADEIRA.fileira) > 0.12 || m.p10 < 0.55) ruinsP.push(`${k} ${fmt(m.p10, 2)}/${fmt(m.pm, 2)}`);
      if (m.entre > 28) ruinsE.push(k);
    }
    reg(`C2 genéricas (${amostra.length}): cadeira p1 ≥ 0,40, p50 0,46–0,62, p99 ≤ 0,80 m; fileira (média pela volta) mediana 0,8 ± 0,12 m e p10 ≥ 0,55; ≤ 28 entre escadas (escada 1,2 m)`,
      `${ruinsL.length ? 'largura: ' + ruinsL.slice(0, 4).join('; ') : 'larguras ok'}; ${ruinsP.length ? 'fileira: ' + ruinsP.slice(0, 4).join('; ') : 'fileiras ok'}; ${ruinsE.length ? 'entre escadas: ' + ruinsE.join(', ') : '≤ 28'}`,
      'todas', !ruinsL.length && !ruinsP.length && !ruinsE.length);
    const rs = razoes.map(r => r[1]), dentro = rs.filter(r => r >= 0.65 && r <= 1.35).length;
    const fora = razoes.filter(r => r[1] < 0.65 || r[1] > 1.35).sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1)).slice(0, 5).map(([k, r]) => `${k} ${fmt(r, 2)}`);
    reg('C2 genéricas: a capacidade da grade perto da real (mediana 0,8–1,2; ≥ 75% dentro de ±35%; a forma de cada um é a da pesquisa: o PR 4 calibra)',
      `mediana ${fmt(pct(rs, 0.5), 2)} (p10 ${fmt(pct(rs, 0.1), 2)}, p90 ${fmt(pct(rs, 0.9), 2)}); ${dentro}/${rs.length} dentro${fora.length ? '; mais longe: ' + fora.join(', ') : ''}`,
      'mediana 0,8–1,2; ≥ 75%', pct(rs, 0.5) >= 0.8 && pct(rs, 0.5) <= 1.2 && dentro >= 0.75 * rs.length);
  }

  // ---------------------------------------------------------------- C3 textura = grade
  {
    // Golaço: o u da malha (x ou z pela arquibancada) cai na célula a e o v (o piso pelo bico → fundo) na fileira f
    const A = CD.ARQ_GOLACO, nA = 250, FL = CD.fileirasGolaco('lado'), FF = CD.fileirasGolaco('fundo');
    let ruins = 0, n = 0, volta = 0;
    GG.iterar(c => {
      n++;
      const lado = c.setor === 0 || c.setor === 3;
      const u = lado ? (c.x + A.meioComprimento) / A.comprimento : (c.setor === 1 ? (A.frenteZ - c.z) : (c.z + A.frenteZ + A.profLado)) / A.comprimento;
      const r = (lado ? FL : FF)[A.fileiras - 1 - c.f];
      const d = lado ? Math.abs(c.z) - A.frenteZ : Math.abs(c.x) - A.fundoX0;
      const v = r.v0 + ((d - r.d0) / (r.d1 - r.d0)) * (r.vm - r.v0);
      const fCel = A.fileiras - 1 - Math.floor((v / A.vMax) * A.fileiras);
      if (Math.floor(u * nA) !== c.a || fCel !== c.f || v < r.v0 || v > r.vm || Math.abs(c.y - r.y) > 1e-9) ruins++;
      const q = GG.assentoEm(c.x, c.z, c.setor);
      if (q && q.chave === c.chave) volta++;
    });
    reg('C3 Golaço: cada cadeira na célula dela da textura (u na cadeira, v no PISO da fileira) e a volta acha a mesma', `${ruins} fora de ${n}; volta ${volta}/${n}`, '0; todas', ruins === 0 && volta === n);
    // anéis: o u da cadeira na metade/cadeira dela (a escada nos primeiros `corredor` da metade) e a volta
    const confere = (P, G) => {
      let ruinsA = 0, nA2 = 0, voltaA = 0, emEscada = 0;
      G.iterar(c => {
        nA2++;
        const tr = G.trechos[0].k == null || G.trechos.length === 1 ? G.trechos[0] : G.trechos[P.trechoDe ? P.trechoDe(c.x, c.z) : 0];
        const u = tr.uDe(c.th, c.s), w = (u - Math.floor(u)) * 2, h = Math.floor(w), q = w - h;
        if (q < G.corredor) emEscada++;
        const i = Math.floor(((q - G.corredor) / (1 - G.corredor)) * c.n);
        const r = G.fileiras[c.k], v = P.vDe ? P.vDe(c.s) : 0.04 + 0.93 * c.s;
        if (h !== c.h || i !== c.i || v < r.v0 - 1e-9 || v > r.v1 + 1e-9) ruinsA++;
        const ti = P.trechoDe ? P.trechoDe(c.x, c.z) : 0;
        const b = G.assentoEm(c.th, c.s, ti);
        if (b && b.chave === c.chave) voltaA++;
      });
      return { ruinsA, nA2, voltaA, emEscada };
    };
    const rm = confere(PM, GM);
    reg('C3 Maracanã: cada cadeira na célula dela da textura (a metade do ladrilho e a cadeira; a fileira) e a volta acha a mesma', `${rm.ruinsA} fora de ${rm.nA2}; na escada ${rm.emEscada}; volta ${rm.voltaA}/${rm.nA2}`, '0; 0; ≥ 99,9%', rm.ruinsA === 0 && rm.emEscada === 0 && rm.voltaA >= 0.999 * rm.nA2);
    const amostraT = plantasG.filter((_, i) => i % Math.max(1, Math.floor(plantasG.length / 8)) === 0);
    let ru = 0, nn = 0, vv = 0, esc = 0;
    for (const [, P] of amostraT) { const r = confere(P, P.grade); ru += r.ruinsA; nn += r.nA2; vv += r.voltaA; esc += r.emEscada; }
    reg(`C3 genéricas (${amostraT.length}): cada cadeira na célula dela e a volta acha a mesma`, `${ru} fora de ${nn}; na escada ${esc}; volta ${vv}/${nn}`, '0; 0; ≥ 99,5%', ru === 0 && esc === 0 && vv >= 0.995 * nn);
    // o pintor: a escada sem cor, cada célula com uma cor e a mesma cor duas vezes (a textura e a cadeira 3D)
    const pg = CD.pintorGolaco({ comTexto: false }), pg2 = CD.pintorGolaco({ comTexto: false });
    let corr = 0, iguais = 0, tot = 0;
    for (let f = 0; f < 36; f++) for (let a = 0; a < 250; a++) { const c = pg(f, a); if (!c) { if (a % 26 < 2) corr++; continue; } tot++; if (c.cor === pg2(f, a).cor) iguais++; }
    reg('C3 o pintor da grade: a escada sem cadeira e a mesma cor por cadeira em toda chamada (a textura = a cadeira 3D)', `${corr} células de escada (de ${36 * 20}); ${iguais}/${tot} iguais`, `${36 * 20}; todas`, corr === 36 * 20 && iguais === tot);
  }

  // ---------------------------------------------------------------- C4 lugares = cadeiras
  {
    // Golaço: a torcida (todas as qualidades: a Alta) em cima das cadeiras (± 6 cm de sorteio na x)
    const R = TD.gerarTorcida('alta');
    let fora = 0;
    const usadas = new Set();
    let repetidas = 0;
    for (let i = 0; i < R.n; i++) {
      const x = R.pos[4 * i], y = R.pos[4 * i + 1], z = R.pos[4 * i + 2], st = Math.round(R.info[4 * i + 1] / 85);
      let c = null;
      for (const dx of [0, -0.25, 0.25]) { const q = GG.assentoEm(x + dx, z, st); if (q && Math.hypot(q.x - x, q.z - z) <= 0.07) { c = q; break; } }
      if (!c || Math.abs(c.y - y) > 1e-6) { fora++; continue; }
      if (usadas.has(c.chave)) repetidas++; usadas.add(c.chave);
    }
    reg('C4 Golaço: cada torcedor numa cadeira da grade (o piso, o assento ± 6 cm), um por cadeira', `${R.n} torcedores; ${fora} fora; ${repetidas} na mesma cadeira`, '0; 0', fora === 0 && repetidas === 0 && R.n > 20000);
    const lugaresOk = (P, G) => {
      let n = 0, foraL = 0, rep = 0;
      const vis = new Set();
      const ch = new Map();
      G.iterar(c => ch.set(`${c.x.toFixed(3)}|${c.z.toFixed(3)}`, c));
      P.lugares.iterar((st, f, a, x, y, z) => {
        n++;
        const c = ch.get(`${x.toFixed(3)}|${z.toFixed(3)}`);
        if (!c || Math.abs(c.y - y) > 1e-6) { foraL++; return; }
        if (vis.has(c.chave)) rep++; vis.add(c.chave);
      });
      return { n, foraL, rep };
    };
    const lm = lugaresOk(PM, GM);
    reg('C4 Maracanã: cada lugar da torcida é uma cadeira da grade (o piso, o centro do assento), um por cadeira', `${lm.n} lugares; ${lm.foraL} fora; ${lm.rep} repetidos`, '0; 0', lm.foraL === 0 && lm.rep === 0 && lm.n > 15000);
    let n = 0, fL = 0, rp = 0;
    const amostraL = plantasG.filter((_, i) => i % Math.max(1, Math.floor(plantasG.length / 6)) === 0);
    for (const [, P] of amostraL) { const r = lugaresOk(P, P.grade); n += r.n; fL += r.foraL; rp += r.rep; }
    reg(`C4 genéricas (${amostraL.length}): cada lugar da torcida é uma cadeira da grade, um por cadeira`, `${n} lugares; ${fL} fora; ${rp} repetidos`, '0; 0', fL === 0 && rp === 0 && n > 0);
  }

  // ---------------------------------------------------------------- C5 o degrau no perfil das 3 malhas
  {
    const escada = nos => {
      // nós [d, y, v]: alterna piso (y igual) e espelho (d igual), o espelho sobe, o v cresce
      let pisos = 0, espelhos = 0, ruins = 0;
      for (let i = 0; i + 1 < nos.length; i++) {
        const [d0, y0, v0] = nos[i], [d1, y1, v1] = nos[i + 1];
        if (Math.abs(y1 - y0) < 1e-9 && d1 > d0) pisos++;
        else if (Math.abs(d1 - d0) < 1e-9 && y1 > y0) espelhos++;
        else if (!(Math.abs(d1 - d0) < 1e-9 && Math.abs(y1 - y0) < 1e-9)) ruins++;
        if (v1 < v0 - 1e-9) ruins++;
      }
      return { pisos, espelhos, ruins };
    };
    const gl = escada(CD.perfilEmDegraus(CD.fileirasGolaco('lado'))), gf = escada(CD.perfilEmDegraus(CD.fileirasGolaco('fundo')));
    // por faixa (entre duas faixas de cadeira fica a face/o corredor do perfil, que a malha põe no meio)
    const deg = G => { const t = { pisos: 0, espelhos: 0, ruins: 0 }; for (const fx of new Set(G.fileiras.map(r => r.faixa))) { const e = escada(CD.aneisEmDegraus(G.fileiras.filter(r => r.faixa === fx))); t.pisos += e.pisos; t.espelhos += e.espelhos; t.ruins += e.ruins; } return t; };
    const mm = deg(GM);
    const gg = deg(plantasG[0][1].grade);
    const src = { campo: fonte('render/campo.js'), real: fonte('render/estadio-real.js'), gen: fonte('render/estadio-generico.js') };
    const usa = {
      campo: /fileirasGolaco\('lado'\)/.test(src.campo) && /fileirasGolaco\('fundo'\)/.test(src.campo) && /r\.vm, r\.v1/.test(src.campo),
      real: /aneisEmDegraus\(/.test(src.real) && /sLiso\(/.test(src.real),
      gen: /aneisEscada\(/.test(src.gen) && /sLiso\(/.test(src.gen),
    };
    reg('C5 o degrau em escada (piso horizontal + espelho vertical por fileira) nas 3 malhas',
      `Golaço lado ${gl.pisos}/${gl.espelhos}, fundos ${gf.pisos}/${gf.espelhos}; Maracanã ${mm.pisos}/${mm.espelhos}; genérica ${gg.pisos}/${gg.espelhos}; ruins ${gl.ruins + gf.ruins + mm.ruins + gg.ruins}; as malhas usam: campo.js ${usa.campo}, estadio-real.js ${usa.real}, estadio-generico.js ${usa.gen}`,
      'pisos = espelhos = fileiras; 0 ruins; as 3 usam',
      gl.pisos === 36 && gl.espelhos === 36 && gf.pisos === 30 && gf.espelhos === 30 && mm.pisos === GM.NF && mm.espelhos >= GM.NF - 1 && gg.pisos >= 10 && gl.ruins + gf.ruins + mm.ruins + gg.ruins === 0 && usa.campo && usa.real && usa.gen);
    // o LOD do degrau das curvas: a escada entra até a distância máxima da cadeira 3D (nenhuma cadeira 3D em cima da lisa:
    // a caixa do setor está mais perto que a do bloco), com histerese; na câmera de jogo (a TV) sempre a lisa (o custo da TV
    // não sobe) — campo.js trocarLod(..., soLisa) com o deJogo da câmera
    const L = CD.DEGRAU_LOD, D3 = CD.CADEIRAS3D;
    const tvLisa = /soLisa/.test(src.campo) && /atualizarLod\?\.\(camera\.position, deJogo\)/.test(src.campo)
      && /\(pos, soLisa\) => trocarLod\(malhas, pos, soLisa\)/.test(src.real) && /\(pos, soLisa\) => trocarLod\(malhas, pos, soLisa\)/.test(src.gen);
    reg('C5 o LOD do degrau das curvas: escada até a distância máxima da cadeira 3D, com histerese; na TV sempre a lisa',
      `entra ${L.entra} m, sai ${L.sai} m; cadeira 3D até ${D3.distMax} m; TV na lisa: ${tvLisa}`, 'entra ≥ distMax; sai > entra; sim',
      L.entra >= D3.distMax && L.sai > L.entra && tvLisa);
    // o torcedor senta no piso: o assento a NO_PISO da profundidade da fileira (o encosto encostado no espelho de trás)
    const r = CD.fileirasGolaco('lado')[10], frente = NO_PISO * (r.d1 - r.d0) - CADEIRA.assento.fundo / 2;
    reg('C5 o assento no piso: a passagem livre na frente ≥ 0,25 m e o encosto dentro da fileira', `passagem ${fmt(frente, 2)} m; o encosto a ${fmt((1 - NO_PISO) * (r.d1 - r.d0) - CADEIRA.assento.fundo / 2, 2)} m do espelho`, '≥ 0,25; ≥ 0', frente >= 0.25 && (1 - NO_PISO) * (r.d1 - r.d0) - CADEIRA.assento.fundo / 2 >= 0);
  }

  // ---------------------------------------------------------------- C6 a escolha dos blocos
  {
    const cam = (de, para, fov = 50, alturaPx = 390) => { const d = [para[0] - de[0], para[1] - de[1], para[2] - de[2]], l = Math.hypot(...d); return { x: de[0], y: de[1], z: de[2], fx: d[0] / l, fy: d[1] / l, fz: d[2] / l, fov, aspecto: 844 / 390, alturaPx }; };
    const B = GG.blocos, O = { teto: CD.CADEIRAS3D.teto.media };
    const tv = CD.escolherBlocos(B, cam([0, 12.3, 46], [0, 0, -5], 32), new Set(), O);
    const tvPc = CD.escolherBlocos(B, cam([0, 18.3, 40], [0, 0, 0], 32, 720), new Set(), { teto: CD.CADEIRAS3D.teto.alta });
    const perto = CD.escolherBlocos(B, cam([0, 3, -40], [0, 8, -60], 55), new Set(), O);
    const atras = CD.escolherBlocos(B, cam([0, 3, -40], [0, 8, 0], 55), new Set(), O);
    const baixa = CD.escolherBlocos(B, cam([0, 3, -40], [0, 8, -60], 55), new Set(), { teto: CD.CADEIRAS3D.teto.baixa });
    const naFrente = perto.lista.every(i => (B[i].c[2] - -40) * -1 > -B[i].raio);
    reg('C6 escolha: TV (celular e PC) nenhum bloco; perto do lado de lá ≥ 1 (na frente da câmera); olhando para o outro lado nenhum de lá; Baixa nenhum',
      `TV ${tv.lista.length} / PC ${tvPc.lista.length}; perto ${perto.lista.length} blocos (${perto.instancias} cadeiras), na frente ${naFrente}; de costas ${atras.lista.filter(i => B[i].setor === 0).length}; Baixa ${baixa.lista.length}`,
      '0/0; ≥ 1, sim; 0; 0', tv.lista.length === 0 && tvPc.lista.length === 0 && perto.lista.length >= 1 && naFrente && atras.lista.filter(i => B[i].setor === 0).length === 0 && baixa.lista.length === 0);
    // histerese: um bloco só, a câmera se afastando — entra com ≥ pxEntra, fica até pxSai
    const b0 = { n: 96, c: [0, 5, -60], raio: 1, setor: 0 };
    const px = d => (CADEIRA.largura * 390) / (2 * Math.max(0.5, d - 1) * Math.tan((50 * Math.PI) / 360));
    const dDe = p => (CADEIRA.largura * 390) / (2 * p * Math.tan((50 * Math.PI) / 360)) + 1;
    const c = d => cam([0, 5, -60 + d], [0, 5, -80], 50);
    const sEntra = CD.escolherBlocos([b0], c(dDe(CD.CADEIRAS3D.pxEntra + 0.5)), new Set(), O).lista.length;
    const sMeioNovo = CD.escolherBlocos([b0], c(dDe((CD.CADEIRAS3D.pxEntra + CD.CADEIRAS3D.pxSai) / 2)), new Set(), O).lista.length;
    const sMeioJa = CD.escolherBlocos([b0], c(dDe((CD.CADEIRAS3D.pxEntra + CD.CADEIRAS3D.pxSai) / 2)), new Set([0]), O).lista.length;
    const sSai = CD.escolherBlocos([b0], c(dDe(CD.CADEIRAS3D.pxSai - 0.5)), new Set([0]), O).lista.length;
    reg('C6 histerese: entra com ≥ pxEntra; entre pxSai e pxEntra fica quem já estava e não entra quem não estava; abaixo de pxSai sai',
      `entra ${sEntra}; no meio novo ${sMeioNovo}, já estava ${sMeioJa}; abaixo ${sSai} (px ${fmt(px(dDe(CD.CADEIRAS3D.pxSai - 0.5)), 1)})`, '1; 0, 1; 0', sEntra === 1 && sMeioNovo === 0 && sMeioJa === 1 && sSai === 0);
    // teto e o lado de cá
    const muitos = CD.escolherBlocos(B, cam([0, 6, -46], [0, 6, -70], 90, 720), new Set(), { teto: 200 });
    const blocosMax = CD.escolherBlocos(B, cam([0, 6, -46], [0, 6, -70], 90, 720), new Set(), { teto: 1e6 });
    const dentroCa = cam([0, 12.3, 52], [0, 2, -10], 38);
    const comCa = CD.escolherBlocos(B, dentroCa, new Set(), O), semCa = CD.escolherBlocos(B, dentroCa, new Set(), { ...O, semSetor: 3 });
    reg('C6 teto de instâncias e de blocos; com a câmera dentro do lado de cá, nenhum bloco dele',
      `teto 200 → ${muitos.instancias} cadeiras; sem teto → ${blocosMax.lista.length} blocos (máx ${CD.CADEIRAS3D.blocosMax}); câmera de TV dentro do lado de cá: ${comCa.lista.filter(i => B[i].setor === 3).length} → ${semCa.lista.filter(i => B[i].setor === 3).length}`,
      '≤ 200; ≤ blocosMax; → 0', muitos.instancias <= 200 && blocosMax.lista.length <= CD.CADEIRAS3D.blocosMax && semCa.lista.filter(i => B[i].setor === 3).length === 0);
    // a caixa da máscara contém as cadeiras do bloco (a pintada some debaixo de TODA cadeira 3D)
    const dentroCx = (b, a) => { const k = b.caixa, dx = a.x - k.c[0], dz = a.z - k.c[2], al = dx * k.eixo[0] + dz * k.eixo[1], at = -dx * k.eixo[1] + dz * k.eixo[0]; return Math.abs(al) <= k.e[0] && Math.abs(a.y + 0.2 - k.c[1]) <= k.e[1] && Math.abs(at) <= k.e[2]; };
    let tot = 0, fora = 0;
    for (const G of [GG, GM, plantasG[0][1].grade]) for (let i = 0; i < G.blocos.length; i += 7) for (const a of G.assentosDoBloco(i)) { tot++; if (!dentroCx(G.blocos[i], a)) fora++; }
    reg('C6 a caixa da máscara de cada bloco contém as cadeiras dele (Golaço, Maracanã, genérica)', `${fora} fora de ${tot}`, '0', fora === 0 && tot > 1000);
  }

  // ---------------------------------------------------------------- C7 a cadeira
  {
    const g = CD.geometriaCadeira(), p = g.posicao;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
    const S = CADEIRA.assento;
    reg('C7 a cadeira rebatível: 14–24 triângulos, largura ≤ 0,47 m, assento a 0,40–0,46 m, encosto ≥ 0,30 m acima dele (UEFA), cabe na fileira (≤ 0,6 m)',
      `${g.triangulos} triângulos; ${fmt(x1 - x0, 2)} × ${fmt(y1 - y0, 2)} × ${fmt(z1 - z0, 2)} m; assento ${fmt(S.altura, 2)} m; encosto ${fmt(y1 - S.altura, 2)} m acima`,
      'todas', g.triangulos >= 14 && g.triangulos <= 24 && x1 - x0 <= 0.47 && S.altura >= 0.4 && S.altura <= 0.46 && y1 - S.altura >= 0.3 && z1 - z0 <= 0.6 && y0 >= 0);
    void ESTADIO;
  }

  // ---------------------------------------------------------------- C8 o orçamento de triângulos por quadro
  if (!CD.orcamentoPerto || !CD.criarOrcamento3D || !CD.corteDeCamera) {
    reg('C8 o orçamento de triângulos por quadro do 3D de perto (orcamentoPerto, criarOrcamento3D, corteDeCamera)', 'não existe (só os tetos fixos por qualidade: o plano do placar do pós-jogo passava dos 130 mil)', 'existe', false);
  } else {
    const OR = CD.ORCAMENTO3D, TRI = [306, 128], TC = CD.geometriaCadeira().triangulos, M = OR.margem;
    // um desejo de exemplo: 6 blocos de 96 cadeiras (px 40 → 15) com 4 fileiras de 24 torcedores cada (as de baixo mais perto)
    const desejoEx = (pxs = [40, 34, 28, 22, 18, 15]) => ({
      blocos: pxs.map((px, i) => ({ i, px, n: 96 })),
      fileiras: pxs.flatMap((px, i) => [0, 1, 2, 3].map(f => ({ chave: `${i}:${f}`, bloco: i, px: px - f, n: 24, nivel: px - f >= 30 ? 0 : 1 }))),
      tri: TRI, triCadeira: TC,
    });
    const D = desejoEx();
    const custo = r => [...r.blocos].length * 96 * TC + [...r.fileiras].reduce((s, [, l]) => s + 24 * TRI[l], 0);
    // a) do nada (o quadro depois do corte): tudo o que cabe em orçamento − margem; as pessoas antes das cadeiras sem
    //    ninguém e as de mais px primeiro; o torcedor só em bloco com cadeira 3D; orçamento sobrando: tudo; zero: nada
    {
      const casos = [0, 3000, 6000, 12000, 25000, 60000, 1e9].map(B => [B, CD.orcamentoPerto(D, null, { orcamento: B, novo: true })]);
      const ruins = [];
      for (const [B, r] of casos) {
        if (r.total > Math.max(0, B - M) || custo(r) !== r.total) ruins.push(`${B}: total ${r.total}`);
        for (const [ch] of r.fileiras) if (!r.blocos.has(+ch.split(':')[0])) ruins.push(`${B}: ${ch} sem a cadeira`);
        // nenhuma fileira de fora com mais px que uma de dentro coube e ficou de fora (as pessoas primeiro, as de mais px antes)
        const dentro = [...r.fileiras.keys()], fora = D.fileiras.filter(f => !r.fileiras.has(f.chave));
        const semGente = [...r.blocos].filter(i => !dentro.some(ch => +ch.split(':')[0] === i));
        if (semGente.length && fora.some(f => r.blocos.has(f.bloco) && r.total - 0 + 24 * TRI[1] <= B - M)) ruins.push(`${B}: cadeira sem gente antes de quem cabia`);
      }
      const tudo = casos.at(-1)[1], nada = casos[0][1], aperto = casos.find(([, r]) => r.fileiras.size > 0)[1];
      const primeira = [...aperto.fileiras.keys()];
      reg('C8 do nada (depois do corte): ≤ orçamento − margem; o torcedor só na cadeira 3D; as pessoas antes das cadeiras sem gente, as de mais px primeiro; sobrando, tudo; zero, nada',
        `${casos.map(([B, r]) => `${B >= 1e9 ? '∞' : B / 1000 + 'k'} → ${r.fileiras.size} fil. + ${r.blocos.size} bl. (${(r.total / 1000).toFixed(1)}k)`).join(' · ')}; a 1ª fileira que cabe: ${primeira.join(',') || 'nenhuma'}; ${ruins.length ? ruins.slice(0, 3).join(' | ') : 'nenhum erro'}`,
        '0 erros; ∞ = tudo; 0 = nada; a 1ª = a de mais px',
        ruins.length === 0 && tudo.fileiras.size === D.fileiras.length && tudo.blocos.size === D.blocos.length && nada.total === 0 && primeira.length >= 1 && primeira.includes('0:0'));
    }
    // b) a histerese: estourou → desce (primeiro as cadeiras sem gente, depois o nível 0 vira 1, depois a fileira de menos px
    //    sai) até caber; abaixo do orçamento mas dentro da margem → fica igual; com folga → sobe UMA unidade por quadro
    {
      const cheio = CD.orcamentoPerto(D, null, { orcamento: 40000, novo: true });
      const at = { blocos: cheio.blocos, fileiras: cheio.fileiras };
      const desce = CD.orcamentoPerto(D, at, { orcamento: cheio.total - 1500 });
      const semGenteAntes = [...cheio.blocos].filter(i => ![...cheio.fileiras.keys()].some(ch => +ch.split(':')[0] === i)).length;
      const desceMuito = CD.orcamentoPerto(D, at, { orcamento: 9000 });
      const fica = CD.orcamentoPerto(D, at, { orcamento: cheio.total + M - 1 });
      const sobe = CD.orcamentoPerto(D, at, { orcamento: cheio.total + 20000 });
      const ig = (a, b) => a.blocos.size === b.blocos.size && [...a.blocos].every(i => b.blocos.has(i)) && a.fileiras.size === b.fileiras.size && [...a.fileiras].every(([k, l]) => b.fileiras.get(k) === l);
      const l0 = [...desceMuito.fileiras.values()].filter(l => l === 0).length;
      reg('C8 a histerese: estourou desce até caber (as cadeiras sem gente primeiro, o nível 0 vira 1, a fileira de menos px sai); dentro da margem fica igual; com folga sobe 1 unidade por quadro',
        `cheio ${(cheio.total / 1000).toFixed(1)}k (${cheio.fileiras.size} fil., ${semGenteAntes} bl. sem gente); −1,5k → ${(desce.total / 1000).toFixed(1)}k (${desce.fileiras.size} fil., ${desce.blocos.size} bl.); 9k → ${(desceMuito.total / 1000).toFixed(1)}k (${desceMuito.fileiras.size} fil., ${l0} no nível 0); +margem−1 → ${ig(fica, cheio) ? 'igual' : 'MUDOU'}; +20k → +${sobe.subiu} unidade (${(sobe.total / 1000).toFixed(1)}k)`,
        '≤ orçamento; as mesmas fileiras ao tirar 1,5k (saiu cadeira sem gente); igual; +1',
        desce.total <= cheio.total - 1500 && desce.fileiras.size === cheio.fileiras.size && desce.desceu && desceMuito.total <= 9000 && desceMuito.fileiras.size >= 1 && ig(fica, cheio) && !fica.desceu && fica.subiu === 0 && sobe.subiu === 1 && sobe.total <= cheio.total + 20000 - M);
    }
    // c) o corte de câmera (outra câmera, a de jogo, um pulo, um giro, o campo de visão) e o quadro a quadro: o resto de um
    //    quadro para o outro anda ± 2,5 mil (o "resto" do jogo: jogadores, a torcida em quadros, o estádio) e pula até 60
    //    mil no corte; o total desenhado (o resto + o 3D de perto) nunca passa do alvo + a variação de um quadro (Média:
    //    127,5 + 2,5 = 130 mil, a meta do celular), o quadro do corte não tem 3D de perto e o seguinte já tem a escolha
    //    inteira (sem subir aos poucos); parado, nada pisca
    {
      const c0 = { obj: 1, x: 0, y: 5, z: 0, fx: 0, fy: 0, fz: -1, fov: 50, deJogo: false };
      const cortes = [
        ['parado', c0, false], ['andou 1 m', { ...c0, x: 1 }, false], ['pulou 3 m', { ...c0, x: 3 }, true], ['virou 10°', { ...c0, fx: Math.sin(0.1745), fz: -Math.cos(0.1745) }, false],
        ['virou 30°', { ...c0, fx: 0.5, fz: -Math.cos(Math.PI / 6) }, true], ['zoom 10%', { ...c0, fov: 45 }, false], ['zoom 30%', { ...c0, fov: 35 }, true],
        ['outra câmera', { ...c0, obj: 2 }, true], ['a câmera de jogo', { ...c0, deJogo: true }, true],
      ];
      const errCorte = cortes.filter(([, c, sim]) => CD.corteDeCamera(c0, c) !== sim).map(([n]) => n);
      // o quadro a quadro (Média), com o desejo de exemplo (até ~40 mil de 3D de perto: o resto entre 85 e 125 mil o aperta)
      const alvo = OR.alvo.media;
      /** Simula `n` quadros: resto(q, corte) dá o resto do quadro q; a cada `cada` quadros um corte. */
      function simular(n, cada, restoDe) {
        let s = 7;
        const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
        const O = CD.criarOrcamento3D({ qualidade: 'media' });
        const R = { pior: 0, piorCorte: 0, semDepois: 0, deUmaVez: 0, cortes: 0, trocas: 0, trocasLonge: 0, com3d: 0, desceu: 0 };
        let resto = 110000, restoAnt = 0, frame = 0, gasto = 0, cam = { ...c0 }, ant = null, depoisCorte = false;
        for (let q = 0; q < n; q++) {
          const corte = cada > 0 && q > 0 && q % cada === 0;
          if (corte) { cam = { ...c0, x: rnd() * 80 - 40, obj: 1 + (q % 3) }; R.cortes++; }
          resto = restoDe(q, corte, resto, rnd);
          // o desenho do quadro anterior (o renderer.info): o resto daquele quadro + o 3D de perto dele
          const info = q === 0 ? { frame: 0, triangles: 0 } : { frame: ++frame, triangles: restoAnt + gasto };
          const ctx = O.inicio(info, cam);
          const r = O.planejar(D, ctx);
          gasto = r.total;
          O.gastou(gasto, { cadeiras: r.triCadeiras, torcedores: r.triTorcedores });
          if (q > 2) R.pior = Math.max(R.pior, resto + gasto);
          if (gasto > 0) R.com3d++;
          if (r.desceu) R.desceu++;
          if (corte && gasto > 0) R.piorCorte++;
          if (depoisCorte) { if (gasto === 0 && resto < alvo - M - 4500) R.semDepois++; if (ctx.novo) R.deUmaVez++; }
          const k = [...r.blocos].sort().join(',') + '|' + [...r.fileiras].map(([a, b]) => a + b).sort().join(',');
          if (ant !== null && k !== ant) { R.trocas++; if (cada <= 0 || q % cada > 30) R.trocasLonge++; }
          ant = k; depoisCorte = corte; restoAnt = resto;
        }
        return R;
      }
      const VAR = 2500;
      const A = simular(6000, 300, (q, corte, r, rnd) => (corte ? 85000 + rnd() * 40000 : q ? Math.min(125000, Math.max(85000, r + (rnd() * 2 - 1) * VAR)) : r));
      // parado: o resto em volta de 112 mil com ± 0,9 mil de ruído (abaixo da margem): depois de assentar, nada pisca
      const P = simular(2000, 0, (q, corte, r, rnd) => 112000 + (rnd() * 2 - 1) * 900);
      reg('C8 o corte de câmera (pulo > 2,5 m, giro > 25°, zoom > 20%, outra câmera, a câmera de jogo) e o quadro a quadro na Média: total ≤ alvo + a variação de 1 quadro (≤ 130 mil); o corte sem 3D de perto e o seguinte com a escolha inteira; parado com ruído abaixo da margem, nada pisca',
        `corte: ${errCorte.length ? 'ERRADO em ' + errCorte.join(', ') : `os ${cortes.length} casos certos`}; 6000 quadros, ${A.cortes} cortes, resto 85–125 mil ± ${VAR / 1000} mil por quadro: pior total ${(A.pior / 1000).toFixed(1)} mil (alvo ${alvo / 1000}), ${A.piorCorte} cortes com 3D, ${A.semDepois} quadros depois do corte sem 3D com folga, ${A.deUmaVez} de uma vez depois do corte; parado (112 ± 0,9 mil, 2000 quadros): ${P.desceu} descidas, ${P.trocas} subidas, 3D em ${P.com3d} quadros, pior ${(P.pior / 1000).toFixed(1)} mil`,
        `certos; ≤ ${(alvo + VAR) / 1000} mil e ≤ 130; 0; 0; = cortes; parado: 0 descidas, ≤ 3 subidas e 3D em ≥ 1990`,
        errCorte.length === 0 && A.pior <= alvo + VAR && A.pior <= 130000 && A.piorCorte === 0 && A.semDepois === 0 && A.deUmaVez === A.cortes && P.desceu === 0 && P.trocas <= 3 && P.com3d >= 1990 && P.pior <= alvo);
    }
    reg('C8 os alvos por qualidade: Baixa 0 (sem 3D de perto), Média ≤ 128 mil (o celular: 130 mil com a variação de um quadro), Alta > Média',
      `Baixa ${OR.alvo.baixa}; Média ${OR.alvo.media}; Alta ${OR.alvo.alta}; margem ${OR.margem}; sobe ${OR.sobe}/quadro`, '0; ≤ 128 mil; > Média',
      OR.alvo.baixa === 0 && OR.alvo.media <= 128000 && OR.alvo.media + OR.margem <= 130000 && OR.alvo.alta > OR.alvo.media && OR.sobe >= 1);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\n${falhas} REPROVADO(S)` : '\nTODOS PASSARAM');
process.exit(falhas ? 1 : 0);
