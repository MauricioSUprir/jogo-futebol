// Missões em sequência, dadas pelo S.T.A.R. Labs. PURO (sem three.js nem DOM): o jogo passa o contexto a cada quadro.
// Cada missão: {id, titulo, texto, meta?, contador? (campo de stats que conta a partir do início dela), checar?(ctx), alvo?, crime?}
export const MISSOES = [
  { id: 'lab', titulo: 'Bem-vindo ao S.T.A.R. Labs', texto: 'Entre no laboratório e vá até o Cortex', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 'velocidade', titulo: 'Teste de velocidade', texto: 'Chegue a 200 km/h (segure CORRER)', checar: (c) => c.v * 3.6 >= 200 },
  { id: 'esferas', titulo: 'Recarga', texto: 'Recolha 5 esferas de energia', meta: 5, contador: 'esferas', alvo: 'esfera' },
  { id: 'escalar', titulo: 'Ponto de vista', texto: 'Escale um prédio de 50 m ou mais', checar: (c) => c.noChao && c.y >= 50 },
  { id: 'vibrar', titulo: 'Através das paredes', texto: 'Atravesse 3 prédios vibrando', meta: 3, contador: 'atravessados' },
  { id: 'assalto', titulo: 'Primeira patrulha', texto: 'Pare um assalto', meta: 1, contador: 'assalto', crime: 'assalto' },
  { id: 'portais', titulo: 'Corrida contra o relógio', texto: 'Passe pelos 8 portais em até 70 s', tipo: 'portais' },
  { id: 'fuga', titulo: 'Perseguição', texto: 'Pare um carro em fuga', meta: 1, contador: 'fuga', crime: 'fuga' },
  { id: 'incendio', titulo: 'Vórtice', texto: 'Apague um incêndio correndo em volta do prédio', meta: 1, contador: 'incendio', crime: 'incendio' },
  { id: 'queda', titulo: 'Salvamento', texto: 'Salve uma pessoa caindo de um prédio', meta: 1, contador: 'queda', crime: 'queda' },
  { id: 'patrulha', titulo: 'Guardião da cidade', texto: 'Impeça 5 crimes quaisquer', meta: 5, contador: 'crimes' },
  { id: 'relatorio', titulo: 'Relatório', texto: 'Volte ao Cortex do S.T.A.R. Labs', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
];

const CHAVE = 'theflash.missoes.v1';
const STATS0 = { esferas: 0, atravessados: 0, crimes: 0, assalto: 0, fuga: 0, incendio: 0, queda: 0, pontos: 0 };

export function criarMissoes(armazem) {
  let salvo = null;
  try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  const E = { indice: salvo?.indice ?? 0, stats: { ...STATS0, ...(salvo?.stats || {}) }, base: salvo?.base || {} };
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify(E)); } catch { /* sem armazenamento */ } };
  const atual = () => MISSOES[E.indice] || null;
  function comecar() { const m = atual(); if (m?.contador) E.base[m.id] = E.stats[m.contador]; gravar(); }
  if (atual()?.contador && E.base[atual().id] === undefined) comecar();

  function progresso() {
    const m = atual(); if (!m) return null;
    if (m.contador) { const n = Math.min(m.meta, E.stats[m.contador] - (E.base[m.id] ?? 0)); return { n, meta: m.meta, txt: `${n}/${m.meta}` }; }
    return null;
  }
  /** Conta um acontecimento (esfera, crime, prédio atravessado). */
  function contar(campo, n = 1) { E.stats[campo] = (E.stats[campo] || 0) + n; gravar(); }
  /** Avalia a missão atual; devolve a missão concluída (para o aviso) ou null. */
  function avaliar(ctx) {
    const m = atual(); if (!m) return null;
    let feito = false;
    if (m.contador) feito = progresso().n >= m.meta;
    else if (m.checar) feito = m.checar(ctx);
    else if (m.tipo === 'portais') feito = !!ctx.portaisFeitos;
    if (!feito) return null;
    E.stats.pontos += 500 + E.indice * 100; E.indice++; comecar();
    return m;
  }
  return {
    get atual() { return atual(); }, get indice() { return E.indice; }, get total() { return MISSOES.length; }, get stats() { return E.stats; },
    progresso, contar, avaliar,
    zerar() { E.indice = 0; E.stats = { ...STATS0 }; E.base = {}; comecar(); },
  };
}
