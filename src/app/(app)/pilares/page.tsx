import { db } from "@/db";
import { pilares } from "@/db/schema";
import { requireAdmin } from "@/lib/guard";
import { PilaresClient } from "./pilares-client";

export const dynamic = "force-dynamic";

export default async function PilaresPage() {
  await requireAdmin();
  const lista = await db.select().from(pilares).orderBy(pilares.nome);
  return <PilaresClient pilares={lista} />;
}
