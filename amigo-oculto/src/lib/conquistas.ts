/**
 * Conquistas e medalhas, calculadas a partir das estatísticas de participação (`participation_stats` no banco).
 * Função pura (sem banco e sem React): a tela escolhe o ícone pelo nome (`icone`, um ícone do lucide).
 * Nada aqui usa o resultado do sorteio — só o que cada um fez no grupo.
 */

/** Uma linha de `participation_stats`. */
export type EstatisticasParticipacao = {
  participant_id: string;
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  chat: number;
  wall: number;
  votes: number;
  quiz_answers: number;
  quiz_correct: number;
  quiz_questions: number;
  wishlist: number;
  cards: number;
  capsules: number;
  challenges: number;
  bingo: number;
  photos: number;
  rsvp: boolean;
  gift_bought: boolean;
  viewed: boolean;
  points: number;
};

export type NomeIcone =
  | "CalendarCheck"
  | "Eye"
  | "ListChecks"
  | "Gift"
  | "MessagesSquare"
  | "Palette"
  | "Search"
  | "Mail"
  | "Hourglass"
  | "Clover"
  | "Dices"
  | "Camera"
  | "Vote"
  | "BookOpen";

export type Conquista = {
  id: string;
  nome: string;
  descricao: string;
  icone: NomeIcone;
  /** Cor da medalha. */
  cor: "ouro" | "rubi" | "esmeralda" | "t1";
  meta: number;
  valor: (e: EstatisticasParticipacao) => number;
};

const b = (v: boolean) => (v ? 1 : 0);

export const CONQUISTAS: readonly Conquista[] = [
  { id: "confirmado", nome: "Confirmado", descricao: "Respondeu se vai ao encontro.", icone: "CalendarCheck", cor: "esmeralda", meta: 1, valor: (e) => b(e.rsvp) },
  { id: "curioso", nome: "Curioso", descricao: "Abriu o presente e descobriu quem tirou.", icone: "Eye", cor: "t1", meta: 1, valor: (e) => b(e.viewed) },
  { id: "lista-completa", nome: "Lista completa", descricao: "Colocou pelo menos 3 desejos na lista.", icone: "ListChecks", cor: "ouro", meta: 3, valor: (e) => e.wishlist },
  { id: "presente-garantido", nome: "Presente garantido", descricao: "Marcou que já comprou o presente.", icone: "Gift", cor: "rubi", meta: 1, valor: (e) => b(e.gift_bought) },
  { id: "tagarela", nome: "Tagarela", descricao: "Mandou 10 mensagens no chat.", icone: "MessagesSquare", cor: "t1", meta: 10, valor: (e) => e.chat },
  { id: "artista-do-mural", nome: "Artista do mural", descricao: "Deixou 3 recados no mural.", icone: "Palette", cor: "ouro", meta: 3, valor: (e) => e.wall },
  { id: "voz-ativa", nome: "Voz ativa", descricao: "Votou em 2 enquetes.", icone: "Vote", cor: "esmeralda", meta: 2, valor: (e) => e.votes },
  { id: "detetive-do-quiz", nome: "Detetive do quiz", descricao: "Acertou 3 perguntas do quiz.", icone: "Search", cor: "esmeralda", meta: 3, valor: (e) => e.quiz_correct },
  { id: "livro-aberto", nome: "Livro aberto", descricao: "Criou 3 perguntas sobre si no quiz.", icone: "BookOpen", cor: "t1", meta: 3, valor: (e) => e.quiz_questions },
  { id: "carteiro", nome: "Carteiro", descricao: "Enviou 2 cartões virtuais.", icone: "Mail", cor: "rubi", meta: 2, valor: (e) => e.cards },
  { id: "viajante-do-tempo", nome: "Viajante do tempo", descricao: "Lacrou uma cápsula do tempo.", icone: "Hourglass", cor: "ouro", meta: 1, valor: (e) => e.capsules },
  { id: "sortudo-do-bingo", nome: "Sortudo do bingo", descricao: "Fez BINGO no bingo natalino.", icone: "Clover", cor: "esmeralda", meta: 1, valor: (e) => e.bingo },
  { id: "desafiador", nome: "Desafiador", descricao: "Cumpriu 3 desafios da roleta.", icone: "Dices", cor: "rubi", meta: 3, valor: (e) => e.challenges },
  { id: "fotografo", nome: "Fotógrafo", descricao: "Enviou 3 fotos para o álbum.", icone: "Camera", cor: "t1", meta: 3, valor: (e) => e.photos },
];

