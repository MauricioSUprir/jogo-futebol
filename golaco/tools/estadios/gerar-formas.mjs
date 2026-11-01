// A pesquisa da forma de cada estádio (tools/estadios/pesquisa-forma-*.json: o que os agentes acharam — tipo, planta,
// cantos, as 4 arquibancadas, cobertura, fachada, cadeiras, marcas próprias, entorno, fontes) → a `forma` genérica de
// js/estadio-generico.js em assets/tm/estadios.json. As cores em palavras viram hex; as marcas 'outro' pela descrição
// (pele de LED, arco, torres, mastros, telão, cúpula); a pista de atletismo e as estruturas pela cor das notas. O
// Maracanã (forma própria em estadio-planta.js, entorno 'maracana') não é tocado. Ajustes à mão por estádio em
// tools/estadios/ajustes-forma.json ({chave: {campo: valor}}, aplicados por cima no fim).
// Item 69, PR 4 (a mesma fonte para as cadeiras): depois das formas, os campos de cadeira da base (cadeiras_cor,
// cadeiras_cor2, cadeiras_padrao) saem da forma que o jogo desenha (a revista contra as fotos: a cadeira 3D = a textura =
// a base); o homônimo da MESMA cidade ganha a forma da entrada principal (o jogo acha o homônimo pelo clube); nos sem
// forma, o 'liso' com uma 2ª cor diferente vira 'misto' (o liso não desenha a 2ª cor).
//   node tools/estadios/gerar-formas.mjs [--pesquisa a.json,b.json] [--saida <estadios.json>] [--so chave1,chave2] [--seco]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pesq = (arg('--pesquisa', null)?.split(',') ?? fs.readdirSync(AQUI).filter(f => /^pesquisa-forma-.*\.json$/.test(f)).map(f => path.join(AQUI, f)));
const SAIDA = path.resolve(arg('--saida', path.join(RAIZ, 'assets', 'tm', 'estadios.json')));
const SO = arg('--so', null)?.split(',') ?? null;
const SECO = args.includes('--seco');

