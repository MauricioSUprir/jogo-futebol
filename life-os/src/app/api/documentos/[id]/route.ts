// Download de documento de saúde: só do dono, decifrado na hora, sem cache.
import { db } from "@/lib/db";
import { naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { registrarAcesso } from "@/lib/servidor/registro";
import { decifrarBytes } from "@/lib/seguranca/cifra-bytes";
import { contentDisposition } from "@/lib/saude";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  const { id } = await params;
  const doc = await db.healthFile.findFirst({ where: { id, userId: user.id } });
  if (!doc) return Response.json({ erro: "não encontrado" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  let conteudo: Buffer;
  try {
    conteudo = decifrarBytes(doc.data);
  } catch {
    return Response.json({ erro: "não foi possível abrir o documento" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  await registrarAcesso(user.id, "documento_baixado", doc.name);
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(conteudo.length),
      "Content-Disposition": contentDisposition(doc.name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, private",
    },
  });
}
