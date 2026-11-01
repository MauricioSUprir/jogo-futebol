// Cadeiras das arquibancadas (dados: conta PURA, sem three.js nem DOM; item 69 da FILA, PR 1 de 4 — a cadeira e o
// degrau; pedido do dono de 29/10: "cadeiras parecidas com as reais e torcida 3D, em todos os estádios").
// A GRADE de cadeiras de cada planta é a fonte única de quatro coisas:
//   1) a TEXTURA das cadeiras (de longe): cada fileira da textura é uma fileira da grade e cada célula, uma cadeira; a
//      célula tem duas faixas — o PISO (o assento visto de cima) e o ESPELHO (o encosto visto de frente) —, as duas na
//      cor da cadeira: de qualquer ângulo a mesma fração de cor (o desenho de longe não muda de cor nem de padrão);
//   2) o DEGRAU em geometria (espelho + piso): o perfil em escada sai das fileiras da grade (perfilEmDegraus);
//   3) os LUGARES da torcida: cada torcedor senta numa cadeira da grade (no piso, sobre o assento);
//   4) as CADEIRAS 3D de perto (render/cadeiras3d.js, sob demanda): a cadeira rebatível (concha + encosto) instanciada
//      nos BLOCOS perto da câmera — a escolha por bloco (px na tela, histerese, teto de instâncias) também mora aqui.
// Três malhas de estádio usam a mesma interface (grade.{fileiras, blocos, assentosDoBloco, assentoEm, iterar}): o
// Estádio Golaço (render/campo.js; o padrão, a edição pública e os estádios sem forma: gradeGolaco), a tigela do
// Maracanã (estadio-planta.js) e as 5 famílias genéricas (estadio-generico.js) — as duas pelo criarGradeAnel.
// Medidas (PESQUISA-ESTADIO.md §14): FIFA Stadium Guidelines 2022 §5.2 (fileira ≥ 800 mm, centros de cadeira ≥ 500 mm,
// ~28 cadeiras entre escadas, passagem ≥ 400 mm), Green Guide (6ª ed., 2018; caimento ≤ 34°; fileira 800 mm e cadeira
// 500 mm recomendadas; SGSA SG02: escada radial de 1,2 m), UEFA (cadeira individual, fixa, encosto ≥ 30 cm acima do
// assento) e fabricantes (OMSI: assento 45–50 cm de largura, 38–40 cm de fundo, encosto 35–40 cm, rebatível por mola).
// Só desenho: nada aqui toca a simulação (o hash não muda; fora do fecho de tools/fecho-hash.mjs).
import { ESTADIO } from '../config.js';

// ------------------------------------------------------------------ medidas (a pesquisa)
export const CADEIRA = Object.freeze({
  largura: 0.5,          // m entre centros (FIFA 2022: 500 mm mínimo; Green Guide: 460 mínimo, 500 recomendado)
  fileira: 0.8,          // m de profundidade da fileira (FIFA 2022 e Green Guide 12.12: 800 mm; 700 mínimo)
  entreEscadas: 28,      // cadeiras no máximo entre duas escadas (FIFA 2022: "28 seats between gangways"; 14 com uma só)
  escada: 1.2,           // m da escada radial (SGSA SG02; o Estádio Golaço tem 1,0 m — 2 células de 0,5 —, PR 4 calibra)
  passagem: 0.4,         // m livres na frente do assento (FIFA 2022 e Green Guide: clearway ≥ 400 mm)
  caimentoMax: 34,       // graus (Green Guide: o caimento de uma arquibancada de cadeiras não passa de 34°)
  // a cadeira rebatível (concha + encosto): largura 0,46 m (OMSI 45–50 cm), assento 0,40 m de fundo (38–40 cm) a 0,43 m
  // do piso, encosto 0,36 m acima do assento (UEFA ≥ 30 cm; OMSI 35–40 cm), o encosto a `recuo` m do espelho de trás
  assento: Object.freeze({ largura: 0.46, fundo: 0.4, altura: 0.43, encosto: 0.36, recuo: 0.08 }),
});
// onde o centro do assento fica no piso (fração da profundidade, a partir do bico do degrau): o encosto encostado no
// espelho de trás e a passagem livre na frente (0,64 × 0,8 m = 0,51 m do bico; a frente do assento a 0,31 m dele)
export const NO_PISO = 0.64;
// a célula de cada fileira na textura: a faixa de baixo (v menor) é o PISO, do bico até o espelho; a de cima, o ESPELHO
export const FAIXA_PISO = 0.6;

// ------------------------------------------------------------------ cadeiras 3D de perto (escolha por bloco)
export const CADEIRAS3D = Object.freeze({
  fileirasBloco: 4,      // fileiras por bloco (o bloco é a faixa entre duas escadas × 4 fileiras)
  pxEntra: 10,           // px (CSS) da cadeira na tela para o bloco ENTRAR em 3D
  pxSai: 7.5,            // ... e para SAIR (histerese: abaixo disto volta à textura)
  distMax: 42,           // m: nunca além disto (= DEGRAU_LOD.entra: o degrau das plantas curvas vira geometria até ali)
  favorAnterior: 1.2,    // no ranking do teto, quem já está em 3D vale 20% mais (não pisca na borda do teto)
  // teto de instâncias por qualidade (Baixa: só a textura) e de blocos (a máscara do material das arquibancadas): o MÁXIMO
  // da qualidade; quanto cabe em cada quadro quem decide é o orçamento de triângulos (ORCAMENTO3D, mais abaixo: o 3D de
  // perto ganha o alvo da qualidade menos o resto do quadro). (Média 320 desde o PR 1: com 480 o placar do pós-jogo no
  // celular ia de 122 a 131 mil triângulos, antes do orçamento)
  teto: Object.freeze({ baixa: 0, media: 320, alta: 3072 }),
  blocosMax: 20,
});
// LOD do degrau das plantas CURVAS (o Maracanã e as genéricas): cada setor tem a malha lisa (a de antes, com a textura
// nova) e a em escada; a escada só com a câmera a menos de `entra` m da caixa do setor (sai além de `sai`). `entra` =
// `CADEIRAS3D.distMax`: toda cadeira 3D cai num setor em escada (a caixa do setor está mais perto que a do bloco) e o degrau
// não paga triângulos onde a cadeira não aparece (com 52 m o pré-jogo do San Siro chegava a 135 mil no celular: a meta é
// 130 mil). O Estádio Golaço (arquibancadas retas: o degrau custa ~1 mil triângulos) fica sempre em escada.
export const DEGRAU_LOD = Object.freeze({ entra: 42, sai: 50 });

