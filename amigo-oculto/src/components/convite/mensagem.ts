import { dataHora, faixaDePreco } from "@/lib/formatos";

/** Texto convidativo para o WhatsApp e o compartilhar do celular (emojis são conteúdo, não ícones de interface). */
export function mensagemDoConvite(e: {
  nome: string;
  link: string;
  codigo: string;
  revelacao?: string | null;
  local?: string | null;
  valorMinimo?: number | null;
  valorMaximo?: number | null;
}) {
  const linhas = [`🎁 Você foi convidado para o amigo oculto *${e.nome}*!`, ""];
  const quando = dataHora(e.revelacao, { weekday: "long" });
  if (quando) linhas.push(`📅 Revelação: ${quando}`);
  if (e.local) linhas.push(`📍 Local: ${e.local}`);
  const faixa = faixaDePreco(e.valorMinimo ?? null, e.valorMaximo ?? null);
  if (faixa) linhas.push(`💰 Presente: ${faixa}`);
  if (quando || e.local || faixa) linhas.push("");
  linhas.push(`Entre pelo link e faça parte da brincadeira:`, e.link, "", `Código do convite: ${e.codigo}`);
  return linhas.join("\n");
}
