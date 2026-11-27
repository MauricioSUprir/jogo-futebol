import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho `Authorization: Bearer <CRON_SECRET>` em tempo constante (compara os SHA-256, que têm sempre o
 * mesmo tamanho: o tempo não entrega nem o conteúdo nem o comprimento do segredo). Sem segredo configurado, ninguém
 * passa.
 */
export function cronAutorizado(cabecalho: string | null | undefined, segredo: string | null | undefined): boolean {
  if (!segredo || segredo.length < 16) return false;
  const m = /^Bearer\s+(.+)$/i.exec((cabecalho ?? "").trim());
  const recebido = m ? m[1].trim() : "";
  const a = createHash("sha256").update(recebido, "utf8").digest();
  const b = createHash("sha256").update(segredo, "utf8").digest();
  return timingSafeEqual(a, b) && recebido.length > 0;
}