// ------------------------------------------------------------------ o Estádio Golaço (as 4 arquibancadas retas)
// (as medidas de render/campo.js; torcida-dados.js reexporta como ARQUIBANCADA)
export const ARQ_GOLACO = Object.freeze({
  frenteZ: 44.5,          // z da frente do lado de lá (CAMPO.meioZ + entorno + 4,5)
  profLado: 30, yBase: 1.4, yTopoLado: 20,
  meioComprimento: 62.5,  // ±x do lado de lá
  fundoX0: 62.5,          // x da frente dos fundos (CAMPO.meioX + entorno + 4)
  profFundo: 26, yTopoFundo: 17,
  fileiras: 36, assento: 0.5, comprimento: 125, corredor: 26,
  vMax: 1 - 24 / 512,     // v do topo da textura (a faixa de cima é a parede)
  vFundo: 0.82,           // os fundos usam até 82% da altura da textura
});
// o túnel do lado de cá (config.js ESTADIO.tunel): sem cadeira em cima da boca (a largura mais as paredes; o teto com a
// laje e 0,3 m de folga)
export const TUNEL = Object.freeze({ meiaLargura: ESTADIO.tunel.largura / 2 + 0.4, topo: ESTADIO.tunel.altura + ESTADIO.tunel.laje + 0.3 });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Sorteio fixo por célula (inteiros i, j e a semente): 0–1, o mesmo em toda abertura (a textura e a cadeira 3D casam). */
export function sorteioCelula(i, j, semente = 0) {
  let t = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(semente | 0, 2246822519);
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

/**
 * As fileiras do Estádio Golaço: lado ('lado': o lado de lá e o de cá, 36 × 0,833 m × 0,517 m) ou 'fundo' (os dois atrás
 * dos gols, 30 × 0,867 m × 0,52 m). j = 0 é a da frente; f = 35 − j é a fileira da textura (0 = a de cima). Cada uma:
 * {j, f, d0, d1 (m de profundidade a partir da frente), y (o piso), y1 (o piso da de trás = o topo do espelho), v0, vm, v1
 * (a célula na textura: v0–vm o piso, vm–v1 o espelho)}.
 */
export function fileirasGolaco(tipo) {
  const A = ARQ_GOLACO, nF = A.fileiras;
  const n = tipo === 'fundo' ? 30 : nF;
  const prof = tipo === 'fundo' ? A.profFundo : A.profLado, yT = tipo === 'fundo' ? A.yTopoFundo : A.yTopoLado;
  const p = prof / n, h = (yT - A.yBase) / n;
  const out = [];
  for (let j = 0; j < n; j++) {
    const v0 = (j / nF) * A.vMax, v1 = ((j + 1) / nF) * A.vMax;
    out.push({ j, f: nF - 1 - j, d0: j * p, d1: (j + 1) * p, y: A.yBase + j * h, y1: A.yBase + (j + 1) * h, v0, vm: v0 + FAIXA_PISO * (v1 - v0), v1, p, h });
  }
  return out;
}

/**
 * O perfil em escada de uma lista de fileiras ({d0, d1, y, y1, v0, vm, v1}): os nós [d, y, v] na ordem (bico → fundo do
 * piso → topo do espelho → bico da próxima...). O 1º nó é o bico da 1ª fileira; o último, o topo do espelho da última.
 */
export function perfilEmDegraus(fileiras) {
  const out = [];
  for (const r of fileiras) {
    out.push([r.d0, r.y, r.v0], [r.d1, r.y, r.vm], [r.d1, r.y1, r.v1]);
  }
  return out;
}

/** A cadeira do Golaço em cima da boca do túnel (lado de cá)? O piso da fileira abaixo do topo do túnel (com a folga). */
export function sobreTunelGolaco(rl, x) {
  return Math.abs(x) < TUNEL.meiaLargura && rl.y < TUNEL.topo;
}
// item 69, PR 4 (auditoria de 01/11): nas fileiras do lado de cá ao lado da boca do túnel, a fileira ia do túnel até a
// escada da célula 156 (23 cadeiras com escada de um lado só; FIFA 2022 §5.2 e Green Guide §12.16: ≤ 14) — as células
// 115–116 e 133–134 viram escada nelas (a malha do lado de cá pinta o concreto ali: render/campo.js criarLadoDeCa)
export const ESCADA_TUNEL = Object.freeze([115, 116, 133, 134]);
// as torres de refletor do Estádio Golaço (render/campo.js criarRefletores, estadio-forma.js): as de z −56 caem dentro dos
// fundos (o poste de 0,45 m de raio passava por dentro de 4 cadeiras com gente sentada) — o poste fica numa ESCADA de
// 2 células (1,0 m, como as outras) de cima a baixo do fundo: as células em volta dele (as de z ≈ −56) não têm cadeira e a
// malha dos fundos pinta o concreto da escada ali (render/campo.js)
export const REFLETORES_GOLACO = Object.freeze({ pontos: Object.freeze([[72, 56], [72, -56], [-72, 56], [-72, -56]]) });
/** As 2 células (a) da escada do poste no fundo do setor 1 (+x) ou 2 (−x) do Golaço, ou null (o poste fora do fundo). */
export function escadaDoPoste(setor) {
  const A = ARQ_GOLACO, nA = Math.round(A.comprimento / A.assento), sx = setor === 1 ? 1 : -1;
  const u1 = (A.frenteZ + A.frenteZ + A.profLado) / A.comprimento;
  const za = sx > 0 ? A.frenteZ : -(A.frenteZ + A.profLado), zb = sx > 0 ? -(A.frenteZ + A.profLado) : A.frenteZ;
  for (const [px, pz] of REFLETORES_GOLACO.pontos) {
    if (Math.sign(px) !== sx || Math.abs(px) < A.fundoX0 || Math.abs(px) > A.fundoX0 + A.profFundo || pz > Math.max(za, zb) || pz < Math.min(za, zb)) continue;
    const a = Math.round(((pz - za) / (zb - za)) * u1 * nA);
    return [a - 1, a];
  }
  return null;
}
const ESCADA_POSTE = [null, escadaDoPoste(1), escadaDoPoste(2), null];

/**
 * A grade do Estádio Golaço: as 4 arquibancadas retas com as cadeiras da textura (36 fileiras × 250 células de 0,5 m,
 * 2 células de escada a cada 26). setor: 0 lado de lá (z −), 1 fundo +x, 2 fundo −x, 3 lado de cá (z +, sem a boca do
 * túnel). Devolve {tipo, fileiras: {lado, fundo}, nA, assento(setor, f, a), iterar(cb), blocos, assentosDoBloco(i),
 * assentoEm(x, z, setor), capacidade}. Cada assento: {setor, f, a, x, y (o piso), z, rumo (para onde a cadeira olha:
 * (cos, sin) no plano xz), larg, chave}.
 */
export function gradeGolaco() {
  const A = ARQ_GOLACO, nA = Math.round(A.comprimento / A.assento), nF = A.fileiras;
  const FL = fileirasGolaco('lado'), FF = fileirasGolaco('fundo');
  const u1 = (A.frenteZ + A.frenteZ + A.profLado) / A.comprimento;   // 119/125: o comprimento dos fundos (z)
  const corredor = a => a % A.corredor < 2;
  /**
   * A cadeira (setor, f, a) ou null (escada, fora do fundo, em cima do túnel). fantasma: devolve também as que o PR 4
   * tirou (a escada ao lado do túnel, o poste do refletor) marcadas `fantasma` — a torcida gasta os sorteios delas e o
   * resto da torcida fica com os mesmos.
   */
  function assento(setor, f, a, fantasma = false) {
    if (a < 0 || a >= nA || f < 0 || f >= nF || corredor(a)) return null;
    const j = nF - 1 - f;
    if (setor === 0 || setor === 3) {
      const r = FL[j], x = -A.meioComprimento + A.assento * (a + 0.5), d = r.d0 + NO_PISO * r.p;
      if (setor === 3 && sobreTunelGolaco(r, x)) return null;
      const fora = setor === 3 && r.y < TUNEL.topo && ESCADA_TUNEL.includes(a);
      if (fora && !fantasma) return null;
      const sz = setor === 0 ? -1 : 1;
      return { setor, f, a, x, y: r.y, z: sz * (A.frenteZ + d), rumo: setor === 0 ? Math.PI / 2 : -Math.PI / 2, larg: A.assento, chave: (setor * nF + f) * nA + a, ...(fora ? { fantasma: true } : {}) };
    }
    if (j >= FF.length) return null;
    const u = (a + 0.5) / nA;
    if (u > u1) return null;
    const r = FF[j], s = setor === 1 ? 1 : -1, d = r.d0 + NO_PISO * r.p;
    const za = s > 0 ? A.frenteZ : -(A.frenteZ + A.profLado), zb = s > 0 ? -(A.frenteZ + A.profLado) : A.frenteZ;
    const x = s * (A.fundoX0 + d), z = za + (zb - za) * (u / u1), fora = !!ESCADA_POSTE[setor]?.includes(a);
    if (fora && !fantasma) return null;
    return { setor, f, a, x, y: r.y, z, rumo: s > 0 ? Math.PI : 0, larg: A.assento, chave: (setor * nF + f) * nA + a, ...(fora ? { fantasma: true } : {}) };
  }
  /**
   * Todas as cadeiras na ordem de sempre (f de cima para baixo; a; setores 0, 1, 2, 3) — a da torcida-dados.js.
   * fantasmas: também as tiradas no PR 4 (marcadas `fantasma`: a torcida só gasta os sorteios delas).
   */
  function iterar(cb, fantasmas = false) {
    for (let f = 0; f < nF; f++) {
      for (let a = 0; a < nA; a++) {
        if (corredor(a)) continue;
        for (const st of [0, 1, 2, 3]) { const c = assento(st, f, a, fantasmas); if (c) cb(c); }
      }
    }
  }
  /** A célula (setor, f, a) é escada (as de 26 em 26, a do poste nos fundos, as do lado do túnel nas fileiras de baixo)? */
  function escadaEm(setor, f, a) {
    if (corredor(a)) return true;
    if (ESCADA_POSTE[setor]?.includes(a)) return true;
    if (setor === 3 && ESCADA_TUNEL.includes(a)) { const r = FL[nF - 1 - f]; return !!r && r.y < TUNEL.topo; }
    return false;
  }
  // blocos: a faixa entre duas escadas (24 cadeiras) × 4 fileiras, em cada setor
  const blocos = [];
  const NB = CADEIRAS3D.fileirasBloco;
  for (const st of [0, 1, 2, 3]) {
    const nFil = st === 0 || st === 3 ? FL.length : FF.length;
    for (let j0 = 0; j0 < nFil; j0 += NB) {
      const j1 = Math.min(nFil, j0 + NB);
      for (let c0 = 0; c0 < nA; c0 += A.corredor) {
        const as = [];
        for (let j = j0; j < j1; j++) for (let a = c0; a < Math.min(nA, c0 + A.corredor); a++) { const c = assento(st, nF - 1 - j, a); if (c) as.push(c); }
        if (as.length) blocos.push(blocoDe(as, { setor: st, j0, j1, c0 }));
      }
    }
  }
  const lista = blocos.map(b => b._as);
  for (const b of blocos) delete b._as;
  let capacidade = 0;
  iterar(() => { capacidade++; });
  return {
    tipo: 'golaco', nA, nF, fileiras: { lado: FL, fundo: FF }, u1,
    assento, iterar, blocos, capacidade, escadaEm,
    assentosDoBloco: i => lista[i],
    /** A cadeira mais perto do ponto (x, z) da arquibancada `setor` (null fora dela ou na escada). */
    assentoEm(x, z, setor) {
      let f, a;
      if (setor === 0 || setor === 3) {
        const d = Math.abs(z) - A.frenteZ, j = Math.floor(d / FL[0].p);
        f = nF - 1 - j; a = Math.floor((x + A.meioComprimento) / A.assento);
      } else {
        const d = Math.abs(x) - A.fundoX0, j = Math.floor(d / FF[0].p);
        const s = setor === 1 ? 1 : -1, za = s > 0 ? A.frenteZ : -(A.frenteZ + A.profLado), zb = s > 0 ? -(A.frenteZ + A.profLado) : A.frenteZ;
        f = nF - 1 - j; a = Math.floor(((z - za) / (zb - za)) * u1 * nA);
      }
      return assento(setor, f, a);
    },
  };
}

/** O bloco de uma lista de cadeiras: centro, raio, a caixa orientada (ao longo da fileira, de lado, em y) e quantas. */
function blocoDe(as, extra = {}) {
  let cx = 0, cy = 0, cz = 0;
  for (const c of as) { cx += c.x; cy += c.y; cz += c.z; }
  cx /= as.length; cy /= as.length; cz /= as.length;
  // eixo ao longo da fileira: perpendicular ao rumo médio das cadeiras
  let rx = 0, rz = 0;
  for (const c of as) { rx += Math.cos(c.rumo); rz += Math.sin(c.rumo); }
  const l = Math.hypot(rx, rz) || 1;
  rx /= l; rz /= l;
  const ax = -rz, az = rx;
  let ea = 0, er = 0, ey0 = Infinity, ey1 = -Infinity, raio = 0;
  for (const c of as) {
    const dx = c.x - cx, dz = c.z - cz;
    ea = Math.max(ea, Math.abs(dx * ax + dz * az) + c.larg / 2 + 0.05);
    er = Math.max(er, Math.abs(dx * rx + dz * rz) + 0.5);
    ey0 = Math.min(ey0, c.y - 0.05); ey1 = Math.max(ey1, c.y + 0.95);
    raio = Math.max(raio, Math.hypot(dx, c.y - cy, dz));
  }
  const ym = (ey0 + ey1) / 2;
  return {
    ...extra, n: as.length, c: [cx, cy, cz], raio: raio + 0.8,
    // a caixa da máscara (o material das arquibancadas troca a cadeira pintada pelo concreto dentro dela)
    caixa: { c: [cx, ym, cz], eixo: [ax, az], e: [ea, (ey1 - ey0) / 2, er] },
    _as: as,
  };
}

// ------------------------------------------------------------------ as plantas curvas (anel)
// o maior giro da fileira na largura de uma cadeira (por metro; ~raio de 5 m): a quina da 1ª fileira fica sem cadeira
const GIRO_MAX = (6 * Math.PI) / 180;
/** Quantas fileiras de `CADEIRA.fileira` cabem numa faixa de d m (a última fica com o que sobra: 0,6–1,4 m). */
export const nFileirasEm = d => (d < 0.75 * CADEIRA.fileira ? 0 : Math.floor((d + 0.25 * CADEIRA.fileira) / CADEIRA.fileira));
/**
 * A grade de uma planta CURVA (a tigela do Maracanã, as genéricas): as fileiras em faixas de s (a fração da profundidade)
 * e, em cada fileira, as cadeiras pelo u da textura (ladrilhos: cada ladrilho tem 2 metades; a metade que começa com a
 * escada tem a fração `corredor` dela de escada; `n` cadeiras iguais por metade). A = {
 *   faixas: [[s0, s1]…] as faixas de cadeira,
 *   profMedia: m (a profundidade média da arquibancada, para o número de fileiras de cada faixa — sem `metrico`),
 *   metrico (as genéricas, item 69 PR 4): {dS(th, s) → m da 1ª fileira até s pela perpendicular da fileira, sD(th, d) → a
 *     inversa, dp(th) → [a, b] (dS = a·s + (b − a)·s²/2: a mesma conta, de uma vez), amostras: [θ…] onde há
 *     arquibancada} — as fileiras POR METRO: na faixa, a fileira j vai de j·0,8 a
 *     (j + 1)·0,8 m da frente dela em cada θ; a última de cada θ fica com o que sobra (0,6–1,4 m) e, onde a faixa é mais
 *     rasa, as de trás não existem (o lado raso tem menos fileiras, não fileiras mais finas),
 *   perfil(s, th) → y, ponto(th, s) → [x, z], vDe(s) → v (linear em cada faixa),
 *   trechos: [{uDe(th, s), thDe(u, s), u0, u1}] (a volta inteira ou cada lado reto),
 *   corredor (fração da metade do ladrilho) ou corredorDe(r) (a da fileira r: a escada de largura fixa em metros),
 *   escadasPorLadrilho: 2 (cada metade começa com a escada) ou 1 (só a 1ª),
 *   meiaMedia(s) → m de uma metade de ladrilho na fileira s,
 *   existe(th, fileira, x, z, yPiso, lim) → a cadeira existe ali (tem arquibancada, é cadeira e não é a boca do túnel; lim
 *     = [s0, s1, sAssento] da fileira em th),
 *   setor(x, z)
 * }. Devolve a mesma interface da gradeGolaco (fileiras = a lista; cada uma {k (índice da frente), f (0 = a de cima), s0,
 * s1, sAssento (por metro: os de uma volta típica), v0, vm, v1, n (cadeiras por metade de ladrilho; nh: por metade), c
 * (o corredor), faixa, iFaixa (da frente, na faixa), nFaixa}) e mais `limites(r, th)` → [s0, s1, sAssento] da fileira em
 * th (null: não existe ali).
 */
export function criarGradeAnel(A) {
  const M = A.metrico ?? null, PF = CADEIRA.fileira;
  const e2 = (A.escadasPorLadrilho ?? 2) === 2;
  const fileiras = [], faixas = [];
  A.faixas.forEach(([s0, s1], fx) => {
    const F = { s0, s1, n: 0, k0: fileiras.length, dTip: 0 };
    faixas.push(F);
    if (M) {
      // o maior número de fileiras da faixa pela volta; as fileiras típicas pela profundidade mediana
      const ds = M.amostras.map(th => M.dS(th, s1) - M.dS(th, s0)).sort((a, b) => a - b);
      for (const d of ds) F.n = Math.max(F.n, nFileirasEm(d));
      F.dTip = ds.length ? ds[ds.length >> 1] : 0;
      for (let k = 0; k < F.n; k++) {
        const fr = d => s0 + (s1 - s0) * clamp(d / Math.max(1e-6, F.dTip), 0, 1);
        fileiras.push({ s0: fr(k * PF), s1: k + 1 >= F.n ? s1 : fr((k + 1) * PF), sAssento: fr((k + NO_PISO) * PF), faixa: fx, iFaixa: k, nFaixa: F.n });
      }
      return;
    }
    // (uma faixa mais rasa que ~3/4 de fileira fica sem cadeira: o corredor entre os anéis de uma arquibancada que divide
    // o perfil das outras)
    if ((s1 - s0) * A.profMedia < 0.75 * CADEIRA.fileira) return;
    const n = Math.max(1, Math.round(((s1 - s0) * A.profMedia) / CADEIRA.fileira));
    F.n = n;
    for (let k = 0; k < n; k++) {
      const a = s0 + ((s1 - s0) * k) / n, b = s0 + ((s1 - s0) * (k + 1)) / n;
      fileiras.push({ s0: a, s1: b, faixa: fx, iFaixa: k, nFaixa: n });
    }
  });
  const NF = fileiras.length;
  fileiras.forEach((r, k) => {
    r.k = k; r.f = NF - 1 - k;
    if (M) {
      // a textura: cada faixa em fileiras de altura igual (de vDe(s0) a vDe(s1) da faixa)
      const F = faixas[r.faixa], va = A.vDe(F.s0), vb = A.vDe(F.s1);
      r.v0 = va + ((vb - va) * r.iFaixa) / F.n; r.v1 = va + ((vb - va) * (r.iFaixa + 1)) / F.n;
    } else {
      r.v0 = A.vDe(r.s0); r.v1 = A.vDe(r.s1);
      r.sAssento = r.s0 + NO_PISO * (r.s1 - r.s0);
    }
    r.vm = r.v0 + FAIXA_PISO * (r.v1 - r.v0);
    // a escada: a fração da metade (fixa, ou a de 1,2 m nesta fileira) e as cadeiras por metade — a largura ≥ 0,5 m na
    // fileira média (≤ 28 entre escadas)
    r.c = A.corredorDe ? A.corredorDe(r) : A.corredor;
    const ch = h => (e2 || h === 0 ? r.c : 0);
    r.nh = [0, 1].map(h => clamp(Math.floor((A.meiaMedia(r.sAssento) * (1 - ch(h))) / CADEIRA.largura + 1e-6), 1, CADEIRA.entreEscadas));
    r.n = r.nh[0];
  });
  const corredorDe = (r, h) => (e2 || h === 0 ? r.c : 0);
  /** [s0, s1, sAssento] da fileira r no ângulo th (null: por metro, a fileira não existe ali). */
  function limites(r, th) {
    if (!M) return [r.s0, r.s1, r.sAssento];
    // (a profundidade em th uma vez só: M.dp(th) → [a, b], dS = a·s + (b − a)·s²/2 e a inversa)
    const [a, b] = M.dp(th), q = b - a, dS = s => a * s + (q * s * s) / 2;
    const sD = d => { if (Math.abs(q) < 1e-9 * Math.max(1, a)) return d / Math.max(1e-9, a); const disc = a * a + 2 * q * d; return disc <= 0 ? -a / q : (-a + Math.sqrt(disc)) / q; };
    const F = faixas[r.faixa], d0 = dS(F.s0), n = nFileirasEm(dS(F.s1) - d0), j = r.iFaixa;
    if (j >= n) return null;
    return [sD(d0 + j * PF), j + 1 >= n ? F.s1 : sD(d0 + (j + 1) * PF), sD(d0 + (j + NO_PISO) * PF)];
  }
  /** A fileira que contém s (no ângulo th, por metro; null fora das faixas de cadeira). */
  function fileiraDe(s, th = 0) {
    if (M) {
      for (const F of faixas) {
        if (!F.n || s < F.s0 - 1e-9 || s > F.s1 + 1e-9) continue;
        const d0 = M.dS(th, F.s0), n = nFileirasEm(M.dS(th, F.s1) - d0);
        if (!n) return null;
        return fileiras[F.k0 + clamp(Math.floor((M.dS(th, s) - d0) / PF), 0, n - 1)];
      }
      return null;
    }
    let lo = 0, hi = NF - 1;
    if (!NF || s < fileiras[0].s0 || s > fileiras[NF - 1].s1) return null;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (fileiras[m].s0 <= s) lo = m; else hi = m - 1; }
    const r = fileiras[lo];
    return s <= r.s1 + 1e-9 ? r : null;
  }
  /** u do centro da cadeira (ladrilho t, metade h, cadeira i) na fileira r. */
  const uCentro = (r, t, h, i) => { const c = corredorDe(r, h); return t + h / 2 + (c + ((i + 0.5) * (1 - c)) / r.nh[h]) / 2; };
  /** O θ e os limites da fileira r no u (por metro, nos lados abertos o θ depende do s: duas voltas). */
  function thLim(tr, r, u) {
    let th = tr.thDe(u, r.sAssento);
    let L = limites(r, th);
    if (M && L && tr.k !== -1) { th = tr.thDe(u, L[2]); L = limites(r, th); }
    return L ? [th, L] : null;
  }
  /** O rumo da cadeira (perpendicular à fileira, para dentro: a tangente da fileira em th) e a largura de verdade dela. */
  function rumoLargura(tr, r, h, u, th, sA, x, z) {
    // o ponto da fileira no ângulo t: por metro o s dela muda com o ângulo (a fileira não é a curva de s constante)
    const sEm = t => (M ? (limites(r, t) ?? [0, 0, sA])[2] : sA);
    const naFileira = t => A.ponto(t, sEm(t));
    // as bordas dela estão a ±(1 − c)/(4n) do centro em u
    const du = (1 - corredorDe(r, h)) / (4 * r.nh[h]);
    const [x1, z1] = naFileira(tr.thDe(u - du, sA)), [x2, z2] = naFileira(tr.thDe(u + du, sA));
    // a direção da fileira: a tangente no centro (nas plantas por fração, como antes) ou, por metro, a corda entre as bordas
    // (a tangente pontual pegava as quinas da fileira por metro e virava a cadeira até 80° da vizinha)
    let tx, tz;
    if (M) { tx = x2 - x1; tz = z2 - z1; } else { const e = 1e-3, [xa, za] = A.ponto(th - e, sA), [xb, zb] = A.ponto(th + e, sA); tx = xb - xa; tz = zb - za; }
    const lt = Math.hypot(tx, tz) || 1; tx /= lt; tz /= lt;
    let nx = -tz, nz = tx;
    if (nx * -x + nz * -z < 0) { nx = -nx; nz = -nz; }
    // (por metro: o dobro da MENOR meia largura, com 6% de folga — onde a curva aperta a fileira, a meia largura da vizinha
    // é menor que a desta e a cadeira 3D passava dela 1 cm; nas plantas por fração, a distância entre as bordas, como antes)
    const larg = M ? 1.88 * Math.min(Math.hypot(x - x1, z - z1), Math.hypot(x2 - x, z2 - z)) : Math.hypot(x2 - x1, z2 - z1);
    // o quanto a fileira vira na largura da cadeira (o ângulo entre as duas meias cordas)
    const ax = x - x1, az = z - z1, bx = x2 - x, bz = z2 - z;
    const giro = Math.acos(clamp((ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1), -1, 1));
    return { rumo: Math.atan2(nz, nx), larg, giro };
  }
  /**
   * A borda da cadeira 3D (a largura dela: escalaLargura, 1 cm para dentro) cai na faixa de uma escada? (por metro: na
   * quina da 1ª fileira a curva aperta a fileira e a última cadeira da metade encostava na escada da seguinte)
   */
  function bordaNaEscada(tr, r, x, z, sA, geo) {
    const w = (CADEIRA.assento.largura * escalaLargura(geo.larg)) / 2 - 0.01, tx = -Math.sin(geo.rumo), tz = Math.cos(geo.rumo);
    for (const sg of [-1, 1]) {
      const ex = x + sg * w * tx, ez = z + sg * w * tz;
      const u = tr.uDe(Math.atan2(ez, ex), sA), fr = u - Math.floor(u), hh = fr >= 0.5 ? 1 : 0;
      if ((fr - hh / 2) * 2 < corredorDe(r, hh)) return true;
    }
    return false;
  }
  /**
   * A cadeira da fileira r no trecho tr com u (o centro), ou null (não existe ali). leve: sem o rumo e a largura (os
   * lugares da torcida só precisam de onde ela fica: 2 inversas de u a menos por lugar; por metro, a conta é feita igual).
   */
  function assentoU(tr, ti, r, t, h, i, leve = false) {
    const u = uCentro(r, t, h, i), nh = r.nh[h];
    if (u < tr.u0 || u > tr.u1) return null;
    const tl = thLim(tr, r, u);
    if (!tl) return null;
    const [th, L] = tl, sA = L[2];
    const [x, z] = A.ponto(th, sA);
    const y = A.perfil(L[0], th);
    // (por metro, o rumo e a largura entram na conta de onde a cadeira existe: o mesmo resultado leve ou não)
    const geo = M || !leve ? rumoLargura(tr, r, h, u, th, sA, x, z) : null;
    // (por metro: na quina da 1ª fileira a fileira vira em poucos metros — nenhuma cadeira onde ela vira mais que
    // GIRO_MAX na largura de uma cadeira, a 3D passava da vizinha — nem com a borda dentro da escada)
    if (M && (geo.giro > GIRO_MAX || bordaNaEscada(tr, r, x, z, sA, geo))) return null;
    if (!A.existe(th, r, x, z, y, L, geo)) return null;
    const chave = ((ti * NF + r.k) * 100003 + (t + 50000) * 2 + h) * 32 + i;
    if (leve) return { setor: A.setor(x, z), f: r.f, a: (t * 2 + h) * CADEIRA.entreEscadas + i, k: r.k, t, h, i, n: nh, x, y, z, chave, th, s: sA };
    return { setor: A.setor(x, z), f: r.f, a: (t * 2 + h) * CADEIRA.entreEscadas + i, k: r.k, t, h, i, n: nh, x, y, z, rumo: geo.rumo, larg: geo.larg, chave, th, s: sA };
  }
  // os blocos: em cada trecho, cada metade de ladrilho × 4 fileiras da mesma faixa (só as cadeiras que existem)
  const blocos = [], ref = [];
  const NB = CADEIRAS3D.fileirasBloco;
  A.trechos.forEach((tr, ti) => {
    const tA = Math.floor(tr.u0), tB = Math.ceil(tr.u1);
    for (let k0 = 0; k0 < NF;) {
      let k1 = k0;
      while (k1 < NF && k1 - k0 < NB && fileiras[k1].faixa === fileiras[k0].faixa) k1++;
      for (let t = tA; t < tB; t++) for (let h = 0; h < 2; h++) {
        // a caixa pelas 4 quinas (a lista de cadeiras só quando o bloco chega perto: assentosDoBloco)
        const quinas = [];
        // (as 4 quinas e o meio da 1ª e da última fileira: a fileira curva estufa no meio)
        for (const k of [k0, k1 - 1]) { const nn = fileiras[k].nh[h]; for (const i of [0, nn >> 1, nn - 1]) { const q = assentoU(tr, ti, fileiras[k], t, h, i); if (q) quinas.push(q); } }
        if (!quinas.length) {
          // a metade pode existir só no meio (a ponta de um lado aberto, o túnel; por metro: as de trás só onde é fundo)
          const ks = M ? Array.from({ length: k1 - k0 }, (_, j) => k0 + j) : [(k0 + k1 - 1) >> 1];
          for (const k of ks) { const q = assentoU(tr, ti, fileiras[k], t, h, fileiras[k].nh[h] >> 1); if (q) { quinas.push(q); break; } }
          if (!quinas.length) continue;
        }
        let n = 0;
        for (let k = k0; k < k1; k++) n += fileiras[k].nh[h];
        const b = blocoDe(quinas, { trecho: ti, k0, k1, t, h });
        b.n = n;
        b.setor = A.setor(b.c[0], b.c[2]);
        delete b._as;
        blocos.push(b); ref.push(null);
      }
      k0 = k1;
    }
  });
  function assentosDoBloco(i) {
    if (ref[i]) return ref[i];
    const b = blocos[i], tr = A.trechos[b.trecho], as = [];
    for (let k = b.k0; k < b.k1; k++) { const r = fileiras[k]; for (let ii = 0; ii < r.nh[b.h]; ii++) { const q = assentoU(tr, b.trecho, r, b.t, b.h, ii); if (q) as.push(q); } }
    ref[i] = as;
    // a caixa da máscara por TODAS as cadeiras do bloco (a das quinas deixava de fora as do meio quando faltava uma quina:
    // o vomitório, o túnel, a ponta de um lado aberto)
    if (as.length) b.caixa = blocoDe(as).caixa;
    return as;
  }
  /** Todas as cadeiras (lento: ~0,1 s para 80 mil; os testes e a capacidade). */
  function iterar(cb) {
    A.trechos.forEach((tr, ti) => {
      for (const r of fileiras) for (let t = Math.floor(tr.u0); t < Math.ceil(tr.u1); t++) for (let h = 0; h < 2; h++) for (let i = 0; i < r.nh[h]; i++) { const q = assentoU(tr, ti, r, t, h, i); if (q) cb(q); }
    });
  }
  /**
   * A cadeira em que cai o ponto (th, s) do trecho ti (o lugar de um torcedor puxado para a cadeira da grade): null na
   * escada, fora das fileiras ou onde a cadeira não existe. leve: sem o rumo e a largura (assentoU).
   */
  function assentoEm(th, s, ti = 0, leve = false) {
    const r = fileiraDe(s, th), tr = A.trechos[ti];
    if (!r || !tr) return null;
    const L = limites(r, th);
    if (!L) return null;
    const u = tr.uDe(th, L[2]), t = Math.floor(u), w = u - t, h = w >= 0.5 ? 1 : 0, q = (w - h / 2) * 2;
    const c = corredorDe(r, h);
    if (q < c) return null;
    const i = Math.min(r.nh[h] - 1, Math.floor(((q - c) / (1 - c)) * r.nh[h]));
    return assentoU(tr, ti, r, t, h, i, leve);
  }
  return {
    tipo: 'anel', fileiras, NF, corredor: A.corredor ?? null, corredorDe, trechos: A.trechos, metrico: !!M, faixas,
    escadasPorLadrilho: e2 ? 2 : 1, limites, fileiraDe, blocos, assentosDoBloco, iterar, assentoEm,
    get capacidade() { let n = 0; iterar(() => { n++; }); return n; },
  };
}

