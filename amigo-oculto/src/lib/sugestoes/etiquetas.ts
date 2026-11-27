import { contemFrase, tokens } from "@/lib/sugestoes/texto";

/**
 * Etiquetas (temas de interesse) das ideias de presente. Cada uma tem o rótulo que aparece no motivo
 * ("Porque gosta de café") e os sinônimos que a pessoa pode ter escrito nas preferências ou na lista de desejos.
 * Os sinônimos passam pela mesma normalização (sem acento, minúsculas, singular), então "Cafés" acha "café".
 */
type DefEtiqueta = { rotulo: string; motivo?: string; sinonimos: string[] };

export const ETIQUETAS = {
  leitura: { rotulo: "leitura", sinonimos: ["leitura", "ler", "livro", "literatura", "romance", "ficcao", "poesia", "leitor", "leitora", "kindle", "ebook", "e book", "biblioteca", "best seller", "clube do livro", "sebo"] },
  cafe: { rotulo: "café", sinonimos: ["cafe", "cafeina", "espresso", "expresso", "barista", "capuccino", "cappuccino", "cafezinho", "coado", "cafeteira"] },
  cha: { rotulo: "chá", sinonimos: ["cha", "infusao", "matcha", "erva", "chimarrao", "tisana"] },
  cozinha: { rotulo: "cozinhar", sinonimos: ["cozinha", "cozinhar", "culinaria", "receita", "gastronomia", "chef", "cozinheiro", "cozinheira", "comida", "comer bem", "masterchef"] },
  churrasco: { rotulo: "churrasco", sinonimos: ["churrasco", "churras", "churrasqueiro", "churrasqueira", "carne", "grelhado", "parrilla", "barbecue"] },
  doces: { rotulo: "doces", sinonimos: ["doce", "docinho", "confeitaria", "confeitar", "bolo", "brigadeiro", "sobremesa", "acucar", "goiabada"] },
  chocolate: { rotulo: "chocolate", sinonimos: ["chocolate", "cacau", "bombom", "trufa", "nutella"] },
  vinho: { rotulo: "vinho", sinonimos: ["vinho", "enologia", "sommelier", "tinto", "espumante", "champanhe", "vinicola"] },
  cerveja: { rotulo: "cerveja", sinonimos: ["cerveja", "breja", "chope", "chopp", "cervejaria", "ipa", "cerveja artesanal"] },
  drinks: { rotulo: "drinks", sinonimos: ["drink", "drinque", "coquetel", "coquetelaria", "gin", "whisky", "uisque", "caipirinha", "bartender", "mixologia"] },
  alcool: { rotulo: "bebidas", sinonimos: ["bebida", "bebida alcoolica", "alcool", "alcoolica", "beber", "bar", "happy hour"] },
  games: { rotulo: "games", sinonimos: ["game", "games", "gamer", "videogame", "video game", "jogo eletronico", "playstation", "ps4", "ps5", "xbox", "nintendo", "switch", "steam", "jogar online", "console", "minecraft", "fortnite"] },
  tabuleiro: { rotulo: "jogos de tabuleiro", sinonimos: ["tabuleiro", "jogo de tabuleiro", "board game", "boardgame", "jogo de carta", "carta", "baralho", "xadrez", "quebra cabeca", "puzzle", "domino", "uno", "rpg"] },
  musica: { rotulo: "música", sinonimos: ["musica", "musico", "cantar", "cantor", "cantora", "violao", "guitarra", "piano", "teclado musical", "bateria", "banda", "show", "vinil", "spotify", "fone", "rock", "samba", "pagode", "sertanejo", "mpb", "funk", "rap", "kpop", "k pop", "ukulele"] },
  cinema: { rotulo: "cinema", sinonimos: ["cinema", "filme", "cinefilo", "cinefila", "pipoca", "hollywood", "oscar", "terror", "comedia"] },
  series: { rotulo: "séries", sinonimos: ["serie", "netflix", "maratonar", "streaming", "dorama", "novela", "sitcom", "hbo", "disney"] },
  anime: { rotulo: "anime", sinonimos: ["anime", "manga", "otaku", "cosplay", "naruto", "one piece", "pokemon", "ghibli", "dragon ball", "japao", "cultura japonesa"] },
  quadrinhos: { rotulo: "quadrinhos", sinonimos: ["quadrinho", "hq", "hqs", "gibi", "comic", "comics", "marvel", "dc", "super heroi", "heroi", "turma da monica"] },
  colecionaveis: { rotulo: "colecionáveis", sinonimos: ["colecionar", "colecao", "colecionador", "colecionavel", "funko", "action figure", "miniatura", "lego", "boneco", "figure"] },
  tecnologia: { rotulo: "tecnologia", sinonimos: ["tecnologia", "tech", "eletronico", "gadget", "computador", "notebook", "celular", "smartphone", "programacao", "programar", "programador", "informatica", "inovacao", "apple", "android", "robotica"] },
  fotografia: { rotulo: "fotografia", sinonimos: ["fotografia", "foto", "fotografar", "fotografo", "fotografa", "camera", "polaroid", "instax", "selfie", "instagram"] },
  arte: { rotulo: "arte", sinonimos: ["arte", "artista", "desenho", "desenhar", "pintura", "pintar", "aquarela", "ilustracao", "ilustrar", "museu", "exposicao", "lettering", "caligrafia", "grafite"] },
  artesanato: { rotulo: "artesanato", sinonimos: ["artesanato", "croche", "trico", "bordado", "bordar", "costura", "costurar", "macrame", "faca voce mesmo", "diy", "ceramica", "argila", "patchwork"] },
  papelaria: { rotulo: "papelaria", sinonimos: ["papelaria", "caderno", "caneta", "planner", "agenda", "bullet journal", "estojo", "marca texto", "adesivo", "washi", "escrever", "anotar"] },
  escritorio: { rotulo: "trabalho", motivo: "Ajuda no trabalho e no home office", sinonimos: ["escritorio", "home office", "trabalho", "trabalhar", "produtividade", "reuniao", "mesa de trabalho"] },
  organizacao: { rotulo: "organização", sinonimos: ["organizacao", "organizar", "organizado", "organizada", "minimalismo", "minimalista", "arrumar", "faxina"] },
  casa: { rotulo: "cuidar da casa", sinonimos: ["casa", "lar", "casa nova", "apartamento", "ape", "dona de casa", "aconchego", "aconchegante"] },
  decoracao: { rotulo: "decoração", sinonimos: ["decoracao", "decorar", "decor", "enfeite", "design de interiores", "interiores", "quadro", "vela"] },
  plantas: { rotulo: "plantas", sinonimos: ["planta", "suculenta", "cacto", "flor", "orquidea", "samambaia", "plant lover", "mae de planta", "pai de planta"] },
  jardinagem: { rotulo: "jardinagem", sinonimos: ["jardinagem", "jardim", "horta", "cultivar", "plantar", "semente", "jardineiro", "jardineira", "paisagismo"] },
  natureza: { rotulo: "natureza", sinonimos: ["natureza", "ar livre", "ecologia", "sustentabilidade", "sustentavel", "passaro", "observar passaro", "meio ambiente", "sitio", "fazenda"] },
  pets: { rotulo: "pets", sinonimos: ["pet", "cachorro", "cachorra", "cao", "cadela", "gato", "gata", "gatinho", "cachorrinho", "animal de estimacao", "bicho", "dog", "cat", "felino", "canino"] },
  esportes: { rotulo: "esportes", sinonimos: ["esporte", "esportista", "atleta", "volei", "basquete", "tenis", "beach tennis", "natacao", "nadar", "handebol", "skate", "surf", "luta", "jiu jitsu", "boxe", "padel"] },
  futebol: { rotulo: "futebol", sinonimos: ["futebol", "bola", "torcedor", "torcedora", "time", "futsal", "society", "pelada", "copa", "brasileirao", "estadio", "torcer"] },
  corrida: { rotulo: "corrida", sinonimos: ["corrida", "correr", "corredor", "corredora", "maratona", "meia maratona", "running", "cooper", "corrida de rua", "5k", "10k"] },
  fitness: { rotulo: "treinar", sinonimos: ["fitness", "academia", "musculacao", "treino", "treinar", "malhar", "crossfit", "pilates", "funcional", "saude", "vida saudavel", "fit", "gym", "exercicio"] },
  yoga: { rotulo: "yoga", sinonimos: ["yoga", "ioga", "yogi", "alongamento"] },
  meditacao: { rotulo: "meditação", sinonimos: ["meditacao", "meditar", "mindfulness", "espiritualidade", "zen", "respiracao", "gratidao", "terapia", "calma"] },
  bicicleta: { rotulo: "pedalar", sinonimos: ["bicicleta", "bike", "ciclismo", "ciclista", "pedal", "pedalar", "mountain bike", "mtb"] },
  camping: { rotulo: "acampar e fazer trilhas", sinonimos: ["camping", "acampar", "acampamento", "trilha", "trekking", "aventura", "montanha", "escalada", "mochilao", "hiking", "barraca"] },
  praia: { rotulo: "praia", sinonimos: ["praia", "mar", "litoral", "verao", "piscina", "sol", "areia", "beach"] },
  viagem: { rotulo: "viajar", sinonimos: ["viagem", "viajar", "viajante", "turismo", "passeio", "passear", "conhecer lugar", "aeroporto", "mala", "intercambio", "mochileiro"] },
  pesca: { rotulo: "pescar", sinonimos: ["pesca", "pescar", "pescaria", "pescador", "anzol", "isca"] },
  moda: { rotulo: "moda", sinonimos: ["moda", "estilo", "fashion", "look", "acessorio", "bolsa", "bijuteria", "joia", "relogio", "oculos", "brinco", "colar", "anel"] },
  vestuario: { rotulo: "roupas", sinonimos: ["roupa", "vestuario", "camiseta", "camisa", "blusa", "calca", "vestido", "moletom", "jaqueta", "casaco", "pijama", "bermuda", "saia", "short"] },
  calcados: { rotulo: "calçados", sinonimos: ["calcado", "sapato", "sandalia", "chinelo", "sneaker", "bota", "pantufa"] },
  beleza: { rotulo: "beleza", sinonimos: ["beleza", "maquiagem", "make", "makeup", "batom", "cosmetico", "cabelo", "unha", "esmalte", "skincare", "skin care", "pele", "maquiar"] },
  perfumaria: { rotulo: "perfumes", sinonimos: ["perfume", "perfumaria", "colonia", "fragrancia", "cheiroso", "cheirosa"] },
  autocuidado: { rotulo: "autocuidado", sinonimos: ["autocuidado", "relaxar", "relaxamento", "spa", "massagem", "banho", "banheira", "bem estar", "descanso", "descansar", "dormir", "sono", "conforto"] },
  criancas: { rotulo: "brincadeiras", motivo: "Pensado para o universo infantil", sinonimos: ["crianca", "infantil", "brinquedo", "brincar", "bebe", "kids", "filho", "filha", "sobrinho", "sobrinha"] },
  ciencia: { rotulo: "ciência", sinonimos: ["ciencia", "cientista", "fisica", "quimica", "biologia", "experimento", "laboratorio", "matematica", "documentario"] },
  astronomia: { rotulo: "astronomia", sinonimos: ["astronomia", "estrela", "espaco", "universo", "telescopio", "planeta", "lua", "nasa", "constelacao", "astrologia", "signo"] },
  idiomas: { rotulo: "idiomas", sinonimos: ["idioma", "lingua", "ingles", "espanhol", "frances", "italiano", "alemao", "japones", "coreano", "duolingo", "poliglota"] },
} satisfies Record<string, DefEtiqueta>;

