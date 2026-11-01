// Auditoria das CADEIRAS e da TORCIDA em todos os estádios (item 69 da FILA, PR 4: "os 523 estádios e o padrão, com a
// calibração"). Só MEDE: não muda nada do jogo. Percorre o Estádio Golaço (o padrão: a edição pública e o jogo neutro), os
// 523 estádios de assets/tm/estadios.json e o homônimo de outra cidade (homonimos) — os 105 com `forma` pela planta deles (o
// Maracanã por js/estadio-planta.js, os outros pela planta genérica js/estadio-generico.js) e os sem forma pela geometria
// do Estádio Golaço com as cores, o padrão das cadeiras e a capacidade de cada um (a edição pro) — e mede, por estádio e
// por lado/anel, com as MESMAS funções puras do jogo (render/cadeiras-dados.js, render/torcida-dados.js,
// render/impostor-dados.js, render/torcedor-dados.js, as plantas, estadio-forma.js, identidade.js, prejogo-roteiro.js):
//   GRADE)    fileiras, cadeiras, cadeiras entre escadas (FIFA 2022 §5.2: ≤ 28; ≤ 14 com escada de um lado só — o lado
//             sem escada é a ponta da arquibancada, o túnel, a face de um camarote; o vomitório do Maracanã conta como
//             saída), a largura da escada (SGSA SG02: 1,2 m), a largura da cadeira (o passo entre centros; a 3D tem
//             0,46 m × escalaLargura) e a profundidade da fileira (a perpendicular à fileira: FIFA/Green Guide 0,8 m;
//             a cadeira 3D precisa de 0,78 m para o encosto não entrar no espelho de trás — 0,36 × prof ≥ 0,282 m);
//   CAIMENTO) o ângulo de cada fileira (espelho ÷ profundidade; Green Guide: ≤ 34°) e o espelho (o degrau);
//   CAPACIDADE) as cadeiras da grade × a capacidade real (o campo `capacidade`) e a razão; os torcedores desenhados por
//             qualidade (gerarTorcidaNiveis: Baixa/Média/Alta) e quantos lugares REAIS (e cadeiras da grade) cada um
//             vale; a escala do torcedor (aPos.w: o quadro SDF a usa inteira; o impostor a limita a 0,9–1,25 —
//             IMPOSTOR.escala — e o 3D e a malha perto a 0,94–1,06): o máximo e quantos passam de 1,25 (pulam de
//             tamanho na troca do quadro pelo impostor);
//   CORES)    a cor de cada cadeira 3D (= a da textura: o MESMO pintor — pintorGolaco com a corCadeiraReal na edição
//             pro, pintorAnel nas genéricas, pintorMaracana) × os campos cadeiras_cor, cadeiras_cor2 e cadeiras_padrao da
//             base: a cor que domina, a fração na 1ª e na 2ª cor (ΔE₀₀ < 10), o padrão desenhado;
//   FORA DO LUGAR) a cadeira dentro de um sólido da planta (o assento, a cabeça sentado, de pé e no pulo: f = 0),
//             debaixo de uma cobertura baixa (a folga da chapa até a cabeça de quem está de pé), fora do piso do degrau,
//             sobreposta a outra (o passo menor que a largura das duas cadeiras 3D) ou em cima da escada (a borda da
//             cadeira 3D dentro da faixa da escada); o torcedor sem cadeira (a conta do torcedorDa do torcedor 3D) e a
//             cadeira com dois torcedores; no Estádio Golaço, as cadeiras debaixo da marquise do JOGO num estádio cuja
//             base diz `cobertura: nenhuma` (a marquise só some no pré-jogo: render/fachada-estilos.js esconderMarquise);
//   PERTO)    o 3D de perto nas câmeras de perto (as 6 do tools/medir-cadeiras.mjs e os planos de torcida do pré-jogo de
//             cada planta: organizada, ladoDeLa, visitantes, dentro): os blocos e as cadeiras 3D (escolherBlocos), os
//             torcedores 3D (a densidade real — preencherBloco — e escolherTorcedores com os triângulos do modelo de
//             assets/torcedor/torcedor.bin) e os triângulos que o 3D de perto QUER (cadeira 18 + 2 do quadro de quem
//             senta nela; torcedor no nível dele); o resto do quadro (os jogadores, a torcida, o estádio) só se mede no
//             navegador: daqui sai o maior resto com que o desejo inteiro ainda cabe no alvo da qualidade
//             (ORCAMENTO3D.alvo − margem − desejo) — o orçamento corta abaixo disso.
// Contas que só existem num módulo com three.js, replicadas aqui em puro: corCadeiraReal (render/fachada-estilos.js:249),
// o torcedorDa e o doBloco do torcedor 3D (render/torcedor3d.js:176/195), o desejo dele (render/torcedor3d.js:302) e o
// custo por cadeira do plano (render/cadeiras3d.js:130). Limites: a máscara do mosaico em letras (o nome do mandante nas
// cadeiras e nas camisas da torcida) é desenhada num canvas (render/texturas.js mascaraTexto): fica fora (sem ela, as
// células do mosaico ficam com a cor e a ocupação das outras).
//   node tools/auditar-cadeiras.mjs --saida <pasta> [--js <pasta js>] [--so chave1,chave2] [--par 3] [--sem-solidos]
//                                   [--sem-perto]
// Saída: <pasta>/auditoria.json (por estádio) e <pasta>/auditoria.md (o resumo por família, os piores casos e a
// distribuição). PESQUISA-ESTADIO.md §14–§16; contratos "Cadeiras 3D", "Torcedor 3D" e "Impostor da torcida" (item 69).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const pastaJs = path.resolve(arg('--js', path.join(AQUI, '../js')));
const SAIDA = path.resolve(arg('--saida', path.join(os.tmpdir(), 'auditoria-cadeiras')));
const SO = arg('--so', null)?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const PAR = Math.max(1, Math.min(3, Number(arg('--par', 1)) || 1));
const FATIA = arg('--fatia', null);   // 'i/n' (filho: só os estádios de índice ≡ i mod n)
const PARCIAL = arg('--parcial', null);
const SEM_SOLIDOS = args.includes('--sem-solidos');
const SEM_PERTO = args.includes('--sem-perto');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
const r3 = v => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);

// ------------------------------------------------------------------ estatística
/** Uma amostra de números: push(v) e resumo() → {n, min, p5, p50, p95, max}. */
class Amostra {
  constructor() { this.v = new Float64Array(1024); this.n = 0; }
  push(x) {
    if (!Number.isFinite(x)) return;
    if (this.n === this.v.length) { const w = new Float64Array(this.v.length * 2); w.set(this.v); this.v = w; }
    this.v[this.n++] = x;
  }
  resumo(d = 3) {
    if (!this.n) return { n: 0 };
    const s = this.v.slice(0, this.n).sort();
    const p = q => s[Math.min(this.n - 1, Math.max(0, Math.floor(q * this.n)))];
    const k = 10 ** d, f = v => Math.round(v * k) / k;
    return { n: this.n, min: f(s[0]), p5: f(p(0.05)), p50: f(p(0.5)), p95: f(p(0.95)), max: f(s[this.n - 1]) };
  }
  contar(fn) { let c = 0; for (let i = 0; i < this.n; i++) if (fn(this.v[i])) c++; return c; }
}
const pct = (arr, q) => { const s = [...arr].filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] : NaN; };

// ------------------------------------------------------------------ os módulos do jogo (puros)
const CD = await imp('render/cadeiras-dados.js');
const TD = await imp('render/torcida-dados.js');
const IMP = await imp('render/impostor-dados.js');
const TOR = await imp('render/torcedor-dados.js');
const GE = await imp('estadio-generico.js');
const PL = await imp('estadio-planta.js');
const EF = await imp('estadio-forma.js');
const IDT = await imp('identidade.js');
const PR = await imp('prejogo-roteiro.js');
const { ESTADIO } = await imp('config.js');
const { CADEIRA, NO_PISO, CADEIRAS3D, ORCAMENTO3D } = CD;
const BASE = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8'));
const MODELO = TOR.lerModelo(fs.readFileSync(path.join(pastaJs, '../assets/torcedor/torcedor.bin')).buffer.slice(0));
// os triângulos de um torcedor 3D em cada nível (o maior das variações: render/torcedor3d.js tri())
const TRI_TOR = [0, 1].map(l => Math.max(...MODELO.malhas.map(pv => pv[l].nTri)));
const LARG3D = CADEIRA.assento.largura;   // 0,46 m: a cadeira 3D antes da escala de largura
const PROF_ENCOSTO = 0.282;               // m do centro do assento até as costas do encosto (geometriaCadeira: zt − 0,07 − 0,012)
const PROF_MIN_3D = PROF_ENCOSTO / (1 - NO_PISO);   // a fileira mais rasa em que o encosto não entra no espelho (0,78 m)
const T = ESTADIO.tunel, MT = T.largura / 2 + 0.4, TOPO_TUNEL = T.altura + T.laje + 0.3;
const QUAL = ['baixa', 'media', 'alta'];
const LADO_NOME = ['lá', 'fundo +x', 'fundo −x', 'cá'];
// as alturas testadas nos sólidos (acima do piso da cadeira): o assento, a cabeça sentado, de pé e no pulo da explosão
const ALTURAS = [['assento', 0.45], ['cabeça sentado', 1.3], ['cabeça de pé', 1.85], ['pulo', 2.15]];
const DE_PE = 1.85;
// as câmeras de perto (as de tools/medir-cadeiras.mjs): [nome, de, para, fov] e as telas (Média: o celular deitado 844 ×
// 390; Alta: o PC 1280 × 720)
const PERTO = [
  ['gol', [-49.5, 1.6, 0], [-80, 8, 0], 60],
  ['atras', [-56, 6, -8], [-70, 10, 6], 55],
  ['canto', [48, 1.7, -30], [62, 6, -44], 50],
  ['lado', [10, 2.2, -36], [14, 9, -52], 55],
  ['tunel', [0, 3.5, 40], [0, 8, 10], 60],
  ['frente', [8, 3.2, -41.5], [9, 4.6, -47], 50],
];
const PLANOS_TORCIDA = ['organizada', 'ladoDeLa', 'visitantes', 'dentro'];
const TELA = { media: { aspecto: 844 / 390, alturaPx: 390 }, alta: { aspecto: 1280 / 720, alturaPx: 720 } };