/**
 * Os anéis de uma faixa de cadeiras em ESCADA (as plantas curvas): [s, sY, v] — y = perfil(sY, th) na coluna th. O
 * bico da fileira (s0, s0), o fundo do piso (s1, s0) e o topo do espelho (s1, s1): a mesma ordem de perfilEmDegraus.
 */
export function aneisEmDegraus(fileiras) {
  const out = [];
  for (const r of fileiras) out.push([r.s0, r.s0, r.v0], [r.s1, r.s0, r.vm], [r.s1, r.s1, r.v1]);
  return out;
}

/**
 * Os anéis da malha em ESCADA de uma planta curva a partir dos nós do perfil `base` (os s dela, em ordem): cada faixa de
 * cadeiras da grade vira os degraus das fileiras dela (aneisEmDegraus); os nós de fora das faixas (as faces, os corredores
 * entre os anéis) ficam como estão ([s, s, vDe(s)]); os de dentro de uma faixa saem (o degrau segue o perfil pelos bicos).
 * Na grade POR METRO cada anel de uma fileira é [s(th), sY(th), v, sRep] (as funções da coluna th: onde a fileira não
 * existe, o anel cai no fim da faixa e o degrau some — área zero; sRep, o s típico, para as colunas e o tipo do trecho).
 */
