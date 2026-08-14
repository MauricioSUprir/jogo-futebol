import { db } from "@/db";
import { config } from "@/db/schema";
import { requireAdmin } from "@/lib/guard";
import { ConfigClient } from "./config-client";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  await requireAdmin();
  const [cfg] = await db.select().from(config).limit(1);
  const apiConfigurada = !!process.env.ANTHROPIC_API_KEY;
  const modelo = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  return (
    <ConfigClient
      palavrasPorMin={cfg?.palavrasPorMin ?? 150}
      apiConfigurada={apiConfigurada}
      modelo={modelo}
    />
  );
}
