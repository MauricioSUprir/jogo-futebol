/* ===== dados.js — a base de conhecimento inicial do KATSEYE Central =====

   IMPORTANTE, e o app diz isso na cara do usuário: este arquivo é uma
   SEMENTE, não uma fonte oficial. Ele traz só o que é amplamente
   estabelecido sobre o grupo (formação, integrantes, país de origem e os
   lançamentos principais) e deixa de fora datas de nascimento, faixas de
   álbum e números que eu não consigo garantir.

   Tudo aqui é editável dentro do app (Enciclopédia → editar) e o que a
   pessoa editar é salvo no aparelho e passa a valer por cima desta semente.
   Se um dado estiver desatualizado, corrija na tela — não precisa mexer no
   código.                                                                   */

/* ---------- o grupo ---------- */
export const GRUPO = {
  nome: 'KATSEYE',
  gravadoras: 'HYBE × Geffen Records',
  formacao: 'The Debut: Dream Academy (2023)',
  estreia: '2024-06-28',                 // EP de estreia "SIS (Soft Is Strong)"
  base: 'Los Angeles, Estados Unidos',
  fandom: 'EYEKONS',
  conceito: 'Grupo global de pop formado por seis integrantes de origens diferentes, '
    + 'criado pela parceria entre HYBE e Geffen Records e escolhido por um programa '
    + 'de seleção internacional.',
};

/* ---------- integrantes ----------
   `cor` e `cor2` formam o gradiente da ficha e do monograma. `lore` é o texto
   de apresentação; `fatos` são marcadores curtos. Campos que eu não tenho
   como confirmar (nascimento, altura, signo…) nascem vazios de propósito,
   com o app convidando a preencher.                                        */
export const INTEGRANTES = [
  {
    id: 'manon',
    nome: 'Manon',
    nomeCompleto: 'Manon Bannerman',
    pais: 'Suíça',
    bandeira: '🇨🇭',
    origem: 'Suíça (ascendência ganesa)',
    monograma: 'MA',
    cor: '#7c3aed', cor2: '#4f46e5',
    papel: 'Vocal e dança',
    lore: 'Cresceu na Suíça e chegou ao grupo pelo programa de seleção da HYBE com a Geffen. '
      + 'Traz para o KATSEYE a mistura europeia do projeto: presença de palco contida, '
      + 'precisão nos detalhes e um timbre que segura bem as partes graves do refrão.',
    fatos: ['Origem suíça, com ascendência ganesa', 'Selecionada em The Debut: Dream Academy'],
    nascimento: '', altura: '', idiomas: 'Inglês, francês',
  },
  {
    id: 'sophia',
    nome: 'Sophia',
    nomeCompleto: 'Sophia Laforteza',
    pais: 'Filipinas',
    bandeira: '🇵🇭',
    origem: 'Manila, Filipinas',
    monograma: 'SO',
    cor: '#f43f5e', cor2: '#f59e0b',
    papel: 'Vocal principal e comunicação',
    lore: 'Filipina de Manila, é a voz que costuma abrir as conversas do grupo — nas entrevistas '
      + 'e nos lives. Vem de uma formação vocal forte e virou uma das pontes do KATSEYE com o '
      + 'público do Sudeste Asiático.',
    fatos: ['De Manila, nas Filipinas', 'Uma das vozes principais do grupo'],
    nascimento: '', altura: '', idiomas: 'Inglês, filipino',
  },
  {
    id: 'daniela',
    nome: 'Daniela',
    nomeCompleto: 'Daniela Avanzini',
    pais: 'Estados Unidos',
    bandeira: '🇺🇸',
    origem: 'Atlanta, EUA (ascendência cubana e venezuelana)',
    monograma: 'DA',
    cor: '#e11d48', cor2: '#a855f7',
    papel: 'Vocal e dança',
    lore: 'Nascida nos Estados Unidos, de família cubana e venezuelana, começou a treinar cedo. '
      + 'É a ligação do grupo com o público latino — e a integrante que mais naturalmente '
      + 'transita entre o inglês e o espanhol no palco.',
    fatos: ['De Atlanta, nos EUA', 'Ascendência cubana e venezuelana', 'Fala espanhol'],
    nascimento: '', altura: '', idiomas: 'Inglês, espanhol',
  },
  {
    id: 'lara',
    nome: 'Lara',
    nomeCompleto: 'Lara Raj',
    pais: 'Estados Unidos',
    bandeira: '🇺🇸',
    origem: 'Califórnia, EUA (ascendência indiana)',
    monograma: 'LA',
    cor: '#d946ef', cor2: '#22d3ee',
    papel: 'Vocal e performance',
    lore: 'Californiana de família indiana, é a integrante de presença mais imprevisível no palco: '
      + 'muda o tom de uma música inteira com um gesto. Ficou conhecida ainda no programa de '
      + 'seleção pela entrega nas performances.',
    fatos: ['Da Califórnia, nos EUA', 'Ascendência indiana'],
    nascimento: '', altura: '', idiomas: 'Inglês',
  },
  {
    id: 'megan',
    nome: 'Megan',
    nomeCompleto: 'Megan Skiendiel',
    pais: 'Estados Unidos',
    bandeira: '🇺🇸',
    origem: 'Havaí, EUA (ascendência chinesa)',
    monograma: 'ME',
    cor: '#0ea5e9', cor2: '#14b8a6',
    papel: 'Dança e rap',
    lore: 'Cresceu no Havaí, em família chinesa-americana, e entrou no projeto pela dança. '
      + 'É quem costuma puxar a parte mais física da coreografia e dá ao grupo a base rítmica '
      + 'nos trechos falados.',
    fatos: ['Do Havaí, nos EUA', 'Ascendência chinesa', 'Base forte em dança'],
    nascimento: '', altura: '', idiomas: 'Inglês',
  },
  {
    id: 'yoonchae',
    nome: 'Yoonchae',
    nomeCompleto: 'Jeung Yoonchae',
    pais: 'Coreia do Sul',
    bandeira: '🇰🇷',
    origem: 'Coreia do Sul',
    monograma: 'YO',
    cor: '#f59e0b', cor2: '#ec4899',
    papel: 'Vocal e dança · caçula',
    lore: 'A integrante mais nova do KATSEYE e a única sul-coreana da formação. Veio do treinamento '
      + 'em Seul e é a ponte direta do grupo com o mercado e o público coreano.',
    fatos: ['Única integrante sul-coreana', 'A mais nova do grupo'],
    nascimento: '', altura: '', idiomas: 'Coreano, inglês',
  },
];

