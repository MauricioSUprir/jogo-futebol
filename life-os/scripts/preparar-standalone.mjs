// Depois do "next build": copia public/ e .next/static/ para dentro de .next/standalone (o servidor
// standalone não serve esses arquivos sozinho). É o que o Dockerfile faz; aqui para rodar sem Docker.
import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sa = path.join(raiz, ".next/standalone");
await cp(path.join(raiz, "public"), path.join(sa, "public"), { recursive: true });
await cp(path.join(raiz, ".next/static"), path.join(sa, ".next/static"), { recursive: true });
console.log("standalone pronto: node .next/standalone/server.js");
