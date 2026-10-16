// Identidade visual da partida na PÁGINA (DOM): lê o pedido do Total Match (ponte-tm.js), monta a identidade
// (identidade.js, pura) e DECODIFICA os escudos antes de criarCampo/criarTorcida — os canvas das placas, das bandeiras,
// dos bandeirões e da fachada são desenhados uma vez só, e um escudo que chegasse depois sairia em branco. Tempo limite
// ESPERA_ESCUDO_MS (os dois em paralelo); o escudo que não carregou (endereço quebrado, sem rede, outra origem sem
// CORS) vira o de reserva — a sigla num escudo nas cores do time (identidade.js urlEscudoSigla).
// Estádio (15/10): na pro sem jogo neutro a base assets/tm/estadios.json vem junto (≤ ESPERA_BASE_MS; sem ela, o Estádio
// Total Match) e, com o estádio achado, render/fachada-estilos.js; no genérico, o símbolo do TM vai para a placa.
// Sem ?tm: null na hora (os desenhos de hoje) e identidade.js nem é baixado (import dinâmico: o download inicial não
// cresce — tools/teste-carga.mjs, ≤ 4 MB).
import { PEDIDO_TM } from '../ponte-tm.js';
import { mascaraGolaco, mascaraTexto } from './texturas.js';

export const ESPERA_ESCUDO_MS = 1500;
const ESPERA_BASE_MS = 2500;
const urlTm = f => new URL('../../assets/tm/' + f, import.meta.url).href;
let modulo = null;   // identidade.js, depois de carregado (só com ?tm)

/** Carrega e decodifica uma imagem (null se falhar ou passar do tempo). */
function carregar(url, ms) {
  return new Promise(resolver => {
    if (!url) { resolver(null); return; }
    const img = new Image();
    // outra origem: pede com CORS (sem ele o canvas "suja" e a textura não sobe para a GPU); data: e a mesma origem não
    try { const u = new URL(url, location.href); if (u.protocol !== 'data:' && u.origin !== location.origin) img.crossOrigin = 'anonymous'; } catch (_) { /* endereço estranho: tenta assim mesmo */ }
    let feito = false, tempo = 0;
    const fim = ok => {
      if (feito) return;
      feito = true; clearTimeout(tempo);
      resolver(ok && (img.naturalWidth || img.width) > 0 ? img : null);
    };
    tempo = setTimeout(() => fim(false), ms);
    img.onerror = () => fim(false);
    img.onload = () => { if (!img.decode) fim(true); };
    img.src = url;
    if (img.decode) img.decode().then(() => fim(true), () => fim(false));
  });
}

/** A base dos estádios (só na pro sem jogo neutro); null se falhar ou passar do tempo (o formato: identidade.js). */
function carregarBase(p) {
  if (!p || p.edicao !== 'pro' || p.partida?.neutro) return null;
  const ctl = new AbortController(), tempo = setTimeout(() => ctl.abort(), ESPERA_BASE_MS);
  return fetch(urlTm('estadios.json'), { signal: ctl.signal }).then(r => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(tempo));
}

/**
 * A identidade da partida desta página: null sem ?tm (os desenhos de hoje) ou a do pedido do TM com os escudos já
 * decodificados (`times[t].escudo.img`; `escudo.url` passa a ser a do escudo de reserva se o do TM não carregou), e
 * `estilos` (estádio real) ou `estadio.simboloImg`.
 */
export async function identidadeDaPagina(pedido = PEDIDO_TM) {
  if (!pedido) return null;
  let ident;
  try {
    const [mod, base] = await Promise.all([import('../identidade.js'), carregarBase(pedido)]);
    modulo = mod;
    ident = modulo.identidadeDoPedido(pedido, base);
  } catch (e) { console.warn('identidade do Total Match:', e); return null; }
  const t0 = performance.now();
  // estádio real: o desenho dele (falhou = o Estádio Golaço nas cores dele); senão o símbolo do TM na placa
  const est = ident.estadio.real
    ? import('./fachada-estilos.js').then(m => { ident.estilos = m; ident.arquibancada.corCadeira = m.corCadeiraReal; }, e => console.warn('estádio:', e))
    : carregar(urlTm('simbolo.png'), ESPERA_ESCUDO_MS).then(img => { ident.estadio.simboloImg = img; });
  await Promise.all(ident.times.map(async T => {
    let img = await carregar(T.escudo.url, ESPERA_ESCUDO_MS);
    if (!img && T.escudo.url !== T.escudo.gerado) {
      img = await carregar(T.escudo.gerado, Math.max(300, ESPERA_ESCUDO_MS - (performance.now() - t0)));
      T.escudo.url = T.escudo.gerado;
      T.escudo.falhou = true;
    }
    T.escudo.img = img;
  }));
  await est;
  ident.msEscudos = Math.round(performance.now() - t0);
  return ident;
}

/** Extras do placar (escudo-imagem, cor do time, cores do minimapa: identidade.js extrasPlacar); sem ?tm, {}. */
export function extrasPlacar(ident, t) { return ident && ident.tm && modulo ? modulo.extrasPlacar(ident, t) : {}; }

/** Máscara do mosaico das cadeiras: "GOLAÇO" (sem ?tm, a de hoje) ou o nome do mandante do Total Match. */
export function mascaraDaIdentidade(ident) {
  return ident && ident.tm ? mascaraTexto(ident.mosaico.texto, 2.6) : mascaraGolaco();
}
