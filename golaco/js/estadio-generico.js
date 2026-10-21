// Forma PARAMÉTRICA GENÉRICA do estádio (pura: sem three.js nem DOM). Pedido do dono (21/10), depois do Maracanã:
// "quero isso com todos os estádios do jogo, ele pesquisou o estádio, olhou direitinho e fez detalhes certinho". O
// Maracanã tem a planta dele (estadio-planta.js, a tigela de 1950 com as costelas, as rampas e o entorno do Rio); os
// outros estádios da base (assets/tm/estadios.json, pesquisa em tools/estadios/) saem DESTA planta, que descreve as
// famílias de estádio de verdade pelos números da pesquisa:
//   - tigela: a bacia oval contínua (Mineirão, Morumbi, Camp Nou);
//   - inglesa: 4 arquibancadas retas, coladas no campo, de cantos abertos (Anfield, Vila Belmiro, São Januário);
//   - arena: retangular de cantos fechados com a cobertura sobre todas (Allianz Arena, Allianz Parque, Neo Química);
//   - pista: com a pista de atletismo entre o campo e a torcida (Olímpico de Berlim, Engenhão);
//   - pequeno: 1 ou 2 arquibancadas, quase sem cobertura.
// Cada lado tem a SUA arquibancada (profundidade, altura, anéis, cobertura, camarotes): la = a do lado de lá (z −, a
// oposta à tribuna, a que a câmera de TV vê), ca = a do lado de cá (z +, a principal: os bancos e o túnel), fa = o
// fundo +x e fb = o fundo −x. As contas são por ÂNGULO POLAR θ = atan2(z, x), como as do Maracanã: a 1ª fileira e a
// última são curvas fechadas (superelipse de semi-eixos por quadrante; a pista é a curva de atletismo, duas retas e dois
// semicírculos) e a fileira s é a interpolação RADIAL entre elas (r = rF + s·(rB − rF)). A altura do degrau é a do
// perfil de cada lado, misturada nos cantos; nos cantos ABERTOS cada arquibancada termina numa reta (|x| ≤ X nos lados,
// |z| ≤ Z nos fundos) e o canto fica vazio. SÓ DESENHO: nada aqui toca a simulação (placas, gols, túnel e bancos são
// os de config.js; a frente do lado de cá em x = 0 é a boca do túnel).
// A mesma interface de estadio-planta.js criarPlanta (render/estadio-generico.js desenha; estadio-forma.js solidoEm,
// render/torcida-dados.js, render/bandeiras-dados.js e prejogo-roteiro.js usam): lugares, solido, cameraNoLadoDeCa,
// faixas, bandeiras, bandeiroes, sinalizadores, ajustarPlano, ajustarAbertura, cameraGeral.
import { ESTADIO, CAMPO } from './config.js';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, p) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : p);
const suave = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const corOk = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);

export const FAMILIAS = Object.freeze(['tigela', 'inglesa', 'arena', 'pista', 'pequeno']);
export const LADOS = Object.freeze(['la', 'fa', 'fb', 'ca']);          // o índice é o setor (0 lá, 1 fundo +x, 2 fundo −x, 3 cá)
const COBERTURAS = ['anel', 'por_arquibancada', 'total', 'retratil', 'parcial', 'nenhuma'];
const SUSTENTA = ['trelica', 'mastros', 'cabos', 'balanco', 'arco', 'pilares', 'anel_compressao', 'nenhuma'];
const MATERIAIS = ['membrana', 'metal', 'policarbonato', 'vidro', 'concreto', 'misto', 'nenhum'];
const ESTILOS = ['vidro', 'concreto', 'metal', 'membrana', 'tijolo', 'trelica', 'paineis'];
const PADROES = ['liso', 'misto', 'faixas', 'mosaico'];
const ENTORNOS = ['urbano_denso', 'residencial', 'parque', 'industrial', 'campo_aberto', 'orla', 'campus'];
const MARCAS = ['arco', 'torres', 'torres_luz', 'rampas_espiral', 'mastros', 'telao', 'letreiro', 'relogio', 'estatua', 'cupula', 'pele_led', 'outro'];

// a pista de atletismo oficial (World Athletics: 400 m, raio de dentro 36,5 m, 8 raias de 1,22 m; as retas de 84,39 m)
export const PISTA = Object.freeze({ meiaReta: 42.195, raio: 36.5, raias: 8, raia: 1.22 });

/** Por família: a 1ª fileira (m acima do gramado), o expoente da planta, os cantos e o recuo [lateral, fundo] padrão. */
const PADRAO_FAMILIA = {
  tigela: { y0: 1.8, n: 2.6, cantos: 'fechados', recuo: [12, 18], cob: 'anel' },
  inglesa: { y0: 1.1, n: 12, cantos: 'abertos', recuo: [7.8, 8.5], cob: 'por_arquibancada' },
  arena: { y0: 1.4, n: 6, cantos: 'fechados', recuo: [8.5, 10], cob: 'total' },
  pista: { y0: 2.4, n: 2.2, cantos: 'fechados', recuo: [0, 0], cob: 'parcial' },
  pequeno: { y0: 0.9, n: 12, cantos: 'abertos', recuo: [8, 10], cob: 'parcial' },
};
const N_PLANTA = { oval: 2.5, retangular: 12, retangular_cantos_curvos: 5, cantos: 5, ferradura: 2.8, irregular: 4 };