export type ConquistaCalculada = Omit<Conquista, "valor"> & {
  atual: number;
  conquistada: boolean;
  /** 0 a 1 (para a barra de progresso). */
  progresso: number;
};

export function calcularConquistas(e: EstatisticasParticipacao): ConquistaCalculada[] {
  return CONQUISTAS.map(({ valor, ...c }) => {
    const atual = Math.max(0, Number(valor(e)) || 0);
    return { ...c, atual, conquistada: atual >= c.meta, progresso: Math.min(1, atual / c.meta) };
  });
}

export function conquistasDe(e: EstatisticasParticipacao): ConquistaCalculada[] {
  return calcularConquistas(e).filter((c) => c.conquistada);
}

/** De onde vêm os pontos (mesmos pesos e limites do banco), para o detalhe do ranking. */
export function detalhesDosPontos(e: EstatisticasParticipacao): { rotulo: string; quantidade: number; pontos: number }[] {
  const itens = [
    { rotulo: "Confirmou presença", quantidade: b(e.rsvp), pontos: b(e.rsvp) * 10 },
    { rotulo: "Abriu o presente", quantidade: b(e.viewed), pontos: b(e.viewed) * 10 },
    { rotulo: "Comprou o presente", quantidade: b(e.gift_bought), pontos: b(e.gift_bought) * 15 },
    { rotulo: "Desejos na lista", quantidade: e.wishlist, pontos: Math.min(e.wishlist, 5) * 4 },
    { rotulo: "Mensagens no chat", quantidade: e.chat, pontos: Math.min(e.chat, 30) },
    { rotulo: "Recados no mural", quantidade: e.wall, pontos: Math.min(e.wall, 10) * 3 },
    { rotulo: "Votos em enquetes", quantidade: e.votes, pontos: e.votes * 3 },
    { rotulo: "Respostas no quiz", quantidade: e.quiz_answers, pontos: e.quiz_answers * 3 },
    { rotulo: "Acertos no quiz", quantidade: e.quiz_correct, pontos: e.quiz_correct * 5 },
    { rotulo: "Perguntas criadas", quantidade: e.quiz_questions, pontos: Math.min(e.quiz_questions, 5) * 5 },
    { rotulo: "Cartões enviados", quantidade: e.cards, pontos: Math.min(e.cards, 10) * 4 },
    { rotulo: "Cápsulas do tempo", quantidade: e.capsules, pontos: Math.min(e.capsules, 3) * 5 },
    { rotulo: "Desafios cumpridos", quantidade: e.challenges, pontos: e.challenges * 6 },
    { rotulo: "Bingos", quantidade: e.bingo, pontos: e.bingo * 15 },
    { rotulo: "Fotos no álbum", quantidade: e.photos, pontos: Math.min(e.photos, 10) * 3 },
  ];
  return itens.filter((i) => i.quantidade > 0);
}

/** Posição com empate (1, 2, 2, 4…), na ordem em que o banco devolve (pontos desc). */
export function posicoes(lista: readonly Pick<EstatisticasParticipacao, "points">[]): number[] {
  const r: number[] = [];
  lista.forEach((e, i) => {
    r.push(i > 0 && e.points === lista[i - 1].points ? r[i - 1] : i + 1);
  });
  return r;
}

/** Normaliza o JSON do banco (números podem vir como string em alguns drivers). */
export function lerEstatisticas(bruto: unknown): EstatisticasParticipacao[] {
  if (!Array.isArray(bruto)) return [];
  const num = (v: unknown) => Number(v) || 0;
  return bruto.map((x: Record<string, unknown>) => ({
    participant_id: String(x.participant_id ?? ""),
    user_id: String(x.user_id ?? ""),
    display_name: String(x.display_name ?? "Participante"),
    avatar_path: (x.avatar_path as string | null) ?? null,
    chat: num(x.chat),
    wall: num(x.wall),
    votes: num(x.votes),
    quiz_answers: num(x.quiz_answers),
    quiz_correct: num(x.quiz_correct),
    quiz_questions: num(x.quiz_questions),
    wishlist: num(x.wishlist),
    cards: num(x.cards),
    capsules: num(x.capsules),
    challenges: num(x.challenges),
    bingo: num(x.bingo),
    photos: num(x.photos),
    rsvp: !!x.rsvp,
    gift_bought: !!x.gift_bought,
    viewed: !!x.viewed,
    points: num(x.points),
  }));
}
