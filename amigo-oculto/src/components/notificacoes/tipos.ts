/** Ícone, nome e cor de cada tipo de notificação (notifications.kind). Sem DOM: testado em Node. */
import {
  AlarmClock,
  BadgeCheck,
  Bell,
  CalendarClock,
  Crown,
  FlaskConical,
  Flag,
  Grid3x3,
  Hand,
  MailPlus,
  Megaphone,
  MessageCircleHeart,
  PartyPopper,
  Radio,
  RefreshCw,
  ScrollText,
  Shuffle,
  Sparkles,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";

export type CorTipo = "t1" | "esmeralda" | "ouro" | "rubi" | "neutro";

export const TIPOS_NOTIFICACAO: Record<string, { rotulo: string; icone: LucideIcon; cor: CorTipo }> = {
  draw: { rotulo: "Sorteio", icone: Shuffle, cor: "esmeralda" },
  redraw: { rotulo: "Novo sorteio", icone: RefreshCw, cor: "ouro" },
  secret_message: { rotulo: "Mensagem anônima", icone: MessageCircleHeart, cor: "t1" },
  announcement: { rotulo: "Aviso do grupo", icone: Megaphone, cor: "ouro" },
  reminder: { rotulo: "Lembrete", icone: AlarmClock, cor: "ouro" },
  event_soon: { rotulo: "Encontro chegando", icone: CalendarClock, cor: "t1" },
  live_start: { rotulo: "Revelação ao vivo", icone: Radio, cor: "rubi" },
  rules_changed: { rotulo: "Regras atualizadas", icone: ScrollText, cor: "neutro" },
  new_participant: { rotulo: "Novo participante", icone: UserPlus, cor: "esmeralda" },
  join_request: { rotulo: "Pedido para entrar", icone: Hand, cor: "ouro" },
  approved: { rotulo: "Entrada aprovada", icone: BadgeCheck, cor: "esmeralda" },
  rejected: { rotulo: "Pedido recusado", icone: UserX, cor: "rubi" },
  removed: { rotulo: "Removido do grupo", icone: UserMinus, cor: "rubi" },
  role: { rotulo: "Organização", icone: Crown, cor: "ouro" },
  invite: { rotulo: "Convite", icone: MailPlus, cor: "t1" },
  card: { rotulo: "Cartão virtual", icone: Sparkles, cor: "t1" },
  bingo: { rotulo: "Bingo", icone: Grid3x3, cor: "esmeralda" },
  finished: { rotulo: "Encerramento", icone: PartyPopper, cor: "ouro" },
  report: { rotulo: "Denúncia", icone: Flag, cor: "rubi" },
  test: { rotulo: "Teste", icone: FlaskConical, cor: "neutro" },
};

export function tipoDaNotificacao(kind: string) {
  return TIPOS_NOTIFICACAO[kind] ?? { rotulo: "Notificação", icone: Bell, cor: "neutro" as CorTipo };
}

/** Tipos que contam como "mensagens recebidas" no painel. */
export const TIPOS_MENSAGEM = ["secret_message", "card"] as const;

/** Só links internos ("/grupo/..."): o banco já exige, mas a interface confere de novo antes de navegar. */
export function linkSeguro(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.startsWith("/\\")) return null;
  return link;
}