// ------------------------------------------------------------------ curvas em polar
/** Raio polar da superelipse de semi-eixos a (em x) e b (em z) no ângulo θ (expoente n). */
export function raioSuper(th, a, b, n = 2) {
  const c = Math.abs(Math.cos(th)) / a, s = Math.abs(Math.sin(th)) / b;
  const m = Math.max(c, s);
  if (m <= 0) return Math.max(a, b);
  return 1 / (m * Math.pow(Math.pow(c / m, n) + Math.pow(s / m, n), 1 / n));
}
/** Raio polar da curva de atletismo (duas retas em |z| = R de |x| ≤ L e dois semicírculos de raio R em x = ±L). */
export function raioPista(th, L, R) {
  const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  if (s > 1e-9) { const t = R / s; if (t * c <= L) return t; }
  return L * c + Math.sqrt(Math.max(0, L * L * c * c - L * L + R * R));
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
const h2 = (a, b) => { let t = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
export const gerador = semente => { let s = semente >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hashTexto = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ------------------------------------------------------------------ validação (estadios.json → números)
/**
 * A forma genérica do estadios.json ({familia, planta, cantos, recuo: [lateral, fundo], lados: {la|fa|fb|ca: [prof, alto,
 * anéis, coberta, camarotes]}, cob: {tipo, mat, cor, sust, alto}, fach: {estilo, cor, cor2, led}, cad: [cores], padrao,
 * marcas: [{tipo, lado, ...}], entorno: {tipo, relevo, agua, lado}, letreiro, capacidade}) → a forma completa, com tudo
 * dentro dos limites; null sem família conhecida (o Maracanã — familia 'tigela' com entorno 'maracana' — é da
 * estadio-planta.js).
 */
export function validarFormaGenerica(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const familia = FAMILIAS.includes(f.familia) ? f.familia : null;
  if (!familia || f.entorno === 'maracana') return null;
  const D = PADRAO_FAMILIA[familia];
  const pista = familia === 'pista' || !!f.pista;
  const n0 = Number.isFinite(Number(f.n)) && f.n !== null ? clamp(Number(f.n), 2, 30) : (N_PLANTA[f.planta] ?? D.n);
  const rec = Array.isArray(f.recuo) ? f.recuo : [];
  // o recuo: a 1ª fileira fica fora das placas (6 m das linhas) com folga; na pista, fora da raia 8
  const PZ = CAMPO.meioZ + CAMPO.entorno + 0.14, PX = CAMPO.meioX + CAMPO.entorno + 0.14;
  const lat = clamp(num(rec[0], D.recuo[0]), PZ - CAMPO.meioZ + 1.4, 48), fun = clamp(num(rec[1], D.recuo[1]), PX - CAMPO.meioX + 1.4, 60);
  const ladoBruto = k => (f.lados && Array.isArray(f.lados[k]) ? f.lados[k] : null);
  const capacidade = clamp(num(f.capacidade, 40000), 3000, 120000);
  // sem os lados: uma estimativa pela capacidade (as 4 iguais, ~0,5 m² por lugar)
  const profPadrao = clamp(Math.sqrt(capacidade / 1400) * 5.2, 10, 60);
  const lados = {};
  for (const k of LADOS) {
    const b = ladoBruto(k);
    const prof = b ? clamp(num(b[0], profPadrao), 0, 75) : profPadrao;
    const aneis = clamp(Math.round(num(b?.[2], prof > 40 ? 2 : 1)), 1, 3);
    const y0 = D.y0;
    // a altura da última fileira: a inclinação de verdade fica entre ~15° (a geral de concreto) e ~35° (o anel de cima)
    const alto = prof < 2 ? y0 : clamp(num(b?.[1], y0 + prof * 0.5), y0 + prof * Math.tan(14 * RAD), y0 + prof * Math.tan(35 * RAD) + 2.5 * (aneis - 1));
    lados[k] = { prof: prof < 2 ? 0 : prof, alto, aneis, coberta: b ? !!num(b[3], 0) : familia !== 'pequeno', camarotes: b ? !!num(b[4], 0) : aneis > 1, y0 };
  }
  // sem arquibancada num lado: cantos abertos (exceto a ferradura, de cantos fechados descendo até o lado vazio)
  const algumVazio = LADOS.some(k => lados[k].prof === 0);
  let cantos = ['fechados', 'abertos', 'parciais'].includes(f.cantos) ? f.cantos : D.cantos;
  if (algumVazio && f.planta !== 'ferradura') cantos = 'abertos';
  // a frente de cada lado (distância do centro à 1ª fileira no eixo): o lado de cá é a boca do túnel (ou mais longe)
  let frente;
  if (pista) {
    const P = PISTA, Rf = P.raio + P.raias * P.raia + clamp(num(rec[0], 3), 1.5, 14);
    frente = { la: Rf, fa: P.meiaReta + Rf, fb: P.meiaReta + Rf, ca: Math.max(ESTADIO.tunel.z, Rf), n: 2, L: P.meiaReta, R: Rf };
  } else {
    frente = { la: CAMPO.meioZ + lat, fa: CAMPO.meioX + fun, fb: CAMPO.meioX + fun, ca: Math.max(ESTADIO.tunel.z, CAMPO.meioZ + lat), n: n0 };
    // a 1ª fileira contém a quina das placas com folga ≥ 1,5 m na diagonal (senão abre o n)
    const thq = Math.atan2(PZ, PX), rq = Math.hypot(PX, PZ);
    for (let k = 0; k < 60 && raioSuper(thq, frente.fa, frente.la, frente.n) < rq + 1.5; k++) frente.n += 0.25;
  }
  const cobB = f.cob && typeof f.cob === 'object' ? f.cob : {};
  let cobTipo = COBERTURAS.includes(cobB.tipo) ? cobB.tipo : D.cob;
  if (cobTipo === 'parcial' && !LADOS.some(k => lados[k].coberta && lados[k].prof > 0)) cobTipo = 'nenhuma';
  // o anel e a cobertura total só cobrem cantos fechados; nos abertos cada arquibancada leva a sua
  if ((cobTipo === 'anel' || cobTipo === 'total' || cobTipo === 'retratil') && cantos === 'abertos') cobTipo = 'por_arquibancada';
  if (cobTipo === 'anel' || cobTipo === 'total' || cobTipo === 'retratil') for (const k of LADOS) if (lados[k].prof > 0) lados[k].coberta = true;
  if (cobTipo === 'nenhuma') for (const k of LADOS) lados[k].coberta = false;
  if (cobTipo === 'por_arquibancada' && !LADOS.some(k => lados[k].coberta)) for (const k of LADOS) lados[k].coberta = lados[k].prof > 0;
  const cobertura = {
    tipo: cobTipo,
    mat: MATERIAIS.includes(cobB.mat) ? cobB.mat : 'metal',
    cor: corOk(cobB.cor) ?? (cobB.mat === 'membrana' ? '#eeeeea' : '#c9cdd0'),
    sust: SUSTENTA.includes(cobB.sust) ? cobB.sust : (cobTipo === 'anel' ? 'anel_compressao' : cobTipo === 'total' || cobTipo === 'retratil' ? 'trelica' : 'balanco'),
    // a cor da estrutura à mostra (as treliças vermelhas do San Siro, os arcos vermelhos da Luz); sem ela, cinza-aço
    estr: corOk(cobB.estr),
    // a altura da borda de dentro acima do topo da arquibancada (m)
    folga: clamp(num(cobB.alto, NaN) - Math.max(...LADOS.map(k => lados[k].alto)), 3, 22),
  };
  if (!Number.isFinite(cobertura.folga)) cobertura.folga = cobTipo === 'total' || cobTipo === 'retratil' ? 7 : 5;
  const fachB = f.fach && typeof f.fach === 'object' ? f.fach : {};
  const fachada = {
    estilo: ESTILOS.includes(fachB.estilo) ? fachB.estilo : 'concreto',
    cor: corOk(fachB.cor) ?? '#bfc2c0', cor2: corOk(fachB.cor2) ?? '#5b6266', led: corOk(fachB.led),
  };
  const cadeiras = (Array.isArray(f.cad) ? f.cad.map(corOk).filter(Boolean) : []).slice(0, 4);
  if (!cadeiras.length) cadeiras.push('#3b4246');
  const marcas = (Array.isArray(f.marcas) ? f.marcas : []).filter(m => m && MARCAS.includes(m.tipo)).slice(0, 8).map(m => ({
    tipo: m.tipo, lado: LADOS.includes(m.lado) ? m.lado : null, n: clamp(Math.round(num(m.n, 0)), 0, 24), alto: clamp(num(m.alto, 0), 0, 180),
    cor: corOk(m.cor), texto: typeof m.texto === 'string' ? m.texto.slice(0, 30) : null,
  }));
  const ent = f.entorno && typeof f.entorno === 'object' ? f.entorno : {};
  const entorno = {
    tipo: ENTORNOS.includes(ent.tipo) ? ent.tipo : 'residencial',
    relevo: ['plano', 'morros', 'montanhas'].includes(ent.relevo) ? ent.relevo : 'plano',
    agua: ['nenhuma', 'rio', 'mar', 'lago', 'canal'].includes(ent.agua) ? ent.agua : 'nenhuma',
    lado: LADOS.includes(ent.lado) ? ent.lado : 'fb',
  };
  return {
    familia, generica: true, pista, cantos, planta: f.planta ?? null,
    frente, lados, cobertura, fachada, cadeiras, padrao: PADROES.includes(f.padrao) ? f.padrao : (cadeiras.length > 1 ? 'misto' : 'liso'),
    marcas, entorno, capacidade, pistaCor: corOk(f.pistaCor) ?? '#a9472f', piso: corOk(f.piso),
    letreiro: typeof f.letreiro === 'string' && f.letreiro.trim() ? f.letreiro.trim().slice(0, 40).toUpperCase() : '',
    semente: hashTexto(f.letreiro ?? familia) ^ Math.round(capacidade),
    // o giro da malha de ruas do bairro em volta (a orientação real do campo, se a pesquisa achou; senão pela semente)
    giroBairro: (Number.isFinite(Number(f.orientacao)) && f.orientacao !== null ? Number(f.orientacao) : (hashTexto(f.letreiro ?? familia) % 70) - 35) * RAD,
  };
}

// ------------------------------------------------------------------ a planta
/**
 * A planta genérica: tudo o que o desenho, a torcida, os sólidos e os trilhos precisam saber da forma.
 * forma: a de validarFormaGenerica (ou a bruta do estadios.json). opc: {dividida} (o clássico: metade de cada torcida).
 */
export function criarPlantaGenerica(formaBruta, opc = {}) {
  const F = formaBruta?.generica ? formaBruta : validarFormaGenerica(formaBruta);
  if (!F) return null;
  const dividida = !!opc?.dividida;
  const Fr = F.frente, LD = LADOS.map(k => F.lados[k]);
  const T = ESTADIO.tunel;
  const abertos = F.cantos === 'abertos';
  // semi-eixos da 1ª fileira por quadrante: a em x (fa ou fb), b em z (ca ou la)
  const aF = c => (c >= 0 ? Fr.fa : Fr.fb), bF = s => (s >= 0 ? Fr.ca : Fr.la);
  const profDe = k => LD[k].prof;
  const rF = tabela(th => (F.pista ? raioPista(th, Fr.L, Fr.R) : raioSuper(th, aF(Math.cos(th)), bF(Math.sin(th)), Fr.n)));
  // a última fileira: a mesma curva com os semi-eixos + a profundidade de cada lado (na tigela e na pista, mais redonda)
  const nB = F.familia === 'tigela' || F.pista ? Math.min(Fr.n, 2.4) : Fr.n;
  const rB = tabela(th => {
    const c = Math.cos(th), s = Math.sin(th);
    const pa = c >= 0 ? profDe(1) : profDe(2), pb = s >= 0 ? profDe(3) : profDe(0);
    if (F.pista) {
      // a pista: a curva de atletismo afastada pela profundidade (as retas pelos lados e os semicírculos pelos fundos)
      const r0 = rF(th), xf = Math.abs(r0 * c);
      const w = Math.pow(clamp((xf - Fr.L) / Fr.R, 0, 1), 1.5);
      return Math.max(r0 + 0.01, raioPista(th, Fr.L, Fr.R + Math.max(0.01, lerp(pb, pa, w))));
    }
    return Math.max(rF(th) + 0.01, raioSuper(th, aF(c) + Math.max(pa, 0.01), bF(s) + Math.max(pb, 0.01), nB));
  });
  /** Ponto (x, z) da fileira s no ângulo polar th. */
  function ponto(th, s) { const r = rF(th) + s * (rB(th) - rF(th)); return [r * Math.cos(th), r * Math.sin(th)]; }
  /** Fração da profundidade do ponto (x, z): < 0 antes da 1ª fileira, > 1 depois da última. */
  function sDe(x, z) { const th = Math.atan2(z, x), a = rF(th), b = rB(th); return (Math.hypot(x, z) - a) / Math.max(1e-6, b - a); }
  // ψ normalizado pela 1ª fileira (a diagonal do canto em ±45°)
  const psi = (x, z) => Math.atan2(z / bF(z), x / aF(x)) / RAD;
  /** 0 lado de lá (z −), 1 fundo +x, 2 fundo −x, 3 lado de cá (z +). */
  function setor(x, z) { const p = psi(x, z); return p >= -135 && p <= -45 ? 0 : p > -45 && p < 45 ? 1 : p >= 45 && p <= 135 ? 3 : 2; }
  const thDivisa = [Math.atan2(-Fr.la, Fr.fa), Math.atan2(Fr.ca, Fr.fa), Math.atan2(Fr.ca, -Fr.fb), Math.atan2(-Fr.la, -Fr.fb)];
  // pesos dos 4 lados no ângulo (a mistura dos perfis nos cantos fechados: ±BL° de ψ em volta da diagonal)
  const BL = F.cantos === 'parciais' ? 9 : 14;
  const CENTRO = [-90, 0, 180, 90];
  /** ψ do raio no ângulo th (o mesmo ângulo normalizado pela 1ª fileira). */
  const psiTh = th => Math.atan2(Math.sin(th) / bF(Math.sin(th)), Math.cos(th) / aF(Math.cos(th))) / RAD;
  function pesos(th, out = [0, 0, 0, 0]) {
    const pp = psiTh(th);
    let soma = 0;
    for (let k = 0; k < 4; k++) {
      let d = Math.abs(pp - CENTRO[k]) % 360; if (d > 180) d = 360 - d;
      const w = abertos ? (d < 45 ? 1 : 0) : suave((45 + BL - d) / (2 * BL));
      out[k] = w; soma += w;
    }
    for (let k = 0; k < 4; k++) out[k] /= soma || 1;
    return out;
  }
  // os cantos parciais: o canto desce (o "recheio" mais baixo que as arquibancadas dos lados)
  function mergulhoCanto(th) {
    if (F.cantos !== 'parciais') return 0;
    const pp = psiTh(th);
    let d = 180;
    for (const dg of [45, 135, -45, -135]) { let e = Math.abs(pp - dg) % 360; if (e > 180) e = 360 - e; d = Math.min(d, e); }
    return 0.42 * (1 - suave(d / (BL + 4)));
  }

  // ---------------------------------------------------------------- perfil de cada lado (s: 0 = 1ª fileira, 1 = última)
  // nós [s, y, tipo]: tipo 0 = cadeiras, 1 = face de vidro/concreto dos camarotes (quase em pé), 2 = o piso do corredor
  function nosDoLado(L) {
    const y0 = L.y0, top = L.alto, a = L.aneis;
    if (L.prof <= 0) return [[0, y0, 0], [1, y0, 0]];
    const out = [[0, y0, 0]];
    const faixa = L.camarotes ? 3.4 : 1.2;   // a altura da face entre os anéis
    const quebras = a === 1 ? [] : a === 2 ? [0.5] : [0.36, 0.7];
    const subir = (s0, y0b, s1, y1b, n = 3, pot = 1.12) => { for (let i = 1; i <= n; i++) { const u = i / n; out.push([s0 + (s1 - s0) * u, y0b + (y1b - y0b) * Math.pow(u, pot), 0]); } };
    // a subida útil (sem as faces) dividida pelos anéis: os de cima mais em pé
    const util = top - y0 - faixa * quebras.length;
    const fr = a === 1 ? [1] : a === 2 ? [0.4, 0.6] : [0.26, 0.34, 0.4];
    let s = 0, y = y0;
    for (let i = 0; i <= quebras.length; i++) {
      const s1 = i < quebras.length ? quebras[i] : 1, y1 = y + util * fr[i];
      subir(s, y, s1, y1, i === quebras.length ? 4 : 2);
      s = s1; y = y1;
      if (i < quebras.length) {
        out.push([s + 0.004, y + faixa, 1]);
        out.push([s + 0.03, y + faixa, 2]);
        s += 0.03; y += faixa;
      }
    }
    return out;
  }
  const NOS = LD.map(nosDoLado);
  function perfilLado(k, s) {
    const nos = NOS[k];
    if (s <= 0) return nos[0][1];
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) { const [s0, y0] = nos[i - 1], [s1, y1] = nos[i]; return y0 + (y1 - y0) * (s - s0) / ((s1 - s0) || 1); }
    return nos[nos.length - 1][1];
  }
  /** O tipo do trecho do perfil em s no lado k (0 cadeiras, 1 face, 2 corredor). */
  function tipoEm(k, s) {
    const nos = NOS[k];
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) return nos[i][2];
    return 0;
  }
  const _w = [0, 0, 0, 0];
  /** y do degrau na fração s da profundidade, no ângulo th (a mistura dos lados; o canto parcial desce). */
  function perfil(s, th) {
    pesos(th, _w);
    let y = 0;
    for (let k = 0; k < 4; k++) if (_w[k] > 0) y += _w[k] * perfilLado(k, clamp(s, 0, 1));
    const mg = mergulhoCanto(th);
    if (mg > 0) { const y0 = LD[0].y0; y = y0 + (y - y0) * (1 - mg); }
    return y;
  }
  /** O lado que manda no ângulo th (o de maior peso). */
  function ladoEm(th) { pesos(th, _w); let k = 0; for (let i = 1; i < 4; i++) if (_w[i] > _w[k]) k = i; return k; }
  /** Os anéis do perfil (s de todos os nós de todos os lados, sem repetir): o desenho faz uma faixa entre cada par. */
  const sAneis = [...new Set(NOS.flat().map(n => Math.round(n[0] * 1e4) / 1e4))].sort((a, b) => a - b);
  // a ponta das arquibancadas nos cantos abertos: os lados vão até |x| ≤ X (um pouco além da linha de fundo) e os fundos
  // até |z| ≤ Z (um pouco além da linha lateral) — o canto (|x| > X e |z| > Z) fica vazio
  const XP = Math.min(CAMPO.meioX + 3, Math.min(Fr.fa, Fr.fb) - 1.2), ZP = Math.min(CAMPO.meioZ + 2.5, Math.min(Fr.la, Fr.ca) - 1.2);
  /** Tem arquibancada neste ponto (x, z) (dentro do lado dele e, no canto aberto, antes da ponta)? */
  function temArquibancada(x, z) {
    const k = setor(x, z);
    if (LD[k].prof <= 0) {
      if (!abertos) { const th = Math.atan2(z, x); return rB(th) - rF(th) > 2.5; }
      return false;
    }
    if (!abertos) return true;
    return k === 0 || k === 3 ? Math.abs(x) <= XP : Math.abs(z) <= ZP;
  }
  /** A ponta da arquibancada k na fileira s, no lado + (sinal 1) ou − (−1): o θ onde |x| = XP (lados) ou |z| = ZP (fundos). */
  function thPonta(k, s, sinal) {
    // lados: x = sinal·XP na metade z < 0 (k 0) ou z > 0 (k 3); fundos: z = sinal·ZP na metade x > 0 (k 1) ou x < 0 (k 2)
    let lo, hi, f;
    if (k === 0) { lo = -Math.PI + 1e-6; hi = -1e-6; f = th => ponto(th, s)[0] - sinal * XP; }
    else if (k === 3) { lo = 1e-6; hi = Math.PI - 1e-6; f = th => sinal * XP - ponto(th, s)[0]; }
    else if (k === 1) { lo = -Math.PI / 2 + 1e-6; hi = Math.PI / 2 - 1e-6; f = th => ponto(th, s)[1] - sinal * ZP; }
    else { lo = Math.PI / 2 + 1e-6; hi = 1.5 * Math.PI - 1e-6; f = th => sinal * ZP - ponto(th, s)[1]; }
    for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    let t = (lo + hi) / 2; if (t > Math.PI) t -= 2 * Math.PI;
    return t;
  }
  /**
   * Os trechos de arquibancada para o desenho: [{k (setor), cols(s) → [θ…] (as colunas na fileira s), fechado}] — nos
   * cantos fechados, os 4 setores entre as divisas (colunas por ângulo); nos abertos, cada lado entre as pontas (colunas
   * pelo comprimento: a borda é uma reta).
   */
  function trechos(nCol = 104) {
    const out = [];
    const [d0, d1, d2, d3] = thDivisa;
    const faixasTh = [[d3, d0], [d0, d1], [d2, d3 + 2 * Math.PI], [d1, d2]];
    for (let k = 0; k < 4; k++) {
      if (LD[k].prof <= 0 && abertos) continue;
      const [a, b] = faixasTh[k];
      const m = Math.max(6, Math.ceil((nCol * (b - a)) / (2 * Math.PI)));
      if (!abertos) { out.push({ k, fechado: true, m, cols: () => Array.from({ length: m + 1 }, (_, j) => a + ((b - a) * j) / m) }); continue; }
      out.push({
        k, fechado: false, m,
        cols: s => {
          // a ponta de cada lado na fileira s e as colunas igualmente espaçadas no comprimento (x ou z)
          const t0 = thPonta(k, s, k === 0 || k === 1 ? -1 : 1), t1 = thPonta(k, s, k === 0 || k === 1 ? 1 : -1);
          const lista = [];
          for (let j = 0; j <= m; j++) {
            const alvo = (k === 0 || k === 3 ? XP : ZP) * (-1 + (2 * j) / m) * (k === 3 || k === 2 ? -1 : 1);
            lista.push(j === 0 ? t0 : j === m ? t1 : thDoAlvo(k, s, alvo));
          }
          return lista;
        },
      });
    }
    return out;
  }
  const norm = t => { t = ((t + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return t; };
  function thDoAlvo(k, s, alvo) {
    let lo, hi, f;
    if (k === 0) { lo = -Math.PI + 1e-6; hi = -1e-6; f = th => ponto(th, s)[0] - alvo; }
    else if (k === 3) { lo = 1e-6; hi = Math.PI - 1e-6; f = th => alvo - ponto(th, s)[0]; }
    else if (k === 1) { lo = -Math.PI / 2 + 1e-6; hi = Math.PI / 2 - 1e-6; f = th => ponto(th, s)[1] - alvo; }
    else { lo = Math.PI / 2 + 1e-6; hi = 1.5 * Math.PI - 1e-6; f = th => alvo - ponto(th, s)[1]; }
    for (let i = 0; i < 44; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    return norm((lo + hi) / 2);
  }
  /** Comprimento de arco no meio da profundidade (s = 0,5) de −π até th (para a textura: o u das cadeiras em m). */
  const arcoMeio = (() => {
    const N = 3600, acc = new Float64Array(N + 1);
    let px = 0, pz = 0;
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI + (2 * Math.PI * i) / N, [x, z] = ponto(th, 0.5);
      if (i > 0) acc[i] = acc[i - 1] + Math.hypot(x - px, z - pz);
      px = x; pz = z;
    }
    // a volta inteira num múltiplo de 12 m (o ladrilho da textura: os corredores casam na emenda em θ = ±π)
    const tot = acc[N], k = (Math.max(1, Math.round(tot / 12)) * 12) / tot;
    for (let i = 0; i <= N; i++) acc[i] *= k;
    const L = acc[N];
    return th => {
      let volta = 0;
      while (th > Math.PI) { th -= 2 * Math.PI; volta += L; }
      while (th < -Math.PI) { th += 2 * Math.PI; volta -= L; }
      let u = ((th + Math.PI) / (2 * Math.PI)) * N; u = clamp(u, 0, N); const i = Math.min(N - 1, Math.floor(u));
      return volta + acc[i] + (acc[i + 1] - acc[i]) * (u - i);
    };
  })();
  /** O u (m ao longo da arquibancada) do ponto: nos cantos abertos, o x (lados) ou o z (fundos); senão o arco no meio. */
  function uDe(x, z, k = setor(x, z)) { return abertos ? (k === 0 || k === 3 ? x : z) : arcoMeio(Math.atan2(z, x)); }

  // ---------------------------------------------------------------- topo e cobertura
  const topoLado = k => (LD[k].prof > 0 ? LD[k].alto : LD[k].y0);
  /** A altura da última fileira no ângulo th. */
  const yTopo = th => perfil(1, th);
  const C = F.cobertura;
  const cobContinua = C.tipo === 'anel' || C.tipo === 'total' || C.tipo === 'retratil';
  // quanto da profundidade a cobertura deixa de fora (o anel do Mineirão cobre quase tudo; a total passa da 1ª fileira)
  const sDentro = C.tipo === 'total' || C.tipo === 'retratil' ? -0.06 : C.tipo === 'anel' ? 0.04 : 0;
  /** A cobertura no ângulo th: {fora, dentro (raios), yFora, yDentro} ou null (sem cobertura ali). */
  function cobEm(th) {
    if (C.tipo === 'nenhuma') return null;
    const k = ladoEm(th);
    if (!cobContinua && !LD[k].coberta) return null;
    if (!cobContinua && LD[k].prof <= 0) return null;
    const a = rF(th), b = rB(th), D = b - a;
    if (D < 2.5) return null;
    const yt = yTopo(th);
    const dentro = a + sDentro * D - (C.tipo === 'total' || C.tipo === 'retratil' ? 3 : 1.5);
    // a cobertura de pilares (a antiga) é quase plana; as outras sobem para o campo (a borda de dentro mais alta)
    return { fora: b + 1.6, dentro, yFora: yt + 3.2, yDentro: C.sust === 'pilares' ? yt + 3.6 : yt + C.folga };
  }
  /** Dentro da projeção da cobertura (e, nos cantos abertos, da arquibancada dela)? Devolve a altura ou null. */
  function alturaCobEm(x, z) {
    const th = Math.atan2(z, x), c = cobEm(th);
    if (!c) return null;
    const r = Math.hypot(x, z);
    if (r < c.dentro || r > c.fora) return null;
    if (abertos && !temArquibancada(...pontoNaMesmaFileira(x, z))) return null;
    const u = (c.fora - r) / (c.fora - c.dentro);
    return lerp(c.yFora, c.yDentro, u);
  }
  // nos cantos abertos a cobertura acompanha a ponta reta da arquibancada (o teste é no ponto trazido para a 1ª fileira)
  function pontoNaMesmaFileira(x, z) {
    const th = Math.atan2(z, x), r = Math.hypot(x, z), a = rF(th), b = rB(th), s = clamp((r - a) / Math.max(1e-6, b - a), 0, 1);
    const [px, pz] = ponto(th, s);
    return [px, pz];
  }
  /** 1 ao sol, ~0,66 na sombra da cobertura (o sol do dia de render/cena.js). */
  const SOLD = [-0.42, 0.74, 0.52];
  function luzDoSol(x, y, z) {
    if (C.tipo === 'nenhuma') return 1;
    // o raio até o sol: passa pela chapa da cobertura (de baixo para cima) em algum passo?
    for (let t = 3; t <= 66; t += 3) {
      const yc = alturaCobEm(x + SOLD[0] * t, z + SOLD[2] * t);
      if (yc != null && y + SOLD[1] * t >= yc - 0.3 && y + SOLD[1] * (t - 3) <= yc + 0.3) return 0.66;
    }
    return 1;
  }

  // ---------------------------------------------------------------- fachada (o pré-jogo)
  const recuoFach = 2.6;
  /** Raio da face de fora da fachada no ângulo th (nos cantos abertos: a de trás da arquibancada dele). */
  const rFach = th => rB(th) + recuoFach;
  const yFach = th => Math.max(yTopo(th) + 2.6, 8);
  // a CASCA (a pele de almofadas da Allianz Arena, a membrana que sobe até a cobertura): a fachada de membrana com a
  // cobertura fechada sai do chão um pouco para fora, abaulada, e dobra para dentro até a borda de fora da cobertura
  const casca = !abertos && (F.fachada.estilo === 'membrana' || F.marcas.some(m => m.tipo === 'pele_led')) && (F.cobertura.tipo === 'total' || F.cobertura.tipo === 'retratil' || F.cobertura.tipo === 'anel');
  const BOJO = 7;
  /** O perfil da casca no ângulo th: [[r, y]…] do chão até a borda da cobertura (ou null sem casca). */
  function perfilCasca(th) {
    if (!casca) return null;
    const c = cobEm(th), r0 = rFach(th), yt = c ? c.yFora + 0.6 : yFach(th), rt = c ? c.fora - 0.4 : r0;
    const out = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6, a = u * Math.PI; out.push([r0 + BOJO * Math.sin(a * 0.62) * (1 - u * 0.35) + (rt - r0) * u * u, yt * (1 - Math.cos(a)) / 2]); }
    return out;
  }

  // ---------------------------------------------------------------- lugares da torcida
  // quantos torcedores desenhados: ~1 por lugar até ~20 mil; nos grandes, até ~25 mil (cada um vale vários lugares)
  const nAlvo = Math.round(Math.min(25500, 0.6 * F.capacidade + 6000));
  const T0 = Math.max(...LD.map(l => l.prof));
  // a área das cadeiras (m², só os trechos de cadeira: sem as faces e os corredores entre os anéis)
  const areaCadeiras = (() => {
    let A = 0;
    const N = 720;
    for (let i = 0; i < N; i++) {
      const th = -Math.PI + (2 * Math.PI * (i + 0.5)) / N;
      const a = rF(th), b = rB(th);
      if (b - a < 2.5) continue;
      const [px, pz] = ponto(th, 0.02);
      if (!temArquibancada(px, pz)) continue;
      A += ((b * b - a * a) / 2) * ((2 * Math.PI) / N) * 0.93;
    }
    return A;
  })();
  // o espaço de cada torcedor desenhado: ~0,66 m² × k² (k ≥ 0,85; até 1,35 o boneco cresce, depois só se espaçam)
  const kEsp = clamp(Math.sqrt((areaCadeiras * 0.8) / (nAlvo * 0.66)), 0.85, 2.6);
  const ESC = clamp(kEsp, 0.95, 1.3);
  const PASSO = 0.72 * kEsp, FILA = clamp(0.92 * kEsp, 0.8, 1.7);
  const NF = Math.max(8, Math.round(T0 / FILA));
  function gerarLugares() {
    const lista = [];
    const mt = T.largura / 2 + 0.4, topoTunel = T.altura + T.laje + 0.3;
    const M = 4320;
    const lentes = PLANOS_LENTES();
    for (let j = 0; j < NF; j++) {
      const f = NF - 1 - j;            // 0 = a de cima
      const sj = (j + 0.5) / NF;
      let acum = PASSO * h2(j, 77), px = 0, pz = 0, ini = true;
      for (let i = 0; i <= M; i++) {
        const th = -Math.PI + (2 * Math.PI * i) / M;
        const a = rF(th), b = rB(th), Dl = b - a;
        if (Dl < 2.5) { ini = true; continue; }
        // a fileira j só existe onde a arquibancada é funda o bastante (nos lados rasos as de cima somem)
        const s = ((j + 0.5) * FILA) / Dl;
        if (s > 1) { ini = true; continue; }
        const [x, z] = ponto(th, s);
        if (!ini) acum += Math.hypot(x - px, z - pz);
        px = x; pz = z; ini = false;
        if (acum < PASSO) continue;
        acum -= PASSO;
        if (!temArquibancada(x, z)) continue;
        const k = setor(x, z);
        if (tipoEm(ladoEm(th), s) !== 0) continue;
        const y = perfil(s, th);
        // corredores (os da textura: a cada 12 m, 1,2 m de largura) e a boca do túnel
        const u = uDe(x, z, k), g = ((u % 12) + 12) % 12;
        if (g < 1.25 || (g > 6 && g < 7.25)) continue;
        if (z > 0 && Math.abs(x) < mt && y < topoTunel) continue;
        if (lentes(x, y, z)) continue;
        const hs = h2(i, j * 31 + 7);
        // as cadeiras soltas à mostra (as brechas) e a última fileira (debaixo do parapeito) vazia
        if (hs < 0.06 || s > 0.985) continue;
        if (dividida && Math.abs(x) < 3 && (k === 0 || k === 3)) continue;
        let im = -1;
        if (k === 0 && !dividida && j >= NF - 36) {
          const pp = psi(x, z), uu = clamp((pp + 135) / 90, 0, 1);
          im = Math.min(249, Math.floor(uu * 250)) + Math.min(35, NF - 1 - j) * 250;
        }
        lista.push(k, f, i, x, y, z, s > 0.5 ? ESC * 1.08 : ESC, im, luzDoSol(x, y + 1.2, z));
      }
    }
    const n = lista.length / 9;
    return {
      n, fileiras: NF, dividida,
      iterar(cadeira) { for (let i = 0; i < lista.length; i += 9) cadeira(lista[i], lista[i + 1], lista[i + 2], lista[i + 3], lista[i + 4], lista[i + 5], lista[i + 6], lista[i + 7], lista[i + 8]); },
    };
  }
  let _lugares = null;

  // ---------------------------------------------------------------- marcas próprias (arco, torres, mastros, telões)
  const rMax = Math.max(...Array.from({ length: 72 }, (_, i) => rFach(-Math.PI + (i * Math.PI) / 36))) + (casca ? BOJO : 0);
  const yMax = Math.max(...LADOS.map((_, k) => topoLado(k)));
  const MARCAS_P = montarMarcas();
  function montarMarcas() {
    const out = [];
    const angLado = { la: -Math.PI / 2, fa: 0, fb: Math.PI, ca: Math.PI / 2 };
    for (const m of F.marcas) {
      if (m.tipo === 'arco') {
        // o arco por cima de uma arquibancada (Wembley: 133 m de altura, inclinado sobre a norte) — de ponta a ponta do lado
        const k = LADOS.indexOf(m.lado ?? 'la'), th = angLado[m.lado ?? 'la'];
        const lado = k === 0 || k === 3;
        const meia = (lado ? Math.max(Fr.fa, Fr.fb) + LD[1].prof * 0.6 : Math.max(Fr.la, Fr.ca) + LD[0].prof * 0.6) + 8;
        const dist = rB(th) * 0.92;
        out.push({ tipo: 'arco', k, lado, meia, dist, alto: m.alto || Math.max(yMax + 50, meia * 0.85), raio: 3.6, cor: m.cor ?? '#e9eaea' });
      } else if (m.tipo === 'torres' || m.tipo === 'rampas_espiral') {
        // torres cilíndricas em volta da fachada (as do San Siro: 11 torres com a rampa em espiral, 50 m)
        const n = m.n || (m.tipo === 'rampas_espiral' ? 11 : 4), lista = [];
        for (let i = 0; i < n; i++) {
          const th = n === 4 ? (-135 + 90 * i) * RAD : -Math.PI + ((i + 0.5) * 2 * Math.PI) / n;
          const r = rFach(th) + 9;
          lista.push({ x: r * Math.cos(th), z: r * Math.sin(th), raio: 8.5, alto: m.alto || yMax + 6 });
        }
        out.push({ tipo: m.tipo, torres: lista, espiral: m.tipo === 'rampas_espiral', cor: m.cor ?? '#b9b5aa' });
      } else if (m.tipo === 'mastros') {
        // os mastros (pilones) por fora que seguram a cobertura pelos cabos (os 8 amarelos do Signal Iduna Park)
        const n = m.n || 8, lista = [];
        for (let i = 0; i < n; i++) {
          const th = -Math.PI + ((i + 0.5) * 2 * Math.PI) / n, r = rFach(th) + 6;
          lista.push({ x: r * Math.cos(th), z: r * Math.sin(th), th, alto: m.alto || yMax + 22 });
        }
        out.push({ tipo: 'mastros', mastros: lista, cor: m.cor ?? '#f2c21b' });
      } else if (m.tipo === 'telao') {
        // telões em cima dos fundos (um em cada; com lado, só nele)
        const ks = m.lado ? [LADOS.indexOf(m.lado)] : [1, 2];
        for (const k of ks) {
          if (LD[k].prof <= 0) continue;
          const th = [-Math.PI / 2, 0, Math.PI, Math.PI / 2][k], alt = 7, larg = clamp(LD[k].prof * 0.9, 12, 30);
          // pendurado debaixo da borda de dentro da cobertura (o telão dos estádios cobertos); sem cobertura, em cima da
          // arquibancada, atrás do parapeito, nos postes
          const c = cobEm(th);
          let r = rB(th) + 1.4, y = topoLado(k) + 1.2 + alt / 2 + 0.4;
          if (c) {
            const rr = c.dentro + 5, yc = lerp(c.yFora, c.yDentro, (c.fora - rr) / (c.fora - c.dentro)) - 1.8 - alt / 2;
            const sAbaixo = clamp((rr - rF(th)) / Math.max(1e-6, rB(th) - rF(th)), 0, 1);
            if (yc - alt / 2 >= perfil(sAbaixo, th) + 4) { r = rr; y = yc; } else continue;
          }
          out.push({ tipo: 'telao', k, x: r * Math.cos(th), z: r * Math.sin(th), y, th, larg, alt, pendurado: !!c });
        }
      } else if (m.tipo === 'estatua') {
        out.push({ tipo: 'estatua', x: 0, z: rFach(Math.PI / 2) + 34, alto: m.alto || 9 });
      } else if (m.tipo === 'cupula') {
        // um ginásio de cúpula ao lado (o Maracanãzinho do Mineirinho, o Ginásio do Ibirapuera…)
        const th = angLado[m.lado ?? 'fb'], r = rFach(th) + 90;
        out.push({ tipo: 'cupula', x: r * Math.cos(th), z: r * Math.sin(th), raio: 48, parede: 9, alto: 18 });
      } else if (m.tipo === 'relogio') {
        out.push({ tipo: 'relogio', k: LADOS.indexOf(m.lado ?? 'fb') });
      } else if (m.tipo === 'pele_led') {
        out.push({ tipo: 'pele_led', cor: m.cor ?? F.fachada.led ?? '#e03030' });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- sólidos (a câmera de cinema fica fora deles)
  /**
   * O ponto está dentro de algo sólido da forma (ou a menos de `f` m)? Nome ou null. `fora`: conta também a fachada, as
   * marcas e o entorno (o estádio do pré-jogo). `noTunel`: o corredor do túnel (livre).
   */
  function solido(x, y, z, f = 0.3, fora = true, noTunel = false) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const a = rF(th), b = rB(th);
    // o túnel do lado de cá entre a boca e a 1ª fileira (a pista: a caixa por cima da pista)
    if (z > 0 && Fr.ca > T.z + 0.5 && !noTunel && Math.abs(x) <= T.largura / 2 + 0.4 + f && z >= T.z - f && z <= Fr.ca + f && y <= T.altura + T.laje + f) return 'túnel (paredes)';
    if (r >= a - f && r <= b + f && !noTunel) {
      const s = clamp((r - a) / Math.max(1e-6, b - a), 0, 1);
      const [px, pz] = ponto(th, s);
      if (b - a >= 2.5 && temArquibancadaFolga(px, pz, f) && y <= perfil(s, th) + f) {
        return z > 0 && Math.abs(x) < T.largura / 2 + 0.4 + f && y < T.altura + T.laje + f ? 'túnel (paredes)' : 'arquibancada';
      }
    }
    // a parede de trás (o parapeito da última fileira) e o miolo até a fachada
    const rf = rFach(th);
    if (r > b - f && r <= rf + f && b - a >= 2.5) {
      const [px, pz] = ponto(th, 1);
      if (temArquibancadaFolga(px, pz, f) && y <= yTopo(th) + 1.3 + f) return 'parede de trás';
    }
    // cobertura (a chapa e a treliça da borda de dentro)
    const yc = alturaCobEmFolga(x, z, f);
    if (yc != null) {
      // a chapa (1,2 m) e, perto da borda de dentro, a treliça e a testeira penduradas embaixo dela
      const c = cobEm(th), uu = c ? (c.fora - r) / Math.max(1e-6, c.fora - c.dentro) : 0;
      const baixo = uu > 0.85 ? (C.sust === 'trelica' ? 3.6 : 2.2) : 1.2;
      if (y - yc <= 1.2 + f && yc - y <= baixo + f) return 'cobertura';
    }
    // torres de refletor (sem cobertura)
    for (const t of TORRES) {
      if (t.larga) { if (Math.abs(z - t.z) <= 3 + f && Math.abs(x) <= 60 + f && y >= t.alto - 8 - f && y <= t.alto + 1 + f) return 'refletor'; if (Math.abs(z - t.z) <= 1.5 + f && Math.abs(Math.abs(x) - 62) <= 1.5 + f && y <= t.alto + f) return 'refletor'; continue; }
      if (Math.hypot(x - t.x, z - t.z) <= (y > t.alto - 4 ? 3.4 : 0.7) + f && y <= t.alto + 1 + f) return 'refletor';
    }
    for (const m of MARCAS_P) {
      if (m.tipo === 'telao') {
        const lx = (x - m.x) * -Math.sin(m.th) + (z - m.z) * Math.cos(m.th), lr = (x - m.x) * Math.cos(m.th) + (z - m.z) * Math.sin(m.th);
        if (Math.abs(lx) <= m.larg / 2 + f && Math.abs(lr) <= 1.2 + f && y >= m.y - m.alt / 2 - (m.pendurado ? 0 : 3) - f && y <= m.y + m.alt / 2 + (m.pendurado ? 3 : 0) + f) return 'telão';
      }
    }
    if (!fora) return null;
    // a fachada (a casca de 2 m em volta; a pele abaulada da casca vai até BOJO m para fora)
    if (r > Math.max(rf - 3, b + 0.4) - f && r <= rf + (casca ? BOJO + 0.6 : 1.2) + f && y <= (casca ? (cobEm(th)?.yFora ?? yFach(th)) + 1.2 : yFach(th) + 0.6) + f) {
      const [px, pz] = ponto(th, 1);
      if (temArquibancadaFolga(px, pz, f + 2)) return 'fachada';
    }
    for (const m of MARCAS_P) {
      if (m.tipo === 'torres' || m.tipo === 'rampas_espiral') for (const t of m.torres) if (Math.hypot(x - t.x, z - t.z) <= t.raio + 2.4 + f && y <= t.alto + 1 + f) return 'torre';
      if (m.tipo === 'mastros') for (const t of m.mastros) if (Math.hypot(x - t.x, z - t.z) <= 1.6 + f && y <= t.alto + 1 + f) return 'mastro';
      if (m.tipo === 'arco' && arcoPerto(m, x, y, z, f)) return 'arco';
      if (m.tipo === 'estatua' && Math.hypot(x - m.x, z - m.z) <= 3.5 + f && y <= m.alto + 1 + f) return 'estátua';
      if (m.tipo === 'cupula') { const d = Math.hypot(x - m.x, z - m.z); if (d <= m.raio + f) { const h = m.parede + m.alto * Math.sqrt(Math.max(0, 1 - (d / m.raio) ** 2)); if (y <= h + f) return 'cúpula'; } }
    }
    if (r > rMax + 30) {
      for (const p of predios()) {
        const c = Math.cos(-p.rumo), sn = Math.sin(-p.rumo);
        const lx = (x - p.x) * c - (z - p.z) * sn, lz = (x - p.x) * sn + (z - p.z) * c;
        if (Math.abs(lx) <= p.lx / 2 + f && Math.abs(lz) <= p.lz / 2 + f && y <= p.h + f) return 'prédio';
      }
    }
    if (r > rMax + 8) for (const p of arvores()) if (Math.hypot(x - p.x, z - p.z) <= (y > p.h * 0.45 ? p.raio : 0.4) + f && y <= p.h + f) return 'árvore';
    return null;
  }
  function temArquibancadaFolga(x, z, f) {
    if (temArquibancada(x, z)) return true;
    if (f <= 0 || !abertos) return false;
    return temArquibancada(x - Math.sign(x) * f, z) || temArquibancada(x, z - Math.sign(z) * f);
  }
  function alturaCobEmFolga(x, z, f) {
    const y = alturaCobEm(x, z);
    if (y != null || f <= 0) return y;
    for (const [dx, dz] of [[f, 0], [-f, 0], [0, f], [0, -f]]) { const v = alturaCobEm(x + dx, z + dz); if (v != null) return v; }
    return null;
  }
  function arcoPerto(m, x, y, z, f) {
    // o arco no plano vertical ao longo do lado (x nos lados, z nos fundos), na distância m.dist do centro
    const ao = m.lado ? x : z, perp = m.lado ? z : x;
    const lado = [-1, 1, -1, 1][m.k];
    if (Math.abs(ao) > m.meia + f) return false;
    const ya = m.alto * (1 - (ao / m.meia) ** 2);
    return Math.abs(perp - lado * m.dist) <= m.raio + 1 + f && Math.abs(y - ya) <= m.raio + 1 + f;
  }

  /**
   * A câmera está no lado de cá, atrás da 1ª fileira (a câmera de TV: dentro da arquibancada ou por cima/atrás dela)? Aí o
   * lado de cá (a arquibancada, o túnel, os bancos e a cobertura dele) sai do desenho — a câmera de TV a 12–18 m de altura
   * fica por cima das arquibancadas baixas, e a cobertura delas tapava o campo.
   */
  function cameraNoLadoDeCa(p) {
    if (p.z <= 0) return false;
    const th = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
    const c = cobEm(th);
    const yLim = Math.max(c ? Math.max(c.yFora, c.yDentro) : 0, yTopo(th)) + 30;
    return setor(p.x, p.z) === 3 && r > rF(th) - 1 && p.y < yLim;
  }

  // ---------------------------------------------------------------- torres de refletor (sem cobertura) e entorno
  const TORRES = (() => {
    const luz = F.marcas.find(m => m.tipo === 'torres_luz');
    if (C.tipo !== 'nenhuma' && C.tipo !== 'parcial' && !luz) return [];
    const out = [];
    if (luz && luz.lado && (luz.lado === 'la' || luz.lado === 'ca')) {
      // as estruturas de refletores por cima dos lados (o Morumbi): uma atrás de cada lado comprido
      for (const th of [-Math.PI / 2, Math.PI / 2]) { const r = rB(th) + 4; out.push({ x: 0, z: r * Math.sin(th), alto: luz.alto || Math.max(yMax + 30, 60), larga: true }); }
      return out;
    }
    for (const g of [45, 135, -45, -135]) {
      const th = Math.atan2(Math.sin(g * RAD) * bF(Math.sin(g * RAD)), Math.cos(g * RAD) * aF(Math.cos(g * RAD)));
      // nos cantos abertos, no vão do canto; nos fechados, atrás da última fileira
      const r = abertos ? rF(th) + 6 : rB(th) + 6;
      out.push({ x: r * Math.cos(th), z: r * Math.sin(th), alto: luz?.alto || Math.max(yMax + 18, 38) });
    }
    return out;
  })();
  const E = F.entorno;
  // a esplanada pelo tipo do bairro: colada na cidade densa, larga no parque e no campo
  const rEsplanada = rMax + ({ urbano_denso: 34, residencial: 52, parque: 88, industrial: 70, campo_aberto: 96, orla: 58, campus: 78 }[E.tipo] ?? 60);
  let _predios = null, _arvores = null, _torcedores = null, _agua = undefined;
  /** A água (rio/canal: faixa; lago: disco; mar: meio-plano) do lado E.lado: {tipo, ...} ou null. */
  function agua() {
    if (_agua !== undefined) return _agua;
    const th = { la: -Math.PI / 2, fa: 0, fb: Math.PI, ca: Math.PI / 2 }[E.lado];
    const d = rEsplanada + (E.agua === 'mar' ? 60 : 30);
    const nx = Math.cos(th), nz = Math.sin(th);
    if (E.agua === 'rio' || E.agua === 'canal') _agua = { tipo: E.agua, nx, nz, d: d + 30, larg: E.agua === 'canal' ? 28 : 90 };
    else if (E.agua === 'lago') _agua = { tipo: 'lago', x: nx * (d + 160), z: nz * (d + 160), raio: 170 };
    else if (E.agua === 'mar') _agua = { tipo: 'mar', nx, nz, d: d + 40 };
    else _agua = null;
    return _agua;
  }
  function naAgua(x, z, m = 0) {
    const A = agua();
    if (!A) return false;
    if (A.tipo === 'lago') return Math.hypot(x - A.x, z - A.z) < A.raio + m;
    const t = x * A.nx + z * A.nz;
    if (A.tipo === 'mar') return t > A.d - m;
    return Math.abs(t - A.d - A.larg / 2) < A.larg / 2 + m;
  }
  /**
   * Prédios do entorno pelo tipo: [{x, z, lx, lz, h, rumo, cor}] — urbano denso (quadras cheias de prédios), residencial
   * (casas baixas e prédios médios), parque (quase nada perto, a cidade longe), industrial (galpões), campo aberto
   * (sítios), orla (prédios de frente para a água), campus (blocos espaçados).
   */
  function predios() {
    if (_predios) return _predios;
    const r = gerador(F.semente + 11), lista = [];
    const Q = 44, R0 = rEsplanada + 20, R1 = 1150;
    const tipo = E.tipo;
    const dens = { urbano_denso: 0.85, residencial: 0.62, parque: 0.25, industrial: 0.45, campo_aberto: 0.1, orla: 0.6, campus: 0.35 }[tipo];
    for (let i = -28; i <= 28; i++) for (let k = -28; k <= 28; k++) {
      const gx = i * Q, gz = k * Q, cg = Math.cos(F.giroBairro), sg = Math.sin(F.giroBairro);
      const cx = gx * cg - gz * sg, cz = gx * sg + gz * cg;
      const d = Math.hypot(cx, cz);
      if (d < R0 || d > R1) continue;
      if (naAgua(cx, cz, 30)) continue;
      // a praça da entrada principal (a grua do plano da fachada passa por ela)
      if (cz > 0 && Math.abs(cx) < 75 && cz < rFach(Math.PI / 2) + 130) continue;
      // o parque: a cidade começa depois de ~420 m
      if (tipo === 'parque' && d < R0 + 200) continue;
      if (r() > dens * (0.6 + 0.4 * clamp((d - R0) / 400, 0, 1))) continue;
      const longe = clamp((d - R0) / 700, 0, 1);
      let lx, lz, h, cor = Math.floor(r() * 16);
      if (tipo === 'industrial' && r() < 0.7) { lx = 24 + r() * 28; lz = 18 + r() * 22; h = 7 + r() * 6; cor = 4; }
      else if (tipo === 'campo_aberto' || (tipo === 'residencial' && r() < 0.55)) { lx = 10 + r() * 8; lz = 9 + r() * 8; h = 4 + r() * 4; }
      else if (tipo === 'urbano_denso') { lx = 16 + r() * 18; lz = 16 + r() * 18; h = 14 + r() * (24 + 50 * longe) + (r() < 0.08 ? 40 : 0); }
      else if (tipo === 'orla' && naAgua(cx, cz, 160)) { lx = 18 + r() * 12; lz = 16 + r() * 10; h = 30 + r() * 50; }
      else if (tipo === 'campus') { lx = 30 + r() * 40; lz = 16 + r() * 16; h = 10 + r() * 18; }
      else { lx = 14 + r() * 14; lz = 13 + r() * 14; h = 9 + r() * (14 + 30 * longe); }
      // dentro da quadra (as ruas de 9 m entre elas ficam livres: render/estadio-generico.js pinta o chão na mesma grade)
      lx = Math.min(lx, Q - 13); lz = Math.min(lz, Q - 13);
      const ox = (r() - 0.5) * (Q - 13 - lx), oz = (r() - 0.5) * (Q - 13 - lz);
      lista.push({ x: cx + ox * cg - oz * sg, z: cz + ox * sg + oz * cg, lx, lz, h, rumo: F.giroBairro, cor });
    }
    _predios = lista;
    return lista;
  }
  /** Árvores: a borda da esplanada, a praça da entrada (lado de cá) e o verde do entorno: [{x, z, h, raio}]. */
  function arvores() {
    if (_arvores) return _arvores;
    const r = gerador(F.semente + 12), lista = [];
    const Mb = rEsplanada - 8;
    // fora da água, da praça da entrada (a grua do plano da fachada: |x| < 62) e da fachada
    const livre = (x, z) => !naAgua(x, z, 6) && !(Math.abs(x) < 62 && z > 0 && z < rFach(Math.PI / 2) + 130) && Math.hypot(x, z) > rMax + 14
      && !estacionamentos().some(e => x > e.x[0] - 3 && x < e.x[1] + 3 && z > e.z[0] - 3 && z < e.z[1] + 3);
    // a fileira de árvores na borda da esplanada (rala na cidade densa e nos galpões)
    const nBorda = { urbano_denso: 40, industrial: 50, orla: 110 }[E.tipo] ?? 160;
    for (let i = 0; i < nBorda; i++) {
      const th = (2 * Math.PI * i) / nBorda + (r() - 0.5) * 0.04, rr = Mb * (0.98 + 0.04 * r());
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (livre(x, z)) lista.push({ x, z, h: 7 + r() * 5, raio: 2.6 + r() * 1.6 });
    }
    const verde = { parque: 260, campus: 130, residencial: 70, campo_aberto: 110, orla: 40, industrial: 25, urbano_denso: 20 }[E.tipo];
    for (let i = 0; i < verde; i++) {
      const th = r() * 2 * Math.PI, rr = rMax + 30 + r() * (E.tipo === 'parque' ? 330 : 120);
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (livre(x, z)) lista.push({ x, z, h: 8 + r() * 7, raio: 3 + r() * 2.5 });
    }
    for (const t of MARCAS_P) if (t.tipo === 'cupula') for (let i = lista.length - 1; i >= 0; i--) if (Math.hypot(lista[i].x - t.x, lista[i].z - t.z) < t.raio + 8) lista.splice(i, 1);
    _arvores = lista;
    return lista;
  }
  /** Torcedores chegando: a praça da entrada (lado de cá) e em volta da fachada: [{x, y, z, time}]. */
  function torcedoresFora() {
    if (_torcedores) return _torcedores;
    const r = gerador(F.semente + 13), lista = [];
    const zF = rFach(Math.PI / 2);
    for (let i = 0; i < 700; i++) {
      const t = Math.pow(r(), 1.7), z = zF + 4 + t * 70, x = (r() - 0.5) * (30 + 70 * t);
      if (Math.abs(x) < 9 && z < zF + 40 && r() < 0.8) continue;   // a lente do plano da fachada
      lista.push({ x, y: 0.06, z, time: r() < 0.08 ? 1 : 0 });
    }
    for (let i = 0; i < 420; i++) {
      const th = r() * 2 * Math.PI, rr = rFach(th) + 4 + r() * 20;
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (z > 0 && Math.abs(x) < 40) continue;
      if (MARCAS_P.some(m => (m.tipo === 'torres' || m.tipo === 'rampas_espiral') && m.torres.some(t => Math.hypot(x - t.x, z - t.z) < t.raio + 3))) continue;
      lista.push({ x, y: 0.06, z, time: x < -60 ? (r() < 0.6 ? 1 : 0) : (r() < 0.05 ? 1 : 0) });
    }
    _torcedores = lista;
    return lista;
  }
  /** Os estacionamentos da esplanada (fora da praça da entrada, das torres e da água): [{x: [x0, x1], z: [z0, z1]}]. */
  let _estac = null, _canteiros = null, _carros = null;
  function estacionamentos() {
    if (_estac) return _estac;
    const out = [], R = rEsplanada - 10, r0 = rMax + 18;
    for (const [sx, sz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
      const x0 = sx > 0 ? r0 * 0.55 : -R + 4, x1 = sx > 0 ? R - 4 : -r0 * 0.55;
      const z0 = sz > 0 ? r0 * 0.75 : -R + 4, z1 = sz > 0 ? R - 4 : -r0 * 0.75;
      const e = { x: [Math.min(x0, x1), Math.max(x0, x1)], z: [Math.min(z0, z1), Math.max(z0, z1)] };
      // só o pedaço fora da fachada (o canto da esplanada)
      e.x = sx > 0 ? [Math.max(e.x[0], Math.abs(e.x[1]) - 70), e.x[1]] : [e.x[0], Math.min(e.x[1], e.x[0] + 70)];
      e.z = sz > 0 ? [Math.max(e.z[0], e.z[1] - 55), e.z[1]] : [e.z[0], Math.min(e.z[1], e.z[0] + 55)];
      const cx = (e.x[0] + e.x[1]) / 2, cz = (e.z[0] + e.z[1]) / 2;
      if (Math.hypot(cx, cz) < r0 + 30 || naAgua(cx, cz, 20)) continue;
      out.push(e);
    }
    _estac = out;
    return out;
  }
  /** Os canteiros redondos de grama na esplanada: [{x, z, r}]. */
  function canteiros() {
    if (_canteiros) return _canteiros;
    const r = gerador(F.semente + 15), out = [];
    for (let i = 0; i < 18; i++) {
      const th = r() * 2 * Math.PI, rr = rMax + 22 + r() * (rEsplanada - rMax - 40);
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (z > 0 && Math.abs(x) < 40) continue;
      if (estacionamentos().some(e => x > e.x[0] - 8 && x < e.x[1] + 8 && z > e.z[0] - 8 && z < e.z[1] + 8)) continue;
      out.push({ x, z, r: 6 + r() * 8 });
    }
    _canteiros = out;
    return out;
  }
  /** Carros nos estacionamentos: [{x, z, rumo, cor}]. */
  function carros() {
    if (_carros) return _carros;
    const r = gerador(F.semente + 16), lista = [];
    for (const e of estacionamentos()) for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) for (let x = e.x[0] + 2; x < e.x[1] - 2; x += 2.7) {
      if (r() < 0.55) continue;
      lista.push({ x, z: z + 2.4 + (r() - 0.5) * 0.3, rumo: Math.PI / 2 + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.08, cor: Math.floor(r() * 8) });
    }
    _carros = lista;
    return lista;
  }
  /** Os morros/montanhas do horizonte: [{th (centro), larg (rad), alto, dist}] (o desenho faz o recorte). */
  function relevo() {
    if (E.relevo === 'plano') return [];
    const r = gerador(F.semente + 14), out = [];
    const n = E.relevo === 'montanhas' ? 9 : 12;
    for (let i = 0; i < n; i++) {
      out.push({ th: -Math.PI + ((i + r()) * 2 * Math.PI) / n, larg: 0.35 + r() * 0.5, alto: E.relevo === 'montanhas' ? 220 + r() * 520 : 40 + r() * 110, dist: E.relevo === 'montanhas' ? 2300 + r() * 900 : 1250 + r() * 500 });
    }
    return out;
  }

  // ---------------------------------------------------------------- festa (faixas, bandeiras, bandeirões, sinalizadores)
  /** Ponto no degrau: ângulo polar th e d m da 1ª fileira para dentro → {x, y, z, nx, nz (para o campo), ex, ez, s}. */
  function noDegrau(th, d) {
    const a = rF(th), b = rB(th), s = clamp(d / Math.max(1e-6, b - a), 0, 1);
    const [x, z] = ponto(th, s);
    const nx = -Math.cos(th), nz = -Math.sin(th);
    return { x, y: perfil(s, th), z, nx, nz, ex: -nz, ez: nx, s };
  }
  /** O ângulo polar da 1ª fileira com esta coordenada x no lado de lá (z < 0). */
  function thLadoDeLa(x) { let lo = -Math.PI + 0.01, hi = -0.01; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rF(m) * Math.cos(m) > x) hi = m; else lo = m; } return (lo + hi) / 2; }
  /** O ângulo polar da 1ª fileira com esta coordenada z no fundo (s = +1 → x > 0). */
  function thFundo(sx, z) {
    const R = sx > 0 ? m => rF(m) : m => rF(Math.PI - m);
    let lo = -Math.PI / 2 + 0.01, hi = Math.PI / 2 - 0.01;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (R(m) * Math.sin(m) < z) lo = m; else hi = m; }
    const t = (lo + hi) / 2; return sx > 0 ? t : Math.PI - t;
  }
  // os trechos com arquibancada de cada setor na mureta (o meio reto): lado de lá |x| ≤ LIM, fundos |z| ≤ LIMF
  const LIM = Math.min(abertos ? XP - 2 : CAMPO.meioX - 4, CAMPO.meioX - 4), LIMF = Math.min(abertos ? ZP - 2 : CAMPO.meioZ - 6, CAMPO.meioZ - 6);
  const temLado = k => LD[k].prof > 0;
  /** Faixas na mureta: as mesmas 12 (textos e ordem de bandeiras-dados.js), nos trechos retos da 1ª fileira. */
  function faixas(lista) {
    const la = lista.map((f, i) => ({ f, i })).filter(o => o.f.setor === 0).sort((p, q2) => p.f.centro - q2.f.centro);
    const KL = 0.9, VAO = 1.2, centros = new Map();
    const LIMx = LIM - 1;
    if (dividida) {
      const VIS = new Set([0, 1, 4, 7]), MEIO = 2.5;
      for (const [sx, g] of [[-1, la.filter(o => VIS.has(o.i)).reverse()], [1, la.filter(o => !VIS.has(o.i))]]) {
        const k = Math.min(KL, (LIMx - MEIO - VAO * (g.length - 1)) / (g.reduce((s2, o) => s2 + o.f.larg, 0) || 1));
        let x = MEIO;
        for (const o of g) { const l = o.f.larg * k; centros.set(o.i, [sx * (x + l / 2), l]); x += l + VAO; }
      }
    } else {
      const tot = la.reduce((s2, o) => s2 + o.f.larg * KL, 0) + VAO * (la.length - 1);
      const k = Math.min(1, (2 * LIMx) / (tot || 1));
      let x = -(tot * k) / 2;
      for (const o of la) { const l = o.f.larg * KL * k; centros.set(o.i, [x + l / 2, l]); x += l + VAO * k; }
    }
    const zF = xx => { const th = thLadoDeLa(xx); return rF(th) * Math.sin(th); };
    return lista.map((f, i) => {
      if (f.setor === 0) {
        const [c, l] = centros.get(i);
        return { ...f, centro: c, larg: l, z: Math.max(zF(c), zF(c - l / 2), zF(c + l / 2)) };
      }
      const s = f.setor === 1 ? 1 : -1;
      // os fundos: a faixa cabe no trecho com arquibancada (|z| ≤ LIMF)
      const larg = Math.min(f.larg, 2 * LIMF - 2), centro = clamp(f.centro, -LIMF + larg / 2, LIMF - larg / 2);
      const xa = rF(thFundo(s, centro - larg / 2)) * Math.abs(Math.cos(thFundo(s, centro - larg / 2))), xb = rF(thFundo(s, centro + larg / 2)) * Math.abs(Math.cos(thFundo(s, centro + larg / 2)));
      return { ...f, centro, larg, x: s * Math.min(xa, xb) };
    });
  }
  /** Bandeiras de mastro: a mão do torcedor nas fileiras da frente do lado de lá e da organizada (fundo +x). */
  function bandeiras(n, mao) {
    const r = gerador(20261012), lista = [];
    const temOrg = temLado(1), temLa = temLado(0);
    // 1ª passada: a do Maracanã (o lado de lá e a organizada, 4 m entre elas); depois, nos estádios pequenos, mais
    // juntas e em qualquer arquibancada (bandeiras.js lê sempre as n)
    const passes = [[4, false], [2.6, false], [2.6, true], [1.4, true]];
    for (const [dist, todos] of passes) {
      const longe = (x, z) => lista.every(b => Math.hypot(b.x - x, b.z - z) >= dist);
      for (let t = 0; lista.length < n && t < 5000; t++) {
        let th, org = false;
        const d = Math.floor(r() * (dividida ? 9 : 6)) * 0.8 + 0.4;
        if (todos) th = -Math.PI + r() * 2 * Math.PI;
        else {
          if (!temOrg && !temLa) break;
          org = temOrg && (!temLa || r() < (dividida ? 0.42 : 0.3));
          th = org ? thFundo(1, (-LIMF + 2) + (2 * LIMF - 4) * r()) : thLadoDeLa(dividida ? 5 + (LIM - 8) * r() : -LIM + 4 + (2 * LIM - 8) * r());
        }
        const p = noDegrau(th, org ? (1 + Math.floor(r() * 7)) * 0.8 + 0.4 : d);
        if (rB(th) - rF(th) < 4 || !temArquibancada(p.x, p.z) || !longe(p.x, p.z)) continue;
        if (p.z > 0 && Math.abs(p.x) < T.largura / 2 + 1) continue;
        lista.push({ x: p.x, y: p.y + mao, z: p.z, ex: p.ex, ez: p.ez, nx: p.nx, nz: p.nz, desenho: Math.floor(r() * 4) % 4, fase: r() * 2 * Math.PI, org });
      }
      if (lista.length >= n) break;
    }
    while (lista.length < n && lista.length) { const b = lista[lista.length % Math.max(1, lista.length)]; lista.push({ ...b, x: b.x + 0.6, fase: b.fase + 1 }); }
    return lista;
  }
  /** Bandeirões (o do lado de lá e o da organizada) pela rampa do anel de baixo, no formato de bandeiras-dados.js. */
  function bandeiroes(altura) {
    const out = [];
    const rampa = (th, prof, larg, nome, slot, eixoU) => {
      const p0 = noDegrau(th, 0.4), p1 = noDegrau(th, 0.4 + prof);
      const V = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], L = Math.hypot(...V);
      const Vn = V.map(v => v / L);
      const U = eixoU;
      let N = [U[1] * Vn[2] - U[2] * Vn[1], U[2] * Vn[0] - U[0] * Vn[2], U[0] * Vn[1] - U[1] * Vn[0]];
      if (N[1] < 0) N = N.map(v => -v);
      const ln = Math.hypot(...N); N = N.map(v => v / ln);
      const A = [p0.x - U[0] * larg / 2, p0.y, p0.z - U[2] * larg / 2].map((v, i) => v + N[i] * altura);
      const b = { nome, A, U: U.map(v => v * larg), V: Vn.map(v => v * prof), N, larg, prof, slot };
      // a mureta encurva: o pano sobe o que for preciso para nenhuma cabeça furar
      let sobe = 0;
      (_lugares ?? (_lugares = gerarLugares())).iterar((st, f, a, x, y, z, esc) => {
        const dd = [x - b.A[0], y - b.A[1], z - b.A[2]];
        const lu = (dd[0] * b.U[0] + dd[1] * b.U[1] + dd[2] * b.U[2]) / (b.larg * b.larg), lv = (dd[0] * b.V[0] + dd[1] * b.V[1] + dd[2] * b.V[2]) / (b.prof * b.prof);
        if (lu < 0 || lu > 1 || lv < 0 || lv > 1) return;
        sobe = Math.max(sobe, dd[0] * b.N[0] + (dd[1] + 2.2 * esc) * b.N[1] + dd[2] * b.N[2]);
      });
      b.A = b.A.map((v, i) => v + b.N[i] * sobe);
      out.push(b);
    };
    const profLa = Math.min(10, LD[0].prof * 0.45), profOrg = Math.min(14, LD[1].prof * 0.5);
    if (temLado(0) && profLa >= 4) rampa(dividida ? thLadoDeLa(Math.min(29, LIM - 18)) : -Math.PI / 2, profLa, Math.min(dividida ? 34 : 40, 2 * LIM - 6), 'lado', 0, [1, 0, 0]);
    if (temLado(1) && profOrg >= 4) rampa(0, profOrg, Math.min(24, 2 * LIMF - 4), 'organizada', 1, [0, 0, 1]);
    return out;
  }
  /** Os pontos dos sinalizadores (a base do torcedor): organizada, quinas do lado de lá e setor visitante. */
  function sinalizadores() {
    const pz = LIMF - 2, px = LIM - 4;
    const org = [[-0.7, 2.6], [-0.25, 3.4], [0.3, 2.0], [0.75, 4.0], [-0.95, 3.0], [0.5, 3.6]].map(([z, d]) => noDegrau(thFundo(1, z * pz), d));
    const quinas = [[-0.95, 2.6], [0.95, 3.2], [-0.72, 2.0], [0.74, 2.8], [-1, 3.6], [1, 2.6]].map(([x, d]) => noDegrau(thLadoDeLa(x * px), d));
    const visit = [[-0.4, 2.6], [0.3, 3.2]].map(([z, d]) => noDegrau(thFundo(-1, z * pz), d));
    const xyz = p => [p.x, p.y, p.z];
    return { organizada: org.map(xyz), quinas: quinas.map(xyz), visitante: visit.map(xyz) };
  }

  // ---------------------------------------------------------------- pré-jogo: os planos que dependem do estádio
  const K = rMax / 95;      // quanto maior que o Estádio Golaço
  /** Um ponto acima do degrau do lado k (s da profundidade, h m acima do degrau e debaixo da cobertura). */
  function acima(th, s, h) {
    const [x, z] = ponto(th, s), y = perfil(s, th) + h;
    const yc = alturaCobEm(x, z);
    return [x, yc != null ? Math.min(y, yc - 3.2) : y, z];
  }
  const thCa = Math.PI / 2, thLa = -Math.PI / 2;
  const zFach = rFach(thCa), yF = yFach(thCa);
  const temCa = LD[3].prof > 0, temLaL = LD[0].prof > 0;
  const dentroDe = temCa ? [acima(Math.atan2(0.62, -0.5), 0.55, 4.5), acima(Math.atan2(0.62, -0.32), 0.55, 4.5), acima(Math.atan2(0.62, -0.16), 0.55, 4.4)] : [[-46, 23, 64], [-33, 23, 63.5], [-20, 23, 63]];
  const geralDe = temCa ? [acima(Math.atan2(1, -0.08), 0.6, 6), acima(Math.atan2(1, 0.08), 0.6, 6)] : [[-8, 24.5, 64], [8, 24.5, 64]];
  const altoDe = temLaL ? [acima(Math.atan2(-1, -0.1), 0.35, 4), acima(Math.atan2(-1, 0.1), 0.35, 4)] : [[-6, 21, -50], [6, 20, -50]];
  const PLANOS = {
    aereo: { orbita: { centro: [0, 0], olhar: [0, 10, 0], raio: [300 * K, 238 * K], altura: [140 * K, 96 * K], ang: [38, 62], fov: 38 } },
    // a grua da praça da entrada (o lado de cá): de longe e baixo, subindo para a fachada
    fachada: { cam: { de: [[-52, 1.8, zFach + 80], [-36, 4.5, zFach + 66], [-20, 8, zFach + 54]], para: [[0, yF * 0.45, zFach], [0, yF * 0.52, zFach - 1], [0, yF * 0.6, zFach - 2]], fov: [50, 42], suave: 0.7 } },
    dentro: { cam: { de: dentroDe, para: [[-6, 4, -22], [0, 4, -22], [6, 4, -22]], fov: [52, 50], suave: 0.5 } },
    alto: { cam: { de: altoDe, para: [[0, 0.5, 7], [0, 0.5, 5.5]], fov: [26, 25], suave: 0.5 } },
    organizada: { cam: { de: [[Fr.fa - 22, 3.0, -20], [Fr.fa - 22, 3.4, -16]], para: temLado(1) ? [acima(0.02 - 0.2, 0.25, 1.5), acima(0.02, 0.25, 1.5)] : [[70, 8, -2], [70, 8.5, 2]], fov: [40, 40], suave: 0.3 } },
    ladoDeLa: { cam: { de: [[-6, 2.2, -Fr.la + 7], [2, 2.2, -Fr.la + 7]], para: temLaL ? [acima(Math.atan2(-1, -0.12), 0.22, 1.5), acima(Math.atan2(-1, 0.06), 0.22, 1.5)] : [[-12, 9, -56], [4, 9, -56]], fov: [30, 30], suave: 0.2 } },
    visitantes: { cam: { de: [[-Fr.fb + 20, 2.5, 18], [-Fr.fb + 20, 2.8, 14]], para: temLado(2) ? [acima(Math.PI - 0.05, 0.25, 1.5), acima(Math.PI + 0.05, 0.25, 1.5)] : [[-70, 7, 0], [-70, 7, -4]], fov: [38, 38], suave: 0.3 } },
    geral: { cam: { de: geralDe, para: [[0, 0, -12], [0, 0, -12]], fov: [54, 54], suave: 0.3 } },
  };
  /** Troca, no lugar, a câmera dos planos que dependem do estádio (prejogo-roteiro.js criarRoteiro chama antes das curvas). */
  function ajustarPlano(p) {
    const q = PLANOS[p.id];
    if (q && q.cam) p.cam = { ...p.cam, ...q.cam };
    if (q && q.orbita) p.orbita = { ...q.orbita };
    if (p.orbitaComum) p.orbita = orbitaEsc ?? (orbitaEsc = { ...p.orbita, raio: [Math.min(58, Fr.la + 8), Math.min(58, Fr.la + 8)], altura: [22, 22] });
  }
  let orbitaEsc = null;
  // ninguém sentado a menos de 3,5 m das lentes dos planos de dentro
  function PLANOS_LENTES() {
    const pts = [...dentroDe, ...geralDe, ...altoDe];
    return (x, y, z) => pts.some(p => Math.hypot(x - p[0], y - p[1], z - p[2]) < 3.5);
  }
  /** A câmera da abertura ("Toque para começar"), mais longe e mais alta na mesma proporção do estádio. */
  function ajustarAbertura(c) { const k = Math.max(1, K); c.px *= k; c.pz *= k; c.py *= Math.max(1, K * 0.9); c.ly = 6; return c; }
  const cameraGeral = (() => {
    if (!temCa) return { de: [0, 34, 78], para: [0, 3, -16], fov: 31 };
    const p = acima(Math.PI / 2, 0.7, 7);
    return { de: p, para: [0, 3, -16], fov: clamp(40 * 78 / Math.max(50, p[2]), 30, 44) };
  })();

  return {
    forma: F, familia: F.familia, generica: true,
    rF, rB, rFach, yFach, casca, perfilCasca, ponto, sDe, perfil, perfilLado, tipoEm, nos: NOS, sAneis, setor, psi, thDivisa, pesos, ladoEm,
    temArquibancada, trechos, uDe, XP, ZP, abertos, yTopo, topoLado, cobEm, alturaCobEm, cobContinua, luzDoSol,
    get lugares() { return _lugares ?? (_lugares = gerarLugares()); },
    solido, cameraNoLadoDeCa, noDegrau, torres: TORRES, marcas: MARCAS_P,
    predios, arvores, torcedoresFora, agua, naAgua, relevo, rEsplanada, rMax, yMax, estacionamentos, canteiros, carros, uTh: arcoMeio,
    faixas, bandeiras, bandeiroes, sinalizadores,
    ajustarPlano, ajustarAbertura, escala: K, planos: PLANOS, cameraGeral,
  };
}
