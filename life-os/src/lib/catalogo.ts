// Catálogos de opções (categorias, cores, ícones) usados pela interface e validados no servidor.

export const CATEGORIAS_EVENTO = {
  prova: { nome: "Prova", cor: "#F43F5E" },
  trabalho: { nome: "Trabalho escolar", cor: "#F59E0B" },
  aula: { nome: "Aula", cor: "#60A5FA" },
  consulta: { nome: "Consulta", cor: "#22D3EE" },
  treino: { nome: "Treino", cor: "#34D399" },
  partida: { nome: "Partida", cor: "#A3E635" },
  evento: { nome: "Evento", cor: "#C084FC" },
  aniversario: { nome: "Aniversário", cor: "#F472B6" },
  compromisso: { nome: "Compromisso", cor: "#3B82F6" },
  meta: { nome: "Meta", cor: "#8B5CF6" },
  lembrete: { nome: "Lembrete", cor: "#94A3B8" },
  outro: { nome: "Outro", cor: "#64748B" },
} as const;

export type CategoriaEvento = keyof typeof CATEGORIAS_EVENTO;

export function categoriaEvento(c: string) {
  return CATEGORIAS_EVENTO[c as CategoriaEvento] ?? CATEGORIAS_EVENTO.outro;
}

export const CORES_HABITO = {
  azul: "#3B82F6",
  violeta: "#8B5CF6",
  ciano: "#22D3EE",
  verde: "#34D399",
  ambar: "#F59E0B",
  rosa: "#F472B6",
  vermelho: "#F43F5E",
  cinza: "#94A3B8",
} as const;

export function corHabito(c: string): string {
  return CORES_HABITO[c as keyof typeof CORES_HABITO] ?? CORES_HABITO.azul;
}

/** Ícones disponíveis para hábitos (nomes do lucide-react; ver components/icone-habito.tsx). */
export const ICONES_HABITO = [
  "check",
  "droplet",
  "book-open",
  "graduation-cap",
  "moon",
  "bed",
  "dumbbell",
  "footprints",
  "bike",
  "trophy",
  "apple",
  "salad",
  "brain",
  "heart",
  "smile",
  "sun",
  "music",
  "code",
  "pencil",
  "sparkles",
  "home",
  "phone-off",
  "leaf",
  "timer",
] as const;

export type IconeHabito = (typeof ICONES_HABITO)[number];

export const PRIORIDADES: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };

/** Sugestões de hábitos do primeiro uso (o próprio exemplo do plano). */
export const SUGESTOES_HABITO = [
  { name: "Registrar água", icon: "droplet", color: "ciano", source: "agua" },
  { name: "Estudar", icon: "graduation-cap", color: "azul" },
  { name: "Dormir no horário", icon: "moon", color: "violeta" },
  { name: "Organizar o quarto", icon: "home", color: "ambar" },
  { name: "Ler", icon: "book-open", color: "verde" },
  { name: "Atividade ou descanso planejado", icon: "dumbbell", color: "rosa" },
] as const;

/** Cartões do painel inicial, na ordem padrão. */
export const CARTOES_PAINEL = ["agua", "habitos", "agenda", "proximos", "semana", "insights"] as const;
export type CartaoPainel = (typeof CARTOES_PAINEL)[number];

export const NOMES_CARTOES: Record<CartaoPainel, string> = {
  agua: "Hydro Track",
  habitos: "Hábitos de hoje",
  agenda: "Agenda de hoje",
  proximos: "Próximos 7 dias",
  semana: "Sua semana",
  insights: "Smart Insights",
};
