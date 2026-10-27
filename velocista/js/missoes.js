// A história em sequência: missões do S.T.A.R. Labs e os capítulos dos vilões, um passo depois do outro, cada um
// começando sozinho quando o anterior termina. PURO (sem three.js nem DOM): o jogo passa o contexto a cada quadro.
// Cada passo: {id, titulo, texto, meta?, contador? (campo de stats que conta a partir do início dela), checar?(ctx), alvo?,
// crime?, capitulo? (o capítulo de vilão deste passo: começa sozinho e o passo acaba quando ele é vencido),
// ponto? (o lugar da cidade onde o passo acontece — marcos.js PONTOS; ctx.perto diz se o herói chegou), aliados? (quem
// espera lá: {joe: ponto, iris: ponto}), raio? (a distância que conta como "chegou")}.
// roupa? ('civil' = Barry Allen à paisana; sem nada, o traje), tempo? (cronômetro em s: acabou, recomeça com um aviso),
// falha? (o passo para onde a história volta quando o tempo acaba), pistas? (lugares da perícia: [x, z, nome, detalhe], x/z
// relativos ao ponto, uma de cada vez; contador 'pistas').
// cenaAbre? (uma cena que roda no começo do passo, uma vez), epoca? ('ignicao' = a linha do tempo alterada da Parte 2: a
// cidade no crepúsculo, em outras cores), fraco? (multiplica a velocidade máxima: o raio se apagando), alvoSala? (uma sala do
// S.T.A.R. Labs: o guia leva até ela; ctx.sala diz onde o herói está), tipo 'tunel' (ficar 5 s acima de 180 km/h),
// teto? (velocidade máxima em m/s: sem poderes) e semEnergia? (a energia fica em zero: nem vibrar nem golpe especial).
// Depois do último passo a cidade fica livre (crimes, esferas e os capítulos para jogar de novo na pausa). Quem terminou
// uma versão da história com menos passos volta no primeiro passo novo (o save guarda o último passo que existia).
export const MISSOES = [
  { id: 'lab', titulo: 'Bem-vindo ao S.T.A.R. Labs', texto: 'Entre no laboratório e vá até o Cortex', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 'velocidade', titulo: 'Teste de velocidade', texto: 'Chegue a 200 km/h (segure CORRER)', checar: (c) => c.v * 3.6 >= 200 },
  { id: 'esferas', titulo: 'Recarga', texto: 'Recolha 5 esferas de energia', meta: 5, contador: 'esferas', alvo: 'esfera' },
  { id: 'escalar', titulo: 'Ponto de vista', texto: 'Escale um prédio de 50 m ou mais', alvo: 'predioAlto', checar: (c) => c.noChao && c.y >= 50 },
  { id: 'vibrar', titulo: 'Através das paredes', texto: 'Atravesse 3 prédios vibrando', meta: 3, contador: 'atravessados' },
  // a vida do Barry Allen (dono, 26/10): o Joe, o trabalho na perícia, a ligação do misterioso e a troca de roupa
  { id: 'delegacia', titulo: 'Delegacia Central', texto: 'O detetive Joe quer falar com você na Delegacia Central', ponto: 'delegacia', aliados: { joe: 'delegacia' }, roupa: 'civil', checar: (c) => c.perto },
  { id: 'atrasado', titulo: 'Atrasado de novo', texto: 'O capitão quer o laudo: chegue ao seu laboratório na Delegacia antes dele', ponto: 'csi', aliados: { joe: 'portaCsi' }, roupa: 'civil', tempo: 45, raio: 3, checar: (c) => c.perto },
  { id: 'pericia', titulo: 'Cena do crime', texto: 'Examine as 3 pistas do assalto ao museu, na praça da Prefeitura (pare em cima de cada marcador)', ponto: 'prefeitura', aliados: { joe: 'prefeitura' }, pistas: [[-16, -16, 'Cristais de gelo', 'num dia de 30 graus'], [15, -20, 'Um fio de tecido amarelo', 'preso na grade do museu'], [1, -31, 'Marcas de queimado', 'em forma de raio no asfalto']], meta: 3, contador: 'pistas', roupa: 'civil' },
  { id: 'analise', titulo: 'No laboratório', texto: 'Leve as pistas ao laboratório da perícia', ponto: 'csi', roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'troca', titulo: 'Troca relâmpago', texto: 'Alarme no centro! Ache um lugar sem testemunhas, atrás da Delegacia, e vista o traje', ponto: 'beco', roupa: 'civil', raio: 4, checar: (c) => c.perto },
  { id: 'assalto', titulo: 'Primeira patrulha', texto: 'Pare um assalto', meta: 1, contador: 'assalto', crime: 'assalto' },
  { id: 'gangue', titulo: 'Punhos relâmpago', texto: 'Derrote uma gangue (BATER)', meta: 1, contador: 'gangue', crime: 'gangue' },
  { id: 'cafe-pedido', titulo: 'Hora do café', texto: 'A Delegacia inteira quer café: pegue o pedido no balcão do Jitters', ponto: 'balcaoJitters', roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'cafe-entrega', titulo: 'Ainda quente', texto: 'Leve os doze cafés até a mesa do Joe antes que esfriem', ponto: 'mesaJoe', aliados: { joe: 'mesaJoe' }, roupa: 'civil', tempo: 40, falha: 'cafe-pedido', raio: 3, checar: (c) => c.perto },
  { id: 'jornal', titulo: 'A primeira foto', texto: 'Passe em frente ao Picture News acima de 300 km/h: a Iris está com a câmera', ponto: 'jornal', raio: 26, aliados: { iris: 'jornal' }, checar: (c) => c.perto && c.v * 3.6 >= 300 },
  { id: 'entrevista', titulo: 'O especialista', texto: 'A Iris quer entrevistar o perito da polícia sobre o borrão vermelho: vá à redação do Picture News', ponto: 'mesaIrisJornal', aliados: { iris: 'mesaIrisJornal' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'cap-zoom', titulo: 'O velocista de preto', texto: 'Encontre o Zoom e derrote-o', capitulo: 'zoom' },
  { id: 'energia', titulo: 'Apagão', texto: 'O Zoom drenou a cidade: religue as 3 subestações', meta: 3, contador: 'subestacoes', alvo: 'subestacao' },
  { id: 'especiais', titulo: 'Golpes especiais', texto: 'Derrube 3 bandidos com golpes especiais', meta: 3, contador: 'especiais', crime: 'gangue' },
  { id: 'portais', titulo: 'Corrida contra o relógio', texto: 'Passe pelos 8 portais em até 70 s', tipo: 'portais' },
  { id: 'ameaca-iris', titulo: 'A repórter congelada', texto: 'O Capitão Frio prendeu a Iris no Jitters: chegue antes que ela congele', ponto: 'mesaIris', aliados: { iris: 'mesaIris' }, tempo: 60, raio: 3, checar: (c) => c.perto },
  { id: 'cap-frio', titulo: 'Frio de rachar', texto: 'Encontre o Capitão Frio e derrote-o', capitulo: 'frio' },
  { id: 'presidio', titulo: 'Iron Heights', texto: 'Atravesse a Ponte da Baía: o Joe espera você no Presídio Iron Heights', ponto: 'presidio', aliados: { joe: 'presidio' }, checar: (c) => c.perto },
  { id: 'fuga', titulo: 'Perseguição', texto: 'Pare um carro em fuga', meta: 1, contador: 'fuga', crime: 'fuga' },
  { id: 'incendio', titulo: 'Vórtice', texto: 'Apague um incêndio correndo em volta do prédio', meta: 1, contador: 'incendio', crime: 'incendio' },
  { id: 'cap-onda', titulo: 'Fogo cruzado', texto: 'Encontre o Onda Térmica e derrote-o', capitulo: 'onda' },
  { id: 'cafe', titulo: 'Um café no Jitters', texto: 'A Iris marcou um café no Jitters', ponto: 'mesaCafe', aliados: { iris: 'mesaCafe' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'queda', titulo: 'Salvamento', texto: 'Salve uma pessoa caindo de um prédio', meta: 1, contador: 'queda', crime: 'queda' },
  { id: 'patrulha', titulo: 'Guardião da cidade', texto: 'Impeça 5 crimes quaisquer', meta: 5, contador: 'crimes' },
  { id: 'ameaca-joe', titulo: 'Tempestade em casa', texto: 'O Mago do Tempo cercou a casa dos West: chegue antes do próximo raio', ponto: 'sofaWest', aliados: { joe: 'sofaWest' }, tempo: 50, raio: 3, checar: (c) => c.perto },
  { id: 'cap-mago', titulo: 'A tempestade', texto: 'Encontre o Mago do Tempo e derrote-o', capitulo: 'mago' },
  { id: 'relatorio', titulo: 'Relatório', texto: 'Volte ao Cortex do S.T.A.R. Labs', alvo: 'cortex', roupa: 'civil', checar: (c) => c.sala === 'cortex' },
  { id: 'visita', titulo: 'Visita noturna', texto: 'Volte para casa: o dia foi longo', ponto: 'sofaWest', roupa: 'civil', raio: 3, aliados: { reverso: 'cozinha' }, checar: (c) => c.perto },
  { id: 'cap-reverso', titulo: 'O homem de amarelo', texto: 'Encontre o Flash Reverso e derrote-o', capitulo: 'reverso' },
  { id: 'casa', titulo: 'Em casa', texto: 'O Joe chamou você para jantar na casa da família West', ponto: 'jantar', aliados: { joe: 'jantar' }, roupa: 'civil', raio: 3.5, checar: (c) => c.perto },
  { id: 'cap-final', titulo: 'Dois contra um', texto: 'Zoom e Flash Reverso no S.T.A.R. Labs: vença os dois', capitulo: 'final' },
  { id: 'prefeitura', titulo: 'A cidade agradece', texto: 'Vá à praça da Prefeitura: a cidade quer agradecer ao Flash', ponto: 'prefeitura', aliados: { joe: 'prefeitura', iris: 'prefeitura2' }, checar: (c) => c.perto },
  // Ato 3 — o tempo
  { id: 'fendas', titulo: 'Fendas no tempo', texto: 'Feche 4 fendas temporais (vibre dentro delas)', meta: 4, contador: 'fendas', alvo: 'fenda' },
  { id: 'tunel', titulo: 'O túnel do tempo', texto: 'Fique 5 s acima de 180 km/h (a energia não gasta)', tipo: 'tunel', checar: (c) => c.tunel >= 1 },
  { id: 'passado', titulo: 'A noite do acidente', texto: 'Chegue ao S.T.A.R. Labs, seis semanas atrás', alvo: 'labPassado', checar: (c) => c.voltouDoPassado },
  // Ato 4 — o Pensador e o fim
  { id: 'cap-savitar', titulo: 'O eco do túnel', texto: 'Encontre o Savitar e derrote-o', capitulo: 'savitar' },
  { id: 'cap-devoe', titulo: 'O Grande Reinício', texto: 'Derrote o DeVoe em frente ao S.T.A.R. Labs', capitulo: 'devoe' },
  { id: 'nucleo', titulo: 'O coração do raio', texto: 'Corra para o Cortex: o Núcleo vai explodir', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  // ===== PARTE 2 — O preço da velocidade (dono, 27/10: "quero uma parte dois da história, bem maior") =====
  // Ato 5 — Ponto de Ignição
  { id: 'p2-exames', titulo: 'Uma noite sem sono', texto: 'Três da manhã. A Caitlin quer ver seus exames no Cortex', alvo: 'cortex', cenaAbre: 'p2-abertura', checar: (c) => c.sala === 'cortex' },
  { id: 'p2-caixinha', titulo: 'A caixinha de música', texto: 'O Joe chamou você para jantar na casa da família West', ponto: 'jantar', aliados: { joe: 'jantar' }, roupa: 'civil', raio: 3.5, checar: (c) => c.perto },
  { id: 'p2-limite', titulo: 'Só um teste', texto: 'Passe dos 400 km/h (segure CORRER numa reta longa)', checar: (c) => c.v * 3.6 >= 400 },
  { id: 'p2-tunel', titulo: 'Vinte anos atrás', texto: 'Fique 5 s acima de 180 km/h: o túnel do tempo vai abrir', tipo: 'tunel', checar: (c) => c.tunel >= 1 },
  { id: 'p2-mundo', titulo: 'O dia que nunca aconteceu', texto: 'Volte ao S.T.A.R. Labs', epoca: 'ignicao', fraco: 0.55, alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 'p2-joe', titulo: 'Um estranho', texto: 'Vá à Delegacia Central: o Joe vai saber o que aconteceu', epoca: 'ignicao', fraco: 0.55, ponto: 'delegacia', aliados: { joe: 'delegacia' }, roupa: 'civil', checar: (c) => c.perto },
  { id: 'p2-iris', titulo: 'Prazer, Iris West', texto: 'A Iris toma café no Jitters todo fim de tarde', epoca: 'ignicao', fraco: 0.55, ponto: 'mesaCafe', aliados: { iris: 'mesaCafe' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-assalto', titulo: 'Ainda sou o Flash', texto: 'Mesmo mais lento, pare um assalto', epoca: 'ignicao', fraco: 0.55, meta: 1, contador: 'assalto', crime: 'assalto' },
  { id: 'p2-cisco', titulo: 'Cisco Ramon, bilionário', texto: 'A Torre Ramon fica na praça da Prefeitura: convença o Cisco', epoca: 'ignicao', fraco: 0.55, ponto: 'prefeitura', aliados: { cisco: 'prefeitura' }, checar: (c) => c.perto },
  { id: 'p2-esferas', titulo: 'O raio está se apagando', texto: 'Recolha 5 esferas de energia antes que a velocidade suma', epoca: 'ignicao', fraco: 0.55, meta: 5, contador: 'esferas', alvo: 'esfera' },
  { id: 'cap-nevasca', titulo: 'Projeto Nevasca', texto: 'Encontre a Nevasca e derrote-a', epoca: 'ignicao', fraco: 0.55, capitulo: 'nevasca' },
  { id: 'p2-mae', titulo: 'Jantar em família', texto: 'Seus pais esperam você para jantar. Na mesma casa', epoca: 'ignicao', fraco: 0.55, ponto: 'jantar', roupa: 'civil', raio: 3.5, checar: (c) => c.perto },
  { id: 'p2-desfazer', titulo: 'Desfazer', texto: 'Fique 5 s acima de 180 km/h e volte àquela noite', epoca: 'ignicao', fraco: 0.55, tipo: 'tunel', checar: (c) => c.tunel >= 1 },
  { id: 'p2-volta', titulo: 'Os ecos', texto: 'Volte ao Cortex', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  // Ato 6 — O Corredor Negro
  { id: 'p2-boatos', titulo: 'O homem sem rosto', texto: 'A Iris quer mostrar uma coisa na redação do Picture News', ponto: 'mesaIrisJornal', aliados: { iris: 'mesaIrisJornal' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-silhueta', titulo: 'Na praça', texto: 'Uma silhueta preta na praça da Prefeitura. Chegue perto', ponto: 'prefeitura', aliados: { negro: 'prefeitura' }, raio: 12, checar: (c) => c.perto },
  { id: 'p2-celas', titulo: 'Cinzas', texto: 'Alarme na câmara de contenção do S.T.A.R. Labs', alvoSala: 'contencao', checar: (c) => c.sala === 'contencao' },
  { id: 'p2-incendio', titulo: 'Fogo na cidade', texto: 'Apague um incêndio correndo em volta do prédio', meta: 1, contador: 'incendio', crime: 'incendio' },
  { id: 'p2-fuga', titulo: 'Ele está atrás de você', texto: 'O Corredor Negro está vindo: chegue ao Cortex', alvo: 'cortex', tempo: 50, checar: (c) => c.sala === 'cortex' },
  { id: 'cap-negro', titulo: 'O Corredor Negro', texto: 'Enfrente o Corredor Negro', capitulo: 'negro' },
  { id: 'p2-lista', titulo: 'A lista', texto: 'A Iris recebeu uma carta estranha: encontre-a no Jitters', ponto: 'mesaIris', aliados: { iris: 'mesaIris' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  // Ato 7 — A adaga
  { id: 'p2-iron', titulo: 'Celas vazias', texto: 'Atravesse a Ponte da Baía: o Joe espera você em Iron Heights', ponto: 'presidio', aliados: { joe: 'presidio' }, checar: (c) => c.perto },
  { id: 'p2-august', titulo: 'O perito novo', texto: 'A perícia da Delegacia ganhou um perito novo: vá ao seu laboratório', ponto: 'csi', aliados: { joe: 'portaCsi' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-anel', titulo: 'O anel', texto: 'O Joe quer falar com você, a sós, na casa dos West', ponto: 'sofaWest', aliados: { joe: 'sofaWest' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-pedido', titulo: 'A pergunta', texto: 'A Iris espera você no Jitters. O anel está no seu bolso', ponto: 'mesaCafe', aliados: { iris: 'mesaCafe' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-gangue', titulo: 'A marca da cigarra', texto: 'Uma gangue com a marca da cigarra tomou uma rua: derrote-a', meta: 1, contador: 'gangue', crime: 'gangue' },
  { id: 'p2-adaga', titulo: 'A adaga', texto: 'Alarme na praça da Prefeitura: alguém com uma adaga que brilha', ponto: 'prefeitura', aliados: { cigarra: 'prefeitura' }, raio: 14, checar: (c) => c.perto },
  { id: 'p2-sempoderes', titulo: 'Sem poderes', texto: 'A adaga apagou a sua velocidade: chegue a pé ao Jitters, onde o Cisco espera de carro', ponto: 'cafe', teto: 7, semEnergia: true, tempo: 75, raio: 6, checar: (c) => c.perto },
  { id: 'p2-esferas2', titulo: 'Faísca', texto: 'A velocidade voltou pela metade: recolha 5 esferas de energia', fraco: 0.6, meta: 5, contador: 'esferas', alvo: 'esfera' },
  { id: 'p2-grace', titulo: 'Grace', texto: 'A Iris descobriu quem é a Cigarra: encontre-a na sala do editor do Picture News', ponto: 'editor', aliados: { iris: 'editor' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'cap-cigarra', titulo: 'A Cigarra', texto: 'Encontre a Cigarra e derrote-a', capitulo: 'cigarra' },
  { id: 'p2-casamento', titulo: 'O casamento', texto: 'Na praça da Prefeitura, todos esperam o noivo. Atrasado, claro', ponto: 'prefeitura', aliados: { joe: 'prefeitura', iris: 'prefeitura2' }, roupa: 'civil', checar: (c) => c.perto },
  // Ato 8 — O deus da velocidade
  { id: 'p2-subestacoes', titulo: 'O ladrão de raios', texto: 'Um velocista de prata está drenando a cidade: religue as 3 subestações', meta: 3, contador: 'subestacoes', alvo: 'subestacao' },
  { id: 'p2-mural', titulo: 'O mural', texto: 'O August não aparece há dois dias: vá ao laboratório da perícia', ponto: 'csi', aliados: { joe: 'portaCsi' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 'p2-treino', titulo: 'Mais rápido que um deus', texto: 'O Cisco montou o circuito mais difícil: passe pelos 8 portais em até 70 s', tipo: 'portais' },
  { id: 'cap-godspeed', titulo: 'O deus da velocidade', texto: 'Encontre o Godspeed e derrote-o', capitulo: 'godspeed' },
  { id: 'p2-grace-acorda', titulo: 'Acordar', texto: 'A Caitlin precisa de você na sala médica do S.T.A.R. Labs', alvoSala: 'medica', checar: (c) => c.sala === 'medica' },
  { id: 'p2-fim', titulo: 'Em família', texto: 'Jantar na casa dos West. Todo mundo vai', ponto: 'jantar', aliados: { joe: 'jantar', iris: 'cozinha' }, roupa: 'civil', raio: 3.5, checar: (c) => c.perto },
];
/** os passos de uma época (os da linha do tempo alterada): o jogo põe o mundo nela enquanto o passo dura */
export const EPOCA_DO_PASSO = (m) => m?.epoca || null;

const CHAVE = 'theflash.missoes.v2';                       // grava o id do passo (v1 gravava a posição na lista antiga)
const CHAVE_V1 = 'theflash.missoes.v1';
// a lista da v1, para levar quem já tinha progresso ao mesmo passo
const ORDEM_V1 = ['lab', 'velocidade', 'esferas', 'escalar', 'vibrar', 'assalto', 'gangue', 'especiais', 'portais', 'fuga', 'incendio', 'queda',
  'patrulha', 'relatorio', 'cap-reverso', 'fendas', 'tunel', 'passado', 'cap-savitar', 'cap-devoe', 'nucleo'];
const STATS0 = { pistas: 0, fendas: 0, subestacoes: 0, esferas: 0, atravessados: 0, crimes: 0, assalto: 0, fuga: 0, incendio: 0, queda: 0, gangue: 0, especiais: 0, nocautes: 0, pontos: 0 };

export function criarMissoes(armazem) {
  let salvo = null, v1 = null;
  try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  if (!salvo) { try { v1 = JSON.parse(armazem?.getItem(CHAVE_V1) || 'null'); } catch { v1 = null; } }
  // id null = a história terminou (cidade livre); sem nada gravado, começa do começo
  const idSalvo = salvo && Object.hasOwn(salvo, 'id') ? salvo.id : (v1 ? (v1.indice >= ORDEM_V1.length ? null : ORDEM_V1[v1.indice]) : 'lab');
  const pos = (id) => (id === null ? MISSOES.length : Math.max(0, MISSOES.findIndex((m) => m.id === id)));
  let indice = pos(idSalvo);
  // terminou uma versão mais curta da história (a Parte 1 acabava no 'nucleo'): continua no primeiro passo que ela não tinha
  if (idSalvo === null && (salvo || v1)) { const k = MISSOES.findIndex((m) => m.id === (salvo?.ultimo || 'nucleo')); if (k >= 0) indice = k + 1; }
  const E = { indice, stats: { ...STATS0, ...((salvo || v1)?.stats || {}) }, base: (salvo || v1)?.base || {} };
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify({ id: MISSOES[E.indice]?.id ?? null, ultimo: MISSOES[MISSOES.length - 1].id, stats: E.stats, base: E.base })); } catch { /* sem armazenamento */ } };
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
