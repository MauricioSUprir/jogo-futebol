// A história do jogo (enredo próprio; os personagens só levam os nomes). Dois jeitos de contar:
//  - RÁDIO: uma caixa com o rosto e o nome de quem fala, sem parar o jogo (Caitlin e Cisco no S.T.A.R. Labs e as
//    provocações dos vilões);
//  - CENA: faixas de cinema, o jogo parado e a câmera cortando entre quem fala (plano por cima do ombro de quem ouve,
//    close e plano aberto), com CARTÕES de capítulo em tela cheia. Toque/Enter/BATER avança; "Pular" encerra.
// Enredo: há seis semanas o Núcleo Aurora do S.T.A.R. Labs sobrecarregou e um raio atravessou você. Caitlin cuida do seu
// corpo, Cisco das suas engenhocas. Ato 1 (O Raio): aprender a correr. O Zoom rouba a energia da cidade e, derrotado,
// fala do "homem de amarelo", que sabia do Núcleo antes da explosão. Ato 2 (O guardião): Capitão Frio (com a pistola
// criogênica roubada do laboratório), Onda Térmica e Mago do Tempo — cada um, derrotado, conta que o homem de amarelo o
// ajudou; a cidade dá o nome de Flash. Capítulo 5: as gravações mostram que o Núcleo foi sabotado — era o Flash Reverso,
// que criou você para roubar a sua velocidade e deu poder a todos eles. Ele solta o Zoom e os dois atacam o laboratório.
// Epílogo: o Núcleo liga sozinho.
// A VIDA DO BARRY ALLEN (dono, 26/10): a noite do raio (o Barry trabalhando até tarde na perícia da Delegacia, o vulto no
// canto escuro do laboratório e o raio do Núcleo atravessando tudo), a volta ao trabalho depois do coma, a perícia do museu
// (gelo, um fio amarelo e marcas de raio no asfalto), a ligação do vulto, a troca de roupa escondido, o café da Delegacia, a
// entrevista com a Iris, e as ameaças à família: o Frio congelando a Iris, o Mago cercando a casa dos West e o homem de
// amarelo esperando na cozinha.
// A cidade (entre os capítulos): o detetive Joe, que criou você, na Delegacia Central, em Iron Heights e em casa; a Iris,
// repórter do Picture News, no jornal e no Café Jitters; o apagão que o Zoom deixa; a cidade agradecendo na Prefeitura.

export const PERSONAGENS = {
  caitlin: { nome: 'Caitlin', sigla: 'CA', cor: '#8fd8ff', papel: 'S.T.A.R. Labs · medicina' },
  cisco: { nome: 'Cisco', sigla: 'CI', cor: '#ffb347', papel: 'S.T.A.R. Labs · engenharia' },
  heroi: { nome: 'Você', sigla: 'EU', cor: '#ffd23f' },
  joe: { nome: 'Joe', sigla: 'JW', cor: '#d9c08a', papel: 'Delegacia Central · detetive' },
  iris: { nome: 'Iris', sigla: 'IW', cor: '#ff9ec0', papel: 'Picture News · repórter' },
  zoom: { nome: 'Zoom', sigla: 'Z', cor: '#3fa0ff', vilao: true },
  reverso: { nome: 'Flash Reverso', sigla: 'FR', cor: '#ff3b30', vilao: true },
  frio: { nome: 'Capitão Frio', sigla: 'CF', cor: '#9fe6ff', vilao: true },
  onda: { nome: 'Onda Térmica', sigla: 'OT', cor: '#ff8a3d', vilao: true },
  mago: { nome: 'Mago do Tempo', sigla: 'MT', cor: '#7dffa8', vilao: true },
  savitar: { nome: 'Savitar', sigla: 'SV', cor: '#9fdcff', vilao: true },
  devoe: { nome: 'DeVoe', sigla: 'DV', cor: '#c79bff', vilao: true },
  vulto: { nome: '???', sigla: '?', cor: '#c23a32', vilao: true },
  tv: { nome: 'Canal 4', sigla: 'TV', cor: '#9fb0c8', papel: 'ao vivo' },
  henry: { nome: 'Henry Allen', sigla: 'HA', cor: '#ff3b30', vilao: true },
};

const F = (quem, texto) => ({ quem, texto });
const CARTAO = (rotulo, titulo) => ({ cartao: true, rotulo, titulo });

