import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sugestoesIa } from "@/db/schema";
import { contarVideosComMetricas } from "@/lib/analytics";
import { SugestoesClient } from "./sugestoes-client";

export const dynamic = "force-dynamic";

export default async function SugestoesPage() {
  const [historico, count] = await Promise.all([
    db.select().from(sugestoesIa).orderBy(desc(sugestoesIa.createdAt)).limit(10),
    contarVideosComMetricas(),
  ]);

  return <SugestoesClient historico={historico} videosComMetricas={count} />;
}