const CORES = [
  [/vermelho.?tijolo|tartan|terracota|cor de tijolo/, '#a9472f'], [/grená|grena|bordô|bordo|vinho/, '#7b1f2a'], [/vermelh|encarnad|rubro/, '#c8102e'], [/laranja/, '#ef7d1a'],
  [/amarel|dourad|ouro/, '#fde100'], [/verde/, '#1f7a3a'], [/azul.?escur|azul.?marinho|marinho/, '#1f3557'],
  [/celeste|azul.?claro/, '#6cace4'], [/azul/, '#1d4f91'], [/roxo|violeta|lilás/, '#5b2a86'], [/rosa/, '#e75480'],
  [/pret|negr/, '#1c1c1c'], [/prata|prateado/, '#c9cdd0'], [/cinza.?escur|grafite|chumbo/, '#4a5056'],
  [/cinza/, '#8c9096'], [/bege|areia|creme/, '#d8cfb9'], [/marrom|tijolo/, '#8b3a2e'], [/branc/, '#f2f2f0'],
];
const hex = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toLowerCase() : null);
/** A 1ª cor (hex no texto ou palavra) de um texto livre; null sem cor. */
function corDoTexto(t) {
  if (!t || typeof t !== 'string') return null;
  const h = t.match(/#[0-9a-f]{6}/i);
  if (h) return h[0].toLowerCase();
  const s = t.toLowerCase();
  let melhor = null, pos = Infinity;
  for (const [re, c] of CORES) { const m = s.match(re); if (m && m.index < pos) { pos = m.index; melhor = c; } }
  return melhor;
}
const LADO = { principal: 'ca', oposta: 'la', fundo_a: 'fa', fundo_b: 'fb' };
/** O lado do jogo pela posição em texto (só o que dá para saber sem a orientação: principal, oposta, fundo). */
function ladoDoTexto(t) {
  const s = String(t || '').toLowerCase();
  if (/oposta|em frente à principal|frente a tribuna/.test(s)) return 'la';
  if (/principal|tribuna de honra|cabines/.test(s)) return 'ca';
  if (/fundo|cabeceira|atrás do gol|atrás de um dos gols|gol norte|gol sul|end\b/.test(s)) return 'fa';
  return null;
}
/** A marca própria do jogo a partir da da pesquisa (tipo + descrição + posição). */
function marcaDoJogo(m, e) {
  const d = `${m.descricao ?? ''} ${m.posicao ?? ''}`.toLowerCase();
  let tipo = m.tipo;
  if (tipo === 'outro') {
    if (/(pele|almofada|etfe|fachada).*(acende|led|ilumin)|(acende|led|ilumin).*(pele|almofada|fachada)/.test(d)) tipo = 'pele_led';
    else if (/\barco/.test(d)) tipo = 'arco';
    else if (/espiral|helicoid/.test(d)) tipo = 'rampas_espiral';
    else if (/pilone|mastro|torre de sustenta/.test(d)) tipo = 'mastros';
    else if (/cúpula|cupula|domo|ginásio|ginasio|arena coberta/.test(d)) tipo = 'cupula';
    else if (/telão|telao|placar eletr/.test(d)) tipo = 'telao';
    else if (/estátua|estatua|monumento/.test(d)) tipo = 'estatua';
    else return null;
  }
  if (tipo === 'letreiro' || tipo === 'relogio') return null;   // o nome vai na placa; o relógio não aparece de longe
  const out = { tipo };
  const lado = ladoDoTexto(m.posicao) ?? ladoDoTexto(m.descricao);
  if (lado) out.lado = lado;
  const c = corDoTexto(m.descricao);
  if (c) out.cor = c;
  const n = d.match(/(\d+)\s*(torres|pilones|mastros|telões|teloes|arcos)/);
  if (n) out.n = Number(n[1]);
  const alto = d.match(/(\d{2,3})\s*m\b/);
  if (alto && (tipo === 'arco' || tipo === 'mastros' || tipo === 'torres' || tipo === 'rampas_espiral')) out.alto = Number(alto[1]);
  // as torres de refletor (Morumbi: "estruturas metálicas com os refletores") viram torres de luz, não torres de concreto
  if (tipo === 'torres' && /refletor|ilumina/.test(d)) out.tipo = 'torres_luz';
  void e;
  return out;
}
const REGIOES = {
  br: ['Brazil'], latam: ['Mexico', 'Uruguay', 'Argentina', 'Ecuador', 'Colombia', 'Chile', 'Peru', 'Paraguay', 'Bolivia', 'Venezuela', 'Costa Rica'],
  eu_norte: ['Germany', 'England', 'Netherlands', 'Russia', 'Scotland', 'Belgium', 'Austria', 'Switzerland', 'Denmark', 'Sweden', 'Norway', 'Poland', 'Ukraine', 'Czech Republic', 'Wales', 'Ireland'],
  eu_sul: ['Spain', 'Portugal', 'France', 'Italy', 'Turkey', 'Greece', 'Croatia', 'Serbia'],
  mena: ['Saudi Arabia', 'Morocco', 'Qatar', 'Egypt', 'United Arab Emirates', 'Algeria', 'Tunisia', 'Iran'],
  asia: ['Japan', 'South Korea', 'China', 'India', 'Australia'], na: ['United States', 'USA', 'Canada'],
};
/** A região das cores do entorno pelo país (o da base; sem ele, Brasil). */
export function regiaoDoPais(p) { for (const [k, l] of Object.entries(REGIOES)) if (l.includes(p)) return k; return 'br'; }
/** A forma do jogo a partir de um estádio da pesquisa. */
export function formaDaPesquisa(e) {
  const lados = {};
  for (const a of e.arquibancadas ?? []) {
    const k = LADO[a.lado];
    if (!k) continue;
    lados[k] = [Math.round(a.profundidade_m ?? 0), Math.round((a.altura_m ?? 0) * 10) / 10, Math.max(1, Math.min(3, Math.round(a.aneis ?? 1))), a.coberta ? 1 : 0, a.camarotes ? 1 : 0];
  }
  // lado que faltou: o espelho (oposta ↔ principal, um fundo ↔ o outro)
  const par = { la: 'ca', ca: 'la', fa: 'fb', fb: 'fa' };
  for (const k of ['la', 'ca', 'fa', 'fb']) if (!lados[k] && lados[par[k]]) lados[k] = lados[par[k]].slice();
  const C = e.cobertura ?? {};
  const notas = `${C.notas ?? ''}`.toLowerCase();
  const corEstr = /treliça|treliças|vigas|arcos?/.test(notas) ? corDoTexto(notas.match(/(treliça|treliças|vigas|arcos?)[^.;]*/)?.[0]) : null;
  const marcas = (e.marcas_proprias ?? []).map(m => marcaDoJogo(m, e)).filter(Boolean);
  // a cor do arco da sustentação (Estádio da Luz: os 4 arcos vermelhos)
  const arco = marcas.find(m => m.tipo === 'arco');
  if (C.sustentacao === 'arco' && arco) { marcas.splice(marcas.indexOf(arco), 1); }
  const pistaTxt = (e.marcas_proprias ?? []).map(m => `${m.descricao}`).join(' ').toLowerCase();
  const pistaCor = /pista/.test(pistaTxt) ? corDoTexto(pistaTxt.match(/pista[^.;|]*/)?.[0]) : null;
  const F = e.fachada ?? {}, K = e.cadeiras ?? {}, E = e.entorno ?? {};
  const led = hex(F.led) ?? (F.led && /acende|led|ilumin|rgb/i.test(F.led) && !/^\s*$/.test(F.led) ? corDoTexto(F.led) ?? null : null);
  const forma = {
    familia: e.tipo === 'pista' || e.pista_atletismo ? (e.tipo === 'pequeno' ? 'pequeno' : 'pista') : e.tipo,
    planta: e.planta, cantos: e.cantos === 'nao_se_aplica' ? undefined : e.cantos,
    pista: !!e.pista_atletismo,
    // na pista o recuo da planta é a folga DEPOIS da raia 8 (a pesquisa mede da linha lateral: a raia 8 termina a ~12,3 m)
    recuo: [e.recuo_m?.lateral == null ? null : (e.tipo === 'pista' || e.pista_atletismo ? Math.max(1.5, e.recuo_m.lateral - 12.3) : e.recuo_m.lateral), e.recuo_m?.fundo ?? null],
    lados,
    cob: { tipo: C.tipo, mat: C.material, cor: hex(C.cor) ?? corDoTexto(C.cor), sust: C.sustentacao, alto: C.altura_m || null, estr: corEstr ?? (C.sustentacao === 'arco' ? arco?.cor ?? null : null) },
    fach: { estilo: F.estilo, cor: hex(F.cor), cor2: hex(F.cor2), led },
    cad: (K.cores ?? []).map(hex).filter(Boolean),
    padrao: K.padrao,
    marcas,
    entorno: { tipo: E.tipo, relevo: E.relevo, agua: E.agua },
    capacidade: e.capacidade,
    orientacao: Number.isFinite(e.orientacao_graus) ? e.orientacao_graus : null,
    letreiro: e.nome_oficial,
  };
  if (pistaCor) forma.pistaCor = pistaCor;
  // o piso em volta do gramado sem pista de atletismo (a antiga pista pintada do Morumbi, o tartan, o concreto colorido)
  const pisoTxt = pistaTxt.match(/(faixa|piso|antiga pista|pista)[^.;|]*(em volta|ao redor|entre o campo)[^.;|]*/)?.[0] ?? null;
  if (!forma.pista && pisoTxt) { const c = corDoTexto(pisoTxt); if (c) forma.piso = c; }
  if (!forma.cantos) delete forma.cantos;
  return forma;
}

/**
 * A mesma fonte para as cadeiras (item 69, PR 4): os campos de cadeira da base pela forma desenhada; o homônimo da mesma
 * cidade com a forma da principal; o 'liso' com 2ª cor dos sem forma vira 'misto'. Devolve quantos mudaram.
 */
export async function sincronizarCadeiras(base) {
  const GE = await import(pathToFileURL(path.join(RAIZ, 'js', 'estadio-generico.js')).href);
  const PL = await import(pathToFileURL(path.join(RAIZ, 'js', 'estadio-planta.js')).href);
  let n = 0;
  const poe = (ent, k, v) => { if ((ent[k] ?? null) !== v) { ent[k] = v; n++; } };
  const campos = (ent, forma) => {
    if (forma.entorno === 'maracana') {
      // o Maracanã: as cores da textura aprovada nas rodadas da prévia (o padrão dele, 'tigela-maracana', é um misto)
      const cs = PL.validarForma(forma).cadeiras;
      poe(ent, 'cadeiras_cor', cs[0]); poe(ent, 'cadeiras_cor2', cs[1] ?? null); poe(ent, 'cadeiras_padrao', 'misto');
      return;
    }
    const F = GE.validarFormaGenerica(forma);
    if (!F) return;
    poe(ent, 'cadeiras_cor', F.cadeiras[0]); poe(ent, 'cadeiras_cor2', F.cadeiras[1] ?? null); poe(ent, 'cadeiras_padrao', F.padrao);
  };
  for (const ent of Object.values(base.estadios)) {
    if (ent.forma && typeof ent.forma === 'object') { campos(ent, ent.forma); continue; }
    const c2 = hex(ent.cadeiras_cor2), c1 = hex(ent.cadeiras_cor);
    if ((ent.cadeiras_padrao ?? 'liso') === 'liso' && c2 && c2 !== c1) poe(ent, 'cadeiras_padrao', 'misto');
  }
  for (const [k, l] of Object.entries(base.homonimos ?? {})) {
    const t = base.estadios[k];
    if (!t || !t.forma) continue;
    for (const h of l) {
      if (h.cidade !== t.cidade) continue;
      if (JSON.stringify(h.forma ?? null) !== JSON.stringify(t.forma)) { h.forma = JSON.parse(JSON.stringify(t.forma)); n++; }
      campos(h, h.forma);
    }
  }
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = JSON.parse(fs.readFileSync(SAIDA, 'utf8'));
  const ajustes = fs.existsSync(path.join(AQUI, 'ajustes-forma.json')) ? JSON.parse(fs.readFileSync(path.join(AQUI, 'ajustes-forma.json'), 'utf8')) : {};
  const lista = pesq.flatMap(p => { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return Array.isArray(j) ? j : j.estadios ?? []; });
  let n = 0;
  const faltou = [];
  for (const e of lista) {
    if (SO && !SO.includes(e.chave)) continue;
    const ent = base.estadios[e.chave];
    if (!ent) { faltou.push(e.chave); continue; }
    if (ent.forma && ent.forma.entorno === 'maracana') continue;
    const forma = formaDaPesquisa(e);
    const aj = ajustes[e.chave];
    if (aj) for (const [k, v] of Object.entries(aj)) forma[k] = v && typeof v === 'object' && !Array.isArray(v) && forma[k] && typeof forma[k] === 'object' ? { ...forma[k], ...v } : v;
    // a região (as cores das casas e dos telhados em volta): pelo país do estádio
    if (!forma.regiao) forma.regiao = regiaoDoPais(ent.pais);
    ent.forma = forma;
    // a capacidade pesquisada corrige a da base (a do TM pode estar errada)
    if (Number.isFinite(e.capacidade) && e.capacidade > 1000) ent.capacidade = e.capacidade;
    n++;
  }
  await sincronizarCadeiras(base);
  if (!SECO) fs.writeFileSync(SAIDA, JSON.stringify(base));
  console.log(`${n} formas ${SECO ? '(seco: nada gravado)' : 'gravadas em ' + SAIDA}${faltou.length ? `; fora da base: ${faltou.join(', ')}` : ''}`);
}
