// A TEMPORADA DA SÉRIE (EDIÇÃO PESSOAL, js/edicao.js; dono, 31/10: "a história não fala sobre os meses em coma do Barry, não
// tem o Harrison Wells, o Eobard Thawne, o verdadeiro Flash Reverso, o seu plano de matar o Barry, que acabou matando a mãe
// dele, não mostra o futuro, não mostra o Barry aprendendo seus poderes"). Uma campanha à parte, só com a senha, contada
// pelos acontecimentos da 1ª temporada: a noite do acelerador, os nove meses em coma, o Dr. Wells na cadeira de rodas, os
// treinos de cada poder, os primeiros meta-humanos, o pai em Iron Heights e o homem de amarelo. Recriação de fã: as falas
// são escritas aqui (nada copiado dos roteiros). O progresso fica guardado à parte (jogo.js: as chaves 'theflash.serie.*').
// Entrega 1 (Atos 1–5): até a noite em que a mãe morreu. A entrega 2 continua daqui (o progresso salvo volta no 1º passo novo).
// PURO (sem three.js nem DOM): missoes.js, historia.js e viloes.js juntam isto ao resto quando a edição é a pessoal.

const F = (quem, texto) => ({ quem, texto });
const CARTAO = (rotulo, titulo) => ({ cartao: true, rotulo, titulo });

/** os passos da temporada (o mesmo formato de missoes.js). `libera`: os golpes especiais que este passo ensina (antes dele,
 *  o botão não aparece: o Barry aprende cada poder num treino) */
