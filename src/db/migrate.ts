import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://studio:studio@localhost:5432/studio";
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  console.log("Rodando migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
