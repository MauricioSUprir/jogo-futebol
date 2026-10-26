// A história em sequência: missões do S.T.A.R. Labs e os capítulos dos vilões, um passo depois do outro, cada um
// começando sozinho quando o anterior termina. PURO (sem three.js nem DOM): o jogo passa o contexto a cada quadro.
// Cada passo: {id, titulo, texto, meta?, contador? (campo de stats que conta a partir do início dela), checar?(ctx), alvo?,
// crime?, capitulo? (o capítulo de vilão deste passo: começa sozinho e o passo acaba quando ele é vencido)}.
// Depois do último passo a cidade fica livre (crimes, esferas e os capítulos para jogar de novo na pausa).
export const MISSOES = [
  { id: 'lab', titulo: 'Bem-vindo ao S.T.A.R. Labs', texto: 'Entre no laboratório e vá até o Cortex', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 'velocidade', titulo: 'Teste de velocidade', texto: 'Chegue a 200 km/h (segure CORRER)', checar: (c) => c.v * 3.6 >= 200 },
  { id: 'esferas', titulo: 'Recarga', texto: 'Recolha 5 esferas de energia', meta: 5, contador: 'esferas', alvo: 'esfera' },
  { id: 'escalar', titulo: 'Ponto de vista', texto: 'Escale um prédio de 50 m ou mais', alvo: 'predioAlto', checar: (c) => c.noChao && c.y >= 50 },
  { id: 'vibrar', titulo: 'Através das paredes', texto: 'Atravesse 3 prédios vibrando', meta: 3, contador: 'atravessados' },
  { id: 'assalto', titulo: 'Primeira patrulha', texto: 'Pare um assalto', meta: 1, contador: 'assalto', crime: 'assalto' },
  { id: 'gangue', titulo: 'Punhos relâmpago', texto: 'Derrote uma gangue (BATER)', meta: 1, contador: 'gangue', crime: 'gangue' },
  { id: 'cap-zoom', titulo: 'O velocista de preto', texto: 'Encontre o Zoom e derrote-o', capitulo: 'zoom' },
  { id: 'especiais', titulo: 'Golpes especiais', texto: 'Derrube 3 bandidos com golpes especiais', meta: 3, contador: 'especiais', crime: 'gangue' },
  { id: 'portais', titulo: 'Corrida contra o relógio', texto: 'Passe pelos 8 portais em até 70 s', tipo: 'portais' },
  { id: 'cap-frio', titulo: 'Frio de rachar', texto: 'Encontre o Capitão Frio e derrote-o', capitulo: 'frio' },
  { id: 'fuga', titulo: 'Perseguição', texto: 'Pare um carro em fuga', meta: 1, contador: 'fuga', crime: 'fuga' },
  { id: 'incendio', titulo: 'Vórtice', texto: 'Apague um incêndio correndo em volta do prédio', meta: 1, contador: 'incendio', crime: 'incendio' },
  { id: 'cap-onda', titulo: 'Fogo cruzado', texto: 'Encontre o Onda Térmica e derrote-o', capitulo: 'onda' },
  { id: 'queda', titulo: 'Salvamento', texto: 'Salve uma pessoa caindo de um prédio', meta: 1, contador: 'queda', crime: 'queda' },
  { id: 'patrulha', titulo: 'Guardião da cidade', texto: 'Impeça 5 crimes quaisquer', meta: 5, contador: 'crimes' },
  { id: 'cap-mago', titulo: 'A tempestade', texto: 'Encontre o Mago do Tempo e derrote-o', capitulo: 'mago' },
  { id: 'relatorio', titulo: 'Relatório', texto: 'Volte ao Cortex do S.T.A.R. Labs', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 'cap-reverso', titulo: 'O homem de amarelo', texto: 'Encontre o Flash Reverso e derrote-o', capitulo: 'reverso' },
  { id: 'cap-final', titulo: 'Dois contra um', texto: 'Zoom e Flash Reverso no S.T.A.R. Labs: vença os dois', capitulo: 'final' },
  // Ato 3 — o tempo
  { id: 'fendas', titulo: 'Fendas no tempo', texto: 'Feche 4 fendas temporais (vibre dentro delas)', meta: 4, contador: 'fendas', alvo: 'fenda' },
  { id: 'tunel', titulo: 'O túnel do tempo', texto: 'Fique 5 s acima de 180 km/h (a energia não gasta)', tipo: 'tunel', checar: (c) => c.tunel >= 1 },
  { id: 'passado', titulo: 'A noite do acidente', texto: 'Chegue ao S.T.A.R. Labs, seis semanas atrás', alvo: 'labPassado', checar: (c) => c.voltouDoPassado },
  // Ato 4 — o Pensador e o fim
  { id: 'cap-savitar', titulo: 'O eco do túnel', texto: 'Encontre o Savitar e derrote-o', capitulo: 'savitar' },
  { id: 'cap-devoe', titulo: 'O Grande Reinício', texto: 'Derrote o DeVoe em frente ao S.T.A.R. Labs', capitulo: 'devoe' },
  { id: 'nucleo', titulo: 'O coração do raio', texto: 'Corra para o Cortex: o Núcleo vai explodir', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
];

const CHAVE = 'theflash.missoes.v2';                       // grava o id do passo (v1 gravava a posição na lista antiga)
const CHAVE_V1 = 'theflash.missoes.v1';
// a lista da v1, para levar quem já tinha progresso ao mesmo passo
const ORDEM_V1 = ['lab', 'velocidade', 'esferas', 'escalar', 'vibrar', 'assalto', 'gangue', 'especiais', 'portais', 'fuga', 'incendio', 'queda',
  'patrulha', 'relatorio', 'cap-reverso', 'fendas', 'tunel', 'passado', 'cap-savitar', 'cap-devoe', 'nucleo'];
const STATS0 = { fendas: 0, esferas: 0, atravessados: 0, crimes: 0, assalto: 0, fuga: 0, incendio: 0, queda: 0, gangue: 0, especiais: 0, nocautes: 0, pontos: 0 };

export function criarMissoes(armazem) {
  let salvo = null, v1 = null;
  try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  if (!salvo) { try { v1 = JSON.parse(armazem?.getItem(CHAVE_V1) || 'null'); } catch { v1 = null; } }
  const idSalvo = salvo?.id ?? (v1 ? (v1.indice >= ORDEM_V1.length ? null : ORDEM_V1[v1.indice]) : 'lab');
  const pos = (id) => (id === null ? MISSOES.length : Math.max(0, MISSOES.findIndex((m) => m.id === id)));
  const E = { indice: pos(idSalvo), stats: { ...STATS0, ...((salvo || v1)?.stats || {}) }, base: (salvo || v1)?.base || {} };
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify({ id: MISSOES[E.indice]?.id ?? null, stats: E.stats, base: E.base })); } catch { /* sem armazenamento */ } };
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
    else if (m.capitulo) feito = !!ctx.vencido?.(m.capitulo);
    else if (m.checar) feito = m.checar(ctx);
    else if (m.tipo === 'portais') feito = !!ctx.portaisFeitos;
    if (!feito) return null;
    E.stats.pontos += 500 + E.indice * 100; E.indice++; comecar();
    return m;
  }
  return {
    get atual() { return atual(); }, get indice() { return E.indice; }, get total() { return MISSOES.length; }, get stats() { return E.stats; },
    /** a história terminou: a cidade fica livre */
    get livre() { return E.indice >= MISSOES.length; },
    progresso, contar, avaliar,
    /** pula para uma missão (atalho dos testes: ?missao=<id>) */
    irPara(id) { const i = MISSOES.findIndex((m) => m.id === id); if (i >= 0) { E.indice = i; comecar(); } },
    zerar() { E.indice = 0; E.stats = { ...STATS0 }; E.base = {}; comecar(); },
  };
}
