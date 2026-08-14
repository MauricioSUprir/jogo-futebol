import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { conteudos, roteiros, config } from "@/db/schema";
import { RoteiroClient } from "./roteiro-client";

export const dynamic = "force-dynamic";

export default async function RoteiroPage({
  params,
}: {
  params: Promise<{ conteudoId: string }>;
}) {
  const { conteudoId } = await params;

  const [conteudo] = await db.select().from(conteudos).where(eq(conteudos.id, conteudoId)).limit(1);
  if (!conteudo) notFound();

  const [versoes, [cfg]] = await Promise.all([
    db.select().from(roteiros).where(eq(roteiros.conteudoId, conteudoId)).orderBy(asc(roteiros.versao)),
    db.select().from(config).limit(1),
  ]);

  return (
    <RoteiroClient
      conteudo={conteudo}
      versoes={versoes}
      palavrasPorMin={cfg?.palavrasPorMin ?? 150}
    />
  );
}
