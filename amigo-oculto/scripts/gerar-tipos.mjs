// Gera src/lib/database.types.ts a partir do banco LOCAL (supabase start antes).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const r = spawnSync("npx", ["-y", "supabase@3.4.0", "gen", "types", "typescript", "--local", "--schema", "public"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY || "ghcr.io" },
  maxBuffer: 20 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(r.status ?? 1);
}
writeFileSync(new URL("../src/lib/database.types.ts", import.meta.url), r.stdout);
console.log("src/lib/database.types.ts atualizado");