/* ---------- discografia ----------
   Só lançamentos consolidados. `faixas` fica vazio quando eu não tenho a
   lista completa confirmada — a tela mostra o lançamento mesmo assim e
   convida a completar.                                                     */
export const DISCOGRAFIA = [
  {
    id: 'rel_touch',
    titulo: 'Touch',
    tipo: 'single',
    data: '2024-06-14',
    nota: 'Single de pré-lançamento, antes da estreia oficial.',
    faixas: [],
  },
  {
    id: 'rel_debut',
    titulo: 'Debut',
    tipo: 'single',
    data: '2024-06-28',
    nota: 'Faixa-título da estreia.',
    faixas: [],
  },
  {
    id: 'rel_sis',
    titulo: 'SIS (Soft Is Strong)',
    tipo: 'EP',
    data: '2024-06-28',
    nota: 'EP de estreia do grupo.',
    faixas: [],
  },
  {
    id: 'rel_gnarly',
    titulo: 'Gnarly',
    tipo: 'single',
    data: '2025-04-30',
    nota: 'Single de 2025, de recepção bastante dividida e alto alcance.',
    faixas: [],
  },
  {
    id: 'rel_gabriela',
    titulo: 'Gabriela',
    tipo: 'single',
    data: '2025-06-20',
    nota: 'Single do segundo EP.',
    faixas: [],
  },
  {
    id: 'rel_chaos',
    titulo: 'Beautiful Chaos',
    tipo: 'EP',
    data: '2025-06-27',
    nota: 'Segundo EP do grupo.',
    faixas: [],
  },
];

/* ---------- marcos ----------
   Linha do tempo do projeto, para a tela de Enciclopédia.                  */
export const MARCOS = [
  { data: '2023-09-01', titulo: 'The Debut: Dream Academy', texto: 'O programa de seleção global da HYBE com a Geffen vai ao ar e escolhe a formação.' },
  { data: '2024-06-14', titulo: 'Primeiro lançamento', texto: '"Touch" sai como pré-lançamento e apresenta o grupo ao público.' },
  { data: '2024-06-28', titulo: 'Estreia oficial', texto: 'Sai o EP "SIS (Soft Is Strong)", com "Debut" como faixa-título.' },
  { data: '2025-04-30', titulo: '"Gnarly"', texto: 'O single mais divisivo e mais comentado do grupo até então.' },
  { data: '2025-06-27', titulo: '"Beautiful Chaos"', texto: 'Segundo EP, com "Gabriela" liderando o lançamento.' },
];