/** falas por missão: ao começar (abre) e ao concluir (fecha) */
export const MISSOES_FALAS = {
  lab: { fecha: [F('caitlin', 'Bem-vindo ao Cortex. Todos os sensores do laboratório estão apontados para você.'), F('cisco', 'Aquela esteira ali eu chamo de "Pobre Coitada". Você vai entender o motivo.')] },
  velocidade: { abre: [F('cisco', 'Primeiro teste: segure CORRER e passe dos 200 km/h. O velocímetro está com medo.')], fecha: [F('cisco', 'Duzentos! O radar da avenida acabou de pedir demissão.'), F('caitlin', 'Batimentos normais. Nessa velocidade, isso não deveria ser possível.')] },
  esferas: { abre: [F('caitlin', 'A explosão espalhou fragmentos de energia pela cidade, e eles reagem a você. Recolha cinco.')], fecha: [F('caitlin', 'Seus níveis subiram. Seu corpo guarda essa energia como uma bateria.'), F('cisco', 'Uma bateria muito rápida e muito vermelha.')] },
  escalar: { abre: [F('cisco', 'Teoria maluca: rápido o bastante, você sobe pela parede. Corra de frente para um prédio alto.')], fecha: [F('cisco', 'Funcionou! Eu só tinha uns trinta por cento de certeza. Não conta para a Caitlin.'), F('caitlin', 'Eu estou no mesmo canal, Cisco.')] },
  vibrar: { abre: [F('caitlin', 'Se você vibrar rápido o bastante, suas moléculas atravessam a matéria. Em teoria.')], fecha: [F('caitlin', 'Teoria confirmada. Eu precisei sentar depois dessa.')] },
  assalto: { abre: [F('cisco', 'Rádio da polícia: assalto em andamento. É o seu primeiro caso de verdade.')], fecha: [F('cisco', 'O ladrão nem viu de onde você veio. Literalmente.'), F('caitlin', 'A polícia achou ele sentado na calçada, tremendo. Sem um arranhão.')] },
  gangue: { abre: [F('caitlin', 'Uma gangue tomou uma rua do centro. Use os punhos, mas sem exagerar.')], fecha: [F('cisco', 'Vou chamar isso de Punhos Relâmpago. Ninguém me impede.')] },
  especiais: { abre: [F('cisco', 'Com a energia cheia, seus raios ficam absurdos. Testa os golpes especiais numa gangue.')], fecha: [F('cisco', 'Raio, ciclone e sônico. Você virou uma tempestade ambulante.')] },
  portais: { abre: [F('cisco', 'Montei um circuito de portais pela cidade. Setenta segundos. Valendo!')], fecha: [F('cisco', 'Recorde novo! Vou ter que montar um circuito mais difícil.')] },
  fuga: { abre: [F('caitlin', 'Carro em fuga na avenida principal. O motorista acha que é rápido.')], fecha: [F('caitlin', 'Motorista detido. Ninguém se feriu.'), F('cisco', 'Ele disse para a polícia que foi parado por um vento vermelho. Eu adorei.')] },
  incendio: { abre: [F('caitlin', 'Incêndio num prédio! Corra em círculo bem rápido em volta dele: o vácuo apaga o fogo.')], fecha: [F('cisco', 'Você apagou um incêndio CORRENDO. Eu amo esse trabalho.')] },
  queda: { abre: [F('caitlin', 'Alguém está caindo de um prédio! Vai, vai, vai!')], fecha: [F('caitlin', 'Você chegou a tempo. Ela está bem.'), F('caitlin', 'Ela perguntou o seu nome. Eu não soube o que responder.')] },
  patrulha: { abre: [F('caitlin', 'A cidade precisa de você. Impeça cinco crimes.')], fecha: [F('cisco', 'Os jornais só falam do borrão vermelho que salva gente.')] },
  relatorio: { abre: [F('caitlin', 'Volte ao Cortex. Precisamos conversar sobre o que vem por aí.')] },
  // a cidade: o Joe, a Iris e os lugares da história
  delegacia: { abre: [F('caitlin', 'Seis semanas em coma e você já quer voltar ao trabalho? O Joe ligou: a perícia da Delegacia está esperando o Barry.'), F('cisco', 'Vai à paisana. Um perito de roupa vermelha colante chama atenção. Já troquei você.')] },
  // a vida do Barry: a perícia, o café da Delegacia, a entrevista e as ameaças à família (com cronômetro)
  atrasado: { abre: [F('joe', 'O capitão está subindo a escada, Barry. Quarenta e cinco segundos para você estar no laboratório.')] },
  pericia: { abre: [F('joe', 'Estou na cena do museu, na praça da Prefeitura. Os marcadores amarelos são seus: pare em cada um e examine.')] },
  analise: { abre: [F('heroi', 'Gelo, um fio amarelo e um raio queimado no asfalto. Vou passar tudo no microscópio.')] },
  troca: { abre: [F('cisco', 'Você está de camisa e gravata no meio da Delegacia. Do lado do prédio não tem câmera nenhuma. Vai!')], fecha: [F('cisco', 'Trocou de roupa em três décimos de segundo. Recorde mundial de vestiário.')] },
  'cafe-pedido': { abre: [F('joe', 'Barry, a Delegacia inteira está sem café, e o capitão está de mau humor. Doze no Jitters, por minha conta.'), F('cisco', 'Supervelocidade para buscar café. Eu aprovo cem por cento.')],
    fecha: [F('cisco', 'Doze cafés numa bandeja a quinhentos por hora. Se derramar, a culpa é da física.')] },
  'cafe-entrega': { abre: [F('heroi', 'Quarenta segundos até esfriar. Nenhuma gota no chão.')] },
  entrevista: { abre: [F('iris', 'Barry, me encontra na redação do Picture News? Preciso de um perito para a minha coluna.')] },
  'ameaca-iris': { abre: [F('frio', 'Velocista. A sua amiga repórter está tomando um café no Jitters. Bem gelado.'), F('caitlin', 'O gelo está subindo em volta da Iris! Você tem um minuto!')] },
  'ameaca-joe': { abre: [F('mago', 'Bela casa a dos West, Flash. Comece a contar os raios.'), F('cisco', 'A tempestade está toda em cima da casa do Joe! Corre!')] },
  visita: { abre: [F('caitlin', 'Vai para casa descansar, Barry. Hoje a cidade se vira sem você.'), F('cisco', 'Eu fico de olho nos sensores. E no meu sanduíche.')] },
  jornal: { abre: [F('cisco', 'A Iris pediu uma foto para o Picture News. Passe na frente do prédio acima de 300 km/h: a câmera dela vai estar lá.')] },
  energia: { abre: [F('cisco', 'O Zoom drenou três subestações. Metade da cidade está no escuro.'), F('caitlin', 'Encoste em cada uma: a sua energia dá a partida nos geradores. O guia mostra a próxima.')],
    fecha: [F('cisco', 'Luz de volta! A cidade inteira acendeu de uma vez. Eu vi do telhado.'), F('caitlin', 'Os hospitais voltaram também. Obrigada.')] },
  presidio: { abre: [F('caitlin', 'A polícia levou o Capitão Frio para Iron Heights, na ilha. O Joe espera você lá.'), F('cisco', 'É só atravessar a Ponte da Baía. Ponte longa, reta... você vai adorar.')] },
  cafe: { abre: [F('caitlin', 'A Iris mandou mensagem: café no Jitters, agora. Ela disse que não aceita "estou ocupado".')] },
  casa: { abre: [F('cisco', 'O Joe chamou você para jantar em casa. A gente segura a cidade por uma hora.')] },
  prefeitura: { abre: [F('caitlin', 'A cidade inteira está na praça da Prefeitura. Querem agradecer ao Flash.'), F('cisco', 'Vai lá. E, por favor, não pare para dar autógrafo.')] },
  capitulos: { abre: [F('caitlin', 'O homem de amarelo ainda está lá fora. O guia mostra quando ele aparecer.')] },
  fendas: { abre: [F('cisco', 'O Núcleo está rasgando o ar pela cidade! Quatro fendas. E tem coisa saindo de lá.'), F('caitlin', 'Vibre dentro de cada uma, na mesma frequência. Ela deve fechar.')], fecha: [F('cisco', 'Quatro abertas, quatro fechadas. Agora vem pro Cortex: descobri uma coisa.')] },
  tunel: { abre: [F('cisco', 'A avenida principal é reta o bastante. Passe dos 180 e segure. O Núcleo vai te alimentar.')] },
  passado: { abre: [F('caitlin', '...Flash? ...consegue me ouvir? ...o sinal está...'), F('heroi', 'A cidade inteira está como naquela noite. O laboratório brilhando... Eu vou até lá.')] },
};

