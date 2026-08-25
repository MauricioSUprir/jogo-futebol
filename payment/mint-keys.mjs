/* =====================================================================
   TOTAL MATCH — Gerador de chaves de licença
   ---------------------------------------------------------------------
   Gera chaves no MESMO esquema (HMAC) que o Worker valida. Suba o arquivo
   gerado no Kiwify como "conteúdo" do produto: cada comprador recebe 1 chave.

   USO:
     LICENSE_SECRET="seu-segredo-igual-ao-do-worker" node payment/mint-keys.mjs 200

   Saída: payment/keys.csv  (uma chave por linha)
   ⚠️ O LICENSE_SECRET tem que ser EXATAMENTE o mesmo configurado no Worker
      (wrangler secret put LICENSE_SECRET). Guarde-o em segredo.
   ===================================================================== */

import { createHmac, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";

const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // igual ao worker.js

function b32(bytes) {
  let out = "", bits = 0, val = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += ALPH[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPH[(val << (5 - bits)) & 31];
  return out;
}

function randomSerial() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPH[randomInt(0, 32)];
  return s;
}

function sigOf(secret, serial) {
  const h = createHmac("sha256", secret).update(serial).digest();
  return b32(h.subarray(0, 5)); // 40 bits -> 8 chars
}

function makeKey(secret) {
  const serial = randomSerial();
  const sig = sigOf(secret, serial);
  const body = serial + sig; // 16 chars
  return "TM-" + body.slice(0, 4) + "-" + body.slice(4, 8) + "-" + body.slice(8, 12) + "-" + body.slice(12, 16);
}

const secret = process.env.LICENSE_SECRET;
if (!secret) {
  console.error("Defina LICENSE_SECRET no ambiente (o mesmo do Worker).");
  process.exit(1);
}
const count = parseInt(process.argv[2] || "100", 10);

const set = new Set();
while (set.size < count) set.add(makeKey(secret));

const keys = [...set];
writeFileSync(new URL("./keys.csv", import.meta.url), keys.join("\n") + "\n");
console.log(`Geradas ${keys.length} chaves em payment/keys.csv`);
console.log("Exemplos:");
keys.slice(0, 5).forEach((k) => console.log("  " + k));
