// Gera .env.local apontando para o Supabase LOCAL (npm run db:start antes). Usado no CI e por quem vai desenvolver.
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const r = spawnSync("npx", ["-y", "supabase@3.4.0", "status", "-o", "json"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY || "ghcr.io" },
});
const inicio = r.stdout.indexOf("{");
if (r.status !== 0 || inicio < 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
const s = JSON.parse(r.stdout.slice(inicio));
const alvo = new URL("../.env.local", import.meta.url);
if (existsSync(alvo) && !process.argv.includes("--sobrescrever")) {
  console.log(".env.local já existe (use --sobrescrever para recriar)");
  process.exit(0);
}
const smtp = s.MAILPIT_URL ? "smtp://127.0.0.1:54325" : "";
writeFileSync(
  alvo,
  [
    "# Supabase LOCAL (gerado por scripts/env-local.mjs). Não vai para o git.",
    `NEXT_PUBLIC_SUPABASE_URL=${s.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${s.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${s.SERVICE_ROLE_KEY}`,
    "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100",
    "NEXT_PUBLIC_AUTH_GOOGLE=0",
    "NEXT_PUBLIC_AUTH_ANONYMOUS=1",
    "CRON_SECRET=segredo-local-do-cron",
    'EMAIL_FROM="Amigo Oculto <nao-responda@amigo-oculto.local>"',
    `SMTP_URL=${smtp}`,
    "",
  ].join("\n"),
);
console.log(".env.local criado");
