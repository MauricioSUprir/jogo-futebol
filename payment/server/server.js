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

/* ===================== ENTREGA AUTOMÁTICA (Kiwify) =====================
   Kiwify chama POST /kiwify-webhook?token=... a cada venda aprovada.
   Geramos uma chave única daquele pedido (determinística: reenvio não duplica),
   guardamos por e-mail, e o comprador pega a chave em GET /minha-chave. */

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || "";

// monta uma chave válida (mesmo formato do gerador) a partir de um "serial"
function makeKeyFromSerial(serial) {
  const sig = sigOf(SECRET, serial);
  const body = serial + sig;
  return "TM-" + body.slice(0, 4) + "-" + body.slice(4, 8) + "-" + body.slice(8, 12) + "-" + body.slice(12, 16);
}
// chave determinística por pedido (webhook repetido = mesma chave)
function keyForOrder(orderId) {
  const serial = b32(crypto.createHmac("sha256", SECRET).update("order:" + orderId).digest().subarray(0, 5)); // 8 chars
  return makeKeyFromSerial(serial);
}
function pick(obj, paths) {
  for (const p of paths) {
    let cur = obj, ok = true;
    for (const part of p.split(".")) { if (cur && typeof cur === "object" && part in cur) cur = cur[part]; else { ok = false; break; } }
    if (ok && cur) return cur;
  }
  return "";
}

app.post("/kiwify-webhook", async (req, res) => {
  if (!SECRET || !redis) return res.status(500).json({ ok: false, error: "servidor incompleto" });
  if (!WEBHOOK_TOKEN || req.query.token !== WEBHOOK_TOKEN) return res.status(403).json({ ok: false, error: "token inválido" });

  const b = req.body || {};
  const email = String(pick(b, ["Customer.email", "customer.email", "buyer.email", "email"]) || "").toLowerCase().trim();
  const orderId = String(pick(b, ["order_id", "orderId", "order_ref", "id", "Order.id", "reference"]) || "");
  const status = String(pick(b, ["order_status", "status", "Order.status", "webhook_event_type", "event"]) || "").toLowerCase();

  const paid = /paid|approv|aprov|pago|order_approved|purchase_approved|compra_aprovada/.test(status) || status === "";
  if (!email || !orderId) return res.json({ ok: false, error: "sem email/pedido" });
  if (!paid) return res.json({ ok: true, ignored: true }); // evento não-pago: ok mas ignora

  const key = keyForOrder(orderId);
  try {
    await redis.set("email:" + email, key);          // último pedido do e-mail
    await redis.set("order:" + orderId, JSON.stringify({ email, key, ts: Date.now() }));
  } catch (e) { return res.status(503).json({ ok: false, error: "banco ocupado" }); }
  return res.json({ ok: true });
});

// comprador consulta a chave pelo e-mail da compra
app.get("/key", async (req, res) => {
  if (!redis) return res.status(500).json({ ok: false });
  const email = String(req.query.email || "").toLowerCase().trim();
  if (!email) return res.json({ ok: false, error: "Informe o e-mail." });
  try {
    const key = await redis.get("email:" + email);
    if (!key) return res.json({ ok: false, error: "Nenhuma compra encontrada com esse e-mail. Use o mesmo e-mail do pagamento (pode levar 1 min após a compra)." });
    return res.json({ ok: true, key });
  } catch (e) { return res.status(503).json({ ok: false, error: "Tente de novo." }); }
});

// página simples onde o comprador pega a chave
app.get("/minha-chave", (req, res) => {
  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sua chave — Total Match</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#06070a;color:#e8e6ef;
    display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:440px;background:#0d0f14;border:1px solid #1e2230;border-radius:18px;padding:28px 24px;text-align:center}
  h1{font-size:20px;margin:0 0 4px}.sub{color:#9aa0ab;font-size:13.5px;margin:0 0 20px;line-height:1.45}
  input{width:100%;box-sizing:border-box;background:#06070a;border:1px solid #1e2230;border-radius:12px;
    padding:13px 14px;color:#fff;font-size:15px;text-align:center}
  button{width:100%;margin-top:10px;background:#22c55e;color:#052e14;border:0;border-radius:12px;padding:13px;
    font-size:15px;font-weight:800;cursor:pointer}
  .key{margin-top:16px;font-size:20px;font-weight:800;letter-spacing:2px;color:#4ade80;word-break:break-all;display:none}
  .msg{margin-top:12px;font-size:13px;min-height:16px}.err{color:#f87171}.ok{color:#4ade80}
  .steps{margin-top:18px;font-size:12px;color:#9aa0ab;line-height:1.5;text-align:left}
  a{color:#4ade80}
</style></head><body>
<div class="card">
  <h1>⚽ Total Match</h1>
  <p class="sub">Digite o e-mail que você usou na compra para receber sua chave.</p>
  <input id="e" type="email" placeholder="seu@email.com" autocomplete="email">
  <button id="b">Pegar minha chave</button>
  <div id="k" class="key"></div>
  <div id="m" class="msg"></div>
  <div class="steps">
    <b>Como ativar:</b><br>1) Copie a chave acima.<br>
    2) Abra o jogo → entre num modo pago → <b>Ativar chave</b>.<br>
    3) Cole e pronto! 🎮
  </div>
</div>
<script>
  var b=document.getElementById('b'),e=document.getElementById('e'),k=document.getElementById('k'),m=document.getElementById('m');
  b.onclick=function(){
    var email=(e.value||'').trim(); if(!email){m.className='msg err';m.textContent='Digite seu e-mail.';return;}
    m.className='msg';m.textContent='Buscando…';k.style.display='none';b.disabled=true;
    fetch('/key?email='+encodeURIComponent(email)).then(function(r){return r.json();}).then(function(d){
      b.disabled=false;
      if(d.ok){k.textContent=d.key;k.style.display='block';m.className='msg ok';m.textContent='✔ Aqui está sua chave!';}
      else{m.className='msg err';m.textContent=d.error||'Não encontrada.';}
    }).catch(function(){b.disabled=false;m.className='msg err';m.textContent='Erro de conexão. Tente de novo.';});
  };
  e.addEventListener('keydown',function(ev){if(ev.key==='Enter')b.click();});
</script></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("TM license server on :" + PORT));
