// Forma PARAMÉTRICA do estádio (pura: sem three.js nem DOM). Pedido do dono (16/10), depois de ver o Maracanã do
// pré-jogo: "não tem nada a ver com o maracanã. imagino que outros estádios estejam assim tb" — até aqui todo estádio
// real tinha a MESMA forma (a caixa de cantos arredondados de estadio-forma.js) e só mudavam as cores e a textura.
// Este módulo descreve a forma de verdade e é a fonte única das contas que o desenho (render/estadio-real.js), a
// torcida (onde cada um senta), os sólidos da câmera (estadio-forma.js solidoEm delega para cá) e os trilhos do
// pré-jogo usam. SÓ DESENHO: nada aqui toca a simulação (as placas, os gols, o túnel e os bancos são os de config.js).
//
// 1ª família: TIGELA OVAL COM ANEL DE COBERTURA (o Maracanã desde a reforma de 2010–2013). Medidas reais (pesquisa
// de 16/10: SBP/ArchDaily, Structurae, OSM, Wikipédia; o referencial é o do jogo, origem no centro do campo, x no
// comprimento, z na largura, +z = lado de cá = Leste/Bellini):
//   - 1ª fileira: superelipse (a 73, b 44,5, n 5,5) — ~11 m da lateral (b = a frente do túnel, config.js), ~20 m atrás
//     dos gols e livre da quina das placas (≥ 1,5 m na diagonal);
//   - última fileira: elipse 136 × 118 a 25,5 m; anel inferior até 27% da profundidade (9,2 m), a faixa de camarotes
//     (vidro, até 12,6 m) e o anel superior em curva até o topo;
//   - cobertura: anel de 68 m de profundidade CONSTANTE (borda de fora elipse 148 × 129, a 29,2 m; o furo ~80 × 61),
//     60 eixos, a linha dos mastros a 46 m da borda (34,5 m) e a passarela técnica embaixo dela (21 m);
//   - fachada de 1950: 60 costelas em gancho na elipse 152 × 133 (cinta a 21 m, almofadas 21,5–26 m), 2 rampas
//     retas no meio dos lados compridos até os pórticos (r ≈ 247 m) e o entorno (Maracanãzinho, Bellini, trilhos,
//     Mangueira, maciço da Tijuca com o Cristo).
// Contas por ÂNGULO POLAR θ = atan2(z, x): cada fileira é a interpolação RADIAL entre a 1ª e a última (r = rF + s·(rB
// − rF)), então os corredores são radiais (os 60 vomitórios) e a conta inversa (ponto → fileira) é O(1) por tabela.
import { ESTADIO, CAMPO } from './config.js';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, p) => (Number.isFinite(Number(v)) ? Number(v) : p);

/** A forma padrão da família tigela (o Maracanã); o estadios.json pode trocar os números de cima. */
export const TIGELA_PADRAO = Object.freeze({
  familia: 'tigela',
  frente: { a: 73, b: ESTADIO.tunel.z, n: 5.5 },
  fundo: { a: 136, b: 118 },
  // perfil: y da mureta, fração e y do fim do anel inferior, camarote (degrau de vidro até yCam, laje até sCam), topo
  perfil: { y0: 1.8, sInf: 0.27, yInf: 9.2, sCam: 0.03, yCam: 12.6, yTopo: 25.5, curva: 1.25, parapeito: 1.2, laje: 25.3 },
  // lugares da torcida: fileiras (inferior, superior), passo na fileira (m) e escala do torcedor (o de cima vale ~2)
  fileiras: [24, 30], passo: [0.74, 1.05], escala: [1, 1.3],
  corredores: 60, corredorU: 0.08,
  cobertura: { a: 148, b: 129, prof: 68, yFora: 29.2, yMastro: 34.5, yDentro: 33, mastro: 46, yPassarela: 21, eixos: 60 },
  fachada: { a: 152, b: 133, cinta: 21, alto: 27.6, eixos: 60 },
  rampas: { larg: 30, zFim: 238, alto: 10.5, portico: { r: 247, larg: 66, alt: 14 } },
  letreiro: 'ESTÁDIO MÁRIO FILHO',
  cadeiras: ['#f2c230', '#1e5aa8', '#e9e9e4'],
  entorno: 'maracana',
});

// ------------------------------------------------------------------ superelipse em polar
/** Raio polar da superelipse (a, b, n) no ângulo θ. */
export function raioSuper(th, a, b, n = 2) {
  const c = Math.abs(Math.cos(th)) / a, s = Math.abs(Math.sin(th)) / b;
  // sem underflow (n alto): divide pelo maior
  const m = Math.max(c, s);
  if (m <= 0) return Math.max(a, b);
  return 1 / (m * Math.pow(Math.pow(c / m, n) + Math.pow(s / m, n), 1 / n));
}

/** Tabela de 3600 amostras (0,1°) de uma função de θ ∈ [−π, π), com leitura por interpolação. */
function tabela(fn) {
  const N = 3600, t = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) t[i] = fn(-Math.PI + (2 * Math.PI * i) / N);
  return th => {
    let u = ((th + Math.PI) / (2 * Math.PI)) * N;
    u = ((u % N) + N) % N;
    const i = Math.floor(u), w = u - i;
    return t[i] + (t[i + 1] - t[i]) * w;
  };
}

