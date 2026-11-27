import type { Database } from "@/lib/database.types";

export type Tema = Database["public"]["Enums"]["event_theme"];

export const TEMAS: Record<Tema, { nome: string; descricao: string; cores: [string, string, string]; enfeites: string[] }> = {
  natal: {
    nome: "Natal",
    descricao: "Vermelho, verde e dourado, com estrelas e flocos de neve.",
    cores: ["#c0182f", "#0a7a55", "#c9962b"],
    enfeites: ["estrela", "floco", "presente", "sino"],
  },
  aniversario: {
    nome: "Aniversário",
    descricao: "Rosa, violeta e dourado, com balões e confetes.",
    cores: ["#d63c7a", "#7b4de0", "#f2a93b"],
    enfeites: ["balao", "estrela", "presente", "confete"],
  },
  classico: {
    nome: "Clássico",
    descricao: "Esmeralda e dourado, elegante para qualquer ocasião.",
    cores: ["#0a6b4b", "#1f3a33", "#c9962b"],
    enfeites: ["estrela", "presente", "fita"],
  },
  corporativo: {
    nome: "Corporativo",
    descricao: "Azul, verde-água e dourado, sóbrio para empresas.",
    cores: ["#1d4ed8", "#0f766e", "#c9962b"],
    enfeites: ["estrela", "presente"],
  },
};

export function nomeDoTema(t: string | null | undefined) {
  return TEMAS[(t as Tema) ?? "natal"]?.nome ?? "Natal";
}
