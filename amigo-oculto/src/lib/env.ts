/**
 * Variáveis de ambiente. As públicas (NEXT_PUBLIC_*) vão para o navegador; as outras só existem no servidor.
 * Ver .env.exemplo e o README (seção "Publicar").
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Endereço público do site (links de convite, e-mails, QR Code). */
export function urlDoSite(): string {
  const bruto =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://127.0.0.1:3100";
  return bruto.replace(/\/+$/, "");
}

/** Login com Google aparece só quando o provedor foi configurado no projeto Supabase. */
export const GOOGLE_LIGADO = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
/** Participação como convidado (login anônimo do Supabase) — ligada por padrão. */
export const CONVIDADO_LIGADO = process.env.NEXT_PUBLIC_AUTH_ANONYMOUS !== "0";
/** Chave pública VAPID das notificações push (vazia = push desligado). */
export const VAPID_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function urlPublicaDaMidia(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (/^https:\/\//.test(caminho)) return caminho; // foto do Google
  return `${SUPABASE_URL}/storage/v1/object/public/media/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}