export const MISSOES_SERIE = [
  // Ato 1 — O despertar (depois do prólogo: os nove meses de coma no S.T.A.R. Labs)
  { id: 's1-jitters', titulo: 'Nove meses', texto: 'Você acordou. A Iris trabalha no Jitters: vá até lá', ponto: 'mesaCafe', aliados: { iris: 'mesaCafe' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 's1-descontrole', titulo: 'Rápido demais', texto: 'Tem alguma coisa errada com você. Segure CORRER e passe dos 200 km/h', roupa: 'civil', checar: (c) => c.v * 3.6 >= 200 },
  { id: 's1-volta', titulo: 'Respostas', texto: 'Volte ao S.T.A.R. Labs: o Dr. Wells espera você no Cortex', alvo: 'cortex', roupa: 'civil', checar: (c) => c.sala === 'cortex' },
  { id: 's1-teste', titulo: 'O primeiro teste', texto: 'O teste do Dr. Wells: segure CORRER numa reta e passe dos 300 km/h', checar: (c) => c.v * 3.6 >= 300 },
  { id: 's1-esferas', titulo: 'Matéria escura', texto: 'A explosão espalhou matéria escura pela cidade: recolha 5 esferas', meta: 5, contador: 'esferas', alvo: 'esfera' },
  // Ato 2 — O primeiro meta-humano
  { id: 's1-delegacia', titulo: 'De volta à perícia', texto: 'O Joe espera você na Delegacia Central', ponto: 'delegacia', aliados: { joe: 'delegacia' }, roupa: 'civil', checar: (c) => c.perto },
  { id: 's1-banco', titulo: 'A neblina', texto: 'Um banco foi assaltado no meio de uma neblina: pare o assalto', meta: 1, contador: 'assalto', crime: 'assalto' },
  { id: 's1-mardon', titulo: 'O homem do tempo', texto: 'Encontre o Clyde Mardon e derrote-o', capitulo: 'mago' },
  { id: 's1-vortice', titulo: 'Contra o vento', texto: 'O raio do Mardon pôs fogo num prédio: corra em volta dele e apague com o vácuo', meta: 1, contador: 'incendio', crime: 'incendio', libera: ['ciclone'] },
  // Ato 3 — Aprendendo a correr
  { id: 's1-parede', titulo: 'Para o alto', texto: 'O Dr. Wells quer ver: corra de frente para um prédio e suba até 50 m', alvo: 'predioAlto', checar: (c) => c.noChao && c.y >= 50 },
  { id: 's1-vibrar', titulo: 'Através', texto: 'Vibre as moléculas: atravesse 3 prédios vibrando (segure VIBRAR correndo)', meta: 3, contador: 'atravessados' },
  { id: 's1-patrulha', titulo: 'O borrão vermelho', texto: 'A cidade precisa de você: impeça 3 crimes', meta: 3, contador: 'crimes' },
  { id: 's1-raio', titulo: 'Raio nas mãos', texto: 'Com a energia cheia, jogue o raio: derrube 2 bandidos com o RAIO', meta: 2, contador: 'especiais', crime: 'gangue', libera: ['raio'] },
  { id: 's1-supersonico', titulo: 'O soco supersônico', texto: 'Uma gangue com um homem de aço no centro: derrube 2 com o golpe SÔNICO', meta: 2, contador: 'especiais', crime: 'gangue', libera: ['sonico'] },
  // Ato 4 — Os vilões e a família
  { id: 's1-presidio', titulo: 'Iron Heights', texto: 'Atravesse a Ponte da Baía e visite o seu pai no Presídio Iron Heights', ponto: 'presidio', aliados: { joe: 'presidio' }, roupa: 'civil', checar: (c) => c.perto },
  { id: 's1-snart', titulo: 'A pistola de frio', texto: 'Roubaram a pistola de frio do S.T.A.R. Labs: encontre o Capitão Frio', capitulo: 'frio' },
  { id: 's1-cafe', titulo: 'Um café com a Iris', texto: 'A Iris marcou um café no Jitters', ponto: 'mesaCafe', aliados: { iris: 'mesaCafe' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
  { id: 's1-rory', titulo: 'Fogo', texto: 'O parceiro do Snart está queimando o centro: derrote o Onda Térmica', capitulo: 'onda' },
  { id: 's1-queda', titulo: 'Na hora certa', texto: 'Salve uma pessoa caindo de um prédio', meta: 1, contador: 'queda', crime: 'queda' },
  // Ato 5 — O homem de amarelo
  { id: 's1-armadilha', titulo: 'A armadilha', texto: 'O Dr. Wells montou uma armadilha no S.T.A.R. Labs: volte ao Cortex', alvo: 'cortex', checar: (c) => c.sala === 'cortex' },
  { id: 's1-amarelo', titulo: 'O homem de amarelo', texto: 'Ele está aqui. Alcance o homem de amarelo', capitulo: 'reverso' },
  { id: 's1-casa', titulo: 'A casa dos West', texto: 'O Joe chamou você para conversar em casa', ponto: 'sofaWest', aliados: { joe: 'sofaWest' }, roupa: 'civil', raio: 3, checar: (c) => c.perto },
];

/** os capítulos dos vilões na temporada (a ordem e o texto; o resto vem do capítulo de viloes.js com o mesmo id) */
export const CAPITULOS_SERIE = [
  { id: 'mago', titulo: 'Capítulo 1 — O homem do tempo', texto: 'Clyde Mardon, o assaltante que voltou do acidente controlando o clima, está no centro.' },
  { id: 'frio', titulo: 'Capítulo 2 — Capitão Frio', texto: 'Leonard Snart roubou a pistola de frio do S.T.A.R. Labs. Encontre-o.' },
  { id: 'onda', titulo: 'Capítulo 3 — Onda Térmica', texto: 'Mick Rory, o parceiro do Snart, está pondo fogo no centro.' },
  { id: 'reverso', titulo: 'Capítulo 4 — O homem de amarelo', texto: 'O borrão amarelo e vermelho apareceu no S.T.A.R. Labs. Alcance-o.' },
];

export const PERSONAGENS_SERIE = {
  wells: { nome: 'Dr. Harrison Wells', sigla: 'HW', cor: '#9db7d6', papel: 'S.T.A.R. Labs · diretor' },
  crianca: { nome: 'Barry, 11 anos', sigla: 'B', cor: '#ffd9a0', papel: 'quinze anos atrás' },
  singh: { nome: 'Capitão Singh', sigla: 'CS', cor: '#c8b08a', papel: 'Delegacia Central' },
  eddie: { nome: 'Eddie Thawne', sigla: 'ET', cor: '#bcd2ff', papel: 'Delegacia Central · detetive' },
  mago: { nome: 'Clyde Mardon', sigla: 'CM', cor: '#7dffa8', vilao: true, retrato: 'mago' },
  frio: { nome: 'Leonard Snart', sigla: 'LS', cor: '#9fe6ff', vilao: true, retrato: 'frio' },
  onda: { nome: 'Mick Rory', sigla: 'MR', cor: '#ff8a3d', vilao: true, retrato: 'onda' },
  reverso: { nome: 'O homem de amarelo', sigla: '?', cor: '#ff3b30', vilao: true, retrato: 'reverso' },
};

export const CENAS_SERIE = {
  // a noite do acelerador (no lugar da "noite do raio" da história normal: as mesmas ações do mundo)
  'noite-do-raio': [
    CARTAO('Nove meses atrás', 'A noite do acelerador'),
    F('joe', 'Barry, são quase dez da noite. A cidade inteira está na rua para ver o acelerador ligar, e você aqui.'),
    F('heroi', 'Só mais esta amostra, Joe. Eu queria estar lá. O Dr. Wells vai mudar o mundo hoje.'),
    F('tv', 'Ao vivo do S.T.A.R. Labs: o Dr. Harrison Wells vai ligar o acelerador de partículas pela primeira vez.'),
    F('tv', '"O futuro chega mais cedo esta noite", disse o Dr. Wells, sob aplausos.'),
    { ...F('joe', 'Tranca tudo quando sair. E não fica olhando para o céu a noite inteira.'), acao: 'joeSai' },
    F('heroi', 'Pode deixar.'),
    { ...F('tv', 'Atenção: o acelerador apresenta uma falha... o S.T.A.R. Labs pede que todos se afastem!'), acao: 'tempestade' },
    F('heroi', 'O céu... está ficando roxo.'),
    F('tv', 'Uma onda de energia saiu do laboratório e está atravessando a cidade inteira!'),
    { ...F('heroi', 'A claraboia...'), acao: 'raio' },
    CARTAO('Um raio', 'atravessou o laboratório da perícia'),
  ],
  // os nove meses de coma no S.T.A.R. Labs, contados pelos meses: o Wells, a Caitlin, o Cisco, o Joe e a Iris
  prologo: [
    CARTAO('S.T.A.R. Labs', 'Semana 1'),
    { ...F('caitlin', 'O hospital da cidade desistiu dele. Ninguém sabe tratar o que o raio fez com esse corpo.'), acao: 'deita' },
    F('wells', 'Então ele fica conosco, Dra. Snow. Eu assumo a responsabilidade.'),
    F('cisco', 'O laboratório está fechado, a gente quase não tem verba... e o senhor quer cuidar de um perito da polícia em coma?'),
    F('wells', 'Este rapaz foi atingido por um raio carregado da matéria escura do acelerador. E está vivo. Ele é a coisa mais importante deste prédio.'),
    CARTAO('S.T.A.R. Labs', 'Mês 3'),
    F('caitlin', 'Os batimentos estão em duzentos por minuto. Isso devia ser fibrilação... mas o coração dele está perfeitamente organizado.'),
    F('cisco', 'As células se regeneram sozinhas. Ele cicatriza enquanto dorme. Isso é... incrível e assustador.'),
    F('joe', 'Doutor, o médico do hospital queria desligar as máquinas. Por que o senhor tem tanta certeza de que ele acorda?'),
    F('wells', 'Porque eu já vi o que este rapaz pode ser, detetive. Confie em mim.'),
    CARTAO('S.T.A.R. Labs', 'Mês 6'),
    F('iris', 'Oi, Barry. Sou eu de novo. O Jitters agora tem um café com o seu nome. É horrível. Você ia adorar.'),
    F('iris', 'Volta, tá? Eu não sei correr esta cidade sem você.'),
    CARTAO('S.T.A.R. Labs', 'Mês 9'),
    F('wells', 'Boa noite, Sr. Allen. Sou só eu outra vez.'),
    F('wells', 'Eu esperei muito tempo por você. Mais do que você imagina.'),
    F('wells', 'Acorde. Temos tanto trabalho pela frente.'),
    { ...F('caitlin', 'Doutor! A atividade cerebral disparou... ele está acordando!'), acao: 'acorda' },
    F('heroi', 'Iris...? Onde... onde eu estou?'),
    F('cisco', 'S.T.A.R. Labs. Você ficou em coma. Nove meses.'),
    F('heroi', 'Nove meses?!'),
    F('caitlin', 'Calma. Você foi atingido por um raio na noite do acelerador. Seu coração parou várias vezes.'),
    F('heroi', 'Eu me sinto... estranho. Como se tudo em volta estivesse andando devagar.'),
    F('wells', 'Bem-vindo de volta, Sr. Allen. Vá ver a sua família. Depois volte aqui. Nós temos muito o que conversar.'),
    CARTAO('Ato 1', 'O despertar'),
  ],
  'depois-s1-jitters': [
    F('iris', 'Barry?! Você acordou! Ninguém me avisou, eu ia... eu ia te matar por me assustar tanto.'),
    F('heroi', 'Oi, Iris. O seu pai disse que você vinha toda semana.'),
    F('iris', 'Toda semana não. Toda terça e todo sábado. E às vezes na quarta.'),
    F('iris', 'Você está diferente. Mais... sei lá. Parece que vai sair voando a qualquer momento.'),
    F('heroi', 'Engraçado você dizer isso.'),
    F('iris', 'Desde a noite do acelerador a cidade anda estranha. Gente sumindo, coisas que não têm explicação.'),
    F('heroi', 'Eu sou perito. Tudo tem explicação.'),
  ],
  'depois-s1-descontrole': [
    F('heroi', 'Eu estava no Jitters. E agora estou do outro lado da cidade. Em quantos segundos?'),
    F('heroi', 'Os carros estavam parados. Não... eles estavam andando. Eu é que estava rápido demais.'),
    F('wells', 'Sr. Allen. Imaginei que você descobriria sozinho. Volte ao S.T.A.R. Labs, por favor. Agora você entende por que eu pedi.'),
  ],
  'depois-s1-volta': [
    F('wells', 'Sente-se, Sr. Allen. Ou fique em pé. Imagino que ficar parado seja difícil agora.'),
    F('heroi', 'O que vocês fizeram comigo?'),
    F('wells', 'Nada. O acelerador fez. A explosão liberou uma onda de matéria escura, e o raio que te atingiu estava carregado dela.'),
    F('caitlin', 'Suas células se renovam centenas de vezes mais rápido que as de qualquer pessoa. O seu corpo inteiro acelerou.'),
    F('cisco', 'Tradução: você é rápido. Rápido de verdade. E eu já tenho uns vinte apelidos.'),
    F('heroi', 'Se isso aconteceu comigo... aconteceu com mais alguém naquela noite?'),
    F('wells', 'É bem possível. Outras pessoas foram atingidas pela onda. Algumas podem ter mudado.'),
    F('cisco', 'Meta-humanos. Pronto, dei nome. Ninguém tira.'),
    F('wells', 'Eu quero estudar o que você consegue fazer, Barry. Com cuidado, com método. Deixe-nos ajudar.'),
    F('heroi', 'Tudo bem. Por onde a gente começa?'),
    F('wells', 'Pelo mais simples. Corra.'),
  ],
  'depois-s1-teste': [
    F('cisco', 'Trezentos por hora! E ele nem estava suando!'),
    F('caitlin', 'O consumo de energia é absurdo. Você vai precisar comer muito, Barry. Muito mesmo.'),
    F('wells', 'Isso é só o começo. O corpo humano não foi feito para isso... o seu, agora, foi.'),
    F('cisco', 'E roupa normal pega fogo a essa velocidade. Por isso eu fiz uma de verdade. Vermelha. Com um raio no peito.'),
    F('heroi', 'Vermelha?'),
    F('cisco', 'Material de bombeiro, à prova de atrito. Era um projeto meu. Agora tem dono.'),
  ],
  'depois-s1-delegacia': [
    F('joe', 'Olha quem resolveu voltar ao trabalho. Nove meses dormindo e já quer analisar pegada?'),
    F('heroi', 'Joe, eu preciso te contar uma coisa. Eu estou... rápido. Muito rápido.'),
    F('joe', 'Rápido para chegar atrasado, pelo visto. O capitão perguntou de você três vezes.'),
    F('singh', 'Allen! Bem-vindo de volta. Agora vá trabalhar: temos um assalto a banco com uma neblina que apareceu do nada.'),
    F('eddie', 'Eddie Thawne, entrei para a equipe do Joe enquanto você dormia. Prazer. Ouvi falar muito de você.'),
    F('joe', 'Um assaltante chamado Clyde Mardon. Eu achava que ele tinha morrido na queda do avião, na noite do acelerador.'),
  ],
  'depois-s1-vortice': [
    F('cisco', 'Você apagou um incêndio correndo em círculo! O vácuo engoliu o fogo!'),
    F('wells', 'Você girou mais rápido que o vento dele, Barry. Esse movimento tem nome agora: o ciclone. Use quando estiver cercado.'),
    F('caitlin', 'Botão novo liberado no traje. E, por favor, nada de ciclone dentro do laboratório.'),
  ],
  'depois-s1-raio': [
    F('wells', 'A energia que você carrega não fica só dentro de você. Ela pode sair. Pelas mãos.'),
    F('cisco', 'Ele jogou um RAIO. Um raio de verdade. Eu preciso sentar.'),
    F('caitlin', 'O botão do raio está liberado. Mas ele gasta muita energia: só com a barra cheia.'),
  ],
  'depois-s1-supersonico': [
    F('wells', 'Massa vezes velocidade, Barry. Um soco dado a uma fração da velocidade do som é uma marreta.'),
    F('cisco', 'O soco supersônico! Corre um quilômetro e meio e bate. Física pura!'),
    F('heroi', 'Minha mão ainda está zumbindo.'),
    F('caitlin', 'Isso passa em... uns dois segundos, no seu caso.'),
  ],
  'depois-s1-presidio': [
    CARTAO('Iron Heights', 'Visita'),
    F('pai', 'Barry! Olha só para você. O Joe me contou do coma. Eu não podia nem te ver.'),
    F('heroi', 'Eu estou bem, pai. Melhor do que nunca.'),
    F('pai', 'Você está diferente, filho. Como se tivesse acordado de um sono de anos.'),
    F('heroi', 'Pai, aquela noite... a luz na sala. Você sempre disse que tinha alguém dentro do raio.'),
    F('pai', 'Um homem. Dentro de um raio amarelo e vermelho. Ninguém nunca acreditou.'),
    F('heroi', 'Eu acredito. E agora eu sei que essas coisas são possíveis.'),
    F('pai', 'Não gasta a sua vida tentando me tirar daqui, Barry. Viva.'),
    F('heroi', 'Eu vou provar que foi ele. Eu prometo.'),
  ],
  'depois-s1-cafe': [
    F('iris', 'Eu comecei um blog. Sobre o borrão vermelho que está salvando gente pela cidade.'),
    F('heroi', 'Um blog? Iris, isso pode ser perigoso.'),
    F('iris', 'Perigoso é ter um herói por aí e ninguém escrever sobre ele. Já tenho mil leitores.'),
    F('iris', 'O Eddie acha que é bobagem. O meu pai acha que é perigoso. E você?'),
    F('heroi', 'Eu acho que você escreve muito bem. Só... toma cuidado.'),
  ],
  'depois-s1-armadilha': [
    F('wells', 'O que você descreveu, Barry, é um homem que se move como você. Mais rápido que você.'),
    F('cisco', 'Montamos uma armadilha: um campo de força no Cortex, alimentado pelo que sobrou do acelerador.'),
    F('caitlin', 'Se ele vier atrás de você aqui dentro, o campo fecha.'),
    F('joe', 'E se ele não vier?'),
    F('wells', 'Ele vem. Homens assim não resistem a um desafio.'),
    F('caitlin', 'Alerta! Uma assinatura de energia amarela entrando no campus. Ele está aqui!'),
  ],
  'depois-s1-casa': [
    F('joe', 'Senta, Barry. O homem de amarelo. É o mesmo da noite da sua mãe, não é?'),
    F('heroi', 'É ele, Joe. Eu vi o raio de novo. Amarelo e vermelho. Igual àquela noite.'),
    F('joe', 'Eu passei quinze anos achando que você imaginou aquilo. Que era um menino tentando salvar o pai.'),
    F('heroi', 'Eu nunca esqueci de nada. Nem por um segundo.'),
    CARTAO('Quinze anos atrás', 'A noite em que a mãe morreu'),
    F('crianca', 'Mãe? Que barulho é esse?'),
    { ...F('nora', 'Barry, fica aí em cima! Não desce!'), acao: 'raioCasa' },
    F('crianca', 'Tem um raio dentro da casa! Mãe!'),
    { ...F('nora', 'Henry! Henry, socorro!'), acao: 'raioCasa' },
    F('crianca', 'Tem gente dentro do raio... um homem de amarelo... e outro de vermelho!'),
    { ...F('nora', 'Corre, Barry! Corre!'), acao: 'raioCasa' },
    CARTAO('Vinte quarteirões', 'longe de casa, num segundo'),
    F('heroi', 'Quando eu voltei, o meu pai estava ajoelhado ao lado dela. E a polícia levou ele.'),
    F('joe', 'E eu te levei para casa. Para a minha casa. Eu lembro de cada palavra que você disse naquela noite.'),
    F('joe', 'Desculpa, filho. Eu devia ter acreditado em você desde o começo.'),
    F('heroi', 'Agora você acredita. Isso basta.'),
    F('joe', 'Então nós vamos pegar esse homem. Juntos. E o Henry sai de Iron Heights.'),
    CARTAO('Continua...', 'Temporada 1 — parte 2'),
  ],
  // os capítulos dos vilões contados como na temporada (as mesmas ações das cenas normais)
  'cap-mago': [
    CARTAO('Capítulo 1', 'O homem do tempo'),
    F('cisco', 'Gente, uma neblina do nada no centro, e agora um furacão do tamanho de um quarteirão.'),
    F('wells', 'Clyde Mardon. O avião dele caiu na noite do acelerador. Ele não morreu, Barry. Ele mudou.'),
  ],
  'encontro-mago': [
    F('mago', 'Então é você o borrão de que todo mundo fala. Eu sou a tempestade.'),
    F('heroi', 'Você assaltou um banco usando o tempo como arma.'),
    F('mago', 'Os céus me deram um presente naquela noite. Seria falta de educação não usar.'),
    F('mago', 'Raios, vento, granizo... e você correndo no meio deles.'),
    F('cisco', 'Quando o chão brilhar em volta de você, sai dali! Não deixa o tornado te puxar!'),
    F('mago', 'Vamos ver se você corre mais que o vento.'),
  ],
  'derrotado-mago': [
    F('mago', 'O céu... está calmo de novo.'),
    F('heroi', 'Acabou, Mardon.'),
    F('joe', 'Ele vai para uma cela especial. O Dr. Wells disse que tem um lugar no S.T.A.R. Labs para gente como ele.'),
    F('wells', 'O acelerador tem um anel de contenção. Celas que seguram quem a explosão mudou. Vamos usar.'),
    CARTAO('Ato 3', 'Aprendendo a correr'),
  ],
  'cap-frio': [
    CARTAO('Capítulo 2', 'Capitão Frio'),
    F('cisco', 'Ninguém me mata, tá? Eu fiz uma pistola de frio. Para o caso de um velocista sair do controle. Era uma precaução!'),
    F('caitlin', 'E alguém roubou ela daqui. Um quarteirão do centro está a trinta graus negativos.'),
    F('wells', 'Leonard Snart. Um ladrão com planos. Perigoso justamente por não ter poder nenhum.'),
  ],
  'encontro-frio': [
    F('frio', 'Então você é o famoso borrão. Eu estudei você, sabia? Cada assalto que você impediu.'),
    F('heroi', 'Devolve a pistola, Snart.'),
    F('frio', 'Pensa comigo: o que faz uma coisa rápida ficar lenta? O frio.'),
    F('frio', 'Eu não preciso ser mais rápido que você. Só preciso que você pare.'),
    F('cisco', 'O raio de gelo deixa você lento! Sai da linha e bate quando ele recarregar!'),
    F('frio', 'Vamos esfriar os ânimos.'),
  ],
  'derrotado-frio': [
    F('frio', 'Tudo bem. Você venceu esta.'),
    F('frio', 'Mas um homem esperto sempre tem um parceiro. E o meu gosta de fogo.'),
    F('caitlin', 'A pistola está de volta. E o Cisco vai trancar o laboratório de armas três vezes.'),
  ],
  'cap-onda': [
    CARTAO('Capítulo 3', 'Onda Térmica'),
    F('caitlin', 'Incêndios em série pelo centro. A temperatura passa dos mil graus.'),
    F('cisco', 'O Snart me mandou uma mensagem: "o meu amigo Mick quer te conhecer". Ótimo. Lindo.'),
  ],
  'encontro-onda': [
    F('onda', 'Olha só o corredor vermelho. O Len disse que você era bom. Vamos ver se é à prova de fogo.'),
    F('heroi', 'Desliga isso antes que alguém se machuque.'),
    F('onda', 'O fogo não machuca ninguém. O fogo limpa.'),
    F('caitlin', 'Fique longe do jato e saia do chão em chamas!'),
    F('onda', 'Queima, velocista!'),
  ],
  'derrotado-onda': [
    F('onda', 'O Len vai me tirar dessa. Ele sempre tira.'),
    F('heroi', 'Não desta vez.'),
    F('wells', 'Os dois na contenção. Você está aprendendo, Barry. Rápido. Como eu esperava.'),
  ],
  'cap-reverso': [
    CARTAO('Capítulo 4', 'O homem de amarelo'),
    F('heroi', 'É ele. O borrão amarelo e vermelho. O mesmo da noite da minha mãe.'),
    F('wells', 'O campo de força não segura algo assim, Barry. Vá. Mas tome cuidado: ele é mais rápido do que você.'),
  ],
  'encontro-reverso': [
    F('reverso', 'Olá, Flash. Esperei muito tempo por esta conversa.'),
    F('heroi', 'Foi você. Quinze anos atrás. Na minha casa.'),
    F('reverso', 'Nós dois temos uma história, Barry. Você só ainda não viveu a sua parte.'),
    F('reverso', 'Você é rápido. Para um iniciante.'),
    F('cisco', 'A energia dele é vermelha e está fora da escala! Ele é mais rápido que você!'),
    F('reverso', 'Corra, Barry. É a única coisa que você sabe fazer.'),
  ],
  'derrotado-reverso': [
    F('reverso', 'Impressionante. Você aprendeu mais rápido do que eu esperava.'),
    F('heroi', 'Quem é você?! Por que a minha mãe?!'),
    F('reverso', 'Um dia você vai ver o meu rosto. E vai entender que eu sempre estive perto.'),
    F('reverso', 'Até lá... continue correndo.'),
    F('caitlin', 'Ele sumiu do radar. Barry, você está bem?'),
    F('wells', 'Ele vai voltar. E, quando voltar, você precisa estar mais rápido.'),
  ],
};

export const RADIO_SERIE = {
  'capitulo-mago': [F('cisco', 'O olho da tempestade está marcado no guia. Leva um guarda-chuva. Brincadeira, não leva.')],
  'luta-mago': [F('wells', 'Os raios caem onde você está, Barry. Não fique parado nunca.')],
  'capitulo-frio': [F('cisco', 'O guia mostra onde ele está. E desculpa de novo pela pistola.')],
  'luta-frio': [F('wells', 'Ele é paciente. Seja imprevisível: saia da linha do gelo e entre quando ele recarregar.')],
  'capitulo-onda': [F('caitlin', 'Ele está no meio do fogo. O guia mostra onde.')],
  'luta-onda': [F('wells', 'O lança-chamas tem alcance curto. Fique longe e entre quando ele parar.')],
  'capitulo-reverso': [F('cisco', 'A assinatura vermelha está correndo pela cidade. O guia mostra onde.')],
  'perseguicao-reverso': [F('wells', 'Ele é mais rápido descansado, Barry. Deixe-o cansar e encoste.')],
  'luta-reverso': [F('reverso', 'Eu conheço cada movimento seu.'), F('caitlin', 'Quando o chão brilhar, corra de lado ou vibre. Depois bata.')],
  'fase2-reverso': [F('caitlin', 'Os níveis dele dispararam! Não para de se mexer!')],
  'derrota-reverso': [F('reverso', 'Previsível.'), F('wells', 'Levante-se, Barry. Espere a investida passar e bata logo depois.')],
  'escapou-reverso': [F('caitlin', 'Ele sumiu do radar. Vai voltar, tenho certeza.')],
};

export const FALAS_SERIE = {
  's1-jitters': { abre: [F('wells', 'Antes de qualquer exame, vá ver a sua família, Sr. Allen. A Srta. West trabalha no Jitters.')] },
  's1-descontrole': { abre: [F('heroi', 'Meu coração não para de acelerar. Eu preciso... correr.')] },
  's1-volta': { abre: [F('caitlin', 'Barry, os sensores captaram você cruzando a cidade. Volta para o S.T.A.R. Labs. O Dr. Wells pediu.')] },
  's1-teste': { abre: [F('wells', 'Primeiro teste, Barry: uma reta longa, CORRER segurado, e não pense. Seu corpo sabe o que fazer.')], fecha: [F('wells', 'Trezentos quilômetros por hora. Anote, Cisco.')] },
  's1-esferas': { abre: [F('caitlin', 'A explosão espalhou fragmentos de matéria escura pela cidade, e eles reagem a você. Recolha cinco.')], fecha: [F('caitlin', 'Seus níveis subiram. O seu corpo guarda essa energia.')] },
  's1-delegacia': { abre: [F('cisco', 'O Joe ligou: a perícia da Delegacia ainda tem um lugar para o Barry Allen. Vai à paisana!')] },
  's1-banco': { abre: [F('cisco', 'Rádio da polícia: assalto a banco numa neblina que não aparece em nenhum satélite. Isso é meta-humano!')], fecha: [F('caitlin', 'O assalto parou. Mas o homem da neblina fugiu.')] },
  's1-vortice': { abre: [F('wells', 'Você é mais rápido que o fogo, Barry. Corra em volta do prédio. Mais rápido. Mais!')] },
  's1-parede': { abre: [F('wells', 'Atrito e velocidade, Barry. Rápido o bastante, a parede vira chão. Corra de frente para um prédio alto.')], fecha: [F('cisco', 'Ele subiu um prédio CORRENDO. Eu tinha uns trinta por cento de certeza.')] },
  's1-vibrar': { abre: [F('wells', 'Se você vibrar rápido o bastante, as suas moléculas passam entre as da matéria. Corra e segure VIBRAR.')], fecha: [F('caitlin', 'Teoria confirmada. Eu precisei sentar depois dessa.'), F('wells', 'Muito bem, Barry. Muito bem.')] },
  's1-patrulha': { abre: [F('cisco', 'O blog da Iris já chama você de "o borrão vermelho". Vamos dar o que ela escrever. Três crimes.')], fecha: [F('cisco', 'O jornal da manhã inteiro é sobre você. Sem foto. Você é rápido demais para foto.')] },
  's1-raio': { abre: [F('wells', 'Treino novo. Quando a energia estiver cheia, solte o raio pelas mãos. Uma gangue no centro serve de alvo.')] },
  's1-supersonico': { abre: [F('cisco', 'Tem um cara de aço no centro com uma gangue. A pele dele é metal. O Dr. Wells tem uma ideia.'), F('wells', 'Corra e bata, Barry. Velocidade é força.')] },
  's1-presidio': { abre: [F('joe', 'O seu pai sabe que você acordou. Eu te levo até Iron Heights. Atravessa a ponte, eu espero lá.')] },
  's1-cafe': { abre: [F('iris', 'Barry, café no Jitters? Eu tenho uma coisa para te mostrar.')] },
  's1-queda': { abre: [F('caitlin', 'Alguém está caindo de um prédio! Vai, vai, vai!')], fecha: [F('caitlin', 'Você chegou a tempo. Ela está bem.')] },
  's1-armadilha': { abre: [F('wells', 'Barry, venha ao Cortex. Eu tenho uma ideia para atrair o homem de amarelo.')] },
  's1-casa': { abre: [F('joe', 'Barry, passa lá em casa. A gente precisa conversar sobre a sua mãe.')] },
};
