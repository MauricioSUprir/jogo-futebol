// IP e navegador de quem fez a requisição (para o registro de acessos e o limite de tentativas).
import { headers } from "next/headers";

export async function dadosDaRequisicao(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ua = h.get("user-agent")?.slice(0, 300) ?? null;
  if (process.env.LIFEOS_TRUST_PROXY !== "1") return { ip: null, userAgent: ua };
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (fwd || h.get("x-real-ip") || "").slice(0, 64) || null;
  return { ip, userAgent: ua };
}

/** "Chrome no iPhone", "Safari no Mac"… (só para mostrar nas sessões). */
export function descreverNavegador(ua: string | null): string {
  if (!ua) return "Navegador desconhecido";
  const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "outro sistema";
  return `${nav} no ${so}`;
}
