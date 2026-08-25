/* =====================================================================
   TOTAL MATCH — Servidor de licenças (Cloudflare Worker)
   ---------------------------------------------------------------------
   Valida a chave que o comprador recebe no Kiwify e a "amarra" a 1 aparelho.
   - Não guarda lista de chaves: a validade é provada por assinatura (HMAC).
   - Só guarda no KV as chaves JÁ ATIVADAS (para impedir reuso em outro aparelho).

   Endpoints:
     POST /activate  { key, device }  -> { ok:true, token } | { ok:false, error }
     GET  /                            -> "Total Match license OK"

   Configuração (ver payment/README.md):
     - Secret:  LICENSE_SECRET  (wrangler secret put LICENSE_SECRET)
     - KV:      binding LICENSES
   ===================================================================== */

const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // base32 (Crockford, sem I L O U)

function b32(bytes) {
  let out = "", bits = 0, val = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += ALPH[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPH[(val << (5 - bits)) & 31];
  return out;
}

const enc = (s) => new TextEncoder().encode(s);

async function hmacBytes(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc(msg));
  return new Uint8Array(sig);
}

// sig de 8 chars base32 (40 bits) a partir dos 5 primeiros bytes do HMAC(serial)
async function sigOf(secret, serial) {
  const h = await hmacBytes(secret, serial);
  return b32(h.slice(0, 5));
}

// "TM-AAAA-BBBB-CCCC-DDDD" -> { serial:"AAAABBBB", sig:"CCCCDDDD" }
function parseKey(key) {
  const clean = String(key || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  // remove o prefixo TM se presente
  const body = clean.startsWith("TM") ? clean.slice(2) : clean;
  if (body.length !== 16) return null;
  return { serial: body.slice(0, 8), sig: body.slice(8, 16) };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Total Match license OK", { headers: CORS });
    }

    if (request.method === "POST" && url.pathname === "/activate") {
      const secret = env.LICENSE_SECRET;
      if (!secret) return json({ ok: false, error: "Servidor sem secret configurado." }, 500);

      let payload;
      try { payload = await request.json(); } catch (e) { return json({ ok: false, error: "Requisição inválida." }, 400); }

      const parsed = parseKey(payload && payload.key);
      const device = String((payload && payload.device) || "").slice(0, 128);
      if (!parsed) return json({ ok: false, error: "Formato de chave inválido." });
      if (!device) return json({ ok: false, error: "Aparelho não identificado." });

      // 1) a chave é autêntica? (assinatura confere)
      const expected = await sigOf(secret, parsed.serial);
      if (expected !== parsed.sig) return json({ ok: false, error: "Chave inválida." });

      // 2) já foi ativada? amarra ao aparelho
      const existing = await env.LICENSES.get(parsed.serial);
      if (existing) {
        let rec; try { rec = JSON.parse(existing); } catch (e) { rec = {}; }
        if (rec.device && rec.device !== device) {
          return json({ ok: false, error: "Esta chave já foi ativada em outro aparelho." });
        }
      } else {
        await env.LICENSES.put(parsed.serial, JSON.stringify({ device, ts: Date.now() }));
      }

      const tokenBytes = await hmacBytes(secret, parsed.serial + "|" + device);
      return json({ ok: true, token: b32(tokenBytes.slice(0, 12)) });
    }

    return json({ ok: false, error: "Rota não encontrada." }, 404);
  },
};
