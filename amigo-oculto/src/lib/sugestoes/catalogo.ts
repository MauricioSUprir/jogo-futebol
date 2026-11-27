import type { Etiqueta } from "@/lib/sugestoes/etiquetas";

/**
 * Catálogo de ideias de presente (pt-BR, preços típicos em reais no varejo brasileiro, fim de 2026).
 * A faixa de preço é o intervalo em que dá para achar uma boa versão do item; a primeira etiqueta é a principal
 * (usada para variar as sugestões). `tamanho` = depende de saber o tamanho da pessoa; `temCor` = dá para escolher a
 * cor; `versatil` = agrada quase todo mundo (é o que aparece quando não sabemos nada da pessoa).
 */
export type IdeiaPresente = {
  id: string;
  titulo: string;
  descricao: string;
  preco: readonly [number, number];
  etiquetas: readonly Etiqueta[];
  tamanho?: "roupa" | "calcado";
  temCor?: boolean;
  versatil?: boolean;
  /** palavras extras para comparar com a lista de desejos e com o que a pessoa não quer */
  palavras?: readonly string[];
};

type Extra = Pick<IdeiaPresente, "tamanho" | "temCor" | "versatil" | "palavras">;

function i(id: string, titulo: string, descricao: string, min: number, max: number, etiquetas: Etiqueta[], extra: Extra = {}): IdeiaPresente {
  return { id, titulo, descricao, preco: [min, max], etiquetas, ...extra };
}