/** cenas (jogo parado). Um item pode ser um CARTÃO de capítulo em tela cheia. */
export const CENAS = {
  // a noite do raio: o começo de tudo (antes do prólogo; o Barry à paisana na perícia da Delegacia, à noite)
  'noite-do-raio': [
    CARTAO('Seis semanas atrás', 'A noite do raio'),
    F('joe', 'Barry, são onze da noite. A perícia fechou às seis.'),
    F('heroi', 'Só mais esta amostra, Joe. Alguém entrou três vezes no S.T.A.R. Labs e não deixou uma digital sequer.'),
    F('joe', 'Amanhã você olha. Hoje eles ligam aquele tal de Núcleo, e a cidade inteira vai estar olhando para o céu.'),
    F('tv', 'Ao vivo do S.T.A.R. Labs: em poucos minutos, o Núcleo Aurora será ligado pela primeira vez.'),
    { ...F('joe', 'Tranca tudo quando sair. E come alguma coisa, você está pálido.'), acao: 'joeSai' },
    F('heroi', 'Pode deixar.'),
    { ...F('vulto', 'Barry Allen. Pontual como sempre.'), acao: 'vulto' },
    F('heroi', 'Quem está aí? A Delegacia está fechada.'),
    F('vulto', 'Esperei muito tempo por esta noite. Fique exatamente onde está.'),
    F('vulto', 'Você cresceu, Barry. Tem os olhos dela.'),
    F('heroi', 'Foi você. As digitais que sumiram, as peças roubadas do laboratório...'),
    { ...F('tv', 'Atenção: o Núcleo Aurora apresenta instabilidade... a energia está saindo do controle!'), acao: 'tempestade' },
    F('vulto', 'Onze segundos, Barry. É o tempo que o seu coração vai ficar parado.'),
    F('heroi', 'O que você fez?!'),
    F('vulto', 'Eu? Eu só abri a janela.'),
    { ...F('tv', 'Um raio saiu do S.T.A.R. Labs e atravessou o centro da cidade!'), acao: 'raio' },
    CARTAO('Onze segundos', 'O coração parou'),
  ],
  // a cidade: cenas nos lugares da história, com o Joe e a Iris (o herói fica de frente para eles)
  'depois-delegacia': [
    F('joe', 'Olha quem resolveu voltar ao trabalho. Seis semanas em coma e você já quer analisar pegada?'),
    F('heroi', 'Eu estou bem, Joe. Melhor do que bem, na verdade.'),
    F('joe', 'Estou vendo. A cidade inteira fala de um borrão vermelho desde que você acordou. Coincidência engraçada.'),
    F('heroi', 'Joe... eu posso explicar.'),
    F('joe', 'Não precisa. Eu criei você. Conheço esse seu jeito de andar, mesmo a quinhentos por hora.'),
    F('joe', 'Aqui dentro você é o Barry da perícia, ouviu? Ninguém pode saber. Nem a Iris.'),
    F('heroi', 'Nem a Iris.'),
    F('joe', 'E o capitão quer o laudo do museu hoje. Corre para o laboratório, e chega antes dele.'),
  ],
  'depois-atrasado': [
    F('joe', 'Quarenta segundos. Em dois anos de perícia, é a primeira vez que você chega na hora.'),
    F('heroi', 'Acordei disposto.'),
    F('joe', 'Você dormiu seis semanas, Barry. Disposição não te falta.'),
    F('joe', 'O museu foi assaltado ontem à noite: o cofre aberto e nenhum alarme. A cena ainda está isolada, na praça da Prefeitura.'),
    F('heroi', 'Estou indo.'),
    F('joe', 'De carro, de preferência. Como uma pessoa normal.'),
  ],
  'depois-pericia': [
    F('joe', 'E aí, perito? O museu inteiro e nenhuma digital.'),
    F('heroi', 'Gelo, num dia de trinta graus. Um fio de tecido amarelo. E marcas de queimado no asfalto, em forma de raio.'),
    F('joe', 'Amarelo... As testemunhas da noite da explosão falaram de um borrão amarelo.'),
    F('heroi', 'E as marcas no chão são iguais às que eu deixo quando corro.'),
    F('joe', 'Então tem outro igual a você. E ele não está do nosso lado.'),
    F('joe', 'Leva tudo para o laboratório. E fala baixo: a imprensa está do outro lado da fita.'),
  ],
  'depois-analise': [
    F('heroi', 'O tecido não é de roupa nenhuma desta cidade. Ele aguenta o atrito de milhares de quilômetros por hora.'),
    F('vulto', 'Impressionante, senhor Allen. Você sempre foi o melhor perito desta cidade.'),
    F('heroi', 'Quem está falando? Como conseguiu este número?'),
    F('vulto', 'Já nos conhecemos. Na noite do raio, no seu laboratório. Você estava com tanta pressa de jantar.'),
    F('heroi', 'Era você. O que você quer comigo?'),
    F('vulto', 'Que você fique mais rápido. Muito mais rápido. E, para isso, você vai precisar de motivos.'),
    F('vulto', 'O alarme do centro vai tocar em três... dois...'),
    F('cisco', 'Alarme no centro! Assalto em andamento! Barry, você está me ouvindo?'),
    F('heroi', 'Estou. E alguém quer que eu corra.'),
  ],
  'depois-cafe-entrega': [
    F('joe', 'Doze cafés, ainda pelando. O Jitters fica a dois quilômetros daqui, Barry.'),
    F('heroi', 'Peguei um atalho.'),
    F('joe', 'Um atalho. Sei.'),
    F('joe', 'O capitão perguntou como o perito chega antes da viatura em toda cena de crime. Eu disse que você mora perto.'),
    F('heroi', 'Eu moro com você, Joe.'),
    F('joe', 'Exatamente. Agora some daqui antes que ele pergunte de novo.'),
  ],
  'depois-entrevista': [
    F('iris', 'Obrigada por vir. A minha coluna sobre o borrão vermelho precisa de um especialista de verdade.'),
    F('heroi', 'Especialista? Eu só analiso pegadas.'),
    F('iris', 'Então analisa estas: marcas de queimado no asfalto. A que velocidade alguém precisa correr para deixar isso?'),
    F('heroi', 'Uns... trezentos por hora? Chute meu.'),
    F('iris', 'Trezentos e dois. Foi o que o radar da avenida marcou. Engraçado você chutar tão perto.'),
    F('heroi', 'Sorte de principiante. Preciso ir, a perícia me espera.'),
    F('iris', 'Barry? Você está com cheiro de pneu queimado.'),
  ],
  'depois-ameaca-iris': [
    F('iris', 'Flash! O gelo... não para de subir!'),
    { ...F('heroi', 'Fica parada. Vou vibrar o gelo até ele quebrar.'), acao: 'quebraGelo' },
    F('iris', 'Ele entrou, apontou aquela pistola para mim e disse que você viria. Que era tudo um recado.'),
    F('frio', 'Recado entregue, Flash. Da próxima vez, ela não descongela.'),
    F('heroi', 'Se você chegar perto dela de novo, Frio, eu te encontro antes de você puxar o gatilho.'),
    F('iris', 'Espera... essa voz. Eu conheço essa voz.'),
    F('heroi', 'Fica longe das janelas, Iris. Eu cuido dele.'),
  ],
  'depois-ameaca-joe': [
    F('joe', 'Os raios caíram em volta da casa inteira, e nenhum acertou. Ele está brincando com a gente.'),
    F('mago', 'Que família bonita, Flash. Seria uma pena um raio cair duas vezes no mesmo lugar.'),
    F('heroi', 'Joe, sai daqui. Vai para a Delegacia, lá você fica protegido.'),
    F('joe', 'Vinte anos de polícia, Barry. Ninguém me tira da minha casa.'),
    F('joe', 'Vai atrás dele. E volta inteiro, ouviu? Eu já perdi gente demais.'),
    F('heroi', 'Eu volto. Prometo.'),
  ],
  'depois-visita': [
    F('heroi', 'Joe? Iris? ...Tem alguém aí?'),
    F('reverso', 'Bela cozinha, Barry. O Joe ainda faz aquele macarrão às quintas-feiras?'),
    F('reverso', 'E você ainda guarda aquela foto na estante. Ela estava sorrindo naquele dia.'),
    F('heroi', 'Não fala da minha mãe.'),
    F('heroi', 'Essa voz... o telefone, a noite do raio. Era você.'),
    F('reverso', 'Eu estive em todas as noites importantes da sua vida. E vou estar na última.'),
    F('reverso', 'Diga ao Joe que a porta dos fundos estava aberta. Da próxima vez, eu não venho conversar.'),
    { ...F('heroi', 'Fica longe da minha família!'), acao: 'someReverso' },
    F('heroi', 'Sumiu. Só ficou o cheiro de queimado... e um raio vermelho marcado no chão da cozinha.'),
  ],
  'depois-jornal': [
    F('iris', 'Você passou na frente do Picture News a trezentos por hora e ainda voltou para dar oi?'),
    F('heroi', 'Iris! Era para você fotografar o borrão, não eu.'),
    F('iris', 'Eu fotografei. Saiu isto: uma mancha vermelha e um raio. O editor amou.'),
    F('iris', 'Vou chamar a coluna de "O homem mais rápido da cidade". Alguém precisa contar essa história direito.'),
    F('heroi', 'Só não conta o meu nome.'),
    F('iris', 'Que nome? Eu nem consegui ver o seu rosto.'),
  ],
  'depois-presidio': [
    F('joe', 'O Frio está na ala nova. O Cisco desenhou as celas: nem o gelo dele atravessa.'),
    F('heroi', 'Iron Heights... nunca pensei que viria aqui do lado de cá das grades.'),
    F('joe', 'Cada vilão que você pegar vem parar aqui. Vai encher rapidinho.'),
    F('joe', 'E tem mais: todos eles falam de um homem de amarelo. Quem quer que seja, está montando um exército.'),
    F('heroi', 'Então eu vou ser mais rápido que ele.'),
  ],
  'depois-cafe': [
    F('iris', 'Duas xícaras: uma normal e uma com seis doses. Achei que você ia precisar.'),
    F('heroi', 'Você me conhece bem.'),
    F('iris', 'Conheço. Por isso eu sei que tem alguma coisa que você não está me contando.'),
    F('heroi', 'Iris...'),
    F('iris', 'Tudo bem. Quando você estiver pronto, eu estou aqui. Sempre estive.'),
    F('iris', 'Agora vai. Tem alguém lá fora precisando mais de você do que eu.'),
  ],
  'depois-casa': [
    F('joe', 'Senta. Fiz o macarrão que você gostava quando tinha dez anos.'),
    F('heroi', 'O Flash Reverso disse que me criou. Que tudo isso foi plano dele.'),
    F('joe', 'Ele pode ter causado o raio. Mas quem criou você fui eu. E quem escolhe correr para ajudar é você.'),
    F('joe', 'Velocidade não faz um herói. Fazer a coisa certa quando ninguém está olhando, isso sim.'),
    F('heroi', 'Joe... o que aconteceu de verdade na noite do incêndio? Com a minha mãe. Com o meu pai.'),
    F('joe', 'Seu pai... morreu tentando tirar ela de lá. É tudo o que eu sei.'),
    F('heroi', 'Você nunca olha para mim quando fala disso.'),
    F('joe', '...Agora não, Barry. Por favor.'),
    F('joe', 'Come. Depois vai lá e termina isso.'),
  ],
  'depois-prefeitura': [
    F('iris', 'A praça inteira veio. Olha só: tem até cartaz com um raio desenhado.'),
    F('joe', 'O prefeito quer entregar a chave da cidade para o Flash. Pena que ninguém sabe onde ele mora.'),
    F('heroi', 'Talvez ele esteja mais perto do que vocês imaginam.'),
    F('iris', 'Já escrevi a manchete de amanhã: "O Flash salvou a cidade". Eu sabia que você ia gostar do nome.'),
    F('joe', 'E o relógio da Prefeitura voltou a marcar a hora certa. Desde o acidente ele andava sozinho.'),
    F('heroi', 'Bom sinal. Mas o Cisco disse que o Núcleo continua instável.'),
  ],
  prologo: [
    CARTAO('Seis semanas depois', 'O despertar'),
    F('caitlin', 'Seis semanas atrás, o Núcleo Aurora do S.T.A.R. Labs sobrecarregou. A onda de energia cobriu a cidade inteira.'),
    F('caitlin', 'Um raio saiu do Núcleo e atravessou você, no laboratório da Delegacia. O seu coração parou por onze segundos.'),
    F('heroi', 'Tinha alguém comigo naquela noite. Ele sabia o meu nome. Sabia do raio antes de ele cair.'),
    F('caitlin', 'As câmeras da Delegacia não mostram ninguém. Só você e o raio.'),
    F('cisco', 'E aí você acordou e quebrou todos os nossos medidores de velocidade. Todos. Eu tinha um favorito.'),
    F('caitlin', 'Suas células se regeneram rápido demais. O seu corpo continua em movimento mesmo quando você está parado.'),
    F('heroi', 'Então não foi um sonho. Eu sou... rápido.'),
    F('cisco', 'Rápido? Você é o homem mais rápido do mundo. A gente só precisa descobrir quanto.'),
    F('cisco', 'E eu fiz uma roupa que aguenta o atrito. Vermelha, com um raio no peito. Não discute.'),
    F('caitlin', 'Venha até o Cortex. E, por favor, tente não atravessar a parede.'),
    CARTAO('Ato 1', 'Aprendendo a correr'),
  ],
  'depois-escalar': [
    F('caitlin', 'Daí de cima dá para ver o bairro que ficou sem luz na noite do acidente.'),
    F('caitlin', 'Muita gente perdeu tudo naquela noite. E nós ainda não sabemos o que o Núcleo fez com a cidade.'),
    F('heroi', 'Então a gente descobre. E, enquanto isso, eu ajudo quem precisar.'),
    F('cisco', 'Isso foi muito herói da sua parte. Anotado.'),
  ],
  'depois-gangue': [
    F('caitlin', 'Espera. Os sensores captaram um pico de energia do outro lado da cidade.'),
    F('cisco', 'É azul. Não é você. E está se movendo a mais de trezentos por hora.'),
    F('heroi', 'Tem outro como eu.'),
    F('caitlin', 'Ou alguém que quer ser. Seja o que for, está apagando a cidade por onde passa.'),
  ],
  'cap-zoom': [CARTAO('Capítulo 1', 'O velocista de preto')],
  'encontro-zoom': [
    F('zoom', 'Então é você o garoto do raio. Atravessei a cidade para te ver, e você é só isso?'),
    F('heroi', 'Quem é você?'),
    F('zoom', 'Pode me chamar de Zoom. O raio daquela noite também me encontrou. Só que eu soube o que fazer com ele.'),
    F('zoom', 'Os geradores desta cidade alimentam a minha velocidade. Quando eu terminar, a sua também vai ser minha.'),
    F('caitlin', 'Ele está drenando a rede elétrica! Se continuar, os hospitais vão ficar sem luz.'),
    F('heroi', 'Então a sua corrida acaba aqui.'),
    F('zoom', 'Me pega, se conseguir.'),
  ],
  'derrotado-zoom': [
    F('zoom', 'Você é mais rápido... do que ele disse.'),
    F('heroi', 'Ele quem?'),
    F('zoom', 'O homem de amarelo. Foi ele que me deu esta velocidade.'),
    F('zoom', 'Ele sabia do Núcleo Aurora antes da explosão. Ele sabia de você.'),
    F('caitlin', 'Antes da explosão? Isso não pode ser.'),
    F('cisco', 'Vou levar o Zoom para a câmara de contenção. E vou trancar três vezes.'),
    CARTAO('Ato 2', 'O guardião da cidade'),
  ],
  'cap-frio': [
    CARTAO('Capítulo 2', 'Frio de rachar'),
    F('caitlin', 'Alerta no centro: a temperatura de um quarteirão inteiro caiu para trinta graus negativos.'),
    F('cisco', 'E adivinha: a pistola criogênica do laboratório sumiu semana passada. Ladrão com bom gosto.'),
  ],
  'encontro-frio': [
    F('frio', 'Então o famoso borrão vermelho resolveu aparecer. Eu já estava ficando entediado.'),
    F('heroi', 'Você roubou o S.T.A.R. Labs.'),
    F('frio', 'Peguei um brinquedo. Alguém deixou a porta aberta e o código anotado. Gentileza dele.'),
    F('frio', 'Sabe o que o frio faz com as coisas rápidas, Flash? Deixa elas lentas.'),
    F('cisco', 'Não deixa o raio de gelo te acertar! Sai da linha e bate quando ele recarregar.'),
    F('frio', 'Vamos esfriar os ânimos.'),
  ],
  'derrotado-frio': [
    F('frio', 'Tudo bem, tudo bem. Você venceu. Desta vez.'),
    F('heroi', 'Quem te deu o código do laboratório?'),
    F('frio', 'Um sujeito de amarelo. Rápido demais para ser gente.'),
    F('frio', 'Ele disse que você ia aparecer. E que eu ia perder. Odeio quando acertam.'),
    F('caitlin', 'O homem de amarelo de novo. Ele está testando você.'),
  ],
  'cap-onda': [
    CARTAO('Capítulo 3', 'Fogo cruzado'),
    F('caitlin', 'Incêndios em série pelo centro. Os bombeiros não conseguem nem chegar perto.'),
    F('cisco', 'O calor tem a assinatura de energia do Núcleo. Alguém está pondo fogo de propósito.'),
  ],
  'encontro-onda': [
    F('onda', 'Olha só quem veio se esquentar.'),
    F('heroi', 'Desliga isso antes que alguém se machuque.'),
    F('onda', 'Desde a explosão, eu sinto o fogo por dentro. E ele quer sair.'),
    F('onda', 'O homem de amarelo me prometeu que ninguém ia me parar. Nem você.'),
    F('caitlin', 'Fique longe do jato e saia do chão em chamas!'),
    F('onda', 'Queima, Flash!'),
  ],
  'derrotado-onda': [
    F('onda', 'Ele mentiu... Ele disse que eu era imparável.'),
    F('heroi', 'Ele usa vocês. É isso que ele faz.'),
    F('cisco', 'Câmara de contenção com refrigeração extra para o nosso amigo. Pode deixar.'),
  ],
  'cap-mago': [
    CARTAO('Capítulo 4', 'A tempestade'),
    F('cisco', 'Gente, o céu ficou verde. Isso nunca é um bom sinal.'),
    F('caitlin', 'Uma tempestade se formou do nada sobre o centro. Ventos de duzentos por hora e raios a cada segundo.'),
  ],
  'encontro-mago': [
    F('mago', 'Então você é o raio que caiu naquela noite. Eu fui a tempestade.'),
    F('heroi', 'Ninguém controla o tempo.'),
    F('mago', 'Eu controlo. Ele me ensinou como.'),
    F('mago', 'Raios, vento, tornados... e você correndo no meio deles.'),
    F('cisco', 'Quando o chão brilhar em volta de você, sai dali! E não deixa o tornado te puxar!'),
    F('mago', 'Que comece a tempestade.'),
  ],
  'derrotado-mago': [
    F('mago', 'O céu... está calmo de novo.'),
    F('mago', 'Ele disse que eu era só um teste. Que o verdadeiro alvo sempre foi você.'),
    F('caitlin', 'Frio, Onda Térmica, Mago do Tempo, o Zoom... todos ganharam poder com o Núcleo. E todos falam do mesmo homem.'),
    F('heroi', 'Então está na hora de descobrir quem ele é.'),
  ],
  'depois-relatorio': [
    F('caitlin', 'Você fez em semanas o que eu não imaginava em anos.'),
    F('cisco', 'E a cidade inteira está falando de você. Um borrão vermelho que salva pessoas.'),
    F('cisco', 'Você precisa de um nome. Eu tenho uma lista. Uma lista bem longa.'),
    F('caitlin', 'Os jornais já escolheram, Cisco.'),
    F('caitlin', 'Lá fora, estão chamando você de Flash.'),
    F('heroi', 'Flash. Gostei.'),
    F('cisco', 'Tá bom, é melhor que "Furacão Escarlate". Um pouquinho melhor.'),
  ],
  'depois-fendas': [
    F('cisco', 'Analisei a energia das fendas. Elas não são buracos no espaço. São buracos no TEMPO.'),
    F('cisco', 'E batem com a assinatura do Flash Reverso. Ele não chegou ao Núcleo por acaso: ele veio do futuro. O Núcleo é a porta.'),
    F('caitlin', 'Se ele veio do futuro, sabia de tudo porque já tinha visto acontecer.'),
    F('heroi', 'Então eu também vou ver. Vou voltar à noite do acidente.'),
    F('caitlin', 'Correr no tempo? Você pode não conseguir voltar.'),
    F('cisco', 'Ou pode. Passe dos 180 e segure: o Núcleo abre o caminho. Eu fico no rádio o tempo todo.'),
  ],
  'depois-tunel': [
    F('cisco', 'Cento e oitenta, noventa, duzentos... não para! O Núcleo está abrindo o caminho!'),
    F('heroi', 'Estou vendo a cidade inteira... todos os dias ao mesmo tempo.'),
    F('caitlin', 'Pense na noite do acidente. Segure essa lembrança e não solte.'),
    F('cisco', 'Estou perdendo o sinal... se cuida, Flash... sss...'),
    CARTAO('Seis semanas atrás', 'A noite do acidente'),
  ],
  'acidente': [
    F('reverso', 'Você veio. Eu sabia que viria. Já vi este momento mil vezes.'),
    F('heroi', 'Pare! Ninguém precisa se machucar esta noite.'),
    F('reverso', 'Precisa, sim. Sem esta noite não existe Flash. E sem o Flash eu nunca volto para o meu tempo.'),
    F('reverso', 'Mude o passado e você apaga o próprio futuro: a Caitlin, o Cisco, cada pessoa que você salvou.'),
    F('reverso', 'Eu já perdi tudo uma vez, numa noite de fogo. Não vou perder de novo.'),
    F('heroi', 'Então eu não vou mudar nada. Mas um dia eu fecho essa porta. Para sempre.'),
    { ...F('reverso', 'Está na hora.'), acao: 'explosao' },
    CARTAO('Onze segundos', 'O raio encontra você'),
  ],
  'volta-tunel': [
    F('heroi', 'Eu vi tudo. Ele esteve lá o tempo inteiro.'),
    F('cisco', 'Te pegamos! O sinal voltou! Segura firme, estamos te puxando de volta.'),
    F('caitlin', 'Seus batimentos estão em dobro. Como se houvesse dois de você dentro do túnel.'),
    F('cisco', 'Peraí. Tem mais alguém no túnel com você. E está vindo atrás.'),
  ],
  'cap-savitar': [
    CARTAO('Capítulo 6', 'O eco do túnel'),
    F('cisco', 'Uma assinatura saiu do túnel junto com você. É um velocista. E é rápido demais.'),
    F('caitlin', 'Ele está de armadura. Golpe normal mal vai arranhar.'),
  ],
  'encontro-savitar': [
    F('savitar', 'Então você é o menino que corre no tempo como quem atravessa a rua.'),
    F('heroi', 'Quem é você?'),
    F('savitar', 'Savitar. O deus da velocidade.'),
    F('savitar', 'Ou o que sobrou de um velocista que ficou preso no túnel, correndo para sempre entre os dias.'),
    F('savitar', 'Cada vez que você corre no tempo, a porta abre mais. Quando ela abrir de vez, eu saio. Inteiro.'),
    F('caitlin', 'Quebre a armadura primeiro! Os especiais racham mais rápido!'),
    F('heroi', 'Então eu fecho a porta com você do lado de fora.'),
  ],
  'derrotado-savitar': [
    F('savitar', 'A armadura... era tudo o que eu tinha.'),
    F('savitar', 'Você acha que fui eu que abri a porta? Eu só passei por ela.'),
    F('heroi', 'Então quem abriu?'),
    F('savitar', 'O homem que pensa mais rápido do que você corre.'),
    F('caitlin', 'Alguém está usando o Núcleo. E não é um velocista.'),
    CARTAO('Ato 4', 'O Pensador'),
  ],
  'cap-devoe': [
    CARTAO('Capítulo 7', 'O Grande Reinício'),
    F('caitlin', 'Achei. DeVoe, professor de história. Na noite do acidente ele estava a dois quarteirões do laboratório.'),
    F('cisco', 'O raio pegou ele também. Mas em vez de velocidade, ele ganhou a mente mais rápida do mundo.'),
    F('caitlin', 'As fendas, o Savitar, o Núcleo acordando... foi tudo calculado. Por ele.'),
    F('heroi', 'E agora ele quer o Núcleo.'),
  ],
  'encontro-devoe': [
    F('devoe', 'Finalmente. O homem mais rápido do mundo diante do homem mais inteligente.'),
    F('heroi', 'Você abriu as fendas. Você trouxe o Savitar.'),
    F('devoe', 'Eu apenas abri portas. O mundo é lento demais, Flash. Guerras, erros, esquecimento.'),
    F('devoe', 'Com o Núcleo eu mando um pulso pela cidade e cada mente passa a pensar como a minha. Sem medo, sem caos. O Grande Reinício.'),
    F('cisco', 'As três torres em volta dele alimentam um escudo! Derruba as torres primeiro!'),
    F('devoe', 'Corra, Flash. Eu já sei para onde.'),
  ],
  'derrotado-devoe': [
    F('devoe', 'Eu calculei tudo... menos você.'),
    F('devoe', 'Não importa. O Núcleo já está em contagem. Em minutos ele engole a cidade inteira.'),
    F('caitlin', 'Ele tem razão! A energia do Núcleo está fora de controle! Volta para o Cortex, agora!'),
  ],
  'depois-nucleo': [
    F('caitlin', 'Se o Núcleo explodir de novo, a onda vai muito além da cidade.'),
    F('cisco', 'Não dá para desligar. Mas dá para fechar a porta por dentro. Alguém tem que correr dentro dele até ele se apagar.'),
    F('heroi', 'Então sou eu.'),
    F('caitlin', 'Você pode não voltar.'),
    F('heroi', 'Seis semanas atrás, um raio me escolheu. Agora quem escolhe sou eu.'),
    { ...F('heroi', 'Estou entrando.'), acao: 'nucleo' },
    CARTAO('O coração do raio', 'Dentro do Núcleo Aurora'),
    F('heroi', 'Eu vejo tudo... a noite do acidente, a primeira corrida, cada pessoa que a gente salvou.'),
    F('reverso', 'Você conseguiu, Flash. A porta está fechando. E eu nunca mais volto para o meu tempo.'),
    F('heroi', 'A sua máscara... está rachando.'),
    CARTAO('O homem de amarelo', 'Sem a máscara'),
    F('heroi', '...Não. Não pode ser.'),
    F('henry', 'Oi, filho.'),
    F('heroi', 'Pai? Você morreu no incêndio. O Joe disse que você morreu tentando salvar a mamãe.'),
    F('henry', 'Naquela noite eu corri pela primeira vez. Rápido demais. E a sua mãe estava no caminho.'),
    F('henry', 'Fugi para o futuro e passei vinte anos tentando desfazer. A única porta era o Núcleo. A única chave era você.'),
    F('heroi', 'Você me usou. A minha vida inteira.'),
    F('henry', 'Eu te dei a velocidade. Era o único presente que eu ainda podia te dar.'),
    F('henry', 'A porta está fechando. Corra, Barry. Corra para longe de mim. Para sempre.'),
    F('heroi', 'Você ficou preso no passado que você mesmo destruiu. Eu escolho o futuro.'),
    F('caitlin', 'Volta para a gente. Segue a minha voz.'),
    { ...F('cisco', 'O Núcleo apagou! Apagou de vez! Cadê ele?!'), acao: 'volta' },
    F('heroi', 'Aqui. Eu disse que voltava.'),
    CARTAO('Epílogo', 'Uma semana depois'),
    F('heroi', 'Joe... você sabia?'),
    F('joe', 'Eu sabia que ele não tinha morrido naquele fogo. Jurei para a sua mãe que nunca ia te contar.'),
    F('joe', 'Me perdoa, filho.'),
    F('heroi', 'Você me criou, Joe. Pai é quem fica.'),
    F('cisco', 'O Núcleo Aurora está desligado. De verdade, desta vez. Eu chequei sete vezes.'),
    F('caitlin', 'Zoom, Reverso, Frio, Onda Térmica, Mago do Tempo, Savitar e DeVoe: todos na contenção. A cidade está em paz.'),
    F('cisco', 'E tem uma estátua sua na praça. Mais ou menos parecida.'),
    F('caitlin', 'Você salvou todo mundo. De novo.'),
    F('heroi', 'A gente salvou. Sempre foi a gente.'),
    F('cisco', 'Tá, isso foi emocionante. Agora: alguém viu o meu sanduíche?'),
    CARTAO('THE FLASH', 'Fim'),
  ],
  'cap-reverso': [
    CARTAO('Capítulo 5', 'O homem de amarelo'),
    F('heroi', 'Ele esteve na minha casa, Cisco. Ele sabe quem eu sou.'),
    F('cisco', 'Então a gente descobre quem ELE é. Revi as gravações da noite do acidente. Quadro a quadro.'),
    F('cisco', 'Dois segundos antes da explosão aparece um borrão amarelo e vermelho dentro do Núcleo.'),
    F('caitlin', 'Alguém sabotou o Núcleo Aurora de propósito.'),
    F('heroi', 'E esse alguém está na cidade agora.'),
  ],
  'encontro-reverso': [
    F('reverso', 'Finalmente, Flash. Esperei muito tempo por esta conversa.'),
    F('heroi', 'Foi você. O Núcleo, o Zoom... tudo.'),
    F('reverso', 'E o seu laboratório, naquela noite. Alguém precisava garantir que você estaria no lugar certo.'),
    F('reverso', 'O Núcleo precisava de um raio, e o raio precisava de alguém para atravessar. Eu escolhi você.'),
    F('reverso', 'Você é a minha obra. E toda obra pode ser desfeita.'),
    F('cisco', 'A energia dele é vermelha e está fora da escala. Ele é mais rápido que o Zoom!'),
    F('reverso', 'Corra, Flash. É a única coisa que eu te ensinei.'),
  ],
  'derrotado-reverso': [
    F('reverso', 'Impressionante. Você aprendeu mais rápido do que eu calculei.'),
    F('reverso', 'Um dia você vai ver o meu rosto, Barry. E vai desejar nunca ter visto.'),
    F('reverso', 'Mas eu nunca deixo um aliado para trás.'),
    F('caitlin', 'Alarme na câmara de contenção! O Zoom escapou!'),
    F('reverso', 'Nos vemos no laboratório, Flash.'),
  ],
  'cap-final': [CARTAO('Capítulo final', 'Dois contra um')],
  'encontro-final': [
    F('reverso', 'Pontual. Eu sabia que você viria.'),
    F('zoom', 'Desta vez somos dois, garoto.'),
    F('reverso', 'Com o Núcleo, eu volto a ser o homem mais rápido que já existiu. Ninguém vai me alcançar.'),
    F('caitlin', 'Você não está sozinho. Nós estamos aqui com você.'),
    F('cisco', 'Vibra quando eles avançarem, bate quando cansarem. Igual a gente treinou!'),
    F('heroi', 'Então vamos terminar isso.'),
  ],
  'derrotado-final': [
    F('caitlin', 'O Núcleo está seguro. E a cidade também.'),
    F('cisco', 'Zoom e Flash Reverso na câmara de contenção. Desta vez com seis trancas.'),
    F('heroi', 'Eles vão tentar fugir.'),
    F('caitlin', 'E você vai estar lá. Sempre um passo à frente.'),
    CARTAO('Fim do Ato 2', 'O Núcleo acordou'),
    F('cisco', 'Gente... o Núcleo Aurora acabou de ligar sozinho.'),
    F('caitlin', 'Impossível. Ele está desligado desde a explosão.'),
    F('cisco', 'Tem alguma coisa do outro lado dele. E está olhando pra gente.'),
    CARTAO('Ato 3', 'Fendas no tempo'),
  ],
};

