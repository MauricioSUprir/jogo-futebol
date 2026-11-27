/** Seções do painel do organizador (?aba=...). */
export const SECOES = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "participantes", rotulo: "Participantes" },
  { id: "sorteio", rotulo: "Sorteio" },
  { id: "restricoes", rotulo: "Restrições" },
  { id: "convites", rotulo: "Convites" },
  { id: "avisos", rotulo: "Avisos e lembretes" },
  { id: "moderacao", rotulo: "Moderação" },
  { id: "evento", rotulo: "Editar evento" },
  { id: "encerramento", rotulo: "Revelação e encerramento" },
] as const;

export type IdSecao = (typeof SECOES)[number]["id"];

export function secaoValida(v: unknown): IdSecao {
  return (SECOES.find((s) => s.id === v)?.id ?? "resumo") as IdSecao;
}
