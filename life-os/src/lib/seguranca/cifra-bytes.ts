// Cifra de arquivos (documentos de saúde) com AES-256-GCM e a mesma chave do servidor (LIFEOS_ENCRYPTION_KEY).
// Formato: 1 byte de versão (1) | 12 bytes de IV | 16 bytes de etiqueta | conteúdo cifrado.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function chave(): Buffer {
  const b64 = process.env.LIFEOS_ENCRYPTION_KEY;
  if (!b64) throw new Error("Defina LIFEOS_ENCRYPTION_KEY (32 bytes em base64) — veja o .env.exemplo.");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("LIFEOS_ENCRYPTION_KEY precisa ter exatamente 32 bytes (base64).");
  return k;
}

const VERSAO = 1;

export function cifrarBytes(dados: Uint8Array, chaveBruta: Buffer = chave()): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveBruta, iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([Buffer.from([VERSAO]), iv, c.getAuthTag(), corpo]);
}

export function decifrarBytes(guardado: Uint8Array, chaveBruta: Buffer = chave()): Buffer {
  const b = Buffer.from(guardado);
  if (b.length < 29 || b[0] !== VERSAO) throw new Error("Formato cifrado desconhecido");
  const d = createDecipheriv("aes-256-gcm", chaveBruta, b.subarray(1, 13));
  d.setAuthTag(b.subarray(13, 29));
  return Buffer.concat([d.update(b.subarray(29)), d.final()]);
}