/** Validação da forma (estadios.json → números): devolve a forma completa ou null (sem família conhecida). */
export function validarForma(f) {
  if (!f || typeof f !== 'object' || (f.familia ?? 'tigela') !== 'tigela') return null;
  const P = TIGELA_PADRAO;
  const o = (k, sub) => ({ ...P[k], ...(f[k] && typeof f[k] === 'object' && !Array.isArray(f[k]) ? Object.fromEntries(Object.entries(f[k]).filter(([, v]) => Number.isFinite(Number(v)) || typeof v === 'object').map(([kk, v]) => [kk, typeof v === 'object' ? v : Number(v)])) : {}), ...(sub ?? {}) });
  const forma = {
    familia: 'tigela',
    frente: o('frente'), fundo: o('fundo'), perfil: o('perfil'),
    fileiras: P.fileiras, passo: P.passo, escala: P.escala, corredores: P.corredores, corredorU: P.corredorU,
    cobertura: o('cobertura'), fachada: o('fachada'), rampas: o('rampas'),
    letreiro: typeof f.letreiro === 'string' && f.letreiro.trim() ? f.letreiro.trim().slice(0, 40) : P.letreiro,
    cadeiras: Array.isArray(f.cadeiras) && f.cadeiras.length >= 2 && f.cadeiras.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? f.cadeiras.slice(0, 4) : P.cadeiras,
    entorno: f.entorno === 'maracana' ? 'maracana' : 'generico',
  };
  // a frente do lado de cá em x = 0 é a boca do túnel (config.js; a simulação e o cortejo dependem dele)
  forma.frente.b = ESTADIO.tunel.z;
  // a 1ª fileira contém a quina das placas com folga ≥ 1,5 m na diagonal (senão abre o n)
  const PX = CAMPO.meioX + CAMPO.entorno + 0.14, PZ = CAMPO.meioZ + CAMPO.entorno + 0.14;
  const thq = Math.atan2(PZ, PX), rq = Math.hypot(PX, PZ);
  for (let k = 0; k < 40 && raioSuper(thq, forma.frente.a, forma.frente.b, forma.frente.n) < rq + 1.5; k++) forma.frente.n += 0.25;
  forma.fundo.a = Math.max(forma.fundo.a, forma.frente.a + 30); forma.fundo.b = Math.max(forma.fundo.b, forma.frente.b + 30);
  return forma;
}

/**
 * A planta da tigela: tudo o que o desenho, a torcida, os sólidos e os trilhos precisam saber da forma.
 * forma: a de validarForma (ou o próprio objeto do estadios.json).
 */