// ------------------------------------------------------------------ réplicas puras (contas que moram em módulos com three.js)
/** render/fachada-estilos.js:249 corCadeiraReal (o módulo importa three.js): a cor de uma cadeira do Golaço pelo padrão. */
function corCadeiraReal(cores, f, a, nF, r) {
  const c1 = cores.cadeira, c2 = cores.cadeira2 ?? cores.tom2;
  if (cores.padrao === 'misto') return r < 0.5 ? c1 : r < 0.84 ? c2 : r < 0.93 ? '#e6e9e9' : cores.tom;
  if (cores.padrao === 'faixas') {
    const an = Math.max(1, Math.min(3, Math.round(cores.aneis) || 1));
    const banda = an >= 2 ? an - 1 - Math.min(an - 1, Math.floor(f * an / nF)) : Math.floor(a / 26);
    return r < 0.05 ? cores.tom : banda % 2 ? c2 : c1;
  }
  return r < 0.05 ? cores.tom : r < 0.09 ? cores.tom2 : c1;
}
/** render/estadio-real.js:108 pintorMaracana (o módulo importa three.js). */
function pintorMaracana(P) {
  const G = P.grade, cs = P.forma.cadeiras;
  const pal = cs.length >= 3 ? cs : [cs[0], cs[1], '#e9e9e4'];
  return CD.pintorAnel({ padrao: 'tigela-maracana', cores: pal, NF: G.NF, faixaDe: k => G.fileiras[k].faixa, semente: 160216 });
}
/** render/estadio-generico.js:115 pintorGenerico (o módulo importa three.js). */
const pintorGenerico = P => CD.pintorAnel({ padrao: P.forma.padrao, cores: P.forma.cadeiras, NF: P.grade.NF, semente: P.forma.semente || 7 });

// ------------------------------------------------------------------ a lista dos estádios
/** [{chave, e (a entrada da base; null = o padrão), homonimo}] na ordem: o padrão, a base, os homônimos de outra cidade. */
function listaEstadios() {
  const out = [{ chave: 'padrao', e: null, homonimo: false }];
  for (const [k, e] of Object.entries(BASE.estadios)) out.push({ chave: k, e, homonimo: false });
  for (const [k, l] of Object.entries(BASE.homonimos ?? {})) {
    const t = BASE.estadios[k];
    for (const h of l) if (!t || h.cidade !== t.cidade || h.nome !== t.nome) out.push({ chave: `${k} (${h.cidade})`, e: h, homonimo: true });
  }
  return out;
}
/** Os homônimos que são o MESMO estádio da base (a mesma cidade) mas sem a forma dela: o jogo acha o homônimo pelo clube. */
function homonimosSemForma() {
  const out = [];
  for (const [k, l] of Object.entries(BASE.homonimos ?? {})) {
    const t = BASE.estadios[k];
    for (const h of l) if (t && h.cidade === t.cidade && t.forma && !h.forma) out.push({ chave: k, cidade: h.cidade, clubes: h.clubes ?? [] });
  }
  return out;
}

// ------------------------------------------------------------------ a geometria de cada estádio
/**
 * A geometria em que as cadeiras do estádio são desenhadas (a mesma escolha de render/identidade-pagina.js): a forma do
 * Maracanã, a planta genérica (criarPlantaGenerica que deu certo) ou o Estádio Golaço.
 */
function geometriaDe(e) {
  const fb = e && e.forma && typeof e.forma === 'object' && !Array.isArray(e.forma) ? e.forma : null;
  if (fb && fb.entorno === 'maracana') {
    const P = PL.criarPlanta(PL.validarForma(fb));
    if (P) return { tipo: 'maracana', familia: 'maracana', P };
  } else if (fb) {
    const P = GE.criarPlantaGenerica(fb);
    if (P) return { tipo: 'generica', familia: P.familia, P };
  }
  return { tipo: 'golaco', familia: 'golaco', P: null };
}

/** Os blocos de cadeiras 3D e o 3D de perto que o jogo QUER nas câmeras de perto (sem o resto do quadro: ver o cabeçalho). */
function medirPerto(geo, G, dados) {
  const P = geo.P;
  const ladoDeCa = P ? P.cameraNoLadoDeCa : TD.cameraNoLadoDeCa;
  const solido = P ? (x, y, z) => P.solido(x, y, z, 0.3, false) : (x, y, z) => { EF.definirForma(null); return EF.solidoEm(x, y, z, 0.3, false); };
  const cams = PERTO.map(([nome, de, para, fov]) => ({ nome, de, para, fov }));
  for (const id of PLANOS_TORCIDA) {
    const p = PR.PLANOS_PREJOGO[id];
    if (!p?.cam) continue;
    const q = { ...p, cam: { ...p.cam } };
    if (P?.ajustarPlano) P.ajustarPlano(q);
    const m = a => a[Math.floor((a.length - 1) / 2)];
    cams.push({ nome: 'prejogo:' + id, de: m(q.cam.de), para: m(q.cam.para), fov: q.cam.fov[0] });
  }
  // o mapa da torcida por célula de 0,5 m (render/torcedor3d.js montarHash/torcedorDa)
  const celula = (x, z) => (Math.floor(x * 2) + 4096) * 8192 + (Math.floor(z * 2) + 4096);
  const hash = new Map();
  for (let i = 0; i < dados.n; i++) { const k = celula(dados.pos[4 * i], dados.pos[4 * i + 2]); const l = hash.get(k); if (l) l.push(i); else hash.set(k, [i]); }
  function torcedorDa(c) {
    let melhor = -1, dm = Infinity;
    for (const dx of [-0.07, 0, 0.07]) for (const dz of [-0.02, 0.02]) {
      const l = hash.get(celula(c.x + dx, c.z + dz));
      if (!l) continue;
      for (const i of l) {
        const ex = Math.abs(dados.pos[4 * i] - c.x), ez = Math.abs(dados.pos[4 * i + 2] - c.z), ey = Math.abs(dados.pos[4 * i + 1] - c.y);
        if (ex <= 0.07 && ez <= 0.02 && ey <= 0.02 && ex + ez < dm) { dm = ex + ez; melhor = i; }
      }
    }
    return melhor;
  }
  const cacheBloco = new Map();
  /** render/torcedor3d.js doBloco: as pessoas do bloco com a densidade real e as fileiras delas. */
  function doBloco(i, q) {
    const ch = i + ':' + q;
    let b = cacheBloco.get(ch);
    if (b) return b;
    const as = G.assentosDoBloco(i);
    const ocup = new Int32Array(as.length);
    for (let j = 0; j < as.length; j++) ocup[j] = torcedorDa(as[j]);
    const cx = G.blocos[i].caixa;
    const Pp = IMP.preencherBloco(as, ocup, dados, q, cx ? cx.eixo : [1, 0]);
    const por = new Map();
    for (let e = 0; e < Pp.n; e++) {
      const c = as[Pp.assento[e]];
      let f = por.get(c.f);
      if (!f) por.set(c.f, f = { n: 0, sx: 0, sy: 0, sz: 0 });
      f.n++; f.sx += c.x; f.sy += c.y; f.sz += c.z;
    }
    b = { pessoas: Pp.n, novos: Pp.novos, daTorcida: Pp.daTorcida, desenhados: Pp.desenhados, linhas: [...por].map(([fi, f]) => ({ chave: i + ':' + fi, n: f.n, c: [f.sx / f.n, f.sy / f.n + 0.8, f.sz / f.n] })) };
    cacheBloco.set(ch, b);
    return b;
  }
  const out = {};
  for (const q of ['media', 'alta']) {
    const qi = QUAL.indexOf(q), tela = TELA[q], lista = [];
    for (const c of cams) {
      const [dx, dy, dz] = [c.para[0] - c.de[0], c.para[1] - c.de[1], c.para[2] - c.de[2]], L = Math.hypot(dx, dy, dz) || 1;
      const cam = { x: c.de[0], y: c.de[1], z: c.de[2], fx: dx / L, fy: dy / L, fz: dz / L, fov: c.fov, aspecto: tela.aspecto, alturaPx: tela.alturaPx };
      const semCa = !!ladoDeCa({ x: cam.x, y: cam.y, z: cam.z });
      const dentro = solido(cam.x, cam.y, cam.z);
      const r = CD.escolherBlocos(G.blocos, cam, new Set(), { teto: CADEIRAS3D.teto[q], semSetor: semCa ? 3 : null });
      // o desejo do torcedor 3D (render/torcedor3d.js desejo): as fileiras dos blocos pelos px da cadeira no meio delas
      const unidades = [];
      let pessoas = 0;
      for (const i of r.lista) {
        const b = doBloco(i, qi);
        pessoas += b.pessoas;
        for (const f of b.linhas) unidades.push({ chave: f.chave, bloco: i, px: TOR.pxCadeira(Math.hypot(f.c[0] - cam.x, f.c[1] - cam.y, f.c[2] - cam.z), cam), n: f.n });
      }
      const et = TOR.escolherTorcedores(unidades, new Map(), { ...TOR.TORCEDOR3D.qual[q], tri: TRI_TOR });
      const fileiras = unidades.filter(u => et.escolha.has(u.chave)).map(u => ({ ...u, nivel: et.escolha.get(u.chave) }));
      // o custo de cada cadeira do plano (render/cadeiras3d.js: 18 + 2 do quadro de quem senta nela na malha perto)
      const triCadeira = 18 + 2;
      const desejo = { blocos: r.lista.map(i => ({ i, px: r.px.get(i), n: G.blocos[i].n })), fileiras, tri: TRI_TOR, triCadeira };
      const tudo = CD.orcamentoPerto(desejo, null, { orcamento: Infinity, novo: true });
      const alvo = ORCAMENTO3D.alvo[q];
      const em3d = fileiras.reduce((s, f) => s + f.n, 0);
      lista.push({
        cam: c.nome, semCa, cameraEmSolido: dentro || null, blocos: r.lista.length, cadeiras: r.instancias, torcedores3d: em3d,
        pessoasPerto: Math.max(0, pessoas - em3d), triDesejo: tudo.total, restoMax: alvo - ORCAMENTO3D.margem - tudo.total,
      });
    }
    out[q] = lista;
  }
  return out;
}

