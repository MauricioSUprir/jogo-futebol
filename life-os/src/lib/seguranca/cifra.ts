// Criptografia de campos sensíveis (AES-256-GCM) com a chave LIFEOS_ENCRYPTION_KEY (32 bytes em base64).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function chave(): Buffer {
  const b64 = process.env.LIFEOS_ENCRYPTION_KEY;
  if (!b64) throw new Error("Defina LIFEOS_ENCRYPTION_KEY (32 bytes em base64) — veja o .env.exemplo.");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("LIFEOS_ENCRYPTION_KEY precisa ter exatamente 32 bytes (base64).");
  return k;
}

export function cifrar(texto: string, chaveBruta: Buffer = chave()): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveBruta, iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), corpo]).toString("base64");
}

export function decifrar(guardado: string, chaveBruta: Buffer = chave()): string {
  if (!guardado.startsWith("v1:")) throw new Error("Formato cifrado desconhecido");
  const bruto = Buffer.from(guardado.slice(3), "base64");
  const d = createDecipheriv("aes-256-gcm", chaveBruta, bruto.subarray(0, 12));
  d.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([d.update(bruto.subarray(28)), d.final()]).toString("utf8");
}

export function sha256(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
