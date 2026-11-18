"use client";
// Refeição pelo botão central "Registrar": tipo (sugerido pelo horário), descrição, grupos e fome/saciedade.
// Props montadas por dadosRegistroRapidoAlimentacao (lib/servidor/alimentacao.ts). Salva e fecha o diálogo.
import type { Refeicao } from "@/lib/alimentacao";
import { FormRefeicao } from "./formularios";

export function RegistroRapidoRefeicao({ hoje, tipoSugerido }: { hoje: string; tipoSugerido: Refeicao }) {
  return <FormRefeicao hoje={hoje} tipoSugerido={tipoSugerido} compacto idPrefixo="rr-ref" />;
}