export function aneisEscada(grade, base, vDe) {
  const corridas = [];
  for (const r of grade.fileiras) {
    const u = corridas[corridas.length - 1];
    if (u && u.faixa === r.faixa) { u.rows.push(r); u.s1 = r.s1; } else corridas.push({ faixa: r.faixa, s0: r.s0, s1: r.s1, rows: [r] });
  }
  if (grade.metrico) for (const c of corridas) { const F = grade.faixas[c.faixa]; c.s0 = F.s0; c.s1 = F.s1; }
  const itens = [];
  for (const s of base) if (!corridas.some(c => s > c.s0 + 1e-9 && s < c.s1 - 1e-9)) itens.push({ s, ordem: s, run: null });
  for (const c of corridas) if (c.s1 > base[0] - 1e-9 && c.s0 < base[base.length - 1] + 1e-9) itens.push({ s: c.s0, ordem: c.s0 + 1e-12, run: c });
  itens.sort((a, b) => a.ordem - b.ordem);
  const out = [];
  const empurra = a => { const l = out[out.length - 1]; if (!l || typeof a[0] === 'function' || typeof l[0] === 'function' || Math.abs(l[0] - a[0]) > 1e-7 || Math.abs(l[1] - a[1]) > 1e-7) out.push(a); };
  for (const it of itens) {
    if (!it.run) { empurra([it.s, it.s, vDe(it.s)]); continue; }
    if (!grade.metrico) { for (const a of aneisEmDegraus(it.run.rows)) empurra(a); continue; }
    const fim = grade.faixas[it.run.faixa].s1;
    for (const r of it.run.rows) {
      const s0 = th => grade.limites(r, th)?.[0] ?? fim, s1 = th => grade.limites(r, th)?.[1] ?? fim;
      out.push([s0, s0, r.v0, r.s0], [s1, s0, r.vm, r.s1], [s1, s1, r.v1, r.s1]);
    }
  }
  return out;
}

