import { desc } from "drizzle-orm";
import { db } from "@/db";
import { ideias, pilares } from "@/db/schema";
import { IdeiasClient } from "./ideias-client";

export const dynamic = "force-dynamic";

export default async function IdeiasPage() {
  const [listaIdeias, listaPilares] = await Promise.all([
    db.select().from(ideias).orderBy(desc(ideias.createdAt)),
    db.select().from(pilares).orderBy(pilares.nome),
  ]);

  return <IdeiasClient ideias={listaIdeias} pilares={listaPilares} />;
}