export const CATALOGO: readonly IdeiaPresente[] = [
  // Leitura
  i("livro-do-momento", "Livro do momento", "Um lançamento ou best-seller do gênero preferido da pessoa.", 40, 90, ["leitura"], { versatil: true }),
  i("leitor-digital", "Leitor de livros digitais", "Leve, com luz própria e milhares de livros no bolso.", 450, 900, ["leitura", "tecnologia"], { palavras: ["kindle", "ebook"] }),
  i("luminaria-livro", "Luminária de leitura recarregável", "Prende no livro ou na cabeceira, com luz quente que não cansa a vista.", 40, 110, ["leitura", "casa"]),
  i("marcadores", "Marcadores de página em metal ou couro", "Um detalhe bonito para quem sempre tem um livro aberto.", 20, 60, ["leitura", "papelaria"]),
  i("clube-do-livro", "Assinatura de clube do livro (3 meses)", "Um livro surpresa por mês, com brindes e curadoria.", 150, 300, ["leitura"]),
  i("box-classicos", "Box de clássicos da literatura", "Edição caprichada para ler e deixar na estante.", 80, 200, ["leitura", "colecionaveis"]),
  i("suporte-livro", "Suporte de livro para mesa ou cama", "Deixa as mãos livres e a postura melhor.", 50, 120, ["leitura", "escritorio"]),

  // Café e chá
  i("cafes-especiais", "Kit de cafés especiais", "Três pacotes de torrefações brasileiras para provar e comparar.", 60, 150, ["cafe"], { versatil: true }),
  i("prensa-francesa", "Prensa francesa", "Café encorpado em quatro minutos, sem filtro de papel.", 70, 180, ["cafe", "cozinha"]),
  i("moedor-cafe", "Moedor de café manual", "Moagem na hora faz toda a diferença no sabor.", 90, 250, ["cafe"]),
  i("caneca-termica", "Caneca térmica com tampa", "Mantém o café quente (ou a água gelada) por horas.", 50, 140, ["cafe", "cha", "escritorio"], { versatil: true, temCor: true }),
  i("cafeteira-capsula", "Cafeteira de cápsulas", "Espresso em segundos, com espuma de leite.", 350, 700, ["cafe", "cozinha", "tecnologia"]),
  i("coador-ceramica", "Coador de cerâmica com filtros", "O método preferido dos baristas para café coado.", 60, 160, ["cafe"]),
  i("xicaras-cafe", "Jogo de xícaras de café", "Xícaras bonitas para o cafezinho de todo dia.", 50, 150, ["cafe", "casa"], { temCor: true }),
  i("chaleira-bico", "Chaleira de bico de ganso", "Controle total da água para o café coado e o chá.", 120, 300, ["cafe", "cha", "cozinha"]),
  i("cesta-cafe-manha", "Cesta de café da manhã", "Pães, geleias, frutas e um bom café, entregues de manhã.", 100, 250, ["cafe", "doces"], { versatil: true }),
  i("caneca-personalizada", "Caneca personalizada", "Com uma foto, um apelido ou uma piada interna do grupo.", 35, 80, ["cafe", "decoracao"], { versatil: true, temCor: true }),
  i("caixa-chas", "Caixa de chás selecionados", "Sabores variados para relaxar no fim do dia.", 40, 120, ["cha", "autocuidado"], { versatil: true }),
  i("bule-infusor", "Bule de vidro com infusor", "Para preparar chá de folhas soltas com estilo.", 60, 150, ["cha", "casa"]),
  i("kit-matcha", "Kit de matcha com batedor de bambu", "O ritual japonês completo: matcha, tigela e batedor.", 90, 220, ["cha", "anime"]),

  // Cozinha, churrasco e doces
  i("avental", "Avental de cozinha estiloso", "Resistente, com bolsos e a cara de quem cozinha.", 50, 120, ["cozinha"], { temCor: true }),
  i("tabua-frios", "Tábua de frios com utensílios", "Madeira bonita, facas de queijo e potinhos.", 80, 220, ["cozinha", "vinho", "casa"]),
  i("faca-chef", "Faca do chef de boa qualidade", "A ferramenta que mais faz diferença na cozinha.", 120, 400, ["cozinha"]),
  i("air-fryer", "Fritadeira sem óleo (air fryer)", "Batata crocante e jantar rápido sem sujeira.", 350, 800, ["cozinha", "casa"], { versatil: true }),
  i("livro-receitas", "Livro de receitas de chef brasileiro", "Receitas testadas e fotos de dar água na boca.", 60, 150, ["cozinha", "leitura"]),
  i("temperos", "Kit de temperos e sais especiais", "Sal de parrilla, pimentas e ervas para variar o tempero.", 50, 130, ["cozinha", "churrasco"]),
  i("frigideira-ferro", "Frigideira de ferro fundido", "Dura a vida toda e sela a carne como ninguém.", 120, 300, ["cozinha", "churrasco"]),
  i("kit-churrasco", "Kit churrasco (faca, garfo e pegador)", "Em estojo, para levar a qualquer churrasqueira.", 90, 250, ["churrasco"]),
  i("avental-couro", "Avental de couro para churrasqueiro", "Clássico, resistente e cheio de estilo.", 80, 200, ["churrasco"]),
  i("termometro-carne", "Termômetro digital para carnes", "Ponto perfeito sem precisar cortar a peça.", 50, 150, ["churrasco", "cozinha", "tecnologia"]),
  i("tabua-churrasco", "Tábua grande para servir churrasco", "Com canaleta para o caldo e madeira de lei.", 80, 200, ["churrasco", "casa"]),
  i("chocolates-artesanais", "Caixa de chocolates artesanais", "Bombons de chocolatarias brasileiras com cacau de origem.", 40, 120, ["chocolate"], { versatil: true }),
  i("trufas", "Trufas e bombons finos", "Uma caixa caprichada para adoçar o dia.", 30, 90, ["chocolate"], { versatil: true }),
  i("kit-confeitaria", "Kit de confeitaria", "Bicos, sacos e espátulas para decorar bolos e cupcakes.", 60, 160, ["doces", "cozinha"]),
  i("fondue", "Aparelho de fondue", "Para noites de queijo, chocolate e conversa.", 100, 250, ["chocolate", "cozinha", "vinho"]),
  i("doces-mineiros", "Cesta de doces mineiros", "Doce de leite, goiabada cascão e queijo da roça.", 70, 180, ["doces"]),
  i("pipoqueira", "Pipoqueira para a noite de filme", "Pipoca de cinema em casa, em três minutos.", 80, 250, ["cinema", "series", "cozinha"]),
  i("noite-de-filme", "Kit noite de filme", "Pipoca gourmet, doces e uma manta para o sofá.", 60, 160, ["cinema", "series", "doces"], { versatil: true }),
  i("vale-jantar", "Vale-jantar para duas pessoas", "Uma experiência em um restaurante especial.", 150, 400, ["cozinha", "vinho"], { versatil: true, palavras: ["restaurante"] }),

  // Vinho, cerveja e drinks
  i("vinho-tinto", "Vinho tinto selecionado", "Um rótulo bem avaliado da América do Sul.", 70, 200, ["vinho"]),
  i("tacas-cristal", "Par de taças de cristal", "Taças finas que valorizam o vinho e o brinde.", 80, 250, ["vinho", "casa"]),
  i("saca-rolhas-eletrico", "Saca-rolhas elétrico", "Abre a garrafa com um toque, sem esforço.", 80, 200, ["vinho", "tecnologia"]),
  i("decanter", "Decanter de vidro", "Deixa o vinho respirar e fica lindo na mesa.", 90, 250, ["vinho", "decoracao"]),
  i("cervejas-artesanais", "Kit de cervejas artesanais", "Estilos diferentes de cervejarias brasileiras.", 60, 150, ["cerveja"]),
  i("copos-cerveja", "Copos de cerveja de estilos diferentes", "Cada estilo no copo certo: pint, tulipa e weiss.", 60, 160, ["cerveja", "casa"]),
  i("growler", "Growler térmico para chope", "Leva o chope da cervejaria gelado para casa.", 120, 280, ["cerveja"]),
  i("kit-coquetelaria", "Kit de coquetelaria", "Coqueteleira, dosador e colher bailarina.", 100, 280, ["drinks", "casa"]),
  i("kit-gin", "Kit gin-tônica com especiarias", "Especiarias, taças e as combinações clássicas.", 120, 280, ["drinks"]),

  // Games e jogos de tabuleiro
  i("controle-extra", "Controle sem fio extra", "Para jogar com mais alguém (ou trocar o gasto).", 250, 500, ["games", "tecnologia"]),
  i("cartao-games", "Cartão-presente de loja de jogos", "Para escolher o jogo que quiser na loja do console.", 50, 300, ["games"]),
  i("headset", "Headset gamer com microfone", "Som imersivo e conversa clara nas partidas online.", 150, 450, ["games", "tecnologia", "musica"]),
  i("mousepad", "Mousepad grande", "Cobre a mesa toda e deixa o setup mais bonito.", 50, 130, ["games", "escritorio"], { temCor: true }),
  i("mouse-gamer", "Mouse gamer", "Preciso, confortável e com botões extras.", 100, 300, ["games", "tecnologia"]),
  i("base-controles", "Base de carregamento para controles", "Os controles sempre com bateria e organizados.", 80, 200, ["games", "organizacao"]),
  i("tabuleiro-familia", "Jogo de tabuleiro para a família", "Partidas rápidas para jogar com quem estiver por perto.", 80, 250, ["tabuleiro", "criancas"], { versatil: true }),
  i("cartas-festa", "Jogo de cartas para festas", "Risada garantida em qualquer reunião.", 40, 100, ["tabuleiro"], { versatil: true }),
  i("quebra-cabeca", "Quebra-cabeça de 1000 peças", "Uma paisagem bonita para montar com calma.", 50, 130, ["tabuleiro", "arte"]),
  i("xadrez-madeira", "Tabuleiro de xadrez de madeira", "Jogo clássico que também decora a sala.", 80, 250, ["tabuleiro", "decoracao"]),
  i("jogo-estrategia", "Jogo de tabuleiro de estratégia", "Para quem gosta de pensar várias jogadas à frente.", 180, 400, ["tabuleiro"]),

  // Música
  i("fone-sem-fio", "Fone de ouvido sem fio", "Bom som, bateria longa e estojo de bolso.", 120, 400, ["musica", "tecnologia", "corrida"], { versatil: true, palavras: ["fone", "ouvido"] }),
  i("caixa-som", "Caixa de som portátil à prova d'água", "Leva a trilha sonora para o banho, a praia e o churrasco.", 150, 450, ["musica", "praia", "tecnologia"], { versatil: true, temCor: true }),
  i("disco-vinil", "Disco de vinil de um artista favorito", "Para ouvir do jeito clássico (ou emoldurar).", 120, 300, ["musica", "colecionaveis"]),
  i("vitrola", "Vitrola retrô", "Toca discos de vinil e ainda decora a sala.", 350, 800, ["musica", "decoracao"]),
  i("ukulele", "Ukulele para iniciantes", "Fácil de aprender e cabe em qualquer viagem.", 150, 350, ["musica"]),
  i("acessorios-violao", "Encordoamento e acessórios para violão", "Cordas novas, palhetas e afinador.", 40, 120, ["musica"], { palavras: ["violao", "guitarra"] }),
  i("kalimba", "Kalimba (piano de dedo)", "Instrumento delicado, relaxante e fácil de tocar.", 60, 150, ["musica", "meditacao"]),

  // Cinema, séries, anime, quadrinhos e colecionáveis
  i("ingressos-cinema", "Par de ingressos de cinema", "Um programa a dois garantido.", 50, 120, ["cinema"], { versatil: true }),
  i("projetor", "Projetor portátil", "Cinema na parede de casa, em tela grande.", 400, 1000, ["cinema", "series", "tecnologia"]),
  i("manta-sofa", "Manta macia para o sofá", "Para maratonar séries no quentinho.", 70, 180, ["series", "casa", "autocuidado"], { versatil: true, temCor: true }),
  i("streaming", "Assinatura de streaming (3 meses)", "Filmes e séries à vontade, por conta do amigo oculto.", 60, 150, ["series", "cinema"]),
  i("poster-filme", "Pôster emoldurado de filme clássico", "Arte de cinema para a parede.", 60, 160, ["cinema", "decoracao"]),
  i("livro-serie", "Livro ou guia oficial de uma série", "Bastidores e curiosidades da série preferida.", 60, 150, ["series", "leitura"]),
  i("volumes-manga", "Volumes de mangá", "Os próximos volumes da coleção (ou o começo de uma nova).", 40, 120, ["anime", "quadrinhos", "leitura"]),
  i("figura-anime", "Figura de personagem de anime", "Peça de coleção com acabamento detalhado.", 100, 350, ["anime", "colecionaveis"]),
  i("luminaria-3d", "Luminária 3D de personagem", "Ilusão de óptica com luz colorida para a mesa.", 60, 150, ["anime", "games", "decoracao"]),
  i("hq-luxo", "HQ encadernada de luxo", "Uma saga completa em capa dura.", 60, 200, ["quadrinhos", "leitura", "colecionaveis"]),
  i("boneco-colecionavel", "Boneco colecionável estilo vinil", "O personagem favorito para a estante.", 100, 220, ["colecionaveis", "cinema", "games"]),
  i("blocos-montar", "Kit de blocos de montar para adultos", "Horas de montagem e uma peça linda no final.", 200, 600, ["colecionaveis", "decoracao", "criancas"], { palavras: ["lego"] }),
  i("miniatura-carro", "Miniatura de carro em metal", "Réplica detalhada de um carro clássico.", 60, 200, ["colecionaveis"], { palavras: ["carro"] }),
  i("camiseta-geek", "Camiseta de filme, série ou anime", "Estampa do universo preferido da pessoa.", 60, 120, ["moda", "cinema", "series", "anime"], { tamanho: "roupa", temCor: true }),

  // Tecnologia
  i("power-bank", "Carregador portátil (power bank)", "O celular sempre com bateria, em qualquer lugar.", 80, 200, ["tecnologia", "viagem"], { versatil: true, palavras: ["carregador", "bateria"] }),
  i("smartwatch", "Relógio inteligente", "Notificações, passos, sono e treinos no pulso.", 300, 900, ["tecnologia", "fitness", "corrida"], { palavras: ["relogio"] }),
  i("carregador-sem-fio", "Base de carregamento sem fio", "É só apoiar o celular e pronto.", 80, 200, ["tecnologia", "escritorio"]),
  i("lampadas-inteligentes", "Lâmpadas inteligentes coloridas", "Controladas pelo celular ou pela voz.", 80, 220, ["tecnologia", "casa", "decoracao"]),
  i("assistente-voz", "Caixa de som com assistente de voz", "Música, lembretes e a casa conectada.", 250, 500, ["tecnologia", "casa", "musica"]),
  i("teclado-mecanico", "Teclado mecânico", "Digitação gostosa para trabalhar e jogar.", 200, 500, ["tecnologia", "games", "escritorio"]),
  i("webcam", "Webcam Full HD", "Imagem nítida nas chamadas de vídeo.", 150, 350, ["tecnologia", "escritorio"]),
  i("organizador-cabos", "Kit organizador de cabos e limpeza de telas", "Mesa arrumada e telas sem marcas.", 40, 100, ["tecnologia", "organizacao"]),
  i("localizador", "Localizador Bluetooth para chaves e malas", "Nunca mais perder as chaves (ou a mala).", 120, 280, ["tecnologia", "viagem"]),

  // Fotografia, arte, artesanato e papelaria
  i("camera-instantanea", "Câmera instantânea", "A foto sai na hora, para guardar ou presentear.", 400, 800, ["fotografia", "viagem"]),
  i("filmes-instantanea", "Filmes para câmera instantânea", "Mais fotos para a câmera que a pessoa já tem.", 80, 180, ["fotografia"]),
  i("album-fotos", "Álbum de fotos para personalizar", "Para guardar as memórias do ano (e deste amigo oculto).", 60, 150, ["fotografia", "decoracao"], { versatil: true }),
  i("tripe-celular", "Tripé flexível para celular", "Fotos e vídeos estáveis de qualquer ângulo.", 50, 150, ["fotografia", "viagem", "tecnologia"]),
  i("fotos-moldura", "Fotos impressas com moldura", "As melhores fotos da pessoa, prontas para a parede.", 60, 160, ["fotografia", "decoracao"]),
  i("kit-aquarela", "Kit de aquarela com pincéis", "Cores vivas e papel próprio para começar a pintar.", 60, 180, ["arte"]),
  i("sketchbook", "Sketchbook com lápis de desenho", "Papel encorpado e lápis de várias durezas.", 50, 130, ["arte", "papelaria"]),
  i("canetas-brush", "Canetas brush para lettering", "Traço fino e grosso na mesma caneta.", 50, 150, ["papelaria", "arte"]),
  i("kit-pintura-tela", "Kit de pintura em tela", "Telas, tintas acrílicas e pincéis.", 80, 200, ["arte", "decoracao"]),
  i("kit-croche", "Kit de crochê ou tricô com fios", "Agulhas, fios macios e receitas para começar.", 60, 150, ["artesanato"]),
  i("kit-bordado", "Kit de bordado para iniciantes", "Bastidor, linhas e um desenho para bordar.", 40, 100, ["artesanato", "decoracao"]),
  i("kit-argila", "Kit de modelagem com argila", "Argila que seca no ar, ferramentas e tintas.", 60, 150, ["artesanato", "arte", "criancas"]),
  i("planner", "Planner do ano", "Para organizar a rotina, as metas e os sonhos.", 50, 120, ["papelaria", "organizacao", "escritorio"], { versatil: true, temCor: true }),
  i("caderno-premium", "Caderno de capa dura e caneta especial", "Papel bom de escrever e uma caneta que desliza.", 50, 130, ["papelaria", "escritorio"], { temCor: true }),
  i("caneta-tinteiro", "Caneta-tinteiro", "Escrita elegante para quem ama papel.", 80, 250, ["papelaria", "escritorio", "colecionaveis"]),
  i("fitas-washi", "Fitas washi e adesivos", "Para decorar cadernos, agendas e cartas.", 30, 80, ["papelaria", "arte"]),

  // Escritório, organização, casa e decoração
  i("garrafa-termica-mesa", "Garrafa térmica de mesa", "Café quente o dia inteiro no trabalho ou em casa.", 60, 150, ["escritorio", "cafe", "casa"], { temCor: true }),
  i("organizador-mesa", "Organizador de mesa em madeira", "Canetas, celular e papéis no lugar.", 50, 140, ["escritorio", "organizacao"]),
  i("suporte-notebook", "Suporte ergonômico para notebook", "A tela na altura dos olhos e o pescoço agradece.", 80, 200, ["escritorio", "tecnologia"]),
  i("luminaria-mesa", "Luminária de mesa", "Luz boa para ler, estudar e trabalhar.", 80, 250, ["escritorio", "decoracao", "leitura"], { temCor: true }),
  i("caixas-organizadoras", "Caixas organizadoras", "Bonitas o bastante para ficar à vista.", 50, 150, ["organizacao", "casa"], { temCor: true }),
  i("rotulador", "Rotulador (etiquetadora)", "Etiquetas para potes, pastas e gavetas.", 120, 300, ["organizacao", "tecnologia"]),
  i("vela-aromatica", "Vela aromática", "Perfume suave e luz aconchegante.", 40, 120, ["decoracao", "autocuidado", "casa"], { versatil: true }),
  i("difusor-aromas", "Difusor de aromas com óleos essenciais", "Casa cheirosa e clima de relaxamento.", 80, 200, ["casa", "autocuidado", "meditacao"], { versatil: true }),
  i("quadro-decorativo", "Quadro decorativo", "Uma arte nova para a parede.", 60, 200, ["decoracao", "arte"]),
  i("porta-retrato-digital", "Porta-retrato digital", "As fotos da família passando na estante.", 250, 500, ["decoracao", "fotografia", "tecnologia"]),
  i("jogo-lencois", "Jogo de lençóis macios", "Algodão de boa qualidade para dormir melhor.", 150, 400, ["casa", "autocuidado"], { temCor: true }),
  i("capas-almofada", "Capas de almofada", "Renovam o sofá sem gastar muito.", 50, 150, ["decoracao", "casa"], { temCor: true }),
  i("relogio-parede", "Relógio de parede", "Design bonito e silencioso.", 70, 200, ["decoracao"]),
  i("aspirador-robo", "Aspirador robô", "Limpa a casa sozinho enquanto a pessoa descansa.", 700, 1600, ["casa", "tecnologia", "organizacao"]),
  i("luminaria-lua", "Luminária de lua 3D", "Uma lua de verdade na mesa de cabeceira.", 60, 160, ["decoracao", "astronomia"], { versatil: true }),

  // Plantas, jardinagem e natureza
  i("suculentas", "Trio de suculentas com vasos", "Fáceis de cuidar e alegram qualquer canto.", 40, 110, ["plantas", "decoracao"], { versatil: true }),
  i("vaso-autoirrigavel", "Vaso autoirrigável", "A planta se rega sozinha por dias.", 50, 140, ["plantas", "jardinagem"], { temCor: true }),
  i("kit-horta", "Kit de horta caseira com sementes", "Temperos frescos na janela da cozinha.", 50, 130, ["jardinagem", "cozinha", "plantas"]),
  i("ferramentas-jardim", "Kit de ferramentas de jardinagem", "Pá, ancinho, luvas e regador.", 60, 160, ["jardinagem"]),
  i("terrario", "Terrário montado", "Um pequeno jardim dentro do vidro.", 80, 200, ["plantas", "decoracao", "natureza"]),
  i("guia-plantas", "Guia ilustrado de plantas", "Como cuidar de cada planta, com fotos lindas.", 60, 140, ["plantas", "leitura", "natureza"]),
  i("comedouro-passaros", "Comedouro para pássaros", "Para receber visitas coloridas no quintal ou na varanda.", 40, 110, ["natureza", "jardinagem"]),
  i("binoculo", "Binóculo compacto", "Para trilhas, viagens, pássaros e estrelas.", 150, 400, ["natureza", "viagem", "astronomia"]),

  // Pets
  i("caminha-pet", "Caminha para o pet", "Macia, lavável e do tamanho certo do bichinho.", 70, 200, ["pets"], { temCor: true }),
  i("brinquedos-pet", "Kit de brinquedos para o pet", "Mordedores, bolinhas e diversão garantida.", 40, 100, ["pets"]),
  i("comedouro-lento", "Comedouro lento", "Ajuda o pet a comer com calma.", 40, 120, ["pets"]),
  i("foto-pet", "Caneca ou almofada com a foto do pet", "O bichinho estampado para matar a saudade.", 50, 120, ["pets", "decoracao"]),
  i("arranhador", "Arranhador para gatos", "Diversão para o gato e o sofá a salvo.", 80, 250, ["pets"], { palavras: ["gato"] }),
  i("coleira-guia", "Coleira e guia estilosas", "Passeios com segurança e estilo.", 50, 140, ["pets"], { temCor: true, palavras: ["cachorro", "passeio"] }),

  // Esportes, futebol, corrida, treino, yoga e bike
  i("camisa-time", "Camisa do time do coração", "A camisa oficial da temporada.", 250, 450, ["futebol", "esportes", "moda"], { tamanho: "roupa", palavras: ["camisa"] }),
  i("bola-futebol", "Bola de futebol de boa qualidade", "Para a pelada do fim de semana.", 100, 300, ["futebol", "esportes"]),
  i("ingresso-jogo", "Ingresso para um jogo do time", "Uma tarde (ou noite) inesquecível no estádio.", 80, 300, ["futebol", "esportes"]),
  i("copo-time", "Caneca ou copo do time", "Para torcer até no café da manhã.", 40, 100, ["futebol"]),
  i("tenis-corrida", "Tênis de corrida", "Amortecimento e leveza para os treinos.", 300, 800, ["corrida", "esportes", "fitness"], { tamanho: "calcado", temCor: true }),
  i("cinto-corrida", "Pochete de corrida", "Celular, chave e gel sem balançar.", 40, 120, ["corrida"]),
  i("meias-compressao", "Meias de compressão", "Recuperação melhor depois dos treinos longos.", 50, 150, ["corrida", "fitness"]),
  i("inscricao-corrida", "Inscrição em uma corrida de rua", "Um objetivo novo (e uma medalha) para o próximo mês.", 100, 250, ["corrida", "esportes"]),
  i("garrafa-esportiva", "Garrafa térmica esportiva", "Água gelada no treino, na trilha e no trabalho.", 60, 180, ["fitness", "esportes", "camping"], { versatil: true, temCor: true, palavras: ["garrafa", "squeeze"] }),
  i("elasticos-treino", "Kit de elásticos de treino", "Treino completo em casa ou na viagem.", 50, 130, ["fitness"]),
  i("tapete-yoga", "Tapete de yoga antiderrapante", "Firme, confortável e fácil de carregar.", 80, 250, ["yoga", "fitness", "meditacao"], { temCor: true }),
  i("roupa-treino", "Conjunto de roupa de treino", "Tecido que respira e não marca.", 120, 300, ["fitness", "moda"], { tamanho: "roupa", temCor: true }),
  i("rolo-massagem", "Rolo de liberação miofascial", "Alivia a musculatura depois do treino.", 50, 150, ["fitness", "corrida", "autocuidado"]),
  i("acessorios-bike", "Luvas e luz para bicicleta", "Mais conforto e segurança no pedal.", 60, 180, ["bicicleta"]),
  i("suporte-bike", "Suporte de celular para bike", "O mapa sempre à vista no guidão.", 40, 120, ["bicicleta", "tecnologia"]),
  i("raquetes-beach", "Kit de raquetes de beach tennis", "Duas raquetes e bolinhas para começar.", 150, 450, ["esportes", "praia"]),

  // Praia, camping, viagem e pesca
  i("toalha-praia", "Toalha de praia de microfibra", "Seca rápido e ocupa pouco espaço na bolsa.", 50, 140, ["praia", "viagem"], { temCor: true }),
  i("cadeira-praia", "Cadeira de praia reclinável", "Conforto para passar o dia na areia.", 120, 300, ["praia"]),
  i("bolsa-termica", "Bolsa térmica (cooler)", "Bebida gelada na praia, no parque e no churrasco.", 70, 200, ["praia", "camping", "churrasco"]),
  i("lanterna-cabeca", "Lanterna de cabeça recarregável", "Mãos livres na trilha, no camping e na corrida noturna.", 50, 150, ["camping", "corrida", "natureza"]),
  i("rede-portatil", "Rede de descanso portátil", "Arma em duas árvores e vira o melhor lugar do passeio.", 80, 220, ["camping", "praia", "natureza"]),
  i("canivete", "Canivete multifuncional", "Ferramenta útil para trilhas e o dia a dia.", 80, 250, ["camping"]),
  i("mochila-trilha", "Mochila de trilha", "Leve, resistente e com espaço para água.", 150, 400, ["camping", "viagem", "natureza"]),
  i("necessaires", "Kit de necessaires de viagem", "Mala organizada do jeito certo.", 50, 140, ["viagem", "organizacao"], { temCor: true }),
  i("travesseiro-viagem", "Travesseiro de pescoço para viagem", "Dormir no avião (ou no ônibus) sem dor.", 50, 130, ["viagem", "autocuidado"]),
  i("porta-passaporte", "Porta-passaporte e etiquetas de mala", "Documentos juntos e mala fácil de achar.", 40, 100, ["viagem"]),
  i("mapa-raspar", "Mapa-múndi de raspar", "Raspe os países que já visitou.", 60, 150, ["viagem", "decoracao"]),
  i("kit-pesca", "Kit de iscas e acessórios de pesca", "Para a próxima pescaria render mais.", 60, 200, ["pesca", "natureza"]),

  // Moda, beleza, perfumaria e autocuidado
  i("carteira-couro", "Carteira de couro", "Clássica, fina e feita para durar.", 80, 250, ["moda"], { temCor: true }),
  i("bone", "Boné ou chapéu", "Estilo e proteção contra o sol.", 60, 160, ["moda", "praia"], { temCor: true }),
  i("oculos-sol", "Óculos de sol", "Proteção UV com um modelo que combina com a pessoa.", 100, 400, ["moda", "praia", "viagem"]),
  i("lenco-estampado", "Lenço estampado", "Vai no pescoço, no cabelo ou na bolsa.", 50, 150, ["moda"], { temCor: true }),
  i("brinco-colar", "Brinco ou colar delicado", "Uma peça para usar todos os dias.", 50, 180, ["moda"], { palavras: ["joia", "bijuteria"] }),
  i("pijama", "Pijama confortável", "Tecido macio para dormir bem.", 80, 200, ["moda", "autocuidado", "casa"], { tamanho: "roupa", temCor: true }),
  i("pantufa", "Pantufa quentinha", "Pés aquecidos nas noites frias.", 50, 120, ["autocuidado", "casa"], { tamanho: "calcado", temCor: true }),
  i("bolsa-transversal", "Bolsa transversal", "Prática para passear e viajar.", 100, 300, ["moda", "viagem"], { temCor: true }),
  i("paleta-sombras", "Paleta de sombras", "Cores para o dia a dia e para a festa.", 60, 200, ["beleza"]),
  i("kit-skincare", "Kit de skincare (limpeza e hidratação)", "Uma rotina simples para a pele.", 80, 250, ["beleza", "autocuidado"]),
  i("pinceis-maquiagem", "Kit de pincéis de maquiagem", "Macios, com estojo para levar.", 60, 180, ["beleza"]),
  i("escova-secadora", "Escova secadora", "Seca e modela o cabelo ao mesmo tempo.", 200, 450, ["beleza", "tecnologia"]),
  i("perfume", "Perfume", "Uma fragrância marcante, no estilo da pessoa.", 150, 600, ["perfumaria", "beleza"]),
  i("kit-banho", "Kit de banho relaxante", "Sais, óleos e sabonetes para um banho de spa.", 50, 150, ["autocuidado", "beleza"], { versatil: true }),
  i("massageador-pescoco", "Massageador elétrico para pescoço", "Alivia a tensão depois de um dia puxado.", 100, 300, ["autocuidado", "tecnologia"]),
  i("mascara-dormir", "Máscara de dormir de seda", "Sono profundo até com luz acesa.", 40, 100, ["autocuidado", "viagem"]),
  i("roupao", "Roupão macio", "Conforto depois do banho.", 120, 300, ["autocuidado", "casa"], { tamanho: "roupa", temCor: true }),
  i("vale-massagem", "Vale-massagem em um spa", "Uma hora só para relaxar.", 150, 400, ["autocuidado"]),

  // Crianças
  i("brinquedo-madeira", "Brinquedo educativo de madeira", "Encaixes, cores e formas para aprender brincando.", 60, 200, ["criancas"]),
  i("livro-infantil", "Livro infantil ilustrado", "Uma história linda para ler junto.", 40, 90, ["criancas", "leitura"]),
  i("kit-experimentos", "Kit de experimentos científicos", "Vulcão, cristais e química divertida.", 80, 200, ["ciencia", "criancas"]),
  i("kit-massinha", "Kit de massinha e moldes", "Criatividade sem bagunça.", 40, 100, ["criancas", "arte"]),
  i("pelucia", "Pelúcia macia", "Para abraçar (em qualquer idade).", 50, 150, ["criancas", "decoracao"]),

  // Ciência, astronomia, idiomas e meditação
  i("telescopio", "Telescópio para iniciantes", "Crateras da Lua e anéis de Saturno no quintal.", 400, 1000, ["astronomia", "ciencia", "natureza"]),
  i("projetor-estrelas", "Projetor de estrelas", "Um céu estrelado no teto do quarto.", 80, 200, ["astronomia", "decoracao", "criancas"]),
  i("globo-luz", "Globo terrestre com luz", "Mapa-múndi que vira luminária à noite.", 100, 300, ["ciencia", "viagem", "decoracao"]),
  i("divulgacao-cientifica", "Livro de divulgação científica", "Ciência contada de um jeito apaixonante.", 50, 110, ["ciencia", "leitura"]),
  i("microscopio", "Microscópio para iniciantes", "Um mundo invisível para explorar.", 150, 400, ["ciencia", "criancas"]),
  i("app-idiomas", "Assinatura de aplicativo de idiomas (3 meses)", "Aulas curtas todo dia, no celular.", 80, 200, ["idiomas", "tecnologia"]),
  i("livro-outro-idioma", "Livro fácil em outro idioma", "Para praticar a leitura no idioma que está aprendendo.", 50, 120, ["idiomas", "leitura"]),
  i("cartas-conversacao", "Cartas de conversação em outro idioma", "Perguntas para treinar a fala brincando.", 40, 100, ["idiomas", "tabuleiro"]),
  i("almofada-meditacao", "Almofada de meditação", "Postura confortável para meditar.", 80, 200, ["meditacao", "yoga"]),
  i("app-meditacao", "Assinatura de aplicativo de meditação", "Meditações guiadas para dormir e desacelerar.", 100, 250, ["meditacao", "autocuidado"]),
  i("diario-gratidao", "Diário da gratidão", "Alguns minutos por dia para olhar o que deu certo.", 40, 90, ["meditacao", "papelaria", "autocuidado"], { versatil: true }),

  // Coringa
  i("cartao-presente", "Cartão-presente de livraria ou loja online", "A pessoa escolhe o que quiser, no valor do grupo.", 30, 500, ["leitura"], { versatil: true, palavras: ["vale"] }),
];