/**
 * A malha LISA (de longe) passa pelos assentos: y = perfil(s − NO_PISO·Δs) dentro de uma faixa de cadeiras (Δs = a
 * profundidade de uma fileira dela) — o torcedor sentado no piso fica em cima dela como ficava na rampa de antes. Na
 * grade por metro, no ângulo th.
 */
export function sLiso(grade, s, th = 0) {
  const r = grade.fileiraDe(s, th);
  if (!r) return s;
  if (grade.metrico) {
    const L = grade.limites(r, th);
    return L ? Math.max(grade.faixas[r.faixa].s0, s - (L[2] - L[0])) : s;
  }
  let k = r.k;
  while (k > 0 && grade.fileiras[k - 1].faixa === r.faixa) k--;
  return Math.max(grade.fileiras[k].s0, s - NO_PISO * (r.s1 - r.s0));
}

/**
 * O v da textura na fração s (no ângulo th) da malha LISA: na grade por metro, a fileira de th (a célula dela na textura:
 * do bico ao topo do espelho); fora das faixas, ou na grade por fração, vDe(s).
 */
export function vLiso(grade, s, th, vDe) {
  if (!grade.metrico) return vDe(s);
  const r = grade.fileiraDe(s, th);
  if (!r) return vDe(s);
  const L = grade.limites(r, th);
  if (!L) return vDe(s);
  return r.v0 + clamp((s - L[0]) / Math.max(1e-9, L[1] - L[0]), 0, 1) * (r.v1 - r.v0);
}

