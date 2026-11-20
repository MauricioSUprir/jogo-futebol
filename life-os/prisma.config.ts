// Configuração do Prisma 7: a URL do banco vem do ambiente (DATABASE_URL), nunca do schema.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Vazio só no "prisma generate" do build (não conecta); migrate exige DATABASE_URL de verdade.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
