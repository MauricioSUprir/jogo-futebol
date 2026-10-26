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

export const PERSONAGENS = {
  caitlin: { nome: 'Caitlin', sigla: 'CA', cor: '#8fd8ff', papel: 'S.T.A.R. Labs · medicina' },
  cisco: { nome: 'Cisco', sigla: 'CI', cor: '#ffb347', papel: 'S.T.A.R. Labs · engenharia' },
  heroi: { nome: 'Você', sigla: 'EU', cor: '#ffd23f' },
  zoom: { nome: 'Zoom', sigla: 'Z', cor: '#3fa0ff', vilao: true },
  reverso: { nome: 'Flash Reverso', sigla: 'FR', cor: '#ff3b30', vilao: true },
  frio: { nome: 'Capitão Frio', sigla: 'CF', cor: '#9fe6ff', vilao: true },
  onda: { nome: 'Onda Térmica', sigla: 'OT', cor: '#ff8a3d', vilao: true },
  mago: { nome: 'Mago do Tempo', sigla: 'MT', cor: '#7dffa8', vilao: true },
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
  capitulos: { abre: [F('caitlin', 'O homem de amarelo ainda está lá fora. O guia mostra quando ele aparecer.')] },
  fendas: { abre: [F('cisco', 'O Núcleo está rasgando o ar pela cidade! Quatro fendas. E tem coisa saindo de lá.'), F('caitlin', 'Vibre dentro de cada uma, na mesma frequência. Ela deve fechar.')], fecha: [F('cisco', 'Quatro abertas, quatro fechadas. Agora vem pro Cortex: descobri uma coisa.')] },
  tunel: { abre: [F('cisco', 'A avenida principal é reta o bastante. Passe dos 180 e segure. O Núcleo vai te alimentar.')] },
  passado: { abre: [F('caitlin', '...Flash? ...consegue me ouvir? ...o sinal está...'), F('heroi', 'A cidade inteira está como naquela noite. O laboratório brilhando... Eu vou até lá.')] },
};

/** cenas (jogo parado). Um item pode ser um CARTÃO de capítulo em tela cheia. */
export const CENAS = {
  prologo: [
    CARTAO('Prólogo', 'O raio'),
    F('caitlin', 'Seis semanas atrás, o Núcleo Aurora do S.T.A.R. Labs sobrecarregou. A onda de energia cobriu a cidade inteira.'),
    F('caitlin', 'Um raio saiu do Núcleo e atravessou você. O seu coração parou por onze segundos.'),
    F('cisco', 'E aí você acordou e quebrou todos os nossos medidores de velocidade. Todos. Eu tinha um favorito.'),
    F('caitlin', 'Suas células se regeneram rápido demais. O seu corpo continua em movimento mesmo quando você está parado.'),
    F('heroi', 'Então não foi um sonho. Eu sou... rápido.'),
    F('cisco', 'Rápido? Você é o homem mais rápido do mundo. A gente só precisa descobrir quanto.'),
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
    F('heroi', 'Então eu não vou mudar nada. Mas um dia eu fecho essa porta. Para sempre.'),
    { ...F('reverso', 'Está na hora.'), acao: 'explosao' },
    CARTAO('Onze segundos', 'O raio encontra você'),
  ],
  'volta-tunel': [
    F('heroi', 'Eu vi tudo. Ele esteve lá o tempo inteiro.'),
    F('cisco', 'Te pegamos! O sinal voltou! Segura firme, estamos te puxando de volta.'),
    F('caitlin', 'Seus batimentos estão em dobro. Como se houvesse dois de você dentro do túnel.'),
    F('cisco', 'Peraí. Tem mais alguém no túnel com você. E está vindo atrás.'),
    CARTAO('Continua...', 'Capítulo 6 — Savitar'),
  ],
  'cap-reverso': [
    CARTAO('Capítulo 5', 'O homem de amarelo'),
    F('cisco', 'Revi as gravações da noite do acidente. Quadro a quadro.'),
    F('cisco', 'Dois segundos antes da explosão aparece um borrão amarelo e vermelho dentro do Núcleo.'),
    F('caitlin', 'Alguém sabotou o Núcleo Aurora de propósito.'),
    F('heroi', 'E esse alguém está na cidade agora.'),
  ],
  'encontro-reverso': [
    F('reverso', 'Finalmente, Flash. Esperei muito tempo por esta conversa.'),
    F('heroi', 'Foi você. O Núcleo, o Zoom... tudo.'),
    F('reverso', 'O Núcleo precisava de um raio, e o raio precisava de alguém para atravessar. Eu escolhi você.'),
    F('reverso', 'Você é a minha obra. E toda obra pode ser desfeita.'),
    F('cisco', 'A energia dele é vermelha e está fora da escala. Ele é mais rápido que o Zoom!'),
    F('reverso', 'Corra, Flash. É a única coisa que eu te ensinei.'),
  ],
  'derrotado-reverso': [
    F('reverso', 'Impressionante. Você aprendeu mais rápido do que eu calculei.'),
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
  'escapou-zoom': [F('caitlin', 'Perdemos o sinal dele. Ele vai aparecer de novo.')],
  'escapou-reverso': [F('caitlin', 'Ele sumiu do radar. Vai voltar, tenho certeza.')],
};
const PROVOCA = { zoom: ['Sorte.', 'Ainda não.', 'Você está ficando lento.'], reverso: ['Isso não é nada.', 'Perto. Mas não o bastante.', 'Eu deixei.', 'Você está me divertindo.'] };

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
  const RETRATOS = ['heroi', 'zoom', 'reverso', 'caitlin', 'cisco', 'frio', 'onda', 'mago'];
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
    return { tipo, alvo, outro, lado: Math.random() < 0.5 ? -1 : 1, ang: rnd(-0.7, 0.7), t: 0 };
  }
  function camera(cam, dt) {
    if (!C) return false;
    const f = C.falas[C.i];
    if (f.cartao) return !!C.plano;                                  // o cartão cobre a tela: a câmera fica onde estava
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