// ------------------------------------------------------------------ cores das cadeiras (a textura e a 3D, iguais)
/**
 * A cor de cada cadeira do Estádio Golaço (o mesmo pintor na textura e nas cadeiras 3D). opc: {comTexto (o lado de lá:
 * o mosaico do nome), cores (identidade.js arquibancada, só com ?tm: {mosaico, cadeira, tom, tom2, corCadeira, padrao}),
 * mascara (Uint8Array das células do mosaico, já a do mandante ou a do GOLAÇO)}. Devolve (f, a) → {cor, mosaico} ou null
 * (escada).
 */
export function pintorGolaco(opc = {}) {
  const A = ARQ_GOLACO, nF = A.fileiras, nA = Math.round(A.comprimento / A.assento);
  const cores = opc.cores ?? null, real = cores?.corCadeira ?? null;
  const mascara = opc.comTexto && !(real && cores.padrao !== 'mosaico') ? (opc.mascara ?? null) : null;
  const semente = opc.comTexto ? 5 : 9;
  return (f, a) => {
    if (a % A.corredor < 2) return null;
    if (mascara && mascara[a + f * nA] === 1) return { cor: cores?.mosaico ?? '#0d8447', mosaico: true };
    const r = sorteioCelula(f, a, semente);
    const cor = real ? real(cores, f, a, nF, r) : cores ? (r < 0.06 ? cores.tom : r < 0.12 ? cores.tom2 : cores.cadeira) : r < 0.06 ? '#2a3033' : r < 0.12 ? '#0f5233' : '#14181a';
    return { cor, mosaico: false };
  };
}

const tomHex = (h, k) => '#' + [1, 3, 5].map(i => clamp(Math.round(parseInt(h.slice(i, i + 2), 16) * k), 0, 255).toString(16).padStart(2, '0')).join('');
/**
 * A cor de cada cadeira de uma planta curva, por fileira (k, da frente) e pela posição no ladrilho (metade h, cadeira i
 * de n): o padrão da pesquisa — 'tigela-maracana' (amarelo, azul e branco sorteados, mais azul em cima), 'liso', 'misto',
 * 'faixas' (uma cor por anel), 'mosaico' (blocos), 'setores' (as metades alternadas), 'raios' (faixas finas da 2ª cor).
 * opc: {padrao, cores: [c1, c2, c3?], NF (fileiras), faixaDe(k) (o anel da fileira), semente}.
 */
export function pintorAnel(opc) {
  const cs = opc.cores, pal = cs.length >= 2 ? cs : [cs[0], tomHex(cs[0], 0.82)];
  const NF = opc.NF, sem = opc.semente | 0;
  return (k, h, i, n) => {
    const r = sorteioCelula(k, h * 64 + i, sem);
    const xs = h / 2 + ((i + 0.5) / n) / 2;      // posição no ladrilho (0–1), como o xs de antes
    switch (opc.padrao) {
      case 'tigela-maracana': {
        const pes = opc.faixaDe(k) === 0 ? [0.46, 0.24, 0.30] : [0.27, 0.52, 0.21];
        return r < pes[0] ? pal[0] : r < pes[0] + pes[1] ? pal[1] : pal[2] ?? '#e9e9e4';
      }
      case 'misto': return r < 0.56 ? pal[0] : r < 0.86 ? pal[1] : pal[2] ?? pal[0];
      case 'faixas': return pal[Math.min(pal.length - 1, Math.floor((k / NF) * Math.min(3, pal.length)))];
      case 'mosaico': return ((Math.floor(xs * 4) + Math.floor(k / 5)) % 3 === 0) ? pal[1] : pal[0];
      case 'setores': return xs < 0.5 ? pal[0] : pal[1];
      case 'raios': return xs % 0.5 < 0.1 ? pal[1] : pal[0];
      default: return r < 0.9 ? pal[0] : tomHex(pal[0], 0.86);
    }
  };
}

// ------------------------------------------------------------------ escolha dos blocos de perto (pura)
/**
 * Quais blocos viram cadeira 3D neste quadro. cam = {x, y, z, fx, fy, fz (frente, unitário), fov (graus, vertical),
 * aspecto, alturaPx (CSS)}; anteriores: Set dos índices em 3D no quadro anterior; opc = {teto, pxEntra, pxSai, distMax,
 * blocosMax, favorAnterior, semSetor (o setor fora do desenho: o lado de cá, 3, com a câmera dentro dele)}. O tamanho é o da cadeira (0,5 m) a `d` m (a distância à esfera do bloco): px = 0,5 ·
 * alturaPx / (2 · d · tan(fov/2)). Entra com ≥ pxEntra, fica com ≥ pxSai (histerese); fora do cone da câmera não entra;
 * o teto conta instâncias e blocos (os de maior px primeiro; quem já estava vale `favorAnterior` mais). Devolve
 * {lista: [índices], instancias, px: Map(índice → px)}.
 */
export function escolherBlocos(blocos, cam, anteriores = new Set(), opc = {}) {
  const O = { ...CADEIRAS3D, ...opc };
  const teto = Number.isFinite(O.teto) ? O.teto : 0;
  if (teto <= 0 || !blocos.length) return { lista: [], instancias: 0, px: new Map() };
  const meio = (Math.min(170, Math.max(1, cam.fov)) * Math.PI) / 360, tg = Math.tan(meio);
  const diag = Math.atan(tg * Math.sqrt(1 + (cam.aspecto ?? 1) ** 2));
  const cands = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const dx = b.c[0] - cam.x, dy = b.c[1] - cam.y, dz = b.c[2] - cam.z, d = Math.hypot(dx, dy, dz);
    const dMin = Math.max(0.5, d - b.raio);
    if (dMin > O.distMax) continue;
    if (d > b.raio) {
      const cosA = (dx * cam.fx + dy * cam.fy + dz * cam.fz) / d, ang = Math.acos(clamp(cosA, -1, 1));
      if (ang - Math.asin(clamp(b.raio / d, 0, 1)) > diag) continue;
    }
    const px = (CADEIRA.largura * cam.alturaPx) / (2 * dMin * tg);
    const ja = anteriores.has(i);
    if (px < (ja ? O.pxSai : O.pxEntra)) continue;
    if (O.semSetor != null && b.setor === O.semSetor) continue;
    cands.push([i, px, px * (ja ? O.favorAnterior : 1)]);
  }
  cands.sort((p, q) => q[2] - p[2] || p[0] - q[0]);
  const lista = [], pxs = new Map();
  let inst = 0;
  for (const [i, px] of cands) {
    if (lista.length >= O.blocosMax) break;
    if (inst + blocos[i].n > teto) continue;
    lista.push(i); pxs.set(i, px); inst += blocos[i].n;
  }
  lista.sort((p, q) => p - q);
  return { lista, instancias: inst, px: pxs };
}

