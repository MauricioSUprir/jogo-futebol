export type Votante = { usuarioId: string; nome: string; avatar: string | null };

export type EnqueteVista = {
  id: string;
  pergunta: string;
  categoria: "geral" | "presente";
  multipla: boolean;
  encerraEm: string | null;
  encerradaEm: string | null;
  criadaEm: string;
  aberta: boolean;
  autor: { nome: string; avatar: string | null } | null;
  podeGerenciar: boolean;
  totalVotantes: number;
  meusVotos: string[];
  opcoes: { id: string; rotulo: string; votantes: Votante[] }[];
};