/**
 * As medidas que dependem só da GEOMETRIA (a grade, a torcida, os sólidos, a cobertura, o 3D de perto). geo = geometriaDe().
 */
function auditarGeometria(geo) {
  const t0 = performance.now();
  const P = geo.P;
  const G = P ? P.grade : CD.gradeGolaco();
  const anel = G.tipo === 'anel';
  const perfil = P ? (P.perfil.length > 1 ? (s, th) => P.perfil(s, th) : s => P.perfil(s)) : null;
  const FL = CD.fileirasGolaco('lado'), FF = CD.fileirasGolaco('fundo'), nFG = CD.ARQ_GOLACO.fileiras;
  const solido = !P ? (x, y, z) => { EF.definirForma(null); return EF.solidoEm(x, y, z, 0, true); } : (x, y, z) => P.solido(x, y, z, 0, true, false);
  // ---------------------------------------------------------------- a cobertura: a parte de baixo da chapa em (x, z)
  let baixoCob;
  if (!P) {
    const A = CD.ARQ_GOLACO, z1 = A.frenteZ + A.profLado;
    baixoCob = (x, z) => {
      const az = Math.abs(z);
      if (Math.abs(x) > A.meioComprimento) return null;
      if (z < 0 && az >= z1 - 16) return A.yTopoLado + 5 + 1.5 * (z1 - az) / 16 - 0.3;      // a marquise de lá
      if (z > 0 && az >= z1 - 4.5) return A.yTopoLado + 5 + 0.6 * (z1 - az) / 4.5 - 0.3;   // o teto curto de cá
      return null;
    };
  } else if (geo.tipo === 'maracana') {
    const C = P.forma.cobertura;
    baixoCob = (x, z) => { const u = P.uCob(x, z); if (u < -0.03 || u > 1.01) return null; return P.alturaCob(clamp(u, 0, 1)) - 1.0 - (C.vale ?? 0); };
  } else {
    const C = P.forma.cobertura;
    baixoCob = (x, z) => {
      const yc = P.alturaCobEm(x, z);
      if (yc == null) return null;
      const th = Math.atan2(z, x), c = P.cobEm(th), r = Math.hypot(x, z);
      const uu = c ? (c.fora - r) / Math.max(1e-6, c.fora - c.dentro) : 0;
      return yc - (uu > 0.85 ? (C.sust === 'trelica' ? 3.6 : 2.2) : 1.2);
    };
  }
  // ---------------------------------------------------------------- as cadeiras (uma passada)
  const porLado = new Map();   // 'setor|anel' → acumulador
  const lado = (setor, an) => {
    const k = setor + '|' + an;
    let L = porLado.get(k);
    if (!L) porLado.set(k, L = { setor, anel: an, cadeiras: 0, fileiras: new Set(), larg: new Amostra(), prof: new Amostra(), espelho: new Amostra(), caim: new Amostra(), escada: new Amostra(), caimFora: new Amostra(), profFora: new Amostra(), cantos: 0, acima34: 0, acima34Canto: 0, rasaEncosto: 0, rasaEncostoCanto: 0, rasaMin: 0, rasaMinCanto: 0, funda: 0, runs: { max2: 0, max1: 0, max0: 0, viol: 0, cadViol: 0, n: 0, exemplos: [] } });
    return L;
  };
  const N = { cadeiras: 0, noArco: 0, foraDoDegrau: 0, degrauMax: 0, sobrepostas: 0, sobrepostasLado: 0, naEscada: 0, cobertas: 0, cobCabeca: 0, cobBaixa: 0, cobFolgaMin: Infinity, solidos: {}, espelhoAlto: 0 };
  const xs = [], ys = [], zs = [], rs = [], ws = [];
  const grupos = new Map();   // as metades de ladrilho (anel) / as fileiras (Golaço): as cadeiras de cada uma em ordem
  const trechoIdx = c => (P && P.trechoDe ? P.trechoDe(c.x, c.z) : 0);
  // a profundidade NOMINAL do lado em θ (a da pesquisa: forma.lados[lado que manda em θ].prof; no Maracanã, a mediana da
  // volta): a cadeira está num CANTO/PONTA EM CUNHA quando a profundidade radial da arquibancada ali (rB − rF) é < 85% dela
  const RAZ_CANTO = 0.85;
  let profNominal = null;
  if (anel && geo.tipo === 'generica') profNominal = th => P.forma.lados[GE.LADOS[P.ladoEm(th)]].prof;
  else if (anel) { const ds = []; for (let i = 0; i < 720; i++) { const th = -Math.PI + (2 * Math.PI * (i + 0.5)) / 720; ds.push(P.rB(th) - P.rF(th)); } const med = pct(ds, 0.5); profNominal = () => med; }
  const arcos = P?.marcas ? P.marcas.filter(m => m.tipo === 'arco') : [];
  const fila = [];   // a fileira de cada cadeira (as sobrepostas: lado a lado na mesma fileira × entre fileiras)
  G.iterar(c => {
    N.cadeiras++;
    let prof, esp, setor = c.setor, an = 0, canto = false;
    if (anel) {
      const r = G.fileiras[c.k];
      an = r.faixa;
      const [x0, z0] = P.ponto(c.th, r.s0), [x1, z1] = P.ponto(c.th, r.s1);
      const nx = Math.cos(c.rumo), nz = Math.sin(c.rumo);
      prof = Math.abs((x1 - x0) * nx + (z1 - z0) * nz);
      const y0 = perfil(r.s0, c.th);
      esp = perfil(r.s1, c.th) - y0;
      canto = (P.rB(c.th) - P.rF(c.th)) < RAZ_CANTO * profNominal(c.th);
      const dg = Math.abs(c.y - y0);
      if (dg > 0.01) N.foraDoDegrau++;
      N.degrauMax = Math.max(N.degrauMax, dg);
      const ti = trechoIdx(c), ch = ti + '|' + c.k + '|' + c.t + '|' + c.h;
      fila.push(ti * 10000 + c.k);
      let g = grupos.get(ch);
      if (!g) grupos.set(ch, g = { ti, k: c.k, t: c.t, h: c.h, n: c.n, setor, an, is: [] });
      g.is.push(c.i);
      // em cima da escada: a borda da cadeira 3D (1 cm para dentro) na faixa da escada da metade dela
      const w = LARG3D * CD.escalaLargura(c.larg) / 2 - 0.01, tx = -Math.sin(c.rumo), tz = Math.cos(c.rumo), tr = G.trechos[ti];
      for (const sg of [-1, 1]) {
        const ex = c.x + sg * w * tx, ez = c.z + sg * w * tz;
        const u = tr.uDe(Math.atan2(ez, ex), r.sAssento), fr = u - Math.floor(u), hh = fr >= 0.5 ? 1 : 0, qq = (fr - hh / 2) * 2;
        if (qq < G.corredor) { N.naEscada++; break; }
      }
    } else {
      const j = nFG - 1 - c.f, r = setor === 0 || setor === 3 ? FL[j] : FF[j];
      prof = r.p; esp = r.h;
      fila.push(setor * 10000 + c.f);
      if (Math.abs(c.y - r.y) > 0.01) N.foraDoDegrau++;
      const ch = setor + '|' + c.f;
      let g = grupos.get(ch);
      if (!g) grupos.set(ch, g = { setor, f: c.f, an: 0, as: [] });
      g.as.push(c.a);
      if (LARG3D * CD.escalaLargura(c.larg) > c.larg + 0.02) N.naEscada++;
    }
    const L = lado(setor, an);
    L.cadeiras++; L.fileiras.add(anel ? c.k : c.f);
    L.larg.push(c.larg); L.prof.push(prof); L.espelho.push(esp);
    const cm = Math.atan2(esp, prof) * DEG;
    L.caim.push(cm);
    if (canto) L.cantos++; else { L.caimFora.push(cm); L.profFora.push(prof); }
    if (cm > CADEIRA.caimentoMax + 0.05) { L.acima34++; if (canto) L.acima34Canto++; }
    if (prof < PROF_MIN_3D - 0.005) { L.rasaEncosto++; if (canto) L.rasaEncostoCanto++; }
    if (prof < 0.7) { L.rasaMin++; if (canto) L.rasaMinCanto++; }
    if (prof > 1.2) L.funda++;
    if (esp > 0.75) N.espelhoAlto++;
    xs.push(c.x); ys.push(c.y); zs.push(c.z); rs.push(c.rumo); ws.push(LARG3D * CD.escalaLargura(c.larg));
    // a cobertura em cima: a folga da chapa até a cabeça de quem está de pé
    const yb = baixoCob(c.x, c.z);
    if (yb != null && yb > c.y) {
      N.cobertas++;
      const folga = yb - (c.y + DE_PE);
      N.cobFolgaMin = Math.min(N.cobFolgaMin, folga);
      if (folga < 0) N.cobCabeca++;
      else if (folga < 0.5) N.cobBaixa++;
    }
    // dentro do tubo do arco das marcas (o raio dele, sem a folga de 1 m do sólido), do assento à cabeça sentado
    for (const m of arcos) {
      const ao = m.lado ? c.x : c.z, perp = m.lado ? c.z : c.x, sl = [-1, 1, -1, 1][m.k];
      if (Math.abs(ao) > m.meia) continue;
      const ya = m.alto * (1 - (ao / m.meia) ** 2);
      if ([0.45, 0.8, 1.3].some(h => Math.hypot(perp - sl * m.dist, c.y + h - ya) <= m.raio)) { N.noArco++; break; }
    }
    // dentro de um sólido (f = 0): o assento, a cabeça sentado, de pé e no pulo
    if (!SEM_SOLIDOS) for (const [nome, h] of ALTURAS) {
      const s = solido(c.x, c.y + h, c.z);
      if (s) { const k = nome + ': ' + s; N.solidos[k] = (N.solidos[k] ?? 0) + 1; }
    }
  });
  // ---------------------------------------------------------------- sobrepostas (o passo menor que as duas cadeiras 3D)
  {
    const n = xs.length, CEL = 0.5, mapa = new Map();
    const ch = (i, j) => (i + 8192) * 16384 + (j + 8192);
    for (let k = 0; k < n; k++) { const kk = ch(Math.floor(xs[k] / CEL), Math.floor(zs[k] / CEL)); const l = mapa.get(kk); if (l) l.push(k); else mapa.set(kk, [k]); }
    const marca = new Uint8Array(n), mLado = new Uint8Array(n);
    for (let a = 0; a < n; a++) {
      const ci = Math.floor(xs[a] / CEL), cj = Math.floor(zs[a] / CEL), tx = -Math.sin(rs[a]), tz = Math.cos(rs[a]);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const l = mapa.get(ch(ci + di, cj + dj));
        if (!l) continue;
        for (const b of l) {
          if (b <= a || Math.abs(ys[b] - ys[a]) > 0.3) continue;
          const dx = xs[b] - xs[a], dz = zs[b] - zs[a];
          const ao = Math.abs(dx * tx + dz * tz), tr = Math.abs(dx * tz - dz * tx);
          if (ao < (ws[a] + ws[b]) / 2 - 0.005 && tr < CADEIRA.assento.fundo) { marca[a] = 1; marca[b] = 1; if (fila[a] === fila[b]) { mLado[a] = 1; mLado[b] = 1; } }
        }
      }
    }
    for (let k = 0; k < n; k++) { N.sobrepostas += marca[k]; N.sobrepostasLado += mLado[k]; }
  }
  // ---------------------------------------------------------------- cadeiras entre escadas e a largura da escada
  const exemploRun = (L, txt) => { if (L.runs.exemplos.length < 4) L.runs.exemplos.push(txt); };
  function registrarRun(L, len, ends, onde) {
    const nEsc = ends.filter(e => e === 'escada' || e === 'vomitorio').length;
    L.runs.n++;
    if (nEsc === 2) L.runs.max2 = Math.max(L.runs.max2, len);
    else if (nEsc === 1) L.runs.max1 = Math.max(L.runs.max1, len);
    else L.runs.max0 = Math.max(L.runs.max0, len);
    const lim = nEsc === 2 ? CADEIRA.entreEscadas : nEsc === 1 ? CADEIRA.entreEscadas / 2 : 0;
    if (len > lim) { L.runs.viol++; L.runs.cadViol += len; exemploRun(L, `${len} cadeiras entre ${ends.join(' e ')} (${onde})`); }
  }
  if (anel) {
    const cc = G.corredor;
    // o motivo de faltar a cadeira de índice i (a ponta, o túnel, a face, o vomitório) na metade (t, h) da fileira r
    const motivo = (tr, r, t, h, i) => {
      const u = t + h / 2 + (cc + ((i + 0.5) * (1 - cc)) / r.n) / 2;
      if (u < tr.u0 || u > tr.u1) return 'ponta';
      const th = tr.thDe(u, r.sAssento), [x, z] = P.ponto(th, r.sAssento), y = perfil(r.s0, th);
      if (z > 0 && Math.abs(x) < MT && y < TOPO_TUNEL) return 'tunel';
      if (geo.tipo === 'maracana') {
        if (r.faixa === 0 && r.iFaixa >= r.nFaixa - PL.VOM.fileiras) { const g = P.noGomo(th) * (360 / P.forma.corredores); if (g >= PL.VOM.g0 && g <= PL.VOM.g1) return 'vomitorio'; }
        return 'outro';
      }
      if (P.rB(th) - P.rF(th) < 2.5 || !P.temArquibancada(x, z)) return 'ponta';
      if (P.tipoEm(P.ladoEm(th), r.sAssento) !== 0) return 'face';
      return 'outro';
    };
    const fechado = tr => tr.k === undefined || tr.k === -1;
    // a escada no começo da metade (t, h) existe? (dentro do trecho; na volta fechada, sempre)
    const escadaEm = (tr, t, h) => { if (fechado(tr)) return true; const u = t + h / 2 + cc / 4; return u >= tr.u0 && u <= tr.u1; };
    for (const g of grupos.values()) {
      const tr = G.trechos[g.ti], r = G.fileiras[g.k], L = lado(g.setor, g.an);
      g.is.sort((a, b) => a - b);
      const onde = `lado ${LADO_NOME[g.setor]}, anel ${g.an}, fileira ${G.NF - g.k} de baixo`;
      let a0 = g.is[0];
      for (let j = 1; j <= g.is.length; j++) {
        if (j < g.is.length && g.is[j] === g.is[j - 1] + 1) continue;
        const ia = a0, ib = g.is[j - 1];
        const esq = ia === 0 ? (escadaEm(tr, g.t, g.h) ? 'escada' : 'ponta') : motivo(tr, r, g.t, g.h, ia - 1);
        const [tn, hn] = g.h === 0 ? [g.t, 1] : [g.t + 1, 0];
        const dir = ib === g.n - 1 ? (escadaEm(tr, tn, hn) ? 'escada' : 'ponta') : motivo(tr, r, g.t, g.h, ib + 1);
        registrarRun(L, ib - ia + 1, [esq, dir], onde);
        if (j < g.is.length) a0 = g.is[j];
      }
      // a largura da escada no começo desta metade, na fileira dela (só a que existe)
      if (escadaEm(tr, g.t, g.h)) {
        const ua = g.t + g.h / 2, ub = ua + cc / 2, s = r.sAssento;
        const [xa, za] = P.ponto(tr.thDe(ua, s), s), [xb, zb] = P.ponto(tr.thDe(ub, s), s);
        if (fechado(tr) || (ua >= tr.u0 && ub <= tr.u1)) L.escada.push(Math.hypot(xb - xa, zb - za));
      }
    }
  } else {
    const A = CD.ARQ_GOLACO, nA = G.nA;
    const escadaCel = a => a >= 0 && a < nA && a % A.corredor < 2;
    for (const g of grupos.values()) {
      const L = lado(g.setor, 0);
      g.as.sort((a, b) => a - b);
      const onde = `lado ${LADO_NOME[g.setor]}, fileira ${nFG - g.f} de baixo`;
      let a0 = g.as[0];
      for (let j = 1; j <= g.as.length; j++) {
        if (j < g.as.length && g.as[j] === g.as[j - 1] + 1) continue;
        const ia = a0, ib = g.as[j - 1];
        // o vizinho que falta: a ponta da arquibancada, a escada (a que cai no corte do túnel não existe) ou a boca do túnel
        const sobreTunel = a => g.setor === 3 && Math.abs(-A.meioComprimento + A.assento * (a + 0.5)) < MT && FL[nFG - 1 - g.f].y < TOPO_TUNEL;
        const fim = a => (a < 0 || a >= nA ? 'ponta' : sobreTunel(a) ? 'tunel' : escadaCel(a) ? 'escada' : 'ponta');
        registrarRun(L, ib - ia + 1, [fim(ia - 1), fim(ib + 1)], onde);
        if (j < g.as.length) a0 = g.as[j];
      }
      L.escada.push(2 * A.assento);
    }
  }
  // ---------------------------------------------------------------- a torcida: desenhados, escala, quem não tem cadeira
  const lugares = P ? P.lugares : null;
  const dados = TD.gerarTorcidaNiveis(null, null, lugares);
  const desenhados = [0, 0, 0], escala = [new Amostra(), new Amostra(), new Amostra()], acima125 = [0, 0, 0], abaixo09 = [0, 0, 0];
  const [e0, e1] = IMP.IMPOSTOR.escala;
  for (let i = 0; i < dados.n; i++) {
    const w = dados.pos[4 * i + 3];
    for (let q = dados.nivel[i]; q < 3; q++) { desenhados[q]++; escala[q].push(w); if (w > e1 + 1e-6) acima125[q]++; if (w < e0 - 1e-6) abaixo09[q]++; }
  }
  let semCadeira = 0, repetidas = 0;
  {
    const cel = (x, z) => (Math.floor(x * 2) + 4096) * 8192 + (Math.floor(z * 2) + 4096);
    const mapa = new Map();
    for (let k = 0; k < xs.length; k++) { const kk = cel(xs[k], zs[k]); const l = mapa.get(kk); if (l) l.push(k); else mapa.set(kk, [k]); }
    const dono = new Int32Array(xs.length).fill(-1);
    for (let i = 0; i < dados.n; i++) {
      const x = dados.pos[4 * i], y = dados.pos[4 * i + 1], z = dados.pos[4 * i + 2];
      let melhor = -1, dm = Infinity;
      for (const dx of [-0.07, 0, 0.07]) for (const dz of [-0.02, 0.02]) {
        const l = mapa.get(cel(x + dx, z + dz));
        if (!l) continue;
        for (const k of l) { const ex = Math.abs(xs[k] - x), ez = Math.abs(zs[k] - z), ey = Math.abs(ys[k] - y); if (ex <= 0.07 && ez <= 0.02 && ey <= 0.02 && ex + ez < dm) { dm = ex + ez; melhor = k; } }
      }
      if (melhor < 0) semCadeira++;
      else if (dono[melhor] >= 0) repetidas++;
      else dono[melhor] = i;
    }
  }
  // ---------------------------------------------------------------- o 3D de perto
  const perto = SEM_PERTO ? null : medirPerto(geo, G, dados);
  // ---------------------------------------------------------------- o resumo por lado/anel
  const lados = [...porLado.values()].sort((a, b) => a.setor - b.setor || a.anel - b.anel).map(L => ({
    setor: L.setor, lado: LADO_NOME[L.setor], anel: L.anel, fileiras: L.fileiras.size, cadeiras: L.cadeiras,
    larguraCadeira: L.larg.resumo(), profFileira: L.prof.resumo(), espelho: L.espelho.resumo(), caimento: L.caim.resumo(1), escada: L.escada.resumo(),
    cadeirasEmCanto: L.cantos, caimentoForaDosCantos: L.caimFora.resumo(1), profFileiraForaDosCantos: L.profFora.resumo(),
    acima34: L.acima34, acima34NosCantos: L.acima34Canto, fileiraRasaEncosto: L.rasaEncosto, fileiraRasaEncostoNosCantos: L.rasaEncostoCanto, fileiraAbaixo07: L.rasaMin, fileiraAbaixo07NosCantos: L.rasaMinCanto, fileiraAcima12: L.funda,
    entreEscadas: { maxDuasEscadas: L.runs.max2, maxUmaEscada: L.runs.max1, maxSemEscada: L.runs.max0, trechos: L.runs.n, violacoes: L.runs.viol, cadeirasEmViolacao: L.runs.cadViol, exemplos: L.runs.exemplos },
  }));
  return {
    tipo: geo.tipo, familia: geo.familia, cantos: P?.forma?.cantos ?? (geo.tipo === 'maracana' ? 'fechados' : 'abertos'),
    grade: { fileiras: anel ? G.NF : nFG, cadeiras: N.cadeiras, blocos: G.blocos.length, corredor: anel ? G.corredor : 2 / CD.ARQ_GOLACO.corredor },
    lados,
    torcida: {
      n: dados.n, desenhados, escala: escala.map(a => a.resumo()), acima125, abaixo09,
      semCadeira, repetidas, mosaicoSemMascara: true,
    },
    foraDoLugar: {
      foraDoDegrau: N.foraDoDegrau, degrauMaxM: r3(N.degrauMax), sobrepostas: N.sobrepostas, sobrepostasNaFileira: N.sobrepostasLado, naEscada: N.naEscada, espelhoAcima075: N.espelhoAlto,
      solidos: SEM_SOLIDOS ? null : N.solidos, noTuboDoArco: N.noArco,
      cobertura: { cadeirasCobertas: N.cobertas, cabecaNaCobertura: N.cobCabeca, folgaAbaixo05: N.cobBaixa, folgaMinM: Number.isFinite(N.cobFolgaMin) ? r2(N.cobFolgaMin) : null },
    },
    perto,
    ms: Math.round(performance.now() - t0),
    _grade: G, _P: P,
  };
}

