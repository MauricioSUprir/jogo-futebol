/* =====================================================================
   TOTAL MATCH — Servidor de licenças (Render + Key Value/Redis)
   ---------------------------------------------------------------------
   POST /activate { key, device } -> { ok:true, token } | { ok:false, error }
   GET  /                          -> "Total Match license OK"
   GET  /health                    -> { ok, redis }

   Variáveis de ambiente:
     LICENSE_SECRET  segredo do HMAC (o MESMO usado para gerar as chaves)
     REDIS_URL       conexão do Key Value do Render (setada automaticamente)
     PORT            porta (o Render define sozinho)
   ===================================================================== */

const express = require("express");
const crypto = require("crypto");
const Redis = require("ioredis");

const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // base32 (igual ao gerador de chaves)

function b32(bytes) {
  let out = "", bits = 0, val = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += ALPH[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPH[(val << (5 - bits)) & 31];
  return out;
}
function sigOf(secret, serial) {
  const h = crypto.createHmac("sha256", secret).update(serial).digest();
  return b32(h.subarray(0, 5)); // 40 bits -> 8 chars
}
function parseKey(key) {
  const clean = String(key || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = clean.startsWith("TM") ? clean.slice(2) : clean;
  if (body.length !== 16) return null;
  return { serial: body.slice(0, 8), sig: body.slice(8, 16) };
}

const SECRET = process.env.LICENSE_SECRET || "";
let redis = null, redisReady = false;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
  redis.on("ready", () => { redisReady = true; });
  redis.on("error", () => { redisReady = false; });
}

const app = express();
app.use(express.json({ limit: "8kb" }));
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/", (req, res) => res.type("text").send("Total Match license OK"));
app.get("/health", (req, res) => res.json({ ok: true, redis: redisReady, secret: !!SECRET }));

app.post("/activate", async (req, res) => {
  if (!SECRET) return res.status(500).json({ ok: false, error: "Servidor sem secret configurado." });
  if (!redis) return res.status(500).json({ ok: false, error: "Servidor sem banco configurado." });

  const parsed = parseKey(req.body && req.body.key);
  const device = String((req.body && req.body.device) || "").slice(0, 128);
  if (!parsed) return res.json({ ok: false, error: "Formato de chave inválido." });
  if (!device) return res.json({ ok: false, error: "Aparelho não identificado." });

  // 1) a chave é autêntica? (assinatura confere)
  if (sigOf(SECRET, parsed.serial) !== parsed.sig) return res.json({ ok: false, error: "Chave inválida." });

  // 2) já foi ativada em outro aparelho?
  const redisKey = "lic:" + parsed.serial;
  try {
    const existing = await redis.get(redisKey);
    if (existing) {
      let rec; try { rec = JSON.parse(existing); } catch (e) { rec = {}; }
      if (rec.device && rec.device !== device) {
        return res.json({ ok: false, error: "Esta chave já foi ativada em outro aparelho." });
      }
    } else {
      // set apenas se não existir (evita corrida)
      const ok = await redis.set(redisKey, JSON.stringify({ device, ts: Date.now() }), "NX");
      if (ok === null) {
        const again = await redis.get(redisKey);
        let rec; try { rec = JSON.parse(again); } catch (e) { rec = {}; }
        if (rec.device && rec.device !== device) {
          return res.json({ ok: false, error: "Esta chave já foi ativada em outro aparelho." });
        }
      }
    }
  } catch (e) {
    return res.status(503).json({ ok: false, error: "Servidor ocupado, tente de novo." });
  }

  const token = b32(crypto.createHmac("sha256", SECRET).update(parsed.serial + "|" + device).digest().subarray(0, 12));
  return res.json({ ok: true, token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("TM license server on :" + PORT));