// ------------------------------------------------------------------ o ORÇAMENTO de triângulos por quadro (puro)
// O 3D de perto (as cadeiras 3D e os torcedores 3D: render/cadeiras3d.js e render/torcedor3d.js) ganha, a cada quadro, no
// máximo (alvo da qualidade − o RESTO do quadro): o resto é o total do último desenho (renderer.info.render.triangles) menos
// o que o próprio 3D de perto pôs nele — a parte que ele não controla, medida (reativa); a parte dele é conhecida antes de
// desenhar (preditiva: Funkhouser & Séquin, SIGGRAPH 1993). O que sobra vai primeiro às PESSOAS (as fileiras do torcedor 3D,
// as de mais px primeiro, com as cadeiras do bloco delas: o torcedor 3D sempre senta numa cadeira 3D) e depois às cadeiras
// sem ninguém. Histerese: só DESCE quando estoura o alvo (primeiro as cadeiras sem gente, depois o nível 0 vira 1, depois sai
// a fileira de menos px) e SOBE devagar (`sobe` unidades inteiras por quadro — a fileira, o nível ou o bloco — e só com
// `margem` de folga). No CORTE de câmera (a câmera nova: corteDeCamera) o resto de antes não vale: 1 quadro sem 3D de perto
// (o resto da câmera nova medido) e, no seguinte, a escolha inteira de uma vez, sem histerese — a troca fica colada no corte,
// onde a vista não a percebe (Smith & Henderson 2008, "Edit Blindness"; Shimamura et al. 2015). PESQUISA-ESTADIO.md §15.
export const ORCAMENTO3D = Object.freeze({
  // alvo do quadro inteiro (triângulos), por qualidade: a Média (o celular) ≤ 130 mil no pior plano (teste-cenas-tela
  // F8/C8/F9, teste-prejogo) com folga para a variação de um quadro para o outro; a Alta (o PC: sem meta de 130 mil) no que
  // o PC já desenha de perto; a Baixa sem 3D de perto
  alvo: Object.freeze({ baixa: 0, media: 127500, alta: 400000 }),
  margem: 2000,          // triângulos de folga para SUBIR (a histerese: desce acima do alvo, sobe só abaixo de alvo − margem)
  sobe: 1,               // unidades (fileira, nível ou bloco) que entram por quadro fora do corte
  // o corte de câmera entre dois quadros: outra câmera, entrou/saiu da câmera de jogo, pulou > `dist` m, virou > `ang`
  // graus ou mudou o campo de visão > `fov` (fração)
  corte: Object.freeze({ dist: 2.5, ang: 25, fov: 0.2 }),
});

/**
 * A câmera mudou de plano entre dois quadros? a (a do quadro anterior, ou null) e b = {obj (o objeto da câmera), x, y, z,
 * fx, fy, fz (frente, unitário), fov (graus), deJogo}. Sem a anterior é corte.
 */
export function corteDeCamera(a, b, opc = ORCAMENTO3D.corte) {
  if (!a) return true;
  if (a.obj !== b.obj || !!a.deJogo !== !!b.deJogo) return true;
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > opc.dist) return true;
  const c = clamp(a.fx * b.fx + a.fy * b.fy + a.fz * b.fz, -1, 1);
  if ((Math.acos(c) * 180) / Math.PI > opc.ang) return true;
  return Math.abs(b.fov / Math.max(1e-6, a.fov) - 1) > opc.fov;
}

const maisPx = (a, b) => b.px - a.px || (String(a.k) < String(b.k) ? -1 : String(a.k) > String(b.k) ? 1 : 0);
/**
 * O 3D de perto de um quadro dentro do orçamento (puro). desejo = {blocos: [{i, px, n}] (escolherBlocos: px, histerese,
 * cone, distância e o teto da qualidade), fileiras: [{chave, bloco, px, n, nivel}] (escolherTorcedores: o teto da
 * qualidade, a histerese e o nível desejado), tri: [triângulos do torcedor no nível 0, no 1], triCadeira}; atual = o que o
 * quadro anterior desenhou {blocos: Set, fileiras: Map(chave → nível)}; opc = {orcamento (triângulos), margem, sobe, novo
 * (sem histerese: tudo de uma vez, partindo do nada)}. Devolve {blocos: Set, fileiras: Map, triCadeiras, triTorcedores,
 * total, desceu, subiu}.
 */
export function orcamentoPerto(desejo, atual, opc = {}) {
  const tri = desejo.tri ?? [0, 0], tc = desejo.triCadeira ?? 18;
  const B = Math.max(0, opc.orcamento ?? Infinity), margem = opc.margem ?? ORCAMENTO3D.margem;
  const novo = !!opc.novo || !atual;
  const blocos = new Map();
  for (const b of desejo.blocos ?? []) blocos.set(b.i, { ...b, k: b.i });
  const filas = [];
  for (const f of desejo.fileiras ?? []) if (f.n > 0 && blocos.has(f.bloco)) filas.push({ ...f, k: f.chave });
  const cB = b => b.n * tc, cF = (f, l) => f.n * tri[l];
  const kb = new Set(), kf = new Map(), nf = new Map();
  const poeFila = (f, l) => { kf.set(f.chave, l); nf.set(f.bloco, (nf.get(f.bloco) ?? 0) + 1); };
  let total = 0;
  // o que fica do quadro anterior (o nível desejado 1 rebaixa na hora; o 0 vindo do 1 é uma subida, mais abaixo)
  if (!novo) {
    for (const i of atual.blocos) { const b = blocos.get(i); if (b) { kb.add(i); total += cB(b); } }
    for (const f of filas) {
      const l = atual.fileiras.get(f.chave);
      if (l === undefined || !kb.has(f.bloco)) continue;
      const lv = Math.max(l, f.nivel);
      poeFila(f, lv); total += cF(f, lv);
    }
  }
  // desce só quando estoura: as cadeiras sem gente, o nível 0 (o de menos px) vira 1, a fileira de menos px sai
  let desceu = false;
  if (total > B) {
    desceu = true;
    const fs = filas.filter(f => kf.has(f.chave)).sort((a, b) => maisPx(b, a));
    const bs = [...kb].map(i => blocos.get(i)).sort((a, b) => maisPx(b, a));
    while (total > B) {
      const b = bs.find(x => kb.has(x.i) && !(nf.get(x.i) > 0));
      if (b) { kb.delete(b.i); total -= cB(b); continue; }
      const f0 = fs.find(f => kf.get(f.chave) === 0);
      if (f0) { kf.set(f0.chave, 1); total -= cF(f0, 0) - cF(f0, 1); continue; }
      const f1 = fs.find(f => kf.has(f.chave));
      if (!f1) break;
      kf.delete(f1.chave); nf.set(f1.bloco, nf.get(f1.bloco) - 1); total -= cF(f1, 1);
    }
  }
  // sobe devagar (novo: tudo de uma vez), só abaixo de orçamento − margem: as pessoas (fileira nova ou o nível 0) e depois
  // as cadeiras sem ninguém, as de mais px primeiro
  let n = novo ? Infinity : opc.sobe ?? ORCAMENTO3D.sobe, subiu = 0;
  const lim = B - margem;
  if (!desceu && n > 0 && lim > total) {
    const cands = [];
    for (const f of filas) {
      const l = kf.get(f.chave);
      if (l === undefined) cands.push({ f, nivel: false, px: f.px, k: f.chave });
      else if (l === 1 && f.nivel === 0) cands.push({ f, nivel: true, px: f.px, k: f.chave });
    }
    cands.sort(maisPx);
    for (const c of cands) {
      if (n <= 0) break;
      const f = c.f;
      if (c.nivel) {
        const d = cF(f, 0) - cF(f, 1);
        if (total + d <= lim) { kf.set(f.chave, 0); total += d; n--; subiu++; }
        continue;
      }
      const extra = kb.has(f.bloco) ? 0 : cB(blocos.get(f.bloco));
      for (const l of f.nivel === 0 ? [0, 1] : [1]) {
        const d = cF(f, l) + extra;
        if (total + d > lim) continue;
        if (extra) kb.add(f.bloco);
        poeFila(f, l); total += d; n--; subiu++;
        break;
      }
    }
    for (const b of [...blocos.values()].filter(x => !kb.has(x.i)).sort(maisPx)) {
      if (n <= 0) break;
      if (total + cB(b) <= lim) { kb.add(b.i); total += cB(b); n--; subiu++; }
    }
  }
  let triCadeiras = 0, triTorcedores = 0;
  for (const i of kb) triCadeiras += cB(blocos.get(i));
  for (const f of filas) { const l = kf.get(f.chave); if (l !== undefined) triTorcedores += cF(f, l); }
  return { blocos: kb, fileiras: kf, triCadeiras, triTorcedores, total, desceu, subiu };
}

