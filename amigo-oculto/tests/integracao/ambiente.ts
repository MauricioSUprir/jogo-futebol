// Carrega .env.local (Supabase local) para os testes de integração. No CI as variáveis vêm do workflow.
import { readFileSync, existsSync } from "node:fs";

const arquivo = new URL("../../.env.local", import.meta.url);
if (existsSync(arquivo)) {
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
