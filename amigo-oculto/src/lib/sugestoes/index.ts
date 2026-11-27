/**
 * Sugestões de presente com base nos interesses da pessoa e no orçamento do grupo.
 * Tudo puro (sem banco nem rede): roda no servidor (página da revelação) e no navegador (demonstração da página inicial).
 */
import type { PerfilParaSugestao } from "@/lib/sugestoes/motor";

export { sugerirPresentes, descreverOrcamento, avaliarOrcamento, lerObservacoes, PESOS } from "@/lib/sugestoes/motor";
export type { PerfilParaSugestao, Orcamento, Sugestao, OpcoesSugestao } from "@/lib/sugestoes/motor";
export { CATALOGO, type IdeiaPresente } from "@/lib/sugestoes/catalogo";
export { ETIQUETAS, LISTA_ETIQUETAS, IMPLICA, detectarEtiquetas, motivoDaEtiqueta, rotuloDaEtiqueta, type Etiqueta } from "@/lib/sugestoes/etiquetas";
export { normalizar, singular, tokens, palavrasChave } from "@/lib/sugestoes/texto";
export { amostraDaCor } from "@/lib/sugestoes/cores";

/** Linhas do banco (gift_preferences e wishlist_items) → perfil para as sugestões. */
export function perfilDoBanco(
  prefs: {
    hobbies?: string[] | null;
    interests?: string[] | null;
    favorite_colors?: string[] | null;
    shirt_size?: string | null;
    pants_size?: string | null;
    shoe_size?: string | null;
    dislikes?: string[] | null;
    notes?: string | null;
  } | null,
  desejos: { title: string; notes?: string | null }[] | null,
): PerfilParaSugestao {
  return {
    hobbies: prefs?.hobbies ?? [],
    interesses: prefs?.interests ?? [],
    cores: prefs?.favorite_colors ?? [],
    tamanhos: { camiseta: prefs?.shirt_size ?? null, calca: prefs?.pants_size ?? null, calcado: prefs?.shoe_size ?? null },
    naoQuer: prefs?.dislikes ?? [],
    observacoes: prefs?.notes ?? null,
    desejos: (desejos ?? []).map((d) => ({ titulo: d.title, notas: d.notes ?? null })),
  };
}
