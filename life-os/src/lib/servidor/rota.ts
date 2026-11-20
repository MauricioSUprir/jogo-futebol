// Proteção das rotas de API (download de exportações).
import { sessaoAtual } from "./sessao";
import type { User } from "@/generated/prisma/client";

export async function usuarioDaRota(): Promise<User | null> {
  const s = await sessaoAtual();
  return s && !s.mfaPending ? s.user : null;
}

export function naoAutenticado() {
  return Response.json({ erro: "não autenticado" }, { status: 401 });
}

export function arquivo(conteudo: string, nome: string, tipo: string) {
  return new Response(conteudo, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