/** falas de rádio dos capítulos (sem parar o jogo) */
export const RADIO = {
  'capitulo-zoom': [F('caitlin', 'O pico azul está no centro, drenando os geradores da cidade.'), F('cisco', 'O guia está marcando. Vai lá ver quem é.')],
  'capitulo-reverso': [F('cisco', 'A assinatura vermelha está se movendo pela cidade. O guia mostra onde.')],
  'capitulo-final': [F('caitlin', 'Alarme no S.T.A.R. Labs! Os dois estão na porta do laboratório!'), F('cisco', 'Eles querem o Núcleo. Volta pra cá, rápido!')],
  'luta-zoom': [F('caitlin', 'Ele é mais rápido em linha reta, mas cansa depois da investida. É aí que você bate.')],
  'luta-reverso': [F('reverso', 'Eu conheço cada movimento seu. Fui eu que os criei.'), F('caitlin', 'Quando o chão brilhar, corra de lado ou vibre. Depois da investida ele fica aberto!')],
  'luta-final': [F('cisco', 'Dois contra um. Não para de se mexer e vibra quando eles vierem!')],
  'perseguicao-zoom': [F('cisco', 'Ele passou dos 200 km/h! E você não está gastando energia: o raio azul está te carregando!'), F('caitlin', 'Fique colado nele. Quando chegar perto, aperte BATER.')],
  'perseguicao-reverso': [F('caitlin', 'Ele é mais rápido que você descansado. Espere ele cansar e encoste.')],
  'fase2-reverso': [F('caitlin', 'Os níveis dele dispararam! Não pare de se mexer!')],
  'derrota-zoom': [F('zoom', 'Lento demais.'), F('caitlin', 'Respira. Corra de lado quando ele avançar e bata quando ele parar.')],
  'derrota-reverso': [F('reverso', 'Previsível.'), F('caitlin', 'Ele também cansa, Flash. Espere a investida passar e bata logo depois.')],
  'derrota-final': [F('reverso', 'Você nunca vai ser rápido o bastante.'), F('cisco', 'Foca num de cada vez. O Zoom cai primeiro!')],
  'capitulo-frio': [F('cisco', 'O guia mostra onde ele está. Leva um casaco.')],
  'luta-frio': [F('caitlin', 'O raio de gelo deixa você lento. Saia da linha brilhante e ataque quando ele recarregar.')],
  'derrota-frio': [F('frio', 'Congelado.'), F('caitlin', 'Depois de cada tiro ele fica parado recarregando. É a sua chance.')],
  'capitulo-onda': [F('caitlin', 'Ele está no meio do fogo. O guia mostra onde.')],
  'luta-onda': [F('cisco', 'O lança-chamas tem alcance curto. Fique longe e entre quando ele parar.')],
  'derrota-onda': [F('onda', 'Torradinho.'), F('caitlin', 'Ataque com os especiais de longe e não pise no fogo.')],
  'capitulo-mago': [F('cisco', 'O olho da tempestade está marcado no guia.')],
  'luta-mago': [F('caitlin', 'Os raios caem onde você está. Não fique parado!')],
  'derrota-mago': [F('mago', 'A tempestade sempre vence.'), F('cisco', 'Corre em volta dele: os raios erram quem não para.')],
  'capitulo-savitar': [F('cisco', 'O guia mostra onde ele está. Cuidado: ele é mais rápido que o Reverso descansado.')],
  'perseguicao-savitar': [F('caitlin', 'Espere ele cansar e encoste. Ele fica mais lento depois de cada arrancada.')],
  'luta-savitar': [F('caitlin', 'Primeiro a armadura! Use os especiais quando ele cansar.')],
  'armadura-savitar': [F('cisco', 'A armadura quebrou! Agora ele sente cada golpe!'), F('savitar', 'Você não sabe o que fez.')],
  'fase2-savitar': [F('caitlin', 'Ele está mais rápido sem a armadura! Não para de se mexer!')],
  'derrota-savitar': [F('savitar', 'Eu sou o deus da velocidade.'), F('caitlin', 'Os especiais racham a armadura mais rápido. Junte energia e use quando ele cansar.')],
  'escapou-savitar': [F('cisco', 'Sumiu no túnel. Ele volta.')],
  'capitulo-devoe': [F('caitlin', 'Ele está em frente ao S.T.A.R. Labs. O guia mostra.')],
  'luta-devoe': [F('cisco', 'O círculo no chão é onde o carro cai! E quando o anel crescer em volta dele, PULA!')],
  'escudo-devoe': [F('cisco', 'O escudo caiu! Agora é com você!')],
  'fase2-devoe': [F('caitlin', 'Ele reergueu as torres! Derruba de novo!')],
  'derrota-devoe': [F('devoe', 'Previsível.'), F('caitlin', 'Derrube as torres com os especiais e acerte o verdadeiro: as cópias somem com um golpe.')],
  'escapou-zoom': [F('caitlin', 'Perdemos o sinal dele. Ele vai aparecer de novo.')],
  'escapou-reverso': [F('caitlin', 'Ele sumiu do radar. Vai voltar, tenho certeza.')],
  // o cronômetro de um passo da vida do Barry acabou (missoes.js `tempo`): a história recomeça a contagem (ou volta um passo)
  'falhou-atrasado': [F('joe', 'O capitão chegou e você não estava. Eu disse que você foi ao banheiro. Mais quarenta e cinco segundos!')],
  'falhou-cafe-entrega': [F('joe', 'Café frio, Barry? O capitão já devolveu o dele. Volta lá e pega outro.')],
  'falhou-ameaca-iris': [F('caitlin', 'O gelo chegou ao pescoço dela! O Cisco ligou o aquecedor do Jitters no máximo: mais um minuto. Vai!')],
  'falhou-ameaca-joe': [F('cisco', 'Um raio caiu no telhado! O Joe está bem, mas o próximo não erra. Mais rápido!')],
};
const PROVOCA = { savitar: ['Lento.', 'Eu já estive aqui antes.', 'Você vai virar o que eu sou.'], zoom: ['Sorte.', 'Ainda não.', 'Você está ficando lento.'], reverso: ['Isso não é nada.', 'Perto. Mas não o bastante.', 'Eu deixei.', 'Você está me divertindo.'] };