/* ---------- fusos do relógio mundial ---------- */
export const FUSOS = [
  { id: 'sp', cidade: 'São Paulo', fuso: 'America/Sao_Paulo', bandeira: '🇧🇷' },
  { id: 'la', cidade: 'Los Angeles', fuso: 'America/Los_Angeles', bandeira: '🇺🇸' },
  { id: 'ny', cidade: 'Nova York', fuso: 'America/New_York', bandeira: '🇺🇸' },
  { id: 'seoul', cidade: 'Seul', fuso: 'Asia/Seoul', bandeira: '🇰🇷' },
  { id: 'manila', cidade: 'Manila', fuso: 'Asia/Manila', bandeira: '🇵🇭' },
  { id: 'londres', cidade: 'Londres', fuso: 'Europe/London', bandeira: '🇬🇧' },
  { id: 'toquio', cidade: 'Tóquio', fuso: 'Asia/Tokyo', bandeira: '🇯🇵' },
  { id: 'zurique', cidade: 'Zurique', fuso: 'Europe/Zurich', bandeira: '🇨🇭' },
];
export const FUSOS_PADRAO = ['sp', 'la', 'seoul', 'manila'];

/* ---------- paletas do Estúdio Criativo ---------- */
export const PALETAS = [
  {
    id: 'iris', nome: 'Íris', chamada: 'A assinatura do app',
    fundo: '#0a0614', a: '#a855f7', b: '#ff4f8b', c: '#f0c674', txt: '#ffffff',
  },
  {
    id: 'obsidiana', nome: 'Obsidiana', chamada: 'Preto e ouro',
    fundo: '#07070a', a: '#f0c674', b: '#d9a441', c: '#ffffff', txt: '#ffffff',
  },
  {
    id: 'neon', nome: 'Neon', chamada: 'Pista de dança',
    fundo: '#05010f', a: '#22d3ee', b: '#d946ef', c: '#a3e635', txt: '#ffffff',
  },
  {
    id: 'aurora', nome: 'Aurora', chamada: 'Frio e limpo',
    fundo: '#040d14', a: '#5eead4', b: '#60a5fa', c: '#c4b5fd', txt: '#ffffff',
  },
  {
    id: 'brasa', nome: 'Brasa', chamada: 'Quente e direto',
    fundo: '#12030a', a: '#fb7185', b: '#f97316', c: '#fde047', txt: '#ffffff',
  },
  {
    id: 'papel', nome: 'Papel', chamada: 'Claro, para impressão',
    fundo: '#f6f2ea', a: '#1b1630', b: '#a855f7', c: '#d9a441', txt: '#161227',
  },
];

/* ---------- formatos do Estúdio ---------- */
export const FORMATOS = [
  { id: 'cartaz', nome: 'Cartaz', emoji: '🖼️', l: 1080, a: 1350, desc: '4:5 — feed' },
  { id: 'story', nome: 'Flyer story', emoji: '📱', l: 1080, a: 1920, desc: '9:16 — stories' },
  { id: 'quadrado', nome: 'Post', emoji: '⬜', l: 1080, a: 1080, desc: '1:1 — post' },
  { id: 'ingresso', nome: 'Ingresso', emoji: '🎟️', l: 1500, a: 620, desc: 'colecionável' },
  { id: 'a4', nome: 'Cartaz A4', emoji: '📄', l: 1240, a: 1754, desc: '150 dpi — impressão' },
];

/* ---------- utilidades de leitura ---------- */
export const integrante = (id) => INTEGRANTES.find((m) => m.id === id) || null;
export const paleta = (id) => PALETAS.find((p) => p.id === id) || PALETAS[0];
export const formato = (id) => FORMATOS.find((f) => f.id === id) || FORMATOS[0];
export const fuso = (id) => FUSOS.find((f) => f.id === id) || null;

/** Aviso mostrado nas telas que exibem dados da semente. */
export const AVISO_DADOS = 'Os dados que já vêm preenchidos são um ponto de partida '
  + 'com o que é amplamente conhecido sobre o grupo — não são uma base oficial. '
  + 'Tudo é editável aqui dentro, e o que você editar passa a valer.';