export function criarPlanta(formaBruta) {
  const F = formaBruta && formaBruta.perfil && formaBruta.frente && formaBruta.fundo && formaBruta.cobertura ? formaBruta : validarForma(formaBruta ?? {});
  if (!F) return null;
  const Fr = F.frente, Fu = F.fundo, Pf = F.perfil, C = F.cobertura, Fa = F.fachada;
  const rF = tabela(th => raioSuper(th, Fr.a, Fr.b, Fr.n));
  const rB = tabela(th => raioSuper(th, Fu.a, Fu.b, 2));
  const rCobFora = tabela(th => raioSuper(th, C.a, C.b, 2));
  const rFach = tabela(th => raioSuper(th, Fa.a, Fa.b, 2));
  // borda de dentro da cobertura: a curva PARALELA da de fora a C.prof m (profundidade constante), em polar
  const rCobDentro = (() => {
    const M = 7200, th = new Float64Array(M), rr = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const t = (2 * Math.PI * i) / M, cx = C.a * Math.cos(t), cz = C.b * Math.sin(t);
      let nx = Math.cos(t) / C.a, nz = Math.sin(t) / C.b;
      const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      const x = cx - C.prof * nx, z = cz - C.prof * nz;
      th[i] = Math.atan2(z, x); rr[i] = Math.hypot(x, z);
    }
    const ord = Array.from({ length: M }, (_, i) => i).sort((p, q) => th[p] - th[q]);
    const ths = ord.map(i => th[i]), rs = ord.map(i => rr[i]);
    return tabela(a => {
      let lo = 0, hi = ths.length - 1;
      if (a <= ths[0] || a >= ths[hi]) { const w = (a - ths[hi] + 2 * Math.PI) % (2 * Math.PI) / ((ths[0] - ths[hi] + 2 * Math.PI) % (2 * Math.PI) || 1); return lerp(rs[hi], rs[0], clamp(w, 0, 1)); }
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ths[m] <= a) lo = m; else hi = m; }
      return lerp(rs[lo], rs[hi], (a - ths[lo]) / (ths[hi] - ths[lo] || 1));
    });
  })();

  // ---------------------------------------------------------------- perfil das cadeiras (s: 0 = 1ª fileira, 1 = última)
  const sC = Pf.sInf + Pf.sCam;
  const NUP = 6;
  /** Nós do perfil [s, y, v (textura)] na ordem — a malha e os lugares usam a MESMA interpolação linear. */
  const nos = [[0, Pf.y0, 0.04], [Pf.sInf, Pf.yInf, 0.36], [Pf.sInf + 0.002, Pf.yCam, 0.40], [sC, Pf.yCam, 0.42]];
  for (let k = 1; k <= NUP; k++) { const u = k / NUP; nos.push([sC + (1 - sC) * u, Pf.yCam + (Pf.yTopo - Pf.yCam) * Math.pow(u, Pf.curva), 0.42 + 0.55 * u]); }
  /** y do degrau na fração s da profundidade (linear entre os nós). */
  function perfil(s) {
    if (s <= 0) return Pf.y0;
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) { const [s0, y0] = nos[i - 1], [s1, y1] = nos[i]; return y0 + (y1 - y0) * (s - s0) / ((s1 - s0) || 1); }
    return Pf.yTopo;
  }
  /** v da textura das cadeiras em s (o mesmo mapa dos nós). */
  function vDe(s) {
    if (s <= 0) return nos[0][2];
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) { const [s0, , v0] = nos[i - 1], [s1, , v1] = nos[i]; return v0 + (v1 - v0) * (s - s0) / ((s1 - s0) || 1); }
    return nos[nos.length - 1][2];
  }
  /** Ponto (x, z) da fileira s no ângulo polar th. */
  function ponto(th, s) { const r = rF(th) + s * (rB(th) - rF(th)); return [r * Math.cos(th), r * Math.sin(th)]; }
  /** Fração da profundidade do ponto (x, z): < 0 antes da 1ª fileira, > 1 depois da última. */
  function sDe(x, z) { const th = Math.atan2(z, x), a = rF(th), b = rB(th); return (Math.hypot(x, z) - a) / (b - a); }
  // setores (os de torcida-dados.js): ψ normalizado pela 1ª fileira — a diagonal do canto em ±45°
  const psi = (x, z) => Math.atan2(z / Fr.b, x / Fr.a) / RAD;
  /** 0 lado de lá (z −), 1 fundo +x, 2 fundo −x, 3 lado de cá (z +). */
  function setor(x, z) { const p = psi(x, z); return p >= -135 && p <= -45 ? 0 : p > -45 && p < 45 ? 1 : p >= 45 && p <= 135 ? 3 : 2; }
  // ângulos polares das divisas dos setores (a malha corta ali: cada setor numa malha)
  const thDivisa = [Math.atan2(-Fr.b, Fr.a), Math.atan2(Fr.b, Fr.a), Math.atan2(Fr.b, -Fr.a), Math.atan2(-Fr.b, -Fr.a)];

  // ---------------------------------------------------------------- cobertura (u: 0 borda de fora → 1 borda de dentro)
  const uMastro = C.mastro / C.prof;
  const nosCob = [[0, C.yFora], [0.05, C.yFora + 0.7], [0.3, lerp(C.yFora, C.yMastro, 0.55)], [uMastro, C.yMastro], [lerp(uMastro, 1, 0.5), lerp(C.yMastro, C.yDentro, 0.4)], [1, C.yDentro]];
  function alturaCob(u) {
    for (let i = 1; i < nosCob.length; i++) if (u <= nosCob[i][0]) { const [u0, y0] = nosCob[i - 1], [u1, y1] = nosCob[i]; return y0 + (y1 - y0) * (u - u0) / ((u1 - u0) || 1); }
    return C.yDentro;
  }
  /** Ponto da cobertura no ângulo th e na fração u (de fora para dentro): [x, z, r]. */
  function pontoCob(th, u) { const r = rCobFora(th) - u * (rCobFora(th) - rCobDentro(th)); return [r * Math.cos(th), r * Math.sin(th), r]; }
  /** u da cobertura no ponto (x, z) (< 0 fora dela, > 1 no furo). */
  function uCob(x, z) { const th = Math.atan2(z, x), o = rCobFora(th), d = rCobDentro(th); return (o - Math.hypot(x, z)) / (o - d); }

  // ---------------------------------------------------------------- fachada (costelas em gancho)
  // perfil da costela [n (para fora da elipse da fachada), y]: vertical até 5 m, encurva para FORA até a cinta e o gancho
  // dobra para DENTRO até o anel de compressão (que fica 4 m para dentro, a 28 m)
  const COSTELA = [[0, 0], [0, 5], [0.55, 11], [1.35, 17], [1.9, Fa.cinta], [1.75, 23.2], [0.6, 25.6], [-1.6, 27.1], [-Fa.a + C.a - 0.3, 27.9]];
  /** Recuo da face de fora da fachada (n) na altura y (pela costela, só até a cinta). */
  function nFachada(y) {
    if (y >= Fa.cinta) return COSTELA[4][0];
    for (let i = 1; i <= 4; i++) if (y <= COSTELA[i][1]) { const [n0, y0] = COSTELA[i - 1], [n1, y1] = COSTELA[i]; return n0 + (n1 - n0) * (y - y0) / ((y1 - y0) || 1); }
    return COSTELA[4][0];
  }

  // ---------------------------------------------------------------- rampas e pórticos (x ≈ 0, nos dois lados compridos)
  const R = F.rampas;
  const zFach0 = Fa.b;                         // a fachada em x = 0
  /** y do tabuleiro da rampa em |z| (sobe para a fachada; null fora dela). */
  function yRampa(az) { if (az < zFach0 - 1 || az > R.zFim) return null; return R.alto * clamp((R.zFim - az) / (R.zFim - zFach0), 0, 1) + 0.6; }

  // ---------------------------------------------------------------- entorno (posições reais no referencial do jogo)
  const E = {
    maracanazinho: { x: -120, z: 181, r: 59, parede: 9, cupula: 19 },
    bellini: { x: 2, z: 280 },
    aquatico: { x: 97, z: 222 },
    // trilhos (SuperVia + metrô elevado): reta por (214, −129) na direção (0,515; 0,857)
    trilhos: { p: [214, -129], d: [0.515, 0.857], larg: 44 },
    mangueira: { x: 330, z: -900, r: 380, h: 95 },
    uerj: { x: -142, z: -441 },
    esplanada: 340,
  };
  // distância (com sinal) à reta dos trilhos
  const distTrilho = (x, z) => { const T = E.trilhos; return (x - T.p[0]) * T.d[1] - (z - T.p[1]) * T.d[0]; };

  // ---------------------------------------------------------------- lugares da torcida
  /**
   * Os lugares (um torcedor desenhado vale ~1 cadeira embaixo e ~2 em cima): {n, fileiras, iterar(cadeira)} no formato
   * de torcida-dados.js gerarTorcidaNiveis (cadeira(setor, f, a, x, y, z, escala, iMascara)). f = 0 é a fileira de cima;
   * corredores radiais (os mesmos da textura) e nada em cima da boca do túnel.
   */
  function gerarLugares() {
    const [nI, nS] = F.fileiras, NF = nI + nS;
    const lista = [];
    const M = 2880;   // amostras da fileira (0,125°)
    const T = ESTADIO.tunel, mt = T.largura / 2 + 0.4, topoTunel = T.altura + T.laje + 0.3;
    const passoCorr = 360 / F.corredores, largCorr = passoCorr * F.corredorU;
    for (let f = 0; f < NF; f++) {
      const j = NF - 1 - f;                                    // da frente (0) para cima
      const inf = j < nI;
      const s = inf ? ((j + 0.5) / nI) * Pf.sInf : sC + ((j - nI + 0.5) / nS) * (1 - sC);
      const y = perfil(s), passo = inf ? F.passo[0] : F.passo[1], esc = inf ? F.escala[0] : F.escala[1];
      // a fileira como polilinha; um lugar a cada `passo` m de arco
      let acum = passo * 0.5, px = 0, pz = 0, a = 0;
      for (let i = 0; i <= M; i++) {
        const th = -Math.PI + (2 * Math.PI * i) / M;
        const [x, z] = ponto(th, s);
        if (i > 0) acum += Math.hypot(x - px, z - pz);
        px = x; pz = z;
        if (acum < passo) continue;
        acum -= passo;
        // corredor (o da textura: os primeiros corredorU de cada fatia de 6°)
        const g = (((th / RAD) % passoCorr) + passoCorr) % passoCorr;
        if (g < largCorr + 0.15) continue;
        if (z > 0 && Math.abs(x) < mt && y < topoTunel) continue;
        const st = setor(x, z);
        // mosaico (a máscara de 250 × 36 do lado de lá): o anel de cima do lado de lá
        let im = -1;
        if (st === 0 && !inf) {
          const u = (psi(x, z) + 135) / 90, k = j - nI;
          im = Math.min(249, Math.max(0, Math.floor(u * 250))) + Math.min(35, Math.floor(((nS - 1 - k) * 36) / nS)) * 250;
        }
        lista.push(st, f, a++, x, y, z, esc, im);
      }
    }
    const n = lista.length / 8;
    return {
      n, fileiras: NF,
      iterar(cadeira) { for (let i = 0; i < lista.length; i += 8) cadeira(lista[i], lista[i + 1], lista[i + 2], lista[i + 3], lista[i + 4], lista[i + 5], lista[i + 6], lista[i + 7]); },
    };
  }
  let _lugares = null;

  // ---------------------------------------------------------------- sólidos (a câmera de cinema fica fora deles)
  const TELOES = [35, 145, -145, -35].map(g => {
    const th = g * RAD, [x, z, r] = pontoCob(th, 0.88);
    return { x, z, th, r, y: 25.5, larg: 11, alt: 6 };
  });
  /**
   * O ponto está dentro de algo sólido da forma (ou a menos de `f` m)? Nome ou null. `fora`: conta também a fachada,
   * as rampas e o entorno (o estádio do pré-jogo). `noTunel`: o corredor do túnel (livre).
   */
  function solido(x, y, z, f = 0.3, fora = true, noTunel = false) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const a = rF(th), b = rB(th);
    // tigela: cadeiras, parede de trás e a laje do anel de circulação até a fachada
    if (r >= a - f && r <= b + f && !noTunel) {
      const s = (r - a) / (b - a);
      if (y <= perfil(clamp(s, 0, 1)) + f) return z > 0 && Math.abs(x) < ESTADIO.tunel.largura / 2 + 0.4 + f && y < ESTADIO.tunel.altura + ESTADIO.tunel.laje + f ? 'túnel (paredes)' : 'arquibancada';
    }
    const rf = rFach(th);
    if (r > b - f && r <= rf + f && y <= Pf.laje + Pf.parapeito + f) return 'parede de trás';
    // cobertura (a membrana e a passarela) e os telões
    const o = rCobFora(th), d = rCobDentro(th), u = (o - r) / (o - d);
    if (u >= -0.03 && u <= 1.01) {
      const yc = alturaCob(clamp(u, 0, 1));
      if (Math.abs(y - yc) <= 1.0 + f || (y > yc && u < 0.02)) return 'cobertura';
      if (Math.abs(u - uMastro) * (o - d) <= 1.4 + f && y >= C.yPassarela - 0.6 - f && y <= C.yMastro + f) return 'passarela';
    }
    for (const t of TELOES) {
      const lx = (x - t.x) * -Math.sin(t.th) + (z - t.z) * Math.cos(t.th), lr = (x - t.x) * Math.cos(t.th) + (z - t.z) * Math.sin(t.th);
      if (Math.abs(lx) <= t.larg / 2 + f && Math.abs(lr) <= 1 + f && Math.abs(y - t.y) <= t.alt / 2 + f) return 'telão';
    }
    if (!fora) return null;
    // fachada (costelas e lajes; a casca entre a parede de trás e a face de fora)
    if (r > rf - 3 - f && r <= rf + nFachada(y) + 2.2 + f && y <= Fa.alto + 0.6 + f) return 'fachada';
    // rampas (o tabuleiro e o vão embaixo dele) e os pórticos
    const az = Math.abs(z), ax = Math.abs(x);
    const yr = yRampa(az);
    if (yr != null && ax <= R.larg / 2 + f && y <= yr + 1.3 + f) return 'rampa';
    const P = R.portico;
    if (Math.abs(r - P.r) <= 8 + f && ax <= P.larg / 2 + f && y <= P.alt + 1.2 + f) return 'pórtico';
    // entorno
    const Mz = E.maracanazinho, dm = Math.hypot(x - Mz.x, z - Mz.z);
    if (dm <= Mz.r + f) { const h = Mz.parede + Mz.cupula * Math.sqrt(Math.max(0, 1 - (dm / Mz.r) ** 2)); if (y <= h + f) return 'maracanãzinho'; }
    if (Math.hypot(x - E.bellini.x, z - E.bellini.z) <= 3.2 + f && y <= 11 + f) return 'bellini';
    if (r > E.esplanada - 40) {
      for (const p of predios()) {
        const c = Math.cos(-p.rumo), sn = Math.sin(-p.rumo);
        const lx = (x - p.x) * c - (z - p.z) * sn, lz = (x - p.x) * sn + (z - p.z) * c;
        if (Math.abs(lx) <= p.lx / 2 + f && Math.abs(lz) <= p.lz / 2 + f && y <= p.h + f) return 'prédio';
      }
    }
    for (const p of palmeiras()) if (Math.hypot(x - p.x, z - p.z) <= (y > p.h - 2 ? 3.2 : 0.5) + f && y <= p.h + 1 + f) return 'palmeira';
    return null;
  }

  /** A câmera está dentro do volume do lado de cá da tigela (a câmera de TV)? Aí o lado de cá sai do desenho. */
  function cameraNoLadoDeCa(p) {
    if (p.z <= 0 || p.y > C.yFora + 1) return false;
    const th = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
    return setor(p.x, p.z) === 3 && r > rF(th) - 1 && r < rB(th) + 4;
  }

  // ---------------------------------------------------------------- entorno (listas puras, com semente)
  const gerador = semente => { let s = semente >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const ESTAC = [{ x: [175, 300], z: [-150, -40] }, { x: [-310, -205], z: [-250, -110] }, { x: [170, 290], z: [60, 170] }];
  const noEstac = (x, z, m = 0) => ESTAC.some(e => x > e.x[0] - m && x < e.x[1] + m && z > e.z[0] - m && z < e.z[1] + m);
  const naRampa = (x, z, m = 0) => Math.abs(x) < R.larg / 2 + m && Math.abs(z) > zFach0 - 2 && Math.abs(z) < R.portico.r + 14 + m;
  let _predios = null, _palmeiras = null, _carros = null, _torcedores = null;
  /** Prédios da Tijuca e do entorno (caixas): de ~380 m a ~1,1 km, fora dos trilhos e do morro; os blocos da UERJ. */
  function predios() {
    if (_predios) return _predios;
    const r = gerador(20261016), lista = [];
    const Q = 64;
    for (let i = -18; i <= 18; i++) for (let k = -18; k <= 18; k++) {
      const cx = i * Q + 8, cz = k * Q - 6, d = Math.hypot(cx, cz);
      if (d < 385 || d > 1100) continue;
      if (Math.abs(distTrilho(cx, cz)) < 60) continue;
      if (Math.hypot(cx - E.mangueira.x, cz - E.mangueira.z) < E.mangueira.r + 30) continue;
      if (r() < 0.3) continue;
      const n = 1 + (r() < 0.45 ? 1 : 0);
      for (let m = 0; m < n; m++) {
        const lx = 16 + r() * 20, lz = 16 + r() * 20;
        const longe = clamp((d - 385) / 600, 0, 1);
        // a Tijuca (sul e oeste: z +, x −) tem prédios de 10–15 andares
        const tijuca = cz > 0 || cx < 0 ? 1 : 0.55;
        const h = (8 + r() * (16 + 30 * longe)) * tijuca + (r() < 0.05 ? 25 : 0);
        const ox = (n === 2 ? (m ? 1 : -1) * 13 : 0) + (r() - 0.5) * 6, oz = (r() - 0.5) * 6;
        lista.push({ x: cx + ox, z: cz + oz, lx: n === 2 ? Math.min(lx, 24) : lx, lz, h, rumo: (r() - 0.5) * 0.12 });
      }
    }
    // UERJ: os blocos modernistas altos
    for (const [dx, dz, lx, lz, h] of [[0, 0, 110, 26, 46], [-30, 60, 26, 70, 22], [60, 55, 40, 40, 18], [-80, -20, 30, 50, 30]]) lista.push({ x: E.uerj.x + dx, z: E.uerj.z + dz, lx, lz, h, rumo: 0.52 });
    _predios = lista;
    return lista;
  }
  /** Palmeiras-imperiais na esplanada (em fileiras pelas praças e caminhos): [{x, z, h}]. */
  function palmeiras() {
    if (_palmeiras) return _palmeiras;
    const r = gerador(20261017), lista = [];
    const livre = (x, z) => {
      const th = Math.atan2(z, x), rr = Math.hypot(x, z);
      if (rr < rFach(th) + 12) return false;
      if (naRampa(x, z, 6) || noEstac(x, z, 4)) return false;
      if (Math.hypot(x - E.maracanazinho.x, z - E.maracanazinho.z) < E.maracanazinho.r + 8) return false;
      if (Math.hypot(x - E.aquatico.x, z - E.aquatico.z) < 34) return false;
      if (Math.abs(distTrilho(x, z)) < E.trilhos.larg) return false;
      return Math.abs(x) < E.esplanada - 8 && Math.abs(z) < E.esplanada - 8;
    };
    // a praça do Bellini (o eixo da rampa de cá) e a avenida das palmeiras
    for (let z = 262; z < 336; z += 12) for (const x of [-24, 24]) if (livre(x, z)) lista.push({ x: x + (r() - 0.5), z, h: 17 + r() * 6 });
    // anel em volta da fachada (a ~22 m dela), uma a cada ~16 m
    for (let g = 0; g < 360; g += 3.1) {
      const th = g * RAD, rr = rFach(th) + 22 + r() * 6;
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (livre(x, z) && r() < 0.75) lista.push({ x, z, h: 15 + r() * 8 });
    }
    // bosques soltos
    for (let i = 0; i < 70; i++) {
      const x = (r() - 0.5) * 2 * (E.esplanada - 12), z = (r() - 0.5) * 2 * (E.esplanada - 12);
      if (livre(x, z) && Math.hypot(x, z) > 230) lista.push({ x, z, h: 13 + r() * 9 });
    }
    _palmeiras = lista;
    return lista;
  }
  /** Carros nos estacionamentos: [{x, z, rumo, cor}]. */
  function carros() {
    if (_carros) return _carros;
    const r = gerador(20261018), lista = [];
    for (const e of ESTAC) for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) for (let x = e.x[0] + 2; x < e.x[1] - 2; x += 2.7) {
      if (r() < 0.55) continue;
      lista.push({ x, z: z + (r() - 0.5) * 0.3, rumo: Math.PI / 2 + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.08, cor: Math.floor(r() * 8) });
    }
    _carros = lista;
    return lista;
  }
  /** Torcedores chegando: nas duas rampas (em cima do tabuleiro), nos pórticos e pela esplanada: [{x, y, z, time}]. */
  function torcedoresFora() {
    if (_torcedores) return _torcedores;
    const r = gerador(20261019), lista = [];
    for (const lado of [1, -1]) {
      for (let i = 0; i < 420; i++) {
        const az = zFach0 + 3 + Math.pow(r(), 0.9) * (R.zFim - zFach0 - 6);
        const x = (r() - 0.5) * (R.larg - 4);
        if (Math.abs(x) < 2.2) continue;                     // o vão entre as duas pistas
        lista.push({ x, y: yRampa(az), z: lado * az, time: lado < 0 && r() < 0.5 ? 1 : (r() < 0.06 ? 1 : 0) });
      }
      // a praça na frente do pórtico
      for (let i = 0; i < 160; i++) {
        const az = R.portico.r + 8 + r() * 40, x = (r() - 0.5) * (40 + az - R.portico.r);
        lista.push({ x, y: 0.06, z: lado * az, time: lado < 0 && r() < 0.5 ? 1 : 0 });
      }
    }
    // em volta da fachada (os acessos)
    for (let i = 0; i < 380; i++) {
      const th = r() * 2 * Math.PI, rr = rFach(th) + 5 + r() * 18;
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (naRampa(x, z, 1) || noEstac(x, z, 2)) continue;
      lista.push({ x, y: 0.06, z, time: x < -80 ? (r() < 0.6 ? 1 : 0) : (r() < 0.05 ? 1 : 0) });
    }
    _torcedores = lista;
    return lista;
  }

  // ---------------------------------------------------------------- festa (faixas, bandeiras, bandeirões, sinalizadores)
  /** Ponto no degrau: ângulo polar th e d m da 1ª fileira para dentro → {x, y, z, nx, nz (para o campo), ex, ez}. */
  function noDegrau(th, d) {
    const a = rF(th), b = rB(th), s = d / (b - a);
    const [x, z] = ponto(th, s);
    const nx = -Math.cos(th), nz = -Math.sin(th);
    return { x, y: perfil(s), z, nx, nz, ex: -nz, ez: nx, s };
  }
  /** O ângulo polar da 1ª fileira com esta coordenada x no lado de lá (z < 0). */
  function thLadoDeLa(x) { let lo = -Math.PI + 0.01, hi = -0.01; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rF(m) * Math.cos(m) > x) hi = m; else lo = m; } return (lo + hi) / 2; }
  /** O ângulo polar da 1ª fileira com esta coordenada z no fundo (s = +1 → x > 0). */
  function thFundo(sx, z) { let lo = -Math.PI / 2 + 0.01, hi = Math.PI / 2 - 0.01; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rF(m) * Math.sin(m) < z) lo = m; else hi = m; } const t = (lo + hi) / 2; return sx > 0 ? t : Math.PI - t; }
  /** Faixas na mureta: as mesmas 12 (textos e ordem de bandeiras-dados.js), nos trechos retos da 1ª fileira. */
  function faixas(lista) {
    // as do lado de lá lado a lado, na ordem de antes, 10% mais curtas, no trecho quase reto da mureta (|x| ≲ 48 m)
    const la = lista.map((f, i) => ({ f, i })).filter(o => o.f.setor === 0).sort((p, q2) => p.f.centro - q2.f.centro);
    const KL = 0.9, VAO = 1.2, centros = new Map();
    let x = -(la.reduce((s2, o) => s2 + o.f.larg * KL, 0) + VAO * (la.length - 1)) / 2;
    for (const o of la) { const l = o.f.larg * KL; centros.set(o.i, [x + l / 2, l]); x += l + VAO; }
    const zF = xx => { const th = thLadoDeLa(xx); return rF(th) * Math.sin(th); };
    return lista.map((f, i) => {
      if (f.setor === 0) {
        const [c, l] = centros.get(i);
        return { ...f, centro: c, larg: l, z: Math.max(zF(c), zF(c - l / 2), zF(c + l / 2)) };
      }
      const s = f.setor === 1 ? 1 : -1;
      return { ...f, x: s * Math.min(rF(thFundo(s, f.centro - f.larg / 2)) * Math.abs(Math.cos(thFundo(s, f.centro - f.larg / 2))), rF(thFundo(s, f.centro + f.larg / 2)) * Math.abs(Math.cos(thFundo(s, f.centro + f.larg / 2)))) };
    });
  }
  /** Bandeiras de mastro: a mão do torcedor nas fileiras da frente do lado de lá e da organizada (fundo +x). */
  function bandeiras(n, mao) {
    const r = gerador(20261012), lista = [];
    const longe = (x, z) => lista.every(b => Math.hypot(b.x - x, b.z - z) >= 4);
    for (let t = 0; lista.length < n && t < 5000; t++) {
      const org = r() < 0.3;
      const d = (org ? 1 + Math.floor(r() * 7) : Math.floor(r() * 6)) * 0.8 + 0.4;
      const th = org ? thFundo(1, -16 + 32 * r()) : thLadoDeLa(-55 + 110 * r());
      const p = noDegrau(th, d);
      if (!longe(p.x, p.z)) continue;
      lista.push({ x: p.x, y: p.y + mao, z: p.z, ex: p.ex, ez: p.ez, nx: p.nx, nz: p.nz, desenho: Math.floor(r() * 4) % 4, fase: r() * 2 * Math.PI, org });
    }
    return lista;
  }
  /** Bandeirões (o do lado de lá e o da organizada) pela rampa do anel de baixo, no formato de bandeiras-dados.js. */
  function bandeiroes(altura) {
    const out = [];
    const rampa = (th, prof, larg, nome, slot, eixoU) => {
      const p0 = noDegrau(th, 0.4), p1 = noDegrau(th, 0.4 + prof);
      const V = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], L = Math.hypot(...V);
      const Vn = V.map(v => v / L);
      // N: perpendicular a V e a U, para cima
      const U = eixoU;
      let N = [U[1] * Vn[2] - U[2] * Vn[1], U[2] * Vn[0] - U[0] * Vn[2], U[0] * Vn[1] - U[1] * Vn[0]];
      if (N[1] < 0) N = N.map(v => -v);
      const ln = Math.hypot(...N); N = N.map(v => v / ln);
      const A = [p0.x - U[0] * larg / 2, p0.y, p0.z - U[2] * larg / 2].map((v, i) => v + N[i] * altura);
      out.push({ nome, A, U: U.map(v => v * larg), V: Vn.map(v => v * prof), N, larg, prof, slot });
    };
    rampa(-Math.PI / 2, 10, 40, 'lado', 0, [1, 0, 0]);
    rampa(0, 14, 24, 'organizada', 1, [0, 0, 1]);
    return out;
  }
  /** Os pontos dos sinalizadores (a base do torcedor): organizada, quinas do lado de lá e setor visitante. */
  function sinalizadores() {
    const org = [[-12, 2.6], [-4, 3.4], [5, 2.0], [13, 4.0], [-16.5, 3.0], [9, 3.6]].map(([z, d]) => noDegrau(thFundo(1, z), d));
    const quinas = [[-47, 2.6], [48, 3.2], [-36, 2.0], [37, 2.8], [-55, 3.6], [56, 2.6]].map(([x, d]) => noDegrau(thLadoDeLa(x), d));
    const visit = [[-8, 2.6], [6, 3.2]].map(([z, d]) => noDegrau(thFundo(-1, z), d));
    const xyz = p => [p.x, p.y, p.z];
    return { organizada: org.map(xyz), quinas: quinas.map(xyz), visitante: visit.map(xyz) };
  }

  // ---------------------------------------------------------------- pré-jogo: os planos que dependem do estádio
  const K = Math.max(Fa.a, Fa.b) / 93;      // ~1,6: quanto maior que o Estádio Golaço
  const PLANOS = {
    // o drone do lado de lá (NE) olhando para o Maracanãzinho e o maciço da Tijuca ao fundo (como as aéreas de referência)
    aereo: { orbita: { centro: [0, 0], olhar: [-30, 24, 40], raio: [430, 340], altura: [175, 132], ang: [-80, -54], fov: 42 } },
    // a grua na praça do pórtico da rampa de lá (UERJ): o letreiro e, subindo por cima do pórtico, a rampa e a fachada
    // (as costelas em gancho e o colar de almofadas no quadro final)
    fachada: { cam: { de: [[-30, 2.2, -300], [-18, 12, -282], [-8, 26, -259]], para: [[0, 6.5, -250], [0, 11, -200], [0, 12, -160]], fov: [44, 40], suave: 0.7 } },
    dentro: { cam: { de: [[-46, 20, 62], [-32, 20.5, 61], [-18, 21, 60]], para: [[-8, 3, -30], [0, 3, -30], [8, 3, -30]], fov: [50, 48], suave: 0.5 } },
    organizada: { cam: { de: [[48, 3.0, -20], [48, 3.4, -15]], para: [[84, 6.2, -3], [84, 6.6, 2]], fov: [40, 40], suave: 0.3 } },
    ladoDeLa: { cam: { de: [[-6, 2.2, -34], [2, 2.2, -34]], para: [[-12, 6.5, -55], [4, 6.5, -55]], fov: [30, 30], suave: 0.2 } },
    visitantes: { cam: { de: [[-48, 2.5, 18], [-48, 2.8, 14]], para: [[-84, 6, 0], [-84, 6, -4]], fov: [40, 40], suave: 0.3 } },
    geral: { cam: { de: [[-8, 23, 60], [8, 23, 60]], para: [[0, 0, -16], [0, 0, -16]], fov: [56, 56], suave: 0.3 } },
  };
  /** Troca, no lugar, a câmera dos planos que dependem do estádio (prejogo-roteiro.js criarRoteiro chama antes das curvas). */
  function ajustarPlano(p) {
    const q = PLANOS[p.id];
    if (q && q.cam) p.cam = { ...p.cam, ...q.cam };
    if (q && q.orbita) p.orbita = { ...q.orbita };
    // a das escalações: o MESMO objeto nas duas (o mesmo fundo)
    if (p.orbitaComum) p.orbita = orbitaEsc ?? (orbitaEsc = { ...p.orbita, raio: [52, 52], altura: [20, 20] });
  }
  let orbitaEsc = null;
  /** A câmera da abertura ("Toque para começar"), mais longe e mais alta na mesma proporção do estádio. */
  function ajustarAbertura(c) { c.px *= 1.42; c.pz *= 1.42; c.py *= 1.3; c.ly = 6; return c; }

  return {
    forma: F, familia: 'tigela',
    rF, rB, rCobFora, rCobDentro, rFach, ponto, sDe, perfil, vDe, nos, sC, setor, psi, thDivisa,
    nosCob, alturaCob, pontoCob, uCob, uMastro, COSTELA, nFachada, yRampa, entorno: E, distTrilho, estacionamentos: ESTAC, TELOES,
    get lugares() { return _lugares ?? (_lugares = gerarLugares()); },
    solido, cameraNoLadoDeCa, noDegrau,
    predios, palmeiras, carros, torcedoresFora,
    faixas, bandeiras, bandeiroes, sinalizadores,
    ajustarPlano, ajustarAbertura, escala: K, planos: PLANOS,
    // o plano geral do intervalo e do fim (camera.js CAMERA_GERAL): debaixo da borda da cobertura, olhando o campo
    cameraGeral: { de: [0, 27, 58], para: [0, 3, -16], fov: 40 },
  };
}
