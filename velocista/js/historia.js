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
  // Parte 2: a mãe e o pai da linha do tempo alterada (só a voz: a câmera fica no herói), a Nevasca (a Caitlin daquele
  // mundo: o mesmo rosto) e o Corredor Negro
  nora: { nome: 'Nora Allen', sigla: 'NA', cor: '#f2c6a0', papel: 'sua mãe' },
  pai: { nome: 'Henry Allen', sigla: 'HA', cor: '#c9b28a', papel: 'seu pai' },
  nevasca: { nome: 'Nevasca', sigla: 'NV', cor: '#dff4ff', vilao: true, retrato: 'caitlin' },
  negro: { nome: 'Corredor Negro', sigla: '—', cor: '#c8ccd6', vilao: true },
  // Atos 7 e 8: o perito novo, o capitão da Delegacia (sem a máscara), a filha dele, a Cigarra mascarada e o Godspeed
  august: { nome: 'August', sigla: 'AH', cor: '#e8d7a8', papel: 'Delegacia Central · perito' },
  dwyer: { nome: 'Capitão Dwyer', sigla: 'CD', cor: '#a9c48f', papel: 'Delegacia Central · capitão' },
  grace: { nome: 'Grace', sigla: 'GD', cor: '#ffd9e8' },
  cigarra: { nome: 'Cigarra', sigla: 'CG', cor: '#9dff6a', vilao: true },
  godspeed: { nome: 'Godspeed', sigla: 'GS', cor: '#f2e6c4', vilao: true },
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
  // Parte 2
  'p2-limite': { abre: [F('heroi', 'Só um teste. Só para saber se eu consigo.'), F('cisco', 'Barry, por que o velocímetro do Cortex está piscando? Barry?')],
    fecha: [F('caitlin', 'Quatrocentos. Barry, para agora. O que você está fazendo?'), F('heroi', 'Desculpa, Caitlin. Eu prometi pensar. Eu pensei.')] },
  'p2-tunel': { abre: [F('cisco', 'O túnel está abrindo! Barry, não faz isso! Você não sabe o que vai quebrar!')] },
  'p2-mundo': { abre: [F('heroi', 'Cisco? Caitlin? Ninguém no rádio...'), F('heroi', 'E as minhas pernas estão pesadas. Como se o raio estivesse indo embora.')] },
  'p2-joe': { abre: [F('heroi', 'O Joe. O Joe sempre sabe o que fazer.')] },
  'p2-iris': { abre: [F('heroi', 'Fim de tarde. A Iris nunca perdeu um café no Jitters, em nenhum mundo.')] },
  'p2-assalto': { abre: [F('heroi', 'Um assalto. Mesmo mais lento, eu ainda consigo.')], fecha: [F('heroi', 'Ainda sou o Flash. Por enquanto.')] },
  'p2-cisco': { abre: [F('heroi', 'A Torre Ramon. Se alguém neste mundo pode entender o que eu fiz, é o Cisco.')] },
  'p2-esferas': { abre: [F('cisco', 'Meus satélites mostram as esferas. Pega cinco, e rápido: o seu sinal está ficando fraco.')],
    fecha: [F('cisco', 'Cinco! O seu sinal estabilizou. Por enquanto.'), F('cisco', 'Má notícia: a Nevasca está no centro. E está procurando VOCÊ.')] },
  'p2-mae': { abre: [F('heroi', 'A mesma casa. A mesma porta. E do outro lado, a voz dela.')] },
  'p2-desfazer': { abre: [F('heroi', 'Me desculpa, mãe.'), F('cisco', 'O túnel abre uma última vez com a energia que sobrou. Não erra.')] },
  'p2-volta': { abre: [F('caitlin', 'Barry? Barry! O sinal dele voltou! Cisco, ele voltou!')] },
  'p2-boatos': { abre: [F('iris', 'Barry, passa na redação? Tem uma coisa nas minhas fotos que eu não consigo explicar.')] },
  'p2-silhueta': { abre: [F('caitlin', 'O sinal está parado no meio da praça. Vai devagar, Barry.')] },
  'p2-celas': { abre: [F('caitlin', 'Alarme na contenção! Barry, vem para o laboratório, agora!')] },
  'p2-incendio': { abre: [F('cisco', 'Incêndio num prédio do centro. Pelo menos esse inimigo eu entendo.')],
    fecha: [F('caitlin', 'Fogo apagado. Barry... o sinal frio voltou ao radar. E está vindo na sua direção.')] },
  'p2-fuga': { abre: [F('cisco', 'Ele está atrás de você! Corre para o Cortex: eu armei uma armadilha de energia!'), F('caitlin', 'Não para, Barry! Não deixa ele encostar!')] },
  'p2-lista': { abre: [F('iris', 'Barry, vem para o Jitters. Chegou uma carta na redação. Sem remetente.')] },
  'p2-iron': { abre: [F('joe', 'Barry, vem para Iron Heights. Agora. Aconteceu uma coisa que eu não sei explicar.')] },
  'p2-august': { abre: [F('joe', 'Tem um perito novo no seu laboratório. Ele chegou na hora. Isso já te deixa em desvantagem.')] },
  'p2-anel': { abre: [F('joe', 'Passa lá em casa, Barry. Sozinho. Sem a Iris.')] },
  'p2-pedido': { abre: [F('cisco', 'O anel está no seu bolso esquerdo. Não, no outro. Respira.')] },
  'p2-gangue': { abre: [F('caitlin', 'Uma gangue tomou uma rua do centro. Todos de máscara, com uma cigarra desenhada.')],
    fecha: [F('caitlin', 'Eles disseram que obedecem à Cigarra. Nenhum viu o rosto.'), F('cisco', 'Seita de inseto. Era só o que faltava.')] },
  'p2-adaga': { abre: [F('cisco', 'Alarme na praça da Prefeitura! Alguém com uma faca que brilha mais que o meu monitor!')] },
  'p2-sempoderes': { abre: [F('heroi', 'As pernas não respondem. Eu estou andando como qualquer pessoa.')] },
  'p2-esferas2': { abre: [F('caitlin', 'Metade da velocidade voltou. As esferas da cidade completam o resto. Cinco.')],
    fecha: [F('caitlin', 'Velocidade total! Bem-vindo de volta, Flash.'), F('cisco', 'Agora vê se não leva outra facada, por favor.')] },
  'p2-grace': { abre: [F('iris', 'Barry, eu sei quem é a Cigarra. Vem para a sala do editor. Agora.')] },
  'p2-casamento': { abre: [F('joe', 'Barry. A cerimônia começou há dez minutos. A noiva está aqui. Onde você está?')] },
  'p2-subestacoes': { abre: [F('cisco', 'Um velocista de prata está drenando as subestações! A cidade está apagando de novo!'), F('caitlin', 'Encoste em cada uma e religue os geradores. O guia mostra a próxima.')],
    fecha: [F('cisco', 'Luz de volta! Mas ele fugiu antes de você chegar. Rápido demais.')] },
  'p2-mural': { abre: [F('joe', 'Barry, o August sumiu. Dois dias sem aparecer. Vem ver o que ele deixou na mesa.')] },
  'p2-treino': { abre: [F('cisco', 'Para alcançar um deus, você precisa ser mais rápido que nunca. Oito portais, setenta segundos. Vai!')],
    fecha: [F('cisco', 'Recorde absoluto! Agora sim. Vai pegar ele.')] },
  'p2-grace-acorda': { abre: [F('caitlin', 'Barry, preciso de você na sala médica. Eu vou tentar acordar a Grace com a adaga.')] },
  // Parte 3
  'p3-veste': { abre: [F('cisco', 'Sobe no pedestal. Eu ensaiei a música de fundo, mas a Caitlin não deixou tocar.')] },
  'p3-tempo': { abre: [F('cisco', 'Aperta T no computador, ou o botão TEMPO na tela. Concentra o raio e olha o mundo parar.'), F('caitlin', 'Gasta energia. Use quando precisar de verdade. Duas vezes, para a gente medir.')],
    fecha: [F('caitlin', 'Os carros quase parados, as pessoas paradas no meio do passo. E você andando no meio delas.'), F('cisco', 'Isso é a coisa mais legal que eu já construí. E olha que eu construí uma torradeira que fala.')] },
  'p3-queda': { abre: [F('caitlin', 'Alguém está caindo de um prédio! Usa o tempo lento!')],
    fecha: [F('caitlin', 'Você chegou com dois segundos de folga. Com o tempo lento, foi como passear.')] },
  'p3-bateria': { abre: [F('caitlin', 'Agora a bateria. Corra acima dos quatrocentos e segure. O traje guarda o raio que você gera.')],
    fecha: [F('cisco', 'Energia cheia correndo! Você é oficialmente um carro elétrico. Um carro elétrico muito vermelho.')] },
  'p3-gangue': { abre: [F('cisco', 'Uma gangue no centro. Hora de testar a armadura. Não que eu queira que você apanhe. Mas é ciência.')],
    fecha: [F('caitlin', 'Você levou três socos e o traje segurou quase tudo. Eu finalmente vou poder tirar férias.')] },
  'p3-noticia': { abre: [F('iris', 'Barry, passa na redação? Agora. Não é sobre trabalho. Quer dizer, é. Mais ou menos.')] },
  'p3-vovo': { abre: [F('iris', 'Conta para o meu pai. Eu quero ver a cara dele. Quer dizer, você conta, eu imagino a cara dele.')] },
  'p3-devoe': { abre: [F('caitlin', 'Barry, o DeVoe pediu para falar com você. Só com você. Ele disse que é sobre o Núcleo.')] },
  'p3-batidas': { abre: [F('cisco', 'Eu não queria acreditar no DeVoe, mas os sensores do Núcleo marcaram três picos. Vai lá. Eu vou junto. Pelo rádio. De longe.')] },
  'p3-maos': { abre: [F('cisco', 'Barry, a Caitlin se trancou na sala médica. E a temperatura lá dentro está caindo. Muito.')] },
  'p3-rastro': { abre: [F('cisco', 'Ela saiu pela janela. Tem um rastro de gelo até a praça da Prefeitura. Os marcadores são seus.')] },
  'p3-acordo': { abre: [F('caitlin', 'Me leva para o Cortex, Barry. Eu preciso olhar nos olhos do Cisco e pedir desculpa. E depois congelar o café dele.')] },
  'p3-fendas': { abre: [F('caitlin', 'O Núcleo está rachando, Barry. E as rachaduras abriram fendas pela cidade. Feche todas antes que ele saia.')],
    fecha: [F('cisco', 'Fendas fechadas! Mas o Núcleo... o Núcleo acabou de abrir. Por dentro.')] },
  'p3-saida': { abre: [F('caitlin', 'A porta do Núcleo está abrindo sozinha! Barry, para a Câmara do Núcleo, agora!')] },
  'p3-incendio': { abre: [F('cisco', 'Ele passou pelo centro e deixou um prédio em chamas. Típico de vilão: bagunça e não arruma.')],
    fecha: [F('caitlin', 'Fogo apagado. Barry... a assinatura vermelha está na redação do Picture News.')] },
  'p3-iris-perigo': { abre: [F('caitlin', 'Ele está do lado da Iris! Barry, corre!')] },
  'p3-joe2': { abre: [F('joe', 'Barry. Casa. Agora. A gente precisa conversar sobre o seu... sobre aquele homem.')] },
  'p3-berco': { abre: [F('iris', 'O berço chegou. São trezentas peças e um manual em sueco. Você tem mãos rápidas: vem montar.')] },
  'p3-arquivo': { abre: [F('iris', 'Barry, eu achei uma coisa no arquivo do jornal. É sobre o seu pai. Vem ver antes de decidir qualquer coisa.')] },
  'p3-assalto': { abre: [F('cisco', 'Assalto no centro. Usa o tempo lento e prende o cara antes de ele piscar.')],
    fecha: [F('cisco', 'Ele disse para a polícia que piscou e já estava algemado. O que é verdade, tecnicamente.')] },
  'p3-cafe': { abre: [F('cisco', 'Barry, me encontra no Jitters? Eu preciso te contar uma coisa. E não pode ser no laboratório.')] },
  'p3-plano': { abre: [F('henry', 'Praça da Prefeitura. Sozinho. Eu sei como parar o Corredor Negro. Venha ouvir.')] },
  'p3-treino': { abre: [F('cisco', 'Circuito novo, mais apertado. Usa o tempo lento nas curvas. Se o Henry trair a gente, você vai precisar ser rápido.')],
    fecha: [F('cisco', 'Recorde absoluto. Mais rápido que a morte? Talvez. Vamos descobrir.')] },
  'p3-esferas': { abre: [F('caitlin', 'Carregue o traje até o máximo. Cinco esferas. Amanhã você vai precisar de cada gota.')],
    fecha: [F('caitlin', 'Traje carregado. Agora descansa, Barry. Uma noite só.')] },
  'p3-fuga': { abre: [F('caitlin', 'Um carro em fuga na avenida! Presos que escaparam na confusão do Núcleo.')] },
  'p3-perseguido': { abre: [F('caitlin', 'Barry, ele está atrás de você! O Corredor Negro! Para o Cortex, agora!'), F('cisco', 'Não olha para trás. Sério. Não olha.')] },
  'p3-presidio': { abre: [F('joe', 'Barry, Iron Heights está sem luz e as celas abriram sozinhas. Eu preciso de você aqui.')] },
  'p3-gangue2': { abre: [F('caitlin', 'Os presos soltos se juntaram numa gangue no centro. A armadura do traje aguenta. Vai.')] },
  'p3-vigia': { abre: [F('cisco', 'Barry, a cidade está em pânico. Crimes em todo canto. Impede três e eu monto um mapa do caos.')],
    fecha: [F('caitlin', 'A cidade está respirando de novo. Graças a você.')] },
  'p3-queda2': { abre: [F('caitlin', 'Alguém caindo do alto de um prédio! Tempo lento, Barry!')],
    fecha: [F('cisco', 'Pegou no ar! Você está ficando bom nisso. Assustadoramente bom.')] },
  'p3-armadilha': { abre: [F('caitlin', 'Vem para a Câmara do Núcleo. A gente tem um plano. Um plano maluco, mas é um plano.')] },
  'p3-despedida': { abre: [F('iris', 'Antes de você ir... passa em casa. Eu preciso te dizer uma coisa.')] },
  'p3-silencio': { abre: [F('joe', 'Barry... vem para a Delegacia. Senta comigo na escada. Não precisa falar nada.')] },
  'p3-nora': { abre: [F('joe', 'BARRY! A bolsa estourou! A Iris vai ter o bebê! CASA, AGORA!')] },
  'p3-padrinhos': { abre: [F('cisco', 'Quando der, passa na sala dos trajes. A Caitlin e eu temos um presente. Para a Nora.')] },
  'p3-fim': { abre: [F('caitlin', 'Barry, a cidade inteira está na praça da Prefeitura. Eles querem agradecer. E conhecer a Nora.')] },
  'p2-fim': { abre: [F('iris', 'Jantar em casa hoje. Todo mundo vai. E ninguém atrasa. Ninguém, Barry.')] },
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
    CARTAO('THE FLASH', 'Fim da Parte 1'),
  ],
  // ===================== PARTE 2 — O preço da velocidade =====================
  // Ato 5 — Ponto de Ignição: o Barry volta à noite do incêndio, salva a mãe e quebra o mundo
  'p2-abertura': [
    CARTAO('Parte 2', 'O preço da velocidade'),
    CARTAO('Três meses depois', 'Três da manhã'),
    F('heroi', 'O mesmo sonho de novo. O fogo, a sala, e ela me chamando pelo nome.'),
    F('cisco', 'Barry? Os sensores dizem que você está correndo em volta do quarteirão há quarenta minutos.'),
    F('heroi', 'Não consigo dormir, Cisco.'),
    F('cisco', 'Eu também não. Mas eu estou comendo cereal, não gastando o asfalto da prefeitura.'),
    F('caitlin', 'Vem para o Cortex, Barry. Tem uma coisa nos seus exames que eu preciso te mostrar.'),
  ],
  'depois-p2-exames': [
    F('caitlin', 'Desde que você correu dentro do Núcleo, a sua velocidade não parou de subir. Ontem você passou dos quatrocentos.'),
    F('cisco', 'O Núcleo apagou, mas deixou um rastro. E você foi a última coisa que esteve lá dentro.'),
    F('heroi', 'Rápido o bastante para voltar mais longe do que seis semanas?'),
    F('caitlin', 'Barry. Não.'),
    F('heroi', 'Vinte anos, Caitlin. A noite do incêndio. Eu sei a hora, o lugar, cada segundo.'),
    F('cisco', 'Foi você mesmo que disse: mexer no passado apaga o futuro. A gente, a cidade, tudo.'),
    F('heroi', 'E se o futuro ficar melhor?'),
    F('caitlin', 'Promete que você vai pensar antes de fazer qualquer coisa.'),
    F('heroi', 'Prometo.'),
    F('cisco', '...Ele vai fazer, né?'),
    F('caitlin', 'Vai.'),
  ],
  'depois-p2-caixinha': [
    F('joe', 'Achei no porão, numa caixa com o seu nome. Era da sua mãe.'),
    F('heroi', 'A caixinha de música... Ela tocava isso nas noites de tempestade, para eu não ter medo.'),
    F('joe', 'Ela tinha orgulho de você antes de você fazer qualquer coisa. Guarda isso.'),
    F('heroi', 'Joe, se você pudesse voltar e mudar uma única noite... você mudaria?'),
    F('joe', 'Todo santo dia eu penso nisso.'),
    F('joe', 'E todo santo dia eu lembro que, se aquela noite não tivesse acontecido, eu não teria você.'),
    F('joe', 'Agora come. Você corre a mil por hora e come feito um passarinho.'),
    F('heroi', 'É lasanha de novo?'),
    F('joe', 'É a única coisa que eu sei fazer. E você vai elogiar.'),
  ],
  'depois-p2-tunel': [
    F('heroi', 'Vinte anos para trás... cada noite passando como um relâmpago.'),
    F('cisco', 'Barry, volta! O sinal está... sss...'),
    CARTAO('Vinte anos atrás', 'A noite do fogo'),
    F('nora', 'Henry? Henry, o que está acontecendo com você? Você está tremendo.'),
    F('pai', 'Nora, se afasta! Tem alguma coisa dentro de mim... um raio... eu não consigo parar!'),
    { ...F('heroi', 'Pai! Não corre! Olha para mim e não corre!'), acao: 'raioCasa' },
    F('pai', 'Quem é você? Por que você tem os olhos dela?'),
    F('heroi', 'Respira. Segura o raio dentro de você. Se você correr agora, ela morre.'),
    F('pai', '...Está passando. Está passando.'),
    F('nora', 'Henry! O que foi isso? E quem é esse rapaz na nossa sala?'),
    F('heroi', 'Ninguém. Ninguém importante. Boa noite, Nora.'),
    F('heroi', 'Ela está viva. Ela está viva.'),
    CARTAO('Ponto de Ignição', 'O dia que nunca aconteceu'),
  ],
  'depois-p2-mundo': [
    F('heroi', 'Poeira. Cadeiras viradas. As telas apagadas.'),
    F('heroi', 'Parece que ninguém entra aqui há anos.'),
    F('tv', 'Canal 4: o S.T.A.R. Labs, fechado há dezoito anos depois do escândalo do Núcleo Aurora, vai a leilão nesta sexta.'),
    F('tv', 'Na economia, a Ramon Industries, do bilionário Cisco Ramon, bate mais um recorde.'),
    F('heroi', 'Bilionário? O Cisco?'),
    F('tv', 'E o exército confirma: a criatura chamada Nevasca atacou de novo o porto. Toque de recolher a partir das oito.'),
    F('heroi', 'O que foi que eu fiz?'),
  ],
  'depois-p2-joe': [
    F('heroi', 'Joe! Graças a Deus. Joe, alguma coisa está muito errada.'),
    F('joe', 'Calma, rapaz. Eu te conheço?'),
    F('heroi', 'Sou eu. Barry. Você me criou.'),
    F('joe', 'Barry Allen? O filho do Henry e da Nora? Eu fui no seu aniversário de oito anos. Você vomitou no palhaço.'),
    F('heroi', 'Isso aconteceu nos dois mundos?'),
    F('joe', 'Hein?'),
    F('heroi', 'Nada. E a Iris? Como ela está?'),
    F('joe', 'Não sei, filho. A Iris não fala comigo há cinco anos. Eu bebi demais e falei coisa demais.'),
    F('joe', 'Se você encontrar com ela... diz que o velho dela pergunta por ela todo dia.'),
    F('heroi', 'Você não está sozinho, Joe. Não em nenhum mundo.'),
    F('joe', 'Que conversa estranha. Vai pra casa, garoto. Toque de recolher às oito: a Nevasca anda solta.'),
  ],
  'depois-p2-iris': [
    F('iris', 'Você está me olhando como se a gente tivesse casado numa outra vida.'),
    F('heroi', '...Algo assim.'),
    F('iris', 'Pior cantada da semana. E olha que o cara da mesa do lado tentou rimar "Iris" com "íris".'),
    F('heroi', 'O seu pai pergunta por você todo dia. Ele mandou dizer.'),
    F('iris', 'Você conhece o meu pai?'),
    F('heroi', 'Melhor do que você imagina. Ele errou, Iris. Mas ele nunca parou de te esperar.'),
    F('iris', '...Quem é você?'),
    F('heroi', 'Alguém que já perdeu gente demais para ver um pai e uma filha separados por orgulho.'),
    F('iris', 'Eu vou pensar. Agora some, antes que eu decida gostar de você.'),
  ],
  'depois-p2-cisco': [
    F('cisco', 'Segurança! Tem um maluco de roupa vermelha colante no meu saguão. De novo.'),
    F('heroi', 'Cisco, me escuta. Em outro mundo, a gente é melhor amigo.'),
    F('cisco', 'Em outro mundo eu também sou alto e sei dançar. Tchau.'),
    F('heroi', 'Você chamou a sua primeira esteira de "Pobre Coitada". Come sanduíche de atum às três da manhã. E tem medo de palhaço.'),
    F('cisco', '...Ninguém sabe do palhaço. NINGUÉM sabe do palhaço.'),
    F('heroi', 'Eu mudei o passado. E agora a minha velocidade está sumindo.'),
    F('cisco', 'Tá. Hipoteticamente: o seu corpo é de uma linha do tempo que não existe mais. Ele está sendo apagado.'),
    F('cisco', 'Recolhe energia. O que sobrou do raio que te criou está espalhado pela cidade, em esferas. Eu vi nos meus satélites.'),
    F('heroi', 'E a Nevasca? Quem é ela?'),
    F('cisco', 'Uma médica, Caitlin Snow. O exército fez experiências com ela num tanque de gelo. Ela fugiu e congela tudo o que encontra.'),
    F('heroi', 'Caitlin...'),
    F('cisco', 'Você conhece ela também? Cara, você conhece todo mundo.'),
  ],
  'cap-nevasca': [
    CARTAO('Capítulo 8', 'Projeto Nevasca'),
    F('cisco', 'Ela congelou um quarteirão inteiro em dez segundos. Os termômetros marcam trinta abaixo de zero.'),
    F('heroi', 'Ela não é um monstro. Ela é a Caitlin.'),
    F('cisco', 'Neste mundo, ela é as duas coisas.'),
  ],
  'encontro-nevasca': [
    F('nevasca', 'Então você é o velocista de quem o exército tanto fala. Pensei que fosse mais alto.'),
    F('heroi', 'Caitlin. Sou eu.'),
    F('nevasca', 'Não me chama assim. A Caitlin morreu num tanque de gelo, gritando, enquanto eles anotavam números.'),
    F('heroi', 'Em outro mundo, você salvou a minha vida mais vezes do que eu consigo contar.'),
    F('nevasca', 'Que pena. Neste aqui, eu vou terminar o que eles começaram.'),
    F('cisco', 'A linha brilhante no chão é o raio de gelo! Sai dela e ataca quando ela recarregar!'),
  ],
  'derrotado-nevasca': [
    F('nevasca', 'Por que você não me acerta com força? Eu teria acertado você.'),
    F('heroi', 'Porque eu sei quem você é. Mesmo que você não lembre.'),
    F('nevasca', '...Ninguém sabe quem eu sou.'),
    F('heroi', 'Você é a pessoa que ficava acordada a noite inteira para eu não morrer.'),
    F('nevasca', 'Some daqui, velocista. Antes que eu mude de ideia.'),
    F('cisco', 'Ela foi embora. Podia ter te congelado e não congelou. Isso diz alguma coisa.'),
  ],
  'depois-p2-mae': [
    F('nora', 'Barry! Você veio. O seu pai fez aquela lasanha queimada de novo.'),
    F('pai', 'Queimada, não. Tostada. É uma técnica francesa.'),
    F('nora', 'É uma técnica de bombeiro, Henry.'),
    F('heroi', '...Mãe.'),
    F('nora', 'Filho? O que foi? Você está com cara de quem viu um fantasma.'),
    F('heroi', 'Eu só... senti saudade. Muita.'),
    F('nora', 'Você me viu domingo, seu bobo. Senta. Come.'),
    CARTAO('Mais tarde', 'A cozinha'),
    F('nora', 'Eu sempre sei quando você está escondendo alguma coisa. Desde que você tinha cinco anos.'),
    F('heroi', 'E se eu tivesse feito uma coisa muito egoísta para ter você de volta, e o mundo inteiro tivesse ficado pior por causa disso?'),
    F('nora', 'De volta? Eu nunca fui embora, Barry.'),
    F('heroi', 'Para mim, foi. Vinte anos.'),
    F('nora', 'Então você sabe o que tem que fazer. Eu não quero viver num mundo que custou o seu.'),
    F('heroi', 'Eu não consigo te perder duas vezes.'),
    F('nora', 'Você não vai me perder. Eu vou estar em cada passo seu. Em cada corrida.'),
    F('nora', 'Agora vai. Antes que eu te segure aqui para sempre.'),
    CARTAO('Na porta', 'Henry Allen'),
    F('pai', 'Barry... posso te contar uma coisa estranha?'),
    F('pai', 'Eu tenho uns sonhos. Com raios. Com fogo. E acordo sempre com a sensação de que fiz uma coisa terrível.'),
    F('heroi', 'São só sonhos, pai.'),
    F('pai', 'Então por que, toda vez que eu olho para você, eu tenho vontade de pedir perdão?'),
  ],
  'depois-p2-desfazer': [
    F('cisco', 'Barry! Se der certo, eu não vou lembrar de nada disso, né?'),
    F('heroi', 'Não.'),
    F('cisco', 'Então... foi legal ser seu melhor amigo. Em qualquer mundo.'),
    CARTAO('Vinte anos atrás', 'A noite do fogo, de novo'),
    F('pai', 'Nora, se afasta! Tem alguma coisa dentro de mim... eu não consigo parar!'),
    F('heroi', 'Desta vez eu não entro. Desta vez eu só olho.'),
    { ...F('nora', 'Henry!'), acao: 'raioCasa' },
    F('heroi', 'Me perdoa, mãe. Me perdoa.'),
    CARTAO('Ponto de Ignição', 'Desfeito'),
  ],
  'depois-p2-volta': [
    F('cisco', 'Onde você estava? Você sumiu do radar por dois dias!'),
    F('heroi', 'Dois dias? Para mim foi muito mais.'),
    F('heroi', 'Eu voltei à noite do incêndio. Salvei a minha mãe. E o mundo inteiro quebrou.'),
    F('caitlin', 'Você prometeu que ia pensar.'),
    F('heroi', 'Eu pensei. E fiz mesmo assim. Depois desfiz.'),
    F('cisco', 'Você brincou de Deus com a linha do tempo, cara. E quem paga a conta?'),
    F('caitlin', 'Talvez a gente. Desde ontem as minhas mãos estão geladas. E eu sonho com uma mulher de cabelo branco que tem a minha voz.'),
    F('heroi', 'Caitlin...'),
    F('caitlin', 'Agora não. Eu preciso de um tempo.'),
    F('cisco', 'E eu preciso de um sanduíche. Sozinho.'),
    CARTAO('Fim do Ato 5', 'Toda escolha tem um preço'),
    CARTAO('Ato 6', 'O Corredor Negro'),
  ],
  // Ato 6 — O Corredor Negro: quem corre no tempo rasga alguma coisa, e alguma coisa vem cobrar
  'depois-p2-boatos': [
    F('iris', 'Três testemunhas, três bairros, a mesma noite. Todas viram um homem de preto correndo mais rápido que um carro.'),
    F('heroi', 'Um velocista?'),
    F('iris', 'Olha esta foto. Era para ter um rosto aqui. Não tem nada. Só escuro.'),
    F('iris', 'E onde ele passa, as plantas morrem. Os relógios param.'),
    F('heroi', 'Iris, se você vir esse homem, não chega perto. Promete.'),
    F('iris', 'Eu sou repórter, Barry. Prometer isso seria mentir.'),
    F('cisco', 'Barry, tem um sinal na praça da Prefeitura. Ele não emite calor nenhum. Zero absoluto.'),
  ],
  'depois-p2-silhueta': [
    F('heroi', 'Quem é você?'),
    F('negro', 'Barry... Allen.'),
    F('caitlin', 'Barry... os batimentos dele. Zero. Não tem coração nenhum ali.'),
    F('negro', 'Você correu onde não devia. Três vezes.'),
    F('heroi', 'O que você quer?'),
    { ...F('negro', 'O que me é devido.'), acao: 'someNegro' },
    F('cisco', 'Sumiu. E a grama em volta de onde ele estava virou cinza.'),
  ],
  'depois-p2-celas': [
    F('cisco', 'A cela do Zoom. As seis trancas, intactas. E ele não está lá dentro.'),
    F('caitlin', 'Só cinza no chão. E um frio que não sai do vidro.'),
    F('heroi', 'Ele fugiu?'),
    F('cisco', 'Ninguém foge de uma cela trancada. Alguém levou ele.'),
    F('caitlin', 'Existe uma lenda entre os velocistas. Eu achava que era só lenda.'),
    F('caitlin', 'Quem corre no tempo rasga alguma coisa. E alguma coisa vem cobrar. Eles chamam de Corredor Negro.'),
    F('cisco', 'O Zoom correu no tempo. O Savitar também.'),
    F('heroi', 'E eu corri três vezes.'),
    F('cisco', 'Ótimo. Que maravilha. Vou fazer um bolo de despedida.'),
  ],
  'cap-negro': [
    CARTAO('Capítulo 9', 'O Corredor Negro'),
    F('cisco', 'A armadilha ligou e... ele atravessou como se fosse fumaça.'),
    F('caitlin', 'Ele está lá fora. Esperando. Barry, ele não vai embora sem você.'),
    F('heroi', 'Então eu vou até ele.'),
  ],
  'encontro-negro': [
    F('negro', 'Barry... Allen.'),
    F('heroi', 'Eu conheço essa voz.'),
    F('negro', 'Conhecia. O homem que tinha esta voz morreu na cela.'),
    F('heroi', 'Zoom...'),
    F('negro', 'O Zoom correu no tempo. O tempo cobrou. Agora eu cobro por ele.'),
    F('caitlin', 'Cada toque dele drena a sua energia! Não deixa ele encostar, e bate quando ele cansar!'),
    F('negro', 'Corre, Barry. Todos correm. No fim, todos param.'),
  ],
  'derrotado-negro': [
    F('negro', 'Você pode me vencer... hoje.'),
    F('negro', 'Não pode me parar. Eu sou o fim de toda corrida.'),
    F('negro', 'Corra no tempo outra vez, e eu volto.'),
    F('cisco', 'Ele se desfez. Virou cinza e foi embora com o vento.'),
    F('caitlin', 'Então a regra é simples, Barry. Nunca mais viagem no tempo.'),
    F('heroi', 'Nunca mais.'),
    F('cisco', 'Vou tatuar isso no seu braço enquanto você dorme.'),
  ],
  'depois-p2-lista': [
    F('iris', 'Chegou hoje. Sem remetente, sem selo. Alguém entregou em mãos.'),
    F('heroi', 'Uma cigarra desenhada a lápis. E uma lista de nomes.'),
    F('iris', 'Capitão Frio. Onda Térmica. Mago do Tempo. Todos que ganharam poderes na noite do Núcleo.'),
    F('iris', 'Os três estão riscados. Barry... eles sumiram de Iron Heights esta manhã.'),
    F('heroi', 'E o último nome?'),
    F('iris', 'É o seu. O verdadeiro.'),
    F('cisco', 'Alguém está caçando quem tem poderes. E sabe quem você é.'),
    CARTAO('Fim do Ato 6', 'A lista'),
    CARTAO('Ato 7', 'A adaga'),
  ],
  // Ato 7 — A adaga: alguém está caçando quem ganhou poderes na noite do Núcleo
  'depois-p2-iron': [
    F('joe', 'Três celas, três trancas intactas. O Frio, o Onda Térmica e o Mago do Tempo sumiram sem abrir uma porta.'),
    F('heroi', 'E as câmeras?'),
    F('joe', 'Apagaram por onze segundos. Só onze. Igual à noite do raio.'),
    F('joe', 'No livro de visitas da manhã, um nome só. Um policial. A assinatura está borrada, mas o distintivo é da Delegacia Central.'),
    F('heroi', 'Um de nós.'),
    F('joe', 'Um dos nossos, Barry. É isso que me tira o sono.'),
    F('cisco', 'Achei marcas nas paredes das celas. Cortes finos. Como se alguém tivesse cortado o próprio poder deles.'),
  ],
  'depois-p2-august': [
    F('august', 'Você é o Barry Allen? O famoso Barry Allen que chega atrasado? Eu fiz uma planilha dos seus atrasos.'),
    F('heroi', 'Isso é... impressionante e um pouco ofensivo.'),
    F('august', 'August Heart. Perito novo. Pode me chamar de August. Ou de "o cara que chega na hora".'),
    F('heroi', 'O que é essa cicatriz na sua mão? Parece um raio.'),
    F('august', 'Lembrança da noite do Núcleo. Eu estava no estacionamento quando o céu rachou. Doeu por semanas, depois parou.'),
    F('august', 'Olha o meu mural: todas as aparições do Flash. Hora, rota, velocidade. Esse cara é a coisa mais linda que já aconteceu nesta cidade.'),
    F('joe', 'Ele é bom, Barry. Bom demais. Já resolveu dois casos que estavam na sua mesa.'),
    F('heroi', 'Ótimo. Agora até o meu substituto chega na hora.'),
  ],
  'depois-p2-anel': [
    F('joe', 'Senta, Barry. Isso é conversa de homem para homem. E de pai para... mais ou menos genro.'),
    F('joe', 'Este anel era da mãe da Iris. Ela pediu que fosse da Iris um dia. Eu acho que o dia chegou.'),
    F('heroi', 'Joe... você está me dando permissão?'),
    F('joe', 'Estou te dando um prazo. Ou você pede a minha filha em casamento esta semana, ou eu te prendo por enrolação.'),
    F('heroi', 'Isso não é crime.'),
    F('joe', 'Eu sou detetive há trinta anos. Eu acho um artigo.'),
    F('joe', 'Vai, filho. E não corre. Uma pergunta dessas se faz devagar.'),
  ],
  'depois-p2-pedido': [
    F('iris', 'Você está suando, Barry. Você nunca sua. Você corre a mil por hora e não sua.'),
    F('heroi', 'Iris, a gente se conhece desde que eu tinha onze anos. Eu já te vi em dois mundos diferentes.'),
    F('iris', 'Dois mundos?'),
    F('heroi', 'E em todos eles eu me apaixonei por você. Iris West... você casa comigo?'),
    F('iris', '...Você ensaiou isso.'),
    F('heroi', 'Quatrocentas vezes. Em três segundos.'),
    F('iris', 'Sim. Sim! Mil vezes sim, seu bobo.'),
    F('cisco', 'ELA DISSE SIM? Gente, ela disse sim! Eu estou chorando no Cortex e a Caitlin está fingindo que não.'),
    F('caitlin', 'Eu não estou chorando. É o ar-condicionado.'),
  ],
  'depois-p2-adaga': [
    F('cigarra', 'Barry Allen. O último nome da lista.'),
    F('heroi', 'Foi você. Iron Heights, as celas, os onze segundos.'),
    F('cigarra', 'O raio do Núcleo deu presentes para vocês. Para a minha família, só tirou.'),
    F('caitlin', 'Barry, essa adaga... ela emite a mesma energia do Núcleo, só que ao contrário. Cuidado!'),
    { ...F('cigarra', 'Fique parado. Isso só dói uma vez.'), acao: 'adaga' },
    F('caitlin', 'Os seus níveis... Barry, estão em zero. Você não tem mais velocidade!'),
    F('cigarra', 'Um a menos na lista. Nos vemos, Allen.'),
    F('cisco', 'Estou indo te buscar de carro. Me encontra no Jitters. A pé. Como um mortal.'),
  ],
  'depois-p2-sempoderes': [
    F('heroi', 'Duzentos metros. Duzentos metros e eu estou sem fôlego.'),
    F('cisco', 'Bem-vindo à vida normal. Ela é lenta, tem fila e o ônibus atrasa.'),
    CARTAO('Mais tarde', 'A sala médica'),
    F('caitlin', 'A adaga não tirou a sua velocidade. Ela trancou. O raio ainda está aí dentro, mas dormindo.'),
    F('heroi', 'Dá para acordar?'),
    F('caitlin', 'Com um choque do Núcleo. Pequeno. Ou não tão pequeno.'),
    { ...F('cisco', 'Contando: três, dois...'), acao: 'choque' },
    F('heroi', 'Voltou! Metade, mas voltou!'),
    F('caitlin', 'O resto vem com energia. As esferas da cidade: elas reconhecem você.'),
  ],
  'depois-p2-grace': [
    F('iris', 'Eu cruzei a lista com os prontuários do hospital da noite do Núcleo. Uma menina, Grace, nove anos. Em coma desde aquela noite.'),
    F('iris', 'Um pedaço do raio caiu no quarto dela. Um estilhaço de metal que brilhava. Sumiu do hospital no dia seguinte.'),
    F('heroi', 'A adaga.'),
    F('iris', 'O pai dela é policial, Barry. O nome dele está nas fotos do hospital, segurando a mão dela toda noite.'),
    F('heroi', 'Quem é?'),
    F('iris', 'O Capitão Dwyer. O seu capitão.'),
    F('heroi', 'O homem que reclamava dos meus atrasos todo santo dia...'),
    F('iris', 'Ele sabia o seu horário melhor do que ninguém. E agora sabe o seu segredo.'),
  ],
  'cap-cigarra': [
    CARTAO('Capítulo 10', 'A Cigarra'),
    F('caitlin', 'A adaga drena energia de quem é tocado por ela. Se ela te acertar de novo, você perde o raio de vez.'),
    F('cisco', 'Então não deixa ela te acertar. Simples. Conselho de amigo.'),
  ],
  'encontro-cigarra': [
    F('heroi', 'Capitão Dwyer. Tira a máscara.'),
    F('dwyer', 'Você. O menino que chegava atrasado. Eu devia ter percebido: ninguém se atrasa tanto sem estar em outro lugar.'),
    F('dwyer', 'Eu enterrei a infância da minha filha naquela noite. Vocês ganharam poderes. Ela ganhou um tubo na garganta.'),
    F('heroi', 'Eu sinto muito pela Grace. De verdade. Mas caçar a gente não vai acordar ela.'),
    F('dwyer', 'Não. Mas vai garantir que nenhum de vocês tire a filha de mais ninguém.'),
    F('caitlin', 'A linha no chão é o arremesso da adaga! Fica fora dela, e bate quando ela voltar para a mão dele!'),
  ],
  'derrotado-cigarra': [
    F('dwyer', 'Acabou. Me prende. Eu mereço.'),
    F('heroi', 'Você vai preso, capitão. Mas a Grace não vai ficar sozinha.'),
    F('caitlin', 'Capitão... se a adaga é energia do Núcleo, talvez eu consiga usar ela para trazer a Grace de volta.'),
    F('dwyer', '...Você faria isso? Depois de tudo?'),
    F('caitlin', 'Eu sou médica antes de qualquer outra coisa.'),
    F('dwyer', 'Os três presos estão no porão do velho armazém do porto. Vivos. Eu não sou um assassino, Allen. Só um pai.'),
  ],
  'depois-p2-casamento': [
    F('joe', 'Atrasado no próprio casamento. Eu não esperava outra coisa.'),
    F('heroi', 'Eu estava ajudando um gato a descer de uma árvore. A cinco quilômetros daqui.'),
    F('cisco', 'Pela autoridade a mim concedida por um site da internet muito confiável, eu vou celebrar esta união.'),
    F('caitlin', 'Cisco, você prometeu não falar do site.'),
    F('joe', 'Barry, você chegou na minha casa com onze anos e um olhar triste. Hoje você é o homem mais rápido do mundo. E o melhor que eu conheço.'),
    F('iris', 'Eu sempre soube que era você. Desde o primeiro dia. Em qualquer mundo.'),
    F('heroi', 'Iris, eu corro rápido, mas eu não vou a lugar nenhum sem você. Nunca.'),
    F('cisco', 'Então, pelo poder do site: pode beijar a noiva!'),
    { ...F('caitlin', 'Gente... o céu. Olhem o céu.'), acao: 'ceuRasga' },
    F('godspeed', 'Que festa bonita. Pena que o noivo vai sair mais cedo.'),
    F('godspeed', 'Eu vim buscar o que é meu, Barry Allen. A sua velocidade. Inteira.'),
    CARTAO('Fim do Ato 7', 'Até que a morte nos separe'),
    CARTAO('Ato 8', 'O deus da velocidade'),
  ],
  // Ato 8 — O deus da velocidade
  'depois-p2-mural': [
    F('joe', 'A mesa do August está vazia. O casaco dele ainda está na cadeira.'),
    F('heroi', 'O mural... ele mudou. Tem linhas vermelhas ligando todas as minhas corridas.'),
    F('heroi', '"Velocidade máxima: oitocentos e vinte e oito. ALVO." Ele estava me medindo, Joe.'),
    F('joe', 'E olha isto: o laudo da noite do Núcleo. O raio que pegou o August não foi uma faísca. Foi o mesmo raio que pegou você.'),
    F('caitlin', 'Só que o dele dormiu. Até alguém acordar com um choque. Ou com uma adaga.'),
    F('heroi', 'Ele estava lá quando a Cigarra me acertou. Ele viu o raio sair de mim.'),
    F('joe', 'Barry, o velocista de prata... é o August?'),
    F('heroi', 'Ele disse que eu era a coisa mais linda que já aconteceu nesta cidade. Ele não queria ser meu fã. Queria ser eu.'),
  ],
  'cap-godspeed': [
    CARTAO('Capítulo 11', 'O deus da velocidade'),
    F('cisco', 'Ele está mais rápido que o Savitar e o Zoom juntos. E está de armadura.'),
    F('caitlin', 'Primeiro a armadura. Depois ele. E, Barry... não corre atrás dele dentro do tempo. Nunca mais. Lembra?'),
  ],
  'encontro-godspeed': [
    F('godspeed', 'Barry. Amigo. Colega de bancada.'),
    F('heroi', 'August. Por quê?'),
    F('august', 'Porque eu sou o segundo homem mais rápido do mundo. E ninguém lembra do segundo.'),
    F('august', 'O raio dormiu em mim por meses. A adaga do capitão acordou ele. Eu só precisava ver de perto como o seu funcionava.'),
    F('godspeed', 'Agora eu sou o Godspeed. E deuses não dividem o céu.'),
    F('caitlin', 'Os especiais racham a armadura mais rápido! Junte energia e use quando ele cansar!'),
  ],
  'derrotado-godspeed': [
    F('godspeed', 'Não... eu não posso perder para você. Eu fiz tudo certo!'),
    F('godspeed', 'Se eu não sou o mais rápido aqui, eu vou ser no futuro!'),
    { ...F('cisco', 'Ele está abrindo o túnel do tempo! Barry, não vai atrás!'), acao: 'tunelGodspeed' },
    F('heroi', 'Eu não vou.'),
    { ...F('negro', 'August... Heart.'), acao: 'negroLeva' },
    F('godspeed', 'Não... não! Me solta! Barry! BARRY!'),
    F('heroi', 'Corredor! Espera!'),
    F('negro', 'Ele correu no tempo. O tempo cobrou.'),
    F('negro', 'Você... desta vez... não correu.'),
    F('caitlin', '...Os dois sumiram. Não tem mais nenhum sinal.'),
    F('heroi', 'Ele era só um homem que queria ser lembrado.'),
  ],
  'depois-p2-grace-acorda': [
    F('caitlin', 'A adaga está ligada ao Núcleo. Se eu der a energia certa, na hora certa, a Grace acorda.'),
    F('caitlin', 'Só que eu preciso segurar a energia sem me queimar. E as minhas mãos estão... geladas.'),
    F('heroi', 'Caitlin. O gelo nas suas mãos não é uma maldição. Talvez seja o que vai salvar ela.'),
    { ...F('caitlin', 'Agora.'), acao: 'choque' },
    F('grace', '...Papai?'),
    F('caitlin', 'Ela acordou. Barry, ela acordou!'),
    F('cisco', 'Liga para o capitão! Alguém liga para o capitão!'),
    F('dwyer', 'Grace? Filha? Sou eu... é o papai.'),
    F('grace', 'Eu sonhei que um homem de vermelho corria em volta do meu quarto.'),
    F('caitlin', 'A mulher de cabelo branco dos meus sonhos... ela me ajudou, Barry. Eu senti.'),
  ],
  'depois-p2-fim': [
    CARTAO('Epílogo', 'Um mês depois'),
    F('joe', 'Um brinde. Ao Barry e à Iris. E à lasanha, que desta vez não queimou.'),
    F('iris', 'Desta vez eu cozinhei, pai.'),
    F('cisco', 'Um brinde ao Cisco, que celebrou o casamento e não foi preso por isso.'),
    F('caitlin', 'A Grace saiu do hospital ontem. O capitão vai poder ver a filha toda semana. Ele mandou um bilhete: "Obrigado, Allen. Chegue na hora."'),
    F('heroi', 'A caixinha de música... Joe, você deu corda nela?'),
    F('joe', 'Não. Ela começou a tocar sozinha quando você entrou.'),
    F('heroi', 'Eu não corri, mãe. Desta vez, eu não corri.'),
    F('iris', 'Ela estaria orgulhosa de você.'),
    F('cisco', 'Tá, isso foi lindo. Agora: alguém viu o meu sanduíche? De novo?'),
    CARTAO('Mais tarde', 'S.T.A.R. Labs, três da manhã'),
    F('caitlin', 'Só mais uma amostra e eu vou para casa.'),
    F('nevasca', 'Oi, Caitlin.'),
    F('caitlin', '...Quem está aí?'),
    F('nevasca', 'Eu sou você. A parte que o mundo esqueceu de apagar.'),
    CARTAO('THE FLASH', 'Fim da Parte 2'),
  ],
  // ===================== PARTE 3 — A força do raio =====================
  // Ato 9 — O traje novo: a Caitlin e o Cisco mostram ao Barry o traje que fizeram em segredo; com ele vêm os poderes novos
  'p3-abertura': [
    CARTAO('Parte 3', 'A força do raio'),
    CARTAO('Seis meses depois', 'Um presente'),
    F('cisco', 'Barry, onde você está?'),
    F('heroi', 'Ajudando uma senhora a atravessar a rua. Quarenta e duas vezes. Ela esqueceu para que lado ia.'),
    F('cisco', 'Larga a senhora. Quer dizer, deixa ela em segurança, e vem para o S.T.A.R. Labs. Sala dos trajes.'),
    F('caitlin', 'E não olha nada pelas câmeras antes de chegar. É uma surpresa.'),
    F('heroi', 'Vocês dois juntos dizendo "surpresa" me dá medo.'),
    F('cisco', 'Medo bom. Medo de presente.'),
  ],
  'depois-p3-convite': [
    F('cisco', 'Senhoras e senhores... e Barry. Apresento o projeto mais bonito da minha vida.'),
    { ...F('cisco', 'Luzes, por favor.'), acao: 'luzes' },
    F('heroi', 'Isso é...'),
    F('caitlin', 'Um traje novo. Seis meses de trabalho, em segredo. Um tecido que aguenta mil e duzentos graus e o atrito de oitocentos quilômetros por hora.'),
    F('cisco', 'Vermelho mais fundo, dourado de verdade, o raio do peito em relevo e o raio na testa, do jeito que você gosta.'),
    F('cisco', 'E linhas de energia por baixo do tecido. Elas acendem quando você corre. Porque estilo também é ciência.'),
    F('caitlin', 'O mais importante: ele guarda o raio. Correndo muito rápido, a sua energia enche em vez de gastar.'),
    F('heroi', 'Uma bateria que se carrega sozinha?'),
    F('caitlin', 'E uma armadura leve por dentro. Os golpes vão doer bem menos. Eu cansei de costurar você.'),
    F('cisco', 'E o melhor eu guardei para o fim. Mas só depois que você vestir.'),
    F('heroi', 'Cisco... eu não sei o que dizer.'),
    F('cisco', 'Diz "Cisco, você é um gênio". Eu aceito por escrito também.'),
    F('heroi', 'Cisco, você é um gênio. Caitlin, vocês dois são.'),
    F('caitlin', 'Vai lá. Ele foi feito para você.'),
  ],
  'depois-p3-veste': [
    { ...F('heroi', 'Ele é leve. Parece que eu não estou vestindo nada.'), acao: 'veste' },
    F('cisco', 'Ficou PERFEITO. Eu vou chorar. Não, eu não vou chorar.'),
    F('caitlin', 'Você está chorando.'),
    F('cisco', 'É poeira de tecido de alta resistência.'),
    F('caitlin', 'Sinais vitais ótimos. O traje já sincronizou com o seu raio. Sente a diferença?'),
    F('heroi', 'Sinto. Como se o raio tivesse um lugar para ficar.'),
    F('cisco', 'Agora o melhor: o traje tem um amplificador da Força de Aceleração. Se você concentrar o raio, o mundo inteiro fica lento em volta de você.'),
    F('heroi', 'O mundo fica lento?'),
    F('caitlin', 'Por alguns segundos. Gasta muita energia. Use com cuidado.'),
    F('cisco', 'E o traje antigo vai para a vitrine. Com honra. Ele merece.'),
    F('heroi', 'Obrigado, velho amigo.'),
    F('cisco', 'De nada.'),
    F('heroi', 'Eu estava falando com o traje, Cisco.'),
  ],
  'depois-p3-noticia': [
    F('iris', 'Senta. Não, fica em pé. Não, senta. Eu ensaiei isso e agora esqueci tudo.'),
    F('heroi', 'Iris, você está me assustando mais que o Corredor Negro.'),
    F('iris', 'Barry... eu estou grávida.'),
    F('heroi', '...'),
    F('iris', 'Você vai ser pai.'),
    F('heroi', 'Pai. Eu vou ser pai.'),
    F('iris', 'Diz alguma coisa. Você está vibrando. Literalmente. A mesa está tremendo.'),
    F('heroi', 'Desculpa. É que eu nunca fiquei tão feliz e com tanto medo ao mesmo tempo.'),
    F('iris', 'Medo de quê?'),
    F('heroi', 'De ser pai. O único exemplo de sangue que eu tenho... você sabe quem ele foi.'),
    F('iris', 'Você não é ele. Você é o homem que o Joe criou. E eu vou estar do seu lado o tempo todo.'),
  ],
  'depois-p3-vovo': [
    F('joe', 'O que foi? Vocês dois estão com uma cara de quem quebrou alguma coisa.'),
    F('heroi', 'Joe... a Iris está grávida. Você vai ser avô.'),
    F('joe', '...Avô.'),
    F('joe', 'EU VOU SER AVÔ!'),
    F('joe', 'Desculpa. Os vizinhos. Eu vou ser avô.'),
    F('heroi', 'Joe, como é que se faz isso? Ser pai?'),
    F('joe', 'Ninguém sabe, filho. A gente aparece. Todo dia. Mesmo cansado, mesmo com medo. A gente aparece.'),
    F('joe', 'Você chegou na minha casa com onze anos e um olhar triste. Eu também não sabia nada. Aprendi com você.'),
    F('joe', 'Ah, e teve uma ligação estranha hoje. O DeVoe, lá da contenção, quer falar com você. Disse que é urgente.'),
  ],
  'depois-p3-devoe': [
    F('devoe', 'Flash. Ou devo dizer Barry? Daqui de dentro eu tenho muito tempo para pensar.'),
    F('heroi', 'Você pediu para falar comigo. Fala.'),
    F('devoe', 'O Núcleo não está vazio. Eu escuto. Três batidas, a cada três horas. Sempre três.'),
    F('heroi', 'O Núcleo está desligado há meses.'),
    F('devoe', 'Desligado não é o mesmo que vazio. Alguém ficou preso do outro lado quando você fechou a porta.'),
    F('devoe', 'E esse alguém está batendo. Educadamente. Por enquanto.'),
    F('heroi', 'Por que você está me contando isso?'),
    F('devoe', 'Porque se ele sair, ele não vai parar em você. Eu prefiro o mundo inteiro. Mesmo lento.'),
  ],
  'depois-p3-batidas': [
    F('heroi', 'Silêncio. Só o zumbido do Núcleo.'),
    F('cisco', 'Talvez o DeVoe só esteja entediado. Gênio entediado inventa coisa.'),
    { ...F('heroi', 'Espera.'), acao: 'batida' },
    { ...F('heroi', 'Uma.'), acao: 'batida' },
    { ...F('heroi', 'Duas.'), acao: 'batida' },
    F('caitlin', 'Os sensores marcaram uma assinatura dentro do Núcleo. Vermelha.'),
    F('henry', 'Barry... eu sei que você está aí.'),
    F('henry', 'Me deixa sair, filho. Eu tenho uma coisa para te contar. Sobre o seu filho.'),
    F('heroi', 'Como você sabe do...'),
    F('cisco', 'Barry. Sai daí. Agora.'),
    CARTAO('Fim do Ato 9', 'Alguém bate na porta'),
    CARTAO('Ato 10', 'Nevasca'),
  ],
  // Ato 10 — Nevasca: a parte de gelo que ficou na Caitlin desde o Ponto de Ignição acorda
  'depois-p3-maos': [
    F('caitlin', 'Não chega perto, Barry. Por favor.'),
    F('heroi', 'Caitlin, a sala está a dez graus abaixo de zero.'),
    F('caitlin', 'Desde que o Núcleo começou a bater, ela acordou. Eu ouço a voz dela o tempo todo.'),
    F('nevasca', 'Ele não precisa de você, Caitlin. Ninguém precisa. Deixa eu sair.'),
    F('caitlin', 'Eu não consigo segurar. Eu tenho medo de machucar vocês.'),
    F('heroi', 'Você nunca machucaria ninguém.'),
    { ...F('nevasca', 'Ela não. Eu sim.'), acao: 'gelo' },
    F('cisco', 'Ela quebrou a janela! Barry, ela foi embora!'),
  ],
  'depois-p3-rastro': [
    F('heroi', '"Me deixa ir, Barry." Escrito no gelo, com a letra dela.'),
    F('cisco', 'Deixa eu ver. Eu vou só encostar na frase... Ai!'),
    { ...F('cisco', 'Barry. Eu vi. Eu VI alguma coisa. Tipo um filme na minha cabeça.'), acao: 'visao' },
    F('heroi', 'Viu o quê?'),
    F('cisco', 'A Caitlin. Sentada no chão de um armazém, abraçando os joelhos. E a outra, de pé, na frente dela. As duas são ela.'),
    F('caitlin', '...'),
    F('cisco', 'E isso que aconteceu comigo agora é assunto para depois. MUITO depois. Eu estou bem. Mais ou menos.'),
  ],
  'cap-nevasca2': [
    CARTAO('Capítulo 12', 'Gelo e fogo'),
    F('cisco', 'O guia mostra onde ela está. Barry: ela não é inimiga. Lembra disso no meio da briga.'),
    F('heroi', 'Eu vou trazer ela de volta.'),
  ],
  'encontro-nevasca2': [
    F('nevasca', 'Você de novo. Em todo mundo, em toda linha do tempo, você aparece.'),
    F('heroi', 'Porque eu não abandono os meus amigos.'),
    F('nevasca', 'Eu não sou sua amiga. Eu sou o que sobrou de um mundo que você quebrou.'),
    F('heroi', 'Então a culpa é minha. Não dela. Briga comigo e deixa a Caitlin voltar.'),
    F('nevasca', 'Com prazer.'),
    F('cisco', 'A linha do gelo! E agora você tem o tempo lento: usa quando ela mirar!'),
  ],
  'derrotado-nevasca2': [
    F('nevasca', 'Por que você não desiste de mim?'),
    F('heroi', 'Porque você também é a Caitlin. A parte dela que sentiu medo. E medo a gente não mata. A gente abraça.'),
    F('caitlin', 'Barry...? Eu estou aqui. Eu ouvi tudo. O tempo todo.'),
    F('nevasca', 'Eu não vou embora, Caitlin.'),
    F('caitlin', 'Eu sei. Então a gente vai ter que aprender a dividir.'),
    F('nevasca', '...Eu fico com as noites de sexta.'),
    F('caitlin', 'Combinado.'),
    F('cisco', 'Elas fizeram um acordo? Barry, elas fizeram um ACORDO. Eu preciso sentar.'),
  ],
  'depois-p3-acordo': [
    F('caitlin', 'Cisco, desculpa pela janela. E pelo susto. E pelo café, que eu vou congelar agora.'),
    F('cisco', 'Eu perdoo tudo, menos o café.'),
    F('caitlin', 'O gelo não vai embora. Mas agora fui eu que decidi ficar com ele.'),
    F('heroi', 'E você tem a gente. Sempre.'),
    { ...F('cisco', 'Gente... o Núcleo.'), acao: 'batida' },
    F('caitlin', 'Não são mais batidas. São rachaduras. O Núcleo está rachando por dentro.'),
    F('cisco', 'A assinatura vermelha está mais forte. E tem mais alguém do lado de lá. Uma assinatura fria, sem calor nenhum.'),
    F('heroi', 'O Corredor Negro está esperando por ele do outro lado.'),
    F('caitlin', 'E se ele sair, os dois saem juntos.'),
    CARTAO('Fim do Ato 10', 'Gelo e fogo'),
    CARTAO('Ato 11', 'O prisioneiro do Núcleo'),
  ],
  // Ato 11 — O prisioneiro do Núcleo
  'depois-p3-saida': [
    F('heroi', 'A porta do Núcleo... está aberta.'),
    F('henry', 'Olá, filho.'),
    F('heroi', 'Você.'),
    F('henry', 'Vinte e dois meses do outro lado. Correndo no escuro, sem chão, sem céu. E ouvindo os passos dele atrás de mim.'),
    F('caitlin', 'Barry, tem uma segunda assinatura dentro do Núcleo. Fria. Ela está chegando na porta.'),
    F('henry', 'Ele está vindo atrás de mim, Barry. E depois de mim, atrás de você.'),
    F('heroi', 'Você não vai a lugar nenhum.'),
    { ...F('henry', 'Eu já fui.'), acao: 'someReverso' },
    F('cisco', 'Ele sumiu! E a porta do Núcleo fechou sozinha. Por pouco. Alguma coisa bateu do lado de dentro.'),
  ],
  'depois-p3-iris-perigo': [
    F('henry', 'Pontual. Eu estava contando para a Iris como você era pequeno.'),
    F('iris', 'Barry, ele não me machucou. Ele só... sentou e ficou olhando para mim. Para a minha barriga.'),
    F('heroi', 'Se afasta dela.'),
    F('henry', 'Eu só queria ver o rosto da mãe do meu neto. É só isso que um avô quer.'),
    F('heroi', 'Você não é avô de ninguém.'),
    F('henry', 'Sangue não se escolhe, Barry. Nem o seu, nem o dela.'),
    F('henry', 'Eu vou te procurar. Eu tenho uma proposta. Você vai querer ouvir, quando o Corredor chegar.'),
    { ...F('henry', 'Parabéns aos dois.'), acao: 'someReverso' },
    F('iris', '...Eu vou precisar de um café. Descafeinado. E de você do meu lado.'),
  ],
  'depois-p3-joe2': [
    F('joe', 'Ele sentou do lado da minha filha. Grávida. Do lado da MINHA filha, Barry.'),
    F('heroi', 'Eu sei, Joe. Eu cheguei a tempo.'),
    F('joe', 'Desta vez. Me escuta: não importa o que ele te ofereça, não importa o que ele diga sobre sangue.'),
    F('joe', 'Aquele homem destruiu uma família inteira numa noite. Ele não sabe construir. Só sabe tirar.'),
    F('heroi', 'E se ele estiver certo sobre o Corredor Negro?'),
    F('joe', 'Então a gente enfrenta o Corredor juntos. Do jeito certo. Como família.'),
    F('joe', 'E, Barry: eu ainda tenho a minha arma de serviço. Só para você saber.'),
  ],
  'depois-p3-berco': [
    F('iris', 'Barry, o manual diz quarenta minutos. Você terminou em quatro segundos. Por que sobraram nove parafusos?'),
    F('heroi', 'São parafusos extras. Para emergências.'),
    F('iris', 'O berço está de cabeça para baixo.'),
    F('heroi', '...É um berço moderno.'),
    F('iris', 'Monta de novo. Devagar. Com as mãos de uma pessoa normal.'),
    F('heroi', 'Iris... e se eu for como ele? E se tiver alguma coisa no sangue?'),
    F('iris', 'Olha para esse berço. Você está com medo de errar um parafuso. Ele nunca teve esse medo. É isso que te faz diferente.'),
  ],
  'depois-p3-arquivo': [
    F('iris', 'O jornal da manhã depois do incêndio. Vinte e dois anos atrás. E dentro, uma carta que nunca foi publicada.'),
    F('iris', 'É do Henry. Escrita na noite anterior ao fogo. Endereçada a você, Barry.'),
    F('heroi', 'Lê para mim.'),
    F('iris', '"Filho, hoje um raio caiu no meu laboratório e alguma coisa mudou em mim. Eu sinto o mundo devagar demais."'),
    F('iris', '"Eu tenho medo do que eu posso virar. Se um dia eu correr para longe, saiba que eu nunca quis correr. Eu queria ficar."'),
    F('heroi', 'Ele já sabia. Na noite antes.'),
    F('iris', 'Talvez o homem que escreveu isso ainda esteja lá dentro, em algum lugar.'),
    F('heroi', 'Ou talvez ele tenha morrido naquele fogo junto com ela.'),
  ],
  'depois-p3-cafe': [
    F('cisco', 'Senta. Eu preciso falar uma coisa e não quero que você ria.'),
    F('heroi', 'Eu nunca riria de você.'),
    F('cisco', 'Desde que eu encostei no gelo da Caitlin, eu vejo coisas. Lugares. Pessoas. Às vezes antes de acontecer.'),
    F('heroi', 'Cisco... você ganhou poderes.'),
    F('cisco', 'Eu chamo de "vibração". Não, espera, vibrar é seu. Eu chamo de... ainda não decidi. Tem que ser um nome legal.'),
    F('cisco', 'Barry, ontem eu vi o Corredor Negro. Na frente do S.T.A.R. Labs. E você no chão.'),
    F('heroi', 'O futuro muda, Cisco. Eu sei melhor que ninguém.'),
    F('cisco', 'Então muda. Por favor. Eu não quero ser padrinho de uma criança sem pai.'),
  ],
  'depois-p3-plano': [
    F('henry', 'Você veio sozinho. Bom garoto.'),
    F('heroi', 'Fala o que você quer e some.'),
    F('henry', 'O Corredor Negro está preso no Núcleo, mas não por muito tempo. Ele quer quem correu no tempo. Eu. E você.'),
    F('henry', 'Sozinho, nenhum de nós vence. Juntos, dois velocistas correndo dentro do Núcleo podem trancar a porta com ele do lado de dentro.'),
    F('heroi', 'E por que eu confiaria em você?'),
    F('henry', 'Porque eu sou a única pessoa viva que correu do lado dele por vinte e dois meses. Eu conheço os passos dele.'),
    F('heroi', '...Amanhã. No Núcleo. E se você tentar qualquer coisa—'),
    F('henry', 'Eu sei. Você me para. Você sempre para tudo.'),
    F('caitlin', 'Barry, isso é loucura.'),
    F('cisco', 'Eu vi esse momento na minha cabeça. E não acabava bem.'),
  ],
  'cap-reverso2': [
    CARTAO('Capítulo 13', 'O acordo'),
    F('caitlin', 'Barry, o Henry não foi para o Núcleo. A assinatura vermelha está correndo pela cidade. Rápido.'),
    F('cisco', 'Eu sabia. Eu SABIA. Vai atrás dele!'),
  ],
  'encontro-reverso2': [
    F('henry', 'Você demorou. Eu achei que ia ter que te esperar no Núcleo.'),
    F('heroi', 'Você nunca ia para o Núcleo.'),
    F('henry', 'O Corredor não quer dois velocistas, Barry. Ele quer UM. Eu ofereci você.'),
    F('henry', 'Você no lugar dele, e eu livre. Para sempre. É uma troca justa: eu te dei a vida duas vezes.'),
    F('heroi', 'Você me deu um raio. O Joe me deu uma vida.'),
    F('caitlin', 'Ele é mais rápido que antes, mas você também! Usa o tempo lento quando ele avançar!'),
    F('henry', 'Vamos ver quem é mais rápido, filho.'),
  ],
  'derrotado-reverso2': [
    F('henry', 'Você... ficou mais rápido que eu.'),
    F('heroi', 'Não. Eu só parei de ter medo de você.'),
    { ...F('cisco', 'Barry! O Núcleo! A porta abriu de novo!'), acao: 'batida' },
    F('caitlin', 'A assinatura fria saiu. O Corredor Negro está na cidade.'),
    F('henry', 'Tarde demais. Ele está aqui. E ele não vai embora de mãos vazias.'),
    CARTAO('Fim do Ato 11', 'O prisioneiro do Núcleo'),
    CARTAO('Ato 12', 'A força do raio'),
  ],
  // Ato 12 — A força do raio
  'depois-p3-perseguido': [
    F('heroi', 'Ele me seguiu até a porta do laboratório e parou. Por quê?'),
    F('caitlin', 'Ele não precisa correr, Barry. Ele sabe que você vai até ele. Todo mundo vai, um dia.'),
    F('cisco', 'Eu armei as defesas do laboratório inteiro. Ele não entra aqui. Eu acho. Eu espero. Eu rezo.'),
    F('caitlin', 'O Henry fugiu durante a confusão. E o Corredor abriu as celas de Iron Heights quando passou por lá.'),
    F('heroi', 'Ele está espalhando o caos para me cansar.'),
  ],
  'depois-p3-presidio': [
    F('joe', 'Metade dos presos fugiu. Os guardas disseram que viram uma sombra passar e as portas abriram sozinhas.'),
    F('joe', 'Barry, os que ficaram estão rezando. Presos rezando, filho. Eu nunca vi isso em trinta anos.'),
    F('heroi', 'Joe, sai daqui. Leva a Iris para a casa dos West e fica com ela.'),
    F('joe', 'Eu fico. Mas você me prometa uma coisa: você volta. Eu não enterro mais ninguém desta família.'),
    F('heroi', 'Eu prometo.'),
  ],
  'depois-p3-armadilha': [
    F('caitlin', 'O plano é este: o Núcleo funciona como uma jaula se alguém correr dentro dele no sentido contrário.'),
    F('cisco', 'Você atrai o Corredor para cá, entra no anel, corre ao contrário e a porta fecha com ele do lado de dentro.'),
    F('heroi', 'E eu?'),
    F('caitlin', 'Você sai antes. Um décimo de segundo antes. Com o tempo lento, dá. Na teoria.'),
    F('cisco', 'Na prática a gente nunca testou. Porque testar significaria te prender numa dimensão escura para sempre.'),
    F('heroi', 'Um décimo de segundo. Eu já fiz coisas mais difíceis antes do café.'),
    F('caitlin', 'Barry... a Nevasca quer dizer uma coisa.'),
    F('nevasca', 'Se você não voltar, eu congelo o seu túmulo. Para sempre. Não ouse.'),
    F('heroi', 'Também te amo, Nevasca.'),
  ],
  'depois-p3-despedida': [
    F('iris', 'Você veio se despedir.'),
    F('heroi', 'Eu vim dizer que eu volto.'),
    F('iris', 'Então diz olhando para mim. Para nós dois.'),
    F('heroi', 'Eu volto. Eu prometo para você e para quem está aí dentro. Eu não vou ser um pai que vira lenda.'),
    F('iris', 'Ela chutou. Agora. Ela ouviu a sua voz.'),
    F('heroi', 'Ela?'),
    F('iris', 'Eu queria contar depois. É uma menina, Barry.'),
    F('heroi', 'Uma menina...'),
    F('iris', 'Vai. Corre. E volta para conhecer a sua filha.'),
  ],
  'cap-negro2': [
    CARTAO('Capítulo 14', 'O fim de toda corrida'),
    F('cisco', 'Ele está na frente do laboratório. Parado. Esperando você.'),
    F('caitlin', 'Atrai ele para dentro do Núcleo. Use tudo: o tempo lento, a armadura, a bateria. Tudo.'),
    F('heroi', 'Hoje, ninguém para.'),
  ],
  'encontro-negro2': [
    F('negro', 'Barry... Allen. Você correu três vezes no tempo.'),
    F('heroi', 'E nunca mais vou correr.'),
    F('negro', 'Não importa. O tempo cobra. Sempre.'),
    F('heroi', 'Então cobra de mim. Mas aqui, agora, e do meu jeito.'),
    F('caitlin', 'Ele está mais forte que da outra vez! Cada toque drena a sua energia. A bateria do traje é a sua chance!'),
    F('negro', 'Corre, Barry. Eu já peguei todos os outros.'),
  ],
  'derrotado-negro2': [
    F('negro', 'Você... me venceu. Mas não pode me parar.'),
    F('cisco', 'Barry, agora! O Núcleo está aberto! Atrai ele!'),
    F('henry', 'Espera.'),
    F('heroi', 'Pai?'),
    F('henry', 'Pai. Você me chamou de pai.'),
    F('henry', 'Corredor. Eu corri no tempo mais do que todos eles juntos. Vinte anos, para frente e para trás. Eu sou a dívida maior.'),
    F('negro', 'Henry... Allen.'),
    F('henry', 'Leva a mim. Deixa o menino.'),
    F('heroi', 'Não! Você não precisa—'),
    F('henry', 'Preciso, sim. É a primeira coisa certa que eu faço em vinte e dois anos.'),
    F('henry', 'Seja o pai que eu não fui, Barry. O Joe te ensinou. Você vai saber.'),
    F('henry', 'E diz para a menina... não, não diz nada sobre mim. Diz só que o avô dela se chamava Joe.'),
    { ...F('negro', 'A dívida está paga.'), acao: 'negroLevaHenry' },
    F('caitlin', '...O Núcleo fechou. As duas assinaturas sumiram. Para sempre, Barry.'),
    F('heroi', 'Ele correu. No fim, ele correu na direção certa.'),
  ],
  'depois-p3-silencio': [
    F('joe', 'Senta aqui, filho. Esses degraus já viram muita coisa. Aguentam mais uma.'),
    F('heroi', 'Eu odiei ele a minha vida inteira, Joe. E hoje ele me salvou.'),
    F('joe', 'As duas coisas podem ser verdade. É isso que torna a vida difícil.'),
    F('heroi', 'Ele disse para eu contar à minha filha que o avô dela se chama Joe.'),
    F('joe', '...Ele disse isso?'),
    F('heroi', 'Disse.'),
    F('joe', 'Então talvez, no fim, ele tenha aprendido alguma coisa sobre ser pai.'),
    F('joe', 'Vem. Vamos para casa. A Iris não para de ligar. E ela está com aquela voz de quem vai—'),
    F('heroi', '...de quem vai ter o bebê?'),
    F('joe', 'CORRE, BARRY!'),
  ],
  'depois-p3-nora': [
    CARTAO('Naquela noite', 'Casa da família West'),
    F('iris', 'Você chegou. Claro que chegou. Você é o homem mais rápido do mundo.'),
    F('heroi', 'Eu cheguei atrasado em tudo na minha vida. Hoje não.'),
    F('joe', 'É uma menina. Uma menina perfeita, com dez dedos nas mãos e uma gritaria de dar inveja à Nevasca.'),
    F('iris', 'A gente ainda não escolheu o nome.'),
    F('heroi', 'Eu tenho um. Se você deixar.'),
    F('iris', 'Eu acho que eu sei qual é.'),
    F('heroi', 'Nora. Nora West-Allen.'),
    F('joe', '...Ela ia adorar, filho. A sua mãe ia adorar.'),
    F('heroi', 'Oi, Nora. Eu sou o seu pai. Eu vou aparecer. Todo dia. Mesmo cansado, mesmo com medo.'),
    F('joe', 'Isso aí. É assim que se faz.'),
  ],
  'depois-p3-padrinhos': [
    F('cisco', 'Antes que vocês digam qualquer coisa: sim, eu fiz. Sim, é do tamanho dela. Sim, é à prova de fogo.'),
    F('heroi', 'Um traje. De bebê.'),
    F('caitlin', 'Com um raio no peito. Eu tentei impedir. Eu juro que tentei.'),
    F('cisco', 'Os padrinhos têm direitos. Está no contrato. Eu escrevi o contrato.'),
    F('caitlin', 'E eu tenho um presente também. Uma manta. Que não esfria nunca. A Nevasca escolheu a cor.'),
    F('heroi', 'Vocês dois... obrigado. Por tudo. Pelo traje, pelos três anos, por não desistirem de mim.'),
    F('cisco', 'Tá, para. Eu vou chorar de novo e eu já usei a desculpa da poeira.'),
  ],
  'depois-p3-fim': [
    F('joe', 'A cidade inteira veio. Até o Capitão Dwyer, com a Grace no colo.'),
    F('iris', 'A primeira foto da Nora vai ser com a cidade toda. Eu vou escrever essa matéria pelo resto da vida.'),
    F('caitlin', 'Os sensores do Núcleo estão em zero. Pela primeira vez em anos, silêncio absoluto.'),
    F('cisco', 'E eu decidi o meu nome de herói: "Vibe". Curto, legal, cabe numa camiseta.'),
    F('caitlin', 'Ninguém disse que você é herói, Cisco.'),
    F('cisco', 'Eu disse. Agora é oficial.'),
    F('heroi', 'Meu nome é Barry Allen. Eu sou o homem mais rápido do mundo.'),
    F('heroi', 'Mas hoje eu aprendi que a corrida mais importante é a que a gente faz para voltar para casa.'),
    CARTAO('Mais tarde', 'O quarto da Nora'),
    F('iris', 'Barry... vem cá. Olha o berço.'),
    F('heroi', 'Isso é...'),
    F('iris', 'Raios. Pequenininhos. Dourados. Em volta da mão dela.'),
    F('heroi', 'Ela tem o raio.'),
    CARTAO('THE FLASH', 'Fim da Parte 3'),
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
  'capitulo-nevasca': [F('cisco', 'O guia mostra onde ela está. Meus drones congelaram no ar.')],
  'luta-nevasca': [F('cisco', 'Sai da linha brilhante e ataca quando ela recarregar! Igual ao Capitão Frio, só que mais brava.')],
  'derrota-nevasca': [F('nevasca', 'Fria demais para você.'), F('cisco', 'Depois de cada raio ela recarrega. É ali que você entra.')],
  'capitulo-negro': [F('caitlin', 'Ele está na cidade. O guia mostra onde. Barry... cuidado.')],
  'perseguicao-negro': [F('cisco', 'Ele é rápido como o Zoom era, mas cansa. Encosta quando ele perder o fôlego!')],
  'luta-negro': [F('caitlin', 'Cada investida que acerta drena a sua energia. Desvia de lado ou vibra!')],
  'fase2-negro': [F('caitlin', 'Ele ficou mais rápido! Não para de se mexer!')],
  'derrota-negro': [F('negro', 'Todos param.'), F('caitlin', 'Desvia da investida e bate logo depois. Ele também cansa.')],
  'escapou-negro': [F('cisco', 'Sumiu numa nuvem de cinza. Ele volta.')],
  'capitulo-cigarra': [F('cisco', 'O guia mostra onde ela está. E, Barry: não deixa a adaga te tocar.')],
  'luta-cigarra': [F('caitlin', 'A linha verde no chão é o arremesso! Sai dela e bate quando a adaga voltar para a mão!')],
  'derrota-cigarra': [F('dwyer', 'Mais um nome riscado.'), F('caitlin', 'Depois de cada arremesso ela fica aberta. Entra logo depois!')],
  'capitulo-godspeed': [F('cisco', 'O sinal prateado está correndo pela cidade. O guia mostra onde.')],
  'perseguicao-godspeed': [F('caitlin', 'Ele é o mais rápido que você já enfrentou. Espere ele cansar e encoste.')],
  'luta-godspeed': [F('caitlin', 'Primeiro a armadura! Os especiais racham mais rápido.')],
  'armadura-godspeed': [F('cisco', 'A armadura dourada quebrou!'), F('godspeed', 'Você não sabe o que fez, Barry.')],
  'fase2-godspeed': [F('caitlin', 'Ele acelerou! Não para de se mexer!')],
  'derrota-godspeed': [F('godspeed', 'Deuses não perdem.'), F('caitlin', 'Junte energia, quebre a armadura com os especiais e bata quando ele cansar.')],
  'escapou-godspeed': [F('cisco', 'Sumiu num clarão prateado. Ele volta.')],
  'capitulo-nevasca2': [F('cisco', 'O guia mostra onde ela está. A temperatura cai a cada quarteirão.')],
  'luta-nevasca2': [F('caitlin', 'É a minha mira. Eu sei como ela pensa: ela atira onde você vai estar. Muda de direção!')],
  'derrota-nevasca2': [F('nevasca', 'Fique no chão.'), F('cisco', 'Usa o tempo lento quando ela mirar! Você atravessa a linha antes do gelo sair.')],
  'capitulo-reverso2': [F('cisco', 'A assinatura vermelha está correndo pela cidade. O guia mostra.')],
  'perseguicao-reverso2': [F('caitlin', 'Ele está mais rápido do que da última vez. Usa o tempo lento quando ele cansar!')],
  'luta-reverso2': [F('caitlin', 'Quando o chão brilhar, desvia ou usa o tempo lento. Depois da investida ele fica aberto!')],
  'fase2-reverso2': [F('caitlin', 'Os níveis dele dispararam! Não para!')],
  'derrota-reverso2': [F('henry', 'Ainda lento, filho.'), F('caitlin', 'Usa o tempo lento na investida e bate logo depois. A armadura segura o resto.')],
  'escapou-reverso2': [F('cisco', 'Sumiu num raio vermelho. Ele volta.')],
  'capitulo-negro2': [F('caitlin', 'Ele está em frente ao laboratório. Esperando.')],
  'luta-negro2': [F('caitlin', 'Cada toque dele drena a energia. Corre rápido para a bateria encher, e usa o tempo lento!')],
  'fase2-negro2': [F('cisco', 'Ele acelerou! Mas você também pode. Tudo o que você tem, Barry!')],
  'derrota-negro2': [F('negro', 'Todos param.'), F('caitlin', 'Não para, Barry! Bateria, armadura, tempo lento. Tudo junto.')],
  'escapou-negro2': [F('cisco', 'Ele virou cinza e voltou. Ele sempre volta.')],
  'falhou-p3-iris-perigo': [F('caitlin', 'Ele ainda está sentado do lado dela, sorrindo. Corre mais, Barry!')],
  'falhou-p3-perseguido': [F('cisco', 'Ele quase te alcançou! As defesas do laboratório seguraram ele por um segundo. Corre!')],
  'falhou-p3-nora': [F('joe', 'Barry! Onde você está?! Ela está chamando por você! CORRE!')],
  'falhou-p2-sempoderes': [F('cisco', 'Ainda não chegou? Eu estou parado em fila dupla! Mais um pouco, Barry, anda!')],
  'falhou-p2-fuga': [F('caitlin', 'Ele quase te pegou! A armadilha recarregou: mais uma chance, corre!')],
  'escapou-zoom': [F('caitlin', 'Perdemos o sinal dele. Ele vai aparecer de novo.')],
  'escapou-reverso': [F('caitlin', 'Ele sumiu do radar. Vai voltar, tenho certeza.')],
  // o cronômetro de um passo da vida do Barry acabou (missoes.js `tempo`): a história recomeça a contagem (ou volta um passo)
  'falhou-atrasado': [F('joe', 'O capitão chegou e você não estava. Eu disse que você foi ao banheiro. Mais quarenta e cinco segundos!')],
  'falhou-cafe-entrega': [F('joe', 'Café frio, Barry? O capitão já devolveu o dele. Volta lá e pega outro.')],
  'falhou-ameaca-iris': [F('caitlin', 'O gelo chegou ao pescoço dela! O Cisco ligou o aquecedor do Jitters no máximo: mais um minuto. Vai!')],
  'falhou-ameaca-joe': [F('cisco', 'Um raio caiu no telhado! O Joe está bem, mas o próximo não erra. Mais rápido!')],
};
const PROVOCA = { reverso2: ['Isso não é nada.', 'Eu te ensinei isso.', 'Você ainda corre como criança.'], negro2: ['Todos param.', 'O tempo cobra.', 'Você está cansando.'], godspeed: ['Lento demais, Barry.', 'Eu medi cada passo seu.', 'Deuses não cansam.'], negro: ['Lento.', 'Todos param.', 'Eu sinto o seu coração cansar.', 'O tempo cobra.'], savitar: ['Lento.', 'Eu já estive aqui antes.', 'Você vai virar o que eu sou.'], zoom: ['Sorte.', 'Ainda não.', 'Você está ficando lento.'], reverso: ['Isso não é nada.', 'Perto. Mas não o bastante.', 'Eu deixei.', 'Você está me divertindo.'] };

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
    const p = PERSONAGENS[f.quem] || PERSONAGENS.caitlin, img = retratos[p.retrato || f.quem];
    ret.textContent = img ? '' : p.sigla; ret.style.background = img ? `url(${img}) center/cover, ${p.cor}` : p.cor;
    ret.classList.toggle('foto', !!img); ret.classList.toggle('gelo', f.quem === 'nevasca'); ret.style.setProperty('--cor', p.cor);
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