export type Etiqueta = keyof typeof ETIQUETAS;

export const LISTA_ETIQUETAS = Object.keys(ETIQUETAS) as Etiqueta[];

/** Etiquetas que uma ideia ganha automaticamente (vinho também é "bebidas"; chocolate também é "doces"). */
export const IMPLICA: Partial<Record<Etiqueta, Etiqueta[]>> = {
  vinho: ["alcool"],
  cerveja: ["alcool"],
  drinks: ["alcool"],
  chocolate: ["doces"],
};

/** Sinônimos já em tokens (calculado uma vez). */
const SINONIMOS: { etiqueta: Etiqueta; frase: string[] }[] = LISTA_ETIQUETAS.flatMap((etiqueta) =>
  (ETIQUETAS[etiqueta] as DefEtiqueta).sinonimos.map((s) => ({ etiqueta, frase: tokens(s) })).filter((s) => s.frase.length > 0),
);

/** Quais etiquetas um texto livre menciona ("Adoro cafés e livros" → café, leitura). */
export function detectarEtiquetas(texto: string): Set<Etiqueta> {
  const t = tokens(texto);
  const achadas = new Set<Etiqueta>();
  if (t.length === 0) return achadas;
  for (const { etiqueta, frase } of SINONIMOS) {
    if (!achadas.has(etiqueta) && contemFrase(t, frase)) achadas.add(etiqueta);
  }
  return achadas;
}

export function motivoDaEtiqueta(e: Etiqueta): string {
  const def = ETIQUETAS[e] as DefEtiqueta;
  return def.motivo ?? `Porque gosta de ${def.rotulo}`;
}

export function rotuloDaEtiqueta(e: Etiqueta): string {
  return (ETIQUETAS[e] as DefEtiqueta).rotulo;
}
