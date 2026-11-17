// Os módulos do LIFE OS e a fase do plano de cada um (o mapa de "Todos os módulos").
export interface Modulo {
  nome: string;
  descricao: string;
  href?: string; // só os que já existem
  fase: 1 | 2 | 3 | 4;
  grupo: "saude" | "rotina" | "inteligencia" | "extra";
}

export const MODULOS: Modulo[] = [
  { nome: "Central de Comando", descricao: "Painel do dia, configurável", href: "/", fase: 1, grupo: "rotina" },
  { nome: "Hydro Track", descricao: "Água, metas, horários e gráficos", href: "/agua", fase: 1, grupo: "saude" },
  { nome: "Habit Tracker", descricao: "Hábitos, sequências e conquistas", href: "/habitos", fase: 1, grupo: "rotina" },
  { nome: "Life Calendar", descricao: "Agenda, tarefas, planejamento e foco", href: "/agenda", fase: 1, grupo: "rotina" },
  { nome: "Fitness Center", descricao: "Musculação, futebol, cardio e recuperação", fase: 2, grupo: "saude" },
  { nome: "Health Center", descricao: "Consultas, vacinas, exames e diário de saúde", fase: 2, grupo: "saude" },
  { nome: "Sleep Lab", descricao: "Horários, qualidade e regularidade do sono", fase: 2, grupo: "saude" },
  { nome: "Mind Center", descricao: "Humor, energia e diário com senha extra", fase: 2, grupo: "saude" },
  { nome: "Nutrition Hub", descricao: "Refeições, variedade e lista de compras", fase: 2, grupo: "saude" },
  { nome: "Study Center", descricao: "Matérias, provas, Pomodoro, flashcards e notas", fase: 2, grupo: "rotina" },
  { nome: "Goals Center", descricao: "Metas com etapas, prazos e progresso", fase: 2, grupo: "rotina" },
  { nome: "Finance Center", descricao: "Entradas, gastos, orçamento e objetivos", fase: 3, grupo: "rotina" },
  { nome: "Project Hub", descricao: "Projetos com Kanban, tarefas e histórico", fase: 3, grupo: "rotina" },
  { nome: "Analytics Center", descricao: "Relatórios diário, semanal, mensal e PDF", fase: 3, grupo: "inteligencia" },
  { nome: "Life Intelligence", descricao: "Assistente de IA opcional, só com o que você autorizar", fase: 3, grupo: "inteligencia" },
  { nome: "Smart Notifications", descricao: "Lembretes de água, hábitos e agenda (Web Push)", fase: 3, grupo: "inteligencia" },
  { nome: "Voice Control e widgets", descricao: "Registrar por voz e montar widgets", fase: 4, grupo: "extra" },
  { nome: "Integrações", descricao: "Google Calendar e outras, só se autorizar", fase: 4, grupo: "extra" },
  { nome: "Personal Vault e Memory Journal", descricao: "Cofre de documentos e diário com fotos", fase: 4, grupo: "extra" },
];

export const FASES: Record<number, string> = {
  1: "Fase 1 · Fundação",
  2: "Fase 2 · Saúde e rotina",
  3: "Fase 3 · Inteligência",
  4: "Fase 4 · Ultimate",
};