const rnd = (a, b) => a + Math.random() * (b - a);

export function criarHistoria({ armazem = null, raiz = document.body } = {}) {
  const CHAVE = 'theflash.historia.v1';
  let salvo = null; try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  const vistas = new Set(salvo?.vistas || []);
  let capitulo = salvo?.capitulo || null;                    // o último cartão de capítulo visto (aparece na pausa)
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify({ vistas: [...vistas], capitulo })); } catch { /* sem armazenamento */ } };
  const marcar = (id) => { vistas.add(id); gravar(); };

  // ---------- rádio ----------
  const radio = document.createElement('div'); radio.id = 'radio'; radio.innerHTML = '<i class="retrato"></i><div><b></b><span></span></div>';
  document.getElementById('hud').appendChild(radio);
  const rRetrato = radio.querySelector('.retrato'), rNome = radio.querySelector('b'), rTexto = radio.querySelector('span');
  const fila = []; let falando = null, tFala = 0;
  function falar(falas) { for (const f of falas) fila.push(f); }
  // o rosto de cada personagem (tools/gerar-retratos.mjs renderiza a partir do modelo 3D); quem não tem fica com a sigla
  const RETRATOS = ['heroi', 'zoom', 'reverso', 'caitlin', 'cisco', 'joe', 'iris', 'frio', 'onda', 'mago', 'savitar', 'devoe'];
  const retratos = Object.fromEntries(RETRATOS.map((id) => [id, new URL(`../assets/personagens/retratos/${id}.webp`, import.meta.url).href]));
  for (const url of Object.values(retratos)) new Image().src = url;                    // já baixados quando a 1ª fala aparecer
  function mostrar(el, ret, nome, f) {
    const p = PERSONAGENS[f.quem] || PERSONAGENS.caitlin, img = retratos[f.quem];
    ret.textContent = img ? '' : p.sigla; ret.style.background = img ? `url(${img}) center/cover, ${p.cor}` : p.cor;
    ret.classList.toggle('foto', !!img); ret.style.setProperty('--cor', p.cor);
    nome.textContent = p.nome; nome.style.color = p.cor;
    el.classList.toggle('vilao', !!p.vilao);
  }

  // ---------- cena ----------
  const cena = document.createElement('div'); cena.id = 'cenaHist'; cena.hidden = true;
  cena.innerHTML = '<div class="faixa cima"></div><div class="faixa baixo"><i class="retrato"></i><div class="fala"><b></b><p></p><small>Toque para continuar</small></div></div>'
    + '<div class="cartao"><small></small><h2></h2><i></i></div><button type="button" class="pular">Pular</button>';
  raiz.appendChild(cena);
  const cRetrato = cena.querySelector('.retrato'), cNome = cena.querySelector('b'), cTexto = cena.querySelector('p');
  const cartao = cena.querySelector('.cartao'), kRotulo = cartao.querySelector('small'), kTitulo = cartao.querySelector('h2');
  let C = null;                                              // {falas, i, t, letras, aoFim, focos, plano}
  let opcAtual = null;                                       // opções da cena que está começando ({aoAcao})
  function iniciarCena(id, focos, aoFim) {
    const falas = CENAS[id]; if (!falas) { aoFim?.(); return false; }
    C = { id, falas, i: 0, t: 0, letras: 0, aoFim, focos, ang: Math.random() * 6.28, plano: null, ultimo: null, aoAcao: opcAtual?.aoAcao };
    marcar(`cena:${id}`); cena.hidden = false; document.body.classList.add('em-cena'); radio.classList.remove('vis'); falando = null;
    mostrarFala(); return true;
  }
  function mostrarFala() {
    const f = C.falas[C.i]; C.letras = 0; C.t = 0;
    cena.classList.toggle('so-cartao', !!f.cartao);
    if (f.cartao) {
      kRotulo.textContent = f.rotulo; kTitulo.textContent = f.titulo;
      if (f.rotulo !== 'Continua...') { capitulo = `${f.rotulo} — ${f.titulo}`; gravar(); }
      cartao.classList.remove('vis'); void cartao.offsetWidth; cartao.classList.add('vis');
      return;
    }
    cartao.classList.remove('vis');
    mostrar(cena, cRetrato, cNome, f); cTexto.textContent = '';
    if (f.acao) C.aoAcao?.(f.acao);                                   // a fala dispara algo no mundo (a explosão do Núcleo)
    C.plano = escolherPlano(f); C.ultimo = f.quem;
  }
  function avancar() {
    if (!C) return;
    const f = C.falas[C.i];
    if (!f.cartao && C.letras < f.texto.length) { C.letras = f.texto.length; cTexto.textContent = f.texto; return; }   // 1º toque completa o texto
    if (f.cartao && C.t < 0.6) return;                                                                                   // o cartão aparece inteiro
    C.i++;
    if (C.i >= C.falas.length) return terminar();
    mostrarFala();
  }
  function terminar() {
    if (!C) return;
    // pulou: o capítulo da história avança do mesmo jeito (o último cartão que ainda viria)
    for (let k = C.i; k < C.falas.length; k++) { const f = C.falas[k]; if (f.cartao && f.rotulo !== 'Continua...') capitulo = `${f.rotulo} — ${f.titulo}`; }
    gravar();
    const fim = C.aoFim; C = null; cena.hidden = true; cartao.classList.remove('vis'); cena.classList.remove('so-cartao'); document.body.classList.remove('em-cena'); fim?.(); }
  cena.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target.closest('.pular')) terminar(); else avancar(); });

  /** atualiza a cada quadro (dt real) */
  function atualizar(dt) {
    if (C) {
      const f = C.falas[C.i]; C.t += dt;
      if (f.cartao) { if (C.t > 3.4) avancar(); return; }
      if (C.letras < f.texto.length) { C.letras = Math.min(f.texto.length, C.letras + dt * 45); cTexto.textContent = f.texto.slice(0, Math.floor(C.letras)); }
      else if (C.t > 2.2 + f.texto.length * 0.055) avancar();                       // avança sozinho depois de dar tempo de ler
      return;
    }
    if (falando) { tFala -= dt; if (tFala <= 0) { falando = null; radio.classList.remove('vis'); } }
    else if (fila.length) {
      falando = fila.shift(); tFala = 2.4 + falando.texto.length * 0.05;
      mostrar(radio, rRetrato, rNome, falando); rTexto.textContent = falando.texto; radio.classList.add('vis');
    }
  }

  // ---------- câmera da cena: um plano por fala, cortando entre quem fala e quem ouve ----------
  const ponto = (k) => { const fn = C.focos[k]; return fn ? fn() : null; };
  /** quem está presente na cena (os focos com posição), tirando `menos` */
  const presentes = (menos) => Object.keys(C.focos).filter((k) => k !== 'padrao' && k !== menos && ponto(k));
  function escolherPlano(f) {
    // quem fala está em cena (tem foco)? Senão fala pelo rádio, e a câmera mostra quem escuta
    const emCena = f.quem !== 'heroi' && !!ponto(f.quem);
    const alvo = f.quem === 'heroi' ? (ponto('heroi') ? 'heroi' : 'padrao') : emCena ? f.quem : (ponto('heroi') ? 'heroi' : 'padrao');
    const ouvintes = presentes(alvo), outro = ouvintes.includes('heroi') ? 'heroi' : ouvintes[0] || null;
    const mesmo = C.ultimo === f.quem;
    // pelo rádio: plano aberto de quem escuta, girando; quem está em cena: por cima do ombro ou close
    let tipo;
    if (f.quem !== 'heroi' && !emCena) tipo = outro && Math.random() < 0.5 ? 'dois' : 'aberto';
    else if (outro && !mesmo) tipo = 'ombro';
    else tipo = 'close';
    return { tipo, alvo, outro, lado: Math.random() < 0.5 ? -1 : 1, ang: rnd(-0.7, 0.7), t: 0, emCena };
  }
  function camera(cam, dt) {
    if (!C) return false;
    const f = C.falas[C.i];
    if (f.cartao) return !!C.plano;                                  // o cartão cobre a tela: a câmera fica onde estava
    // quem fala entrou em cena depois de o plano ser escolhido (o vulto aparece na própria fala): refaz o plano para ele
    if (C.plano && !C.plano.emCena && f.quem !== 'heroi' && ponto(f.quem)) C.plano = escolherPlano(f);
    const pl = C.plano; if (!pl) return false;
    const a = ponto(pl.alvo); if (!a) return false;
    const o = pl.outro ? ponto(pl.outro) : null;
    pl.t += dt; const deriva = pl.t * 0.12;                           // um movimento lento dentro do plano
    let px, py, pz, lx = a.x, ly = a.y + 1.5, lz = a.z, fov = 40;
    if ((pl.tipo === 'ombro' || pl.tipo === 'dois') && o) {
      // por trás do ombro de quem ouve, olhando para quem fala (no 'dois', mais aberto e com os dois no quadro)
      let dx = a.x - o.x, dz = a.z - o.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const atras = pl.tipo === 'dois' ? 3.2 + deriva : 1.15 + deriva * 0.4, lado = (pl.tipo === 'dois' ? 1.6 : 0.8) * pl.lado;
      px = o.x - dx * atras - dz * lado; pz = o.z - dz * atras + dx * lado; py = o.y + (pl.tipo === 'dois' ? 2.2 : 1.62);
      if (pl.tipo === 'dois') { lx = (a.x + o.x) / 2; lz = (a.z + o.z) / 2; ly = (a.y + o.y) / 2 + 1.3; fov = 46; }
      else { ly = a.y + 1.35; fov = 32; }
    } else if (pl.tipo === 'close') {
      // de frente para quem fala, um pouco de lado, à altura do rosto
      const ref = o || ponto('heroi') || a, h = Math.atan2(ref.x - a.x, ref.z - a.z) + pl.ang;
      const d = 2.4 - deriva * 0.3;
      px = a.x + Math.sin(h) * d; pz = a.z + Math.cos(h) * d; py = a.y + 1.62; ly = a.y + 1.55; fov = 34;
    } else {
      // aberto: gira devagar em volta de quem escuta
      C.ang += dt * 0.15;
      const d = C.id.endsWith('-final') ? 7 : 4.6;
      px = a.x + Math.sin(C.ang + pl.ang) * d; pz = a.z + Math.cos(C.ang + pl.ang) * d; py = a.y + 2.1; ly = a.y + 1.3; fov = 46;
    }
    cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    return true;
  }

  return {
    atualizar, camera, avancar, pular: terminar,
    get emCena() { return !!C; }, get cenaAtual() { return C?.id || null; },
    /** quem está falando agora (na cena ou no rádio): o modelo dele gesticula */
    get quemFala() { if (C) { const f = C.falas[C.i]; return f.cartao ? null : f.quem; } return falando?.quem || null; },
    /** o rosto de um personagem para a caixa de fala */
    definirRetrato(id, url) { retratos[id] = url; },
    /** a cena ainda vai tocar (não foi vista e não é um teste automático sem ?historia=1) */
    vaiTocar(id) { return !!CENAS[id] && !vistas.has(`cena:${id}`) && !(navigator.webdriver && !/[?&]historia=1/.test(location.search)); },
    /** o rádio terminou de falar (nada na fila) */
    get radioLivre() { return !falando && !fila.length; },
    /** cala o rádio agora (testes: sem GPU o jogo roda a menos de 1 quadro por segundo e cada fala dura minutos) */
    calarRadio() { fila.length = 0; falando = null; radio.classList.remove('vis'); },
    get capitulo() { return capitulo; },
    get cartaoAtual() { const f = C?.falas[C.i]; return f?.cartao ? `${f.rotulo} — ${f.titulo}` : null; },
    viu: (id) => vistas.has(id),
    tem: (id) => !!CENAS[id],
    /** a cena (uma vez só, a não ser que `sempre`). `focos`: função (o foco) ou {heroi, zoom, reverso, padrao: () => ponto} */
    cena(id, focos, aoFim, { sempre = false } = {}) {
      // nos testes automáticos as cenas só rodam com ?historia=1 (os outros testes esperam o jogo correndo)
      if (!CENAS[id] || (!sempre && vistas.has(`cena:${id}`)) || (navigator.webdriver && !/[?&]historia=1/.test(location.search))) { aoFim?.(); return false; }
      const fs = typeof focos === 'function' ? { padrao: focos } : { ...(focos || {}) };
      if (!fs.padrao) fs.padrao = fs.heroi || Object.values(fs)[0] || (() => null);
      opcAtual = arguments[3] || null;
      return iniciarCena(id, fs, aoFim);
    },
    /** falas de rádio de um momento (uma vez só, a não ser que `sempre`) */
    radio(id, { sempre = false } = {}) { const falas = RADIO[id]; if (!falas || (!sempre && vistas.has(`radio:${id}`))) return; marcar(`radio:${id}`); falar(falas); },
    missao(id, momento) { const falas = MISSOES_FALAS[id]?.[momento]; const k = `missao:${id}:${momento}`; if (!falas || vistas.has(k)) return; marcar(k); falar(falas); },
    provocar(vilao, n) { const v = PROVOCA[vilao]; if (v) falar([F(vilao, v[(n - 1) % v.length])]); },
    zerar() { vistas.clear(); capitulo = null; gravar(); },
  };
}
