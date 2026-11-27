// Atalho para a CLI do Supabase com a versão fixa do projeto. Aqui (e em máquinas sem acesso ao ECR) as imagens vêm do
// GHCR: SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io. O Studio, o imgproxy, as Edge Functions e os logs ficam desligados
// (não são usados pelo app) para o Supabase local subir mais rápido.
import { spawnSync } from "node:child_process";

const VERSAO = "3.4.0";
const args = process.argv.slice(2);
if (args[0] === "start" && !args.includes("-x")) {
  args.push("-x", "studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta");
}
const env = { ...process.env };
if (!env.SUPABASE_INTERNAL_IMAGE_REGISTRY) env.SUPABASE_INTERNAL_IMAGE_REGISTRY = "ghcr.io";
const r = spawnSync("npx", ["-y", `supabase@${VERSAO}`, ...args], { stdio: "inherit", env });
process.exit(r.status ?? 1);