// ------------------------------------------------------------------ as cores
const dE = (a, b) => (a && b ? IDT.deltaE(a, b) : Infinity);
/** A distribuição das cores das cadeiras 3D (cor → fração) e a comparação com os campos da base. */
function auditarCores(ent, geo, med) {
  const e = ent.e, G = med._grade, P = med._P;
  const conta = new Map();
  let fonte, padraoJogo, c1Jogo = null, c2Jogo = null, extra = {};
  if (geo.tipo === 'golaco') {
    let cores = null;
    if (e) {
      // a identidade da edição pro (identidade.js identidadeDoPedido: arquibancadaReal) com só este estádio na base
      const pedido = { edicao: 'pro', partida: {}, home: { name: e.clubes?.[0] ?? 'Mandante', stadium: e.nome, colors: { primary: '#22c55e', secondary: '#050807' } }, away: { name: 'Visitante', colors: { primary: '#e9ecee', secondary: '#15191b' } } };
      const ident = IDT.identidadeDoPedido(pedido, { versao: 1, estadios: { [IDT.normalizarNomeEstadio(e.nome)]: e } });
      if (ident.estadio?.real) cores = { ...ident.arquibancada, corCadeira: corCadeiraReal };
      extra = { estadioReal: !!ident.estadio?.real };
    }
    const pLado = CD.pintorGolaco({ comTexto: true, cores, mascara: null }), pSem = CD.pintorGolaco({ comTexto: false, cores });
    G.iterar(c => { const pc = (c.setor === 0 ? pLado : pSem)(c.f, c.a); const k = pc ? pc.cor : 'escada'; conta.set(k, (conta.get(k) ?? 0) + 1); });
    fonte = cores ? 'base (identidade.js arquibancadaReal + corCadeiraReal)' : 'padrão do Golaço';
    padraoJogo = cores ? cores.padrao : 'liso (padrão)';
    c1Jogo = cores ? cores.cadeira : '#14181a'; c2Jogo = cores ? cores.cadeira2 : null;
  } else {
    const pinta = geo.tipo === 'maracana' ? pintorMaracana(P) : pintorGenerico(P);
    G.iterar(c => { const k = pinta(c.k, c.h, c.i, c.n); conta.set(k, (conta.get(k) ?? 0) + 1); });
    fonte = geo.tipo === 'maracana' ? 'forma.cadeiras (tigela-maracana)' : 'forma.cad / forma.padrao';
    padraoJogo = geo.tipo === 'maracana' ? 'tigela-maracana' : P.forma.padrao;
    c1Jogo = P.forma.cadeiras[0]; c2Jogo = P.forma.cadeiras[1] ?? null;
  }
  const tot = [...conta.values()].reduce((s, v) => s + v, 0) || 1;
  const ordem = [...conta].sort((a, b) => b[1] - a[1]);
  const b1 = e ? IDT.corValida(e.cadeiras_cor) : null, b2 = e ? IDT.corValida(e.cadeiras_cor2) : null, bp = e ? e.cadeiras_padrao : null;
  const fr = alvo => (alvo ? ordem.reduce((s, [c, n]) => s + (c !== 'escada' && dE(c, alvo) < 10 ? n : 0), 0) / tot : null);
  const dominante = ordem.find(([c]) => c !== 'escada')?.[0] ?? null;
  const out = {
    fonte, padraoJogo, cor1Jogo: c1Jogo, cor2Jogo: c2Jogo,
    base: e ? { cor: e.cadeiras_cor ?? null, cor2: e.cadeiras_cor2 ?? null, padrao: bp ?? null } : null,
    principais: ordem.slice(0, 5).map(([c, n]) => [c, r3(n / tot)]),
    dominante, deltaDominanteBase: b1 ? r1(dE(dominante, b1)) : null,
    fracaoCor1Base: b1 ? r3(fr(b1)) : null, fracaoCor2Base: b2 ? r3(fr(b2)) : null,
    ...extra,
  };
  // as diferenças com a base: a 1ª cor, a 2ª cor (ausente no jogo, ausente na base, trocada), o padrão
  const dif = [];
  if (e) {
    if (b1 && dE(c1Jogo, b1) >= 10) dif.push(`1ª cor ${c1Jogo} × base ${b1} (ΔE ${fmtN(r1(dE(c1Jogo, b1)))})`);
    if (b1 && out.deltaDominanteBase >= 10) dif.push(`a cor que domina (${dominante}) longe da 1ª da base (ΔE ${fmtN(out.deltaDominanteBase)})`);
    if (b2 && (out.fracaoCor2Base ?? 0) < 0.02) {
      if (geo.tipo === 'golaco' && padraoJogo === 'mosaico') dif.push(`a 2ª cor da base (${b2}) só nas letras do mosaico do nome (máscara não medida aqui)`);
      else dif.push(`a 2ª cor da base (${b2}) não aparece (${fmtN(r1(100 * (out.fracaoCor2Base ?? 0)))}%; padrão ${String(padraoJogo).replace(/ \(.*\)$/, '')})`);
    }
    if (b2 && c2Jogo && dE(c2Jogo, b2) >= 10) dif.push(`2ª cor ${c2Jogo} × base ${b2} (ΔE ${fmtN(r1(dE(c2Jogo, b2)))})`);
    const pj = String(padraoJogo).replace(/ \(.*\)$/, '');
    if (bp && pj !== bp && !(geo.tipo === 'maracana')) dif.push(`padrão ${pj} × base ${bp}`);
  }
  out.diferencas = dif;
  return out;
}