/**
 * O orçamento do 3D de perto quadro a quadro (o estado; puro). opc = {qualidade, ...ORCAMENTO3D}. A cada quadro:
 * `inicio(info, cam)` com o último desenho (info = {frame, triangles}: renderer.info.render; null = sem medidor — sem
 * orçamento, como antes) e a câmera deste quadro ({obj, x, y, z, fx, fy, fz, fov, deJogo}) → {orcamento, novo,
 * semAnteriores, corte, resto, esperando}; `planejar(desejo, ctx)` → orcamentoPerto (guarda o plano como o atual);
 * `gastou(tri, {cadeiras, torcedores})`: os triângulos que o 3D de perto vai desenhar neste quadro (o resto do próximo é o
 * total menos eles).
 */
export function criarOrcamento3D(opc = {}) {
  const O = { ...ORCAMENTO3D, ...opc };
  let alvo = O.alvo[opc.qualidade] ?? O.alvo.media;
  const vazio = () => ({ blocos: new Set(), fileiras: new Map() });
  // pular: medidas a ignorar (a troca de qualidade: o desenho que vem a seguir ainda é o da qualidade de antes)
  let atual = vazio(), camAnt = null, frame = null, pendente = 0, resto = null, esperando = true, replanejar = true, pular = 0;
  let ultimo = { orcamento: 0, novo: true, semAnteriores: true, corte: true, resto: null, esperando: true }, gasto = { total: 0, cadeiras: 0, torcedores: 0 };
  return {
    inicio(info, cam) {
      const corte = corteDeCamera(camAnt, cam, O.corte);
      camAnt = { ...cam };
      if (!info) { ultimo = { orcamento: Infinity, novo: true, semAnteriores: false, corte, resto: null, esperando: false }; return ultimo; }
      // houve desenho desde o último quadro: o resto dele (o 3D de perto desse desenho é o `pendente`); o renderizador novo
      // (o contador voltou) ou o 1º quadro: sem medida
      let mediu = false;
      if (frame !== null && info.frame > frame) {
        if (pular > 0) pular--;
        else { resto = Math.max(0, info.triangles - pendente); mediu = true; }
      } else if (frame === null || info.frame < frame) esperando = true;
      frame = info.frame;
      if (esperando && mediu) { esperando = false; replanejar = true; }
      if (corte) esperando = true;
      if (esperando) ultimo = { orcamento: 0, novo: true, semAnteriores: true, corte, resto, esperando: true };
      else {
        const novo = replanejar;
        replanejar = false;
        ultimo = { orcamento: Math.max(0, alvo - resto), novo, semAnteriores: novo, corte, resto, esperando: false };
      }
      return ultimo;
    },
    planejar(desejo, ctx = ultimo) {
      const r = orcamentoPerto(desejo, ctx.novo ? null : atual, { orcamento: ctx.orcamento, margem: O.margem, sobe: O.sobe, novo: ctx.novo });
      atual = { blocos: r.blocos, fileiras: r.fileiras };
      return r;
    },
    /** O que o 3D de perto vai desenhar neste quadro: tri (o total) e o detalhe {cadeiras, torcedores, perto (a malha perto da torcida: a densidade real)}. */
    gastou(tri, det = {}) { pendente = tri; gasto = { total: tri, cadeiras: det.cadeiras ?? 0, torcedores: det.torcedores ?? 0, perto: det.perto ?? 0 }; },
    /**
     * A qualidade mudou: o alvo dela e o resto medido de novo (o próximo desenho ainda é o da qualidade de antes: ignorado;
     * até a medida nova, sem 3D de perto) e a escolha inteira de uma vez.
     */
    definirQualidade(q) { alvo = O.alvo[q] ?? alvo; esperando = true; pular = 1; replanejar = true; },
    /** Escolhe de novo, de uma vez (as cadeiras 3D religadas, o modelo do torcedor chegou, a torcida voltou). */
    replanejar() { replanejar = true; },
    get atual() { return atual; },
    get alvo() { return alvo; },
    get estado() { return { alvo, resto, orcamento: ultimo.orcamento, corte: ultimo.corte, esperando: ultimo.esperando, novo: ultimo.novo, gasto }; },
  };
}

// ------------------------------------------------------------------ a cadeira rebatível (geometria pura)
/**
 * A cadeira de estádio (concha + encosto) em ~18 triângulos, sem índice, normais por face. Local: x de lado (largura),
 * z para a FRENTE (o campo), y para cima; a origem no piso, no centro do assento. Devolve {posicao, normal: Float32Array,
 * triangulos}.
 */
export function geometriaCadeira() {
  const S = CADEIRA.assento, w = S.largura / 2, h = S.altura, f = S.fundo;
  const zf = f / 2, zt = -f / 2;                       // frente e fundo do assento
  const conc = 0.035;                                  // a concha: as bordas do assento e do encosto um pouco mais altas
  const yE0 = h + 0.03, yE1 = h + S.encosto, zE0 = zt - 0.02, zE1 = zt - 0.07;   // encosto inclinado para trás
  const P = [];
  const tri = (a, b, c2) => P.push(a, b, c2);
  const quad = (a, b, c2, d) => { tri(a, b, c2); tri(a, c2, d); };
  // assento: a concha (o meio mais fundo, as bordas de lado mais altas) em 2 faixas de lado a lado
  quad([-w, h + conc, zf], [0, h, zf], [0, h - 0.012, zt], [-w, h + conc * 0.6, zt]);
  quad([0, h, zf], [w, h + conc, zf], [w, h + conc * 0.6, zt], [0, h - 0.012, zt]);
  // a borda da frente do assento (o lábio, 4 cm)
  quad([-w, h + conc - 0.045, zf + 0.012], [w, h + conc - 0.045, zf + 0.012], [w, h + conc, zf], [-w, h + conc, zf]);
  // o encosto: 2 faixas na altura × 2 metades (a concha: as bordas de lado vêm 3 cm para a frente)
  const yEm = (yE0 + yE1) / 2, zEm = (zE0 + zE1) / 2;
  for (const s of [-1, 1]) {
    const bx = s * w, bz = 0.03;
    const A0 = [bx, yE0, zE0 + bz], A1 = [0, yE0, zE0], B0 = [bx, yEm, zEm + bz], B1 = [0, yEm, zEm], C0 = [bx, yE1, zE1 + bz * 0.6], C1 = [0, yE1, zE1];
    if (s < 0) { quad(A0, A1, B1, B0); quad(B0, B1, C1, C0); } else { quad(A1, A0, B0, B1); quad(B1, B0, C0, C1); }
  }
  // o topo do encosto (a espessura, 3 cm)
  quad([-w, yE1, zE1 + 0.018], [w, yE1, zE1 + 0.018], [w, yE1, zE1 - 0.012], [-w, yE1, zE1 - 0.012]);
  // o pé (a coluna que prende no piso, embaixo do meio do assento)
  quad([-0.04, 0, zt + 0.05], [0.04, 0, zt + 0.05], [0.04, h - 0.01, zt + 0.02], [-0.04, h - 0.01, zt + 0.02]);
  const posicao = new Float32Array(P.length * 3), normal = new Float32Array(P.length * 3);
  for (let i = 0; i < P.length; i += 3) {
    const [a, b, c2] = [P[i], P[i + 1], P[i + 2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln;
    for (let k = 0; k < 3; k++) { posicao.set(P[i + k], (i + k) * 3); normal.set([nx, ny, nz], (i + k) * 3); }
  }
  return { posicao, normal, triangulos: P.length / 3 };
}

/**
 * A matriz (16 números, coluna a coluna, a de three.js Matrix4.elements) de uma cadeira: no ponto (x, y, z) virada para
 * (cos rumo, sin rumo) — o z local da cadeira vai para o rumo —, a largura escalada por `escX`.
 */
export function matrizCadeira(c, escX = 1, out = new Float32Array(16), o = 0) {
  // z local → (cos r, 0, sin r); x local → (sin r, 0, −cos r)·escX (mão direita: x × y = z)
  const cr = Math.cos(c.rumo), sr = Math.sin(c.rumo);
  out[o] = sr * escX; out[o + 1] = 0; out[o + 2] = -cr * escX; out[o + 3] = 0;
  out[o + 4] = 0; out[o + 5] = 1; out[o + 6] = 0; out[o + 7] = 0;
  out[o + 8] = cr; out[o + 9] = 0; out[o + 10] = sr; out[o + 11] = 0;
  out[o + 12] = c.x; out[o + 13] = c.y; out[o + 14] = c.z; out[o + 15] = 1;
  return out;
}
/** A escala de largura da cadeira 3D numa cadeira da grade de largura `larg` (entre 0,8 e 1,15). */
export const escalaLargura = larg => clamp(larg / CADEIRA.largura, 0.8, 1.15);
