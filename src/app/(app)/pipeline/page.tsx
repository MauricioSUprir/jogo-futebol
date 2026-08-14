import { asc } from "drizzle-orm";
import { db } from "@/db";
import { conteudos, pilares } from "@/db/schema";
import { PipelineClient } from "./pipeline-client";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [listaConteudos, listaPilares] = await Promise.all([
    db.select().from(conteudos).orderBy(asc(conteudos.ordem), asc(conteudos.createdAt)),
    db.select().from(pilares).orderBy(pilares.nome),
  ]);

  return <PipelineClient conteudos={listaConteudos} pilares={listaPilares} />;
}