// ------------------------------------------------------------------ um estádio inteiro
let _golaco = null;
function auditarEstadio(ent) {
  const t0 = performance.now();
  const e = ent.e;
  const geo = geometriaDe(e);
  let med;
  if (geo.tipo === 'golaco') med = _golaco ?? (_golaco = auditarGeometria(geo));
  else med = auditarGeometria(geo);
  const cores = auditarCores(ent, geo, med);
  const capReal = e ? Number(e.capacidade) || null : null;
  const capForma = geo.tipo === 'generica' ? geo.P.forma.capacidade : null;
  const cap = med.grade.cadeiras;
  const d = med.torcida.desenhados;
  const out = {
    chave: ent.chave, nome: e ? e.nome : 'Estádio Golaço (padrão: a edição pública, o jogo neutro e o fora da base)', cidade: e?.cidade ?? null, pais: e?.pais ?? null,
    clubes: e?.clubes ?? [], homonimo: ent.homonimo, confianca: e?.confianca ?? null,
    geometria: med.tipo, familia: med.familia, cantos: med.cantos,
    grade: med.grade,
    capacidade: {
      grade: cap, real: capReal, razao: capReal ? r3(cap / capReal) : null, forma: capForma,
      lugaresPorDesenhado: d.map(v => (capReal && v ? r2(capReal / v) : null)),
      cadeirasPorDesenhado: d.map(v => (v ? r2(cap / v) : null)),
    },
    lados: med.lados,
    torcida: med.torcida,
    cores,
    foraDoLugar: { ...med.foraDoLugar },
    perto: med.perto,
    ms: Math.round(performance.now() - t0),
    msGeometria: med.ms,
  };
  // o Estádio Golaço no jogo com a base dizendo "sem cobertura": as cadeiras debaixo da marquise de lá e do teto de cá
  if (med.tipo === 'golaco' && e) {
    const cob = e.cobertura ?? null;
    out.foraDoLugar.cobertura = { ...out.foraDoLugar.cobertura, base: cob, marquiseSemCoberturaNaBase: cob === 'nenhuma' ? med.foraDoLugar.cobertura.cadeirasCobertas : 0 };
  }
  return out;
}

