// Envio de documento de saúde (PDF ou imagem) anexado a um registro do Health Center.
// O arquivo é conferido pelo CONTEÚDO (assinatura), limitado a 5 MB e guardado cifrado (AES-256-GCM).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { registrarAcesso } from "@/lib/servidor/registro";
import { cifrarBytes } from "@/lib/seguranca/cifra-bytes";
import { ARQUIVO_MAX_BYTES, nomeSeguro, tipoPeloConteudo } from "@/lib/saude";

export const dynamic = "force-dynamic";

const MAX_POR_REGISTRO = 10;

/** Proteção contra envio de outro site (CSRF): a origem tem de ser o próprio LIFE OS. */
function mesmaOrigem(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origem = req.headers.get("origin");
  if (!origem) return site === "same-origin";
  const host = (process.env.LIFEOS_TRUST_PROXY === "1" && req.headers.get("x-forwarded-host")) || req.headers.get("host");
  try {
    return !!host && new URL(origem).host === host;
  } catch {
    return false;
  }
}

const erro = (msg: string, status: number) => Response.json({ erro: msg }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  if (!mesmaOrigem(req)) return erro("Origem não permitida.", 403);
  const tamanhoPedido = Number(req.headers.get("content-length") ?? 0);
  if (tamanhoPedido > ARQUIVO_MAX_BYTES + 64 * 1024) return erro("O arquivo pode ter no máximo 5 MB.", 413);

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return erro("Envio inválido.", 400);
  }
  const arquivo = fd.get("arquivo");
  const registroId = String(fd.get("registroId") ?? "");
  if (!(arquivo instanceof File)) return erro("Escolha um arquivo.", 400);
  if (arquivo.size === 0) return erro("O arquivo está vazio.", 400);
  if (arquivo.size > ARQUIVO_MAX_BYTES) return erro("O arquivo pode ter no máximo 5 MB.", 413);

  const registro = await db.healthRecord.findFirst({ where: { id: registroId, userId: user.id }, select: { id: true, _count: { select: { files: true } } } });
  if (!registro) return erro("Registro não encontrado.", 404);
  if (registro._count.files >= MAX_POR_REGISTRO) return erro(`No máximo ${MAX_POR_REGISTRO} documentos por registro.`, 400);

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = tipoPeloConteudo(bytes);
  if (!mime) return erro("Formato não aceito: envie PDF, JPG, PNG ou WEBP.", 415);

  const nome = nomeSeguro(arquivo.name, mime);
  const doc = await db.healthFile.create({
    data: { userId: user.id, recordId: registro.id, name: nome, mime, size: bytes.length, data: new Uint8Array(cifrarBytes(bytes)) },
    select: { id: true },
  });
  await registrarAcesso(user.id, "documento_enviado", nome);
  revalidatePath("/saude/central");
  return Response.json({ ok: true, id: doc.id, nome }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
