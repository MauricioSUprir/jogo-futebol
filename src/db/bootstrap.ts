import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Bootstrap idempotente para produção (roda no deploy, depois das migrations).
 * NÃO apaga nada. Garante o mínimo para a aplicação ficar utilizável:
 *   - 1 linha de config
 *   - 3 pilares padrão (só se não houver nenhum)
 *   - 1 usuário admin (só se não houver nenhum usuário)
 *
 * Para dados de exemplo completos (8 vídeos com métricas), use `db:seed`
 * manualmente (esse sim recria tudo).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida — pulando bootstrap.");
    process.exit(0);
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  // config
  const cfg = await db.select().from(schema.config).limit(1);
  if (cfg.length === 0) {
    await db.insert(schema.config).values({ palavrasPorMin: 150 });
    console.log("config criada.");
  }

  // pilares
  const pil = await db.select({ n: sql<number>`count(*)::int` }).from(schema.pilares);
  if ((pil[0]?.n ?? 0) === 0) {
    await db.insert(schema.pilares).values([
      { nome: "Bastidores", descricao: "Rotina e processo de criação", cor: "#f59e0b" },
      { nome: "Tutorial", descricao: "Passo a passo prático", cor: "#f5348b" },
      { nome: "Opinião", descricao: "Hot takes e reações", cor: "#ffc21f" },
    ]);
    console.log("3 pilares padrão criados.");
  }

  // usuário admin (só se não houver NENHUM usuário)
  const users = await db.select({ n: sql<number>`count(*)::int` }).from(schema.usuarios);
  if ((users[0]?.n ?? 0) === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
    const senha = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
    const nome = process.env.SEED_ADMIN_NOME ?? "Criadora";
    await db.insert(schema.usuarios).values({
      nome,
      email,
      senhaHash: await bcrypt.hash(senha, 10),
      papel: "admin",
    });
    console.log(`admin criado: ${email}`);
  } else {
    console.log("já existem usuários — admin preservado.");
  }

  await client.end();
  console.log("bootstrap concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