// ------------------------------------------------------------------ o resumo (Markdown)
const FAMILIAS = [['golaco-padrao', 'Estádio Golaço (o padrão)'], ['golaco', 'Sem forma (a geometria do Golaço)'], ['maracana', 'Maracanã'], ['tigela', 'Tigela'], ['arena', 'Arena'], ['inglesa', 'Inglesa'], ['pista', 'Pista'], ['pequeno', 'Pequeno']];
const famDe = r => (r.chave === 'padrao' ? 'golaco-padrao' : r.familia);
const fmtN = v => (v == null || !Number.isFinite(v) ? '—' : Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const tab = linhas => linhas.map((l, i) => '| ' + l.join(' | ') + ' |' + (i === 0 ? '\n|' + l.map(() => ' --- |').join('') : '')).join('\n');
function maxLado(r, fn) { let m = -Infinity; for (const L of r.lados) m = Math.max(m, fn(L)); return m; }
function somaLado(r, fn) { let s = 0; for (const L of r.lados) s += fn(L); return s; }

function resumoMd(R, extra) {
  const d1 = v => fmtN(r1(v)), d2 = v => fmtN(r2(v));
  const L = [];
  const geom = R.filter(r => r.geometria !== 'golaco' || r.chave === 'padrao');
  L.push('# Auditoria das cadeiras e da torcida nos estádios (item 69, PR 4)', '');
  L.push(`Gerado por \`golaco/tools/auditar-cadeiras.mjs\` em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC: ${R.length} estádios (o padrão, ${R.filter(r => r.chave !== 'padrao' && !r.homonimo).length} da base e ${R.filter(r => r.homonimo).length} homônimo de outra cidade); ${R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao').length} sem forma usam a geometria do Golaço (as medidas de geometria são as do padrão; mudam só as cores e a capacidade real). Tempo: ${extra.segundos} s${extra.par > 1 ? ` (${extra.par} processos)` : ''}.`, '');
  L.push('Metas: cadeira ≥ 0,5 m (FIFA 2022; 0,46 mínima no Green Guide), fileira 0,8 m (0,7 mínima; a cadeira 3D pede ≥ 0,78 m), ≤ 28 cadeiras entre escadas (≤ 14 com escada de um lado só), escada 1,2 m (SGSA SG02), caimento ≤ 34° (Green Guide).', '');
  // ---------------------------------------------------------------- por família
  L.push('## Por família', '');
  const linhas = [['família', 'estádios', 'cadeiras (grade) p50', 'capacidade grade ÷ real p10/p50/p90', 'caimento máx p50/máx', 'estádios > 34° fora dos cantos / só nos cantos', 'fileira p5 (min) m', 'cadeiras em fileira < 0,7 m (Green Guide) p50/máx (fração nos cantos) · < 0,78 m p50', 'largura cadeira p5 (min) m', 'escada min/máx m', 'máx entre escadas (2 lados / 1 lado)', 'estádios com violação de escada']];
  for (const [f, nome] of FAMILIAS) {
    const rs = (f === 'golaco' ? R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao') : R.filter(r => famDe(r) === f));
    if (!rs.length) continue;
    const g = f === 'golaco' ? rs.slice(0, 1) : rs;   // a geometria do Golaço é uma só
    const caim = g.map(r => maxLado(r, l => l.caimento.max ?? -Infinity));
    const raz = rs.map(r => r.capacidade.razao).filter(Number.isFinite);
    const p5 = g.map(r => Math.min(...r.lados.map(l => l.profFileira.p5 ?? Infinity))), pmin = g.map(r => Math.min(...r.lados.map(l => l.profFileira.min ?? Infinity)));
    const l5 = g.map(r => Math.min(...r.lados.map(l => l.larguraCadeira.p5 ?? Infinity))), lmin = g.map(r => Math.min(...r.lados.map(l => l.larguraCadeira.min ?? Infinity)));
    const rasas = g.map(r => somaLado(r, l => l.fileiraAbaixo07) / Math.max(1, r.grade.cadeiras)), rasas78 = g.map(r => somaLado(r, l => l.fileiraRasaEncosto) / Math.max(1, r.grade.cadeiras));
    const rasasC = g.reduce((a, r) => a + somaLado(r, l => l.fileiraAbaixo07NosCantos), 0), rasasT = g.reduce((a, r) => a + somaLado(r, l => l.fileiraAbaixo07), 0);
    const fora34 = g.filter(r => r.lados.some(l => (l.caimentoForaDosCantos.max ?? 0) > 34.05)).length;
    const soCanto = g.filter(r => !r.lados.some(l => (l.caimentoForaDosCantos.max ?? 0) > 34.05) && somaLado(r, l => l.acima34NosCantos) > 0).length;
    const esc = g.flatMap(r => r.lados.map(l => [l.escada.min, l.escada.max])).filter(([a]) => Number.isFinite(a));
    const m2 = Math.max(...g.map(r => maxLado(r, l => l.entreEscadas.maxDuasEscadas))), m1 = Math.max(...g.map(r => maxLado(r, l => l.entreEscadas.maxUmaEscada)));
    const viol = g.filter(r => somaLado(r, l => l.entreEscadas.violacoes) > 0).length;
    linhas.push([nome, rs.length, fmtN(pct(g.map(r => r.grade.cadeiras), 0.5)),
      raz.length ? `${fmtN(r2(pct(raz, 0.1)))} / ${fmtN(r2(pct(raz, 0.5)))} / ${fmtN(r2(pct(raz, 0.9)))}` : '—',
      `${fmtN(r1(pct(caim, 0.5)))}° / ${fmtN(r1(Math.max(...caim)))}°`, `${fora34} / ${soCanto}${f === 'golaco' ? ' (geometria única)' : ''}`,
      `${fmtN(r2(pct(p5, 0.5)))} (${fmtN(r2(Math.min(...pmin)))})`, `${fmtN(r1(100 * pct(rasas, 0.5)))}% / ${fmtN(r1(100 * Math.max(...rasas)))}% (${fmtN(r1(100 * rasasC / Math.max(1, rasasT)))}%) · ${fmtN(r1(100 * pct(rasas78, 0.5)))}%`,
      `${fmtN(r2(pct(l5, 0.5)))} (${fmtN(r2(Math.min(...lmin)))})`,
      esc.length ? `${fmtN(r2(Math.min(...esc.map(x => x[0]))))} / ${fmtN(r2(Math.max(...esc.map(x => x[1]))))}` : '—',
      `${m2} / ${m1}`, f === 'golaco' ? `${viol} (geometria única)` : viol]);
  }
  L.push(tab(linhas), '');
  {
    const B = { 'de baixo': [], 'do meio': [], 'de cima': [], 'único': [] }, Pf = { 'de baixo': [], 'do meio': [], 'de cima': [], 'único': [] };
    for (const r of R.filter(x => x.geometria === 'generica')) {
      const por = {};
      for (const l of r.lados) (por[l.setor] ??= []).push(l);
      for (const ls of Object.values(por)) {
        ls.sort((a, b) => a.anel - b.anel);
        ls.forEach((l, i) => { if (!l.caimentoForaDosCantos.n) return; const k = ls.length === 1 ? 'único' : i === 0 ? 'de baixo' : i === ls.length - 1 ? 'de cima' : 'do meio'; B[k].push(l.caimentoForaDosCantos.p50); Pf[k].push(l.profFileiraForaDosCantos.p50); });
      }
    }
    L.push('Genéricas, FORA dos cantos (o perfil de cada lado): o caimento típico (p50 de cada lado × anel) e a fileira típica, pela posição do anel no lado:', '');
    L.push(tab([['anel', 'lados × anéis', 'caimento p10 / p50 / p90', 'acima de 34°', 'fileira p10 / p50 / p90 (m)'], ...Object.keys(B).map(k => [k, B[k].length, `${d1(pct(B[k], 0.1))}° / ${d1(pct(B[k], 0.5))}° / ${d1(pct(B[k], 0.9))}°`, B[k].filter(v => v > 34).length, `${d2(pct(Pf[k], 0.1))} / ${d2(pct(Pf[k], 0.5))} / ${d2(pct(Pf[k], 0.9))}`])]), '');
  }
  // ---------------------------------------------------------------- torcida
  L.push('## A torcida: quantos lugares cada torcedor desenhado vale e a escala', '');
  const lt = [['família', 'estádios', 'desenhados Baixa/Média/Alta p50', 'lugares reais por desenhado (Alta) p50 / máx', 'idem Média p50 / máx', 'escala máx (Alta) p50 / máx', 'estádios com torcedor > 1,25 (o limite do impostor)', 'torcedores > 1,25 (Alta) p50 / máx', 'torcedores sem cadeira', 'cadeira com 2 torcedores']];
  for (const [f, nome] of FAMILIAS) {
    const rs = (f === 'golaco' ? R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao') : R.filter(r => famDe(r) === f));
    if (!rs.length) continue;
    const d = q => pct(rs.map(r => r.torcida.desenhados[q]), 0.5);
    const lpd = q => rs.map(r => r.capacidade.lugaresPorDesenhado[q]).filter(Number.isFinite);
    const emax = rs.map(r => r.torcida.escala[2].max ?? 0), a125 = rs.map(r => r.torcida.acima125[2]);
    const fa = rs.map(r => r.torcida.acima125[2] / Math.max(1, r.torcida.desenhados[2]));
    lt.push([nome, rs.length, `${fmtN(d(0))} / ${fmtN(d(1))} / ${fmtN(d(2))}`,
      lpd(2).length ? `${fmtN(r2(pct(lpd(2), 0.5)))} / ${fmtN(r2(Math.max(...lpd(2))))}` : '—',
      lpd(1).length ? `${fmtN(r2(pct(lpd(1), 0.5)))} / ${fmtN(r2(Math.max(...lpd(1))))}` : '—',
      `${fmtN(r2(pct(emax, 0.5)))} / ${fmtN(r2(Math.max(...emax)))}`, `${rs.filter(r => r.torcida.acima125[2] > 0).length}`,
      `${fmtN(r1(100 * pct(fa, 0.5)))}% / ${fmtN(r1(100 * Math.max(...fa)))}% (${fmtN(Math.max(...a125))})`,
      fmtN(rs.reduce((s, r) => s + r.torcida.semCadeira, 0)), fmtN(rs.reduce((s, r) => s + r.torcida.repetidas, 0))]);
  }
  L.push(tab(lt), '');
  // ---------------------------------------------------------------- fora do lugar
  L.push('## Cadeiras fora do lugar', '');
  const lf = [['família', 'estádios', 'fora do degrau', 'sobrepostas (na mesma fileira)', 'em cima da escada', 'espelho > 0,75 m', 'debaixo da cobertura', 'cabeça de pé na cobertura', 'folga < 0,5 m', 'dentro de sólidos (sem a "arquibancada")', 'no tubo do arco']];
  for (const [f, nome] of FAMILIAS) {
    const rs = (f === 'golaco' ? R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao').slice(0, 1) : R.filter(r => famDe(r) === f));
    if (!rs.length) continue;
    const s = fn => fmtN(rs.reduce((a, r) => a + fn(r.foraDoLugar), 0));
    const sol = rs.reduce((a, r) => a + Object.entries(r.foraDoLugar.solidos ?? {}).filter(([k]) => !/: arquibancada$/.test(k)).reduce((b, [, v]) => b + v, 0), 0);
    lf.push([nome, f === 'golaco' ? '1 (geometria única)' : rs.length, s(x => x.foraDoDegrau), `${s(x => x.sobrepostas)} (${s(x => x.sobrepostasNaFileira)})`, s(x => x.naEscada), s(x => x.espelhoAcima075), s(x => x.cobertura.cadeirasCobertas), s(x => x.cobertura.cabecaNaCobertura), s(x => x.cobertura.folgaAbaixo05), fmtN(sol), s(x => x.noTuboDoArco ?? 0)]);
  }
  L.push(tab(lf), '');
  const solTodos = {};
  for (const r of geom) for (const [k, v] of Object.entries(r.foraDoLugar.solidos ?? {})) { const o = solTodos[k] ??= { n: 0, est: [] }; o.n += v; if (o.est.length < 6) o.est.push(`${r.chave} (${v})`); }
  if (Object.keys(solTodos).length) {
    L.push('Dentro de sólidos da planta (o `solido` do jogo com f = 0: a altura acima do piso da cadeira: o sólido — cadeiras, estádios). A "arquibancada" no assento é o perfil LISO dos sólidos da câmera acima do assento (só acontece com a fileira a mais de ~41°: um sintoma do caimento, não da cadeira); o "arco" dos sólidos tem 1 m de folga (o tubo de verdade está na coluna "no tubo do arco"):', '');
    for (const [k, o] of Object.entries(solTodos).sort((a, b) => b[1].n - a[1].n)) L.push(`- ${k} — ${fmtN(o.n)}: ${o.est.join(', ')}`);
    L.push('');
  }
  {
    const sf = R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao' && r.capacidade.real);
    const mais = sf.filter(r => r.capacidade.razao > 1.35).length, menos = sf.filter(r => r.capacidade.razao < 0.65).length, sub1 = sf.filter(r => (r.capacidade.lugaresPorDesenhado[2] ?? 9) < 1).length;
    L.push(`Sem forma (${sf.length}): a capacidade da base NÃO entra no desenho — o Golaço tem sempre ${fmtN(sf[0]?.capacidade.grade)} cadeiras e ${fmtN(sf[0]?.torcida.desenhados[2])} torcedores na Alta (vezes o público do TM). ${mais} têm a grade > 1,35 × a capacidade real (o menor: ${fmtN(Math.min(...sf.map(r => r.capacidade.real)))} lugares) e ${menos} < 0,65 ×; em ${sub1} a Alta desenha MAIS torcedores que os lugares reais do estádio.`, '');
  }
  const nada = R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao' && r.foraDoLugar.cobertura.base === 'nenhuma');
  if (nada.length) {
    const sf = R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao'), por = {};
    for (const r of sf) por[r.foraDoLugar.cobertura.base] = (por[r.foraDoLugar.cobertura.base] ?? 0) + 1;
    const cob = nada[0].foraDoLugar.cobertura.cadeirasCobertas, tot = nada[0].grade.cadeiras;
    L.push(`A cobertura do JOGO nos sem forma é sempre a do Golaço (a marquise de lá e o teto curto de cá: ${fmtN(cob)} de ${fmtN(tot)} cadeiras, ${d1(100 * cob / tot)}%); a base diz ${Object.entries(por).map(([k, v]) => `${k} ${v}`).join(', ')}. Com \`nenhuma\` (${nada.length} estádios) a marquise fica por cima de ${fmtN(cob)} cadeiras no jogo (só some no pré-jogo); com \`total\` ${d1(100 - 100 * cob / tot)}% das cadeiras ficam sem cobertura nas câmeras de perto do jogo (o anel de cobertura do pré-jogo não entra no jogo).`, '');
  }
  // ---------------------------------------------------------------- cores
  L.push('## Cores e padrão da cadeira 3D (= a textura) × a base', '');
  const lc = [['família', 'estádios', 'com alguma diferença', '1ª cor ≠ (ΔE ≥ 10)', 'a que domina ≠ a 1ª da base', '2ª cor da base que não aparece', '2ª cor ≠', 'padrão ≠']];
  for (const [f, nome] of FAMILIAS) {
    const rs = (f === 'golaco' ? R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao') : R.filter(r => famDe(r) === f));
    if (!rs.length || f === 'golaco-padrao') continue;
    const c = re => rs.filter(r => r.cores.diferencas.some(d => re.test(d))).length;
    lc.push([nome, rs.length, rs.filter(r => r.cores.diferencas.length).length, c(/^1ª cor/), c(/^a cor que domina/), c(/não aparece/), c(/^2ª cor/), c(/^padrão/)]);
  }
  L.push(tab(lc), '');
  // ---------------------------------------------------------------- perto
  if (R.some(r => r.perto)) {
    L.push('## O 3D de perto (o que o jogo QUER nas câmeras de perto; o resto do quadro só no navegador)', '');
    L.push('`restoMax` = o maior resto do quadro (jogadores, torcida, estádio) com que o desejo inteiro cabe no alvo (Média 127,5 mil, Alta 400 mil, menos a margem de 2 mil); o resto medido nas câmeras de perto do celular fica entre ~53 e ~112 mil (PESQUISA §15–§16).', '');
    const lp = [['família', 'estádios', 'Média: cadeiras 3D p50/máx', 'Média: torcedores 3D p50/máx', 'Média: pessoas na malha perto máx', 'Média: triângulos do desejo p50/máx', 'Média: restoMax mín', 'câmeras de perto dentro de um sólido', 'Alta: triângulos do desejo máx']];
    for (const [f, nome] of FAMILIAS) {
      const rs = (f === 'golaco' ? R.filter(r => r.geometria === 'golaco' && r.chave !== 'padrao').slice(0, 1) : R.filter(r => famDe(r) === f)).filter(r => r.perto);
      if (!rs.length) continue;
      const m = rs.flatMap(r => r.perto.media), a = rs.flatMap(r => r.perto.alta);
      const v = (l, k) => l.map(x => x[k]);
      lp.push([nome, f === 'golaco' ? '1 (geometria única)' : rs.length, `${fmtN(pct(v(m, 'cadeiras'), 0.5))} / ${fmtN(Math.max(...v(m, 'cadeiras')))}`, `${fmtN(pct(v(m, 'torcedores3d'), 0.5))} / ${fmtN(Math.max(...v(m, 'torcedores3d')))}`,
        fmtN(Math.max(...v(m, 'pessoasPerto'))), `${fmtN(pct(v(m, 'triDesejo'), 0.5))} / ${fmtN(Math.max(...v(m, 'triDesejo')))}`, fmtN(Math.min(...v(m, 'restoMax'))),
        fmtN(m.filter(x => x.cameraEmSolido).length) + ' de ' + m.length, fmtN(Math.max(...v(a, 'triDesejo')))]);
    }
    L.push(tab(lp), '');
  }
  // ---------------------------------------------------------------- piores casos
  L.push('## Piores casos', '');
  const top = (titulo, lista, fn, txt, n = 12, lim = -Infinity) => {
    const todos = lista.map(r => [r, fn(r)]).filter(([, v]) => Number.isFinite(v) && v > lim);
    const o = todos.sort((a, b) => b[1] - a[1]).slice(0, n);
    if (o.length) titulo += ` — ${todos.length} estádio${todos.length > 1 ? 's' : ''}`;
    if (!o.length) return;
    L.push(`### ${titulo}`, '');
    for (const [r, v] of o) L.push(`- **${r.chave}** (${r.familia}${r.cantos ? ', cantos ' + r.cantos : ''}): ${txt(r, v)}`);
    L.push('');
  };
  top('Caimento acima de 34° FORA dos cantos (o perfil do anel)', geom, r => maxLado(r, l => l.caimentoForaDosCantos.max ?? -Infinity), (r, v) => `máx ${d1(v)}° fora dos cantos; ${r.lados.filter(l => (l.caimentoForaDosCantos.max ?? 0) > 34.05).map(l => `${l.lado}/anel ${l.anel}: p50 ${fmtN(l.caimentoForaDosCantos.p50)}° p95 ${fmtN(l.caimentoForaDosCantos.p95)}° (${fmtN(l.acima34 - l.acima34NosCantos)} de ${fmtN(l.cadeiras)} acima)`).join('; ')}`, 12, 34.05);
  top('Caimento acima de 34° nos CANTOS/PONTAS em cunha (a profundidade radial < 85% da do lado)', geom, r => somaLado(r, l => l.acima34NosCantos), (r, v) => `${fmtN(v)} cadeiras; máx ${d1(maxLado(r, l => l.caimento.max ?? -Infinity))}°; ${r.lados.filter(l => l.acima34NosCantos).map(l => `${l.lado}/anel ${l.anel}: ${fmtN(l.acima34NosCantos)} de ${fmtN(l.cadeirasEmCanto)} no canto`).join('; ')}`, 12, 0);
  top('Fileira rasa para a cadeira 3D (< 0,78 m: o encosto entra no espelho de trás) FORA dos cantos', geom, r => somaLado(r, l => l.fileiraRasaEncosto - l.fileiraRasaEncostoNosCantos) / Math.max(1, r.grade.cadeiras), (r, v) => `${d1(100 * v)}% das cadeiras; ${r.lados.filter(l => (l.profFileiraForaDosCantos.p50 ?? 9) < 0.78).map(l => `${l.lado}/anel ${l.anel}: prof p50 ${fmtN(l.profFileiraForaDosCantos.p50)} m (p5 ${fmtN(l.profFileiraForaDosCantos.p5)})`).join('; ')}`, 12, 0);
  top('Fileira funda (> 1,2 m)', geom, r => somaLado(r, l => l.fileiraAcima12) / Math.max(1, r.grade.cadeiras), (r, v) => `${d1(100 * v)}% das cadeiras; ${r.lados.filter(l => l.fileiraAcima12).map(l => `${l.lado}/anel ${l.anel}: prof p95 ${fmtN(l.profFileira.p95)} m (máx ${fmtN(l.profFileira.max)})`).join('; ')}`, 12, 0);
  top('Cadeira estreita (< 0,46 m entre centros)', geom, r => -Math.min(...r.lados.map(l => l.larguraCadeira.min ?? Infinity)), (r, v) => `mín ${d2(-v)} m; ${r.lados.map(l => `${l.lado}/anel ${l.anel} p5 ${fmtN(l.larguraCadeira.p5)}`).join(', ')}`, 12, -0.46);
  top('Escada estreita (< 1,2 m)', geom, r => -Math.min(...r.lados.map(l => l.escada.min ?? Infinity)), (r, v) => `mín ${d2(-v)} m; ${r.lados.map(l => `${l.lado}/anel ${l.anel} ${fmtN(l.escada.min)}–${fmtN(l.escada.max)}`).join(', ')}`, 12, -1.2);
  top('Cadeiras entre escadas acima da meta', geom, r => somaLado(r, l => l.entreEscadas.cadeirasEmViolacao), (r, v) => `${fmtN(v)} cadeiras em ${somaLado(r, l => l.entreEscadas.violacoes)} trechos; ${r.lados.flatMap(l => l.entreEscadas.exemplos).slice(0, 3).join('; ')}`, 12, 0);
  top('Capacidade da grade longe da real (|razão − 1| > 35%)', R.filter(r => r.capacidade.razao), r => Math.abs(Math.log(r.capacidade.razao)), r => `${fmtN(r.capacidade.grade)} cadeiras × ${fmtN(r.capacidade.real)} reais (razão ${fmtN(r.capacidade.razao)}${r.geometria === 'golaco' ? ', geometria do Golaço' : ''})`, 15, Math.log(1.35));
  top('Lugares reais por torcedor desenhado (Alta)', R, r => r.capacidade.lugaresPorDesenhado[2] ?? NaN, (r, v) => `${d2(v)} na Alta, ${fmtN(r.capacidade.lugaresPorDesenhado[1])} na Média, ${fmtN(r.capacidade.lugaresPorDesenhado[0])} na Baixa (${fmtN(r.torcida.desenhados[2])} desenhados para ${fmtN(r.capacidade.real)} lugares)`, 12, 2);
  top('Torcedores acima da escala 1,25 do impostor (Alta)', geom, r => r.torcida.acima125[2] / Math.max(1, r.torcida.desenhados[2]), (r, v) => `${d1(100 * v)}% (${fmtN(r.torcida.acima125[2])}); escala máx ${fmtN(r.torcida.escala[2].max)}, p95 ${fmtN(r.torcida.escala[2].p95)}`, 12, 0);
  top('Sobrepostas (a cadeira 3D encosta na vizinha) / em cima da escada', geom, r => r.foraDoLugar.sobrepostas + r.foraDoLugar.naEscada, r => `${fmtN(r.foraDoLugar.sobrepostas)} sobrepostas (${fmtN(r.foraDoLugar.sobrepostasNaFileira)} lado a lado na mesma fileira, o resto com a fileira de trás/da frente), ${fmtN(r.foraDoLugar.naEscada)} com a borda na escada; fileira p5 ${fmtN(Math.min(...r.lados.map(l => l.profFileira.p5 ?? 9)))} m`, 12, 0);
  top('Espelho (degrau) acima de 0,75 m', geom, r => r.foraDoLugar.espelhoAcima075, (r, v) => `${fmtN(v)} cadeiras; ${r.lados.filter(l => l.espelho.max > 0.75).map(l => `${l.lado}/anel ${l.anel} espelho máx ${fmtN(l.espelho.max)} m`).join('; ')}`, 12, 0);
  top('Cabeça de pé na cobertura (ou a menos de 0,5 m)', geom, r => r.foraDoLugar.cobertura.cabecaNaCobertura + r.foraDoLugar.cobertura.folgaAbaixo05, r => `${fmtN(r.foraDoLugar.cobertura.cabecaNaCobertura)} na chapa, ${fmtN(r.foraDoLugar.cobertura.folgaAbaixo05)} com folga < 0,5 m (folga mín ${fmtN(r.foraDoLugar.cobertura.folgaMinM)} m) de ${fmtN(r.foraDoLugar.cobertura.cadeirasCobertas)} cobertas`, 12, 0);
  top('Cores: a cor que domina longe da 1ª cor da base', R.filter(r => r.cores.deltaDominanteBase != null), r => r.cores.deltaDominanteBase, r => `jogo ${r.cores.dominante} (${r.cores.fonte}) × base ${r.cores.base.cor} (ΔE ${fmtN(r.cores.deltaDominanteBase)}); ${r.cores.diferencas.join('; ')}`, 15, 10);
  if (R.some(r => r.perto)) top('3D de perto: o menor restoMax na Média', R.filter(r => r.perto && (r.geometria !== 'golaco' || r.chave === 'padrao')), r => -Math.min(...r.perto.media.map(x => x.restoMax)), r => { const w = r.perto.media.reduce((a, b) => (b.restoMax < a.restoMax ? b : a)); return `${w.cam}: ${fmtN(w.cadeiras)} cadeiras + ${fmtN(w.torcedores3d)} torcedores 3D + ${fmtN(w.pessoasPerto)} na malha perto = ${fmtN(w.triDesejo)} triângulos (restoMax ${fmtN(w.restoMax)})`; });
  if (extra.homonimos.length) {
    L.push('## Homônimos sem a forma', '');
    for (const h of extra.homonimos) L.push(`- **${h.chave}** (${h.cidade}): a base tem a forma, o homônimo da mesma cidade não — o jogo acha o homônimo pelo clube (identidade.js acharEstadio) e ${h.clubes.join(', ')} joga(m) na geometria do Golaço.`);
    L.push('');
  }
  // ---------------------------------------------------------------- distribuição
  L.push('## Distribuição (todos os estádios com geometria própria e o padrão)', '');
  const hist = (titulo, vals, cortes, un = '') => {
    const c = new Array(cortes.length + 1).fill(0);
    for (const v of vals) { let i = 0; while (i < cortes.length && v > cortes[i]) i++; c[i]++; }
    const rot = c.map((_, i) => (i === 0 ? `≤ ${cortes[0]}${un}` : i === cortes.length ? `> ${cortes[i - 1]}${un}` : `${cortes[i - 1]}–${cortes[i]}${un}`));
    L.push(`- ${titulo}: ${rot.map((r, i) => `${r}: ${c[i]}`).join(' · ')}`);
  };
  hist('caimento máximo', geom.map(r => maxLado(r, l => l.caimento.max ?? -Infinity)), [30, 34, 38, 45, 60], '°');
  hist('profundidade mínima da fileira (p5)', geom.map(r => Math.min(...r.lados.map(l => l.profFileira.p5 ?? Infinity))), [0.5, 0.7, 0.78, 0.9], ' m');
  hist('largura da cadeira (p5)', geom.map(r => Math.min(...r.lados.map(l => l.larguraCadeira.p5 ?? Infinity))), [0.4, 0.43, 0.46, 0.5], ' m');
  hist('capacidade grade ÷ real (todos com capacidade)', R.filter(r => r.capacidade.razao).map(r => r.capacidade.razao), [0.5, 0.65, 0.8, 1.2, 1.35, 2]);
  hist('lugares reais por desenhado na Alta', R.filter(r => r.capacidade.lugaresPorDesenhado[2]).map(r => r.capacidade.lugaresPorDesenhado[2]), [0.75, 1, 1.5, 2, 3, 4]);
  hist('escala máxima do torcedor (Alta)', geom.map(r => r.torcida.escala[2].max ?? 0), [1.06, 1.25, 1.35, 1.45]);
  L.push('');
  return L.join('\n');
}

// ------------------------------------------------------------------ principal
const ESTADIOS = listaEstadios().filter(x => !SO || SO.includes(x.chave));
async function rodarFatia(i, n) {
  const res = [];
  ESTADIOS.forEach((ent, k) => {
    if (k % n !== i) return;
    try {
      const r = auditarEstadio(ent);
      res.push(r);
    } catch (err) {
      res.push({ chave: ent.chave, erro: String(err && err.stack || err) });
    }
  });
  return res;
}

if (FATIA) {
  const [i, n] = FATIA.split('/').map(Number);
  const res = await rodarFatia(i, n);
  fs.writeFileSync(PARCIAL, JSON.stringify(res));
  process.exit(0);
}

const t0 = performance.now();
let R;
if (PAR > 1 && ESTADIOS.length > 1) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'auditar-cadeiras-'));
  const repassa = ['--js', pastaJs, ...(SO ? ['--so', SO.join(',')] : []), ...(SEM_SOLIDOS ? ['--sem-solidos'] : []), ...(SEM_PERTO ? ['--sem-perto'] : [])];
  const partes = await Promise.all(Array.from({ length: PAR }, (_, i) => new Promise((ok, falha) => {
    const arq = path.join(pasta, `parte-${i}.json`);
    const filho = fork(fileURLToPath(import.meta.url), [...repassa, '--fatia', `${i}/${PAR}`, '--parcial', arq], { stdio: 'inherit' });
    filho.on('exit', c => (c === 0 ? ok(JSON.parse(fs.readFileSync(arq, 'utf8'))) : falha(new Error(`a parte ${i} saiu com ${c}`))));
  })));
  R = partes.flat();
  fs.rmSync(pasta, { recursive: true, force: true });
} else {
  R = await rodarFatia(0, 1);
}
const ordem = new Map(ESTADIOS.map((e, k) => [e.chave, k]));
R.sort((a, b) => ordem.get(a.chave) - ordem.get(b.chave));
const erros = R.filter(r => r.erro);
R = R.filter(r => !r.erro);
const segundos = Math.round((performance.now() - t0) / 1000);
fs.mkdirSync(SAIDA, { recursive: true });
const homonimos = homonimosSemForma();
fs.writeFileSync(path.join(SAIDA, 'auditoria.json'), JSON.stringify({ gerado: new Date().toISOString(), segundos, homonimosSemForma: homonimos, erros, estadios: R }, null, 1));
fs.writeFileSync(path.join(SAIDA, 'auditoria.md'), resumoMd(R, { segundos, par: PAR, homonimos }) + (erros.length ? `\n## Erros\n\n${erros.map(e => `- ${e.chave}: ${e.erro.split('\n')[0]}`).join('\n')}\n` : ''));
console.log(`${R.length} estádios em ${segundos} s${erros.length ? `, ${erros.length} com erro: ${erros.map(e => e.chave).join(', ')}` : ''} → ${path.join(SAIDA, 'auditoria.json')} e auditoria.md`);
