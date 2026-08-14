export const PLATAFORMAS = [
  { value: "youtube", label: "YouTube", cor: "#ff0000" },
  { value: "instagram", label: "Instagram", cor: "#e1306c" },
  { value: "tiktok", label: "TikTok", cor: "#000000" },
] as const;

export type PlataformaValue = (typeof PLATAFORMAS)[number]["value"];

export const FORMATOS = [
  { value: "short", label: "Short" },
  { value: "reel", label: "Reel" },
  { value: "video_longo", label: "Vídeo longo" },
] as const;

export const STATUS_IDEIA = [
  { value: "ideia", label: "Ideia" },
  { value: "aprovada", label: "Aprovada" },
  { value: "descartada", label: "Descartada" },
] as const;

// Colunas do kanban, em ordem.
export const COLUNAS_PIPELINE = [
  { value: "ideia", label: "Ideia" },
  { value: "roteiro", label: "Roteiro" },
  { value: "gravar", label: "Gravar" },
  { value: "editar", label: "Editar" },
  { value: "agendado", label: "Agendado" },
  { value: "publicado", label: "Publicado" },
] as const;

export type ColunaPipeline = (typeof COLUNAS_PIPELINE)[number]["value"];

// Blocos do roteiro estruturado.
export const BLOCOS_ROTEIRO = [
  { key: "gancho", label: "Gancho", hint: "0–3s: prende a atenção" },
  { key: "contexto", label: "Contexto", hint: "situa o espectador" },
  { key: "desenvolvimento", label: "Desenvolvimento", hint: "conteúdo principal" },
  { key: "climax", label: "Clímax / entrega", hint: "o ponto alto / payoff" },
  { key: "cta", label: "CTA", hint: "chamada para ação" },
] as const;

export type BlocoKey = (typeof BLOCOS_ROTEIRO)[number]["key"];

export const CHECKLIST_ASSETS = [
  { key: "thumbnail", label: "Thumbnail" },
  { key: "legenda", label: "Legenda" },
  { key: "trilha", label: "Trilha" },
  { key: "cta", label: "CTA" },
] as const;

export function labelPlataforma(v: string): string {
  return PLATAFORMAS.find((p) => p.value === v)?.label ?? v;
}
export function corPlataforma(v: string): string {
  return PLATAFORMAS.find((p) => p.value === v)?.cor ?? "#888";
}
export function labelFormato(v: string): string {
  return FORMATOS.find((f) => f.value === v)?.label ?? v;
}
export function labelColuna(v: string): string {
  return COLUNAS_PIPELINE.find((c) => c.value === v)?.label ?? v;
}
